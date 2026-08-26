/**
 * Match Prep Analysis Engine — v1.0
 *
 * Async Stockfish-backed scouting pipeline for opponent analysis.
 *
 * Pipeline:
 *   1. fetchOpponentGames()      — pull last 30 games from chess.com API
 *   2. prioritizePositions()     — select top 30 most-played positions (first 15 moves)
 *   3. analyzeWithCache()        — check prep_position_cache, call chess-api.com if miss
 *   4. classifyMoves()           — compute cp-loss per move, classify blunders/mistakes
 *   5. detectPatterns()          — aggregate patterns across games
 *   6. buildEnginePatterns()     — return structured EnginePatterns for prepEngine.ts
 *
 * Rate limiting: 200ms delay between chess-api.com calls (same as recordings.ts).
 * Position budget: max 30 positions per opponent per run.
 */

import { Chess } from "chess.js";
import type { ChessComGame } from "./prepEngine.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MoveEval {
  /** Half-move number (1-indexed) */
  halfMove: number;
  /** Full move number */
  moveNum: number;
  /** Side that made this move */
  color: "white" | "black";
  /** SAN notation of the move */
  san: string;
  /** FEN before this move */
  fenBefore: string;
  /** FEN after this move */
  fenAfter: string;
  /** Centipawn eval before the move (from White's perspective) */
  evalBefore: number;
  /** Centipawn eval after the move (from White's perspective) */
  evalAfter: number;
  /** Centipawn loss for the player who moved (always >= 0) */
  cpLoss: number;
  /** Classification of this move */
  classification: "best" | "good" | "inaccuracy" | "mistake" | "blunder";
  /** Best move available before this move was played */
  bestMove: string;
  /** Game phase when this move was played */
  phase: "opening" | "middlegame" | "endgame";
}

export interface GameAnalysisResult {
  gameUrl: string;
  opponentColor: "white" | "black";
  opponentResult: "win" | "loss" | "draw";
  eco: string;
  openingName: string;
  moves: MoveEval[];
  blunderCount: number;
  mistakeCount: number;
  inaccuracyCount: number;
  firstMajorErrorMove: number | null;
  firstMajorErrorPhase: "opening" | "middlegame" | "endgame" | null;
  avgCpLoss: number;
}

export interface EnginePattern {
  patternType: "opening_trap" | "tactical_weakness" | "endgame_weakness" | "time_pressure" | "phase_blunder";
  label: string;
  description: string;
  frequency: number;
  totalGames: number;
  confidence: "high" | "moderate" | "low";
  severityScore: number;
  evidence: {
    gameUrl?: string;
    move?: string;
    phase?: string;
    eco?: string;
  }[];
}

export interface EnginePatterns {
  patterns: EnginePattern[];
  gamesAnalyzed: number;
  positionsAnalyzed: number;
  /** Average blunders per game */
  avgBlundersPerGame: number;
  /** Average mistakes per game */
  avgMistakesPerGame: number;
  /** Phase where opponent blunders most */
  worstPhase: "opening" | "middlegame" | "endgame";
  /** Opening ECOs where opponent has the worst performance */
  weakOpenings: { eco: string; name: string; blunderRate: number; games: number }[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CHESS_API_URL = "https://chess-api.com/v1";
const ANALYSIS_DEPTH = 12;
const MAX_POSITIONS_PER_RUN = 30;
const MAX_MOVES_PER_GAME = 15; // Only analyze first 15 moves (opening + early middlegame)
const API_DELAY_MS = 250; // 250ms between chess-api.com calls

// ─── Move Classification ──────────────────────────────────────────────────────

function classifyMove(cpLoss: number): "best" | "good" | "inaccuracy" | "mistake" | "blunder" {
  if (cpLoss <= 0) return "best";
  if (cpLoss <= 30) return "good";
  if (cpLoss <= 100) return "inaccuracy";
  if (cpLoss <= 300) return "mistake";
  return "blunder";
}

function getGamePhase(moveNum: number): "opening" | "middlegame" | "endgame" {
  if (moveNum <= 10) return "opening";
  if (moveNum <= 30) return "middlegame";
  return "endgame";
}

/** Normalize FEN to remove move clocks (for cache key) */
function normalizeFen(fen: string): string {
  const parts = fen.split(" ");
  return parts.slice(0, 4).join(" "); // piece placement, side to move, castling, en passant
}

// ─── Stockfish REST Integration ───────────────────────────────────────────────

interface StockfishResult {
  evalCp: number;
  bestMove: string;
  winChance: number;
  continuation: string;
}

async function callStockfishApi(fen: string): Promise<StockfishResult | null> {
  try {
    const res = await fetch(CHESS_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fen, depth: ANALYSIS_DEPTH, maxThinkingTime: 100 }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, unknown>;
    return {
      evalCp: Math.round(((data.eval as number) ?? 0) * 100), // chess-api returns pawns, convert to cp
      bestMove: (data.move as string) ?? "",
      winChance: (data.winChance as number) ?? 50,
      continuation: Array.isArray(data.continuationArr)
        ? (data.continuationArr as string[]).join(" ")
        : "",
    };
  } catch {
    return null;
  }
}

// ─── In-Memory Eval Cache ─────────────────────────────────────────────────────
// Secondary cache layer on top of the DB cache — avoids repeated DB lookups
// within the same analysis run.

const inMemoryEvalCache = new Map<string, StockfishResult>();

/**
 * Get or compute a Stockfish evaluation for a FEN position.
 * Checks in-memory cache first, then DB cache, then calls chess-api.com.
 */
async function getEval(
  fen: string,
  db: Awaited<ReturnType<typeof import("./db.js").getDb>>
): Promise<StockfishResult | null> {
  const normalizedFen = normalizeFen(fen);

  // 1. In-memory cache
  if (inMemoryEvalCache.has(normalizedFen)) {
    return inMemoryEvalCache.get(normalizedFen)!;
  }

  // 2. DB cache
  try {
    const { prepPositionCache } = await import("../shared/schema.js");
    const { eq } = await import("drizzle-orm");
    const [cached] = await db.select().from(prepPositionCache)
      .where(eq(prepPositionCache.fen, normalizedFen))
      .limit(1);
    if (cached) {
      const result: StockfishResult = {
        evalCp: cached.evalCp,
        bestMove: cached.bestMove ?? "",
        winChance: cached.winChance ?? 50,
        continuation: cached.continuation ?? "",
      };
      inMemoryEvalCache.set(normalizedFen, result);
      return result;
    }
  } catch {
    // DB unavailable — fall through to API
  }

  // 3. chess-api.com REST call
  const result = await callStockfishApi(fen);
  if (!result) return null;

  // Store in DB cache (fire-and-forget)
  try {
    const { prepPositionCache } = await import("../shared/schema.js");
    await db.insert(prepPositionCache).values({
      fen: normalizedFen,
      evalCp: result.evalCp,
      bestMove: result.bestMove || null,
      winChance: result.winChance,
      continuation: result.continuation || null,
      depth: ANALYSIS_DEPTH,
    }).onDuplicateKeyUpdate({
      set: {
        evalCp: result.evalCp,
        bestMove: result.bestMove || null,
        winChance: result.winChance,
        continuation: result.continuation || null,
        cachedAt: new Date(),
      },
    });
  } catch {
    // Non-fatal
  }

  inMemoryEvalCache.set(normalizedFen, result);
  return result;
}

// ─── PGN Tokenizer ────────────────────────────────────────────────────────────

/** Extract SAN move tokens from a PGN string */
function extractMovesFromPgn(pgn: string): string[] {
  // Remove headers [Key "Value"]
  const withoutHeaders = pgn.replace(/\[.*?\]\s*/g, "").trim();
  // Remove comments {comment}
  const withoutComments = withoutHeaders.replace(/\{[^}]*\}/g, "");
  // Remove result
  const withoutResult = withoutComments.replace(/\s*(1-0|0-1|1\/2-1\/2|\*)\s*$/, "");
  // Split on whitespace and filter out move numbers (e.g. "1.", "1...", "12.")
  const tokens = withoutResult.split(/\s+/).filter(t => t && !/^\d+\.+$/.test(t));
  return tokens;
}

// ─── Single Game Analysis ─────────────────────────────────────────────────────

/**
 * Analyze one game for an opponent.
 * Returns per-move evaluations for the first MAX_MOVES_PER_GAME moves.
 * Uses the eval cache to avoid redundant API calls.
 */
async function analyzeGame(
  game: ChessComGame,
  opponentUsername: string,
  db: Awaited<ReturnType<typeof import("./db.js").getDb>>,
  positionBudget: { used: number; max: number }
): Promise<GameAnalysisResult | null> {
  const lc = opponentUsername.toLowerCase();
  const isWhite = game.white.username.toLowerCase() === lc;
  const opponentColor = isWhite ? "white" : "black";
  const opponentData = isWhite ? game.white : game.black;

  let opponentResult: "win" | "loss" | "draw";
  if (opponentData.result === "win") opponentResult = "win";
  else if (opponentData.result === "checkmated" || opponentData.result === "resigned" ||
           opponentData.result === "timeout" || opponentData.result === "abandoned") opponentResult = "loss";
  else opponentResult = "draw";

  const chess = new Chess();
  let eco = "";
  let openingName = "";

  // Parse PGN headers for ECO
  const ecoMatch = game.pgn.match(/\[ECO "([^"]+)"\]/);
  if (ecoMatch) eco = ecoMatch[1];
  const openingMatch = game.pgn.match(/\[Opening "([^"]+)"\]/);
  if (openingMatch) openingName = openingMatch[1];

  const sanMoves = extractMovesFromPgn(game.pgn);
  const movesToAnalyze = Math.min(sanMoves.length, MAX_MOVES_PER_GAME * 2); // half-moves

  const moveEvals: MoveEval[] = [];
  let evalBefore: number | null = null;

  for (let i = 0; i < movesToAnalyze; i++) {
    if (positionBudget.used >= positionBudget.max) break;

    const fenBefore = chess.fen();
    const san = sanMoves[i];
    if (!san) break;

    // Try to make the move
    let moveResult;
    try {
      moveResult = chess.move(san);
    } catch {
      break; // Invalid move in PGN — stop analyzing this game
    }
    if (!moveResult) break;

    const fenAfter = chess.fen();
    const halfMove = i + 1;
    const moveNum = Math.ceil(halfMove / 2);
    const color: "white" | "black" = i % 2 === 0 ? "white" : "black";
    const phase = getGamePhase(moveNum);

    // Only analyze positions where the opponent just moved (their moves)
    const isOpponentMove = color === opponentColor;

    if (isOpponentMove) {
      positionBudget.used++;

      // Get eval BEFORE opponent's move (what was the position before they played?)
      if (evalBefore === null) {
        const evalResult = await getEval(fenBefore, db);
        evalBefore = evalResult ? evalResult.evalCp : 0;
        await new Promise(r => setTimeout(r, API_DELAY_MS));
      }

      // Get eval AFTER opponent's move
      const evalAfterResult = await getEval(fenAfter, db);
      await new Promise(r => setTimeout(r, API_DELAY_MS));

      const evalAfterCp: number = evalAfterResult ? evalAfterResult.evalCp : (evalBefore ?? 0);
      const bestMoveStr = evalAfterResult?.bestMove ?? "";

      // Compute cp-loss from the opponent's perspective
      // evalBefore is from White's POV. For White's moves, higher eval after = better.
      // For Black's moves, lower eval after = better.
      let cpLoss: number;
      if (color === "white") {
        // White wants higher eval. cpLoss = evalBefore - evalAfter (if positive, they played worse)
        cpLoss = Math.max(0, evalBefore - evalAfterCp);
      } else {
        // Black wants lower eval. cpLoss = evalAfter - evalBefore (if positive, they played worse)
        cpLoss = Math.max(0, evalAfterCp - evalBefore);
      }

      const classification = classifyMove(cpLoss);

      moveEvals.push({
        halfMove,
        moveNum,
        color,
        san,
        fenBefore,
        fenAfter,
        evalBefore,
        evalAfter: evalAfterCp,
        cpLoss,
        classification,
        bestMove: bestMoveStr,
        phase,
      });

      // Update evalBefore for next iteration
      evalBefore = evalAfterCp;
    } else {
      // Opponent's opponent moved — update evalBefore for next iteration
      const evalResult = await getEval(fenAfter, db);
      if (evalResult) {
        evalBefore = evalResult.evalCp;
        positionBudget.used++;
        await new Promise(r => setTimeout(r, API_DELAY_MS));
      }
    }
  }

  if (moveEvals.length === 0) return null;

  const blunderCount = moveEvals.filter(m => m.classification === "blunder").length;
  const mistakeCount = moveEvals.filter(m => m.classification === "mistake").length;
  const inaccuracyCount = moveEvals.filter(m => m.classification === "inaccuracy").length;

  const majorErrors = moveEvals.filter(m =>
    m.classification === "blunder" || m.classification === "mistake"
  );
  const firstMajorError = majorErrors.length > 0 ? majorErrors[0] : null;

  const totalCpLoss = moveEvals.reduce((sum, m) => sum + m.cpLoss, 0);
  const avgCpLoss = moveEvals.length > 0 ? totalCpLoss / moveEvals.length : 0;

  return {
    gameUrl: game.url,
    opponentColor,
    opponentResult,
    eco,
    openingName,
    moves: moveEvals,
    blunderCount,
    mistakeCount,
    inaccuracyCount,
    firstMajorErrorMove: firstMajorError ? firstMajorError.moveNum : null,
    firstMajorErrorPhase: firstMajorError ? firstMajorError.phase : null,
    avgCpLoss: Math.round(avgCpLoss),
  };
}

// ─── Pattern Detection ────────────────────────────────────────────────────────

/**
 * Detect patterns across multiple analyzed games.
 * Returns structured EnginePatterns for use in the prep report.
 */
function detectPatterns(gameResults: GameAnalysisResult[]): EnginePatterns {
  const patterns: EnginePattern[] = [];

  if (gameResults.length === 0) {
    return {
      patterns: [],
      gamesAnalyzed: 0,
      positionsAnalyzed: 0,
      avgBlundersPerGame: 0,
      avgMistakesPerGame: 0,
      worstPhase: "middlegame",
      weakOpenings: [],
    };
  }

  const totalBlunders = gameResults.reduce((s, g) => s + g.blunderCount, 0);
  const totalMistakes = gameResults.reduce((s, g) => s + g.mistakeCount, 0);
  const totalPositions = gameResults.reduce((s, g) => s + g.moves.length, 0);

  const avgBlundersPerGame = totalBlunders / gameResults.length;
  const avgMistakesPerGame = totalMistakes / gameResults.length;

  // Phase distribution of first major errors
  const phaseErrors = { opening: 0, middlegame: 0, endgame: 0 };
  for (const g of gameResults) {
    if (g.firstMajorErrorPhase) {
      phaseErrors[g.firstMajorErrorPhase]++;
    }
  }
  const worstPhase = (Object.entries(phaseErrors).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "middlegame") as "opening" | "middlegame" | "endgame";

  // ── Pattern 1: Opening Blunders ───────────────────────────────────────────
  const openingBlunderGames = gameResults.filter(g =>
    g.moves.some(m => m.phase === "opening" && m.classification === "blunder")
  );
  if (openingBlunderGames.length >= 2) {
    const freq = openingBlunderGames.length;
    const pct = Math.round((freq / gameResults.length) * 100);
    patterns.push({
      patternType: "opening_trap",
      label: "Opening Blunders",
      description: `Makes a major mistake in the opening in ${pct}% of games (${freq}/${gameResults.length}). ` +
        `Sharp, theory-heavy lines will put them under immediate pressure before they can settle into their comfort zone.`,
      frequency: freq,
      totalGames: gameResults.length,
      confidence: freq >= 5 ? "high" : freq >= 3 ? "moderate" : "low",
      severityScore: Math.min(100, pct + 20),
      evidence: openingBlunderGames.slice(0, 3).map(g => ({
        gameUrl: g.gameUrl,
        eco: g.eco,
        phase: "opening",
      })),
    });
  }

  // ── Pattern 2: Tactical Weakness (high blunder rate overall) ─────────────
  if (avgBlundersPerGame >= 0.5) {
    const severity = Math.min(100, Math.round(avgBlundersPerGame * 50));
    patterns.push({
      patternType: "tactical_weakness",
      label: "Tactical Errors",
      description: `Averages ${avgBlundersPerGame.toFixed(1)} blunders per game. ` +
        `Keeping the position complex and tactical will force more of these errors. ` +
        `Avoid simplifying into a quiet position — they play better when things are calm.`,
      frequency: Math.round(avgBlundersPerGame * gameResults.length),
      totalGames: gameResults.length,
      confidence: gameResults.length >= 5 ? "high" : gameResults.length >= 3 ? "moderate" : "low",
      severityScore: severity,
      evidence: gameResults
        .filter(g => g.blunderCount > 0)
        .slice(0, 3)
        .map(g => ({ gameUrl: g.gameUrl, phase: g.firstMajorErrorPhase ?? "middlegame" })),
    });
  }

  // ── Pattern 3: Endgame Weakness ───────────────────────────────────────────
  const endgameBlunderGames = gameResults.filter(g =>
    g.moves.some(m => m.phase === "endgame" && (m.classification === "blunder" || m.classification === "mistake"))
  );
  if (endgameBlunderGames.length >= 2) {
    const freq = endgameBlunderGames.length;
    const pct = Math.round((freq / gameResults.length) * 100);
    patterns.push({
      patternType: "endgame_weakness",
      label: "Endgame Errors",
      description: `Struggles in the endgame in ${pct}% of analyzed games. ` +
        `If you reach a clear advantage, trade pieces and simplify. ` +
        `They tend to make errors when the position becomes technical.`,
      frequency: freq,
      totalGames: gameResults.length,
      confidence: freq >= 5 ? "high" : freq >= 3 ? "moderate" : "low",
      severityScore: Math.min(100, pct + 10),
      evidence: endgameBlunderGames.slice(0, 3).map(g => ({
        gameUrl: g.gameUrl,
        phase: "endgame",
      })),
    });
  }

  // ── Pattern 4: Phase-specific blunder concentration ───────────────────────
  if (phaseErrors[worstPhase] >= 3) {
    const freq = phaseErrors[worstPhase];
    const pct = Math.round((freq / gameResults.length) * 100);
    const phaseLabel = worstPhase.charAt(0).toUpperCase() + worstPhase.slice(1);
    patterns.push({
      patternType: "phase_blunder",
      label: `${phaseLabel} Weakness`,
      description: `First major error occurs in the ${worstPhase} in ${pct}% of games. ` +
        `Focus your preparation on creating pressure specifically in this phase.`,
      frequency: freq,
      totalGames: gameResults.length,
      confidence: freq >= 5 ? "high" : freq >= 3 ? "moderate" : "low",
      severityScore: Math.min(100, pct),
      evidence: gameResults
        .filter(g => g.firstMajorErrorPhase === worstPhase)
        .slice(0, 3)
        .map(g => ({ gameUrl: g.gameUrl, phase: worstPhase })),
    });
  }

  // ── Weak Openings ─────────────────────────────────────────────────────────
  const ecoStats: Record<string, { name: string; blunders: number; games: number }> = {};
  for (const g of gameResults) {
    if (!g.eco) continue;
    if (!ecoStats[g.eco]) {
      ecoStats[g.eco] = { name: g.openingName || g.eco, blunders: 0, games: 0 };
    }
    ecoStats[g.eco].games++;
    ecoStats[g.eco].blunders += g.blunderCount + g.mistakeCount;
  }
  const weakOpenings = Object.entries(ecoStats)
    .filter(([, s]) => s.games >= 2)
    .map(([eco, s]) => ({
      eco,
      name: s.name,
      blunderRate: s.blunders / s.games,
      games: s.games,
    }))
    .filter(o => o.blunderRate >= 0.5)
    .sort((a, b) => b.blunderRate - a.blunderRate)
    .slice(0, 3);

  // ── Pattern 5: Opening-specific traps ─────────────────────────────────────
  for (const opening of weakOpenings) {
    if (opening.games >= 2) {
      patterns.push({
        patternType: "opening_trap",
        label: `Weak in ${opening.name}`,
        description: `Averages ${opening.blunderRate.toFixed(1)} major errors per game when playing the ${opening.name}. ` +
          `Steer the game into this opening if you can — they are statistically likely to go wrong.`,
        frequency: opening.games,
        totalGames: gameResults.length,
        confidence: opening.games >= 5 ? "high" : opening.games >= 3 ? "moderate" : "low",
        severityScore: Math.min(100, Math.round(opening.blunderRate * 60)),
        evidence: [{ eco: opening.eco }],
      });
    }
  }

  // Sort patterns by severity
  patterns.sort((a, b) => b.severityScore - a.severityScore);

  return {
    patterns,
    gamesAnalyzed: gameResults.length,
    positionsAnalyzed: totalPositions,
    avgBlundersPerGame,
    avgMistakesPerGame,
    worstPhase,
    weakOpenings,
  };
}

// ─── Main Analysis Pipeline ───────────────────────────────────────────────────

/**
 * Run the full engine analysis pipeline for an opponent.
 *
 * @param games - Array of chess.com games to analyze (already fetched)
 * @param opponentUsername - The opponent's chess.com username
 * @param db - Database connection
 * @param maxGamesToAnalyze - Max games to run Stockfish on (default: 15)
 * @returns EnginePatterns with detected weaknesses
 */
export async function runEngineAnalysis(
  games: ChessComGame[],
  opponentUsername: string,
  db: Awaited<ReturnType<typeof import("./db.js").getDb>>,
  maxGamesToAnalyze = 15
): Promise<EnginePatterns> {
  if (games.length === 0) {
    return {
      patterns: [],
      gamesAnalyzed: 0,
      positionsAnalyzed: 0,
      avgBlundersPerGame: 0,
      avgMistakesPerGame: 0,
      worstPhase: "middlegame",
      weakOpenings: [],
    };
  }

  // Clear in-memory cache for this run
  inMemoryEvalCache.clear();

  // Prioritize: take the most recent games (already sorted by chess.com API)
  const gamesToAnalyze = games.slice(0, maxGamesToAnalyze);

  const positionBudget = { used: 0, max: MAX_POSITIONS_PER_RUN };
  const gameResults: GameAnalysisResult[] = [];

  for (const game of gamesToAnalyze) {
    if (positionBudget.used >= positionBudget.max) break;
    if (!game.pgn) continue;

    try {
      const result = await analyzeGame(game, opponentUsername, db, positionBudget);
      if (result) {
        gameResults.push(result);

        // Persist to DB (fire-and-forget)
        try {
          const { prepGameAnalysis } = await import("../shared/schema.js");
          await db.insert(prepGameAnalysis).values({
            gameUrl: result.gameUrl,
            opponentUsername: opponentUsername.toLowerCase(),
            opponentColor: result.opponentColor,
            eco: result.eco || null,
            openingName: result.openingName || null,
            movesAnalyzed: result.moves.length,
            blunderCount: result.blunderCount,
            mistakeCount: result.mistakeCount,
            inaccuracyCount: result.inaccuracyCount,
            firstMajorErrorMove: result.firstMajorErrorMove ?? null,
            firstMajorErrorPhase: result.firstMajorErrorPhase ?? null,
            avgCpLoss: result.avgCpLoss,
            opponentResult: result.opponentResult,
            movesJson: JSON.stringify(result.moves.map(m => ({
              move: m.san,
              cpLoss: m.cpLoss,
              classification: m.classification,
              phase: m.phase,
            }))),
          }).onDuplicateKeyUpdate({
            set: {
              blunderCount: result.blunderCount,
              mistakeCount: result.mistakeCount,
              inaccuracyCount: result.inaccuracyCount,
              avgCpLoss: result.avgCpLoss,
              analyzedAt: new Date(),
            },
          });
        } catch {
          // Non-fatal — analysis still succeeds even if DB write fails
        }
      }
    } catch {
      // Skip this game on error, continue with others
    }
  }

  const enginePatterns = detectPatterns(gameResults);

  // Persist pattern summaries to DB (fire-and-forget)
  try {
    const { prepPatternSummary } = await import("../shared/schema.js");
    const { eq, and } = await import("drizzle-orm");
    const lc = opponentUsername.toLowerCase();

    for (const pattern of enginePatterns.patterns) {
      // Delete old pattern of this type for this opponent
      await db.delete(prepPatternSummary)
        .where(and(
          eq(prepPatternSummary.opponentUsername, lc),
          eq(prepPatternSummary.patternType, pattern.patternType)
        ));

      await db.insert(prepPatternSummary).values({
        opponentUsername: lc,
        patternType: pattern.patternType,
        label: pattern.label,
        description: pattern.description,
        frequency: pattern.frequency,
        totalGames: pattern.totalGames,
        confidence: pattern.confidence,
        evidenceJson: JSON.stringify(pattern.evidence),
        severityScore: pattern.severityScore,
      });
    }
  } catch {
    // Non-fatal
  }

  return enginePatterns;
}

/**
 * Load cached engine patterns from the DB for an opponent.
 * Returns null if no cached patterns exist.
 */
export async function loadCachedEnginePatterns(
  opponentUsername: string,
  db: Awaited<ReturnType<typeof import("./db.js").getDb>>,
  maxAgeMs = 24 * 60 * 60 * 1000 // 24h default
): Promise<EnginePatterns | null> {
  try {
    const { prepPatternSummary } = await import("../shared/schema.js");
    const { eq } = await import("drizzle-orm");
    const lc = opponentUsername.toLowerCase();

    const rows = await db.select().from(prepPatternSummary)
      .where(eq(prepPatternSummary.opponentUsername, lc));

    if (rows.length === 0) return null;

    // Check freshness
    const mostRecent = rows.reduce((latest, row) =>
      new Date(row.computedAt) > new Date(latest.computedAt) ? row : latest
    );
    const age = Date.now() - new Date(mostRecent.computedAt).getTime();
    if (age > maxAgeMs) return null;

    const patterns: EnginePattern[] = rows.map(row => ({
      patternType: row.patternType as EnginePattern["patternType"],
      label: row.label,
      description: row.description,
      frequency: row.frequency,
      totalGames: row.totalGames,
      confidence: row.confidence as "high" | "moderate" | "low",
      severityScore: row.severityScore,
      evidence: row.evidenceJson ? JSON.parse(row.evidenceJson) : [],
    }));

    return {
      patterns,
      gamesAnalyzed: rows[0]?.totalGames ?? 0,
      positionsAnalyzed: 0,
      avgBlundersPerGame: 0,
      avgMistakesPerGame: 0,
      worstPhase: "middlegame",
      weakOpenings: [],
    };
  } catch {
    return null;
  }
}
