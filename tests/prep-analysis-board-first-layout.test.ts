import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const page = readFileSync(resolve(process.cwd(), "client/src/pages/PrepAnalysis.tsx"), "utf8");

describe("Matchup Prep board-first analysis workspace", () => {
  it("uses a wider page canvas and a dominant native replay board", () => {
    expect(page).toContain('className="max-w-7xl mx-auto px-4 py-6 sm:py-8 space-y-5"');
    expect(page).toContain('className="w-full max-w-[740px] mx-auto xl:mx-0"');
    expect(page).toContain('animationDurationInMs: 220');
  });

  it("keeps the move navigator as a supporting desktop panel", () => {
    expect(page).toContain('xl:grid-cols-[minmax(0,1.3fr)_minmax(20rem,0.7fr)]');
    expect(page).toContain('xl:sticky xl:top-20');
    expect(page).toContain("Move navigator");
  });

  it("allocates full-display height to game and position analysis embeds", () => {
    expect(page).toContain("minHeight={680}");
    expect(page).toContain("minHeight={720}");
    expect(page).toContain("Deep position analysis");
  });
});
