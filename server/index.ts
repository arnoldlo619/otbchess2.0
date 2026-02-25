import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import webpush from "web-push";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── VAPID Configuration ──────────────────────────────────────────────────────
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY ?? "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? "mailto:hello@otbchess.app";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

// ─── In-memory subscription store ────────────────────────────────────────────
// Maps tournamentId → Set of PushSubscription JSON objects.
// In production this should be persisted in a database.
type PushSub = webpush.PushSubscription;
const subscriptions = new Map<string, Set<string>>();

function getSubsForTournament(tournamentId: string): Set<string> {
  if (!subscriptions.has(tournamentId)) {
    subscriptions.set(tournamentId, new Set());
  }
  return subscriptions.get(tournamentId)!;
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

async function startServer() {
  const app = express();
  const server = createServer(app);

  app.use(express.json());

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

  // ── Push: POST /api/push/subscribe ────────────────────────────────────────
  // Body: { tournamentId: string, subscription: PushSubscription }
  app.post("/api/push/subscribe", (req, res) => {
    const { tournamentId, subscription } = req.body as {
      tournamentId: string;
      subscription: PushSub;
    };

    if (!tournamentId || !subscription?.endpoint) {
      return res.status(400).json({ error: "Missing tournamentId or subscription" });
    }

    const subs = getSubsForTournament(tournamentId);
    subs.add(JSON.stringify(subscription));
    console.log(`[push] Subscribed to tournament ${tournamentId} (${subs.size} total)`);
    res.json({ ok: true, count: subs.size });
  });

  // ── Push: DELETE /api/push/subscribe ──────────────────────────────────────
  // Body: { tournamentId: string, subscription: PushSubscription }
  app.delete("/api/push/subscribe", (req, res) => {
    const { tournamentId, subscription } = req.body as {
      tournamentId: string;
      subscription: PushSub;
    };

    if (!tournamentId || !subscription?.endpoint) {
      return res.status(400).json({ error: "Missing tournamentId or subscription" });
    }

    const subs = getSubsForTournament(tournamentId);
    subs.delete(JSON.stringify(subscription));
    console.log(`[push] Unsubscribed from tournament ${tournamentId} (${subs.size} remaining)`);
    res.json({ ok: true, count: subs.size });
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

    const subs = getSubsForTournament(tournamentId);
    if (subs.size === 0) {
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
    const staleEndpoints: string[] = [];

    await Promise.allSettled(
      Array.from(subs).map(async (subJson) => {
        try {
          const sub = JSON.parse(subJson) as PushSub;
          await webpush.sendNotification(sub, payload);
          sent++;
        } catch (err: unknown) {
          failed++;
          // 410 Gone = subscription expired; remove it
          if (err && typeof err === "object" && "statusCode" in err) {
            const code = (err as { statusCode: number }).statusCode;
            if (code === 410 || code === 404) {
              staleEndpoints.push(subJson);
            }
          }
          console.warn("[push] Failed to send notification:", err);
        }
      })
    );

    // Clean up expired subscriptions
    for (const stale of staleEndpoints) {
      subs.delete(stale);
    }

    console.log(`[push] Round ${round} notification for ${tournamentId}: ${sent} sent, ${failed} failed`);
    res.json({ ok: true, sent, failed });
  });

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

startServer().catch(console.error);
