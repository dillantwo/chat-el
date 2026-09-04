import "server-only";
import { Class } from "@/models/Class";
import { School } from "@/models/School";
import { profileIdToUsername } from "@/lib/edconnect";
import { hashPassword } from "@/lib/password";
import { isDuplicateKeyError } from "@/lib/duplicate-key";
import { ROLE_LABELS } from "@/lib/subjects";
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
 * One import runs in exactly one mode:
 *
 *  - "create" (the default): a username already on file is skipped, never
 *    rewritten. This is what this endpoint has always done.
 *  - "update": the mirror image. Only accounts that already exist are touched,
 *    and a username that is not on file is skipped rather than created.
 *
 * Two modes rather than one upsert, because a mixed file makes the password
 * ambiguous — an empty password cell would mean "leave it alone" for an existing
 * account and "use the batch default" for a new one — and because a preview
 * reading "3 new, 597 changed" is much harder to check by eye than two runs that
 * each say one thing. Provisioning a roster then correcting it is the same file
 * twice with the switch flipped.
 *
 * What update mode may change is a closed list: displayName, subjects, classes,
 * and edcityLoginId for EdCity accounts. Deliberately outside it:
 *
 *  - username and authProvider, i.e. identity. Every student record in the app
 *    hangs off User._id and denormalizes `username`, so rewriting either is the
 *    one edit able to detach a class's history from the person who produced it.
 *  - password. A bulk reset is a different and far more dangerous operation than
 *    correcting a roster, and it must never be something an administrator sets
 *    off by re-uploading a file that still happens to carry the column. A
 *    password column in update mode is refused outright rather than ignored.
 *  - role, in both directions. student → teacher hands out access to other
 *    pupils' data. A row stating a role the account does not have is reported,
 *    not applied.
 *  - school. Classes and subjects only mean anything within one school, so a row
 *    naming an account from another school is an error rather than a transfer.
 *  - role "admin", in either mode: no spreadsheet mints or edits an administrator.
 *
 * An empty cell in update mode means "leave this field alone", never "clear it".
 * Emptying a field is rare, has to be deliberate, and belongs in the single-user
 * editor.
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

/**
 * Whether this import provisions accounts or corrects existing ones. Never both
 * in the same run — see the note at the top of this file.
 */
export type ImportMode = "create" | "update";

export type ImportAction = "create" | "update" | "skip" | "error";

/** Where a password account's initial password came from. Never the value. */
export type PasswordSource = "row" | "default";

/** The only fields update mode may write. */
export type UpdatableField = "displayName" | "subjects" | "classes" | "edcityLoginId";

/**
 * The same list as columns, so a file that carries none of them can be refused
 * before it produces a page of "nothing to update" rows.
 */
const UPDATABLE_COLUMNS: ColumnKey[] = ["displayName", "subjects", "classes", "edcityLoginId"];

export const UPDATABLE_FIELD_LABELS: Record<UpdatableField, string> = {
  displayName: "姓名",
  subjects: "科目",
  classes: "班級",
  edcityLoginId: "登入名",
};

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
  /**
   * Which fields an "update" row would actually change, so the preview can say
   * so before anything is written. Always empty in create mode, and empty on an
   * update row means the file matches the account and nothing is written.
   *
   * The other fields above hold the resulting state either way: a cell left
   * empty in update mode shows the value already on the account, which is what
   * makes the row recognizable as the right person.
   */
  updatedFields: UpdatableField[];
  action: ImportAction;
  /** Why this row is skipped or rejected. Empty for a clean create/update. */
  messages: string[];
}

export interface ImportPlan {
  /** Whether this import creates accounts or corrects existing ones. */
  mode: ImportMode;
  /** Which kind of account every row in this import refers to. */
  accountType: AuthProvider;
  schoolId: string;
  schoolName: string;
  academicYear: string;
  /** Subjects granted when a row leaves the subjects column empty. */
  defaultSubjects: Subject[];
  rows: ImportRowResult[];
  /** Header cells that matched no known column, so a typo is visible. */
  ignoredColumns: string[];
  summary: { total: number; create: number; update: number; skip: number; error: number };
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

/**
 * The resolved `$set` for each update row, keyed by `ImportRowResult.line`.
 *
 * Kept out of `ImportPlan` for the same reason as the passwords, if for a
 * different risk: this carries the target `_id`, and the plan the browser gets
 * back should describe the change, not hand out a handle to apply it. It also
 * keeps the writing decision in the same code that made the preview — commit
 * writes exactly this and computes nothing of its own.
 */
export type ImportUpdates = Map<number, { userId: string; set: Record<string, unknown> }>;

/**
 * Everything the commit needs that is deliberately absent from the plan. Passed
 * as one value so a caller cannot pair a plan with another call's secrets.
 */
export interface ImportWrites {
  passwords: ImportPasswords;
  updates: ImportUpdates;
}

export type PlanUserImportResult =
  | { ok: true; plan: ImportPlan; writes: ImportWrites }
  | { ok: false; error: string };

export interface PlanUserImportInput {
  text: string;
  schoolId: string;
  academicYear: string;
  /** Whether to create accounts or correct existing ones. */
  mode: ImportMode;
  /**
   * Applied to rows that have no role column or leave the cell empty. Create
   * mode only: update mode never changes a role, so there is nothing to default.
   */
  defaultRole: UserRole;
  /** Which kind of account this file refers to. Chosen once for the whole file. */
  accountType: AuthProvider;
  /**
   * Password for rows with no password cell. Create mode, password accounts
   * only. Empty means every row must carry its own.
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
 * Set comparison for the two list-valued fields update mode can write.
 *
 * Order and repetition are not meaning here — "6B|6A" is the same assignment as
 * "6A|6B" — so comparing the arrays directly would report a change on every run
 * and rewrite every account for nothing.
 */
function sameMembers(a: readonly string[], b: readonly string[]): boolean {
  const left = new Set(a);
  const right = new Set(b);
  if (left.size !== right.size) return false;
  for (const value of left) if (!right.has(value)) return false;
  return true;
}

/** The fields update mode reads off an account to decide what actually changes. */
interface ExistingUser {
  _id: unknown;
  username: string;
  authProvider?: unknown;
  role: UserRole;
  school?: unknown;
  displayName: string;
  subjects?: Subject[];
  classes?: unknown[];
  edcityLoginId?: string;
}

/**
 * Validate a roster against the database and report what would happen.
 *
 * Nothing is written. The caller commits the rows whose action is "create" or
 * "update", using the `writes` returned alongside the plan.
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
  const isUpdate = input.mode === "update";
  // Not trimmed: leading or trailing spaces are legal in a password, and
  // trimming here would store something different from what was typed.
  // Update mode never touches a password, so there is nothing to default to.
  const defaultPassword = isLocal && !isUpdate ? input.defaultPassword : "";
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
  // Update mode never writes a password, so the column is not merely unused —
  // it is refused below, and dropping it here keeps the parser from reading it.
  const active = ACTIVE_COLUMNS[input.accountType].filter(
    (key) => !(isUpdate && key === "password")
  );
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

  // Checked before the columns below, because a password column says something
  // about intent that outranks a missing column: whoever pasted this file thinks
  // it will set passwords, and that is the misunderstanding worth answering
  // first. Refused rather than ignored — the file an administrator re-uploads to
  // fix classes is usually the very file they provisioned from, passwords
  // included, and "your passwords were ignored" is not a line anyone reads on
  // the way past. This makes the one reading that would be a disaster, a silent
  // batch reset, impossible.
  if (isUpdate && COLUMN_ALIASES.password.some((alias) => header.includes(alias))) {
    return {
      ok: false,
      error:
        "名單含有密碼欄位，但更新模式不會變更密碼。請先移除該欄位；如需重設密碼，請在使用者管理逐一設定。",
    };
  }

  // The identifier column is required in both modes — it is what a row is about.
  // A name column is required only to create an account: update mode changes
  // whichever fields the file carries, and a roster that only reassigns classes
  // has no business restating six hundred names it does not intend to touch.
  const identifierLabel = isLocal ? "「username」（或「用戶名」）" : "「profileId」（或「用戶名」）";
  if (columnIndex.username < 0) {
    return {
      ok: false,
      error: `找不到必要的欄位標題。第一行必須是標題列，並且至少包含${identifierLabel}。`,
    };
  }
  if (!isUpdate && columnIndex.displayName < 0) {
    return {
      ok: false,
      error:
        `找不到必要的欄位標題。第一行必須是標題列，並且至少包含${identifierLabel}` +
        "與「displayName」（或「姓名」）。",
    };
  }

  // A file that names accounts and nothing else has nothing to apply to them.
  // Caught here rather than as six hundred identical "no change" rows.
  if (isUpdate && !UPDATABLE_COLUMNS.some((key) => columnIndex[key] >= 0)) {
    return {
      ok: false,
      error:
        "更新模式至少需要一個可修改的欄位：displayName（姓名）、subjects（科目）、classes（班級）" +
        (isLocal ? "。" : "或 edcityLoginId（登入名）。"),
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
  //
  // Every year of the school is fetched, not just the selected one, because an
  // update row that leaves the classes cell empty has to display the assignment
  // the account already has — which may well be last year's class, and showing
  // it as a bare id would defeat the point of the preview. A school has tens of
  // classes, so this stays one small query.
  const classDocs = await Class.find({ school: input.schoolId })
    .select({ _id: 1, name: 1, academicYear: 1 })
    .lean<{ _id: unknown; name: string; academicYear: string }[]>();

  const classByName = new Map(
    classDocs
      .filter((c) => c.academicYear === academicYear)
      .map((c) => [c.name.trim().toLowerCase(), { id: String(c._id), name: c.name }])
  );

  /** For naming a class the account is already in, whatever year it belongs to. */
  const classById = new Map(
    classDocs.map((c) => [String(c._id), { id: String(c._id), name: c.name }])
  );

  const cellAt = (cells: string[], key: ColumnKey): string => {
    const index = columnIndex[key];
    if (index < 0) return "";
    return (cells[index] ?? "").trim();
  };

  // First pass: parse and validate each row on its own.
  const passwords: ImportPasswords = new Map();
  const updates: ImportUpdates = new Map();

  /**
   * Which optional cells the row actually filled in, keyed by line.
   *
   * Only update mode needs this, and it needs it precisely because the parsed
   * row cannot answer the question: an empty subjects cell and a cell listing
   * every enabled subject produce the same `subjects` array, but the first means
   * "leave it alone" and the second means "set it to exactly this". Kept out of
   * `ImportRowResult` because it is parser bookkeeping, not something the browser
   * has any use for.
   */
  const provided = new Map<
    number,
    { displayName: boolean; subjects: boolean; classes: boolean; edcityLoginId: boolean }
  >();
  /** Roles the file states outright, as opposed to defaulted. Update mode only. */
  const explicitRoles = new Map<number, UserRole>();

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

    // Required to create an account, optional to correct one: an update row
    // carrying only a username and a classes cell is a legitimate reassignment,
    // and demanding the name be repeated would only invite it being repeated
    // wrongly.
    if (!displayName && !isUpdate) messages.push("缺少顯示名稱");

    // The password itself is recorded outside the row, keyed by line, so it
    // cannot ride along to the browser in the preview.
    let passwordSource: PasswordSource | null = null;
    if (isLocal && !isUpdate) {
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
    // Update mode has no default to fall back on, since it never writes a role.
    // Null here means "the file did not say", and the account's own role is
    // filled in once it has been looked up.
    let role: UserRole | null = isUpdate ? null : input.defaultRole;
    if (roleCell) {
      const resolved = ROLE_ALIASES[roleCell.toLowerCase()];
      if (!resolved) {
        // "admin" lands here deliberately: a spreadsheet must not be able to
        // mint a cross-school administrator.
        role = null;
        messages.push(`角色只能是 teacher/student，收到「${roleCell}」`);
      } else {
        role = resolved;
        explicitRoles.set(line, resolved);
      }
    }

    const subjectCell = cellAt(cells, "subjects");
    let subjects: Subject[] = [];
    if (!subjectCell) {
      // An empty cell inherits the school's subjects for a new account, and
      // changes nothing on an existing one.
      subjects = isUpdate ? [] : [...enabledSubjects];
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

    provided.set(line, {
      displayName: Boolean(displayName),
      subjects: Boolean(subjectCell),
      classes: Boolean(classCell),
      edcityLoginId: Boolean(edcityLoginId),
    });

    return {
      line,
      username,
      displayName,
      role,
      subjects,
      classes,
      edcityLoginId,
      passwordSource,
      updatedFields: [],
      action: messages.length ? "error" : input.mode,
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

  // Third pass: reconcile against what is already on file. One query for the
  // whole batch either way; the two modes want opposite answers from it.
  const candidates = parsed
    .filter((r) => r.action === "create" || r.action === "update")
    .map((r) => r.username);

  if (candidates.length) {
    const existing = await User.find({ username: { $in: candidates } })
      .select({
        _id: 1,
        username: 1,
        authProvider: 1,
        role: 1,
        school: 1,
        displayName: 1,
        subjects: 1,
        classes: 1,
        edcityLoginId: 1,
      })
      .lean<ExistingUser[]>();

    const existingByUsername = new Map(existing.map((u) => [u.username, u]));

    for (const row of parsed) {
      const found = existingByUsername.get(row.username);

      if (row.action === "create") {
        if (!found) continue;
        row.action = "skip";
        const provider = resolveAuthProvider(found.authProvider);
        // Naming which kind of account is in the way matters: it is the
        // difference between "already done" and "this name is taken by the other
        // login route", and the fix is different. Create mode never rewrites an
        // existing account, so a re-import cannot reset anyone's password.
        row.messages.push(
          provider === input.accountType
            ? "已存在，略過（如需修改請改用更新模式）"
            : provider === "edconnect"
              ? "已存在同名的 EdCity 帳戶，略過（不會改為密碼帳戶）"
              : "已存在同名的密碼帳戶，略過（不會改為 SSO 帳戶）"
        );
        continue;
      }

      if (row.action !== "update") continue;

      // Skipped rather than created: update mode creating accounts as a side
      // effect is the whole thing the mode switch exists to prevent, and a
      // username that is not on file is usually a typo or a roster that was
      // never imported in the first place.
      if (!found) {
        row.messages.push(
          isLocal
            ? "找不到此用戶名的帳戶，略過（更新模式不會新增帳戶）"
            : "找不到此 profile_id 的帳戶，略過（更新模式不會新增帳戶）"
        );
        row.action = "skip";
        continue;
      }

      const reject = (message: string) => {
        row.action = "error";
        row.messages.push(message);
      };

      const provider = resolveAuthProvider(found.authProvider);
      if (provider !== input.accountType) {
        // An error rather than a skip: the account exists and the file means it,
        // so this is the wrong account type selected for the whole run, not one
        // stray row.
        reject(
          provider === "edconnect"
            ? "此帳戶是 EdCity 帳戶，請將帳戶類型改為「EdCity 帳戶」"
            : "此帳戶是密碼帳戶，請將帳戶類型改為「密碼帳戶」"
        );
        continue;
      }

      if (found.role === "admin") {
        reject("管理員帳戶不能由匯入修改");
        continue;
      }

      // The school-boundary rule, which is why school is a request-level choice:
      // subjects are validated against this school's enabled list and classes
      // resolved within it, so applying either to another school's account would
      // be wrong even where it looked like it worked.
      if (String(found.school ?? "") !== String(input.schoolId)) {
        reject("此帳戶屬於其他學校，不會被修改");
        continue;
      }

      // From here the row describes a real account in this school, so the
      // preview shows that account's role rather than nothing.
      row.role = found.role;

      const stated = explicitRoles.get(row.line);
      if (stated && stated !== found.role) {
        reject(
          `角色與現有帳戶不符（現有：${ROLE_LABELS[found.role] ?? found.role}），` +
            "更新模式不會變更角色"
        );
        continue;
      }

      const flags = provided.get(row.line)!;
      const set: Record<string, unknown> = {};
      const changed: UpdatableField[] = [];

      if (flags.displayName) {
        if (row.displayName !== found.displayName) {
          set.displayName = row.displayName;
          changed.push("displayName");
        }
      } else {
        row.displayName = found.displayName;
      }

      if (flags.subjects) {
        // Subjects the row asked for that the school has not enabled were
        // already reported as an error in the first pass, so what is left here
        // is the full intended set and replaces what the account holds.
        const current = (found.subjects ?? []).filter((s) => ALL_SUBJECTS.includes(s));
        if (!sameMembers(current, row.subjects)) {
          set.subjects = row.subjects;
          changed.push("subjects");
        }
      } else {
        row.subjects = (found.subjects ?? []).filter((s) => ALL_SUBJECTS.includes(s));
      }

      if (flags.classes) {
        // Replaces, never appends. A roster states where a pupil is now, and
        // "6A|6B" has to be able to mean two classes rather than adding to
        // however many the account accumulated over previous years. Note this is
        // the one field that can detach a pupil from a class they have history
        // in — intended here, since reassignment at the turn of the year is what
        // update mode is for, and the history itself hangs off User._id, which
        // never moves.
        const current = (found.classes ?? []).map(String);
        const next = row.classes.map((c) => c.id);
        if (!sameMembers(current, next)) {
          set.classes = next;
          changed.push("classes");
        }
      } else {
        row.classes = (found.classes ?? [])
          .map((id) => classById.get(String(id)))
          .filter((c): c is { id: string; name: string } => Boolean(c));
      }

      if (!isLocal) {
        if (flags.edcityLoginId) {
          if (row.edcityLoginId !== (found.edcityLoginId ?? null)) {
            set.edcityLoginId = row.edcityLoginId;
            changed.push("edcityLoginId");
          }
        } else {
          row.edcityLoginId = found.edcityLoginId ?? null;
        }
      }

      // Reported as skipped rather than written as a no-op, so re-running the
      // same file twice reads "nothing left to do" instead of claiming to have
      // changed six hundred accounts.
      if (changed.length === 0) {
        row.action = "skip";
        row.messages.push("與現有資料相同，無需更新");
        continue;
      }

      row.updatedFields = changed;
      updates.set(row.line, { userId: String(found._id), set });
    }
  }

  const summary = {
    total: parsed.length,
    create: parsed.filter((r) => r.action === "create").length,
    update: parsed.filter((r) => r.action === "update").length,
    skip: parsed.filter((r) => r.action === "skip").length,
    error: parsed.filter((r) => r.action === "error").length,
  };

  return {
    ok: true,
    plan: {
      mode: input.mode,
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
    writes: { passwords, updates },
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
 * Write the rows a plan marked "create" or "update". Everything else is left
 * alone.
 *
 * Inserted one at a time rather than with insertMany, because the per-row report
 * is the product here: insertMany({ ordered: false }) would hand back a bulk
 * error whose indices have to be mapped back onto rows, and any mistake in that
 * mapping misattributes a failure to the wrong student. With the hashing lifted
 * out of the loop, the sequential cost of the inserts is not worth that risk.
 * Updates go one at a time for the same reason.
 *
 * A row that trips the unique index despite the pre-check (another admin
 * importing the same roster concurrently) is recorded as skipped, which is the
 * same outcome the pre-check would have produced.
 *
 * `writes` must be what came back from the `planUserImport` call that produced
 * this plan. A password account whose line is missing from `writes.passwords` is
 * skipped rather than written, because the schema would reject an account with
 * no hash and there is no safe value to invent; an update row missing from
 * `writes.updates` is likewise refused rather than guessed at, since this
 * function deliberately holds no opinion about what an update should contain.
 */
export async function commitUserImport(
  plan: ImportPlan,
  writes: ImportWrites = { passwords: new Map(), updates: new Map() }
): Promise<ImportPlan> {
  const isLocal = plan.accountType === "local";
  const hashes = isLocal ? await hashRowPasswords(plan.rows, writes.passwords) : new Map();

  for (const row of plan.rows) {
    if (row.action === "update") {
      await applyRowUpdate(row, writes.updates);
      continue;
    }

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
      update: plan.rows.filter((r) => r.action === "update").length,
      skip: plan.rows.filter((r) => r.action === "skip").length,
      error: plan.rows.filter((r) => r.action === "error").length,
    },
  };
}

/**
 * Apply one update row, mutating it to record the outcome.
 *
 * Matched on `_id` *and* `username` together. The id alone would be enough
 * against the account that was planned against, but the pair states the
 * invariant this mode rests on: identity does not move. If the row the plan
 * resolved is no longer the account with that username — deleted and recreated
 * between the preview and the commit — nothing is written and the row says so,
 * rather than a rename quietly landing on a stranger.
 */
async function applyRowUpdate(row: ImportRowResult, updates: ImportUpdates): Promise<void> {
  const update = updates.get(row.line);
  if (!update) {
    row.action = "error";
    row.messages.push("更新內容遺失，請重新驗證");
    return;
  }

  try {
    const result = await User.updateOne(
      { _id: update.userId, username: row.username },
      { $set: update.set }
    );
    if (result.matchedCount === 0) {
      row.action = "skip";
      row.messages.push("帳戶已不存在或已被變更，略過");
    }
  } catch (err) {
    console.error("[user-import] update failed", row.line, err);
    row.action = "error";
    row.messages.push("更新失敗，請重試此筆");
  }
}
