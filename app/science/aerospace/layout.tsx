import { requireTopicPage } from "@/lib/subject-access";

export const runtime = "nodejs";

// Gates the whole 航天科技 topic, including its inner parts (the four
// interactive resources and the AI chatbot) — anything nested inside a topic
// follows the topic's own switch in 學校管理.
export default async function ScienceAerospaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireTopicPage("science", "aerospace");

  return children;
}
