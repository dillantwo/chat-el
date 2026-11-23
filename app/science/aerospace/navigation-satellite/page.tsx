import StaticResourceFrame from "@/components/StaticResourceFrame";
import { defineCopy } from "@/lib/i18n/config";
import { getCopy } from "@/lib/i18n/server";

// The game is written in one language, so each locale has its own copy of the file;
// keep the two in step.
const COPY = defineCopy({
  "zh-Hant": {
    file: "/science/P6_NavigationSatellite_20260814.html",
    title: "導航衛星尋寶小遊戲",
    loadingLabel: "正在載入「導航衛星尋寶小遊戲」…",
    backLabel: "返回航天科技",
  },
  en: {
    file: "/science/P6_NavigationSatellite_20260814-en.html",
    title: "Navigation Satellite Treasure Hunt",
    loadingLabel: "Loading “Navigation Satellite Treasure Hunt”…",
    backLabel: "Back to Space Technology",
  },
});

export default async function ScienceAerospaceNavigationSatellitePage() {
  const copy = await getCopy(COPY);
  return (
    <StaticResourceFrame
      file={copy.file}
      title={copy.title}
      loadingLabel={copy.loadingLabel}
      backHref="/science/aerospace"
      backLabel={copy.backLabel}
    />
  );
}
