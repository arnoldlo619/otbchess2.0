/**
 * Unit tests for clubEventRegistry
 * Tests event CRUD, RSVP upsert/count, and comment operations.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// ── Mock localStorage ─────────────────────────────────────────────────────────
const store: Record<string, string> = {};
const localStorageMock = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v; },
  removeItem: (k: string) => { delete store[k]; },
  clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
};
vi.stubGlobal("localStorage", localStorageMock);

import {
  createClubEvent,
  getClubEvent,
  listClubEvents,
  updateClubEvent,
  deleteClubEvent,
  upsertRSVP,
  getUserRSVP,
  countRSVPs,
  removeRSVP,
  getEventRSVPs,
  postComment,
  getEventComments,
  deleteComment,
} from "../lib/clubEventRegistry";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeEvent(overrides: Partial<Parameters<typeof createClubEvent>[0]> = {}) {
  return createClubEvent({
    clubId: "club-1",
    title: "Test Event",
    startAt: new Date(Date.now() + 86400000).toISOString(),
    creatorId: "user-1",
    creatorName: "Alice",
    isPublished: true,
    ...overrides,
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("clubEventRegistry — Events", () => {
  beforeEach(() => localStorageMock.clear());

  it("creates an event and retrieves it by ID", () => {
    const evt = makeEvent({ title: "Friday Blitz" });
    expect(evt.id).toBeTruthy();
    expect(getClubEvent(evt.id)?.title).toBe("Friday Blitz");
  });

  it("lists only published events by default", () => {
    makeEvent({ isPublished: true });
    makeEvent({ isPublished: false });
    const visible = listClubEvents("club-1");
    expect(visible.length).toBe(1);
  });

  it("lists unpublished events when flag is set", () => {
    makeEvent({ isPublished: true });
    makeEvent({ isPublished: false });
    const all = listClubEvents("club-1", true);
    expect(all.length).toBe(2);
  });

  it("lists events sorted by startAt ascending", () => {
    const later = makeEvent({ startAt: new Date(Date.now() + 2 * 86400000).toISOString() });
    const sooner = makeEvent({ startAt: new Date(Date.now() + 86400000).toISOString() });
    const list = listClubEvents("club-1");
    expect(list[0].id).toBe(sooner.id);
    expect(list[1].id).toBe(later.id);
  });

  it("updates an event title", () => {
    const evt = makeEvent({ title: "Old Title" });
    const updated = updateClubEvent(evt.id, { title: "New Title" });
    expect(updated?.title).toBe("New Title");
    expect(getClubEvent(evt.id)?.title).toBe("New Title");
  });

  it("returns null when updating a non-existent event", () => {
    expect(updateClubEvent("ghost-id", { title: "X" })).toBeNull();
  });

  it("deletes an event", () => {
    const evt = makeEvent();
    deleteClubEvent(evt.id);
    expect(getClubEvent(evt.id)).toBeNull();
  });

  it("only returns events for the requested clubId", () => {
    makeEvent({ clubId: "club-1" });
    makeEvent({ clubId: "club-2" });
    expect(listClubEvents("club-1").length).toBe(1);
    expect(listClubEvents("club-2").length).toBe(1);
  });
});

describe("clubEventRegistry — RSVPs", () => {
  beforeEach(() => localStorageMock.clear());

  it("upserts a going RSVP and retrieves it", () => {
    const evt = makeEvent();
    upsertRSVP(evt.id, "club-1", "user-1", "Alice", "going");
    expect(getUserRSVP(evt.id, "user-1")?.status).toBe("going");
  });

  it("updates an existing RSVP status", () => {
    const evt = makeEvent();
    upsertRSVP(evt.id, "club-1", "user-1", "Alice", "going");
    upsertRSVP(evt.id, "club-1", "user-1", "Alice", "maybe");
    const rsvps = getEventRSVPs(evt.id);
    expect(rsvps.length).toBe(1);
    expect(rsvps[0].status).toBe("maybe");
  });

  it("counts RSVPs by status correctly", () => {
    const evt = makeEvent();
    upsertRSVP(evt.id, "club-1", "u1", "Alice", "going");
    upsertRSVP(evt.id, "club-1", "u2", "Bob", "going");
    upsertRSVP(evt.id, "club-1", "u3", "Carol", "maybe");
    upsertRSVP(evt.id, "club-1", "u4", "Dave", "not_going");
    const counts = countRSVPs(evt.id);
    expect(counts.going).toBe(2);
    expect(counts.maybe).toBe(1);
    expect(counts.not_going).toBe(1);
  });

  it("removes a RSVP", () => {
    const evt = makeEvent();
    upsertRSVP(evt.id, "club-1", "user-1", "Alice", "going");
    removeRSVP(evt.id, "club-1", "user-1");
    expect(getUserRSVP(evt.id, "user-1")).toBeNull();
  });

  it("returns null for a user with no RSVP", () => {
    const evt = makeEvent();
    expect(getUserRSVP(evt.id, "nobody")).toBeNull();
  });

  it("deletes RSVPs when the event is deleted", () => {
    const evt = makeEvent();
    upsertRSVP(evt.id, "club-1", "user-1", "Alice", "going");
    deleteClubEvent(evt.id);
    expect(getEventRSVPs(evt.id).length).toBe(0);
  });
});

describe("clubEventRegistry — Comments", () => {
  beforeEach(() => localStorageMock.clear());

  it("posts a comment and retrieves it", () => {
    const evt = makeEvent();
    postComment(evt.id, "club-1", "user-1", "Alice", "Great event!");
    const comments = getEventComments(evt.id);
    expect(comments.length).toBe(1);
    expect(comments[0].body).toBe("Great event!");
  });

  it("returns comments in chronological order", () => {
    const evt = makeEvent();
    postComment(evt.id, "club-1", "u1", "Alice", "First");
    postComment(evt.id, "club-1", "u2", "Bob", "Second");
    const comments = getEventComments(evt.id);
    expect(comments[0].body).toBe("First");
    expect(comments[1].body).toBe("Second");
  });

  it("deletes a comment by ID", () => {
    const evt = makeEvent();
    const c = postComment(evt.id, "club-1", "user-1", "Alice", "Delete me");
    deleteComment(c.id);
    expect(getEventComments(evt.id).length).toBe(0);
  });

  it("deletes comments when the event is deleted", () => {
    const evt = makeEvent();
    postComment(evt.id, "club-1", "user-1", "Alice", "Hi");
    deleteClubEvent(evt.id);
    expect(getEventComments(evt.id).length).toBe(0);
  });

  it("only returns comments for the requested eventId", () => {
    const e1 = makeEvent();
    const e2 = makeEvent();
    postComment(e1.id, "club-1", "u1", "Alice", "For e1");
    postComment(e2.id, "club-1", "u2", "Bob", "For e2");
    expect(getEventComments(e1.id).length).toBe(1);
    expect(getEventComments(e2.id).length).toBe(1);
  });
});
