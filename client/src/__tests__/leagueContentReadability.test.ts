import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const clientRoot = resolve(import.meta.dirname, "..");
const dashboardSource = readFileSync(resolve(clientRoot, "pages/LeagueDashboard.tsx"), "utf8");
const demoSource = readFileSync(resolve(clientRoot, "pages/LeagueDemo.tsx"), "utf8");
const styleSource = readFileSync(resolve(clientRoot, "styles/leagueContentReadability.css"), "utf8");

describe("League dashboard content readability", () => {
  it("applies the same scoped content scale to standard and demo League dashboards", () => {
    expect(dashboardSource).toContain('import "@/styles/leagueContentReadability.css"');
    expect(demoSource).toContain('import "@/styles/leagueContentReadability.css"');
    expect(dashboardSource).toContain('league-content-scale ${isDark ? "league-content-scale--dark" : ""} px-4 pt-0 pb-4 lg:px-6 lg:pt-0 lg:pb-6');
    expect(demoSource).toContain('league-content-scale ${isDark ? "league-content-scale--dark" : ""} flex-1');
  });

  it("raises dense League metadata and body tokens without affecting the hero", () => {
    expect(styleSource).toContain(".league-content-scale .text-\\[9px\\]");
    expect(styleSource).toContain(".league-content-scale .text-xs");
    expect(styleSource).toContain(".league-content-scale .text-sm");
    expect(styleSource).toContain("@media (min-width: 1024px)");
    expect(styleSource).toContain("font-size: 1rem;");
    expect(styleSource).not.toContain(".league-header");
  });

  it("keeps context bands on secondary League tabs while the live player overview stays direct", () => {
    for (const testId of [
      "league-matchups-context",
      "league-standings-context",
      "league-schedule-context",
      "league-history-context",
    ]) {
      expect(dashboardSource).toContain(`data-testid="${testId}"`);
    }

    for (const testId of [
      "league-demo-overview-context",
      "league-demo-matchup-context",
      "league-demo-standings-context",
      "league-demo-schedule-context",
      "league-demo-history-context",
    ]) {
      expect(demoSource).toContain(`data-testid="${testId}"`);
    }

    expect(dashboardSource).not.toContain('data-testid="league-overview-context"');
    expect(dashboardSource).toContain('<h2 className="text-2xl font-black tracking-tight sm:text-3xl"');
    expect(dashboardSource).toContain('className="relative flex w-full items-center justify-center gap-3');
    expect(dashboardSource).toContain('className="absolute right-4"');
    expect(styleSource).toContain(".league-page-intro");
    expect(styleSource).toContain(".league-page-intro__metrics");
    expect(styleSource).toContain(".league-data-surface");
    expect(styleSource).toContain(".league-page-intro--demo::before");
    expect(styleSource).toContain(".league-content-scale--dark .league-page-intro--demo");
    expect(demoSource).toContain('className="league-page-intro league-page-intro--demo"');
    expect(styleSource).toContain("@media (hover: hover) and (pointer: fine)");
  });

  it("raises the minimum League metadata scale and preserves reduced-motion behavior", () => {
    expect(styleSource).toContain("font-size: 0.875rem;");
    expect(styleSource).toContain("font-size: 1.0625rem;");
    expect(styleSource).toContain(".league-operations-panel");
    expect(styleSource).toContain(".league-content-scale--dark .league-page-intro");
    expect(demoSource).toContain('const isDark = theme === "dark";');
    expect(styleSource).toContain("@media (prefers-reduced-motion: reduce)");
  });
});
