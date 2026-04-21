/**
 * adminStaff.ts — Admin routes for managing OTB Staff accounts.
 *
 * Endpoints (all require isStaff):
 *   GET  /api/admin/staff          — list all staff users
 *   POST /api/admin/staff/grant    — grant isStaff to a user by email
 *   POST /api/admin/staff/revoke   — revoke isStaff from a user by email (cannot self-revoke)
 *   GET  /api/admin/staff/search   — search a user by email (returns basic info)
 */
import { Router } from "express";
import { eq, sql } from "drizzle-orm";
import { getDb } from "./db.js";
import { users } from "../shared/schema.js";
import { requireFullAuth } from "./auth.js";

// ─── Middleware: requireStaff ─────────────────────────────────────────────────
async function requireStaff(
  req: import("express").Request,
  res: import("express").Response,
  next: import("express").NextFunction
) {
  const r = req as import("express").Request & { userId: string };
  const db = await getDb();
  const [caller] = await db
    .select({ isStaff: users.isStaff })
    .from(users)
    .where(eq(users.id, r.userId))
    .limit(1);
  if (!caller?.isStaff) {
    return res.status(403).json({ error: "OTB Staff access required." });
  }
  next();
}

// ─── Router ───────────────────────────────────────────────────────────────────
export function createAdminStaffRouter(): Router {
  const router = Router();

  // Apply auth + staff guard to all routes in this router
  router.use(requireFullAuth, requireStaff);

  // ── GET /api/admin/staff — list all staff members ──────────────────────────
  router.get("/", async (_req, res) => {
    try {
      const db = await getDb();
      const staffMembers = await db
        .select({
          id: users.id,
          displayName: users.displayName,
          email: users.email,
          chesscomUsername: users.chesscomUsername,
          isPro: users.isPro,
          proExpiresAt: users.proExpiresAt,
          isStaff: users.isStaff,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(eq(users.isStaff, true));
      return res.json({ staff: staffMembers });
    } catch (err) {
      console.error("[adminStaff] GET / error:", err);
      return res.status(500).json({ error: "Failed to fetch staff list." });
    }
  });

  // ── GET /api/admin/staff/search?email=... — look up a user by email ────────
  router.get("/search", async (req, res) => {
    const email = (req.query.email as string | undefined)?.trim().toLowerCase();
    if (!email) return res.status(400).json({ error: "email query param required." });
    try {
      const db = await getDb();
      const [found] = await db
        .select({
          id: users.id,
          displayName: users.displayName,
          email: users.email,
          chesscomUsername: users.chesscomUsername,
          isPro: users.isPro,
          proExpiresAt: users.proExpiresAt,
          isStaff: users.isStaff,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(sql`LOWER(${users.email}) = LOWER(${email})`)
        .limit(1);
      if (!found) return res.status(404).json({ error: "No user found with that email." });
      return res.json({ user: found });
    } catch (err) {
      console.error("[adminStaff] GET /search error:", err);
      return res.status(500).json({ error: "Search failed." });
    }
  });

  // ── POST /api/admin/staff/grant — grant isStaff by email ───────────────────
  router.post("/grant", async (req, res) => {
    const { email } = req.body as { email?: string };
    if (!email?.trim()) return res.status(400).json({ error: "email is required." });
    try {
      const db = await getDb();
      const [target] = await db
        .select({ id: users.id, email: users.email, displayName: users.displayName, isStaff: users.isStaff })
        .from(users)
        .where(sql`LOWER(${users.email}) = LOWER(${email.trim()})`)
        .limit(1);
      if (!target) return res.status(404).json({ error: "No user found with that email." });
      if (target.isStaff) return res.json({ message: `${target.email} is already OTB Staff.`, user: target });
      await db.update(users).set({ isStaff: true }).where(eq(users.id, target.id));
      console.log(`[adminStaff] Granted isStaff to ${target.email} (id=${target.id})`);
      return res.json({ message: `✓ Staff access granted to ${target.email}.`, user: { ...target, isStaff: true } });
    } catch (err) {
      console.error("[adminStaff] POST /grant error:", err);
      return res.status(500).json({ error: "Failed to grant staff access." });
    }
  });

  // ── GET /api/admin/staff/users — list all non-guest registered users ─────────
  router.get("/users", async (_req, res) => {
    try {
      const db = await getDb();
      const allUsers = await db
        .select({
          id: users.id,
          displayName: users.displayName,
          email: users.email,
          chesscomUsername: users.chesscomUsername,
          isPro: users.isPro,
          proExpiresAt: users.proExpiresAt,
          isStaff: users.isStaff,
          isGuest: users.isGuest,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(sql`${users.isGuest} = 0`);
      return res.json({ users: allUsers });
    } catch (err) {
      console.error("[adminStaff] GET /users error:", err);
      return res.status(500).json({ error: "Failed to fetch users." });
    }
  });

  // ── POST /api/admin/staff/grant-pro — grant isPro by email (with optional expiry) ──
  router.post("/grant-pro", async (req, res) => {
    const { email, expiresAt } = req.body as { email?: string; expiresAt?: string | null };
    if (!email?.trim()) return res.status(400).json({ error: "email is required." });
    // Parse optional expiry date
    let expiryDate: Date | null = null;
    if (expiresAt) {
      expiryDate = new Date(expiresAt);
      if (isNaN(expiryDate.getTime())) {
        return res.status(400).json({ error: "Invalid expiresAt date format. Use ISO 8601 (e.g. 2026-12-31)." });
      }
    }
    try {
      const db = await getDb();
      const [target] = await db
        .select({ id: users.id, email: users.email, displayName: users.displayName, isPro: users.isPro, proExpiresAt: users.proExpiresAt })
        .from(users)
        .where(sql`LOWER(${users.email}) = LOWER(${email.trim()})`)
        .limit(1);
      if (!target) return res.status(404).json({ error: "No user found with that email." });
      await db.update(users).set({ isPro: true, proExpiresAt: expiryDate }).where(eq(users.id, target.id));
      const expiryMsg = expiryDate ? ` (expires ${expiryDate.toISOString().split('T')[0]})` : " (permanent)";
      console.log(`[adminStaff] Granted isPro to ${target.email} (id=${target.id})${expiryMsg}`);
      return res.json({
        message: `✓ Pro access granted to ${target.email}${expiryMsg}.`,
        user: { ...target, isPro: true, proExpiresAt: expiryDate },
      });
    } catch (err) {
      console.error("[adminStaff] POST /grant-pro error:", err);
      return res.status(500).json({ error: "Failed to grant Pro access." });
    }
  });

  // ── POST /api/admin/staff/revoke-pro — revoke isPro by email ──────────────────
  router.post("/revoke-pro", async (req, res) => {
    const { email } = req.body as { email?: string };
    if (!email?.trim()) return res.status(400).json({ error: "email is required." });
    try {
      const db = await getDb();
      const [target] = await db
        .select({ id: users.id, email: users.email, displayName: users.displayName, isPro: users.isPro })
        .from(users)
        .where(sql`LOWER(${users.email}) = LOWER(${email.trim()})`)
        .limit(1);
      if (!target) return res.status(404).json({ error: "No user found with that email." });
      if (!target.isPro) return res.json({ message: `${target.email} does not have Pro access.`, user: target });
      await db.update(users).set({ isPro: false }).where(eq(users.id, target.id));
      console.log(`[adminStaff] Revoked isPro from ${target.email} (id=${target.id})`);
      return res.json({ message: `✓ Pro access revoked from ${target.email}.`, user: { ...target, isPro: false } });
    } catch (err) {
      console.error("[adminStaff] POST /revoke-pro error:", err);
      return res.status(500).json({ error: "Failed to revoke Pro access." });
    }
  });

  // ── POST /api/admin/staff/revoke — revoke isStaff by email ─────────────────
  router.post("/revoke", async (req, res) => {
    const r = req as import("express").Request & { userId: string };
    const { email } = req.body as { email?: string };
    if (!email?.trim()) return res.status(400).json({ error: "email is required." });
    try {
      const db = await getDb();
      const [target] = await db
        .select({ id: users.id, email: users.email, displayName: users.displayName, isStaff: users.isStaff })
        .from(users)
        .where(sql`LOWER(${users.email}) = LOWER(${email.trim()})`)
        .limit(1);
      if (!target) return res.status(404).json({ error: "No user found with that email." });
      // Prevent self-revocation
      if (target.id === r.userId) {
        return res.status(400).json({ error: "You cannot revoke your own staff access." });
      }
      if (!target.isStaff) return res.json({ message: `${target.email} is not OTB Staff.`, user: target });
      await db.update(users).set({ isStaff: false }).where(eq(users.id, target.id));
      console.log(`[adminStaff] Revoked isStaff from ${target.email} (id=${target.id})`);
      return res.json({ message: `✓ Staff access revoked from ${target.email}.`, user: { ...target, isStaff: false } });
    } catch (err) {
      console.error("[adminStaff] POST /revoke error:", err);
      return res.status(500).json({ error: "Failed to revoke staff access." });
    }
  });

  return router;
}
