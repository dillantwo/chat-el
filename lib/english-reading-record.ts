import { useEffect, useRef } from "react";
import { basePath } from "@/lib/utils";

export interface ReadingAnswerDetail {
  questionId: number;
  questionText: string;
  selected: string;
  correct: string;
  isCorrect: boolean;
}

export interface ReadingRecordItem {
  readingId: string;
  title: string;
  score: number;
  total: number;
  completed: boolean;
  answers: ReadingAnswerDetail[];
  /** Where the student last was, so they can resume (e.g. "part2"). */
  section?: string;
  /** Per-part question index reached, e.g. { part1: 0, part2: 2 }. */
  step?: Record<string, number>;
  /** Ids of the reading skills the student ticked off in the summary. */
  skills?: string[];
  updatedAt?: string;
}

/** Minimal question shape needed to grade and describe an answer. */
export interface GradableQuestion {
  id: number;
  text: string;
  answer: string;
}

export async function upsertReadingRecord(item: ReadingRecordItem): Promise<void> {
  try {
    const response = await fetch(`${basePath}/api/english-reading-record`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item),
    });
    if (!response.ok) throw new Error("save failed");
  } catch {
    // Keep record writes silent in the learning UI.
  }
}

export async function getReadingRecord(readingId: string): Promise<ReadingRecordItem | null> {
  try {
    const response = await fetch(
      `${basePath}/api/english-reading-record?readingId=${encodeURIComponent(readingId)}`,
      { credentials: "include" },
    );
    if (!response.ok) return null;
    const json = (await response.json()) as { item?: ReadingRecordItem | null };
    return json.item ?? null;
  } catch {
    return null;
  }
}

export async function deleteReadingRecord(readingId: string): Promise<void> {
  try {
    await fetch(
      `${basePath}/api/english-reading-record?readingId=${encodeURIComponent(readingId)}`,
      { method: "DELETE", credentials: "include" },
    );
  } catch {
    // Keep deletes silent in the learning UI.
  }
}

/**
 * Auto-saves a student's reading-comprehension quiz progress to the database
 * and restores it when the page is reopened. Call once near the top of a
 * learning page, passing the page's `questions` array and its `answered`
 * state. Pass `setAnswered` (and optionally `setSection`) to enable restore.
 * The record is upserted (one per reading) shortly after each answer, so both
 * the student and their teacher can review it later.
 *
 * Returns `clearRecord`, which deletes the saved record — call it from the
 * page's "Start Over" handler so restarting also clears the stored progress.
 */
export function useReadingRecord<S extends string, P extends string>(params: {
  readingId: string;
  title: string;
  questions: GradableQuestion[];
  answered: Record<number, string>;
  /** Current tab/section, persisted so the student resumes where they left off. */
  section: S;
  /** Per-part question index, persisted alongside the section. */
  step: Record<P, number>;
  /** Reading-skill checkboxes from the summary (id -> ticked). Optional. */
  skillChecks?: Record<string, boolean>;
  setAnswered?: (answered: Record<number, string>) => void;
  setSection?: (section: S) => void;
  setStep?: (step: Record<P, number>) => void;
  setSkillChecks?: (skills: Record<string, boolean>) => void;
}): { clearRecord: () => void } {
  const {
    readingId,
    title,
    questions,
    answered,
    section,
    step,
    skillChecks,
    setAnswered,
    setSection,
    setStep,
    setSkillChecks,
  } = params;
  // Keep the latest values available to the debounced timer without
  // re-arming the effect on every render.
  const latest = useRef({
    readingId,
    title,
    questions,
    answered,
    section,
    step,
    skillChecks,
    setAnswered,
    setSection,
    setStep,
    setSkillChecks,
  });
  latest.current = {
    readingId,
    title,
    questions,
    answered,
    section,
    step,
    skillChecks,
    setAnswered,
    setSection,
    setStep,
    setSkillChecks,
  };
  const lastPayload = useRef<string>("");
  const skipNextSave = useRef(false);

  // Build the payload from the latest state at call time.
  const buildPayload = (): ReadingRecordItem => {
    const { readingId, title, questions, answered, section, step, skillChecks } = latest.current;
    const answers: ReadingAnswerDetail[] = questions
      .filter((q) => answered[q.id] != null)
      .map((q) => {
        const selected = answered[q.id];
        return {
          questionId: q.id,
          questionText: q.text,
          selected,
          correct: q.answer,
          isCorrect: selected === q.answer,
        };
      });
    const total = questions.length;
    const score = answers.reduce((acc, a) => (a.isCorrect ? acc + 1 : acc), 0);
    const completed = answers.length >= total && total > 0;
    const skills = skillChecks
      ? Object.keys(skillChecks)
          .filter((id) => skillChecks[id])
          .sort()
      : [];
    return {
      readingId,
      title,
      score,
      total,
      completed,
      answers,
      section: String(section),
      step: step as Record<string, number>,
      skills,
      updatedAt: new Date().toISOString(),
    };
  };

  // Save the current state if there is something to save and it changed.
  const flushSave = () => {
    if (Object.keys(latest.current.answered).length === 0) return;
    const payload = buildPayload();
    const serialized = JSON.stringify({ ...payload, updatedAt: undefined });
    if (serialized === lastPayload.current) return;
    lastPayload.current = serialized;
    void upsertReadingRecord(payload);
  };

  // Restore the student's previous answers and position on mount.
  // NOTE: no "only once" ref guard here — under React Strict Mode the first
  // fetch is cancelled by the dev remount, so a guard would suppress restore
  // entirely. The GET is idempotent, so running it again is harmless.
  useEffect(() => {
    let cancelled = false;
    void getReadingRecord(readingId).then((rec) => {
      if (cancelled || !rec || !Array.isArray(rec.answers) || rec.answers.length === 0) return;
      const map: Record<number, string> = {};
      for (const a of rec.answers) {
        if (a.selected) map[a.questionId] = a.selected;
      }
      if (Object.keys(map).length === 0) return;
      const { setAnswered, setSection, setStep, setSkillChecks, questions } = latest.current;
      if (!setAnswered) return;
      const restoredSkills = Array.isArray(rec.skills) ? [...rec.skills].sort() : [];
      // Remember what we restored so we don't immediately re-save identical data.
      lastPayload.current = JSON.stringify({
        readingId: rec.readingId,
        title: rec.title,
        score: rec.score,
        total: rec.total,
        completed: rec.completed,
        answers: rec.answers,
        section: rec.section ?? "",
        step: rec.step ?? {},
        skills: restoredSkills,
        updatedAt: undefined,
      });
      skipNextSave.current = true;
      setAnswered(map);
      if (rec.step && typeof rec.step === "object" && Object.keys(rec.step).length > 0) {
        setStep?.(rec.step as Record<P, number>);
      }
      if (restoredSkills.length > 0) {
        const skillMap: Record<string, boolean> = {};
        for (const id of restoredSkills) skillMap[id] = true;
        setSkillChecks?.(skillMap);
      }
      // Resume the saved tab, falling back to the summary for finished readings.
      if (rec.section) {
        setSection?.(rec.section as S);
      } else if (rec.completed && Object.keys(map).length >= questions.length) {
        setSection?.("summary" as S);
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readingId]);

  const clearRecord = () => {
    lastPayload.current = "";
    void deleteReadingRecord(latest.current.readingId);
  };

  // Persist answers and position. Runs when the student answers a question or
  // navigates (section/step), but only once they've answered at least one.
  useEffect(() => {
    const answeredCount = Object.keys(answered).length;
    if (answeredCount === 0) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    const timer = window.setTimeout(flushSave, 800);
    return () => window.clearTimeout(timer);
    // Re-run whenever the answers, position, or ticked skills change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answered, section, step, skillChecks]);

  // Flush any pending progress when the page unmounts (e.g. the student
  // navigates back to the reading list) or the tab is hidden.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") flushSave();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      flushSave();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { clearRecord };
}

// Teachers read these records through /api/english-reading-record/teacher via
// lib/student-data.ts (查看學生數據).
