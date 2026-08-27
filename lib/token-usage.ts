import "server-only";
import { connectDB } from "@/lib/mongodb";
import { TokenUsage } from "@/models/TokenUsage";
import { User } from "@/models/User";
import type { SessionPayload } from "@/lib/session";
import { topicFromEndpoint } from "@/lib/usage-topics";

/**
 * The shape of the `usage` object returned by the AI SDK (`result.usage`).
 * Declared structurally so this helper works with both `streamText` and
 * `generateObject` results without importing provider types.
 */
export interface ProviderUsage {
  inputTokens?: number | null;
  cachedInputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
}

export interface RecordTokenUsageParams {
  /** The caller's session. When null nothing is recorded (anonymous request). */
  session: SessionPayload | null | undefined;
  /** Subject bucket, e.g. "math" | "chinese" | "english" | "science" | "humanities" */
  subject: string;
  /**
   * Topic key from lib/usage-topics.ts. When omitted it is derived from the
   * endpoint so no request goes unattributed.
   */
  topic?: string | null;
  /** Azure deployment / model name used for the request. */
  modelName: string;
  /** The API route that handled the request, e.g. "/api/clock-chat". */
  endpoint: string;
  /** `await result.usage` — safe to pass null/undefined. */
  usage: ProviderUsage | null | undefined;
  /** Embedding tokens spent on RAG retrieval, if any. */
  ragTokens?: number;
  /**
   * The conversation this request belongs to, so admin usage reports can drill
   * down from "this student spent N tokens" to the actual transcript. Must be
   * the id the transcript is SAVED under (the `chatId` of the *-chat-history
   * document), otherwise the drill-down resolves to nothing.
   *
   * Client-supplied, so it is normalized here rather than at each call site.
   */
  chatId?: unknown;
}

/**
 * The shape every chat id in this app actually has: `crypto.randomUUID()`, or
 * the `<prefix>-<timestamp>-<random>` fallback the create*ChatId helpers use
 * where randomUUID is unavailable.
 *
 * Constraining the shape (rather than only the length) matters for two reasons
 * beyond storing tidy data: it keeps an arbitrary client string out of the admin
 * CSV export, where a leading `=`/`+`/`-`/`@` would be interpreted as a formula
 * by Excel, and it bounds what can be echoed back into the admin UI.
 */
const CHAT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

/**
 * Chat ids arrive in a request body, so treat them as untrusted: anything that
 * is not a plausible id is dropped rather than stored. Normalizing here means no
 * route can forget to do it.
 *
 * Note this proves the id is well-formed, not that the caller owns that
 * conversation — a student could tag their own token spend with a chat id
 * belonging to someone else, which would misdirect the admin drill-down. That
 * costs a database round-trip per record to close, so it is accepted for now:
 * the blast radius is a mislabelled usage row, and transcripts themselves stay
 * behind their own per-user checks.
 */
function normalizeChatId(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return CHAT_ID_PATTERN.test(trimmed) ? trimmed : undefined;
}

function toNonNegativeInt(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
}

/**
 * Persist one token-usage record.
 *
 * Call this inside `after(...)` so it never blocks the response. It swallows
 * its own errors — usage accounting must never break a student's request.
 *
 * School, role and display name are denormalized onto the record (read fresh
 * from the User document, falling back to the session) so the admin analytics
 * can group by school without a per-document $lookup, and so historical reports
 * stay stable if a user is later moved or deleted.
 */
export async function recordTokenUsage({
  session,
  subject,
  topic,
  modelName,
  endpoint,
  usage,
  ragTokens = 0,
  chatId,
}: RecordTokenUsageParams): Promise<void> {
  try {
    if (!session || !usage) return;

    await connectDB();

    // Prefer the live User document — the session JWT can be up to 7 days stale.
    let schoolId = session.schoolId ?? null;
    let schoolName = session.schoolName ?? null;
    let displayName = session.displayName ?? null;
    let role: string | null = session.role ?? null;

    try {
      const user = await User.findById(session.userId)
        .populate<{ school: { _id: unknown; name: string } | null }>("school", "name")
        .select("displayName role school")
        .lean();
      if (user) {
        displayName = user.displayName ?? displayName;
        role = user.role ?? role;
        const school = user.school as unknown as { _id: unknown; name: string } | null;
        schoolId = school ? String(school._id) : null;
        schoolName = school ? school.name : null;
      }
    } catch {
      // Fall back to the session values already assigned above.
    }

    const inputTokens = toNonNegativeInt(usage.inputTokens);
    const cachedInputTokens = Math.min(
      toNonNegativeInt(usage.cachedInputTokens),
      inputTokens,
    );
    const completionTokens = toNonNegativeInt(usage.outputTokens);

    await TokenUsage.create({
      userId: session.userId,
      username: session.username,
      displayName,
      role,
      schoolId,
      schoolName,
      subject,
      topic: topic?.trim() || topicFromEndpoint(endpoint, subject),
      modelName,
      // promptTokens holds the NON-cached input portion (see lib/token-cost.ts).
      promptTokens: inputTokens - cachedInputTokens,
      cachedInputTokens,
      completionTokens,
      totalTokens: toNonNegativeInt(usage.totalTokens) || inputTokens + completionTokens,
      ragTokens: toNonNegativeInt(ragTokens),
      chatId: normalizeChatId(chatId),
      endpoint,
    });
  } catch (err) {
    console.error(`[token-usage] Failed to record usage for ${endpoint}:`, err);
  }
}
