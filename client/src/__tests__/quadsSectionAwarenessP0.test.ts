import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const clientRoot = resolve(import.meta.dirname, "..");
const reportSource = readFileSync(resolve(clientRoot, "pages/Report.tsx"), "utf8");
const publicSource = readFileSync(resolve(clientRoot, "pages/PublicTournament.tsx"), "utf8");
const directorSource = readFileSync(resolve(clientRoot, "pages/Director.tsx"), "utf8");
const directorStateSource = readFileSync(resolve(clientRoot, "lib/directorState.ts"), "utf8");

describe("Quads P0 section awareness", () => {
  it("keeps Report section-filterable and suppresses a global Quads champion", () => {
    expect(reportSource).toContain('new URLSearchParams(urlSearch).get("section")');
    expect(reportSource).toContain('activeSection !== "all"');
    expect(reportSource).toContain('isQuadsAllSections={isQuads && activeSection === "all"}');
    expect(reportSource).toContain("Section Champions");
  });

  it("scopes public player cards to the followed player's Quad", () => {
    expect(publicSource).toContain("getPlayerSectionStandings(followedPlayer.id)");
    expect(publicSource).toContain("totalPlayers={playerSection?.playerIds.length ?? data.players.length}");
    expect(publicSource).toContain("sectionName={playerSection?.name}");
    expect(publicSource).toContain('sectionName ? `${sectionName} Champion` : "Champion"');
    expect(publicSource).toContain("Each quad is an independent competition");
  });

  it("auto-finalizes Quads independently using section-local champions", () => {
    expect(directorSource).toContain("const autoCompletedQuadsRef = useRef(false)");
    expect(directorSource).toContain('const isQuads = state.format === "quads"');
    expect(directorSource).toContain("getSectionWinners(calculateQuadStandings(section, games, state.players))");
    expect(directorSource).toContain("section champions confirmed");
    expect(directorSource).not.toContain('const isSwissLike = state.format === "swiss" || state.format === "roundrobin" || state.format === "doubleswiss" || state.format === "quads"');
  });

  it("marks every Quad section completed in the shared finalization state transition", () => {
    expect(directorStateSource).toContain('status: "completed"');
    expect(directorStateSource).toContain("quadSections: prev.quadSections.map");
  });
});
