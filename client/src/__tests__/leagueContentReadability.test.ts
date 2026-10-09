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
    expect(dashboardSource).toContain('className="league-content-scale px-4 pt-0 pb-4 lg:px-6 lg:pt-0 lg:pb-6"');
    expect(demoSource).toContain('className="league-content-scale flex-1"');
  });

  it("raises dense League metadata and body tokens without affecting the hero", () => {
    expect(styleSource).toContain(".league-content-scale .text-\\[9px\\]");
    expect(styleSource).toContain(".league-content-scale .text-xs");
    expect(styleSource).toContain(".league-content-scale .text-sm");
    expect(styleSource).toContain("@media (min-width: 1024px)");
    expect(styleSource).toContain("font-size: 1rem;");
    expect(styleSource).not.toContain(".league-header");
  });
});
