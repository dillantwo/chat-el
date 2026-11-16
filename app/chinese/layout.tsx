import { LocaleOverride } from "@/components/LocaleProvider";
import { requireSubjectPage } from "@/lib/subject-access";

export const runtime = "nodejs";

// See app/humanities/layout.tsx — subject access is checked against the
// database here because the proxy only sees the (up to 7 days old) cookie.
//
// The Chinese Language subject looks the same in both interface languages, so
// the whole subtree is pinned to Chinese: shared components (Header, sidebar,
// topic picker, chat) render Chinese here even when the user picked English.
// The AI routes under /api/chinese-* likewise ignore the locale.
export default async function ChineseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireSubjectPage("chinese");
  return <LocaleOverride locale="zh-Hant">{children}</LocaleOverride>;
}
