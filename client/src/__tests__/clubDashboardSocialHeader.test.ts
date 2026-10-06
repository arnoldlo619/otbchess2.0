import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboard = readFileSync(resolve(process.cwd(), "client/src/pages/ClubDashboard.tsx"), "utf8");
const demo = readFileSync(resolve(process.cwd(), "client/src/pages/ClubDashboardDemo.tsx"), "utf8");

describe("Club Dashboard social header", () => {
  it("uses the owner-managed club banner as an Overview-only full-bleed cover", () => {
    expect(dashboard).toContain('{tab === "overview" && isOwnerOrDirector && (');
    expect(dashboard).toContain('data-testid="club-dashboard-social-header"');
    expect(dashboard).toContain('data-testid="club-dashboard-full-bleed-banner"');
    expect(dashboard).toContain("backgroundImage: `url(${club.bannerUrl})`");
    expect(dashboard).toContain('className="pointer-events-none absolute inset-0 z-0 bg-cover"');
    expect(dashboard).toContain("The supplied cover fills the entire social header; one even scrim avoids a visible transition seam.");
    expect(dashboard).toContain("rgba(2,12,6,0.68)");
  });

  it("uses the Album header’s avatar-first identity hierarchy rather than text over the photo", () => {
    expect(dashboard).toContain("<PlayerAvatar");
    expect(dashboard).toContain("avatarUrl={club.avatarUrl ?? undefined}");
    expect(dashboard).toContain("size={72}");
    expect(dashboard).toContain("{club.memberCount}</strong> members");
    expect(dashboard).toContain("{club.tournamentCount}</strong> events");
    expect(dashboard).not.toContain("COUNTRY_FLAGS");
    expect(dashboard).not.toContain('"Private club"');
  });

  it("preserves owner banner upload, drag-and-drop, and Album-specific rendering", () => {
    expect(dashboard).toContain("handleBannerFile(file)");
    expect(dashboard).toContain('id="banner-upload-dash"');
    expect(dashboard).toContain('aria-label="Upload club banner image"');
  });

  it("keeps the public demo cover aligned with the Overview-only live header", () => {
    expect(demo).toContain('data-testid="club-demo-social-header"');
    expect(demo).toContain('data-testid="club-demo-full-bleed-banner"');
    expect(demo).toContain('style={{ backgroundImage: `url(${DEMO_BANNER_IMAGE})` }}');
    expect(demo).toContain('relative z-10 h-[108px] sm:h-[144px]');
    expect(demo).toContain('size="lg"');
    expect(demo).toContain('if (activeTab !== "overview") return null;');
  });
});
