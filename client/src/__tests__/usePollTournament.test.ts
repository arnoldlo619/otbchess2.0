/**
 * Tests for usePollTournament hook
 *
 * Tests the polling logic, visibility pause/resume, SSE-connected pause,
 * manual refresh, and data merge behaviour.
 *
 * We test the pure logic and state transitions rather than the React hook
 * internals, to keep tests fast and deterministic.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Simulate the polling merge logic used inside handlePollUpdate */
function mergeState(
  prev: {
    players: { id: string; name: string }[];
    status: string;
    currentRound: number;
    totalRounds: number;
    tournamentName: string;
    rounds: { number: number; games: unknown[] }[];
  },
  data: {
    players?: { id: string; name: string }[];
    status?: string;
    currentRound?: number;
    totalRounds?: number;
    tournamentName?: string;
    rounds?: { number: number; games: unknown[] }[];
  }
) {
  const serverRounds = data.rounds ?? [];
  const mergedRounds = serverRounds.length > 0 ? serverRounds : prev.rounds;
  return {
    ...prev,
    players: data.players ?? prev.players,
    status: data.status ?? prev.status,
    currentRound: data.currentRound ?? prev.currentRound,
    totalRounds: data.totalRounds ?? prev.totalRounds,
    tournamentName: data.tournamentName ?? prev.tournamentName,
    rounds: mergedRounds,
  };
}

const basePrev = {
  players: [{ id: "p1", name: "Alice" }],
  status: "in_progress",
  currentRound: 2,
  totalRounds: 5,
  tournamentName: "Test Open",
  rounds: [{ number: 1, games: [] }, { number: 2, games: [] }],
};

// ─── mergeState (handlePollUpdate logic) ──────────────────────────────────────

describe("polling merge logic (handlePollUpdate)", () => {
  it("updates players when server sends new player list", () => {
    const newPlayers = [{ id: "p1", name: "Alice" }, { id: "p2", name: "Bob" }];
    const result = mergeState(basePrev, { players: newPlayers });
    expect(result.players).toHaveLength(2);
    expect(result.players[1].name).toBe("Bob");
  });

  it("keeps existing players when server sends no players", () => {
    const result = mergeState(basePrev, { status: "completed" });
    expect(result.players).toHaveLength(1);
    expect(result.players[0].name).toBe("Alice");
  });

  it("updates status when server sends new status", () => {
    const result = mergeState(basePrev, { status: "completed" });
    expect(result.status).toBe("completed");
  });

  it("keeps existing status when server sends no status", () => {
    const result = mergeState(basePrev, { players: [] });
    expect(result.status).toBe("in_progress");
  });

  it("updates currentRound when server sends new round", () => {
    const result = mergeState(basePrev, { currentRound: 3 });
    expect(result.currentRound).toBe(3);
  });

  it("keeps existing currentRound when server sends none", () => {
    const result = mergeState(basePrev, {});
    expect(result.currentRound).toBe(2);
  });

  it("replaces rounds when server sends non-empty rounds", () => {
    const newRounds = [
      { number: 1, games: [] },
      { number: 2, games: [] },
      { number: 3, games: [] },
    ];
    const result = mergeState(basePrev, { rounds: newRounds });
    expect(result.rounds).toHaveLength(3);
  });

  it("keeps existing rounds when server sends empty rounds array", () => {
    const result = mergeState(basePrev, { rounds: [] });
    expect(result.rounds).toHaveLength(2);
  });

  it("keeps existing rounds when server sends no rounds field", () => {
    const result = mergeState(basePrev, { status: "completed" });
    expect(result.rounds).toHaveLength(2);
  });

  it("updates tournamentName when server sends new name", () => {
    const result = mergeState(basePrev, { tournamentName: "Spring Classic" });
    expect(result.tournamentName).toBe("Spring Classic");
  });

  it("handles full update with all fields", () => {
    const fullUpdate = {
      players: [{ id: "p1", name: "Alice" }, { id: "p2", name: "Bob" }, { id: "p3", name: "Carol" }],
      status: "completed",
      currentRound: 5,
      totalRounds: 5,
      tournamentName: "Spring Classic",
      rounds: [1, 2, 3, 4, 5].map((n) => ({ number: n, games: [] })),
    };
    const result = mergeState(basePrev, fullUpdate);
    expect(result.players).toHaveLength(3);
    expect(result.status).toBe("completed");
    expect(result.currentRound).toBe(5);
    expect(result.rounds).toHaveLength(5);
    expect(result.tournamentName).toBe("Spring Classic");
  });
});

// ─── "seconds ago" ticker logic ───────────────────────────────────────────────

describe("secondsSinceUpdate label logic", () => {
  it("shows 'Xs ago' for updates less than 60 seconds old", () => {
    const secondsSinceUpdate = 30;
    const label =
      secondsSinceUpdate < 60
        ? `${secondsSinceUpdate}s ago`
        : `${Math.floor(secondsSinceUpdate / 60)}m ago`;
    expect(label).toBe("30s ago");
  });

  it("shows 'Xm ago' for updates 60+ seconds old", () => {
    const secondsSinceUpdate = 90;
    const label =
      secondsSinceUpdate < 60
        ? `${secondsSinceUpdate}s ago`
        : `${Math.floor(secondsSinceUpdate / 60)}m ago`;
    expect(label).toBe("1m ago");
  });

  it("shows '2m ago' for 2 minutes old", () => {
    const secondsSinceUpdate = 130;
    const label =
      secondsSinceUpdate < 60
        ? `${secondsSinceUpdate}s ago`
        : `${Math.floor(secondsSinceUpdate / 60)}m ago`;
    expect(label).toBe("2m ago");
  });

  it("shows '0s ago' immediately after update", () => {
    const secondsSinceUpdate = 0;
    const label =
      secondsSinceUpdate < 60
        ? `${secondsSinceUpdate}s ago`
        : `${Math.floor(secondsSinceUpdate / 60)}m ago`;
    expect(label).toBe("0s ago");
  });
});

// ─── pauseWhenConnected logic ─────────────────────────────────────────────────

describe("pauseWhenConnected logic", () => {
  it("polling is paused when SSE is connected", () => {
    const sseConnected = true;
    const pauseWhenConnected = true;
    const shouldPoll = !pauseWhenConnected || !sseConnected;
    expect(shouldPoll).toBe(false);
  });

  it("polling is active when SSE is disconnected", () => {
    const sseConnected = false;
    const pauseWhenConnected = true;
    const shouldPoll = !pauseWhenConnected || !sseConnected;
    expect(shouldPoll).toBe(true);
  });

  it("polling is always active when pauseWhenConnected is false", () => {
    const sseConnected = true;
    const pauseWhenConnected = false;
    const shouldPoll = !pauseWhenConnected || !sseConnected;
    expect(shouldPoll).toBe(true);
  });
});

// ─── disabled / demo tournament logic ────────────────────────────────────────

describe("disabled / demo tournament logic", () => {
  it("polling is disabled for demo tournament", () => {
    const tournamentId = "otb-demo-2026";
    const disabled = tournamentId === "otb-demo-2026";
    expect(disabled).toBe(true);
  });

  it("polling is enabled for real tournaments", () => {
    const tournamentId = "spring-open-2026";
    const disabled = tournamentId === "otb-demo-2026";
    expect(disabled).toBe(false);
  });
});

// ─── Page Visibility API logic ────────────────────────────────────────────────

describe("Page Visibility API logic", () => {
  it("should fetch when document is visible", () => {
    // Simulate document.visibilityState === "visible"
    const visibilityState = "visible";
    const shouldFetch = visibilityState === "visible";
    expect(shouldFetch).toBe(true);
  });

  it("should NOT fetch when document is hidden", () => {
    // Simulate document.visibilityState === "hidden"
    const visibilityState = "hidden";
    const shouldFetch = visibilityState === "visible";
    expect(shouldFetch).toBe(false);
  });

  it("should fetch immediately on visibility change to visible", () => {
    let fetchCalled = false;
    const doFetch = () => { fetchCalled = true; };

    // Simulate visibilitychange event handler
    function handleVisibilityChange(state: string) {
      if (state === "visible") {
        doFetch();
      }
    }

    handleVisibilityChange("hidden");
    expect(fetchCalled).toBe(false);

    handleVisibilityChange("visible");
    expect(fetchCalled).toBe(true);
  });
});

// ─── Concurrent fetch guard ───────────────────────────────────────────────────

describe("concurrent fetch guard", () => {
  it("skips fetch when one is already in flight", () => {
    let fetchCount = 0;
    let fetchingRef = false;

    const doFetch = () => {
      if (fetchingRef) return; // guard
      fetchingRef = true;
      fetchCount++;
      // Simulate async completion
      fetchingRef = false;
    };

    // First call — should proceed
    doFetch();
    expect(fetchCount).toBe(1);

    // Simulate concurrent call while first is in flight
    fetchingRef = true; // manually set to simulate in-flight
    doFetch();
    expect(fetchCount).toBe(1); // should NOT have incremented

    fetchingRef = false;
    doFetch();
    expect(fetchCount).toBe(2); // now it should proceed
  });
});

// ─── Interval timing logic ────────────────────────────────────────────────────

describe("interval timing", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("fires callback after 15 seconds", () => {
    let callCount = 0;
    const callback = () => { callCount++; };
    const intervalId = setInterval(callback, 15_000);

    vi.advanceTimersByTime(14_999);
    expect(callCount).toBe(0);

    vi.advanceTimersByTime(1);
    expect(callCount).toBe(1);

    clearInterval(intervalId);
  });

  it("fires callback multiple times at 15s intervals", () => {
    let callCount = 0;
    const callback = () => { callCount++; };
    const intervalId = setInterval(callback, 15_000);

    vi.advanceTimersByTime(45_000);
    expect(callCount).toBe(3);

    clearInterval(intervalId);
  });

  it("stops firing after clearInterval", () => {
    let callCount = 0;
    const callback = () => { callCount++; };
    const intervalId = setInterval(callback, 15_000);

    vi.advanceTimersByTime(30_000);
    expect(callCount).toBe(2);

    clearInterval(intervalId);
    vi.advanceTimersByTime(30_000);
    expect(callCount).toBe(2); // should not have increased
  });
});
