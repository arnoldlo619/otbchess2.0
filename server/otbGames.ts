/**
 * OTB Games Router — server/otbGames.ts
 *
 * API endpoints for the OTB ELO System game lifecycle:
 * - POST   /              Create a new game session (host)
 * - GET    /:id           Get game session details
 * - POST   /join/:token   Opponent joins via QR token
 * - PATCH  /:id/status    Update session status (clock start/end)
 * - POST   /:id/result    Submit game result
 * - GET    /my/active     Get user's active sessions
 * - GET    /ratings/:userId  Get user's OTB ratings
 * - GET    /leaderboard/:category  Get leaderboard
 */
import { Router } from "express";
import { nanoid } from "nanoid";
import crypto from "crypto";
import { eq, and, or, desc, gte, sql } from "drizzle-orm";
import { getDb } from "./db.js";
import { requireAuth } from "./auth.js";
import {
  gameSessions,
  gameResultSubmissions,
  playerRatings,
  ratedGames,
  otbRatingHistory,
  users,
} from "../shared/schema.js";
import {
  determineRatingCategory,
  processConfirmedGameRating,
  getOrCreatePlayerRating,
  type RatingCategory,
  type RatingUpdate,
} from "./otbRating.js";

const router = Router();

// ─── POST / — Create a new game session ──────────────────────────────────────
router.post("/", requireAuth, async (req: any, res) => {
  try {
    const db = await getDb();
    const userId = req.user.id;
    const { baseMinutes, incrementSeconds = 0, isRated = true } = req.body;

    if (!baseMinutes || baseMinutes < 1 || baseMinutes > 60) {
      return res.status(400).json({ error: "Invalid base time (1-60 minutes)" });
    }

    // Determine time control category
    const timeControlCategory = determineRatingCategory(baseMinutes, incrementSeconds);

    // If rated but category is casual, force unrated
    const effectiveIsRated = isRated && timeControlCategory !== "casual";

    // Get host info
    const hostUser = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (hostUser.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    // Generate QR token (URL-safe, 32 chars)
    const qrToken = crypto.randomBytes(24).toString("base64url");

    // QR expires in 30 minutes
    const qrExpiresAt = new Date(Date.now() + 30 * 60 * 1000);

    const sessionId = nanoid();
    await db.insert(gameSessions).values({
      id: sessionId,
      hostUserId: userId,
      hostDisplayName: hostUser[0].displayName,
      hostChesscomUsername: hostUser[0].chesscomUsername || null,
      timeControlCategory: timeControlCategory === "casual" ? "casual" : timeControlCategory.replace("otb_", ""),
      baseMinutes,
      incrementSeconds,
      status: "pending_opponent",
      qrToken,
      qrExpiresAt,
      isRated: effectiveIsRated,
    });

    return res.json({
      id: sessionId,
      qrToken,
      qrExpiresAt: qrExpiresAt.toISOString(),
      timeControlCategory: timeControlCategory === "casual" ? "casual" : timeControlCategory.replace("otb_", ""),
      baseMinutes,
      incrementSeconds,
      isRated: effectiveIsRated,
      hostDisplayName: hostUser[0].displayName,
      status: "pending_opponent",
    });
  } catch (err: any) {
    console.error("[otb-games] create session error:", err);
    return res.status(500).json({ error: "Failed to create game session" });
  }
});

// ─── GET /my/active — Get user's active sessions ─────────────────────────────
router.get("/my/active", requireAuth, async (req: any, res) => {
  try {
    const db = await getDb();
    const userId = req.user.id;

    const sessions = await db
      .select()
      .from(gameSessions)
      .where(
        and(
          or(eq(gameSessions.hostUserId, userId), eq(gameSessions.opponentUserId, userId)),
          sql`${gameSessions.status} NOT IN ('result_confirmed', 'cancelled')`
        )
      )
      .orderBy(desc(gameSessions.createdAt))
      .limit(10);

    return res.json(sessions);
  } catch (err: any) {
    console.error("[otb-games] get active sessions error:", err);
    return res.status(500).json({ error: "Failed to get sessions" });
  }
});

// ─── GET /:id — Get game session details ─────────────────────────────────────
router.get("/:id", async (req, res) => {
  try {
    const db = await getDb();
    const session = await db
      .select()
      .from(gameSessions)
      .where(eq(gameSessions.id, req.params.id))
      .limit(1);

    if (session.length === 0) {
      return res.status(404).json({ error: "Game session not found" });
    }

    // Also get result submissions if game is in results phase
    let submissions: any[] = [];
    if (["awaiting_results", "result_confirmed", "result_disputed"].includes(session[0].status)) {
      submissions = await db
        .select()
        .from(gameResultSubmissions)
        .where(eq(gameResultSubmissions.gameSessionId, req.params.id));
    }

    // Get rated game info if confirmed
    let ratedGame = null;
    if (session[0].status === "result_confirmed" && session[0].ratingProcessed) {
      const rg = await db
        .select()
        .from(ratedGames)
        .where(eq(ratedGames.gameSessionId, req.params.id))
        .limit(1);
      if (rg.length > 0) ratedGame = rg[0];
    }

    return res.json({ ...session[0], submissions, ratedGame });
  } catch (err: any) {
    console.error("[otb-games] get session error:", err);
    return res.status(500).json({ error: "Failed to get session" });
  }
});

// ─── POST /join/:token — Opponent joins via QR token ─────────────────────────
router.post("/join/:token", requireAuth, async (req: any, res) => {
  try {
    const db = await getDb();
    const userId = req.user.id;
    const { token } = req.params;

    // Find session by QR token
    const sessions = await db
      .select()
      .from(gameSessions)
      .where(eq(gameSessions.qrToken, token))
      .limit(1);

    if (sessions.length === 0) {
      return res.status(404).json({ error: "Game session not found or link expired" });
    }

    const session = sessions[0];

    // Check expiry
    if (new Date() > session.qrExpiresAt) {
      return res.status(410).json({ error: "This join link has expired" });
    }

    // Check status
    if (session.status !== "pending_opponent") {
      return res.status(409).json({ error: "This game already has an opponent" });
    }

    // Anti-abuse: prevent self-play
    if (session.hostUserId === userId) {
      return res.status(400).json({ error: "You cannot join your own game" });
    }

    // Get opponent info
    const opponentUser = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (opponentUser.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    // Anti-abuse: same chess.com username check
    if (
      session.hostChesscomUsername &&
      opponentUser[0].chesscomUsername &&
      session.hostChesscomUsername.toLowerCase() === opponentUser[0].chesscomUsername.toLowerCase()
    ) {
      return res.status(400).json({ error: "Both players cannot have the same Chess.com username" });
    }

    // Attach opponent to session
    await db
      .update(gameSessions)
      .set({
        opponentUserId: userId,
        opponentDisplayName: opponentUser[0].displayName,
        opponentChesscomUsername: opponentUser[0].chesscomUsername || null,
        status: "opponent_joined",
        updatedAt: new Date(),
      })
      .where(eq(gameSessions.id, session.id));

    return res.json({
      ...session,
      opponentUserId: userId,
      opponentDisplayName: opponentUser[0].displayName,
      opponentChesscomUsername: opponentUser[0].chesscomUsername || null,
      status: "opponent_joined",
    });
  } catch (err: any) {
    console.error("[otb-games] join session error:", err);
    return res.status(500).json({ error: "Failed to join game" });
  }
});

// ─── PATCH /:id/status — Update session status ──────────────────────────────
router.patch("/:id/status", requireAuth, async (req: any, res) => {
  try {
    const db = await getDb();
    const userId = req.user.id;
    const { status, activeClockDeviceId } = req.body;

    const sessions = await db
      .select()
      .from(gameSessions)
      .where(eq(gameSessions.id, req.params.id))
      .limit(1);

    if (sessions.length === 0) {
      return res.status(404).json({ error: "Game session not found" });
    }

    const session = sessions[0];

    // Only host or opponent can update status
    if (session.hostUserId !== userId && session.opponentUserId !== userId) {
      return res.status(403).json({ error: "Not a participant in this game" });
    }

    // Validate status transitions
    const validTransitions: Record<string, string[]> = {
      opponent_joined: ["clock_started", "cancelled"],
      clock_started: ["awaiting_results", "cancelled"],
      awaiting_results: ["result_confirmed", "result_disputed"],
      result_disputed: ["awaiting_results"],
    };

    const allowed = validTransitions[session.status];
    if (!allowed || !allowed.includes(status)) {
      return res.status(400).json({ error: `Cannot transition from ${session.status} to ${status}` });
    }

    const updateData: any = { status, updatedAt: new Date() };
    if (activeClockDeviceId) {
      updateData.activeClockDeviceId = activeClockDeviceId;
    }

    await db
      .update(gameSessions)
      .set(updateData)
      .where(eq(gameSessions.id, session.id));

    return res.json({ ...session, ...updateData });
  } catch (err: any) {
    console.error("[otb-games] update status error:", err);
    return res.status(500).json({ error: "Failed to update status" });
  }
});

// ─── POST /:id/result — Submit game result ───────────────────────────────────
router.post("/:id/result", requireAuth, async (req: any, res) => {
  try {
    const db = await getDb();
    const userId = req.user.id;
    const { result } = req.body; // "i_won" | "i_lost" | "draw" | "cancelled"

    if (!["i_won", "i_lost", "draw", "cancelled"].includes(result)) {
      return res.status(400).json({ error: "Invalid result" });
    }

    const sessions = await db
      .select()
      .from(gameSessions)
      .where(eq(gameSessions.id, req.params.id))
      .limit(1);

    if (sessions.length === 0) {
      return res.status(404).json({ error: "Game session not found" });
    }

    const session = sessions[0];

    // Must be a participant
    if (session.hostUserId !== userId && session.opponentUserId !== userId) {
      return res.status(403).json({ error: "Not a participant in this game" });
    }

    // Must be in awaiting_results or result_disputed status
    if (!["awaiting_results", "result_disputed"].includes(session.status)) {
      return res.status(400).json({ error: "Game is not in results phase" });
    }

    // Map user-facing result to canonical result (from host's perspective)
    const isHost = session.hostUserId === userId;
    let canonicalResult: string;
    if (result === "i_won") {
      canonicalResult = isHost ? "host_win" : "opponent_win";
    } else if (result === "i_lost") {
      canonicalResult = isHost ? "opponent_win" : "host_win";
    } else if (result === "draw") {
      canonicalResult = "draw";
    } else {
      canonicalResult = "cancelled";
    }

    // Upsert the submission (unique per game+user)
    const existingSub = await db
      .select()
      .from(gameResultSubmissions)
      .where(
        and(
          eq(gameResultSubmissions.gameSessionId, session.id),
          eq(gameResultSubmissions.submittedByUserId, userId)
        )
      )
      .limit(1);

    if (existingSub.length > 0) {
      await db
        .update(gameResultSubmissions)
        .set({ submittedResult: canonicalResult, updatedAt: new Date() })
        .where(eq(gameResultSubmissions.id, existingSub[0].id));
    } else {
      await db.insert(gameResultSubmissions).values({
        id: nanoid(),
        gameSessionId: session.id,
        submittedByUserId: userId,
        submittedResult: canonicalResult,
      });
    }

    // Check if both players have submitted
    const allSubs = await db
      .select()
      .from(gameResultSubmissions)
      .where(eq(gameResultSubmissions.gameSessionId, session.id));

    if (allSubs.length < 2) {
      // Still waiting for the other player
      return res.json({ status: "waiting", message: "Waiting for opponent to confirm result" });
    }

    // Both have submitted — check if they match
    const hostSub = allSubs.find((s) => s.submittedByUserId === session.hostUserId);
    const opponentSub = allSubs.find((s) => s.submittedByUserId === session.opponentUserId);

    if (!hostSub || !opponentSub) {
      return res.json({ status: "waiting", message: "Waiting for opponent to confirm result" });
    }

    if (hostSub.submittedResult === opponentSub.submittedResult) {
      // Results match! Confirm the game
      await db
        .update(gameSessions)
        .set({ status: "result_confirmed", updatedAt: new Date() })
        .where(eq(gameSessions.id, session.id));

      // Process rating if applicable
      let ratingUpdates: { host: RatingUpdate; opponent: RatingUpdate } | null = null;
      if (session.isRated && hostSub.submittedResult !== "cancelled") {
        ratingUpdates = await processConfirmedGameRating(session.id);
      }

      return res.json({
        status: "confirmed",
        result: hostSub.submittedResult,
        ratingUpdates,
      });
    } else {
      // Results don't match — dispute
      await db
        .update(gameSessions)
        .set({ status: "result_disputed", updatedAt: new Date() })
        .where(eq(gameSessions.id, session.id));

      return res.json({
        status: "disputed",
        message: "Result mismatch detected. Both players must report the same result to register this game. Please confirm the correct result.",
      });
    }
  } catch (err: any) {
    console.error("[otb-games] submit result error:", err);
    return res.status(500).json({ error: "Failed to submit result" });
  }
});

// ─── GET /ratings/:userId — Get user's OTB ratings ───────────────────────────
router.get("/ratings/:userId", async (req, res) => {
  try {
    const db = await getDb();
    const ratings = await db
      .select()
      .from(playerRatings)
      .where(eq(playerRatings.userId, req.params.userId));

    // Also get recent history
    const history = await db
      .select()
      .from(otbRatingHistory)
      .where(eq(otbRatingHistory.userId, req.params.userId))
      .orderBy(desc(otbRatingHistory.createdAt))
      .limit(20);

    // Transform into the shape expected by the client
    const blitzRating = ratings.find((r) => r.category === "otb_blitz");
    const rapidRating = ratings.find((r) => r.category === "otb_rapid");

    const formatRating = (r: typeof ratings[0] | undefined) => {
      if (!r) return null;
      let tier = "provisional";
      if (r.gamesPlayed >= 30) tier = "established";
      else if (r.gamesPlayed >= 10) tier = "rated";
      return {
        rating: Number(r.rating),
        gamesPlayed: r.gamesPlayed,
        wins: r.wins,
        losses: r.losses,
        draws: r.draws,
        tier,
      };
    };

    return res.json({
      blitz: formatRating(blitzRating),
      rapid: formatRating(rapidRating),
      history,
    });
  } catch (err: any) {
    console.error("[otb-games] get ratings error:", err);
    return res.status(500).json({ error: "Failed to get ratings" });
  }
});

// ─── GET /leaderboard/:category — Get leaderboard ────────────────────────────
router.get("/leaderboard/:category", async (req, res) => {
  try {
    const db = await getDb();
    const { category } = req.params;

    if (!["otb_blitz", "otb_rapid"].includes(category)) {
      return res.status(400).json({ error: "Invalid category. Use otb_blitz or otb_rapid" });
    }

    // Only show users with 5+ games (rated or established status)
    const leaderboard = await db
      .select({
        userId: playerRatings.userId,
        rating: playerRatings.rating,
        status: playerRatings.status,
        gamesPlayed: playerRatings.gamesPlayed,
        wins: playerRatings.wins,
        losses: playerRatings.losses,
        draws: playerRatings.draws,
      })
      .from(playerRatings)
      .where(
        and(
          eq(playerRatings.category, category),
          gte(playerRatings.gamesPlayed, 5)
        )
      )
      .orderBy(desc(playerRatings.rating))
      .limit(50);

    // Enrich with user display names
    if (leaderboard.length > 0) {
      const userIds = leaderboard.map((r) => r.userId);
      const usersData = await db
        .select({ id: users.id, displayName: users.displayName, avatarUrl: users.avatarUrl })
        .from(users)
        .where(sql`${users.id} IN (${sql.join(userIds.map(id => sql`${id}`), sql`, `)})`);

      const userMap = new Map(usersData.map((u) => [u.id, u]));

      const enriched = leaderboard.map((r) => ({
        ...r,
        displayName: userMap.get(r.userId)?.displayName || "Unknown",
        avatarUrl: userMap.get(r.userId)?.avatarUrl || null,
      }));

      return res.json(enriched);
    }

    return res.json(leaderboard);
  } catch (err: any) {
    console.error("[otb-games] get leaderboard error:", err);
    return res.status(500).json({ error: "Failed to get leaderboard" });
  }
});

export default router;
