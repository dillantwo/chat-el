import "server-only";
import { Class } from "@/models/Class";
import { School } from "@/models/School";
import { profileIdToUsername } from "@/lib/edconnect";
import { hashPassword } from "@/lib/password";
import { isDuplicateKeyError } from "@/lib/duplicate-key";
import {
  ALL_SUBJECTS,
  User,
  resolveAuthProvider,
  type AuthProvider,
  type Subject,
  type UserRole,
} from "@/models/User";

/**
 * Bulk provisioning of accounts from a pasted roster, in both flavours the app
 * supports: password accounts and EdConnect (EdCity) accounts.
 *
 * Splitting this from the route handler buys one thing that matters: the same
 * function produces the preview and the thing that gets written. A preview
 * computed by different code than the commit is a preview that can lie, and the
 * whole reason this feature previews at all is that a roster is a few hundred
 * rows an administrator cannot check by eye.
 *
 * The two flavours differ in exactly two places — the identifier column and the
 * password — so they share one parser rather than getting a page each. What is
 * deliberately NOT shared is the account type itself: it is chosen once for the
 * whole import instead of per row, because a mixed file makes "this row has no
 * password" ambiguous between an EdCity account and a mistake.
 *
 * Deliberately not here: role "admin" (privilege escalation from a spreadsheet)
 * and updates to existing accounts — a username already present is skipped,
 * never rewritten. Skipping is the safe default because every student record in
 * the app hangs off User._id and denormalizes `username`; a re-import that
 * touched existing rows would be the one operation able to detach a class's
 * history. It also means a re-import can never silently reset a password.
 *
 * Plaintext passwords never enter `ImportPlan`. They are returned alongside it
 * in a separate map that the route hands straight to `commitUserImport` and
 * never serializes, so the preview the browser receives cannot carry them even
 * by accident.
 */

/**
 * Ceiling on a single import.
 *
 * Each accepted row is one insert, and the request has to finish inside nginx's
 * proxy timeout (300s, see nginx.conf). Two thousand covers a whole secondary
 * school in one paste and still leaves the request comfortably short; a larger
 * roster is split rather than allowed to run for an unbounded time.
 */
export const MAX_IMPORT_ROWS = 2000;

/** Shortest initial password accepted, matching POST /api/admin/users. */
export const MIN_IMPORT_PASSWORD_LENGTH = 6;

/**
 * How many password hashes to compute at once.
 *
 * scrypt runs on libuv's threadpool, which is 4 threads by default. Measured on
 * a dev machine at the cost parameters in lib/password.ts: ~30ms per hash
 * sequentially, ~10ms each at a concurrency of 4, and no further gain past that
 * because the pool is the limit. Four keeps a full 2000-row import to roughly
 * 20s of hashing instead of 60s, without oversubscribing a pool that also
 * serves file and DNS work for everyone else on the process.
 */
const HASH_CONCURRENCY = 4;

/** Columns the parser understands, keyed by canonical name. */
type ColumnKey =
  | "username"
  | "displayName"
  | "role"
  | "subjects"
  | "classes"
  | "password"
  | "edcityLoginId";

/**
 * Accepted header spellings, normalized (lowercased, separators stripped).
 *
 * Chinese headers are included because the roster arrives as a spreadsheet
 * someone else prepared, and renaming its header row by hand before every
 * import is exactly the manual step this feature exists to remove.
 */
const COLUMN_ALIASES: Record<ColumnKey, string[]> = {
  username: ["username", "profileid", "用戶名", "用户名", "帳號", "账号", "識別碼", "识别码", "id"],
  displayName: ["displayname", "name", "姓名", "顯示名稱", "显示名称", "學生姓名", "学生姓名"],
  role: ["role", "角色", "身分", "身份"],
  subjects: ["subjects", "subject", "科目", "科目權限", "科目权限"],
  classes: ["classes", "class", "班級", "班级", "班別", "班别"],
  password: ["password", "pwd", "密碼", "密码", "初始密碼", "初始密码", "登入密碼", "登入密码"],
  edcityLoginId: ["edcityloginid", "hkedcityid", "loginid", "登入名", "登錄名", "登录名"],
};

/**
 * Which columns mean anything for a given account type. A header outside this
 * set is reported back as ignored, so pasting an EdCity roster into a password
 * import (or the reverse) is visible instead of quietly half-applied.
 */
const ACTIVE_COLUMNS: Record<AuthProvider, ColumnKey[]> = {
  local: ["username", "displayName", "role", "subjects", "classes", "password"],
  edconnect: ["username", "displayName", "role", "subjects", "classes", "edcityLoginId"],
};

/**
 * Accepted shape of a password-account username.
 *
 * Stricter than POST /api/admin/users, which accepts any non-empty string. A
 * name typed once in a dialog is seen by the person typing it; a column of six
 * hundred is not, and a cell that drifted one column left has to fail loudly
 * rather than become an account nobody can log into. `@` is allowed because
 * school logins are often email-shaped.
 */
const LOCAL_USERNAME_PATTERN = /^[a-z0-9][a-z0-9._@-]{0,127}$/;

/** Same normalization POST /api/admin/users applies to a password username. */
function normalizeLocalUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Subject names accepted in the `subjects` column, in either language. */
const SUBJECT_ALIASES: Record<string, Subject> = {
  math: "math",
  maths: "math",
  mathematics: "math",
  數學: "math",
  数学: "math",
  chinese: "chinese",
  中文: "chinese",
  中國語文: "chinese",
  中国语文: "chinese",
  english: "english",
  英文: "english",
  英語: "english",
  英语: "english",
  science: "science",
  科學: "science",
  科学: "science",
  humanities: "humanities",
  人文: "humanities",
  人文科: "humanities",
};

const ROLE_ALIASES: Record<string, UserRole> = {
  teacher: "teacher",
  老師: "teacher",
  老师: "teacher",
  教師: "teacher",
  教师: "teacher",
  student: "student",
  學生: "student",
  学生: "student",
};

export type ImportAction = "create" | "skip" | "error";

/** Where a password account's initial password came from. Never the value. */
export type PasswordSource = "row" | "default";

export interface ImportRowResult {
  /** 1-based line number in the pasted text, header included, so it matches
   * what the administrator sees in their spreadsheet. */
  line: number;
  /** Normalized username (the profile_id, for an EdConnect account). */
  username: string;
  displayName: string;
  role: UserRole | null;
  subjects: Subject[];
  /** Resolved classes, for display in the preview. */
  classes: { id: string; name: string }[];
  edcityLoginId: string | null;
  /**
   * Which password this row would get, as a source rather than a value, so the
   * preview can say "per row" or "batch default" without ever shipping the
   * password itself to the browser. Null for EdConnect accounts.
   */
  passwordSource: PasswordSource | null;
  action: ImportAction;
  /** Why this row is skipped or rejected. Empty for a clean "create". */
  messages: string[];
}

export interface ImportPlan {
  /** Which kind of account every row in this import would create. */
  accountType: AuthProvider;
  schoolId: string;
  schoolName: string;
  academicYear: string;
  /** Subjects granted when a row leaves the subjects column empty. */
  defaultSubjects: Subject[];
  rows: ImportRowResult[];
  /** Header cells that matched no known column, so a typo is visible. */
  ignoredColumns: string[];
  summary: { total: number; create: number; skip: number; error: number };
  /** False for a preview, true once the accepted rows have been written. */
  committed: boolean;
}

/**
 * Plaintext passwords keyed by `ImportRowResult.line`.
 *
 * Kept out of `ImportPlan` on purpose: the plan is the API response, and a
 * password on it would be one `JSON.stringify` away from the browser, the
 * server log and anything that caches either.
 */
export type ImportPasswords = Map<number, string>;

export type PlanUserImportResult =
  | { ok: true; plan: ImportPlan; passwords: ImportPasswords }
  | { ok: false; error: string };

export interface PlanUserImportInput {
  text: string;
  schoolId: string;
  academicYear: string;
  /** Applied to rows that have no role column or leave the cell empty. */
  defaultRole: UserRole;
  /** Which kind of account to create. Chosen once for the whole file. */
  accountType: AuthProvider;
  /**
   * Password for rows with no password cell. Password accounts only. Empty
   * means every row must carry its own.
   */
  defaultPassword: string;
}

function normalizeHeaderCell(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_\-.]/g, "");
}

/**
 * Pick the delimiter from the first line.
 *
 * Tab wins on a tie-free count because the intended happy path is pasting a
 * selection straight out of Excel, which puts tabs on the clipboard. That route
 * also sidesteps the two encoding traps of CSV files on a Chinese Windows box:
 * a UTF-8 BOM that would make the first header unmatchable, and Excel's default
 * of writing Big5 rather than UTF-8, which mangles every name.
 */
function detectDelimiter(firstLine: string): string {
  const tabs = (firstLine.match(/\t/g) ?? []).length;
  const commas = (firstLine.match(/,/g) ?? []).length;
  return tabs >= commas && tabs > 0 ? "\t" : ",";
}

/**
 * Delimited-text parser with quote handling.
 *
 * Quotes are honoured (including "" escapes and delimiters inside a field)
 * rather than splitting on the delimiter, because a silently truncated field
 * would surface later as a student with a half name and no error anywhere.
 */
function parseDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"' && field === "") {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (ch !== "\r") {
      field += ch;
    }
  }

  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

/** Split a multi-value cell such as "math|chinese" or "6A 6B". */
function splitMultiValue(cell: string): string[] {
  return cell
    .split(/[|;,/、\s]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * Validate a roster against the database and report what would happen.
 *
 * Nothing is written. The caller commits the rows whose action is "create".
 */
export async function planUserImport(
  input: PlanUserImportInput
): Promise<PlanUserImportResult> {
  const academicYear = input.academicYear.trim();
  if (!academicYear) {
    return { ok: false, error: "請選擇學年" };
  }
  if (input.defaultRole !== "teacher" && input.defaultRole !== "student") {
    return { ok: false, error: "預設角色只能是老師或學生" };
  }

  const isLocal = input.accountType === "local";
  // Not trimmed: leading or trailing spaces are legal in a password, and
  // trimming here would store something different from what was typed.
  const defaultPassword = isLocal ? input.defaultPassword : "";
  if (defaultPassword && defaultPassword.length < MIN_IMPORT_PASSWORD_LENGTH) {
    return {
      ok: false,
      error: `預設密碼至少需要 ${MIN_IMPORT_PASSWORD_LENGTH} 個字元`,
    };
  }

  const school = await School.findById(input.schoolId)
    .select("name enabledSubjects active")
    .lean<{ name: string; enabledSubjects?: Subject[]; active: boolean } | null>();

  if (!school) {
    return { ok: false, error: "學校不存在" };
  }

  const enabledSubjects = (school.enabledSubjects ?? []).filter((s) =>
    ALL_SUBJECTS.includes(s)
  );
  if (enabledSubjects.length === 0) {
    return {
      ok: false,
      error: "此學校尚未啟用任何科目，匯入的帳戶會看不到任何內容，請先設定學校科目",
    };
  }

  // Strip the BOM Excel writes ahead of UTF-8 CSV; left in place it becomes part
  // of the first header cell and no column ever matches.
  const text = input.text.replace(/^\uFEFF/, "");
  if (!text.trim()) {
    return { ok: false, error: "請貼上或上傳名單內容" };
  }

  const firstLine = text.split("\n", 1)[0] ?? "";
  const table = parseDelimited(text, detectDelimiter(firstLine)).filter((cells) =>
    cells.some((c) => c.trim())
  );

  if (table.length === 0) {
    return { ok: false, error: "請貼上或上傳名單內容" };
  }

  // Map the header row onto the columns this account type understands. Anything
  // else — a typo, or a column that only makes sense for the other type — is
  // reported as ignored rather than acted on.
  const header = table[0].map(normalizeHeaderCell);
  const active = ACTIVE_COLUMNS[input.accountType];
  const columnIndex = {} as Record<ColumnKey, number>;
  const ignoredColumns: string[] = [];

  for (const [key, aliases] of Object.entries(COLUMN_ALIASES) as [ColumnKey, string[]][]) {
    columnIndex[key] = active.includes(key)
      ? header.findIndex((cell) => aliases.includes(cell))
      : -1;
  }

  header.forEach((cell, i) => {
    if (!cell) return;
    const matched = Object.values(columnIndex).includes(i);
    if (!matched) ignoredColumns.push(table[0][i].trim());
  });

  if (columnIndex.username < 0 || columnIndex.displayName < 0) {
    return {
      ok: false,
      error: isLocal
        ? "找不到必要的欄位標題。第一行必須是標題列，並且至少包含「username」（或「用戶名」）與「displayName」（或「姓名」）。"
        : "找不到必要的欄位標題。第一行必須是標題列，並且至少包含「profileId」（或「用戶名」）與「displayName」（或「姓名」）。",
    };
  }

  // A password column while importing EdCity accounts means the wrong account
  // type was picked. Ignoring it would create working-but-unintended SSO
  // accounts, so refuse the whole file the way the single-user API does.
  if (!isLocal && COLUMN_ALIASES.password.some((alias) => header.includes(alias))) {
    return {
      ok: false,
      error:
        "名單含有密碼欄位，但目前匯入的是 EdCity 帳戶（EdCity 帳戶沒有密碼）。請改選「密碼帳戶」，或移除該欄位。",
    };
  }

  const dataRows = table.slice(1);
  if (dataRows.length === 0) {
    return { ok: false, error: "名單只有標題列，沒有資料" };
  }
  if (dataRows.length > MAX_IMPORT_ROWS) {
    return {
      ok: false,
      error: `一次最多匯入 ${MAX_IMPORT_ROWS} 筆，目前有 ${dataRows.length} 筆，請分批處理`,
    };
  }

  // Classes are resolved by name within this school and academic year, which is
  // the tuple that makes a class unique (see models/Class.ts). Disabled classes
  // stay resolvable, matching how admin edits treat them.
  const classDocs = await Class.find({ school: input.schoolId, academicYear })
    .select({ _id: 1, name: 1 })
    .lean<{ _id: unknown; name: string }[]>();

  const classByName = new Map(
    classDocs.map((c) => [c.name.trim().toLowerCase(), { id: String(c._id), name: c.name }])
  );

  const cellAt = (cells: string[], key: ColumnKey): string => {
    const index = columnIndex[key];
    if (index < 0) return "";
    return (cells[index] ?? "").trim();
  };

  // First pass: parse and validate each row on its own.
  const passwords: ImportPasswords = new Map();

  const parsed: ImportRowResult[] = dataRows.map((cells, i) => {
    const line = i + 2; // +1 for the header, +1 for 1-based counting
    const messages: string[] = [];
    const rawUsername = cellAt(cells, "username");
    const username = isLocal
      ? normalizeLocalUsername(rawUsername)
      : profileIdToUsername(rawUsername);
    const displayName = cellAt(cells, "displayName");

    if (!rawUsername) messages.push(isLocal ? "缺少用戶名" : "缺少 profile_id");
    // Guards against a stray column landing here — a value with spaces or
    // punctuation is never an identifier, and writing it would create an account
    // nobody can ever log into.
    else if (!LOCAL_USERNAME_PATTERN.test(username)) {
      messages.push(
        isLocal
          ? `用戶名格式不正確：「${rawUsername}」（只接受英文字母、數字與 . _ - @）`
          : `profile_id 格式不正確：「${rawUsername}」`
      );
    }

    if (!displayName) messages.push("缺少顯示名稱");

    // The password itself is recorded outside the row, keyed by line, so it
    // cannot ride along to the browser in the preview.
    let passwordSource: PasswordSource | null = null;
    if (isLocal) {
      const cell = columnIndex.password >= 0 ? cells[columnIndex.password] ?? "" : "";
      const password = cell || defaultPassword;

      if (!password) {
        messages.push("缺少密碼（請填 password 欄位，或在上方設定預設密碼）");
      } else if (password.length < MIN_IMPORT_PASSWORD_LENGTH) {
        messages.push(`密碼至少需要 ${MIN_IMPORT_PASSWORD_LENGTH} 個字元`);
      } else {
        passwordSource = cell ? "row" : "default";
        passwords.set(line, password);
      }
    }

    const roleCell = cellAt(cells, "role");
    let role: UserRole | null = input.defaultRole;
    if (roleCell) {
      const resolved = ROLE_ALIASES[roleCell.toLowerCase()];
      if (!resolved) {
        // "admin" lands here deliberately: a spreadsheet must not be able to
        // mint a cross-school administrator.
        role = null;
        messages.push(`角色只能是 teacher/student，收到「${roleCell}」`);
      } else {
        role = resolved;
      }
    }

    const subjectCell = cellAt(cells, "subjects");
    let subjects: Subject[] = [];
    if (!subjectCell) {
      subjects = [...enabledSubjects];
    } else {
      const unknown: string[] = [];
      const notEnabled: string[] = [];
      for (const token of splitMultiValue(subjectCell)) {
        const subject = SUBJECT_ALIASES[token.toLowerCase()];
        if (!subject) {
          unknown.push(token);
        } else if (!enabledSubjects.includes(subject)) {
          notEnabled.push(token);
        } else if (!subjects.includes(subject)) {
          subjects.push(subject);
        }
      }
      if (unknown.length) messages.push(`無法辨識的科目：${unknown.join("、")}`);
      // Reported rather than quietly dropped: silently granting less than the
      // roster states is how a class ends up unable to open a subject with no
      // trace of why.
      if (notEnabled.length) {
        messages.push(`學校未啟用的科目：${notEnabled.join("、")}`);
      }
    }

    const classCell = cellAt(cells, "classes");
    const classes: { id: string; name: string }[] = [];
    if (classCell) {
      const unknown: string[] = [];
      for (const token of splitMultiValue(classCell)) {
        const found = classByName.get(token.toLowerCase());
        if (!found) unknown.push(token);
        else if (!classes.some((c) => c.id === found.id)) classes.push(found);
      }
      if (unknown.length) {
        messages.push(
          `${academicYear} 學年找不到班級：${unknown.join("、")}（請先在班級管理建立）`
        );
      }
    }

    const edcityLoginId = cellAt(cells, "edcityLoginId") || null;

    return {
      line,
      username,
      displayName,
      role,
      subjects,
      classes,
      edcityLoginId,
      passwordSource,
      action: messages.length ? "error" : "create",
      messages,
    } satisfies ImportRowResult;
  });

  // Second pass: duplicates inside the file. The first occurrence stands so the
  // administrator sees which one will be used.
  const seen = new Set<string>();
  for (const row of parsed) {
    if (!row.username || row.action === "error") continue;
    if (seen.has(row.username)) {
      row.action = "error";
      row.messages.push(isLocal ? "名單內重複的用戶名" : "名單內重複的 profile_id");
    } else {
      seen.add(row.username);
    }
  }

  // Third pass: usernames already in the database are skipped, per the
  // create-only policy. One query for the whole batch.
  const candidates = parsed.filter((r) => r.action === "create").map((r) => r.username);
  if (candidates.length) {
    const existing = await User.find({ username: { $in: candidates } })
      .select({ username: 1, authProvider: 1 })
      .lean<{ username: string; authProvider?: unknown }[]>();

    const existingByUsername = new Map(
      existing.map((u) => [u.username, resolveAuthProvider(u.authProvider)])
    );

    for (const row of parsed) {
      const provider = existingByUsername.get(row.username);
      if (!provider) continue;
      row.action = "skip";
      // Naming which kind of account is in the way matters: it is the difference
      // between "already done" and "this name is taken by the other login
      // route", and the fix is different. Existing accounts are never rewritten,
      // so a re-import cannot reset anyone's password either.
      row.messages.push(
        provider === input.accountType
          ? "已存在，略過"
          : provider === "edconnect"
            ? "已存在同名的 EdCity 帳戶，略過（不會改為密碼帳戶）"
            : "已存在同名的密碼帳戶，略過（不會改為 SSO 帳戶）"
      );
    }
  }

  const summary = {
    total: parsed.length,
    create: parsed.filter((r) => r.action === "create").length,
    skip: parsed.filter((r) => r.action === "skip").length,
    error: parsed.filter((r) => r.action === "error").length,
  };

  return {
    ok: true,
    plan: {
      accountType: input.accountType,
      schoolId: String(input.schoolId),
      schoolName: school.name,
      academicYear,
      defaultSubjects: enabledSubjects,
      rows: parsed,
      ignoredColumns,
      summary,
      committed: false,
    },
    passwords,
  };
}

/**
 * Hash the passwords for the rows about to be written, `HASH_CONCURRENCY` at a
 * time, keyed by line.
 *
 * Done up front rather than inside the insert loop so the hashing runs in
 * parallel: awaiting one hash per insert would serialize the most expensive part
 * of the request for no benefit. Every account gets its own salt even when the
 * whole batch shares one password, so an identical password never produces an
 * identical stored hash.
 */
async function hashRowPasswords(
  rows: ImportRowResult[],
  passwords: ImportPasswords
): Promise<Map<number, string>> {
  const pending = rows
    .filter((row) => row.action === "create" && passwords.has(row.line))
    .map((row) => row.line);

  const hashed = new Map<number, string>();

  for (let i = 0; i < pending.length; i += HASH_CONCURRENCY) {
    const batch = pending.slice(i, i + HASH_CONCURRENCY);
    const results = await Promise.all(
      batch.map((line) => hashPassword(passwords.get(line)!))
    );
    batch.forEach((line, j) => hashed.set(line, results[j]));
  }

  return hashed;
}

/**
 * Write the rows a plan marked "create". Everything else is left alone.
 *
 * Inserted one at a time rather than with insertMany, because the per-row report
 * is the product here: insertMany({ ordered: false }) would hand back a bulk
 * error whose indices have to be mapped back onto rows, and any mistake in that
 * mapping misattributes a failure to the wrong student. With the hashing lifted
 * out of the loop, the sequential cost of the inserts is not worth that risk.
 *
 * A row that trips the unique index despite the pre-check (another admin
 * importing the same roster concurrently) is recorded as skipped, which is the
 * same outcome the pre-check would have produced.
 *
 * `passwords` must be the map that came back from the `planUserImport` call that
 * produced this plan. A password account whose line is missing from it is
 * skipped rather than written, because the schema would reject an account with
 * no hash and there is no safe value to invent.
 */
export async function commitUserImport(
  plan: ImportPlan,
  passwords: ImportPasswords = new Map()
): Promise<ImportPlan> {
  const isLocal = plan.accountType === "local";
  const hashes = isLocal ? await hashRowPasswords(plan.rows, passwords) : new Map();

  for (const row of plan.rows) {
    if (row.action !== "create" || !row.role) continue;

    const hashedPassword = hashes.get(row.line);
    if (isLocal && !hashedPassword) {
      row.action = "error";
      row.messages.push("缺少密碼，未寫入");
      continue;
    }

    try {
      await User.create({
        username: row.username,
        // An EdConnect account stores no hash at all: the schema only requires
        // one for local accounts, and a placeholder would look like a credential.
        ...(isLocal ? { hashedPassword } : {}),
        authProvider: plan.accountType,
        edcityLoginId: isLocal ? undefined : row.edcityLoginId ?? undefined,
        role: row.role,
        displayName: row.displayName,
        school: plan.schoolId,
        subjects: row.subjects,
        // No student-data field: a teacher reviews the student data of exactly
        // the subjects they teach, and `canViewStudentData` defaults to true.
        classes: row.classes.map((c) => c.id),
      });
    } catch (err) {
      if (isDuplicateKeyError(err)) {
        row.action = "skip";
        row.messages.push("已存在，略過（匯入期間被其他操作建立）");
        continue;
      }
      console.error("[user-import] row failed", row.line, err);
      row.action = "error";
      row.messages.push("寫入失敗，請重試此筆");
    }
  }

  return {
    ...plan,
    committed: true,
    summary: {
      total: plan.rows.length,
      create: plan.rows.filter((r) => r.action === "create").length,
      skip: plan.rows.filter((r) => r.action === "skip").length,
      error: plan.rows.filter((r) => r.action === "error").length,
    },
  };
}
