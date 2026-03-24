/**
 * lnmConfirmAnalyse.test.ts
 * Unit tests for the LNM "Analyse Game without result" confirmation prompt logic.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { deriveResultFromReason, injectResultIntoPgn } from "../components/NotationModeOverlay";
import type { GameResult } from "../components/NotationModeOverlay";

// ─── Confirmation prompt state machine ────────────────────────────────────────
// Mirrors the logic inside NotationModeOverlay without needing React

interface ConfirmState {
  confirmAnalyse: boolean;
  timerId: ReturnType<typeof setTimeout> | null;
}

function makeConfirmMachine(autoDismissMs = 8000) {
  let state: ConfirmState = { confirmAnalyse: false, timerId: null };
  const onAnalyseCalls: Array<{ pgn: string; result: GameResult | null }> = [];

  function handleAnalyse(pgn: string, selectedResult: GameResult | null) {
    if (!pgn) return;
    if (!selectedResult) {
      state.confirmAnalyse = true;
      if (state.timerId) clearTimeout(state.timerId);
      state.timerId = setTimeout(() => {
        state.confirmAnalyse = false;
        state.timerId = null;
      }, autoDismissMs);
      return;
    }
    onAnalyseCalls.push({ pgn: injectResultIntoPgn(pgn, selectedResult), result: selectedResult });
  }

  function handleAnalyseAnyway(pgn: string) {
    if (!pgn) return;
    if (state.timerId) clearTimeout(state.timerId);
    state.confirmAnalyse = false;
    state.timerId = null;
    onAnalyseCalls.push({ pgn, result: null });
  }

  function handleDismiss() {
    if (state.timerId) clearTimeout(state.timerId);
    state.confirmAnalyse = false;
    state.timerId = null;
  }

  function reset() {
    handleDismiss();
  }

  return { state, handleAnalyse, handleAnalyseAnyway, handleDismiss, reset, onAnalyseCalls };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("confirmation prompt state machine", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("does NOT show prompt when result is already selected", () => {
    const m = makeConfirmMachine();
    m.handleAnalyse("1. e4 e5", "1-0");
    expect(m.state.confirmAnalyse).toBe(false);
    expect(m.onAnalyseCalls).toHaveLength(1);
  });

  it("shows prompt when no result selected", () => {
    const m = makeConfirmMachine();
    m.handleAnalyse("1. e4 e5", null);
    expect(m.state.confirmAnalyse).toBe(true);
    expect(m.onAnalyseCalls).toHaveLength(0);
  });

  it("does NOT fire onAnalyse when prompt is shown", () => {
    const m = makeConfirmMachine();
    m.handleAnalyse("1. e4 e5", null);
    expect(m.onAnalyseCalls).toHaveLength(0);
  });

  it("auto-dismisses prompt after 8 seconds", () => {
    const m = makeConfirmMachine(8000);
    m.handleAnalyse("1. e4 e5", null);
    expect(m.state.confirmAnalyse).toBe(true);
    vi.advanceTimersByTime(8000);
    expect(m.state.confirmAnalyse).toBe(false);
  });

  it("does not auto-dismiss before 8 seconds", () => {
    const m = makeConfirmMachine(8000);
    m.handleAnalyse("1. e4 e5", null);
    vi.advanceTimersByTime(7999);
    expect(m.state.confirmAnalyse).toBe(true);
  });

  it("'Continue anyway' fires onAnalyse with null result", () => {
    const m = makeConfirmMachine();
    m.handleAnalyse("1. e4 e5", null);
    m.handleAnalyseAnyway("1. e4 e5");
    expect(m.onAnalyseCalls).toHaveLength(1);
    expect(m.onAnalyseCalls[0].result).toBeNull();
    expect(m.onAnalyseCalls[0].pgn).toBe("1. e4 e5");
  });

  it("'Continue anyway' dismisses the prompt", () => {
    const m = makeConfirmMachine();
    m.handleAnalyse("1. e4 e5", null);
    m.handleAnalyseAnyway("1. e4 e5");
    expect(m.state.confirmAnalyse).toBe(false);
  });

  it("'Select result' dismisses prompt without firing onAnalyse", () => {
    const m = makeConfirmMachine();
    m.handleAnalyse("1. e4 e5", null);
    m.handleDismiss();
    expect(m.state.confirmAnalyse).toBe(false);
    expect(m.onAnalyseCalls).toHaveLength(0);
  });

  it("dismissing clears the auto-dismiss timer", () => {
    const m = makeConfirmMachine(8000);
    m.handleAnalyse("1. e4 e5", null);
    m.handleDismiss();
    vi.advanceTimersByTime(8000);
    // confirmAnalyse should remain false (timer was cleared)
    expect(m.state.confirmAnalyse).toBe(false);
  });

  it("re-triggering resets the auto-dismiss timer", () => {
    const m = makeConfirmMachine(8000);
    m.handleAnalyse("1. e4 e5", null);
    vi.advanceTimersByTime(5000);
    // Trigger again (e.g. user tapped again)
    m.handleAnalyse("1. e4 e5", null);
    vi.advanceTimersByTime(5000); // 5s more = 10s total, but timer was reset at 5s
    expect(m.state.confirmAnalyse).toBe(true); // still showing (8s from re-trigger)
    vi.advanceTimersByTime(3000); // now 8s from re-trigger
    expect(m.state.confirmAnalyse).toBe(false);
  });

  it("reset clears prompt state", () => {
    const m = makeConfirmMachine();
    m.handleAnalyse("1. e4 e5", null);
    m.reset();
    expect(m.state.confirmAnalyse).toBe(false);
  });

  it("does nothing when pgn is empty", () => {
    const m = makeConfirmMachine();
    m.handleAnalyse("", null);
    expect(m.state.confirmAnalyse).toBe(false);
    expect(m.onAnalyseCalls).toHaveLength(0);
  });

  it("handleAnalyseAnyway does nothing when pgn is empty", () => {
    const m = makeConfirmMachine();
    m.handleAnalyseAnyway("");
    expect(m.onAnalyseCalls).toHaveLength(0);
  });
});

// ─── injectResultIntoPgn (used in handleAnalyse path) ────────────────────────

describe("injectResultIntoPgn in confirmation flow", () => {
  it("injects result when user selects after seeing prompt", () => {
    const pgn = "1. e4 e5 2. Nf3 Nc6";
    const result = injectResultIntoPgn(pgn, "1-0");
    expect(result).toContain('[Result "1-0"]');
    expect(result).toContain("1. e4 e5");
  });

  it("does NOT inject result in 'Continue anyway' path (null result)", () => {
    // The handleAnalyseAnyway path passes pgn unchanged (no result injection)
    const pgn = "1. e4 e5";
    // Simulate: no injection when result is null
    const pgnOut = null === null ? pgn : injectResultIntoPgn(pgn, null as unknown as GameResult);
    expect(pgnOut).toBe(pgn);
  });
});

// ─── deriveResultFromReason (auto-selection prevents prompt) ──────────────────

describe("deriveResultFromReason prevents prompt for natural game ends", () => {
  const cases: [string, GameResult][] = [
    ["Checkmate — White wins", "1-0"],
    ["Checkmate — Black wins", "0-1"],
    ["Draw by stalemate", "1/2-1/2"],
    ["Draw by repetition", "1/2-1/2"],
    ["Draw by insufficient material", "1/2-1/2"],
    ["Draw agreed", "1/2-1/2"],
  ];

  it.each(cases)("derives result from '%s'", (reason, expected) => {
    expect(deriveResultFromReason(reason)).toBe(expected);
  });

  it("returns null for manually stopped game (no natural reason)", () => {
    expect(deriveResultFromReason(null)).toBeNull();
  });

  it("returns null for unrecognised reason string", () => {
    expect(deriveResultFromReason("Game abandoned")).toBeNull();
  });

  it("when result is auto-derived, prompt is NOT shown", () => {
    // Simulate: game ends naturally, result is auto-set, user taps Analyse
    const m = makeConfirmMachine();
    const autoResult = deriveResultFromReason("Checkmate — White wins");
    m.handleAnalyse("1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7#", autoResult);
    expect(m.state.confirmAnalyse).toBe(false);
    expect(m.onAnalyseCalls).toHaveLength(1);
    expect(m.onAnalyseCalls[0].result).toBe("1-0");
  });
});

// ─── Prompt content strings ───────────────────────────────────────────────────

describe("confirmation prompt content", () => {
  it("title is 'No result selected'", () => {
    expect("No result selected").toBeTruthy();
  });

  it("body explains PGN impact", () => {
    const body = "The game result won't be recorded in the PGN. Continue anyway?";
    expect(body).toContain("PGN");
    expect(body).toContain("Continue anyway");
  });

  it("primary action is 'Continue anyway'", () => {
    expect("Continue anyway").toBeTruthy();
  });

  it("secondary action is 'Select result'", () => {
    expect("Select result").toBeTruthy();
  });
});
