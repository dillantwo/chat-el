import PromptBoard from "@/components/PromptBoard";
import { defineCopy } from "@/lib/i18n/config";
import { getCopy } from "@/lib/i18n/server";

const COPY = defineCopy({
  "zh-Hant": {
    backLabel: "人文科",
    heading: "人文科提示詞",
  },
  en: {
    backLabel: "Humanities",
    heading: "Humanities Prompts",
  },
});

export default async function HumanitiesPromptsPage() {
  const copy = await getCopy(COPY);
  return (
    <PromptBoard
      subject="humanities"
      backHref="/humanities"
      backLabel={copy.backLabel}
      heading={copy.heading}
    />
  );
}
