"use client";

import { useState } from "react";
import {
  Highlighter,
  Loader2,
  Eraser,
  Sparkles,
  BookOpen,
  ScrollText,
  List,
} from "lucide-react";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { basePath } from "@/lib/utils";

interface Annotation {
  word: string;
  positions: number[];
  partOfSpeech: string;
  meaning: string;
}

const COLORS = [
  { bg: "bg-[#ff6b00]/20", text: "text-[#7a2d00]", ring: "ring-[#ff6b00]/60", activeBg: "bg-[#ff6b00]/12" },
  { bg: "bg-[#00d722]/18", text: "text-[#0b5b1a]", ring: "ring-[#00d722]/55", activeBg: "bg-[#00d722]/10" },
  { bg: "bg-[#7a3dff]/18", text: "text-[#3a1b80]", ring: "ring-[#7a3dff]/55", activeBg: "bg-[#7a3dff]/10" },
  { bg: "bg-[#3b89ff]/22", text: "text-[#0b3c8a]", ring: "ring-[#3b89ff]/60", activeBg: "bg-[#3b89ff]/12" },
  { bg: "bg-[#ed52cb]/20", text: "text-[#7b1c66]", ring: "ring-[#ed52cb]/60", activeBg: "bg-[#ed52cb]/12" },
  { bg: "bg-[#ffae13]/22", text: "text-[#6c4900]", ring: "ring-[#ffae13]/60", activeBg: "bg-[#ffae13]/12" },
  { bg: "bg-[#146ef5]/20", text: "text-[#073888]", ring: "ring-[#146ef5]/60", activeBg: "bg-[#146ef5]/12" },
  { bg: "bg-[#ee1d36]/18", text: "text-[#7d1020]", ring: "ring-[#ee1d36]/55", activeBg: "bg-[#ee1d36]/10" },
];

const SAMPLE_TEXT = `魚，我所欲也；熊掌，亦我所欲也。二者不可得兼，舍魚而取熊掌者也。生，亦我所欲也；義，亦我所欲也。二者不可得兼，舍生而取義者也。`;

export default function ClassicalChinesePage() {
  const [text, setText] = useState("");
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeWord, setActiveWord] = useState<string | null>(null);

  async function handleAnalyze() {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    setAnnotations([]);
    setActiveWord(null);

    try {
      const res = await fetch(`${basePath}/api/classical-chinese`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "分析失敗，請稍後再試");
      }

      const data = await res.json();
      setAnnotations(data.annotations ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "分析時發生錯誤");
    } finally {
      setLoading(false);
    }
  }

  function handleClear() {
    setAnnotations([]);
    setActiveWord(null);
  }

  // Build maps: position → annotation for tooltips, position → word for highlighting
  const posAnnotation = new Map<number, Annotation>();
  const posWord = new Map<number, string>();
  annotations.forEach((ann) => {
    ann.positions.forEach((pos) => {
      if (!posAnnotation.has(pos)) {
        posAnnotation.set(pos, ann);
        posWord.set(pos, ann.word);
      }
    });
  });

  // Group by word for the sidebar
  const wordGroups: { word: string; count: number; colorIdx: number }[] = [];
  const wordGroupMap = new Map<string, number>(); // word → index in wordGroups
  annotations.forEach((ann) => {
    const existing = wordGroupMap.get(ann.word);
    if (existing !== undefined) {
      wordGroups[existing].count += ann.positions.length;
    } else {
      wordGroupMap.set(ann.word, wordGroups.length);
      wordGroups.push({
        word: ann.word,
        count: ann.positions.length,
        colorIdx: wordGroups.length,
      });
    }
  });

  // Build word → color index for consistent coloring
  const wordColorMap = new Map<string, number>();
  wordGroups.forEach((g, i) => wordColorMap.set(g.word, i));

  // Stats
  const totalHighlighted = new Set(annotations.flatMap((a) => a.positions)).size;

  return (
    <>
      <Header backHref="/chinese" backLabel="返回中文科" />

      <main className="relative flex flex-1 flex-col overflow-y-auto bg-[radial-gradient(circle_at_10%_8%,rgba(88,174,255,0.16),transparent_36%),radial-gradient(circle_at_85%_12%,rgba(255,190,120,0.2),transparent_35%),radial-gradient(circle_at_50%_100%,rgba(142,234,198,0.2),transparent_42%),linear-gradient(180deg,#f8fbff_0%,#f5f7fd_100%)] px-4 py-5 md:px-6 md:py-7">
        <div className="relative z-10 mx-auto w-full max-w-5xl space-y-5 md:space-y-6">

          {/* Input area */}
          <Card className="gap-0 overflow-hidden rounded-[16px] border border-[#cfdcf2] bg-white/92 py-0 shadow-[0_14px_34px_rgba(59,94,168,0.14)] backdrop-blur-sm">
            <CardHeader className="border-b border-[#dbe5f5] bg-[linear-gradient(90deg,#e9f2ff_0%,#f4f8ff_50%,#eef9ff_100%)] py-4">
              <CardTitle className="flex items-center gap-2 text-[17px] font-semibold tracking-[0.2px] text-[#1b2a47]">
                <div className="flex size-7 items-center justify-center rounded-[8px] bg-[#3b89ff] text-white">
                  <Highlighter className="size-3.5" />
                </div>
                輸入文言文
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4 pb-4 md:space-y-5 md:pb-5">
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="在此貼上文言文內容…"
                className="min-h-[148px] resize-y rounded-[12px] border-[#cfdbef] bg-[#fbfdff] font-serif text-[20px] leading-[1.6] text-[#132544] shadow-none focus-visible:ring-[#3b89ff]"
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  onClick={handleAnalyze}
                  disabled={!text.trim() || loading}
                  className="gap-2 rounded-[10px] border border-[#2f78e8] bg-[#3b89ff] text-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:bg-[#2d79e7]"
                >
                  {loading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Sparkles className="size-4" />
                  )}
                  {loading ? "分析中…" : "AI 標註虛詞"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setText(SAMPLE_TEXT);
                    setAnnotations([]);
                    setActiveWord(null);
                  }}
                  className="gap-1.5 rounded-[10px] border-[#cfdbef] bg-white text-[#1b2a47] transition duration-200 hover:-translate-y-0.5 hover:border-[#9fb8de] hover:bg-[#f8fbff]"
                >
                  <BookOpen className="size-3.5" />
                  載入範例
                </Button>
                {annotations.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClear}
                    className="gap-1 rounded-[10px] text-[#5d6b84] transition duration-200 hover:bg-[#eef5ff] hover:text-[#2f78e8]"
                  >
                    <Eraser className="size-3.5" />
                    清除標記
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Loading skeleton */}
          {loading && (
            <div className="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-[1fr_300px]">
              <Card className="rounded-[16px] border-[#cfdbef] bg-white/92">
                <CardHeader>
                  <Skeleton className="h-5 w-24" />
                </CardHeader>
                <CardContent className="space-y-3">
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-6 w-4/5" />
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-6 w-3/5" />
                </CardContent>
              </Card>
              <Card className="rounded-[16px] border-[#cfdbef] bg-white/92">
                <CardHeader>
                  <Skeleton className="h-5 w-20" />
                </CardHeader>
                <CardContent className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full rounded-lg" />
                  ))}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Error */}
          {error && (
            <Card className="rounded-[16px] border-[#ee1d36]/30 bg-[#fff5f6]">
              <CardContent className="flex items-center gap-3 pt-4">
                <div className="flex size-8 items-center justify-center rounded-[8px] bg-[#ee1d36]/12">
                  <span className="text-lg text-[#ee1d36]">!</span>
                </div>
                <p className="text-sm text-[#c21830]">{error}</p>
              </CardContent>
            </Card>
          )}

          {/* Result: highlighted text + legend */}
          {annotations.length > 0 && !loading && (
            <>
              <div className="flex items-center gap-3 px-1 md:gap-4">
                <Badge className="gap-1.5 rounded-full border border-[#c8daf6] bg-[#eaf2ff] px-3 py-1 text-[#255cae] hover:bg-[#eaf2ff]">
                  <ScrollText className="size-3" />
                  {wordGroups.length} 個虛詞
                </Badge>
                <Badge className="gap-1.5 rounded-full border border-[#c8daf6] bg-[#eaf2ff] px-3 py-1 text-[#255cae] hover:bg-[#eaf2ff]">
                  <Highlighter className="size-3" />
                  {totalHighlighted} 處標記
                </Badge>
              </div>

              <div className="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-[1fr_300px]">
                {/* Highlighted text */}
                <Card className="gap-0 overflow-hidden rounded-[16px] border border-[#cfdcf2] bg-white/92 py-0 shadow-[0_14px_34px_rgba(59,94,168,0.14)]">
                  <CardHeader className="flex-row items-center justify-between border-b border-[#dbe5f5] bg-[linear-gradient(90deg,#e9f2ff_0%,#f4f8ff_50%,#eef9ff_100%)] py-4">
                    <CardTitle className="flex items-center gap-2 text-[17px] font-semibold tracking-[0.2px] text-[#1b2a47]">
                      <BookOpen className="size-4 text-[#3b89ff]" />
                      標註結果
                    </CardTitle>
                    {activeWord !== null && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setActiveWord(null)}
                        className="h-7 rounded-[10px] text-xs text-[#5d6b84] transition duration-200 hover:bg-[#eef5ff] hover:text-[#2f78e8]"
                      >
                        取消篩選
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent className="pt-6 pb-8">
                    <TooltipProvider>
                      <p className="select-text font-serif text-[22px] leading-[2.4] tracking-[0.02em] text-[#132544] md:text-[24px]">
                        {Array.from(text).map((char, i) => {
                          const ann = posAnnotation.get(i);
                          const word = posWord.get(i);

                          if (ann && word !== undefined) {
                            const colorIdx = wordColorMap.get(word) ?? 0;
                            const color = COLORS[colorIdx % COLORS.length];
                            const isActive =
                              activeWord === null || activeWord === word;
                            return (
                              <Tooltip key={i}>
                                <TooltipTrigger
                                  onClick={() =>
                                    setActiveWord(
                                      activeWord === word ? null : word
                                    )
                                  }
                                  className={[
                                    "inline-block cursor-pointer rounded-[6px] border-b-2 border-current px-0.5 py-0.5 font-semibold transition-all duration-200",
                                    "border-b-2 border-current",
                                    color.bg,
                                    color.text,
                                    isActive
                                      ? "opacity-100 scale-100"
                                      : "opacity-20 scale-95",
                                  ].join(" ")}
                                >
                                  {char}
                                </TooltipTrigger>
                                <TooltipContent
                                  side="top"
                                  className="max-w-xs rounded-[10px] border border-[#cfdbef] bg-white text-[#1b2a47]"
                                >
                                  <div className="space-y-1">
                                    <div className="text-sm font-semibold">
                                      「{ann.word}」{ann.partOfSpeech}
                                    </div>
                                    <Separator className="opacity-30" />
                                    <div className="text-xs leading-relaxed">
                                      {ann.meaning}
                                    </div>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            );
                          }

                          return (
                            <span
                              key={i}
                              className={[
                                "transition-opacity duration-200",
                                activeWord !== null ? "opacity-40" : "",
                              ].join(" ")}
                            >
                              {char}
                            </span>
                          );
                        })}
                      </p>
                    </TooltipProvider>
                  </CardContent>
                </Card>

                {/* Legend sidebar */}
                <Card className="gap-0 overflow-hidden rounded-[16px] border border-[#cfdcf2] bg-white/92 py-0 shadow-[0_14px_34px_rgba(59,94,168,0.14)] lg:self-start">
                  <CardHeader className="border-b border-[#dbe5f5] bg-[linear-gradient(90deg,#e9f2ff_0%,#f4f8ff_50%,#eef9ff_100%)] py-4">
                    <CardTitle className="flex items-center gap-2 text-[17px] font-semibold tracking-[0.2px] text-[#1b2a47]">
                      <List className="size-4 text-[#3b89ff]" />
                      虛詞列表
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-2">
                    <div className="space-y-1 max-h-[60vh] overflow-y-auto pr-1">
                      {/* "Show all" option */}
                      <button
                        onClick={() => setActiveWord(null)}
                        className={[
                          "flex w-full items-center justify-between rounded-[10px] px-3 py-2.5 text-sm transition-all duration-200",
                          activeWord === null
                            ? "border border-[#8fb3ea] bg-[#eaf2ff] font-semibold text-[#2f78e8]"
                            : "text-[#1b2a47] hover:bg-[#f3f8ff]",
                        ].join(" ")}
                      >
                        <span>顯示全部</span>
                        <Badge
                          variant={
                            activeWord === null ? "default" : "secondary"
                          }
                          className="rounded-full text-xs"
                        >
                          {totalHighlighted}
                        </Badge>
                      </button>

                      <Separator className="my-1" />

                      {wordGroups.map((group) => {
                        const color =
                          COLORS[group.colorIdx % COLORS.length];
                        const isSelected = activeWord === group.word;
                        return (
                          <button
                            key={group.word}
                            onClick={() =>
                              setActiveWord(isSelected ? null : group.word)
                            }
                            className={[
                              "w-full rounded-[10px] px-3 py-2.5 text-left transition-all duration-200",
                              isSelected
                                ? `${color.activeBg} ring-2 ${color.ring}`
                                : "hover:bg-[#f3f8ff]",
                            ].join(" ")}
                          >
                            <div className="flex items-center gap-2.5">
                              <span
                                className={[
                                  "inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] border border-[#cfdbef] text-base font-semibold shadow-sm",
                                  color.bg,
                                  color.text,
                                ].join(" ")}
                              >
                                {group.word}
                              </span>
                              <Badge
                                variant="outline"
                                className="rounded-full border-[#cfdbef] text-xs"
                              >
                                ×{group.count}
                              </Badge>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
      </main>
    </>
  );
}
