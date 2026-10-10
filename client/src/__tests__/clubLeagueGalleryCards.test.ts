import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(
  resolve(process.cwd(), "client/src/pages/ClubDashboard.tsx"),
  "utf8",
);
const demoSource = readFileSync(
  resolve(process.cwd(), "client/src/pages/ClubDashboardDemo.tsx"),
  "utf8",
);

describe("Club League gallery cards", () => {
  it("uses the Events gallery hierarchy for live Club League seasons", () => {
    expect(dashboardSource).toContain("function ClubLeagueGalleryCard");
    expect(dashboardSource).toContain('data-club-league-card="gallery"');
    expect(dashboardSource).toContain('aria-label="Club League seasons"');
    expect(dashboardSource).toContain("sm:grid-cols-2 xl:grid-cols-2 xl:gap-6");
    expect(dashboardSource).toContain("aspect-[16/10]");
    expect(dashboardSource).toContain("line-clamp-2 text-xl font-bold");
    expect(dashboardSource).toContain("min-h-[184px]");
    expect(dashboardSource).toContain("group-hover:scale-[1.04]");
  });

  it("keeps each live League card fully clickable with visible season context", () => {
    expect(dashboardSource).toContain('href={`/leagues/${league.id}`}');
    expect(dashboardSource).toContain('aria-label={`Open ${league.name} League dashboard`}');
    expect(dashboardSource).toContain("Club League");
    expect(dashboardSource).toContain("statusLabel");
    expect(dashboardSource).toContain("progressLabel");
    expect(dashboardSource).toContain("league.playerCount}/{league.maxPlayers} players");
    expect(dashboardSource).toContain("motion-reduce:transition-none");
  });

  it("mirrors the cover-led card system in the demo League workspace", () => {
    expect(demoSource).toContain("const DEMO_LEAGUES");
    expect(demoSource).toContain('data-demo-club-league-card="gallery"');
    expect(demoSource).toContain('aria-label="Demo Club League seasons"');
    expect(demoSource).toContain("aspect-[16/10]");
    expect(demoSource).toContain("group-hover:scale-[1.04]");
    expect(demoSource).toContain('new URLSearchParams(window.location.search).get("tab") === "leagues" ? "leagues" : "overview"');
    expect(demoSource).toContain('<DemoLeagues onSelect={() => navigate("/league-demo")} />');
  });
});
