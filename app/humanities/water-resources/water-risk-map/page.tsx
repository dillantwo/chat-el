import { ExternalLink, Globe2, Info } from "lucide-react";
import Header from "@/components/Header";

// WRI Aqueduct Water Risk Atlas, opened on the baseline annual water-stress
// layer (indicator w_awr_def_tot_cat) so students land on the map the lesson
// asks about instead of the tool's default view.
const MAP_URL =
  "https://aqueduct.wri.org/water-risk-atlas/?scope=baseline&indicator=w_awr_def_tot_cat&timeScale=annual&year=baseline";

// Checked against the live site: every WRI Aqueduct URL (aqueduct.wri.org and
// the older www.wri.org/applications/aqueduct/... path, which now redirects
// here) answers with `X-Frame-Options: SAMEORIGIN`. An <iframe> is therefore
// refused by the browser and renders blank, which is what the previous
// chatbot-generated embed was quietly doing. So this page opens the atlas in a
// new tab and spends its own space on the guidance a P4 student needs first.
const guideSteps: { title: string; detail: string }[] = [
  {
    title: "先看顏色",
    detail: "地圖上顏色越深，代表該地區的水資源壓力越大，用水的需求接近甚至超過可用的水量。",
  },
  {
    title: "放大看香港和中國",
    detail: "找出香港的位置，看看華南一帶的情況，再想一想香港的食水為甚麼要依賴東江水。",
  },
  {
    title: "比一比新加坡",
    detail: "新加坡同樣是沿海的小地方，看看它的水壓力和香港有甚麼不同，再想想它為甚麼要發展新生水和海水淡化。",
  },
  {
    title: "找出最缺水的地方",
    detail: "在世界地圖上找出顏色最深的幾個地區，想一想那裏的人日常生活會遇到甚麼困難。",
  },
];

export default function WaterRiskMapPage() {
  return (
    <>
      <Header backHref="/humanities/water-resources" backLabel="返回水資源" />

      <main className="relative flex flex-1 items-start overflow-y-auto overflow-x-hidden bg-[linear-gradient(180deg,_#fffdf8_0%,_#f8f7f4_48%,_#ffffff_100%)] text-[#080808]">
        <div className="absolute inset-x-0 top-0 h-56 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.12),_transparent_42%)]" />

        <div className="relative mx-auto flex w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="flex w-full flex-col gap-8 py-2">
            <section className="flex flex-col gap-3 px-2 sm:px-0">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-[4px] text-white shadow-[6px_6px_0px_#080808]"
                style={{ backgroundColor: "#10b981" }}
              >
                <Globe2 className="size-5" />
              </div>
              <h1 className="text-[40px] leading-[1.02] font-semibold tracking-[-0.04em] text-[#080808] sm:text-[52px]">
                互動水資源風險地圖
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-[#5a5a5a]">
                這是世界資源研究所（World Resources Institute）製作的 Aqueduct Water Risk
                Atlas，用顏色顯示世界各地的水資源壓力。地圖會在新分頁打開，方便你一邊看地圖，一邊回來這裏對照下面的提示。
              </p>

              <div className="mt-2">
                <a
                  href={MAP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-[4px] bg-[#10b981] px-5 py-3 text-sm font-medium text-white shadow-[6px_6px_0px_#080808] transition duration-200 hover:-translate-y-0.5"
                >
                  <ExternalLink className="size-4" />
                  開啟互動水資源風險地圖
                </a>
              </div>
            </section>

            <section className="grid gap-4 px-2 sm:px-0 sm:grid-cols-2">
              {guideSteps.map(({ title, detail }, index) => (
                <div
                  key={title}
                  className="flex flex-col gap-3 rounded-[8px] border border-[#d8d8d8] bg-white p-6"
                >
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-[4px] bg-[#f8f7f4] text-sm font-semibold text-[#080808]">
                    {index + 1}
                  </span>
                  <h2 className="text-[20px] leading-[1.15] font-semibold tracking-[-0.03em] text-[#080808]">
                    {title}
                  </h2>
                  <p className="text-sm leading-7 text-[#5a5a5a]">{detail}</p>
                </div>
              ))}
            </section>

            <section className="px-2 sm:px-0">
              <div className="flex items-start gap-3 rounded-[8px] border border-[#d8d8d8] bg-white p-5">
                <Info className="mt-0.5 size-4 shrink-0 text-[#146ef5]" />
                <p className="text-sm leading-7 text-[#5a5a5a]">
                  看完地圖有疑問？回到「水資源」頁面，選擇「小水文對話」，就可以把你在地圖上發現的事情拿去問「🥛小水文」。
                </p>
              </div>
            </section>
          </div>
        </div>
      </main>
    </>
  );
}
