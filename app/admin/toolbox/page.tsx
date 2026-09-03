"use client";

import { useEffect, useState } from "react";
import { Building2, Check, Loader2, Pencil, Wrench, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/admin/badges";
import { basePath } from "@/lib/utils";

type SchoolScope = "all" | "selected";

interface ScopeState {
  schoolScope: SchoolScope;
  /** School ids, only meaningful when schoolScope is "selected". */
  schools: string[];
}

interface AdminTool extends ScopeState {
  key: string;
  label: string;
  sub: string;
  icon: string;
  isActive: boolean;
}

interface AdminToolboxGroup extends ScopeState {
  id: string;
  type: string;
  label: string;
  description: string;
  isActive: boolean;
  tools: AdminTool[];
}

interface SchoolOption {
  id: string;
  name: string;
}

/** Which group (and optionally tool) the scope dialog is editing. */
interface ScopeTarget {
  type: string;
  toolKey?: string;
  title: string;
  current: ScopeState;
}

export default function AdminToolboxPage() {
  const [groups, setGroups] = useState<AdminToolboxGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  // Which label is currently being edited, and its draft value.
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [scopeTarget, setScopeTarget] = useState<ScopeTarget | null>(null);
  const [scopeDraft, setScopeDraft] = useState<ScopeState>({ schoolScope: "all", schools: [] });
  const [scopeSaving, setScopeSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [toolboxRes, schoolsRes] = await Promise.all([
        fetch(`${basePath}/api/admin/toolbox`),
        fetch(`${basePath}/api/admin/schools`),
      ]);
      setGroups(toolboxRes.ok ? await toolboxRes.json() : []);
      if (schoolsRes.ok) {
        const rows: { id: string; name: string }[] = await schoolsRes.json();
        setSchools(rows.map((r) => ({ id: r.id, name: r.name })));
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  /** Only the ids that still match a school, so a deleted one is not counted. */
  function liveSchools(scope: ScopeState) {
    return scope.schools.filter((id) => schools.some((s) => s.id === id));
  }

  function schoolScopeLabel(scope: ScopeState) {
    if (scope.schoolScope === "all") return "全部學校";

    const live = liveSchools(scope);
    if (live.length === 0) return "未指定學校";
    if (live.length === 1) return schools.find((s) => s.id === live[0])!.name;
    return `${live.length} 間學校`;
  }

  /**
   * A tool is usable only where its group is too, so a tool row reading 全部學校
   * inside a narrowed group would be misleading. This is the note that says so.
   */
  function effectiveScopeNote(group: AdminToolboxGroup, tool: AdminTool) {
    if (group.schoolScope === "all") return null;

    const groupLive = liveSchools(group);
    if (groupLive.length === 0) return "群組未指定學校";

    if (tool.schoolScope === "all") return `實際只有群組的 ${schoolScopeLabel(group)}`;

    const both = liveSchools(tool).filter((id) => groupLive.includes(id));
    if (both.length === 0) return "與群組範圍沒有交集，目前無人可用";
    return `與群組交集後：${both.length} 間學校`;
  }

  function openScope(target: ScopeTarget) {
    setError(null);
    setScopeTarget(target);
    setScopeDraft({
      schoolScope: target.current.schoolScope,
      schools: [...target.current.schools],
    });
  }

  function toggleScopeSchool(id: string) {
    setScopeDraft((prev) => ({
      ...prev,
      schools: prev.schools.includes(id)
        ? prev.schools.filter((s) => s !== id)
        : [...prev.schools, id],
    }));
  }

  async function saveScope() {
    if (!scopeTarget || scopeSaving) return;

    const pendingKey = scopeTarget.toolKey
      ? `${scopeTarget.type}:${scopeTarget.toolKey}`
      : scopeTarget.type;

    setError(null);
    setScopeSaving(true);
    setPending((prev) => new Set(prev).add(pendingKey));
    try {
      const res = await fetch(`${basePath}/api/admin/toolbox`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: scopeTarget.type,
          ...(scopeTarget.toolKey ? { toolKey: scopeTarget.toolKey } : {}),
          schoolScope: scopeDraft.schoolScope,
          schools: scopeDraft.schools,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "更新失敗");
        return;
      }

      // The server drops ids of schools that no longer exist, so take its answer
      // rather than the draft.
      const saved: AdminToolboxGroup = await res.json();
      setGroups((prev) => prev.map((g) => (g.type === saved.type ? { ...g, ...saved } : g)));
      setScopeTarget(null);
    } finally {
      setScopeSaving(false);
      setPending((prev) => {
        const next = new Set(prev);
        next.delete(pendingKey);
        return next;
      });
    }
  }

  async function patch(
    body: { type: string; toolKey?: string; isActive: boolean },
    pendingKey: string
  ) {
    setError(null);
    setPending((prev) => new Set(prev).add(pendingKey));
    try {
      const res = await fetch(`${basePath}/api/admin/toolbox`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "更新失敗");
        return;
      }
      // Optimistically update local state.
      setGroups((prev) =>
        prev.map((g) => {
          if (g.type !== body.type) return g;
          if (body.toolKey) {
            return {
              ...g,
              tools: g.tools.map((t) =>
                t.key === body.toolKey ? { ...t, isActive: body.isActive } : t
              ),
            };
          }
          return { ...g, isActive: body.isActive };
        })
      );
    } finally {
      setPending((prev) => {
        const next = new Set(prev);
        next.delete(pendingKey);
        return next;
      });
    }
  }

  function startEdit(editKey: string, currentLabel: string) {
    setError(null);
    setEditing(editKey);
    setDraft(currentLabel);
  }

  function cancelEdit() {
    setEditing(null);
    setDraft("");
  }

  async function saveLabel(
    body: { type: string; toolKey?: string },
    pendingKey: string
  ) {
    const label = draft.trim();
    if (!label) {
      setError("名稱不可為空白");
      return;
    }
    setError(null);
    setPending((prev) => new Set(prev).add(pendingKey));
    try {
      const res = await fetch(`${basePath}/api/admin/toolbox`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, label }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "更新失敗");
        return;
      }
      // Optimistically update local state.
      setGroups((prev) =>
        prev.map((g) => {
          if (g.type !== body.type) return g;
          if (body.toolKey) {
            return {
              ...g,
              tools: g.tools.map((t) =>
                t.key === body.toolKey ? { ...t, label } : t
              ),
            };
          }
          return { ...g, label };
        })
      );
      cancelEdit();
    } finally {
      setPending((prev) => {
        const next = new Set(prev);
        next.delete(pendingKey);
        return next;
      });
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">工具管理</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          控制數學科「AI 解題輔助」的工具是否上線、開放給哪些學校，以及群組與工具的顯示名稱。關閉或未開放的項目會即時從前台隱藏，也無法直接用網址開啟，資料不會被刪除。
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          開關代表整體上線與否，開放範圍再決定哪些學校可用；兩者都通過才會顯示。要整個科目或主題不開放給某校，請到「學校管理」設定。
        </p>
      </div>

      {error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : groups.length === 0 ? (
        <p className="rounded-md border border-dashed py-16 text-center text-sm text-muted-foreground">
          尚無工具群組。請先執行 seed-toolbox 腳本。
        </p>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => {
            const groupPending = pending.has(g.type);
            return (
              <div key={g.id} className="overflow-hidden rounded-lg border bg-background">
                <div className="flex items-center justify-between gap-4 border-b bg-muted/40 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Wrench className="size-4 text-muted-foreground" />
                    <div>
                      <div className="flex items-center gap-2">
                        {editing === g.type ? (
                          <LabelEditor
                            value={draft}
                            onChange={setDraft}
                            onSave={() => saveLabel({ type: g.type }, g.type)}
                            onCancel={cancelEdit}
                            saving={groupPending}
                          />
                        ) : (
                          <>
                            <span className="font-medium">{g.label}</span>
                            <button
                              type="button"
                              onClick={() => startEdit(g.type, g.label)}
                              className="text-muted-foreground transition hover:text-foreground"
                              aria-label="修改群組名稱"
                            >
                              <Pencil className="size-3.5" />
                            </button>
                          </>
                        )}
                        <StatusBadge
                          active={g.isActive}
                          activeLabel="上線"
                          inactiveLabel="隱藏"
                        />
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">{g.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <ScopeButton
                      label={schoolScopeLabel(g)}
                      scoped={g.schoolScope === "selected"}
                      disabled={groupPending}
                      onClick={() =>
                        openScope({
                          type: g.type,
                          title: g.label,
                          current: { schoolScope: g.schoolScope, schools: g.schools },
                        })
                      }
                    />
                    {groupPending && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
                    <Switch
                      checked={g.isActive}
                      disabled={groupPending}
                      onCheckedChange={() => patch({ type: g.type, isActive: !g.isActive }, g.type)}
                    />
                  </div>
                </div>

                <ul className="divide-y">
                  {g.tools.map((t) => {
                    const toolPendingKey = `${g.type}:${t.key}`;
                    const toolPending = pending.has(toolPendingKey);
                    const effectiveOff = !g.isActive || !t.isActive;
                    return (
                      <li
                        key={t.key}
                        className="flex items-center justify-between gap-4 px-4 py-2.5 pl-11"
                      >
                        <div className={effectiveOff ? "opacity-60" : ""}>
                          {editing === toolPendingKey ? (
                            <LabelEditor
                              value={draft}
                              onChange={setDraft}
                              onSave={() =>
                                saveLabel({ type: g.type, toolKey: t.key }, toolPendingKey)
                              }
                              onCancel={cancelEdit}
                              saving={toolPending}
                            />
                          ) : (
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium">{t.label}</p>
                              <button
                                type="button"
                                onClick={() => startEdit(toolPendingKey, t.label)}
                                className="text-muted-foreground transition hover:text-foreground"
                                aria-label="修改工具名稱"
                              >
                                <Pencil className="size-3.5" />
                              </button>
                            </div>
                          )}
                          <p className="text-xs text-muted-foreground">{t.sub}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {!g.isActive && (
                            <span className="text-xs text-muted-foreground">群組已隱藏</span>
                          )}
                          {effectiveScopeNote(g, t) && (
                            <span className="text-xs text-amber-600">{effectiveScopeNote(g, t)}</span>
                          )}
                          {/* Editable even while the group is hidden, so a scope
                              can be prepared before the group goes live. */}
                          <ScopeButton
                            label={schoolScopeLabel(t)}
                            scoped={t.schoolScope === "selected"}
                            disabled={toolPending}
                            onClick={() =>
                              openScope({
                                type: g.type,
                                toolKey: t.key,
                                title: t.label,
                                current: { schoolScope: t.schoolScope, schools: t.schools },
                              })
                            }
                          />
                          {toolPending && (
                            <Loader2 className="size-4 animate-spin text-muted-foreground" />
                          )}
                          <Switch
                            checked={t.isActive}
                            disabled={toolPending || !g.isActive}
                            onCheckedChange={() =>
                              patch(
                                { type: g.type, toolKey: t.key, isActive: !t.isActive },
                                toolPendingKey
                              )
                            }
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={Boolean(scopeTarget)} onOpenChange={(open) => !open && setScopeTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>開放範圍 — {scopeTarget?.title}</DialogTitle>
          </DialogHeader>

          {/* Inside the dialog: the page-level banner sits behind the overlay,
              which made a failed save look like a dead button. */}
          {error && (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              {(["all", "selected"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setScopeDraft((prev) => ({ ...prev, schoolScope: mode }))}
                  className={
                    "flex w-full items-start gap-3 rounded-md border px-3 py-2 text-left text-sm transition-colors " +
                    (scopeDraft.schoolScope === mode
                      ? "border-primary bg-primary/10"
                      : "hover:bg-muted")
                  }
                >
                  <span
                    className={
                      "mt-0.5 size-4 shrink-0 rounded-full border-2 " +
                      (scopeDraft.schoolScope === mode
                        ? "border-primary bg-primary"
                        : "border-muted-foreground")
                    }
                  />
                  <span>
                    <span className="font-medium">
                      {mode === "all" ? "全部學校" : "只開放給指定學校"}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {mode === "all"
                        ? "所有已開通「AI 解題輔助」的學校都可使用。"
                        : "只有勾選的學校可使用，其他學校看不到也無法直接開啟。"}
                    </span>
                  </span>
                </button>
              ))}
            </div>

            {scopeDraft.schoolScope === "selected" && (
              <div className="space-y-2">
                <Label>選擇學校</Label>
                {schools.length === 0 ? (
                  <p className="rounded-md border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
                    尚未建立任何學校。
                  </p>
                ) : (
                  <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border p-2">
                    {schools.map((s) => {
                      const on = scopeDraft.schools.includes(s.id);
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => toggleScopeSchool(s.id)}
                          className={
                            "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors " +
                            (on ? "bg-primary/10 text-primary" : "hover:bg-muted")
                          }
                        >
                          <span
                            className={
                              "flex size-4 shrink-0 items-center justify-center rounded border " +
                              (on ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground")
                            }
                          >
                            {on && <Check className="size-3" />}
                          </span>
                          {s.name}
                        </button>
                      );
                    })}
                  </div>
                )}
                {scopeDraft.schools.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    未勾選任何學校時，所有學校都不會看到此項目。
                  </p>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="flex-row justify-end gap-2">
            <Button variant="outline" disabled={scopeSaving} onClick={() => setScopeTarget(null)}>
              取消
            </Button>
            <Button onClick={saveScope} disabled={scopeSaving}>
              {scopeSaving && <Loader2 className="size-4 animate-spin" />}
              儲存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ScopeButton({
  label,
  scoped,
  disabled,
  onClick,
}: {
  label: string;
  scoped: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title="設定開放範圍"
      className={
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors disabled:opacity-50 " +
        (scoped
          ? "border-primary/40 bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-muted")
      }
    >
      <Building2 className="size-3.5" />
      {label}
    </button>
  );
}

interface LabelEditorProps {
  value: string;
  onChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}

function LabelEditor({ value, onChange, onSave, onCancel, saving }: LabelEditorProps) {
  return (
    <div className="flex items-center gap-1.5">
      <input
        autoFocus
        value={value}
        disabled={saving}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onSave();
          } else if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
          }
        }}
        className="h-8 w-48 rounded-md border bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring"
      />
      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        className="rounded-md p-1 text-emerald-600 transition hover:bg-emerald-50 disabled:opacity-50"
        aria-label="儲存"
      >
        {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
      </button>
      <button
        type="button"
        onClick={onCancel}
        disabled={saving}
        className="rounded-md p-1 text-muted-foreground transition hover:bg-muted disabled:opacity-50"
        aria-label="取消"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
