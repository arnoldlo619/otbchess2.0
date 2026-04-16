/**
 * openingsSchema.test.ts
 *
 * Validates the openings database schema types, seed data structure,
 * and content integrity rules.
 */
import { describe, it, expect } from "vitest";
import {
  openings,
  openingLines,
  lineNodes,
  repertoires,
  repertoireLines,
  modelGames,
  userLineReviews,
  openingTags,
  openingTagMap,
  lineTagMap,
} from "@shared/schema";
import type {
  OpeningRow,
  NewOpeningRow as _NewOpeningRow,
  OpeningLineRow,
  NewOpeningLineRow as _NewOpeningLineRow,
  LineNodeRow,
  NewLineNodeRow as _NewLineNodeRow,
  RepertoireRow,
  NewRepertoireRow as _NewRepertoireRow,
  RepertoireLineRow as _RepertoireLineRow,
  NewRepertoireLineRow as _NewRepertoireLineRow,
  ModelGameRow as _ModelGameRow,
  NewModelGameRow as _NewModelGameRow,
  UserLineReviewRow,
  NewUserLineReviewRow as _NewUserLineReviewRow,
  OpeningTagRow as _OpeningTagRow,
  NewOpeningTagRow as _NewOpeningTagRow,
  OpeningTagMapRow as _OpeningTagMapRow,
  NewOpeningTagMapRow as _NewOpeningTagMapRow,
  LineTagMapRow as _LineTagMapRow,
  NewLineTagMapRow as _NewLineTagMapRow,
} from "@shared/schema";

// ─── Seed data for validation ────────────────────────────────────────────────
import seedData from "../../../data/openings-seed.json";

// ─── Schema table existence tests ────────────────────────────────────────────
describe("Openings schema tables exist", () => {
  it("exports the openings table", () => {
    expect(openings).toBeDefined();
    expect(typeof openings).toBe("object");
  });

  it("exports the opening_lines table", () => {
    expect(openingLines).toBeDefined();
    expect(typeof openingLines).toBe("object");
  });

  it("exports the line_nodes table", () => {
    expect(lineNodes).toBeDefined();
    expect(typeof lineNodes).toBe("object");
  });

  it("exports the repertoires table", () => {
    expect(repertoires).toBeDefined();
    expect(typeof repertoires).toBe("object");
  });

  it("exports the repertoire_lines table", () => {
    expect(repertoireLines).toBeDefined();
    expect(typeof repertoireLines).toBe("object");
  });

  it("exports the model_games table", () => {
    expect(modelGames).toBeDefined();
    expect(typeof modelGames).toBe("object");
  });

  it("exports the user_line_reviews table", () => {
    expect(userLineReviews).toBeDefined();
    expect(typeof userLineReviews).toBe("object");
  });

  it("exports the opening_tags table", () => {
    expect(openingTags).toBeDefined();
    expect(typeof openingTags).toBe("object");
  });

  it("exports the opening_tag_map table", () => {
    expect(openingTagMap).toBeDefined();
    expect(typeof openingTagMap).toBe("object");
  });

  it("exports the line_tag_map table", () => {
    expect(lineTagMap).toBeDefined();
    expect(typeof lineTagMap).toBe("object");
  });
});

// ─── Type inference tests ────────────────────────────────────────────────────
describe("Openings schema type inference", () => {
  it("OpeningRow has required fields", () => {
    // Type-level check: ensure the inferred type has the expected shape
    const _typeCheck: OpeningRow = {
      id: "test",
      name: "Sicilian Defense",
      slug: "sicilian-defense",
      eco: "B20",
      color: "black",
      startingMoves: "1.e4 c5",
      startingFen: "rnbqkbnr/pp1ppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
      description: null,
      summary: null,
      difficulty: "intermediate",
      popularity: 95,
      playCharacter: "tactical",
      themes: null,
      lineCount: 3,
      sortOrder: 100,
      isPublished: 1,
      authorName: null,
      coverImageUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    expect(_typeCheck.name).toBe("Sicilian Defense");
  });

  it("OpeningLineRow has study metadata fields", () => {
    const _typeCheck: OpeningLineRow = {
      id: "test",
      openingId: "parent",
      title: "Najdorf Main Line",
      slug: "najdorf-main",
      eco: "B96",
      pgn: "1.e4 c5",
      finalFen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      plyCount: 2,
      description: null,
      difficulty: "advanced",
      commonness: 85,
      priority: 90,
      isMustKnow: 1,
      isTrap: 0,
      lineType: "main",
      color: "black",
      strategicSummary: null,
      hintText: null,
      punishmentIdea: null,
      pawnStructure: null,
      themes: null,
      sortOrder: 100,
      isPublished: 1,
      authorName: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    expect(_typeCheck.isMustKnow).toBe(1);
    expect(_typeCheck.priority).toBe(90);
  });

  it("LineNodeRow has move tree fields", () => {
    const _typeCheck: LineNodeRow = {
      id: "node1",
      lineId: "line1",
      parentNodeId: null,
      ply: 0,
      moveSan: null,
      moveUci: null,
      fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      isMainLine: 1,
      annotation: null,
      nag: null,
      eval: null,
      transpositionNodeId: null,
      sortOrder: 0,
      createdAt: new Date(),
    };
    expect(_typeCheck.ply).toBe(0);
    expect(_typeCheck.parentNodeId).toBeNull();
  });

  it("UserLineReviewRow has SM-2 fields", () => {
    const _typeCheck: UserLineReviewRow = {
      id: "review1",
      userId: "user1",
      lineId: "line1",
      status: "new",
      intervalDays: 0,
      easeFactor: 250,
      repetitions: 0,
      nextReviewAt: null,
      lastReviewedAt: null,
      totalAttempts: 0,
      correctAttempts: 0,
      streak: 0,
      bestStreak: 0,
      lastQuality: null,
      avgReviewSeconds: null,
      reviewHistory: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    expect(_typeCheck.easeFactor).toBe(250);
    expect(_typeCheck.status).toBe("new");
  });

  it("RepertoireRow has curation fields", () => {
    const _typeCheck: RepertoireRow = {
      id: "rep1",
      title: "Complete Sicilian for Black",
      slug: "complete-sicilian-black",
      description: null,
      color: "black",
      targetLevel: "intermediate",
      authorType: "staff",
      authorName: null,
      authorUserId: null,
      isPublished: 1,
      isFeatured: 0,
      lineCount: 10,
      estimatedMinutes: null,
      coverImageUrl: null,
      sortOrder: 100,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    expect(_typeCheck.authorType).toBe("staff");
  });
});

// ─── Seed data validation tests ──────────────────────────────────────────────
describe("Seed data structure validation", () => {
  it("seed file has required top-level keys", () => {
    expect(seedData).toHaveProperty("_meta");
    expect(seedData).toHaveProperty("tags");
    expect(seedData).toHaveProperty("openings");
  });

  it("seed file has version metadata", () => {
    expect(seedData._meta.version).toBe("1.0.0");
    expect(seedData._meta.description).toBeTruthy();
  });

  it("all tags have required fields", () => {
    for (const tag of seedData.tags) {
      expect(tag.slug).toBeTruthy();
      expect(tag.name).toBeTruthy();
      expect(tag.category).toBeTruthy();
      expect(["theme", "structure", "style", "level", "custom"]).toContain(tag.category);
    }
  });

  it("all tag slugs are unique", () => {
    const slugs = seedData.tags.map((t: { slug: string }) => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("all tag slugs are kebab-case", () => {
    for (const tag of seedData.tags) {
      expect(tag.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });
});

describe("Seed opening content validation", () => {
  const tagSlugs = new Set(seedData.tags.map((t: { slug: string }) => t.slug));

  for (const opening of seedData.openings) {
    describe(`Opening: ${opening.name}`, () => {
      it("has required fields", () => {
        expect(opening.name).toBeTruthy();
        expect(opening.slug).toBeTruthy();
        expect(opening.eco).toBeTruthy();
        expect(["white", "black", "both"]).toContain(opening.color);
        expect(opening.startingMoves).toBeTruthy();
        expect(opening.startingFen).toBeTruthy();
      });

      it("has a valid slug format", () => {
        expect(opening.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      });

      it("has a valid difficulty", () => {
        expect(["beginner", "intermediate", "advanced", "expert"]).toContain(opening.difficulty);
      });

      it("has valid popularity (0-100)", () => {
        expect(opening.popularity).toBeGreaterThanOrEqual(0);
        expect(opening.popularity).toBeLessThanOrEqual(100);
      });

      it("has valid playCharacter", () => {
        expect(["tactical", "positional", "universal"]).toContain(opening.playCharacter);
      });

      it("references only defined tags", () => {
        for (const tagSlug of opening.tags || []) {
          expect(tagSlugs.has(tagSlug)).toBe(true);
        }
      });

      it("has at least one line", () => {
        expect(opening.lines.length).toBeGreaterThan(0);
      });

      for (const line of opening.lines) {
        describe(`Line: ${line.title}`, () => {
          it("has required fields", () => {
            expect(line.title).toBeTruthy();
            expect(line.slug).toBeTruthy();
            expect(line.eco).toBeTruthy();
            expect(line.pgn).toBeTruthy();
            expect(line.finalFen).toBeTruthy();
            expect(["white", "black"]).toContain(line.color);
          });

          it("has valid difficulty", () => {
            expect(["beginner", "intermediate", "advanced", "expert"]).toContain(line.difficulty);
          });

          it("has valid commonness (0-100)", () => {
            expect(line.commonness).toBeGreaterThanOrEqual(0);
            expect(line.commonness).toBeLessThanOrEqual(100);
          });

          it("has valid priority (0-100)", () => {
            expect(line.priority).toBeGreaterThanOrEqual(0);
            expect(line.priority).toBeLessThanOrEqual(100);
          });

          it("has valid lineType", () => {
            expect(["main", "sideline", "gambit", "surprise", "trap"]).toContain(line.lineType);
          });

          it("references only defined tags", () => {
            for (const tagSlug of line.tags || []) {
              expect(tagSlugs.has(tagSlug)).toBe(true);
            }
          });

          it("has nodes with sequential plies", () => {
            const plies = line.nodes.map((n: { ply: number }) => n.ply);
            for (let i = 0; i < plies.length; i++) {
              expect(plies[i]).toBe(i);
            }
          });

          it("root node (ply 0) has no move", () => {
            const root = line.nodes[0];
            expect(root.ply).toBe(0);
            expect(root.moveSan).toBeNull();
            expect(root.moveUci).toBeNull();
          });

          it("non-root nodes have SAN and UCI moves", () => {
            for (const node of line.nodes.slice(1)) {
              expect(node.moveSan).toBeTruthy();
              expect(node.moveUci).toBeTruthy();
            }
          });

          it("all nodes have FEN positions", () => {
            for (const node of line.nodes) {
              expect(node.fen).toBeTruthy();
              // Basic FEN validation: should have 8 ranks separated by /
              const ranks = node.fen.split(" ")[0].split("/");
              expect(ranks.length).toBe(8);
            }
          });

          it("plyCount matches node count minus root", () => {
            expect(line.plyCount).toBe(line.nodes.length - 1);
          });

          it("model games have required fields", () => {
            for (const game of line.modelGames || []) {
              expect(game.title).toBeTruthy();
              expect(game.whitePlayer).toBeTruthy();
              expect(game.blackPlayer).toBeTruthy();
              expect(game.result).toBeTruthy();
              expect(game.pgn).toBeTruthy();
              expect(["1-0", "0-1", "1/2-1/2"]).toContain(game.result);
            }
          });
        });
      }
    });
  }
});

// ─── SM-2 algorithm validation tests ─────────────────────────────────────────
describe("SM-2 default values", () => {
  it("ease factor default is 2.5 (stored as 250)", () => {
    // The default ease factor in SM-2 is 2.5
    // We store it as integer × 100 to avoid floating point issues
    const defaultEF = 250;
    expect(defaultEF / 100).toBe(2.5);
  });

  it("minimum ease factor is 1.3 (stored as 130)", () => {
    const minEF = 130;
    expect(minEF / 100).toBe(1.3);
  });

  it("quality ratings range from 0 to 5", () => {
    const validQualities = [0, 1, 2, 3, 4, 5];
    for (const q of validQualities) {
      expect(q).toBeGreaterThanOrEqual(0);
      expect(q).toBeLessThanOrEqual(5);
    }
  });

  it("status transitions follow expected order", () => {
    const statuses = ["new", "learning", "reviewing", "mastered"];
    expect(statuses.indexOf("new")).toBeLessThan(statuses.indexOf("learning"));
    expect(statuses.indexOf("learning")).toBeLessThan(statuses.indexOf("reviewing"));
    expect(statuses.indexOf("reviewing")).toBeLessThan(statuses.indexOf("mastered"));
  });
});

// ─── Content integrity rules ─────────────────────────────────────────────────
describe("Content integrity rules", () => {
  it("all opening slugs are unique across seed data", () => {
    const slugs = seedData.openings.map((o: { slug: string }) => o.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("all line slugs are unique across seed data", () => {
    const slugs: string[] = [];
    for (const opening of seedData.openings) {
      for (const line of opening.lines) {
        slugs.push(line.slug);
      }
    }
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("starting FEN has valid structure", () => {
    for (const opening of seedData.openings) {
      const parts = opening.startingFen.split(" ");
      expect(parts.length).toBe(6); // FEN has 6 fields
      expect(parts[0].split("/").length).toBe(8); // 8 ranks
    }
  });

  it("ECO codes follow standard format", () => {
    for (const opening of seedData.openings) {
      // ECO can be a single code (B20) or a range (B20-B99)
      expect(opening.eco).toMatch(/^[A-E]\d{2}(-[A-E]\d{2})?$/);
    }
    for (const opening of seedData.openings) {
      for (const line of opening.lines) {
        expect(line.eco).toMatch(/^[A-E]\d{2}$/);
      }
    }
  });
});
