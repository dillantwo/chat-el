import MaterialsBrowser from "@/components/MaterialsBrowser";

export default function MathMaterialsPage() {
  return (
    <MaterialsBrowser
      subject="math"
      backHref="/math"
      backLabel="數學科"
      eyebrow="學習資源"
      heading="學習資源下載"
      description="下載數學科的補充教材、工作紙與參考資源。"
      accent="#146ef5"
      accentSoft="#f4f8ff"
    />
  );
}
