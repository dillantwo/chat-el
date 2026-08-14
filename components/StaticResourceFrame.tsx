"use client";

import { useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import Header from "@/components/Header";
import { basePath } from "@/lib/utils";

// Full-page viewer for the self-contained interactive HTML resources that ship
// under public/ (e.g. public/science/*.html). Same shape as the 抗日戰爭 embeds,
// except the source is a bundled file rather than an Apps Script URL, so the
// path needs the deployment basePath prepended by hand — Next only rewrites
// next/link, next/image and the router, not raw iframe src strings.
export default function StaticResourceFrame({
  file,
  title,
  loadingLabel,
  backHref,
  backLabel,
}: {
  /** Path under public/, starting with a slash, e.g. "/science/foo.html". */
  file: string;
  title: string;
  loadingLabel: string;
  backHref: string;
  backLabel: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const src = `${basePath}${file}`;

  return (
    <>
      <Header backHref={backHref} backLabel={backLabel} />

      <main className="relative flex flex-1 min-h-0 flex-col bg-[#f8f7f4]">
        {!loaded && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[#f8f7f4] text-[#5a5a5a]">
            <Loader2 className="size-7 animate-spin text-[#146ef5]" />
            <p className="text-sm">{loadingLabel}</p>
          </div>
        )}

        <iframe
          src={src}
          title={title}
          onLoad={() => setLoaded(true)}
          className="h-full w-full flex-1 border-0"
          allow="fullscreen"
          allowFullScreen
        />

        <a
          href={src}
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
