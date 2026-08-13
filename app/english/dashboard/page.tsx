"use client";

import { Suspense, useRef, useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowUp,
  Square,
  BookOpen,
  Compass,
  Sparkles,
  Mic,
  MicOff,
  ImagePlus,
  X,
  ChevronLeft,
  PanelRight,
  Copy,
  Check,
  Pin,
  PinOff,
} from "lucide-react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { basePath } from "@/lib/utils";
import { filterUploadsWithinLimit } from "@/lib/upload-limits";
import {
  createEnglishChatId,
  upsertEnglishChatHistory,
  type EnglishChatHistoryItem,
  type SavedChatMessage,
} from "@/lib/english-chat-history";
import { pickLocationPair, type LocationPair } from "@/lib/english-prompts";
import LocationDirectionMap from "@/components/LocationDirectionMap";

const API_ENDPOINT = "/api/english-location-direction";
const TOPIC_ID = "location-direction";
const DEFAULT_TITLE = "English Chat";

type ChatImage = { mediaType: string; dataUrl: string; filename?: string };
type ChatMsg = {
  id: string;
  role: "user" | "assistant";
  text: string;
  images?: ChatImage[];
};

// Builds the displayed task prompt for a concrete [A] → [B] pair.
const taskTemplates: Record<number, (a: string, b: string) => string> = {
  1: (a, b) => `Let us start Task 1. Look at the map. How can I go from the ${a} to the ${b}? Use prepositional phrases to describe the direction.`,
  2: (a, b) => `Let us start Task 2. Look at the map. How can I go from the ${a} to the ${b}? Write short sentences with the prepositional phrases you learned.`,
  3: (a, b) => `Let us start Task 3. Look at the map. How can I go from the ${a} to the ${b}? Write more than one sentence and use linking words.`,
  4: (a, b) => `Let us start Task 4. Look at the map. How can I go from the ${a} to the ${b}? Write a complete paragraph with a topic sentence and linking words.`,
};

const TASK_5_PROMPT =
  "Let us start Task 5. Please: 1) Draw a map of the neighborhood from your home to school. 2) Upload your drawing.";

// The opening message is deterministic, so we write it locally instead of
// asking the model to generate it. That saves a full LLM round-trip (~4k prompt
// tokens) every time a student picks a task. The wording must stay in sync with
// the "Opening sequence" blocks in lib/english-prompts.ts.
const OPENING_GREETING = "Great to see you!";

const TASK_5_OPENING = `${OPENING_GREETING} Let us start Task 5. Please:

1. Draw a map of the neighborhood from your home to school.
2. Upload your drawing.`;

function buildOpeningMessage(taskId: number, pair: LocationPair | null): string {
  if (taskId === 5) return TASK_5_OPENING;
  const template = taskTemplates[taskId];
  if (!template || !pair) return `${OPENING_GREETING} Let us start Task ${taskId}.`;
  return `${OPENING_GREETING} ${template(pair.from, pair.to)}`;
}

const tasks = [
  { id: 1, label: "Task 1" },
  { id: 2, label: "Task 2" },
  { id: 3, label: "Task 3" },
  { id: 4, label: "Task 4" },
  { id: 5, label: "Task 5" },
];

// The AI sometimes emits its correction table flattened onto a single line
// (header, separator and rows glued together), which react-markdown/remark-gfm
// then shows as raw "| ... |" text instead of a table. This rebuilds such a
// flattened GFM table into proper multi-line markdown so it renders. Well-formed
// tables (each row already on its own line) are returned unchanged.
function normalizeAiTables(text: string): string {
  if (!text || !text.includes("|")) return text;
  const sepRe = /\|(?:\s*:?-{3,}:?\s*\|)+/;
  if (!sepRe.test(text)) return text;
  return text
    .split("\n")
    .map((line) => rebuildTableLine(line, sepRe))
    .join("\n");
}

function rebuildTableLine(line: string, sepRe: RegExp): string {
  const m = sepRe.exec(line);
  if (!m) return line;
  const sep = m[0];
  const cols = (sep.match(/-{3,}/g) || []).length;
  if (cols < 1) return line;

  const before = line.slice(0, m.index);
  const after = line.slice(m.index + sep.length);

  // Well-formed separator (already on its own line): nothing glued -> leave it.
  if (!before.includes("|") && after.trim().length === 0) return line;

  // Header = the last (cols + 1) pipes of `before`; anything earlier is prose.
  const pipeIdx: number[] = [];
  for (let i = 0; i < before.length; i++) if (before[i] === "|") pipeIdx.push(i);
  let prose = before;
  let header = "";
  if (pipeIdx.length >= cols + 1) {
    const start = pipeIdx[pipeIdx.length - (cols + 1)];
    prose = before.slice(0, start).trimEnd();
    header = before.slice(start);
  } else if (pipeIdx.length > 0) {
    prose = before.slice(0, pipeIdx[0]).trimEnd();
    header = before.slice(pipeIdx[0]);
  }

  const headerCells = header.split("|").map((s) => s.trim()).filter((s) => s.length > 0);

  // Split the glued data rows into cells WITHOUT dropping the empty ones: a
  // correction row may legitimately have an empty cell (a missing step has no
  // "Original" text), and dropping it would shift every following cell up a
  // column. The empty segment created by two rows being glued together
  // ("...x |" + "| y...") is skipped structurally, one row at a time.
  const segments = after.split("|").map((s) => s.trim());
  if (segments.length && segments[0] === "") segments.shift();
  if (segments.length && segments[segments.length - 1] === "") segments.pop();

  const rows: string[] = [];
  let i = 0;
  while (i + cols <= segments.length) {
    rows.push("| " + segments.slice(i, i + cols).join(" | ") + " |");
    i += cols;
    // Row boundary: an empty segment followed by at least one more full row.
    if (segments[i] === "" && segments.length - (i + 1) >= cols) i += 1;
  }
  const remainder = segments.slice(i).filter((s) => s.length > 0);

  const headerLine = "| " + headerCells.join(" | ") + " |";
  const sepLine = "| " + Array(cols).fill("---").join(" | ") + " |";

  const parts: string[] = [];
  if (prose.trim().length) parts.push(prose);
  parts.push("");
  parts.push(headerLine);
  parts.push(sepLine);
  parts.push(...rows);
  parts.push("");
  if (remainder.length) parts.push(remainder.join(" "));
  return parts.join("\n");
}

export default function EnglishDashboardPage() {
  return (
    <Suspense>
      <EnglishDashboardContent />
    </Suspense>
  );
}

function EnglishDashboardContent() {
  const searchParams = useSearchParams();
  const topic = searchParams.get("topic") || TOPIC_ID;

  // Keep the current task id in a ref so the request body always sees the
  // latest selection without recreating callbacks.
  const selectedTaskRef = useRef<number | null>(null);

  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [status, setStatus] = useState<"idle" | "submitted" | "streaming">("idle");
  const [input, setInput] = useState("");
  const [selectedTask, setSelectedTask] = useState<number | null>(null);
  const [taskPrompt, setTaskPrompt] = useState<string | null>(null);
  const [locationPair, setLocationPair] = useState<LocationPair | null>(null);
  const [chatFiles, setChatFiles] = useState<File[]>([]);
  // Task 5: the map image the student uploaded (shown in the map panel and sent
  // to the chatbot so its questions relate to the student's own drawing).
  const [task5Map, setTask5Map] = useState<ChatImage | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [chatVisible, setChatVisible] = useState(true);
  const [currentChatId, setCurrentChatId] = useState(() => createEnglishChatId());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [showPinned, setShowPinned] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const handleChatScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }, []);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // When a chat is loaded from history we don't want the auto-save effect to
  // re-save it (which would bump updatedAt and re-sort the list to the top).
  const skipSaveRef = useRef(false);

  useEffect(() => {
    selectedTaskRef.current = selectedTask;
  }, [selectedTask]);

  // Broadcast the active chat id so the sidebar can highlight the open item.
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("english-chat:active", { detail: { id: currentChatId } })
    );
  }, [currentChatId]);

  const locationPairRef = useRef<LocationPair | null>(null);
  useEffect(() => {
    locationPairRef.current = locationPair;
  }, [locationPair]);

  const isLoading = status === "submitted" || status === "streaming";
  const canSend = (!!input.trim() || chatFiles.length > 0) && !isLoading;
  const pinnedMessages = messages.filter((m) => pinnedIds.includes(m.id));



  useEffect(() => {
    const container = chatScrollRef.current;
    if (!container) return;
    // Follow the latest message only while the user is pinned to the bottom.
    if (isAtBottomRef.current) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    return () => { recognitionRef.current?.stop(); };
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus("idle");
  }, []);

  const handleCopy = useCallback(async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
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

  // Starts a blank conversation. With a task id it selects that task and seeds
  // the fixed opening message; with null it clears the task selection too.
  // Shared by the task pills and "New Chat".
  const resetConversationForTask = useCallback((id: number | null) => {
    setInput("");
    setChatFiles([]);
    setTask5Map(null);
    setPinnedIds([]);
    setShowPinned(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setCurrentChatId(createEnglishChatId());
    setChatVisible(true);
    setStatus("idle");

    if (id == null) {
      setSelectedTask(null);
      setTaskPrompt(null);
      setLocationPair(null);
      selectedTaskRef.current = null;
      locationPairRef.current = null;
      setMessages([]);
      return;
    }

    // Tasks 1–4 have a fixed [A]/[B] pair, so re-deriving it here gives the
    // same locations the student was already working on.
    const pair = id === 5 ? null : pickLocationPair(id);
    setSelectedTask(id);
    setLocationPair(pair);
    setTaskPrompt(
      id === 5 ? TASK_5_PROMPT : pair ? taskTemplates[id](pair.from, pair.to) : null,
    );
    // Keep the refs in sync immediately — the effects that mirror them run too
    // late for a send that happens right after this.
    selectedTaskRef.current = id;
    locationPairRef.current = pair;
    setMessages([
      { id: `a-${Date.now()}`, role: "assistant", text: buildOpeningMessage(id, pair) },
    ]);
  }, []);

  const handleNewChat = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    // If the student is inside a task, "New Chat" restarts that task instead of
    // dropping them back to the no-task state: same task, same map, fresh
    // conversation. With no task selected it is a full reset.
    resetConversationForTask(selectedTaskRef.current);
  }, [resetConversationForTask]);

  // Listen for sidebar "New Chat" button
  useEffect(() => {
    function onNewChat() {
      handleNewChat();
    }
    window.addEventListener("dashboard:new-chat", onNewChat);
    return () => window.removeEventListener("dashboard:new-chat", onNewChat);
  }, [handleNewChat]);

  // Listen for sidebar history item click
  useEffect(() => {
    function onLoadChat(event: Event) {
      const detail = (event as CustomEvent<{ item: EnglishChatHistoryItem }>).detail?.item;
      if (!detail || detail.topic !== TOPIC_ID) return;
      abortRef.current?.abort();
      abortRef.current = null;
      // Loading an existing chat must not trigger a re-save.
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
      setSelectedTask(detail.selectedTask ?? null);
      // The chosen [A]/[B] live in the saved conversation, so we don't show a
      // (possibly stale) task prompt card on reload.
      setTaskPrompt(null);
      setLocationPair(null);
      // For Task 5, restore the uploaded map from the last user image so the
      // map panel shows the student's own drawing again.
      if (detail.selectedTask === 5) {
        const lastImage = [...restored]
          .reverse()
          .find((m) => m.role === "user" && m.images && m.images.length > 0)
          ?.images?.[0];
        setTask5Map(lastImage ?? null);
      } else {
        setTask5Map(null);
      }
      setInput("");
      setChatFiles([]);
      setStatus("idle");
      setPinnedIds([]);
      setShowPinned(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setChatVisible(true);
    }
    window.addEventListener("english-chat:load", onLoadChat);
    return () => window.removeEventListener("english-chat:load", onLoadChat);
  }, []);

  // Auto-save chat history
  useEffect(() => {
    if (skipSaveRef.current) {
      skipSaveRef.current = false;
      return;
    }
    if (messages.length === 0) return;
    if (status === "streaming" || status === "submitted") return;

    const firstUserText = messages.find((m) => m.role === "user")?.text;
    const title = firstUserText ? firstUserText.slice(0, 50) : DEFAULT_TITLE;

    const savedMessages: SavedChatMessage[] = messages.map((m) => ({
      id: m.id,
      role: m.role,
      parts: [
        ...(m.text ? [{ type: "text" as const, text: m.text }] : []),
        ...(m.images ?? []).map((img) => ({ type: "file" as const, url: img.dataUrl, mediaType: img.mediaType, filename: img.filename })),
      ],
    }));

    void upsertEnglishChatHistory({
      id: currentChatId,
      title,
      topic: TOPIC_ID,
      selectedTask,
      messages: savedMessages,
      updatedAt: new Date().toISOString(),
    });
  }, [currentChatId, messages, status, selectedTask]);

  function stopListening() {
    recognitionRef.current?.stop();
    setIsListening(false);
  }

  function toggleVoice() {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      alert('Your browser does not support voice input. Please use Chrome or Edge.');
      return;
    }
    if (isListening) { stopListening(); return; }
    const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) return;
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = 'en-US';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setInput(transcript);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }

  function fileToDataURL(file: File): Promise<string> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
  }

  type PayloadMessage = {
    role: "user" | "assistant";
    text: string;
    images?: { mediaType: string; data: string }[];
  };

  // Streams an assistant reply (with typewriter effect) into the message that
  // matches `assistantId`. Shared by manual sends and task kickoffs.
  async function runStream(
    assistantId: string,
    payloadMessages: PayloadMessage[],
    controller: AbortController,
    ctx: { taskId: number | null; pair: LocationPair | null },
  ) {
    try {
      const res = await fetch(`${basePath}${API_ENDPOINT}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: payloadMessages,
          taskId: ctx.taskId,
          locationA: ctx.pair?.from ?? null,
          locationB: ctx.pair?.to ?? null,
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => "");
        setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, text: `(Error) ${errText || res.statusText}` } : m));
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
          setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, text: snapshot } : m));
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
              setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, text: target } : m));
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
        setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, text: error instanceof Error ? `(Error) ${error.message}` : "(Error) Unknown error" } : m));
      } else {
        setMessages((prev) => prev.filter((m) => m.id !== assistantId || m.text));
      }
    } finally {
      abortRef.current = null;
      setStatus("idle");
    }
  }

  // Switching tasks resets the conversation and seeds the chatbot with the new
  // task instructions. The opening message is built locally (see
  // buildOpeningMessage) — no LLM call, so picking a task costs zero tokens.
  function startTask(id: number) {
    abortRef.current?.abort();
    abortRef.current = null;
    if (isListening) stopListening();
    resetConversationForTask(id);
  }

  async function doSend() {
    if (!canSend) return;
    if (isListening) stopListening();

    const images: ChatImage[] = await Promise.all(
      chatFiles.map(async (file) => ({
        mediaType: file.type,
        dataUrl: await fileToDataURL(file),
        filename: file.name,
      }))
    );

    const userText = input.trim() || "(see image)";
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

    const payloadMessages: PayloadMessage[] = nextMessages.map((message) => ({
      role: message.role,
      text: message.text,
      ...(message.images && message.images.length > 0
        ? { images: message.images.map((image) => ({ mediaType: image.mediaType, data: image.dataUrl })) }
        : {}),
    }));

    await runStream(assistantMsg.id, payloadMessages, controller, {
      taskId: selectedTaskRef.current,
      pair: locationPairRef.current,
    });
  }

  // Task 5: the student uploads their own map in the map panel. We show it as
  // the map, add it to the conversation as an image, and let the chatbot ask a
  // direction question based on that specific drawing.
  async function handleTask5MapUpload(file: File) {
    if (isLoading) return;
    if (filterUploadsWithinLimit([], [file], "en").length === 0) return;
    if (isListening) stopListening();

    const dataUrl = await fileToDataURL(file);
    const image: ChatImage = { mediaType: file.type, dataUrl, filename: file.name };
    setTask5Map(image);

    abortRef.current?.abort();

    const userMsg: ChatMsg = {
      id: `u-${Date.now()}`,
      role: "user",
      text: "Here is my map. It shows the way from my home to school.",
      images: [image],
    };
    const assistantMsg: ChatMsg = { id: `a-${Date.now()}`, role: "assistant", text: "" };

    const nextMessages = [...messages, userMsg];
    setMessages([...nextMessages, assistantMsg]);
    setStatus("submitted");

    const controller = new AbortController();
    abortRef.current = controller;

    const payloadMessages: PayloadMessage[] = nextMessages.map((message) => ({
      role: message.role,
      text: message.text,
      ...(message.images && message.images.length > 0
        ? { images: message.images.map((img) => ({ mediaType: img.mediaType, data: img.dataUrl })) }
        : {}),
    }));

    await runStream(assistantMsg.id, payloadMessages, controller, { taskId: 5, pair: null });
  }

  function handleChatFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      const picked = Array.from(e.target.files);
      setChatFiles((prev) => [...prev, ...filterUploadsWithinLimit(prev, picked, "en")]);
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
      if (items[i].type.startsWith("image/")) {
        const file = items[i].getAsFile();
        if (file) imageFiles.push(file);
      }
    }
    if (imageFiles.length === 0) return;
    e.preventDefault();
    setChatFiles((prev) => [...prev, ...filterUploadsWithinLimit(prev, imageFiles, "en")]);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void doSend();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void doSend();
    }
  }

  return (
    <div className="relative flex flex-1 overflow-hidden bg-white text-[#080808]">
      {/* Decorative gradient overlays (same as math dashboard) */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(160deg,_#ffffff_0%,_#f7fbff_45%,_#ffffff_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[radial-gradient(circle_at_top,_rgba(20,110,245,0.14),_transparent_48%)]" />

      {/* Left panel: Tasks + HTML Preview */}
      <div className={`relative flex min-w-0 flex-col border-r border-[#d8d8d8] ${chatVisible ? "w-[60%] min-w-[360px]" : "flex-1"}`}>
        {/* Top bar */}
        <div className="flex h-[57px] shrink-0 items-center justify-between border-b border-[#d8d8d8] bg-white/95 px-4">
          <div className="flex items-center gap-1">
            <SidebarTrigger />
            <Link
              href="/"
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <ChevronLeft className="size-4" />
              Select Subject
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <Compass className="size-4 text-[#146ef5]" />
              <span className="text-sm font-semibold text-[#080808]">
                {topic.replace("-", " & ").replace(/\b\w/g, (c) => c.toUpperCase())}
              </span>
            </div>
            {!chatVisible && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setChatVisible(true)}
                className="rounded-[4px] border border-[#d8d8d8] bg-white/90 shadow-sm backdrop-blur ml-3"
                title="Show AI assistant"
              >
                <PanelRight className="size-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Task bar + prompt */}
        <div className="px-4 py-3 border-b border-[#d8d8d8] space-y-3">
          {/* Task pills */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#ababab]">
              Tasks
            </span>
            <Separator orientation="vertical" className="h-4" />
            <div className="flex gap-1.5">
              {tasks.map(({ id, label }) => (
                <Button
                  key={id}
                  variant={selectedTask === id ? "default" : "outline"}
                  size="sm"
                  className={
                    selectedTask === id
                      ? "h-7 px-3 text-xs rounded-[4px] bg-[#146ef5] text-white hover:bg-[#0055d4]"
                      : "h-7 px-3 text-xs rounded-[4px] border-[#d8d8d8]"
                  }
                  onClick={() => startTask(id)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>

          {/* Task prompt card */}
          {taskPrompt && (
            <Card className="rounded-[8px] border-2 border-[#146ef5]/30 bg-[#146ef5]/5 ring-0 shadow-md">
              <CardContent className="flex items-start gap-3 p-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-[4px] bg-[#146ef5] mt-0.5 shadow-sm">
                  <BookOpen className="size-4 text-white" />
                </div>
                <p className="text-sm font-medium leading-relaxed text-[#080808]">
                  {taskPrompt}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Interactive map preview */}
        <div className="flex-1 overflow-auto p-4 bg-transparent">
          <div
            className="h-full mx-auto w-full overflow-hidden rounded-[8px] border border-[#d8d8d8] bg-white shadow-[rgba(0,0,0,0)_0px_84px_24px,rgba(0,0,0,0.01)_0px_54px_22px,rgba(0,0,0,0.04)_0px_30px_18px,rgba(0,0,0,0.08)_0px_13px_13px,rgba(0,0,0,0.09)_0px_3px_7px] transition-all"
          >
            <LocationDirectionMap
              task={selectedTask}
              customMapSrc={task5Map?.dataUrl ?? null}
              onUploadMap={handleTask5MapUpload}
            />
          </div>
        </div>
      </div>

      {/* Right panel: AI Chat */}
      {chatVisible && (
        <div className="relative flex flex-1 min-w-[340px] flex-col min-h-0 bg-white/95">
          <div className="border-b border-[#d8d8d8] px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-[4px] bg-[#146ef5] text-white">
                  <Sparkles className="size-4" />
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[1px] text-[#ababab]">English assistant</p>
                  <p className="text-sm font-semibold text-[#080808]">AI Chatbot</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {pinnedIds.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowPinned((v) => !v)}
                    className={`rounded-[4px] border-[#d8d8d8] px-2 text-xs font-medium transition-all hover:bg-[#f4f4f5] ${showPinned ? "text-[#146ef5] border-[#146ef5]/40" : "text-[#080808]"}`}
                    title={showPinned ? "Hide pinned" : "Show pinned"}
                  >
                    <Pin className="size-3.5" />
                    {pinnedIds.length}
                  </Button>
                )}
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  onClick={handleNewChat}
                  className="rounded-[4px] border border-transparent bg-[#146ef5] px-2.5 text-xs font-semibold text-white shadow-[0_6px_16px_rgba(20,110,245,0.28)] transition-all hover:bg-[#0055d4] hover:shadow-[0_8px_20px_rgba(0,85,212,0.34)]"
                  title="New Chat"
                >
                  New Chat
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setChatVisible(false)}
                  className="rounded-[4px]"
                  title="Hide AI assistant"
                >
                  <PanelRight className="size-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Pinned messages (collapsible, kept inside the chat panel) */}
          {showPinned && pinnedMessages.length > 0 && (
            <div className="border-b border-[#d8d8d8] bg-[#fafafa] px-3 py-2">
              <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#ababab]">
                <Pin className="size-3" />
                Pinned messages
              </div>
              <div className="max-h-48 space-y-2 overflow-y-auto">
                {pinnedMessages.map((message) => (
                  <div key={message.id} className="rounded-[8px] border border-[#ededed] bg-white p-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                    <div className="mb-1 flex items-center justify-between">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${message.role === "user" ? "bg-[#f4f4f5] text-[#5a5a5a]" : "bg-[#146ef5]/10 text-[#146ef5]"}`}>
                        {message.role === "user" ? "You" : "AI"}
                      </span>
                      <div className="flex items-center gap-0.5">
                        <button type="button" onClick={() => handleCopy(message.id, message.text)}
                          className="inline-flex size-7 items-center justify-center rounded-full text-[#9a9a9a] transition-colors hover:bg-[#f4f4f5] hover:text-[#5a5a5a]" title="Copy">
                          {copiedId === message.id ? <Check className="size-3.5 text-[#16a34a]" /> : <Copy className="size-3.5" />}
                        </button>
                        <button type="button" onClick={() => togglePin(message.id)}
                          className="inline-flex size-7 items-center justify-center rounded-full text-[#9a9a9a] transition-colors hover:bg-[#f4f4f5] hover:text-[#5a5a5a]" title="Unpin">
                          <PinOff className="size-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="prose prose-sm max-w-none break-words text-[13px] leading-relaxed [overflow-wrap:anywhere] [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:border-[#e5e5e5] [&_th]:px-1.5 [&_th]:py-0.5 [&_td]:border [&_td]:border-[#e5e5e5] [&_td]:px-1.5 [&_td]:py-0.5">
                      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[[rehypeKatex, { strict: false }]]}>
                        {normalizeAiTables(message.text)}
                      </ReactMarkdown>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Chat messages */}
          <div ref={chatScrollRef} onScroll={handleChatScroll} className="flex-1 space-y-5 overflow-y-auto px-4 py-4 min-h-0 bg-white">
            {messages.map((message) => (
              message.role === "user" ? (
                <div key={message.id} className="flex flex-col items-end">
                  <div className="min-w-0 max-w-[85%] rounded-2xl bg-[#f4f4f5] px-3.5 py-2 text-sm leading-relaxed text-[#080808]">
                    {message.images && message.images.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-1.5 not-prose">
                        {message.images.map((image, idx) => (
                          <img key={idx} src={image.dataUrl} alt={image.filename ?? "uploaded image"} className="max-w-[180px] max-h-[180px] rounded-[8px] object-contain" />
                        ))}
                      </div>
                    )}
                    <div className="prose prose-sm max-w-none break-words [overflow-wrap:anywhere]">
                      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[[rehypeKatex, { strict: false }]]}>
                        {normalizeAiTables(message.text)}
                      </ReactMarkdown>
                    </div>
                  </div>
                  {message.text && (
                    <div className="flex items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => handleCopy(message.id, message.text)}
                        className="group/copy relative mt-1.5 inline-flex size-8 items-center justify-center rounded-full text-[#9a9a9a] transition-colors hover:bg-[#f4f4f5] hover:text-[#5a5a5a]"
                        aria-label="Copy message"
                      >
                        {copiedId === message.id ? <Check className="size-4 text-[#16a34a]" /> : <Copy className="size-4" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => togglePin(message.id)}
                        className={`group/pin relative mt-1.5 inline-flex size-8 items-center justify-center rounded-full transition-colors hover:bg-[#f4f4f5] ${pinnedIds.includes(message.id) ? "text-[#146ef5]" : "text-[#9a9a9a] hover:text-[#5a5a5a]"}`}
                        aria-label={pinnedIds.includes(message.id) ? "Unpin" : "Pin message"}
                      >
                        {pinnedIds.includes(message.id) ? <PinOff className="size-4" /> : <Pin className="size-4" />}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div key={message.id} className="flex items-start gap-2.5">
                  {message.text ? (
                    <Sparkles className="mt-1 size-5 shrink-0 text-[#146ef5]" />
                  ) : (
                    <span className="relative mt-0.5 inline-flex size-6 shrink-0 items-center justify-center">
                      <span className="absolute inset-0 rounded-full border-2 border-[#146ef5]/20 border-t-[#146ef5] animate-spin" />
                      <Sparkles className="size-3.5 text-[#146ef5]" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    {message.text && (
                      <div className="prose prose-sm max-w-none break-words prose-p:my-2 prose-li:my-1 prose-headings:my-2 [overflow-wrap:anywhere] [&_.katex-display]:max-w-full [&_.katex-display]:overflow-x-auto [&_.katex-display]:overflow-y-hidden [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_code]:break-words [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:border-[#e5e5e5] [&_th]:px-2 [&_th]:py-1 [&_th]:bg-[#fafafa] [&_td]:border [&_td]:border-[#e5e5e5] [&_td]:px-2 [&_td]:py-1">
                        <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[[rehypeKatex, { strict: false }]]}>
                          {normalizeAiTables(message.text)}
                        </ReactMarkdown>
                      </div>
                    )}
                    {message.text && !(isLoading && message.id === messages[messages.length - 1]?.id) && (
                      <div className="flex items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => handleCopy(message.id, message.text)}
                          className="group/copy relative mt-1.5 inline-flex size-8 items-center justify-center rounded-full text-[#9a9a9a] transition-colors hover:bg-[#f4f4f5] hover:text-[#5a5a5a]"
                          aria-label="Copy reply"
                        >
                          {copiedId === message.id ? <Check className="size-4 text-[#16a34a]" /> : <Copy className="size-4" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => togglePin(message.id)}
                          className={`group/pin relative mt-1.5 inline-flex size-8 items-center justify-center rounded-full transition-colors hover:bg-[#f4f4f5] ${pinnedIds.includes(message.id) ? "text-[#146ef5]" : "text-[#9a9a9a] hover:text-[#5a5a5a]"}`}
                          aria-label={pinnedIds.includes(message.id) ? "Unpin" : "Pin reply"}
                        >
                          {pinnedIds.includes(message.id) ? <PinOff className="size-4" /> : <Pin className="size-4" />}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            ))}

            {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
              <div className="flex items-start gap-2.5">
                <span className="relative mt-0.5 inline-flex size-6 shrink-0 items-center justify-center">
                  <span className="absolute inset-0 rounded-full border-2 border-[#146ef5]/20 border-t-[#146ef5] animate-spin" />
                  <Sparkles className="size-3.5 text-[#146ef5]" />
                </span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Chat input */}
          <div className="border-t border-[#d8d8d8] px-3 py-3 bg-white">
            <form onSubmit={handleSubmit}>
              <div className="relative w-full rounded-2xl border border-[#e5e5e5] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                {/* Image preview thumbnails */}
                {chatFiles.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 px-3 pt-2">
                    {chatFiles.map((file, i) => (
                      <div key={i} className="relative group">
                        <img
                          src={URL.createObjectURL(file)}
                          alt={file.name}
                          className="size-12 rounded-[8px] border border-[#e5e5e5] object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => removeChatFile(i)}
                          className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-[#080808] text-white opacity-0 transition-opacity group-hover:opacity-100"
                        >
                          <X className="size-2.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <Textarea
                  ref={textareaRef}
                  placeholder="Type a message, paste images, or use voice input."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onPaste={handlePaste}
                  className="min-h-[56px] max-h-[160px] resize-none overflow-y-auto border-0 bg-transparent px-4 pt-3.5 pb-10 text-sm shadow-none focus-visible:ring-0"
                />

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleChatFileChange}
                  className="hidden"
                />

                <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => fileInputRef.current?.click()}
                      className="rounded-full text-[#5a5a5a] transition-all hover:bg-[#f4f4f5]"
                      title="Upload image"
                    >
                      <ImagePlus className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      onClick={toggleVoice}
                      className={`rounded-full transition-all ${
                        isListening ? 'text-red-500 hover:bg-red-50' : 'text-[#5a5a5a] hover:bg-[#f4f4f5]'
                      }`}
                      title={isListening ? 'Stop voice input' : 'Voice input'}
                    >
                      {isListening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
                    </Button>
                    {isListening && (
                      <span className="text-[11px] font-medium text-red-500 animate-pulse">Listening…</span>
                    )}
                  </div>
                  {isLoading ? (
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="default"
                      className="rounded-full bg-[#146ef5] hover:bg-[#0055d4]"
                      onClick={stop}
                    >
                      <Square className="size-3" />
                    </Button>
                  ) : (
                    <Button
                      type="submit"
                      size="icon-sm"
                      className="rounded-full bg-[#146ef5] text-white hover:bg-[#0055d4] disabled:bg-[#d8d8d8]"
                      disabled={!canSend}
                    >
                      <ArrowUp className="size-4" />
                    </Button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
