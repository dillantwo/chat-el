import { requireTopicPage } from "@/lib/subject-access";

export const runtime = "nodejs";

export default async function ScienceMaterialsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireTopicPage("science", "learning-materials");

  return children;
}
