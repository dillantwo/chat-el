import { NextRequest, NextResponse } from "next/server";
import { buildAuthorizeUrl, getEdConnectConfig, isEdConnectEnabled } from "@/lib/edconnect";
import { STATE_COOKIE, issueState, safeInternalPath, stateCookieOptions } from "@/lib/sso-state";
import { redirectToLogin } from "@/lib/sso-redirect";

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

  try {
    const config = getEdConnectConfig();
    const { state, token } = await issueState(from);

    const res = NextResponse.redirect(buildAuthorizeUrl(config, state));
    res.cookies.set(STATE_COOKIE, token, stateCookieOptions());
    return res;
  } catch (err) {
    console.error("[auth/sso/start]", err);
    return redirectToLogin(req, "sso_disabled");
  }
}
