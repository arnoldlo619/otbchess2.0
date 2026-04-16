/**
 * openingsExplorer.test.ts — Tests for the openings explorer public API
 * contract and data flow expectations.
 *
 * These tests validate:
 *   - API response shapes
 *   - Filter logic
 *   - Study mode state machine
 *   - Progress tracking data model
 */
import { describe, it, expect } from "vitest";

// ── API Response Shape Tests ─────────────────────────────────────────────────

describe("Openings Catalog API response shape", () => {
  const mockCatalogItem = {
    id: "abc123",
    slug: "sicilian-defense",
    name: "Sicilian Defense",
    side: "black",
    eco: "B20",
    shortDescription: "The most popular reply to 1.e4.",
    difficulty: "intermediate",
    popularity: 95,
    thumbnailFen: "rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq c6 0 2",
    isFeatured: true,
    starterFriendly: false,
    trapPotential: 60,
    strategicComplexity: 80,
    estimatedLineCount: 25,
    lineCount: 10,
    tags: [
      { name: "Counterattack", category: "theme", slug: "counterattack" },
      { name: "Dynamic", category: "style", slug: "dynamic" },
    ],
  };

  it("should have all required card fields", () => {
    const required = [
      "id", "slug", "name", "side", "eco", "shortDescription",
      "difficulty", "popularity", "thumbnailFen", "isFeatured",
      "starterFriendly", "trapPotential", "strategicComplexity",
      "estimatedLineCount", "lineCount", "tags",
    ];
    for (const field of required) {
      expect(mockCatalogItem).toHaveProperty(field);
    }
  });

  it("side should be white or black", () => {
    expect(["white", "black"]).toContain(mockCatalogItem.side);
  });

  it("difficulty should be a valid level", () => {
    expect(["beginner", "intermediate", "advanced", "expert"]).toContain(mockCatalogItem.difficulty);
  });

  it("popularity should be 0-100", () => {
    expect(mockCatalogItem.popularity).toBeGreaterThanOrEqual(0);
    expect(mockCatalogItem.popularity).toBeLessThanOrEqual(100);
  });

  it("thumbnailFen should be a valid FEN string", () => {
    const parts = mockCatalogItem.thumbnailFen.split(" ");
    expect(parts.length).toBeGreaterThanOrEqual(4);
    const ranks = parts[0].split("/");
    expect(ranks.length).toBe(8);
  });

  it("tags should have name, category, and slug", () => {
    for (const tag of mockCatalogItem.tags) {
      expect(tag).toHaveProperty("name");
      expect(tag).toHaveProperty("category");
      expect(tag).toHaveProperty("slug");
    }
  });
});

// ── Filter Logic Tests ───────────────────────────────────────────────────────

describe("Catalog filter logic", () => {
  const openings = [
    { slug: "london", side: "white", difficulty: "beginner", tags: [{ category: "style", slug: "solid" }] },
    { slug: "sicilian", side: "black", difficulty: "intermediate", tags: [{ category: "style", slug: "dynamic" }] },
    { slug: "kings-indian", side: "black", difficulty: "advanced", tags: [{ category: "style", slug: "aggressive" }] },
    { slug: "vienna", side: "white", difficulty: "intermediate", tags: [{ category: "style", slug: "aggressive" }] },
    { slug: "caro-kann", side: "black", difficulty: "beginner", tags: [{ category: "style", slug: "solid" }] },
  ];

  function filterOpenings(
    items: typeof openings,
    filters: { side?: string; difficulty?: string; style?: string },
  ) {
    return items.filter((o) => {
      if (filters.side && o.side !== filters.side) return false;
      if (filters.difficulty && o.difficulty !== filters.difficulty) return false;
      if (filters.style && !o.tags.some((t) => t.slug === filters.style)) return false;
      return true;
    });
  }

  it("should filter by side=white", () => {
    const result = filterOpenings(openings, { side: "white" });
    expect(result.length).toBe(2);
    expect(result.every((o) => o.side === "white")).toBe(true);
  });

  it("should filter by side=black", () => {
    const result = filterOpenings(openings, { side: "black" });
    expect(result.length).toBe(3);
  });

  it("should filter by difficulty", () => {
    const result = filterOpenings(openings, { difficulty: "beginner" });
    expect(result.length).toBe(2);
  });

  it("should filter by style tag", () => {
    const result = filterOpenings(openings, { style: "aggressive" });
    expect(result.length).toBe(2);
  });

  it("should combine multiple filters", () => {
    const result = filterOpenings(openings, { side: "black", difficulty: "beginner" });
    expect(result.length).toBe(1);
    expect(result[0].slug).toBe("caro-kann");
  });

  it("should return all when no filters", () => {
    const result = filterOpenings(openings, {});
    expect(result.length).toBe(5);
  });
});

// ── Study Mode State Machine Tests ───────────────────────────────────────────

describe("Study mode state machine", () => {
  type StudyState = "learn" | "practice" | "drill";

  interface StudySession {
    state: StudyState;
    currentPly: number;
    maxPly: number;
    attempts: number;
    errors: number;
    hintsUsed: number;
    isComplete: boolean;
  }

  function createSession(maxPly: number): StudySession {
    return {
      state: "learn",
      currentPly: 0,
      maxPly,
      attempts: 0,
      errors: 0,
      hintsUsed: 0,
      isComplete: false,
    };
  }

  function advancePly(session: StudySession): StudySession {
    const nextPly = session.currentPly + 1;
    return {
      ...session,
      currentPly: nextPly,
      isComplete: nextPly >= session.maxPly,
    };
  }

  function recordAttempt(session: StudySession, correct: boolean): StudySession {
    return {
      ...session,
      attempts: session.attempts + 1,
      errors: correct ? session.errors : session.errors + 1,
    };
  }

  function useHint(session: StudySession): StudySession {
    return { ...session, hintsUsed: session.hintsUsed + 1 };
  }

  function switchState(session: StudySession, newState: StudyState): StudySession {
    return { ...session, state: newState, currentPly: 0, isComplete: false };
  }

  it("should start in learn state at ply 0", () => {
    const session = createSession(10);
    expect(session.state).toBe("learn");
    expect(session.currentPly).toBe(0);
    expect(session.isComplete).toBe(false);
  });

  it("should advance ply correctly", () => {
    let session = createSession(3);
    session = advancePly(session);
    expect(session.currentPly).toBe(1);
    expect(session.isComplete).toBe(false);
    session = advancePly(session);
    session = advancePly(session);
    expect(session.currentPly).toBe(3);
    expect(session.isComplete).toBe(true);
  });

  it("should track attempts and errors", () => {
    let session = createSession(5);
    session = recordAttempt(session, true);
    session = recordAttempt(session, false);
    session = recordAttempt(session, true);
    expect(session.attempts).toBe(3);
    expect(session.errors).toBe(1);
  });

  it("should track hints used", () => {
    let session = createSession(5);
    session = useHint(session);
    session = useHint(session);
    expect(session.hintsUsed).toBe(2);
  });

  it("should switch states and reset ply", () => {
    let session = createSession(5);
    session = advancePly(session);
    session = advancePly(session);
    expect(session.currentPly).toBe(2);
    session = switchState(session, "practice");
    expect(session.state).toBe("practice");
    expect(session.currentPly).toBe(0);
    expect(session.isComplete).toBe(false);
  });

  it("should calculate accuracy", () => {
    let session = createSession(5);
    session = recordAttempt(session, true);
    session = recordAttempt(session, true);
    session = recordAttempt(session, false);
    const accuracy = session.attempts > 0
      ? Math.round(((session.attempts - session.errors) / session.attempts) * 100)
      : 0;
    expect(accuracy).toBe(67);
  });
});

// ── Progress Data Model Tests ────────────────────────────────────────────────

describe("User progress data model", () => {
  interface LineProgress {
    lineId: string;
    status: "new" | "learning" | "reviewing" | "mastered";
    streak: number;
    accuracy: number;
    totalAttempts: number;
    lastReviewedAt: string | null;
    nextReviewAt: string | null;
    easeFactor: number;
    interval: number;
  }

  function computeNextReview(progress: LineProgress, quality: number): LineProgress {
    // SM-2 simplified
    const newEase = Math.max(1.3, progress.easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
    let newInterval: number;
    let newStreak: number;
    let newStatus: LineProgress["status"];

    if (quality < 3) {
      newInterval = 1;
      newStreak = 0;
      newStatus = "learning";
    } else {
      newStreak = progress.streak + 1;
      if (newStreak === 1) newInterval = 1;
      else if (newStreak === 2) newInterval = 3;
      else newInterval = Math.round(progress.interval * newEase);
      newStatus = newStreak >= 5 ? "mastered" : "reviewing";
    }

    return {
      ...progress,
      streak: newStreak,
      easeFactor: newEase,
      interval: newInterval,
      status: newStatus,
      totalAttempts: progress.totalAttempts + 1,
    };
  }

  const freshProgress: LineProgress = {
    lineId: "line-1",
    status: "new",
    streak: 0,
    accuracy: 0,
    totalAttempts: 0,
    lastReviewedAt: null,
    nextReviewAt: null,
    easeFactor: 2.5,
    interval: 0,
  };

  it("should start with new status", () => {
    expect(freshProgress.status).toBe("new");
    expect(freshProgress.streak).toBe(0);
  });

  it("should move to learning on first correct review", () => {
    const updated = computeNextReview(freshProgress, 4);
    expect(updated.status).toBe("reviewing");
    expect(updated.streak).toBe(1);
    expect(updated.interval).toBe(1);
  });

  it("should reset streak on failed review", () => {
    let progress = computeNextReview(freshProgress, 4);
    progress = computeNextReview(progress, 4);
    expect(progress.streak).toBe(2);
    progress = computeNextReview(progress, 1);
    expect(progress.streak).toBe(0);
    expect(progress.status).toBe("learning");
  });

  it("should reach mastered after 5 consecutive correct reviews", () => {
    let progress = { ...freshProgress };
    for (let i = 0; i < 5; i++) {
      progress = computeNextReview(progress, 5);
    }
    expect(progress.status).toBe("mastered");
    expect(progress.streak).toBe(5);
  });

  it("should increase interval with ease factor", () => {
    let progress = { ...freshProgress };
    const intervals: number[] = [];
    for (let i = 0; i < 6; i++) {
      progress = computeNextReview(progress, 4);
      intervals.push(progress.interval);
    }
    // Intervals should generally increase
    expect(intervals[2]).toBeGreaterThanOrEqual(intervals[1]);
    expect(intervals[4]).toBeGreaterThanOrEqual(intervals[3]);
  });

  it("should decrease ease factor on poor quality", () => {
    const afterGood = computeNextReview(freshProgress, 5);
    const afterBad = computeNextReview(freshProgress, 2);
    expect(afterGood.easeFactor).toBeGreaterThan(afterBad.easeFactor);
  });

  it("should never drop ease factor below 1.3", () => {
    let progress = { ...freshProgress, easeFactor: 1.4 };
    progress = computeNextReview(progress, 0);
    expect(progress.easeFactor).toBeGreaterThanOrEqual(1.3);
  });
});

// ── Category Grouping Tests ──────────────────────────────────────────────────

describe("Category grouping logic", () => {
  interface Opening {
    slug: string;
    side: string;
    family: string;
  }

  function groupByCategory(openings: Opening[]) {
    const white = openings.filter((o) => o.side === "white");
    const blackE4 = openings.filter(
      (o) => o.side === "black" && ["sicilian", "french", "caro-kann", "scandinavian", "pirc"].includes(o.family),
    );
    const blackD4 = openings.filter(
      (o) => o.side === "black" && ["queens-gambit", "kings-indian", "slav", "nimzo-indian", "anti-london"].includes(o.family),
    );
    return { white, blackE4, blackD4 };
  }

  const testOpenings: Opening[] = [
    { slug: "london", side: "white", family: "london" },
    { slug: "vienna", side: "white", family: "vienna" },
    { slug: "sicilian", side: "black", family: "sicilian" },
    { slug: "caro-kann", side: "black", family: "caro-kann" },
    { slug: "kings-indian", side: "black", family: "kings-indian" },
    { slug: "slav", side: "black", family: "slav" },
  ];

  it("should group white openings correctly", () => {
    const { white } = groupByCategory(testOpenings);
    expect(white.length).toBe(2);
    expect(white.every((o) => o.side === "white")).toBe(true);
  });

  it("should group Black vs e4 correctly", () => {
    const { blackE4 } = groupByCategory(testOpenings);
    expect(blackE4.length).toBe(2);
  });

  it("should group Black vs d4 correctly", () => {
    const { blackD4 } = groupByCategory(testOpenings);
    expect(blackD4.length).toBe(2);
  });

  it("should not overlap categories", () => {
    const { white, blackE4, blackD4 } = groupByCategory(testOpenings);
    const allSlugs = [...white, ...blackE4, ...blackD4].map((o) => o.slug);
    const uniqueSlugs = new Set(allSlugs);
    expect(uniqueSlugs.size).toBe(allSlugs.length);
  });
});
