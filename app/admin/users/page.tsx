"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
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
import { SUBJECT_LABELS, ROLE_LABELS } from "@/lib/subjects";
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

interface UserRow {
  id: string;
  username: string;
  displayName: string;
  role: "admin" | "teacher" | "student";
  schoolId: string | null;
  schoolName: string | null;
  subjects: string[];
  /** Teachers only. null = 未設定，沿用科目權限。 */
  dataSubjects: string[] | null;
  classes: UserClass[];
}

/** The subjects whose student data a teacher may review. */
function TeacherDataSubjects({ user }: { user: UserRow }) {
  if (user.role !== "teacher") {
    return <span className="text-muted-foreground">—</span>;
  }

  // Not configured yet: access still follows the teaching subjects.
  const effective = user.dataSubjects ?? user.subjects;

  if (effective.length === 0) {
    return <span className="text-muted-foreground">無</span>;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {effective.map((sub) => (
        <Badge key={sub} variant="outline">
          {SUBJECT_LABELS[sub] ?? sub}
        </Badge>
      ))}
      {user.dataSubjects === null && (
        <span className="text-xs text-muted-foreground">（沿用科目權限）</span>
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
  const [query, setQuery] = useState("");

  // dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // form
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<"admin" | "teacher" | "student">("teacher");
  const [schoolId, setSchoolId] = useState("");
  const [subjects, setSubjects] = useState<string[]>([]);
  // Which subjects' student data a teacher may open in 查看學生數據.
  const [dataSubjects, setDataSubjects] = useState<string[]>([]);
  const [classes, setClasses] = useState<string[]>([]);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterSchool) params.set("school", filterSchool);
      if (filterRole) params.set("role", filterRole);
      if (filterClass) params.set("class", filterClass);
      if (query.trim()) params.set("q", query.trim());
      const res = await fetch(`${basePath}/api/admin/users?${params.toString()}`);
      setUsers(res.ok ? await res.json() : []);
    } finally {
      setLoading(false);
    }
  }, [filterSchool, filterRole, filterClass, query]);

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
    setDisplayName("");
    setRole("teacher");
    setSchoolId(filterSchool || "");
    setSubjects([]);
    setDataSubjects([]);
    setClasses(filterClass ? [filterClass] : []);
    setError(null);
    setDialogOpen(true);
  }

  function openEdit(u: UserRow) {
    setEditing(u);
    setUsername(u.username);
    setPassword("");
    setDisplayName(u.displayName);
    setRole(u.role);
    setSchoolId(u.schoolId ?? "");
    setSubjects(u.subjects);
    // Unset means the teacher currently falls back to their teaching subjects;
    // show that as the starting point so saving does not silently change it.
    setDataSubjects(u.dataSubjects ?? u.subjects);
    setClasses(u.classes.map((c) => c.id));
    setError(null);
    setDialogOpen(true);
  }

  function toggleSubject(value: string) {
    setSubjects((prev) =>
      prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value]
    );
  }

  function toggleDataSubject(value: string) {
    setDataSubjects((prev) =>
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
      const payload: Record<string, unknown> = { displayName };
      if (password) payload.password = password;

      if (role !== "admin") {
        payload.school = schoolId;
        payload.subjects = subjects.filter((s) => availableSubjects.includes(s));
        payload.classes = classes.filter((c) =>
          availableClasses.some((option) => option.id === c)
        );
      }

      if (role === "teacher") {
        payload.dataSubjects = dataSubjects.filter((s) => availableSubjects.includes(s));
      }

      if (!isEdit) {
        payload.username = username;
        payload.role = role;
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
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">使用者管理</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            為各校老師與學生設定可存取的科目。
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4" /> 新增使用者
        </Button>
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
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜尋用戶名或姓名"
          className="h-9 max-w-xs"
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
        <div className="overflow-hidden rounded-lg border bg-background">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="px-4">姓名</TableHead>
                <TableHead className="px-4">用戶名</TableHead>
                <TableHead className="px-4">角色</TableHead>
                <TableHead className="px-4">學校</TableHead>
                <TableHead className="px-4">班級</TableHead>
                <TableHead className="px-4">科目權限</TableHead>
                <TableHead className="px-4">學生數據權限</TableHead>
                <TableHead className="px-4" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="px-4 py-3 font-medium">{u.displayName}</TableCell>
                  <TableCell className="px-4 py-3 text-muted-foreground">{u.username}</TableCell>
                  <TableCell className="px-4 py-3">
                    <Badge variant={u.role === "admin" ? "default" : "secondary"}>
                      {ROLE_LABELS[u.role]}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-muted-foreground">{u.schoolName ?? "—"}</TableCell>
                  <TableCell className="px-4 py-3">
                    {u.role === "admin" ? (
                      <span className="text-muted-foreground">—</span>
                    ) : u.classes.length === 0 ? (
                      <span className="text-muted-foreground">未指派</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {u.classes.map((c) => (
                          <Badge key={c.id} variant="outline">
                            {classLabel(c)}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {u.role === "admin" ? (
                        <span className="text-muted-foreground">全部</span>
                      ) : u.subjects.length === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        u.subjects.map((sub) => (
                          <Badge key={sub} variant="outline">
                            {SUBJECT_LABELS[sub] ?? sub}
                          </Badge>
                        ))
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <TeacherDataSubjects user={u} />
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <div className="flex justify-end gap-2">
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
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "編輯使用者" : "新增使用者"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>用戶名</Label>
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="登入用"
                  disabled={Boolean(editing)}
                />
              </div>
              <div className="space-y-2">
                <Label>顯示名稱</Label>
                <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{editing ? "重設密碼（留空則不變）" : "密碼"}</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="至少 6 個字元"
              />
            </div>

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
                  <SelectItem value="admin">管理員</SelectItem>
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
                      setDataSubjects([]);
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
                        return (
                          <button
                            key={sub}
                            type="button"
                            onClick={() => toggleSubject(sub)}
                            className={
                              "rounded-md border px-3 py-1.5 text-sm transition-colors " +
                              (on
                                ? "border-primary bg-primary/10 text-primary"
                                : "text-muted-foreground hover:bg-muted")
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
                <Label>學生數據查看權限</Label>
                <p className="text-xs text-muted-foreground">
                  決定這位老師可在「查看學生數據」開啟哪些科目的學生記錄。留空表示不能查看任何科目。
                </p>
                {!schoolId ? (
                  <p className="text-sm text-muted-foreground">請先選擇學校。</p>
                ) : availableSubjects.length === 0 ? (
                  <p className="text-sm text-muted-foreground">該校尚未開通任何科目。</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {availableSubjects.map((sub) => {
                      const on = dataSubjects.includes(sub);
                      return (
                        <button
                          key={sub}
                          type="button"
                          onClick={() => toggleDataSubject(sub)}
                          className={
                            "rounded-md border px-3 py-1.5 text-sm transition-colors " +
                            (on
                              ? "border-primary bg-primary/10 text-primary"
                              : "text-muted-foreground hover:bg-muted")
                          }
                        >
                          {SUBJECT_LABELS[sub] ?? sub}
                        </button>
                      );
                    })}
                  </div>
                )}
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
