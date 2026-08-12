// Lichess game export provider and shared upstream request scheduler.
import type { RawGame, FetchOpts } from "../../shared/prepTypes.js";

const UA = "ChessOTB.club scouting v3 (contact: admin@chessotb.club)";
const MIN_429_COOLDOWN_MS = 60_000;
let cooldownUntil: number | null = null;
let requestTail: Promise<void> = Promise.resolve();

interface LichessApiGame {
  id: string;
  winner?: "white" | "black";
  status?: string;
  variant?: string;
  speed?: RawGame["timeClass"];
  rated?: boolean;
  lastMoveAt?: number;
  createdAt?: number;
  moves?: string;
  players?: {
    white?: { user?: { name?: string }; rating?: number };
    black?: { user?: { name?: string }; rating?: number };
  };
}

function normalizeLichess(g: LichessApiGame): RawGame {
  const result: RawGame["result"] =
    g.winner === "white" ? "1-0"
    : g.winner === "black" ? "0-1"
    : (g.status === "draw" || g.status === "stalemate" ? "1/2-1/2"
    : (g.winner ? "*" : "1/2-1/2"));
  return {
    provider: "lichess",
    url: `https://lichess.org/${g.id}`,
    rated: Boolean(g.rated),
    rules: g.variant === "standard" ? "chess" : (g.variant ?? "unknown"),
    timeClass: g.speed ?? "unknown",
    endTime: Math.floor((g.lastMoveAt ?? g.createdAt ?? 0) / 1000),
    white: { name: g.players?.white?.user?.name ?? "?", rating: g.players?.white?.rating ?? null, result: g.winner === "white" ? "win" : g.winner === "black" ? "lost" : "draw" },
    black: { name: g.players?.black?.user?.name ?? "?", rating: g.players?.black?.rating ?? null, result: g.winner === "black" ? "win" : g.winner === "white" ? "lost" : "draw" },
    result,
    sans: (g.moves ?? "").split(/\s+/).filter(Boolean),
  };
}

/** One process-wide Lichess lane: concurrency 1, 429 cooldown, deadline. */
export async function scheduleLichessRequest(url: string, init: RequestInit = {}, timeoutMs = 12_000): Promise<Response> {
  let release: (() => void) | undefined;
  const previous = requestTail;
  requestTail = new Promise<void>(resolve => { release = resolve; });
  await previous.catch(() => undefined);
  try {
    if (cooldownUntil !== null && Date.now() < cooldownUntil) {
      throw new Error(`LichessRateLimited: cooldown until ${new Date(cooldownUntil).toISOString()}`);
    }
    const response = await fetch(url, {
      ...init,
      headers: { "User-Agent": UA, ...(init.headers ?? {}) },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (response.status === 429) {
      const retryAfterSeconds = Number.parseInt(response.headers.get("Retry-After") ?? "60", 10);
      cooldownUntil = Date.now() + Math.max(Number.isFinite(retryAfterSeconds) ? retryAfterSeconds * 1000 : 0, MIN_429_COOLDOWN_MS);
      throw new Error(`LichessRateLimited: 429 from ${url}`);
    }
    return response;
  } finally {
    release?.();
  }
}

export function getLichessRateLimitState(): { cooldownUntil: number | null; retryAt: string | null } {
  return { cooldownUntil, retryAt: cooldownUntil ? new Date(cooldownUntil).toISOString() : null };
}

/** @internal Deterministic state reset for provider contract tests. */
export function resetLichessSchedulerForTests(): void {
  cooldownUntil = null;
  requestTail = Promise.resolve();
}

async function fetchWithRetry(url: string, init: RequestInit, retries = 3): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      // Public user exports can be slow for prolific players. Keep a bounded
      // deadline, but avoid treating a normal large NDJSON response as a fault.
      return await scheduleLichessRequest(url, init, 30_000);
    } catch (error) {
      lastError = error;
      if (error instanceof Error && error.message.startsWith("LichessRateLimited:")) throw error;
      if (attempt < retries - 1) await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("LichessRequestFailed");
}

export async function fetchLichess(username: string, options: FetchOpts): Promise<RawGame[]> {
  const perf = options.timeClasses.join(",");
  const url = `https://lichess.org/api/games/user/${username}?max=${options.maxGames}&rated=${options.ratedOnly}&perfType=${perf}&moves=true&opening=false`;
  const response = await fetchWithRetry(url, { headers: { Accept: "application/x-ndjson" } });
  if (response.status === 404) throw new Error(`PlayerNotFound: ${username}`);
  if (!response.ok) throw new Error(`Upstream${response.status}`);
  const lines = (await response.text()).trim().split("\n").filter(Boolean);
  if (!lines.length) throw new Error(`NoRecentGames: ${username}`);
  return lines.map(line => normalizeLichess(JSON.parse(line) as LichessApiGame));
}

export function loadLichessFixture(ndjson: string): RawGame[] {
  return ndjson.trim().split("\n").filter(Boolean).map(line => normalizeLichess(JSON.parse(line) as LichessApiGame));
}
