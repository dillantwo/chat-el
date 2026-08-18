import "server-only";
import { NextResponse, type NextRequest } from "next/server";

/**
 * In-app redirects for the SSO routes.
 *
 * Built from `req.nextUrl.clone()` rather than `new URL(path, req.url)` because
 * NextURL tracks NEXT_PUBLIC_BASE_PATH: cloning keeps the prefix and re-adds it
 * on serialization, so these keep working when the app is served under a
 * sub-path. proxy.ts builds its /login redirects the same way.
 */

/** Error codes the login page can translate. Kept in one place on purpose. */
export type SsoErrorCode =
  /** EDCONNECT_* env vars missing, so the flow was never usable. */
  | "sso_disabled"
  /** EdConnect itself returned ?error=, e.g. the school has not authorized us. */
  | "sso_denied"
  /** state cookie missing, expired, forged, or not matching the echoed value. */
  | "sso_state"
  /** Callback reached without ?code=. */
  | "sso_no_code"
  /** Token exchange or profile fetch failed. */
  | "sso_failed"
  /** No account holds this profile_id, or it belongs to a password account. */
  | "sso_not_provisioned"
  /** The account exists but is not bound to a school. */
  | "sso_no_school"
  /** The account's school is disabled. */
  | "sso_school_disabled";

export function redirectToLogin(
  req: NextRequest,
  error: SsoErrorCode,
  extra?: Record<string, string>
): NextResponse {
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  url.searchParams.set("error", error);
  for (const [key, value] of Object.entries(extra ?? {})) {
    url.searchParams.set(key, value);
  }
  return NextResponse.redirect(url);
}

/** Redirect to an already-validated in-app path (see safeInternalPath). */
export function redirectToApp(req: NextRequest, path: string): NextResponse {
  const url = req.nextUrl.clone();
  url.search = "";
  const [pathname, query = ""] = path.split("?", 2);
  url.pathname = pathname;
  if (query) url.search = `?${query}`;
  return NextResponse.redirect(url);
}
