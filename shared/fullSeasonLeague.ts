/**
 * ChessOTB Full Season League rules.
 *
 * The regular season is built from a circle-method 1-factorization. At the
 * start of each week we select the next 1–3 unused factors by competitive
 * distance. This retains a mathematically complete season while still making
 * the order of weekly opponents responsive to current performance.
 */

export const FULL_SEASON_FORMAT = "full_season" as const;
export const CLASSIC_ROUND_ROBIN_FORMAT = "round_robin" as const;
export const FULL_SEASON_MAX_OPPONENTS_PER_WEEK = 3;
export const FULL_SEASON_GAMES_PER_ENCOUNTER = 2;
export const DEFAULT_LEAGUE_RATING = 1200;
export const DEFAULT_LEAGUE_K_FACTOR = 32;

export type FullSeasonStructure = {
  rosterSize: number;
  regularSeasonWeeks: number;
  opponentRounds: number;
  opponentsPerStandardWeek: number;
  gamesPerEncounter: number;
  gamesPerPlayer: number;
  totalEncounters: number;
  totalGames: number;
  playoffQualifierCount: number;
  playoffWeek: number;
};

export type SeasonPlayerSeed = {
  playerId: string;
  originalSeed: number;
  leagueRating: number;
  seasonPoints?: number;
  gamePoints?: number;
  rank?: number;
};

export type EncounterPair = {
  playerAId: string;
  playerBId: string;
};

export type FullSeasonRound = {
  roundNumber: number;
  pairs: EncounterPair[];
};

export type EncounterResult = {
  playerAId: string;
  playerBId: string;
  playerAGamePoints: number;
  playerBGamePoints: number;
  weekNumber: number;
  completed: boolean;
};

export type FullSeasonStanding = {
  playerId: string;
  originalSeed: number;
  rank: number;
  seasonPoints: number;
  gamePoints: number;
  encounterWins: number;
  encounterDraws: number;
  encounterLosses: number;
  individualWins: number;
  individualDraws: number;
  individualLosses: number;
  encountersPlayed: number;
  gamesPlayed: number;
  sonnebornBerger: number;
  leagueRating: number;
  lastResults: string[];
};

export type LeagueRatingDelta = {
  playerADelta: number;
  playerBDelta: number;
  playerANextRating: number;
  playerBNextRating: number;
};

export function isFullSeasonFormat(formatType?: string | null): boolean {
  return formatType === FULL_SEASON_FORMAT;
}

export function getFullSeasonStructure(rosterSize: number): FullSeasonStructure {
  if (!Number.isInteger(rosterSize) || rosterSize < 4 || rosterSize > 28 || rosterSize % 2 !== 0) {
    throw new Error("Full Season League requires an even roster from 4 to 28 players.");
  }

  const opponentRounds = rosterSize - 1;
  const regularSeasonWeeks = Math.ceil(opponentRounds / FULL_SEASON_MAX_OPPONENTS_PER_WEEK);
  return {
    rosterSize,
    regularSeasonWeeks,
    opponentRounds,
    opponentsPerStandardWeek: FULL_SEASON_MAX_OPPONENTS_PER_WEEK,
    gamesPerEncounter: FULL_SEASON_GAMES_PER_ENCOUNTER,
    gamesPerPlayer: FULL_SEASON_GAMES_PER_ENCOUNTER * opponentRounds,
    totalEncounters: (rosterSize * opponentRounds) / 2,
    totalGames: rosterSize * opponentRounds,
    playoffQualifierCount: getPlayoffQualifierCount(rosterSize),
    playoffWeek: regularSeasonWeeks + 1,
  };
}

export function getPlayoffQualifierCount(rosterSize: number): number {
  if (rosterSize >= 26) return 12;
  if (rosterSize >= 22) return 10;
  if (rosterSize >= 16) return 8;
  if (rosterSize >= 12) return 6;
  return Math.min(4, rosterSize);
}

/** Stable key used for unordered regular-season opponent pairs. */
export function getOpponentPairKey(playerAId: string, playerBId: string): string {
  if (playerAId === playerBId) throw new Error("A player cannot face themselves.");
  return [playerAId, playerBId].sort((a, b) => a.localeCompare(b)).join(":");
}

/**
 * A complete 1-factorization of K_n for an even roster. Every round is a
 * perfect matching and every pair occurs exactly once across all rounds.
 */
export function generateCircleFactorization(playerIds: string[]): FullSeasonRound[] {
  if (playerIds.length < 2 || playerIds.length % 2 !== 0) {
    throw new Error("Circle factorization requires an even player count of at least two.");
  }
  if (new Set(playerIds).size !== playerIds.length) {
    throw new Error("Circle factorization requires unique player IDs.");
  }

  const fixed = playerIds[0];
  let rotating = playerIds.slice(1);
  const rounds: FullSeasonRound[] = [];
  const half = playerIds.length / 2;

  for (let roundNumber = 1; roundNumber < playerIds.length; roundNumber += 1) {
    const arranged = [fixed, ...rotating];
    const pairs: EncounterPair[] = [];
    for (let index = 0; index < half; index += 1) {
      pairs.push({
        playerAId: arranged[index],
        playerBId: arranged[arranged.length - 1 - index],
      });
    }
    rounds.push({ roundNumber, pairs });
    rotating = [rotating[rotating.length - 1], ...rotating.slice(0, -1)];
  }

  return rounds;
}

export function getWeeklyOpponentCount(remainingRounds: number, remainingWeeks: number): number {
  if (remainingRounds <= 0 || remainingWeeks <= 0) return 0;
  return Math.min(
    FULL_SEASON_MAX_OPPONENTS_PER_WEEK,
    Math.ceil(remainingRounds / remainingWeeks),
  );
}

function competitiveDistance(
  playerA: SeasonPlayerSeed,
  playerB: SeasonPlayerSeed,
): number {
  const seasonPointGap = Math.abs((playerA.seasonPoints ?? 0) - (playerB.seasonPoints ?? 0));
  const ratingGap = Math.abs(playerA.leagueRating - playerB.leagueRating) / 100;
  const rankGap = Math.abs((playerA.rank ?? playerA.originalSeed) - (playerB.rank ?? playerB.originalSeed));
  const gamePointGap = Math.abs((playerA.gamePoints ?? 0) - (playerB.gamePoints ?? 0)) / 2;
  return seasonPointGap * 10 + ratingGap + rankGap * 0.5 + gamePointGap;
}

/**
 * Selects whole unused circle rounds (never arbitrary partial pairings). This
 * makes the next week adaptive while proving that every remaining opponent
 * still has a valid place in the season.
 */
export function selectAdaptiveWeeklyRounds(
  remainingRounds: FullSeasonRound[],
  players: SeasonPlayerSeed[],
  remainingWeeks: number,
): FullSeasonRound[] {
  const count = getWeeklyOpponentCount(remainingRounds.length, remainingWeeks);
  if (count === 0) return [];
  const playerMap = new Map(players.map((player) => [player.playerId, player]));

  return [...remainingRounds]
    .map((round) => ({
      round,
      score: round.pairs.reduce((total, pair) => {
        const playerA = playerMap.get(pair.playerAId);
        const playerB = playerMap.get(pair.playerBId);
        if (!playerA || !playerB) return total;
        return total + competitiveDistance(playerA, playerB);
      }, 0),
    }))
    .sort((left, right) => left.score - right.score || left.round.roundNumber - right.round.roundNumber)
    .slice(0, count)
    .map(({ round }) => round);
}

export function calculateLeagueRatingDelta(
  playerARating: number,
  playerBRating: number,
  playerAGamePoints: number,
  playerBGamePoints: number,
  kFactor = DEFAULT_LEAGUE_K_FACTOR,
): LeagueRatingDelta {
  const safeA = Number.isFinite(playerARating) ? playerARating : DEFAULT_LEAGUE_RATING;
  const safeB = Number.isFinite(playerBRating) ? playerBRating : DEFAULT_LEAGUE_RATING;
  const actualA = Math.max(0, Math.min(1, playerAGamePoints / FULL_SEASON_GAMES_PER_ENCOUNTER));
  const actualB = Math.max(0, Math.min(1, playerBGamePoints / FULL_SEASON_GAMES_PER_ENCOUNTER));
  if (Math.abs(actualA + actualB - 1) > 0.0001) {
    throw new Error("A completed encounter must have complementary game scores.");
  }
  const expectedA = 1 / (1 + 10 ** ((safeB - safeA) / 400));
  const playerADelta = Math.round(kFactor * (actualA - expectedA));
  const playerBDelta = -playerADelta;
  return {
    playerADelta,
    playerBDelta,
    playerANextRating: safeA + playerADelta,
    playerBNextRating: safeB + playerBDelta,
  };
}

export function calculateFullSeasonStandings(
  players: SeasonPlayerSeed[],
  encounters: EncounterResult[],
): FullSeasonStanding[] {
  const stats = new Map<string, FullSeasonStanding>();
  for (const player of players) {
    stats.set(player.playerId, {
      playerId: player.playerId,
      originalSeed: player.originalSeed,
      rank: 0,
      seasonPoints: 0,
      gamePoints: 0,
      encounterWins: 0,
      encounterDraws: 0,
      encounterLosses: 0,
      individualWins: 0,
      individualDraws: 0,
      individualLosses: 0,
      encountersPlayed: 0,
      gamesPlayed: 0,
      sonnebornBerger: 0,
      leagueRating: player.leagueRating,
      lastResults: [],
    });
  }

  const completed = encounters
    .filter((encounter) => encounter.completed)
    .sort((a, b) => a.weekNumber - b.weekNumber);

  for (const encounter of completed) {
    const a = stats.get(encounter.playerAId);
    const b = stats.get(encounter.playerBId);
    if (!a || !b) continue;
    a.encountersPlayed += 1;
    b.encountersPlayed += 1;
    a.gamesPlayed += FULL_SEASON_GAMES_PER_ENCOUNTER;
    b.gamesPlayed += FULL_SEASON_GAMES_PER_ENCOUNTER;
    a.gamePoints += encounter.playerAGamePoints;
    b.gamePoints += encounter.playerBGamePoints;

    const aIndividual = individualRecord(encounter.playerAGamePoints);
    const bIndividual = individualRecord(encounter.playerBGamePoints);
    a.individualWins += aIndividual.wins;
    a.individualDraws += aIndividual.draws;
    a.individualLosses += aIndividual.losses;
    b.individualWins += bIndividual.wins;
    b.individualDraws += bIndividual.draws;
    b.individualLosses += bIndividual.losses;

    if (encounter.playerAGamePoints > encounter.playerBGamePoints) {
      a.seasonPoints += 1;
      a.encounterWins += 1;
      b.encounterLosses += 1;
      a.lastResults.push("W");
      b.lastResults.push("L");
    } else if (encounter.playerAGamePoints < encounter.playerBGamePoints) {
      b.seasonPoints += 1;
      b.encounterWins += 1;
      a.encounterLosses += 1;
      a.lastResults.push("L");
      b.lastResults.push("W");
    } else {
      a.seasonPoints += 0.5;
      b.seasonPoints += 0.5;
      a.encounterDraws += 1;
      b.encounterDraws += 1;
      a.lastResults.push("D");
      b.lastResults.push("D");
    }
  }

  for (const encounter of completed) {
    const a = stats.get(encounter.playerAId);
    const b = stats.get(encounter.playerBId);
    if (!a || !b) continue;
    a.sonnebornBerger += (encounter.playerAGamePoints / 2) * b.seasonPoints;
    b.sonnebornBerger += (encounter.playerBGamePoints / 2) * a.seasonPoints;
  }

  const byPair = new Map<string, EncounterResult>();
  for (const encounter of completed) {
    byPair.set(getOpponentPairKey(encounter.playerAId, encounter.playerBId), encounter);
  }

  const sorted = Array.from(stats.values()).sort((a, b) => {
    if (b.seasonPoints !== a.seasonPoints) return b.seasonPoints - a.seasonPoints;
    if (b.gamePoints !== a.gamePoints) return b.gamePoints - a.gamePoints;
    const pair = byPair.get(getOpponentPairKey(a.playerId, b.playerId));
    if (pair && pair.playerAGamePoints !== pair.playerBGamePoints) {
      const aScore = pair.playerAId === a.playerId ? pair.playerAGamePoints : pair.playerBGamePoints;
      const bScore = pair.playerAId === b.playerId ? pair.playerAGamePoints : pair.playerBGamePoints;
      if (bScore !== aScore) return bScore - aScore;
    }
    if (b.sonnebornBerger !== a.sonnebornBerger) return b.sonnebornBerger - a.sonnebornBerger;
    if (b.encounterWins !== a.encounterWins) return b.encounterWins - a.encounterWins;
    if (b.leagueRating !== a.leagueRating) return b.leagueRating - a.leagueRating;
    return a.originalSeed - b.originalSeed;
  });

  return sorted.map((standing, index) => ({
    ...standing,
    rank: index + 1,
    lastResults: standing.lastResults.slice(-5),
  }));
}

function individualRecord(gamePoints: number): { wins: number; draws: number; losses: number } {
  // A two-game encounter has only five possible aggregate scores.
  if (gamePoints === 2) return { wins: 2, draws: 0, losses: 0 };
  if (gamePoints === 1.5) return { wins: 1, draws: 1, losses: 0 };
  if (gamePoints === 1) return { wins: 1, draws: 0, losses: 1 };
  if (gamePoints === 0.5) return { wins: 0, draws: 1, losses: 1 };
  return { wins: 0, draws: 0, losses: 2 };
}

export type PlayoffSource = { type: "seed"; seed: number } | { type: "winner"; matchKey: string };
export type PlayoffTemplateMatch = {
  key: string;
  roundNumber: number;
  roundLabel: string;
  matchNumber: number;
  playerASource: PlayoffSource;
  playerBSource: PlayoffSource;
};

export function createPlayoffTemplate(qualifierCount: number): PlayoffTemplateMatch[] {
  const seed = (value: number): PlayoffSource => ({ type: "seed", seed: value });
  const winner = (matchKey: string): PlayoffSource => ({ type: "winner", matchKey });
  const create = (
    key: string,
    roundNumber: number,
    roundLabel: string,
    matchNumber: number,
    playerASource: PlayoffSource,
    playerBSource: PlayoffSource,
  ): PlayoffTemplateMatch => ({ key, roundNumber, roundLabel, matchNumber, playerASource, playerBSource });

  if (qualifierCount === 6) {
    return [
      create("r1m1", 1, "Play-In", 1, seed(3), seed(6)),
      create("r1m2", 1, "Play-In", 2, seed(4), seed(5)),
      create("r2m1", 2, "Semifinals", 1, seed(1), winner("r1m2")),
      create("r2m2", 2, "Semifinals", 2, seed(2), winner("r1m1")),
      create("r3m1", 3, "Championship", 1, winner("r2m1"), winner("r2m2")),
    ];
  }

  if (qualifierCount === 10) {
    return [
      create("r1m1", 1, "Play-In", 1, seed(7), seed(10)),
      create("r1m2", 1, "Play-In", 2, seed(8), seed(9)),
      create("r2m1", 2, "Quarterfinals", 1, seed(1), winner("r1m2")),
      create("r2m2", 2, "Quarterfinals", 2, seed(4), seed(5)),
      create("r2m3", 2, "Quarterfinals", 3, seed(2), winner("r1m1")),
      create("r2m4", 2, "Quarterfinals", 4, seed(3), seed(6)),
      create("r3m1", 3, "Semifinals", 1, winner("r2m1"), winner("r2m2")),
      create("r3m2", 3, "Semifinals", 2, winner("r2m3"), winner("r2m4")),
      create("r4m1", 4, "Championship", 1, winner("r3m1"), winner("r3m2")),
    ];
  }

  if (qualifierCount === 12) {
    return [
      create("r1m1", 1, "Play-In", 1, seed(5), seed(12)),
      create("r1m2", 1, "Play-In", 2, seed(6), seed(11)),
      create("r1m3", 1, "Play-In", 3, seed(7), seed(10)),
      create("r1m4", 1, "Play-In", 4, seed(8), seed(9)),
      create("r2m1", 2, "Quarterfinals", 1, seed(1), winner("r1m4")),
      create("r2m2", 2, "Quarterfinals", 2, seed(4), winner("r1m1")),
      create("r2m3", 2, "Quarterfinals", 3, seed(2), winner("r1m3")),
      create("r2m4", 2, "Quarterfinals", 4, seed(3), winner("r1m2")),
      create("r3m1", 3, "Semifinals", 1, winner("r2m1"), winner("r2m2")),
      create("r3m2", 3, "Semifinals", 2, winner("r2m3"), winner("r2m4")),
      create("r4m1", 4, "Championship", 1, winner("r3m1"), winner("r3m2")),
    ];
  }

  if (qualifierCount === 8) {
    return [
      create("r1m1", 1, "Quarterfinals", 1, seed(1), seed(8)),
      create("r1m2", 1, "Quarterfinals", 2, seed(4), seed(5)),
      create("r1m3", 1, "Quarterfinals", 3, seed(2), seed(7)),
      create("r1m4", 1, "Quarterfinals", 4, seed(3), seed(6)),
      create("r2m1", 2, "Semifinals", 1, winner("r1m1"), winner("r1m2")),
      create("r2m2", 2, "Semifinals", 2, winner("r1m3"), winner("r1m4")),
      create("r3m1", 3, "Championship", 1, winner("r2m1"), winner("r2m2")),
    ];
  }

  // Four-player fallback for small Full Season Leagues.
  return [
    create("r1m1", 1, "Semifinals", 1, seed(1), seed(4)),
    create("r1m2", 1, "Semifinals", 2, seed(2), seed(3)),
    create("r2m1", 2, "Championship", 1, winner("r1m1"), winner("r1m2")),
  ];
}
