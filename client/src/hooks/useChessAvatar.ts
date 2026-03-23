/**
 * useChessAvatar / useChessAvatars
 *
 * Lightweight hooks for fetching chess.com profile avatars.
 *
 * Features:
 *   - In-memory cache (module-level Map) for instant re-renders
 *   - sessionStorage persistence so avatars survive page navigations
 *     within the same browser session
 *   - Fetches only the /pub/player/{username} endpoint (no stats call)
 *     for maximum speed
 *   - Silent failure — network errors or missing avatars resolve to null
 *     so callers always render the initials fallback gracefully
 *   - useChessAvatars — batch hook that pre-fetches all usernames in
 *     parallel and returns a username → URL map
 */

import { useState, useEffect } from "react";

// ─── Module-level in-memory cache ────────────────────────────────────────────
// Maps username (lowercase) → avatar URL or null (null = confirmed no avatar)
const memCache = new Map<string, string | null>();

const SESSION_KEY_PREFIX = "otb_avatar_";

function readSession(username: string): string | null | undefined {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY_PREFIX + username.toLowerCase());
    if (raw === null) return undefined; // not in session storage
    return raw === "" ? null : raw;     // "" stored as sentinel for "no avatar"
  } catch {
    return undefined;
  }
}

function writeSession(username: string, url: string | null): void {
  try {
    sessionStorage.setItem(
      SESSION_KEY_PREFIX + username.toLowerCase(),
      url ?? "" // store empty string as sentinel for null
    );
  } catch {
    // sessionStorage quota exceeded — silently ignore
  }
}

// ─── Core fetch function ──────────────────────────────────────────────────────
async function fetchAvatar(username: string): Promise<string | null> {
  const key = username.toLowerCase().trim();
  if (!key) return null;

  // 1. Memory cache hit
  if (memCache.has(key)) return memCache.get(key)!;

  // 2. Session storage hit
  const sessionVal = readSession(key);
  if (sessionVal !== undefined) {
    memCache.set(key, sessionVal);
    return sessionVal;
  }

  // 3. Fetch from chess.com
  try {
    const res = await fetch(`https://api.chess.com/pub/player/${key}`, {
      headers: { "User-Agent": "OTBChess/1.0 (tournament management app)" },
      signal: AbortSignal.timeout(5000), // 5 s timeout
    });

    if (!res.ok) {
      memCache.set(key, null);
      writeSession(key, null);
      return null;
    }

    const data = await res.json();
    const url: string | null = data.avatar ?? null;

    memCache.set(key, url);
    writeSession(key, url);
    return url;
  } catch {
    // Network error, CORS, timeout — treat as no avatar
    memCache.set(key, null);
    writeSession(key, null);
    return null;
  }
}

// ─── Single-player hook ───────────────────────────────────────────────────────
/**
 * Returns the chess.com avatar URL for a single player username.
 * `status` is "loading" | "loaded" — callers should show a shimmer
 * skeleton while loading and the initials fallback when url is null.
 */
export function useChessAvatar(username: string | null | undefined): {
  url: string | null;
  status: "loading" | "loaded";
} {
  const key = username?.toLowerCase().trim() ?? "";

  // Initialise synchronously from cache so there's no flash
  const [url, setUrl] = useState<string | null>(() => {
    if (!key) return null;
    if (memCache.has(key)) return memCache.get(key)!;
    const s = readSession(key);
    if (s !== undefined) {
      memCache.set(key, s);
      return s;
    }
    return null;
  });

  const [status, setStatus] = useState<"loading" | "loaded">(() => {
    if (!key) return "loaded";
    if (memCache.has(key)) return "loaded";
    const s = readSession(key);
    return s !== undefined ? "loaded" : "loading";
  });

  useEffect(() => {
    if (!key) return;
    // Already resolved synchronously
    if (memCache.has(key)) return;
    const s = readSession(key);
    if (s !== undefined) return;

    let cancelled = false;
    fetchAvatar(key).then((result) => {
      if (!cancelled) {
        setUrl(result);
        setStatus("loaded");
      }
    });
    return () => { cancelled = true; };
  }, [key]);

  return { url, status };
}

// ─── Batch hook ───────────────────────────────────────────────────────────────
/**
 * Pre-fetches avatars for a list of usernames in parallel.
 * Returns a Map<username, url | null> and a boolean `allLoaded`.
 *
 * Designed for the TournamentReport page which needs to load all
 * avatars before triggering PNG export so images appear in the canvas.
 */
export function useChessAvatars(usernames: string[]): {
  avatars: Map<string, string | null>;
  allLoaded: boolean;
} {
  // Deduplicate and normalise
  const keys = Array.from(new Set(usernames.map((u) => u.toLowerCase().trim()).filter(Boolean)));

  const [avatars, setAvatars] = useState<Map<string, string | null>>(() => {
    const map = new Map<string, string | null>();
    for (const key of keys) {
      if (memCache.has(key)) {
        map.set(key, memCache.get(key)!);
      } else {
        const s = readSession(key);
        if (s !== undefined) {
          memCache.set(key, s);
          map.set(key, s);
        }
      }
    }
    return map;
  });

  const [allLoaded, setAllLoaded] = useState<boolean>(() =>
    keys.every((k) => memCache.has(k) || readSession(k) !== undefined)
  );

  useEffect(() => {
    if (keys.length === 0) {
      setAllLoaded(true);
      return;
    }

    const missing = keys.filter(
      (k) => !memCache.has(k) && readSession(k) === undefined
    );

    if (missing.length === 0) {
      setAllLoaded(true);
      return;
    }

    let cancelled = false;

    Promise.all(missing.map((k) => fetchAvatar(k).then((url) => ({ k, url })))).then(
      (results) => {
        if (cancelled) return;
        setAvatars((prev) => {
          const next = new Map(prev);
          for (const { k, url } of results) next.set(k, url);
          return next;
        });
        setAllLoaded(true);
      }
    );

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys.join(",")]);

  return { avatars, allLoaded };
}

/** Standalone imperative fetch — useful outside React (e.g. before html2canvas) */
export { fetchAvatar };

/**
 * Rewrites a chess.com / lichess avatar URL to go through the server-side
 * /api/avatar-proxy endpoint so html2canvas can draw it onto a canvas without
 * triggering the "tainted canvas" CORS security error.
 *
 * Pass `null` or `undefined` and you get `null` back (safe for optional avatars).
 */
export function toProxiedAvatarUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const allowed = ["images.chess.com", "www.chess.com", "lichess.org", "lichess1.org"];
    if (allowed.some((h) => parsed.hostname === h || parsed.hostname.endsWith("." + h))) {
      return `/api/avatar-proxy?url=${encodeURIComponent(url)}`;
    }
  } catch {
    // Not a valid URL — fall through
  }
  return url; // already same-origin or unrecognised — return as-is
}
