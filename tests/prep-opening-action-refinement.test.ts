import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const reportTab = readFileSync(resolve(process.cwd(), "client/src/components/prep/V3ScoutReportTab.tsx"), "utf8");
const prepPage = readFileSync(resolve(process.cwd(), "client/src/pages/MatchupPrep.tsx"), "utf8");

describe("Matchup Prep opening and action refinement", () => {
  it("gives both top-opening cards a more prominent editorial hierarchy", () => {
    expect(reportTab).toContain("White repertoire");
    expect(reportTab).toContain("Black repertoire");
    expect(reportTab).toContain("rounded-2xl border p-4 sm:p-5");
    expect(reportTab).toContain("hover:-translate-y-1 hover:shadow-xl");
  });

  it("keeps Scout opponent visually quiet while retaining premium interactive states", () => {
    expect(prepPage).toContain("rounded-lg border px-3.5 py-2 text-[13px] font-semibold");
    expect(prepPage).toContain("bg-[#436850]/12 text-[#c7f0cd]");
    expect(prepPage).not.toContain("bg-[linear-gradient(135deg,#4d8060_0%,#355f45_100%)]");
  });
});
