"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, ExternalLink, Loader2, Plus, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { SUBJECTS, SUBJECT_LABELS } from "@/lib/subjects";
import { SubjectBadge } from "@/components/admin/badges";
import {
  MATERIAL_AUDIENCES,
  MATERIAL_AUDIENCE_LABELS,
  MATERIAL_KINDS,
  MATERIAL_KIND_LABELS,
  formatFileSize,
  linkHost,
  parseLinkUrl,
  type MaterialDTO,
  type MaterialKindValue,
} from "@/lib/learning-materials";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/upload-limits";
import { basePath } from "@/lib/utils";

export default function AdminMaterialsPage() {
  const [materials, setMaterials] = useState<MaterialDTO[]>([]);
  const [loading, setLoading] = useState(true);

  // filter
  const [filterSubject, setFilterSubject] = useState("english");

  // dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MaterialDTO | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // form
  const [subject, setSubject] = useState("english");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [audience, setAudience] = useState("both");
  const [kind, setKind] = useState<MaterialKindValue>("file");
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");

  const loadMaterials = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterSubject) params.set("subject", filterSubject);
      const res = await fetch(`${basePath}/api/admin/learning-materials?${params.toString()}`);
      setMaterials(res.ok ? await res.json() : []);
    } finally {
      setLoading(false);
    }
  }, [filterSubject]);

  useEffect(() => {
    loadMaterials();
  }, [loadMaterials]);

  function openCreate() {
    setEditing(null);
    setSubject(filterSubject || "english");
    setTitle("");
    setDescription("");
    setAudience("both");
    setKind("file");
    setFile(null);
    setUrl("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    setError(null);
    setDialogOpen(true);
  }

  function openEdit(m: MaterialDTO) {
    setEditing(m);
    setSubject(m.subject);
    setTitle(m.title);
    setDescription(m.description);
    setAudience(m.audience);
    setKind(m.kind);
    setFile(null);
    setUrl(m.url);
    setError(null);
    setDialogOpen(true);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      if (editing) {
        // Metadata-only update: an uploaded file is immutable once stored, but a
        // link's url is metadata and can be corrected here.
        const body: Record<string, string> = { title, description, audience };
        if (editing.kind === "link") {
          const link = parseLinkUrl(url);
          if (!link.ok) {
            setError(link.error);
            return;
          }
          body.url = link.url;
        }
        const res = await fetch(`${basePath}/api/admin/learning-materials/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error ?? "儲存失敗");
          return;
        }
      } else if (!title.trim()) {
        setError("標題不能為空");
        return;
      } else if (kind === "link") {
        const link = parseLinkUrl(url);
        if (!link.ok) {
          setError(link.error);
          return;
        }
        const res = await fetch(`${basePath}/api/admin/learning-materials`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subject, title, description, audience, url: link.url }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error ?? "新增失敗");
          return;
        }
      } else {
        if (!file) {
          setError("請選擇要上傳的檔案");
          return;
        }
        // Checked here as well as server-side: past this point the browser has
        // to upload the whole body before it learns it was rejected.
        if (file.size > MAX_UPLOAD_BYTES) {
          setError(`檔案過大（上限 ${MAX_UPLOAD_LABEL}）`);
          return;
        }
        const fd = new FormData();
        fd.set("file", file);
        fd.set("subject", subject);
        fd.set("title", title);
        fd.set("description", description);
        fd.set("audience", audience);
        const res = await fetch(`${basePath}/api/admin/learning-materials`, {
          method: "POST",
          body: fd,
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error ?? "上傳失敗");
          return;
        }
      }
      setDialogOpen(false);
      await loadMaterials();
    } finally {
      setSaving(false);
    }
  }

  async function remove(m: MaterialDTO) {
    if (!confirm(`確定刪除「${m.title}」？此操作無法復原，並會從所有學校的分組中移除。`)) return;
    const res = await fetch(`${basePath}/api/admin/learning-materials/${m.id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "刪除失敗");
      return;
    }
    await loadMaterials();
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">資源庫</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            上傳各科的資源檔案，或加入指向外部網站的連結。加入後，再到「學校資源」為個別學校分組並指派。
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4" /> 新增資源
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select value={filterSubject} onValueChange={(v) => setFilterSubject(v as string)}>
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

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : materials.length === 0 ? (
        <p className="rounded-md border border-dashed py-16 text-center text-sm text-muted-foreground">
          尚未加入任何資源。
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-background">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="px-4">標題</TableHead>
                <TableHead className="px-4">科目</TableHead>
                <TableHead className="px-4">對象</TableHead>
                <TableHead className="px-4">內容</TableHead>
                <TableHead className="px-4" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {materials.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="px-4 py-3">
                    <div className="font-medium">{m.title}</div>
                    {m.description && (
                      <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                        {m.description}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <SubjectBadge subject={m.subject} />
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    {/* 對象 mirrors the role colours used on 使用者管理. */}
                    <Badge
                      variant="outline"
                      className={
                        m.audience === "teacher"
                          ? "border-violet-300 bg-violet-100 font-medium text-violet-700"
                          : "border-teal-300 bg-teal-100 font-medium text-teal-700"
                      }
                    >
                      {MATERIAL_AUDIENCE_LABELS[m.audience] ?? m.audience}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    {/* One column for both kinds: what matters is where the
                        content is, and each kind says that in its own terms. */}
                    {m.kind === "link" ? (
                      <a
                        href={m.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={m.url}
                        className="inline-flex max-w-[16rem] items-center gap-1.5 text-sm text-primary hover:underline"
                      >
                        <ExternalLink className="size-3.5 shrink-0" />
                        <span className="truncate">{linkHost(m.url)}</span>
                      </a>
                    ) : (
                      <a
                        href={`${basePath}/api/learning-materials/${m.id}/download`}
                        title={m.filename}
                        className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                      >
                        <Download className="size-3.5 shrink-0" />
                        {formatFileSize(m.size)}
                      </a>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => openEdit(m)}>
                        編輯
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => remove(m)}
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
            <DialogTitle>
              {editing
                ? `編輯${MATERIAL_KIND_LABELS[editing.kind] ?? "資源"}`
                : "新增資源"}
            </DialogTitle>
          </DialogHeader>

          <DialogBody className="space-y-4">
            {!editing && (
              <>
                <div className="space-y-2">
                  <Label>科目</Label>
                  <Select value={subject} onValueChange={(v) => setSubject(v as string)}>
                    <SelectTrigger className="w-full">
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

                {/* Only offered at creation: switching an existing resource
                    between the two would mean discarding its file or its url. */}
                <div className="space-y-2">
                  <Label>類型</Label>
                  <Select
                    value={kind}
                    onValueChange={(v) => setKind(v as MaterialKindValue)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue>
                        {(v) => MATERIAL_KIND_LABELS[v as string] ?? "選擇類型"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {MATERIAL_KINDS.map((k) => (
                        <SelectItem key={k.value} value={k.value}>
                          {k.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label>標題</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例如：Unit 1 Vocabulary List"
              />
            </div>

            <div className="space-y-2">
              <Label>說明（選填）</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="簡短描述這份資源的內容或用途"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>開放對象</Label>
              <Select value={audience} onValueChange={(v) => setAudience(v as string)}>
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(v) => MATERIAL_AUDIENCE_LABELS[v as string] ?? "選擇對象"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {MATERIAL_AUDIENCES.map((a) => (
                    <SelectItem key={a.value} value={a.value}>
                      {a.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {kind === "link" && (
                <p className="text-xs text-muted-foreground">
                  只影響學生／老師是否看到這個入口。連結本身仍在外部網站上，取得網址的人都打得開。
                </p>
              )}
            </div>

            {kind === "link" ? (
              <div className="space-y-2">
                <Label>連結網址</Label>
                <Input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://…"
                  inputMode="url"
                />
                <p className="text-xs text-muted-foreground">
                  必須是 https:// 開頭的網址。學生點擊後會在新視窗開啟。
                </p>
              </div>
            ) : editing ? (
              <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                目前檔案：{editing.filename}（{formatFileSize(editing.size)}）
                <span className="mt-0.5 block text-xs">如需更換檔案，請刪除後重新上傳。</span>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>檔案</Label>
                <Input
                  ref={fileInputRef}
                  type="file"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
                {file && (
                  <p className="text-xs text-muted-foreground">
                    已選擇：{file.name}（{formatFileSize(file.size)}）
                  </p>
                )}
                <p className="text-xs text-muted-foreground">單一檔案上限 {MAX_UPLOAD_LABEL}。</p>
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}
          </DialogBody>

          <DialogFooter className="flex-row justify-end gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : editing || kind === "link" ? null : (
                <Upload className="size-4" />
              )}
              {editing ? "儲存" : kind === "link" ? "新增" : "上傳"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
