"use client";

import { Calculator, ClipboardList, FolderDown, Sparkles } from "lucide-react";
import TopicPicker, { type TopicCard } from "@/components/TopicPicker";
import { useCopy } from "@/components/LocaleProvider";
import { COMMON_COPY } from "@/lib/i18n/common";
import { defineCopy } from "@/lib/i18n/config";

type TopicText = Pick<TopicCard, "label" | "description" | "studentDescription" | "cta" | "studentCta">;

/** Card wording per topic id, in both interface languages. */
const COPY = defineCopy<Record<string, TopicText>>({
  "zh-Hant": {
    "ai-problem-solving": {
      label: "AI 解題輔助（分數學習）",
      description: "輸入數學題目，AI 助手會分析題型、推薦互動工具，並即時生成練習與步驟講解。",
    },
    "ai-diagram": {
      label: "AI 生成圖解（解文字題）",
      description: "AI生成互動或靜態的數學圖解。",
      studentDescription: "打開老師分享的數學圖解，動手試一試，也可以問 AI 助手。",
      cta: "開始生成圖解",
      studentCta: "打開圖解",
    },
    "pre-post-test": {
      label: "前測-後測",
      description: "課題前後的問卷。",
      cta: "打開問卷",
    },
    "learning-materials": {
      label: "學習資源",
      description: "下載數學科的補充教材、工作紙與參考資源。",
      cta: "打開資源",
    },
  },
  en: {
    "ai-problem-solving": {
      label: "AI Problem Solving (Fractions)",
      description:
        "Type in a maths question. The AI helper works out what kind of question it is, suggests an interactive tool, and makes practice and step-by-step explanations for you.",
    },
    "ai-diagram": {
      label: "AI Diagram Generator (Word Problems)",
      description: "Use AI to make interactive or still maths diagrams.",
      studentDescription: "Open a maths diagram your teacher has shared, try it out, and ask the AI helper about it.",
      cta: "Start making a diagram",
      studentCta: "Open diagrams",
    },
    "pre-post-test": {
      label: "Pre / Post Test",
      description: "Questionnaires for before and after the topic.",
      cta: "Open questionnaire",
    },
    "learning-materials": {
      label: "Learning Materials",
      description: "Download extra maths materials, worksheets and reference resources.",
      cta: "Open materials",
    },
  },
});

/** Keys and routes must match lib/topics.ts, which is what 學校管理 switches. */
const topics: Omit<TopicCard, keyof TopicText>[] = [
  {
    id: "ai-problem-solving",
    labelEn: "AI Problem Solving (Fractions)",
    href: "/math/dashboard",
    icon: Calculator,
    accent: "#146ef5",
  },
  {
    id: "ai-diagram",
    labelEn: "AI Diagram Generator (Word Problems)",
    // A pupil cannot generate here — /api/generate-html is teacher-only — so the
    // card describes what they can actually do: open a shared diagram and ask
    // the AI 助手 about it.
    href: "/math/diagram",
    icon: Sparkles,
    accent: "#16a34a",
  },
  {
    id: "pre-post-test",
    labelEn: "Pre / Post Test",
    href: "/math/pre-post-test",
    icon: ClipboardList,
    accent: "#0f766e",
    group: "resource",
  },
  {
    id: "learning-materials",
    labelEn: "Learning Materials",
    href: "/math/materials",
    icon: FolderDown,
    accent: "#7a3dff",
    group: "resource",
  },
];

export default function MathPage() {
  const copy = useCopy(COPY);
  const common = useCopy(COMMON_COPY);
  const localizedTopics: TopicCard[] = topics.map((topic) => ({ ...topic, ...copy[topic.id] }));

  return (
    <TopicPicker
      subject="math"
      subjectLabel={common.subjects.math}
      subjectLabelEn="Mathematics"
      subjectIcon={Calculator}
      subjectAccent="#146ef5"
      topics={localizedTopics}
    />
  );
}
