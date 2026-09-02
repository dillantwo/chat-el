import { requireTopicPage } from "@/lib/subject-access";

export const runtime = "nodejs";

export default async function HumanitiesPrePostTestLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireTopicPage("humanities", "pre-post-test");

  return children;
}
