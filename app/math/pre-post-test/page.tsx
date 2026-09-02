import SurveyBrowser from "@/components/SurveyBrowser";

export default function MathPrePostTestPage() {
  return (
    <SurveyBrowser
      subject="math"
      backHref="/math"
      backLabel="數學科"
      heading="數學科前測 / 後測"
    />
  );
}
