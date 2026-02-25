/**
 * useChessComProfile
 *
 * Fetches a player's profile and ratings via the OTB Chess server-side proxy
 * (/api/chess/player/:username), which calls the chess.com public API with a
 * proper User-Agent header. This avoids:
 *   1. Browser blocking of custom User-Agent (forbidden header in fetch)
 *   2. Cloudflare rate-limiting direct browser requests on production domains
 * - In-memory cache prevents duplicate requests within the same session
 * - Distinguishes between "not found" (404) and generic network errors
 * - Country code → flag emoji mapping for all ISO 3166-1 alpha-2 codes
 */

import { useState, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface ChessComProfile {
  username: string;
  name?: string;
  avatar?: string;
  title?: string;
  country?: string;      // ISO 3166-1 alpha-2, e.g. "US"
  countryFlag?: string;  // emoji flag, e.g. "🇺🇸"
  rapid: number;
  blitz: number;
  bullet: number;
  /** Best available rating (rapid → blitz → bullet) */
  elo: number;
  status: "online" | "offline";
  joined?: number;
  /** Source platform identifier */
  platform: "chesscom";
}

export type FetchStatus = "idle" | "loading" | "success" | "not_found" | "error";

// ─── In-memory cache ──────────────────────────────────────────────────────────
const cache = new Map<string, ChessComProfile>();

// ─── Country code → flag emoji ────────────────────────────────────────────────
function countryCodeToFlag(code: string): string {
  // chess.com returns a URL like https://www.chess.com/member/flags/US.png
  // We extract the 2-letter code from the URL or use the code directly
  const match = code.match(/\/([A-Z]{2})\.png$/i) || code.match(/^([A-Z]{2})$/i);
  if (!match) return "";
  const letters = match[1].toUpperCase();
  // Regional indicator symbols: A = 0x1F1E6, so offset from 'A' (65)
  return Array.from(letters)
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join("");
}

// ─── API fetch via server proxy ───────────────────────────────────────────────
async function fetchFromChessCom(username: string): Promise<ChessComProfile> {
  const key = username.toLowerCase().trim();

  if (cache.has(key)) return cache.get(key)!;

  // Route through the server-side proxy to avoid browser User-Agent restrictions
  // and Cloudflare rate-limiting on direct browser → api.chess.com calls
  const res = await fetch(`/api/chess/player/${encodeURIComponent(key)}`);

  if (res.status === 404) {
    const err = new Error("not_found");
    err.name = "not_found";
    throw err;
  }

  if (!res.ok) throw new Error(`chess.com proxy error: ${res.status}`);

  const data = await res.json() as { profile: Record<string, unknown>; stats: Record<string, unknown> };
  const { profile: profileData, stats: statsData } = data;

  // Extract ratings — chess.com nests them under chess_rapid, chess_blitz, chess_bullet
  const rapid = (statsData?.chess_rapid as Record<string, Record<string, number>> | undefined)?.last?.rating ?? 0;
  const blitz = (statsData?.chess_blitz as Record<string, Record<string, number>> | undefined)?.last?.rating ?? 0;
  const bullet = (statsData?.chess_bullet as Record<string, Record<string, number>> | undefined)?.last?.rating ?? 0;
  const elo = rapid || blitz || bullet || 0;

  // Country: chess.com returns a URL like https://api.chess.com/pub/country/US
  const countryCode = profileData.country
    ? (profileData.country as string).split("/").pop() ?? ""
    : "";
  const countryFlag = countryCode ? countryCodeToFlag(countryCode) : "";

  const profile: ChessComProfile = {
    username: (profileData.username as string) ?? username,
    name: profileData.name as string | undefined,
    avatar: profileData.avatar as string | undefined,
    title: profileData.title as string | undefined,
    country: countryCode,
    countryFlag,
    rapid,
    blitz,
    bullet,
    elo,
    status: profileData.status === "online" ? "online" : "offline",
    joined: profileData.joined as number | undefined,
    platform: "chesscom",
  };

  cache.set(key, profile);
  return profile;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useChessComProfile() {
  const [status, setStatus] = useState<FetchStatus>("idle");
  const [profile, setProfile] = useState<ChessComProfile | null>(null);
  const [error, setError] = useState<string>("");

  const lookup = useCallback(async (username: string) => {
    if (!username.trim()) return;
    setStatus("loading");
    setProfile(null);
    setError("");
    try {
      const p = await fetchFromChessCom(username.trim());
      setProfile(p);
      setStatus("success");
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "not_found") {
        setStatus("not_found");
        setError(`"${username}" was not found on chess.com. Check the spelling and try again.`);
      } else {
        setStatus("error");
        setError("Could not reach chess.com. Check your connection and try again.");
      }
    }
  }, []);

  const reset = useCallback(() => {
    setStatus("idle");
    setProfile(null);
    setError("");
  }, []);

  return { status, profile, error, lookup, reset };
}

/** Standalone fetch for use outside React (e.g. in event handlers) */
export { fetchFromChessCom };
