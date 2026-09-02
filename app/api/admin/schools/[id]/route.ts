import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { School } from "@/models/School";
import { User } from "@/models/User";
import { Class } from "@/models/Class";
import { ToolboxConfig } from "@/models/ToolboxConfig";
import { MaterialTemplate } from "@/models/MaterialTemplate";
import { SurveyTemplate } from "@/models/SurveyTemplate";
import { requireAdmin } from "@/lib/admin-auth";
import { ALL_SUBJECTS, type Subject } from "@/models/User";
import { sanitizeDisabledTopics } from "@/lib/topics";

function sanitizeSubjects(input: unknown): Subject[] {
  if (!Array.isArray(input)) return [];
  return input.filter((s): s is Subject => ALL_SUBJECTS.includes(s as Subject));
}

// PATCH /api/admin/schools/[id] — update a school
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "需要管理員權限" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const body = await req.json();
    await connectDB();

    const school = await School.findById(id);
    if (!school) {
      return NextResponse.json({ error: "學校不存在" }, { status: 404 });
    }

    if (typeof body.name === "string" && body.name.trim()) {
      school.name = body.name.trim();
    }
    if (body.enabledSubjects !== undefined) {
      school.enabledSubjects = sanitizeSubjects(body.enabledSubjects);
      // Prune subjects from users that the school no longer offers, including
      // teachers' student-data view permissions.
      await User.updateMany(
        { school: school._id },
        {
          $pull: {
            subjects: { $nin: school.enabledSubjects },
            dataSubjects: { $nin: school.enabledSubjects },
          },
        }
      );
    }
    if (body.disabledTopics !== undefined) {
      // Entries for subjects the school does not hold are kept rather than
      // pruned, so re-enabling a subject restores the topic choices made for it.
      school.disabledTopics = sanitizeDisabledTopics(body.disabledTopics);
    }
    if (typeof body.active === "boolean") {
      school.active = body.active;
    }

    await school.save();

    return NextResponse.json({
      id: String(school._id),
      name: school.name,
      code: school.code,
      enabledSubjects: school.enabledSubjects,
      disabledTopics: school.disabledTopics,
      active: school.active,
    });
  } catch (err) {
    console.error("[admin/schools/[id]:PATCH]", err);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}

// DELETE /api/admin/schools/[id] — delete a school (only if it has no users)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "需要管理員權限" }, { status: 403 });
  }

  const { id } = await params;

  try {
    await connectDB();
    const userCount = await User.countDocuments({ school: id });
    if (userCount > 0) {
      return NextResponse.json(
        { error: `該學校仍有 ${userCount} 名使用者，請先轉移或刪除使用者` },
        { status: 409 }
      );
    }

    const classCount = await Class.countDocuments({ school: id });
    if (classCount > 0) {
      return NextResponse.json(
        { error: `該學校仍有 ${classCount} 個班級，請先刪除班級` },
        { status: 409 }
      );
    }

    const deleted = await School.findByIdAndDelete(id);
    if (!deleted) {
      return NextResponse.json({ error: "學校不存在" }, { status: 404 });
    }

    // Drop the school from every toolbox 開放範圍 it was listed in. Access was
    // never at risk (an ObjectId is not reused, so a stale id matches nothing),
    // but 工具管理 counts the entries: a tool scoped to one deleted school would
    // read "1 間學校" while actually being closed to everyone.
    await Promise.all([
      ToolboxConfig.updateMany({ schools: deleted._id }, { $pull: { schools: deleted._id } }),
      ToolboxConfig.updateMany(
        { "tools.schools": deleted._id },
        { $pull: { "tools.$[].schools": deleted._id } },
      ),
    ]);

    // Same for the 適用學校 of every 資源範本 and 問卷範本: the counts shown in
    // 學校資源 / 問卷範本 would otherwise include a school that no longer exists.
    await Promise.all([
      MaterialTemplate.updateMany(
        { schools: deleted._id },
        { $pull: { schools: deleted._id } },
      ),
      SurveyTemplate.updateMany(
        { schools: deleted._id },
        { $pull: { schools: deleted._id } },
      ),
    ]);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[admin/schools/[id]:DELETE]", err);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}
