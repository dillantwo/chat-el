import { requireTopicPage } from "@/lib/subject-access";
import { PROMPT_TOPIC } from "@/lib/prompts";

export const runtime = "nodejs";

export default async function EnglishPromptsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireTopicPage("english", PROMPT_TOPIC);

  return children;
}
