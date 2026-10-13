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

  it("uses the shared opaque expanding rail above League content", () => {
    expect(dashboard).toContain('import { ClubDashboardSidebar, type ClubDashboardSidebarItem }');
    expect(dashboard).toContain('<ClubDashboardSidebar');
    expect(dashboard).toContain("const sidebarExpanded = sidebarHovered || sidebarKeyboardExpanded;");
    expect(dashboard).toContain('style={{ width: sidebarExpanded ? "264px" : "72px", minWidth: sidebarExpanded ? "264px" : "72px" }}');
    expect(dashboard).toContain('temporarilyExpanded={sidebarExpanded}');
    expect(dashboard).toContain('ariaLabel="League dashboard sidebar"');
    expect(dashboard).toContain('footerAction={{');
    expect(demo).toContain('<ClubDashboardSidebar');
    expect(demo).toContain("const sidebarExpanded = sidebarHovered || sidebarKeyboardExpanded;");
    expect(demo).toContain('style={{ width: sidebarExpanded ? "264px" : "72px", minWidth: sidebarExpanded ? "264px" : "72px" }}');
    expect(demo).toContain('temporarilyExpanded={sidebarExpanded}');
    expect(demo).toContain('ariaLabel="League demo sidebar"');
  });

  it("gives compact League rail icons descriptive navigation tooltips", () => {
    expect(dashboard).toContain('description: "See your current matchup and League form."');
    expect(dashboard).toContain('description: "Report results and advance the League week."');
    expect(dashboard).toContain('description: "Track player rankings and points."');
    expect(dashboard).toContain('brandTooltip="Return to the club dashboard."');
    expect(demo).toContain('description: "See your player dashboard and League form."');
    expect(demo).toContain('description: "Report results and advance the demo week."');
    expect(demo).toContain('description: "Compare player rankings and points."');
    expect(demo).toContain('brandTooltip="Return to the ChessOTB home page."');
  });

  it("separates player overview, commissioner operations, and standings surfaces", () => {
    expect(dashboard).toContain("Upcoming Matchups");
    expect(dashboard).toContain(">League form</p>");
    expect(dashboard).toContain('data-testid="league-player-recent-form"');
    expect(dashboard).not.toContain('data-testid="league-commissioner-workspace"');
    expect(dashboard).toContain("Submit Report");
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

  it("keeps a compact League rail reservation and a single production identity/action cluster", () => {
    expect(dashboard).toContain('transition-[width,min-width] duration-300');
    expect(demo).toContain('transition-[width,min-width] duration-300');
    expect(dashboard).toContain('data-testid="league-dashboard-hero"');
    expect(dashboard).toContain('h-[104px] sm:h-[112px] lg:h-[120px]');
    expect(demo).toContain('h-[104px] sm:h-[112px] lg:h-[120px]');
    expect(dashboard).toContain('text-[clamp(1.5rem,4vw,2rem)]');
    expect(demo).toContain('text-[clamp(1.5rem,4vw,2rem)]');
    expect(dashboard).toContain('otb-header-safe lg:hidden');
    expect(dashboard).toContain('data-testid="league-dashboard-header-actions"');
    expect(dashboard.match(/title="Share League"/g) ?? []).toHaveLength(1);
    expect(dashboard.match(/title=\{pushStatus === "subscribed" \? "Notifications On"/g) ?? []).toHaveLength(1);
    expect(dashboard).not.toContain("const progressPct");
  });

  it("keeps League content readable, contextual, and free of emoji warning glyphs", () => {
    expect(dashboard).not.toContain("Competition snapshot");
    expect(dashboard).toContain("Grow the roster");
    expect(dashboard).toContain('aria-label="Upcoming league matchups"');
    expect(dashboard).toContain('activeTab === "matchups" ? "hidden lg:flex" : "hidden"');
    expect(dashboard).toContain('hidden lg:grid items-center px-4 py-3 text-xs');
    expect(dashboard).toContain('className="lg:hidden px-4 py-4"');
    expect(dashboard).toContain("<AlertTriangle");
    expect(dashboard).not.toContain("⚠ Changing format");
  });

  it("uses one guest join conversion surface and organized history detail", () => {
    expect(dashboard).not.toContain("Sign In to Request a Spot");
    expect(dashboard).toContain("Join this League");
    expect(dashboard).toContain("All Results by Week");
    expect(dashboard).toContain("expandedHistoryWeek");
    expect(dashboard).toContain('aria-expanded={isExpanded}');
  });

  it("keeps settings editing focused with a responsive reference summary", () => {
    expect(dashboard).toContain("const configurationItems");
    expect(dashboard).toContain("Current settings");
    expect(dashboard).toContain("lg:grid-cols-[minmax(0,1fr)_17rem]");
    expect(dashboard).toContain('className="lg:hidden rounded-2xl"');
    expect(dashboard).toContain("min-h-11 flex-1 py-2.5");
  });
});

describe("League Demo implementation", () => {
  it("registers the public route and landing-page destination", () => {
    expect(app).toContain('<Route path={"/league-demo"} component={LeagueDemo} />');
    expect(home).toContain('href="/league-demo"');
    expect(home).toContain('tooltip: isGuest ? "View League Demo" : "Open your Club Leagues"');
  });

  it("includes 23 mock players plus player, commissioner, matchup, standings, schedule, and bracket views", () => {
    expect(demo).toContain('id: "23"');
    expect(demo).toContain('type TabId = "overview" | "commissioner" | "matchup" | "standings" | "schedule" | "history"');
    expect(demo).toContain('data-testid="league-demo-commissioner-workspace"');
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
