/**
 * clubInvites.ts
 * Club email invite system — create, list, revoke, and accept invites.
 *
 * Routes:
 *   POST   /api/clubs/:clubId/invites          — send invite (owner/director only)
 *   GET    /api/clubs/:clubId/invites          — list pending invites (owner/director only)
 *   DELETE /api/clubs/:clubId/invites/:token   — revoke invite (owner/director only)
 *   GET    /api/invite/:token                  — look up invite details (public)
 *   POST   /api/invite/:token/accept           — accept invite (authenticated user)
 */

import { Router, type Request, type Response } from "express";
import { nanoid } from "nanoid";
import { eq, and } from "drizzle-orm";
import { getDb } from "./db.js";
import { requireAuth, requireFullAuth } from "./auth.js";
import { clubInvites, dbClubs, dbClubMembers } from "../shared/schema.js";
import { logger } from "./logger.js";

const router = Router({ mergeParams: true });

type AuthenticatedRequest = Request & { userId?: string };

function authenticatedUserId(req: AuthenticatedRequest): string | null {
  return req.userId ?? null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function requireInviteManager(req: AuthenticatedRequest, res: Response) {
  const userId = authenticatedUserId(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return null; }
  const { clubId } = req.params;
  const db = await getDb();
  const [club] = await db.select().from(dbClubs).where(eq(dbClubs.id, clubId)).limit(1);
  if (!club) { res.status(404).json({ error: "Club not found" }); return null; }
  if (club.ownerId !== userId) {
    const [membership] = await db.select({ role: dbClubMembers.role }).from(dbClubMembers)
      .where(and(eq(dbClubMembers.clubId, club.id), eq(dbClubMembers.userId, userId))).limit(1);
    if (membership?.role !== "director") {
      res.status(403).json({ error: "Only owners and directors can manage club invites" });
      return null;
    }
  }
  return { db, clubId: club.id, userId };
}

function generateToken(): string {
  return nanoid(48);
}

function inviteExpiresAt(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 7); // 7-day expiry
  return d;
}

// ─── POST /api/clubs/:clubId/invites ─────────────────────────────────────────
// Create and "send" an invite. In dev, the invite link is returned in the
// response body. In production, an email would be sent here.
router.post("/", requireFullAuth, async (req, res) => {
  try {
    const access = await requireInviteManager(req, res);
    if (!access) return;
    const { db, clubId, userId } = access;

    const { email } = req.body as { email?: string };
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "A valid email address is required." });
    }

    const token = generateToken();
    const expiresAt = inviteExpiresAt();
    const id = nanoid();

    // Revoke any existing pending invite for the same club+email
    await db
      .update(clubInvites)
      .set({ status: "revoked" })
      .where(
        and(
          eq(clubInvites.clubId, clubId),
          eq(clubInvites.email, email.toLowerCase()),
          eq(clubInvites.status, "pending")
        )
      );

    await db.insert(clubInvites).values({
      id,
      clubId,
      email: email.toLowerCase(),
      token,
      invitedBy: userId,
      status: "pending",
      expiresAt,
    });

    // Build the invite URL (works in both dev and production)
    const baseUrl =
      process.env.VITE_APP_URL ||
      `${req.protocol}://${req.get("host")}`;
    const inviteUrl = `${baseUrl}/invite/${token}`;

    // In a real deployment, send an email here via SendGrid / Resend / etc.
    // For now, return the link so the director can copy-paste it.

    return res.json({
      id,
      email: email.toLowerCase(),
      token,
      inviteUrl,
      expiresAt: expiresAt.toISOString(),
      message: `Invite created. Share this link with ${email}: ${inviteUrl}`,
    });
  } catch (error) {
    logger.error("club_invite_create_failed", { clubId: req.params.clubId, error });
    return res.status(500).json({ error: "Failed to create club invite" });
  }
});

// ─── GET /api/clubs/:clubId/invites ──────────────────────────────────────────
router.get("/", requireFullAuth, async (req, res) => {
  try {
    const access = await requireInviteManager(req, res);
    if (!access) return;
    const { db, clubId } = access;
    const rows = await db
      .select()
      .from(clubInvites)
      .where(eq(clubInvites.clubId, clubId))
      .orderBy(clubInvites.createdAt);
    return res.json(rows);
  } catch (error) {
    logger.error("club_invite_list_failed", { clubId: req.params.clubId, error });
    return res.status(500).json({ error: "Failed to list club invites" });
  }
});

// ─── DELETE /api/clubs/:clubId/invites/:token ─────────────────────────────────
router.delete("/:token", requireFullAuth, async (req, res) => {
  try {
    const access = await requireInviteManager(req, res);
    if (!access) return;
    const { db, clubId } = access;
    const { token } = req.params;
    await db
      .update(clubInvites)
      .set({ status: "revoked" })
      .where(
        and(
          eq(clubInvites.clubId, clubId),
          eq(clubInvites.token, token),
          eq(clubInvites.status, "pending")
        )
      );
    return res.json({ ok: true });
  } catch (error) {
    logger.error("club_invite_revoke_failed", { clubId: req.params.clubId, error });
    return res.status(500).json({ error: "Failed to revoke club invite" });
  }
});

export default router;

// ─── Standalone invite routes (no clubId param) ───────────────────────────────

export function createInviteRouter() {
  const r = Router();

  // GET /api/invite/:token — look up invite details (public, no auth required)
  r.get("/:token", async (req, res) => {
    const { token } = req.params;
    const db = await getDb();
    const [invite] = await db
      .select()
      .from(clubInvites)
      .where(eq(clubInvites.token, token))
      .limit(1);

    if (!invite) return res.status(404).json({ error: "Invite not found." });
    if (invite.status !== "pending") {
      return res.status(410).json({ error: "This invite has already been used or revoked.", status: invite.status });
    }
    if (new Date(invite.expiresAt) < new Date()) {
      return res.status(410).json({ error: "This invite has expired." });
    }

    return res.json({
      id: invite.id,
      clubId: invite.clubId,
      email: invite.email,
      status: invite.status,
      expiresAt: invite.expiresAt,
    });
  });

  // POST /api/invite/:token/accept — authenticated user accepts the invite
  r.post("/:token/accept", requireAuth, async (req, res) => {
    const { token } = req.params;
    const userId = authenticatedUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const db = await getDb();
    const [invite] = await db
      .select()
      .from(clubInvites)
      .where(eq(clubInvites.token, token))
      .limit(1);

    if (!invite) return res.status(404).json({ error: "Invite not found." });
    if (invite.status !== "pending") {
      return res.status(410).json({ error: "This invite has already been used or revoked." });
    }
    if (new Date(invite.expiresAt) < new Date()) {
      return res.status(410).json({ error: "This invite has expired." });
    }

    await db
      .update(clubInvites)
      .set({ status: "accepted", acceptedAt: new Date() })
      .where(eq(clubInvites.token, token));

    return res.json({ ok: true, clubId: invite.clubId });
  });

  return r;
}
