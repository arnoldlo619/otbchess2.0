import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd());
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("production community and content integrity", () => {
  it("keeps legacy club and event seeding disabled and removes the production demo-member control", () => {
    expect(read("client/src/lib/clubRegistry.ts")).toContain("const ENABLE_LEGACY_DEMO_SEEDING = false;");
    expect(read("client/src/lib/clubEventRegistry.ts")).toContain("const ENABLE_LEGACY_DEMO_SEEDING = false;");
    expect(read("client/src/pages/ClubDashboard.tsx")).not.toContain("Add Demo Members");
    expect(read("client/src/pages/ClubDashboard.tsx")).not.toContain("seedDemoMembersToClub");
  });

  it("does not label a Quads tournament as Swiss", () => {
    const source = read("client/src/lib/clubRegistry.ts");
    expect(source).not.toMatch(/name:\s*"[^"]*quads?[^"]*"[^\n]*format:\s*"Swiss"/i);
  });

  it("uses explicit pending-state copy instead of user-facing TBD labels", () => {
    const uiSources = [
      "client/src/pages/FinalStandings.tsx",
      "client/src/pages/LeagueHistory.tsx",
      "client/src/pages/ClubProfile.tsx",
      "client/src/components/EliminationBracketView.tsx",
      "client/src/components/PublicBracketView.tsx",
      "client/src/components/MobileBracketCarousel.tsx",
    ].map(read).join("\n");

    expect(uiSources).not.toMatch(/>\s*(?:Champion\s+)?TBD\s*</);
    expect(uiSources).not.toMatch(/\?\?\s*"TBD"/);
  });

  it("reserves the initial Clubs layout and promotes only the first visible banner", () => {
    const source = read("client/src/pages/MyClubs.tsx");

    expect(source).toContain("const [discoverLoading, setDiscoverLoading] = useState(true);");
    expect(source).toContain("const [initialClubsLoading, setInitialClubsLoading] = useState(true);");
    expect(source).toContain('loading={priority ? "eager" : "lazy"}');
    expect(source).toContain('fetchPriority={priority ? "high" : "auto"}');
    expect(source).toContain("priority={index === 0}");
  });

  it("uses native buttons for Clubs creation and media-upload activation", () => {
    const clubsSource = read("client/src/pages/MyClubs.tsx");
    const bannerSource = read("client/src/components/ClubBannerUpload.tsx");
    const avatarSource = read("client/src/components/ClubAvatarUpload.tsx");

    expect(clubsSource).toContain('aria-label="Start a new club"');
    expect(clubsSource).toMatch(/<button[\s\S]*?aria-label="Start a new club"/);
    expect(bannerSource).toContain('aria-label="Upload club banner"');
    expect(avatarSource).toContain('aria-label="Upload club avatar"');
    expect(bannerSource).not.toContain('role="button"');
    expect(avatarSource).not.toContain('role="button"');
  });
});
