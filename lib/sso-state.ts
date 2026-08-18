import "server-only";
import { randomBytes } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { useSecureCookie } from "@/lib/session";

/**
 * CSRF protection for the EdConnect authorization-code flow.
 *
 * EdConnect offers no PKCE and no nonce, so `state` is the only thing standing
 * between the callback and an attacker-supplied `code`. It has to satisfy three
 * things at once, which is why it is a signed cookie rather than a server-side
 * entry:
 *
 *  - It must survive a round trip through a third party, so it cannot live in
 *    process memory: docker-compose runs `replicas: 3` behind nginx, and the
 *    container that issues the redirect is usually not the one that handles the
 *    callback. A Map would fail roughly two times in three.
 *  - It must be tamper-proof, so the value is signed rather than merely opaque.
 *  - It must expire quickly. Ten minutes is enough for a real login (including
 *    typing a password at EdConnect) and short enough that a leaked authorize
 *    URL is not a lasting liability.
 *
 * `sameSite: "lax"` is required, not merely convenient: the return leg is a
 * top-level GET initiated by EdConnect, and "strict" would withhold the cookie
 * and break every login. This matches the session cookie in lib/session.ts.
 */

const STATE_COOKIE = "edc_oauth_state";
const STATE_TTL_SECONDS = 600;
/**
 * Distinguishes a state token from a session token. Both are HS256 over
 * SESSION_SECRET, so without a checked subject a stolen state token would be a
 * candidate session token and vice versa.
 */
const STATE_SUBJECT = "edconnect-oauth-state";

export { STATE_COOKIE };

function getEncodedKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET env variable is not set");
  return new TextEncoder().encode(secret);
}

/** Cookie attributes for the state cookie, shared by the set and clear paths. */
export function stateCookieOptions(maxAge: number = STATE_TTL_SECONDS) {
  return {
    httpOnly: true,
    secure: useSecureCookie(),
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export interface IssuedState {
  /** The opaque value sent to EdConnect as ?state=. */
  state: string;
  /** The signed token to store in the state cookie. */
  token: string;
}

export async function issueState(from: string): Promise<IssuedState> {
  const state = randomBytes(16).toString("base64url");
  const token = await new SignJWT({ state, from })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(STATE_SUBJECT)
    .setIssuedAt()
    .setExpirationTime(`${STATE_TTL_SECONDS}s`)
    .sign(getEncodedKey());

  return { state, token };
}

/**
 * Verify the cookie against the `state` EdConnect echoed back.
 *
 * Returns the post-login destination on success, null on any failure. Both
 * halves must be present and must agree: the signature proves we issued it, the
 * comparison proves this callback belongs to the flow this browser started.
 */
export async function consumeState(
  token: string | undefined,
  stateFromQuery: string | null
): Promise<{ from: string } | null> {
  if (!token || !stateFromQuery) return null;

  try {
    const { payload } = await jwtVerify(token, getEncodedKey(), {
      algorithms: ["HS256"],
      subject: STATE_SUBJECT,
    });

    if (payload.state !== stateFromQuery) return null;

    const from = typeof payload.from === "string" ? payload.from : "/";
    return { from: safeInternalPath(from) ?? "/" };
  } catch {
    return null;
  }
}

/**
 * Reduce a caller-supplied `from` to a safe in-app destination.
 *
 * The value survives a round trip through EdConnect and is then used as a
 * redirect target, so unchecked it is an open redirect: `?from=https://evil.example`
 * would turn our own login link into a way to bounce users off-site with our
 * domain in the address bar. Only a single-slash absolute path is accepted —
 * "//host" is rejected because browsers read it as protocol-relative, and a
 * backslash is rejected because some parsers normalize it to a slash.
 */
export function safeInternalPath(input: string | null | undefined): string | null {
  if (!input) return null;
  if (!input.startsWith("/")) return null;
  if (input.startsWith("//") || input.startsWith("/\\")) return null;
  if (input.includes("\\")) return null;
  return input;
}
