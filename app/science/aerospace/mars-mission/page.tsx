import StaticResourceFrame from "@/components/StaticResourceFrame";

export default function ScienceAerospaceMarsMissionPage() {
  return (
    <StaticResourceFrame
      file="/science/P6_MarsMission_20260814.html"
      title="火星探測任務：火箭發射與降落挑戰"
      loadingLabel="正在載入「火星探測任務」…"
      backHref="/science/aerospace"
      backLabel="返回航天科技"
    />
  );
}
