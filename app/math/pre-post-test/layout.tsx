import { requireTopicPage } from "@/lib/subject-access";

export const runtime = "nodejs";

export default async function MathPrePostTestLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireTopicPage("math", "pre-post-test");

  return children;
}
