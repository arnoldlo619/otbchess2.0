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
  it("embeds active-season commissioner controls in the League hero instead of a separate desktop bar", () => {
    expect(topBarSource).toContain("lg:hidden");
    expect(heroSource).toContain('data-testid="league-dashboard-header-actions"');
    expect(heroSource).toContain('absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2');
    expect(heroSource).toContain("league.status === \"active\" ? (");
    expect(heroSource).toContain("Commissioner");
    expect(heroSource).toContain(">\n                        Report");
    expect(heroSource).toContain(">\n                        Advance");
    expect(heroSource).not.toContain("Report Results");
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

  it("gives Report the primary treatment and preserves direct mobile controls", () => {
    expect(heroSource).toContain('aria-label="Report League Result"');
    expect(heroSource).toContain('linear-gradient(135deg, ${accent}, oklch(0.51 0.15 145))');
    expect(topBarSource).toContain('className="ml-auto flex items-center gap-1.5 lg:hidden"');
    expect(topBarSource).toContain("min-h-11 min-w-11");
  });

  it("uses Lucide icons for prep, standing, and standings actions", () => {
    const overviewSource = dashboardSource.slice(
      dashboardSource.indexOf("Prep for Next Round CTA"),
      dashboardSource.indexOf("Top 3 standings preview")
    );
    const standingsSource = dashboardSource.slice(
      dashboardSource.indexOf("Top 3 standings preview"),
      dashboardSource.indexOf("MATCHUPS")
    );

    expect(overviewSource).toContain("<Binoculars size={16} />");
    expect(overviewSource).toContain("<Medal size={13}");
    expect(standingsSource).toContain("<Trophy size={15}");
    expect(standingsSource).not.toContain("<Crown size={15}");
  });

  it("uses a reduced-motion-safe gradient glow interaction rather than continuous animation", () => {
    expect(styleSource).toContain(".league-header-action");
    expect(styleSource).toContain("linear-gradient(112deg");
    expect(styleSource).toContain("@media (hover: hover)");
    expect(styleSource).toContain(".league-header-action:focus-visible");
    expect(styleSource).toContain("@media (prefers-reduced-motion: reduce)");
  });
});
