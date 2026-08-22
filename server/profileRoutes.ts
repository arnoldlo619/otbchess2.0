/** Profile management routes: identity fields, ratings, password, and Pro renewal. */
import { Router } from "express";
import bcrypt from "bcryptjs";
import { and, desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getDb } from "./db.js";
import { ratingHistory, users } from "../shared/schema.js";
import { logger } from "./logger.js";
import {
  BCRYPT_ROUNDS,
  getRequestToken,
  getTokenPayload,
  safeUser,
} from "./authCore.js";

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character] ?? character);
}

function requirePayload(req: import("express").Request, res: import("express").Response) {
  if (!getRequestToken(req)) {
    res.status(401).json({ error: "Not authenticated" });
    return null;
  }
  const payload = getTokenPayload(req);
  if (!payload) {
    res.status(401).json({ error: "Invalid or expired token" });
    return null;
  }
  return payload;
}

async function sendRenewalRequest(userId: string, res: import("express").Response) {
  try {
    const db = await getDb();
    const rows = await db.select({
      email: users.email,
      displayName: users.displayName,
      proExpiresAt: users.proExpiresAt,
    }).from(users).where(eq(users.id, userId)).limit(1);
    if (!rows.length) return res.status(404).json({ error: "User not found" });

    const user = rows[0];
    const expiryText = user.proExpiresAt
      ? new Date(user.proExpiresAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
      : "No expiry set";
    logger.info(`[pro-renewal] Renewal request from ${user.email} (${user.displayName}), current expiry: ${user.proExpiresAt ? new Date(user.proExpiresAt).toISOString() : "none"}`);

    const safeName = escapeHtml(user.displayName);
    const safeEmail = escapeHtml(user.email);
    const safeExpiry = escapeHtml(expiryText);
    const { sendPlatformEmail } = await import("./platformEmail.js");
    sendPlatformEmail({
      to: "info@chessotb.club",
      subject: `Pro Renewal Request — ${user.displayName}`,
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;background:#0d1f12;color:#e8f5e9;border-radius:12px">
          <h2 style="color:#4ade80;margin-top:0">Pro Renewal Request</h2>
          <p>A user has requested to renew their Pro access on <strong>ChessOTB.club</strong>.</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0">
            <tr><td style="padding:8px;color:#86efac;font-weight:bold">Name</td><td style="padding:8px">${safeName}</td></tr>
            <tr><td style="padding:8px;color:#86efac;font-weight:bold">Email</td><td style="padding:8px">${safeEmail}</td></tr>
            <tr><td style="padding:8px;color:#86efac;font-weight:bold">Current Expiry</td><td style="padding:8px">${safeExpiry}</td></tr>
          </table>
          <p style="margin-top:20px">Visit the <a href="https://chessotb.club/admin/staff" style="color:#4ade80">Admin Staff Panel</a> to extend access.</p>
          <hr style="border-color:#1a3a24;margin:20px 0" />
          <p style="font-size:12px;color:#4a7c59">Automated notification from ChessOTB.club</p>
        </div>`,
      text: `Pro Renewal Request\n\nName: ${user.displayName}\nEmail: ${user.email}\nCurrent Expiry: ${expiryText}\n\nVisit https://chessotb.club/admin/staff to extend their access.`,
    }).catch((error: unknown) => logger.error("[pro-renewal] Failed to send notification email:", error));

    return res.json({ ok: true, message: "Renewal request received" });
  } catch (error) {
    logger.error("[pro-renewal] error:", error);
    return res.status(500).json({ error: "Failed to submit renewal request" });
  }
}

export function createProfileRouter(): Router {
  const router = Router();

  router.patch("/me", async (req, res) => {
    const payload = requirePayload(req, res);
    if (!payload) return;
    if (payload.isGuest) return res.status(403).json({ error: "Guest accounts cannot edit profiles", code: "GUEST_FORBIDDEN" });

    const { displayName, chesscomUsername, lichessUsername, avatarUrl, fideId } = req.body as {
      displayName?: string;
      chesscomUsername?: string;
      lichessUsername?: string;
      avatarUrl?: string;
      fideId?: string;
    };

    try {
      const db = await getDb();
      const updateData: Partial<typeof users.$inferInsert> = { updatedAt: new Date() };
      if (displayName !== undefined) updateData.displayName = displayName.trim();
      if (chesscomUsername !== undefined) updateData.chesscomUsername = chesscomUsername.toLowerCase().trim() || null;
      if (lichessUsername !== undefined) updateData.lichessUsername = lichessUsername.toLowerCase().trim() || null;
      if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl || null;
      if (fideId !== undefined) updateData.fideId = fideId.trim() || null;

      if (chesscomUsername?.trim()) {
        try {
          const username = chesscomUsername.toLowerCase().trim();
          const headers = { "User-Agent": "OTBChess/1.0 (https://chessotb.club)" };
          const [profileResponse, statsResponse] = await Promise.all([
            fetch(`https://api.chess.com/pub/player/${username}`, { headers }),
            fetch(`https://api.chess.com/pub/player/${username}/stats`, { headers }),
          ]);
          if (profileResponse.ok) {
            const profile = await profileResponse.json() as Record<string, unknown>;
            if (!avatarUrl && typeof profile.avatar === "string" && profile.avatar) updateData.avatarUrl = profile.avatar;
          }
          if (statsResponse.ok) {
            const stats = await statsResponse.json() as Record<string, unknown>;
            const rapid = (stats.chess_rapid as Record<string, unknown> | undefined)?.last as Record<string, unknown> | undefined;
            const blitz = (stats.chess_blitz as Record<string, unknown> | undefined)?.last as Record<string, unknown> | undefined;
            const bullet = (stats.chess_bullet as Record<string, unknown> | undefined)?.last as Record<string, unknown> | undefined;
            const rapidRating = rapid?.rating as number | undefined;
            const blitzRating = blitz?.rating as number | undefined;
            const bulletRating = bullet?.rating as number | undefined;
            const [currentUser] = await db.select().from(users).where(eq(users.id, payload.sub));

            updateData.chesscomElo = rapidRating ?? blitzRating ?? bulletRating ?? updateData.chesscomElo;
            if (rapidRating) {
              if (currentUser?.chesscomRapid && currentUser.chesscomRapid !== rapidRating) updateData.chesscomPrevRapid = currentUser.chesscomRapid;
              updateData.chesscomRapid = rapidRating;
            }
            if (blitzRating) {
              if (currentUser?.chesscomBlitz && currentUser.chesscomBlitz !== blitzRating) updateData.chesscomPrevBlitz = currentUser.chesscomBlitz;
              updateData.chesscomBlitz = blitzRating;
            }
            if (bulletRating) {
              if (currentUser?.chesscomBullet && currentUser.chesscomBullet !== bulletRating) updateData.chesscomPrevBullet = currentUser.chesscomBullet;
              updateData.chesscomBullet = bulletRating;
            }

            const historyEntries = [
              rapidRating && rapidRating !== currentUser?.chesscomRapid ? { format: "rapid", rating: rapidRating } : null,
              blitzRating && blitzRating !== currentUser?.chesscomBlitz ? { format: "blitz", rating: blitzRating } : null,
              bulletRating && bulletRating !== currentUser?.chesscomBullet ? { format: "bullet", rating: bulletRating } : null,
            ].filter((entry): entry is { format: string; rating: number } => Boolean(entry));

            for (const entry of historyEntries) {
              await db.insert(ratingHistory).values({ id: nanoid(), userId: payload.sub, ...entry });
              const rows = await db.select({ id: ratingHistory.id })
                .from(ratingHistory)
                .where(and(eq(ratingHistory.userId, payload.sub), eq(ratingHistory.format, entry.format)))
                .orderBy(desc(ratingHistory.recordedAt));
              for (const stale of rows.slice(10)) await db.delete(ratingHistory).where(eq(ratingHistory.id, stale.id));
            }
          }
        } catch {
          // Provider enrichment is best-effort and must not block profile saves.
        }
      }

      await db.update(users).set(updateData).where(eq(users.id, payload.sub));
      const [updated] = await db.select().from(users).where(eq(users.id, payload.sub));
      return res.json({ user: safeUser(updated) });
    } catch (error) {
      logger.error("[profile] patch me error:", error);
      return res.status(500).json({ error: "Failed to update profile" });
    }
  });

  const ratingHistoryHandler = async (req: import("express").Request, res: import("express").Response) => {
    const payload = requirePayload(req, res);
    if (!payload) return;
    try {
      const db = await getDb();
      const history = await db.select().from(ratingHistory)
        .where(eq(ratingHistory.userId, payload.sub))
        .orderBy(desc(ratingHistory.recordedAt))
        .limit(30);
      return res.json({ history });
    } catch (error) {
      logger.error("[profile] rating-history error:", error);
      return res.status(500).json({ error: "Failed to fetch rating history" });
    }
  };
  router.get("/rating-history", ratingHistoryHandler);
  router.get("/auth/rating-history", ratingHistoryHandler); // legacy path compatibility

  router.post("/renew-pro-request", async (req, res) => {
    const payload = requirePayload(req, res);
    if (!payload) return;
    return sendRenewalRequest(payload.sub, res);
  });

  router.post("/change-password", async (req, res) => {
    const payload = requirePayload(req, res);
    if (!payload) return;
    const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string };
    if (!currentPassword || !newPassword) return res.status(400).json({ error: "currentPassword and newPassword are required" });
    if (newPassword.length < 8) return res.status(400).json({ error: "New password must be at least 8 characters" });
    if (currentPassword === newPassword) return res.status(400).json({ error: "New password must differ from the current password" });

    try {
      const db = await getDb();
      const [user] = await db.select({ id: users.id, passwordHash: users.passwordHash, isGuest: users.isGuest })
        .from(users).where(eq(users.id, payload.sub)).limit(1);
      if (!user) return res.status(404).json({ error: "User not found" });
      if (user.isGuest || !user.passwordHash) return res.status(400).json({ error: "Guest accounts cannot change passwords" });
      if (!(await bcrypt.compare(currentPassword, user.passwordHash))) return res.status(401).json({ error: "Current password is incorrect" });

      await db.update(users).set({
        passwordHash: await bcrypt.hash(newPassword, BCRYPT_ROUNDS),
        updatedAt: new Date(),
      }).where(eq(users.id, user.id));
      logger.info(`[profile] Password updated for user ${user.id}`);
      return res.json({ ok: true, message: "Password updated successfully" });
    } catch (error) {
      logger.error("[profile] change-password error:", error);
      return res.status(500).json({ error: "Failed to update password" });
    }
  });

  return router;
}
