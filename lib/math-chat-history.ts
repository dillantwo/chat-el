import type { UIMessage } from "ai";
import { basePath } from "@/lib/utils";

export interface SavedMessagePart {
  type: "text" | "file";
  text?: string;
  url?: string;
  mediaType?: string;
  filename?: string;
}

export interface SavedChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  parts: SavedMessagePart[];
}

export type MathChatKind = "general" | "volume-cubes" | "clock-24hrs" | "clock-time-difference";
export type MathDashboardEntryMode = "question" | "ai-tool";

export interface MathChatHistoryItem {
  id: string;
  kind: MathChatKind;
  title: string;
  hasUserQuestion?: boolean;
  question?: string;
  type?: string;
  selectedTool?: string | null;
  toolUrl?: string;
  entryMode?: MathDashboardEntryMode;
  messages: SavedChatMessage[];
  updatedAt: string;
}

export function createMathChatId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `math-chat-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function serializeUiMessages(messages: UIMessage[]): SavedChatMessage[] {
  return messages.map((message) => ({
    id: message.id,
    role: message.role,
    parts: message.parts.reduce<SavedMessagePart[]>((parts, part) => {
      if (part.type === "text") {
        parts.push({ type: "text", text: part.text });
      } else if (part.type === "file") {
        parts.push({
          type: "file",
          url: part.url,
          mediaType: part.mediaType,
          filename: part.filename,
        });
      }
      return parts;
    }, []),
  }));
}

export function restoreUiMessages(savedMessages: SavedChatMessage[]): UIMessage[] {
  return savedMessages.map((message) => ({
    id: message.id,
    role: message.role,
    parts: message.parts.map((part) =>
      part.type === "text"
        ? { type: "text" as const, text: part.text ?? "", state: "done" as const }
        : {
            type: "file" as const,
            url: part.url ?? "",
            mediaType: part.mediaType ?? "application/octet-stream",
            filename: part.filename,
          },
    ),
  }));
}

export async function getMathChatHistory(): Promise<MathChatHistoryItem[]> {
  try {
    const response = await fetch(`${basePath}/api/math-chat-history`, { credentials: "include" });
    if (!response.ok) return [];
    const json = (await response.json()) as { items?: MathChatHistoryItem[] };
    return Array.isArray(json.items) ? json.items : [];
  } catch {
    return [];
  }
}

export async function getMathChatHistoryItem(id: string) {
  try {
    const response = await fetch(`${basePath}/api/math-chat-history?chatId=${encodeURIComponent(id)}`, {
      credentials: "include",
    });
    if (!response.ok) return null;
    const json = (await response.json()) as { item?: MathChatHistoryItem | null };
    return json.item ?? null;
  } catch {
    return null;
  }
}

export async function upsertMathChatHistory(item: MathChatHistoryItem) {
  try {
    const response = await fetch(`${basePath}/api/math-chat-history`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item),
    });
    if (!response.ok) {
      throw new Error("save failed");
    }
    window.dispatchEvent(new CustomEvent("math-chat-history:changed"));
  } catch {
    // Keep history writes silent in UI.
  }
}

export async function deleteMathChatHistoryItem(id: string) {
  try {
    const response = await fetch(`${basePath}/api/math-chat-history?chatId=${encodeURIComponent(id)}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!response.ok) {
      throw new Error("delete failed");
    }
    window.dispatchEvent(new CustomEvent("math-chat-history:changed"));
  } catch {
    // Keep deletes silent in UI.
  }
}

// Teachers read this history through /api/math-chat-history/teacher via
// lib/student-data.ts (查看學生數據).
