/**
 * repertoireBuilder.ts — API routes for the Opening Repertoire Builder.
 *
 * CRUD for user-created repertoires with Pro limit enforcement:
 *   - Free users: max 1 saved repertoire
 *   - Pro / Staff users: unlimited
 *
 * Routes:
 *   GET    /api/repertoire-builder          — list user's repertoires
 *   GET    /api/repertoire-builder/:id      — get single repertoire
 *   POST   /api/repertoire-builder          — create new repertoire
 *   PUT    /api/repertoire-builder/:id      — update repertoire (name, color, moveTree)
 *   DELETE /api/repertoire-builder/:id      — delete repertoire
 */
import { Router } from "express";
import { nanoid } from "nanoid";
import { eq, and, desc } from "drizzle-orm";
import { getDb } from "./db.js";
import { repertoires, users } from "../shared/schema.js";
import { requireFullAuth } from "./auth.js";
import { logger } from "./logger.js";

const FREE_REPERTOIRE_LIMIT = 1;

export function createRepertoireBuilderRouter(): Router {
  const router = Router();

  // All routes require a full (non-guest) account
  router.use(requireFullAuth);

  // ── Helper: check if user is Pro or Staff ──────────────────────────────────
  async function isProUser(userId: string): Promise<boolean> {
    const db = await getDb();
    const [user] = await db
      .select({ isPro: users.isPro, isStaff: users.isStaff, proExpiresAt: users.proExpiresAt })
      .from(users)
      .where(eq(users.id, userId));
    if (!user) return false;
    // Staff always have Pro access
    if (user.isStaff) return true;
    // Check Pro with expiry
    if (user.isPro) {
      if (user.proExpiresAt && new Date() > new Date(user.proExpiresAt)) return false;
      return true;
    }
    return false;
  }

  // ── GET / — list user's repertoires ────────────────────────────────────────
  router.get("/", async (req: any, res) => {
    try {
      const db = await getDb();
      const rows = await db
        .select({
          id: repertoires.id,
          title: repertoires.title,
          color: repertoires.color,
          authorType: repertoires.authorType,
          createdAt: repertoires.createdAt,
          updatedAt: repertoires.updatedAt,
        })
        .from(repertoires)
        .where(
          and(
            eq(repertoires.authorUserId, req.userId),
            eq(repertoires.authorType, "user"),
          )
        )
        .orderBy(desc(repertoires.updatedAt));

      const isPro = await isProUser(req.userId);
      return res.json({ repertoires: rows, isPro, limit: isPro ? null : FREE_REPERTOIRE_LIMIT });
    } catch (err) {
      logger.error("[repertoire-builder] list error:", err);
      return res.status(500).json({ error: "Failed to list repertoires" });
    }
  });

  // ── GET /:id — get single repertoire ───────────────────────────────────────
  router.get("/:id", async (req: any, res) => {
    try {
      const db = await getDb();
      const [row] = await db
        .select()
        .from(repertoires)
        .where(
          and(
            eq(repertoires.id, req.params.id),
            eq(repertoires.authorUserId, req.userId),
            eq(repertoires.authorType, "user"),
          )
        );
      if (!row) return res.status(404).json({ error: "Repertoire not found" });
      return res.json({ repertoire: row });
    } catch (err) {
      logger.error("[repertoire-builder] get error:", err);
      return res.status(500).json({ error: "Failed to get repertoire" });
    }
  });

  // ── POST / — create new repertoire ─────────────────────────────────────────
  router.post("/", async (req: any, res) => {
    try {
      const { name, color = "white" } = req.body as { name?: string; color?: string };
      if (!name || !name.trim()) {
        return res.status(400).json({ error: "name is required" });
      }

      const db = await getDb();

      // Enforce free-user limit
      const isPro = await isProUser(req.userId);
      if (!isPro) {
        const existing = await db
          .select({ id: repertoires.id })
          .from(repertoires)
          .where(
            and(
              eq(repertoires.authorUserId, req.userId),
              eq(repertoires.authorType, "user"),
            )
          );
        if (existing.length >= FREE_REPERTOIRE_LIMIT) {
          return res.status(403).json({
            error: "Free users can save up to 1 repertoire. Upgrade to Pro for unlimited.",
            code: "PRO_REQUIRED",
          });
        }
      }

      const id = nanoid();
      const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      const initialTree = JSON.stringify({
        fen: color === "black"
          ? "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
          : "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        children: [],
      });

      await db.insert(repertoires).values({
        id,
        title: name.trim(),
        slug,
        color: color === "black" ? "black" : "white",
        authorType: "user",
        authorUserId: req.userId,
        authorName: null,
        description: null,
        targetLevel: "intermediate",
        isPublished: 0,
        isFeatured: 0,
        lineCount: 0,
        estimatedMinutes: null,
        coverImageUrl: null,
        sortOrder: 100,
        moveTree: initialTree,
      });

      return res.status(201).json({ id, name: name.trim(), color });
    } catch (err) {
      logger.error("[repertoire-builder] create error:", err);
      return res.status(500).json({ error: "Failed to create repertoire" });
    }
  });

  // ── PUT /:id — update repertoire ───────────────────────────────────────────
  router.put("/:id", async (req: any, res) => {
    try {
      const { name, color, moveTree } = req.body as {
        name?: string;
        color?: string;
        moveTree?: string;
      };

      const db = await getDb();

      // Verify ownership
      const [existing] = await db
        .select({ id: repertoires.id })
        .from(repertoires)
        .where(
          and(
            eq(repertoires.id, req.params.id),
            eq(repertoires.authorUserId, req.userId),
            eq(repertoires.authorType, "user"),
          )
        );
      if (!existing) return res.status(404).json({ error: "Repertoire not found" });

      const updates: Record<string, unknown> = {};
      if (name !== undefined) {
        updates.title = name.trim();
        updates.slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      }
      if (color !== undefined) updates.color = color;
      if (moveTree !== undefined) updates.moveTree = typeof moveTree === "string" ? moveTree : JSON.stringify(moveTree);

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: "No fields to update" });
      }

      await db.update(repertoires).set(updates).where(eq(repertoires.id, req.params.id));
      return res.json({ ok: true });
    } catch (err) {
      logger.error("[repertoire-builder] update error:", err);
      return res.status(500).json({ error: "Failed to update repertoire" });
    }
  });

  // ── DELETE /:id — delete repertoire ────────────────────────────────────────
  router.delete("/:id", async (req: any, res) => {
    try {
      const db = await getDb();
      const [existing] = await db
        .select({ id: repertoires.id })
        .from(repertoires)
        .where(
          and(
            eq(repertoires.id, req.params.id),
            eq(repertoires.authorUserId, req.userId),
            eq(repertoires.authorType, "user"),
          )
        );
      if (!existing) return res.status(404).json({ error: "Repertoire not found" });

      await db.delete(repertoires).where(eq(repertoires.id, req.params.id));
      return res.json({ ok: true });
    } catch (err) {
      logger.error("[repertoire-builder] delete error:", err);
      return res.status(500).json({ error: "Failed to delete repertoire" });
    }
  });

  return router;
}
