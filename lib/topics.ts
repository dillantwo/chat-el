// Registry of the topics ("主題") a school can open or close per subject.
//
// This is the shared source of truth for three consumers, so it must stay
// client-safe — do NOT import mongoose or anything server-only here:
//   1. the admin 學校管理 dialog, which renders a switch per topic,
//   2. the subject landing pages, which hide the cards a school has closed,
//   3. lib/subject-access.ts, which enforces access on the server.
//
// Scope is deliberately one level deep: the cards on a subject's landing page.
// Anything nested inside a topic (e.g. the four parts of 抗日戰爭, the five
// 文言文 modes) follows its parent topic. The math toolbox keeps its own global
// switches in 工具管理 and is not represented here.
//
// `route` is the path prefix the topic owns. Keys are stable identifiers and
// must match the `id` values used by the landing pages — renaming one would
// orphan whatever an admin has already saved.

import type { SubjectValue } from "@/lib/subjects";

export interface TopicDef {
  key: string;
  label: string;
  labelEn: string;
  /** Path prefix owned by this topic, used for the server-side guard. */
  route: string;
}

export const SUBJECT_TOPICS: Record<SubjectValue, TopicDef[]> = {
  math: [
    {
      key: "ai-problem-solving",
      label: "AI 解題輔助",
      labelEn: "AI Problem Solving",
      route: "/math/dashboard",
    },
    {
      key: "ai-diagram",
      label: "AI 生成圖解",
      labelEn: "AI Diagram Generator",
      route: "/math/diagram",
    },
    {
      key: "learning-materials",
      label: "學習資源",
      labelEn: "Learning Materials",
      route: "/math/materials",
    },
  ],
  chinese: [
    {
      key: "scenery-description",
      label: "景物描寫",
      labelEn: "Scenery Description",
      route: "/chinese/scenery",
    },
    {
      key: "character-description",
      label: "人物描寫",
      labelEn: "Character Description",
      route: "/chinese/character",
    },
    {
      key: "lin-zexu",
      label: "學習林則徐",
      labelEn: "Learning Lin Zexu",
      route: "/chinese/lin-zexu",
    },
    {
      key: "wenyan",
      label: "學習文言文",
      labelEn: "Classical Chinese",
      route: "/chinese/wenyan",
    },
    {
      key: "learning-materials",
      label: "學習資源",
      labelEn: "Learning Materials",
      route: "/chinese/materials",
    },
  ],
  english: [
    {
      key: "location-direction",
      label: "Location and Direction",
      labelEn: "Map Language Lab",
      route: "/english/dashboard",
    },
    {
      key: "thank-you-letter",
      label: "Thank-you Letter",
      labelEn: "Writing Practice",
      route: "/english/thankyouletter",
    },
    {
      key: "reading-comprehension",
      label: "Reading Comprehension",
      labelEn: "Reading Skills",
      route: "/english/reading-comprehension",
    },
    {
      key: "learning-materials",
      label: "Learning Materials",
      labelEn: "Resource Library",
      route: "/english/materials",
    },
  ],
  science: [
    {
      key: "circuit",
      label: "電力及電路",
      labelEn: "Electricity & Circuits",
      route: "/science/circuit",
    },
    {
      key: "aerospace",
      label: "航天科技",
      labelEn: "Aerospace Technology",
      route: "/science/aerospace",
    },
    {
      key: "learning-materials",
      label: "學習資源",
      labelEn: "Learning Materials",
      route: "/science/materials",
    },
  ],
  humanities: [
    {
      key: "water-resources",
      label: "水資源",
      labelEn: "Water Resources",
      route: "/humanities/water-resources",
    },
    {
      key: "anti-japanese-war",
      label: "抗日戰爭",
      labelEn: "Anti-Japanese War",
      route: "/humanities/anti-japanese-war",
    },
    {
      key: "learning-materials",
      label: "學習資源",
      labelEn: "Learning Materials",
      route: "/humanities/materials",
    },
  ],
};

/**
 * The stored identifier for one topic, e.g. `humanities:water-resources`.
 * Topic keys repeat across subjects (every subject has `learning-materials`),
 * so the subject must always be part of the key.
 */
export function topicKey(subject: string, topic: string): string {
  return `${subject}:${topic}`;
}

/** Every valid `subject:topic` key, for validating admin input. */
export const ALL_TOPIC_KEYS: string[] = Object.entries(SUBJECT_TOPICS).flatMap(
  ([subject, topics]) => topics.map((t) => topicKey(subject, t.key)),
);

export function isTopicKey(value: unknown): boolean {
  return typeof value === "string" && ALL_TOPIC_KEYS.includes(value);
}

/**
 * Clean an admin-supplied blocklist: keep only keys this build knows about, and
 * drop duplicates. An unknown key would be dead weight that silently blocks
 * nothing, so it is better dropped at the boundary than stored.
 */
export function sanitizeDisabledTopics(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return [...new Set(input.filter(isTopicKey) as string[])];
}
