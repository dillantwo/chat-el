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
import { currentAcademicYear, isValidAcademicYear } from "@/lib/academic-year";
import { basePath } from "@/lib/utils";

interface SchoolRow {
  id: string;
  name: string;
}

interface ClassRow {
  id: string;
  name: string;
  academicYear: string;
  active: boolean;
  schoolId: string | null;
  schoolName: string | null;
  teacherCount: number;
  studentCount: number;
}

export default function ClassesPage() {
  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterSchool, setFilterSchool] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ClassRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // form
  const [name, setName] = useState("");
  const [academicYear, setAcademicYear] = useState(currentAcademicYear());
  const [schoolId, setSchoolId] = useState("");
  const [active, setActive] = useState(true);

  const loadClasses = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterSchool) params.set("school", filterSchool);
      const res = await fetch(`${basePath}/api/admin/classes?${params.toString()}`);
      setClasses(res.ok ? await res.json() : []);
    } finally {
      setLoading(false);
    }
  }, [filterSchool]);

  useEffect(() => {
    fetch(`${basePath}/api/admin/schools`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setSchools)
      .catch(() => setSchools([]));
  }, []);

  useEffect(() => {
    void loadClasses();
  }, [loadClasses]);

  function openCreate() {
    setEditing(null);
    setName("");
    setAcademicYear(currentAcademicYear());
    setSchoolId(filterSchool || "");
    setActive(true);
    setError(null);
    setDialogOpen(true);
  }

  function openEdit(row: ClassRow) {
    setEditing(row);
    setName(row.name);
    setAcademicYear(row.academicYear);
    setSchoolId(row.schoolId ?? "");
    setActive(row.active);
    setError(null);
    setDialogOpen(true);
  }

  async function save() {
    if (!name.trim()) {
      setError("班級名稱不能為空");
      return;
    }
    if (!editing && !schoolId) {
      setError("請選擇學校");
      return;
    }
    if (!isValidAcademicYear(academicYear)) {
      setError("學年格式應為 2025-2026");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const isEdit = Boolean(editing);
      const payload: Record<string, unknown> = {
        name: name.trim(),
        academicYear: academicYear.trim(),
        active,
      };
      // The school is fixed once members are assigned, so it is only sent on create.
      if (!isEdit) payload.school = schoolId;

      const res = await fetch(
        isEdit ? `${basePath}/api/admin/classes/${editing!.id}` : `${basePath}/api/admin/classes`,
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "儲存失敗");
        return;
      }
      setDialogOpen(false);
      await loadClasses();
    } finally {
      setSaving(false);
    }
  }

  async function remove(row: ClassRow) {
    if (!confirm(`確定刪除班級「${row.name}」（${row.academicYear}）？`)) return;
    const res = await fetch(`${basePath}/api/admin/classes/${row.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "刪除失敗");
      return;
    }
    await loadClasses();
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">班級管理</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            以學年劃分班級。老師只能查看自己所屬班級的學生數據。
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4" /> 新增班級
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
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : classes.length === 0 ? (
        <p className="rounded-md border border-dashed py-16 text-center text-sm text-muted-foreground">
          尚未建立任何班級。
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-background">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="px-4">班級</TableHead>
                <TableHead className="px-4">學年</TableHead>
                <TableHead className="px-4">學校</TableHead>
                <TableHead className="px-4">老師</TableHead>
                <TableHead className="px-4">學生</TableHead>
                <TableHead className="px-4">狀態</TableHead>
                <TableHead className="px-4" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {classes.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="px-4 py-3 font-medium">{row.name}</TableCell>
                  <TableCell className="px-4 py-3 text-muted-foreground">
                    {row.academicYear}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-muted-foreground">
                    {row.schoolName ?? "—"}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-muted-foreground">
                    {row.teacherCount}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-muted-foreground">
                    {row.studentCount}
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <Badge variant={row.active ? "secondary" : "outline"}>
                      {row.active ? "啟用" : "停用"}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => openEdit(row)}>
                        編輯
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => remove(row)}
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
            <DialogTitle>{editing ? "編輯班級" : "新增班級"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>學校</Label>
              <Select
                value={schoolId}
                onValueChange={(v) => setSchoolId(v as string)}
                disabled={Boolean(editing)}
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
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {editing && (
                <p className="text-xs text-muted-foreground">
                  班級建立後不能轉移學校，否則成員的班級指派會失效。
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>班級名稱</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="例如 6A"
                />
              </div>
              <div className="space-y-2">
                <Label>學年</Label>
                <Input
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
                  placeholder="2025-2026"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>狀態</Label>
              <div className="flex gap-2">
                {[
                  { value: true, label: "啟用" },
                  { value: false, label: "停用" },
                ].map((option) => (
                  <button
                    key={String(option.value)}
                    type="button"
                    onClick={() => setActive(option.value)}
                    className={
                      "rounded-md border px-3 py-1.5 text-sm transition-colors " +
                      (active === option.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted")
                    }
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                停用的班級不會出現在使用者的指派選項中，但已指派的老師仍可查看該班歷史數據。
              </p>
            </div>

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
