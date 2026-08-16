import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "client/src/pages/MatchupPrep.tsx"), "utf8");

describe("Matchup Prep header layout", () => {
  it("uses the expanded platform-width header container across all control rows", () => {
    expect((source.match(/max-w-5xl mx-auto/g) ?? []).length).toBeGreaterThanOrEqual(3);
    expect(source).not.toContain("max-w-3xl mx-auto px-3 sm:px-6 pt-2 pb-1");
  });

  it("keeps deliberate responsive vertical rhythm around navigation and filters", () => {
    expect(source).toContain("pt-3 sm:pt-4 pb-2 sm:pb-3");
    expect(source).toContain("pb-3 sm:pb-4 flex items-center gap-2 flex-wrap");
  });
});
