import { requireTopicPage } from "@/lib/subject-access";
import { PROMPT_TOPIC } from "@/lib/prompts";

export const runtime = "nodejs";

export default async function ChinesePromptsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireTopicPage("chinese", PROMPT_TOPIC);

  return children;
}
