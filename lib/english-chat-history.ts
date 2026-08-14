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

export interface EnglishChatHistoryItem {
  id: string;
  title: string;
  topic: string;
  selectedTask?: number | null;
  studentRole?: string | null;
  messages: SavedChatMessage[];
  updatedAt: string;
}

export function createEnglishChatId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `eng-chat-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
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

/**
 * A row in the history list. `messages` is absent on purpose: the API projects
 * the transcript out of the list response (it carries every image as base64),
 * so a sidebar refresh stays small no matter how long the conversations are.
 * Use getEnglishChatHistoryItem() when the transcript is needed.
 */
export type EnglishChatHistorySummary = Omit<EnglishChatHistoryItem, "messages">;

export async function getEnglishChatHistory(topic?: string): Promise<EnglishChatHistorySummary[]> {
  try {
    const url = topic
      ? `${basePath}/api/english-chat-history?topic=${encodeURIComponent(topic)}`
      : `${basePath}/api/english-chat-history`;
    const response = await fetch(url, { credentials: "include" });
    if (!response.ok) return [];
    const json = (await response.json()) as { items?: EnglishChatHistorySummary[] };
    return Array.isArray(json.items) ? json.items : [];
  } catch {
    return [];
  }
}

export async function getEnglishChatHistoryItem(id: string): Promise<EnglishChatHistoryItem | null> {
  try {
    const response = await fetch(`${basePath}/api/english-chat-history?chatId=${encodeURIComponent(id)}`, {
      credentials: "include",
    });
    if (!response.ok) return null;
    const json = (await response.json()) as { item?: EnglishChatHistoryItem | null };
    return json.item ?? null;
  } catch {
    return null;
  }
}

export async function upsertEnglishChatHistory(item: EnglishChatHistoryItem) {
  try {
    const response = await fetch(`${basePath}/api/english-chat-history`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item),
    });
    if (!response.ok) {
      throw new Error("save failed");
    }
    window.dispatchEvent(new CustomEvent("english-chat-history:changed"));
  } catch {
    // Keep history writes silent in UI.
  }
}

export async function deleteEnglishChatHistoryItem(id: string) {
  try {
    const response = await fetch(`${basePath}/api/english-chat-history?chatId=${encodeURIComponent(id)}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!response.ok) {
      throw new Error("delete failed");
    }
    window.dispatchEvent(new CustomEvent("english-chat-history:changed"));
  } catch {
    // Keep deletes silent in UI.
  }
}

// Teachers read this history through /api/english-chat-history/teacher via
// lib/student-data.ts (查看學生數據).
