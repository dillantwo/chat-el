import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getSession } from "@/lib/session";
import { SurveyTemplate } from "@/models/SurveyTemplate";
import { ALL_SUBJECTS, type Subject } from "@/models/User";
import { requireTopicApi } from "@/lib/subject-access";
import { groupHasSurvey, templateGroups } from "@/lib/surveys";

export const runtime = "nodejs";

// GET /api/survey-links?subject=english
// Returns the 類別 (each with its 前測 / 後測) of the survey template that applies
// to the caller's school, or an empty list when nothing is set up for them yet.
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "未登錄" }, { status: 401 });
  }

  const subject = req.nextUrl.searchParams.get("subject");
  if (!subject || !ALL_SUBJECTS.includes(subject as Subject)) {
    return NextResponse.json({ error: "科目無效" }, { status: 400 });
  }

  // Same gate as the rest of the subject areas: DB-backed, so a topic an admin
  // just closed stops working immediately rather than at the next login.
  if (session.role !== "admin") {
    const denied = await requireTopicApi(subject as Subject, "pre-post-test");
    if (denied) return denied;
  }

  // Admins have no school, so no template applies to them.
  if (!session.schoolId) {
    return NextResponse.json({ groups: [] });
  }

  await connectDB();

  const template = await SurveyTemplate.findOne({
    subject,
    schools: session.schoolId,
  })
    .select({ groups: 1, pre: 1, post: 1 })
    .lean();

  // A 類別 an admin created but has not filled in yet would render as an empty
  // tab, so it never reaches the student.
  return NextResponse.json({ groups: templateGroups(template).filter(groupHasSurvey) });
}
