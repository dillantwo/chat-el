import { requireSubjectPage } from "@/lib/subject-access";

export const runtime = "nodejs";

// See app/humanities/layout.tsx — subject access is checked against the
// database here because the proxy only sees the (up to 7 days old) cookie.
export default async function ChineseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireSubjectPage("chinese");
  return children;
}
