import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(import.meta.dirname, "../pages/ClubDashboard.tsx"),
  "utf8",
);

describe("ClubDashboard route code splitting", () => {
  it("loads heavy owner workflows through dynamic imports", () => {
    const lazyModules = [
      "@/components/TournamentWizard",
      "@/components/ClubMeetupWizard",
      "@/components/ClubSettingsPanel",
      "@/components/club/RsvpFormAnalytics",
    ];

    for (const modulePath of lazyModules) {
      expect(source).toContain(`import("${modulePath}")`);
      expect(source).not.toContain(`from "${modulePath}";`);
    }
  });

  it("mounts full-screen creation workflows only while open", () => {
    expect(source).toContain("{showTournamentWizard && user && (");
    expect(source).toContain("{showMeetupWizard && user && club && (");
    expect(source).toContain("<Suspense fallback={<ClubFeatureFallback overlay />}>");
  });

  it("keeps local content visible with scoped loading feedback", () => {
    expect(source).toContain("function ClubFeatureFallback");
    expect(source).toContain("Loading club tools…");
    expect(source.match(/<Suspense\b/g)?.length ?? 0).toBeGreaterThanOrEqual(4);
  });
});
