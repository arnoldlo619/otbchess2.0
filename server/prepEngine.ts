/**
 * Matchup Prep Engine
 *
 * Fetches a chess.com player's recent games, classifies openings,
 * computes play-style statistics, and generates strategic preparation lines.
 *
 * Architecture:
 *   1. fetchPlayerGames() — pulls recent games from chess.com archives API
 *   2. classifyOpening()  — maps first N moves to a named opening via ECO-lite table
 *   3. analyzePlayStyle() — aggregates stats: opening repertoire, color preference,
 *                           endgame tendencies, tactical patterns
 *   4. generatePrepLines()— suggests counter-openings based on opponent weaknesses
 *   5. buildPrepReport()  — orchestrates the full pipeline into a PrepReport
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ChessComGame {
  url: string;
  pgn: string;
  time_control: string;
  time_class: "rapid" | "blitz" | "bullet" | "daily";
  rated: boolean;
  rules: string;
  end_time: number;
  white: { username: string; rating: number; result: string };
  black: { username: string; rating: number; result: string };
}

export interface OpeningInfo {
  eco: string;
  name: string;
  moves: string;
}

export interface OpeningStat {
  name: string;
  eco: string;
  count: number;
  wins: number;
  draws: number;
  losses: number;
  winRate: number;
  /** The move sequence for this opening */
  moves: string;
}

export interface PlayStyleProfile {
  username: string;
  gamesAnalyzed: number;
  rating: { rapid: number | null; blitz: number | null; bullet: number | null };
  /** Overall W/D/L */
  overall: { wins: number; draws: number; losses: number; winRate: number };
  /** As white */
  asWhite: { wins: number; draws: number; losses: number; winRate: number; games: number };
  /** As black */
  asBlack: { wins: number; draws: number; losses: number; winRate: number; games: number };
  /** Top openings as white */
  whiteOpenings: OpeningStat[];
  /** Top openings as black */
  blackOpenings: OpeningStat[];
  /** How games end */
  endgameProfile: {
    checkmates: number;
    resignations: number;
    timeouts: number;
    draws: number;
    total: number;
  };
  /** First-move preferences */
  firstMoveAsWhite: { move: string; count: number; pct: number }[];
  /** Average game length (in full moves) */
  avgGameLength: number;
}

export interface PrepLine {
  /** The suggested opening/defense name */
  name: string;
  /** ECO code */
  eco: string;
  /** Move sequence */
  moves: string;
  /** Why this line is recommended */
  rationale: string;
  /** Confidence: how strong the recommendation is */
  confidence: "high" | "medium" | "low";
}

export interface PrepReport {
  opponent: PlayStyleProfile;
  prepLines: PrepLine[];
  /** Key insights as short sentences */
  insights: string[];
  generatedAt: string;
}

// ─── ECO Opening Book (compact) ──────────────────────────────────────────────
// Maps normalized first-N-move sequences to opening names.
// We use a compact table covering the most common 80+ openings.

interface EcoEntry { eco: string; name: string; moves: string }

const ECO_BOOK: EcoEntry[] = [
  // King's Pawn
  { eco: "B00", name: "King's Pawn Opening", moves: "1.e4" },
  { eco: "C20", name: "King's Pawn Game", moves: "1.e4 e5" },
  { eco: "C44", name: "Scotch Game", moves: "1.e4 e5 2.Nf3 Nc6 3.d4" },
  { eco: "C50", name: "Italian Game", moves: "1.e4 e5 2.Nf3 Nc6 3.Bc4" },
  { eco: "C50", name: "Giuoco Piano", moves: "1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5" },
  { eco: "C51", name: "Evans Gambit", moves: "1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.b4" },
  { eco: "C60", name: "Ruy Lopez", moves: "1.e4 e5 2.Nf3 Nc6 3.Bb5" },
  { eco: "C65", name: "Ruy Lopez: Berlin Defense", moves: "1.e4 e5 2.Nf3 Nc6 3.Bb5 Nf6" },
  { eco: "C78", name: "Ruy Lopez: Morphy Defense", moves: "1.e4 e5 2.Nf3 Nc6 3.Bb5 a6" },
  { eco: "C25", name: "Vienna Game", moves: "1.e4 e5 2.Nc3" },
  { eco: "C21", name: "Danish Gambit", moves: "1.e4 e5 2.d4 exd4 3.c3" },
  { eco: "C30", name: "King's Gambit", moves: "1.e4 e5 2.f4" },
  { eco: "C42", name: "Petrov's Defense", moves: "1.e4 e5 2.Nf3 Nf6" },
  { eco: "C41", name: "Philidor Defense", moves: "1.e4 e5 2.Nf3 d6" },
  { eco: "C40", name: "Latvian Gambit", moves: "1.e4 e5 2.Nf3 f5" },

  // Sicilian
  { eco: "B20", name: "Sicilian Defense", moves: "1.e4 c5" },
  { eco: "B21", name: "Sicilian: Smith-Morra Gambit", moves: "1.e4 c5 2.d4 cxd4 3.c3" },
  { eco: "B22", name: "Sicilian: Alapin Variation", moves: "1.e4 c5 2.c3" },
  { eco: "B27", name: "Sicilian: Hyper-Accelerated Dragon", moves: "1.e4 c5 2.Nf3 g6" },
  { eco: "B30", name: "Sicilian: Old Sicilian", moves: "1.e4 c5 2.Nf3 Nc6" },
  { eco: "B32", name: "Sicilian: Open", moves: "1.e4 c5 2.Nf3 Nc6 3.d4" },
  { eco: "B40", name: "Sicilian: Kan Variation", moves: "1.e4 c5 2.Nf3 e6" },
  { eco: "B50", name: "Sicilian: Modern Variation", moves: "1.e4 c5 2.Nf3 d6" },
  { eco: "B60", name: "Sicilian: Najdorf", moves: "1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 a6" },
  { eco: "B70", name: "Sicilian: Dragon", moves: "1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 g6" },
  { eco: "B80", name: "Sicilian: Scheveningen", moves: "1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 e6" },

  // French
  { eco: "C00", name: "French Defense", moves: "1.e4 e6" },
  { eco: "C01", name: "French: Exchange Variation", moves: "1.e4 e6 2.d4 d5 3.exd5" },
  { eco: "C02", name: "French: Advance Variation", moves: "1.e4 e6 2.d4 d5 3.e5" },
  { eco: "C03", name: "French: Tarrasch Variation", moves: "1.e4 e6 2.d4 d5 3.Nd2" },
  { eco: "C06", name: "French: Classical", moves: "1.e4 e6 2.d4 d5 3.Nc3 Nf6" },
  { eco: "C11", name: "French: Winawer", moves: "1.e4 e6 2.d4 d5 3.Nc3 Bb4" },

  // Caro-Kann
  { eco: "B10", name: "Caro-Kann Defense", moves: "1.e4 c6" },
  { eco: "B12", name: "Caro-Kann: Advance Variation", moves: "1.e4 c6 2.d4 d5 3.e5" },
  { eco: "B13", name: "Caro-Kann: Exchange Variation", moves: "1.e4 c6 2.d4 d5 3.exd5 cxd5" },
  { eco: "B15", name: "Caro-Kann: Classical", moves: "1.e4 c6 2.d4 d5 3.Nc3 dxe4 4.Nxe4 Bf5" },

  // Scandinavian
  { eco: "B01", name: "Scandinavian Defense", moves: "1.e4 d5" },

  // Pirc / Modern
  { eco: "B07", name: "Pirc Defense", moves: "1.e4 d6 2.d4 Nf6" },
  { eco: "B06", name: "Modern Defense", moves: "1.e4 g6" },
  { eco: "B02", name: "Alekhine's Defense", moves: "1.e4 Nf6" },

  // Queen's Pawn
  { eco: "D00", name: "Queen's Pawn Game", moves: "1.d4 d5" },
  { eco: "D06", name: "Queen's Gambit", moves: "1.d4 d5 2.c4" },
  { eco: "D30", name: "Queen's Gambit Declined", moves: "1.d4 d5 2.c4 e6" },
  { eco: "D20", name: "Queen's Gambit Accepted", moves: "1.d4 d5 2.c4 dxc4" },
  { eco: "D10", name: "Slav Defense", moves: "1.d4 d5 2.c4 c6" },
  { eco: "D43", name: "Semi-Slav Defense", moves: "1.d4 d5 2.c4 c6 3.Nf3 Nf6 4.Nc3 e6" },
  { eco: "D35", name: "QGD: Exchange Variation", moves: "1.d4 d5 2.c4 e6 3.Nc3 Nf6 4.cxd5" },

  // Indian Defenses
  { eco: "E60", name: "King's Indian Defense", moves: "1.d4 Nf6 2.c4 g6" },
  { eco: "E62", name: "King's Indian: Fianchetto", moves: "1.d4 Nf6 2.c4 g6 3.g3" },
  { eco: "E70", name: "King's Indian: Classical", moves: "1.d4 Nf6 2.c4 g6 3.Nc3 Bg7 4.e4 d6 5.Nf3 O-O 6.Be2" },
  { eco: "E80", name: "King's Indian: Samisch", moves: "1.d4 Nf6 2.c4 g6 3.Nc3 Bg7 4.e4 d6 5.f3" },
  { eco: "E20", name: "Nimzo-Indian Defense", moves: "1.d4 Nf6 2.c4 e6 3.Nc3 Bb4" },
  { eco: "E10", name: "Queen's Indian Defense", moves: "1.d4 Nf6 2.c4 e6 3.Nf3 b6" },
  { eco: "A50", name: "Indian Defense", moves: "1.d4 Nf6" },
  { eco: "A56", name: "Benoni Defense", moves: "1.d4 Nf6 2.c4 c5" },
  { eco: "A60", name: "Modern Benoni", moves: "1.d4 Nf6 2.c4 c5 3.d5 e6" },
  { eco: "E00", name: "Catalan Opening", moves: "1.d4 Nf6 2.c4 e6 3.g3" },
  { eco: "D70", name: "Grunfeld Defense", moves: "1.d4 Nf6 2.c4 g6 3.Nc3 d5" },
  { eco: "A40", name: "Dutch Defense", moves: "1.d4 f5" },

  // Flank Openings
  { eco: "A04", name: "Reti Opening", moves: "1.Nf3 d5 2.c4" },
  { eco: "A10", name: "English Opening", moves: "1.c4" },
  { eco: "A16", name: "English: Anglo-Indian", moves: "1.c4 Nf6" },
  { eco: "A20", name: "English: Symmetrical", moves: "1.c4 e5" },

  // London / Trompowsky
  { eco: "D00", name: "London System", moves: "1.d4 d5 2.Bf4" },
  { eco: "D00", name: "London System", moves: "1.d4 Nf6 2.Bf4" },
  { eco: "A45", name: "Trompowsky Attack", moves: "1.d4 Nf6 2.Bg5" },

  // Others
  { eco: "A00", name: "Grob Attack", moves: "1.g4" },
  { eco: "A01", name: "Larsen's Opening", moves: "1.b3" },
  { eco: "A02", name: "Bird's Opening", moves: "1.f4" },
];

// Sort by move length descending so longest (most specific) match wins
const ECO_SORTED = [...ECO_BOOK].sort((a, b) => b.moves.length - a.moves.length);

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CC_HEADERS = {
  "User-Agent": "OTBChess/1.0 (https://chessotb.club; matchup prep engine)",
  "Accept": "application/json",
};

/**
 * Extract the first N full-moves from a PGN string (just the move text, no headers).
 */
export function extractMoves(pgn: string, maxFullMoves = 10): string {
  // Strip PGN headers (lines starting with [)
  const moveText = pgn
    .replace(/\[.*?\]\s*/g, "")
    .replace(/\{[^}]*\}/g, "")  // strip comments
    .replace(/\d+\.\.\./g, "")  // strip "..." continuation
    .replace(/\s+/g, " ")
    .trim();

  // Parse move pairs: "1.e4 e5 2.Nf3 Nc6 ..."
  const tokens = moveText.split(/\s+/);
  const moves: string[] = [];
  let fullMoveCount = 0;

  for (const token of tokens) {
    // Skip result tokens
    if (["1-0", "0-1", "1/2-1/2", "*"].includes(token)) break;
    // Skip move numbers like "1." "2."
    if (/^\d+\./.test(token)) {
      const moveAfterNum = token.replace(/^\d+\./, "");
      if (moveAfterNum) {
        moves.push(moveAfterNum);
        fullMoveCount++;
      }
      continue;
    }
    moves.push(token);
    // Every second move completes a full move
    if (moves.length % 2 === 0) fullMoveCount++;
    if (fullMoveCount >= maxFullMoves) break;
  }

  // Reconstruct with move numbers
  const result: string[] = [];
  for (let i = 0; i < moves.length; i += 2) {
    const num = Math.floor(i / 2) + 1;
    if (i + 1 < moves.length) {
      result.push(`${num}.${moves[i]} ${moves[i + 1]}`);
    } else {
      result.push(`${num}.${moves[i]}`);
    }
  }
  return result.join(" ");
}

/**
 * Classify an opening from a PGN's first moves.
 * Returns the most specific matching ECO entry.
 */
export function classifyOpening(pgn: string): OpeningInfo {
  const normalized = extractMoves(pgn, 10);

  for (const entry of ECO_SORTED) {
    if (normalized.startsWith(entry.moves) || normalized === entry.moves) {
      return { eco: entry.eco, name: entry.name, moves: entry.moves };
    }
  }

  // Fallback: extract first move
  const firstMove = normalized.split(" ")[0] || "Unknown";
  return { eco: "A00", name: `Unclassified (${firstMove})`, moves: firstMove };
}

/**
 * Determine the result for a given username from a chess.com game object.
 */
export function getResult(game: ChessComGame, username: string): "win" | "draw" | "loss" {
  const u = username.toLowerCase();
  const isWhite = game.white.username.toLowerCase() === u;
  const side = isWhite ? game.white : game.black;
  const res = side.result;
  if (res === "win") return "win";
  if (["agreed", "stalemate", "repetition", "insufficient", "50move", "timevsinsufficient"].includes(res)) return "draw";
  return "loss";
}

/**
 * Determine how a game ended.
 */
export function getEndType(game: ChessComGame, username: string): "checkmate" | "resignation" | "timeout" | "draw" | "other" {
  const u = username.toLowerCase();
  const isWhite = game.white.username.toLowerCase() === u;
  const mySide = isWhite ? game.white : game.black;
  const oppSide = isWhite ? game.black : game.white;

  if (mySide.result === "win") {
    if (oppSide.result === "checkmated") return "checkmate";
    if (oppSide.result === "resigned") return "resignation";
    if (oppSide.result === "timeout") return "timeout";
    return "other";
  }
  if (["agreed", "stalemate", "repetition", "insufficient", "50move", "timevsinsufficient"].includes(mySide.result)) return "draw";
  if (mySide.result === "checkmated") return "checkmate";
  if (mySide.result === "resigned") return "resignation";
  if (mySide.result === "timeout") return "timeout";
  return "other";
}

/**
 * Count full moves in a PGN.
 */
export function countMoves(pgn: string): number {
  const moveText = pgn.replace(/\[.*?\]\s*/g, "").replace(/\{[^}]*\}/g, "").trim();
  const moveNumbers = moveText.match(/\d+\./g);
  if (!moveNumbers) return 0;
  // The highest move number is the game length
  const nums = moveNumbers.map((m) => parseInt(m));
  return Math.max(...nums, 0);
}

// ─── Chess.com API Fetchers ──────────────────────────────────────────────────

/**
 * Fetch recent games for a chess.com player.
 * Walks the archives API backwards, collecting up to `maxGames` rated standard games.
 */
export async function fetchPlayerGames(
  username: string,
  maxGames = 50,
  timeClasses: string[] = ["rapid", "blitz", "bullet"]
): Promise<ChessComGame[]> {
  const u = username.toLowerCase().trim();
  const base = "https://api.chess.com/pub/player";

  // Fetch archive list
  const archivesRes = await fetch(`${base}/${u}/games/archives`, { headers: CC_HEADERS });
  if (!archivesRes.ok) {
    throw new Error(`chess.com archives error: ${archivesRes.status}`);
  }
  const archivesData = (await archivesRes.json()) as { archives?: string[] };
  const archives = archivesData.archives ?? [];

  const games: ChessComGame[] = [];

  // Walk backwards (newest first), fetch up to 3 months max to stay fast
  const maxMonths = Math.min(archives.length, 3);
  for (let i = archives.length - 1; i >= archives.length - maxMonths && games.length < maxGames; i--) {
    if (i < 0) break;
    try {
      const monthRes = await fetch(archives[i], { headers: CC_HEADERS });
      if (!monthRes.ok) continue;
      const monthData = (await monthRes.json()) as { games?: ChessComGame[] };
      const monthGames = monthData.games ?? [];

      // Process newest first within the month
      for (let j = monthGames.length - 1; j >= 0 && games.length < maxGames; j--) {
        const g = monthGames[j];
        if (!g.rated) continue;
        if (g.rules && g.rules !== "chess") continue;
        if (!timeClasses.includes(g.time_class)) continue;
        games.push(g);
      }
    } catch {
      // Skip failed month fetches
      continue;
    }
  }

  return games;
}

/**
 * Fetch player stats (ratings) from chess.com.
 */
export async function fetchPlayerStats(username: string): Promise<{
  rapid: number | null;
  blitz: number | null;
  bullet: number | null;
}> {
  const u = username.toLowerCase().trim();
  const res = await fetch(`https://api.chess.com/pub/player/${u}/stats`, { headers: CC_HEADERS });
  if (!res.ok) return { rapid: null, blitz: null, bullet: null };

  const data = (await res.json()) as Record<string, { last?: { rating?: number } }>;
  return {
    rapid: data.chess_rapid?.last?.rating ?? null,
    blitz: data.chess_blitz?.last?.rating ?? null,
    bullet: data.chess_bullet?.last?.rating ?? null,
  };
}

// ─── Analysis Engine ─────────────────────────────────────────────────────────

/**
 * Analyze a player's games and build a comprehensive play style profile.
 */
export function analyzePlayStyle(
  username: string,
  games: ChessComGame[],
  ratings: { rapid: number | null; blitz: number | null; bullet: number | null }
): PlayStyleProfile {
  const u = username.toLowerCase();

  let wins = 0, draws = 0, losses = 0;
  let wWins = 0, wDraws = 0, wLosses = 0, wGames = 0;
  let bWins = 0, bDraws = 0, bLosses = 0, bGames = 0;
  let checkmates = 0, resignations = 0, timeouts = 0, drawEnds = 0;
  let totalMoves = 0;

  const whiteOpeningMap = new Map<string, { eco: string; moves: string; w: number; d: number; l: number }>();
  const blackOpeningMap = new Map<string, { eco: string; moves: string; w: number; d: number; l: number }>();
  const firstMoveMap = new Map<string, number>();

  for (const game of games) {
    const isWhite = game.white.username.toLowerCase() === u;
    const result = getResult(game, username);
    const endType = getEndType(game, username);
    const opening = classifyOpening(game.pgn || "");
    const moveCount = countMoves(game.pgn || "");

    // Overall
    if (result === "win") wins++;
    else if (result === "draw") draws++;
    else losses++;

    // By color
    if (isWhite) {
      wGames++;
      if (result === "win") wWins++;
      else if (result === "draw") wDraws++;
      else wLosses++;
    } else {
      bGames++;
      if (result === "win") bWins++;
      else if (result === "draw") bDraws++;
      else bLosses++;
    }

    // Endgame profile
    if (endType === "checkmate") checkmates++;
    else if (endType === "resignation") resignations++;
    else if (endType === "timeout") timeouts++;
    else if (endType === "draw") drawEnds++;

    // Opening tracking
    const openingMap = isWhite ? whiteOpeningMap : blackOpeningMap;
    const existing = openingMap.get(opening.name);
    if (existing) {
      if (result === "win") existing.w++;
      else if (result === "draw") existing.d++;
      else existing.l++;
    } else {
      openingMap.set(opening.name, {
        eco: opening.eco,
        moves: opening.moves,
        w: result === "win" ? 1 : 0,
        d: result === "draw" ? 1 : 0,
        l: result === "loss" ? 1 : 0,
      });
    }

    // First move as white
    if (isWhite && game.pgn) {
      const firstMove = extractFirstWhiteMove(game.pgn);
      if (firstMove) {
        firstMoveMap.set(firstMove, (firstMoveMap.get(firstMove) ?? 0) + 1);
      }
    }

    totalMoves += moveCount;
  }

  const total = games.length || 1;

  // Convert opening maps to sorted arrays
  const toOpeningStats = (map: Map<string, { eco: string; moves: string; w: number; d: number; l: number }>): OpeningStat[] => {
    return Array.from(map.entries())
      .map(([name, { eco, moves, w, d, l }]) => ({
        name,
        eco,
        count: w + d + l,
        wins: w,
        draws: d,
        losses: l,
        winRate: (w + d + l) > 0 ? Math.round((w / (w + d + l)) * 100) : 0,
        moves,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8); // Top 8 openings
  };

  // First move stats
  const firstMoveStats = Array.from(firstMoveMap.entries())
    .map(([move, count]) => ({
      move,
      count,
      pct: Math.round((count / (wGames || 1)) * 100),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    username,
    gamesAnalyzed: games.length,
    rating: ratings,
    overall: {
      wins,
      draws,
      losses,
      winRate: Math.round((wins / total) * 100),
    },
    asWhite: {
      wins: wWins,
      draws: wDraws,
      losses: wLosses,
      winRate: wGames > 0 ? Math.round((wWins / wGames) * 100) : 0,
      games: wGames,
    },
    asBlack: {
      wins: bWins,
      draws: bDraws,
      losses: bLosses,
      winRate: bGames > 0 ? Math.round((bWins / bGames) * 100) : 0,
      games: bGames,
    },
    whiteOpenings: toOpeningStats(whiteOpeningMap),
    blackOpenings: toOpeningStats(blackOpeningMap),
    endgameProfile: {
      checkmates,
      resignations,
      timeouts,
      draws: drawEnds,
      total: games.length,
    },
    firstMoveAsWhite: firstMoveStats,
    avgGameLength: games.length > 0 ? Math.round(totalMoves / games.length) : 0,
  };
}

function extractFirstWhiteMove(pgn: string): string | null {
  const moveText = pgn.replace(/\[.*?\]\s*/g, "").replace(/\{[^}]*\}/g, "").trim();
  const match = moveText.match(/1\.\s*(\S+)/);
  return match?.[1] ?? null;
}

// ─── Prep Line Generator ────────────────────────────────────────────────────

/** Counter-opening suggestions based on opponent weaknesses. */
const COUNTER_LINES: Record<string, PrepLine[]> = {
  // If opponent plays 1.e4 heavily
  "1.e4": [
    {
      name: "Sicilian: Najdorf",
      eco: "B60",
      moves: "1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 a6",
      rationale: "The Najdorf is the most theoretically rich response to 1.e4, offering dynamic counterplay and imbalanced positions that punish unprepared players.",
      confidence: "high",
    },
    {
      name: "Caro-Kann Defense",
      eco: "B10",
      moves: "1.e4 c6 2.d4 d5",
      rationale: "Solid and reliable — the Caro-Kann avoids sharp tactical lines and leads to positions where strategic understanding matters more than memorization.",
      confidence: "high",
    },
    {
      name: "French Defense: Winawer",
      eco: "C11",
      moves: "1.e4 e6 2.d4 d5 3.Nc3 Bb4",
      rationale: "The Winawer creates immediate tension and often leads to unbalanced pawn structures that favor the prepared player.",
      confidence: "medium",
    },
  ],
  // If opponent plays 1.d4 heavily
  "1.d4": [
    {
      name: "King's Indian Defense",
      eco: "E60",
      moves: "1.d4 Nf6 2.c4 g6 3.Nc3 Bg7 4.e4 d6",
      rationale: "The King's Indian allows White to build a big center, then strikes back with ...e5 or ...c5. Excellent for players who like dynamic, attacking chess.",
      confidence: "high",
    },
    {
      name: "Nimzo-Indian Defense",
      eco: "E20",
      moves: "1.d4 Nf6 2.c4 e6 3.Nc3 Bb4",
      rationale: "The Nimzo-Indian is one of the most respected defenses against 1.d4, offering flexible pawn structures and piece activity.",
      confidence: "high",
    },
    {
      name: "Grunfeld Defense",
      eco: "D70",
      moves: "1.d4 Nf6 2.c4 g6 3.Nc3 d5",
      rationale: "The Grunfeld challenges White's center immediately, leading to open positions with dynamic piece play.",
      confidence: "medium",
    },
  ],
  // If opponent plays 1.c4
  "1.c4": [
    {
      name: "Symmetrical English",
      eco: "A20",
      moves: "1.c4 e5",
      rationale: "Playing 1...e5 against the English seizes central space and often transposes into reversed Sicilian structures where Black has an extra tempo.",
      confidence: "medium",
    },
  ],
  // If opponent plays 1.Nf3
  "1.Nf3": [
    {
      name: "Queen's Pawn Response",
      eco: "A04",
      moves: "1.Nf3 d5 2.g3 Nf6 3.Bg2 e6",
      rationale: "Solid central control against the Reti. Keeps options open for various pawn structures.",
      confidence: "medium",
    },
  ],
};

/** Suggest counter-openings when you play white against this opponent's black repertoire. */
const WHITE_COUNTERS: Record<string, PrepLine> = {
  "Sicilian Defense": {
    name: "Anti-Sicilian: Alapin (2.c3)",
    eco: "B22",
    moves: "1.e4 c5 2.c3 d5 3.exd5 Qxd5 4.d4",
    rationale: "The Alapin avoids the main-line Sicilian theory and leads to positions where White gets a comfortable IQP game with clear plans.",
    confidence: "high",
  },
  "French Defense": {
    name: "French: Advance Variation",
    eco: "C02",
    moves: "1.e4 e6 2.d4 d5 3.e5 c5 4.c3",
    rationale: "The Advance locks the center and creates a space advantage. Many French players are less comfortable in closed positions.",
    confidence: "high",
  },
  "Caro-Kann Defense": {
    name: "Caro-Kann: Fantasy Variation",
    eco: "B12",
    moves: "1.e4 c6 2.d4 d5 3.f3",
    rationale: "The Fantasy Variation is aggressive and less common — many Caro-Kann players are unprepared for it, expecting the main lines.",
    confidence: "medium",
  },
  "King's Indian Defense": {
    name: "King's Indian: Samisch",
    eco: "E80",
    moves: "1.d4 Nf6 2.c4 g6 3.Nc3 Bg7 4.e4 d6 5.f3",
    rationale: "The Samisch is a solid system against the King's Indian that restricts Black's typical kingside attack plans.",
    confidence: "medium",
  },
  "Nimzo-Indian Defense": {
    name: "Nimzo-Indian: Classical (4.Qc2)",
    eco: "E32",
    moves: "1.d4 Nf6 2.c4 e6 3.Nc3 Bb4 4.Qc2",
    rationale: "4.Qc2 avoids doubled pawns and maintains a flexible pawn structure. White keeps the bishop pair potential.",
    confidence: "high",
  },
};

/**
 * Generate preparation lines based on the opponent's play style profile.
 */
export function generatePrepLines(profile: PlayStyleProfile): PrepLine[] {
  const lines: PrepLine[] = [];

  // 1. Counter their most common first move as white
  if (profile.firstMoveAsWhite.length > 0) {
    const topMove = profile.firstMoveAsWhite[0].move;
    const moveKey = `1.${topMove}`;
    const counters = COUNTER_LINES[moveKey];
    if (counters) {
      // Add the top 2 counter-lines
      for (const counter of counters.slice(0, 2)) {
        lines.push({
          ...counter,
          rationale: `Opponent plays ${moveKey} in ${profile.firstMoveAsWhite[0].pct}% of white games. ${counter.rationale}`,
        });
      }
    }
  }

  // 2. Counter their most common black openings (when you play white)
  if (profile.blackOpenings.length > 0) {
    const topBlackOpening = profile.blackOpenings[0];
    const counter = WHITE_COUNTERS[topBlackOpening.name];
    if (counter) {
      lines.push({
        ...counter,
        rationale: `Opponent plays the ${topBlackOpening.name} in ${topBlackOpening.count} games (${topBlackOpening.winRate}% win rate). ${counter.rationale}`,
      });
    }
  }

  // 3. Exploit weaknesses
  // If opponent loses more as black, suggest aggressive white openings
  if (profile.asBlack.winRate < 40 && profile.asBlack.games >= 5) {
    lines.push({
      name: "Aggressive 1.e4 Repertoire",
      eco: "C20",
      moves: "1.e4",
      rationale: `Opponent wins only ${profile.asBlack.winRate}% as Black — apply pressure with 1.e4 and aim for open, tactical positions.`,
      confidence: "high",
    });
  }

  // If opponent has high timeout rate, suggest complex positions
  if (profile.endgameProfile.total > 0) {
    const timeoutRate = Math.round((profile.endgameProfile.timeouts / profile.endgameProfile.total) * 100);
    if (timeoutRate > 20) {
      lines.push({
        name: "Complex Middlegame Strategy",
        eco: "---",
        moves: "Aim for positions with many pieces remaining",
        rationale: `Opponent loses on time in ${timeoutRate}% of games — steer toward complex positions with many calculation-heavy decisions.`,
        confidence: "medium",
      });
    }
  }

  // If opponent's average game is short, they may struggle in longer games
  if (profile.avgGameLength < 25 && profile.gamesAnalyzed >= 10) {
    lines.push({
      name: "Endgame Grind Strategy",
      eco: "---",
      moves: "Trade pieces, aim for technical endgames",
      rationale: `Opponent's average game length is ${profile.avgGameLength} moves — they prefer quick games. Slow the pace and aim for endgames where technique matters.`,
      confidence: "medium",
    });
  }

  // Deduplicate by name
  const seen = new Set<string>();
  return lines.filter((l) => {
    if (seen.has(l.name)) return false;
    seen.add(l.name);
    return true;
  });
}

// ─── Insight Generator ──────────────────────────────────────────────────────

export function generateInsights(profile: PlayStyleProfile): string[] {
  const insights: string[] = [];

  // First move preference
  if (profile.firstMoveAsWhite.length > 0) {
    const top = profile.firstMoveAsWhite[0];
    insights.push(`Plays 1.${top.move} in ${top.pct}% of white games.`);
  }

  // Color preference
  if (profile.asWhite.winRate > profile.asBlack.winRate + 10) {
    insights.push(`Stronger as White (${profile.asWhite.winRate}% win rate vs ${profile.asBlack.winRate}% as Black).`);
  } else if (profile.asBlack.winRate > profile.asWhite.winRate + 10) {
    insights.push(`Stronger as Black (${profile.asBlack.winRate}% win rate vs ${profile.asWhite.winRate}% as White).`);
  }

  // Top white opening
  if (profile.whiteOpenings.length > 0) {
    const top = profile.whiteOpenings[0];
    insights.push(`Favorite white opening: ${top.name} (${top.count} games, ${top.winRate}% win rate).`);
  }

  // Top black opening
  if (profile.blackOpenings.length > 0) {
    const top = profile.blackOpenings[0];
    insights.push(`Favorite black defense: ${top.name} (${top.count} games, ${top.winRate}% win rate).`);
  }

  // Endgame style
  if (profile.endgameProfile.total > 0) {
    const { checkmates, resignations, timeouts, total } = profile.endgameProfile;
    const cmRate = Math.round((checkmates / total) * 100);
    const toRate = Math.round((timeouts / total) * 100);
    if (cmRate > 25) insights.push(`Tactical player — ${cmRate}% of games end in checkmate.`);
    if (toRate > 20) insights.push(`Time management weakness — ${toRate}% of games end on time.`);
    if (resignations > checkmates) insights.push("Tends to resign rather than play to checkmate.");
  }

  // Game length
  if (profile.avgGameLength > 0) {
    if (profile.avgGameLength < 25) {
      insights.push(`Prefers short games (avg ${profile.avgGameLength} moves).`);
    } else if (profile.avgGameLength > 40) {
      insights.push(`Comfortable in long games (avg ${profile.avgGameLength} moves).`);
    }
  }

  return insights.slice(0, 8); // Cap at 8 insights
}

// ─── Full Pipeline ──────────────────────────────────────────────────────────

/**
 * Build a complete matchup preparation report for a chess.com player.
 */
export async function buildPrepReport(
  username: string,
  maxGames = 50
): Promise<PrepReport> {
  // Fetch games and stats in parallel
  const [games, ratings] = await Promise.all([
    fetchPlayerGames(username, maxGames),
    fetchPlayerStats(username),
  ]);

  // Analyze play style
  const profile = analyzePlayStyle(username, games, ratings);

  // Generate prep lines and insights
  const prepLines = generatePrepLines(profile);
  const insights = generateInsights(profile);

  return {
    opponent: profile,
    prepLines,
    insights,
    generatedAt: new Date().toISOString(),
  };
}
