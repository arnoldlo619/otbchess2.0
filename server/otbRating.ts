/**
 * OTB Rating Service — server/otbRating.ts
 *
 * Implements ChessOTB's proprietary Elo rating engine.
 * Handles:
 *  - Rating category determination from time controls
 *  - Initial seed from Chess.com ratings
 *  - Expected score calculation (standard Elo formula)
 *  - K-factor determination based on games played and rating
 *  - New rating calculation
 *  - Full game rating processing with duplicate prevention
 *  - Rating status progression (unrated → provisional → rated → established)
 */
import { nanoid } from "nanoid";
import { eq, and, sql, gte } from "drizzle-orm";
import { getDb } from "./db.js";
import {
  playerRatings,
  gameSessions,
  gameResultSubmissions,
  ratedGames,
  otbRatingHistory,
  users,
} from "../shared/schema.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export type RatingCategory = "otb_blitz" | "otb_rapid";
export type GameResult = "host_win" | "opponent_win" | "draw" | "cancelled";
export type PlayerResult = "win" | "loss" | "draw";
export type RatingStatus = "unrated" | "provisional" | "rated" | "established";

export interface RatingUpdate {
  userId: string;
  ratingBefore: number;
  ratingAfter: number;
  ratingChange: number;
  kFactor: number;
  result: PlayerResult;
  newStatus: RatingStatus;
  gamesPlayed: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_SEED = 1000;
const PROVISIONAL_THRESHOLD = 5;  // Games needed for official rating
const RATED_THRESHOLD = 20;       // Games needed for "established" status

// ─── Rating Category Determination ───────────────────────────────────────────

/**
 * Determine the rating category based on time control.
 * - OTB Blitz: base time < 10 minutes
 * - OTB Rapid: base time >= 10 and < 30 minutes
 * - Casual: anything else (30+ minutes or unsupported)
 */
export function determineRatingCategory(
  baseMinutes: number,
  _incrementSeconds: number
): RatingCategory | "casual" {
  if (baseMinutes < 10) return "otb_blitz";
  if (baseMinutes >= 10 && baseMinutes < 30) return "otb_rapid";
  return "casual";
}

// ─── Elo Calculation Utilities ────────────────────────────────────────────────

/**
 * Calculate expected score using standard Elo formula.
 * E = 1 / (1 + 10^((OpponentRating - PlayerRating) / 400))
 */
export function calculateExpectedScore(
  playerRating: number,
  opponentRating: number
): number {
  return 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
}

/**
 * Determine K-factor based on games played and current rating.
 * - Games 1–5: K = 80 (high volatility during placement)
 * - Games 6–19: K = 50 (moderate volatility)
 * - Games 20+: K = 32 (standard)
 * - Established players rated 2000+: K = 24 (low volatility)
 */
export function determineKFactor(gamesPlayed: number, currentRating: number): number {
  if (gamesPlayed <= 5) return 80;
  if (gamesPlayed <= 19) return 50;
  if (currentRating >= 2000) return 24;
  return 32;
}

/**
 * Calculate new rating after a game.
 * NewRating = OldRating + K × (ActualScore - ExpectedScore)
 *
 * ActualScore: Win = 1, Draw = 0.5, Loss = 0
 */
export function calculateNewRating(
  playerRating: number,
  opponentRating: number,
  result: PlayerResult,
  kFactor: number
): number {
  const actualScore = result === "win" ? 1 : result === "draw" ? 0.5 : 0;
  const expectedScore = calculateExpectedScore(playerRating, opponentRating);
  const newRating = Math.round(playerRating + kFactor * (actualScore - expectedScore));
  // Floor at 100 to prevent negative/absurd ratings
  return Math.max(100, newRating);
}

// ─── Rating Status Logic ──────────────────────────────────────────────────────

/**
 * Determine rating status based on games played.
 * - 0 games: unrated
 * - 1–4 games: provisional
 * - 5–19 games: rated
 * - 20+ games: established
 */
export function determineRatingStatus(gamesPlayed: number): RatingStatus {
  if (gamesPlayed === 0) return "unrated";
  if (gamesPlayed < PROVISIONAL_THRESHOLD) return "provisional";
  if (gamesPlayed < RATED_THRESHOLD) return "rated";
  return "established";
}

// ─── Database Operations ──────────────────────────────────────────────────────

/**
 * Get or create a player's rating record for a given category.
 * Seeds from Chess.com rating if available.
 */
export async function getOrCreatePlayerRating(
  userId: string,
  category: RatingCategory
): Promise<{ id: string; rating: number; gamesPlayed: number; status: RatingStatus }> {
  const db = await getDb();

  // Try to find existing rating
  const existing = await db
    .select()
    .from(playerRatings)
    .where(and(eq(playerRatings.userId, userId), eq(playerRatings.category, category)))
    .limit(1);

  if (existing.length > 0) {
    return {
      id: existing[0].id,
      rating: existing[0].rating,
      gamesPlayed: existing[0].gamesPlayed,
      status: existing[0].status as RatingStatus,
    };
  }

  // Create new rating record, seeded from Chess.com if available
  const seed = await getInitialSeed(userId, category);
  const id = nanoid();

  await db.insert(playerRatings).values({
    id,
    userId,
    category,
    rating: seed,
    status: "unrated",
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    draws: 0,
  });

  return { id, rating: seed, gamesPlayed: 0, status: "unrated" };
}

/**
 * Get initial seed rating from Chess.com ratings.
 * Falls back to DEFAULT_SEED (1000) if no Chess.com rating exists.
 */
async function getInitialSeed(userId: string, category: RatingCategory): Promise<number> {
  const db = await getDb();
  const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);

  if (user.length === 0) return DEFAULT_SEED;

  if (category === "otb_blitz") {
    return user[0].chesscomBlitz || DEFAULT_SEED;
  }
  if (category === "otb_rapid") {
    return user[0].chesscomRapid || DEFAULT_SEED;
  }

  return DEFAULT_SEED;
}

// ─── Anti-Abuse: Daily Game Limit ─────────────────────────────────────────────

/**
 * Check if two players have exceeded the daily rated game limit (3 per category).
 * Returns true if limit is exceeded.
 */
export async function isDailyLimitExceeded(
  hostUserId: string,
  opponentUserId: string,
  category: RatingCategory
): Promise<boolean> {
  const db = await getDb();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const count = await db
    .select({ count: sql<number>`count(*)` })
    .from(ratedGames)
    .where(
      and(
        eq(ratedGames.ratingCategory, category),
        gte(ratedGames.createdAt, today),
        sql`(
          (${ratedGames.hostUserId} = ${hostUserId} AND ${ratedGames.opponentUserId} = ${opponentUserId})
          OR
          (${ratedGames.hostUserId} = ${opponentUserId} AND ${ratedGames.opponentUserId} = ${hostUserId})
        )`
      )
    );

  return (count[0]?.count ?? 0) >= 3;
}

// ─── Core Rating Processing ──────────────────────────────────────────────────

/**
 * Process a confirmed game and update both players' ratings.
 * This is the main entry point called after both players submit matching results.
 *
 * Guards:
 * - Game must be result_confirmed
 * - Game must be rated
 * - rating_processed must be false (duplicate prevention)
 * - Both players must exist
 * - Time control must be valid for rating
 * - Daily limit must not be exceeded
 *
 * Returns the rating updates for both players, or null if processing was skipped.
 */
export async function processConfirmedGameRating(
  gameSessionId: string
): Promise<{ host: RatingUpdate; opponent: RatingUpdate } | null> {
  const db = await getDb();

  // 1. Load the game session
  const sessions = await db
    .select()
    .from(gameSessions)
    .where(eq(gameSessions.id, gameSessionId))
    .limit(1);

  if (sessions.length === 0) return null;
  const session = sessions[0];

  // 2. Guard: must be result_confirmed, rated, and not already processed
  if (session.status !== "result_confirmed") return null;
  if (!session.isRated) return null;
  if (session.ratingProcessed) return null;
  if (!session.opponentUserId) return null;

  // 3. Guard: time control must be valid for rating
  const category = determineRatingCategory(session.baseMinutes, session.incrementSeconds);
  if (category === "casual") return null;

  // 4. Guard: daily limit
  const limitExceeded = await isDailyLimitExceeded(
    session.hostUserId,
    session.opponentUserId,
    category
  );
  if (limitExceeded) {
    // Mark as processed but don't update ratings
    await db
      .update(gameSessions)
      .set({ ratingProcessed: true, updatedAt: new Date() })
      .where(eq(gameSessions.id, gameSessionId));
    return null;
  }

  // 5. Determine the confirmed result from submissions
  const submissions = await db
    .select()
    .from(gameResultSubmissions)
    .where(eq(gameResultSubmissions.gameSessionId, gameSessionId));

  if (submissions.length < 2) return null;

  // Both should agree — take the host's submission as canonical
  const hostSub = submissions.find((s: any) => s.submittedByUserId === session.hostUserId);
  if (!hostSub) return null;
  const confirmedResult = hostSub.submittedResult as GameResult;
  if (confirmedResult === "cancelled") return null;

  // 6. Get or create ratings for both players
  const hostRating = await getOrCreatePlayerRating(session.hostUserId, category);
  const opponentRating = await getOrCreatePlayerRating(session.opponentUserId, category);

  // 7. Determine individual results
  const hostPlayerResult: PlayerResult =
    confirmedResult === "host_win" ? "win" : confirmedResult === "opponent_win" ? "loss" : "draw";
  const opponentPlayerResult: PlayerResult =
    confirmedResult === "opponent_win" ? "win" : confirmedResult === "host_win" ? "loss" : "draw";

  // 8. Calculate K-factors
  const hostK = determineKFactor(hostRating.gamesPlayed, hostRating.rating);
  const opponentK = determineKFactor(opponentRating.gamesPlayed, opponentRating.rating);

  // 9. Calculate new ratings
  const hostNewRating = calculateNewRating(
    hostRating.rating,
    opponentRating.rating,
    hostPlayerResult,
    hostK
  );
  const opponentNewRating = calculateNewRating(
    opponentRating.rating,
    hostRating.rating,
    opponentPlayerResult,
    opponentK
  );

  // 10. Determine new statuses
  const hostNewGames = hostRating.gamesPlayed + 1;
  const opponentNewGames = opponentRating.gamesPlayed + 1;
  const hostNewStatus = determineRatingStatus(hostNewGames);
  const opponentNewStatus = determineRatingStatus(opponentNewGames);

  // 11. Update player_ratings for host
  await db
    .update(playerRatings)
    .set({
      rating: hostNewRating,
      gamesPlayed: hostNewGames,
      status: hostNewStatus,
      wins: hostPlayerResult === "win" ? sql`${playerRatings.wins} + 1` : sql`${playerRatings.wins}`,
      losses: hostPlayerResult === "loss" ? sql`${playerRatings.losses} + 1` : sql`${playerRatings.losses}`,
      draws: hostPlayerResult === "draw" ? sql`${playerRatings.draws} + 1` : sql`${playerRatings.draws}`,
      updatedAt: new Date(),
    })
    .where(eq(playerRatings.id, hostRating.id));

  // 12. Update player_ratings for opponent
  await db
    .update(playerRatings)
    .set({
      rating: opponentNewRating,
      gamesPlayed: opponentNewGames,
      status: opponentNewStatus,
      wins: opponentPlayerResult === "win" ? sql`${playerRatings.wins} + 1` : sql`${playerRatings.wins}`,
      losses: opponentPlayerResult === "loss" ? sql`${playerRatings.losses} + 1` : sql`${playerRatings.losses}`,
      draws: opponentPlayerResult === "draw" ? sql`${playerRatings.draws} + 1` : sql`${playerRatings.draws}`,
      updatedAt: new Date(),
    })
    .where(eq(playerRatings.id, opponentRating.id));

  // 13. Create rated_games record
  const winnerUserId =
    confirmedResult === "host_win"
      ? session.hostUserId
      : confirmedResult === "opponent_win"
      ? session.opponentUserId
      : null;

  await db.insert(ratedGames).values({
    id: nanoid(),
    gameSessionId,
    hostUserId: session.hostUserId,
    opponentUserId: session.opponentUserId,
    winnerUserId,
    result: confirmedResult,
    ratingCategory: category,
    hostRatingBefore: hostRating.rating,
    hostRatingAfter: hostNewRating,
    opponentRatingBefore: opponentRating.rating,
    opponentRatingAfter: opponentNewRating,
    hostRatingChange: hostNewRating - hostRating.rating,
    opponentRatingChange: opponentNewRating - opponentRating.rating,
  });

  // 14. Create otb_rating_history records for both players
  await db.insert(otbRatingHistory).values([
    {
      id: nanoid(),
      userId: session.hostUserId,
      gameSessionId,
      ratingCategory: category,
      ratingBefore: hostRating.rating,
      ratingAfter: hostNewRating,
      ratingChange: hostNewRating - hostRating.rating,
      opponentUserId: session.opponentUserId,
      opponentRatingBefore: opponentRating.rating,
      result: hostPlayerResult,
      kFactor: hostK,
    },
    {
      id: nanoid(),
      userId: session.opponentUserId,
      gameSessionId,
      ratingCategory: category,
      ratingBefore: opponentRating.rating,
      ratingAfter: opponentNewRating,
      ratingChange: opponentNewRating - opponentRating.rating,
      opponentUserId: session.hostUserId,
      opponentRatingBefore: hostRating.rating,
      result: opponentPlayerResult,
      kFactor: opponentK,
    },
  ]);

  // 15. Mark game as rating_processed (duplicate prevention)
  await db
    .update(gameSessions)
    .set({ ratingProcessed: true, updatedAt: new Date() })
    .where(eq(gameSessions.id, gameSessionId));

  // 16. Return rating updates
  return {
    host: {
      userId: session.hostUserId,
      ratingBefore: hostRating.rating,
      ratingAfter: hostNewRating,
      ratingChange: hostNewRating - hostRating.rating,
      kFactor: hostK,
      result: hostPlayerResult,
      newStatus: hostNewStatus,
      gamesPlayed: hostNewGames,
    },
    opponent: {
      userId: session.opponentUserId,
      ratingBefore: opponentRating.rating,
      ratingAfter: opponentNewRating,
      ratingChange: opponentNewRating - opponentRating.rating,
      kFactor: opponentK,
      result: opponentPlayerResult,
      newStatus: opponentNewStatus,
      gamesPlayed: opponentNewGames,
    },
  };
}
