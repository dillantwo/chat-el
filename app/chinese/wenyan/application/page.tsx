"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  Rocket,
  Trophy,
  ArrowRight,
  RotateCcw,
  Sparkles,
  ScrollText,
  Languages,
  Lightbulb,
  Loader2,
  Brain,
  MapPin,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { recordChallenge, getBadge, getProgress } from "@/lib/wenyan-progress";
import {
  buildApplicationQuiz,
  APPLICATION_QUESTION_COUNT,
  type ApplicationQuestion,
} from "@/lib/wenyan-theme";
import { basePath } from "@/lib/utils";

const ACCENT = "#e11d48";

type Phase = "intro" | "playing" | "result";

interface Feedback {
  understandingScore: number;
  applicationScore: number;
  understandingComment: string;
  applicationComment: string;
  suggestion: string;
  exemplar: string;
  total: number;
}

export default function WenyanApplicationPage() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [quiz, setQuiz] = useState<ApplicationQuestion[]>([]);
  const [current, setCurrent] = useState(0);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const [scoreSum, setScoreSum] = useState(0); // sum of per-question totals
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [passCount, setPassCount] = useState(0);
  const [newBadges, setNewBadges] = useState<string[]>([]);
  const [bestScore, setBestScore] = useState(0);
  const [finalScore, setFinalScore] = useState(0);

  useEffect(() => {
    getProgress().then((p) => setBestScore(p.bestApplication));
  }, []);

  const q = quiz[current];

  function startGame() {
    setQuiz(buildApplicationQuiz());
    setCurrent(0);
    setInput("");
    setLoading(false);
    setError(null);
    setFeedback(null);
    setScoreSum(0);
    setStreak(0);
    setMaxStreak(0);
    setPassCount(0);
    setNewBadges([]);
    setFinalScore(0);
    setPhase("playing");
  }

  async function submit() {
    if (loading || feedback) return;
    if (!input.trim()) {
      setError("請先寫出你的生活例子");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${basePath}/api/wenyan-application`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: q.title,
          source: q.source,
          original: q.original,
          translation: q.translation,
          mainIdea: q.mainIdea,
          userInput: input.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "評分失敗，請再試一次");
      }

      const data = (await res.json()) as Feedback;
      setFeedback(data);
      setScoreSum((s) => s + data.total);
      if (data.total >= 60) {
        setPassCount((c) => c + 1);
        setStreak((prev) => {
          const nextStreak = prev + 1;
          setMaxStreak((m) => Math.max(m, nextStreak));
          return nextStreak;
        });
      } else {
        setStreak(0);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "評分時發生錯誤");
    } finally {
      setLoading(false);
    }
  }

  function next() {
    if (current + 1 < quiz.length) {
      setCurrent((c) => c + 1);
      setInput("");
      setFeedback(null);
      setError(null);
      return;
    }
    // Round score = average of per-question totals (0–100).
    const score = Math.round(scoreSum / quiz.length);
    setFinalScore(score);
    setPhase("result");
    recordChallenge("application", { score, maxStreak }).then(
      ({ progress, newBadges }) => {
        setNewBadges(newBadges);
        setBestScore(progress.bestApplication);
      }
    );
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
          <Rocket className="size-4" style={{ color: ACCENT }} />
          <span className="text-sm font-semibold text-[#080808]">
            挑戰模式 - 主旨應用
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
              input={input}
              loading={loading}
              error={error}
              feedback={feedback}
              streak={streak}
              onInput={setInput}
              onSubmit={submit}
              onNext={next}
            />
          )}

          {phase === "result" && (
            <Result
              score={finalScore}
              passCount={passCount}
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
        <Rocket className="size-7" />
      </div>
      <div className="space-y-2">
        <h1 className="font-serif text-[34px] font-semibold tracking-[-0.02em] text-[#1a1330]">
          學以致用
        </h1>
        <p className="mx-auto max-w-md text-sm leading-7 text-[#6b6385]">
          每題會給你一篇文言文的原文、翻譯，以及它隱含的{" "}
          <span className="font-semibold" style={{ color: ACCENT }}>
            主旨道理
          </span>
          。請你想想：生活中有沒有類似道理的例子？用一兩句寫出一個{" "}
          <span className="font-semibold" style={{ color: ACCENT }}>
            生活隱喻
          </span>
          ，AI 老師會從「主旨理解」和「應用場景」兩方面評分並給建議。共{" "}
          {APPLICATION_QUESTION_COUNT} 題，平均分滿分 100 分。
        </p>
      </div>

      <div className="mx-auto flex max-w-sm flex-wrap items-center justify-center gap-2 text-xs text-[#6b6385]">
        <span className="inline-flex items-center gap-1 rounded-full border border-[#fbcfe8] bg-[#fff1f5] px-3 py-1.5 text-[#be123c]">
          <Brain className="size-3.5" /> 主旨理解 50 分
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-[#fbcfe8] bg-[#fff1f5] px-3 py-1.5 text-[#be123c]">
          <MapPin className="size-3.5" /> 應用場景 50 分
        </span>
      </div>

      <div
        className="mx-auto flex max-w-xs items-center justify-center gap-2 rounded-[14px] border px-4 py-3 text-sm"
        style={{
          borderColor: "#fbcfe8",
          backgroundColor: "#fff1f5",
          color: "#be123c",
        }}
      >
        <Trophy className="size-4" />
        目前最高分：<span className="font-semibold">{bestScore}</span>
      </div>

      <Button
        onClick={onStart}
        className="gap-2 rounded-full px-8 py-6 text-base text-white shadow-[0_6px_18px_rgba(225,29,72,0.32)] transition hover:-translate-y-0.5"
        style={{ backgroundColor: ACCENT }}
      >
        <Sparkles className="size-5" />
        開始挑戰
      </Button>
    </div>
  );
}

/* ----------------------------------------------------------- Score bar */

function ScoreBar({
  label,
  icon: Icon,
  score,
  max,
  comment,
}: {
  label: string;
  icon: typeof Brain;
  score: number;
  max: number;
  comment: string;
}) {
  const pct = Math.round((score / max) * 100);
  return (
    <div className="rounded-[12px] border border-[#f1d6e0] bg-white p-3">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1a1330]">
          <Icon className="size-4" style={{ color: ACCENT }} />
          {label}
        </span>
        <span className="text-sm font-semibold" style={{ color: ACCENT }}>
          {score}/{max}
        </span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[#fbe4ec]">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: ACCENT }}
        />
      </div>
      {comment && (
        <p className="mt-2 text-xs leading-6 text-[#6b6385]">{comment}</p>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- Playing */

function Playing({
  q,
  index,
  total,
  input,
  loading,
  error,
  feedback,
  streak,
  onInput,
  onSubmit,
  onNext,
}: {
  q: ApplicationQuestion;
  index: number;
  total: number;
  input: string;
  loading: boolean;
  error: string | null;
  feedback: Feedback | null;
  streak: number;
  onInput: (v: string) => void;
  onSubmit: () => void;
  onNext: () => void;
}) {
  const progressPct = Math.round(
    ((index + (feedback ? 1 : 0)) / total) * 100
  );

  return (
    <div className="space-y-5">
      {/* HUD */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-[#6b6385]">
          第 {index + 1} / {total} 題
        </span>
        {streak >= 2 && (
          <span
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-semibold"
            style={{ backgroundColor: "#fff1f5", color: "#be123c" }}
          >
            <Sparkles className="size-3.5" />
            連續答得好 {streak}
          </span>
        )}
      </div>

      {/* Progress */}
      <div className="h-2 w-full overflow-hidden rounded-full bg-[#fbe4ec]">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${progressPct}%`, backgroundColor: ACCENT }}
        />
      </div>

      {/* Passage: original + translation */}
      <div className="wyt-pop-in overflow-hidden rounded-[18px] border border-[#f1d6e0] bg-white shadow-[0_10px_28px_rgba(225,29,72,0.10)]">
        <div className="flex items-center justify-between border-b border-[#fbe4ec] bg-[#fff5f8] px-5 py-3">
          <span className="font-serif text-base font-semibold text-[#1a1330]">
            {q.title}
          </span>
          <span className="text-xs text-[#a8849a]">{q.source}</span>
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
          <div className="border-t border-dashed border-[#fbe4ec] pt-4">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[1px] text-[#a8849a]">
              <Languages className="size-3.5" />
              翻譯
            </p>
            <p className="text-[15px] leading-[1.9] text-[#4b4660]">
              {q.translation}
            </p>
          </div>
        </div>
      </div>

      {/* Given main idea */}
      <div className="flex items-start gap-2 rounded-[14px] border border-[#fde68a] bg-[#fffbeb] p-4">
        <Lightbulb className="mt-0.5 size-4 shrink-0 text-[#d97706]" />
        <p className="text-sm leading-7 text-[#92400e]">
          <span className="font-semibold">本文主旨（道理）：</span>
          {q.mainIdea}
        </p>
      </div>

      {/* Student input */}
      <div className="space-y-2">
        <p className="flex items-center gap-1.5 px-1 text-sm font-medium text-[#1a1330]">
          <Pencil className="size-4" style={{ color: ACCENT }} />
          生活中有沒有類似道理的例子？寫一個生活隱喻 / 情境：
        </p>
        <Textarea
          value={input}
          onChange={(e) => onInput(e.target.value)}
          disabled={loading || !!feedback}
          placeholder="在這裏寫出你想到的生活例子……"
          className="min-h-[110px] resize-y rounded-[12px] border-[#f1d6e0] bg-[#fffafb] text-[15px] leading-[1.7] text-[#1a1330] focus-visible:ring-[#e11d48]"
        />
        {error && <p className="px-1 text-sm text-[#dc2626]">{error}</p>}
      </div>

      {/* Submit (before feedback) */}
      {!feedback && (
        <div className="flex justify-end">
          <Button
            onClick={onSubmit}
            disabled={loading || !input.trim()}
            className="gap-2 rounded-full text-white shadow-[0_4px_14px_rgba(225,29,72,0.3)] transition hover:-translate-y-0.5"
            style={{ backgroundColor: ACCENT }}
          >
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                AI 評分中…
              </>
            ) : (
              <>
                <Sparkles className="size-4" />
                送出評分
              </>
            )}
          </Button>
        </div>
      )}

      {/* Feedback */}
      {feedback && (
        <div className="space-y-4 wyt-fade-in-up">
          <div className="flex items-center justify-center gap-2 rounded-[14px] border border-[#f1d6e0] bg-[#fff5f8] px-4 py-3">
            <Trophy className="size-4" style={{ color: ACCENT }} />
            <span className="text-sm text-[#6b6385]">本題得分</span>
            <span
              className="text-2xl font-semibold"
              style={{ color: ACCENT }}
            >
              {feedback.total}
            </span>
            <span className="text-sm text-[#6b6385]">/ 100</span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <ScoreBar
              label="主旨理解"
              icon={Brain}
              score={feedback.understandingScore}
              max={50}
              comment={feedback.understandingComment}
            />
            <ScoreBar
              label="應用場景"
              icon={MapPin}
              score={feedback.applicationScore}
              max={50}
              comment={feedback.applicationComment}
            />
          </div>

          {feedback.suggestion && (
            <div className="rounded-[14px] border border-[#bfdbfe] bg-[#eff6ff] p-4 text-sm leading-7 text-[#1d4ed8]">
              <span className="font-semibold">💬 建議：</span>
              {feedback.suggestion}
            </div>
          )}

          {feedback.exemplar && (
            <div className="rounded-[14px] border border-[#bbf7d0] bg-[#f0fdf4] p-4 text-sm leading-7 text-[#15803d]">
              <span className="font-semibold">🌰 參考例子：</span>
              {feedback.exemplar}
            </div>
          )}

          <div className="flex justify-end">
            <Button
              onClick={onNext}
              className="gap-2 rounded-full text-white shadow-[0_4px_14px_rgba(225,29,72,0.3)] transition hover:-translate-y-0.5"
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
  "#e11d48",
  "#f59e0b",
  "#16a34a",
  "#6366f1",
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
  passCount,
  total,
  maxStreak,
  bestScore,
  newBadges,
  onReplay,
}: {
  score: number;
  passCount: number;
  total: number;
  maxStreak: number;
  bestScore: number;
  newBadges: string[];
  onReplay: () => void;
}) {
  const displayScore = useCountUp(score);
  const celebrate = score >= 75;

  const message = useMemo(() => {
    if (score >= 90) return "太棒了，真正做到學以致用！👑";
    if (score >= 75) return "很好，你能把道理用在生活上！🏅";
    if (score >= 50) return "不錯的嘗試，再想得貼切一點！⭐";
    return "別灰心，多想想生活中的例子！🌱";
  }, [score]);

  return (
    <div className="relative space-y-6 text-center">
      {celebrate && <Confetti />}

      <div
        className="mx-auto flex size-16 items-center justify-center rounded-[18px] text-white shadow-[6px_6px_0px_#1a1330] wyt-pop-in"
        style={{ backgroundColor: ACCENT }}
      >
        <Rocket className="size-7" />
      </div>

      <div className="space-y-1">
        <p className="text-sm text-[#6b6385]">本場平均得分</p>
        <p className="font-serif text-[56px] font-semibold leading-none text-[#1a1330]">
          {displayScore}
        </p>
        <p className="text-sm text-[#6b6385]">{message}</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <ResultStat label="答得好題數" value={`${passCount}/${total}`} />
        <ResultStat label="最長連續" value={`${maxStreak}`} />
        <ResultStat label="歷來最高" value={`${bestScore}`} />
      </div>

      {newBadges.length > 0 && (
        <div className="wyt-pop-in rounded-[16px] border border-[#fbcfe8] bg-[#fff1f5] p-5">
          <p className="text-sm font-semibold text-[#be123c]">🎉 解鎖新獎章！</p>
          <div className="mt-3 flex flex-wrap justify-center gap-3">
            {newBadges.map((id, i) => {
              const b = getBadge(id);
              if (!b) return null;
              return (
                <div
                  key={id}
                  style={{ animationDelay: `${i * 120}ms` }}
                  className="wyt-pop-in flex items-center gap-2 rounded-full border border-[#fbcfe8] bg-white px-3 py-1.5 text-sm font-medium text-[#1a1330]"
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
          className="gap-2 rounded-full px-6 text-white shadow-[0_4px_14px_rgba(225,29,72,0.3)] transition hover:-translate-y-0.5"
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
