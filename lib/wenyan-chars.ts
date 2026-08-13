// Common classical-Chinese characters bank for the 挑戰模式 - 常用詞翻譯
// (translation challenge) of the 學習文言文 topic.
//
// Every word and example sentence is drawn from the six passages currently in
// the 學習模式 (see `wenyan-texts.ts`): 論語四則、二子學弈、鄭人買履、鷸蚌相爭、
// 折箭、朱子家訓（節錄）. This keeps the challenge in sync with what the student studies.
//
// The challenge picks a character, shows one of its example sentences (the
// "片段") with the character highlighted, and asks the student to choose the
// correct meaning — the wrong options are meanings of other characters here.

export interface WenyanChar {
  /** Stable id. */
  id: string;
  /** The single character (or short word) being tested. */
  char: string;
  /** Pinyin hint. */
  pinyin: string;
  /** The plain-Chinese meaning (correct answer). */
  meaning: string;
  /** Short example sentences (from the four articles) that contain `char`. */
  examples: string[];
}

export const WENYAN_CHARS: WenyanChar[] = [
  /* ----------------------------------------------------------- 論語四則 */
  {
    id: "yue-happy",
    char: "說",
    pinyin: "yuè",
    meaning: "愉快（通「悅」）",
    examples: ["學而時習之，不亦說乎？"],
  },
  {
    id: "yun-angry",
    char: "慍",
    pinyin: "yùn",
    meaning: "生氣、惱怒",
    examples: ["人不知而不慍，不亦君子乎？"],
  },
  {
    id: "wang-lost",
    char: "罔",
    pinyin: "wǎng",
    meaning: "迷惘（通「惘」）",
    examples: ["學而不思則罔，思而不學則殆。"],
  },
  {
    id: "dai-doubt",
    char: "殆",
    pinyin: "dài",
    meaning: "疑惑",
    examples: ["學而不思則罔，思而不學則殆。"],
  },
  {
    id: "yan-here",
    char: "焉",
    pinyin: "yān",
    meaning: "於此、在這裏面",
    examples: ["三人行，必有我師焉。"],
  },
  {
    id: "gu-old",
    char: "故",
    pinyin: "gù",
    meaning: "舊的、學過的",
    examples: ["溫故而知新，可以為師矣。"],
  },

  /* ----------------------------------------------------------- 二子學弈 */
  {
    id: "yi-chess",
    char: "弈",
    pinyin: "yì",
    meaning: "下棋",
    examples: ["弈秋，通國之善弈者也。", "使弈秋誨二人弈。"],
  },
  {
    id: "shan-good-at",
    char: "善",
    pinyin: "shàn",
    meaning: "擅長",
    examples: ["弈秋，通國之善弈者也。"],
  },
  {
    id: "hui-teach",
    char: "誨",
    pinyin: "huì",
    meaning: "教導",
    examples: ["使弈秋誨二人弈。"],
  },
  {
    id: "wei-only",
    char: "惟",
    pinyin: "wéi",
    meaning: "只",
    examples: ["其一人專心致志，惟弈秋之為聽。"],
  },
  {
    id: "yuan-grasp",
    char: "援",
    pinyin: "yuán",
    meaning: "拿起、握持",
    examples: ["思援弓繳而射之。"],
  },
  {
    id: "sui-although",
    char: "雖",
    pinyin: "suī",
    meaning: "雖然",
    examples: ["雖與之俱學，弗若之矣。"],
  },
  {
    id: "fu-not",
    char: "弗",
    pinyin: "fú",
    meaning: "不",
    examples: ["雖與之俱學，弗若之矣。"],
  },
  {
    id: "ju-together",
    char: "俱",
    pinyin: "jù",
    meaning: "一起",
    examples: ["雖與之俱學，弗若之矣。"],
  },

  /* --------------------------------------------------------- 鄭人買履 */
  {
    id: "lyu-shoe",
    char: "履",
    pinyin: "lǚ",
    meaning: "鞋子",
    examples: ["鄭人有且置履者。", "及反，市罷，遂不得履。"],
  },
  {
    id: "du-size",
    char: "度",
    pinyin: "dù",
    meaning: "量好的尺碼",
    examples: ["寧信度，無自信也。"],
  },
  {
    id: "qie-about-to",
    char: "且",
    pinyin: "qiě",
    meaning: "將要",
    examples: ["鄭人有且置履者。"],
  },
  {
    id: "fan-return",
    char: "反",
    pinyin: "fǎn",
    meaning: "返回（同「返」）",
    examples: ["及反，市罷，遂不得履。"],
  },
  {
    id: "cao-hold",
    char: "操",
    pinyin: "cāo",
    meaning: "拿、執持",
    examples: ["至之市，而忘操之。"],
  },
  {
    id: "zuo-seat",
    char: "坐",
    pinyin: "zuò",
    meaning: "座位（通「座」）",
    examples: ["先自度其足，而置之其坐。"],
  },
  {
    id: "ba-end",
    char: "罷",
    pinyin: "bà",
    meaning: "結束、（市集）散了",
    examples: ["及反，市罷，遂不得履。"],
  },
  {
    id: "ning-rather",
    char: "寧",
    pinyin: "nìng",
    meaning: "寧願",
    examples: ["寧信度，無自信也。"],
  },

  /* --------------------------------------------------------- 鷸蚌相爭 */
  {
    id: "bang-clam",
    char: "蚌",
    pinyin: "bàng",
    meaning: "河蚌",
    examples: ["蚌方出曝，而鷸啄其肉。"],
  },
  {
    id: "fang-just",
    char: "方",
    pinyin: "fāng",
    meaning: "正在",
    examples: ["蚌方出曝，而鷸啄其肉。"],
  },
  {
    id: "pu-bask",
    char: "曝",
    pinyin: "pù",
    meaning: "曬太陽",
    examples: ["蚌方出曝，而鷸啄其肉。"],
  },
  {
    id: "yu-bird",
    char: "鷸",
    pinyin: "yù",
    meaning: "一種長嘴的水鳥",
    examples: ["蚌方出曝，而鷸啄其肉。"],
  },
  {
    id: "qian-clamp",
    char: "拑",
    pinyin: "qián",
    meaning: "夾住",
    examples: ["蚌合而拑其喙。"],
  },
  {
    id: "hui-beak",
    char: "喙",
    pinyin: "huì",
    meaning: "鳥嘴",
    examples: ["蚌合而拑其喙。"],
  },
  {
    id: "yu-rain",
    char: "雨",
    pinyin: "yù",
    meaning: "下雨",
    examples: ["今日不雨，明日不雨，即有死蚌。"],
  },
  {
    id: "she-release",
    char: "舍",
    pinyin: "shě",
    meaning: "放開、讓步（通「捨」）",
    examples: ["兩者不肯相舍，漁者得而并擒之。"],
  },
  {
    id: "yi-also",
    char: "亦",
    pinyin: "yì",
    meaning: "也",
    examples: ["蚌亦謂鷸曰：「今日不出，明日不出，即有死鷸。」"],
  },

  /* ------------------------------------------------------------- 折箭 */
  {
    id: "feng-give",
    char: "奉",
    pinyin: "fèng",
    meaning: "給予",
    examples: ["汝等各奉吾一支箭，折之地下。"],
  },
  {
    id: "wei-say",
    char: "謂",
    pinyin: "wèi",
    meaning: "對……說",
    examples: ["阿豺又謂曰：「汝等各奉吾一支箭，折之地下。」"],
  },
  {
    id: "e-er-soon",
    char: "俄而",
    pinyin: "é ér",
    meaning: "一會兒、不久",
    examples: ["俄而命母弟慕利延曰：「汝取一支箭折之。」"],
  },
  {
    id: "cui-break",
    char: "摧",
    pinyin: "cuī",
    meaning: "折斷",
    examples: ["單者易折，眾則難摧。"],
  },
  {
    id: "lu-join-force",
    char: "戮",
    pinyin: "lù",
    meaning: "合力（戮力）",
    examples: ["戮力一心，然後社稷可固。"],
  },
  {
    id: "she-ji-state",
    char: "社稷",
    pinyin: "shè jì",
    meaning: "國家",
    examples: ["戮力一心，然後社稷可固。"],
  },

  /* --------------------------------------------------- 朱子家訓（節錄） */
  {
    id: "ji-at-once",
    char: "即",
    pinyin: "jí",
    meaning: "就、立刻",
    examples: ["黎明即起，灑掃庭除。"],
  },
  {
    id: "ji-already",
    char: "既",
    pinyin: "jì",
    meaning: "已經",
    examples: ["既昏便息，關鎖門戶。"],
  },
  {
    id: "heng-often",
    char: "恒",
    pinyin: "héng",
    meaning: "經常",
    examples: ["半絲半縷，恒念物力維艱。"],
  },
  {
    id: "wu-do-not",
    char: "毋",
    pinyin: "wú",
    meaning: "不要",
    examples: ["宜未雨而綢繆，毋臨渴而掘井。"],
  },
  {
    id: "zhi-plain",
    char: "質",
    pinyin: "zhì",
    meaning: "樸素",
    examples: ["器具質而潔，瓦缶勝金玉。"],
  },
  {
    id: "yu-surpass",
    char: "愈",
    pinyin: "yù",
    meaning: "勝過",
    examples: ["飲食約而精，園蔬愈珍饈。"],
  },
  {
    id: "zhen-xiu-delicacy",
    char: "珍饈",
    pinyin: "zhēn xiū",
    meaning: "珍貴的食物",
    examples: ["飲食約而精，園蔬愈珍饈。"],
  },
];

export function getWenyanChar(id: string): WenyanChar | undefined {
  return WENYAN_CHARS.find((c) => c.id === id);
}
