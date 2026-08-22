/** User-owned tournament registry and public join-link resolution routes. */
import { Router } from "express";
import { and, eq, ne, or } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getDb } from "./db.js";
import { userTournaments } from "../shared/schema.js";
import { logger } from "./logger.js";
import { getRequestToken, getTokenPayload } from "./authCore.js";

function requireUserId(req: import("express").Request, res: import("express").Response): string | null {
  if (!getRequestToken(req)) {
    res.status(401).json({ error: "Not authenticated" });
    return null;
  }
  const payload = getTokenPayload(req);
  if (!payload) {
    res.status(401).json({ error: "Invalid or expired token" });
    return null;
  }
  return payload.sub;
}

export function createUserTournamentRouter(): Router {
  const router = Router();

  router.get("/user/tournaments", async (req, res) => {
    const userId = requireUserId(req, res);
    if (!userId) return;
    try {
      const db = await getDb();
      const tournaments = await db.select().from(userTournaments)
        .where(eq(userTournaments.userId, userId))
        .orderBy(userTournaments.createdAt);
      return res.json({ tournaments });
    } catch (error) {
      logger.error("[user-tournaments] list error:", error);
      return res.status(500).json({ error: "Failed to fetch tournaments" });
    }
  });

  router.post("/user/tournaments", async (req, res) => {
    const userId = requireUserId(req, res);
    if (!userId) return;
    const { tournamentId, name, venue, date, format, rounds, inviteCode, status } = req.body as {
      tournamentId: string;
      name: string;
      venue?: string;
      date?: string;
      format?: string;
      rounds?: number;
      inviteCode?: string;
      status?: string;
    };
    if (!tournamentId || !name) return res.status(400).json({ error: "tournamentId and name are required" });
    try {
      const db = await getDb();
      const [existing] = await db.select().from(userTournaments)
        .where(eq(userTournaments.tournamentId, tournamentId)).limit(1);
      if (!existing) {
        await db.insert(userTournaments).values({
          id: nanoid(), userId, tournamentId, name,
          venue: venue ?? null, date: date ?? null, format: format ?? null,
          rounds: rounds ?? null, inviteCode: inviteCode ?? null,
          status: status ?? "registration",
        });
      } else if (status) {
        await db.update(userTournaments).set({ status }).where(eq(userTournaments.tournamentId, tournamentId));
      }
      return res.json({ ok: true });
    } catch (error) {
      logger.error("[user-tournaments] save error:", error);
      return res.status(500).json({ error: "Failed to save tournament" });
    }
  });

  router.delete("/user/tournaments/:tournamentId", async (req, res) => {
    const userId = requireUserId(req, res);
    if (!userId) return;
    const { tournamentId } = req.params;
    if (!tournamentId) return res.status(400).json({ error: "tournamentId is required" });
    try {
      const db = await getDb();
      const [existing] = await db.select({ id: userTournaments.id, userId: userTournaments.userId })
        .from(userTournaments).where(eq(userTournaments.tournamentId, tournamentId)).limit(1);
      if (!existing) return res.status(404).json({ error: "Tournament not found" });
      if (existing.userId !== userId) return res.status(403).json({ error: "Not authorised to delete this tournament" });
      await db.delete(userTournaments).where(eq(userTournaments.tournamentId, tournamentId));
      logger.info(`[user-tournaments] Tournament ${tournamentId} deleted by user ${userId}`);
      return res.json({ ok: true });
    } catch (error) {
      logger.error("[user-tournaments] delete error:", error);
      return res.status(500).json({ error: "Failed to delete tournament" });
    }
  });

  router.patch("/user/tournaments/:tournamentId/custom-slug", async (req, res) => {
    const userId = requireUserId(req, res);
    if (!userId) return;
    const { tournamentId } = req.params;
    if (!tournamentId) return res.status(400).json({ error: "tournamentId is required" });
    const slug = ((req.body as { customSlug?: string }).customSlug ?? "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
    try {
      const db = await getDb();
      const [existing] = await db.select({ id: userTournaments.id, userId: userTournaments.userId })
        .from(userTournaments).where(eq(userTournaments.tournamentId, tournamentId)).limit(1);
      if (!existing) return res.status(404).json({ error: "Tournament not found" });
      if (existing.userId !== userId) return res.status(403).json({ error: "Not authorised" });
      await db.update(userTournaments).set({ customSlug: slug || null }).where(eq(userTournaments.tournamentId, tournamentId));
      return res.json({ ok: true, customSlug: slug || null });
    } catch (error) {
      logger.error("[user-tournaments] custom-slug error:", error);
      return res.status(500).json({ error: "Failed to update custom slug" });
    }
  });

  router.get("/join/resolve/:codeOrSlug", async (req, res) => {
    const { codeOrSlug } = req.params;
    if (!codeOrSlug) return res.status(400).json({ error: "codeOrSlug is required" });
    try {
      const db = await getDb();
      const [tournament] = await db.select({
        tournamentId: userTournaments.tournamentId,
        name: userTournaments.name,
        venue: userTournaments.venue,
        date: userTournaments.date,
        format: userTournaments.format,
        rounds: userTournaments.rounds,
        inviteCode: userTournaments.inviteCode,
        customSlug: userTournaments.customSlug,
      }).from(userTournaments).where(or(
        eq(userTournaments.inviteCode, codeOrSlug.toUpperCase()),
        eq(userTournaments.customSlug, codeOrSlug),
      )).limit(1);
      if (!tournament) return res.status(404).json({ error: "Tournament not found" });
      return res.json(tournament);
    } catch (error) {
      logger.error("[join] resolve error:", error);
      return res.status(500).json({ error: "Failed to resolve tournament" });
    }
  });

  router.get("/tournament/:tournamentId/meta", async (req, res) => {
    const { tournamentId } = req.params;
    if (!tournamentId) return res.status(400).json({ error: "tournamentId is required" });
    try {
      const db = await getDb();
      const [tournament] = await db.select({
        tournamentId: userTournaments.tournamentId,
        name: userTournaments.name,
        customSlug: userTournaments.customSlug,
        inviteCode: userTournaments.inviteCode,
      }).from(userTournaments).where(eq(userTournaments.tournamentId, tournamentId)).limit(1);
      if (!tournament) return res.status(404).json({ error: "Tournament not found" });
      return res.json(tournament);
    } catch (error) {
      logger.error("[user-tournaments] meta error:", error);
      return res.status(500).json({ error: "Failed to fetch tournament meta" });
    }
  });

  router.get("/join/check-slug/:slug", async (req, res) => {
    const { slug } = req.params;
    const exclude = (req.query.exclude as string | undefined) ?? "";
    if (!slug || slug.length < 2 || slug.length > 60) return res.json({ available: false, conflict: "Slug must be 2–60 characters" });
    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug)) return res.json({ available: false, conflict: "Only lowercase letters, numbers, and hyphens allowed" });
    try {
      const db = await getDb();
      const where = exclude
        ? and(eq(userTournaments.customSlug, slug), ne(userTournaments.tournamentId, exclude))
        : eq(userTournaments.customSlug, slug);
      const [conflict] = await db.select({ tournamentId: userTournaments.tournamentId, name: userTournaments.name })
        .from(userTournaments).where(where).limit(1);
      return conflict
        ? res.json({ available: false, conflict: `Already used by "${conflict.name ?? "another tournament"}"` })
        : res.json({ available: true, conflict: null });
    } catch (error) {
      logger.error("[join] check-slug error:", error);
      return res.status(500).json({ error: "Failed to check slug availability" });
    }
  });

  return router;
}
