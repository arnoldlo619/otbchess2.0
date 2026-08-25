import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const homeSource = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");

describe("landing page social-proof integrity", () => {
  it("does not hardcode testimonials, reviewers, or rating claims", () => {
    expect(homeSource).not.toContain("function Testimonials");
    expect(homeSource).not.toContain("<Testimonials />");
    expect(homeSource).not.toContain("Avg. Host Rating");
    expect(homeSource).not.toContain("PLATFORM_STATS_FLOORS");
    expect(homeSource).not.toContain("Clubs that made the move");
    expect(homeSource).not.toMatch(/Marcus T\.|Aisha K\.|Rafael M\./);
  });

  it("keeps platform counters tied only to live platform-stat fields", () => {
    expect(homeSource).toContain("const stats:");
    expect(homeSource).toContain("liveCounts ? [");
    expect(homeSource).toContain('target: liveCounts.tournaments');
    expect(homeSource).toContain('target: liveCounts.players');
    expect(homeSource).toContain('target: liveCounts.clubs');
  });
});
