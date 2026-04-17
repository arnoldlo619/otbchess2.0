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
import { eq, ilike } from "drizzle-orm";
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
          isStaff: users.isStaff,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(ilike(users.email, email))
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
        .where(ilike(users.email, email.trim()))
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
        .where(ilike(users.email, email.trim()))
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
