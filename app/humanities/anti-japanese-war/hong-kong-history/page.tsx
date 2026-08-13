"use client";

import { useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import Header from "@/components/Header";

const EMBED_URL =
  "https://script.google.com/a/macros/s.eduhk.hk/s/AKfycbz2hophOgaHh-MfGcJCjGrM7Igtkz56f-NmoeSGtY7PYWYL_2qNXsHB0cDAkqpsgSdIHw/exec";

export default function HongKongHistoryLearningPage() {
  const [loaded, setLoaded] = useState(false);

  return (
    <>
      <Header backHref="/humanities/anti-japanese-war" backLabel="返回抗日戰爭" />

      <main className="relative flex flex-1 min-h-0 flex-col bg-[#f8f7f4]">
        {!loaded && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[#f8f7f4] text-[#5a5a5a]">
            <Loader2 className="size-7 animate-spin text-[#146ef5]" />
            <p className="text-sm">正在載入「認識香港歷史」…</p>
          </div>
        )}

        <iframe
          src={EMBED_URL}
          title="認識香港歷史"
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
          在新分頁開啟
        </a>
      </main>
    </>
  );
}
