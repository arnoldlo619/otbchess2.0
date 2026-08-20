import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const prepReportSource = readFileSync(
  resolve(process.cwd(), "client/src/components/prep/V3ScoutReportTab.tsx"),
  "utf8",
);
const weaknessSummarySource = readFileSync(
  resolve(process.cwd(), "client/src/components/prep/OpeningForecastWeaknessSummary.tsx"),
  "utf8",
);

describe("Matchup Prep report presentation", () => {
  it("uses two concise opening-specific Prep Snapshot rows", () => {
    expect(prepReportSource).toContain('label: "Against e4"');
    expect(prepReportSource).toContain('label: "Against d5"');
    expect(prepReportSource).toContain("No repeatable pattern in the analyzed games.");
    expect(prepReportSource).not.toContain("Top findings");
    expect(prepReportSource).not.toContain("kindIcon");
  });

  it("removes AI-generic decorative report wording and icon-led filters", () => {
    expect(prepReportSource).not.toContain("Telescope");
    expect(prepReportSource).not.toContain("icon: <");
    expect(weaknessSummarySource).not.toContain("Sparkles");
    expect(weaknessSummarySource).toContain("Opening weakness read");
    expect(weaknessSummarySource).toContain("Evidence-based");
  });
});
