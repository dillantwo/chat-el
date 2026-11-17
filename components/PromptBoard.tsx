"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  Copy,
  Download,
  Image as ImageIcon,
  ImagePlus,
  Loader2,
  Maximize2,
  MessageSquareText,
  Pencil,
  Plus,
  Trash2,
  Users,
  X,
} from "lucide-react";
import Header from "@/components/Header";
import { useLocale } from "@/components/LocaleProvider";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { canCopyImage, copyImage, copyText } from "@/lib/clipboard";
import { defineCopy, intlLocale, type Locale } from "@/lib/i18n/config";
import {
  MAX_PROMPT_IMAGES,
  MAX_PROMPT_IMAGE_BYTES,
  MAX_PROMPT_IMAGE_LABEL,
  MAX_PROMPT_ITEMS,
  MAX_PROMPT_ITEM_LENGTH,
  MAX_PROMPT_TITLE_LENGTH,
  PROMPT_IMAGE_ACCEPT,
  PROMPT_IMAGE_TYPES,
  promptImagePath,
  type PromptClassDTO,
  type PromptDTO,
  type PromptsResponse,
  type TeacherPromptsResponse,
} from "@/lib/prompts";
import type { SubjectValue } from "@/lib/subjects";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/upload-limits";
import { basePath } from "@/lib/utils";

export interface PromptBoardProps {
  /** Subject key for `/api/prompts?subject=…`. */
  subject: SubjectValue;
  backHref: string;
  backLabel: string;
  heading?: string;
  /**
   * Forces the UI copy language, as in MaterialsBrowser: English Language
   * passes `"en"`. Omitted means the current interface locale.
   */
  lang?: "zh" | Locale;
}

const COPY = defineCopy({
  "zh-Hant": {
    heading: "提示詞",
    loading: "正在載入提示詞…",
    loadError: "無法載入提示詞，請稍後再試。",
    teacherIntro: "按「顯示給學生」後，以下班別的學生就會看到。草稿只有你自己看到。",
    visibleTo: "顯示給班別",
    allClassesNote: "（任教的全部班別）",
    noClassesAssigned: "你還沒有任教班別，學生暫時看不到你的提示詞。請聯絡管理員分配班別。",
    noneChosen: "未選擇任何班別，學生看不到你的提示詞。",
    editClasses: "設定班別",
    add: "新增提示詞",
    emptyTeacher: "還沒有提示詞。按「新增提示詞」寫第一條。",
    emptyStudent: "老師暫時還沒有分享提示詞。",
    emptyAdmin: "這一科暫時沒有已顯示給學生的提示詞。",
    published: "已顯示給學生",
    draft: "草稿",
    updatedOn: (date: string) => `更新於 ${date}`,
    imageCount: (n: number) => `${n} 張圖片`,
    promptCount: (n: number) => `${n} 條提示詞`,
    copyText: "複製文字",
    copyImage: "複製圖片",
    copied: "已複製",
    copyFailed: "複製失敗",
    downloadImage: "下載圖片",
    enlarge: "放大圖片",
    edit: "編輯",
    delete: "刪除",
    confirmDelete: (title: string) => `確定刪除「${title}」？刪除後無法復原。`,
    actionFailed: "操作失敗，請稍後再試。",
    newTitle: "新增提示詞",
    editTitle: "編輯提示詞",
    titleLabel: "標題",
    titlePlaceholder: "例如：寫景作文開頭",
    itemsLabel: (n: number) => `提示詞內容（${n}/${MAX_PROMPT_ITEMS}）`,
    itemsHint: "每一段都有自己的「複製文字」按鈕。空白的段落不會儲存。",
    itemLabel: (n: number) => `第 ${n} 段提示詞`,
    addItem: "新增一段提示詞",
    removeItem: "移除",
    contentPlaceholder: "輸入學生要複製的提示詞……",
    imagesLabel: (n: number) => `圖片（${n}/${MAX_PROMPT_IMAGES}）`,
    addImage: "加入圖片",
    imageHint: `PNG、JPEG、WebP 或 GIF，每張不超過 ${MAX_PROMPT_IMAGE_LABEL}`,
    removeImage: "移除圖片",
    publishLabel: "顯示給學生",
    publishHint: "關閉時會儲存為草稿，只有你看到。",
    save: "儲存",
    saving: "儲存中…",
    cancel: "取消",
    titleRequired: "請輸入標題",
    contentRequired: "請輸入提示詞內容或加入圖片",
    tooMany: `最多只能加入 ${MAX_PROMPT_IMAGES} 張圖片`,
    tooLarge: (name: string) => `「${name}」超過 ${MAX_PROMPT_IMAGE_LABEL}`,
    totalTooLarge: `一次上傳的圖片總大小不能超過 ${MAX_UPLOAD_LABEL}`,
    badType: (name: string) => `「${name}」不是 PNG、JPEG、WebP 或 GIF`,
    classesTitle: "設定班別",
    classesDescription: "選擇哪些班別的學生可以看到你在這一科顯示給學生的全部提示詞。",
    useAllClasses: "改回任教的全部班別",
    close: "關閉",
  },
  en: {
    heading: "Prompts",
    loading: "Loading prompts…",
    loadError: "Could not load the prompts. Please try again later.",
    teacherIntro:
      "Once you turn on “Show to students”, pupils in the classes below can see a prompt. Drafts are only visible to you.",
    visibleTo: "Shown to",
    allClassesNote: "(all the classes you teach)",
    noClassesAssigned:
      "You have no classes yet, so pupils cannot see your prompts. Ask the administrator to assign your classes.",
    noneChosen: "No class is selected, so pupils cannot see your prompts.",
    editClasses: "Choose classes",
    add: "New prompt",
    emptyTeacher: "No prompts yet. Click “New prompt” to write the first one.",
    emptyStudent: "Your teacher has not shared any prompts yet.",
    emptyAdmin: "No prompts in this subject are shown to pupils yet.",
    published: "Shown to students",
    draft: "Draft",
    updatedOn: (date: string) => `Updated ${date}`,
    imageCount: (n: number) => `${n} ${n === 1 ? "picture" : "pictures"}`,
    promptCount: (n: number) => `${n} ${n === 1 ? "prompt" : "prompts"}`,
    copyText: "Copy text",
    copyImage: "Copy image",
    copied: "Copied",
    copyFailed: "Copy failed",
    downloadImage: "Download image",
    enlarge: "Enlarge picture",
    edit: "Edit",
    delete: "Delete",
    confirmDelete: (title: string) => `Delete “${title}”? This cannot be undone.`,
    actionFailed: "Something went wrong. Please try again later.",
    newTitle: "New prompt",
    editTitle: "Edit prompt",
    titleLabel: "Title",
    titlePlaceholder: "e.g. Opening a descriptive essay",
    itemsLabel: (n: number) => `Prompt text (${n}/${MAX_PROMPT_ITEMS})`,
    itemsHint: "Each box gets its own “Copy text” button. Empty boxes are not saved.",
    itemLabel: (n: number) => `Prompt text ${n}`,
    addItem: "Add another prompt",
    removeItem: "Remove",
    contentPlaceholder: "Type the prompt pupils will copy…",
    imagesLabel: (n: number) => `Pictures (${n}/${MAX_PROMPT_IMAGES})`,
    addImage: "Add pictures",
    imageHint: `PNG, JPEG, WebP or GIF, up to ${MAX_PROMPT_IMAGE_LABEL} each`,
    removeImage: "Remove picture",
    publishLabel: "Show to students",
    publishHint: "When off, the prompt is saved as a draft only you can see.",
    save: "Save",
    saving: "Saving…",
    cancel: "Cancel",
    titleRequired: "Please enter a title",
    contentRequired: "Please enter a prompt or add a picture",
    tooMany: `You can add up to ${MAX_PROMPT_IMAGES} pictures`,
    tooLarge: (name: string) => `“${name}” is larger than ${MAX_PROMPT_IMAGE_LABEL}`,
    totalTooLarge: `Pictures uploaded at once cannot exceed ${MAX_UPLOAD_LABEL} in total`,
    badType: (name: string) => `“${name}” is not a PNG, JPEG, WebP or GIF`,
    classesTitle: "Choose classes",
    classesDescription:
      "Choose which classes can see every prompt you show to students in this subject.",
    useAllClasses: "Use all the classes I teach",
    close: "Close",
  },
});

type Copy = (typeof COPY)[Locale];

function imageUrl(imageId: string): string {
  return `${basePath}${promptImagePath(imageId)}`;
}

/** The server's `{ error }` message when there is one, else the fallback. */
async function errorMessage(res: Response, fallback: string): Promise<string> {
  const data = await res.json().catch(() => null);
  return typeof data?.error === "string" && data.error ? data.error : fallback;
}

/**
 * 提示詞: prompts a teacher writes for one subject, for the pupils in their
 * classes to copy.
 *
 * A teacher sees their own prompts (drafts included), the class setting that
 * applies to all of them, and the editor. A pupil sees the published prompts
 * of the teachers they share a class with, grouped by teacher. Admins get the
 * pupil view across every school. Who sees what is decided on the server
 * (lib/teacher-prompts.ts); this component only renders the answer.
 *
 * Styling follows MaterialsBrowser so the two 資源 pages look like siblings.
 */
export default function PromptBoard({
  subject,
  backHref,
  backLabel,
  heading: headingProp,
  lang,
}: PromptBoardProps) {
  const { locale } = useLocale();
  const uiLocale: Locale = lang === undefined ? locale : lang === "en" ? "en" : "zh-Hant";
  const copy = COPY[uiLocale];
  const dateLocale = intlLocale(uiLocale);
  const heading = headingProp ?? copy.heading;

  const [data, setData] = useState<PromptsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  /** `undefined` = closed, `null` = new prompt. */
  const [editing, setEditing] = useState<PromptDTO | null | undefined>(undefined);
  const [classesOpen, setClassesOpen] = useState(false);
  const [zoomed, setZoomed] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`${basePath}/api/prompts?subject=${subject}`);
      if (!res.ok) {
        setLoadError(await errorMessage(res, copy.loadError));
        return;
      }
      setData((await res.json()) as PromptsResponse);
    } catch {
      setLoadError(copy.loadError);
    } finally {
      setLoading(false);
    }
  }, [subject, copy.loadError]);

  useEffect(() => {
    void load();
  }, [load]);

  const teacher = data?.role === "teacher" ? data : null;

  const updateTeacher = (fn: (d: TeacherPromptsResponse) => TeacherPromptsResponse) =>
    setData((prev) => (prev?.role === "teacher" ? fn(prev) : prev));

  const onSaved = (saved: PromptDTO, isNew: boolean) => {
    updateTeacher((d) => ({
      ...d,
      prompts: isNew ? [saved, ...d.prompts] : d.prompts.map((p) => (p.id === saved.id ? saved : p)),
    }));
    setEditing(undefined);
  };

  const togglePublished = async (prompt: PromptDTO) => {
    setBusyId(prompt.id);
    try {
      const res = await fetch(`${basePath}/api/prompts/${prompt.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: !prompt.published }),
      });
      if (!res.ok) {
        window.alert(await errorMessage(res, copy.actionFailed));
        return;
      }
      const saved = (await res.json()) as PromptDTO;
      updateTeacher((d) => ({ ...d, prompts: d.prompts.map((p) => (p.id === saved.id ? saved : p)) }));
    } catch {
      window.alert(copy.actionFailed);
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (prompt: PromptDTO) => {
    if (!window.confirm(copy.confirmDelete(prompt.title))) return;
    setBusyId(prompt.id);
    try {
      const res = await fetch(`${basePath}/api/prompts/${prompt.id}`, { method: "DELETE" });
      if (!res.ok) {
        window.alert(await errorMessage(res, copy.actionFailed));
        return;
      }
      updateTeacher((d) => ({ ...d, prompts: d.prompts.filter((p) => p.id !== prompt.id) }));
    } catch {
      window.alert(copy.actionFailed);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <Header backHref={backHref} backLabel={backLabel} />

      <main className="relative flex flex-1 items-start overflow-x-hidden overflow-y-auto bg-[#f3f7fc] text-[#1b2942]">
        <div className="relative mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-6 sm:px-6 sm:py-8">
          <section className="relative overflow-hidden rounded-[10px] border-2 border-[#22304a] bg-[#3576cf] px-5 py-6 text-white shadow-[8px_8px_0_#22304a] sm:px-7">
            <MessageSquareText
              aria-hidden="true"
              className="pointer-events-none absolute -right-3 -bottom-7 size-32 text-white/20"
              strokeWidth={1.5}
            />
            <h1 className="relative max-w-xl text-[28px] leading-[1.1] font-bold tracking-[-0.03em] sm:text-[38px]">
              {heading}
            </h1>
          </section>

          {loading ? (
            <div className="mt-6 flex items-center justify-center gap-3 rounded-[10px] border-2 border-dashed border-[#c2d4ec] bg-white/80 py-24 text-[15px] text-[#546681]">
              <Loader2 className="size-5 animate-spin text-[#3576cf]" />
              {copy.loading}
            </div>
          ) : loadError || !data ? (
            <p className="mt-6 rounded-[10px] border-2 border-[#e5b9b9] bg-[#fdf4f4] px-5 py-4 text-[15px] text-[#b42318]">
              {loadError ?? copy.loadError}
            </p>
          ) : data.role === "teacher" ? (
            <div className="mt-6 space-y-5 pb-10">
              <ClassBar copy={copy} data={data} onEdit={() => setClassesOpen(true)} />

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-[6px] border-2 border-[#22304a] bg-[#3576cf] px-4 text-[15px] font-semibold text-white shadow-[3px_3px_0_#22304a] transition hover:bg-[#2c66b6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3576cf]"
                >
                  <Plus className="size-4" />
                  {copy.add}
                </button>
              </div>

              {data.prompts.length === 0 ? (
                <EmptyState text={copy.emptyTeacher} />
              ) : (
                data.prompts.map((p) => (
                  <PromptCard
                    key={p.id}
                    prompt={p}
                    copy={copy}
                    dateLocale={dateLocale}
                    onZoom={setZoomed}
                    author={{
                      busy: busyId === p.id,
                      onEdit: () => setEditing(p),
                      onToggle: () => void togglePublished(p),
                      onDelete: () => void remove(p),
                    }}
                  />
                ))
              )}
            </div>
          ) : data.groups.length === 0 ? (
            <EmptyState text={data.role === "admin" ? copy.emptyAdmin : copy.emptyStudent} />
          ) : (
            <div className="mt-6 space-y-8 pb-10">
              {data.groups.map((g) => (
                <section key={g.teacherId} className="space-y-4">
                  <div className="flex items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="flex size-9 shrink-0 items-center justify-center rounded-full border-2 border-[#22304a] bg-[#fbcfe8] text-[15px] font-bold text-[#22304a]"
                    >
                      {g.teacherName.trim().charAt(0)}
                    </span>
                    <h2 className="min-w-0 text-[18px] font-bold tracking-[-0.02em] text-[#1b2942] sm:text-[20px]">
                      {g.teacherName}
                      {g.schoolName && (
                        <span className="ml-2 text-[14px] font-medium text-[#546681]">{g.schoolName}</span>
                      )}
                    </h2>
                    <span className="h-px flex-1 bg-[#d5e0ee]" aria-hidden="true" />
                    <span className="shrink-0 text-[13px] font-medium text-[#7b89a1]">
                      {copy.promptCount(g.prompts.length)}
                    </span>
                  </div>
                  {g.prompts.map((p) => (
                    <PromptCard
                      key={p.id}
                      prompt={p}
                      copy={copy}
                      dateLocale={dateLocale}
                      onZoom={setZoomed}
                    />
                  ))}
                </section>
              ))}
            </div>
          )}
        </div>
      </main>

      {editing !== undefined && (
        <PromptEditor
          key={editing?.id ?? "new"}
          subject={subject}
          prompt={editing}
          copy={copy}
          onClose={() => setEditing(undefined)}
          onSaved={onSaved}
        />
      )}

      {teacher && classesOpen && (
        <ClassDialog
          subject={subject}
          data={teacher}
          copy={copy}
          onClose={() => setClassesOpen(false)}
          onSaved={(visibleClassIds, classesCustomized) => {
            updateTeacher((d) => ({ ...d, visibleClassIds, classesCustomized }));
            setClassesOpen(false);
          }}
        />
      )}

      <Dialog open={zoomed !== null} onOpenChange={(open) => !open && setZoomed(null)}>
        <DialogContent
          showCloseButton={false}
          className="max-w-[min(64rem,calc(100%-2rem))] p-3 sm:max-w-[min(64rem,calc(100%-2rem))]"
        >
          <DialogTitle className="sr-only">{copy.enlarge}</DialogTitle>
          {/* The stock close button is a small ghost icon that disappears
              against a screenshot, so this one sits outside the picture's
              corner as a solid dark disc. */}
          <DialogClose
            aria-label={copy.close}
            title={copy.close}
            className="absolute -top-3 -right-3 z-10 flex size-11 items-center justify-center rounded-full border-2 border-white bg-[#22304a] text-white shadow-[0_4px_12px_rgba(0,0,0,0.35)] transition hover:scale-105 hover:bg-[#b42318] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3576cf]"
          >
            <X className="size-5" strokeWidth={2.5} />
          </DialogClose>
          {zoomed && (
            // eslint-disable-next-line @next/next/no-img-element -- permission-checked API route, not a static asset
            <img
              src={imageUrl(zoomed)}
              alt=""
              className="mx-auto max-h-[calc(100dvh-6rem)] w-auto max-w-full rounded-[6px] object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="mt-6 rounded-[10px] border-2 border-dashed border-[#c2d4ec] bg-white/80 py-20 text-center">
      <MessageSquareText className="mx-auto size-10 text-[#adc4e3]" strokeWidth={1.5} />
      <p className="mt-4 px-4 text-[15px] text-[#546681]">{text}</p>
    </div>
  );
}

/** "顯示給班別：6A、6B" plus the button that opens the class picker. */
function ClassBar({
  copy,
  data,
  onEdit,
}: {
  copy: Copy;
  data: TeacherPromptsResponse;
  onEdit: () => void;
}) {
  const visible = data.classes.filter((c) => data.visibleClassIds.includes(c.id));

  let status: React.ReactNode;
  if (data.classes.length === 0) {
    status = <span className="text-[#b42318]">{copy.noClassesAssigned}</span>;
  } else if (visible.length === 0) {
    status = <span className="text-[#b42318]">{copy.noneChosen}</span>;
  } else {
    status = (
      <span className="flex flex-wrap items-center gap-1.5">
        {visible.map((c) => (
          <span
            key={c.id}
            className="rounded-[3px] border border-[#c9dbf3] bg-[#eef4fc] px-1.5 py-0.5 text-[13px] font-semibold text-[#255fac]"
          >
            {c.name}
          </span>
        ))}
        {!data.classesCustomized && (
          <span className="text-[13px] text-[#7b89a1]">{copy.allClassesNote}</span>
        )}
      </span>
    );
  }

  return (
    <div className="rounded-[12px] border-2 border-[#22304a] bg-white px-4 py-3 shadow-[5px_5px_0_#d9e5f5] sm:px-5">
      <div className="flex flex-wrap items-center gap-3">
        <Users className="size-5 shrink-0 text-[#3576cf]" aria-hidden="true" />
        <span className="shrink-0 text-[15px] font-semibold">{copy.visibleTo}</span>
        <div className="min-w-0 flex-1 text-[14px]">{status}</div>
        {data.classes.length > 0 && (
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex min-h-[38px] shrink-0 items-center gap-1.5 rounded-[6px] border-2 border-[#22304a] bg-white px-3 text-[14px] font-semibold text-[#255fac] transition-colors hover:bg-[#3576cf] hover:text-white"
          >
            {copy.editClasses}
          </button>
        )}
      </div>
      <p className="mt-2 text-[13px] leading-5 text-[#546681]">{copy.teacherIntro}</p>
    </div>
  );
}

/**
 * A button that runs a copy action and briefly says whether it worked.
 *
 * - "primary": solid blue, for the prompt text — the one thing a pupil came
 *   to the page to do.
 * - "bar": flat, fills its slot in an image's action strip.
 */
function CopyButton({
  label,
  copy,
  onCopy,
  variant = "primary",
}: {
  label: string;
  copy: Copy;
  onCopy: () => Promise<void>;
  variant?: "primary" | "bar";
}) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<number | null>(null);

  useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
  }, []);

  const run = async () => {
    try {
      await onCopy();
      setState("copied");
    } catch {
      setState("failed");
    }
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState("idle"), 2000);
  };

  const text = state === "copied" ? copy.copied : state === "failed" ? copy.copyFailed : label;

  const tone =
    variant === "primary"
      ? state === "copied"
        ? "bg-[#15803d] text-white"
        : state === "failed"
          ? "bg-[#b42318] text-white"
          : "bg-[#3576cf] text-white hover:bg-[#2c66b6]"
      : state === "copied"
        ? "text-[#15803d]"
        : state === "failed"
          ? "text-[#b42318]"
          : "text-[#255fac] hover:bg-[#eef4fc]";

  return (
    <button
      type="button"
      onClick={() => void run()}
      aria-live="polite"
      className={[
        "inline-flex items-center justify-center gap-1.5 font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3576cf]",
        variant === "primary"
          ? "min-h-[36px] rounded-[6px] px-3 text-[14px] shadow-[2px_2px_0_#22304a]"
          : "min-h-[40px] flex-1 px-2 text-[13px]",
        tone,
      ].join(" ")}
    >
      {state === "copied" ? <Check className="size-4" /> : <Copy className="size-4" />}
      {text}
    </button>
  );
}

interface AuthorActions {
  busy: boolean;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}

function PromptCard({
  prompt,
  copy,
  dateLocale,
  onZoom,
  author,
}: {
  prompt: PromptDTO;
  copy: Copy;
  /** BCP 47 tag for the 更新於 date. */
  dateLocale: string;
  onZoom: (imageId: string) => void;
  /** Present on the author's own cards only. */
  author?: AuthorActions;
}) {
  const updated = new Date(prompt.updatedAt).toLocaleDateString(dateLocale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <article className="overflow-hidden rounded-[12px] border-2 border-[#22304a] bg-white shadow-[5px_5px_0_#d9e5f5]">
      <header className="flex items-start gap-3 px-4 pt-4 pb-3 sm:px-5">
        <span
          aria-hidden="true"
          className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-[8px] bg-[#fce7f3] text-[#be185d]"
        >
          <MessageSquareText className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[17px] leading-snug font-bold tracking-[-0.01em] break-words text-[#1b2942] sm:text-[19px]">
            {prompt.title}
          </h3>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12.5px] text-[#7b89a1]">
            <span>{copy.updatedOn(updated)}</span>
            {prompt.images.length > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1">
                  <ImageIcon className="size-3.5" />
                  {copy.imageCount(prompt.images.length)}
                </span>
              </>
            )}
          </p>
        </div>
        {author && (
          <span
            className={[
              "mt-1 shrink-0 rounded-full px-2.5 py-0.5 text-[12px] font-semibold",
              prompt.published ? "bg-[#e9f7ee] text-[#15803d]" : "bg-[#f1f3f7] text-[#64738d]",
            ].join(" ")}
          >
            {prompt.published ? copy.published : copy.draft}
          </span>
        )}
      </header>

      <div className="space-y-4 px-4 pb-5 sm:px-5">
        {/* One box per text, each with its copy button right after the text,
            so it is obvious which one a button copies. */}
        {prompt.items.length > 0 && (
          <ol className="space-y-3">
            {prompt.items.map((text, i) => (
              <li
                key={i}
                className="flex gap-3 rounded-[8px] border border-[#dbe5f2] bg-[#f6f9fd] px-3.5 pt-3 pb-3"
              >
                {prompt.items.length > 1 && (
                  <span
                    aria-hidden="true"
                    className="mt-1 flex size-6 shrink-0 items-center justify-center rounded-full bg-[#fce7f3] text-[12px] font-bold text-[#be185d]"
                  >
                    {i + 1}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-[15.5px] leading-7 break-words whitespace-pre-wrap text-[#1b2942]">
                    {text}
                  </p>
                  <div className="mt-2 flex justify-end">
                    <CopyButton label={copy.copyText} copy={copy} onCopy={() => copyText(text)} />
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}

        {prompt.images.length > 0 && (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {prompt.images.map((img) => (
              <li key={img.id}>
                <ImageTile imageId={img.id} copy={copy} onZoom={onZoom} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {author && (
        <footer className="flex flex-wrap items-center gap-2 border-t border-[#e3eaf4] bg-[#fafcfe] px-4 py-2.5 sm:px-5">
          <label className="inline-flex cursor-pointer items-center gap-2.5 py-1 text-[14px] font-medium text-[#3c4a63]">
            <Switch
              checked={prompt.published}
              disabled={author.busy}
              onCheckedChange={() => author.onToggle()}
              className="data-checked:bg-[#15803d]"
            />
            {copy.publishLabel}
          </label>
          <span className="flex-1" />
          <button
            type="button"
            onClick={author.onEdit}
            disabled={author.busy}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-[6px] px-2.5 text-[14px] font-semibold text-[#3c4a63] transition-colors hover:bg-[#eef2f8] disabled:opacity-50"
          >
            <Pencil className="size-4" />
            {copy.edit}
          </button>
          <button
            type="button"
            onClick={author.onDelete}
            disabled={author.busy}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-[6px] px-2.5 text-[14px] font-semibold text-[#b42318] transition-colors hover:bg-[#fdf0f0] disabled:opacity-50"
          >
            <Trash2 className="size-4" />
            {copy.delete}
          </button>
        </footer>
      )}
    </article>
  );
}

/** One picture: tap to enlarge, copy as an image, or download. */
function ImageTile({
  imageId,
  copy,
  onZoom,
}: {
  imageId: string;
  copy: Copy;
  onZoom: (imageId: string) => void;
}) {
  const url = imageUrl(imageId);
  // Read after mount: `isSecureContext` and `ClipboardItem` do not exist on the
  // server, and guessing during SSR would mismatch on hydration.
  const [copyable, setCopyable] = useState(true);
  useEffect(() => setCopyable(canCopyImage()), []);

  return (
    <figure className="overflow-hidden rounded-[8px] border border-[#dbe5f2] bg-white transition-shadow hover:shadow-[3px_3px_0_#d9e5f5]">
      {/* Cropped to a tidy 4:3 thumbnail; tapping opens the whole picture. */}
      <button
        type="button"
        onClick={() => onZoom(imageId)}
        className="group relative block aspect-[4/3] w-full overflow-hidden bg-[#eef3f9] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#3576cf]"
        aria-label={copy.enlarge}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- permission-checked API route */}
        <img
          src={url}
          alt=""
          loading="lazy"
          className="size-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.03]"
        />
        <span className="absolute right-2 bottom-2 flex size-8 items-center justify-center rounded-full bg-white/90 text-[#22304a] opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          <Maximize2 className="size-4" />
        </span>
      </button>
      <figcaption className="flex divide-x divide-[#e3eaf4] border-t border-[#e3eaf4]">
        {copyable && (
          <CopyButton
            label={copy.copyImage}
            copy={copy}
            variant="bar"
            onCopy={() => copyImage(url)}
          />
        )}
        <a
          href={url}
          download
          title={copy.downloadImage}
          className={[
            "inline-flex min-h-[40px] items-center justify-center gap-1.5 text-[13px] font-semibold text-[#3c4a63] transition-colors hover:bg-[#eef4fc]",
            copyable ? "w-11 shrink-0" : "flex-1",
          ].join(" ")}
        >
          <Download className="size-4" />
          {/* Without copy, download is the only action, so it gets its words. */}
          <span className={copyable ? "sr-only" : undefined}>{copy.downloadImage}</span>
        </a>
      </figcaption>
    </figure>
  );
}

/** One text box in the editor. */
interface EditorItem {
  key: string;
  text: string;
}

function newKey(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

type EditorImage =
  | { kind: "existing"; id: string }
  | { kind: "new"; key: string; file: File; preview: string };

/** Create / edit dialog. Mounted fresh for each prompt so its state resets. */
function PromptEditor({
  subject,
  prompt,
  copy,
  onClose,
  onSaved,
}: {
  subject: SubjectValue;
  /** null = new prompt. */
  prompt: PromptDTO | null;
  copy: Copy;
  onClose: () => void;
  onSaved: (saved: PromptDTO, isNew: boolean) => void;
}) {
  const [title, setTitle] = useState(prompt?.title ?? "");
  // Keyed so React keeps each textarea's caret when one above is removed.
  const [items, setItems] = useState<EditorItem[]>(() =>
    (prompt?.items.length ? prompt.items : [""]).map((text) => ({ key: newKey(), text })),
  );
  const [published, setPublished] = useState(prompt?.published ?? false);
  const [images, setImages] = useState<EditorImage[]>(
    () => prompt?.images.map((img) => ({ kind: "existing" as const, id: img.id })) ?? [],
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // Object URLs of picked files are released when the dialog goes away.
  const imagesRef = useRef(images);
  useEffect(() => {
    imagesRef.current = images;
  }, [images]);
  useEffect(
    () => () => {
      for (const img of imagesRef.current) if (img.kind === "new") URL.revokeObjectURL(img.preview);
    },
    [],
  );

  const addFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);

    const picked = Array.from(files);
    if (images.length + picked.length > MAX_PROMPT_IMAGES) {
      setError(copy.tooMany);
      return;
    }
    for (const file of picked) {
      if (!PROMPT_IMAGE_TYPES.includes(file.type)) {
        setError(copy.badType(file.name));
        return;
      }
      if (file.size > MAX_PROMPT_IMAGE_BYTES) {
        setError(copy.tooLarge(file.name));
        return;
      }
    }
    const newTotal = [...images, ...picked.map((file) => ({ kind: "new" as const, file }))].reduce(
      (sum, img) => sum + (img.kind === "new" ? img.file.size : 0),
      0,
    );
    if (newTotal > MAX_UPLOAD_BYTES) {
      setError(copy.totalTooLarge);
      return;
    }

    setImages((prev) => [
      ...prev,
      ...picked.map((file) => ({
        kind: "new" as const,
        key: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
        file,
        preview: URL.createObjectURL(file),
      })),
    ]);
  };

  const updateItem = (key: string, text: string) =>
    setItems((prev) => prev.map((item) => (item.key === key ? { ...item, text } : item)));

  const addItem = () =>
    setItems((prev) =>
      prev.length >= MAX_PROMPT_ITEMS ? prev : [...prev, { key: newKey(), text: "" }],
    );

  const removeItem = (key: string) =>
    setItems((prev) => (prev.length <= 1 ? prev : prev.filter((item) => item.key !== key)));

  const removeImage = (target: EditorImage) => {
    if (target.kind === "new") URL.revokeObjectURL(target.preview);
    setImages((prev) => prev.filter((img) => img !== target));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError(copy.titleRequired);
      return;
    }
    const texts = items.map((item) => item.text).filter((text) => text.trim().length > 0);
    if (texts.length === 0 && images.length === 0) {
      setError(copy.contentRequired);
      return;
    }

    const form = new FormData();
    form.set("title", title.trim());
    for (const text of texts) form.append("items", text);
    form.set("published", String(published));
    for (const img of images) {
      if (img.kind === "existing") form.append("keepImages", img.id);
      else form.append("images", img.file, img.file.name);
    }

    setSaving(true);
    try {
      const res = await fetch(
        prompt
          ? `${basePath}/api/prompts/${prompt.id}`
          : `${basePath}/api/prompts?subject=${subject}`,
        { method: prompt ? "PUT" : "POST", body: form },
      );
      if (!res.ok) {
        setError(await errorMessage(res, copy.actionFailed));
        return;
      }
      onSaved((await res.json()) as PromptDTO, !prompt);
    } catch {
      setError(copy.actionFailed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col gap-4">
          <DialogHeader>
            <DialogTitle className="text-[18px] font-bold">
              {prompt ? copy.editTitle : copy.newTitle}
            </DialogTitle>
          </DialogHeader>

          <DialogBody className="space-y-4">
            <label className="block space-y-1.5">
              <span className="text-[14px] font-semibold text-[#1b2942]">{copy.titleLabel}</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={MAX_PROMPT_TITLE_LENGTH}
                placeholder={copy.titlePlaceholder}
                className="h-10 w-full rounded-[6px] border-2 border-[#d5e0ee] bg-white px-3 text-[15px] outline-none focus:border-[#3576cf]"
                autoFocus
              />
            </label>

            <div className="space-y-2">
              <span className="block text-[14px] font-semibold text-[#1b2942]">
                {copy.itemsLabel(items.length)}
              </span>
              <p className="text-[12px] text-[#7b89a1]">{copy.itemsHint}</p>
              <ol className="space-y-3">
                {items.map((item, i) => (
                  <li key={item.key} className="rounded-[8px] border-2 border-[#dfe7f2] bg-[#f8fafd] p-2.5">
                    <div className="mb-1.5 flex items-center gap-2">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#fce7f3] text-[12px] font-bold text-[#be185d]">
                        {i + 1}
                      </span>
                      <span className="flex-1 text-[12px] text-[#7b89a1]">
                        {item.text.length}/{MAX_PROMPT_ITEM_LENGTH}
                      </span>
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeItem(item.key)}
                          className="inline-flex min-h-[30px] items-center gap-1 rounded-[6px] px-2 text-[13px] font-semibold text-[#b42318] hover:bg-[#fdf0f0]"
                        >
                          <Trash2 className="size-3.5" />
                          {copy.removeItem}
                        </button>
                      )}
                    </div>
                    <textarea
                      value={item.text}
                      onChange={(e) => updateItem(item.key, e.target.value)}
                      maxLength={MAX_PROMPT_ITEM_LENGTH}
                      rows={4}
                      placeholder={copy.contentPlaceholder}
                      aria-label={copy.itemLabel(i + 1)}
                      className="w-full resize-y rounded-[6px] border-2 border-[#d5e0ee] bg-white px-3 py-2 text-[15px] leading-7 outline-none focus:border-[#3576cf]"
                    />
                  </li>
                ))}
              </ol>
              <button
                type="button"
                onClick={addItem}
                disabled={items.length >= MAX_PROMPT_ITEMS}
                className="flex min-h-[42px] w-full items-center justify-center gap-1.5 rounded-[8px] border-2 border-dashed border-[#b8cbe6] bg-white text-[14px] font-semibold text-[#255fac] transition-colors hover:border-[#3576cf] hover:bg-[#eef4fc] disabled:opacity-50"
              >
                <Plus className="size-4" />
                {copy.addItem}
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[14px] font-semibold text-[#1b2942]">
                  {copy.imagesLabel(images.length)}
                </span>
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  disabled={images.length >= MAX_PROMPT_IMAGES}
                  className="inline-flex min-h-[36px] items-center gap-1.5 rounded-[6px] border-2 border-[#22304a] bg-white px-3 text-[14px] font-semibold text-[#255fac] transition-colors hover:bg-[#3576cf] hover:text-white disabled:opacity-50"
                >
                  <ImagePlus className="size-4" />
                  {copy.addImage}
                </button>
                <input
                  ref={fileInput}
                  type="file"
                  accept={PROMPT_IMAGE_ACCEPT}
                  multiple
                  hidden
                  onChange={(e) => {
                    addFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
              </div>
              <p className="text-[12px] text-[#7b89a1]">{copy.imageHint}</p>
              {images.length > 0 && (
                <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {images.map((img) => (
                    <li
                      key={img.kind === "existing" ? img.id : img.key}
                      className="relative aspect-square overflow-hidden rounded-[6px] border-2 border-[#dfe7f2] bg-[#f3f7fc]"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- blob preview or permission-checked route */}
                      <img
                        src={img.kind === "existing" ? imageUrl(img.id) : img.preview}
                        alt=""
                        className="size-full object-contain"
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(img)}
                        className="absolute top-1 right-1 flex size-7 items-center justify-center rounded-full border-2 border-[#22304a] bg-white text-[#22304a] hover:bg-[#b42318] hover:text-white"
                        aria-label={copy.removeImage}
                      >
                        <X className="size-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-[8px] border-2 border-[#dfe7f2] bg-[#f8fafd] px-3.5 py-3">
              <input
                type="checkbox"
                checked={published}
                onChange={(e) => setPublished(e.target.checked)}
                className="mt-1 size-4 accent-[#3576cf]"
              />
              <span>
                <span className="block text-[15px] font-semibold text-[#1b2942]">{copy.publishLabel}</span>
                <span className="block text-[13px] text-[#546681]">{copy.publishHint}</span>
              </span>
            </label>

            {error && (
              <p className="rounded-[6px] border-2 border-[#e5b9b9] bg-[#fdf4f4] px-3 py-2 text-[14px] text-[#b42318]">
                {error}
              </p>
            )}
          </DialogBody>

          <DialogFooter className="flex-row justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="inline-flex min-h-[40px] items-center rounded-[6px] border-2 border-[#d5e0ee] bg-white px-4 text-[14px] font-semibold text-[#3c4a63] hover:border-[#22304a] disabled:opacity-50"
            >
              {copy.cancel}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-[6px] border-2 border-[#22304a] bg-[#3576cf] px-4 text-[14px] font-semibold text-white shadow-[3px_3px_0_#22304a] hover:bg-[#2c66b6] disabled:opacity-60"
            >
              {saving && <Loader2 className="size-4 animate-spin" />}
              {saving ? copy.saving : copy.save}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Picks which of the teacher's classes see all their prompts in the subject. */
function ClassDialog({
  subject,
  data,
  copy,
  onClose,
  onSaved,
}: {
  subject: SubjectValue;
  data: TeacherPromptsResponse;
  copy: Copy;
  onClose: () => void;
  onSaved: (visibleClassIds: string[], classesCustomized: boolean) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(data.visibleClassIds));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only spell out the year when the list spans more than one.
  const showYear = new Set(data.classes.map((c) => c.academicYear)).size > 1;
  const classLabel = (c: PromptClassDTO) => (showYear ? `${c.name}（${c.academicYear}）` : c.name);

  const save = async (classIds: string[] | null) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${basePath}/api/prompts/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, classIds }),
      });
      if (!res.ok) {
        setError(await errorMessage(res, copy.actionFailed));
        return;
      }
      const body = (await res.json()) as { visibleClassIds: string[]; classesCustomized: boolean };
      onSaved(body.visibleClassIds, body.classesCustomized);
    } catch {
      setError(copy.actionFailed);
    } finally {
      setSaving(false);
    }
  };

  const toggle = (id: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-[18px] font-bold">{copy.classesTitle}</DialogTitle>
          <DialogDescription>{copy.classesDescription}</DialogDescription>
        </DialogHeader>

        <DialogBody>
          <ul className="space-y-2">
            {data.classes.map((c) => (
              <li key={c.id}>
                <label className="flex cursor-pointer items-center gap-3 rounded-[6px] border-2 border-[#dfe7f2] px-3 py-2.5 hover:border-[#22304a]">
                  <input
                    type="checkbox"
                    checked={selected.has(c.id)}
                    onChange={(e) => toggle(c.id, e.target.checked)}
                    className="size-4 accent-[#3576cf]"
                  />
                  <span className="text-[15px] font-medium">{classLabel(c)}</span>
                </label>
              </li>
            ))}
          </ul>
          {error && (
            <p className="mt-3 rounded-[6px] border-2 border-[#e5b9b9] bg-[#fdf4f4] px-3 py-2 text-[14px] text-[#b42318]">
              {error}
            </p>
          )}
        </DialogBody>

        <DialogFooter className="flex-row flex-wrap justify-end gap-2">
          {data.classesCustomized && (
            <button
              type="button"
              onClick={() => void save(null)}
              disabled={saving}
              className="mr-auto inline-flex min-h-[40px] items-center rounded-[6px] px-2 text-[14px] font-semibold text-[#255fac] underline-offset-4 hover:underline disabled:opacity-50"
            >
              {copy.useAllClasses}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="inline-flex min-h-[40px] items-center rounded-[6px] border-2 border-[#d5e0ee] bg-white px-4 text-[14px] font-semibold text-[#3c4a63] hover:border-[#22304a] disabled:opacity-50"
          >
            {copy.cancel}
          </button>
          <button
            type="button"
            onClick={() => void save([...selected])}
            disabled={saving}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-[6px] border-2 border-[#22304a] bg-[#3576cf] px-4 text-[14px] font-semibold text-white shadow-[3px_3px_0_#22304a] hover:bg-[#2c66b6] disabled:opacity-60"
          >
            {saving && <Loader2 className="size-4 animate-spin" />}
            {saving ? copy.saving : copy.save}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
