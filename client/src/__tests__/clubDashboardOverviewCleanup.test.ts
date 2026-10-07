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
    expect(dashboardSource).toContain("min-h-[72px] items-center justify-center gap-2.5");
    expect(dashboardSource).toContain("h-10 w-10 shrink-0 items-center justify-center rounded-xl");
    expect(dashboardSource).toContain("text-sm font-semibold sm:text-[15px]");
    expect(dashboardSource).toContain('background: isDark ? "rgba(255,255,255,0.075)" : "rgba(21,41,28,0.055)"');
    expect(dashboardSource).toContain('color: isDark ? "rgba(255,255,255,0.88)" : "#15291c"');
    expect(dashboardSource).not.toContain('background: isDark ? "rgba(255,255,255,0.07)" : `${accent}13`');
  });

  it("preserves the four operational Quick Action intents", () => {
    expect(dashboardSource).toContain('{ icon: Plus, label: "New Meetup"');
    expect(dashboardSource).toContain('{ icon: GanttChart, label: "Tournament"');
    expect(dashboardSource).toContain('{ icon: LeaguesIcon, label: "Leagues", action: () => setTab("leagues") }');
    expect(dashboardSource).toContain('{ icon: Megaphone, label: "Post"');
    expect(dashboardSource).toContain('max-w-[720px] grid-cols-2 gap-3 sm:grid-cols-4');
  });

  it("adds restrained, accessible hover depth without changing action behavior", () => {
    expect(dashboardSource).toContain("hover:-translate-y-0.5 hover:border-[var(--quick-action-hover-border)] hover:shadow-[var(--quick-action-hover-shadow)]");
    expect(dashboardSource).toContain('"--quick-action-hover-border": isDark ? `${accent}82` : `${accent}58`');
    expect(dashboardSource).toContain("group-hover:opacity-100 motion-reduce:transition-none");
    expect(dashboardSource).toContain("group-hover:scale-[1.045]");
  });

  it("routes the Leagues action into the current club's create-and-manage workspace", () => {
    expect(dashboardSource).toContain('action: () => setTab("leagues")');
    expect(dashboardSource).toContain('tab === "leagues" && (');
    expect(dashboardSource).toContain('label: "New League"');
    expect(dashboardSource).toContain('body: JSON.stringify({ clubId: club.id');
    expect(dashboardSource).toContain('href={`/leagues/${league.id}`}');
  });
});
