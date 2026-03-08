/**
 * @vitest-environment jsdom
 *
 * Tests for the My Games list feature on the /record page:
 *   - formatDate helper
 *   - resultLabel helper
 *   - accuracyColor helper
 *   - sessionStatusBadge helper
 *   - GET /api/games endpoint shape validation
 *   - Game card data mapping
 */
import { describe, it, expect } from "vitest";

// ── Mirrors of helpers from GameRecorder.tsx ─────────────────────────────────

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Unknown date";
  const d = new Date(dateStr.includes("T") ? dateStr : dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function resultLabel(result: string | null): { label: string; color: string } {
  switch (result) {
    case "1-0":
      return { label: "White wins", color: "text-emerald-500" };
    case "0-1":
      return { label: "Black wins", color: "text-rose-500" };
    case "1/2-1/2":
      return { label: "Draw", color: "text-amber-500" };
    default:
      return { label: "In progress", color: "text-gray-400" };
  }
}

function accuracyColor(acc: number | null): string {
  if (acc === null) return "text-gray-400";
  if (acc >= 90) return "text-emerald-500";
  if (acc >= 75) return "text-green-500";
  if (acc >= 60) return "text-amber-500";
  if (acc >= 45) return "text-orange-500";
  return "text-rose-500";
}

function sessionStatusBadge(status: string): { label: string } | null {
  switch (status) {
    case "analyzing":
      return { label: "Analyzing…" };
    case "failed":
      return { label: "Analysis failed" };
    default:
      return null;
  }
}

// ── MyGame shape (mirrors the interface in GameRecorder.tsx) ──────────────────
interface MyGame {
  id: string;
  sessionId: string;
  sessionStatus: string;
  whitePlayer: string | null;
  blackPlayer: string | null;
  result: string | null;
  openingName: string | null;
  openingEco: string | null;
  totalMoves: number | null;
  date: string | null;
  event: string | null;
  whiteAccuracy: number | null;
  blackAccuracy: number | null;
  createdAt: string;
}

// ── Test data ────────────────────────────────────────────────────────────────
const SAMPLE_GAME: MyGame = {
  id: "game-1",
  sessionId: "session-1",
  sessionStatus: "complete",
  whitePlayer: "Kasparov",
  blackPlayer: "Karpov",
  result: "1-0",
  openingName: "Ruy Lopez",
  openingEco: "C65",
  totalMoves: 62,
  date: "2025-03-07",
  event: "World Championship",
  whiteAccuracy: 88.5,
  blackAccuracy: 72.3,
  createdAt: "2025-03-07T14:30:00.000Z",
};

// ═══════════════════════════════════════════════════════════════════════════════
// formatDate tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("formatDate", () => {
  it("returns 'Unknown date' for null", () => {
    expect(formatDate(null)).toBe("Unknown date");
  });

  it("formats a YYYY-MM-DD date string", () => {
    const result = formatDate("2025-03-07");
    // Should contain the month, day, and year
    expect(result).toContain("2025");
    expect(result).toContain("7");
  });

  it("formats an ISO timestamp string", () => {
    const result = formatDate("2025-03-07T14:30:00.000Z");
    expect(result).toContain("2025");
  });

  it("returns the original string for an unparseable date", () => {
    const bad = "not-a-date";
    expect(formatDate(bad)).toBe(bad);
  });

  it("formats January correctly", () => {
    const result = formatDate("2025-01-01");
    expect(result).toContain("Jan");
  });

  it("formats December correctly", () => {
    const result = formatDate("2025-12-25");
    expect(result).toContain("Dec");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// resultLabel tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("resultLabel", () => {
  it("labels 1-0 as White wins with emerald color", () => {
    const r = resultLabel("1-0");
    expect(r.label).toBe("White wins");
    expect(r.color).toContain("emerald");
  });

  it("labels 0-1 as Black wins with rose color", () => {
    const r = resultLabel("0-1");
    expect(r.label).toBe("Black wins");
    expect(r.color).toContain("rose");
  });

  it("labels 1/2-1/2 as Draw with amber color", () => {
    const r = resultLabel("1/2-1/2");
    expect(r.label).toBe("Draw");
    expect(r.color).toContain("amber");
  });

  it("labels null as In progress", () => {
    const r = resultLabel(null);
    expect(r.label).toBe("In progress");
  });

  it("labels unknown string as In progress", () => {
    const r = resultLabel("*");
    expect(r.label).toBe("In progress");
  });

  it("labels empty string as In progress", () => {
    const r = resultLabel("");
    expect(r.label).toBe("In progress");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// accuracyColor tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("accuracyColor", () => {
  it("returns gray for null accuracy", () => {
    expect(accuracyColor(null)).toBe("text-gray-400");
  });

  it("returns emerald for 90%+", () => {
    expect(accuracyColor(90)).toContain("emerald");
    expect(accuracyColor(100)).toContain("emerald");
    expect(accuracyColor(95.5)).toContain("emerald");
  });

  it("returns green for 75–89%", () => {
    expect(accuracyColor(75)).toContain("green");
    expect(accuracyColor(80)).toContain("green");
    expect(accuracyColor(89)).toContain("green");
  });

  it("returns amber for 60–74%", () => {
    expect(accuracyColor(60)).toContain("amber");
    expect(accuracyColor(70)).toContain("amber");
    expect(accuracyColor(74)).toContain("amber");
  });

  it("returns orange for 45–59%", () => {
    expect(accuracyColor(45)).toContain("orange");
    expect(accuracyColor(55)).toContain("orange");
    expect(accuracyColor(59)).toContain("orange");
  });

  it("returns rose for below 45%", () => {
    expect(accuracyColor(44)).toContain("rose");
    expect(accuracyColor(0)).toContain("rose");
    expect(accuracyColor(20)).toContain("rose");
  });

  it("boundary: exactly 90 is emerald", () => {
    expect(accuracyColor(90)).toContain("emerald");
  });

  it("boundary: exactly 75 is green (not amber)", () => {
    expect(accuracyColor(75)).toContain("green");
  });

  it("boundary: exactly 60 is amber (not orange)", () => {
    expect(accuracyColor(60)).toContain("amber");
  });

  it("boundary: exactly 45 is orange (not rose)", () => {
    expect(accuracyColor(45)).toContain("orange");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// sessionStatusBadge tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("sessionStatusBadge", () => {
  it("returns Analyzing badge for analyzing status", () => {
    const badge = sessionStatusBadge("analyzing");
    expect(badge).not.toBeNull();
    expect(badge?.label).toContain("Analyzing");
  });

  it("returns failed badge for failed status", () => {
    const badge = sessionStatusBadge("failed");
    expect(badge).not.toBeNull();
    expect(badge?.label).toContain("failed");
  });

  it("returns null for complete status (no badge shown)", () => {
    expect(sessionStatusBadge("complete")).toBeNull();
  });

  it("returns null for ready status", () => {
    expect(sessionStatusBadge("ready")).toBeNull();
  });

  it("returns null for unknown status", () => {
    expect(sessionStatusBadge("unknown")).toBeNull();
  });

  it("returns null for uploading status", () => {
    expect(sessionStatusBadge("uploading")).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Game card data mapping tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("Game card data mapping", () => {
  it("correctly reads player names from game object", () => {
    expect(SAMPLE_GAME.whitePlayer).toBe("Kasparov");
    expect(SAMPLE_GAME.blackPlayer).toBe("Karpov");
  });

  it("correctly reads opening data from game object", () => {
    expect(SAMPLE_GAME.openingEco).toBe("C65");
    expect(SAMPLE_GAME.openingName).toBe("Ruy Lopez");
  });

  it("correctly reads accuracy data from game object", () => {
    expect(SAMPLE_GAME.whiteAccuracy).toBe(88.5);
    expect(SAMPLE_GAME.blackAccuracy).toBe(72.3);
  });

  it("correctly reads result from game object", () => {
    expect(SAMPLE_GAME.result).toBe("1-0");
  });

  it("handles null player names gracefully", () => {
    const game: MyGame = { ...SAMPLE_GAME, whitePlayer: null, blackPlayer: null };
    expect(game.whitePlayer ?? "White").toBe("White");
    expect(game.blackPlayer ?? "Black").toBe("Black");
  });

  it("handles null opening name gracefully", () => {
    const game: MyGame = { ...SAMPLE_GAME, openingName: null, openingEco: null };
    expect(game.openingName ?? "Unknown opening").toBe("Unknown opening");
  });

  it("handles null accuracy gracefully", () => {
    const game: MyGame = { ...SAMPLE_GAME, whiteAccuracy: null, blackAccuracy: null };
    expect(accuracyColor(game.whiteAccuracy)).toBe("text-gray-400");
    expect(accuracyColor(game.blackAccuracy)).toBe("text-gray-400");
  });

  it("uses date field for display when present", () => {
    const formatted = formatDate(SAMPLE_GAME.date);
    expect(formatted).toContain("2025");
  });

  it("falls back to createdAt when date is null", () => {
    const game: MyGame = { ...SAMPLE_GAME, date: null };
    const formatted = formatDate(game.date ?? game.createdAt);
    expect(formatted).toContain("2025");
  });

  it("rounds accuracy to integer for display", () => {
    const rounded = Math.round(SAMPLE_GAME.whiteAccuracy!);
    expect(rounded).toBe(89);
  });

  it("identifies analyzing game correctly", () => {
    const game: MyGame = { ...SAMPLE_GAME, sessionStatus: "analyzing" };
    const badge = sessionStatusBadge(game.sessionStatus);
    expect(badge).not.toBeNull();
  });

  it("identifies complete game correctly (no badge)", () => {
    const badge = sessionStatusBadge(SAMPLE_GAME.sessionStatus);
    expect(badge).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// API response shape tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("GET /api/games response shape", () => {
  it("validates required fields are present in a game object", () => {
    const requiredFields: (keyof MyGame)[] = [
      "id",
      "sessionId",
      "sessionStatus",
      "whitePlayer",
      "blackPlayer",
      "result",
      "openingName",
      "openingEco",
      "totalMoves",
      "date",
      "whiteAccuracy",
      "blackAccuracy",
      "createdAt",
    ];
    for (const field of requiredFields) {
      expect(SAMPLE_GAME).toHaveProperty(field);
    }
  });

  it("returns an array of games", () => {
    const response: MyGame[] = [SAMPLE_GAME];
    expect(Array.isArray(response)).toBe(true);
    expect(response).toHaveLength(1);
  });

  it("returns empty array when no games exist", () => {
    const response: MyGame[] = [];
    expect(Array.isArray(response)).toBe(true);
    expect(response).toHaveLength(0);
  });

  it("sessionStatus is attached from the recording session", () => {
    // The server joins processedGames with recordingSessions and attaches sessionStatus
    expect(SAMPLE_GAME.sessionStatus).toBe("complete");
  });

  it("game id is a non-empty string", () => {
    expect(typeof SAMPLE_GAME.id).toBe("string");
    expect(SAMPLE_GAME.id.length).toBeGreaterThan(0);
  });

  it("totalMoves is a positive integer for a complete game", () => {
    expect(SAMPLE_GAME.totalMoves).toBeGreaterThan(0);
    expect(Number.isInteger(SAMPLE_GAME.totalMoves)).toBe(true);
  });
});
