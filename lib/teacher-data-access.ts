import "server-only";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { getSession } from "@/lib/session";
import { User, effectiveDataSubjects, type Subject } from "@/models/User";
import { School } from "@/models/School";
import { Class } from "@/models/Class";

/**
 * Authorization + scoping for the teacher-facing 查看學生數據 views.
 *
 * Three rules are enforced here for every student-data endpoint:
 *  1. The teacher must hold the subject (`User.subjects`) and must not have had
 *     student-data access switched off (`User.canViewStudentData`). Holding a
 *     subject is what grants access to that subject's student records — there
 *     is no second, per-subject list to keep in step with the first.
 *  2. Only students of the teacher's own school are ever exposed.
 *  3. Only students who share a class with the teacher are exposed. A teacher
 *     with no class assigned therefore sees nothing.
 *
 * Permissions are read from the database on each request rather than from the
 * session cookie: the cookie lives for 7 days, so a JWT copy would keep
 * granting access after an admin revoked it.
 */

export interface TeacherDataScope {
  teacherId: string;
  /** The school whose students this teacher may review. */
  schoolId: mongoose.Types.ObjectId;
  /** Every subject this teacher may review, not just the requested one. */
  dataSubjects: Subject[];
  /**
   * The classes in scope for this request: all of the teacher's classes, or the
   * single one they filtered down to. Empty means no students are visible.
   */
  classIds: mongoose.Types.ObjectId[];
}

export type TeacherDataScopeResult =
  | { ok: true; scope: TeacherDataScope }
  | { ok: false; status: number; message: string };

export interface ScopedStudent {
  _id: mongoose.Types.ObjectId;
  displayName: string;
  username: string;
}

export interface StudentRecordStats {
  _id: string;
  count: number;
  lastUpdatedAt: Date | null;
}

export interface StudentSummary {
  id: string;
  displayName: string;
  username: string;
  count: number;
  lastUpdatedAt: Date | null;
}

export interface TeacherClassSummary {
  id: string;
  name: string;
  academicYear: string;
}

export function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function toObjectId(id: string): mongoose.Types.ObjectId | null {
  return mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : null;
}

type TeacherPermissionDoc = {
  _id: mongoose.Types.ObjectId;
  school: mongoose.Types.ObjectId | null;
  subjects?: Subject[];
  canViewStudentData?: boolean;
  classes?: mongoose.Types.ObjectId[];
};

type LoadedTeacher = {
  ok: true;
  teacher: TeacherPermissionDoc;
  /**
   * The teacher's subjects, narrowed to what the school still offers, and empty
   * when student-data access is switched off for them. Revoking a subject in
   * 學校管理 therefore takes effect on the next request.
   */
  dataSubjects: Subject[];
};

async function loadTeacher(): Promise<
  LoadedTeacher | { ok: false; status: number; message: string }
> {
  const session = await getSession();
  if (!session) return { ok: false, status: 401, message: "未登錄" };
  if (session.role !== "teacher") {
    return { ok: false, status: 403, message: "僅教師可查看學生數據" };
  }

  await connectDB();

  const teacher = await User.findOne({ _id: session.userId, role: "teacher" })
    .select({ school: 1, subjects: 1, canViewStudentData: 1, classes: 1 })
    .lean<TeacherPermissionDoc | null>();

  if (!teacher) return { ok: false, status: 403, message: "帳戶不存在" };

  if (!teacher.school) {
    return { ok: true, teacher, dataSubjects: [] };
  }

  const school = await School.findById(teacher.school)
    .select({ enabledSubjects: 1, active: 1 })
    .lean<{ enabledSubjects?: Subject[]; active?: boolean } | null>();

  if (!school) return { ok: false, status: 403, message: "帳戶未綁定學校，請聯絡管理員" };
  if (school.active === false) {
    return { ok: false, status: 403, message: "學校已停用，請聯絡管理員" };
  }

  const enabled = school.enabledSubjects ?? [];

  return {
    ok: true,
    teacher,
    dataSubjects: effectiveDataSubjects(teacher).filter((s) => enabled.includes(s)),
  };
}

/**
 * Names of the given classes, limited to the school, newest academic year first.
 */
export async function listTeacherClasses(
  schoolId: mongoose.Types.ObjectId,
  classIds: mongoose.Types.ObjectId[],
): Promise<TeacherClassSummary[]> {
  if (classIds.length === 0) return [];

  const classes = await Class.find({ _id: { $in: classIds }, school: schoolId })
    .select({ name: 1, academicYear: 1 })
    .sort({ academicYear: -1, name: 1 })
    .lean<{ _id: mongoose.Types.ObjectId; name: string; academicYear: string }[]>();

  return classes.map((c) => ({
    id: String(c._id),
    name: String(c.name),
    academicYear: String(c.academicYear),
  }));
}

/**
 * What the signed-in teacher may review: the permitted subjects and the classes
 * whose students they can see. Both are empty for anyone who is not an
 * authorized teacher.
 */
export async function getTeacherDataAccess(): Promise<{
  subjects: Subject[];
  classes: TeacherClassSummary[];
}> {
  const loaded = await loadTeacher();
  if (!loaded.ok || !loaded.teacher.school) return { subjects: [], classes: [] };

  return {
    subjects: loaded.dataSubjects,
    classes: await listTeacherClasses(loaded.teacher.school, loaded.teacher.classes ?? []),
  };
}

/** A teacher who passed rule 1 for a subject, with everything rules 2–3 need. */
export interface AuthorizedTeacher {
  teacherId: mongoose.Types.ObjectId;
  schoolId: mongoose.Types.ObjectId;
  dataSubjects: Subject[];
  /** Every class the teacher belongs to. */
  classIds: mongoose.Types.ObjectId[];
}

/**
 * Rule 1 on its own: the signed-in user is a teacher at an active school who
 * holds `subject` and has not had student-data access switched off.
 *
 * Shared with 提示詞 (lib/teacher-prompts.ts), which reaches the same students
 * the other way round, so the two features can never disagree about which
 * teachers are in scope. `deniedMessage` is what a teacher without the subject
 * is told, since the wording depends on the feature.
 */
export async function requireTeacherSubject(
  subject: Subject,
  deniedMessage = "沒有查看此科目學生數據的權限",
): Promise<{ ok: true; teacher: AuthorizedTeacher } | { ok: false; status: number; message: string }> {
  const loaded = await loadTeacher();
  if (!loaded.ok) return loaded;

  const { teacher, dataSubjects } = loaded;
  if (!teacher.school) {
    return { ok: false, status: 403, message: "帳戶未綁定學校，請聯絡管理員" };
  }

  if (!dataSubjects.includes(subject)) {
    return { ok: false, status: 403, message: deniedMessage };
  }

  return {
    ok: true,
    teacher: {
      teacherId: teacher._id,
      schoolId: teacher.school,
      dataSubjects,
      classIds: teacher.classes ?? [],
    },
  };
}

/**
 * Authorize the current request for one subject's student data.
 *
 * `req` is read for an optional `?classId=`. A class the teacher does not
 * belong to narrows the scope to nothing rather than erroring, so a stale
 * bookmark cannot be used to probe other classes.
 */
export async function requireTeacherDataScope(
  subject: Subject,
  req: Request,
): Promise<TeacherDataScopeResult> {
  const authorized = await requireTeacherSubject(subject);
  if (!authorized.ok) return authorized;

  const { teacher } = authorized;
  const ownClassIds = teacher.classIds;
  const requestedClassId = new URL(req.url).searchParams.get("classId")?.trim();
  let classIds = ownClassIds;

  if (requestedClassId) {
    const requested = toObjectId(requestedClassId);
    classIds = requested
      ? ownClassIds.filter((id) => id.equals(requested))
      : [];
  }

  return {
    ok: true,
    scope: {
      teacherId: String(teacher.teacherId),
      schoolId: teacher.schoolId,
      dataSubjects: teacher.dataSubjects,
      classIds,
    },
  };
}

/**
 * Look up one student, but only within the teacher's school and classes.
 * Returns null when the id is malformed, is not a student, or sits outside that
 * scope — callers should treat all cases the same ("找不到該學生") so the
 * endpoint does not confirm the existence of students the teacher cannot see.
 */
export async function findScopedStudent(
  scope: TeacherDataScope,
  studentId: string,
): Promise<ScopedStudent | null> {
  if (scope.classIds.length === 0) return null;

  const objectId = toObjectId(studentId);
  if (!objectId) return null;

  return User.findOne({
    _id: objectId,
    role: "student",
    school: scope.schoolId,
    classes: { $in: scope.classIds },
  })
    .select({ displayName: 1, username: 1 })
    .lean<ScopedStudent | null>();
}

/**
 * Turn per-user record stats (from a `$group` on `userId`) into a student list,
 * dropping every user outside the teacher's school and classes and sorting the
 * most recently active first.
 */
export async function summarizeStudents(
  scope: TeacherDataScope,
  grouped: StudentRecordStats[],
): Promise<StudentSummary[]> {
  if (scope.classIds.length === 0) return [];

  const objectIds = grouped
    .map((g) => toObjectId(g._id))
    .filter((id): id is mongoose.Types.ObjectId => id !== null);

  if (objectIds.length === 0) return [];

  const students = await User.find({
    _id: { $in: objectIds },
    role: "student",
    school: scope.schoolId,
    classes: { $in: scope.classIds },
  })
    .select({ displayName: 1, username: 1 })
    .lean<ScopedStudent[]>();

  const statsByUserId = new Map(grouped.map((g) => [g._id, g]));

  return students
    .map((s) => {
      const id = String(s._id);
      const stats = statsByUserId.get(id);
      return {
        id,
        displayName: String(s.displayName),
        username: String(s.username),
        count: stats?.count ?? 0,
        lastUpdatedAt: stats?.lastUpdatedAt ?? null,
      };
    })
    .sort((a, b) => {
      const at = a.lastUpdatedAt ? new Date(a.lastUpdatedAt).getTime() : 0;
      const bt = b.lastUpdatedAt ? new Date(b.lastUpdatedAt).getTime() : 0;
      return bt - at;
    });
}
