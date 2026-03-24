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
 *  POST   /api/recordings/:id/chunk     — upload a video chunk (multipart/form-data)
 *  POST   /api/recordings/:id/finalize  — concatenate chunks into final video
 *  GET    /api/recordings/:id/video     — stream the final video file
 *  GET    /api/games/:id                — get processed game data
 *  GET    /api/games/:id/analysis       — get full move-by-move analysis
 *  POST   /api/games/:id/corrections    — submit move corrections
 */

import { Router } from "express";
import { nanoid } from "nanoid";
import { eq, desc, inArray, asc } from "drizzle-orm";
import { getDb } from "./db.js";
import { requireAuth } from "./auth.js";
import {
  recordingSessions,
  processedGames,
  moveAnalyses,
  correctionEntries,
  videoChunks,
  cvJobs,
} from "../shared/schema.js";
import { detectOpening, formatOpeningName } from "./openingDetection.js";
import { computePlayerAccuracy, computeBestMoveStreak, accuracyLabel } from "./accuracyCalc.js";
import { enqueueCvJob } from "./cvJobQueue.js";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Upload directory for video chunks ────────────────────────────────────────
const UPLOADS_DIR = path.resolve(__dirname, "../uploads/video-chunks");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// ── Multer storage: saves each chunk as <sessionId>-chunk-<index>.<ext> ──────
const chunkStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const sessionId = (req.params as { id: string }).id;
    const chunkIndex = (req.body as { chunkIndex?: string }).chunkIndex ?? "0";
    const ext = file.mimetype.includes("mp4") ? "mp4" : "webm";
    cb(null, `${sessionId}-chunk-${String(chunkIndex).padStart(5, "0")}.${ext}`);
  },
});

const uploadChunk = multer({
  storage: chunkStorage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB per chunk
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("video/")) {
      cb(null, true);
    } else {
      cb(new Error("Only video files are accepted"));
    }
  },
}).single("chunk");

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

  // ── GET /api/games (list) — user's analyzed games ──────────────────────────
  // This route is only reachable when the router is mounted at /api/games.
  // Returns processed_games joined with session status, ordered by most recent.
  router.get("/", async (req, res) => {
    const userId = getUserId(req);
    try {
      const db = await getDb();

      // Fetch all recording sessions for this user
      const sessions = await db
        .select()
        .from(recordingSessions)
        .where(eq(recordingSessions.userId, userId))
        .orderBy(desc(recordingSessions.createdAt));

      if (sessions.length === 0) {
        return res.json([]);
      }

      const sessionIds = sessions.map((s) => s.id);

      // Fetch all processed games for those sessions
      const games = await db
        .select()
        .from(processedGames)
        .where(inArray(processedGames.sessionId, sessionIds))
        .orderBy(desc(processedGames.createdAt));

      // Attach session status to each game
      const sessionMap = new Map(sessions.map((s) => [s.id, s]));
      const result = games.map((g) => ({
        ...g,
        sessionStatus: sessionMap.get(g.sessionId)?.status ?? "unknown",
      }));

      res.json(result);
    } catch (err) {
      console.error("[recordings] list games error:", err);
      res.status(500).json({ error: "Failed to list games" });
    }
  });

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

      // Fetch latest CV job for this session (if any) to surface errors
      let cvJobInfo: {
        status: string;
        errorMessage: string | null;
        attempts: number | null;
      } | null = null;
      try {
        const cvJobRows = await db
          .select({
            status: cvJobs.status,
            errorMessage: cvJobs.errorMessage,
            attempts: cvJobs.attempts,
          })
          .from(cvJobs)
          .where(eq(cvJobs.sessionId, session.id))
          .orderBy(desc(cvJobs.createdAt))
          .limit(1);
        if (cvJobRows.length > 0) {
          cvJobInfo = cvJobRows[0];
        }
      } catch {
        // Non-critical — don't fail the whole request if cv_jobs query fails
      }

      res.json({ session, game: games[0] ?? null, cvJob: cvJobInfo });
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
  // Accepts multipart/form-data with a "chunk" file field.
  // Saves the bytes to disk and records the chunk in the video_chunks table.
  router.post("/:id/chunk", (req, res) => {
    // Run multer middleware first to parse the multipart body
    uploadChunk(req, res, async (multerErr) => {
      if (multerErr) {
        console.error("[recordings] multer error:", multerErr);
        return res.status(400).json({ error: multerErr.message ?? "Upload error" });
      }

      try {
        const db = await getDb();
        const [session] = await db
          .select()
          .from(recordingSessions)
          .where(eq(recordingSessions.id, req.params.id));
        if (!session) {
          // Clean up the uploaded file if session not found
          if (req.file) fs.unlink(req.file.path, () => {});
          return res.status(404).json({ error: "Session not found" });
        }

        // Update status to uploading if still in recording/ready state
        if (session.status === "recording" || session.status === "ready") {
          await db
            .update(recordingSessions)
            .set({ status: "uploading", updatedAt: new Date() })
            .where(eq(recordingSessions.id, req.params.id));
        }

        const chunkIndex = Number((req.body as { chunkIndex?: string }).chunkIndex ?? 0);

        if (req.file) {
          // Record the chunk in the database
          await db.insert(videoChunks).values({
            id: nanoid(),
            sessionId: req.params.id,
            chunkIndex,
            filePath: req.file.path,
            sizeBytes: req.file.size,
            mimeType: req.file.mimetype,
          });
          console.log(
            `[recordings] Stored chunk ${chunkIndex} for session ${req.params.id} — ${req.file.size} bytes → ${req.file.path}`
          );
        } else {
          // No file attached — still acknowledge (client may retry)
          console.warn(`[recordings] Chunk ${chunkIndex} for session ${req.params.id} had no file attached`);
        }

        res.json({ ok: true, chunkIndex, stored: !!req.file });
      } catch (err) {
        console.error("[recordings] chunk error:", err);
        // Clean up file on DB error
        if (req.file) fs.unlink(req.file.path, () => {});
        res.status(500).json({ error: "Failed to store chunk" });
      }
    });
  });

    // ── POST /api/recordings/:id/finalize — concatenate chunks into final video ───
  // 1. Fetches all stored chunks for the session, ordered by chunkIndex.
  // 2. Writes an ffmpeg concat list file.
  // 3. Runs ffmpeg to merge chunks into a single .webm file.
  // 4. Stores the final video path as videoKey on the session.
  // 5. Cleans up individual chunk files.
  router.post("/:id/finalize", async (req, res) => {
    const { chunkCount, durationMs, whitePlayer, blackPlayer, fenTimeline, boardCorners } = req.body as {
      chunkCount?: number;
      durationMs?: number;
      whitePlayer?: string;
      blackPlayer?: string;
      fenTimeline?: Array<{ timestampMs: number; fen: string; confidence: number; pieceCount: number }>;
      boardCorners?: Array<{ x: number; y: number }>;
    };

    try {
      const db = await getDb();
      const [session] = await db
        .select()
        .from(recordingSessions)
        .where(eq(recordingSessions.id, req.params.id));
      if (!session) return res.status(404).json({ error: "Session not found" });

      // Fetch all chunks for this session, ordered by chunkIndex
      const chunks = await db
        .select()
        .from(videoChunks)
        .where(eq(videoChunks.sessionId, req.params.id))
        .orderBy(asc(videoChunks.chunkIndex));

      console.log(
        `[recordings] Finalizing session ${req.params.id}: ${chunks.length} DB chunks, ${chunkCount} reported, ${durationMs}ms`
      );

      // Mark session as processing while we concatenate
      await db
        .update(recordingSessions)
        .set({ status: "processing", updatedAt: new Date() })
        .where(eq(recordingSessions.id, req.params.id));

      // Respond immediately so the client can start polling
      res.json({
        ok: true,
        sessionId: req.params.id,
        status: "processing",
        chunkCount: chunks.length,
        message: "Video processing started.",
      });

      // ── Background: concatenate chunks with ffmpeg ───────────────────────────
      (async () => {
        try {
          if (chunks.length === 0) {
            // No chunks uploaded — mark as queued for manual PGN entry
            await db
              .update(recordingSessions)
              .set({ status: "queued", updatedAt: new Date() })
              .where(eq(recordingSessions.id, req.params.id));
            return;
          }

          // Verify all chunk files exist on disk
          const existingChunks = chunks.filter((c) => {
            try { return fs.existsSync(c.filePath); } catch { return false; }
          });

          if (existingChunks.length === 0) {
            console.error(`[recordings] No chunk files found on disk for session ${req.params.id}`);
            await db
              .update(recordingSessions)
              .set({ status: "queued", updatedAt: new Date() })
              .where(eq(recordingSessions.id, req.params.id));
            return;
          }

          const outputPath = path.join(UPLOADS_DIR, `${req.params.id}-final.webm`);

          if (existingChunks.length === 1) {
            // Single chunk — just rename/copy it
            fs.copyFileSync(existingChunks[0].filePath, outputPath);
          } else {
            // Multiple chunks — use ffmpeg concat demuxer
            const concatListPath = path.join(UPLOADS_DIR, `${req.params.id}-concat.txt`);
            const concatContent = existingChunks
              .map((c) => `file '${c.filePath.replace(/'/g, "'\\''")}' `)
              .join("\n");
            fs.writeFileSync(concatListPath, concatContent, "utf8");

            try {
              await execFileAsync("ffmpeg", [
                "-y",                    // overwrite output
                "-f", "concat",          // use concat demuxer
                "-safe", "0",            // allow absolute paths
                "-i", concatListPath,    // input list
                "-c", "copy",            // stream copy (no re-encode)
                outputPath,
              ]);
            } finally {
              // Always clean up the concat list
              fs.unlink(concatListPath, () => {});
            }
          }

          // Store the final video path as videoKey
          await db
            .update(recordingSessions)
            .set({
              videoKey: outputPath,
              status: "processing",
              updatedAt: new Date(),
            })
            .where(eq(recordingSessions.id, req.params.id));

          console.log(`[recordings] Concatenated ${existingChunks.length} chunks → ${outputPath}`);

          // Write fenTimeline seed to a temp file if provided
          let fenTimelineFile: string | undefined;
          if (fenTimeline && Array.isArray(fenTimeline) && fenTimeline.length > 0) {
            try {
              fenTimelineFile = path.join(UPLOADS_DIR, `${req.params.id}-fen-timeline.json`);
              fs.writeFileSync(fenTimelineFile, JSON.stringify(fenTimeline), "utf8");
              console.log(`[recordings] Saved client FEN timeline (${fenTimeline.length} entries) to ${fenTimelineFile}`);
            } catch (writeErr) {
              console.warn(`[recordings] Could not write FEN timeline file:`, writeErr);
              fenTimelineFile = undefined;
            }
          }

          // Write manual board corners to a temp file if provided
          let cornersFile: string | undefined;
          if (boardCorners && Array.isArray(boardCorners) && boardCorners.length === 4) {
            try {
              cornersFile = path.join(UPLOADS_DIR, `${req.params.id}-corners.json`);
              const cornersArray = boardCorners.map(c => [c.x, c.y]);
              fs.writeFileSync(cornersFile, JSON.stringify(cornersArray), "utf8");
              console.log(`[recordings] Saved manual board corners to ${cornersFile}`);
            } catch (writeErr) {
              console.warn(`[recordings] Could not write corners file:`, writeErr);
              cornersFile = undefined;
            }
          }

          // Enqueue CV job to automatically reconstruct PGN from video
          try {
            await enqueueCvJob(req.params.id, outputPath, fenTimelineFile, cornersFile);
            console.log(`[recordings] CV job enqueued for session ${req.params.id}`);
          } catch (queueErr) {
            console.error(`[recordings] Failed to enqueue CV job:`, queueErr);
            // Fall back to queued so user can enter PGN manually
            await db
              .update(recordingSessions)
              .set({ status: "queued", updatedAt: new Date() })
              .where(eq(recordingSessions.id, req.params.id))
              .catch(() => {});
          }

          // Clean up individual chunk files
          for (const chunk of existingChunks) {
            fs.unlink(chunk.filePath, (err) => {
              if (err) console.warn(`[recordings] Could not delete chunk file ${chunk.filePath}:`, err.message);
            });
          }
        } catch (ffmpegErr) {
          console.error("[recordings] ffmpeg concatenation error:", ffmpegErr);
          // Fall back to queued state so user can still enter PGN manually
          await db
            .update(recordingSessions)
            .set({ status: "queued", updatedAt: new Date() })
            .where(eq(recordingSessions.id, req.params.id))
            .catch(() => {});
        }
      })();
    } catch (err) {
      console.error("[recordings] finalize error:", err);
      res.status(500).json({ error: "Failed to finalize recording" });
    }
  });

  // ── GET /api/recordings/:id/cv-job — real-time CV job progress ────────────
  // Returns framesProcessed, totalFrames, pct (0-100), and job status so the
  // processing screen can show a real percentage instead of a static spinner.
  router.get("/:id/cv-job", requireAuth, async (req, res) => {
    try {
      const db = await getDb();

      // Verify the session exists
      const [session] = await db
        .select({ id: recordingSessions.id, status: recordingSessions.status })
        .from(recordingSessions)
        .where(eq(recordingSessions.id, req.params.id));
      if (!session) return res.status(404).json({ error: "Session not found" });

      // Fetch the most recent CV job for this session
      const [job] = await db
        .select({
          id: cvJobs.id,
          status: cvJobs.status,
          framesProcessed: cvJobs.framesProcessed,
          totalFrames: cvJobs.totalFrames,
          errorMessage: cvJobs.errorMessage,
          startedAt: cvJobs.startedAt,
          completedAt: cvJobs.completedAt,
          lastFen: cvJobs.lastFen,
          stablePositions: cvJobs.stablePositions,
        })
        .from(cvJobs)
        .where(eq(cvJobs.sessionId, req.params.id))
        .orderBy(desc(cvJobs.createdAt))
        .limit(1);

      if (!job) {
        // No CV job yet — session may still be uploading / concatenating
        return res.json({
          jobFound: false,
          sessionStatus: session.status,
          framesProcessed: 0,
          totalFrames: 0,
          pct: 0,
          status: session.status,
        });
      }

      const framesProcessed = job.framesProcessed ?? 0;
      const totalFrames = job.totalFrames ?? 0;
      const pct =
        totalFrames > 0
          ? Math.min(100, Math.round((framesProcessed / totalFrames) * 100))
          : job.status === "complete"
            ? 100
            : job.status === "running"
              ? 5 // show at least 5% so the bar is visible from the start
              : 0;

      res.json({
        jobFound: true,
        sessionStatus: session.status,
        jobId: job.id,
        status: job.status,
        framesProcessed,
        totalFrames,
        pct,
        errorMessage: job.errorMessage ?? null,
        startedAt: job.startedAt ?? null,
        completedAt: job.completedAt ?? null,
        lastFen: job.lastFen ?? null,
        stablePositions: job.stablePositions ?? 0,
      });
    } catch (err) {
      console.error("[recordings] cv-job progress error:", err);
      res.status(500).json({ error: "Failed to get CV job progress" });
    }
  });

  // ── GET /api/recordings/:id/video — stream the final video file ────────────
  // Returns the concatenated video for the session. Supports Range requests
  // for seek-ahead in the analysis page video player.
  router.get("/:id/video", requireAuth, async (req, res) => {
    try {
      const db = await getDb();
      const [session] = await db
        .select()
        .from(recordingSessions)
        .where(eq(recordingSessions.id, req.params.id));
      if (!session) return res.status(404).json({ error: "Session not found" });
      if (!session.videoKey) return res.status(404).json({ error: "No video available" });

      const videoPath = session.videoKey;
      if (!fs.existsSync(videoPath)) {
        return res.status(404).json({ error: "Video file not found" });
      }

      const stat = fs.statSync(videoPath);
      const fileSize = stat.size;
      const rangeHeader = req.headers.range;

      if (rangeHeader) {
        // Handle Range request for seeking
        const parts = rangeHeader.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunkSize = end - start + 1;

        res.writeHead(206, {
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunkSize,
          "Content-Type": "video/webm",
        });
        fs.createReadStream(videoPath, { start, end }).pipe(res);
      } else {
        // Full file response
        res.writeHead(200, {
          "Content-Length": fileSize,
          "Content-Type": "video/webm",
          "Accept-Ranges": "bytes",
        });
        fs.createReadStream(videoPath).pipe(res);
      }
    } catch (err) {
      console.error("[recordings] video stream error:", err);
      res.status(500).json({ error: "Failed to stream video" });
    }
  });

  // ── POST /api/games/from-pgn — one-shot LNM → analysis pipeline ─────────────────
  // Creates a recording session, submits the PGN, triggers async Stockfish analysis,
  // and returns { sessionId, gameId } so the caller can navigate to /game/:gameId/analysis.
  // This endpoint is only reachable when the router is mounted at /api/games.
  router.post("/from-pgn", async (req, res) => {
    const userId = getUserId(req);
    const {
      pgn,
      whitePlayer,
      blackPlayer,
      result,
      event,
      date,
    } = req.body as {
      pgn: string;
      whitePlayer?: string;
      blackPlayer?: string;
      result?: string;
      event?: string;
      date?: string;
    };

    if (!pgn || pgn.trim().length === 0) {
      return res.status(400).json({ error: "PGN is required" });
    }

    try {
      const db = await getDb();

      // 1. Create a recording session
      const sessionId = nanoid();
      await db.insert(recordingSessions).values({
        id: sessionId,
        userId,
        status: "ready",
      });

      // 2. Detect opening
      let openingName: string | null = null;
      let openingEco: string | null = null;
      const ecoMatch = pgn.match(/\[ECO\s+"([^"]+)"\]/);
      const openingMatch = pgn.match(/\[Opening\s+"([^"]+)"\]/);
      if (ecoMatch) openingEco = ecoMatch[1];
      if (openingMatch) openingName = openingMatch[1];

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
          // Opening detection is non-critical
        }
      }

      // 3. Count moves
      const moveMatches = pgn.match(/\d+\./g);
      const totalMoves = moveMatches ? moveMatches.length : 0;

      // 4. Create processed game record
      const gameId = nanoid();
      await db.insert(processedGames).values({
        id: gameId,
        sessionId,
        pgn,
        openingName,
        openingEco,
        totalMoves,
        whitePlayer: whitePlayer ?? "White",
        blackPlayer: blackPlayer ?? "Black",
        result: result ?? "*",
        event: event ?? "OTB Battle",
        date: date ?? new Date().toISOString().split("T")[0],
      });

      // 5. Update session to analyzing
      await db
        .update(recordingSessions)
        .set({ status: "analyzing", updatedAt: new Date() })
        .where(eq(recordingSessions.id, sessionId));

      // 6. Respond immediately with IDs
      res.status(201).json({ sessionId, gameId });

      // 7. Trigger Stockfish analysis in background
      (async () => {
        try {
          const { Chess } = await import("chess.js");
          const chess = new Chess();
          const pgnMoves = pgn.replace(/\[.*?\]\s*/g, "").trim();
          chess.loadPgn(pgnMoves);
          const history = chess.history({ verbose: true });
          if (history.length === 0) return;

          const analysisChess = new Chess();
          let prevEval = 0;

          for (let i = 0; i < history.length; i++) {
            const move = history[i];
            const fenBefore = analysisChess.fen();
            const beforeAnalysis = await analyzePosition(fenBefore);
            analysisChess.move(move.san);
            const fenAfter = analysisChess.fen();
            const afterAnalysis = await analyzePosition(fenAfter);
            const evalAfter = afterAnalysis?.eval ?? 0;
            const bestMoveSan = beforeAnalysis?.san ?? "";
            const bestEval = beforeAnalysis?.eval ?? prevEval;
            const cpLoss =
              move.color === "w"
                ? Math.max(0, bestEval - evalAfter)
                : Math.max(0, evalAfter - bestEval);
            const classification = classifyMove(cpLoss);
            const moveNum = Math.floor(i / 2) + 1;

            await db.insert(moveAnalyses).values({
              id: nanoid(),
              gameId,
              moveNumber: moveNum,
              color: move.color,
              san: move.san,
              fen: fenAfter,
              eval: Math.round(evalAfter * 100),
              bestMove: bestMoveSan,
              classification,
              winChance: Math.round(afterAnalysis?.winChance ?? 50),
              continuation: afterAnalysis?.continuation ?? "",
            });

            prevEval = evalAfter;
            await new Promise((r) => setTimeout(r, 200));
          }

          // Compute accuracy
          const allMoveAnalyses = await db
            .select()
            .from(moveAnalyses)
            .where(eq(moveAnalyses.gameId, gameId))
            .orderBy(moveAnalyses.moveNumber);

          const whiteMoves = allMoveAnalyses.filter((m) => m.color === "w");
          const blackMoves = allMoveAnalyses.filter((m) => m.color === "b");
          const whiteAccuracy = computePlayerAccuracy(whiteMoves.map((m) => m.eval), "w");
          const blackAccuracy = computePlayerAccuracy(blackMoves.map((m) => m.eval), "b");

          await db
            .update(processedGames)
            .set({ whiteAccuracy, blackAccuracy })
            .where(eq(processedGames.id, gameId));

          await db
            .update(recordingSessions)
            .set({ status: "complete", updatedAt: new Date() })
            .where(eq(recordingSessions.id, sessionId));

          console.log(`[games/from-pgn] Analysis complete for game ${gameId} — White: ${whiteAccuracy}%, Black: ${blackAccuracy}%`);
        } catch (err) {
          console.error("[games/from-pgn] Background analysis error:", err);
          await db
            .update(recordingSessions)
            .set({ status: "failed", updatedAt: new Date() })
            .where(eq(recordingSessions.id, sessionId))
            .catch(() => {});
        }
      })();
    } catch (err) {
      console.error("[games/from-pgn] error:", err);
      res.status(500).json({ error: "Failed to create game from PGN" });
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

      // Parse fenTimeline from JSON string
      let fenTimeline: Array<{ timestampMs: number; fen: string; confidence: number }> = [];
      if (game.fenTimeline) {
        try {
          fenTimeline = JSON.parse(game.fenTimeline);
        } catch {
          fenTimeline = [];
        }
      }

      res.json({
        game,
        session: session ?? null,
        analyses,
        summary,
        keyMoments: topMoments,
        fenTimeline,
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
