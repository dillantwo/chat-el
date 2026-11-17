import { requireTopicPage } from "@/lib/subject-access";
import { PROMPT_TOPIC } from "@/lib/prompts";

export const runtime = "nodejs";

export default async function SciencePromptsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireTopicPage("science", PROMPT_TOPIC);

  return children;
}
