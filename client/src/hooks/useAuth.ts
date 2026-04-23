/**
 * useAuth — authentication state hook for OTB Chess
 *
 * Provides:
 *  - user: the currently signed-in user (or null)
 *  - loading: true while the initial /api/auth/me check is in flight
 *  - login(email, password) → throws on failure
 *  - register(email, password, displayName, chesscomUsername?) → throws on failure
 *  - loginAsGuest(displayName) → creates an ephemeral 24-hour guest session
 *  - logout()
 *  - updateProfile(fields) → PATCH /api/auth/me
 *
 * The JWT is stored in an httpOnly cookie by the server (no localStorage).
 * We keep a copy of the user object in React state for instant UI updates.
 *
 * Silent refresh:
 *  - Every 10 minutes, POST /api/auth/refresh reissues the JWT so sessions
 *    stay alive during long tournaments (3–5 hours).
 *  - When the browser tab regains focus (visibilitychange → visible), an
 *    immediate refresh fires to catch up after laptop sleep / tab suspension.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";

/** How often to silently refresh the token (ms). */
const REFRESH_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  chesscomUsername: string | null;
  lichessUsername: string | null;
  chesscomElo: number | null;
  chesscomRapid: number | null;
  chesscomBlitz: number | null;
  chesscomBullet: number | null;
  chesscomPrevRapid: number | null;
  chesscomPrevBlitz: number | null;
  chesscomPrevBullet: number | null;
  lichessElo: number | null;
  avatarUrl: string | null;
  fideId: string | null;
  /** True for ephemeral guest sessions created via POST /api/auth/guest */
  isGuest: boolean;
  /** True for paid Pro subscribers — gates Openings and future Pro features */
  isPro: boolean;
  /** Optional expiry date for manually-granted Pro access (ISO string or null) */
  proExpiresAt?: string | null;
  /** True for OTB Staff/team members — grants full Pro access without a paid subscription */
  isStaff: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateProfileFields {
  displayName?: string;
  chesscomUsername?: string;
  lichessUsername?: string;
  avatarUrl?: string;
  fideId?: string;
}

/** In-memory + localStorage token store — fallback when httpOnly cookie is stripped by proxy */
const TOKEN_KEY = "otb-auth-token";

function getStoredToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
function setStoredToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* ignore */ }
}

async function apiFetch<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const storedToken = getStoredToken();
  const authHeader: Record<string, string> = storedToken
    ? { Authorization: `Bearer ${storedToken}` }
    : {};
  const res = await fetch(url, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...authHeader, ...(options?.headers ?? {}) },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? "Request failed");
  }
  return data as T;
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Track whether the user was ever authenticated so we can detect session loss
  const wasAuthenticated = useRef(false);

  // On mount, check if there's an active session
  useEffect(() => {
    apiFetch<{ user: AuthUser }>("/api/auth/me")
      .then(({ user }) => {
        setUser(user);
        wasAuthenticated.current = true;
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  // ── Silent token refresh ──────────────────────────────────────────────────
  // Fires every REFRESH_INTERVAL_MS while the user is logged in, and also
  // fires immediately when the tab regains visibility (handles laptop sleep,
  // tab suspension, etc.).
  const silentRefresh = useCallback(async () => {
    try {
      const { user: refreshedUser, token: refreshedToken } = await apiFetch<{ user: AuthUser; token?: string }>(
        "/api/auth/refresh",
        { method: "POST" }
      );
      if (refreshedToken) setStoredToken(refreshedToken);
      setUser(refreshedUser);
      wasAuthenticated.current = true;
    } catch {
      // Token is expired or invalid — session is gone.
      // Only clear user state if they were previously authenticated
      // (avoids clearing state for users who were never logged in).
      if (wasAuthenticated.current) {
        setStoredToken(null);
        setUser(null);
        wasAuthenticated.current = false;
        toast.error("Session expired — please sign in again", {
          duration: 8000,
          id: "session-expired", // prevent duplicate toasts
        });
      }
    }
  }, []);

  useEffect(() => {
    // Only run the refresh loop while the user is logged in
    if (!user) return;

    // Periodic refresh every 10 minutes
    const intervalId = setInterval(silentRefresh, REFRESH_INTERVAL_MS);

    // Visibility-based refresh: when the tab comes back into focus after
    // being hidden (laptop sleep, tab switch), immediately refresh.
    function handleVisibilityChange() {
      if (document.visibilityState === "visible" && user) {
        silentRefresh();
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [user, silentRefresh]);

  const login = useCallback(async (email: string, password: string, remember = false) => {
    const { user, token } = await apiFetch<{ user: AuthUser; token?: string }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password, remember }),
    });
    if (token) setStoredToken(token);
    setUser(user);
    wasAuthenticated.current = true;
    return user;
  }, []);

  const register = useCallback(
    async (
      email: string,
      password: string,
      displayName: string,
      chesscomUsername?: string
    ) => {
      const { user, token } = await apiFetch<{ user: AuthUser; token?: string }>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password, displayName, chesscomUsername }),
      });
      if (token) setStoredToken(token);
      setUser(user);
      wasAuthenticated.current = true;
      return user;
    },
    []
  );

  /**
   * Creates an ephemeral guest session (24-hour JWT, isGuest: true).
   * Guests can join battles but cannot host, edit profiles, or access
   * routes guarded by requireFullAuth.
   */
  const loginAsGuest = useCallback(async (displayName: string) => {
    const { user, token } = await apiFetch<{ user: AuthUser; token?: string }>("/api/auth/guest", {
      method: "POST",
      body: JSON.stringify({ displayName }),
    });
    if (token) setStoredToken(token);
    setUser(user);
    wasAuthenticated.current = true;
    return user;
  }, []);

  const logout = useCallback(async () => {
    await apiFetch("/api/auth/logout", { method: "POST" });
    setStoredToken(null);
    setUser(null);
    wasAuthenticated.current = false;
  }, []);

  const updateProfile = useCallback(async (fields: UpdateProfileFields) => {
    const { user } = await apiFetch<{ user: AuthUser }>("/api/auth/me", {
      method: "PATCH",
      body: JSON.stringify(fields),
    });
    setUser(user);
    return user;
  }, []);

  return { user, loading, login, register, loginAsGuest, logout, updateProfile };
}
