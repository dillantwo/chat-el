import { requireTopicPage } from "@/lib/subject-access";

export const runtime = "nodejs";

export default async function EnglishPrePostTestLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireTopicPage("english", "pre-post-test");

  return children;
}
