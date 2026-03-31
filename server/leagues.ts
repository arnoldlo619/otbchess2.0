/**
 * OTB Chess — Fantasy Chess League REST API
 *
 * Endpoints (all mounted at /api/leagues):
 *   GET  /club/:clubId          — list leagues for a club
 *   POST /                      — create a league (commissioner/admin only)
 *   GET  /:leagueId             — get full league detail
 *   GET  /:leagueId/weeks       — get all weeks with matches
 *   GET  /:leagueId/standings   — get current standings
 *   POST /:leagueId/matches/:matchId/result — report a match result
 *   PATCH /:leagueId/matches/:matchId/result — admin override result
 */
import { Router } from "express";
import { getDb } from "./db.js";
import {
  leagues,
  leaguePlayers,
  leagueWeeks,
  leagueMatches,
  leagueStandings,
  leagueJoinRequests,
  leaguePushSubscriptions,
  dbClubMembers,
  users,
} from "../shared/schema.js";
import { eq, and, desc, asc, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import webpush from "web-push";
import type { Request, Response } from "express";

// Initialise VAPID details (same keys as main server)
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY ?? "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? "mailto:admin@chessotb.club";
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

/** Send a push notification to all subscribed commissioner endpoints for a league */
async function notifyCommissioner(leagueId: string, title: string, body: string, url: string) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return;
  try {
    const db = await getDb();
    const subs = await db.select().from(leaguePushSubscriptions)
      .where(eq(leaguePushSubscriptions.leagueId, leagueId));
    if (!subs.length) return;
    const payload = JSON.stringify({ title, body, url, tag: `league-join-${leagueId}` });
    const staleIds: string[] = [];
    await Promise.all(subs.map(async (row) => {
      try {
        await webpush.sendNotification(
          { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
          payload
        );
      } catch (err: any) {
        const code = err?.statusCode;
        if (code === 410 || code === 404) staleIds.push(row.id);
        else console.warn("[league-push] Send failed:", err?.message);
      }
    }));
    if (staleIds.length) {
      // Remove expired subscriptions
      for (const id of staleIds) {
        await db.delete(leaguePushSubscriptions).where(eq(leaguePushSubscriptions.id, id));
      }
    }
    console.log(`[league-push] Notified ${subs.length - staleIds.length} commissioner(s) for league ${leagueId}`);
  } catch (err) {
    console.error("[league-push] notifyCommissioner error:", err);
  }
}

export const leaguesRouter = Router();

// ── Auth helper ───────────────────────────────────────────────────────────────
function getUser(req: Request, res: Response): string | null {
  const userId = (req as any).userId as string | undefined;
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return null;
  }
  return userId;
}

// ── Round-Robin Scheduler (Circle Method) ────────────────────────────────────
// For n players (even), generates n-1 rounds where each player plays every
// other player exactly once. Colors are assigned to balance white/black.
interface ScheduledMatch {
  weekNumber: number;
  whiteIdx: number; // index into players array
  blackIdx: number;
}

function generateRoundRobin(n: number): ScheduledMatch[] {
  // n must be even: 4, 6, 8, or 10
  const matches: ScheduledMatch[] = [];
  const players = Array.from({ length: n }, (_, i) => i);
  const totalRounds = n - 1;

  // Track how many times each player has played white to balance colors
  const whiteCount = new Array(n).fill(0);

  for (let round = 0; round < totalRounds; round++) {
    // Circle method: fix player 0, rotate the rest
    const rotated = [players[0], ...players.slice(1).slice(round).concat(players.slice(1).slice(0, round))];

    for (let i = 0; i < n / 2; i++) {
      const a = rotated[i];
      const b = rotated[n - 1 - i];

      // Assign colors: give white to the player with fewer white games
      let white: number, black: number;
      if (whiteCount[a] <= whiteCount[b]) {
        white = a;
        black = b;
      } else {
        white = b;
        black = a;
      }
      whiteCount[white]++;

      matches.push({ weekNumber: round + 1, whiteIdx: white, blackIdx: black });
    }
  }
  return matches;
}

// ── Standings recalculator ────────────────────────────────────────────────────
async function recalculateStandings(leagueId: string): Promise<void> {
  const db = await getDb();

  // Fetch all completed matches
  const completedMatches = await db
    .select()
    .from(leagueMatches)
    .where(and(eq(leagueMatches.leagueId, leagueId), eq(leagueMatches.resultStatus, "completed")));

  // Fetch all players in the league
  const players = await db
    .select()
    .from(leaguePlayers)
    .where(eq(leaguePlayers.leagueId, leagueId));

  // Build stats map
  const stats: Record<string, { wins: number; losses: number; draws: number; points: number; lastResults: string[] }> = {};
  for (const p of players) {
    stats[p.playerId] = { wins: 0, losses: 0, draws: 0, points: 0, lastResults: [] };
  }

  // Sort completed matches by weekNumber ascending so lastResults is chronological
  completedMatches.sort((a, b) => a.weekNumber - b.weekNumber);

  for (const match of completedMatches) {
    const w = match.playerWhiteId;
    const b = match.playerBlackId;
    if (!stats[w]) stats[w] = { wins: 0, losses: 0, draws: 0, points: 0, lastResults: [] };
    if (!stats[b]) stats[b] = { wins: 0, losses: 0, draws: 0, points: 0, lastResults: [] };

    if (match.result === "white_win") {
      stats[w].wins++;
      stats[w].points += 1;
      stats[w].lastResults.push("W");
      stats[b].losses++;
      stats[b].lastResults.push("L");
    } else if (match.result === "black_win") {
      stats[b].wins++;
      stats[b].points += 1;
      stats[b].lastResults.push("W");
      stats[w].losses++;
      stats[w].lastResults.push("L");
    } else if (match.result === "draw") {
      stats[w].draws++;
      stats[w].points += 0.5;
      stats[w].lastResults.push("D");
      stats[b].draws++;
      stats[b].points += 0.5;
      stats[b].lastResults.push("D");
    }
  }

  // Sort by points desc, then wins desc, then name asc
  const sorted = players.sort((a, b) => {
    const sa = stats[a.playerId];
    const sb = stats[b.playerId];
    if (sb.points !== sa.points) return sb.points - sa.points;
    if (sb.wins !== sa.wins) return sb.wins - sa.wins;
    return a.displayName.localeCompare(b.displayName);
  });

  // Upsert standings
  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i];
    const s = stats[p.playerId];

    // Check if standing exists
    const existing = await db
      .select()
      .from(leagueStandings)
      .where(and(eq(leagueStandings.leagueId, leagueId), eq(leagueStandings.playerId, p.playerId)))
      .limit(1);

    // Compute streak from lastResults (last 5)
    const last5 = s.lastResults.slice(-5);
    let streak = "";
    if (last5.length > 0) {
      // Build streak string e.g. "W-W-L"
      streak = last5.join("-");
    }
    // Movement: compare new rank to previous rank (stored in DB)
    let movement: "up" | "down" | "same" = "same";
    if (existing.length > 0) {
      const prevRank = existing[0].rank;
      if (i + 1 < prevRank) movement = "up";
      else if (i + 1 > prevRank) movement = "down";
    }

    if (existing.length > 0) {
      await db
        .update(leagueStandings)
        .set({
          wins: s.wins, losses: s.losses, draws: s.draws, points: s.points,
          rank: i + 1, displayName: p.displayName, avatarUrl: p.avatarUrl ?? undefined,
          streak, movement, lastResults: JSON.stringify(s.lastResults.slice(-5)),
        })
        .where(and(eq(leagueStandings.leagueId, leagueId), eq(leagueStandings.playerId, p.playerId)));
    } else {
      await db.insert(leagueStandings).values({
        leagueId,
        playerId: p.playerId,
        displayName: p.displayName,
        avatarUrl: p.avatarUrl ?? undefined,
        wins: s.wins,
        losses: s.losses,
        draws: s.draws,
        points: s.points,
        rank: i + 1,
        streak,
        movement,
        lastResults: JSON.stringify(s.lastResults.slice(-5)),
      });
    }
  }

  // Check if all matches are complete → mark league as completed
  const allMatches = await db
    .select()
    .from(leagueMatches)
    .where(eq(leagueMatches.leagueId, leagueId));
  const allDone = allMatches.length > 0 && allMatches.every((m) => m.resultStatus === "completed");
  if (allDone) {
    await db.update(leagues).set({ status: "completed" }).where(eq(leagues.id, leagueId));
  }
}

// ── GET /club/:clubId — list leagues for a club ───────────────────────────────
leaguesRouter.get("/club/:clubId", async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const rows = await db
      .select()
      .from(leagues)
      .where(eq(leagues.clubId, req.params.clubId))
      .orderBy(desc(leagues.createdAt));
    res.json(rows);
  } catch (err) {
    console.error("[leagues] GET /club/:clubId error:", err);
    res.status(500).json({ error: "Failed to fetch leagues" });
  }
});

// ── POST / — create a league (Draft mode — schedule generated on Start) ──────
leaguesRouter.post("/", async (req: Request, res: Response) => {
  const userId = getUser(req, res);
  if (!userId) return;

  const { clubId, name, description, maxPlayers, playerIds } = req.body as {
    clubId: string;
    name: string;
    description?: string;
    maxPlayers: number;
    playerIds?: string[]; // optional — commissioner can add players later
  };

  // Validate
  if (!clubId || !name || !maxPlayers) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  if (![4, 6, 8, 10].includes(maxPlayers)) {
    return res.status(400).json({ error: "League size must be 4, 6, 8, or 10" });
  }
  const ids = playerIds ?? [];
  if (ids.length > maxPlayers) {
    return res.status(400).json({ error: `Cannot exceed ${maxPlayers} players` });
  }

  try {
    const db = await getDb();

    // Verify requester is club admin/owner
    const membership = await db
      .select()
      .from(dbClubMembers)
      .where(and(eq(dbClubMembers.clubId, clubId), eq(dbClubMembers.userId, userId)))
      .limit(1);

    if (!membership.length || !["owner", "admin", "director"].includes(membership[0].role)) {
      return res.status(403).json({ error: "Only club admins can create leagues" });
    }

    // Fetch member details
    const memberRows = await db
      .select()
      .from(dbClubMembers)
      .where(eq(dbClubMembers.clubId, clubId));

    const memberMap = new Map(memberRows.map((m) => [m.userId, m]));

    const totalWeeks = maxPlayers - 1;
    const leagueId = nanoid(16);

    // Insert league as DRAFT — schedule is generated when commissioner starts the season
    await db.insert(leagues).values({
      id: leagueId,
      clubId,
      name: name.trim(),
      description: description?.trim() || null,
      commissionerId: userId,
      commissionerName: memberMap.get(userId)?.displayName ?? "Commissioner",
      maxPlayers,
      totalWeeks,
      status: "draft",
      currentWeek: 0,
    });

    // Insert any initial players
    for (const pid of ids) {
      const member = memberMap.get(pid);
      await db.insert(leaguePlayers).values({
        leagueId,
        playerId: pid,
        displayName: member?.displayName ?? pid,
        avatarUrl: member?.avatarUrl ?? undefined,
        chesscomUsername: member?.chesscomUsername ?? undefined,
      });
    }

    res.status(201).json({ leagueId, message: "League created in Draft mode", status: "draft" });
  } catch (err) {
    console.error("[leagues] POST / error:", err);
    res.status(500).json({ error: "Failed to create league" });
  }
});

// ── POST /:leagueId/start — transition Draft → Active, generate schedule ─────
leaguesRouter.post("/:leagueId/start", async (req: Request, res: Response) => {
  const userId = getUser(req, res);
  if (!userId) return;

  try {
    const db = await getDb();
    const [league] = await db.select().from(leagues).where(eq(leagues.id, req.params.leagueId)).limit(1);
    if (!league) return res.status(404).json({ error: "League not found" });
    if (league.status !== "draft") return res.status(400).json({ error: "League is not in Draft status" });

    // Only commissioner or club admin can start
    const isCommissioner = league.commissionerId === userId;
    const membership = await db.select().from(dbClubMembers)
      .where(and(eq(dbClubMembers.clubId, league.clubId), eq(dbClubMembers.userId, userId))).limit(1);
    const isAdmin = membership.length > 0 && ["owner", "admin", "director"].includes(membership[0].role);
    if (!isCommissioner && !isAdmin) return res.status(403).json({ error: "Only the commissioner can start the season" });

    // Verify roster is full
    const players = await db.select().from(leaguePlayers).where(eq(leaguePlayers.leagueId, league.id));
    if (players.length !== league.maxPlayers) {
      return res.status(400).json({ error: `Roster must have exactly ${league.maxPlayers} players (currently ${players.length})` });
    }

    // Fetch member details for player names
    const memberRows = await db.select().from(dbClubMembers).where(eq(dbClubMembers.clubId, league.clubId));
    const memberMap = new Map(memberRows.map((m) => [m.userId, m]));

    const playerIds = players.map((p) => p.playerId);
    const totalWeeks = league.maxPlayers - 1;

    // Generate round-robin schedule
    const schedule = generateRoundRobin(league.maxPlayers);

    // Insert weeks
    const weekIds: Record<number, number> = {};
    for (let w = 1; w <= totalWeeks; w++) {
      await db.insert(leagueWeeks).values({
        leagueId: league.id,
        weekNumber: w,
        publishedAt: new Date(),
        isComplete: 0,
      });
      const weekRow = await db.select().from(leagueWeeks)
        .where(and(eq(leagueWeeks.leagueId, league.id), eq(leagueWeeks.weekNumber, w)))
        .limit(1);
      weekIds[w] = weekRow[0].id;
    }

    // Insert matches
    for (const m of schedule) {
      const whitePlayer = players[m.whiteIdx];
      const blackPlayer = players[m.blackIdx];
      await db.insert(leagueMatches).values({
        leagueId: league.id,
        weekId: weekIds[m.weekNumber],
        weekNumber: m.weekNumber,
        playerWhiteId: playerIds[m.whiteIdx],
        playerWhiteName: whitePlayer?.displayName ?? playerIds[m.whiteIdx],
        playerBlackId: playerIds[m.blackIdx],
        playerBlackName: blackPlayer?.displayName ?? playerIds[m.blackIdx],
        resultStatus: "pending",
      });
    }

    // Initialize standings
    for (const p of players) {
      await db.insert(leagueStandings).values({
        leagueId: league.id,
        playerId: p.playerId,
        displayName: p.displayName,
        avatarUrl: p.avatarUrl ?? undefined,
        wins: 0,
        losses: 0,
        draws: 0,
        points: 0,
        rank: 0,
      });
    }

    // Update league status to active
    await db.update(leagues).set({ status: "active", currentWeek: 1 }).where(eq(leagues.id, league.id));

    res.json({ success: true, message: "Season started!", status: "active" });
  } catch (err) {
    console.error("[leagues] POST /:leagueId/start error:", err);
    res.status(500).json({ error: "Failed to start season" });
  }
});

// ── GET /invites/mine — list pending invites for the current user ────────────
// MUST be defined before /:leagueId to avoid Express treating "invites" as a leagueId
leaguesRouter.get("/invites/mine", async (req: Request, res: Response) => {
  const userId = getUser(req, res);
  if (!userId) return;
  try {
    const db = await getDb();
    const { leagueInvites } = await import("../shared/schema.js");
    const rows = await db.select({
      id: leagueInvites.id,
      leagueId: leagueInvites.leagueId,
      leagueName: leagues.name,
      commissionerName: leagueInvites.commissionerName,
      message: leagueInvites.message,
      status: leagueInvites.status,
      createdAt: leagueInvites.createdAt,
    })
      .from(leagueInvites)
      .innerJoin(leagues, eq(leagues.id, leagueInvites.leagueId))
      .where(and(eq(leagueInvites.invitedUserId, userId), eq(leagueInvites.status, "pending")))
      .orderBy(desc(leagueInvites.createdAt));
    res.json(rows);
  } catch (err) {
    console.error("[league-invites] GET /mine error:", err);
    res.status(500).json({ error: "Failed to list invites" });
  }
});

// ── GET /:leagueId — get full league detail ───────────────────────────────────
leaguesRouter.get("/:leagueId", async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const league = await db
      .select()
      .from(leagues)
      .where(eq(leagues.id, req.params.leagueId))
      .limit(1);

    if (!league.length) return res.status(404).json({ error: "League not found" });

    const players = await db
      .select()
      .from(leaguePlayers)
      .where(eq(leaguePlayers.leagueId, req.params.leagueId))
      .orderBy(asc(leaguePlayers.displayName));

    res.json({ ...league[0], players });
  } catch (err) {
    console.error("[leagues] GET /:leagueId error:", err);
    res.status(500).json({ error: "Failed to fetch league" });
  }
});

// ── GET /:leagueId/weeks — get all weeks with matches ─────────────────────────
leaguesRouter.get("/:leagueId/weeks", async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const weeks = await db
      .select()
      .from(leagueWeeks)
      .where(eq(leagueWeeks.leagueId, req.params.leagueId))
      .orderBy(asc(leagueWeeks.weekNumber));

    const matches = await db
      .select()
      .from(leagueMatches)
      .where(eq(leagueMatches.leagueId, req.params.leagueId))
      .orderBy(asc(leagueMatches.weekNumber));

    // Group matches by week
    const matchesByWeek: Record<number, typeof matches> = {};
    for (const m of matches) {
      if (!matchesByWeek[m.weekNumber]) matchesByWeek[m.weekNumber] = [];
      matchesByWeek[m.weekNumber].push(m);
    }

    const result = weeks.map((w) => ({
      ...w,
      matches: matchesByWeek[w.weekNumber] ?? [],
    }));

    res.json(result);
  } catch (err) {
    console.error("[leagues] GET /:leagueId/weeks error:", err);
    res.status(500).json({ error: "Failed to fetch weeks" });
  }
});

// ── GET /:leagueId/standings — get current standings ─────────────────────────
leaguesRouter.get("/:leagueId/standings", async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const standings = await db
      .select()
      .from(leagueStandings)
      .where(eq(leagueStandings.leagueId, req.params.leagueId))
      .orderBy(asc(leagueStandings.rank));

    res.json(standings);
  } catch (err) {
    console.error("[leagues] GET /:leagueId/standings error:", err);
    res.status(500).json({ error: "Failed to fetch standings" });
  }
});

// ── POST /:leagueId/matches/:matchId/result — dual-confirmation result report ───
// Flow: first player reports → status becomes "awaiting_confirmation"
//       second player confirms (same result) → status becomes "completed"
//       second player disagrees → status becomes "disputed"
//       commissioner/admin reports → auto-finalized (no confirmation needed)
leaguesRouter.post("/:leagueId/matches/:matchId/result", async (req: Request, res: Response) => {
  const userId = getUser(req, res);
  if (!userId) return;

  const { result } = req.body as { result: "white_win" | "black_win" | "draw" };
  if (!["white_win", "black_win", "draw"].includes(result)) {
    return res.status(400).json({ error: "Invalid result. Must be white_win, black_win, or draw" });
  }

  try {
    const db = await getDb();
    const matchId = parseInt(req.params.matchId, 10);

    const match = await db
      .select()
      .from(leagueMatches)
      .where(and(eq(leagueMatches.id, matchId), eq(leagueMatches.leagueId, req.params.leagueId)))
      .limit(1);

    if (!match.length) return res.status(404).json({ error: "Match not found" });
    if (match[0].resultStatus === "completed") {
      return res.status(409).json({ error: "Result already finalized" });
    }

    const league = await db.select().from(leagues).where(eq(leagues.id, req.params.leagueId)).limit(1);
    const m = match[0];
    const isWhite = m.playerWhiteId === userId;
    const isBlack = m.playerBlackId === userId;
    const isCommissioner = league[0]?.commissionerId === userId;
    const membership = await db
      .select()
      .from(dbClubMembers)
      .where(and(eq(dbClubMembers.clubId, league[0]?.clubId ?? ""), eq(dbClubMembers.userId, userId)))
      .limit(1);
    const isAdmin = membership.length > 0 && ["owner", "admin", "director"].includes(membership[0].role);

    if (!isWhite && !isBlack && !isCommissioner && !isAdmin) {
      return res.status(403).json({ error: "Only match participants or admins can report results" });
    }

    // Commissioner/admin: auto-finalize immediately
    if ((isCommissioner || isAdmin) && !isWhite && !isBlack) {
      await db.update(leagueMatches).set({
        result, resultStatus: "completed", reportedByUserId: userId,
        whiteReport: result, blackReport: result,
        whiteReportedAt: new Date(), blackReportedAt: new Date(),
        completedAt: new Date(),
      }).where(eq(leagueMatches.id, matchId));
      await finalizeWeekIfComplete(db, req.params.leagueId, m.weekNumber, m.weekId, matchId);
      await recalculateStandings(req.params.leagueId);
      return res.json({ success: true, message: "Result finalized by commissioner", status: "completed" });
    }

    // Player report
    const now = new Date();
    const updateFields: Record<string, unknown> = {};

    if (isWhite) {
      if (m.whiteReport) return res.status(409).json({ error: "You already reported a result" });
      updateFields.whiteReport = result;
      updateFields.whiteReportedAt = now;
      updateFields.reportedByUserId = userId;
    } else {
      if (m.blackReport) return res.status(409).json({ error: "You already reported a result" });
      updateFields.blackReport = result;
      updateFields.blackReportedAt = now;
      updateFields.reportedByUserId = userId;
    }

    // Check if the other player has already reported
    const otherReport = isWhite ? m.blackReport : m.whiteReport;
    if (otherReport) {
      // Both have now reported
      if (otherReport === result) {
        // Agreement → finalize
        updateFields.result = result;
        updateFields.resultStatus = "completed";
        updateFields.completedAt = now;
      } else {
        // Disagreement → disputed
        updateFields.resultStatus = "disputed";
      }
    } else {
      // First report → awaiting confirmation
      updateFields.resultStatus = "awaiting_confirmation";
    }

    await db.update(leagueMatches).set(updateFields).where(eq(leagueMatches.id, matchId));

    if (updateFields.resultStatus === "completed") {
      await finalizeWeekIfComplete(db, req.params.leagueId, m.weekNumber, m.weekId, matchId);
      await recalculateStandings(req.params.leagueId);
    }

    const statusMsg = updateFields.resultStatus === "completed" ? "Both players agree — result confirmed!"
      : updateFields.resultStatus === "disputed" ? "Reports conflict — commissioner will resolve"
      : "Your report is saved. Waiting for opponent to confirm.";
    res.json({ success: true, message: statusMsg, status: updateFields.resultStatus });
  } catch (err) {
    console.error("[leagues] POST result error:", err);
    res.status(500).json({ error: "Failed to record result" });
  }
});

// Helper: check if all matches in a week are completed and advance if so
async function finalizeWeekIfComplete(db: any, leagueId: string, weekNumber: number, weekId: number, justCompletedMatchId: number) {
  const weekMatches = await db
    .select()
    .from(leagueMatches)
    .where(and(eq(leagueMatches.leagueId, leagueId), eq(leagueMatches.weekNumber, weekNumber)));
  const weekComplete = weekMatches.every((m: any) => m.id === justCompletedMatchId || m.resultStatus === "completed");
  if (weekComplete) {
    await db.update(leagueWeeks).set({ isComplete: 1 }).where(eq(leagueWeeks.id, weekId));
    const leagueRow = await db.select().from(leagues).where(eq(leagues.id, leagueId)).limit(1);
    if (leagueRow[0] && leagueRow[0].currentWeek === weekNumber && leagueRow[0].currentWeek < leagueRow[0].totalWeeks) {
      await db.update(leagues).set({ currentWeek: leagueRow[0].currentWeek + 1 }).where(eq(leagues.id, leagueId));
    }
  }
}

// ── PATCH /:leagueId/matches/:matchId/result — commissioner resolve / admin override ──
// Used for: resolving disputes, overriding results, or resetting a match
leaguesRouter.patch("/:leagueId/matches/:matchId/result", async (req: Request, res: Response) => {
  const userId = getUser(req, res);
  if (!userId) return;

  const { result } = req.body as { result: "white_win" | "black_win" | "draw" | null };

  try {
    const db = await getDb();
    const league = await db.select().from(leagues).where(eq(leagues.id, req.params.leagueId)).limit(1);
    if (!league.length) return res.status(404).json({ error: "League not found" });

    const isCommissioner = league[0].commissionerId === userId;
    const membership = await db
      .select()
      .from(dbClubMembers)
      .where(and(eq(dbClubMembers.clubId, league[0].clubId), eq(dbClubMembers.userId, userId)))
      .limit(1);
    const isAdmin = membership.length > 0 && ["owner", "admin", "director"].includes(membership[0].role);

    if (!isCommissioner && !isAdmin) {
      return res.status(403).json({ error: "Only admins can override results" });
    }

    const matchId = parseInt(req.params.matchId, 10);
    await db
      .update(leagueMatches)
      .set({
        result: result ?? null,
        resultStatus: result ? "completed" : "pending",
        reportedByUserId: userId,
        completedAt: result ? new Date() : null,
        // Clear dual-confirmation fields on reset
        ...(result === null ? { whiteReport: null, blackReport: null, whiteReportedAt: null, blackReportedAt: null } : {}),
      })
      .where(eq(leagueMatches.id, matchId));

    if (result) {
      const m = await db.select().from(leagueMatches).where(eq(leagueMatches.id, matchId)).limit(1);
      if (m.length) await finalizeWeekIfComplete(db, req.params.leagueId, m[0].weekNumber, m[0].weekId, matchId);
    }
    await recalculateStandings(req.params.leagueId);
    res.json({ success: true });
  } catch (err) {
    console.error("[leagues] PATCH result error:", err);
    res.status(500).json({ error: "Failed to override result" });
  }
});

// ── POST /:leagueId/advance-week ─────────────────────────────────────────────
// Commissioner-only: close the current week and advance currentWeek by 1.
leaguesRouter.post("/:leagueId/advance-week", async (req: Request, res: Response) => {
  try {
    const userId = getUser(req, res);
    if (!userId) return;

    const db = await getDb();

    const league = await db
      .select()
      .from(leagues)
      .where(eq(leagues.id, req.params.leagueId))
      .limit(1);
    if (!league.length) return res.status(404).json({ error: "League not found" });

    if (league[0].commissionerId !== userId) {
      return res.status(403).json({ error: "Only the commissioner can advance the week" });
    }

    if (league[0].status !== "active") {
      return res.status(400).json({ error: "League is not active" });
    }

    const currentWeek = league[0].currentWeek ?? 1;
    const totalWeeks = league[0].totalWeeks ?? 1;

    // Mark the current week as complete
    const weekRow = await db
      .select()
      .from(leagueWeeks)
      .where(and(eq(leagueWeeks.leagueId, req.params.leagueId), eq(leagueWeeks.weekNumber, currentWeek)))
      .limit(1);

    if (weekRow.length) {
      await db
        .update(leagueWeeks)
        .set({ isComplete: 1 })
        .where(eq(leagueWeeks.id, weekRow[0].id));
    }

    // Recalculate standings after the week closes
    await recalculateStandings(req.params.leagueId);

    // If this was the final week, mark the league as completed
    if (currentWeek >= totalWeeks) {
      await db
        .update(leagues)
        .set({ status: "completed" })
        .where(eq(leagues.id, req.params.leagueId));

      // Determine champion (rank 1 standing)
      const topStanding = await db
        .select()
        .from(leagueStandings)
        .where(eq(leagueStandings.leagueId, req.params.leagueId))
        .orderBy(leagueStandings.rank)
        .limit(1);

      const champion = topStanding.length ? topStanding[0] : null;

      // Permanently award the League Champion badge on the member's club row
      if (champion) {
        await db
          .update(dbClubMembers)
          .set({ leagueChampionships: sql`league_championships + 1` })
          .where(
            and(
              eq(dbClubMembers.clubId, league[0].clubId),
              eq(dbClubMembers.userId, champion.playerId)
            )
          );
      }

      return res.json({
        success: true,
        completed: true,
        champion: champion ? { playerId: champion.playerId, displayName: champion.displayName, points: champion.points } : null,
      });
    }

    // Advance currentWeek
    const nextWeek = currentWeek + 1;
    await db
      .update(leagues)
      .set({ currentWeek: nextWeek })
      .where(eq(leagues.id, req.params.leagueId));

    res.json({ success: true, newWeek: nextWeek });
  } catch (err) {
    console.error("[leagues] POST advance-week error:", err);
    res.status(500).json({ error: "Failed to advance week" });
  }
});

// ── PATCH /:leagueId/weeks/:weekId/deadline — commissioner sets/clears a week deadline ──
leaguesRouter.patch("/:leagueId/weeks/:weekId/deadline", async (req: Request, res: Response) => {
  const userId = getUser(req, res);
  if (!userId) return;
  try {
    const db = await getDb();
    const league = await db.select().from(leagues).where(eq(leagues.id, req.params.leagueId)).limit(1);
    if (!league.length) return res.status(404).json({ error: "League not found" });
    if (league[0].commissionerId !== userId) {
      return res.status(403).json({ error: "Only the commissioner can set deadlines" });
    }
    const weekId = parseInt(req.params.weekId, 10);
    const { deadline } = req.body as { deadline: string | null };
    await db.update(leagueWeeks).set({
      deadline: deadline ? new Date(deadline) : null,
    }).where(eq(leagueWeeks.id, weekId));
    res.json({ success: true });
  } catch (err) {
    console.error("[leagues] PATCH deadline error:", err);
    res.status(500).json({ error: "Failed to set deadline" });
  }
});

// ── GET /:leagueId/join-requests — commissioner sees pending requests ──────────────
leaguesRouter.get("/:leagueId/join-requests", async (req: Request, res: Response) => {
  const userId = getUser(req, res);
  if (!userId) return;
  try {
    const db = await getDb();
    const league = await db.select().from(leagues).where(eq(leagues.id, req.params.leagueId)).limit(1);
    if (!league.length) return res.status(404).json({ error: "League not found" });
    // Only commissioner or club admin can see requests
    const isCommissioner = league[0].commissionerId === userId;
    const membership = await db.select().from(dbClubMembers)
      .where(and(eq(dbClubMembers.clubId, league[0].clubId), eq(dbClubMembers.userId, userId))).limit(1);
    const isAdmin = membership.length > 0 && ["owner", "admin", "director"].includes(membership[0].role);
    if (!isCommissioner && !isAdmin) return res.status(403).json({ error: "Forbidden" });
    const requests = await db.select().from(leagueJoinRequests)
      .where(and(eq(leagueJoinRequests.leagueId, req.params.leagueId), eq(leagueJoinRequests.status, "pending")))
      .orderBy(asc(leagueJoinRequests.createdAt));
    res.json(requests);
  } catch (err) {
    console.error("[leagues] GET join-requests error:", err);
    res.status(500).json({ error: "Failed to fetch join requests" });
  }
});

// ── POST /:leagueId/join-request — player requests to join a Draft league ─────
leaguesRouter.post("/:leagueId/join-request", async (req: Request, res: Response) => {
  const userId = getUser(req, res);
  if (!userId) return;
  try {
    const db = await getDb();
    const league = await db.select().from(leagues).where(eq(leagues.id, req.params.leagueId)).limit(1);
    if (!league.length) return res.status(404).json({ error: "League not found" });
    if (league[0].status !== "draft") return res.status(400).json({ error: "League is not accepting requests" });
    // Check if already a player
    const existing = await db.select().from(leaguePlayers)
      .where(and(eq(leaguePlayers.leagueId, req.params.leagueId), eq(leaguePlayers.playerId, userId))).limit(1);
    if (existing.length) return res.status(409).json({ error: "Already a player in this league" });
    // Check if already requested
    const existingReq = await db.select().from(leagueJoinRequests)
      .where(and(eq(leagueJoinRequests.leagueId, req.params.leagueId), eq(leagueJoinRequests.playerId, userId))).limit(1);
    if (existingReq.length) return res.status(409).json({ error: "Request already submitted", status: existingReq[0].status });
    // Get user details
    const userRow = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const u = userRow[0];
    await db.insert(leagueJoinRequests).values({
      leagueId: req.params.leagueId,
      playerId: userId,
      displayName: u?.displayName ?? "Unknown",
      avatarUrl: u?.avatarUrl ?? undefined,
      chesscomUsername: u?.chesscomUsername ?? undefined,
      status: "pending",
    });
    // Fire-and-forget push notification to commissioner
    const leagueName = league[0].name;
    const requesterName = u?.displayName ?? "A player";
    notifyCommissioner(
      req.params.leagueId,
      `New join request — ${leagueName}`,
      `${requesterName} wants to join your league. Tap to review.`,
      `/leagues/${req.params.leagueId}`
    ).catch(() => {});
    res.json({ success: true, message: "Join request submitted" });
  } catch (err) {
    console.error("[leagues] POST join-request error:", err);
    res.status(500).json({ error: "Failed to submit join request" });
  }
});

// ── PATCH /:leagueId/join-requests/:requestId — approve or reject ─────────────
leaguesRouter.patch("/:leagueId/join-requests/:requestId", async (req: Request, res: Response) => {
  const userId = getUser(req, res);
  if (!userId) return;
  const { action } = req.body as { action: "approve" | "reject" };
  if (!action || !["approve", "reject"].includes(action)) {
    return res.status(400).json({ error: "action must be approve or reject" });
  }
  try {
    const db = await getDb();
    const league = await db.select().from(leagues).where(eq(leagues.id, req.params.leagueId)).limit(1);
    if (!league.length) return res.status(404).json({ error: "League not found" });
    const isCommissioner = league[0].commissionerId === userId;
    const membership = await db.select().from(dbClubMembers)
      .where(and(eq(dbClubMembers.clubId, league[0].clubId), eq(dbClubMembers.userId, userId))).limit(1);
    const isAdmin = membership.length > 0 && ["owner", "admin", "director"].includes(membership[0].role);
    if (!isCommissioner && !isAdmin) return res.status(403).json({ error: "Forbidden" });
    const reqId = parseInt(req.params.requestId, 10);
    const joinReq = await db.select().from(leagueJoinRequests).where(eq(leagueJoinRequests.id, reqId)).limit(1);
    if (!joinReq.length) return res.status(404).json({ error: "Request not found" });
    if (joinReq[0].status !== "pending") return res.status(409).json({ error: "Request already reviewed" });
    // Update request status
    await db.update(leagueJoinRequests).set({
      status: action === "approve" ? "approved" : "rejected",
      reviewedAt: new Date(),
      reviewedByUserId: userId,
    }).where(eq(leagueJoinRequests.id, reqId));
    // If approved, add to league players
    if (action === "approve") {
      const currentPlayers = await db.select().from(leaguePlayers)
        .where(eq(leaguePlayers.leagueId, req.params.leagueId));
      if (currentPlayers.length >= league[0].maxPlayers) {
        return res.status(400).json({ error: "League is full" });
      }
      await db.insert(leaguePlayers).values({
        leagueId: req.params.leagueId,
        playerId: joinReq[0].playerId,
        displayName: joinReq[0].displayName,
        avatarUrl: joinReq[0].avatarUrl ?? undefined,
        chesscomUsername: joinReq[0].chesscomUsername ?? undefined,
      });
    }
    res.json({ success: true, action });
  } catch (err) {
    console.error("[leagues] PATCH join-request error:", err);
    res.status(500).json({ error: "Failed to review request" });
  }
});

// ── POST /:leagueId/push/subscribe — commissioner subscribes for notifications ─
leaguesRouter.post("/:leagueId/push/subscribe", async (req: Request, res: Response) => {
  const userId = getUser(req, res);
  if (!userId) return;
  const { subscription } = req.body as { subscription: { endpoint: string; keys: { p256dh: string; auth: string } } };
  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return res.status(400).json({ error: "Invalid subscription object" });
  }
  try {
    const db = await getDb();
    const league = await db.select().from(leagues).where(eq(leagues.id, req.params.leagueId)).limit(1);
    if (!league.length) return res.status(404).json({ error: "League not found" });
    // Only commissioner or club admin can subscribe for notifications
    const isCommissioner = league[0].commissionerId === userId;
    const membership = await db.select().from(dbClubMembers)
      .where(and(eq(dbClubMembers.clubId, league[0].clubId), eq(dbClubMembers.userId, userId))).limit(1);
    const isAdmin = membership.length > 0 && ["owner", "admin", "director"].includes(membership[0].role);
    if (!isCommissioner && !isAdmin) return res.status(403).json({ error: "Only the commissioner can subscribe" });
    // Upsert by endpoint — if same endpoint re-subscribes, update keys
    const existing = await db.select().from(leaguePushSubscriptions)
      .where(and(eq(leaguePushSubscriptions.leagueId, req.params.leagueId), eq(leaguePushSubscriptions.userId, userId)))
      .limit(1);
    if (existing.length) {
      await db.update(leaguePushSubscriptions).set({
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      }).where(eq(leaguePushSubscriptions.id, existing[0].id));
    } else {
      await db.insert(leaguePushSubscriptions).values({
        id: nanoid(),
        leagueId: req.params.leagueId,
        userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      });
    }
    res.json({ success: true });
  } catch (err) {
    console.error("[league-push] subscribe error:", err);
    res.status(500).json({ error: "Failed to save subscription" });
  }
});

// ── DELETE /:leagueId/push/subscribe — commissioner unsubscribes ──────────────
leaguesRouter.delete("/:leagueId/push/subscribe", async (req: Request, res: Response) => {
  const userId = getUser(req, res);
  if (!userId) return;
  try {
    const db = await getDb();
    await db.delete(leaguePushSubscriptions)
      .where(and(eq(leaguePushSubscriptions.leagueId, req.params.leagueId), eq(leaguePushSubscriptions.userId, userId)));
    res.json({ success: true });
  } catch (err) {
    console.error("[league-push] unsubscribe error:", err);
    res.status(500).json({ error: "Failed to remove subscription" });
  }
});

// ── GET /:leagueId/push/status — check if current user is subscribed ──────────
leaguesRouter.get("/:leagueId/push/status", async (req: Request, res: Response) => {
  const userId = getUser(req, res);
  if (!userId) return;
  try {
    const db = await getDb();
    const sub = await db.select({ id: leaguePushSubscriptions.id })
      .from(leaguePushSubscriptions)
      .where(and(eq(leaguePushSubscriptions.leagueId, req.params.leagueId), eq(leaguePushSubscriptions.userId, userId)))
      .limit(1);
    res.json({ subscribed: sub.length > 0 });
  } catch (err) {
    console.error("[league-push] status error:", err);
    res.status(500).json({ error: "Failed to check subscription" });
  }
});


// ── League Invite Endpoints ────────────────────────────────────────────────────
// Commissioner sends an invite to a specific club member.
// POST /:leagueId/invites
leaguesRouter.post("/:leagueId/invites", async (req: Request, res: Response) => {
  const commissionerId = getUser(req, res);
  if (!commissionerId) return;
  const { leagueId } = req.params;
  const { invitedUserId, message } = req.body as { invitedUserId: string; message?: string };
  if (!invitedUserId) return res.status(400).json({ error: "invitedUserId required" });
  try {
    const db = await getDb();
    // Verify the caller is the commissioner
    const [league] = await db.select().from(leagues).where(eq(leagues.id, leagueId)).limit(1);
    if (!league) return res.status(404).json({ error: "League not found" });
    if (league.commissionerId !== commissionerId) return res.status(403).json({ error: "Commissioner only" });
    if (league.status !== "draft") return res.status(400).json({ error: "Can only invite to Draft leagues" });
    // Get invited member details from club membership
    const [member] = await db.select().from(dbClubMembers)
      .where(and(eq(dbClubMembers.clubId, league.clubId), eq(dbClubMembers.userId, invitedUserId)))
      .limit(1);
    if (!member) return res.status(404).json({ error: "Member not found in club" });
    // Get commissioner display name
    const [commissioner] = await db.select({ displayName: users.displayName }).from(users)
      .where(eq(users.id, commissionerId)).limit(1);
    // Upsert invite (cancel any existing declined invite so commissioner can re-invite)
    const { leagueInvites } = await import("../shared/schema.js");
    const existing = await db.select().from(leagueInvites)
      .where(and(eq(leagueInvites.leagueId, leagueId), eq(leagueInvites.invitedUserId, invitedUserId)))
      .limit(1);
    if (existing.length && existing[0].status === "pending") {
      return res.status(409).json({ error: "Invite already pending for this player" });
    }
    if (existing.length) {
      // Re-invite: reset to pending
      await db.update(leagueInvites)
        .set({ status: "pending", message: message ?? null, commissionerId, commissionerName: commissioner?.displayName ?? "Commissioner", respondedAt: null, createdAt: new Date() })
        .where(eq(leagueInvites.id, existing[0].id));
      const [updated] = await db.select().from(leagueInvites).where(eq(leagueInvites.id, existing[0].id)).limit(1);
      // Send push notification to invited player
      await notifyPlayer(invitedUserId, leagueId, league.name, commissioner?.displayName ?? "Commissioner");
      return res.json(updated);
    }
    const [inserted] = await db.insert(leagueInvites).values({
      leagueId,
      invitedUserId,
      invitedDisplayName: member.displayName,
      invitedAvatarUrl: member.avatarUrl ?? null,
      invitedChesscomUsername: member.chesscomUsername ?? null,
      commissionerId,
      commissionerName: commissioner?.displayName ?? "Commissioner",
      status: "pending",
      message: message ?? null,
    }).$returningId();
    const [invite] = await db.select().from(leagueInvites).where(eq(leagueInvites.id, inserted.id)).limit(1);
    // Send push notification to invited player
    await notifyPlayer(invitedUserId, leagueId, league.name, commissioner?.displayName ?? "Commissioner");
    res.status(201).json(invite);
  } catch (err) {
    console.error("[league-invites] POST error:", err);
    res.status(500).json({ error: "Failed to send invite" });
  }
});

// GET /:leagueId/invites — list all invites for a league (commissioner only)
leaguesRouter.get("/:leagueId/invites", async (req: Request, res: Response) => {
  const userId = getUser(req, res);
  if (!userId) return;
  const { leagueId } = req.params;
  try {
    const db = await getDb();
    const [league] = await db.select().from(leagues).where(eq(leagues.id, leagueId)).limit(1);
    if (!league) return res.status(404).json({ error: "League not found" });
    if (league.commissionerId !== userId) return res.status(403).json({ error: "Commissioner only" });
    const { leagueInvites } = await import("../shared/schema.js");
    const rows = await db.select().from(leagueInvites)
      .where(eq(leagueInvites.leagueId, leagueId))
      .orderBy(desc(leagueInvites.createdAt));
    res.json(rows);
  } catch (err) {
    console.error("[league-invites] GET error:", err);
    res.status(500).json({ error: "Failed to list invites" });
  }
});

// (moved to before /:leagueId — see above)

// PATCH /:leagueId/invites/:inviteId — accept or decline an invite (invited player only)
leaguesRouter.patch("/:leagueId/invites/:inviteId", async (req: Request, res: Response) => {
  const userId = getUser(req, res);
  if (!userId) return;
  const { leagueId, inviteId } = req.params;
  const { action } = req.body as { action: "accept" | "decline" };
  if (!["accept", "decline"].includes(action)) return res.status(400).json({ error: "action must be accept or decline" });
  try {
    const db = await getDb();
    const { leagueInvites } = await import("../shared/schema.js");
    const [invite] = await db.select().from(leagueInvites)
      .where(and(eq(leagueInvites.id, Number(inviteId)), eq(leagueInvites.leagueId, leagueId)))
      .limit(1);
    if (!invite) return res.status(404).json({ error: "Invite not found" });
    if (invite.invitedUserId !== userId) return res.status(403).json({ error: "Not your invite" });
    if (invite.status !== "pending") return res.status(409).json({ error: "Invite already responded to" });
    await db.update(leagueInvites)
      .set({ status: action === "accept" ? "accepted" : "declined", respondedAt: new Date() })
      .where(eq(leagueInvites.id, Number(inviteId)));
    if (action === "accept") {
      // Add the player to the league roster
      const [league] = await db.select().from(leagues).where(eq(leagues.id, leagueId)).limit(1);
      if (league && league.status === "draft") {
        const [member] = await db.select().from(dbClubMembers)
          .where(and(eq(dbClubMembers.clubId, league.clubId), eq(dbClubMembers.userId, userId)))
          .limit(1);
        if (member) {
          const existing = await db.select({ id: leaguePlayers.id }).from(leaguePlayers)
            .where(and(eq(leaguePlayers.leagueId, leagueId), eq(leaguePlayers.playerId, userId)))
            .limit(1);
          if (!existing.length) {
            await db.insert(leaguePlayers).values({
              leagueId,
              playerId: userId,
              displayName: member.displayName,
              avatarUrl: member.avatarUrl ?? null,
              chesscomUsername: member.chesscomUsername ?? null,
            });
          }
        }
      }
    }
    res.json({ success: true, status: action === "accept" ? "accepted" : "declined" });
  } catch (err) {
    console.error("[league-invites] PATCH error:", err);
    res.status(500).json({ error: "Failed to respond to invite" });
  }
});

// DELETE /:leagueId/invites/:inviteId — commissioner cancels a pending invite
leaguesRouter.delete("/:leagueId/invites/:inviteId", async (req: Request, res: Response) => {
  const userId = getUser(req, res);
  if (!userId) return;
  const { leagueId, inviteId } = req.params;
  try {
    const db = await getDb();
    const [league] = await db.select().from(leagues).where(eq(leagues.id, leagueId)).limit(1);
    if (!league) return res.status(404).json({ error: "League not found" });
    if (league.commissionerId !== userId) return res.status(403).json({ error: "Commissioner only" });
    const { leagueInvites } = await import("../shared/schema.js");
    await db.update(leagueInvites)
      .set({ status: "cancelled" })
      .where(and(eq(leagueInvites.id, Number(inviteId)), eq(leagueInvites.leagueId, leagueId)));
    res.json({ success: true });
  } catch (err) {
    console.error("[league-invites] DELETE error:", err);
    res.status(500).json({ error: "Failed to cancel invite" });
  }
});

/** Send a push notification to the invited player's subscribed devices */
async function notifyPlayer(userId: string, leagueId: string, leagueName: string, commissionerName: string) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return;
  try {
    const db = await getDb();
    // Look up the player's push subscriptions (reuse league_push_subscriptions table keyed by userId)
    const subs = await db.select().from(leaguePushSubscriptions)
      .where(eq(leaguePushSubscriptions.userId, userId));
    if (!subs.length) return;
    const payload = JSON.stringify({
      title: `You've been invited to ${leagueName}!`,
      body: `${commissionerName} has invited you to join their league. Tap to accept or decline.`,
      url: `/leagues/${leagueId}?invite=1`,
      tag: `league-invite-${leagueId}`,
    });
    const staleIds: string[] = [];
    await Promise.all(subs.map(async (row) => {
      try {
        await webpush.sendNotification(
          { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
          payload
        );
      } catch (err: any) {
        const code = err?.statusCode;
        if (code === 410 || code === 404) staleIds.push(row.id);
        else console.warn("[league-push] Player notify failed:", err?.message);
      }
    }));
    if (staleIds.length) {
      for (const id of staleIds) {
        await db.delete(leaguePushSubscriptions).where(eq(leaguePushSubscriptions.id, id));
      }
    }
  } catch (err) {
    console.error("[league-invites] notifyPlayer error:", err);
  }
}
