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
const borderBeamSource = readFileSync(
  resolve(process.cwd(), "client/src/components/ui/border-beam-search.tsx"),
  "utf8",
);
const globalStyles = readFileSync(
  resolve(process.cwd(), "client/src/index.css"),
  "utf8",
);

describe("Matchup Prep report presentation", () => {
  it("uses two concise opening-specific Prep Snapshot rows", () => {
    expect(prepReportSource).toContain('label: "Against e4"');
    expect(prepReportSource).toContain('label: "Against d5"');
    expect(prepReportSource).toContain("No repeatable pattern in the analyzed games.");
    expect(prepReportSource).toContain("Prepare your Scandinavian Defense response.");
    expect(prepReportSource).not.toContain('label === "Against e4" && <p');
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

  it("uses concise onboarding copy, text-only pill badges, and a grouped filter-control rail", () => {
    expect(matchupPrepPageSource).toContain("Enter your opponent's chess.com username for a custom scouting report");
    expect(matchupPrepPageSource).toContain('["Scout", "Study", "Practice"].map');
    expect(matchupPrepPageSource).toContain("hover:shadow-[0_0_18px_rgba(91,154,106,0.16)]");
    expect(matchupPrepPageSource).toContain("Preparation controls");
    expect(matchupPrepPageSource).toContain("flex flex-wrap items-center gap-x-4 gap-y-2 border-y py-3");
    expect(matchupPrepPageSource).toContain("Your side");
    expect(matchupPrepPageSource).toContain("shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]");
    expect(matchupPrepPageSource).not.toContain('<Eye className="w-3.5 h-3.5" /> Scout');
  });

  it("wraps the username search in a local motion-safe border-beam treatment", () => {
    expect(matchupPrepPageSource).toContain("<BorderBeamSearch");
    expect(matchupPrepPageSource).toContain("active={Boolean(searchInput.trim()) || loading}");
    expect(borderBeamSource).toContain("prep-border-beam__track");
    expect(globalStyles).toContain("@keyframes prepSearchBeamOrbit");
    expect(globalStyles).toContain("@media (prefers-reduced-motion: reduce)");
  });
});
