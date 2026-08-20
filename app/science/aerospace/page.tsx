"use client";

import { useRouter } from "next/navigation";
import {
  History,
  Rocket,
  Compass,
  Orbit,
  MessageCircle,
  ArrowRight,
} from "lucide-react";
import Header from "@/components/Header";

type Part = {
  id: string;
  label: string;
  labelEn: string;
  description: string;
  icon: typeof History;
  accent: string;
  href: string;
  cta: string;
};

// The AI chatbot is one shared chat (same route, same history) that both grade
// levels can open, so it is listed in each group rather than duplicated.
const CHATBOT: Part = {
  id: "chat",
  label: "AI 對話助手「小空」",
  labelEn: "AI Chatbot",
  description:
    "跟著「🚀小空」(Little Space) 對話，隨時提問衛星應用、國家航天員、太空生活及太空探索的問題。",
  icon: MessageCircle,
  accent: "#ed52cb",
  href: "/science/aerospace/chat",
  cta: "開始對話",
};

const groups: {
  id: string;
  label: string;
  labelEn: string;
  parts: Part[];
}[] = [
  {
    id: "p4",
    label: "小四",
    labelEn: "P4",
    parts: [
      {
        id: "timeline",
        label: "中國航天大冒險",
        labelEn: "China Space Adventure",
        description:
          "在互動時間線上走過中國航天的重要里程碑，一步一步解鎖從人造衛星到載人航天、探月與探火的成就。",
        icon: History,
        accent: "#ef4444",
        href: "/science/aerospace/timeline",
        cta: "開始冒險",
      },
      CHATBOT,
    ],
  },
  {
    id: "p6",
    label: "小六",
    labelEn: "P6",
    parts: [
      {
        id: "mars-mission",
        label: "火星探測任務",
        labelEn: "Mars Mission Challenge",
        description:
          "選出正確的指令，完成從火箭發射到成功降落火星的每一步，體驗深空探測的重重挑戰。",
        icon: Rocket,
        accent: "#f59e0b",
        href: "/science/aerospace/mars-mission",
        cta: "開始任務",
      },
      {
        id: "navigation-satellite",
        label: "導航衛星尋寶小遊戲",
        labelEn: "Navigation Satellite Game",
        description:
          "利用導航衛星的訊號範圍鎖定寶藏位置，從遊戲中明白為什麼現實中的定位需要至少四顆衛星。",
        icon: Compass,
        accent: "#10b981",
        href: "/science/aerospace/navigation-satellite",
        cta: "開始尋寶",
      },
      {
        id: "satellite-height",
        label: "不同高度軌道的衛星",
        labelEn: "Satellite Orbit Heights",
        description:
          "比較低、中、高軌道衛星的電波覆蓋範圍與運行週期，認識不同高度軌道各自的用途。",
        icon: Orbit,
        accent: "#146ef5",
        href: "/science/aerospace/satellite-height",
        cta: "開始比較",
      },
      CHATBOT,
    ],
  },
];

export default function ScienceAerospaceLandingPage() {
  const router = useRouter();

  return (
    <>
      <Header backHref="/science" backLabel="返回科學科" />

      <main className="relative flex flex-1 items-start overflow-y-auto overflow-x-hidden bg-[linear-gradient(180deg,_#fffdf8_0%,_#f8f7f4_48%,_#ffffff_100%)] text-[#080808]">
        <div className="absolute inset-x-0 top-0 h-56 bg-[radial-gradient(circle_at_top,_rgba(20,110,245,0.12),_transparent_42%)]" />
        <div className="absolute right-0 top-24 h-56 w-56 translate-x-1/4 rounded-full bg-[#ef4444]/8 blur-3xl" />

        <div className="relative mx-auto flex w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="flex w-full flex-col gap-10 py-2">
            <section className="flex flex-col gap-3 px-2 sm:px-0">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-[4px] text-white shadow-[6px_6px_0px_#080808]"
                style={{ backgroundColor: "#146ef5" }}
              >
                <Rocket className="size-5" />
              </div>
              <h1 className="text-[40px] leading-[1.02] font-semibold tracking-[-0.04em] text-[#080808] sm:text-[52px]">
                航天科技
              </h1>
            </section>

            {groups.map((group) => (
              <section key={group.id} className="flex flex-col gap-4">
                <div className="flex items-center gap-3 px-2 sm:px-0">
                  <span
                    className="inline-flex items-center rounded-[4px] px-2.5 py-1 text-[13px] font-semibold tracking-[0.02em] text-white"
                    style={{ backgroundColor: "#080808" }}
                  >
                    {group.labelEn}
                  </span>
                  <h2 className="text-[22px] font-semibold leading-none tracking-[-0.03em] text-[#080808]">
                    {group.label}
                  </h2>
                  <span className="h-px flex-1 bg-[#d8d8d8]" />
                </div>

                <div className="grid gap-4 px-2 sm:px-0 sm:grid-cols-2 lg:grid-cols-3">
                  {group.parts.map(
                    ({ id, label, labelEn, description, icon: Icon, accent, href, cta }) => (
                      <button
                        key={`${group.id}-${id}`}
                        onClick={() => router.push(href)}
                        className="group flex min-h-[300px] cursor-pointer flex-col rounded-[8px] border border-[#d8d8d8] bg-white p-6 text-left transition duration-200 hover:-translate-y-1 hover:border-[#080808]"
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

                        <div className="mt-10 space-y-4">
                          <h3 className="text-[30px] leading-[1.04] font-semibold tracking-[-0.04em] text-[#080808]">
                            {label}
                          </h3>
                          <p className="text-sm leading-7 text-[#5a5a5a]">{description}</p>
                        </div>

                        <div className="mt-auto border-t border-[#d8d8d8] pt-5">
                          <span className="inline-flex items-center gap-2 text-sm font-medium text-[#080808] transition-transform duration-200 group-hover:translate-x-1">
                            {cta}
                            <ArrowRight className="size-4 text-[#146ef5]" />
                          </span>
                        </div>
                      </button>
                    ),
                  )}
                </div>
              </section>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
