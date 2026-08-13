import { requireTopicPage } from "@/lib/subject-access";

export const runtime = "nodejs";

export default async function HumanitiesMaterialsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireTopicPage("humanities", "learning-materials");

  return children;
}
