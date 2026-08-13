"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { SUBJECTS, SUBJECT_LABELS, type SubjectValue } from "@/lib/subjects";
import { SUBJECT_TOPICS, topicKey } from "@/lib/topics";
import { basePath } from "@/lib/utils";

interface SchoolRow {
  id: string;
  name: string;
  code: string;
  enabledSubjects: string[];
  /** `subject:topic` keys this school has closed. Everything else is open. */
  disabledTopics: string[];
  active: boolean;
  userCount: number;
}

export default function SchoolsPage() {
  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SchoolRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // form state
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [subjects, setSubjects] = useState<string[]>([]);
  // Stored as a blocklist to match the database: an empty list means every topic
  // of the enabled subjects is open.
  const [disabledTopics, setDisabledTopics] = useState<string[]>([]);
  const [active, setActive] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`${basePath}/api/admin/schools`);
      setSchools(res.ok ? await res.json() : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setEditing(null);
    setName("");
    setCode("");
    // A new school starts with every subject and every topic open.
    setSubjects(SUBJECTS.map((s) => s.value));
    setDisabledTopics([]);
    setActive(true);
    setError(null);
    setDialogOpen(true);
  }

  function openEdit(s: SchoolRow) {
    setEditing(s);
    setName(s.name);
    setCode(s.code);
    setSubjects(s.enabledSubjects);
    setDisabledTopics(s.disabledTopics ?? []);
    setActive(s.active);
    setError(null);
    setDialogOpen(true);
  }

  function toggleSubject(value: string) {
    setSubjects((prev) =>
      prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value]
    );
  }

  function toggleTopic(subject: string, topic: string) {
    const key = topicKey(subject, topic);
    setDisabledTopics((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const isEdit = Boolean(editing);
      const url = isEdit
        ? `${basePath}/api/admin/schools/${editing!.id}`
        : `${basePath}/api/admin/schools`;
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          code,
          enabledSubjects: subjects,
          disabledTopics,
          active,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "儲存失敗");
        return;
      }
      setDialogOpen(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function remove(s: SchoolRow) {
    if (!confirm(`確定刪除「${s.name}」？此操作無法復原。`)) return;
    const res = await fetch(`${basePath}/api/admin/schools/${s.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "刪除失敗");
      return;
    }
    await load();
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">學校管理</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            建立學校，並設定該校開通的科目與主題。
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4" /> 新增學校
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : schools.length === 0 ? (
        <p className="rounded-md border border-dashed py-16 text-center text-sm text-muted-foreground">
          尚未建立任何學校。
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-background">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="px-4">學校</TableHead>
                <TableHead className="px-4">代碼</TableHead>
                <TableHead className="px-4">開通科目</TableHead>
                <TableHead className="px-4">使用者</TableHead>
                <TableHead className="px-4">狀態</TableHead>
                <TableHead className="px-4" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {schools.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="px-4 py-3 font-medium">{s.name}</TableCell>
                  <TableCell className="px-4 py-3 text-muted-foreground">{s.code}</TableCell>
                  <TableCell className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {s.enabledSubjects.length === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        s.enabledSubjects.map((sub) => (
                          <Badge key={sub} variant="secondary">
                            {SUBJECT_LABELS[sub] ?? sub}
                          </Badge>
                        ))
                      )}
                      {(s.disabledTopics?.length ?? 0) > 0 && (
                        <Badge variant="outline" className="text-muted-foreground">
                          已關閉 {s.disabledTopics.length} 個主題
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-muted-foreground">{s.userCount}</TableCell>
                  <TableCell className="px-4 py-3">
                    <Badge variant={s.active ? "default" : "outline"}>
                      {s.active ? "啟用" : "停用"}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => openEdit(s)}>
                        編輯
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => remove(s)}
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
            <DialogTitle>{editing ? "編輯學校" : "新增學校"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>學校名稱</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：聖保羅書院" />
            </div>
            <div className="space-y-2">
              <Label>學校代碼</Label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="例如：spc（建立後不可更改）"
                disabled={Boolean(editing)}
              />
            </div>
            <div className="space-y-2">
              <Label>開通科目</Label>
              <div className="flex flex-wrap gap-2">
                {SUBJECTS.map((s) => {
                  const on = subjects.includes(s.value);
                  return (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => toggleSubject(s.value)}
                      className={
                        "rounded-md border px-3 py-1.5 text-sm transition-colors " +
                        (on
                          ? "border-primary bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-muted")
                      }
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Topics are listed only for the subjects this school holds, since a
                closed subject already hides everything inside it. */}
            {subjects.length > 0 && (
              <div className="space-y-2">
                <Label>開放主題</Label>
                <p className="text-xs text-muted-foreground">
                  取消勾選的主題不會在該科目頁面出現，學生和老師也無法直接開啟。
                </p>
                <div className="max-h-64 space-y-3 overflow-y-auto rounded-md border p-3">
                  {SUBJECTS.filter((s) => subjects.includes(s.value)).map((s) => (
                    <div key={s.value} className="space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground">{s.label}</p>
                      <div className="flex flex-wrap gap-2">
                        {(SUBJECT_TOPICS[s.value as SubjectValue] ?? []).map((t) => {
                          const on = !disabledTopics.includes(topicKey(s.value, t.key));
                          return (
                            <button
                              key={t.key}
                              type="button"
                              onClick={() => toggleTopic(s.value, t.key)}
                              className={
                                "rounded-md border px-2.5 py-1 text-xs transition-colors " +
                                (on
                                  ? "border-primary bg-primary/10 text-primary"
                                  : "text-muted-foreground line-through hover:bg-muted")
                              }
                            >
                              {t.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Switch
                id="school-active"
                checked={active}
                onCheckedChange={(checked) => setActive(checked)}
              />
              <Label htmlFor="school-active">啟用學校</Label>
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
