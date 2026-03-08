/**
 * OTB Chess — CV Job Queue
 * ========================
 * Manages the lifecycle of computer-vision processing jobs.
 *
 * A job is created when a video is finalized (POST /api/recordings/:id/finalize).
 * The queue runner picks up pending jobs, spawns the Python CV worker, and on
 * success feeds the reconstructed PGN into the existing Stockfish analysis pipeline.
 *
 * Job lifecycle:
 *   pending → running → complete | failed
 *
 * The queue processes one job at a time to avoid overwhelming the CPU.
 * A polling interval checks for new pending jobs every 10 seconds.
 */

import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getDb } from "./db.js";
import {
  cvJobs,
  recordingSessions,
  processedGames,
  moveAnalyses,
} from "../shared/schema.js";
import { detectOpening } from "./openingDetection.js";
import { computePlayerAccuracy } from "./accuracyCalc.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CV_WORKER_SCRIPT = path.resolve(__dirname, "cv_worker.py");
const PYTHON_BIN = process.env.PYTHON_BIN ?? "python3";
const CHESS_API_URL = "https://chess-api.com/v1";

// ── Queue state ───────────────────────────────────────────────────────────────

let isProcessing = false;
let pollInterval: ReturnType<typeof setInterval> | null = null;

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Enqueue a CV job for a recording session.
 * Creates a cv_jobs row and triggers the queue runner.
 */
export async function enqueueCvJob(sessionId: string, videoPath: string, fenTimelineFile?: string): Promise<string> {
  const db = await getDb();
  const jobId = nanoid();

  await db.insert(cvJobs).values({
    id: jobId,
    sessionId,
    videoPath,
    status: "pending",
    attempts: 0,
    fenTimelineFile: fenTimelineFile ?? null,
  });

  console.log(`[cv-queue] Enqueued job ${jobId} for session ${sessionId}`);

  // Trigger processing immediately (non-blocking)
  setImmediate(() => processNextJob());

  return jobId;
}

/**
 * Start the background polling loop.
 * Call once at server startup to pick up any jobs that survived a restart.
 */
export function startCvJobQueue(): void {
  if (pollInterval) return;

  pollInterval = setInterval(() => {
    if (!isProcessing) {
      processNextJob().catch((err) =>
        console.error("[cv-queue] Poll error:", err)
      );
    }
  }, 10_000); // Check every 10 seconds

  console.log("[cv-queue] Job queue started (polling every 10s)");
}

/**
 * Stop the background polling loop.
 */
export function stopCvJobQueue(): void {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
    console.log("[cv-queue] Job queue stopped");
  }
}

// ── Job Processing ────────────────────────────────────────────────────────────

async function processNextJob(): Promise<void> {
  if (isProcessing) return;

  const db = await getDb();

  // Find the oldest pending job
  const [job] = await db
    .select()
    .from(cvJobs)
    .where(eq(cvJobs.status, "pending"))
    .orderBy(cvJobs.createdAt)
    .limit(1);

  if (!job) return;

  isProcessing = true;

  try {
    await runCvJob(job.id, job.sessionId, job.videoPath, job.fenTimelineFile ?? null, job.attempts ?? 0);
  } catch (err) {
    console.error(`[cv-queue] Unhandled error processing job ${job.id}:`, err);
  } finally {
    isProcessing = false;
  }
}

async function runCvJob(
  jobId: string,
  sessionId: string,
  videoPath: string,
  fenTimelineFile: string | null,
  attempts: number
): Promise<void> {
  const db = await getDb();

  console.log(`[cv-queue] Starting job ${jobId} (attempt ${attempts + 1})`);

  // Mark as running
  await db
    .update(cvJobs)
    .set({ status: "running", startedAt: new Date(), attempts: attempts + 1 })
    .where(eq(cvJobs.id, jobId));

  await db
    .update(recordingSessions)
    .set({ status: "processing", updatedAt: new Date() })
    .where(eq(recordingSessions.id, sessionId));

  // ── Spawn Python CV worker ────────────────────────────────────────────────
  let cvResult: CvWorkerResult;
  try {
    cvResult = await spawnCvWorker(videoPath, fenTimelineFile ?? undefined, jobId);
  } catch (spawnErr) {
    const errMsg = spawnErr instanceof Error ? spawnErr.message : String(spawnErr);
    console.error(`[cv-queue] CV worker spawn error for job ${jobId}:`, errMsg);

    await db
      .update(cvJobs)
      .set({ status: "failed", errorMessage: errMsg, completedAt: new Date() })
      .where(eq(cvJobs.id, jobId));

    // Fall back to "queued" so user can enter PGN manually
    await db
      .update(recordingSessions)
      .set({ status: "queued", updatedAt: new Date() })
      .where(eq(recordingSessions.id, sessionId));

    return;
  }

  // ── Handle CV failure ─────────────────────────────────────────────────────
  if (!cvResult.pgn || cvResult.error) {
    const errMsg = cvResult.error ?? "CV worker produced no PGN";
    console.warn(`[cv-queue] Job ${jobId} failed: ${errMsg}`);

    await db
      .update(cvJobs)
      .set({
        status: "failed",
        errorMessage: errMsg,
        framesProcessed: cvResult.framesProcessed,
        totalFrames: cvResult.totalFrames,
        completedAt: new Date(),
      })
      .where(eq(cvJobs.id, jobId));

    // Fall back to "queued" so user can enter PGN manually
    await db
      .update(recordingSessions)
      .set({ status: "queued", updatedAt: new Date() })
      .where(eq(recordingSessions.id, sessionId));

    return;
  }

  console.log(
    `[cv-queue] Job ${jobId} succeeded: ${cvResult.moveTimeline.length} moves reconstructed from ${cvResult.framesProcessed} frames`
  );

  // ── Store CV results ──────────────────────────────────────────────────────
  await db
    .update(cvJobs)
    .set({
      status: "complete",
      reconstructedPgn: cvResult.pgn,
      moveTimeline: JSON.stringify(cvResult.moveTimeline),
      framesProcessed: cvResult.framesProcessed,
      totalFrames: cvResult.totalFrames,
      completedAt: new Date(),
    })
    .where(eq(cvJobs.id, jobId));

  // ── Create processed_game row ─────────────────────────────────────────────
  const { Chess } = await import("chess.js");
  const chess = new Chess();

  let pgnMoves = cvResult.pgn.replace(/\[.*?\]\s*/g, "").trim();
  try {
    chess.loadPgn(pgnMoves);
  } catch {
    // If full PGN fails, try loading just the moves part
    try {
      chess.loadPgn(pgnMoves.replace(/\{[^}]*\}/g, ""));
    } catch {
      console.warn(`[cv-queue] Could not parse reconstructed PGN for job ${jobId}`);
      await db
        .update(recordingSessions)
        .set({ status: "queued", updatedAt: new Date() })
        .where(eq(recordingSessions.id, sessionId));
      return;
    }
  }

  const history = chess.history({ verbose: true });
  const totalMoves = history.length;

  // Detect opening
  let openingName: string | null = null;
  let openingEco: string | null = null;
  try {
    // detectOpening expects an array of SAN move strings
    const moveSans = history.map((m) => m.san);
    const opening = detectOpening(moveSans);
    if (opening) {
      openingName = opening.name;
      openingEco = opening.eco;
    }
  } catch {
    // Opening detection failure is non-fatal
  }

  // Determine result from final board state
  let result = "*";
  if (chess.isCheckmate()) {
    result = chess.turn() === "w" ? "0-1" : "1-0";
  } else if (chess.isDraw()) {
    result = "1/2-1/2";
  }

  // Extract player names from PGN headers if present
  const whiteMatch = cvResult.pgn.match(/\[White "([^"]+)"\]/);
  const blackMatch = cvResult.pgn.match(/\[Black "([^"]+)"\]/);
  const whitePlayer = whiteMatch?.[1] ?? "?";
  const blackPlayer = blackMatch?.[1] ?? "?";

  // Delete any existing processed game for this session (re-processing case)
  const existingGames = await db
    .select()
    .from(processedGames)
    .where(eq(processedGames.sessionId, sessionId));

  if (existingGames.length > 0) {
    for (const g of existingGames) {
      await db.delete(moveAnalyses).where(eq(moveAnalyses.gameId, g.id));
    }
    await db.delete(processedGames).where(eq(processedGames.sessionId, sessionId));
  }

  const gameId = nanoid();
  await db.insert(processedGames).values({
    id: gameId,
    sessionId,
    pgn: cvResult.pgn,
    moveTimestamps: JSON.stringify(cvResult.moveTimeline),
    openingName,
    openingEco,
    totalMoves,
    whitePlayer,
    blackPlayer,
    result,
    event: "OTB Game (Auto-Reconstructed)",
    date: new Date().toISOString().slice(0, 10).replace(/-/g, "."),
    isPublic: 0,
  });

  // ── Trigger Stockfish analysis ────────────────────────────────────────────
  await db
    .update(recordingSessions)
    .set({ status: "analyzing", updatedAt: new Date() })
    .where(eq(recordingSessions.id, sessionId));

  // Run analysis in background (same pattern as the manual PGN analyze endpoint)
  runStockfishAnalysis(sessionId, gameId, history).catch((err) => {
    console.error(`[cv-queue] Stockfish analysis error for game ${gameId}:`, err);
  });
}

// ── Python CV Worker Spawner ──────────────────────────────────────────────────

interface CvWorkerResult {
  pgn: string;
  moveTimeline: Array<{ moveNumber: number; timestampMs: number; confidence: number }>;
  framesProcessed: number;
  totalFrames: number;
  error: string | null;
  warnings: string[];
}

function spawnCvWorker(videoPath: string, fenTimelineFile?: string, jobId?: string): Promise<CvWorkerResult> {
  return new Promise((resolve, reject) => {
    const args = [CV_WORKER_SCRIPT, videoPath, "--fps-sample", "0.5", "--confidence", "0.45"];
    if (fenTimelineFile) {
      args.push("--fen-timeline-file", fenTimelineFile);
    }
    if (jobId) {
      args.push("--job-id", jobId);
    }

    console.log(`[cv-queue] Spawning: ${PYTHON_BIN} ${args.join(" ")}`);

    const proc = spawn(PYTHON_BIN, args, {
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 30 * 60 * 1000, // 30 minute timeout
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
    proc.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });

    proc.on("error", (err) => {
      reject(new Error(`Failed to spawn Python worker: ${err.message}`));
    });

    proc.on("close", (code) => {
      if (stderr) {
        console.warn(`[cv-queue] Python stderr:\n${stderr.slice(0, 500)}`);
      }

      if (!stdout.trim()) {
        reject(new Error(`CV worker produced no output (exit code ${code})`));
        return;
      }

      try {
        const result = JSON.parse(stdout.trim()) as CvWorkerResult;
        resolve(result);
      } catch (parseErr) {
        reject(new Error(`CV worker output is not valid JSON: ${stdout.slice(0, 200)}`));
      }
    });
  });
}

// ── Stockfish Analysis ────────────────────────────────────────────────────────

type VerboseMove = {
  color: "w" | "b";
  san: string;
  before: string;
  after: string;
  piece: string;
  from: string;
  to: string;
};

async function runStockfishAnalysis(
  sessionId: string,
  gameId: string,
  history: VerboseMove[]
): Promise<void> {
  const db = await getDb();

  try {
    const { Chess } = await import("chess.js");
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
    const allAnalyses = await db
      .select()
      .from(moveAnalyses)
      .where(eq(moveAnalyses.gameId, gameId))
      .orderBy(moveAnalyses.moveNumber);

    const whiteMoves = allAnalyses.filter((m) => m.color === "w");
    const blackMoves = allAnalyses.filter((m) => m.color === "b");

    const whiteAccuracy = computePlayerAccuracy(whiteMoves.map((m) => m.eval ?? 0), "w");
    const blackAccuracy = computePlayerAccuracy(blackMoves.map((m) => m.eval ?? 0), "b");

    await db
      .update(processedGames)
      .set({ whiteAccuracy, blackAccuracy })
      .where(eq(processedGames.id, gameId));

    await db
      .update(recordingSessions)
      .set({ status: "complete", updatedAt: new Date() })
      .where(eq(recordingSessions.id, sessionId));

    console.log(
      `[cv-queue] Analysis complete for game ${gameId} — White: ${whiteAccuracy}%, Black: ${blackAccuracy}%`
    );
  } catch (err) {
    console.error(`[cv-queue] Stockfish analysis failed for game ${gameId}:`, err);
    await db
      .update(recordingSessions)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(recordingSessions.id, sessionId));
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function classifyMove(cpLoss: number): string {
  if (cpLoss <= 0) return "best";
  if (cpLoss <= 30) return "good";
  if (cpLoss <= 100) return "inaccuracy";
  if (cpLoss <= 300) return "mistake";
  return "blunder";
}

async function analyzePosition(
  fen: string,
  depth = 12
): Promise<{ eval: number; bestMove: string; winChance: number; continuation: string; san: string } | null> {
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
  } catch {
    return null;
  }
}
