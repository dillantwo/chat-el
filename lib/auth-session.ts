import "server-only";
import { School } from "@/models/School";
import { createSession } from "@/lib/session";
import {
  resolveAuthProvider,
  type AuthProvider,
  type Subject,
  type UserRole,
} from "@/models/User";

/**
 * The checks that turn an *authenticated* user into a *signed-in* user.
 *
 * Authentication (does this person hold the credential?) differs per provider:
 * a password comparison for local accounts, an OAuth code exchange for
 * EdConnect. Everything after that is identical, and it is the part with teeth:
 *
 *  - a non-admin must belong to a school, and that school must be active
 *  - subjects are intersected with the school's enabled set, so a grant left
 *    on a user document cannot outlive the school's subscription
 *
 * This lives in one place because there are now two login routes. If EdConnect
 * kept its own copy, a change to the school-disabled rule applied to only one of
 * them would turn SSO into a way around it — the accounts most likely to matter
 * (every student at a school that just got switched off) being exactly the ones
 * that come in through SSO.
 */

/** The minimum a user document needs to provide, so lean() results work too. */
export interface SessionCandidate {
  _id: unknown;
  username: string;
  role: UserRole;
  displayName: string;
  /** ObjectId, populated School document, or null. */
  school?: unknown;
  subjects?: Subject[];
  authProvider?: unknown;
}

export interface EstablishedIdentity {
  username: string;
  role: UserRole;
  displayName: string;
  schoolId: string | null;
  schoolName: string | null;
  subjects: Subject[];
  authProvider: AuthProvider;
}

/**
 * Stable identifiers for the two ways the shared gate can refuse.
 *
 * The password route renders `error` directly, but the OAuth callback can only
 * redirect, and reflecting a message through the URL would mean displaying
 * caller-controlled text. Codes let it map the same refusal to its own copy.
 */
export type EstablishSessionFailure = "no_school" | "school_disabled";

export type EstablishSessionResult =
  | { ok: true; identity: EstablishedIdentity }
  | { ok: false; status: number; error: string; code: EstablishSessionFailure };

/** `school` may arrive populated or not; both reduce to an id string. */
function schoolIdOf(school: unknown): string | null {
  if (!school) return null;
  if (typeof school === "object" && "_id" in (school as Record<string, unknown>)) {
    return String((school as { _id: unknown })._id);
  }
  return String(school);
}

/**
 * Run the shared gate and, on success, write the session cookie.
 *
 * Returns a discriminated result rather than throwing so each caller can render
 * the failure in its own idiom — JSON for the password form, a redirect with an
 * error code for the OAuth callback.
 */
export async function establishSession(
  user: SessionCandidate
): Promise<EstablishSessionResult> {
  const authProvider = resolveAuthProvider(user.authProvider);
  const schoolId = schoolIdOf(user.school);

  const school = schoolId
    ? await School.findById(schoolId)
        .select("name active enabledSubjects")
        .lean<{ name: string; active: boolean; enabledSubjects?: Subject[] } | null>()
    : null;

  if (user.role !== "admin") {
    // A dangling school reference means the school row was removed from under
    // the user; treat it the same as never having had one.
    if (!school) {
      return {
        ok: false,
        status: 403,
        error: "帳戶未綁定學校，請聯絡管理員",
        code: "no_school",
      };
    }
    if (!school.active) {
      return {
        ok: false,
        status: 403,
        error: "學校已停用，請聯絡管理員",
        code: "school_disabled",
      };
    }
  }

  // A user can never hold a subject their school does not offer, even if the
  // grant is still on their document. Admins are global and keep theirs as-is.
  const granted = user.subjects ?? [];
  const subjects =
    user.role === "admin" || !school
      ? granted
      : granted.filter((s) => (school.enabledSubjects ?? []).includes(s));

  const identity: EstablishedIdentity = {
    username: user.username,
    role: user.role,
    displayName: user.displayName,
    schoolId: school ? schoolId : null,
    schoolName: school ? school.name : null,
    subjects,
    authProvider,
  };

  await createSession({
    userId: String(user._id),
    ...identity,
  });

  return { ok: true, identity };
}
