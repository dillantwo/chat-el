import StaticResourceFrame from "@/components/StaticResourceFrame";
import { defineCopy } from "@/lib/i18n/config";
import { getCopy } from "@/lib/i18n/server";

const COPY = defineCopy({
  "zh-Hant": {
    title: "導航衛星尋寶小遊戲",
    loadingLabel: "正在載入「導航衛星尋寶小遊戲」…",
    backLabel: "返回航天科技",
  },
  en: {
    title: "Navigation Satellite Treasure Hunt",
    loadingLabel: "Loading “Navigation Satellite Treasure Hunt”…",
    backLabel: "Back to Space Technology",
  },
});

export default async function ScienceAerospaceNavigationSatellitePage() {
  const copy = await getCopy(COPY);
  return (
    <StaticResourceFrame
      file="/science/P6_NavigationSatellite_20260814.html"
      title={copy.title}
      loadingLabel={copy.loadingLabel}
      backHref="/science/aerospace"
      backLabel={copy.backLabel}
      showOpenLink={false}
    />
  );
}
