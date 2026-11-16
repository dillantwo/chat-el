import ChineseTopicChat from "@/components/ChineseTopicChat";
import { defineCopy } from "@/lib/i18n/config";
import { getCopy } from "@/lib/i18n/server";

const COPY = defineCopy({
  "zh-Hant": {
    topicLabel: "電力及電路",
    backLabel: "返回科學科",
    placeholder: "向小科提問電力及電路的問題…",
    emptyHint: "嗨！我是小科 ⚡️ 一起來學習電力及電路吧！",
    defaultTitle: "電力及電路對話",
  },
  en: {
    topicLabel: "Electricity and Circuits",
    backLabel: "Back to Science",
    placeholder: "Ask Little Science a question about electricity and circuits…",
    emptyHint: "Hi! I'm Little Science ⚡️ Let's learn about electricity and circuits together!",
    defaultTitle: "Electricity and Circuits chat",
  },
});

export default async function ScienceCircuitPage() {
  const copy = await getCopy(COPY);
  return (
    <ChineseTopicChat
      config={{
        topicId: "science-circuit",
        topicLabel: copy.topicLabel,
        apiEndpoint: "/api/science-topic/circuit",
        backHref: "/science",
        backLabel: copy.backLabel,
        icon: "book",
        placeholder: copy.placeholder,
        emptyHint: copy.emptyHint,
        defaultTitle: copy.defaultTitle,
      }}
    />
  );
}
