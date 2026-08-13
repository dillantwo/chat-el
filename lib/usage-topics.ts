/**
 * Registry of "topics" (learning activities) that consume tokens.
 *
 * Client-safe: do NOT import mongoose models here — this file is used by the
 * admin analytics page as well as by the server-side recording helper.
 *
 * A topic is one level below a subject: 中國語文科 > 林則徐. Every API route that
 * calls an LLM should record a topic key from this registry so the admin
 * dashboard can attribute cost to a specific activity.
 */

export interface TopicMeta {
  /** Stable key stored in TokenUsage.topic */
  key: string;
  /** Subject this topic belongs to */
  subject: string;
  /** Traditional Chinese display label */
  label: string;
}

export const USAGE_TOPICS: TopicMeta[] = [
  // 數學科
  { key: "math-tutor", subject: "math", label: "數學導師對話" },
  { key: "question-classify", subject: "math", label: "題目分類" },
  { key: "clock", subject: "math", label: "時鐘" },
  { key: "volume", subject: "math", label: "體積" },
  { key: "tool-generator", subject: "math", label: "教學工具生成" },
  // 中國語文科
  { key: "chinese-tutor", subject: "chinese", label: "中文導師對話" },
  { key: "lin-zexu", subject: "chinese", label: "林則徐" },
  { key: "scenery", subject: "chinese", label: "景物描寫" },
  { key: "character", subject: "chinese", label: "人物描寫" },
  { key: "wenyan-translation", subject: "chinese", label: "文言文翻譯" },
  { key: "wenyan-application", subject: "chinese", label: "文言文應用" },
  // English Language
  { key: "english-tutor", subject: "english", label: "English Tutor Chat" },
  { key: "location-direction", subject: "english", label: "Location & Direction" },
  { key: "reading-comprehension", subject: "english", label: "Reading Comprehension" },
  { key: "thank-you-letter", subject: "english", label: "Thank You Letter" },
  // 科學科
  { key: "circuit", subject: "science", label: "電路" },
  { key: "aerospace", subject: "science", label: "航天科技" },
  // 人文科
  { key: "water-resources", subject: "humanities", label: "水資源" },
  { key: "anti-japanese-war", subject: "humanities", label: "抗日戰爭" },
];

export const TOPIC_LABELS: Record<string, string> = Object.fromEntries(
  USAGE_TOPICS.map((t) => [t.key, t.label]),
);

export const TOPIC_SUBJECTS: Record<string, string> = Object.fromEntries(
  USAGE_TOPICS.map((t) => [t.key, t.subject]),
);

/**
 * Derive a topic key from the recorded endpoint.
 *
 * Needed for two reasons:
 *  1. Historical records were written before TokenUsage.topic existed.
 *  2. It keeps the reports meaningful if a new route forgets to pass a topic.
 */
export function topicFromEndpoint(
  endpoint: string | null | undefined,
  subject?: string | null,
): string | null {
  if (!endpoint) return null;

  // Historical records annotated the endpoint, e.g.
  // "/api/science-topic/circuit (rag-embedding)". Strip the annotation so the
  // embedding call is attributed to the same topic as the chat call.
  const path = endpoint
    .split("?")[0]
    .replace(/\s*\([^)]*\)\s*$/, "")
    .replace(/\/+$/, "")
    .trim();

  // Dynamic topic routes carry the topic as the last path segment.
  const dynamic = path.match(
    /^\/api\/(?:chinese|science|humanities)-topic\/([^/]+)$/,
  );
  if (dynamic) return dynamic[1];

  switch (path) {
    // Legacy per-topic routes, replaced by /api/<subject>-topic/<topic>.
    case "/api/chinese-lin-zexu":
      return "lin-zexu";
    case "/api/chinese-scenery":
      return "scenery";
    case "/api/chinese-character":
      return "character";
    case "/api/classify":
      return "question-classify";
    case "/api/clock-chat":
      return "clock";
    case "/api/volume-chat":
      return "volume";
    case "/api/generate-html":
      return "tool-generator";
    case "/api/chinese-wenyan":
      return "wenyan-translation";
    case "/api/wenyan-application":
      return "wenyan-application";
    case "/api/english-location-direction":
      return "location-direction";
    case "/api/english-reading-comprehension":
      return "reading-comprehension";
    case "/api/english-thank-you-letter":
      return "thank-you-letter";
    case "/api/chat":
      // The shared tutor endpoint serves several subjects.
      if (subject === "english") return "english-tutor";
      if (subject === "chinese") return "chinese-tutor";
      return "math-tutor";
    default:
      return null;
  }
}

/** Resolve the effective topic key for a usage record (stored value wins). */
export function resolveTopicKey(record: {
  topic?: string | null;
  endpoint?: string | null;
  subject?: string | null;
}): string {
  return (
    record.topic?.trim() ||
    topicFromEndpoint(record.endpoint, record.subject) ||
    "other"
  );
}

/** Human readable label for a topic key, falling back to the raw key. */
export function topicLabel(key: string): string {
  if (key === "other") return "其他";
  return TOPIC_LABELS[key] ?? key;
}
