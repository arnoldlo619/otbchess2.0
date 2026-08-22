/** Account creation, sign-in, session, and OAuth initiation routes. */
import { Router } from "express";
import { rateLimit, ipKeyGenerator } from "express-rate-limit";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";
import { getDb } from "./db.js";
import { users } from "../shared/schema.js";
import { logger } from "./logger.js";
import {
  BCRYPT_ROUNDS,
  COOKIE_MAX_AGE_DEFAULT_MS,
  COOKIE_MAX_AGE_GUEST_MS,
  COOKIE_MAX_AGE_REMEMBER_MS,
  getRequestToken,
  getTokenPayload,
  safeUser,
  setAuthCookie,
  signToken,
} from "./authCore.js";

const loginRegisterRateLimiter = rateLimit({
  windowMs: 60_000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? "unknown"),
  message: { error: "Too many attempts — please wait a minute and try again." },
  skip: () => process.env.NODE_ENV !== "production",
});

const refreshRateLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? "unknown"),
  message: { error: "Too many refresh requests — please wait a moment." },
  skip: () => process.env.NODE_ENV !== "production",
});

export function createAuthenticationRouter(): Router {
  const router = Router();

  router.post("/register", loginRegisterRateLimiter, async (req, res) => {
    const { email, password, displayName, chesscomUsername, lichessUsername } = req.body as {
      email: string;
      password: string;
      displayName: string;
      chesscomUsername?: string;
      lichessUsername?: string;
    };
    if (!email || !password || !displayName) {
      return res.status(400).json({ error: "email, password, and displayName are required" });
    }
    if (password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "Invalid email address" });

    try {
      const db = await getDb();
      const normalizedEmail = email.toLowerCase().trim();
      const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, normalizedEmail));
      if (existing.length > 0) return res.status(409).json({ error: "An account with this email already exists" });

      const id = nanoid();
      await db.insert(users).values({
        id,
        email: normalizedEmail,
        passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
        displayName: displayName.trim(),
        chesscomUsername: chesscomUsername?.toLowerCase().trim() || null,
        lichessUsername: lichessUsername?.toLowerCase().trim() || null,
      });
      const [user] = await db.select().from(users).where(eq(users.id, id));
      const token = signToken(id);
      setAuthCookie(res, token, COOKIE_MAX_AGE_DEFAULT_MS);

      const { sendWelcomeEmail } = await import("./platformEmail.js");
      sendWelcomeEmail({ to: user.email, displayName: user.displayName }).catch((error: unknown) => {
        logger.error("[auth] Failed to send welcome email:", error);
      });
      return res.status(201).json({ user: safeUser(user), token });
    } catch (error) {
      logger.error("[auth] register error:", error);
      return res.status(500).json({ error: "Registration failed" });
    }
  });

  router.post("/login", loginRegisterRateLimiter, async (req, res) => {
    const { email, password, remember } = req.body as { email: string; password: string; remember?: boolean };
    if (!email || !password) return res.status(400).json({ error: "email and password are required" });
    try {
      const db = await getDb();
      const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase().trim()));
      if (!user) {
        await bcrypt.compare(password, "$2b$12$invalidhashfortimingprotection00000000000000000000");
        return res.status(401).json({ error: "Invalid email or password" });
      }
      if (!user.passwordHash) {
        return res.status(401).json({ error: "This account uses Google sign-in. Please use 'Continue with Google' to sign in." });
      }
      if (!(await bcrypt.compare(password, user.passwordHash))) {
        return res.status(401).json({ error: "Invalid email or password" });
      }
      const rememberMe = Boolean(remember);
      const token = signToken(user.id, rememberMe);
      setAuthCookie(res, token, rememberMe ? COOKIE_MAX_AGE_REMEMBER_MS : COOKIE_MAX_AGE_DEFAULT_MS);
      return res.json({ user: safeUser(user), token });
    } catch (error) {
      logger.error("[auth] login error:", error);
      return res.status(500).json({ error: "Login failed" });
    }
  });

  router.post("/logout", (_req, res) => {
    res.clearCookie("token", { httpOnly: true, sameSite: "lax" });
    return res.json({ ok: true });
  });

  router.post("/guest", async (req, res) => {
    const rawName = ((req.body as { displayName?: string }).displayName ?? "").trim();
    if (rawName.length < 2) return res.status(400).json({ error: "Display name must be at least 2 characters" });
    if (rawName.length > 30) return res.status(400).json({ error: "Display name must be 30 characters or fewer" });
    try {
      const db = await getDb();
      const id = nanoid();
      await db.insert(users).values({
        id,
        email: `guest_${id}@otbchess.guest`,
        passwordHash: "",
        displayName: rawName,
        isGuest: true,
      });
      const [user] = await db.select().from(users).where(eq(users.id, id));
      const token = signToken(id, false, true);
      setAuthCookie(res, token, COOKIE_MAX_AGE_GUEST_MS);
      logger.info(`[auth] Guest session created: ${rawName} (${id})`);
      return res.status(201).json({ user: safeUser(user), token });
    } catch (error) {
      logger.error("[auth] guest error:", error);
      return res.status(500).json({ error: "Failed to create guest session" });
    }
  });

  router.get("/me", async (req, res) => {
    if (!getRequestToken(req)) return res.status(401).json({ error: "Not authenticated" });
    const payload = getTokenPayload(req);
    if (!payload) return res.status(401).json({ error: "Invalid or expired token" });
    try {
      const db = await getDb();
      const [user] = await db.select().from(users).where(eq(users.id, payload.sub));
      if (!user) return res.status(401).json({ error: "User not found" });
      if (user.isPro && user.proExpiresAt && new Date() > new Date(user.proExpiresAt)) {
        await db.update(users).set({ isPro: false, proExpiresAt: null }).where(eq(users.id, user.id));
        user.isPro = false;
        user.proExpiresAt = null;
        logger.info(`[auth] Auto-revoked expired Pro for ${user.email}`);
      }
      return res.json({ user: safeUser(user) });
    } catch (error) {
      logger.error("[auth] me error:", error);
      return res.status(500).json({ error: "Failed to fetch user" });
    }
  });

  router.post("/refresh", refreshRateLimiter, async (req, res) => {
    const raw = getRequestToken(req);
    if (!raw) return res.status(401).json({ error: "Not authenticated" });
    const payload = getTokenPayload(req);
    if (!payload) return res.status(401).json({ error: "Invalid or expired token" });
    try {
      const db = await getDb();
      const [user] = await db.select().from(users).where(eq(users.id, payload.sub));
      if (!user) return res.status(401).json({ error: "User not found" });
      const decoded = jwt.decode(raw) as { exp?: number; iat?: number } | null;
      const originalTtl = decoded?.exp && decoded?.iat ? decoded.exp - decoded.iat : 0;
      const isRemember = originalTtl > 7 * 24 * 60 * 60;
      const isGuest = Boolean(payload.isGuest);
      const token = signToken(user.id, isRemember, isGuest);
      const maxAge = isGuest ? COOKIE_MAX_AGE_GUEST_MS : isRemember ? COOKIE_MAX_AGE_REMEMBER_MS : COOKIE_MAX_AGE_DEFAULT_MS;
      setAuthCookie(res, token, maxAge);
      return res.json({ user: safeUser(user), token });
    } catch (error) {
      logger.error("[auth] refresh error:", error);
      return res.status(500).json({ error: "Token refresh failed" });
    }
  });

  router.get("/google", (_req, res) => {
    const redirectUri = `${process.env.APP_URL ?? "https://chessotb.club"}/api/oauth/callback`;
    const state = Buffer.from(JSON.stringify({ ts: Date.now() })).toString("base64url");
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      state,
      access_type: "offline",
      prompt: "select_account",
    });
    res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  });

  return router;
}

