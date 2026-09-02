import { requireTopicPage } from "@/lib/subject-access";

export const runtime = "nodejs";

export default async function SciencePrePostTestLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireTopicPage("science", "pre-post-test");

  return children;
}
