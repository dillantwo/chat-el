import SurveyBrowser from "@/components/SurveyBrowser";
import { defineCopy } from "@/lib/i18n/config";
import { getCopy } from "@/lib/i18n/server";

const COPY = defineCopy({
  "zh-Hant": { backLabel: "人文科", heading: "人文科前測 / 後測" },
  en: { backLabel: "Humanities", heading: "Humanities Pre / Post Test" },
});

export default async function HumanitiesPrePostTestPage() {
  const copy = await getCopy(COPY);
  return (
    <SurveyBrowser
      subject="humanities"
      backHref="/humanities"
      backLabel={copy.backLabel}
      heading={copy.heading}
    />
  );
}
