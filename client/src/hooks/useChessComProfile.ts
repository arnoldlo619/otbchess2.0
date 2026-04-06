/**
 * useChessComProfile
 *
 * Fetches a player's profile, ratings, and game analysis via the OTB Chess
 * server-side proxy. Analysis includes:
 *   - Top 3 openings as White (from last 50 games)
 *   - Top 3 openings as Black (from last 50 games)
 *   - Endgame win percentage (games > 30 moves)
 */

import { useState, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface OpeningEntry {
  name: string;
  count: number;
  pct: number;
}

export interface ChessComAnalysis {
  gamesAnalyzed: number;
  openingsWhite: OpeningEntry[];
  openingsBlack: OpeningEntry[];
  endgameWinPct: number | null;
  endgameGames: number;
}

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
  /** Game analysis — populated after lookup */
  analysis?: ChessComAnalysis;
}

export type FetchStatus = "idle" | "loading" | "success" | "not_found" | "error";

// ─── In-memory cache ──────────────────────────────────────────────────────────
const cache = new Map<string, ChessComProfile>();
const analysisCache = new Map<string, ChessComAnalysis>();

// ─── Country code → flag emoji ────────────────────────────────────────────────
function countryCodeToFlag(code: string): string {
  const match =
    code.match(/\/([A-Z]{2})\.png$/i) ||
    code.match(/\/country\/([A-Z]{2})$/i) ||
    code.match(/^([A-Z]{2})$/i);
  if (!match) return "";
  const letters = match[1].toUpperCase();
  return Array.from(letters)
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join("");
}

// ─── API fetch via server proxy ───────────────────────────────────────────────
async function fetchFromChessCom(username: string): Promise<ChessComProfile> {
  const key = username.toLowerCase().trim();

  if (cache.has(key)) return cache.get(key)!;

  const res = await fetch(`/api/chess/player/${encodeURIComponent(key)}`);

  if (res.status === 404) {
    const err = new Error("not_found");
    err.name = "not_found";
    throw err;
  }

  if (!res.ok) throw new Error(`chess.com proxy error: ${res.status}`);

  const data = await res.json() as { profile: Record<string, unknown>; stats: Record<string, unknown> };
  const { profile: profileData, stats: statsData } = data;

  const rapid = (statsData?.chess_rapid as Record<string, Record<string, number>> | undefined)?.last?.rating ?? 0;
  const blitz = (statsData?.chess_blitz as Record<string, Record<string, number>> | undefined)?.last?.rating ?? 0;
  const bullet = (statsData?.chess_bullet as Record<string, Record<string, number>> | undefined)?.last?.rating ?? 0;
  const elo = rapid || blitz || bullet || 0;

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

async function fetchAnalysis(username: string): Promise<ChessComAnalysis | null> {
  const key = username.toLowerCase().trim();
  if (analysisCache.has(key)) return analysisCache.get(key)!;

  try {
    const res = await fetch(`/api/chess/player/${encodeURIComponent(key)}/analysis`);
    if (!res.ok) return null;
    const data = await res.json() as ChessComAnalysis;
    analysisCache.set(key, data);
    return data;
  } catch {
    return null;
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useChessComProfile() {
  const [status, setStatus] = useState<FetchStatus>("idle");
  const [profile, setProfile] = useState<ChessComProfile | null>(null);
  const [error, setError] = useState<string>("");
  const [analysisLoading, setAnalysisLoading] = useState(false);

  const lookup = useCallback(async (username: string) => {
    if (!username.trim()) return;
    setStatus("loading");
    setProfile(null);
    setError("");
    try {
      const p = await fetchFromChessCom(username.trim());
      setProfile(p);
      setStatus("success");

      // Kick off analysis fetch in the background
      setAnalysisLoading(true);
      fetchAnalysis(username.trim()).then((analysis) => {
        setAnalysisLoading(false);
        if (analysis) {
          setProfile((prev) => prev ? { ...prev, analysis } : prev);
        }
      });
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
    setAnalysisLoading(false);
  }, []);

  return { status, profile, error, lookup, reset, analysisLoading };
}

/** Standalone fetch for use outside React (e.g. in event handlers) */
export { fetchFromChessCom };
