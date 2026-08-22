import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  computeStandings,
  generateSwissPairings,
  resolvePairingRating,
  validatePairings,
} from "../lib/swiss";
import type { Game, Player, Round } from "../lib/tournamentData";

function makePlayers(count: number): Player[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `p${index + 1}`,
    name: `Player ${index + 1}`,
    username: `player${index + 1}`,
    elo: 2400 - index * 20,
    pairingRating: 2400 - index * 20,
    ratingSource: "rapid" as const,
    points: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    colorHistory: [],
    platform: "chesscom" as const,
  }));
}

function playerIds(game: Game): string[] {
  return [game.whiteId, game.blackId].filter((id) => id !== "BYE").sort();
}

describe("Swiss upgrade matrix", () => {
  it.each([2, 8, 10, 20, 40])("pairs %i players by top half versus bottom half in round one", (count) => {
    const players = makePlayers(count);
    const games = generateSwissPairings(players, [], 1);
    expect(games).toHaveLength(count / 2);
    expect(validatePairings(games, players, [], 1)).toMatchObject({ valid: true, errors: [] });

    for (let board = 0; board < games.length; board += 1) {
      expect(playerIds(games[board])).toEqual([`p${board + 1}`, `p${board + 1 + count / 2}`].sort());
    }
  });

  it("keeps even score groups together in round two", () => {
    const players = makePlayers(8);
    const roundOneGames = generateSwissPairings(players, [], 1).map((game) => ({ ...game, result: "1-0" as const }));
    const rounds: Round[] = [{ number: 1, games: roundOneGames }];
    const points = new Map(computeStandings(players, rounds).map((row) => [row.player.id, row.points]));
    const roundTwoGames = generateSwissPairings(players, rounds, 2);

    for (const game of roundTwoGames) {
      if (game.whiteId === "BYE" || game.blackId === "BYE") continue;
      expect(points.get(game.whiteId)).toBe(points.get(game.blackId));
    }
    expect(validatePairings(roundTwoGames, players, rounds, 2).valid).toBe(true);
  });

  it("awards a full point for an odd-player tournament bye", () => {
    const players = makePlayers(9);
    const games = generateSwissPairings(players, [], 1);
    const bye = games.find((game) => game.whiteId === "BYE");
    expect(bye).toBeDefined();
    const completed = games.map((game) => game.whiteId === "BYE" ? { ...game, result: "0-1" as const } : { ...game, result: "½-½" as const });
    const standings = computeStandings(players, [{ number: 1, games: completed }]);
    expect(standings.find((row) => row.player.id === bye?.blackId)?.points).toBe(1);
  });

  it("resolves manual, preferred category, fallback, and default ratings", () => {
    expect(resolvePairingRating({ elo: 1500, rapidElo: 1800, blitzElo: 1900, bulletElo: 2000, manualPairingRating: 2100 }, "rapid")).toEqual({ pairingRating: 2100, ratingSource: "manual" });
    expect(resolvePairingRating({ elo: 1500, rapidElo: 1800, blitzElo: 1900, bulletElo: 2000 }, "blitz")).toEqual({ pairingRating: 1900, ratingSource: "blitz" });
    expect(resolvePairingRating({ elo: 1200, bulletElo: 2000 }, "rapid")).toEqual({ pairingRating: 2000, ratingSource: "bullet" });
    expect(resolvePairingRating({ elo: 1200 }, "rapid")).toEqual({ pairingRating: 1200, ratingSource: "default" });
  });
});

describe("Swiss Director controls", () => {
  const clientRoot = resolve(import.meta.dirname, "..");
  const editModal = readFileSync(resolve(clientRoot, "components/EditPlayerModal.tsx"), "utf8");
  const director = readFileSync(resolve(clientRoot, "pages/Director.tsx"), "utf8");

  it("persists a manual override and displays an accessible source badge", () => {
    expect(editModal).toContain("manualPairingRatingStr");
    expect(editModal).toContain("resolvePairingRating(partialPlayer, tournamentRatingType)");
    expect(director).toContain("Pairing rating source:");
    expect(director).toContain('p.ratingSource === "rapid" ? "R"');
    expect(director).toContain('p.ratingSource === "blitz" ? "B"');
  });
});
