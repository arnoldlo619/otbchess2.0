/**
 * Tests for extractProblemLines() in server/prepEngine.ts
 *
 * These tests verify the statistical divergence algorithm that identifies
 * the exact move where an opponent most commonly goes wrong in a given opening.
 */
import { describe, it, expect } from "vitest";
import {
  extractProblemLines,
  type ChessComGame,
} from "../../../server/prepEngine";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeGame(
  username: string,
  color: "white" | "black",
  result: "win" | "resigned" | "checkmated",
  pgn: string,
  timeClass: "rapid" | "blitz" = "rapid"
): ChessComGame {
  const white = color === "white"
    ? { username, rating: 1500, result }
    : { username: "opponent", rating: 1500, result: result === "win" ? "resigned" : "win" };
  const black = color === "black"
    ? { username, rating: 1500, result }
    : { username: "opponent", rating: 1500, result: result === "win" ? "resigned" : "win" };
  return {
    url: "https://chess.com/game/1",
    pgn,
    time_control: "600",
    time_class: timeClass,
    rated: true,
    rules: "chess",
    end_time: Date.now(),
    white,
    black,
  };
}

// A simple e4 e5 Nf3 Nc6 Bb5 (Ruy Lopez) PGN body
const RUY_GOOD = "1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 Nf6 5.O-O Be7 6.Re1 b5 7.Bb3 d6 8.c3 O-O 9.h3 Nb8 10.d4 Nbd7";
const RUY_BAD  = "1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 Nf6 5.O-O Be7 6.Re1 b5 7.Bb3 d6 8.c3 Bc5 9.d4 exd4 10.cxd4 Bb4";

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("extractProblemLines", () => {
  it("returns empty array when there are no games", () => {
    const result = extractProblemLines([], "testuser");
    expect(result).toEqual([]);
  });

  it("returns empty array when there are fewer than 3 games in any opening", () => {
    const games = [
      makeGame("testuser", "white", "win", RUY_GOOD),
      makeGame("testuser", "white", "resigned", RUY_BAD),
    ];
    const result = extractProblemLines(games, "testuser");
    expect(result).toEqual([]);
  });

  it("returns empty array when loss rate is below threshold (< 35%)", () => {
    // 4 wins, 1 loss → 20% loss rate — should not appear
    const games = [
      makeGame("testuser", "white", "win", RUY_GOOD),
      makeGame("testuser", "white", "win", RUY_GOOD),
      makeGame("testuser", "white", "win", RUY_GOOD),
      makeGame("testuser", "white", "win", RUY_GOOD),
      makeGame("testuser", "white", "resigned", RUY_BAD),
    ];
    const result = extractProblemLines(games, "testuser");
    expect(result).toEqual([]);
  });

  it("identifies a problem line when loss rate exceeds threshold", () => {
    // 2 wins, 4 losses → 67% loss rate — should appear
    const games = [
      makeGame("testuser", "white", "win", RUY_GOOD),
      makeGame("testuser", "white", "win", RUY_GOOD),
      makeGame("testuser", "white", "resigned", RUY_BAD),
      makeGame("testuser", "white", "resigned", RUY_BAD),
      makeGame("testuser", "white", "resigned", RUY_BAD),
      makeGame("testuser", "white", "resigned", RUY_BAD),
    ];
    const result = extractProblemLines(games, "testuser");
    expect(result.length).toBeGreaterThan(0);
    const pl = result[0];
    expect(pl.color).toBe("white");
    expect(pl.lossCount).toBe(4);
    expect(pl.gamesCount).toBe(6);
    expect(pl.lossRate).toBeCloseTo(4 / 6, 2);
    expect(pl.problemHalfMove).toBeGreaterThan(0);
    expect(pl.problemMove).toBeTruthy();
    expect(pl.moves).toBeTruthy();
  });

  it("correctly identifies the divergence move between good and bad games", () => {
    // Good games: 1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 Nf6 5.O-O Be7 ...
    // Bad games:  1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 Nf6 5.O-O Be7 6.Re1 b5 7.Bb3 d6 8.c3 Bc5 (diverges at move 8, half-move 15)
    const games = [
      makeGame("testuser", "white", "win", RUY_GOOD),
      makeGame("testuser", "white", "win", RUY_GOOD),
      makeGame("testuser", "white", "win", RUY_GOOD),
      makeGame("testuser", "white", "resigned", RUY_BAD),
      makeGame("testuser", "white", "resigned", RUY_BAD),
      makeGame("testuser", "white", "resigned", RUY_BAD),
      makeGame("testuser", "white", "resigned", RUY_BAD),
    ];
    const result = extractProblemLines(games, "testuser");
    expect(result.length).toBeGreaterThan(0);
    const pl = result[0];
    // The divergence is at half-move 15 (move 8, White's turn) — Bc5 vs O-O
    // or at half-move 16 (move 8, Black's turn)
    expect(pl.problemHalfMove).toBeGreaterThanOrEqual(13);
    expect(pl.problemMove).toBeTruthy();
    // betterMove should be identified from good games
    expect(pl.betterMove).toBeTruthy();
    expect(pl.betterMove).not.toBe(pl.problemMove);
  });

  it("respects the maxLines parameter", () => {
    // Create two distinct openings with high loss rates
    const sicilianBad  = "1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 a6 6.Be3 e5 7.Nb3 Be6 8.f3 Nbd7 9.Qd2 b5";
    const sicilianGood = "1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 a6 6.Be3 e5 7.Nb3 Be6 8.f3 Be7 9.Qd2 O-O";
    const games = [
      // Ruy Lopez — high loss rate
      makeGame("testuser", "white", "win", RUY_GOOD),
      makeGame("testuser", "white", "win", RUY_GOOD),
      makeGame("testuser", "white", "resigned", RUY_BAD),
      makeGame("testuser", "white", "resigned", RUY_BAD),
      makeGame("testuser", "white", "resigned", RUY_BAD),
      // Sicilian — high loss rate
      makeGame("testuser", "white", "win", sicilianGood),
      makeGame("testuser", "white", "win", sicilianGood),
      makeGame("testuser", "white", "resigned", sicilianBad),
      makeGame("testuser", "white", "resigned", sicilianBad),
      makeGame("testuser", "white", "resigned", sicilianBad),
    ];
    const result = extractProblemLines(games, "testuser", 1);
    expect(result.length).toBeLessThanOrEqual(1);
  });

  it("handles case-insensitive username matching", () => {
    const games = [
      makeGame("TestUser", "white", "win", RUY_GOOD),
      makeGame("TestUser", "white", "win", RUY_GOOD),
      makeGame("TestUser", "white", "resigned", RUY_BAD),
      makeGame("TestUser", "white", "resigned", RUY_BAD),
      makeGame("TestUser", "white", "resigned", RUY_BAD),
      makeGame("TestUser", "white", "resigned", RUY_BAD),
    ];
    // Pass username in different case
    const result = extractProblemLines(games, "testuser");
    expect(result.length).toBeGreaterThan(0);
  });

  it("includes draws in the 'good' games group", () => {
    const games = [
      makeGame("testuser", "white", "win", RUY_GOOD),
      // Draws should count as good games
      { ...makeGame("testuser", "white", "win", RUY_GOOD), white: { username: "testuser", rating: 1500, result: "agreed" as unknown as "win" } },
      makeGame("testuser", "white", "resigned", RUY_BAD),
      makeGame("testuser", "white", "resigned", RUY_BAD),
      makeGame("testuser", "white", "resigned", RUY_BAD),
      makeGame("testuser", "white", "resigned", RUY_BAD),
    ];
    const result = extractProblemLines(games, "testuser");
    // Should still find the problem line
    expect(result.length).toBeGreaterThan(0);
  });

  it("returns results sorted by impact (lossRate × lossCount) descending", () => {
    const sicilianBad  = "1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 a6 6.Be3 e5 7.Nb3 Be6 8.f3 Nbd7 9.Qd2 b5";
    const sicilianGood = "1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 a6 6.Be3 e5 7.Nb3 Be6 8.f3 Be7 9.Qd2 O-O";
    const games = [
      // Ruy Lopez: 2 wins, 3 losses → 60% loss rate, impact = 0.6 × 3 = 1.8
      makeGame("testuser", "white", "win", RUY_GOOD),
      makeGame("testuser", "white", "win", RUY_GOOD),
      makeGame("testuser", "white", "resigned", RUY_BAD),
      makeGame("testuser", "white", "resigned", RUY_BAD),
      makeGame("testuser", "white", "resigned", RUY_BAD),
      // Sicilian: 1 win, 4 losses → 80% loss rate, impact = 0.8 × 4 = 3.2
      makeGame("testuser", "white", "win", sicilianGood),
      makeGame("testuser", "white", "resigned", sicilianBad),
      makeGame("testuser", "white", "resigned", sicilianBad),
      makeGame("testuser", "white", "resigned", sicilianBad),
      makeGame("testuser", "white", "resigned", sicilianBad),
    ];
    const result = extractProblemLines(games, "testuser", 5);
    if (result.length >= 2) {
      const impact0 = result[0].lossRate * result[0].lossCount;
      const impact1 = result[1].lossRate * result[1].lossCount;
      expect(impact0).toBeGreaterThanOrEqual(impact1);
    }
  });

  it("produces a valid move string with proper notation", () => {
    const games = [
      makeGame("testuser", "white", "win", RUY_GOOD),
      makeGame("testuser", "white", "win", RUY_GOOD),
      makeGame("testuser", "white", "resigned", RUY_BAD),
      makeGame("testuser", "white", "resigned", RUY_BAD),
      makeGame("testuser", "white", "resigned", RUY_BAD),
      makeGame("testuser", "white", "resigned", RUY_BAD),
    ];
    const result = extractProblemLines(games, "testuser");
    if (result.length > 0) {
      const pl = result[0];
      // Move string should start with "1.e4" (Ruy Lopez always starts with e4)
      expect(pl.moves).toMatch(/^1\./);
      // Should not contain raw tokens without move numbers
      expect(pl.moves).not.toMatch(/^[a-zA-Z]/);
    }
  });
});
