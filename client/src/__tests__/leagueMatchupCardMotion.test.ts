import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const clientRoot = resolve(import.meta.dirname, "..");
const dashboardSource = readFileSync(resolve(clientRoot, "pages/LeagueDashboard.tsx"), "utf8");
const demoSource = readFileSync(resolve(clientRoot, "pages/LeagueDemo.tsx"), "utf8");
const motionStyleSource = readFileSync(resolve(clientRoot, "styles/leagueContentReadability.css"), "utf8");

describe("League matchup card motion", () => {
  it("uses the shared motion class on every expanded live and demo matchup hero", () => {
    const liveMatchup = dashboardSource.slice(
      dashboardSource.indexOf("/* ── Current Matchup Hero"),
      dashboardSource.indexOf("/* H2H Record strip */")
    );
    const demoFeaturedMatchup = demoSource.slice(
      demoSource.indexOf("/* Featured Matchup Hero */"),
      demoSource.indexOf("/* Compact Standings Preview */")
    );
    const demoMatchupTab = demoSource.slice(
      demoSource.indexOf("/* ── MATCHUP TAB"),
      demoSource.indexOf("/* ── STANDINGS TAB")
    );

    expect(liveMatchup).toContain('className="league-matchup-card rounded-3xl overflow-hidden mb-4"');
    expect(demoFeaturedMatchup).toContain('className="league-matchup-card rounded-2xl overflow-hidden"');
    expect(demoMatchupTab).toContain('className="league-matchup-card rounded-2xl overflow-hidden"');
  });

  it("keeps card motion subtle, pointer-aware, and keyboard-visible", () => {
    expect(motionStyleSource).toContain(".league-matchup-card {");
    expect(motionStyleSource).toContain("transform 220ms cubic-bezier(0.22, 1, 0.36, 1)");
    expect(motionStyleSource).toContain("@media (hover: hover) and (pointer: fine)");
    expect(motionStyleSource).toContain("transform: translateY(-2px) scale(1.012);");
    expect(motionStyleSource).toContain(".league-matchup-card:focus-within");
    expect(motionStyleSource).toContain("outline: 2px solid rgba(49, 123, 76, 0.72);");
  });

  it("removes card transform motion when reduced motion is requested", () => {
    expect(motionStyleSource).toContain("@media (prefers-reduced-motion: reduce)");
    expect(motionStyleSource).toContain(".league-matchup-card:hover,");
    expect(motionStyleSource).toContain("transform: none;");
    expect(motionStyleSource).toContain("transition: none;");
  });
});
