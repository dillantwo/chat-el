import StaticResourceFrame from "@/components/StaticResourceFrame";
import { defineCopy } from "@/lib/i18n/config";
import { getCopy } from "@/lib/i18n/server";

const COPY = defineCopy({
  "zh-Hant": {
    title: "不同高度軌道的衛星",
    loadingLabel: "正在載入「不同高度軌道的衛星」…",
    backLabel: "返回航天科技",
  },
  en: {
    title: "Satellites at Different Orbit Heights",
    loadingLabel: "Loading “Satellites at Different Orbit Heights”…",
    backLabel: "Back to Space Technology",
  },
});

export default async function ScienceAerospaceSatelliteHeightPage() {
  const copy = await getCopy(COPY);
  return (
    <StaticResourceFrame
      file="/science/P6_SatelliteHeight_20260814.html"
      title={copy.title}
      loadingLabel={copy.loadingLabel}
      backHref="/science/aerospace"
      backLabel={copy.backLabel}
    />
  );
}
