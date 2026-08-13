import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { getSession } from "@/lib/session";
import { User, ALL_SUBJECTS, type Subject, type UserRole } from "@/models/User";
import { School } from "@/models/School";
import { SUBJECT_TOPICS, topicKey } from "@/lib/topics";

/**
 * Authorization for the subject areas (/math, /chinese, /english, /science,
 * /humanities and their API routes).
 *
 * Permissions are read from the database on every request, never from the
 * session cookie. The cookie is signed for 7 days and is only re-issued at
 * login, so a JWT copy of `subjects` keeps granting a subject long after an
 * admin removed it from the school in 學校管理. `proxy.ts` can only do the
 * cookie-based optimistic check; this module is the real gate.
 *
 * A user may enter a subject only when *both* hold:
 *  1. the subject is in `School.enabledSubjects` (school subscription), and
 *  2. the subject is in `User.subjects` (per-user grant).
 *
 * One level down, a topic is open unless the school listed it in
 * `School.disabledTopics` (a blocklist, so new topics default to open).
 *
 * Admins are global, have no school, and bypass all of these checks.
 */

export type SubjectAccess =
  | {
      ok: true;
      userId: string;
      role: UserRole;
      schoolId: string | null;
      /** Subjects the user may access right now, per the database. */
      subjects: Subject[];
      /** `subject:topic` keys the school has closed. Always empty for admins. */
      disabledTopics: string[];
    }
  | { ok: false; status: 401 | 403; message: string };

type UserPermissionDoc = {
  _id: mongoose.Types.ObjectId;
  role: UserRole;
  school: mongoose.Types.ObjectId | null;
  subjects?: Subject[];
};

type SchoolPermissionDoc = {
  enabledSubjects?: Subject[];
  disabledTopics?: string[];
  active?: boolean;
};

async function loadSubjectAccess(): Promise<SubjectAccess> {
  const session = await getSession();
  if (!session) return { ok: false, status: 401, message: "未登錄" };

  if (session.role === "admin") {
    return {
      ok: true,
      userId: session.userId,
      role: "admin",
      schoolId: null,
      subjects: [...ALL_SUBJECTS],
      disabledTopics: [],
    };
  }

  await connectDB();

  const user = await User.findById(session.userId)
    .select({ role: 1, school: 1, subjects: 1 })
    .lean<UserPermissionDoc | null>();

  if (!user) return { ok: false, status: 401, message: "帳戶不存在，請重新登入" };

  // The role may have been changed by an admin after the cookie was issued.
  if (user.role === "admin") {
    return {
      ok: true,
      userId: String(user._id),
      role: "admin",
      schoolId: null,
      subjects: [...ALL_SUBJECTS],
      disabledTopics: [],
    };
  }

  if (!user.school) {
    return { ok: false, status: 403, message: "帳戶未綁定學校，請聯絡管理員" };
  }

  const school = await School.findById(user.school)
    .select({ enabledSubjects: 1, disabledTopics: 1, active: 1 })
    .lean<SchoolPermissionDoc | null>();

  if (!school) {
    return { ok: false, status: 403, message: "帳戶未綁定學校，請聯絡管理員" };
  }
  if (school.active === false) {
    return { ok: false, status: 403, message: "學校已停用，請聯絡管理員" };
  }

  const enabled = school.enabledSubjects ?? [];

  return {
    ok: true,
    userId: String(user._id),
    role: user.role,
    schoolId: String(user.school),
    subjects: (user.subjects ?? []).filter((s) => enabled.includes(s)),
    disabledTopics: school.disabledTopics ?? [],
  };
}

/**
 * The current user's effective subject access, deduplicated per request so a
 * layout and the pages/handlers below it share one pair of queries.
 */
export const getSubjectAccess = cache(loadSubjectAccess);

export async function canAccessSubject(subject: Subject): Promise<boolean> {
  const access = await getSubjectAccess();
  return access.ok && access.subjects.includes(subject);
}

/**
 * Gate a server component (typically a subject `layout.tsx`). Sends the user to
 * the login page when the session is gone, otherwise back to the dashboard with
 * `?denied=<subject>` — the same signal `proxy.ts` uses.
 */
export async function requireSubjectPage(subject: Subject): Promise<void> {
  const access = await getSubjectAccess();

  if (!access.ok) {
    if (access.status === 401) redirect(`/login?from=/${subject}`);
    redirect(`/?denied=${subject}`);
  }

  if (!access.subjects.includes(subject)) {
    redirect(`/?denied=${subject}`);
  }
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Gate a route handler. Returns the response to bail out with, or `null` when
 * the request may proceed:
 *
 *     const denied = await requireSubjectApi("humanities");
 *     if (denied) return denied;
 */
export async function requireSubjectApi(subject: Subject): Promise<Response | null> {
  const access = await getSubjectAccess();

  if (!access.ok) return jsonError(access.message, access.status);
  if (!access.subjects.includes(subject)) {
    return jsonError("無權存取此科目", 403);
  }

  return null;
}

/**
 * Every topic the current user can open, as `subject:topic` keys, limited to
 * the subjects they hold. This is what the subject landing pages filter their
 * cards against.
 */
export async function getAccessibleTopics(): Promise<string[]> {
  const access = await getSubjectAccess();
  if (!access.ok) return [];

  return access.subjects.flatMap((subject) =>
    (SUBJECT_TOPICS[subject] ?? [])
      .map((t) => topicKey(subject, t.key))
      .filter((key) => !access.disabledTopics.includes(key)),
  );
}

export async function canAccessTopic(subject: Subject, topic: string): Promise<boolean> {
  const access = await getSubjectAccess();

  return (
    access.ok &&
    access.subjects.includes(subject) &&
    !access.disabledTopics.includes(topicKey(subject, topic))
  );
}

/**
 * Gate a server component for one topic (a topic's `layout.tsx`). A closed topic
 * sends the user back to the subject's landing page, where the card is hidden
 * anyway, rather than all the way to the dashboard.
 */
export async function requireTopicPage(subject: Subject, topic: string): Promise<void> {
  const access = await getSubjectAccess();

  if (!access.ok) {
    if (access.status === 401) redirect(`/login?from=/${subject}`);
    redirect(`/?denied=${subject}`);
  }

  if (!access.subjects.includes(subject)) {
    redirect(`/?denied=${subject}`);
  }

  if (access.disabledTopics.includes(topicKey(subject, topic))) {
    redirect(`/${subject}?denied=${topic}`);
  }
}

/**
 * Gate a route handler that belongs to a single topic:
 *
 *     const denied = await requireTopicApi("humanities", "water-resources");
 *     if (denied) return denied;
 */
export async function requireTopicApi(
  subject: Subject,
  topic: string,
): Promise<Response | null> {
  const access = await getSubjectAccess();

  if (!access.ok) return jsonError(access.message, access.status);
  if (!access.subjects.includes(subject)) {
    return jsonError("無權存取此科目", 403);
  }
  if (access.disabledTopics.includes(topicKey(subject, topic))) {
    return jsonError("此主題未開放", 403);
  }

  return null;
}
