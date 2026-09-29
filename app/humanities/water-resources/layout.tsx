import { requireTopicPage } from "@/lib/subject-access";

export const runtime = "nodejs";

// Gates the whole 水資源 topic, including its inner parts (互動水資源風險地圖 and
// 小水文對話) — anything nested inside a topic follows the topic's own switch.
// The sidebar is not set up here: only the chat part needs it, so it lives in
// water-resources/chat/layout.tsx and the landing and map pages stay full-width.
export default async function HumanitiesWaterResourcesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireTopicPage("humanities", "water-resources");

  return children;
}
