/**
 * clubBattles.ts
 * Server-side persistence for club 1v1 OTB battles.
 *
 * Routes (all mounted under /api/clubs/:clubId/battles):
 *   GET    /                         — list all battles for a club (newest first)
 *   POST   /                         — create a new battle (pending)
 *   POST   /bulk                     — bulk-import battles (for localStorage migration)
 *   PATCH  /:battleId/start          — mark battle as active
 *   PATCH  /:battleId/result         — record final result (completed)
 *   DELETE /:battleId                — delete a battle
 *   GET    /stats/:playerId          — all-time W/D/L summary for a player in this club
 *   GET    /leaderboard              — ranked leaderboard for the club
 */

import { Router } from "express";
import { eq, and, or, desc } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getDb } from "./db.js";
import { clubBattles, type NewClubBattleRow } from "../shared/schema.js";
import { logger } from "./logger.js";

const router = Router({ mergeParams: true });

// ─── Types ────────────────────────────────────────────────────────────────────

type BattleResult = "player_a" | "player_b" | "draw";
type BattleStatus = "pending" | "active" | "completed";

// ─── GET / — list battles ─────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  const { clubId } = req.params as { clubId: string };
  try {
    const db = await getDb();
    const rows = await db
      .select()
      .from(clubBattles)
      .where(eq(clubBattles.clubId, clubId))
      .orderBy(desc(clubBattles.createdAt));
    return res.json(rows);
  } catch (err) {
    logger.error("[club-battles] GET /", err);
    return res.status(500).json({ error: "Failed to load battles" });
  }
});

// ─── POST / — create battle ───────────────────────────────────────────────────
router.post("/", async (req, res) => {
  const { clubId } = req.params as { clubId: string };
  const {
    id,
    playerAId,
    playerAName,
    playerBId,
    playerBName,
    notes,
    createdAt,
  } = req.body as {
    id?: string;
    playerAId: string;
    playerAName: string;
    playerBId: string;
    playerBName: string;
    notes?: string;
    createdAt?: string;
  };

  if (!playerAId || !playerAName || !playerBId || !playerBName) {
    return res.status(400).json({ error: "playerAId, playerAName, playerBId, playerBName are required" });
  }

  try {
    const db = await getDb();
    const row: NewClubBattleRow = {
      id: id ?? `battle_${nanoid(16)}`,
      clubId,
      playerAId,
      playerAName,
      playerBId,
      playerBName,
      status: "pending",
      notes: notes ?? null,
      createdAt: createdAt ? new Date(createdAt) : new Date(),
    };
    await db.insert(clubBattles).values(row);
    return res.status(201).json(row);
  } catch (err: any) {
    // Duplicate key — battle already exists (idempotent import)
    if (err?.code === "ER_DUP_ENTRY" || String(err?.message).includes("Duplicate")) {
      return res.status(200).json({ id: req.body.id, skipped: true });
    }
    logger.error("[club-battles] POST /", err);
    return res.status(500).json({ error: "Failed to create battle" });
  }
});

// ─── POST /bulk — bulk import (localStorage migration) ───────────────────────
// Accepts an array of ClubBattle objects and upserts them all.
// Skips any that already exist (by id). Returns { inserted, skipped }.
router.post("/bulk", async (req, res) => {
  const { clubId } = req.params as { clubId: string };
  const battles = req.body as Array<{
    id: string;
    playerAId: string;
    playerAName: string;
    playerBId: string;
    playerBName: string;
    status: BattleStatus;
    result?: BattleResult;
    notes?: string;
    createdAt: string;
    startedAt?: string;
    completedAt?: string;
  }>;

  if (!Array.isArray(battles) || battles.length === 0) {
    return res.json({ inserted: 0, skipped: 0 });
  }

  const db = await getDb();
  let inserted = 0;
  let skipped = 0;

  for (const b of battles) {
    try {
      const row: NewClubBattleRow = {
        id: b.id,
        clubId,
        playerAId: b.playerAId,
        playerAName: b.playerAName,
        playerBId: b.playerBId,
        playerBName: b.playerBName,
        status: b.status,
        result: b.result ?? null,
        notes: b.notes ?? null,
        createdAt: new Date(b.createdAt),
        startedAt: b.startedAt ? new Date(b.startedAt) : null,
        completedAt: b.completedAt ? new Date(b.completedAt) : null,
      };
      await db.insert(clubBattles).values(row);
      inserted++;
    } catch (err: any) {
      if (err?.code === "ER_DUP_ENTRY" || String(err?.message).includes("Duplicate")) {
        skipped++;
      } else {
        logger.error("[club-battles] bulk insert error for", b.id, err);
        skipped++;
      }
    }
  }

  return res.json({ inserted, skipped });
});

// ─── PATCH /:battleId/start ───────────────────────────────────────────────────
router.patch("/:battleId/start", async (req, res) => {
  const { clubId, battleId } = req.params as { clubId: string; battleId: string };
  try {
    const db = await getDb();
    await db
      .update(clubBattles)
      .set({ status: "active", startedAt: new Date() })
      .where(and(eq(clubBattles.id, battleId), eq(clubBattles.clubId, clubId)));
    return res.json({ ok: true });
  } catch (err) {
    logger.error("[club-battles] PATCH start", err);
    return res.status(500).json({ error: "Failed to start battle" });
  }
});

// ─── PATCH /:battleId/result ──────────────────────────────────────────────────
router.patch("/:battleId/result", async (req, res) => {
  const { clubId, battleId } = req.params as { clubId: string; battleId: string };
  const { result } = req.body as { result: BattleResult };
  if (!["player_a", "player_b", "draw"].includes(result)) {
    return res.status(400).json({ error: "result must be player_a | player_b | draw" });
  }
  try {
    const db = await getDb();
    await db
      .update(clubBattles)
      .set({ status: "completed", result, completedAt: new Date() })
      .where(and(eq(clubBattles.id, battleId), eq(clubBattles.clubId, clubId)));
    return res.json({ ok: true });
  } catch (err) {
    logger.error("[club-battles] PATCH result", err);
    return res.status(500).json({ error: "Failed to record result" });
  }
});

// ─── DELETE /:battleId ────────────────────────────────────────────────────────
router.delete("/:battleId", async (req, res) => {
  const { clubId, battleId } = req.params as { clubId: string; battleId: string };
  try {
    const db = await getDb();
    await db
      .delete(clubBattles)
      .where(and(eq(clubBattles.id, battleId), eq(clubBattles.clubId, clubId)));
    return res.json({ ok: true });
  } catch (err) {
    logger.error("[club-battles] DELETE", err);
    return res.status(500).json({ error: "Failed to delete battle" });
  }
});

// ─── GET /stats/:playerId ─────────────────────────────────────────────────────
// Returns all-time W/D/L summary for a player across all completed battles in
// this club. Used by PlayerStatsCard and the Analytics tab.
router.get("/stats/:playerId", async (req, res) => {
  const { clubId, playerId } = req.params as { clubId: string; playerId: string };
  try {
    const db = await getDb();
    const rows = await db
      .select()
      .from(clubBattles)
      .where(
        and(
          eq(clubBattles.clubId, clubId),
          eq(clubBattles.status, "completed"),
          or(
            eq(clubBattles.playerAId, playerId),
            eq(clubBattles.playerBId, playerId)
          )
        )
      );

    let wins = 0, draws = 0, losses = 0;
    for (const b of rows) {
      const isA = b.playerAId === playerId;
      if (b.result === "draw") draws++;
      else if ((b.result === "player_a" && isA) || (b.result === "player_b" && !isA)) wins++;
      else losses++;
    }
    const total = wins + draws + losses;
    return res.json({
      playerId,
      wins,
      draws,
      losses,
      total,
      winRate: total > 0 ? Math.round((wins / total) * 100) : 0,
    });
  } catch (err) {
    logger.error("[club-battles] GET stats", err);
    return res.status(500).json({ error: "Failed to load stats" });
  }
});

// ─── GET /leaderboard ─────────────────────────────────────────────────────────
// Returns a ranked leaderboard of all players who have completed battles in
// this club. Used by the Analytics tab.
router.get("/leaderboard", async (req, res) => {
  const { clubId } = req.params as { clubId: string };
  try {
    const db = await getDb();
    const rows = await db
      .select()
      .from(clubBattles)
      .where(
        and(
          eq(clubBattles.clubId, clubId),
          eq(clubBattles.status, "completed")
        )
      );

    const map = new Map<string, {
      name: string;
      wins: number;
      draws: number;
      losses: number;
      history: string[];
    }>();

    const ensure = (id: string, name: string) => {
      if (!map.has(id)) map.set(id, { name, wins: 0, draws: 0, losses: 0, history: [] });
    };

    for (const b of rows) {
      ensure(b.playerAId, b.playerAName);
      ensure(b.playerBId, b.playerBName);
      const a = map.get(b.playerAId)!;
      const bEntry = map.get(b.playerBId)!;
      if (b.result === "player_a") {
        a.wins++; a.history.push("win");
        bEntry.losses++; bEntry.history.push("loss");
      } else if (b.result === "player_b") {
        bEntry.wins++; bEntry.history.push("win");
        a.losses++; a.history.push("loss");
      } else {
        a.draws++; a.history.push("draw");
        bEntry.draws++; bEntry.history.push("draw");
      }
    }

    const entries = Array.from(map.entries()).map(([playerId, stats]) => {
      const total = stats.wins + stats.draws + stats.losses;
      const winRate = total > 0 ? Math.round((stats.wins / total) * 100) : 0;
      let streak = 0;
      for (let i = stats.history.length - 1; i >= 0; i--) {
        const r = stats.history[i];
        if (streak === 0) {
          if (r === "win") streak = 1;
          else if (r === "loss") streak = -1;
          else break;
        } else if (streak > 0 && r === "win") streak++;
        else if (streak < 0 && r === "loss") streak--;
        else break;
      }
      return { playerId, playerName: stats.name, wins: stats.wins, draws: stats.draws, losses: stats.losses, total, winRate, streak };
    });

    entries.sort((a, b) => b.wins - a.wins || b.winRate - a.winRate);
    return res.json(entries);
  } catch (err) {
    logger.error("[club-battles] GET leaderboard", err);
    return res.status(500).json({ error: "Failed to load leaderboard" });
  }
});

export default router;
