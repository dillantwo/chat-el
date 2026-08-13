import { requireTopicPage } from "@/lib/subject-access";

export const runtime = "nodejs";

export default async function ChineseWenyanLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireTopicPage("chinese", "wenyan");

  return <main className="flex flex-1 flex-col min-h-0 overflow-hidden">{children}</main>;
}
