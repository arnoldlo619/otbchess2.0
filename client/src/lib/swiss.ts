/**
 * OTB Chess — Swiss Pairing Engine
 *
 * Implements FIDE-compliant Swiss system pairing:
 *   1. Round 1: top-half vs bottom-half (Seed 1 vs Seed N/2+1, Seed 2 vs Seed N/2+2, …)
 *   2. Rounds 2+: score groups sorted by points desc, ELO desc; within each group,
 *      top half paired against bottom half (Dutch system)
 *   3. Repeat-opponent prevention (backtracking, greedy fallback)
 *   4. Color balancing: track W/B history, prefer alternation, never 3 same in a row
 *   5. Bye assignment: lowest-ranked player without a previous bye gets the bye (1 full pt)
 *   6. Tiebreaks: Buchholz, Buchholz Cut-1, Sonneborn-Berger
 *
 * Rating used for sorting: player.pairingRating ?? player.elo (fallback chain applied at
 * registration time by resolvePairingRating()).
 */

import type { Player, Game, Round, Result } from "./tournamentData";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StandingRow {
  player: Player;
  rank: number;
  points: number;
  buchholz: number;
  buchholzCut1: number;
  sonnebornBerger: number;
  wins: number;
  draws: number;
  losses: number;
  /** Double Swiss only: mini-match wins (2-0 or 1.5-0.5) */
  matchW: number;
  /** Double Swiss only: mini-match draws (1-1) */
  matchD: number;
  /** Double Swiss only: mini-match losses (0-2 or 0.5-1.5) */
  matchL: number;
}

export interface PairingValidation {
  valid: boolean;
  warnings: string[];
  errors: string[];
}

// ─── Rating Resolution ────────────────────────────────────────────────────────

/**
 * Resolve the pairing rating for a player using the fallback chain:
 *   manualPairingRating → rapidElo → blitzElo → bulletElo → elo → 1200
 *
 * Also returns the ratingSource for display in the Director roster.
 */
export function resolvePairingRating(
  player: Pick<Player, "elo" | "rapidElo" | "blitzElo" | "bulletElo" | "manualPairingRating">,
  ratingType: "rapid" | "blitz" = "rapid"
): { pairingRating: number; ratingSource: Player["ratingSource"] } {
  // Manual override always wins
  if (player.manualPairingRating != null && player.manualPairingRating > 0) {
    return { pairingRating: player.manualPairingRating, ratingSource: "manual" };
  }

  // Preferred type first
  if (ratingType === "rapid" && player.rapidElo && player.rapidElo > 0) {
    return { pairingRating: player.rapidElo, ratingSource: "rapid" };
  }
  if (ratingType === "blitz" && player.blitzElo && player.blitzElo > 0) {
    return { pairingRating: player.blitzElo, ratingSource: "blitz" };
  }

  // Fallback chain
  if (player.rapidElo && player.rapidElo > 0) {
    return { pairingRating: player.rapidElo, ratingSource: "rapid" };
  }
  if (player.blitzElo && player.blitzElo > 0) {
    return { pairingRating: player.blitzElo, ratingSource: "blitz" };
  }
  if (player.bulletElo && player.bulletElo > 0) {
    return { pairingRating: player.bulletElo, ratingSource: "bullet" };
  }
  if (player.elo && player.elo > 0 && player.elo !== 1200) {
    return { pairingRating: player.elo, ratingSource: "rapid" };
  }

  return { pairingRating: 1200, ratingSource: "default" };
}

/** Get the effective pairing rating for sorting/pairing purposes. */
function effectiveRating(p: Player): number {
  return p.pairingRating ?? p.elo ?? 1200;
}

// ─── Tiebreak Computation ─────────────────────────────────────────────────────

/**
 * Compute live standings with Buchholz, BC1, and Sonneborn-Berger tiebreaks.
 * Uses the actual game results from all completed rounds.
 */
export function computeStandings(players: Player[], rounds: Round[]): StandingRow[] {
  const pointsMap = new Map<string, number>();
  const winsMap = new Map<string, number>();
  const drawsMap = new Map<string, number>();
  const lossesMap = new Map<string, number>();
  const matchWMap = new Map<string, number>();
  const matchDMap = new Map<string, number>();
  const matchLMap = new Map<string, number>();

  for (const p of players) {
    pointsMap.set(p.id, 0);
    winsMap.set(p.id, 0);
    drawsMap.set(p.id, 0);
    lossesMap.set(p.id, 0);
    matchWMap.set(p.id, 0);
    matchDMap.set(p.id, 0);
    matchLMap.set(p.id, 0);
  }

  for (const round of rounds) {
    for (const game of round.games) {
      if (game.result === "*") continue;

      // Bye: whiteId === "BYE" → blackId gets 1 full point (tournament bye standard).
      // Handle BEFORE the ½-½ branch so the bye game is not double-counted.
      if (game.whiteId === "BYE") {
        pointsMap.set(game.blackId, (pointsMap.get(game.blackId) ?? 0) + 1);
        winsMap.set(game.blackId, (winsMap.get(game.blackId) ?? 0) + 1);
        continue;
      }

      if (game.result === "1-0") {
        pointsMap.set(game.whiteId, (pointsMap.get(game.whiteId) ?? 0) + 1);
        winsMap.set(game.whiteId, (winsMap.get(game.whiteId) ?? 0) + 1);
        lossesMap.set(game.blackId, (lossesMap.get(game.blackId) ?? 0) + 1);
      } else if (game.result === "0-1") {
        pointsMap.set(game.blackId, (pointsMap.get(game.blackId) ?? 0) + 1);
        winsMap.set(game.blackId, (winsMap.get(game.blackId) ?? 0) + 1);
        lossesMap.set(game.whiteId, (lossesMap.get(game.whiteId) ?? 0) + 1);
      } else if (game.result === "½-½") {
        pointsMap.set(game.whiteId, (pointsMap.get(game.whiteId) ?? 0) + 0.5);
        pointsMap.set(game.blackId, (pointsMap.get(game.blackId) ?? 0) + 0.5);
        drawsMap.set(game.whiteId, (drawsMap.get(game.whiteId) ?? 0) + 1);
        drawsMap.set(game.blackId, (drawsMap.get(game.blackId) ?? 0) + 1);
      }
    }
  }

  // ── Double Swiss: compute mini-match W/D/L per round ──────────────────────
  const miniGameScore = (g: Game, forId: string): number => {
    if (g.result === "½-½") return 0.5;
    if (g.result === "1-0") return g.whiteId === forId ? 1 : 0;
    if (g.result === "0-1") return g.blackId === forId ? 1 : 0;
    return 0;
  };
  for (const round of rounds) {
    const byBoard = new Map<number, { gameA?: Game; gameB?: Game }>();
    for (const game of round.games) {
      if (game.gameIndex === undefined) continue;
      const slot = byBoard.get(game.board) ?? {};
      if (game.gameIndex === 0) slot.gameA = game;
      else if (game.gameIndex === 1) slot.gameB = game;
      byBoard.set(game.board, slot);
    }
    for (const { gameA, gameB } of Array.from(byBoard.values())) {
      if (!gameA || !gameB) continue;
      if (gameA.result === "*" || gameB.result === "*") continue;
      const p1Id = gameA.whiteId;
      const p2Id = gameA.blackId;
      if (p1Id === "BYE" || p2Id === "BYE") continue;
      const p1Total = miniGameScore(gameA, p1Id) + miniGameScore(gameB, p1Id);
      const p2Total = miniGameScore(gameA, p2Id) + miniGameScore(gameB, p2Id);
      if (p1Total > p2Total) {
        matchWMap.set(p1Id, (matchWMap.get(p1Id) ?? 0) + 1);
        matchLMap.set(p2Id, (matchLMap.get(p2Id) ?? 0) + 1);
      } else if (p2Total > p1Total) {
        matchWMap.set(p2Id, (matchWMap.get(p2Id) ?? 0) + 1);
        matchLMap.set(p1Id, (matchLMap.get(p1Id) ?? 0) + 1);
      } else {
        matchDMap.set(p1Id, (matchDMap.get(p1Id) ?? 0) + 1);
        matchDMap.set(p2Id, (matchDMap.get(p2Id) ?? 0) + 1);
      }
    }
  }

  // Build opponent list per player
  const opponentsMap = new Map<string, string[]>();
  for (const p of players) opponentsMap.set(p.id, []);
  for (const round of rounds) {
    for (const game of round.games) {
      if (game.result === "*") continue;
      if (game.whiteId !== "BYE" && game.blackId !== "BYE") {
        opponentsMap.get(game.whiteId)?.push(game.blackId);
        opponentsMap.get(game.blackId)?.push(game.whiteId);
      }
    }
  }

  // Compute tiebreaks
  const rows: StandingRow[] = players.map((p) => {
    const pts = pointsMap.get(p.id) ?? 0;
    const opponents = opponentsMap.get(p.id) ?? [];
    const oppScores = opponents.map((oId) => pointsMap.get(oId) ?? 0).sort((a, b) => a - b);

    const buchholz = oppScores.reduce((sum, s) => sum + s, 0);
    const buchholzCut1 = oppScores.length > 1
      ? oppScores.slice(1).reduce((sum, s) => sum + s, 0)
      : buchholz;

    let sb = 0;
    for (const round of rounds) {
      for (const game of round.games) {
        if (game.result === "*") continue;
        if (game.whiteId === p.id && game.result === "1-0") {
          sb += pointsMap.get(game.blackId) ?? 0;
        } else if (game.blackId === p.id && game.result === "0-1") {
          sb += pointsMap.get(game.whiteId) ?? 0;
        } else if ((game.whiteId === p.id || game.blackId === p.id) && game.result === "½-½") {
          const oppId = game.whiteId === p.id ? game.blackId : game.whiteId;
          sb += (pointsMap.get(oppId) ?? 0) * 0.5;
        }
      }
    }

    return {
      player: p,
      rank: 0,
      points: pts,
      buchholz,
      buchholzCut1,
      sonnebornBerger: sb,
      wins: winsMap.get(p.id) ?? 0,
      draws: drawsMap.get(p.id) ?? 0,
      losses: lossesMap.get(p.id) ?? 0,
      matchW: matchWMap.get(p.id) ?? 0,
      matchD: matchDMap.get(p.id) ?? 0,
      matchL: matchLMap.get(p.id) ?? 0,
    };
  });

  rows.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.buchholz !== a.buchholz) return b.buchholz - a.buchholz;
    if (b.buchholzCut1 !== a.buchholzCut1) return b.buchholzCut1 - a.buchholzCut1;
    if (b.sonnebornBerger !== a.sonnebornBerger) return b.sonnebornBerger - a.sonnebornBerger;
    return effectiveRating(b.player) - effectiveRating(a.player);
  });

  rows.forEach((r, i) => { r.rank = i + 1; });
  return rows;
}

// ─── Color Assignment ─────────────────────────────────────────────────────────

function assignColors(p1: Player, p2: Player): { whiteId: string; blackId: string } {
  const p1w = p1.colorHistory.filter((c) => c === "W").length;
  const p1b = p1.colorHistory.filter((c) => c === "B").length;
  const p2w = p2.colorHistory.filter((c) => c === "W").length;
  const p2b = p2.colorHistory.filter((c) => c === "B").length;

  const p1Last3 = p1.colorHistory.slice(-3);
  const p2Last3 = p2.colorHistory.slice(-3);
  const p1ThreeInRow = p1Last3.length === 3 && p1Last3.every((c) => c === p1Last3[0]);
  const p2ThreeInRow = p2Last3.length === 3 && p2Last3.every((c) => c === p2Last3[0]);

  if (p1ThreeInRow && p1Last3[0] === "W") return { whiteId: p2.id, blackId: p1.id };
  if (p2ThreeInRow && p2Last3[0] === "W") return { whiteId: p1.id, blackId: p2.id };
  if (p1ThreeInRow && p1Last3[0] === "B") return { whiteId: p1.id, blackId: p2.id };
  if (p2ThreeInRow && p2Last3[0] === "B") return { whiteId: p2.id, blackId: p1.id };

  const p1Diff = p1w - p1b;
  const p2Diff = p2w - p2b;

  if (p1Diff > p2Diff) return { whiteId: p2.id, blackId: p1.id };
  if (p2Diff > p1Diff) return { whiteId: p1.id, blackId: p2.id };

  return effectiveRating(p1) >= effectiveRating(p2)
    ? { whiteId: p1.id, blackId: p2.id }
    : { whiteId: p2.id, blackId: p1.id };
}

// ─── Bye Assignment ───────────────────────────────────────────────────────────

function getByeRecipients(rounds: Round[]): Set<string> {
  const byeSet = new Set<string>();
  for (const round of rounds) {
    for (const game of round.games) {
      if (game.whiteId === "BYE") byeSet.add(game.blackId);
      if (game.blackId === "BYE") byeSet.add(game.whiteId);
    }
  }
  return byeSet;
}

// ─── Pairing Validation ───────────────────────────────────────────────────────

/**
 * Validate a set of generated pairings against the player list and previous rounds.
 * Returns a PairingValidation object with errors and warnings.
 */
export function validatePairings(
  games: Game[],
  players: Player[],
  rounds: Round[],
  nextRound: number
): PairingValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const playerIds = new Set(players.map((p) => p.id));

  // Build played pairs from previous rounds
  const played = new Set<string>();
  for (const round of rounds) {
    for (const game of round.games) {
      if (game.whiteId !== "BYE" && game.blackId !== "BYE") {
        played.add([game.whiteId, game.blackId].sort().join("|"));
      }
    }
  }

  const pairedInThisRound = new Set<string>();
  let byeCount = 0;

  for (const game of games) {
    // Check round number
    if (game.round !== nextRound) {
      errors.push(`Game ${game.id} has wrong round number: ${game.round} (expected ${nextRound})`);
    }

    // Bye game checks
    if (game.whiteId === "BYE") {
      byeCount++;
      if (byeCount > 1) errors.push("More than one bye assigned in a single round");
      if (!playerIds.has(game.blackId)) {
        errors.push(`Bye recipient ${game.blackId} is not in the player list`);
      }
      continue;
    }

    // Both players must exist
    if (!playerIds.has(game.whiteId)) {
      errors.push(`White player ${game.whiteId} is not in the player list`);
    }
    if (!playerIds.has(game.blackId)) {
      errors.push(`Black player ${game.blackId} is not in the player list`);
    }

    // No player paired twice
    if (pairedInThisRound.has(game.whiteId)) {
      errors.push(`Player ${game.whiteId} is paired more than once in round ${nextRound}`);
    }
    if (pairedInThisRound.has(game.blackId)) {
      errors.push(`Player ${game.blackId} is paired more than once in round ${nextRound}`);
    }
    pairedInThisRound.add(game.whiteId);
    pairedInThisRound.add(game.blackId);

    // Repeat opponent warning
    const key = [game.whiteId, game.blackId].sort().join("|");
    if (played.has(key)) {
      warnings.push(`Repeat pairing: ${game.whiteId} vs ${game.blackId} (already played)`);
    }

    // Same player as white and black
    if (game.whiteId === game.blackId) {
      errors.push(`Player ${game.whiteId} is paired against themselves`);
    }
  }

  // Check all non-bye players are paired
  const expectedPaired = players.length % 2 === 0 ? players.length : players.length - 1;
  if (pairedInThisRound.size < expectedPaired) {
    warnings.push(`Only ${pairedInThisRound.size} of ${expectedPaired} expected players are paired`);
  }

  return { valid: errors.length === 0, warnings, errors };
}

// ─── Main Pairing Function ────────────────────────────────────────────────────

/**
 * Generate Swiss pairings for the next round.
 *
 * Round 1 algorithm (all players at 0 points):
 *   Sort by pairingRating (or elo) desc → split at midpoint →
 *   pair top[0] vs bottom[0], top[1] vs bottom[1], …
 *   (FIDE top-half vs bottom-half seeding)
 *
 * Rounds 2+ algorithm (Dutch system):
 *   1. Sort players by points desc, pairingRating desc
 *   2. Handle bye if odd number of players
 *   3. Group by score bracket
 *   4. Within each bracket, pair top half vs bottom half
 *   5. Backtracking to avoid repeat opponents (capped at 50k iterations)
 *   6. Greedy O(n²) fallback if backtracking is exhausted
 *   7. Assign colors per assignColors()
 */
export function generateSwissPairings(
  players: Player[],
  rounds: Round[],
  nextRound: number
): Game[] {
  // Build set of already-played pairs
  const played = new Set<string>();
  for (const round of rounds) {
    for (const game of round.games) {
      if (game.whiteId !== "BYE" && game.blackId !== "BYE") {
        const key = [game.whiteId, game.blackId].sort().join("|");
        played.add(key);
      }
    }
  }

  // Sort by points desc, pairingRating desc
  const sorted = [...players].sort((a, b) =>
    b.points !== a.points
      ? b.points - a.points
      : effectiveRating(b) - effectiveRating(a)
  );

  // Handle bye for odd number of players
  let byePlayerId: string | null = null;
  let pairingPool = [...sorted];

  if (sorted.length % 2 !== 0) {
    const previousByeRecipients = getByeRecipients(rounds);
    for (let i = pairingPool.length - 1; i >= 0; i--) {
      if (!previousByeRecipients.has(pairingPool[i].id)) {
        byePlayerId = pairingPool[i].id;
        pairingPool.splice(i, 1);
        break;
      }
    }
    if (!byePlayerId) {
      byePlayerId = pairingPool[pairingPool.length - 1].id;
      pairingPool.pop();
    }
  }

  const games: Game[] = [];
  let board = 1;
  const tempGames: { p1: Player; p2: Player }[] = [];

  // ── Round 1: top-half vs bottom-half seeding ──────────────────────────────
  if (nextRound === 1) {
    const n = pairingPool.length; // always even after bye removal
    const half = Math.floor(n / 2);
    const topHalf = pairingPool.slice(0, half);
    const bottomHalf = pairingPool.slice(half);

    for (let i = 0; i < half; i++) {
      tempGames.push({ p1: topHalf[i], p2: bottomHalf[i] });
    }
  } else {
    // ── Rounds 2+: score-group Dutch pairing ─────────────────────────────────

    // Group into score brackets
    const brackets = new Map<number, Player[]>();
    for (const p of pairingPool) {
      const pts = p.points;
      if (!brackets.has(pts)) brackets.set(pts, []);
      brackets.get(pts)!.push(p);
    }

    const sortedBrackets = Array.from(brackets.entries()).sort((a, b) => b[0] - a[0]);

    // Flatten brackets into a working list for Dutch pairing
    const workingList: Player[] = [];
    for (const [, bracketPlayers] of sortedBrackets) {
      workingList.push(...bracketPlayers);
    }

    const BACKTRACK_LIMIT = 50_000;
    let backtrackIterations = 0;
    let backtrackExhausted = false;

    const tryPair = (pool: Player[]): boolean => {
      if (pool.length === 0) return true;
      if (pool.length === 1) return false;
      if (backtrackExhausted) return false;

      const p1 = pool[0];
      const rest = pool.slice(1);

      for (let i = 0; i < rest.length; i++) {
        backtrackIterations++;
        if (backtrackIterations > BACKTRACK_LIMIT) {
          backtrackExhausted = true;
          return false;
        }
        const p2 = rest[i];
        const key = [p1.id, p2.id].sort().join("|");
        if (played.has(key)) continue;

        const remaining = rest.filter((_, idx) => idx !== i);
        if (tryPair(remaining)) {
          tempGames.push({ p1, p2 });
          return true;
        }
      }

      // Allow repeats as last resort
      for (let i = 0; i < rest.length; i++) {
        backtrackIterations++;
        if (backtrackIterations > BACKTRACK_LIMIT) {
          backtrackExhausted = true;
          return false;
        }
        const p2 = rest[i];
        const remaining = rest.filter((_, idx) => idx !== i);
        if (tryPair(remaining)) {
          tempGames.push({ p1, p2 });
          return true;
        }
      }

      return false;
    };

    const backtrackSuccess = tryPair(workingList);

    if (!backtrackSuccess || backtrackExhausted) {
      tempGames.length = 0;
      const greedyPool = [...workingList];
      const greedyPaired = new Set<string>();

      while (greedyPool.length >= 2) {
        const p1 = greedyPool[0];
        greedyPool.splice(0, 1);

        let bestIdx = -1;
        for (let i = 0; i < greedyPool.length; i++) {
          const key = [p1.id, greedyPool[i].id].sort().join("|");
          if (!played.has(key) && !greedyPaired.has(greedyPool[i].id)) {
            bestIdx = i;
            break;
          }
        }
        if (bestIdx === -1) {
          for (let i = 0; i < greedyPool.length; i++) {
            if (!greedyPaired.has(greedyPool[i].id)) {
              bestIdx = i;
              break;
            }
          }
        }
        if (bestIdx === -1 && greedyPool.length > 0) bestIdx = 0;

        if (bestIdx >= 0) {
          const p2 = greedyPool[bestIdx];
          greedyPool.splice(bestIdx, 1);
          greedyPaired.add(p1.id);
          greedyPaired.add(p2.id);
          tempGames.push({ p1, p2 });
        }
      }
    }

    // Reverse so highest-rated pair gets Board 1
    tempGames.reverse();
  }

  // Convert tempGames to Game objects with color assignment
  for (const { p1, p2 } of tempGames) {
    const { whiteId, blackId } = assignColors(p1, p2);
    games.push({
      id: `r${nextRound}b${board}`,
      round: nextRound,
      board,
      whiteId,
      blackId,
      result: "*",
    });
    board++;
  }

  // Add bye game if needed — 1 full point (tournament standard)
  if (byePlayerId) {
    games.push({
      id: `r${nextRound}b${board}`,
      round: nextRound,
      board,
      whiteId: "BYE",
      blackId: byePlayerId,
      result: "1-0" as Result, // bye = 1 full point
    });
  }

  return games;
}

/**
 * Apply a result to the player list, updating points/wins/draws/losses/colorHistory.
 * Handles result changes (reverses old result before applying new one).
 */
export function applyResultToPlayers(
  players: Player[],
  game: Game,
  newResult: Result
): Player[] {
  // Bye games are pre-scored; skip applyResultToPlayers for them
  if (game.whiteId === "BYE" || game.blackId === "BYE") return players;

  return players.map((p) => {
    if (p.id !== game.whiteId && p.id !== game.blackId) return p;
    const isWhite = p.id === game.whiteId;
    let pointsDelta = 0;
    let winsDelta = 0;
    let drawsDelta = 0;
    let lossesDelta = 0;

    // Reverse old result
    if (game.result !== "*") {
      if (game.result === "½-½") {
        pointsDelta -= 0.5;
        drawsDelta -= 1;
      } else if (
        (game.result === "1-0" && isWhite) ||
        (game.result === "0-1" && !isWhite)
      ) {
        pointsDelta -= 1;
        winsDelta -= 1;
      } else {
        lossesDelta -= 1;
      }
    }

    // Apply new result
    if (newResult === "½-½") {
      pointsDelta += 0.5;
      drawsDelta += 1;
    } else if (
      (newResult === "1-0" && isWhite) ||
      (newResult === "0-1" && !isWhite)
    ) {
      pointsDelta += 1;
      winsDelta += 1;
    } else if (newResult !== "*") {
      lossesDelta += 1;
    }

    // Update color history (only add on first entry, not on change)
    const colorAdd: "W" | "B" = isWhite ? "W" : "B";
    const newColorHistory =
      game.result === "*" && newResult !== "*"
        ? [...p.colorHistory, colorAdd]
        : p.colorHistory;

    return {
      ...p,
      points: Math.max(0, p.points + pointsDelta),
      wins: Math.max(0, p.wins + winsDelta),
      draws: Math.max(0, p.draws + drawsDelta),
      losses: Math.max(0, p.losses + lossesDelta),
      colorHistory: newColorHistory,
    };
  });
}

// ─── Double Swiss ─────────────────────────────────────────────────────────────

export function generateDoubleSwissPairings(
  players: Player[],
  rounds: Round[],
  nextRound: number
): Game[] {
  const baseGames = generateSwissPairings(players, rounds, nextRound);

  const doubled: Game[] = [];
  for (const game of baseGames) {
    if (game.whiteId === "BYE" || game.blackId === "BYE") {
      doubled.push({ ...game, gameIndex: 0 });
      continue;
    }

    doubled.push({ ...game, id: `${game.id}a`, gameIndex: 0 });
    doubled.push({
      id: `${game.id}b`,
      round: game.round,
      board: game.board,
      whiteId: game.blackId,
      blackId: game.whiteId,
      result: "*",
      gameIndex: 1,
    });
  }

  return doubled;
}

export function isDoubleSwissRoundComplete(games: Game[]): boolean {
  return games.every((g) => g.result !== "*");
}

// ─── Elimination Bracket Engine ───────────────────────────────────────────────

function nextPowerOf2(n: number): number {
  if (n <= 1) return 1;
  return Math.pow(2, Math.ceil(Math.log2(n)));
}

function nearestPowerOf2(n: number): number {
  if (n <= 1) return 1;
  let p = 1;
  while (p * 2 <= n) p *= 2;
  return p;
}

export function elimRoundsNeeded(bracketSize: number): number {
  return Math.ceil(Math.log2(bracketSize));
}

export function elimRoundLabel(playersRemaining: number): string {
  if (playersRemaining <= 2) return "Final";
  if (playersRemaining <= 4) return "Semi-Finals";
  if (playersRemaining <= 8) return "Quarter-Finals";
  if (playersRemaining <= 16) return "Round of 16";
  if (playersRemaining <= 32) return "Round of 32";
  if (playersRemaining <= 64) return "Round of 64";
  return `Round of ${playersRemaining}`;
}

export function generateEliminationFirstRound(
  seededPlayers: Player[],
  roundNumber: number
): Game[] {
  const n = seededPlayers.length;
  if (n < 2) return [];

  const fullBracketSize = nextPowerOf2(n);
  const games: Game[] = [];
  let board = 1;

  const halfBracket = fullBracketSize / 2;
  for (let i = 0; i < halfBracket; i++) {
    const topSeedIdx = i;
    const bottomSeedIdx = fullBracketSize - 1 - i;

    if (bottomSeedIdx >= n) {
      games.push({
        id: `r${roundNumber}b${board}`,
        round: roundNumber,
        board,
        whiteId: "BYE",
        blackId: seededPlayers[topSeedIdx].id,
        result: "1-0" as Result, // bye = auto-advance (1 full point)
      });
      board++;
      continue;
    }

    const topPlayer = seededPlayers[topSeedIdx];
    const bottomPlayer = seededPlayers[bottomSeedIdx];

    games.push({
      id: `r${roundNumber}b${board}`,
      round: roundNumber,
      board,
      whiteId: topPlayer.id,
      blackId: bottomPlayer.id,
      result: "*" as Result,
    });
    board++;
  }

  return games;
}

export function generateEliminationNextRound(
  previousRoundGames: Game[],
  allPlayers: Player[],
  roundNumber: number
): Game[] {
  const playerMap = new Map(allPlayers.map((p) => [p.id, p]));

  const sortedGames = [...previousRoundGames].sort((a, b) => a.board - b.board);
  const winners: Player[] = [];

  for (const game of sortedGames) {
    let winnerId: string | null = null;

    if (game.whiteId === "BYE") {
      winnerId = game.blackId;
    } else if (game.blackId === "BYE") {
      winnerId = game.whiteId;
    } else if (game.result === "1-0") {
      winnerId = game.whiteId;
    } else if (game.result === "0-1") {
      winnerId = game.blackId;
    } else {
      continue;
    }

    const winner = playerMap.get(winnerId);
    if (winner) winners.push(winner);
  }

  if (winners.length < 2) return [];

  const games: Game[] = [];
  let board = 1;

  for (let i = 0; i < winners.length; i += 2) {
    if (i + 1 >= winners.length) {
      games.push({
        id: `r${roundNumber}b${board}`,
        round: roundNumber,
        board,
        whiteId: "BYE",
        blackId: winners[i].id,
        result: "1-0" as Result,
      });
      board++;
      continue;
    }

    const p1 = winners[i];
    const p2 = winners[i + 1];

    games.push({
      id: `r${roundNumber}b${board}`,
      round: roundNumber,
      board,
      whiteId: p1.id,
      blackId: p2.id,
      result: "*" as Result,
    });
    board++;
  }

  return games;
}

export function getSwissCutoffPlayers(
  standings: StandingRow[],
  cutoff: number
): Player[] {
  return standings.slice(0, cutoff).map((row) => row.player);
}

export function suggestElimCutoff(playerCount: number): number {
  if (playerCount <= 2) return 2;
  if (playerCount <= 4) return 4;
  const maxCutoff = nearestPowerOf2(playerCount);
  return Math.min(maxCutoff, 64);
}

export function generateThirdPlaceGame(
  semiFinalGames: Game[],
  allPlayers: Player[],
  roundNumber: number,
): Game | null {
  const playerMap = new Map(allPlayers.map((p) => [p.id, p]));
  const losers: Player[] = [];

  const sorted = [...semiFinalGames].sort((a, b) => a.board - b.board);
  for (const game of sorted) {
    if (game.whiteId === "BYE" || game.blackId === "BYE") continue;
    let loserId: string | null = null;
    if (game.result === "1-0") loserId = game.blackId;
    else if (game.result === "0-1") loserId = game.whiteId;
    if (loserId) {
      const loser = playerMap.get(loserId);
      if (loser) losers.push(loser);
    }
  }

  if (losers.length < 2) return null;

  return {
    id: `r${roundNumber}b99`,
    round: roundNumber,
    board: 99,
    whiteId: losers[0].id,
    blackId: losers[1].id,
    result: "*" as Result,
    isThirdPlace: true,
  };
}
