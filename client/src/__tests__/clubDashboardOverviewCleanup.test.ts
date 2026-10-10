import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const dashboardSource = readFileSync(
  resolve(process.cwd(), "client/src/pages/ClubDashboard.tsx"),
  "utf8",
);

describe("Club Dashboard overview cleanup", () => {
  it("removes the obsolete Needs Attention surface instead of leaving it permanently disabled", () => {
    expect(dashboardSource).not.toContain("Needs Attention");
    expect(dashboardSource).not.toContain("{false && (pendingInvites.length");
  });

  it("uses larger monochrome Quick Action labels and icon surfaces", () => {
    expect(dashboardSource).toContain("min-h-11 items-center gap-2");
    expect(dashboardSource).toContain("min-[1440px]:min-h-12");
    expect(dashboardSource).toContain("h-7 w-7 shrink-0 items-center justify-center rounded-full");
    expect(dashboardSource).toContain("min-[1440px]:h-9 min-[1440px]:w-9");
    expect(dashboardSource).toContain("text-sm font-semibold leading-5 min-[1440px]:text-base");
    expect(dashboardSource).toContain('"--overview-action-icon-surface": isDark ? "oklch(0.155 0.045 145)" : "rgba(255,255,255,0.96)"');
    expect(dashboardSource).toContain('color: isDark ? "rgba(255,255,255,0.88)" : "#15291c"');
    expect(dashboardSource).not.toContain('background: isDark ? "rgba(255,255,255,0.07)" : `${accent}13`');
  });

  it("preserves the four operational Quick Action intents", () => {
    expect(dashboardSource).toContain('{ icon: Plus, label: "New Meetup"');
    expect(dashboardSource).toContain('{ icon: GanttChart, label: "Tournament"');
    expect(dashboardSource).toContain('{ icon: LeaguesIcon, label: "Leagues", action: () => setTab("leagues") }');
    expect(dashboardSource).toContain('{ icon: Megaphone, label: "Post"');
    expect(dashboardSource).toContain("grid grid-cols-2 gap-x-2 gap-y-1");
    expect(dashboardSource).toContain("sm:grid-cols-4");
  });

  it("adds restrained, accessible hover depth without changing action behavior", () => {
    expect(dashboardSource).toContain("hover:-translate-y-px hover:bg-[var(--overview-action-hover)]");
    expect(dashboardSource).toContain('"--overview-action-hover": isDark ? "rgba(255,255,255,0.065)" : "rgba(21,41,28,0.055)"');
    expect(dashboardSource).toContain("focus:outline-none focus:ring-2 focus:ring-[#4CAF50]");
    expect(dashboardSource).toContain("group-hover:scale-[1.08]");
    expect(dashboardSource).toContain("motion-reduce:transition-none");
  });

  it("routes the Leagues action into the current club's create-and-manage workspace", () => {
    expect(dashboardSource).toContain('action: () => setTab("leagues")');
    expect(dashboardSource).toContain('tab === "leagues" && (');
    expect(dashboardSource).toContain('label: "New League"');
    expect(dashboardSource).toContain("<CreateLeagueWizard");
    expect(dashboardSource).toContain("void fetchClubLeagues()");
    expect(dashboardSource).toContain('href={`/leagues/${league.id}`}');
  });
});
