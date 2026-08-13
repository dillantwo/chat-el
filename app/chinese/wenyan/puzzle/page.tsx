"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  Puzzle as PuzzleIcon,
  Trophy,
  CheckCircle2,
  XCircle,
  ArrowRight,
  RotateCcw,
  Sparkles,
  Hand,
  Lightbulb,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  buildPuzzleRound,
  PUZZLE_PASSAGE_COUNT,
  type PuzzlePassage,
} from "@/lib/wenyan-puzzle";
import { recordChallenge, getBadge, getProgress } from "@/lib/wenyan-progress";

const ACCENT = "#0d9488";

type Phase = "intro" | "playing" | "result";

/** Stable token wrapper: one per blank (plus distractors) in the passage. */
interface Token {
  id: string;
  answer: string;
  meaning: string;
}

export default function WenyanPuzzlePage() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [passages, setPassages] = useState<PuzzlePassage[]>([]);
  const [current, setCurrent] = useState(0);

  // Per-game tallies.
  const [correctTotal, setCorrectTotal] = useState(0);
  const [blanksTotal, setBlanksTotal] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);

  // Result state.
  const [finalScore, setFinalScore] = useState(0);
  const [newBadges, setNewBadges] = useState<string[]>([]);
  const [bestScore, setBestScore] = useState(0);

  useEffect(() => {
    getProgress().then((p) => setBestScore(p.bestPuzzle));
  }, []);

  function startGame() {
    setPassages(buildPuzzleRound(PUZZLE_PASSAGE_COUNT));
    setCurrent(0);
    setCorrectTotal(0);
    setBlanksTotal(0);
    setMaxStreak(0);
    setFinalScore(0);
    setNewBadges([]);
    setPhase("playing");
  }

  async function handlePassageDone(result: {
    correct: number;
    total: number;
    longestRun: number;
  }) {
    const newCorrect = correctTotal + result.correct;
    const newBlanks = blanksTotal + result.total;
    const newStreak = Math.max(maxStreak, result.longestRun);
    setCorrectTotal(newCorrect);
    setBlanksTotal(newBlanks);
    setMaxStreak(newStreak);

    if (current + 1 < passages.length) {
      setCurrent((c) => c + 1);
      return;
    }

    const score = newBlanks ? Math.round((newCorrect / newBlanks) * 100) : 0;
    setFinalScore(score);
    setPhase("result");
    const { progress, newBadges } = await recordChallenge("puzzle", {
      score,
      maxStreak: newStreak,
    });
    setNewBadges(newBadges);
    setBestScore(progress.bestPuzzle);
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
          <PuzzleIcon className="size-4" style={{ color: ACCENT }} />
          <span className="text-sm font-semibold text-[#080808]">
            挑戰模式 - 常用詞拼圖
          </span>
        </div>
        <div className="w-[112px]" />
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto bg-white px-4 py-8 md:px-6">
        <div className="mx-auto w-full max-w-2xl">
          {phase === "intro" && <Intro bestScore={bestScore} onStart={startGame} />}

          {phase === "playing" && passages[current] && (
            <PassagePlay
              key={passages[current].id + current}
              passage={passages[current]}
              index={current}
              total={passages.length}
              onDone={handlePassageDone}
            />
          )}

          {phase === "result" && (
            <Result
              score={finalScore}
              correct={correctTotal}
              total={blanksTotal}
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
      <div
        className="mx-auto flex size-16 items-center justify-center rounded-[18px] text-white shadow-[6px_6px_0px_#1a1330] wyt-pop-in"
        style={{ backgroundColor: ACCENT }}
      >
        <PuzzleIcon className="size-7" />
      </div>
      <div className="space-y-2">
        <h1 className="font-serif text-[34px] font-semibold tracking-[-0.02em] text-[#1a1330]">
          常用詞拼圖
        </h1>
        <p className="mx-auto max-w-md text-sm leading-7 text-[#6b6385]">
          每一段文言文都被抽走了一兩個{" "}
          <span className="font-semibold" style={{ color: ACCENT }}>
            常用詞
          </span>
          。下方每個詞語都附有意思，把正確的詞語{" "}
          <span className="font-semibold" style={{ color: ACCENT }}>
            拖放
          </span>
          （或點選）到空格裏。當中混有{" "}
          <span className="font-semibold" style={{ color: ACCENT }}>
            干擾項
          </span>
          ，不一定用得上。共 {PUZZLE_PASSAGE_COUNT} 段，全對得 100 分！
        </p>
      </div>

      <div className="mx-auto flex max-w-sm flex-wrap items-center justify-center gap-2 text-xs text-[#6b6385]">
        <span className="inline-flex items-center gap-1 rounded-full border border-[#bdeae3] bg-[#effbf8] px-3 py-1.5 text-[#0f766e]">
          <Hand className="size-3.5" /> 拖放或點選
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-[#bdeae3] bg-[#effbf8] px-3 py-1.5 text-[#0f766e]">
          <Lightbulb className="size-3.5" /> 詞語附意思
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-[#bdeae3] bg-[#effbf8] px-3 py-1.5 text-[#0f766e]">
          <Sparkles className="size-3.5" /> 小心干擾項
        </span>
      </div>

      <div className="mx-auto flex max-w-xs items-center justify-center gap-2 rounded-[14px] border border-[#bdeae3] bg-[#effbf8] px-4 py-3 text-sm text-[#0f766e]">
        <Trophy className="size-4" />
        目前最高分：<span className="font-semibold">{bestScore}</span>
      </div>

      <Button
        onClick={onStart}
        className="gap-2 rounded-full px-8 py-6 text-base text-white shadow-[0_6px_18px_rgba(13,148,136,0.32)] transition hover:-translate-y-0.5"
        style={{ backgroundColor: ACCENT }}
      >
        <Sparkles className="size-5" />
        開始拼圖
      </Button>
    </div>
  );
}

/* --------------------------------------------------------- Passage play */

function PassagePlay({
  passage,
  index,
  total,
  onDone,
}: {
  passage: PuzzlePassage;
  index: number;
  total: number;
  onDone: (r: { correct: number; total: number; longestRun: number }) => void;
}) {
  // Build stable tokens (answers + distractors) and a shuffled display order.
  const tokens = useMemo<Token[]>(
    () => [
      ...passage.blanks.map((b, i) => ({
        id: `a-${i}`,
        answer: b.answer,
        meaning: b.meaning,
      })),
      ...passage.distractors.map((d, i) => ({
        id: `d-${i}`,
        answer: d.answer,
        meaning: d.meaning,
      })),
    ],
    [passage]
  );
  const initialBankOrder = useMemo(() => {
    const ids = tokens.map((t) => t.id);
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    return ids;
  }, [tokens]);

  // assign[tokenId] = slot number, or "bank".
  const [assign, setAssign] = useState<Record<string, number | "bank">>(() =>
    Object.fromEntries(tokens.map((t) => [t.id, "bank" as const]))
  );
  const [selected, setSelected] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  const tokenById = (id: string) => tokens.find((t) => t.id === id)!;
  const slotToken = (slot: number) =>
    tokens.find((t) => assign[t.id] === slot) ?? null;
  const bankTokens = initialBankOrder
    .map(tokenById)
    .filter((t) => assign[t.id] === "bank");

  const allSlotsFilled = passage.blanks.every((_, slot) => slotToken(slot) !== null);

  function moveToken(tokenId: string, target: number | "bank") {
    if (checked) return;
    setAssign((prev) => {
      const nextAssign = { ...prev };
      if (typeof target === "number") {
        // Bump whoever currently sits in the target slot back to the bank.
        for (const id of Object.keys(nextAssign)) {
          if (nextAssign[id] === target) nextAssign[id] = "bank";
        }
      }
      nextAssign[tokenId] = target;
      return nextAssign;
    });
    setSelected(null);
  }

  function onSlotClick(slot: number) {
    if (checked) return;
    const occupant = slotToken(slot);
    if (selected) {
      moveToken(selected, slot);
    } else if (occupant) {
      // Pick the token back up into the bank.
      moveToken(occupant.id, "bank");
    }
  }

  function onTokenClick(tokenId: string) {
    if (checked) return;
    setSelected((s) => (s === tokenId ? null : tokenId));
  }

  function check() {
    setChecked(true);
  }

  function finish() {
    let correct = 0;
    let run = 0;
    let longestRun = 0;
    passage.blanks.forEach((b, slot) => {
      const tok = slotToken(slot);
      if (tok && tok.answer === b.answer) {
        correct += 1;
        run += 1;
        longestRun = Math.max(longestRun, run);
      } else {
        run = 0;
      }
    });
    onDone({ correct, total: passage.blanks.length, longestRun });
  }

  const correctNow = checked
    ? passage.blanks.filter((b, slot) => slotToken(slot)?.answer === b.answer).length
    : 0;

  const progressPct = Math.round((index / total) * 100);

  return (
    <div className="space-y-5">
      {/* HUD */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-[#6b6385]">
          第 {index + 1} / {total} 段
        </span>
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold text-white"
          style={{ backgroundColor: ACCENT }}
        >
          {passage.title}
          <span className="opacity-80">· {passage.source}</span>
        </span>
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-[#d8f3ee]">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${progressPct}%`, backgroundColor: ACCENT }}
        />
      </div>

      {/* Passage with blanks */}
      <div
        className="rounded-[18px] border bg-white p-6 shadow-[0_10px_28px_rgba(13,148,136,0.10)] md:p-8"
        style={{ borderColor: "#bdeae3" }}
      >
        <p className="mb-3 text-xs font-semibold uppercase tracking-[1px] text-[#0f766e]">
          文言文片段
        </p>
        <p className="font-serif text-[23px] leading-[2.2] tracking-[0.03em] text-[#1a1330] md:text-[26px]">
          {passage.parts.map((part, i) =>
            part.kind === "text" ? (
              <span key={i}>{part.value}</span>
            ) : (
              <BlankSlot
                key={i}
                token={slotToken(part.slot)}
                expected={passage.blanks[part.slot].answer}
                checked={checked}
                isDropHover={draggingId !== null}
                onClick={() => onSlotClick(part.slot)}
                onDropToken={(id) => moveToken(id, part.slot)}
              />
            )
          )}
        </p>
      </div>

      {/* Token bank */}
      <div
        className="min-h-[64px] rounded-[16px] border border-dashed bg-[#fafdfc] p-4"
        style={{ borderColor: "#9bdacf" }}
        onDragOver={(e) => {
          if (draggingId) e.preventDefault();
        }}
        onDrop={(e) => {
          e.preventDefault();
          if (draggingId) moveToken(draggingId, "bank");
          setDraggingId(null);
        }}
      >
        <p className="mb-2 text-xs font-medium text-[#0f766e]">
          {allSlotsFilled
            ? "想改的話，可把空格的詞語點走再放新的"
            : "把下面的常用詞放到空格（有些是干擾項，不一定用得上）："}
        </p>
        <div className="flex flex-wrap gap-2">
          {bankTokens.map((t) => (
            <button
              key={t.id}
              draggable={!checked}
              onDragStart={(e) => {
                e.dataTransfer.setData("text/plain", t.id);
                e.dataTransfer.effectAllowed = "move";
                setDraggingId(t.id);
              }}
              onDragEnd={() => setDraggingId(null)}
              onClick={() => onTokenClick(t.id)}
              disabled={checked}
              className={[
                "wyt-pop-in flex cursor-grab flex-col items-center rounded-[12px] border px-3.5 py-2 transition active:cursor-grabbing",
                selected === t.id
                  ? "border-[#0d9488] bg-[#0d9488] text-white shadow-[0_4px_12px_rgba(13,148,136,0.3)]"
                  : "border-[#bdeae3] bg-white text-[#0f766e] hover:-translate-y-0.5 hover:border-[#0d9488]",
              ].join(" ")}
            >
              <span className="font-serif text-[20px] font-semibold leading-tight">
                {t.answer}
              </span>
              <span
                className={[
                  "mt-0.5 text-[11px] leading-tight",
                  selected === t.id ? "text-white/90" : "text-[#475569]",
                ].join(" ")}
              >
                {t.meaning}
              </span>
            </button>
          ))}
          {bankTokens.length === 0 && (
            <span className="py-2 text-sm text-[#9bbdb6]">（空格可點選取回詞語）</span>
          )}
        </div>
      </div>

      {/* Check / feedback */}
      {checked ? (
        <div className="space-y-4 wyt-fade-in-up">
          <div
            className={[
              "rounded-[14px] border p-4 text-sm leading-7",
              correctNow === passage.blanks.length
                ? "border-[#16a34a]/30 bg-[#f0fdf4] text-[#15803d]"
                : "border-[#f59e0b]/30 bg-[#fffbeb] text-[#b45309]",
            ].join(" ")}
          >
            這段答對 {correctNow} / {passage.blanks.length} 個常用詞。
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              {passage.blanks.map((b, i) => (
                <span key={i} className="inline-flex items-center gap-1">
                  <span className="font-serif font-semibold text-[#1a1330]">
                    {b.answer}
                  </span>
                  ：{b.meaning}
                </span>
              ))}
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              onClick={finish}
              className="gap-2 rounded-full text-white shadow-[0_4px_14px_rgba(13,148,136,0.3)] transition hover:-translate-y-0.5"
              style={{ backgroundColor: ACCENT }}
            >
              {index + 1 < total ? "下一段" : "看成績"}
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex justify-end">
          <Button
            onClick={check}
            disabled={!allSlotsFilled}
            className="gap-2 rounded-full text-white shadow-[0_4px_14px_rgba(13,148,136,0.3)] transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:bg-[#a9d6cf] disabled:shadow-none"
            style={{ backgroundColor: allSlotsFilled ? ACCENT : undefined }}
          >
            <CheckCircle2 className="size-4" />
            檢查答案
          </Button>
        </div>
      )}
    </div>
  );
}

/* ----------------------------------------------------------- Blank slot */

function BlankSlot({
  token,
  expected,
  checked,
  isDropHover,
  onClick,
  onDropToken,
}: {
  token: Token | null;
  expected: string;
  checked: boolean;
  isDropHover: boolean;
  onClick: () => void;
  onDropToken: (tokenId: string) => void;
}) {
  const [over, setOver] = useState(false);
  const correct = checked && token?.answer === expected;
  const wrong = checked && (!token || token.answer !== expected);

  let cls = "border-[#9bdacf] bg-[#effbf8] text-[#0f766e]";
  if (checked) {
    cls = correct
      ? "border-[#16a34a] bg-[#f0fdf4] text-[#15803d]"
      : "border-[#dc2626] bg-[#fef2f2] text-[#b91c1c]";
  } else if (over && isDropHover) {
    cls = "border-[#0d9488] bg-[#d8f3ee] text-[#0f766e]";
  }

  return (
    <span
      onClick={onClick}
      onDragOver={(e) => {
        if (!checked) {
          e.preventDefault();
          setOver(true);
        }
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const id = e.dataTransfer.getData("text/plain");
        if (id) onDropToken(id);
      }}
      data-slot
      className={[
        "mx-1 inline-flex min-w-[2.2em] cursor-pointer items-center justify-center rounded-[8px] border-2 border-dashed px-2 py-0.5 align-middle font-serif transition",
        cls,
        !checked ? "hover:border-[#0d9488]" : "",
      ].join(" ")}
    >
      {token ? (
        <span className="not-italic">{token.answer}</span>
      ) : (
        <span className="text-[#9bdacf]">＿</span>
      )}
      {checked &&
        (correct ? (
          <CheckCircle2 className="ml-1 size-4 text-[#16a34a]" />
        ) : (
          <XCircle className="ml-1 size-4 text-[#dc2626]" />
        ))}
    </span>
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
  correct,
  total,
  maxStreak,
  bestScore,
  newBadges,
  onReplay,
}: {
  score: number;
  correct: number;
  total: number;
  maxStreak: number;
  bestScore: number;
  newBadges: string[];
  onReplay: () => void;
}) {
  const displayScore = useCountUp(score);
  const message = useMemo(() => {
    if (score >= 100) return "全部答對！常用詞難不到你！👑";
    if (score >= 80) return "很厲害，幾乎全對！🏅";
    if (score >= 60) return "做得不錯，再接再厲！⭐";
    return "多讀幾次原文，就會記得更牢！🌱";
  }, [score]);

  return (
    <div className="relative space-y-6 text-center">
      <div
        className="mx-auto flex size-16 items-center justify-center rounded-[18px] text-white shadow-[6px_6px_0px_#1a1330] wyt-pop-in"
        style={{ backgroundColor: ACCENT }}
      >
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
        <ResultStat label="放對詞語" value={`${correct}/${total}`} />
        <ResultStat label="最長連對" value={`${maxStreak}`} />
        <ResultStat label="歷來最高" value={`${bestScore}`} />
      </div>

      {newBadges.length > 0 && (
        <div className="wyt-pop-in rounded-[16px] border border-[#bdeae3] bg-[#effbf8] p-5">
          <p className="text-sm font-semibold text-[#0f766e]">🎉 解鎖新獎章！</p>
          <div className="mt-3 flex flex-wrap justify-center gap-3">
            {newBadges.map((id, i) => {
              const b = getBadge(id);
              if (!b) return null;
              return (
                <div
                  key={id}
                  style={{ animationDelay: `${i * 120}ms` }}
                  className="wyt-pop-in flex items-center gap-2 rounded-full border border-[#bdeae3] bg-white px-3 py-1.5 text-sm font-medium text-[#1a1330]"
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
          className="gap-2 rounded-full px-6 text-white shadow-[0_4px_14px_rgba(13,148,136,0.3)] transition hover:-translate-y-0.5"
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
      <p className="text-[11px] uppercase tracking-[1px] text-[#9a8fb5]">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-[#1a1330]">{value}</p>
    </div>
  );
}
