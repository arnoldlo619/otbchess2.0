/**
 * OTB Chess — Game Recorder API Routes
 *
 * Endpoints:
 *  POST   /api/recordings              — create a new recording session
 *  GET    /api/recordings               — list user's recording sessions
 *  GET    /api/recordings/:id           — get session status & metadata
 *  PATCH  /api/recordings/:id           — update session status
 *  POST   /api/recordings/:id/pgn       — submit manually entered PGN
 *  POST   /api/recordings/:id/analyze   — trigger engine analysis on submitted PGN
 *  GET    /api/games/:id                — get processed game data
 *  GET    /api/games/:id/analysis       — get full move-by-move analysis
 *  POST   /api/games/:id/corrections    — submit move corrections
 */

import { Router } from "express";
import { nanoid } from "nanoid";
import { eq, desc } from "drizzle-orm";
import { getDb } from "./db.js";
import { requireAuth } from "./auth.js";
import {
  recordingSessions,
  processedGames,
  moveAnalyses,
  correctionEntries,
} from "../shared/schema.js";
import { detectOpening, formatOpeningName } from "./openingDetection.js";
import { computePlayerAccuracy, computeBestMoveStreak, accuracyLabel } from "./accuracyCalc.js";

// Chess-API.com Stockfish REST endpoint
const CHESS_API_URL = "https://chess-api.com/v1";

// Move classification thresholds (centipawn loss)
function classifyMove(cpLoss: number): string {
  if (cpLoss <= 0) return "best";
  if (cpLoss <= 30) return "good";
  if (cpLoss <= 100) return "inaccuracy";
  if (cpLoss <= 300) return "mistake";
  return "blunder";
}

// Fetch Stockfish evaluation for a FEN position
async function analyzePosition(
  fen: string,
  depth = 12
): Promise<{
  eval: number;
  bestMove: string;
  winChance: number;
  continuation: string;
  san: string;
} | null> {
  try {
    const res = await fetch(CHESS_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fen, depth, maxThinkingTime: 100 }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, unknown>;
    return {
      eval: (data.eval as number) ?? 0,
      bestMove: (data.move as string) ?? "",
      winChance: (data.winChance as number) ?? 50,
      continuation: Array.isArray(data.continuationArr)
        ? (data.continuationArr as string[]).join(" ")
        : "",
      san: (data.san as string) ?? "",
    };
  } catch (err) {
    console.error("[chess-api] Analysis error:", err);
    return null;
  }
}

export function createRecordingsRouter(): Router {
  const router = Router();

  // All routes require authentication
  router.use(requireAuth);

  // Helper to get userId from req
  const getUserId = (req: import("express").Request): string =>
    (req as import("express").Request & { userId: string }).userId;

  // ── POST /api/recordings — create a new recording session ─────────────────
  router.post("/", async (req, res) => {
    const userId = getUserId(req);
    const { tournamentId } = req.body as { tournamentId?: string };

    try {
      const db = await getDb();
      const id = nanoid();
      await db.insert(recordingSessions).values({
        id,
        userId,
        tournamentId: tournamentId ?? null,
        status: "ready",
      });
      const [session] = await db
        .select()
        .from(recordingSessions)
        .where(eq(recordingSessions.id, id));
      res.status(201).json(session);
    } catch (err) {
      console.error("[recordings] create error:", err);
      res.status(500).json({ error: "Failed to create recording session" });
    }
  });

  // ── GET /api/recordings — list user's recording sessions ──────────────────
  router.get("/", async (req, res) => {
    const userId = getUserId(req);
    try {
      const db = await getDb();
      const sessions = await db
        .select()
        .from(recordingSessions)
        .where(eq(recordingSessions.userId, userId))
        .orderBy(desc(recordingSessions.createdAt));
      res.json(sessions);
    } catch (err) {
      console.error("[recordings] list error:", err);
      res.status(500).json({ error: "Failed to list recording sessions" });
    }
  });

  // ── GET /api/recordings/:id — get session status & metadata ───────────────
  router.get("/:id", async (req, res) => {
    try {
      const db = await getDb();
      const [session] = await db
        .select()
        .from(recordingSessions)
        .where(eq(recordingSessions.id, req.params.id));
      if (!session) return res.status(404).json({ error: "Session not found" });
      // Also fetch the processed game if it exists
      const games = await db
        .select()
        .from(processedGames)
        .where(eq(processedGames.sessionId, session.id));
      res.json({ session, game: games[0] ?? null });
    } catch (err) {
      console.error("[recordings] get error:", err);
      res.status(500).json({ error: "Failed to get recording session" });
    }
  });

  // ── PATCH /api/recordings/:id — update session status ─────────────────────
  router.patch("/:id", async (req, res) => {
    const { status, videoKey } = req.body as {
      status?: string;
      videoKey?: string;
    };
    try {
      const db = await getDb();
      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (status) updates.status = status;
      if (videoKey) updates.videoKey = videoKey;
      await db
        .update(recordingSessions)
        .set(updates)
        .where(eq(recordingSessions.id, req.params.id));
      const [session] = await db
        .select()
        .from(recordingSessions)
        .where(eq(recordingSessions.id, req.params.id));
      res.json(session);
    } catch (err) {
      console.error("[recordings] update error:", err);
      res.status(500).json({ error: "Failed to update recording session" });
    }
  });

  // ── POST /api/recordings/:id/pgn — submit manually entered PGN ───────────
  router.post("/:id/pgn", async (req, res) => {
    const {
      pgn,
      whitePlayer,
      blackPlayer,
      result,
      event,
      date,
      moveTimestamps,
    } = req.body as {
      pgn: string;
      whitePlayer?: string;
      blackPlayer?: string;
      result?: string;
      event?: string;
      date?: string;
      moveTimestamps?: Array<{ moveNumber: number; timestamp: number }>;
    };

    if (!pgn || pgn.trim().length === 0) {
      return res.status(400).json({ error: "PGN is required" });
    }

    try {
      const db = await getDb();

      // Verify session exists
      const [session] = await db
        .select()
        .from(recordingSessions)
        .where(eq(recordingSessions.id, req.params.id));
      if (!session) return res.status(404).json({ error: "Session not found" });

      // Count moves from PGN (rough count: split by move numbers)
      const moveMatches = pgn.match(/\d+\./g);
      const totalMoves = moveMatches ? moveMatches.length : 0;

      // Detect opening using ECO lookup table
      let openingName: string | null = null;
      let openingEco: string | null = null;

      // First check PGN headers (authoritative if present)
      const ecoMatch = pgn.match(/\[ECO\s+"([^"]+)"\]/);
      const openingMatch = pgn.match(/\[Opening\s+"([^"]+)"\]/);
      if (ecoMatch) openingEco = ecoMatch[1];
      if (openingMatch) openingName = openingMatch[1];

      // If not in headers, detect from moves using ECO table
      if (!openingName || !openingEco) {
        try {
          const { Chess: ChessForOpening } = await import("chess.js");
          const chessForOpening = new ChessForOpening();
          const pgnForOpening = pgn.replace(/\[.*?\]\s*/g, "").trim();
          chessForOpening.loadPgn(pgnForOpening);
          const movesForOpening = chessForOpening.history();
          const detected = detectOpening(movesForOpening);
          if (detected) {
            if (!openingEco) openingEco = detected.eco;
            if (!openingName) openingName = detected.variation
              ? `${detected.name}: ${detected.variation}`
              : detected.name;
          }
        } catch {
          // Opening detection is non-critical — ignore errors
        }
      }

      const gameId = nanoid();
      await db.insert(processedGames).values({
        id: gameId,
        sessionId: req.params.id,
        pgn,
        moveTimestamps: moveTimestamps
          ? JSON.stringify(moveTimestamps)
          : null,
        openingName,
        openingEco,
        totalMoves,
        whitePlayer: whitePlayer ?? "White",
        blackPlayer: blackPlayer ?? "Black",
        result: result ?? "*",
        event: event ?? null,
        date: date ?? new Date().toISOString().split("T")[0],
      });

      // Update session status
      await db
        .update(recordingSessions)
        .set({ status: "analyzing", updatedAt: new Date() })
        .where(eq(recordingSessions.id, req.params.id));

      const [game] = await db
        .select()
        .from(processedGames)
        .where(eq(processedGames.id, gameId));

      res.status(201).json(game);
    } catch (err) {
      console.error("[recordings] pgn submit error:", err);
      res.status(500).json({ error: "Failed to save game" });
    }
  });

  // ── POST /api/recordings/:id/analyze — trigger engine analysis ────────────
  router.post("/:id/analyze", async (req, res) => {
    try {
      const db = await getDb();

      // Find the processed game for this session
      const games = await db
        .select()
        .from(processedGames)
        .where(eq(processedGames.sessionId, req.params.id));
      const game = games[0];
      if (!game) {
        return res
          .status(404)
          .json({ error: "No game found. Submit PGN first." });
      }

      // Parse PGN moves using chess.js (dynamic import for ESM compatibility)
      const { Chess } = await import("chess.js");
      const chess = new Chess();

      // Strip PGN headers and load moves
      const pgnMoves = game.pgn
        .replace(/\[.*?\]\s*/g, "")
        .trim();

      try {
        chess.loadPgn(pgnMoves);
      } catch {
        return res.status(400).json({ error: "Invalid PGN format" });
      }

      const history = chess.history({ verbose: true });
      if (history.length === 0) {
        return res.status(400).json({ error: "No moves found in PGN" });
      }

      // Update status to analyzing
      await db
        .update(recordingSessions)
        .set({ status: "analyzing", updatedAt: new Date() })
        .where(eq(recordingSessions.id, req.params.id));

      // Respond immediately — analysis runs async
      res.json({
        ok: true,
        gameId: game.id,
        totalMoves: history.length,
        message: "Analysis started. Poll GET /api/games/:id/analysis for results.",
      });

      // Run analysis in background
      (async () => {
        try {
          const analysisChess = new Chess();
          let prevEval = 0; // starting position is roughly equal

          for (let i = 0; i < history.length; i++) {
            const move = history[i];
            const fenBefore = analysisChess.fen();

            // Get engine evaluation of position BEFORE the move
            const beforeAnalysis = await analyzePosition(fenBefore);

            // Make the move
            analysisChess.move(move.san);
            const fenAfter = analysisChess.fen();

            // Get engine evaluation AFTER the move
            const afterAnalysis = await analyzePosition(fenAfter);

            const evalAfter = afterAnalysis?.eval ?? 0;
            const bestMoveSan = beforeAnalysis?.san ?? "";

            // Calculate centipawn loss
            // For white: loss = bestEval - actualEval (positive = lost advantage)
            // For black: loss = actualEval - bestEval (flip perspective)
            const bestEval = beforeAnalysis?.eval ?? prevEval;
            const cpLoss =
              move.color === "w"
                ? Math.max(0, bestEval - evalAfter)
                : Math.max(0, evalAfter - bestEval);

            const classification = classifyMove(cpLoss);

            const moveNum = Math.floor(i / 2) + 1;

            await db.insert(moveAnalyses).values({
              id: nanoid(),
              gameId: game.id,
              moveNumber: moveNum,
              color: move.color,
              san: move.san,
              fen: fenAfter,
              eval: Math.round(evalAfter * 100), // store as centipawns
              bestMove: bestMoveSan,
              classification,
              winChance: Math.round(afterAnalysis?.winChance ?? 50),
              continuation: afterAnalysis?.continuation ?? "",
            });

            prevEval = evalAfter;

            // Small delay to respect API rate limits
            await new Promise((r) => setTimeout(r, 200));
          }

          // Compute OTB Accuracy Rating using win-probability formula
          const allMoveAnalyses = await db
            .select()
            .from(moveAnalyses)
            .where(eq(moveAnalyses.gameId, game.id))
            .orderBy(moveAnalyses.moveNumber);

          const whiteMoves = allMoveAnalyses.filter((m) => m.color === "w");
          const blackMoves = allMoveAnalyses.filter((m) => m.color === "b");

          const whiteAccuracy = computePlayerAccuracy(
            whiteMoves.map((m) => m.eval),
            "w"
          );
          const blackAccuracy = computePlayerAccuracy(
            blackMoves.map((m) => m.eval),
            "b"
          );

          // Store computed accuracy on the game record
          await db
            .update(processedGames)
            .set({ whiteAccuracy, blackAccuracy })
            .where(eq(processedGames.id, game.id));

          // Update session status to complete
          await db
            .update(recordingSessions)
            .set({ status: "complete", updatedAt: new Date() })
            .where(eq(recordingSessions.id, req.params.id));

          console.log(
            `[recordings] Analysis complete for game ${game.id} (${history.length} moves) — White: ${whiteAccuracy}%, Black: ${blackAccuracy}%`
          );
        } catch (err) {
          console.error("[recordings] Background analysis error:", err);
          await db
            .update(recordingSessions)
            .set({ status: "failed", updatedAt: new Date() })
            .where(eq(recordingSessions.id, req.params.id));
        }
      })();
    } catch (err) {
      console.error("[recordings] analyze error:", err);
      res.status(500).json({ error: "Failed to start analysis" });
    }
  });

  // ── POST /api/recordings/:id/chunk — receive a video chunk ─────────────────
  // Stores chunk metadata; actual bytes stored via multipart form
  router.post("/:id/chunk", async (req, res) => {
    try {
      const db = await getDb();
      const [session] = await db
        .select()
        .from(recordingSessions)
        .where(eq(recordingSessions.id, req.params.id));
      if (!session) return res.status(404).json({ error: "Session not found" });

      // Update status to uploading if still in recording state
      if (session.status === "recording" || session.status === "ready") {
        await db
          .update(recordingSessions)
          .set({ status: "uploading", updatedAt: new Date() })
          .where(eq(recordingSessions.id, req.params.id));
      }

      // In a full implementation, we'd store the chunk to S3 here.
      // For Phase 1, we acknowledge receipt and track chunk count.
      const chunkIndex = Number((req.body as { chunkIndex?: string }).chunkIndex ?? 0);
      console.log(`[recordings] Received chunk ${chunkIndex} for session ${req.params.id}`);

      res.json({ ok: true, chunkIndex });
    } catch (err) {
      console.error("[recordings] chunk error:", err);
      res.status(500).json({ error: "Failed to store chunk" });
    }
  });

  // ── POST /api/recordings/:id/finalize — mark upload complete ─────────────
  router.post("/:id/finalize", async (req, res) => {
    const { chunkCount, durationMs, whitePlayer, blackPlayer } = req.body as {
      chunkCount?: number;
      durationMs?: number;
      whitePlayer?: string;
      blackPlayer?: string;
    };

    try {
      const db = await getDb();
      const [session] = await db
        .select()
        .from(recordingSessions)
        .where(eq(recordingSessions.id, req.params.id));
      if (!session) return res.status(404).json({ error: "Session not found" });

      // Update session to queued state
      await db
        .update(recordingSessions)
        .set({
          status: "queued",
          updatedAt: new Date(),
        })
        .where(eq(recordingSessions.id, req.params.id));

      console.log(
        `[recordings] Finalized session ${req.params.id}: ${chunkCount} chunks, ${durationMs}ms, ${whitePlayer} vs ${blackPlayer}`
      );

      // In Phase 2, this would enqueue a CV processing job.
      // For Phase 1, we prompt the user to enter PGN manually.
      res.json({
        ok: true,
        sessionId: req.params.id,
        status: "queued",
        message: "Recording received. Enter PGN to complete analysis.",
      });
    } catch (err) {
      console.error("[recordings] finalize error:", err);
      res.status(500).json({ error: "Failed to finalize recording" });
    }
  });

  // ── GET /api/games/:id — get processed game data ──────────────────────────────────
  // When mounted at /api/games, the router path is /:id (not /games/:id)
  // When mounted at /api/recordings, this path is unreachable (intentional)
  router.get("/:id", async (req, res) => {
    try {
      const db = await getDb();
      const [game] = await db
        .select()
        .from(processedGames)
        .where(eq(processedGames.id, req.params.id));
      if (!game) return res.status(404).json({ error: "Game not found" });
      res.json(game);
    } catch (err) {
      console.error("[recordings] get game error:", err);
      res.status(500).json({ error: "Failed to get game" });
    }
  });

  // ── GET /api/games/:id/analysis — get full move-by-move analysis ────────────────────
  router.get("/:id/analysis", async (req, res) => {
    try {
      const db = await getDb();
      const [game] = await db
        .select()
        .from(processedGames)
        .where(eq(processedGames.id, req.params.id));
      if (!game) return res.status(404).json({ error: "Game not found" });

      const analyses = await db
        .select()
        .from(moveAnalyses)
        .where(eq(moveAnalyses.gameId, req.params.id))
        .orderBy(moveAnalyses.moveNumber);

      // Calculate summary stats
      const whiteAnalyses = analyses.filter((a) => a.color === "w");
      const blackAnalyses = analyses.filter((a) => a.color === "b");

      const countByClass = (
        arr: typeof analyses,
        cls: string
      ) => arr.filter((a) => a.classification === cls).length;

      // Compute OTB Accuracy Rating using win-probability formula
      const whiteAccuracy = game.whiteAccuracy ??
        computePlayerAccuracy(whiteAnalyses.map((a) => a.eval), "w");
      const blackAccuracy = game.blackAccuracy ??
        computePlayerAccuracy(blackAnalyses.map((a) => a.eval), "b");

      // Compute best-move streaks
      const whiteBestStreak = computeBestMoveStreak(
        whiteAnalyses.map((a) => a.classification)
      );
      const blackBestStreak = computeBestMoveStreak(
        blackAnalyses.map((a) => a.classification)
      );

      const summary = {
        totalMoves: analyses.length,
        white: {
          inaccuracies: countByClass(whiteAnalyses, "inaccuracy"),
          mistakes: countByClass(whiteAnalyses, "mistake"),
          blunders: countByClass(whiteAnalyses, "blunder"),
          bestMoves: countByClass(whiteAnalyses, "best"),
          goodMoves: countByClass(whiteAnalyses, "good"),
          accuracy: whiteAccuracy,
          accuracyLabel: accuracyLabel(whiteAccuracy),
          bestMoveStreak: whiteBestStreak,
        },
        black: {
          inaccuracies: countByClass(blackAnalyses, "inaccuracy"),
          mistakes: countByClass(blackAnalyses, "mistake"),
          blunders: countByClass(blackAnalyses, "blunder"),
          bestMoves: countByClass(blackAnalyses, "best"),
          goodMoves: countByClass(blackAnalyses, "good"),
          accuracy: blackAccuracy,
          accuracyLabel: accuracyLabel(blackAccuracy),
          bestMoveStreak: blackBestStreak,
        },
      };

      // Find key moments (biggest eval swings)
      const keyMoments: Array<{
        moveNumber: number;
        color: string;
        san: string;
        classification: string;
        evalSwing: number;
      }> = [];

      for (let i = 1; i < analyses.length; i++) {
        const prev = analyses[i - 1];
        const curr = analyses[i];
        const swing = Math.abs((curr.eval ?? 0) - (prev.eval ?? 0));
        if (swing > 100) {
          keyMoments.push({
            moveNumber: curr.moveNumber,
            color: curr.color,
            san: curr.san,
            classification: curr.classification ?? "unknown",
            evalSwing: swing,
          });
        }
      }

      // Sort by biggest swing, take top 5
      keyMoments.sort((a, b) => b.evalSwing - a.evalSwing);
      const topMoments = keyMoments.slice(0, 5);

      // Get session to check status
      const [session] = await db
        .select()
        .from(recordingSessions)
        .where(eq(recordingSessions.id, game.sessionId));

      res.json({
        game,
        session: session ?? null,
        analyses,
        summary,
        keyMoments: topMoments,
      });
    } catch (err) {
      console.error("[recordings] get analysis error:", err);
      res.status(500).json({ error: "Failed to get analysis" });
    }
  });

  // ── POST /api/games/:id/corrections — submit move corrections ────────────────────
  router.post("/:id/corrections", async (req, res) => {
    const { corrections } = req.body as {
      corrections: Array<{
        moveNumber: number;
        chosenMove: string;
        skipped?: boolean;
      }>;
    };

    if (!corrections || !Array.isArray(corrections)) {
      return res.status(400).json({ error: "corrections array is required" });
    }

    try {
      const db = await getDb();

      for (const correction of corrections) {
        await db.insert(correctionEntries).values({
          id: nanoid(),
          gameId: req.params.id,
          moveNumber: correction.moveNumber,
          chosenMove: correction.chosenMove,
          skipped: correction.skipped ? 1 : 0,
        });
      }

      res.json({ ok: true, count: corrections.length });
    } catch (err) {
      console.error("[recordings] corrections error:", err);
      res.status(500).json({ error: "Failed to save corrections" });
    }
  });

  return router;
}
