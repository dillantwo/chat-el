import { requireTopicPage } from "@/lib/subject-access";

export const runtime = "nodejs";

export default async function ChinesePrePostTestLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireTopicPage("chinese", "pre-post-test");

  return children;
}
