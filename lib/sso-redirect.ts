import "server-only";
import { NextResponse, type NextRequest } from "next/server";

/**
 * In-app redirects for the SSO routes.
 *
 * The Location header is a path, never an absolute URL, because inside the
 * container `req.nextUrl` does not carry this app's public origin. Next builds
 * the request URL from the hostname and port the server was started with
 * (server/next-server.ts `attachRequestMeta`: `${protocol}://${fetchHostname}:${port}`),
 * which in the Docker image is HOSTNAME=0.0.0.0 and PORT=3000 — only the scheme
 * comes from the request, via X-Forwarded-Proto. Redirecting to that URL sends
 * the browser to https://0.0.0.0:3000/login and ERR_ADDRESS_INVALID.
 *
 * proxy.ts can get away with `NextResponse.redirect(req.nextUrl.clone())`
 * because Next rewrites a middleware Location to a relative one whenever its
 * host matches the request's (server/web/adapter.ts, `getRelativeURL`). Route
 * handler responses are passed through untouched, so the ones here have to be
 * relative to begin with. Browsers resolve a relative Location against the URL
 * they actually requested — the public one — so this works behind any proxy and
 * without trusting a forwarded host header.
 *
 * NextURL is still used to build the target: it tracks NEXT_PUBLIC_BASE_PATH and
 * re-adds the prefix on serialization, so these keep working when the app is
 * served under a sub-path.
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

/**
 * 307, matching what NextResponse.redirect() emits by default. Both legs of the
 * flow are GETs, so method preservation is not the point; consistency is.
 */
const REDIRECT_STATUS = 307;

/**
 * Serialize a NextURL down to `path?query`, dropping the (internal) origin.
 *
 * Goes through `toString()` rather than reading `.pathname` so that basePath is
 * applied — the getter returns the pathname without it.
 */
function pathAndQuery(url: URL): string {
  const { pathname, search } = new URL(url.toString());
  return `${pathname}${search}`;
}

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
  return new NextResponse(null, {
    status: REDIRECT_STATUS,
    headers: { Location: pathAndQuery(url) },
  });
}

/** Redirect to an already-validated in-app path (see safeInternalPath). */
export function redirectToApp(req: NextRequest, path: string): NextResponse {
  const url = req.nextUrl.clone();
  url.search = "";
  const [pathname, query = ""] = path.split("?", 2);
  url.pathname = pathname;
  if (query) url.search = `?${query}`;
  return new NextResponse(null, {
    status: REDIRECT_STATUS,
    headers: { Location: pathAndQuery(url) },
  });
}
