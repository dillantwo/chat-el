"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  BookOpen,
  ScrollText,
  ListTree,
  Languages,
  Sparkles,
  Loader2,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  ThumbsUp,
  ChevronRight,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { basePath } from "@/lib/utils";
import {
  WENYAN_TEXTS,
  getWenyanText,
  type WenyanText,
} from "@/lib/wenyan-texts";
import { getProgress, markTextCompleted } from "@/lib/wenyan-progress";

type TaskKey = 1 | 2 | 3 | 4;

interface Feedback {
  rating: "excellent" | "good" | "needs_improvement";
  feedback: string;
  suggestion: string;
}

const TASKS: { key: TaskKey; label: string; sub: string; icon: typeof ScrollText }[] = [
  { key: 1, label: "任務一　閱讀原文", sub: "先讀通原文", icon: ScrollText },
  { key: 2, label: "任務二　句子拆解", sub: "拆解字詞意思", icon: ListTree },
  { key: 3, label: "任務三　翻譯練習", sub: "AI 檢測你的翻譯", icon: Languages },
  { key: 4, label: "任務四　完整翻譯", sub: "對照完整白話翻譯", icon: BookOpen },
];

const RATING_META: Record<
  Feedback["rating"],
  { label: string; cls: string; icon: typeof CheckCircle2 }
> = {
  excellent: {
    label: "很出色",
    cls: "border-[#16a34a]/30 bg-[#f0fdf4] text-[#15803d]",
    icon: CheckCircle2,
  },
  good: {
    label: "做得好",
    cls: "border-[#146ef5]/30 bg-[#eff6ff] text-[#1d4ed8]",
    icon: ThumbsUp,
  },
  needs_improvement: {
    label: "再試試",
    cls: "border-[#f59e0b]/30 bg-[#fffbeb] text-[#b45309]",
    icon: AlertCircle,
  },
};

export default function WenyanLearnPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [task, setTask] = useState<TaskKey>(1);
  const [completedIds, setCompletedIds] = useState<string[]>([]);

  // Task 3 state.
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [feedbacks, setFeedbacks] = useState<Record<string, Feedback>>({});
  const [checking, setChecking] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const selectedText = selectedId ? getWenyanText(selectedId) : undefined;

  useEffect(() => {
    getProgress().then((p) => setCompletedIds(p.completedTexts));
  }, []);

  // Task 4 (完整翻譯) only unlocks once every sentence has been AI-checked.
  const allChecked = !!selectedText &&
    selectedText.sentences.every((s) => !!feedbacks[`${selectedText.id}-${s.id}`]);

  // When the student reaches the final task, the text counts as completed.
  useEffect(() => {
    if (selectedText && task === 4) {
      markTextCompleted(selectedText.id).then((r) =>
        setCompletedIds(r.progress.completedTexts)
      );
    }
  }, [selectedText, task]);

  function selectText(id: string) {
    setSelectedId(id);
    setTask(1);
    setTranslations({});
    setFeedbacks({});
    setErrors({});
    setChecking(null);
  }

  function backToList() {
    setSelectedId(null);
  }

  async function checkTranslation(text: WenyanText, sentenceId: string) {
    const sentence = text.sentences.find((s) => s.id === sentenceId);
    if (!sentence) return;
    const key = `${text.id}-${sentenceId}`;
    const studentTranslation = (translations[key] ?? "").trim();
    if (!studentTranslation) {
      setErrors((prev) => ({ ...prev, [key]: "請先輸入你的翻譯" }));
      return;
    }

    setChecking(key);
    setErrors((prev) => ({ ...prev, [key]: "" }));

    try {
      const res = await fetch(`${basePath}/api/chinese-wenyan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          original: sentence.original,
          reference: sentence.translation,
          studentTranslation,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "檢測失敗，請稍後再試");
      }

      const data = (await res.json()) as Feedback;
      setFeedbacks((prev) => ({ ...prev, [key]: data }));
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        [key]: err instanceof Error ? err.message : "檢測時發生錯誤",
      }));
    } finally {
      setChecking(null);
    }
  }

  return (
    <div className="relative flex flex-1 overflow-hidden bg-white text-[#080808]">
      <div className="relative flex min-w-0 flex-1 flex-col">
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
            <BookOpen className="size-4 text-[#7a3dff]" />
            <span className="text-sm font-semibold text-[#080808]">學習模式</span>
          </div>
          <div className="w-[112px]" />
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto bg-white px-4 py-6 md:px-6">
          <div className="mx-auto w-full max-w-4xl">
            {!selectedText ? (
              <TextPicker onSelect={selectText} completedIds={completedIds} />
            ) : (
              <div className="space-y-5">
                {/* Selected text header */}
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[1.5px] text-[#9a8fb5]">
                      {selectedText.source}
                    </p>
                    <h1 className="font-serif text-[30px] font-semibold tracking-[-0.02em] text-[#1a1330]">
                      {selectedText.title}
                    </h1>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={backToList}
                    className="gap-1.5 rounded-full border-[#e0dbf0] bg-white text-[#5b4f7a] transition hover:border-[#c4b8ec] hover:bg-[#f7f4ff]"
                  >
                    <ChevronLeft className="size-3.5" />
                    選擇其他篇章
                  </Button>
                </div>

                {/* Step indicator */}
                <div className="flex flex-wrap items-center gap-2">
                  {TASKS.map(({ key, label, icon: Icon }, i) => {
                    const active = task === key;
                    const done = task > key;
                    const locked = key === 4 && !allChecked;
                    return (
                      <div key={key} className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            if (locked) return;
                            setTask(key);
                          }}
                          disabled={locked}
                          title={locked ? "完成任務三所有 AI 檢測後解鎖" : undefined}
                          className={[
                            "flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all",
                            active
                              ? "border-[#7a3dff] bg-[#7a3dff] text-white shadow-[0_4px_14px_rgba(122,61,255,0.28)]"
                              : locked
                                ? "cursor-not-allowed border-[#ebe6f7] bg-[#f7f5fc] text-[#c2b9da]"
                                : done
                                  ? "border-[#c4b8ec] bg-[#f3eeff] text-[#5a25d6]"
                                  : "border-[#e0dbf0] bg-white text-[#9a8fb5] hover:border-[#c4b8ec] hover:bg-[#f7f4ff]",
                          ].join(" ")}
                        >
                          {locked ? (
                            <Lock className="size-4" />
                          ) : done ? (
                            <CheckCircle2 className="size-4" />
                          ) : (
                            <Icon className="size-4" />
                          )}
                          {label}
                        </button>
                        {i < TASKS.length - 1 && (
                          <ChevronRight className="size-4 shrink-0 text-[#cbc3e3]" />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Task content */}
                {task === 1 && <Task1 text={selectedText} />}
                {task === 2 && <Task2 text={selectedText} />}
                {task === 3 && (
                  <Task3
                    text={selectedText}
                    translations={translations}
                    setTranslations={setTranslations}
                    feedbacks={feedbacks}
                    checking={checking}
                    errors={errors}
                    onCheck={checkTranslation}
                  />
                )}
                {task === 4 && <Task4 text={selectedText} />}

                {/* Step navigation */}
                <div className="flex items-center justify-between border-t border-[#ece7f8] pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setTask((t) => (t > 1 ? ((t - 1) as TaskKey) : t))}
                    disabled={task === 1}
                    className="gap-1.5 rounded-full border-[#e0dbf0] bg-white text-[#5b4f7a] transition hover:border-[#c4b8ec] hover:bg-[#f7f4ff] disabled:opacity-40"
                  >
                    <ChevronLeft className="size-4" />
                    上一步
                  </Button>
                  {task < 4 ? (
                    <div className="flex flex-col items-end gap-1">
                      <Button
                        onClick={() => setTask((t) => ((t + 1) as TaskKey))}
                        disabled={task === 3 && !allChecked}
                        className="gap-1.5 rounded-full bg-[#7a3dff] text-white shadow-[0_4px_14px_rgba(122,61,255,0.28)] transition hover:-translate-y-0.5 hover:bg-[#5a25d6] disabled:translate-y-0 disabled:bg-[#cbc3e3] disabled:shadow-none"
                      >
                        {task === 3 ? "查看完整翻譯" : "下一個任務"}
                        <ChevronRight className="size-4" />
                      </Button>
                      {task === 3 && !allChecked && (
                        <span className="text-[11px] text-[#9a8fb5]">
                          請先完成所有句子的 AI 檢測
                        </span>
                      )}
                    </div>
                  ) : (
                    <Button
                      onClick={backToList}
                      className="gap-1.5 rounded-full bg-[#16a34a] text-white shadow-[0_4px_14px_rgba(22,163,74,0.25)] transition hover:-translate-y-0.5 hover:bg-[#15803d]"
                    >
                      <CheckCircle2 className="size-4" />
                      完成，學習另一篇
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Picker */

function TextPicker({
  onSelect,
  completedIds,
}: {
  onSelect: (id: string) => void;
  completedIds: string[];
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="font-serif text-[34px] font-semibold tracking-[-0.02em] text-[#1a1330]">
          學習模式
        </h1>
        <p className="mx-auto max-w-xl text-sm leading-7 text-[#6b6385]">
          選擇一篇文言文，跟着四個任務一步步學：先讀通原文，再拆解句子成分，然後試着翻譯並由 AI 檢測，最後對照完整白話翻譯。完成後就會記錄在你的學習進度裏。
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {WENYAN_TEXTS.map((t, i) => {
          const done = completedIds.includes(t.id);
          return (
            <button
              key={t.id}
              onClick={() => onSelect(t.id)}
              className="group relative flex flex-col rounded-[16px] border border-[#e6e1f3] bg-white/90 p-5 text-left shadow-[0_10px_28px_rgba(122,61,255,0.08)] transition duration-200 hover:-translate-y-1 hover:border-[#7a3dff]/50"
            >
              {done && (
                <span className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full border border-[#16a34a]/30 bg-[#f0fdf4] px-2 py-0.5 text-[11px] font-semibold text-[#15803d]">
                  <CheckCircle2 className="size-3.5" />
                  已完成
                </span>
              )}
              <div className="flex items-center justify-between">
                <span className="flex size-10 items-center justify-center rounded-[12px] bg-[#7a3dff] text-base font-semibold text-white shadow-[4px_4px_0px_#1a1330]">
                  {i + 1}
                </span>
                <span className="text-[11px] font-semibold uppercase tracking-[1px] text-[#b3a9cf]">
                  {t.source}
                </span>
              </div>
              <h2 className="mt-5 font-serif text-[26px] font-semibold tracking-[-0.02em] text-[#1a1330]">
                {t.title}
              </h2>
              <p className="mt-2 flex-1 text-sm leading-6 text-[#6b6385]">{t.summary}</p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-[#7a3dff] transition-transform duration-200 group-hover:translate-x-1">
                {done ? "再學一次" : "開始學習"}
                <ArrowRight className="size-4" />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- Task 1 */

function Task1({ text }: { text: WenyanText }) {
  return (
    <div className="space-y-4">
      <div className="rounded-[14px] border border-[#e6e1f3] bg-[#faf8ff] p-4 text-sm leading-7 text-[#5b4f7a]">
        {text.intro}
      </div>

      <div className="rounded-[16px] border border-[#e6e1f3] bg-white/92 p-6 shadow-[0_10px_28px_rgba(122,61,255,0.08)] md:p-9">
        <p className="font-serif text-[22px] leading-[2.4] tracking-[0.04em] text-[#1a1330] md:text-[26px]">
          {text.sentences.map((s) => s.original).join("")}
        </p>
      </div>

      {text.vocab && text.vocab.length > 0 && (
        <div className="rounded-[16px] border border-[#e6e1f3] bg-white/92 p-5 shadow-[0_10px_28px_rgba(122,61,255,0.08)] md:p-6">
          <div className="mb-3 flex items-center gap-2">
            <span className="inline-flex size-7 items-center justify-center rounded-[8px] bg-[#fff3d6] text-[#b45309]">
              <BookOpen className="size-4" />
            </span>
            <h3 className="font-serif text-[18px] font-semibold text-[#1a1330]">常用詞</h3>
          </div>
          <ol className="space-y-2.5">
            {text.vocab.map((v, i) => (
              <li
                key={i}
                className="flex items-start gap-3 rounded-[10px] border border-[#f0edf8] bg-[#fbfaff] px-3 py-2.5"
              >
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-[#7a3dff]/10 text-xs font-semibold text-[#5a25d6]">
                  {i + 1}
                </span>
                <p className="text-sm leading-7 text-[#3f3a52]">
                  <span className="font-serif text-[17px] font-semibold text-[#1a1330]">
                    {v.term}
                  </span>
                  <span className="mx-1.5 text-[#cbc3e3]">：</span>
                  {v.meaning}
                  {(v.jyutping || v.pinyin) && (
                    <span className="ml-1 whitespace-nowrap text-[13px] text-[#9a8fb5]">
                      {v.jyutping && `粵［${v.jyutping}］`}
                      {v.jyutping && v.pinyin && "　"}
                      {v.pinyin && `普［${v.pinyin}］`}
                    </span>
                  )}
                </p>
              </li>
            ))}
          </ol>
        </div>
      )}

      <p className="text-center text-sm text-[#9a8fb5]">
        先細心讀一遍原文，留意上面的常用詞，讀完後按「下一個任務」學習句子拆解。
      </p>
    </div>
  );
}

/* --------------------------------------------------------------- Task 2 */

function Task2({ text }: { text: WenyanText }) {
  return (
    <div className="space-y-4">
      <div className="rounded-[14px] border border-[#e6e1f3] bg-[#faf8ff] p-4 text-sm leading-7 text-[#5b4f7a]">
        把句子拆成一個個字詞，逐一弄清意思，就能讀懂整句文言文。下面每句都拆好了，試着把字詞和解釋對起來讀一遍。
      </div>

      <div className="space-y-4">
        {text.sentences.map((s, idx) => (
          <div
            key={s.id}
            className="rounded-[16px] border border-[#e6e1f3] bg-white/92 p-5 shadow-[0_10px_28px_rgba(122,61,255,0.08)]"
          >
            <div className="flex items-start gap-3">
              <span className="mt-1 flex size-6 shrink-0 items-center justify-center rounded-full bg-[#f0ebff] text-xs font-semibold text-[#7a3dff]">
                {idx + 1}
              </span>
              <p className="font-serif text-[21px] leading-[1.9] tracking-[0.02em] text-[#1a1330]">
                {s.original}
              </p>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {s.segments.map((seg, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 rounded-[10px] border border-[#f0edf8] bg-[#fbfaff] px-3 py-2"
                >
                  <span className="shrink-0 rounded-[8px] bg-[#7a3dff]/10 px-2 py-1 font-serif text-[17px] font-semibold text-[#5a25d6]">
                    {seg.text}
                  </span>
                  <span className="pt-0.5 text-sm leading-6 text-[#555]">{seg.meaning}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- Task 3 */

function Task3({
  text,
  translations,
  setTranslations,
  feedbacks,
  checking,
  errors,
  onCheck,
}: {
  text: WenyanText;
  translations: Record<string, string>;
  setTranslations: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  feedbacks: Record<string, Feedback>;
  checking: string | null;
  errors: Record<string, string>;
  onCheck: (text: WenyanText, sentenceId: string) => void;
}) {
  const checkedCount = text.sentences.filter(
    (s) => !!feedbacks[`${text.id}-${s.id}`]
  ).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-[14px] border border-[#e6e1f3] bg-[#faf8ff] p-4 text-sm leading-7 text-[#5b4f7a]">
        <span>
          試着把每一句文言文翻譯成白話文，按「AI 檢測」就會得到鼓勵和建議。完成全部句子後，便可查看完整翻譯。
        </span>
        <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#7a3dff]">
          已檢測 {checkedCount}/{text.sentences.length}
        </span>
      </div>

      <div className="space-y-4">
        {text.sentences.map((s, idx) => {
          const key = `${text.id}-${s.id}`;
          const value = translations[key] ?? "";
          const fb = feedbacks[key];
          const isChecking = checking === key;
          const err = errors[key];
          const RatingIcon = fb ? RATING_META[fb.rating].icon : CheckCircle2;

          return (
            <div
              key={s.id}
              className="rounded-[16px] border border-[#e6e1f3] bg-white/92 p-5 shadow-[0_10px_28px_rgba(122,61,255,0.08)]"
            >
              <div className="flex items-start gap-3">
                <span className="mt-1 flex size-6 shrink-0 items-center justify-center rounded-full bg-[#f0ebff] text-xs font-semibold text-[#7a3dff]">
                  {idx + 1}
                </span>
                <p className="font-serif text-[21px] leading-[1.9] tracking-[0.02em] text-[#1a1330]">
                  {s.original}
                </p>
              </div>

              <div className="mt-4 pl-9">
                <Textarea
                  value={value}
                  onChange={(e) =>
                    setTranslations((prev) => ({ ...prev, [key]: e.target.value }))
                  }
                  placeholder="在這裏寫上你的白話翻譯…"
                  className="min-h-[80px] resize-y rounded-[12px] border-[#e0dbf0] bg-[#fbfaff] text-[15px] leading-7 text-[#1a1330] shadow-none focus-visible:ring-[#7a3dff]"
                />

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button
                    onClick={() => onCheck(text, s.id)}
                    disabled={isChecking || !value.trim()}
                    className="gap-2 rounded-[10px] bg-[#7a3dff] text-white transition hover:-translate-y-0.5 hover:bg-[#5a25d6] disabled:translate-y-0 disabled:bg-[#cbc3e3]"
                  >
                    {isChecking ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Sparkles className="size-4" />
                    )}
                    {isChecking ? "檢測中…" : fb ? "重新檢測" : "AI 檢測"}
                  </Button>
                </div>

                {err && <p className="mt-2 text-sm text-[#c21830]">{err}</p>}

                {fb && (
                  <div className="mt-3 space-y-2 rounded-[12px] border border-[#ece7f8] bg-[#faf8ff] p-3">
                    <div
                      className={[
                        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
                        RATING_META[fb.rating].cls,
                      ].join(" ")}
                    >
                      <RatingIcon className="size-3.5" />
                      {RATING_META[fb.rating].label}
                    </div>
                    <p className="text-sm leading-7 text-[#3f3a52]">{fb.feedback}</p>
                    <p className="rounded-[8px] bg-white px-3 py-2 text-sm leading-7 text-[#555]">
                      <span className="font-medium text-[#7a3dff]">建議翻譯：</span>
                      {fb.suggestion}
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- Task 4 */

function Task4({ text }: { text: WenyanText }) {
  return (
    <div className="space-y-4">
      <div className="rounded-[14px] border border-[#16a34a]/20 bg-[#f0fdf4] p-4 text-sm leading-7 text-[#15803d]">
        恭喜你完成這篇文章！已記錄到你的學習進度裏。下面是原文和完整的白話翻譯，把它和你自己的翻譯對照一下，看看哪裏可以譯得更好。
      </div>

      <div className="rounded-[16px] border border-[#e6e1f3] bg-white/92 p-6 shadow-[0_10px_28px_rgba(122,61,255,0.08)] md:p-8">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[1px] text-[#9a8fb5]">
          原文
        </p>
        <p className="font-serif text-[21px] leading-[2.2] tracking-[0.03em] text-[#1a1330] md:text-[23px]">
          {text.sentences.map((s) => s.original).join("")}
        </p>

        <div className="mt-6 border-t border-[#f0edf8] pt-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[1px] text-[#9a8fb5]">
            白話翻譯
          </p>
          <p className="text-[16px] leading-8 text-[#3f3a52]">
            {text.sentences.map((s) => s.translation).join("")}
          </p>
        </div>
      </div>
    </div>
  );
}
