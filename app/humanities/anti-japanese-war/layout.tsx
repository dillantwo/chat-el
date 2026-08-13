import { requireTopicPage } from "@/lib/subject-access";

export const runtime = "nodejs";

// Gates the whole 抗日戰爭 topic, including its four inner parts — anything
// nested inside a topic follows the topic's own switch.
export default async function HumanitiesAntiJapaneseWarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireTopicPage("humanities", "anti-japanese-war");

  return children;
}
