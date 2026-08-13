import MaterialsBrowser from "@/components/MaterialsBrowser";

export default function HumanitiesMaterialsPage() {
  return (
    <MaterialsBrowser
      subject="humanities"
      backHref="/humanities"
      backLabel="人文科"
      eyebrow="學習資源"
      heading="學習資源下載"
      description="下載人文科的補充教材、工作紙與參考資源。"
      accent="#ed52cb"
      accentSoft="#fdf4fb"
    />
  );
}
