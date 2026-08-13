import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getTeacherDataAccess } from "@/lib/teacher-data-access";

/**
 * GET /api/teacher/data-access
 *
 * What the signed-in teacher may review on 查看學生數據: the permitted subjects
 * (drives the subject tabs) and their classes (drives the class filter, and
 * lets the page explain itself when no class has been assigned yet).
 *
 * Read from the database on every call so a permission change in the admin
 * takes effect immediately instead of when the teacher's 7-day session cookie
 * expires.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "未登錄" }, { status: 401 });
  }
  if (session.role !== "teacher") {
    return NextResponse.json({ error: "僅教師可查看學生數據" }, { status: 403 });
  }

  return NextResponse.json(await getTeacherDataAccess());
}
