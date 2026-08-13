import { requireTopicPage } from "@/lib/subject-access";

export const runtime = "nodejs";

export default async function EnglishMaterialsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireTopicPage("english", "learning-materials");

  return children;
}
