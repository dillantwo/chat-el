"use client";

import { useRouter } from "next/navigation";
import { BookOpenText, Map, MessageCircle, Podcast, ArrowRight, Swords } from "lucide-react";
import Header from "@/components/Header";
import { useCopy } from "@/components/LocaleProvider";
import { defineCopy } from "@/lib/i18n/config";

type PartId = "hong-kong-history" | "heritage-trail-map" | "podcast" | "chat";

type PartText = { label: string; description: string; cta: string };

const COPY = defineCopy({
  "zh-Hant": {
    backLabel: "返回人文科",
    heading: "抗日戰爭",
    intro:
      "這個主題分成幾個部分：先透過互動網頁「認識香港歷史」了解抗戰時期香港的故事，用「香港抗戰文物徑互動地圖」探索身邊的歷史遺跡，錄製你自己的「語音播客」講述抗戰故事，也可以隨時與「抗戰歷史小嚮導」聊天，深入探索你感興趣的問題。",
    parts: {
      "hong-kong-history": {
        label: "認識香港歷史",
        description:
          "以互動網頁走進抗戰時期的香港：香港淪陷、三年零八個月的生活、抗戰小英雄與身邊的歷史遺跡。",
        cta: "開始閱讀",
      },
      "heritage-trail-map": {
        label: "香港抗戰文物徑互動地圖",
        description:
          "在互動地圖上探索香港各處的抗戰歷史遺跡，點擊地點認識背後的故事與意義。",
        cta: "開始探索",
      },
      podcast: {
        label: "創建語音播客 (Podcast)",
        description:
          "當一次播客主持人，用你的聲音講述抗戰的故事，錄音會儲存起來，隨時可以重聽。",
        cta: "開始錄製",
      },
      chat: {
        label: "抗戰歷史小嚮導",
        description:
          "跟著「🎖️抗戰歷史小嚮導」對話，隨時提問「中國人民抗日戰爭」及「香港保衛戰」的歷史問題。",
        cta: "開始對話",
      },
    } as Record<PartId, PartText>,
  },
  en: {
    backLabel: "Back to Humanities",
    heading: "War of Resistance",
    intro:
      "This topic has a few parts. Start with the interactive “Hong Kong in the War” pages to learn what happened in Hong Kong during the war. Explore historic sites near you on the War Relics Trail Map, and record your own voice podcast to tell a story from the war. You can also chat with the War History Guide at any time to explore the questions you are curious about.",
    parts: {
      "hong-kong-history": {
        label: "Hong Kong in the War",
        description:
          "Step into wartime Hong Kong through interactive pages: the fall of Hong Kong, life during the Three Years and Eight Months, young war heroes and historic sites near you.",
        cta: "Start reading",
      },
      "heritage-trail-map": {
        label: "Hong Kong War Relics Trail Map",
        description:
          "Explore wartime historic sites all over Hong Kong on an interactive map. Tap a place to learn the story behind it and why it matters.",
        cta: "Start exploring",
      },
      podcast: {
        label: "Make a Voice Podcast",
        description:
          "Be a podcast host and tell a story from the war in your own voice. Your recordings are saved, so you can listen again any time.",
        cta: "Start recording",
      },
      chat: {
        label: "War History Guide",
        description:
          "Chat with the 🎖️ War History Guide and ask questions any time about the Chinese People's War of Resistance Against Japan and the Battle of Hong Kong.",
        cta: "Start chatting",
      },
    },
  },
});

const parts: {
  id: PartId;
  labelEn: string;
  icon: typeof BookOpenText;
  accent: string;
  href: string;
}[] = [
  {
    id: "hong-kong-history",
    labelEn: "Hong Kong in the War",
    icon: BookOpenText,
    accent: "#146ef5",
    href: "/humanities/anti-japanese-war/hong-kong-history",
  },
  {
    id: "heritage-trail-map",
    labelEn: "War Relics Trail Map",
    icon: Map,
    accent: "#10b981",
    href: "/humanities/anti-japanese-war/heritage-trail-map",
  },
  {
    id: "podcast",
    labelEn: "Voice Podcast",
    icon: Podcast,
    accent: "#f59e0b",
    href: "/humanities/anti-japanese-war/podcast",
  },
  {
    id: "chat",
    labelEn: "History Chatbot",
    icon: MessageCircle,
    // Purple, not the topic's red: the four cards' colours only exist to tell
    // the parts apart, and a card wearing the topic colour reads as "the topic"
    // rather than as one part of it.
    accent: "#7a3dff",
    href: "/humanities/anti-japanese-war/chat",
  },
];

export default function HumanitiesAntiJapaneseWarLandingPage() {
  const router = useRouter();
  const copy = useCopy(COPY);

  return (
    <>
      <Header backHref="/humanities" backLabel={copy.backLabel} />

      <main className="relative flex flex-1 items-start overflow-y-auto overflow-x-hidden bg-[linear-gradient(180deg,_#fffdf8_0%,_#f8f7f4_48%,_#ffffff_100%)] text-[#080808]">
        <div className="absolute inset-x-0 top-0 h-56 bg-[radial-gradient(circle_at_top,_rgba(20,110,245,0.12),_transparent_42%)]" />
        <div className="absolute right-0 top-24 h-56 w-56 translate-x-1/4 rounded-full bg-[#c1121f]/8 blur-3xl" />

        <div className="relative mx-auto flex w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="flex w-full flex-col gap-8 py-2">
            <section className="flex flex-col gap-3 px-2 sm:px-0">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-[4px] text-white shadow-[6px_6px_0px_#080808]"
                // The topic's own colour, matching its card on 人文科.
                style={{ backgroundColor: "#c1121f" }}
              >
                <Swords className="size-5" />
              </div>
              <h1 className="text-[40px] leading-[1.02] font-semibold tracking-[-0.04em] text-[#080808] sm:text-[52px]">
                {copy.heading}
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-[#5a5a5a]">{copy.intro}</p>
            </section>

            <section className="grid gap-4 px-2 sm:px-0 sm:grid-cols-2 lg:grid-cols-3">
              {parts.map(({ id, labelEn, icon: Icon, accent, href }) => {
                const { label, description, cta } = copy.parts[id];
                return (
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
                      {/* In English mode the eyebrow would repeat the title. */}
                      {labelEn.toLowerCase() !== label.toLowerCase() && (
                        <span className="text-[11px] font-semibold uppercase tracking-[1.1px] text-[#ababab]">
                          {labelEn}
                        </span>
                      )}
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
                );
              })}
            </section>
          </div>
        </div>
      </main>
    </>
  );
}
