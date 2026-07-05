import { describe, it, expect } from "vitest";
import {
  generatePrizeTemplate,
  assignPrizesToWinners,
  detectAchievements,
  generateRecapData,
  detectHighlights,
  generateCaption,
  generateSponsorCaption,
  generateRecapSlug,
  type QuadSection,
  type TournamentMeta,
  type PrizeSlot,
} from "./quadsCompletion";

// ─── Test Fixtures ───────────────────────────────────────────────────────────

function makeSections(): QuadSection[] {
  return [
    {
      id: "sec-1",
      name: "Quad 1",
      type: "quad",
      players: [
        { id: "p1", name: "Alice", rating: 1800, seed: 1 },
        { id: "p2", name: "Bob", rating: 1750, seed: 2 },
        { id: "p3", name: "Charlie", rating: 1700, seed: 3 },
        { id: "p4", name: "Diana", rating: 1650, seed: 4 },
      ],
      standings: [
        { playerId: "p1", name: "Alice", rating: 1800, score: 3, wins: 3, draws: 0, losses: 0, rank: 1, tiebreak: 6 },
        { playerId: "p2", name: "Bob", rating: 1750, score: 2, wins: 2, draws: 0, losses: 1, rank: 2, tiebreak: 4 },
        { playerId: "p3", name: "Charlie", rating: 1700, score: 1, wins: 1, draws: 0, losses: 2, rank: 3, tiebreak: 2 },
        { playerId: "p4", name: "Diana", rating: 1650, score: 0, wins: 0, draws: 0, losses: 3, rank: 4, tiebreak: 0 },
      ],
      games: [
        { id: "g1", round: 1, whiteId: "p1", blackId: "p4", result: "1-0", sectionId: "sec-1" },
        { id: "g2", round: 1, whiteId: "p2", blackId: "p3", result: "1-0", sectionId: "sec-1" },
        { id: "g3", round: 2, whiteId: "p3", blackId: "p1", result: "0-1", sectionId: "sec-1" },
        { id: "g4", round: 2, whiteId: "p4", blackId: "p2", result: "0-1", sectionId: "sec-1" },
        { id: "g5", round: 3, whiteId: "p1", blackId: "p2", result: "1-0", sectionId: "sec-1" },
        { id: "g6", round: 3, whiteId: "p3", blackId: "p4", result: "1-0", sectionId: "sec-1" },
      ],
    },
    {
      id: "sec-2",
      name: "Quad 2",
      type: "quad",
      players: [
        { id: "p5", name: "Eve", rating: 1600, seed: 1 },
        { id: "p6", name: "Frank", rating: 1550, seed: 2 },
        { id: "p7", name: "Grace", rating: 1500, seed: 3 },
        { id: "p8", name: "Hank", rating: 1450, seed: 4, chesscomUsername: "hank_chess" },
      ],
      standings: [
        { playerId: "p8", name: "Hank", rating: 1450, score: 2.5, wins: 2, draws: 1, losses: 0, rank: 1, tiebreak: 5 },
        { playerId: "p5", name: "Eve", rating: 1600, score: 2, wins: 2, draws: 0, losses: 1, rank: 2, tiebreak: 4 },
        { playerId: "p6", name: "Frank", rating: 1550, score: 1, wins: 1, draws: 0, losses: 2, rank: 3, tiebreak: 2 },
        { playerId: "p7", name: "Grace", rating: 1500, score: 0.5, wins: 0, draws: 1, losses: 2, rank: 4, tiebreak: 1 },
      ],
      games: [
        { id: "g7", round: 1, whiteId: "p5", blackId: "p8", result: "0-1", sectionId: "sec-2" },
        { id: "g8", round: 1, whiteId: "p6", blackId: "p7", result: "1-0", sectionId: "sec-2" },
        { id: "g9", round: 2, whiteId: "p7", blackId: "p5", result: "0-1", sectionId: "sec-2" },
        { id: "g10", round: 2, whiteId: "p8", blackId: "p6", result: "1-0", sectionId: "sec-2" },
        { id: "g11", round: 3, whiteId: "p5", blackId: "p6", result: "1-0", sectionId: "sec-2" },
        { id: "g12", round: 3, whiteId: "p7", blackId: "p8", result: "1/2-1/2", sectionId: "sec-2" },
      ],
    },
  ];
}

function makeMeta(): TournamentMeta {
  return {
    tournamentId: "t-001",
    tournamentName: "Weekly Quads Night",
    venue: "Marshall Chess Club",
    date: "2026-07-01",
    hostName: "Arnold",
    hostId: "host-1",
    clubId: "club-1",
    timeControl: "G/25+5",
    format: "quads",
    playerCount: 8,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PRIZE TEMPLATE TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe("Prize Templates", () => {
  const sections = makeSections();

  it("winner_each_quad generates one prize per section", () => {
    const prizes = generatePrizeTemplate(sections, "winner_each_quad", "t-001");
    expect(prizes).toHaveLength(2);
    expect(prizes[0].sectionName).toBe("Quad 1");
    expect(prizes[1].sectionName).toBe("Quad 2");
    expect(prizes[0].placement).toBe(1);
    expect(prizes[0].status).toBe("pending");
  });

  it("top_section_weighted gives higher value to first section", () => {
    const prizes = generatePrizeTemplate(sections, "top_section_weighted", "t-001");
    expect(prizes).toHaveLength(2);
    expect(prizes[0].prizeValue).toBe("$40");
    expect(prizes[1].prizeValue).toBe("$25");
  });

  it("every_section_equal generates one prize per section", () => {
    const prizes = generatePrizeTemplate(sections, "every_section_equal", "t-001");
    expect(prizes).toHaveLength(2);
    expect(prizes[0].prizeType).toBe("cash");
    expect(prizes[1].prizeType).toBe("cash");
  });

  it("quad1_podium_plus_winners gives podium to first section", () => {
    const prizes = generatePrizeTemplate(sections, "quad1_podium_plus_winners", "t-001");
    expect(prizes).toHaveLength(4); // 3 for quad 1 + 1 for quad 2
    expect(prizes[0].placement).toBe(1);
    expect(prizes[1].placement).toBe(2);
    expect(prizes[2].placement).toBe(3);
    expect(prizes[3].placement).toBe(1);
  });

  it("custom returns empty array", () => {
    const prizes = generatePrizeTemplate(sections, "custom", "t-001");
    expect(prizes).toHaveLength(0);
  });
});

describe("Prize Assignment", () => {
  it("assigns prizes to winners based on standings", () => {
    const sections = makeSections();
    const prizes = generatePrizeTemplate(sections, "winner_each_quad", "t-001");
    const assigned = assignPrizesToWinners(prizes, sections);

    expect(assigned[0].assignedPlayerId).toBe("p1");
    expect(assigned[0].assignedPlayerName).toBe("Alice");
    expect(assigned[0].status).toBe("assigned");
    expect(assigned[1].assignedPlayerId).toBe("p8");
    expect(assigned[1].assignedPlayerName).toBe("Hank");
  });

  it("does not reassign already-assigned prizes", () => {
    const sections = makeSections();
    const prizes: PrizeSlot[] = [{
      id: "existing",
      sectionId: "sec-1",
      sectionName: "Quad 1",
      placement: 1,
      prizeTitle: "Champion",
      prizeType: "cash",
      prizeValue: "$50",
      assignedPlayerId: "manual-override",
      assignedPlayerName: "Manual Player",
      status: "assigned",
      templateType: "winner_each_quad",
    }];
    const assigned = assignPrizesToWinners(prizes, sections);
    expect(assigned[0].assignedPlayerId).toBe("manual-override");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ACHIEVEMENT DETECTION TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe("Achievement Detection", () => {
  const sections = makeSections();
  const meta = makeMeta();

  it("detects quad_champion for each section winner", () => {
    const achievements = detectAchievements(sections, meta);
    const champions = achievements.filter((a) => a.achievementType === "quad_champion");
    expect(champions).toHaveLength(2);
    expect(champions[0].playerName).toBe("Alice");
    expect(champions[1].playerName).toBe("Hank");
  });

  it("detects quad1_champion for top section winner", () => {
    const achievements = detectAchievements(sections, meta);
    const quad1Champ = achievements.find((a) => a.achievementType === "quad1_champion");
    expect(quad1Champ).toBeDefined();
    expect(quad1Champ!.playerName).toBe("Alice");
  });

  it("detects perfect_score when player wins all games", () => {
    const achievements = detectAchievements(sections, meta);
    const perfect = achievements.filter((a) => a.achievementType === "perfect_score");
    expect(perfect).toHaveLength(1);
    expect(perfect[0].playerName).toBe("Alice");
  });

  it("detects undefeated players", () => {
    const achievements = detectAchievements(sections, meta);
    const undefeated = achievements.filter((a) => a.achievementType === "undefeated");
    // Alice (3W 0D 0L) and Hank (2W 1D 0L)
    expect(undefeated).toHaveLength(2);
    const names = undefeated.map((a) => a.playerName).sort();
    expect(names).toEqual(["Alice", "Hank"]);
  });

  it("detects upset_winner when low seed wins", () => {
    const achievements = detectAchievements(sections, meta);
    const upsets = achievements.filter((a) => a.achievementType === "upset_winner");
    expect(upsets).toHaveLength(1);
    expect(upsets[0].playerName).toBe("Hank");
    expect(upsets[0].description).toContain("#4 seed");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// RECAP GENERATION TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe("Recap Generation", () => {
  const sections = makeSections();
  const meta = makeMeta();

  it("generates full recap data with champions and sections", () => {
    const prizes = assignPrizesToWinners(
      generatePrizeTemplate(sections, "winner_each_quad", "t-001"),
      sections
    );
    const recap = generateRecapData(sections, meta, prizes);

    expect(recap.meta).toEqual(meta);
    expect(recap.champions).toHaveLength(2);
    expect(recap.sections).toHaveLength(2);
    expect(recap.champions[0].playerName).toBe("Alice");
    expect(recap.champions[0].finalScore).toBe("3/3");
    expect(recap.champions[1].playerName).toBe("Hank");
  });

  it("includes badges in champion cards", () => {
    const prizes = assignPrizesToWinners(
      generatePrizeTemplate(sections, "winner_each_quad", "t-001"),
      sections
    );
    const recap = generateRecapData(sections, meta, prizes);

    // Alice should have quad_champion, quad1_champion, perfect_score, undefeated
    expect(recap.champions[0].badges).toContain("quad_champion");
    expect(recap.champions[0].badges).toContain("quad1_champion");
    expect(recap.champions[0].badges).toContain("perfect_score");
    expect(recap.champions[0].badges).toContain("undefeated");
  });

  it("includes chesscomUsername in champion cards when available", () => {
    const prizes = assignPrizesToWinners(
      generatePrizeTemplate(sections, "winner_each_quad", "t-001"),
      sections
    );
    const recap = generateRecapData(sections, meta, prizes);
    expect(recap.champions[1].chesscomUsername).toBe("hank_chess");
  });
});

describe("Highlights Detection", () => {
  const sections = makeSections();

  it("detects perfect scores", () => {
    const highlights = detectHighlights(sections);
    expect(highlights.perfectScores).toHaveLength(1);
    expect(highlights.perfectScores[0].playerName).toBe("Alice");
  });

  it("detects biggest upset", () => {
    const highlights = detectHighlights(sections);
    expect(highlights.biggestUpset).not.toBeNull();
    expect(highlights.biggestUpset!.playerName).toBe("Hank");
    expect(highlights.biggestUpset!.seed).toBe(4);
  });

  it("detects closest section", () => {
    const highlights = detectHighlights(sections);
    expect(highlights.closestSection).not.toBeNull();
    // Quad 2: 2.5 - 2 = 0.5 margin; Quad 1: 3 - 2 = 1 margin
    expect(highlights.closestSection!.sectionName).toBe("Quad 2");
    expect(highlights.closestSection!.marginOfVictory).toBe(0.5);
  });

  it("detects most competitive section by draw percentage", () => {
    const highlights = detectHighlights(sections);
    expect(highlights.mostCompetitiveSection).not.toBeNull();
    // Quad 2 has 1 draw out of 6 games = 16.7%; Quad 1 has 0 draws
    expect(highlights.mostCompetitiveSection!.sectionName).toBe("Quad 2");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CAPTION GENERATION TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe("Caption Generation", () => {
  const meta = makeMeta();

  it("generates a social media caption with champions", () => {
    const champions = [
      { playerId: "p1", playerName: "Alice", rating: 1800, sectionName: "Quad 1", sectionId: "sec-1", finalScore: "3/3", badges: [] as any[] },
      { playerId: "p8", playerName: "Hank", rating: 1450, sectionName: "Quad 2", sectionId: "sec-2", finalScore: "2.5/3", badges: [] as any[] },
    ];
    const caption = generateCaption(meta, champions, "https://chessotb.club/recap/weekly-quads");

    expect(caption).toContain("Alice");
    expect(caption).toContain("Hank");
    expect(caption).toContain("Quad 1");
    expect(caption).toContain("3/3");
    expect(caption).toContain("Marshall Chess Club");
    expect(caption).toContain("#ChessOTB");
    expect(caption).toContain("https://chessotb.club/recap/weekly-quads");
  });

  it("generates sponsor caption", () => {
    const caption = generateSponsorCaption(meta, ["ChessBase", "DGT"]);
    expect(caption).toContain("ChessBase");
    expect(caption).toContain("DGT");
    expect(caption).toContain("#SupportLocalChess");
  });

  it("returns empty string for no sponsors", () => {
    expect(generateSponsorCaption(meta, [])).toBe("");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SLUG GENERATION TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe("Slug Generation", () => {
  it("generates URL-safe slug from tournament name", () => {
    const slug = generateRecapSlug("Weekly Quads Night", "2026-07-01");
    expect(slug).toBe("weekly-quads-night-2026-07-01");
  });

  it("handles special characters", () => {
    const slug = generateRecapSlug("St. Louis Chess Club — Summer Quads!", "2026-07-04");
    expect(slug).toMatch(/^st-louis-chess-club-summer-quads-2026-07-04$/);
  });

  it("truncates long names", () => {
    const longName = "A".repeat(100);
    const slug = generateRecapSlug(longName, "2026-07-01");
    expect(slug.length).toBeLessThanOrEqual(91); // 80 + dash + date
  });

  it("adds nanoid suffix when no date provided", () => {
    const slug = generateRecapSlug("Quick Quads");
    expect(slug).toMatch(/^quick-quads-.{6}$/); // dash + 6 char nanoid
  });
});
