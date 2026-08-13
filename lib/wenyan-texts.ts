// Data for the Chinese "學習文言文" (Classical Chinese learning) topic.
//
// Content is aligned with the Hong Kong EDB recommended passages for
// 第二學習階段（小三至小六） / Key Stage 2:
//   https://www.edb.gov.hk/tc/curriculum-development/kla/chi-edu/key-stage2.html
// The KS2 classical-prose (文言) passages are: 論語四則、二子學弈、鄭人買履、
// 鷸蚌相爭、折箭、朱子家訓（節錄）. This topic now covers all six passages.
//
// Each text is broken into sentences. Every sentence carries:
//   - original: the classical Chinese sentence
//   - segments: a word-by-word / phrase-by-phrase breakdown (句子成分拆解)
//   - translation: a reference modern-Chinese translation.
//
// Targeted at Hong Kong primary students, so explanations stay簡潔淺白.

export interface WenyanSegment {
  /** The character or phrase being explained. */
  text: string;
  /** A short, plain explanation of the segment's meaning / role. */
  meaning: string;
}

export interface WenyanSentence {
  /** Stable id within the text (used as a React key / answer key). */
  id: string;
  /** The original classical Chinese sentence. */
  original: string;
  /** Word/phrase breakdown for the learning breakdown task. */
  segments: WenyanSegment[];
  /** Reference modern-Chinese translation. */
  translation: string;
}

/** A key vocabulary annotation (常用詞), shown like a textbook footnote. */
export interface WenyanVocab {
  /** The word / phrase being annotated, e.g. 「慍」 or 「不亦說乎」. */
  term: string;
  /** Plain explanation of the meaning. */
  meaning: string;
  /** 粵音 hint (a same-sound character), e.g. 「悅」. */
  jyutping?: string;
  /** 普通話拼音, e.g. 「yuè」. */
  pinyin?: string;
}

export interface WenyanText {
  id: string;
  title: string;
  source: string;
  /** One-line summary shown on the selection card. */
  summary: string;
  /** A short intro / moral shown at the top of the reading task. */
  intro: string;
  /** Optional key-vocabulary annotations (常用詞), shown in the reading task. */
  vocab?: WenyanVocab[];
  sentences: WenyanSentence[];
}

export const WENYAN_TEXTS: WenyanText[] = [
  {
    id: "lun-yu-si-ze",
    title: "論語四則",
    source: "《論語》",
    summary: "孔子四則語錄，教人學習與溫習、學思並重、溫故知新，以及向身邊的人學習。",
    intro:
      "這是香港教育局建議小學閱讀的篇章，選自《論語》。「子」指孔子。這四則語錄談的都是學習的道理。要特別掌握幾個常用詞：「說」通「悅」（愉快）、「慍」（生氣）、「罔」通「惘」（迷惘）、「殆」（疑惑）、「焉」（於此）。",
    vocab: [
      {
        term: "不亦說乎",
        meaning:
          "不也很愉快嗎？「不亦……乎」是表示反問的句式。說：通「悅」，愉悅。",
        jyutping: "悅",
        pinyin: "yuè",
      },
      { term: "慍", meaning: "生氣。", jyutping: "縕", pinyin: "yùn" },
      { term: "罔", meaning: "通「惘」，迷惘。", jyutping: "網", pinyin: "wǎng" },
      { term: "殆", meaning: "疑惑。", jyutping: "怠", pinyin: "dài" },
      { term: "焉", meaning: "於此。" },
    ],
    sentences: [
      {
        id: "s1",
        original:
          "子曰：「學而時習之，不亦說乎？有朋自遠方來，不亦樂乎？人不知而不慍，不亦君子乎？」",
        segments: [
          { text: "子曰", meaning: "孔子說（子＝對老師的尊稱，這裏指孔子）" },
          { text: "學而時習之", meaning: "學過之後按時溫習（時＝按時，習＝溫習）" },
          {
            text: "不亦說乎",
            meaning:
              "不也很愉快嗎？（說 yuè＝通「悅」，愉快；「不亦……乎」是反問的句式）",
          },
          { text: "有朋自遠方來", meaning: "有志同道合的朋友從遠方來" },
          { text: "不亦樂乎", meaning: "不也很快樂嗎？" },
          { text: "人不知而不慍", meaning: "別人不了解自己，也不生氣（慍 yùn＝生氣、惱怒）" },
          { text: "不亦君子乎", meaning: "不也是一位君子嗎？（君子＝有修養的人）" },
        ],
        translation:
          "孔子說：「學習過後按時溫習，不也是很愉快嗎？有志同道合的朋友從遠方來，不也是很快樂嗎？別人不了解自己，自己卻不生氣，不也是一位君子嗎？」",
      },
      {
        id: "s2",
        original: "子曰：「學而不思則罔，思而不學則殆。」",
        segments: [
          { text: "子曰", meaning: "孔子說" },
          {
            text: "學而不思則罔",
            meaning: "只學習而不思考，就會迷惘無所得（罔 wǎng＝通「惘」，迷惘）",
          },
          {
            text: "思而不學則殆",
            meaning: "只空想而不學習，就會疑惑不踏實（殆 dài＝疑惑）",
          },
        ],
        translation:
          "孔子說：「只學習而不思考，就會迷惘而無所得；只空想而不學習，就會疑惑而不踏實。」",
      },
      {
        id: "s3",
        original: "子曰：「溫故而知新，可以為師矣。」",
        segments: [
          { text: "子曰", meaning: "孔子說" },
          { text: "溫故", meaning: "溫習學過的舊知識（故＝舊的、學過的）" },
          { text: "而知新", meaning: "從而領悟新的道理" },
          { text: "可以為師矣", meaning: "就可以做老師了（為＝做、當；矣＝了）" },
        ],
        translation:
          "孔子說：「溫習學過的舊知識，能從中領悟新的道理，這樣就可以做老師了。」",
      },
      {
        id: "s4",
        original:
          "子曰：「三人行，必有我師焉，擇其善者而從之，其不善者而改之。」",
        segments: [
          { text: "子曰", meaning: "孔子說" },
          { text: "三人行", meaning: "幾個人一起走（三＝泛指多數，不一定剛好三人）" },
          { text: "必有我師焉", meaning: "當中一定有可以做我老師的人（焉＝於此，在這裏面）" },
          { text: "擇其善者而從之", meaning: "選擇他們的優點來學習（擇＝選擇，善者＝好的地方）" },
          { text: "其不善者而改之", meaning: "看到他們的缺點就反省、改正自己（不善者＝不好的地方）" },
        ],
        translation:
          "孔子說：「幾個人一起走，當中一定有可以做我老師的人。選擇他們的優點來學習，看到他們的缺點就反省、改正自己。」",
      },
    ],
  },
  {
    id: "er-zi-xue-yi",
    title: "二子學弈",
    source: "《孟子》",
    summary: "弈秋教兩個人下棋，一個專心、一個分心，結果高下立見，說明學習貴在專心。",
    intro:
      "這是香港教育局建議小學閱讀的篇章，選自《孟子》。弈秋是全國最會下棋的人，他同時教兩個人下棋：一個專心致志，一個卻想着射天鵝。結果兩人成績差很遠。原來分別不在天資高低，而在於是否用心。要特別掌握的常用詞見下。",
    vocab: [
      { term: "弈", meaning: "下棋。", jyutping: "亦", pinyin: "yì" },
      { term: "使", meaning: "假使。" },
      { term: "誨", meaning: "教導。" },
      { term: "惟弈秋之為聽", meaning: "只（專心）聽弈秋（的教導）。" },
      {
        term: "鴻鵠",
        meaning: "俗稱天鵝。「鵠」字讀音如下。",
        jyutping: "酷",
        pinyin: "hú",
      },
      { term: "援", meaning: "以手牽引、握持。" },
      {
        term: "弓繳",
        meaning: "弓箭。「繳」指繫着幼繩的箭，讀音如下。",
        jyutping: "雀",
        pinyin: "zhuó",
      },
      {
        term: "弗若之",
        meaning:
          "不如他。弗：通「不」。之：代詞，「他」的意思，指那個專心致志的人。",
      },
      {
        term: "智、與",
        meaning: "智：智力。與：通「歟」，疑問語氣詞，相當於「嗎」。",
      },
    ],
    sentences: [
      {
        id: "s1",
        original: "弈秋，通國之善弈者也。",
        segments: [
          { text: "弈秋", meaning: "一個名叫「秋」的下棋高手（弈＝下棋）" },
          { text: "通國", meaning: "全國" },
          { text: "之善弈者也", meaning: "最擅長下棋的人（善＝擅長，者也＝……的人）" },
        ],
        translation: "弈秋，是全國最擅長下棋的人。",
      },
      {
        id: "s2",
        original: "使弈秋誨二人弈，其一人專心致志，惟弈秋之為聽。",
        segments: [
          { text: "使弈秋誨二人弈", meaning: "假使弈秋教兩個人下棋（使＝假使，誨＝教導）" },
          { text: "其一人專心致志", meaning: "其中一個人專心一意（致志＝集中心思）" },
          { text: "惟弈秋之為聽", meaning: "只專心聽弈秋的教導（惟＝只）" },
        ],
        translation:
          "假使弈秋教兩個人下棋，其中一個人專心一意，只聽弈秋的教導。",
      },
      {
        id: "s3",
        original:
          "一人雖聽之，一心以為有鴻鵠將至，思援弓繳而射之，雖與之俱學，弗若之矣。",
        segments: [
          { text: "一人雖聽之", meaning: "另一個人雖然也在聽（雖＝雖然）" },
          { text: "一心以為有鴻鵠將至", meaning: "卻一心以為有天鵝快要飛來（鴻鵠＝天鵝）" },
          { text: "思援弓繳而射之", meaning: "想着拿起弓箭去射牠（援＝拿起，弓繳＝弓箭）" },
          { text: "雖與之俱學", meaning: "雖然跟前一個人一起學習（俱＝一起）" },
          { text: "弗若之矣", meaning: "卻比不上他了（弗若＝不如，之＝他）" },
        ],
        translation:
          "另一個人雖然也在聽，心裏卻以為有天鵝快要飛來，想着拿起弓箭去射牠；這樣他雖然和前一個人一起學習，成績卻比不上人家了。",
      },
      {
        id: "s4",
        original: "為是其智弗若與？曰：「非然也。」",
        segments: [
          { text: "為是其智弗若與", meaning: "是因為他的智力比不上人家嗎？（智＝智力，與＝嗎）" },
          { text: "曰", meaning: "回答說" },
          { text: "非然也", meaning: "並不是這樣（然＝這樣）" },
        ],
        translation: "是因為他的智力比不上人家嗎？回答說：「並不是這樣的。」",
      },
    ],
  },
  {
    id: "zheng-ren-mai-lyu",
    title: "鄭人買履",
    source: "《韓非子》",
    summary: "鄭國人量好腳碼卻忘了帶，寧願回家拿尺碼也不肯用腳試鞋，結果買不到鞋。",
    intro:
      "這是香港教育局建議小學閱讀的篇章，選自《韓非子》。有個鄭國人想買鞋，先量好腳的尺碼，卻忘了帶在身上；他寧願跑回家拿尺碼，也不肯用自己的腳試穿，結果買不到鞋。故事諷刺那些死守規矩、不懂變通的人。要特別掌握的常用詞見下。",
    vocab: [
      { term: "鄭人", meaning: "鄭國的人。" },
      { term: "且", meaning: "將要。" },
      { term: "置（買）", meaning: "動詞，購買。" },
      { term: "履", meaning: "鞋。", jyutping: "里", pinyin: "lǚ" },
      {
        term: "度（量度）",
        meaning: "動詞，量度（量長短）。",
        jyutping: "踱",
        pinyin: "duó",
      },
      { term: "其", meaning: "他的。" },
      { term: "置（擱）", meaning: "擱在。之：代詞，指量度好的尺寸。" },
      { term: "坐", meaning: "通「座」，座位。" },
      { term: "之（往）", meaning: "動詞，前往。市：市集。" },
      { term: "操", meaning: "執持，即拿取。" },
      {
        term: "度（尺碼）",
        meaning: "名詞，量度好的尺寸。",
        jyutping: "杜",
        pinyin: "dù",
      },
      { term: "反", meaning: "通「返」，返回。" },
    ],
    sentences: [
      {
        id: "s1",
        original: "鄭人有且置履者，先自度其足而置之其坐。",
        segments: [
          { text: "鄭人有且置履者", meaning: "有個鄭國人將要買鞋（且＝將要，置＝購買，履＝鞋）" },
          { text: "先自度其足", meaning: "先自己量好腳的尺碼（度 duó＝量度）" },
          { text: "而置之其坐", meaning: "把量好的尺碼擱在座位上（置＝擱，之＝尺碼，坐＝通「座」）" },
        ],
        translation: "有個鄭國人想買鞋，先自己量好腳的尺碼，把量好的尺碼擱在座位上。",
      },
      {
        id: "s2",
        original: "至之市，而忘操之，已得履，乃曰：「吾忘持度。」",
        segments: [
          { text: "至之市", meaning: "等到前往市集時（之＝前往，市＝市集）" },
          { text: "而忘操之", meaning: "卻忘了帶尺碼（操＝拿取，之＝尺碼）" },
          { text: "已得履", meaning: "已經拿到鞋子" },
          { text: "乃曰", meaning: "才說（乃＝才）" },
          { text: "吾忘持度", meaning: "我忘了帶量好的尺碼（持＝拿，度 dù＝尺碼）" },
        ],
        translation:
          "等到前往市集，卻忘了帶尺碼。已經拿到鞋子，他才說：「我忘了帶量好的尺碼。」",
      },
      {
        id: "s3",
        original: "反歸取之，及反，市罷，遂不得履。",
        segments: [
          { text: "反歸取之", meaning: "於是返回家去拿尺碼（反＝通「返」，歸＝回家）" },
          { text: "及反", meaning: "等到他再返回（及＝等到）" },
          { text: "市罷", meaning: "市集已經散了（罷＝結束、散）" },
          { text: "遂不得履", meaning: "結果買不到鞋（遂＝終於、結果）" },
        ],
        translation:
          "於是他返回家去拿尺碼，等到再回到市集，集市已經散了，結果買不到鞋。",
      },
      {
        id: "s4",
        original: "人曰：「何不試之以足？」曰：「寧信度，無自信也。」",
        segments: [
          { text: "人曰", meaning: "有人說" },
          { text: "何不試之以足", meaning: "為甚麼不用腳直接試穿呢？（何不＝為甚麼不，以足＝用腳）" },
          { text: "寧信度", meaning: "寧願相信量好的尺碼（寧＝寧願）" },
          { text: "無自信也", meaning: "也不相信自己的腳（自信＝相信自己）" },
        ],
        translation:
          "有人說：「為甚麼不用腳直接試穿呢？」他說：「我寧願相信量好的尺碼，也不相信自己的腳。」",
      },
    ],
  },
  {
    id: "yu-bang-xiang-zheng",
    title: "鷸蚌相爭",
    source: "《戰國策》",
    summary: "鷸鳥和河蚌互不相讓，結果一起被漁夫捉去，比喻雙方爭執讓第三者得利。",
    intro:
      "這是香港教育局建議小學閱讀的篇章，選自《戰國策》，後來變成成語「鷸蚌相爭，漁人得利」。它提醒我們：雙方爭執不肯退讓，往往會讓第三者佔了便宜。要特別掌握的常用詞見下。",
    vocab: [
      {
        term: "蚌",
        meaning: "河蚌，生活在淡水中的軟體動物，有堅硬的貝殼，肉味鮮美。",
      },
      { term: "方", meaning: "正在。" },
      { term: "曝", meaning: "曬太陽。", jyutping: "僕", pinyin: "pù" },
      {
        term: "鷸",
        meaning: "水鳥，以捕食昆蟲、水生動物為生。",
        jyutping: "核",
        pinyin: "yù",
      },
      { term: "拑", meaning: "把東西夾住。", jyutping: "鉗", pinyin: "qián" },
      { term: "喙", meaning: "鳥嘴。", jyutping: "悔", pinyin: "huì" },
      { term: "不出", meaning: "指鷸的嘴拔不出來。" },
      { term: "舍", meaning: "通「捨」，這裏解作讓步。" },
    ],
    sentences: [
      {
        id: "s1",
        original: "蚌方出曝，而鷸啄其肉。",
        segments: [
          { text: "蚌方出曝", meaning: "河蚌正出來曬太陽（方＝正在，曝 pù＝曬太陽）" },
          { text: "而鷸啄其肉", meaning: "一隻鷸鳥來啄牠的肉（鷸 yù＝水鳥，啄＝用嘴啄食）" },
        ],
        translation: "河蚌正出來曬太陽，一隻鷸鳥就來啄牠的肉。",
      },
      {
        id: "s2",
        original: "蚌合而拑其喙。",
        segments: [
          { text: "蚌合", meaning: "河蚌立刻合上殼" },
          { text: "而拑其喙", meaning: "夾住了鷸的嘴（拑 qián＝夾住，喙 huì＝鳥嘴）" },
        ],
        translation: "河蚌立刻合上殼，夾住了鷸的嘴。",
      },
      {
        id: "s3",
        original: "鷸曰：「今日不雨，明日不雨，即有死蚌。」",
        segments: [
          { text: "鷸曰", meaning: "鷸鳥說" },
          { text: "今日不雨", meaning: "今天不下雨（雨＝下雨，作動詞）" },
          { text: "明日不雨", meaning: "明天也不下雨" },
          { text: "即有死蚌", meaning: "就會有一隻乾死的河蚌（即＝就）" },
        ],
        translation: "鷸鳥說：「今天不下雨，明天不下雨，就會有一隻乾死的河蚌。」",
      },
      {
        id: "s4",
        original: "蚌亦謂鷸曰：「今日不出，明日不出，即有死鷸。」",
        segments: [
          { text: "蚌亦謂鷸曰", meaning: "河蚌也對鷸鳥說（亦＝也，謂＝對……說）" },
          { text: "今日不出", meaning: "今天你的嘴拔不出來（不出＝指鷸的嘴拔不出來）" },
          { text: "明日不出", meaning: "明天也拔不出來" },
          { text: "即有死鷸", meaning: "就會有一隻餓死的鷸鳥" },
        ],
        translation:
          "河蚌也對鷸鳥說：「今天你的嘴拔不出，明天你的嘴拔不出，就會有一隻餓死的鷸鳥。」",
      },
      {
        id: "s5",
        original: "兩者不肯相舍，漁者得而并擒之。",
        segments: [
          { text: "兩者", meaning: "鷸和蚌雙方" },
          { text: "不肯相舍", meaning: "都不肯互相讓步（舍＝通「捨」，讓步）" },
          { text: "漁者", meaning: "漁夫" },
          { text: "得而并擒之", meaning: "趁機把牠們一起捉住（并＝一起，擒＝捉住）" },
        ],
        translation: "雙方都不肯互相讓步，漁夫便趁機把牠們一起捉住了。",
      },
    ],
  },
  {
    id: "zhe-jian",
    title: "折箭",
    source: "《魏書》",
    summary:
      "吐谷渾國王阿豺臨終叫兒子折箭：一支易折，十九支合起來卻折不斷，說明團結就是力量。",
    intro:
      "這是香港教育局建議小學閱讀的篇章，選自《魏書》，作者是北齊的魏收。南北朝時吐谷渾國王阿豺臨終前，叫兒子和弟弟折箭：一支箭輕易折斷，十九支箭合起來卻折不斷。他藉此說明「單者易折，眾則難摧」的道理——只要團結一致、同心合力，國家才能穩固。要特別掌握的常用詞見下。",
    vocab: [
      {
        term: "阿豺",
        meaning:
          "南北朝時吐谷渾國的國王。吐谷渾：北方一個民族和國家的名稱，粵讀如「突玉云」［dat6 juk6 wan4］。",
      },
      { term: "汝等", meaning: "你們。" },
      { term: "奉", meaning: "給予。" },
      { term: "折", meaning: "弄斷。" },
      { term: "俄而", meaning: "一會兒、不久。" },
      { term: "母弟", meaning: "同母所生的弟弟。" },
      { term: "汝曹", meaning: "你們。" },
      { term: "摧", meaning: "折斷。" },
      { term: "戮力", meaning: "合力。", jyutping: "六", pinyin: "lù" },
      { term: "社稷", meaning: "國家。" },
    ],
    sentences: [
      {
        id: "s1",
        original: "阿豺有子二十人，緯代，長子也。",
        segments: [
          {
            text: "阿豺有子二十人",
            meaning: "阿豺有二十個兒子（阿豺＝南北朝時吐谷渾國的國王）",
          },
          { text: "緯代，長子也", meaning: "緯代是他的長子（長子＝最年長的兒子）" },
        ],
        translation: "阿豺有二十個兒子，緯代是他的長子。",
      },
      {
        id: "s2",
        original: "阿豺又謂曰：「汝等各奉吾一支箭，折之地下。」",
        segments: [
          { text: "阿豺又謂曰", meaning: "阿豺又對兒子們說（謂＝對……說）" },
          {
            text: "汝等各奉吾一支箭",
            meaning: "你們每人給我一支箭（汝等＝你們，奉＝給予）",
          },
          { text: "折之地下", meaning: "把箭折斷丟在地上（折＝弄斷）" },
        ],
        translation: "阿豺又對兒子們說：「你們每人給我一支箭，把它折斷丟在地上。」",
      },
      {
        id: "s3",
        original: "俄而命母弟慕利延曰：「汝取一支箭折之。」慕利延折之。",
        segments: [
          { text: "俄而", meaning: "過了一會兒（俄而＝不久、一會兒）" },
          {
            text: "命母弟慕利延曰",
            meaning: "命令同母所生的弟弟慕利延說（母弟＝同母所生的弟弟）",
          },
          { text: "汝取一支箭折之", meaning: "你拿一支箭把它折斷（取＝拿）" },
          { text: "慕利延折之", meaning: "慕利延就把箭折斷了" },
        ],
        translation:
          "過了一會兒，阿豺命令同母所生的弟弟慕利延說：「你拿一支箭把它折斷。」慕利延就把箭折斷了。",
      },
      {
        id: "s4",
        original: "又曰：「汝取十九支箭折之。」延不能折。",
        segments: [
          { text: "又曰", meaning: "阿豺又說" },
          { text: "汝取十九支箭折之", meaning: "你拿十九支箭一起折斷它們" },
          { text: "延不能折", meaning: "慕利延卻折不斷（延＝慕利延）" },
        ],
        translation: "阿豺又說：「你拿十九支箭一起折斷它們。」慕利延卻折不斷。",
      },
      {
        id: "s5",
        original:
          "阿豺曰：「汝曹知否？單者易折，眾則難摧，戮力一心，然後社稷可固。」",
        segments: [
          { text: "汝曹知否", meaning: "你們明白嗎？（汝曹＝你們）" },
          { text: "單者易折", meaning: "單獨一支箭就容易折斷（單＝單獨）" },
          { text: "眾則難摧", meaning: "很多支合在一起就難以折斷（摧＝折斷）" },
          { text: "戮力一心", meaning: "合力同心（戮力 lù＝合力）" },
          { text: "然後社稷可固", meaning: "這樣國家才能穩固（社稷＝國家，固＝穩固）" },
        ],
        translation:
          "阿豺說：「你們明白嗎？單獨一支箭容易折斷，很多支合在一起就難以折斷；只要大家合力同心，國家才能夠穩固。」",
      },
    ],
  },
  {
    id: "zhu-zi-jia-xun",
    title: "朱子家訓（節錄）",
    source: "《朱子家訓》",
    summary:
      "朱柏廬以整齊的對偶句訓誡子弟，講述勤儉持家、防患未然、飲食清淡的樸素生活道理。",
    intro:
      "這是香港教育局建議小學閱讀的篇章，節錄自明末清初朱柏廬（朱用純）的《朱子家訓》。全文以整齊的對偶句，講述勤儉持家、杜絕浪費、講究衞生、飲食清淡的處世道理，三百年來膾炙人口。要特別掌握的常用詞見下。",
    vocab: [
      { term: "即", meaning: "就、立刻。" },
      { term: "庭除", meaning: "庭院。" },
      { term: "既", meaning: "已經。" },
      { term: "檢點", meaning: "細心察看。" },
      {
        term: "半絲半縷",
        meaning: "此處泛指衣物。半：表示極少；絲縷：絲線。",
      },
      { term: "恒念", meaning: "經常想到。" },
      { term: "物力維艱", meaning: "指物資得來不易。維：是。" },
      {
        term: "未雨而綢繆",
        meaning: "指凡事要預先準備，以防患於未然。綢繆：緊密地纏繞。",
        jyutping: "囚謀",
        pinyin: "chóu móu",
      },
      {
        term: "毋臨渴而掘井",
        meaning:
          "不要到了口渴的時候才挖井取水，比喻不要事到臨頭才想辦法。毋：不要。",
        jyutping: "無",
        pinyin: "wú",
      },
      { term: "自奉", meaning: "自己的生活消費。" },
      { term: "留連", meaning: "捨不得離開。" },
      { term: "質", meaning: "樸素。" },
      {
        term: "瓦缶",
        meaning: "一種瓦製的容器，小口大腹，俗稱瓦罐。缶：讀音如下。",
        jyutping: "否",
        pinyin: "fǒu",
      },
      { term: "約而精", meaning: "簡單而精美。" },
      { term: "愈", meaning: "勝過。" },
      { term: "珍饈", meaning: "珍貴的食物。" },
    ],
    sentences: [
      {
        id: "s1",
        original: "黎明即起，灑掃庭除，要內外整潔。",
        segments: [
          { text: "黎明即起", meaning: "天剛亮就起牀（黎明＝天剛亮，即＝就、立刻）" },
          { text: "灑掃庭除", meaning: "灑水打掃庭院（庭除＝庭院）" },
          { text: "要內外整潔", meaning: "要使裏裏外外都整齊清潔" },
        ],
        translation: "天亮就起牀，灑水打掃庭院，要使裏裏外外都整齊清潔。",
      },
      {
        id: "s2",
        original: "既昏便息，關鎖門戶，必親自檢點。",
        segments: [
          { text: "既昏便息", meaning: "到了黃昏就休息（既＝已經，昏＝黃昏）" },
          { text: "關鎖門戶", meaning: "關好、鎖上門窗" },
          { text: "必親自檢點", meaning: "一定要親自細心察看（檢點＝細心察看）" },
        ],
        translation: "到了黃昏就休息，關好、鎖上門窗，一定要親自細心檢查。",
      },
      {
        id: "s3",
        original: "一粥一飯，當思來處不易；半絲半縷，恒念物力維艱。",
        segments: [
          { text: "一粥一飯", meaning: "一口粥、一口飯" },
          { text: "當思來處不易", meaning: "應當想到它們得來不容易（當＝應當）" },
          {
            text: "半絲半縷",
            meaning: "半根絲線（此處泛指衣物，半＝表示極少）",
          },
          {
            text: "恒念物力維艱",
            meaning: "要經常想到物資得來十分艱難（恒念＝經常想到，維＝是）",
          },
        ],
        translation:
          "一口粥、一口飯，都應當想到它們得來不容易；半根絲線，也要經常想到物資得來十分艱難。",
      },
      {
        id: "s4",
        original: "宜未雨而綢繆，毋臨渴而掘井。",
        segments: [
          {
            text: "宜未雨而綢繆",
            meaning: "應趁還沒下雨就先做好準備（比喻凡事要預先準備）",
          },
          {
            text: "毋臨渴而掘井",
            meaning: "不要到口渴時才去挖井（毋＝不要，比喻不要事到臨頭才想辦法）",
          },
        ],
        translation:
          "應趁還沒下雨就先做好準備，不要到了口渴的時候才去挖井。",
      },
      {
        id: "s5",
        original: "自奉必須儉約，宴客切勿留連。",
        segments: [
          {
            text: "自奉必須儉約",
            meaning: "自己的生活消費一定要節儉（自奉＝自己的生活消費）",
          },
          {
            text: "宴客切勿留連",
            meaning: "宴請客人切不可捨不得散去（留連＝捨不得離開）",
          },
        ],
        translation: "自己的生活消費一定要節儉，宴請客人也切不可流連鋪張。",
      },
      {
        id: "s6",
        original: "器具質而潔，瓦缶勝金玉。",
        segments: [
          { text: "器具質而潔", meaning: "器物只要樸素而潔淨就好（質＝樸素）" },
          {
            text: "瓦缶勝金玉",
            meaning: "瓦製的器皿勝過金玉製的器皿（瓦缶＝瓦製容器）",
          },
        ],
        translation: "器物只要樸素而潔淨就好，瓦製的器皿勝過金玉製的器皿。",
      },
      {
        id: "s7",
        original: "飲食約而精，園蔬愈珍饈。",
        segments: [
          { text: "飲食約而精", meaning: "飲食簡單而精美就好（約而精＝簡單而精美）" },
          {
            text: "園蔬愈珍饈",
            meaning: "園中的蔬菜勝過珍貴的美食（愈＝勝過，珍饈＝珍貴的食物）",
          },
        ],
        translation: "飲食簡單而精美就夠了，園中的蔬菜勝過珍貴的美食。",
      },
    ],
  },
];

export function getWenyanText(id: string): WenyanText | undefined {
  return WENYAN_TEXTS.find((t) => t.id === id);
}
