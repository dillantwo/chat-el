import ChineseTopicChat from "@/components/ChineseTopicChat";

export default function ScienceAerospaceChatPage() {
  return (
    <ChineseTopicChat
      config={{
        topicId: "science-aerospace",
        topicLabel: "航天科技",
        apiEndpoint: "/api/science-topic/aerospace",
        backHref: "/science/aerospace",
        backLabel: "返回航天科技",
        icon: "book",
        placeholder: "向小空提問航天科技的問題…",
        emptyHint: "HELLO！我是「小空」(Little Space) 🚀 一起來學習「航天科技」吧！",
        defaultTitle: "航天科技對話",
      }}
    />
  );
}
