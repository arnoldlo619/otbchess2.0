import { Router } from "express";
import { desc, eq, sql } from "drizzle-orm";
import { getDb } from "../db.js";
import { requireFullAuth } from "../auth.js";
import { populationAggregates, populationDatasetVersions, populationJobs, populationTrackedPositions, users } from "../../shared/schema.js";
import { getLichessRateLimitState } from "../services/lichess.js";

async function requireStaff(req: import("express").Request, res: import("express").Response, next: import("express").NextFunction) {
  const userId = (req as import("express").Request & { userId: string }).userId;
  const db = await getDb();
  const [caller] = await db.select({ isStaff: users.isStaff }).from(users).where(eq(users.id, userId)).limit(1);
  if (!caller?.isStaff) return res.status(403).json({ error: "OTB Staff access required." });
  next();
}

const plain = <T>(value: T): T => JSON.parse(JSON.stringify(value, (_key, item) => typeof item === "bigint" ? item.toString() : item)) as T;

/** Diagnostics only: no archive URL, PGN, player, or raw-game data is exposed. */
export function createPopulationAdminRouter(): Router {
  const router = Router();
  router.use(requireFullAuth, requireStaff);
  router.get("/status", async (_req, res) => {
    try {
      const db = await getDb();
      const [published] = await db.select().from(populationDatasetVersions)
        .where(eq(populationDatasetVersions.status, "published")).orderBy(desc(populationDatasetVersions.publishedAt)).limit(1);
      const [staging] = await db.select().from(populationDatasetVersions)
        .where(eq(populationDatasetVersions.status, "staging")).orderBy(desc(populationDatasetVersions.createdAt)).limit(1);
      const [tracked] = await db.select({ value: sql<number>`count(*)` }).from(populationTrackedPositions).where(eq(populationTrackedPositions.active, true));
      const [aggregateRows] = await db.select({ value: sql<number>`count(*)` }).from(populationAggregates);
      const jobs = await db.select().from(populationJobs).orderBy(desc(populationJobs.createdAt)).limit(10);
      return res.json(plain({
        localDataset: published ? {
          status: "published",
          version: published.id,
          completeMonths: JSON.parse(published.completeMonthsJson),
          trackedSetVersion: published.trackedSetVersion,
          trackedPositionCount: published.trackedPositionCount,
          publishedAt: published.publishedAt,
        } : { status: "pending" },
        stagingDataset: staging ? { version: staging.id, status: staging.status, createdAt: staging.createdAt } : null,
        trackedPositionCount: tracked?.value ?? 0,
        aggregateRows: aggregateRows?.value ?? 0,
        latestJobs: jobs.map(job => ({
          id: job.id, datasetId: job.datasetId, status: job.status, sourceFilename: job.sourceFilename,
          gamesParsed: job.gamesParsed, gamesAccepted: job.gamesAccepted, aggregateRows: job.aggregateRows,
          failureCode: job.failureCode, startedAt: job.startedAt, heartbeatAt: job.heartbeatAt, completedAt: job.completedAt,
        })),
        lichessRateLimit: getLichessRateLimitState(),
        operationalNote: published ? "Local aggregate coverage is active; individual requests use this version only when its coverage is exact." : "No local dataset is published. Official Lichess population Explorer fallback remains active.",
      }));
    } catch {
      return res.status(500).json({ error: "Population diagnostics unavailable." });
    }
  });
  return router;
}
