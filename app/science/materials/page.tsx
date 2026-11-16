import MaterialsBrowser from "@/components/MaterialsBrowser";
import { defineCopy } from "@/lib/i18n/config";
import { getCopy } from "@/lib/i18n/server";

const COPY = defineCopy({
  "zh-Hant": { backLabel: "科學科", heading: "科學科學習資源" },
  en: { backLabel: "Science", heading: "Science Learning Materials" },
});

export default async function ScienceMaterialsPage() {
  const copy = await getCopy(COPY);
  return (
    <MaterialsBrowser
      subject="science"
      backHref="/science"
      backLabel={copy.backLabel}
      heading={copy.heading}
    />
  );
}
