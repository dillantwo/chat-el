import { requireTopicPage } from "@/lib/subject-access";
import { PROMPT_TOPIC } from "@/lib/prompts";

export const runtime = "nodejs";

export default async function HumanitiesPromptsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireTopicPage("humanities", PROMPT_TOPIC);

  return children;
}
