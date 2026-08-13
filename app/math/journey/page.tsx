"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Loader2, Mic, MicOff, Pause, Play, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { basePath, cn } from "@/lib/utils";

type Point = { x: number; y: number };
type Series = { id: string; label: string; color: string; points: Point[] };
type Segment = {
  id: string;
  label: string;
  seriesId: string;
  fromIndex: number;
  toIndex: number;
  expectedDescription: string;
  mustInclude: string[];
};
type Level = {
  id: string;
  number: number;
  title: string;
  subtitle: string;
  chartTitle: string;
  prompt: string;
  xMax: number;
  yMax: number;
  series: Series[];
  segments: Segment[];
};
type CheckState = "idle" | "checking" | "correct" | "incorrect";
type Feedback = { state: CheckState; score?: number; message?: string };
type ExtractedJourney = {
  motion: "away" | "toward" | "stationary" | "unknown";
  startTimeSeconds: number | null;
  endTimeSeconds: number | null;
  durationSeconds: number | null;
  startDistanceMeters: number | null;
  endDistanceMeters: number | null;
  travelledDistanceMeters: number | null;
  speedMetersPerSecond: number | null;
  confidence: number;
};
type SegmentReview = {
  segmentId: string;
  isCorrect: boolean;
  score: number;
  feedback: string;
  correctDescription: string;
  extractedJourney?: ExtractedJourney;
};
type ReviewResult = {
  overallScore: number;
  summary: string;
  segments: SegmentReview[];
};

const LEVELS: Level[] = [
  {
    id: "one-way",
    number: 1,
    title: "單向旅程",
    subtitle: "單一物體遠離原點，且不會返回。",
    chartTitle: "汽車甲的行程",
    prompt: "觀察圖中的三段，描述汽車甲在每一段時間發生了什麼。",
    xMax: 10,
    yMax: 90,
    series: [{ id: "a", label: "汽車甲", color: "#0796bd", points: [{ x: 0, y: 0 }, { x: 2, y: 40 }, { x: 5, y: 40 }, { x: 10, y: 90 }] }],
    segments: [
      { id: "s1", label: "第一段", seriesId: "a", fromIndex: 0, toIndex: 1, expectedDescription: "汽車甲由原點出發，正以穩定速度遠離原點。", mustInclude: ["由原點出發", "遠離原點", "速度穩定"] },
      { id: "s2", label: "第二段", seriesId: "a", fromIndex: 1, toIndex: 2, expectedDescription: "汽車甲停留在同一位置，與原點的距離保持不變。", mustInclude: ["停留", "距離不變"] },
      { id: "s3", label: "第三段", seriesId: "a", fromIndex: 2, toIndex: 3, expectedDescription: "汽車甲再次遠離原點，速度穩定但比第一段慢。", mustInclude: ["再次遠離", "速度穩定", "比第一段慢"] },
    ],
  },
  {
    id: "return-trip",
    number: 2,
    title: "去而復返",
    subtitle: "單一物體先遠離，再回到起點。",
    chartTitle: "單車乙的來回路程",
    prompt: "描述單車乙如何離開原點、停留，再返回原點。",
    xMax: 10,
    yMax: 90,
    series: [{ id: "b", label: "單車乙", color: "#0796bd", points: [{ x: 0, y: 0 }, { x: 3, y: 80 }, { x: 5, y: 80 }, { x: 10, y: 0 }] }],
    segments: [
      { id: "s1", label: "第一段", seriesId: "b", fromIndex: 0, toIndex: 1, expectedDescription: "單車乙由原點出發，正以穩定速度遠離原點。", mustInclude: ["由原點出發", "遠離原點", "速度穩定"] },
      { id: "s2", label: "第二段", seriesId: "b", fromIndex: 1, toIndex: 2, expectedDescription: "單車乙停留在距離原點 80 公尺的位置。", mustInclude: ["停留", "距離原點80公尺"] },
      { id: "s3", label: "第三段", seriesId: "b", fromIndex: 2, toIndex: 3, expectedDescription: "單車乙向原點返回，最後回到原點。", mustInclude: ["返回原點", "距離減少", "最後回到原點"] },
    ],
  },
  {
    id: "parallel",
    number: 3,
    title: "平行路線",
    subtitle: "兩個物體移動，但它們的路徑不相交。",
    chartTitle: "兩車的距離變化",
    prompt: "比較兩條路線，描述它們的移動方向與相對位置。",
    xMax: 10,
    yMax: 90,
    series: [
      { id: "a", label: "汽車甲", color: "#0796bd", points: [{ x: 0, y: 8 }, { x: 5, y: 38 }, { x: 10, y: 50 }] },
      { id: "b", label: "汽車乙", color: "#e9164f", points: [{ x: 0, y: 48 }, { x: 5, y: 64 }, { x: 10, y: 82 }] },
    ],
    segments: [
      { id: "s1", label: "第一段：汽車甲", seriesId: "a", fromIndex: 0, toIndex: 2, expectedDescription: "汽車甲一直遠離原點，整段距離持續增加。", mustInclude: ["汽車甲", "遠離原點", "距離增加"] },
      { id: "s2", label: "第二段：汽車乙", seriesId: "b", fromIndex: 0, toIndex: 2, expectedDescription: "汽車乙也一直遠離原點，並且全程比汽車甲離原點更遠。", mustInclude: ["汽車乙", "遠離原點", "比汽車甲更遠"] },
      { id: "s3", label: "第三段：兩車關係", seriesId: "all", fromIndex: 0, toIndex: 2, expectedDescription: "兩車的路線沒有相交，所以兩車沒有在同一時間距離原點相同。", mustInclude: ["沒有相交", "距離不同"] },
    ],
  },
  {
    id: "crossing",
    number: 4,
    title: "交會路線",
    subtitle: "兩個物體移動，且它們的路徑會交會一次。",
    chartTitle: "兩車的相遇情況",
    prompt: "描述兩車各自的移動，並指出圖線交會代表什麼。",
    xMax: 10,
    yMax: 90,
    series: [
      { id: "a", label: "汽車甲", color: "#0796bd", points: [{ x: 0, y: 15 }, { x: 10, y: 85 }] },
      { id: "b", label: "汽車乙", color: "#e9164f", points: [{ x: 0, y: 85 }, { x: 10, y: 12 }] },
    ],
    segments: [
      { id: "s1", label: "第一段：汽車甲", seriesId: "a", fromIndex: 0, toIndex: 1, expectedDescription: "汽車甲一直遠離原點，距離隨時間增加。", mustInclude: ["汽車甲", "遠離原點", "距離增加"] },
      { id: "s2", label: "第二段：汽車乙", seriesId: "b", fromIndex: 0, toIndex: 1, expectedDescription: "汽車乙一直接近原點，距離隨時間減少。", mustInclude: ["汽車乙", "接近原點", "距離減少"] },
      { id: "s3", label: "第三段：交會點", seriesId: "all", fromIndex: 0, toIndex: 1, expectedDescription: "兩條線相交，表示兩車在同一時間距離原點相同，會相遇或經過同一位置。", mustInclude: ["相交", "同一時間", "距離相同"] },
    ],
  },
];

function generateLevel(templateId: string): Level {
  const template = LEVELS.find((item) => item.id === templateId) ?? LEVELS[0];
  const levelId = `${template.id}-${Date.now()}-${randomInt(1000, 9999)}`;

  if (template.id === "one-way") return generateOneWayLevel(template, levelId);
  if (template.id === "return-trip") return generateReturnTripLevel(template, levelId);
  if (template.id === "parallel") return generateParallelLevel(template, levelId);
  if (template.id === "crossing") return generateCrossingLevel(template, levelId);
  return { ...template, id: levelId };
}

function generateOneWayLevel(template: Level, id: string): Level {
  const t1 = randomInt(2, 3);
  const t2 = randomInt(t1 + 2, t1 + 4);
  const y1 = randomMultiple(30, 50, 5);
  const y2 = randomMultiple(Math.max(y1 + 25, 70), 90, 5);
  const secondSpeed = compareSpeeds((y2 - y1) / (10 - t2), y1 / t1);

  return {
    ...template,
    id,
    series: [{ id: "a", label: "汽車甲", color: "#0796bd", points: [{ x: 0, y: 0 }, { x: t1, y: y1 }, { x: t2, y: y1 }, { x: 10, y: y2 }] }],
    segments: [
      { id: "s1", label: "第一段", seriesId: "a", fromIndex: 0, toIndex: 1, expectedDescription: `汽車甲由原點出發，在 0 至 ${t1} 秒正以穩定速度遠離原點，距離增加至 ${y1} 公尺。`, mustInclude: ["由原點出發", "遠離原點", "速度穩定", `${y1}公尺`] },
      { id: "s2", label: "第二段", seriesId: "a", fromIndex: 1, toIndex: 2, expectedDescription: `汽車甲在 ${t1} 至 ${t2} 秒停留在同一位置，與原點的距離保持 ${y1} 公尺不變。`, mustInclude: ["停留", "距離不變", `${y1}公尺`] },
      { id: "s3", label: "第三段", seriesId: "a", fromIndex: 2, toIndex: 3, expectedDescription: `汽車甲在 ${t2} 至 10 秒再次遠離原點，距離由 ${y1} 公尺增加至 ${y2} 公尺，速度${secondSpeed}。`, mustInclude: ["再次遠離", "距離增加", `${y2}公尺`, `速度${secondSpeed}`] },
    ],
  };
}

function generateReturnTripLevel(template: Level, id: string): Level {
  const t1 = randomInt(2, 3);
  const t2 = randomInt(t1 + 1, t1 + 2);
  const yPeak = randomMultiple(60, 85, 5);

  return {
    ...template,
    id,
    series: [{ id: "b", label: "單車乙", color: "#0796bd", points: [{ x: 0, y: 0 }, { x: t1, y: yPeak }, { x: t2, y: yPeak }, { x: 10, y: 0 }] }],
    segments: [
      { id: "s1", label: "第一段", seriesId: "b", fromIndex: 0, toIndex: 1, expectedDescription: `單車乙由原點出發，在 0 至 ${t1} 秒以穩定速度遠離原點，距離增加至 ${yPeak} 公尺。`, mustInclude: ["由原點出發", "遠離原點", "速度穩定", `${yPeak}公尺`] },
      { id: "s2", label: "第二段", seriesId: "b", fromIndex: 1, toIndex: 2, expectedDescription: `單車乙在 ${t1} 至 ${t2} 秒停留在距離原點 ${yPeak} 公尺的位置。`, mustInclude: ["停留", `距離原點${yPeak}公尺`] },
      { id: "s3", label: "第三段", seriesId: "b", fromIndex: 2, toIndex: 3, expectedDescription: `單車乙在 ${t2} 至 10 秒向原點返回，距離由 ${yPeak} 公尺逐漸減少至 0 公尺，最後回到原點。`, mustInclude: ["返回原點", "距離減少", "最後回到原點"] },
    ],
  };
}

function generateParallelLevel(template: Level, id: string): Level {
  const mid = randomInt(4, 6);
  const aStart = randomMultiple(5, 15, 5);
  const aMid = randomMultiple(30, 45, 5);
  const aEnd = randomMultiple(aMid + 10, 60, 5);
  const gap = randomMultiple(25, 35, 5);
  const bStart = Math.min(aStart + gap, 55);
  const bMid = Math.min(aMid + gap, 75);
  const bEnd = Math.min(aEnd + gap, 90);

  return {
    ...template,
    id,
    series: [
      { id: "a", label: "汽車甲", color: "#0796bd", points: [{ x: 0, y: aStart }, { x: mid, y: aMid }, { x: 10, y: aEnd }] },
      { id: "b", label: "汽車乙", color: "#e9164f", points: [{ x: 0, y: bStart }, { x: mid, y: bMid }, { x: 10, y: bEnd }] },
    ],
    segments: [
      { id: "s1", label: "第一段：汽車甲", seriesId: "a", fromIndex: 0, toIndex: 2, expectedDescription: `汽車甲一直遠離原點，距離由 ${aStart} 公尺增加至 ${aEnd} 公尺。`, mustInclude: ["汽車甲", "遠離原點", "距離增加"] },
      { id: "s2", label: "第二段：汽車乙", seriesId: "b", fromIndex: 0, toIndex: 2, expectedDescription: `汽車乙也一直遠離原點，距離由 ${bStart} 公尺增加至 ${bEnd} 公尺，而且全程比汽車甲離原點更遠。`, mustInclude: ["汽車乙", "遠離原點", "比汽車甲更遠"] },
      { id: "s3", label: "第三段：兩車關係", seriesId: "all", fromIndex: 0, toIndex: 2, expectedDescription: "兩車的路線沒有相交，所以兩車沒有在同一時間距離原點相同。", mustInclude: ["沒有相交", "距離不同"] },
    ],
  };
}

function generateCrossingLevel(template: Level, id: string): Level {
  const aStart = randomMultiple(5, 20, 5);
  const aEnd = randomMultiple(75, 90, 5);
  const bStart = randomMultiple(75, 90, 5);
  const bEnd = randomMultiple(5, 20, 5);
  const crossTime = ((bStart - aStart) * 10) / ((aEnd - aStart) + (bStart - bEnd));

  return {
    ...template,
    id,
    series: [
      { id: "a", label: "汽車甲", color: "#0796bd", points: [{ x: 0, y: aStart }, { x: 10, y: aEnd }] },
      { id: "b", label: "汽車乙", color: "#e9164f", points: [{ x: 0, y: bStart }, { x: 10, y: bEnd }] },
    ],
    segments: [
      { id: "s1", label: "第一段：汽車甲", seriesId: "a", fromIndex: 0, toIndex: 1, expectedDescription: `汽車甲一直遠離原點，距離由 ${aStart} 公尺增加至 ${aEnd} 公尺。`, mustInclude: ["汽車甲", "遠離原點", "距離增加"] },
      { id: "s2", label: "第二段：汽車乙", seriesId: "b", fromIndex: 0, toIndex: 1, expectedDescription: `汽車乙一直接近原點，距離由 ${bStart} 公尺減少至 ${bEnd} 公尺。`, mustInclude: ["汽車乙", "接近原點", "距離減少"] },
      { id: "s3", label: "第三段：交會點", seriesId: "all", fromIndex: 0, toIndex: 1, expectedDescription: `兩條線相交，表示兩車約在 ${formatNumber(crossTime)} 秒時距離原點相同，會相遇或經過同一位置。`, mustInclude: ["相交", "同一時間", "距離相同"] },
    ],
  };
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomMultiple(min: number, max: number, step: number) {
  const low = Math.ceil(min / step);
  const high = Math.floor(max / step);
  return randomInt(low, high) * step;
}

function compareSpeeds(current: number, previous: number) {
  if (Math.abs(current - previous) < 0.8) return "接近第一段";
  return current > previous ? "比第一段快" : "比第一段慢";
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function answerFor(answers: Record<string, string>, level: Level, segment: Segment) {
  return answers[getAnswerKey(level.id, segment.id)] ?? "";
}

function buildStudentLevel(level: Level, answers: Record<string, string>, review: ReviewResult): Level {
  const reviewById = new Map(review.segments.map((item) => [item.segmentId, item]));
  const nextSeries = level.series.map((series) => ({
    ...series,
    color: "#f59e0b",
    points: series.points.map((point) => ({ ...point })),
  }));

  for (const segment of level.segments) {
    if (segment.seriesId === "all") continue;
    const seriesIndex = nextSeries.findIndex((series) => series.id === segment.seriesId);
    if (seriesIndex === -1) continue;

    const series = nextSeries[seriesIndex];
    const original = level.series.find((item) => item.id === segment.seriesId);
    if (!original) continue;

    const originalStart = original.points[segment.fromIndex];
    const end = original.points[segment.toIndex];
    const start = series.points[segment.fromIndex] ?? original.points[segment.fromIndex];
    const reviewItem = reviewById.get(segment.id);
    const answer = answerFor(answers, level, segment);
    const inferredEnd = inferStudentEndPoint(start, end, answer, reviewItem?.score ?? 0, Math.max(end.x - originalStart.x, 1), reviewItem?.extractedJourney);

    series.points[segment.fromIndex] = { ...start };
    series.points[segment.toIndex] = inferredEnd;
  }

  const xMax = Math.max(level.xMax, ...nextSeries.flatMap((series) => series.points.map((point) => point.x)));
  const yMax = Math.max(level.yMax, ...nextSeries.flatMap((series) => series.points.map((point) => point.y)));
  return { ...level, chartTitle: "學生描述生成的線段", xMax, yMax, series: nextSeries };
}

function inferStudentEndPoint(start: Point, end: Point, answer: string, score: number, fallbackDuration: number, extracted?: ExtractedJourney): Point {
  const normalized = answer.replace(/\s/g, "");
  const duration = inferDuration(start, normalized, fallbackDuration, extracted);
  let nextY = start.y + (end.y - start.y) * Math.max(score, 35) / 100;
  const extractedY = inferDistance(start, duration, extracted);
  const absoluteDistance = extractAbsoluteDistance(normalized);
  const travelledDistance = extractTravelledDistance(normalized, duration);

  if (typeof extractedY === "number") {
    nextY = extractedY;
  } else if (typeof absoluteDistance === "number") {
    nextY = absoluteDistance;
  } else if (/停|靜止|不動|距離不變/.test(normalized)) {
    nextY = start.y;
  } else if (typeof travelledDistance === "number") {
    const direction = /回|返|接近|減少|下降/.test(normalized) ? -1 : 1;
    nextY = start.y + direction * travelledDistance;
  } else if (score >= 80) {
    nextY = end.y;
  } else if (/回|返|接近|減少|下降/.test(normalized)) {
    nextY = Math.max(0, start.y - Math.abs(end.y - start.y));
  } else if (/遠離|增加|上升|前進|移動|走|行/.test(normalized)) {
    nextY = Math.min(90, start.y + Math.max(Math.abs(end.y - start.y), duration * 5));
  }

  return {
    x: Math.round((start.x + duration) * 10) / 10,
    y: Math.min(Math.max(Math.round(nextY / 5) * 5, 0), 90),
  };
}

function inferDuration(start: Point, text: string, fallbackDuration: number, extracted?: ExtractedJourney) {
  if (isUsefulNumber(extracted?.durationSeconds)) return extracted.durationSeconds;
  if (isUsefulNumber(extracted?.startTimeSeconds) && isUsefulNumber(extracted?.endTimeSeconds)) {
    return Math.max(0, extracted.endTimeSeconds - extracted.startTimeSeconds);
  }
  if (isUsefulNumber(extracted?.endTimeSeconds)) return Math.max(0, extracted.endTimeSeconds - start.x);
  return extractDuration(text) ?? fallbackDuration;
}

function inferDistance(start: Point, duration: number, extracted?: ExtractedJourney) {
  if (!extracted || extracted.confidence < 0.35) return null;
  if (isUsefulNumber(extracted.endDistanceMeters)) return extracted.endDistanceMeters;
  if (extracted.motion === "stationary") return isUsefulNumber(extracted.startDistanceMeters) ? extracted.startDistanceMeters : start.y;

  let travelledDistance = extracted.travelledDistanceMeters;
  if (!isUsefulNumber(travelledDistance) && isUsefulNumber(extracted.speedMetersPerSecond)) {
    travelledDistance = extracted.speedMetersPerSecond * duration;
  }
  if (!isUsefulNumber(travelledDistance)) return null;

  const direction = extracted.motion === "toward" ? -1 : 1;
  return start.y + direction * travelledDistance;
}

function isUsefulNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function extractDuration(text: string) {
  const rangeMatch = text.match(/(?:由|從)?(\d+(?:\.\d+)?)(?:秒|s)?(?:到|至|->|-)(\d+(?:\.\d+)?)(?:秒|s)/i);
  if (rangeMatch) return Math.max(0, Number(rangeMatch[2]) - Number(rangeMatch[1]));

  const patterns = [
    /(?:用了|用咗|花了|花咗|經過|走了|行了|行駛了|移動了|前進了|駛了|走|行駛|移動|前進|停了|停留了|停止了|靜止了|維持了)(\d+(?:\.\d+)?)(?:秒|s)/i,
    /(\d+(?:\.\d+)?)(?:秒|s)(?:內|間)?(?:以|用|走|行駛|移動|前進|停留|靜止|不動|保持|維持|的速度)/i,
    /(\d+(?:\.\d+)?)(?:秒|s)(?:內|間)?$/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return Number(match[1]);
  }

  return null;
}

function extractAbsoluteDistance(text: string) {
  const patterns = [
    /(?:到|至|達|去到|回到|距離(?:原點)?(?:是|為|變成|保持|停在)?)(\d+(?:\.\d+)?)(?:米|公尺|m)/,
    /(\d+(?:\.\d+)?)(?:米|公尺|m)(?:處|的位置|的地方|不變)/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return Number(match[1]);
  }

  return null;
}

function extractTravelledDistance(text: string, segmentDuration: number) {
  const speedDistance = extractSpeedDistance(text, segmentDuration);
  if (typeof speedDistance === "number") return speedDistance;

  const patterns = [
    /(?:走了|行了|行駛了|移動了|前進了|駛了|走|行駛|移動|前進)(?:\d+(?:\.\d+)?秒)?(\d+(?:\.\d+)?)(?:米|公尺|m)/,
    /(?:走了|行了|行駛了|移動了|前進了|駛了|走|行駛|移動|前進)(\d+(?:\.\d+)?)(?:米|公尺|m)/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return Number(match[1]);
  }

  for (const match of text.matchAll(/(\d+(?:\.\d+)?)(?:米|公尺|m)(?:路程|距離)?/g)) {
    const index = match.index ?? 0;
    const prefix = text.slice(Math.max(0, index - 6), index);
    if (/每秒|每1秒|速度|秒速/.test(prefix)) continue;
    return Number(match[1]);
  }

  return null;
}

function extractSpeedDistance(text: string, segmentDuration: number) {
  const patterns = [
    /每秒(\d+(?:\.\d+)?)(?:米|公尺|m)(?:的)?(?:速度)?(?:走了|行了|行駛了|移動了|前進了|駛了|走|行駛|移動|前進)?(\d+(?:\.\d+)?)秒/,
    /(\d+(?:\.\d+)?)秒(?:內|間)?(?:以)?每秒(\d+(?:\.\d+)?)(?:米|公尺|m)(?:的)?(?:速度)?/,
    /速度(?:是|為|有|達到)?每秒(\d+(?:\.\d+)?)(?:米|公尺|m)(?:.*?(\d+(?:\.\d+)?)秒)?/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const first = Number(match[1]);
    const second = match[2] ? Number(match[2]) : segmentDuration;
    const speed = pattern === patterns[1] ? second : first;
    const duration = pattern === patterns[1] ? first : second;
    return speed * duration;
  }

  return null;
}

export default function JourneyGraphPage() {
  const [level, setLevel] = useState<Level | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [review, setReview] = useState<ReviewResult | null>(null);
  const [isReviewing, setIsReviewing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const voiceAnswerKeyRef = useRef<string | null>(null);
  const voiceBaseTextRef = useRef("");

  const currentSegment = level?.segments[stepIndex] ?? null;
  const currentAnswerKey = level && currentSegment ? getAnswerKey(level.id, currentSegment.id) : null;

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    voiceAnswerKeyRef.current = null;
    setIsListening(false);
  }, []);

  useEffect(() => {
    return () => { recognitionRef.current?.stop(); };
  }, []);

  function toggleVoiceInput() {
    if (!currentAnswerKey) return;
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      alert('您的瀏覽器不支援語音輸入，請使用 Chrome 或 Edge 瀏覽器。');
      return;
    }
    if (isListening) { stopListening(); return; }

    const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) return;

    const recognition = new SpeechRecognitionCtor();
    voiceAnswerKeyRef.current = currentAnswerKey;
    voiceBaseTextRef.current = answers[currentAnswerKey] ?? "";
    recognition.lang = 'zh-HK';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      const answerKey = voiceAnswerKeyRef.current;
      if (!answerKey) return;
      const baseText = voiceBaseTextRef.current.trim();
      const nextText = [baseText, transcript.trim()].filter(Boolean).join(baseText ? " " : "");
      setAnswers((prev) => ({ ...prev, [answerKey]: nextText }));
      setReview(null);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => {
      recognitionRef.current = null;
      voiceAnswerKeyRef.current = null;
      setIsListening(false);
    };
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }

  function selectLevel(nextLevel: Level) {
    stopListening();
    setLevel(generateLevel(nextLevel.id));
    setStepIndex(0);
    setAnswers({});
    setReview(null);
    setIsReviewing(false);
  }

  function updateAnswer(value: string) {
    if (!currentAnswerKey) return;
    setAnswers((prev) => ({ ...prev, [currentAnswerKey]: value }));
    setReview(null);
  }

  function resetLevel() {
    if (!level) return;
    stopListening();
    const segmentIds = new Set(level.segments.map((segment) => getAnswerKey(level.id, segment.id)));
    setAnswers((prev) => Object.fromEntries(Object.entries(prev).filter(([key]) => !segmentIds.has(key))));
    setReview(null);
    setStepIndex(0);
  }

  async function submitReview() {
    if (!level || isReviewing) return;
    stopListening();
    setIsReviewing(true);
    try {
      const res = await fetch(`${basePath}/api/journey-review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          levelTitle: level.title,
          chartTitle: level.chartTitle,
          segments: level.segments.map((segment) => ({
            id: segment.id,
            label: segment.label,
            studentAnswer: answerFor(answers, level, segment),
            expectedDescription: segment.expectedDescription,
            mustInclude: segment.mustInclude,
            originalStart: level.series.find((series) => series.id === segment.seriesId)?.points[segment.fromIndex],
            originalEnd: level.series.find((series) => series.id === segment.seriesId)?.points[segment.toIndex],
          })),
        }),
      });
      const result = (await res.json()) as ReviewResult;
      setReview(result);
    } catch {
      setReview({
        overallScore: 0,
        summary: "暫時未能連接 AI 檢查，請稍後再試。",
        segments: level.segments.map((segment) => ({
          segmentId: segment.id,
          isCorrect: false,
          score: 0,
          feedback: "暫時未能取得這一段的回饋。",
          correctDescription: segment.expectedDescription,
        })),
      });
    } finally {
      setIsReviewing(false);
    }
  }

  if (!level) {
    return (
      <main className="min-h-full overflow-y-auto bg-[#f4f8fc] bg-[radial-gradient(#dce9f4_1px,transparent_1px)] [background-size:22px_22px] px-4 py-7 text-[#102033]">
        <div className="mx-auto max-w-5xl">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold tracking-normal text-[#102033]">行程圖</h1>
            <p className="mt-2 text-sm text-[#58708a]">選擇關卡，觀察距離和時間的關係，再逐段描述行程。</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {LEVELS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => selectLevel(item)}
                className="group rounded-[8px] bg-white p-4 text-left shadow-[0_10px_30px_rgba(27,60,92,0.08)] ring-1 ring-[#e2edf7] transition hover:-translate-y-0.5 hover:ring-[#0796bd]"
              >
                <LevelPreview level={item} />
                <span className="mt-3 inline-flex rounded-[4px] bg-[#e7f7fb] px-2 py-1 text-xs font-semibold text-[#007a9b]">第 {item.number} 關</span>
                <h2 className="mt-2 text-lg font-bold text-[#102033]">{item.title}</h2>
                <p className="mt-1 text-sm leading-6 text-[#58708a]">{item.subtitle}</p>
              </button>
            ))}
          </div>
        </div>
      </main>
    );
  }

  const currentAnswer = currentAnswerKey ? answers[currentAnswerKey] ?? "" : "";
  const answeredCount = level.segments.filter((segment) => answerFor(answers, level, segment).trim()).length;
  const canSubmitReview = answeredCount === level.segments.length && !isReviewing;

  if (review) {
    return <JourneyReviewScreen level={level} answers={answers} review={review} onBack={() => setReview(null)} onChooseLevel={() => setLevel(null)} />;
  }

  return (
    <main className="min-h-full overflow-y-auto bg-[#f4f8fc] bg-[radial-gradient(#dce9f4_1px,transparent_1px)] [background-size:22px_22px] px-4 py-5 text-[#102033]">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <Button variant="ghost" className="rounded-[6px] text-[#31506c]" onClick={() => { stopListening(); setLevel(null); }}>
            <ArrowLeft className="size-4" />
            關卡選擇
          </Button>
          <div className="rounded-[6px] border border-[#d7e5f1] bg-white px-3 py-1.5 text-sm font-semibold text-[#31506c]">
            {answeredCount} / {level.segments.length} 已填寫
          </div>
        </div>

        <header className="mb-4 text-center">
          <p className="text-sm font-semibold text-[#0796bd]">第 {level.number} 關</p>
          <h1 className="text-2xl font-bold tracking-normal text-[#102033]">{level.title}</h1>
          <p className="mt-2 text-sm text-[#58708a]">{level.prompt}</p>
        </header>

        <section className="rounded-[8px] bg-white p-4 shadow-[0_12px_30px_rgba(27,60,92,0.08)] ring-1 ring-[#e2edf7]">
          <JourneyChart level={level} activeSegment={currentSegment} />
        </section>

        {currentSegment && (
          <section className="mt-4 rounded-[8px] bg-white p-4 shadow-[0_12px_30px_rgba(27,60,92,0.08)] ring-1 ring-[#e2edf7]">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="inline-flex size-8 items-center justify-center rounded-[6px] bg-[#e7f7fb] text-sm font-bold text-[#007a9b]">
                  {stepIndex + 1}
                </span>
                <div>
                  <h2 className="text-base font-bold text-[#102033]">{currentSegment.label}</h2>
                  <p className="text-sm text-[#58708a]">描述這一段的移動狀態。</p>
                </div>
              </div>
              <Button variant="outline" className="rounded-[6px]" onClick={resetLevel}>
                <RotateCcw className="size-4" />
                重做
              </Button>
            </div>

            <div className="relative">
              <Textarea
                value={currentAnswer}
                onChange={(event) => updateAnswer(event.target.value)}
                placeholder="例如：這一段正在遠離原點，距離按固定速度增加......"
                className="min-h-24 resize-y rounded-[8px] border-[#bfd3e6] bg-[#fbfdff] px-4 py-3 pb-12 pr-14 text-base shadow-none placeholder:text-[#94a9be] focus-visible:border-[#0796bd] focus-visible:ring-[#0796bd]/20"
              />
              <div className="absolute bottom-3 right-3 flex items-center gap-2">
                {isListening && (
                  <span className="text-xs font-medium text-red-500 animate-pulse">聆聽中…</span>
                )}
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  onClick={toggleVoiceInput}
                  className={cn(
                    "rounded-[6px] border bg-white transition-all hover:bg-white",
                    isListening
                      ? "border-red-400 text-red-500 hover:border-red-500 hover:text-red-600"
                      : "border-[#bfd3e6] text-[#31506c] hover:border-[#0796bd] hover:text-[#0796bd]"
                  )}
                  title={isListening ? "停止語音輸入" : "語音輸入"}
                  aria-label={isListening ? "停止語音輸入" : "語音輸入"}
                >
                  {isListening ? <MicOff className="size-3.5" /> : <Mic className="size-3.5" />}
                </Button>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <Button
                onClick={submitReview}
                disabled={!canSubmitReview}
                className="rounded-[6px] bg-[#0796bd] text-white hover:bg-[#067f9f]"
              >
                {isReviewing ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                AI 檢查
              </Button>
              <p className="text-sm text-[#58708a]">完成全部段落後，按 AI 檢查查看對照與回饋。</p>
            </div>
          </section>
        )}

        <nav className="mt-4 grid grid-cols-3 items-center gap-3">
          <Button
            variant="outline"
            className="justify-self-start rounded-[6px]"
            disabled={stepIndex === 0}
            onClick={() => { stopListening(); setStepIndex((value) => Math.max(value - 1, 0)); }}
          >
            <ChevronLeft className="size-4" />
            上一段
          </Button>
          <div className="text-center text-sm font-semibold text-[#31506c]">{stepIndex + 1} / {level.segments.length}</div>
          <Button
            variant="outline"
            className="justify-self-end rounded-[6px]"
            disabled={stepIndex === level.segments.length - 1}
            onClick={() => { stopListening(); setStepIndex((value) => Math.min(value + 1, level.segments.length - 1)); }}
          >
            下一段
            <ChevronRight className="size-4" />
          </Button>
        </nav>
      </div>
    </main>
  );
}

function getAnswerKey(levelId: string, segmentId: string) {
  return `${levelId}:${segmentId}`;
}

function LevelPreview({ level }: { level: Level }) {
  return <MiniChart level={level} className="h-40 w-full" />;
}

function JourneyReviewScreen({
  level,
  answers,
  review,
  onBack,
  onChooseLevel,
}: {
  level: Level;
  answers: Record<string, string>;
  review: ReviewResult;
  onBack: () => void;
  onChooseLevel: () => void;
}) {
  const studentLevel = buildStudentLevel(level, answers, review);
  const reviewById = new Map(review.segments.map((item) => [item.segmentId, item]));

  return (
    <main className="min-h-full overflow-y-auto bg-[#f4f8fc] bg-[radial-gradient(#dce9f4_1px,transparent_1px)] [background-size:22px_22px] px-4 py-5 text-[#102033]">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <Button variant="ghost" className="rounded-[6px] text-[#31506c]" onClick={onBack}>
            <ArrowLeft className="size-4" />
            返回修改
          </Button>
          <Button variant="outline" className="rounded-[6px]" onClick={onChooseLevel}>
            關卡選擇
          </Button>
        </div>

        <header className="mb-4 text-center">
          <h1 className="text-2xl font-bold tracking-normal text-[#102033]">檢視與回饋</h1>
          <p className="mt-2 text-sm text-[#58708a]">比較你的描述與正確運動情況。</p>
        </header>

        <section className="rounded-[8px] bg-white p-4 shadow-[0_12px_30px_rgba(27,60,92,0.08)] ring-1 ring-[#e2edf7]">
          <ReviewComparisonChart level={level} studentLevel={studentLevel} />
        </section>

        <section className="mt-4 rounded-[8px] border border-[#d7e5f1] bg-[#eef7fb] px-5 py-4 text-center">
          <div className="text-5xl font-black text-[#087f9b]">{Math.round(review.overallScore)}%</div>
          <p className="mx-auto mt-3 max-w-3xl text-sm leading-7 text-[#31506c]">{review.summary}</p>
        </section>

        <section className="mt-4 space-y-3">
          {level.segments.map((segment, index) => {
            const item = reviewById.get(segment.id);
            const score = Math.round(item?.score ?? 0);
            const correct = Boolean(item?.isCorrect);

            return (
              <article
                key={segment.id}
                className={cn(
                  "rounded-[8px] bg-white p-4 shadow-[0_10px_24px_rgba(27,60,92,0.07)] ring-1",
                  correct ? "ring-[#b7e4c7]" : "ring-[#fed7aa]"
                )}
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex size-8 items-center justify-center rounded-[6px] bg-[#e7f7fb] text-sm font-bold text-[#007a9b]">
                      {String.fromCharCode(65 + index)}
                    </span>
                    <div>
                      <h2 className="text-base font-bold text-[#102033]">{segment.label}</h2>
                      <p className="text-xs font-semibold text-[#58708a]">{level.series.find((series) => series.id === segment.seriesId)?.label ?? level.title}</p>
                    </div>
                  </div>
                  <span className={cn("rounded-full px-3 py-1 text-sm font-bold", correct ? "bg-[#e7f8ef] text-[#15803d]" : "bg-[#fff3df] text-[#c26a00]")}>{score}%</span>
                </div>

                <div className="space-y-3 text-sm leading-7 text-[#31506c]">
                  <div>
                    <p className="text-xs font-bold text-[#7c91a8]">你的答案</p>
                    <p className="font-semibold text-[#102033]">{answerFor(answers, level, segment) || "未填寫"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#7c91a8]">回饋</p>
                    <p>{item?.feedback ?? "暫時未能取得回饋。"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#7c91a8]">正確描述</p>
                    <p>{item?.correctDescription ?? segment.expectedDescription}</p>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}

function ReviewComparisonChart({ level, studentLevel }: { level: Level; studentLevel: Level }) {
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const width = 620;
  const height = 260;
  const pad = 44;
  const innerW = width - pad - 20;
  const innerH = height - pad - 20;
  const xMax = Math.max(level.xMax, studentLevel.xMax);
  const yMax = Math.max(level.yMax, studentLevel.yMax);
  const clampedTime = Math.min(currentTime, xMax);
  const xScale = (x: number) => pad + (x / xMax) * innerW;
  const yScale = (y: number) => 12 + innerH - (y / yMax) * innerH;
  const linePath = (points: Point[]) => points.map((point, index) => `${index === 0 ? "M" : "L"} ${xScale(point.x)} ${yScale(point.y)}`).join(" ");
  const originalSamples = level.series.map((series) => ({ series, point: pointAtTime(series.points, clampedTime) }));
  const studentSamples = studentLevel.series.map((series) => ({ series, point: pointAtTime(series.points, clampedTime) }));

  useEffect(() => {
    setCurrentTime(0);
    setIsPlaying(false);
  }, [level.id, studentLevel.id]);

  useEffect(() => {
    if (!isPlaying) return;

    let frame = 0;
    let previousTime = performance.now();
    const tick = (time: number) => {
      const deltaSeconds = ((time - previousTime) / 1000) * speed;
      previousTime = time;
      setCurrentTime((value) => {
        const next = Math.min(value + deltaSeconds, xMax);
        if (next >= xMax) setIsPlaying(false);
        return next;
      });
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [isPlaying, speed, xMax]);

  function replay() {
    setCurrentTime(0);
    setIsPlaying(true);
  }

  return (
    <div className="mx-auto max-w-[760px]">
      <div className="mb-3 text-center">
        <h2 className="text-xl font-bold text-[#102033]">觀看運動</h2>
        <p className="mt-1 text-sm text-[#58708a]">實線代表正確圖線，虛線代表你描述出的圖線。</p>
      </div>
      <div className="mb-3 flex flex-wrap items-center justify-center gap-4 text-sm font-semibold text-[#31506c]">
        <span className="inline-flex items-center gap-2"><span className="h-0.5 w-8 bg-[#0796bd]" />{level.series[0]?.label ?? "正確"}（正確）</span>
        <span className="inline-flex items-center gap-2"><span className="h-0.5 w-8 border-t-2 border-dashed border-[#0796bd]" />{studentLevel.series[0]?.label ?? "你的"}（你的）</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[300px] w-full rounded-[8px] bg-[#f8fbff]" role="img" aria-label="原來線段和學生描述生成的線段對照動畫">
        <rect x="0" y="0" width={width} height={height} rx="8" fill="#f8fbff" />
        {Array.from({ length: 6 }).map((_, index) => {
          const x = pad + (innerW / 5) * index;
          const y = 12 + (innerH / 5) * index;
          return (
            <g key={index}>
              <line x1={x} y1="12" x2={x} y2={12 + innerH} stroke="#e3edf6" strokeWidth="1" />
              <line x1={pad} y1={y} x2={pad + innerW} y2={y} stroke="#e3edf6" strokeWidth="1" />
            </g>
          );
        })}
        <g fill="#7c91a8" fontSize="12" fontWeight="600">
          <line x1={pad} y1="12" x2={pad} y2={12 + innerH} stroke="#60758d" strokeWidth="1.5" />
          <line x1={pad} y1={12 + innerH} x2={pad + innerW} y2={12 + innerH} stroke="#60758d" strokeWidth="1.5" />
          {[0, 1, 2, 3, 4, 5].map((tick) => (
            <g key={tick}>
              <text x={pad + (innerW / 5) * tick} y={height - 12} textAnchor="middle">{formatNumber((xMax / 5) * tick)}</text>
              <text x={pad - 10} y={12 + innerH - (innerH / 5) * tick + 4} textAnchor="end">{formatNumber((yMax / 5) * tick)}</text>
            </g>
          ))}
          <text x={pad + innerW / 2} y={height - 2} textAnchor="middle">時間（秒）</text>
          <text transform={`translate(12 ${12 + innerH / 2}) rotate(-90)`} textAnchor="middle">距離（公尺）</text>
        </g>

        {level.series.map((series) => (
          <path key={`original-${series.id}`} d={linePath(series.points)} fill="none" stroke={series.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        ))}

        {studentLevel.series.map((series) => (
          <path key={`student-${series.id}`} d={linePath(series.points)} fill="none" stroke="#0796bd" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="5 5" />
        ))}

        {level.segments.filter((segment) => segment.seriesId !== "all").map((segment, index) => {
          const series = level.series.find((item) => item.id === segment.seriesId);
          if (!series) return null;
          const start = series.points[segment.fromIndex];
          const end = series.points[segment.toIndex];
          return (
            <text key={segment.id} x={(xScale(start.x) + xScale(end.x)) / 2} y={(yScale(start.y) + yScale(end.y)) / 2 - 8} fill="#0087a8" fontSize="13" fontWeight="800">
              {String.fromCharCode(65 + index)}
            </text>
          );
        })}

        <line x1={xScale(clampedTime)} y1="12" x2={xScale(clampedTime)} y2={12 + innerH} stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="4 4" />

        {originalSamples.map(({ series, point }) => (
          <circle key={`original-dot-${series.id}`} cx={xScale(point.x)} cy={yScale(point.y)} r="5" fill={series.color} stroke="#ffffff" strokeWidth="2" />
        ))}

        {studentSamples.map(({ series, point }) => (
          <circle key={`student-dot-${series.id}`} cx={xScale(point.x)} cy={yScale(point.y)} r="5" fill="#f59e0b" stroke="#ffffff" strokeWidth="2" />
        ))}

        {level.series.flatMap((series) => series.points).map((point, index) => (
          <circle key={`${point.x}-${point.y}-${index}`} cx={xScale(point.x)} cy={yScale(point.y)} r="3.5" fill="#0796bd" />
        ))}
      </svg>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <JourneyReadout title={`${level.series[0]?.label ?? "正確"}（正確）`} samples={originalSamples} />
        <JourneyReadout title={`${studentLevel.series[0]?.label ?? "你的"}（你的）`} samples={studentSamples} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" size="icon" className="rounded-[8px]" onClick={() => setIsPlaying((value) => !value)} aria-label={isPlaying ? "暫停" : "播放"}>
          {isPlaying ? <Pause className="size-4" /> : <Play className="size-4" />}
        </Button>
        <Button type="button" variant="outline" size="icon" className="rounded-[8px]" onClick={replay} aria-label="重新播放">
          <RotateCcw className="size-4" />
        </Button>
        <Button type="button" variant="outline" size="sm" className="rounded-[8px]" onClick={() => setSpeed((value) => (value >= 2 ? 0.5 : value + 0.5))}>
          {speed}x
        </Button>
        <input
          type="range"
          min="0"
          max={xMax}
          step="0.1"
          value={clampedTime}
          onChange={(event) => {
            setCurrentTime(Number(event.target.value));
            setIsPlaying(false);
          }}
          className="h-2 min-w-48 flex-1 accent-[#0796bd]"
          aria-label="動畫時間"
        />
        <span className="w-14 text-right text-sm font-bold tabular-nums text-[#31506c]">{formatNumber(clampedTime)} s</span>
      </div>

      <Button type="button" variant="outline" className="mt-4 w-full rounded-[8px]" onClick={replay}>
        <ArrowLeft className="size-4" />
        重新開始
      </Button>
    </div>
  );
}

function JourneyReadout({ title, samples }: { title: string; samples: Array<{ series: Series; point: Point }> }) {
  return (
    <div className="rounded-[8px] border border-[#e2edf7] bg-white px-3 py-2 text-sm">
      <p className="font-semibold text-[#7c91a8]">{title}</p>
      <p className="mt-1 font-mono text-base font-bold text-[#0087a8]">
        {samples.map(({ point }) => `${formatNumber(point.y)} m`).join(" / ")}
      </p>
    </div>
  );
}

function pointAtTime(points: Point[], time: number) {
  if (points.length === 0) return { x: 0, y: 0 };
  if (time <= points[0].x) return points[0];

  for (let index = 0; index < points.length - 1; index++) {
    const start = points[index];
    const end = points[index + 1];
    if (time <= end.x) {
      if (Math.abs(end.x - start.x) < 0.001) return end;
      const progress = (time - start.x) / (end.x - start.x);
      return { x: time, y: start.y + (end.y - start.y) * progress };
    }
  }

  return points[points.length - 1];
}

function FeedbackBox({ feedback }: { feedback?: Feedback }) {
  if (!feedback || feedback.state === "idle") {
    return <p className="text-sm text-[#58708a]">寫好描述後，按 AI 判斷查看回饋。</p>;
  }
  if (feedback.state === "checking") {
    return <p className="inline-flex items-center gap-2 text-sm font-semibold text-[#58708a]"><Loader2 className="size-4 animate-spin" />AI 正在判斷...</p>;
  }
  const correct = feedback.state === "correct";
  return (
    <div className={cn("flex min-w-0 flex-1 items-start gap-2 rounded-[6px] border px-3 py-2 text-sm", correct ? "border-[#b7e4c7] bg-[#f0fff4] text-[#1b6b3a]" : "border-[#ffd1dc] bg-[#fff5f7] text-[#9f1239]")}>
      {correct ? <Check className="mt-0.5 size-4 shrink-0" /> : <X className="mt-0.5 size-4 shrink-0" />}
      <span>{feedback.message}{typeof feedback.score === "number" ? `（${Math.round(feedback.score)} 分）` : ""}</span>
    </div>
  );
}

function JourneyChart({ level, activeSegment }: { level: Level; activeSegment: Segment | null }) {
  return (
    <div>
      <h2 className="mb-2 text-center text-lg font-bold text-[#102033]">{level.chartTitle}</h2>
      <MiniChart level={level} activeSegment={activeSegment} className="h-[300px] w-full" showAxes />
      <div className="mt-3 flex flex-wrap justify-center gap-3">
        {level.series.map((series) => (
          <div key={series.id} className="flex items-center gap-2 text-sm font-semibold text-[#31506c]">
            <span className="size-3 rounded-full" style={{ backgroundColor: series.color }} />
            {series.label}
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniChart({ level, activeSegment, className, showAxes = false }: { level: Level; activeSegment?: Segment | null; className?: string; showAxes?: boolean }) {
  const width = 620;
  const height = 260;
  const pad = showAxes ? 44 : 20;
  const innerW = width - pad - 20;
  const innerH = height - pad - 20;
  const xScale = (x: number) => pad + (x / level.xMax) * innerW;
  const yScale = (y: number) => 12 + innerH - (y / level.yMax) * innerH;

  function linePath(points: Point[]) {
    return points.map((point, index) => `${index === 0 ? "M" : "L"} ${xScale(point.x)} ${yScale(point.y)}`).join(" ");
  }

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={className} role="img" aria-label={level.chartTitle}>
      <rect x="0" y="0" width={width} height={height} rx="8" fill="#f8fbff" />
      {Array.from({ length: 6 }).map((_, index) => {
        const x = pad + (innerW / 5) * index;
        const y = 12 + (innerH / 5) * index;
        return (
          <g key={index}>
            <line x1={x} y1="12" x2={x} y2={12 + innerH} stroke="#e3edf6" strokeWidth="1" />
            <line x1={pad} y1={y} x2={pad + innerW} y2={y} stroke="#e3edf6" strokeWidth="1" />
          </g>
        );
      })}

      {showAxes && (
        <g fill="#7c91a8" fontSize="12" fontWeight="600">
          <line x1={pad} y1="12" x2={pad} y2={12 + innerH} stroke="#60758d" strokeWidth="1.5" />
          <line x1={pad} y1={12 + innerH} x2={pad + innerW} y2={12 + innerH} stroke="#60758d" strokeWidth="1.5" />
          {[0, 1, 2, 3, 4, 5].map((tick) => (
            <g key={tick}>
              <text x={pad + (innerW / 5) * tick} y={height - 12} textAnchor="middle">{Math.round((level.xMax / 5) * tick)}</text>
              <text x={pad - 10} y={12 + innerH - (innerH / 5) * tick + 4} textAnchor="end">{Math.round((level.yMax / 5) * tick)}</text>
            </g>
          ))}
          <text x={pad + innerW / 2} y={height - 2} textAnchor="middle">時間（秒）</text>
          <text transform={`translate(12 ${12 + innerH / 2}) rotate(-90)`} textAnchor="middle">距離（公尺）</text>
        </g>
      )}

      {level.series.map((series) => (
        <g key={series.id}>
          {series.points.slice(0, -1).map((point, index) => {
            const nextPoint = series.points[index + 1];
            const isActiveSeries = !activeSegment || activeSegment.seriesId === series.id || activeSegment.seriesId === "all";
            const isActiveSegment =
              !activeSegment ||
              (isActiveSeries && index >= activeSegment.fromIndex && index + 1 <= activeSegment.toIndex);

            return (
              <path
                key={`${point.x}-${point.y}-${nextPoint.x}-${nextPoint.y}`}
                d={linePath([point, nextPoint])}
                fill="none"
                stroke={series.color}
                strokeWidth={showAxes ? 3 : 4}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={isActiveSegment ? 1 : 0.2}
              />
            );
          })}
          {series.points.map((point, index) => {
            const isActiveSeries = !activeSegment || activeSegment.seriesId === series.id || activeSegment.seriesId === "all";
            const isActivePoint =
              !activeSegment ||
              (isActiveSeries && index >= activeSegment.fromIndex && index <= activeSegment.toIndex);

            return (
              <g key={`${point.x}-${point.y}`} opacity={isActivePoint ? 1 : 0.28}>
                <circle
                  cx={xScale(point.x)}
                  cy={yScale(point.y)}
                  r={showAxes ? 4 : 0}
                  fill={series.color}
                  opacity={0.85}
                />
                {showAxes && index > 0 && (
                  <CoordinateLabel
                    point={point}
                    x={xScale(point.x)}
                    y={yScale(point.y)}
                    previous={index > 0 ? { x: xScale(series.points[index - 1].x), y: yScale(series.points[index - 1].y) } : null}
                    next={index < series.points.length - 1 ? { x: xScale(series.points[index + 1].x), y: yScale(series.points[index + 1].y) } : null}
                    color={series.color}
                    chartWidth={width}
                    chartHeight={height}
                  />
                )}
              </g>
            );
          })}
        </g>
      ))}
    </svg>
  );
}

function CoordinateLabel({
  point,
  x,
  y,
  previous,
  next,
  color,
  chartWidth,
  chartHeight,
}: {
  point: Point;
  x: number;
  y: number;
  previous: { x: number; y: number } | null;
  next: { x: number; y: number } | null;
  color: string;
  chartWidth: number;
  chartHeight: number;
}) {
  const label = `(${formatNumber(point.x)}, ${formatNumber(point.y)})`;
  const labelWidth = Math.max(48, label.length * 6 + 14);
  const labelHeight = 22;
  const direction = getLabelDirection({ x, y }, previous, next);
  const centerX = x + direction.x * (labelWidth / 2 + 18);
  const centerY = y + direction.y * (labelHeight / 2 + 18);
  const labelX = Math.min(Math.max(centerX - labelWidth / 2, 8), chartWidth - labelWidth - 8);
  const labelY = Math.min(Math.max(centerY - labelHeight / 2, 8), chartHeight - labelHeight - 8);
  const leaderEndX = Math.min(Math.max(labelX + labelWidth / 2, labelX + 8), labelX + labelWidth - 8);
  const leaderEndY = Math.min(Math.max(labelY + labelHeight / 2, labelY + 8), labelY + labelHeight - 8);

  return (
    <g>
      <line
        x1={x}
        y1={y}
        x2={leaderEndX}
        y2={leaderEndY}
        stroke={color}
        strokeOpacity="0.45"
        strokeWidth="1"
        strokeDasharray="3 3"
      />
      <rect
        x={labelX}
        y={labelY}
        width={labelWidth}
        height={labelHeight}
        rx="4"
        fill="#ffffff"
        stroke={color}
        strokeOpacity="0.28"
      />
      <text
        x={labelX + labelWidth / 2}
        y={labelY + 15}
        textAnchor="middle"
        fill="#31506c"
        fontSize="12"
        fontWeight="700"
      >
        {label}
      </text>
    </g>
  );
}

function getLabelDirection(
  current: { x: number; y: number },
  previous: { x: number; y: number } | null,
  next: { x: number; y: number } | null
) {
  const vectors = [previous, next]
    .filter((point): point is { x: number; y: number } => Boolean(point))
    .map((point) => normalize({ x: point.x - current.x, y: point.y - current.y }));

  if (vectors.length === 1) {
    return normalize({ x: -vectors[0].x, y: -vectors[0].y });
  }

  if (vectors.length === 2) {
    const away = normalize({ x: -(vectors[0].x + vectors[1].x), y: -(vectors[0].y + vectors[1].y) });
    if (Math.abs(away.x) + Math.abs(away.y) > 0.2) return away;

    const normal = normalize({ x: -vectors[1].y, y: vectors[1].x });
    return normal.y > 0 ? { x: -normal.x, y: -normal.y } : normal;
  }

  return { x: 1, y: -1 };
}

function normalize(vector: { x: number; y: number }) {
  const length = Math.hypot(vector.x, vector.y);
  if (length < 0.001) return { x: 1, y: -1 };
  return { x: vector.x / length, y: vector.y / length };
}
