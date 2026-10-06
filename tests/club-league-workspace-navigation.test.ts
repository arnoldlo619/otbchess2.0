import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getClubLeagueWorkspacePath } from "../client/src/lib/leagueWorkspaceNavigation";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const leaguesServer = read("server/leagues.ts");
const dashboard = read("client/src/pages/ClubDashboard.tsx");
const home = read("client/src/pages/Home.tsx");
const appNav = read("client/src/components/AppNavBar.tsx");
const mobileNav = read("client/src/components/MobileNavDrawer.tsx");
const leagueDropdown = read("client/src/components/LeagueDropdown.tsx");

describe("Club League workspace navigation", () => {
  it("deep-links into the Club Events League view", () => {
    expect(getClubLeagueWorkspacePath("club_123")).toBe(
      "/clubs/club_123/home?tab=events&view=leagues",
    );
  });

  it("loads canonical League data whenever the Events League view opens", () => {
    expect(dashboard).toContain('authFetch(`/api/leagues/club/${club.id}`, { credentials: "include" })');
    expect(dashboard).toContain('tab !== "events" || eventsFilter !== "leagues"');
    expect(dashboard).toContain('params.get("tab") === "events" && params.get("view") === "leagues"');
    expect(dashboard).toContain('setEventsFilter("leagues")');
    expect(dashboard).toContain("Loading Club Leagues");
  });

  it("returns owner-managed Leagues even before the commissioner is on the roster", () => {
    expect(leaguesServer).toContain('const managedLeagues = await db.select().from(leagues).where(eq(leagues.commissionerId, userId));');
    expect(leaguesServer).not.toContain("if (!myPlayers.length) return res.json([]);");
  });

  it("keeps Club League lists member-authorized and prioritizes active workspaces", () => {
    expect(leaguesServer).toMatch(/leaguesRouter\.get\("\/club\/:clubId",\s*requireAuth/);
    expect(leaguesServer).toMatch(/leaguesRouter\.get\("\/workspace",\s*requireAuth/);
    expect(leaguesServer).toContain("const leagueStatusPriority");
    expect(leaguesServer).toContain("active: 0");
    expect(leaguesServer).toContain("draft: 1");
    expect(leaguesServer).toContain("completed: 2");
    expect(leaguesServer).toContain("sortLeaguesForWorkspace(scopedLeagues)[0]");
  });

  it("routes desktop and mobile header navigation through the Club workspace resolver", () => {
    expect(home).toContain("useLeagueWorkspaceNavigation(user)");
    expect(home).toContain("await refreshLeagueWorkspaceUrl()");
    expect(appNav).toContain("useLeagueWorkspaceNavigation(user)");
    expect(appNav).toContain("await refreshLeagueWorkspaceUrl()");
    expect(mobileNav).toContain("leagueUrl?: string");
    expect(leagueDropdown).toContain("getClubLeagueWorkspacePath(lg.clubId)");
    expect(leagueDropdown).toContain("e.stopPropagation(); window.location.href = getClubLeagueWorkspacePath(lg.clubId)");
    expect(leagueDropdown).not.toContain("window.location.href = `/league/${lg.id}`");
  });
});
