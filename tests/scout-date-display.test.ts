import { describe, expect, it } from "vitest";
import { formatScoutDateUtc, formatScoutDateWindowUtc } from "../client/src/lib/scoutDateDisplay";

describe("Matchup Prep UTC calendar date display", () => {
  it("keeps a report data-window date on its provider-calendar day", () => {
    expect(formatScoutDateWindowUtc("2026-08-30", "2026-08-30")).toBe("Aug 30 – Aug 30, 2026");
  });

  it("formats generated timestamps in the same stable UTC calendar", () => {
    expect(formatScoutDateUtc("2026-08-30T00:15:00.000Z")).toBe("Aug 30, 2026");
  });

  it("shows both years for a window that crosses a calendar year", () => {
    expect(formatScoutDateWindowUtc("2025-05-24", "2026-04-08")).toBe("May 24, 2025 – Apr 8, 2026");
  });
});
