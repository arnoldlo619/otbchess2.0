/**
 * Swiss pairing performance tests — verifies the backtrack limit
 * and greedy fallback work correctly for large tournaments (100 players).
 */
import { describe, it, expect } from "vitest";
import { generateSwissPairings } from "@/lib/swiss";
import type { Player, Round, Game } from "@/lib/tournamentData";

function makePlayers(n: number): Player[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i + 1}`,
    name: `Player ${i + 1}`,
    username: `player${i + 1}`,
    elo: 1800 - i * 10,
    points: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    colorHistory: [],
    platform: "chesscom" as const,
  }));
}

function simulateResult(game: Game, result: "1-0" | "0-1" | "½-½"): Game {
  return { ...game, result };
}

describe("Swiss pairing performance for 100 players", () => {
  it("generates round 1 pairings for 100 players in under 1 second", () => {
    const players = makePlayers(100);
    const start = performance.now();
    const games = generateSwissPairings(players, [], 1);
    const elapsed = performance.now() - start;

    expect(games.length).toBe(50); // 100 players = 50 boards
    expect(elapsed).toBeLessThan(1000); // must complete in under 1s
  });

  it("generates round 7 pairings for 100 players without freezing", () => {
    const players = makePlayers(100);
    const rounds: Round[] = [];

    // Simulate 6 rounds of results
    for (let r = 1; r <= 6; r++) {
      // Update player points based on previous rounds
      const currentPlayers = players.map((p) => ({ ...p }));
      for (const round of rounds) {
        for (const game of round.games) {
          if (game.result === "1-0") {
            const w = currentPlayers.find((p) => p.id === game.whiteId);
            if (w) w.points += 1;
          } else if (game.result === "0-1") {
            const b = currentPlayers.find((p) => p.id === game.blackId);
            if (b) b.points += 1;
          } else if (game.result === "½-½") {
            const w = currentPlayers.find((p) => p.id === game.whiteId);
            const b = currentPlayers.find((p) => p.id === game.blackId);
            if (w) w.points += 0.5;
            if (b) b.points += 0.5;
          }
        }
      }

      const games = generateSwissPairings(currentPlayers, rounds, r);
      // Simulate results: higher-rated player wins 70% of the time
      const completedGames = games.map((g) => {
        if (g.whiteId === "BYE" || g.blackId === "BYE") return g;
        const wElo = currentPlayers.find((p) => p.id === g.whiteId)?.elo ?? 1500;
        const bElo = currentPlayers.find((p) => p.id === g.blackId)?.elo ?? 1500;
        const roll = ((r * 17 + g.board * 13) % 100) / 100;
        if (roll < 0.15) return simulateResult(g, "½-½");
        if (wElo >= bElo) {
          return simulateResult(g, roll < 0.7 ? "1-0" : "0-1");
        }
        return simulateResult(g, roll < 0.7 ? "0-1" : "1-0");
      });

      rounds.push({ number: r, games: completedGames });
    }

    // Now generate round 7 — this is the stress test
    const finalPlayers = players.map((p) => ({ ...p }));
    for (const round of rounds) {
      for (const game of round.games) {
        if (game.result === "1-0") {
          const w = finalPlayers.find((pp) => pp.id === game.whiteId);
          if (w) w.points += 1;
        } else if (game.result === "0-1") {
          const b = finalPlayers.find((pp) => pp.id === game.blackId);
          if (b) b.points += 1;
        } else if (game.result === "½-½") {
          const w = finalPlayers.find((pp) => pp.id === game.whiteId);
          const b = finalPlayers.find((pp) => pp.id === game.blackId);
          if (w) w.points += 0.5;
          if (b) b.points += 0.5;
        }
      }
    }

    const start = performance.now();
    const round7Games = generateSwissPairings(finalPlayers, rounds, 7);
    const elapsed = performance.now() - start;

    // Must produce valid pairings
    const nonByeGames = round7Games.filter(
      (g) => g.whiteId !== "BYE" && g.blackId !== "BYE"
    );
    expect(nonByeGames.length).toBeGreaterThan(0);

    // Must complete in under 2 seconds (greedy fallback should be instant)
    expect(elapsed).toBeLessThan(2000);

    // Every player should appear exactly once
    const playerIds = new Set(players.map((p) => p.id));
    const pairedIds = new Set<string>();
    for (const g of round7Games) {
      if (g.whiteId !== "BYE") pairedIds.add(g.whiteId);
      if (g.blackId !== "BYE") pairedIds.add(g.blackId);
    }
    expect(pairedIds.size).toBe(playerIds.size);
  });

  it("handles odd number of players (99) correctly", () => {
    const players = makePlayers(99);
    const games = generateSwissPairings(players, [], 1);

    // 99 players: 49 boards + 1 bye
    expect(games.length).toBe(50);
    const byeGames = games.filter((g) => g.whiteId === "BYE");
    expect(byeGames.length).toBe(1);
  });
});
