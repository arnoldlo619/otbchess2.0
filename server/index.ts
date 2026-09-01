import "./sentry.js"; // Must be first — initializes Sentry before any other module
import express from "express";
import type { Request } from "express";
import cookieParser from "cookie-parser";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import webpush from "web-push";
import { nanoid } from "nanoid";
import { eq, and, or, inArray, desc, lt, isNull } from "drizzle-orm";
import { rateLimit, ipKeyGenerator } from "express-rate-limit";
import { getDb } from "./db.js";
import { createAuthRouter, requireAuth, requireFullAuth } from "./auth.js";
import { pushSubscriptions, tournamentPlayers, tournamentState, userTournaments, tournamentAnalytics, chessPlayerCache, tournamentBroadcastSettings, dbClubs } from "../shared/schema.js";
import { createRecordingsRouter } from "./recordings.js";
import { getSnapshotCache, setSnapshotCache, invalidateSnapshotCache, buildSnapshot } from "./publicSnapshot.js";
import type { BuildSnapshotInput } from "./publicSnapshot.js";
import clubMessagingRouter from "./clubMessaging.js";
import clubInvitesRouter, { createInviteRouter } from "./clubInvites.js";
import clubBattlesRouter from "./clubBattles.js";
import { clubsRouter } from "./clubs.js";
import { leaguesRouter } from "./leagues.js";
import { emailRouter } from "./email.js";
import { startCvJobQueue as _startCvJobQueue } from "./cvJobQueue.js";
import { logger } from "./logger.js";
import { createOpeningsAdminRouter } from "./openingsAdmin.js";
import { registerOpeningsPublicRoutes } from "./openingsPublic.js";
import { createBillingRouter } from "./billing.js";
import { createAdminStaffRouter } from "./adminStaff.js";
import { createPopulationAdminRouter } from "./population/admin.js";
import { createRepertoireBuilderRouter } from "./repertoireBuilder.js";
import broadcastsRouter from "./broadcasts.js";
import otbGamesRouter from "./otbGames.js";
import bracketsRouter from "./brackets.js";
import { registerStorageProxy } from "./storageProxy.js";
import { createPushRouter } from "./pushRoutes.js";
import { createChessProxyRouter } from "./chessProxy.js";
import { createPrepRouter } from "./prepRoutes.js";
import { createClientErrorRouter } from "./clientErrorRoutes.js";
import { createOperationalMetricsRouter } from "./operationalMetricsRoutes.js";
import { validate, addPlayerSchema, saveStateSchema, analyticsEventSchema, broadcastSchema, timerUpdateSchema } from "./validation.js";
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

// ─── SSE IP Rate-Limit Registry ───────────────────────────────────────────────
// Tracks how many active SSE connections each IP address currently holds.
// Prevents a single device from accidentally opening dozens of tabs and
// exhausting server file-descriptor / memory budgets.
// IMPORTANT: In tournament venues, ALL players share the same public IP via NAT.
// The limit must be high enough to accommodate a full tournament (64+ players)
// on a single WiFi network. Set to 100 to allow large events while still
// protecting against runaway tab-spam from a single browser.
const MAX_SSE_PER_IP = 100;
const sseIpCount = new Map<string, number>();

function sseIpIncrement(ip: string): boolean {
  const current = sseIpCount.get(ip) ?? 0;
  if (current >= MAX_SSE_PER_IP) return false; // reject
  sseIpCount.set(ip, current + 1);
  return true;
}

function sseIpDecrement(ip: string): void {
  const current = sseIpCount.get(ip) ?? 0;
  const next = Math.max(0, current - 1);
  if (next === 0) sseIpCount.delete(ip);
  else sseIpCount.set(ip, next);
}

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
          logger.warn("[push] Timer expiry push failed:", err);
        }
      })
    );
    // Clean up stale subscriptions.
    if (staleIds.length > 0) {
      await db
        .delete(pushSubscriptions)
        .where(inArray(pushSubscriptions.id, staleIds));
    }
  } catch (err) {
    logger.error("[push] Timer expiry push error:", err);
  }
}

function broadcastTimerUpdate(tournamentId: string, snap: TimerSnapshot) {
  const subs = sseSubscribers.get(tournamentId);
  if (!subs || subs.size === 0) return;
  const payload = `event: timer_update\ndata: ${JSON.stringify(snap)}\n\n`;
  for (const res of Array.from(subs)) {
    try { res.write(payload); } catch { /* disconnected */ }
  }
}

function broadcastPlayerJoined(tournamentId: string, player: Record<string, unknown>) {
  const subs = sseSubscribers.get(tournamentId);
  if (!subs || subs.size === 0) return;
  const payload = `event: player_joined\ndata: ${JSON.stringify(player)}\n\n`;
  for (const res of Array.from(subs)) {
    try { res.write(payload); } catch { /* client already disconnected */ }
  }
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
  for (const res of Array.from(subs)) {    try { res.write(data); } catch { /* client already disconnected */ }
  }
}

function getAffectedRows(result: unknown): number | null {
  const first = Array.isArray(result) ? result[0] : result;
  if (first && typeof first === "object" && "affectedRows" in first) {
    const affectedRows = (first as { affectedRows?: unknown }).affectedRows;
    return typeof affectedRows === "number" ? affectedRows : null;
  }
  return null;
}
// ─── Chess.com & Lichess proxy ──────────────────────────────────────────────────────────
/** Server-side fetch with retry for upstream 429/503 (chess.com rate limiting). */
async function fetchWithRetryServer(
  url: string,
  options: RequestInit,
  maxRetries = 3,
  timeoutMs = 8000
): Promise<Response> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const res = await fetch(url, { ...options, signal: AbortSignal.timeout(timeoutMs) });
    if (res.status === 429 || res.status === 503) {
      const delay = Math.min(1000 * Math.pow(2, attempt), 8000); // 1s, 2s, 4s
      logger.warn(`[chess proxy] Upstream ${res.status} for ${url}, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
      await new Promise((r) => setTimeout(r, delay));
      continue;
    }
    return res;
  }
  // Final attempt without retry
  return fetch(url, { ...options, signal: AbortSignal.timeout(timeoutMs) });
}

/**
 * Background cache warm-up: fires sequential proxyChessCom calls for each username,
 * skipping any that are already cached and fresh. Designed to be called fire-and-forget.
 * Sequential (not parallel) to avoid hammering chess.com with a burst.
 */
async function warmChessPlayerCache(usernames: string[]): Promise<void> {
  const CACHE_TTL_MS = 60 * 60 * 1000;
  for (const raw of usernames) {
    const key = raw.toLowerCase().trim();
    if (!key) continue;
    try {
      // Skip if already cached and fresh
      const db = await getDb();
      const [cached] = await db
        .select({ cachedAt: chessPlayerCache.cachedAt })
        .from(chessPlayerCache)
        .where(eq(chessPlayerCache.username, key))
        .limit(1);
      if (cached && Date.now() - new Date(cached.cachedAt).getTime() < CACHE_TTL_MS) {
        logger.info(`[chess warm-up] SKIP ${key} (already cached)`);
        continue;
      }
      logger.info(`[chess warm-up] FETCH ${key}`);
      await proxyChessCom(key); // writes to cache internally
    } catch (err) {
      logger.warn(`[chess warm-up] error for ${key}:`, err);
    }
    // Small delay between requests to be a good API citizen
    await new Promise((r) => setTimeout(r, 300));
  }
  logger.info(`[chess warm-up] completed ${usernames.length} username(s)`);
}

async function proxyChessCom(username: string): Promise<{ status: number; body: unknown }> {
  const key = username.toLowerCase().trim();
  const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

  // ── Cache read ────────────────────────────────────────────────────────────
  try {
    const db = await getDb();
    const [cached] = await db
      .select()
      .from(chessPlayerCache)
      .where(eq(chessPlayerCache.username, key))
      .limit(1);
    if (cached) {
      const age = Date.now() - new Date(cached.cachedAt).getTime();
      if (age < CACHE_TTL_MS) {
        logger.info(`[chess cache] HIT for ${key} (age ${Math.round(age / 1000)}s)`);
        return {
          status: 200,
          body: {
            profile: JSON.parse(cached.profileJson),
            stats: JSON.parse(cached.statsJson),
            cached: true,
          },
        };
      }
      // Stale — fall through to re-fetch
      logger.info(`[chess cache] STALE for ${key} (age ${Math.round(age / 1000)}s), re-fetching`);
    }
  } catch (cacheErr) {
    logger.warn("[chess cache] read error, falling back to live fetch:", cacheErr);
  }

  // ── Live fetch from chess.com ─────────────────────────────────────────────
  const base = "https://api.chess.com/pub/player";
  const headers = {
    "User-Agent": "OTBChess/1.0 (https://chessotb.club; tournament management app)",
    "Accept": "application/json",
  };

  const [profileRes, statsRes] = await Promise.all([
    fetchWithRetryServer(`${base}/${key}`, { headers }),
    fetchWithRetryServer(`${base}/${key}/stats`, { headers }),
  ]);

  if (profileRes.status === 404) {
    return { status: 404, body: { error: "not_found" } };
  }
  if (profileRes.status === 429) {
    return { status: 429, body: { error: "chess.com rate limit — please try again in a moment" } };
  }
  if (!profileRes.ok) {
    return { status: profileRes.status, body: { error: `chess.com returned ${profileRes.status}` } };
  }

  const [profileData, statsData] = await Promise.all([
    profileRes.json() as Promise<Record<string, unknown>>,
    statsRes.ok ? (statsRes.json() as Promise<Record<string, unknown>>) : Promise.resolve({}),
  ]);

  // ── Cache write ───────────────────────────────────────────────────────────
  try {
    const db = await getDb();
    await db
      .insert(chessPlayerCache)
      .values({
        username: key,
        profileJson: JSON.stringify(profileData),
        statsJson: JSON.stringify(statsData),
        cachedAt: new Date(),
      })
      .onDuplicateKeyUpdate({
        set: {
          profileJson: JSON.stringify(profileData),
          statsJson: JSON.stringify(statsData),
          cachedAt: new Date(),
        },
      });
    logger.info(`[chess cache] WRITE for ${key}`);
  } catch (cacheErr) {
    logger.warn("[chess cache] write error (non-fatal):", cacheErr);
  }

  return { status: 200, body: { profile: profileData, stats: statsData } };
}
// ─── Build the Express app (exported for Vite dev middleware) ─────────────────
// ─── Rate Limiters ──────────────────────────────────────────────────────────

// Global app-level limiter: 200 requests per minute per IP.
// Protects all endpoints from general abuse and DDoS amplification.
// Generous enough for normal tournament use (directors, players, spectators).
const globalLimiter = rateLimit({
  windowMs: 60_000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? ""),
  message: { error: "Too many requests — please slow down." },
  skip: () => process.env.NODE_ENV !== "production",
});

export function createApp() {
  const app = express();

  // ── Trust the reverse proxy (Manus CDN / Cloudflare) so Express sees
  //    req.protocol as "https" and secure cookies work correctly. ────────────
  app.set("trust proxy", 1);

  // ── Body size cap — preserves a tight default while allowing the separately
  // validated Club Feed attachment cap on its one media-bearing POST route. ───
  app.use(express.json({
    limit: "512kb",
    type: (req) => !(req.method === "POST" && /^\/api\/clubs\/[^/]+\/feed\/?$/.test(req.url?.split("?")[0] ?? "")),
  }));
  app.use(cookieParser());

  app.use(requestCorrelation);

  // ── Security headers ────────────────────────────────────────────────────────
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    // Narrow frame-src: allow only Lichess embeds on the analysis workspace route
    // This does not broaden script-src or connect-src
    res.setHeader(
      "Content-Security-Policy",
      "frame-src 'self' https://lichess.org"
    );
    next();
  });

  // ── Cross-Origin Isolation for /repertoire ─────────────────────────────────────
  // Required for SharedArrayBuffer (multi-threaded Stockfish WASM).
  // Scoped to /repertoire only to avoid breaking YouTube iframes on other pages.
  app.use(["/repertoire", "/stockfish"], (_req, res, next) => {
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
    next();
  });

  // ── Global rate limiter ─────────────────────────────────────────────────────────
  // Applied to all /api routes — 200 req/min per IP in production.
  // Static assets and Vite HMR are excluded (they don't match /api).
  app.use("/api", globalLimiter);

  // ── Auth routes ─────────────────────────────────────────────────────────────────────
  app.use("/api/auth", createAuthRouter());

  // ── Google OAuth callback ────────────────────────────────────────────────────
  // Handles the redirect from Google after the user approves sign-in.
  // Exchanges the code for tokens, fetches the user's Google profile,
  // upserts a user row, sets a JWT cookie, and redirects to the app.
  app.get("/api/oauth/callback", async (req, res) => {
    const { code, error: oauthError } = req.query as { code?: string; error?: string };
    const redirectBase = process.env.APP_URL ?? "https://chessotb.club";

    if (oauthError || !code) {
      return res.redirect(`${redirectBase}/?auth_error=${encodeURIComponent(oauthError ?? "access_denied")}`);
    }

    try {
      const redirectUri = `${redirectBase}/api/oauth/callback`;

      // Exchange code for tokens
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: process.env.GOOGLE_CLIENT_ID ?? "",
          client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      });
      const tokenData = await tokenRes.json() as { access_token?: string; error?: string };
      if (!tokenData.access_token) {
        logger.error("[oauth] token exchange failed:", tokenData);
        return res.redirect(`${redirectBase}/?auth_error=token_exchange_failed`);
      }

      // Fetch Google user profile
      const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const profile = await profileRes.json() as {
        id?: string; email?: string; name?: string; picture?: string;
      };
      if (!profile.id || !profile.email) {
        return res.redirect(`${redirectBase}/?auth_error=profile_fetch_failed`);
      }

      const db = await getDb();
      const { users: usersTable } = await import("../shared/schema.js");
      const { eq: eqOp, or: orOp } = await import("drizzle-orm");
      const { nanoid: nid } = await import("nanoid");

      // Find existing user by googleId or email
      const [existing] = await db
        .select()
        .from(usersTable)
        .where(orOp(eqOp(usersTable.googleId, profile.id), eqOp(usersTable.email, profile.email!)))
        .limit(1);

      let userId: string;

      if (existing) {
        // Link Google account if not already linked
        if (!existing.googleId) {
          await db.update(usersTable)
            .set({ googleId: profile.id, updatedAt: new Date() })
            .where(eqOp(usersTable.id, existing.id));
        }
        userId = existing.id;
      } else {
        // Create new account
        userId = nid();
        await db.insert(usersTable).values({
          id: userId,
          email: profile.email!,
          passwordHash: null,
          googleId: profile.id,
          displayName: profile.name ?? profile.email!.split("@")[0],
          avatarUrl: profile.picture ?? null,
        });
        // Send welcome email (fire-and-forget)
        const { sendWelcomeEmail } = await import("./platformEmail.js");
        sendWelcomeEmail({ to: profile.email!, displayName: profile.name ?? "Chess Player" }).catch(
          (e: unknown) => logger.error("[oauth] welcome email failed:", e)
        );
      }

      // Sign JWT and set cookie
      const jwtLib = await import("jsonwebtoken");
      const token = jwtLib.default.sign({ sub: userId }, process.env.JWT_SECRET!, { expiresIn: "30d" });
      res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });

      logger.info(`[oauth] Google sign-in: ${profile.email} (${userId})`);
      return res.redirect(`${redirectBase}/`);
    } catch (err) {
      logger.error("[oauth] callback error:", err);
      return res.redirect(`${redirectBase}/?auth_error=server_error`);
    }
  });

  // ── Health check ─────────────────────────────────────────────────────────────────────
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", ts: Date.now() });
  });

  // ── Extracted route modules ──────────────────────────────────────────────────
  // Prep routes: /api/prep/* (report generation, analysis, saved reports, coach insight)
  app.use("/api/prep", createPrepRouter());
  // Chess/Lichess proxy routes: /api/chess/*, /api/lichess/*, /api/avatar-proxy, /api/font-proxy
  // IMPORTANT: Must be registered BEFORE the recordings router to avoid requireAuth interception
  app.use("/api", createChessProxyRouter());
  // Push notification routes: /api/push/* (subscribe, notify, VAPID key)
  app.use("/api/push", createPushRouter());
  app.use("/api/client-errors", createClientErrorRouter());
  app.use("/api/operational-metrics", createOperationalMetricsRouter());

  // ── Platform stats: GET /api/platform/stats ─────────────────────────────
  // Returns real DB counts for the landing page stats bar. Cached 10 min in-memory.
  let platformStatsCache: { data: Record<string, number>; ts: number } | null = null;
  app.get("/api/platform/stats", async (_req, res) => {
    try {
      const now = Date.now();
      if (platformStatsCache && now - platformStatsCache.ts < 10 * 60 * 1000) {
        return res.json(platformStatsCache.data);
      }
      const db = await getDb();
      const { count } = await import("drizzle-orm");
      const [tCount] = await db.select({ value: count() }).from(tournamentState);
      const [pCount] = await db.select({ value: count() }).from(tournamentPlayers);
      const [cCount] = await db.select({ value: count() }).from(dbClubs);
      const data: Record<string, number> = {
        tournaments: tCount?.value ?? 0,
        players: pCount?.value ?? 0,
        clubs: cCount?.value ?? 0,
      };
      platformStatsCache = { data, ts: now };
      return res.json(data);
    } catch (err) {
      logger.error("[platform/stats]", err);
      return res.status(500).json({ error: "stats unavailable" });
    }
  });

  // ── Game Recorder routes ───────────────────────────────────────────────────
  // Mount at /api/recordings for session routes and /api/games for game routes.
  // Using two explicit mounts instead of a broad /api mount prevents the
  // requireAuth middleware inside the router from intercepting unrelated routes
  // like /api/chess/* and /api/lichess/*.
  app.use("/api/recordings", createRecordingsRouter());
  app.use("/api/games", createRecordingsRouter());

  // ── Static: serve uploaded club avatars ─────────────────────────────────────────
  // Use /tmp/otb-uploads to avoid corrupted project uploads dir in sandbox
  const uploadsDir = "/tmp/otb-uploads";
  app.use("/uploads", express.static(uploadsDir, { maxAge: "7d" }));
  // ── Clubs API (Discover, Create, Join, Members) ───────────────────────────
  app.use("/api/clubs/:clubId/feed", express.json({ limit: "22mb" }));
  app.use("/api/clubs", clubsRouter);
  app.use("/api/leagues", leaguesRouter);
  app.use("/api/email", emailRouter);
  app.use("/api/tournament", emailRouter);

  // ── Club Messaging (DMs + turn-based chess) ───────────────────────────────
  app.use("/api/clubs/:clubId/conversations", clubMessagingRouter);
  app.use("/api/clubs/:clubId/invites", clubInvitesRouter);
  app.use("/api/clubs/:clubId/battles", clubBattlesRouter);
  app.use("/api/invite", createInviteRouter());
   app.use("/api/admin", createOpeningsAdminRouter());
  registerOpeningsPublicRoutes(app);
  // ── Billing: Stripe checkout, portal, webhook ──────────────────────────────
  // Webhook needs raw body — mount before JSON middleware would consume it.
  app.use("/api/billing/webhook", express.raw({ type: "application/json" }));
  app.use("/api/billing", createBillingRouter());
  app.use("/api/admin/staff", createAdminStaffRouter());
  app.use("/api/admin/population", createPopulationAdminRouter());
  app.use("/api/repertoire-builder", createRepertoireBuilderRouter());
  app.use("/api/broadcasts", broadcastsRouter);
  app.use("/api/otb-games", otbGamesRouter);
  app.use("/api/brackets", bracketsRouter);
  registerStorageProxy(app);


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
      logger.error("[players] GET error:", err);
      res.status(500).json({ error: "Database error" });
    }
  });

  // ── Tournament Players: POST /api/tournament/:id/players ─────────────────────
  // Upserts a player registration (insert or update by username).
  // Body: { player: Player }  (the full Player object from the client)
  app.post("/api/tournament/:id/players", validate(addPlayerSchema), async (req, res) => {
    const { id } = req.params;
    const { player } = req.body as { player: Record<string, unknown> };
    if (!id || !player || typeof player.username !== "string") {
      return res.status(400).json({ error: "Missing tournament id or player.username" });
    }
    const username = (player.username as string).toLowerCase().trim();
    if (!username) {
      return res.status(400).json({ error: "Player username cannot be empty" });
    }
    const registrationPlayer = { ...player, username };
    try {
      const db = await getDb();
      // Lifecycle guard: reject registrations when the tournament has started or completed.
      // This prevents late registrations from corrupting pairings.
      const stateRows = await db
        .select({ stateJson: tournamentState.stateJson })
        .from(tournamentState)
        .where(eq(tournamentState.tournamentId, id));
      if (stateRows.length > 0) {
        try {
          const ts = JSON.parse(stateRows[0].stateJson) as { status?: string };
          const status = ts?.status ?? "";
          if (status === "completed" || status === "in_progress" || status === "paused") {
            return res.status(409).json({ error: "registration_closed", message: "Tournament registration is closed" });
          }
        } catch {
          // If stateJson is malformed, allow the registration to proceed
        }
      }
      await db
        .insert(tournamentPlayers)
        .values({
          id: nanoid(),
          tournamentId: id,
          username,
          playerJson: JSON.stringify(registrationPlayer),
        })
        .onDuplicateKeyUpdate({
          set: {
            // Preserve original joinedAt/id while refreshing player details.
            playerJson: JSON.stringify(registrationPlayer),
          },
        });
      // Broadcast the new/updated player to all connected SSE director clients
      broadcastPlayerJoined(id, registrationPlayer);
      res.json({ ok: true, username });
      // Fire-and-forget cache warm-up for chess.com players
      const platform = (player.platform as string | undefined) ?? "chesscom";
      if (platform === "chesscom") {
        warmChessPlayerCache([username]).catch(() => {});
      }
    } catch (err) {
      logger.error("[players] POST error:", err);
      res.status(500).json({ error: "Database error" });
    }
  });

  // ── Tournament Players: POST /api/tournament/:id/players/warm-cache ──────────
  // Accepts an array of { username, platform } objects and pre-warms the
  // chess_player_cache for all chess.com players that are not already cached.
  // Fire-and-forget: responds immediately with { queued: N } and runs in background.
  app.post("/api/tournament/:id/players/warm-cache", async (req, res) => {
    const { players } = req.body as { players?: Array<{ username: string; platform?: string }> };
    if (!Array.isArray(players)) {
      return res.status(400).json({ error: "players array required" });
    }
    const chesscomUsernames = players
      .filter((p) => (p.platform ?? "chesscom") === "chesscom" && typeof p.username === "string")
      .map((p) => p.username.toLowerCase().trim())
      .filter(Boolean);
    // Respond immediately — warm-up runs in background
    res.json({ ok: true, queued: chesscomUsernames.length });
    warmChessPlayerCache(chesscomUsernames).catch(() => {});
  });

  // ── Tournament SSE: GET /api/tournament/:id/stream ──────────────────────────
  // General-purpose SSE stream for tournament spectators/players.
  // Receives all broadcast events: standings_updated, round_started,
  // timer_update, tournament_ended, tournament_started, player_joined.
  // Sends a keepalive comment every 25s to prevent proxy/load-balancer timeouts.
  app.get("/api/tournament/:id/stream", (req, res) => {
    const { id } = req.params;
    if (!id) { res.status(400).end(); return; }

    // IP rate-limit: max MAX_SSE_PER_IP concurrent SSE connections per IP
    const clientIp = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0].trim()
      ?? req.socket.remoteAddress
      ?? "unknown";
    if (!sseIpIncrement(clientIp)) {
      res.status(429).setHeader("Content-Type", "text/plain");
      res.end(`Too many live connections from this device (max ${MAX_SSE_PER_IP}). Close other tabs and try again.`);
      return;
    }

    // SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // disable nginx buffering
    res.flushHeaders();

    // Register this response as a subscriber (same Map as /players/stream)
    if (!sseSubscribers.has(id)) sseSubscribers.set(id, new Set());
    const subs = sseSubscribers.get(id)!;
    subs.add(res);

    // Send an initial comment so the browser knows the stream is open
    res.write(`: connected\n\n`);

    // Keepalive ping every 25 seconds
    const keepalive = setInterval(() => {
      try { res.write(`: keepalive\n\n`); } catch { clearInterval(keepalive); }
    }, 25_000);

    // Clean up on disconnect — always release the IP slot
    req.on("close", () => {
      clearInterval(keepalive);
      subs.delete(res);
      if (subs.size === 0) sseSubscribers.delete(id);
      sseIpDecrement(clientIp);
    });
  });

  // ── Tournament Players: GET /api/tournament/:id/players/stream ──────────────
  // SSE stream — director subscribes once; server pushes "player_joined" events
  // whenever a new player registers via POST /api/tournament/:id/players.
  // Sends a keepalive comment every 25s to prevent proxy/load-balancer timeouts.
  // NOTE: This endpoint MUST be registered AFTER /api/tournament/:id/stream
  // because Express matches routes in registration order, and the more specific
  // /players/stream path must not shadow the general /stream path.
  app.get("/api/tournament/:id/players/stream", (req, res) => {
    const { id } = req.params;
    if (!id) { res.status(400).end(); return; }

    // IP rate-limit: shared counter with /stream — max MAX_SSE_PER_IP total per IP
    const clientIp = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0].trim()
      ?? req.socket.remoteAddress
      ?? "unknown";
    if (!sseIpIncrement(clientIp)) {
      res.status(429).setHeader("Content-Type", "text/plain");
      res.end(`Too many live connections from this device (max ${MAX_SSE_PER_IP}). Close other tabs and try again.`);
      return;
    }

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

    // Send an initial comment so the browser knows the stream is open
    res.write(`: connected\n\n`);

    // Keepalive ping every 25 seconds
    const keepalive = setInterval(() => {
      try { res.write(`: keepalive\n\n`); } catch { clearInterval(keepalive); }
    }, 25_000);

    // Clean up on disconnect — always release the IP slot
    req.on("close", () => {
      clearInterval(keepalive);
      subs.delete(res);
      if (subs.size === 0) sseSubscribers.delete(id);
      sseIpDecrement(clientIp);
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
      res.json({ state: JSON.parse(rows[0].stateJson), updatedAt: rows[0].updatedAt, revision: rows[0].revision });
    } catch (err) {
      logger.error("[state] GET error:", err);
      res.status(500).json({ error: "Database error" });
    }
  });

  // ── Tournament State: PUT /api/tournament/:id/state ─────────────────────────
  // Upserts the full director state JSON for a tournament.
  // Body: { state: DirectorState }
  app.put("/api/tournament/:id/state", validate(saveStateSchema), async (req, res) => {
    const { id } = req.params;
    const { state, baseRevision } = req.body as { state: unknown; baseRevision?: unknown };
    if (!id || !state) return res.status(400).json({ error: "Missing tournament id or state" });
    if (baseRevision !== undefined && (typeof baseRevision !== "number" || !Number.isInteger(baseRevision) || baseRevision < 0)) {
      return res.status(400).json({ error: "baseRevision must be a non-negative integer" });
    }
    // Never persist the demo tournament
    if (id === "otb-demo-2026") return res.json({ ok: true, skipped: true });
    try {
      const db = await getDb();
      const stateJson = JSON.stringify(state);
      // Check if row exists
      const existing = await db
        .select({
          tournamentId: tournamentState.tournamentId,
          stateJson: tournamentState.stateJson,
          updatedAt: tournamentState.updatedAt,
          revision: tournamentState.revision,
        })
        .from(tournamentState)
        .where(eq(tournamentState.tournamentId, id));
      if (existing.length > 0) {
        const current = existing[0];
        if (baseRevision === undefined) {
          return res.status(409).json({
            error: "revision_conflict",
            message: "Tournament state already exists on the server. Reload the latest state before saving.",
            currentRevision: current.revision,
            updatedAt: current.updatedAt,
            state: JSON.parse(current.stateJson),
          });
        }
        if (typeof baseRevision === "number" && baseRevision !== current.revision) {
          return res.status(409).json({
            error: "revision_conflict",
            message: "Tournament state changed on another device. Reload the latest state before saving.",
            currentRevision: current.revision,
            updatedAt: current.updatedAt,
            state: JSON.parse(current.stateJson),
          });
        }
        const nextRevision = current.revision + 1;
        const updateResult = await db
          .update(tournamentState)
          .set({ stateJson, revision: nextRevision, updatedAt: new Date() })
          .where(
            and(
              eq(tournamentState.tournamentId, id),
              eq(tournamentState.revision, current.revision)
            )
          );
        const affectedRows = getAffectedRows(updateResult);
        if (affectedRows === 0) {
          const latest = await db
            .select()
            .from(tournamentState)
            .where(eq(tournamentState.tournamentId, id));
          const latestRow = latest[0];
          return res.status(409).json({
            error: "revision_conflict",
            message: "Tournament state changed on another device. Reload the latest state before saving.",
            currentRevision: latestRow?.revision ?? current.revision,
            updatedAt: latestRow?.updatedAt ?? current.updatedAt,
            state: latestRow?.stateJson ? JSON.parse(latestRow.stateJson) : JSON.parse(current.stateJson),
          });
        }
      } else {
        await db.insert(tournamentState).values({ tournamentId: id, stateJson, revision: 1 });
      }
      // Invalidate public snapshot cache so next public read rebuilds from fresh data
      invalidateSnapshotCache(id);
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
      res.json({ ok: true, revision: existing.length > 0 ? existing[0].revision + 1 : 1 });
    } catch (err) {
      logger.error("[state] PUT error:", err);
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
        elimPhase?: string;
        elimPlayers?: unknown[];
        swissRounds?: number;
        format?: string;
        elimCutoff?: number;
        bracketLabel?: string;
        parentBracketGroupId?: string;
        parentTournamentId?: string;
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
        // swiss_elim phase tracking — needed by spectators on fresh devices
        elimPhase: s.elimPhase ?? null,
        elimPlayers: s.elimPlayers ?? [],
        swissRounds: s.swissRounds ?? null,
        format: s.format ?? null,
        elimCutoff: s.elimCutoff ?? null,
        // Bracket metadata for child bracket-tournaments
        bracketLabel: s.bracketLabel ?? null,
        parentBracketGroupId: s.parentBracketGroupId ?? null,
        parentTournamentId: s.parentTournamentId ?? null,
        updatedAt: rows[0].updatedAt,
      });
    } catch (err) {
      logger.error("[live-state] GET error:", err);
      res.status(500).json({ error: "Database error" });
    }
  });

  // ── Public Tournament: GET /api/public/tournament/:slug ─────────────────────
  // Returns the full live state for a publicly visible tournament.
  // Public tournament endpoint — serves a precomputed, cached snapshot.
  // ETag support: clients send If-None-Match, we return 304 if unchanged.
  // Cache is invalidated when the director saves state (see PUT /api/tournament/:id/state).
  app.get("/api/public/tournament/:slug", async (req, res) => {
    const { slug } = req.params;
    if (!slug) return res.status(400).json({ error: "Missing slug" });
    try {
      const db = await getDb();
      // Look up by tournamentId first, then by customSlug
      let utRows = await db
        .select()
        .from(userTournaments)
        .where(and(eq(userTournaments.tournamentId, slug), eq(userTournaments.isPublic, 1)))
        .limit(1);
      if (utRows.length === 0) {
        utRows = await db
          .select()
          .from(userTournaments)
          .where(and(eq(userTournaments.customSlug, slug), eq(userTournaments.isPublic, 1)))
          .limit(1);
      }
      if (utRows.length === 0) return res.status(404).json({ error: "not_found" });
      const ut = utRows[0];

      // Check in-memory cache first
      let cached = getSnapshotCache(ut.tournamentId);
      if (!cached) {
        // Cache miss — build snapshot from DB
        const stateRows = await db
          .select()
          .from(tournamentState)
          .where(eq(tournamentState.tournamentId, ut.tournamentId))
          .limit(1);
        if (stateRows.length === 0) return res.status(404).json({ error: "no_state" });
        const s = JSON.parse(stateRows[0].stateJson) as {
          status?: string;
          currentRound?: number;
          totalRounds?: number;
          tournamentName?: string;
          format?: string;
          players?: BuildSnapshotInput["players"];
          rounds?: BuildSnapshotInput["rounds"];
          quadSections?: Array<{ id: string; name: string; type: string; playerIds: string[] }>;
        };
        const snapshot = buildSnapshot({
          tournamentId: ut.tournamentId,
          status: s.status ?? "registration",
          currentRound: s.currentRound ?? 0,
          totalRounds: s.totalRounds ?? 0,
          tournamentName: s.tournamentName ?? ut.name ?? "",
          format: s.format ?? (ut as Record<string, unknown>).format as string ?? "swiss",
          venue: (ut as Record<string, unknown>).venue as string ?? "",
          date: (ut as Record<string, unknown>).date as string ?? "",
          players: s.players ?? [],
          rounds: s.rounds ?? [],
          quadSections: s.quadSections,
          updatedAt: stateRows[0].updatedAt?.toISOString?.() ?? new Date().toISOString(),
        });
        cached = setSnapshotCache(ut.tournamentId, snapshot);
      }

      // ETag conditional response
      const clientEtag = req.headers["if-none-match"];
      if (clientEtag && clientEtag === cached.etag) {
        return res.status(304).end();
      }

      // Fire-and-forget page_view tracking (only on full responses, not 304s)
      db.insert(tournamentAnalytics).values({
        id: nanoid(),
        tournamentId: ut.tournamentId,
        eventType: "page_view",
        metadata: null,
      }).catch(() => {});

      res.setHeader("ETag", cached.etag);
      res.setHeader("Cache-Control", "public, max-age=5");
      res.setHeader("Content-Type", "application/json");
      res.send(cached.json);
    } catch (err) {
      logger.error("[public-tournament] GET error:", err);
      res.status(500).json({ error: "Database error" });
    }
  });

  // ── Analytics: POST /api/analytics/event ────────────────────────────────────
  // Lightweight client-side event tracking endpoint (no auth required).
  // Accepts: { tournamentId, eventType, metadata? }
  // Rate-limited to prevent abuse.
  const analyticsLimiter = rateLimit({ windowMs: 60_000, max: 60, keyGenerator: (req) => ipKeyGenerator(req.ip ?? "") });
  app.post("/api/analytics/event", analyticsLimiter, validate(analyticsEventSchema), async (req, res) => {
    const { tournamentId, eventType, metadata } = req.body ?? {};
    if (!tournamentId || !eventType) return res.status(400).json({ error: "Missing fields" });
    const validTypes = ["search", "follow", "unfollow", "email_capture", "card_claim", "cta_click"];
    if (!validTypes.includes(eventType)) return res.status(400).json({ error: "Invalid event type" });
    try {
      const db = await getDb();
      await db.insert(tournamentAnalytics).values({
        id: nanoid(),
        tournamentId: String(tournamentId),
        eventType: String(eventType),
        metadata: metadata ? JSON.stringify(metadata) : null,
      });
      res.json({ ok: true });
    } catch (err) {
      logger.error("[analytics] POST error:", err);
      res.status(500).json({ error: "Failed" });
    }
  });

  // ── Analytics: GET /api/tournament/:id/analytics ────────────────────────────
  // Aggregate analytics for the tournament organizer dashboard.
  // Returns event counts, funnel metrics, and attendance data.
  // Requires auth — only the tournament owner can read.
  app.get("/api/tournament/:id/analytics", requireAuth, async (req, res) => {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: "Missing tournament id" });
    try {
      const db = await getDb();
      const userId = (req as Request & { userId?: string }).userId;
      if (!userId) return res.status(401).json({ error: "Not authenticated" });
      // Verify ownership
      const utRows = await db
        .select()
        .from(userTournaments)
        .where(and(eq(userTournaments.tournamentId, id), eq(userTournaments.userId, userId)))
        .limit(1);
      if (!utRows.length) return res.status(403).json({ error: "Not authorized" });

      // Fetch all analytics events for this tournament
      const events = await db
        .select()
        .from(tournamentAnalytics)
        .where(eq(tournamentAnalytics.tournamentId, id));

      // Aggregate by event type
      const eventCounts: Record<string, number> = {};
      const uniqueIps = new Set<string>();
      const emailsCaptured: string[] = [];
      const ctaClicks: Record<string, number> = {};
      const searchQueries: string[] = [];
      const followedPlayers: string[] = [];
      const timeline: { date: string; views: number; interactions: number }[] = [];
      const dateMap = new Map<string, { views: number; interactions: number }>();

      for (const event of events) {
        // Count by type
        eventCounts[event.eventType] = (eventCounts[event.eventType] ?? 0) + 1;

        // Parse metadata
        let meta: Record<string, unknown> = {};
        if (event.metadata) {
          try {
            const parsed: unknown = JSON.parse(event.metadata);
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
              meta = parsed as Record<string, unknown>;
            }
          } catch { /* silent */ }
        }

        // Track unique IPs from page views
        if (event.eventType === "page_view" && typeof meta.ip === "string") {
          uniqueIps.add(meta.ip);
        }

        // Track email captures
        if (event.eventType === "email_capture" && typeof meta.email === "string") {
          emailsCaptured.push(meta.email);
        }

        // Track CTA clicks by type
        if (event.eventType === "cta_click" && typeof meta.cta === "string") {
          ctaClicks[meta.cta] = (ctaClicks[meta.cta] ?? 0) + 1;
        }

        // Track search queries
        if (event.eventType === "search" && typeof meta.playerName === "string") {
          searchQueries.push(meta.playerName);
        }

        // Track followed players
        if (event.eventType === "follow" && typeof meta.playerId === "string") {
          followedPlayers.push(meta.playerId);
        }

        // Build timeline (group by date)
        const dateStr = event.createdAt ? new Date(event.createdAt).toISOString().slice(0, 10) : "unknown";
        if (!dateMap.has(dateStr)) dateMap.set(dateStr, { views: 0, interactions: 0 });
        const day = dateMap.get(dateStr)!;
        if (event.eventType === "page_view") {
          day.views++;
        } else {
          day.interactions++;
        }
      }

      // Convert dateMap to sorted timeline array
      for (const [date, counts] of Array.from(dateMap.entries()).sort()) {
        timeline.push({ date, ...counts });
      }

      // Fetch tournament state for attendance metrics
      const stateRows = await db
        .select()
        .from(tournamentState)
        .where(eq(tournamentState.tournamentId, id))
        .limit(1);
      let attendance = { registered: 0, totalRounds: 0, currentRound: 0, gamesPlayed: 0 };
      if (stateRows.length && stateRows[0].stateJson) {
        try {
          const state = JSON.parse(stateRows[0].stateJson);
          attendance.registered = state.players?.length ?? 0;
          attendance.totalRounds = state.totalRounds ?? 0;
          attendance.currentRound = state.currentRound ?? 0;
          const rounds = state.rounds ?? [];
          for (const round of rounds) {
            for (const game of round.games ?? []) {
              if (game.result && game.result !== "*") attendance.gamesPlayed++;
            }
          }
        } catch { /* silent */ }
      }

      // Compute funnel
      const totalViews = eventCounts["page_view"] ?? 0;
      const totalSearches = eventCounts["search"] ?? 0;
      const totalFollows = eventCounts["follow"] ?? 0;
      const totalUnfollows = eventCounts["unfollow"] ?? 0;
      const totalEmails = emailsCaptured.length;
      const totalCtaClicks = Object.values(ctaClicks).reduce((a, b) => a + b, 0);
      const totalCardClaims = eventCounts["card_claim"] ?? 0;

      // ── Top searches by frequency ──────────────────────────────────
      const searchFreq = new Map<string, number>();
      for (const q of searchQueries) {
        const key = q.toLowerCase().trim();
        searchFreq.set(key, (searchFreq.get(key) ?? 0) + 1);
      }
      const topSearchesSorted = Array.from(searchFreq.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([name, count]) => ({ name, count }));

      // ── Top followed players by frequency ──────────────────────────
      const followFreq = new Map<string, number>();
      for (const p of followedPlayers) {
        followFreq.set(p, (followFreq.get(p) ?? 0) + 1);
      }
      const topFollowedSorted = Array.from(followFreq.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([playerId, count]) => ({ playerId, count }));

      // ── Operational quality metrics ────────────────────────────────
      let operationalQuality = {
        completionRate: 0,
        avgGamesPerRound: 0,
        roundsCompleted: 0,
        totalGamesExpected: 0,
        byeCount: 0,
      };
      if (stateRows.length && stateRows[0].stateJson) {
        try {
          const state = JSON.parse(stateRows[0].stateJson);
          const rounds = state.rounds ?? [];
          const _totalRounds = state.totalRounds ?? 0;
          let completedRounds = 0;
          let totalGames = 0;
          let reportedGames = 0;
          let byes = 0;
          for (const round of rounds) {
            const games = round.games ?? [];
            let allReported = true;
            for (const game of games) {
              totalGames++;
              if (game.result && game.result !== "*") {
                reportedGames++;
              } else {
                allReported = false;
              }
              if (game.isBye) byes++;
            }
            if (allReported && games.length > 0) completedRounds++;
          }
          operationalQuality = {
            completionRate: totalGames > 0 ? Math.round((reportedGames / totalGames) * 100) : 0,
            avgGamesPerRound: rounds.length > 0 ? Math.round(totalGames / rounds.length) : 0,
            roundsCompleted: completedRounds,
            totalGamesExpected: totalGames,
            byeCount: byes,
          };
        } catch { /* silent */ }
      }

      // ── Retention signals ──────────────────────────────────────────
      const retentionSignals = {
        netFollows: totalFollows - totalUnfollows,
        cardClaims: totalCardClaims,
        emailConversionRate: totalViews > 0 ? Math.round((totalEmails / totalViews) * 100) : 0,
        ctaConversionRate: totalViews > 0 ? Math.round((totalCtaClicks / totalViews) * 100) : 0,
        searchToFollowRate: totalSearches > 0 ? Math.round((totalFollows / totalSearches) * 100) : 0,
      };

      // ── Attendance Breakdown ──────────────────────────────────────
      let attendanceBreakdown = {
        preRegistered: 0, walkIns: 0, lateAdds: 0, finalField: 0,
        noShows: 0, walkInRate: 0, noShowRate: 0,
      };
      if (stateRows.length && stateRows[0].stateJson) {
        try {
          const state = JSON.parse(stateRows[0].stateJson) as {
            players?: Array<{ id: string; joinedAt?: number }>;
            rounds?: Array<{
              games?: Array<{
                startedAt?: number;
                result?: string;
                whiteId?: string;
                blackId?: string;
              }>;
            }>;
          };
          const players = state.players ?? [];
          const rounds = state.rounds ?? [];
          // Determine round 1 start time from first game timestamp
          let round1StartMs: number | null = null;
          if (rounds.length > 0) {
            for (const g of rounds[0].games ?? []) {
              if (g.startedAt && (!round1StartMs || g.startedAt < round1StartMs))
                round1StartMs = g.startedAt;
            }
          }
          let preReg = 0; let walkIn = 0;
          for (const p of players) {
            if (round1StartMs && p.joinedAt && p.joinedAt > round1StartMs) walkIn++;
            else preReg++;
          }
          // No-shows: players who never appeared in any completed game
          let noShows = 0;
          if (rounds.length > 0) {
            const playedIds = new Set<string>();
            for (const r of rounds) {
              for (const g of r.games ?? []) {
                if (g.result && g.result !== "*") {
                  if (g.whiteId) playedIds.add(g.whiteId);
                  if (g.blackId) playedIds.add(g.blackId);
                }
              }
            }
            for (const p of players) {
              if (!playedIds.has(p.id) && p.id !== "BYE") noShows++;
            }
          }
          const finalField = players.length;
          attendanceBreakdown = {
            preRegistered: preReg, walkIns: walkIn, lateAdds: walkIn,
            finalField, noShows,
            walkInRate: finalField > 0 ? Math.round((walkIn / finalField) * 100) : 0,
            noShowRate: finalField > 0 ? Math.round((noShows / finalField) * 100) : 0,
          };
        } catch { /* silent */ }
      }

      // ── Post-Event Conversion Metrics ─────────────────────────────
      const postEventConversion = {
        emailsOptedIn: totalEmails,
        cardsClaimed: totalCardClaims,
        joinClubClicks: ctaClicks["join_club"] ?? 0,
        createAccountClicks: ctaClicks["create_account"] ?? 0,
        anonToLeadRate: totalViews > 0
          ? Math.round(((totalEmails + totalCardClaims) / totalViews) * 100) : 0,
        emailCaptureRate: totalViews > 0 ? Math.round((totalEmails / totalViews) * 100) : 0,
        cardClaimRate: totalViews > 0 ? Math.round((totalCardClaims / totalViews) * 100) : 0,
      };

      // ── Club Growth Contribution ──────────────────────────────────
      const clubGrowth = {
        totalLeadsGenerated: totalEmails + totalCardClaims,
        emailLeads: totalEmails,
        cardClaimLeads: totalCardClaims,
        clubJoinClicks: ctaClicks["join_club"] ?? 0,
        createAccountClicks: ctaClicks["create_account"] ?? 0,
        totalCtaConversions: Object.values(ctaClicks).reduce((a: number, b: number) => a + b, 0),
        leadConversionRate: totalViews > 0
          ? Math.round(((totalEmails + totalCardClaims) / totalViews) * 100) : 0,
      };

      // ── Tournament Comparison (past 5 events by this organizer) ───
      let tournamentComparison: {
        pastEvents: { id: string; name: string; date: string | null; format: string | null; playerCount: number; status: string | null }[];
        avgAttendance: number; thisEventRank: number;
      } = { pastEvents: [], avgAttendance: 0, thisEventRank: 1 };
      try {
        const allUserTmts = await db.select().from(userTournaments)
          .where(eq(userTournaments.userId, userId)).limit(20);
        const pastEvents: { id: string; name: string; date: string | null; format: string | null; playerCount: number; status: string | null }[] = [];
        for (const ut of allUserTmts) {
          if (ut.tournamentId === id) continue;
          const psr = await db.select({ stateJson: tournamentState.stateJson })
            .from(tournamentState).where(eq(tournamentState.tournamentId, ut.tournamentId)).limit(1);
          let playerCount = 0;
          if (psr.length && psr[0].stateJson) {
            try { playerCount = JSON.parse(psr[0].stateJson).players?.length ?? 0; } catch { /* silent */ }
          }
          pastEvents.push({ id: ut.tournamentId, name: ut.name, date: ut.date ?? null,
            format: ut.format ?? null, playerCount, status: ut.status ?? null });
        }
        const sorted = pastEvents.slice(-5).reverse();
        const avgAttendance = sorted.length > 0
          ? Math.round(sorted.reduce((s, e) => s + e.playerCount, 0) / sorted.length) : 0;
        const allCounts = [...sorted.map(e => e.playerCount), attendanceBreakdown.finalField].sort((a, b) => b - a);
        const thisEventRank = allCounts.indexOf(attendanceBreakdown.finalField) + 1;
        tournamentComparison = { pastEvents: sorted, avgAttendance, thisEventRank };
      } catch { /* silent */ }

      // ── Repeat-Event Growth Signals ───────────────────────────────
      let repeatEventGrowth = { newPlayers: 0, returningPlayers: 0, repeatRate: 0, multiEventPlayers: 0 };
      if (stateRows.length && stateRows[0].stateJson) {
        try {
          const state = JSON.parse(stateRows[0].stateJson) as {
            players?: Array<{ username?: string }>;
          };
          const currentUsernames = new Set<string>(
            (state.players ?? []).map((p) => (p.username ?? "").toLowerCase()).filter(Boolean)
          );
          const seenInPast = new Set<string>();
          const allUserTmts2 = await db.select().from(userTournaments)
            .where(eq(userTournaments.userId, userId)).limit(20);
          for (const ut of allUserTmts2) {
            if (ut.tournamentId === id) continue;
            const psr2 = await db.select({ stateJson: tournamentState.stateJson })
              .from(tournamentState).where(eq(tournamentState.tournamentId, ut.tournamentId)).limit(1);
            if (psr2.length && psr2[0].stateJson) {
              try {
                const s = JSON.parse(psr2[0].stateJson) as {
                  players?: Array<{ username?: string }>;
                };
                for (const p of s.players ?? []) {
                  const u = (p.username ?? "").toLowerCase();
                  if (u && currentUsernames.has(u)) seenInPast.add(u);
                }
              } catch { /* silent */ }
            }
          }
          const returning = seenInPast.size;
          const total = currentUsernames.size;
          repeatEventGrowth = {
            newPlayers: total - returning, returningPlayers: returning,
            repeatRate: total > 0 ? Math.round((returning / total) * 100) : 0,
            multiEventPlayers: returning,
          };
        } catch { /* silent */ }
      }

      res.json({
        overview: {
          totalViews,
          uniqueVisitors: uniqueIps.size,
          totalInteractions: events.length - totalViews,
          engagementRate: totalViews > 0 ? Math.round(((events.length - totalViews) / totalViews) * 100) : 0,
        },
        attendance,
        attendanceBreakdown,
        funnel: {
          views: totalViews,
          searches: totalSearches,
          follows: totalFollows,
          emailCaptures: totalEmails,
          ctaClicks: totalCtaClicks,
        },
        ctaBreakdown: ctaClicks,
        emailsCaptured,
        topSearches: topSearchesSorted,
        topFollowedPlayers: topFollowedSorted,
        eventCounts,
        timeline,
        operationalQuality,
        retentionSignals,
        postEventConversion,
        clubGrowth,
        tournamentComparison,
        repeatEventGrowth,
      });
    } catch (err) {
      logger.error("[analytics] GET aggregate error:", err);
      res.status(500).json({ error: "Failed to fetch analytics" });
    }
  });

  // ── Public Tournament: GET /api/tournament/:id/public ──────────────────────
  // Returns the current public visibility status for the tournament.
  // Requires auth — only the tournament owner can read.
  app.get("/api/tournament/:id/public", requireAuth, async (req, res) => {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: "Missing tournament id" });
    try {
      const db = await getDb();
      const userId = (req as Request & { userId?: string }).userId;
      if (!userId) return res.status(401).json({ error: "Not authenticated" });
      const utRows = await db
        .select()
        .from(userTournaments)
        .where(and(eq(userTournaments.tournamentId, id), eq(userTournaments.userId, userId)))
        .limit(1);
      if (utRows.length === 0) return res.status(404).json({ error: "not_found" });
      res.json({ isPublic: utRows[0].isPublic === 1 });
    } catch (err) {
      logger.error("[public-status] GET error:", err);
      res.status(500).json({ error: "Database error" });
    }
  });

  // ── Public Tournament: PUT /api/tournament/:id/public ──────────────────────
  // Director toggles public visibility for their tournament.
  // Requires auth — only the tournament owner can toggle.
  app.put("/api/tournament/:id/public", requireAuth, async (req, res) => {
    const { id } = req.params;
    const { isPublic } = req.body as { isPublic: boolean };
    if (!id) return res.status(400).json({ error: "Missing tournament id" });
    if (typeof isPublic !== "boolean") return res.status(400).json({ error: "isPublic must be boolean" });
    try {
      const db = await getDb();
      const userId = (req as Request & { userId?: string }).userId;
      if (!userId) return res.status(401).json({ error: "Not authenticated" });
      // Verify ownership
      const utRows = await db
        .select()
        .from(userTournaments)
        .where(and(eq(userTournaments.tournamentId, id), eq(userTournaments.userId, userId)))
        .limit(1);
      if (utRows.length === 0) return res.status(403).json({ error: "Not the tournament owner" });
      await db
        .update(userTournaments)
        .set({ isPublic: isPublic ? 1 : 0 })
        .where(and(eq(userTournaments.tournamentId, id), eq(userTournaments.userId, userId)));
      res.json({ ok: true, isPublic });
    } catch (err) {
      logger.error("[public-toggle] PUT error:", err);
      res.status(500).json({ error: "Database error" });
    }
  });

  // ── Timer: PUT /api/tournament/:id/timer ───────────────────────────────────────
  // Director pushes a timer snapshot; server stores it and broadcasts via SSE.
  // When status is "running", schedules a server-side setTimeout to fire a
  // Web Push "Time's up!" notification at the exact expiry wall-clock time.
  // Pausing or resetting cancels any pending timeout.
  app.put("/api/tournament/:id/timer", validate(timerUpdateSchema), (req, res) => {
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
      } else {
        // Timer already expired (e.g. director refreshed after time ran out).
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
            logger.info(`[timer] 5-min warning push sent to ${rows.length} subscriber(s) for ${id}`);
          } catch (err) {
            logger.error("[timer] 5-min warning push error:", err);
          }
        }, warningDelayMs);
        timerWarningTimeouts.set(id, warnHandle);
        logger.info(`[timer] 5-min warning push scheduled in ${Math.round(warningDelayMs / 1000)}s for tournament ${id}`);
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
      res.json({ ok: true });
    } catch (err) {
      logger.error("[players] DELETE error:", err);
      res.status(500).json({ error: "Database error" });
    }
  });

  // ── Tournament: POST /api/tournament/:id/start ────────────────────────────
  // Called by the director when they click "Start Tournament".
  // Broadcasts a tournament_started SSE event to all connected player clients
  // so they can transition from the Lobby waiting screen to the My Board view.
  // Body: { round: number; games: Game[]; players: Player[] }
  app.post("/api/tournament/:id/start", async (req, res) => {
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
    // Broadcast SSE immediately so connected players transition right away
    broadcastTournamentStarted(id, { round, games, players });
    try {
      const db = await getDb();
      // 1. Immediately patch tournamentState so the polling fallback (/live-state)
      //    sees status=in_progress without waiting for the 1500ms director debounce.
      //    We merge only the known fields, preserving everything else already in the DB.
      const stateRows = await db
        .select({ stateJson: tournamentState.stateJson, revision: tournamentState.revision })
        .from(tournamentState)
        .where(eq(tournamentState.tournamentId, id))
        .limit(1);
      if (stateRows.length > 0) {
        const existing = JSON.parse(stateRows[0].stateJson) as Record<string, unknown>;
        const otherRounds = Array.isArray(existing.rounds)
          ? (existing.rounds as Array<{ number: number }>).filter((r) => r.number !== round)
          : [];
        const patched = {
          ...existing,
          status: "in_progress",
          currentRound: round,
          rounds: [...otherRounds, { number: round, status: "in_progress", games }],
          players,
        };
        await db
          .update(tournamentState)
          .set({
            stateJson: JSON.stringify(patched),
            updatedAt: new Date(),
            revision: (stateRows[0].revision ?? 0) + 1,
          })
          .where(eq(tournamentState.tournamentId, id));
      } else {
        // Row doesn't exist yet (director started before the 1500ms debounce fired).
        // Create it now so the polling fallback (/live-state) works immediately.
        const freshState = {
          status: "in_progress",
          currentRound: round,
          rounds: [{ number: round, status: "in_progress", games }],
          players,
        };
        await db.insert(tournamentState).values({
          tournamentId: id,
          stateJson: JSON.stringify(freshState),
          revision: 1,
        });
      }
      // 2. Record startedAt for 24h auto-expiry (only set once, on first start)
      await db
        .update(userTournaments)
        .set({ startedAt: new Date(), status: "in_progress" })
        .where(and(
          eq(userTournaments.tournamentId, id),
          isNull(userTournaments.startedAt)
        ));
    } catch (e) {
      logger.warn("[start] Failed to update tournament state/startedAt:", e);
    }
    res.json({ ok: true });
  });

  // ── Tournament: DELETE /api/tournament/:id ────────────────────────────────
  // Permanently deletes a tournament (owner-only).
  // Cascades: removes tournament_state, tournament_players, and userTournaments row.
  app.delete("/api/tournament/:id", requireAuth, async (req, res) => {
    const { id } = req.params;
    const userId = (req as Request & { userId?: string }).userId;
    if (!id) return res.status(400).json({ error: "Missing tournament id" });
    if (!userId) return res.status(401).json({ error: "Not authenticated" });
    try {
      const db = await getDb();
      const utRows = await db
        .select({ userId: userTournaments.userId })
        .from(userTournaments)
        .where(eq(userTournaments.tournamentId, id))
        .limit(1);
      if (utRows.length === 0) return res.status(404).json({ error: "Tournament not found" });
      if (utRows[0].userId !== userId) return res.status(403).json({ error: "Not the tournament owner" });
      await db.delete(tournamentPlayers).where(eq(tournamentPlayers.tournamentId, id));
      await db.delete(tournamentState).where(eq(tournamentState.tournamentId, id));
      await db.delete(userTournaments).where(eq(userTournaments.tournamentId, id));
      res.json({ ok: true });
    } catch (err) {
      logger.error("[delete] Tournament delete error:", err);
      res.status(500).json({ error: "Failed to delete tournament" });
    }
  });

  // ── Tournament: POST /api/tournament/:id/round ───────────────────────────────────────────────
  // Called by the director when they generate the next round's pairings.
  // Broadcasts a round_started SSE event to all connected player clients so
  // their My Board screens automatically refresh to the new board assignment.
  // Body: { round: number; games: Game[]; players: Player[] }
  app.post("/api/tournament/:id/round", (req, res) => {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: "Missing tournament id" });
    const { round, games, players, elimPhase, elimPlayers } = req.body as {
      round: number;
      games: unknown[];
      players: unknown[];
      elimPhase?: string;
      elimPlayers?: unknown[];
    };
    if (!round || !games || !players) {
      return res.status(400).json({ error: "Missing round, games, or players" });
    }
    const subs = sseSubscribers.get(id);
    if (subs && subs.size > 0) {
      const data = `event: round_started\ndata: ${JSON.stringify({ round, games, players, elimPhase: elimPhase ?? null, elimPlayers: elimPlayers ?? [] })}\n\n`;
      for (const sub of Array.from(subs)) {
        try { sub.write(data); } catch { /* disconnected */ }
      }
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
    }
    res.json({ ok: true });
  });

  // ─── Board Broadcast Settings ────────────────────────────────────────────────
  // GET /api/tournament/:id/broadcast — load broadcast settings
  app.get("/api/tournament/:id/broadcast", async (req, res) => {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: "Missing tournament id" });
    try {
      const db = await getDb();
      const rows = await db
        .select()
        .from(tournamentBroadcastSettings)
        .where(eq(tournamentBroadcastSettings.tournamentId, id))
        .limit(1);
      if (rows.length === 0) {
        return res.json({
          broadcastEnabled: false,
          broadcastUrl: null,
          broadcastProvider: null,
          featuredBoardNumber: 1,
          broadcastTitle: null,
          broadcastStatus: "inactive",
        });
      }
      const r = rows[0];
      res.json({
        broadcastEnabled: !!r.broadcastEnabled,
        broadcastUrl: r.broadcastUrl,
        broadcastProvider: r.broadcastProvider,
        featuredBoardNumber: r.featuredBoardNumber,
        broadcastTitle: r.broadcastTitle,
        broadcastStatus: r.broadcastStatus,
      });
    } catch (err) {
      logger.error("[broadcast] GET error:", err);
      res.status(500).json({ error: "Database error" });
    }
  });

  // PUT /api/tournament/:id/broadcast — save broadcast settings (host only)
  app.put("/api/tournament/:id/broadcast", requireAuth, validate(broadcastSchema), async (req, res) => {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: "Missing tournament id" });
    const { broadcastEnabled, broadcastUrl, broadcastProvider, featuredBoardNumber, broadcastTitle, broadcastStatus } = req.body;
    const userId = (req as Request & { userId?: string }).userId;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });
    try {
      const db = await getDb();
      // Verify ownership
      const utRows = await db
        .select()
        .from(userTournaments)
        .where(and(eq(userTournaments.tournamentId, id), eq(userTournaments.userId, userId)))
        .limit(1);
      if (utRows.length === 0) return res.status(403).json({ error: "Not authorized" });

      // Upsert
      const existing = await db
        .select({ tournamentId: tournamentBroadcastSettings.tournamentId })
        .from(tournamentBroadcastSettings)
        .where(eq(tournamentBroadcastSettings.tournamentId, id));
      const values: typeof tournamentBroadcastSettings.$inferInsert = {
        tournamentId: id,
        broadcastEnabled: broadcastEnabled ? 1 : 0,
        broadcastUrl: broadcastUrl || null,
        broadcastProvider: broadcastProvider || null,
        featuredBoardNumber: featuredBoardNumber ?? 1,
        broadcastTitle: broadcastTitle || null,
        broadcastStatus: broadcastStatus || "inactive",
        updatedAt: new Date(),
      };
      if (existing.length > 0) {
        await db.update(tournamentBroadcastSettings).set(values).where(eq(tournamentBroadcastSettings.tournamentId, id));
      } else {
        await db.insert(tournamentBroadcastSettings).values(values);
      }
      // Invalidate public snapshot so viewers see broadcast immediately
      invalidateSnapshotCache(id);
      res.json({ ok: true });
    } catch (err) {
      logger.error("[broadcast] PUT error:", err);
      res.status(500).json({ error: "Database error" });
    }
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
      logger.error("[battles] create error:", err);
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
      logger.error("[battles] get error:", err);
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
      logger.error("[battles] join error:", err);
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
      logger.error("[battles] history error:", err);
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
      logger.error("[race] update error:", err);
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
      logger.error("[battles] result error:", err);
      res.status(500).json({ error: "Failed to report result" });
    }
  });

  // PATCH /api/battles/:code/pgn — Save PGN from Live Notation Mode (host or guest)
  app.patch("/api/battles/:code/pgn", requireAuth, async (req, res) => {
    const { battleRooms } = await import("../shared/schema.js");
    const userId = (req as import("express").Request & { userId: string }).userId;
    if (!userId) return res.status(401).json({ error: "Authentication required" });
    const { pgn } = req.body as { pgn: string };
    if (typeof pgn !== "string" || pgn.length === 0) return res.status(400).json({ error: "PGN is required" });
    if (pgn.length > 50_000) return res.status(400).json({ error: "PGN too large" });
    try {
      const db = await getDb();
      const rows = await db.select().from(battleRooms).where(eq(battleRooms.code, req.params.code.toUpperCase())).limit(1);
      if (rows.length === 0) return res.status(404).json({ error: "Battle room not found" });
      const room = rows[0];
      if (room.hostId !== userId && room.guestId !== userId) {
        return res.status(403).json({ error: "Only battle participants can save PGN" });
      }
      await db.update(battleRooms).set({ pgn }).where(eq(battleRooms.code, req.params.code.toUpperCase()));
      res.json({ ok: true });
    } catch (err) {
      logger.error("[battles] pgn save error:", err);
      res.status(500).json({ error: "Failed to save PGN" });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TOURNAMENT RECAP ENDPOINTS
  // ═══════════════════════════════════════════════════════════════════════════

  // GET /api/recap/:slug — Public endpoint, returns recap data for a published recap
  app.get("/api/recap/:slug", async (req, res) => {
    try {
      const db = await getDb();
      const { tournamentRecaps } = await import("../shared/schema.js");
      const rows = await db
        .select()
        .from(tournamentRecaps)
        .where(eq(tournamentRecaps.slug, req.params.slug))
        .limit(1);
      if (rows.length === 0) {
        return res.status(404).json({ error: "Recap not found" });
      }
      const recap = rows[0];
      // Only return published recaps to public viewers (drafts require auth)
      if (recap.status === "draft") {
        // Check if requester is the host (authenticated)
        const authHeader = req.headers.authorization;
        if (!authHeader) {
          return res.status(404).json({ error: "Recap not found" });
        }
      }
      res.json(recap);
    } catch (err) {
      logger.error("[recap] GET error:", err);
      res.status(500).json({ error: "Failed to fetch recap" });
    }
  });

  // POST /api/recap — Create or update a tournament recap (host only)
  app.post("/api/recap", requireAuth, async (req, res) => {
    try {
      const db = await getDb();
      const { tournamentRecaps } = await import("../shared/schema.js");
      const { nanoid } = await import("nanoid");
      const body = req.body as Partial<typeof tournamentRecaps.$inferInsert>;
      const userId = (req as Request & { userId?: string }).userId;
      if (!userId) return res.status(401).json({ error: "Not authenticated" });
      if (!body.tournamentId) {
        return res.status(400).json({ error: "tournamentId is required" });
      }
      const owner = await db
        .select({ userId: userTournaments.userId })
        .from(userTournaments)
        .where(and(eq(userTournaments.tournamentId, body.tournamentId), eq(userTournaments.userId, userId)))
        .limit(1);
      if (owner.length === 0) return res.status(403).json({ error: "Not the tournament owner" });
      // Check if recap already exists for this tournament
      const existing = await db
        .select()
        .from(tournamentRecaps)
        .where(eq(tournamentRecaps.tournamentId, body.tournamentId))
        .limit(1);
      if (existing.length > 0) {
        // Update existing recap
        await db.update(tournamentRecaps).set({
          status: body.status || existing[0].status,
          publishedAt: body.status === "published" ? new Date() : existing[0].publishedAt,
          heroImageUrl: body.heroImageUrl ?? existing[0].heroImageUrl,
          summaryText: body.summaryText ?? existing[0].summaryText,
          championsJson: body.championsJson ?? existing[0].championsJson,
          sectionsJson: body.sectionsJson ?? existing[0].sectionsJson,
          highlightsJson: body.highlightsJson ?? existing[0].highlightsJson,
          sponsorNote: body.sponsorNote ?? existing[0].sponsorNote,
          venueNote: body.venueNote ?? existing[0].venueNote,
          customNote: body.customNote ?? existing[0].customNote,
          privacyMode: body.privacyMode ?? existing[0].privacyMode,
        }).where(eq(tournamentRecaps.tournamentId, body.tournamentId));
        const updated = await db.select().from(tournamentRecaps).where(eq(tournamentRecaps.tournamentId, body.tournamentId)).limit(1);
        return res.json(updated[0]);
      }
      // Create new recap
      const slug = body.slug || `${(body.tournamentName || "tournament").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60)}-${nanoid(6)}`;
      const id = nanoid(12);
      await db.insert(tournamentRecaps).values({
        id,
        tournamentId: body.tournamentId,
        slug,
        status: body.status || "draft",
        publishedAt: body.status === "published" ? new Date() : null,
        heroImageUrl: body.heroImageUrl || null,
        summaryText: body.summaryText || null,
        tournamentName: body.tournamentName || null,
        venue: body.venue || null,
        eventDate: body.eventDate || null,
        hostName: body.hostName || null,
        clubId: body.clubId || null,
        format: body.format || "quads",
        playerCount: body.playerCount || null,
        sectionCount: body.sectionCount || null,
        timeControl: body.timeControl || null,
        championsJson: body.championsJson || null,
        sectionsJson: body.sectionsJson || null,
        highlightsJson: body.highlightsJson || null,
        sponsorNote: body.sponsorNote || null,
        venueNote: body.venueNote || null,
        customNote: body.customNote || null,
        privacyMode: body.privacyMode || "standard",
      });
      const created = await db.select().from(tournamentRecaps).where(eq(tournamentRecaps.id, id)).limit(1);
      res.status(201).json(created[0]);
    } catch (err) {
      logger.error("[recap] POST error:", err);
      res.status(500).json({ error: "Failed to save recap" });
    }
  });

  // GET /api/player/:playerId/achievements — Public endpoint for player badges
  app.get("/api/player/:playerId/achievements", async (req, res) => {
    try {
      const db = await getDb();
      const { playerAchievements } = await import("../shared/schema.js");
      const achievements = await db
        .select()
        .from(playerAchievements)
        .where(eq(playerAchievements.playerId, req.params.playerId));
      res.json(achievements);
    } catch (err) {
      logger.error("[achievements] GET error:", err);
      res.status(500).json({ error: "Failed to fetch achievements" });
    }
  });

  // POST /api/player/achievements — Batch create achievements (host only)
  app.post("/api/player/achievements", requireAuth, async (req, res) => {
    try {
      const db = await getDb();
      const { playerAchievements } = await import("../shared/schema.js");
      const { nanoid } = await import("nanoid");
      type AchievementInput = Omit<typeof playerAchievements.$inferInsert, "id" | "earnedAt">;
      const { achievements } = req.body as { achievements?: AchievementInput[] };
      if (!Array.isArray(achievements) || achievements.length === 0) {
        return res.status(400).json({ error: "achievements array is required" });
      }
      const values = achievements.map((a) => ({
        id: nanoid(12),
        playerId: a.playerId,
        tournamentId: a.tournamentId,
        sectionId: a.sectionId || null,
        achievementType: a.achievementType,
        title: a.title,
        description: a.description || null,
        tournamentName: a.tournamentName || null,
        visibility: a.visibility || "public",
      }));
      await db.insert(playerAchievements).values(values);
      res.status(201).json({ created: values.length });
    } catch (err) {
      logger.error("[achievements] POST error:", err);
      res.status(500).json({ error: "Failed to create achievements" });
    }
  });

  // GET /api/club/:clubId/recaps — Get all published recaps for a club
  app.get("/api/club/:clubId/recaps", async (req, res) => {
    try {
      const db = await getDb();
      const { tournamentRecaps } = await import("../shared/schema.js");
      const recaps = await db
        .select()
        .from(tournamentRecaps)
        .where(and(
          eq(tournamentRecaps.clubId, req.params.clubId),
          eq(tournamentRecaps.status, "published")
        ));
      res.json(recaps);
    } catch (err) {
      logger.error("[club-recaps] GET error:", err);
      res.status(500).json({ error: "Failed to fetch club recaps" });
    }
  });

  // Must remain after every API route so next(err) from any route is normalized.
  app.use(globalErrorHandler);
  return app;
}

// ─── Production entry point ───────────────────────────────────────────────────
// Only runs when executed directly (not when imported by vite.config.ts).
async function startServer() {
  const app = createApp();
  const server = createServer(app);

  // Start the CV job queue background worker
  _startCvJobQueue();

  // ── 24h Auto-Expiry Job ────────────────────────────────────────────────────
  // Every 30 minutes, mark any in_progress tournament whose startedAt is
  // older than 24 hours as completed. This prevents stale "live" tournaments
  // from accumulating in the database (especially Quickstart events).
  const EXPIRY_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
  const EXPIRY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
  async function runAutoExpiry() {
    try {
      const db = await getDb();
      const cutoff = new Date(Date.now() - EXPIRY_TTL_MS);
      const expired = await db
        .select({ tournamentId: userTournaments.tournamentId })
        .from(userTournaments)
        .where(and(
          eq(userTournaments.status, "in_progress"),
          lt(userTournaments.startedAt, cutoff)
        ));
      if (expired.length === 0) return;
      for (const { tournamentId } of expired) {
        await db
          .update(userTournaments)
          .set({ status: "completed" })
          .where(eq(userTournaments.tournamentId, tournamentId));
        // Broadcast tournament_ended SSE so any still-connected clients transition
        const subs = sseSubscribers.get(tournamentId);
        if (subs && subs.size > 0) {
          const data = `event: tournament_ended\ndata: ${JSON.stringify({ autoExpired: true, tournamentName: "Tournament" })}\n\n`;
          for (const sub of Array.from(subs)) {
            try { sub.write(data); } catch { /* disconnected */ }
          }
        }
      }
    } catch (err) {
      logger.error("[auto-expiry] Error:", err);
    }
  }
  // Run once at startup, then every 30 minutes
  runAutoExpiry();
  setInterval(runAutoExpiry, EXPIRY_INTERVAL_MS);

  // ── Push Subscription Cleanup Job ─────────────────────────────────────────
  // Delete push_subscriptions rows older than 90 days. Subscriptions that old
  // are almost certainly expired browser sessions and will only produce 410/404
  // errors on the next send attempt. Running this daily keeps the table lean.
  const PUSH_SUB_TTL_DAYS = 90;
  const PUSH_SUB_CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
  async function purgeExpiredSubscriptions() {
    try {
      const db = await getDb();
      const cutoff = new Date(Date.now() - PUSH_SUB_TTL_DAYS * 24 * 60 * 60 * 1000);
      const result = await db
        .delete(pushSubscriptions)
        .where(lt(pushSubscriptions.createdAt, cutoff));
      const deleted = (result as unknown as { rowsAffected?: number })?.rowsAffected ?? 0;
      if (deleted > 0) {
        logger.info(`[push-cleanup] Purged ${deleted} expired push subscription(s) older than ${PUSH_SUB_TTL_DAYS} days.`);
      }
    } catch (err) {
      logger.error("[push-cleanup] Error purging expired subscriptions:", err);
    }
  }
  // Run once at startup (non-blocking), then every 24 hours
  purgeExpiredSubscriptions();
  setInterval(purgeExpiredSubscriptions, PUSH_SUB_CLEANUP_INTERVAL_MS);

  // Serve static files from dist/public in production
  const staticPath =
    process.env.NODE_ENV === "production"
      ? path.resolve(__dirname, "public")
      : path.resolve(__dirname, "..", "dist", "public");

  // Hashed JS/CSS assets get long-lived immutable caching; HTML always revalidates.
  app.use(express.static(staticPath, {
    setHeaders(res, filePath) {
      if (filePath.endsWith(".html")) {
        // Always revalidate HTML so browsers pick up new asset hashes after deploy
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");
      } else if (/\.[0-9a-f]{8,}\.(js|css)$/.test(filePath)) {
        // Content-hashed assets are immutable — safe to cache for 1 year
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      }
    },
  }));

  // Handle client-side routing - serve index.html for all routes
  app.get("*", (_req, res) => {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.sendFile(path.join(staticPath, "index.html"));
  });

  const port = process.env.PORT || 3000;
  server.listen(port, () => {
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
  startServer().catch((err) => logger.error('[server] Fatal startup error:', err));
}

// Global error handlers — prevent silent crashes in production
process.on('unhandledRejection', (reason) => {
  logger.error('[process] Unhandled promise rejection:', reason);
});
process.on('uncaughtException', (err) => {
  logger.error('[process] Uncaught exception:', err);
  // Give the logger time to flush before exiting
  setTimeout(() => process.exit(1), 500);
});
import { globalErrorHandler, requestCorrelation } from "./errorHandler.js";
