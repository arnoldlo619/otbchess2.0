/*
 * OTB Chess — Clubs REST API
 *
 * Endpoints (all mounted at /api/clubs):
 *   GET  /                   — list all public clubs (Discover page)
 *   GET  /mine               — list clubs the signed-in user belongs to
 *   POST /                   — create a new club (auth required)
 *   POST /sync               — bulk-upsert clubs from localStorage (migration)
 *   GET  /leaderboard        — ranked leaderboard across all clubs
 *   GET  /:id                — get a single club by ID or slug
 *   PATCH /:id               — update club metadata (owner/director only)
 *   GET  /:id/members        — list club members
 *   POST /:id/members        — join a club (auth required)
 *   POST /:id/heartbeat      — update presence timestamp (auth required)
 *   GET  /:id/presence       — get online member count
 *   DELETE /:id/members/:uid — leave / remove a member
 */

import express, { Router } from "express";
import { getDb } from "./db.js";
import { dbClubs, dbClubMembers } from "../shared/schema";
import { eq, and, desc, or } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { Request, Response } from "express";
import { requireAuth as authMiddleware, requireFullAuth } from "./auth.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const AVATARS_DIR = path.resolve(__dirname, "../uploads/avatars");
if (!fs.existsSync(AVATARS_DIR)) fs.mkdirSync(AVATARS_DIR, { recursive: true });

export const clubsRouter = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Read req.userId set by authMiddleware — returns it or sends 401 and returns null. */
function getUserId(req: Request, res: Response): string | null {
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
  const ts =
    lastSeenAt instanceof Date
      ? lastSeenAt.getTime()
      : new Date(String(lastSeenAt)).getTime();
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
      : row.lastSeenAt
      ? String(row.lastSeenAt)
      : null,
    isOnline: isOnlineNow(row.lastSeenAt as Date | null),
  };
}

// ── GET /api/clubs — list all public clubs ────────────────────────────────────
clubsRouter.get("/", async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const { search, category, limit } = req.query as Record<string, string>;
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
    const limitN = limit ? parseInt(limit, 10) : undefined;
    const sliced = limitN && limitN > 0 ? rows.slice(0, limitN) : rows;

    res.json({ clubs: sliced.map(dbRowToClub), total: rows.length });
  } catch (err) {
    console.error("[clubs] GET / error:", err);
    res.status(500).json({ error: "Failed to list clubs" });
  }
});

// ── GET /api/clubs/mine — clubs the signed-in user belongs to ─────────────────
clubsRouter.get("/mine", authMiddleware, async (req: Request, res: Response) => {
  const userId = getUserId(req, res);
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

// ── GET /api/clubs/leaderboard — ranked leaderboard across all clubs ──────────
// MUST be declared before /:id to avoid the wildcard swallowing "leaderboard".
clubsRouter.get("/leaderboard", async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const { sortBy = "members" } = req.query as Record<string, string>;

    const rows = await db
      .select()
      .from(dbClubs)
      .where(eq(dbClubs.isPublic, 1));

    type ScoredClub = ReturnType<typeof dbRowToClub> & { score: number };
    const scored: ScoredClub[] = rows.map((r: typeof dbClubs.$inferSelect) => ({
      ...dbRowToClub(r),
      score: sortBy === "tournaments" ? r.tournamentCount : r.memberCount,
    }));

    scored.sort((a, b) =>
      b.score !== a.score ? b.score - a.score : a.name.localeCompare(b.name)
    );

    let rank = 1;
    const ranked = scored.map((club, idx, arr) => {
      if (idx > 0 && arr[idx - 1].score !== club.score) rank = idx + 1;
      return { ...club, rank };
    });

    res.json({ clubs: ranked.slice(0, 50), total: ranked.length, sortBy });
  } catch (err) {
    console.error("[clubs] GET /leaderboard error:", err);
    res.status(500).json({ error: "Failed to load leaderboard" });
  }
});

// ── POST /api/clubs/upload-avatar — upload a club avatar image ───────────────
// Accepts a base64 data URL, saves it to disk, returns a served URL.
// Uses a higher body-size limit applied per-route via a local middleware.
// Per-route body parser with a higher limit for image uploads
const avatarJsonParser = express.json({ limit: "10mb" });

clubsRouter.post("/upload-avatar", requireFullAuth, avatarJsonParser, async (req: Request, res: Response) => {
  const userId = getUserId(req, res);
  if (!userId) return;
  try {
    const { dataUrl } = req.body as { dataUrl?: string };
    if (!dataUrl || !dataUrl.startsWith("data:image/")) {
      res.status(400).json({ error: "Invalid image data" });
      return;
    }
    // Parse the base64 payload
    const matches = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!matches) {
      res.status(400).json({ error: "Malformed data URL" });
      return;
    }
    const ext = matches[1] === "jpeg" ? "jpg" : matches[1];
    const buffer = Buffer.from(matches[2], "base64");
    if (buffer.length > 5 * 1024 * 1024) {
      res.status(413).json({ error: "Image too large (max 5 MB)" });
      return;
    }
    const filename = `${nanoid()}.${ext}`;
    const filepath = path.join(AVATARS_DIR, filename);
    fs.writeFileSync(filepath, buffer);
    res.json({ url: `/uploads/avatars/${filename}` });
  } catch (err) {
    console.error("[clubs] POST /upload-avatar error:", err);
    res.status(500).json({ error: "Failed to upload avatar" });
  }
});

// ── POST /api/clubs — create a new club ───────────────────────────────────────
clubsRouter.post("/", requireFullAuth, async (req: Request, res: Response) => {
  const userId = getUserId(req, res);
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
clubsRouter.post("/sync", requireFullAuth, async (req: Request, res: Response) => {
  const userId = getUserId(req, res);
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

// ── GET /api/clubs/:id — get a single club by ID or slug ─────────────────────
clubsRouter.get("/:id", async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const { id } = req.params;
    // Resolve by ID first, then by slug — so chessotb.club/clubs/my-club-name works
    const [row] = await db
      .select()
      .from(dbClubs)
      .where(or(eq(dbClubs.id, id), eq(dbClubs.slug, id)))
      .limit(1);
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
clubsRouter.patch("/:id", requireFullAuth, async (req: Request, res: Response) => {
  const userId = getUserId(req, res);
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
      .where(and(eq(dbClubMembers.clubId, id), eq(dbClubMembers.userId, userId)));
    const isOwner = club.ownerId === userId;
    const isDirector = membership?.role === "director";
    if (!isOwner && !isDirector) {
      res.status(403).json({ error: "Only owners and directors can update club settings" });
      return;
    }

    const allowed = [
      "name",
      "tagline",
      "description",
      "location",
      "country",
      "category",
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

    const [updated] = await db.select().from(dbClubs).where(eq(dbClubs.id, id));
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
clubsRouter.post("/:id/members", requireFullAuth, async (req: Request, res: Response) => {
  const userId = getUserId(req, res);
  if (!userId) return;
  try {
    const db = await getDb();
    const { id } = req.params;
    const [club] = await db.select().from(dbClubs).where(eq(dbClubs.id, id));
    if (!club) {
      res.status(404).json({ error: "Club not found" });
      return;
    }
    const [existing] = await db
      .select()
      .from(dbClubMembers)
      .where(and(eq(dbClubMembers.clubId, id), eq(dbClubMembers.userId, userId)));
    if (existing) {
      res.status(409).json({ error: "Already a member" });
      return;
    }
    const { displayName = "", chesscomUsername, lichessUsername, avatarUrl } = req.body;
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
clubsRouter.post("/:id/heartbeat", authMiddleware, async (req: Request, res: Response) => {
  const userId = getUserId(req, res);
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

// ── DELETE /api/clubs/:id/members/:memberId — leave / remove member ───────────
clubsRouter.delete(
  "/:id/members/:memberId",
  requireFullAuth,
  async (req: Request, res: Response) => {
    const requesterId = getUserId(req, res);
    if (!requesterId) return;
    try {
      const db = await getDb();
      const { id, memberId } = req.params;
      const [club] = await db.select().from(dbClubs).where(eq(dbClubs.id, id));
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
        res.status(403).json({ error: "Not authorised to remove this member" });
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

// ─── Club Events API ──────────────────────────────────────────────────────────
import { clubEvents, clubFeed } from "../shared/schema.js";

/** GET /api/clubs/:id/events — list all events for a club */
clubsRouter.get("/:id/events", async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const db = await getDb();
    const rows = await db
      .select()
      .from(clubEvents)
      .where(eq(clubEvents.clubId, id))
      .orderBy(desc(clubEvents.startAt));
    res.json(rows.map((r: typeof clubEvents.$inferSelect) => ({
      ...r,
      startAt: r.startAt instanceof Date ? r.startAt.toISOString() : String(r.startAt),
      endAt: r.endAt instanceof Date ? r.endAt.toISOString() : r.endAt ? String(r.endAt) : null,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
      updatedAt: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : String(r.updatedAt),
    })));
  } catch (err) {
    console.error("[clubs] GET /:id/events error:", err);
    res.status(500).json({ error: "Failed to fetch club events" });
  }
});

/** POST /api/clubs/:id/events — create a club event */
clubsRouter.post("/:id/events", authMiddleware, async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = (req as any).userId as string;
  try {
    const db = await getDb();
    const [club] = await db.select().from(dbClubs).where(eq(dbClubs.id, id));
    if (!club) { res.status(404).json({ error: "Club not found" }); return; }
    const [membership] = await db.select().from(dbClubMembers)
      .where(and(eq(dbClubMembers.clubId, id), eq(dbClubMembers.userId, userId)));
    const isOwner = club.ownerId === userId;
    const isDirector = membership?.role === "director" || membership?.role === "owner";
    if (!isOwner && !isDirector) { res.status(403).json({ error: "Only directors can create events" }); return; }
    const body = req.body as any;
    const eventId = body.id ?? nanoid(16);
    await db.insert(clubEvents).values({
      id: eventId, clubId: id, title: body.title,
      description: body.description ?? null,
      startAt: new Date(body.startAt),
      endAt: body.endAt ? new Date(body.endAt) : null,
      venue: body.venue ?? null, address: body.address ?? null,
      admissionNote: body.admissionNote ?? null,
      coverImageUrl: body.coverImageUrl ?? null,
      accentColor: body.accentColor ?? "#4CAF50",
      creatorId: userId, creatorName: body.creatorName ?? "",
      isPublished: 1, eventType: body.eventType ?? "standard",
      tournamentId: body.tournamentId ?? null,
    });
    const [created] = await db.select().from(clubEvents).where(eq(clubEvents.id, eventId));
    res.status(201).json({
      ...created,
      startAt: created.startAt instanceof Date ? created.startAt.toISOString() : String(created.startAt),
      endAt: created.endAt instanceof Date ? created.endAt.toISOString() : created.endAt ? String(created.endAt) : null,
      createdAt: created.createdAt instanceof Date ? created.createdAt.toISOString() : String(created.createdAt),
      updatedAt: created.updatedAt instanceof Date ? created.updatedAt.toISOString() : String(created.updatedAt),
    });
  } catch (err) {
    console.error("[clubs] POST /:id/events error:", err);
    res.status(500).json({ error: "Failed to create club event" });
  }
});

/** DELETE /api/clubs/:id/events/:eventId */
clubsRouter.delete("/:id/events/:eventId", authMiddleware, async (req: Request, res: Response) => {
  const { id, eventId } = req.params;
  const userId = (req as any).userId as string;
  try {
    const db = await getDb();
    const [club] = await db.select().from(dbClubs).where(eq(dbClubs.id, id));
    if (!club) { res.status(404).json({ error: "Club not found" }); return; }
    const [membership] = await db.select().from(dbClubMembers)
      .where(and(eq(dbClubMembers.clubId, id), eq(dbClubMembers.userId, userId)));
    const isOwner = club.ownerId === userId;
    const isDirector = membership?.role === "director" || membership?.role === "owner";
    if (!isOwner && !isDirector) { res.status(403).json({ error: "Not authorised" }); return; }
    await db.delete(clubEvents).where(eq(clubEvents.id, eventId));
    res.json({ success: true });
  } catch (err) {
    console.error("[clubs] DELETE /:id/events/:eventId error:", err);
    res.status(500).json({ error: "Failed to delete event" });
  }
});

// ─── Club Feed API ────────────────────────────────────────────────────────────

/** GET /api/clubs/:id/feed — list feed posts */
clubsRouter.get("/:id/feed", async (req: Request, res: Response) => {
  const { id } = req.params;
  const limit = Math.min(parseInt((req.query.limit as string) ?? "50", 10), 100);
  try {
    const db = await getDb();
    const rows = await db.select().from(clubFeed)
      .where(eq(clubFeed.clubId, id))
      .orderBy(desc(clubFeed.isPinned), desc(clubFeed.createdAt))
      .limit(limit);
    res.json(rows.map((r: typeof clubFeed.$inferSelect) => ({
      ...r,
      isPinned: r.isPinned === 1,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
    })));
  } catch (err) {
    console.error("[clubs] GET /:id/feed error:", err);
    res.status(500).json({ error: "Failed to fetch club feed" });
  }
});

/** POST /api/clubs/:id/feed — create a feed post */
clubsRouter.post("/:id/feed", authMiddleware, async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = (req as any).userId as string;
  try {
    const db = await getDb();
    const [club] = await db.select().from(dbClubs).where(eq(dbClubs.id, id));
    if (!club) { res.status(404).json({ error: "Club not found" }); return; }
    const [membership] = await db.select().from(dbClubMembers)
      .where(and(eq(dbClubMembers.clubId, id), eq(dbClubMembers.userId, userId)));
    const isOwner = club.ownerId === userId;
    if (!isOwner && !membership) { res.status(403).json({ error: "Must be a club member to post" }); return; }
    const body = req.body as any;
    const feedId = body.id ?? nanoid(16);
    await db.insert(clubFeed).values({
      id: feedId, clubId: id, type: body.type,
      actorName: body.actorName ?? "", actorAvatarUrl: body.actorAvatarUrl ?? null,
      detail: body.detail ?? null, linkHref: body.linkHref ?? null,
      linkLabel: body.linkLabel ?? null, isPinned: body.isPinned ? 1 : 0,
      payload: body.payload ?? null,
    });
    const [created] = await db.select().from(clubFeed).where(eq(clubFeed.id, feedId));
    res.status(201).json({
      ...created,
      isPinned: created.isPinned === 1,
      createdAt: created.createdAt instanceof Date ? created.createdAt.toISOString() : String(created.createdAt),
    });
  } catch (err) {
    console.error("[clubs] POST /:id/feed error:", err);
    res.status(500).json({ error: "Failed to create feed post" });
  }
});

/** DELETE /api/clubs/:id/feed/:feedId */
clubsRouter.delete("/:id/feed/:feedId", authMiddleware, async (req: Request, res: Response) => {
  const { id, feedId } = req.params;
  const userId = (req as any).userId as string;
  try {
    const db = await getDb();
    const [club] = await db.select().from(dbClubs).where(eq(dbClubs.id, id));
    if (!club) { res.status(404).json({ error: "Club not found" }); return; }
    const [membership] = await db.select().from(dbClubMembers)
      .where(and(eq(dbClubMembers.clubId, id), eq(dbClubMembers.userId, userId)));
    const isOwner = club.ownerId === userId;
    const isDirector = membership?.role === "director" || membership?.role === "owner";
    if (!isOwner && !isDirector) { res.status(403).json({ error: "Not authorised" }); return; }
    await db.delete(clubFeed).where(eq(clubFeed.id, feedId));
    res.json({ success: true });
  } catch (err) {
    console.error("[clubs] DELETE /:id/feed/:feedId error:", err);
    res.status(500).json({ error: "Failed to delete feed post" });
  }
});
