import MaterialsBrowser from "@/components/MaterialsBrowser";

export default function ChineseMaterialsPage() {
  return (
    <MaterialsBrowser
      subject="chinese"
      backHref="/chinese"
      backLabel="中國語文科"
      eyebrow="學習資源"
      heading="學習資源下載"
      description="下載中國語文科的補充教材、工作紙與參考資源。"
      accent="#7a3dff"
      accentSoft="#f8f5ff"
    />
  );
}
