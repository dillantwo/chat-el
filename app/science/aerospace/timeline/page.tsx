import StaticResourceFrame from "@/components/StaticResourceFrame";

export default function ScienceAerospaceTimelinePage() {
  return (
    <StaticResourceFrame
      file="/science/P4_AerospaceTimeline_20260814.html"
      title="中國航天大冒險"
      loadingLabel="正在載入「中國航天大冒險」…"
      backHref="/science/aerospace"
      backLabel="返回航天科技"
    />
  );
}
