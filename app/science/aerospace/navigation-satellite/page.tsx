import StaticResourceFrame from "@/components/StaticResourceFrame";

export default function ScienceAerospaceNavigationSatellitePage() {
  return (
    <StaticResourceFrame
      file="/science/P6_NavigationSatellite_20260814.html"
      title="導航衛星尋寶小遊戲"
      loadingLabel="正在載入「導航衛星尋寶小遊戲」…"
      backHref="/science/aerospace"
      backLabel="返回航天科技"
    />
  );
}
