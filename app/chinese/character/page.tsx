import ChineseTopicChat from "@/components/ChineseTopicChat";

export default function ChineseCharacterPage() {
  return (
    <ChineseTopicChat
      config={{
        topicId: "character-description",
        topicLabel: "人物描寫",
        apiEndpoint: "/api/chinese-topic/character",
        emptyHint: "歡迎來到人物描寫寫作練習！請選擇你要進行的模式：",
        quickStartOptions: [
          { label: "1. 段落描寫", message: "段落描寫" },
          { label: "2. 文章描寫", message: "文章描寫" },
          { label: "3. 構思建議", message: "構思建議" },
        ],
        requireQuickStartSelection: true,
        enableDrafts: true,
        promptPresets: [
          {
            label: "書面語",
            text: "請幫我看看以下作文是否符合書面語寫作規範，以表格形式對比作文使用的口語詞和提供書面詞。",
          },
          {
            label: "外貌描寫",
            text: "這是一篇人物描寫的作文，運用了外貌描寫的手法。請提出優化建議，以更好地展現人物的形象。請以表格形式呈現。",
          },
          {
            label: "行為描寫",
            text: "這是一篇人物描寫的作文，運用了行為描寫的手法。請提出優化建議，以更好地展現人物的性格形象。請以表格形式呈現。",
          },
          {
            label: "語言描寫",
            text: "這是一篇人物描寫的作文，語言描寫是非常重要的描寫手法。請提出優化建議，如何在這篇文章中使用語言描寫，以更好地展現人物的性格形象。請以表格形式呈現。",
          },
        ],
      }}
    />
  );
}
