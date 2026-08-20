"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ImgHTMLAttributes } from "react";
import {
  ArrowUp,
  Square,
  Mic,
  MicOff,
  ImagePlus,
  X,
  ChevronLeft,
  PenTool,
  BookOpen,
  Sparkles,
  Copy,
  Check,
  Pin,
  PinOff,
  FileText,
  MessageSquarePlus,
  Plus,
  Trash2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { basePath } from "@/lib/utils";
import { filterUploadsWithinLimit } from "@/lib/upload-limits";
import { useVoiceInput } from "@/lib/use-voice-input";
import {
  createChineseChatId,
  upsertChineseChatHistory,
  type ChineseChatHistoryItem,
  type SavedChatMessage,
} from "@/lib/chinese-chat-history";
import {
  createEssayDraftId,
  deleteEssayDraft,
  getEssayDraft,
  getEssayDrafts,
  upsertEssayDraft,
  type EssayDraftItem,
} from "@/lib/chinese-essay-draft";

export interface ChineseTopicConfig {
  /** Stable identifier used for chat-history storage and load filtering. */
  topicId: string;
  /** Human-readable label shown in the header. */
  topicLabel: string;
  /** Prefix used when generating a session id. */
  sessionPrefix: string;
  /** API route this topic talks to (system prompt lives on the server). */
  apiEndpoint: string;
  /** Where the header back-link points (defaults to the Chinese subject). */
  backHref?: string;
  /** Label shown next to the header back-link (defaults to "返回中文科"). */
  backLabel?: string;
  /** Optional header icon name (defaults to "pen"). Passed as a string so the
   *  config can cross the Server -> Client Component boundary. */
  icon?: "pen" | "book";
  /** Optional textarea placeholder. */
  placeholder?: string;
  /** Optional hint shown when the conversation is empty. */
  emptyHint?: string;
  /** Optional default title used for history entries. */
  defaultTitle?: string;
  /** Optional quick-start buttons shown when the chat is empty. Clicking one
   *  sends `message` as if the student had typed it. */
  quickStartOptions?: { label: string; message: string }[];
  /** When true, the input box is disabled until the student picks a
   *  quick-start option (i.e. while the conversation is empty). */
  requireQuickStartSelection?: boolean;
  /** When true, show a right-side drafts panel (初稿 / 修改版本 / 終稿) that lets
   *  students write and locally save their essay drafts, and load one into the
   *  chat input to discuss with the AI. */
  enableDrafts?: boolean;
  /** Optional preset prompt buttons shown just above the chat input. Clicking
   *  one appends `text` below whatever is already in the input box (it never
   *  overwrites the existing content). */
  promptPresets?: { label: string; text: string }[];
}

type ChatImage = { mediaType: string; dataUrl: string; filename?: string };
type ChatMsg = {
  id: string;
  role: "user" | "assistant";
  text: string;
  images?: ChatImage[];
};

// Drafts panel: the three writing stages a student works through.
type DraftStage = "first" | "revised" | "final";
type DraftState = Record<DraftStage, string>;
const EMPTY_DRAFTS: DraftState = { first: "", revised: "", final: "" };
const DRAFT_STAGES: { key: DraftStage; label: string; hint: string }[] = [
  { key: "first", label: "初稿", hint: "先寫下你的第一個版本…" },
  { key: "revised", label: "修改版本", hint: "根據建議修改後的版本…" },
  { key: "final", label: "終稿", hint: "完成後的最終版本…" },
];

function formatDraftDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("zh-HK", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const ICON_MAP: Record<NonNullable<ChineseTopicConfig["icon"]>, LucideIcon> = {
  pen: PenTool,
  book: BookOpen,
};

// Shared prose styling for assistant markdown (extracted so HTML and markdown
// branches stay visually identical).
const ASSISTANT_PROSE_CLASS =
  "prose prose-sm max-w-none break-words prose-p:my-2 prose-li:my-1 prose-headings:my-2 [overflow-wrap:anywhere] [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:border-[#e5e5e5] [&_th]:px-2 [&_th]:py-1 [&_th]:bg-[#fafafa] [&_td]:border [&_td]:border-[#e5e5e5] [&_td]:px-2 [&_td]:py-1";

// Markdown plugin config shared by every ReactMarkdown instance below.
// `rehypeRaw` is required so inline raw HTML the AI emits inside Markdown
// (e.g. <img ...> tags placed in table cells) renders as real elements
// instead of showing up as escaped text. It must run before rehypeKatex.
const MARKDOWN_REMARK_PLUGINS = [remarkGfm, remarkMath];
const MARKDOWN_REHYPE_PLUGINS = [rehypeRaw, [rehypeKatex, { strict: false }]] as never;

// Constrain images that come from inline HTML so they stay responsive and
// never overflow the chat bubble, regardless of any width attribute the AI sets.
const MARKDOWN_COMPONENTS = {
  img: (props: ImgHTMLAttributes<HTMLImageElement>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      {...props}
      alt={props.alt ?? ""}
      className="inline-block h-auto max-w-full rounded-[6px]"
      loading="lazy"
    />
  ),
} as const;

// Some Humanities prompts intentionally emit raw HTML (e.g. an embedded WRI
// water-risk map, or a timeline image link). The chat normally renders Markdown
// only, so that HTML would otherwise show up as escaped text. Detect such a
// block and render it inside a sandboxed iframe instead.
const HTML_START_RE = /```html|<!doctype html|<html[\s>]|<iframe[\s>]/i;
const HTML_BLOCK_RE =
  /```html\s*([\s\S]*?)```|(<!doctype html[\s\S]*?<\/html>)|(<html[\s\S]*?<\/html>)|(<iframe[\s\S]*?<\/iframe>)|(<a\b[\s\S]*?<\/a>)/i;

function extractEmbeddedHtml(
  text: string
): { before: string; html: string; after: string } | null {
  const m = text.match(HTML_BLOCK_RE);
  if (!m) return null;
  const html = (m[1] ?? m[2] ?? m[3] ?? m[4] ?? m[5] ?? "").trim();
  if (!html || !html.includes("<")) return null;
  const start = m.index ?? 0;
  return {
    before: text.slice(0, start).trim(),
    html,
    after: text.slice(start + m[0].length).trim(),
  };
}

// Strip references to compromised CDNs before rendering AI-produced HTML.
const BLOCKED_IFRAME_HOSTS = ["polyfill.io", "polyfill.com", "bootcss.com", "bootcdn.net", "staticfile.org"];

function sanitizeEmbedHtml(html: string): string {
  const hostPattern = BLOCKED_IFRAME_HOSTS.map((h) => h.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const blocked = new RegExp(`(?:https?:)?//(?:[\\w.-]*\\.)?(?:${hostPattern})`, "i");
  return html
    .replace(/<script\b[^>]*\bsrc\s*=\s*(['"])(.*?)\1[^>]*>[\s\S]*?<\/script>/gi, (m, _q, src) =>
      blocked.test(src) ? "" : m
    )
    .replace(/<script\b[^>]*\bsrc\s*=\s*(['"])(.*?)\1[^>]*\/?>/gi, (m, _q, src) => (blocked.test(src) ? "" : m))
    .replace(/<link\b[^>]*\bhref\s*=\s*(['"])(.*?)\1[^>]*\/?>/gi, (m, _q, href) => (blocked.test(href) ? "" : m));
}

// Renders AI-produced HTML in a sandboxed iframe that auto-grows to fit its
// content, so the whole page shows with no inner scroll bar.
function EmbeddedHtmlFrame({ html }: { html: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(480);

  useEffect(() => {
    const iframe = ref.current;
    if (!iframe) return;
    let ro: ResizeObserver | null = null;
    const timers: number[] = [];

    const measure = () => {
      const doc = iframe.contentDocument;
      if (!doc) return;
      const h = Math.max(
        doc.documentElement?.scrollHeight ?? 0,
        doc.body?.scrollHeight ?? 0
      );
      if (h > 0) setHeight(h);
    };

    const onLoad = () => {
      measure();
      const doc = iframe.contentDocument;
      if (doc?.body) {
        ro = new ResizeObserver(measure);
        ro.observe(doc.body);
      }
      // Re-measure as images / the nested map settle.
      timers.push(window.setTimeout(measure, 300));
      timers.push(window.setTimeout(measure, 1200));
    };

    iframe.addEventListener("load", onLoad);
    if (iframe.contentDocument?.readyState === "complete") onLoad();

    return () => {
      iframe.removeEventListener("load", onLoad);
      ro?.disconnect();
      timers.forEach((t) => clearTimeout(t));
    };
  }, [html]);

  return (
    <iframe
      ref={ref}
      srcDoc={sanitizeEmbedHtml(html)}
      sandbox="allow-scripts allow-same-origin allow-popups"
      scrolling="no"
      className="w-full overflow-hidden rounded-[8px] border border-[#e5e5e5] bg-white"
      style={{ height }}
      title="互動內容"
    />
  );
}

export default function ChineseTopicChat({ config }: { config: ChineseTopicConfig }) {
  const {
    topicId,
    topicLabel,
    sessionPrefix,
    apiEndpoint,
    backHref = "/chinese",
    backLabel = "返回中文科",
    icon = "pen",
    placeholder = "輸入你的作文或問題…",
    emptyHint = `開始與 AI 對話，練習${config.topicLabel}。`,
    defaultTitle = `${config.topicLabel}對話`,
    quickStartOptions,
    requireQuickStartSelection = false,
    enableDrafts = false,
    promptPresets,
  } = config;
  const HeaderIcon = ICON_MAP[icon];

  const makeSessionId = useCallback(
    () =>
      `${sessionPrefix}-${
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2)
      }`,
    [sessionPrefix]
  );

  const [sessionId, setSessionId] = useState<string>(() => makeSessionId());
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [status, setStatus] = useState<"idle" | "submitted" | "streaming">("idle");
  const [input, setInput] = useState("");
  const [chatFiles, setChatFiles] = useState<File[]>([]);
  const [currentChatId, setCurrentChatId] = useState(() => createChineseChatId());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [showPinned, setShowPinned] = useState(false);
  // --- Drafts panel (作文稿: 初稿 / 修改版本 / 終稿), stored in the database. ---
  const [showDrafts, setShowDrafts] = useState(false);
  const [draftList, setDraftList] = useState<EssayDraftItem[]>([]);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<DraftState>(EMPTY_DRAFTS);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftsView, setDraftsView] = useState<"list" | "editor">("list");
  const [draftSaveState, setDraftSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const draftSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Autosave reads the draft through refs, so a queued save always writes the
  // newest content/title instead of the values captured when it was armed.
  const draftsRef = useRef<DraftState>(EMPTY_DRAFTS);
  const draftTitleRef = useRef("");
  const activeDraftIdRef = useRef<string | null>(null);
  draftsRef.current = drafts;
  draftTitleRef.current = draftTitle;
  activeDraftIdRef.current = activeDraftId;
  // Skip the round-trip when nothing changed, and ignore the reply of a save
  // that has been superseded so a slow POST cannot clobber a newer one.
  const lastSavedPayloadRef = useRef("");
  const saveSeqRef = useRef(0);
  // Per-stage voice input for the drafts panel (independent of the chat mic).
  const [listeningStage, setListeningStage] = useState<DraftStage | null>(null);
  // Which stage the live dictation belongs to. Pinned for the session so
  // switching stages mid-sentence can't write speech into the wrong box.
  const draftStageRef = useRef<DraftStage | null>(null);
  // Deleting the open draft has to drop the mic without the usual flush: the
  // save is an upsert, so a late one would resurrect the draft.
  const suppressDraftFlushRef = useRef(false);
  // Which stage box a dictation error belongs to, so the message shows under
  // the mic the student actually pressed.
  const [draftVoiceErrorStage, setDraftVoiceErrorStage] = useState<DraftStage | null>(null);
  const draftVoiceSafetyTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const handleChatScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }, []);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Loading a saved chat must not re-save it (which would bump updatedAt and
  // reorder the shared history list).
  const skipSaveRef = useRef(false);

  // Dictation into one of the essay-draft stages. The stage boxes autosave, so
  // this one persists the committed text (never the provisional tail) and
  // flushes when the mic stops.
  const {
    isSupported: isVoiceSupported,
    error: draftVoiceError,
    start: startDraftDictation,
    stop: finishDraftDictation,
    getCommittedText: getDraftCommittedText,
    rebase: rebaseDraftDictation,
  } = useVoiceInput({
    lang: "zh-HK",
    // Dictation begins on a new line under whatever is already written, but once
    // the student has typed we are mid-sentence and must not add another break.
    separator: "\n",
    continuationSeparator: "",
    getBaseText: () => (draftStageRef.current ? draftsRef.current[draftStageRef.current] : ""),
    onStart: () => {
      setListeningStage(draftStageRef.current);
      setDraftVoiceErrorStage(null);
      // Long dictations still get a periodic save, so a crash or a closed tab
      // cannot cost several minutes of speech.
      draftVoiceSafetyTimer.current = setInterval(() => saveDictationSnapshot(), 15000);
    },
    onError: (voiceInputError) => {
      if (voiceInputError.fatal) setDraftVoiceErrorStage(draftStageRef.current);
    },
    onTranscript: (text) => {
      const stage = draftStageRef.current;
      if (!stage) return;
      // Written straight to state without arming the autosave debounce: the
      // periodic snapshot and the flush on stop are what persist dictation.
      setDrafts((prev) => ({ ...prev, [stage]: text }));
    },
    onStop: () => {
      if (draftVoiceSafetyTimer.current) {
        clearInterval(draftVoiceSafetyTimer.current);
        draftVoiceSafetyTimer.current = null;
      }
      draftStageRef.current = null;
      setListeningStage(null);
      if (!suppressDraftFlushRef.current) flushDraftSave();
    },
  });

  const {
    isListening,
    error: voiceError,
    stop: stopListening,
    toggle: toggleVoice,
    rebase: rebaseChatDictation,
  } = useVoiceInput({
    lang: "zh-HK",
    // Chinese doesn't separate words with spaces.
    separator: "",
    getBaseText: () => input,
    onTranscript: setInput,
    // Starting this mic displaces the draft mic via the hook's own one-at-a-time
    // rule, which also runs the draft's flush-on-stop.
  });

  // Typing while the mic is live: hand the edit to the recogniser as the new
  // baseline, otherwise the next result would revert it.
  const handleInputChange = useCallback(
    (value: string) => {
      setInput(value);
      if (isListening) rebaseChatDictation(value);
    },
    [isListening, rebaseChatDictation]
  );

  const isLoading = status === "submitted" || status === "streaming";
  const mustSelectFirst =
    requireQuickStartSelection &&
    !!quickStartOptions?.length &&
    messages.length === 0;
  const canSend =
    (!!input.trim() || chatFiles.length > 0) && !isLoading && !mustSelectFirst;
  const pinnedMessages = messages.filter((m) => pinnedIds.includes(m.id));

  // Broadcast the active chat id so the sidebar can highlight the open item.
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("chinese-chat:active", { detail: { id: currentChatId } })
    );
  }, [currentChatId]);

  useEffect(() => {
    setSessionId(makeSessionId());
  }, [makeSessionId]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus("idle");
  }, []);

  const handleCopy = useCallback(async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback for browsers/contexts without clipboard API
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      try { document.execCommand("copy"); } catch { /* ignore */ }
      document.body.removeChild(textarea);
    }
    setCopiedId(id);
    setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 2000);
  }, []);

  const togglePin = useCallback((id: string) => {
    setPinnedIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      if (next.length > 0) setShowPinned(true);
      return next;
    });
  }, []);

  const deriveDraftTitle = useCallback((state: DraftState, fallback: string) => {
    const source = state.first || state.revised || state.final || "";
    const firstLine = source
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l.length > 0);
    return (firstLine ?? "").slice(0, 40) || fallback;
  }, []);

  const refreshDraftList = useCallback(async () => {
    const items = await getEssayDrafts(topicId);
    setDraftList(items);
    return items;
  }, [topicId]);

  // Load the draft list whenever the panel is opened.
  useEffect(() => {
    if (!enableDrafts || !showDrafts) return;
    void refreshDraftList();
  }, [enableDrafts, showDrafts, refreshDraftList]);

  const buildDraftPayload = useCallback(
    (id: string, state: DraftState, title: string) => ({
      id,
      topic: topicId,
      title: title.trim() || deriveDraftTitle(state, "未命名作文稿"),
      first: state.first,
      revised: state.revised,
      final: state.final,
    }),
    [topicId, deriveDraftTitle]
  );

  const saveActiveDraft = useCallback(
    async (id: string, state: DraftState, title: string) => {
      // A brand-new, entirely empty draft has nothing worth persisting yet.
      if (!state.first.trim() && !state.revised.trim() && !state.final.trim() && !title.trim()) {
        setDraftSaveState("idle");
        return;
      }
      const payload = buildDraftPayload(id, state, title);
      const serialized = JSON.stringify(payload);
      if (serialized === lastSavedPayloadRef.current) return;
      lastSavedPayloadRef.current = serialized;
      const seq = ++saveSeqRef.current;
      setDraftSaveState("saving");
      const ok = await upsertEssayDraft(payload);
      // A newer save started while this one was in flight — it owns the UI now.
      if (seq !== saveSeqRef.current) return;
      if (!ok) {
        // Let the same content be retried on the next edit.
        lastSavedPayloadRef.current = "";
        setDraftSaveState("idle");
        return;
      }
      setDraftSaveState("saved");
      void refreshDraftList();
      setTimeout(() => setDraftSaveState((p) => (p === "saved" ? "idle" : p)), 1500);
    },
    [buildDraftPayload, refreshDraftList]
  );

  // Save immediately from the newest state, cancelling any queued save. Used
  // whenever we are about to lose the editor (switching draft, closing the
  // panel, unmount) or when dictation stops.
  const flushDraftSave = useCallback(() => {
    if (draftSaveTimer.current) {
      clearTimeout(draftSaveTimer.current);
      draftSaveTimer.current = null;
    }
    const id = activeDraftIdRef.current;
    if (!id) return;
    void saveActiveDraft(id, draftsRef.current, draftTitleRef.current);
  }, [saveActiveDraft]);

  // Periodic save during a long dictation. It writes the committed text rather
  // than what is on screen so a half-recognised word never lands in the
  // database.
  const saveDictationSnapshot = useCallback(() => {
    const id = activeDraftIdRef.current;
    const stage = draftStageRef.current;
    if (!id || !stage) return;
    void saveActiveDraft(
      id,
      { ...draftsRef.current, [stage]: getDraftCommittedText() },
      draftTitleRef.current
    );
  }, [getDraftCommittedText, saveActiveDraft]);

  const scheduleDraftSave = useCallback(
    (stage?: DraftStage) => {
      // While the mic is live, interim results rewrite that textarea several
      // times a second. Debouncing on them either spams the API or races with
      // the dictation buffer, so the dictated stage is left to the periodic
      // snapshot and the flush that runs when the mic stops.
      if (stage && draftStageRef.current === stage) return;
      if (draftSaveTimer.current) clearTimeout(draftSaveTimer.current);
      draftSaveTimer.current = setTimeout(() => {
        draftSaveTimer.current = null;
        const id = activeDraftIdRef.current;
        if (!id) return;
        void saveActiveDraft(id, draftsRef.current, draftTitleRef.current);
      }, 800);
    },
    [saveActiveDraft]
  );

  // Flush a pending save on unmount instead of dropping it.
  const flushOnUnmountRef = useRef(flushDraftSave);
  flushOnUnmountRef.current = flushDraftSave;
  useEffect(
    () => () => {
      if (draftVoiceSafetyTimer.current) clearInterval(draftVoiceSafetyTimer.current);
      flushOnUnmountRef.current();
    },
    []
  );

  const startNewDraft = useCallback(() => {
    // Persist the draft we are leaving rather than discarding its queued save.
    finishDraftDictation();
    flushDraftSave();
    lastSavedPayloadRef.current = "";
    setActiveDraftId(createEssayDraftId());
    setDrafts(EMPTY_DRAFTS);
    setDraftTitle("");
    setDraftSaveState("idle");
    setDraftsView("editor");
  }, [finishDraftDictation, flushDraftSave]);

  const openDraft = useCallback(
    async (id: string) => {
      finishDraftDictation();
      flushDraftSave();
      const item = await getEssayDraft(id);
      if (!item) return;
      const loaded: DraftState = { first: item.first, revised: item.revised, final: item.final };
      const title = item.title === "未命名作文稿" ? "" : item.title;
      // Remember what we loaded so a flush cannot re-save identical content and
      // needlessly bump updatedAt (which reorders the draft list).
      lastSavedPayloadRef.current = JSON.stringify(buildDraftPayload(item.id, loaded, title));
      setActiveDraftId(item.id);
      setDrafts(loaded);
      setDraftTitle(title);
      setDraftSaveState("idle");
      setDraftsView("editor");
    },
    [buildDraftPayload, finishDraftDictation, flushDraftSave]
  );

  const handleDraftChange = useCallback(
    (stage: DraftStage, value: string) => {
      if (!activeDraftIdRef.current) return;
      // Typing while the mic is live: adopt what the student now sees as the
      // new dictation base so the next speech result appends to it instead of
      // reverting the edit.
      if (draftStageRef.current === stage) rebaseDraftDictation(value);
      setDrafts((prev) => ({ ...prev, [stage]: value }));
      scheduleDraftSave(stage);
    },
    [rebaseDraftDictation, scheduleDraftSave]
  );

  const handleDraftTitleChange = useCallback(
    (value: string) => {
      setDraftTitle(value);
      scheduleDraftSave();
    },
    [scheduleDraftSave]
  );

  const handleDeleteDraft = useCallback(
    async (id: string) => {
      if (activeDraftId === id) {
        // Drop the mic and any queued save first: the save is an upsert, so a
        // late one would resurrect the draft we are deleting.
        suppressDraftFlushRef.current = true;
        finishDraftDictation();
        suppressDraftFlushRef.current = false;
        if (draftSaveTimer.current) {
          clearTimeout(draftSaveTimer.current);
          draftSaveTimer.current = null;
        }
        lastSavedPayloadRef.current = "";
        setActiveDraftId(null);
        setDrafts(EMPTY_DRAFTS);
        setDraftTitle("");
        setDraftSaveState("idle");
        setDraftsView("list");
      }
      await deleteEssayDraft(id);
      await refreshDraftList();
    },
    [activeDraftId, finishDraftDictation, refreshDraftList]
  );

  // Append text below whatever is already in the chat input (never overwrites).
  const appendToInput = useCallback((text: string) => {
    const addition = text.trim();
    if (!addition) return;
    setInput((prev) => (prev.trim() ? `${prev.replace(/\s+$/, "")}\n\n${addition}` : addition));
    textareaRef.current?.focus();
  }, []);

  // Load a draft stage into the chat input so the student can ask the AI about it.
  const handleUseDraft = useCallback(
    (stage: DraftStage) => {
      const text = drafts[stage].trim();
      if (!text) return;
      setInput((prev) => (prev.trim() ? `${prev.replace(/\s+$/, "")}\n\n${text}` : text));
      textareaRef.current?.focus();
    },
    [drafts]
  );

  // Dictate into a specific draft stage, appending to whatever is already there.
  const toggleDraftVoice = useCallback(
    (stage: DraftStage) => {
      if (!activeDraftId) return;
      // Toggle off if this stage is already recording; also covers switching to
      // another stage, since only one recogniser may run at a time.
      // Stop first so toggling the same stage off is the whole action, and so
      // switching stages flushes the one we are leaving.
      const wasDictating = draftStageRef.current;
      finishDraftDictation();
      if (wasDictating === stage) return;
      // Let the hook raise the unsupported-browser alert without pinning a
      // stage that will never be dictated into.
      if (!isVoiceSupported) {
        startDraftDictation();
        return;
      }
      // Set before starting: the hook reads the stage to pick up the text
      // already in that box.
      draftStageRef.current = stage;
      startDraftDictation();
    },
    [activeDraftId, finishDraftDictation, isVoiceSupported, startDraftDictation]
  );

  // Leaving the editor (panel closed / back to the list): stop dictation and
  // persist the last edits instead of dropping the queued save.
  useEffect(() => {
    if (showDrafts && draftsView === "editor") return;
    finishDraftDictation();
    flushDraftSave();
  }, [showDrafts, draftsView, finishDraftDictation, flushDraftSave]);

  const handleNewChat = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    // The input is about to be cleared, so a live mic would write the old text
    // back on its next result.
    stopListening();
    setMessages([]);
    setInput("");
    setChatFiles([]);
    setStatus("idle");
    setSessionId(makeSessionId());
    setCurrentChatId(createChineseChatId());
    setPinnedIds([]);
    setShowPinned(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [makeSessionId, stopListening]);

  useEffect(() => {
    window.addEventListener("dashboard:new-chat", handleNewChat);
    return () => window.removeEventListener("dashboard:new-chat", handleNewChat);
  }, [handleNewChat]);

  // Listen for sidebar history item click
  useEffect(() => {
    function onLoadChat(event: Event) {
      const detail = (event as CustomEvent<{ item: ChineseChatHistoryItem }>).detail?.item;
      if (!detail || detail.topic !== topicId) return;
      abortRef.current?.abort();
      abortRef.current = null;
      // The input gets cleared below, so drop any dictation in flight.
      stopListening();
      skipSaveRef.current = true;
      setCurrentChatId(detail.id);
      const restored: ChatMsg[] = detail.messages.map((m) => ({
        id: m.id,
        role: m.role as "user" | "assistant",
        text: m.parts.find((p) => p.type === "text")?.text ?? "",
        images: m.parts
          .filter((p) => p.type === "file")
          .map((p) => ({ mediaType: p.mediaType ?? "", dataUrl: p.url ?? "", filename: p.filename })),
      }));
      setMessages(restored);
      setInput("");
      setChatFiles([]);
      setStatus("idle");
      setPinnedIds([]);
      setShowPinned(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
    window.addEventListener("chinese-chat:load", onLoadChat);
    return () => window.removeEventListener("chinese-chat:load", onLoadChat);
  }, [topicId, stopListening]);

  // Auto-save chat history
  useEffect(() => {
    if (skipSaveRef.current) {
      skipSaveRef.current = false;
      return;
    }
    if (messages.length === 0) return;
    if (status === "streaming" || status === "submitted") return;

    const firstUserText = messages.find((m) => m.role === "user")?.text;
    const title = firstUserText ? firstUserText.slice(0, 50) : defaultTitle;

    const savedMessages: SavedChatMessage[] = messages.map((m) => ({
      id: m.id,
      role: m.role,
      parts: [
        ...(m.text ? [{ type: "text" as const, text: m.text }] : []),
        ...(m.images ?? []).map((img) => ({ type: "file" as const, url: img.dataUrl, mediaType: img.mediaType, filename: img.filename })),
      ],
    }));

    void upsertChineseChatHistory({
      id: currentChatId,
      title,
      topic: topicId,
      messages: savedMessages,
      updatedAt: new Date().toISOString(),
    });
  }, [currentChatId, messages, status, topicId, defaultTitle]);

  useEffect(() => {
    const container = chatScrollRef.current;
    if (!container) return;
    // Follow the latest message only while the user is pinned to the bottom.
    if (isAtBottomRef.current) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages]);

  function fileToDataURL(file: File): Promise<string> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
  }

  async function doSend(overrideText?: string) {
    const isQuick = typeof overrideText === "string";
    if (isQuick) {
      if (isLoading) return;
    } else if (!canSend) {
      return;
    }
    if (isListening) stopListening();

    const images: ChatImage[] = isQuick
      ? []
      : await Promise.all(
          chatFiles.map(async (file) => ({
            mediaType: file.type,
            dataUrl: await fileToDataURL(file),
            filename: file.name,
          }))
        );

    const userText = isQuick ? overrideText : (input.trim() || "（見圖片）");
    const userMsg: ChatMsg = { id: `u-${Date.now()}`, role: "user", text: userText, ...(images.length > 0 ? { images } : {}) };
    const assistantMsg: ChatMsg = { id: `a-${Date.now()}`, role: "assistant", text: "" };

    const nextMessages = [...messages, userMsg];
    setMessages([...nextMessages, assistantMsg]);
    setInput("");
    setChatFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setStatus("submitted");

    const controller = new AbortController();
    abortRef.current = controller;

    const payloadMessages = nextMessages.map((message) => ({
      role: message.role,
      text: message.text,
      ...(message.images && message.images.length > 0
        ? { images: message.images.map((image) => ({ mediaType: image.mediaType, data: image.dataUrl })) }
        : {}),
    }));

    try {
      const res = await fetch(`${basePath}${apiEndpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: payloadMessages, sessionId }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => "");
        setMessages((prev) => prev.map((m) => m.id === assistantMsg.id ? { ...m, text: `（出錯了）${errText || res.statusText}` } : m));
        setStatus("idle");
        abortRef.current = null;
        return;
      }

      setStatus("streaming");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let target = "";
      let displayed = "";
      let streamDone = false;
      let rafId: number | null = null;
      const CHARS_PER_TICK = 2;

      const tick = () => {
        if (displayed.length < target.length) {
          const remaining = target.length - displayed.length;
          const step = Math.max(CHARS_PER_TICK, Math.ceil(remaining / 30));
          displayed = target.slice(0, displayed.length + step);
          const snapshot = displayed;
          setMessages((prev) => prev.map((m) => m.id === assistantMsg.id ? { ...m, text: snapshot } : m));
        }
        if (displayed.length < target.length || !streamDone) {
          rafId = requestAnimationFrame(tick);
        } else {
          rafId = null;
        }
      };
      rafId = requestAnimationFrame(tick);

      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          if (chunk) target += chunk;
        }
      } finally {
        streamDone = true;
        await new Promise<void>((resolve) => {
          const waitForCatchUp = () => {
            if (displayed.length >= target.length) {
              if (rafId !== null) cancelAnimationFrame(rafId);
              setMessages((prev) => prev.map((m) => m.id === assistantMsg.id ? { ...m, text: target } : m));
              resolve();
            } else {
              requestAnimationFrame(waitForCatchUp);
            }
          };
          waitForCatchUp();
        });
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        setMessages((prev) => prev.map((m) => m.id === assistantMsg.id ? { ...m, text: error instanceof Error ? `（出錯了）${error.message}` : "（出錯了）未知錯誤" } : m));
      } else {
        setMessages((prev) => prev.filter((m) => m.id !== assistantMsg.id || m.text));
      }
    } finally {
      abortRef.current = null;
      setStatus("idle");
    }
  }

  function handleChatFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      const picked = Array.from(e.target.files);
      setChatFiles((prev) => [...prev, ...filterUploadsWithinLimit(prev, picked)]);
    }
  }
  function removeChatFile(index: number) {
    setChatFiles((prev) => prev.filter((_, i) => i !== index));
  }
  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const items = e.clipboardData?.items;
    if (!items) return;
    const imageFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) { const f = items[i].getAsFile(); if (f) imageFiles.push(f); }
    }
    if (imageFiles.length === 0) return;
    e.preventDefault();
    setChatFiles((prev) => [...prev, ...filterUploadsWithinLimit(prev, imageFiles)]);
  }
  function handleSubmit(e: React.FormEvent) { e.preventDefault(); void doSend(); }
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void doSend(); }
  }

  return (
    <div className="relative flex flex-1 overflow-hidden bg-white text-[#080808]">
      {/* Full-width chat panel */}
      <div className="relative flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <div className="flex h-[57px] shrink-0 items-center justify-between border-b border-[#ededed] bg-white px-4">
          <div className="flex items-center gap-1">
            <SidebarTrigger />
            <Link
              href={backHref}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <ChevronLeft className="size-4" />
              {backLabel}
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <HeaderIcon className="size-4 text-[#146ef5]" />
            <span className="text-sm font-semibold text-[#080808]">{topicLabel}</span>
          </div>
          <div className="flex items-center gap-2">
            {enableDrafts && (
              <Button type="button" variant="outline" size="sm" onClick={() => setShowDrafts((v) => !v)}
                className={`rounded-full border-[#e5e5e5] px-3 text-xs font-medium transition-all hover:bg-[#f4f4f5] ${showDrafts ? "text-[#146ef5] border-[#146ef5]/40" : "text-[#080808]"}`}
                title={showDrafts ? "隱藏作文稿" : "顯示作文稿"}>
                <FileText className="size-3.5" />
                作文稿
              </Button>
            )}
            {pinnedIds.length > 0 && (
              <Button type="button" variant="outline" size="sm" onClick={() => setShowPinned((v) => !v)}
                className={`rounded-full border-[#e5e5e5] px-3 text-xs font-medium transition-all hover:bg-[#f4f4f5] ${showPinned ? "text-[#146ef5] border-[#146ef5]/40" : "text-[#080808]"}`}
                title={showPinned ? "隱藏釘選" : "顯示釘選"}>
                <Pin className="size-3.5" />
                釘選 {pinnedIds.length}
              </Button>
            )}
          </div>
        </div>

        {/* Chat messages */}
        <div ref={chatScrollRef} onScroll={handleChatScroll} className={`flex-1 px-4 py-6 min-h-0 bg-white ${messages.length > 0 ? "overflow-y-auto" : "overflow-hidden"}`}>
          <div className="w-full space-y-6">
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-5 text-center">
              <span className="text-sm text-[#9a9a9a]">{emptyHint}</span>
              {quickStartOptions && quickStartOptions.length > 0 && (
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {quickStartOptions.map((opt) => (
                    <Button
                      key={opt.message}
                      type="button"
                      variant="outline"
                      onClick={() => void doSend(opt.message)}
                      disabled={isLoading}
                      className="rounded-full border-[#e5e5e5] px-4 py-2 text-sm font-medium text-[#080808] transition-all hover:border-[#146ef5]/40 hover:bg-[#146ef5]/5 hover:text-[#146ef5]"
                    >
                      {opt.label}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          )}
          {messages.map((message) => (
            message.role === "user" ? (
              <div key={message.id} className="flex flex-col items-end">
                <div className="min-w-0 max-w-[80%] rounded-2xl bg-[#f4f4f5] px-4 py-2.5 text-sm leading-relaxed text-[#080808]">
                  {message.images && message.images.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-1.5 not-prose">
                      {message.images.map((image, idx) => (
                        <img key={idx} src={image.dataUrl} alt={image.filename ?? "uploaded image"} className="max-w-[200px] max-h-[200px] rounded-[8px] object-contain" />
                      ))}
                    </div>
                  )}
                  <div className="prose prose-sm max-w-none break-words [overflow-wrap:anywhere]">
                    <ReactMarkdown remarkPlugins={MARKDOWN_REMARK_PLUGINS} rehypePlugins={MARKDOWN_REHYPE_PLUGINS} components={MARKDOWN_COMPONENTS}>
                      {message.text}
                    </ReactMarkdown>
                  </div>
                </div>
                {message.text && (
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => handleCopy(message.id, message.text)}
                      className="group/copy relative mt-1.5 inline-flex size-8 items-center justify-center rounded-full text-[#9a9a9a] transition-colors hover:bg-[#f4f4f5] hover:text-[#5a5a5a]"
                      aria-label="複製訊息"
                    >
                      {copiedId === message.id ? (
                        <Check className="size-4 text-[#16a34a]" />
                      ) : (
                        <Copy className="size-4" />
                      )}
                      <span className="pointer-events-none absolute right-0 top-full z-10 mt-1 whitespace-nowrap rounded-md bg-[#080808] px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover/copy:opacity-100">
                        {copiedId === message.id ? "已複製" : "複製訊息"}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => togglePin(message.id)}
                      className={`group/pin relative mt-1.5 inline-flex size-8 items-center justify-center rounded-full transition-colors hover:bg-[#f4f4f5] ${pinnedIds.includes(message.id) ? "text-[#146ef5]" : "text-[#9a9a9a] hover:text-[#5a5a5a]"}`}
                      aria-label={pinnedIds.includes(message.id) ? "取消釘選" : "釘選訊息"}
                    >
                      {pinnedIds.includes(message.id) ? (
                        <PinOff className="size-4" />
                      ) : (
                        <Pin className="size-4" />
                      )}
                      <span className="pointer-events-none absolute right-0 top-full z-10 mt-1 whitespace-nowrap rounded-md bg-[#080808] px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover/pin:opacity-100">
                        {pinnedIds.includes(message.id) ? "取消釘選" : "釘選訊息"}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div key={message.id} className="flex items-start gap-3">
                {message.text ? (
                  <Sparkles className="mt-1 size-5 shrink-0 text-[#146ef5]" />
                ) : (
                  <span className="relative mt-0.5 inline-flex size-6 shrink-0 items-center justify-center">
                    <span className="absolute inset-0 rounded-full border-2 border-[#146ef5]/20 border-t-[#146ef5] animate-spin" />
                    <Sparkles className="size-3.5 text-[#146ef5]" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  {message.text && (() => {
                    const embedded = extractEmbeddedHtml(message.text);
                    if (embedded) {
                      return (
                        <div className="space-y-2">
                          {embedded.before && (
                            <div className={ASSISTANT_PROSE_CLASS}>
                              <ReactMarkdown remarkPlugins={MARKDOWN_REMARK_PLUGINS} rehypePlugins={MARKDOWN_REHYPE_PLUGINS} components={MARKDOWN_COMPONENTS}>
                                {embedded.before}
                              </ReactMarkdown>
                            </div>
                          )}
                          <EmbeddedHtmlFrame html={embedded.html} />
                          {embedded.after && (
                            <div className={ASSISTANT_PROSE_CLASS}>
                              <ReactMarkdown remarkPlugins={MARKDOWN_REMARK_PLUGINS} rehypePlugins={MARKDOWN_REHYPE_PLUGINS} components={MARKDOWN_COMPONENTS}>
                                {embedded.after}
                              </ReactMarkdown>
                            </div>
                          )}
                        </div>
                      );
                    }
                    // HTML still streaming in (no closing tag yet) — show a
                    // placeholder instead of flashing raw tags as text.
                    const streamingThis = isLoading && message.id === messages[messages.length - 1]?.id;
                    if (streamingThis && HTML_START_RE.test(message.text)) {
                      return <div className="text-sm text-[#9a9a9a]">互動內容生成中…⏳</div>;
                    }
                    return (
                      <div className={ASSISTANT_PROSE_CLASS}>
                        <ReactMarkdown remarkPlugins={MARKDOWN_REMARK_PLUGINS} rehypePlugins={MARKDOWN_REHYPE_PLUGINS} components={MARKDOWN_COMPONENTS}>
                          {message.text}
                        </ReactMarkdown>
                      </div>
                    );
                  })()}
                  {message.text && !(isLoading && message.id === messages[messages.length - 1]?.id) && (
                    <button
                      type="button"
                      onClick={() => handleCopy(message.id, message.text)}
                      className="group/copy relative mt-1.5 inline-flex size-8 items-center justify-center rounded-full text-[#9a9a9a] transition-colors hover:bg-[#f4f4f5] hover:text-[#5a5a5a]"
                      aria-label="複製回覆"
                    >
                      {copiedId === message.id ? (
                        <Check className="size-4 text-[#16a34a]" />
                      ) : (
                        <Copy className="size-4" />
                      )}
                      <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-[#080808] px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover/copy:opacity-100">
                        {copiedId === message.id ? "已複製" : "複製回覆"}
                      </span>
                    </button>
                  )}
                  {message.text && !(isLoading && message.id === messages[messages.length - 1]?.id) && (
                    <button
                      type="button"
                      onClick={() => togglePin(message.id)}
                      className={`group/pin relative mt-1.5 inline-flex size-8 items-center justify-center rounded-full transition-colors hover:bg-[#f4f4f5] ${pinnedIds.includes(message.id) ? "text-[#146ef5]" : "text-[#9a9a9a] hover:text-[#5a5a5a]"}`}
                      aria-label={pinnedIds.includes(message.id) ? "取消釘選" : "釘選回覆"}
                    >
                      {pinnedIds.includes(message.id) ? (
                        <PinOff className="size-4" />
                      ) : (
                        <Pin className="size-4" />
                      )}
                      <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-[#080808] px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover/pin:opacity-100">
                        {pinnedIds.includes(message.id) ? "取消釘選" : "釘選回覆"}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            )
          ))}

          {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
            <div className="flex items-start gap-3">
              <span className="relative mt-0.5 inline-flex size-6 shrink-0 items-center justify-center">
                <span className="absolute inset-0 rounded-full border-2 border-[#146ef5]/20 border-t-[#146ef5] animate-spin" />
                <Sparkles className="size-3.5 text-[#146ef5]" />
              </span>
            </div>
          )}
          <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Chat input */}
        <div className="px-4 pb-4 bg-white">
          {promptPresets && promptPresets.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {promptPresets.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => appendToInput(preset.text)}
                  disabled={mustSelectFirst}
                  className="rounded-full border border-[#e5e5e5] bg-white px-3 py-1.5 text-xs font-medium text-[#5a5a5a] transition-colors hover:border-[#146ef5] hover:text-[#146ef5] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          )}
          <form onSubmit={handleSubmit} className="w-full">
            <div className="relative w-full rounded-2xl border border-[#e5e5e5] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
              {chatFiles.length > 0 && (
                <div className="flex flex-wrap gap-1.5 px-3 pt-2">
                  {chatFiles.map((file, i) => (
                    <div key={i} className="relative group">
                      <img src={URL.createObjectURL(file)} alt={file.name} className="size-12 rounded-[8px] border border-[#e5e5e5] object-cover" />
                      <button type="button" onClick={() => removeChatFile(i)} className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-[#080808] text-white opacity-0 transition-opacity group-hover:opacity-100">
                        <X className="size-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <Textarea ref={textareaRef} placeholder={mustSelectFirst ? "請先在上方選擇一個模式…" : placeholder} value={input} onChange={(e) => handleInputChange(e.target.value)} onKeyDown={handleKeyDown} onPaste={handlePaste} disabled={mustSelectFirst}
                className="min-h-[56px] max-h-[160px] resize-none overflow-y-auto border-0 bg-transparent px-4 pt-3.5 pb-10 text-sm shadow-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-60" />
              <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleChatFileChange} className="hidden" />
              <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <Button type="button" size="icon-sm" variant="ghost" onClick={() => fileInputRef.current?.click()} disabled={mustSelectFirst}
                    className="rounded-full text-[#5a5a5a] transition-all hover:bg-[#f4f4f5]" title="上傳圖片">
                    <ImagePlus className="size-4" />
                  </Button>
                  <Button type="button" size="icon-sm" variant="ghost" onClick={toggleVoice} disabled={mustSelectFirst}
                    className={`rounded-full transition-all ${isListening ? 'text-red-500 hover:bg-red-50' : 'text-[#5a5a5a] hover:bg-[#f4f4f5]'}`}
                    title={isListening ? '停止語音輸入' : '語音輸入'}
                    aria-label={isListening ? '停止語音輸入' : '語音輸入'}>
                    {isListening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
                  </Button>
                  {isListening && <span aria-live="polite" className="text-[11px] font-medium text-red-500 animate-pulse">聆聽中…</span>}
                  {!isListening && voiceError && <span role="alert" className="text-[11px] font-medium text-red-500">{voiceError.message}</span>}
                </div>
                {isLoading ? (
                  <Button type="button" size="icon-sm" variant="default" className="rounded-full bg-[#146ef5] hover:bg-[#0055d4]" onClick={stop}><Square className="size-3" /></Button>
                ) : (
                  <Button type="submit" size="icon-sm" className="rounded-full bg-[#146ef5] text-white hover:bg-[#0055d4] disabled:bg-[#d8d8d8]" disabled={!canSend}><ArrowUp className="size-4" /></Button>
                )}
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Right-side drafts panel: history list + editor (初稿 / 修改版本 / 終稿) */}
      {enableDrafts && showDrafts && (
        <div className="flex w-96 shrink-0 flex-col border-l border-[#ededed] bg-[#fafafa]">
          <div className="flex h-[57px] shrink-0 items-center justify-between border-b border-[#ededed] bg-white px-4">
            <div className="flex items-center gap-2">
              {draftsView === "editor" ? (
                <button
                  type="button"
                  onClick={() => { setDraftsView("list"); void refreshDraftList(); }}
                  className="inline-flex items-center rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  title="返回列表"
                >
                  <ChevronLeft className="size-4" />
                </button>
              ) : (
                <FileText className="size-4 text-[#146ef5]" />
              )}
              <span className="text-sm font-semibold text-[#080808]">
                {draftsView === "editor" ? "編輯作文稿" : "我的作文稿"}
              </span>
            </div>
            <Button type="button" size="icon-sm" variant="ghost" onClick={() => setShowDrafts(false)}
              className="rounded-full text-[#5a5a5a] transition-all hover:bg-[#f4f4f5]" title="關閉">
              <X className="size-4" />
            </Button>
          </div>

          {draftsView === "list" ? (
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              <Button
                type="button"
                onClick={startNewDraft}
                className="w-full rounded-full bg-[#146ef5] text-sm font-medium text-white transition-all hover:bg-[#0055d4]"
              >
                <Plus className="size-4" />
                新建作文稿
              </Button>
              {draftList.length === 0 ? (
                <div className="flex h-40 flex-col items-center justify-center text-center text-xs leading-relaxed text-[#9a9a9a]">
                  還沒有作文稿。<br />點擊上方「新建作文稿」開始寫作。
                </div>
              ) : (
                draftList.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => void openDraft(item.id)}
                    className="group/draft cursor-pointer rounded-xl border border-[#ededed] bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-colors hover:border-[#146ef5]/40"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-[#080808]">{item.title}</div>
                        <div className="mt-0.5 text-[11px] text-[#9a9a9a]">{formatDraftDate(item.updatedAt)}</div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); void handleDeleteDraft(item.id); }}
                        className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-[#9a9a9a] transition-colors hover:bg-red-50 hover:text-red-500"
                        title="刪除"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {DRAFT_STAGES.filter((s) => item[s.key].trim()).map((s) => (
                        <span key={s.key} className="rounded-full bg-[#146ef5]/10 px-1.5 py-0.5 text-[10px] font-medium text-[#146ef5]">
                          {s.label}
                        </span>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              <div>
                <label className="mb-1 block text-[11px] font-medium text-[#9a9a9a]">標題</label>
                <input
                  value={draftTitle}
                  onChange={(e) => handleDraftTitleChange(e.target.value)}
                  placeholder="為這篇作文取個名字…"
                  className="w-full rounded-lg border border-[#e5e5e5] bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#146ef5]/40"
                />
              </div>
              <div className="text-[11px] text-[#9a9a9a]">
                {draftSaveState === "saving" ? (
                  "儲存中…"
                ) : draftSaveState === "saved" ? (
                  <span className="inline-flex items-center gap-1 text-[#16a34a]">
                    <Check className="size-3" />
                    已儲存到雲端
                  </span>
                ) : (
                  "編輯後會自動儲存到雲端"
                )}
              </div>
              {DRAFT_STAGES.map((stage) => {
                const value = drafts[stage.key];
                const hasText = value.trim().length > 0;
                return (
                  <div key={stage.key} className="rounded-xl border border-[#ededed] bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#146ef5]/10 px-2 py-0.5 text-[11px] font-semibold text-[#146ef5]">
                        {stage.label}
                      </span>
                      <span className="text-[10px] text-[#c0c0c0]">{value.length} 字</span>
                    </div>
                    <Textarea
                      value={value}
                      onChange={(e) => handleDraftChange(stage.key, e.target.value)}
                      placeholder={stage.hint}
                      className="min-h-[120px] max-h-[280px] resize-y rounded-lg border-[#e5e5e5] bg-white text-[13px] leading-relaxed focus-visible:ring-1 focus-visible:ring-[#146ef5]/40"
                    />
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          onClick={() => toggleDraftVoice(stage.key)}
                          className={`rounded-full transition-all ${listeningStage === stage.key ? "text-red-500 hover:bg-red-50" : "text-[#5a5a5a] hover:bg-[#f4f4f5]"}`}
                          title={listeningStage === stage.key ? "停止語音輸入" : "語音輸入"}
                          aria-label={
                            listeningStage === stage.key
                              ? `停止語音輸入：${stage.label}`
                              : `語音輸入：${stage.label}`
                          }
                        >
                          {listeningStage === stage.key ? <MicOff className="size-4" /> : <Mic className="size-4" />}
                        </Button>
                        {listeningStage === stage.key && (
                          <span aria-live="polite" className="text-[11px] font-medium text-red-500 animate-pulse">聆聽中…</span>
                        )}
                        {draftVoiceErrorStage === stage.key && draftVoiceError && (
                          <span role="alert" className="text-[11px] font-medium text-red-500">{draftVoiceError.message}</span>
                        )}
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => handleUseDraft(stage.key)}
                        disabled={!hasText}
                        className="rounded-full bg-[#146ef5] px-3 text-xs font-medium text-white transition-all hover:bg-[#0055d4] disabled:bg-[#d8d8d8]"
                      >
                        <MessageSquarePlus className="size-3.5" />
                        與 AI 討論
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Right-side pinned panel */}
      {showPinned && (
        <div className="flex w-80 shrink-0 flex-col border-l border-[#ededed] bg-[#fafafa]">
          <div className="flex h-[57px] shrink-0 items-center justify-between border-b border-[#ededed] bg-white px-4">
            <div className="flex items-center gap-2">
              <Pin className="size-4 text-[#146ef5]" />
              <span className="text-sm font-semibold text-[#080808]">釘選的訊息</span>
            </div>
            <Button type="button" size="icon-sm" variant="ghost" onClick={() => setShowPinned(false)}
              className="rounded-full text-[#5a5a5a] transition-all hover:bg-[#f4f4f5]" title="關閉">
              <X className="size-4" />
            </Button>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {pinnedMessages.length === 0 ? (
              <div className="flex h-full items-center justify-center text-center text-xs text-[#9a9a9a]">
                還沒有釘選任何訊息。<br />點擊訊息下方的釘選圖示即可加入。
              </div>
            ) : (
              pinnedMessages.map((message) => (
                <div key={message.id} className="group/pinned rounded-xl border border-[#ededed] bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${message.role === "user" ? "bg-[#f4f4f5] text-[#5a5a5a]" : "bg-[#146ef5]/10 text-[#146ef5]"}`}>
                      {message.role === "user" ? "你" : "AI"}
                    </span>
                    <div className="flex items-center gap-0.5">
                      <button type="button" onClick={() => handleCopy(message.id, message.text)}
                        className="inline-flex size-7 items-center justify-center rounded-full text-[#9a9a9a] transition-colors hover:bg-[#f4f4f5] hover:text-[#5a5a5a]" title="複製">
                        {copiedId === message.id ? <Check className="size-3.5 text-[#16a34a]" /> : <Copy className="size-3.5" />}
                      </button>
                      <button type="button" onClick={() => togglePin(message.id)}
                        className="inline-flex size-7 items-center justify-center rounded-full text-[#9a9a9a] transition-colors hover:bg-[#f4f4f5] hover:text-[#5a5a5a]" title="取消釘選">
                        <PinOff className="size-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="prose prose-sm max-w-none break-words text-[13px] leading-relaxed [overflow-wrap:anywhere] [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:border-[#e5e5e5] [&_th]:px-1.5 [&_th]:py-0.5 [&_td]:border [&_td]:border-[#e5e5e5] [&_td]:px-1.5 [&_td]:py-0.5">
                    <ReactMarkdown remarkPlugins={MARKDOWN_REMARK_PLUGINS} rehypePlugins={MARKDOWN_REHYPE_PLUGINS} components={MARKDOWN_COMPONENTS}>
                      {message.text}
                    </ReactMarkdown>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
