import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getSession } from "@/lib/session";
import { LearningMaterial, type MaterialAudience } from "@/models/LearningMaterial";
import { SchoolMaterialLayout, type IMaterialGroup } from "@/models/SchoolMaterialLayout";
import { ALL_SUBJECTS, type Subject } from "@/models/User";
import { isAudienceAllowed } from "@/lib/material-access";
import { requireTopicApi } from "@/lib/subject-access";

export const runtime = "nodejs";

// GET /api/learning-materials?subject=english
// Returns the current user's school groups for the subject, with each group's
// materials filtered to what the caller's role is allowed to see.
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "未登錄" }, { status: 401 });
  }

  const subject = req.nextUrl.searchParams.get("subject");
  if (!subject || !ALL_SUBJECTS.includes(subject as Subject)) {
    return NextResponse.json({ error: "科目無效" }, { status: 400 });
  }

  // Non-admins must have access to the subject's 學習資源 topic and belong to a
  // school. The check is DB-backed (not `session.subjects`) so a revoked
  // subject or topic takes effect immediately, not at the user's next login.
  if (session.role !== "admin") {
    const denied = await requireTopicApi(subject as Subject, "learning-materials");
    if (denied) return denied;
    if (!session.schoolId) {
      return NextResponse.json({ groups: [] });
    }
  }

  // Admins have no school, so there is no school layout to show.
  if (!session.schoolId) {
    return NextResponse.json({ groups: [] });
  }

  await connectDB();

  const layout = await SchoolMaterialLayout.findOne({
    school: session.schoolId,
    subject,
  }).lean();

  if (!layout || layout.groups.length === 0) {
    return NextResponse.json({ groups: [] });
  }

  // Resolve all referenced material ids in one query.
  const allIds = layout.groups.flatMap((g: IMaterialGroup) => g.materials.map((m) => String(m)));
  const docs = await LearningMaterial.find({ _id: { $in: allIds }, subject })
    .select({ title: 1, description: 1, audience: 1, filename: 1, contentType: 1, size: 1 })
    .lean();

  const byId = new Map(docs.map((d) => [String(d._id), d]));

  const groups = layout.groups
    .map((g: IMaterialGroup) => ({
      name: g.name,
      items: g.materials
        .map((mid) => byId.get(String(mid)))
        .filter((d): d is NonNullable<typeof d> => Boolean(d))
        .filter((d) => isAudienceAllowed(session.role, d.audience as MaterialAudience))
        .map((d) => ({
          id: String(d._id),
          title: d.title,
          description: d.description ?? "",
          audience: d.audience,
          filename: d.filename,
          contentType: d.contentType,
          size: d.size,
        })),
    }))
    // Hide groups that end up empty for this role.
    .filter((g) => g.items.length > 0);

  return NextResponse.json({ groups });
}
