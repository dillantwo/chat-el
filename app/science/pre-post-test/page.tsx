import SurveyBrowser from "@/components/SurveyBrowser";

export default function SciencePrePostTestPage() {
  return (
    <SurveyBrowser
      subject="science"
      backHref="/science"
      backLabel="科學科"
      heading="科學科前測 / 後測"
    />
  );
}
