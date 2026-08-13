"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  Lightbulb,
  Trophy,
  CheckCircle2,
  XCircle,
  ArrowRight,
  RotateCcw,
  Sparkles,
  ScrollText,
  Languages,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { recordChallenge, getBadge, getProgress } from "@/lib/wenyan-progress";
import {
  buildThemeQuiz,
  THEME_QUESTION_COUNT,
  type ThemeQuestion,
} from "@/lib/wenyan-theme";

const ACCENT = "#6366f1";
const MAX_WRONG = 2; // each question allows up to two wrong attempts

type Phase = "intro" | "playing" | "result";

export default function WenyanThemePage() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [quiz, setQuiz] = useState<ThemeQuestion[]>([]);
  const [current, setCurrent] = useState(0);
  const [wrongPicks, setWrongPicks] = useState<number[]>([]);
  const [solved, setSolved] = useState(false);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [newBadges, setNewBadges] = useState<string[]>([]);
  const [bestScore, setBestScore] = useState(0);

  useEffect(() => {
    getProgress().then((p) => setBestScore(p.bestTheme));
  }, []);

  const q = quiz[current];
  // Percentage-based score so a perfect round always equals 100.
  const score = quiz.length
    ? Math.round((correctCount / quiz.length) * 100)
    : 0;

  const failed = wrongPicks.length >= MAX_WRONG && !solved;
  const resolved = solved || failed;

  function startGame() {
    setQuiz(buildThemeQuiz());
    setCurrent(0);
    setWrongPicks([]);
    setSolved(false);
    setStreak(0);
    setMaxStreak(0);
    setCorrectCount(0);
    setNewBadges([]);
    setPhase("playing");
  }

  function pick(index: number) {
    if (resolved || solved || wrongPicks.includes(index)) return;

    if (index === q.answerIndex) {
      setSolved(true);
      setCorrectCount((c) => c + 1);
      setStreak((prev) => {
        const nextStreak = prev + 1;
        setMaxStreak((m) => Math.max(m, nextStreak));
        return nextStreak;
      });
    } else {
      const nextWrong = [...wrongPicks, index];
      setWrongPicks(nextWrong);
      // Out of chances → question fails, streak resets. (Answer is not revealed.)
      if (nextWrong.length >= MAX_WRONG) setStreak(0);
    }
  }

  async function next() {
    if (current + 1 < quiz.length) {
      setCurrent((c) => c + 1);
      setWrongPicks([]);
      setSolved(false);
      return;
    }
    setPhase("result");
    const { progress, newBadges } = await recordChallenge("theme", {
      score,
      maxStreak,
    });
    setNewBadges(newBadges);
    setBestScore(progress.bestTheme);
  }

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden bg-white text-[#080808]">
      {/* Top bar */}
      <div className="flex h-[57px] shrink-0 items-center justify-between border-b border-[#ededed] bg-white px-4">
        <Link
          href="/chinese/wenyan"
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <ChevronLeft className="size-4" />
          返回遊戲首頁
        </Link>
        <div className="flex items-center gap-2">
          <Lightbulb className="size-4" style={{ color: ACCENT }} />
          <span className="text-sm font-semibold text-[#080808]">
            挑戰模式 - 主旨理解
          </span>
        </div>
        <div className="w-[112px]" />
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto bg-white px-4 py-8 md:px-6">
        <div className="mx-auto w-full max-w-2xl">
          {phase === "intro" && (
            <Intro bestScore={bestScore} onStart={startGame} />
          )}

          {phase === "playing" && q && (
            <Playing
              key={current}
              q={q}
              index={current}
              total={quiz.length}
              wrongPicks={wrongPicks}
              solved={solved}
              resolved={resolved}
              maxWrong={MAX_WRONG}
              score={score}
              streak={streak}
              onPick={pick}
              onNext={next}
            />
          )}

          {phase === "result" && (
            <Result
              score={score}
              correctCount={correctCount}
              total={quiz.length}
              maxStreak={maxStreak}
              bestScore={bestScore}
              newBadges={newBadges}
              onReplay={startGame}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- Intro */

function Intro({
  bestScore,
  onStart,
}: {
  bestScore: number;
  onStart: () => void;
}) {
  return (
    <div className="space-y-6 text-center wyt-fade-in-up">
      <div
        className="mx-auto flex size-16 items-center justify-center rounded-[18px] text-white shadow-[6px_6px_0px_#1a1330] wyt-pop-in"
        style={{ backgroundColor: ACCENT }}
      >
        <Lightbulb className="size-7" />
      </div>
      <div className="space-y-2">
        <h1 className="font-serif text-[34px] font-semibold tracking-[-0.02em] text-[#1a1330]">
          讀懂文章主旨
        </h1>
        <p className="mx-auto max-w-md text-sm leading-7 text-[#6b6385]">
          每題會給你一篇文言文的{" "}
          <span className="font-semibold" style={{ color: ACCENT }}>
            原文和翻譯
          </span>
          ，請仔細閱讀，然後從五個選項中選出這篇文章的{" "}
          <span className="font-semibold" style={{ color: ACCENT }}>
            主旨
          </span>
          （隱含的道理）。題目選自學習模式的四篇文章（《論語四則》四則各自獨立成題），共 {THEME_QUESTION_COUNT}{" "}
          題，全對得 100 分。
        </p>
      </div>

      <div
        className="mx-auto flex max-w-xs items-center justify-center gap-2 rounded-[14px] border px-4 py-3 text-sm"
        style={{
          borderColor: "#c7d2fe",
          backgroundColor: "#eef2ff",
          color: "#4338ca",
        }}
      >
        <Trophy className="size-4" />
        目前最高分：<span className="font-semibold">{bestScore}</span>
      </div>

      <Button
        onClick={onStart}
        className="gap-2 rounded-full px-8 py-6 text-base text-white shadow-[0_6px_18px_rgba(99,102,241,0.32)] transition hover:-translate-y-0.5"
        style={{ backgroundColor: ACCENT }}
      >
        <Sparkles className="size-5" />
        開始挑戰
      </Button>
    </div>
  );
}

/* --------------------------------------------------------------- Playing */

function Playing({
  q,
  index,
  total,
  wrongPicks,
  solved,
  resolved,
  maxWrong,
  score,
  streak,
  onPick,
  onNext,
}: {
  q: ThemeQuestion;
  index: number;
  total: number;
  wrongPicks: number[];
  solved: boolean;
  resolved: boolean;
  maxWrong: number;
  score: number;
  streak: number;
  onPick: (i: number) => void;
  onNext: () => void;
}) {
  const remaining = maxWrong - wrongPicks.length;
  const progressPct = Math.round(((index + (resolved ? 1 : 0)) / total) * 100);

  return (
    <div className="space-y-5">
      {/* HUD */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-[#6b6385]">
          第 {index + 1} / {total} 題
        </span>
        <div className="flex items-center gap-3 text-sm">
          {streak >= 2 && (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold"
              style={{ backgroundColor: "#eef2ff", color: "#4338ca" }}
            >
              <Sparkles className="size-3.5" />
              連對 {streak}
            </span>
          )}
          <span
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold"
            style={{ backgroundColor: "#eef2ff", color: "#4338ca" }}
          >
            <Trophy className="size-3.5" />
            {score} 分
          </span>
        </div>
      </div>

      {/* Progress */}
      <div className="h-2 w-full overflow-hidden rounded-full bg-[#e7e9fb]">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${progressPct}%`, backgroundColor: ACCENT }}
        />
      </div>

      {/* Passage: original + translation */}
      <div className="wyt-pop-in overflow-hidden rounded-[18px] border border-[#dfe2fb] bg-white shadow-[0_10px_28px_rgba(99,102,241,0.10)]">
        <div className="flex items-center justify-between border-b border-[#e7e9fb] bg-[#f5f6ff] px-5 py-3">
          <span className="font-serif text-base font-semibold text-[#1a1330]">
            {q.title}
          </span>
          <span className="text-xs text-[#8b86a8]">{q.source}</span>
        </div>
        <div className="space-y-4 p-5 md:p-6">
          <div>
            <p
              className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[1px]"
              style={{ color: ACCENT }}
            >
              <ScrollText className="size-3.5" />
              原文
            </p>
            <p className="font-serif text-[20px] leading-[1.9] tracking-[0.02em] text-[#1a1330] md:text-[22px]">
              {q.original}
            </p>
          </div>
          <div className="border-t border-dashed border-[#e7e9fb] pt-4">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[1px] text-[#8b86a8]">
              <Languages className="size-3.5" />
              翻譯
            </p>
            <p className="text-[15px] leading-[1.9] text-[#4b4660]">
              {q.translation}
            </p>
          </div>
        </div>
      </div>

      <p className="px-1 text-sm font-medium text-[#1a1330]">
        這篇文章想說明的{" "}
        <span className="font-semibold" style={{ color: ACCENT }}>
          主旨（道理）
        </span>{" "}
        是甚麼？
      </p>

      {/* Options */}
      <div className="grid gap-3">
        {q.options.map((opt, i) => {
          const correct = i === q.answerIndex;
          const isWrongPick = wrongPicks.includes(i);

          let cls =
            "border-[#dfe2fb] bg-white hover:border-[#6366f1] hover:bg-[#f7f8ff] hover:-translate-y-0.5";
          let anim = "";
          if (isWrongPick) {
            // Mark the options the student already tried (without revealing answer).
            cls = "border-[#dc2626]/50 bg-[#fef2f2]";
            anim = "wyt-shake";
          } else if (solved && correct) {
            cls = "border-[#16a34a]/50 bg-[#f0fdf4]";
            anim = "wyt-pop";
          } else if (resolved) {
            cls = "border-[#ececec] bg-[#fafafa] opacity-70";
          }

          const disabled = resolved || isWrongPick;

          return (
            <button
              key={i}
              onClick={() => onPick(i)}
              disabled={disabled}
              style={{ animationDelay: resolved ? "0ms" : `${i * 60}ms` }}
              className={[
                "wyt-fade-in-up flex items-center justify-between gap-3 rounded-[14px] border px-4 py-4 text-left text-[15px] font-medium leading-7 text-[#1a1330] transition",
                cls,
                anim,
                disabled ? "cursor-default" : "cursor-pointer",
              ].join(" ")}
            >
              <span>{opt}</span>
              {solved && correct && (
                <CheckCircle2 className="size-5 shrink-0 text-[#16a34a]" />
              )}
              {isWrongPick && (
                <XCircle className="size-5 shrink-0 text-[#dc2626]" />
              )}
            </button>
          );
        })}
      </div>

      {/* Retry hint between attempts — no answer is revealed */}
      {!resolved && wrongPicks.length > 0 && (
        <div className="wyt-fade-in-up rounded-[14px] border border-[#f59e0b]/30 bg-[#fffbeb] p-4 text-sm leading-7 text-[#b45309]">
          答錯了，再想想看！還剩 <span className="font-semibold">{remaining}</span> 次機會。
        </div>
      )}

      {/* Feedback + next (only once the question is resolved) */}
      {resolved && (
        <div className="space-y-4 wyt-fade-in-up">
          <div
            className={[
              "rounded-[14px] border p-4 text-sm leading-7",
              solved
                ? "border-[#16a34a]/30 bg-[#f0fdf4] text-[#15803d]"
                : "border-[#6366f1]/30 bg-[#eef2ff] text-[#4338ca]",
            ].join(" ")}
          >
            {solved
              ? "答對了！🎉 你讀懂了這篇文章的道理。"
              : "兩次機會都用完了。再多讀幾遍文章，慢慢體會當中的道理吧！"}
          </div>
          <div className="flex justify-end">
            <Button
              onClick={onNext}
              className="gap-2 rounded-full text-white shadow-[0_4px_14px_rgba(99,102,241,0.3)] transition hover:-translate-y-0.5"
              style={{ backgroundColor: ACCENT }}
            >
              {index + 1 < total ? "下一題" : "看成績"}
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- Confetti */

const CONFETTI_COLORS = [
  "#6366f1",
  "#f59e0b",
  "#16a34a",
  "#ef4444",
  "#3b82f6",
  "#ec4899",
];

function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 36 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.5,
        duration: 1.6 + Math.random() * 1.4,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        size: 6 + Math.random() * 6,
        rounded: Math.random() > 0.5,
      })),
    []
  );

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-0 overflow-visible">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="wyt-confetti-piece absolute top-0 block"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            borderRadius: p.rounded ? "9999px" : "2px",
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- Result */

function useCountUp(target: number, durationMs = 900) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);
  return value;
}

function Result({
  score,
  correctCount,
  total,
  maxStreak,
  bestScore,
  newBadges,
  onReplay,
}: {
  score: number;
  correctCount: number;
  total: number;
  maxStreak: number;
  bestScore: number;
  newBadges: string[];
  onReplay: () => void;
}) {
  const displayScore = useCountUp(score);
  const celebrate = score >= 75;

  const message = useMemo(() => {
    if (score >= 100) return "滿分！你完全讀懂了文章的道理！👑";
    if (score >= 75) return "很棒，主旨掌握得不錯！🏅";
    if (score >= 50) return "再讀仔細一點，你會更明白！⭐";
    return "別灰心，多讀幾遍就會明白道理！🌱";
  }, [score]);

  return (
    <div className="relative space-y-6 text-center">
      {celebrate && <Confetti />}

      <div
        className="mx-auto flex size-16 items-center justify-center rounded-[18px] text-white shadow-[6px_6px_0px_#1a1330] wyt-pop-in"
        style={{ backgroundColor: ACCENT }}
      >
        <Lightbulb className="size-7" />
      </div>

      <div className="space-y-1">
        <p className="text-sm text-[#6b6385]">本場得分</p>
        <p className="font-serif text-[56px] font-semibold leading-none text-[#1a1330]">
          {displayScore}
        </p>
        <p className="text-sm text-[#6b6385]">{message}</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <ResultStat label="答對題數" value={`${correctCount}/${total}`} />
        <ResultStat label="最長連對" value={`${maxStreak}`} />
        <ResultStat label="歷來最高" value={`${bestScore}`} />
      </div>

      {newBadges.length > 0 && (
        <div className="wyt-pop-in rounded-[16px] border border-[#c7d2fe] bg-[#eef2ff] p-5">
          <p className="text-sm font-semibold text-[#4338ca]">🎉 解鎖新獎章！</p>
          <div className="mt-3 flex flex-wrap justify-center gap-3">
            {newBadges.map((id, i) => {
              const b = getBadge(id);
              if (!b) return null;
              return (
                <div
                  key={id}
                  style={{ animationDelay: `${i * 120}ms` }}
                  className="wyt-pop-in flex items-center gap-2 rounded-full border border-[#c7d2fe] bg-white px-3 py-1.5 text-sm font-medium text-[#1a1330]"
                >
                  <span className="text-lg">{b.emoji}</span>
                  {b.label}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button
          onClick={onReplay}
          className="gap-2 rounded-full px-6 text-white shadow-[0_4px_14px_rgba(99,102,241,0.3)] transition hover:-translate-y-0.5"
          style={{ backgroundColor: ACCENT }}
        >
          <RotateCcw className="size-4" />
          再玩一次
        </Button>
        <Link href="/chinese/wenyan">
          <Button
            variant="outline"
            className="gap-2 rounded-full border-[#e0dbf0] bg-white text-[#5b4f7a] transition hover:border-[#c4b8ec] hover:bg-[#f7f4ff]"
          >
            <ChevronLeft className="size-4" />
            回到首頁
          </Button>
        </Link>
      </div>
    </div>
  );
}

function ResultStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[14px] border border-[#e6e1f3] bg-white/90 p-4">
      <p className="text-[11px] uppercase tracking-[1px] text-[#9a8fb5]">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold text-[#1a1330]">{value}</p>
    </div>
  );
}
