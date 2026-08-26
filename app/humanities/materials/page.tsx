import MaterialsBrowser from "@/components/MaterialsBrowser";

export default function HumanitiesMaterialsPage() {
  return (
    <MaterialsBrowser
      subject="humanities"
      backHref="/humanities"
      backLabel="人文科"
      heading="人文科學習資源"
    />
  );
}
