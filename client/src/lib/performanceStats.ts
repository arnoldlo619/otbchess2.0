/**
 * OTB Chess — Post-Tournament Performance Stats Engine
 *
 * Computes rich per-player statistics from a completed DirectorState:
 *   - Final rank, score, W/D/L record
 *   - Performance rating (FIDE formula: avg opponent ELO ± dp table)
 *   - Biggest upset (beat highest-rated opponent relative to own ELO)
 *   - Best win (highest-rated opponent beaten)
 *   - Longest winning streak
 *   - Color balance (W/B games played)
 *   - Buchholz tiebreak
 *   - Achievement badge (headline for the stats card)
 *
 * All functions are pure — no side effects, no localStorage access.
 */
import type { Player, Game, Round } from "./tournamentData";
import { computeStandings } from "./swiss";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RoundHistoryEntry {
  roundNumber: number;
  opponent: Player;
  color: "W" | "B";
  result: "win" | "draw" | "loss";
  gameResult: string; // "1-0" | "0-1" | "½-½"
  pointsEarned: number; // 1, 0.5, or 0
  runningScore: number; // cumulative score after this round
}

export interface PlayerPerformance {
  player: Player;
  rank: number;
  totalPlayers: number;
  points: number;
  wins: number;
  draws: number;
  losses: number;
  performanceRating: number;
  ratingChange: number; // performanceRating - player.elo
  bestWin: { opponent: Player; eloGap: number } | null;
  biggestUpset: { opponent: Player; eloGap: number } | null;
  longestStreak: number; // consecutive wins
  whiteGames: number;
  blackGames: number;
  buchholz: number;
  badge: AchievementBadge;
  badgeLabel: string;
  roundHistory: RoundHistoryEntry[];
}

export type AchievementBadge =
  | "champion"
  | "runner_up"
  | "third_place"
  | "perfect_score"
  | "giant_killer"
  | "iron_wall"  // most draws
  | "comeback"   // won last round after losing first
  | "consistent" // all results within ½pt of each other
  | "participant";

// ─── FIDE Performance Rating dp table ─────────────────────────────────────────
// Maps score percentage (0..100) → dp (rating difference)
const DP_TABLE: [number, number][] = [
  [100, 800], [99, 677], [98, 589], [97, 538], [96, 501],
  [95, 470],  [94, 444], [93, 422], [92, 401], [91, 383],
  [90, 366],  [89, 351], [88, 336], [87, 322], [86, 309],
  [85, 296],  [84, 284], [83, 273], [82, 262], [81, 251],
  [80, 240],  [79, 230], [78, 220], [77, 211], [76, 202],
  [75, 193],  [74, 184], [73, 175], [72, 166], [71, 158],
  [70, 149],  [69, 141], [68, 133], [67, 125], [66, 117],
  [65, 110],  [64, 102], [63, 95],  [62, 87],  [61, 80],
  [60, 73],   [59, 65],  [58, 58],  [57, 51],  [56, 43],
  [55, 36],   [54, 29],  [53, 21],  [52, 14],  [51, 7],
  [50, 0],    [49, -7],  [48, -14], [47, -21], [46, -29],
  [45, -36],  [44, -43], [43, -51], [42, -58], [41, -65],
  [40, -73],  [39, -80], [38, -87], [37, -95], [36, -102],
  [35, -110], [34, -117],[33, -125],[32, -133],[31, -141],
  [30, -149], [29, -158],[28, -166],[27, -175],[26, -184],
  [25, -193], [24, -202],[23, -211],[22, -220],[21, -230],
  [20, -240], [19, -251],[18, -262],[17, -273],[16, -284],
  [15, -296], [14, -309],[13, -322],[12, -336],[11, -351],
  [10, -366], [9, -383], [8, -401], [7, -422], [6, -444],
  [5, -470],  [4, -501], [3, -538], [2, -589], [1, -677],
  [0, -800],
];

function dpFromPercentage(pct: number): number {
  const clamped = Math.max(0, Math.min(100, Math.round(pct)));
  const entry = DP_TABLE.find(([p]) => p === clamped);
  return entry ? entry[1] : 0;
}

function computePerformanceRating(
  playerPoints: number,
  gamesPlayed: number,
  opponentElos: number[]
): number {
  if (gamesPlayed === 0 || opponentElos.length === 0) return 0;
  const avgOppElo = opponentElos.reduce((a, b) => a + b, 0) / opponentElos.length;
  const scorePct = (playerPoints / gamesPlayed) * 100;
  const dp = dpFromPercentage(scorePct);
  return Math.round(avgOppElo + dp);
}

// ─── Streak Computation ────────────────────────────────────────────────────────

function longestWinStreak(playerId: string, rounds: Round[]): number {
  const completedRounds = rounds.filter((r) => r.status === "completed");
  let maxStreak = 0;
  let current = 0;
  for (const round of completedRounds) {
    const game = round.games.find(
      (g) => g.whiteId === playerId || g.blackId === playerId
    );
    if (!game || game.result === "*") { current = 0; continue; }
    const isWhite = game.whiteId === playerId;
    const won =
      (isWhite && game.result === "1-0") ||
      (!isWhite && game.result === "0-1");
    if (won) {
      current++;
      maxStreak = Math.max(maxStreak, current);
    } else {
      current = 0;
    }
  }
  return maxStreak;
}

// ─── Achievement Badge Logic ───────────────────────────────────────────────────

function assignBadge(
  rank: number,
  points: number,
  totalRounds: number,
  wins: number,
  draws: number,
  losses: number,
  biggestUpset: { eloGap: number } | null,
  rounds: Round[],
  playerId: string
): { badge: AchievementBadge; label: string } {
  // Podium
  if (rank === 1) return { badge: "champion",    label: "🏆 Champion" };
  if (rank === 2) return { badge: "runner_up",   label: "🥈 Runner-Up" };
  if (rank === 3) return { badge: "third_place", label: "🥉 Third Place" };

  // Perfect score
  if (points === totalRounds) return { badge: "perfect_score", label: "⭐ Perfect Score" };

  // Giant killer: beat someone 200+ ELO higher
  if (biggestUpset && biggestUpset.eloGap >= 200) {
    return { badge: "giant_killer", label: "⚡ Giant Killer" };
  }

  // Iron wall: more draws than wins and no losses
  if (draws > wins && losses === 0) {
    return { badge: "iron_wall", label: "🛡️ Iron Wall" };
  }

  // Comeback: lost round 1 but won the last round
  const completedRounds = rounds.filter((r) => r.status === "completed");
  if (completedRounds.length >= 2) {
    const firstGame = completedRounds[0].games.find(
      (g) => g.whiteId === playerId || g.blackId === playerId
    );
    const lastGame = completedRounds[completedRounds.length - 1].games.find(
      (g) => g.whiteId === playerId || g.blackId === playerId
    );
    if (firstGame && lastGame) {
      const lostFirst =
        (firstGame.whiteId === playerId && firstGame.result === "0-1") ||
        (firstGame.blackId === playerId && firstGame.result === "1-0");
      const wonLast =
        (lastGame.whiteId === playerId && lastGame.result === "1-0") ||
        (lastGame.blackId === playerId && lastGame.result === "0-1");
      if (lostFirst && wonLast) {
        return { badge: "comeback", label: "🔥 Comeback Player" };
      }
    }
  }

  // Consistent: all results within ½pt of each other (won at least half)
  if (losses === 0 && points >= totalRounds / 2) {
    return { badge: "consistent", label: "💎 Consistent Performer" };
  }

  return { badge: "participant", label: "🎖️ Participant" };
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export function computeAllPerformances(
  players: Player[],
  rounds: Round[]
): PlayerPerformance[] {
  if (players.length === 0) return [];

  const standings = computeStandings(players, rounds);
  const playerMap = new Map(players.map((p) => [p.id, p]));
  const totalRounds = rounds.filter((r) => r.status === "completed").length;

  return standings.map((row) => {
    const p = row.player;

    // Collect all games this player played (completed rounds only)
    const myGames: { game: Game; isWhite: boolean }[] = [];
    for (const round of rounds) {
      if (round.status !== "completed") continue;
      for (const game of round.games) {
        if (game.result === "*") continue;
        if (game.whiteId === p.id) myGames.push({ game, isWhite: true });
        else if (game.blackId === p.id) myGames.push({ game, isWhite: false });
      }
    }

    // W/D/L
    let wins = 0, draws = 0, losses = 0;
    for (const { game, isWhite } of myGames) {
      if (game.result === "½-½") { draws++; continue; }
      const won = (isWhite && game.result === "1-0") || (!isWhite && game.result === "0-1");
      if (won) wins++; else losses++;
    }

    // Opponent ELOs for performance rating
    const opponentElos: number[] = [];
    for (const { game, isWhite } of myGames) {
      const oppId = isWhite ? game.blackId : game.whiteId;
      const opp = playerMap.get(oppId);
      if (opp) opponentElos.push(opp.elo);
    }

    const gamesPlayed = myGames.length;
    const points = row.points;
    const perfRating = computePerformanceRating(points, gamesPlayed, opponentElos);
    const ratingChange = perfRating - p.elo;

    // Best win & biggest upset
    let bestWin: { opponent: Player; eloGap: number } | null = null;
    let biggestUpset: { opponent: Player; eloGap: number } | null = null;

    for (const { game, isWhite } of myGames) {
      const won = (isWhite && game.result === "1-0") || (!isWhite && game.result === "0-1");
      if (!won) continue;
      const oppId = isWhite ? game.blackId : game.whiteId;
      const opp = playerMap.get(oppId);
      if (!opp) continue;
      const gap = opp.elo - p.elo; // positive = opp was higher rated (upset)
      if (!bestWin || opp.elo > bestWin.opponent.elo) {
        bestWin = { opponent: opp, eloGap: opp.elo - p.elo };
      }
      if (gap > 0 && (!biggestUpset || gap > biggestUpset.eloGap)) {
        biggestUpset = { opponent: opp, eloGap: gap };
      }
    }

    // Color balance
    const whiteGames = myGames.filter((g) => g.isWhite).length;
    const blackGames = myGames.filter((g) => !g.isWhite).length;

    // Streak
    const streak = longestWinStreak(p.id, rounds);

    // Badge
    const { badge, label: badgeLabel } = assignBadge(
      row.rank,
      points,
      totalRounds,
      wins,
      draws,
      losses,
      biggestUpset,
      rounds,
      p.id
    );

    // Round-by-round history
    const completedRounds = rounds.filter((r) => r.status === "completed");
    let runningScore = 0;
    const roundHistory: RoundHistoryEntry[] = [];
    for (let ri = 0; ri < completedRounds.length; ri++) {
      const round = completedRounds[ri];
      const game = round.games.find(
        (g) => (g.whiteId === p.id || g.blackId === p.id) && g.result !== "*"
      );
      if (!game) continue;
      const isWhite = game.whiteId === p.id;
      const oppId = isWhite ? game.blackId : game.whiteId;
      const opp = playerMap.get(oppId);
      if (!opp) continue;
      const won = (isWhite && game.result === "1-0") || (!isWhite && game.result === "0-1");
      const drew = game.result === "½-½";
      const pts = won ? 1 : drew ? 0.5 : 0;
      runningScore += pts;
      roundHistory.push({
        roundNumber: ri + 1,
        opponent: opp,
        color: isWhite ? "W" : "B",
        result: won ? "win" : drew ? "draw" : "loss",
        gameResult: game.result,
        pointsEarned: pts,
        runningScore,
      });
    }

    return {
      player: p,
      rank: row.rank,
      totalPlayers: players.length,
      points,
      wins,
      draws,
      losses,
      performanceRating: perfRating,
      ratingChange,
      bestWin,
      biggestUpset,
      longestStreak: streak,
      whiteGames,
      blackGames,
      buchholz: row.buchholz,
      badge,
      badgeLabel,
      roundHistory,
    };
  });
}

/**
 * Compute performance stats for a single player.
 * Useful for individual card rendering without computing all players.
 */
export function computePlayerPerformance(
  playerId: string,
  players: Player[],
  rounds: Round[]
): PlayerPerformance | null {
  const all = computeAllPerformances(players, rounds);
  return all.find((p) => p.player.id === playerId) ?? null;
}
