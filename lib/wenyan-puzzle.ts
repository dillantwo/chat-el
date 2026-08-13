// Data + builder for the 挑戰模式 - 常用詞拼圖 (vocabulary jigsaw) game.
//
// It reuses the six 學習模式 articles in `wenyan-texts.ts`. For each round we
// pick a passage (one sentence), blank out a few 常用詞 (at most one blank per
// short clause), and the student drags the right words into the slots. Each
// draggable token shows the word together with its meaning, and the bank also
// contains a couple of distractor words (干擾項) that should be left unused.

import { getWenyanText } from "./wenyan-texts";

/** A 常用詞 with its plain meaning. Used for blanks and distractors. */
export interface PuzzleBlank {
  /** The word that belongs in the slot (and the draggable token text). */
  answer: string;
  /** Short plain meaning, shown on the token. */
  meaning: string;
}

/** One renderable part of a passage: either fixed text or a blank slot. */
export type PuzzlePart =
  | { kind: "text"; value: string }
  | { kind: "blank"; slot: number };

/** A fully-prepared puzzle passage ready for the UI. */
export interface PuzzlePassage {
  id: string;
  title: string;
  source: string;
  original: string;
  /** The passage split into text + blank parts, in reading order. */
  parts: PuzzlePart[];
  /** Blanks in slot order (slot N ↔ blanks[N]). */
  blanks: PuzzleBlank[];
  /** Extra wrong-answer words mixed into the token bank. */
  distractors: PuzzleBlank[];
}

/**
 * Curated puzzle passages. Each `blanks` token MUST appear in the referenced
 * sentence, and we keep at most one blank per short (comma-separated) clause.
 */
interface PuzzleConfig {
  textId: string;
  sentenceId: string;
  blanks: PuzzleBlank[];
}

const PUZZLE_CONFIGS: PuzzleConfig[] = [
  {
    textId: "lun-yu-si-ze",
    sentenceId: "s1",
    blanks: [
      { answer: "說", meaning: "通「悅」，愉快" },
      { answer: "慍", meaning: "生氣" },
    ],
  },
  {
    textId: "lun-yu-si-ze",
    sentenceId: "s2",
    blanks: [
      { answer: "罔", meaning: "通「惘」，迷惘" },
      { answer: "殆", meaning: "疑惑" },
    ],
  },
  {
    textId: "er-zi-xue-yi",
    sentenceId: "s3",
    blanks: [
      { answer: "鴻鵠", meaning: "天鵝" },
      { answer: "援", meaning: "拿起、握持" },
    ],
  },
  {
    textId: "zheng-ren-mai-lyu",
    sentenceId: "s1",
    blanks: [
      { answer: "履", meaning: "鞋" },
      { answer: "度", meaning: "量度（量長短）" },
    ],
  },
  {
    textId: "zheng-ren-mai-lyu",
    sentenceId: "s3",
    blanks: [
      { answer: "反", meaning: "通「返」，返回" },
      { answer: "履", meaning: "鞋" },
    ],
  },
  {
    textId: "yu-bang-xiang-zheng",
    sentenceId: "s1",
    blanks: [
      { answer: "蚌", meaning: "河蚌" },
      { answer: "鷸", meaning: "水鳥" },
    ],
  },
  {
    textId: "zhe-jian",
    sentenceId: "s2",
    blanks: [
      { answer: "謂", meaning: "對……說" },
      { answer: "奉", meaning: "給予" },
    ],
  },
  {
    textId: "zhe-jian",
    sentenceId: "s5",
    blanks: [
      { answer: "摧", meaning: "折斷" },
      { answer: "社稷", meaning: "國家" },
    ],
  },
  {
    textId: "zhu-zi-jia-xun",
    sentenceId: "s1",
    blanks: [
      { answer: "即", meaning: "就、立刻" },
      { answer: "庭除", meaning: "庭院" },
    ],
  },
  {
    textId: "zhu-zi-jia-xun",
    sentenceId: "s6",
    blanks: [
      { answer: "質", meaning: "樸素" },
      { answer: "瓦缶", meaning: "瓦製的容器" },
    ],
  },
];

/** All distinct 常用詞 (by word) across every passage — the distractor pool. */
const VOCAB_POOL: PuzzleBlank[] = (() => {
  const seen = new Map<string, PuzzleBlank>();
  for (const cfg of PUZZLE_CONFIGS) {
    for (const b of cfg.blanks) {
      if (!seen.has(b.answer)) seen.set(b.answer, b);
    }
  }
  // A few extra well-known 常用詞 so distractors aren't always the same set.
  const extras: PuzzleBlank[] = [
    { answer: "誨", meaning: "教導" },
    { answer: "曝", meaning: "曬太陽" },
    { answer: "喙", meaning: "鳥嘴" },
    { answer: "坐", meaning: "通「座」，座位" },
    { answer: "焉", meaning: "於此" },
  ];
  for (const e of extras) if (!seen.has(e.answer)) seen.set(e.answer, e);
  return [...seen.values()];
})();

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Build one prepared passage from a config (positions sorted by appearance). */
function buildPassage(cfg: PuzzleConfig, distractorCount: number): PuzzlePassage | null {
  const text = getWenyanText(cfg.textId);
  if (!text) return null;
  const sentence = text.sentences.find((s) => s.id === cfg.sentenceId);
  if (!sentence) return null;

  const original = sentence.original;

  // Locate each blank and sort by position in the sentence.
  const located = cfg.blanks
    .map((b) => ({ blank: b, pos: original.indexOf(b.answer) }))
    .filter((x) => x.pos >= 0)
    .sort((a, b) => a.pos - b.pos);

  if (located.length !== cfg.blanks.length) return null; // safety

  const parts: PuzzlePart[] = [];
  const blanks: PuzzleBlank[] = [];
  let cursor = 0;

  located.forEach(({ blank, pos }, slot) => {
    if (pos > cursor) parts.push({ kind: "text", value: original.slice(cursor, pos) });
    parts.push({ kind: "blank", slot });
    blanks.push(blank);
    cursor = pos + blank.answer.length;
  });
  if (cursor < original.length) {
    parts.push({ kind: "text", value: original.slice(cursor) });
  }

  // Distractors: words not used as answers in this passage.
  const answerSet = new Set(blanks.map((b) => b.answer));
  const distractors = shuffle(VOCAB_POOL.filter((v) => !answerSet.has(v.answer))).slice(
    0,
    distractorCount
  );

  return {
    id: `${cfg.textId}-${cfg.sentenceId}`,
    title: text.title,
    source: text.source,
    original,
    parts,
    blanks,
    distractors,
  };
}

/**
 * Build a fresh round: a shuffled selection of passages drawn from the four
 * articles. Defaults to 5 passages, each with 2 distractor words.
 */
export function buildPuzzleRound(count = 5, distractorCount = 2): PuzzlePassage[] {
  const passages = shuffle(PUZZLE_CONFIGS)
    .map((cfg) => buildPassage(cfg, distractorCount))
    .filter((p): p is PuzzlePassage => p !== null);
  return passages.slice(0, Math.min(count, passages.length));
}

export const PUZZLE_PASSAGE_COUNT = Math.min(5, PUZZLE_CONFIGS.length);
