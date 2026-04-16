/**
 * openingsPublic.ts — Public API routes for the openings explorer & study system.
 *
 * Routes:
 *   GET  /api/openings                              — Browse catalog
 *   GET  /api/openings/:slug                        — Opening detail + lines
 *   GET  /api/openings/:slug/lines/:lineSlug        — Line detail with nodes
 *   GET  /api/study/progress                        — User progress (auth)
 *   GET  /api/study/queue                           — Review queue (auth)
 *   POST /api/study/review                          — Save review (auth)
 */
import { Router, type Request, type Response } from "express";
import { getDb } from "./db.js";
import {
  openings,
  openingLines,
  lineNodes,
  userLineReviews,
  openingTags,
  openingTagMap,
  lineTagMap,
} from "../shared/schema.js";
import { eq, sql, and, asc, desc, inArray, like, or } from "drizzle-orm";
import { nanoid } from "nanoid";

function getUserId(req: Request): string | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (req as any).userId ?? null;
}

export function registerOpeningsPublicRoutes(router: Router) {

  // ── Browse catalog ──────────────────────────────────────────────────────
  router.get("/api/openings", async (req: Request, res: Response) => {
    try {
      const db = await getDb();
      const { side, difficulty, style, search, featured, sort } = req.query;

      // Schema uses: color (not side), isPublished (not status), summary (not shortDescription), eco (not ecoCode)
      const conditions = [eq(openings.isPublished, 1)];

      if (side && typeof side === "string" && ["white", "black"].includes(side)) {
        conditions.push(eq(openings.color, side));
      }
      if (difficulty && typeof difficulty === "string") {
        conditions.push(eq(openings.difficulty, difficulty));
      }
      if (featured === "true") {
        conditions.push(eq(openings.isFeatured, 1));
      }
      if (search && typeof search === "string") {
        const term = `%${search}%`;
        conditions.push(
          or(
            like(openings.name, term),
            like(openings.summary, term),
            like(openings.eco, term)
          )!
        );
      }

      const rows = await db
        .select()
        .from(openings)
        .where(and(...conditions))
        .orderBy(
          sort === "name" ? asc(openings.name) :
          sort === "difficulty" ? asc(openings.difficulty) :
          sort === "popularity" ? desc(openings.popularity) :
          desc(openings.isFeatured)
        );

      // Attach tags
      const openingIds = rows.map((r) => r.id);
      const tagMap: Record<string, { name: string; category: string; slug: string }[]> = {};

      if (openingIds.length > 0) {
        const tagRows = await db
          .select({
            openingId: openingTagMap.openingId,
            name: openingTags.name,
            category: openingTags.category,
            slug: openingTags.slug,
          })
          .from(openingTagMap)
          .innerJoin(openingTags, eq(openingTagMap.tagId, openingTags.id))
          .where(inArray(openingTagMap.openingId, openingIds));

        for (const row of tagRows) {
          if (!tagMap[row.openingId]) tagMap[row.openingId] = [];
          tagMap[row.openingId].push({ name: row.name, category: row.category, slug: row.slug });
        }
      }

      // Filter by style tag if requested
      let filteredRows = rows;
      if (style && typeof style === "string") {
        filteredRows = rows.filter((r) =>
          tagMap[r.id]?.some((t) => t.slug === style || t.name.toLowerCase() === style.toLowerCase())
        );
      }

      // Line counts
      const lineCounts: Record<string, number> = {};
      if (openingIds.length > 0) {
        const countRows = await db
          .select({
            openingId: openingLines.openingId,
            count: sql<number>`count(*)`,
          })
          .from(openingLines)
          .where(and(
            inArray(openingLines.openingId, openingIds),
            eq(openingLines.isPublished, 1)
          ))
          .groupBy(openingLines.openingId);

        for (const row of countRows) {
          lineCounts[row.openingId] = Number(row.count);
        }
      }

      const result = filteredRows.map((o) => ({
        id: o.id,
        slug: o.slug,
        name: o.name,
        side: o.color,
        family: o.name.split(" ")[0],
        eco: o.eco,
        shortDescription: o.summary,
        longDescription: o.description,
        difficulty: o.difficulty,
        popularity: o.popularity,
        thumbnailFen: o.startingFen,
        isFeatured: o.isFeatured === 1,
        starterFriendly: o.starterFriendly === 1,
        trapPotential: o.trapPotential,
        strategicComplexity: o.strategicComplexity,
        estimatedLineCount: o.estimatedLineCount,
        lineCount: lineCounts[o.id] ?? 0,
        tags: tagMap[o.id] ?? [],
      }));

      res.json({ openings: result, total: result.length });
    } catch (err) {
      console.error("GET /api/openings error:", err);
      res.status(500).json({ error: "Failed to fetch openings" });
    }
  });

  // ── Opening detail + lines ──────────────────────────────────────────────
  router.get("/api/openings/:slug", async (req: Request, res: Response) => {
    try {
      const db = await getDb();
      const { slug } = req.params;
      const [opening] = await db
        .select()
        .from(openings)
        .where(and(eq(openings.slug, slug), eq(openings.isPublished, 1)));

      if (!opening) {
        res.status(404).json({ error: "Opening not found" });
        return;
      }

      // Get published lines
      const lines = await db
        .select()
        .from(openingLines)
        .where(and(
          eq(openingLines.openingId, opening.id),
          eq(openingLines.isPublished, 1)
        ))
        .orderBy(asc(openingLines.sortOrder));

      // Get tags
      const tags = await db
        .select({
          name: openingTags.name,
          category: openingTags.category,
          slug: openingTags.slug,
        })
        .from(openingTagMap)
        .innerJoin(openingTags, eq(openingTagMap.tagId, openingTags.id))
        .where(eq(openingTagMap.openingId, opening.id));

      // Group lines by themes/type for chapter-like grouping
      const chapters: Record<string, typeof lines> = {};
      for (const line of lines) {
        const ch = line.lineType === "trap" ? "Traps & Punishments" :
                   line.lineType === "gambit" ? "Gambit Lines" :
                   line.lineType === "sideline" ? "Sidelines" :
                   "Main Lines";
        if (!chapters[ch]) chapters[ch] = [];
        chapters[ch].push(line);
      }

      // User progress
      const userId = getUserId(req);
      const userProgress: Record<string, { status: string; streak: number; accuracy: number }> = {};
      if (userId) {
        const lineIds = lines.map((l) => l.id);
        if (lineIds.length > 0) {
          const reviews = await db
            .select()
            .from(userLineReviews)
            .where(and(
              eq(userLineReviews.userId, userId),
              inArray(userLineReviews.lineId, lineIds)
            ));
          for (const r of reviews) {
            userProgress[r.lineId] = {
              status: r.status,
              streak: r.streak,
              accuracy: r.totalAttempts > 0 ? Math.round((r.correctAttempts / r.totalAttempts) * 100) : 0,
            };
          }
        }
      }

      res.json({
        opening: {
          id: opening.id,
          slug: opening.slug,
          name: opening.name,
          side: opening.color,
          eco: opening.eco,
          shortDescription: opening.summary,
          longDescription: opening.description,
          difficulty: opening.difficulty,
          popularity: opening.popularity,
          thumbnailFen: opening.startingFen,
          playCharacter: opening.playCharacter,
          isFeatured: opening.isFeatured === 1,
          starterFriendly: opening.starterFriendly === 1,
          trapPotential: opening.trapPotential,
          strategicComplexity: opening.strategicComplexity,
          tags,
        },
        chapters: Object.entries(chapters).map(([name, chapterLines]) => ({
          name,
          lines: chapterLines.map((l) => ({
            id: l.id,
            slug: l.slug,
            title: l.title,
            description: l.description,
            difficulty: l.difficulty,
            moveCount: l.plyCount,
            commonness: l.commonness,
            priority: l.priority,
            mustKnow: l.isMustKnow === 1,
            starterFriendly: false,
            trapLine: l.isTrap === 1,
            lineType: l.lineType,
            branchLabel: l.lineType,
            progress: userProgress[l.id] ?? null,
          })),
        })),
        lineCount: lines.length,
      });
    } catch (err) {
      console.error("GET /api/openings/:slug error:", err);
      res.status(500).json({ error: "Failed to fetch opening" });
    }
  });

  // ── Line detail with moves ──────────────────────────────────────────────
  router.get("/api/openings/:slug/lines/:lineSlug", async (req: Request, res: Response) => {
    try {
      const db = await getDb();
      const { slug, lineSlug } = req.params;

      const [opening] = await db
        .select()
        .from(openings)
        .where(and(eq(openings.slug, slug), eq(openings.isPublished, 1)));

      if (!opening) {
        res.status(404).json({ error: "Opening not found" });
        return;
      }

      const [line] = await db
        .select()
        .from(openingLines)
        .where(and(
          eq(openingLines.openingId, opening.id),
          eq(openingLines.slug, lineSlug),
          eq(openingLines.isPublished, 1)
        ));

      if (!line) {
        res.status(404).json({ error: "Line not found" });
        return;
      }

      // Nodes
      const nodes = await db
        .select()
        .from(lineNodes)
        .where(eq(lineNodes.lineId, line.id))
        .orderBy(asc(lineNodes.ply), asc(lineNodes.sortOrder));

      // Tags
      const lineTags = await db
        .select({
          name: openingTags.name,
          category: openingTags.category,
          slug: openingTags.slug,
        })
        .from(lineTagMap)
        .innerJoin(openingTags, eq(lineTagMap.tagId, openingTags.id))
        .where(eq(lineTagMap.lineId, line.id));

      // User progress
      const userId = getUserId(req);
      let progress = null;
      if (userId) {
        const [review] = await db
          .select()
          .from(userLineReviews)
          .where(and(
            eq(userLineReviews.userId, userId),
            eq(userLineReviews.lineId, line.id)
          ));
        if (review) {
          progress = {
            status: review.status,
            streak: review.streak,
            bestStreak: review.bestStreak,
            totalAttempts: review.totalAttempts,
            correctAttempts: review.correctAttempts,
            accuracy: review.totalAttempts > 0 ? Math.round((review.correctAttempts / review.totalAttempts) * 100) : 0,
            lastReviewedAt: review.lastReviewedAt,
            nextReviewAt: review.nextReviewAt,
          };
        }
      }

      // Sibling navigation
      const siblings = await db
        .select({
          id: openingLines.id,
          slug: openingLines.slug,
          title: openingLines.title,
          sortOrder: openingLines.sortOrder,
        })
        .from(openingLines)
        .where(and(
          eq(openingLines.openingId, opening.id),
          eq(openingLines.isPublished, 1)
        ))
        .orderBy(asc(openingLines.sortOrder));

      const currentIdx = siblings.findIndex((s) => s.id === line.id);
      const prevLine = currentIdx > 0 ? siblings[currentIdx - 1] : null;
      const nextLine = currentIdx < siblings.length - 1 ? siblings[currentIdx + 1] : null;

      res.json({
        opening: { id: opening.id, slug: opening.slug, name: opening.name, side: opening.color },
        line: {
          id: line.id,
          slug: line.slug,
          title: line.title,
          description: line.description,
          pgn: line.pgn,
          finalFen: line.finalFen,
          moveCount: line.plyCount,
          difficulty: line.difficulty,
          commonness: line.commonness,
          priority: line.priority,
          mustKnow: line.isMustKnow === 1,
          trapLine: line.isTrap === 1,
          strategicSummary: line.strategicSummary,
          hintText: line.hintText,
          punishmentIdea: line.punishmentIdea,
          lineType: line.lineType,
          tags: lineTags,
        },
        nodes,
        progress,
        navigation: { prev: prevLine, next: nextLine },
      });
    } catch (err) {
      console.error("GET /api/openings/:slug/lines/:lineSlug error:", err);
      res.status(500).json({ error: "Failed to fetch line" });
    }
  });

  // ── User study progress ─────────────────────────────────────────────────
  router.get("/api/study/progress", async (req: Request, res: Response) => {
    try {
      const db = await getDb();
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }

      const reviews = await db
        .select()
        .from(userLineReviews)
        .where(eq(userLineReviews.userId, userId));

      const lineIds = reviews.map((r) => r.lineId);
      const lineDetails: Record<string, { title: string; slug: string; openingId: string; difficulty: string }> = {};
      if (lineIds.length > 0) {
        const lines = await db
          .select({
            id: openingLines.id,
            title: openingLines.title,
            slug: openingLines.slug,
            openingId: openingLines.openingId,
            difficulty: openingLines.difficulty,
          })
          .from(openingLines)
          .where(inArray(openingLines.id, lineIds));
        for (const l of lines) {
          lineDetails[l.id] = { title: l.title, slug: l.slug, openingId: l.openingId, difficulty: l.difficulty ?? "intermediate" };
        }
      }

      const openingIds = Array.from(new Set(Object.values(lineDetails).map((l) => l.openingId)));
      const openingDetails: Record<string, { name: string; slug: string }> = {};
      if (openingIds.length > 0) {
        const ops = await db
          .select({ id: openings.id, name: openings.name, slug: openings.slug })
          .from(openings)
          .where(inArray(openings.id, openingIds));
        for (const o of ops) {
          openingDetails[o.id] = { name: o.name, slug: o.slug };
        }
      }

      const stats = {
        totalLines: reviews.length,
        mastered: reviews.filter((r) => r.status === "mastered").length,
        reviewing: reviews.filter((r) => r.status === "reviewing").length,
        learning: reviews.filter((r) => r.status === "learning").length,
        new: reviews.filter((r) => r.status === "new").length,
        totalAttempts: reviews.reduce((s, r) => s + r.totalAttempts, 0),
        correctAttempts: reviews.reduce((s, r) => s + r.correctAttempts, 0),
        bestStreak: Math.max(0, ...reviews.map((r) => r.bestStreak)),
      };

      const progressByLine = reviews.map((r) => ({
        lineId: r.lineId,
        status: r.status,
        streak: r.streak,
        bestStreak: r.bestStreak,
        totalAttempts: r.totalAttempts,
        correctAttempts: r.correctAttempts,
        lastReviewedAt: r.lastReviewedAt,
        nextReviewAt: r.nextReviewAt,
        line: lineDetails[r.lineId] ?? null,
        opening: lineDetails[r.lineId] ? openingDetails[lineDetails[r.lineId].openingId] ?? null : null,
        accuracy: r.totalAttempts > 0 ? Math.round((r.correctAttempts / r.totalAttempts) * 100) : 0,
      }));

      res.json({ stats, progress: progressByLine });
    } catch (err) {
      console.error("GET /api/study/progress error:", err);
      res.status(500).json({ error: "Failed to fetch progress" });
    }
  });

  // ── Review queue ────────────────────────────────────────────────────────
  router.get("/api/study/queue", async (req: Request, res: Response) => {
    try {
      const db = await getDb();
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }

      const now = new Date();
      const dueReviews = await db
        .select()
        .from(userLineReviews)
        .where(and(
          eq(userLineReviews.userId, userId),
          sql`${userLineReviews.nextReviewAt} <= ${now}`
        ))
        .orderBy(asc(userLineReviews.nextReviewAt))
        .limit(20);

      const lineIds = dueReviews.map((r) => r.lineId);
      const lineMap: Record<string, { title: string; slug: string; openingId: string; pgn: string }> = {};
      if (lineIds.length > 0) {
        const lines = await db
          .select({
            id: openingLines.id,
            title: openingLines.title,
            slug: openingLines.slug,
            openingId: openingLines.openingId,
            pgn: openingLines.pgn,
          })
          .from(openingLines)
          .where(inArray(openingLines.id, lineIds));
        for (const l of lines) {
          lineMap[l.id] = { title: l.title, slug: l.slug, openingId: l.openingId, pgn: l.pgn };
        }
      }

      const openingIds = Array.from(new Set(Object.values(lineMap).map((l) => l.openingId)));
      const openingMap: Record<string, { name: string; slug: string }> = {};
      if (openingIds.length > 0) {
        const ops = await db
          .select({ id: openings.id, name: openings.name, slug: openings.slug })
          .from(openings)
          .where(inArray(openings.id, openingIds));
        for (const o of ops) {
          openingMap[o.id] = { name: o.name, slug: o.slug };
        }
      }

      const queue = dueReviews.map((r) => ({
        reviewId: r.id,
        lineId: r.lineId,
        line: lineMap[r.lineId] ?? null,
        opening: lineMap[r.lineId] ? openingMap[lineMap[r.lineId].openingId] ?? null : null,
        status: r.status,
        streak: r.streak,
        nextReviewAt: r.nextReviewAt,
      }));

      res.json({ queue, count: queue.length });
    } catch (err) {
      console.error("GET /api/study/queue error:", err);
      res.status(500).json({ error: "Failed to fetch queue" });
    }
  });

  // ── Save review result (SM-2) ──────────────────────────────────────────
  router.post("/api/study/review", async (req: Request, res: Response) => {
    try {
      const db = await getDb();
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }

      const { lineId, quality, timeSeconds } = req.body;
      if (!lineId || quality === undefined || quality < 0 || quality > 5) {
        res.status(400).json({ error: "lineId and quality (0-5) required" });
        return;
      }

      const [existing] = await db
        .select()
        .from(userLineReviews)
        .where(and(
          eq(userLineReviews.userId, userId),
          eq(userLineReviews.lineId, lineId)
        ));

      const now = new Date();
      const isCorrect = quality >= 3;

      if (existing) {
        let ef = existing.easeFactor / 100;
        let reps = existing.repetitions;
        let interval = existing.intervalDays;

        if (isCorrect) {
          if (reps === 0) interval = 1;
          else if (reps === 1) interval = 6;
          else interval = Math.round(interval * ef);
          reps += 1;
        } else {
          reps = 0;
          interval = 1;
        }

        ef = ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
        if (ef < 1.3) ef = 1.3;

        const nextReview = new Date(now.getTime() + interval * 24 * 60 * 60 * 1000);
        const newStreak = isCorrect ? existing.streak + 1 : 0;
        const newBestStreak = Math.max(existing.bestStreak, newStreak);

        let status = existing.status;
        if (reps >= 5 && ef >= 2.0) status = "mastered";
        else if (reps >= 2) status = "reviewing";
        else if (reps >= 1 || existing.totalAttempts > 0) status = "learning";

        await db
          .update(userLineReviews)
          .set({
            status,
            intervalDays: interval,
            easeFactor: Math.round(ef * 100),
            repetitions: reps,
            nextReviewAt: nextReview,
            lastReviewedAt: now,
            totalAttempts: existing.totalAttempts + 1,
            correctAttempts: existing.correctAttempts + (isCorrect ? 1 : 0),
            streak: newStreak,
            bestStreak: newBestStreak,
            lastQuality: quality,
            avgReviewSeconds: timeSeconds
              ? Math.round(((existing.avgReviewSeconds ?? timeSeconds) + timeSeconds) / 2)
              : existing.avgReviewSeconds,
          })
          .where(eq(userLineReviews.id, existing.id));

        res.json({
          status,
          streak: newStreak,
          interval,
          nextReviewAt: nextReview,
          accuracy: Math.round(((existing.correctAttempts + (isCorrect ? 1 : 0)) / (existing.totalAttempts + 1)) * 100),
        });
      } else {
        const interval = isCorrect ? 1 : 0;
        const nextReview = isCorrect
          ? new Date(now.getTime() + 24 * 60 * 60 * 1000)
          : now;

        const id = nanoid();
        await db.insert(userLineReviews).values({
          id,
          userId,
          lineId,
          status: isCorrect ? "learning" : "new",
          intervalDays: interval,
          easeFactor: 250,
          repetitions: isCorrect ? 1 : 0,
          nextReviewAt: nextReview,
          lastReviewedAt: now,
          totalAttempts: 1,
          correctAttempts: isCorrect ? 1 : 0,
          streak: isCorrect ? 1 : 0,
          bestStreak: isCorrect ? 1 : 0,
          lastQuality: quality,
          avgReviewSeconds: timeSeconds ?? null,
        });

        res.json({
          status: isCorrect ? "learning" : "new",
          streak: isCorrect ? 1 : 0,
          interval,
          nextReviewAt: nextReview,
          accuracy: isCorrect ? 100 : 0,
        });
      }
    } catch (err) {
      console.error("POST /api/study/review error:", err);
      res.status(500).json({ error: "Failed to save review" });
    }
  });
}
