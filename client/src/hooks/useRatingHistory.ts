/**
 * useRatingHistory
 *
 * Fetches a player's last N rated games' post-game ratings from chess.com or
 * Lichess, returning a time-ordered array of { date, rating } data points
 * suitable for rendering a sparkline.
 *
 * chess.com strategy:
 *   1. Fetch /pub/player/{username}/games/archives to get monthly archive URLs
 *   2. Walk archives newest-first, fetching each month's games until we have ≥ N
 *   3. Extract the "post_game_rating" from the player's side of each rated game
 *
 * Lichess strategy:
 *   1. Fetch /api/games/user/{username}?max=N&rated=true&perfType=rapid,blitz,bullet
 *      with Accept: application/x-ndjson
 *   2. Parse NDJSON, extract the player's rating from each game's "players" object
 *
 * Both paths use sessionStorage caching (5-minute TTL) to avoid redundant calls.
 */

import { useState, useEffect, useRef } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RatingPoint {
  /** Unix timestamp (ms) of the game */
  date: number;
  /** Post-game rating after this result */
  rating: number;
  /** Result from the player's perspective */
  result: "win" | "draw" | "loss";
}

export type RatingHistoryStatus = "idle" | "loading" | "success" | "error";

// ─── Cache ────────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry {
  data: RatingPoint[];
  fetchedAt: number;
}

function cacheKey(platform: "chesscom" | "lichess", username: string) {
  return `otb_rating_history_${platform}_${username.toLowerCase()}`;
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

  // Walk archives newest-first
  const points: RatingPoint[] = [];
  for (let i = archives.length - 1; i >= 0 && points.length < count; i--) {
    const monthRes = await fetch(archives[i], { headers });
    if (!monthRes.ok) continue;
    const monthData = await monthRes.json();
    const games: unknown[] = monthData.games ?? [];

    // Process newest games first within the month
    for (let j = games.length - 1; j >= 0 && points.length < count; j--) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const g: any = games[j];
      if (!g.rated) continue;
      if (g.rules && g.rules !== "chess") continue; // skip variants

      // Determine which side the player is on
      const isWhite =
        (g.white?.username ?? "").toLowerCase() === u;
      const side = isWhite ? g.white : g.black;
      if (!side?.rating) continue;

      const rating: number = side.rating;
      const endTime: number = (g.end_time ?? 0) * 1000;

      // Determine result
      let result: "win" | "draw" | "loss" = "draw";
      const res: string = side.result ?? "";
      if (res === "win") result = "win";
      else if (["checkmated", "timeout", "resigned", "lose", "abandoned"].includes(res))
        result = "loss";

      points.push({ date: endTime, rating, result });
    }
  }

  // Points are newest-first; reverse to chronological order
  const sorted = points.reverse();
  writeCache(key, sorted);
  return sorted;
}

// ─── Lichess fetcher ──────────────────────────────────────────────────────────

async function fetchLichessHistory(
  username: string,
  count: number
): Promise<RatingPoint[]> {
  const key = cacheKey("lichess", username);
  const cached = readCache(key);
  if (cached) return cached;

  const u = encodeURIComponent(username.toLowerCase().trim());
  // Request more than needed to account for non-rated or filtered games
  const url =
    `https://lichess.org/api/games/user/${u}` +
    `?max=${count * 2}&rated=true&perfType=rapid,blitz,bullet,classical` +
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
    if (points.length >= count) break;
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

      // Determine result
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

      points.push({ date, rating, result });
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
  /** Only fetch when enabled (e.g. when the hover card is visible) */
  enabled?: boolean;
}

export function useRatingHistory({
  username,
  platform,
  count = 10,
  enabled = true,
}: UseRatingHistoryOptions) {
  const [status, setStatus] = useState<RatingHistoryStatus>("idle");
  const [points, setPoints] = useState<RatingPoint[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!enabled || !username.trim()) return;

    // Check cache first — if hit, skip loading state entirely
    const key = cacheKey(platform, username);
    const cached = readCache(key);
    if (cached) {
      setPoints(cached);
      setStatus("success");
      return;
    }

    setStatus("loading");
    setPoints([]);

    const controller = new AbortController();
    abortRef.current = controller;

    const fetcher =
      platform === "chesscom"
        ? fetchChessComHistory(username, count)
        : fetchLichessHistory(username, count);

    fetcher
      .then((data) => {
        if (controller.signal.aborted) return;
        setPoints(data);
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

  return { status, points };
}
