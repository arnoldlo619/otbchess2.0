// src/providers.ts — chess.com + Lichess adapters → normalized RawGame[]
// Live fetch works on any machine with internet; fixture mode works everywhere.
import { readFileSync } from "node:fs";
import type { Provider, RawGame } from "./types.ts";

const UA = "ChessOTB.club scouting MVP (contact: admin@chessotb.club)";

export interface FetchOpts {
  maxGames: number;           // default 100
  months: number;             // chess.com archives lookback, default 6
  timeClasses: string[];      // ["rapid","blitz"]
  ratedOnly: boolean;         // default true
}
export const DEFAULT_OPTS: FetchOpts = { maxGames: 100, months: 6, timeClasses: ["rapid", "blitz"], ratedOnly: true };

/* ---------------- PGN movetext → SAN tokens (headers/comments/NAGs/variations stripped) -------- */
export function pgnToSans(pgn: string): string[] {
  let s = pgn.replace(/^\[.*\]$/gm, " ");            // headers
  s = s.replace(/\{[^}]*\}/g, " ");                  // {comments} incl. [%clk]
  for (let i = 0; i < 6 && /\([^()]*\)/.test(s); i++) s = s.replace(/\([^()]*\)/g, " "); // (variations)
  s = s.replace(/\$\d+/g, " ");                      // NAGs
  s = s.replace(/\b\d+\.(\.\.)?/g, " ");             // move numbers
  s = s.replace(/\b(1-0|0-1|1\/2-1\/2|\*)\s*$/m, " ");
  return s.split(/\s+/).filter(t => t && !/^(1-0|0-1|1\/2-1\/2|\*)$/.test(t));
}

function ccResult(w: string, b: string): RawGame["result"] {
  if (w === "win") return "1-0";
  if (b === "win") return "0-1";
  if (["agreed", "repetition", "stalemate", "insufficient", "50move", "timevsinsufficient"].includes(w)) return "1/2-1/2";
  return "*";
}

/* ------------------------------------ chess.com ------------------------------------------------ */
function normalizeChesscom(g: any): RawGame {
  return {
    provider: "chesscom", url: g.url ?? "", rated: !!g.rated, rules: g.rules ?? "chess",
    timeClass: g.time_class ?? "unknown", endTime: g.end_time ?? 0,
    white: { name: g.white?.username ?? "?", rating: g.white?.rating ?? null, result: g.white?.result ?? "?" },
    black: { name: g.black?.username ?? "?", rating: g.black?.rating ?? null, result: g.black?.result ?? "?" },
    result: ccResult(g.white?.result ?? "", g.black?.result ?? ""),
    sans: pgnToSans(g.pgn ?? ""),
  };
}

export async function fetchChesscom(username: string, o: FetchOpts): Promise<RawGame[]> {
  const arch = await fetch(`https://api.chess.com/pub/player/${username.toLowerCase()}/games/archives`,
    { headers: { "User-Agent": UA } });
  if (arch.status === 404) throw new Error(`PlayerNotFound: ${username}`);
  if (!arch.ok) throw new Error(`Upstream${arch.status}`);
  const months: string[] = (await arch.json()).archives.slice(-o.months).reverse();
  const out: RawGame[] = [];
  for (const url of months) {
    if (out.length >= o.maxGames) break;
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) continue;
    for (const g of ((await res.json()).games ?? []).reverse()) {
      out.push(normalizeChesscom(g));
      if (out.length >= o.maxGames) break;
    }
  }
  if (!out.length) throw new Error(`NoRecentGames: ${username}`);
  return out;
}

/* ------------------------------------- Lichess -------------------------------------------------- */
function normalizeLichess(g: any): RawGame {
  const res: RawGame["result"] = g.winner === "white" ? "1-0" : g.winner === "black" ? "0-1"
    : (g.status === "draw" || g.status === "stalemate" ? "1/2-1/2" : (g.winner ? "*" : "1/2-1/2"));
  return {
    provider: "lichess", url: `https://lichess.org/${g.id}`, rated: !!g.rated,
    rules: g.variant === "standard" ? "chess" : (g.variant ?? "unknown"),
    timeClass: g.speed ?? "unknown", endTime: Math.floor((g.lastMoveAt ?? g.createdAt ?? 0) / 1000),
    white: { name: g.players?.white?.user?.name ?? "?", rating: g.players?.white?.rating ?? null,
             result: g.winner === "white" ? "win" : g.winner === "black" ? "lost" : "draw" },
    black: { name: g.players?.black?.user?.name ?? "?", rating: g.players?.black?.rating ?? null,
             result: g.winner === "black" ? "win" : g.winner === "white" ? "lost" : "draw" },
    result: res,
    sans: (g.moves ?? "").split(/\s+/).filter(Boolean),
  };
}

export async function fetchLichess(username: string, o: FetchOpts): Promise<RawGame[]> {
  const perf = o.timeClasses.join(",");
  const url = `https://lichess.org/api/games/user/${username}?max=${o.maxGames}`
    + `&rated=${o.ratedOnly}&perfType=${perf}&moves=true&opening=false`;
  const res = await fetch(url, { headers: { Accept: "application/x-ndjson", "User-Agent": UA } });
  if (res.status === 404) throw new Error(`PlayerNotFound: ${username}`);
  if (!res.ok) throw new Error(`Upstream${res.status}`);
  const lines = (await res.text()).trim().split("\n").filter(Boolean);
  if (!lines.length) throw new Error(`NoRecentGames: ${username}`);
  return lines.map(l => normalizeLichess(JSON.parse(l)));
}

/* ------------------------------------- fixtures ------------------------------------------------- */
export function loadFixture(path: string): RawGame[] {
  const text = readFileSync(path, "utf-8");
  if (path.endsWith(".ndjson"))
    return text.trim().split("\n").filter(Boolean).map(l => normalizeLichess(JSON.parse(l)));
  return (JSON.parse(text).games as any[]).map(normalizeChesscom);
}

export async function getGames(provider: Provider, username: string, o: FetchOpts, fixture?: string): Promise<RawGame[]> {
  if (fixture) return loadFixture(fixture);
  return provider === "lichess" ? fetchLichess(username, o) : fetchChesscom(username, o);
}
