/**
 * OTB Chess — Authentication API Routes
 *
 * Endpoints:
 *  POST /api/auth/register  — create account, return JWT
 *  POST /api/auth/login     — verify credentials, return JWT
 *  POST /api/auth/logout    — clear httpOnly cookie
 *  GET  /api/auth/me        — return current user from JWT
 *  PATCH /api/auth/me       — update profile fields
 *
 * Auth strategy: JWT stored in an httpOnly cookie (token) + returned in the
 * response body so the client can also store it in memory for SPA use.
 * The cookie provides CSRF-safe persistence; the in-memory copy avoids
 * CORS issues on the same origin.
 */

import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { nanoid, nanoid as nid } from "nanoid";
import { eq } from "drizzle-orm";
import { getDb } from "./db.js";
import { users, userTournaments } from "../shared/schema.js";

const BCRYPT_ROUNDS = 12;
const JWT_EXPIRY_DEFAULT = "7d";
const JWT_EXPIRY_REMEMBER = "30d";
const COOKIE_MAX_AGE_DEFAULT_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const COOKIE_MAX_AGE_REMEMBER_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET env var is not set");
  return secret;
}

const JWT_EXPIRY_GUEST = "24h";
const COOKIE_MAX_AGE_GUEST_MS = 24 * 60 * 60 * 1000; // 24 hours

function signToken(userId: string, remember = false, isGuest = false): string {
  return jwt.sign(
    { sub: userId, ...(isGuest ? { isGuest: true } : {}) },
    getJwtSecret(),
    { expiresIn: isGuest ? JWT_EXPIRY_GUEST : remember ? JWT_EXPIRY_REMEMBER : JWT_EXPIRY_DEFAULT }
  );
}

function verifyToken(token: string): { sub: string; isGuest?: boolean } | null {
  try {
    const payload = jwt.verify(token, getJwtSecret()) as { sub: string; isGuest?: boolean };
    return payload;
  } catch {
    return null;
  }
}

/** Strip the password hash before sending user data to the client. */
function safeUser(user: typeof users.$inferSelect) {
  const { passwordHash: _, ...safe } = user;
  return safe;
}

// ─── Middleware: requireAuth ──────────────────────────────────────────────────
// Accepts both full-account JWTs and guest JWTs.
// Sets req.userId and req.isGuest on the request object.
export function requireAuth(
  req: import("express").Request,
  res: import("express").Response,
  next: import("express").NextFunction
) {
  const cookieToken = req.cookies?.token as string | undefined;
  const headerToken = (req.headers.authorization ?? "").replace("Bearer ", "");
  const raw = cookieToken || headerToken;
  if (!raw) return res.status(401).json({ error: "Not authenticated" });
  const payload = verifyToken(raw);
  if (!payload) return res.status(401).json({ error: "Invalid or expired token" });
  const r = req as import("express").Request & { userId: string; isGuest: boolean };
  r.userId = payload.sub;
  r.isGuest = payload.isGuest === true;
  next();
}

// ─── Middleware: requireFullAuth ──────────────────────────────────────────────
// Like requireAuth but additionally rejects guest JWTs.
// Use on routes that require a full registered account (host battle, profile edit, etc.).
export function requireFullAuth(
  req: import("express").Request,
  res: import("express").Response,
  next: import("express").NextFunction
) {
  const cookieToken = req.cookies?.token as string | undefined;
  const headerToken = (req.headers.authorization ?? "").replace("Bearer ", "");
  const raw = cookieToken || headerToken;
  if (!raw) return res.status(401).json({ error: "Not authenticated" });
  const payload = verifyToken(raw);
  if (!payload) return res.status(401).json({ error: "Invalid or expired token" });
  if (payload.isGuest) return res.status(403).json({ error: "Guest accounts cannot perform this action. Please create a free account.", code: "GUEST_FORBIDDEN" });
  const r = req as import("express").Request & { userId: string; isGuest: boolean };
  r.userId = payload.sub;
  r.isGuest = false;
  next();
}

// ─── Router ───────────────────────────────────────────────────────────────────
export function createAuthRouter(): Router {
  const router = Router();

  // ── POST /api/auth/register ──────────────────────────────────────────────
  router.post("/register", async (req, res) => {
    const { email, password, displayName, chesscomUsername, lichessUsername } =
      req.body as {
        email: string;
        password: string;
        displayName: string;
        chesscomUsername?: string;
        lichessUsername?: string;
      };

    if (!email || !password || !displayName) {
      return res.status(400).json({ error: "email, password, and displayName are required" });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "Invalid email address" });
    }

    try {
      const db = await getDb();

      // Check for existing account
      const existing = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email.toLowerCase().trim()));
      if (existing.length > 0) {
        return res.status(409).json({ error: "An account with this email already exists" });
      }

      // Hash password and create user
      const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
      const id = nanoid();
      await db.insert(users).values({
        id,
        email: email.toLowerCase().trim(),
        passwordHash,
        displayName: displayName.trim(),
        chesscomUsername: chesscomUsername?.toLowerCase().trim() || null,
        lichessUsername: lichessUsername?.toLowerCase().trim() || null,
      });

      // Fetch the created user
      const [user] = await db.select().from(users).where(eq(users.id, id));

      const token = signToken(id);
      res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: COOKIE_MAX_AGE_DEFAULT_MS,
      });

      return res.status(201).json({ user: safeUser(user), token });
    } catch (err) {
      console.error("[auth] register error:", err);
      return res.status(500).json({ error: "Registration failed" });
    }
  });

  // ── POST /api/auth/login ─────────────────────────────────────────────────
  router.post("/login", async (req, res) => {
    const { email, password, remember } = req.body as { email: string; password: string; remember?: boolean };

    if (!email || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }

    try {
      const db = await getDb();
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, email.toLowerCase().trim()));

      if (!user) {
        // Use constant-time comparison to avoid timing attacks
        await bcrypt.compare(password, "$2b$12$invalidhashfortimingprotection00000000000000000000");
        return res.status(401).json({ error: "Invalid email or password" });
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      const rememberMe = Boolean(remember);
      const token = signToken(user.id, rememberMe);
      res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: rememberMe ? COOKIE_MAX_AGE_REMEMBER_MS : COOKIE_MAX_AGE_DEFAULT_MS,
      });

      return res.json({ user: safeUser(user), token });
    } catch (err) {
      console.error("[auth] login error:", err);
      return res.status(500).json({ error: "Login failed" });
    }
  });

  // ── POST /api/auth/logout ────────────────────────────────────────────────
  router.post("/logout", (_req, res) => {
    res.clearCookie("token", { httpOnly: true, sameSite: "lax" });
    return res.json({ ok: true });
  });

  // ── POST /api/auth/guest ─────────────────────────────────────────────────
  // Creates an ephemeral guest user row and returns a 24-hour JWT.
  // Guest users can join battles but cannot host, edit profiles, or
  // access any route guarded by requireFullAuth.
  router.post("/guest", async (req, res) => {
    const { displayName } = req.body as { displayName?: string };
    const rawName = (displayName ?? "").trim();
    if (!rawName || rawName.length < 2) {
      return res.status(400).json({ error: "Display name must be at least 2 characters" });
    }
    if (rawName.length > 30) {
      return res.status(400).json({ error: "Display name must be 30 characters or fewer" });
    }
    try {
      const db = await getDb();
      const id = nanoid();
      // Guest rows use a synthetic email that can never be used to log in
      const guestEmail = `guest_${id}@otbchess.guest`;
      await db.insert(users).values({
        id,
        email: guestEmail,
        passwordHash: "", // guests have no password
        displayName: rawName,
        isGuest: true,
      });
      const [user] = await db.select().from(users).where(eq(users.id, id));
      const token = signToken(id, false, true);
      res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: COOKIE_MAX_AGE_GUEST_MS,
      });
      console.log(`[auth] Guest session created: ${rawName} (${id})`);
      return res.status(201).json({ user: safeUser(user), token });
    } catch (err) {
      console.error("[auth] guest error:", err);
      return res.status(500).json({ error: "Failed to create guest session" });
    }
  });

  // ── GET /api/auth/me ─────────────────────────────────────────────────────
  router.get("/me", async (req, res) => {
    const cookieToken = req.cookies?.token as string | undefined;
    const headerToken = (req.headers.authorization ?? "").replace("Bearer ", "");
    const raw = cookieToken || headerToken;
    if (!raw) return res.status(401).json({ error: "Not authenticated" });

    const payload = verifyToken(raw);
    if (!payload) return res.status(401).json({ error: "Invalid or expired token" });

    try {
      const db = await getDb();
      const [user] = await db.select().from(users).where(eq(users.id, payload.sub));
      if (!user) return res.status(401).json({ error: "User not found" });
      return res.json({ user: safeUser(user) });
    } catch (err) {
      console.error("[auth] me error:", err);
      return res.status(500).json({ error: "Failed to fetch user" });
    }
  });

  // ── PATCH /api/auth/me ───────────────────────────────────────────────────
  router.patch("/me", async (req, res) => {
    const cookieToken = req.cookies?.token as string | undefined;
    const headerToken = (req.headers.authorization ?? "").replace("Bearer ", "");
    const raw = cookieToken || headerToken;
    if (!raw) return res.status(401).json({ error: "Not authenticated" });

    const payload = verifyToken(raw);
    if (!payload) return res.status(401).json({ error: "Invalid or expired token" });

    const {
      displayName,
      chesscomUsername,
      lichessUsername,
      avatarUrl,
      fideId,
    } = req.body as {
      displayName?: string;
      chesscomUsername?: string;
      lichessUsername?: string;
      avatarUrl?: string;
      fideId?: string;
    };

    try {
      const db = await getDb();

      // Build update object with only provided fields
      const updateData: Partial<typeof users.$inferInsert> = {
        updatedAt: new Date(),
      };
      if (displayName !== undefined) updateData.displayName = displayName.trim();
      if (chesscomUsername !== undefined)
        updateData.chesscomUsername = chesscomUsername.toLowerCase().trim() || null;
      if (lichessUsername !== undefined)
        updateData.lichessUsername = lichessUsername.toLowerCase().trim() || null;
      if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl || null;
      if (fideId !== undefined) updateData.fideId = fideId.trim() || null;

      // If chess.com username changed, fetch fresh ELO + avatar
      if (chesscomUsername && chesscomUsername.trim()) {
        try {
          const key = chesscomUsername.toLowerCase().trim();
          const ccHeaders = { "User-Agent": "OTBChess/1.0 (https://chessotb.club)" };
          const [profileRes, statsRes] = await Promise.all([
            fetch(`https://api.chess.com/pub/player/${key}`, { headers: ccHeaders }),
            fetch(`https://api.chess.com/pub/player/${key}/stats`, { headers: ccHeaders }),
          ]);
          // Auto-populate avatarUrl from chess.com if user hasn't set a custom one
          if (profileRes.ok) {
            const profile = await profileRes.json() as Record<string, unknown>;
            if (!avatarUrl && typeof profile.avatar === "string" && profile.avatar) {
              updateData.avatarUrl = profile.avatar;
            }
          }
          if (statsRes.ok) {
            const stats = await statsRes.json() as Record<string, unknown>;
            const rapid = (stats.chess_rapid as Record<string, unknown> | undefined)?.last as Record<string, unknown> | undefined;
            const blitz = (stats.chess_blitz as Record<string, unknown> | undefined)?.last as Record<string, unknown> | undefined;
            const bullet = (stats.chess_bullet as Record<string, unknown> | undefined)?.last as Record<string, unknown> | undefined;
            const rapidRating = rapid?.rating as number | undefined;
            const blitzRating = blitz?.rating as number | undefined;
            const bulletRating = bullet?.rating as number | undefined;
            const elo = (rapidRating ?? blitzRating ?? bulletRating);
            if (elo) updateData.chesscomElo = elo;
            // Snapshot current values as "previous" before overwriting
            const [currentUser] = await db.select().from(users).where(eq(users.id, payload.sub));
            if (rapidRating) {
              if (currentUser?.chesscomRapid && currentUser.chesscomRapid !== rapidRating) {
                updateData.chesscomPrevRapid = currentUser.chesscomRapid;
              }
              updateData.chesscomRapid = rapidRating;
            }
            if (blitzRating) {
              if (currentUser?.chesscomBlitz && currentUser.chesscomBlitz !== blitzRating) {
                updateData.chesscomPrevBlitz = currentUser.chesscomBlitz;
              }
              updateData.chesscomBlitz = blitzRating;
            }
            if (bulletRating) {
              if (currentUser?.chesscomBullet && currentUser.chesscomBullet !== bulletRating) {
                updateData.chesscomPrevBullet = currentUser.chesscomBullet;
              }
              updateData.chesscomBullet = bulletRating;
            }
          }
        } catch {
          // chess.com fetch failed — don't block the profile save
        }
      }

      await db.update(users).set(updateData).where(eq(users.id, payload.sub));
      const [updated] = await db.select().from(users).where(eq(users.id, payload.sub));
      return res.json({ user: safeUser(updated) });
    } catch (err) {
      console.error("[auth] patch me error:", err);
      return res.status(500).json({ error: "Failed to update profile" });
    }
  });

  // ── GET /api/user/tournaments ────────────────────────────────────────────────
  // Returns all tournaments created by the authenticated user (cross-device history).
  router.get("/user/tournaments", async (req, res) => {
    const cookieToken = req.cookies?.token as string | undefined;
    const headerToken = (req.headers.authorization ?? "").replace("Bearer ", "");
    const raw = cookieToken || headerToken;
    if (!raw) return res.status(401).json({ error: "Not authenticated" });

    const payload = verifyToken(raw);
    if (!payload) return res.status(401).json({ error: "Invalid or expired token" });

    try {
      const db = await getDb();
      const rows = await db
        .select()
        .from(userTournaments)
        .where(eq(userTournaments.userId, payload.sub))
        .orderBy(userTournaments.createdAt);
      return res.json({ tournaments: rows });
    } catch (err) {
      console.error("[auth] get user tournaments error:", err);
      return res.status(500).json({ error: "Failed to fetch tournaments" });
    }
  });

  // ── POST /api/user/tournaments ───────────────────────────────────────────────
  // Records a tournament as created by the authenticated user.
  router.post("/user/tournaments", async (req, res) => {
    const cookieToken = req.cookies?.token as string | undefined;
    const headerToken = (req.headers.authorization ?? "").replace("Bearer ", "");
    const raw = cookieToken || headerToken;
    if (!raw) return res.status(401).json({ error: "Not authenticated" });

    const payload = verifyToken(raw);
    if (!payload) return res.status(401).json({ error: "Invalid or expired token" });

    const { tournamentId, name, venue, date, format, rounds, inviteCode, status } = req.body as {
      tournamentId: string;
      name: string;
      venue?: string;
      date?: string;
      format?: string;
      rounds?: number;
      inviteCode?: string;
      status?: string;
    };

    if (!tournamentId || !name) {
      return res.status(400).json({ error: "tournamentId and name are required" });
    }

    try {
      const db = await getDb();
      // Upsert: if the same user already has this tournament, skip insert
      const existing = await db
        .select()
        .from(userTournaments)
        .where(eq(userTournaments.tournamentId, tournamentId))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(userTournaments).values({
          id: nid(),
          userId: payload.sub,
          tournamentId,
          name,
          venue: venue ?? null,
          date: date ?? null,
          format: format ?? null,
          rounds: rounds ?? null,
          inviteCode: inviteCode ?? null,
          status: status ?? "registration",
        });
      } else if (status) {
        // Update status if the tournament already exists
        await db
          .update(userTournaments)
          .set({ status })
          .where(eq(userTournaments.tournamentId, tournamentId));
      }

      return res.json({ ok: true });
    } catch (err) {
      console.error("[auth] post user tournaments error:", err);
      return res.status(500).json({ error: "Failed to save tournament" });
    }
  });

  // ── DELETE /api/auth/user/tournaments/:tournamentId ─────────────────────
  // Removes a tournament from the authenticated user's list.
  // Only the owner can delete their own tournament record.
  router.delete("/user/tournaments/:tournamentId", async (req, res) => {
    const cookieToken = req.cookies?.token as string | undefined;
    const headerToken = (req.headers.authorization ?? "").replace("Bearer ", "");
    const raw = cookieToken || headerToken;
    if (!raw) return res.status(401).json({ error: "Not authenticated" });
    const payload = verifyToken(raw);
    if (!payload) return res.status(401).json({ error: "Invalid or expired token" });
    const { tournamentId } = req.params;
    if (!tournamentId) return res.status(400).json({ error: "tournamentId is required" });
    try {
      const db = await getDb();
      // Verify ownership before deleting
      const existing = await db
        .select({ id: userTournaments.id, userId: userTournaments.userId })
        .from(userTournaments)
        .where(eq(userTournaments.tournamentId, tournamentId))
        .limit(1);
      if (existing.length === 0) {
        return res.status(404).json({ error: "Tournament not found" });
      }
      if (existing[0].userId !== payload.sub) {
        return res.status(403).json({ error: "Not authorised to delete this tournament" });
      }
      await db
        .delete(userTournaments)
        .where(eq(userTournaments.tournamentId, tournamentId));
      console.log(`[auth] Tournament ${tournamentId} deleted by user ${payload.sub}`);
      return res.json({ ok: true });
    } catch (err) {
      console.error("[auth] delete user tournament error:", err);
      return res.status(500).json({ error: "Failed to delete tournament" });
    }
  });

  // ── PATCH /api/user/tournaments/:tournamentId/custom-slug ──────────────────
  // Saves or updates the host-chosen custom short URL slug for a tournament.
  // Only the tournament owner may change the slug.
  router.patch("/user/tournaments/:tournamentId/custom-slug", async (req, res) => {
    const cookieToken = req.cookies?.token as string | undefined;
    const headerToken = (req.headers.authorization ?? "").replace("Bearer ", "");
    const raw = cookieToken || headerToken;
    if (!raw) return res.status(401).json({ error: "Not authenticated" });
    const payload = verifyToken(raw);
    if (!payload) return res.status(401).json({ error: "Invalid or expired token" });
    const { tournamentId } = req.params;
    const { customSlug } = req.body as { customSlug?: string };
    if (!tournamentId) return res.status(400).json({ error: "tournamentId is required" });
    // Sanitise: letters, numbers, hyphens, underscores only, max 80 chars
    const slug = (customSlug ?? "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
    try {
      const db = await getDb();
      // Verify ownership
      const existing = await db
        .select({ id: userTournaments.id, userId: userTournaments.userId })
        .from(userTournaments)
        .where(eq(userTournaments.tournamentId, tournamentId))
        .limit(1);
      if (existing.length === 0) return res.status(404).json({ error: "Tournament not found" });
      if (existing[0].userId !== payload.sub) return res.status(403).json({ error: "Not authorised" });
      await db
        .update(userTournaments)
        .set({ customSlug: slug || null })
        .where(eq(userTournaments.tournamentId, tournamentId));
      return res.json({ ok: true, customSlug: slug || null });
    } catch (err) {
      console.error("[auth] patch custom-slug error:", err);
      return res.status(500).json({ error: "Failed to update custom slug" });
    }
  });

  // ── GET /api/join/resolve/:codeOrSlug ──────────────────────────────────────
  // Public endpoint: resolves a tournament by its inviteCode OR customSlug.
  // Called by the Join page on Android/fresh devices when localStorage is empty
  // and there is no ?t= param in the URL (e.g. someone shared the short URL).
  // Returns enough metadata to bootstrap the tournament registry client-side.
  router.get("/join/resolve/:codeOrSlug", async (req, res) => {
    const { codeOrSlug } = req.params;
    if (!codeOrSlug) return res.status(400).json({ error: "codeOrSlug is required" });
    try {
      const db = await getDb();
      const { or, eq: eqOp } = await import("drizzle-orm");
      const rows = await db
        .select({
          tournamentId: userTournaments.tournamentId,
          name: userTournaments.name,
          venue: userTournaments.venue,
          format: userTournaments.format,
          rounds: userTournaments.rounds,
          inviteCode: userTournaments.inviteCode,
          customSlug: userTournaments.customSlug,
        })
        .from(userTournaments)
        .where(
          or(
            eqOp(userTournaments.inviteCode, codeOrSlug.toUpperCase()),
            eqOp(userTournaments.customSlug, codeOrSlug)
          )
        )
        .limit(1);
      if (rows.length === 0) return res.status(404).json({ error: "Tournament not found" });
      return res.json(rows[0]);
    } catch (err) {
      console.error("[auth] join resolve error:", err);
      return res.status(500).json({ error: "Failed to resolve tournament" });
    }
  });

  // ── GET /api/tournament/:tournamentId/meta ────────────────────────────────
  // Public endpoint: returns lightweight tournament metadata including customSlug.
  // Used by clients on any device to hydrate localStorage with the latest slug.
  router.get("/tournament/:tournamentId/meta", async (req, res) => {
    const { tournamentId } = req.params;
    if (!tournamentId) return res.status(400).json({ error: "tournamentId is required" });
    try {
      const db = await getDb();
      const rows = await db
        .select({
          tournamentId: userTournaments.tournamentId,
          name: userTournaments.name,
          customSlug: userTournaments.customSlug,
          inviteCode: userTournaments.inviteCode,
        })
        .from(userTournaments)
        .where(eq(userTournaments.tournamentId, tournamentId))
        .limit(1);
      if (rows.length === 0) return res.status(404).json({ error: "Tournament not found" });
      return res.json(rows[0]);
    } catch (err) {
      console.error("[auth] get tournament meta error:", err);
      return res.status(500).json({ error: "Failed to fetch tournament meta" });
    }
  });

  // ── GET /api/join/check-slug/:slug ───────────────────────────────────────
  // Public endpoint: checks whether a custom slug is already taken.
  // Accepts an optional ?exclude=<tournamentId> query param so a director
  // editing their own slug doesn't get a false "taken" result.
  // Returns: { available: boolean, conflict: string | null }
  router.get("/join/check-slug/:slug", async (req, res) => {
    const { slug } = req.params;
    const exclude = (req.query.exclude as string | undefined) ?? "";

    // Basic validation — same rules as the client sanitiser
    if (!slug || slug.length < 2 || slug.length > 60) {
      return res.json({ available: false, conflict: "Slug must be 2–60 characters" });
    }
    const slugRe = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;
    if (!slugRe.test(slug)) {
      return res.json({ available: false, conflict: "Only lowercase letters, numbers, and hyphens allowed" });
    }

    try {
      const db = await getDb();
      const { and, ne } = await import("drizzle-orm");
      const whereClause = exclude
        ? and(
            eq(userTournaments.customSlug, slug),
            ne(userTournaments.tournamentId, exclude)
          )
        : eq(userTournaments.customSlug, slug);

      const rows = await db
        .select({ tournamentId: userTournaments.tournamentId, name: userTournaments.name })
        .from(userTournaments)
        .where(whereClause)
        .limit(1);

      if (rows.length === 0) {
        return res.json({ available: true, conflict: null });
      }
      return res.json({
        available: false,
        conflict: `Already used by "${rows[0].name ?? "another tournament"}"`
      });
    } catch (err) {
      console.error("[auth] check-slug error:", err);
      return res.status(500).json({ error: "Failed to check slug availability" });
    }
  });

  return router;
}
