// Data + builder for the 挑戰模式 - 主旨理解挑戰 (main-idea comprehension) and the
// 挑戰模式 - 理解應用 (real-life application) games.
//
// Both reuse the 學習模式 articles in `wenyan-texts.ts`. For each question we
// show a passage (原文 + 白話翻譯) and work with its 主旨 — the implied 道理/教訓.
//
// 《論語四則》本身包含四則獨立的語錄，各有各的道理，所以拆成四題（每則一題）；
// 其餘五篇（二子學弈、鄭人買履、鷸蚌相爭、折箭、朱子家訓）各作一題。主旨理解題
// 每題有一個正確答案加四個干擾選項；理解應用題則由 AI 為學生寫的生活隱喻評分。

import { WENYAN_TEXTS, getWenyanText } from "./wenyan-texts";

/** One main-idea question, mapping to a whole article or specific sentences. */
export interface ThemeEntry {
  /** Stable, unique id for this question. */
  id: string;
  /** The source article id in `WENYAN_TEXTS`. */
  textId: string;
  /** Display title, e.g. 「論語四則（其一）」 or 「二子學弈」. */
  title: string;
  /**
   * Sentence ids (within the article) to show for this question. When omitted,
   * the whole article is used.
   */
  sentenceIds?: string[];
  /** The main idea (隱含的道理) — the single correct answer. */
  theme: string;
}

export const WENYAN_THEMES: ThemeEntry[] = [
  /* 《論語四則》— 四則各有道理，拆成四題 */
  {
    id: "lun-yu-1",
    textId: "lun-yu-si-ze",
    title: "論語四則（其一）",
    sentenceIds: ["s1"],
    theme: "學了知識要按時溫習以鞏固所學而感到愉悅；待人則要有不因別人不了解、不認同自己而生氣的君子修養。",
  },
  {
    id: "lun-yu-2",
    textId: "lun-yu-si-ze",
    title: "論語四則（其二）",
    sentenceIds: ["s2"],
    theme: "學習應當「學」與「思」並重：只讀書而不思考會迷惘，只空想而不讀書會疑惑。",
  },
  {
    id: "lun-yu-3",
    textId: "lun-yu-si-ze",
    title: "論語四則（其三）",
    sentenceIds: ["s3"],
    theme: "能重溫學過的知識，並從中有新體會、新發現的人，就可以做老師了。",
  },
  {
    id: "lun-yu-4",
    textId: "lun-yu-si-ze",
    title: "論語四則（其四）",
    sentenceIds: ["s4"],
    theme: "要多向身邊的人學習：既學習別人的長處，也從別人的錯誤中汲取教訓。",
  },

  /* 其餘三篇各一題 */
  {
    id: "er-zi-xue-yi",
    textId: "er-zi-xue-yi",
    title: "二子學弈",
    theme: "學習成敗的關鍵在於是否專心致志，而不在於天資的高低。",
  },
  {
    id: "zheng-ren-mai-lyu",
    textId: "zheng-ren-mai-lyu",
    title: "鄭人買履",
    theme: "做事要按實際情況靈活變通，不應死守教條而不知變通。",
  },
  {
    id: "yu-bang-xiang-zheng",
    textId: "yu-bang-xiang-zheng",
    title: "鷸蚌相爭",
    theme: "雙方爭執互不相讓，最後往往只會讓第三者坐收漁利。",
  },
  {
    id: "zhe-jian",
    textId: "zhe-jian",
    title: "折箭",
    theme: "團結就是力量：眾人同心合力便難以被擊破，國家才能穩固；力量分散則容易被逐一擊破。",
  },
  {
    id: "zhu-zi-jia-xun",
    textId: "zhu-zi-jia-xun",
    title: "朱子家訓（節錄）",
    theme: "為人治家應勤儉節約、愛惜物力、凡事預先準備，過樸素而不浪費的生活。",
  },
];

/** Plausible-but-wrong morals, used to top up distractors to four per question. */
export const THEME_DISTRACTOR_POOL: string[] = [
  "做人要誠實守信，答應別人的事就一定要做到。",
  "要珍惜光陰，今天能做的事不要拖延到明天。",
  "遇到困難要勇敢面對，絕不可以輕言放棄。",
  "要孝順父母、尊敬師長，做一個有禮的人。",
  "貪心不足往往招來禍患，知足才能常樂。",
];

export function getWenyanTheme(id: string): ThemeEntry | undefined {
  return WENYAN_THEMES.find((t) => t.id === id);
}

/** Resolve an entry's 原文 + 翻譯 from the referenced article / sentences. */
function resolvePassage(entry: ThemeEntry): {
  source: string;
  original: string;
  translation: string;
} {
  const text = getWenyanText(entry.textId);
  const sentences = text
    ? entry.sentenceIds
      ? text.sentences.filter((s) => entry.sentenceIds!.includes(s.id))
      : text.sentences
    : [];
  return {
    source: text?.source ?? "",
    original: sentences.map((s) => s.original).join(""),
    translation: sentences.map((s) => s.translation).join(""),
  };
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ----------------------------------------------------- main-idea quiz */

export interface ThemeQuestion {
  /** The question (theme entry) id. */
  id: string;
  /** Question title, e.g. 「論語四則（其一）」. */
  title: string;
  /** Article source, e.g. 「《論語》」. */
  source: string;
  /** Original passage for this question (sentences joined). */
  original: string;
  /** Modern-Chinese translation for this question (sentences joined). */
  translation: string;
  /** Five answer options (main ideas); exactly one is correct. */
  options: string[];
  /** Index of the correct option. */
  answerIndex: number;
}

/**
 * Build a full round: one question per theme entry (論語四則拆成四題，其餘各一題)。
 * Each question shows 原文 + 翻譯 and five main-idea options (1 correct + 4 干擾)。
 */
export function buildThemeQuiz(): ThemeQuestion[] {
  return shuffle(WENYAN_THEMES).map((entry) => {
    const { source, original, translation } = resolvePassage(entry);

    const otherThemes = WENYAN_THEMES.filter((t) => t.id !== entry.id).map(
      (t) => t.theme
    );

    const distractors = shuffle([...otherThemes, ...THEME_DISTRACTOR_POOL])
      .filter((d) => d !== entry.theme)
      .slice(0, 4);

    const options = shuffle([entry.theme, ...distractors]);

    return {
      id: entry.id,
      title: entry.title,
      source,
      original,
      translation,
      options,
      answerIndex: options.indexOf(entry.theme),
    };
  });
}

/** Number of questions in one 主旨理解挑戰 round. */
export const THEME_QUESTION_COUNT = WENYAN_THEMES.length;

/* ------------------------------------------------ application challenge */

export interface ApplicationQuestion {
  /** The question (theme entry) id. */
  id: string;
  /** Question title, e.g. 「論語四則（其一）」. */
  title: string;
  /** Article source, e.g. 「《論語》」. */
  source: string;
  /** Original passage for this question (sentences joined). */
  original: string;
  /** Modern-Chinese translation for this question (sentences joined). */
  translation: string;
  /** The main idea (隱含的道理), shown to the student. */
  mainIdea: string;
}

/**
 * Build a full 理解應用 round: one question per theme entry. Each question shows
 * the 原文、翻譯 and the given 主旨, then asks the student to write a real-life
 * analogy that the AI will score.
 */
export function buildApplicationQuiz(): ApplicationQuestion[] {
  return shuffle(WENYAN_THEMES).map((entry) => {
    const { source, original, translation } = resolvePassage(entry);
    return {
      id: entry.id,
      title: entry.title,
      source,
      original,
      translation,
      mainIdea: entry.theme,
    };
  });
}

/** Number of questions in one 理解應用挑戰 round. */
export const APPLICATION_QUESTION_COUNT = WENYAN_THEMES.length;
