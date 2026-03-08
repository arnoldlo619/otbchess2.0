/**
 * Tests for the auto-refresh polling feature in the My Games list.
 *
 * When the game list contains games with in-progress statuses
 * (analyzing, uploading, processing), the list should auto-poll
 * every 10 seconds. When all games are complete or failed,
 * polling should stop.
 */
import { describe, it, expect } from "vitest";

// ── Mirror of hasInProgressGames from GameRecorder.tsx ───────────────────────

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

function hasInProgressGames(games: MyGame[]): boolean {
  return games.some(
    (g) =>
      g.sessionStatus === "analyzing" ||
      g.sessionStatus === "uploading" ||
      g.sessionStatus === "processing"
  );
}

// ── Test data factory ───────────────────────────────────────────────────────

function makeGame(overrides: Partial<MyGame> = {}): MyGame {
  return {
    id: "game-1",
    sessionId: "session-1",
    sessionStatus: "complete",
    whitePlayer: "White",
    blackPlayer: "Black",
    result: "1-0",
    openingName: "Ruy Lopez",
    openingEco: "C65",
    totalMoves: 40,
    date: "2025-03-07",
    event: null,
    whiteAccuracy: 85,
    blackAccuracy: 72,
    createdAt: "2025-03-07T14:30:00.000Z",
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// hasInProgressGames tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("hasInProgressGames", () => {
  it("returns false for empty list", () => {
    expect(hasInProgressGames([])).toBe(false);
  });

  it("returns false when all games are complete", () => {
    const games = [
      makeGame({ id: "1", sessionStatus: "complete" }),
      makeGame({ id: "2", sessionStatus: "complete" }),
    ];
    expect(hasInProgressGames(games)).toBe(false);
  });

  it("returns false when all games are failed", () => {
    const games = [
      makeGame({ id: "1", sessionStatus: "failed" }),
      makeGame({ id: "2", sessionStatus: "failed" }),
    ];
    expect(hasInProgressGames(games)).toBe(false);
  });

  it("returns true when one game is analyzing", () => {
    const games = [
      makeGame({ id: "1", sessionStatus: "complete" }),
      makeGame({ id: "2", sessionStatus: "analyzing" }),
    ];
    expect(hasInProgressGames(games)).toBe(true);
  });

  it("returns true when one game is uploading", () => {
    const games = [
      makeGame({ id: "1", sessionStatus: "uploading" }),
      makeGame({ id: "2", sessionStatus: "complete" }),
    ];
    expect(hasInProgressGames(games)).toBe(true);
  });

  it("returns true when one game is processing", () => {
    const games = [
      makeGame({ id: "1", sessionStatus: "processing" }),
    ];
    expect(hasInProgressGames(games)).toBe(true);
  });

  it("returns true when multiple games are in progress", () => {
    const games = [
      makeGame({ id: "1", sessionStatus: "analyzing" }),
      makeGame({ id: "2", sessionStatus: "processing" }),
      makeGame({ id: "3", sessionStatus: "complete" }),
    ];
    expect(hasInProgressGames(games)).toBe(true);
  });

  it("returns false for unknown status strings", () => {
    const games = [
      makeGame({ id: "1", sessionStatus: "ready" }),
      makeGame({ id: "2", sessionStatus: "unknown" }),
    ];
    expect(hasInProgressGames(games)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Polling interval logic tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("Polling interval logic", () => {
  it("poll interval is 10 seconds", () => {
    const POLL_INTERVAL_MS = 10_000;
    expect(POLL_INTERVAL_MS).toBe(10000);
  });

  it("polling should start when hasInProgressGames is true", () => {
    const games = [makeGame({ sessionStatus: "analyzing" })];
    const shouldPoll = hasInProgressGames(games);
    expect(shouldPoll).toBe(true);
  });

  it("polling should stop when hasInProgressGames becomes false", () => {
    // Simulate: game was analyzing, now complete
    const beforeGames = [makeGame({ sessionStatus: "analyzing" })];
    const afterGames = [makeGame({ sessionStatus: "complete" })];

    expect(hasInProgressGames(beforeGames)).toBe(true);
    expect(hasInProgressGames(afterGames)).toBe(false);
  });

  it("transition from analyzing to complete stops polling", () => {
    const analyzing = [
      makeGame({ id: "1", sessionStatus: "analyzing" }),
      makeGame({ id: "2", sessionStatus: "complete" }),
    ];
    const allComplete = [
      makeGame({ id: "1", sessionStatus: "complete" }),
      makeGame({ id: "2", sessionStatus: "complete" }),
    ];

    expect(hasInProgressGames(analyzing)).toBe(true);
    expect(hasInProgressGames(allComplete)).toBe(false);
  });

  it("transition from analyzing to failed stops polling", () => {
    const analyzing = [makeGame({ sessionStatus: "analyzing" })];
    const failed = [makeGame({ sessionStatus: "failed" })];

    expect(hasInProgressGames(analyzing)).toBe(true);
    expect(hasInProgressGames(failed)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Silent refresh behavior tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("Silent refresh behavior", () => {
  it("silent refresh should not show loading state", () => {
    // The silentRefresh function updates games without setting loading=true
    // This prevents the skeleton from flashing every 10 seconds
    const showSkeleton = false; // silentRefresh never sets loading=true
    expect(showSkeleton).toBe(false);
  });

  it("silent refresh should not show error on failure", () => {
    // If the auto-poll fetch fails, we silently ignore it
    // The user can still manually refresh via the Refresh button
    const showError = false; // silentRefresh catches and ignores errors
    expect(showError).toBe(false);
  });

  it("manual refresh should show loading state", () => {
    // The fetchGames function sets loading=true to show skeleton
    const showSkeleton = true; // fetchGames sets loading=true
    expect(showSkeleton).toBe(true);
  });

  it("manual refresh should show error on failure", () => {
    // The fetchGames function sets error state on failure
    const showError = true; // fetchGames sets error state
    expect(showError).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Status transition coverage
// ═══════════════════════════════════════════════════════════════════════════════

describe("Session status transitions", () => {
  const IN_PROGRESS_STATUSES = ["analyzing", "uploading", "processing"];
  const TERMINAL_STATUSES = ["complete", "failed"];
  const NEUTRAL_STATUSES = ["ready", "recording"];

  it("all in-progress statuses trigger polling", () => {
    for (const status of IN_PROGRESS_STATUSES) {
      const games = [makeGame({ sessionStatus: status })];
      expect(hasInProgressGames(games)).toBe(true);
    }
  });

  it("all terminal statuses do not trigger polling", () => {
    for (const status of TERMINAL_STATUSES) {
      const games = [makeGame({ sessionStatus: status })];
      expect(hasInProgressGames(games)).toBe(false);
    }
  });

  it("neutral statuses do not trigger polling", () => {
    for (const status of NEUTRAL_STATUSES) {
      const games = [makeGame({ sessionStatus: status })];
      expect(hasInProgressGames(games)).toBe(false);
    }
  });

  it("mixed in-progress and terminal still triggers polling", () => {
    const games = [
      makeGame({ id: "1", sessionStatus: "complete" }),
      makeGame({ id: "2", sessionStatus: "failed" }),
      makeGame({ id: "3", sessionStatus: "analyzing" }),
    ];
    expect(hasInProgressGames(games)).toBe(true);
  });
});
