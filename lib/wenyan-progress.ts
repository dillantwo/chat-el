// Client-side access to the 學習文言文 progress / score / badge store.
//
// Progress now lives in MongoDB, tied to the logged-in user (see
// `app/api/wenyan-progress/route.ts` + `models/WenyanProgress.ts`), so it syncs
// across devices. This module is a thin async client over that API, plus the
// 常用詞翻譯 quiz generator. All pure scoring/badge logic lives in
// `wenyan-scoring.ts` and is shared with the server.

import { basePath } from "./utils";
import { WENYAN_CHARS, type WenyanChar } from "./wenyan-chars";
import {
  emptyProgress,
  type ChallengeMode,
  type ChallengeResult,
  type ProgressSnapshot,
} from "./wenyan-scoring";

// Re-export shared types + constants so existing imports keep working.
export {
  BADGES,
  getBadge,
  MAX_TOTAL_SCORE,
  emptyProgress,
} from "./wenyan-scoring";
export type {
  Badge,
  ChallengeMode,
  ChallengeResult,
  ProgressSnapshot,
} from "./wenyan-scoring";

export interface ChallengeOutcome {
  progress: ProgressSnapshot;
  /** Badge ids newly earned by this action. */
  newBadges: string[];
}

const ENDPOINT = `${basePath}/api/wenyan-progress`;

/** Read the current user's progress from the database. */
export async function getProgress(): Promise<ProgressSnapshot> {
  try {
    const res = await fetch(ENDPOINT, { cache: "no-store" });
    if (!res.ok) return emptyProgress();
    const data = (await res.json()) as { progress?: ProgressSnapshot };
    return data.progress ?? emptyProgress();
  } catch {
    return emptyProgress();
  }
}

/** Mark a learning text as completed. Returns the updated progress + new badges. */
export async function markTextCompleted(
  textId: string
): Promise<ChallengeOutcome> {
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "completeText", textId }),
    });
    if (!res.ok) return { progress: emptyProgress(), newBadges: [] };
    const data = (await res.json()) as ChallengeOutcome;
    return {
      progress: data.progress ?? emptyProgress(),
      newBadges: data.newBadges ?? [],
    };
  } catch {
    return { progress: emptyProgress(), newBadges: [] };
  }
}

/** Record a finished challenge. Returns the updated progress + new badges. */
export async function recordChallenge(
  mode: ChallengeMode,
  result: ChallengeResult
): Promise<ChallengeOutcome> {
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "recordChallenge",
        mode,
        score: result.score,
        maxStreak: result.maxStreak,
      }),
    });
    if (!res.ok) return { progress: emptyProgress(), newBadges: [] };
    const data = (await res.json()) as ChallengeOutcome;
    return {
      progress: data.progress ?? emptyProgress(),
      newBadges: data.newBadges ?? [],
    };
  } catch {
    return { progress: emptyProgress(), newBadges: [] };
  }
}

/* ----------------------------------------------------- 常用詞翻譯 quiz gen */

export interface QuizQuestion {
  char: WenyanChar;
  /** The example sentence shown to the student. */
  sentence: string;
  /** Four answer options (plain-Chinese meanings); one matches char.meaning. */
  options: string[];
  /** Index of the correct option. */
  answerIndex: number;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Build a fresh set of multiple-choice questions for one challenge round. */
export function buildQuiz(count = 10): QuizQuestion[] {
  const chars = shuffle(WENYAN_CHARS).slice(0, count);

  return chars.map((char) => {
    const sentence =
      char.examples[Math.floor(Math.random() * char.examples.length)];

    // Distractor meanings come from other characters with a different meaning.
    const distractors = shuffle(
      WENYAN_CHARS.filter(
        (c) => c.id !== char.id && c.meaning !== char.meaning
      )
    )
      .slice(0, 3)
      .map((c) => c.meaning);

    const options = shuffle([char.meaning, ...distractors]);
    return {
      char,
      sentence,
      options,
      answerIndex: options.indexOf(char.meaning),
    };
  });
}
