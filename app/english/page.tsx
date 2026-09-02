"use client";

import { ClipboardList, Compass, FolderDown, Globe, Landmark, Route } from "lucide-react";
import TopicPicker, { type TopicCard } from "@/components/TopicPicker";

/** Keys and routes must match lib/topics.ts, which is what 學校管理 switches. */
const topics: TopicCard[] = [
  {
    id: "location-direction",
    label: "Location and Direction",
    labelEn: "Map Language Lab",
    description: "Practice giving directions through map-based tasks.",
    // The dashboard is shared by the map topics, so it needs the topic in the URL.
    href: "/english/dashboard?topic=location-direction",
    icon: Route,
    accent: "#146ef5",
  },
  {
    id: "thank-you-letter",
    label: "Thank-you Letter",
    labelEn: "Writing Practice",
    description:
      "Learn to draft sincere thank-you letters with proper structure, tone, and polite expressions.",
    href: "/english/thankyouletter",
    icon: Landmark,
    accent: "#00a81b",
  },
  {
    id: "reading-comprehension",
    label: "Reading Comprehension",
    labelEn: "Reading Skills",
    description:
      "Strengthen reading skills through guided passages, key idea spotting, and inference practice.",
    href: "/english/reading-comprehension",
    icon: Compass,
    accent: "#ff6b00",
  },
  {
    id: "pre-post-test",
    label: "Pre-test & Post-test",
    labelEn: "Questionnaires",
    description:
      "Questionnaires for before and after the topics.",
    href: "/english/pre-post-test",
    icon: ClipboardList,
    accent: "#0f766e",
    cta: "Open questionnaire",
    group: "resource",
  },
  {
    id: "learning-materials",
    label: "Learning Materials",
    labelEn: "Resource Library",
    description:
      "Download supplementary worksheets, references, and class resources for English.",
    href: "/english/materials",
    icon: FolderDown,
    accent: "#7a3dff",
    cta: "Open resources",
    group: "resource",
  },
];

/** English copy throughout, as the topics themselves are taught in English. */
export default function EnglishPage() {
  return (
    <TopicPicker
      subject="english"
      subjectLabel="英國語文科"
      subjectLabelEn="English Language"
      subjectIcon={Globe}
      subjectAccent="#00a81b"
      topics={topics}
      intro="Pick a topic to start practising."
      defaultCta="Start this topic"
      emptyTitle="No topics yet"
      emptyBody="No topics are open for this subject. Please ask your teacher or administrator to open one."
      comingSoonLabel="Coming soon"
      backLabel="Select Subject"
      topicsSectionLabel="Topics"
      resourcesSectionLabel="Resources"
    />
  );
}
