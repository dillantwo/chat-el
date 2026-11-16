"use client";

import { useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import Header from "@/components/Header";
import { useCopy } from "@/components/LocaleProvider";
import { defineCopy } from "@/lib/i18n/config";

// Served straight out of public/ instead of the old Apps Script deployment:
// the page is a static self-contained document, so hosting it locally drops the
// third-party round trip and the Google sign-in prompt students used to hit.
const EMBED_URL = "/humanities/humanities-war.html";

const COPY = defineCopy({
  "zh-Hant": {
    backLabel: "返回抗日戰爭",
    loading: "正在載入「認識香港歷史」…",
    frameTitle: "認識香港歷史",
    openInNewTab: "在新分頁開啟",
  },
  en: {
    backLabel: "Back to War of Resistance",
    loading: "Loading “Hong Kong in the War”…",
    frameTitle: "Hong Kong in the War",
    openInNewTab: "Open in new tab",
  },
});

export default function HongKongHistoryLearningPage() {
  const copy = useCopy(COPY);
  const [loaded, setLoaded] = useState(false);

  return (
    <>
      <Header backHref="/humanities/anti-japanese-war" backLabel={copy.backLabel} />

      <main className="relative flex flex-1 min-h-0 flex-col bg-[#f8f7f4]">
        {!loaded && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[#f8f7f4] text-[#5a5a5a]">
            <Loader2 className="size-7 animate-spin text-[#146ef5]" />
            <p className="text-sm">{copy.loading}</p>
          </div>
        )}

        <iframe
          src={EMBED_URL}
          title={copy.frameTitle}
          onLoad={() => setLoaded(true)}
          className="h-full w-full flex-1 border-0"
          allow="fullscreen"
        />

        <a
          href={EMBED_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute bottom-4 right-4 z-20 inline-flex items-center gap-1.5 rounded-full border border-[#d8d8d8] bg-white/90 px-3 py-1.5 text-xs font-medium text-[#5a5a5a] shadow-sm backdrop-blur transition hover:border-[#080808] hover:text-[#080808]"
        >
          <ExternalLink className="size-3.5" />
          {copy.openInNewTab}
        </a>
      </main>
    </>
  );
}
