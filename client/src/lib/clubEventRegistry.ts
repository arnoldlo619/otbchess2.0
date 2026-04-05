/**
 * OTB Chess — Club Event Registry
 *
 * Manages club-level events (meetups, tournament nights, social sessions)
 * with RSVP tracking and comment threads. Data is persisted in localStorage.
 *
 * Storage keys:
 *   otb-club-events-v1          — array of ClubEvent objects
 *   otb-club-rsvps-v1           — array of ClubEventRSVP objects
 *   otb-club-event-comments-v1  — array of ClubEventComment objects
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type RSVPStatus = "going" | "not_going" | "maybe";

export interface ClubEvent {
  id: string;
  clubId: string;
  /** Display title, e.g. "Thursday Night Blitz" */
  title: string;
  /** Optional longer description */
  description?: string;
  /** ISO date-time string for event start */
  startAt: string;
  /** ISO date-time string for event end (optional) */
  endAt?: string;
  /** Venue name */
  venue?: string;
  /** Full address */
  address?: string;
  /** CDN URL for the event cover/poster image */
  coverImageUrl?: string;
  /** Accent colour for the event card gradient (hex) */
  accentColor?: string;
  /** User ID of the creator */
  creatorId: string;
  /** Display name of the creator */
  creatorName: string;
  /** Optional linked tournament ID */
  tournamentId?: string;
  /** Optional parking / transport note */
  parkingNote?: string;
  /** Optional admission note, e.g. "Free with RSVP or $5 at door" */
  admissionNote?: string;
  /** Whether the event is published (visible to members) */
  isPublished: boolean;
  /**
   * Optional event type for special formats.
   * Omit for standard chess night / tournament.
   */
  eventType?: "standard" | "speed_dating" | "trivia_night" | "puzzle_relay";
  /** Speed Dating: number of rounds */
  speedDatingRounds?: number;
  /** Speed Dating: minutes per round */
  speedDatingMinutes?: number;
  /** Trivia Night: list of trivia categories */
  triviaCategories?: string[];
  /** Trivia Night: number of questions */
  triviaQuestionCount?: number;
  /** Puzzle Relay: number of teams */
  puzzleRelayTeams?: number;
  /** Puzzle Relay: puzzle difficulty */
  puzzleRelayDifficulty?: "beginner" | "intermediate" | "advanced";
  createdAt: string;
  updatedAt: string;
}

export interface ClubEventRSVP {
  id: string;
  eventId: string;
  clubId: string;
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  status: RSVPStatus;
  updatedAt: string;
}

export interface ClubEventComment {
  id: string;
  eventId: string;
  clubId: string;
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  /** Plain-text comment body */
  body: string;
  /** Optional reply-to comment ID */
  replyToId?: string;
  createdAt: string;
}

// ── Storage keys ──────────────────────────────────────────────────────────────

const EVENTS_KEY = "otb-club-events-v1";
const RSVPS_KEY = "otb-club-rsvps-v1";
const COMMENTS_KEY = "otb-club-event-comments-v1";

// ── Internal helpers ──────────────────────────────────────────────────────────

function loadEvents(): ClubEvent[] {
  try { return JSON.parse(localStorage.getItem(EVENTS_KEY) || "[]"); } catch { return []; }
}
function saveEvents(events: ClubEvent[]): void {
  try { localStorage.setItem(EVENTS_KEY, JSON.stringify(events)); } catch { /* full */ }
}
function loadRSVPs(): ClubEventRSVP[] {
  try { return JSON.parse(localStorage.getItem(RSVPS_KEY) || "[]"); } catch { return []; }
}
function saveRSVPs(rsvps: ClubEventRSVP[]): void {
  try { localStorage.setItem(RSVPS_KEY, JSON.stringify(rsvps)); } catch { /* full */ }
}
function loadComments(): ClubEventComment[] {
  try { return JSON.parse(localStorage.getItem(COMMENTS_KEY) || "[]"); } catch { return []; }
}
function saveComments(comments: ClubEventComment[]): void {
  try { localStorage.setItem(COMMENTS_KEY, JSON.stringify(comments)); } catch { /* full */ }
}
function genId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// ── Events API ────────────────────────────────────────────────────────────────

/** List all published events for a club, sorted by startAt ascending. */
export function listClubEvents(clubId: string, includeUnpublished = false): ClubEvent[] {
  return loadEvents()
    .filter((e) => e.clubId === clubId && (includeUnpublished || e.isPublished))
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
}

/** Get a single event by ID. */
export function getClubEvent(eventId: string): ClubEvent | null {
  return loadEvents().find((e) => e.id === eventId) ?? null;
}

/** Create a new club event. Returns the created event. Also persists to server API (fire-and-forget). */
export function createClubEvent(
  data: Omit<ClubEvent, "id" | "createdAt" | "updatedAt">
): ClubEvent {
  const now = new Date().toISOString();
  const event: ClubEvent = { ...data, id: genId(), createdAt: now, updatedAt: now };
  const events = loadEvents();
  events.push(event);
  saveEvents(events);
  // Persist to server (fire-and-forget)
  _persistEventToServer(event);
  return event;
}

/** Fire-and-forget: POST a club event to the server API. */
function _persistEventToServer(event: ClubEvent): void {
  try {
    const token = localStorage.getItem("otb-auth-token");
    if (!token) return;
    fetch(`/api/clubs/${event.clubId}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        id: event.id,
        title: event.title,
        description: event.description ?? null,
        startAt: event.startAt,
        endAt: event.endAt ?? null,
        venue: event.venue ?? null,
        address: event.address ?? null,
        admissionNote: event.admissionNote ?? null,
        coverImageUrl: event.coverImageUrl ?? null,
        accentColor: event.accentColor ?? "#4CAF50",
        creatorName: event.creatorName,
        eventType: event.eventType ?? "standard",
        tournamentId: event.tournamentId ?? null,
      }),
    }).catch(() => { /* server unavailable */ });
  } catch { /* ignore */ }
}

/**
 * Load events from the server API and merge with localStorage.
 * Returns the merged list sorted by startAt ascending.
 */
export async function syncEventsFromServer(clubId: string): Promise<ClubEvent[]> {
  try {
    const res = await fetch(`/api/clubs/${clubId}/events`);
    if (!res.ok) return listClubEvents(clubId, true);
    const serverRows = await res.json() as Array<{
      id: string; clubId: string; title: string; description?: string | null;
      startAt: string; endAt?: string | null; venue?: string | null;
      address?: string | null; admissionNote?: string | null;
      coverImageUrl?: string | null; accentColor: string;
      creatorId: string; creatorName: string; isPublished: number;
      eventType: string; tournamentId?: string | null;
      createdAt: string; updatedAt: string;
    }>;
    const local = loadEvents();
    const localIds = new Set(local.map((e) => e.id));
    const merged = [...local];
    for (const row of serverRows) {
      if (localIds.has(row.id)) continue;
      merged.push({
        id: row.id, clubId: row.clubId, title: row.title,
        description: row.description ?? undefined,
        startAt: row.startAt, endAt: row.endAt ?? undefined,
        venue: row.venue ?? undefined, address: row.address ?? undefined,
        admissionNote: row.admissionNote ?? undefined,
        coverImageUrl: row.coverImageUrl ?? undefined,
        accentColor: row.accentColor,
        creatorId: row.creatorId, creatorName: row.creatorName,
        isPublished: row.isPublished === 1,
        eventType: (row.eventType as ClubEvent["eventType"]) ?? "standard",
        tournamentId: row.tournamentId ?? undefined,
        createdAt: row.createdAt, updatedAt: row.updatedAt,
      });
    }
    saveEvents(merged);
    return merged
      .filter((e) => e.clubId === clubId)
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  } catch {
    return listClubEvents(clubId, true);
  }
}

/** Update an existing event. Returns updated event or null if not found. */
export function updateClubEvent(
  eventId: string,
  patch: Partial<Omit<ClubEvent, "id" | "clubId" | "createdAt">>
): ClubEvent | null {
  const events = loadEvents();
  const idx = events.findIndex((e) => e.id === eventId);
  if (idx === -1) return null;
  events[idx] = { ...events[idx], ...patch, updatedAt: new Date().toISOString() };
  saveEvents(events);
  return events[idx];
}

/** Delete an event and all its RSVPs and comments. */
export function deleteClubEvent(eventId: string): void {
  saveEvents(loadEvents().filter((e) => e.id !== eventId));
  saveRSVPs(loadRSVPs().filter((r) => r.eventId !== eventId));
  saveComments(loadComments().filter((c) => c.eventId !== eventId));
}

// ── RSVP API ──────────────────────────────────────────────────────────────────

/** Get all RSVPs for an event. */
export function getEventRSVPs(eventId: string): ClubEventRSVP[] {
  return loadRSVPs().filter((r) => r.eventId === eventId);
}

/** Get a specific user's RSVP for an event, or null if none. */
export function getUserRSVP(eventId: string, userId: string): ClubEventRSVP | null {
  return loadRSVPs().find((r) => r.eventId === eventId && r.userId === userId) ?? null;
}

/** Count RSVPs by status for an event. */
export function countRSVPs(eventId: string): Record<RSVPStatus, number> {
  const rsvps = getEventRSVPs(eventId);
  return {
    going:     rsvps.filter((r) => r.status === "going").length,
    not_going: rsvps.filter((r) => r.status === "not_going").length,
    maybe:     rsvps.filter((r) => r.status === "maybe").length,
  };
}

/** Set or update a user's RSVP. Returns the upserted RSVP. */
export function upsertRSVP(
  eventId: string,
  clubId: string,
  userId: string,
  displayName: string,
  status: RSVPStatus,
  avatarUrl?: string | null
): ClubEventRSVP {
  const rsvps = loadRSVPs();
  const now = new Date().toISOString();
  const existing = rsvps.findIndex((r) => r.eventId === eventId && r.userId === userId);
  if (existing !== -1) {
    rsvps[existing] = { ...rsvps[existing], status, updatedAt: now };
    saveRSVPs(rsvps);
    return rsvps[existing];
  }
  const rsvp: ClubEventRSVP = {
    id: genId(),
    eventId,
    clubId,
    userId,
    displayName,
    avatarUrl,
    status,
    updatedAt: now,
  };
  rsvps.push(rsvp);
  saveRSVPs(rsvps);
  return rsvp;
}

/** Remove a user's RSVP. */
export function removeRSVP(eventId: string, userId: string): void {
  saveRSVPs(loadRSVPs().filter((r) => !(r.eventId === eventId && r.userId === userId)));
}

// ── Comments API ──────────────────────────────────────────────────────────────

/** List all comments for an event, oldest first. */
export function getEventComments(eventId: string): ClubEventComment[] {
  return loadComments()
    .filter((c) => c.eventId === eventId)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

/** Post a new comment. Returns the created comment. */
export function postComment(
  eventId: string,
  clubId: string,
  userId: string,
  displayName: string,
  body: string,
  avatarUrl?: string | null,
  replyToId?: string
): ClubEventComment {
  const comment: ClubEventComment = {
    id: genId(),
    eventId,
    clubId,
    userId,
    displayName,
    avatarUrl,
    body: body.trim(),
    replyToId,
    createdAt: new Date().toISOString(),
  };
  const comments = loadComments();
  comments.push(comment);
  saveComments(comments);
  return comment;
}

/** Delete a comment by ID. */
export function deleteComment(commentId: string): void {
  saveComments(loadComments().filter((c) => c.id !== commentId));
}

// ── Seed data ─────────────────────────────────────────────────────────────────

const SEED_KEY = "otb-club-events-seeded-v1";

const SEED_ACCENTS = ["#4CAF50", "#3B82F6", "#8B5CF6", "#F59E0B", "#EF4444", "#06B6D4"];

/** Seed demo events for the first few clubs if not already done. */
export function seedClubEventsIfEmpty(): void {
  try {
    if (localStorage.getItem(SEED_KEY)) return;

    // Grab existing clubs from localStorage
    const clubsRaw = localStorage.getItem("otb-clubs-v1");
    if (!clubsRaw) return;
    const clubs: Array<{ id: string; name: string; ownerId: string; ownerName: string }> =
      JSON.parse(clubsRaw);
    if (!clubs.length) return;

    const now = Date.now();
    const events: ClubEvent[] = [];

    clubs.slice(0, 4).forEach((club, ci) => {
      const accent = SEED_ACCENTS[ci % SEED_ACCENTS.length];

      // Upcoming event 1 — next week
      events.push({
        id: genId(),
        clubId: club.id,
        title: `${["Thursday Night Blitz", "Weekend Rapid Open", "Club Championship Night", "Monthly Swiss"][ci]}`,
        description: `Join us for an exciting evening of chess! Whether you're a beginner or a seasoned player, all skill levels are welcome. Come for the games, stay for the community.\n\nLight refreshments will be provided. Prizes for top finishers!`,
        startAt: new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString(),
        endAt: new Date(now + 7 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000).toISOString(),
        venue: ["The Chess Lounge", "Community Center Hall A", "University Student Union", "Café Central"][ci],
        address: ["42 King Street, London", "100 Main Ave, New York", "450 Serra Mall, Stanford", "Unter den Linden 1, Berlin"][ci],
        parkingNote: "Street parking available nearby",
        admissionNote: "Free for members · $5 for guests",
        accentColor: accent,
        creatorId: club.ownerId,
        creatorName: club.ownerName,
        isPublished: true,
        createdAt: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(),
      });

      // Upcoming event 2 — two weeks out
      events.push({
        id: genId(),
        clubId: club.id,
        title: `${["Beginner's Workshop", "Endgame Masterclass", "Simul with IM", "Blitz Night"][ci]}`,
        description: `A special ${["beginner-friendly session", "endgame study session", "simultaneous exhibition", "blitz tournament"][ci]} open to all club members. Don't miss it!`,
        startAt: new Date(now + 14 * 24 * 60 * 60 * 1000).toISOString(),
        endAt: new Date(now + 14 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000).toISOString(),
        venue: ["The Chess Lounge", "Community Center Hall B", "Engineering Auditorium", "Schachzentrum"][ci],
        address: ["42 King Street, London", "100 Main Ave, New York", "450 Serra Mall, Stanford", "Unter den Linden 1, Berlin"][ci],
        admissionNote: "Free for members",
        accentColor: SEED_ACCENTS[(ci + 2) % SEED_ACCENTS.length],
        creatorId: club.ownerId,
        creatorName: club.ownerName,
        isPublished: true,
        createdAt: new Date(now - 1 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(now - 1 * 24 * 60 * 60 * 1000).toISOString(),
      });

      // Past event — last week
      events.push({
        id: genId(),
        clubId: club.id,
        title: `${["Last Week's Rapid", "March Blitz Night", "Spring Kickoff", "February Open"][ci]}`,
        description: "A great evening of chess with the club. Thanks to everyone who came out!",
        startAt: new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString(),
        endAt: new Date(now - 7 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000).toISOString(),
        venue: ["The Chess Lounge", "Community Center", "Student Union", "Café Central"][ci],
        accentColor: SEED_ACCENTS[(ci + 3) % SEED_ACCENTS.length],
        creatorId: club.ownerId,
        creatorName: club.ownerName,
        isPublished: true,
        createdAt: new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString(),
      });
    });

    saveEvents(events);

    // Seed some RSVPs for the first event of each club
    const rsvps: ClubEventRSVP[] = [];
    const membersRaw = localStorage.getItem("otb-club-members-v1");
    const members: Array<{ clubId: string; userId: string; displayName: string; avatarUrl: string | null }> =
      membersRaw ? JSON.parse(membersRaw) : [];

    events
      .filter((e) => new Date(e.startAt) > new Date())
      .forEach((event) => {
        const clubMembers = members.filter((m) => m.clubId === event.clubId).slice(0, 8);
        clubMembers.forEach((m, mi) => {
          const statuses: RSVPStatus[] = ["going", "going", "going", "going", "going", "maybe", "maybe", "not_going"];
          rsvps.push({
            id: genId(),
            eventId: event.id,
            clubId: event.clubId,
            userId: m.userId,
            displayName: m.displayName,
            avatarUrl: m.avatarUrl,
            status: statuses[mi % statuses.length],
            updatedAt: new Date(Date.now() - mi * 3600 * 1000).toISOString(),
          });
        });
      });

    saveRSVPs(rsvps);
    localStorage.setItem(SEED_KEY, "1");
  } catch { /* ignore */ }
}
