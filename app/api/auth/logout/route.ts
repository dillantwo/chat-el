import { NextResponse } from "next/server";
import { deleteSession, getSession } from "@/lib/session";
import { resolveAuthProvider } from "@/models/User";
import {
  appOrigin,
  buildLogoutUrl,
  getEdConnectConfig,
  isEdConnectEnabled,
} from "@/lib/edconnect";
import { basePath } from "@/lib/utils";

export const runtime = "nodejs";

/**
 * POST /api/auth/logout
 *
 * Always clears this app's session. For a session that came in through
 * EdConnect it additionally returns `redirectTo`, the EdConnect logout URL.
 *
 * The client has to perform that navigation itself, because ending a session at
 * the identity provider requires a top-level request to their domain — a fetch
 * would be a cross-origin call that cannot touch their cookies. Until the client
 * follows it the user is signed out of this app but still signed in at
 * EdConnect, so the login button would let them straight back in without a
 * prompt. On a shared classroom machine that is the next student landing in the
 * previous student's account, which is why this is worth the extra hop.
 */
export async function POST() {
  const session = await getSession();
  const isSso = resolveAuthProvider(session?.authProvider) === "edconnect";

  await deleteSession();

  if (!session || !isSso || !isEdConnectEnabled()) {
    return NextResponse.json({ success: true, redirectTo: null });
  }

  try {
    const config = getEdConnectConfig();
    // EdConnect sends the browser here after tearing down its own session.
    const returnTo = `${appOrigin(config)}${basePath}/login?loggedOut=1`;
    return NextResponse.json({
      success: true,
      redirectTo: buildLogoutUrl(config, returnTo),
    });
  } catch (err) {
    // The local session is already gone, which is the part that matters. Report
    // success and let the client fall back to its normal redirect.
    console.error("[auth/logout] could not build the EdConnect logout URL", err);
    return NextResponse.json({ success: true, redirectTo: null });
  }
}
