import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const page = readFileSync(resolve(process.cwd(), "client/src/pages/PrepAnalysis.tsx"), "utf8");

describe("Matchup Prep full-screen analysis workspace", () => {
  it("uses a viewport-filling canvas and dominant native replay board", () => {
    expect(page).toContain('className="w-full px-3 sm:px-5 xl:px-6 py-3 sm:py-4 space-y-3"');
    expect(page).toContain('lg:min-h-[min(780px,calc(100dvh-12rem))]');
    expect(page).toContain('max-w-[min(78dvh,calc(100vw-25rem))]');
    expect(page).toContain('animationDurationInMs: 220');
  });

  it("keeps a persistent replay control panel beside the board on desktop", () => {
    expect(page).toContain('lg:grid-cols-[minmax(0,1fr)_23rem] 2xl:grid-cols-[minmax(0,1fr)_28rem]');
    expect(page).toContain("Replay controls");
    expect(page).toContain("Flip board");
  });

  it("allocates full-workspace height to replay and position-analysis embeds", () => {
    expect(page).toContain("minHeight={820}");
    expect(page).toContain("minHeight={860}");
    expect(page).toContain("Full-workspace Lichess analysis");
  });
});
