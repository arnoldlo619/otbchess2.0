/**
 * useOpponentProfile
 *
 * Fetches a chess.com player's public profile (avatar, title, country, name)
 * via the existing /api/chess/player/:username proxy.
 *
 * Features:
 *  - Fires automatically when `username` changes (non-empty)
 *  - In-memory cache keyed by lowercase username (avoids duplicate fetches
 *    when switching tabs or re-rendering the prep page for the same opponent)
 *  - Returns { profile, loading, error } — profile is null until resolved
 *  - Silently swallows errors (profile data is purely cosmetic enhancement)
 */

import { useState, useEffect, useRef } from "react";
import { logger } from "@/lib/logger";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface OpponentProfile {
  /** chess.com avatar URL (may be undefined for players without a photo) */
  avatar: string | null;
  /** Title abbreviation: "GM", "IM", "FM", "CM", "NM", "WGM", etc. */
  title: string | null;
  /** Two-letter country code from chess.com URL, e.g. "US", "NO", "IN" */
  countryCode: string | null;
  /** Full name if provided by the player */
  name: string | null;
  /** chess.com username (normalised, lowercase) */
  username: string;
}

// ── In-memory cache ───────────────────────────────────────────────────────────
// Shared across all hook instances so navigating back to a previously scouted
// opponent doesn't trigger a second fetch.
const profileCache = new Map<string, OpponentProfile>();

// ── Country code extractor ────────────────────────────────────────────────────
// chess.com returns country as a URL like "https://api.chess.com/pub/country/US"
function extractCountryCode(countryUrl: unknown): string | null {
  if (typeof countryUrl !== "string") return null;
  const match = countryUrl.match(/\/country\/([A-Z]{2})$/i);
  return match ? match[1].toUpperCase() : null;
}

// ── Country code → emoji flag ─────────────────────────────────────────────────
// Converts a 2-letter ISO country code to the corresponding flag emoji.
// Uses Unicode regional indicator symbols (A=🇦, B=🇧, …).
export function countryCodeToFlag(code: string): string {
  if (!code || code.length !== 2) return "";
  const offset = 0x1f1e6 - 65; // 'A' = 65
  const chars = code.toUpperCase().split("").map((c) => {
    const cp = c.charCodeAt(0);
    return String.fromCodePoint(cp + offset);
  });
  return chars.join("");
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useOpponentProfile(username: string | null | undefined): {
  profile: OpponentProfile | null;
  loading: boolean;
  error: string | null;
} {
  const [profile, setProfile] = useState<OpponentProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track the latest requested username to avoid stale-closure race conditions
  const latestUsername = useRef<string | null>(null);

  useEffect(() => {
    const u = username?.trim().toLowerCase() ?? "";
    if (!u) {
      setProfile(null);
      setLoading(false);
      setError(null);
      return;
    }

    // Cache hit — instant return
    if (profileCache.has(u)) {
      setProfile(profileCache.get(u)!);
      setLoading(false);
      setError(null);
      return;
    }

    latestUsername.current = u;
    setLoading(true);
    setError(null);

    fetch(`/api/chess/player/${encodeURIComponent(u)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json() as {
          profile?: {
            avatar?: string;
            title?: string;
            country?: string;
            name?: string;
            username?: string;
          };
        };

        // Only apply if this is still the latest request
        if (latestUsername.current !== u) return;

        const p = data.profile ?? {};
        const resolved: OpponentProfile = {
          avatar: typeof p.avatar === "string" && p.avatar ? p.avatar : null,
          title: typeof p.title === "string" && p.title ? p.title : null,
          countryCode: extractCountryCode(p.country),
          name: typeof p.name === "string" && p.name ? p.name : null,
          username: u,
        };

        profileCache.set(u, resolved);
        setProfile(resolved);
        setLoading(false);
      })
      .catch((err) => {
        if (latestUsername.current !== u) return;
        // Profile fetch is cosmetic — fail silently, don't block the prep report
        logger.warn("[useOpponentProfile] fetch failed (non-fatal):", err);
        setError(null);
        setLoading(false);
      });
  }, [username]);

  return { profile, loading, error };
}
