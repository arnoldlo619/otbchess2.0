import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const clientRoot = resolve(import.meta.dirname, "..");
const homeSource = readFileSync(resolve(clientRoot, "pages/Home.tsx"), "utf8");
const reportSource = readFileSync(resolve(clientRoot, "pages/Report.tsx"), "utf8");
const carouselSource = readFileSync(resolve(clientRoot, "components/InstagramCarouselModal.tsx"), "utf8");

describe("remaining P0 release recovery contracts", () => {
  it("uses canonical landing and footer CTA destinations", () => {
    expect(homeSource).toContain("FOOTER_NAV_ITEMS");
    expect(homeSource).toContain("NAV_CTA_PRIMARY.path");
    expect(homeSource).toContain("NAV_CTA_SECONDARY.path");
    expect(homeSource).toContain('const LIVE_TOURNAMENT_DEMO_PATH = "/tournament/otb-demo-2026/manage"');
    expect(homeSource).not.toContain('href="/tools"');
    expect(homeSource).not.toContain('href="/?action=create"');
    expect(homeSource).not.toContain('window.location.href = "/tournaments/new"');
  });

  it("removes export-only report headings from navigation and accessibility trees", () => {
    expect(reportSource).toMatch(/aria-hidden="true"[\s\S]{0,120}\binert\b/);
    expect(carouselSource).toMatch(/aria-hidden="true"\s+inert/);
  });

  it("keeps the zero-flash skeleton and published statistics floors wired into Home", () => {
    expect(homeSource).toContain('data-testid="platform-stats-loading"');
    expect(homeSource).toContain("normalizePlatformStats(data)");
    expect(homeSource).toContain("liveCounts ?? PLATFORM_STATS_FLOORS");
  });
});
