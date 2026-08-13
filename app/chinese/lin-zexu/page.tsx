import ChineseTopicChat from "@/components/ChineseTopicChat";

export default function ChineseLinZexuPage() {
  return (
    <ChineseTopicChat
      config={{
        topicId: "lin-zexu",
        topicLabel: "學習林則徐",
        sessionPrefix: "chinese-lin-zexu",
        apiEndpoint: "/api/chinese-topic/lin-zexu",
        icon: "book",
        placeholder: "輸入你的問題…",
        emptyHint: "開始與 AI 對話，學習林則徐。",
        defaultTitle: "學習林則徐對話",
      }}
    />
  );
}
