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
  | "poll_result";

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

  // ── Poll Result fields ───────────────────────────────────────────────────
  /** ID of the poll feed event this result summarises (type === "poll_result") */
  pollResultForId?: string;
  /** The winning option text(s), comma-separated when tied */
  pollResultWinner?: string;
  /** Ordered breakdown: [{text, votes, pct}] sorted by votes desc */
  pollResultBreakdown?: Array<{ text: string; votes: number; pct: number }>;
  /** Total votes cast */
  pollResultTotalVotes?: number;
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

/** Add a single feed event. Returns the saved event. */
export function addFeedEvent(event: Omit<FeedEvent, "id">): FeedEvent {
  const saved: FeedEvent = { ...event, id: generateId() };
  const existing = loadFeed(event.clubId);
  saveFeed(event.clubId, [...existing, saved]);
  return saved;
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
    linkHref: `/tournament/${tournamentId}`,
    linkLabel: "View tournament",
  });
}

/** Record a tournament completing for the club. */
export function recordTournamentCompleted(
  clubId: string,
  tournamentName: string,
  winnerName: string,
  tournamentId: string
): FeedEvent {
  return addFeedEvent({
    clubId,
    type: "tournament_completed",
    createdAt: new Date().toISOString(),
    actorName: winnerName,
    description: `${tournamentName} concluded`,
    detail: `Winner: ${winnerName}`,
    linkHref: `/tournament/${tournamentId}`,
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
