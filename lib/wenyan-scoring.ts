// Pure, storage-agnostic scoring + badge logic for the 學習文言文 game.
//
// This module has NO side effects (no localStorage, no DB, no `window`) so it
// can run identically on the client and on the server. The server (API route)
// is the source of truth: it loads a user's progress from MongoDB, applies one
// of these pure functions, and persists the result. The client only renders.

import { WENYAN_TEXTS } from "./wenyan-texts";

/** The four challenge games. */
export type ChallengeMode = "translate" | "puzzle" | "theme" | "application";

/** Max possible total score (each mode caps at 100). */
export const MAX_TOTAL_SCORE = 400;

/* ----------------------------------------------------------------- badges */

export interface Badge {
  id: string;
  label: string;
  description: string;
  emoji: string;
}

export const BADGES: Badge[] = [
  // —— 學習模式 ——
  { id: "scholar", label: "勤學書生", description: "在學習模式完成第一篇文章", emoji: "📖" },
  { id: "all-texts", label: "博覽群書", description: "學習模式完成全部四篇文章", emoji: "📚" },

  // —— 挑戰里程碑（任何模式）——
  { id: "first-try", label: "初試啼聲", description: "完成第一場挑戰", emoji: "🌱" },
  { id: "rising-star", label: "文言新星", description: "任何挑戰單場取得 60 分或以上", emoji: "⭐" },
  { id: "expert", label: "文言高手", description: "任何挑戰單場取得 80 分或以上", emoji: "🏅" },
  { id: "master", label: "文言大師", description: "任何挑戰單場取得滿分 100 分", emoji: "👑" },

  // —— 四種挑戰模式的專屬獎章（單場 80 分或以上）——
  { id: "translate-ace", label: "識字高手", description: "常用詞翻譯取得 80 分或以上", emoji: "✍️" },
  { id: "puzzle-ace", label: "拼圖高手", description: "常用詞拼圖取得 80 分或以上", emoji: "🧩" },
  { id: "theme-ace", label: "明理達人", description: "主旨理解取得 80 分或以上", emoji: "💡" },
  { id: "apply-ace", label: "活學活用", description: "主旨應用取得 80 分或以上", emoji: "🌟" },

  // —— 毅力與綜合成就 ——
  { id: "diligent", label: "持之以恆", description: "累積挑戰 10 次", emoji: "📅" },
  { id: "all-modes", label: "四項全能", description: "四種挑戰模式都玩過", emoji: "⚔️" },
  { id: "grand-total", label: "登峰造極", description: "四種模式總分達 360 分", emoji: "🏆" },
  { id: "perfect-all", label: "完美無瑕", description: "四種挑戰模式全部取得滿分 100 分", emoji: "💎" },
];

export function getBadge(id: string): Badge | undefined {
  return BADGES.find((b) => b.id === id);
}

/* --------------------------------------------------------------- snapshot */

export interface ProgressSnapshot {
  completedTexts: string[];
  /** Best score in the 常用詞翻譯 game (0–100). */
  bestTranslate: number;
  /** Best score in the 常用詞拼圖 game (0–100). */
  bestPuzzle: number;
  /** Best score in the 主旨理解 game (0–100). */
  bestTheme: number;
  /** Best score in the 主旨應用 game (0–100). */
  bestApplication: number;
  /** Play counts per mode. */
  playsTranslate: number;
  playsPuzzle: number;
  playsTheme: number;
  playsApplication: number;
  /** Combined best score across all modes (0–400). */
  totalScore: number;
  badges: string[];
}

export interface ChallengeResult {
  /** 0–100 */
  score: number;
  /** Longest run of correct answers within the game. */
  maxStreak: number;
}

/** A fresh, empty progress snapshot (used before any play / when logged out). */
export function emptyProgress(): ProgressSnapshot {
  return {
    completedTexts: [],
    bestTranslate: 0,
    bestPuzzle: 0,
    bestTheme: 0,
    bestApplication: 0,
    playsTranslate: 0,
    playsPuzzle: 0,
    playsTheme: 0,
    playsApplication: 0,
    totalScore: 0,
    badges: [],
  };
}

function withTotal(snap: ProgressSnapshot): ProgressSnapshot {
  return {
    ...snap,
    totalScore:
      snap.bestTranslate +
      snap.bestPuzzle +
      snap.bestTheme +
      snap.bestApplication,
  };
}

/* ------------------------------------------------------------- mutations */

export interface ApplyOutcome {
  snapshot: ProgressSnapshot;
  /** Badge ids newly earned by this action (for celebration UI). */
  newBadges: string[];
}

/** Mark a learning text as completed and award learning badges. */
export function applyTextCompleted(
  snap: ProgressSnapshot,
  textId: string
): ApplyOutcome {
  const completedTexts = snap.completedTexts.includes(textId)
    ? snap.completedTexts
    : [...snap.completedTexts, textId];

  const owned = new Set(snap.badges);
  const newBadges: string[] = [];
  const award = (id: string) => {
    if (!owned.has(id)) {
      owned.add(id);
      newBadges.push(id);
    }
  };

  if (completedTexts.length > 0) award("scholar");
  if (completedTexts.length >= WENYAN_TEXTS.length) award("all-texts");

  return {
    snapshot: withTotal({ ...snap, completedTexts, badges: [...owned] }),
    newBadges,
  };
}

/** Record a finished challenge for a given mode and award challenge badges. */
export function applyChallenge(
  snap: ProgressSnapshot,
  mode: ChallengeMode,
  result: ChallengeResult
): ApplyOutcome {
  const score = Math.max(0, Math.min(100, Math.round(result.score)));
  const next: ProgressSnapshot = { ...snap };

  switch (mode) {
    case "translate":
      next.bestTranslate = Math.max(snap.bestTranslate, score);
      next.playsTranslate = snap.playsTranslate + 1;
      break;
    case "puzzle":
      next.bestPuzzle = Math.max(snap.bestPuzzle, score);
      next.playsPuzzle = snap.playsPuzzle + 1;
      break;
    case "theme":
      next.bestTheme = Math.max(snap.bestTheme, score);
      next.playsTheme = snap.playsTheme + 1;
      break;
    case "application":
      next.bestApplication = Math.max(snap.bestApplication, score);
      next.playsApplication = snap.playsApplication + 1;
      break;
  }

  const owned = new Set(snap.badges);
  const newBadges: string[] = [];
  const award = (id: string) => {
    if (!owned.has(id)) {
      owned.add(id);
      newBadges.push(id);
    }
  };

  award("first-try");
  if (score >= 60) award("rising-star");
  if (score >= 80) award("expert");
  if (score >= 100) award("master");
  if (mode === "translate" && score >= 80) award("translate-ace");
  if (mode === "puzzle" && score >= 80) award("puzzle-ace");
  if (mode === "theme" && score >= 80) award("theme-ace");
  if (mode === "application" && score >= 80) award("apply-ace");

  const totalPlays =
    next.playsTranslate +
    next.playsPuzzle +
    next.playsTheme +
    next.playsApplication;
  if (
    next.playsTranslate > 0 &&
    next.playsPuzzle > 0 &&
    next.playsTheme > 0 &&
    next.playsApplication > 0
  )
    award("all-modes");
  if (totalPlays >= 10) award("diligent");
  if (
    next.bestTranslate + next.bestPuzzle + next.bestTheme + next.bestApplication >=
    360
  )
    award("grand-total");
  if (
    next.bestTranslate >= 100 &&
    next.bestPuzzle >= 100 &&
    next.bestTheme >= 100 &&
    next.bestApplication >= 100
  )
    award("perfect-all");

  next.badges = [...owned];
  return { snapshot: withTotal(next), newBadges };
}
