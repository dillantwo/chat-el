"use client";

import { Suspense, useRef, useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowUp,
  Square,
  Compass,
  Sparkles,
  Mic,
  MicOff,
  ImagePlus,
  ChevronLeft,
  PanelRight,
  Copy,
  Check,
  Pin,
  PinOff,
} from "lucide-react";
import { ChatAttachmentPreview } from "@/components/ChatAttachmentPreview";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { filterUploadsWithinLimit } from "@/lib/upload-limits";
import { useVoiceInput } from "@/lib/use-voice-input";
import { useStreamingChat } from "@/lib/use-streaming-chat";
import { useChatAttachments } from "@/lib/use-chat-attachments";
import {
  createChatMessage,
  deriveChatTitle,
  filesToChatImages,
  restoreChatMessages,
  toPayloadMessages,
  toSavedMessages,
  type ChatImage,
  type ChatMsg,
} from "@/lib/chat-message";
import {
  createEnglishChatId,
  upsertEnglishChatHistory,
  type EnglishChatHistoryItem,
} from "@/lib/english-chat-history";
import { pickLocationPair, type LocationPair } from "@/lib/english-prompts";
import LocationDirectionMap from "@/components/LocationDirectionMap";

const API_ENDPOINT = "/api/english-location-direction";
const TOPIC_ID = "location-direction";
const DEFAULT_TITLE = "English Chat";

// Builds the displayed task prompt for a concrete [A] → [B] pair.
const taskTemplates: Record<number, (a: string, b: string) => string> = {
  1: (a, b) => `Let us start Task 1. Look at the map. How can I go from the ${a} to the ${b}? Use prepositional phrases to describe the direction.`,
  2: (a, b) => `Let us start Task 2. Look at the map. How can I go from the ${a} to the ${b}? Write short sentences with the prepositional phrases you learned.`,
  3: (a, b) => `Let us start Task 3. Look at the map. How can I go from the ${a} to the ${b}? Write more than one sentence and use linking words.`,
  4: (a, b) => `Let us start Task 4. Look at the map. How can I go from the ${a} to the ${b}? Write a complete paragraph with a topic sentence and linking words.`,
};

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

  const {
    messages,
    setMessages,
    status,
    isLoading,
    beginSend,
    streamAssistant,
    stop,
    reset: resetChat,
  } = useStreamingChat({
    endpoint: API_ENDPOINT,
    errorPrefix: "(Error) ",
    unknownErrorMessage: "Unknown error",
  });
  const {
    files: chatFiles,
    inputRef: fileInputRef,
    remove: removeChatFile,
    clear: clearChatFiles,
    onInputChange: handleChatFileChange,
    onPaste: handlePaste,
  } = useChatAttachments("en");

  const [input, setInput] = useState("");
  const [selectedTask, setSelectedTask] = useState<number | null>(null);
  const [locationPair, setLocationPair] = useState<LocationPair | null>(null);
  // Task 5: the map image the student uploaded (shown in the map panel and sent
  // to the chatbot so its questions relate to the student's own drawing).
  const [task5Map, setTask5Map] = useState<ChatImage | null>(null);
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

  // Declared above the reset/load handlers below, which need to stop dictation
  // before they clear the input.
  const {
    isListening,
    error: voiceError,
    stop: stopListening,
    toggle: toggleVoice,
    rebase: rebaseDictation,
  } = useVoiceInput({
    lang: "en-US",
    getBaseText: () => input,
    onTranscript: setInput,
  });

  // Typing while the mic is live: hand the edit to the recogniser as the new
  // baseline, otherwise the next result would revert it.
  const handleInputChange = useCallback(
    (value: string) => {
      setInput(value);
      if (isListening) rebaseDictation(value);
    },
    [isListening, rebaseDictation]
  );

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
    // The input is about to be cleared, so a live mic would write the old text
    // back on its next result.
    stopListening();
    setInput("");
    clearChatFiles();
    setTask5Map(null);
    setPinnedIds([]);
    setShowPinned(false);
    setCurrentChatId(createEnglishChatId());
    setChatVisible(true);

    if (id == null) {
      setSelectedTask(null);
      setLocationPair(null);
      selectedTaskRef.current = null;
      locationPairRef.current = null;
      resetChat();
      return;
    }

    // Tasks 1–4 have a fixed [A]/[B] pair, so re-deriving it here gives the
    // same locations the student was already working on.
    const pair = id === 5 ? null : pickLocationPair(id);
    setSelectedTask(id);
    setLocationPair(pair);
    // Keep the refs in sync immediately — the effects that mirror them run too
    // late for a send that happens right after this.
    selectedTaskRef.current = id;
    locationPairRef.current = pair;
    resetChat([createChatMessage("assistant", buildOpeningMessage(id, pair))]);
  }, [stopListening, clearChatFiles, resetChat]);

  const handleNewChat = useCallback(() => {
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
      // The input gets cleared below, so drop any dictation in flight.
      stopListening();
      // Loading an existing chat must not trigger a re-save.
      skipSaveRef.current = true;
      setCurrentChatId(detail.id);
      const restored = restoreChatMessages(detail.messages);
      resetChat(restored);
      setSelectedTask(detail.selectedTask ?? null);
      // The chosen [A]/[B] live in the restored conversation itself, so we
      // don't re-derive a (possibly different) pair here.
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
      clearChatFiles();
      setPinnedIds([]);
      setShowPinned(false);
      setChatVisible(true);
    }
    window.addEventListener("english-chat:load", onLoadChat);
    return () => window.removeEventListener("english-chat:load", onLoadChat);
  }, [stopListening, resetChat, clearChatFiles]);

  // Auto-save chat history
  useEffect(() => {
    if (skipSaveRef.current) {
      skipSaveRef.current = false;
      return;
    }
    if (messages.length === 0) return;
    if (status === "streaming" || status === "submitted") return;

    void upsertEnglishChatHistory({
      id: currentChatId,
      title: deriveChatTitle(messages, DEFAULT_TITLE),
      topic: TOPIC_ID,
      selectedTask,
      messages: toSavedMessages(messages),
      updatedAt: new Date().toISOString(),
    });
  }, [currentChatId, messages, status, selectedTask]);

  // The task and its [A]/[B] pair ride on every request. They are read from
  // refs rather than state so a send that happens immediately after picking a
  // task still sees the new selection.
  const sendTurn = useCallback(
    (nextMessages: readonly ChatMsg[], taskId: number | null, pair: LocationPair | null) =>
      streamAssistant(toPayloadMessages(nextMessages), {
        taskId,
        locationA: pair?.from ?? null,
        locationB: pair?.to ?? null,
        // The id this transcript is saved under, so a token-usage record tagged
        // with it can be resolved back to the conversation.
        chatId: currentChatId,
      }),
    [streamAssistant, currentChatId],
  );

  // Switching tasks resets the conversation and seeds the chatbot with the new
  // task instructions. The opening message is built locally (see
  // buildOpeningMessage) — no LLM call, so picking a task costs zero tokens.
  function startTask(id: number) {
    // resetConversationForTask aborts and stops dictation itself.
    resetConversationForTask(id);
  }

  async function doSend() {
    if (!canSend) return;
    if (isListening) stopListening();
    const { signal } = beginSend();

    const images = await filesToChatImages(chatFiles, "en");
    // The student pressed Stop while the attachments were being read.
    if (signal.aborted) return;

    const userMsg = createChatMessage("user", input.trim() || "(see image)", images);
    const nextMessages = [...messages, userMsg];

    setMessages(nextMessages);
    setInput("");
    clearChatFiles();

    await sendTurn(nextMessages, selectedTaskRef.current, locationPairRef.current);
  }

  // Task 5: the student uploads their own map in the map panel. We show it as
  // the map, add it to the conversation as an image, and let the chatbot ask a
  // direction question based on that specific drawing.
  async function handleTask5MapUpload(file: File) {
    if (isLoading) return;
    if (filterUploadsWithinLimit([], [file], "en").length === 0) return;
    if (isListening) stopListening();

    // Marked busy before the read, not after. The composer sits next to the map
    // panel, so otherwise the student could press Enter while the drawing was
    // still being encoded and this handler would then commit a `messages`
    // snapshot from before that turn, silently discarding it.
    const { signal } = beginSend();

    const [image] = await filesToChatImages([file], "en");
    if (signal.aborted) return;
    if (!image) {
      // Unreadable file: settle the panel rather than leaving it locked.
      stop();
      return;
    }
    setTask5Map(image);

    const userMsg = createChatMessage(
      "user",
      "Here is my map. It shows the way from my home to school.",
      [image],
    );
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);

    await sendTurn(nextMessages, 5, null);
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

        {/* Task bar. The task instructions live in the chatbot's opening
            message, so we don't repeat them here and take space from the map. */}
        <div className="px-4 py-2 border-b border-[#d8d8d8]">
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
                <ChatAttachmentPreview files={chatFiles} onRemove={removeChatFile} removeLabel="Remove image" />

                <Textarea
                  ref={textareaRef}
                  placeholder="Type a message, paste images, or use voice input."
                  value={input}
                  onChange={(e) => handleInputChange(e.target.value)}
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
                      aria-label={isListening ? 'Stop voice input' : 'Voice input'}
                    >
                      {isListening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
                    </Button>
                    {isListening && (
                      <span
                        aria-live="polite"
                        className="text-[11px] font-medium text-red-500 animate-pulse"
                      >
                        Listening…
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
