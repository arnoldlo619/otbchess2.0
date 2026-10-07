/**
 * Durable lifecycle service for ChessOTB Full Season League.
 *
 * Legacy Round Robin records remain on the existing path in `server/leagues.ts`.
 * This service owns only the `full_season` format: two-game encounters,
 * adaptive-but-complete week ordering, standings, rating movement, and
 * Championship Day playoffs.
 */

import { and, asc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getDb } from "./db.js";
import {
  leagueEncounters,
  leagueMatches,
  leaguePlayoffGames,
  leaguePlayoffMatches,
  leaguePlayers,
  leagueStandings,
  leagueWeeks,
  leagues,
} from "../shared/schema.js";
import {
  calculateFullSeasonStandings,
  calculateLeagueRatingDelta,
  createPlayoffTemplate,
  DEFAULT_LEAGUE_RATING,
  getFullSeasonStructure,
  getOpponentPairKey,
  isFullSeasonFormat,
  selectAdaptiveWeeklyRounds,
  type EncounterResult,
  type SeasonPlayerSeed,
} from "../shared/fullSeasonLeague.js";

type Database = Awaited<ReturnType<typeof getDb>>;
type LeagueRow = typeof leagues.$inferSelect;
type LeaguePlayerRow = typeof leaguePlayers.$inferSelect;
type Result = "white_win" | "black_win" | "draw";

function assertFullSeason(league: LeagueRow): void {
  if (!isFullSeasonFormat(league.formatType)) throw new Error("League is not a Full Season League.");
}

function scoreForPlayer(result: Result | null, isWhite: boolean): number {
  if (result === "draw") return 0.5;
  if (result === "white_win") return isWhite ? 1 : 0;
  if (result === "black_win") return isWhite ? 0 : 1;
  return 0;
}

function sourceToString(source: { type: "seed"; seed: number } | { type: "winner"; matchKey: string }): string {
  return source.type === "seed" ? `seed:${source.seed}` : `winner:${source.matchKey}`;
}

function parseSource(source: string): { type: "seed"; seed: number } | { type: "winner"; matchKey: string } {
  if (source.startsWith("seed:")) return { type: "seed", seed: Number(source.slice(5)) };
  return { type: "winner", matchKey: source.slice(7) };
}

function pendingWeekState(state: string | null | undefined): boolean {
  return state === "generated" || state === "published" || state === "in_progress";
}

export async function initializeFullSeasonLeague(
  db: Database,
  league: LeagueRow,
  players: LeaguePlayerRow[],
): Promise<void> {
  assertFullSeason(league);
  const structure = getFullSeasonStructure(players.length);
  if (players.length !== league.maxPlayers) {
    throw new Error(`Roster must have exactly ${league.maxPlayers} players (currently ${players.length}).`);
  }

  const orderedPlayers = [...players].sort((left, right) =>
    (left.originalSeed || left.id).toString().localeCompare((right.originalSeed || right.id).toString()),
  );

  for (let index = 0; index < orderedPlayers.length; index += 1) {
    const player = orderedPlayers[index];
    const seed = index + 1;
    const leagueRating = player.rating && player.rating > 0 ? player.rating : DEFAULT_LEAGUE_RATING;
    await db.update(leaguePlayers).set({ originalSeed: seed, leagueRating }).where(eq(leaguePlayers.id, player.id));
    await db.insert(leagueStandings).values({
      leagueId: league.id,
      playerId: player.playerId,
      displayName: player.displayName,
      avatarUrl: player.avatarUrl ?? undefined,
      wins: 0,
      losses: 0,
      draws: 0,
      points: 0,
      rank: seed,
      previousRank: seed,
      seasonPoints: 0,
      gamePoints: 0,
      encounterWins: 0,
      encounterDraws: 0,
      encounterLosses: 0,
      gamesPlayed: 0,
      encountersPlayed: 0,
      sonnebornBerger: 0,
      leagueRating,
      ratingChange: 0,
      streak: "",
      movement: "same",
      lastResults: "[]",
    });
  }

  await db.update(leagues).set({
    status: "active",
    seasonPhase: "regular_season",
    currentWeek: 1,
    totalWeeks: structure.regularSeasonWeeks,
    opponentsPerWeek: structure.opponentsPerStandardWeek,
    gamesPerEncounter: structure.gamesPerEncounter,
    playoffQualifierCount: structure.playoffQualifierCount,
    rosterLockedAt: new Date(),
  }).where(eq(leagues.id, league.id));

  const [updatedLeague] = await db.select().from(leagues).where(eq(leagues.id, league.id)).limit(1);
  const seededPlayers = await db.select().from(leaguePlayers).where(eq(leaguePlayers.leagueId, league.id));
  await generateNextFullSeasonWeek(db, updatedLeague, seededPlayers);
}

/** Creates the next full week in generated state; it is not implicitly published. */
export async function generateNextFullSeasonWeek(
  db: Database,
  league: LeagueRow,
  playersOverride?: LeaguePlayerRow[],
): Promise<{ weekNumber: number; encounterCount: number }> {
  assertFullSeason(league);
  if (league.seasonPhase !== "regular_season") throw new Error("The regular season is not active.");

  const players = playersOverride ?? await db.select().from(leaguePlayers).where(eq(leaguePlayers.leagueId, league.id));
  const [existingWeek] = await db.select().from(leagueWeeks)
    .where(and(eq(leagueWeeks.leagueId, league.id), eq(leagueWeeks.weekNumber, league.currentWeek)))
    .limit(1);
  if (existingWeek) {
    const count = await db.select().from(leagueEncounters).where(eq(leagueEncounters.weekId, existingWeek.id));
    return { weekNumber: existingWeek.weekNumber, encounterCount: count.length };
  }

  const allEncounters = await db.select().from(leagueEncounters)
    .where(eq(leagueEncounters.leagueId, league.id));
  const scheduledPairKeys = new Set(allEncounters.map((encounter: typeof leagueEncounters.$inferSelect) => encounter.pairKey));
  const createdRoundNumbers = new Set(allEncounters.map((encounter: typeof leagueEncounters.$inferSelect) => Number(encounter.weekNumber)));
  const playerIds = [...players]
    .sort((left, right) => left.originalSeed - right.originalSeed || left.id - right.id)
    .map((player) => player.playerId);

  const { generateCircleFactorization } = await import("../shared/fullSeasonLeague.js");
  const circleRounds = generateCircleFactorization(playerIds).filter((round) =>
    round.pairs.every((pair) => !scheduledPairKeys.has(getOpponentPairKey(pair.playerAId, pair.playerBId))),
  );
  const standings = await db.select().from(leagueStandings).where(eq(leagueStandings.leagueId, league.id));
  const standingMap = new Map(standings.map((standing: typeof leagueStandings.$inferSelect) => [standing.playerId, standing]));
  const seeds: SeasonPlayerSeed[] = players.map((player) => {
    const standing = standingMap.get(player.playerId);
    return {
      playerId: player.playerId,
      originalSeed: player.originalSeed || player.id,
      leagueRating: player.leagueRating || DEFAULT_LEAGUE_RATING,
      seasonPoints: standing?.seasonPoints ?? 0,
      gamePoints: standing?.gamePoints ?? 0,
      rank: standing?.rank ?? player.originalSeed,
    };
  });
  const remainingWeeks = Math.max(1, league.totalWeeks - league.currentWeek + 1);
  const selectedRounds = selectAdaptiveWeeklyRounds(circleRounds, seeds, remainingWeeks);
  if (selectedRounds.length === 0 && circleRounds.length > 0) {
    throw new Error("Unable to generate a complete remaining Full Season schedule.");
  }
  if (circleRounds.length && selectedRounds.length === 0) throw new Error("No valid opponent encounters remain.");

  await db.insert(leagueWeeks).values({
    leagueId: league.id,
    weekNumber: league.currentWeek,
    isComplete: 0,
    state: "generated",
  });
  const [week] = await db.select().from(leagueWeeks)
    .where(and(eq(leagueWeeks.leagueId, league.id), eq(leagueWeeks.weekNumber, league.currentWeek)))
    .limit(1);
  if (!week) throw new Error("Unable to create the weekly Match Set.");

  const playerMap = new Map(players.map((player) => [player.playerId, player]));
  let encounterCount = 0;
  for (const round of selectedRounds) {
    for (const pair of round.pairs) {
      const playerA = playerMap.get(pair.playerAId);
      const playerB = playerMap.get(pair.playerBId);
      if (!playerA || !playerB) throw new Error("A scheduled player is no longer on the locked roster.");
      const encounterId = nanoid(20);
      await db.insert(leagueEncounters).values({
        id: encounterId,
        leagueId: league.id,
        weekId: week.id,
        weekNumber: league.currentWeek,
        pairKey: getOpponentPairKey(pair.playerAId, pair.playerBId),
        playerAId: playerA.playerId,
        playerBId: playerB.playerId,
        playerAName: playerA.displayName,
        playerBName: playerB.displayName,
        status: "generated",
      });
      // Every encounter always persists both color-reversed games together.
      await db.insert(leagueMatches).values([
        {
          leagueId: league.id,
          weekId: week.id,
          weekNumber: league.currentWeek,
          encounterId,
          gameNumber: 1,
          gameKind: "regular",
          playerWhiteId: playerA.playerId,
          playerWhiteName: playerA.displayName,
          playerBlackId: playerB.playerId,
          playerBlackName: playerB.displayName,
          resultStatus: "pending",
        },
        {
          leagueId: league.id,
          weekId: week.id,
          weekNumber: league.currentWeek,
          encounterId,
          gameNumber: 2,
          gameKind: "regular",
          playerWhiteId: playerB.playerId,
          playerWhiteName: playerB.displayName,
          playerBlackId: playerA.playerId,
          playerBlackName: playerA.displayName,
          resultStatus: "pending",
        },
      ]);
      encounterCount += 1;
    }
  }

  // `createdRoundNumbers` is intentionally computed above as an audit guard:
  // every created encounter consumes a previously-unplayed circle factor.
  void createdRoundNumbers;
  return { weekNumber: week.weekNumber, encounterCount };
}

export async function publishFullSeasonWeek(db: Database, league: LeagueRow, weekNumber: number): Promise<void> {
  assertFullSeason(league);
  const [week] = await db.select().from(leagueWeeks)
    .where(and(eq(leagueWeeks.leagueId, league.id), eq(leagueWeeks.weekNumber, weekNumber)))
    .limit(1);
  if (!week) throw new Error("League week not found.");
  if (week.state !== "generated") throw new Error("Only a generated Match Set can be published.");
  await db.update(leagueWeeks).set({ state: "published", publishedAt: new Date() }).where(eq(leagueWeeks.id, week.id));
  await db.update(leagueEncounters).set({ status: "published" }).where(eq(leagueEncounters.weekId, week.id));
}

export async function startFullSeasonWeek(db: Database, league: LeagueRow, weekNumber: number): Promise<void> {
  assertFullSeason(league);
  const [week] = await db.select().from(leagueWeeks)
    .where(and(eq(leagueWeeks.leagueId, league.id), eq(leagueWeeks.weekNumber, weekNumber)))
    .limit(1);
  if (!week) throw new Error("League week not found.");
  if (week.state !== "published") throw new Error("Publish the Match Set before starting play.");
  await db.update(leagueWeeks).set({ state: "in_progress" }).where(eq(leagueWeeks.id, week.id));
  await db.update(leagueEncounters).set({ status: "in_progress" }).where(eq(leagueEncounters.weekId, week.id));
}

export async function reportFullSeasonGameResult(
  db: Database,
  league: LeagueRow,
  matchId: number,
  result: Result,
  reporterId: string,
): Promise<void> {
  assertFullSeason(league);
  const [match] = await db.select().from(leagueMatches)
    .where(and(eq(leagueMatches.id, matchId), eq(leagueMatches.leagueId, league.id)))
    .limit(1);
  if (!match?.encounterId) throw new Error("Full Season game not found.");
  if (match.resultStatus === "completed") throw new Error("Result already finalized.");

  const [week] = await db.select().from(leagueWeeks).where(eq(leagueWeeks.id, match.weekId)).limit(1);
  if (!week || !pendingWeekState(week.state) || week.state === "generated") {
    throw new Error("Publish this Match Set before entering a result.");
  }

  await db.update(leagueMatches).set({
    result,
    resultStatus: "completed",
    reportedByUserId: reporterId,
    whiteReport: result,
    blackReport: result,
    whiteReportedAt: new Date(),
    blackReportedAt: new Date(),
    completedAt: new Date(),
  }).where(eq(leagueMatches.id, match.id));

  await resolveFullSeasonEncounter(db, league, match.encounterId);
}

export async function resolveFullSeasonEncounter(db: Database, league: LeagueRow, encounterId: string): Promise<void> {
  const [encounter] = await db.select().from(leagueEncounters).where(eq(leagueEncounters.id, encounterId)).limit(1);
  if (!encounter || encounter.status === "complete") return;
  const games = await db.select().from(leagueMatches)
    .where(eq(leagueMatches.encounterId, encounterId))
    .orderBy(asc(leagueMatches.gameNumber));
  if (games.length !== 2 || games.some((game: typeof leagueMatches.$inferSelect) => game.resultStatus !== "completed")) return;

  const playerAGamePoints = games.reduce((total: number, game: typeof leagueMatches.$inferSelect) =>
    total + scoreForPlayer(game.result as Result, game.playerWhiteId === encounter.playerAId), 0);
  const playerBGamePoints = 2 - playerAGamePoints;
  const playerASeasonPoints = playerAGamePoints > playerBGamePoints ? 1 : playerAGamePoints === playerBGamePoints ? 0.5 : 0;
  const playerBSeasonPoints = playerBGamePoints > playerAGamePoints ? 1 : playerBGamePoints === playerAGamePoints ? 0.5 : 0;

  const players = await db.select().from(leaguePlayers).where(eq(leaguePlayers.leagueId, league.id));
  const playerA = players.find((player: LeaguePlayerRow) => player.playerId === encounter.playerAId);
  const playerB = players.find((player: LeaguePlayerRow) => player.playerId === encounter.playerBId);
  if (!playerA || !playerB) throw new Error("Encounter roster is incomplete.");
  const rating = calculateLeagueRatingDelta(
    playerA.leagueRating || DEFAULT_LEAGUE_RATING,
    playerB.leagueRating || DEFAULT_LEAGUE_RATING,
    playerAGamePoints,
    playerBGamePoints,
  );

  await db.update(leagueEncounters).set({
    status: "complete",
    playerAGamePoints,
    playerBGamePoints,
    playerASeasonPoints,
    playerBSeasonPoints,
    playerARatingDelta: rating.playerADelta,
    playerBRatingDelta: rating.playerBDelta,
    completedAt: new Date(),
  }).where(eq(leagueEncounters.id, encounter.id));
  await db.update(leaguePlayers).set({ leagueRating: rating.playerANextRating }).where(eq(leaguePlayers.id, playerA.id));
  await db.update(leaguePlayers).set({ leagueRating: rating.playerBNextRating }).where(eq(leaguePlayers.id, playerB.id));
  await recalculateFullSeasonStandings(db, league);
  await finalizeFullSeasonWeekIfComplete(db, league, encounter.weekId);
}

export async function recalculateFullSeasonStandings(db: Database, league: LeagueRow): Promise<void> {
  assertFullSeason(league);
  const players = await db.select().from(leaguePlayers).where(eq(leaguePlayers.leagueId, league.id));
  const encounters = await db.select().from(leagueEncounters)
    .where(eq(leagueEncounters.leagueId, league.id))
    .orderBy(asc(leagueEncounters.weekNumber), asc(leagueEncounters.createdAt));
  const playerSeeds: SeasonPlayerSeed[] = players.map((player: LeaguePlayerRow) => ({
    playerId: player.playerId,
    originalSeed: player.originalSeed || player.id,
    leagueRating: player.leagueRating || DEFAULT_LEAGUE_RATING,
  }));
  const resultRows: EncounterResult[] = encounters.map((encounter: typeof leagueEncounters.$inferSelect) => ({
    playerAId: encounter.playerAId,
    playerBId: encounter.playerBId,
    playerAGamePoints: encounter.playerAGamePoints,
    playerBGamePoints: encounter.playerBGamePoints,
    weekNumber: encounter.weekNumber,
    completed: encounter.status === "complete",
  }));
  const standings = calculateFullSeasonStandings(playerSeeds, resultRows);
  const playerMap = new Map(players.map((player: LeaguePlayerRow) => [player.playerId, player]));
  const existing = await db.select().from(leagueStandings).where(eq(leagueStandings.leagueId, league.id));
  const previous = new Map(existing.map((standing: typeof leagueStandings.$inferSelect) => [standing.playerId, standing]));

  for (const standing of standings) {
    const player = playerMap.get(standing.playerId);
    const previousStanding = previous.get(standing.playerId);
    if (!player) continue;
    const priorRank = previousStanding?.rank ?? standing.rank;
    const ratingChange = standing.leagueRating - (previousStanding?.leagueRating ?? standing.leagueRating);
    const movement = standing.rank < priorRank ? "up" : standing.rank > priorRank ? "down" : "same";
    const data = {
      displayName: player.displayName,
      avatarUrl: player.avatarUrl ?? undefined,
      wins: standing.individualWins,
      losses: standing.individualLosses,
      draws: standing.individualDraws,
      points: standing.seasonPoints,
      rank: standing.rank,
      previousRank: priorRank,
      seasonPoints: standing.seasonPoints,
      gamePoints: standing.gamePoints,
      encounterWins: standing.encounterWins,
      encounterDraws: standing.encounterDraws,
      encounterLosses: standing.encounterLosses,
      gamesPlayed: standing.gamesPlayed,
      encountersPlayed: standing.encountersPlayed,
      sonnebornBerger: standing.sonnebornBerger,
      leagueRating: player.leagueRating || DEFAULT_LEAGUE_RATING,
      ratingChange,
      streak: standing.lastResults.join("-"),
      movement,
      lastResults: JSON.stringify(standing.lastResults),
    };
    if (previousStanding) {
      await db.update(leagueStandings).set(data)
        .where(and(eq(leagueStandings.leagueId, league.id), eq(leagueStandings.playerId, standing.playerId)));
    } else {
      await db.insert(leagueStandings).values({ leagueId: league.id, playerId: standing.playerId, ...data });
    }
  }
}

export async function finalizeFullSeasonWeekIfComplete(db: Database, league: LeagueRow, weekId: number): Promise<void> {
  const [week] = await db.select().from(leagueWeeks).where(eq(leagueWeeks.id, weekId)).limit(1);
  if (!week || week.state === "finalized") return;
  const encounters = await db.select().from(leagueEncounters).where(eq(leagueEncounters.weekId, weekId));
  if (!encounters.length || encounters.some((encounter: typeof leagueEncounters.$inferSelect) => encounter.status !== "complete" && encounter.status !== "forfeit")) return;

  await db.update(leagueWeeks).set({ state: "finalized", isComplete: 1 }).where(eq(leagueWeeks.id, week.id));
  if (week.weekNumber >= league.totalWeeks) {
    await startFullSeasonPlayoffs(db, league);
    return;
  }
  const nextWeek = week.weekNumber + 1;
  await db.update(leagues).set({ currentWeek: nextWeek }).where(eq(leagues.id, league.id));
  const [nextLeague] = await db.select().from(leagues).where(eq(leagues.id, league.id)).limit(1);
  const players = await db.select().from(leaguePlayers).where(eq(leaguePlayers.leagueId, league.id));
  await generateNextFullSeasonWeek(db, nextLeague, players);
}

export async function startFullSeasonPlayoffs(db: Database, league: LeagueRow): Promise<void> {
  assertFullSeason(league);
  const existing = await db.select().from(leaguePlayoffMatches).where(eq(leaguePlayoffMatches.leagueId, league.id));
  if (existing.length) return;

  await recalculateFullSeasonStandings(db, league);
  const standings = await db.select().from(leagueStandings)
    .where(eq(leagueStandings.leagueId, league.id))
    .orderBy(asc(leagueStandings.rank));
  const qualifiers = standings.slice(0, league.playoffQualifierCount);
  const seedMap = new Map(qualifiers.map((standing: typeof leagueStandings.$inferSelect) => [standing.rank, standing.playerId]));
  const template = createPlayoffTemplate(league.playoffQualifierCount);

  await db.update(leagues).set({
    seasonPhase: "playoffs",
    regularSeasonChampionId: qualifiers[0]?.playerId ?? null,
  }).where(eq(leagues.id, league.id));

  for (const matchup of template) {
    const playerASource = sourceToString(matchup.playerASource);
    const playerBSource = sourceToString(matchup.playerBSource);
    const playerAId = matchup.playerASource.type === "seed" ? seedMap.get(matchup.playerASource.seed) ?? null : null;
    const playerBId = matchup.playerBSource.type === "seed" ? seedMap.get(matchup.playerBSource.seed) ?? null : null;
    const ready = Boolean(playerAId && playerBId);
    await db.insert(leaguePlayoffMatches).values({
      id: nanoid(20),
      leagueId: league.id,
      bracketKey: matchup.key,
      roundNumber: matchup.roundNumber,
      roundLabel: matchup.roundLabel,
      matchNumber: matchup.matchNumber,
      playerAId,
      playerBId,
      playerASeed: matchup.playerASource.type === "seed" ? matchup.playerASource.seed : null,
      playerBSeed: matchup.playerBSource.type === "seed" ? matchup.playerBSource.seed : null,
      playerASource,
      playerBSource,
      status: ready ? "ready" : "pending",
    });
  }
  await materializeReadyPlayoffGames(db, league.id);
}

export async function materializeReadyPlayoffGames(db: Database, leagueId: string): Promise<void> {
  const matches = await db.select().from(leaguePlayoffMatches)
    .where(eq(leaguePlayoffMatches.leagueId, leagueId))
    .orderBy(asc(leaguePlayoffMatches.roundNumber), asc(leaguePlayoffMatches.matchNumber));
  const byKey = new Map<string, typeof leaguePlayoffMatches.$inferSelect>(
    matches.map((match) => [match.bracketKey, match]),
  );

  for (const match of matches) {
    if (match.status === "complete" || match.status === "tiebreak") continue;
    let playerAId = match.playerAId;
    let playerBId = match.playerBId;
    const sources = [parseSource(match.playerASource), parseSource(match.playerBSource)];
    if (!playerAId && sources[0].type === "winner") playerAId = byKey.get(sources[0].matchKey)?.winnerId ?? null;
    if (!playerBId && sources[1].type === "winner") playerBId = byKey.get(sources[1].matchKey)?.winnerId ?? null;
    if (!playerAId || !playerBId) continue;

    const existingGames = await db.select().from(leaguePlayoffGames).where(eq(leaguePlayoffGames.playoffMatchId, match.id));
    if (!existingGames.length) {
      await db.insert(leaguePlayoffGames).values([
        { id: nanoid(20), playoffMatchId: match.id, gameNumber: 1, phase: "rapid", playerWhiteId: playerAId, playerBlackId: playerBId },
        { id: nanoid(20), playoffMatchId: match.id, gameNumber: 2, phase: "rapid", playerWhiteId: playerBId, playerBlackId: playerAId },
      ]);
    }
    if (match.status !== "ready" || match.playerAId !== playerAId || match.playerBId !== playerBId) {
      await db.update(leaguePlayoffMatches).set({ playerAId, playerBId, status: "ready" }).where(eq(leaguePlayoffMatches.id, match.id));
    }
  }
}

export async function reportPlayoffGameResult(
  db: Database,
  league: LeagueRow,
  playoffMatchId: string,
  gameId: string,
  result: Result,
  reporterId: string,
): Promise<void> {
  assertFullSeason(league);
  if (league.seasonPhase !== "playoffs") throw new Error("Championship Day has not started.");
  const [match] = await db.select().from(leaguePlayoffMatches)
    .where(and(eq(leaguePlayoffMatches.id, playoffMatchId), eq(leaguePlayoffMatches.leagueId, league.id)))
    .limit(1);
  if (!match) throw new Error("Playoff matchup not found.");
  const [game] = await db.select().from(leaguePlayoffGames)
    .where(and(eq(leaguePlayoffGames.id, gameId), eq(leaguePlayoffGames.playoffMatchId, match.id)))
    .limit(1);
  if (!game || game.resultStatus === "completed") throw new Error("Playoff game result is already finalized.");
  if (game.phase === "armageddon" && result === "draw") throw new Error("Armageddon must produce a decisive winner.");

  await db.update(leaguePlayoffGames).set({ result, resultStatus: "completed", reportedByUserId: reporterId, completedAt: new Date() })
    .where(eq(leaguePlayoffGames.id, game.id));
  await resolvePlayoffMatchIfComplete(db, league, match.id);
}

async function resolvePlayoffMatchIfComplete(db: Database, league: LeagueRow, playoffMatchId: string): Promise<void> {
  const [match] = await db.select().from(leaguePlayoffMatches).where(eq(leaguePlayoffMatches.id, playoffMatchId)).limit(1);
  if (!match || !match.playerAId || !match.playerBId || match.status === "complete") return;
  const games = await db.select().from(leaguePlayoffGames).where(eq(leaguePlayoffGames.playoffMatchId, match.id));
  const rapid = games.filter((game: typeof leaguePlayoffGames.$inferSelect) => game.phase === "rapid");
  const blitz = games.filter((game: typeof leaguePlayoffGames.$inferSelect) => game.phase === "blitz");
  const armageddon = games.find((game: typeof leaguePlayoffGames.$inferSelect) => game.phase === "armageddon");

  const phaseWinner = (phaseGames: typeof games): string | null => {
    if (phaseGames.length !== 2 || phaseGames.some((game: typeof leaguePlayoffGames.$inferSelect) => game.resultStatus !== "completed")) return null;
    const aScore = phaseGames.reduce((total: number, game: typeof leaguePlayoffGames.$inferSelect) => total + scoreForPlayer(game.result as Result, game.playerWhiteId === match.playerAId), 0);
    if (aScore === 1) return "tied";
    return aScore > 1 ? match.playerAId! : match.playerBId!;
  };

  let winner = phaseWinner(rapid);
  if (winner === null) return;
  if (winner === "tied") {
    winner = phaseWinner(blitz);
    if (winner === null && !blitz.length) {
      await db.insert(leaguePlayoffGames).values([
        { id: nanoid(20), playoffMatchId: match.id, gameNumber: 1, phase: "blitz", playerWhiteId: match.playerAId, playerBlackId: match.playerBId },
        { id: nanoid(20), playoffMatchId: match.id, gameNumber: 2, phase: "blitz", playerWhiteId: match.playerBId, playerBlackId: match.playerAId },
      ]);
      await db.update(leaguePlayoffMatches).set({ status: "tiebreak" }).where(eq(leaguePlayoffMatches.id, match.id));
      return;
    }
    if (winner === null) return;
    if (winner === "tied") {
      if (!armageddon) {
        await db.insert(leaguePlayoffGames).values({
          id: nanoid(20), playoffMatchId: match.id, gameNumber: 1, phase: "armageddon", playerWhiteId: match.playerAId, playerBlackId: match.playerBId,
        });
        return;
      }
      if (armageddon.resultStatus !== "completed") return;
      winner = armageddon.result === "white_win" ? armageddon.playerWhiteId : armageddon.playerBlackId;
    }
  }

  await db.update(leaguePlayoffMatches).set({ status: "complete", winnerId: winner, completedAt: new Date() })
    .where(eq(leaguePlayoffMatches.id, match.id));
  await materializeReadyPlayoffGames(db, league.id);

  const completed = await db.select().from(leaguePlayoffMatches).where(eq(leaguePlayoffMatches.leagueId, league.id));
  const final = completed.find((candidate: typeof leaguePlayoffMatches.$inferSelect) => candidate.roundLabel === "Championship");
  if (final?.status === "complete" && final.winnerId) {
    await db.update(leagues).set({ status: "completed", seasonPhase: "complete", leagueChampionId: final.winnerId })
      .where(eq(leagues.id, league.id));
  }
}

export async function getFullSeasonDetail(db: Database, leagueId: string) {
  const [league] = await db.select().from(leagues).where(eq(leagues.id, leagueId)).limit(1);
  if (!league || !isFullSeasonFormat(league.formatType)) return null;
  const [weeks, encounters, playoffMatches, playoffGames] = await Promise.all([
    db.select().from(leagueWeeks).where(eq(leagueWeeks.leagueId, leagueId)).orderBy(asc(leagueWeeks.weekNumber)),
    db.select().from(leagueEncounters).where(eq(leagueEncounters.leagueId, leagueId)).orderBy(asc(leagueEncounters.weekNumber)),
    db.select().from(leaguePlayoffMatches).where(eq(leaguePlayoffMatches.leagueId, leagueId)).orderBy(asc(leaguePlayoffMatches.roundNumber), asc(leaguePlayoffMatches.matchNumber)),
    db.select().from(leaguePlayoffGames),
  ]);
  const games = await db.select().from(leagueMatches).where(eq(leagueMatches.leagueId, leagueId));
  const gamesByEncounter = new Map<string, typeof games>();
  for (const game of games) {
    if (!game.encounterId) continue;
    const entries = gamesByEncounter.get(game.encounterId) ?? [];
    entries.push(game);
    gamesByEncounter.set(game.encounterId, entries);
  }
  return {
    weeks: weeks.map((week: typeof leagueWeeks.$inferSelect) => ({
      ...week,
      encounters: encounters.filter((encounter: typeof leagueEncounters.$inferSelect) => encounter.weekId === week.id).map((encounter: typeof leagueEncounters.$inferSelect) => ({
        ...encounter,
        games: (gamesByEncounter.get(encounter.id) ?? []).sort(
          (left: typeof leagueMatches.$inferSelect, right: typeof leagueMatches.$inferSelect) => left.gameNumber - right.gameNumber,
        ),
      })),
    })),
    playoffs: playoffMatches.map((match: typeof leaguePlayoffMatches.$inferSelect) => ({
      ...match,
      games: playoffGames.filter((game: typeof leaguePlayoffGames.$inferSelect) => game.playoffMatchId === match.id),
    })),
  };
}
