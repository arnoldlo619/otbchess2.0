// server/prep/facts.ts — group parsed games into fact tables for insight synthesis.
// Ported from reference/src/engine.ts (buildFacts section) — identical behavior.

import type { Color, ParsedGame } from "../../shared/prepTypes.js";

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

export const familyOf = (name: string): string => name.split(":")[0].trim();

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
          ? familyOf(g.opening.name)
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
  const build = (
    gs: ParsedGame[],
    ply: number,
    depth: number
  ): import("../../shared/prepTypes.js").ForecastBranch[] => {
    if (depth >= maxDepth || gs.length < 3) return [];
    const buckets = new Map<string, ParsedGame[]>();
    for (const g of gs) {
      const s = g.plies[ply]?.san;
      if (s) {
        const existing = buckets.get(s);
        if (existing) existing.push(g);
        else buckets.set(s, [g]);
      }
    }
    return Array.from(buckets.entries())
      .filter(([, v]) => v.length >= 2)
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 3)
      .map(([san, v]) => {
        // Black-side root moves begin at ply 1, so moveSan alone is not a legal
        // board path. Preserve one canonical game prefix for UI hover previews.
        const previewPath = v[0]?.plies
          .slice(0, ply + 1)
          .map((move) => move.san) ?? [];
        // Find the most common opening name in this bucket for the label
        const nameCounts = new Map<string, number>();
        for (const g of v) {
          if (g.opening.bookExitPly >= 2) {
            const n = g.opening.name.split(":")[0].trim();
            nameCounts.set(n, (nameCounts.get(n) ?? 0) + 1);
          }
        }
        let label: string | undefined;
        let maxCount = 0;
        for (const [n, c] of Array.from(nameCounts.entries())) {
          if (c > maxCount) { label = n; maxCount = c; }
        }
        const wins = v.filter((g: ParsedGame) => g.scoutedScore === 1).length;
        const draws = v.filter((g: ParsedGame) => g.scoutedScore === 0.5).length;
        const losses = v.filter((g: ParsedGame) => g.scoutedScore === 0).length;
        return {
          moveSan: san,
          previewPath,
          count: v.length,
          pct: v.length / gs.length,
          score: v.reduce((s: number, g: ParsedGame) => s + g.scoutedScore, 0) / v.length,
          wins,
          draws,
          losses,
          label: maxCount >= 2 ? label : undefined,
          children: build(v, ply + 1, depth + 1),
        };
      });
  };
  // Start at ply 0 for White (their moves), ply 1 for Black (their moves)
  return build(games, color === "white" ? 0 : 1, 0);
}
