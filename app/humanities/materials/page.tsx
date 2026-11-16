import MaterialsBrowser from "@/components/MaterialsBrowser";
import { defineCopy } from "@/lib/i18n/config";
import { getCopy } from "@/lib/i18n/server";

const COPY = defineCopy({
  "zh-Hant": { backLabel: "人文科", heading: "人文科學習資源" },
  en: { backLabel: "Humanities", heading: "Humanities Learning Materials" },
});

export default async function HumanitiesMaterialsPage() {
  const copy = await getCopy(COPY);
  return (
    <MaterialsBrowser
      subject="humanities"
      backHref="/humanities"
      backLabel={copy.backLabel}
      heading={copy.heading}
    />
  );
}
