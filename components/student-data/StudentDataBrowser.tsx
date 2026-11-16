"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FileText, Headphones, Loader2, MessageSquare, Mic, Users } from "lucide-react";
import { useCopy, useLocale } from "@/components/LocaleProvider";
import { MarkdownBlock, MathText } from "@/components/student-data/markdown";
import { COMMON_COPY } from "@/lib/i18n/common";
import { defineCopy, intlLocale, type Locale } from "@/lib/i18n/config";
import {
  fetchPodcastAudio,
  fetchStudentRecords,
  fetchStudents,
  topicLabelOf,
  type ChatRecord,
  type EssayDraftRecord,
  type PodcastRecord,
  type StudentDataView,
  type StudentSummary,
} from "@/lib/student-data";

/** Sent as `?topic=` only when a specific topic is picked. */
const ALL_TOPICS = "";

/**
 * The three record kinds share the same navigation (student → record →
 * content), so they are normalised into one shape for the list panes and only
 * the content pane branches on kind.
 */
interface BrowserRecord {
  id: string;
  title: string;
  topic: string;
  updatedAt: string;
  chat?: ChatRecord;
  essay?: EssayDraftRecord;
  podcast?: PodcastRecord;
}

const COPY = defineCopy({
  "zh-Hant": {
    unit: "單元",
    allTopics: "全部",
    students: (n: number) => `學生${n > 0 ? `（${n}）` : ""}`,
    recordCount: (n: number) => `${n} 則`,
    noStudents: "暫無學生記錄",
    pickStudentFirst: "請先選擇學生",
    noRecordsForStudent: "此學生暫無記錄",
    pickStudentToView: "選擇學生以查看記錄",
    pickRecordToView: "選擇記錄以查看內容",
    noChatContent: "此記錄沒有對話內容。",
    imageAlt: "image",
    drafts: { first: "初稿", revised: "修改版本", final: "終稿" },
    notWritten: "尚未撰寫",
    duration: (time: string) => `時長 ${time}`,
    loadAndPlay: "載入並播放",
  },
  en: {
    unit: "Unit",
    allTopics: "All",
    students: (n: number) => `Students${n > 0 ? ` (${n})` : ""}`,
    recordCount: (n: number) => `${n} ${n === 1 ? "record" : "records"}`,
    noStudents: "No student records yet",
    pickStudentFirst: "Choose a student first",
    noRecordsForStudent: "No records for this student yet",
    pickStudentToView: "Choose a student to see their records",
    pickRecordToView: "Choose a record to see it",
    noChatContent: "This record has no messages.",
    imageAlt: "image",
    drafts: { first: "First draft", revised: "Revised draft", final: "Final draft" },
    notWritten: "Not written yet",
    duration: (time: string) => `Length ${time}`,
    loadAndPlay: "Load and play",
  },
});

const DRAFT_STAGES: ("first" | "revised" | "final")[] = ["first", "revised", "final"];

function formatDateTime(value: string | null | undefined, locale: Locale): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString(intlLocale(locale));
}

function formatDuration(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatBytes(bytes: number): string {
  if (!bytes) return "—";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** 8% alpha tint of a 6-digit hex colour, for selected rows. */
function tint(hex: string): string {
  return /^#[0-9a-f]{6}$/i.test(hex) ? `${hex}14` : "transparent";
}

async function loadRecords(
  view: StudentDataView,
  studentId: string,
  topic: string,
  classId: string,
): Promise<BrowserRecord[]> {
  const activeTopic = topic || undefined;
  const activeClass = classId || undefined;

  if (view.kind === "essay") {
    const items = await fetchStudentRecords<EssayDraftRecord>(
      view,
      studentId,
      activeTopic,
      activeClass,
    );
    return items.map((essay) => ({
      id: essay.id,
      title: essay.title,
      topic: essay.topic,
      updatedAt: essay.updatedAt,
      essay,
    }));
  }

  if (view.kind === "podcast") {
    const items = await fetchStudentRecords<PodcastRecord>(
      view,
      studentId,
      activeTopic,
      activeClass,
    );
    return items.map((podcast) => ({
      id: podcast.id,
      title: podcast.title,
      topic: podcast.topic,
      updatedAt: podcast.updatedAt,
      podcast,
    }));
  }

  const items = await fetchStudentRecords<ChatRecord>(view, studentId, activeTopic, activeClass);
  return items.map((chat) => ({
    id: chat.id,
    title: chat.title,
    topic: chat.topic,
    updatedAt: chat.updatedAt,
    chat,
  }));
}

export default function StudentDataBrowser({
  view,
  accent,
  classId = "",
}: {
  view: StudentDataView;
  accent: string;
  /** Empty means "all of the teacher's classes". */
  classId?: string;
}) {
  const copy = useCopy(COPY);
  const common = useCopy(COMMON_COPY);
  const { locale } = useLocale();
  const [topic, setTopic] = useState<string>(ALL_TOPICS);
  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(true);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [records, setRecords] = useState<BrowserRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [audioByRecordId, setAudioByRecordId] = useState<Record<string, string>>({});
  const [loadingAudioId, setLoadingAudioId] = useState<string>("");

  const topicLabel = useCallback(
    (value: string) => topicLabelOf(view, value, locale),
    [view, locale],
  );

  // Reset the topic filter when switching to another view.
  useEffect(() => {
    setTopic(ALL_TOPICS);
  }, [view.key]);

  // Load the students who have records for this view + topic.
  useEffect(() => {
    let cancelled = false;
    setStudentsLoading(true);
    setSelectedStudentId(null);
    setRecords([]);
    setSelectedRecordId(null);
    setAudioByRecordId({});

    fetchStudents(view, topic || undefined, classId || undefined)
      .then((items) => {
        if (!cancelled) setStudents(items);
      })
      .finally(() => {
        if (!cancelled) setStudentsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [view, topic, classId]);

  // Load the selected student's records.
  useEffect(() => {
    if (!selectedStudentId) return;
    let cancelled = false;
    setRecordsLoading(true);
    setRecords([]);
    setSelectedRecordId(null);
    setAudioByRecordId({});

    loadRecords(view, selectedStudentId, topic, classId)
      .then((items) => {
        if (cancelled) return;
        setRecords(items);
        setSelectedRecordId(items[0]?.id ?? null);
      })
      .finally(() => {
        if (!cancelled) setRecordsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [view, selectedStudentId, topic, classId]);

  const selectedStudent = useMemo(
    () => students.find((s) => s.id === selectedStudentId) ?? null,
    [students, selectedStudentId],
  );

  const selectedRecord = useMemo(
    () => records.find((r) => r.id === selectedRecordId) ?? null,
    [records, selectedRecordId],
  );

  const playAudio = useCallback(
    async (recordingId: string) => {
      if (!selectedStudentId || audioByRecordId[recordingId]) return;
      setLoadingAudioId(recordingId);
      try {
        const audioData = await fetchPodcastAudio(
          view,
          selectedStudentId,
          recordingId,
          classId || undefined,
        );
        if (audioData) {
          setAudioByRecordId((prev) => ({ ...prev, [recordingId]: audioData }));
        }
      } finally {
        setLoadingAudioId("");
      }
    },
    [view, selectedStudentId, audioByRecordId, classId],
  );

  const recordIcon =
    view.kind === "essay" ? FileText : view.kind === "podcast" ? Headphones : MessageSquare;
  const RecordIcon = recordIcon;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[10px] border border-[#d8d8d8] bg-white">
      {view.filterTopics.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-[#e8e8e8] px-4 py-3">
          <span className="text-[11px] font-semibold uppercase tracking-[1px] text-[#ababab]">
            {copy.unit}
          </span>
          {[
            { value: ALL_TOPICS, label: copy.allTopics },
            ...view.filterTopics.map((t) => ({ value: t.value, label: t.label[locale] })),
          ].map((option) => {
            const active = topic === option.value;
            return (
              <button
                key={option.value || "all"}
                type="button"
                onClick={() => setTopic(option.value)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  active ? "text-[#080808]" : "border-[#d8d8d8] text-[#5a5a5a] hover:bg-[#f7f8fb]"
                }`}
                style={active ? { borderColor: accent, backgroundColor: tint(accent) } : undefined}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Pane 1: students */}
        <div className="max-h-56 shrink-0 overflow-y-auto border-b border-[#e8e8e8] bg-[#fbfbfb] p-2 lg:max-h-none lg:w-56 lg:border-b-0 lg:border-r">
          <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#ababab]">
            {copy.students(students.length)}
          </p>
          {studentsLoading ? (
            <p className="flex items-center gap-2 px-3 py-2 text-xs text-[#5a5a5a]">
              <Loader2 className="size-3.5 animate-spin" /> {common.loading}
            </p>
          ) : students.length > 0 ? (
            <div className="space-y-1">
              {students.map((student) => {
                const active = selectedStudentId === student.id;
                return (
                  <button
                    key={student.id}
                    type="button"
                    onClick={() => setSelectedStudentId(student.id)}
                    className={`flex w-full items-center gap-2.5 rounded-lg border px-2 py-2 text-left transition-colors ${
                      active ? "" : "border-transparent hover:bg-[#f0f0f0]"
                    }`}
                    style={
                      active ? { borderColor: accent, backgroundColor: tint(accent) } : undefined
                    }
                  >
                    <span
                      className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                      style={{ backgroundColor: tint(accent), color: accent }}
                    >
                      {student.displayName.charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium">
                        {student.displayName}
                      </span>
                      <span className="block text-[10px] text-[#ababab]">
                        @{student.username} · {copy.recordCount(student.count)}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-[#ababab]">
              <Users className="mb-2 size-8 opacity-30" />
              <p className="text-xs">{copy.noStudents}</p>
            </div>
          )}
        </div>

        {/* Pane 2: the selected student's records */}
        <div className="max-h-56 shrink-0 overflow-y-auto border-b border-[#e8e8e8] p-2 lg:max-h-none lg:w-72 lg:border-b-0 lg:border-r">
          <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#ababab]">
            {view.label[locale]}
          </p>
          {!selectedStudentId ? (
            <p className="px-3 py-2 text-xs text-[#ababab]">{copy.pickStudentFirst}</p>
          ) : recordsLoading ? (
            <p className="flex items-center gap-2 px-3 py-2 text-xs text-[#5a5a5a]">
              <Loader2 className="size-3.5 animate-spin" /> {common.loading}
            </p>
          ) : records.length > 0 ? (
            <div className="space-y-1">
              {records.map((record) => {
                const active = selectedRecordId === record.id;
                return (
                  <button
                    key={record.id}
                    type="button"
                    onClick={() => setSelectedRecordId(record.id)}
                    className={`flex w-full items-start gap-2 rounded-lg border px-2 py-1.5 text-left transition-colors ${
                      active ? "" : "border-transparent hover:bg-[#f0f0f0]"
                    }`}
                    style={
                      active ? { borderColor: accent, backgroundColor: tint(accent) } : undefined
                    }
                  >
                    <RecordIcon
                      className="mt-0.5 size-3.5 shrink-0"
                      style={{ color: active ? accent : "#ababab" }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="line-clamp-2 text-xs font-medium leading-snug">
                        <MathText>{record.title}</MathText>
                      </div>
                      <p className="mt-0.5 flex flex-wrap items-center gap-1 text-[10px] text-[#ababab]">
                        <span
                          className="inline-flex items-center rounded-[4px] px-1.5 py-0.5 font-medium"
                          style={{ backgroundColor: tint(accent), color: accent }}
                        >
                          {topicLabel(record.topic)}
                        </span>
                        {record.podcast
                          ? `${formatDuration(record.podcast.durationSec)} · ${formatBytes(record.podcast.sizeBytes)}`
                          : formatDateTime(record.updatedAt, locale)}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="px-3 py-2 text-xs text-[#ababab]">{copy.noRecordsForStudent}</p>
          )}
        </div>

        {/* Pane 3: the selected record, read-only */}
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {!selectedRecord ? (
            <div className="flex h-full min-h-40 flex-col items-center justify-center text-[#ababab]">
              <RecordIcon className="mb-2 size-10 opacity-30" />
              <p className="text-xs">
                {!selectedStudentId
                  ? copy.pickStudentToView
                  : recordsLoading
                    ? common.loading
                    : copy.pickRecordToView}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="border-b border-[#e8e8e8] pb-2">
                <h3 className="text-sm font-semibold">
                  <MathText>{selectedRecord.title}</MathText>
                </h3>
                <p className="text-[10px] text-[#ababab]">
                  {selectedStudent?.displayName} · {topicLabel(selectedRecord.topic)} ·{" "}
                  {formatDateTime(selectedRecord.updatedAt, locale)}
                </p>
              </div>

              {selectedRecord.chat && <ChatMessages record={selectedRecord.chat} />}

              {selectedRecord.essay && <EssayStages record={selectedRecord.essay} />}

              {selectedRecord.podcast && (
                <PodcastPlayer
                  record={selectedRecord.podcast}
                  accent={accent}
                  audioSrc={audioByRecordId[selectedRecord.podcast.id] ?? ""}
                  loading={loadingAudioId === selectedRecord.podcast.id}
                  onLoad={() => void playAudio(selectedRecord.podcast!.id)}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ChatMessages({ record }: { record: ChatRecord }) {
  const copy = useCopy(COPY);
  if (record.messages.length === 0) {
    return <p className="text-xs text-[#ababab]">{copy.noChatContent}</p>;
  }

  return (
    <div className="space-y-4">
      {record.messages.map((message) => {
        const text = message.parts.find((p) => p.type === "text")?.text ?? "";
        const images = message.parts.filter((p) => p.type === "file" && p.url);

        if (message.role === "user") {
          return (
            <div key={message.id} className="flex flex-col items-end">
              <div className="min-w-0 max-w-[85%] rounded-2xl bg-[#f4f4f5] px-4 py-2.5 text-sm leading-relaxed text-[#080808]">
                {images.length > 0 && (
                  <div className="mb-1.5 flex flex-wrap gap-1.5">
                    {images.map((img, idx) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={idx}
                        src={img.url}
                        alt={img.filename ?? copy.imageAlt}
                        className="max-h-[200px] max-w-[200px] rounded-[8px] object-contain"
                      />
                    ))}
                  </div>
                )}
                <div className="prose prose-sm max-w-none break-words [overflow-wrap:anywhere]">
                  <MarkdownBlock>{text}</MarkdownBlock>
                </div>
              </div>
            </div>
          );
        }

        return (
          <div key={message.id} className="flex flex-col items-start">
            <div className="prose prose-sm min-w-0 max-w-none break-words [overflow-wrap:anywhere] [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-[#e5e5e5] [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-[#e5e5e5] [&_th]:bg-[#fafafa] [&_th]:px-2 [&_th]:py-1">
              <MarkdownBlock>{text}</MarkdownBlock>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EssayStages({ record }: { record: EssayDraftRecord }) {
  // Essay drafts only exist for the Chinese Language subject, which looks the
  // same in both interface languages, so the stage names stay Chinese.
  const copy = COPY["zh-Hant"];
  return (
    <div className="space-y-4">
      {DRAFT_STAGES.map((key) => {
        const content = record[key];
        return (
          <section key={key}>
            <h4 className="mb-1.5 text-xs font-semibold text-[#363636]">{copy.drafts[key]}</h4>
            {content ? (
              <p className="whitespace-pre-wrap rounded-[6px] bg-[#faf9f6] px-3 py-2 text-sm leading-7 text-[#080808]">
                {content}
              </p>
            ) : (
              <p className="rounded-[6px] border border-dashed border-[#d8d8d8] px-3 py-2 text-xs text-[#ababab]">
                {copy.notWritten}
              </p>
            )}
          </section>
        );
      })}
    </div>
  );
}

function PodcastPlayer({
  record,
  accent,
  audioSrc,
  loading,
  onLoad,
}: {
  record: PodcastRecord;
  accent: string;
  audioSrc: string;
  loading: boolean;
  onLoad: () => void;
}) {
  const copy = useCopy(COPY);
  return (
    <div className="space-y-3">
      <p className="text-xs text-[#ababab]">
        {copy.duration(formatDuration(record.durationSec))} · {formatBytes(record.sizeBytes)}
      </p>

      {record.script && (
        <p className="whitespace-pre-wrap rounded-[6px] bg-[#faf9f6] px-3 py-2 text-sm leading-7 text-[#5a5a5a]">
          {record.script}
        </p>
      )}

      {audioSrc ? (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <audio controls src={audioSrc} className="w-full" />
      ) : (
        <button
          type="button"
          onClick={onLoad}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-full border border-[#d8d8d8] px-4 py-2 text-sm font-medium text-[#080808] transition hover:border-[#080808] disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Mic className="size-4" style={{ color: accent }} />
          )}
          {copy.loadAndPlay}
        </button>
      )}
    </div>
  );
}
