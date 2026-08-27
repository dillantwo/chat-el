"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Box, Clock, Loader2, LogOut, MessageSquare, Sparkles, Share2, Timer, Trash2, Variable, Zap } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from "@/components/ui/sidebar";
import { useAuth } from "@/components/AuthProvider";
import { useToolbox, toolIconMap } from "@/contexts/ToolboxContext";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { basePath } from "@/lib/utils";
import { deleteMathChatHistoryItem, getMathChatHistory, getMathChatHistoryItem, type MathChatHistorySummary } from "@/lib/math-chat-history";
import { getEnglishChatHistory, getEnglishChatHistoryItem, deleteEnglishChatHistoryItem, type EnglishChatHistorySummary } from "@/lib/english-chat-history";
import { getChineseChatHistory, getChineseChatHistoryItem, deleteChineseChatHistoryItem, type ChineseChatHistorySummary } from "@/lib/chinese-chat-history";
import { VocabBank } from "@/components/VocabBank";

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

/** One 圖解生成記錄, as returned by GET /api/html-content. */
interface SavedAiTool {
  toolKey: string;
  title: string;
  html: string;
  chatMessages: SavedChatMessage[];
  sharedWithStudents?: boolean;
  updatedAt?: string;
}

function ToolItem({
  toolKey,
  label,
  sub,
  icon,
  iconBg,
  isActive,
  onClick,
  groupLabel,
}: {
  toolKey: string;
  label: string;
  sub: string;
  icon: string;
  iconBg: string;
  isActive: boolean;
  onClick: () => void;
  groupLabel?: string;
}) {
  const Icon = toolIconMap[icon] ?? Variable;
  return (
    <Tooltip>
      <TooltipTrigger render={<SidebarMenuSubItem />}>
          <SidebarMenuSubButton
            onClick={onClick}
            isActive={isActive}
            className={`relative gap-2.5 ${
              isActive
                ? "bg-blue-50 text-blue-700 font-semibold ring-1 ring-blue-300 pl-3 hover:bg-blue-100 hover:text-blue-700 data-active:bg-blue-50 data-active:text-blue-700"
                : ""
            }`}
          >
            {isActive && (
              <span
                aria-hidden
                className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r bg-blue-600"
              />
            )}
            <span
              className={`inline-flex items-center justify-center size-5 rounded-md ${iconBg} text-white shrink-0 ${
                isActive ? "ring-2 ring-blue-400" : ""
              }`}
            >
              <Icon className="size-3" strokeWidth={2.5} />
            </span>
            <span className="truncate text-xs">
              {groupLabel && (
                <span className="text-muted-foreground">{groupLabel} · </span>
              )}
              {label}
            </span>
          </SidebarMenuSubButton>
      </TooltipTrigger>
      <TooltipContent side="right" className="text-xs">
        {groupLabel && `${groupLabel} · `}{label} — {sub}
      </TooltipContent>
    </Tooltip>
  );
}

export function AppSidebar() {
  const { user, logout } = useAuth();
  const toolbox = useToolbox();
  const router = useRouter();
  const pathname = usePathname();
  const initials = user?.displayName?.charAt(0).toUpperCase() ?? "U";
  const logoSrc = `${basePath}/logo.png`.replace(/\/+$/g, "").replace(/([^:]\/)\/+/g, "$1") || "/logo.png";

  const tools = toolbox?.tools ?? [];
  const selectedTool = toolbox?.selectedTool ?? null;
  const question = toolbox?.question ?? "";
  const recommendedToolKeys = toolbox?.recommendedToolKeys ?? [];
  const isMathDashboard = pathname.startsWith('/math/dashboard');
  /** AI 生成圖解 — its own topic, with 圖解生成記錄 inline in this sidebar. */
  const isMathDiagram = pathname.startsWith('/math/diagram');
  const isChineseScenery = pathname.startsWith('/chinese/scenery');
  const isChineseCharacter = pathname.startsWith('/chinese/character');
  const isChineseLinZexu = pathname.startsWith('/chinese/lin-zexu');
  const isChineseWriting = isChineseScenery || isChineseCharacter || isChineseLinZexu;
  const isScienceCircuit = pathname.startsWith('/science/circuit');
  const isScienceAerospace = pathname.startsWith('/science/aerospace');
  const isHumanitiesWater = pathname.startsWith('/humanities/water-resources');
  const isHumanitiesAntiJapaneseWar = pathname.startsWith('/humanities/anti-japanese-war');
  const isChineseLikeChat = isChineseWriting || isScienceCircuit || isScienceAerospace || isHumanitiesWater || isHumanitiesAntiJapaneseWar;
  const isEnglishDashboard = pathname.startsWith('/english/dashboard') || pathname.startsWith('/english/thankyouletter') || pathname.startsWith('/english/reading-comprehension');
  // Reading-comprehension role-play pages get a draggable Word Bank.
  const isReadingRoleplay =
    pathname.startsWith('/english/reading-comprehension') && pathname.endsWith('/roleplay');
  const isTeacher = user?.role === "teacher";
  const isStudent = user?.role === "student";

  const allToolGroups = toolbox?.allToolGroups ?? [];
  const isAnalyzingTools = toolbox?.isAnalyzingTools ?? false;
  // Recommended tools may come from any group (e.g. 四則運算 vs 分數概念), so match
  // against every available tool, not just the current group's `tools`.
  const recommendCandidates = allToolGroups.length > 0 ? allToolGroups.flatMap((g) => g.tools) : tools;
  const recommendedTools = recommendCandidates.filter((t) => recommendedToolKeys.includes(t.key));
  const [savedAiTools, setSavedAiTools] = useState<SavedAiTool[]>([]);
  /** The toolKey of the 圖解 the workspace currently has open, for highlighting. */
  const [activeDiagramKey, setActiveDiagramKey] = useState<string | null>(null);
  /** The 圖解 awaiting delete confirmation; also drives the confirm dialog. */
  const [pendingDeleteTool, setPendingDeleteTool] = useState<SavedAiTool | null>(null);
  const [deletingTool, setDeletingTool] = useState(false);
  const [deleteToolError, setDeleteToolError] = useState<string | null>(null);
  const [mathChatHistory, setMathChatHistory] = useState<MathChatHistorySummary[]>([]);
  const [englishChatHistory, setEnglishChatHistory] = useState<EnglishChatHistorySummary[]>([]);
  const [chineseChatHistory, setChineseChatHistory] = useState<ChineseChatHistorySummary[]>([]);
  const [activeEnglishChatId, setActiveEnglishChatId] = useState<string | null>(null);
  const [activeChineseChatId, setActiveChineseChatId] = useState<string | null>(null);
  const [activeMathChatId, setActiveMathChatId] = useState<string | null>(null);

  /**
   * Opening a conversation fetches its transcript, because the history list is
   * metadata only (the API projects `messages` out — see lib/*-chat-history.ts).
   * This counter drops the result of an earlier click when a later one has
   * already been made, so a slow fetch cannot overwrite the chat the student
   * most recently picked.
   */
  const chatLoadRequestRef = useRef(0);

  /** Fetch a conversation, then hand it to the panel listening on `eventName`. */
  const openChat = useCallback(
    <T,>(eventName: string, fetchItem: () => Promise<T | null>) => {
      const request = ++chatLoadRequestRef.current;
      void (async () => {
        const item = await fetchItem();
        if (!item || chatLoadRequestRef.current !== request) return;
        window.dispatchEvent(new CustomEvent(eventName, { detail: { item } }));
      })();
    },
    [],
  );

  // Teachers review student records on /teacher/student-data (查看學生數據),
  // reached from the home page — not from this sidebar or from any topic page.

  const fetchSavedAiTools = useCallback(() => {
    if (!isMathDiagram || (!isTeacher && !isStudent)) return;

    fetch(`${basePath}/api/html-content`)
      .then((res) => res.json())
      .then((data) => setSavedAiTools(data.items ?? []))
      .catch(() => {});
  }, [isMathDiagram, isTeacher, isStudent]);

  async function toggleShareAiTool(toolKey: string, sharedWithStudents: boolean) {
    try {
      const res = await fetch(`${basePath}/api/html-content`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toolKey, sharedWithStudents }),
      });
      if (!res.ok) throw new Error("Failed to update sharing");
      fetchSavedAiTools();
    } catch {
      alert("更新分享狀態失敗，請稍後再試。");
    }
  }

  function closeDeleteToolDialog() {
    setPendingDeleteTool(null);
    setDeleteToolError(null);
  }

  /**
   * Delete the 圖解 the confirm dialog is currently asking about.
   *
   * The dialog stays open on failure and shows the reason inline, which is the
   * reason this is a Dialog rather than window.confirm: the record can be
   * visible to a whole class, so both the warning and the error belong in the
   * same surface the teacher is already looking at.
   */
  async function confirmDeleteSavedAiTool() {
    const item = pendingDeleteTool;
    if (!item) return;

    setDeletingTool(true);
    setDeleteToolError(null);
    try {
      const res = await fetch(
        `${basePath}/api/html-content?toolKey=${encodeURIComponent(item.toolKey)}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Failed to delete saved AI tool");
      // Clear the workspace when the record it is showing is the one that just
      // went away, so the teacher cannot keep editing (and re-saving) a deleted
      // 圖解.
      if (activeDiagramKey === item.toolKey) {
        setActiveDiagramKey(null);
        window.dispatchEvent(new CustomEvent("diagram:new"));
      }
      closeDeleteToolDialog();
      fetchSavedAiTools();
    } catch {
      setDeleteToolError("刪除失敗，請稍後再試。");
    } finally {
      setDeletingTool(false);
    }
  }

  /**
   * Open a saved 圖解 in the workspace. The list response already carries the
   * HTML, but this refetches the single record so the teacher's transcript comes
   * with it — and so a record deleted in another tab fails here rather than
   * loading a stale copy. The API strips `chatMessages` for students, so the
   * workspace simply starts them on an empty conversation.
   */
  async function loadSavedAiTool(toolKey: string) {
    try {
      const res = await fetch(`${basePath}/api/html-content?toolKey=${encodeURIComponent(toolKey)}`);
      if (!res.ok) throw new Error("Failed to load saved AI tool");
      const data = await res.json();
      if (!data.item) return;
      setActiveDiagramKey(toolKey);
      window.dispatchEvent(new CustomEvent("diagram:load", { detail: { item: data.item } }));
    } catch {
      // Keep sidebar interaction quiet if loading fails.
    }
  }

  useEffect(() => {
    fetchSavedAiTools();
  }, [fetchSavedAiTools]);

  useEffect(() => {
    if (!isMathDashboard) return;

    async function refreshMathChatHistory() {
      setMathChatHistory(await getMathChatHistory());
    }

    void refreshMathChatHistory();
    function handleChange() {
      void refreshMathChatHistory();
    }
    window.addEventListener("math-chat-history:changed", handleChange);
    return () => window.removeEventListener("math-chat-history:changed", handleChange);
  }, [isMathDashboard]);

  // Track which math chat is currently open so we can highlight it.
  useEffect(() => {
    if (!isMathDashboard) return;
    function handleActive(event: Event) {
      const id = (event as CustomEvent<{ id: string | null }>).detail?.id ?? null;
      setActiveMathChatId(id);
    }
    window.addEventListener("math-chat:active", handleActive);
    return () => window.removeEventListener("math-chat:active", handleActive);
  }, [isMathDashboard]);

  useEffect(() => {
    if (!isEnglishDashboard) return;

    // Determine topic based on current path
    const englishTopic = pathname.startsWith('/english/thankyouletter')
      ? 'thank-you-letter'
      : pathname.startsWith('/english/reading-comprehension')
      ? 'reading-comprehension'
      : 'location-direction';

    async function refreshEnglishChatHistory() {
      setEnglishChatHistory(await getEnglishChatHistory(englishTopic));
    }

    void refreshEnglishChatHistory();
    function handleChange() {
      void refreshEnglishChatHistory();
    }
    window.addEventListener("english-chat-history:changed", handleChange);
    return () => window.removeEventListener("english-chat-history:changed", handleChange);
  }, [isEnglishDashboard, pathname]);

  // Track which English chat is currently open so we can highlight it.
  useEffect(() => {
    if (!isEnglishDashboard) return;
    function handleActive(event: Event) {
      const id = (event as CustomEvent<{ id: string | null }>).detail?.id ?? null;
      setActiveEnglishChatId(id);
    }
    window.addEventListener("english-chat:active", handleActive);
    return () => window.removeEventListener("english-chat:active", handleActive);
  }, [isEnglishDashboard]);

  useEffect(() => {
    if (!isChineseLikeChat) return;

    const chineseTopic = isScienceCircuit
      ? 'science-circuit'
      : isScienceAerospace
      ? 'science-aerospace'
      : isHumanitiesWater
      ? 'humanities-water-resources'
      : isHumanitiesAntiJapaneseWar
      ? 'humanities-anti-japanese-war'
      : pathname.startsWith('/chinese/character')
      ? 'character-description'
      : pathname.startsWith('/chinese/lin-zexu')
      ? 'lin-zexu'
      : 'scenery-description';

    async function refreshChineseChatHistory() {
      setChineseChatHistory(await getChineseChatHistory(chineseTopic));
    }

    void refreshChineseChatHistory();
    function handleChange() {
      void refreshChineseChatHistory();
    }
    window.addEventListener("chinese-chat-history:changed", handleChange);
    return () => window.removeEventListener("chinese-chat-history:changed", handleChange);
  }, [isChineseLikeChat, isScienceCircuit, isScienceAerospace, pathname]);

  // Track which Chinese chat is currently open so we can highlight it.
  useEffect(() => {
    if (!isChineseLikeChat) return;
    function handleActive(event: Event) {
      const id = (event as CustomEvent<{ id: string | null }>).detail?.id ?? null;
      setActiveChineseChatId(id);
    }
    window.addEventListener("chinese-chat:active", handleActive);
    return () => window.removeEventListener("chinese-chat:active", handleActive);
  }, [isChineseLikeChat]);

  useEffect(() => {
    function handleAiToolSaved() {
      fetchSavedAiTools();
    }

    window.addEventListener("diagram:saved", handleAiToolSaved);
    return () => window.removeEventListener("diagram:saved", handleAiToolSaved);
  }, [fetchSavedAiTools]);

  // Track which 圖解 the workspace has open so we can highlight it (it also
  // clears itself when the teacher starts a new one).
  useEffect(() => {
    if (!isMathDiagram) return;
    function handleActive(event: Event) {
      const key = (event as CustomEvent<{ toolKey: string | null }>).detail?.toolKey ?? null;
      setActiveDiagramKey(key);
    }
    window.addEventListener("diagram:active", handleActive);
    return () => window.removeEventListener("diagram:active", handleActive);
  }, [isMathDiagram]);

  // Build a map from tool key to its group label
  const toolGroupLabelMap: Record<string, string> = {};
  for (const group of allToolGroups) {
    for (const t of group.tools) {
      toolGroupLabelMap[t.key] = group.label;
    }
  }

  function getMathHistoryIcon(kind: MathChatHistorySummary["kind"], selectedTool?: string | null) {
    if (kind === "volume-cubes") return Box;
    if (kind === "clock-24hrs") return Clock;
    if (kind === "clock-time-difference") return Timer;
    if (selectedTool && toolIconMap[selectedTool]) return toolIconMap[selectedTool];
    return MessageSquare;
  }

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <img
            src={logoSrc}
            alt="AI Learning Platform logo"
            className="h-10 w-auto object-contain"
          />
          <span className="text-base font-semibold leading-tight">
            AI and Coding for Subject Learning
          </span>
        </Link>
        {isMathDiagram ? (
          // AI 生成圖解: a teacher starts a new one from here. A student has
          // nothing to start — they only open what was shared with them, from
          // the 圖解記錄 list below.
          isTeacher && (
            <Button
              className="mt-4 w-full gap-2 bg-[#16a34a] text-white hover:bg-[#15803d]"
              size="lg"
              onClick={() => window.dispatchEvent(new CustomEvent('diagram:new'))}
            >
              <Sparkles className="size-4" />
              新圖解
            </Button>
          )
        ) : (
        <Button
          className={`mt-4 w-full ${
            isChineseLikeChat || isEnglishDashboard
              ? 'bg-[#146ef5] text-white hover:bg-[#0055d4]'
              : isMathDashboard
              ? 'bg-[#16a34a] text-white hover:bg-[#15803d]'
              : ''
          }`}
          size="lg"
          onClick={() => {
          const subject = pathname.split('/')[1] || 'math';
          // On the math dashboard, keep the original new-question behavior.
          if (subject === 'math' && isMathDashboard) {
            window.dispatchEvent(new CustomEvent('dashboard:new-question'));
            return;
          }
          // On the chinese/english/science chat dashboards, signal "new chat" to reset the chatbot.
          if (
            (subject === 'chinese' && isChineseWriting) ||
            (subject === 'english' && isEnglishDashboard) ||
            (subject === 'science' && isScienceCircuit) ||
            (subject === 'science' && isScienceAerospace) ||
            (subject === 'humanities' && isHumanitiesWater) ||
            (subject === 'humanities' && isHumanitiesAntiJapaneseWar)
          ) {
            window.dispatchEvent(new CustomEvent('dashboard:new-chat'));
            return;
          }
          router.push(`/${subject}`);
        }}>
          {isEnglishDashboard ? '+ New Chat' : isChineseLikeChat ? '+ 新聊天' : isMathDashboard ? '加入題目' : '+ Add New Question'}
        </Button>
        )}
      </SidebarHeader>

      <SidebarContent className="px-2">
        {/* AI Recommended Tools — only after a question is submitted */}
        {tools.length > 0 && question && (
          <SidebarGroup>
            <SidebarGroupLabel className="flex items-center gap-1.5">
              <Sparkles className="size-3.5" />
              AI 推薦工具
            </SidebarGroupLabel>
            {recommendedTools.length > 0 ? (
              <SidebarMenuSub>
                {recommendedTools.map((t) => (
                  <ToolItem
                    key={t.key}
                    toolKey={t.key}
                    label={t.label}
                    sub={t.sub}
                    icon={t.icon}
                    iconBg={t.iconBg}
                    isActive={selectedTool === t.key}
                    onClick={() => toolbox?.setSelectedTool(t.key)}
                    groupLabel={toolGroupLabelMap[t.key]}
                  />
                ))}
              </SidebarMenuSub>
            ) : isAnalyzingTools ? (
              <p className="text-xs text-muted-foreground px-2 py-1 animate-pulse">
                正在分析題目...
              </p>
            ) : (
              <p className="text-xs text-muted-foreground px-2 py-1">
                沒有特別推薦的工具，請從下方選擇。
              </p>
            )}
          </SidebarGroup>
        )}

        {/* All Tools grouped by type */}
        {allToolGroups.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>全部工具</SidebarGroupLabel>
            <SidebarMenu>
              {allToolGroups.map((group) => (
                <SidebarMenuItem key={group.label}>
                  <SidebarMenuButton className="text-xs font-medium text-muted-foreground pointer-events-none">
                    {group.label}
                  </SidebarMenuButton>
                  <SidebarMenuSub>
                    {group.tools.map((t) => (
                      <ToolItem
                        key={t.key}
                        toolKey={t.key}
                        label={t.label}
                        sub={t.sub}
                        icon={t.icon}
                        iconBg={t.iconBg}
                        isActive={selectedTool === t.key}
                        onClick={() => toolbox?.setSelectedTool(t.key)}
                      />
                    ))}
                  </SidebarMenuSub>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        )}

        {/* 圖解生成記錄 — inline on the AI 生成圖解 page, which has no toolbox */}
        {isMathDiagram && (isTeacher || isStudent) && (
          <SidebarGroup>
            <SidebarGroupLabel className="flex items-center gap-1.5">
              <Clock className="size-3.5" />
              圖解生成記錄
            </SidebarGroupLabel>
            <p className="px-3 pb-1 text-[10px] text-muted-foreground">
              {isTeacher ? "已保存的圖解（可分享給學生）" : "老師分享給你的圖解"}
            </p>
            {savedAiTools.length > 0 ? (
              <div className="space-y-0.5 px-1">
                {savedAiTools.map((item) => (
                  <div
                    key={item.toolKey}
                    className={`flex items-start gap-1.5 rounded-lg px-2 py-1.5 transition-colors ${
                      activeDiagramKey === item.toolKey
                        ? "bg-blue-50 ring-1 ring-blue-300"
                        : "hover:bg-muted"
                    }`}
                  >
                    <button
                      className="flex min-w-0 flex-1 items-start gap-2 text-left"
                      onClick={() => {
                        void loadSavedAiTool(item.toolKey);
                      }}
                    >
                      <Sparkles
                        className={`mt-0.5 size-3.5 shrink-0 ${
                          activeDiagramKey === item.toolKey ? "text-blue-600" : "text-muted-foreground"
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <div
                          className={`line-clamp-2 text-xs font-medium leading-snug ${
                            activeDiagramKey === item.toolKey ? "text-blue-700" : ""
                          }`}
                        >
                          {item.title}
                        </div>
                        <p className="mt-0.5 text-[10px] text-muted-foreground">
                          {!isTeacher && item.sharedWithStudents && "已分享 · "}
                          {item.updatedAt ? new Date(item.updatedAt).toLocaleString("zh-HK") : ""}
                        </p>
                      </div>
                    </button>
                    {isTeacher && (
                      <>
                        <Button
                          type="button"
                          size="icon-sm"
                          variant={item.sharedWithStudents ? "default" : "outline"}
                          className={
                            item.sharedWithStudents
                              ? "size-7 shrink-0 bg-[#146ef5] text-white hover:bg-[#0055d4]"
                              : "size-7 shrink-0"
                          }
                          title={item.sharedWithStudents ? "已分享給學生，點擊取消" : "分享給學生"}
                          onClick={(event) => {
                            event.stopPropagation();
                            void toggleShareAiTool(item.toolKey, !item.sharedWithStudents);
                          }}
                        >
                          <Share2 className="size-3.5" />
                        </Button>
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          className="size-7 shrink-0 rounded-[4px] text-muted-foreground hover:bg-[#fee2e2] hover:text-[#b91c1c]"
                          title="刪除記錄"
                          onClick={(event) => {
                            event.stopPropagation();
                            setDeleteToolError(null);
                            setPendingDeleteTool(item);
                          }}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="px-3 py-2 text-xs text-muted-foreground">
                {isTeacher ? "暫無圖解生成記錄" : "老師還沒有分享圖解"}
              </p>
            )}

            {/*
              The record can be visible to a whole class, so the confirmation —
              and any failure — belongs in the same surface the teacher is
              already looking at, rather than a window.confirm.
            */}
            <Dialog
              open={pendingDeleteTool !== null}
              onOpenChange={(open) => {
                // Ignore backdrop / Escape while the request is in flight so the
                // teacher cannot lose sight of a delete that may land.
                if (!open && !deletingTool) closeDeleteToolDialog();
              }}
            >
              <DialogContent className="max-w-sm">
                <DialogHeader>
                  <DialogTitle>刪除圖解記錄</DialogTitle>
                  <DialogDescription>此操作無法復原。</DialogDescription>
                </DialogHeader>

                <div className="space-y-2">
                  <p className="line-clamp-3 rounded-lg bg-muted px-3 py-2 text-sm font-medium text-foreground">
                    {pendingDeleteTool?.title}
                  </p>
                  {pendingDeleteTool?.sharedWithStudents && (
                    <p className="rounded-lg bg-[#fee2e2] px-3 py-2 text-xs text-[#b91c1c]">
                      此圖解已分享給學生，刪除後他們亦無法再開啟。
                    </p>
                  )}
                  {deleteToolError && <p className="text-sm text-destructive">{deleteToolError}</p>}
                </div>

                <DialogFooter className="flex-row justify-end gap-2">
                  <Button variant="outline" disabled={deletingTool} onClick={closeDeleteToolDialog}>
                    取消
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={deletingTool}
                    onClick={() => {
                      void confirmDeleteSavedAiTool();
                    }}
                  >
                    {deletingTool && <Loader2 className="size-4 animate-spin" />}
                    刪除
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </SidebarGroup>
        )}

        {/* English Chat History — inline in sidebar */}
        {isEnglishDashboard && (
          <SidebarGroup>
            <SidebarGroupLabel className="flex items-center gap-1.5">
              <Clock className="size-3.5" />
              Chat History
            </SidebarGroupLabel>
            {englishChatHistory.length > 0 ? (
              <div className="space-y-0.5 px-1">
                {englishChatHistory.map((item) => (
                  <div
                    key={item.id}
                    className={`flex items-start gap-2 rounded-lg px-2 py-1.5 transition-colors ${
                      activeEnglishChatId === item.id
                        ? "bg-blue-50 ring-1 ring-blue-300"
                        : "hover:bg-muted"
                    }`}
                  >
                    <button
                      className="flex min-w-0 flex-1 items-start gap-2 text-left"
                      onClick={() => {
                        setActiveEnglishChatId(item.id);
                        openChat("english-chat:load", () => getEnglishChatHistoryItem(item.id));
                      }}
                    >
                      <MessageSquare className={`size-3.5 mt-0.5 shrink-0 ${activeEnglishChatId === item.id ? "text-blue-600" : "text-muted-foreground"}`} />
                      <div className="min-w-0 flex-1">
                        <div className={`text-xs font-medium leading-snug line-clamp-2 ${activeEnglishChatId === item.id ? "text-blue-700" : ""}`}>
                          {item.title}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {item.selectedTask ? `Task ${item.selectedTask}` : "General"}
                          {" · "}
                          {new Date(item.updatedAt).toLocaleString("zh-HK")}
                        </p>
                      </div>
                    </button>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      className="mt-0.5 shrink-0 rounded-[4px] text-muted-foreground hover:bg-[#fee2e2] hover:text-[#b91c1c]"
                      title="刪除記錄"
                      onClick={(event) => {
                        event.stopPropagation();
                        void deleteEnglishChatHistoryItem(item.id);
                      }}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground px-3 py-2">暫無記錄</p>
            )}
          </SidebarGroup>
        )}

        {/* Chinese / Science Chat History — inline in sidebar */}
        {isChineseLikeChat && (
          <SidebarGroup>
            <SidebarGroupLabel className="flex items-center gap-1.5">
              <Clock className="size-3.5" />
              聊天記錄
            </SidebarGroupLabel>
            {chineseChatHistory.length > 0 ? (
              <div className="space-y-0.5 px-1">
                {chineseChatHistory.map((item) => (
                  <div
                    key={item.id}
                    className={`flex items-start gap-2 rounded-lg px-2 py-1.5 transition-colors ${
                      activeChineseChatId === item.id
                        ? "bg-blue-50 ring-1 ring-blue-300"
                        : "hover:bg-muted"
                    }`}
                  >
                    <button
                      className="flex min-w-0 flex-1 items-start gap-2 text-left"
                      onClick={() => {
                        setActiveChineseChatId(item.id);
                        openChat("chinese-chat:load", () => getChineseChatHistoryItem(item.id));
                      }}
                    >
                      <MessageSquare className={`size-3.5 mt-0.5 shrink-0 ${activeChineseChatId === item.id ? "text-blue-600" : "text-muted-foreground"}`} />
                      <div className="min-w-0 flex-1">
                        <div className={`text-xs font-medium leading-snug line-clamp-2 ${activeChineseChatId === item.id ? "text-blue-700" : ""}`}>
                          {item.title}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {new Date(item.updatedAt).toLocaleString("zh-HK")}
                        </p>
                      </div>
                    </button>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      className="mt-0.5 shrink-0 rounded-[4px] text-muted-foreground hover:bg-[#fee2e2] hover:text-[#b91c1c]"
                      title="刪除記錄"
                      onClick={(event) => {
                        event.stopPropagation();
                        void deleteChineseChatHistoryItem(item.id);
                      }}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground px-3 py-2">暫無記錄</p>
            )}
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-3 space-y-2">
        {/* Reading-comprehension role-play: draggable Word Bank, pinned at the bottom */}
        {isReadingRoleplay && <VocabBank />}

        {/* History trigger — hidden where an inline list already shows it
            (Chinese / Science / Humanities / English 聊天記錄, and the 圖解生成記錄
            on the AI 生成圖解 page, which keeps no 提問記錄 of its own) */}
        {!isChineseLikeChat && !isEnglishDashboard && !isMathDiagram && (
        <Sheet>
          <SheetTrigger
            render={
              <Button variant="outline" size="sm" className="w-full justify-start gap-2 text-xs" />
            }
          >
            <Clock className="size-3.5" />
            {isEnglishDashboard ? "分享記錄" : "歷史記錄"}
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <SheetHeader className="px-4 pt-4 pb-2">
              <SheetTitle className="flex items-center gap-2 text-sm">
                <Clock className="size-4" />
                {isEnglishDashboard ? "分享記錄" : "歷史記錄"}
              </SheetTitle>
              <SheetDescription className="text-xs">
                {isEnglishDashboard ? "過去的聊天分享記錄" : "過去的提問記錄"}
              </SheetDescription>
            </SheetHeader>
            <Separator />
            <div className="flex-1 overflow-y-auto px-2 py-2">
              {mathChatHistory.length > 0 ? (
                <div className="space-y-1">
                  {mathChatHistory.map((item) => (
                    <div
                      key={item.id}
                      className={`flex items-start gap-2 rounded-lg px-2 py-1.5 transition-colors ${
                        activeMathChatId === item.id
                          ? "bg-blue-50 ring-1 ring-blue-300"
                          : "hover:bg-muted"
                      }`}
                    >
                      <button
                        className="flex min-w-0 flex-1 items-start gap-2.5 text-left"
                        onClick={() => {
                          setActiveMathChatId(item.id);
                          openChat("dashboard:load-math-chat", () => getMathChatHistoryItem(item.id));
                        }}
                      >
                        {(() => {
                          const Icon = getMathHistoryIcon(item.kind, item.selectedTool);
                          return <Icon className={`size-3.5 mt-0.5 shrink-0 ${activeMathChatId === item.id ? "text-blue-600" : "text-muted-foreground"}`} />;
                        })()}
                        <div className="min-w-0 flex-1">
                          <div className={`text-xs font-medium leading-snug line-clamp-2 prose prose-sm max-w-none [&_p]:m-0 ${activeMathChatId === item.id ? "text-blue-700" : ""}`}>
                            <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[[rehypeKatex, { strict: false }]]}>
                              {item.title}
                            </ReactMarkdown>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {item.kind === "general"
                              ? (item.selectedTool ? `工具: ${item.selectedTool}` : "一般數學對話")
                              : item.kind === "volume-cubes"
                                ? "體積工具"
                                : item.kind === "clock-24hrs"
                                  ? "24小時時鐘"
                                  : "時間差時鐘"}
                            {" · "}
                            {new Date(item.updatedAt).toLocaleString("zh-HK")}
                          </p>
                        </div>
                      </button>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        className="mt-0.5 shrink-0 rounded-[4px] text-muted-foreground hover:bg-[#fee2e2] hover:text-[#b91c1c]"
                        title="刪除記錄"
                        onClick={(event) => {
                          event.stopPropagation();
                          void deleteMathChatHistoryItem(item.id);
                        }}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Clock className="size-8 mb-2 opacity-30" />
                  <p className="text-xs">暫無記錄</p>
                </div>
              )}
            </div>
          </SheetContent>
        </Sheet>
        )}

        {/* User info */}
        <Separator />
        <div className="flex items-center gap-2">
          <Avatar className="size-7">
            <AvatarFallback className="bg-primary text-primary-foreground text-xs">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col flex-1 min-w-0">
            <span className="text-sm truncate">{user?.displayName ?? "用戶"}</span>
            {user && (
              <span className="text-xs text-muted-foreground capitalize">
                {user.role === "teacher" ? "教師" : "學生"}
              </span>
            )}
          </div>
          {user && (
            <button
              onClick={logout}
              title="登出"
              className="ml-auto inline-flex items-center rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <LogOut className="size-4" />
            </button>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
