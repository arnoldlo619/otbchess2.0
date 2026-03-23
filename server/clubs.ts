/**
 * OTB Chess — Clubs REST API
 *
 * Endpoints (all mounted at /api/clubs):
 *   GET  /                   — list all public clubs (Discover page)
 *   GET  /mine               — list clubs the signed-in user belongs to
 *   POST /                   — create a new club (auth required)
 *   POST /sync               — bulk-upsert clubs from localStorage (migration)
 *   GET  /:id                — get a single club by ID
 *   PATCH /:id               — update club metadata (owner/director only)
 *   GET  /:id/members        — list club members
 *   POST /:id/members        — join a club (auth required)
 *   DELETE /:id/members/:uid — leave / remove a member
 */

import { Router } from "express";
import { getDb } from "./db.js";
import { dbClubs, dbClubMembers } from "../shared/schema";
import { eq, and, desc, or, sql, gt } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { Request, Response } from "express";

export const clubsRouter = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

function requireAuth(req: Request, res: Response): string | null {
  const userId = (req as any).userId as string | undefined;
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return null;
  }
  return userId;
}

function dbRowToClub(row: typeof dbClubs.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    tagline: row.tagline,
    description: row.description,
    location: row.location,
    country: row.country,
    category: row.category,
    avatarUrl: row.avatarUrl ?? null,
    bannerUrl: row.bannerUrl ?? null,
    accentColor: row.accentColor,
    ownerId: row.ownerId,
    ownerName: row.ownerName,
    memberCount: row.memberCount,
    tournamentCount: row.tournamentCount,
    followerCount: row.followerCount,
    isPublic: row.isPublic === 1,
    website: row.website ?? undefined,
    twitter: row.twitter ?? undefined,
    discord: row.discord ?? undefined,
    announcement: row.announcement ?? undefined,
    foundedAt:
      row.foundedAt instanceof Date
        ? row.foundedAt.toISOString()
        : String(row.foundedAt),
  };
}

const ONLINE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

function isOnlineNow(lastSeenAt: Date | null | undefined): boolean {
  if (!lastSeenAt) return false;
  const ts = lastSeenAt instanceof Date ? lastSeenAt.getTime() : new Date(String(lastSeenAt)).getTime();
  return Date.now() - ts < ONLINE_THRESHOLD_MS;
}

function dbMemberToMember(row: typeof dbClubMembers.$inferSelect) {
  return {
    clubId: row.clubId,
    userId: row.userId,
    displayName: row.displayName,
    chesscomUsername: row.chesscomUsername ?? null,
    lichessUsername: row.lichessUsername ?? null,
    avatarUrl: row.avatarUrl ?? null,
    role: row.role as "owner" | "director" | "member",
    joinedAt:
      row.joinedAt instanceof Date
        ? row.joinedAt.toISOString()
        : String(row.joinedAt),
    tournamentsPlayed: row.tournamentsPlayed,
    bestFinish: row.bestFinish ?? null,
    lastSeenAt: row.lastSeenAt instanceof Date
      ? row.lastSeenAt.toISOString()
      : (row.lastSeenAt ? String(row.lastSeenAt) : null),
    isOnline: isOnlineNow(row.lastSeenAt as Date | null),
  };
}

// ── GET /api/clubs — list all public clubs ────────────────────────────────────
clubsRouter.get("/", async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const { search, category } = req.query as Record<string, string>;
    let rows = await db
      .select()
      .from(dbClubs)
      .where(eq(dbClubs.isPublic, 1))
      .orderBy(desc(dbClubs.memberCount));

    if (search?.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (r: typeof dbClubs.$inferSelect) =>
          r.name.toLowerCase().includes(q) ||
          r.location.toLowerCase().includes(q) ||
          r.tagline.toLowerCase().includes(q)
      );
    }
    if (category && category !== "all") {
      rows = rows.filter(
        (r: typeof dbClubs.$inferSelect) => r.category === category
      );
    }

    res.json(rows.map(dbRowToClub));
  } catch (err) {
    console.error("[clubs] GET / error:", err);
    res.status(500).json({ error: "Failed to list clubs" });
  }
});

// ── GET /api/clubs/mine — clubs the signed-in user belongs to ─────────────────
clubsRouter.get("/mine", async (req: Request, res: Response) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  try {
    const db = await getDb();
    const memberRows = await db
      .select()
      .from(dbClubMembers)
      .where(eq(dbClubMembers.userId, userId));

    if (memberRows.length === 0) {
      res.json([]);
      return;
    }
    const clubIds = memberRows.map(
      (m: typeof dbClubMembers.$inferSelect) => m.clubId
    );
    const clubRows = await db
      .select()
      .from(dbClubs)
      .where(
        clubIds.length === 1
          ? eq(dbClubs.id, clubIds[0])
          : or(...clubIds.map((cid: string) => eq(dbClubs.id, cid)))
      );
    res.json(clubRows.map(dbRowToClub));
  } catch (err) {
    console.error("[clubs] GET /mine error:", err);
    res.status(500).json({ error: "Failed to list your clubs" });
  }
});

// ── POST /api/clubs — create a new club ───────────────────────────────────────
clubsRouter.post("/", async (req: Request, res: Response) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  try {
    const db = await getDb();
    const {
      id,
      name,
      slug,
      tagline = "",
      description = "",
      location = "",
      country = "",
      category = "club",
      avatarUrl = null,
      bannerUrl = null,
      accentColor = "#4CAF50",
      ownerName = "",
      isPublic = true,
      website,
      twitter,
      discord,
      announcement,
      foundedAt,
    } = req.body;

    if (!name?.trim()) {
      res.status(400).json({ error: "Club name is required" });
      return;
    }

    const clubId = id || nanoid();
    const clubSlug =
      slug ||
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

    await db.insert(dbClubs).values({
      id: clubId,
      name: name.trim(),
      slug: clubSlug,
      tagline,
      description,
      location,
      country,
      category,
      avatarUrl: avatarUrl || null,
      bannerUrl: bannerUrl || null,
      accentColor,
      ownerId: userId,
      ownerName,
      memberCount: 1,
      tournamentCount: 0,
      followerCount: 0,
      isPublic: isPublic ? 1 : 0,
      website: website || null,
      twitter: twitter || null,
      discord: discord || null,
      announcement: announcement || null,
      foundedAt: foundedAt ? new Date(foundedAt) : new Date(),
    });

    // Auto-join creator as owner
    await db.insert(dbClubMembers).values({
      clubId,
      userId,
      displayName: ownerName,
      role: "owner",
    });

    const [created] = await db
      .select()
      .from(dbClubs)
      .where(eq(dbClubs.id, clubId));
    res.status(201).json(dbRowToClub(created));
  } catch (err) {
    console.error("[clubs] POST / error:", err);
    res.status(500).json({ error: "Failed to create club" });
  }
});

// ── POST /api/clubs/sync — bulk upsert from localStorage (migration) ──────────
clubsRouter.post("/sync", async (req: Request, res: Response) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  try {
    const db = await getDb();
    const { clubs } = req.body as { clubs: Array<Record<string, unknown>> };
    if (!Array.isArray(clubs)) {
      res.status(400).json({ error: "clubs must be an array" });
      return;
    }

    let upserted = 0;
    for (const c of clubs) {
      if (!c.id || !c.name) continue;
      if (c.ownerId !== userId) continue;
      try {
        await db
          .insert(dbClubs)
          .values({
            id: String(c.id),
            name: String(c.name),
            slug: String(c.slug || ""),
            tagline: String(c.tagline || ""),
            description: String(c.description || ""),
            location: String(c.location || ""),
            country: String(c.country || ""),
            category: String(c.category || "club"),
            avatarUrl: c.avatarUrl ? String(c.avatarUrl) : null,
            bannerUrl: c.bannerUrl ? String(c.bannerUrl) : null,
            accentColor: String(c.accentColor || "#4CAF50"),
            ownerId: String(c.ownerId),
            ownerName: String(c.ownerName || ""),
            memberCount: Number(c.memberCount) || 1,
            tournamentCount: Number(c.tournamentCount) || 0,
            followerCount: Number(c.followerCount) || 0,
            isPublic: c.isPublic === false ? 0 : 1,
            website: c.website ? String(c.website) : null,
            twitter: c.twitter ? String(c.twitter) : null,
            discord: c.discord ? String(c.discord) : null,
            announcement: c.announcement ? String(c.announcement) : null,
            foundedAt: c.foundedAt ? new Date(String(c.foundedAt)) : new Date(),
          })
          .onDuplicateKeyUpdate({
            set: {
              name: String(c.name),
              tagline: String(c.tagline || ""),
              description: String(c.description || ""),
              location: String(c.location || ""),
              memberCount: Number(c.memberCount) || 1,
              isPublic: c.isPublic === false ? 0 : 1,
              announcement: c.announcement ? String(c.announcement) : null,
            },
          });
        upserted++;
      } catch (innerErr) {
        console.error("[clubs] sync upsert error for club", c.id, innerErr);
      }
    }
    res.json({ upserted });
  } catch (err) {
    console.error("[clubs] POST /sync error:", err);
    res.status(500).json({ error: "Sync failed" });
  }
});

// ── GET /api/clubs/:id — get a single club ────────────────────────────────────
clubsRouter.get("/:id", async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const { id } = req.params;
    const [row] = await db
      .select()
      .from(dbClubs)
      .where(eq(dbClubs.id, id));
    if (!row) {
      res.status(404).json({ error: "Club not found" });
      return;
    }
    res.json(dbRowToClub(row));
  } catch (err) {
    console.error("[clubs] GET /:id error:", err);
    res.status(500).json({ error: "Failed to get club" });
  }
});

// ── PATCH /api/clubs/:id — update club metadata ───────────────────────────────
clubsRouter.patch("/:id", async (req: Request, res: Response) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  try {
    const db = await getDb();
    const { id } = req.params;
    const [club] = await db
      .select()
      .from(dbClubs)
      .where(eq(dbClubs.id, id));
    if (!club) {
      res.status(404).json({ error: "Club not found" });
      return;
    }
    const [membership] = await db
      .select()
      .from(dbClubMembers)
      .where(
        and(eq(dbClubMembers.clubId, id), eq(dbClubMembers.userId, userId))
      );
    const isOwner = club.ownerId === userId;
    const isDirector = membership?.role === "director";
    if (!isOwner && !isDirector) {
      res
        .status(403)
        .json({ error: "Only owners and directors can update club settings" });
      return;
    }

    const allowed = [
      "name",
      "tagline",
      "description",
      "location",
      "country",
      "category",
      "avatarUrl",
      "bannerUrl",
      "accentColor",
      "isPublic",
      "website",
      "twitter",
      "discord",
      "announcement",
    ];
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in req.body) {
        updates[key] = key === "isPublic" ? (req.body[key] ? 1 : 0) : req.body[key];
      }
    }

    if (Object.keys(updates).length > 0) {
      await db.update(dbClubs).set(updates).where(eq(dbClubs.id, id));
    }

    const [updated] = await db
      .select()
      .from(dbClubs)
      .where(eq(dbClubs.id, id));
    res.json(dbRowToClub(updated));
  } catch (err) {
    console.error("[clubs] PATCH /:id error:", err);
    res.status(500).json({ error: "Failed to update club" });
  }
});

// ── GET /api/clubs/:id/members — list club members ────────────────────────────
clubsRouter.get("/:id/members", async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const { id } = req.params;
    const rows = await db
      .select()
      .from(dbClubMembers)
      .where(eq(dbClubMembers.clubId, id));
    res.json(rows.map(dbMemberToMember));
  } catch (err) {
    console.error("[clubs] GET /:id/members error:", err);
    res.status(500).json({ error: "Failed to list members" });
  }
});

// ── POST /api/clubs/:id/members — join a club ─────────────────────────────────
clubsRouter.post("/:id/members", async (req: Request, res: Response) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  try {
    const db = await getDb();
    const { id } = req.params;
    const [club] = await db
      .select()
      .from(dbClubs)
      .where(eq(dbClubs.id, id));
    if (!club) {
      res.status(404).json({ error: "Club not found" });
      return;
    }
    const [existing] = await db
      .select()
      .from(dbClubMembers)
      .where(
        and(eq(dbClubMembers.clubId, id), eq(dbClubMembers.userId, userId))
      );
    if (existing) {
      res.status(409).json({ error: "Already a member" });
      return;
    }
    const {
      displayName = "",
      chesscomUsername,
      lichessUsername,
      avatarUrl,
    } = req.body;
    await db.insert(dbClubMembers).values({
      clubId: id,
      userId,
      displayName,
      chesscomUsername: chesscomUsername || null,
      lichessUsername: lichessUsername || null,
      avatarUrl: avatarUrl || null,
      role: "member",
    });
    await db
      .update(dbClubs)
      .set({ memberCount: club.memberCount + 1 })
      .where(eq(dbClubs.id, id));

    res.status(201).json({ success: true });
  } catch (err) {
    console.error("[clubs] POST /:id/members error:", err);
    res.status(500).json({ error: "Failed to join club" });
  }
});

// ── POST /api/clubs/:id/heartbeat — update presence timestamp ────────────────
clubsRouter.post("/:id/heartbeat", async (req: Request, res: Response) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  try {
    const db = await getDb();
    const { id } = req.params;
    const [existing] = await db
      .select({ id: dbClubMembers.id })
      .from(dbClubMembers)
      .where(and(eq(dbClubMembers.clubId, id), eq(dbClubMembers.userId, userId)));
    if (!existing) {
      res.status(404).json({ error: "Not a member" });
      return;
    }
    await db
      .update(dbClubMembers)
      .set({ lastSeenAt: new Date() })
      .where(and(eq(dbClubMembers.clubId, id), eq(dbClubMembers.userId, userId)));
    res.json({ success: true });
  } catch (err) {
    console.error("[clubs] POST /:id/heartbeat error:", err);
    res.status(500).json({ error: "Failed to update presence" });
  }
});

// ── GET /api/clubs/:id/presence — get online member count ────────────────────
clubsRouter.get("/:id/presence", async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const { id } = req.params;
    const thresholdDate = new Date(Date.now() - ONLINE_THRESHOLD_MS);
    const allMembers = await db
      .select({ lastSeenAt: dbClubMembers.lastSeenAt })
      .from(dbClubMembers)
      .where(eq(dbClubMembers.clubId, id));
    const totalMembers = allMembers.length;
    const onlineCount = allMembers.filter((m) =>
      isOnlineNow(m.lastSeenAt as Date | null)
    ).length;
    res.json({ onlineCount, totalMembers });
  } catch (err) {
    console.error("[clubs] GET /:id/presence error:", err);
    res.status(500).json({ error: "Failed to get presence" });
  }
});

// ── DELETE /api/clubs/:id/members/:uid — leave / remove member ────────────────
clubsRouter.delete(
  "/:id/members/:memberId",
  async (req: Request, res: Response) => {
    const requesterId = requireAuth(req, res);
    if (!requesterId) return;
    try {
      const db = await getDb();
      const { id, memberId } = req.params;
      const [club] = await db
        .select()
        .from(dbClubs)
        .where(eq(dbClubs.id, id));
      if (!club) {
        res.status(404).json({ error: "Club not found" });
        return;
      }
      const [requesterMembership] = await db
        .select()
        .from(dbClubMembers)
        .where(
          and(
            eq(dbClubMembers.clubId, id),
            eq(dbClubMembers.userId, requesterId)
          )
        );
      const isOwner = club.ownerId === requesterId;
      const isDirector = requesterMembership?.role === "director";
      const isSelf = requesterId === memberId;
      if (!isOwner && !isDirector && !isSelf) {
        res
          .status(403)
          .json({ error: "Not authorised to remove this member" });
        return;
      }

      await db
        .delete(dbClubMembers)
        .where(
          and(
            eq(dbClubMembers.clubId, id),
            eq(dbClubMembers.userId, memberId)
          )
        );

      if (club.memberCount > 0) {
        await db
          .update(dbClubs)
          .set({ memberCount: club.memberCount - 1 })
          .where(eq(dbClubs.id, id));
      }
      res.json({ success: true });
    } catch (err) {
      console.error("[clubs] DELETE /:id/members/:memberId error:", err);
      res.status(500).json({ error: "Failed to remove member" });
    }
  }
);
