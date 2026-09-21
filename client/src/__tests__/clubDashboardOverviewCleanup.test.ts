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
    expect(dashboardSource).toContain("min-h-14 items-center justify-center gap-2");
    expect(dashboardSource).toContain("sm:min-h-16");
    expect(dashboardSource).toContain("text-sm font-semibold sm:text-[15px]");
    expect(dashboardSource).toContain('background: isDark ? "rgba(255,255,255,0.075)" : "rgba(21,41,28,0.055)"');
    expect(dashboardSource).toContain('color: isDark ? "rgba(255,255,255,0.88)" : "#15291c"');
    expect(dashboardSource).not.toContain('background: isDark ? "rgba(255,255,255,0.07)" : `${accent}13`');
  });

  it("preserves the three operational Quick Action intents", () => {
    expect(dashboardSource).toContain('{ icon: Plus, label: "New Meetup"');
    expect(dashboardSource).toContain('{ icon: GanttChart, label: "Tournament"');
    expect(dashboardSource).toContain('{ icon: Megaphone, label: "Post"');
  });
});
