import MaterialsBrowser from "@/components/MaterialsBrowser";

export default function ScienceMaterialsPage() {
  return (
    <MaterialsBrowser
      subject="science"
      backHref="/science"
      backLabel="科學科"
      eyebrow="學習資源"
      heading="學習資源下載"
      description="下載科學科的補充教材、工作紙與參考資源。"
      accent="#ff6b00"
      accentSoft="#fff8f2"
    />
  );
}
