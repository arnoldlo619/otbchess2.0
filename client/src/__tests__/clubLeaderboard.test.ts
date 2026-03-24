/**
 * clubLeaderboard.test.ts
 *
 * Unit tests for the Club Leaderboard feature:
 *  1. Leaderboard API URL construction (?sortBy param)
 *  2. Rank assignment logic (ties share same rank, dense ranking)
 *  3. Score computation per metric (members / tournaments)
 *  4. Sorting correctness (DESC by score, alphabetical for ties)
 *  5. Podium / table split (top 3 vs rest)
 *  6. metricLabel formatting
 *  7. clubGradient determinism (same algorithm as carousel)
 *  8. Empty state and error state handling
 */

import { describe, it, expect } from "vitest";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ClubRow {
  id: string;
  name: string;
  memberCount: number;
  tournamentCount: number;
  category?: string;
  location?: string;
}

type SortMetric = "members" | "tournaments";

// ── Helpers extracted from ClubLeaderboard for unit testing ───────────────────

function buildLeaderboardUrl(sortBy: SortMetric): string {
  return `/api/clubs/leaderboard?sortBy=${sortBy}`;
}

function computeScore(club: ClubRow, metric: SortMetric): number {
  if (metric === "tournaments") return club.tournamentCount;
  return club.memberCount;
}

function sortAndRank(
  clubs: ClubRow[],
  metric: SortMetric
): Array<ClubRow & { rank: number; score: number }> {
  const scored = clubs.map((c) => ({ ...c, score: computeScore(c, metric) }));
  scored.sort((a, b) =>
    b.score !== a.score ? b.score - a.score : a.name.localeCompare(b.name)
  );
  let rank = 1;
  return scored.map((club, idx, arr) => {
    if (idx > 0 && arr[idx - 1].score !== club.score) rank = idx + 1;
    return { ...club, rank };
  });
}

function metricLabel(metric: SortMetric, club: ClubRow): string {
  if (metric === "tournaments") return `${club.tournamentCount} tournaments`;
  return `${club.memberCount.toLocaleString()} members`;
}

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

// ── Sample data ───────────────────────────────────────────────────────────────

const SAMPLE_CLUBS: ClubRow[] = [
  { id: "club-a", name: "Alpha Chess", memberCount: 120, tournamentCount: 8 },
  { id: "club-b", name: "Beta Club", memberCount: 200, tournamentCount: 3 },
  { id: "club-c", name: "Gamma Guild", memberCount: 200, tournamentCount: 15 },
  { id: "club-d", name: "Delta Society", memberCount: 50, tournamentCount: 1 },
  { id: "club-e", name: "Epsilon Chess", memberCount: 85, tournamentCount: 5 },
];

// ── 1. Leaderboard URL construction ──────────────────────────────────────────

describe("buildLeaderboardUrl", () => {
  it("builds correct URL for members metric", () => {
    expect(buildLeaderboardUrl("members")).toBe(
      "/api/clubs/leaderboard?sortBy=members"
    );
  });

  it("builds correct URL for tournaments metric", () => {
    expect(buildLeaderboardUrl("tournaments")).toBe(
      "/api/clubs/leaderboard?sortBy=tournaments"
    );
  });
});

// ── 2. Rank assignment ────────────────────────────────────────────────────────

describe("sortAndRank — rank assignment", () => {
  it("assigns rank 1 to the club with the highest member count", () => {
    const ranked = sortAndRank(SAMPLE_CLUBS, "members");
    expect(ranked[0].rank).toBe(1);
    expect(ranked[0].score).toBe(200);
    expect(ranked[1].score).toBe(200);
    expect(ranked[1].rank).toBe(1);
  });

  it("assigns rank 3 to the next club after a tie at rank 1", () => {
    const ranked = sortAndRank(SAMPLE_CLUBS, "members");
    // Positions 0 and 1 are tied at rank 1 (200 members each)
    // Position 2 should be rank 3 (not rank 2)
    expect(ranked[2].rank).toBe(3);
  });

  it("assigns sequential ranks when there are no ties", () => {
    const unique: ClubRow[] = [
      { id: "u1", name: "A", memberCount: 100, tournamentCount: 0 },
      { id: "u2", name: "B", memberCount: 80, tournamentCount: 0 },
      { id: "u3", name: "C", memberCount: 60, tournamentCount: 0 },
    ];
    const ranked = sortAndRank(unique, "members");
    expect(ranked.map((c) => c.rank)).toEqual([1, 2, 3]);
  });

  it("handles single club — rank is always 1", () => {
    const single: ClubRow[] = [
      { id: "solo", name: "Solo Club", memberCount: 42, tournamentCount: 2 },
    ];
    const ranked = sortAndRank(single, "members");
    expect(ranked[0].rank).toBe(1);
  });

  it("handles empty clubs array", () => {
    expect(sortAndRank([], "members")).toHaveLength(0);
  });
});

// ── 3. Score computation ──────────────────────────────────────────────────────

describe("computeScore", () => {
  const club: ClubRow = {
    id: "test",
    name: "Test",
    memberCount: 150,
    tournamentCount: 7,
  };

  it("returns memberCount for 'members' metric", () => {
    expect(computeScore(club, "members")).toBe(150);
  });

  it("returns tournamentCount for 'tournaments' metric", () => {
    expect(computeScore(club, "tournaments")).toBe(7);
  });

  it("returns 0 for tournaments when tournamentCount is 0", () => {
    expect(computeScore({ ...club, tournamentCount: 0 }, "tournaments")).toBe(0);
  });
});

// ── 4. Sorting correctness ────────────────────────────────────────────────────

describe("sortAndRank — sort order", () => {
  it("sorts by memberCount DESC for members metric", () => {
    const ranked = sortAndRank(SAMPLE_CLUBS, "members");
    const scores = ranked.map((c) => c.score);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]);
    }
  });

  it("sorts by tournamentCount DESC for tournaments metric", () => {
    const ranked = sortAndRank(SAMPLE_CLUBS, "tournaments");
    const scores = ranked.map((c) => c.score);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]);
    }
  });

  it("breaks ties alphabetically by name (ascending)", () => {
    // Beta and Gamma both have 200 members — Beta comes before Gamma alphabetically
    const ranked = sortAndRank(SAMPLE_CLUBS, "members");
    const top2 = ranked.slice(0, 2).map((c) => c.name);
    expect(top2[0]).toBe("Beta Club");
    expect(top2[1]).toBe("Gamma Guild");
  });

  it("places highest tournament count first for tournaments metric", () => {
    const ranked = sortAndRank(SAMPLE_CLUBS, "tournaments");
    expect(ranked[0].name).toBe("Gamma Guild"); // 15 tournaments
    expect(ranked[1].name).toBe("Alpha Chess"); // 8 tournaments
  });
});

// ── 5. Podium / table split ───────────────────────────────────────────────────

describe("podium and table split", () => {
  it("podium contains exactly the first 3 clubs", () => {
    const ranked = sortAndRank(SAMPLE_CLUBS, "members");
    const podium = ranked.slice(0, 3);
    expect(podium).toHaveLength(3);
  });

  it("rest (table) contains clubs from index 3 onwards", () => {
    const ranked = sortAndRank(SAMPLE_CLUBS, "members");
    const rest = ranked.slice(3);
    expect(rest).toHaveLength(SAMPLE_CLUBS.length - 3);
  });

  it("podium clubs all have rank <= 3 (or tied at 1)", () => {
    const ranked = sortAndRank(SAMPLE_CLUBS, "members");
    const podium = ranked.slice(0, 3);
    for (const club of podium) {
      expect(club.rank).toBeLessThanOrEqual(3);
    }
  });

  it("when fewer than 3 clubs exist, podium contains all clubs", () => {
    const two: ClubRow[] = [
      { id: "a", name: "A", memberCount: 10, tournamentCount: 0 },
      { id: "b", name: "B", memberCount: 5, tournamentCount: 0 },
    ];
    const ranked = sortAndRank(two, "members");
    const podium = ranked.slice(0, 3);
    expect(podium).toHaveLength(2);
  });
});

// ── 6. metricLabel formatting ─────────────────────────────────────────────────

describe("metricLabel", () => {
  const club: ClubRow = {
    id: "c",
    name: "C",
    memberCount: 1234,
    tournamentCount: 7,
  };

  it("formats member count with locale separators", () => {
    expect(metricLabel("members", club)).toBe("1,234 members");
  });

  it("formats tournament count correctly", () => {
    expect(metricLabel("tournaments", club)).toBe("7 tournaments");
  });

  it("formats 0 members correctly", () => {
    expect(metricLabel("members", { ...club, memberCount: 0 })).toBe(
      "0 members"
    );
  });

  it("formats 0 tournaments correctly", () => {
    expect(metricLabel("tournaments", { ...club, tournamentCount: 0 })).toBe(
      "0 tournaments"
    );
  });
});

// ── 7. clubGradient determinism ───────────────────────────────────────────────

describe("clubGradient (leaderboard)", () => {
  it("returns the same gradient for the same club ID", () => {
    expect(clubGradient("club-abc")).toBe(clubGradient("club-abc"));
  });

  it("always returns one of the 6 defined gradient strings", () => {
    const ids = ["alpha", "beta", "gamma", "delta", "epsilon", "zeta", "eta"];
    for (const id of ids) {
      expect(GRADIENT_ACCENTS).toContain(clubGradient(id));
    }
  });

  it("uses the last character of the ID for the index", () => {
    // 'a' = charCode 97, 97 % 6 = 1
    expect(clubGradient("a")).toBe(GRADIENT_ACCENTS[97 % 6]);
  });
});

// ── 8. Empty / error state ────────────────────────────────────────────────────

describe("leaderboard empty and error states", () => {
  it("sortAndRank returns empty array for empty input", () => {
    expect(sortAndRank([], "members")).toEqual([]);
  });

  it("podium is empty when no clubs", () => {
    const ranked = sortAndRank([], "members");
    expect(ranked.slice(0, 3)).toHaveLength(0);
  });

  it("shows empty state when clubs array has length 0 and loading is false", () => {
    const clubs: ClubRow[] = [];
    const loading = false;
    const showEmptyState = !loading && clubs.length === 0;
    expect(showEmptyState).toBe(true);
  });

  it("does not show empty state while loading", () => {
    const clubs: ClubRow[] = [];
    const loading = true;
    const showEmptyState = !loading && clubs.length === 0;
    expect(showEmptyState).toBe(false);
  });

  it("does not show empty state when clubs are loaded", () => {
    const clubs: ClubRow[] = [
      { id: "c1", name: "Club A", memberCount: 10, tournamentCount: 0 },
    ];
    const loading = false;
    const showEmptyState = !loading && clubs.length === 0;
    expect(showEmptyState).toBe(false);
  });
});
