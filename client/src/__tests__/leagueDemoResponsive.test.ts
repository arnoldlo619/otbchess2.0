import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const clientRoot = resolve(import.meta.dirname, "..");
const bracketSource = readFileSync(resolve(clientRoot, "components/LeagueBracket.tsx"), "utf8");
const demoSource = readFileSync(resolve(clientRoot, "pages/LeagueDemo.tsx"), "utf8");
const dashboardSource = readFileSync(resolve(clientRoot, "pages/LeagueDashboard.tsx"), "utf8");

describe("LeagueDemo responsive containment", () => {
  it("contains the wide bracket inside a keyboard-accessible horizontal region", () => {
    expect(bracketSource).toContain("w-full max-w-full overflow-hidden");
    expect(bracketSource).toContain("overflow-x-auto overscroll-x-contain");
    expect(bracketSource).toContain('role="region"');
    expect(bracketSource).toContain("tabIndex={0}");
    expect(bracketSource).toContain("Scroll horizontally to view later rounds");
  });

  it("shows a mobile and tablet swipe affordance before the fixed-width bracket", () => {
    expect(bracketSource).toContain("Swipe to view the full bracket");
    expect(bracketSource).toContain("lg:hidden");
  });

  it("keeps the mobile league title centered and fully readable", () => {
    expect(demoSource).toContain("pointer-events-none absolute inset-x-16 text-center lg:hidden");
    expect(demoSource).toContain("block whitespace-nowrap text-base font-bold");
    expect(demoSource).toContain("text-[clamp(1.55rem,7vw,2.25rem)]");
  });

  it("removes the post-banner top inset in both League dashboards", () => {
    expect(demoSource).toContain('data-testid="league-demo-content-shell"');
    expect(demoSource).toContain("px-4 pt-0 pb-4 lg:px-6 lg:pt-0 lg:pb-6 space-y-5");
    expect(demoSource).not.toContain('className="p-4 lg:p-6');
    expect(dashboardSource).toContain('data-testid="league-dashboard-content-shell"');
    expect(dashboardSource).toContain("px-4 pt-0 pb-4 lg:px-6 lg:pt-0 lg:pb-6");
    expect(dashboardSource).toContain("px-4 pt-0 pb-6 lg:px-6 lg:pt-0 lg:pb-6 space-y-6");
    expect(dashboardSource).toContain("mx-4 lg:mx-6 mt-0 rounded-2xl");
  });

  it("uses the League hero as the continuous desktop identity surface", () => {
    const demoTopBar = demoSource.slice(
      demoSource.indexOf("BRANDED TOP BAR"),
      demoSource.indexOf("LEAGUE HERO BANNER")
    );
    const dashboardTopBar = dashboardSource.slice(
      dashboardSource.indexOf("BRANDED TOP BAR"),
      dashboardSource.indexOf("LEAGUE HERO BANNER")
    );

    expect(demoTopBar).toContain("lg:hidden");
    expect(dashboardTopBar).toContain("lg:hidden");
  });
});
