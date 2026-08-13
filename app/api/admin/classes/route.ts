import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { Class } from "@/models/Class";
import { School } from "@/models/School";
import { User } from "@/models/User";
import { requireAdmin } from "@/lib/admin-auth";
import { isValidAcademicYear } from "@/lib/academic-year";
import { isDuplicateKeyError } from "@/lib/duplicate-key";

interface MemberCounts {
  teachers: number;
  students: number;
}

/** Teacher/student counts per class, for the classes listed in `classIds`. */
async function countMembers(
  classIds: mongoose.Types.ObjectId[]
): Promise<Map<string, MemberCounts>> {
  const counts = new Map<string, MemberCounts>();
  if (classIds.length === 0) return counts;

  const grouped = await User.aggregate<{
    _id: { classId: mongoose.Types.ObjectId; role: string };
    count: number;
  }>([
    { $match: { classes: { $in: classIds } } },
    { $unwind: "$classes" },
    { $match: { classes: { $in: classIds } } },
    { $group: { _id: { classId: "$classes", role: "$role" }, count: { $sum: 1 } } },
  ]);

  for (const row of grouped) {
    const key = String(row._id.classId);
    const entry = counts.get(key) ?? { teachers: 0, students: 0 };
    if (row._id.role === "teacher") entry.teachers = row.count;
    if (row._id.role === "student") entry.students = row.count;
    counts.set(key, entry);
  }

  return counts;
}

// GET /api/admin/classes?school=<id> — list classes with member counts
export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "需要管理員權限" }, { status: 403 });
  }

  await connectDB();

  const filter: Record<string, unknown> = {};
  const school = req.nextUrl.searchParams.get("school");
  if (school) filter.school = school;

  const classes = await Class.find(filter)
    .populate("school", "name code")
    .sort({ academicYear: -1, name: 1 })
    .lean();

  const counts = await countMembers(
    classes.map((c) => c._id as mongoose.Types.ObjectId)
  );

  return NextResponse.json(
    classes.map((c) => {
      const s = c.school as unknown as { _id: { toString(): string }; name: string } | null;
      const member = counts.get(String(c._id)) ?? { teachers: 0, students: 0 };
      return {
        id: String(c._id),
        name: c.name,
        academicYear: c.academicYear,
        active: c.active,
        schoolId: s ? s._id.toString() : null,
        schoolName: s ? s.name : null,
        teacherCount: member.teachers,
        studentCount: member.students,
        createdAt: c.createdAt,
      };
    })
  );
}

// POST /api/admin/classes — create a class within a school
export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "需要管理員權限" }, { status: 403 });
  }

  // Declared out here so the duplicate-key handler in `catch` can reuse them
  // and word its 409 exactly like the pre-check below.
  let name = "";
  let academicYear = "";

  try {
    const body = await req.json();
    name = (body.name ?? "").toString().trim();
    academicYear = (body.academicYear ?? "").toString().trim();
    const schoolId = (body.school ?? "").toString().trim();

    if (!name) {
      return NextResponse.json({ error: "班級名稱不能為空" }, { status: 400 });
    }
    if (!schoolId) {
      return NextResponse.json({ error: "班級必須綁定學校" }, { status: 400 });
    }
    if (!isValidAcademicYear(academicYear)) {
      return NextResponse.json({ error: "學年格式應為 2025-2026" }, { status: 400 });
    }

    await connectDB();

    const school = await School.findById(schoolId);
    if (!school) {
      return NextResponse.json({ error: "學校不存在" }, { status: 400 });
    }

    const existing = await Class.findOne({ school: schoolId, academicYear, name });
    if (existing) {
      return NextResponse.json(
        { error: `${academicYear} 學年已有名為「${name}」的班級` },
        { status: 409 }
      );
    }

    const created = await Class.create({
      school: school._id,
      name,
      academicYear,
      active: body.active !== false,
    });

    return NextResponse.json(
      {
        id: String(created._id),
        name: created.name,
        academicYear: created.academicYear,
        active: created.active,
        schoolId: String(school._id),
        schoolName: school.name,
        teacherCount: 0,
        studentCount: 0,
        createdAt: created.createdAt,
      },
      { status: 201 }
    );
  } catch (err) {
    // Concurrent creates can slip past the findOne check and hit the compound
    // unique index on { school, academicYear, name }.
    if (isDuplicateKeyError(err)) {
      return NextResponse.json(
        { error: `${academicYear} 學年已有名為「${name}」的班級` },
        { status: 409 }
      );
    }
    console.error("[admin/classes:POST]", err);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}
