/**
 * useLichessProfile
 *
 * Fetches a player's profile and ratings via the OTB Chess server-side proxy
 * (/api/lichess/player/:username), which calls the Lichess public API.
 * - Calls https://lichess.org/api/user/{username} server-side
 * - In-memory cache prevents duplicate requests within the same session
 * - Distinguishes between "not found" (404) and generic network errors
 * - Extracts: rapid, blitz, bullet, classical ratings; title; country; flair
 * - Lichess does not expose profile photos — flair emoji is used as visual identifier
 *
 * Lichess API reference: https://lichess.org/api#tag/Users/operation/apiUser
 */
import { useState, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface LichessProfile {
  /** Canonical Lichess username (case-preserved) */
  username: string;
  /** Real name from profile, if set */
  name?: string;
  /**
   * Lichess does not provide profile photos via API.
   * We set avatar to undefined — the PlayerAvatar component will render
   * a styled initials fallback with the Lichess orange accent colour.
   */
  avatar: undefined;
  /** Lichess flair emoji identifier, e.g. "nature.seedling" */
  flair?: string;
  /** Rendered flair emoji character, if available */
  flairEmoji?: string;
  /** FIDE/Lichess title: GM, IM, FM, CM, NM, WGM, WIM, WFM, WCM, WNM, LM, BOT */
  title?: string;
  /** ISO 3166-1 alpha-2 country code from profile, e.g. "NO" */
  country?: string;
  /** Flag emoji derived from country code */
  countryFlag?: string;
  /** Lichess rapid rating (may be provisional) */
  rapid: number;
  /** Lichess blitz rating */
  blitz: number;
  /** Lichess bullet rating */
  bullet: number;
  /** Lichess classical rating */
  classical: number;
  /**
   * Best available non-provisional rating for pairing purposes.
   * Priority: classical → rapid → blitz → bullet
   * Falls back to best provisional if no non-provisional exists.
   */
  elo: number;
  /** Whether the user is currently online */
  online: boolean;
  /** Lichess patron (supporter) status */
  patron: boolean;
  /** Lichess verified status */
  verified: boolean;
  /** Profile URL */
  url: string;
  /** Source platform identifier */
  platform: "lichess";
}

export type FetchStatus = "idle" | "loading" | "success" | "not_found" | "error";

// ─── In-memory cache ──────────────────────────────────────────────────────────
const cache = new Map<string, LichessProfile>();

// ─── Flair → emoji mapping (subset of common ones) ───────────────────────────
// Lichess flairs are emoji shortcodes. We map the most common ones.
// Full list: https://lichess.org/api/flair
const FLAIR_EMOJI_MAP: Record<string, string> = {
  "nature.seedling": "🌱",
  "nature.four-leaf-clover": "🍀",
  "nature.fire": "🔥",
  "nature.snowflake": "❄️",
  "nature.lightning": "⚡",
  "nature.star": "⭐",
  "nature.sun": "☀️",
  "nature.moon": "🌙",
  "nature.rainbow": "🌈",
  "nature.chess-pawn": "♟️",
  "activity.chess-pawn": "♟️",
  "activity.trophy": "🏆",
  "activity.chess-knight": "♞",
  "symbols.crown": "👑",
  "symbols.diamond": "💎",
  "symbols.lightning": "⚡",
  "symbols.fire": "🔥",
  "people.santa-claus-light-skin-tone": "🎅",
  "people.mage": "🧙",
  "people.robot": "🤖",
  "smileys.smiling-face-with-sunglasses": "😎",
  "smileys.thinking-face": "🤔",
  "smileys.nerd-face": "🤓",
  "food.chess": "♟️",
  "food.coffee": "☕",
  "food.pizza": "🍕",
};

function flairToEmoji(flair?: string): string | undefined {
  if (!flair) return undefined;
  return FLAIR_EMOJI_MAP[flair] ?? undefined;
}

// ─── Country code → flag emoji ────────────────────────────────────────────────
function countryCodeToFlag(code?: string): string {
  if (!code || code.length !== 2) return "";
  const upper = code.toUpperCase();
  return Array.from(upper)
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join("");
}

// ─── Rating extractor ─────────────────────────────────────────────────────────
interface LichessPerf {
  rating: number;
  rd?: number;
  games?: number;
  prov?: boolean;
}

interface LichessPerfs {
  rapid?: LichessPerf;
  blitz?: LichessPerf;
  bullet?: LichessPerf;
  classical?: LichessPerf;
  [key: string]: LichessPerf | undefined;
}

/**
 * Extract the best ELO for pairing purposes.
 * Prefers non-provisional ratings. Priority: classical → rapid → blitz → bullet.
 * Falls back to best provisional if all are provisional.
 */
function extractBestElo(perfs: LichessPerfs): number {
  const candidates: Array<{ rating: number; prov: boolean }> = [
    { rating: perfs.classical?.rating ?? 0, prov: perfs.classical?.prov ?? true },
    { rating: perfs.rapid?.rating ?? 0, prov: perfs.rapid?.prov ?? true },
    { rating: perfs.blitz?.rating ?? 0, prov: perfs.blitz?.prov ?? true },
    { rating: perfs.bullet?.rating ?? 0, prov: perfs.bullet?.prov ?? true },
  ];

  // First try non-provisional ratings
  const nonProv = candidates.filter((c) => !c.prov && c.rating > 0);
  if (nonProv.length > 0) {
    return Math.max(...nonProv.map((c) => c.rating));
  }

  // Fall back to best provisional
  const withRating = candidates.filter((c) => c.rating > 0);
  if (withRating.length > 0) {
    return Math.max(...withRating.map((c) => c.rating));
  }

  return 1500; // default unrated
}

// ─── API fetch via server proxy ───────────────────────────────────────────────
async function fetchFromLichess(username: string): Promise<LichessProfile> {
  const key = username.toLowerCase().trim();
  if (cache.has(key)) return cache.get(key)!;

  // Route through the server-side proxy to avoid CORS and rate-limiting issues
  const res = await fetch(`/api/lichess/player/${encodeURIComponent(key)}`);

  if (res.status === 404) {
    const err = new Error("not_found");
    err.name = "not_found";
    throw err;
  }

  if (!res.ok) throw new Error(`Lichess API error: ${res.status}`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = await res.json();

  // Check if account is disabled/closed
  if (data.disabled || data.closed) {
    const err = new Error("not_found");
    err.name = "not_found";
    throw err;
  }

  const perfs: LichessPerfs = data.perfs ?? {};
  const profile = data.profile ?? {};

  const rapid    = perfs.rapid?.rating    ?? 0;
  const blitz    = perfs.blitz?.rating    ?? 0;
  const bullet   = perfs.bullet?.rating   ?? 0;
  const classical = perfs.classical?.rating ?? 0;
  const elo = extractBestElo(perfs);

  const countryCode = profile.country ?? undefined;
  const countryFlag = countryCodeToFlag(countryCode);
  const flairEmoji = flairToEmoji(data.flair);

  const result: LichessProfile = {
    username: data.username ?? username,
    name: profile.realName ?? undefined,
    avatar: undefined,
    flair: data.flair,
    flairEmoji,
    title: data.title ?? undefined,
    country: countryCode,
    countryFlag,
    rapid,
    blitz,
    bullet,
    classical,
    elo,
    online: data.online ?? false,
    patron: data.patron ?? false,
    verified: data.verified ?? false,
    url: data.url ?? `https://lichess.org/@/${data.username}`,
    platform: "lichess",
  };

  cache.set(key, result);
  return result;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useLichessProfile() {
  const [status, setStatus] = useState<FetchStatus>("idle");
  const [profile, setProfile] = useState<LichessProfile | null>(null);
  const [error, setError] = useState<string>("");

  const lookup = useCallback(async (username: string) => {
    if (!username.trim()) return;
    setStatus("loading");
    setProfile(null);
    setError("");
    try {
      const p = await fetchFromLichess(username.trim());
      setProfile(p);
      setStatus("success");
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "not_found") {
        setStatus("not_found");
        setError(`"${username}" was not found on Lichess. Check the spelling and try again.`);
      } else {
        setStatus("error");
        setError("Could not reach Lichess. Check your connection and try again.");
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
export { fetchFromLichess };
