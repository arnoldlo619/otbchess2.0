import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const clientRoot = resolve(import.meta.dirname, "..");
const read = (relativePath: string) => readFileSync(resolve(clientRoot, relativePath), "utf8");

describe("canonical tournament format label adoption", () => {
  it.each([
    "components/TournamentSettingsPanel.tsx",
    "components/TournamentWizard.tsx",
    "pages/Archive.tsx",
    "pages/ClubProfile.tsx",
    "pages/Director.tsx",
    "pages/Join.tsx",
    "pages/Print.tsx",
    "pages/PublicTournament.tsx",
    "pages/Tournament.tsx",
    "pages/TournamentOverview.tsx",
  ])("uses the canonical helper in %s", (relativePath) => {
    expect(read(relativePath)).toContain("getTournamentFormatLabel");
  });

  it("keeps all six formats available and correctly described in the wizard", () => {
    const source = read("components/TournamentWizard.tsx");
    for (const format of ["swiss", "doubleswiss", "roundrobin", "elimination", "swiss_elim", "quads"]) {
      expect(source).toContain(`value: "${format}"`);
    }
    expect(source).toContain("Swiss qualification rounds lead into a seeded elimination bracket.");
    expect(source).toContain("Players are grouped by rating into four-player round-robin sections.");
  });

  it("removes fallback-prone completion-feed format ternaries from Director", () => {
    const source = read("pages/Director.tsx");
    expect(source).toContain("getDirectorFormatSummary(");
    expect(source).not.toContain('const fmtLabel = state.format === "swiss"');
    expect(source).not.toContain('const fmtLabel2 = state.format === "swiss"');
  });

  it("provides format-specific pairing summaries in settings", () => {
    const source = read("components/TournamentSettingsPanel.tsx");
    expect(source).toContain("function getPairingInfoRows");
    expect(source).toContain('["Final Phase", "Seeded elimination bracket"]');
    expect(source).toContain('["Section Size", "4 players per section"]');
  });
});
