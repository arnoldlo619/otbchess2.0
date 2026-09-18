import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const myClubsSource = readFileSync(
  resolve(process.cwd(), "client/src/pages/MyClubs.tsx"),
  "utf8",
);

const desktopFilterBar = myClubsSource.slice(
  myClubsSource.indexOf("{/* ── Search & Filter Bar"),
  myClubsSource.indexOf("{/* Result count */}"),
);

describe("My Clubs visual filter edits", () => {
  it("removes the requested desktop sort and country select controls", () => {
    expect(desktopFilterBar).not.toContain('aria-label="Sort clubs"');
    expect(desktopFilterBar).not.toContain('aria-label="Filter clubs by country"');
    expect(desktopFilterBar).not.toContain("All Countries");
    expect(desktopFilterBar).toContain("{/* Desktop category filters */}");
  });

  it("retains responsive mobile filter access without restoring desktop selects", () => {
    expect(myClubsSource).toContain("setShowMobileFilters(true)");
    expect(myClubsSource).toContain("<MobileFilterDrawer");
    expect(myClubsSource).toContain("showMobileFilters");
  });

  it("removes the requested club category badge from card media without removing functional owner or verification markers", () => {
    const clubCard = myClubsSource.slice(
      myClubsSource.indexOf("function ClubCard"),
      myClubsSource.indexOf("// ── Mobile Filter Drawer"),
    );
    expect(clubCard).not.toContain("Bottom overlay — category only");
    expect(clubCard).not.toContain("{CATEGORY_LABELS[club.category]}");
    expect(clubCard).toContain("Owner");
    expect(clubCard).toContain("Verified");
  });
});
