/**
 * useRatingHistory
 *
 * Fetches a player's last N rated games' post-game ratings from chess.com or
 * Lichess, returning a time-ordered array of RatingPoint data points suitable
 * for rendering a sparkline.
 *
 * Strategy: fetch ALL rated games once (up to count * 4 to ensure enough data
 * per time-control bucket), tag each game with its time control, cache the full
 * set, then filter client-side by the requested time control. This avoids
 * redundant API calls when the user switches the time-control pill.
 *
 * chess.com time-control classification:
 *   - Bullet  : initial_setup time < 3 min  (< 180s)
 *   - Blitz   : 3–9 min  (180–539s)
 *   - Rapid   : 10–29 min (540–1799s)
 *   - Classical: ≥ 30 min (≥ 1800s)
 *   (time_class field on the game object is used when available)
 *
 * Lichess time-control classification:
 *   - perf field on the game object ("bullet" | "blitz" | "rapid" | "classical")
 *
 * Both paths use sessionStorage caching (5-minute TTL) to avoid redundant calls.
 */

import { useState, useEffect, useRef } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type TimeControl = "all" | "bullet" | "blitz" | "rapid" | "classical";

export interface RatingPoint {
  /** Unix timestamp (ms) of the game */
  date: number;
  /** Post-game rating after this result */
  rating: number;
  /** Result from the player's perspective */
  result: "win" | "draw" | "loss";
  /** Time control of the game */
  timeControl: Exclude<TimeControl, "all">;
}

export type RatingHistoryStatus = "idle" | "loading" | "success" | "error";

// ─── Cache ────────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry {
  data: RatingPoint[];
  fetchedAt: number;
}

function cacheKey(platform: "chesscom" | "lichess", username: string) {
  return `otb_rating_history_v2_${platform}_${username.toLowerCase()}`;
}

function readCache(key: string): RatingPoint[] | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const entry: CacheEntry = JSON.parse(raw);
    if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) {
      sessionStorage.removeItem(key);
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

function writeCache(key: string, data: RatingPoint[]) {
  try {
    const entry: CacheEntry = { data, fetchedAt: Date.now() };
    sessionStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // sessionStorage full or unavailable — silently skip
  }
}

// ─── chess.com time-control classifier ───────────────────────────────────────

/**
 * Classify a chess.com game's time control.
 * Prefers the `time_class` field; falls back to parsing the `time_control`
 * string (e.g. "600" or "600+5").
 */
function classifyChessComTC(
  timeClass: string | undefined,
  timeControlStr: string | undefined
): Exclude<TimeControl, "all"> {
  // chess.com provides time_class directly in most cases
  if (timeClass) {
    const tc = timeClass.toLowerCase();
    if (tc === "bullet") return "bullet";
    if (tc === "blitz") return "blitz";
    if (tc === "rapid") return "rapid";
    if (tc === "classical" || tc === "daily") return "classical";
  }
  // Fallback: parse seconds from "600" or "600+5"
  if (timeControlStr) {
    const base = parseInt(timeControlStr.split("+")[0], 10);
    if (!isNaN(base)) {
      if (base < 180) return "bullet";
      if (base < 540) return "blitz";
      if (base < 1800) return "rapid";
      return "classical";
    }
  }
  return "rapid"; // safe default
}

// ─── chess.com fetcher ────────────────────────────────────────────────────────

async function fetchChessComHistory(
  username: string,
  count: number
): Promise<RatingPoint[]> {
  const key = cacheKey("chesscom", username);
  const cached = readCache(key);
  if (cached) return cached;

  const headers = { "User-Agent": "OTBChess/1.0 (tournament management app)" };
  const base = "https://api.chess.com/pub/player";
  const u = username.toLowerCase().trim();

  // Step 1: fetch archive list
  const archivesRes = await fetch(`${base}/${u}/games/archives`, { headers });
  if (!archivesRes.ok) throw new Error(`chess.com archives error: ${archivesRes.status}`);
  const archivesData = await archivesRes.json();
  const archives: string[] = archivesData.archives ?? [];

  // Fetch enough games to fill all time-control buckets (count * 4)
  const target = count * 4;
  const points: RatingPoint[] = [];

  for (let i = archives.length - 1; i >= 0 && points.length < target; i--) {
    const monthRes = await fetch(archives[i], { headers });
    if (!monthRes.ok) continue;
    const monthData = await monthRes.json();
    const games: unknown[] = monthData.games ?? [];

    // Process newest games first within the month
    for (let j = games.length - 1; j >= 0 && points.length < target; j--) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const g: any = games[j];
      if (!g.rated) continue;
      if (g.rules && g.rules !== "chess") continue; // skip variants

      const isWhite = (g.white?.username ?? "").toLowerCase() === u;
      const side = isWhite ? g.white : g.black;
      if (!side?.rating) continue;

      const rating: number = side.rating;
      const endTime: number = (g.end_time ?? 0) * 1000;

      let result: "win" | "draw" | "loss" = "draw";
      const res: string = side.result ?? "";
      if (res === "win") result = "win";
      else if (["checkmated", "timeout", "resigned", "lose", "abandoned"].includes(res))
        result = "loss";

      const timeControl = classifyChessComTC(g.time_class, g.time_control);

      points.push({ date: endTime, rating, result, timeControl });
    }
  }

  // Points are newest-first; reverse to chronological order
  const sorted = points.reverse();
  writeCache(key, sorted);
  return sorted;
}

// ─── Lichess fetcher ──────────────────────────────────────────────────────────

function classifyLichessPerf(perf: string | undefined): Exclude<TimeControl, "all"> {
  if (!perf) return "rapid";
  const p = perf.toLowerCase();
  if (p === "bullet" || p === "ultrabullet") return "bullet";
  if (p === "blitz") return "blitz";
  if (p === "rapid") return "rapid";
  if (p === "classical" || p === "correspondence") return "classical";
  return "rapid";
}

async function fetchLichessHistory(
  username: string,
  count: number
): Promise<RatingPoint[]> {
  const key = cacheKey("lichess", username);
  const cached = readCache(key);
  if (cached) return cached;

  const u = encodeURIComponent(username.toLowerCase().trim());
  // Request more than needed to fill all time-control buckets
  const url =
    `https://lichess.org/api/games/user/${u}` +
    `?max=${count * 4}&rated=true&perfType=rapid,blitz,bullet,classical` +
    `&moves=false&clocks=false&evals=false&opening=false`;

  const res = await fetch(url, {
    headers: { Accept: "application/x-ndjson" },
  });

  if (!res.ok) throw new Error(`Lichess games API error: ${res.status}`);

  const text = await res.text();
  const lines = text.trim().split("\n").filter(Boolean);

  const uLower = username.toLowerCase().trim();
  const points: RatingPoint[] = [];

  for (const line of lines) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const g: any = JSON.parse(line);
      const players = g.players ?? {};
      const isWhite =
        (players.white?.user?.name ?? players.white?.user?.id ?? "").toLowerCase() === uLower;
      const side = isWhite ? players.white : players.black;
      const rating: number | undefined = side?.rating;
      if (!rating) continue;

      const date: number = g.createdAt ?? g.lastMoveAt ?? 0;

      let result: "win" | "draw" | "loss" = "draw";
      const status: string = g.status ?? "";
      const winner: string | undefined = g.winner;
      if (winner) {
        result = (isWhite && winner === "white") || (!isWhite && winner === "black")
          ? "win"
          : "loss";
      } else if (["draw", "stalemate", "threefoldRepetition", "fiftyMoves", "variantEnd"].includes(status)) {
        result = "draw";
      }

      const timeControl = classifyLichessPerf(g.perf);

      points.push({ date, rating, result, timeControl });
    } catch {
      // Malformed NDJSON line — skip
    }
  }

  // Lichess returns newest-first; reverse to chronological order
  const sorted = points.reverse();
  writeCache(key, sorted);
  return sorted;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

interface UseRatingHistoryOptions {
  username: string;
  platform: "chesscom" | "lichess";
  count?: number;
  /** Filter to a specific time control; "all" returns every rated game */
  timeControl?: TimeControl;
  /** Only fetch when enabled (e.g. when the hover card is visible) */
  enabled?: boolean;
}

export function useRatingHistory({
  username,
  platform,
  count = 10,
  timeControl = "all",
  enabled = true,
}: UseRatingHistoryOptions) {
  const [status, setStatus] = useState<RatingHistoryStatus>("idle");
  const [allPoints, setAllPoints] = useState<RatingPoint[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!enabled || !username.trim()) return;

    // Check cache first — if hit, skip loading state entirely
    const key = cacheKey(platform, username);
    const cached = readCache(key);
    if (cached) {
      setAllPoints(cached);
      setStatus("success");
      return;
    }

    setStatus("loading");
    setAllPoints([]);

    const controller = new AbortController();
    abortRef.current = controller;

    const fetcher =
      platform === "chesscom"
        ? fetchChessComHistory(username, count)
        : fetchLichessHistory(username, count);

    fetcher
      .then((data) => {
        if (controller.signal.aborted) return;
        setAllPoints(data);
        setStatus("success");
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setStatus("error");
      });

    return () => {
      controller.abort();
    };
  }, [username, platform, count, enabled]);

  // Client-side filter by time control, then take the last `count` games
  const points =
    timeControl === "all"
      ? allPoints.slice(-count)
      : allPoints.filter((p) => p.timeControl === timeControl).slice(-count);

  return { status, points };
}
