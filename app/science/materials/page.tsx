import MaterialsBrowser from "@/components/MaterialsBrowser";

export default function ScienceMaterialsPage() {
  return (
    <MaterialsBrowser
      subject="science"
      backHref="/science"
      backLabel="科學科"
      heading="科學科學習資源"
    />
  );
}
