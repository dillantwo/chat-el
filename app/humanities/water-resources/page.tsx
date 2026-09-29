"use client";

import { useRouter } from "next/navigation";
import { ArrowRight, Droplets, Globe2, MessageCircle } from "lucide-react";
import Header from "@/components/Header";

const parts: {
  id: string;
  label: string;
  labelEn: string;
  description: string;
  icon: typeof Globe2;
  accent: string;
  href: string;
  cta: string;
}[] = [
  {
    id: "water-risk-map",
    label: "互動水資源風險地圖",
    labelEn: "Water Risk Atlas",
    description:
      "打開世界水資源風險地圖，看看哪些地方的水資源最緊張，放大到香港、中國和新加坡，比較不同地方的水壓力。",
    icon: Globe2,
    accent: "#10b981",
    href: "/humanities/water-resources/water-risk-map",
    cta: "開始探索",
  },
  {
    id: "chat",
    label: "小水文對話",
    labelEn: "Water Chatbot",
    description:
      "跟著「🥛小水文」對話，隨時提問水循環、香港食水來源、東江水及國家安全的問題。",
    icon: MessageCircle,
    // Purple, not the topic's blue: the cards' colours only exist to tell the
    // parts apart, and a card wearing the topic colour reads as "the topic"
    // rather than as one part of it.
    accent: "#7a3dff",
    href: "/humanities/water-resources/chat",
    cta: "開始對話",
  },
];

export default function HumanitiesWaterResourcesLandingPage() {
  const router = useRouter();

  return (
    <>
      <Header backHref="/humanities" backLabel="返回人文科" />

      <main className="relative flex flex-1 items-start overflow-y-auto overflow-x-hidden bg-[linear-gradient(180deg,_#fffdf8_0%,_#f8f7f4_48%,_#ffffff_100%)] text-[#080808]">
        <div className="absolute inset-x-0 top-0 h-56 bg-[radial-gradient(circle_at_top,_rgba(20,110,245,0.12),_transparent_42%)]" />
        <div className="absolute right-0 top-24 h-56 w-56 translate-x-1/4 rounded-full bg-[#146ef5]/8 blur-3xl" />

        <div className="relative mx-auto flex w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="flex w-full flex-col gap-8 py-2">
            <section className="flex flex-col gap-3 px-2 sm:px-0">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-[4px] text-white shadow-[6px_6px_0px_#080808]"
                // The topic's own colour, matching its card on 人文科.
                style={{ backgroundColor: "#146ef5" }}
              >
                <Droplets className="size-5" />
              </div>
              <h1 className="text-[40px] leading-[1.02] font-semibold tracking-[-0.04em] text-[#080808] sm:text-[52px]">
                水資源
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-[#5a5a5a]">
                這個主題分成兩個部分：用「互動水資源風險地圖」看看世界各地的水資源壓力，也可以隨時與「🥛小水文」聊天，認識水循環、香港食水來源、東江水及國家安全等課題。
              </p>
            </section>

            <section className="grid gap-4 px-2 sm:px-0 sm:grid-cols-2">
              {parts.map(({ id, label, labelEn, description, icon: Icon, accent, href, cta }) => (
                <button
                  key={id}
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
                    <h2 className="text-[30px] leading-[1.04] font-semibold tracking-[-0.04em] text-[#080808]">
                      {label}
                    </h2>
                    <p className="text-sm leading-7 text-[#5a5a5a]">{description}</p>
                  </div>

                  <div className="mt-auto border-t border-[#d8d8d8] pt-5">
                    <span className="inline-flex items-center gap-2 text-sm font-medium text-[#080808] transition-transform duration-200 group-hover:translate-x-1">
                      {cta}
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
