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
const matchupPrepPageSource = readFileSync(
  resolve(process.cwd(), "client/src/pages/MatchupPrep.tsx"),
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

  it("uses concise onboarding copy, text-only pill badges, and a breathing filter surface", () => {
    expect(matchupPrepPageSource).toContain("Enter your opponent's chess.com username for a custom scouting report");
    expect(matchupPrepPageSource).toContain('["Scout", "Study", "Practice"].map');
    expect(matchupPrepPageSource).toContain("hover:shadow-[0_0_18px_rgba(91,154,106,0.16)]");
    expect(matchupPrepPageSource).toContain("gap-x-3 gap-y-2.5 flex-wrap rounded-2xl border");
    expect(matchupPrepPageSource).not.toContain('<Eye className="w-3.5 h-3.5" /> Scout');
  });
});
