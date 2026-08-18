import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { User, resolveAuthProvider } from "@/models/User";
import { establishSession } from "@/lib/auth-session";
import {
  EdConnectError,
  exchangeCodeForToken,
  fetchEdConnectProfile,
  getEdConnectConfig,
  isEdConnectEnabled,
  profileIdToUsername,
} from "@/lib/edconnect";
import { STATE_COOKIE, consumeState, stateCookieOptions } from "@/lib/sso-state";
import { redirectToApp, redirectToLogin, type SsoErrorCode } from "@/lib/sso-redirect";

export const runtime = "nodejs";

/**
 * GET /api/auth/sso/edconnect/callback — finish the EdConnect login.
 *
 * The account must already exist: this route never creates one. Provisioning is
 * an admin act (/admin/users and the bulk import), because school, role,
 * subjects and classes are decisions this app makes, not facts EdConnect can
 * tell us — the spec only releases school and class fields to applications the
 * school has separately authorized, and none of that maps onto the School and
 * Class documents that every permission check here reads.
 *
 * Matching is `profile_id` → `User.username`, and the account must additionally
 * be marked `authProvider: "edconnect"`. The second condition is what stops a
 * password account from being entered without its password should its username
 * ever coincide with a valid profile_id.
 */
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const stateToken = req.cookies.get(STATE_COOKIE)?.value;

  /**
   * Every exit from this route clears the state cookie: it is single-use, and a
   * value left behind would still verify on a later callback.
   */
  const fail = (code: SsoErrorCode, extra?: Record<string, string>): NextResponse => {
    const res = redirectToLogin(req, code, extra);
    res.cookies.set(STATE_COOKIE, "", stateCookieOptions(0));
    return res;
  };

  if (!isEdConnectEnabled()) return fail("sso_disabled");

  // EdConnect reports failures by redirecting here with ?error=. The most
  // common one in practice is access_denied / "Application has not been
  // authorized by school", which is a registration issue rather than a bug.
  const oauthError = searchParams.get("error");
  if (oauthError) {
    console.error(
      "[auth/sso/callback] EdConnect returned an error",
      oauthError,
      searchParams.get("error_description") ?? ""
    );
    return fail("sso_denied");
  }

  const verified = await consumeState(stateToken, searchParams.get("state"));
  if (!verified) {
    // Also the benign case of a bookmarked or expired callback URL, so this is
    // logged without identifying detail.
    console.warn("[auth/sso/callback] state verification failed");
    return fail("sso_state");
  }

  const code = searchParams.get("code");
  if (!code) return fail("sso_no_code");

  try {
    const config = getEdConnectConfig();
    const accessToken = await exchangeCodeForToken(config, code);
    const profile = await fetchEdConnectProfile(config, accessToken);

    const username = profileIdToUsername(profile.profile_id);

    await connectDB();
    const user = await User.findOne({ username });

    // Unprovisioned is the expected day-to-day failure: a transfer student, or
    // a row missing from the imported roster. The identifier is echoed back
    // because it is the only handle that exists — the student cannot read their
    // own profile_id anywhere, so without showing it here neither they nor the
    // administrator can say which account needs creating. It is an opaque
    // identifier, not a credential.
    if (!user || resolveAuthProvider(user.authProvider) !== "edconnect") {
      console.warn(
        "[auth/sso/callback] no EdConnect account for profile_id",
        profile.profile_id,
        user ? "(username exists but is a password account)" : "(no such username)"
      );
      return fail("sso_not_provisioned", { ref: profile.profile_id });
    }

    // Backfill the readable HKEdCity login name the first time we see it, so the
    // admin and teacher screens have something better than the opaque username
    // to show. Never overwritten: what an administrator typed wins.
    const hkedcityId =
      typeof profile.hkedcity_id === "string" ? profile.hkedcity_id.trim() : "";
    if (hkedcityId && !user.edcityLoginId) {
      try {
        await User.updateOne({ _id: user._id }, { $set: { edcityLoginId: hkedcityId } });
      } catch (err) {
        // Cosmetic data only — never block a login for it.
        console.error("[auth/sso/callback] edcityLoginId backfill failed", err);
      }
    }

    // The same school / subject gate the password route runs. Writes the
    // session cookie on success.
    const result = await establishSession(user);
    if (!result.ok) {
      return fail(result.code === "no_school" ? "sso_no_school" : "sso_school_disabled");
    }

    const res = redirectToApp(req, verified.from);
    res.cookies.set(STATE_COOKIE, "", stateCookieOptions(0));
    return res;
  } catch (err) {
    if (err instanceof EdConnectError) {
      console.error("[auth/sso/callback]", err.code, err.message);
      return fail(err.code === "not_configured" ? "sso_disabled" : "sso_failed");
    }
    console.error("[auth/sso/callback]", err);
    return fail("sso_failed");
  }
}
