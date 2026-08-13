// Client-safe catalogue and fetchers for the teacher-facing 查看學生數據 page.
//
// Do NOT import models/* here — that pulls mongoose into the client bundle.
// Keep the subject list in sync with lib/subjects.ts.
import { basePath } from "@/lib/utils";
import type { SubjectValue } from "@/lib/subjects";

// --- Record shapes returned by the /teacher endpoints ---

export interface StudentSummary {
  id: string;
  displayName: string;
  username: string;
  count: number;
  lastUpdatedAt: string | null;
}

export interface RecordMessagePart {
  type: "text" | "file";
  text?: string;
  url?: string;
  mediaType?: string;
  filename?: string;
}

export interface ChatRecord {
  id: string;
  title: string;
  topic: string;
  messages: { id: string; role: string; parts: RecordMessagePart[] }[];
  updatedAt: string;
}

export interface EssayDraftRecord {
  id: string;
  title: string;
  topic: string;
  first: string;
  revised: string;
  final: string;
  createdAt: string;
  updatedAt: string;
}

export interface PodcastRecord {
  id: string;
  title: string;
  topic: string;
  script: string;
  mimeType: string;
  durationSec: number;
  sizeBytes: number;
  createdAt: string;
  updatedAt: string;
}

/** Every record kind is reduced to one of these three viewers. */
export type StudentDataViewKind = "chat" | "essay" | "podcast";

export interface TopicOption {
  value: string;
  label: string;
}

export interface StudentDataView {
  /** Unique across the whole catalogue; used in the `?view=` deep link. */
  key: string;
  label: string;
  description: string;
  kind: StudentDataViewKind;
  /** Teacher endpoint, appended to basePath. */
  endpoint: string;
  /**
   * Sent as `?topic=` on every request. Used by views whose endpoint serves a
   * single topic (the humanities podcast) rather than a filterable set.
   */
  fixedTopic?: string;
  /** Topics the teacher can filter by. Empty means the endpoint has no filter. */
  filterTopics: TopicOption[];
  /** Labels for the topic badge on each record. */
  topicLabels: Record<string, string>;
}

export interface StudentDataSubject {
  subject: SubjectValue;
  label: string;
  labelEn: string;
  accent: string;
  views: StudentDataView[];
}

function labelsOf(topics: TopicOption[]): Record<string, string> {
  return Object.fromEntries(topics.map((t) => [t.value, t.label]));
}

// "lin-zexu" (學習林則徐) is intentionally omitted: the unit is not released
// yet, so it must not appear in the teacher student-data viewer.
const CHINESE_WRITING_TOPICS: TopicOption[] = [
  { value: "scenery-description", label: "景物描寫" },
  { value: "character-description", label: "人物描寫" },
];

const CHINESE_ESSAY_TOPICS: TopicOption[] = [
  { value: "scenery-description", label: "景物描寫" },
  { value: "character-description", label: "人物描寫" },
];

const ENGLISH_TOPICS: TopicOption[] = [
  { value: "thank-you-letter", label: "感謝信" },
  { value: "reading-comprehension", label: "閱讀理解" },
  { value: "location-direction", label: "位置與方向" },
];

const SCIENCE_TOPICS: TopicOption[] = [
  { value: "science-circuit", label: "電力及電路" },
  { value: "science-aerospace", label: "航天科技" },
];

const HUMANITIES_TOPICS: TopicOption[] = [
  { value: "humanities-water-resources", label: "水資源" },
  { value: "humanities-anti-japanese-war", label: "抗日戰爭" },
];

// Math history is keyed by `kind` rather than `topic`; the endpoint exposes it
// as `topic` so the shared viewer can label it, but it cannot be filtered.
const MATH_KIND_LABELS: Record<string, string> = {
  general: "數學問答",
  "volume-cubes": "體積（積木）",
  "clock-24hrs": "24小時制時鐘",
  "clock-time-difference": "時間差",
};

/**
 * Every student-data view, grouped by subject. A teacher only sees the subjects
 * returned by /api/teacher/data-access; each endpoint re-checks that permission
 * — and the class scope — server-side.
 */
export const STUDENT_DATA_CATALOG: StudentDataSubject[] = [
  {
    subject: "math",
    label: "數學科",
    labelEn: "Mathematics",
    accent: "#16a34a",
    views: [
      {
        key: "math-chat",
        label: "學生歷史記錄",
        description: "學生在數學工作台的提問與 AI 對話。",
        kind: "chat",
        endpoint: "/api/math-chat-history/teacher",
        filterTopics: [],
        topicLabels: MATH_KIND_LABELS,
      },
    ],
  },
  {
    subject: "chinese",
    label: "中國語文科",
    labelEn: "Chinese Language",
    accent: "#7a3dff",
    views: [
      {
        key: "chinese-chat",
        label: "學生歷史記錄",
        description: "學生在寫作單元與 AI 的對話記錄。",
        kind: "chat",
        endpoint: "/api/chinese-chat-history/teacher",
        filterTopics: CHINESE_WRITING_TOPICS,
        topicLabels: labelsOf(CHINESE_WRITING_TOPICS),
      },
      {
        key: "chinese-essay",
        label: "學生作文稿",
        description: "初稿、修改版本與終稿的對照。",
        kind: "essay",
        endpoint: "/api/chinese-essay-draft/teacher",
        filterTopics: CHINESE_ESSAY_TOPICS,
        topicLabels: labelsOf(CHINESE_ESSAY_TOPICS),
      },
    ],
  },
  {
    subject: "english",
    label: "英國語文科",
    labelEn: "English Language",
    accent: "#00d722",
    views: [
      {
        key: "english-chat",
        label: "Student History",
        description: "學生在英文單元與 AI 的對話記錄。",
        kind: "chat",
        endpoint: "/api/english-chat-history/teacher",
        filterTopics: ENGLISH_TOPICS,
        topicLabels: labelsOf(ENGLISH_TOPICS),
      },
      {
        key: "english-reading",
        label: "Reading Records",
        description: "閱讀理解測驗的得分與逐題作答。",
        kind: "chat",
        endpoint: "/api/english-reading-record/teacher",
        filterTopics: [],
        topicLabels: { "reading-comprehension": "閱讀理解" },
      },
    ],
  },
  {
    subject: "science",
    label: "科學科",
    labelEn: "Science",
    accent: "#ff6b00",
    views: [
      {
        key: "science-chat",
        label: "學生歷史記錄",
        description: "學生在科學單元與 AI 的對話記錄。",
        kind: "chat",
        endpoint: "/api/science-chat-history/teacher",
        filterTopics: SCIENCE_TOPICS,
        topicLabels: labelsOf(SCIENCE_TOPICS),
      },
    ],
  },
  {
    subject: "humanities",
    label: "人文科",
    labelEn: "Humanities",
    accent: "#ed52cb",
    views: [
      {
        key: "humanities-chat",
        label: "學生歷史記錄",
        description: "學生在人文單元與 AI 的對話記錄。",
        kind: "chat",
        endpoint: "/api/humanities-chat-history/teacher",
        filterTopics: HUMANITIES_TOPICS,
        topicLabels: labelsOf(HUMANITIES_TOPICS),
      },
      {
        key: "humanities-podcast",
        label: "學生語音博客",
        description: "抗日戰爭單元的錄音與文稿。",
        kind: "podcast",
        endpoint: "/api/humanities-podcast/teacher",
        fixedTopic: "anti-japanese-war",
        filterTopics: [],
        topicLabels: { "anti-japanese-war": "抗日戰爭" },
      },
    ],
  },
];

export function findSubjectEntry(subject: string): StudentDataSubject | null {
  return STUDENT_DATA_CATALOG.find((s) => s.subject === subject) ?? null;
}

// --- Fetchers ---
// Every teacher endpoint shares the same contract: no query = student list,
// `?studentId=` = that student's records. Failures resolve to an empty result
// so a revoked permission or a network blip degrades to "no data" rather than
// breaking the page.

function buildUrl(
  view: StudentDataView,
  params: Record<string, string | undefined>,
): string {
  const search = new URLSearchParams();
  if (view.fixedTopic) search.set("topic", view.fixedTopic);
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const query = search.toString();
  return `${basePath}${view.endpoint}${query ? `?${query}` : ""}`;
}

/**
 * A class the teacher belongs to. `classId` is optional on every fetch: without
 * it the server scopes to all of the teacher's classes, and a class they do not
 * belong to yields nothing rather than an error.
 */
export interface TeacherClass {
  id: string;
  name: string;
  academicYear: string;
}

export interface TeacherDataAccess {
  subjects: SubjectValue[];
  classes: TeacherClass[];
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** What the signed-in teacher may review: permitted subjects and own classes. */
export async function fetchTeacherDataAccess(): Promise<TeacherDataAccess> {
  const json = await fetchJson<Partial<TeacherDataAccess>>(
    `${basePath}/api/teacher/data-access`,
  );
  return {
    subjects: Array.isArray(json?.subjects) ? json.subjects : [],
    classes: Array.isArray(json?.classes) ? json.classes : [],
  };
}

export async function fetchStudents(
  view: StudentDataView,
  topic?: string,
  classId?: string,
): Promise<StudentSummary[]> {
  const json = await fetchJson<{ students?: StudentSummary[] }>(
    buildUrl(view, { topic, classId }),
  );
  return Array.isArray(json?.students) ? json.students : [];
}

export async function fetchStudentRecords<T>(
  view: StudentDataView,
  studentId: string,
  topic?: string,
  classId?: string,
): Promise<T[]> {
  const json = await fetchJson<{ items?: T[] }>(
    buildUrl(view, { studentId, topic, classId }),
  );
  return Array.isArray(json?.items) ? json.items : [];
}

/**
 * Podcast audio can be tens of megabytes (it is returned as a base64 data URL),
 * so it is fetched per recording only when the teacher presses play.
 */
export async function fetchPodcastAudio(
  view: StudentDataView,
  studentId: string,
  recordingId: string,
  classId?: string,
): Promise<string> {
  const json = await fetchJson<{ item?: { audioData?: string } }>(
    buildUrl(view, { studentId, recordingId, classId }),
  );
  return json?.item?.audioData ?? "";
}
