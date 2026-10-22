import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const clientRoot = resolve(import.meta.dirname, "..");
const mobileNavSource = readFileSync(resolve(clientRoot, "components/league/LeagueMobileTabBar.tsx"), "utf8");
const dashboardSource = readFileSync(resolve(clientRoot, "pages/LeagueDashboard.tsx"), "utf8");
const demoSource = readFileSync(resolve(clientRoot, "pages/LeagueDemo.tsx"), "utf8");
const fullSeasonSource = readFileSync(resolve(clientRoot, "components/league/FullSeasonLeaguePanels.tsx"), "utf8");
const calendarSource = readFileSync(resolve(clientRoot, "components/league/LeagueMonthCalendar.tsx"), "utf8");
const readabilityStyles = readFileSync(resolve(clientRoot, "styles/leagueContentReadability.css"), "utf8");

describe("League phone navigation and action safety", () => {
  it("uses a shared, bounded mobile dock rather than squeezing every League tab into one row", () => {
    expect(mobileNavSource).toContain("PRIMARY_TAB_LIMIT = 4");
    expect(mobileNavSource).toContain("PRIMARY_TAB_PRIORITY");
    expect(mobileNavSource).toContain('"matchup", "matchups", "standings"');
    expect(mobileNavSource).toContain('commissioner: "Manage"');
    expect(mobileNavSource).toContain('standings: "Ranks"');
    expect(mobileNavSource).toContain("aria-label={item.label}");
    expect(mobileNavSource).toContain("More League destinations");
    expect(mobileNavSource).toContain('role="dialog"');
    expect(mobileNavSource).toContain('aria-modal="true"');
    expect(mobileNavSource).toContain("useAccessibleOverlay");
    expect(mobileNavSource).toContain("min-h-12");
    expect(mobileNavSource).toContain("safe-area-inset-bottom");
    expect(dashboardSource).toContain('import { LeagueMobileTabBar } from "@/components/league/LeagueMobileTabBar"');
    expect(demoSource).toContain('import { LeagueMobileTabBar } from "@/components/league/LeagueMobileTabBar"');
    expect(dashboardSource).toContain('ariaLabel="League navigation"');
    expect(demoSource).toContain('ariaLabel="League demo navigation"');
    expect(readabilityStyles).toContain('body:has([data-testid="league-mobile-tab-bar"]) [aria-label="Install OTB Chess app"]');
    expect(readabilityStyles).toContain('body:has([data-testid="league-mobile-tab-bar"]):has([aria-label="Install OTB Chess app"]) .league-content-scale');
  });

  it("reserves scrollable content clearance and a safe top inset for the Demo League", () => {
    expect(demoSource).toContain('useState<TabId>("overview")');
    expect(demoSource).toContain('useState<"table" | "bracket">("table")');
    expect(demoSource).toContain('h-[100dvh] w-full max-w-full overflow-hidden overscroll-x-none');
    expect(demoSource).toContain("otb-header-safe lg:hidden");
    expect(demoSource).toContain("overflow-x-hidden overflow-y-auto pb-[calc(7rem+env(safe-area-inset-bottom,0px))] lg:pb-6");
  });

  it("keeps completed-week advance actions above the fixed phone dock in live and Demo workspaces", () => {
    const phoneSafeOffset = "bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))]";
    expect(dashboardSource).toContain(phoneSafeOffset);
    expect(demoSource).toContain(phoneSafeOffset);
    expect(dashboardSource).toContain("sm:w-auto");
    expect(demoSource).toContain("Advance to Week 15");
  });

  it("reflows the live Overview deadline below the title on phones instead of overlapping it", () => {
    expect(dashboardSource).toContain("flex-col items-center justify-center gap-2 px-5 py-4 sm:flex-row sm:gap-0");
    expect(dashboardSource).toContain("sm:max-w-[calc(100%-5.5rem)]");
    expect(dashboardSource).toContain("sm:absolute sm:right-5 sm:top-1/2 sm:-translate-y-1/2");
  });

  it("keeps Commissioner reporting choices readable and touch-safe on phones", () => {
    expect(demoSource).toContain("grid grid-cols-1 gap-2 sm:grid-cols-3");
    expect(demoSource).toContain("min-h-11 rounded-xl px-3");
    expect(dashboardSource).toContain("grid grid-cols-1 gap-2 sm:grid-cols-3");
    expect(fullSeasonSource).toContain("grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]");
    expect(fullSeasonSource).toContain("col-span-3 min-h-11");
    expect(fullSeasonSource).toContain("Report result");
  });

  it("brings the selected Schedule week forward and preserves readable attention status in either theme", () => {
    expect(calendarSource).toContain("min-[420px]:grid-cols-2 xl:grid-cols-4");
    expect(calendarSource).toContain('"order-first min-[420px]:order-none"');
    expect(calendarSource).toContain('isDark ? "#fbbf24" : "#9a5b00"');
  });
});
