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
import {
  dbClubs,
  dbClubMembers,
  clubConversations,
  clubMessages,
  clubChessGames,
  clubInvites,
  clubBattles,
  clubEvents,
  clubEvents as dbClubEvents,
  clubFeed,
  clubFeed as dbClubFeed,
  clubEventRsvps,
  leagues,
  leaguePlayers,
  leagueWeeks,
  leagueMatches,
  leagueStandings,
  leagueJoinRequests,
  leagueInvites,
  rsvpForms,
  rsvpFormResponses,
  clubAlbums,
  clubAlbumPhotos,
  clubFeedAttachments,
} from "../shared/schema";
import { eq, and, desc, or, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { Request, Response } from "express";
import { requireAuth as authMiddleware, requireFullAuth } from "./auth.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { logger } from "./logger.js";
import { storageGetSignedUrl, storagePut } from "./storage.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Use /tmp/otb-uploads to avoid corrupted project uploads dir in sandbox
const AVATARS_DIR = "/tmp/otb-uploads/avatars";
const BANNERS_DIR = "/tmp/otb-uploads/banners";
try {
  if (!fs.existsSync(AVATARS_DIR)) fs.mkdirSync(AVATARS_DIR, { recursive: true });
  if (!fs.existsSync(BANNERS_DIR)) fs.mkdirSync(BANNERS_DIR, { recursive: true });
} catch (err) {
  logger.warn("clubs_upload_directory_unavailable", { error: err });
}

export const clubsRouter = Router();

// ── Club SSE broadcast infrastructure ────────────────────────────────────────
// One Set<ServerResponse> per club ID — mirrors the tournament SSE pattern.
const clubSseSubscribers = new Map<string, Set<import("http").ServerResponse>>();

/** Broadcast a named event to all SSE clients watching a club. */
function broadcastClubEvent(
  clubId: string,
  eventName: string,
  payload: Record<string, unknown>
) {
  const subs = clubSseSubscribers.get(clubId);
  if (!subs || subs.size === 0) return;
  const data = `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const res of Array.from(subs)) {
    try { res.write(data); } catch { /* client disconnected */ }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Read req.userId set by authMiddleware — returns it or sends 401 and returns null. */
function getUserId(req: Request, res: Response): string | null {
  const userId = (req as Request & { userId?: string }).userId;
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
    backgroundImage: row.backgroundImage ?? null,
    silkSpeed: row.silkSpeed ?? null,
    silkColor: row.silkColor ?? null,
    silkNoise: row.silkNoise ?? null,
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
    instagram: row.instagram ?? undefined,
    tiktok: row.tiktok ?? undefined,
    youtube: row.youtube ?? undefined,
    linktree: row.linktree ?? undefined,
    contactEmail: row.contactEmail ?? undefined,
    contactPhone: row.contactPhone ?? undefined,
    meetingSchedule: row.meetingSchedule ?? "weekly",
    meetingDay: row.meetingDay ?? undefined,
    meetingTime: row.meetingTime ?? undefined,
    meetingNotes: row.meetingNotes ?? undefined,
    joinPolicy: row.joinPolicy ?? "public",
    intakeQuestions: row.intakeQuestions ?? undefined,
    status: row.status ?? "published",
    announcement: row.announcement ?? undefined,
    // Landing page extended fields
    facebook: row.facebook ?? undefined,
    xUrl: row.xUrl ?? undefined,
    meetupUrl: row.meetupUrl ?? undefined,
    whatsapp: row.whatsapp ?? undefined,
    groupme: row.groupme ?? undefined,
    beginnerFriendly: row.beginnerFriendly === 1,
    isVerified: row.isVerified === 1,
    isClaimed: row.isClaimed === 1,
    city: row.city ?? undefined,
    region: row.region ?? undefined,
    venueName: row.venueName ?? undefined,
    eventCount: row.eventCount ?? 0,
    gamesPlayed: row.gamesPlayed ?? 0,
    newMembersThisMonth: row.newMembersThisMonth ?? 0,
    activeSince: row.activeSince instanceof Date
      ? row.activeSince.toISOString()
      : row.activeSince ? String(row.activeSince) : undefined,
    whatToExpect: row.whatToExpect ?? undefined,
    featuredEventId: row.featuredEventId ?? undefined,
    featuredTournamentId: row.featuredTournamentId ?? undefined,
    // Payment links
    paymentVenmo: row.paymentVenmo ?? undefined,
    paymentCashapp: row.paymentCashapp ?? undefined,
    paymentPaypal: row.paymentPaypal ?? undefined,
    paymentQrUrl: row.paymentQrUrl ?? undefined,
    paymentNote: row.paymentNote ?? undefined,
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
    const { search, category, limit, sort, country, city } = req.query as Record<string, string>;
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
          r.tagline.toLowerCase().includes(q) ||
          (r.description ?? "").toLowerCase().includes(q)
      );
    }
    if (category && category !== "all") {
      rows = rows.filter(
        (r: typeof dbClubs.$inferSelect) => r.category === category
      );
    }
    if (country && country !== "all") {
      rows = rows.filter(
        (r: typeof dbClubs.$inferSelect) => r.country === country
      );
    }
    if (city && city !== "all") {
      rows = rows.filter((r: typeof dbClubs.$inferSelect) => {
        const rowCity = (r.city ?? "").trim() || (r.location ?? "").split(",")[0].trim();
        return rowCity.toLowerCase() === city.toLowerCase();
      });
    }
    // Apply sort
    if (sort === "newest") {
      rows = [...rows].sort((a, b) => new Date(b.foundedAt ?? 0).getTime() - new Date(a.foundedAt ?? 0).getTime());
    } else if (sort === "tournaments") {
      rows = [...rows].sort((a, b) => (b.tournamentCount ?? 0) - (a.tournamentCount ?? 0));
    } else if (sort === "az") {
      rows = [...rows].sort((a, b) => a.name.localeCompare(b.name));
    }
    // Default sort (members) is already applied by the DB query
    const limitN = limit ? parseInt(limit, 10) : undefined;
    const sliced = limitN && limitN > 0 ? rows.slice(0, limitN) : rows;

    res.json({ clubs: sliced.map(dbRowToClub), total: rows.length });
  } catch (err) {
    logger.error("[clubs] GET / error:", err);
    res.status(500).json({ error: "Failed to list clubs" });
  }
});

// ── GET /api/clubs/mine — clubs the signed-in user belongs to ─────────────────
clubsRouter.get("/mine", authMiddleware, async (req: Request, res: Response) => {
  const userId = getUserId(req, res);
  if (!userId) return;
  try {
    const db = await getDb();
    // Collect club IDs from club_members rows
    const memberRows = await db
      .select()
      .from(dbClubMembers)
      .where(eq(dbClubMembers.userId, userId));
    const clubIdSet = new Set(memberRows.map((m: typeof dbClubMembers.$inferSelect) => m.clubId));

    // Also include clubs where the user is the owner (covers clubs inserted
    // directly via SQL that may not have a corresponding club_members row)
    const ownedRows = await db
      .select({ id: dbClubs.id })
      .from(dbClubs)
      .where(eq(dbClubs.ownerId, userId));
    ownedRows.forEach((r: { id: string }) => clubIdSet.add(r.id));

    const clubIds = Array.from(clubIdSet);
    if (clubIds.length === 0) {
      res.json([]);
      return;
    }
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
    logger.error("[clubs] GET /mine error:", err);
    res.status(500).json({ error: "Failed to list your clubs" });
  }
});

// ── GET /api/clubs/locations — distinct countries + cities for filter dropdown ──
// MUST be declared before /:id to avoid the wildcard swallowing "locations".
clubsRouter.get("/locations", async (_req: Request, res: Response) => {
  try {
    const db = await getDb();
    const rows = await db
      .select({
        country: dbClubs.country,
        city: dbClubs.city,
        location: dbClubs.location,
      })
      .from(dbClubs)
      .where(eq(dbClubs.isPublic, 1));

    // Build structured location tree: { country: string, cities: string[] }[]
    const countryMap = new Map<string, Set<string>>();
    for (const r of rows) {
      const country = (r.country ?? "").trim();
      if (!country) continue;
      if (!countryMap.has(country)) countryMap.set(country, new Set());
      // Prefer city column, fall back to parsing location string
      const city =
        (r.city ?? "").trim() ||
        (r.location ?? "").split(",")[0].trim();
      if (city) countryMap.get(country)!.add(city);
    }

    const COUNTRY_NAMES: Record<string, string> = {
      US: "United States", DE: "Germany", JP: "Japan",
      GB: "United Kingdom", BR: "Brazil", FR: "France",
      CA: "Canada", AU: "Australia",
    };

    const locations = Array.from(countryMap.entries())
      .map(([code, cities]) => ({
        code,
        name: COUNTRY_NAMES[code] ?? code,
        cities: Array.from(cities).sort(),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    res.json({ locations });
  } catch (err) {
    logger.error("[clubs] GET /locations error:", err);
    res.status(500).json({ error: "Failed to fetch locations" });
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
    logger.error("[clubs] GET /leaderboard error:", err);
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
    // Validate it's a proper base64 data URL
    const matches = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!matches) {
      res.status(400).json({ error: "Malformed data URL" });
      return;
    }
    // Check decoded size (max 5 MB)
    const buffer = Buffer.from(matches[2], "base64");
    if (buffer.length > 5 * 1024 * 1024) {
      res.status(413).json({ error: "Image too large (max 5 MB)" });
      return;
    }
    // Return the data URL directly — stored in the DB so it persists across deployments
    res.json({ url: dataUrl });
  } catch (err) {
    logger.error("[clubs] POST /upload-avatar error:", err);
    res.status(500).json({ error: "Failed to upload avatar" });
  }
});

// ── POST /api/clubs/upload-banner — upload a club banner image ──────────────
// Accepts a base64 data URL (up to 8 MB decoded), saves to disk, returns a served URL.
const bannerJsonParser = express.json({ limit: "15mb" });

clubsRouter.post("/upload-banner", requireFullAuth, bannerJsonParser, async (req: Request, res: Response) => {
  const userId = getUserId(req, res);
  if (!userId) return;
  try {
    const { dataUrl } = req.body as { dataUrl?: string };
    if (!dataUrl || !dataUrl.startsWith("data:image/")) {
      res.status(400).json({ error: "Invalid image data" });
      return;
    }
    const matches = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!matches) {
      res.status(400).json({ error: "Malformed data URL" });
      return;
    }
    const buffer = Buffer.from(matches[2], "base64");
    if (buffer.length > 8 * 1024 * 1024) {
      res.status(413).json({ error: "Banner too large (max 8 MB)" });
      return;
    }
    // Return the data URL directly — stored in the DB so it persists across deployments
    res.json({ url: dataUrl });
  } catch (err) {
    logger.error("[clubs] POST /upload-banner error:", err);
    res.status(500).json({ error: "Failed to upload banner" });
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
      backgroundImage = null,
      accentColor = "#4CAF50",
      ownerName = "",
      isPublic = true,
      website,
      twitter,
      discord,
      instagram,
      tiktok,
      youtube,
      linktree,
      contactEmail,
      contactPhone,
      meetingSchedule = "weekly",
      meetingDay,
      meetingTime,
      meetingNotes,
      joinPolicy = "public",
      intakeQuestions,
      status = "published",
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
      backgroundImage: backgroundImage || null,
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
      instagram: instagram || null,
      tiktok: tiktok || null,
      youtube: youtube || null,
      linktree: linktree || null,
      contactEmail: contactEmail || null,
      contactPhone: contactPhone || null,
      meetingSchedule,
      meetingDay: meetingDay || null,
      meetingTime: meetingTime || null,
      meetingNotes: meetingNotes || null,
      joinPolicy,
      intakeQuestions: intakeQuestions || null,
      status,
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

    await db.insert(clubAlbums).values([
      {
        id: nanoid(),
        clubId,
        title: "Club Photos",
        description: "A place for the club’s tournament nights, meetups, and community moments.",
        coverImageUrl: "/manus-storage/club-photos-default-cover_8e826089.jpg",
        createdById: userId,
        createdByName: ownerName,
        isPublished: 1,
      },
      {
        id: nanoid(),
        clubId,
        title: "Chess Tournaments",
        description: "Tournament moments and results from the club.",
        coverImageUrl: "/manus-storage/chess-tournaments_23c8b088.jpg",
        createdById: userId,
        createdByName: ownerName,
        isPublished: 1,
      },
      {
        id: nanoid(),
        clubId,
        title: "Chess Leagues",
        description: "League nights, standings, and club competition.",
        coverImageUrl: "/manus-storage/chess-leagues_770bca1d.jpg",
        createdById: userId,
        createdByName: ownerName,
        isPublished: 1,
      },
      {
        id: nanoid(),
        clubId,
        title: "Chess Club Meetups",
        description: "Casual over-the-board meetups and community moments.",
        coverImageUrl: "/manus-storage/chess-club-meetups_c17d81ae.jpg",
        createdById: userId,
        createdByName: ownerName,
        isPublished: 1,
      },
    ]);

    const [created] = await db
      .select()
      .from(dbClubs)
      .where(eq(dbClubs.id, clubId));
    res.status(201).json(dbRowToClub(created));
  } catch (err) {
    logger.error("[clubs] POST / error:", err);
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
        logger.error("[clubs] sync upsert error for club", c.id, innerErr);
      }
    }
    res.json({ upserted });
  } catch (err) {
    logger.error("[clubs] POST /sync error:", err);
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
    logger.error("[clubs] GET /:id error:", err);
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
      "instagram",
      "tiktok",
      "youtube",
      "linktree",
      "contactEmail",
      "contactPhone",
      "meetingSchedule",
      "meetingDay",
      "meetingTime",
      "meetingNotes",
      "joinPolicy",
      "intakeQuestions",
      "status",
      "announcement",
      "avatarUrl",
      "bannerUrl",
      "backgroundImage",
      "silkSpeed",
      "silkColor",
      "silkNoise",
      // Landing page extended fields
      "facebook",
      "xUrl",
      "meetupUrl",
      "whatsapp",
      "groupme",
      "beginnerFriendly",
      "isVerified",
      "isClaimed",
      "city",
      "region",
      "venueName",
      "eventCount",
      "gamesPlayed",
      "newMembersThisMonth",
      "activeSince",
      "whatToExpect",
      "featuredEventId",
      "featuredTournamentId",
      // Payment links
      "paymentVenmo",
      "paymentCashapp",
      "paymentPaypal",
      "paymentQrUrl",
      "paymentNote",
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
    const clubData = dbRowToClub(updated);
    // Broadcast club_updated so all open dashboards refresh their club data
    broadcastClubEvent(id, "club_updated", clubData as unknown as Record<string, unknown>);
    res.json(clubData);
  } catch (err) {
    logger.error("[clubs] PATCH /:id error:", err);
    res.status(500).json({ error: "Failed to update club" });
  }
});

// ── PATCH /api/clubs/:id/transfer-ownership — hand off ownership to a member ──
clubsRouter.patch("/:id/transfer-ownership", requireFullAuth, async (req: Request, res: Response) => {
  const userId = getUserId(req, res);
  if (!userId) return;
  try {
    const db = await getDb();
    const { id } = req.params;
    const { newOwnerId } = req.body as { newOwnerId: string };
    if (!newOwnerId) {
      res.status(400).json({ error: "newOwnerId is required" });
      return;
    }
    const [club] = await db.select().from(dbClubs).where(eq(dbClubs.id, id));
    if (!club) {
      res.status(404).json({ error: "Club not found" });
      return;
    }
    if (club.ownerId !== userId) {
      res.status(403).json({ error: "Only the current owner can transfer ownership" });
      return;
    }
    if (newOwnerId === userId) {
      res.status(400).json({ error: "You are already the owner" });
      return;
    }
    // Verify the new owner is an active member of the club
    const [newOwnerMembership] = await db
      .select()
      .from(dbClubMembers)
      .where(and(eq(dbClubMembers.clubId, id), eq(dbClubMembers.userId, newOwnerId)));
    if (!newOwnerMembership) {
      res.status(400).json({ error: "New owner must be an existing club member" });
      return;
    }
    // Transfer: update club ownerId, promote new owner to 'owner' role
    await db.update(dbClubs).set({ ownerId: newOwnerId }).where(eq(dbClubs.id, id));
    await db
      .update(dbClubMembers)
      .set({ role: "owner" })
      .where(and(eq(dbClubMembers.clubId, id), eq(dbClubMembers.userId, newOwnerId)));
    // Demote previous owner to member
    const [prevOwnerMembership] = await db
      .select()
      .from(dbClubMembers)
      .where(and(eq(dbClubMembers.clubId, id), eq(dbClubMembers.userId, userId)));
    if (prevOwnerMembership) {
      await db
        .update(dbClubMembers)
        .set({ role: "member" })
        .where(and(eq(dbClubMembers.clubId, id), eq(dbClubMembers.userId, userId)));
    } else {
      // Insert a member row for the previous owner so they stay in the club
      await db.insert(dbClubMembers).values({
        clubId: id,
        userId,
        role: "member",
        joinedAt: new Date(),
      });
    }
    const [updated] = await db.select().from(dbClubs).where(eq(dbClubs.id, id));
    res.json(dbRowToClub(updated));
  } catch (err) {
    logger.error("[clubs] PATCH /:id/transfer-ownership error:", err);
    res.status(500).json({ error: "Failed to transfer ownership" });
  }
});

// ── DELETE /api/clubs/:id — permanently delete a club (owner only) ────────────
clubsRouter.delete("/:id", requireFullAuth, async (req: Request, res: Response) => {
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
    if (club.ownerId !== userId) {
      res.status(403).json({ error: "Only the club owner can delete this club" });
      return;
    }
    // Cascade: delete all related data in dependency order
    // 1. League sub-tables
    const clubLeagueRows = await db.select({ id: leagues.id }).from(leagues).where(eq(leagues.clubId, id));
    for (const lg of clubLeagueRows) {
      await db.delete(leagueMatches).where(eq(leagueMatches.leagueId, lg.id));
      await db.delete(leagueStandings).where(eq(leagueStandings.leagueId, lg.id));
      await db.delete(leagueWeeks).where(eq(leagueWeeks.leagueId, lg.id));
      await db.delete(leaguePlayers).where(eq(leaguePlayers.leagueId, lg.id));
      await db.delete(leagueJoinRequests).where(eq(leagueJoinRequests.leagueId, lg.id));
      await db.delete(leagueInvites).where(eq(leagueInvites.leagueId, lg.id));
    }
    await db.delete(leagues).where(eq(leagues.clubId, id));
    // 2. Club events and RSVPs
    const evRows = await db.select({ id: dbClubEvents.id }).from(dbClubEvents).where(eq(dbClubEvents.clubId, id));
    for (const ev of evRows) {
      await db.delete(clubEventRsvps).where(eq(clubEventRsvps.eventId, ev.id));
    }
    await db.delete(dbClubEvents).where(eq(dbClubEvents.clubId, id));
    // 3. Feed
    await db.delete(dbClubFeed).where(eq(dbClubFeed.clubId, id));
    // 4. Battles
    await db.delete(clubBattles).where(eq(clubBattles.clubId, id));
    // 5. Invites
    await db.delete(clubInvites).where(eq(clubInvites.clubId, id));
    // 6. Messaging
    const convRows = await db.select({ id: clubConversations.id }).from(clubConversations).where(eq(clubConversations.clubId, id));
    for (const conv of convRows) {
      await db.delete(clubChessGames).where(eq(clubChessGames.conversationId, conv.id));
      await db.delete(clubMessages).where(eq(clubMessages.conversationId, conv.id));
    }
    await db.delete(clubConversations).where(eq(clubConversations.clubId, id));
    // 7. Members
    await db.delete(dbClubMembers).where(eq(dbClubMembers.clubId, id));
    // 8. The club itself
    await db.delete(dbClubs).where(eq(dbClubs.id, id));
    res.json({ success: true });
  } catch (err) {
    logger.error("[clubs] DELETE /:id error:", err);
    res.status(500).json({ error: "Failed to delete club" });
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
    logger.error("[clubs] GET /:id/members error:", err);
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
    // Atomic increment — avoids race condition from read-then-write
    await db.update(dbClubs)
      .set({ memberCount: sql`member_count + 1` })
      .where(eq(dbClubs.id, id));
    // Broadcast to all SSE clients watching this club
    broadcastClubEvent(id, "member_joined", {
      userId,
      displayName,
      chesscomUsername: chesscomUsername || null,
      avatarUrl: avatarUrl || null,
    });

    res.status(201).json({ success: true });
  } catch (err) {
    logger.error("[clubs] POST /:id/members error:", err);
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
    logger.error("[clubs] POST /:id/heartbeat error:", err);
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
    logger.error("[clubs] GET /:id/presence error:", err);
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

      // Atomic decrement — avoids race condition from read-then-write
      await db.update(dbClubs)
        .set({ memberCount: sql`GREATEST(member_count - 1, 0)` })
        .where(eq(dbClubs.id, id));
      // Broadcast member_left to all SSE clients watching this club
      broadcastClubEvent(id, "member_left", { userId: memberId });
      res.json({ success: true });
    } catch (err) {
      logger.error("[clubs] DELETE /:id/members/:memberId error:", err);
      res.status(500).json({ error: "Failed to remove member" });
    }
  }
);

// ─── Club Events API ──────────────────────────────────────────────────────────

/**
 * GET /api/clubs/by-tournament/:tournamentId — look up the club event linked to a tournament.
 * Returns { eventId, clubId } so the Director page can link to /clubs/:clubId/meetup/:eventId.
 * IMPORTANT: Must be registered before GET /:id/events to avoid Express routing conflicts.
 */
clubsRouter.get("/by-tournament/:tournamentId", async (req: Request, res: Response) => {
  const { tournamentId } = req.params;
  try {
    const db = await getDb();
    const [row] = await db
      .select({ id: clubEvents.id, clubId: clubEvents.clubId })
      .from(clubEvents)
      .where(eq(clubEvents.tournamentId, tournamentId))
      .limit(1);
    if (!row) { res.status(404).json({ error: "No club event found for this tournament" }); return; }
    res.json({ eventId: row.id, clubId: row.clubId });
  } catch (err) {
    logger.error("[clubs] GET /by-tournament/:tournamentId error:", err);
    res.status(500).json({ error: "Failed to look up club event" });
  }
});

/**
 * GET /api/clubs/event/:eventId — fetch a single event by ID (no clubId required, used by QR check-in flow)
 * IMPORTANT: This MUST be registered before GET /:id/events to prevent Express from matching
 * "event" as the :id parameter and routing to the wrong handler.
 */
clubsRouter.get("/event/:eventId", async (req: Request, res: Response) => {
  const { eventId } = req.params;
  try {
    const db = await getDb();
    const [row] = await db.select().from(clubEvents).where(eq(clubEvents.id, eventId));
    if (!row) { res.status(404).json({ error: "Event not found" }); return; }
    res.json({
      ...row,
      startAt: row.startAt instanceof Date ? row.startAt.toISOString() : String(row.startAt),
      endAt: row.endAt instanceof Date ? row.endAt.toISOString() : row.endAt ? String(row.endAt) : null,
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
      updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
    });
  } catch (err) {
    logger.error("[clubs] GET /event/:eventId error:", err);
    res.status(500).json({ error: "Failed to fetch event" });
  }
});

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
    logger.error("[clubs] GET /:id/events error:", err);
    res.status(500).json({ error: "Failed to fetch club events" });
  }
});

/** POST /api/clubs/:id/events — create a club event */
clubsRouter.post("/:id/events", authMiddleware, async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = getUserId(req, res);
  if (!userId) return;
  try {
    const db = await getDb();
    const [club] = await db.select().from(dbClubs).where(eq(dbClubs.id, id));
    if (!club) { res.status(404).json({ error: "Club not found" }); return; }
    const [membership] = await db.select().from(dbClubMembers)
      .where(and(eq(dbClubMembers.clubId, id), eq(dbClubMembers.userId, userId)));
    const isOwner = club.ownerId === userId;
    const isDirector = membership?.role === "director" || membership?.role === "owner";
    if (!isOwner && !isDirector) { res.status(403).json({ error: "Only directors can create events" }); return; }
    const body = req.body as typeof clubEvents.$inferInsert;
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
      recurrence: body.recurrence ?? "none",
      recurrenceSeriesId: body.recurrenceSeriesId ?? null,
      recurrenceEndDate: body.recurrenceEndDate ?? null,
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
    logger.error("[clubs] POST /:id/events error:", err);
    res.status(500).json({ error: "Failed to create club event" });
  }
});

/** DELETE /api/clubs/:id/events/:eventId */
clubsRouter.delete("/:id/events/:eventId", authMiddleware, async (req: Request, res: Response) => {
  const { id, eventId } = req.params;
  const userId = getUserId(req, res);
  if (!userId) return;
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
    logger.error("[clubs] DELETE /:id/events/:eventId error:", err);
    res.status(500).json({ error: "Failed to delete event" });
  }
});

// ─── Club Feed API ────────────────────────────────────────────────────────────

const FEED_ATTACHMENT_MAX_COUNT = 4;
const FEED_ATTACHMENT_MAX_BYTES = 6 * 1024 * 1024;
const FEED_ATTACHMENT_MAX_TOTAL_BYTES = 16 * 1024 * 1024;
const FEED_ATTACHMENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
]);

type FeedAttachmentInput = {
  dataUrl?: string;
  fileName?: string;
  mimeType?: string;
};

function cleanFeedAttachmentName(value: string | undefined, index: number) {
  const fallback = `attachment-${index + 1}`;
  const normalized = Array.from(value ?? fallback)
    .filter((character) => character.charCodeAt(0) >= 32)
    .join("")
    .replace(/[\\/]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  return (normalized || fallback).slice(0, 180);
}

function parseFeedAttachment(input: FeedAttachmentInput, index: number) {
  const match = input.dataUrl?.match(/^data:([a-z0-9.+-]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/i);
  const mimeType = input.mimeType?.toLowerCase() ?? match?.[1]?.toLowerCase();
  if (!match || !mimeType || match[1].toLowerCase() !== mimeType || !FEED_ATTACHMENT_TYPES.has(mimeType)) {
    throw new Error("Upload a JPEG, PNG, WebP, GIF, PDF, or text file");
  }
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length === 0 || bytes.length > FEED_ATTACHMENT_MAX_BYTES) {
    throw new Error("Each attachment must be 6 MB or smaller");
  }
  const extension = mimeType === "image/jpeg" ? "jpg" : mimeType === "text/plain" ? "txt" : mimeType.split("/")[1];
  return { bytes, mimeType, extension, fileName: cleanFeedAttachmentName(input.fileName, index) };
}

async function isActiveClubMember(clubId: string, ownerId: string, userId: string) {
  if (ownerId === userId) return true;
  const db = await getDb();
  const [membership] = await db.select({ id: dbClubMembers.id }).from(dbClubMembers)
    .where(and(eq(dbClubMembers.clubId, clubId), eq(dbClubMembers.userId, userId)))
    .limit(1);
  return Boolean(membership);
}

function feedAttachmentResponse(clubId: string, feedId: string, attachment: typeof clubFeedAttachments.$inferSelect) {
  return {
    id: attachment.id,
    fileName: attachment.fileName,
    mimeType: attachment.mimeType,
    byteSize: attachment.byteSize,
    url: `/api/clubs/${clubId}/feed/${feedId}/attachments/${attachment.id}/file`,
  };
}

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
    const attachments = rows.length > 0
      ? await db.select().from(clubFeedAttachments)
        .where(eq(clubFeedAttachments.clubId, id))
        .orderBy(clubFeedAttachments.sortOrder, clubFeedAttachments.createdAt)
      : [];
    const attachmentsByFeedId = new Map<string, typeof attachments>();
    for (const attachment of attachments) {
      const collection = attachmentsByFeedId.get(attachment.feedId) ?? [];
      collection.push(attachment);
      attachmentsByFeedId.set(attachment.feedId, collection);
    }
    res.json(rows.map((r: typeof clubFeed.$inferSelect) => ({
      ...r,
      isPinned: r.isPinned === 1,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
      attachments: (attachmentsByFeedId.get(r.id) ?? []).map((attachment) => feedAttachmentResponse(id, r.id, attachment)),
    })));
  } catch (err) {
    logger.error("[clubs] GET /:id/feed error:", err);
    res.status(500).json({ error: "Failed to fetch club feed" });
  }
});

/** GET /api/clubs/:id/feed/:feedId/attachments/:attachmentId/file — authenticated, revocable attachment proxy */
clubsRouter.get("/:id/feed/:feedId/attachments/:attachmentId/file", requireFullAuth, async (req: Request, res: Response) => {
  const userId = getUserId(req, res);
  if (!userId) return;
  try {
    const { id, feedId, attachmentId } = req.params;
    const db = await getDb();
    const [club] = await db.select().from(dbClubs).where(eq(dbClubs.id, id)).limit(1);
    if (!club || !(await isActiveClubMember(club.id, club.ownerId, userId))) {
      res.status(404).send("Attachment not found");
      return;
    }
    const [attachment] = await db.select().from(clubFeedAttachments).where(and(
      eq(clubFeedAttachments.id, attachmentId),
      eq(clubFeedAttachments.feedId, feedId),
      eq(clubFeedAttachments.clubId, id),
    )).limit(1);
    if (!attachment) {
      res.status(404).send("Attachment not found");
      return;
    }
    res.set("Cache-Control", "no-store");
    res.redirect(307, await storageGetSignedUrl(attachment.storageKey));
  } catch (error) {
    logger.error("club_feed_attachment_read_failed", { clubId: req.params.id, feedId: req.params.feedId, attachmentId: req.params.attachmentId, error });
    res.status(502).send("Attachment is temporarily unavailable");
  }
});

/** POST /api/clubs/:id/feed — create a feed post */
const feedPostJsonParser = express.json({ limit: "22mb" });
clubsRouter.post("/:id/feed", requireFullAuth, feedPostJsonParser, async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = getUserId(req, res);
  if (!userId) return;
  try {
    const db = await getDb();
    const [club] = await db.select().from(dbClubs).where(eq(dbClubs.id, id));
    if (!club) { res.status(404).json({ error: "Club not found" }); return; }
    const [membership] = await db.select().from(dbClubMembers)
      .where(and(eq(dbClubMembers.clubId, id), eq(dbClubMembers.userId, userId)));
    const isOwner = club.ownerId === userId;
    if (!isOwner && !membership) { res.status(403).json({ error: "Active club membership required" }); return; }
    const body = req.body as typeof clubFeed.$inferInsert & { attachments?: FeedAttachmentInput[] };
    if (!body.type || typeof body.type !== "string" || body.type.length > 40) {
      res.status(400).json({ error: "A valid post type is required" }); return;
    }
    const cleanDetail = body.detail?.trim() ?? "";
    if (body.type === "announcement" && !cleanDetail) {
      res.status(400).json({ error: "Write a message before posting" }); return;
    }
    if (cleanDetail.length > 5000) {
      res.status(400).json({ error: "Post text must be 5,000 characters or fewer" }); return;
    }
    if (body.attachments && (!Array.isArray(body.attachments) || body.attachments.length > FEED_ATTACHMENT_MAX_COUNT)) {
      res.status(400).json({ error: `Add up to ${FEED_ATTACHMENT_MAX_COUNT} attachments per post` }); return;
    }
    let preparedAttachments: ReturnType<typeof parseFeedAttachment>[] = [];
    try {
      preparedAttachments = (body.attachments ?? []).map(parseFeedAttachment);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Invalid attachment" }); return;
    }
    if (preparedAttachments.reduce((total, attachment) => total + attachment.bytes.length, 0) > FEED_ATTACHMENT_MAX_TOTAL_BYTES) {
      res.status(413).json({ error: "Attachments must total 16 MB or less" }); return;
    }
    const feedId = body.id ?? nanoid(16);
    await db.insert(clubFeed).values({
      id: feedId, clubId: id, type: body.type,
      actorName: body.actorName ?? "", actorAvatarUrl: body.actorAvatarUrl ?? null,
      detail: cleanDetail || null, linkHref: body.linkHref ?? null,
      linkLabel: body.linkLabel ?? null, isPinned: body.isPinned ? 1 : 0,
      payload: body.payload ?? null, createdBy: userId,
    });
    const storedAttachments = [];
    for (let index = 0; index < preparedAttachments.length; index += 1) {
      const attachment = preparedAttachments[index];
      if (!attachment) continue;
      const attachmentId = nanoid(20);
      const { key } = await storagePut(`club-feed/${id}/${feedId}/${attachmentId}.${attachment.extension}`, attachment.bytes, attachment.mimeType);
      await db.insert(clubFeedAttachments).values({
        id: attachmentId,
        feedId,
        clubId: id,
        storageKey: key,
        fileName: attachment.fileName,
        mimeType: attachment.mimeType,
        byteSize: attachment.bytes.length,
        sortOrder: index,
        createdBy: userId,
      });
      storedAttachments.push({ id: attachmentId, fileName: attachment.fileName, mimeType: attachment.mimeType, byteSize: attachment.bytes.length, url: `/api/clubs/${id}/feed/${feedId}/attachments/${attachmentId}/file` });
    }
    const [created] = await db.select().from(clubFeed).where(eq(clubFeed.id, feedId));
    res.status(201).json({
      ...created,
      isPinned: created.isPinned === 1,
      createdAt: created.createdAt instanceof Date ? created.createdAt.toISOString() : String(created.createdAt),
      attachments: storedAttachments,
    });
  } catch (err) {
    logger.error("[clubs] POST /:id/feed error:", err);
    res.status(500).json({ error: "Failed to create feed post" });
  }
});

/** DELETE /api/clubs/:id/feed/:feedId */
clubsRouter.delete("/:id/feed/:feedId", authMiddleware, async (req: Request, res: Response) => {
  const { id, feedId } = req.params;
  const userId = getUserId(req, res);
  if (!userId) return;
  try {
    const db = await getDb();
    const [club] = await db.select().from(dbClubs).where(eq(dbClubs.id, id));
    if (!club) { res.status(404).json({ error: "Club not found" }); return; }
    const isOwner = club.ownerId === userId;
    const [post] = await db.select().from(clubFeed).where(and(eq(clubFeed.id, feedId), eq(clubFeed.clubId, id))).limit(1);
    if (!post) { res.status(404).json({ error: "Post not found" }); return; }
    if (!isOwner && post.createdBy !== userId) { res.status(403).json({ error: "Only the original poster or club owner can delete this post" }); return; }
    await db.delete(clubFeedAttachments).where(and(eq(clubFeedAttachments.feedId, feedId), eq(clubFeedAttachments.clubId, id)));
    await db.delete(clubFeed).where(and(eq(clubFeed.id, feedId), eq(clubFeed.clubId, id)));
    res.json({ success: true });
  } catch (err) {
    logger.error("[clubs] DELETE /:id/feed/:feedId error:", err);
    res.status(500).json({ error: "Failed to delete feed post" });
  }
});


// ── RSVP routes ───────────────────────────────────────────────────────────────

/** GET /api/clubs/:id/events/:eventId/rsvps — list all RSVPs for an event */
clubsRouter.get("/:id/events/:eventId/rsvps", async (req: Request, res: Response) => {
  const { id, eventId } = req.params;
  try {
    const db = await getDb();
    const { clubEventRsvps } = await import("../shared/schema.js");
    const rows = await db.select().from(clubEventRsvps)
      .where(and(eq(clubEventRsvps.clubId, id), eq(clubEventRsvps.eventId, eventId)));
    res.json(rows.map((r: typeof clubEventRsvps.$inferSelect) => ({
      id: r.id,
      eventId: r.eventId,
      clubId: r.clubId,
      userId: r.userId,
      displayName: r.displayName,
      avatarUrl: r.avatarUrl ?? null,
      status: r.status,
      updatedAt: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : String(r.updatedAt),
    })));
  } catch (err) {
    logger.error("[clubs] GET /:id/events/:eventId/rsvps error:", err);
    res.status(500).json({ error: "Failed to fetch RSVPs" });
  }
});

/** GET /api/clubs/:id/events/:eventId/rsvps/payment-statuses — owner/director-only private manual status view */
clubsRouter.get("/:id/events/:eventId/rsvps/payment-statuses", authMiddleware, async (req: Request, res: Response) => {
  const { id, eventId } = req.params;
  const userId = getUserId(req, res);
  if (!userId) return;
  try {
    const db = await getDb();
    const [club] = await db.select().from(dbClubs).where(eq(dbClubs.id, id));
    if (!club) { res.status(404).json({ error: "Club not found" }); return; }
    const [membership] = await db.select().from(dbClubMembers)
      .where(and(eq(dbClubMembers.clubId, id), eq(dbClubMembers.userId, userId)));
    const isManager = club.ownerId === userId || membership?.role === "owner" || membership?.role === "director";
    if (!isManager) { res.status(403).json({ error: "Owner or director access required" }); return; }
    const [event] = await db.select({ id: clubEvents.id }).from(clubEvents)
      .where(and(eq(clubEvents.id, eventId), eq(clubEvents.clubId, id)));
    if (!event) { res.status(404).json({ error: "Event not found" }); return; }
    const rows = await db.select({
      userId: clubEventRsvps.userId,
      paymentStatus: clubEventRsvps.paymentStatus,
      paymentUpdatedAt: clubEventRsvps.paymentUpdatedAt,
      paymentUpdatedBy: clubEventRsvps.paymentUpdatedBy,
    }).from(clubEventRsvps).where(and(eq(clubEventRsvps.clubId, id), eq(clubEventRsvps.eventId, eventId)));
    res.json(rows.map((row) => ({
      ...row,
      paymentUpdatedAt: row.paymentUpdatedAt instanceof Date ? row.paymentUpdatedAt.toISOString() : row.paymentUpdatedAt ? String(row.paymentUpdatedAt) : null,
    })));
  } catch (err) {
    logger.error("[clubs] GET private RSVP payment statuses error:", err);
    res.status(500).json({ error: "Failed to fetch payment statuses" });
  }
});

/** PATCH /api/clubs/:id/events/:eventId/rsvps/:rsvpUserId/payment-status — owner/director-only manual confirmation */
clubsRouter.patch("/:id/events/:eventId/rsvps/:rsvpUserId/payment-status", authMiddleware, async (req: Request, res: Response) => {
  const { id, eventId, rsvpUserId } = req.params;
  const userId = getUserId(req, res);
  if (!userId) return;
  const { paymentStatus } = req.body as { paymentStatus?: string };
  const allowedStatuses = ["untracked", "pending", "confirmed", "waived"] as const;
  if (!paymentStatus || !allowedStatuses.includes(paymentStatus as typeof allowedStatuses[number])) {
    res.status(400).json({ error: "paymentStatus must be untracked | pending | confirmed | waived" });
    return;
  }
  try {
    const db = await getDb();
    const [club] = await db.select().from(dbClubs).where(eq(dbClubs.id, id));
    if (!club) { res.status(404).json({ error: "Club not found" }); return; }
    const [membership] = await db.select().from(dbClubMembers)
      .where(and(eq(dbClubMembers.clubId, id), eq(dbClubMembers.userId, userId)));
    const isManager = club.ownerId === userId || membership?.role === "owner" || membership?.role === "director";
    if (!isManager) { res.status(403).json({ error: "Owner or director access required" }); return; }
    const [existing] = await db.select().from(clubEventRsvps).where(and(
      eq(clubEventRsvps.clubId, id),
      eq(clubEventRsvps.eventId, eventId),
      eq(clubEventRsvps.userId, rsvpUserId),
    ));
    if (!existing) { res.status(404).json({ error: "RSVP not found" }); return; }
    const paymentUpdatedAt = new Date();
    await db.update(clubEventRsvps).set({
      paymentStatus,
      paymentUpdatedAt,
      paymentUpdatedBy: userId,
    }).where(eq(clubEventRsvps.id, existing.id));
    res.json({
      userId: rsvpUserId,
      paymentStatus,
      paymentUpdatedAt: paymentUpdatedAt.toISOString(),
      paymentUpdatedBy: userId,
    });
  } catch (err) {
    logger.error("[clubs] PATCH private RSVP payment status error:", err);
    res.status(500).json({ error: "Failed to update payment status" });
  }
});

/** POST /api/clubs/:id/events/:eventId/rsvps — upsert the caller's RSVP */
clubsRouter.post("/:id/events/:eventId/rsvps", authMiddleware, async (req: Request, res: Response) => {
  const { id, eventId } = req.params;
  const userId = getUserId(req, res);
  if (!userId) return;
  const { status, displayName, avatarUrl } = req.body as {
    status: "going" | "maybe" | "not_going";
    displayName?: string;
    avatarUrl?: string | null;
  };
  if (!["going", "maybe", "not_going"].includes(status)) {
    res.status(400).json({ error: "status must be going | maybe | not_going" });
    return;
  }
  try {
    const db = await getDb();
    const { clubEventRsvps } = await import("../shared/schema.js");
    const [existing] = await db.select().from(clubEventRsvps)
      .where(and(eq(clubEventRsvps.eventId, eventId), eq(clubEventRsvps.userId, userId)));
    if (existing) {
      await db.update(clubEventRsvps)
        .set({ status, displayName: displayName ?? existing.displayName, avatarUrl: avatarUrl ?? existing.avatarUrl })
        .where(and(eq(clubEventRsvps.eventId, eventId), eq(clubEventRsvps.userId, userId)));
      const [updated] = await db.select().from(clubEventRsvps)
        .where(and(eq(clubEventRsvps.eventId, eventId), eq(clubEventRsvps.userId, userId)));
      res.json({
        ...updated,
        updatedAt: updated.updatedAt instanceof Date ? updated.updatedAt.toISOString() : String(updated.updatedAt),
      });
    } else {
      const rsvpId = nanoid(16);
      await db.insert(clubEventRsvps).values({
        id: rsvpId, eventId, clubId: id, userId,
        displayName: displayName ?? "", avatarUrl: avatarUrl ?? null, status,
      });
      const [created] = await db.select().from(clubEventRsvps)
        .where(and(eq(clubEventRsvps.eventId, eventId), eq(clubEventRsvps.userId, userId)));
      res.status(201).json({
        ...created,
        updatedAt: created.updatedAt instanceof Date ? created.updatedAt.toISOString() : String(created.updatedAt),
      });
    }
  } catch (err) {
    logger.error("[clubs] POST /:id/events/:eventId/rsvps error:", err);
    res.status(500).json({ error: "Failed to upsert RSVP" });
  }
});

/** DELETE /api/clubs/:id/events/:eventId/rsvps — remove the caller's RSVP */
clubsRouter.delete("/:id/events/:eventId/rsvps", authMiddleware, async (req: Request, res: Response) => {
  const { id: _clubId, eventId } = req.params;
  const userId = getUserId(req, res);
  if (!userId) return;
  try {
    const db = await getDb();
    const { clubEventRsvps } = await import("../shared/schema.js");
    await db.delete(clubEventRsvps)
      .where(and(eq(clubEventRsvps.eventId, eventId), eq(clubEventRsvps.userId, userId)));
    res.json({ success: true });
  } catch (err) {
    logger.error("[clubs] DELETE /:id/events/:eventId/rsvps error:", err);
    res.status(500).json({ error: "Failed to remove RSVP" });
  }
});

// ─── Meetup Check-in Endpoints ───────────────────────────────────────────────

/** POST /api/clubs/:id/events/:eventId/checkin — record a check-in for the caller */
clubsRouter.post("/:id/events/:eventId/checkin", authMiddleware, async (req: Request, res: Response) => {
  const { eventId } = req.params;
  const userId = getUserId(req, res);
  if (!userId) return;
  const { displayName, avatarUrl, chesscomUsername, clubId } = req.body as {
    displayName?: string;
    avatarUrl?: string | null;
    chesscomUsername?: string | null;
    clubId?: string;
  };
  try {
    const db = await getDb();
    const { meetupCheckins } = await import("../shared/schema.js");
    const existing = await db.select().from(meetupCheckins)
      .where(and(eq(meetupCheckins.eventId, eventId), eq(meetupCheckins.userId, userId)));
    if (existing.length > 0) {
      return res.json(existing[0]);
    }
    const id = nanoid(16);
    await db.insert(meetupCheckins).values({
      id,
      eventId,
      clubId: clubId ?? req.params.id,
      userId,
      displayName: displayName ?? userId,
      avatarUrl: avatarUrl ?? null,
      chesscomUsername: chesscomUsername ?? null,
    });
    const [created] = await db.select().from(meetupCheckins)
      .where(and(eq(meetupCheckins.eventId, eventId), eq(meetupCheckins.userId, userId)));
    return res.status(201).json(created);
  } catch (err) {
    logger.error("[clubs] POST /:id/events/:eventId/checkin error:", err);
    return res.status(500).json({ error: "Failed to record check-in" });
  }
});

/** GET /api/clubs/:id/events/:eventId/checkins — list all check-ins for an event */
clubsRouter.get("/:id/events/:eventId/checkins", async (req: Request, res: Response) => {
  const { eventId } = req.params;
  try {
    const db = await getDb();
    const { meetupCheckins } = await import("../shared/schema.js");
    const rows = await db.select().from(meetupCheckins)
      .where(eq(meetupCheckins.eventId, eventId));
    return res.json(rows.map((r: typeof meetupCheckins.$inferSelect) => ({
      ...r,
      checkedInAt: r.checkedInAt instanceof Date ? r.checkedInAt.toISOString() : String(r.checkedInAt),
    })));
  } catch (err) {
    logger.error("[clubs] GET /:id/events/:eventId/checkins error:", err);
    return res.status(500).json({ error: "Failed to fetch check-ins" });
  }
});

// ── PATCH /api/clubs/:id/members/:memberId/role — promote/demote a member ─────
clubsRouter.patch(
  "/:id/members/:memberId/role",
  requireFullAuth,
  async (req: Request, res: Response) => {
    const requesterId = getUserId(req, res);
    if (!requesterId) return;
    try {
      const db = await getDb();
      const { id, memberId } = req.params;
      const { role } = req.body as { role: "director" | "member" };
      if (!["director", "member"].includes(role)) {
        res.status(400).json({ error: "Role must be 'director' or 'member'" });
        return;
      }
      const [club] = await db.select().from(dbClubs).where(eq(dbClubs.id, id));
      if (!club) { res.status(404).json({ error: "Club not found" }); return; }
      const isOwner = club.ownerId === requesterId;
      const [requesterMembership] = await db
        .select()
        .from(dbClubMembers)
        .where(and(eq(dbClubMembers.clubId, id), eq(dbClubMembers.userId, requesterId)));
      const isDirector = requesterMembership?.role === "director";
      if (!isOwner && !isDirector) {
        res.status(403).json({ error: "Only owners and directors can change roles" });
        return;
      }
      if (!isOwner && role === "director") {
        res.status(403).json({ error: "Only the club owner can promote to director" });
        return;
      }
      if (memberId === club.ownerId) {
        res.status(400).json({ error: "Cannot change the owner's role" });
        return;
      }
      await db
        .update(dbClubMembers)
        .set({ role })
        .where(and(eq(dbClubMembers.clubId, id), eq(dbClubMembers.userId, memberId)));
      res.json({ success: true, role });
    } catch (err) {
      logger.error("[clubs] PATCH /:id/members/:memberId/role error:", err);
      res.status(500).json({ error: "Failed to update member role" });
    }
  }
);

// ── POST /api/clubs/:id/events/:eventId/checkin-admin — owner checks in a user ─
clubsRouter.post(
  "/:id/events/:eventId/checkin-admin",
  requireFullAuth,
  async (req: Request, res: Response) => {
    const requesterId = getUserId(req, res);
    if (!requesterId) return;
    try {
      const db = await getDb();
      const { id, eventId } = req.params;
      const { userId: targetUserId, displayName, avatarUrl, chesscomUsername, isWalkIn } = req.body as {
        userId?: string;
        displayName?: string;
        avatarUrl?: string | null;
        chesscomUsername?: string | null;
        isWalkIn?: boolean;
      };
      const [club] = await db.select().from(dbClubs).where(eq(dbClubs.id, id));
      if (!club) { res.status(404).json({ error: "Club not found" }); return; }
      const isOwner = club.ownerId === requesterId;
      const [requesterMembership] = await db
        .select()
        .from(dbClubMembers)
        .where(and(eq(dbClubMembers.clubId, id), eq(dbClubMembers.userId, requesterId)));
      const isDirectorRole = requesterMembership?.role === "director";
      if (!isOwner && !isDirectorRole) {
        res.status(403).json({ error: "Only owners and directors can check in attendees" });
        return;
      }
      const { meetupCheckins } = await import("../shared/schema.js");
      const effectiveUserId = targetUserId ?? `walkin_${nanoid(10)}`;
      const effectiveName = displayName ?? effectiveUserId;
      const existing = await db.select().from(meetupCheckins)
        .where(and(eq(meetupCheckins.eventId, eventId), eq(meetupCheckins.userId, effectiveUserId)));
      if (existing.length > 0) {
        return res.json({ ...existing[0], alreadyCheckedIn: true });
      }
      const checkinId = nanoid(16);
      await db.insert(meetupCheckins).values({
        id: checkinId,
        eventId,
        clubId: id,
        userId: effectiveUserId,
        displayName: effectiveName,
        avatarUrl: avatarUrl ?? null,
        chesscomUsername: chesscomUsername ?? null,
      });
      const [created] = await db.select().from(meetupCheckins)
        .where(and(eq(meetupCheckins.eventId, eventId), eq(meetupCheckins.userId, effectiveUserId)));
      return res.status(201).json({ ...created, isWalkIn: isWalkIn ?? false });
    } catch (err) {
      logger.error("[clubs] POST /:id/events/:eventId/checkin-admin error:", err);
      return res.status(500).json({ error: "Failed to check in attendee" });
    }
  }
);

// ── DELETE /api/clubs/:id/events/:eventId/checkin-admin/:userId — undo check-in
clubsRouter.delete(
  "/:id/events/:eventId/checkin-admin/:userId",
  requireFullAuth,
  async (req: Request, res: Response) => {
    const requesterId = getUserId(req, res);
    if (!requesterId) return;
    try {
      const db = await getDb();
      const { id, eventId, userId: targetUserId } = req.params;
      const [club] = await db.select().from(dbClubs).where(eq(dbClubs.id, id));
      if (!club) { res.status(404).json({ error: "Club not found" }); return; }
      const isOwner = club.ownerId === requesterId;
      const [requesterMembership] = await db
        .select()
        .from(dbClubMembers)
        .where(and(eq(dbClubMembers.clubId, id), eq(dbClubMembers.userId, requesterId)));
      const isDirectorRole = requesterMembership?.role === "director";
      if (!isOwner && !isDirectorRole) {
        res.status(403).json({ error: "Only owners and directors can undo check-ins" });
        return;
      }
      const { meetupCheckins } = await import("../shared/schema.js");
      await db.delete(meetupCheckins)
        .where(and(eq(meetupCheckins.eventId, eventId), eq(meetupCheckins.userId, targetUserId)));
      return res.json({ success: true });
    } catch (err) {
      logger.error("[clubs] DELETE /:id/events/:eventId/checkin-admin/:userId error:", err);
      return res.status(500).json({ error: "Failed to undo check-in" });
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// GROWTH & RETENTION ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════════

/** GET /api/clubs/:id/growth/analytics — attendance analytics for owner */
clubsRouter.get("/:id/growth/analytics", requireFullAuth, async (req: Request, res: Response) => {
  const requesterId = getUserId(req, res);
  if (!requesterId) return;
  try {
    const db = await getDb();
    const { id } = req.params;
    const [club] = await db.select().from(dbClubs).where(eq(dbClubs.id, id));
    if (!club) { res.status(404).json({ error: "Club not found" }); return; }
    const isOwner = club.ownerId === requesterId;
    const [membership] = await db.select().from(dbClubMembers)
      .where(and(eq(dbClubMembers.clubId, id), eq(dbClubMembers.userId, requesterId)));
    if (!isOwner && membership?.role !== "director") {
      res.status(403).json({ error: "Owner/director only" }); return;
    }
    // Get all past events for this club
    const { meetupCheckins } = await import("../shared/schema.js");
    const events = await db.select().from(clubEvents)
      .where(eq(clubEvents.clubId, id))
      .orderBy(desc(clubEvents.startAt));
    const rsvps = await db.select().from(clubEventRsvps).where(eq(clubEventRsvps.clubId, id));
    const checkins = await db.select().from(meetupCheckins).where(eq(meetupCheckins.clubId, id));
    const members = await db.select().from(dbClubMembers).where(eq(dbClubMembers.clubId, id));
    const now = new Date();
    const pastEvents = events.filter(e => new Date(e.startAt) < now);
    const upcomingEvents = events.filter(e => new Date(e.startAt) >= now);
    // Per-event attendance data
    const eventStats = pastEvents.slice(0, 10).map(ev => {
      const evRsvps = rsvps.filter(r => r.eventId === ev.id && r.status === "going").length;
      const evCheckins = checkins.filter(c => c.eventId === ev.id).length;
      return {
        id: ev.id,
        title: ev.title,
        date: ev.startAt instanceof Date ? ev.startAt.toISOString() : String(ev.startAt),
        rsvpCount: evRsvps,
        attendanceCount: evCheckins,
        conversionRate: evRsvps > 0 ? Math.round((evCheckins / evRsvps) * 100) : 0,
      };
    });
    // Member segments
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const { memberEngagement } = await import("../shared/schema.js");
    const engagements = await db.select().from(memberEngagement).where(eq(memberEngagement.clubId, id));
    const activeMembers = engagements.filter(e => e.lastAttendedAt && new Date(e.lastAttendedAt) > thirtyDaysAgo).length;
    const atRiskMembers = engagements.filter(e => e.lastAttendedAt && new Date(e.lastAttendedAt) <= thirtyDaysAgo && new Date(e.lastAttendedAt) > ninetyDaysAgo).length;
    const inactiveMembers = engagements.filter(e => !e.lastAttendedAt || new Date(e.lastAttendedAt) <= ninetyDaysAgo).length;
    const newThisMonth = members.filter(m => m.joinedAt && new Date(m.joinedAt) > thirtyDaysAgo).length;
    res.json({
      summary: {
        totalMembers: members.length,
        totalEvents: events.length,
        pastEvents: pastEvents.length,
        upcomingEvents: upcomingEvents.length,
        totalAttendance: checkins.length,
        avgAttendance: pastEvents.length > 0 ? Math.round(checkins.length / pastEvents.length) : 0,
        newMembersThisMonth: newThisMonth,
      },
      segments: {
        active: activeMembers,
        atRisk: atRiskMembers,
        inactive: inactiveMembers,
        new: newThisMonth,
      },
      eventStats,
    });
  } catch (err) {
    logger.error("[clubs] GET /:id/growth/analytics error:", err);
    res.status(500).json({ error: "Failed to load analytics" });
  }
});

/** GET /api/clubs/:id/growth/members — member segments with engagement data */
clubsRouter.get("/:id/growth/members", requireFullAuth, async (req: Request, res: Response) => {
  const requesterId = getUserId(req, res);
  if (!requesterId) return;
  try {
    const db = await getDb();
    const { id } = req.params;
    const [club] = await db.select().from(dbClubs).where(eq(dbClubs.id, id));
    if (!club) { res.status(404).json({ error: "Club not found" }); return; }
    const isOwner = club.ownerId === requesterId;
    const [membership] = await db.select().from(dbClubMembers)
      .where(and(eq(dbClubMembers.clubId, id), eq(dbClubMembers.userId, requesterId)));
    if (!isOwner && membership?.role !== "director") {
      res.status(403).json({ error: "Owner/director only" }); return;
    }
    const { memberEngagement } = await import("../shared/schema.js");
    const members = await db.select().from(dbClubMembers).where(eq(dbClubMembers.clubId, id));
    const engagements = await db.select().from(memberEngagement).where(eq(memberEngagement.clubId, id));
    const engMap = new Map(engagements.map(e => [e.memberId, e]));
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const result = members.map(m => {
      const eng = engMap.get(m.userId);
      const lastAt = eng?.lastAttendedAt ? new Date(eng.lastAttendedAt) : null;
      let segment: "active" | "at_risk" | "inactive" | "new" = "new";
      if (lastAt) {
        if (lastAt > thirtyDaysAgo) segment = "active";
        else if (lastAt > ninetyDaysAgo) segment = "at_risk";
        else segment = "inactive";
      }
      return {
        userId: m.userId,
        displayName: m.displayName,
        avatarUrl: m.avatarUrl,
        role: m.role,
        joinedAt: m.joinedAt instanceof Date ? m.joinedAt.toISOString() : String(m.joinedAt),
        eventsAttended: eng?.eventsAttendedCount ?? 0,
        currentStreak: eng?.currentStreak ?? 0,
        longestStreak: eng?.longestStreak ?? 0,
        lastAttendedAt: lastAt ? lastAt.toISOString() : null,
        badges: eng?.badgesJson ? JSON.parse(eng.badgesJson) : [],
        segment,
      };
    });
    res.json(result);
  } catch (err) {
    logger.error("[clubs] GET /:id/growth/members error:", err);
    res.status(500).json({ error: "Failed to load member segments" });
  }
});

/** GET /api/clubs/:id/seasons — list club seasons */
clubsRouter.get("/:id/seasons", async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const { id } = req.params;
    const { clubSeasons } = await import("../shared/schema.js");
    const seasons = await db.select().from(clubSeasons)
      .where(eq(clubSeasons.clubId, id))
      .orderBy(desc(clubSeasons.createdAt));
    res.json(seasons.map(s => ({
      ...s,
      startDate: s.startDate,
      endDate: s.endDate,
      createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : String(s.createdAt),
    })));
  } catch (err) {
    logger.error("[clubs] GET /:id/seasons error:", err);
    res.status(500).json({ error: "Failed to load seasons" });
  }
});

/** POST /api/clubs/:id/seasons — create a club season */
clubsRouter.post("/:id/seasons", requireFullAuth, async (req: Request, res: Response) => {
  const requesterId = getUserId(req, res);
  if (!requesterId) return;
  try {
    const db = await getDb();
    const { id } = req.params;
    const [club] = await db.select().from(dbClubs).where(eq(dbClubs.id, id));
    if (!club) { res.status(404).json({ error: "Club not found" }); return; }
    const isOwner = club.ownerId === requesterId;
    const [membership] = await db.select().from(dbClubMembers)
      .where(and(eq(dbClubMembers.clubId, id), eq(dbClubMembers.userId, requesterId)));
    if (!isOwner && membership?.role !== "director") {
      res.status(403).json({ error: "Owner/director only" }); return;
    }
    const { clubSeasons } = await import("../shared/schema.js");
    const body = req.body as typeof clubSeasons.$inferInsert;
    const seasonId = nanoid(16);
    await db.insert(clubSeasons).values({
      id: seasonId,
      clubId: id,
      name: body.name,
      startDate: body.startDate,
      endDate: body.endDate ?? null,
      scoringMethod: body.scoringMethod ?? "hybrid",
      visibility: body.visibility ?? "public",
      status: "active",
      createdBy: requesterId,
    });
    const [created] = await db.select().from(clubSeasons).where(eq(clubSeasons.id, seasonId));
    res.status(201).json({ ...created, createdAt: created.createdAt instanceof Date ? created.createdAt.toISOString() : String(created.createdAt) });
  } catch (err) {
    logger.error("[clubs] POST /:id/seasons error:", err);
    res.status(500).json({ error: "Failed to create season" });
  }
});

/** GET /api/clubs/:id/seasons/:seasonId/standings — season standings */
clubsRouter.get("/:id/seasons/:seasonId/standings", async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const { seasonId } = req.params;
    const { clubSeasonStandings } = await import("../shared/schema.js");
    const standings = await db.select().from(clubSeasonStandings)
      .where(eq(clubSeasonStandings.seasonId, seasonId))
      .orderBy(clubSeasonStandings.rank);
    res.json(standings);
  } catch (err) {
    logger.error("[clubs] GET /:id/seasons/:seasonId/standings error:", err);
    res.status(500).json({ error: "Failed to load standings" });
  }
});

/** GET /api/clubs/:id/announcements — list announcements (public) */
clubsRouter.get("/:id/announcements", async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const { id } = req.params;
    const { clubAnnouncements } = await import("../shared/schema.js");
    const rows = await db.select().from(clubAnnouncements)
      .where(eq(clubAnnouncements.clubId, id))
      .orderBy(desc(clubAnnouncements.pinned), desc(clubAnnouncements.createdAt));
    res.json(rows.map(r => ({
      ...r,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
    })));
  } catch (err) {
    logger.error("[clubs] GET /:id/announcements error:", err);
    res.status(500).json({ error: "Failed to load announcements" });
  }
});

/** POST /api/clubs/:id/announcements — create announcement */
clubsRouter.post("/:id/announcements", requireFullAuth, async (req: Request, res: Response) => {
  const requesterId = getUserId(req, res);
  if (!requesterId) return;
  try {
    const db = await getDb();
    const { id } = req.params;
    const [club] = await db.select().from(dbClubs).where(eq(dbClubs.id, id));
    if (!club) { res.status(404).json({ error: "Club not found" }); return; }
    const isOwner = club.ownerId === requesterId;
    const [membership] = await db.select().from(dbClubMembers)
      .where(and(eq(dbClubMembers.clubId, id), eq(dbClubMembers.userId, requesterId)));
    if (!isOwner && !membership) {
      res.status(403).json({ error: "Active club membership required" }); return;
    }
    const { clubAnnouncements } = await import("../shared/schema.js");
    const body = req.body as typeof clubAnnouncements.$inferInsert;
    const annId = nanoid(16);
    await db.insert(clubAnnouncements).values({
      id: annId,
      clubId: id,
      title: body.title,
      body: body.body,
      visibility: body.visibility ?? "public",
      pinned: body.pinned ? 1 : 0,
      relatedEventId: body.relatedEventId ?? null,
      relatedTournamentId: body.relatedTournamentId ?? null,
      createdBy: requesterId,
      createdByName: body.createdByName ?? "",
    });
    const [created] = await db.select().from(clubAnnouncements).where(eq(clubAnnouncements.id, annId));
    res.status(201).json({ ...created, createdAt: created.createdAt instanceof Date ? created.createdAt.toISOString() : String(created.createdAt) });
  } catch (err) {
    logger.error("[clubs] POST /:id/announcements error:", err);
    res.status(500).json({ error: "Failed to create announcement" });
  }
});

/** DELETE /api/clubs/:id/announcements/:annId — delete announcement */
clubsRouter.delete("/:id/announcements/:annId", requireFullAuth, async (req: Request, res: Response) => {
  const requesterId = getUserId(req, res);
  if (!requesterId) return;
  try {
    const db = await getDb();
    const { id, annId } = req.params;
    const [club] = await db.select().from(dbClubs).where(eq(dbClubs.id, id));
    if (!club) { res.status(404).json({ error: "Club not found" }); return; }
    const isOwner = club.ownerId === requesterId;
    const [membership] = await db.select().from(dbClubMembers)
      .where(and(eq(dbClubMembers.clubId, id), eq(dbClubMembers.userId, requesterId)));
    const { clubAnnouncements } = await import("../shared/schema.js");
    const [announcement] = await db.select().from(clubAnnouncements)
      .where(and(eq(clubAnnouncements.id, annId), eq(clubAnnouncements.clubId, id)));
    if (!announcement) { res.status(404).json({ error: "Post not found" }); return; }
    if (!isOwner && announcement.createdBy !== requesterId) {
      res.status(403).json({ error: "Only the original poster or club owner can delete this post" }); return;
    }
    await db.delete(clubAnnouncements).where(eq(clubAnnouncements.id, annId));
    res.json({ success: true });
  } catch (err) {
    logger.error("[clubs] DELETE /:id/announcements/:annId error:", err);
    res.status(500).json({ error: "Failed to delete announcement" });
  }
});

/** GET /api/clubs/:id/events/:eventId/recap — get or generate event recap */
clubsRouter.get("/:id/events/:eventId/recap", requireFullAuth, async (req: Request, res: Response) => {
  const requesterId = getUserId(req, res);
  if (!requesterId) return;
  try {
    const db = await getDb();
    const { id, eventId } = req.params;
    const [club] = await db.select().from(dbClubs).where(eq(dbClubs.id, id));
    if (!club) { res.status(404).json({ error: "Club not found" }); return; }
    const isOwner = club.ownerId === requesterId;
    const [membership] = await db.select().from(dbClubMembers)
      .where(and(eq(dbClubMembers.clubId, id), eq(dbClubMembers.userId, requesterId)));
    if (!isOwner && membership?.role !== "director") {
      res.status(403).json({ error: "Owner/director only" }); return;
    }
    const { eventRecaps, meetupCheckins } = await import("../shared/schema.js");
    // Check if recap already exists
    const [existing] = await db.select().from(eventRecaps).where(eq(eventRecaps.eventId, eventId));
    if (existing) { res.json(existing); return; }
    // Generate recap from check-in data
    const [event] = await db.select().from(clubEvents).where(eq(clubEvents.id, eventId));
    if (!event) { res.status(404).json({ error: "Event not found" }); return; }
    const checkins = await db.select().from(meetupCheckins).where(eq(meetupCheckins.eventId, eventId));
    const attendanceCount = checkins.length;
    const eventDate = event.startAt instanceof Date ? event.startAt : new Date(event.startAt);
    const dateStr = eventDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    const caption = attendanceCount > 0
      ? `${attendanceCount} players showed up for ${event.title} on ${dateStr} at ${club.name}. Great to see the OTB community growing! ♟️ #ChessOTB #OTBChess #ChessCommunity`
      : `We hosted ${event.title} on ${dateStr} at ${club.name}. Thanks to everyone who joined! ♟️ #ChessOTB #OTBChess`;
    const summary = `${event.title} — ${dateStr}. ${attendanceCount} player${attendanceCount !== 1 ? "s" : ""} attended.`;
    const recapId = nanoid(16);
    await db.insert(eventRecaps).values({
      id: recapId,
      clubId: id,
      eventId,
      generatedCaption: caption,
      generatedSummary: summary,
      attendanceCount,
      firstTimeCount: 0,
      returningCount: attendanceCount,
    });
    const [created] = await db.select().from(eventRecaps).where(eq(eventRecaps.id, recapId));
    res.status(201).json(created);
  } catch (err) {
    logger.error("[clubs] GET /:id/events/:eventId/recap error:", err);
    res.status(500).json({ error: "Failed to generate recap" });
  }
});

/** POST /api/clubs/:id/events/:eventId/engagement-sync — sync check-in to member_engagement */
clubsRouter.post("/:id/events/:eventId/engagement-sync", requireFullAuth, async (req: Request, res: Response) => {
  const requesterId = getUserId(req, res);
  if (!requesterId) return;
  try {
    const db = await getDb();
    const { id, eventId } = req.params;
    const [club] = await db.select().from(dbClubs).where(eq(dbClubs.id, id));
    if (!club) { res.status(404).json({ error: "Club not found" }); return; }
    const isOwner = club.ownerId === requesterId;
    const [membership] = await db.select().from(dbClubMembers)
      .where(and(eq(dbClubMembers.clubId, id), eq(dbClubMembers.userId, requesterId)));
    if (!isOwner && membership?.role !== "director") {
      res.status(403).json({ error: "Owner/director only" }); return;
    }
    const { meetupCheckins, memberEngagement } = await import("../shared/schema.js");
    const checkins = await db.select().from(meetupCheckins).where(eq(meetupCheckins.eventId, eventId));
    // Upsert engagement for each checked-in member
    for (const checkin of checkins) {
      const [existing] = await db.select().from(memberEngagement)
        .where(and(eq(memberEngagement.memberId, checkin.userId), eq(memberEngagement.clubId, id)));
      if (existing) {
        await db.update(memberEngagement)
          .set({
            eventsAttendedCount: existing.eventsAttendedCount + 1,
            lastAttendedAt: checkin.checkedInAt,
            currentStreak: existing.currentStreak + 1,
            longestStreak: Math.max(existing.longestStreak, existing.currentStreak + 1),
          })
          .where(and(eq(memberEngagement.memberId, checkin.userId), eq(memberEngagement.clubId, id)));
      } else {
        await db.insert(memberEngagement).values({
          id: nanoid(16),
          memberId: checkin.userId,
          clubId: id,
          eventsAttendedCount: 1,
          lastAttendedAt: checkin.checkedInAt,
          currentStreak: 1,
          longestStreak: 1,
        });
      }
    }
    res.json({ synced: checkins.length });
  } catch (err) {
    logger.error("[clubs] POST /:id/events/:eventId/engagement-sync error:", err);
    res.status(500).json({ error: "Failed to sync engagement" });
  }
});

// ── GET /api/clubs/:id/stream — SSE stream for real-time club updates ─────────
// Clients connect once; server pushes member_joined / member_left / club_updated
// events so all open dashboards stay in sync without polling.
clubsRouter.get("/:id/stream", (req: Request, res: Response) => {
  const { id } = req.params;
  if (!id) { res.status(400).end(); return; }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  if (!clubSseSubscribers.has(id)) clubSseSubscribers.set(id, new Set());
  const subs = clubSseSubscribers.get(id)!;
  subs.add(res as unknown as import("http").ServerResponse);

  res.write(`: connected\n\n`);

  const keepalive = setInterval(() => {
    try { res.write(`: keepalive\n\n`); } catch { clearInterval(keepalive); }
  }, 25_000);

  req.on("close", () => {
    clearInterval(keepalive);
    subs.delete(res as unknown as import("http").ServerResponse);
    if (subs.size === 0) clubSseSubscribers.delete(id);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// RSVP FORM SURVEY ROUTES
// ══════════════════════════════════════════════════════════════════════════════

/** POST /api/clubs/:id/events/:eventId/rsvp-form — create or update the RSVP form for an event */
clubsRouter.post("/:id/events/:eventId/rsvp-form", authMiddleware, async (req: Request, res: Response) => {
  const userId = getUserId(req, res);
  if (!userId) return;
  const { id: clubId, eventId } = req.params;
  try {
    const db = await getDb();
    // Verify club ownership/director
    const [club] = await db.select().from(dbClubs).where(eq(dbClubs.id, clubId));
    if (!club) { res.status(404).json({ error: "Club not found" }); return; }
    const [member] = await db.select().from(dbClubMembers).where(and(eq(dbClubMembers.clubId, clubId), eq(dbClubMembers.userId, userId)));
    const isOwner = club.ownerId === userId;
    const isDirector = member?.role === "director";
    if (!isOwner && !isDirector) { res.status(403).json({ error: "Only directors can manage RSVP forms" }); return; }

    const { title, description, questions, isPublished, closesAt, confirmationMessage, collectEmail, maxResponses, allowMultipleSubmissions, theme_color, header_image } = req.body as {
      title?: string; description?: string; questions?: unknown[];
      isPublished?: boolean; closesAt?: string;
      confirmationMessage?: string | null;
      collectEmail?: boolean;
      maxResponses?: number | null;
      allowMultipleSubmissions?: boolean;
      theme_color?: string | null;
      header_image?: string | null;
    };

    // Check if form already exists for this event
    const [existing] = await db.select().from(rsvpForms).where(eq(rsvpForms.eventId, eventId));

    if (existing) {
      // Update existing form
      await db.update(rsvpForms).set({
        title: title ?? existing.title,
        description: description ?? existing.description,
        questions: (questions ?? existing.questions) as unknown[],
        isPublished: isPublished !== undefined ? (isPublished ? 1 : 0) : existing.isPublished,
        closesAt: closesAt !== undefined ? (closesAt ? new Date(closesAt) : null) : existing.closesAt,
        confirmationMessage: confirmationMessage !== undefined ? confirmationMessage : existing.confirmationMessage,
        collectEmail: collectEmail !== undefined ? (collectEmail ? 1 : 0) : existing.collectEmail,
        maxResponses: maxResponses !== undefined ? maxResponses : existing.maxResponses,
        allowMultipleSubmissions: allowMultipleSubmissions !== undefined ? (allowMultipleSubmissions ? 1 : 0) : existing.allowMultipleSubmissions,
        theme_color: theme_color !== undefined ? theme_color : existing.theme_color,
        header_image: header_image !== undefined ? header_image : existing.header_image,
        updatedAt: new Date(),
      }).where(eq(rsvpForms.id, existing.id));
      const [updated] = await db.select().from(rsvpForms).where(eq(rsvpForms.id, existing.id));
      res.json({ form: updated });
    } else {
      // Create new form with unique slug
      const slug = `${clubId.slice(0, 8)}-${eventId.slice(0, 8)}-${nanoid(8)}`;
      const formId = nanoid(36);
      await db.insert(rsvpForms).values({
        id: formId,
        eventId,
        clubId,
        createdByUserId: userId,
        title: title ?? "RSVP Form",
        description: description ?? null,
        questions: (questions ?? []) as unknown[],
        slug,
        isPublished: isPublished ? 1 : 0,
        closesAt: closesAt ? new Date(closesAt) : null,
        confirmationMessage: confirmationMessage ?? null,
        collectEmail: collectEmail ? 1 : 0,
        maxResponses: maxResponses ?? null,
        allowMultipleSubmissions: allowMultipleSubmissions ? 1 : 0,
        theme_color: theme_color ?? "#22c55e",
        header_image: header_image ?? null,
      });
      const [created] = await db.select().from(rsvpForms).where(eq(rsvpForms.id, formId));
      res.status(201).json({ form: created });
    }
  } catch (err) {
    logger.error("[clubs] POST /:id/events/:eventId/rsvp-form error:", err);
    res.status(500).json({ error: "Failed to save RSVP form" });
  }
});

/** GET /api/clubs/:id/events/:eventId/rsvp-form — get the RSVP form for an event */
clubsRouter.get("/:id/events/:eventId/rsvp-form", async (req: Request, res: Response) => {
  const { eventId } = req.params;
  try {
    const db = await getDb();
    const [form] = await db.select().from(rsvpForms).where(eq(rsvpForms.eventId, eventId));
    if (!form) { res.status(404).json({ error: "No RSVP form found for this event" }); return; }
    const responses = await db.select().from(rsvpFormResponses).where(eq(rsvpFormResponses.formId, form.id));
    res.json({ form, responses });
  } catch (err) {
    logger.error("[clubs] GET /:id/events/:eventId/rsvp-form error:", err);
    res.status(500).json({ error: "Failed to fetch RSVP form" });
  }
});

/** GET /api/rsvp/:slug — public endpoint to fetch a form by slug (no auth required) */
clubsRouter.get("/rsvp-public/:slug", async (req: Request, res: Response) => {
  const { slug } = req.params;
  try {
    const db = await getDb();
    const [form] = await db.select().from(rsvpForms).where(eq(rsvpForms.slug, slug));
    if (!form) { res.status(404).json({ error: "Form not found" }); return; }
    if (!form.isPublished) { res.status(403).json({ error: "This form is not yet published" }); return; }
    if (form.closesAt && new Date(form.closesAt) < new Date()) {
      res.status(410).json({ error: "This form has closed" }); return;
    }
    // Fetch event details
    const [event] = await db.select().from(clubEvents).where(eq(clubEvents.id, form.eventId));
    // Fetch club details
    const [club] = await db.select({ name: dbClubs.name, avatarUrl: dbClubs.avatarUrl }).from(dbClubs).where(eq(dbClubs.id, form.clubId));
    res.json({ form, event: event ?? null, club: club ?? null });
  } catch (err) {
    logger.error("[clubs] GET /rsvp-public/:slug error:", err);
    res.status(500).json({ error: "Failed to fetch form" });
  }
});

/** POST /api/clubs/rsvp-public/:slug/submit — submit a response (no auth required) */
clubsRouter.post("/rsvp-public/:slug/submit", async (req: Request, res: Response) => {
  const { slug } = req.params;
  try {
    const db = await getDb();
    const [form] = await db.select().from(rsvpForms).where(eq(rsvpForms.slug, slug));
    if (!form) { res.status(404).json({ error: "Form not found" }); return; }
    if (!form.isPublished) { res.status(403).json({ error: "This form is not accepting responses" }); return; }
    if (form.closesAt && new Date(form.closesAt) < new Date()) {
      res.status(410).json({ error: "This form has closed" }); return;
    }

    const { respondentName, respondentEmail, answers, userId } = req.body as {
      respondentName?: string; respondentEmail?: string;
      answers?: unknown[]; userId?: string;
    };

    const responseId = nanoid(36);
    await db.insert(rsvpFormResponses).values({
      id: responseId,
      formId: form.id,
      eventId: form.eventId,
      clubId: form.clubId,
      userId: userId ?? null,
      respondentName: respondentName ?? "Anonymous",
      respondentEmail: respondentEmail ?? null,
      answers: (answers ?? []) as unknown[],
    });
    res.status(201).json({ success: true, responseId });
  } catch (err) {
    logger.error("[clubs] POST /rsvp-public/:slug/submit error:", err);
    res.status(500).json({ error: "Failed to submit response" });
  }
});

/** GET /api/clubs/:id/events/:eventId/rsvp-form/responses — get all responses (owner/director only) */
clubsRouter.get("/:id/events/:eventId/rsvp-form/responses", authMiddleware, async (req: Request, res: Response) => {
  const userId = getUserId(req, res);
  if (!userId) return;
  const { id: clubId, eventId } = req.params;
  try {
    const db = await getDb();
    const [club] = await db.select().from(dbClubs).where(eq(dbClubs.id, clubId));
    if (!club) { res.status(404).json({ error: "Club not found" }); return; }
    const isOwner = club.ownerId === userId;
    const [member] = await db.select().from(dbClubMembers).where(and(eq(dbClubMembers.clubId, clubId), eq(dbClubMembers.userId, userId)));
    if (!isOwner && member?.role !== "director") { res.status(403).json({ error: "Access denied" }); return; }

    const [form] = await db.select().from(rsvpForms).where(eq(rsvpForms.eventId, eventId));
    if (!form) { res.status(404).json({ error: "No RSVP form for this event" }); return; }

    const responses = await db.select().from(rsvpFormResponses)
      .where(eq(rsvpFormResponses.formId, form.id))
      .orderBy(desc(rsvpFormResponses.submittedAt));

    res.json({ form, responses, total: responses.length });
  } catch (err) {
    logger.error("[clubs] GET /:id/events/:eventId/rsvp-form/responses error:", err);
    res.status(500).json({ error: "Failed to fetch responses" });
  }
});

// ── Club Albums ───────────────────────────────────────────────────────────────

async function resolveClubForAlbums(idOrSlug: string) {
  const db = await getDb();
  const [club] = await db
    .select()
    .from(dbClubs)
    .where(or(eq(dbClubs.id, idOrSlug), eq(dbClubs.slug, idOrSlug)))
    .limit(1);
  return { db, club };
}

async function canManageClubAlbums(clubId: string, ownerId: string, userId: string) {
  if (ownerId === userId) return true;
  const db = await getDb();
  const [membership] = await db
    .select({ role: dbClubMembers.role })
    .from(dbClubMembers)
    .where(and(eq(dbClubMembers.clubId, clubId), eq(dbClubMembers.userId, userId)))
    .limit(1);
  return membership?.role === "director";
}

const memberUploadableSharedAlbumTitles = new Set([
  "chess tournaments",
  "chess leagues",
  "chess club meetups",
]);

async function canUploadToClubAlbum(clubId: string, ownerId: string, userId: string, albumTitle: string) {
  if (await canManageClubAlbums(clubId, ownerId, userId)) return true;
  if (!memberUploadableSharedAlbumTitles.has(albumTitle.trim().toLowerCase())) return false;
  const db = await getDb();
  const [membership] = await db
    .select({ userId: dbClubMembers.userId })
    .from(dbClubMembers)
    .where(and(eq(dbClubMembers.clubId, clubId), eq(dbClubMembers.userId, userId)))
    .limit(1);
  return Boolean(membership);
}

function albumDate(value: Date | string) {
  return value instanceof Date ? value.toISOString() : String(value);
}

clubsRouter.get("/:id/albums", async (req: Request, res: Response) => {
  try {
    const { db, club } = await resolveClubForAlbums(req.params.id);
    if (!club || club.isPublic !== 1) {
      res.status(404).json({ error: "Club not found" });
      return;
    }

    const albums = await db
      .select()
      .from(clubAlbums)
      .where(and(eq(clubAlbums.clubId, club.id), eq(clubAlbums.isPublished, 1)))
      .orderBy(desc(clubAlbums.eventDate), desc(clubAlbums.createdAt));
    const photos = await db
      .select()
      .from(clubAlbumPhotos)
      .where(eq(clubAlbumPhotos.clubId, club.id))
      .orderBy(clubAlbumPhotos.sortOrder, clubAlbumPhotos.createdAt);
    const photosByAlbum = new Map<string, typeof photos>();
    for (const photo of photos) {
      const current = photosByAlbum.get(photo.albumId) ?? [];
      current.push(photo);
      photosByAlbum.set(photo.albumId, current);
    }

    res.json({
      albums: albums.map((album) => ({
        id: album.id,
        clubId: album.clubId,
        title: album.title,
        description: album.description ?? null,
        eventDate: album.eventDate ?? null,
        coverImageUrl: album.coverImageUrl ?? null,
        createdByName: album.createdByName,
        createdAt: albumDate(album.createdAt),
        updatedAt: albumDate(album.updatedAt),
        photos: (photosByAlbum.get(album.id) ?? []).map((photo) => ({
          id: photo.id,
          albumId: photo.albumId,
          url: `/api/clubs/${club.id}/albums/${album.id}/photos/${photo.id}/file`,
          caption: photo.caption ?? null,
          altText: photo.altText ?? null,
          width: photo.width ?? null,
          height: photo.height ?? null,
          sortOrder: photo.sortOrder,
          createdAt: albumDate(photo.createdAt),
        })),
      })),
    });
  } catch (error) {
    logger.error("club_albums_list_failed", { clubId: req.params.id, error });
    res.status(500).json({ error: "Failed to load club albums" });
  }
});

clubsRouter.get("/:id/albums/:albumId/photos/:photoId/file", async (req: Request, res: Response) => {
  try {
    const { db, club } = await resolveClubForAlbums(req.params.id);
    if (!club || club.isPublic !== 1) {
      res.status(404).send("Photo not found");
      return;
    }
    const [photo] = await db
      .select({ storageKey: clubAlbumPhotos.storageKey })
      .from(clubAlbumPhotos)
      .where(and(
        eq(clubAlbumPhotos.id, req.params.photoId),
        eq(clubAlbumPhotos.albumId, req.params.albumId),
        eq(clubAlbumPhotos.clubId, club.id)
      ))
      .limit(1);
    if (!photo) {
      res.status(404).send("Photo not found");
      return;
    }

    res.set("Cache-Control", "no-store");
    res.redirect(307, await storageGetSignedUrl(photo.storageKey));
  } catch (error) {
    logger.error("club_album_photo_read_failed", { clubId: req.params.id, albumId: req.params.albumId, photoId: req.params.photoId, error });
    res.status(502).send("Photo is temporarily unavailable");
  }
});

clubsRouter.post("/:id/albums", requireFullAuth, async (req: Request, res: Response) => {
  const userId = getUserId(req, res);
  if (!userId) return;
  try {
    const { db, club } = await resolveClubForAlbums(req.params.id);
    if (!club) {
      res.status(404).json({ error: "Club not found" });
      return;
    }
    if (!(await canManageClubAlbums(club.id, club.ownerId, userId))) {
      res.status(403).json({ error: "Only club owners and directors can create albums" });
      return;
    }

    const { title, description, eventDate, createdByName } = req.body as {
      title?: string;
      description?: string;
      eventDate?: string;
      createdByName?: string;
    };
    const cleanTitle = title?.trim();
    const cleanDescription = description?.trim() || null;
    const cleanEventDate = eventDate?.trim() || null;
    if (!cleanTitle || cleanTitle.length > 120) {
      res.status(400).json({ error: "Album title must be between 1 and 120 characters" });
      return;
    }
    if (cleanDescription && cleanDescription.length > 2000) {
      res.status(400).json({ error: "Album description must be 2,000 characters or fewer" });
      return;
    }
    if (cleanEventDate && !/^\d{4}-\d{2}-\d{2}$/.test(cleanEventDate)) {
      res.status(400).json({ error: "Event date must use YYYY-MM-DD format" });
      return;
    }

    const id = nanoid(24);
    await db.insert(clubAlbums).values({
      id,
      clubId: club.id,
      title: cleanTitle,
      description: cleanDescription,
      eventDate: cleanEventDate,
      createdById: userId,
      createdByName: createdByName?.trim().slice(0, 100) || club.ownerName,
      isPublished: 1,
    });
    res.status(201).json({ id });
  } catch (error) {
    logger.error("club_album_create_failed", { clubId: req.params.id, error });
    res.status(500).json({ error: "Failed to create album" });
  }
});

clubsRouter.patch("/:id/albums/:albumId", requireFullAuth, async (req: Request, res: Response) => {
  const userId = getUserId(req, res);
  if (!userId) return;
  try {
    const { db, club } = await resolveClubForAlbums(req.params.id);
    if (!club) {
      res.status(404).json({ error: "Club not found" });
      return;
    }
    if (!(await canManageClubAlbums(club.id, club.ownerId, userId))) {
      res.status(403).json({ error: "Only club owners and directors can edit albums" });
      return;
    }
    const [album] = await db.select().from(clubAlbums).where(and(eq(clubAlbums.id, req.params.albumId), eq(clubAlbums.clubId, club.id))).limit(1);
    if (!album) {
      res.status(404).json({ error: "Album not found" });
      return;
    }

    const { title, description, eventDate } = req.body as { title?: string; description?: string; eventDate?: string };
    const cleanTitle = title?.trim();
    const cleanDescription = description?.trim() || null;
    const cleanEventDate = eventDate?.trim() || null;
    if (!cleanTitle || cleanTitle.length > 120) {
      res.status(400).json({ error: "Album title must be between 1 and 120 characters" });
      return;
    }
    if (cleanDescription && cleanDescription.length > 2000) {
      res.status(400).json({ error: "Album description must be 2,000 characters or fewer" });
      return;
    }
    if (cleanEventDate && !/^\d{4}-\d{2}-\d{2}$/.test(cleanEventDate)) {
      res.status(400).json({ error: "Event date must use YYYY-MM-DD format" });
      return;
    }

    await db.update(clubAlbums).set({
      title: cleanTitle,
      description: cleanDescription,
      eventDate: cleanEventDate,
      updatedAt: new Date(),
    }).where(eq(clubAlbums.id, album.id));
    res.json({ success: true });
  } catch (error) {
    logger.error("club_album_update_failed", { clubId: req.params.id, albumId: req.params.albumId, error });
    res.status(500).json({ error: "Failed to update album" });
  }
});

const albumPhotoJsonParser = express.json({ limit: "10mb" });
clubsRouter.post("/:id/albums/:albumId/photos", requireFullAuth, albumPhotoJsonParser, async (req: Request, res: Response) => {
  const userId = getUserId(req, res);
  if (!userId) return;
  try {
    const { db, club } = await resolveClubForAlbums(req.params.id);
    if (!club) {
      res.status(404).json({ error: "Club not found" });
      return;
    }
    const [album] = await db.select().from(clubAlbums).where(and(eq(clubAlbums.id, req.params.albumId), eq(clubAlbums.clubId, club.id))).limit(1);
    if (!album) {
      res.status(404).json({ error: "Album not found" });
      return;
    }
    if (!(await canUploadToClubAlbum(club.id, club.ownerId, userId, album.title))) {
      res.status(403).json({ error: "Active club membership is required to upload to shared club albums" });
      return;
    }

    const { dataUrl, caption, altText, width, height } = req.body as {
      dataUrl?: string;
      caption?: string;
      altText?: string;
      width?: number;
      height?: number;
    };
    const match = dataUrl?.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
    if (!match) {
      res.status(400).json({ error: "Upload a JPEG, PNG, or WebP image" });
      return;
    }
    const bytes = Buffer.from(match[2], "base64");
    if (bytes.length === 0 || bytes.length > 6 * 1024 * 1024) {
      res.status(413).json({ error: "Each album photo must be 6 MB or smaller" });
      return;
    }
    const cleanCaption = caption?.trim() || null;
    const cleanAltText = altText?.trim() || null;
    if (cleanCaption && cleanCaption.length > 500) {
      res.status(400).json({ error: "Photo caption must be 500 characters or fewer" });
      return;
    }
    if (cleanAltText && cleanAltText.length > 300) {
      res.status(400).json({ error: "Photo description must be 300 characters or fewer" });
      return;
    }

    const mimeType = match[1];
    const extension = mimeType === "image/jpeg" ? "jpg" : mimeType.split("/")[1];
    const photoId = nanoid(24);
    const { key, url } = await storagePut(`club-albums/${club.id}/${album.id}/${photoId}.${extension}`, bytes, mimeType);
    const [{ total }] = await db
      .select({ total: sql<number>`count(*)` })
      .from(clubAlbumPhotos)
      .where(eq(clubAlbumPhotos.albumId, album.id));
    await db.insert(clubAlbumPhotos).values({
      id: photoId,
      albumId: album.id,
      clubId: club.id,
      storageKey: key,
      url,
      caption: cleanCaption,
      altText: cleanAltText,
      width: Number.isInteger(width) && width! > 0 ? width : null,
      height: Number.isInteger(height) && height! > 0 ? height : null,
      sortOrder: Number(total ?? 0),
      createdById: userId,
    });
    res.status(201).json({
      photo: {
        id: photoId,
        albumId: album.id,
        url: `/api/clubs/${club.id}/albums/${album.id}/photos/${photoId}/file`,
        caption: cleanCaption,
        altText: cleanAltText,
        width: Number.isInteger(width) && width! > 0 ? width : null,
        height: Number.isInteger(height) && height! > 0 ? height : null,
        sortOrder: Number(total ?? 0),
      },
    });
  } catch (error) {
    logger.error("club_album_photo_upload_failed", { clubId: req.params.id, albumId: req.params.albumId, error });
    res.status(500).json({ error: "Failed to upload album photo" });
  }
});

clubsRouter.delete("/:id/albums/:albumId/photos/:photoId", requireFullAuth, async (req: Request, res: Response) => {
  const userId = getUserId(req, res);
  if (!userId) return;
  try {
    const { db, club } = await resolveClubForAlbums(req.params.id);
    if (!club) {
      res.status(404).json({ error: "Club not found" });
      return;
    }
    if (!(await canManageClubAlbums(club.id, club.ownerId, userId))) {
      res.status(403).json({ error: "Only club owners and directors can remove album photos" });
      return;
    }
    await db.delete(clubAlbumPhotos).where(and(
      eq(clubAlbumPhotos.id, req.params.photoId),
      eq(clubAlbumPhotos.albumId, req.params.albumId),
      eq(clubAlbumPhotos.clubId, club.id)
    ));
    res.json({ success: true });
  } catch (error) {
    logger.error("club_album_photo_delete_failed", { clubId: req.params.id, albumId: req.params.albumId, photoId: req.params.photoId, error });
    res.status(500).json({ error: "Failed to remove album photo" });
  }
});

clubsRouter.delete("/:id/albums/:albumId", requireFullAuth, async (req: Request, res: Response) => {
  const userId = getUserId(req, res);
  if (!userId) return;
  try {
    const { db, club } = await resolveClubForAlbums(req.params.id);
    if (!club) {
      res.status(404).json({ error: "Club not found" });
      return;
    }
    if (!(await canManageClubAlbums(club.id, club.ownerId, userId))) {
      res.status(403).json({ error: "Only club owners and directors can delete albums" });
      return;
    }
    const [album] = await db.select({ id: clubAlbums.id }).from(clubAlbums).where(and(eq(clubAlbums.id, req.params.albumId), eq(clubAlbums.clubId, club.id))).limit(1);
    if (!album) {
      res.status(404).json({ error: "Album not found" });
      return;
    }
    await db.delete(clubAlbumPhotos).where(eq(clubAlbumPhotos.albumId, album.id));
    await db.delete(clubAlbums).where(eq(clubAlbums.id, album.id));
    res.json({ success: true });
  } catch (error) {
    logger.error("club_album_delete_failed", { clubId: req.params.id, albumId: req.params.albumId, error });
    res.status(500).json({ error: "Failed to delete album" });
  }
});
