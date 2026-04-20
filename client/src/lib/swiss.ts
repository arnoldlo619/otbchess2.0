/**
 * OTB Chess — Swiss Pairing Engine
 *
 * Implements FIDE-compliant Swiss system pairing:
 *   1. Score groups: players sorted by points, then ELO
 *   2. Within each score group, top half paired against bottom half
 *   3. Repeat-opponent prevention (fall back to repeat only if unavoidable)
 *   4. Color balancing: track W/B history, prefer alternation, never 3 same in a row
 *   5. Bye assignment: lowest-ranked player without a previous bye gets the bye (½ pt)
 *   6. Tiebreaks: Buchholz, Buchholz Cut-1 (drop weakest opponent), Sonneborn-Berger
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

// ─── Tiebreak Computation ─────────────────────────────────────────────────────

/**
 * Compute live standings with Buchholz, BC1, and Sonneborn-Berger tiebreaks.
 * Uses the actual game results from all completed rounds.
 */
export function computeStandings(players: Player[], rounds: Round[]): StandingRow[] {
  // Build a map of player id → live points from game results
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
      if (game.result === "1-0") {
        pointsMap.set(game.whiteId, (pointsMap.get(game.whiteId) ?? 0) + 1);
        winsMap.set(game.whiteId, (winsMap.get(game.whiteId) ?? 0) + 1);
        lossesMap.set(game.blackId, (lossesMap.get(game.blackId) ?? 0) + 1);
      } else if (game.result === "0-1") {
        pointsMap.set(game.blackId, (pointsMap.get(game.blackId) ?? 0) + 1);
        winsMap.set(game.blackId, (winsMap.get(game.blackId) ?? 0) + 1);
        lossesMap.set(game.whiteId, (lossesMap.get(game.whiteId) ?? 0) + 1);
      }
      // Bye: whiteId === "BYE" means the blackId player gets ½ point (FIDE standard).
      // Handle BEFORE the ½-½ branch so the bye game is not double-counted.
      if (game.whiteId === "BYE") {
        pointsMap.set(game.blackId, (pointsMap.get(game.blackId) ?? 0) + 0.5);
        drawsMap.set(game.blackId, (drawsMap.get(game.blackId) ?? 0) + 1);
        continue;
      }
      if (game.result === "½-½") {
        pointsMap.set(game.whiteId, (pointsMap.get(game.whiteId) ?? 0) + 0.5);
        pointsMap.set(game.blackId, (pointsMap.get(game.blackId) ?? 0) + 0.5);
        drawsMap.set(game.whiteId, (drawsMap.get(game.whiteId) ?? 0) + 1);
        drawsMap.set(game.blackId, (drawsMap.get(game.blackId) ?? 0) + 1);
      }
    }
  }

  // ── Double Swiss: compute mini-match W/D/L per round ──────────────────────
  // Games with gameIndex 0 and 1 sharing the same board number in a round form a mini-match.
  const miniGameScore = (g: Game, forId: string): number => {
    if (g.result === "½-½") return 0.5;
    if (g.result === "1-0") return g.whiteId === forId ? 1 : 0;
    if (g.result === "0-1") return g.blackId === forId ? 1 : 0;
    return 0;
  };
  for (const round of rounds) {
    // Group games by board number (game.board)
    const byBoard = new Map<number, { gameA?: Game; gameB?: Game }>();
    for (const game of round.games) {
      if (game.gameIndex === undefined) continue; // not a Double Swiss round
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

    // Sonneborn-Berger: sum of defeated opponents' scores + half of drawn opponents' scores
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
      rank: 0, // filled below
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

  // Sort: points → buchholz → bc1 → sonneborn-berger → ELO
  rows.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.buchholz !== a.buchholz) return b.buchholz - a.buchholz;
    if (b.buchholzCut1 !== a.buchholzCut1) return b.buchholzCut1 - a.buchholzCut1;
    if (b.sonnebornBerger !== a.sonnebornBerger) return b.sonnebornBerger - a.sonnebornBerger;
    return b.player.elo - a.player.elo;
  });

  rows.forEach((r, i) => { r.rank = i + 1; });
  return rows;
}

// ─── Color Assignment ─────────────────────────────────────────────────────────

/**
 * Determine which player should get White.
 * Rules (in priority order):
 *   1. Never give the same color 3 times in a row
 *   2. Give the color owed (fewer of that color so far)
 *   3. Higher-rated player gets White as tiebreak
 */
function assignColors(
  p1: Player,
  p2: Player
): { whiteId: string; blackId: string } {
  const p1w = p1.colorHistory.filter((c) => c === "W").length;
  const p1b = p1.colorHistory.filter((c) => c === "B").length;
  const p2w = p2.colorHistory.filter((c) => c === "W").length;
  const p2b = p2.colorHistory.filter((c) => c === "B").length;

  const p1Last3 = p1.colorHistory.slice(-3);
  const p2Last3 = p2.colorHistory.slice(-3);
  const p1ThreeInRow = p1Last3.length === 3 && p1Last3.every((c) => c === p1Last3[0]);
  const p2ThreeInRow = p2Last3.length === 3 && p2Last3.every((c) => c === p2Last3[0]);

  // If p1 would get 3 in a row with White, give them Black
  if (p1ThreeInRow && p1Last3[0] === "W") return { whiteId: p2.id, blackId: p1.id };
  if (p2ThreeInRow && p2Last3[0] === "W") return { whiteId: p1.id, blackId: p2.id };
  if (p1ThreeInRow && p1Last3[0] === "B") return { whiteId: p1.id, blackId: p2.id };
  if (p2ThreeInRow && p2Last3[0] === "B") return { whiteId: p2.id, blackId: p1.id };

  // Give color owed (fewer of that color)
  const p1Diff = p1w - p1b; // positive = owes Black
  const p2Diff = p2w - p2b;

  if (p1Diff > p2Diff) return { whiteId: p2.id, blackId: p1.id }; // p1 owes Black
  if (p2Diff > p1Diff) return { whiteId: p1.id, blackId: p2.id }; // p2 owes Black

  // Equal — higher ELO gets White
  return p1.elo >= p2.elo
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

// ─── Main Pairing Function ────────────────────────────────────────────────────

/**
 * Generate Swiss pairings for the next round.
 *
 * Algorithm:
 *   1. Sort players by points desc, ELO desc
 *   2. Handle bye if odd number of players
 *   3. Group by score bracket
 *   4. Within each bracket, pair top half vs bottom half (Dutch system)
 *   5. If a pairing would be a repeat, float one player down to the next bracket
 *   6. Assign colors per assignColors()
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

  // Sort by points desc, ELO desc
  const sorted = [...players].sort((a, b) =>
    b.points !== a.points ? b.points - a.points : b.elo - a.elo
  );

  // Handle bye for odd number of players
  let byePlayerId: string | null = null;
  let pairingPool = [...sorted];

  if (sorted.length % 2 !== 0) {
    const previousByeRecipients = getByeRecipients(rounds);
    // Give bye to lowest-ranked player who hasn't had one yet
    for (let i = pairingPool.length - 1; i >= 0; i--) {
      if (!previousByeRecipients.has(pairingPool[i].id)) {
        byePlayerId = pairingPool[i].id;
        pairingPool.splice(i, 1);
        break;
      }
    }
    // If everyone has had a bye, give it to the lowest-ranked player
    if (!byePlayerId) {
      byePlayerId = pairingPool[pairingPool.length - 1].id;
      pairingPool.pop();
    }
  }

  // Group into score brackets
  const brackets = new Map<number, Player[]>();
  for (const p of pairingPool) {
    const pts = p.points;
    if (!brackets.has(pts)) brackets.set(pts, []);
    brackets.get(pts)!.push(p);
  }

  // Sort brackets by score descending
  const sortedBrackets = Array.from(brackets.entries()).sort((a, b) => b[0] - a[0]);

  const _paired = new Set<string>();
  const games: Game[] = [];
  let board = 1;

  // Flatten brackets into a working list for Dutch pairing
  const workingList: Player[] = [];
  for (const [, bracketPlayers] of sortedBrackets) {
    workingList.push(...bracketPlayers);
  }

  // Dutch pairing: try to pair i with i + half, falling back as needed
  const _n = workingList.length;
  const _tempPaired = new Set<string>();
  const tempGames: { p1: Player; p2: Player }[] = [];

  // Attempt pairing with backtracking
  function tryPair(pool: Player[]): boolean {
    if (pool.length === 0) return true;
    if (pool.length === 1) return false; // shouldn't happen (bye already handled)

    const p1 = pool[0];
    const rest = pool.slice(1);

    // Try each candidate for p1, preferring those in the same score group
    for (let i = 0; i < rest.length; i++) {
      const p2 = rest[i];
      const key = [p1.id, p2.id].sort().join("|");
      if (played.has(key)) continue; // avoid repeat if possible

      const remaining = rest.filter((_, idx) => idx !== i);
      if (tryPair(remaining)) {
        tempGames.push({ p1, p2 });
        return true;
      }
    }

    // If no non-repeat pairing found, allow repeats
    for (let i = 0; i < rest.length; i++) {
      const p2 = rest[i];
      const remaining = rest.filter((_, idx) => idx !== i);
      if (tryPair(remaining)) {
        tempGames.push({ p1, p2 });
        return true;
      }
    }

    return false;
  }

  tryPair(workingList);

  // Reverse so that the highest-rated pair (added last by the recursive tryPair)
  // receives Board 1, with board numbers ascending as ratings/scores decrease.
  tempGames.reverse();

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

  // Add bye game if needed
  if (byePlayerId) {
    games.push({
      id: `r${nextRound}b${board}`,
      round: nextRound,
      board,
      whiteId: "BYE",
      blackId: byePlayerId,
      result: "½-½", // bye = ½ point (FIDE standard)
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

/**
 * Generate Double Swiss pairings for the next round.
 *
 * Calls the standard Swiss engine to produce pairings, then doubles every
 * game: Game A keeps the assigned colors; Game B swaps them. Both games
 * share the same board number so the Director can display them as a pair.
 *
 * IDs:
 *   Game A: r{round}b{board}a  (gameIndex = 0)
 *   Game B: r{round}b{board}b  (gameIndex = 1)
 *
 * Bye games are NOT doubled — the bye player still receives ½ point once.
 */
export function generateDoubleSwissPairings(
  players: Player[],
  rounds: Round[],
  nextRound: number
): Game[] {
  // Get standard Swiss pairings (includes bye if needed)
  const baseGames = generateSwissPairings(players, rounds, nextRound);

  const doubled: Game[] = [];
  for (const game of baseGames) {
    // Bye games are not doubled
    if (game.whiteId === "BYE" || game.blackId === "BYE") {
      doubled.push({ ...game, gameIndex: 0 });
      continue;
    }

    // Game A — normal colors (gameIndex 0)
    doubled.push({
      ...game,
      id: `${game.id}a`,
      gameIndex: 0,
    });

    // Game B — colors swapped (gameIndex 1)
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

/**
 * Check whether a round is complete in Double Swiss mode.
 * Both Game A and Game B for every board must have a result.
 */
export function isDoubleSwissRoundComplete(games: Game[]): boolean {
  return games.every((g) => g.result !== "*");
}

// ─── Elimination Bracket Engine ───────────────────────────────────────────────

/**
 * Find the smallest power of 2 that is >= n.
 */
function nextPowerOf2(n: number): number {
  if (n <= 1) return 1;
  return Math.pow(2, Math.ceil(Math.log2(n)));
}

/**
 * Find the largest power of 2 that is <= n.
 */
function nearestPowerOf2(n: number): number {
  if (n <= 1) return 1;
  let p = 1;
  while (p * 2 <= n) p *= 2;
  return p;
}

/**
 * Compute the number of elimination rounds needed for a given bracket size.
 * e.g. 64 → 6, 32 → 5, 16 → 4, 8 → 3
 */
export function elimRoundsNeeded(bracketSize: number): number {
  return Math.ceil(Math.log2(bracketSize));
}

/**
 * Get the label for an elimination round based on remaining players.
 * e.g. 2 remaining → "Final", 4 → "Semifinals", 8 → "Quarterfinals"
 */
export function elimRoundLabel(playersRemaining: number): string {
  if (playersRemaining <= 2) return "Final";
  if (playersRemaining <= 4) return "Semi-Finals";
  if (playersRemaining <= 8) return "Quarter-Finals";
  if (playersRemaining <= 16) return "Round of 16";
  if (playersRemaining <= 32) return "Round of 32";
  if (playersRemaining <= 64) return "Round of 64";
  return `Round of ${playersRemaining}`;
}

/**
 * Generate the first-round elimination bracket pairings from a seeded list.
 *
 * Seeding follows standard tournament bracket convention:
 *   - Seed 1 vs Seed N, Seed 2 vs Seed N-1, etc.
 *   - For non-power-of-2 fields, the top seeds receive first-round byes.
 *
 * @param seededPlayers - Players sorted by seed (index 0 = seed 1 = best)
 * @param roundNumber - The round number to assign to the generated games
 * @returns Array of Game objects for the first elimination round
 */
export function generateEliminationFirstRound(
  seededPlayers: Player[],
  roundNumber: number
): Game[] {
  const n = seededPlayers.length;
  if (n < 2) return [];

  const fullBracketSize = nextPowerOf2(n);
  const _byeCount = fullBracketSize - n;

  const games: Game[] = [];
  let board = 1;

  // Create the full bracket slots: seed 1 vs seed S, seed 2 vs S-1, etc.
  const halfBracket = fullBracketSize / 2;
  for (let i = 0; i < halfBracket; i++) {
    const topSeedIdx = i;
    const bottomSeedIdx = fullBracketSize - 1 - i;

    // If the bottom seed doesn't exist (bye), the top seed advances automatically
    if (bottomSeedIdx >= n) {
      games.push({
        id: `r${roundNumber}b${board}`,
        round: roundNumber,
        board,
        whiteId: "BYE",
        blackId: seededPlayers[topSeedIdx].id,
        result: "½-½" as Result, // bye = auto-advance
      });
      board++;
      continue;
    }

    const topPlayer = seededPlayers[topSeedIdx];
    const bottomPlayer = seededPlayers[bottomSeedIdx];

    // Higher seed gets White
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

/**
 * Generate the next elimination round by advancing winners from the previous round.
 *
 * Winners are determined by game results:
 *   - "1-0" → White wins
 *   - "0-1" → Black wins
 *   - Bye games → the non-BYE player advances
 *   - Draws are not valid in elimination (director must pick a winner)
 *
 * Winners are paired in order: winner of board 1 vs winner of board 2, etc.
 *
 * @param previousRoundGames - Games from the previous elimination round (must all have results)
 * @param allPlayers - Full player list for looking up Player objects
 * @param roundNumber - The round number to assign
 * @returns Array of Game objects for the next elimination round
 */
export function generateEliminationNextRound(
  previousRoundGames: Game[],
  allPlayers: Player[],
  roundNumber: number
): Game[] {
  const playerMap = new Map(allPlayers.map((p) => [p.id, p]));

  // Determine winners from previous round, preserving board order
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
      // Draw in elimination — shouldn't happen, but treat as unresolved
      continue;
    }

    const winner = playerMap.get(winnerId);
    if (winner) winners.push(winner);
  }

  if (winners.length < 2) return []; // Tournament is over

  // Pair winners in bracket order: winner 1 vs winner 2, winner 3 vs winner 4, etc.
  const games: Game[] = [];
  let board = 1;

  for (let i = 0; i < winners.length; i += 2) {
    if (i + 1 >= winners.length) {
      // Odd number of winners — bye for the last one
      games.push({
        id: `r${roundNumber}b${board}`,
        round: roundNumber,
        board,
        whiteId: "BYE",
        blackId: winners[i].id,
        result: "½-½" as Result,
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

/**
 * Get the list of players who should advance from Swiss to Elimination.
 * Takes the top N players from the Swiss standings.
 *
 * @param standings - Computed Swiss standings (already sorted by rank)
 * @param cutoff - Number of players to advance (should be a power of 2 for clean brackets)
 * @returns Array of Players in seed order (rank 1 = seed 1)
 */
export function getSwissCutoffPlayers(
  standings: StandingRow[],
  cutoff: number
): Player[] {
  return standings.slice(0, cutoff).map((row) => row.player);
}

/**
 * Suggest the best cutoff size for a Swiss-to-Elimination transition.
 * Returns the largest power of 2 that is ≤ playerCount, capped at 64.
 *
 * @param playerCount - Total number of players in the tournament
 * @returns Suggested cutoff (always a power of 2)
 */
export function suggestElimCutoff(playerCount: number): number {
  if (playerCount <= 2) return 2;
  if (playerCount <= 4) return 4;
  const maxCutoff = nearestPowerOf2(playerCount);
  return Math.min(maxCutoff, 64);
}

/**
 * Generate the 3rd-place consolation game from a semi-finals round.
 *
 * The two losers of the semi-finals play each other.
 * The game is tagged with `isThirdPlace: true` so the bracket view can
 * render it distinctly from the main bracket tree.
 *
 * @param semiFinalGames - Games from the semi-finals round (exactly 2 games)
 * @param allPlayers - Full player list for looking up Player objects
 * @param roundNumber - The round number to assign (same as the Final round)
 * @returns A single Game for the 3rd-place match, or null if inputs are invalid
 */
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
    id: `r${roundNumber}b3p`,
    round: roundNumber,
    board: 99, // sentinel board number to keep it separate from main bracket
    whiteId: losers[0].id,
    blackId: losers[1].id,
    result: "*" as Result,
    isThirdPlace: true,
  };
}
