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
import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";
import { getDb } from "./db.js";
import { users } from "../shared/schema.js";

const BCRYPT_ROUNDS = 12;
const JWT_EXPIRY = "30d";
const COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET env var is not set");
  return secret;
}

function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, getJwtSecret(), { expiresIn: JWT_EXPIRY });
}

function verifyToken(token: string): { sub: string } | null {
  try {
    const payload = jwt.verify(token, getJwtSecret()) as { sub: string };
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
// Attaches req.userId if a valid JWT is present in cookie or Authorization header.
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
  (req as import("express").Request & { userId: string }).userId = payload.sub;
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
        maxAge: COOKIE_MAX_AGE_MS,
      });

      return res.status(201).json({ user: safeUser(user), token });
    } catch (err) {
      console.error("[auth] register error:", err);
      return res.status(500).json({ error: "Registration failed" });
    }
  });

  // ── POST /api/auth/login ─────────────────────────────────────────────────
  router.post("/login", async (req, res) => {
    const { email, password } = req.body as { email: string; password: string };

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

      const token = signToken(user.id);
      res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: COOKIE_MAX_AGE_MS,
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
    } = req.body as {
      displayName?: string;
      chesscomUsername?: string;
      lichessUsername?: string;
      avatarUrl?: string;
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

      // If chess.com username changed, fetch fresh ELO
      if (chesscomUsername && chesscomUsername.trim()) {
        try {
          const statsRes = await fetch(
            `https://api.chess.com/pub/player/${chesscomUsername.toLowerCase().trim()}/stats`,
            { headers: { "User-Agent": "OTBChess/1.0 (https://chessotb.club)" } }
          );
          if (statsRes.ok) {
            const stats = await statsRes.json() as Record<string, unknown>;
            const rapid = (stats.chess_rapid as Record<string, unknown> | undefined)?.last as Record<string, unknown> | undefined;
            const blitz = (stats.chess_blitz as Record<string, unknown> | undefined)?.last as Record<string, unknown> | undefined;
            const bullet = (stats.chess_bullet as Record<string, unknown> | undefined)?.last as Record<string, unknown> | undefined;
            const elo = (rapid?.rating ?? blitz?.rating ?? bullet?.rating) as number | undefined;
            if (elo) updateData.chesscomElo = elo;
          }
        } catch {
          // ELO fetch failed — don't block the profile save
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

  return router;
}
