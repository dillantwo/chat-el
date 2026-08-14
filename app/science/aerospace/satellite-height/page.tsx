import StaticResourceFrame from "@/components/StaticResourceFrame";

export default function ScienceAerospaceSatelliteHeightPage() {
  return (
    <StaticResourceFrame
      file="/science/P6_SatelliteHeight_20260814.html"
      title="不同高度軌道的衛星"
      loadingLabel="正在載入「不同高度軌道的衛星」…"
      backHref="/science/aerospace"
      backLabel="返回航天科技"
    />
  );
}
