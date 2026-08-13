import MaterialsBrowser from "@/components/MaterialsBrowser";

export default function EnglishMaterialsPage() {
  return (
    <MaterialsBrowser
      subject="english"
      backHref="/english"
      backLabel="English"
      eyebrow="Learning Materials"
      heading="學習資源下載"
      description="下載英文科的補充教材、工作紙與參考資源。"
      accent="#16a34a"
      accentSoft="#f6faf7"
      expandAllLabel="Expand all"
      collapseAllLabel="Collapse all"
    />
  );
}
