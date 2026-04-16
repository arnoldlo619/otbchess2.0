/**
 * openingsAdmin.ts — Internal admin API for managing the openings database.
 *
 * All routes are protected by requireAdmin middleware which checks:
 * 1. User is authenticated (requireFullAuth)
 * 2. User is the site owner (OWNER_OPEN_ID match)
 *
 * Routes:
 *   GET    /api/admin/openings              — List all openings (with stats)
 *   POST   /api/admin/openings              — Create opening
 *   GET    /api/admin/openings/:id          — Get opening detail
 *   PUT    /api/admin/openings/:id          — Update opening
 *   DELETE /api/admin/openings/:id          — Delete opening (cascade)
 *
 *   GET    /api/admin/openings/:id/lines    — List lines for opening
 *   POST   /api/admin/openings/:id/lines    — Create line
 *   GET    /api/admin/lines/:lineId         — Get line detail
 *   PUT    /api/admin/lines/:lineId         — Update line
 *   DELETE /api/admin/lines/:lineId         — Delete line
 *
 *   POST   /api/admin/lines/:lineId/validate — Validate line
 *   POST   /api/admin/lines/bulk-publish    — Bulk publish/unpublish
 *   POST   /api/admin/lines/bulk-tag        — Bulk tag lines
 *
 *   GET    /api/admin/tags                  — List all tags
 *   POST   /api/admin/tags                  — Create tag
 *   PUT    /api/admin/tags/:id              — Update tag
 *   DELETE /api/admin/tags/:id              — Delete tag
 *
 *   POST   /api/admin/import/pgn            — Import PGN → generate line + nodes
 *   GET    /api/admin/qa/dashboard          — QA dashboard stats
 *   GET    /api/admin/qa/incomplete         — Lines with missing content
 *   GET    /api/admin/qa/duplicates         — Duplicate/overlapping lines
 */

import { Router, type Request, type Response, type NextFunction } from "express";
import { requireFullAuth } from "./auth.js";
import { getDb } from "./db.js";
import {
  openings,
  openingLines,
  lineNodes,
  openingTags,
  openingTagMap,
  lineTagMap,
} from "../shared/schema.js";
import { eq, sql, asc, inArray, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { Chess } from "chess.js";

// ─── Admin Middleware ─────────────────────────────────────────────────────────

const OWNER_OPEN_ID = process.env.OWNER_OPEN_ID ?? "";

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const userId = (req as Request & { userId: string }).userId;
  if (!userId || userId !== OWNER_OPEN_ID) {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** Parse a SAN move sequence and return FEN, UCI moves, and ply count */
function parseMoveSequence(sanMoves: string): {
  valid: boolean;
  error?: string;
  fen: string;
  uci: string[];
  san: string[];
  pgn: string;
  plyCount: number;
} {
  const chess = new Chess();
  const uciMoves: string[] = [];
  const sanList: string[] = [];

  // Strip move numbers: "1.e4 e5 2.Nf3" → ["e4", "e5", "Nf3"]
  const tokens = sanMoves
    .replace(/\d+\.\s*/g, " ")
    .replace(/\.\.\./g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  for (const token of tokens) {
    try {
      const move = chess.move(token);
      if (!move) {
        return { valid: false, error: `Illegal move: ${token}`, fen: "", uci: [], san: [], pgn: "", plyCount: 0 };
      }
      uciMoves.push(move.from + move.to + (move.promotion ?? ""));
      sanList.push(move.san);
    } catch {
      return { valid: false, error: `Invalid move: ${token}`, fen: "", uci: [], san: [], pgn: "", plyCount: 0 };
    }
  }

  return {
    valid: true,
    fen: chess.fen(),
    uci: uciMoves,
    san: sanList,
    pgn: chess.pgn(),
    plyCount: sanList.length,
  };
}

/** Validate a FEN string */
function validateFen(fen: string): { valid: boolean; error?: string } {
  try {
    new Chess(fen);
    return { valid: true };
  } catch {
    return { valid: false, error: "Invalid FEN string" };
  }
}

/** Check content completeness for a line */
interface LineRecord {
  title?: string | null;
  slug?: string | null;
  eco?: string | null;
  pgn?: string | null;
  finalFen?: string | null;
  description?: string | null;
  difficulty?: string | null;
  color?: string | null;
  strategicSummary?: string | null;
  hintText?: string | null;
  [key: string]: unknown;
}

function checkCompleteness(line: LineRecord): {
  complete: boolean;
  missing: string[];
} {
  const missing: string[] = [];
  const checks: [string, unknown][] = [
    ["title", line.title],
    ["slug", line.slug],
    ["eco", line.eco],
    ["pgn", line.pgn],
    ["finalFen", line.finalFen],
    ["description", line.description],
    ["difficulty", line.difficulty],
    ["color", line.color],
    ["strategicSummary", line.strategicSummary],
    ["hintText", line.hintText],
  ];
  for (const [name, val] of checks) {
    if (!val || (typeof val === "string" && val.trim() === "")) {
      missing.push(name);
    }
  }
  return { complete: missing.length === 0, missing };
}

// ─── Router ───────────────────────────────────────────────────────────────────

export function createOpeningsAdminRouter(): Router {
  const router = Router();

  // All routes require full auth + admin
  router.use(requireFullAuth);
  router.use(requireAdmin);

  // ── OPENINGS CRUD ─────────────────────────────────────────────────────────

  /** List all openings with line counts and publish stats */
  router.get("/openings", async (_req: Request, res: Response) => {
    try {
      const db = await getDb();
      const rows = await db
        .select({
          id: openings.id,
          name: openings.name,
          slug: openings.slug,
          color: openings.color,
          eco: openings.eco,
          difficulty: openings.difficulty,
          isFeatured: openings.isFeatured,
          starterFriendly: openings.starterFriendly,
          isPublished: openings.isPublished,
          createdAt: openings.createdAt,
        })
        .from(openings)
        .orderBy(asc(openings.name));

      // Get line counts per opening
      const lineCounts = await db
        .select({
          openingId: openingLines.openingId,
          total: sql<number>`COUNT(*)`.as("total"),
          published: sql<number>`SUM(CASE WHEN ${openingLines.isPublished} = 1 THEN 1 ELSE 0 END)`.as("published"),
          draft: sql<number>`SUM(CASE WHEN ${openingLines.isPublished} = 0 THEN 1 ELSE 0 END)`.as("draft"),
        })
        .from(openingLines)
        .groupBy(openingLines.openingId);

      const countMap = new Map(
        lineCounts.map((c: { openingId: string; total: number; published: number; draft: number }) => [c.openingId, c])
      );

      const result = rows.map((o) => ({
        ...o,
        lineStats: countMap.get(o.id) ?? { total: 0, published: 0, draft: 0 },
      }));

      res.json({ openings: result });
    } catch (err) {
      console.error("[admin] list openings error:", err);
      res.status(500).json({ error: "Failed to list openings" });
    }
  });

  /** Create a new opening */
  router.post("/openings", async (req: Request, res: Response) => {
    try {
      const db = await getDb();
      const {
        name, color: side, eco, startingMoves, startingFen,
        description, summary, difficulty, popularity,
        playCharacter, themes, isFeatured, starterFriendly,
        estimatedLineCount, trapPotential, strategicComplexity,
      } = req.body;

      if (!name || !side || !eco) {
        return res.status(400).json({ error: "name, color, and eco are required" });
      }

      const id = nanoid(16);
      const slug = slugify(name);

      await db.insert(openings).values({
        id,
        name,
        slug,
        color: side,
        eco,
        startingMoves: startingMoves ?? "",
        startingFen: startingFen ?? "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        description: description ?? "",
        summary: summary ?? "",
        difficulty: difficulty ?? "intermediate",
        popularity: popularity ?? 50,
        playCharacter: playCharacter ?? "universal",
        themes: themes ? JSON.stringify(themes) : null,
        isFeatured: isFeatured ? 1 : 0,
        starterFriendly: starterFriendly ? 1 : 0,
        estimatedLineCount: estimatedLineCount ?? 0,
        trapPotential: trapPotential ?? 50,
        strategicComplexity: strategicComplexity ?? 50,
      });

      res.status(201).json({ id, slug });
    } catch (err) {
      console.error("[admin] create opening error:", err);
      res.status(500).json({ error: "Failed to create opening" });
    }
  });

  /** Get opening detail */
  router.get("/openings/:id", async (req: Request, res: Response) => {
    try {
      const db = await getDb();
      const [opening] = await db
        .select()
        .from(openings)
        .where(eq(openings.id, req.params.id))
        .limit(1);

      if (!opening) return res.status(404).json({ error: "Opening not found" });

      // Get tags
      const tags = await db
        .select({ tagId: openingTagMap.tagId, tagName: openingTags.name, category: openingTags.category })
        .from(openingTagMap)
        .innerJoin(openingTags, eq(openingTagMap.tagId, openingTags.id))
        .where(eq(openingTagMap.openingId, req.params.id));

      res.json({ opening, tags });
    } catch (err) {
      console.error("[admin] get opening error:", err);
      res.status(500).json({ error: "Failed to get opening" });
    }
  });

  /** Update opening */
  router.put("/openings/:id", async (req: Request, res: Response) => {
    try {
      const db = await getDb();
      const updates: Record<string, unknown> = {};
      const fieldMap: Record<string, string> = {
        name: "name", slug: "slug", color: "color", eco: "eco",
        startingMoves: "starting_moves", startingFen: "starting_fen",
        description: "description", summary: "summary", difficulty: "difficulty",
        popularity: "popularity", playCharacter: "play_character",
        themes: "themes", lineCount: "line_count", sortOrder: "sort_order",
        isPublished: "is_published", authorName: "author_name",
        coverImageUrl: "cover_image_url", isFeatured: "is_featured",
        starterFriendly: "starter_friendly", estimatedLineCount: "estimated_line_count",
        trapPotential: "trap_potential", strategicComplexity: "strategic_complexity",
      };

      for (const [camel, _snake] of Object.entries(fieldMap)) {
        if (req.body[camel] !== undefined) {
          let value = req.body[camel];
          if (camel === "isFeatured" || camel === "starterFriendly" || camel === "isPublished") {
            value = value ? 1 : 0;
          }
          if (camel === "themes" && Array.isArray(value)) {
            value = JSON.stringify(value);
          }
          updates[camel] = value;
        }
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: "No valid fields to update" });
      }

      await db.update(openings).set(updates).where(eq(openings.id, req.params.id));
      res.json({ success: true });
    } catch (err) {
      console.error("[admin] update opening error:", err);
      res.status(500).json({ error: "Failed to update opening" });
    }
  });

  /** Delete opening (and its lines) */
  router.delete("/openings/:id", async (req: Request, res: Response) => {
    try {
      const db = await getDb();
      // Delete associated data first
      const lines = await db
        .select({ id: openingLines.id })
        .from(openingLines)
        .where(eq(openingLines.openingId, req.params.id));

      const lineIds = lines.map((l) => l.id);

      if (lineIds.length > 0) {
        await db.delete(lineNodes).where(inArray(lineNodes.lineId, lineIds));
        await db.delete(lineTagMap).where(inArray(lineTagMap.lineId, lineIds));
        await db.delete(openingLines).where(inArray(openingLines.id, lineIds));
      }

      await db.delete(openingTagMap).where(eq(openingTagMap.openingId, req.params.id));
      await db.delete(openings).where(eq(openings.id, req.params.id));

      res.json({ success: true, deletedLines: lineIds.length });
    } catch (err) {
      console.error("[admin] delete opening error:", err);
      res.status(500).json({ error: "Failed to delete opening" });
    }
  });

  // ── LINES CRUD ────────────────────────────────────────────────────────────

  /** List lines for an opening */
  router.get("/openings/:id/lines", async (req: Request, res: Response) => {
    try {
      const db = await getDb();
      const rows = await db
        .select()
        .from(openingLines)
        .where(eq(openingLines.openingId, req.params.id))
        .orderBy(asc(openingLines.sortOrder));

      const result = rows.map((line) => {
        const { complete, missing } = checkCompleteness(line as unknown as LineRecord);
        return { ...line, _qa: { complete, missing } };
      });

      res.json({ lines: result });
    } catch (err) {
      console.error("[admin] list lines error:", err);
      res.status(500).json({ error: "Failed to list lines" });
    }
  });

  /** Create a new line */
  router.post("/openings/:id/lines", async (req: Request, res: Response) => {
    try {
      const db = await getDb();
      const openingId = req.params.id;
      const {
        title, eco, moveSequence, difficulty, color,
        commonness, priority, isMustKnow, isTrap, lineType,
        description, strategicSummary, hintText, punishmentIdea,
        pawnStructure, themes, sortOrder,
      } = req.body;

      if (!title || !moveSequence) {
        return res.status(400).json({ error: "title and moveSequence are required" });
      }

      // Parse and validate moves
      const parsed = parseMoveSequence(moveSequence);
      if (!parsed.valid) {
        return res.status(400).json({ error: `Invalid moves: ${parsed.error}` });
      }

      const id = nanoid(16);
      const slug = slugify(title);

      await db.insert(openingLines).values({
        id,
        openingId,
        title,
        slug,
        eco: eco ?? "A00",
        pgn: parsed.pgn,
        finalFen: parsed.fen,
        plyCount: parsed.plyCount,
        description: description ?? "",
        difficulty: difficulty ?? "intermediate",
        commonness: commonness ?? 50,
        priority: priority ?? 50,
        isMustKnow: isMustKnow ? 1 : 0,
        isTrap: isTrap ? 1 : 0,
        lineType: lineType ?? "main",
        color: color ?? "white",
        strategicSummary: strategicSummary ?? null,
        hintText: hintText ?? null,
        punishmentIdea: punishmentIdea ?? null,
        pawnStructure: pawnStructure ?? null,
        themes: themes ? JSON.stringify(themes) : null,
        sortOrder: sortOrder ?? 100,
        isPublished: 0,
        authorName: "ChessOTB Staff",
      });

      res.status(201).json({
        id,
        slug,
        fen: parsed.fen,
        pgn: parsed.pgn,
        plyCount: parsed.plyCount,
        uciMoves: parsed.uci.join(" "),
      });
    } catch (err) {
      console.error("[admin] create line error:", err);
      res.status(500).json({ error: "Failed to create line" });
    }
  });

  /** Get line detail */
  router.get("/lines/:lineId", async (req: Request, res: Response) => {
    try {
      const db = await getDb();
      const [line] = await db
        .select()
        .from(openingLines)
        .where(eq(openingLines.id, req.params.lineId))
        .limit(1);

      if (!line) return res.status(404).json({ error: "Line not found" });

      // Get nodes
      const nodes = await db
        .select()
        .from(lineNodes)
        .where(eq(lineNodes.lineId, req.params.lineId))
        .orderBy(asc(lineNodes.ply));

      // Get tags
      const tags = await db
        .select({ tagId: lineTagMap.tagId, tagName: openingTags.name, category: openingTags.category })
        .from(lineTagMap)
        .innerJoin(openingTags, eq(lineTagMap.tagId, openingTags.id))
        .where(eq(lineTagMap.lineId, req.params.lineId));

      const { complete, missing } = checkCompleteness(line as unknown as LineRecord);

      res.json({ line, nodes, tags, _qa: { complete, missing } });
    } catch (err) {
      console.error("[admin] get line error:", err);
      res.status(500).json({ error: "Failed to get line" });
    }
  });

  /** Update line */
  router.put("/lines/:lineId", async (req: Request, res: Response) => {
    try {
      const db = await getDb();
      const updates: Record<string, unknown> = {};
      const allowedFields = [
        "title", "slug", "eco", "description", "difficulty",
        "commonness", "priority", "isMustKnow", "isTrap", "lineType",
        "color", "strategicSummary", "hintText", "punishmentIdea",
        "pawnStructure", "themes", "sortOrder", "isPublished", "authorName",
      ];

      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          let value = req.body[field];
          if (field === "isMustKnow" || field === "isTrap" || field === "isPublished") {
            value = value ? 1 : 0;
          }
          if (field === "themes" && Array.isArray(value)) {
            value = JSON.stringify(value);
          }
          updates[field] = value;
        }
      }

      // If moveSequence is provided, re-parse and update PGN/FEN
      if (req.body.moveSequence) {
        const parsed = parseMoveSequence(req.body.moveSequence);
        if (!parsed.valid) {
          return res.status(400).json({ error: `Invalid moves: ${parsed.error}` });
        }
        updates.pgn = parsed.pgn;
        updates.finalFen = parsed.fen;
        updates.plyCount = parsed.plyCount;
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: "No valid fields to update" });
      }

      await db.update(openingLines).set(updates).where(eq(openingLines.id, req.params.lineId));
      res.json({ success: true });
    } catch (err) {
      console.error("[admin] update line error:", err);
      res.status(500).json({ error: "Failed to update line" });
    }
  });

  /** Delete line */
  router.delete("/lines/:lineId", async (req: Request, res: Response) => {
    try {
      const db = await getDb();
      await db.delete(lineNodes).where(eq(lineNodes.lineId, req.params.lineId));
      await db.delete(lineTagMap).where(eq(lineTagMap.lineId, req.params.lineId));
      await db.delete(openingLines).where(eq(openingLines.id, req.params.lineId));
      res.json({ success: true });
    } catch (err) {
      console.error("[admin] delete line error:", err);
      res.status(500).json({ error: "Failed to delete line" });
    }
  });

  /** Validate a line's move legality and FEN integrity */
  router.post("/lines/:lineId/validate", async (req: Request, res: Response) => {
    try {
      const db = await getDb();
      const [line] = await db
        .select()
        .from(openingLines)
        .where(eq(openingLines.id, req.params.lineId))
        .limit(1);

      if (!line) return res.status(404).json({ error: "Line not found" });

      const issues: string[] = [];

      // Validate PGN
      const parsed = parseMoveSequence(line.pgn);
      if (!parsed.valid) {
        issues.push(`PGN invalid: ${parsed.error}`);
      } else {
        if (parsed.fen !== line.finalFen) {
          issues.push(`FEN mismatch: computed "${parsed.fen}" vs stored "${line.finalFen}"`);
        }
        if (parsed.plyCount !== line.plyCount) {
          issues.push(`Ply count mismatch: computed ${parsed.plyCount} vs stored ${line.plyCount}`);
        }
      }

      // Validate stored FEN
      const fenCheck = validateFen(line.finalFen);
      if (!fenCheck.valid) {
        issues.push(`Stored FEN invalid: ${fenCheck.error}`);
      }

      // Check completeness
      const { complete, missing } = checkCompleteness(line as unknown as LineRecord);

      res.json({
        valid: issues.length === 0,
        issues,
        completeness: { complete, missing },
      });
    } catch (err) {
      console.error("[admin] validate line error:", err);
      res.status(500).json({ error: "Failed to validate line" });
    }
  });

  // ── BULK OPERATIONS ───────────────────────────────────────────────────────

  /** Bulk publish/unpublish lines */
  router.post("/lines/bulk-publish", async (req: Request, res: Response) => {
    try {
      const db = await getDb();
      const { lineIds, publish } = req.body;
      if (!Array.isArray(lineIds) || lineIds.length === 0) {
        return res.status(400).json({ error: "lineIds array required" });
      }

      await db
        .update(openingLines)
        .set({ isPublished: publish ? 1 : 0 })
        .where(inArray(openingLines.id, lineIds));

      res.json({ success: true, updated: lineIds.length });
    } catch (err) {
      console.error("[admin] bulk publish error:", err);
      res.status(500).json({ error: "Failed to bulk publish" });
    }
  });

  /** Bulk tag lines */
  router.post("/lines/bulk-tag", async (req: Request, res: Response) => {
    try {
      const db = await getDb();
      const { lineIds, tagId, action } = req.body;
      if (!Array.isArray(lineIds) || !tagId) {
        return res.status(400).json({ error: "lineIds and tagId required" });
      }

      if (action === "remove") {
        for (const lineId of lineIds) {
          await db
            .delete(lineTagMap)
            .where(and(eq(lineTagMap.lineId, lineId), eq(lineTagMap.tagId, tagId)));
        }
      } else {
        for (const lineId of lineIds) {
          await db.insert(lineTagMap).values({
            id: nanoid(16),
            lineId,
            tagId,
          }).onDuplicateKeyUpdate({ set: { tagId } });
        }
      }

      res.json({ success: true, updated: lineIds.length });
    } catch (err) {
      console.error("[admin] bulk tag error:", err);
      res.status(500).json({ error: "Failed to bulk tag" });
    }
  });

  // ── PGN IMPORT ────────────────────────────────────────────────────────────

  /** Import PGN and create a line with auto-generated nodes */
  router.post("/import/pgn", async (req: Request, res: Response) => {
    try {
      const db = await getDb();
      const { openingId, pgn, title, eco, difficulty, color, lineType } = req.body;

      if (!openingId || !pgn) {
        return res.status(400).json({ error: "openingId and pgn are required" });
      }

      // Parse the PGN
      const chess = new Chess();
      try {
        chess.loadPgn(pgn);
      } catch {
        return res.status(400).json({ error: "Invalid PGN format" });
      }

      const history = chess.history({ verbose: true });
      if (history.length === 0) {
        return res.status(400).json({ error: "PGN contains no moves" });
      }

      // Build SAN and UCI sequences
      const uciMoves = history.map((m) => m.from + m.to + (m.promotion ?? ""));

      // Build PGN with move numbers
      const pgnFormatted = new Chess();
      for (const m of history) {
        pgnFormatted.move(m.san);
      }

      // Create the line
      const lineId = nanoid(16);
      const lineTitle = title || `Imported: ${history.slice(0, 4).map((m) => m.san).join(" ")}`;
      const lineSlug = slugify(lineTitle);

      await db.insert(openingLines).values({
        id: lineId,
        openingId,
        title: lineTitle,
        slug: lineSlug,
        eco: eco ?? "A00",
        pgn: pgnFormatted.pgn(),
        finalFen: chess.fen(),
        plyCount: history.length,
        difficulty: difficulty ?? "intermediate",
        color: color ?? "white",
        lineType: lineType ?? "main",
        isPublished: 0,
        authorName: "ChessOTB Staff",
      });

      // Generate node tree
      const nodeChess = new Chess();
      let parentNodeId: string | null = null;

      for (let i = 0; i < history.length; i++) {
        const move = history[i];
        const nodeId = nanoid(16);

        nodeChess.move(move.san);

        await db.insert(lineNodes).values({
          id: nodeId,
          lineId,
          parentNodeId: parentNodeId,
          ply: i + 1,
          moveSan: move.san,
          moveUci: move.from + move.to + (move.promotion ?? ""),
          fen: nodeChess.fen(),
          isMainLine: 1,
          sortOrder: (i + 1) * 10,
        });

        parentNodeId = nodeId;
      }

      res.status(201).json({
        lineId,
        slug: lineSlug,
        fen: chess.fen(),
        pgn: pgnFormatted.pgn(),
        plyCount: history.length,
        nodesCreated: history.length,
        uciMoves: uciMoves.join(" "),
      });
    } catch (err) {
      console.error("[admin] PGN import error:", err);
      res.status(500).json({ error: "Failed to import PGN" });
    }
  });

  // ── TAGS CRUD ─────────────────────────────────────────────────────────────

  /** List all tags */
  router.get("/tags", async (_req: Request, res: Response) => {
    try {
      const db = await getDb();
      const tags = await db.select().from(openingTags).orderBy(asc(openingTags.category), asc(openingTags.name));
      res.json({ tags });
    } catch (err) {
      console.error("[admin] list tags error:", err);
      res.status(500).json({ error: "Failed to list tags" });
    }
  });

  /** Create tag */
  router.post("/tags", async (req: Request, res: Response) => {
    try {
      const db = await getDb();
      const { name, slug: tagSlug, category, description } = req.body;
      if (!name || !category) {
        return res.status(400).json({ error: "name and category are required" });
      }

      const id = nanoid(16);
      await db.insert(openingTags).values({
        id,
        name,
        slug: tagSlug || slugify(name),
        category,
        description: description ?? "",
      });

      res.status(201).json({ id });
    } catch (err) {
      console.error("[admin] create tag error:", err);
      res.status(500).json({ error: "Failed to create tag" });
    }
  });

  /** Update tag */
  router.put("/tags/:id", async (req: Request, res: Response) => {
    try {
      const db = await getDb();
      const updates: Record<string, unknown> = {};
      for (const field of ["name", "slug", "category", "description"]) {
        if (req.body[field] !== undefined) updates[field] = req.body[field];
      }
      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: "No valid fields to update" });
      }
      await db.update(openingTags).set(updates).where(eq(openingTags.id, req.params.id));
      res.json({ success: true });
    } catch (err) {
      console.error("[admin] update tag error:", err);
      res.status(500).json({ error: "Failed to update tag" });
    }
  });

  /** Delete tag */
  router.delete("/tags/:id", async (req: Request, res: Response) => {
    try {
      const db = await getDb();
      await db.delete(openingTagMap).where(eq(openingTagMap.tagId, req.params.id));
      await db.delete(lineTagMap).where(eq(lineTagMap.tagId, req.params.id));
      await db.delete(openingTags).where(eq(openingTags.id, req.params.id));
      res.json({ success: true });
    } catch (err) {
      console.error("[admin] delete tag error:", err);
      res.status(500).json({ error: "Failed to delete tag" });
    }
  });

  // ── QA DASHBOARD ──────────────────────────────────────────────────────────

  /** QA dashboard stats */
  router.get("/qa/dashboard", async (_req: Request, res: Response) => {
    try {
      const db = await getDb();
      const [openingCount] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(openings);

      const [lineStats] = await db
        .select({
          total: sql<number>`COUNT(*)`,
          published: sql<number>`SUM(CASE WHEN ${openingLines.isPublished} = 1 THEN 1 ELSE 0 END)`,
          draft: sql<number>`SUM(CASE WHEN ${openingLines.isPublished} = 0 THEN 1 ELSE 0 END)`,
        })
        .from(openingLines);

      const [nodeCount] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(lineNodes);

      const [tagCount] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(openingTags);

      // Get lines missing key content
      const allLines = await db.select().from(openingLines);
      const incomplete = allLines.filter((l) => {
        const { complete } = checkCompleteness(l as unknown as LineRecord);
        return !complete;
      });

      res.json({
        stats: {
          openings: openingCount.count,
          lines: lineStats,
          nodes: nodeCount.count,
          tags: tagCount.count,
          incompleteLines: incomplete.length,
        },
      });
    } catch (err) {
      console.error("[admin] QA dashboard error:", err);
      res.status(500).json({ error: "Failed to get QA stats" });
    }
  });

  /** Get incomplete lines */
  router.get("/qa/incomplete", async (_req: Request, res: Response) => {
    try {
      const db = await getDb();
      const allLines = await db.select().from(openingLines);

      const incomplete = allLines
        .map((line) => {
          const { complete, missing } = checkCompleteness(line as unknown as LineRecord);
          return complete ? null : { id: line.id, title: line.title, slug: line.slug, openingId: line.openingId, isPublished: line.isPublished, _missing: missing };
        })
        .filter(Boolean);

      res.json({ lines: incomplete });
    } catch (err) {
      console.error("[admin] incomplete lines error:", err);
      res.status(500).json({ error: "Failed to get incomplete lines" });
    }
  });

  /** Detect duplicate/overlapping lines */
  router.get("/qa/duplicates", async (_req: Request, res: Response) => {
    try {
      const db = await getDb();
      const allLines = await db
        .select({
          id: openingLines.id,
          title: openingLines.title,
          openingId: openingLines.openingId,
          pgn: openingLines.pgn,
          finalFen: openingLines.finalFen,
        })
        .from(openingLines);

      const duplicates: { lineA: string; lineB: string; reason: string }[] = [];

      // Check for FEN duplicates (exact same final position)
      const fenMap = new Map<string, typeof allLines>();
      for (const line of allLines) {
        const existing = fenMap.get(line.finalFen);
        if (existing) {
          for (const other of existing) {
            duplicates.push({
              lineA: `${line.title} (${line.id})`,
              lineB: `${other.title} (${other.id})`,
              reason: "Same final FEN position",
            });
          }
          existing.push(line);
        } else {
          fenMap.set(line.finalFen, [line]);
        }
      }

      // Check for PGN prefix overlaps within same opening
      for (let i = 0; i < allLines.length; i++) {
        for (let j = i + 1; j < allLines.length; j++) {
          const a = allLines[i];
          const b = allLines[j];
          if (a.openingId !== b.openingId) continue;
          if (a.pgn === b.pgn) {
            duplicates.push({
              lineA: `${a.title} (${a.id})`,
              lineB: `${b.title} (${b.id})`,
              reason: "Identical PGN",
            });
          } else if (a.pgn.startsWith(b.pgn) || b.pgn.startsWith(a.pgn)) {
            duplicates.push({
              lineA: `${a.title} (${a.id})`,
              lineB: `${b.title} (${b.id})`,
              reason: "PGN prefix overlap (one line extends the other)",
            });
          }
        }
      }

      res.json({ duplicates, count: duplicates.length });
    } catch (err) {
      console.error("[admin] duplicates error:", err);
      res.status(500).json({ error: "Failed to check duplicates" });
    }
  });

  return router;
}
