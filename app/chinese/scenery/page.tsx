import ChineseTopicChat from "@/components/ChineseTopicChat";

export default function ChineseSceneryPage() {
  return (
    <ChineseTopicChat
      config={{
        topicId: "scenery-description",
        topicLabel: "景物描寫",
        sessionPrefix: "chinese-scenery",
        apiEndpoint: "/api/chinese-topic/scenery",
        enableDrafts: true,
        promptPresets: [
          {
            label: "書面語",
            text: "請幫我看看以下作文是否符合書面語寫作規範，以表格形式對比作文使用的口語詞和提供書面詞。",
          },
          {
            label: "點評（初稿）",
            text: "這是一篇五年級學生作文，請點評（優點、亮點、可改進之處、建議等）。",
          },
          {
            label: "顏色詞",
            text: "這是一篇景物描寫的作文，運用了一些顏色詞，請點評這裡的顏色詞運用是否準確和優美？請提出幾個進一步優化的可替代顏色詞。請告知在這段的寫景中，還有哪些地方可以進一步運用顏色詞，如何運用，給出範例句子。",
          },
          {
            label: "擬聲詞",
            text: "這是一篇景物描寫的作文，運用了一些擬聲詞，請點評這裡的擬聲詞運用是否準確和優美？請提出幾個進一步優化的可替代擬聲詞。請告知在這段的寫景中，還有哪些地方可以進一步運用擬聲詞，如何運用，給出範例句子。",
          },
          {
            label: "比喻",
            text: "這是一篇景物描寫的作文，運用了一些比喻法，請點評這裡的比喻是否準確和優美？請提出幾個進一步優化的比喻。請告知在這段的寫景中，還有哪些地方可以進一步運用比喻法，如何運用，給出範例句子。",
          },
          {
            label: "點評（終稿）",
            text: "請幫我評價這篇文分段和整體結構，如有不合適的，請予以修正，並用表格對比。",
          },
        ],
      }}
    />
  );
}
