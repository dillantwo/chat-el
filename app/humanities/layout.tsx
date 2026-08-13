import { requireSubjectPage } from "@/lib/subject-access";

export const runtime = "nodejs";

// Every page under /humanities is gated here, against the database. The proxy's
// check reads the 7-day session cookie, so on its own it keeps letting a user in
// after an admin unchecks 人文科 for their school in 學校管理.
export default async function HumanitiesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireSubjectPage("humanities");
  return children;
}
