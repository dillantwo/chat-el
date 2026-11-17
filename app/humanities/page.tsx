"use client";

import { ClipboardList, Droplets, FolderDown, MessageSquareText, Landmark, Swords } from "lucide-react";
import TopicPicker, { type TopicCard } from "@/components/TopicPicker";
import { useCopy } from "@/components/LocaleProvider";
import { defineCopy } from "@/lib/i18n/config";
import { COMMON_COPY } from "@/lib/i18n/common";

type TopicText = Pick<TopicCard, "label" | "description" | "studentDescription" | "cta" | "studentCta">;

const COPY = defineCopy({
  "zh-Hant": {
    topics: {
      "water-resources": {
        label: "水資源",
        description:
          "跟著「🥛小水文」認識水資源、水循環、香港食水來源、東江水及國家安全等課題。",
      },
      "anti-japanese-war": {
        label: "抗日戰爭",
        description: "認識抗日戰爭的歷史與意義。",
      },
      "pre-post-test": {
        label: "前測-後測",
        description: "課題前後的問卷。",
        cta: "打開問卷",
      },
      "learning-materials": {
        label: "學習資源",
        description: "下載人文科的補充教材、工作紙與參考資源。",
        cta: "打開資源",
      },
      prompts: {
        label: "提示詞",
        description: "編寫提示詞和上傳圖片，分享給任教班別的學生。",
        studentDescription: "查看老師分享的提示詞和圖片，一按就可以複製。",
        cta: "編寫提示詞",
        studentCta: "打開提示詞",
      },
    } as Record<string, TopicText>,
  },
  en: {
    topics: {
      "water-resources": {
        label: "Water Resources",
        description:
          "Learn with 🥛 Aqua Buddy about water resources, the water cycle, where Hong Kong's drinking water comes from, Dongjiang water and national security.",
      },
      "anti-japanese-war": {
        label: "War of Resistance",
        description: "Learn about the history and meaning of the War of Resistance Against Japan.",
      },
      "pre-post-test": {
        label: "Pre / Post Test",
        description: "Questionnaires for before and after the topic.",
        cta: "Open questionnaire",
      },
      "learning-materials": {
        label: "Learning Materials",
        description: "Download extra Humanities materials, worksheets and reference resources.",
        cta: "Open materials",
      },
      prompts: {
        label: "Prompts",
        description: "Write prompts and add pictures to share with the classes you teach.",
        studentDescription: "See the prompts and pictures your teacher shared, and copy them in one tap.",
        cta: "Write prompts",
        studentCta: "Open prompts",
      },
    },
  },
});

/** Keys and routes must match lib/topics.ts, which is what 學校管理 switches. */
const topics: Omit<TopicCard, "label" | "description" | "cta">[] = [
  {
    id: "water-resources",
    labelEn: "Water Resources",
    href: "/humanities/water-resources",
    icon: Droplets,
    accent: "#146ef5",
  },
  {
    id: "anti-japanese-war",
    labelEn: "War of Resistance",
    href: "/humanities/anti-japanese-war",
    icon: Swords,
    // Deep red rather than the subject's pink: pink read as the wrong register
    // for this topic, and it repeated the colour of the 人文科 sticker sitting
    // right above the card. Dark enough for white button text (6.2:1).
    accent: "#c1121f",
  },
  {
    id: "pre-post-test",
    labelEn: "Pre / Post Test",
    href: "/humanities/pre-post-test",
    icon: ClipboardList,
    accent: "#0f766e",
    group: "resource",
  },
  {
    id: "learning-materials",
    labelEn: "Learning Materials",
    href: "/humanities/materials",
    icon: FolderDown,
    accent: "#7a3dff",
    group: "resource",
  },
  {
    id: "prompts",
    labelEn: "Prompts",
    href: "/humanities/prompts",
    icon: MessageSquareText,
    accent: "#db2777",
    newWindow: true,
    group: "resource",
  },
];

export default function HumanitiesPage() {
  const copy = useCopy(COPY);
  const common = useCopy(COMMON_COPY);
  const localizedTopics: TopicCard[] = topics.map((topic) => ({
    ...topic,
    ...copy.topics[topic.id],
  }));

  return (
    <TopicPicker
      subject="humanities"
      subjectLabel={common.subjects.humanities}
      subjectLabelEn="Humanities"
      subjectIcon={Landmark}
      subjectAccent="#ed52cb"
      topics={localizedTopics}
    />
  );
}
