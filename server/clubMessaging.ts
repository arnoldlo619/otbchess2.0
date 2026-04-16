/**
 * Club Messaging API Routes
 * 
 * Endpoints:
 *   GET    /api/clubs/:clubId/conversations         — list all DM threads for the authenticated user in this club
 *   POST   /api/clubs/:clubId/conversations         — get-or-create a DM thread with another member
 *   GET    /api/clubs/:clubId/conversations/:convId/messages  — paginated message history
 *   POST   /api/clubs/:clubId/conversations/:convId/messages  — send a text message
 *   POST   /api/clubs/:clubId/conversations/:convId/chess-invite — send a chess game invite
 *   POST   /api/clubs/:clubId/conversations/:convId/chess-games/:gameId/move — make a chess move
 *   POST   /api/clubs/:clubId/conversations/:convId/chess-games/:gameId/respond — accept/decline invite
 */
import { Router } from "express";
import { nanoid } from "nanoid";
import { eq, and, or, desc, asc } from "drizzle-orm";
import { Chess } from "chess.js";
import { getDb } from "./db";
import { requireAuth } from "./auth";
import { logger } from "./logger.js";
import {
  clubConversations,
  clubMessages,
  clubChessGames,
  users,
} from "../shared/schema";

const router = Router({ mergeParams: true });

// ── Helper: ensure the authenticated user is a member of the club ─────────────
// We rely on the clubRegistry (localStorage) for membership on the client side,
// but on the server we simply check that the user is authenticated and the
// clubId param is present. Full membership enforcement can be added later.

// ── GET /api/clubs/:clubId/conversations ─────────────────────────────────────
router.get("/", requireAuth, async (req, res) => {
  const userId = (req as typeof req & { userId: string }).userId;
  const { clubId } = req.params;
  try {
    const db = await getDb();
    // Find all conversations where the user is either userA or userB
    const rows = await db
      .select()
      .from(clubConversations)
      .where(
        and(
          eq(clubConversations.clubId, clubId),
          or(
            eq(clubConversations.userAId, userId),
            eq(clubConversations.userBId, userId)
          )
        )
      )
      .orderBy(desc(clubConversations.lastMessageAt));

    // Enrich with the other participant's display name and avatar
    const enriched = await Promise.all(
      rows.map(async (conv) => {
        const otherId = conv.userAId === userId ? conv.userBId : conv.userAId;
        const [other] = await db
          .select({ id: users.id, displayName: users.displayName, avatarUrl: users.avatarUrl, chesscomUsername: users.chesscomUsername })
          .from(users)
          .where(eq(users.id, otherId))
          .limit(1);
        // Fetch last message preview
        const [lastMsg] = await db
          .select({ body: clubMessages.body, type: clubMessages.type, senderId: clubMessages.senderId, createdAt: clubMessages.createdAt })
          .from(clubMessages)
          .where(eq(clubMessages.conversationId, conv.id))
          .orderBy(desc(clubMessages.createdAt))
          .limit(1);
        return { ...conv, otherUser: other ?? null, lastMessage: lastMsg ?? null };
      })
    );
    return res.json({ conversations: enriched });
  } catch (err) {
    logger.error("[club-messaging] list conversations error:", err);
    return res.status(500).json({ error: "Failed to load conversations" });
  }
});

// ── POST /api/clubs/:clubId/conversations ─────────────────────────────────────
// Body: { otherUserId: string }
router.post("/", requireAuth, async (req, res) => {
  const userId = (req as typeof req & { userId: string }).userId;
  const { clubId } = req.params;
  const { otherUserId } = req.body as { otherUserId: string };
  if (!otherUserId) return res.status(400).json({ error: "otherUserId required" });
  if (otherUserId === userId) return res.status(400).json({ error: "Cannot message yourself" });

  // Canonical ordering: userAId < userBId
  const [userAId, userBId] = userId < otherUserId ? [userId, otherUserId] : [otherUserId, userId];

  try {
    const db = await getDb();
    // Check if conversation already exists
    const existing = await db
      .select()
      .from(clubConversations)
      .where(
        and(
          eq(clubConversations.clubId, clubId),
          eq(clubConversations.userAId, userAId),
          eq(clubConversations.userBId, userBId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return res.json({ conversation: existing[0] });
    }

    const id = nanoid();
    await db.insert(clubConversations).values({
      id,
      clubId,
      userAId,
      userBId,
      lastMessageAt: new Date(),
      createdAt: new Date(),
    });
    const [created] = await db.select().from(clubConversations).where(eq(clubConversations.id, id)).limit(1);
    return res.status(201).json({ conversation: created });
  } catch (err) {
    logger.error("[club-messaging] create conversation error:", err);
    return res.status(500).json({ error: "Failed to create conversation" });
  }
});

// ── GET /api/clubs/:clubId/conversations/:convId/messages ─────────────────────
router.get("/:convId/messages", requireAuth, async (req, res) => {
  const userId = (req as typeof req & { userId: string }).userId;
  const { convId } = req.params;
  const limit = Math.min(parseInt((req.query.limit as string) ?? "50"), 100);
  try {
    const db = await getDb();
    // Verify user is a participant
    const [conv] = await db.select().from(clubConversations).where(eq(clubConversations.id, convId)).limit(1);
    if (!conv || (conv.userAId !== userId && conv.userBId !== userId)) {
      return res.status(403).json({ error: "Not a participant" });
    }
    const messages = await db
      .select()
      .from(clubMessages)
      .where(eq(clubMessages.conversationId, convId))
      .orderBy(asc(clubMessages.createdAt))
      .limit(limit);

    // Attach chess game data for chess_invite / chess_move messages
    const enriched = await Promise.all(
      messages.map(async (msg) => {
        if (msg.chessGameId) {
          const [game] = await db.select().from(clubChessGames).where(eq(clubChessGames.id, msg.chessGameId)).limit(1);
          return { ...msg, chessGame: game ?? null };
        }
        return { ...msg, chessGame: null };
      })
    );
    return res.json({ messages: enriched });
  } catch (err) {
    logger.error("[club-messaging] list messages error:", err);
    return res.status(500).json({ error: "Failed to load messages" });
  }
});

// ── POST /api/clubs/:clubId/conversations/:convId/messages ────────────────────
// Body: { body: string }
router.post("/:convId/messages", requireAuth, async (req, res) => {
  const userId = (req as typeof req & { userId: string }).userId;
  const { convId } = req.params;
  const { body } = req.body as { body: string };
  if (!body?.trim()) return res.status(400).json({ error: "Message body required" });

  try {
    const db = await getDb();
    const [conv] = await db.select().from(clubConversations).where(eq(clubConversations.id, convId)).limit(1);
    if (!conv || (conv.userAId !== userId && conv.userBId !== userId)) {
      return res.status(403).json({ error: "Not a participant" });
    }
    const msgId = nanoid();
    await db.insert(clubMessages).values({
      id: msgId,
      conversationId: convId,
      senderId: userId,
      type: "text",
      body: body.trim(),
      createdAt: new Date(),
    });
    await db.update(clubConversations).set({ lastMessageAt: new Date() }).where(eq(clubConversations.id, convId));
    const [msg] = await db.select().from(clubMessages).where(eq(clubMessages.id, msgId)).limit(1);
    return res.status(201).json({ message: { ...msg, chessGame: null } });
  } catch (err) {
    logger.error("[club-messaging] send message error:", err);
    return res.status(500).json({ error: "Failed to send message" });
  }
});

// ── POST /api/clubs/:clubId/conversations/:convId/chess-invite ────────────────
// Creates a pending chess game and posts a chess_invite message
router.post("/:convId/chess-invite", requireAuth, async (req, res) => {
  const userId = (req as typeof req & { userId: string }).userId;
  const { convId } = req.params;
  try {
    const db = await getDb();
    const [conv] = await db.select().from(clubConversations).where(eq(clubConversations.id, convId)).limit(1);
    if (!conv || (conv.userAId !== userId && conv.userBId !== userId)) {
      return res.status(403).json({ error: "Not a participant" });
    }
    const otherId = conv.userAId === userId ? conv.userBId : conv.userAId;
    const gameId = nanoid();
    await db.insert(clubChessGames).values({
      id: gameId,
      conversationId: convId,
      whiteId: userId,   // inviter plays White
      blackId: otherId,
      status: "pending",
      pgn: null,
      currentFen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      turn: "white",
      result: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const msgId = nanoid();
    await db.insert(clubMessages).values({
      id: msgId,
      conversationId: convId,
      senderId: userId,
      type: "chess_invite",
      body: "Chess game invite",
      chessGameId: gameId,
      createdAt: new Date(),
    });
    await db.update(clubConversations).set({ lastMessageAt: new Date() }).where(eq(clubConversations.id, convId));
    const [game] = await db.select().from(clubChessGames).where(eq(clubChessGames.id, gameId)).limit(1);
    const [msg] = await db.select().from(clubMessages).where(eq(clubMessages.id, msgId)).limit(1);
    return res.status(201).json({ message: { ...msg, chessGame: game } });
  } catch (err) {
    logger.error("[club-messaging] chess invite error:", err);
    return res.status(500).json({ error: "Failed to send chess invite" });
  }
});

// ── POST /api/clubs/:clubId/conversations/:convId/chess-games/:gameId/respond ─
// Body: { action: 'accept' | 'decline' }
router.post("/:convId/chess-games/:gameId/respond", requireAuth, async (req, res) => {
  const userId = (req as typeof req & { userId: string }).userId;
  const { convId, gameId } = req.params;
  const { action } = req.body as { action: "accept" | "decline" };
  try {
    const db = await getDb();
    const [game] = await db.select().from(clubChessGames).where(eq(clubChessGames.id, gameId)).limit(1);
    if (!game) return res.status(404).json({ error: "Game not found" });
    if (game.blackId !== userId) return res.status(403).json({ error: "Only the invited player can respond" });
    if (game.status !== "pending") return res.status(400).json({ error: "Game is not pending" });

    const newStatus = action === "accept" ? "active" : "declined";
    await db.update(clubChessGames).set({ status: newStatus, updatedAt: new Date() }).where(eq(clubChessGames.id, gameId));

    // Post a system message
    const msgId = nanoid();
    await db.insert(clubMessages).values({
      id: msgId,
      conversationId: convId,
      senderId: userId,
      type: "chess_move",
      body: action === "accept" ? "Game accepted! White moves first." : "Game declined.",
      chessGameId: gameId,
      createdAt: new Date(),
    });
    await db.update(clubConversations).set({ lastMessageAt: new Date() }).where(eq(clubConversations.id, convId));

    const [updated] = await db.select().from(clubChessGames).where(eq(clubChessGames.id, gameId)).limit(1);
    return res.json({ game: updated });
  } catch (err) {
    logger.error("[club-messaging] respond to chess invite error:", err);
    return res.status(500).json({ error: "Failed to respond to chess invite" });
  }
});

// ── POST /api/clubs/:clubId/conversations/:convId/chess-games/:gameId/move ────
// Body: { from: string, to: string, promotion?: string }
router.post("/:convId/chess-games/:gameId/move", requireAuth, async (req, res) => {
  const userId = (req as typeof req & { userId: string }).userId;
  const { convId, gameId } = req.params;
  const { from, to, promotion } = req.body as { from: string; to: string; promotion?: string };
  try {
    const db = await getDb();
    const [game] = await db.select().from(clubChessGames).where(eq(clubChessGames.id, gameId)).limit(1);
    if (!game) return res.status(404).json({ error: "Game not found" });
    if (game.status !== "active") return res.status(400).json({ error: "Game is not active" });

    // Verify it's the user's turn
    const isWhiteTurn = game.turn === "white";
    if (isWhiteTurn && game.whiteId !== userId) return res.status(403).json({ error: "Not your turn" });
    if (!isWhiteTurn && game.blackId !== userId) return res.status(403).json({ error: "Not your turn" });

    // Validate and apply the move using chess.js
    const chess = new Chess(game.currentFen ?? undefined);
    const moveResult = chess.move({ from, to, promotion: promotion as "q" | "r" | "b" | "n" | undefined });
    if (!moveResult) return res.status(400).json({ error: "Illegal move" });

    const newFen = chess.fen();
    const newPgn = chess.pgn();
    const newTurn = chess.turn() === "w" ? "white" : "black";

    // Check for game over
    let result: string | null = null;
    let newStatus = "active";
    if (chess.isCheckmate()) {
      result = isWhiteTurn ? "white_wins" : "black_wins";
      newStatus = "completed";
    } else if (chess.isDraw()) {
      result = "draw";
      newStatus = "completed";
    }

    await db.update(clubChessGames).set({
      currentFen: newFen,
      pgn: newPgn,
      turn: newTurn,
      status: newStatus,
      result,
      updatedAt: new Date(),
    }).where(eq(clubChessGames.id, gameId));

    // Post a chess_move message
    const msgId = nanoid();
    const moveLabel = `${moveResult.piece.toUpperCase()} ${from}→${to}${result ? ` — ${result.replace("_", " ")}` : ""}`;
    await db.insert(clubMessages).values({
      id: msgId,
      conversationId: convId,
      senderId: userId,
      type: "chess_move",
      body: moveLabel,
      chessGameId: gameId,
      createdAt: new Date(),
    });
    await db.update(clubConversations).set({ lastMessageAt: new Date() }).where(eq(clubConversations.id, convId));

    const [updated] = await db.select().from(clubChessGames).where(eq(clubChessGames.id, gameId)).limit(1);
    return res.json({ game: updated, move: moveResult });
  } catch (err) {
    logger.error("[club-messaging] chess move error:", err);
    return res.status(500).json({ error: "Failed to make move" });
  }
});

export default router;
