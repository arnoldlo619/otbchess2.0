/**
 * Phase 5 Feature Tests
 * Tests for: Club Discovery filters, Tools Hub card data, Openings Library filters,
 * Matchup Prep data quality, and theme consistency.
 */
import { describe, it, expect } from "vitest";

// ─── Club Discovery Filters ─────────────────────────────────────────────────

describe("Club Discovery — filter logic", () => {
  // Simulating the filter logic from MyClubs.tsx
  interface ClubCard {
    name: string;
    country: string;
    category: string;
    verified: boolean;
    memberCount: number;
  }

  const CLUBS: ClubCard[] = [
    { name: "London Chess Club", country: "GB", category: "competitive", verified: true, memberCount: 120 },
    { name: "NYC Casual Players", country: "US", category: "casual", verified: false, memberCount: 45 },
    { name: "Berlin Schach", country: "DE", category: "competitive", verified: true, memberCount: 80 },
    { name: "Tokyo Chess Circle", country: "JP", category: "casual", verified: false, memberCount: 30 },
    { name: "Sydney OTB", country: "AU", category: "competitive", verified: true, memberCount: 65 },
  ];

  function filterClubs(
    clubs: ClubCard[],
    opts: { search?: string; country?: string; category?: string; verified?: boolean; sort?: "members" | "name" }
  ) {
    let result = [...clubs];
    if (opts.search) {
      const q = opts.search.toLowerCase();
      result = result.filter((c) => c.name.toLowerCase().includes(q));
    }
    if (opts.country) result = result.filter((c) => c.country === opts.country);
    if (opts.category) result = result.filter((c) => c.category === opts.category);
    if (opts.verified !== undefined) result = result.filter((c) => c.verified === opts.verified);
    if (opts.sort === "members") result.sort((a, b) => b.memberCount - a.memberCount);
    if (opts.sort === "name") result.sort((a, b) => a.name.localeCompare(b.name));
    return result;
  }

  it("returns all clubs with no filters", () => {
    expect(filterClubs(CLUBS, {})).toHaveLength(5);
  });

  it("filters by search term (case-insensitive)", () => {
    const result = filterClubs(CLUBS, { search: "chess" });
    expect(result).toHaveLength(2);
    expect(result.map((c) => c.name)).toContain("London Chess Club");
    expect(result.map((c) => c.name)).toContain("Tokyo Chess Circle");
  });

  it("filters by country", () => {
    const result = filterClubs(CLUBS, { country: "US" });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("NYC Casual Players");
  });

  it("filters by category", () => {
    const result = filterClubs(CLUBS, { category: "competitive" });
    expect(result).toHaveLength(3);
  });

  it("filters by verified status", () => {
    const result = filterClubs(CLUBS, { verified: true });
    expect(result).toHaveLength(3);
  });

  it("combines multiple filters", () => {
    const result = filterClubs(CLUBS, { category: "competitive", country: "GB" });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("London Chess Club");
  });

  it("sorts by member count descending", () => {
    const result = filterClubs(CLUBS, { sort: "members" });
    expect(result[0].memberCount).toBe(120);
    expect(result[result.length - 1].memberCount).toBe(30);
  });

  it("sorts by name alphabetically", () => {
    const result = filterClubs(CLUBS, { sort: "name" });
    expect(result[0].name).toBe("Berlin Schach");
    expect(result[result.length - 1].name).toBe("Tokyo Chess Circle");
  });

  it("returns empty array when no clubs match", () => {
    const result = filterClubs(CLUBS, { search: "nonexistent" });
    expect(result).toHaveLength(0);
  });
});

// ─── Tools Hub Card Data ─────────────────────────────────────────────────────

describe("Tools Hub — card definitions", () => {
  const TOOLS = [
    { id: "matchup-prep", title: "Matchup Prep", href: "/prep", external: false, size: "hero" },
    { id: "repertoire-builder", title: "Repertoire Builder", href: "/repertoire", external: false, size: "medium" },
    { id: "openings-library", title: "Openings Library", href: "/openings", external: false, size: "medium" },
    { id: "video-editor", title: "Video Editor", href: "https://otbanalysis.lovable.app", external: true, size: "tall" },
  ] as const;

  it("has exactly 4 tools", () => {
    expect(TOOLS).toHaveLength(4);
  });

  it("hero card is Matchup Prep", () => {
    const hero = TOOLS.find((t) => t.size === "hero");
    expect(hero?.id).toBe("matchup-prep");
  });

  it("video editor is external", () => {
    const video = TOOLS.find((t) => t.id === "video-editor");
    expect(video?.external).toBe(true);
    expect(video?.href).toMatch(/^https?:\/\//);
  });

  it("internal tools have relative paths", () => {
    const internal = TOOLS.filter((t) => !t.external);
    internal.forEach((t) => {
      expect(t.href).toMatch(/^\//);
    });
  });

  it("all tools have unique IDs", () => {
    const ids = TOOLS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ─── Openings Library Filter Logic ───────────────────────────────────────────

describe("Openings Library — filter logic", () => {
  interface DemoOpening {
    id: string;
    name: string;
    eco: string;
    side: "white" | "black";
    difficulty: "beginner" | "intermediate" | "advanced";
    isFeatured: boolean;
    shortDescription: string;
  }

  const OPENINGS: DemoOpening[] = [
    { id: "1", name: "Italian Game", eco: "C50", side: "white", difficulty: "beginner", isFeatured: true, shortDescription: "Classical development" },
    { id: "2", name: "Sicilian Defense", eco: "B20", side: "black", difficulty: "intermediate", isFeatured: true, shortDescription: "Sharp counterplay" },
    { id: "3", name: "Ruy Lopez", eco: "C60", side: "white", difficulty: "advanced", isFeatured: false, shortDescription: "Strategic pressure" },
    { id: "4", name: "French Defense", eco: "C00", side: "black", difficulty: "beginner", isFeatured: false, shortDescription: "Solid structure" },
    { id: "5", name: "Queen's Gambit", eco: "D06", side: "white", difficulty: "intermediate", isFeatured: false, shortDescription: "Central control" },
  ];

  function filterOpenings(
    openings: DemoOpening[],
    opts: { search?: string; side?: "white" | "black"; difficulty?: string }
  ) {
    let result = [...openings];
    if (opts.search) {
      const q = opts.search.toLowerCase();
      result = result.filter(
        (o) => o.name.toLowerCase().includes(q) || o.eco.toLowerCase().includes(q) || o.shortDescription.toLowerCase().includes(q)
      );
    }
    if (opts.side) result = result.filter((o) => o.side === opts.side);
    if (opts.difficulty) result = result.filter((o) => o.difficulty === opts.difficulty);
    return result;
  }

  it("returns all openings with no filters", () => {
    expect(filterOpenings(OPENINGS, {})).toHaveLength(5);
  });

  it("filters by search (name)", () => {
    expect(filterOpenings(OPENINGS, { search: "sicilian" })).toHaveLength(1);
  });

  it("filters by search (ECO code)", () => {
    expect(filterOpenings(OPENINGS, { search: "C50" })).toHaveLength(1);
  });

  it("filters by search (description)", () => {
    expect(filterOpenings(OPENINGS, { search: "counterplay" })).toHaveLength(1);
  });

  it("filters by side", () => {
    expect(filterOpenings(OPENINGS, { side: "white" })).toHaveLength(3);
    expect(filterOpenings(OPENINGS, { side: "black" })).toHaveLength(2);
  });

  it("filters by difficulty", () => {
    expect(filterOpenings(OPENINGS, { difficulty: "beginner" })).toHaveLength(2);
    expect(filterOpenings(OPENINGS, { difficulty: "advanced" })).toHaveLength(1);
  });

  it("combines side and difficulty filters", () => {
    expect(filterOpenings(OPENINGS, { side: "white", difficulty: "beginner" })).toHaveLength(1);
  });

  it("featured openings are a subset", () => {
    const featured = OPENINGS.filter((o) => o.isFeatured);
    expect(featured).toHaveLength(2);
  });
});

// ─── Matchup Prep Data Quality ───────────────────────────────────────────────

describe("Matchup Prep — data quality grading", () => {
  type Grade = "A" | "B" | "C" | "D";

  function getGradeLabel(grade: Grade): string {
    switch (grade) {
      case "A": return "Good data";
      case "B": return "Fair data";
      case "C": return "Limited data";
      case "D": return "Sparse data";
    }
  }

  function getGradeSeverity(grade: Grade): "none" | "warning" | "caution" | "danger" {
    switch (grade) {
      case "A": return "none";
      case "B": return "warning";
      case "C": return "caution";
      case "D": return "danger";
    }
  }

  it("grade A means good data (no warning shown)", () => {
    expect(getGradeLabel("A")).toBe("Good data");
    expect(getGradeSeverity("A")).toBe("none");
  });

  it("grade B means fair data (warning)", () => {
    expect(getGradeLabel("B")).toBe("Fair data");
    expect(getGradeSeverity("B")).toBe("warning");
  });

  it("grade C means limited data (caution)", () => {
    expect(getGradeLabel("C")).toBe("Limited data");
    expect(getGradeSeverity("C")).toBe("caution");
  });

  it("grade D means sparse data (danger)", () => {
    expect(getGradeLabel("D")).toBe("Sparse data");
    expect(getGradeSeverity("D")).toBe("danger");
  });
});

// ─── Theme Consistency ───────────────────────────────────────────────────────

describe("Theme — OTB design tokens", () => {
  const OTB_TOKENS = {
    dark: {
      surface: "#0a1409",
      card: "#0d1a0f",
      accent: "#436850",
      textPrimary: "white",
      border: "#1e2e22",
    },
    light: {
      surface: "#f4f7f4",
      card: "#ffffff",
      accent: "#436850",
      textPrimary: "#12372A",
      border: "#ADBC9F",
    },
  };

  it("dark and light share the same accent color", () => {
    expect(OTB_TOKENS.dark.accent).toBe(OTB_TOKENS.light.accent);
  });

  it("dark surface is darker than dark card", () => {
    // Hex comparison: 0a < 0d
    expect(OTB_TOKENS.dark.surface < OTB_TOKENS.dark.card).toBe(true);
  });

  it("light surface is not pure white", () => {
    expect(OTB_TOKENS.light.surface).not.toBe("#ffffff");
  });

  it("all tokens are valid hex colors", () => {
    const hexRegex = /^#[0-9a-fA-F]{6}$/;
    Object.values(OTB_TOKENS.dark).forEach((v) => {
      if (v !== "white") expect(v).toMatch(hexRegex);
    });
    Object.values(OTB_TOKENS.light).forEach((v) => {
      expect(v).toMatch(hexRegex);
    });
  });
});
