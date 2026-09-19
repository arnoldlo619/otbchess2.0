import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const read = (relative: string) => readFileSync(resolve(root, relative), "utf8");

describe("authoritative Quads read models", () => {
  const clientQuads = read("client/src/lib/quads.ts");
  const publicSnapshot = read("server/publicSnapshot.ts");
  const publicTournament = read("client/src/pages/PublicTournament.tsx");
  const finalStandings = read("client/src/pages/FinalStandings.tsx");
  const directorState = read("client/src/lib/directorState.ts");
  const director = read("client/src/pages/Director.tsx");
  const server = read("server/index.ts");

  it("uses one shared Quads projection in client and server views", () => {
    expect(clientQuads).toContain('import { projectQuadSectionStandings } from "@shared/quadsProjection"');
    expect(clientQuads).toContain("return projectQuadSectionStandings(section, games, players, tiebreakOrder);");
    expect(publicSnapshot).toContain('import { projectQuadSectionStandings } from "../shared/quadsProjection.js"');
    expect(publicSnapshot).toContain("input.quadSettings?.tiebreakOrder");
  });

  it("keeps Quads rankings section-local across public and final results", () => {
    expect(publicTournament).toContain("return section.standings;");
    expect(publicTournament).toContain("const sectionRows = s.standings;");
    expect(finalStandings).toContain("return <QuadsFinalResults");
    expect(finalStandings).toContain("Each Quad is an independent section with its own champion and tiebreak order.");
  });

  it("does not substitute the demo tournament for unresolved real IDs", () => {
    expect(directorState).toContain("function getUnresolvedInitialState");
    expect(directorState).toContain("return getUnresolvedInitialState(tournamentId);");
    expect(directorState).not.toContain("// 4. Unknown ID — fall back to demo");
  });

  it("uses canonical spectator routes and server-owned lifecycle policy", () => {
    expect(director).toContain("/live/${encodeURIComponent(spectatorSlug)}");
    expect(server).toContain("requireTournamentLifecycleOwner");
    expect(server).toContain("registration_full");
    expect(server).toContain("SELECT tournament_id FROM user_tournaments");
    expect(server).toContain("invalidateSnapshotCache(id);");
  });
});
