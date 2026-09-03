"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Download, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SUBJECT_LABELS, ROLE_LABELS } from "@/lib/subjects";
import { RoleBadge, SubjectBadgeList } from "@/components/admin/badges";
import { currentAcademicYear, isValidAcademicYear } from "@/lib/academic-year";
import { basePath } from "@/lib/utils";

interface SchoolRow {
  id: string;
  name: string;
  code: string;
  enabledSubjects: string[];
  active: boolean;
}

interface ClassRow {
  id: string;
  name: string;
  academicYear: string;
  schoolId: string | null;
}

type ImportAction = "create" | "skip" | "error";

/** Which login route the imported accounts will use. */
type AccountType = "local" | "edconnect";

interface ImportRowResult {
  line: number;
  username: string;
  displayName: string;
  role: "teacher" | "student" | null;
  subjects: string[];
  classes: { id: string; name: string }[];
  edcityLoginId: string | null;
  /** Where the initial password came from. Never the password itself. */
  passwordSource: "row" | "default" | null;
  action: ImportAction;
  messages: string[];
}

interface ImportPlan {
  accountType: AccountType;
  schoolId: string;
  schoolName: string;
  academicYear: string;
  defaultSubjects: string[];
  rows: ImportRowResult[];
  ignoredColumns: string[];
  summary: { total: number; create: number; skip: number; error: number };
  committed: boolean;
}

const ACTION_LABELS: Record<ImportAction, string> = {
  create: "將新增",
  skip: "略過",
  error: "錯誤",
};

const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  local: "密碼帳戶",
  edconnect: "EdCity 帳戶",
};

const PASSWORD_SOURCE_LABELS: Record<"row" | "default", string> = {
  row: "逐筆",
  default: "預設",
};

/** Minimum initial password length, mirroring MIN_IMPORT_PASSWORD_LENGTH. */
const MIN_PASSWORD_LENGTH = 6;

/**
 * The columns each account type takes. They differ in exactly two cells: a
 * password account is identified by a username the school chooses and needs a
 * password, an EdCity account is identified by the profile_id EdConnect issues
 * and has none.
 */
const TEMPLATE_COLUMNS: Record<AccountType, readonly string[]> = {
  local: ["username", "displayName", "role", "subjects", "classes", "password"],
  edconnect: ["profileId", "displayName", "role", "subjects", "classes", "edcityLoginId"],
};

/**
 * Example rows, minus the header. The second row leaves the last cell empty on
 * purpose: for a password account that shows the batch default filling in, and
 * for EdCity that the readable login name is optional. Both also leave subjects
 * empty to show an empty cell inheriting the school's enabled subjects.
 */
const SAMPLE_ROWS: Record<AccountType, string[][]> = {
  local: [
    ["chan.siuming", "陳小明", "student", "math|chinese", "6A", "ChangeMe123"],
    ["lee.teacher", "李老師", "teacher", "", "6A|6B", ""],
  ],
  edconnect: [
    ["TYPNY8NJAOOH", "陳小明", "student", "math|chinese", "6A", "hke-stud001"],
    ["QWRTY7HJKLM2", "李老師", "teacher", "", "6A|6B", ""],
  ],
};

/** Tab-separated, which is what pasting out of Excel produces. */
function buildSample(accountType: AccountType): string {
  return [
    TEMPLATE_COLUMNS[accountType].join("\t"),
    ...SAMPLE_ROWS[accountType].map((r) => r.join("\t")),
  ].join("\n");
}

/** Quote a CSV field only when it needs it, doubling any embedded quotes. */
function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/**
 * Build the downloadable template.
 *
 * CSV rather than the tab-separated form the textarea prefers, because this file
 * is meant to be opened and edited in Excel, and .csv is what Excel associates.
 * The parser sniffs the delimiter per file, so either comes back in fine.
 *
 * Two details that are easy to get wrong and both bite only with Chinese data:
 *
 *  - The leading U+FEFF byte-order mark. Without it Excel on a Chinese Windows
 *    install opens a UTF-8 CSV using the system ANSI codepage and every Chinese
 *    name becomes mojibake — and the user's natural next step is to "fix" the
 *    names, which corrupts the file for real. lib/user-import.ts strips this BOM
 *    on the way back in, so the round trip is clean.
 *  - CRLF line endings, which Excel expects.
 *
 * Multi-value cells use "|" and never a comma, since a comma is this file's
 * field delimiter.
 */
function buildTemplateCsv(
  accountType: AccountType,
  sampleClasses: string[],
  enabledSubjects: string[]
): string {
  // Use the school's own classes and subjects when known, so the example row is
  // directly usable instead of referring to a "6A" that may not exist.
  const klass = sampleClasses[0] ?? "6A";
  const twoClasses = sampleClasses.slice(0, 2).join("|") || "6A|6B";
  const twoSubjects = enabledSubjects.slice(0, 2).join("|") || "math|chinese";

  const [first, second] = SAMPLE_ROWS[accountType];
  const rows: string[][] = [
    [...TEMPLATE_COLUMNS[accountType]],
    [first[0], first[1], first[2], twoSubjects, klass, first[5]],
    [second[0], second[1], second[2], "", twoClasses, second[5]],
  ];

  return "\uFEFF" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

export default function UserImportPage() {
  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [allClasses, setAllClasses] = useState<ClassRow[]>([]);

  const [schoolId, setSchoolId] = useState("");
  const [academicYear, setAcademicYear] = useState("");
  const [defaultRole, setDefaultRole] = useState<"student" | "teacher">("student");
  const [accountType, setAccountType] = useState<AccountType>("edconnect");
  // Used for rows whose password cell is empty. Password accounts only.
  const [defaultPassword, setDefaultPassword] = useState("");
  const [text, setText] = useState("");

  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [validating, setValidating] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${basePath}/api/admin/schools`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setSchools)
      .catch(() => setSchools([]));
    fetch(`${basePath}/api/admin/classes`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setAllClasses)
      .catch(() => setAllClasses([]));
  }, []);

  // Academic years come from the classes that actually exist for the school, so
  // the year picked here can always resolve the class names in the file.
  const academicYears = useMemo(() => {
    const years = new Set(
      allClasses.filter((c) => c.schoolId === schoolId).map((c) => c.academicYear)
    );
    return [...years].sort().reverse();
  }, [allClasses, schoolId]);

  useEffect(() => {
    // With no classes on file the field is free text, so leave whatever is
    // typed alone.
    if (academicYears.length === 0) return;
    if (academicYear && academicYears.includes(academicYear)) return;
    // Otherwise default to the year that is almost always meant: the current
    // school year if the school has classes for it, else the most recent.
    const current = currentAcademicYear();
    setAcademicYear(academicYears.includes(current) ? current : academicYears[0]);
  }, [academicYears, academicYear]);

  const selectedSchool = schools.find((s) => s.id === schoolId);
  const availableClasses = allClasses.filter(
    (c) => c.schoolId === schoolId && c.academicYear === academicYear
  );

  /** Any edit invalidates the preview: a stale plan must never be committable. */
  function invalidatePlan() {
    setPlan(null);
    setError(null);
  }

  async function post(dryRun: boolean) {
    const res = await fetch(`${basePath}/api/admin/users/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        schoolId,
        academicYear,
        defaultRole,
        accountType,
        defaultPassword,
        dryRun,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "處理失敗");
    return data as ImportPlan;
  }

  async function validate() {
    setValidating(true);
    setError(null);
    try {
      setPlan(await post(true));
    } catch (err) {
      setPlan(null);
      setError(err instanceof Error ? err.message : "處理失敗");
    } finally {
      setValidating(false);
    }
  }

  async function commit() {
    if (!plan) return;
    if (
      !confirm(
        `將為「${plan.schoolName}」新增 ${plan.summary.create} 個` +
          `${ACCOUNT_TYPE_LABELS[plan.accountType]}，確定執行？`
      )
    ) {
      return;
    }

    setCommitting(true);
    setError(null);
    try {
      // Re-validated server-side before writing, so anything that changed in the
      // database since the preview is caught rather than written blind.
      setPlan(await post(false));
    } catch (err) {
      setError(err instanceof Error ? err.message : "匯入失敗");
    } finally {
      setCommitting(false);
    }
  }

  function downloadTemplate() {
    const csv = buildTemplateCsv(
      accountType,
      availableClasses.map((c) => c.name),
      selectedSchool?.enabledSubjects ?? []
    );

    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const parts = [
      accountType === "local" ? "users" : "edcity-users",
      selectedSchool?.code,
      academicYear,
    ].filter(Boolean);

    const a = document.createElement("a");
    a.href = url;
    a.download = `${parts.join("-")}.csv`;
    a.click();
    // Released on the next tick; revoking synchronously can cancel the download
    // in some browsers.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    // Read as UTF-8. A file Excel saved as Big5 arrives mangled and the
    // administrator sees it immediately in the textarea, which is a better
    // failure than silently importing broken names.
    setText(await file.text());
    invalidatePlan();
  }

  // A typed year has to be well-formed, or every row with a class would come
  // back "找不到班級" and the real cause (a malformed year) would not be visible.
  const yearValid =
    academicYears.length > 0 ? Boolean(academicYear) : isValidAcademicYear(academicYear);
  const isLocal = accountType === "local";
  const sample = buildSample(accountType);
  // An empty default is allowed: it means every row carries its own password,
  // and any row that does not is reported as an error in the preview.
  const passwordValid =
    !isLocal || !defaultPassword || defaultPassword.length >= MIN_PASSWORD_LENGTH;
  const canValidate =
    Boolean(schoolId && text.trim()) && yearValid && passwordValid && !validating;
  const canCommit = Boolean(plan && !plan.committed && plan.summary.create > 0) && !committing;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <Link
          href="/admin/users"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> 返回使用者管理
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">批量匯入使用者</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isLocal
            ? "一次建立多個密碼帳戶。使用者以下方名單的用戶名與密碼在登入頁登入。已存在的用戶名一律略過，不會覆寫或重設任何現有帳戶的密碼。"
            : "預先建立 EdConnect 帳戶。使用者按「EdCity 登入」時，系統以 EdConnect 回傳的 profile_id 比對這裡的用戶名；比對不到就無法登入，所以名單要先匯入。"}
        </p>
      </div>

      <div className="space-y-5 rounded-lg border bg-background p-5">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>帳戶類型</Label>
            <Select
              value={accountType}
              onValueChange={(v) => {
                setAccountType(v as AccountType);
                // The password only exists for one of the two types, so drop it
                // rather than keep it around while it cannot be used.
                setDefaultPassword("");
                invalidatePlan();
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(v) => ACCOUNT_TYPE_LABELS[v as AccountType] ?? "選擇帳戶類型"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="local">密碼帳戶</SelectItem>
                <SelectItem value="edconnect">EdCity 帳戶</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {isLocal ? "用戶名 + 密碼登入。" : "以 EdConnect 的 profile_id 登入。"}
              一次匯入只能是同一種類型。
            </p>
          </div>

          <div className="space-y-2">
            <Label>學校</Label>
            <Select
              value={schoolId}
              onValueChange={(v) => {
                setSchoolId(v as string);
                invalidatePlan();
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="選擇學校">
                  {(v) => (!v ? "選擇學校" : schools.find((s) => s.id === v)?.name ?? "選擇學校")}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {schools.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                    {!s.active && "（停用）"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>學年</Label>
            {/* A picker when the school has classes, since the year only matters
                for resolving class names and must match one that exists. When it
                has none, fall back to typing: a roster with no classes column is
                still importable, and blocking it would be a dead end. */}
            {academicYears.length > 0 ? (
              <Select
                value={academicYear}
                onValueChange={(v) => {
                  setAcademicYear(v as string);
                  invalidatePlan();
                }}
                disabled={!schoolId}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="選擇學年">
                    {(v) => (!v ? "選擇學年" : String(v))}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {academicYears.map((y) => (
                    <SelectItem key={y} value={y}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={academicYear}
                onChange={(e) => {
                  setAcademicYear(e.target.value);
                  invalidatePlan();
                }}
                placeholder={currentAcademicYear()}
                disabled={!schoolId}
                aria-invalid={Boolean(academicYear) && !yearValid}
              />
            )}
            {schoolId && academicYears.length === 0 && (
              <p className="text-xs text-muted-foreground">
                {academicYear && !yearValid
                  ? "學年格式應為 2025-2026。"
                  : "此學校尚未建立班級。名單若含班級欄位，請先到「班級管理」新增，否則該欄位會被視為錯誤。"}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>預設角色</Label>
            <Select
              value={defaultRole}
              onValueChange={(v) => {
                setDefaultRole(v as "student" | "teacher");
                invalidatePlan();
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(v) => ROLE_LABELS[v as "teacher" | "student"] ?? "選擇角色"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="student">學生</SelectItem>
                <SelectItem value="teacher">老師</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              名單沒有 role 欄位時採用。管理員角色不能由此匯入。
            </p>
          </div>

          {isLocal && (
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="default-password">預設密碼</Label>
              <Input
                id="default-password"
                type="password"
                value={defaultPassword}
                onChange={(e) => {
                  setDefaultPassword(e.target.value);
                  invalidatePlan();
                }}
                placeholder={`至少 ${MIN_PASSWORD_LENGTH} 個字元`}
                aria-invalid={!passwordValid}
                autoComplete="new-password"
              />
              <p className="text-xs text-muted-foreground">
                名單沒有填 password 的資料列會用這個密碼。留空則每一列都必須自己填密碼，
                否則該列會被視為錯誤。整批共用同一個密碼時，請匯入後盡快個別更改。
              </p>
            </div>
          )}
        </div>

        {selectedSchool && (
          <p className="text-xs text-muted-foreground">
            未填 subjects 的資料列會取得此校已啟用的全部科目：
            {selectedSchool.enabledSubjects.length === 0
              ? "（此校尚未啟用任何科目）"
              : selectedSchool.enabledSubjects
                  .map((s) => SUBJECT_LABELS[s] ?? s)
                  .join("、")}
            {availableClasses.length > 0 && (
              <>
                。可用班級：{availableClasses.map((c) => c.name).join("、")}
              </>
            )}
          </p>
        )}

        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label htmlFor="roster">名單內容</Label>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={downloadTemplate}>
                <Download className="size-4" /> 下載範本
              </Button>
              <Input
                id="roster-file"
                type="file"
                accept=".csv,.tsv,.txt,text/csv,text/plain"
                onChange={(e) => onFile(e.target.files?.[0])}
                className="h-8 w-auto text-xs"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setText(sample);
                  invalidatePlan();
                }}
              >
                填入範例
              </Button>
            </div>
          </div>
          <textarea
            id="roster"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              invalidatePlan();
            }}
            rows={10}
            spellCheck={false}
            placeholder={sample}
            className="w-full rounded-md border bg-background p-3 font-mono text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          <div className="space-y-1 text-xs text-muted-foreground">
            <p>
              第一行必須是標題列。必填欄位：
              <code className="mx-1">{isLocal ? "username" : "profileId"}</code>
              （或「用戶名」）、
              <code className="mx-1">displayName</code>（或「姓名」）。選填：
              <code className="mx-1">role</code>
              <code className="mx-1">subjects</code>
              <code className="mx-1">classes</code>
              <code className="mx-1">{isLocal ? "password" : "edcityLoginId"}</code>。
            </p>
            {isLocal && (
              <p>
                用戶名只接受英文字母、數字與 <code>. _ - @</code>，會統一轉成小寫。
                <code className="mx-1">password</code> 留空的資料列會用上面的預設密碼。
              </p>
            )}
            <p>
              多值欄位用 <code>|</code> 分隔，例如 <code>math|chinese</code>、
              <code>6A|6B</code>。班級只需寫名稱，學年由上方選擇。
            </p>
            <p>
              「下載範本」給的 CSV 已含 UTF-8 BOM，用 Excel 開中文不會變亂碼。
              編輯後在 Excel 存檔時請保持「CSV UTF-8」格式，再用上面的欄位選檔上傳，
              或直接把內容複製貼進上面的框。
            </p>
          </div>
        </div>

        {error && (
          <p className="rounded-md border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={validate} disabled={!canValidate}>
            {validating && <Loader2 className="size-4 animate-spin" />}
            驗證名單
          </Button>
          <Button variant="outline" onClick={commit} disabled={!canCommit}>
            {committing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Upload className="size-4" />
            )}
            確認匯入
            {plan && !plan.committed ? `（${plan.summary.create}）` : ""}
          </Button>
          {plan && !plan.committed && (
            <span className="text-xs text-muted-foreground">
              目前只是預覽，尚未寫入資料庫。
            </span>
          )}
        </div>
      </div>

      {plan && (
        <div className="space-y-4">
          {plan.committed ? (
            <p className="flex items-center gap-2 rounded-md border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
              <CheckCircle2 className="size-4 text-primary" />
              匯入完成：新增 {plan.summary.create} 筆，略過 {plan.summary.skip} 筆，
              失敗 {plan.summary.error} 筆。
            </p>
          ) : (
            <p className="rounded-md border bg-muted/40 px-4 py-3 text-sm">
              共 {plan.summary.total} 筆：將新增 {plan.summary.create} 筆，略過{" "}
              {plan.summary.skip} 筆，錯誤 {plan.summary.error} 筆。
              {plan.summary.error > 0 && "　錯誤的資料列不會被匯入，其餘仍會照常新增。"}
            </p>
          )}

          {plan.ignoredColumns.length > 0 && (
            <p className="rounded-md border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm">
              以下欄位標題無法辨識，其內容已被忽略：{plan.ignoredColumns.join("、")}
            </p>
          )}

          <div className="overflow-hidden rounded-lg border bg-background">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="px-4">行</TableHead>
                  <TableHead className="px-4">狀態</TableHead>
                  <TableHead className="px-4">
                    {plan.accountType === "local" ? "用戶名" : "profile_id"}
                  </TableHead>
                  <TableHead className="px-4">姓名</TableHead>
                  <TableHead className="px-4">角色</TableHead>
                  {plan.accountType === "local" && <TableHead className="px-4">密碼</TableHead>}
                  <TableHead className="px-4">科目</TableHead>
                  <TableHead className="px-4">班級</TableHead>
                  <TableHead className="px-4">說明</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plan.rows.map((row) => (
                  <TableRow key={row.line}>
                    <TableCell className="px-4 py-2 text-xs text-muted-foreground">
                      {row.line}
                    </TableCell>
                    <TableCell className="px-4 py-2">
                      {/* Traffic-light reading of the dry run: green will be
                          created, amber is skipped, red is a row to fix. */}
                      <Badge
                        variant="outline"
                        className={
                          row.action === "create"
                            ? "border-emerald-300 bg-emerald-100 font-medium text-emerald-700"
                            : row.action === "skip"
                              ? "border-amber-300 bg-amber-100 font-medium text-amber-700"
                              : "border-rose-300 bg-rose-100 font-medium text-rose-700"
                        }
                      >
                        {ACTION_LABELS[row.action]}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-4 py-2 font-mono text-xs">
                      {row.username || "—"}
                      {row.edcityLoginId && (
                        <span className="mt-0.5 block font-sans text-muted-foreground">
                          {row.edcityLoginId}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-2">{row.displayName || "—"}</TableCell>
                    <TableCell className="px-4 py-2 text-sm">
                      {row.role ? (
                        <RoleBadge role={row.role} />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    {plan.accountType === "local" && (
                      // The source, never the password: it is not sent to the
                      // browser at all.
                      <TableCell className="px-4 py-2 text-sm">
                        {row.passwordSource ? (
                          <Badge variant="secondary">
                            {PASSWORD_SOURCE_LABELS[row.passwordSource]}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    )}
                    <TableCell className="px-4 py-2">
                      <SubjectBadgeList subjects={row.subjects} />
                    </TableCell>
                    <TableCell className="px-4 py-2">
                      <div className="flex flex-wrap gap-1">
                        {row.classes.length === 0 ? (
                          <span className="text-xs text-amber-600">未指派</span>
                        ) : (
                          row.classes.map((c) => (
                            <Badge
                              key={c.id}
                              variant="outline"
                              className="border-indigo-200 bg-indigo-50 text-indigo-700"
                            >
                              {c.name}
                            </Badge>
                          ))
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-2 text-xs text-muted-foreground">
                      {row.messages.join("；") || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
