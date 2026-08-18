import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { UserRole, Subject, type AuthProvider } from "@/models/User";

const SESSION_COOKIE = "session";
const EXPIRY_DAYS = 7;

export interface SessionPayload {
  userId: string;
  username: string;
  role: UserRole;
  displayName: string;
  /** School id this user belongs to (null for admins) */
  schoolId: string | null;
  /** School display name (null for admins) */
  schoolName: string | null;
  subjects: Subject[];
  /**
   * How this session was authenticated. Carried in the cookie so logout knows
   * whether to also end the EdConnect session — without it, an SSO user who
   * logs out here is signed straight back in by the still-live IdP session on
   * their next click.
   *
   * Optional because cookies signed before this field existed stay valid for up
   * to 7 days; read it through `resolveAuthProvider()`, which treats a missing
   * value as "local" (the correct answer for every pre-existing session).
   */
  authProvider?: AuthProvider;
  expiresAt: Date;
}

function getEncodedKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET env variable is not set");
  return new TextEncoder().encode(secret);
}

/**
 * Whether the session cookie carries the `Secure` attribute.
 *
 * Browsers discard a Secure cookie that arrives over plain HTTP, so a
 * production build served without TLS can never sign anyone in: the login
 * request succeeds, the cookie is dropped, and the next request is bounced back
 * to /login by proxy.ts.
 *
 * SESSION_COOKIE_SECURE=false is the escape hatch for a deployment that does
 * not have a certificate yet. The session token then travels unencrypted, so
 * remove the override as soon as HTTPS is in place. Unset means "secure in
 * production", which is the right default.
 */
export function useSecureCookie(): boolean {
  const flag = process.env.SESSION_COOKIE_SECURE?.trim().toLowerCase();
  if (flag === "false" || flag === "0") return false;
  if (flag === "true" || flag === "1") return true;
  return process.env.NODE_ENV === "production";
}

export async function encrypt(payload: SessionPayload): Promise<string> {
  return new SignJWT(JSON.parse(JSON.stringify(payload)))
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${EXPIRY_DAYS}d`)
    .sign(getEncodedKey());
}

export async function decrypt(
  token: string | undefined
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getEncodedKey(), {
      algorithms: ["HS256"],
    });
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function createSession(payload: Omit<SessionPayload, "expiresAt">): Promise<void> {
  const expiresAt = new Date(Date.now() + EXPIRY_DAYS * 24 * 60 * 60 * 1000);
  const token = await encrypt({ ...payload, expiresAt });
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: useSecureCookie(),
    expires: expiresAt,
    sameSite: "lax",
    path: "/",
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  return decrypt(token);
}

export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}
