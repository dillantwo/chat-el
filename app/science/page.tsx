"use client";

import { FlaskConical, FolderDown, Rocket, Zap } from "lucide-react";
import TopicPicker, { type TopicCard } from "@/components/TopicPicker";

/** Keys and routes must match lib/topics.ts, which is what 學校管理 switches. */
const topics: TopicCard[] = [
  {
    id: "circuit",
    label: "電力及電路",
    labelEn: "Electricity & Circuits",
    description:
      "跟著「小科」認識電力安全、電池安裝、閉合電路、導電體、串聯與並聯電路等課題。",
    href: "/science/circuit",
    icon: Zap,
    accent: "#ff6b00",
  },
  {
    id: "aerospace",
    label: "航天科技",
    labelEn: "Aerospace Technology",
    description:
      "透過互動遊戲認識中國航天成就、火星探測與導航衛星，也可以隨時跟「小空」對話探索太空知識。",
    href: "/science/aerospace",
    icon: Rocket,
    accent: "#146ef5",
  },
  {
    id: "learning-materials",
    label: "學習資源",
    labelEn: "Learning Materials",
    description: "下載科學科的補充教材、工作紙與參考資源。",
    href: "/science/materials",
    icon: FolderDown,
    accent: "#7a3dff",
    cta: "打開資源",
    group: "resource",
  },
];

export default function SciencePage() {
  return (
    <TopicPicker
      subject="science"
      subjectLabel="科學科"
      subjectLabelEn="Science"
      subjectIcon={FlaskConical}
      subjectAccent="#ff6b00"
      topics={topics}
    />
  );
}
