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
  dbClubMembers,
} from "../shared/schema.js";
import { eq, and, desc, asc, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { Request, Response } from "express";

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

// ── POST / — create a league ──────────────────────────────────────────────────
leaguesRouter.post("/", async (req: Request, res: Response) => {
  const userId = getUser(req, res);
  if (!userId) return;

  const { clubId, name, description, maxPlayers, playerIds } = req.body as {
    clubId: string;
    name: string;
    description?: string;
    maxPlayers: number;
    playerIds: string[]; // array of user IDs
  };

  // Validate
  if (!clubId || !name || !maxPlayers || !playerIds) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  if (![4, 6, 8, 10].includes(maxPlayers)) {
    return res.status(400).json({ error: "League size must be 4, 6, 8, or 10" });
  }
  if (playerIds.length !== maxPlayers) {
    return res.status(400).json({ error: `Exactly ${maxPlayers} players required` });
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

    // Fetch member details for selected players
    const memberRows = await db
      .select()
      .from(dbClubMembers)
      .where(eq(dbClubMembers.clubId, clubId));

    const memberMap = new Map(memberRows.map((m) => [m.userId, m]));

    const totalWeeks = maxPlayers - 1;
    const leagueId = nanoid(16);

    // Insert league
    await db.insert(leagues).values({
      id: leagueId,
      clubId,
      name: name.trim(),
      description: description?.trim() || null,
      commissionerId: userId,
      commissionerName: memberMap.get(userId)?.displayName ?? "Commissioner",
      maxPlayers,
      totalWeeks,
      status: "active",
      currentWeek: 1,
    });

    // Insert league players
    for (const pid of playerIds) {
      const member = memberMap.get(pid);
      await db.insert(leaguePlayers).values({
        leagueId,
        playerId: pid,
        displayName: member?.displayName ?? pid,
        avatarUrl: member?.avatarUrl ?? undefined,
        chesscomUsername: member?.chesscomUsername ?? undefined,
      });
    }

    // Generate round-robin schedule
    const schedule = generateRoundRobin(maxPlayers);

    // Insert weeks
    const weekIds: Record<number, number> = {};
    for (let w = 1; w <= totalWeeks; w++) {
      const [inserted] = await db.insert(leagueWeeks).values({
        leagueId,
        weekNumber: w,
        publishedAt: new Date(),
        isComplete: 0,
      });
      // Get the inserted id
      const weekRow = await db
        .select()
        .from(leagueWeeks)
        .where(and(eq(leagueWeeks.leagueId, leagueId), eq(leagueWeeks.weekNumber, w)))
        .limit(1);
      weekIds[w] = weekRow[0].id;
    }

    // Insert matches
    for (const m of schedule) {
      const whitePlayer = memberMap.get(playerIds[m.whiteIdx]);
      const blackPlayer = memberMap.get(playerIds[m.blackIdx]);
      await db.insert(leagueMatches).values({
        leagueId,
        weekId: weekIds[m.weekNumber],
        weekNumber: m.weekNumber,
        playerWhiteId: playerIds[m.whiteIdx],
        playerWhiteName: whitePlayer?.displayName ?? playerIds[m.whiteIdx],
        playerBlackId: playerIds[m.blackIdx],
        playerBlackName: blackPlayer?.displayName ?? playerIds[m.blackIdx],
        resultStatus: "pending",
      });
    }

    // Initialize standings (all zeros)
    for (const pid of playerIds) {
      const member = memberMap.get(pid);
      await db.insert(leagueStandings).values({
        leagueId,
        playerId: pid,
        displayName: member?.displayName ?? pid,
        avatarUrl: member?.avatarUrl ?? undefined,
        wins: 0,
        losses: 0,
        draws: 0,
        points: 0,
        rank: 0,
      });
    }

    res.status(201).json({ leagueId, message: "League created successfully" });
  } catch (err) {
    console.error("[leagues] POST / error:", err);
    res.status(500).json({ error: "Failed to create league" });
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

// ── POST /:leagueId/matches/:matchId/result — report result ───────────────────
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
      return res.status(409).json({ error: "Result already submitted" });
    }

    // Verify reporter is one of the players or a league commissioner/admin
    const league = await db
      .select()
      .from(leagues)
      .where(eq(leagues.id, req.params.leagueId))
      .limit(1);

    const isPlayer = match[0].playerWhiteId === userId || match[0].playerBlackId === userId;
    const isCommissioner = league[0]?.commissionerId === userId;

    // Also check if club admin
    const membership = await db
      .select()
      .from(dbClubMembers)
      .where(and(eq(dbClubMembers.clubId, league[0]?.clubId ?? ""), eq(dbClubMembers.userId, userId)))
      .limit(1);
    const isAdmin = membership.length > 0 && ["owner", "admin", "director"].includes(membership[0].role);

    if (!isPlayer && !isCommissioner && !isAdmin) {
      return res.status(403).json({ error: "Only match participants or admins can report results" });
    }

    // Update match
    await db
      .update(leagueMatches)
      .set({
        result,
        resultStatus: "completed",
        reportedByUserId: userId,
        completedAt: new Date(),
      })
      .where(eq(leagueMatches.id, matchId));

    // Check if all matches in this week are complete → mark week complete
    const weekMatches = await db
      .select()
      .from(leagueMatches)
      .where(and(eq(leagueMatches.leagueId, req.params.leagueId), eq(leagueMatches.weekNumber, match[0].weekNumber)));

    const weekComplete = weekMatches.every((m) => m.id === matchId || m.resultStatus === "completed");
    if (weekComplete) {
      await db
        .update(leagueWeeks)
        .set({ isComplete: 1 })
        .where(eq(leagueWeeks.id, match[0].weekId));

      // Advance currentWeek if this is the current week
      const leagueRow = await db.select().from(leagues).where(eq(leagues.id, req.params.leagueId)).limit(1);
      if (leagueRow[0] && leagueRow[0].currentWeek === match[0].weekNumber && leagueRow[0].currentWeek < leagueRow[0].totalWeeks) {
        await db
          .update(leagues)
          .set({ currentWeek: leagueRow[0].currentWeek + 1 })
          .where(eq(leagues.id, req.params.leagueId));
      }
    }

    // Recalculate standings
    await recalculateStandings(req.params.leagueId);

    res.json({ success: true, message: "Result recorded" });
  } catch (err) {
    console.error("[leagues] POST result error:", err);
    res.status(500).json({ error: "Failed to record result" });
  }
});

// ── PATCH /:leagueId/matches/:matchId/result — admin override ─────────────────
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
      })
      .where(eq(leagueMatches.id, matchId));

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
