import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "../../..");

function read(relativePath: string): string {
  return readFileSync(resolve(projectRoot, relativePath), "utf8");
}

function imgTags(source: string): string[] {
  return source.match(/<img\b[\s\S]*?\/>/g) ?? [];
}

describe("image loading strategy", () => {
  it("adds lazy loading and async decoding to a meaningful below-fold image set", () => {
    const files = [
      "client/src/pages/Home.tsx",
      "client/src/pages/ClubDashboard.tsx",
      "client/src/pages/ClubProfile.tsx",
      "client/src/pages/MyClubs.tsx",
      "client/src/pages/BlogPost.tsx",
      "client/src/pages/LeagueHistory.tsx",
      "client/src/components/TournamentWizard.tsx",
      "client/src/components/club/ClubAlbumTab.tsx",
    ];

    const optimized = files.flatMap((file) => imgTags(read(file)))
      .filter((tag) => tag.includes('loading="lazy"'));

    expect(optimized.length).toBeGreaterThanOrEqual(35);
    for (const tag of optimized) expect(tag).toContain('decoding="async"');
  });

  it("keeps navigation logos eager so primary chrome is not delayed", () => {
    for (const file of [
      "client/src/components/NavLogo.tsx",
      "client/src/components/AppNavBar.tsx",
      "client/src/components/MinimalTournamentNav.tsx",
    ]) {
      expect(read(file)).not.toContain('loading="lazy"');
    }
  });

  it("keeps primary tournament and authentication imagery eager", () => {
    expect(read("client/src/pages/Tournament.tsx")).not.toContain('loading="lazy"');
    const auth = read("client/src/pages/Auth.tsx");
    const logoTags = imgTags(auth).filter((tag) => tag.includes("otb-logo-exclamation"));
    expect(logoTags).toHaveLength(2);
    for (const logo of logoTags) expect(logo).not.toContain('loading="lazy"');
  });
});
