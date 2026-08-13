import { Chess } from "chess.js";
import type { FetchOpts, ParsedGame, PopulationSpeed, RawGame } from "../../shared/prepTypes.js";
import { parseGames } from "../prep/parseGames.js";
import { canonicalPosition, classifyArchiveSpeed, ratingBandForAverage } from "./foundation.js";
import type { PopulationResolutionInput } from "./resolver.js";

interface PositionAccumulator {
  fen: string;
  uciPath: string[];
  opponentColor: "white" | "black";
  opponentDenominator: number;
}

interface MoveAccumulator {
  positionKey: string;
  opponentMoveUci: string;
  opponentMoveSan: string;
  opponentCount: number;
}

function speedForGame(game: ParsedGame): PopulationSpeed | null {
  return game.timeClass === "bullet" || game.timeClass === "blitz" || game.timeClass === "rapid" ? game.timeClass : null;
}

/**
 * Produces at most one qualifying reference candidate. Numerators and
 * denominators are calculated in separate passes over every parsed game, so a
 * late-discovered move never loses early eligible reaches from its denominator.
 */
export function derivePopulationCandidates(raw: RawGame[], username: string, options: FetchOpts): PopulationResolutionInput[] {
  const { parsed } = parseGames(raw, username, options);
  const positions = new Map<string, PositionAccumulator>();
  const moves = new Map<string, MoveAccumulator>();
  const speeds = Array.from(new Set(parsed.map(speedForGame).filter((speed): speed is PopulationSpeed => Boolean(speed))));
  const ratings = parsed.flatMap(game => {
    const rating = game.scoutedColor === "white" ? game.white.rating : game.black.rating;
    return rating === null ? [] : [rating];
  });
  const ratingBand = ratingBandForAverage(ratings.length ? Math.round(ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length) : -1);
  if (!speeds.length || ratingBand === null) return [];

  for (const game of parsed) {
    const chess = new Chess();
    const path: string[] = [];
    const reachedInGame = new Set<string>();
    for (const san of game.sans) {
      const actor = chess.turn() === "w" ? "white" : "black";
      const beforeFen = chess.fen();
      let move;
      try { move = chess.move(san); } catch { break; }
      const uci = `${move.from}${move.to}${move.promotion ?? ""}`;
      if (actor === game.scoutedColor && path.length >= 4) {
        const canonical = canonicalPosition(beforeFen);
        const existing = positions.get(canonical.key) ?? { fen: beforeFen, uciPath: [...path], opponentColor: actor, opponentDenominator: 0 };
        if (!reachedInGame.has(canonical.key)) {
          existing.opponentDenominator++;
          reachedInGame.add(canonical.key);
        }
        positions.set(canonical.key, existing);
        const moveKey = `${canonical.key}:${uci}`;
        const foundMove = moves.get(moveKey) ?? { positionKey: canonical.key, opponentMoveUci: uci, opponentMoveSan: move.san, opponentCount: 0 };
        foundMove.opponentCount++;
        moves.set(moveKey, foundMove);
      }
      path.push(uci);
    }
  }

  const candidates = Array.from(moves.values()).map(move => {
    const position = positions.get(move.positionKey)!;
    return { ...position, ...move };
  }).filter(candidate => candidate.opponentCount >= 6 && candidate.opponentDenominator >= 8)
    .sort((left, right) => right.opponentCount - left.opponentCount || right.opponentDenominator - left.opponentDenominator);
  const best = candidates[0];
  if (!best) return [];
  const windows = parsed.map(game => new Date(game.endTime * 1000).toISOString().slice(0, 7)).sort();
  return [{
    fen: best.fen,
    uciPath: best.uciPath,
    opponentColor: best.opponentColor,
    opponentMoveUci: best.opponentMoveUci,
    opponentMoveSan: best.opponentMoveSan,
    opponentCount: best.opponentCount,
    opponentDenominator: best.opponentDenominator,
    speeds,
    ratingBand,
    since: windows[0],
    until: windows[windows.length - 1],
  }];
}

/** Maps known PGN time controls for archive filtering without silently widening scope. */
export function classifyTimeControlSeconds(seconds: number): PopulationSpeed | null {
  const value = classifyArchiveSpeed(seconds);
  return value === "excluded" ? null : value;
}
