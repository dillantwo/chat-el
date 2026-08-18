import { NextResponse } from "next/server";
import { createSession, deleteSession, getSession } from "@/lib/session";
import { getAccessibleTopics, getSubjectAccess } from "@/lib/subject-access";
import { resolveAuthProvider } from "@/models/User";

export const runtime = "nodejs";

/**
 * The client's view of who it is. Subjects and topics are resolved from the
 * database, not from the session cookie, so closing either one in 學校管理 hides
 * the matching card immediately instead of at the user's next login.
 *
 * `topics` is a list of `subject:topic` keys the caller may open. It is not
 * stored in the cookie — only the subject list is, because that is all the
 * proxy's optimistic check needs. When the cookie's subjects disagree with the
 * database the cookie is re-issued to bring the proxy back in line.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "未登錄" }, { status: 401 });
  }

  const access = await getSubjectAccess();

  // The account was deleted, unbound from its school, or its school was
  // disabled after the cookie was issued: drop the session.
  if (!access.ok) {
    await deleteSession();
    return NextResponse.json({ error: access.message }, { status: 401 });
  }

  const subjects = access.subjects;
  const cookieSubjects = session.subjects ?? [];
  const drifted =
    cookieSubjects.length !== subjects.length ||
    !subjects.every((s) => cookieSubjects.includes(s));

  if (drifted) {
    await createSession({
      userId: session.userId,
      username: session.username,
      role: session.role,
      displayName: session.displayName,
      schoolId: session.schoolId ?? null,
      schoolName: session.schoolName ?? null,
      subjects,
      // Carried over deliberately. Re-issuing without it would turn an
      // EdConnect session into a "local" one, and logout would then skip
      // ending the EdConnect session — leaving the next person on a shared
      // machine one click from the previous student's account.
      authProvider: resolveAuthProvider(session.authProvider),
    });
  }

  return NextResponse.json({
    username: session.username,
    role: session.role,
    displayName: session.displayName,
    schoolId: session.schoolId ?? null,
    schoolName: session.schoolName ?? null,
    subjects,
    authProvider: resolveAuthProvider(session.authProvider),
    topics: await getAccessibleTopics(),
  });
}
