import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const clientRoot = resolve(__dirname, "..");
const dashboardSource = readFileSync(resolve(clientRoot, "pages/LeagueDashboard.tsx"), "utf8");
const demoSource = readFileSync(resolve(clientRoot, "pages/LeagueDemo.tsx"), "utf8");

describe("League player and commissioner workspace separation", () => {
  it("adds a dedicated commissioner tab without a duplicate operations banner", () => {
    expect(dashboardSource).toContain('"commissioner" | "matchups"');
    expect(dashboardSource).toContain('label: "Commissioner", icon: ShieldCheck');
    expect(dashboardSource).toContain('label: "Settings", icon: OtbSettingsIcon');
    expect(dashboardSource).not.toContain('data-testid="league-commissioner-workspace"');
    expect(dashboardSource).not.toContain("Week {league.currentWeek} operations");
    expect(dashboardSource).toContain("{/* Match cards */}");
    expect(dashboardSource).toContain("Submit Report");
    expect(dashboardSource).not.toContain("{/* Prep button for my matches */}");
  });

  it("routes hero reporting and advancement actions into the commissioner workspace", () => {
    expect(dashboardSource).toContain('setActiveTab("commissioner")');
    expect(dashboardSource).toContain('setSelectedWeek(league.currentWeek)');
    expect(dashboardSource).toContain('activeTab === "commissioner" && league.status === "active"');
    expect(dashboardSource).toContain('return league?.commissionerId === user.id && activeTab === "commissioner"');
  });

  it("keeps the player overview focused on the current matchup and personal form", () => {
    expect(dashboardSource).toContain('data-testid="league-player-recent-form"');
    expect(dashboardSource).toContain('data-testid="league-player-matchup-empty-state"');
    expect(dashboardSource).toContain(">League form</p>");
    expect(dashboardSource).not.toContain("Recent league results");
    expect(dashboardSource).not.toContain("{/* Week Results Summary Card */}");
    expect(dashboardSource).not.toContain("{/* Competition snapshot */}");
  });

  it("keeps the interactive demo aligned with the commissioner workflow", () => {
    expect(demoSource).toContain('type TabId = "overview" | "commissioner"');
    expect(demoSource).toContain('label: "Commissioner", icon: Settings');
    expect(demoSource).toContain('data-testid="league-demo-commissioner-workspace"');
    expect(demoSource).toContain("Results reported");
    expect(demoSource).toContain('data-testid="league-demo-advance-ready-footer"');
    expect(demoSource).toContain("Advance to Week 15");
    expect(demoSource).toContain('setSelectedScheduleWeek(15); setActiveTab("schedule");');
    expect(demoSource).not.toContain("{/* Compact Standings Preview */}");
  });

  it("reveals the sticky next-week action only after the active League week is complete", () => {
    expect(dashboardSource).toContain('data-testid="league-advance-ready-footer"');
    expect(dashboardSource).toContain('currentWeekMatches.every((match) => match.resultStatus === "completed")');
    expect(dashboardSource).toContain('sticky bottom-3 z-20');
    expect(dashboardSource).toContain("All board results are reported. Generate the next week when you are ready.");
    expect(dashboardSource).not.toContain("Commissioner Controls");
  });
});
