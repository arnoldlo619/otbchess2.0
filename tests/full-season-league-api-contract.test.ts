import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "..");
const routes = readFileSync(resolve(projectRoot, "server/leagues.ts"), "utf8");
const service = readFileSync(resolve(projectRoot, "server/fullSeasonLeague.ts"), "utf8");
const schema = readFileSync(resolve(projectRoot, "shared/schema.ts"), "utf8");
const dashboard = readFileSync(resolve(projectRoot, "client/src/pages/LeagueDashboard.tsx"), "utf8");

// Guards the public lifecycle contract without creating tournament or league data.
describe("Full Season League lifecycle contract", () => {
  it("defaults League creation to Full Season while retaining Classic Round Robin", () => {
    expect(routes).toContain('const resolvedFormat = formatType && allowedFormats.includes(formatType) ? formatType : "full_season"');
    expect(routes).toContain('"round_robin"');
    expect(routes).toContain("getFullSeasonStructure(maxPlayers)");
  });

  it("exposes generated/published/in-progress Match Set controls", () => {
    expect(routes).toContain('leaguesRouter.post("/:leagueId/weeks/:weekNumber/publish"');
    expect(routes).toContain('leaguesRouter.post("/:leagueId/weeks/:weekNumber/start"');
    expect(routes).toContain('leaguesRouter.get("/:leagueId/full-season"');
    expect(service).toContain('state: "generated"');
    expect(service).toContain('state: "published"');
    expect(service).toContain('state: "in_progress"');
    expect(service).toContain('state: "finalized"');
  });

  it("persists a stable two-game encounter and Championship Day bracket", () => {
    expect(schema).toContain("export const leagueEncounters");
    expect(schema).toContain("uniquePair: uniqueIndex('le_unique_pair_idx')");
    expect(schema).toContain("export const leaguePlayoffMatches");
    expect(schema).toContain("export const leaguePlayoffGames");
    expect(service).toContain("gameNumber: 1");
    expect(service).toContain("gameNumber: 2");
    expect(service).toContain("startFullSeasonPlayoffs");
  });

  it("routes Full Season reporting through complete encounter scoring", () => {
    expect(routes).toContain("reportFullSeasonGameResult");
    expect(service).toContain("resolveFullSeasonEncounter");
    expect(service).toContain("calculateLeagueRatingDelta");
    expect(service).toContain("recalculateFullSeasonStandings");
  });

  it("renders grouped Match Sets and Full Season standings rather than a generic game list", () => {
    expect(dashboard).toContain("FullSeasonMatchSet");
    expect(dashboard).toContain("FullSeasonStandings");
    expect(dashboard).toContain("/full-season");
  });
});
