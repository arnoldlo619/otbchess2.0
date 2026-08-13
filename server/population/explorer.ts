import { createHash } from "crypto";
import { Chess } from "chess.js";
import { replayUciPath } from "../prep/analysisResolver.js";
import { scheduleLichessRequest } from "../services/lichess.js";
import { LICHESS_RATING_GROUPS, type LichessRatingGroup, type PopulationSpeed } from "./foundation.js";

const EXPLORER_ORIGIN = "https://explorer.lichess.org";
const EXPLORER_PATH = "/lichess";
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const UCI_RE = /^[a-h][1-8][a-h][1-8][qrbn]?$/;

export interface PopulationExplorerQuery {
  uciPath: readonly string[];
  speeds: readonly PopulationSpeed[];
  ratingBand: number;
  since: string;
  until: string;
}

export interface PopulationExplorerMove {
  uci: string;
  san: string;
  averageRating: number;
  count: bigint;
  white: bigint;
  draws: bigint;
  black: bigint;
}

export interface PopulationExplorerSnapshot {
  positionTotal: bigint;
  white: bigint;
  draws: bigint;
  black: bigint;
  moves: PopulationExplorerMove[];
}

function isSafeCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function assertQuery(query: PopulationExplorerQuery): void {
  if (!Array.isArray(query.uciPath) || query.uciPath.length > 24 || !query.uciPath.every(move => UCI_RE.test(move))) throw new Error("Invalid legal UCI path");
  if (!Array.isArray(query.speeds) || query.speeds.length === 0 || query.speeds.length > 3 || !query.speeds.every(speed => ["bullet", "blitz", "rapid"].includes(speed))) throw new Error("Invalid speed filter");
  if (!LICHESS_RATING_GROUPS.includes(query.ratingBand as LichessRatingGroup)) throw new Error("Unsupported rating group");
  if (!MONTH_RE.test(query.since) || !MONTH_RE.test(query.until) || query.since > query.until) throw new Error("Invalid population month window");
  const replay = replayUciPath([...query.uciPath]);
  if (!replay.ok) throw new Error(`Illegal population position: ${replay.error}`);
}

/** Builds only the official population endpoint. Browser code never sees this URL. */
export function buildPopulationExplorerUrl(query: PopulationExplorerQuery): string {
  assertQuery(query);
  const url = new URL(EXPLORER_PATH, EXPLORER_ORIGIN);
  url.searchParams.set("variant", "standard");
  url.searchParams.set("speeds", [...query.speeds].join(","));
  url.searchParams.set("ratings", String(query.ratingBand));
  url.searchParams.set("since", query.since);
  url.searchParams.set("until", query.until);
  url.searchParams.set("moves", "12");
  url.searchParams.set("topGames", "0");
  url.searchParams.set("recentGames", "0");
  url.searchParams.set("history", "false");
  if (query.uciPath.length) url.searchParams.set("play", query.uciPath.join(","));
  return url.toString();
}

/** Rejects malformed counts/moves and discards every upstream game reference. */
export function validatePopulationExplorerResponse(query: PopulationExplorerQuery, payload: unknown): PopulationExplorerSnapshot {
  assertQuery(query);
  if (!payload || typeof payload !== "object") throw new Error("Invalid population Explorer response");
  const source = payload as { white?: unknown; draws?: unknown; black?: unknown; moves?: unknown };
  if (!isSafeCount(source.white) || !isSafeCount(source.draws) || !isSafeCount(source.black) || !Array.isArray(source.moves)) throw new Error("Invalid population count response");
  const positionTotal = BigInt(source.white + source.draws + source.black);
  const board = new Chess();
  for (const move of query.uciPath) board.move({ from: move.slice(0, 2), to: move.slice(2, 4), promotion: move[4] as "q" | "r" | "b" | "n" | undefined });
  const moves: PopulationExplorerMove[] = source.moves.map((row) => {
    if (!row || typeof row !== "object") throw new Error("Invalid population move row");
    const value = row as { uci?: unknown; san?: unknown; averageRating?: unknown; white?: unknown; draws?: unknown; black?: unknown };
    if (typeof value.uci !== "string" || !UCI_RE.test(value.uci) || typeof value.san !== "string" || !isSafeCount(value.averageRating) || !isSafeCount(value.white) || !isSafeCount(value.draws) || !isSafeCount(value.black)) throw new Error("Invalid population move row");
    const legal = board.moves({ verbose: true }).find(move => `${move.from}${move.to}${move.promotion ?? ""}` === value.uci);
    if (!legal) throw new Error("Illegal population move");
    const count = BigInt(value.white + value.draws + value.black);
    if (count > positionTotal) throw new Error("move count exceeds position total");
    return { uci: value.uci, san: legal.san, averageRating: value.averageRating, count, white: BigInt(value.white), draws: BigInt(value.draws), black: BigInt(value.black) };
  });
  return { positionTotal, white: BigInt(source.white), draws: BigInt(source.draws), black: BigInt(source.black), moves };
}

const inflight = new Map<string, Promise<PopulationExplorerSnapshot>>();

export function populationExplorerRequestKey(query: PopulationExplorerQuery): string {
  assertQuery(query);
  return createHash("sha256").update(JSON.stringify({ p: query.uciPath, s: [...query.speeds].sort(), r: query.ratingBand, f: query.since, t: query.until })).digest("hex");
}

/** Uses the existing process-wide Lichess lane, preserving one concurrency and shared 429 cooldown. */
export async function fetchOfficialPopulationExplorer(query: PopulationExplorerQuery): Promise<PopulationExplorerSnapshot> {
  const key = populationExplorerRequestKey(query);
  const existing = inflight.get(key);
  if (existing) return existing;
  const request = (async () => {
    const token = process.env.LICHESS_API_TOKEN?.trim();
    const response = await scheduleLichessRequest(buildPopulationExplorerUrl(query), {
      headers: {
        Accept: "application/json",
        "User-Agent": "ChessOTB.club population explorer (support@chessotb.club)",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    }, 12_000);
    if (!response.ok) throw new Error(`PopulationExplorerUpstream${response.status}`);
    return validatePopulationExplorerResponse(query, await response.json());
  })().finally(() => inflight.delete(key));
  inflight.set(key, request);
  return request;
}

export function resolvePopulationSource(input: {
  local: { complete: boolean; total: bigint } | null;
  upstream: { total: bigint } | null;
}): { source: "local"; total: bigint } | { source: "upstream"; total: bigint } | { source: "unavailable" } {
  if (input.local?.complete) return { source: "local", total: input.local.total };
  if (input.upstream) return { source: "upstream", total: input.upstream.total };
  return { source: "unavailable" };
}
