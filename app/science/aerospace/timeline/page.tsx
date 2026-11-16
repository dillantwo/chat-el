import StaticResourceFrame from "@/components/StaticResourceFrame";
import { defineCopy } from "@/lib/i18n/config";
import { getCopy } from "@/lib/i18n/server";

const COPY = defineCopy({
  "zh-Hant": {
    title: "中國航天大冒險",
    loadingLabel: "正在載入「中國航天大冒險」…",
    backLabel: "返回航天科技",
  },
  en: {
    title: "China Space Adventure",
    loadingLabel: "Loading “China Space Adventure”…",
    backLabel: "Back to Space Technology",
  },
});

export default async function ScienceAerospaceTimelinePage() {
  const copy = await getCopy(COPY);
  return (
    <StaticResourceFrame
      file="/science/P4_AerospaceTimeline_20260814.html"
      title={copy.title}
      loadingLabel={copy.loadingLabel}
      backHref="/science/aerospace"
      backLabel={copy.backLabel}
    />
  );
}
