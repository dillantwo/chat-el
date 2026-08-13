"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowUp,
  Square,
  Mic,
  MicOff,
  ImagePlus,
  X,
  ChevronLeft,
  BookOpen,
  Sparkles,
  Copy,
  Check,
  Plus,
  Pin,
  PinOff,
} from "lucide-react";
import Link from "next/link";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { basePath } from "@/lib/utils";
import { filterUploadsWithinLimit } from "@/lib/upload-limits";
import { VOCAB_ADD_EVENT } from "@/components/VocabBank";
import {
  READING_ROLES,
  READING_ROLE_LABELS,
  type ReadingId,
  type ReadingRole,
} from "@/lib/english-prompts";
import {
  createEnglishChatId,
  upsertEnglishChatHistory,
  type EnglishChatHistoryItem,
  type SavedChatMessage,
} from "@/lib/english-chat-history";

type ChatImage = { mediaType: string; dataUrl: string; filename?: string };
type ChatMsg = {
  id: string;
  role: "user" | "assistant";
  text: string;
  images?: ChatImage[];
};

// Reverse lookup from the bold speaker label the AI uses to the role key.
const ROLE_LABEL_TO_ROLE: Record<string, ReadingRole> = Object.fromEntries(
  READING_ROLES.map((role) => [READING_ROLE_LABELS[role].toLowerCase(), role])
) as Record<string, ReadingRole>;

// Fallback for chats where the role wasn't persisted. Two signals from the AI
// turns let us recover the student's role:
//   1. The AI prefixes each of its own turns with a bold speaker label, e.g.
//      "**Questioner:**" — these are the roles the AI plays.
//   2. The AI always hands the floor back to the student by name, e.g.
//      "Summariser, it's your turn!" — so the student's role is mentioned but
//      never spoken as by the AI.
// The student's role is therefore a role the AI addresses but never speaks as;
// if that is ambiguous, fall back to "AI plays two, student is the third".
function inferStudentRole(
  messages: { role: "user" | "assistant"; text: string }[]
): ReadingRole | null {
  const speakerRegex = /\*\*\s*(Summariser|Questioner|Vocab-Builder)\s*[:：]/gi;
  const aiSpeakers = new Set<ReadingRole>();
  const mentioned = new Set<ReadingRole>();
  for (const message of messages) {
    if (message.role !== "assistant" || !message.text) continue;
    for (const match of message.text.matchAll(speakerRegex)) {
      const role = ROLE_LABEL_TO_ROLE[match[1].toLowerCase()];
      if (role) aiSpeakers.add(role);
    }
    const lower = message.text.toLowerCase();
    for (const role of READING_ROLES) {
      if (lower.includes(READING_ROLE_LABELS[role].toLowerCase())) mentioned.add(role);
    }
  }
  const addressedOnly = READING_ROLES.filter((r) => mentioned.has(r) && !aiSpeakers.has(r));
  if (addressedOnly.length === 1) return addressedOnly[0];
  if (aiSpeakers.size === READING_ROLES.length - 1) {
    return READING_ROLES.find((r) => !aiSpeakers.has(r)) ?? null;
  }
  return null;
}

// The Vocab-Builder tags new words as Markdown links of the form
// [word](vocab:word). We keep that scheme through react-markdown's url
// transform and render the link as a draggable chip the student can drop into
// the Word Bank in the sidebar.
const vocabUrlTransform = (url: string) =>
  url.startsWith("vocab:") ? url : defaultUrlTransform(url);

function VocabChip({ word, children }: { word: string; children: ReactNode }) {
  const [added, setAdded] = useState(false);

  // Desktop uses drag-and-drop; tap/click adds the word too, which is the only
  // way to save it on touch devices (iPad) where drag events never fire.
  const addToBank = () => {
    window.dispatchEvent(new CustomEvent(VOCAB_ADD_EVENT, { detail: word }));
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1200);
  };

  return (
    <span
      role="button"
      tabIndex={0}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("application/x-vocab-word", word);
        e.dataTransfer.setData("text/plain", word);
        e.dataTransfer.effectAllowed = "copy";
      }}
      onClick={addToBank}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          addToBank();
        }
      }}
      className={`not-prose inline-flex cursor-pointer items-center gap-1 rounded-full border px-2 py-0.5 text-[13px] font-semibold no-underline transition-colors ${
        added
          ? "border-[#16a34a]/50 bg-[#16a34a]/10 text-[#16a34a]"
          : "border-[#146ef5]/40 bg-[#146ef5]/10 text-[#146ef5]"
      }`}
      title="Tap to add to your Word Bank (or drag on desktop) / 點一下加入生詞庫"
    >
      {added ? <Check className="size-3.5" /> : <Plus className="size-3.5" />}
      {children}
    </span>
  );
}

function VocabAnchor({ href, children }: { href?: string; children?: ReactNode }) {
  if (href && href.startsWith("vocab:")) {
    const word = decodeURIComponent(href.slice("vocab:".length)).trim();
    return <VocabChip word={word}>{children}</VocabChip>;
  }
  return (
    <a href={href} target="_blank" rel="noreferrer" className="text-[#146ef5] underline">
      {children}
    </a>
  );
}

const assistantMarkdownComponents = { a: VocabAnchor };

const TOPIC_ID = "reading-comprehension";
const SESSION_PREFIX = "english-reading";
const API_ENDPOINT = "/api/english-reading-comprehension";
const DEFAULT_TITLE = "Reading Comprehension Chat";
const PLACEHOLDER = "Type your answer or question…";
const EMPTY_HINT = "Start chatting with AI to practise your Reading Comprehension.";

export type EnglishReadingComprehensionChatProps = {
  /** Which reading the discussion is based on. Drives the AI system prompt. */
  reading?: ReadingId;
  /** Label shown in the top bar. */
  topicLabel?: string;
  /** Where the "Back" link/button returns to. */
  backHref?: string;
  /**
   * The reading shown as the first pinnable message when the student presses
   * Start. Markdown — may contain an image or plain text.
   */
  startMessageText?: string;
};

export default function EnglishReadingComprehensionChat({
  reading = "reading-1",
  topicLabel = "Reading Comprehension",
  backHref = "/english/reading-comprehension/modes",
  startMessageText = `Here is our reading. Let's read it together!\n\n![Sunshine Ice-cream advertisement](${basePath}/english/reading-comprehension-article.png)`,
}: EnglishReadingComprehensionChatProps = {}) {
  const makeSessionId = useCallback(
    () =>
      `${SESSION_PREFIX}-${
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2)
      }`,
    []
  );

  const [sessionId, setSessionId] = useState<string>(() => makeSessionId());
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [status, setStatus] = useState<"idle" | "submitted" | "streaming">("idle");
  const [input, setInput] = useState("");
  const [chatFiles, setChatFiles] = useState<File[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [currentChatId, setCurrentChatId] = useState(() => createEnglishChatId());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [showPinned, setShowPinned] = useState(false);
  const [studentRole, setStudentRole] = useState<ReadingRole | null>(null);
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
  // Loading a saved chat must not re-save it (which would bump updatedAt and
  // reorder the shared history list).
  const skipSaveRef = useRef(false);

  const isLoading = status === "submitted" || status === "streaming";
  const hasStarted = messages.length > 0;
  const canSend = (!!input.trim() || chatFiles.length > 0) && !isLoading && hasStarted;
  const pinnedMessages = messages.filter((m) => pinnedIds.includes(m.id));

  // Broadcast the active chat id so the sidebar can highlight the open item.
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("english-chat:active", { detail: { id: currentChatId } })
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

  const handleNewChat = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setMessages([]);
    setInput("");
    setChatFiles([]);
    setStatus("idle");
    setSessionId(makeSessionId());
    setCurrentChatId(createEnglishChatId());
    setPinnedIds([]);
    setShowPinned(false);
    setStudentRole(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [makeSessionId]);

  useEffect(() => {
    window.addEventListener("dashboard:new-chat", handleNewChat);
    return () => window.removeEventListener("dashboard:new-chat", handleNewChat);
  }, [handleNewChat]);

  // Listen for sidebar history item click
  useEffect(() => {
    function onLoadChat(event: Event) {
      const detail = (event as CustomEvent<{ item: EnglishChatHistoryItem }>).detail?.item;
      if (!detail || detail.topic !== TOPIC_ID) return;
      abortRef.current?.abort();
      abortRef.current = null;
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
      const storedRole =
        detail.studentRole && READING_ROLES.includes(detail.studentRole as ReadingRole)
          ? (detail.studentRole as ReadingRole)
          : null;
      setStudentRole(storedRole ?? inferStudentRole(restored));
      setMessages(restored);
      setInput("");
      setChatFiles([]);
      setStatus("idle");
      setPinnedIds([]);
      setShowPinned(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
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
      studentRole,
      messages: savedMessages,
      updatedAt: new Date().toISOString(),
    });
  }, [currentChatId, messages, status, studentRole]);

  useEffect(() => {
    const container = chatScrollRef.current;
    if (!container) return;
    // Follow the latest message only while the user is pinned to the bottom.
    if (isAtBottomRef.current) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  function toggleVoice() {
    if (!("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) {
      alert("Your browser does not support voice input. Please use Chrome or Edge.");
      return;
    }
    if (isListening) { stopListening(); return; }
    const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) return;
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let transcript = "";
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

  useEffect(() => {
    return () => { recognitionRef.current?.stop(); };
  }, []);

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

  // Streams one assistant reply into a fresh placeholder message, given the
  // full conversation payload to send to the API.
  const streamAssistant = useCallback(
    async (payloadMessages: PayloadMessage[], roleForRequest: ReadingRole | null) => {
      const assistantMsg: ChatMsg = { id: `a-${Date.now()}`, role: "assistant", text: "" };
      setMessages((prev) => [...prev, assistantMsg]);
      setStatus("submitted");

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch(`${basePath}${API_ENDPOINT}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: payloadMessages, sessionId, role: roleForRequest, reading }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          const errText = await res.text().catch(() => "");
          setMessages((prev) => prev.map((m) => m.id === assistantMsg.id ? { ...m, text: `(Error) ${errText || res.statusText}` } : m));
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
          setMessages((prev) => prev.map((m) => m.id === assistantMsg.id ? { ...m, text: error instanceof Error ? `(Error) ${error.message}` : "(Error) Unknown error" } : m));
        } else {
          setMessages((prev) => prev.filter((m) => m.id !== assistantMsg.id || m.text));
        }
      } finally {
        abortRef.current = null;
        setStatus("idle");
      }
    },
    [sessionId, reading]
  );

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

    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");
    setChatFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";

    const payloadMessages: PayloadMessage[] = nextMessages.map((message) => ({
      role: message.role,
      text: message.text,
      ...(message.images && message.images.length > 0
        ? { images: message.images.map((image) => ({ mediaType: image.mediaType, data: image.dataUrl })) }
        : {}),
    }));

    await streamAssistant(payloadMessages, studentRole);
  }

  // Agent kick-off: the student picks a role, then clicks "Start". We first
  // show the full reading text as a pinnable message, then the AI opens the
  // reciprocal-reading discussion. The starter turn is sent to the API but not
  // shown as a student bubble.
  const handleStart = useCallback(async () => {
    if (!studentRole || messages.length > 0 || isLoading) return;
    const fullTextMsg: ChatMsg = {
      id: `a-fulltext-${Date.now()}`,
      role: "assistant",
      text: startMessageText,
    };
    setMessages([fullTextMsg]);
    await streamAssistant(
      [{ role: "user", text: "Let's begin our reading discussion." }],
      studentRole
    );
  }, [studentRole, messages.length, isLoading, streamAssistant, startMessageText]);

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
      if (items[i].type.startsWith("image/")) { const f = items[i].getAsFile(); if (f) imageFiles.push(f); }
    }
    if (imageFiles.length === 0) return;
    e.preventDefault();
    setChatFiles((prev) => [...prev, ...filterUploadsWithinLimit(prev, imageFiles, "en")]);
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
              Back
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <BookOpen className="size-4 text-[#146ef5]" />
            <span className="text-sm font-semibold text-[#080808]">{topicLabel}</span>
          </div>
          <div className="flex items-center gap-2">
            {pinnedIds.length > 0 && (
              <Button type="button" variant="outline" size="sm" onClick={() => setShowPinned((v) => !v)}
                className={`rounded-full border-[#e5e5e5] px-3 text-xs font-medium transition-all hover:bg-[#f4f4f5] ${showPinned ? "text-[#146ef5] border-[#146ef5]/40" : "text-[#080808]"}`}
                title={showPinned ? "Hide pinned" : "Show pinned"}>
                <Pin className="size-3.5" />
                Pinned {pinnedIds.length}
              </Button>
            )}
            <Button type="button" variant="outline" size="sm" onClick={handleNewChat}
              className="rounded-full border-[#e5e5e5] px-3 text-xs font-medium text-[#080808] transition-all hover:bg-[#f4f4f5]"
              title="New Chat">
              New Chat
            </Button>
          </div>
        </div>

        {/* Chat messages */}
        <div ref={chatScrollRef} onScroll={handleChatScroll} className={`flex-1 px-4 py-6 min-h-0 bg-white ${messages.length > 0 ? "overflow-y-auto" : "overflow-hidden"}`}>
          <div className="w-full space-y-6">
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
              <p className="max-w-sm text-sm text-[#9a9a9a]">{EMPTY_HINT}</p>
              <Button
                type="button"
                onClick={() => void handleStart()}
                disabled={!studentRole || isLoading}
                className="rounded-full bg-[#146ef5] px-6 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(20,110,245,0.3)] transition-all hover:bg-[#0055d4] disabled:bg-[#d8d8d8] disabled:shadow-none"
              >
                Start
              </Button>
              <p className="text-xs text-[#b5b5b5]">
                {studentRole
                  ? `Your role: ${READING_ROLE_LABELS[studentRole]}`
                  : "Please choose your role in the input box below first"}
              </p>
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
                    <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[[rehypeKatex, { strict: false }]]}>
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
                      aria-label="Copy message"
                    >
                      {copiedId === message.id ? (
                        <Check className="size-4 text-[#16a34a]" />
                      ) : (
                        <Copy className="size-4" />
                      )}
                      <span className="pointer-events-none absolute right-0 top-full z-10 mt-1 whitespace-nowrap rounded-md bg-[#080808] px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover/copy:opacity-100">
                        {copiedId === message.id ? "Copied" : "Copy message"}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => togglePin(message.id)}
                      className={`group/pin relative mt-1.5 inline-flex size-8 items-center justify-center rounded-full transition-colors hover:bg-[#f4f4f5] ${pinnedIds.includes(message.id) ? "text-[#146ef5]" : "text-[#9a9a9a] hover:text-[#5a5a5a]"}`}
                      aria-label={pinnedIds.includes(message.id) ? "Unpin" : "Pin message"}
                    >
                      {pinnedIds.includes(message.id) ? (
                        <PinOff className="size-4" />
                      ) : (
                        <Pin className="size-4" />
                      )}
                      <span className="pointer-events-none absolute right-0 top-full z-10 mt-1 whitespace-nowrap rounded-md bg-[#080808] px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover/pin:opacity-100">
                        {pinnedIds.includes(message.id) ? "Unpin" : "Pin message"}
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
                  {message.text && (
                    <div className="prose prose-sm max-w-none break-words prose-p:my-2 prose-li:my-1 prose-headings:my-2 [overflow-wrap:anywhere] [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:border-[#e5e5e5] [&_th]:px-2 [&_th]:py-1 [&_th]:bg-[#fafafa] [&_td]:border [&_td]:border-[#e5e5e5] [&_td]:px-2 [&_td]:py-1">
                      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[[rehypeKatex, { strict: false }]]} urlTransform={vocabUrlTransform} components={assistantMarkdownComponents}>
                        {message.text}
                      </ReactMarkdown>
                    </div>
                  )}
                  {message.text && !(isLoading && message.id === messages[messages.length - 1]?.id) && (
                    <button
                      type="button"
                      onClick={() => handleCopy(message.id, message.text)}
                      className="group/copy relative mt-1.5 inline-flex size-8 items-center justify-center rounded-full text-[#9a9a9a] transition-colors hover:bg-[#f4f4f5] hover:text-[#5a5a5a]"
                      aria-label="Copy reply"
                    >
                      {copiedId === message.id ? (
                        <Check className="size-4 text-[#16a34a]" />
                      ) : (
                        <Copy className="size-4" />
                      )}
                      <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-[#080808] px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover/copy:opacity-100">
                        {copiedId === message.id ? "Copied" : "Copy reply"}
                      </span>
                    </button>
                  )}
                  {message.text && !(isLoading && message.id === messages[messages.length - 1]?.id) && (
                    <button
                      type="button"
                      onClick={() => togglePin(message.id)}
                      className={`group/pin relative mt-1.5 inline-flex size-8 items-center justify-center rounded-full transition-colors hover:bg-[#f4f4f5] ${pinnedIds.includes(message.id) ? "text-[#146ef5]" : "text-[#9a9a9a] hover:text-[#5a5a5a]"}`}
                      aria-label={pinnedIds.includes(message.id) ? "Unpin" : "Pin reply"}
                    >
                      {pinnedIds.includes(message.id) ? (
                        <PinOff className="size-4" />
                      ) : (
                        <Pin className="size-4" />
                      )}
                      <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-[#080808] px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover/pin:opacity-100">
                        {pinnedIds.includes(message.id) ? "Unpin" : "Pin reply"}
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
          <form onSubmit={handleSubmit} className="w-full">
            <div className="relative w-full rounded-2xl border border-[#e5e5e5] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
              {/* Role selector: student picks one role, AI plays the other two */}
              <div className="flex flex-wrap items-center gap-2 border-b border-[#f0f0f0] px-3 py-2">
                <span className="text-[11px] font-medium text-[#9a9a9a]">My role:</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {READING_ROLES.map((role) => {
                    const active = studentRole === role;
                    const locked = messages.length > 0;
                    return (
                      <button
                        key={role}
                        type="button"
                        disabled={locked && !active}
                        onClick={() => {
                          if (locked) return;
                          setStudentRole((prev) => (prev === role ? null : role));
                        }}
                        aria-pressed={active}
                        title={locked ? "Start a New Chat to change your role" : undefined}
                        className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                          active
                            ? "border-[#146ef5] bg-[#146ef5] text-white shadow-[0_2px_8px_rgba(20,110,245,0.25)]"
                            : locked
                            ? "cursor-not-allowed border-[#eee] bg-white text-[#cfcfcf]"
                            : "border-[#e5e5e5] bg-white text-[#5a5a5a] hover:border-[#146ef5]/40 hover:text-[#146ef5]"
                        }`}
                      >
                        {READING_ROLE_LABELS[role]}
                      </button>
                    );
                  })}
                </div>
                <span className="ml-auto text-[11px] text-[#b5b5b5]">
                  {studentRole
                    ? `AI plays the other ${READING_ROLES.length - 1} roles`
                    : "Pick a role to start"}
                </span>
              </div>
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
              <Textarea ref={textareaRef} placeholder={hasStarted ? PLACEHOLDER : "Please choose a role and click \u201CStart\u201D"} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} onPaste={handlePaste}
                disabled={!hasStarted}
                className="min-h-[56px] max-h-[160px] resize-none overflow-y-auto border-0 bg-transparent px-4 pt-3.5 pb-10 text-sm shadow-none focus-visible:ring-0 disabled:cursor-not-allowed" />
              <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleChatFileChange} className="hidden" />
              <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <Button type="button" size="icon-sm" variant="ghost" onClick={() => fileInputRef.current?.click()} disabled={!hasStarted}
                    className="rounded-full text-[#5a5a5a] transition-all hover:bg-[#f4f4f5] disabled:opacity-40" title="Upload image">
                    <ImagePlus className="size-4" />
                  </Button>
                  <Button type="button" size="icon-sm" variant="ghost" onClick={toggleVoice} disabled={!hasStarted}
                    className={`rounded-full transition-all disabled:opacity-40 ${isListening ? 'text-red-500 hover:bg-red-50' : 'text-[#5a5a5a] hover:bg-[#f4f4f5]'}`}
                    title={isListening ? 'Stop voice input' : 'Voice input'}>
                    {isListening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
                  </Button>
                  {isListening && <span className="text-[11px] font-medium text-red-500 animate-pulse">Listening…</span>}
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

      {/* Right-side pinned panel */}
      {showPinned && (
        <div className="flex w-80 shrink-0 flex-col border-l border-[#ededed] bg-[#fafafa]">
          <div className="flex h-[57px] shrink-0 items-center justify-between border-b border-[#ededed] bg-white px-4">
            <div className="flex items-center gap-2">
              <Pin className="size-4 text-[#146ef5]" />
              <span className="text-sm font-semibold text-[#080808]">Pinned messages</span>
            </div>
            <Button type="button" size="icon-sm" variant="ghost" onClick={() => setShowPinned(false)}
              className="rounded-full text-[#5a5a5a] transition-all hover:bg-[#f4f4f5]" title="Close">
              <X className="size-4" />
            </Button>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {pinnedMessages.length === 0 ? (
              <div className="flex h-full items-center justify-center text-center text-xs text-[#9a9a9a]">
                No pinned messages yet.<br />Click the pin icon below a message to add it.
              </div>
            ) : (
              pinnedMessages.map((message) => (
                <div key={message.id} className="group/pinned rounded-xl border border-[#ededed] bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                  <div className="mb-1.5 flex items-center justify-between">
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
