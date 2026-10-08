import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

const tournamentHeader = source("client/src/components/MinimalTournamentNav.tsx");
const clubDashboard = source("client/src/pages/ClubDashboard.tsx");
const clubDemo = source("client/src/pages/ClubDashboardDemo.tsx");


describe("dashboard header appearance controls", () => {
  it("uses the canonical appearance toggle in the shared tournament header", () => {
    expect(tournamentHeader).toContain('import { ThemeToggle } from "@/components/ThemeToggle"');
    expect(tournamentHeader).toContain('<ThemeToggle />');
    expect(tournamentHeader).toContain('className="flex flex-1 items-center justify-end gap-2"');
  });

  it("adds the same toggle before Club dashboard navigation and account actions", () => {
    expect(clubDashboard).toContain('import { ThemeToggle } from "@/components/ThemeToggle"');
    expect(clubDashboard).toContain('<ThemeToggle />\n              <button');
    expect(clubDashboard).toContain('<div className="hidden lg:block">\n                <AvatarNavDropdown currentPage="Clubs" />');
  });

  it("keeps the fixture-only Club demo aligned with the live Club header", () => {
    expect(clubDemo).toContain('import { ThemeToggle } from "@/components/ThemeToggle"');
    expect(clubDemo).toContain('<ThemeToggle /><button type="button" onClick={() => setMobileNavOpen');
  });
});
