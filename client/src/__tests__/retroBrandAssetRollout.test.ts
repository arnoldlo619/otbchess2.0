import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "../../..");
const clientRoot = resolve(projectRoot, "client");

function read(relativePath: string): string {
  return readFileSync(resolve(projectRoot, relativePath), "utf8");
}

const runtimeSources = [
  "client/src/components/AppNavBar.tsx",
  "client/src/components/AuthModal.tsx",
  "client/src/components/InstallBanner.tsx",
  "client/src/components/MinimalTournamentNav.tsx",
  "client/src/components/ShareResultsModal.tsx",
  "client/src/components/TournamentWizard.tsx",
  "client/src/components/club/ClubDashboardSidebar.tsx",
  "client/src/components/prep/PrepExportCard.tsx",
  "client/src/components/ui/anime-navbar.tsx",
  "client/src/pages/Auth.tsx",
  "client/src/pages/Blog.tsx",
  "client/src/pages/BlogPost.tsx",
  "client/src/pages/ClubDashboard.tsx",
  "client/src/pages/ClubProfile.tsx",
  "client/src/pages/Home.tsx",
  "client/src/pages/Join.tsx",
  "client/src/pages/MatchupPrep.tsx",
  "client/src/pages/PlayerView.tsx",
].map(read).join("\n");

const retiredLogoIdentifiers = [
  "otb-logo-exclamation",
  "otb-logo-thumbnail",
  "otbchesslogo_brilliant",
  "chessotb-wordmark-320",
  "chessotb-logo_edcecdb1",
  "bWANpVvGVfpfXSpZ",
  "otb-logo_54fb3385",
];

describe("OTB!! brand rollout", () => {
  it("ships the supplied checkerboard mark at favicon, app, and maskable sizes", () => {
    for (const asset of [
      "brand/otb-checker-app-icon-512.png",
      "brand/otb-checker-app-icon-maskable-512.png",
      "brand/otb-checker-app-icon-192.png",
      "brand/otb-checker-app-icon-180.png",
      "brand/otb-checker-favicon-32.png",
      "brand/otb-checker-favicon-16.png",
    ]) {
      expect(existsSync(resolve(clientRoot, "public", asset))).toBe(true);
    }
    expect(existsSync(resolve(clientRoot, "public/favicon.ico"))).toBe(true);
  });

  it("uses local retro assets in browser, PWA, and install metadata", () => {
    const indexHtml = read("client/index.html");
    const manifest = JSON.parse(read("client/public/manifest.json")) as { icons: Array<{ src: string; purpose: string }> };
    const installBanner = read("client/src/components/InstallBanner.tsx");

    expect(indexHtml).toContain('href="/brand/otb-checker-favicon-16.png"');
    expect(indexHtml).toContain('href="/brand/otb-checker-app-icon-180.png"');
    expect(indexHtml).toContain('content="/brand/otb-checker-app-icon-192.png"');
    expect(manifest.icons).toContainEqual(expect.objectContaining({ src: "/brand/otb-checker-app-icon-maskable-512.png", purpose: "maskable" }));
    expect(manifest.icons).toContainEqual(expect.objectContaining({ src: "/brand/otb-checker-app-icon-512.png", purpose: "any" }));
    expect(installBanner).toContain('src="/brand/otb-checker-app-icon-192.png"');
  });

  it("replaces every active legacy logo reference with the matching retro wordmark or compact mark", () => {
    expect(runtimeSources).toContain('/brand/otb-retro-cream-green-wordmark.webp');
    expect(runtimeSources).toContain('/brand/otb-retro-app-icon-512.png');
    for (const retiredIdentifier of retiredLogoIdentifiers) {
      expect(runtimeSources).not.toContain(retiredIdentifier);
    }
  });
});
