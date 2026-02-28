// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useUndoResult, UNDO_DURATION_MS } from "../useUndoResult";
import type { Result } from "@/lib/tournamentData";

// Use fake timers for deterministic timeout testing
beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

function makeEnterResult() {
  return vi.fn<[string, Result], void>();
}

// ─── recordWithUndo ───────────────────────────────────────────────────────────

describe("recordWithUndo", () => {
  it("calls enterResult immediately with the new result", () => {
    const enterResult = makeEnterResult();
    const { result } = renderHook(() => useUndoResult(enterResult));

    act(() => {
      result.current.recordWithUndo("g1", "1-0", "*", "Board 1: White wins");
    });

    expect(enterResult).toHaveBeenCalledOnce();
    expect(enterResult).toHaveBeenCalledWith("g1", "1-0");
  });

  it("sets pending with the correct fields", () => {
    const enterResult = makeEnterResult();
    const { result } = renderHook(() => useUndoResult(enterResult));

    act(() => {
      result.current.recordWithUndo("g2", "½-½", "*", "Board 2: Draw");
    });

    expect(result.current.pending).not.toBeNull();
    expect(result.current.pending?.gameId).toBe("g2");
    expect(result.current.pending?.newResult).toBe("½-½");
    expect(result.current.pending?.prevResult).toBe("*");
    expect(result.current.pending?.label).toBe("Board 2: Draw");
  });

  it("auto-dismisses pending after UNDO_DURATION_MS", () => {
    const enterResult = makeEnterResult();
    const { result } = renderHook(() => useUndoResult(enterResult));

    act(() => {
      result.current.recordWithUndo("g1", "0-1", "*", "Board 1: Black wins");
    });

    expect(result.current.pending).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(UNDO_DURATION_MS);
    });

    expect(result.current.pending).toBeNull();
  });

  it("does NOT revert the result on auto-dismiss (result stays)", () => {
    const enterResult = makeEnterResult();
    const { result } = renderHook(() => useUndoResult(enterResult));

    act(() => {
      result.current.recordWithUndo("g1", "1-0", "*", "Board 1: White wins");
    });

    act(() => {
      vi.advanceTimersByTime(UNDO_DURATION_MS);
    });

    // enterResult called only once (on record), not again on timeout
    expect(enterResult).toHaveBeenCalledOnce();
  });

  it("replaces a pending undo when a new result is recorded", () => {
    const enterResult = makeEnterResult();
    const { result } = renderHook(() => useUndoResult(enterResult));

    act(() => {
      result.current.recordWithUndo("g1", "1-0", "*", "Board 1: White wins");
    });

    act(() => {
      result.current.recordWithUndo("g2", "0-1", "*", "Board 2: Black wins");
    });

    expect(result.current.pending?.gameId).toBe("g2");
    expect(result.current.pending?.label).toBe("Board 2: Black wins");
  });

  it("resets the 5-second timer when a new result replaces the pending undo", () => {
    const enterResult = makeEnterResult();
    const { result } = renderHook(() => useUndoResult(enterResult));

    act(() => {
      result.current.recordWithUndo("g1", "1-0", "*", "Board 1");
    });

    // Advance 3 seconds — still within window
    act(() => { vi.advanceTimersByTime(3000); });
    expect(result.current.pending).not.toBeNull();

    // Record a new result — timer resets
    act(() => {
      result.current.recordWithUndo("g2", "0-1", "*", "Board 2");
    });

    // Advance 3 more seconds — if timer hadn't reset, g1 would have expired
    act(() => { vi.advanceTimersByTime(3000); });
    expect(result.current.pending).not.toBeNull(); // g2 still within its 5s window
    expect(result.current.pending?.gameId).toBe("g2");

    // Advance remaining 2 seconds — g2 now expires
    act(() => { vi.advanceTimersByTime(2000); });
    expect(result.current.pending).toBeNull();
  });
});

// ─── undo ─────────────────────────────────────────────────────────────────────

describe("undo", () => {
  it("calls enterResult with the previous result", () => {
    const enterResult = makeEnterResult();
    const { result } = renderHook(() => useUndoResult(enterResult));

    act(() => {
      result.current.recordWithUndo("g1", "1-0", "*", "Board 1: White wins");
    });

    act(() => {
      result.current.undo();
    });

    expect(enterResult).toHaveBeenCalledTimes(2);
    expect(enterResult).toHaveBeenNthCalledWith(2, "g1", "*");
  });

  it("clears pending after undo", () => {
    const enterResult = makeEnterResult();
    const { result } = renderHook(() => useUndoResult(enterResult));

    act(() => {
      result.current.recordWithUndo("g1", "1-0", "*", "Board 1");
    });

    act(() => {
      result.current.undo();
    });

    expect(result.current.pending).toBeNull();
  });

  it("cancels the auto-dismiss timer on undo", () => {
    const enterResult = makeEnterResult();
    const { result } = renderHook(() => useUndoResult(enterResult));

    act(() => {
      result.current.recordWithUndo("g1", "1-0", "*", "Board 1");
    });

    act(() => {
      result.current.undo();
    });

    // Advance past the original timeout — enterResult should NOT be called again
    act(() => { vi.advanceTimersByTime(UNDO_DURATION_MS); });
    expect(enterResult).toHaveBeenCalledTimes(2); // record + undo only
  });

  it("does nothing when there is no pending undo", () => {
    const enterResult = makeEnterResult();
    const { result } = renderHook(() => useUndoResult(enterResult));

    act(() => {
      result.current.undo();
    });

    expect(enterResult).not.toHaveBeenCalled();
  });
});

// ─── dismiss ─────────────────────────────────────────────────────────────────

describe("dismiss", () => {
  it("clears pending without reverting the result", () => {
    const enterResult = makeEnterResult();
    const { result } = renderHook(() => useUndoResult(enterResult));

    act(() => {
      result.current.recordWithUndo("g1", "1-0", "*", "Board 1");
    });

    act(() => {
      result.current.dismiss();
    });

    expect(result.current.pending).toBeNull();
    expect(enterResult).toHaveBeenCalledOnce(); // only the initial record
  });

  it("cancels the auto-dismiss timer on manual dismiss", () => {
    const enterResult = makeEnterResult();
    const { result } = renderHook(() => useUndoResult(enterResult));

    act(() => {
      result.current.recordWithUndo("g1", "1-0", "*", "Board 1");
    });

    act(() => {
      result.current.dismiss();
    });

    // Advance past timeout — should not trigger any additional state changes
    act(() => { vi.advanceTimersByTime(UNDO_DURATION_MS); });
    expect(result.current.pending).toBeNull();
  });
});
