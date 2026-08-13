import { requireTopicPage } from "@/lib/subject-access";

export const runtime = "nodejs";

export default async function ChineseMaterialsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireTopicPage("chinese", "learning-materials");

  return children;
}
