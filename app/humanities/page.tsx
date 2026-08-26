"use client";

import { Droplets, FolderDown, Landmark, Swords } from "lucide-react";
import TopicPicker, { type TopicCard } from "@/components/TopicPicker";

/** Keys and routes must match lib/topics.ts, which is what 學校管理 switches. */
const topics: TopicCard[] = [
  {
    id: "water-resources",
    label: "水資源",
    labelEn: "Water Resources",
    description:
      "跟著「🥛小水文」認識水資源、水循環、香港食水來源、東江水及國家安全等課題。",
    href: "/humanities/water-resources",
    icon: Droplets,
    accent: "#146ef5",
  },
  {
    id: "anti-japanese-war",
    label: "抗日戰爭",
    labelEn: "War of Resistance",
    description: "認識抗日戰爭的歷史與意義。",
    href: "/humanities/anti-japanese-war",
    icon: Swords,
    // Deep red rather than the subject's pink: pink read as the wrong register
    // for this topic, and it repeated the colour of the 人文科 sticker sitting
    // right above the card. Dark enough for white button text (6.2:1).
    accent: "#c1121f",
  },
  {
    id: "learning-materials",
    label: "學習資源",
    labelEn: "Learning Materials",
    description: "下載人文科的補充教材、工作紙與參考資源。",
    href: "/humanities/materials",
    icon: FolderDown,
    accent: "#7a3dff",
    cta: "打開資源",
  },
];

export default function HumanitiesPage() {
  return (
    <TopicPicker
      subject="humanities"
      subjectLabel="人文科"
      subjectLabelEn="Humanities"
      subjectIcon={Landmark}
      subjectAccent="#ed52cb"
      topics={topics}
    />
  );
}
