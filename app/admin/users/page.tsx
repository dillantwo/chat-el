"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Plus, Trash2, Upload } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { SUBJECT_LABELS, ROLE_LABELS, subjectAccent } from "@/lib/subjects";
import { RoleBadge, SubjectBadgeList } from "@/components/admin/badges";
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
  active: boolean;
  schoolId: string | null;
}

interface UserClass {
  id: string;
  name: string;
  academicYear: string;
}

function classLabel(c: { name: string; academicYear: string }) {
  return `${c.name}（${c.academicYear}）`;
}

/**
 * Cells wrap and hang from the top. TableCell defaults to nowrap + middle,
 * which is what forced the table wider than the content area; overriding it
 * here lets long badge lists reflow inside a fixed column instead.
 */
const cellClass = "px-4 py-3 align-top whitespace-normal";

type AuthProviderKind = "local" | "edconnect";

const AUTH_PROVIDER_LABELS: Record<AuthProviderKind, string> = {
  local: "密碼",
  edconnect: "EdCity",
};

interface UserRow {
  id: string;
  username: string;
  displayName: string;
  /** Which login route may sign this account in. The two are exclusive. */
  authProvider: AuthProviderKind;
  /** Readable HKEdCity login name, for SSO accounts whose username is opaque. */
  edcityLoginId: string | null;
  role: "admin" | "teacher" | "student";
  schoolId: string | null;
  schoolName: string | null;
  subjects: string[];
  /** Teachers only. Whether 查看學生數據 is available to them at all. */
  canViewStudentData: boolean;
  classes: UserClass[];
}

/**
 * Whether this teacher may review student data, and for which subjects.
 *
 * There is no separate subject list to show: a teacher reviews the student data
 * of exactly the subjects they hold, so this column reports the switch and
 * points back at 科目權限 for the scope.
 */
function TeacherDataAccess({ user }: { user: UserRow }) {
  if (user.role !== "teacher") {
    return <span className="text-muted-foreground">—</span>;
  }

  if (!user.canViewStudentData) {
    return (
      <Badge variant="outline" className="border-rose-300 bg-rose-100 text-rose-700">
        已關閉
      </Badge>
    );
  }

  if (user.subjects.length === 0) {
    // The switch is on but there is nothing in scope, which reads as a
    // misconfiguration rather than as a denial.
    return <span className="text-muted-foreground">無科目</span>;
  }

  return (
    <Badge variant="outline" className="border-emerald-300 bg-emerald-100 text-emerald-700">
      同科目權限
    </Badge>
  );
}

/**
 * Name, login route and the two identifiers, stacked.
 *
 * These were four separate columns and together they were most of the reason
 * the table needed a horizontal scrollbar. They all answer "who is this
 * account", so they read fine as one block.
 */
function UserIdentity({ user }: { user: UserRow }) {
  return (
    <div className="min-w-0 space-y-0.5">
      <div className="flex items-center gap-2">
        <span className="font-medium">{user.displayName}</span>
        {/* EdCity accounts are the ones an administrator can't reset a password
            for, so they get the saturated badge; local accounts stay quiet. */}
        <Badge
          variant="outline"
          className={
            user.authProvider === "edconnect"
              ? "border-sky-300 bg-sky-100 text-sky-700"
              : "border-border bg-muted text-muted-foreground"
          }
        >
          {AUTH_PROVIDER_LABELS[user.authProvider]}
        </Badge>
      </div>
      {/* An EdCity account's username is an opaque profile_id, so the readable
          EdCity login name is shown beneath it when known — that is the
          identifier on the school's roster. */}
      <p className="break-all font-mono text-xs text-muted-foreground">{user.username}</p>
      {user.edcityLoginId && (
        <p className="break-all text-xs text-muted-foreground">{user.edcityLoginId}</p>
      )}
    </div>
  );
}

function SubjectBadges({ user }: { user: UserRow }) {
  if (user.role === "admin") {
    return <Badge className="bg-primary/12 text-primary border-primary/30">全部</Badge>;
  }
  return <SubjectBadgeList subjects={user.subjects} />;
}

/** School on the first line, its classes beneath — one placement, one cell. */
function PlacementCell({ user }: { user: UserRow }) {
  if (user.role === "admin") return <span className="text-muted-foreground">—</span>;
  return (
    <div className="space-y-1">
      <p className="font-medium text-foreground/80">{user.schoolName ?? "—"}</p>
      {user.classes.length === 0 ? (
        <p className="text-xs text-amber-600">未指派班級</p>
      ) : (
        <div className="flex flex-wrap gap-1">
          {user.classes.map((c) => (
            <Badge
              key={c.id}
              variant="outline"
              className="border-indigo-200 bg-indigo-50 text-indigo-700"
            >
              {classLabel(c)}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

export default function UsersPage() {
  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [allClasses, setAllClasses] = useState<ClassRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  // filters
  const [filterSchool, setFilterSchool] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [filterClass, setFilterClass] = useState("");
  const [filterAuthProvider, setFilterAuthProvider] = useState("");
  const [query, setQuery] = useState("");

  // dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // form
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [authProvider, setAuthProvider] = useState<AuthProviderKind>("local");
  const [edcityLoginId, setEdcityLoginId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<"admin" | "teacher" | "student">("teacher");
  const [schoolId, setSchoolId] = useState("");
  const [subjects, setSubjects] = useState<string[]>([]);
  // Whether a teacher may open 查看學生數據. The subjects it covers are the
  // teaching subjects above, so there is nothing else to pick.
  const [canViewStudentData, setCanViewStudentData] = useState(true);
  const [classes, setClasses] = useState<string[]>([]);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterSchool) params.set("school", filterSchool);
      if (filterRole) params.set("role", filterRole);
      if (filterClass) params.set("class", filterClass);
      if (filterAuthProvider) params.set("authProvider", filterAuthProvider);
      if (query.trim()) params.set("q", query.trim());
      const res = await fetch(`${basePath}/api/admin/users?${params.toString()}`);
      setUsers(res.ok ? await res.json() : []);
    } finally {
      setLoading(false);
    }
  }, [filterSchool, filterRole, filterClass, filterAuthProvider, query]);

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

  useEffect(() => {
    const t = setTimeout(loadUsers, 250);
    return () => clearTimeout(t);
  }, [loadUsers]);

  const isSsoForm = authProvider === "edconnect";
  const selectedSchool = schools.find((s) => s.id === schoolId);
  const availableSubjects = selectedSchool?.enabledSubjects ?? [];
  // Only the chosen school's classes can be assigned.
  const availableClasses = allClasses.filter((c) => c.schoolId === schoolId);
  // The class filter follows the school filter so the dropdown stays short.
  const filterableClasses = filterSchool
    ? allClasses.filter((c) => c.schoolId === filterSchool)
    : allClasses;

  function openCreate() {
    setEditing(null);
    setUsername("");
    setPassword("");
    // Follows the filter, so creating from a filtered EdCity list starts on the
    // same kind of account the administrator is already looking at.
    setAuthProvider(filterAuthProvider === "edconnect" ? "edconnect" : "local");
    setEdcityLoginId("");
    setDisplayName("");
    setRole("teacher");
    setSchoolId(filterSchool || "");
    setSubjects([]);
    setCanViewStudentData(true);
    setClasses(filterClass ? [filterClass] : []);
    setError(null);
    setDialogOpen(true);
  }

  function openEdit(u: UserRow) {
    setEditing(u);
    setUsername(u.username);
    setPassword("");
    setAuthProvider(u.authProvider);
    setEdcityLoginId(u.edcityLoginId ?? "");
    setDisplayName(u.displayName);
    setRole(u.role);
    setSchoolId(u.schoolId ?? "");
    setSubjects(u.subjects);
    setCanViewStudentData(u.canViewStudentData);
    setClasses(u.classes.map((c) => c.id));
    setError(null);
    setDialogOpen(true);
  }

  function toggleSubject(value: string) {
    setSubjects((prev) =>
      prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value]
    );
  }

  function toggleClass(value: string) {
    setClasses((prev) =>
      prev.includes(value) ? prev.filter((c) => c !== value) : [...prev, value]
    );
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const isEdit = Boolean(editing);
      const isSso = authProvider === "edconnect";
      const payload: Record<string, unknown> = { displayName };
      // An EdCity account has no password; the API rejects one outright rather
      // than ignoring it, so never send the field for them.
      if (password && !isSso) payload.password = password;
      if (isSso) payload.edcityLoginId = edcityLoginId.trim();

      if (role !== "admin") {
        payload.school = schoolId;
        payload.subjects = subjects.filter((s) => availableSubjects.includes(s));
        payload.classes = classes.filter((c) =>
          availableClasses.some((option) => option.id === c)
        );
      }

      if (role === "teacher") {
        payload.canViewStudentData = canViewStudentData;
      }

      if (!isEdit) {
        payload.username = username;
        payload.role = role;
        payload.authProvider = authProvider;
      }

      const url = isEdit
        ? `${basePath}/api/admin/users/${editing!.id}`
        : `${basePath}/api/admin/users`;
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "儲存失敗");
        return;
      }
      setDialogOpen(false);
      await loadUsers();
    } finally {
      setSaving(false);
    }
  }

  async function remove(u: UserRow) {
    if (!confirm(`確定刪除使用者「${u.displayName}」？`)) return;
    const res = await fetch(`${basePath}/api/admin/users/${u.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "刪除失敗");
      return;
    }
    await loadUsers();
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">使用者管理</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            為各校老師與學生設定可存取的科目。
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {/* buttonVariants rather than <Button asChild>: this Button does not
              render a Slot, so wrapping a Link in it would nest <a> in <button>. */}
          <Link href="/admin/users/import" className={buttonVariants({ variant: "outline" })}>
            <Upload className="size-4" /> 批量匯入
          </Link>
          <Button onClick={openCreate}>
            <Plus className="size-4" /> 新增使用者
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select value={filterSchool} onValueChange={(v) => setFilterSchool(v as string)}>
          <SelectTrigger className="h-9 w-44">
            <SelectValue placeholder="全部學校">
              {(v) => (!v ? "全部學校" : schools.find((s) => s.id === v)?.name ?? "全部學校")}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">全部學校</SelectItem>
            {schools.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterRole} onValueChange={(v) => setFilterRole(v as string)}>
          <SelectTrigger className="h-9 w-32">
            <SelectValue placeholder="全部角色">
              {(v) =>
                !v ? "全部角色" : ROLE_LABELS[v as "admin" | "teacher" | "student"] ?? "全部角色"
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">全部角色</SelectItem>
            <SelectItem value="admin">管理員</SelectItem>
            <SelectItem value="teacher">老師</SelectItem>
            <SelectItem value="student">學生</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterClass} onValueChange={(v) => setFilterClass(v as string)}>
          <SelectTrigger className="h-9 w-44">
            <SelectValue placeholder="全部班級">
              {(v) => {
                if (!v) return "全部班級";
                const found = allClasses.find((c) => c.id === v);
                return found ? classLabel(found) : "全部班級";
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">全部班級</SelectItem>
            {filterableClasses.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {classLabel(c)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filterAuthProvider}
          onValueChange={(v) => setFilterAuthProvider(v as string)}
        >
          <SelectTrigger className="h-9 w-36">
            <SelectValue placeholder="全部登入方式">
              {(v) =>
                !v
                  ? "全部登入方式"
                  : AUTH_PROVIDER_LABELS[v as AuthProviderKind] ?? "全部登入方式"
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">全部登入方式</SelectItem>
            <SelectItem value="local">密碼</SelectItem>
            <SelectItem value="edconnect">EdCity</SelectItem>
          </SelectContent>
        </Select>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜尋用戶名、姓名或 EdCity 登入名"
          className="h-9 w-full min-w-[16rem] flex-1 sm:max-w-xs"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : users.length === 0 ? (
        <p className="rounded-md border border-dashed py-16 text-center text-sm text-muted-foreground">
          沒有符合條件的使用者。
        </p>
      ) : (
        <>
          {/* Five columns that wrap instead of nine that don't, so the table
              fits the content area without a horizontal scrollbar. Below lg
              even that is too tight, and the card list below takes over. */}
          <div className="hidden overflow-hidden rounded-lg border bg-background lg:block">
            <Table className="table-fixed">
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="w-[26%] px-4">使用者</TableHead>
                  <TableHead className="w-[9%] px-4">角色</TableHead>
                  <TableHead className="w-[24%] px-4">學校與班級</TableHead>
                  <TableHead className="w-[22%] px-4">科目權限</TableHead>
                  <TableHead className="w-[9%] px-4">學生數據</TableHead>
                  <TableHead className="w-[10%] px-4" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className={cellClass}>
                      <UserIdentity user={u} />
                    </TableCell>
                    <TableCell className={cellClass}>
                      <RoleBadge role={u.role} />
                    </TableCell>
                    <TableCell className={cellClass}>
                      <PlacementCell user={u} />
                    </TableCell>
                    <TableCell className={cellClass}>
                      <SubjectBadges user={u} />
                    </TableCell>
                    <TableCell className={cellClass}>
                      <TeacherDataAccess user={u} />
                    </TableCell>
                    <TableCell className={cellClass}>
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="outline" size="sm" onClick={() => openEdit(u)}>
                          編輯
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => remove(u)}
                          aria-label="刪除"
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-3 lg:hidden">
            {users.map((u) => (
              <div key={u.id} className="rounded-lg border bg-background p-4">
                <div className="flex items-start justify-between gap-3">
                  <UserIdentity user={u} />
                  <RoleBadge role={u.role} className="shrink-0" />
                </div>

                <dl className="mt-3 space-y-2 border-t pt-3 text-sm">
                  <div className="flex gap-3">
                    <dt className="w-20 shrink-0 text-muted-foreground">學校班級</dt>
                    <dd className="min-w-0 flex-1">
                      <PlacementCell user={u} />
                    </dd>
                  </div>
                  <div className="flex gap-3">
                    <dt className="w-20 shrink-0 text-muted-foreground">科目權限</dt>
                    <dd className="min-w-0 flex-1">
                      <SubjectBadges user={u} />
                    </dd>
                  </div>
                  <div className="flex gap-3">
                    <dt className="w-20 shrink-0 text-muted-foreground">學生數據</dt>
                    <dd className="min-w-0 flex-1">
                      <TeacherDataAccess user={u} />
                    </dd>
                  </div>
                </dl>

                <div className="mt-3 flex items-center justify-end gap-1">
                  <Button variant="outline" size="sm" onClick={() => openEdit(u)}>
                    編輯
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => remove(u)}
                    aria-label="刪除"
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "編輯使用者" : "新增使用者"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>登入方式</Label>
              <Select
                value={authProvider}
                onValueChange={(v) => {
                  const next = v as AuthProviderKind;
                  setAuthProvider(next);
                  setPassword("");
                  // EdCity cannot reach the cross-school admin role, so move a
                  // pending "admin" choice somewhere valid rather than letting
                  // the API reject the save.
                  if (next === "edconnect" && role === "admin") setRole("student");
                }}
                // Immutable after creation: switching an existing account would
                // change what its username means (a chosen name vs. a
                // profile_id), and every student record denormalizes it.
                disabled={Boolean(editing)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(v) => AUTH_PROVIDER_LABELS[v as AuthProviderKind] ?? "選擇登入方式"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="local">密碼（本平台帳戶）</SelectItem>
                  <SelectItem value="edconnect">EdCity（EdConnect SSO）</SelectItem>
                </SelectContent>
              </Select>
              {isSsoForm && (
                <p className="text-xs text-muted-foreground">
                  此帳戶只能透過 EdCity 登入，沒有密碼。用戶名必須填 EdConnect 的
                  profile_id，登入時就是用它來比對。
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{isSsoForm ? "EdConnect profile_id" : "用戶名"}</Label>
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={isSsoForm ? "例如 TYPNY8NJAOOH" : "登入用"}
                  disabled={Boolean(editing)}
                  className={isSsoForm ? "font-mono" : undefined}
                />
              </div>
              <div className="space-y-2">
                <Label>顯示名稱</Label>
                <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              </div>
            </div>

            {isSsoForm ? (
              <div className="space-y-2">
                <Label>EdCity 登入名（選填）</Label>
                <Input
                  value={edcityLoginId}
                  onChange={(e) => setEdcityLoginId(e.target.value)}
                  placeholder="例如 hke-stud001"
                />
                <p className="text-xs text-muted-foreground">
                  只用於顯示，不參與登入驗證。因為 profile_id 是一串無意義的字元，
                  這裡填了之後名單和用量報表才認得出是誰。留空的話，使用者首次成功
                  登入時會自動由 EdCity 補上。
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>{editing ? "重設密碼（留空則不變）" : "密碼"}</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="至少 6 個字元"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>角色</Label>
              <Select
                value={role}
                onValueChange={(v) => setRole(v as typeof role)}
                disabled={Boolean(editing)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(v) => ROLE_LABELS[v as "admin" | "teacher" | "student"] ?? "選擇角色"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="teacher">老師</SelectItem>
                  <SelectItem value="student">學生</SelectItem>
                  {/* Admin is cross-school and deliberately password-only. */}
                  {!isSsoForm && <SelectItem value="admin">管理員</SelectItem>}
                </SelectContent>
              </Select>
            </div>

            {role !== "admin" && (
              <>
                <div className="space-y-2">
                  <Label>學校</Label>
                  <Select
                    value={schoolId}
                    onValueChange={(v) => {
                      setSchoolId(v as string);
                      setSubjects([]);
                      setClasses([]);
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="選擇學校">
                        {(v) =>
                          !v ? "選擇學校" : schools.find((s) => s.id === v)?.name ?? "選擇學校"
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {schools.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>科目權限</Label>
                  {!schoolId ? (
                    <p className="text-sm text-muted-foreground">請先選擇學校。</p>
                  ) : availableSubjects.length === 0 ? (
                    <p className="text-sm text-muted-foreground">該校尚未開通任何科目。</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {availableSubjects.map((sub) => {
                        const on = subjects.includes(sub);
                        const accent = subjectAccent(sub);
                        return (
                          <button
                            key={sub}
                            type="button"
                            onClick={() => toggleSubject(sub)}
                            aria-pressed={on}
                            className={
                              "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors " +
                              (on ? "" : "text-muted-foreground hover:bg-muted")
                            }
                            // Selected chips take the subject's own colour, the
                            // same hue the badge in the table will use, so the
                            // picker and the result match.
                            style={
                              on
                                ? {
                                    backgroundColor: `${accent}1f`,
                                    borderColor: accent,
                                    color: accent,
                                  }
                                : undefined
                            }
                          >
                            {SUBJECT_LABELS[sub] ?? sub}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>班級</Label>
                  <p className="text-xs text-muted-foreground">
                    {role === "teacher"
                      ? "可選多個班級。老師只能查看自己所屬班級的學生數據，未指派班級則看不到任何學生。"
                      : "可選多個班級，例如原班加選修組。"}
                  </p>
                  {!schoolId ? (
                    <p className="text-sm text-muted-foreground">請先選擇學校。</p>
                  ) : availableClasses.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      該校尚未建立班級，請先到「班級管理」新增。
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {availableClasses.map((c) => {
                        const on = classes.includes(c.id);
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => toggleClass(c.id)}
                            className={
                              "rounded-md border px-3 py-1.5 text-sm transition-colors " +
                              (on
                                ? "border-primary bg-primary/10 text-primary"
                                : "text-muted-foreground hover:bg-muted")
                            }
                          >
                            {classLabel(c)}
                            {!c.active && "・停用"}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}

            {role === "teacher" && (
              <div className="space-y-2">
                <Label>學生數據</Label>
                <div className="flex items-center gap-2">
                  <Switch
                    id="user-can-view-student-data"
                    checked={canViewStudentData}
                    onCheckedChange={(checked) => setCanViewStudentData(checked)}
                  />
                  <Label htmlFor="user-can-view-student-data">允許查看學生數據</Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  可查看的科目就是上面的科目權限，不需另設。範圍仍限於同校且與自己同班的學生。
                </p>
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <DialogFooter className="flex-row justify-end gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              儲存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
