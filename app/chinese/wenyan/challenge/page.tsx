"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  Swords,
  Trophy,
  Flame,
  CheckCircle2,
  XCircle,
  ArrowRight,
  RotateCcw,
  Sparkles,
  Timer as TimerIcon,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  buildQuiz,
  recordChallenge,
  getBadge,
  getProgress,
  type QuizQuestion,
} from "@/lib/wenyan-progress";

const QUESTION_COUNT = 10;
const TIME_PER_Q_MS = 15000;
const MAX_PER_Q = 10; // total max = 100

type Phase = "intro" | "playing" | "result";

/** Faster answers earn more: 6 pts (slow) → 10 pts (instant). */
function pointsFor(remainingMs: number) {
  const frac = Math.max(0, Math.min(1, remainingMs / TIME_PER_Q_MS));
  return Math.round(MAX_PER_Q * (0.6 + 0.4 * frac));
}

export default function WenyanChallengePage() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [quiz, setQuiz] = useState<QuizQuestion[]>([]);
  const [current, setCurrent] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [remainingMs, setRemainingMs] = useState(TIME_PER_Q_MS);
  const [gain, setGain] = useState(0);
  const [gainKey, setGainKey] = useState(0);
  const [newBadges, setNewBadges] = useState<string[]>([]);
  const [bestScore, setBestScore] = useState(0);

  // Keep latest remaining time without retriggering the timer effect.
  const remainingRef = useRef(TIME_PER_Q_MS);
  remainingRef.current = remainingMs;

  useEffect(() => {
    getProgress().then((p) => setBestScore(p.bestTranslate));
  }, []);

  // Countdown timer for the current question.
  useEffect(() => {
    if (phase !== "playing" || answered) return;
    setRemainingMs(TIME_PER_Q_MS);
    const start = Date.now();
    const id = setInterval(() => {
      const rem = TIME_PER_Q_MS - (Date.now() - start);
      if (rem <= 0) {
        setRemainingMs(0);
        clearInterval(id);
        // Time ran out → counts as wrong, reveal the answer.
        setAnswered(true);
        setPicked(null);
        setStreak(0);
      } else {
        setRemainingMs(rem);
      }
    }, 50);
    return () => clearInterval(id);
  }, [phase, current, answered]);

  const q = quiz[current];

  function startGame() {
    setQuiz(buildQuiz(QUESTION_COUNT));
    setCurrent(0);
    setPicked(null);
    setAnswered(false);
    setScore(0);
    setStreak(0);
    setMaxStreak(0);
    setCorrectCount(0);
    setRemainingMs(TIME_PER_Q_MS);
    setGain(0);
    setNewBadges([]);
    setPhase("playing");
  }

  function pick(index: number) {
    if (answered) return;
    const rem = remainingRef.current;
    setPicked(index);
    setAnswered(true);

    if (index === q.answerIndex) {
      const pts = pointsFor(rem);
      setScore((s) => s + pts);
      setCorrectCount((c) => c + 1);
      setGain(pts);
      setGainKey((k) => k + 1);
      setStreak((prev) => {
        const nextStreak = prev + 1;
        setMaxStreak((m) => Math.max(m, nextStreak));
        return nextStreak;
      });
    } else {
      setStreak(0);
    }
  }

  async function next() {
    if (current + 1 < quiz.length) {
      setCurrent((c) => c + 1);
      setPicked(null);
      setAnswered(false);
      return;
    }
    setPhase("result");
    const { progress, newBadges } = await recordChallenge("translate", {
      score,
      maxStreak,
    });
    setNewBadges(newBadges);
    setBestScore(progress.bestTranslate);
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
          <Swords className="size-4 text-[#f59e0b]" />
          <span className="text-sm font-semibold text-[#080808]">挑戰模式 - 常用詞翻譯</span>
        </div>
        <div className="w-[112px]" />
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto bg-white px-4 py-8 md:px-6">
        <div className="mx-auto w-full max-w-2xl">
          {phase === "intro" && <Intro bestScore={bestScore} onStart={startGame} />}

          {phase === "playing" && q && (
            <Playing
              key={current}
              q={q}
              index={current}
              total={quiz.length}
              picked={picked}
              answered={answered}
              score={score}
              streak={streak}
              remainingMs={remainingMs}
              gain={gain}
              gainKey={gainKey}
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

function Intro({ bestScore, onStart }: { bestScore: number; onStart: () => void }) {
  return (
    <div className="space-y-6 text-center wyt-fade-in-up">
      <div className="mx-auto flex size-16 items-center justify-center rounded-[18px] bg-[#f59e0b] text-white shadow-[6px_6px_0px_#1a1330] wyt-pop-in">
        <Swords className="size-7" />
      </div>
      <div className="space-y-2">
        <h1 className="font-serif text-[34px] font-semibold tracking-[-0.02em] text-[#1a1330]">
          常用字大挑戰
        </h1>
        <p className="mx-auto max-w-md text-sm leading-7 text-[#6b6385]">
          每題會給你一句文言文，當中有一個 <span className="font-semibold text-[#f59e0b]">黃色</span> 的常用詞。
          在 <span className="font-semibold text-[#f59e0b]">15 秒</span> 內選出它的正確意思，
          答得越快分數越高！題目全部選自學習模式的四篇文章，共 {QUESTION_COUNT} 題，滿分 100 分。
        </p>
      </div>

      <div className="mx-auto flex max-w-sm flex-wrap items-center justify-center gap-2 text-xs text-[#6b6385]">
        <span className="inline-flex items-center gap-1 rounded-full border border-[#f6d9a8] bg-[#fffbeb] px-3 py-1.5 text-[#b45309]">
          <TimerIcon className="size-3.5" /> 限時作答
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-[#f6d9a8] bg-[#fffbeb] px-3 py-1.5 text-[#b45309]">
          <Zap className="size-3.5" /> 快答有獎勵
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-[#f6d9a8] bg-[#fffbeb] px-3 py-1.5 text-[#b45309]">
          <Flame className="size-3.5" /> 連勝加倍爽
        </span>
      </div>

      <div className="mx-auto flex max-w-xs items-center justify-center gap-2 rounded-[14px] border border-[#f6d9a8] bg-[#fffbeb] px-4 py-3 text-sm text-[#b45309]">
        <Trophy className="size-4" />
        目前最高分：<span className="font-semibold">{bestScore}</span>
      </div>

      <Button
        onClick={onStart}
        className="gap-2 rounded-full bg-[#f59e0b] px-8 py-6 text-base text-white shadow-[0_6px_18px_rgba(245,158,11,0.32)] transition hover:-translate-y-0.5 hover:bg-[#d97706]"
      >
        <Sparkles className="size-5" />
        開始挑戰
      </Button>
    </div>
  );
}

/* ----------------------------------------------------------- Timer ring */

function TimerRing({ remainingMs }: { remainingMs: number }) {
  const frac = Math.max(0, Math.min(1, remainingMs / TIME_PER_Q_MS));
  const seconds = Math.ceil(remainingMs / 1000);
  const R = 18;
  const C = 2 * Math.PI * R;
  const low = remainingMs <= 4000;
  const color = frac > 0.5 ? "#16a34a" : frac > 0.25 ? "#f59e0b" : "#dc2626";

  return (
    <div className={["relative size-12", low ? "wyt-ring-pulse" : ""].join(" ")}>
      <svg className="size-12 -rotate-90" viewBox="0 0 44 44">
        <circle cx="22" cy="22" r={R} fill="none" stroke="#f0e6d4" strokeWidth="4" />
        <circle
          cx="22"
          cy="22"
          r={R}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - frac)}
          style={{ transition: "stroke-dashoffset 80ms linear, stroke 200ms" }}
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center text-sm font-bold"
        style={{ color }}
      >
        {seconds}
      </span>
    </div>
  );
}

/* --------------------------------------------------------------- Playing */

function highlightChar(sentence: string, char: string) {
  const parts = sentence.split(char);
  return parts.map((part, i) => (
    <span key={i}>
      {part}
      {i < parts.length - 1 && (
        <span className="mx-0.5 inline-block rounded-[6px] bg-[#fde68a] px-1.5 py-0.5 font-bold text-[#b45309] wyt-pop">
          {char}
        </span>
      )}
    </span>
  ));
}

function Playing({
  q,
  index,
  total,
  picked,
  answered,
  score,
  streak,
  remainingMs,
  gain,
  gainKey,
  onPick,
  onNext,
}: {
  q: QuizQuestion;
  index: number;
  total: number;
  picked: number | null;
  answered: boolean;
  score: number;
  streak: number;
  remainingMs: number;
  gain: number;
  gainKey: number;
  onPick: (i: number) => void;
  onNext: () => void;
}) {
  const isCorrect = answered && picked === q.answerIndex;
  const timedOut = answered && picked === null;
  const progressPct = Math.round(((index + (answered ? 1 : 0)) / total) * 100);

  return (
    <div className="space-y-5">
      {/* HUD */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <TimerRing remainingMs={remainingMs} />
          <span className="text-sm font-medium text-[#6b6385]">
            第 {index + 1} / {total} 題
          </span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          {streak >= 2 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#fff1e6] px-2.5 py-1 font-semibold text-[#ea580c]">
              <Flame className="size-3.5 wyt-flame" />
              連對 {streak}
            </span>
          )}
          <div className="relative">
            <span className="inline-flex items-center gap-1 rounded-full bg-[#fffbeb] px-2.5 py-1 font-semibold text-[#b45309]">
              <Trophy className="size-3.5" />
              {score} 分
            </span>
            {gain > 0 && (
              <span
                key={gainKey}
                className="wyt-float-up pointer-events-none absolute -top-1 right-2 text-sm font-bold text-[#16a34a]"
              >
                +{gain}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Progress */}
      <div className="h-2 w-full overflow-hidden rounded-full bg-[#f0e6d4]">
        <div
          className="h-full rounded-full bg-[#f59e0b] transition-all duration-300"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Sentence fragment */}
      <div className="wyt-pop-in rounded-[18px] border border-[#f6d9a8] bg-white p-6 shadow-[0_10px_28px_rgba(245,158,11,0.10)] md:p-8">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[1px] text-[#c79a4f]">
          文言文片段
        </p>
        <p className="font-serif text-[24px] leading-[1.9] tracking-[0.03em] text-[#1a1330] md:text-[28px]">
          {highlightChar(q.sentence, q.char.char)}
        </p>
        <p className="mt-4 text-sm text-[#6b6385]">
          句中「
          <span className="font-serif font-semibold text-[#b45309]">{q.char.char}</span>
          」（{q.char.pinyin}）是甚麼意思？
        </p>
      </div>

      {/* Options */}
      <div className="grid gap-3 sm:grid-cols-2">
        {q.options.map((opt, i) => {
          const correct = i === q.answerIndex;
          const chosen = i === picked;

          let cls =
            "border-[#e6e1f3] bg-white hover:border-[#f59e0b] hover:bg-[#fffdf5] hover:-translate-y-0.5";
          let anim = "";
          if (answered) {
            if (correct) {
              cls = "border-[#16a34a]/50 bg-[#f0fdf4]";
              anim = "wyt-pop";
            } else if (chosen) {
              cls = "border-[#dc2626]/50 bg-[#fef2f2]";
              anim = "wyt-shake";
            } else {
              cls = "border-[#ececec] bg-[#fafafa] opacity-70";
            }
          }

          return (
            <button
              key={i}
              onClick={() => onPick(i)}
              disabled={answered}
              style={{ animationDelay: answered ? "0ms" : `${i * 70}ms` }}
              className={[
                "wyt-fade-in-up flex items-center justify-between gap-3 rounded-[14px] border px-4 py-4 text-left text-[15px] font-medium text-[#1a1330] transition",
                cls,
                anim,
                answered ? "cursor-default" : "cursor-pointer",
              ].join(" ")}
            >
              <span>{opt}</span>
              {answered && correct && (
                <CheckCircle2 className="size-5 shrink-0 text-[#16a34a]" />
              )}
              {answered && chosen && !correct && (
                <XCircle className="size-5 shrink-0 text-[#dc2626]" />
              )}
            </button>
          );
        })}
      </div>

      {/* Feedback + next */}
      {answered && (
        <div className="space-y-4 wyt-fade-in-up">
          <div
            className={[
              "rounded-[14px] border p-4 text-sm leading-7",
              isCorrect
                ? "border-[#16a34a]/30 bg-[#f0fdf4] text-[#15803d]"
                : "border-[#f59e0b]/30 bg-[#fffbeb] text-[#b45309]",
            ].join(" ")}
          >
            {isCorrect
              ? `答對了！+${gain} 分 🎉`
              : timedOut
                ? "時間到了！下次快一點 ⏰"
                : "答錯了，沒關係，記住它吧！"}
            　「<span className="font-serif font-semibold">{q.char.char}</span>」的意思是「
            <span className="font-semibold">{q.char.meaning}</span>」。
          </div>
          <div className="flex justify-end">
            <Button
              onClick={onNext}
              className="gap-2 rounded-full bg-[#f59e0b] text-white shadow-[0_4px_14px_rgba(245,158,11,0.3)] transition hover:-translate-y-0.5 hover:bg-[#d97706]"
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

const CONFETTI_COLORS = ["#f59e0b", "#7a3dff", "#16a34a", "#ef4444", "#3b82f6", "#ec4899"];

function Confetti() {
  // Generated once per mount.
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
      // easeOutCubic
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
  const celebrate = score >= 60;

  const message = useMemo(() => {
    if (score >= 100) return "滿分！你真是文言文大師！👑";
    if (score >= 80) return "太厲害了，繼續保持！🏅";
    if (score >= 60) return "不錯啊，再接再厲！⭐";
    return "別灰心，多玩幾次就會進步！🌱";
  }, [score]);

  return (
    <div className="relative space-y-6 text-center">
      {celebrate && <Confetti />}

      <div className="mx-auto flex size-16 items-center justify-center rounded-[18px] bg-[#16a34a] text-white shadow-[6px_6px_0px_#1a1330] wyt-pop-in">
        <Trophy className="size-7" />
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
        <div className="wyt-pop-in rounded-[16px] border border-[#f6d9a8] bg-[#fffbeb] p-5">
          <p className="text-sm font-semibold text-[#b45309]">🎉 解鎖新獎章！</p>
          <div className="mt-3 flex flex-wrap justify-center gap-3">
            {newBadges.map((id, i) => {
              const b = getBadge(id);
              if (!b) return null;
              return (
                <div
                  key={id}
                  style={{ animationDelay: `${i * 120}ms` }}
                  className="wyt-pop-in flex items-center gap-2 rounded-full border border-[#f6d9a8] bg-white px-3 py-1.5 text-sm font-medium text-[#1a1330]"
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
          className="gap-2 rounded-full bg-[#f59e0b] px-6 text-white shadow-[0_4px_14px_rgba(245,158,11,0.3)] transition hover:-translate-y-0.5 hover:bg-[#d97706]"
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
      <p className="text-[11px] uppercase tracking-[1px] text-[#9a8fb5]">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-[#1a1330]">{value}</p>
    </div>
  );
}
