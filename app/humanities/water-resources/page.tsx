import ChineseTopicChat from "@/components/ChineseTopicChat";
import { defineCopy } from "@/lib/i18n/config";
import { getCopy } from "@/lib/i18n/server";

const COPY = defineCopy({
  "zh-Hant": {
    topicLabel: "水資源",
    backLabel: "返回人文科",
    placeholder: "向小水文提問水資源的問題…",
    emptyHint: "HELLO！我是「🥛小水文」(Aqua Buddy) 💧 一起來學習「水資源」及「國家安全」吧！",
    defaultTitle: "水資源對話",
  },
  en: {
    topicLabel: "Water Resources",
    backLabel: "Back to Humanities",
    placeholder: "Ask Aqua Buddy a question about water resources…",
    emptyHint: "HELLO! I'm 🥛 Aqua Buddy 💧 Let's learn about water resources and national security together!",
    defaultTitle: "Water Resources chat",
  },
});

export default async function HumanitiesWaterResourcesPage() {
  const copy = await getCopy(COPY);
  return (
    <ChineseTopicChat
      config={{
        topicId: "humanities-water-resources",
        topicLabel: copy.topicLabel,
        apiEndpoint: "/api/humanities-topic/water-resources",
        backHref: "/humanities",
        backLabel: copy.backLabel,
        icon: "book",
        placeholder: copy.placeholder,
        emptyHint: copy.emptyHint,
        defaultTitle: copy.defaultTitle,
      }}
    />
  );
}
