import ChineseTopicChat from "@/components/ChineseTopicChat";

export default function ScienceCircuitPage() {
  return (
    <ChineseTopicChat
      config={{
        topicId: "science-circuit",
        topicLabel: "電力及電路",
        sessionPrefix: "science-circuit",
        apiEndpoint: "/api/science-topic/circuit",
        backHref: "/science",
        backLabel: "返回科學科",
        icon: "book",
        placeholder: "向小科提問電力及電路的問題…",
        emptyHint: "嗨！我是小科 ⚡️ 一起來學習電力及電路吧！",
        defaultTitle: "電力及電路對話",
      }}
    />
  );
}
