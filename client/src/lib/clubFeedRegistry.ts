/**
 * OTB Chess — Club Feed Registry
 *
 * Manages the chronological activity feed for each club.
 * Events are persisted in localStorage under a per-club key.
 *
 * Event types:
 *   - member_join          — a user joined the club
 *   - member_leave         — a user left the club
 *   - tournament_created   — owner created a new tournament for the club
 *   - tournament_completed — a linked tournament finished
 *   - announcement         — owner/director posted a text announcement
 *   - club_founded         — the club was created (always the oldest event)
 *   - poll                 — owner/director posted a poll with options
 *   - rsvp_form            — owner/director posted an event RSVP form
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type FeedEventType =
  | "member_join"
  | "member_leave"
  | "tournament_created"
  | "tournament_completed"
  | "announcement"
  | "club_founded"
  | "poll"
  | "rsvp_form"
  | "poll_result"
  | "battle_result"
  | "leaderboard_snapshot"
  | "potm_announcement";

/** A single option in a Poll */
export interface PollOption {
  id: string;
  text: string;
  /** userId → true for each voter */
  votes: Record<string, true>;
}

/** Inline RSVP response for an rsvp_form feed post */
export interface FeedRSVPEntry {
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  status: "going" | "maybe" | "not_going";
}

export interface FeedEvent {
  /** Unique event ID */
  id: string;
  clubId: string;
  type: FeedEventType;
  /** ISO timestamp */
  createdAt: string;
  /** Display name of the actor (user who triggered the event) */
  actorName: string;
  /** Optional actor avatar URL */
  actorAvatarUrl?: string | null;
  /** Human-readable description of the event */
  description: string;
  /** Optional secondary detail (e.g. tournament name, announcement body) */
  detail?: string;
  /** Optional link target (e.g. /tournament/:id) */
  linkHref?: string;
  /** Optional link label */
  linkLabel?: string;

  // ── Poll fields ──────────────────────────────────────────────────────────
  /** Poll question text (type === "poll") */
  pollQuestion?: string;
  /** Poll options with vote tracking */
  pollOptions?: PollOption[];
  /** ISO expiry — after this time voting is closed */
  pollExpiresAt?: string;
  /** Whether multiple options can be selected */
  pollMultiple?: boolean;

  // ── RSVP Form fields ─────────────────────────────────────────────────────
  /** Event title shown on the RSVP form (type === "rsvp_form") */
  rsvpTitle?: string;
  /** ISO date of the event */
  rsvpDate?: string;
  /** Venue / location text */
  rsvpVenue?: string;
  /** Collected RSVP responses */
  rsvpEntries?: FeedRSVPEntry[];

  // ── Pin field ────────────────────────────────────────────────────────────
  /** True when a director/owner has pinned this post to the top of the feed */
  isPinned?: boolean;

  // ── Battle Result fields ─────────────────────────────────────────────────
  /** White/Player A name (type === "battle_result") */
  battlePlayerA?: string;
  /** Black/Player B name */
  battlePlayerB?: string;
  /** "player_a" | "player_b" | "draw" */
  battleOutcome?: "player_a" | "player_b" | "draw";
  /** Optional ELO of player A */
  battlePlayerAElo?: number;
  /** Optional ELO of player B */
  battlePlayerBElo?: number;
  /** Deduplication key: battleId so we don't double-post */
  battleId?: string;

  // ── Leaderboard Snapshot fields ──────────────────────────────────────────
  /** Top-N leaderboard entries (type === "leaderboard_snapshot") */
  leaderboardEntries?: Array<{
    rank: number;
    playerId: string;
    playerName: string;
    wins: number;
    draws: number;
    losses: number;
    total: number;
    winRate: number;
  }>;
  /** Total completed battles at the time of the snapshot */
  leaderboardBattleCount?: number;
  /** Milestone that triggered this snapshot (e.g. 5, 10, 15…) */
  leaderboardMilestone?: number;

  // ── Poll Result fields ───────────────────────────────────────────────────
  /** ID of the poll feed event this result summarises (type === "poll_result") */
  pollResultForId?: string;
  /** The winning option text(s), comma-separated when tied */
  pollResultWinner?: string;
  /** Ordered breakdown: [{text, votes, pct}] sorted by votes desc */
  pollResultBreakdown?: Array<{ text: string; votes: number; pct: number }>;
  /** Total votes cast */
  pollResultTotalVotes?: number;

  // ── Player of the Month fields ───────────────────────────────────────────
  /** "YYYY-MM" deduplication key, e.g. "2026-03" (type === "potm_announcement") */
  potmMonth?: string;
  /** Display name of the POTM winner */
  potmWinnerName?: string;
  /** User ID of the POTM winner */
  potmWinnerId?: string;
  /** Avatar URL of the POTM winner */
  potmWinnerAvatarUrl?: string | null;
  /** Number of battle wins in the scoring window */
  potmWins?: number;
  /** Win rate percentage (0–100) */
  potmWinRate?: number;
  /** Number of events attended */
  potmEventsAttended?: number;
  /** Total battles played */
  potmTotalBattles?: number;
  /** Human-readable month label, e.g. "March 2026" */
  potmMonthLabel?: string;
  /** Runner-up entries (up to 2) */
  potmRunnerUps?: Array<{
    playerId: string;
    playerName: string;
    wins: number;
    winRate: number;
    total: number;
  }>;
}

// ── Storage helpers ───────────────────────────────────────────────────────────

function feedKey(clubId: string): string {
  return `otb-club-feed-v1-${clubId}`;
}

function loadFeed(clubId: string): FeedEvent[] {
  try {
    const raw = localStorage.getItem(feedKey(clubId));
    if (!raw) return [];
    return JSON.parse(raw) as FeedEvent[];
  } catch {
    return [];
  }
}

function saveFeed(clubId: string, events: FeedEvent[]): void {
  try {
    localStorage.setItem(feedKey(clubId), JSON.stringify(events));
  } catch {
    // localStorage full — fail silently
  }
}

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * List all feed events for a club, newest first.
 * Optionally limit to the most recent N events.
 */
export function listFeedEvents(clubId: string, limit?: number): FeedEvent[] {
  const events = [...loadFeed(clubId)].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  return limit ? events.slice(0, limit) : events;
}

/** Add a single feed event. Returns the saved event. Also persists to server API (fire-and-forget). */
export function addFeedEvent(event: Omit<FeedEvent, "id">): FeedEvent {
  const saved: FeedEvent = { ...event, id: generateId() };
  const existing = loadFeed(event.clubId);
  saveFeed(event.clubId, [...existing, saved]);
  // Persist to server (fire-and-forget)
  _persistFeedToServer(event.clubId, saved);
  return saved;
}

/** Fire-and-forget: POST a feed event to the server API. */
function _persistFeedToServer(clubId: string, event: FeedEvent): void {
  try {
    const token = localStorage.getItem("otb-auth-token");
    if (!token) return;
    fetch(`/api/clubs/${clubId}/feed`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        id: event.id,
        type: event.type,
        actorName: event.actorName ?? "",
        actorAvatarUrl: event.actorAvatarUrl ?? null,
        detail: event.detail ?? null,
        linkHref: event.linkHref ?? null,
        linkLabel: event.linkLabel ?? null,
        isPinned: event.isPinned ?? false,
        payload: (event.pollOptions || event.rsvpEntries) ? JSON.stringify(event) : null,
      }),
    }).then((res) => {
      if (!res.ok) {
        window.dispatchEvent(new CustomEvent("otb:sync-error", { detail: { context: "feed" } }));
      }
    }).catch(() => {
      window.dispatchEvent(new CustomEvent("otb:sync-error", { detail: { context: "feed" } }));
    });
  } catch { /* ignore */ }
}

/**
 * Load the feed from the server API and merge with localStorage.
 * Server is the source of truth; any server events not in localStorage are added.
 * Returns the merged list (newest first).
 */
export async function syncFeedFromServer(clubId: string): Promise<FeedEvent[]> {
  try {
    const res = await fetch(`/api/clubs/${clubId}/feed?limit=100`);
    if (!res.ok) return listFeedEvents(clubId);
    const serverRows = await res.json() as Array<{
      id: string; type: string; actorName: string; actorAvatarUrl?: string | null;
      detail?: string | null; linkHref?: string | null; linkLabel?: string | null;
      isPinned: boolean; payload?: string | null; createdAt: string;
    }>;
    const local = loadFeed(clubId);
    const localIds = new Set(local.map((e) => e.id));
    const merged = [...local];
    for (const row of serverRows) {
      if (localIds.has(row.id)) continue;
      let extra: Partial<FeedEvent> = {};
      if (row.payload) { try { extra = JSON.parse(row.payload); } catch { /* ignore */ } }
      merged.push({
        id: row.id,
        clubId,
        type: row.type as FeedEventType,
        createdAt: row.createdAt,
        actorName: row.actorName,
        actorAvatarUrl: row.actorAvatarUrl ?? null,
        description: extra.description ?? row.detail ?? "",
        detail: row.detail ?? undefined,
        linkHref: row.linkHref ?? undefined,
        linkLabel: row.linkLabel ?? undefined,
        isPinned: row.isPinned,
        ...extra,
      });
    }
    saveFeed(clubId, merged);
    return merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch {
    return listFeedEvents(clubId);
  }
}

/** Post an announcement from an owner or director. */
export function postAnnouncement(
  clubId: string,
  actorName: string,
  body: string,
  actorAvatarUrl?: string | null
): FeedEvent {
  return addFeedEvent({
    clubId,
    type: "announcement",
    createdAt: new Date().toISOString(),
    actorName,
    actorAvatarUrl,
    description: `${actorName} posted an announcement`,
    detail: body,
  });
}

/** Post a poll from an owner or director. */
export function postPoll(
  clubId: string,
  actorName: string,
  question: string,
  options: string[],
  expiresInHours: number,
  multiple: boolean,
  actorAvatarUrl?: string | null
): FeedEvent {
  const pollOptions: PollOption[] = options.map((text) => ({
    id: generateId(),
    text,
    votes: {},
  }));
  const expiresAt = new Date(Date.now() + expiresInHours * 3600 * 1000).toISOString();
  return addFeedEvent({
    clubId,
    type: "poll",
    createdAt: new Date().toISOString(),
    actorName,
    actorAvatarUrl,
    description: `${actorName} posted a poll`,
    pollQuestion: question,
    pollOptions,
    pollExpiresAt: expiresAt,
    pollMultiple: multiple,
  });
}

/** Cast a vote on a poll option. Removes previous vote if single-choice. */
export function castPollVote(
  clubId: string,
  feedEventId: string,
  optionId: string,
  userId: string,
  multiple: boolean
): void {
  const events = loadFeed(clubId);
  const ev = events.find((e) => e.id === feedEventId);
  if (!ev || !ev.pollOptions) return;

  // Check if poll is expired
  if (ev.pollExpiresAt && new Date(ev.pollExpiresAt) < new Date()) return;

  ev.pollOptions = ev.pollOptions.map((opt) => {
    const newVotes = { ...opt.votes };
    if (opt.id === optionId) {
      // Toggle this option
      if (newVotes[userId]) {
        delete newVotes[userId];
      } else {
        newVotes[userId] = true;
      }
    } else if (!multiple) {
      // Single-choice: remove vote from all other options
      delete newVotes[userId];
    }
    return { ...opt, votes: newVotes };
  });

  saveFeed(clubId, events);
}

/** Post an RSVP form from an owner or director. */
export function postRsvpForm(
  clubId: string,
  actorName: string,
  title: string,
  date: string,
  venue: string,
  actorAvatarUrl?: string | null
): FeedEvent {
  return addFeedEvent({
    clubId,
    type: "rsvp_form",
    createdAt: new Date().toISOString(),
    actorName,
    actorAvatarUrl,
    description: `${actorName} posted an RSVP form`,
    rsvpTitle: title,
    rsvpDate: date,
    rsvpVenue: venue,
    rsvpEntries: [],
  });
}

/** Upsert a user's RSVP response on an rsvp_form feed post. */
export function upsertFeedRSVP(
  clubId: string,
  feedEventId: string,
  userId: string,
  displayName: string,
  status: FeedRSVPEntry["status"],
  avatarUrl?: string | null
): void {
  const events = loadFeed(clubId);
  const ev = events.find((e) => e.id === feedEventId);
  if (!ev) return;

  const entries = ev.rsvpEntries ?? [];
  const idx = entries.findIndex((r) => r.userId === userId);
  if (idx >= 0) {
    entries[idx] = { userId, displayName, avatarUrl, status };
  } else {
    entries.push({ userId, displayName, avatarUrl, status });
  }
  ev.rsvpEntries = entries;
  saveFeed(clubId, events);
}

/** Record a member joining the club. */
export function recordMemberJoin(
  clubId: string,
  memberName: string,
  avatarUrl?: string | null
): FeedEvent {
  return addFeedEvent({
    clubId,
    type: "member_join",
    createdAt: new Date().toISOString(),
    actorName: memberName,
    actorAvatarUrl: avatarUrl,
    description: `${memberName} joined the club`,
  });
}

/** Record a member leaving the club. */
export function recordMemberLeave(
  clubId: string,
  memberName: string
): FeedEvent {
  return addFeedEvent({
    clubId,
    type: "member_leave",
    createdAt: new Date().toISOString(),
    actorName: memberName,
    description: `${memberName} left the club`,
  });
}

/** Record a tournament being created for the club. */
export function recordTournamentCreated(
  clubId: string,
  directorName: string,
  tournamentName: string,
  tournamentId: string
): FeedEvent {
  return addFeedEvent({
    clubId,
    type: "tournament_created",
    createdAt: new Date().toISOString(),
    actorName: directorName,
    description: `${directorName} created a new tournament`,
    detail: tournamentName,
    linkHref: `/tournament/${tournamentId}/play`,
    linkLabel: "Join Tournament",
  });
}

/** Record a tournament completing for the club. */
export function recordTournamentCompleted(
  clubId: string,
  tournamentName: string,
  winnerName: string,
  tournamentId: string,
  winnerScore?: number,
  totalRounds?: number
): FeedEvent {
  const formatScore = (s: number) => s % 1 !== 0 ? `${Math.floor(s)}½` : String(s);
  const scoreStr =
    winnerScore !== undefined && totalRounds !== undefined
      ? `${formatScore(winnerScore)}/${totalRounds} pts`
      : winnerScore !== undefined
      ? `${formatScore(winnerScore)} pts`
      : null;
  const detail = scoreStr
    ? `🏆 ${winnerName} — ${scoreStr}`
    : `🏆 ${winnerName}`;
  return addFeedEvent({
    clubId,
    type: "tournament_completed",
    createdAt: new Date().toISOString(),
    actorName: winnerName,
    description: `${tournamentName} concluded`,
    detail,
    linkHref: `/tournament/${tournamentId}/results`,
    linkLabel: "View results",
  });
}

/**
 * Check for expired polls that don't yet have a result post, and automatically
 * post a poll_result summary for each one. Returns true if any polls were closed.
 */
export function checkAndCloseExpiredPolls(clubId: string): boolean {
  const events = loadFeed(clubId);
  const now = new Date();
  let changed = false;

  // Collect IDs of polls that already have a result post
  const closedPollIds = new Set(
    events.filter((e) => e.type === "poll_result" && e.pollResultForId).map((e) => e.pollResultForId!)
  );

  const newResults: FeedEvent[] = [];

  for (const ev of events) {
    if (ev.type !== "poll" || !ev.pollExpiresAt || !ev.pollOptions) continue;
    if (new Date(ev.pollExpiresAt) >= now) continue; // not yet expired
    if (closedPollIds.has(ev.id)) continue; // already has a result post

    // Compute vote totals per option
    const totalVotes = ev.pollOptions.reduce(
      (s, o) => s + Object.keys(o.votes).length,
      0
    );

    const breakdown = ev.pollOptions
      .map((o) => ({
        text: o.text,
        votes: Object.keys(o.votes).length,
        pct: totalVotes > 0 ? Math.round((Object.keys(o.votes).length / totalVotes) * 100) : 0,
      }))
      .sort((a, b) => b.votes - a.votes);

    const maxVotes = breakdown[0]?.votes ?? 0;
    const winners = breakdown.filter((o) => o.votes === maxVotes && o.votes > 0);
    const winnerText =
      winners.length === 0
        ? "No votes cast"
        : winners.map((w) => w.text).join(" & ");

    const resultEvent: FeedEvent = {
      id: generateId(),
      clubId,
      type: "poll_result",
      createdAt: ev.pollExpiresAt, // post-dated to the exact close time
      actorName: ev.actorName,
      actorAvatarUrl: ev.actorAvatarUrl,
      description: `Poll closed: "${ev.pollQuestion ?? "Poll"}"`,
      detail: totalVotes === 0 ? "No votes were cast." : `Winner: ${winnerText}`,
      pollResultForId: ev.id,
      pollResultWinner: winnerText,
      pollResultBreakdown: breakdown,
      pollResultTotalVotes: totalVotes,
    };

    newResults.push(resultEvent);
    closedPollIds.add(ev.id);
    changed = true;
  }

  if (changed) {
    saveFeed(clubId, [...events, ...newResults]);
  }

  return changed;
}

// ── Scheduled Polls ─────────────────────────────────────────────────────────

/** A poll that has been queued but not yet published to the live feed. */
export interface ScheduledPoll {
  id: string;
  clubId: string;
  actorName: string;
  actorAvatarUrl?: string | null;
  question: string;
  options: string[];
  expiresInHours: number;
  multiple: boolean;
  /** ISO datetime when this poll should be published */
  scheduledAt: string;
  /** ISO datetime when this draft was created */
  createdAt: string;
}

function scheduledKey(clubId: string): string {
  return `otb-club-scheduled-polls-v1-${clubId}`;
}

function loadScheduled(clubId: string): ScheduledPoll[] {
  try {
    const raw = localStorage.getItem(scheduledKey(clubId));
    if (!raw) return [];
    return JSON.parse(raw) as ScheduledPoll[];
  } catch {
    return [];
  }
}

function saveScheduled(clubId: string, polls: ScheduledPoll[]): void {
  try {
    localStorage.setItem(scheduledKey(clubId), JSON.stringify(polls));
  } catch {
    /* ignore */
  }
}

/** Save a poll as a scheduled draft (not yet in the live feed). */
export function schedulePoll(
  clubId: string,
  actorName: string,
  question: string,
  options: string[],
  expiresInHours: number,
  multiple: boolean,
  scheduledAt: string,
  actorAvatarUrl?: string | null
): ScheduledPoll {
  const draft: ScheduledPoll = {
    id: generateId(),
    clubId,
    actorName,
    actorAvatarUrl: actorAvatarUrl ?? null,
    question,
    options,
    expiresInHours,
    multiple,
    scheduledAt,
    createdAt: new Date().toISOString(),
  };
  const existing = loadScheduled(clubId);
  saveScheduled(clubId, [...existing, draft]);
  return draft;
}

/** List all scheduled (pending) polls for a club, sorted by scheduledAt ascending. */
export function listScheduledPolls(clubId: string): ScheduledPoll[] {
  return loadScheduled(clubId).sort(
    (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
  );
}

/** Cancel and remove a scheduled poll before it publishes. */
export function cancelScheduledPoll(clubId: string, draftId: string): void {
  const remaining = loadScheduled(clubId).filter((p) => p.id !== draftId);
  saveScheduled(clubId, remaining);
}

/**
 * Publish any scheduled polls whose scheduledAt time has passed.
 * Returns true if at least one poll was published.
 */
export function publishScheduledPolls(clubId: string): boolean {
  const now = new Date();
  const drafts = loadScheduled(clubId);
  const due = drafts.filter((p) => new Date(p.scheduledAt) <= now);
  if (due.length === 0) return false;

  for (const draft of due) {
    const pollOptions: PollOption[] = draft.options.map((text) => ({
      id: generateId(),
      text,
      votes: {},
    }));
    const expiresAt = new Date(
      new Date(draft.scheduledAt).getTime() + draft.expiresInHours * 3600 * 1000
    ).toISOString();
    addFeedEvent({
      clubId,
      type: "poll",
      createdAt: draft.scheduledAt, // use scheduled time as the post timestamp
      actorName: draft.actorName,
      actorAvatarUrl: draft.actorAvatarUrl,
      description: `${draft.actorName} posted a poll`,
      pollQuestion: draft.question,
      pollOptions,
      pollExpiresAt: expiresAt,
      pollMultiple: draft.multiple,
    });
  }

  // Remove published drafts
  const remaining = drafts.filter((p) => new Date(p.scheduledAt) > now);
  saveScheduled(clubId, remaining);
  return true;
}

/** Delete a specific feed event (owner/director moderation). */
export function deleteFeedEvent(clubId: string, eventId: string): void {
  const events = loadFeed(clubId).filter((e) => e.id !== eventId);
  saveFeed(clubId, events);
}

/**
 * Pin a feed event to the top of the club feed.
 * Only one post can be pinned at a time — any previously pinned post is unpinned first.
 */
export function pinFeedEvent(clubId: string, eventId: string): void {
  const events = loadFeed(clubId).map((e) => ({
    ...e,
    isPinned: e.id === eventId ? true : undefined,
  }));
  saveFeed(clubId, events);
}

/** Unpin the currently pinned feed event for a club. */
export function unpinFeedEvent(clubId: string, eventId: string): void {
  const events = loadFeed(clubId).map((e) =>
    e.id === eventId ? { ...e, isPinned: undefined } : e
  );
  saveFeed(clubId, events);
}

/** Auto-post a battle result card to the club feed. Deduplicates by battleId. */
export function postBattleResult(params: {
  clubId: string;
  battleId: string;
  playerAName: string;
  playerBName: string;
  outcome: "player_a" | "player_b" | "draw";
  playerAElo?: number;
  playerBElo?: number;
  directorName?: string;
}): FeedEvent | null {
  // Deduplication: skip if a feed event with this battleId already exists
  const existing = loadFeed(params.clubId);
  if (existing.some((e) => e.battleId === params.battleId)) return null;

  const winnerName =
    params.outcome === "player_a" ? params.playerAName
    : params.outcome === "player_b" ? params.playerBName
    : null;

  const description =
    params.outcome === "draw"
      ? `${params.playerAName} vs ${params.playerBName} — Draw`
      : `${winnerName} defeated ${params.outcome === "player_a" ? params.playerBName : params.playerAName}`;

  const resultBadge =
    params.outcome === "draw" ? "½–½" : params.outcome === "player_a" ? "1–0" : "0–1";

  return addFeedEvent({
    clubId: params.clubId,
    type: "battle_result",
    createdAt: new Date().toISOString(),
    actorName: params.directorName ?? "Director",
    description,
    detail: resultBadge,
    battleId: params.battleId,
    battlePlayerA: params.playerAName,
    battlePlayerB: params.playerBName,
    battleOutcome: params.outcome,
    battlePlayerAElo: params.playerAElo,
    battlePlayerBElo: params.playerBElo,
  });
}

/**
 * Auto-post a mini-leaderboard snapshot after every LEADERBOARD_MILESTONE battles.
 * Deduplicates by milestone number — only one snapshot per milestone.
 * Requires at least 3 unique players with completed battles.
 *
 * @param clubId  - the club to post to
 * @param totalCompleted - the current count of completed battles (after recording the latest result)
 * @param milestone - how many battles between snapshots (default: 5)
 */
export function postLeaderboardSnapshot(
  clubId: string,
  totalCompleted: number,
  milestone: number = 5
): FeedEvent | null {
  // Only trigger on exact milestones (5, 10, 15 …)
  if (totalCompleted === 0 || totalCompleted % milestone !== 0) return null;

  // Deduplication: skip if we already posted a snapshot for this milestone
  const existing = loadFeed(clubId);
  if (existing.some((e) => e.leaderboardMilestone === totalCompleted)) return null;

  // Build leaderboard from clubBattleRegistry data stored in localStorage
  const storageKey = `otb_battles_${clubId}`;
  let battles: Array<{
    status: string;
    result?: string;
    playerAId: string;
    playerAName: string;
    playerBId: string;
    playerBName: string;
  }> = [];
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) battles = JSON.parse(raw);
  } catch {
    return null;
  }

  const completed = battles.filter((b) => b.status === "completed" && b.result);
  const map = new Map<string, { name: string; wins: number; draws: number; losses: number }>();

  function ensure(id: string, name: string) {
    if (!map.has(id)) map.set(id, { name, wins: 0, draws: 0, losses: 0 });
  }

  for (const battle of completed) {
    ensure(battle.playerAId, battle.playerAName);
    ensure(battle.playerBId, battle.playerBName);
    const a = map.get(battle.playerAId)!;
    const b = map.get(battle.playerBId)!;
    if (battle.result === "player_a") { a.wins++; b.losses++; }
    else if (battle.result === "player_b") { b.wins++; a.losses++; }
    else { a.draws++; b.draws++; }
  }

  // Require at least 3 unique players
  if (map.size < 3) return null;

  const entries = Array.from(map.entries())
    .map(([playerId, stats]) => {
      const total = stats.wins + stats.draws + stats.losses;
      return {
        playerId,
        playerName: stats.name,
        wins: stats.wins,
        draws: stats.draws,
        losses: stats.losses,
        total,
        winRate: total > 0 ? Math.round((stats.wins / total) * 100) : 0,
      };
    })
    .sort((a, b) => b.winRate - a.winRate || b.wins - a.wins)
    .slice(0, 3)
    .map((e, i) => ({ ...e, rank: i + 1 }));

  const top = entries[0];
  return addFeedEvent({
    clubId,
    type: "leaderboard_snapshot",
    createdAt: new Date().toISOString(),
    actorName: "Club",
    description: `Leaderboard update after ${totalCompleted} battles`,
    detail: `Top player: ${top.playerName} (${top.winRate}% win rate)`,
    leaderboardEntries: entries,
    leaderboardBattleCount: totalCompleted,
    leaderboardMilestone: totalCompleted,
  });
}

// ── Player of the Month helpers ─────────────────────────────────────────────

/**
 * Returns the "YYYY-MM" key for the previous calendar month.
 * Used as the deduplication key for POTM posts.
 * e.g. if today is 2026-03-23, returns "2026-02"
 */
export function getPreviousMonthKey(now: Date = new Date()): string {
  const d = new Date(now);
  d.setDate(1); // avoid day-of-month overflow
  d.setMonth(d.getMonth() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/**
 * Returns the human-readable label for the previous calendar month.
 * e.g. "February 2026"
 */
export function getPreviousMonthLabel(now: Date = new Date()): string {
  const d = new Date(now);
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

/**
 * Returns true if a POTM announcement has already been posted for the given
 * month key ("YYYY-MM") in this club's feed.
 */
export function shouldPostPotmThisMonth(
  clubId: string,
  monthKey: string
): boolean {
  const events = loadFeed(clubId);
  return !events.some(
    (e) => e.type === "potm_announcement" && e.potmMonth === monthKey
  );
}

/**
 * Post a Player of the Month announcement to the club feed.
 * Deduplicates by potmMonth — only one POTM post per "YYYY-MM" key.
 *
 * @param clubId         - the club to post to
 * @param winner         - the POTM winner's stats
 * @param runnerUps      - up to 2 runner-up entries
 * @param postedByName   - display name of the director/system posting
 * @param monthKey       - "YYYY-MM" dedup key (defaults to previous month)
 * @param monthLabel     - human-readable label, e.g. "February 2026"
 * @param now            - injectable reference date for testing
 */
export function postPlayerOfMonth(params: {
  clubId: string;
  winner: {
    memberId: string;
    memberName: string;
    avatarUrl?: string | null;
    battleWins: number;
    winRate: number;
    eventsAttended: number;
    totalBattles: number;
  };
  runnerUps?: Array<{
    playerId: string;
    playerName: string;
    wins: number;
    winRate: number;
    total: number;
  }>;
  postedByName?: string;
  monthKey?: string;
  monthLabel?: string;
  now?: Date;
}): FeedEvent | null {
  const now = params.now ?? new Date();
  const monthKey = params.monthKey ?? getPreviousMonthKey(now);
  const monthLabel = params.monthLabel ?? getPreviousMonthLabel(now);

  // Deduplication: only one POTM post per month
  if (!shouldPostPotmThisMonth(params.clubId, monthKey)) return null;

  const actorName = params.postedByName ?? "Club";
  const { winner } = params;

  return addFeedEvent({
    clubId: params.clubId,
    type: "potm_announcement",
    createdAt: now.toISOString(),
    actorName,
    description: `🏆 ${winner.memberName} is the Player of the Month for ${monthLabel}!`,
    detail: `${winner.battleWins} wins · ${winner.winRate}% win rate · ${winner.eventsAttended} events attended`,
    potmMonth: monthKey,
    potmMonthLabel: monthLabel,
    potmWinnerId: winner.memberId,
    potmWinnerName: winner.memberName,
    potmWinnerAvatarUrl: winner.avatarUrl,
    potmWins: winner.battleWins,
    potmWinRate: winner.winRate,
    potmEventsAttended: winner.eventsAttended,
    potmTotalBattles: winner.totalBattles,
    potmRunnerUps: params.runnerUps?.slice(0, 2),
  });
}

/** Clear all feed events for a club (test helper). */
export function clearFeed(clubId: string): void {
  try {
    localStorage.removeItem(feedKey(clubId));
  } catch {
    /* ignore */
  }
}

// ── Seed helpers ──────────────────────────────────────────────────────────────

/**
 * Seed a realistic historical feed for a club if it has no events yet.
 * Generates events based on the club's founding date and member list.
 */
export function seedFeedIfEmpty(
  clubId: string,
  clubName: string,
  ownerName: string,
  foundedAt: string,
  members: Array<{ displayName: string; joinedAt: string; avatarUrl: string | null }>
): void {
  if (loadFeed(clubId).length > 0) return;

  const events: Omit<FeedEvent, "id">[] = [];

  // Club founded event
  events.push({
    clubId,
    type: "club_founded",
    createdAt: foundedAt,
    actorName: ownerName,
    description: `${ownerName} founded ${clubName}`,
    detail: "Welcome to the club!",
  });

  // Member join events (skip the owner who is index 0)
  members.slice(1).forEach((m) => {
    events.push({
      clubId,
      type: "member_join",
      createdAt: m.joinedAt,
      actorName: m.displayName,
      actorAvatarUrl: m.avatarUrl,
      description: `${m.displayName} joined the club`,
    });
  });

  // Sort by date and save
  const sorted = events.sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  const withIds: FeedEvent[] = sorted.map((e) => ({
    ...e,
    id: generateId(),
  }));

  saveFeed(clubId, withIds);
}
