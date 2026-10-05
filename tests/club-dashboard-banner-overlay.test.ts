import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const dashboard = read("client/src/pages/ClubDashboard.tsx");
const demo = read("client/src/pages/ClubDashboardDemo.tsx");

describe("Club Dashboard banner overlay", () => {
  it("uses one even readability overlay across an uploaded dashboard banner", () => {
    expect(dashboard).toContain('? "rgba(2,12,6,0.68)"');
    expect(dashboard).not.toContain("linear-gradient(180deg, rgba(2,12,6,0.18)");
    expect(dashboard).toContain('className="pointer-events-none absolute inset-0 z-[1]"');
  });

  it("removes redundant public and private state labels from the identity rail", () => {
    expect(dashboard).not.toContain('"Private club"');
    expect(dashboard).not.toContain('"Public club"');
    expect(demo).not.toContain("Private club");
  });

  it("keeps the demo banner visually aligned with the live dashboard treatment", () => {
    expect(demo).toContain('bg-[rgba(2,12,6,0.68)]');
    expect(demo).not.toContain("bg-[linear-gradient(180deg,rgba(2,12,6,0.18)");
    expect(demo).toContain('data-testid="club-demo-full-bleed-banner"');
  });
});
