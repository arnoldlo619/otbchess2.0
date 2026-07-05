/**
 * OTB Chess — Quads Tournament Engine
 *
 * Implements the full Quads tournament mode:
 *   - Sort players by rating into 4-player sections (quads)
 *   - Generate round-robin pairings within each quad (3 rounds)
 *   - Handle non-multiples-of-4 via Bottom Swiss fallback
 *   - Calculate section-based standings with tiebreaks
 *   - Validate tournament integrity
 *
 * Pairing table for a 4-player quad (seeds 1-4 by rating):
 *   Round 1: Seed 1 vs Seed 4, Seed 2 vs Seed 3
 *   Round 2: Seed 3 vs Seed 1, Seed 4 vs Seed 2
 *   Round 3: Seed 1 vs Seed 2, Seed 3 vs Seed 4
 *
 * Deterministic color assignment (default):
 *   First-listed player = White → Seeds 1 & 3 get 2 White, Seeds 2 & 4 get 2 Black
 */

import type { Player, Game, Result } from "./tournamentData";
import { resolvePairingRating } from "./swiss";

// ─── Types ────────────────────────────────────────────────────────────────────

export type QuadRatingSource = "otb" | "rapid" | "blitz" | "manual" | "best_available";
export type RemainderHandling = "bottom_swiss" | "expand_last_quad";
export type ColorAssignment = "deterministic" | "random" | "balanced";

export interface QuadSection {
  id: string;
  name: string;
  type: "quad" | "bottom_swiss";
  orderIndex: number;
  ratingMin: number;
  ratingMax: number;
  playerIds: string[];
  /** Maps playerId → local seed (1-4 for quads) */
  localSeeds: Record<string, number>;
  status: "pending" | "in_progress" | "completed";
}

export interface QuadStanding {
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
  /** Performance rating (optional) */
  performanceRating?: number;
}

export interface QuadSettings {
  ratingSource: QuadRatingSource;
  remainderHandling: RemainderHandling;
  colorAssignment: ColorAssignment;
  tiebreakOrder: string[];
  /** Rating type for chess.com fallback (rapid or blitz) */
  ratingType?: "rapid" | "blitz";
}

export interface QuadGenerationResult {
  sections: QuadSection[];
  /** All generated games across all sections and rounds */
  games: Game[];
  /** Total number of rounds (always 3 for quads) */
  rounds: number;
}

export interface QuadValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Fixed pairing table for a 4-player quad round robin.
 *  Each entry: [whiteSeed, blackSeed] (deterministic color) */
const QUAD_PAIRING_TABLE: [number, number][][] = [
  // Round 1
  [[1, 4], [2, 3]],
  // Round 2
  [[3, 1], [4, 2]],
  // Round 3
  [[1, 2], [3, 4]],
];

export const DEFAULT_TIEBREAK_ORDER = [
  "score",
  "direct",
  "sonnebornBerger",
  "wins",
  "blackGames",
  "rating",
];

export const DEFAULT_QUAD_SETTINGS: QuadSettings = {
  ratingSource: "best_available",
  remainderHandling: "bottom_swiss",
  colorAssignment: "deterministic",
  tiebreakOrder: DEFAULT_TIEBREAK_ORDER,
  ratingType: "rapid",
};

// ─── Rating Resolution ────────────────────────────────────────────────────────

/**
 * Resolve the effective rating for quad sorting based on the configured source.
 */
export function resolveQuadRating(
  player: Player,
  source: QuadRatingSource,
  ratingType: "rapid" | "blitz" = "rapid"
): number {
  switch (source) {
    case "rapid":
      return player.rapidElo && player.rapidElo > 0 ? player.rapidElo : 0;
    case "blitz":
      return player.blitzElo && player.blitzElo > 0 ? player.blitzElo : 0;
    case "manual":
      return player.manualPairingRating && player.manualPairingRating > 0
        ? player.manualPairingRating
        : 0;
    case "otb":
      // OTB rating = pairingRating if set, else elo
      return player.pairingRating && player.pairingRating > 0
        ? player.pairingRating
        : player.elo && player.elo > 0 && player.elo !== 1200
        ? player.elo
        : 0;
    case "best_available":
    default: {
      // Use the swiss engine's resolution which has the full fallback chain
      const { pairingRating } = resolvePairingRating(player, ratingType);
      return pairingRating;
    }
  }
}

// ─── Player Sorting ───────────────────────────────────────────────────────────

/**
 * Sort players for quad assignment: highest rating first.
 * Tiebreakers: rating confidence → registration timestamp → random seed.
 */
export function sortPlayersForQuads(
  players: Player[],
  settings: QuadSettings
): Player[] {
  const { ratingSource, ratingType = "rapid" } = settings;

  return [...players].sort((a, b) => {
    const ratingA = resolveQuadRating(a, ratingSource, ratingType);
    const ratingB = resolveQuadRating(b, ratingSource, ratingType);

    // Primary: rating descending
    if (ratingB !== ratingA) return ratingB - ratingA;

    // Secondary: prefer players with verified chess.com username
    const hasUsernameA = a.username && a.username.length > 0 ? 1 : 0;
    const hasUsernameB = b.username && b.username.length > 0 ? 1 : 0;
    if (hasUsernameB !== hasUsernameA) return hasUsernameB - hasUsernameA;

    // Tertiary: registration timestamp (earlier = higher priority)
    const joinA = a.joinedAt ?? Infinity;
    const joinB = b.joinedAt ?? Infinity;
    if (joinA !== joinB) return joinA - joinB;

    // Final: deterministic by player ID
    return a.id.localeCompare(b.id);
  });
}

// ─── Section Generation ───────────────────────────────────────────────────────

/**
 * Generate quad sections from sorted players.
 * Handles remainder players according to the configured strategy.
 */
export function generateQuadSections(
  players: Player[],
  settings: QuadSettings
): QuadSection[] {
  const sorted = sortPlayersForQuads(players, settings);
  const n = sorted.length;
  const { ratingSource, ratingType = "rapid" } = settings;

  // Special cases: fewer than 4 players
  if (n < 4) {
    return [createSection(sorted, 0, "bottom_swiss", `Mini Section`, settings)];
  }

  // Special cases: 5-7 players → single mini-Swiss section
  if (n >= 5 && n <= 7) {
    return [createSection(sorted, 0, "bottom_swiss", `Section 1`, settings)];
  }

  const remainder = n % 4;
  const sections: QuadSection[] = [];

  if (remainder === 0) {
    // Perfect division — all full quads
    for (let i = 0; i < n; i += 4) {
      const quadPlayers = sorted.slice(i, i + 4);
      const quadIndex = Math.floor(i / 4);
      sections.push(
        createSection(quadPlayers, quadIndex, "quad", `Quad ${quadIndex + 1}`, settings)
      );
    }
  } else {
    // Create full quads for the top players, then handle remainder
    const fullQuadCount = Math.floor(n / 4) - 1; // Reserve last quad for borrowing
    const borrowCount = 4 - remainder; // How many to borrow from last full quad

    // Full quads (all except the last one which gets borrowed from)
    for (let i = 0; i < fullQuadCount * 4; i += 4) {
      const quadPlayers = sorted.slice(i, i + 4);
      const quadIndex = Math.floor(i / 4);
      sections.push(
        createSection(quadPlayers, quadIndex, "quad", `Quad ${quadIndex + 1}`, settings)
      );
    }

    // Bottom Swiss section: last quad's players + remainder
    const bottomStart = fullQuadCount * 4;
    const bottomPlayers = sorted.slice(bottomStart);
    sections.push(
      createSection(
        bottomPlayers,
        fullQuadCount,
        "bottom_swiss",
        `Bottom Swiss`,
        settings
      )
    );
  }

  return sections;
}

function createSection(
  players: Player[],
  orderIndex: number,
  type: "quad" | "bottom_swiss",
  name: string,
  settings: QuadSettings
): QuadSection {
  const { ratingSource, ratingType = "rapid" } = settings;
  const ratings = players.map((p) => resolveQuadRating(p, ratingSource, ratingType));
  const localSeeds: Record<string, number> = {};
  players.forEach((p, i) => {
    localSeeds[p.id] = i + 1;
  });

  return {
    id: `section-${orderIndex + 1}`,
    name,
    type,
    orderIndex,
    ratingMin: Math.min(...ratings),
    ratingMax: Math.max(...ratings),
    playerIds: players.map((p) => p.id),
    localSeeds,
    status: "pending",
  };
}

// ─── Pairing Generation ───────────────────────────────────────────────────────

/**
 * Generate all pairings for a full quad section (exactly 6 games across 3 rounds).
 */
export function generateQuadPairings(
  section: QuadSection,
  colorMode: ColorAssignment = "deterministic",
  boardOffset: number = 0
): Game[] {
  if (section.type !== "quad" || section.playerIds.length !== 4) {
    return [];
  }

  const games: Game[] = [];
  const seedToId: Record<number, string> = {};

  // Build seed → playerId map
  for (const [playerId, seed] of Object.entries(section.localSeeds)) {
    seedToId[seed] = playerId;
  }

  let gameCounter = 0;

  for (let round = 0; round < 3; round++) {
    const roundPairings = QUAD_PAIRING_TABLE[round];

    for (let board = 0; board < roundPairings.length; board++) {
      const [whiteSeed, blackSeed] = roundPairings[board];
      let whiteId = seedToId[whiteSeed];
      let blackId = seedToId[blackSeed];

      // Apply color assignment mode
      if (colorMode === "random") {
        if (Math.random() < 0.5) {
          [whiteId, blackId] = [blackId, whiteId];
        }
      }
      // "balanced" and "deterministic" use the table as-is for v1

      games.push({
        id: `${section.id}-r${round + 1}-b${board + 1}`,
        round: round + 1,
        board: boardOffset + board + 1,
        whiteId,
        blackId,
        result: "*" as Result,
        sectionId: section.id,
      });
      gameCounter++;
    }

    // Update board offset for next round
    boardOffset += roundPairings.length;
  }

  return games;
}

/**
 * Generate pairings for a Bottom Swiss section using simple Swiss logic.
 * 3 rounds, score-based pairing, bye for odd player count.
 */
export function generateBottomSwissPairings(
  section: QuadSection,
  players: Player[],
  boardOffset: number = 0
): Game[] {
  if (section.type !== "bottom_swiss") return [];

  const games: Game[] = [];
  const sectionPlayers = players.filter((p) => section.playerIds.includes(p.id));
  const n = sectionPlayers.length;

  // Simple round-robin for 3 rounds if n <= 7
  // For the first round: pair top vs bottom (Swiss R1 style)
  const scores: Record<string, number> = {};
  const opponents: Record<string, Set<string>> = {};
  const byeHistory: Set<string> = new Set();

  sectionPlayers.forEach((p) => {
    scores[p.id] = 0;
    opponents[p.id] = new Set();
  });

  for (let round = 1; round <= 3; round++) {
    const roundGames = generateSwissRound(
      sectionPlayers,
      scores,
      opponents,
      byeHistory,
      round,
      section.id,
      boardOffset
    );

    // Apply results placeholder
    for (const game of roundGames) {
      games.push(game);
      if (game.whiteId !== "BYE" && game.blackId !== "BYE") {
        opponents[game.whiteId].add(game.blackId);
        opponents[game.blackId].add(game.whiteId);
      }
    }

    boardOffset += roundGames.length;
  }

  return games;
}

/**
 * Simple Swiss pairing for one round within a Bottom Swiss section.
 */
function generateSwissRound(
  players: Player[],
  scores: Record<string, number>,
  opponents: Record<string, Set<string>>,
  byeHistory: Set<string>,
  roundNumber: number,
  sectionId: string,
  boardOffset: number
): Game[] {
  const games: Game[] = [];
  const n = players.length;
  const isOdd = n % 2 === 1;

  // Sort by score desc, then rating desc
  const sorted = [...players].sort((a, b) => {
    const scoreDiff = (scores[b.id] ?? 0) - (scores[a.id] ?? 0);
    if (scoreDiff !== 0) return scoreDiff;
    return (b.elo ?? 0) - (a.elo ?? 0);
  });

  const paired = new Set<string>();

  // Handle bye first if odd
  if (isOdd) {
    // Find lowest-scored player who hasn't had a bye
    for (let i = sorted.length - 1; i >= 0; i--) {
      if (!byeHistory.has(sorted[i].id)) {
        const byePlayer = sorted[i];
        byeHistory.add(byePlayer.id);
        paired.add(byePlayer.id);
        scores[byePlayer.id] = (scores[byePlayer.id] ?? 0) + 1;
        games.push({
          id: `${sectionId}-r${roundNumber}-bye`,
          round: roundNumber,
          board: 0,
          whiteId: byePlayer.id,
          blackId: "BYE",
          result: "1-0" as Result,
          sectionId,
        });
        break;
      }
    }
    // If everyone has had a bye, give it to the lowest scorer
    if (games.length === 0 && isOdd) {
      const byePlayer = sorted[sorted.length - 1];
      byeHistory.add(byePlayer.id);
      paired.add(byePlayer.id);
      scores[byePlayer.id] = (scores[byePlayer.id] ?? 0) + 1;
      games.push({
        id: `${sectionId}-r${roundNumber}-bye`,
        round: roundNumber,
        board: 0,
        whiteId: byePlayer.id,
        blackId: "BYE",
        result: "1-0" as Result,
        sectionId,
      });
    }
  }

  // Pair remaining players
  const unpaired = sorted.filter((p) => !paired.has(p.id));
  let boardNum = boardOffset + 1;

  for (let i = 0; i < unpaired.length; i++) {
    if (paired.has(unpaired[i].id)) continue;

    const player = unpaired[i];
    // Find best opponent: closest in score, not already paired, not previous opponent
    let bestOpponent: Player | null = null;

    for (let j = i + 1; j < unpaired.length; j++) {
      if (paired.has(unpaired[j].id)) continue;
      if (!opponents[player.id]?.has(unpaired[j].id)) {
        bestOpponent = unpaired[j];
        break;
      }
    }

    // Fallback: allow repeat if no valid opponent found
    if (!bestOpponent) {
      for (let j = i + 1; j < unpaired.length; j++) {
        if (!paired.has(unpaired[j].id)) {
          bestOpponent = unpaired[j];
          break;
        }
      }
    }

    if (bestOpponent) {
      paired.add(player.id);
      paired.add(bestOpponent.id);

      // Simple color assignment: higher seed = white in odd rounds, black in even
      const whiteId = roundNumber % 2 === 1 ? player.id : bestOpponent.id;
      const blackId = roundNumber % 2 === 1 ? bestOpponent.id : player.id;

      games.push({
        id: `${sectionId}-r${roundNumber}-b${boardNum}`,
        round: roundNumber,
        board: boardNum,
        whiteId,
        blackId,
        result: "*" as Result,
        sectionId,
      });
      boardNum++;
    }
  }

  return games;
}

// ─── Standings Calculation ────────────────────────────────────────────────────

/**
 * Calculate standings for a quad section based on completed games.
 */
export function calculateQuadStandings(
  section: QuadSection,
  games: Game[],
  players: Player[],
  tiebreakOrder: string[] = DEFAULT_TIEBREAK_ORDER
): QuadStanding[] {
  const sectionGames = games.filter(
    (g) => g.sectionId === section.id && g.result !== "*" && g.blackId !== "BYE"
  );
  const byeGames = games.filter(
    (g) => g.sectionId === section.id && g.blackId === "BYE" && g.result !== "*"
  );

  const standings: Record<string, QuadStanding> = {};

  // Initialize standings for all players in section
  for (const playerId of section.playerIds) {
    standings[playerId] = {
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
  }

  // Process completed games
  for (const game of sectionGames) {
    const white = standings[game.whiteId];
    const black = standings[game.blackId];
    if (!white || !black) continue;

    black.blackGames++;

    if (game.result === "1-0") {
      white.score += 1;
      white.wins++;
      black.losses++;
    } else if (game.result === "0-1") {
      black.score += 1;
      black.wins++;
      white.losses++;
    } else if (game.result === "½-½") {
      white.score += 0.5;
      white.draws++;
      black.score += 0.5;
      black.draws++;
    }
  }

  // Process bye games (Bottom Swiss only)
  for (const game of byeGames) {
    const player = standings[game.whiteId];
    if (player) {
      player.score += 1;
      player.wins++;
    }
  }

  // Calculate Sonneborn-Berger
  for (const playerId of section.playerIds) {
    standings[playerId].sonnebornBerger = calculateSonnebornBerger(
      playerId,
      sectionGames,
      standings
    );
  }

  // Calculate direct encounter scores (for tiebreaks among tied players)
  // This is computed during ranking below

  // Sort and assign ranks
  const standingsArr = Object.values(standings);
  rankStandings(standingsArr, sectionGames, standings, players, tiebreakOrder);

  return standingsArr;
}

/**
 * Sonneborn-Berger: sum of opponents' scores weighted by result.
 * Win vs opponent → add opponent's full score
 * Draw vs opponent → add half opponent's score
 * Loss vs opponent → add nothing
 */
export function calculateSonnebornBerger(
  playerId: string,
  games: Game[],
  standings: Record<string, QuadStanding>
): number {
  let sbr = 0;

  for (const game of games) {
    if (game.blackId === "BYE") continue;
    let opponentId: string | null = null;
    let result: "win" | "draw" | "loss" | null = null;

    if (game.whiteId === playerId) {
      opponentId = game.blackId;
      if (game.result === "1-0") result = "win";
      else if (game.result === "½-½") result = "draw";
      else if (game.result === "0-1") result = "loss";
    } else if (game.blackId === playerId) {
      opponentId = game.whiteId;
      if (game.result === "0-1") result = "win";
      else if (game.result === "½-½") result = "draw";
      else if (game.result === "1-0") result = "loss";
    }

    if (opponentId && result && standings[opponentId]) {
      const oppScore = standings[opponentId].score;
      if (result === "win") sbr += oppScore;
      else if (result === "draw") sbr += oppScore * 0.5;
    }
  }

  return Math.round(sbr * 100) / 100; // Avoid floating point noise
}

/**
 * Calculate direct encounter score between tied players.
 */
export function calculateDirectEncounter(
  playerId: string,
  tiedPlayerIds: string[],
  games: Game[]
): number {
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

/**
 * Rank standings using the configured tiebreak order.
 */
function rankStandings(
  standings: QuadStanding[],
  games: Game[],
  standingsMap: Record<string, QuadStanding>,
  players: Player[],
  tiebreakOrder: string[]
): void {
  const playerMap = new Map(players.map((p) => [p.id, p]));

  standings.sort((a, b) => {
    for (const tb of tiebreakOrder) {
      switch (tb) {
        case "score":
          if (b.score !== a.score) return b.score - a.score;
          break;
        case "direct": {
          const tiedIds = standings
            .filter((s) => s.score === a.score)
            .map((s) => s.playerId);
          if (tiedIds.length > 1) {
            const deA = calculateDirectEncounter(a.playerId, tiedIds, games);
            const deB = calculateDirectEncounter(b.playerId, tiedIds, games);
            if (deB !== deA) return deB - deA;
          }
          break;
        }
        case "sonnebornBerger":
          if (b.sonnebornBerger !== a.sonnebornBerger)
            return b.sonnebornBerger - a.sonnebornBerger;
          break;
        case "wins":
          if (b.wins !== a.wins) return b.wins - a.wins;
          break;
        case "blackGames":
          if (b.blackGames !== a.blackGames) return b.blackGames - a.blackGames;
          break;
        case "rating": {
          const rA = playerMap.get(a.playerId)?.elo ?? 0;
          const rB = playerMap.get(b.playerId)?.elo ?? 0;
          if (rB !== rA) return rB - rA;
          break;
        }
      }
    }
    return 0;
  });

  // Assign final ranks
  standings.forEach((s, i) => {
    s.finalRank = i + 1;
  });
}

// ─── Full Tournament Generation ───────────────────────────────────────────────

/**
 * Generate the complete quads tournament: sections + all pairings.
 * This is the main entry point called by the director when publishing pairings.
 */
export function generateQuadTournament(
  players: Player[],
  settings: QuadSettings = DEFAULT_QUAD_SETTINGS
): QuadGenerationResult {
  const sections = generateQuadSections(players, settings);
  const allGames: Game[] = [];
  let boardOffset = 0;

  for (const section of sections) {
    if (section.type === "quad") {
      const games = generateQuadPairings(section, settings.colorAssignment, boardOffset);
      allGames.push(...games);
      // Each quad has 2 boards per round × 3 rounds = 6 games
      boardOffset += 2; // boards per round for continuous numbering
    } else {
      const games = generateBottomSwissPairings(section, players, boardOffset);
      allGames.push(...games);
      const boardsPerRound = Math.floor(section.playerIds.length / 2);
      boardOffset += boardsPerRound;
    }
  }

  // Reassign board numbers continuously across all sections per round
  reassignBoardNumbers(allGames, sections);

  return {
    sections,
    games: allGames,
    rounds: 3,
  };
}

/**
 * Reassign board numbers continuously across all sections within each round.
 * Board 1 = Quad 1 Match 1, Board 2 = Quad 1 Match 2, Board 3 = Quad 2 Match 1, etc.
 */
function reassignBoardNumbers(games: Game[], sections: QuadSection[]): void {
  for (let round = 1; round <= 3; round++) {
    let boardNum = 1;
    for (const section of sections) {
      const roundGames = games.filter(
        (g) => g.sectionId === section.id && g.round === round && g.blackId !== "BYE"
      );
      // Sort by original board number to maintain order within section
      roundGames.sort((a, b) => a.board - b.board);
      for (const game of roundGames) {
        game.board = boardNum++;
      }
    }
  }
}

// ─── Validation ───────────────────────────────────────────────────────────────

/**
 * Validate the integrity of a quads tournament.
 */
export function validateQuadIntegrity(
  sections: QuadSection[],
  games: Game[]
): QuadValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const section of sections) {
    if (section.type === "quad") {
      // Must have exactly 4 players
      if (section.playerIds.length !== 4) {
        errors.push(`${section.name}: has ${section.playerIds.length} players, expected 4`);
      }

      // Must have exactly 6 games (3 rounds × 2 boards)
      const sectionGames = games.filter(
        (g) => g.sectionId === section.id && g.blackId !== "BYE"
      );
      if (sectionGames.length !== 6) {
        errors.push(
          `${section.name}: has ${sectionGames.length} games, expected 6`
        );
      }

      // Each player must have exactly 3 games
      for (const playerId of section.playerIds) {
        const playerGames = sectionGames.filter(
          (g) => g.whiteId === playerId || g.blackId === playerId
        );
        if (playerGames.length !== 3) {
          errors.push(
            `${section.name}: player ${playerId} has ${playerGames.length} games, expected 3`
          );
        }
      }

      // No duplicate opponents
      for (const playerId of section.playerIds) {
        const opponentCounts = new Map<string, number>();
        for (const game of sectionGames) {
          if (game.whiteId === playerId) {
            opponentCounts.set(
              game.blackId,
              (opponentCounts.get(game.blackId) ?? 0) + 1
            );
          } else if (game.blackId === playerId) {
            opponentCounts.set(
              game.whiteId,
              (opponentCounts.get(game.whiteId) ?? 0) + 1
            );
          }
        }
        for (const [oppId, count] of Array.from(opponentCounts.entries())) {
          if (count > 1) {
            errors.push(
              `${section.name}: player ${playerId} plays ${oppId} ${count} times`
            );
          }
        }
      }

      // Every pair plays exactly once
      const pairs = new Set<string>();
      for (const game of sectionGames) {
        const pair = [game.whiteId, game.blackId].sort().join("-");
        if (pairs.has(pair)) {
          errors.push(`${section.name}: duplicate pairing ${pair}`);
        }
        pairs.add(pair);
      }
      // Should have C(4,2) = 6 unique pairs
      if (pairs.size !== 6) {
        errors.push(
          `${section.name}: has ${pairs.size} unique pairings, expected 6`
        );
      }
    }

    // Board numbers unique within each round
    for (let round = 1; round <= 3; round++) {
      const roundGames = games.filter(
        (g) => g.round === round && g.blackId !== "BYE"
      );
      const boards = roundGames.map((g) => g.board);
      const uniqueBoards = new Set(boards);
      if (boards.length !== uniqueBoards.size) {
        errors.push(`Round ${round}: duplicate board numbers detected`);
      }
    }
  }

  // Check no game is missing white/black player (except BYE)
  for (const game of games) {
    if (!game.whiteId) {
      errors.push(`Game ${game.id}: missing white player`);
    }
    if (!game.blackId) {
      errors.push(`Game ${game.id}: missing black player`);
    }
  }

  if (errors.length === 0 && sections.length === 0) {
    warnings.push("No sections generated");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ─── Utility Exports ──────────────────────────────────────────────────────────

/** Get the winner(s) of a section (rank 1). */
export function getSectionWinners(standings: QuadStanding[]): QuadStanding[] {
  return standings.filter((s) => s.finalRank === 1);
}

/** Format a section's rating range for display. */
export function formatRatingRange(section: QuadSection): string {
  if (section.ratingMin === section.ratingMax) return `${section.ratingMin}`;
  return `${section.ratingMin}–${section.ratingMax}`;
}

/** Get the pairing table constant for external use (e.g., UI display). */
export function getQuadPairingTable(): [number, number][][] {
  return QUAD_PAIRING_TABLE;
}
