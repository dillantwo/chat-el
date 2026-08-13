"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Box, Clock, LogOut, MessageSquare, Sparkles, Save, Share2, Timer, Trash2, Variable, Zap } from "lucide-react";
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
import { Separator } from "@/components/ui/separator";
import { basePath } from "@/lib/utils";
import { deleteMathChatHistoryItem, getMathChatHistory, type MathChatHistoryItem } from "@/lib/math-chat-history";
import { getEnglishChatHistory, deleteEnglishChatHistoryItem, type EnglishChatHistoryItem } from "@/lib/english-chat-history";
import { getChineseChatHistory, deleteChineseChatHistoryItem, type ChineseChatHistoryItem } from "@/lib/chinese-chat-history";
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
  const [savedAiTools, setSavedAiTools] = useState<Array<{
    toolKey: string;
    title: string;
    html: string;
    chatMessages: SavedChatMessage[];
    sharedWithStudents?: boolean;
    updatedAt?: string;
  }>>([]);
  const [mathChatHistory, setMathChatHistory] = useState<MathChatHistoryItem[]>([]);
  const [englishChatHistory, setEnglishChatHistory] = useState<EnglishChatHistoryItem[]>([]);
  const [chineseChatHistory, setChineseChatHistory] = useState<ChineseChatHistoryItem[]>([]);
  const [activeEnglishChatId, setActiveEnglishChatId] = useState<string | null>(null);
  const [activeChineseChatId, setActiveChineseChatId] = useState<string | null>(null);
  const [activeMathChatId, setActiveMathChatId] = useState<string | null>(null);

  // Teachers review student records on /teacher/student-data (查看學生數據),
  // reached from the home page — not from this sidebar or from any topic page.

  const fetchSavedAiTools = useCallback(() => {
    if (!isMathDashboard || (!isTeacher && !isStudent)) return;

    fetch(`${basePath}/api/html-content`)
      .then((res) => res.json())
      .then((data) => setSavedAiTools(data.items ?? []))
      .catch(() => {});
  }, [isMathDashboard, isTeacher, isStudent]);

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

  async function loadSavedAiTool(toolKey: string) {
    try {
      const res = await fetch(`${basePath}/api/html-content?toolKey=${encodeURIComponent(toolKey)}`);
      if (!res.ok) throw new Error("Failed to load saved AI tool");
      const data = await res.json();
      if (!data.item) return;
      window.dispatchEvent(new CustomEvent("dashboard:load-ai-tool", {
        detail: {
          ...data.item,
          chatMode: isTeacher ? "ai-tool" : "question",
          // Students should always start from Q&A chat mode on shared tools.
          chatMessages: isTeacher ? data.item.chatMessages : [],
        },
      }));
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

    window.addEventListener("dashboard:ai-tool-saved", handleAiToolSaved);
    return () => window.removeEventListener("dashboard:ai-tool-saved", handleAiToolSaved);
  }, [fetchSavedAiTools]);

  // Build a map from tool key to its group label
  const toolGroupLabelMap: Record<string, string> = {};
  for (const group of allToolGroups) {
    for (const t of group.tools) {
      toolGroupLabelMap[t.key] = group.label;
    }
  }

  function getMathHistoryIcon(kind: MathChatHistoryItem["kind"], selectedTool?: string | null) {
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
        {isMathDashboard && isTeacher && (
          <Button
            variant="outline"
            className="mt-2 w-full justify-center gap-2 border-[#cfe0ff] bg-[#f4f8ff] text-[#146ef5] hover:border-[#a9c7ff] hover:bg-[#eaf2ff] hover:text-[#0055d4]"
            size="lg"
            onClick={() => {
              window.dispatchEvent(new CustomEvent('dashboard:new-ai-tool'));
            }}
          >
            <Sparkles className="size-4" />
            AI生成工具
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
                        window.dispatchEvent(new CustomEvent("english-chat:load", { detail: { item } }));
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
                        window.dispatchEvent(new CustomEvent("chinese-chat:load", { detail: { item } }));
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

        {isMathDashboard && (isTeacher || isStudent) && (
          <Sheet>
            <SheetTrigger
              render={
                <Button variant="outline" size="sm" className="w-full justify-start gap-2 text-xs" />
              }
            >
              <Save className="size-3.5" />
              工具生成記錄
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <SheetHeader className="px-4 pt-4 pb-2">
                <SheetTitle className="flex items-center gap-2 text-sm">
                  <Save className="size-4" />
                  工具生成記錄
                </SheetTitle>
                <SheetDescription className="text-xs">
                  {isTeacher ? "已保存的 AI 工具（可分享給學生）" : "老師分享的 AI 工具"}
                </SheetDescription>
              </SheetHeader>
              <Separator />
              <div className="flex-1 overflow-y-auto px-2 py-2">
                {savedAiTools.length > 0 ? (
                  <div className="space-y-1">
                    {savedAiTools.map((item) => (
                      <div key={item.toolKey} className="flex items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-muted transition-colors">
                        <button
                          className="flex min-w-0 flex-1 items-start gap-2.5 text-left"
                          onClick={() => {
                            void loadSavedAiTool(item.toolKey);
                          }}
                        >
                          <Save className="size-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-medium leading-snug line-clamp-2">
                              {item.title}
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {item.updatedAt ? new Date(item.updatedAt).toLocaleString("zh-HK") : ""}
                            </p>
                          </div>
                        </button>
                        {isTeacher && (
                          <Button
                            type="button"
                            size="icon-sm"
                            variant={item.sharedWithStudents ? "default" : "outline"}
                            className={item.sharedWithStudents ? "h-7 w-7 bg-[#146ef5] text-white hover:bg-[#0055d4]" : "h-7 w-7"}
                            title={item.sharedWithStudents ? "已分享給學生，點擊取消" : "分享給學生"}
                            onClick={() => {
                              void toggleShareAiTool(item.toolKey, !item.sharedWithStudents);
                            }}
                          >
                            <Share2 className="size-3.5" />
                          </Button>
                        )}
                        {!isTeacher && item.sharedWithStudents && (
                          <span className="mt-0.5 inline-flex items-center rounded-[4px] bg-[#146ef5]/10 px-1.5 py-0.5 text-[10px] font-medium text-[#146ef5]">
                            已分享
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Save className="size-8 mb-2 opacity-30" />
                    <p className="text-xs">暫無工具生成記錄</p>
                  </div>
                )}
              </div>
            </SheetContent>
          </Sheet>
        )}

        {/* History trigger — hidden where inline 聊天記錄 already shows (Chinese / Science / Humanities / English) */}
        {!isChineseLikeChat && !isEnglishDashboard && (
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
                          window.dispatchEvent(new CustomEvent("dashboard:load-math-chat", { detail: { item } }));
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
