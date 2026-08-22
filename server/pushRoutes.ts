/**
 * Push notification routes — extracted from server/index.ts.
 *
 * Handles VAPID key distribution, subscription management, and
 * all notification broadcast endpoints (round pairings, results,
 * timer warnings, bracket live, tournament complete).
 */
import { Router } from "express";
import webpush from "web-push";
import { nanoid } from "nanoid";
import { eq, and } from "drizzle-orm";
import { getDb } from "./db.js";
import { pushSubscriptions } from "../shared/schema.js";
import { logger } from "./logger.js";
import { validate, pushSubscribeSchema, pushNotifySchema } from "./validation.js";
import { rateLimit, ipKeyGenerator } from "express-rate-limit";

type PushSub = webpush.PushSubscription;

const PUSH_ICON = "https://files.manuscdn.com/user_upload_by_module/session_file/117675823/iqZHgEQGHFmYeOzw.png";
const PUSH_BADGE = "https://files.manuscdn.com/user_upload_by_module/session_file/117675823/sffLnKtDRYocchPn.png";

// ── Shared broadcast helper ──────────────────────────────────────────────────
async function broadcastPush(
  tournamentId: string,
  buildPayload: (row: { chessUsername: string | null }) => string,
  label: string,
) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.tournamentId, tournamentId));

  if (rows.length === 0) return { ok: true, sent: 0, failed: 0 };

  let sent = 0;
  let failed = 0;
  const staleIds: string[] = [];

  await Promise.allSettled(
    rows.map(async (row) => {
      const sub: PushSub = {
        endpoint: row.endpoint,
        keys: { p256dh: row.p256dh, auth: row.auth },
      };
      try {
        await webpush.sendNotification(sub, buildPayload(row));
        sent++;
      } catch (err: unknown) {
        failed++;
        if (err && typeof err === "object" && "statusCode" in err) {
          const code = (err as { statusCode: number }).statusCode;
          if (code === 410 || code === 404) staleIds.push(row.id);
        }
        logger.warn(`[push] Failed to send ${label} notification:`, err);
      }
    }),
  );

  if (staleIds.length > 0) {
    await Promise.all(staleIds.map((id) => db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, id))));
  }

  logger.info(`[push] ${label} for ${tournamentId}: ${sent} sent, ${failed} failed`);
  return { ok: true, sent, failed };
}

// ── Rate limiter for subscribe ───────────────────────────────────────────────
const pushSubscribeLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  keyGenerator: (req: any) => ipKeyGenerator(req.ip ?? ""),
  message: { error: "Too many push subscribe requests. Please try again later." },
  skip: () => process.env.NODE_ENV !== "production",
});

export function createPushRouter(): Router {
  const router = Router();

  // GET /vapid-public-key
  router.get("/vapid-public-key", (_req, res) => {
    const key = process.env.VAPID_PUBLIC_KEY;
    if (!key) return res.status(503).json({ error: "Push notifications not configured" });
    res.json({ publicKey: key });
  });

  // GET /count/:tournamentId
  router.get("/count/:tournamentId", async (req, res) => {
    try {
      const db = await getDb();
      const rows = await db
        .select({ id: pushSubscriptions.id })
        .from(pushSubscriptions)
        .where(eq(pushSubscriptions.tournamentId, req.params.tournamentId));
      res.json({ count: rows.length });
    } catch (err) {
      logger.error("[push] count error:", err);
      res.status(500).json({ error: "Database error" });
    }
  });

  // POST /subscribe
  router.post("/subscribe", pushSubscribeLimiter, validate(pushSubscribeSchema), async (req, res) => {
    const { tournamentId, subscription, chessUsername } = req.body as {
      tournamentId: string;
      subscription: PushSub;
      chessUsername?: string;
    };
    if (!tournamentId || !subscription?.endpoint) {
      return res.status(400).json({ error: "Missing tournamentId or subscription" });
    }
    try {
      const db = await getDb();
      const existing = await db
        .select({ id: pushSubscriptions.id })
        .from(pushSubscriptions)
        .where(and(eq(pushSubscriptions.tournamentId, tournamentId), eq(pushSubscriptions.endpoint, subscription.endpoint)));

      if (existing.length > 0) {
        await db
          .update(pushSubscriptions)
          .set({
            p256dh: subscription.keys.p256dh,
            auth: subscription.keys.auth,
            ...(chessUsername ? { chessUsername: chessUsername.toLowerCase() } : {}),
          })
          .where(eq(pushSubscriptions.id, existing[0].id));
      } else {
        await db.insert(pushSubscriptions).values({
          id: nanoid(),
          tournamentId,
          endpoint: subscription.endpoint,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
          ...(chessUsername ? { chessUsername: chessUsername.toLowerCase() } : {}),
        });
      }

      const countRows = await db
        .select({ id: pushSubscriptions.id })
        .from(pushSubscriptions)
        .where(eq(pushSubscriptions.tournamentId, tournamentId));
      res.json({ ok: true, count: countRows.length });
    } catch (err) {
      logger.error("[push] subscribe error:", err);
      res.status(500).json({ error: "Database error" });
    }
  });

  // DELETE /subscribe
  router.delete("/subscribe", async (req, res) => {
    const { tournamentId, subscription } = req.body as { tournamentId: string; subscription: PushSub };
    if (!tournamentId || !subscription?.endpoint) {
      return res.status(400).json({ error: "Missing tournamentId or subscription" });
    }
    try {
      const db = await getDb();
      await db
        .delete(pushSubscriptions)
        .where(and(eq(pushSubscriptions.tournamentId, tournamentId), eq(pushSubscriptions.endpoint, subscription.endpoint)));
      const countRows = await db
        .select({ id: pushSubscriptions.id })
        .from(pushSubscriptions)
        .where(eq(pushSubscriptions.tournamentId, tournamentId));
      res.json({ ok: true, count: countRows.length });
    } catch (err) {
      logger.error("[push] unsubscribe error:", err);
      res.status(500).json({ error: "Database error" });
    }
  });

  // POST /notify/:tournamentId — round pairings ready
  router.post("/notify/:tournamentId", validate(pushNotifySchema), async (req, res) => {
    const { tournamentId } = req.params;
    const { round, tournamentName } = req.body as { round: number; tournamentName: string };
    if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
      return res.status(503).json({ error: "Push notifications not configured" });
    }
    try {
      const result = await broadcastPush(tournamentId, () =>
        JSON.stringify({
          title: `Round ${round} Pairings Ready`,
          body: `${tournamentName} — Check your board assignment now.`,
          icon: PUSH_ICON, badge: PUSH_BADGE,
          tag: `otb-round-${tournamentId}-${round}`,
          url: `/tournament/${tournamentId}`,
        }), `Round ${round}`);
      res.json(result);
    } catch (err) {
      logger.error("[push] notify error:", err);
      res.status(500).json({ error: "Database error" });
    }
  });

  // POST /notify/:tournamentId/results
  router.post("/notify/:tournamentId/results", async (req, res) => {
    const { tournamentId } = req.params;
    const { round, tournamentName } = req.body as { round: number; tournamentName: string };
    if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
      return res.status(503).json({ error: "Push notifications not configured" });
    }
    try {
      const result = await broadcastPush(tournamentId, () =>
        JSON.stringify({
          title: `Round ${round} Results Posted`,
          body: `${tournamentName} — All results are in. Check the standings now.`,
          icon: PUSH_ICON, badge: PUSH_BADGE,
          tag: `otb-results-${tournamentId}-${round}`,
          url: `/tournament/${tournamentId}`,
        }), `Round ${round} results`);
      res.json(result);
    } catch (err) {
      logger.error("[push] results notify error:", err);
      res.status(500).json({ error: "Database error" });
    }
  });

  // POST /notify/:tournamentId/timer-warning
  router.post("/notify/:tournamentId/timer-warning", async (req, res) => {
    const { tournamentId } = req.params;
    const { round, tournamentName, minutesLeft = 5 } = req.body as { round: number; tournamentName: string; minutesLeft?: number };
    if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
      return res.status(503).json({ error: "Push notifications not configured" });
    }
    try {
      const result = await broadcastPush(tournamentId, () =>
        JSON.stringify({
          title: `⏰ ${minutesLeft} Minutes Left — Round ${round}`,
          body: `${tournamentName} — Finish your game before time runs out!`,
          icon: PUSH_ICON, badge: PUSH_BADGE,
          tag: `otb-timer-warning-${tournamentId}-${round}`,
          url: `/tournament/${tournamentId}`,
        }), `Timer warning R${round}`);
      res.json(result);
    } catch (err) {
      logger.error("[push] timer-warning error:", err);
      res.status(500).json({ error: "Database error" });
    }
  });

  // POST /notify/:tournamentId/bracket-live
  router.post("/notify/:tournamentId/bracket-live", async (req, res) => {
    const { tournamentId } = req.params;
    const { tournamentName, cutoff } = req.body as { tournamentName: string; cutoff: number };
    if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
      return res.status(503).json({ error: "Push notifications not configured" });
    }
    try {
      const result = await broadcastPush(tournamentId, () =>
        JSON.stringify({
          title: `🏆 Elimination Bracket is Live!`,
          body: `${tournamentName} — Top ${cutoff} players are seeded. Check your matchup now!`,
          icon: PUSH_ICON, badge: PUSH_BADGE,
          tag: `otb-bracket-live-${tournamentId}`,
          url: `/tournament/${tournamentId}?tab=bracket`,
        }), "Bracket-live");
      res.json(result);
    } catch (err) {
      logger.error("[push] bracket-live error:", err);
      res.status(500).json({ error: "Database error" });
    }
  });

  // POST /notify/:tournamentId/tournament-complete
  router.post("/notify/:tournamentId/tournament-complete", async (req, res) => {
    const { tournamentId } = req.params;
    const { tournamentName, championName, standings } = req.body as {
      tournamentName: string;
      championName: string;
      standings: { username: string; rank: number; points: number }[];
    };
    if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
      return res.status(503).json({ error: "Push notifications not configured" });
    }

    const rankMap = new Map<string, { rank: number; points: number }>();
    if (Array.isArray(standings)) {
      for (const entry of standings) {
        if (entry.username) rankMap.set(entry.username.toLowerCase(), { rank: entry.rank, points: entry.points });
      }
    }
    function ordinal(n: number): string {
      const s = ["th", "st", "nd", "rd"];
      const v = n % 100;
      return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
    }

    try {
      const result = await broadcastPush(tournamentId, (row) => {
        let title = `🏆 Tournament Complete!`;
        let body: string;
        const username = row.chessUsername?.toLowerCase();
        const playerEntry = username ? rankMap.get(username) : undefined;
        if (playerEntry) {
          if (playerEntry.rank === 1) {
            title = `🏆 You Won ${tournamentName}!`;
            body = `Congratulations! You finished 1st with ${playerEntry.points} pts. View your champion card!`;
          } else {
            body = `You finished ${ordinal(playerEntry.rank)} with ${playerEntry.points} pts. Champion: ${championName}. View the results!`;
          }
        } else {
          body = `${tournamentName} — Congratulations to ${championName}, our champion! View the final results.`;
        }
        return JSON.stringify({
          title, body,
          icon: PUSH_ICON, badge: PUSH_BADGE,
          tag: `otb-tournament-complete-${tournamentId}`,
          url: `/tournament/${tournamentId}/results`,
        });
      }, "Tournament-complete");
      res.json(result);
    } catch (err) {
      logger.error("[push] tournament-complete error:", err);
      res.status(500).json({ error: "Database error" });
    }
  });

  return router;
}
