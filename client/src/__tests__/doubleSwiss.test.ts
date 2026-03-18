/**
 * Tests for the Double Swiss pairing engine.
 * Verifies that generateDoubleSwissPairings produces two games per board,
 * with correctly swapped colors, and that bye games are not doubled.
 */
import { describe, it, expect } from "vitest";
import { generateDoubleSwissPairings } from "@/lib/swiss";
import type { Player } from "@/lib/tournamentData";

function makePlayer(id: string, elo = 1200): Player {
  return {
    id,
    name: `Player ${id}`,
    username: id,
    elo,
    points: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    buchholz: 0,
    colorHistory: [],
    platform: "chess.com",
    avatarUrl: null,
    flairEmoji: null,
    title: null,
    seed: 0,
  };
}

describe("generateDoubleSwissPairings", () => {
  it("produces exactly 2 games per board for an even number of players", () => {
    const players = [
      makePlayer("a", 1600),
      makePlayer("b", 1500),
      makePlayer("c", 1400),
      makePlayer("d", 1300),
    ];
    const games = generateDoubleSwissPairings(players, [], 1);
    // 2 boards × 2 games = 4 games
    expect(games).toHaveLength(4);
  });

  it("assigns gameIndex 0 to Game A and gameIndex 1 to Game B", () => {
    const players = [makePlayer("a", 1600), makePlayer("b", 1500)];
    const games = generateDoubleSwissPairings(players, [], 1);
    expect(games).toHaveLength(2);
    const gA = games.find((g) => g.gameIndex === 0);
    const gB = games.find((g) => g.gameIndex === 1);
    expect(gA).toBeDefined();
    expect(gB).toBeDefined();
  });

  it("swaps colors between Game A and Game B for the same board", () => {
    const players = [makePlayer("a", 1600), makePlayer("b", 1500)];
    const games = generateDoubleSwissPairings(players, [], 1);
    const gA = games.find((g) => g.gameIndex === 0)!;
    const gB = games.find((g) => g.gameIndex === 1)!;
    // Colors must be swapped
    expect(gA.whiteId).toBe(gB.blackId);
    expect(gA.blackId).toBe(gB.whiteId);
  });

  it("both games share the same board number", () => {
    const players = [makePlayer("a", 1600), makePlayer("b", 1500)];
    const games = generateDoubleSwissPairings(players, [], 1);
    const gA = games.find((g) => g.gameIndex === 0)!;
    const gB = games.find((g) => g.gameIndex === 1)!;
    expect(gA.board).toBe(gB.board);
  });

  it("both games start with result '*'", () => {
    const players = [makePlayer("a", 1600), makePlayer("b", 1500)];
    const games = generateDoubleSwissPairings(players, [], 1);
    expect(games.every((g) => g.result === "*")).toBe(true);
  });

  it("does NOT double bye games for odd player counts", () => {
    const players = [
      makePlayer("a", 1600),
      makePlayer("b", 1500),
      makePlayer("c", 1400),
    ];
    const games = generateDoubleSwissPairings(players, [], 1);
    const byeGames = games.filter((g) => g.whiteId === "BYE" || g.blackId === "BYE");
    // Bye should appear exactly once
    expect(byeGames).toHaveLength(1);
    // The paired board should have 2 games
    const nonByeGames = games.filter((g) => g.whiteId !== "BYE" && g.blackId !== "BYE");
    expect(nonByeGames).toHaveLength(2);
  });

  it("game IDs end with 'a' and 'b' to distinguish the two games", () => {
    const players = [makePlayer("a", 1600), makePlayer("b", 1500)];
    const games = generateDoubleSwissPairings(players, [], 1);
    const gA = games.find((g) => g.gameIndex === 0)!;
    const gB = games.find((g) => g.gameIndex === 1)!;
    expect(gA.id.endsWith("a")).toBe(true);
    expect(gB.id.endsWith("b")).toBe(true);
  });

  it("produces the correct total game count for 6 players (3 boards × 2 games)", () => {
    const players = [
      makePlayer("a", 1600),
      makePlayer("b", 1550),
      makePlayer("c", 1500),
      makePlayer("d", 1450),
      makePlayer("e", 1400),
      makePlayer("f", 1350),
    ];
    const games = generateDoubleSwissPairings(players, [], 1);
    expect(games).toHaveLength(6);
  });
});
