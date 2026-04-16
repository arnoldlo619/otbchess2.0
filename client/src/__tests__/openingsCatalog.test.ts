/**
 * openingsCatalog.test.ts — Validates the launch catalog seed data
 * for content integrity, schema compliance, and UI-readiness.
 */
import { describe, it, expect } from "vitest";
import catalogData from "../../../data/openings-catalog-seed.json";

// ─── Type helpers ────────────────────────────────────────────────────────────

interface CatalogOpening {
  name: string;
  slug: string;
  eco: string;
  color: string;
  startingMoves: string;
  startingFen: string;
  description: string;
  summary: string;
  difficulty: string;
  popularity: number;
  playCharacter: string;
  themes: string[];
  tags: string[];
  isFeatured: boolean;
  starterFriendly: boolean;
  estimatedLineCount: number;
  trapPotential: number;
  strategicComplexity: number;
  lines: unknown[];
}

interface CatalogTag {
  slug: string;
  name: string;
  category: string;
  description: string;
}

interface CategoryGrouping {
  id: string;
  title: string;
  subtitle: string;
  openingSlugs: string[];
  sortOrder: number;
}

interface BrowseFilter {
  id: string;
  label: string;
  type: string;
  options: { value: string; label: string }[];
}

const openings = catalogData.openings as CatalogOpening[];
const tags = catalogData.tags as CatalogTag[];
const categoryGroupings = catalogData.categoryGroupings as CategoryGrouping[];
const browseFilters = catalogData.browseFilters as BrowseFilter[];

// ─── Meta ────────────────────────────────────────────────────────────────────

describe("Catalog Metadata", () => {
  it("has correct version", () => {
    expect(catalogData._meta.version).toBe("2.0.0");
  });

  it("reports correct opening count", () => {
    expect(catalogData._meta.openingCount).toBe(openings.length);
  });

  it("has three categories", () => {
    expect(catalogData._meta.categories).toEqual([
      "white-repertoire",
      "black-vs-e4",
      "black-vs-d4",
    ]);
  });
});

// ─── Openings Count & Completeness ──────────────────────────────────────────

describe("Catalog Openings — Count & Structure", () => {
  it("contains exactly 16 openings", () => {
    expect(openings).toHaveLength(16);
  });

  it("all openings have unique slugs", () => {
    const slugs = openings.map((o) => o.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("all openings have unique names", () => {
    const names = openings.map((o) => o.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("all slugs are URL-safe (lowercase, hyphens, no spaces)", () => {
    for (const o of openings) {
      expect(o.slug).toMatch(/^[a-z0-9-]+$/);
    }
  });
});

// ─── Required Fields ────────────────────────────────────────────────────────

describe("Catalog Openings — Required Fields", () => {
  for (const o of openings) {
    describe(o.name, () => {
      it("has a non-empty name", () => {
        expect(o.name.length).toBeGreaterThan(0);
      });

      it("has a valid ECO code", () => {
        expect(o.eco).toMatch(/^[A-E]\d{2}/);
      });

      it("has a valid color", () => {
        expect(["white", "black", "both"]).toContain(o.color);
      });

      it("has starting moves", () => {
        expect(o.startingMoves).toMatch(/^1\./);
      });

      it("has a valid FEN", () => {
        // FEN has 6 space-separated fields
        const parts = o.startingFen.split(" ");
        expect(parts.length).toBe(6);
        // First field has 8 ranks separated by /
        expect(parts[0].split("/").length).toBe(8);
      });

      it("has a description of at least 100 characters", () => {
        expect(o.description.length).toBeGreaterThanOrEqual(100);
      });

      it("has a summary of at most 100 characters", () => {
        expect(o.summary.length).toBeLessThanOrEqual(100);
      });

      it("has a valid difficulty", () => {
        expect(["beginner", "intermediate", "advanced", "expert"]).toContain(
          o.difficulty
        );
      });

      it("has popularity in range 0-100", () => {
        expect(o.popularity).toBeGreaterThanOrEqual(0);
        expect(o.popularity).toBeLessThanOrEqual(100);
      });

      it("has a valid playCharacter", () => {
        expect(["tactical", "positional", "universal"]).toContain(
          o.playCharacter
        );
      });

      it("has at least 1 theme", () => {
        expect(o.themes.length).toBeGreaterThanOrEqual(1);
      });

      it("has at least 3 tags", () => {
        expect(o.tags.length).toBeGreaterThanOrEqual(3);
      });

      it("has trapPotential in range 0-100", () => {
        expect(o.trapPotential).toBeGreaterThanOrEqual(0);
        expect(o.trapPotential).toBeLessThanOrEqual(100);
      });

      it("has strategicComplexity in range 0-100", () => {
        expect(o.strategicComplexity).toBeGreaterThanOrEqual(0);
        expect(o.strategicComplexity).toBeLessThanOrEqual(100);
      });

      it("has estimatedLineCount > 0", () => {
        expect(o.estimatedLineCount).toBeGreaterThan(0);
      });

      it("isFeatured is boolean", () => {
        expect(typeof o.isFeatured).toBe("boolean");
      });

      it("starterFriendly is boolean", () => {
        expect(typeof o.starterFriendly).toBe("boolean");
      });
    });
  }
});

// ─── Side Distribution ──────────────────────────────────────────────────────

describe("Catalog Openings — Side Distribution", () => {
  it("has 7 white openings", () => {
    expect(openings.filter((o) => o.color === "white")).toHaveLength(7);
  });

  it("has 9 black openings (4 vs e4 + 5 vs d4)", () => {
    expect(openings.filter((o) => o.color === "black")).toHaveLength(9);
  });
});

// ─── Featured & Starter ─────────────────────────────────────────────────────

describe("Catalog Openings — Featured & Starter Flags", () => {
  it("has at least 5 featured openings", () => {
    const featured = openings.filter((o) => o.isFeatured);
    expect(featured.length).toBeGreaterThanOrEqual(5);
  });

  it("has at least 4 starter-friendly openings", () => {
    const starters = openings.filter((o) => o.starterFriendly);
    expect(starters.length).toBeGreaterThanOrEqual(4);
  });

  it("all starter-friendly openings are beginner difficulty", () => {
    const starters = openings.filter((o) => o.starterFriendly);
    for (const s of starters) {
      expect(s.difficulty).toBe("beginner");
    }
  });
});

// ─── Difficulty Distribution ────────────────────────────────────────────────

describe("Catalog Openings — Difficulty Distribution", () => {
  it("has at least 3 beginner openings", () => {
    expect(openings.filter((o) => o.difficulty === "beginner").length).toBeGreaterThanOrEqual(3);
  });

  it("has at least 5 intermediate openings", () => {
    expect(openings.filter((o) => o.difficulty === "intermediate").length).toBeGreaterThanOrEqual(5);
  });

  it("has at least 1 advanced opening", () => {
    expect(openings.filter((o) => o.difficulty === "advanced").length).toBeGreaterThanOrEqual(1);
  });
});

// ─── Tags ───────────────────────────────────────────────────────────────────

describe("Catalog Tags", () => {
  it("has at least 40 tags", () => {
    expect(tags.length).toBeGreaterThanOrEqual(40);
  });

  it("all tags have unique slugs", () => {
    const slugs = tags.map((t) => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("all tags have a valid category", () => {
    const validCategories = [
      "theme",
      "structure",
      "style",
      "level",
      "bestFor",
      "family",
    ];
    for (const t of tags) {
      expect(validCategories).toContain(t.category);
    }
  });

  it("has tags in all 6 categories", () => {
    const categories = new Set(tags.map((t) => t.category));
    expect(categories.size).toBe(6);
  });

  it("all opening tags reference existing tag slugs", () => {
    const tagSlugs = new Set(tags.map((t) => t.slug));
    for (const o of openings) {
      for (const theme of o.themes) {
        expect(tagSlugs.has(theme)).toBe(true);
      }
      for (const tag of o.tags) {
        expect(tagSlugs.has(tag)).toBe(true);
      }
    }
  });
});

// ─── Category Groupings ─────────────────────────────────────────────────────

describe("Category Groupings", () => {
  it("has exactly 3 groupings", () => {
    expect(categoryGroupings).toHaveLength(3);
  });

  it("all grouping IDs are unique", () => {
    const ids = categoryGroupings.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("all groupings reference existing opening slugs", () => {
    const openingSlugs = new Set(openings.map((o) => o.slug));
    for (const g of categoryGroupings) {
      for (const slug of g.openingSlugs) {
        expect(openingSlugs.has(slug)).toBe(true);
      }
    }
  });

  it("every opening appears in exactly one grouping", () => {
    const allGroupedSlugs = categoryGroupings.flatMap((g) => g.openingSlugs);
    expect(allGroupedSlugs.length).toBe(openings.length);
    expect(new Set(allGroupedSlugs).size).toBe(openings.length);
  });

  it("groupings are sorted by sortOrder", () => {
    for (let i = 1; i < categoryGroupings.length; i++) {
      expect(categoryGroupings[i].sortOrder).toBeGreaterThan(
        categoryGroupings[i - 1].sortOrder
      );
    }
  });

  it("White Repertoire has 7 openings", () => {
    const white = categoryGroupings.find((g) => g.id === "white-repertoire");
    expect(white?.openingSlugs).toHaveLength(7);
  });

  it("Black vs 1.e4 has 4 openings", () => {
    const blackE4 = categoryGroupings.find((g) => g.id === "black-vs-e4");
    expect(blackE4?.openingSlugs).toHaveLength(4);
  });

  it("Black vs 1.d4 has 5 openings", () => {
    const blackD4 = categoryGroupings.find((g) => g.id === "black-vs-d4");
    expect(blackD4?.openingSlugs).toHaveLength(5);
  });
});

// ─── Browse Filters ─────────────────────────────────────────────────────────

describe("Browse Filters", () => {
  it("has exactly 6 filters", () => {
    expect(browseFilters).toHaveLength(6);
  });

  it("all filters have unique IDs", () => {
    const ids = browseFilters.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("all filters have at least 2 options", () => {
    for (const f of browseFilters) {
      expect(f.options.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("filter types are valid", () => {
    for (const f of browseFilters) {
      expect(["toggle", "multi-select"]).toContain(f.type);
    }
  });

  it("includes side, difficulty, style, character, bestFor, theory filters", () => {
    const ids = browseFilters.map((f) => f.id);
    expect(ids).toContain("side");
    expect(ids).toContain("difficulty");
    expect(ids).toContain("style");
    expect(ids).toContain("character");
    expect(ids).toContain("bestFor");
    expect(ids).toContain("theory");
  });
});

// ─── Specific Opening Spot Checks ──────────────────────────────────────────

describe("Specific Opening Spot Checks", () => {
  const findOpening = (slug: string) =>
    openings.find((o) => o.slug === slug)!;

  it("Sicilian Defense is the most popular", () => {
    const sicilian = findOpening("sicilian-defense");
    expect(sicilian.popularity).toBe(95);
    for (const o of openings) {
      expect(o.popularity).toBeLessThanOrEqual(sicilian.popularity);
    }
  });

  it("London System is beginner-friendly and starter-friendly", () => {
    const london = findOpening("london-system");
    expect(london.difficulty).toBe("beginner");
    expect(london.starterFriendly).toBe(true);
  });

  it("King's Indian Defense is the most strategically complex", () => {
    const kid = findOpening("kings-indian-defense");
    expect(kid.strategicComplexity).toBe(85);
    expect(kid.difficulty).toBe("advanced");
  });

  it("Vienna Gambit has the highest trap potential", () => {
    const vg = findOpening("vienna-gambit");
    expect(vg.trapPotential).toBe(85);
    for (const o of openings) {
      expect(o.trapPotential).toBeLessThanOrEqual(vg.trapPotential);
    }
  });

  it("Queen's Gambit Declined has the lowest trap potential", () => {
    const qgd = findOpening("queens-gambit-declined");
    expect(qgd.trapPotential).toBe(25);
    for (const o of openings) {
      expect(o.trapPotential).toBeGreaterThanOrEqual(qgd.trapPotential);
    }
  });

  it("Jobava London is featured", () => {
    const jobava = findOpening("jobava-london");
    expect(jobava.isFeatured).toBe(true);
  });

  it("Anti-London is for black", () => {
    const anti = findOpening("anti-london-system");
    expect(anti.color).toBe("black");
  });

  it("all white openings have starting moves beginning with 1.d4 or 1.e4", () => {
    const whiteOpenings = openings.filter((o) => o.color === "white");
    for (const o of whiteOpenings) {
      expect(o.startingMoves).toMatch(/^1\.(d4|e4)/);
    }
  });
});

// ─── FEN Validation ─────────────────────────────────────────────────────────

describe("FEN Validation", () => {
  for (const o of openings) {
    it(`${o.name} has a valid FEN with correct side to move`, () => {
      const parts = o.startingFen.split(" ");
      expect(parts).toHaveLength(6);

      // Side to move
      expect(["w", "b"]).toContain(parts[1]);

      // Castling rights
      expect(parts[2]).toMatch(/^[KQkq-]+$/);

      // Move counters are numbers
      expect(Number(parts[4])).toBeGreaterThanOrEqual(0);
      expect(Number(parts[5])).toBeGreaterThanOrEqual(1);
    });
  }
});

// ─── Description Quality ────────────────────────────────────────────────────

describe("Description Quality", () => {
  for (const o of openings) {
    it(`${o.name} description has two paragraphs`, () => {
      const paragraphs = o.description
        .split("\n\n")
        .filter((p) => p.trim().length > 0);
      expect(paragraphs.length).toBeGreaterThanOrEqual(2);
    });

    it(`${o.name} description does not contain filler language`, () => {
      const fillerPatterns = [
        /amazing/i,
        /incredible/i,
        /blow your mind/i,
        /you won't believe/i,
        /game-changer/i,
      ];
      for (const pattern of fillerPatterns) {
        expect(o.description).not.toMatch(pattern);
      }
    });
  }
});
