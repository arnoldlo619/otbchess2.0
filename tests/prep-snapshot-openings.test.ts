import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { toFamiliarOpeningName } from "../server/prep/buildReport";

const reportTab = readFileSync(resolve(process.cwd(), "client/src/components/prep/V3ScoutReportTab.tsx"), "utf8");

describe("Matchup Prep Snapshot openings", () => {
  it("normalizes detailed opening labels into familiar names", () => {
    expect(toFamiliarOpeningName("London System: Jobava System")).toBe("Jobava London");
    expect(toFamiliarOpeningName("Scandinavian Defense: Modern Variation")).toBe("Scandinavian Defense");
    expect(toFamiliarOpeningName("Sicilian Defense: Najdorf Variation")).toBe("Sicilian Defense");
  });

  it("keeps Snapshot focused on the two top opening labels", () => {
    expect(reportTab).toContain('openings={report.topOpenings}');
    expect(reportTab).toContain("Most played");
    expect(reportTab).not.toContain('title="If You Have White"');
  });
});
