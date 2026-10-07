import { describe, expect, it } from "vitest";
import {
  calculateFullSeasonStandings,
  calculateLeagueRatingDelta,
  createPlayoffTemplate,
  generateCircleFactorization,
  getFullSeasonStructure,
  getOpponentPairKey,
  selectAdaptiveWeeklyRounds,
  type SeasonPlayerSeed,
} from "../shared/fullSeasonLeague";

describe("Full Season League structure", () => {
  it("calculates the recommended 16-player season without host arithmetic", () => {
    expect(getFullSeasonStructure(16)).toMatchObject({
      regularSeasonWeeks: 5,
      opponentRounds: 15,
      gamesPerPlayer: 30,
      totalEncounters: 120,
      totalGames: 240,
      playoffQualifierCount: 8,
      playoffWeek: 6,
    });
  });

  it("distributes a 20-player season across seven weekly Match Sets", () => {
    expect(getFullSeasonStructure(20)).toMatchObject({
      regularSeasonWeeks: 7,
      opponentRounds: 19,
      gamesPerPlayer: 38,
      totalGames: 380,
      playoffQualifierCount: 8,
    });
  });

  it("rejects odd and out-of-range Full Season rosters", () => {
    expect(() => getFullSeasonStructure(15)).toThrow("even roster");
    expect(() => getFullSeasonStructure(30)).toThrow("even roster");
  });
});

describe("Full Season complete opponent coverage", () => {
  const players = ["a", "b", "c", "d", "e", "f", "g", "h"];

  it("creates a complete 1-factorization with no duplicate encounters", () => {
    const rounds = generateCircleFactorization(players);
    expect(rounds).toHaveLength(7);
    expect(rounds.every((round) => round.pairs.length === 4)).toBe(true);
    const pairKeys = rounds.flatMap((round) => round.pairs.map((pair) => getOpponentPairKey(pair.playerAId, pair.playerBId)));
    expect(new Set(pairKeys).size).toBe(28);
    expect(pairKeys).toHaveLength(28);
  });

  it("selects three whole adaptive rounds without breaking future coverage", () => {
    const seeds: SeasonPlayerSeed[] = players.map((playerId, index) => ({
      playerId,
      originalSeed: index + 1,
      leagueRating: 1200 + index * 20,
      seasonPoints: index < 4 ? 3 : 0,
      gamePoints: index < 4 ? 5 : 0,
      rank: index + 1,
    }));
    const selected = selectAdaptiveWeeklyRounds(generateCircleFactorization(players), seeds, 3);
    expect(selected).toHaveLength(3);
    const selectedKeys = selected.flatMap((round) => round.pairs.map((pair) => getOpponentPairKey(pair.playerAId, pair.playerBId)));
    expect(new Set(selectedKeys).size).toBe(12);
  });
});

describe("Full Season encounter scoring and rating", () => {
  const players: SeasonPlayerSeed[] = [
    { playerId: "a", originalSeed: 1, leagueRating: 1200 },
    { playerId: "b", originalSeed: 2, leagueRating: 1200 },
    { playerId: "c", originalSeed: 3, leagueRating: 1200 },
  ];

  it("awards Season Points by encounter, not by individual game", () => {
    const standings = calculateFullSeasonStandings(players, [
      { playerAId: "a", playerBId: "b", playerAGamePoints: 1.5, playerBGamePoints: 0.5, weekNumber: 1, completed: true },
      { playerAId: "a", playerBId: "c", playerAGamePoints: 1, playerBGamePoints: 1, weekNumber: 1, completed: true },
    ]);
    const a = standings.find((standing) => standing.playerId === "a")!;
    const b = standings.find((standing) => standing.playerId === "b")!;
    const c = standings.find((standing) => standing.playerId === "c")!;
    expect(a.seasonPoints).toBe(1.5);
    expect(a.gamePoints).toBe(2.5);
    expect(a.encounterWins).toBe(1);
    expect(a.encounterDraws).toBe(1);
    expect(b.seasonPoints).toBe(0);
    expect(c.seasonPoints).toBe(0.5);
  });

  it("updates League Rating once after a complete two-game encounter", () => {
    const delta = calculateLeagueRatingDelta(1200, 1200, 1.5, 0.5);
    expect(delta.playerADelta).toBe(8);
    expect(delta.playerBDelta).toBe(-8);
    expect(delta.playerANextRating).toBe(1208);
    expect(delta.playerBNextRating).toBe(1192);
  });

  it("rejects non-complementary game scores", () => {
    expect(() => calculateLeagueRatingDelta(1200, 1200, 1.5, 1)).toThrow("complementary");
  });
});

describe("Championship Day bracket templates", () => {
  it("gives the top two seeds byes in the Top 6 field", () => {
    const template = createPlayoffTemplate(6);
    expect(template.filter((match) => match.roundLabel === "Play-In")).toHaveLength(2);
    expect(template.find((match) => match.key === "r2m1")?.playerASource).toEqual({ type: "seed", seed: 1 });
    expect(template.find((match) => match.key === "r2m2")?.playerASource).toEqual({ type: "seed", seed: 2 });
  });

  it("uses the requested Top 8 and Top 12 seed paths", () => {
    expect(createPlayoffTemplate(8).filter((match) => match.roundLabel === "Quarterfinals")).toHaveLength(4);
    expect(createPlayoffTemplate(12).filter((match) => match.roundLabel === "Play-In")).toHaveLength(4);
  });
});
