import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { School } from "@/models/School";
import { User } from "@/models/User";
import { requireAdmin } from "@/lib/admin-auth";
import { ALL_SUBJECTS, type Subject } from "@/models/User";
import { sanitizeDisabledTopics } from "@/lib/topics";
import { isDuplicateKeyError } from "@/lib/duplicate-key";

function sanitizeSubjects(input: unknown): Subject[] {
  if (!Array.isArray(input)) return [];
  return input.filter((s): s is Subject => ALL_SUBJECTS.includes(s as Subject));
}

// GET /api/admin/schools — list all schools with user counts
export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "需要管理員權限" }, { status: 403 });
  }

  await connectDB();
  const schools = await School.find().sort({ createdAt: -1 }).lean();

  // Attach a user count per school
  const counts = await User.aggregate<{ _id: unknown; count: number }>([
    { $match: { school: { $ne: null } } },
    { $group: { _id: "$school", count: { $sum: 1 } } },
  ]);
  const countMap = new Map(counts.map((c) => [String(c._id), c.count]));

  return NextResponse.json(
    schools.map((s) => ({
      id: String(s._id),
      name: s.name,
      code: s.code,
      enabledSubjects: s.enabledSubjects ?? [],
      disabledTopics: s.disabledTopics ?? [],
      active: s.active,
      userCount: countMap.get(String(s._id)) ?? 0,
      createdAt: s.createdAt,
    }))
  );
}

// POST /api/admin/schools — create a school
export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "需要管理員權限" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const name = (body.name ?? "").toString().trim();
    const code = (body.code ?? "").toString().trim().toLowerCase();

    if (!name || !code) {
      return NextResponse.json({ error: "學校名稱和代碼不能為空" }, { status: 400 });
    }

    await connectDB();
    const existing = await School.findOne({ code });
    if (existing) {
      return NextResponse.json({ error: "學校代碼已存在" }, { status: 409 });
    }

    const school = await School.create({
      name,
      code,
      enabledSubjects: sanitizeSubjects(body.enabledSubjects),
      disabledTopics: sanitizeDisabledTopics(body.disabledTopics),
      active: body.active !== false,
    });

    return NextResponse.json(
      {
        id: String(school._id),
        name: school.name,
        code: school.code,
        enabledSubjects: school.enabledSubjects,
        disabledTopics: school.disabledTopics,
        active: school.active,
        userCount: 0,
        createdAt: school.createdAt,
      },
      { status: 201 }
    );
  } catch (err) {
    // Concurrent creates can slip past the findOne check and hit the unique
    // index on `code`; surface that as the same 409, not a generic 500.
    if (isDuplicateKeyError(err)) {
      return NextResponse.json({ error: "學校代碼已存在" }, { status: 409 });
    }
    console.error("[admin/schools:POST]", err);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}
