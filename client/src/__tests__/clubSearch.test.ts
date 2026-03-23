/**
 * clubSearch.test.ts
 * Unit tests for the server-side club search wiring in MyClubs / clubsApi.
 *
 * Tests cover:
 *  - apiListPublicClubs URL construction with search/category params
 *  - Debounce delay logic (0ms for category, 350ms for text)
 *  - Result count label formatting
 *  - Fallback filtering when server is unreachable
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Reproduce the URL construction logic from clubsApi.ts */
function buildDiscoverUrl(opts?: { search?: string; category?: string }): string {
  const BASE = "/api/clubs";
  const params = new URLSearchParams();
  if (opts?.search) params.set("search", opts.search);
  if (opts?.category && opts.category !== "all") params.set("category", opts.category);
  const qs = params.toString();
  return `${BASE}${qs ? `?${qs}` : ""}`;
}

/** Reproduce the result count label from MyClubs.tsx */
function buildResultLabel(
  total: number,
  search: string,
  category: string,
  categoryLabel: string
): string {
  let label = `${total} club${total !== 1 ? "s" : ""}`;
  if (search.trim()) label += ` matching "${search.trim()}"`;
  if (category !== "all") label += ` in ${categoryLabel}`;
  return label;
}

/** Reproduce the debounce delay logic from MyClubs.tsx */
function getDebounceDelay(search: string): number {
  return search !== "" ? 350 : 0;
}

/** Reproduce the fallback filter logic from MyClubs.tsx */
function fallbackFilter(
  clubs: Array<{ id: string; name: string; location: string; tagline: string; category: string }>,
  joinedIds: Set<string>,
  search: string,
  category: string
) {
  return clubs.filter((c) => {
    if (joinedIds.has(c.id)) return false;
    if (category !== "all" && c.category !== category) return false;
    if (search.trim()) {
      const lq = search.toLowerCase();
      return (
        c.name.toLowerCase().includes(lq) ||
        c.location.toLowerCase().includes(lq) ||
        c.tagline.toLowerCase().includes(lq)
      );
    }
    return true;
  });
}

// ── URL construction tests ─────────────────────────────────────────────────────

describe("buildDiscoverUrl", () => {
  it("returns base URL with no params when no options given", () => {
    expect(buildDiscoverUrl()).toBe("/api/clubs");
  });

  it("returns base URL when empty options given", () => {
    expect(buildDiscoverUrl({})).toBe("/api/clubs");
  });

  it("appends search param when search is provided", () => {
    expect(buildDiscoverUrl({ search: "london" })).toBe("/api/clubs?search=london");
  });

  it("appends category param when category is not 'all'", () => {
    expect(buildDiscoverUrl({ category: "scholastic" })).toBe("/api/clubs?category=scholastic");
  });

  it("appends both params when both are provided", () => {
    const url = buildDiscoverUrl({ search: "chess", category: "competitive" });
    expect(url).toContain("search=chess");
    expect(url).toContain("category=competitive");
    expect(url).toContain("&");
  });

  it("does NOT append category param when category is 'all'", () => {
    expect(buildDiscoverUrl({ category: "all" })).toBe("/api/clubs");
  });

  it("encodes spaces in search query", () => {
    const url = buildDiscoverUrl({ search: "new york" });
    expect(url).toContain("search=new+york");
  });
});

// ── Debounce delay tests ───────────────────────────────────────────────────────

describe("getDebounceDelay", () => {
  it("returns 0ms delay when search is empty (category change)", () => {
    expect(getDebounceDelay("")).toBe(0);
  });

  it("returns 350ms delay when search has text", () => {
    expect(getDebounceDelay("london")).toBe(350);
  });

  it("returns 350ms delay for single character", () => {
    expect(getDebounceDelay("a")).toBe(350);
  });

  it("returns 0ms delay when search is reset to empty", () => {
    expect(getDebounceDelay("")).toBe(0);
  });
});

// ── Result count label tests ───────────────────────────────────────────────────

describe("buildResultLabel", () => {
  it("shows singular 'club' for count of 1", () => {
    expect(buildResultLabel(1, "", "all", "")).toBe("1 club");
  });

  it("shows plural 'clubs' for count of 0", () => {
    expect(buildResultLabel(0, "", "all", "")).toBe("0 clubs");
  });

  it("shows plural 'clubs' for count > 1", () => {
    expect(buildResultLabel(11, "", "all", "")).toBe("11 clubs");
  });

  it("includes search term in label", () => {
    expect(buildResultLabel(3, "london", "all", "")).toBe(`3 clubs matching "london"`);
  });

  it("includes category label when category is not 'all'", () => {
    expect(buildResultLabel(5, "", "scholastic", "Scholastic")).toBe("5 clubs in Scholastic");
  });

  it("includes both search and category when both active", () => {
    const label = buildResultLabel(2, "chess", "competitive", "Competitive");
    expect(label).toContain(`matching "chess"`);
    expect(label).toContain("in Competitive");
  });

  it("trims whitespace from search term in label", () => {
    expect(buildResultLabel(4, "  london  ", "all", "")).toBe(`4 clubs matching "london"`);
  });
});

// ── Fallback filter tests ──────────────────────────────────────────────────────

const MOCK_CLUBS = [
  { id: "c1", name: "London Chess Club", location: "London, UK", tagline: "Premier chess", category: "competitive" },
  { id: "c2", name: "NYC Scholastic", location: "New York, USA", tagline: "Kids chess", category: "scholastic" },
  { id: "c3", name: "Berlin Blitz", location: "Berlin, Germany", tagline: "Fast chess", category: "casual" },
  { id: "c4", name: "Paris Masters", location: "Paris, France", tagline: "Elite tournament chess", category: "competitive" },
];

describe("fallbackFilter", () => {
  it("returns all clubs when no search or category filter", () => {
    const result = fallbackFilter(MOCK_CLUBS, new Set(), "", "all");
    expect(result).toHaveLength(4);
  });

  it("excludes clubs the user has already joined", () => {
    const result = fallbackFilter(MOCK_CLUBS, new Set(["c1", "c3"]), "", "all");
    expect(result.map((c) => c.id)).toEqual(["c2", "c4"]);
  });

  it("filters by category", () => {
    const result = fallbackFilter(MOCK_CLUBS, new Set(), "", "competitive");
    expect(result.map((c) => c.id)).toEqual(["c1", "c4"]);
  });

  it("filters by search term in name", () => {
    const result = fallbackFilter(MOCK_CLUBS, new Set(), "london", "all");
    expect(result.map((c) => c.id)).toEqual(["c1"]);
  });

  it("filters by search term in location", () => {
    const result = fallbackFilter(MOCK_CLUBS, new Set(), "berlin", "all");
    expect(result.map((c) => c.id)).toEqual(["c3"]);
  });

  it("filters by search term in tagline", () => {
    const result = fallbackFilter(MOCK_CLUBS, new Set(), "elite", "all");
    expect(result.map((c) => c.id)).toEqual(["c4"]);
  });

  it("search is case-insensitive", () => {
    const result = fallbackFilter(MOCK_CLUBS, new Set(), "LONDON", "all");
    expect(result.map((c) => c.id)).toEqual(["c1"]);
  });

  it("combines search and category filters", () => {
    // Both c1 ("London Chess Club") and c4 ("Elite tournament chess") match "chess" + "competitive"
    const result = fallbackFilter(MOCK_CLUBS, new Set(), "chess", "competitive");
    expect(result.map((c) => c.id)).toEqual(["c1", "c4"]);
  });

  it("combines search and category filters — narrows to single result", () => {
    // Only c1 has "london" in name/location/tagline and is competitive
    const result = fallbackFilter(MOCK_CLUBS, new Set(), "london", "competitive");
    expect(result.map((c) => c.id)).toEqual(["c1"]);
  });

  it("returns empty array when no clubs match", () => {
    const result = fallbackFilter(MOCK_CLUBS, new Set(), "zzznomatch", "all");
    expect(result).toHaveLength(0);
  });
});
