import { requireTopicPage } from "@/lib/subject-access";

export const runtime = "nodejs";

export default async function MathMaterialsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireTopicPage("math", "learning-materials");

  return children;
}
