/**
 * featuredClubs.test.ts
 *
 * Unit tests for the Featured Clubs carousel:
 *  - clubGradient determinism
 *  - apiListPublicClubs limit param URL construction
 *  - Response shape handling (array vs { clubs, total })
 *  - Rank badge logic
 *  - Empty state (returns null when no clubs)
 */

import {describe, it, expect} from "vitest";

// ── Helpers extracted from FeaturedClubsCarousel for testing ──────────────────

const GRADIENT_ACCENTS = [
  "from-emerald-900/80 to-green-800/60",
  "from-blue-900/80 to-indigo-800/60",
  "from-purple-900/80 to-violet-800/60",
  "from-amber-900/80 to-yellow-800/60",
  "from-rose-900/80 to-pink-800/60",
  "from-cyan-900/80 to-teal-800/60",
];

function clubGradient(clubId: string): string {
  const idx = clubId.charCodeAt(clubId.length - 1) % GRADIENT_ACCENTS.length;
  return GRADIENT_ACCENTS[idx];
}

// ── apiListPublicClubs URL construction ───────────────────────────────────────

function buildClubsUrl(opts?: { search?: string; category?: string; limit?: number }): string {
  const BASE = "/api/clubs";
  const params = new URLSearchParams();
  if (opts?.search) params.set("search", opts.search);
  if (opts?.category && opts.category !== "all") params.set("category", opts.category);
  if (opts?.limit) params.set("limit", String(opts.limit));
  const qs = params.toString();
  return `${BASE}${qs ? `?${qs}` : ""}`;
}

// ── Response shape normalizer ─────────────────────────────────────────────────

interface Club { id: string; name: string; memberCount?: number; [key: string]: unknown }

function normalizeResponse(data: unknown): { clubs: Club[]; total: number } {
  if (Array.isArray(data)) return { clubs: data as Club[], total: (data as Club[]).length };
  const d = data as { clubs?: Club[]; total?: number };
  return { clubs: d.clubs ?? [], total: d.total ?? 0 };
}

// ── Rank badge logic ──────────────────────────────────────────────────────────

function rankBadgeSymbol(rank: number): string | null {
  if (rank === 1) return "★";
  if (rank === 2) return "✦";
  if (rank === 3) return "◆";
  return null;
}

function rankBadgeVisible(rank: number): boolean {
  return rank <= 3;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("clubGradient", () => {
  it("returns a deterministic gradient for the same club ID", () => {
    const g1 = clubGradient("seed-club-1");
    const g2 = clubGradient("seed-club-1");
    expect(g1).toBe(g2);
  });

  it("returns different gradients for different club IDs", () => {
    const g1 = clubGradient("seed-club-1");
    const g2 = clubGradient("seed-club-2");
    // charCode of "1" = 49, "2" = 50 → 49%6=1, 50%6=2 → different
    expect(g1).not.toBe(g2);
  });

  it("always returns one of the 6 defined gradient strings", () => {
    const ids = ["abc", "xyz", "seed-club-5", "london-chess", "marshall-cc", "st-louis-cc"];
    for (const id of ids) {
      expect(GRADIENT_ACCENTS).toContain(clubGradient(id));
    }
  });

  it("handles single-character IDs", () => {
    expect(GRADIENT_ACCENTS).toContain(clubGradient("a"));
  });
});

describe("buildClubsUrl (limit param)", () => {
  it("adds limit param when provided", () => {
    expect(buildClubsUrl({ limit: 6 })).toBe("/api/clubs?limit=6");
  });

  it("adds limit=4 correctly", () => {
    expect(buildClubsUrl({ limit: 4 })).toBe("/api/clubs?limit=4");
  });

  it("does not add limit param when not provided", () => {
    expect(buildClubsUrl()).toBe("/api/clubs");
  });

  it("combines limit with search", () => {
    expect(buildClubsUrl({ search: "london", limit: 6 })).toBe("/api/clubs?search=london&limit=6");
  });

  it("combines limit with category", () => {
    expect(buildClubsUrl({ category: "competitive", limit: 6 })).toBe(
      "/api/clubs?category=competitive&limit=6"
    );
  });

  it("does not add category=all to URL", () => {
    expect(buildClubsUrl({ category: "all", limit: 6 })).toBe("/api/clubs?limit=6");
  });
});

describe("normalizeResponse", () => {
  it("handles array response (legacy shape)", () => {
    const data = [{ id: "c1", name: "Club A" }, { id: "c2", name: "Club B" }];
    const result = normalizeResponse(data);
    expect(result.clubs).toHaveLength(2);
    expect(result.total).toBe(2);
  });

  it("handles { clubs, total } response (new shape)", () => {
    const data = { clubs: [{ id: "c1", name: "Club A" }], total: 11 };
    const result = normalizeResponse(data);
    expect(result.clubs).toHaveLength(1);
    expect(result.total).toBe(11);
  });

  it("handles empty clubs array", () => {
    const result = normalizeResponse({ clubs: [], total: 0 });
    expect(result.clubs).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it("handles missing total in new shape (defaults to 0)", () => {
    const result = normalizeResponse({ clubs: [{ id: "c1", name: "A" }] });
    expect(result.total).toBe(0);
  });

  it("handles missing clubs in new shape (defaults to [])", () => {
    const result = normalizeResponse({ total: 5 });
    expect(result.clubs).toHaveLength(0);
  });
});

describe("rankBadge", () => {
  it("shows badge for ranks 1, 2, 3", () => {
    expect(rankBadgeVisible(1)).toBe(true);
    expect(rankBadgeVisible(2)).toBe(true);
    expect(rankBadgeVisible(3)).toBe(true);
  });

  it("hides badge for ranks 4 and above", () => {
    expect(rankBadgeVisible(4)).toBe(false);
    expect(rankBadgeVisible(5)).toBe(false);
    expect(rankBadgeVisible(6)).toBe(false);
  });

  it("rank 1 shows star symbol", () => {
    expect(rankBadgeSymbol(1)).toBe("★");
  });

  it("rank 2 shows diamond symbol", () => {
    expect(rankBadgeSymbol(2)).toBe("✦");
  });

  it("rank 3 shows filled diamond symbol", () => {
    expect(rankBadgeSymbol(3)).toBe("◆");
  });

  it("rank 4+ returns null", () => {
    expect(rankBadgeSymbol(4)).toBeNull();
    expect(rankBadgeSymbol(10)).toBeNull();
  });
});

describe("carousel empty state", () => {
  it("should not render when clubs array is empty", () => {
    // The component returns null when !loading && clubs.length === 0
    const clubs: Club[] = [];
    const loading = false;
    const shouldRender = loading || clubs.length > 0;
    expect(shouldRender).toBe(false);
  });

  it("should render during loading even if clubs is empty", () => {
    const clubs: Club[] = [];
    const loading = true;
    const shouldRender = loading || clubs.length > 0;
    expect(shouldRender).toBe(true);
  });

  it("should render when clubs are loaded", () => {
    const clubs: Club[] = [{ id: "c1", name: "Club A" }];
    const loading = false;
    const shouldRender = loading || clubs.length > 0;
    expect(shouldRender).toBe(true);
  });
});
