"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Link2,
  Loader2,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SUBJECTS, SUBJECT_LABELS } from "@/lib/subjects";
import { MATERIAL_AUDIENCE_LABELS, formatFileSize } from "@/lib/learning-materials";
import { basePath } from "@/lib/utils";

interface SchoolRow {
  id: string;
  name: string;
}

interface TemplateRow {
  id: string;
  name: string;
  /** 適用學校 ids, used to show which template a school currently belongs to. */
  schools: string[];
}

interface PoolMaterial {
  id: string;
  title: string;
  description: string;
  audience: string;
  filename: string;
  size: number;
}

interface EditableGroup {
  name: string;
  materialIds: string[];
  collapsed?: boolean;
}

interface ApiGroup {
  name: string;
  materials: { id: string }[];
}

function move<T>(arr: T[], from: number, to: number): T[] {
  if (to < 0 || to >= arr.length) return arr;
  const next = arr.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function toEditable(groups: ApiGroup[] | undefined): EditableGroup[] {
  return (groups ?? []).map((g) => ({
    name: g.name,
    materialIds: g.materials.map((m) => m.id),
    collapsed: false,
  }));
}

/** State of the 新增／重新命名 dialog; `null` while it is closed. */
type NameDialogState = {
  mode: "create" | "rename";
  value: string;
  /** Create only: copy this template's groups into the new one. */
  copyFrom: string | null;
};

export default function AdminSchoolMaterialsPage() {
  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [subject, setSubject] = useState("english");

  const [pool, setPool] = useState<PoolMaterial[]>([]);
  const [groups, setGroups] = useState<EditableGroup[]>([]);
  const [schoolIds, setSchoolIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyTemplate, setBusyTemplate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState<string | null>(null);

  const [nameDialog, setNameDialog] = useState<NameDialogState | null>(null);
  // Collapsed by default: 適用學校 is set once and then rarely touched, while the
  // groups below it are what an admin comes here to edit.
  const [schoolsOpen, setSchoolsOpen] = useState(false);

  const activeTemplate = templates.find((t) => t.id === templateId);
  const subjectLabel = SUBJECT_LABELS[subject] ?? subject;

  useEffect(() => {
    fetch(`${basePath}/api/admin/schools`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: SchoolRow[]) => setSchools(data))
      .catch(() => setSchools([]));
  }, []);

  const load = useCallback(async () => {
    if (!subject) return;
    setLoading(true);
    setError(null);
    try {
      const url =
        `${basePath}/api/admin/material-templates?subject=${subject}` +
        (templateId ? `&template=${templateId}` : "");
      const res = await fetch(url);
      const data = await res.json().catch(() => ({}));
      const list: TemplateRow[] = data.templates ?? [];
      setTemplates(list);
      setPool(data.pool ?? []);

      // Nothing selected yet, or the selection went stale by switching subject or
      // deleting it in another tab. Land on the first template; the id change
      // re-runs this loader.
      const active = list.find((t) => t.id === templateId);
      if (!active) {
        setTemplateId(list[0]?.id ?? "");
        setGroups([]);
        setSchoolIds([]);
        return;
      }

      setGroups(toEditable(data.groups));
      setSchoolIds(active.schools);
    } finally {
      setLoading(false);
    }
  }, [subject, templateId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setSavedNote(null);
  }, [templateId, subject]);

  const poolMap = new Map(pool.map((p) => [p.id, p]));

  function addGroup() {
    setGroups((prev) => [...prev, { name: "", materialIds: [], collapsed: false }]);
  }
  function renameGroup(index: number, name: string) {
    setGroups((prev) => prev.map((g, i) => (i === index ? { ...g, name } : g)));
  }
  function removeGroup(index: number) {
    setGroups((prev) => prev.filter((_, i) => i !== index));
  }
  function moveGroup(index: number, dir: -1 | 1) {
    setGroups((prev) => move(prev, index, index + dir));
  }
  function toggleGroup(index: number) {
    setGroups((prev) =>
      prev.map((g, i) => (i === index ? { ...g, collapsed: !g.collapsed } : g))
    );
  }

  function addMaterial(groupIndex: number, materialId: string) {
    setGroups((prev) =>
      prev.map((g, i) => {
        if (i !== groupIndex) return g;
        if (g.materialIds.includes(materialId)) return g;
        return { ...g, materialIds: [...g.materialIds, materialId] };
      })
    );
  }
  function removeMaterial(groupIndex: number, materialId: string) {
    setGroups((prev) =>
      prev.map((g, i) =>
        i === groupIndex
          ? { ...g, materialIds: g.materialIds.filter((id) => id !== materialId) }
          : g
      )
    );
  }
  function moveMaterial(groupIndex: number, from: number, dir: -1 | 1) {
    setGroups((prev) =>
      prev.map((g, i) =>
        i === groupIndex ? { ...g, materialIds: move(g.materialIds, from, from + dir) } : g
      )
    );
  }

  function toggleSchool(id: string, checked: boolean) {
    setSchoolIds((prev) =>
      checked ? (prev.includes(id) ? prev : [...prev, id]) : prev.filter((x) => x !== id),
    );
  }

  /** The template of this subject that currently holds a school, if not this one. */
  function otherOwnerOf(schoolId: string): string | null {
    const owner = templates.find((t) => t.id !== templateId && t.schools.includes(schoolId));
    return owner?.name ?? null;
  }

  /** Unnamed groups are dropped rather than saved as blank rows. */
  function payloadGroups() {
    return groups
      .map((g) => ({ name: g.name.trim(), materialIds: g.materialIds }))
      .filter((g) => g.name.length > 0);
  }

  async function save() {
    if (!templateId) return;
    setSaving(true);
    setError(null);
    setSavedNote(null);
    try {
      const res = await fetch(`${basePath}/api/admin/material-templates`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: templateId, groups: payloadGroups(), schools: schoolIds }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "儲存失敗");
        return;
      }
      const moved: string[] = data.movedFrom ?? [];
      await load();
      setSavedNote(
        moved.length > 0
          ? `已儲存並套用（已從「${moved.join("」「")}」移出相關學校）`
          : "已儲存並套用",
      );
    } catch {
      setError("儲存失敗，請稍後再試。");
    } finally {
      setSaving(false);
    }
  }

  // ── Template management ──────────────────────────────────────────────────────

  function openCreateDialog() {
    setError(null);
    setNameDialog({ mode: "create", value: "", copyFrom: null });
  }

  function openRenameDialog() {
    if (!activeTemplate) return;
    setError(null);
    setNameDialog({ mode: "rename", value: activeTemplate.name, copyFrom: null });
  }

  async function submitNameDialog() {
    if (!nameDialog) return;
    const name = nameDialog.value.trim();
    if (!name) {
      setError("請輸入範本名稱");
      return;
    }

    setBusyTemplate(true);
    setError(null);
    try {
      if (nameDialog.mode === "create") {
        const res = await fetch(`${basePath}/api/admin/material-templates`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subject, name, copyFrom: nameDialog.copyFrom ?? undefined }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error ?? "新增範本失敗");
          return;
        }
        setNameDialog(null);
        // Switching the selection reloads the editor onto the new template.
        setTemplateId(data.id);
        return;
      }

      // Rename carries the open edits along, so opening the dialog mid-edit
      // cannot quietly discard them.
      const res = await fetch(`${basePath}/api/admin/material-templates`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: templateId,
          name,
          groups: payloadGroups(),
          schools: schoolIds,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "重新命名失敗");
        return;
      }
      setNameDialog(null);
      await load();
    } catch {
      setError("操作失敗，請稍後再試。");
    } finally {
      setBusyTemplate(false);
    }
  }

  async function deleteTemplate() {
    if (!activeTemplate) return;

    const affected = activeTemplate.schools.length;
    if (
      !confirm(
        `確定刪除範本「${activeTemplate.name}」嗎？` +
          (affected > 0
            ? `\n\n${affected} 間適用學校的${subjectLabel}資源頁會變成空白，除非你再把它們加到其他範本。`
            : "") +
          "\n\n此操作無法復原。"
      )
    ) {
      return;
    }

    setBusyTemplate(true);
    setError(null);
    try {
      const res = await fetch(
        `${basePath}/api/admin/material-templates?id=${encodeURIComponent(templateId)}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "刪除失敗");
        return;
      }
      const remaining = templates.filter((t) => t.id !== templateId);
      setTemplates(remaining);
      setTemplateId(remaining[0]?.id ?? "");
    } catch {
      setError("刪除失敗，請稍後再試。");
    } finally {
      setBusyTemplate(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const hasUnnamed = groups.some((g) => !g.name.trim());
  const busy = saving || loading || busyTemplate;

  // Enough of the selection to judge it without opening the list: the first few
  // names, plus a count of the schools this save would take from another template.
  const selectedNames = schools.filter((s) => schoolIds.includes(s.id)).map((s) => s.name);
  const namePreview =
    selectedNames.slice(0, 3).join("、") +
    (selectedNames.length > 3 ? ` 等 ${selectedNames.length} 間` : "");
  const movingCount = schoolIds.filter((id) => otherOwnerOf(id)).length;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">學校資源</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          每個科目可以有多個範本。一個範本裡設定分組和資源，再勾選適用的學校，儲存後那些學校的下載頁面就是這個內容。
          同一間學校在同一科目只會屬於一個範本。
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">範本</Label>
          <div className="flex items-center gap-1.5">
            <Select
              value={templateId}
              onValueChange={(v) => setTemplateId(v as string)}
              disabled={templates.length === 0}
            >
              <SelectTrigger className="h-9 w-56">
                <SelectValue placeholder="尚無範本">
                  {(v) =>
                    templates.find((t) => t.id === (v as string))?.name ??
                    (templates.length === 0 ? "尚無範本" : "選擇範本")
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                    {t.schools.length > 0 ? `（${t.schools.length} 間）` : "（未指定學校）"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon-sm"
              className="size-9"
              onClick={openCreateDialog}
              disabled={busy}
              title="新增範本"
              aria-label="新增範本"
            >
              <Plus className="size-4" />
            </Button>
            {activeTemplate && (
              <>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="size-9"
                  onClick={openRenameDialog}
                  disabled={busy}
                  title="重新命名範本"
                  aria-label="重新命名範本"
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="size-9"
                  onClick={deleteTemplate}
                  disabled={busy}
                  title="刪除範本"
                  aria-label="刪除範本"
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </>
            )}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">科目</Label>
          <Select value={subject} onValueChange={(v) => setSubject(v as string)}>
            <SelectTrigger className="h-9 w-40">
              <SelectValue>{(v) => SUBJECT_LABELS[v as string] ?? "選擇科目"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {SUBJECTS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {savedNote && <span className="text-sm text-green-600">{savedNote}</span>}
          {error && <span className="text-sm text-destructive">{error}</span>}
          <Button onClick={save} disabled={busy || !templateId}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            儲存並套用
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : !activeTemplate ? (
        <p className="rounded-md border border-dashed py-16 text-center text-sm text-muted-foreground">
          {subjectLabel}還沒有任何範本，按「＋」建立第一個。
        </p>
      ) : (
        <div className="space-y-4">
          {pool.length === 0 && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              此科目的資源庫尚無資源，請先到「上傳資源」上傳，才能加入範本。
            </p>
          )}
          {hasUnnamed && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-700">
              未命名的分組不會被儲存，請為每個分組輸入名稱。
            </p>
          )}

          {/* ── 適用學校 ─────────────────────────────────────────────────── */}
          <section className="rounded-[12px] border border-[#e3e6e3] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <div className="flex items-center gap-2 px-4 py-3">
              <button
                type="button"
                onClick={() => setSchoolsOpen((open) => !open)}
                aria-expanded={schoolsOpen}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
              >
                <ChevronDown
                  className={[
                    "size-5 shrink-0 text-[#16a34a] transition-transform duration-200",
                    schoolsOpen ? "" : "-rotate-90",
                  ].join(" ")}
                  aria-hidden
                />
                <span className="min-w-0">
                  <span className="block text-[17px] font-semibold text-[#1f2a24]">適用學校</span>
                  {/* The summary carries the whole point of the section, so the
                      list itself can stay shut most of the time. */}
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {schools.length === 0
                      ? "尚未建立任何學校"
                      : schoolIds.length === 0
                        ? "未指定學校 · 這個範本只是草稿，沒有人看得到"
                        : `已選 ${schoolIds.length} / ${schools.length} 間 · ${namePreview}`}
                    {movingCount > 0 && (
                      <span className="text-amber-600">
                        {" "}
                        · 其中 {movingCount} 間會從其他範本移出
                      </span>
                    )}
                  </span>
                </span>
              </button>
              {schoolsOpen && schools.length > 0 && (
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSchoolIds(schools.map((s) => s.id))}
                    disabled={busy}
                  >
                    全選
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSchoolIds([])}
                    disabled={busy || schoolIds.length === 0}
                  >
                    清除
                  </Button>
                </div>
              )}
            </div>

            {schoolsOpen &&
              (schools.length === 0 ? (
                <p className="border-t border-[#eef1ee] px-5 py-4 text-sm text-muted-foreground">
                  尚未建立任何學校。
                </p>
              ) : (
                <ul className="max-h-56 overflow-y-auto border-t border-[#eef1ee]">
                  {schools.map((s) => {
                    const owner = otherOwnerOf(s.id);
                    const checked = schoolIds.includes(s.id);
                    return (
                      <li key={s.id} className="border-b border-[#f2f5f2] last:border-b-0">
                        <label className="flex cursor-pointer items-center gap-3 px-5 py-2.5 hover:bg-[#f8faf8]">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) => toggleSchool(s.id, v === true)}
                            disabled={busy}
                          />
                          <span className="text-sm">{s.name}</span>
                          {/* Ticking a school that belongs elsewhere moves it, so
                              say where it is coming from before the save. */}
                          {owner && (
                            <span
                              className={
                                "ml-auto shrink-0 text-xs " +
                                (checked ? "text-amber-600" : "text-muted-foreground")
                              }
                            >
                              {checked ? `將從「${owner}」移出` : `目前屬於「${owner}」`}
                            </span>
                          )}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              ))}
          </section>

          {groups.map((group, gi) => {
            const available = pool.filter((p) => !group.materialIds.includes(p.id));
            const isCollapsed = group.collapsed;
            return (
              <section
                key={gi}
                className="overflow-hidden rounded-[12px] border border-[#e3e6e3] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]"
              >
                {/* Group header — chevron + editable name + group controls */}
                <div className="flex items-center gap-2 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => toggleGroup(gi)}
                    className="shrink-0 text-[#16a34a]"
                    aria-label={isCollapsed ? "展開" : "收合"}
                  >
                    <ChevronDown
                      className={[
                        "size-5 transition-transform duration-200",
                        isCollapsed ? "-rotate-90" : "",
                      ].join(" ")}
                    />
                  </button>
                  <Input
                    value={group.name}
                    onChange={(e) => renameGroup(gi, e.target.value)}
                    placeholder="分組名稱，例如：前測 (Pre-test)"
                    className="h-9 max-w-sm border-transparent bg-transparent px-1 text-[17px] font-semibold text-[#1f2a24] shadow-none focus-visible:border-input focus-visible:bg-white"
                  />
                  <div className="ml-auto flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => moveGroup(gi, -1)}
                      disabled={gi === 0}
                      aria-label="上移分組"
                    >
                      <ChevronUp className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => moveGroup(gi, 1)}
                      disabled={gi === groups.length - 1}
                      aria-label="下移分組"
                    >
                      <ChevronDown className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => removeGroup(gi)}
                      aria-label="刪除分組"
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </div>

                {!isCollapsed && (
                  <>
                    <ul>
                      {group.materialIds.length === 0 ? (
                        <li className="border-t border-[#eef1ee] px-5 py-3 text-sm text-muted-foreground">
                          尚未加入資源。
                        </li>
                      ) : (
                        group.materialIds.map((mid, mi) => {
                          const m = poolMap.get(mid);
                          return (
                            <li
                              key={mid}
                              className="flex items-center gap-3 border-t border-[#eef1ee] px-5 py-3"
                            >
                              <Link2 className="size-4 shrink-0 text-[#3aa0c9]" />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="truncate text-[15px] font-medium text-[#16a34a]">
                                    {m ? m.title : "（資源已刪除）"}
                                  </span>
                                  {m && (
                                    <Badge variant="secondary" className="shrink-0">
                                      {MATERIAL_AUDIENCE_LABELS[m.audience] ?? m.audience}
                                    </Badge>
                                  )}
                                </div>
                                {m && (
                                  <span className="text-xs text-[#8a938c]">
                                    {m.filename} · {formatFileSize(m.size)}
                                  </span>
                                )}
                              </div>
                              <div className="flex shrink-0 items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() => moveMaterial(gi, mi, -1)}
                                  disabled={mi === 0}
                                  aria-label="上移"
                                >
                                  <ChevronUp className="size-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() => moveMaterial(gi, mi, 1)}
                                  disabled={mi === group.materialIds.length - 1}
                                  aria-label="下移"
                                >
                                  <ChevronDown className="size-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() => removeMaterial(gi, mid)}
                                  aria-label="移除"
                                >
                                  <X className="size-4 text-muted-foreground" />
                                </Button>
                              </div>
                            </li>
                          );
                        })
                      )}
                    </ul>

                    <div className="border-t border-[#eef1ee] bg-[#f8faf8] px-5 py-2.5">
                      <Select
                        value=""
                        onValueChange={(v) => v && addMaterial(gi, v as string)}
                        disabled={available.length === 0}
                      >
                        <SelectTrigger className="h-9 w-full max-w-sm border-dashed">
                          <SelectValue
                            placeholder={available.length === 0 ? "沒有可加入的資源" : "＋ 加入資源"}
                          >
                            {() => (available.length === 0 ? "沒有可加入的資源" : "＋ 加入資源")}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {available.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.title}（{MATERIAL_AUDIENCE_LABELS[p.audience] ?? p.audience}）
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
              </section>
            );
          })}

          <Button variant="outline" onClick={addGroup} className="w-full border-dashed">
            <Plus className="size-4" /> 新增分組
          </Button>
        </div>
      )}

      {/* ── 新增／重新命名範本 ─────────────────────────────────────────────── */}
      <Dialog
        open={nameDialog !== null}
        onOpenChange={(open) => {
          if (!open) setNameDialog(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {nameDialog?.mode === "rename" ? "重新命名範本" : "新增範本"}
            </DialogTitle>
            <DialogDescription>
              {subjectLabel}
              {nameDialog?.mode === "create"
                ? " · 建立後再設定分組和適用學校。"
                : " · 只改名稱，分組和適用學校不變。"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="template-name" className="text-xs text-muted-foreground">
                範本名稱
              </Label>
              <Input
                id="template-name"
                autoFocus
                value={nameDialog?.value ?? ""}
                onChange={(e) =>
                  setNameDialog((prev) => (prev ? { ...prev, value: e.target.value } : prev))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !busyTemplate) {
                    e.preventDefault();
                    void submitNameDialog();
                  }
                }}
                placeholder="例如：基礎版、增潤版"
              />
            </div>

            {nameDialog?.mode === "create" && activeTemplate && (
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={nameDialog.copyFrom !== null}
                  onCheckedChange={(checked) =>
                    setNameDialog((prev) =>
                      prev
                        ? { ...prev, copyFrom: checked === true ? activeTemplate.id : null }
                        : prev,
                    )
                  }
                />
                <span>複製「{activeTemplate.name}」的分組內容</span>
              </label>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <DialogFooter className="flex-row justify-end">
            <Button variant="ghost" onClick={() => setNameDialog(null)} disabled={busyTemplate}>
              取消
            </Button>
            <Button onClick={submitNameDialog} disabled={busyTemplate}>
              {busyTemplate && <Loader2 className="size-4 animate-spin" />}
              {nameDialog?.mode === "rename" ? "儲存名稱" : "建立範本"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
