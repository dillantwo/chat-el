import "server-only";
import { getSession, type SessionPayload } from "@/lib/session";

/**
 * Resolve the current session and require the "admin" role.
 * Returns the session when authorized, otherwise null.
 *
 * API routes should use this even though proxy.ts already guards /api/admin,
 * to keep authorization checks colocated with the data access (defense in depth).
 */
export async function requireAdmin(): Promise<SessionPayload | null> {
  const session = await getSession();
  if (!session || session.role !== "admin") return null;
  return session;
}
