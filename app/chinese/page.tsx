"use client";

import {
  BookOpen,
  ClipboardList,
  FolderDown,
  MessageSquare,
  MessageSquareText,
  PenTool,
  ScrollText,
} from "lucide-react";
import TopicPicker, { type TopicCard } from "@/components/TopicPicker";

/** Keys and routes must match lib/topics.ts, which is what 學校管理 switches. */
const topics: TopicCard[] = [
  {
    id: "scenery-description",
    label: "景物描寫",
    labelEn: "Scenery Description",
    description: "從觀察、感官描寫到段落鋪陳，建立具畫面感的寫作能力。",
    href: "/chinese/scenery",
    icon: PenTool,
    accent: "#ff6b00",
  },
  {
    id: "character-description",
    label: "人物描寫",
    labelEn: "Character Description",
    description: "掌握人物外貌、語言、動作與心理描寫的組織方式。",
    href: "/chinese/character",
    icon: MessageSquare,
    accent: "#00a81b",
  },
  {
    id: "lin-zexu",
    label: "學習林則徐",
    labelEn: "Learning Lin Zexu",
    description: "透過林則徐的生平與事跡，認識歷史人物的精神與時代背景。",
    href: "/chinese/lin-zexu",
    icon: BookOpen,
    accent: "#7a3dff",
    // 暫時對所有用戶隱藏，需要時將 hidden 改為 false 即可重新開放。
    hidden: true,
  },
  {
    id: "wenyan",
    label: "學習文言文",
    labelEn: "Classical Chinese",
    description: "遊戲化學習文言文：學習模式追蹤進度，挑戰模式限時選擇題猜常用字，賺分數和獎章。",
    href: "/chinese/wenyan",
    icon: ScrollText,
    accent: "#ed52cb",
  },
  {
    id: "pre-post-test",
    label: "前測-後測",
    labelEn: "Pre / Post Test",
    description: "課題前後的問卷。",
    href: "/chinese/pre-post-test",
    icon: ClipboardList,
    accent: "#0f766e",
    group: "resource",
    cta: "打開問卷",
  },
  {
    id: "learning-materials",
    label: "學習資源",
    labelEn: "Learning Materials",
    description: "下載中國語文科的補充教材、工作紙與參考資源。",
    href: "/chinese/materials",
    icon: FolderDown,
    accent: "#7a3dff",
    group: "resource",
    cta: "打開資源",
  },
  {
    id: "prompts",
    label: "提示詞",
    labelEn: "Prompts",
    description: "編寫提示詞和上傳圖片，分享給任教班別的學生。",
    studentDescription: "查看老師分享的提示詞和圖片，一按就可以複製。",
    href: "/chinese/prompts",
    icon: MessageSquareText,
    accent: "#db2777",
    newWindow: true,
    group: "resource",
    cta: "編寫提示詞",
    studentCta: "打開提示詞",
  },
];

export default function ChinesePage() {
  return (
    <TopicPicker
      subject="chinese"
      subjectLabel="中國語文科"
      subjectLabelEn="Chinese Language"
      subjectIcon={BookOpen}
      subjectAccent="#7a3dff"
      topics={topics}
    />
  );
}
