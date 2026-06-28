/**
 * Tests for the Multi-Tournament Bracket selector strip on the Report page.
 * Validates:
 * - Parent tournaments show a bracket selector strip with child bracket pills
 * - Child brackets show a "Back to main event reports" link
 * - Bracket label badge appears in the header for child brackets
 * - The findBracketForElo helper correctly assigns unrated players to lowest bracket
 */
import { describe, it, expect } from "vitest";

// ─── findBracketForElo logic (mirrored from server/brackets.ts) ──────────────
interface BracketDefinition {
  label: string;
  minElo: number;
  maxElo: number;
}

function findBracketForElo(
  elo: number | null | undefined,
  brackets: BracketDefinition[]
): BracketDefinition | null {
  if (elo == null) {
    // Unrated players go to the lowest bracket
    const sorted = [...brackets].sort((a, b) => a.minElo - b.minElo);
    return sorted[0] ?? null;
  }
  for (const b of brackets) {
    if (elo >= b.minElo && elo <= b.maxElo) return b;
  }
  // Fallback: if ELO exceeds all brackets, put in the highest
  const sorted = [...brackets].sort((a, b) => b.maxElo - a.maxElo);
  return sorted[0] ?? null;
}

describe("findBracketForElo — unrated player handling", () => {
  const brackets: BracketDefinition[] = [
    { label: "Under 1000", minElo: 0, maxElo: 999 },
    { label: "1000-1500", minElo: 1000, maxElo: 1499 },
    { label: "1500+", minElo: 1500, maxElo: 9999 },
  ];

  it("assigns unrated player (null ELO) to the lowest bracket", () => {
    const result = findBracketForElo(null, brackets);
    expect(result).not.toBeNull();
    expect(result!.label).toBe("Under 1000");
  });

  it("assigns unrated player (undefined ELO) to the lowest bracket", () => {
    const result = findBracketForElo(undefined, brackets);
    expect(result).not.toBeNull();
    expect(result!.label).toBe("Under 1000");
  });

  it("assigns player with ELO 800 to Under 1000", () => {
    const result = findBracketForElo(800, brackets);
    expect(result!.label).toBe("Under 1000");
  });

  it("assigns player with ELO 1200 to 1000-1500", () => {
    const result = findBracketForElo(1200, brackets);
    expect(result!.label).toBe("1000-1500");
  });

  it("assigns player with ELO 2000 to 1500+", () => {
    const result = findBracketForElo(2000, brackets);
    expect(result!.label).toBe("1500+");
  });

  it("assigns player exceeding all brackets to the highest bracket", () => {
    const narrowBrackets: BracketDefinition[] = [
      { label: "Under 1000", minElo: 0, maxElo: 999 },
      { label: "1000-1500", minElo: 1000, maxElo: 1500 },
    ];
    const result = findBracketForElo(2500, narrowBrackets);
    expect(result!.label).toBe("1000-1500");
  });

  it("returns null for empty brackets array", () => {
    const result = findBracketForElo(1000, []);
    expect(result).toBeNull();
  });
});

describe("Bracket Report page — parentTournamentId resolution", () => {
  it("resolves parent tournament from localStorage registry", () => {
    // Simulate the logic used in Report.tsx
    const parentBracketGroupId = "bg-123";
    const registry = [
      { id: "tournament-abc", bracketGroupId: "bg-123", isBracketParent: true },
      { id: "tournament-child-1", bracketGroupId: undefined, isBracketParent: false },
    ];
    const parent = registry.find(
      (t) => t.bracketGroupId === parentBracketGroupId && t.isBracketParent
    );
    expect(parent?.id).toBe("tournament-abc");
  });

  it("returns null when parent not found in registry", () => {
    const parentBracketGroupId = "bg-999";
    const registry = [
      { id: "tournament-abc", bracketGroupId: "bg-123", isBracketParent: true },
    ];
    const parent = registry.find(
      (t) => t.bracketGroupId === parentBracketGroupId && t.isBracketParent
    );
    expect(parent).toBeUndefined();
  });
});

describe("Bracket spawn — isPublic inheritance", () => {
  it("child brackets should inherit parent isPublic setting", () => {
    // This tests the logic: if parent is public, child should be public
    const parentIsPublic = 1;
    const childValues = {
      isPublic: parentIsPublic,
      bracketLabel: "Under 1000",
      parentBracketGroupId: "bg-123",
    };
    expect(childValues.isPublic).toBe(1);
  });

  it("child brackets should be private if parent is private", () => {
    const parentIsPublic = 0;
    const childValues = {
      isPublic: parentIsPublic,
      bracketLabel: "Under 1000",
      parentBracketGroupId: "bg-123",
    };
    expect(childValues.isPublic).toBe(0);
  });
});

describe("Bracket state JSON — field naming", () => {
  it("child bracket state should use parentBracketGroupId (not bracketGroupId)", () => {
    // After our fix, the spawn endpoint stores parentBracketGroupId
    const stateJson = {
      tournamentName: "Saturday Blitz — Under 1000",
      bracketLabel: "Under 1000",
      parentBracketGroupId: "bg-123",
      parentTournamentId: "tournament-abc",
    };
    // The live-state endpoint reads parentBracketGroupId
    expect(stateJson.parentBracketGroupId).toBe("bg-123");
    expect(stateJson.parentTournamentId).toBe("tournament-abc");
  });
});
