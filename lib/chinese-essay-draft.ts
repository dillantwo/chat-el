import { basePath } from "@/lib/utils";

export interface EssayDraftItem {
  id: string;
  topic: string;
  title: string;
  first: string;
  revised: string;
  final: string;
  updatedAt: string;
  createdAt: string;
}

export function createEssayDraftId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `essay-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function getEssayDrafts(topic?: string): Promise<EssayDraftItem[]> {
  try {
    const url = topic
      ? `${basePath}/api/chinese-essay-draft?topic=${encodeURIComponent(topic)}`
      : `${basePath}/api/chinese-essay-draft`;
    const response = await fetch(url, { credentials: "include" });
    if (!response.ok) return [];
    const json = (await response.json()) as { items?: EssayDraftItem[] };
    return Array.isArray(json.items) ? json.items : [];
  } catch {
    return [];
  }
}

export async function getEssayDraft(id: string): Promise<EssayDraftItem | null> {
  try {
    const response = await fetch(
      `${basePath}/api/chinese-essay-draft?draftId=${encodeURIComponent(id)}`,
      { credentials: "include" },
    );
    if (!response.ok) return null;
    const json = (await response.json()) as { item?: EssayDraftItem | null };
    return json.item ?? null;
  } catch {
    return null;
  }
}

export async function upsertEssayDraft(item: {
  id: string;
  topic: string;
  title: string;
  first: string;
  revised: string;
  final: string;
}): Promise<boolean> {
  try {
    const response = await fetch(`${basePath}/api/chinese-essay-draft`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function deleteEssayDraft(id: string): Promise<boolean> {
  try {
    const response = await fetch(
      `${basePath}/api/chinese-essay-draft?draftId=${encodeURIComponent(id)}`,
      { method: "DELETE", credentials: "include" },
    );
    return response.ok;
  } catch {
    return false;
  }
}

// Teachers read these drafts through /api/chinese-essay-draft/teacher via
// lib/student-data.ts (查看學生數據).
