import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  MEMBER_CLUB_PROFILE_TABS,
  VISITOR_CLUB_PROFILE_TABS,
  clubProfileNavigationTabs,
} from "../client/src/lib/clubProfileNavigation.js";

const source = readFileSync(resolve(process.cwd(), "client/src/pages/ClubProfile.tsx"), "utf8");

describe("Club Profile visitor sidebar navigation", () => {
  it("keeps visitors on parent destinations while retaining direct Album and League destinations for members across the shared desktop rail and mobile navigation", () => {
    expect(MEMBER_CLUB_PROFILE_TABS).toEqual(["home", "feed", "events", "members", "album", "leagues"]);
    expect(VISITOR_CLUB_PROFILE_TABS).toEqual(["home", "feed", "events", "members"]);
    expect(clubProfileNavigationTabs(true)).toEqual(MEMBER_CLUB_PROFILE_TABS);
    expect(clubProfileNavigationTabs(false)).toEqual(VISITOR_CLUB_PROFILE_TABS);
    expect(source).toContain('import { ClubDashboardSidebar, type ClubDashboardSidebarItem } from "@/components/club/ClubDashboardSidebar";');
    expect(source).toContain("const profileSidebarItems: ClubDashboardSidebarItem[]");
    expect(source).toContain("clubProfileNavigationTabs(joined).map((tab) =>");
    expect(source).toContain('ariaLabel="Club profile sidebar"');
    expect(source).toContain('footerContent={');
    expect((source.match(/<ClubProfileNavigationItems joined=\{joined\}>/g) ?? [])).toHaveLength(1);
  });

  it("reserves the shared rail width during desktop expansion without changing the mobile navigation", () => {
    expect(source).toContain('const sidebarExpanded = sidebarHovered || sidebarKeyboardExpanded;');
    expect(source).toContain('width: sidebarExpanded ? "264px" : "72px"');
    expect(source).toContain('minWidth: sidebarExpanded ? "264px" : "72px"');
    expect(source).toContain('className="hidden flex-shrink-0 transition-[width,min-width]');
    expect(source).toContain('className="lg:hidden fixed bottom-0 left-0 right-0 z-40"');
  });

  it("keeps public Album and League access within their visitor parent experiences", () => {
    expect(source).toContain('setActiveTab("album")');
    expect(source).toContain('setActiveTab("leagues")');
    expect(source).toContain("View club albums");
    expect(source).toContain("View club leagues");
  });
});
