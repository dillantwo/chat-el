import ChineseTopicChat from "@/components/ChineseTopicChat";
import { defineCopy } from "@/lib/i18n/config";
import { getCopy } from "@/lib/i18n/server";

const COPY = defineCopy({
  "zh-Hant": {
    topicLabel: "抗日戰爭",
    backLabel: "返回抗日戰爭",
    placeholder: "向抗戰歷史小嚮導提問抗日戰爭的問題…",
    emptyHint:
      "HELLO，我是AI助手「🎖️抗戰歷史小嚮導」！讓我們一起學習「中國人民抗日戰爭」及「香港保衛戰」的歷史吧 🇭🇰✨",
    defaultTitle: "抗日戰爭對話",
  },
  en: {
    topicLabel: "War of Resistance",
    backLabel: "Back to War of Resistance",
    placeholder: "Ask the War History Guide a question about the War of Resistance…",
    emptyHint:
      "HELLO, I'm your AI helper, the 🎖️ War History Guide! Let's learn together about the Chinese People's War of Resistance Against Japan and the Battle of Hong Kong 🇭🇰✨",
    defaultTitle: "War of Resistance chat",
  },
});

export default async function HumanitiesAntiJapaneseWarChatPage() {
  const copy = await getCopy(COPY);
  return (
    <ChineseTopicChat
      config={{
        topicId: "humanities-anti-japanese-war",
        topicLabel: copy.topicLabel,
        apiEndpoint: "/api/humanities-topic/anti-japanese-war",
        backHref: "/humanities/anti-japanese-war",
        backLabel: copy.backLabel,
        icon: "book",
        placeholder: copy.placeholder,
        emptyHint: copy.emptyHint,
        defaultTitle: copy.defaultTitle,
      }}
    />
  );
}
