import { Chess } from "chess.js";
import type { Color, ForecastBranch, ParsedGame } from "../../shared/prepTypes.js";
import { conditionalEvidenceFrequency } from "./evidencePolicy.js";

const gameSourceId = (game: ParsedGame): string => `${game.provider}:${game.url}`;

function openingLabelAtPosition(games: ParsedGame[], reachedPly: number): string | undefined {
  if (reachedPly < 2) return undefined;
  const counts = new Map<string, number>();
  for (const game of games) {
    if (game.opening.bookExitPly <= reachedPly && game.opening.bookExitPly >= 2 && game.opening.name !== "Unclassified") {
      const family = game.opening.name.split(":")[0].trim();
      counts.set(family, (counts.get(family) ?? 0) + 1);
    }
  }
  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[1] && sorted[0][1] >= 2 ? sorted[0][0] : undefined;
}

function legalMoveDetails(path: string[], san: string) {
  const chess = new Chess();
  for (const move of path) chess.move(move);
  const sideToMove: Color = chess.turn() === "w" ? "white" : "black";
  const move = chess.move(san);
  return {
    moveUci: move.from + move.to + (move.promotion ?? ""),
    resultingFen: chess.fen(),
    sideToMove,
  };
}

/**
 * Builds a legal tree from the initial position. Every level advances exactly
 * one ply, and each denominator contains only games that reached its parent.
 */
export function buildPositionTree(
  games: ParsedGame[],
  opponentColor: Color,
  maxDepth = 8,
): ForecastBranch[] {
  const eligible = games.filter(game => game.scoutedColor === opponentColor);

  const build = (reachingParent: ParsedGame[], path: string[], ply: number): ForecastBranch[] => {
    if (ply >= maxDepth || reachingParent.length < 2) return [];
    const buckets = new Map<string, ParsedGame[]>();
    for (const game of reachingParent) {
      const san = game.plies[ply]?.san;
      if (!san) continue;
      const existing = buckets.get(san);
      if (existing) existing.push(game);
      else buckets.set(san, [game]);
    }

    return Array.from(buckets.entries())
      .filter(([, branchGames]) => branchGames.length >= 2)
      .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
      .slice(0, 4)
      .flatMap(([moveSan, branchGames]) => {
        try {
          const move = legalMoveDetails(path, moveSan);
          const nextPath = [...path, moveSan];
          const actor: "user" | "opponent" = move.sideToMove === opponentColor ? "opponent" : "user";
          const wins = branchGames.filter(game => game.scoutedScore === 1).length;
          const draws = branchGames.filter(game => game.scoutedScore === 0.5).length;
          const losses = branchGames.filter(game => game.scoutedScore === 0).length;
          const frequency = conditionalEvidenceFrequency(branchGames.length, reachingParent.length);
          return [{
            moveSan,
            moveUci: move.moveUci,
            previewPath: nextPath,
            resultingFen: move.resultingFen,
            actor,
            moveNumber: Math.floor(ply / 2) + 1,
            sideToMove: move.sideToMove,
            parentGames: frequency.parentCount,
            sourceGameIds: branchGames.map(gameSourceId),
            count: frequency.count,
            pct: frequency.ratio,
            score: branchGames.reduce((sum, game) => sum + game.scoutedScore, 0) / branchGames.length,
            wins,
            draws,
            losses,
            label: openingLabelAtPosition(branchGames, ply + 1),
            children: build(branchGames, nextPath, ply + 1),
          } satisfies ForecastBranch];
        } catch {
          return [];
        }
      });
  };

  return build(eligible, [], 0);
}
