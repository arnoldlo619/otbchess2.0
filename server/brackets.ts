/**
 * OTB Chess — Multi-Tournament Brackets REST API
 *
 * Endpoints (all mounted at /api/brackets):
 *   POST /                       — create a bracket group
 *   GET  /:id                    — get a bracket group by ID
 *   PATCH /:id                   — update bracket group config
 *   DELETE /:id                  — delete a bracket group (and unlink child tournaments)
 *   POST /:id/auto-sort          — auto-sort registered players into brackets by ELO
 *   POST /:id/suggest            — suggest optimal bracket splits based on player ELO distribution
 *   POST /:id/reassign           — manually reassign a player to a different bracket
 *   POST /:id/spawn              — spawn child bracket-tournaments from the bracket definitions
 *   GET  /:id/brackets           — list child bracket-tournaments for a group
 */

import { Router } from "express";
import { getDb } from "./db.js";
import {
  bracketGroups,
  userTournaments,
  tournamentPlayers,
  tournamentState,
} from "../shared/schema";
import type { BracketDefinition } from "../shared/schema";
import { eq, and, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { Request, Response } from "express";
import { requireAuth as authMiddleware } from "./auth.js";
import { logger } from "./logger.js";

const router = Router();

// ─── Helper: Parse brackets JSON safely ──────────────────────────────────────
function parseBrackets(json: string): BracketDefinition[] {
  try {
    return JSON.parse(json) as BracketDefinition[];
  } catch {
    return [];
  }
}

// ─── Helper: Determine which bracket a player belongs to ─────────────────────
function findBracketForElo(
  elo: number | null | undefined,
  brackets: BracketDefinition[]
): BracketDefinition | null {
  if (elo == null) {
    // Unrated players go to the lowest bracket
    const sorted = [...brackets].sort((a, b) => a.minElo - b.minElo);
    return sorted[0] ?? null;
  }
  for (const b of brackets) {
    if (elo >= b.minElo && elo <= b.maxElo) return b;
  }
  // Fallback: if ELO exceeds all brackets, put in the highest
  const sorted = [...brackets].sort((a, b) => b.maxElo - a.maxElo);
  return sorted[0] ?? null;
}

// ─── Helper: Suggest optimal bracket splits ──────────────────────────────────
function suggestBracketSplits(
  elos: number[],
  targetBrackets: number = 3
): BracketDefinition[] {
  if (elos.length === 0) return [];
  const sorted = [...elos].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const range = max - min;

  if (range < 200 || targetBrackets <= 1) {
    // All players are similar — single bracket
    return [{ label: "Open", minElo: 0, maxElo: 9999, order: 0 }];
  }

  // Use percentile-based splits for even distribution
  const brackets: BracketDefinition[] = [];
  const chunkSize = Math.ceil(sorted.length / targetBrackets);

  for (let i = 0; i < targetBrackets; i++) {
    const startIdx = i * chunkSize;
    const endIdx = Math.min((i + 1) * chunkSize - 1, sorted.length - 1);
    if (startIdx >= sorted.length) break;

    const bracketMin = i === 0 ? 0 : sorted[startIdx];
    const bracketMax = i === targetBrackets - 1 ? 9999 : sorted[endIdx];

    let label: string;
    if (i === 0) {
      label = `Under ${bracketMax + 1}`;
    } else if (i === targetBrackets - 1) {
      label = `${bracketMin}+`;
    } else {
      label = `${bracketMin}–${bracketMax}`;
    }

    brackets.push({
      label,
      minElo: bracketMin,
      maxElo: bracketMax,
      order: i,
    });
  }

  return brackets;
}

// ─── POST / — Create a bracket group ────────────────────────────────────────
router.post("/", authMiddleware, async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const {
      name,
      venue,
      date,
      brackets,
      ratingPlatform,
      ratingType,
      format,
      rounds,
      timeBase,
      timeIncrement,
      parentTournamentId,
      clubId,
    } = req.body;

    if (!name || !brackets || !Array.isArray(brackets) || brackets.length === 0) {
      return res.status(400).json({ error: "name and brackets[] are required" });
    }

    const id = nanoid(12);
    const bracketsJson = JSON.stringify(brackets);

    await db.insert(bracketGroups).values({
      id,
      userId,
      name,
      venue: venue ?? null,
      date: date ?? null,
      bracketsJson,
      ratingPlatform: ratingPlatform ?? "chess.com",
      ratingType: ratingType ?? "rapid",
      format: format ?? null,
      rounds: rounds ?? null,
      timeBase: timeBase ?? null,
      timeIncrement: timeIncrement ?? null,
      parentTournamentId: parentTournamentId ?? null,
      status: "draft",
      clubId: clubId ?? null,
    });

    // If a parent tournament exists, mark it as a bracket parent
    if (parentTournamentId) {
      await db
        .update(userTournaments)
        .set({ parentBracketGroupId: id })
        .where(eq(userTournaments.tournamentId, parentTournamentId));
    }

    res.status(201).json({ id, name, brackets, status: "draft" });
  } catch (err) {
    logger.error("[brackets] Create error:", err);
    res.status(500).json({ error: "Failed to create bracket group" });
  }
});

// ─── GET /:id — Get a bracket group ─────────────────────────────────────────
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const [group] = await db
      .select()
      .from(bracketGroups)
      .where(eq(bracketGroups.id, req.params.id))
      .limit(1);

    if (!group) return res.status(404).json({ error: "Bracket group not found" });

    res.json({
      ...group,
      brackets: parseBrackets(group.bracketsJson),
    });
  } catch (err) {
    logger.error("[brackets] Get error:", err);
    res.status(500).json({ error: "Failed to fetch bracket group" });
  }
});

// ─── PATCH /:id — Update bracket group config ───────────────────────────────
router.patch("/:id", authMiddleware, async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const userId = (req as any).user?.id;
    const [group] = await db
      .select()
      .from(bracketGroups)
      .where(eq(bracketGroups.id, req.params.id))
      .limit(1);

    if (!group) return res.status(404).json({ error: "Bracket group not found" });
    if (group.userId !== userId) return res.status(403).json({ error: "Forbidden" });

    const updates: Record<string, any> = {};
    if (req.body.name) updates.name = req.body.name;
    if (req.body.venue !== undefined) updates.venue = req.body.venue;
    if (req.body.date !== undefined) updates.date = req.body.date;
    if (req.body.brackets) updates.bracketsJson = JSON.stringify(req.body.brackets);
    if (req.body.ratingPlatform) updates.ratingPlatform = req.body.ratingPlatform;
    if (req.body.ratingType) updates.ratingType = req.body.ratingType;
    if (req.body.format !== undefined) updates.format = req.body.format;
    if (req.body.rounds !== undefined) updates.rounds = req.body.rounds;
    if (req.body.timeBase !== undefined) updates.timeBase = req.body.timeBase;
    if (req.body.timeIncrement !== undefined) updates.timeIncrement = req.body.timeIncrement;
    if (req.body.status) updates.status = req.body.status;
    updates.updatedAt = new Date();

    if (Object.keys(updates).length > 0) {
      await db
        .update(bracketGroups)
        .set(updates)
        .where(eq(bracketGroups.id, req.params.id));
    }

    res.json({ success: true });
  } catch (err) {
    logger.error("[brackets] Update error:", err);
    res.status(500).json({ error: "Failed to update bracket group" });
  }
});

// ─── DELETE /:id — Delete a bracket group ────────────────────────────────────
router.delete("/:id", authMiddleware, async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const userId = (req as any).user?.id;
    const [group] = await db
      .select()
      .from(bracketGroups)
      .where(eq(bracketGroups.id, req.params.id))
      .limit(1);

    if (!group) return res.status(404).json({ error: "Bracket group not found" });
    if (group.userId !== userId) return res.status(403).json({ error: "Forbidden" });

    // Unlink child tournaments
    await db
      .update(userTournaments)
      .set({ parentBracketGroupId: null, bracketLabel: null, bracketOrder: null })
      .where(eq(userTournaments.parentBracketGroupId!, req.params.id));

    await db.delete(bracketGroups).where(eq(bracketGroups.id, req.params.id));

    res.json({ success: true });
  } catch (err) {
    logger.error("[brackets] Delete error:", err);
    res.status(500).json({ error: "Failed to delete bracket group" });
  }
});

// ─── POST /:id/suggest — Suggest optimal bracket splits ─────────────────────
router.post("/:id/suggest", authMiddleware, async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const [group] = await db
      .select()
      .from(bracketGroups)
      .where(eq(bracketGroups.id, req.params.id))
      .limit(1);

    if (!group) return res.status(404).json({ error: "Bracket group not found" });

    const { targetBrackets = 3, players: clientPlayers } = req.body;

    // Extract ELOs — prefer client-supplied players (already have elo resolved),
    // fall back to DB players if available.
    const ratingType = group.ratingType ?? "rapid";
    const elos: number[] = [];

    if (Array.isArray(clientPlayers) && clientPlayers.length > 0) {
      // Client passed players directly (e.g. from localStorage state)
      for (const p of clientPlayers) {
        const elo = typeof p.elo === "number" && p.elo > 0 ? p.elo : null;
        if (elo) elos.push(elo);
      }
    } else if (group.parentTournamentId) {
      // Fall back to DB players
      const players = await db
        .select()
        .from(tournamentPlayers)
        .where(eq(tournamentPlayers.tournamentId, group.parentTournamentId));
      for (const p of players) {
        const data = p.playerJson ? JSON.parse(p.playerJson as string) : {};
        const elo = ratingType === "blitz" ? (data.blitz ?? data.elo) : (data.rapid ?? data.elo);
        if (typeof elo === "number" && elo > 0) elos.push(elo);
      }
    } else {
      return res.status(400).json({ error: "No players or parent tournament available" });
    }

    const suggested = suggestBracketSplits(elos, targetBrackets);

    // Annotate with player counts
    const annotated = suggested.map((b) => ({
      ...b,
      playerCount: elos.filter((e) => e >= b.minElo && e <= b.maxElo).length,
    }));

    res.json({ brackets: annotated, totalPlayers: elos.length, ratedPlayers: elos.length });
  } catch (err) {
    logger.error("[brackets] Suggest error:", err);
    res.status(500).json({ error: "Failed to suggest brackets" });
  }
});

// ─── POST /:id/auto-sort — Auto-sort players into brackets ──────────────────
router.post("/:id/auto-sort", authMiddleware, async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const userId = (req as any).user?.id;
    const [group] = await db
      .select()
      .from(bracketGroups)
      .where(eq(bracketGroups.id, req.params.id))
      .limit(1);

    if (!group) return res.status(404).json({ error: "Bracket group not found" });
    if (group.userId !== userId) return res.status(403).json({ error: "Forbidden" });
    if (!group.parentTournamentId) {
      return res.status(400).json({ error: "No parent tournament linked" });
    }

    const brackets = parseBrackets(group.bracketsJson);
    if (brackets.length === 0) {
      return res.status(400).json({ error: "No brackets defined" });
    }

    // Get all registered players
    const players = await db
      .select()
      .from(tournamentPlayers)
      .where(eq(tournamentPlayers.tournamentId, group.parentTournamentId));

    const ratingType = group.ratingType ?? "rapid";

    // Sort each player into a bracket
    const assignments: { playerId: string; username: string; elo: number | null; bracketLabel: string; bracketOrder: number }[] = [];

    for (const p of players) {
      const data = p.playerJson ? JSON.parse(p.playerJson as string) : {};
      const elo: number | null = ratingType === "blitz"
        ? (data.blitz ?? data.elo ?? null)
        : (data.rapid ?? data.elo ?? null);

      const bracket = findBracketForElo(elo, brackets);
      if (bracket) {
        assignments.push({
          playerId: p.id,
          username: p.username,
          elo,
          bracketLabel: bracket.label,
          bracketOrder: bracket.order,
        });
      }
    }

    // Group assignments by bracket
    const grouped: Record<string, typeof assignments> = {};
    for (const a of assignments) {
      if (!grouped[a.bracketLabel]) grouped[a.bracketLabel] = [];
      grouped[a.bracketLabel].push(a);
    }

    res.json({
      assignments: grouped,
      totalPlayers: players.length,
      brackets: brackets.map((b) => ({
        ...b,
        playerCount: (grouped[b.label] ?? []).length,
      })),
    });
  } catch (err) {
    logger.error("[brackets] Auto-sort error:", err);
    res.status(500).json({ error: "Failed to auto-sort players" });
  }
});

// ─── POST /:id/reassign — Manually reassign a player ────────────────────────
router.post("/:id/reassign", authMiddleware, async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const userId = (req as any).user?.id;
    const [group] = await db
      .select()
      .from(bracketGroups)
      .where(eq(bracketGroups.id, req.params.id))
      .limit(1);

    if (!group) return res.status(404).json({ error: "Bracket group not found" });
    if (group.userId !== userId) return res.status(403).json({ error: "Forbidden" });

    const { playerId, fromTournamentId, toTournamentId } = req.body;
    if (!playerId || !toTournamentId) {
      return res.status(400).json({ error: "playerId and toTournamentId are required" });
    }

    // If fromTournamentId is provided, remove from that tournament's player list
    if (fromTournamentId) {
      await db
        .delete(tournamentPlayers)
        .where(
          and(
            eq(tournamentPlayers.tournamentId, fromTournamentId),
            eq(tournamentPlayers.id, playerId)
          )
        );
    }

    // Get the player data from the parent tournament
    const [player] = await db
      .select()
      .from(tournamentPlayers)
      .where(
        and(
          eq(tournamentPlayers.tournamentId, group.parentTournamentId!),
          eq(tournamentPlayers.id, playerId)
        )
      )
      .limit(1);

    if (!player) return res.status(404).json({ error: "Player not found in parent tournament" });

    // Add to the target bracket-tournament
    await db.insert(tournamentPlayers).values({
      id: nanoid(12),
      tournamentId: toTournamentId,
      username: player.username,
      playerJson: player.playerJson,
      joinedAt: new Date(),
    }).onDuplicateKeyUpdate({ set: { playerJson: player.playerJson } });

    res.json({ success: true, playerId, toTournamentId });
  } catch (err) {
    logger.error("[brackets] Reassign error:", err);
    res.status(500).json({ error: "Failed to reassign player" });
  }
});

// ─── POST /:id/spawn — Spawn child bracket-tournaments ──────────────────────
router.post("/:id/spawn", authMiddleware, async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const userId = (req as any).user?.id;
    const [group] = await db
      .select()
      .from(bracketGroups)
      .where(eq(bracketGroups.id, req.params.id))
      .limit(1);

    if (!group) return res.status(404).json({ error: "Bracket group not found" });
    if (group.userId !== userId) return res.status(403).json({ error: "Forbidden" });

    const brackets = parseBrackets(group.bracketsJson);
    if (brackets.length === 0) {
      return res.status(400).json({ error: "No brackets defined" });
    }

    // Get the parent tournament state for shared config
    let parentState: Record<string, any> = {};
    let parentIsPublic = 0;
    if (group.parentTournamentId) {
      const [stateRow] = await db
        .select()
        .from(tournamentState)
        .where(eq(tournamentState.tournamentId, group.parentTournamentId))
        .limit(1);
      if (stateRow?.stateJson) {
        parentState = JSON.parse(stateRow.stateJson);
      }
      // Inherit parent's public visibility setting
      const [parentTournament] = await db
        .select({ isPublic: userTournaments.isPublic })
        .from(userTournaments)
        .where(eq(userTournaments.tournamentId, group.parentTournamentId))
        .limit(1);
      if (parentTournament) parentIsPublic = parentTournament.isPublic;
    }

    const spawnedTournaments: { tournamentId: string; label: string; order: number }[] = [];

    for (const bracket of brackets) {
      // Skip if already spawned
      if (bracket.tournamentId) {
        spawnedTournaments.push({
          tournamentId: bracket.tournamentId,
          label: bracket.label,
          order: bracket.order,
        });
        continue;
      }

      const tournamentId = `${group.parentTournamentId ?? group.id}-bracket-${bracket.order}`;

      // Create the child tournament in user_tournaments
      await db.insert(userTournaments).values({
        id: nanoid(12),
        userId,
        tournamentId,
        name: `${group.name} — ${bracket.label}`,
        venue: group.venue,
        date: group.date,
        format: group.format ?? "swiss",
        rounds: group.rounds ?? 5,
        status: "registration",
        parentBracketGroupId: group.id,
        bracketLabel: bracket.label,
        bracketOrder: bracket.order,
        isPublic: parentIsPublic,
        createdAt: new Date(),
      });

      // Create initial tournament state
      await db.insert(tournamentState).values({
        tournamentId,
        stateJson: JSON.stringify({
          tournamentName: `${group.name} — ${bracket.label}`,
          venue: group.venue,
          format: group.format ?? "swiss",
          rounds: group.rounds ?? 5,
          currentRound: 0,
          status: "created",
          players: [],
          pairings: [],
          results: [],
          bracketLabel: bracket.label,
          parentBracketGroupId: group.id,
          parentTournamentId: group.parentTournamentId ?? null,
        }),
        revision: 1,
        updatedAt: new Date(),
      });

      bracket.tournamentId = tournamentId;
      spawnedTournaments.push({
        tournamentId,
        label: bracket.label,
        order: bracket.order,
      });
    }

    // Update the bracket group with the spawned tournament IDs
    await db
      .update(bracketGroups)
      .set({
        bracketsJson: JSON.stringify(brackets),
        status: "assigned",
        updatedAt: new Date(),
      })
      .where(eq(bracketGroups.id, group.id));

    // ── Assign players to child tournaments ──────────────────────────────
    // The client sends players with an optional bracketIndex override.
    // If bracketIndex is provided, it takes priority over ELO range matching.
    const reqPlayers: Array<{
      id: string;
      name: string;
      elo: number;
      username?: string;
      bracketIndex?: number;
    }> = req.body.players ?? [];

    if (reqPlayers.length > 0) {
      // Get the actual DB player rows from the parent tournament
      const parentPlayers = group.parentTournamentId
        ? await db
            .select()
            .from(tournamentPlayers)
            .where(eq(tournamentPlayers.tournamentId, group.parentTournamentId))
        : [];

      const parentPlayerMap = new Map(
        parentPlayers.map((p) => [p.id, p])
      );

      for (const rp of reqPlayers) {
        // Determine target bracket index
        let targetIdx: number;
        if (rp.bracketIndex !== undefined && rp.bracketIndex >= 0 && rp.bracketIndex < spawnedTournaments.length) {
          targetIdx = rp.bracketIndex;
        } else {
          // Fallback: ELO range matching
          const bracketIdx = brackets.findIndex(
            (b) => rp.elo >= b.minElo && rp.elo <= b.maxElo
          );
          targetIdx = bracketIdx >= 0 ? bracketIdx : 0;
        }

        const targetTournamentId = spawnedTournaments[targetIdx]?.tournamentId;
        if (!targetTournamentId) continue;

        // Find the DB player row (by id or username)
        const dbPlayer = parentPlayerMap.get(rp.id)
          ?? parentPlayers.find((p) => p.username === rp.username);

        if (dbPlayer) {
          // Insert into child tournament (skip if already present)
          await db
            .insert(tournamentPlayers)
            .values({
              id: nanoid(12),
              tournamentId: targetTournamentId,
              username: dbPlayer.username,
              playerJson: dbPlayer.playerJson,
              joinedAt: new Date(),
            })
            .onDuplicateKeyUpdate({ set: { playerJson: dbPlayer.playerJson } });
        }
      }
    }

    res.json({ tournaments: spawnedTournaments });
  } catch (err) {
    logger.error("[brackets] Spawn error:", err);
    res.status(500).json({ error: "Failed to spawn bracket tournaments" });
  }
});

// ─── GET /:id/brackets — List child bracket-tournaments ─────────────────────
router.get("/:id/brackets", async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const [group] = await db
      .select()
      .from(bracketGroups)
      .where(eq(bracketGroups.id, req.params.id))
      .limit(1);

    if (!group) return res.status(404).json({ error: "Bracket group not found" });

    // Get all child tournaments
    const children = await db
      .select()
      .from(userTournaments)
      .where(eq(userTournaments.parentBracketGroupId!, group.id));

    // Get player counts per child tournament
    const childIds = children.map((c) => c.tournamentId);
    let playerCounts: Record<string, number> = {};

    if (childIds.length > 0) {
      const players = await db
        .select()
        .from(tournamentPlayers)
        .where(inArray(tournamentPlayers.tournamentId, childIds));

      for (const p of players) {
        playerCounts[p.tournamentId] = (playerCounts[p.tournamentId] ?? 0) + 1;
      }
    }

    const brackets = children
      .sort((a, b) => (a.bracketOrder ?? 0) - (b.bracketOrder ?? 0))
      .map((c) => ({
        tournamentId: c.tournamentId,
        label: c.bracketLabel,
        order: c.bracketOrder,
        format: c.format,
        rounds: c.rounds,
        status: c.status,
        playerCount: playerCounts[c.tournamentId] ?? 0,
      }));

    res.json({ groupId: group.id, name: group.name, brackets });
  } catch (err) {
    logger.error("[brackets] List brackets error:", err);
    res.status(500).json({ error: "Failed to list brackets" });
  }
});

export default router;
