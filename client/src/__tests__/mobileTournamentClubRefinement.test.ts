import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "../../..");
const playerView = readFileSync(resolve(projectRoot, "client/src/pages/PlayerView.tsx"), "utf8");
const clubDashboard = readFileSync(resolve(projectRoot, "client/src/pages/ClubDashboard.tsx"), "utf8");

describe("mobile tournament and club dashboard refinements", () => {
  it("keeps the player tournament header focused on the title, round, and live connection state", () => {
    expect(playerView).not.toContain("OTB!! · Live");
    expect(playerView).toContain("R{round}/{totalRounds}");
    expect(playerView).toContain("<ConnectionBadge connected={connected} isDark={isDark} />");
  });

  it("expresses board color as one plain-language assignment without an assignment rank pill", () => {
    expect(playerView).toContain('Playing as {myColor === "white" ? "White" : "Black"}');
    expect(playerView).not.toContain("Rank #{rank}");
    expect(playerView).toContain("Board {game.board}");
  });

  it("uses appearance-aware completed-result accents instead of fixed pale amber text", () => {
    expect(clubDashboard).toContain('const completedResultAccent = isDark ? "oklch(0.84 0.15 80)" : "oklch(0.45 0.13 80)";');
    expect(clubDashboard).toContain("completedResultDateSurface");
    expect(clubDashboard).toContain("style={{ color: completedResultAccent }}");
    expect(clubDashboard).not.toContain('<h2 className="text-base font-bold leading-5 text-amber-300 sm:text-lg sm:leading-6">');
  });

  it("replaces the Club Dashboard mobile footer and owner More sheet with one accessible drawer", () => {
    expect(clubDashboard).toContain("openMobileNavDrawer");
    expect(clubDashboard).toContain("closeMobileNavDrawer");
    expect(clubDashboard).toContain('aria-label={mobileNavOpen ? "Close club navigation" : "Open club navigation"}');
    expect(clubDashboard).toContain('aria-label="Club dashboard navigation"');
    expect(clubDashboard).toContain('clubTabs.filter((clubTab) => !clubTab.ownerOnly)');
    expect(clubDashboard).toContain('clubTabs.filter((clubTab) => clubTab.ownerOnly)');
    expect(clubDashboard).toContain("Join Club QR");
    expect(clubDashboard).toContain('<div className="hidden lg:block">\n                <AvatarNavDropdown currentPage="Clubs" />');
    expect(clubDashboard).toContain('user && !user.isGuest ? "My Profile" : "Sign in"');
    expect(clubDashboard).not.toContain('Mobile bottom nav bar');
    expect(clubDashboard).not.toContain('More owner tools');
  });

  it("uses touch-safe controls and releases the old mobile footer reserve", () => {
    expect(clubDashboard).toContain('className="lg:hidden flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform active:scale-95"');
    expect(clubDashboard).toContain('pb-[calc(1rem+env(safe-area-inset-bottom,0px))] lg:pb-6');
    expect(clubDashboard).not.toContain('pb-[calc(5rem+env(safe-area-inset-bottom,0px))] lg:pb-6');
  });
});
