/**
 * Public Tournament Snapshot Cache
 *
 * Provides an in-memory, precomputed read model for the public tournament dashboard.
 * Key design decisions:
 *   - One snapshot per tournament, invalidated when the director saves state
 *   - Standings (Buchholz for Swiss, Sonneborn-Berger for Quads) computed once at publish time
 *   - For Quads: standings are computed globally (all players) but SB is section-scoped
 *   - Player data stripped of sensitive fields (colorHistory, phone, email)
 *   - ETag generated from content hash for HTTP 304 responses
 *   - TTL-based expiry as a safety net (5 minutes)
 */

import { createHash } from "crypto";
import { projectQuadSectionStandings } from "../shared/quadsProjection.js";

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
  sonnebornBerger: number;
  wins: number;
  draws: number;
  losses: number;
}

export interface PublicQuadSection {
  id: string;
  name: string;
  type: "quad" | "bottom_swiss";
  playerIds: string[];
  standings: StandingRow[];
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
  quadSections?: PublicQuadSection[];
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

/**
 * Compute standings for a set of players across rounds.
 *
 * For Quads format, pass `sectionPlayerIds` to scope SB computation to
 * within-section opponents only. Points are always computed from the full
 * rounds array (which already contains only section games for Quads sections).
 */
function computeStandingsServer(
  players: RawPlayer[],
  rounds: RawRound[],
  options?: { format?: string; sectionPlayerIds?: Set<string> }
): StandingRow[] {
  const isQuads = options?.format === "quads";
  const sectionScope = options?.sectionPlayerIds;

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

  // Compute Buchholz (Swiss) and Sonneborn-Berger (Quads)
  // SB = sum of defeated opponents' scores + half of drawn opponents' scores
  // For Quads: only count opponents within the same section (sectionScope)
  const rows: StandingRow[] = players.map((p) => {
    const pts = pointsMap.get(p.id) ?? 0;
    const opponents = opponentsMap.get(p.id) ?? [];
    const oppScores = opponents.map((oId) => pointsMap.get(oId) ?? 0).sort((a, b) => a - b);
    const buchholz = oppScores.reduce((sum, s) => sum + s, 0);

    let sonnebornBerger = 0;
    for (const round of rounds) {
      for (const game of round.games) {
        if (game.result === "*") continue;
        if (game.whiteId === "BYE" || game.blackId === "BYE") continue;
        const isWhite = game.whiteId === p.id;
        const isBlack = game.blackId === p.id;
        if (!isWhite && !isBlack) continue;
        const opponentId = isWhite ? game.blackId : game.whiteId;
        // For Quads: skip opponents outside the section
        if (isQuads && sectionScope && !sectionScope.has(opponentId)) continue;
        const oppScore = pointsMap.get(opponentId) ?? 0;
        if (isWhite) {
          if (game.result === "1-0") sonnebornBerger += oppScore;
          else if (game.result === "½-½") sonnebornBerger += oppScore * 0.5;
        } else {
          if (game.result === "0-1") sonnebornBerger += oppScore;
          else if (game.result === "½-½") sonnebornBerger += oppScore * 0.5;
        }
      }
    }
    sonnebornBerger = Math.round(sonnebornBerger * 100) / 100;

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
      sonnebornBerger,
      wins: winsMap.get(p.id) ?? 0,
      draws: drawsMap.get(p.id) ?? 0,
      losses: lossesMap.get(p.id) ?? 0,
    };
  });

  // Sort: for Quads use SB tiebreak; for Swiss/other use Buchholz
  if (isQuads) {
    rows.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.sonnebornBerger !== a.sonnebornBerger) return b.sonnebornBerger - a.sonnebornBerger;
      return b.elo - a.elo;
    });
  } else {
    rows.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.buchholz !== a.buchholz) return b.buchholz - a.buchholz;
      return b.elo - a.elo;
    });
  }

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
  quadSections?: { id: string; name: string; type: string; playerIds: string[] }[];
  /** Persisted Quads tiebreak configuration. Legacy events use the canonical default. */
  quadSettings?: { tiebreakOrder?: string[] };
  updatedAt: string;
}

export function buildSnapshot(input: BuildSnapshotInput): PublicSnapshot {
  const isQuads = input.format === "quads";

  // Quads have independent sections. Build each section with the same read-only
  // tiebreak projection used by every corrected consumer; do not manufacture a
  // tournament-wide rank from those rows.
  let allRows: StandingRow[] = [];
  let standings: StandingRow[];
  if (isQuads && input.quadSections && input.quadSections.length > 0) {
    const games = input.rounds.flatMap((round) => round.games);
    for (const section of input.quadSections) {
      const sectionPlayers = input.players.filter(p => section.playerIds.includes(p.id));
      const playerById = new Map(sectionPlayers.map((player) => [player.id, player]));
      const sectionRows = projectQuadSectionStandings(
        section,
        games,
        sectionPlayers,
        input.quadSettings?.tiebreakOrder,
      ).flatMap((row) => {
        const player = playerById.get(row.playerId);
        if (!player) return [];
        return [{
          playerId: row.playerId,
          name: player.name,
          username: player.username,
          elo: player.elo,
          title: player.title,
          avatarUrl: player.avatarUrl,
          rank: row.finalRank,
          points: row.score,
          buchholz: 0,
          sonnebornBerger: row.sonnebornBerger,
          wins: row.wins,
          draws: row.draws,
          losses: row.losses,
        }];
      });
      allRows.push(...sectionRows);
    }
    // For Quads: do NOT assign global ranks — sections are independent competitions.
    // The top-level standings array is intentionally empty for Quads; consumers must
    // use quadSections[].standings for section-scoped rankings.
    standings = [];
  } else {
    standings = computeStandingsServer(input.players, input.rounds, { format: input.format });
  }

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
    standings,
    ...(input.quadSections && input.quadSections.length > 0 ? {
      quadSections: (() => {
        // Build a per-section standings lookup from the already-computed allRows
        // (or recompute if not Quads). This ensures each section has its own
        // section-scoped standings array for the public snapshot.
          if (isQuads) {
          // Use allRows (computed per-section above) to populate per-section standings
          // standings[] is intentionally empty for Quads; allRows has the correct data
          return input.quadSections!.map(s => {
            const sectionSet = new Set(s.playerIds);
            const ranked = allRows.filter(r => sectionSet.has(r.playerId));
            return {
              id: s.id,
              name: s.name,
              type: (s.type ?? "quad") as "quad" | "bottom_swiss",
              playerIds: s.playerIds,
              standings: ranked,
            };
          });
        }
        return input.quadSections!.map(s => ({
          id: s.id,
          name: s.name,
          type: (s.type ?? "quad") as "quad" | "bottom_swiss",
          playerIds: s.playerIds,
          standings: [],
        }));
      })(),
    } : {}),
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
