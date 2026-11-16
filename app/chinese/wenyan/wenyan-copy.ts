import { defineCopy } from "@/lib/i18n/config";

/**
 * Interface strings shared by the 學習文言文 screens (dashboard, learn mode and
 * the four challenge modes). Only the chrome is translated: passages, words,
 * meanings, quiz options and AI feedback stay Chinese, since they are the lesson.
 */
export const WENYAN_COPY = defineCopy({
  "zh-Hant": {
    backToChinese: "返回中文科",
    backToGame: "返回遊戲首頁",
    backHome: "回到首頁",
    topicTitle: "學習文言文",
    learnMode: "學習模式",
    challengeMode: "挑戰模式",
    modeTranslate: "常用詞翻譯",
    modePuzzle: "常用詞拼圖",
    modeTheme: "主旨理解",
    modeApplication: "主旨應用",
    /** Top-bar title of a challenge screen. */
    challengeTitle: (mode: string) => `挑戰模式 - ${mode}`,
    startChallenge: "開始挑戰",
    playAgain: "再玩一次",
    nextQuestion: "下一題",
    seeResults: "看成績",
    bestScoreLabel: "目前最高分：",
    questionOf: (n: number, total: number) => `第 ${n} / ${total} 題`,
    streak: (n: number) => `連對 ${n}`,
    points: (n: number) => `${n} 分`,
    original: "原文",
    translation: "翻譯",
    passageFragment: "文言文片段",
    roundScore: "本場得分",
    correctAnswers: "答對題數",
    longestStreak: "最長連對",
    allTimeBest: "歷來最高",
    newBadges: "🎉 解鎖新獎章！",
  },
  en: {
    backToChinese: "Back to Chinese",
    backToGame: "Back to games",
    backHome: "Back to games",
    topicTitle: "Classical Chinese",
    learnMode: "Learn mode",
    challengeMode: "Challenge mode",
    modeTranslate: "Word meanings",
    modePuzzle: "Word puzzle",
    modeTheme: "Main idea",
    modeApplication: "Apply the main idea",
    challengeTitle: (mode: string) => `Challenge mode - ${mode}`,
    startChallenge: "Start challenge",
    playAgain: "Play again",
    nextQuestion: "Next question",
    seeResults: "See results",
    bestScoreLabel: "Best score so far: ",
    questionOf: (n: number, total: number) => `Question ${n} / ${total}`,
    streak: (n: number) => `${n} in a row`,
    points: (n: number) => `${n} ${n === 1 ? "point" : "points"}`,
    original: "Original text",
    translation: "Translation",
    passageFragment: "Classical Chinese extract",
    roundScore: "Your score",
    correctAnswers: "Correct answers",
    longestStreak: "Longest streak",
    allTimeBest: "All-time best",
    newBadges: "🎉 New badge unlocked!",
  },
});

type BadgeText = { label: string; description: string };

/**
 * Badge names and descriptions by badge id. The Chinese half repeats
 * BADGES in lib/wenyan-scoring.ts word for word; pages fall back to the
 * badge's own label if an id is missing here.
 */
export const BADGE_COPY = defineCopy<Record<string, BadgeText>>({
  "zh-Hant": {
    scholar: { label: "勤學書生", description: "在學習模式完成第一篇文章" },
    "all-texts": { label: "博覽群書", description: "學習模式完成全部四篇文章" },
    "first-try": { label: "初試啼聲", description: "完成第一場挑戰" },
    "rising-star": { label: "文言新星", description: "任何挑戰單場取得 60 分或以上" },
    expert: { label: "文言高手", description: "任何挑戰單場取得 80 分或以上" },
    master: { label: "文言大師", description: "任何挑戰單場取得滿分 100 分" },
    "translate-ace": { label: "識字高手", description: "常用詞翻譯取得 80 分或以上" },
    "puzzle-ace": { label: "拼圖高手", description: "常用詞拼圖取得 80 分或以上" },
    "theme-ace": { label: "明理達人", description: "主旨理解取得 80 分或以上" },
    "apply-ace": { label: "活學活用", description: "主旨應用取得 80 分或以上" },
    diligent: { label: "持之以恆", description: "累積挑戰 10 次" },
    "all-modes": { label: "四項全能", description: "四種挑戰模式都玩過" },
    "grand-total": { label: "登峰造極", description: "四種模式總分達 360 分" },
    "perfect-all": { label: "完美無瑕", description: "四種挑戰模式全部取得滿分 100 分" },
  },
  en: {
    scholar: { label: "Keen Scholar", description: "Finish your first text in Learn mode" },
    "all-texts": { label: "Bookworm", description: "Finish all four texts in Learn mode" },
    "first-try": { label: "First Steps", description: "Finish your first challenge" },
    "rising-star": { label: "Rising Star", description: "Score 60 or more in any challenge" },
    expert: { label: "Expert", description: "Score 80 or more in any challenge" },
    master: { label: "Master", description: "Score a perfect 100 in any challenge" },
    "translate-ace": { label: "Word Whizz", description: "Score 80 or more in Word meanings" },
    "puzzle-ace": { label: "Puzzle Pro", description: "Score 80 or more in Word puzzle" },
    "theme-ace": { label: "Deep Thinker", description: "Score 80 or more in Main idea" },
    "apply-ace": { label: "Put It to Use", description: "Score 80 or more in Apply the main idea" },
    diligent: { label: "Keep Going", description: "Play 10 challenges in total" },
    "all-modes": { label: "All-Rounder", description: "Play all four challenge modes" },
    "grand-total": { label: "Top of the Mountain", description: "Reach 360 points across all four modes" },
    "perfect-all": { label: "Flawless", description: "Score a perfect 100 in all four challenge modes" },
  },
});
