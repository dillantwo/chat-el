import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/mongodb";
import { User, ALL_SUBJECTS, type Subject, type UserRole } from "@/models/User";
import { School } from "@/models/School";
import { requireAdmin } from "@/lib/admin-auth";
import { resolveClassesForSchool } from "@/lib/class-assignment";
import { isDuplicateKeyError } from "@/lib/duplicate-key";

function sanitizeSubjects(input: unknown): Subject[] {
  if (!Array.isArray(input)) return [];
  return input.filter((s): s is Subject => ALL_SUBJECTS.includes(s as Subject));
}

type PopulatedSchool = { _id: { toString(): string }; name: string } | null;
type PopulatedClass = { _id: { toString(): string }; name: string; academicYear: string };

function serializeClasses(input: unknown) {
  if (!Array.isArray(input)) return [];
  return (input as PopulatedClass[])
    .filter((c) => c && c._id)
    .map((c) => ({
      id: c._id.toString(),
      name: String(c.name),
      academicYear: String(c.academicYear),
    }));
}

// GET /api/admin/users?school=<id>&role=<role>&class=<id>&q=<search>
export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "需要管理員權限" }, { status: 403 });
  }

  await connectDB();

  const { searchParams } = req.nextUrl;
  const filter: Record<string, unknown> = {};

  const school = searchParams.get("school");
  if (school) filter.school = school;

  const role = searchParams.get("role");
  if (role && ["admin", "teacher", "student"].includes(role)) filter.role = role;

  const klass = searchParams.get("class");
  if (klass) filter.classes = klass;

  const q = searchParams.get("q");
  if (q && q.trim()) {
    const rx = new RegExp(q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ username: rx }, { displayName: rx }];
  }

  const users = await User.find(filter)
    .populate("school", "name code")
    .populate("classes", "name academicYear")
    .sort({ createdAt: -1 })
    .lean();

  return NextResponse.json(
    users.map((u) => {
      const s = u.school as unknown as PopulatedSchool;
      return {
        id: String(u._id),
        username: u.username,
        displayName: u.displayName,
        role: u.role,
        schoolId: s ? s._id.toString() : null,
        schoolName: s ? s.name : null,
        subjects: u.subjects ?? [],
        // null means "not configured yet", in which case the teacher's data
        // access falls back to `subjects` (see IUser.dataSubjects).
        dataSubjects: Array.isArray(u.dataSubjects) ? u.dataSubjects : null,
        classes: serializeClasses(u.classes),
        createdAt: u.createdAt,
      };
    })
  );
}

// POST /api/admin/users — create a teacher/student/admin
export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "需要管理員權限" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const username = (body.username ?? "").toString().trim().toLowerCase();
    const password = (body.password ?? "").toString();
    const displayName = (body.displayName ?? "").toString().trim();
    const role = body.role as UserRole;

    if (!username || !password || !displayName) {
      return NextResponse.json({ error: "用戶名、密碼和顯示名稱不能為空" }, { status: 400 });
    }
    if (!["admin", "teacher", "student"].includes(role)) {
      return NextResponse.json({ error: "角色無效" }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "密碼至少需要 6 個字元" }, { status: 400 });
    }

    await connectDB();

    const existing = await User.findOne({ username });
    if (existing) {
      return NextResponse.json({ error: "用戶名已存在" }, { status: 409 });
    }

    let schoolId: string | null = null;
    let subjects: Subject[] = [];
    // Only teachers carry a student-data permission; left undefined otherwise.
    let dataSubjects: Subject[] | undefined;
    let classes: Awaited<ReturnType<typeof resolveClassesForSchool>> = [];

    if (role === "admin") {
      // Admins are global and have no school / subjects / classes.
      schoolId = null;
      subjects = [];
    } else {
      schoolId = (body.school ?? "").toString() || null;
      if (!schoolId) {
        return NextResponse.json({ error: "老師和學生必須綁定學校" }, { status: 400 });
      }
      const school = await School.findById(schoolId);
      if (!school) {
        return NextResponse.json({ error: "學校不存在" }, { status: 400 });
      }
      // Subjects must be a subset of what the school has enabled.
      const requested = sanitizeSubjects(body.subjects);
      subjects = requested.filter((s) => school.enabledSubjects.includes(s));

      if (role === "teacher") {
        // Default a new teacher's data access to the subjects they teach.
        const requestedData =
          body.dataSubjects === undefined ? subjects : sanitizeSubjects(body.dataSubjects);
        dataSubjects = requestedData.filter((s) => school.enabledSubjects.includes(s));
      }

      // Classes must belong to the same school as the user.
      classes = await resolveClassesForSchool(body.classes, school._id);
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      username,
      hashedPassword,
      displayName,
      role,
      school: schoolId,
      subjects,
      dataSubjects,
      classes,
    });

    return NextResponse.json(
      {
        id: String(user._id),
        username: user.username,
        displayName: user.displayName,
        role: user.role,
        schoolId,
        subjects: user.subjects,
        dataSubjects: user.dataSubjects ?? null,
        classes: classes.map((id) => String(id)),
        createdAt: user.createdAt,
      },
      { status: 201 }
    );
  } catch (err) {
    // The findOne check above is not atomic, so a concurrent create can still
    // trip the unique index on `username`. Report it as the same conflict the
    // pre-check would have returned rather than a generic 500.
    if (isDuplicateKeyError(err)) {
      return NextResponse.json({ error: "用戶名已存在" }, { status: 409 });
    }
    console.error("[admin/users:POST]", err);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}
