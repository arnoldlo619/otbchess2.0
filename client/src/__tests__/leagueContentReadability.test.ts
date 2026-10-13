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
    expect(dashboardSource).toContain('league-content-scale ${isDark ? "league-content-scale--dark" : ""} px-4 pt-4 pb-4 lg:px-6 lg:pt-5 lg:pb-6');
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

  it("removes redundant context bands so every League tab opens directly on its working surface", () => {
    for (const testId of [
      "league-matchups-context",
      "league-standings-context",
      "league-schedule-context",
      "league-history-context",
    ]) {
      expect(dashboardSource).not.toContain(`data-testid="${testId}"`);
    }

    for (const testId of [
      "league-demo-overview-context",
      "league-demo-matchup-context",
      "league-demo-standings-context",
      "league-demo-schedule-context",
      "league-demo-history-context",
    ]) {
      expect(demoSource).not.toContain(`data-testid="${testId}"`);
    }

    expect(dashboardSource).not.toContain('data-testid="league-overview-context"');
    expect(dashboardSource).not.toContain("league-page-intro");
    expect(demoSource).not.toContain("league-page-intro");
    expect(dashboardSource).toContain('<h2 className="max-w-[calc(100%-5.5rem)] text-center text-2xl font-black leading-tight tracking-tight sm:text-3xl"');
    expect(dashboardSource).toContain('className="relative flex min-h-[4.5rem] items-center justify-center px-5 py-4"');
    expect(dashboardSource).toContain("Your Match · Week {league.currentWeek}");
    expect(dashboardSource).toContain("<LeagueMonthCalendar");
    expect(dashboardSource).not.toContain("/* ── Current Matchup Hero");
    expect(dashboardSource).not.toContain('data-testid="league-commissioner-workspace"');
    expect(dashboardSource).toContain("{/* Match cards */}");
    expect(demoSource).toContain("league-matchup-card league-data-surface");
    expect(dashboardSource).toContain("onClick={shareSeasonCard}");
    expect(dashboardSource).toContain('"Share season"');
    expect(dashboardSource).toContain('const scoutAccent = "oklch(0.88 0.14 92)"');
    expect(dashboardSource).toContain(">Prep Scout</span>");
    expect(dashboardSource).toContain("aria-label={`Open Prep Scout for ${oppChessCom}`}");
    expect(dashboardSource).not.toContain(">Prep for Next Round</div>");
    expect(dashboardSource).not.toContain('league.formatType.replace(/_/g, " ").replace(/\\b\\w/g, c => c.toUpperCase())');
    expect(styleSource).not.toContain(".league-page-intro");
    expect(styleSource).toContain(".league-data-surface");
    expect(styleSource).toContain("@media (hover: hover) and (pointer: fine)");
  });

  it("raises the minimum League metadata scale and preserves reduced-motion behavior", () => {
    expect(styleSource).toContain("font-size: 0.875rem;");
    expect(styleSource).toContain("font-size: 1.0625rem;");
    expect(styleSource).toContain(".league-operations-panel");
    expect(demoSource).toContain('const isDark = theme === "dark";');
    expect(styleSource).toContain("@media (prefers-reduced-motion: reduce)");
  });
});
