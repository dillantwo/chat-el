import SurveyBrowser from "@/components/SurveyBrowser";

export default function ChinesePrePostTestPage() {
  return (
    <SurveyBrowser
      subject="chinese"
      backHref="/chinese"
      backLabel="中國語文科"
      heading="中國語文科前測 / 後測"
    />
  );
}
