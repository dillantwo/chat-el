import SurveyBrowser from "@/components/SurveyBrowser";

export default function EnglishPrePostTestPage() {
  return (
    <SurveyBrowser
      subject="english"
      backHref="/english"
      backLabel="English"
      heading="Pre-test & Post-test"
      lang="en"
    />
  );
}
