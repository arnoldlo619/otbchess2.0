/**
 * recommendedRounds.ts
 *
 * Utility for computing the optimal number of Swiss rounds based on player count.
 *
 * Swiss tournament theory: the minimum rounds needed to produce a clear winner is
 * ceil(log2(n)) where n is the number of players. In practice, tournament directors
 * often add 1–2 extra rounds to improve standings accuracy. The FIDE guideline for
 * Swiss events is typically ceil(log2(n)) + 1 for competitive play.
 *
 * This module exposes:
 *   - recommendedRounds(playerCount): number  — the recommended round count
 *   - roundsHint(playerCount, selectedRounds): string  — a human-readable hint
 */

/**
 * Returns the recommended number of rounds for a Swiss tournament with the
 * given player count. Uses ceil(log2(n)) as the theoretical minimum, clamped
 * to a sensible range of 3–11.
 */
export function recommendedRounds(playerCount: number): number {
  if (playerCount < 2) return 3;
  const theoretical = Math.ceil(Math.log2(playerCount));
  return Math.max(3, Math.min(11, theoretical));
}

/**
 * Returns a short human-readable hint string describing whether the selected
 * round count is optimal, too few, or more than needed for the given player count.
 *
 * @param playerCount   - number of players registered or expected
 * @param selectedRounds - the currently chosen round count
 */
export function roundsHint(playerCount: number, selectedRounds: number): string {
  if (playerCount < 2) {
    return `${selectedRounds} rounds selected`;
  }

  const optimal = recommendedRounds(playerCount);
  const maxClear = Math.pow(2, selectedRounds - 1); // players that can be uniquely ranked

  if (selectedRounds === optimal) {
    return `Optimal for ${playerCount} players — guarantees a clear winner`;
  }

  if (selectedRounds < optimal) {
    const deficit = optimal - selectedRounds;
    return `${deficit} fewer than recommended for ${playerCount} players — may produce tied standings`;
  }

  // selectedRounds > optimal
  return `More than needed — ranks up to ${maxClear} players clearly`;
}

/**
 * Returns a short label like "Recommended for 8–16 players" for a given round count,
 * useful as a subtitle inside a round picker tile.
 */
export function roundRangeLabel(rounds: number): string {
  // The round count r is optimal for player counts in the range (2^(r-2), 2^(r-1)]
  // e.g. r=5 is optimal for 9–16 players (ceil(log2(9..16)) == 4 or 5)
  const lo = Math.pow(2, rounds - 2) + 1; // exclusive lower bound
  const hi = Math.pow(2, rounds - 1);     // inclusive upper bound
  if (rounds <= 3) return "Up to 4 players";
  return `Best for ${lo}–${hi} players`;
}
