"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import Header from "@/components/Header";
import { useCopy } from "@/components/LocaleProvider";
import { defineCopy } from "@/lib/i18n/config";

// Self-hosted static map app (public/humanities/heritage-trail-map/).
// Replaces the previous Google Apps Script embed, which is no longer available.
// index.html is the Chinese edition and index-en.html the English one; they share
// app.js, the styles and the photos, and differ only in their text files.

const COPY = defineCopy({
  "zh-Hant": {
    embedUrl: "/humanities/heritage-trail-map/index.html",
    backLabel: "返回抗日戰爭",
    loading: "正在載入互動地圖…",
    frameTitle: "香港抗戰文物徑互動地圖",
  },
  en: {
    embedUrl: "/humanities/heritage-trail-map/index-en.html",
    backLabel: "Back to War of Resistance",
    loading: "Loading the interactive map…",
    frameTitle: "Hong Kong War Relics Trail Map",
  },
});

export default function HeritageTrailMapPage() {
  const copy = useCopy(COPY);
  const [loaded, setLoaded] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // The map is served from our own origin, so it often finishes loading before
  // React hydrates and the onLoad handler is attached. Check the readyState once
  // on mount so the overlay never gets stuck on a frame that is already up.
  useEffect(() => {
    const frame = iframeRef.current;
    if (!frame) return;

    let settled = false;
    const markLoaded = () => {
      settled = true;
      setLoaded(true);
    };

    try {
      if (frame.contentDocument?.readyState === "complete") {
        markLoaded();
        return;
      }
    } catch {
      // Cross-origin frame: fall back to the timer below.
    }

    frame.addEventListener("load", markLoaded);
    const fallback = window.setTimeout(() => {
      if (!settled) setLoaded(true);
    }, 8000);

    return () => {
      frame.removeEventListener("load", markLoaded);
      window.clearTimeout(fallback);
    };
  }, []);

  // No page chrome around the frame: the map app carries its own title bar,
  // district legend, list panel and "關於" dialog (which holds the source and
  // credit notes), so a heading and a footer here only stole vertical space and
  // forced the whole page to scroll. `body` is `h-full flex flex-col
  // overflow-hidden`, so `flex-1 min-h-0` makes the frame fill exactly what is
  // left under the header at any viewport size.
  return (
    <>
      <Header backHref="/humanities/anti-japanese-war" backLabel={copy.backLabel} />

      <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[#f8f7f4]">
        {!loaded && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[#f8f7f4] text-[#5a5a5a]">
            <Loader2 className="size-7 animate-spin text-[#146ef5]" />
            <p className="text-sm">{copy.loading}</p>
          </div>
        )}

        <iframe
          ref={iframeRef}
          src={copy.embedUrl}
          title={copy.frameTitle}
          onLoad={() => setLoaded(true)}
          className="block h-full w-full flex-1 border-0"
          allow="fullscreen"
        />
      </main>
    </>
  );
}
