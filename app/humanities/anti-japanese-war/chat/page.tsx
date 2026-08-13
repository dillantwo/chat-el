import ChineseTopicChat from "@/components/ChineseTopicChat";

export default function HumanitiesAntiJapaneseWarChatPage() {
  return (
    <ChineseTopicChat
      config={{
        topicId: "humanities-anti-japanese-war",
        topicLabel: "抗日戰爭",
        sessionPrefix: "humanities-anti-japanese-war",
        apiEndpoint: "/api/humanities-topic/anti-japanese-war",
        backHref: "/humanities/anti-japanese-war",
        backLabel: "返回抗日戰爭",
        icon: "book",
        placeholder: "向抗戰歷史小嚮導提問抗日戰爭的問題…",
        emptyHint:
          "HELLO，我是AI助手「🎖️抗戰歷史小嚮導」！讓我們一起學習「中國人民抗日戰爭」及「香港保衛戰」的歷史吧 🇭🇰✨",
        defaultTitle: "抗日戰爭對話",
      }}
    />
  );
}
