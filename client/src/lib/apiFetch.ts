/**
 * apiFetch — authenticated fetch wrapper for OTB Chess
 *
 * Reads the JWT from localStorage (stored there as a fallback when the
 * httpOnly cookie is stripped by the Google Cloud Run reverse proxy) and
 * sends it as an Authorization: Bearer header on every request.
 *
 * Falls back gracefully to cookie-only auth when no token is stored.
 */

const TOKEN_KEY = "otb-auth-token";

export function getStoredToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

/**
 * Low-level fetch wrapper that injects the stored JWT as a Bearer token
 * header and returns the raw Response. Use this when you need to inspect
 * status codes, stream the body, or handle non-JSON responses yourself.
 */
export async function authFetch(
  url: string,
  options?: RequestInit
): Promise<Response> {
  const storedToken = getStoredToken();
  const authHeader: Record<string, string> = storedToken
    ? { Authorization: `Bearer ${storedToken}` }
    : {};
  return fetch(url, {
    credentials: "include",
    headers: {
      ...authHeader,
      ...(options?.headers ?? {}),
    },
    ...options,
  });
}

/**
 * Thin fetch wrapper that automatically injects the stored JWT as a Bearer
 * token header. Throws an Error with the server's `error` message on non-2xx.
 */
export async function apiFetch<T = unknown>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const storedToken = getStoredToken();
  const authHeader: Record<string, string> = storedToken
    ? { Authorization: `Bearer ${storedToken}` }
    : {};

  const res = await fetch(url, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...authHeader,
      ...(options?.headers ?? {}),
    },
    ...options,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? "Request failed");
  }
  return data as T;
}
