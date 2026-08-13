import { sql } from "drizzle-orm";
import { getDb } from "../db.js";
import { populationTrackedPositions } from "../../shared/schema.js";
import { canonicalPosition, TRACKED_SET_VERSION } from "./foundation.js";
import type { PopulationResolutionInput } from "./resolver.js";

/** Adds a canonical position to the aggregate-only tracked set; never stores a game or player identifier. */
export async function registerTrackedPopulationPosition(input: PopulationResolutionInput): Promise<void> {
  const position = canonicalPosition(input.fen);
  try {
    const db = await getDb();
    await db.insert(populationTrackedPositions).values({
      positionKey: position.key,
      canonicalEpd: position.epd,
      uciPathJson: JSON.stringify(input.uciPath),
      ply: input.uciPath.length,
      sideToMove: position.sideToMove,
      active: true,
      trackedSetVersion: TRACKED_SET_VERSION,
      demandCount: 1,
      lastRequestedAt: new Date(),
    }).onDuplicateKeyUpdate({
      set: {
        active: true,
        trackedSetVersion: TRACKED_SET_VERSION,
        demandCount: sql`${populationTrackedPositions.demandCount} + 1`,
        lastRequestedAt: new Date(),
      },
    });
  } catch {
    // Tracking demand must never block the scouting report or the official fallback.
  }
}
