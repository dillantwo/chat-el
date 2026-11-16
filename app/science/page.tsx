"use client";

import { ClipboardList, FlaskConical, FolderDown, Rocket, Zap } from "lucide-react";
import TopicPicker, { type TopicCard } from "@/components/TopicPicker";
import { useCopy } from "@/components/LocaleProvider";
import { defineCopy } from "@/lib/i18n/config";
import { COMMON_COPY } from "@/lib/i18n/common";

type TopicText = { label: string; description: string; cta?: string };

const COPY = defineCopy({
  "zh-Hant": {
    topics: {
      circuit: {
        label: "電與電路",
        description:
          "跟著「小科」認識電力安全、電池安裝、閉合電路、導電體、串聯與並聯電路等課題。",
      },
      aerospace: {
        label: "航天科技",
        description:
          "透過互動遊戲認識中國航天成就、火星探測與導航衛星，也可以隨時跟「小空」對話探索太空知識。",
      },
      "pre-post-test": {
        label: "前測-後測",
        description: "課題前後的問卷。",
        cta: "打開問卷",
      },
      "learning-materials": {
        label: "學習資源",
        description: "下載科學科的補充教材、工作紙與參考資源。",
        cta: "打開資源",
      },
    } as Record<string, TopicText>,
  },
  en: {
    topics: {
      circuit: {
        label: "Electricity and Circuits",
        description:
          "Learn with Little Science about electrical safety, putting in batteries, closed circuits, conductors, and series and parallel circuits.",
      },
      aerospace: {
        label: "Aerospace",
        description:
          "Play interactive games about China's space achievements, Mars exploration and navigation satellites, and chat with Little Space any time to explore space.",
      },
      "pre-post-test": {
        label: "Pre / Post Test",
        description: "Questionnaires for before and after the topic.",
        cta: "Open questionnaire",
      },
      "learning-materials": {
        label: "Learning Materials",
        description: "Download extra Science materials, worksheets and reference resources.",
        cta: "Open materials",
      },
    },
  },
});

/** Keys and routes must match lib/topics.ts, which is what 學校管理 switches. */
const topics: Omit<TopicCard, "label" | "description" | "cta">[] = [
  {
    id: "circuit",
    labelEn: "Electricity and Circuits",
    href: "/science/circuit",
    icon: Zap,
    accent: "#ff6b00",
  },
  {
    id: "aerospace",
    labelEn: "Aerospace",
    href: "/science/aerospace",
    icon: Rocket,
    accent: "#146ef5",
  },
  {
    id: "pre-post-test",
    labelEn: "Pre / Post Test",
    href: "/science/pre-post-test",
    icon: ClipboardList,
    accent: "#0f766e",
    group: "resource",
  },
  {
    id: "learning-materials",
    labelEn: "Learning Materials",
    href: "/science/materials",
    icon: FolderDown,
    accent: "#7a3dff",
    group: "resource",
  },
];

export default function SciencePage() {
  const copy = useCopy(COPY);
  const common = useCopy(COMMON_COPY);
  const localizedTopics: TopicCard[] = topics.map((topic) => ({
    ...topic,
    ...copy.topics[topic.id],
  }));

  return (
    <TopicPicker
      subject="science"
      subjectLabel={common.subjects.science}
      subjectLabelEn="Science"
      subjectIcon={FlaskConical}
      subjectAccent="#ff6b00"
      topics={localizedTopics}
    />
  );
}
