"use client";

import { useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import Header from "@/components/Header";

const EMBED_URL =
  "https://script.google.com/a/macros/s.eduhk.hk/s/AKfycbyeKw8NFCSkF73JLwqVRvgLu4TdxVkiFvsfoOcHmjreeEFuDNj1a6ZfPe_WUVfPV2pxYQ/exec";

export default function HeritageTrailMapPage() {
  const [loaded, setLoaded] = useState(false);

  return (
    <>
      <Header backHref="/humanities/anti-japanese-war" backLabel="返回抗日戰爭" />

      <main className="flex-1 min-h-0 overflow-y-auto bg-[#f8f7f4]">
        <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:py-8">
          <div className="mb-5">
            <p className="text-[11px] font-semibold uppercase tracking-[1.1px] text-[#ababab]">
              Hong Kong War Relics Trail
            </p>
            <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.03em] sm:text-[34px]">
              香港抗戰文物徑互動地圖 🗺️
            </h1>
            <p className="mt-2 text-sm leading-7 text-[#5a5a5a]">
              在互動地圖上探索香港各處的抗戰歷史遺跡，點擊地點認識背後的故事。
            </p>
          </div>

          <div className="relative overflow-hidden rounded-[10px] border border-[#d8d8d8] bg-white shadow-[6px_6px_0px_#080808]">
            {!loaded && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-white text-[#5a5a5a]">
                <Loader2 className="size-7 animate-spin text-[#146ef5]" />
                <p className="text-sm">正在載入互動地圖…</p>
              </div>
            )}
            <iframe
              src={EMBED_URL}
              title="香港抗戰文物徑互動地圖"
              onLoad={() => setLoaded(true)}
              className="block h-[70vh] min-h-[600px] w-full border-0"
              allowFullScreen
            />
          </div>

          <div className="mt-3 flex justify-end">
            <a
              href={EMBED_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-[#d8d8d8] bg-white px-3 py-1.5 text-xs font-medium text-[#5a5a5a] transition hover:border-[#080808] hover:text-[#080808]"
            >
              <ExternalLink className="size-3.5" />
              在新分頁開啟
            </a>
          </div>
        </div>

        {/* Academic references footer (provided by content author, AIDCEC EdUHK) */}
        <footer
          style={{
            backgroundColor: "#111827",
            color: "#9ca3af",
            padding: "48px 20px",
            textAlign: "center",
            borderTop: "1px solid #1f2937",
            marginTop: 20,
          }}
        >
          <div style={{ maxWidth: 896, margin: "0 auto", textAlign: "left" }}>
            <h5
              style={{
                color: "#ffffff",
                fontWeight: "bold",
                marginBottom: 16,
                borderBottom: "1px solid #374151",
                paddingBottom: 8,
                fontSize: "1.1em",
              }}
            >
              內容參考與引述來源 (Academic References)
            </h5>
            <ul
              style={{
                fontSize: 12,
                lineHeight: 1.6,
                listStyleType: "disc",
                paddingLeft: 20,
                marginBottom: 32,
              }}
            >
              <li style={{ marginBottom: 8 }}>
                <strong>
                  香港政府中國人民抗日戰爭暨世界反法西斯戰爭勝利80周年網頁 (2025)
                </strong>
                。〈香港中共抗戰遺址〉。檢索自{" "}
                <a
                  style={{ color: "#60a5fa", textDecoration: "underline" }}
                  href="https://www.80avictory.gov.hk/tc/site.html"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  https://www.80avictory.gov.hk/tc/site.html
                </a>
              </li>
              <li style={{ marginBottom: 8 }}>
                <strong>維基百科 (2025)</strong>。〈潘屋〉。檢索自{" "}
                <a
                  style={{ color: "#60a5fa", textDecoration: "underline" }}
                  href="https://zh.wikipedia.org/zh-tw/%E6%BD%98%E5%B1%8B"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  https://zh.wikipedia.org/zh-tw/%E6%BD%98%E5%B1%8B
                </a>
              </li>
            </ul>
            <div
              style={{
                borderTop: "1px solid #1f2937",
                paddingTop: 32,
                marginTop: 32,
                textAlign: "center",
              }}
            >
              <p style={{ fontSize: 10, marginBottom: 8, color: "#9ca3af" }}>
                本網頁及資源由香港教育大學人工智能及數碼能力教育中心（AIDCEC）團隊設計，旨在支援小學人文學科的學習。
              </p>
              <p style={{ fontSize: 10, fontWeight: "bold", color: "#d1d5db" }}>
                © AIDCEC EdUHK
              </p>
            </div>
          </div>
        </footer>
      </main>
    </>
  );
}
