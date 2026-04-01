/**
 * Public Tournament Snapshot Cache
 *
 * Provides an in-memory, precomputed read model for the public tournament dashboard.
 * Key design decisions:
 *   - One snapshot per tournament, invalidated when the director saves state
 *   - Standings (Buchholz, SB) computed once at publish time, not per-viewer
 *   - Player data stripped of sensitive fields (colorHistory, phone, email)
 *   - ETag generated from content hash for HTTP 304 responses
 *   - TTL-based expiry as a safety net (5 minutes)
 */

import { createHash } from "crypto";

// ─── Types (public-facing, stripped) ─────────────────────────────────────────

export interface PublicPlayer {
  id: string;
  name: string;
  username: string;
  elo: number;
  title?: string;
  avatarUrl?: string;
  platform?: string;
}

export interface PublicGame {
  id: string;
  board: number;
  whiteId: string;
  blackId: string;
  result: string; // "1-0" | "0-1" | "½-½" | "*"
  gameIndex?: number;
}

export interface PublicRound {
  number: number;
  games: PublicGame[];
}

export interface StandingRow {
  playerId: string;
  name: string;
  username: string;
  elo: number;
  title?: string;
  avatarUrl?: string;
  rank: number;
  points: number;
  buchholz: number;
  wins: number;
  draws: number;
  losses: number;
}

export interface PublicSnapshot {
  tournamentId: string;
  status: string;
  currentRound: number;
  totalRounds: number;
  tournamentName: string;
  format: string;
  venue: string;
  date: string;
  players: PublicPlayer[];
  rounds: PublicRound[];
  standings: StandingRow[];
  updatedAt: string;
}

interface CacheEntry {
  snapshot: PublicSnapshot;
  json: string;
  etag: string;
  createdAt: number;
}

// ─── Cache Store ─────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes safety net
const cache = new Map<string, CacheEntry>();

// ─── Standings Computation (server-side, mirrors client swiss.ts) ────────────

interface RawPlayer {
  id: string;
  name: string;
  username: string;
  elo: number;
  title?: string;
  avatarUrl?: string;
  points: number;
  wins: number;
  draws: number;
  losses: number;
  colorHistory?: unknown[];
  [key: string]: unknown;
}

interface RawGame {
  id: string;
  board: number;
  whiteId: string;
  blackId: string;
  result: string;
  gameIndex?: number;
  [key: string]: unknown;
}

interface RawRound {
  number: number;
  games: RawGame[];
  [key: string]: unknown;
}

function computeStandingsServer(players: RawPlayer[], rounds: RawRound[]): StandingRow[] {
  const pointsMap = new Map<string, number>();
  const winsMap = new Map<string, number>();
  const drawsMap = new Map<string, number>();
  const lossesMap = new Map<string, number>();

  for (const p of players) {
    pointsMap.set(p.id, 0);
    winsMap.set(p.id, 0);
    drawsMap.set(p.id, 0);
    lossesMap.set(p.id, 0);
  }

  for (const round of rounds) {
    for (const game of round.games) {
      if (game.result === "*") continue;
      if (game.whiteId === "BYE") {
        pointsMap.set(game.blackId, (pointsMap.get(game.blackId) ?? 0) + 0.5);
        drawsMap.set(game.blackId, (drawsMap.get(game.blackId) ?? 0) + 1);
        continue;
      }
      if (game.result === "1-0") {
        pointsMap.set(game.whiteId, (pointsMap.get(game.whiteId) ?? 0) + 1);
        winsMap.set(game.whiteId, (winsMap.get(game.whiteId) ?? 0) + 1);
        lossesMap.set(game.blackId, (lossesMap.get(game.blackId) ?? 0) + 1);
      } else if (game.result === "0-1") {
        pointsMap.set(game.blackId, (pointsMap.get(game.blackId) ?? 0) + 1);
        winsMap.set(game.blackId, (winsMap.get(game.blackId) ?? 0) + 1);
        lossesMap.set(game.whiteId, (lossesMap.get(game.whiteId) ?? 0) + 1);
      } else if (game.result === "½-½") {
        pointsMap.set(game.whiteId, (pointsMap.get(game.whiteId) ?? 0) + 0.5);
        pointsMap.set(game.blackId, (pointsMap.get(game.blackId) ?? 0) + 0.5);
        drawsMap.set(game.whiteId, (drawsMap.get(game.whiteId) ?? 0) + 1);
        drawsMap.set(game.blackId, (drawsMap.get(game.blackId) ?? 0) + 1);
      }
    }
  }

  // Build opponent list per player
  const opponentsMap = new Map<string, string[]>();
  for (const p of players) opponentsMap.set(p.id, []);
  for (const round of rounds) {
    for (const game of round.games) {
      if (game.result === "*") continue;
      if (game.whiteId !== "BYE" && game.blackId !== "BYE") {
        opponentsMap.get(game.whiteId)?.push(game.blackId);
        opponentsMap.get(game.blackId)?.push(game.whiteId);
      }
    }
  }

  // Compute Buchholz and Sonneborn-Berger
  const rows: StandingRow[] = players.map((p) => {
    const pts = pointsMap.get(p.id) ?? 0;
    const opponents = opponentsMap.get(p.id) ?? [];
    const oppScores = opponents.map((oId) => pointsMap.get(oId) ?? 0).sort((a, b) => a - b);
    const buchholz = oppScores.reduce((sum, s) => sum + s, 0);

    return {
      playerId: p.id,
      name: p.name,
      username: p.username,
      elo: p.elo,
      title: p.title,
      avatarUrl: p.avatarUrl,
      rank: 0,
      points: pts,
      buchholz,
      wins: winsMap.get(p.id) ?? 0,
      draws: drawsMap.get(p.id) ?? 0,
      losses: lossesMap.get(p.id) ?? 0,
    };
  });

  // Sort: points → buchholz → ELO
  rows.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.buchholz !== a.buchholz) return b.buchholz - a.buchholz;
    return b.elo - a.elo;
  });

  rows.forEach((r, i) => { r.rank = i + 1; });
  return rows;
}

// ─── Snapshot Builder ────────────────────────────────────────────────────────

function stripPlayer(p: RawPlayer): PublicPlayer {
  return {
    id: p.id,
    name: p.name,
    username: p.username,
    elo: p.elo,
    ...(p.title ? { title: p.title } : {}),
    ...(p.avatarUrl ? { avatarUrl: p.avatarUrl } : {}),
    ...(p.platform ? { platform: p.platform as string } : {}),
  };
}

function stripGame(g: RawGame): PublicGame {
  return {
    id: g.id,
    board: g.board,
    whiteId: g.whiteId,
    blackId: g.blackId,
    result: g.result,
    ...(g.gameIndex !== undefined ? { gameIndex: g.gameIndex } : {}),
  };
}

function stripRound(r: RawRound): PublicRound {
  return {
    number: r.number,
    games: r.games.map(stripGame),
  };
}

export interface BuildSnapshotInput {
  tournamentId: string;
  status: string;
  currentRound: number;
  totalRounds: number;
  tournamentName: string;
  format: string;
  venue: string;
  date: string;
  players: RawPlayer[];
  rounds: RawRound[];
  updatedAt: string;
}

export function buildSnapshot(input: BuildSnapshotInput): PublicSnapshot {
  return {
    tournamentId: input.tournamentId,
    status: input.status,
    currentRound: input.currentRound,
    totalRounds: input.totalRounds,
    tournamentName: input.tournamentName,
    format: input.format,
    venue: input.venue,
    date: input.date,
    players: input.players.map(stripPlayer),
    rounds: input.rounds.map(stripRound),
    standings: computeStandingsServer(input.players, input.rounds),
    updatedAt: input.updatedAt,
  };
}

// ─── Cache Operations ────────────────────────────────────────────────────────

function generateEtag(json: string): string {
  return `"${createHash("md5").update(json).digest("hex")}"`;
}

export function getSnapshotCache(tournamentId: string): CacheEntry | null {
  const entry = cache.get(tournamentId);
  if (!entry) return null;
  // TTL check
  if (Date.now() - entry.createdAt > CACHE_TTL_MS) {
    cache.delete(tournamentId);
    return null;
  }
  return entry;
}

export function setSnapshotCache(tournamentId: string, snapshot: PublicSnapshot): CacheEntry {
  const json = JSON.stringify(snapshot);
  const etag = generateEtag(json);
  const entry: CacheEntry = { snapshot, json, etag, createdAt: Date.now() };
  cache.set(tournamentId, entry);
  return entry;
}

export function invalidateSnapshotCache(tournamentId: string): void {
  cache.delete(tournamentId);
}

/** Invalidate all cached snapshots (e.g., on server restart). */
export function clearAllSnapshots(): void {
  cache.clear();
}

// ─── Exported for testing ────────────────────────────────────────────────────
export { computeStandingsServer };
