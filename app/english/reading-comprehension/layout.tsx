import { requireTopicPage } from "@/lib/subject-access";

export const runtime = "nodejs";

export default async function EnglishReadingComprehensionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireTopicPage("english", "reading-comprehension");

  return <>{children}</>;
}
