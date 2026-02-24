/**
 * useChessComProfile
 *
 * Fetches a player's profile and ratings from the chess.com public API.
 * - Calls /pub/player/{username} and /pub/player/{username}/stats in parallel
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

// ─── API fetch ────────────────────────────────────────────────────────────────
async function fetchFromChessCom(username: string): Promise<ChessComProfile> {
  const key = username.toLowerCase().trim();

  if (cache.has(key)) return cache.get(key)!;

  const base = "https://api.chess.com/pub/player";
  const headers = { "User-Agent": "OTBChess/1.0 (tournament management app)" };

  // Fetch profile and stats in parallel
  const [profileRes, statsRes] = await Promise.all([
    fetch(`${base}/${key}`, { headers }),
    fetch(`${base}/${key}/stats`, { headers }),
  ]);

  if (profileRes.status === 404) {
    const err = new Error("not_found");
    err.name = "not_found";
    throw err;
  }

  if (!profileRes.ok) throw new Error(`chess.com API error: ${profileRes.status}`);

  const [profileData, statsData] = await Promise.all([
    profileRes.json(),
    statsRes.ok ? statsRes.json() : Promise.resolve({}),
  ]);

  // Extract ratings — chess.com nests them under chess_rapid, chess_blitz, chess_bullet
  const rapid = statsData?.chess_rapid?.last?.rating ?? 0;
  const blitz = statsData?.chess_blitz?.last?.rating ?? 0;
  const bullet = statsData?.chess_bullet?.last?.rating ?? 0;
  const elo = rapid || blitz || bullet || 0;

  // Country: chess.com returns a URL like https://api.chess.com/pub/country/US
  const countryCode = profileData.country
    ? profileData.country.split("/").pop() ?? ""
    : "";
  const countryFlag = countryCode ? countryCodeToFlag(countryCode) : "";

  const profile: ChessComProfile = {
    username: profileData.username ?? username,
    name: profileData.name,
    avatar: profileData.avatar,
    title: profileData.title,
    country: countryCode,
    countryFlag,
    rapid,
    blitz,
    bullet,
    elo,
    status: profileData.status === "online" ? "online" : "offline",
    joined: profileData.joined,
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
