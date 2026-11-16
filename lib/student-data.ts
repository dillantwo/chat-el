// Client-safe catalogue and fetchers for the teacher-facing 查看學生數據 page.
//
// Do NOT import models/* here — that pulls mongoose into the client bundle.
// Keep the subject list in sync with lib/subjects.ts.
import { basePath } from "@/lib/utils";
import type { CopyTable, Locale } from "@/lib/i18n/config";
import type { SubjectValue } from "@/lib/subjects";

/**
 * A display label in both interface languages. Only labels are bilingual: the
 * `key` / `value` / `kind` strings are stored data and stay as they are.
 */
export type LocalizedText = CopyTable<string>;

function text(zh: string, en: string): LocalizedText {
  return { "zh-Hant": zh, en };
}

/**
 * Chinese in both interface languages. Used for the Chinese Language subject,
 * whose screens look the same whichever language is picked.
 */
function chineseOnly(zh: string): LocalizedText {
  return { "zh-Hant": zh, en: zh };
}

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
  label: LocalizedText;
}

export interface StudentDataView {
  /** Unique across the whole catalogue; used in the `?view=` deep link. */
  key: string;
  label: LocalizedText;
  description: LocalizedText;
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
  topicLabels: Record<string, LocalizedText>;
}

export interface StudentDataSubject {
  subject: SubjectValue;
  label: LocalizedText;
  accent: string;
  views: StudentDataView[];
}

function labelsOf(topics: TopicOption[]): Record<string, LocalizedText> {
  return Object.fromEntries(topics.map((t) => [t.value, t.label]));
}

/** The badge text for a record's stored topic; unknown topics show the raw value. */
export function topicLabelOf(view: StudentDataView, value: string, locale: Locale): string {
  return view.topicLabels[value]?.[locale] ?? value;
}

// "lin-zexu" (學習林則徐) is intentionally omitted: the unit is not released
// yet, so it must not appear in the teacher student-data viewer.
const CHINESE_WRITING_TOPICS: TopicOption[] = [
  { value: "scenery-description", label: chineseOnly("景物描寫") },
  { value: "character-description", label: chineseOnly("人物描寫") },
];

const CHINESE_ESSAY_TOPICS: TopicOption[] = [
  { value: "scenery-description", label: chineseOnly("景物描寫") },
  { value: "character-description", label: chineseOnly("人物描寫") },
];

// English unit names are English in both locales, as on the /english screens.
const ENGLISH_TOPICS: TopicOption[] = [
  { value: "thank-you-letter", label: text("Thank-you Letter", "Thank-you Letter") },
  {
    value: "reading-comprehension",
    label: text("Reading Comprehension", "Reading Comprehension"),
  },
  {
    value: "location-direction",
    label: text("location and Direction", "Location and Direction"),
  },
];

const SCIENCE_TOPICS: TopicOption[] = [
  { value: "science-circuit", label: text("電力及電路", "Electricity and Circuits") },
  { value: "science-aerospace", label: text("航天科技", "Space Technology") },
];

const HUMANITIES_TOPICS: TopicOption[] = [
  { value: "humanities-water-resources", label: text("水資源", "Water Resources") },
  { value: "humanities-anti-japanese-war", label: text("抗日戰爭", "War of Resistance Against Japan") },
];

// Math history is keyed by `kind` rather than `topic`; the endpoint exposes it
// as `topic` so the shared viewer can label it, but it cannot be filtered.
const MATH_KIND_LABELS: Record<string, LocalizedText> = {
  general: text("數學問答", "Maths Q&A"),
  "volume-cubes": text("體積（積木）", "Volume (Cubes)"),
  "clock-24hrs": text("24小時制時鐘", "24-hour Clock"),
  "clock-time-difference": text("時間差", "Time Difference"),
};

/**
 * Every student-data view, grouped by subject. A teacher only sees the subjects
 * returned by /api/teacher/data-access; each endpoint re-checks that permission
 * — and the class scope — server-side.
 */
export const STUDENT_DATA_CATALOG: StudentDataSubject[] = [
  {
    subject: "math",
    label: text("數學科", "Mathematics"),
    accent: "#16a34a",
    views: [
      {
        key: "math-chat",
        label: text("學生歷史記錄", "Student History"),
        description: text(
          "學生在數學工作台的提問與 AI 對話。",
          "Students' questions and AI chats in the maths workspace.",
        ),
        kind: "chat",
        endpoint: "/api/math-chat-history/teacher",
        filterTopics: [],
        topicLabels: MATH_KIND_LABELS,
      },
    ],
  },
  {
    subject: "chinese",
    label: chineseOnly("中國語文科"),
    accent: "#7a3dff",
    views: [
      {
        key: "chinese-chat",
        label: chineseOnly("學生歷史記錄"),
        description: chineseOnly("學生在寫作單元與 AI 的對話記錄。"),
        kind: "chat",
        endpoint: "/api/chinese-chat-history/teacher",
        filterTopics: CHINESE_WRITING_TOPICS,
        topicLabels: labelsOf(CHINESE_WRITING_TOPICS),
      },
      {
        key: "chinese-essay",
        label: chineseOnly("學生作文稿"),
        description: chineseOnly("初稿、修改版本與終稿的對照。"),
        kind: "essay",
        endpoint: "/api/chinese-essay-draft/teacher",
        filterTopics: CHINESE_ESSAY_TOPICS,
        topicLabels: labelsOf(CHINESE_ESSAY_TOPICS),
      },
    ],
  },
  {
    subject: "english",
    label: text("英國語文科", "English Language"),
    accent: "#00d722",
    views: [
      {
        key: "english-chat",
        label: text("Student History", "Student History"),
        description: text(
          "學生在英文單元與 AI 的對話記錄。",
          "Students' chats with the AI in the English units.",
        ),
        kind: "chat",
        endpoint: "/api/english-chat-history/teacher",
        filterTopics: ENGLISH_TOPICS,
        topicLabels: labelsOf(ENGLISH_TOPICS),
      },
      {
        key: "english-reading",
        label: text("Reading Records", "Reading Records"),
        description: text(
          "閱讀理解測驗的得分與逐題作答。",
          "Reading comprehension scores and answers to each question.",
        ),
        kind: "chat",
        endpoint: "/api/english-reading-record/teacher",
        filterTopics: [],
        topicLabels: { "reading-comprehension": text("閱讀理解", "Reading Comprehension") },
      },
    ],
  },
  {
    subject: "science",
    label: text("科學科", "Science"),
    accent: "#ff6b00",
    views: [
      {
        key: "science-chat",
        label: text("學生歷史記錄", "Student History"),
        description: text(
          "學生在科學單元與 AI 的對話記錄。",
          "Students' chats with the AI in the science units.",
        ),
        kind: "chat",
        endpoint: "/api/science-chat-history/teacher",
        filterTopics: SCIENCE_TOPICS,
        topicLabels: labelsOf(SCIENCE_TOPICS),
      },
    ],
  },
  {
    subject: "humanities",
    label: text("人文科", "Humanities"),
    accent: "#ed52cb",
    views: [
      {
        key: "humanities-chat",
        label: text("學生歷史記錄", "Student History"),
        description: text(
          "學生在人文單元與 AI 的對話記錄。",
          "Students' chats with the AI in the humanities units.",
        ),
        kind: "chat",
        endpoint: "/api/humanities-chat-history/teacher",
        filterTopics: HUMANITIES_TOPICS,
        topicLabels: labelsOf(HUMANITIES_TOPICS),
      },
      {
        key: "humanities-podcast",
        label: text("學生語音播客", "Student Podcasts"),
        description: text(
          "抗日戰爭單元的錄音與文稿。",
          "Recordings and scripts from the War of Resistance Against Japan unit.",
        ),
        kind: "podcast",
        endpoint: "/api/humanities-podcast/teacher",
        fixedTopic: "anti-japanese-war",
        filterTopics: [],
        topicLabels: { "anti-japanese-war": text("抗日戰爭", "War of Resistance Against Japan") },
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
