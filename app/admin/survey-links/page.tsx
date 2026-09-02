"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  ClipboardList,
  ExternalLink,
  Loader2,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  DEFAULT_SLOT_TITLES,
  MAX_SURVEYS_PER_GROUP,
  PHASE_LABELS,
  SURVEY_PHASES,
  type SurveyGroupDTO,
  type SurveyPhase,
} from "@/lib/surveys";
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
  groupCount: number;
  surveyCount: number;
}

/** One questionnaire being edited. `collapsed` is editor-only. */
interface EditableSurvey {
  phase: SurveyPhase;
  title: string;
  url: string;
  description: string;
  embed: boolean;
  collapsed: boolean;
}

/**
 * One 類別 being edited. Its questionnaires are a plain list: a 類別 can hold
 * several 前測 and several 後測, in whatever order the admin puts them, which is
 * the order students see.
 */
interface EditableGroup {
  name: string;
  surveys: EditableSurvey[];
  collapsed: boolean;
}

function emptySurvey(phase: SurveyPhase): EditableSurvey {
  return { phase, title: "", url: "", description: "", embed: true, collapsed: false };
}

/**
 * Loaded 類別 and questionnaires both start collapsed: a filled template is far
 * taller than the screen, and an admin usually comes here to change one link.
 */
function toEditable(groups: SurveyGroupDTO[] | undefined): EditableGroup[] {
  return (groups ?? []).map((g) => ({
    name: g.name ?? "",
    surveys: (g.surveys ?? []).map((s) => ({
      phase: s.phase,
      title: s.title ?? "",
      url: s.url ?? "",
      description: s.description ?? "",
      embed: s.embed !== false,
      collapsed: true,
    })),
    collapsed: true,
  }));
}

function move<T>(arr: T[], from: number, to: number): T[] {
  if (to < 0 || to >= arr.length) return arr;
  const next = arr.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/** State of the 新增／重新命名 dialog; `null` while it is closed. */
type NameDialogState = {
  mode: "create" | "rename";
  value: string;
  /** Create only: copy this template's 類別 into the new one. */
  copyFrom: string | null;
};

/**
 * The same rule the API enforces, shown while typing instead of on save. Empty is
 * allowed: it means the questionnaire is not set up yet.
 */
function urlProblem(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return "連結格式不正確，請貼上完整網址。";
  }
  if (parsed.protocol !== "https:") return "連結必須以 https:// 開頭。";
  return null;
}

export default function AdminSurveyLinksPage() {
  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [subject, setSubject] = useState("english");

  const [groups, setGroups] = useState<EditableGroup[]>([]);
  const [schoolIds, setSchoolIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyTemplate, setBusyTemplate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState<string | null>(null);

  const [nameDialog, setNameDialog] = useState<NameDialogState | null>(null);
  // Collapsed by default: 適用學校 is set once and then rarely touched, while the
  // 類別 below it are what an admin comes here to edit.
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
        `${basePath}/api/admin/survey-links?subject=${subject}` +
        (templateId ? `&template=${templateId}` : "");
      const res = await fetch(url);
      const data = await res.json().catch(() => ({}));
      const list: TemplateRow[] = data.templates ?? [];
      setTemplates(list);

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

  // ── 類別 editing ─────────────────────────────────────────────────────────────

  /** A new 類別 is empty: the admin then adds as many 前測／後測 as it needs. */
  function addGroup() {
    setGroups((prev) => [...prev, { name: "", surveys: [], collapsed: false }]);
  }
  function renameGroup(index: number, name: string) {
    setGroups((prev) => prev.map((g, i) => (i === index ? { ...g, name } : g)));
  }
  function removeGroup(index: number) {
    const target = groups[index];
    const filled = target.surveys.filter((s) => s.url.trim()).length;
    if (
      filled > 0 &&
      !confirm(`確定刪除類別「${target.name || "未命名"}」和裏面的 ${filled} 份問卷嗎？`)
    ) {
      return;
    }
    setGroups((prev) => prev.filter((_, i) => i !== index));
  }
  function moveGroup(index: number, dir: -1 | 1) {
    setGroups((prev) => move(prev, index, index + dir));
  }
  function toggleGroup(index: number) {
    setGroups((prev) => prev.map((g, i) => (i === index ? { ...g, collapsed: !g.collapsed } : g)));
  }

  /** Patch one 類別 without touching the others. */
  function patchGroup(index: number, patch: (g: EditableGroup) => EditableGroup) {
    setGroups((prev) => prev.map((g, i) => (i === index ? patch(g) : g)));
  }

  // ── Questionnaire editing ───────────────────────────────────────────────────

  function addSurvey(gi: number, phase: SurveyPhase) {
    patchGroup(gi, (g) =>
      g.surveys.length >= MAX_SURVEYS_PER_GROUP
        ? g
        : { ...g, collapsed: false, surveys: [...g.surveys, emptySurvey(phase)] },
    );
  }
  function removeSurvey(gi: number, si: number) {
    const target = groups[gi]?.surveys[si];
    if (target?.url.trim()) {
      const label = target.title.trim() || DEFAULT_SLOT_TITLES[target.phase];
      if (!confirm(`確定移除「${label}」嗎？`)) return;
    }
    patchGroup(gi, (g) => ({ ...g, surveys: g.surveys.filter((_, i) => i !== si) }));
  }
  function moveSurvey(gi: number, si: number, dir: -1 | 1) {
    patchGroup(gi, (g) => ({ ...g, surveys: move(g.surveys, si, si + dir) }));
  }
  function toggleSurvey(gi: number, si: number) {
    patchGroup(gi, (g) => ({
      ...g,
      surveys: g.surveys.map((s, i) => (i === si ? { ...s, collapsed: !s.collapsed } : s)),
    }));
  }
  function updateSurvey(gi: number, si: number, patch: Partial<EditableSurvey>) {
    patchGroup(gi, (g) => ({
      ...g,
      surveys: g.surveys.map((s, i) => (i === si ? { ...s, ...patch } : s)),
    }));
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

  /**
   * Unnamed 類別 are dropped rather than saved as blank tabs. Questionnaires with
   * no link are sent as they are and dropped server-side: nothing to hand out.
   */
  function payloadGroups() {
    return groups
      .filter((g) => g.name.trim().length > 0)
      .map((g) => ({
        name: g.name.trim(),
        surveys: g.surveys.map((s) => ({
          phase: s.phase,
          title: s.title.trim(),
          url: s.url.trim(),
          description: s.description.trim(),
          embed: s.embed,
        })),
      }));
  }

  /** First broken link, named so the admin knows which 類別 to open. */
  function firstUrlProblem(): string | null {
    for (const g of groups) {
      for (const [i, s] of g.surveys.entries()) {
        const problem = urlProblem(s.url);
        if (problem) {
          const label = s.title.trim() || `第 ${i + 1} 份（${PHASE_LABELS[s.phase]}）`;
          return `「${g.name.trim() || "未命名類別"}」的${label}：${problem}`;
        }
      }
    }
    return null;
  }

  async function save() {
    if (!templateId) return;

    // Stop before the round trip when a link is obviously wrong.
    const problem = firstUrlProblem();
    if (problem) {
      setError(problem);
      return;
    }

    setSaving(true);
    setError(null);
    setSavedNote(null);
    try {
      const res = await fetch(`${basePath}/api/admin/survey-links`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: templateId,
          groups: payloadGroups(),
          schools: schoolIds,
        }),
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
        const res = await fetch(`${basePath}/api/admin/survey-links`, {
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
      const problem = firstUrlProblem();
      if (problem) {
        setError(problem);
        return;
      }
      const res = await fetch(`${basePath}/api/admin/survey-links`, {
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
            ? `\n\n${affected} 間適用學校的${subjectLabel}前測-後測頁會變成空白。`
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
        `${basePath}/api/admin/survey-links?id=${encodeURIComponent(templateId)}`,
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

  const busy = saving || loading || busyTemplate;
  const hasUnnamed = groups.some((g) => !g.name.trim());

  // Enough of the selection to judge it without opening the list: the first few
  // names, plus a count of the schools this save would take from another template.
  const selectedNames = schools.filter((s) => schoolIds.includes(s.id)).map((s) => s.name);
  const namePreview =
    selectedNames.slice(0, 3).join("、") +
    (selectedNames.length > 3 ? ` 等 ${selectedNames.length} 間` : "");
  const movingCount = schoolIds.filter((id) => otherOwnerOf(id)).length;

  function templateSummary(t: TemplateRow) {
    const parts = [
      t.surveyCount > 0 ? `${t.groupCount} 類別 · ${t.surveyCount} 份問卷` : "未設問卷",
      t.schools.length > 0 ? `${t.schools.length} 間` : "未指定學校",
    ];
    return `（${parts.join(" · ")}）`;
  }

  /** What a 類別 header shows without being opened. */
  function groupSummary(g: EditableGroup) {
    const filled = g.surveys.filter((s) => s.url.trim().length > 0);
    if (filled.length === 0) {
      return g.surveys.length === 0 ? "尚未加入問卷" : `${g.surveys.length} 份問卷未填連結`;
    }

    const counts = SURVEY_PHASES.map((phase) => {
      const n = filled.filter((s) => s.phase === phase).length;
      return n > 0 ? `${n} 份${PHASE_LABELS[phase]}` : null;
    }).filter(Boolean);

    const blank = g.surveys.length - filled.length;
    return counts.join(" · ") + (blank > 0 ? ` · ${blank} 份未填連結` : "");
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">問卷範本</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          一個範本可以有多個類別，每個類別裡自行加入問卷，前測、後測各可以放多份，
          再勾選適用的學校，儲存後那些學校即時看到。同一間學校在同一科目只會屬於一個範本。
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
              <SelectTrigger className="h-9 w-64">
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
                    {templateSummary(t)}
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
          {subjectLabel}還沒有任何問卷範本，按「＋」建立第一個。
        </p>
      ) : (
        <div className="space-y-4">
          {hasUnnamed && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-700">
              未命名的類別不會被儲存，請為每個類別輸入名稱。
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
                    "size-5 shrink-0 text-[#0f766e] transition-transform duration-200",
                    schoolsOpen ? "" : "-rotate-90",
                  ].join(" ")}
                  aria-hidden
                />
                <span className="min-w-0">
                  <span className="block text-[17px] font-semibold text-[#1f2a24]">適用學校</span>
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

          {/* ── 類別 ─────────────────────────────────────────────────────── */}
          {groups.length === 0 && (
            <p className="rounded-md border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
              這個範本還沒有類別。按下面的「新增類別」，再在類別裡按「加入前測」或「加入後測」。
            </p>
          )}

          {groups.map((group, gi) => (
            <section
              key={gi}
              className="overflow-hidden rounded-[12px] border border-[#e3e6e3] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]"
            >
              {/* 類別 header — chevron + editable name + order / delete */}
              <div className="flex items-center gap-2 px-4 py-3">
                <button
                  type="button"
                  onClick={() => toggleGroup(gi)}
                  className="shrink-0 text-[#0f766e]"
                  aria-expanded={!group.collapsed}
                  aria-label={group.collapsed ? "展開類別" : "收合類別"}
                >
                  <ChevronDown
                    className={[
                      "size-5 transition-transform duration-200",
                      group.collapsed ? "-rotate-90" : "",
                    ].join(" ")}
                  />
                </button>
                <div className="min-w-0 flex-1">
                  <Input
                    value={group.name}
                    onChange={(e) => renameGroup(gi, e.target.value)}
                    placeholder="類別名稱，例如：單元一 閱讀理解"
                    className="h-9 max-w-sm border-transparent bg-transparent px-1 text-[17px] font-semibold text-[#1f2a24] shadow-none focus-visible:border-input focus-visible:bg-white"
                  />
                  <span className="mt-0.5 block px-1 text-xs text-muted-foreground">
                    {groupSummary(group)}
                  </span>
                </div>
                <div className="ml-auto flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => moveGroup(gi, -1)}
                    disabled={gi === 0}
                    aria-label="上移類別"
                  >
                    <ChevronUp className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => moveGroup(gi, 1)}
                    disabled={gi === groups.length - 1}
                    aria-label="下移類別"
                  >
                    <ChevronDown className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => removeGroup(gi)}
                    aria-label="刪除類別"
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </div>

              {!group.collapsed && (
                <>
                  {group.surveys.map((survey, si) => {
                    const problem = urlProblem(survey.url);
                    const isSet = survey.url.trim().length > 0;
                    const fieldId = `g${gi}-s${si}`;

                    return (
                      <div key={si} className="border-t border-[#eef1ee]">
                        {/* Questionnaire header — phase, title, order / remove */}
                        <div className="flex flex-wrap items-center gap-2 bg-[#f8faf8] px-4 py-2.5 sm:px-5">
                          <button
                            type="button"
                            onClick={() => toggleSurvey(gi, si)}
                            className="shrink-0 text-[#0f766e]"
                            aria-expanded={!survey.collapsed}
                            aria-label={survey.collapsed ? "展開問卷" : "收合問卷"}
                          >
                            <ChevronDown
                              className={[
                                "size-4 transition-transform duration-200",
                                survey.collapsed ? "-rotate-90" : "",
                              ].join(" ")}
                            />
                          </button>
                          <ClipboardList className="size-4 shrink-0 text-[#0f766e]" />
                          {/* Phase is editable: an admin who added the wrong one
                              should not have to delete the row and retype the link. */}
                          <Select
                            value={survey.phase}
                            onValueChange={(v) =>
                              updateSurvey(gi, si, { phase: v as SurveyPhase })
                            }
                          >
                            <SelectTrigger className="h-8 w-24 shrink-0">
                              <SelectValue>
                                {(v) => PHASE_LABELS[v as SurveyPhase] ?? "階段"}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {SURVEY_PHASES.map((phase) => (
                                <SelectItem key={phase} value={phase}>
                                  {PHASE_LABELS[phase]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            value={survey.title}
                            onChange={(e) => updateSurvey(gi, si, { title: e.target.value })}
                            placeholder={DEFAULT_SLOT_TITLES[survey.phase]}
                            aria-label="問卷標題"
                            className="h-8 min-w-0 flex-1 sm:max-w-xs"
                          />
                          {!isSet && (
                            <span className="shrink-0 text-xs text-muted-foreground">
                              未填連結
                            </span>
                          )}
                          <div className="ml-auto flex shrink-0 items-center gap-1">
                            {isSet && !problem && (
                              <a
                                href={survey.url.trim()}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mr-1 inline-flex items-center gap-1.5 text-xs font-medium text-[#0b5c55] hover:underline"
                              >
                                <ExternalLink className="size-3.5" />
                                試開連結
                              </a>
                            )}
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => moveSurvey(gi, si, -1)}
                              disabled={si === 0}
                              aria-label="上移問卷"
                            >
                              <ChevronUp className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => moveSurvey(gi, si, 1)}
                              disabled={si === group.surveys.length - 1}
                              aria-label="下移問卷"
                            >
                              <ChevronDown className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => removeSurvey(gi, si)}
                              aria-label="移除問卷"
                            >
                              <X className="size-4 text-muted-foreground" />
                            </Button>
                          </div>
                        </div>

                        {!survey.collapsed && (
                          <div className="space-y-3 px-4 py-4 sm:px-5">
                            <div className="space-y-1.5">
                              <Label
                                htmlFor={`${fieldId}-url`}
                                className="text-xs text-muted-foreground"
                              >
                                問卷連結
                              </Label>
                              <Input
                                id={`${fieldId}-url`}
                                value={survey.url}
                                onChange={(e) => updateSurvey(gi, si, { url: e.target.value })}
                                placeholder="https://eduhk.au1.qualtrics.com/jfe/form/SV_xxxxxxxx"
                                aria-invalid={problem ? true : undefined}
                                className="font-mono text-[13px]"
                              />
                              {problem ? (
                                <p className="text-xs text-destructive">{problem}</p>
                              ) : (
                                !isSet && (
                                  <p className="text-xs text-muted-foreground">
                                    未填連結的問卷儲存時會被移除。
                                  </p>
                                )
                              )}
                            </div>

                            <div className="space-y-1.5">
                              <Label
                                htmlFor={`${fieldId}-description`}
                                className="text-xs text-muted-foreground"
                              >
                                說明（可留空）
                              </Label>
                              <Textarea
                                id={`${fieldId}-description`}
                                value={survey.description}
                                onChange={(e) =>
                                  updateSurvey(gi, si, { description: e.target.value })
                                }
                                placeholder="例如：請在開始課題前完成，約需 5 分鐘。"
                                rows={2}
                              />
                            </div>

                            <label className="flex items-start gap-2 text-sm">
                              <Checkbox
                                checked={survey.embed}
                                onCheckedChange={(v) =>
                                  updateSurvey(gi, si, { embed: v === true })
                                }
                                className="mt-0.5"
                              />
                              <span>
                                直接嵌入頁面顯示
                                <span className="mt-0.5 block text-xs text-muted-foreground">
                                  少數問卷服務不允許被嵌入，學生會看到一片空白。遇到這種情況取消勾選，改為顯示「開始問卷」按鈕在新視窗開啟。
                                </span>
                              </span>
                            </label>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* 加入前測 / 加入後測 — as many of each as the 類別 needs. */}
                  <div className="flex flex-wrap items-center gap-2 border-t border-[#eef1ee] bg-[#f8faf8] px-4 py-3 sm:px-5">
                    {SURVEY_PHASES.map((phase) => (
                      <Button
                        key={phase}
                        variant="outline"
                        size="sm"
                        className="border-dashed"
                        onClick={() => addSurvey(gi, phase)}
                        disabled={group.surveys.length >= MAX_SURVEYS_PER_GROUP}
                      >
                        <Plus className="size-4" /> 加入{PHASE_LABELS[phase]}
                      </Button>
                    ))}
                    {group.surveys.length >= MAX_SURVEYS_PER_GROUP && (
                      <span className="text-xs text-muted-foreground">
                        每個類別最多 {MAX_SURVEYS_PER_GROUP} 份問卷。
                      </span>
                    )}
                    {group.surveys.length > 1 && (
                      <span className="ml-auto text-xs text-muted-foreground">
                        上下箭頭調整次序，學生按這個次序看到。
                      </span>
                    )}
                  </div>
                </>
              )}
            </section>
          ))}

          <Button variant="outline" onClick={addGroup} className="w-full border-dashed">
            <Plus className="size-4" /> 新增類別
          </Button>

          <p className="text-xs text-muted-foreground">
            學生和老師在「{subjectLabel} → 前測-後測」看到這些類別。沒有問卷的類別不會出現；全部空白的話，該頁會顯示「老師還未設定」。
          </p>
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
              {nameDialog?.mode === "rename" ? "重新命名範本" : "新增問卷範本"}
            </DialogTitle>
            <DialogDescription>
              {subjectLabel}
              {nameDialog?.mode === "create"
                ? " · 建立後再新增類別、加入問卷和適用學校。"
                : " · 只改名稱，類別和適用學校不變。"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="survey-template-name" className="text-xs text-muted-foreground">
                範本名稱
              </Label>
              <Input
                id="survey-template-name"
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
                placeholder="例如：2025-26 上學期"
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
                <span>複製「{activeTemplate.name}」的類別和問卷</span>
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
