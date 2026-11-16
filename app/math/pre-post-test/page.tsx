import SurveyBrowser from "@/components/SurveyBrowser";
import { defineCopy } from "@/lib/i18n/config";
import { getCopy } from "@/lib/i18n/server";

const COPY = defineCopy({
  "zh-Hant": {
    backLabel: "數學科",
    heading: "數學科前測 / 後測",
  },
  en: {
    backLabel: "Mathematics",
    heading: "Maths Pre / Post Test",
  },
});

export default async function MathPrePostTestPage() {
  const copy = await getCopy(COPY);
  return (
    <SurveyBrowser
      subject="math"
      backHref="/math"
      backLabel={copy.backLabel}
      heading={copy.heading}
    />
  );
}
