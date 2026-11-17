import PromptBoard from "@/components/PromptBoard";
import { defineCopy } from "@/lib/i18n/config";
import { getCopy } from "@/lib/i18n/server";

const COPY = defineCopy({
  "zh-Hant": {
    backLabel: "科學科",
    heading: "科學科提示詞",
  },
  en: {
    backLabel: "Science",
    heading: "Science Prompts",
  },
});

export default async function SciencePromptsPage() {
  const copy = await getCopy(COPY);
  return (
    <PromptBoard
      subject="science"
      backHref="/science"
      backLabel={copy.backLabel}
      heading={copy.heading}
    />
  );
}
