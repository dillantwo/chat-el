import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const SESSION_COOKIE = "session";
const PUBLIC_FILE = /\.[^/]+$/;

// Routes that are accessible without authentication.
//
// /api/auth/sso covers both legs of the EdConnect OAuth flow. They have to be
// public for the obvious reason that the user is not signed in yet — the start
// leg is the first thing an anonymous visitor clicks, and the callback arrives
// from EdConnect with no session cookie of ours. Guarding them would bounce the
// round trip to /login and make SSO login impossible.
const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/auth/sso", "/api/health"];

// Subject path prefixes – keys must match Subject type values
const SUBJECT_PREFIXES = ["/math", "/chinese", "/english", "/science", "/humanities"];

function getEncodedKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET env variable is not set");
  return new TextEncoder().encode(secret);
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Allow Next.js internals and static assets
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/public") ||
    PUBLIC_FILE.test(pathname)
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;

  if (!token) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  try {
    const { payload } = await jwtVerify(token, getEncodedKey(), { algorithms: ["HS256"] });

    const role = (payload as Record<string, unknown>).role as string | undefined;

    // Admin area: only admins may enter /admin and /api/admin
    if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
      if (role !== "admin") {
        if (pathname.startsWith("/api/")) {
          return NextResponse.json({ error: "需要管理員權限" }, { status: 403 });
        }
        const homeUrl = req.nextUrl.clone();
        homeUrl.pathname = "/";
        homeUrl.searchParams.set("denied", "admin");
        return NextResponse.redirect(homeUrl);
      }
      return NextResponse.next();
    }

    // Teacher area: only teachers may enter /teacher and /api/teacher.
    // Per-subject data permissions are enforced in the route handlers, which
    // read them from the database (the session cookie can be up to 7 days old).
    if (pathname.startsWith("/teacher") || pathname.startsWith("/api/teacher")) {
      if (role !== "teacher") {
        if (pathname.startsWith("/api/")) {
          return NextResponse.json({ error: "僅教師可查看學生數據" }, { status: 403 });
        }
        const homeUrl = req.nextUrl.clone();
        homeUrl.pathname = "/";
        homeUrl.searchParams.set("denied", "teacher");
        return NextResponse.redirect(homeUrl);
      }
      return NextResponse.next();
    }

    // Optimistic subject-level check only. The session cookie is signed for 7
    // days and is refreshed by /api/auth/me, so it can lag behind an admin
    // revoking a subject. The authoritative, database-backed check lives in
    // lib/subject-access.ts and runs in each subject's layout.tsx and in the
    // subject route handlers.
    const matchedPrefix = SUBJECT_PREFIXES.find(
      (p) => pathname === p || pathname.startsWith(p + "/")
    );

    if (matchedPrefix) {
      const subject = matchedPrefix.slice(1); // remove leading "/"
      const subjects: string[] = (payload as Record<string, unknown>).subjects as string[] ?? [];
      // Admins bypass subject restrictions.
      if (role !== "admin" && !subjects.includes(subject)) {
        // Redirect to home with an access-denied indicator
        const homeUrl = req.nextUrl.clone();
        homeUrl.pathname = "/";
        homeUrl.searchParams.set("denied", subject);
        return NextResponse.redirect(homeUrl);
      }
    }

    return NextResponse.next();
  } catch {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
