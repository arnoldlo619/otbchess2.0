import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "../../..");
const dashboard = readFileSync(resolve(projectRoot, "client/src/pages/LeagueDashboard.tsx"), "utf8");
const demo = readFileSync(resolve(projectRoot, "client/src/pages/LeagueDemo.tsx"), "utf8");
const app = readFileSync(resolve(projectRoot, "client/src/App.tsx"), "utf8");
const home = readFileSync(resolve(projectRoot, "client/src/pages/Home.tsx"), "utf8");
const server = readFileSync(resolve(projectRoot, "server/leagues.ts"), "utf8");

describe("League Dashboard implementation", () => {
  it("uses a persistent desktop sidebar and safe-area mobile bottom navigation", () => {
    expect(dashboard).toContain("Mobile bottom nav bar");
    expect(dashboard).toContain("lg:hidden fixed bottom-0 left-0 right-0");
    expect(dashboard).toContain("env(safe-area-inset-bottom, 0px)");
    expect(dashboard).toContain("min-w-[44px] min-h-[44px]");
    expect(dashboard).toContain('label: "Overview"');
    expect(dashboard).toContain('label: "Standings"');
    expect(dashboard).toContain('label: "Schedule"');
  });

  it("renders the overview, roster, progress, standings, and upcoming matchup surfaces", () => {
    expect(dashboard).toContain("Upcoming Matchups");
    expect(dashboard).toContain("League Form");
    expect(dashboard).toContain("Roster:");
    expect(dashboard).toContain("Season Final Standings");
    expect(dashboard).toContain(">POS</span>");
    expect(dashboard).toContain(">MP</span>");
    expect(dashboard).toContain(">Form</span>");
  });

  it("shows Commissioner settings only through a commissioner nav item and complete save flow", () => {
    expect(dashboard).toContain('...(isCommissioner ? [{ id: "settings"');
    expect(dashboard).toContain("League Settings");
    expect(dashboard).toContain("Commissioner-only");
    expect(dashboard).toContain('method: "PATCH"');
    expect(dashboard).toContain("Settings saved");
    expect(dashboard).toContain("Save Changes");
  });
});

describe("League Demo implementation", () => {
  it("registers the public route and landing-page destination", () => {
    expect(app).toContain('<Route path={"/league-demo"} component={LeagueDemo} />');
    expect(home).toContain('href="/league-demo"');
    expect(home).toContain('return "/league-demo"');
  });

  it("includes 23 mock players plus overview, matchup, standings, schedule, and bracket views", () => {
    expect(demo).toContain('id: "23"');
    expect(demo).toContain('type TabId = "overview" | "matchup" | "standings" | "schedule" | "history"');
    expect(demo).toContain("Current week matchups");
    expect(demo).toContain("League Form");
    expect(demo).toContain("LeagueBracket");
    expect(demo).toContain("Array.from({ length: 16 }");
  });
});

describe("Commissioner league settings endpoint", () => {
  it("authorizes and validates editable league settings", () => {
    expect(server).toContain('leaguesRouter.patch("/:leagueId/settings"');
    expect(server).toContain("commissionerId !== userId");
    expect(server).toContain("maxPlayers");
    expect(server).toContain("formatType");
    expect(server).toContain("Failed to update league settings");
  });
});
