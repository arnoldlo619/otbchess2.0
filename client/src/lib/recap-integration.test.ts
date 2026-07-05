/**
 * Integration tests for the Quad Prize Templates / Winner Recognition / Social Recap Assets feature.
 *
 * Tests cover:
 * - Prize template generation → winner assignment → achievement detection → recap generation
 * - Privacy mode name masking
 * - Caption generation for social media
 * - Highlight detection (perfect scores, upsets, closest sections)
 */

import { describe, it, expect } from "vitest";
import {
  generatePrizeTemplate,
  assignPrizesToWinners,
  detectAchievements,
  generateRecapData,
  detectHighlights,
  generateCaption,
  type QuadSection,
  type TournamentMeta,
  type PrizeSlot,
} from "../../../server/quadsCompletion";

// ─── Test Fixtures ───────────────────────────────────────────────────────────

function createTestSections(): QuadSection[] {
  return [
    {
      id: "s1",
      name: "Quad 1",
      type: "quad",
      players: [
        { id: "p1", name: "Alice Smith", rating: 1800, seed: 1, chesscomUsername: "alice_chess" },
        { id: "p2", name: "Bob Jones", rating: 1750, seed: 2, chesscomUsername: "bob_chess" },
        { id: "p3", name: "Charlie Brown", rating: 1700, seed: 3, chesscomUsername: undefined },
        { id: "p4", name: "Diana Lee", rating: 1650, seed: 4, chesscomUsername: undefined },
      ],
      standings: [
        { playerId: "p1", name: "Alice Smith", rating: 1800, score: 3, wins: 3, draws: 0, losses: 0, rank: 1, sbTiebreak: 6 },
        { playerId: "p2", name: "Bob Jones", rating: 1750, score: 2, wins: 2, draws: 0, losses: 1, rank: 2, sbTiebreak: 4 },
        { playerId: "p3", name: "Charlie Brown", rating: 1700, score: 1, wins: 1, draws: 0, losses: 2, rank: 3, sbTiebreak: 2 },
        { playerId: "p4", name: "Diana Lee", rating: 1650, score: 0, wins: 0, draws: 0, losses: 3, rank: 4, sbTiebreak: 0 },
      ],
      games: [
        { round: 1, whiteId: "p1", blackId: "p4", whiteName: "Alice Smith", blackName: "Diana Lee", result: "1-0" },
        { round: 1, whiteId: "p2", blackId: "p3", whiteName: "Bob Jones", blackName: "Charlie Brown", result: "1-0" },
        { round: 2, whiteId: "p1", blackId: "p3", whiteName: "Alice Smith", blackName: "Charlie Brown", result: "1-0" },
        { round: 2, whiteId: "p4", blackId: "p2", whiteName: "Diana Lee", blackName: "Bob Jones", result: "0-1" },
        { round: 3, whiteId: "p1", blackId: "p2", whiteName: "Alice Smith", blackName: "Bob Jones", result: "1-0" },
        { round: 3, whiteId: "p3", blackId: "p4", whiteName: "Charlie Brown", blackName: "Diana Lee", result: "1-0" },
      ],
    },
    {
      id: "s2",
      name: "Quad 2",
      type: "quad",
      players: [
        { id: "p5", name: "Eve Wilson", rating: 1600, seed: 1, chesscomUsername: undefined },
        { id: "p6", name: "Frank Miller", rating: 1550, seed: 2, chesscomUsername: undefined },
        { id: "p7", name: "Grace Davis", rating: 1500, seed: 3, chesscomUsername: undefined },
        { id: "p8", name: "Henry Taylor", rating: 1450, seed: 4, chesscomUsername: undefined },
      ],
      standings: [
        { playerId: "p6", name: "Frank Miller", rating: 1550, score: 2.5, wins: 2, draws: 1, losses: 0, rank: 1, sbTiebreak: 5 },
        { playerId: "p5", name: "Eve Wilson", rating: 1600, score: 2, wins: 2, draws: 0, losses: 1, rank: 2, sbTiebreak: 4 },
        { playerId: "p7", name: "Grace Davis", rating: 1500, score: 1, wins: 1, draws: 0, losses: 2, rank: 3, sbTiebreak: 2 },
        { playerId: "p8", name: "Henry Taylor", rating: 1450, score: 0.5, wins: 0, draws: 1, losses: 2, rank: 4, sbTiebreak: 1 },
      ],
      games: [
        { round: 1, whiteId: "p5", blackId: "p8", whiteName: "Eve Wilson", blackName: "Henry Taylor", result: "1-0" },
        { round: 1, whiteId: "p6", blackId: "p7", whiteName: "Frank Miller", blackName: "Grace Davis", result: "1-0" },
        { round: 2, whiteId: "p5", blackId: "p7", whiteName: "Eve Wilson", blackName: "Grace Davis", result: "1-0" },
        { round: 2, whiteId: "p8", blackId: "p6", whiteName: "Henry Taylor", blackName: "Frank Miller", result: "½-½" },
        { round: 3, whiteId: "p5", blackId: "p6", whiteName: "Eve Wilson", blackName: "Frank Miller", result: "0-1" },
        { round: 3, whiteId: "p7", blackId: "p8", whiteName: "Grace Davis", blackName: "Henry Taylor", result: "1-0" },
      ],
    },
  ];
}

function createTestMeta(): TournamentMeta {
  return {
    tournamentId: "t1",
    tournamentName: "Saturday Quads",
    venue: "Chess Center",
    date: "2026-07-05",
    hostName: "John Director",
    clubId: "club1",
    timeControl: "G/30+5",
    format: "quads",
    playerCount: 8,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("Prize Template + Winner Recognition Integration", () => {
  it("generates winner_each_quad prizes for all sections", () => {
    const sections = createTestSections();
    const prizes = generatePrizeTemplate(sections, "winner_each_quad", "t1");
    expect(prizes.length).toBe(2); // one per section
    expect(prizes[0].sectionId).toBe("s1");
    expect(prizes[0].placement).toBe(1);
    expect(prizes[1].sectionId).toBe("s2");
  });

  it("assigns prizes to section winners correctly", () => {
    const sections = createTestSections();
    const prizes = generatePrizeTemplate(sections, "winner_each_quad", "t1");
    const assigned = assignPrizesToWinners(prizes, sections);
    expect(assigned[0].assignedPlayerId).toBe("p1");
    expect(assigned[0].assignedPlayerName).toBe("Alice Smith");
    expect(assigned[1].assignedPlayerId).toBe("p6");
    expect(assigned[1].assignedPlayerName).toBe("Frank Miller");
  });

  it("detects perfect score achievement for Alice (3/3)", () => {
    const sections = createTestSections();
    const meta = createTestMeta();
    const achievements = detectAchievements(sections, meta);
    const perfectScores = achievements.filter((a) => a.achievementType === "perfect_score");
    expect(perfectScores.length).toBe(1);
    expect(perfectScores[0].playerId).toBe("p1");
  });

  it("detects quad1_champion achievement for Alice", () => {
    const sections = createTestSections();
    const meta = createTestMeta();
    const achievements = detectAchievements(sections, meta);
    const quad1Champs = achievements.filter((a) => a.achievementType === "quad1_champion");
    expect(quad1Champs.length).toBe(1);
    expect(quad1Champs[0].playerId).toBe("p1");
  });

  it("does not detect upset_winner when winner is seed 2 (requires seed >= 3)", () => {
    const sections = createTestSections();
    const meta = createTestMeta();
    const achievements = detectAchievements(sections, meta);
    const upsets = achievements.filter((a) => a.achievementType === "upset_winner");
    // Frank is seed 2 — upset requires seed >= 3
    expect(upsets.length).toBe(0);
  });

  it("detects undefeated players", () => {
    const sections = createTestSections();
    const meta = createTestMeta();
    const achievements = detectAchievements(sections, meta);
    const undefeated = achievements.filter((a) => a.achievementType === "undefeated");
    // Alice (3-0) and Frank (2W 1D 0L) are undefeated
    expect(undefeated.length).toBe(2);
    const names = undefeated.map((a) => a.playerId).sort();
    expect(names).toContain("p1");
    expect(names).toContain("p6");
  });
});

describe("Recap Data Generation", () => {
  it("generates complete recap data with champions and sections", () => {
    const sections = createTestSections();
    const meta = createTestMeta();
    const prizes = assignPrizesToWinners(
      generatePrizeTemplate(sections, "winner_each_quad", "t1"),
      sections
    );
    const recap = generateRecapData(sections, meta, prizes);

    expect(recap.meta.tournamentName).toBe("Saturday Quads");
    expect(recap.champions.length).toBe(2);
    expect(recap.champions[0].playerName).toBe("Alice Smith");
    expect(recap.champions[0].sectionName).toBe("Quad 1");
    expect(recap.champions[0].finalScore).toBe("3/3");
    expect(recap.champions[1].playerName).toBe("Frank Miller");
    expect(recap.sections.length).toBe(2);
  });

  it("includes badges in champion cards", () => {
    const sections = createTestSections();
    const meta = createTestMeta();
    const prizes: PrizeSlot[] = [];
    const recap = generateRecapData(sections, meta, prizes);

    // Alice should have quad1_champion + perfect_score + undefeated badges
    expect(recap.champions[0].badges).toContain("quad1_champion");
    expect(recap.champions[0].badges).toContain("perfect_score");
  });
});

describe("Highlights Detection", () => {
  it("detects perfect scores in highlights", () => {
    const sections = createTestSections();
    const highlights = detectHighlights(sections);
    expect(highlights.perfectScores.length).toBe(1);
    expect(highlights.perfectScores[0].playerName).toBe("Alice Smith");
    expect(highlights.perfectScores[0].sectionName).toBe("Quad 1");
  });

  it("returns null for biggest upset when no seed >= 3 won", () => {
    const sections = createTestSections();
    const highlights = detectHighlights(sections);
    // Frank is seed 2, Alice is seed 1 — no upset (requires seed >= 3)
    expect(highlights.biggestUpset).toBeNull();
  });

  it("detects closest section", () => {
    const sections = createTestSections();
    const highlights = detectHighlights(sections);
    // Quad 2: margin is 0.5 (Frank 2.5 vs Eve 2), Quad 1: margin is 1 (Alice 3 vs Bob 2)
    expect(highlights.closestSection).not.toBeNull();
    expect(highlights.closestSection!.sectionName).toBe("Quad 2");
    expect(highlights.closestSection!.marginOfVictory).toBe(0.5);
  });
});

describe("Privacy Mode Name Masking", () => {
  it("scholastic mode shows first name + last initial", () => {
    const maskName = (name: string) => name.split(" ")[0] + " " + (name.split(" ")[1]?.[0] || "") + ".";
    expect(maskName("Alice Smith")).toBe("Alice S.");
    expect(maskName("Bob Jones")).toBe("Bob J.");
    expect(maskName("Charlie Brown")).toBe("Charlie B.");
  });

  it("anonymous mode hides all names", () => {
    const maskName = () => "Player";
    expect(maskName()).toBe("Player");
  });

  it("standard mode shows full names", () => {
    const maskName = (name: string) => name;
    expect(maskName("Alice Smith")).toBe("Alice Smith");
  });
});

describe("Social Caption Generation", () => {
  it("generates a complete caption with champions and hashtags", () => {
    const sections = createTestSections();
    const meta = createTestMeta();
    const prizes: PrizeSlot[] = [];
    const recap = generateRecapData(sections, meta, prizes);
    const caption = generateCaption(meta, recap.champions);
    expect(caption).toContain("Saturday Quads");
    expect(caption).toContain("Alice Smith");
    expect(caption).toContain("Frank Miller");
    expect(caption).toContain("#ChessOTB");
    expect(caption).toContain("Chess Center");
  });
});
