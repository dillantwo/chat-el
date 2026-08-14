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

export interface ChineseChatHistoryItem {
  id: string;
  title: string;
  topic: string;
  messages: SavedChatMessage[];
  updatedAt: string;
}

export function createChineseChatId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `chi-chat-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * A row in the history list. `messages` is absent on purpose: the API projects
 * the transcript out of the list response (it carries every image as base64),
 * so a sidebar refresh stays small no matter how long the conversations are.
 * Use getChineseChatHistoryItem() when the transcript is needed.
 */
export type ChineseChatHistorySummary = Omit<ChineseChatHistoryItem, "messages">;

export async function getChineseChatHistory(topic?: string): Promise<ChineseChatHistorySummary[]> {
  try {
    const url = topic
      ? `${basePath}/api/chinese-chat-history?topic=${encodeURIComponent(topic)}`
      : `${basePath}/api/chinese-chat-history`;
    const response = await fetch(url, { credentials: "include" });
    if (!response.ok) return [];
    const json = (await response.json()) as { items?: ChineseChatHistorySummary[] };
    return Array.isArray(json.items) ? json.items : [];
  } catch {
    return [];
  }
}

export async function getChineseChatHistoryItem(id: string): Promise<ChineseChatHistoryItem | null> {
  try {
    const response = await fetch(`${basePath}/api/chinese-chat-history?chatId=${encodeURIComponent(id)}`, {
      credentials: "include",
    });
    if (!response.ok) return null;
    const json = (await response.json()) as { item?: ChineseChatHistoryItem | null };
    return json.item ?? null;
  } catch {
    return null;
  }
}

export async function upsertChineseChatHistory(item: ChineseChatHistoryItem) {
  try {
    const response = await fetch(`${basePath}/api/chinese-chat-history`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item),
    });
    if (!response.ok) {
      throw new Error("save failed");
    }
    window.dispatchEvent(new CustomEvent("chinese-chat-history:changed"));
  } catch {
    // Keep history writes silent in UI.
  }
}

export async function deleteChineseChatHistoryItem(id: string) {
  try {
    const response = await fetch(`${basePath}/api/chinese-chat-history?chatId=${encodeURIComponent(id)}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!response.ok) {
      throw new Error("delete failed");
    }
    window.dispatchEvent(new CustomEvent("chinese-chat-history:changed"));
  } catch {
    // Keep deletes silent in UI.
  }
}

// Teachers read Chinese, Science and Humanities history (all stored in this
// collection, distinguished by topic) through the matching /teacher endpoints
// via lib/student-data.ts (查看學生數據).
