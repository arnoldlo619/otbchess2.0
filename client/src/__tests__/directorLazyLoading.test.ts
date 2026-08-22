import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(import.meta.dirname, "../pages/Director.tsx"),
  "utf8",
);

describe("Director route code splitting", () => {
  it("loads heavy tournament tools through dynamic imports", () => {
    const lazyModules = [
      "@/components/InstagramCarouselModal",
      "@/components/AddPlayerModal",
      "@/components/UploadRSVPModal",
      "@/components/EditPlayerModal",
      "@/components/SpectatorQRScreen",
      "@/components/TournamentSettingsPanel",
      "@/components/BroadcastSettingsPanel",
      "@/components/SmtpSettingsCard",
      "@/components/EliminationBracketView",
      "@/components/StyleAwarePairingsPanel",
      "@/components/tournament/QuadsDirectorPanel",
    ];

    for (const modulePath of lazyModules) {
      expect(source).toContain(`import("${modulePath}")`);
      expect(source).not.toContain(`from "${modulePath}";`);
    }
  });

  it("mounts modal chunks only while their corresponding experience is open", () => {
    expect(source).toContain("{showSpectatorQR && (");
    expect(source).toContain("{showAddPlayer && (");
    expect(source).toContain("{showCarousel && (");
    expect(source).toContain("{showUploadRSVP && (");
    expect(source).toContain("{editingPlayer && (");
  });

  it("provides local loading feedback instead of blanking the Director route", () => {
    expect(source).toContain("function DirectorFeatureFallback");
    expect(source).toContain("Loading tournament tools…");
    expect(source.match(/<Suspense\b/g)?.length ?? 0).toBeGreaterThanOrEqual(10);
  });
});
