import ChineseTopicChat from "@/components/ChineseTopicChat";

export default function ScienceAerospacePage() {
  return (
    <ChineseTopicChat
      config={{
        topicId: "science-aerospace",
        topicLabel: "航天科技",
        sessionPrefix: "science-aerospace",
        apiEndpoint: "/api/science-topic/aerospace",
        backHref: "/science",
        backLabel: "返回科學科",
        icon: "book",
        placeholder: "向小空提問航天科技的問題…",
        emptyHint: "HELLO！我是「小空」(Little Space) 🚀 一起來學習「航天科技」吧！",
        defaultTitle: "航天科技對話",
      }}
    />
  );
}
