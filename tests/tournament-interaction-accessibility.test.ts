import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd());
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("tournament interaction accessibility", () => {
  it("provides a native keyboard action for every player report card", () => {
    const source = read("client/src/pages/TournamentOverview.tsx");

    expect(source).toContain("aria-label={`Open player report for ${perf.player.name}`}");
    expect(source).toContain("onClick={() => setExpandedPerf(perf)}");
    expect(source).toContain("focus-visible:ring-4 focus-visible:ring-[#4CAF50]/70");
  });

  it("provides a native keyboard action for every non-editing prize template row", () => {
    const source = read("client/src/components/tournament/PrizeTemplatePanel.tsx");

    expect(source).toContain("aria-label={`Edit prize template ${prize.prizeTitle}`}");
    expect(source).toContain("onClick={onStartEdit}");
    expect(source).toContain("focus-visible:ring-2 focus-visible:ring-[#4CAF50]/70");
  });
});
