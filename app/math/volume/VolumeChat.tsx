"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { ChatAvatar } from "@/components/ChatAvatar";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { ArrowUp, MessageSquare, Sparkles, Square, X } from "lucide-react";
import {
  computeBoundingBox,
  computeEnclosedVolume,
  computePoolVolume,
  computeSurfaceArea,
  projectViews,
  useCubeStore,
} from "./store";
import { basePath } from "@/lib/utils";

/** Snapshot the current scene from the zustand store (no subscription needed). */
function getSceneState() {
  const s = useCubeStore.getState();
  const cubes = Object.values(s.cubes);
  const bbox = computeBoundingBox(cubes);
  return {
    cubeCount: cubes.length,
    volume: cubes.length,
    surfaceArea: computeSurfaceArea(cubes),
    enclosedVolume: computeEnclosedVolume(cubes),
    poolVolume: computePoolVolume(cubes),
    views: projectViews(cubes),
    bbox,
    cubes: cubes.map((c) => ({ x: c.x, y: c.y, z: c.z, color: c.color })),
    mode: s.mode,
    tool: s.tool,
  };
}

const SUGGESTIONS = [
  "可以引導我數一數這個立體的體積嗎？",
  "可以提示我怎樣計算表面積嗎？",
  "把它當作水池時，我應該先觀察哪裡？",
  "可以引導我比較三視圖嗎？",
];

export function VolumeChat() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const handleChatScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }, []);
  const cubeCount = useCubeStore((s) => Object.keys(s.cubes).length);

  const transport = useMemo(
    () =>
      new DefaultChatTransport<UIMessage>({
        api: `${basePath}/api/volume-chat`,
        prepareSendMessagesRequest: ({ messages, body }) => ({
          body: { messages, sceneState: getSceneState(), ...(body ?? {}) },
        }),
      }),
    []
  );

  const { messages, sendMessage, status, stop, setMessages } = useChat({
    transport,
    onError: (err) => console.error("[volume-chat] error:", err),
  });

  const isLoading = status === "submitted" || status === "streaming";

  useEffect(() => {
    if (!open) return;
    const container = chatScrollRef.current;
    if (!container) return;
    // Follow the latest message only while the user is pinned to the bottom.
    if (isAtBottomRef.current) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages, open, isLoading]);

  function handleSend(text?: string) {
    const value = (text ?? input).trim();
    if (!value || isLoading) return;
    sendMessage({ text: value });
    setInput("");
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="absolute bottom-4 right-4 z-20 flex items-center gap-2 rounded-full bg-[#146ef5] px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#146ef5]/30 transition-transform hover:scale-[1.03]"
      >
        <Sparkles size={16} />
        AI 助教
      </button>
    );
  }

  return (
    <div className="absolute bottom-4 right-4 z-20 flex h-[560px] max-h-[calc(100%-32px)] w-[360px] max-w-[calc(100%-32px)] flex-col overflow-hidden rounded-xl border border-[#d8d8d8] bg-white shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#d8d8d8] bg-[#f8fafc] px-3 py-2">
        <div className="flex items-center gap-2">
          <ChatAvatar role="assistant" className="h-7 w-7 rounded-full" />
          <div>
            <div className="text-sm font-bold text-[#080808]">立體積木 AI 助教</div>
            <div className="text-[10px] text-[#6b7280]">場景中有 {cubeCount} 個方塊</div>
          </div>
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
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="grid h-7 w-7 place-items-center rounded-md text-[#6b7280] hover:bg-[#eef2f7]"
            aria-label="關閉"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={chatScrollRef} onScroll={handleChatScroll} className="min-h-0 flex-1 overflow-y-auto bg-white px-3 py-3">
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
          <div className="flex flex-col gap-3">
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
      <div className="border-t border-[#d8d8d8] bg-white p-2">
        <div className="flex items-end gap-1.5">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="例如：怎樣數表面積？"
            rows={1}
            className="max-h-28 flex-1 resize-none rounded-md border border-[#d8d8d8] bg-white px-2.5 py-2 text-xs text-[#080808] outline-none focus:border-[#146ef5]"
          />
          {isLoading ? (
            <button
              type="button"
              onClick={() => stop()}
              className="grid h-9 w-9 place-items-center rounded-md bg-[#ef4444] text-white hover:bg-[#dc2626]"
              aria-label="停止"
            >
              <Square size={14} />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleSend()}
              disabled={!input.trim()}
              className="grid h-9 w-9 place-items-center rounded-md bg-[#146ef5] text-white transition-colors hover:bg-[#0f5bd6] disabled:bg-[#cbd5e1] disabled:text-white/70"
              aria-label="送出"
            >
              <ArrowUp size={16} />
            </button>
          )}
        </div>
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

  return (
    <div className={`flex gap-2 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      <ChatAvatar
        role={isUser ? "user" : "assistant"}
        className={`h-6 w-6 rounded-full ${isUser ? "border border-[#d8d8d8] bg-white" : ""}`}
      />
      <div
        className={`min-w-0 max-w-[85%] overflow-hidden rounded-lg px-2.5 py-2 text-[12.5px] leading-relaxed ${
          isUser
            ? "bg-[#146ef5] text-white"
            : "bg-[#f3f6fb] text-[#080808]"
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{text}</p>
        ) : (
          <div className="w-full min-w-0 break-words font-sans text-[12.5px] leading-relaxed text-[#080808] [overflow-wrap:anywhere] [&_.katex-display]:max-w-full [&_.katex-display]:overflow-x-auto [&_h2]:mb-1 [&_h2]:mt-2 [&_h2]:text-sm [&_h2]:font-semibold [&_li]:my-0.5 [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-4 [&_p]:my-1 [&_strong]:font-semibold [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-4">
            <ReactMarkdown
              remarkPlugins={[remarkMath]}
              rehypePlugins={[[rehypeKatex, { strict: false }]]}
            >
              {text}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
