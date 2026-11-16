"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, Pencil, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RoleBadge, SubjectBadgeList } from "@/components/admin/badges";
import { SUBJECTS } from "@/lib/subjects";
import {
  ANNOUNCEMENT_AUDIENCES,
  ANNOUNCEMENT_IMAGE_ACCEPT,
  ANNOUNCEMENT_IMAGE_TYPES,
  ANNOUNCEMENT_STATUS_LABELS,
  MAX_ANNOUNCEMENT_CONTENT_LENGTH,
  MAX_ANNOUNCEMENT_IMAGES,
  MAX_ANNOUNCEMENT_IMAGE_BYTES,
  MAX_ANNOUNCEMENT_IMAGE_LABEL,
  MAX_ANNOUNCEMENT_TITLE_LENGTH,
  announcementImagePath,
  announcementStatus,
  type AdminAnnouncementDTO,
  type AnnouncementAudience,
  type AnnouncementImageDTO,
  type AnnouncementStatus,
} from "@/lib/announcements";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/upload-limits";
import { basePath, cn } from "@/lib/utils";

const STATUS_STYLES: Record<AnnouncementStatus, string> = {
  live: "border-emerald-300 bg-emerald-100 text-emerald-700",
  scheduled: "border-amber-300 bg-amber-100 text-amber-700",
  expired: "border-border bg-muted text-muted-foreground",
  inactive: "border-border bg-muted text-muted-foreground",
};

/** `<input type="datetime-local">` speaks local wall-clock time without a zone. */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(value: string): string {
  return value ? new Date(value).toISOString() : "";
}

const dateFormat = new Intl.DateTimeFormat("zh-HK", { dateStyle: "medium", timeStyle: "short" });
const formatDate = (iso: string) => dateFormat.format(new Date(iso));

let imageKeySeq = 0;

interface NewImage {
  key: string;
  file: File;
  previewUrl: string;
}

export default function AdminAnnouncementsPage() {
  const [items, setItems] = useState<AdminAnnouncementDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  // dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AdminAnnouncementDTO | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // form
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [audience, setAudience] = useState<AnnouncementAudience[]>(["student", "teacher"]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [allSubjects, setAllSubjects] = useState(true);
  const [active, setActive] = useState(true);
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [keptImages, setKeptImages] = useState<AnnouncementImageDTO[]>([]);
  const [newImages, setNewImages] = useState<NewImage[]>([]);
  const [repush, setRepush] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${basePath}/api/admin/announcements`);
      setItems(res.ok ? await res.json() : []);
      setNow(Date.now());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Preview URLs hold the file in memory until revoked; release them on unmount.
  const newImagesRef = useRef<NewImage[]>([]);
  useEffect(() => {
    newImagesRef.current = newImages;
  }, [newImages]);
  useEffect(() => () => newImagesRef.current.forEach((img) => URL.revokeObjectURL(img.previewUrl)), []);

  // Captured per load so status badges are computed from one clock reading.
  const [now, setNow] = useState(() => Date.now());

  function resetNewImages() {
    newImages.forEach((img) => URL.revokeObjectURL(img.previewUrl));
    setNewImages([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function openCreate() {
    setEditing(null);
    setTitle("");
    setContent("");
    setAudience(["student", "teacher"]);
    setSubjects([]);
    setAllSubjects(true);
    setActive(true);
    setStartAt("");
    setEndAt("");
    setKeptImages([]);
    resetNewImages();
    setRepush(false);
    setError(null);
    setDialogOpen(true);
  }

  function openEdit(a: AdminAnnouncementDTO) {
    setEditing(a);
    setTitle(a.title);
    setContent(a.content);
    setAudience(a.audience);
    setSubjects(a.subjects);
    setAllSubjects(a.subjects.length === 0);
    setActive(a.active);
    setStartAt(toLocalInput(a.startAt));
    setEndAt(toLocalInput(a.endAt));
    setKeptImages(a.images);
    resetNewImages();
    setRepush(false);
    setError(null);
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    resetNewImages();
  }

  function addFiles(files: FileList | null) {
    if (!files) return;
    setError(null);
    const room = MAX_ANNOUNCEMENT_IMAGES - keptImages.length - newImages.length;
    const picked: NewImage[] = [];
    const problems: string[] = [];
    for (const file of Array.from(files)) {
      if (picked.length >= room) {
        problems.push(`最多只能附加 ${MAX_ANNOUNCEMENT_IMAGES} 張圖片`);
        break;
      }
      if (!ANNOUNCEMENT_IMAGE_TYPES.includes(file.type)) {
        problems.push(`「${file.name}」不是支援的圖片格式`);
        continue;
      }
      if (file.size > MAX_ANNOUNCEMENT_IMAGE_BYTES) {
        problems.push(`「${file.name}」超過 ${MAX_ANNOUNCEMENT_IMAGE_LABEL}`);
        continue;
      }
      // Not crypto.randomUUID(): it only exists in secure contexts, and this app
      // can be deployed over plain HTTP (see SESSION_COOKIE_SECURE).
      picked.push({ key: `new-${++imageKeySeq}`, file, previewUrl: URL.createObjectURL(file) });
    }
    setNewImages((prev) => [...prev, ...picked]);
    if (problems.length > 0) setError(problems.join("；"));
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeNewImage(key: string) {
    setNewImages((prev) => {
      const img = prev.find((i) => i.key === key);
      if (img) URL.revokeObjectURL(img.previewUrl);
      return prev.filter((i) => i.key !== key);
    });
  }

  function toggleAudience(value: AnnouncementAudience, checked: boolean) {
    setAudience((prev) => (checked ? [...new Set([...prev, value])] : prev.filter((v) => v !== value)));
  }

  function toggleSubject(value: string, checked: boolean) {
    setSubjects((prev) => (checked ? [...new Set([...prev, value])] : prev.filter((v) => v !== value)));
  }

  async function save() {
    setError(null);
    if (!title.trim()) return setError("請輸入標題");
    if (audience.length === 0) return setError("請至少選擇一個推送對象");
    if (!allSubjects && subjects.length === 0) return setError("請選擇科目，或勾選「全部科目」");
    if (!content.trim() && keptImages.length + newImages.length === 0) {
      return setError("請輸入內容或附加圖片");
    }
    const uploadBytes = newImages.reduce((sum, i) => sum + i.file.size, 0);
    if (uploadBytes > MAX_UPLOAD_BYTES) {
      return setError(`單次上傳的圖片總大小上限為 ${MAX_UPLOAD_LABEL}，請分次儲存`);
    }

    const fd = new FormData();
    fd.set("title", title.trim());
    fd.set("content", content);
    audience.forEach((a) => fd.append("audience", a));
    if (!allSubjects) subjects.forEach((s) => fd.append("subjects", s));
    fd.set("active", String(active));
    fd.set("startAt", fromLocalInput(startAt));
    fd.set("endAt", fromLocalInput(endAt));
    keptImages.forEach((img) => fd.append("keepImages", img.id));
    newImages.forEach((img) => fd.append("images", img.file));
    if (editing && repush) fd.set("repush", "true");

    setSaving(true);
    try {
      const res = await fetch(
        editing ? `${basePath}/api/admin/announcements/${editing.id}` : `${basePath}/api/admin/announcements`,
        { method: editing ? "PUT" : "POST", body: fd },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "儲存失敗");
        return;
      }
      closeDialog();
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function patch(a: AdminAnnouncementDTO, body: { active?: boolean; repush?: true }) {
    setBusyId(a.id);
    try {
      const res = await fetch(`${basePath}/api/admin/announcements/${a.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error ?? "更新失敗");
        return;
      }
      setItems((prev) =>
        prev
          .map((x) => (x.id === a.id ? (data as AdminAnnouncementDTO) : x))
          .sort((x, y) => y.pushedAt.localeCompare(x.pushedAt)),
      );
      setNow(Date.now());
    } finally {
      setBusyId(null);
    }
  }

  function repushNow(a: AdminAnnouncementDTO) {
    if (!confirm(`重新推送「${a.title}」？已讀過的用戶下次開啟網站時會再次看到彈窗。`)) return;
    patch(a, { repush: true });
  }

  async function remove(a: AdminAnnouncementDTO) {
    if (!confirm(`確定刪除「${a.title}」？此操作無法復原。`)) return;
    setBusyId(a.id);
    try {
      const res = await fetch(`${basePath}/api/admin/announcements/${a.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "刪除失敗");
        return;
      }
      setItems((prev) => prev.filter((x) => x.id !== a.id));
    } finally {
      setBusyId(null);
    }
  }

  const imageCount = keptImages.length + newImages.length;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">消息推送</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            發佈公告給學生或老師。對象登入後會先彈出未讀的公告，之後也可以從頁首的「公告」按鈕重看。
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4" /> 新增公告
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-md border border-dashed py-16 text-center text-sm text-muted-foreground">
          還沒有公告。按「新增公告」發佈第一則。
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-background">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="px-4">標題</TableHead>
                <TableHead className="px-4">對象</TableHead>
                <TableHead className="px-4">科目</TableHead>
                <TableHead className="px-4">推送時間</TableHead>
                <TableHead className="px-4">已讀</TableHead>
                <TableHead className="px-4">狀態</TableHead>
                <TableHead className="px-4" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((a) => {
                const status = announcementStatus(a, now);
                const busy = busyId === a.id;
                return (
                  <TableRow key={a.id}>
                    <TableCell className="max-w-[18rem] px-4 py-3">
                      <div className="truncate font-medium">{a.title}</div>
                      <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                        {a.images.length > 0 && `🖼 ${a.images.length} 張圖片　`}
                        {a.content}
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {a.audience.map((r) => (
                          <RoleBadge key={r} role={r} />
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <SubjectBadgeList
                        subjects={a.subjects}
                        empty={<span className="text-sm">全部科目</span>}
                      />
                    </TableCell>
                    <TableCell className="px-4 py-3 text-xs text-muted-foreground">
                      <div>{formatDate(a.pushedAt)}</div>
                      <div className="mt-0.5">
                        {new Date(a.startAt).getTime() > now && `${formatDate(a.startAt)} 起　`}
                        {a.endAt ? `至 ${formatDate(a.endAt)}` : "不設結束"}
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3 tabular-nums">{a.readCount}</TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={a.active}
                          disabled={busy}
                          onCheckedChange={(checked) => patch(a, { active: checked })}
                          aria-label="啟用"
                        />
                        <Badge variant="outline" className={cn("font-medium", STATUS_STYLES[status])}>
                          {ANNOUNCEMENT_STATUS_LABELS[status]}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => repushNow(a)}
                          disabled={busy}
                          aria-label="重新推送"
                          title="重新推送"
                        >
                          <RotateCcw className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => openEdit(a)}
                          disabled={busy}
                          aria-label="編輯"
                          title="編輯"
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => remove(a)}
                          disabled={busy}
                          aria-label="刪除"
                          title="刪除"
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "編輯公告" : "新增公告"}</DialogTitle>
          </DialogHeader>

          <DialogBody className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="ann-title">標題</Label>
              <Input
                id="ann-title"
                value={title}
                maxLength={MAX_ANNOUNCEMENT_TITLE_LENGTH}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例如：新功能上線"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ann-content">內容</Label>
              <Textarea
                id="ann-content"
                value={content}
                maxLength={MAX_ANNOUNCEMENT_CONTENT_LENGTH}
                onChange={(e) => setContent(e.target.value)}
                rows={6}
                placeholder="輸入公告內容。換行會保留，網址會自動變成連結。"
              />
              <p className="text-right text-xs text-muted-foreground">
                {content.length} / {MAX_ANNOUNCEMENT_CONTENT_LENGTH}
              </p>
            </div>

            <div className="space-y-2">
              <Label>圖片（選填）</Label>
              <div className="flex flex-wrap gap-3">
                {keptImages.map((img) => (
                  <Thumb
                    key={img.id}
                    src={`${basePath}${announcementImagePath(img.id)}`}
                    onRemove={() => setKeptImages((prev) => prev.filter((i) => i.id !== img.id))}
                  />
                ))}
                {newImages.map((img) => (
                  <Thumb key={img.key} src={img.previewUrl} onRemove={() => removeNewImage(img.key)} />
                ))}
                {imageCount < MAX_ANNOUNCEMENT_IMAGES && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex size-24 flex-col items-center justify-center gap-1 rounded-md border border-dashed text-xs text-muted-foreground transition-colors hover:bg-muted"
                  >
                    <ImagePlus className="size-5" />
                    加入圖片
                  </button>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept={ANNOUNCEMENT_IMAGE_ACCEPT}
                multiple
                className="hidden"
                onChange={(e) => addFiles(e.target.files)}
              />
              <p className="text-xs text-muted-foreground">
                PNG、JPEG、WebP 或 GIF，每張上限 {MAX_ANNOUNCEMENT_IMAGE_LABEL}，最多 {MAX_ANNOUNCEMENT_IMAGES}{" "}
                張。圖片會顯示在文字下方。
              </p>
            </div>

            <div className="space-y-2">
              <Label>推送對象</Label>
              <div className="flex flex-wrap gap-5">
                {ANNOUNCEMENT_AUDIENCES.map((a) => (
                  <label key={a.value} className="flex cursor-pointer items-center gap-2 text-sm">
                    <Checkbox
                      checked={audience.includes(a.value)}
                      onCheckedChange={(v) => toggleAudience(a.value, v === true)}
                    />
                    {a.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>科目</Label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox checked={allSubjects} onCheckedChange={(v) => setAllSubjects(v === true)} />
                全部科目
              </label>
              {!allSubjects && (
                <div className="flex flex-wrap gap-x-5 gap-y-2 rounded-md border bg-muted/30 px-3 py-2.5">
                  {SUBJECTS.map((s) => (
                    <label key={s.value} className="flex cursor-pointer items-center gap-2 text-sm">
                      <Checkbox
                        checked={subjects.includes(s.value)}
                        onCheckedChange={(v) => toggleSubject(s.value, v === true)}
                      />
                      {s.label}
                    </label>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                選擇個別科目時，只有擁有其中任一科目權限的用戶會收到。
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ann-start">開始時間（選填）</Label>
                <Input
                  id="ann-start"
                  type="datetime-local"
                  value={startAt}
                  onChange={(e) => setStartAt(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">留空即立即發佈。</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ann-end">結束時間（選填）</Label>
                <Input
                  id="ann-end"
                  type="datetime-local"
                  value={endAt}
                  onChange={(e) => setEndAt(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">留空即不會過期。</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch id="ann-active" checked={active} onCheckedChange={(checked) => setActive(checked)} />
              <Label htmlFor="ann-active">啟用</Label>
            </div>

            {editing && (
              <label className="flex cursor-pointer items-start gap-2 rounded-md border bg-muted/30 px-3 py-2.5 text-sm">
                <Checkbox
                  className="mt-0.5"
                  checked={repush}
                  onCheckedChange={(v) => setRepush(v === true)}
                />
                <span>
                  儲存後重新推送
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    已讀過的用戶會再次看到彈窗。只修正錯字時不需要勾選。
                  </span>
                </span>
              </label>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}
          </DialogBody>

          <DialogFooter className="flex-row justify-end gap-2">
            <Button variant="outline" onClick={closeDialog}>
              取消
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              {editing ? "儲存" : "發佈"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Thumb({ src, onRemove }: { src: string; onRemove: () => void }) {
  return (
    <div className="relative size-24 overflow-hidden rounded-md border bg-muted/30">
      <img src={src} alt="" className="size-full object-cover" />
      <button
        type="button"
        onClick={onRemove}
        aria-label="移除圖片"
        className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
      >
        <X className="size-3" />
      </button>
    </div>
  );
}
