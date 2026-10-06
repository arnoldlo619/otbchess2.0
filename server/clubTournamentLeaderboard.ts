import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import {
  clubEvents,
  clubTournamentScoreEntries,
  dbClubMembers,
  tournamentState,
} from "../shared/schema.js";
import { canonicalizeClubEventType } from "../shared/clubEventTypes.js";
import { getDb } from "./db.js";

export interface TournamentLeaderboardPlayer {
  username?: unknown;
  name?: unknown;
  avatarUrl?: unknown;
  platform?: unknown;
  points?: unknown;
  wins?: unknown;
  draws?: unknown;
  losses?: unknown;
}

export interface CompletedTournamentState {
  status?: unknown;
  players?: unknown;
}

export interface ClubLeaderboardEntry {
  rank: number;
  memberUserId: string;
  displayName: string;
  avatarUrl: string | null;
  totalPoints: number;
  totalWins: number;
  tournamentsPlayed: number;
  latestEarnedAt: string;
  isViewer: boolean;
}

export interface ClubTournamentScoreSummary {
  clubId: string | null;
  tournamentId: string;
  status: "materialized" | "skipped";
  reason?: "not_linked" | "not_completed" | "not_tournament" | "malformed_state";
  entriesWritten: number;
  matchedPlayers: number;
  unmatchedUsernames: string[];
}

export interface ClubLeaderboardResult {
  entries: ClubLeaderboardEntry[];
  completedTournamentsCount: number;
  playersRankedCount: number;
}

const SCORE_EPSILON = 0.000_001;

function normalizeUsername(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

function asNonNegativeInteger(value: unknown): number {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : 0;
}

function asNonNegativePoints(value: unknown): number | null {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : null;
}

function pointsSnapshot(points: number): string {
  return Number.isInteger(points) ? String(points) : String(Number(points.toFixed(3)));
}

function numericPoints(value: string): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function toTournamentPlayers(state: CompletedTournamentState): TournamentLeaderboardPlayer[] | null {
  if (state.status !== "completed" || !Array.isArray(state.players)) return null;
  return state.players.filter((player): player is TournamentLeaderboardPlayer => (
    Boolean(player) && typeof player === "object"
  ));
}

function finalStandingOrder(players: TournamentLeaderboardPlayer[]) {
  return players
    .map((player) => ({ player, points: asNonNegativePoints(player.points) }))
    .filter((candidate): candidate is { player: TournamentLeaderboardPlayer; points: number } => candidate.points !== null)
    .sort((left, right) => {
      if (right.points !== left.points) return right.points - left.points;
      const winsDelta = asNonNegativeInteger(right.player.wins) - asNonNegativeInteger(left.player.wins);
      if (winsDelta !== 0) return winsDelta;
      return (normalizeUsername(left.player.username) ?? "").localeCompare(normalizeUsername(right.player.username) ?? "");
    });
}

/**
 * Safely replaces one completed Club tournament's score slice. This is the sole
 * write path for the immutable ledger, so retries and director corrections are
 * idempotent and cannot add points twice.
 */
export async function materializeClubTournamentScores(
  tournamentId: string,
  state: CompletedTournamentState,
): Promise<ClubTournamentScoreSummary> {
  const db = await getDb();
  const [event] = await db
    .select({ clubId: clubEvents.clubId, eventType: clubEvents.eventType, tournamentId: clubEvents.tournamentId })
    .from(clubEvents)
    .where(eq(clubEvents.tournamentId, tournamentId))
    .limit(1);

  if (!event) {
    return { clubId: null, tournamentId, status: "skipped", reason: "not_linked", entriesWritten: 0, matchedPlayers: 0, unmatchedUsernames: [] };
  }

  if (canonicalizeClubEventType(event.eventType, event.tournamentId) !== "tournament") {
    return { clubId: event.clubId, tournamentId, status: "skipped", reason: "not_tournament", entriesWritten: 0, matchedPlayers: 0, unmatchedUsernames: [] };
  }

  const players = toTournamentPlayers(state);
  if (!players) {
    return { clubId: event.clubId, tournamentId, status: "skipped", reason: state.status === "completed" ? "malformed_state" : "not_completed", entriesWritten: 0, matchedPlayers: 0, unmatchedUsernames: [] };
  }

  const members = await db
    .select({
      userId: dbClubMembers.userId,
      displayName: dbClubMembers.displayName,
      chesscomUsername: dbClubMembers.chesscomUsername,
      avatarUrl: dbClubMembers.avatarUrl,
    })
    .from(dbClubMembers)
    .where(eq(dbClubMembers.clubId, event.clubId));

  const membersByUsername = new Map(
    members
      .map((member) => ({ member, username: normalizeUsername(member.chesscomUsername) }))
      .filter((candidate): candidate is { member: typeof members[number]; username: string } => candidate.username !== null)
      .map(({ member, username }) => [username, member]),
  );

  const unmatchedUsernames = new Set<string>();
  const finalizedAt = new Date();
  const includedMemberIds = new Set<string>();
  const entries = finalStandingOrder(players).flatMap(({ player, points }, index) => {
    const username = normalizeUsername(player.username);
    if (!username || player.platform === "lichess") return [];
    const member = membersByUsername.get(username);
    if (!member || includedMemberIds.has(member.userId)) {
      unmatchedUsernames.add(username);
      return [];
    }
    includedMemberIds.add(member.userId);
    return [{
      id: nanoid(24),
      clubId: event.clubId,
      tournamentId,
      memberUserId: member.userId,
      chesscomUsername: username,
      playerName: typeof player.name === "string" && player.name.trim() ? player.name.trim().slice(0, 100) : member.displayName,
      avatarUrl: typeof player.avatarUrl === "string" && player.avatarUrl.trim() ? player.avatarUrl.trim().slice(0, 500) : member.avatarUrl,
      points: pointsSnapshot(points),
      wins: asNonNegativeInteger(player.wins),
      draws: asNonNegativeInteger(player.draws),
      losses: asNonNegativeInteger(player.losses),
      finalRank: index + 1,
      finalizedAt,
      updatedAt: finalizedAt,
    }];
  });

  await db.transaction(async (tx) => {
    await tx.delete(clubTournamentScoreEntries).where(and(
      eq(clubTournamentScoreEntries.clubId, event.clubId),
      eq(clubTournamentScoreEntries.tournamentId, tournamentId),
    ));
    if (entries.length > 0) await tx.insert(clubTournamentScoreEntries).values(entries);
  });

  return {
    clubId: event.clubId,
    tournamentId,
    status: "materialized",
    entriesWritten: entries.length,
    matchedPlayers: entries.length,
    unmatchedUsernames: Array.from(unmatchedUsernames).sort(),
  };
}

/** Reconciles one Club's completed, tournament-linked events without trusting client scores. */
export async function reconcileClubTournamentScores(clubId: string, tournamentId?: string) {
  const db = await getDb();
  const events = await db
    .select({ tournamentId: clubEvents.tournamentId })
    .from(clubEvents)
    .where(eq(clubEvents.clubId, clubId));

  const tournamentIds = Array.from(new Set(events
    .map((event) => event.tournamentId)
    .filter((id): id is string => Boolean(id) && (!tournamentId || id === tournamentId))));

  const summaries: ClubTournamentScoreSummary[] = [];
  for (const id of tournamentIds) {
    const [stateRow] = await db
      .select({ stateJson: tournamentState.stateJson })
      .from(tournamentState)
      .where(eq(tournamentState.tournamentId, id))
      .limit(1);
    if (!stateRow) {
      summaries.push({ clubId, tournamentId: id, status: "skipped", reason: "not_completed", entriesWritten: 0, matchedPlayers: 0, unmatchedUsernames: [] });
      continue;
    }
    try {
      summaries.push(await materializeClubTournamentScores(id, JSON.parse(stateRow.stateJson) as CompletedTournamentState));
    } catch {
      summaries.push({ clubId, tournamentId: id, status: "skipped", reason: "malformed_state", entriesWritten: 0, matchedPlayers: 0, unmatchedUsernames: [] });
    }
  }

  return {
    clubId,
    scannedTournaments: tournamentIds.length,
    materializedTournaments: summaries.filter((summary) => summary.status === "materialized").length,
    entriesWritten: summaries.reduce((total, summary) => total + summary.entriesWritten, 0),
    unmatchedUsernames: Array.from(new Set(summaries.flatMap((summary) => summary.unmatchedUsernames))).sort(),
    summaries,
  };
}

/** Reads active-member-only Club standings using the immutable tournament ledger. */
export async function getClubTournamentLeaderboard(clubId: string, viewerUserId: string): Promise<ClubLeaderboardResult> {
  const db = await getDb();
  const [members, scoreEntries] = await Promise.all([
    db.select({
      userId: dbClubMembers.userId,
      displayName: dbClubMembers.displayName,
      avatarUrl: dbClubMembers.avatarUrl,
    }).from(dbClubMembers).where(eq(dbClubMembers.clubId, clubId)),
    db.select().from(clubTournamentScoreEntries).where(eq(clubTournamentScoreEntries.clubId, clubId)),
  ]);

  const membersById = new Map(members.map((member) => [member.userId, member]));
  const aggregate = new Map<string, {
    memberUserId: string;
    displayName: string;
    avatarUrl: string | null;
    totalPoints: number;
    totalWins: number;
    tournamentIds: Set<string>;
    latestEarnedAt: Date;
  }>();

  for (const score of scoreEntries) {
    const member = membersById.get(score.memberUserId);
    if (!member) continue;
    const current = aggregate.get(member.userId) ?? {
      memberUserId: member.userId,
      displayName: member.displayName,
      avatarUrl: member.avatarUrl ?? null,
      totalPoints: 0,
      totalWins: 0,
      tournamentIds: new Set<string>(),
      latestEarnedAt: score.finalizedAt,
    };
    current.totalPoints += numericPoints(score.points);
    current.totalWins += score.wins;
    current.tournamentIds.add(score.tournamentId);
    if (score.finalizedAt > current.latestEarnedAt) current.latestEarnedAt = score.finalizedAt;
    aggregate.set(member.userId, current);
  }

  const ranked = Array.from(aggregate.values())
    .sort((left, right) => (
      right.totalPoints - left.totalPoints
      || right.totalWins - left.totalWins
      || right.latestEarnedAt.getTime() - left.latestEarnedAt.getTime()
      || left.displayName.localeCompare(right.displayName)
    ));

  let lastPoints: number | null = null;
  let rank = 0;
  const entries = ranked.map((entry, index) => {
    if (lastPoints === null || Math.abs(entry.totalPoints - lastPoints) > SCORE_EPSILON) rank = index + 1;
    lastPoints = entry.totalPoints;
    return {
      rank,
      memberUserId: entry.memberUserId,
      displayName: entry.displayName,
      avatarUrl: entry.avatarUrl,
      totalPoints: Number(entry.totalPoints.toFixed(3)),
      totalWins: entry.totalWins,
      tournamentsPlayed: entry.tournamentIds.size,
      latestEarnedAt: entry.latestEarnedAt.toISOString(),
      isViewer: entry.memberUserId === viewerUserId,
    };
  });

  return {
    entries,
    completedTournamentsCount: new Set(scoreEntries.map((entry) => entry.tournamentId)).size,
    playersRankedCount: entries.length,
  };
}
