import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Class } from "@/models/Class";
import { User } from "@/models/User";
import { requireAdmin } from "@/lib/admin-auth";
import { isValidAcademicYear } from "@/lib/academic-year";

// PATCH /api/admin/classes/[id] — rename, move to another academic year, or
// enable/disable. The school is fixed at creation: moving a class between
// schools would orphan every member's assignment.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "需要管理員權限" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const body = await req.json();
    await connectDB();

    const klass = await Class.findById(id);
    if (!klass) {
      return NextResponse.json({ error: "班級不存在" }, { status: 404 });
    }

    const name =
      typeof body.name === "string" && body.name.trim() ? body.name.trim() : klass.name;
    let academicYear = klass.academicYear;
    if (typeof body.academicYear === "string" && body.academicYear.trim()) {
      academicYear = body.academicYear.trim();
      if (!isValidAcademicYear(academicYear)) {
        return NextResponse.json({ error: "學年格式應為 2025-2026" }, { status: 400 });
      }
    }

    if (name !== klass.name || academicYear !== klass.academicYear) {
      const clash = await Class.findOne({
        _id: { $ne: klass._id },
        school: klass.school,
        academicYear,
        name,
      });
      if (clash) {
        return NextResponse.json(
          { error: `${academicYear} 學年已有名為「${name}」的班級` },
          { status: 409 }
        );
      }
    }

    klass.name = name;
    klass.academicYear = academicYear;
    if (typeof body.active === "boolean") {
      klass.active = body.active;
    }

    await klass.save();

    return NextResponse.json({
      id: String(klass._id),
      name: klass.name,
      academicYear: klass.academicYear,
      active: klass.active,
      schoolId: String(klass.school),
    });
  } catch (err) {
    console.error("[admin/classes/[id]:PATCH]", err);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}

// DELETE /api/admin/classes/[id] — only once nobody is assigned to it.
// Retiring a cohort should use the `active` flag instead, which keeps the
// assignments (and therefore the teachers' access to past records) intact.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "需要管理員權限" }, { status: 403 });
  }

  const { id } = await params;

  try {
    await connectDB();

    const memberCount = await User.countDocuments({ classes: id });
    if (memberCount > 0) {
      return NextResponse.json(
        {
          error: `該班級仍有 ${memberCount} 名成員，請先移除成員，或改為停用班級`,
        },
        { status: 409 }
      );
    }

    const deleted = await Class.findByIdAndDelete(id);
    if (!deleted) {
      return NextResponse.json({ error: "班級不存在" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[admin/classes/[id]:DELETE]", err);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}
