"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { ChatAvatar } from "@/components/ChatAvatar";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { ArrowUp, ImagePlus, MessageSquare, Mic, MicOff, PanelRight, Square, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { basePath } from "@/lib/utils";
import { filterUploadsWithinLimit } from "@/lib/upload-limits";
import { getMathChatHistoryItem, restoreUiMessages, serializeUiMessages, upsertMathChatHistory } from "@/lib/math-chat-history";

interface SceneCube { x: number; y: number; z: number; color: string }
interface VolumeSceneStateMessage {
  tool: string;
  cubeCount: number;
  volume: number;
  surfaceArea: number;
  enclosedVolume: number;
  poolVolume: number;
  views: { top: number; front: number; side: number };
  cubes: SceneCube[];
  mode: string;
  tool_active: string;
}

const SUGGESTIONS = [
  "現在這個立體有幾個方塊？體積是多少？",
  "怎樣計算它的表面積？",
  "把它當作水池，可以裝多少水？",
  "三視圖看到的形狀有什麼不同？",
];

function deriveBBox(cubes: SceneCube[]) {
  if (cubes.length === 0) {
    return {
      minX: 0, minY: 0, minZ: 0,
      maxX: 0, maxY: 0, maxZ: 0,
      width: 0, height: 0, depth: 0,
      bboxVolume: 0,
    };
  }
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (const c of cubes) {
    if (c.x < minX) minX = c.x; if (c.x > maxX) maxX = c.x;
    if (c.y < minY) minY = c.y; if (c.y > maxY) maxY = c.y;
    if (c.z < minZ) minZ = c.z; if (c.z > maxZ) maxZ = c.z;
  }
  const width = maxX - minX + 1;
  const height = maxY - minY + 1;
  const depth = maxZ - minZ + 1;
  return {
    minX, minY, minZ, maxX, maxY, maxZ,
    width, height, depth,
    bboxVolume: width * height * depth,
  };
}

function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
}

export function VolumeChatPanel({
  sessionId,
  hasUserQuestion,
  question,
  type,
  toolUrl,
  onNewChat,
  onHide,
}: {
  sessionId: string;
  hasUserQuestion: boolean;
  question?: string;
  type?: string;
  toolUrl?: string;
  onNewChat: () => void;
  onHide?: () => void;
}) {
  const [input, setInput] = useState("");
  const [chatFiles, setChatFiles] = useState<File[]>([]);
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const handleChatScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }, []);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const sceneRef = useRef<VolumeSceneStateMessage | null>(null);
  const [cubeCount, setCubeCount] = useState(0);

  // Listen for state updates posted from the embedded volume iframe.
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      const data = e.data;
      if (!data || typeof data !== "object") return;
      if (data.type !== "volume-app:state") return;
      const payload = data.payload as VolumeSceneStateMessage | undefined;
      if (!payload) return;
      sceneRef.current = payload;
      setCubeCount(payload.cubeCount);
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const transport = useMemo(
    () =>
      new DefaultChatTransport<UIMessage>({
        api: `${basePath}/api/volume-chat`,
        prepareSendMessagesRequest: ({ messages, body }) => {
          const p = sceneRef.current;
          const sceneState = p
            ? {
                cubeCount: p.cubeCount,
                volume: p.volume,
                surfaceArea: p.surfaceArea,
                enclosedVolume: p.enclosedVolume,
                poolVolume: p.poolVolume,
                views: p.views,
                bbox: deriveBBox(p.cubes),
                cubes: p.cubes,
                mode: p.mode,
                tool: p.tool_active,
              }
            : null;
          return { body: { messages, sceneState, ...(body ?? {}) } };
        },
      }),
    []
  );

  const { messages, sendMessage, status, stop, setMessages } = useChat({
    transport,
    onError: (err) => console.error("[volume-chat] error:", err),
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
      setInput("");
      setChatFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId, setMessages]);

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
      kind: "volume-cubes",
      title: firstUserText?.type === "text" ? `體積工具: ${firstUserText.text.slice(0, 30)}` : "體積工具對話",
      hasUserQuestion,
      question: hasUserQuestion ? question : undefined,
      type: hasUserQuestion ? type : undefined,
      toolUrl: hasUserQuestion ? toolUrl : undefined,
      selectedTool: "volume-cubes",
      entryMode: "ai-tool",
      messages: serializeUiMessages(messages),
      updatedAt: new Date().toISOString(),
    });
  }, [hasUserQuestion, messages, question, sessionId, status, toolUrl, type]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  useEffect(() => {
    return () => { recognitionRef.current?.stop(); };
  }, []);

  function toggleVoice() {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      alert('您的瀏覽器不支援語音輸入，請使用 Chrome 或 Edge 瀏覽器。');
      return;
    }
    if (isListening) { stopListening(); return; }
    const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) return;
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = 'zh-HK';
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
      if (items[i].type.startsWith("image/")) {
        const file = items[i].getAsFile();
        if (file) imageFiles.push(file);
      }
    }
    if (imageFiles.length === 0) return;
    e.preventDefault();
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
      }))
    );
    sendMessage({
      text: value || "（見圖片）",
      ...(fileParts.length > 0 ? { files: fileParts } : {}),
    });
    setInput("");
    setChatFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="relative flex w-[360px] shrink-0 flex-col min-h-0 bg-white/95">
      {/* Header */}
      <div className="border-b border-[#d8d8d8] px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ChatAvatar role="assistant" className="h-8 w-8 rounded-[4px]" />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[1px] text-[#ababab]">
                Volume tutor
              </p>
              <p className="text-sm font-semibold text-[#080808]">立體積木 AI 助教</p>
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
            {onHide && (
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
            )}
          </div>
        </div>
        <p className="mt-1.5 text-[11px] text-[#6b7280]">場景中有 {cubeCount} 個方塊</p>
      </div>

      {/* Messages */}
      <div ref={chatScrollRef} onScroll={handleChatScroll} className="flex-1 min-h-0 overflow-y-auto bg-[linear-gradient(180deg,_rgba(20,110,245,0.03)_0%,_rgba(255,255,255,1)_35%)] px-4 py-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-2 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-[#146ef5]/10 text-[#146ef5]">
              <MessageSquare size={20} />
            </div>
            <p className="text-sm font-semibold text-[#080808]">問我關於這個立體的問題</p>
            <p className="text-[11px] text-[#6b7280]">
              我會根據你目前放置的方塊，引導你思考體積、表面積或圍起來的空間。
            </p>
            <div className="mt-2 flex w-full flex-col gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleSend(s)}
                  className="rounded-md border border-[#d8d8d8] bg-white px-2.5 py-1.5 text-left text-[11px] text-[#080808] transition-colors hover:border-[#b9d3fb] hover:bg-[#f3f6fb]"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}
            {isLoading && messages[messages.length - 1]?.role === "user" && (
              <div className="flex items-center gap-2 text-xs text-[#6b7280]">
                <ChatAvatar role="assistant" className="h-6 w-6 rounded-full" />
                <span className="flex gap-0.5">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#146ef5]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#146ef5] [animation-delay:0.15s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#146ef5] [animation-delay:0.3s]" />
                </span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-[#d8d8d8] bg-white px-3 py-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
        >
          <div className="relative w-full rounded-[8px] border border-[#d8d8d8] bg-white shadow-[rgba(0,0,0,0)_0px_84px_24px,rgba(0,0,0,0.01)_0px_54px_22px,rgba(0,0,0,0.04)_0px_30px_18px,rgba(0,0,0,0.08)_0px_13px_13px,rgba(0,0,0,0.09)_0px_3px_7px]">
            {chatFiles.length > 0 && (
              <div className="flex flex-wrap gap-1.5 px-3 pt-2">
                {chatFiles.map((file, i) => (
                  <div key={i} className="relative group">
                    <img
                      src={URL.createObjectURL(file)}
                      alt={file.name}
                      className="size-12 rounded-[4px] border border-[#d8d8d8] object-cover"
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

            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              onPaste={handlePaste}
              placeholder="繼續提問...（可直接粘貼圖片）"
              rows={2}
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
                >
                  {isListening ? (
                    <MicOff className="size-3.5" />
                  ) : (
                    <Mic className="size-3.5 text-[#5a5a5a]" />
                  )}
                </Button>
                {isListening && (
                  <span className="text-[11px] font-medium text-red-500 animate-pulse">聆聽中…</span>
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

function MessageBubble({ message }: { message: UIMessage }) {
  const isUser = message.role === "user";
  const text = message.parts
    .filter((p) => p.type === "text")
    .map((p) => (p as { text: string }).text)
    .join("");
  const imageParts = message.parts.filter(
    (p): p is { type: "file"; mediaType: string; url: string; filename?: string } =>
      p.type === "file" && (p as { mediaType?: string }).mediaType?.startsWith("image/") === true
  );

  return (
    <div className={`flex items-start gap-2 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <ChatAvatar
          role="assistant"
          className="h-8 w-8 rounded-[4px] shadow-[2px_2px_0px_#080808]"
        />
      )}
      <div
        className={`prose prose-sm max-w-[85%] rounded-[8px] border px-3 py-2 text-sm leading-relaxed ${
          isUser
            ? "border-[#146ef5] bg-[#146ef5] text-white prose-invert"
            : "border-[#d8d8d8] bg-white text-[#080808] prose-neutral"
        }`}
      >
        {imageParts.length > 0 && (
          <div className="not-prose mb-1.5 flex flex-wrap gap-1.5">
            {imageParts.map((p, i) => (
              <img
                key={i}
                src={p.url}
                alt={p.filename ?? "uploaded image"}
                className="max-h-[180px] max-w-[180px] rounded-[4px] border border-white/30 object-contain"
              />
            ))}
          </div>
        )}
        {isUser ? (
          <p className="whitespace-pre-wrap not-prose m-0">{text}</p>
        ) : (
          <ReactMarkdown
            remarkPlugins={[remarkMath]}
            rehypePlugins={[[rehypeKatex, { strict: false }]]}
          >
            {text}
          </ReactMarkdown>
        )}
      </div>
      {isUser && (
        <ChatAvatar
          role="user"
          className="h-8 w-8 rounded-[4px] border border-[#d8d8d8] bg-white"
        />
      )}
    </div>
  );
}
