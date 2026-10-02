"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import Header from "@/components/Header";

// Self-hosted static map app (public/humanities/heritage-trail-map/).
// Replaces the previous Google Apps Script embed, which is no longer available.
const EMBED_URL = "/humanities/heritage-trail-map/index.html";

export default function HeritageTrailMapPage() {
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
      <Header backHref="/humanities/anti-japanese-war" backLabel="返回抗日戰爭" />

      <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[#f8f7f4]">
        {!loaded && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[#f8f7f4] text-[#5a5a5a]">
            <Loader2 className="size-7 animate-spin text-[#146ef5]" />
            <p className="text-sm">正在載入互動地圖…</p>
          </div>
        )}

        <iframe
          ref={iframeRef}
          src={EMBED_URL}
          title="香港抗戰文物徑互動地圖"
          onLoad={() => setLoaded(true)}
          className="block h-full w-full flex-1 border-0"
          allow="fullscreen"
        />
      </main>
    </>
  );
}
