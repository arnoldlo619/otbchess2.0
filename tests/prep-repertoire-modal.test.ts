import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const reportTab = readFileSync(resolve(process.cwd(), "client/src/components/prep/V3ScoutReportTab.tsx"), "utf8");
const buildReport = readFileSync(resolve(process.cwd(), "server/prep/buildReport.ts"), "utf8");

describe("Matchup Prep repertoire statistics modal", () => {
  it("makes each opening card an accessible opening-statistics trigger", () => {
    expect(reportTab).toContain("onClick={() => setSelectedOpening(opening)}");
    expect(reportTab).toContain("View ${opening.name} win, draw, and loss statistics");
    expect(reportTab).toContain("<Dialog open={selectedOpening !== null}");
  });

  it("renders opening-specific win, draw, and loss detail in the modal", () => {
    expect(reportTab).toContain('{ label: "Wins", count: selectedOpening.wins');
    expect(reportTab).toContain('{ label: "Draws", count: selectedOpening.draws');
    expect(reportTab).toContain('{ label: "Losses", count: selectedOpening.losses');
  });

  it("adds an accessible pie chart for at-a-glance outcome proportions", () => {
    expect(reportTab).toContain("conic-gradient(");
    expect(reportTab).toContain('role="img"');
    expect(reportTab).toContain("Win, draw, and loss pie chart:");
    expect(reportTab).toContain("Outcome distribution");
  });

  it("builds outcome counts from the scouted player perspective", () => {
    expect(buildReport).toContain("if (game.scoutedScore === 1) current.wins++");
    expect(buildReport).toContain("else if (game.scoutedScore === 0.5) current.draws++");
    expect(buildReport).toContain("else current.losses++");
  });
});
