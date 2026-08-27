"use client";

import { Suspense, useRef, useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import {
  ArrowUp,
  Square,
  Bot,
  User,
  Pencil,
  ArrowLeft,
  ChevronLeft,
  PanelRight,
  Loader2,
  Sparkles,
  MessageSquare,
  Mic,
  MicOff,
  ImagePlus,
  X,
} from "lucide-react";
import { ChatAttachmentPreview } from "@/components/ChatAttachmentPreview";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { ChatAvatar } from "@/components/ChatAvatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useToolbox, type ToolFromDB } from "@/contexts/ToolboxContext";
import { basePath, stripTextModeLatex } from "@/lib/utils";
import { filterUploadsWithinLimit } from "@/lib/upload-limits";
import { useVoiceInput } from "@/lib/use-voice-input";
import { DefaultChatTransport } from "ai";
import { VolumeChatPanel } from "@/components/VolumeChatPanel";
import { ClockChatPanel } from "@/components/ClockChatPanel";
import { createMathChatId, getMathChatHistoryItem, restoreUiMessages, serializeUiMessages, type MathChatHistoryItem, upsertMathChatHistory } from "@/lib/math-chat-history";

interface ToolboxConfigFromDB {
  type: string;
  label: string;
  description: string;
  tools: ToolFromDB[];
  isActive: boolean;
}

// Desired display order for the fraction tool groups (dashboard + sidebar).
// The toolbox data is DB-driven and its stored order can vary, so we normalise
// the order here rather than depending on insertion order.
const FRACTION_TOOL_ORDER: Record<string, string[]> = {
  "fraction-concept": [
    "fraction-converting",
    "fraction-integer",
    "fraction-expanding-simplifying",
    "fraction-comparison",
  ],
  "fraction-operations": [
    "fraction-addition",
    "fraction-subtraction",
    "fraction-multiplication",
    "fraction-division",
  ],
};

function orderToolboxConfigs(configs: ToolboxConfigFromDB[]): ToolboxConfigFromDB[] {
  // 1) Sort tools within known fraction groups (unknown keys keep their order, at the end).
  const result = configs.map((c) => {
    const order = FRACTION_TOOL_ORDER[c.type];
    if (!order) return c;
    const rank = (key: string) => {
      const i = order.indexOf(key);
      return i === -1 ? Number.MAX_SAFE_INTEGER : i;
    };
    const tools = [...c.tools].sort((a, b) => rank(a.key) - rank(b.key));
    return { ...c, tools };
  });

  // 2) Ensure 分數概念 (fraction-concept) appears before 四則運算 (fraction-operations),
  //    without disturbing the position of any other group.
  const conceptIdx = result.findIndex((c) => c.type === "fraction-concept");
  const opsIdx = result.findIndex((c) => c.type === "fraction-operations");
  if (conceptIdx > -1 && opsIdx > -1 && conceptIdx > opsIdx) {
    const [concept] = result.splice(conceptIdx, 1);
    result.splice(opsIdx, 0, concept);
  }

  return result;
}

interface SavedMessagePart {
  type: "text" | "file";
  text?: string;
  url?: string;
  mediaType?: string;
  filename?: string;
}

interface SavedChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  parts: SavedMessagePart[];
}

type ToolChatKey = "volume-cubes" | "clock-24hrs" | "clock-time-difference";

/**
 * Everything needed to pick a dashboard session back up. Leaving for /math
 * unmounts this page *and* the ToolboxProvider above it, so without this the
 * only survivor was the question text — which is what used to make a return
 * visit re-ask the question and file a second history record.
 *
 * Only pointers are kept here: the transcript is fetched back from
 * /api/math-chat-history by `chatId`, so the resumed session keeps writing to
 * the record it started.
 */
const DASHBOARD_SESSION_KEY = "dashboard-data";

interface DashboardSession {
  /** Records written before sessions were resumable carry no version. */
  v?: 2;
  type?: string;
  question?: string;
  imageData?: string;
  /**
   * Separates "this session has no question" (a tool opened straight from the
   * toolbox) from "written by an older build", where the presence of the record
   * itself meant a question.
   */
  hasQuestion?: boolean;
  /**
   * Whether the question was already handed to the model. Without it, an empty
   * transcript is ambiguous: it means either "New Chat was pressed on purpose"
   * or "the reply never arrived", and only the second one deserves a re-ask.
   */
  asked?: boolean;
  chatId?: string;
  selectedTool?: string | null;
  /** Stored only while it matches the open tool, so its params survive the trip. */
  toolUrl?: string | null;
  /** Cached so resuming doesn't pay for the recommendation call a second time. */
  recommendedToolKeys?: string[];
  /** The tool panels (volume/clock) restore their own transcript from these. */
  toolChatSessionIds?: Partial<Record<ToolChatKey, string>>;
}

function readDashboardSession(): DashboardSession | null {
  try {
    const raw = sessionStorage.getItem(DASHBOARD_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DashboardSession | null;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function writeDashboardSession(session: DashboardSession) {
  try {
    sessionStorage.setItem(DASHBOARD_SESSION_KEY, JSON.stringify({ ...session, v: 2 }));
  } catch {
    // A photographed question is base64 in here and can be megabytes. Losing the
    // picture on resume is much better than losing the whole session, so retry
    // without it rather than giving up.
    try {
      sessionStorage.setItem(
        DASHBOARD_SESSION_KEY,
        JSON.stringify({ ...session, imageData: undefined, v: 2 }),
      );
    } catch {}
  }
}

function clearDashboardSession() {
  try {
    sessionStorage.removeItem(DASHBOARD_SESSION_KEY);
  } catch {}
}

export default function MathDashboardPage() {
  return (
    <Suspense>
      <MathDashboardContent />
    </Suspense>
  );
}

function MathDashboardContent() {
  const searchParams = useSearchParams();
  const urlType = searchParams.get("type") || "other";
  const toolbox = useToolbox();

  const [dashboardData, setDashboardData] = useState<{ type: string; question: string; imageData?: string } | null>(null);
  // Mirrors `currentChatId`, which is declared below this transport. Read
  // through a ref because the request builder is captured once, so it has to
  // reach for the current value rather than close over the one from the render
  // that built it.
  const currentChatIdRef = useRef<string | null>(null);

  const type = dashboardData?.type || urlType;
  const question = dashboardData?.question || "";
  const questionImage = dashboardData?.imageData || null;

  const { messages, setMessages, sendMessage, status, stop } = useChat({
    transport: new DefaultChatTransport({
      api: `${basePath}/api/chat`,
      prepareSendMessagesRequest: ({ id, messages, body, trigger, messageId }) => ({
        body: {
          ...body,
          id,
          messages,
          trigger,
          messageId,
          hasQuestion: hasUserQuestionRef.current,
          // The id this transcript is saved under, so a token-usage record
          // tagged with it can be resolved back to the conversation.
          chatId: currentChatIdRef.current,
        },
      }),
    }),
    onError: (error) => {
      console.error("[chat] Error:", error);
    },
  });

  const [input, setInput] = useState("");
  const [chatVisible, setChatVisible] = useState(true);
  const [toolboxConfig, setToolboxConfig] = useState<ToolboxConfigFromDB | null>(null);
  const [allToolboxConfigs, setAllToolboxConfigs] = useState<ToolboxConfigFromDB[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isExtractingParams, setIsExtractingParams] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const handleChatScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }, []);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hasSentInitial = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [chatFiles, setChatFiles] = useState<File[]>([]);

  // Question-input (placeholder area) state — used when no question is set yet
  const [questionInput, setQuestionInput] = useState("");
  const [questionFiles, setQuestionFiles] = useState<FileList | null>(null);
  const [isClassifying, setIsClassifying] = useState(false);
  const [questionPreviewSrc, setQuestionPreviewSrc] = useState<string | null>(null);
  const [isEditingQuestion, setIsEditingQuestion] = useState(false);
  const [hasUserQuestion, setHasUserQuestion] = useState(false);
  const hasUserQuestionRef = useRef(false);
  const [currentChatId, setCurrentChatId] = useState(() => createMathChatId());
  const [toolPreviewRefreshKey, setToolPreviewRefreshKey] = useState(0);
  const suppressHistoryAnalysisRef = useRef(false);
  // Loading a saved chat must not re-save it (which would bump updatedAt and
  // reorder the history list). Cleared once a genuine new exchange starts.
  const skipSaveRef = useRef(false);
  const restoredToolUrlRef = useRef<string | null>(null);
  /** True while the previous session's transcript is on its way back. */
  const [isResumingSession, setIsResumingSession] = useState(false);
  /**
   * Snapshots are held back until the resume attempt settles, otherwise the
   * empty initial state would overwrite the session we are about to restore.
   */
  const canPersistRef = useRef(false);
  /** Tool recommendations carried over from the resumed session. */
  const restoredRecommendationsRef = useRef<{ question: string; keys: string[] } | null>(null);
  const [toolChatSessionIds, setToolChatSessionIds] = useState<Record<"volume-cubes" | "clock-24hrs" | "clock-time-difference", string>>({
    "volume-cubes": createMathChatId(),
    "clock-24hrs": createMathChatId(),
    "clock-time-difference": createMathChatId(),
  });
  const questionTextareaRef = useRef<HTMLTextAreaElement>(null);
  const questionFileInputRef = useRef<HTMLInputElement>(null);

  const isLoading = status === "submitted" || status === "streaming";
  // Sending while the previous transcript is still loading would get clobbered
  // by the restore, so the composer waits it out.
  const canSend = (!!input.trim() || chatFiles.length > 0) && !isLoading && !isResumingSession;

  const selectedTool = toolbox?.selectedTool ?? null;
  const hideChatForTool = selectedTool === "journey-graph";
  const tools = toolboxConfig?.tools ?? [];
  const typeLabel = toolboxConfig?.label ?? type;

  // Both mics are declared up here because the reset/load handlers below have to
  // stop dictation before they clear the boxes.
  const {
    isListening,
    error: voiceError,
    stop: stopListening,
    toggle: toggleVoice,
    rebase: rebaseDictation,
  } = useVoiceInput({
    lang: "zh-HK",
    // Chinese doesn't separate words with spaces.
    separator: "",
    getBaseText: () => input,
    onTranscript: setInput,
  });

  // Typing while the mic is live: hand the edit to the recogniser as the new
  // baseline, otherwise the next result would revert it.
  const handleInputChange = useCallback(
    (value: string) => {
      setInput(value);
      if (isListening) rebaseDictation(value);
    },
    [isListening, rebaseDictation]
  );

  const {
    isListening: isQuestionListening,
    error: questionVoiceError,
    stop: stopQuestionListening,
    toggle: toggleQuestionVoice,
    rebase: rebaseQuestionDictation,
  } = useVoiceInput({
    lang: "zh-HK",
    separator: "",
    getBaseText: () => questionInput,
    onTranscript: setQuestionInput,
  });

  const handleQuestionInputChange = useCallback(
    (value: string) => {
      setQuestionInput(value);
      if (isQuestionListening) rebaseQuestionDictation(value);
    },
    [isQuestionListening, rebaseQuestionDictation]
  );

  function isPreviewUrlForSelectedTool(url: string | null, toolKey: string | null) {
    if (!url || !toolKey) return false;

    const expectedPathByTool: Record<string, string> = {
      "clock-24hrs": "/math/clock-24hrs",
      "clock-time-difference": "/math/clock-time-difference",
      "volume-cubes": "/math/volume",
      "journey-graph": "/math/journey",
      "fraction-addition": "/math/fraction-addition",
      "fraction-subtraction": "/math/fraction-subtraction",
      "fraction-multiplication": "/math/fraction-multiplication",
      "fraction-division": "/math/fraction-division",
      "fraction-comparison": "/math/fraction-comparison",
      "fraction-expanding-simplifying": "/math/fraction-es",
      "fraction-integer": "/math/fraction-integer",
      "fraction-converting": "/math/fraction-converting",
    };

    const expectedPath = expectedPathByTool[toolKey] ?? "/math/preview.html";
    return url.includes(expectedPath);
  }

  const handleNewChat = useCallback(() => {
    if (
      selectedTool === "volume-cubes" ||
      selectedTool === "clock-24hrs" ||
      selectedTool === "clock-time-difference"
    ) {
      setToolChatSessionIds((prev) => ({
        ...prev,
        [selectedTool]: createMathChatId(),
      }));
      setChatVisible(true);
      return;
    }

    const currentStatus = statusRef.current;
    if (currentStatus === "streaming" || currentStatus === "submitted") {
      stopRef.current?.();
    }

    setCurrentChatId(createMathChatId());
    setMessagesRef.current?.([]);
    // The input is about to be cleared, so a live mic would write the old text
    // back on its next result.
    stopListening();
    setInput("");
    setChatFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setChatVisible(true);
  }, [selectedTool, stopListening]);

  useEffect(() => {
    currentChatIdRef.current = currentChatId;
  }, [currentChatId]);

  useEffect(() => {
    hasUserQuestionRef.current = hasUserQuestion;
  }, [hasUserQuestion]);

  // Fetch toolbox config from DB
  useEffect(() => {
    fetch(`${basePath}/api/toolbox`)
      .then((res) => res.json())
      .then((rawConfigs: ToolboxConfigFromDB[]) => {
        const configs = orderToolboxConfigs(rawConfigs);
        setAllToolboxConfigs(configs);
        const matched = configs.find((c) => c.type === type);
        if (matched) {
          setToolboxConfig(matched);
        } else {
          // No specific match (e.g. user hasn't entered a question yet) — fall back
          // to the first math toolbox so the sidebar still shows all tool groups.
          const firstMath = configs.find(
            (c) =>
              c.type !== "english" &&
              c.type !== "chinese" &&
              c.type !== "classical-chinese"
          );
          if (firstMath) setToolboxConfig(firstMath);
        }
      })
      .catch(() => {});
  }, [type]);

  // Fetch AI-recommended tools
  const [recommendedToolKeys, setRecommendedToolKeys] = useState<string[]>([]);
  const [isAnalyzingTools, setIsAnalyzingTools] = useState(false);
  useEffect(() => {
    if (suppressHistoryAnalysisRef.current) {
      setRecommendedToolKeys([]);
      setIsAnalyzingTools(false);
      return;
    }

    // Resumed session: the ranking for this exact question already came back
    // once, so reuse it instead of paying for the call again. The ref is kept
    // (not consumed) because this effect also re-runs while the toolbox config
    // loads; it is dropped as soon as the question changes.
    const restoredRecommendations = restoredRecommendationsRef.current;
    if (restoredRecommendations && restoredRecommendations.question === question) {
      setRecommendedToolKeys(restoredRecommendations.keys);
      setIsAnalyzingTools(false);
      return;
    }

    // Recommend across every visible math tool (all groups), not just the
    // matched group. After the fraction group was split into 四則運算 / 分數概念,
    // scoping recommendations to a single 4-tool subgroup often returned nothing
    // and left the sidebar stuck on "正在分析題目...".
    const mathConfigs = allToolboxConfigs.filter(
      (c) => c.type !== "english" && c.type !== "chinese" && c.type !== "classical-chinese"
    );
    const candidateTools = mathConfigs.flatMap((c) => c.tools);

    if (!question || candidateTools.length === 0) {
      setRecommendedToolKeys([]);
      setIsAnalyzingTools(false);
      return;
    }

    let cancelled = false;
    setIsAnalyzingTools(true);
    fetch(`${basePath}/api/recommend-tools`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question,
        tools: candidateTools.map((t) => ({ key: t.key, label: t.label, sub: t.sub })),
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setRecommendedToolKeys(data.recommendedKeys ?? []);
      })
      .catch(() => {
        if (!cancelled) setRecommendedToolKeys([]);
      })
      .finally(() => {
        if (!cancelled) setIsAnalyzingTools(false);
      });

    return () => {
      cancelled = true;
    };
  }, [question, toolboxConfig, allToolboxConfigs]);

  // Register tools into sidebar context
  const register = toolbox?.register;
  useEffect(() => {
    if (register && toolboxConfig) {
      const mathConfigs = allToolboxConfigs.filter(
        (c) => c.type !== "english" && c.type !== "chinese" && c.type !== "classical-chinese"
      );
      register({
        tools: toolboxConfig.tools,
        allToolGroups: mathConfigs.map((c) => ({ label: c.label, tools: c.tools })),
        typeLabel: toolboxConfig.label,
        question,
        questionImage,
        recommendedToolKeys,
        isAnalyzingTools,
      });
    }
  }, [register, toolboxConfig, allToolboxConfigs, question, questionImage, recommendedToolKeys, isAnalyzingTools]);

  // React to tool selection from sidebar
  useEffect(() => {
    if (!selectedTool) {
      setIsExtractingParams(false);
      setPreviewUrl(null);
      return;
    }

    if (restoredToolUrlRef.current) {
      const restoredToolUrl = restoredToolUrlRef.current;
      restoredToolUrlRef.current = null;
      suppressHistoryAnalysisRef.current = false;
      setIsExtractingParams(false);
      setPreviewUrl(restoredToolUrl);
      return;
    }

    // 直接連結到 Next.js route 的工具（同樣不需要 AI 提取參數）
    const staticRouteMap: Record<string, string> = {
      "clock-24hrs": "/math/clock-24hrs",
      "clock-time-difference": "/math/clock-time-difference",
      "volume-cubes": "/math/volume",
      "journey-graph": "/math/journey",
    };
    const staticRoute = staticRouteMap[selectedTool];
    if (staticRoute) {
      setIsExtractingParams(false);
      setPreviewUrl(`${basePath}${staticRoute}`);
      return;
    }

    // 「兩數運算」版面的工具頁（加/減/乘/除）都會讀取 URL 參數
    // （num1/den1/num2/den2/whole1/whole2/context），需要先經 AI 提取參數再帶參數開啟。
    // 新增同版面的工具時，請一併在該頁加上 applyIncomingParams() 再列到這裏。
    const fractionOpRouteMap: Record<string, string> = {
      "fraction-addition": "fraction-addition",
      "fraction-subtraction": "fraction-subtraction",
      "fraction-multiplication": "fraction-multiplication",
      "fraction-division": "fraction-division",
    };
    const fractionOpRoute = fractionOpRouteMap[selectedTool];

    // 直接帶參數的獨立工具頁（非「兩數運算」的版面）的 HTML 版本。
    // 分數概念工具皆已改寫為 Next.js route（見下方 standaloneRouteMap），故此表留空；
    // 保留變數與後備邏輯以相容其他潛在的 HTML 版工具。
    const standaloneHtmlMap: Record<string, string> = {};
    const standaloneHtml = standaloneHtmlMap[selectedTool];

    // 已改寫為 Next.js route 的獨立工具頁（TypeScript 重寫版）
    const standaloneRouteMap: Record<string, string> = {
      "fraction-expanding-simplifying": "fraction-es",
      "fraction-comparison": "fraction-comparison",
      "fraction-integer": "fraction-integer",
      "fraction-converting": "fraction-converting",
    };
    const standaloneRoute = standaloneRouteMap[selectedTool];

    const buildFallbackUrl = () =>
      standaloneRoute
        ? `${basePath}/math/${standaloneRoute}`
        : standaloneHtml
          ? `${basePath}/math/${standaloneHtml}`
          : fractionOpRoute
            ? `${basePath}/math/${fractionOpRoute}`
            : `${basePath}/math/preview.html`;

    if (suppressHistoryAnalysisRef.current) {
      setIsExtractingParams(false);
      setPreviewUrl(buildFallbackUrl());
      return;
    }

    if (!question) {
      setIsExtractingParams(false);
      setPreviewUrl(buildFallbackUrl());
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 12000);
    setPreviewUrl(null);
    setIsExtractingParams(true);

    (async () => {
      try {
        const res = await fetch(`${basePath}/api/extract-params`, {
          method: "POST",
          signal: controller.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question,
            toolKey: selectedTool,
            // 只有在沒有文字題目時才傳圖片，避免 payload 過大
            ...(!question && questionImage ? { imageData: questionImage } : {}),
          }),
        });
        if (!res.ok) throw new Error("Extract failed");
        if (cancelled) return;
        const params = await res.json();

        if (selectedTool === "fraction-expanding-simplifying") {
          const qs = new URLSearchParams({
            numerator: String(params.numerator ?? 2),
            denominator: String(params.denominator ?? 8),
            mode: params.mode ?? "expand",
          });
          // 傳遞目標分數（null/-1 表示空格，不傳該參數讓 fraction-es 顯示 □）
          if (params.targetNumerator != null && params.targetNumerator !== -1) {
            qs.set("targetNum", String(params.targetNumerator));
          }
          if (params.targetDenominator != null && params.targetDenominator !== -1) {
            qs.set("targetDen", String(params.targetDenominator));
          }
          if (!cancelled) setPreviewUrl(`${basePath}/math/fraction-es?${qs.toString()}`);
        } else if (selectedTool === "fraction-comparison") {
          const qs = new URLSearchParams();
          const count = params.count === 3 ? 3 : 2;
          qs.set("count", String(count));

          const fractions: Array<{ whole?: number | null; num?: number | null; den?: number | null; format?: string | null }> =
            Array.isArray(params.fractions) ? params.fractions : [];

          for (let i = 0; i < count; i++) {
            const f = fractions[i] ?? {};
            const idx = i + 1;
            // 分子默認 1（0 顯示醜），分母為 0 用 1 避免除零
            qs.set(`num${idx}`, String(f.num && f.num !== 0 ? f.num : 1));
            qs.set(`den${idx}`, String(f.den && f.den !== 0 ? f.den : 1));
            if (f.whole != null) qs.set(`whole${idx}`, String(f.whole));
            if (f.format) qs.set(`format${idx}`, String(f.format));
          }
          if (!cancelled) setPreviewUrl(`${basePath}/math/fraction-comparison?${qs.toString()}`);
        } else if (selectedTool === "fraction-integer") {
          const qs = new URLSearchParams();
          // num 預設 12（可整齊排成長方形，示範效果佳），限制 1–999
          const n = Number(params.num);
          qs.set("num", String(Number.isFinite(n) && n >= 1 ? Math.min(Math.floor(n), 999) : 12));
          // extractor 回傳 explore/all，工具用 mode=1/2
          if (params.mode === "all") qs.set("mode", "2");
          if (!cancelled) setPreviewUrl(`${basePath}/math/fraction-integer?${qs.toString()}`);
        } else if (selectedTool === "fraction-converting") {
          const qs = new URLSearchParams();
          if (params.whole != null) qs.set("whole", String(params.whole));
          if (params.num != null) qs.set("num", String(params.num));
          // 分母預設 1，避免除零
          qs.set("den", String(params.den && params.den !== 0 ? params.den : 1));
          if (params.mode) qs.set("mode", String(params.mode));
          if (!cancelled) setPreviewUrl(`${basePath}/math/fraction-converting?${qs.toString()}`);
        } else if (fractionOpRoute) {
          const qs = new URLSearchParams();
          // 分子默認 1（AI 回傳 0 通常代表純整數題目，0/1 顯示醜，改用 1）
          qs.set("num1", String(params.num1 && params.num1 !== 0 ? params.num1 : 1));
          // 分母為 0 通常代表題目缺少對應分數，使用默認 1 避免除零
          qs.set("den1", String(params.den1 && params.den1 !== 0 ? params.den1 : 1));
          qs.set("num2", String(params.num2 && params.num2 !== 0 ? params.num2 : 1));
          qs.set("den2", String(params.den2 && params.den2 !== 0 ? params.den2 : 1));
          if (params.whole1 != null) qs.set("whole1", String(params.whole1));
          if (params.whole2 != null) qs.set("whole2", String(params.whole2));
          if (params.questionTemplate) qs.set("context", params.questionTemplate);
          if (!cancelled) setPreviewUrl(`${basePath}/math/${fractionOpRoute}?${qs.toString()}`);
        } else {
          const qs = new URLSearchParams({
            whole1: String(params.whole1 ?? 0),
            num1: String(params.num1 ?? 1),
            den1: String(params.den1 ?? 1),
            whole2: String(params.whole2 ?? 0),
            num2: String(params.num2 ?? 1),
            den2: String(params.den2 ?? 1),
            operation: params.operation ?? selectedTool.split("-")[1] ?? "div",
            context: params.contextText ?? "",
            unit: params.unit ?? "",
          });
          if (!cancelled) setPreviewUrl(`${basePath}/math/preview.html?${qs.toString()}`);
        }
      } catch {
        if (!cancelled) setPreviewUrl(buildFallbackUrl());
      } finally {
        window.clearTimeout(timeoutId);
        if (!cancelled) setIsExtractingParams(false);
      }
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [selectedTool, question, questionImage, toolPreviewRefreshKey]);

  // Resume the session that was open before the user navigated away. Runs once,
  // before anything can auto-send: the transcript comes back from the database
  // by chat id, so returning to the page continues that conversation instead of
  // asking the model the same question again under a new history record.
  useEffect(() => {
    const stored = readDashboardSession();
    if (!stored) {
      canPersistRef.current = true;
      return;
    }

    const hasQuestion = stored.hasQuestion ?? Boolean(stored.question);
    const storedQuestion = stored.question ?? "";

    // Put back everything that needs no round trip, so the page doesn't flash
    // the empty "輸入題目" state on the way in.
    if (hasQuestion && storedQuestion) {
      setDashboardData({
        type: stored.type || "fraction-operations",
        question: storedQuestion,
        imageData: stored.imageData,
      });
      setHasUserQuestion(true);
      setIsEditingQuestion(false);
    }
    if (stored.chatId) setCurrentChatId(stored.chatId);
    if (stored.toolChatSessionIds) {
      setToolChatSessionIds((prev) => ({ ...prev, ...stored.toolChatSessionIds }));
    }
    if (stored.recommendedToolKeys?.length) {
      restoredRecommendationsRef.current = {
        question: storedQuestion,
        keys: stored.recommendedToolKeys,
      };
      setRecommendedToolKeys(stored.recommendedToolKeys);
    }
    if (stored.selectedTool) {
      // The tool effect consumes this instead of running the parameter
      // extraction again, which would be a second needless model call.
      restoredToolUrlRef.current = stored.toolUrl ?? null;
      toolbox?.setSelectedTool(stored.selectedTool);
    }

    // Hold the auto-send effect below while the transcript is in flight.
    hasSentInitial.current = true;
    setIsResumingSession(true);

    let cancelled = false;
    void (async () => {
      try {
        const savedChat = stored.chatId ? await getMathChatHistoryItem(stored.chatId) : null;
        if (cancelled) return;
        const savedMessages = savedChat?.messages ?? [];

        // An assistant turn is the proof the exchange really happened, so that
        // transcript is what comes back.
        if (savedMessages.some((message) => message.role === "assistant")) {
          skipSaveRef.current = true; // resuming is not a new exchange
          restoreMessages(savedMessages);
        } else {
          // Otherwise the question is only re-asked when it was never asked, or
          // when the record shows a user turn that never got answered (the reply
          // was cut off by the navigation). An empty transcript on a question
          // that was already asked means 「New Chat」 was pressed on purpose —
          // asking again there would undo the teacher's own reset. Either way it
          // stays under the resumed chat id, so it updates that record instead
          // of filing another one.
          const alreadyAsked = stored.asked ?? true;
          const cutOffMidReply = savedMessages.some((message) => message.role === "user");
          if (hasQuestion && (!alreadyAsked || cutOffMidReply)) {
            hasSentInitial.current = false;
          }
        }
      } finally {
        if (!cancelled) {
          setIsResumingSession(false);
          canPersistRef.current = true;
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // Mount only: this is the session hand-off, not a reaction to state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-send the initial question to get AI response
  useEffect(() => {
    // Never while resuming: the answer to this question is already on its way
    // back from the history record.
    if (isResumingSession) return;
    if ((question || questionImage) && !hasSentInitial.current) {
      hasSentInitial.current = true;
      const files = questionImage
        ? [{ type: "file" as const, mediaType: "image/png", url: questionImage }]
        : undefined;
      sendMessage({ text: question || "（見圖片）", ...(files ? { files } : {}) });
    }
  }, [question, questionImage, sendMessage, isResumingSession]);

  // Snapshot the resumable half of the session on every change. This is the
  // write side of the restore effect above; it replaces the scattered
  // sessionStorage writes that used to persist the question alone.
  useEffect(() => {
    if (!canPersistRef.current) return;

    const hasSomethingToResume = hasUserQuestion || messages.length > 0 || !!selectedTool;

    if (!hasSomethingToResume) {
      clearDashboardSession();
      return;
    }

    writeDashboardSession({
      type,
      question: hasUserQuestion ? question : undefined,
      imageData: hasUserQuestion ? questionImage ?? undefined : undefined,
      hasQuestion: hasUserQuestion,
      // Read from the ref rather than mirrored into state on purpose: every
      // place that flips it also changes state, so this effect always re-runs
      // right after and records the settled value.
      asked: hasSentInitial.current,
      chatId: currentChatId,
      selectedTool,
      toolUrl: isPreviewUrlForSelectedTool(previewUrl, selectedTool) ? previewUrl : null,
      recommendedToolKeys,
      toolChatSessionIds,
    });
  }, [
    currentChatId,
    hasUserQuestion,
    isResumingSession,
    messages.length,
    previewUrl,
    question,
    questionImage,
    recommendedToolKeys,
    selectedTool,
    toolChatSessionIds,
    type,
  ]);

  useEffect(() => {
    const container = chatScrollRef.current;
    if (!container) return;
    // Follow the latest message only while the user is pinned to the bottom.
    // Scroll the container itself (never the page) so the layout doesn't shift.
    if (isAtBottomRef.current) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (hideChatForTool) stopListening();
  }, [hideChatForTool, stopListening]);

  // Listen for sidebar entry actions.
  // Use refs so the deps array stays stable across renders (useChat's
  // setMessages/stop/status references can change between renders).
  const setMessagesRef = useRef(setMessages);
  const stopRef = useRef(stop);
  const statusRef = useRef(status);
  const toolboxRef = useRef(toolbox);
  useEffect(() => { setMessagesRef.current = setMessages; }, [setMessages]);
  useEffect(() => { stopRef.current = stop; }, [stop]);
  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => { toolboxRef.current = toolbox; }, [toolbox]);

  // Allow saving again once a genuine new exchange starts (a new send sets the
  // status to submitted/streaming; loading a chat never does).
  useEffect(() => {
    if (status === "submitted" || status === "streaming") {
      skipSaveRef.current = false;
    }
  }, [status]);

  // Broadcast the active math chat id so the sidebar can highlight the open item.
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("math-chat:active", { detail: { id: currentChatId } })
    );
  }, [currentChatId]);

  function restoreMessages(savedMessages: SavedChatMessage[]) {
    setMessages(restoreUiMessages(savedMessages));
  }

  useEffect(() => {
    function resetDashboard() {
      suppressHistoryAnalysisRef.current = false;
      // Both boxes are about to be cleared, so any dictation in flight has to
      // stop: otherwise the next speech result would restore the old text along
      // with the new words.
      stopListening();
      stopQuestionListening();
      restoredRecommendationsRef.current = null;
      clearDashboardSession();
      setDashboardData(null);
      setHasUserQuestion(false);
      setCurrentChatId(createMathChatId());
      setPreviewUrl(null);
      hasSentInitial.current = false;
      setQuestionInput("");
      setQuestionFiles(null);
      if (questionFileInputRef.current) questionFileInputRef.current.value = "";
      setIsEditingQuestion(true);
      if (toolboxRef.current?.selectedTool === "volume-cubes" || toolboxRef.current?.selectedTool === "clock-24hrs" || toolboxRef.current?.selectedTool === "clock-time-difference") {
        const specialTool = toolboxRef.current.selectedTool;
        setToolChatSessionIds((prev) => ({ ...prev, [specialTool]: createMathChatId() }));
      } else {
        toolboxRef.current?.setSelectedTool(null);
      }
      // Reset the AI chat — start a fresh session
      const s = statusRef.current;
      if (s === "streaming" || s === "submitted") stopRef.current?.();
      setMessagesRef.current?.([]);
      setInput("");
      setChatFiles([]);
    }
    function handleNewQuestion() {
      resetDashboard();
    }
    function handleLoadMathChat(event: Event) {
      const customEvent = event as CustomEvent<{ item: MathChatHistoryItem }>;
      const detail = customEvent.detail?.item;
      if (!detail) return;

      const s = statusRef.current;
      if (s === "streaming" || s === "submitted") stopRef.current?.();

      // Don't let this load trigger a re-save (which would reorder the list).
      skipSaveRef.current = true;

      setChatVisible(true);
      setIsExtractingParams(false);
      // Same as resetDashboard: clearing the boxes must not leave a mic running
      // against the text we just wiped.
      stopListening();
      stopQuestionListening();
      setInput("");
      setChatFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setQuestionInput("");
      setQuestionFiles(null);
      if (questionFileInputRef.current) questionFileInputRef.current.value = "";

      if (detail.kind === "general") {
        const nextType = detail.type ?? "fraction-operations";
        const nextQuestion = detail.question ?? detail.title;
        const shouldRestoreQuestion = Boolean(detail.hasUserQuestion && detail.question);
        restoredToolUrlRef.current = shouldRestoreQuestion ? detail.toolUrl ?? null : null;
        suppressHistoryAnalysisRef.current = !shouldRestoreQuestion || Boolean(detail.toolUrl);
        restoredRecommendationsRef.current = null;
        setCurrentChatId(detail.id);
        setDashboardData(shouldRestoreQuestion ? { type: nextType, question: nextQuestion } : null);
        setHasUserQuestion(shouldRestoreQuestion);
        setPreviewUrl(null);
        setToolPreviewRefreshKey((key) => key + 1);
        hasSentInitial.current = true;
        setIsEditingQuestion(false);
        toolboxRef.current?.setSelectedTool(detail.selectedTool ?? null);
        restoreMessages(detail.messages ?? []);
        return;
      }

      const shouldRestoreQuestion = Boolean(detail.hasUserQuestion && detail.question);
      restoredToolUrlRef.current = shouldRestoreQuestion ? detail.toolUrl ?? null : null;
      suppressHistoryAnalysisRef.current = !shouldRestoreQuestion || Boolean(detail.toolUrl);
      restoredRecommendationsRef.current = null;
      setDashboardData(shouldRestoreQuestion ? { type: detail.type ?? "fraction-operations", question: detail.question! } : null);
      setHasUserQuestion(shouldRestoreQuestion);
      setPreviewUrl(null);
      setToolPreviewRefreshKey((key) => key + 1);
      hasSentInitial.current = true;
      setIsEditingQuestion(false);
      setMessagesRef.current?.([]);
      toolboxRef.current?.setSelectedTool(detail.kind);
      setToolChatSessionIds((prev) => ({ ...prev, [detail.kind]: detail.id }));
      // Tool chats don't change currentChatId, so highlight this item directly.
      window.dispatchEvent(
        new CustomEvent("math-chat:active", { detail: { id: detail.id } })
      );
    }
    function handleNewChatEvent() {
      handleNewChat();
    }
    window.addEventListener("dashboard:new-chat", handleNewChatEvent);
    window.addEventListener("dashboard:new-question", handleNewQuestion);
    window.addEventListener("dashboard:load-math-chat", handleLoadMathChat);
    return () => {
      window.removeEventListener("dashboard:new-chat", handleNewChatEvent);
      window.removeEventListener("dashboard:new-question", handleNewQuestion);
      window.removeEventListener("dashboard:load-math-chat", handleLoadMathChat);
    };
  }, [handleNewChat, stopListening, stopQuestionListening]);

  useEffect(() => {
    if (selectedTool === "volume-cubes" || selectedTool === "clock-24hrs" || selectedTool === "clock-time-difference") {
      return;
    }

    if (skipSaveRef.current) {
      return;
    }

    if (!question && messages.length === 0) {
      return;
    }

    const firstUserText = messages
      .filter((message) => message.role === "user")
      .flatMap((message) => message.parts)
      .find((part) => part.type === "text" && part.text.trim().length > 0);

    if (status === "streaming" || status === "submitted") {
      return;
    }

    const canSaveToolUrl = isPreviewUrlForSelectedTool(previewUrl, selectedTool);

    if (hasUserQuestion && selectedTool && !canSaveToolUrl) {
      return;
    }

    void upsertMathChatHistory({
      id: currentChatId,
      kind: "general",
      title: question || (firstUserText?.type === "text" ? firstUserText.text.slice(0, 40) : "數學對話"),
      hasUserQuestion,
      question: hasUserQuestion ? question : undefined,
      type: hasUserQuestion ? type : undefined,
      selectedTool,
      toolUrl: hasUserQuestion && canSaveToolUrl ? previewUrl ?? undefined : undefined,
      messages: serializeUiMessages(messages),
      updatedAt: new Date().toISOString(),
    });
  }, [currentChatId, hasUserQuestion, messages, previewUrl, question, selectedTool, status, type]);

  function fileToDataURL(file: File): Promise<string> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
  }

  async function doSend() {
    if (!canSend) return;
    if (isListening) stopListening();
    const fileParts = await Promise.all(
      chatFiles.map(async (file) => ({
        type: "file" as const,
        mediaType: file.type,
        filename: file.name,
        url: await fileToDataURL(file),
      }))
    );
    const prompt = input.trim() || "（見圖片）";

    sendMessage({ text: prompt, ...(fileParts.length > 0 ? { files: fileParts } : {}) });

    setInput("");
    setChatFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleChatFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      const picked = Array.from(e.target.files);
      setChatFiles((prev) => [...prev, ...filterUploadsWithinLimit(prev, picked)]);
    }
    // Reset so re-choosing the same photo still fires `change`; `chatFiles`
    // owns the selection from here on.
    e.target.value = "";
  }

  function removeChatFile(index: number) {
    setChatFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const items = e.clipboardData?.items;
    if (!items) return;
    const imageFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) {
        const file = items[i].getAsFile();
        if (file) imageFiles.push(file);
      }
    }
    if (imageFiles.length === 0) return;
    e.preventDefault();
    setChatFiles((prev) => [...prev, ...filterUploadsWithinLimit(prev, imageFiles)]);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    doSend();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      doSend();
    }
  }

  // ===== Question-input handlers (placeholder area) =====
  const canSubmitQuestion = !!(questionInput.trim() || questionFiles) && !isClassifying;

  function questionFileToBase64(file: File): Promise<string> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
  }

  function handleQuestionFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      // Rebuilt through DataTransfer because state holds a FileList, the same
      // trick removeQuestionFile() uses.
      const accepted = filterUploadsWithinLimit([], Array.from(e.target.files));
      if (accepted.length === 0) {
        setQuestionFiles(null);
        e.target.value = "";
        return;
      }
      const dt = new DataTransfer();
      accepted.forEach((f) => dt.items.add(f));
      setQuestionFiles(dt.files);
    }
    // Reset so re-choosing the same photo still fires `change`; `questionFiles`
    // holds its own DataTransfer copy, so nothing depends on the input's value.
    e.target.value = "";
  }

  function removeQuestionFile(index: number) {
    if (!questionFiles) return;
    const dt = new DataTransfer();
    Array.from(questionFiles).forEach((f, i) => {
      if (i !== index) dt.items.add(f);
    });
    if (dt.files.length === 0) {
      setQuestionFiles(null);
      if (questionFileInputRef.current) questionFileInputRef.current.value = "";
    } else {
      setQuestionFiles(dt.files);
    }
  }

  function handleQuestionPaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const items = e.clipboardData?.items;
    if (!items) return;
    const imageFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) {
        const file = items[i].getAsFile();
        if (file) imageFiles.push(file);
      }
    }
    if (imageFiles.length === 0) return;
    e.preventDefault();
    const dt = new DataTransfer();
    if (questionFiles) Array.from(questionFiles).forEach((f) => dt.items.add(f));
    imageFiles.forEach((f) => dt.items.add(f));
    setQuestionFiles(dt.files);
  }

  async function submitQuestion() {
    if (!canSubmitQuestion) return;
    suppressHistoryAnalysisRef.current = false;
    stopQuestionListening();

    setIsClassifying(true);

    try {
      let imageData: string | undefined;
      if (questionFiles && questionFiles.length > 0) {
        imageData = await questionFileToBase64(questionFiles[0]);
      }

      const res = await fetch(`${basePath}/api/classify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: questionInput.trim(),
          imageData,
        }),
      });

      let nextType = "fraction-operations";
      let nextQuestion = questionInput.trim() || "（見圖片）";
      if (res.ok) {
        const json = await res.json();
        nextType = json.type ?? nextType;
        nextQuestion = json.question || nextQuestion;
      }

      // Allow the chat auto-send effect to fire with the new question.
      // Persisting the question (and the chat id that answers it) is left to the
      // snapshot effect, so the two can never disagree.
      restoredRecommendationsRef.current = null;
      hasSentInitial.current = false;
      setHasUserQuestion(true);
      setDashboardData({ type: nextType, question: nextQuestion, imageData });
      setQuestionInput("");
      setQuestionFiles(null);
      if (questionFileInputRef.current) questionFileInputRef.current.value = "";
      setIsEditingQuestion(false);
    } catch {
      const fallbackQuestion = questionInput.trim() || "（見圖片）";
      restoredRecommendationsRef.current = null;
      hasSentInitial.current = false;
      setHasUserQuestion(true);
      setDashboardData({ type: "fraction-operations", question: fallbackQuestion });
      setQuestionInput("");
      setQuestionFiles(null);
      setIsEditingQuestion(false);
    } finally {
      setIsClassifying(false);
    }
  }

  function handleQuestionSubmit(e: React.FormEvent) {
    e.preventDefault();
    submitQuestion();
  }

  function handleQuestionKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submitQuestion();
    }
  }

  return (
    <div className="relative flex flex-1 overflow-hidden bg-white text-[#080808]">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(160deg,_#ffffff_0%,_#f7fbff_45%,_#ffffff_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[radial-gradient(circle_at_top,_rgba(20,110,245,0.14),_transparent_48%)]" />

      {/* Left panel: HTML Preview or placeholder */}
      <div className="relative flex min-w-0 flex-1 flex-col border-r border-[#d8d8d8]">
        {/* Page top bar (sibling of chat panel header so they sit at the same top edge) */}
        <div className="flex h-[57px] shrink-0 items-center justify-between border-b border-[#d8d8d8] bg-white/95 px-4">
          <div className="flex items-center gap-1">
            <SidebarTrigger />
            <Link
              href="/math"
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <ChevronLeft className="size-4" />
              數學科
            </Link>
          </div>
          {!chatVisible && !hideChatForTool && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setChatVisible(true)}
              className="rounded-[4px] border border-[#d8d8d8] bg-white/90 shadow-sm backdrop-blur"
              title="顯示 AI 助手"
            >
              <PanelRight className="size-4" />
            </Button>
          )}
        </div>
        {selectedTool ? (
          <>

            {/* Original question bar */}
            {question && (
              <div className="border-b border-[#d8d8d8] bg-[#f7fbff]/80 px-4 py-3">
                <div className="prose prose-base mx-auto max-w-3xl text-center text-base font-medium leading-relaxed text-[#080808] prose-neutral [&_p]:my-0 [&_.katex]:text-lg">
                  <ReactMarkdown
                    remarkPlugins={[remarkMath]}
                    rehypePlugins={[[rehypeKatex, { strict: false }]]}
                  >
                    {question}
                  </ReactMarkdown>
                </div>
              </div>
            )}

            {/* HTML Preview */}
            <div className="flex-1 overflow-auto bg-transparent p-4">
              <div
                className="mx-auto h-full w-full rounded-[8px] border border-[#d8d8d8] bg-white shadow-[rgba(0,0,0,0)_0px_84px_24px,rgba(0,0,0,0.01)_0px_54px_22px,rgba(0,0,0,0.04)_0px_30px_18px,rgba(0,0,0,0.08)_0px_13px_13px,rgba(0,0,0,0.09)_0px_3px_7px] transition-all"
              >
                {isExtractingParams || !previewUrl ? (
                  <div className="flex h-full flex-col items-center justify-center gap-3 text-[#5a5a5a]">
                    <Loader2 className="size-8 animate-spin text-[#146ef5]" />
                    <span className="text-sm font-medium">正在根據題目生成練習...</span>
                  </div>
                ) : (
                  <iframe
                    src={previewUrl}
                    className="h-full w-full rounded-[8px]"
                    title="HTML Preview"
                  />
                )}
              </div>
            </div>
          </>
        ) : (
          /* Placeholder when no tool selected */
          <div className="flex-1 overflow-y-auto p-6">
            {/* Question display */}
            {(question || questionImage) && (
              <div className="mb-6 rounded-[8px] border border-[#d8d8d8] bg-white p-5 shadow-[rgba(0,0,0,0)_0px_84px_24px,rgba(0,0,0,0.01)_0px_54px_22px,rgba(0,0,0,0.04)_0px_30px_18px,rgba(0,0,0,0.08)_0px_13px_13px,rgba(0,0,0,0.09)_0px_3px_7px]">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-[1px] text-[#ababab]">
                      Problem detected
                    </p>
                    <Badge variant="outline" className="rounded-[4px] border-[#d8d8d8] bg-[#146ef5]/10 text-xs font-semibold uppercase tracking-[0.8px] text-[#146ef5]">
                      {typeLabel}
                    </Badge>
                    {questionImage && (
                      <img
                        src={questionImage}
                        alt="題目圖片"
                        className="mt-3 max-h-32 rounded-[8px] border border-[#d8d8d8] object-contain"
                      />
                    )}
                    <div className="prose prose-lg mt-3 max-w-none text-lg font-medium leading-relaxed prose-neutral [&_.katex]:text-2xl">
                      <ReactMarkdown
                        remarkPlugins={[remarkMath]}
                        rehypePlugins={[[rehypeKatex, { strict: false }]]}
                      >
                        {question}
                      </ReactMarkdown>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingQuestion(true);
                      setQuestionInput(question);
                      setTimeout(() => questionTextareaRef.current?.focus(), 0);
                    }}
                    title="修改題目"
                    className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-[4px] border border-transparent text-[#ababab] transition-colors hover:border-[#d8d8d8] hover:bg-[#f7f7f7] hover:text-[#080808]"
                  >
                    <Pencil className="size-4" />
                  </button>
                </div>
                <div className="mt-4 flex items-center gap-2 rounded-[6px] border border-[#146ef5]/20 bg-[#146ef5]/5 px-3 py-2 text-sm text-[#146ef5]">
                  <ArrowLeft className="size-4 shrink-0" />
                  <span>請從左側工具箱選擇合適的工具開始練習</span>
                </div>
              </div>
            )}

            <div className={`flex flex-col items-center justify-center rounded-[8px] border border-dashed border-[#d8d8d8] bg-white/70 py-10 px-4 text-center ${(question || questionImage) && !isEditingQuestion ? "hidden" : ""}`}>
              {!(question || questionImage) && (
                <>
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-[8px] bg-[#146ef5]/10 text-[#146ef5]">
                    <Sparkles className="size-7" />
                  </div>
                  <p className="text-lg font-semibold text-[#080808]">
                    輸入題目讓 AI 為您解答，或直接從左側工具箱選擇工具開始練習
                  </p>
                  <p className="mt-1.5 mb-7 text-sm text-[#5a5a5a]">
                    部分工具可直接使用，無需輸入題目
                  </p>
                </>
              )}
              {(question || questionImage) && isEditingQuestion && (
                <div className="mb-4 flex items-center justify-between w-full max-w-3xl">
                  <p className="text-sm text-[#5a5a5a]">輸入新題目可重新分類</p>
                  <button
                    type="button"
                    onClick={() => {
                      stopQuestionListening();
                      setIsEditingQuestion(false);
                      setQuestionInput("");
                      setQuestionFiles(null);
                    }}
                    className="text-xs text-[#5a5a5a] underline-offset-2 hover:text-[#080808] hover:underline"
                  >
                    取消
                  </button>
                </div>
              )}

              {/* Question input form */}
              <form onSubmit={handleQuestionSubmit} className="w-full max-w-3xl">
                <div className="relative w-full rounded-[8px] border border-[#d8d8d8] bg-white shadow-[0px_30px_18px_rgba(0,0,0,0.04),0px_13px_13px_rgba(0,0,0,0.08),0px_3px_7px_rgba(0,0,0,0.09)] transition-all focus-within:border-[#146ef5] focus-within:shadow-[0px_30px_18px_rgba(20,110,245,0.09),0px_13px_13px_rgba(20,110,245,0.14),0px_3px_7px_rgba(20,110,245,0.2)]">
                  <ChatAttachmentPreview
                    files={questionFiles ? Array.from(questionFiles) : []}
                    onRemove={removeQuestionFile}
                    onPreview={(url) => setQuestionPreviewSrc(url)}
                    variant="square"
                    thumbnailSize="lg"
                    className="px-4 pt-3"
                  />

                  <Textarea
                    ref={questionTextareaRef}
                    placeholder="輸入數學題目，例如：3/4 + 1/2 = ?（可直接粘貼圖片）"
                    value={questionInput}
                    onChange={(e) => handleQuestionInputChange(e.target.value)}
                    onKeyDown={handleQuestionKeyDown}
                    onPaste={handleQuestionPaste}
                    disabled={isClassifying}
                    className="min-h-[140px] resize-none border-0 bg-transparent px-6 pt-5 pb-16 text-xl font-medium leading-[1.6] tracking-[-0.01em] text-left text-[#080808] shadow-none placeholder:text-[#ababab] focus-visible:ring-0"
                  />

                  <input
                    ref={questionFileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleQuestionFileChange}
                    className="hidden"
                  />

                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => questionFileInputRef.current?.click()}
                        disabled={isClassifying}
                        className="rounded-[4px] border border-[#d8d8d8] bg-white text-[#080808] transition-all hover:translate-x-[2px] hover:border-[#898989] hover:bg-white hover:text-[#080808]"
                      >
                        <ImagePlus className="size-4 text-[#5a5a5a]" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={toggleQuestionVoice}
                        disabled={isClassifying}
                        className={`rounded-[4px] border bg-white transition-all hover:translate-x-[2px] hover:bg-white ${
                          isQuestionListening
                            ? 'border-red-400 text-red-500 hover:border-red-500 hover:text-red-600'
                            : 'border-[#d8d8d8] text-[#080808] hover:border-[#898989] hover:text-[#080808]'
                        }`}
                        title={isQuestionListening ? '停止語音輸入' : '語音輸入'}
                        aria-label={isQuestionListening ? '停止語音輸入' : '語音輸入'}
                      >
                        {isQuestionListening ? (
                          <MicOff className="size-4" />
                        ) : (
                          <Mic className="size-4 text-[#5a5a5a]" />
                        )}
                      </Button>
                      {isQuestionListening && (
                        <span aria-live="polite" className="text-[12px] font-medium text-red-500 animate-pulse">
                          聆聽中…
                        </span>
                      )}
                      {!isQuestionListening && questionVoiceError && (
                        <span role="alert" className="text-[12px] font-medium text-red-500">
                          {questionVoiceError.message}
                        </span>
                      )}
                    </div>

                    <Button
                      type="submit"
                      size="icon"
                      className="rounded-[4px] border border-transparent bg-[#146ef5] text-white shadow-[0_8px_20px_rgba(20,110,245,0.34)] transition-all hover:translate-x-[6px] hover:bg-[#0055d4] hover:shadow-[0_10px_24px_rgba(20,110,245,0.44)]"
                      disabled={!canSubmitQuestion}
                    >
                      {isClassifying ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <ArrowUp className="size-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </form>
            </div>

            {/* Question preview lightbox */}
            {questionPreviewSrc && (
              <div
                className="fixed inset-0 z-50 flex cursor-zoom-out items-center justify-center bg-black/70"
                onClick={() => setQuestionPreviewSrc(null)}
              >
                <button
                  className="absolute top-4 right-4 flex size-8 items-center justify-center rounded-full bg-white text-[#080808] transition-colors hover:bg-white/85"
                  onClick={() => setQuestionPreviewSrc(null)}
                >
                  <X className="size-5" />
                </button>
                <img
                  src={questionPreviewSrc}
                  alt="Preview"
                  className="max-h-[90vh] max-w-[90vw] rounded-[8px] object-contain"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right panel: AI Chat (narrower) */}
      {chatVisible && !hideChatForTool && (selectedTool === "volume-cubes" ? (
        <VolumeChatPanel key={toolChatSessionIds["volume-cubes"]} chatId={toolChatSessionIds["volume-cubes"]} hasUserQuestion={hasUserQuestion} question={question || undefined} type={type} toolUrl={previewUrl ?? undefined} onNewChat={handleNewChat} onHide={() => setChatVisible(false)} />
      ) : selectedTool === "clock-24hrs" || selectedTool === "clock-time-difference" ? (
        <ClockChatPanel key={`${selectedTool}-${toolChatSessionIds[selectedTool]}`} selectedTool={selectedTool} chatId={toolChatSessionIds[selectedTool]} hasUserQuestion={hasUserQuestion} question={question || undefined} type={type} toolUrl={previewUrl ?? undefined} onNewChat={handleNewChat} onHide={() => setChatVisible(false)} />
      ) : (
        <div className="relative flex w-[360px] shrink-0 flex-col min-h-0 bg-white/95">
        <div className="border-b border-[#d8d8d8] px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-[4px] bg-[#146ef5] text-white">
                <MessageSquare className="size-4" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[1px] text-[#ababab]">Math assistant</p>
                <p className="text-sm font-semibold text-[#080808]">AI Chatbot</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={handleNewChat}
                className="rounded-[4px] border border-transparent bg-[#146ef5] px-2.5 text-xs font-semibold text-white shadow-[0_6px_16px_rgba(20,110,245,0.28)] transition-all hover:bg-[#0055d4] hover:shadow-[0_8px_20px_rgba(0,85,212,0.34)]"
                title="新建聊天"
              >
                New Chat
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setChatVisible(false)}
                className="rounded-[4px]"
                title="隱藏 AI 助手"
              >
                <PanelRight className="size-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Chat messages */}
        <div ref={chatScrollRef} onScroll={handleChatScroll} className="flex-1 space-y-3 overflow-y-auto px-4 py-4 min-h-0 bg-[linear-gradient(180deg,_rgba(20,110,245,0.03)_0%,_rgba(255,255,255,1)_35%)]">
          {isResumingSession && messages.length === 0 && (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-[#5a5a5a]">
              <Loader2 className="size-4 animate-spin text-[#146ef5]" />
              正在還原上次的對話…
            </div>
          )}
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex items-start gap-2 ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {message.role === "assistant" && (
                <ChatAvatar
                  role="assistant"
                  className="h-8 w-8 rounded-[4px] shadow-[2px_2px_0px_#080808]"
                />
              )}
              <div
                className={`min-w-0 max-w-[85%] rounded-[8px] px-3 py-2 text-sm leading-relaxed shadow-[2px_2px_0px_#080808] ${
                  message.role === "user"
                    ? "bg-[#146ef5] text-white"
                    : "border border-[#d8d8d8] bg-white text-[#080808]"
                }`}
              >
                {message.parts.some((p) => p.type === "file") && (
                  <div className="flex flex-wrap gap-1.5 mb-1.5 not-prose">
                    {message.parts
                      .filter((p): p is { type: "file"; mediaType: string; url: string; filename?: string } => p.type === "file" && p.mediaType.startsWith("image/"))
                      .map((filePart, i) => (
                        <img
                          key={i}
                          src={filePart.url}
                          alt={filePart.filename ?? "uploaded image"}
                          className="max-w-[200px] max-h-[200px] rounded-[4px] border border-white/30 object-contain"
                        />
                      ))}
                  </div>
                )}
                {message.parts
                  .filter((part): part is { type: "text"; text: string } => part.type === "text")
                  .map((part, i) => (
                    message.role === "assistant" ? (
                      <div
                        key={i}
                        className="prose prose-sm max-w-none break-words prose-p:my-2 prose-li:my-1 prose-headings:my-2 [overflow-wrap:anywhere] [&_.katex-display]:max-w-full [&_.katex-display]:overflow-x-auto [&_.katex-display]:overflow-y-hidden [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_code]:break-words"
                      >
                        <ReactMarkdown
                          remarkPlugins={[remarkMath]}
                          rehypePlugins={[[rehypeKatex, { strict: false }]]}
                        >
                          {part.text}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <div
                        key={i}
                        className="prose prose-sm w-full max-w-none break-words overflow-hidden prose-invert prose-p:my-1 [overflow-wrap:anywhere] [&_.katex-display]:max-w-full [&_.katex-display]:overflow-x-auto [&_.katex]:text-white [&_.katex-display]:overflow-y-hidden"
                      >
                        <ReactMarkdown
                          remarkPlugins={[remarkMath]}
                          rehypePlugins={[[rehypeKatex, { strict: false }]]}
                        >
                          {stripTextModeLatex(part.text)}
                        </ReactMarkdown>
                      </div>
                    )
                  ))}
              </div>
              {message.role === "user" && (
                <ChatAvatar
                  role="user"
                  className="h-8 w-8 rounded-[4px] border border-[#d8d8d8] bg-white"
                />
              )}
            </div>
          ))}

          {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
            <div className="flex items-start gap-2 justify-start">
              <ChatAvatar
                role="assistant"
                className="h-8 w-8 rounded-[4px] shadow-[2px_2px_0px_#080808]"
              />
              <div className="rounded-[8px] border border-[#d8d8d8] bg-white px-3 py-2 text-sm text-[#5a5a5a]">
                <span className="animate-pulse">思考中...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Chat input */}
        <div className="border-t border-[#d8d8d8] px-3 py-3 bg-white">
          <form onSubmit={handleSubmit}>
            <div className="relative w-full rounded-[8px] border border-[#d8d8d8] bg-white shadow-[rgba(0,0,0,0)_0px_84px_24px,rgba(0,0,0,0.01)_0px_54px_22px,rgba(0,0,0,0.04)_0px_30px_18px,rgba(0,0,0,0.08)_0px_13px_13px,rgba(0,0,0,0.09)_0px_3px_7px]">
              {/* Image preview thumbnails */}
              <ChatAttachmentPreview files={chatFiles} onRemove={removeChatFile} variant="square" />

              <Textarea
                ref={textareaRef}
                placeholder="繼續提問...（可直接粘貼圖片）"
                value={input}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                className="min-h-[58px] max-h-[160px] resize-none overflow-y-auto border-0 bg-transparent px-3 pt-3 pb-10 text-sm shadow-none focus-visible:ring-0"
              />

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleChatFileChange}
                className="hidden"
              />

              <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded-[4px] border border-[#d8d8d8] bg-white text-[#080808] transition-all hover:border-[#898989] hover:bg-white"
                    title="上傳圖片"
                  >
                    <ImagePlus className="size-3.5 text-[#5a5a5a]" />
                  </Button>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    onClick={toggleVoice}
                    className={`rounded-[4px] border bg-white transition-all hover:bg-white ${
                      isListening
                        ? 'border-red-400 text-red-500 hover:border-red-500 hover:text-red-600'
                        : 'border-[#d8d8d8] text-[#080808] hover:border-[#898989] hover:text-[#080808]'
                    }`}
                    title={isListening ? '停止語音輸入' : '語音輸入'}
                    aria-label={isListening ? '停止語音輸入' : '語音輸入'}
                  >
                    {isListening ? <MicOff className="size-3.5" /> : <Mic className="size-3.5 text-[#5a5a5a]" />}
                  </Button>
                  {isListening && (
                    <span aria-live="polite" className="text-[11px] font-medium text-red-500 animate-pulse">聆聽中…</span>
                  )}
                  {!isListening && voiceError && (
                    <span role="alert" className="text-[11px] font-medium text-red-500">{voiceError.message}</span>
                  )}
                </div>
                {isLoading ? (
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="outline"
                    className="rounded-[4px]"
                    onClick={stop}
                  >
                    <Square className="size-3" />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    size="icon-sm"
                    className="rounded-[4px] bg-[#146ef5] text-white hover:bg-[#0055d4]"
                    disabled={!canSend}
                  >
                    <ArrowUp className="size-3.5" />
                  </Button>
                )}
              </div>
            </div>
          </form>
        </div>
      </div>
      ))}
    </div>
  );
}
