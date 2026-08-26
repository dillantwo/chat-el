"use client";

import { Calculator, FolderDown } from "lucide-react";
import TopicPicker, { type TopicCard } from "@/components/TopicPicker";

/** Keys and routes must match lib/topics.ts, which is what 學校管理 switches. */
const topics: TopicCard[] = [
  {
    id: "ai-problem-solving",
    label: "AI 解題輔助",
    labelEn: "AI Problem Solving",
    description: "輸入數學題目，AI 助手會分析題型、推薦互動工具，並即時生成練習與步驟講解。",
    href: "/math/dashboard",
    icon: Calculator,
    accent: "#146ef5",
  },
  {
    id: "learning-materials",
    label: "學習資源",
    labelEn: "Learning Materials",
    description: "下載數學科的補充教材、工作紙與參考資源。",
    href: "/math/materials",
    icon: FolderDown,
    accent: "#7a3dff",
    cta: "打開資源",
  },
];

export default function MathPage() {
  return (
    <TopicPicker
      subject="math"
      subjectLabel="數學科"
      subjectLabelEn="Mathematics"
      subjectIcon={Calculator}
      subjectAccent="#146ef5"
      topics={topics}
    />
  );
}
