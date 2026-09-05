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
  it("keeps visitors on parent destinations while retaining direct Album and League destinations for members on desktop and mobile", () => {
    expect(MEMBER_CLUB_PROFILE_TABS).toEqual(["home", "feed", "events", "members", "album", "leagues"]);
    expect(VISITOR_CLUB_PROFILE_TABS).toEqual(["home", "feed", "events", "members"]);
    expect(clubProfileNavigationTabs(true)).toEqual(MEMBER_CLUB_PROFILE_TABS);
    expect(clubProfileNavigationTabs(false)).toEqual(VISITOR_CLUB_PROFILE_TABS);
    expect((source.match(/<ClubProfileNavigationItems joined=\{joined\}>/g) ?? [])).toHaveLength(2);
  });

  it("keeps public Album and League access within their visitor parent experiences", () => {
    expect(source).toContain('setActiveTab("album")');
    expect(source).toContain('setActiveTab("leagues")');
    expect(source).toContain("View club albums");
    expect(source).toContain("View club leagues");
  });
});
