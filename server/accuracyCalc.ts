/**
 * OTB Chess — OTB Accuracy Rating Calculator
 *
 * Uses the Lichess win-probability formula to compute per-move accuracy
 * and aggregate OTB Accuracy Rating for each player.
 *
 * Formula reference:
 *   win_probability(cp) = 50 + 50 * (2 / (1 + exp(-0.00368208 * cp)) - 1)
 *   move_accuracy = 103.1668 * exp(-0.04354 * (wp_before - wp_after)) - 3.1669
 *   clamped to [0, 100]
 *
 * This matches Lichess's accuracy calculation as described at:
 *   https://lichess.org/page/accuracy
 */

/**
 * Convert centipawn evaluation to win probability (0–100).
 * Positive cp = white advantage.
 * From white's perspective: 50 = equal, 100 = white wins, 0 = black wins.
 */
export function winProbability(cpEval: number): number {
  // Clamp to avoid extreme values
  const cp = Math.max(-2000, Math.min(2000, cpEval));
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
}

/**
 * Compute accuracy for a single move.
 *
 * @param wpBefore - Win probability (0–100) BEFORE the move, from the moving player's perspective
 * @param wpAfter  - Win probability (0–100) AFTER the move, from the moving player's perspective
 * @returns Accuracy score 0–100
 */
export function moveAccuracy(wpBefore: number, wpAfter: number): number {
  const wpLoss = Math.max(0, wpBefore - wpAfter);
  const accuracy = 103.1668 * Math.exp(-0.04354 * wpLoss) - 3.1669;
  return Math.max(0, Math.min(100, accuracy));
}

/**
 * Compute aggregate OTB Accuracy Rating for a sequence of moves.
 *
 * @param cpEvals - Array of centipawn evaluations AFTER each move (from Stockfish)
 *                  Positive = white advantage.
 * @param color   - 'w' or 'b' — which player we're computing accuracy for
 * @returns Accuracy score 0–100, rounded to 1 decimal place
 */
export function computePlayerAccuracy(
  cpEvals: Array<number | null>,
  color: "w" | "b"
): number {
  if (!cpEvals || cpEvals.length === 0) return 0;

  const accuracies: number[] = [];

  for (let i = 0; i < cpEvals.length; i++) {
    const evalBefore = i === 0 ? 0 : (cpEvals[i - 1] ?? 0);
    const evalAfter = cpEvals[i] ?? evalBefore;

    // Win probability from white's perspective
    const wpBeforeWhite = winProbability(evalBefore);
    const wpAfterWhite = winProbability(evalAfter);

    // Convert to moving player's perspective
    let wpBefore: number;
    let wpAfter: number;

    if (color === "w") {
      // White's move: higher white win probability = better
      wpBefore = wpBeforeWhite;
      wpAfter = wpAfterWhite;
    } else {
      // Black's move: lower white win probability = better for black
      wpBefore = 100 - wpBeforeWhite;
      wpAfter = 100 - wpAfterWhite;
    }

    accuracies.push(moveAccuracy(wpBefore, wpAfter));
  }

  if (accuracies.length === 0) return 0;

  const avg = accuracies.reduce((sum, a) => sum + a, 0) / accuracies.length;
  return Math.round(avg * 10) / 10;
}

/**
 * Compute the longest consecutive streak of "best" or "good" moves.
 */
export function computeBestMoveStreak(
  classifications: Array<string | null>
): number {
  let maxStreak = 0;
  let currentStreak = 0;

  for (const cls of classifications) {
    if (cls === "best" || cls === "good") {
      currentStreak++;
      maxStreak = Math.max(maxStreak, currentStreak);
    } else {
      currentStreak = 0;
    }
  }

  return maxStreak;
}

/**
 * Get a descriptive label for an accuracy score.
 */
export function accuracyLabel(accuracy: number): string {
  if (accuracy >= 95) return "Brilliant";
  if (accuracy >= 90) return "Excellent";
  if (accuracy >= 80) return "Good";
  if (accuracy >= 70) return "Decent";
  if (accuracy >= 60) return "Inaccurate";
  if (accuracy >= 50) return "Poor";
  return "Blunder-heavy";
}
