import { requireTopicPage } from "@/lib/subject-access";
import { PROMPT_TOPIC } from "@/lib/prompts";

export const runtime = "nodejs";

export default async function MathPromptsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireTopicPage("math", PROMPT_TOPIC);

  return children;
}
