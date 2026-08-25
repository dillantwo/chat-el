"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { UserRole, Subject, type AuthProvider as AuthProviderKind } from "@/models/User";
import { basePath } from "@/lib/utils";

export interface AuthUser {
  username: string;
  role: UserRole;
  displayName: string;
  schoolId: string | null;
  schoolName: string | null;
  subjects: Subject[];
  /** How this session signed in. Decides where logout has to send the browser. */
  authProvider: AuthProviderKind;
  /**
   * Topics this user may open, as `subject:topic` keys (see lib/topics.ts).
   * Resolved from the database by /api/auth/me, so it reflects what an admin has
   * closed in 學校管理 without waiting for a new login.
   */
  topics: string[];
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  logout: async () => {},
  refreshUser: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const refreshUser = useCallback(async () => {
    try {
      const res = await fetch(`${basePath}/api/auth/me`);
      if (res.ok) {
        setUser(await res.json());
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const logout = useCallback(async () => {
    // For an EdConnect session the API answers with the identity provider's
    // logout URL. It has to be visited as a top-level navigation — a fetch to
    // hkedcity.net is cross-origin and cannot touch their cookies — and until it
    // happens the user is out of this app but still signed in at EdCity, so the
    // login button would walk straight back in with no prompt. On a shared
    // classroom machine that is the next student landing in this account.
    let redirectTo: string | null = null;

    try {
      const res = await fetch(`${basePath}/api/auth/logout`, { method: "POST" });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        redirectTo = typeof data.redirectTo === "string" ? data.redirectTo : null;
      }
    } catch {
      // The session cookie may or may not be gone. Fall through to /login,
      // where the proxy will sort out whichever state we are in.
    }

    setUser(null);

    // Per-tab work state (the math dashboard keeps the open question, its photo
    // and the generated diagram there so the page can be resumed) outlives the
    // cookie, so on the shared classroom machine above the next student would
    // find the previous one's work waiting for them.
    try {
      sessionStorage.clear();
    } catch {
      // Storage can be unavailable (private mode); nothing to clean up then.
    }

    if (redirectTo) {
      // assign, not replace: leaves the app in history so Back is not a dead end.
      window.location.assign(redirectTo);
      return;
    }

    router.push("/login");
    router.refresh();
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, loading, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
