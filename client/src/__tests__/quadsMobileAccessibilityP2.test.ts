import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const clientRoot = resolve(import.meta.dirname, "..");
const directorPanel = readFileSync(
  resolve(clientRoot, "components/tournament/QuadsDirectorPanel.tsx"),
  "utf8",
);
const publicTournament = readFileSync(resolve(clientRoot, "pages/PublicTournament.tsx"), "utf8");

describe("Quads mobile accessibility", () => {
  it("keeps Director section controls scrollable and at least 44px tall", () => {
    expect(directorPanel).toContain("overflow-x-auto pb-1 sm:w-auto");
    expect(directorPanel).toContain('role="tablist" aria-label="Round tabs"');
    expect(directorPanel).toContain('role="group" aria-label="Section view"');
    expect(directorPanel.match(/min-h-11/g)?.length ?? 0).toBeGreaterThanOrEqual(7);
    expect(directorPanel).toContain('aria-label="Cancel section rename"');
    expect(directorPanel).toContain("aria-label={`Rename ${selectedSection.name}`}");
  });

  it("uses responsive stacking for the selected Quad workspace header", () => {
    expect(directorPanel).toContain("flex flex-col items-stretch justify-between gap-3 border-b");
    expect(directorPanel).toContain("sm:flex-row sm:items-center");
  });

  it("gives public mobile and Quad section selectors complete tab semantics", () => {
    expect(publicTournament).toContain('role="tablist" aria-label="Tournament view"');
    expect(publicTournament).toContain('role="tablist" aria-label="Quad sections"');
    expect(publicTournament).toContain('aria-selected={activeQuadSection === "all"}');
    expect(publicTournament).toContain("aria-selected={isActive}");
    expect(publicTournament.match(/min-h-11/g)?.length ?? 0).toBeGreaterThanOrEqual(4);
  });

  it("uses an accessible icon instead of an unlabeled trophy emoji", () => {
    expect(publicTournament).toContain('aria-label="Section champion"');
    expect(publicTournament).not.toContain('row.rank === 1 ? "🏆"');
  });
});
