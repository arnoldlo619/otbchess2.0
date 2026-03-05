/**
 * OTB Chess — Club Feed Registry
 *
 * Manages the chronological activity feed for each club.
 * Events are persisted in localStorage under a per-club key.
 *
 * Event types:
 *   - member_join       — a user joined the club
 *   - member_leave      — a user left the club
 *   - tournament_created — owner created a new tournament for the club
 *   - tournament_completed — a linked tournament finished
 *   - announcement      — owner/director posted a text announcement
 *   - club_founded      — the club was created (always the oldest event)
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type FeedEventType =
  | "member_join"
  | "member_leave"
  | "tournament_created"
  | "tournament_completed"
  | "announcement"
  | "club_founded";

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
