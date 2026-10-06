import { describe, expect, it } from "vitest";
import { shouldAutoSwitchToSwissEliminationBracket } from "@/lib/swissEliminationNavigation";

describe("Swiss elimination player bracket transition", () => {
  const base = {
    format: "swiss_elim",
    previousPhase: "swiss",
    currentPhase: "elimination",
    advancingPlayerCount: 8,
    hasAutoSwitched: false,
  } as const;

  it("opens the bracket for connected players after Swiss rounds conclude", () => {
    expect(shouldAutoSwitchToSwissEliminationBracket(base)).toBe(true);
  });

  it("opens the bracket for a player who joins after elimination is already live", () => {
    expect(shouldAutoSwitchToSwissEliminationBracket({
      ...base,
      previousPhase: undefined,
    })).toBe(true);
  });

  it("supports the legacy cutoff-to-elimination transition", () => {
    expect(shouldAutoSwitchToSwissEliminationBracket({
      ...base,
      previousPhase: "cutoff",
    })).toBe(true);
  });

  it("does not move players before advancing bracket players exist", () => {
    expect(shouldAutoSwitchToSwissEliminationBracket({
      ...base,
      advancingPlayerCount: 0,
    })).toBe(false);
  });

  it("does not repeat a player-initiated bracket view after the automatic handoff", () => {
    expect(shouldAutoSwitchToSwissEliminationBracket({
      ...base,
      hasAutoSwitched: true,
    })).toBe(false);
  });

  it("does not switch non-Swiss-elimination tournaments", () => {
    expect(shouldAutoSwitchToSwissEliminationBracket({
      ...base,
      format: "swiss",
    })).toBe(false);
  });
});
