import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const clientRoot = resolve(import.meta.dirname, "..");
const dashboardSource = readFileSync(resolve(clientRoot, "pages/LeagueDashboard.tsx"), "utf8");
const styleSource = readFileSync(resolve(clientRoot, "index.css"), "utf8");
const headerSource = dashboardSource.slice(
  dashboardSource.indexOf("BRANDED TOP BAR"),
  dashboardSource.indexOf("LEAGUE HERO BANNER")
);

describe("League commissioner header action cluster", () => {
  it("replaces the active-season live status pill with centered commissioner controls", () => {
    expect(headerSource).toContain('data-testid="league-dashboard-header-actions"');
    expect(headerSource).toContain('absolute left-1/2 -translate-x-1/2');
    expect(headerSource).toContain("league.status === \"active\" ? (");
    expect(headerSource).toContain("Commissioner");
    expect(headerSource).toContain("Report Results");
    expect(headerSource).toContain(">\n                      Advance");
    expect(headerSource).not.toContain("Live · Week");
    expect(headerSource).toContain('league.status !== "active" ? (');
  });

  it("gives Report Results the primary treatment and preserves direct mobile controls", () => {
    expect(headerSource).toContain('aria-label="Report League Results"');
    expect(headerSource).toContain('linear-gradient(135deg, ${accent}, oklch(0.51 0.15 145))');
    expect(headerSource).toContain('className="ml-auto flex items-center gap-1.5 lg:hidden"');
    expect(headerSource).toContain("min-h-11 min-w-11");
  });

  it("uses a reduced-motion-safe gradient glow interaction rather than continuous animation", () => {
    expect(styleSource).toContain(".league-header-action");
    expect(styleSource).toContain("linear-gradient(112deg");
    expect(styleSource).toContain("@media (hover: hover)");
    expect(styleSource).toContain(".league-header-action:focus-visible");
    expect(styleSource).toContain("@media (prefers-reduced-motion: reduce)");
  });
});
