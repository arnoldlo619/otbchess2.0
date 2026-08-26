/**
 * OTB Chess — Live Broadcast API
 *
 * Routes:
 *  POST   /api/broadcasts                     — create a new broadcast session
 *  GET    /api/broadcasts/:id                 — get broadcast by id
 *  GET    /api/broadcasts/slug/:slug          — get broadcast by public slug (public)
 *  GET    /api/broadcasts/tournament/:tid     — list broadcasts for a tournament
 *  PATCH  /api/broadcasts/:id/status          — update status (live/paused/finished)
 *  POST   /api/broadcasts/:id/moves           — submit a move
 *  DELETE /api/broadcasts/:id/moves/last      — undo last move
 *  PATCH  /api/broadcasts/:id/fen             — set position (FEN correction)
 *  PATCH  /api/broadcasts/:id/result          — set game result
 *  GET    /api/broadcasts/:id/events          — SSE stream for realtime updates
 */

import { Router, type Request as ExpressRequest } from "express";
import { nanoid } from "nanoid";
import { eq, and, desc } from "drizzle-orm";
import { getDb } from "./db.js";
import { liveBroadcasts, liveMoves } from "../shared/schema.js";
import type { ServerResponse } from "http";
import { logger } from "./logger.js";

// ─── In-memory bridge log ring buffer (last 100 entries per broadcast) ────────

const router = Router();

type BroadcastCreatorRequest = ExpressRequest & { user?: { id?: string } };

// ─── SSE Registry ─────────────────────────────────────────────────────────────
// Maps broadcastId → Set of active SSE response objects.
const broadcastSubs = new Map<string, Set<ServerResponse>>();

function fanOut(broadcastId: string, event: string, data: unknown) {
  const subs = broadcastSubs.get(broadcastId);
  if (!subs || subs.size === 0) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of Array.from(subs)) {
    try { res.write(payload); } catch { /* disconnected */ }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function generateSlug(): string {
  return nanoid(10);
}

// ─── POST /api/broadcasts ─────────────────────────────────────────────────────
router.post("/", async (req, res) => {
  try {
    const db = await getDb();
    const {
      tournamentId,
      roundNumber = 1,
      boardNumber = 1,
      pairingId,
      whitePlayerName = "White",
      blackPlayerName = "Black",
      whitePlayerElo,
      blackPlayerElo,
      whiteAvatarUrl,
      blackAvatarUrl,
      tournamentName,
    } = req.body as Record<string, unknown>;

    if (!tournamentId) {
      return res.status(400).json({ error: "tournamentId is required" });
    }

    const id = nanoid(36).slice(0, 36);
    const publicSlug = generateSlug();
    const now = new Date();

    await db.insert(liveBroadcasts).values({
      id,
      tournamentId: String(tournamentId),
      roundNumber: Number(roundNumber),
      boardNumber: Number(boardNumber),
      pairingId: pairingId ? String(pairingId) : null,
      whitePlayerName: String(whitePlayerName),
      blackPlayerName: String(blackPlayerName),
      whitePlayerElo: whitePlayerElo ? Number(whitePlayerElo) : null,
      blackPlayerElo: blackPlayerElo ? Number(blackPlayerElo) : null,
      whiteAvatarUrl: whiteAvatarUrl ? String(whiteAvatarUrl) : null,
      blackAvatarUrl: blackAvatarUrl ? String(blackAvatarUrl) : null,
      tournamentName: tournamentName ? String(tournamentName) : null,
      status: "ready",
      inputSource: "manual",
      currentFen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      pgn: "",
      moveNumber: 0,
      sideToMove: "w",
      publicSlug,
      createdBy: (req as BroadcastCreatorRequest).user?.id ?? null,
      createdAt: now,
      updatedAt: now,
    });

    const [row] = await db.select().from(liveBroadcasts).where(eq(liveBroadcasts.id, id)).limit(1);
    res.status(201).json(row);
  } catch (err) {
    logger.error("broadcast_create_failed", { error: err });
    res.status(500).json({ error: "Failed to create broadcast" });
  }
});

// ─── GET /api/broadcasts/slug/:slug ───────────────────────────────────────────
router.get("/slug/:slug", async (req, res) => {
  try {
    const db = await getDb();
    const [row] = await db
      .select()
      .from(liveBroadcasts)
      .where(eq(liveBroadcasts.publicSlug, req.params.slug))
      .limit(1);
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json(row);
  } catch (err) {
    logger.error("broadcast_get_by_slug_failed", { error: err });
    res.status(500).json({ error: "Failed to fetch broadcast" });
  }
});

// ─── GET /api/broadcasts/tournament/:tid ──────────────────────────────────────
router.get("/tournament/:tid", async (req, res) => {
  try {
    const db = await getDb();
    const rows = await db
      .select()
      .from(liveBroadcasts)
      .where(eq(liveBroadcasts.tournamentId, req.params.tid))
      .orderBy(desc(liveBroadcasts.createdAt));
    res.json(rows);
  } catch (err) {
    logger.error("broadcast_get_by_tournament_failed", { error: err });
    res.status(500).json({ error: "Failed to fetch broadcasts" });
  }
});

// ─── GET /api/broadcasts/:id ──────────────────────────────────────────────────
router.get("/:id", async (req, res) => {
  try {
    const db = await getDb();
    const [row] = await db
      .select()
      .from(liveBroadcasts)
      .where(eq(liveBroadcasts.id, req.params.id))
      .limit(1);
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json(row);
  } catch (err) {
    logger.error("broadcast_get_failed", { error: err });
    res.status(500).json({ error: "Failed to fetch broadcast" });
  }
});

// ─── PATCH /api/broadcasts/:id/status ────────────────────────────────────────
router.patch("/:id/status", async (req, res) => {
  try {
    const db = await getDb();
    const { status } = req.body as { status: string };
    const validStatuses = ["ready", "live", "paused", "finished", "error"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }
    await db
      .update(liveBroadcasts)
      .set({ status, updatedAt: new Date() })
      .where(eq(liveBroadcasts.id, req.params.id));
    const [row] = await db.select().from(liveBroadcasts).where(eq(liveBroadcasts.id, req.params.id)).limit(1);
    if (!row) return res.status(404).json({ error: "Not found" });
    fanOut(req.params.id, "status_changed", { status, broadcast: row });
    res.json(row);
  } catch (err) {
    logger.error("broadcast_status_update_failed", { error: err });
    res.status(500).json({ error: "Failed to update status" });
  }
});

// ─── POST /api/broadcasts/:id/moves ──────────────────────────────────────────
router.post("/:id/moves", async (req, res) => {
  try {
    const db = await getDb();
    const {
      san,
      uci,
      fenBefore,
      fenAfter,
      pgn,
      sideToMove,
      source = "manual",
    } = req.body as Record<string, unknown>;

    if (!san || !uci || !fenBefore || !fenAfter) {
      return res.status(400).json({ error: "san, uci, fenBefore, fenAfter are required" });
    }

    // Get current broadcast to determine ply
    const [broadcast] = await db
      .select()
      .from(liveBroadcasts)
      .where(eq(liveBroadcasts.id, req.params.id))
      .limit(1);
    if (!broadcast) return res.status(404).json({ error: "Broadcast not found" });

    // ─── Access Control: reject moves on finished broadcasts ─────────────
    if (broadcast.status === "finished") {
      return res.status(403).json({ error: "Broadcast has ended. Cannot submit moves to a finished game." });
    }

    const ply = broadcast.moveNumber + 1;
    const moveId = nanoid(36).slice(0, 36);

    // Insert move record
    await db.insert(liveMoves).values({
      id: moveId,
      broadcastId: req.params.id,
      ply,
      san: String(san),
      uci: String(uci),
      fenBefore: String(fenBefore),
      fenAfter: String(fenAfter),
      source: String(source),
      createdAt: new Date(),
    });

    // Update broadcast state
    await db
      .update(liveBroadcasts)
      .set({
        currentFen: String(fenAfter),
        pgn: pgn ? String(pgn) : broadcast.pgn,
        lastMoveSan: String(san),
        lastMoveUci: String(uci),
        moveNumber: ply,
        sideToMove: String(sideToMove ?? (broadcast.sideToMove === "w" ? "b" : "w")),
        status: broadcast.status === "ready" ? "live" : broadcast.status,
        updatedAt: new Date(),
      })
      .where(eq(liveBroadcasts.id, req.params.id));

    const [updated] = await db.select().from(liveBroadcasts).where(eq(liveBroadcasts.id, req.params.id)).limit(1);
    fanOut(req.params.id, "move_played", { san, uci, fenAfter, pgn: updated?.pgn, moveNumber: ply, sideToMove, broadcast: updated });
    res.json({ ok: true, broadcast: updated });
  } catch (err) {
    logger.error("broadcast_move_create_failed", { error: err });
    res.status(500).json({ error: "Failed to submit move" });
  }
});

// ─── DELETE /api/broadcasts/:id/moves/last ────────────────────────────────────
router.delete("/:id/moves/last", async (req, res) => {
  try {
    const db = await getDb();

    // Get the last move
    const [lastMove] = await db
      .select()
      .from(liveMoves)
      .where(eq(liveMoves.broadcastId, req.params.id))
      .orderBy(desc(liveMoves.ply))
      .limit(1);

    if (!lastMove) {
      return res.status(400).json({ error: "No moves to undo" });
    }

    // Delete the last move
    await db
      .delete(liveMoves)
      .where(and(eq(liveMoves.broadcastId, req.params.id), eq(liveMoves.ply, lastMove.ply)));

    // Get the new last move (if any) to restore state
    const [prevMove] = await db
      .select()
      .from(liveMoves)
      .where(eq(liveMoves.broadcastId, req.params.id))
      .orderBy(desc(liveMoves.ply))
      .limit(1);

    const newFen = prevMove ? prevMove.fenAfter : "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    const newPly = prevMove ? prevMove.ply : 0;
    const newSideToMove = newFen.split(" ")[1] ?? "w";

    // Rebuild PGN from remaining moves
    const allMoves = await db
      .select()
      .from(liveMoves)
      .where(eq(liveMoves.broadcastId, req.params.id))
      .orderBy(liveMoves.ply);

    let pgn = "";
    for (let i = 0; i < allMoves.length; i++) {
      const m = allMoves[i];
      const moveNum = Math.ceil((i + 1) / 2);
      if (i % 2 === 0) pgn += `${moveNum}. `;
      pgn += `${m.san} `;
    }
    pgn = pgn.trim();

    await db
      .update(liveBroadcasts)
      .set({
        currentFen: newFen,
        pgn,
        lastMoveSan: prevMove?.san ?? null,
        lastMoveUci: prevMove?.uci ?? null,
        moveNumber: newPly,
        sideToMove: newSideToMove,
        updatedAt: new Date(),
      })
      .where(eq(liveBroadcasts.id, req.params.id));

    const [updated] = await db.select().from(liveBroadcasts).where(eq(liveBroadcasts.id, req.params.id)).limit(1);
    fanOut(req.params.id, "move_undone", { fenAfter: newFen, pgn, moveNumber: newPly, broadcast: updated });
    res.json({ ok: true, broadcast: updated });
  } catch (err) {
    logger.error("broadcast_last_move_delete_failed", { error: err });
    res.status(500).json({ error: "Failed to undo move" });
  }
});

// ─── PATCH /api/broadcasts/:id/fen ───────────────────────────────────────────
router.patch("/:id/fen", async (req, res) => {
  try {
    const db = await getDb();
    const { fen } = req.body as { fen: string };
    if (!fen) return res.status(400).json({ error: "fen is required" });

    const sideToMove = fen.split(" ")[1] ?? "w";

    await db
      .update(liveBroadcasts)
      .set({ currentFen: fen, sideToMove, updatedAt: new Date() })
      .where(eq(liveBroadcasts.id, req.params.id));

    const [updated] = await db.select().from(liveBroadcasts).where(eq(liveBroadcasts.id, req.params.id)).limit(1);
    fanOut(req.params.id, "position_set", { fen, broadcast: updated });
    res.json(updated);
  } catch (err) {
    logger.error("broadcast_fen_update_failed", { error: err });
    res.status(500).json({ error: "Failed to set position" });
  }
});

// ─── PATCH /api/broadcasts/:id/result ────────────────────────────────────────
router.patch("/:id/result", async (req, res) => {
  try {
    const db = await getDb();
    const { result } = req.body as { result: string };
    const validResults = ["1-0", "0-1", "1/2-1/2", "*"];
    if (!validResults.includes(result)) {
      return res.status(400).json({ error: "Invalid result" });
    }

    await db
      .update(liveBroadcasts)
      .set({ result, status: result === "*" ? "live" : "finished", updatedAt: new Date() })
      .where(eq(liveBroadcasts.id, req.params.id));

    const [updated] = await db.select().from(liveBroadcasts).where(eq(liveBroadcasts.id, req.params.id)).limit(1);
    fanOut(req.params.id, "result_set", { result, broadcast: updated });
    res.json(updated);
  } catch (err) {
    logger.error("broadcast_result_update_failed", { error: err });
    res.status(500).json({ error: "Failed to set result" });
  }
});

// ─── GET /api/broadcasts/:id/moves ───────────────────────────────────────────
router.get("/:id/moves", async (req, res) => {
  try {
    const db = await getDb();
    const moves = await db
      .select()
      .from(liveMoves)
      .where(eq(liveMoves.broadcastId, req.params.id))
      .orderBy(liveMoves.ply);
    res.json(moves);
  } catch (err) {
    logger.error("broadcast_moves_get_failed", { error: err });
    res.status(500).json({ error: "Failed to fetch moves" });
  }
});

// ─── PATCH /api/broadcasts/:id/display-settings ─────────────────────────────
router.patch("/:id/display-settings", async (req, res) => {
  try {
    const db = await getDb();
    const { displayMode, displaySettings } = req.body as { displayMode?: string; displaySettings?: Record<string, unknown> };
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (displayMode) updates.displayMode = displayMode;
    if (displaySettings !== undefined) updates.displaySettings = displaySettings;
    await db.update(liveBroadcasts).set(updates).where(eq(liveBroadcasts.id, req.params.id));
    const [updated] = await db.select().from(liveBroadcasts).where(eq(liveBroadcasts.id, req.params.id)).limit(1);
    if (!updated) return res.status(404).json({ error: "Not found" });
    fanOut(req.params.id, "display_settings_changed", { displayMode: updated.displayMode, displaySettings: updated.displaySettings, broadcast: updated });
    res.json(updated);
  } catch (err) {
    logger.error("broadcast_display_settings_update_failed", { error: err });
    res.status(500).json({ error: "Failed to update display settings" });
  }
});

// ─── PATCH /api/broadcasts/:id/correction ────────────────────────────────────
// Correction: set FEN + note, insert correction move record.
router.patch("/:id/correction", async (req, res) => {
  try {
    const db = await getDb();
    const { fen, pgn, note } = req.body as { fen: string; pgn?: string; note?: string };
    if (!fen) return res.status(400).json({ error: "fen is required" });
    const [broadcast] = await db.select().from(liveBroadcasts).where(eq(liveBroadcasts.id, req.params.id)).limit(1);
    if (!broadcast) return res.status(404).json({ error: "Broadcast not found" });
    const sideToMove = fen.split(" ")[1] ?? "w";
    // Insert correction move record
    const moveId = nanoid(36).slice(0, 36);
    await db.insert(liveMoves).values({
      id: moveId,
      broadcastId: req.params.id,
      ply: broadcast.moveNumber + 1,
      san: "--",
      uci: "0000",
      fenBefore: broadcast.currentFen,
      fenAfter: fen,
      source: "correction",
      correctionNote: note ?? "Position corrected by operator",
      createdAt: new Date(),
    });
    await db.update(liveBroadcasts).set({
      currentFen: fen,
      pgn: pgn ?? broadcast.pgn,
      sideToMove,
      moveNumber: broadcast.moveNumber + 1,
      updatedAt: new Date(),
    }).where(eq(liveBroadcasts.id, req.params.id));
    const [updated] = await db.select().from(liveBroadcasts).where(eq(liveBroadcasts.id, req.params.id)).limit(1);
    fanOut(req.params.id, "position_corrected", { fen, note, broadcast: updated });
    res.json(updated);
  } catch (err) {
    logger.error("broadcast_correction_failed", { error: err });
    res.status(500).json({ error: "Failed to apply correction" });
  }
});

// ─── POST /api/broadcasts/:id/reset ──────────────────────────────────────────
router.post("/:id/reset", async (req, res) => {
  try {
    const db = await getDb();
    // Delete all moves
    await db.delete(liveMoves).where(eq(liveMoves.broadcastId, req.params.id));
    // Reset broadcast state
    await db.update(liveBroadcasts).set({
      currentFen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      pgn: "",
      lastMoveSan: null,
      lastMoveUci: null,
      moveNumber: 0,
      sideToMove: "w",
      status: "ready",
      result: null,
      updatedAt: new Date(),
    }).where(eq(liveBroadcasts.id, req.params.id));
    const [updated] = await db.select().from(liveBroadcasts).where(eq(liveBroadcasts.id, req.params.id)).limit(1);
    fanOut(req.params.id, "broadcast_reset", { broadcast: updated });
    res.json(updated);
  } catch (err) {
    logger.error("broadcast_reset_failed", { error: err });
    res.status(500).json({ error: "Failed to reset broadcast" });
  }
});

// ─── GET /api/broadcasts/:id/events (SSE) ────────────────────────────────────
router.get("/:id/events", async (req, res) => {
  const { id } = req.params;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  // Register subscriber
  if (!broadcastSubs.has(id)) broadcastSubs.set(id, new Set());
  broadcastSubs.get(id)!.add(res as unknown as ServerResponse);

  // Send current state immediately
  try {
    const db = await getDb();
    const [row] = await db.select().from(liveBroadcasts).where(eq(liveBroadcasts.id, id)).limit(1);
    if (row) {
      res.write(`event: init\ndata: ${JSON.stringify(row)}\n\n`);
    }
  } catch { /* ignore */ }

  // Heartbeat every 25s to keep connection alive
  const heartbeat = setInterval(() => {
    try { res.write(": ping\n\n"); } catch { clearInterval(heartbeat); }
  }, 25000);

  req.on("close", () => {
    clearInterval(heartbeat);
    const subs = broadcastSubs.get(id);
    if (subs) {
      subs.delete(res as unknown as ServerResponse);
      if (subs.size === 0) broadcastSubs.delete(id);
    }
  });
});

// ─── POST /api/broadcasts/:id/display-ping ──────────────────────────────────
// Called by VenueDisplay every 30s to confirm it's connected.
// Fans out a display_ping event to the console.
router.post("/:id/display-ping", async (req, res) => {
  fanOut(req.params.id, "display_ping", { timestamp: Date.now() });
  res.json({ ok: true });
});

// ─── PATCH /api/broadcasts/:id/clock ─────────────────────────────────────────
// Operator sets/updates the chess clock state.
// Body: { action: "set" | "start" | "pause" | "switch" | "reset",
//         whiteTimeMs?: number, blackTimeMs?: number }
//
// "set"    — write new time values without starting the clock
// "start"  — start the clock (sets clockRunning=1, records clockLastUpdatedAt)
// "pause"  — pause the clock (saves elapsed time, sets clockRunning=0)
// "switch" — pause current side, deduct elapsed, start opponent's clock
//            (called automatically when a move is submitted)
// "reset"  — stop clock and clear all time values
router.patch("/:id/clock", async (req, res) => {
  try {
    const db = await getDb();
    const [broadcast] = await db.select().from(liveBroadcasts)
      .where(eq(liveBroadcasts.id, req.params.id)).limit(1);
    if (!broadcast) return res.status(404).json({ error: "Broadcast not found" });

    const { action, whiteTimeMs: reqWhite, blackTimeMs: reqBlack } = req.body as {
      action: "set" | "start" | "pause" | "switch" | "reset";
      whiteTimeMs?: number;
      blackTimeMs?: number;
    };

    const now = new Date();
    let whiteTimeMs = broadcast.whiteTimeMs ?? null;
    let blackTimeMs = broadcast.blackTimeMs ?? null;
    let clockRunning = broadcast.clockRunning;
    let clockLastUpdatedAt: Date | null = broadcast.clockLastUpdatedAt ?? null;

    // Helper: deduct elapsed time from the active side
    const deductElapsed = () => {
      if (!clockRunning || !clockLastUpdatedAt) return;
      const elapsed = now.getTime() - clockLastUpdatedAt.getTime();
      if (broadcast.sideToMove === "w" && whiteTimeMs !== null) {
        whiteTimeMs = Math.max(0, whiteTimeMs - elapsed);
      } else if (broadcast.sideToMove === "b" && blackTimeMs !== null) {
        blackTimeMs = Math.max(0, blackTimeMs - elapsed);
      }
    };

    switch (action) {
      case "set":
        if (reqWhite !== undefined) whiteTimeMs = reqWhite;
        if (reqBlack !== undefined) blackTimeMs = reqBlack;
        clockRunning = 0;
        clockLastUpdatedAt = null;
        break;

      case "start":
        clockRunning = 1;
        clockLastUpdatedAt = now;
        break;

      case "pause":
        deductElapsed();
        clockRunning = 0;
        clockLastUpdatedAt = now;
        break;

      case "switch":
        // Deduct elapsed from current side, then start opponent
        deductElapsed();
        clockRunning = 1;
        clockLastUpdatedAt = now;
        break;

      case "reset":
        whiteTimeMs = null;
        blackTimeMs = null;
        clockRunning = 0;
        clockLastUpdatedAt = null;
        break;

      default:
        return res.status(400).json({ error: "Invalid clock action" });
    }

    await db.update(liveBroadcasts).set({
      whiteTimeMs,
      blackTimeMs,
      clockRunning,
      clockLastUpdatedAt,
      updatedAt: now,
    }).where(eq(liveBroadcasts.id, req.params.id));

    const clockState = { whiteTimeMs, blackTimeMs, clockRunning, clockLastUpdatedAt, sideToMove: broadcast.sideToMove };
    fanOut(req.params.id, "clock_update", clockState);
    res.json(clockState);
  } catch (err) {
    logger.error("broadcast_clock_update_failed", { error: err });
    res.status(500).json({ error: "Failed to update clock" });
  }
});

// ─── PATCH /api/broadcasts/:id/input-source ─────────────────────────────────
// Switch the retained broadcast input source (manual / pgn_import).
router.patch("/:id/input-source", async (req, res) => {
  try {
    const { source } = req.body as { source: string };
    const validSources = ["manual", "pgn_import"];
    if (!validSources.includes(source)) {
      return res.status(400).json({ error: "Invalid input source" });
    }

    const db = await getDb();
    const [broadcast] = await db
      .select()
      .from(liveBroadcasts)
      .where(eq(liveBroadcasts.id, req.params.id))
      .limit(1);
    if (!broadcast) return res.status(404).json({ error: "Broadcast not found" });

    const updateFields: Record<string, unknown> = { inputSource: source };

    await db
      .update(liveBroadcasts)
      .set(updateFields)
      .where(eq(liveBroadcasts.id, req.params.id));

    fanOut(req.params.id, "input_source_changed", { source });

    // Return the full updated broadcast so the client can replace its local state
    const [updated] = await db
      .select()
      .from(liveBroadcasts)
      .where(eq(liveBroadcasts.id, req.params.id))
      .limit(1);
    res.json(updated);
  } catch (err) {
    logger.error("broadcast_input_source_update_failed", { error: err });
    res.status(500).json({ error: "Failed to update input source" });
  }
});

export default router;
