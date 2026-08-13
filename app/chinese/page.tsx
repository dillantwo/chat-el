"use client";

import { useRouter } from "next/navigation";
import { PenTool, BookOpen, MessageSquare, ScrollText, FolderDown, ArrowRight } from "lucide-react";
import Header from "@/components/Header";
import { useAuth } from "@/components/AuthProvider";
import { topicKey } from "@/lib/topics";

const topics: {
  id: string;
  label: string;
  labelEn: string;
  description: string;
  icon: typeof PenTool;
  accent: string;
  available: boolean;
  hidden?: boolean;
}[] = [
  {
    id: "scenery-description",
    label: "景物描寫",
    labelEn: "Scenery Description",
    description: "從觀察、感官描寫到段落鋪陳，建立具畫面感的寫作能力。",
    icon: PenTool,
    accent: "#ff6b00",
    available: true,
  },
  {
    id: "character-description",
    label: "人物描寫",
    labelEn: "Character Description",
    description: "掌握人物外貌、語言、動作與心理描寫的組織方式。",
    icon: MessageSquare,
    accent: "#00d722",
    available: true,
  },
  {
    id: "lin-zexu",
    label: "學習林則徐",
    labelEn: "Learning Lin Zexu",
    description: "透過林則徐的生平與事跡，認識歷史人物的精神與時代背景。",
    icon: BookOpen,
    accent: "#7a3dff",
    available: true,
    // 暫時對所有用戶隱藏，需要時將 hidden 改為 false 即可重新開放。
    hidden: true,
  },
  {
    id: "wenyan",
    label: "學習文言文",
    labelEn: "Classical Chinese",
    description: "遊戲化學習文言文：學習模式追蹤進度，挑戰模式限時選擇題猜常用字，賺分數和獎章。",
    icon: ScrollText,
    accent: "#ff6b00",
    available: true,
  },
  {
    id: "learning-materials",
    label: "學習資源",
    labelEn: "Learning Materials",
    description: "下載中國語文科的補充教材、工作紙與參考資源。",
    icon: FolderDown,
    accent: "#7a3dff",
    available: true,
  },
];

export default function ChinesePage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  // `hidden` keeps a topic off every school's grid (a code-level switch), while
  // 學校管理 closes topics per school. The routes are guarded server-side too
  // (see app/chinese/*/layout.tsx).
  const visibleTopics = topics.filter(
    (t) => !t.hidden && (user?.topics ?? []).includes(topicKey("chinese", t.id)),
  );

  function navigateToTopic(topicId: string, available: boolean) {
    if (!available) return;
    if (topicId === "scenery-description") {
      router.push("/chinese/scenery");
      return;
    }
    if (topicId === "character-description") {
      router.push("/chinese/character");
      return;
    }
    if (topicId === "lin-zexu") {
      router.push("/chinese/lin-zexu");
      return;
    }
    if (topicId === "wenyan") {
      router.push("/chinese/wenyan");
      return;
    }
    if (topicId === "learning-materials") {
      router.push("/chinese/materials");
      return;
    }
  }

  return (
    <>
      <Header backHref="/" backLabel="選科目" />

      <main className="relative flex flex-1 items-start overflow-y-auto overflow-x-hidden bg-[linear-gradient(180deg,_#fffdf8_0%,_#f8f7f4_48%,_#ffffff_100%)] text-[#080808]">
        <div className="absolute inset-x-0 top-0 h-56 bg-[radial-gradient(circle_at_top,_rgba(255,174,19,0.12),_transparent_42%)]" />
        <div className="absolute right-0 top-24 h-56 w-56 translate-x-1/4 rounded-full bg-[#146ef5]/8 blur-3xl" />

        <div className="relative mx-auto flex w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="flex w-full flex-col gap-10 py-2">
            <section className="grid gap-4 px-2 sm:px-0 sm:grid-cols-2 lg:grid-cols-3">
              {!loading && visibleTopics.length === 0 && (
                <p className="rounded-[8px] border border-dashed border-[#d8d8d8] p-6 text-sm text-[#5a5a5a] sm:col-span-2 lg:col-span-3">
                  此科目暫未開放任何主題，請聯絡管理員。
                </p>
              )}
              {visibleTopics.map(({ id, label, labelEn, description, icon: Icon, accent, available }) => (
                <button
                  key={id}
                  onClick={() => navigateToTopic(id, available)}
                  disabled={!available}
                  className={[
                    "group flex min-h-[320px] flex-col rounded-[8px] border p-6 text-left transition duration-200",
                    available
                      ? "cursor-pointer border-[#d8d8d8] bg-white hover:-translate-y-1 hover:border-[#080808]"
                      : "cursor-not-allowed border-[#d8d8d8] bg-[#f3f3f1]",
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div
                      className="flex h-12 w-12 items-center justify-center rounded-[4px] text-white shadow-[6px_6px_0px_#080808]"
                      style={{ backgroundColor: accent }}
                    >
                      <Icon className="size-5" />
                    </div>
                    <span className="text-[11px] font-semibold uppercase tracking-[1.1px] text-[#ababab]">
                      {labelEn}
                    </span>
                  </div>

                  <div className="mt-12 space-y-4">
                    <h2 className="text-[32px] leading-[1.04] font-semibold tracking-[-0.04em] text-[#080808]">
                      {label}
                    </h2>
                    <p className="text-sm leading-7 text-[#5a5a5a]">
                      {description}
                    </p>
                  </div>

                  <div className="mt-auto border-t border-[#d8d8d8] pt-5">
                    <span className="inline-flex items-center gap-2 text-sm font-medium text-[#080808] transition-transform duration-200 group-hover:translate-x-1">
                      開始這個主題
                      <ArrowRight className="size-4 text-[#146ef5]" />
                    </span>
                  </div>
                </button>
              ))}
            </section>
          </div>
        </div>
      </main>
    </>
  );
}
