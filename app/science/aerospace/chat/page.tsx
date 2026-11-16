import ChineseTopicChat from "@/components/ChineseTopicChat";
import { defineCopy } from "@/lib/i18n/config";
import { getCopy } from "@/lib/i18n/server";

const COPY = defineCopy({
  "zh-Hant": {
    topicLabel: "航天科技",
    backLabel: "返回航天科技",
    placeholder: "向小空提問航天科技的問題…",
    emptyHint: "HELLO！我是「小空」(Little Space) 🚀 一起來學習「航天科技」吧！",
    defaultTitle: "航天科技對話",
  },
  en: {
    topicLabel: "Space Technology",
    backLabel: "Back to Space Technology",
    placeholder: "Ask Little Space a question about space technology…",
    emptyHint: "HELLO! I'm Little Space 🚀 Let's learn about space technology together!",
    defaultTitle: "Space Technology chat",
  },
});

export default async function ScienceAerospaceChatPage() {
  const copy = await getCopy(COPY);
  return (
    <ChineseTopicChat
      config={{
        topicId: "science-aerospace",
        topicLabel: copy.topicLabel,
        apiEndpoint: "/api/science-topic/aerospace",
        backHref: "/science/aerospace",
        backLabel: copy.backLabel,
        icon: "book",
        placeholder: copy.placeholder,
        emptyHint: copy.emptyHint,
        defaultTitle: copy.defaultTitle,
      }}
    />
  );
}
