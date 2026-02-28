// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useRoundTimer, DEFAULT_DURATION_MIN, DEFAULT_NEAR_END_SEC } from "../useRoundTimer";

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

// ─── Initial state ────────────────────────────────────────────────────────────

describe("initial state", () => {
  it("starts in idle status", () => {
    const { result } = renderHook(() => useRoundTimer());
    expect(result.current.status).toBe("idle");
  });

  it("uses DEFAULT_DURATION_MIN when no option provided", () => {
    const { result } = renderHook(() => useRoundTimer());
    expect(result.current.durationSec).toBe(DEFAULT_DURATION_MIN * 60);
  });

  it("uses provided initialDurationMin", () => {
    const { result } = renderHook(() => useRoundTimer({ initialDurationMin: 20 }));
    expect(result.current.durationSec).toBe(1200);
  });

  it("starts with 0 elapsed and full remaining", () => {
    const { result } = renderHook(() => useRoundTimer({ initialDurationMin: 10 }));
    expect(result.current.elapsedSec).toBe(0);
    expect(result.current.remainingSec).toBe(600);
  });

  it("nearEndFired is false initially", () => {
    const { result } = renderHook(() => useRoundTimer());
    expect(result.current.nearEndFired).toBe(false);
  });
});

// ─── start / pause / reset ────────────────────────────────────────────────────

describe("start", () => {
  it("transitions status from idle to running", () => {
    const { result } = renderHook(() => useRoundTimer({ initialDurationMin: 10 }));
    act(() => { result.current.start(); });
    expect(result.current.status).toBe("running");
  });

  it("transitions status from paused to running", () => {
    const { result } = renderHook(() => useRoundTimer({ initialDurationMin: 10 }));
    act(() => { result.current.start(); });
    act(() => { result.current.pause(); });
    act(() => { result.current.start(); });
    expect(result.current.status).toBe("running");
  });

  it("does not restart if already running", () => {
    const { result } = renderHook(() => useRoundTimer({ initialDurationMin: 10 }));
    act(() => { result.current.start(); });
    act(() => { result.current.start(); }); // second call should be a no-op
    expect(result.current.status).toBe("running");
  });
});

describe("pause", () => {
  it("transitions status from running to paused", () => {
    const { result } = renderHook(() => useRoundTimer({ initialDurationMin: 10 }));
    act(() => { result.current.start(); });
    act(() => { result.current.pause(); });
    expect(result.current.status).toBe("paused");
  });

  it("does nothing when already idle", () => {
    const { result } = renderHook(() => useRoundTimer({ initialDurationMin: 10 }));
    act(() => { result.current.pause(); });
    expect(result.current.status).toBe("idle");
  });
});

describe("reset", () => {
  it("returns status to idle", () => {
    const { result } = renderHook(() => useRoundTimer({ initialDurationMin: 10 }));
    act(() => { result.current.start(); });
    act(() => { result.current.reset(); });
    expect(result.current.status).toBe("idle");
  });

  it("resets elapsedSec to 0", () => {
    const { result } = renderHook(() => useRoundTimer({ initialDurationMin: 10 }));
    act(() => { result.current.start(); });
    act(() => { result.current.reset(); });
    expect(result.current.elapsedSec).toBe(0);
  });

  it("resets nearEndFired to false", () => {
    const onNearEnd = vi.fn();
    const { result } = renderHook(() =>
      useRoundTimer({ initialDurationMin: 10, nearEndThresholdSec: 300, onNearEnd })
    );
    act(() => { result.current.start(); });
    act(() => { result.current.reset(); });
    expect(result.current.nearEndFired).toBe(false);
  });
});

// ─── setDurationMin ───────────────────────────────────────────────────────────

describe("setDurationMin", () => {
  it("updates durationSec correctly", () => {
    const { result } = renderHook(() => useRoundTimer({ initialDurationMin: 10 }));
    act(() => { result.current.setDurationMin(45); });
    expect(result.current.durationSec).toBe(2700);
  });

  it("resets timer to idle when called", () => {
    const { result } = renderHook(() => useRoundTimer({ initialDurationMin: 10 }));
    act(() => { result.current.start(); });
    act(() => { result.current.setDurationMin(20); });
    expect(result.current.status).toBe("idle");
    expect(result.current.elapsedSec).toBe(0);
  });

  it("clamps minimum duration to 1 minute", () => {
    const { result } = renderHook(() => useRoundTimer());
    act(() => { result.current.setDurationMin(0); });
    expect(result.current.durationSec).toBe(60);
  });
});

// ─── nearEndFired / onNearEnd callback ───────────────────────────────────────

describe("nearEnd callback", () => {
  it("does not fire onNearEnd before threshold", () => {
    const onNearEnd = vi.fn();
    const { result } = renderHook(() =>
      useRoundTimer({ initialDurationMin: 10, nearEndThresholdSec: 60, onNearEnd })
    );
    act(() => { result.current.start(); });
    // Advance 8 minutes (480s) — 2 min remaining, above 60s threshold
    act(() => { vi.advanceTimersByTime(8 * 60 * 1000); });
    expect(onNearEnd).not.toHaveBeenCalled();
  });
});

// ─── auto-reset on roundNumber change ────────────────────────────────────────

describe("auto-reset on roundNumber change", () => {
  it("resets timer when roundNumber prop changes", () => {
    let round = 1;
    const { result, rerender } = renderHook(() =>
      useRoundTimer({ initialDurationMin: 10, roundNumber: round })
    );

    act(() => { result.current.start(); });
    expect(result.current.status).toBe("running");

    round = 2;
    rerender();

    expect(result.current.status).toBe("idle");
    expect(result.current.elapsedSec).toBe(0);
  });

  it("does not reset on initial mount (only on subsequent changes)", () => {
    const { result } = renderHook(() =>
      useRoundTimer({ initialDurationMin: 10, roundNumber: 1 })
    );
    // Timer starts idle — no spurious reset
    expect(result.current.status).toBe("idle");
  });
});
