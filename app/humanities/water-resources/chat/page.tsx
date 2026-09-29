import ChineseTopicChat from "@/components/ChineseTopicChat";

export default function HumanitiesWaterResourcesChatPage() {
  return (
    <ChineseTopicChat
      config={{
        topicId: "humanities-water-resources",
        topicLabel: "水資源",
        apiEndpoint: "/api/humanities-topic/water-resources",
        backHref: "/humanities/water-resources",
        backLabel: "返回水資源",
        icon: "book",
        placeholder: "向小水文提問水資源的問題…",
        emptyHint: "HELLO！我是「🥛小水文」(Aqua Buddy) 💧 一起來學習「水資源」及「國家安全」吧！",
        defaultTitle: "水資源對話",
      }}
    />
  );
}
