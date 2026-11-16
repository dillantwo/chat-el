import StaticResourceFrame from "@/components/StaticResourceFrame";
import { defineCopy } from "@/lib/i18n/config";
import { getCopy } from "@/lib/i18n/server";

const COPY = defineCopy({
  "zh-Hant": {
    title: "火星探測任務：火箭發射與降落挑戰",
    loadingLabel: "正在載入「火星探測任務」…",
    backLabel: "返回航天科技",
  },
  en: {
    title: "Mars Mission: Rocket Launch and Landing Challenge",
    loadingLabel: "Loading “Mars Mission Challenge”…",
    backLabel: "Back to Space Technology",
  },
});

export default async function ScienceAerospaceMarsMissionPage() {
  const copy = await getCopy(COPY);
  return (
    <StaticResourceFrame
      file="/science/P6_MarsMission_20260814.html"
      title={copy.title}
      loadingLabel={copy.loadingLabel}
      backHref="/science/aerospace"
      backLabel={copy.backLabel}
    />
  );
}
