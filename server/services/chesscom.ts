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

function normalizeChesscom(g: any): RawGame {
  return {
    provider: "chesscom",
    url: g.url ?? "",
    rated: !!g.rated,
    rules: g.rules ?? "chess",
    timeClass: g.time_class ?? "unknown",
    endTime: g.end_time ?? 0,
    white: { name: g.white?.username ?? "?", rating: g.white?.rating ?? null, result: g.white?.result ?? "?" },
    black: { name: g.black?.username ?? "?", rating: g.black?.rating ?? null, result: g.black?.result ?? "?" },
    result: ccResult(g.white?.result ?? "", g.black?.result ?? ""),
    sans: pgnToSans(g.pgn ?? ""),
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

  const months: string[] = (await archRes.json()).archives?.slice(-o.months).reverse() ?? [];
  if (!months.length) throw new Error(`NoRecentGames: ${username}`);

  const out: RawGame[] = [];
  for (const url of months) {
    if (out.length >= o.maxGames) break;
    const res = await fetchWithRetry(url, { headers: { "User-Agent": UA } });
    if (!res.ok) continue;
    const data = await res.json();
    for (const g of ((data.games ?? []) as any[]).reverse()) {
      out.push(normalizeChesscom(g));
      if (out.length >= o.maxGames) break;
    }
  }
  if (!out.length) throw new Error(`NoRecentGames: ${username}`);
  return out;
}

/** Load chess.com fixture JSON (array of raw chess.com game objects) */
export function loadChesscomFixture(games: any[]): RawGame[] {
  return games.map(normalizeChesscom);
}
