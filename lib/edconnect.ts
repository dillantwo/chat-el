import "server-only";

/**
 * HKEdCity EdConnect 2.1 OAuth 2.0 client.
 *
 * EdConnect is CAS with an OAuth 2.0 facade: four endpoints, no OIDC discovery,
 * no id_token, no scopes and no PKCE. `state` is therefore the only CSRF
 * defence in the flow, which is why lib/sso-state.ts treats it as strictly as it
 * does.
 *
 *   GET  {base}/cas/oauth2.0/authorize   → redirects back with ?code=&state=
 *   POST {base}/cas/oauth2.0/token       → access_token
 *   GET  {base}/cas/oauth2.0/profile     → user information
 *   GET  {base}/cas/logout?url=...       → ends the EdConnect session
 *
 * Sandbox and production differ only by host, so EDCONNECT_BASE_URL is the
 * single switch between them:
 *   sandbox    https://edconnect2-sandbox.hkedcity.net
 *   production https://edconnect2.hkedcity.net
 *
 * Spec: "EdConnect 2.1 API Specification" v1.6, OAuth 2.0 Integration section.
 */

export interface EdConnectConfig {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  /**
   * Must byte-for-byte equal the URI registered with HKEdCity — the authorize
   * endpoint compares it against the registration and rejects a mismatch.
   *
   * Configured explicitly rather than derived from the incoming request: in
   * production the app sits behind nginx, so the container sees http:// and a
   * proxied Host, and NEXT_PUBLIC_BASE_PATH may add a prefix. Deriving it would
   * make the value depend on header forwarding being right.
   */
  redirectUri: string;
}

/** How long to wait on EdConnect before giving up, in ms. */
const REQUEST_TIMEOUT_MS = 10_000;

/**
 * The documented profile fields. Almost everything is optional by design: the
 * spec gates fields on authorization level, and an application not yet
 * authorized by EdCity or by the school receives only the first few. This
 * integration deliberately depends on `profile_id` alone, so it works at the
 * lowest level — the rest is captured for display and diagnostics.
 */
export interface EdConnectProfile {
  /** Internal unique id for the user. The only field we authenticate on. */
  profile_id: string;
  display_name?: string;
  legacy_profile_id?: number | string;
  /** The readable login name, e.g. "hke-stud001". */
  hkedcity_id?: string;
  last_update?: string;
  /** Teacher / Staff / Student / Parent / SchoolAdmin / Other. */
  roles?: string[];
  student_enname?: string;
  student_chname?: string;
  school_code?: string;
  edcity_school_code?: string;
  school_enname?: string;
  school_chname?: string;
  sch_year?: number | string;
  class_lvl?: string;
  class_name?: string;
  class_number?: number | string;
  [key: string]: unknown;
}

/** Raised for any EdConnect-side failure, so callers can map it to one code. */
export class EdConnectError extends Error {
  constructor(
    message: string,
    readonly code:
      | "not_configured"
      | "token_exchange_failed"
      | "profile_failed"
      | "invalid_profile"
  ) {
    super(message);
    this.name = "EdConnectError";
  }
}

function trimmedEnv(name: string): string {
  return (process.env[name] ?? "").trim();
}

/**
 * Whether the EdConnect login route should be offered at all.
 *
 * Requires the credentials to be present, not merely the flag to be on, so a
 * half-finished .env leaves the button off instead of producing a redirect to a
 * malformed authorize URL.
 */
export function isEdConnectEnabled(): boolean {
  if (trimmedEnv("EDCONNECT_ENABLED").toLowerCase() === "false") return false;
  return Boolean(
    trimmedEnv("EDCONNECT_BASE_URL") &&
      trimmedEnv("EDCONNECT_CLIENT_ID") &&
      trimmedEnv("EDCONNECT_REDIRECT_URI")
  );
}

/** Read and validate the configuration. Throws when it is incomplete. */
export function getEdConnectConfig(): EdConnectConfig {
  const baseUrl = trimmedEnv("EDCONNECT_BASE_URL").replace(/\/+$/, "");
  const clientId = trimmedEnv("EDCONNECT_CLIENT_ID");
  // Empty is legitimate: the spec says client_secret is left blank when a
  // custom_uri is registered instead of a redirect_uri.
  const clientSecret = trimmedEnv("EDCONNECT_CLIENT_SECRET");
  const redirectUri = trimmedEnv("EDCONNECT_REDIRECT_URI");

  const missing = [
    ["EDCONNECT_BASE_URL", baseUrl],
    ["EDCONNECT_CLIENT_ID", clientId],
    ["EDCONNECT_REDIRECT_URI", redirectUri],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length) {
    throw new EdConnectError(
      `EdConnect is not configured: ${missing.join(", ")} unset`,
      "not_configured"
    );
  }

  return { baseUrl, clientId, clientSecret, redirectUri };
}

export function buildAuthorizeUrl(config: EdConnectConfig, state: string): string {
  const url = new URL(`${config.baseUrl}/cas/oauth2.0/authorize`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("state", state);
  return url.toString();
}

/**
 * End the EdConnect session and come back to `returnTo`.
 *
 * The `url` parameter must be urlencoded; URLSearchParams does that. Without
 * this hop a user who logs out of this app is still signed in at EdConnect and
 * the next click on the login button walks straight back in with no prompt,
 * which on a shared classroom machine means the next student lands in the
 * previous student's account.
 */
export function buildLogoutUrl(config: EdConnectConfig, returnTo: string): string {
  const url = new URL(`${config.baseUrl}/cas/logout`);
  url.searchParams.set("url", returnTo);
  return url.toString();
}

/** Parse a token response that may be JSON or form-encoded (see below). */
function parseTokenBody(body: string, contentType: string): Record<string, string> {
  const looksJson =
    contentType.includes("json") || body.trimStart().startsWith("{");

  if (looksJson) {
    try {
      const parsed = JSON.parse(body) as Record<string, unknown>;
      return Object.fromEntries(
        Object.entries(parsed).map(([k, v]) => [k, String(v)])
      );
    } catch {
      // Fall through to the form-encoded reading below.
    }
  }

  return Object.fromEntries(new URLSearchParams(body).entries());
}

/**
 * Exchange the authorization code for an access token.
 *
 * The spec documents a JSON response, but CAS has historically answered this
 * endpoint with `access_token=...&expires_in=...` instead, and the deployed
 * version is not something this app controls. Accepting both costs a dozen
 * lines and removes an entire class of first-deployment failure, so
 * parseTokenBody sniffs the body rather than trusting Content-Type.
 */
export async function exchangeCodeForToken(
  config: EdConnectConfig,
  code: string
): Promise<string> {
  const form = new URLSearchParams({
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    grant_type: "authorization_code",
  });

  let res: Response;
  try {
    res = await fetch(`${config.baseUrl}/cas/oauth2.0/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: form.toString(),
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    throw new EdConnectError(
      `token request failed: ${err instanceof Error ? err.message : "unknown"}`,
      "token_exchange_failed"
    );
  }

  const body = await res.text();
  const parsed = parseTokenBody(body, res.headers.get("content-type") ?? "");

  if (!res.ok || parsed.error) {
    // parsed.error / error_description are EdConnect's own codes and safe to
    // log, unlike the raw body which would contain a token on success paths.
    throw new EdConnectError(
      `token endpoint returned ${res.status}${
        parsed.error ? ` ${parsed.error}: ${parsed.error_description ?? ""}` : ""
      }`,
      "token_exchange_failed"
    );
  }

  const accessToken = parsed.access_token;
  if (!accessToken) {
    throw new EdConnectError(
      "token response contained no access_token",
      "token_exchange_failed"
    );
  }

  return accessToken;
}

/**
 * Fetch the user's profile.
 *
 * The token goes in the query string because that is what the spec specifies,
 * which means it lands in EdConnect's access log. Nothing to do about their
 * side; on ours, never log this URL.
 */
export async function fetchEdConnectProfile(
  config: EdConnectConfig,
  accessToken: string
): Promise<EdConnectProfile> {
  const url = new URL(`${config.baseUrl}/cas/oauth2.0/profile`);
  url.searchParams.set("access_token", accessToken);

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    throw new EdConnectError(
      `profile request failed: ${err instanceof Error ? err.message : "unknown"}`,
      "profile_failed"
    );
  }

  const body = await res.text();
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(body) as Record<string, unknown>;
  } catch {
    throw new EdConnectError(
      `profile endpoint returned ${res.status} with a non-JSON body`,
      "profile_failed"
    );
  }

  if (!res.ok || typeof parsed.error === "string") {
    throw new EdConnectError(
      `profile endpoint returned ${res.status}${
        parsed.error ? ` ${String(parsed.error)}: ${String(parsed.error_description ?? "")}` : ""
      }`,
      "profile_failed"
    );
  }

  const profileId = typeof parsed.profile_id === "string" ? parsed.profile_id.trim() : "";
  if (!profileId) {
    throw new EdConnectError("profile response contained no profile_id", "invalid_profile");
  }

  return { ...parsed, profile_id: profileId } as EdConnectProfile;
}

/**
 * This app's external origin, taken from the registered redirect URI.
 *
 * Reusing that value rather than adding a second "what is our public URL"
 * setting means there is only one place to get wrong, and it is a place that
 * fails loudly: a bad redirect_uri is rejected by EdConnect at login. Deriving
 * the origin from the incoming request would instead depend on nginx's
 * X-Forwarded-Proto being set, which fails quietly by producing http:// URLs.
 */
export function appOrigin(config: EdConnectConfig): string {
  return new URL(config.redirectUri).origin;
}

/**
 * The value matched against `User.username`.
 *
 * `username` carries `lowercase: true` in the schema, so the stored form of a
 * profile_id is lowercased. Normalizing here — in one place used by both the
 * callback and the admin import — is what keeps the two sides in agreement;
 * lowercasing on write but not on read would lock every SSO user out.
 */
export function profileIdToUsername(profileId: string): string {
  return profileId.trim().toLowerCase();
}
