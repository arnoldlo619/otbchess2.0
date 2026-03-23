import express from "express";
import cookieParser from "cookie-parser";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import webpush from "web-push";
import { nanoid } from "nanoid";
import { eq, and, or, inArray, desc } from "drizzle-orm";
import { rateLimit } from "express-rate-limit";
import { getDb } from "./db.js";
import { createAuthRouter, requireAuth, requireFullAuth } from "./auth.js";
import { pushSubscriptions, tournamentPlayers, tournamentState } from "../shared/schema.js";
import { createRecordingsRouter } from "./recordings.js";
import clubMessagingRouter from "./clubMessaging.js";
import clubInvitesRouter, { createInviteRouter } from "./clubInvites.js";
import clubBattlesRouter from "./clubBattles.js";
import { startCvJobQueue as _startCvJobQueue } from "./cvJobQueue.js";
export { _startCvJobQueue as startCvJobQueue };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── VAPID Configuration ──────────────────────────────────────────────────────
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY ?? "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? "mailto:hello@otbchess.app";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

type PushSub = webpush.PushSubscription;

// ─── SSE Subscriber Registry ─────────────────────────────────────────────────
// Maps tournamentId → Set of active SSE response objects.
// When a player registers, we fan-out a "player_joined" event to all connected
// director tabs watching that tournament.
const sseSubscribers = new Map<string, Set<import("http").ServerResponse>>();

// ─── In-Memory Timer Store ────────────────────────────────────────────────────
// Holds the latest timer snapshot per tournament so players who reconnect
// can catch up without waiting for the next broadcast.
interface TimerSnapshot {
  status: "idle" | "running" | "paused" | "expired";
  durationSec: number;
  startWallMs: number;
  elapsedAtPauseMs: number;
  savedAt: number;
}
const timerStore = new Map<string, TimerSnapshot>();
// Tracks pending setTimeout handles so we can cancel them on pause/reset.
const timerExpiryTimeouts = new Map<string, ReturnType<typeof setTimeout>>();
// Tracks pending 5-minute warning setTimeout handles.
const timerWarningTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

// Sends a "Time's up!" Web Push to all subscribed players for a tournament.
async function sendTimerExpiryPush(tournamentId: string) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return;
  try {
    const db = await getDb();
    const rows = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.tournamentId, tournamentId));
    if (rows.length === 0) return;
    // Look up the tournament name from the stored state for a friendlier message.
    const stateRows = await db
      .select()
      .from(tournamentState)
      .where(eq(tournamentState.tournamentId, tournamentId))
      .limit(1);
    const stateParsed = stateRows[0]?.stateJson ? JSON.parse(stateRows[0].stateJson) as Record<string, unknown> : null;
    const tournamentName = (stateParsed?.tournamentName as string) ?? "Your tournament";
    const currentRound = (stateParsed?.currentRound as number) ?? 1;
    const payload = JSON.stringify({
      title: `⏰ Time's Up — Round ${currentRound}`,
      body: `${tournamentName} — Report your result to the director at the registration table.`,
      icon: "https://files.manuscdn.com/user_upload_by_module/session_file/117675823/iqZHgEQGHFmYeOzw.png",
      badge: "https://files.manuscdn.com/user_upload_by_module/session_file/117675823/sffLnKtDRYocchPn.png",
      tag: `otb-timer-expired-${tournamentId}-${currentRound}`,
      url: `/tournament/${tournamentId}`,
    });
    const staleIds: string[] = [];
    await Promise.allSettled(
      rows.map(async (row) => {
        const sub: PushSub = {
          endpoint: row.endpoint,
          keys: { p256dh: row.p256dh, auth: row.auth },
        };
        try {
          await webpush.sendNotification(sub, payload);
        } catch (err: unknown) {
          if (err && typeof err === "object" && "statusCode" in err) {
            const code = (err as { statusCode: number }).statusCode;
            if (code === 410 || code === 404) staleIds.push(row.id);
          }
          console.warn("[push] Timer expiry push failed:", err);
        }
      })
    );
    // Clean up stale subscriptions.
    if (staleIds.length > 0) {
      await db
        .delete(pushSubscriptions)
        .where(inArray(pushSubscriptions.id, staleIds));
    }
    console.log(`[push] Timer expiry push sent to ${rows.length} subscriber(s) for ${tournamentId}`);
  } catch (err) {
    console.error("[push] Timer expiry push error:", err);
  }
}

function broadcastTimerUpdate(tournamentId: string, snap: TimerSnapshot) {
  const subs = sseSubscribers.get(tournamentId);
  if (!subs || subs.size === 0) return;
  const payload = `event: timer_update\ndata: ${JSON.stringify(snap)}\n\n`;
  for (const res of Array.from(subs)) {
    try { res.write(payload); } catch { /* disconnected */ }
  }
  console.log(`[sse] Broadcast timer_update (${snap.status}) to ${subs.size} subscriber(s) for ${tournamentId}`);
}

function broadcastPlayerJoined(tournamentId: string, player: Record<string, unknown>) {
  const subs = sseSubscribers.get(tournamentId);
  if (!subs || subs.size === 0) return;
  const payload = `event: player_joined\ndata: ${JSON.stringify(player)}\n\n`;
  for (const res of Array.from(subs)) {
    try { res.write(payload); } catch { /* client already disconnected */ }
  }
  console.log(`[sse] Broadcast player_joined to ${subs.size} subscriber(s) for ${tournamentId}`);
}

// Broadcast tournament_started to all SSE subscribers (directors + players watching).
// Payload includes the full Round 1 pairings and player list so players can find their board.
function broadcastTournamentStarted(
  tournamentId: string,
  payload: { round: number; games: unknown[]; players: unknown[] }
) {
  const subs = sseSubscribers.get(tournamentId);
  if (!subs || subs.size === 0) return;
  const data = `event: tournament_started\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const res of Array.from(subs)) {
    try { res.write(data); } catch { /* client already disconnected */ }
  }
  console.log(`[sse] Broadcast tournament_started to ${subs.size} subscriber(s) for ${tournamentId}`);
}

// ─── Chess.com & Lichess proxy ────────────────────────────────────────────────
async function proxyChessCom(username: string): Promise<{ status: number; body: unknown }> {
  const key = username.toLowerCase().trim();
  const base = "https://api.chess.com/pub/player";
  const headers = {
    "User-Agent": "OTBChess/1.0 (https://chessotb.club; tournament management app)",
    "Accept": "application/json",
  };

  const [profileRes, statsRes] = await Promise.all([
    fetch(`${base}/${key}`, { headers }),
    fetch(`${base}/${key}/stats`, { headers }),
  ]);

  if (profileRes.status === 404) {
    return { status: 404, body: { error: "not_found" } };
  }
  if (!profileRes.ok) {
    return { status: profileRes.status, body: { error: `chess.com returned ${profileRes.status}` } };
  }

  const [profileData, statsData] = await Promise.all([
    profileRes.json() as Promise<Record<string, unknown>>,
    statsRes.ok ? (statsRes.json() as Promise<Record<string, unknown>>) : Promise.resolve({}),
  ]);

  return { status: 200, body: { profile: profileData, stats: statsData } };
}

async function proxyLichess(username: string): Promise<{ status: number; body: unknown }> {
  const key = username.toLowerCase().trim();
  const headers = {
    "User-Agent": "OTBChess/1.0 (https://chessotb.club; tournament management app)",
    "Accept": "application/json",
  };

  const res = await fetch(`https://lichess.org/api/user/${key}`, { headers });

  if (res.status === 404) {
    return { status: 404, body: { error: "not_found" } };
  }
  if (!res.ok) {
    return { status: res.status, body: { error: `lichess returned ${res.status}` } };
  }

  const data = await res.json();
  return { status: 200, body: data };
}

// ─── Build the Express app (exported for Vite dev middleware) ─────────────────
// ─── Rate Limiters ──────────────────────────────────────────────────────────
// Chess.com / Lichess proxy: 20 lookups per minute per IP (generous for tournament use)
const chessProxyLimiter = rateLimit({
  windowMs: 60_000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests — please wait a moment." },
  skip: () => process.env.NODE_ENV !== "production",
});

// Push subscribe: 30 per minute per IP (players subscribe once per tournament)
const pushSubscribeLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests — please wait a moment." },
  skip: () => process.env.NODE_ENV !== "production",
});

export function createApp() {
  const app = express();

  // ── Body size cap — prevents large-payload DoS on state/player endpoints ────
  app.use(express.json({ limit: "512kb" }));
  app.use(cookieParser());

  // ── Security headers ────────────────────────────────────────────────────────
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    next();
  });

  // ── Auth routes ─────────────────────────────────────────────────────────────
  app.use("/api/auth", createAuthRouter());

  // ── Proxy: GET /api/chess/player/:username ──────────────────────────────────
  // IMPORTANT: These must be registered BEFORE the recordings router, which
  // applies requireAuth to all routes and would otherwise intercept these
  // public proxy endpoints.
  app.get("/api/chess/player/:username", chessProxyLimiter, async (req, res) => {
    try {
      const { status, body } = await proxyChessCom(req.params.username);
      res.status(status).json(body);
    } catch (err) {
      console.error("[chess proxy]", err);
      res.status(502).json({ error: "Could not reach chess.com" });
    }
  });

  // ── Proxy: GET /api/avatar-proxy?url=... ─────────────────────────────────────
  // Fetches a remote avatar image (chess.com, lichess, etc.) server-side and
  // re-serves it with permissive CORS headers so html2canvas can draw it onto
  // a canvas without triggering the "tainted canvas" security error.
  app.get("/api/avatar-proxy", async (req, res) => {
    const raw = req.query.url as string | undefined;
    if (!raw) { res.status(400).json({ error: "Missing url parameter" }); return; }

    let targetUrl: string;
    try {
      const parsed = new URL(raw);
      // Only allow well-known chess avatar CDNs to prevent open-proxy abuse
      const allowed = ["images.chess.com", "www.chess.com", "lichess.org", "lichess1.org"];
      if (!allowed.some((h) => parsed.hostname === h || parsed.hostname.endsWith("." + h))) {
        res.status(403).json({ error: "Domain not allowed" }); return;
      }
      targetUrl = parsed.toString();
    } catch {
      res.status(400).json({ error: "Invalid url" }); return;
    }

    try {
      const upstream = await fetch(targetUrl, {
        headers: { "User-Agent": "OTBChess/1.0 (avatar proxy)" },
        signal: AbortSignal.timeout(8000),
      });
      if (!upstream.ok) { res.status(upstream.status).end(); return; }

      const contentType = upstream.headers.get("content-type") ?? "image/jpeg";
      const buffer = await upstream.arrayBuffer();

      res.setHeader("Content-Type", contentType);
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Cache-Control", "public, max-age=86400"); // 24 h browser cache
      res.send(Buffer.from(buffer));
    } catch (err) {
      console.error("[avatar-proxy]", err);
      res.status(502).end();
    }
  });

  // ── Proxy: GET /api/lichess/player/:username ────────────────────────────────
  app.get("/api/lichess/player/:username", chessProxyLimiter, async (req, res) => {
    try {
      const { status, body } = await proxyLichess(req.params.username);
      res.status(status).json(body);
    } catch (err) {
      console.error("[lichess proxy]", err);
      res.status(502).json({ error: "Could not reach lichess.org" });
    }
  });

  // ── Game Recorder routes ───────────────────────────────────────────────────
  // Mount at /api/recordings for session routes and /api/games for game routes.
  // Using two explicit mounts instead of a broad /api mount prevents the
  // requireAuth middleware inside the router from intercepting unrelated routes
  // like /api/chess/* and /api/lichess/*.
  app.use("/api/recordings", createRecordingsRouter());
  app.use("/api/games", createRecordingsRouter());

  // ── Club Messaging (DMs + turn-based chess) ───────────────────────────────
  app.use("/api/clubs/:clubId/conversations", clubMessagingRouter);
  app.use("/api/clubs/:clubId/invites", clubInvitesRouter);
  app.use("/api/clubs/:clubId/battles", clubBattlesRouter);
  app.use("/api/invite", createInviteRouter());

  // ── Push: GET /api/push/vapid-public-key ───────────────────────────────────
  // Returns the VAPID public key so the client can subscribe.
  app.get("/api/push/vapid-public-key", (_req, res) => {
    if (!VAPID_PUBLIC_KEY) {
      return res.status(503).json({ error: "Push notifications not configured" });
    }
    res.json({ publicKey: VAPID_PUBLIC_KEY });
  });

  // ── Push: GET /api/push/count/:tournamentId ────────────────────────────────
  // Returns the number of active subscribers for a tournament.
  app.get("/api/push/count/:tournamentId", async (req, res) => {
    try {
      const db = await getDb();
      const rows = await db
        .select({ id: pushSubscriptions.id })
        .from(pushSubscriptions)
        .where(eq(pushSubscriptions.tournamentId, req.params.tournamentId));
      res.json({ count: rows.length });
    } catch (err) {
      console.error("[push] count error:", err);
      res.status(500).json({ error: "Database error" });
    }
  });

  // ── Push: POST /api/push/subscribe ────────────────────────────────────────
  // Body: { tournamentId: string, subscription: PushSubscription }
  // Upserts by endpoint — if the same endpoint re-subscribes it updates keys.
  app.post("/api/push/subscribe", pushSubscribeLimiter, async (req, res) => {
    const { tournamentId, subscription } = req.body as {
      tournamentId: string;
      subscription: PushSub;
    };

    if (!tournamentId || !subscription?.endpoint) {
      return res.status(400).json({ error: "Missing tournamentId or subscription" });
    }

    try {
      const db = await getDb();

      // Check if this endpoint already exists for this tournament
      const existing = await db
        .select({ id: pushSubscriptions.id })
        .from(pushSubscriptions)
        .where(
          and(
            eq(pushSubscriptions.tournamentId, tournamentId),
            eq(pushSubscriptions.endpoint, subscription.endpoint)
          )
        );

      if (existing.length > 0) {
        // Update the keys in case they changed (browser re-subscribed)
        await db
          .update(pushSubscriptions)
          .set({
            p256dh: subscription.keys.p256dh,
            auth: subscription.keys.auth,
          })
          .where(eq(pushSubscriptions.id, existing[0].id));
        console.log(`[push] Updated subscription for tournament ${tournamentId}`);
      } else {
        // Insert new subscription
        await db.insert(pushSubscriptions).values({
          id: nanoid(),
          tournamentId,
          endpoint: subscription.endpoint,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
        });
        console.log(`[push] New subscription for tournament ${tournamentId}`);
      }

      // Return total count for this tournament
      const countRows = await db
        .select({ id: pushSubscriptions.id })
        .from(pushSubscriptions)
        .where(eq(pushSubscriptions.tournamentId, tournamentId));

      res.json({ ok: true, count: countRows.length });
    } catch (err) {
      console.error("[push] subscribe error:", err);
      res.status(500).json({ error: "Database error" });
    }
  });

  // ── Push: DELETE /api/push/subscribe ──────────────────────────────────────
  // Body: { tournamentId: string, subscription: PushSubscription }
  app.delete("/api/push/subscribe", async (req, res) => {
    const { tournamentId, subscription } = req.body as {
      tournamentId: string;
      subscription: PushSub;
    };

    if (!tournamentId || !subscription?.endpoint) {
      return res.status(400).json({ error: "Missing tournamentId or subscription" });
    }

    try {
      const db = await getDb();

      await db
        .delete(pushSubscriptions)
        .where(
          and(
            eq(pushSubscriptions.tournamentId, tournamentId),
            eq(pushSubscriptions.endpoint, subscription.endpoint)
          )
        );

      const countRows = await db
        .select({ id: pushSubscriptions.id })
        .from(pushSubscriptions)
        .where(eq(pushSubscriptions.tournamentId, tournamentId));

      console.log(`[push] Unsubscribed from tournament ${tournamentId} (${countRows.length} remaining)`);
      res.json({ ok: true, count: countRows.length });
    } catch (err) {
      console.error("[push] unsubscribe error:", err);
      res.status(500).json({ error: "Database error" });
    }
  });

  // ── Push: POST /api/push/notify/:tournamentId ──────────────────────────────
  // Broadcasts a push notification to all subscribers of a tournament.
  // Body: { round: number, tournamentName: string }
  app.post("/api/push/notify/:tournamentId", async (req, res) => {
    const { tournamentId } = req.params;
    const { round, tournamentName } = req.body as {
      round: number;
      tournamentName: string;
    };

    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      return res.status(503).json({ error: "Push notifications not configured" });
    }

    try {
      const db = await getDb();

      // Load all subscriptions for this tournament from the database
      const rows = await db
        .select()
        .from(pushSubscriptions)
        .where(eq(pushSubscriptions.tournamentId, tournamentId));

      if (rows.length === 0) {
        return res.json({ ok: true, sent: 0, failed: 0 });
      }

      const payload = JSON.stringify({
        title: `Round ${round} Pairings Ready`,
        body: `${tournamentName} — Check your board assignment now.`,
        icon: "https://files.manuscdn.com/user_upload_by_module/session_file/117675823/iqZHgEQGHFmYeOzw.png",
        badge: "https://files.manuscdn.com/user_upload_by_module/session_file/117675823/sffLnKtDRYocchPn.png",
        tag: `otb-round-${tournamentId}-${round}`,
        url: `/tournament/${tournamentId}`,
      });

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
            await webpush.sendNotification(sub, payload);
            sent++;
          } catch (err: unknown) {
            failed++;
            if (err && typeof err === "object" && "statusCode" in err) {
              const code = (err as { statusCode: number }).statusCode;
              if (code === 410 || code === 404) {
                staleIds.push(row.id);
              }
            }
            console.warn("[push] Failed to send notification:", err);
          }
        })
      );

      if (staleIds.length > 0) {
        await Promise.all(
          staleIds.map((id) =>
            db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, id))
          )
        );
        console.log(`[push] Removed ${staleIds.length} stale subscription(s)`);
      }

      console.log(`[push] Round ${round} notification for ${tournamentId}: ${sent} sent, ${failed} failed`);
      res.json({ ok: true, sent, failed });
    } catch (err) {
      console.error("[push] notify error:", err);
      res.status(500).json({ error: "Database error" });
    }
  });

  // ── Push: POST /api/push/notify/:tournamentId/results ────────────────────
  // Broadcasts a push notification when all results for a round are posted.
  // Body: { round: number, tournamentName: string }
  app.post("/api/push/notify/:tournamentId/results", async (req, res) => {
    const { tournamentId } = req.params;
    const { round, tournamentName } = req.body as {
      round: number;
      tournamentName: string;
    };

    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      return res.status(503).json({ error: "Push notifications not configured" });
    }

    try {
      const db = await getDb();

      const rows = await db
        .select()
        .from(pushSubscriptions)
        .where(eq(pushSubscriptions.tournamentId, tournamentId));

      if (rows.length === 0) {
        return res.json({ ok: true, sent: 0, failed: 0 });
      }

      const payload = JSON.stringify({
        title: `Round ${round} Results Posted`,
        body: `${tournamentName} — All results are in. Check the standings now.`,
        icon: "https://files.manuscdn.com/user_upload_by_module/session_file/117675823/iqZHgEQGHFmYeOzw.png",
        badge: "https://files.manuscdn.com/user_upload_by_module/session_file/117675823/sffLnKtDRYocchPn.png",
        tag: `otb-results-${tournamentId}-${round}`,
        url: `/tournament/${tournamentId}`,
      });

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
            await webpush.sendNotification(sub, payload);
            sent++;
          } catch (err: unknown) {
            failed++;
            if (err && typeof err === "object" && "statusCode" in err) {
              const code = (err as { statusCode: number }).statusCode;
              if (code === 410 || code === 404) {
                staleIds.push(row.id);
              }
            }
            console.warn("[push] Failed to send results notification:", err);
          }
        })
      );

      if (staleIds.length > 0) {
        await Promise.all(
          staleIds.map((id) =>
            db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, id))
          )
        );
        console.log(`[push] Removed ${staleIds.length} stale subscription(s)`);
      }

      console.log(`[push] Round ${round} results notification for ${tournamentId}: ${sent} sent, ${failed} failed`);
      res.json({ ok: true, sent, failed });
    } catch (err) {
      console.error("[push] results notify error:", err);
      res.status(500).json({ error: "Database error" });
    }
  });

  // ── Push: POST /api/push/notify/:tournamentId/timer-warning ────────────────────
  // Broadcasts a "5 minutes remaining" push notification to all subscribers.
  // Body: { round: number, tournamentName: string, minutesLeft?: number }
  app.post("/api/push/notify/:tournamentId/timer-warning", async (req, res) => {
    const { tournamentId } = req.params;
    const { round, tournamentName, minutesLeft = 5 } = req.body as {
      round: number;
      tournamentName: string;
      minutesLeft?: number;
    };

    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      return res.status(503).json({ error: "Push notifications not configured" });
    }

    try {
      const db = await getDb();

      const rows = await db
        .select()
        .from(pushSubscriptions)
        .where(eq(pushSubscriptions.tournamentId, tournamentId));

      if (rows.length === 0) {
        return res.json({ ok: true, sent: 0, failed: 0 });
      }

      const payload = JSON.stringify({
        title: `⏰ ${minutesLeft} Minutes Left — Round ${round}`,
        body: `${tournamentName} — Finish your game before time runs out!`,
        icon: "https://files.manuscdn.com/user_upload_by_module/session_file/117675823/iqZHgEQGHFmYeOzw.png",
        badge: "https://files.manuscdn.com/user_upload_by_module/session_file/117675823/sffLnKtDRYocchPn.png",
        tag: `otb-timer-warning-${tournamentId}-${round}`,
        url: `/tournament/${tournamentId}`,
      });

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
            await webpush.sendNotification(sub, payload);
            sent++;
          } catch (err: unknown) {
            failed++;
            if (err && typeof err === "object" && "statusCode" in err) {
              const code = (err as { statusCode: number }).statusCode;
              if (code === 410 || code === 404) {
                staleIds.push(row.id);
              }
            }
            console.warn("[push] Failed to send timer-warning notification:", err);
          }
        })
      );

      if (staleIds.length > 0) {
        await Promise.all(
          staleIds.map((id) =>
            db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, id))
          )
        );
        console.log(`[push] Removed ${staleIds.length} stale subscription(s)`);
      }

      console.log(`[push] Timer warning for ${tournamentId} R${round}: ${sent} sent, ${failed} failed`);
      res.json({ ok: true, sent, failed });
    } catch (err) {
      console.error("[push] timer-warning error:", err);
      res.status(500).json({ error: "Database error" });
    }
  });

  // ── Tournament Players: GET /api/tournament/:id/players ─────────────────────
  // Returns all registered players for a tournament (polled by Director dashboard).
  app.get("/api/tournament/:id/players", async (req, res) => {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: "Missing tournament id" });
    try {
      const db = await getDb();
      const rows = await db
        .select()
        .from(tournamentPlayers)
        .where(eq(tournamentPlayers.tournamentId, id))
        .orderBy(tournamentPlayers.joinedAt);
      const players = rows.map((r) => JSON.parse(r.playerJson));
      res.json({ players, count: players.length });
    } catch (err) {
      console.error("[players] GET error:", err);
      res.status(500).json({ error: "Database error" });
    }
  });

  // ── Tournament Players: POST /api/tournament/:id/players ─────────────────────
  // Upserts a player registration (insert or update by username).
  // Body: { player: Player }  (the full Player object from the client)
  app.post("/api/tournament/:id/players", async (req, res) => {
    const { id } = req.params;
    const { player } = req.body as { player: Record<string, unknown> };
    if (!id || !player || typeof player.username !== "string") {
      return res.status(400).json({ error: "Missing tournament id or player.username" });
    }
    const username = (player.username as string).toLowerCase().trim();
    try {
      const db = await getDb();
      // Check if this player already exists for this tournament
      const existing = await db
        .select({ id: tournamentPlayers.id })
        .from(tournamentPlayers)
        .where(
          and(
            eq(tournamentPlayers.tournamentId, id),
            eq(tournamentPlayers.username, username)
          )
        );
      if (existing.length > 0) {
        // Update the player JSON (ELO may have changed)
        await db
          .update(tournamentPlayers)
          .set({ playerJson: JSON.stringify(player) })
          .where(
            and(
              eq(tournamentPlayers.tournamentId, id),
              eq(tournamentPlayers.username, username)
            )
          );
        console.log(`[players] Updated player ${username} in tournament ${id}`);
      } else {
        // Insert new registration
        await db.insert(tournamentPlayers).values({
          id: nanoid(),
          tournamentId: id,
          username,
          playerJson: JSON.stringify(player),
        });
        console.log(`[players] Registered player ${username} in tournament ${id}`);
      }
      // Broadcast the new/updated player to all connected SSE director clients
      broadcastPlayerJoined(id, player);
      res.json({ ok: true, username });
    } catch (err) {
      console.error("[players] POST error:", err);
      res.status(500).json({ error: "Database error" });
    }
  });

  // ── Tournament Players: GET /api/tournament/:id/players/stream ──────────────
  // SSE stream — director subscribes once; server pushes "player_joined" events
  // whenever a new player registers via POST /api/tournament/:id/players.
  // Sends a keepalive comment every 25s to prevent proxy/load-balancer timeouts.
  app.get("/api/tournament/:id/players/stream", (req, res) => {
    const { id } = req.params;
    if (!id) { res.status(400).end(); return; }

    // SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // disable nginx buffering
    res.flushHeaders();

    // Register this response as a subscriber
    if (!sseSubscribers.has(id)) sseSubscribers.set(id, new Set());
    const subs = sseSubscribers.get(id)!;
    subs.add(res);
    console.log(`[sse] Director subscribed to tournament ${id} (${subs.size} active)`);

    // Send an initial comment so the browser knows the stream is open
    res.write(`: connected\n\n`);

    // Keepalive ping every 25 seconds
    const keepalive = setInterval(() => {
      try { res.write(`: keepalive\n\n`); } catch { clearInterval(keepalive); }
    }, 25_000);

    // Clean up on disconnect
    req.on("close", () => {
      clearInterval(keepalive);
      subs.delete(res);
      if (subs.size === 0) sseSubscribers.delete(id);
      console.log(`[sse] Director disconnected from tournament ${id} (${subs.size} remaining)`);
    });
  });

  // ── Tournament State: GET /api/tournament/:id/state ────────────────────────
  // Returns the persisted director state JSON for a tournament.
  // Returns 404 when no state has been saved yet (fresh tournament).
  app.get("/api/tournament/:id/state", async (req, res) => {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: "Missing tournament id" });
    // Never serve state for the demo tournament
    if (id === "otb-demo-2026") return res.status(404).json({ error: "demo" });
    try {
      const db = await getDb();
      const rows = await db
        .select()
        .from(tournamentState)
        .where(eq(tournamentState.tournamentId, id));
      if (rows.length === 0) return res.status(404).json({ error: "not_found" });
      res.json({ state: JSON.parse(rows[0].stateJson), updatedAt: rows[0].updatedAt });
    } catch (err) {
      console.error("[state] GET error:", err);
      res.status(500).json({ error: "Database error" });
    }
  });

  // ── Tournament State: PUT /api/tournament/:id/state ─────────────────────────
  // Upserts the full director state JSON for a tournament.
  // Body: { state: DirectorState }
  app.put("/api/tournament/:id/state", async (req, res) => {
    const { id } = req.params;
    const { state } = req.body as { state: unknown };
    if (!id || !state) return res.status(400).json({ error: "Missing tournament id or state" });
    // Never persist the demo tournament
    if (id === "otb-demo-2026") return res.json({ ok: true, skipped: true });
    try {
      const db = await getDb();
      const stateJson = JSON.stringify(state);
      // Check if row exists
      const existing = await db
        .select({ tournamentId: tournamentState.tournamentId })
        .from(tournamentState)
        .where(eq(tournamentState.tournamentId, id));
      if (existing.length > 0) {
        await db
          .update(tournamentState)
          .set({ stateJson, updatedAt: new Date() })
          .where(eq(tournamentState.tournamentId, id));
      } else {
        await db.insert(tournamentState).values({ tournamentId: id, stateJson });
      }
      console.log(`[state] Saved state for tournament ${id} (${stateJson.length} bytes)`);
      // Broadcast standings_updated so players see live score changes immediately
      const parsedState = state as { players?: unknown[]; currentRound?: number; status?: string };
      const subs = sseSubscribers.get(id);
      if (subs && subs.size > 0) {
        const payload = `event: standings_updated\ndata: ${JSON.stringify({
          players: parsedState.players ?? [],
          currentRound: parsedState.currentRound ?? 0,
          status: parsedState.status ?? "in_progress",
        })}\n\n`;
        for (const sub of Array.from(subs)) {
          try { sub.write(payload); } catch { /* disconnected */ }
        }
      }
      res.json({ ok: true });
    } catch (err) {
      console.error("[state] PUT error:", err);
      res.status(500).json({ error: "Database error" });
    }
  });

  // ── Tournament: GET /api/tournament/:id/live-state ───────────────────────────────────────────────
  // Returns the freshest available state for players to catch up on reconnect.
  // Includes current round, games, players/standings, and tournament status.
  // Unlike /state (which has a 1.5s write debounce), this is always current.
  app.get("/api/tournament/:id/live-state", async (req, res) => {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: "Missing tournament id" });
    if (id === "otb-demo-2026") return res.status(404).json({ error: "demo" });
    try {
      const db = await getDb();
      const rows = await db
        .select()
        .from(tournamentState)
        .where(eq(tournamentState.tournamentId, id));
      if (rows.length === 0) return res.status(404).json({ error: "not_found" });
      const s = JSON.parse(rows[0].stateJson) as {
        status?: string;
        currentRound?: number;
        totalRounds?: number;
        tournamentName?: string;
        players?: unknown[];
        rounds?: Array<{ number: number; games: unknown[] }>;
      };
      // Return all rounds so fresh-device spectators get the full round history.
      // Also include current round's games separately for backwards compatibility.
      const currentRoundData = s.rounds?.find((r) => r.number === (s.currentRound ?? 0));
      res.json({
        status: s.status ?? "registration",
        currentRound: s.currentRound ?? 0,
        totalRounds: s.totalRounds ?? 0,
        tournamentName: s.tournamentName ?? "",
        players: s.players ?? [],
        games: currentRoundData?.games ?? [],
        rounds: s.rounds ?? [],
        updatedAt: rows[0].updatedAt,
      });
    } catch (err) {
      console.error("[live-state] GET error:", err);
      res.status(500).json({ error: "Database error" });
    }
  });

  // ── Timer: PUT /api/tournament/:id/timer ───────────────────────────────────────
  // Director pushes a timer snapshot; server stores it and broadcasts via SSE.
  // When status is "running", schedules a server-side setTimeout to fire a
  // Web Push "Time's up!" notification at the exact expiry wall-clock time.
  // Pausing or resetting cancels any pending timeout.
  app.put("/api/tournament/:id/timer", (req, res) => {
    const { id } = req.params;
    const snap = req.body as TimerSnapshot;
    if (!id || !snap || typeof snap.status !== "string") {
      return res.status(400).json({ error: "Missing id or invalid snapshot" });
    }
    timerStore.set(id, snap);
    broadcastTimerUpdate(id, snap);

    // Cancel any existing expiry and warning timeouts for this tournament.
    const existing = timerExpiryTimeouts.get(id);
    if (existing) {
      clearTimeout(existing);
      timerExpiryTimeouts.delete(id);
    }
    const existingWarning = timerWarningTimeouts.get(id);
    if (existingWarning) {
      clearTimeout(existingWarning);
      timerWarningTimeouts.delete(id);
    }

    // Schedule expiry and 5-minute warning pushes when the timer is running.
    if (snap.status === "running" && snap.startWallMs > 0 && snap.durationSec > 0) {
      const endWallMs = snap.startWallMs + snap.durationSec * 1000 - snap.elapsedAtPauseMs;
      const delayMs = endWallMs - Date.now();

      // Schedule expiry push.
      if (delayMs > 0) {
        const handle = setTimeout(async () => {
          timerExpiryTimeouts.delete(id);
          // Mark the stored snapshot as expired and broadcast.
          const current = timerStore.get(id);
          if (current && current.status === "running") {
            const expiredSnap: TimerSnapshot = { ...current, status: "expired" };
            timerStore.set(id, expiredSnap);
            broadcastTimerUpdate(id, expiredSnap);
          }
          await sendTimerExpiryPush(id);
        }, delayMs);
        timerExpiryTimeouts.set(id, handle);
        console.log(`[timer] Expiry push scheduled in ${Math.round(delayMs / 1000)}s for tournament ${id}`);
      } else {
        // Timer already expired (e.g. director refreshed after time ran out).
        console.log(`[timer] Timer already expired for ${id}, skipping push scheduling.`);
      }

      // Schedule 5-minute warning push (only if > 5 min remain).
      const WARNING_MS = 5 * 60 * 1000;
      const warningDelayMs = delayMs - WARNING_MS;
      if (warningDelayMs > 0 && VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
        const warnHandle = setTimeout(async () => {
          timerWarningTimeouts.delete(id);
          try {
            const db = await getDb();
            const rows = await db
              .select()
              .from(pushSubscriptions)
              .where(eq(pushSubscriptions.tournamentId, id));
            if (rows.length === 0) return;
            const stateRows = await db
              .select()
              .from(tournamentState)
              .where(eq(tournamentState.tournamentId, id))
              .limit(1);
            const stateParsed = stateRows[0]?.stateJson
              ? (JSON.parse(stateRows[0].stateJson) as Record<string, unknown>)
              : null;
            const tournamentName = (stateParsed?.tournamentName as string) ?? "Your tournament";
            const currentRound = (stateParsed?.currentRound as number) ?? 1;
            const payload = JSON.stringify({
              title: `⏰ 5 Minutes Left — Round ${currentRound}`,
              body: `${tournamentName} — Finish your game before time runs out!`,
              icon: "https://files.manuscdn.com/user_upload_by_module/session_file/117675823/iqZHgEQGHFmYeOzw.png",
              badge: "https://files.manuscdn.com/user_upload_by_module/session_file/117675823/sffLnKtDRYocchPn.png",
              tag: `otb-timer-warning-${id}-${currentRound}`,
              url: `/tournament/${id}`,
            });
            const staleIds: string[] = [];
            await Promise.allSettled(
              rows.map(async (row) => {
                const sub: PushSub = { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } };
                try {
                  await webpush.sendNotification(sub, payload);
                } catch (err: unknown) {
                  if (err && typeof err === "object" && "statusCode" in err) {
                    const code = (err as { statusCode: number }).statusCode;
                    if (code === 410 || code === 404) staleIds.push(row.id);
                  }
                }
              })
            );
            if (staleIds.length > 0) {
              await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.id, staleIds));
            }
            console.log(`[timer] 5-min warning push sent to ${rows.length} subscriber(s) for ${id}`);
          } catch (err) {
            console.error("[timer] 5-min warning push error:", err);
          }
        }, warningDelayMs);
        timerWarningTimeouts.set(id, warnHandle);
        console.log(`[timer] 5-min warning push scheduled in ${Math.round(warningDelayMs / 1000)}s for tournament ${id}`);
      }
    }

    res.json({ ok: true });
  });

  // ── Timer: GET /api/tournament/:id/timer ───────────────────────────────────────
  // Players fetch the latest timer snapshot on connect/reconnect.
  app.get("/api/tournament/:id/timer", (req, res) => {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: "Missing id" });
    const snap = timerStore.get(id);
    if (!snap) return res.status(404).json({ error: "no_timer" });
    res.json(snap);
  });

  // ── Tournament Players: DELETE /api/tournament/:id/players/:username ──────────
  // Removes a player registration (director removes a player).
  app.delete("/api/tournament/:id/players/:username", async (req, res) => {
    const { id, username } = req.params;
    if (!id || !username) return res.status(400).json({ error: "Missing params" });
    try {
      const db = await getDb();
      await db
        .delete(tournamentPlayers)
        .where(
          and(
            eq(tournamentPlayers.tournamentId, id),
            eq(tournamentPlayers.username, username.toLowerCase().trim())
          )
        );
      console.log(`[players] Removed player ${username} from tournament ${id}`);
      res.json({ ok: true });
    } catch (err) {
      console.error("[players] DELETE error:", err);
      res.status(500).json({ error: "Database error" });
    }
  });

  // ── Tournament: POST /api/tournament/:id/start ────────────────────────────
  // Called by the director when they click "Start Tournament".
  // Broadcasts a tournament_started SSE event to all connected player clients
  // so they can transition from the Lobby waiting screen to the My Board view.
  // Body: { round: number; games: Game[]; players: Player[] }
  app.post("/api/tournament/:id/start", (req, res) => {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: "Missing tournament id" });
    const { round, games, players } = req.body as {
      round: number;
      games: unknown[];
      players: unknown[];
    };
    if (!round || !games || !players) {
      return res.status(400).json({ error: "Missing round, games, or players" });
    }
    broadcastTournamentStarted(id, { round, games, players });
    console.log(`[start] Tournament ${id} started — Round ${round}, ${games.length} games, ${players.length} players`);
    res.json({ ok: true });
  });

  // ── Tournament: POST /api/tournament/:id/round ───────────────────────────────────────────────
  // Called by the director when they generate the next round's pairings.
  // Broadcasts a round_started SSE event to all connected player clients so
  // their My Board screens automatically refresh to the new board assignment.
  // Body: { round: number; games: Game[]; players: Player[] }
  app.post("/api/tournament/:id/round", (req, res) => {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: "Missing tournament id" });
    const { round, games, players } = req.body as {
      round: number;
      games: unknown[];
      players: unknown[];
    };
    if (!round || !games || !players) {
      return res.status(400).json({ error: "Missing round, games, or players" });
    }
    const subs = sseSubscribers.get(id);
    if (subs && subs.size > 0) {
      const data = `event: round_started\ndata: ${JSON.stringify({ round, games, players })}\n\n`;
      for (const sub of Array.from(subs)) {
        try { sub.write(data); } catch { /* disconnected */ }
      }
      console.log(`[round] Broadcast round_started (Round ${round}) to ${subs.size} subscriber(s) for ${id}`);
    }
    res.json({ ok: true });
  });

  // ── Tournament: POST /api/tournament/:id/end ─────────────────────────────
  // Called by the director when they end/complete the tournament.
  // Broadcasts a tournament_ended SSE event with the final sorted standings
  // so all connected player screens transition to the Tournament Complete view.
  // Body: { players: Player[]; tournamentName?: string }
  app.post("/api/tournament/:id/end", (req, res) => {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: "Missing tournament id" });
    const { players, tournamentName } = req.body as {
      players: unknown[];
      tournamentName?: string;
    };
    if (!players || !Array.isArray(players)) {
      return res.status(400).json({ error: "Missing players array" });
    }
    const subs = sseSubscribers.get(id);
    if (subs && subs.size > 0) {
      const data = `event: tournament_ended\ndata: ${JSON.stringify({ players, tournamentName: tournamentName ?? "Tournament" })}\n\n`;
      for (const sub of Array.from(subs)) {
        try { sub.write(data); } catch { /* disconnected */ }
      }
      console.log(`[sse] Broadcast tournament_ended to ${subs.size} subscriber(s) for ${id}`);
    }
    res.json({ ok: true });
  });

  // ─── Notation Race State Store ───────────────────────────────────────────────────────
// Maps battleCode → { host: RaceState, guest: RaceState }
// Lightweight in-memory store; auto-cleaned when battle completes.
interface RacePlayerState {
  moveIdx: number;      // how many moves completed
  wpm: number;         // last reported WPM
  finished: boolean;   // true when all moves typed
  updatedAt: number;   // Date.now() of last update
  openingIdx: number;  // which opening sequence (0-7) was chosen for this room
}
interface RaceRoomState {
  host: RacePlayerState | null;
  guest: RacePlayerState | null;
  openingIdx: number; // canonical opening for this room (set by first player to join)
}
const raceStore = new Map<string, RaceRoomState>();

function getRaceRoom(code: string): RaceRoomState {
  let room = raceStore.get(code);
  if (!room) {
    room = { host: null, guest: null, openingIdx: Math.floor(Math.random() * 8) };
    raceStore.set(code, room);
  }
  return room;
}

  // ─── Battle Rooms API ────────────────────────────────────────────────────────────────
  // POST /api/battles — Create a new battle room (requires full account, not guest)
  app.post("/api/battles", requireFullAuth, async (req, res) => {
    const { battleRooms } = await import("../shared/schema.js");
    const userId = (req as import("express").Request & { userId: string }).userId;
    if (!userId) return res.status(401).json({ error: "Authentication required" });
    try {
      const db = await getDb();
      // Generate a unique 6-char uppercase code
      let code: string;
      let attempts = 0;
      do {
        code = Math.random().toString(36).slice(2, 8).toUpperCase();
        const existing = await db.select({ id: battleRooms.id }).from(battleRooms).where(eq(battleRooms.code, code)).limit(1);
        if (existing.length === 0) break;
        attempts++;
      } while (attempts < 10);
      const id = nanoid();
      await db.insert(battleRooms).values({
        id,
        code: code!,
        hostId: userId,
        status: "waiting",
      });
      res.status(201).json({ id, code: code! });
    } catch (err) {
      console.error("[battles] create error:", err);
      res.status(500).json({ error: "Failed to create battle room" });
    }
  });

  // GET /api/battles/:code — Get battle room by code (public)
  app.get("/api/battles/:code", async (req, res) => {
    const { battleRooms } = await import("../shared/schema.js");
    const { users } = await import("../shared/schema.js");
    try {
      const db = await getDb();
      const rows = await db.select().from(battleRooms).where(eq(battleRooms.code, req.params.code.toUpperCase())).limit(1);
      if (rows.length === 0) return res.status(404).json({ error: "Battle room not found" });
      const room = rows[0];

      // Helper: if avatarUrl is missing but chesscomUsername is set, fetch from chess.com and persist
      type UserProfile = { id: string; displayName: string; chesscomUsername: string | null; avatarUrl: string | null; chesscomElo: number | null };
      const enrichAvatar = async (profile: UserProfile | null): Promise<UserProfile | null> => {
        if (!profile || profile.avatarUrl || !profile.chesscomUsername) return profile;
        try {
          const result = await proxyChessCom(profile.chesscomUsername);
          if (result.status === 200) {
            const body = result.body as { profile?: { avatar?: string } };
            const avatarUrl = body?.profile?.avatar ?? null;
            if (avatarUrl) {
              await db.update(users).set({ avatarUrl }).where(eq(users.id, profile.id));
              return { ...profile, avatarUrl };
            }
          }
        } catch { /* ignore — return profile as-is */ }
        return profile;
      };

      // Fetch host profile
      const hostRows = await db.select({ id: users.id, displayName: users.displayName, chesscomUsername: users.chesscomUsername, avatarUrl: users.avatarUrl, chesscomElo: users.chesscomElo }).from(users).where(eq(users.id, room.hostId)).limit(1);
      const hostRaw = hostRows[0] ?? null;
      // Fetch guest profile if present
      let guestRaw: UserProfile | null = null;
      if (room.guestId) {
        const guestRows = await db.select({ id: users.id, displayName: users.displayName, chesscomUsername: users.chesscomUsername, avatarUrl: users.avatarUrl, chesscomElo: users.chesscomElo }).from(users).where(eq(users.id, room.guestId)).limit(1);
        guestRaw = guestRows[0] ?? null;
      }
      // Enrich both profiles with chess.com avatars in parallel
      const [host, guest] = await Promise.all([enrichAvatar(hostRaw), enrichAvatar(guestRaw)]);
      res.json({ ...room, host, guest });
    } catch (err) {
      console.error("[battles] get error:", err);
      res.status(500).json({ error: "Failed to fetch battle room" });
    }
  });

  // PATCH /api/battles/:code/join — Join a battle room as guest (requires auth)
  app.patch("/api/battles/:code/join", requireAuth, async (req, res) => {
    const { battleRooms } = await import("../shared/schema.js");
    const { users } = await import("../shared/schema.js");
    const userId = (req as import("express").Request & { userId: string }).userId;
    if (!userId) return res.status(401).json({ error: "Authentication required" });
    try {
      const db = await getDb();
      const rows = await db.select().from(battleRooms).where(eq(battleRooms.code, req.params.code.toUpperCase())).limit(1);
      if (rows.length === 0) return res.status(404).json({ error: "Battle room not found" });
      const room = rows[0];
      if (room.status !== "waiting") return res.status(409).json({ error: "Battle room is no longer available" });
      if (room.hostId === userId) return res.status(400).json({ error: "You cannot join your own battle room" });
      if (room.guestId) return res.status(409).json({ error: "Battle room is already full" });
      await db.update(battleRooms).set({ guestId: userId, status: "active", startedAt: new Date() }).where(eq(battleRooms.code, req.params.code.toUpperCase()));
      // Return updated room with profiles — enrich chess.com avatars if missing
      type JoinProfile = { id: string; displayName: string; chesscomUsername: string | null; avatarUrl: string | null; chesscomElo: number | null };
      const enrichJoin = async (p: JoinProfile | null): Promise<JoinProfile | null> => {
        if (!p || p.avatarUrl || !p.chesscomUsername) return p;
        try {
          const r = await proxyChessCom(p.chesscomUsername);
          if (r.status === 200) {
            const av = (r.body as { profile?: { avatar?: string } })?.profile?.avatar ?? null;
            if (av) { await db.update(users).set({ avatarUrl: av }).where(eq(users.id, p.id)); return { ...p, avatarUrl: av }; }
          }
        } catch { /* ignore */ }
        return p;
      };
      const hostRows = await db.select({ id: users.id, displayName: users.displayName, chesscomUsername: users.chesscomUsername, avatarUrl: users.avatarUrl, chesscomElo: users.chesscomElo }).from(users).where(eq(users.id, room.hostId)).limit(1);
      const guestRows = await db.select({ id: users.id, displayName: users.displayName, chesscomUsername: users.chesscomUsername, avatarUrl: users.avatarUrl, chesscomElo: users.chesscomElo }).from(users).where(eq(users.id, userId)).limit(1);
      const [host, guest] = await Promise.all([enrichJoin(hostRows[0] ?? null), enrichJoin(guestRows[0] ?? null)]);
      res.json({ ...room, guestId: userId, status: "active", host, guest });
    } catch (err) {
      console.error("[battles] join error:", err);
      res.status(500).json({ error: "Failed to join battle room" });
    }
  });

  // GET /api/battles/history — Get the signed-in user's battle history (requires auth)
  app.get("/api/battles/history", requireAuth, async (req, res) => {
    const { battleRooms, users } = await import("../shared/schema.js");
    const userId = (req as import("express").Request & { userId: string }).userId;
    if (!userId) return res.status(401).json({ error: "Authentication required" });
    try {
      const db = await getDb();
      // Fetch all completed battles where user was host or guest
      const rows = await db
        .select()
        .from(battleRooms)
        .where(
          and(
            eq(battleRooms.status, "completed"),
            or(
              eq(battleRooms.hostId, userId),
              eq(battleRooms.guestId, userId)
            )
          )
        )
        .orderBy(desc(battleRooms.completedAt))
        .limit(50);

      // Collect opponent user IDs to fetch their profiles
      const opponentIds = Array.from(new Set(
        rows.map((r) => r.hostId === userId ? r.guestId : r.hostId).filter(Boolean) as string[]
      ));

      // Fetch opponent profiles in one query
      const opponentMap: Record<string, { displayName: string; avatarUrl: string | null; chesscomUsername: string | null }> = {};
      if (opponentIds.length > 0) {
        const profiles = await db.select({
          id: users.id,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
          chesscomUsername: users.chesscomUsername,
        }).from(users).where(inArray(users.id, opponentIds));
        for (const p of profiles) opponentMap[p.id] = p;
      }

      // Shape the response
      const history = rows.map((r) => {
        const isHost = r.hostId === userId;
        const opponentId = isHost ? r.guestId : r.hostId;
        const opponent = opponentId ? opponentMap[opponentId] : null;
        let outcome: "win" | "loss" | "draw" = "draw";
        if (r.result === "draw") outcome = "draw";
        else if ((r.result === "host_win" && isHost) || (r.result === "guest_win" && !isHost)) outcome = "win";
        else outcome = "loss";
        return {
          id: r.id,
          code: r.code,
          outcome,
          result: r.result,
          isHost,
          timeControl: r.timeControl ?? null,
          opponent: opponent ? {
            id: opponentId,
            displayName: opponent.displayName,
            avatarUrl: opponent.avatarUrl,
            chesscomUsername: opponent.chesscomUsername,
          } : null,
          completedAt: r.completedAt,
          createdAt: r.createdAt,
        };
      });

      res.json({ history });
    } catch (err) {
      console.error("[battles] history error:", err);
      res.status(500).json({ error: "Failed to fetch battle history" });
    }
  });

  // GET /api/battles/:code/race — Get both players' race state (public)
  app.get("/api/battles/:code/race", (req, res) => {
    const code = req.params.code.toUpperCase();
    const room = getRaceRoom(code);
    res.json({
      openingIdx: room.openingIdx,
      host: room.host,
      guest: room.guest,
    });
  });

  // PATCH /api/battles/:code/race — Push own race progress (requires auth)
  app.patch("/api/battles/:code/race", requireAuth, async (req, res) => {
    const { battleRooms } = await import("../shared/schema.js");
    const userId = (req as import("express").Request & { userId: string }).userId;
    if (!userId) return res.status(401).json({ error: "Authentication required" });
    const code = req.params.code.toUpperCase();
    const { moveIdx, wpm, finished } = req.body as { moveIdx: number; wpm: number; finished: boolean };
    try {
      const db = await getDb();
      const rows = await db.select({ hostId: battleRooms.hostId, guestId: battleRooms.guestId })
        .from(battleRooms).where(eq(battleRooms.code, code)).limit(1);
      if (rows.length === 0) return res.status(404).json({ error: "Battle room not found" });
      const { hostId, guestId } = rows[0];
      const room = getRaceRoom(code);
      const state: RacePlayerState = {
        moveIdx: typeof moveIdx === "number" ? moveIdx : 0,
        wpm: typeof wpm === "number" ? wpm : 0,
        finished: Boolean(finished),
        updatedAt: Date.now(),
        openingIdx: room.openingIdx,
      };
      if (userId === hostId) {
        room.host = state;
      } else if (userId === guestId) {
        room.guest = state;
      } else {
        return res.status(403).json({ error: "Not a participant in this battle" });
      }
      res.json({ ok: true, openingIdx: room.openingIdx });
    } catch (err) {
      console.error("[race] update error:", err);
      res.status(500).json({ error: "Failed to update race state" });
    }
  });

  // PATCH /api/battles/:code/result — Report result (host only)
  app.patch("/api/battles/:code/result", requireAuth, async (req, res) => {
    const { battleRooms } = await import("../shared/schema.js");
    const userId = (req as import("express").Request & { userId: string }).userId;
    if (!userId) return res.status(401).json({ error: "Authentication required" });
    const { result } = req.body as { result: string };
    if (!["host_win", "guest_win", "draw"].includes(result)) return res.status(400).json({ error: "Invalid result" });
    try {
      const db = await getDb();
      const rows = await db.select().from(battleRooms).where(eq(battleRooms.code, req.params.code.toUpperCase())).limit(1);
      if (rows.length === 0) return res.status(404).json({ error: "Battle room not found" });
      const room = rows[0];
      if (room.hostId !== userId) return res.status(403).json({ error: "Only the host can report the result" });
      await db.update(battleRooms).set({ result, status: "completed", completedAt: new Date() }).where(eq(battleRooms.code, req.params.code.toUpperCase()));
      res.json({ ok: true });
    } catch (err) {
      console.error("[battles] result error:", err);
      res.status(500).json({ error: "Failed to report result" });
    }
  });

  return app;
}

// ─── Production entry point ───────────────────────────────────────────────────
// Only runs when executed directly (not when imported by vite.config.ts).
async function startServer() {
  const app = createApp();
  const server = createServer(app);

  // Start the CV job queue background worker
  _startCvJobQueue();

  // Serve static files from dist/public in production
  const staticPath =
    process.env.NODE_ENV === "production"
      ? path.resolve(__dirname, "public")
      : path.resolve(__dirname, "..", "dist", "public");

  app.use(express.static(staticPath));

  // Handle client-side routing - serve index.html for all routes
  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });

  const port = process.env.PORT || 3000;
  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

// Only start the HTTP server when this file is executed directly (production).
// When imported by vite.config.ts as a Vite middleware, we skip the listen call
// so it doesn't conflict with the Vite dev server on port 3000.
const isMain = process.argv[1] &&
  (process.argv[1].endsWith("index.ts") ||
   process.argv[1].endsWith("index.js") ||
   process.argv[1].includes("dist/index"));

if (isMain) {
  startServer().catch(console.error);
}
