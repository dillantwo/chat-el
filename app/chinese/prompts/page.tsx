import PromptBoard from "@/components/PromptBoard";

export default function ChinesePromptsPage() {
  return (
    <PromptBoard
      subject="chinese"
      backHref="/chinese"
      backLabel="中國語文科"
      heading="中國語文科提示詞"
      lang="zh"
    />
  );
}
