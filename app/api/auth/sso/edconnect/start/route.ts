import { NextRequest, NextResponse } from "next/server";
import {
  appOrigin,
  buildAuthorizeUrl,
  buildLogoutUrl,
  getEdConnectConfig,
  isEdConnectEnabled,
} from "@/lib/edconnect";
import { STATE_COOKIE, issueState, safeInternalPath, stateCookieOptions } from "@/lib/sso-state";
import { redirectToLogin } from "@/lib/sso-redirect";
import { basePath } from "@/lib/utils";

// Mongoose is not touched here, but node:crypto is, and the whole flow must stay
// on one runtime so the state cookie is written and read by the same stack.
export const runtime = "nodejs";

/**
 * GET /api/auth/sso/edconnect/start — begin the EdConnect login.
 *
 * Reached by a plain link from the login page, never by fetch(): OAuth needs a
 * top-level navigation so the browser can be handed to EdConnect and brought
 * back. An XHR would follow the redirect internally and land the HTML of
 * EdConnect's login page in a JSON parser.
 *
 * proxy.ts must treat /api/auth/sso as public, or this round trip is bounced to
 * /login before it starts.
 */
export async function GET(req: NextRequest) {
  if (!isEdConnectEnabled()) {
    return redirectToLogin(req, "sso_disabled");
  }

  // Where to land after a successful login. Validated now and again on the way
  // back, since the value makes a round trip through a third party.
  const from = safeInternalPath(req.nextUrl.searchParams.get("from")) ?? "/";

  /**
   * `?renew=1` — end the EdConnect session before starting, so the user is asked
   * who they are instead of being signed in again as whoever last used the
   * browser.
   *
   * Needed because EdConnect is an SSO: with a live CAS session, authorize does
   * not prompt, it answers immediately with a code for the same profile_id. A
   * login that failed on *identity* (the account is not provisioned here, or its
   * school is disabled) therefore repeats forever — the button appears to do
   * nothing, because the round trip is invisible and lands on the same error.
   *
   * The documented logout endpoint is the only lever we have: EdConnect exposes
   * no `prompt=login` / `renew` parameter on authorize (spec v1.6, OAuth 2.0
   * Integration), so the session has to be torn down rather than bypassed. The
   * cost is that it also ends the user's session with other EdCity services in
   * this browser, which is why the login page only asks for this after an
   * identity failure and not on every login.
   */
  const renew = req.nextUrl.searchParams.get("renew") === "1";

  try {
    const config = getEdConnectConfig();

    if (renew) {
      // Comes back here without `renew`, so the second pass proceeds to
      // authorize — with no CAS session left to reuse, EdConnect shows its login
      // form. Absolute because it leaves our origin: EdConnect echoes it back.
      const back = new URL(
        `${appOrigin(config)}${basePath}/api/auth/sso/edconnect/start`
      );
      back.searchParams.set("from", from);
      return NextResponse.redirect(buildLogoutUrl(config, back.toString()));
    }

    const { state, token } = await issueState(from);

    const res = NextResponse.redirect(buildAuthorizeUrl(config, state));
    res.cookies.set(STATE_COOKIE, token, stateCookieOptions());
    return res;
  } catch (err) {
    console.error("[auth/sso/start]", err);
    return redirectToLogin(req, "sso_disabled");
  }
}
