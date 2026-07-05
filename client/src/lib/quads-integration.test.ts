/**
 * Integration tests for Quads Tournament Mode
 * Tests the full flow: generation → pairing → result entry → standings → swap
 */
import { describe, it, expect } from "vitest";
import type { Player, Result } from "./tournamentData";
import {
  generateQuadTournament,
  calculateQuadStandings,
  swapPlayersBetweenSections,
  movePlayerToSection,
  formatRatingRange,
  getSectionWinners,
  validateQuadIntegrity,
  DEFAULT_QUAD_SETTINGS,
  type QuadSection,
  type QuadSettings,
} from "./quads";

// ─── Test Fixtures ───────────────────────────────────────────────────────────

function makePlayers(count: number): Player[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `p${i + 1}`,
    name: `Player ${i + 1}`,
    username: `player${i + 1}`,
    elo: 2000 - i * 50,
    rapidElo: 2000 - i * 50,
    blitzElo: 1900 - i * 40,
  }));
}

// ─── Full Tournament Flow ────────────────────────────────────────────────────

describe("Quads Integration: Full Tournament Flow", () => {
  it("generates a complete 8-player tournament with 2 quads", () => {
    const players = makePlayers(8);
    const result = generateQuadTournament(players, DEFAULT_QUAD_SETTINGS);

    expect(result.sections).toHaveLength(2);
    expect(result.sections[0].type).toBe("quad");
    expect(result.sections[1].type).toBe("quad");
    expect(result.games).toHaveLength(12); // 6 games per quad × 2 quads
    expect(result.sections[0].playerIds).toHaveLength(4);
    expect(result.sections[1].playerIds).toHaveLength(4);

    // Verify top-rated players are in section 1
    const sec1Ratings = result.sections[0].playerIds.map(
      (id) => players.find((p) => p.id === id)!.elo!
    );
    const sec2Ratings = result.sections[1].playerIds.map(
      (id) => players.find((p) => p.id === id)!.elo!
    );
    expect(Math.min(...sec1Ratings)).toBeGreaterThanOrEqual(Math.max(...sec2Ratings));
  });

  it("handles 9 players with bottom swiss remainder", () => {
    const players = makePlayers(9);
    const result = generateQuadTournament(players, DEFAULT_QUAD_SETTINGS);

    // Should have at least one bottom_swiss section
    const bottomSwiss = result.sections.filter((s) => s.type === "bottom_swiss");
    expect(bottomSwiss.length).toBeGreaterThanOrEqual(1);

    // All players should be assigned
    const allAssigned = result.sections.flatMap((s) => s.playerIds);
    expect(allAssigned).toHaveLength(9);
    expect(new Set(allAssigned).size).toBe(9);
  });

  it("handles 5 players with bottom swiss (all in one section)", () => {
    const players = makePlayers(5);
    const result = generateQuadTournament(players, DEFAULT_QUAD_SETTINGS);

    const allAssigned = result.sections.flatMap((s) => s.playerIds);
    expect(allAssigned).toHaveLength(5);
    expect(new Set(allAssigned).size).toBe(5);
  });

  it("calculates standings correctly after full results", () => {
    const players = makePlayers(4);
    const result = generateQuadTournament(players, DEFAULT_QUAD_SETTINGS);
    const section = result.sections[0];
    const games = result.games.map((g) => ({ ...g }));

    // Simulate results: p1 wins all, p2 wins 2, p3 wins 1, p4 loses all
    const results: Record<string, Result> = {};
    for (const game of games) {
      if (game.sectionId === section.id) {
        // Higher-rated player wins
        const whiteRating = players.find((p) => p.id === game.whiteId)!.elo!;
        const blackRating = players.find((p) => p.id === game.blackId)!.elo!;
        results[game.id] = whiteRating > blackRating ? "1-0" : "0-1";
        game.result = results[game.id];
      }
    }

    const standings = calculateQuadStandings(section, games, players);
    expect(standings).toHaveLength(4);
    expect(standings[0].playerId).toBe("p1"); // Highest rated wins all
    expect(standings[0].score).toBe(3);
    expect(standings[3].playerId).toBe("p4"); // Lowest rated loses all
    expect(standings[3].score).toBe(0);
  });

  it("getSectionWinners returns correct winner", () => {
    const players = makePlayers(4);
    const result = generateQuadTournament(players, DEFAULT_QUAD_SETTINGS);
    const section = result.sections[0];
    const games = result.games.map((g) => ({ ...g }));

    // p1 wins all
    for (const game of games) {
      if (game.sectionId === section.id) {
        const whiteRating = players.find((p) => p.id === game.whiteId)!.elo!;
        const blackRating = players.find((p) => p.id === game.blackId)!.elo!;
        game.result = whiteRating > blackRating ? "1-0" : "0-1";
      }
    }

    const standings = calculateQuadStandings(section, games, players);
    const winners = getSectionWinners(standings);
    expect(winners).toHaveLength(1);
    expect(winners[0].playerId).toBe("p1");
  });
});

// ─── Swap Players ────────────────────────────────────────────────────────────

describe("Quads Integration: Player Swaps", () => {
  it("swaps two players between sections correctly", () => {
    const players = makePlayers(8);
    const result = generateQuadTournament(players, DEFAULT_QUAD_SETTINGS);

    // Swap p1 (section 1) with p5 (section 2)
    const updated = swapPlayersBetweenSections(
      result.sections,
      "p1",
      "p5",
      players,
      DEFAULT_QUAD_SETTINGS
    );

    // p5 should now be in section 1, p1 in section 2
    expect(updated[0].playerIds).toContain("p5");
    expect(updated[0].playerIds).not.toContain("p1");
    expect(updated[1].playerIds).toContain("p1");
    expect(updated[1].playerIds).not.toContain("p5");
  });

  it("returns unchanged sections when swapping within same section", () => {
    const players = makePlayers(8);
    const result = generateQuadTournament(players, DEFAULT_QUAD_SETTINGS);

    // Try to swap p1 and p2 (both in section 1)
    const updated = swapPlayersBetweenSections(
      result.sections,
      "p1",
      "p2",
      players,
      DEFAULT_QUAD_SETTINGS
    );

    // Should be unchanged
    expect(updated).toEqual(result.sections);
  });

  it("movePlayerToSection moves a player correctly", () => {
    const players = makePlayers(8);
    const result = generateQuadTournament(players, DEFAULT_QUAD_SETTINGS);
    const targetSectionId = result.sections[1].id;

    const updated = movePlayerToSection(
      result.sections,
      "p1",
      targetSectionId,
      players,
      DEFAULT_QUAD_SETTINGS
    );

    expect(updated[0].playerIds).not.toContain("p1");
    expect(updated[0].playerIds).toHaveLength(3);
    expect(updated[1].playerIds).toContain("p1");
    expect(updated[1].playerIds).toHaveLength(5);
  });

  it("rebuilds section metadata after swap (rating range, seeds)", () => {
    const players = makePlayers(8);
    const result = generateQuadTournament(players, DEFAULT_QUAD_SETTINGS);

    const updated = swapPlayersBetweenSections(
      result.sections,
      "p1",
      "p5",
      players,
      DEFAULT_QUAD_SETTINGS
    );

    // Section 1 now has p2,p3,p4,p5 — ratings 1950,1900,1850,1800
    expect(updated[0].ratingMax).toBe(1950);
    expect(updated[0].ratingMin).toBe(1800);

    // Section 2 now has p1,p6,p7,p8 — ratings 2000,1750,1700,1650
    expect(updated[1].ratingMax).toBe(2000);
    expect(updated[1].ratingMin).toBe(1650);
  });
});

// ─── Validation ──────────────────────────────────────────────────────────────

describe("Quads Integration: Validation", () => {
  it("validates a correctly generated tournament", () => {
    const players = makePlayers(8);
    const result = generateQuadTournament(players, DEFAULT_QUAD_SETTINGS);
    const validation = validateQuadIntegrity(result.sections, result.games);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  it("validates a 12-player tournament", () => {
    const players = makePlayers(12);
    const result = generateQuadTournament(players, DEFAULT_QUAD_SETTINGS);
    const validation = validateQuadIntegrity(result.sections, result.games);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  it("validates a 9-player tournament with bottom swiss", () => {
    const players = makePlayers(9);
    const result = generateQuadTournament(players, DEFAULT_QUAD_SETTINGS);
    const validation = validateQuadIntegrity(result.sections, result.games);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  it("formatRatingRange returns correct string", () => {
    const section: QuadSection = {
      id: "test",
      name: "Test",
      type: "quad",
      orderIndex: 0,
      ratingMin: 1800,
      ratingMax: 2000,
      playerIds: [],
      localSeeds: {},
      status: "pending",
    };
    expect(formatRatingRange(section)).toBe("1800–2000");
  });
});
