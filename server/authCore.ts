import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { users } from "../shared/schema.js";

export const BCRYPT_ROUNDS = 12;
export const COOKIE_MAX_AGE_DEFAULT_MS = 7 * 24 * 60 * 60 * 1000;
export const COOKIE_MAX_AGE_REMEMBER_MS = 30 * 24 * 60 * 60 * 1000;
export const COOKIE_MAX_AGE_GUEST_MS = 24 * 60 * 60 * 1000;

const JWT_EXPIRY_DEFAULT = "7d";
const JWT_EXPIRY_REMEMBER = "30d";
const JWT_EXPIRY_GUEST = "24h";

export interface AuthTokenPayload {
  sub: string;
  isGuest?: boolean;
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET env var is not set");
  return secret;
}

export function signToken(userId: string, remember = false, isGuest = false): string {
  return jwt.sign(
    { sub: userId, ...(isGuest ? { isGuest: true } : {}) },
    getJwtSecret(),
    { expiresIn: isGuest ? JWT_EXPIRY_GUEST : remember ? JWT_EXPIRY_REMEMBER : JWT_EXPIRY_DEFAULT },
  );
}

export function verifyToken(token: string): AuthTokenPayload | null {
  try {
    return jwt.verify(token, getJwtSecret()) as AuthTokenPayload;
  } catch {
    return null;
  }
}

export function getRequestToken(req: Request): string | null {
  const cookieToken = req.cookies?.token as string | undefined;
  const headerToken = (req.headers.authorization ?? "").replace("Bearer ", "");
  return cookieToken || headerToken || null;
}

export function getTokenPayload(req: Request): AuthTokenPayload | null {
  const token = getRequestToken(req);
  return token ? verifyToken(token) : null;
}

export function safeUser(user: typeof users.$inferSelect) {
  const { passwordHash: _, ...safe } = user;
  return safe;
}

export function setAuthCookie(
  res: Response,
  token: string,
  maxAge: number,
): void {
  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge,
  });
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const payload = getTokenPayload(req);
  if (!getRequestToken(req)) return res.status(401).json({ error: "Not authenticated" });
  if (!payload) return res.status(401).json({ error: "Invalid or expired token" });
  const authenticated = req as Request & { userId: string; isGuest: boolean };
  authenticated.userId = payload.sub;
  authenticated.isGuest = payload.isGuest === true;
  next();
}

export function requireFullAuth(req: Request, res: Response, next: NextFunction) {
  const payload = getTokenPayload(req);
  if (!getRequestToken(req)) return res.status(401).json({ error: "Not authenticated" });
  if (!payload) return res.status(401).json({ error: "Invalid or expired token" });
  if (payload.isGuest) {
    return res.status(403).json({
      error: "Guest accounts cannot perform this action. Please create a free account.",
      code: "GUEST_FORBIDDEN",
    });
  }
  const authenticated = req as Request & { userId: string; isGuest: boolean };
  authenticated.userId = payload.sub;
  authenticated.isGuest = false;
  next();
}
