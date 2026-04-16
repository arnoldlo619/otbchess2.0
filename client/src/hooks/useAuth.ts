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
 */
import { useState, useEffect, useCallback } from "react";

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

async function apiFetch<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(url, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
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

  // On mount, check if there's an active session
  useEffect(() => {
    apiFetch<{ user: AuthUser }>("/api/auth/me")
      .then(({ user }) => setUser(user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string, remember = false) => {
    const { user } = await apiFetch<{ user: AuthUser }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password, remember }),
    });
    setUser(user);
    return user;
  }, []);

  const register = useCallback(
    async (
      email: string,
      password: string,
      displayName: string,
      chesscomUsername?: string
    ) => {
      const { user } = await apiFetch<{ user: AuthUser }>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password, displayName, chesscomUsername }),
      });
      setUser(user);
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
    const { user } = await apiFetch<{ user: AuthUser }>("/api/auth/guest", {
      method: "POST",
      body: JSON.stringify({ displayName }),
    });
    setUser(user);
    return user;
  }, []);

  const logout = useCallback(async () => {
    await apiFetch("/api/auth/logout", { method: "POST" });
    setUser(null);
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
