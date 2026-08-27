/**
 * The message model shared by every hand-rolled chat panel (Chinese topics,
 * English dashboard / thank-you letter / reading comprehension).
 *
 * These panels talk to routes that answer with `toTextStreamResponse()` — a
 * plain text stream — so they keep their own message state instead of using the
 * AI SDK's `useChat`. That buys the typewriter pacing and the ability to send a
 * turn that is never rendered as a bubble. The math workbench and the tool
 * panels use `useChat` against `toUIMessageStreamResponse()` routes and do NOT
 * use anything in this file.
 *
 * The one thing worth knowing: `SavedMessagePart` in the history libs
 * (lib/chinese-chat-history.ts, lib/english-chat-history.ts) is the AI SDK's
 * UIMessage `parts` shape, so `toSavedMessages`/`restoreChatMessages` are the
 * translation layer between the flat `ChatMsg` these panels render and the
 * parts-based transcript the server stores.
 */

export type ChatImage = {
  mediaType: string;
  dataUrl: string;
  filename?: string;
};

export type ChatMsg = {
  id: string;
  role: "user" | "assistant";
  text: string;
  images?: ChatImage[];
};

/** What the chat API routes accept: base64 payloads, not blob URLs. */
export type PayloadMessage = {
  role: "user" | "assistant";
  text: string;
  images?: { mediaType: string; data: string }[];
};

/** Structurally the `SavedChatMessage` the history libs persist. */
export type SavedPart = {
  type: "text" | "file";
  text?: string;
  url?: string;
  mediaType?: string;
  filename?: string;
};

export type SavedMsg = {
  id: string;
  role: "user" | "assistant" | "system";
  parts: SavedPart[];
};

// A per-session counter, because `Date.now()` alone collides: a locally seeded
// opening message and the streaming placeholder that follows it are minted in
// the same millisecond. Two messages sharing an id would both receive the
// typewriter's text, and pin/copy would act on both.
let idCounter = 0;

export function createMessageId(prefix: string) {
  idCounter += 1;
  return `${prefix}-${Date.now()}-${idCounter}`;
}

export function createChatMessage(
  role: ChatMsg["role"],
  text: string,
  images?: readonly ChatImage[],
): ChatMsg {
  return {
    id: createMessageId(role === "user" ? "u" : "a"),
    role,
    text,
    ...(images && images.length > 0 ? { images: [...images] } : {}),
  };
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    // Without this an unreadable file resolved as `undefined` and got posted as
    // `data: undefined`, which the model rejects with an opaque error.
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsDataURL(file);
  });
}

/**
 * Turns picked/pasted files into the base64 images the API expects. Files that
 * cannot be read are dropped and reported, matching how the size guard in
 * lib/upload-limits.ts reports rejects (window.alert).
 */
export async function filesToChatImages(
  files: readonly File[],
  lang: "zh" | "en" = "zh",
): Promise<ChatImage[]> {
  if (files.length === 0) return [];

  const results = await Promise.all(
    files.map(async (file): Promise<ChatImage | null> => {
      try {
        return {
          mediaType: file.type,
          dataUrl: await readAsDataUrl(file),
          filename: file.name,
        };
      } catch {
        return null;
      }
    }),
  );

  const unreadable = files.filter((_, index) => results[index] === null);
  if (unreadable.length > 0 && typeof window !== "undefined") {
    const names = unreadable
      .map((file) => file.name || (lang === "en" ? "untitled file" : "未命名檔案"))
      .join("\n");
    window.alert(
      lang === "en"
        ? `These images could not be read and were skipped:\n${names}`
        : `以下圖片無法讀取，已略過：\n${names}`,
    );
  }

  return results.filter((image): image is ChatImage => image !== null);
}

export function toPayloadMessages(messages: readonly ChatMsg[]): PayloadMessage[] {
  return (
    messages
      // An assistant turn with no text and no images carries nothing, and the
      // routes forward assistant content verbatim. It happens when a reply is
      // cancelled before its first character or when the model returns an empty
      // body, and without this the empty turn would be replayed to the model on
      // every subsequent request. User turns always carry text (the panels
      // substitute a "see image" placeholder), so only assistants are checked.
      .filter((message) => message.role !== "assistant" || message.text || message.images?.length)
      .map((message) => ({
        role: message.role,
        text: message.text,
        ...(message.images && message.images.length > 0
          ? { images: message.images.map((image) => ({ mediaType: image.mediaType, data: image.dataUrl })) }
          : {}),
      }))
  );
}

export function toSavedMessages(messages: readonly ChatMsg[]): SavedMsg[] {
  return messages.map((message) => ({
    id: message.id,
    role: message.role,
    parts: [
      ...(message.text ? [{ type: "text" as const, text: message.text }] : []),
      ...(message.images ?? []).map((image) => ({
        type: "file" as const,
        url: image.dataUrl,
        mediaType: image.mediaType,
        filename: image.filename,
      })),
    ],
  }));
}

export function restoreChatMessages(saved: readonly SavedMsg[]): ChatMsg[] {
  return saved.map((message) => ({
    id: message.id,
    role: message.role as ChatMsg["role"],
    text: message.parts.find((part) => part.type === "text")?.text ?? "",
    images: message.parts
      .filter((part) => part.type === "file")
      .map((part) => ({
        mediaType: part.mediaType ?? "",
        dataUrl: part.url ?? "",
        filename: part.filename,
      })),
  }));
}

/** History list label: the student's opening question, or the topic default. */
export function deriveChatTitle(messages: readonly ChatMsg[], fallback: string) {
  const firstUserText = messages.find((message) => message.role === "user")?.text;
  return firstUserText ? firstUserText.slice(0, 50) : fallback;
}
