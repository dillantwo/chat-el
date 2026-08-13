"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Link2,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  X,
} from "lucide-react";
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
import { SUBJECTS, SUBJECT_LABELS } from "@/lib/subjects";
import { MATERIAL_AUDIENCE_LABELS, formatFileSize } from "@/lib/learning-materials";
import { basePath } from "@/lib/utils";

interface SchoolRow {
  id: string;
  name: string;
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

function move<T>(arr: T[], from: number, to: number): T[] {
  if (to < 0 || to >= arr.length) return arr;
  const next = arr.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

// Sentinel value for the "template" target in the school picker.
const TEMPLATE = "__template__";

export default function AdminSchoolMaterialsPage() {
  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [school, setSchool] = useState("");
  const [subject, setSubject] = useState("english");

  const [pool, setPool] = useState<PoolMaterial[]>([]);
  const [groups, setGroups] = useState<EditableGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState(false);

  const isTemplate = school === TEMPLATE;

  useEffect(() => {
    fetch(`${basePath}/api/admin/schools`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: SchoolRow[]) => {
        setSchools(data);
        if (data.length > 0) setSchool((prev) => prev || data[0].id);
      })
      .catch(() => setSchools([]));
  }, []);

  const load = useCallback(async () => {
    if (!school || !subject) return;
    setLoading(true);
    setError(null);
    try {
      const url =
        school === TEMPLATE
          ? `${basePath}/api/admin/material-templates?subject=${subject}`
          : `${basePath}/api/admin/school-materials?school=${school}&subject=${subject}`;
      const res = await fetch(url);
      if (!res.ok) {
        setPool([]);
        setGroups([]);
        return;
      }
      const data = await res.json();
      setPool(data.pool ?? []);
      setGroups(
        (data.groups ?? []).map((g: { name: string; materials: { id: string }[] }) => ({
          name: g.name,
          materialIds: g.materials.map((m) => m.id),
          collapsed: false,
        }))
      );
    } finally {
      setLoading(false);
    }
  }, [school, subject]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setSavedNote(false);
  }, [school, subject]);

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

  async function save() {
    setSaving(true);
    setError(null);
    setSavedNote(false);
    try {
      const payloadGroups = groups
        .map((g) => ({ name: g.name.trim(), materialIds: g.materialIds }))
        .filter((g) => g.name.length > 0);
      const url = isTemplate
        ? `${basePath}/api/admin/material-templates`
        : `${basePath}/api/admin/school-materials`;
      const body = isTemplate
        ? { subject, groups: payloadGroups }
        : { school, subject, groups: payloadGroups };
      const res = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "儲存失敗");
        return;
      }
      await load();
      setSavedNote(true);
    } catch {
      setError("儲存失敗，請稍後再試。");
    } finally {
      setSaving(false);
    }
  }

  async function syncToAllSchools() {
    if (
      !confirm(
        "確定將此範本同步到所有學校嗎？這會以範本內容覆蓋每間學校在此科目的分組設定，無法復原。"
      )
    ) {
      return;
    }
    setSyncing(true);
    setError(null);
    try {
      // Save the current template edits first so the sync uses the latest state.
      await save();
      const res = await fetch(`${basePath}/api/admin/material-templates/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "同步失敗");
        return;
      }
      const data = await res.json().catch(() => ({ synced: 0 }));
      alert(`已同步到 ${data.synced ?? 0} 間學校。`);
    } catch {
      setError("同步失敗，請稍後再試。");
    } finally {
      setSyncing(false);
    }
  }

  const selectedSchoolName = schools.find((s) => s.id === school)?.name;
  const hasUnnamed = groups.some((g) => !g.name.trim());

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">學校資源</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          為每間學校設定各科的分組，並從資源庫加入要顯示的資源。這裡的排列方式就是學生和老師看到的下載頁面。
          也可以先編輯「範本」，再一鍵同步到所有學校。
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">目標</Label>
          <Select value={school} onValueChange={(v) => setSchool(v as string)}>
            <SelectTrigger className="h-9 w-56">
              <SelectValue placeholder="選擇學校">
                {(v) =>
                  v === TEMPLATE
                    ? "範本（所有學校）"
                    : schools.find((s) => s.id === v)?.name ?? "選擇學校"
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TEMPLATE}>★ 範本（所有學校）</SelectItem>
              {schools.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
          {savedNote && <span className="text-sm text-green-600">已儲存</span>}
          {error && <span className="text-sm text-destructive">{error}</span>}
          {isTemplate && (
            <Button
              variant="outline"
              onClick={syncToAllSchools}
              disabled={syncing || saving || loading}
            >
              {syncing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              同步到所有學校
            </Button>
          )}
          <Button onClick={save} disabled={saving || syncing || loading || !school}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            儲存
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : !school ? (
        <p className="rounded-md border border-dashed py-16 text-center text-sm text-muted-foreground">
          請先建立並選擇學校。
        </p>
      ) : (
        <div className="space-y-4">
          {isTemplate && (
            <p className="rounded-md border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700">
              你正在編輯此科目的範本。按「同步到所有學校」會以此範本覆蓋每間學校的分組設定。
            </p>
          )}
          {pool.length === 0 && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              此科目的資源庫尚無資源，請先到「上傳資源」上傳，才能加入
              {isTemplate ? "範本" : selectedSchoolName ? `「${selectedSchoolName}」` : "學校"}。
            </p>
          )}
          {hasUnnamed && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-700">
              未命名的分組不會被儲存，請為每個分組輸入名稱。
            </p>
          )}

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
    </div>
  );
}
