import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { hashPassword } from "@/lib/password";
import { User, ALL_SUBJECTS, resolveAuthProvider, type Subject } from "@/models/User";
import { School } from "@/models/School";
import { requireAdmin } from "@/lib/admin-auth";
import { resolveClassesForSchool } from "@/lib/class-assignment";

function sanitizeSubjects(input: unknown): Subject[] {
  if (!Array.isArray(input)) return [];
  return input.filter((s): s is Subject => ALL_SUBJECTS.includes(s as Subject));
}

// PATCH /api/admin/users/[id] — update display name, password, school,
// subjects and (for teachers) student-data view permissions
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

    const user = await User.findById(id);
    if (!user) {
      return NextResponse.json({ error: "使用者不存在" }, { status: 404 });
    }

    if (typeof body.displayName === "string" && body.displayName.trim()) {
      user.displayName = body.displayName.trim();
    }

    const isSso = resolveAuthProvider(user.authProvider) === "edconnect";

    if (typeof body.password === "string" && body.password) {
      // An EdConnect account authenticates only through EdConnect. Giving it a
      // password would create a second way in, and since its username is the
      // publicly-issued profile_id, that second way in would be a
      // guessable-username account — refuse rather than silently ignore, so the
      // caller learns the field had no effect.
      if (isSso) {
        return NextResponse.json(
          { error: "EdCity 帳戶不能設定密碼" },
          { status: 400 }
        );
      }
      if (body.password.length < 6) {
        return NextResponse.json({ error: "密碼至少需要 6 個字元" }, { status: 400 });
      }
      user.hashedPassword = await hashPassword(body.password);
    }

    // Readable HKEdCity login name. Only meaningful on SSO accounts, and an
    // empty string clears it.
    if (isSso && typeof body.edcityLoginId === "string") {
      const trimmed = body.edcityLoginId.trim();
      user.edcityLoginId = trimmed || undefined;
    }

    // Only teacher/student carry school + subjects + classes.
    if (user.role !== "admin") {
      const previousSchoolId = user.school ? String(user.school) : null;

      if (body.school !== undefined) {
        const school = await School.findById(body.school);
        if (!school) {
          return NextResponse.json({ error: "學校不存在" }, { status: 400 });
        }
        user.school = school._id as typeof user.school;
      }

      const schoolChanged = previousSchoolId !== (user.school ? String(user.school) : null);
      const school = await School.findById(user.school);
      const enabled = school?.enabledSubjects ?? [];

      if (body.subjects !== undefined) {
        user.subjects = sanitizeSubjects(body.subjects).filter((s) => enabled.includes(s));
      }

      if (user.role === "teacher") {
        if (body.dataSubjects !== undefined) {
          user.dataSubjects = sanitizeSubjects(body.dataSubjects).filter((s) =>
            enabled.includes(s)
          );
        } else if (Array.isArray(user.dataSubjects)) {
          // Moving a teacher to another school must not carry over access to
          // subjects the new school does not offer.
          user.dataSubjects = user.dataSubjects.filter((s) => enabled.includes(s));
        }
      }

      if (body.classes !== undefined) {
        user.classes = (await resolveClassesForSchool(
          body.classes,
          user.school
        )) as typeof user.classes;
      } else if (schoolChanged) {
        // Classes belong to a single school, so a transfer invalidates them all.
        user.classes = [] as unknown as typeof user.classes;
      }
    } else {
      // Admins are global: no student-data permission and no classes.
      user.dataSubjects = undefined;
      user.classes = [] as unknown as typeof user.classes;
    }

    await user.save();

    return NextResponse.json({
      id: String(user._id),
      username: user.username,
      authProvider: resolveAuthProvider(user.authProvider),
      edcityLoginId: user.edcityLoginId ?? null,
      displayName: user.displayName,
      role: user.role,
      schoolId: user.school ? user.school.toString() : null,
      subjects: user.subjects,
      dataSubjects: user.dataSubjects ?? null,
      classes: (user.classes ?? []).map((id) => String(id)),
    });
  } catch (err) {
    console.error("[admin/users/[id]:PATCH]", err);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}

// DELETE /api/admin/users/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "需要管理員權限" }, { status: 403 });
  }

  const { id } = await params;

  // Prevent admins from deleting themselves.
  if (session.userId === id) {
    return NextResponse.json({ error: "不能刪除自己的帳戶" }, { status: 400 });
  }

  try {
    await connectDB();
    const deleted = await User.findByIdAndDelete(id);
    if (!deleted) {
      return NextResponse.json({ error: "使用者不存在" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[admin/users/[id]:DELETE]", err);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}
