// server/services/chesscom.ts — chess.com adapter → normalized RawGame[]
// Ported from reference/src/providers.ts (chess.com section).
// Retry/User-Agent behavior preserved; returns same RawGame shape as lichess.ts.

import type { RawGame, FetchOpts } from "../../shared/prepTypes.js";
import { parseGames } from "../prep/parseGames.js";

const UA = "ChessOTB.club scouting v3 (contact: admin@chessotb.club)";

/* ---------------- PGN movetext → SAN tokens --------------------------------
   Strips headers, {comments} (incl. [%clk]), (variations), NAGs, move numbers.
   Identical to reference pgnToSans() — do not simplify further.
----------------------------------------------------------------------------- */
export function pgnToSans(pgn: string): string[] {
  let s = pgn.replace(/^\[.*\]$/gm, " ");                       // headers
  s = s.replace(/\{[^}]*\}/g, " ");                             // {comments}
  for (let i = 0; i < 6 && /\([^()]*\)/.test(s); i++)
    s = s.replace(/\([^()]*\)/g, " ");                          // (variations)
  s = s.replace(/\$\d+/g, " ");                                 // NAGs
  s = s.replace(/\b\d+\.(\.\.)?/g, " ");                        // move numbers
  s = s.replace(/\b(1-0|0-1|1\/2-1\/2|\*)\s*$/m, " ");
  return s.split(/\s+/).filter(t => t && !/^(1-0|0-1|1\/2-1\/2|\*)$/.test(t));
}

function ccResult(w: string, b: string): RawGame["result"] {
  if (w === "win") return "1-0";
  if (b === "win") return "0-1";
  if (["agreed", "repetition", "stalemate", "insufficient", "50move", "timevsinsufficient"].includes(w))
    return "1/2-1/2";
  return "*";
}

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

function readString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function readNumber(value: unknown, fallback: number | null): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeChesscom(payload: unknown): RawGame {
  const game = asRecord(payload);
  const white = asRecord(game.white);
  const black = asRecord(game.black);
  const whiteResult = readString(white.result, "?");
  const blackResult = readString(black.result, "?");

  return {
    provider: "chesscom",
    url: readString(game.url, ""),
    rated: game.rated === true,
    rules: readString(game.rules, "chess"),
    timeClass: readString(game.time_class, "unknown"),
    endTime: readNumber(game.end_time, 0) ?? 0,
    white: { name: readString(white.username, "?"), rating: readNumber(white.rating, null), result: whiteResult },
    black: { name: readString(black.username, "?"), rating: readNumber(black.rating, null), result: blackResult },
    result: ccResult(whiteResult, blackResult),
    sans: pgnToSans(readString(game.pgn, "")),
  };
}

export async function fetchWithRetry(
  url: string,
  opts: RequestInit,
  retries = 2,
  timeoutMs = 10_000,
  outerSignal?: AbortSignal,
): Promise<Response> {
  const throwIfCancelled = () => {
    if (outerSignal?.aborted) throw new Error("RequestCancelled: chess.com");
  };
  for (let attempt = 0; attempt < retries; attempt++) {
    throwIfCancelled();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const abortOuter = () => controller.abort();
    outerSignal?.addEventListener("abort", abortOuter, { once: true });
    try {
      const res = await fetch(url, { ...opts, signal: controller.signal });
      if (res.status === 429) {
        if (attempt === retries - 1) throw new Error("UpstreamRateLimited: chess.com");
        // One bounded retry is enough to avoid retry storms.
        await new Promise(r => setTimeout(r, Math.min(2_000 * (attempt + 1), Math.max(0, timeoutMs - 50))));
        continue;
      }
      return res;
    } catch (err) {
      if (outerSignal?.aborted) throw new Error("RequestCancelled: chess.com", { cause: err });
      if (err instanceof Error && err.message.startsWith("UpstreamRateLimited:")) throw err;
      if (attempt === retries - 1) {
        if (controller.signal.aborted) throw new Error("UpstreamTimeout: chess.com", { cause: err });
        throw new Error("UpstreamRequestFailed: chess.com", { cause: err });
      }
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    } finally {
      clearTimeout(timeout);
      outerSignal?.removeEventListener("abort", abortOuter);
    }
  }
  throw new Error("UpstreamRequestFailed: chess.com");
}

export async function fetchChesscom(username: string, o: FetchOpts): Promise<RawGame[]> {
  const deadlineAt = o.deadlineAt ?? Date.now() + 30_000;
  const remainingMs = () => Math.max(0, deadlineAt - Date.now());
  const requestTimeout = () => {
    if (o.signal?.aborted) throw new Error("RequestCancelled: chess.com");
    const remaining = remainingMs();
    if (remaining < 250) throw new Error("UpstreamTimeout: chess.com");
    return Math.min(10_000, remaining);
  };
  const archRes = await fetchWithRetry(
    `https://api.chess.com/pub/player/${username.toLowerCase()}/games/archives`,
    { headers: { "User-Agent": UA } },
    2,
    requestTimeout(),
    o.signal,
  );
  if (archRes.status === 404) throw new Error(`PlayerNotFound: ${username}`);
  if (archRes.status === 429) throw new Error(`UpstreamRateLimited: chess.com`);
  if (!archRes.ok) throw new Error(`Upstream${archRes.status}`);

  const archivesPayload = asRecord(await archRes.json());
  const archives = Array.isArray(archivesPayload.archives)
    ? archivesPayload.archives.filter((archive): archive is string => typeof archive === "string")
    : [];
  const months = [...archives].reverse();
  if (!months.length) throw new Error(`NoRecentGames: ${username}`);

  const out: RawGame[] = [];
  let eligibleCount = 0;
  for (const url of months) {
    const res = await fetchWithRetry(url, { headers: { "User-Agent": UA } }, 2, requestTimeout(), o.signal);
    if (!res.ok) continue;
    const monthPayload = asRecord(await res.json());
    const games = Array.isArray(monthPayload.games) ? monthPayload.games : [];
    const page = [...games].reverse().map(normalizeChesscom);
    out.push(...page);
    eligibleCount += parseGames(page, username, o).parsed.length;
    if (eligibleCount >= o.maxGames) break;
  }
  if (!out.length) throw new Error(`NoRecentGames: ${username}`);
  return out;
}

/** Load chess.com fixture JSON (array of raw chess.com game objects) */
export function loadChesscomFixture(games: unknown[]): RawGame[] {
  return games.map(normalizeChesscom);
}
