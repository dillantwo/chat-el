"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { ArrowUp, ImagePlus, MessageSquare, Mic, MicOff, PanelRight, Square, X } from "lucide-react";
import { ChatAvatar } from "@/components/ChatAvatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { basePath } from "@/lib/utils";
import { filterUploadsWithinLimit } from "@/lib/upload-limits";
import { useVoiceInput } from "@/lib/use-voice-input";
import { getMathChatHistoryItem, restoreUiMessages, serializeUiMessages, upsertMathChatHistory } from "@/lib/math-chat-history";

type Clock24HoursState = {
  tool: "clock-24hrs";
  currentTime: number;
  displayTime: string;
  periodLabel: string;
  is24HDisplay: boolean;
  show24Numbers: boolean;
  snapTo5Min: boolean;
  showAngle: boolean;
  angleDegrees: number;
  isDayTime: boolean;
};

type ClockTimeDifferenceState = {
  tool: "clock-time-difference";
  startTime: number;
  endTime: number;
  startLabel: string;
  endLabel: string;
  is24H: boolean;
  diffMinutes: number;
  expectedHours: number;
  expectedMinutes: number;
  quizTargetDiff: number | null;
  feedbackKind: "idle" | "correct" | "wrong";
  showSteps: boolean;
};

type ClockToolState = Clock24HoursState | ClockTimeDifferenceState;
type ClockToolKey = ClockToolState["tool"];

const SUGGESTIONS: Record<ClockToolState["tool"], string[]> = {
  "clock-24hrs": [
    "現在時鐘顯示的是什麼時間？你可以提示我怎樣看。",
    "為什麼時針不是剛好指著某個數字？",
    "AM/PM 和 24 小時制可以怎樣互相轉換？",
    "這個角度可以怎樣一步步判斷？",
  ],
  "clock-time-difference": [
    "我應該先看哪一個時間，再算相差多久？",
    "如果分鐘不夠減，應該怎樣想借位？",
    "這題要怎樣判斷是不是隔天？",
    "你可以先檢查我的思路，不要直接告訴我答案嗎？",
  ],
};

function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
}

export function ClockChatPanel({
  selectedTool,
  sessionId,
  hasUserQuestion,
  question,
  type,
  toolUrl,
  onNewChat,
  onHide,
}: {
  selectedTool: ClockToolKey;
  sessionId: string;
  hasUserQuestion: boolean;
  question?: string;
  type?: string;
  toolUrl?: string;
  onNewChat: () => void;
  onHide?: () => void;
} = { selectedTool: "clock-24hrs", sessionId: "clock-chat-default", hasUserQuestion: false, onNewChat: () => {} }) {
  const [input, setInput] = useState("");
  const [chatFiles, setChatFiles] = useState<File[]>([]);
  const [clockState, setClockState] = useState<ClockToolState | null>(null);
  const stateRef = useRef<ClockToolState | null>(null);
  const messageHistoryRef = useRef<Record<ClockToolKey, UIMessage[]>>({
    "clock-24hrs": [],
    "clock-time-difference": [],
  });
  const activeToolRef = useRef<ClockToolKey>(selectedTool);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const handleChatScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }, []);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Typing while the mic is live: hand the edit to the recogniser as the new
  // baseline, otherwise the next result would revert it.
  const handleInputChange = useCallback(
    (value: string) => {
      setInput(value);
      if (isListening) rebaseDictation(value);
    },
    [isListening, rebaseDictation]
  );

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const data = event.data;
      if (!data || typeof data !== "object") return;
      if (data.type !== "clock-tool:state") return;
      const payload = data.payload as ClockToolState | undefined;
      if (!payload) return;
      stateRef.current = payload;
      setClockState(payload);
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const transport = useMemo(
    () =>
      new DefaultChatTransport<UIMessage>({
        api: `${basePath}/api/clock-chat`,
        prepareSendMessagesRequest: ({ messages, body }) => ({
          body: {
            messages,
            clockState: stateRef.current,
            ...(body ?? {}),
          },
        }),
      }),
    [],
  );

  const { messages, sendMessage, status, stop, setMessages } = useChat({
    transport,
    onError: (error) => console.error("[clock-chat] error:", error),
  });

  const isLoading = status === "submitted" || status === "streaming";
  const canSend = (!!input.trim() || chatFiles.length > 0) && !isLoading;

  useEffect(() => {
    const container = chatScrollRef.current;
    if (!container) return;
    // Follow the latest message only while the user is pinned to the bottom.
    if (isAtBottomRef.current) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages, isLoading]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const saved = await getMathChatHistoryItem(sessionId);
      if (cancelled) return;
      setMessages(saved ? restoreUiMessages(saved.messages) : []);
      // The input is about to be cleared, so a live mic would write the old text
      // back on its next result.
      stopListening();
      setInput("");
      setChatFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId, setMessages, stopListening]);

  useEffect(() => {
    messageHistoryRef.current[activeToolRef.current] = messages;
  }, [messages]);

  useEffect(() => {
    if (messages.length === 0 || status === "streaming" || status === "submitted") {
      return;
    }

    const firstUserText = messages
      .filter((message) => message.role === "user")
      .flatMap((message) => message.parts)
      .find((part) => part.type === "text" && part.text.trim().length > 0);

    void upsertMathChatHistory({
      id: sessionId,
      kind: selectedTool,
      title: firstUserText?.type === "text"
        ? `${selectedTool === "clock-24hrs" ? "24小時時鐘" : "時間差時鐘"}: ${firstUserText.text.slice(0, 30)}`
        : selectedTool === "clock-24hrs"
          ? "24小時時鐘對話"
          : "時間差時鐘對話",
      hasUserQuestion,
      question: hasUserQuestion ? question : undefined,
      type: hasUserQuestion ? type : undefined,
      toolUrl: hasUserQuestion ? toolUrl : undefined,
      selectedTool,
      entryMode: "ai-tool",
      messages: serializeUiMessages(messages),
      updatedAt: new Date().toISOString(),
    });
  }, [hasUserQuestion, messages, question, selectedTool, sessionId, status, toolUrl, type]);

  useEffect(() => {
    if (selectedTool === activeToolRef.current) {
      return;
    }

    messageHistoryRef.current[activeToolRef.current] = messages;
    activeToolRef.current = selectedTool;
    setMessages(messageHistoryRef.current[selectedTool] ?? []);
    setInput("");
    setChatFiles([]);
    setClockState(null);
    stateRef.current = null;
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    // Switching tools clears the input, so any dictation in flight would be
    // writing into a box the student is no longer looking at.
    stopListening();
  }, [messages, selectedTool, setMessages, stopListening]);

  function handleChatFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    if (event.target.files) {
      const picked = Array.from(event.target.files);
      setChatFiles((prev) => [...prev, ...filterUploadsWithinLimit(prev, picked)]);
    }
  }

  function removeChatFile(index: number) {
    setChatFiles((prev) => prev.filter((_, currentIndex) => currentIndex !== index));
  }

  function handlePaste(event: React.ClipboardEvent<HTMLTextAreaElement>) {
    const items = event.clipboardData?.items;
    if (!items) return;

    const imageFiles: File[] = [];
    for (let index = 0; index < items.length; index += 1) {
      if (items[index].type.startsWith("image/")) {
        const file = items[index].getAsFile();
        if (file) imageFiles.push(file);
      }
    }

    if (imageFiles.length === 0) return;
    event.preventDefault();
    setChatFiles((prev) => [...prev, ...filterUploadsWithinLimit(prev, imageFiles)]);
  }

  async function handleSend(text?: string) {
    const value = (text ?? input).trim();
    if (!value && chatFiles.length === 0) return;
    if (isLoading) return;
    if (isListening) stopListening();

    const fileParts = await Promise.all(
      chatFiles.map(async (file) => ({
        type: "file" as const,
        mediaType: file.type,
        filename: file.name,
        url: await fileToDataURL(file),
      })),
    );

    sendMessage({
      text: value || "（見圖片）",
      ...(fileParts.length > 0 ? { files: fileParts } : {}),
    });

    setInput("");
    setChatFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const headerTitle = clockState?.tool === "clock-time-difference" ? "時鐘時間差 AI 助教" : "時鐘概念 AI 助教";
  const headerMeta = !clockState
    ? "等待時鐘工具同步目前狀態"
    : clockState.tool === "clock-time-difference"
      ? `目前題目：${clockState.startLabel} 到 ${clockState.endLabel}`
      : `目前時間：${clockState.displayTime} ${clockState.periodLabel}`.trim();
  const suggestions = clockState ? SUGGESTIONS[clockState.tool] : [];

  return (
    <div className="relative flex min-h-0 w-[360px] shrink-0 flex-col bg-white/95">
      <div className="border-b border-[#d8d8d8] px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ChatAvatar role="assistant" className="h-8 w-8 rounded-[4px]" />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[1px] text-[#ababab]">
                Clock tutor
              </p>
              <p className="text-sm font-semibold text-[#080808]">{headerTitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={onNewChat}
              className="rounded-[4px] border border-transparent bg-[#146ef5] px-2.5 text-xs font-semibold text-white shadow-[0_6px_16px_rgba(20,110,245,0.28)] transition-all hover:bg-[#0055d4] hover:shadow-[0_8px_20px_rgba(0,85,212,0.34)]"
              title="新建聊天"
            >
              New Chat
            </Button>
            {onHide ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={onHide}
                className="rounded-[4px]"
                title="隱藏 AI 助手"
              >
                <PanelRight className="size-4" />
              </Button>
            ) : null}
          </div>
        </div>
        <p className="mt-1.5 text-[11px] text-[#6b7280]">{headerMeta}</p>
      </div>

      <div ref={chatScrollRef} onScroll={handleChatScroll} className="flex-1 min-h-0 overflow-y-auto bg-[linear-gradient(180deg,_rgba(20,110,245,0.03)_0%,_rgba(255,255,255,1)_35%)] px-4 py-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-2 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-[#146ef5]/10 text-[#146ef5]">
              <MessageSquare size={20} />
            </div>
            <p className="text-sm font-semibold text-[#080808]">問我關於目前時鐘的問題</p>
            <p className="text-[11px] text-[#6b7280]">
              我會根據你現在工具上的時間、模式和互動狀態，逐步提示你理解時鐘概念。
            </p>
            <div className="mt-2 flex w-full flex-col gap-1.5">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => void handleSend(suggestion)}
                  className="rounded-md border border-[#d8d8d8] bg-white px-2.5 py-1.5 text-left text-[11px] text-[#080808] transition-colors hover:border-[#b9d3fb] hover:bg-[#f3f6fb]"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex items-start gap-2 ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {message.role === "assistant" ? (
                  <ChatAvatar role="assistant" className="h-8 w-8 rounded-[4px] shadow-[2px_2px_0px_#080808]" />
                ) : null}

                <div
                  className={`max-w-[85%] rounded-[8px] px-3 py-2 text-sm leading-relaxed shadow-[2px_2px_0px_#080808] ${
                    message.role === "user"
                      ? "bg-[#146ef5] text-white"
                      : "border border-[#d8d8d8] bg-white text-[#080808]"
                  }`}
                >
                  {message.parts.map((part, index) => {
                    if (part.type === "text") {
                      return message.role === "assistant" ? (
                        <div
                          key={`${message.id}-${index}`}
                          className="prose prose-sm max-w-none prose-p:my-2 prose-li:my-1 prose-headings:my-2 [&_.katex-display]:overflow-x-auto [&_.katex-display]:overflow-y-hidden"
                        >
                          <ReactMarkdown
                            remarkPlugins={[remarkMath]}
                            rehypePlugins={[[rehypeKatex, { strict: false }]]}
                          >
                            {part.text}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <p key={`${message.id}-${index}`} className="whitespace-pre-wrap">
                          {part.text}
                        </p>
                      );
                    }

                    if (part.type === "file" && part.mediaType?.startsWith("image/")) {
                      return (
                        <img
                          key={`${message.id}-${index}`}
                          src={part.url}
                          alt={part.filename ?? "uploaded"}
                          className="mt-2 max-h-48 rounded-[6px] border border-black/10 object-contain"
                        />
                      );
                    }

                    return null;
                  })}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="border-t border-[#d8d8d8] bg-white px-3 py-3">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void handleSend();
          }}
        >
          <div className="relative w-full rounded-[8px] border border-[#d8d8d8] bg-white shadow-[rgba(0,0,0,0)_0px_84px_24px,rgba(0,0,0,0.01)_0px_54px_22px,rgba(0,0,0,0.04)_0px_30px_18px,rgba(0,0,0,0.08)_0px_13px_13px,rgba(0,0,0,0.09)_0px_3px_7px]">
            {chatFiles.length > 0 && (
              <div className="flex flex-wrap gap-1.5 px-3 pt-2">
                {chatFiles.map((file, index) => (
                  <div key={`${file.name}-${index}`} className="group relative">
                    <img
                      src={URL.createObjectURL(file)}
                      alt={file.name}
                      className="size-12 rounded-[4px] border border-[#d8d8d8] object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeChatFile(index)}
                      className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-[#080808] text-white opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <X className="size-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <Textarea
              value={input}
              onChange={(event) => handleInputChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void handleSend();
                }
              }}
              onPaste={handlePaste}
              placeholder="繼續提問...（可直接粘貼圖片）"
              className="min-h-[58px] max-h-[160px] w-full resize-none overflow-y-auto rounded-[8px] border-0 bg-transparent px-3 pt-3 pb-10 text-sm outline-none focus-visible:ring-0"
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
                  <span aria-live="polite" className="animate-pulse text-[11px] font-medium text-red-500">
                    聆聽中…
                  </span>
                )}
                {!isListening && voiceError && (
                  <span role="alert" className="text-[11px] font-medium text-red-500">
                    {voiceError.message}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {messages.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setMessages([])}
                    className="rounded-md px-2 py-1 text-[11px] text-[#6b7280] hover:bg-[#eef2f7]"
                    title="清除對話"
                  >
                    清除
                  </button>
                )}
                {isLoading ? (
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="outline"
                    className="rounded-[4px]"
                    onClick={() => stop()}
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
          </div>
        </form>
      </div>
    </div>
  );
}