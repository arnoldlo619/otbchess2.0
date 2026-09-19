/**
 * Canonical read-only Quads standings projection.
 *
 * This module intentionally does not generate pairings or mutate tournament data.
 * It is consumed by the director, server snapshots, results, reports, print, and
 * exports so every Quads surface applies the same section-local tiebreak order.
 */

export const DEFAULT_QUAD_TIEBREAK_ORDER = [
  "score",
  "direct",
  "sonnebornBerger",
  "wins",
  "blackGames",
  "rating",
] as const;

export interface QuadProjectionSection {
  id: string;
  playerIds: string[];
}

export interface QuadProjectionPlayer {
  id: string;
  elo?: number;
}

export interface QuadProjectionGame {
  whiteId: string;
  blackId: string;
  result: string;
  sectionId?: string;
}

export interface QuadProjectionRow {
  playerId: string;
  sectionId: string;
  score: number;
  wins: number;
  draws: number;
  losses: number;
  blackGames: number;
  sonnebornBerger: number;
  directEncounterScore: number;
  finalRank: number;
}

function directEncounterScore(playerId: string, tiedPlayerIds: string[], games: QuadProjectionGame[]): number {
  let score = 0;

  for (const game of games) {
    if (game.blackId === "BYE" || game.result === "*") continue;
    const isWhite = game.whiteId === playerId;
    const isBlack = game.blackId === playerId;
    if (!isWhite && !isBlack) continue;

    const opponentId = isWhite ? game.blackId : game.whiteId;
    if (!tiedPlayerIds.includes(opponentId)) continue;

    if (isWhite) {
      if (game.result === "1-0") score += 1;
      else if (game.result === "½-½") score += 0.5;
    } else {
      if (game.result === "0-1") score += 1;
      else if (game.result === "½-½") score += 0.5;
    }
  }

  return score;
}

function calculateSonnebornBerger(
  playerId: string,
  games: QuadProjectionGame[],
  standings: Record<string, QuadProjectionRow>,
): number {
  let score = 0;

  for (const game of games) {
    if (game.blackId === "BYE") continue;
    const isWhite = game.whiteId === playerId;
    const isBlack = game.blackId === playerId;
    if (!isWhite && !isBlack) continue;

    const opponentId = isWhite ? game.blackId : game.whiteId;
    const opponentScore = standings[opponentId]?.score ?? 0;
    if (isWhite) {
      if (game.result === "1-0") score += opponentScore;
      else if (game.result === "½-½") score += opponentScore * 0.5;
    } else {
      if (game.result === "0-1") score += opponentScore;
      else if (game.result === "½-½") score += opponentScore * 0.5;
    }
  }

  return Math.round(score * 100) / 100;
}

/**
 * Projects a single Quads or Bottom Swiss section without changing source state.
 * `tiebreakOrder` defaults to the established Quads order for legacy events that
 * predate persisted Quads settings.
 */
export function projectQuadSectionStandings(
  section: QuadProjectionSection,
  games: QuadProjectionGame[],
  players: QuadProjectionPlayer[],
  tiebreakOrder: readonly string[] = DEFAULT_QUAD_TIEBREAK_ORDER,
): QuadProjectionRow[] {
  const sectionPlayerIds = new Set(section.playerIds);
  // Early Quads state did not persist sectionId on every game. Reconstruct only
  // when both real players belong to this section; never infer across sections.
  const belongsToSection = (game: QuadProjectionGame) => game.sectionId === section.id
    || (!game.sectionId
      && sectionPlayerIds.has(game.whiteId)
      && (game.blackId === "BYE" || sectionPlayerIds.has(game.blackId)));
  const sectionGames = games.filter(
    (game) => belongsToSection(game) && game.result !== "*" && game.blackId !== "BYE",
  );
  const byeGames = games.filter(
    (game) => belongsToSection(game) && game.blackId === "BYE" && game.result !== "*",
  );

  const rows: Record<string, QuadProjectionRow> = {};
  const halfPoints: Record<string, number> = {};
  for (const playerId of section.playerIds) {
    rows[playerId] = {
      playerId,
      sectionId: section.id,
      score: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      blackGames: 0,
      sonnebornBerger: 0,
      directEncounterScore: 0,
      finalRank: 0,
    };
    halfPoints[playerId] = 0;
  }

  for (const game of sectionGames) {
    const white = rows[game.whiteId];
    const black = rows[game.blackId];
    if (!white || !black) continue;

    black.blackGames += 1;
    if (game.result === "1-0") {
      halfPoints[game.whiteId] += 2;
      white.wins += 1;
      black.losses += 1;
    } else if (game.result === "0-1") {
      halfPoints[game.blackId] += 2;
      black.wins += 1;
      white.losses += 1;
    } else if (game.result === "½-½") {
      halfPoints[game.whiteId] += 1;
      halfPoints[game.blackId] += 1;
      white.draws += 1;
      black.draws += 1;
    }
  }

  for (const playerId of section.playerIds) {
    rows[playerId].score = halfPoints[playerId] / 2;
  }

  for (const game of byeGames) {
    const player = rows[game.whiteId];
    if (player) {
      player.score += 1;
      player.wins += 1;
    }
  }

  for (const playerId of section.playerIds) {
    rows[playerId].sonnebornBerger = calculateSonnebornBerger(playerId, sectionGames, rows);
  }

  const playerRatings = new Map(players.map((player) => [player.id, player.elo ?? 0]));
  const standings = Object.values(rows);
  standings.sort((a, b) => {
    for (const tiebreak of tiebreakOrder) {
      switch (tiebreak) {
        case "score":
          if (b.score !== a.score) return b.score - a.score;
          break;
        case "direct": {
          if (a.score !== b.score) break;
          const tiedIds = standings.filter((row) => row.score === a.score).map((row) => row.playerId);
          if (tiedIds.length >= 2) {
            const aDirect = directEncounterScore(a.playerId, tiedIds, sectionGames);
            const bDirect = directEncounterScore(b.playerId, tiedIds, sectionGames);
            if (bDirect !== aDirect) return bDirect - aDirect;
          }
          break;
        }
        case "sonnebornBerger":
          if (b.sonnebornBerger !== a.sonnebornBerger) return b.sonnebornBerger - a.sonnebornBerger;
          break;
        case "wins":
          if (b.wins !== a.wins) return b.wins - a.wins;
          break;
        case "blackGames":
          if (b.blackGames !== a.blackGames) return b.blackGames - a.blackGames;
          break;
        case "rating": {
          const ratingDifference = (playerRatings.get(b.playerId) ?? 0) - (playerRatings.get(a.playerId) ?? 0);
          if (ratingDifference !== 0) return ratingDifference;
          break;
        }
      }
    }
    return a.playerId.localeCompare(b.playerId);
  });

  standings.forEach((row, index) => {
    row.finalRank = index + 1;
    const tiedIds = standings.filter((candidate) => candidate.score === row.score).map((candidate) => candidate.playerId);
    row.directEncounterScore = directEncounterScore(row.playerId, tiedIds, sectionGames);
  });

  return standings;
}
