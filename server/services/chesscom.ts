// server/services/chesscom.ts — chess.com adapter → normalized RawGame[]
// Ported from reference/src/providers.ts (chess.com section).
// Retry/User-Agent behavior preserved; returns same RawGame shape as lichess.ts.

import type { RawGame, FetchOpts } from "../../shared/prepTypes.js";

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

async function fetchWithRetry(url: string, opts: RequestInit, retries = 3): Promise<Response> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url, opts);
      if (res.status === 429) {
        // Rate limited — wait and retry
        await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
        continue;
      }
      return res;
    } catch (err) {
      if (attempt === retries - 1) throw err;
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  throw new Error("MaxRetriesExceeded");
}

export async function fetchChesscom(username: string, o: FetchOpts): Promise<RawGame[]> {
  const archRes = await fetchWithRetry(
    `https://api.chess.com/pub/player/${username.toLowerCase()}/games/archives`,
    { headers: { "User-Agent": UA } }
  );
  if (archRes.status === 404) throw new Error(`PlayerNotFound: ${username}`);
  if (archRes.status === 429) throw new Error(`UpstreamRateLimited: chess.com`);
  if (!archRes.ok) throw new Error(`Upstream${archRes.status}`);

  const archivesPayload = asRecord(await archRes.json());
  const archives = Array.isArray(archivesPayload.archives)
    ? archivesPayload.archives.filter((archive): archive is string => typeof archive === "string")
    : [];
  const months = archives.slice(-o.months).reverse();
  if (!months.length) throw new Error(`NoRecentGames: ${username}`);

  const out: RawGame[] = [];
  for (const url of months) {
    if (out.length >= o.maxGames) break;
    const res = await fetchWithRetry(url, { headers: { "User-Agent": UA } });
    if (!res.ok) continue;
    const monthPayload = asRecord(await res.json());
    const games = Array.isArray(monthPayload.games) ? monthPayload.games : [];
    for (const game of [...games].reverse()) {
      out.push(normalizeChesscom(game));
      if (out.length >= o.maxGames) break;
    }
  }
  if (!out.length) throw new Error(`NoRecentGames: ${username}`);
  return out;
}

/** Load chess.com fixture JSON (array of raw chess.com game objects) */
export function loadChesscomFixture(games: unknown[]): RawGame[] {
  return games.map(normalizeChesscom);
}
