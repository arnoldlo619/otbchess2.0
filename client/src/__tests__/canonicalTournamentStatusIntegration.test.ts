import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const clientRoot = resolve(import.meta.dirname, "..");
const read = (relativePath: string) => readFileSync(resolve(clientRoot, relativePath), "utf8");

describe("canonical tournament lifecycle adoption", () => {
  it.each([
    "components/AppNavBar.tsx",
    "components/SpectatorQRScreen.tsx",
    "components/SpectatorShareModal.tsx",
    "hooks/useActiveTournament.ts",
    "pages/Archive.tsx",
    "pages/ClubProfile.tsx",
    "pages/Director.tsx",
    "pages/PublicTournament.tsx",
    "pages/Tournament.tsx",
  ])("uses shared lifecycle metadata in %s", (relativePath) => {
    const source = read(relativePath);
    expect(source).toMatch(/getTournamentStatus(?:Display)?/);
  });

  it("does not treat unknown active-tournament state as a live navigation signal", () => {
    const hook = read("hooks/useActiveTournament.ts");
    const nav = read("components/AppNavBar.tsx");
    expect(hook).not.toContain('status: "registration" | "in_progress" | "paused" | "completed" | "unknown"');
    expect(nav).not.toContain('activeTournament.status === "unknown"');
    expect(nav).toContain("activeStatus.isLive || activeStatus.isPending");
  });

  it("suppresses game-level Live labels after public tournament completion", () => {
    const source = read("pages/PublicTournament.tsx");
    expect(source).toContain('const isLive = !isTournamentComplete && game.result === "*";');
    expect(source).toContain("isTournamentComplete={isCompleted}");
  });

  it("passes Director lifecycle state into both spectator sharing surfaces", () => {
    const source = read("pages/Director.tsx");
    expect(source.match(/tournamentStatus=\{state\.status\}/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(source).toContain("tournamentStatusDisplay.isLive && childBrackets.some");
    expect(source).toContain('tournamentStatusDisplay.isLive && state.elimPhase === "elimination"');
  });

  it("renders completed spectator messaging without a pulsing Live marker", () => {
    const qr = read("components/SpectatorQRScreen.tsx");
    const share = read("components/SpectatorShareModal.tsx");
    expect(qr).toMatch(/statusDisplay\.isComplete\s*\?\s*"TOURNAMENT COMPLETED"/);
    expect(qr).toContain('statusDisplay.isComplete ? "Scan to view results"');
    expect(share).toContain('statusDisplay.isComplete ? "Tournament Completed"');
    expect(share).toContain("{statusDisplay.isLive && <span");
  });
});
