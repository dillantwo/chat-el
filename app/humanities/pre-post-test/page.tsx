import SurveyBrowser from "@/components/SurveyBrowser";

export default function HumanitiesPrePostTestPage() {
  return (
    <SurveyBrowser
      subject="humanities"
      backHref="/humanities"
      backLabel="人文科"
      heading="人文科前測 / 後測"
    />
  );
}
