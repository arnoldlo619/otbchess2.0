import express from "express";
import cookieParser from "cookie-parser";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import webpush from "web-push";
import { nanoid } from "nanoid";
import { eq, and } from "drizzle-orm";
import { getDb } from "./db.js";
import { createAuthRouter } from "./auth.js";
import { pushSubscriptions, tournamentPlayers, tournamentState } from "../shared/schema.js";

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
export function createApp() {
  const app = express();

  app.use(express.json());
  app.use(cookieParser());

  // ── Auth routes ─────────────────────────────────────────────────────────────
  app.use("/api/auth", createAuthRouter());

  // ── Proxy: GET /api/chess/player/:username ──────────────────────────────────
  app.get("/api/chess/player/:username", async (req, res) => {
    try {
      const { status, body } = await proxyChessCom(req.params.username);
      res.status(status).json(body);
    } catch (err) {
      console.error("[chess proxy]", err);
      res.status(502).json({ error: "Could not reach chess.com" });
    }
  });

  // ── Proxy: GET /api/lichess/player/:username ────────────────────────────────
  app.get("/api/lichess/player/:username", async (req, res) => {
    try {
      const { status, body } = await proxyLichess(req.params.username);
      res.status(status).json(body);
    } catch (err) {
      console.error("[lichess proxy]", err);
      res.status(502).json({ error: "Could not reach lichess.org" });
    }
  });

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
  app.post("/api/push/subscribe", async (req, res) => {
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
      // Extract just the current round's games for efficiency
      const currentRound = s.rounds?.find((r) => r.number === (s.currentRound ?? 0));
      res.json({
        status: s.status ?? "registration",
        currentRound: s.currentRound ?? 0,
        totalRounds: s.totalRounds ?? 0,
        tournamentName: s.tournamentName ?? "",
        players: s.players ?? [],
        games: currentRound?.games ?? [],
        updatedAt: rows[0].updatedAt,
      });
    } catch (err) {
      console.error("[live-state] GET error:", err);
      res.status(500).json({ error: "Database error" });
    }
  });

  // ── Timer: PUT /api/tournament/:id/timer ───────────────────────────────────────
  // Director pushes a timer snapshot; server stores it and broadcasts via SSE.
  app.put("/api/tournament/:id/timer", (req, res) => {
    const { id } = req.params;
    const snap = req.body as TimerSnapshot;
    if (!id || !snap || typeof snap.status !== "string") {
      return res.status(400).json({ error: "Missing id or invalid snapshot" });
    }
    timerStore.set(id, snap);
    broadcastTimerUpdate(id, snap);
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

  return app;
}

// ─── Production entry point ───────────────────────────────────────────────────
// Only runs when executed directly (not when imported by vite.config.ts).
async function startServer() {
  const app = createApp();
  const server = createServer(app);

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
