// server/services/lichess.ts — Lichess adapter → normalized RawGame[]
// Ported from reference/src/providers.ts (Lichess section).
// Returns the same RawGame shape as chesscom.ts.

import type { RawGame, FetchOpts } from "../../shared/prepTypes.js";

const UA = "ChessOTB.club scouting v3 (contact: admin@chessotb.club)";

function normalizeLichess(g: any): RawGame {
  const res: RawGame["result"] =
    g.winner === "white" ? "1-0"
    : g.winner === "black" ? "0-1"
    : (g.status === "draw" || g.status === "stalemate" ? "1/2-1/2"
    : (g.winner ? "*" : "1/2-1/2"));

  return {
    provider: "lichess",
    url: `https://lichess.org/${g.id}`,
    rated: !!g.rated,
    rules: g.variant === "standard" ? "chess" : (g.variant ?? "unknown"),
    timeClass: g.speed ?? "unknown",
    endTime: Math.floor((g.lastMoveAt ?? g.createdAt ?? 0) / 1000),
    white: {
      name: g.players?.white?.user?.name ?? "?",
      rating: g.players?.white?.rating ?? null,
      result: g.winner === "white" ? "win" : g.winner === "black" ? "lost" : "draw",
    },
    black: {
      name: g.players?.black?.user?.name ?? "?",
      rating: g.players?.black?.rating ?? null,
      result: g.winner === "black" ? "win" : g.winner === "white" ? "lost" : "draw",
    },
    result: res,
    sans: (g.moves ?? "").split(/\s+/).filter(Boolean),
  };
}

async function fetchWithRetry(url: string, opts: RequestInit, retries = 3): Promise<Response> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url, opts);
      if (res.status === 429) {
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

export async function fetchLichess(username: string, o: FetchOpts): Promise<RawGame[]> {
  const perf = o.timeClasses.join(",");
  const url =
    `https://lichess.org/api/games/user/${username}?max=${o.maxGames}` +
    `&rated=${o.ratedOnly}&perfType=${perf}&moves=true&opening=false`;

  const res = await fetchWithRetry(url, {
    headers: { Accept: "application/x-ndjson", "User-Agent": UA },
  });
  if (res.status === 404) throw new Error(`PlayerNotFound: ${username}`);
  if (res.status === 429) throw new Error(`UpstreamRateLimited: lichess`);
  if (!res.ok) throw new Error(`Upstream${res.status}`);

  const text = await res.text();
  const lines = text.trim().split("\n").filter(Boolean);
  if (!lines.length) throw new Error(`NoRecentGames: ${username}`);
  return lines.map(l => normalizeLichess(JSON.parse(l)));
}

/** Load Lichess NDJSON fixture (one JSON object per line) */
export function loadLichessFixture(ndjson: string): RawGame[] {
  return ndjson
    .trim()
    .split("\n")
    .filter(Boolean)
    .map(l => normalizeLichess(JSON.parse(l)));
}
