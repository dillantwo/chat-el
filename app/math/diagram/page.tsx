"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import {
  ArrowUp,
  ChevronLeft,
  ImagePlus,
  Loader2,
  MessageSquare,
  Mic,
  MicOff,
  MousePointerClick,
  PanelRight,
  Save,
  Share2,
  Sparkles,
  Square,
  X,
} from "lucide-react";
import { ChatAttachmentPreview } from "@/components/ChatAttachmentPreview";
import { ChatAvatar } from "@/components/ChatAvatar";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { basePath, stripTextModeLatex } from "@/lib/utils";
import { filterUploadsWithinLimit } from "@/lib/upload-limits";
import { useVoiceInput } from "@/lib/use-voice-input";
import {
  restoreUiMessages,
  serializeUiMessages,
  type SavedChatMessage,
} from "@/lib/math-chat-history";
import {
  GeneratingCodeFeed,
  injectInspector,
  markTargetInPristineHtml,
  sanitizeAiToolHtml,
  type InspectorPathStep,
} from "@/app/math/_components/diagram-runtime";

/**
 * AI 生成圖解 (math topic `ai-diagram`).
 *
 * Three panes: 圖解生成記錄 in the app sidebar (see AppSidebar, which owns the
 * list and talks to this page through window events), the diagram itself in the
 * middle, and the AI chatbot on the right. Every follow-up message in that chat
 * also refines the diagram, which is why the two panes share one composer flow.
 *
 * Roles: only a teacher can generate, edit and save. A student opens what a
 * teacher shared, read-only, and the chat becomes an ordinary maths tutor for
 * them. Both halves are enforced server-side as well — /api/generate-html and
 * the write verbs of /api/html-content reject students.
 */

/** Pointers to the open diagram, so leaving for /math and coming back resumes it. */
const DIAGRAM_SESSION_KEY = "math-diagram-session";
/**
 * The HTML lives under its own key: it is by far the largest field, so blowing
 * the storage quota on it must not take the rest of the session down with it.
 */
const DIAGRAM_HTML_KEY = "math-diagram-html";

interface DiagramSession {
  toolKey?: string | null;
  title?: string | null;
  saved?: boolean;
}

function readDiagramSession(): DiagramSession | null {
  try {
    const raw = sessionStorage.getItem(DIAGRAM_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DiagramSession | null;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function writeDiagramSession(session: DiagramSession) {
  try {
    sessionStorage.setItem(DIAGRAM_SESSION_KEY, JSON.stringify(session));
  } catch {
    // Nothing here is large enough to be worth a retry.
  }
}

function clearDiagramSession() {
  try {
    sessionStorage.removeItem(DIAGRAM_SESSION_KEY);
    sessionStorage.removeItem(DIAGRAM_HTML_KEY);
  } catch {}
}

function readStoredDiagramHtml(): string | null {
  try {
    return sessionStorage.getItem(DIAGRAM_HTML_KEY);
  } catch {
    return null;
  }
}

/**
 * Best effort. A diagram carrying a large embedded data set can outgrow the
 * quota; dropping the copy is acceptable because a *saved* diagram is fetched
 * back by toolKey instead, and an unsaved one was never promised to survive.
 */
function writeStoredDiagramHtml(html: string | null) {
  try {
    if (html) sessionStorage.setItem(DIAGRAM_HTML_KEY, html);
    else sessionStorage.removeItem(DIAGRAM_HTML_KEY);
  } catch {
    try {
      sessionStorage.removeItem(DIAGRAM_HTML_KEY);
    } catch {}
  }
}

/** Reload a saved diagram that was too big to keep in sessionStorage. */
async function fetchSavedDiagramHtml(toolKey: string): Promise<string | null> {
  try {
    const res = await fetch(`${basePath}/api/html-content?toolKey=${encodeURIComponent(toolKey)}`, {
      credentials: "include",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { item?: { html?: string } };
    return json.item?.html ?? null;
  } catch {
    return null;
  }
}

export default function MathDiagramPage() {
  const { user } = useAuth();
  const isTeacher = user?.role === "teacher";
  /**
   * The chat transport is built once, on the first render — before /api/auth/me
   * has answered — so the request builder reads the role through a ref instead
   * of closing over the value it saw then.
   */
  const isTeacherRef = useRef(false);
  useEffect(() => {
    isTeacherRef.current = isTeacher;
  }, [isTeacher]);

  const { messages, setMessages, sendMessage, status, stop } = useChat({
    transport: new DefaultChatTransport({
      api: `${basePath}/api/chat`,
      prepareSendMessagesRequest: ({ id, messages, body, trigger, messageId }) => ({
        body: {
          ...body,
          id,
          messages,
          trigger,
          messageId,
          // Teachers are designing a diagram; students are asking about one, so
          // they get the ordinary maths-tutor prompt instead.
          mode: isTeacherRef.current ? "ai-tool" : "question",
          hasQuestion: false,
          topic: "ai-diagram",
        },
      }),
    }),
    onError: (error) => {
      console.error("[diagram-chat] Error:", error);
    },
  });

  // ── The diagram ──────────────────────────────────────────────────────────
  const [html, setHtml] = useState<string | null>(null);
  const [title, setTitle] = useState<string | null>(null);
  const [toolKey, setToolKey] = useState<string | null>(null);
  const [isShared, setIsShared] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveNameDraft, setSaveNameDraft] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  /** Raw HTML streamed back while the model writes it — shown as a live code feed. */
  const [genCode, setGenCode] = useState("");
  /** The diagram name as soon as the model emits it, before the HTML is finished. */
  const [genTitle, setGenTitle] = useState<string | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [pendingSelection, setPendingSelection] = useState<{
    /** Pristine diagram HTML with the target tagged, or null if it could not be pinned down. */
    markedHtml: string | null;
    label: string;
    /** True when the clicked node is created by the diagram's JavaScript, not by its markup. */
    dynamic: boolean;
  } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // ── The prompt box (first generation) ────────────────────────────────────
  const [promptInput, setPromptInput] = useState("");
  const [promptFiles, setPromptFiles] = useState<File[]>([]);
  const [promptPreviewSrc, setPromptPreviewSrc] = useState<string | null>(null);
  const promptFileInputRef = useRef<HTMLInputElement>(null);
  const promptTextareaRef = useRef<HTMLTextAreaElement>(null);

  // ── The chatbot ──────────────────────────────────────────────────────────
  const [chatVisible, setChatVisible] = useState(true);
  const [input, setInput] = useState("");
  const [chatFiles, setChatFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);

  const isLoading = status === "submitted" || status === "streaming";
  const canSend = (!!input.trim() || chatFiles.length > 0) && !isLoading && !isGenerating;
  const canSubmitPrompt = (!!promptInput.trim() || promptFiles.length > 0) && !isGenerating;

  const {
    isListening,
    error: voiceError,
    stop: stopListening,
    toggle: toggleVoice,
    rebase: rebaseDictation,
  } = useVoiceInput({
    lang: "zh-HK",
    // Chinese doesn't separate words with spaces.
    separator: "",
    getBaseText: () => input,
    onTranscript: setInput,
  });

  const {
    isListening: isPromptListening,
    error: promptVoiceError,
    stop: stopPromptListening,
    toggle: togglePromptVoice,
    rebase: rebasePromptDictation,
  } = useVoiceInput({
    lang: "zh-HK",
    separator: "",
    getBaseText: () => promptInput,
    onTranscript: setPromptInput,
  });

  // Typing while the mic is live: hand the edit to the recogniser as the new
  // baseline, otherwise the next result would revert it.
  const handleInputChange = useCallback(
    (value: string) => {
      setInput(value);
      if (isListening) rebaseDictation(value);
    },
    [isListening, rebaseDictation],
  );

  const handlePromptInputChange = useCallback(
    (value: string) => {
      setPromptInput(value);
      if (isPromptListening) rebasePromptDictation(value);
    },
    [isPromptListening, rebasePromptDictation],
  );

  // ── Session hand-off ─────────────────────────────────────────────────────
  const canPersistRef = useRef(false);

  useEffect(() => {
    const stored = readDiagramSession();
    const storedHtml = readStoredDiagramHtml();

    if (!stored && !storedHtml) {
      canPersistRef.current = true;
      return;
    }

    setToolKey(stored?.toolKey ?? null);
    setTitle(stored?.title ?? null);
    setHasSaved(Boolean(stored?.saved));
    if (storedHtml) setHtml(storedHtml);

    let cancelled = false;
    void (async () => {
      try {
        // A diagram too big for sessionStorage is still in the database.
        if (!storedHtml && stored?.toolKey && stored.saved) {
          const restored = await fetchSavedDiagramHtml(stored.toolKey);
          if (!cancelled && restored) setHtml(restored);
        }
      } finally {
        if (!cancelled) canPersistRef.current = true;
      }
    })();

    return () => {
      cancelled = true;
    };
    // Mount only: this is the session hand-off, not a reaction to state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!canPersistRef.current) return;
    if (!html && !toolKey) {
      clearDiagramSession();
      return;
    }
    writeDiagramSession({ toolKey, title, saved: hasSaved });
  }, [hasSaved, html, title, toolKey]);

  // Kept out of the snapshot above so a quota failure on a large diagram can't
  // cost us the rest of the session.
  useEffect(() => {
    if (!canPersistRef.current) return;
    writeStoredDiagramHtml(html);
  }, [html]);

  // Let the sidebar highlight the record that is open.
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("diagram:active", { detail: { toolKey } }));
  }, [toolKey]);

  const handleChatScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }, []);

  useEffect(() => {
    const container = chatScrollRef.current;
    if (!container) return;
    // Follow the latest message only while the user is pinned to the bottom.
    if (isAtBottomRef.current) container.scrollTop = container.scrollHeight;
  }, [messages]);

  // ── Sidebar actions ──────────────────────────────────────────────────────
  // Refs keep the deps array stable: useChat's setMessages/stop/status
  // references can change between renders.
  const setMessagesRef = useRef(setMessages);
  const stopRef = useRef(stop);
  const statusRef = useRef(status);
  useEffect(() => {
    setMessagesRef.current = setMessages;
  }, [setMessages]);
  useEffect(() => {
    stopRef.current = stop;
  }, [stop]);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const resetDiagram = useCallback(() => {
    const s = statusRef.current;
    if (s === "streaming" || s === "submitted") stopRef.current?.();
    // Both boxes are about to be cleared, so any dictation in flight has to
    // stop: otherwise the next speech result would restore the old text.
    stopListening();
    stopPromptListening();
    setHtml(null);
    setTitle(null);
    setToolKey(null);
    setIsShared(false);
    setHasSaved(false);
    setIsSaving(false);
    setIsGenerating(false);
    setGenCode("");
    setGenTitle(null);
    setSelectMode(false);
    setPendingSelection(null);
    setIsFullscreen(false);
    setMessagesRef.current?.([]);
    setInput("");
    setChatFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setPromptInput("");
    setPromptFiles([]);
    if (promptFileInputRef.current) promptFileInputRef.current.value = "";
    setChatVisible(true);
  }, [stopListening, stopPromptListening]);

  useEffect(() => {
    function handleNew() {
      resetDiagram();
    }

    function handleLoad(event: Event) {
      const detail = (
        event as CustomEvent<{
          item?: {
            toolKey: string;
            title: string;
            html: string;
            chatMessages?: SavedChatMessage[];
            sharedWithStudents?: boolean;
          };
        }>
      ).detail?.item;
      if (!detail) return;

      const s = statusRef.current;
      if (s === "streaming" || s === "submitted") stopRef.current?.();
      stopListening();
      stopPromptListening();

      setHtml(detail.html);
      setTitle(detail.title);
      setToolKey(detail.toolKey);
      setIsShared(Boolean(detail.sharedWithStudents));
      setHasSaved(true);
      setIsSaving(false);
      setIsGenerating(false);
      setGenCode("");
      setGenTitle(null);
      setSelectMode(false);
      setPendingSelection(null);
      setIsFullscreen(false);
      // Students never receive the teacher's transcript (the API strips it), so
      // they start a fresh conversation about the diagram they were shown.
      setMessagesRef.current?.(restoreUiMessages(detail.chatMessages ?? []));
      setInput("");
      setChatFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setPromptInput("");
      setPromptFiles([]);
      if (promptFileInputRef.current) promptFileInputRef.current.value = "";
      setChatVisible(true);
    }

    window.addEventListener("diagram:new", handleNew);
    window.addEventListener("diagram:load", handleLoad);
    return () => {
      window.removeEventListener("diagram:new", handleNew);
      window.removeEventListener("diagram:load", handleLoad);
    };
  }, [resetDiagram, stopListening, stopPromptListening]);

  // ── The preview iframe ───────────────────────────────────────────────────
  // Receive selection events from the sandboxed preview iframe. Origin is
  // opaque ("null") for a sandboxed srcDoc, so we authenticate by contentWindow
  // identity instead of comparing event.origin.
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.source !== iframeRef.current?.contentWindow) return;
      const d = e.data as {
        source?: string;
        type?: string;
        path?: InspectorPathStep[];
        label?: string;
        enabled?: boolean;
      };
      // Fullscreen requests are routed through the parent because iPad/iOS
      // Safari won't grant the native Fullscreen API to a sandboxed iframe.
      // We expand the iframe element itself to fill the viewport instead.
      if (d?.source === "math-ai-fullscreen") {
        if (d.type === "enter") setIsFullscreen(true);
        else if (d.type === "exit") setIsFullscreen(false);
        return;
      }
      if (d?.source !== "math-ai-inspector-tool") return;
      if (d.type === "selected" && Array.isArray(d.path)) {
        // Mark the selection on the pristine source, not on the iframe's
        // hydrated DOM — see markTargetInPristineHtml. Use the sanitised copy
        // because that is exactly the document the iframe parsed, so the child
        // indices line up.
        const base = sanitizeAiToolHtml(html);
        const marked = base ? markTargetInPristineHtml(base, d.path) : null;
        // When the target cannot be pinned down we still keep the label: the
        // edit degrades to a whole-diagram edit that mentions what was clicked,
        // rather than silently dropping the teacher's click.
        setPendingSelection({
          markedHtml: marked?.markedHtml ?? null,
          label: d.label || "選取的元素",
          dynamic: marked ? !marked.exact : true,
        });
        setSelectMode(false);
      } else if (d.type === "mode") {
        setSelectMode(!!d.enabled);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
    // `html` is read when resolving a selection, so the listener has to be
    // re-bound whenever the diagram changes.
  }, [html]);

  // Allow leaving pseudo-fullscreen with the Escape key, and keep the iframe's
  // own fullscreen button label in sync by notifying it that we exited.
  const exitFullscreen = useCallback(() => {
    setIsFullscreen(false);
    iframeRef.current?.contentWindow?.postMessage(
      { source: "math-ai-fullscreen-parent", type: "exited" },
      "*",
    );
  }, []);

  useEffect(() => {
    if (!isFullscreen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") exitFullscreen();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isFullscreen, exitFullscreen]);

  const toggleSelectMode = useCallback(() => {
    setSelectMode((prev) => {
      const next = !prev;
      iframeRef.current?.contentWindow?.postMessage(
        { source: "math-ai-inspector", type: next ? "enable" : "disable" },
        "*",
      );
      return next;
    });
  }, []);

  // ── Generation ───────────────────────────────────────────────────────────
  function fileToDataURL(file: File): Promise<string> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
  }

  async function generate(options: {
    prompt: string;
    imageData?: string;
    currentHtml?: string | null;
    currentTitle?: string | null;
    targetedEdit?: boolean;
    targetLabel?: string;
    targetIsDynamic?: boolean;
  }) {
    setIsGenerating(true);
    setGenCode("");
    setGenTitle(null);

    try {
      const res = await fetch(`${basePath}/api/generate-html`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: options.prompt,
          imageData: options.imageData,
          currentHtml: options.currentHtml,
          currentTitle: options.currentTitle,
          targetedEdit: options.targetedEdit,
          targetLabel: options.targetLabel,
          targetIsDynamic: options.targetIsDynamic,
        }),
      });

      if (!res.ok || !res.body) {
        const detail = await res.json().catch(() => ({}));
        console.error("[generate-html] failed:", {
          status: res.status,
          azureStatus: detail?.statusCode,
          error: detail?.error,
        });
        throw new Error(detail?.error || "Generate HTML failed");
      }

      /**
       * NDJSON progress stream (see the route). The deltas are only for the live
       * code feed — the iframe is swapped in from the "done" event, which is the
       * only HTML the server has sanitised.
       */
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let code = "";
      let lastFlush = 0;
      let finalHtml: string | null = null;
      let finalTitle: string | null = null;
      let streamError: string | null = null;

      const flushCode = () => setGenCode(code);

      const handleEvent = (line: string) => {
        if (!line.trim()) return;
        let evt: { type?: string; text?: string; title?: string; html?: string; error?: string };
        try {
          evt = JSON.parse(line);
        } catch {
          return; // partial or malformed line: ignore
        }

        if (evt.type === "delta" && typeof evt.text === "string") {
          code += evt.text;
          // Throttle re-renders: the model emits many small deltas.
          const now = Date.now();
          if (now - lastFlush > 80) {
            lastFlush = now;
            flushCode();
          }
        } else if (evt.type === "title" && typeof evt.title === "string") {
          setGenTitle(evt.title);
        } else if (evt.type === "done") {
          finalHtml = typeof evt.html === "string" ? evt.html : null;
          finalTitle = typeof evt.title === "string" ? evt.title : null;
        } else if (evt.type === "error") {
          streamError = evt.error ?? "Generate HTML failed";
        }
      };

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let newline = buffer.indexOf("\n");
        while (newline !== -1) {
          handleEvent(buffer.slice(0, newline));
          buffer = buffer.slice(newline + 1);
          newline = buffer.indexOf("\n");
        }
      }
      handleEvent(buffer);
      flushCode();

      if (streamError) throw new Error(streamError);
      if (!finalHtml) throw new Error("Generate HTML returned no document");

      setHtml(finalHtml);
      setTitle(finalTitle);
      setHasSaved(false);
      // A fresh diagram replaces any pending element selection.
      setPendingSelection(null);
      setSelectMode(false);
    } catch (err) {
      console.error("[generate-html] error:", err);
      // Keep the current preview if regeneration fails.
    } finally {
      setIsGenerating(false);
    }
  }

  async function submitPrompt() {
    if (!canSubmitPrompt || !isTeacher) return;
    stopPromptListening();

    const prompt = promptInput.trim() || "（見圖片）";
    // Reading a photographed prompt takes real time, and generate() only raises
    // this once it starts — without it the composer would stay live, and clear
    // itself below, while nothing on screen said anything was happening.
    setIsGenerating(true);

    let files: Array<{ type: "file"; mediaType: string; filename: string; url: string }>;
    try {
      files = await Promise.all(
        promptFiles.map(async (file) => ({
          type: "file" as const,
          mediaType: file.type,
          filename: file.name,
          url: await fileToDataURL(file),
        })),
      );
    } catch {
      setIsGenerating(false);
      return;
    }
    const imageData = files.find((f) => f.mediaType?.startsWith("image/"))?.url;

    setHtml(null);
    setTitle(null);
    setToolKey(null);
    setIsShared(false);
    setHasSaved(false);
    setMessagesRef.current?.([]);

    // The chat summarises what it understood while the HTML is being written.
    sendMessage({ text: prompt, ...(files.length > 0 ? { files } : {}) });
    setPromptInput("");
    setPromptFiles([]);
    if (promptFileInputRef.current) promptFileInputRef.current.value = "";

    await generate({ prompt, imageData });
  }

  // ── Saving / sharing ─────────────────────────────────────────────────────
  function openSaveDialog() {
    if (!html || isSaving || isGenerating) return;
    setSaveNameDraft(title ?? "");
    setSaveDialogOpen(true);
  }

  async function saveDiagram(name: string) {
    const finalName = name.trim();
    if (!html || !finalName || isSaving) return;

    setIsSaving(true);
    try {
      const res = await fetch(`${basePath}/api/html-content`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toolKey,
          title: finalName,
          html,
          chatMessages: serializeUiMessages(messages),
        }),
      });

      if (!res.ok) throw new Error("Save failed");

      const json = await res.json();
      setToolKey(json.toolKey ?? null);
      setIsShared(!!json.sharedWithStudents);
      setTitle(finalName);
      setHasSaved(true);
      setSaveDialogOpen(false);
      window.dispatchEvent(new CustomEvent("diagram:saved"));
    } catch {
      alert("保存失敗，請稍後再試。");
    } finally {
      setIsSaving(false);
    }
  }

  /** Share straight from the diagram, so a teacher need not go via the list. */
  async function toggleShare() {
    if (!toolKey || !hasSaved) return;
    const next = !isShared;
    try {
      const res = await fetch(`${basePath}/api/html-content`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toolKey, sharedWithStudents: next }),
      });
      if (!res.ok) throw new Error("Failed to update sharing");
      setIsShared(next);
      window.dispatchEvent(new CustomEvent("diagram:saved"));
    } catch {
      alert("更新分享狀態失敗，請稍後再試。");
    }
  }

  // ── Chat ─────────────────────────────────────────────────────────────────
  async function doSend() {
    if (!canSend) return;
    if (isListening) stopListening();

    const fileParts = await Promise.all(
      chatFiles.map(async (file) => ({
        type: "file" as const,
        mediaType: file.type,
        filename: file.name,
        url: await fileToDataURL(file),
      })),
    );
    const prompt = input.trim() || "（見圖片）";

    sendMessage({ text: prompt, ...(fileParts.length > 0 ? { files: fileParts } : {}) });

    // Once a diagram exists, every follow-up message from the teacher also
    // refines it. Passing the current HTML/title makes the backend modify the
    // existing diagram (its prompt branches on currentHtml) instead of building
    // a new one. With an element selected, the marked HTML confines the edit to
    // that element.
    if (isTeacher && html) {
      const imageData = fileParts.find((p) => p.mediaType?.startsWith("image/"))?.url;
      void generate({
        prompt,
        imageData,
        currentHtml: pendingSelection?.markedHtml ?? html,
        currentTitle: title,
        targetedEdit: !!pendingSelection?.markedHtml,
        targetLabel: pendingSelection?.label,
        targetIsDynamic: pendingSelection?.dynamic,
      });
    }

    setInput("");
    setChatFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleNewChat() {
    const s = statusRef.current;
    if (s === "streaming" || s === "submitted") stopRef.current?.();
    stopListening();
    setMessagesRef.current?.([]);
    setInput("");
    setChatFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setChatVisible(true);
  }

  function handleChatFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      const picked = Array.from(e.target.files);
      setChatFiles((prev) => [...prev, ...filterUploadsWithinLimit(prev, picked)]);
    }
    // Reset so re-choosing the same photo still fires `change`; `chatFiles`
    // owns the selection from here on.
    e.target.value = "";
  }

  function handlePromptFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      const picked = Array.from(e.target.files);
      setPromptFiles((prev) => [...prev, ...filterUploadsWithinLimit(prev, picked)]);
    }
    e.target.value = "";
  }

  function pastedImages(e: React.ClipboardEvent<HTMLTextAreaElement>): File[] {
    const items = e.clipboardData?.items;
    if (!items) return [];
    const imageFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) {
        const file = items[i].getAsFile();
        if (file) imageFiles.push(file);
      }
    }
    return imageFiles;
  }

  // A restored-but-unnamed diagram still has something on screen, so it must not
  // be labelled as still generating.
  const headerTitle = title ?? genTitle ?? (html ? "AI 生成圖解" : "正在生成圖解");

  return (
    <div className="relative flex flex-1 overflow-hidden bg-white text-[#080808]">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(160deg,_#ffffff_0%,_#f7fbff_45%,_#ffffff_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[radial-gradient(circle_at_top,_rgba(22,163,74,0.12),_transparent_48%)]" />

      {/* ── Middle: the diagram ─────────────────────────────────────────── */}
      <div className="relative flex min-w-0 flex-1 flex-col border-r border-[#d8d8d8]">
        <div className="flex h-[57px] shrink-0 items-center justify-between border-b border-[#d8d8d8] bg-white/95 px-4">
          <div className="flex items-center gap-1">
            <SidebarTrigger />
            <Link
              href="/math"
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ChevronLeft className="size-4" />
              數學科
            </Link>
          </div>
          {!chatVisible && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setChatVisible(true)}
              className="rounded-[4px] border border-[#d8d8d8] bg-white/90 shadow-sm backdrop-blur"
              title="顯示 AI 助手"
            >
              <PanelRight className="size-4" />
            </Button>
          )}
        </div>

        {isGenerating || html ? (
          <div className="flex-1 overflow-auto bg-transparent p-4">
            <div className="mx-auto flex h-full w-full flex-col rounded-[8px] border border-[#d8d8d8] bg-white shadow-[rgba(0,0,0,0)_0px_84px_24px,rgba(0,0,0,0.01)_0px_54px_22px,rgba(0,0,0,0.04)_0px_30px_18px,rgba(0,0,0,0.08)_0px_13px_13px,rgba(0,0,0,0.09)_0px_3px_7px] transition-all">
              <div className="flex items-start justify-between gap-3 border-b border-[#d8d8d8] px-4 py-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[1px] text-[#ababab]">
                    AI generated diagram
                  </p>
                  <p className="truncate text-sm font-semibold text-[#080808]">{headerTitle}</p>
                </div>
                {isTeacher && (
                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={selectMode ? "default" : "outline"}
                      onClick={toggleSelectMode}
                      disabled={!html || isGenerating}
                      title="選取圖解中的某個部分，再用右邊的對話框描述要怎麼修改"
                      className={
                        selectMode
                          ? "rounded-[4px] bg-[#146ef5] text-white hover:bg-[#0055d4]"
                          : "rounded-[4px] border-[#d8d8d8] bg-white text-[#080808] hover:bg-[#f7f7f7]"
                      }
                    >
                      <MousePointerClick className="size-4" />
                      {selectMode ? "點選元素中…" : "選取修改"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={hasSaved ? "outline" : "default"}
                      onClick={openSaveDialog}
                      disabled={!html || isSaving || isGenerating}
                      className={
                        hasSaved
                          ? "rounded-[4px] border-[#d8d8d8] bg-white text-[#080808] hover:bg-[#f7f7f7]"
                          : "rounded-[4px] bg-[#146ef5] text-white hover:bg-[#0055d4]"
                      }
                    >
                      {isSaving ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Save className="size-4" />
                      )}
                      {hasSaved ? "已保存" : "保存"}
                    </Button>
                    {hasSaved && toolKey && (
                      <Button
                        type="button"
                        size="sm"
                        variant={isShared ? "default" : "outline"}
                        onClick={() => void toggleShare()}
                        title={isShared ? "已分享給學生，點擊取消分享" : "分享給學生"}
                        className={
                          isShared
                            ? "rounded-[4px] bg-[#16a34a] text-white hover:bg-[#15803d]"
                            : "rounded-[4px] border-[#d8d8d8] bg-white text-[#080808] hover:bg-[#f7f7f7]"
                        }
                      >
                        <Share2 className="size-4" />
                        {isShared ? "已分享" : "分享"}
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {!html ? (
                /* First generation — there is nothing to keep on screen yet, so
                   show the code as the model writes it. */
                <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
                  <div className="flex items-center gap-2 text-[#5a5a5a]">
                    <Loader2 className="size-4 animate-spin text-[#146ef5]" />
                    <span className="text-sm font-medium">AI 正在根據你的要求生成圖解...</span>
                    {genCode.length > 0 && (
                      <span className="ml-auto text-xs tabular-nums text-[#ababab]">
                        已生成 {genCode.length.toLocaleString()} 字元
                      </span>
                    )}
                  </div>
                  <GeneratingCodeFeed code={genCode} className="min-h-0 flex-1" />
                </div>
              ) : (
                /* When modifying an existing diagram, keep the current HTML
                   rendered until the new version arrives, so the preview never
                   goes blank. */
                <div className="relative min-h-0 flex-1">
                  <iframe
                    ref={iframeRef}
                    srcDoc={injectInspector(sanitizeAiToolHtml(html))}
                    sandbox="allow-scripts"
                    allow="fullscreen"
                    allowFullScreen
                    className={
                      isFullscreen
                        ? "fixed inset-0 z-[2147483647] h-screen w-screen border-0 bg-white"
                        : "h-full min-h-0 w-full rounded-b-[8px]"
                    }
                    title={title ?? "AI 生成圖解"}
                  />
                  {isGenerating && (
                    <>
                      {/* Pulsing blue ring around the whole preview */}
                      <div className="pointer-events-none absolute inset-0 z-10 animate-pulse rounded-b-[8px] ring-4 ring-inset ring-[#146ef5]/70" />
                      {/* Dimmed backdrop + clear status card */}
                      <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-b-[8px] bg-white/55 p-4 backdrop-blur-[2px]">
                        <div className="pointer-events-auto flex w-full max-w-[560px] flex-col items-center gap-3 rounded-[12px] border border-[#146ef5]/30 bg-white px-7 py-5 text-center shadow-[0_8px_30px_rgba(20,110,245,0.18)]">
                          <Loader2 className="size-9 animate-spin text-[#146ef5]" />
                          <div className="space-y-0.5">
                            <p className="text-sm font-semibold text-[#080808]">AI 正在修改圖解中…</p>
                            <p className="text-xs text-[#5a5a5a]">
                              完成後會自動替換，原本的圖解會先保留
                            </p>
                          </div>
                          <GeneratingCodeFeed code={genCode} className="max-h-40 w-full" />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : isTeacher ? (
          /* ── Teacher, nothing open yet: the prompt box ─────────────── */
          <div className="flex-1 overflow-y-auto p-6">
            <div className="flex flex-col items-center justify-center rounded-[8px] border border-dashed border-[#d8d8d8] bg-white/70 px-4 py-10 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-[8px] bg-[#16a34a]/10 text-[#16a34a]">
                <Sparkles className="size-7" />
              </div>
              <p className="text-lg font-semibold text-[#080808]">輸入要求讓 AI 為你生成圖解</p>
              <p className="mt-1.5 mb-7 text-sm text-[#5a5a5a]">
                描述你想要的圖解內容、呈現方式或學習目標；生成後可以在右邊繼續對話修改
              </p>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void submitPrompt();
                }}
                className="w-full max-w-3xl"
              >
                <div className="relative w-full rounded-[8px] border border-[#d8d8d8] bg-white shadow-[0px_30px_18px_rgba(0,0,0,0.04),0px_13px_13px_rgba(0,0,0,0.08),0px_3px_7px_rgba(0,0,0,0.09)] transition-all focus-within:border-[#146ef5] focus-within:shadow-[0px_30px_18px_rgba(20,110,245,0.09),0px_13px_13px_rgba(20,110,245,0.14),0px_3px_7px_rgba(20,110,245,0.2)]">
                  <ChatAttachmentPreview
                    files={promptFiles}
                    onRemove={(index) =>
                      setPromptFiles((prev) => prev.filter((_, i) => i !== index))
                    }
                    onPreview={(url) => setPromptPreviewSrc(url)}
                    variant="square"
                    thumbnailSize="lg"
                    className="px-4 pt-3"
                  />

                  <Textarea
                    ref={promptTextareaRef}
                    placeholder="輸入要求讓 AI 為你生成圖解，例如：用棒形圖呈現 135 張椅子平均分成 9 排（可直接粘貼圖片）"
                    value={promptInput}
                    onChange={(e) => handlePromptInputChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void submitPrompt();
                      }
                    }}
                    onPaste={(e) => {
                      const images = pastedImages(e);
                      if (images.length === 0) return;
                      e.preventDefault();
                      setPromptFiles((prev) => [
                        ...prev,
                        ...filterUploadsWithinLimit(prev, images),
                      ]);
                    }}
                    disabled={isGenerating}
                    className="min-h-[140px] resize-none border-0 bg-transparent px-6 pt-5 pb-16 text-left text-xl font-medium leading-[1.6] tracking-[-0.01em] text-[#080808] shadow-none placeholder:text-[#ababab] focus-visible:ring-0"
                  />

                  <input
                    ref={promptFileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handlePromptFileChange}
                    className="hidden"
                  />

                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => promptFileInputRef.current?.click()}
                        disabled={isGenerating}
                        className="rounded-[4px] border border-[#d8d8d8] bg-white text-[#080808] transition-all hover:translate-x-[2px] hover:border-[#898989] hover:bg-white hover:text-[#080808]"
                      >
                        <ImagePlus className="size-4 text-[#5a5a5a]" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={togglePromptVoice}
                        disabled={isGenerating}
                        className={`rounded-[4px] border bg-white transition-all hover:translate-x-[2px] hover:bg-white ${
                          isPromptListening
                            ? "border-red-400 text-red-500 hover:border-red-500 hover:text-red-600"
                            : "border-[#d8d8d8] text-[#080808] hover:border-[#898989] hover:text-[#080808]"
                        }`}
                        title={isPromptListening ? "停止語音輸入" : "語音輸入"}
                        aria-label={isPromptListening ? "停止語音輸入" : "語音輸入"}
                      >
                        {isPromptListening ? (
                          <MicOff className="size-4" />
                        ) : (
                          <Mic className="size-4 text-[#5a5a5a]" />
                        )}
                      </Button>
                      {isPromptListening && (
                        <span aria-live="polite" className="text-[12px] font-medium text-red-500 animate-pulse">
                          聆聽中…
                        </span>
                      )}
                      {!isPromptListening && promptVoiceError && (
                        <span role="alert" className="text-[12px] font-medium text-red-500">
                          {promptVoiceError.message}
                        </span>
                      )}
                    </div>

                    <Button
                      type="submit"
                      size="icon"
                      className="rounded-[4px] border border-transparent bg-[#146ef5] text-white shadow-[0_8px_20px_rgba(20,110,245,0.34)] transition-all hover:translate-x-[6px] hover:bg-[#0055d4] hover:shadow-[0_10px_24px_rgba(20,110,245,0.44)]"
                      disabled={!canSubmitPrompt}
                    >
                      {isGenerating ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <ArrowUp className="size-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </form>
            </div>

            {promptPreviewSrc && (
              <div
                className="fixed inset-0 z-50 flex cursor-zoom-out items-center justify-center bg-black/70"
                onClick={() => setPromptPreviewSrc(null)}
              >
                <button
                  className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-full bg-white text-[#080808] transition-colors hover:bg-white/85"
                  onClick={() => setPromptPreviewSrc(null)}
                >
                  <X className="size-5" />
                </button>
                <img
                  src={promptPreviewSrc}
                  alt="Preview"
                  className="max-h-[90vh] max-w-[90vw] rounded-[8px] object-contain"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            )}
          </div>
        ) : (
          /* ── Student, nothing open yet ─────────────────────────────── */
          <div className="flex flex-1 items-center justify-center p-6">
            <div className="flex max-w-md flex-col items-center rounded-[8px] border border-dashed border-[#d8d8d8] bg-white/70 px-6 py-12 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-[8px] bg-[#16a34a]/10 text-[#16a34a]">
                <Sparkles className="size-7" />
              </div>
              <p className="text-lg font-semibold text-[#080808]">選擇老師分享的圖解</p>
              <p className="mt-1.5 text-sm text-[#5a5a5a]">
                左邊的「圖解記錄」列出老師分享給你的圖解。打開一個，就可以一邊看圖解，一邊向右邊的 AI
                助手提問。
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Right: the AI chatbot ───────────────────────────────────────── */}
      {chatVisible && (
        <div className="relative flex w-[360px] shrink-0 flex-col min-h-0 bg-white/95">
          <div className="border-b border-[#d8d8d8] px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-[4px] bg-[#146ef5] text-white">
                  <MessageSquare className="size-4" />
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[1px] text-[#ababab]">
                    {isTeacher ? "Diagram assistant" : "Math assistant"}
                  </p>
                  <p className="text-sm font-semibold text-[#080808]">AI Chatbot</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  onClick={handleNewChat}
                  className="rounded-[4px] border border-transparent bg-[#146ef5] px-2.5 text-xs font-semibold text-white shadow-[0_6px_16px_rgba(20,110,245,0.28)] transition-all hover:bg-[#0055d4] hover:shadow-[0_8px_20px_rgba(0,85,212,0.34)]"
                  title="新建聊天"
                >
                  New Chat
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setChatVisible(false)}
                  className="rounded-[4px]"
                  title="隱藏 AI 助手"
                >
                  <PanelRight className="size-4" />
                </Button>
              </div>
            </div>
          </div>

          <div
            ref={chatScrollRef}
            onScroll={handleChatScroll}
            className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-[linear-gradient(180deg,_rgba(20,110,245,0.03)_0%,_rgba(255,255,255,1)_35%)] px-4 py-4"
          >
            {messages.length === 0 && (
              <p className="px-1 py-6 text-center text-sm text-[#5a5a5a]">
                {isTeacher
                  ? html
                    ? "描述想改哪裏，AI 就會即時修改上面的圖解。"
                    : "先在左邊輸入要求生成圖解，之後可以在這裏繼續修改。"
                  : "有不明白的地方，可以在這裏問 AI 助手。"}
              </p>
            )}
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex items-start gap-2 ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {message.role === "assistant" && (
                  <ChatAvatar
                    role="assistant"
                    className="h-8 w-8 rounded-[4px] shadow-[2px_2px_0px_#080808]"
                  />
                )}
                <div
                  className={`min-w-0 max-w-[85%] rounded-[8px] px-3 py-2 text-sm leading-relaxed shadow-[2px_2px_0px_#080808] ${
                    message.role === "user"
                      ? "bg-[#146ef5] text-white"
                      : "border border-[#d8d8d8] bg-white text-[#080808]"
                  }`}
                >
                  {message.parts.some((p) => p.type === "file") && (
                    <div className="not-prose mb-1.5 flex flex-wrap gap-1.5">
                      {message.parts
                        .filter(
                          (
                            p,
                          ): p is {
                            type: "file";
                            mediaType: string;
                            url: string;
                            filename?: string;
                          } => p.type === "file" && p.mediaType.startsWith("image/"),
                        )
                        .map((filePart, i) => (
                          <img
                            key={i}
                            src={filePart.url}
                            alt={filePart.filename ?? "uploaded image"}
                            className="max-h-[200px] max-w-[200px] rounded-[4px] border border-white/30 object-contain"
                          />
                        ))}
                    </div>
                  )}
                  {message.parts
                    .filter((part): part is { type: "text"; text: string } => part.type === "text")
                    .map((part, i) =>
                      message.role === "assistant" ? (
                        <div
                          key={i}
                          className="prose prose-sm max-w-none break-words prose-p:my-2 prose-li:my-1 prose-headings:my-2 [overflow-wrap:anywhere] [&_.katex-display]:max-w-full [&_.katex-display]:overflow-x-auto [&_.katex-display]:overflow-y-hidden [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_code]:break-words"
                        >
                          <ReactMarkdown
                            remarkPlugins={[remarkMath]}
                            rehypePlugins={[[rehypeKatex, { strict: false }]]}
                          >
                            {part.text}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <div
                          key={i}
                          className="prose prose-sm w-full max-w-none overflow-hidden break-words prose-invert prose-p:my-1 [overflow-wrap:anywhere] [&_.katex-display]:max-w-full [&_.katex-display]:overflow-x-auto [&_.katex-display]:overflow-y-hidden [&_.katex]:text-white"
                        >
                          <ReactMarkdown
                            remarkPlugins={[remarkMath]}
                            rehypePlugins={[[rehypeKatex, { strict: false }]]}
                          >
                            {stripTextModeLatex(part.text)}
                          </ReactMarkdown>
                        </div>
                      ),
                    )}
                </div>
                {message.role === "user" && (
                  <ChatAvatar
                    role="user"
                    className="h-8 w-8 rounded-[4px] border border-[#d8d8d8] bg-white"
                  />
                )}
              </div>
            ))}

            {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
              <div className="flex items-start justify-start gap-2">
                <ChatAvatar
                  role="assistant"
                  className="h-8 w-8 rounded-[4px] shadow-[2px_2px_0px_#080808]"
                />
                <div className="rounded-[8px] border border-[#d8d8d8] bg-white px-3 py-2 text-sm text-[#5a5a5a]">
                  <span className="animate-pulse">思考中...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <div className="border-t border-[#d8d8d8] bg-white px-3 py-3">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void doSend();
              }}
            >
              {pendingSelection && (
                <div className="mb-2 flex items-center gap-2 rounded-[6px] border border-[#146ef5]/30 bg-[#146ef5]/5 px-2.5 py-1.5 text-xs text-[#146ef5]">
                  <MousePointerClick className="size-3.5 shrink-0" />
                  <span className="min-w-0 flex-1 truncate font-medium" title={pendingSelection.label}>
                    將修改：{pendingSelection.label}
                    {pendingSelection.dynamic && (
                      <span className="ml-1 font-normal text-[#146ef5]/70">
                        （由程式生成，會改生成邏輯）
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPendingSelection(null)}
                    className="flex size-4 shrink-0 items-center justify-center rounded-full text-[#146ef5] hover:bg-[#146ef5]/15"
                    title="取消選取"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              )}
              <div className="relative w-full rounded-[8px] border border-[#d8d8d8] bg-white shadow-[rgba(0,0,0,0)_0px_84px_24px,rgba(0,0,0,0.01)_0px_54px_22px,rgba(0,0,0,0.04)_0px_30px_18px,rgba(0,0,0,0.08)_0px_13px_13px,rgba(0,0,0,0.09)_0px_3px_7px]">
                <ChatAttachmentPreview
                  files={chatFiles}
                  onRemove={(index) => setChatFiles((prev) => prev.filter((_, i) => i !== index))}
                  variant="square"
                />

                <Textarea
                  placeholder={
                    pendingSelection
                      ? "描述要怎麼修改選取的部分...（可直接粘貼圖片）"
                      : isTeacher
                        ? "針對這個圖解繼續提問或要求修改...（可直接粘貼圖片）"
                        : "針對這個圖解提問...（可直接粘貼圖片）"
                  }
                  value={input}
                  onChange={(e) => handleInputChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void doSend();
                    }
                  }}
                  onPaste={(e) => {
                    const images = pastedImages(e);
                    if (images.length === 0) return;
                    e.preventDefault();
                    setChatFiles((prev) => [...prev, ...filterUploadsWithinLimit(prev, images)]);
                  }}
                  className="max-h-[160px] min-h-[58px] resize-none overflow-y-auto border-0 bg-transparent px-3 pb-10 pt-3 text-sm shadow-none focus-visible:ring-0"
                />

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleChatFileChange}
                  className="hidden"
                />

                <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => fileInputRef.current?.click()}
                      className="rounded-[4px] border border-[#d8d8d8] bg-white text-[#080808] transition-all hover:border-[#898989] hover:bg-white"
                      title="上傳圖片"
                    >
                      <ImagePlus className="size-3.5 text-[#5a5a5a]" />
                    </Button>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      onClick={toggleVoice}
                      className={`rounded-[4px] border bg-white transition-all hover:bg-white ${
                        isListening
                          ? "border-red-400 text-red-500 hover:border-red-500 hover:text-red-600"
                          : "border-[#d8d8d8] text-[#080808] hover:border-[#898989] hover:text-[#080808]"
                      }`}
                      title={isListening ? "停止語音輸入" : "語音輸入"}
                      aria-label={isListening ? "停止語音輸入" : "語音輸入"}
                    >
                      {isListening ? (
                        <MicOff className="size-3.5" />
                      ) : (
                        <Mic className="size-3.5 text-[#5a5a5a]" />
                      )}
                    </Button>
                    {isListening && (
                      <span aria-live="polite" className="text-[11px] font-medium text-red-500 animate-pulse">
                        聆聽中…
                      </span>
                    )}
                    {!isListening && voiceError && (
                      <span role="alert" className="text-[11px] font-medium text-red-500">
                        {voiceError.message}
                      </span>
                    )}
                  </div>
                  {isLoading ? (
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="outline"
                      className="rounded-[4px]"
                      onClick={stop}
                    >
                      <Square className="size-3" />
                    </Button>
                  ) : (
                    <Button
                      type="submit"
                      size="icon-sm"
                      className="rounded-[4px] bg-[#146ef5] text-white hover:bg-[#0055d4]"
                      disabled={!canSend}
                    >
                      <ArrowUp className="size-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Save dialog — asks the teacher to name the diagram before saving */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>保存圖解</DialogTitle>
            <DialogDescription>
              請為這個 AI 生成的圖解命名，方便日後在「圖解記錄」中尋找。
            </DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            value={saveNameDraft}
            onChange={(e) => setSaveNameDraft(e.target.value)}
            placeholder="請輸入圖解名稱"
            maxLength={80}
            onKeyDown={(e) => {
              if (e.key === "Enter" && saveNameDraft.trim() && !isSaving) {
                e.preventDefault();
                void saveDiagram(saveNameDraft);
              }
            }}
          />
          <DialogFooter className="flex-row justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setSaveDialogOpen(false)}
              disabled={isSaving}
              className="rounded-[4px] border-[#d8d8d8] bg-white text-[#080808] hover:bg-[#f7f7f7]"
            >
              取消
            </Button>
            <Button
              type="button"
              onClick={() => void saveDiagram(saveNameDraft)}
              disabled={!saveNameDraft.trim() || isSaving}
              className="rounded-[4px] bg-[#146ef5] text-white hover:bg-[#0055d4]"
            >
              {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
