import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const reportTab = readFileSync(resolve(process.cwd(), "client/src/components/prep/V3ScoutReportTab.tsx"), "utf8");
const forecast = readFileSync(resolve(process.cwd(), "client/src/components/prep/ForecastWalkthrough.tsx"), "utf8");

describe("Matchup Prep report readability cleanup", () => {
  it("uses larger section headings and premium opening-card hover depth", () => {
    expect(reportTab).toContain("text-base sm:text-lg tracking-[-0.01em]");
    expect(reportTab).toContain("hover:-translate-y-0.5 hover:shadow-lg");
  });

  it("removes the AI Weakness Read and selected weakness game filter from Forecast", () => {
    expect(forecast).not.toContain("OpeningForecastWeaknessSummary");
    expect(forecast).not.toContain("WeaknessGameList");
    expect(forecast).not.toContain("selectedWeaknessId");
  });
});
