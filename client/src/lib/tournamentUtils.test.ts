import { describe, expect, it } from "vitest";
import { getTournamentStatus, getTournamentStatusDisplay } from "./tournamentUtils";

describe("canonical tournament lifecycle status", () => {
  it("normalizes every supported lifecycle state", () => {
    expect(getTournamentStatus("registration")).toBe("registration");
    expect(getTournamentStatus("in_progress")).toBe("in_progress");
    expect(getTournamentStatus("paused")).toBe("paused");
    expect(getTournamentStatus("completed")).toBe("completed");
  });

  it("gives completed terminal precedence over stale live sources", () => {
    expect(getTournamentStatus("in_progress", "completed")).toBe("completed");
    expect(getTournamentStatus({ status: "in_progress", elimPhase: "completed" })).toBe("completed");
    expect(getTournamentStatusDisplay("in_progress", "completed")).toEqual({
      label: "Completed",
      isLive: false,
      isComplete: true,
      isPending: false,
    });
  });

  it("maps elimination phase state to an active tournament until completed", () => {
    expect(getTournamentStatus({ status: "in_progress", elimPhase: "elimination" })).toBe("in_progress");
    expect(getTournamentStatusDisplay({ elimPhase: "elimination" }).isLive).toBe(true);
  });

  it("uses a safe registration fallback for missing or unknown values", () => {
    expect(getTournamentStatus()).toBe("registration");
    expect(getTournamentStatus("unknown")).toBe("registration");
    expect(getTournamentStatusDisplay(undefined).label).toBe("Registration Open");
  });
});
