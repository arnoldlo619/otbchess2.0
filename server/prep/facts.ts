// server/prep/facts.ts — group parsed games into fact tables for insight synthesis.
// Ported from reference/src/engine.ts (buildFacts section) — identical behavior.

import type { Color, ParsedGame } from "../../shared/prepTypes.js";
import { simpleOpeningName } from "../../shared/simpleOpeningNames.js";
import { buildPositionTree } from "./positionTree.js";

export interface Group {
  games: ParsedGame[];
  n: number;
  score: number;
}

export interface Facts {
  byColor: Record<Color, ParsedGame[]>;
  fam: Record<Color, Map<string, ParsedGame[]>>;
  responses: Record<string, Map<string, ParsedGame[]>>;
  firstMoves: Map<string, ParsedGame[]>;
}

export const grp = (gs: ParsedGame[]): Group => ({
  games: gs,
  n: gs.length,
  score: gs.reduce((s, g) => s + g.scoutedScore, 0),
});

export const familyOf = (game: ParsedGame): string =>
  simpleOpeningName(game.opening.name, game.opening.eco, game.plies[0]?.san);

export const sample = (
  gs: ParsedGame[],
  k = 4
): { url: string; date: string; result: "W" | "D" | "L" }[] =>
  gs.slice(0, k).map(g => ({
    url: g.url,
    date: new Date(g.endTime * 1000).toISOString().slice(0, 10),
    result: (g.scoutedScore === 1 ? "W" : g.scoutedScore === 0.5 ? "D" : "L") as "W" | "D" | "L",
  }));

export function buildFacts(parsed: ParsedGame[]): Facts {
  const byColor: Record<Color, ParsedGame[]> = { white: [], black: [] };
  for (const g of parsed) byColor[g.scoutedColor].push(g);

  // Opening families per color (min bookExitPly 2 so "Unclassified"/1-ply junk aggregates)
  const fam: Record<Color, Map<string, ParsedGame[]>> = {
    white: new Map(),
    black: new Map(),
  };
  for (const c of ["white", "black"] as Color[]) {
    for (const g of byColor[c]) {
      const key =
        g.opening.bookExitPly >= 2
          ? familyOf(g)
          : "Other / irregular";
      const existing = fam[c].get(key);
      if (existing) existing.push(g);
      else fam[c].set(key, [g]);
    }
  }

  // Response tables: scouted player's FIRST OWN CHOICE after 1.e4/1.d4/1.c4/1.Nf3
  // (role=plays by construction — these are their Black responses)
  const responses: Record<string, Map<string, ParsedGame[]>> = {};
  for (const first of ["e4", "d4", "c4", "Nf3"]) responses[first] = new Map();
  for (const g of byColor.black) {
    const w1 = g.plies[0]?.san;
    const b1 = g.plies[1]?.san;
    if (w1 && b1 && responses[w1]) {
      const existing = responses[w1].get(b1);
      if (existing) existing.push(g);
      else responses[w1].set(b1, [g]);
    }
  }

  // First-move distribution as White (role=plays by construction)
  const firstMoves = new Map<string, ParsedGame[]>();
  for (const g of byColor.white) {
    const m = g.plies[0]?.san;
    if (!m) continue;
    const existing = firstMoves.get(m);
    if (existing) existing.push(g);
    else firstMoves.set(m, [g]);
  }

  return { byColor, fam, responses, firstMoves };
}

/** Forecast tree: move branches from scouted player's perspective, depth 6 */
export function forecast(
  games: ParsedGame[],
  color: Color,
  maxDepth = 6
): import("../../shared/prepTypes.js").ForecastBranch[] {
  return buildPositionTree(games, color, maxDepth);
}
