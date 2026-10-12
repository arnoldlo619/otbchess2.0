import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const clientRoot = resolve(import.meta.dirname, "..");
const dashboardSource = readFileSync(resolve(clientRoot, "pages/LeagueDashboard.tsx"), "utf8");
const styleSource = readFileSync(resolve(clientRoot, "index.css"), "utf8");
const topBarSource = dashboardSource.slice(
  dashboardSource.indexOf("BRANDED TOP BAR"),
  dashboardSource.indexOf("LEAGUE HERO BANNER")
);
const heroSource = dashboardSource.slice(
  dashboardSource.indexOf("LEAGUE HERO BANNER"),
  dashboardSource.indexOf("Player invite banner")
);

describe("League commissioner header action cluster", () => {
  it("embeds one active-season Commissioner entry in the League hero instead of duplicate actions", () => {
    expect(topBarSource).toContain("lg:hidden");
    expect(heroSource).toContain('data-testid="league-dashboard-header-actions"');
    expect(heroSource).toContain('absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2');
    expect(heroSource).toContain("league.status === \"active\" ? (");
    expect(heroSource).toContain('aria-label="Open Commissioner workspace"');
    expect(heroSource).toContain(">\n                        Commissioner");
    expect(heroSource).not.toContain(">\n                        Report");
    expect(heroSource).not.toContain(">\n                        Advance");
    expect(heroSource).not.toContain("<Crown size");
    expect(heroSource).toContain("<ShieldCheck size={15}");
    expect(heroSource).not.toContain("<Settings size={15}");
    expect(heroSource).not.toContain("Live · Week");
    expect(heroSource).toContain('league.status !== "active" ? (');
  });

  it("pins season metrics to the trophy side of the hero instead of the centered action cluster", () => {
    expect(heroSource).toContain('data-testid="league-dashboard-hero-metrics"');
    expect(heroSource).toContain('absolute right-6 top-1/2 hidden -translate-y-1/2');
    expect(heroSource).toContain('sm:flex lg:right-8');
    expect(heroSource).toContain('{ label: "Players", value: `${league.players.length}/${league.maxPlayers}` }');
    expect(heroSource).toContain('{ label: "Matches", value: `${completedMatchCount}/${totalMatches}` }');
    expect(heroSource).toContain('{ label: "Week", value: `${league.currentWeek}/${league.totalWeeks}` }');
  });

  it("gives Commissioner the primary treatment and preserves direct mobile access", () => {
    expect(heroSource).toContain('aria-label="Open Commissioner workspace"');
    expect(heroSource).toContain('linear-gradient(135deg, ${accent}, oklch(0.51 0.15 145))');
    expect(topBarSource).toContain('className="ml-auto flex items-center gap-1.5 lg:hidden"');
    expect(topBarSource).toContain("min-h-11 min-w-11");
    expect(topBarSource).toContain("<ShieldCheck size={17}");
  });

  it("keeps player overview actions focused on matchup preparation and moves operations to the commissioner workspace", () => {
    const overviewSource = dashboardSource.slice(
      dashboardSource.indexOf("Your Match This Week"),
      dashboardSource.indexOf('data-testid="league-player-matchup-empty-state"')
    );
    const commissionerSource = dashboardSource.slice(
      dashboardSource.indexOf("{/* Match cards */}"),
      dashboardSource.indexOf("/* ── STANDINGS")
    );

    expect(overviewSource).toContain("<Binoculars size={16} />");
    expect(overviewSource).toContain("League form");
    expect(overviewSource).not.toContain("Recent league results");
    expect(overviewSource).not.toContain("My Standing");
    expect(commissionerSource).not.toContain("Commissioner workspace");
    expect(commissionerSource).toContain("Submit Report");
    expect(commissionerSource).toContain('data-testid="league-advance-ready-footer"');
  });

  it("uses a reduced-motion-safe gradient glow interaction rather than continuous animation", () => {
    expect(styleSource).toContain(".league-header-action");
    expect(styleSource).toContain("linear-gradient(112deg");
    expect(styleSource).toContain("@media (hover: hover)");
    expect(styleSource).toContain(".league-header-action:focus-visible");
    expect(styleSource).toContain(".league-advance-footer__button");
    expect(styleSource).toContain("@media (prefers-reduced-motion: reduce)");
  });
});
