/**
 * Club Feed Registry Tests
 * Tests for FeedEvent CRUD, seeding, and helper functions.
 */
import { describe, it, expect, beforeEach } from "vitest";

// ── In-memory localStorage mock ───────────────────────────────────────────────
const store: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
};
Object.defineProperty(globalThis, "localStorage", { value: localStorageMock, writable: true });

import {
  addFeedEvent,
  listFeedEvents,
  postAnnouncement,
  recordMemberJoin,
  recordMemberLeave,
  recordTournamentCreated,
  recordTournamentCompleted,
  deleteFeedEvent,
  clearFeed,
  seedFeedIfEmpty,
  type FeedEvent,
} from "../lib/clubFeedRegistry";

const CLUB_ID = "test-club-001";

beforeEach(() => {
  clearFeed(CLUB_ID);
});

describe("addFeedEvent", () => {
  it("adds an event and returns it with an id", () => {
    const event = addFeedEvent({
      clubId: CLUB_ID,
      type: "announcement",
      createdAt: new Date().toISOString(),
      actorName: "Alice",
      description: "Alice posted an announcement",
      detail: "Welcome everyone!",
    });
    expect(event.id).toBeTruthy();
    expect(event.type).toBe("announcement");
    expect(event.actorName).toBe("Alice");
  });

  it("persists events across calls", () => {
    addFeedEvent({ clubId: CLUB_ID, type: "member_join", createdAt: new Date().toISOString(), actorName: "Bob", description: "Bob joined" });
    addFeedEvent({ clubId: CLUB_ID, type: "member_join", createdAt: new Date().toISOString(), actorName: "Carol", description: "Carol joined" });
    expect(listFeedEvents(CLUB_ID)).toHaveLength(2);
  });
});

describe("listFeedEvents", () => {
  it("returns events newest-first", () => {
    addFeedEvent({ clubId: CLUB_ID, type: "club_founded", createdAt: "2025-01-01T00:00:00Z", actorName: "Owner", description: "Club founded" });
    addFeedEvent({ clubId: CLUB_ID, type: "member_join", createdAt: "2025-06-01T00:00:00Z", actorName: "Alice", description: "Alice joined" });
    addFeedEvent({ clubId: CLUB_ID, type: "announcement", createdAt: "2026-01-01T00:00:00Z", actorName: "Owner", description: "Announcement" });

    const events = listFeedEvents(CLUB_ID);
    expect(events[0].createdAt).toBe("2026-01-01T00:00:00Z");
    expect(events[2].createdAt).toBe("2025-01-01T00:00:00Z");
  });

  it("respects the limit parameter", () => {
    for (let i = 0; i < 10; i++) {
      addFeedEvent({ clubId: CLUB_ID, type: "member_join", createdAt: new Date().toISOString(), actorName: `User${i}`, description: `User${i} joined` });
    }
    expect(listFeedEvents(CLUB_ID, 5)).toHaveLength(5);
  });

  it("returns empty array for a club with no events", () => {
    expect(listFeedEvents("nonexistent-club")).toHaveLength(0);
  });
});

describe("postAnnouncement", () => {
  it("creates an announcement event", () => {
    const event = postAnnouncement(CLUB_ID, "Director", "Next tournament is Saturday!");
    expect(event.type).toBe("announcement");
    expect(event.detail).toBe("Next tournament is Saturday!");
    expect(event.actorName).toBe("Director");
  });

  it("stores the announcement in the feed", () => {
    postAnnouncement(CLUB_ID, "Director", "Hello world");
    const events = listFeedEvents(CLUB_ID);
    expect(events.some((e) => e.type === "announcement")).toBe(true);
  });
});

describe("recordMemberJoin / recordMemberLeave", () => {
  it("creates a member_join event", () => {
    const event = recordMemberJoin(CLUB_ID, "Alice", null);
    expect(event.type).toBe("member_join");
    expect(event.description).toContain("Alice");
  });

  it("creates a member_leave event", () => {
    const event = recordMemberLeave(CLUB_ID, "Bob");
    expect(event.type).toBe("member_leave");
    expect(event.description).toContain("Bob");
  });
});

describe("recordTournamentCreated / recordTournamentCompleted", () => {
  it("creates a tournament_created event with a link", () => {
    const event = recordTournamentCreated(CLUB_ID, "Director", "Spring Open 2026", "spring-open-2026");
    expect(event.type).toBe("tournament_created");
    expect(event.detail).toBe("Spring Open 2026");
    expect(event.linkHref).toBe("/tournament/spring-open-2026/play");
    expect(event.linkLabel).toBe("Join Tournament"); // actual label in clubFeedRegistry.ts
  });

  it("creates a tournament_completed event with winner info", () => {
    const event = recordTournamentCompleted(CLUB_ID, "Spring Open 2026", "Magnus", "spring-open-2026");
    expect(event.type).toBe("tournament_completed");
    expect(event.detail).toContain("Magnus");
    expect(event.linkHref).toBe("/tournament/spring-open-2026/results");
  });
});

describe("deleteFeedEvent", () => {
  it("removes the event from the feed", () => {
    const event = postAnnouncement(CLUB_ID, "Director", "To be deleted");
    expect(listFeedEvents(CLUB_ID)).toHaveLength(1);
    deleteFeedEvent(CLUB_ID, event.id);
    expect(listFeedEvents(CLUB_ID)).toHaveLength(0);
  });

  it("does not affect other events", () => {
    const e1 = postAnnouncement(CLUB_ID, "Director", "Keep this");
    const e2 = postAnnouncement(CLUB_ID, "Director", "Delete this");
    deleteFeedEvent(CLUB_ID, e2.id);
    const remaining = listFeedEvents(CLUB_ID);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(e1.id);
  });

  it("is a no-op for a non-existent event id", () => {
    postAnnouncement(CLUB_ID, "Director", "Keep this");
    deleteFeedEvent(CLUB_ID, "nonexistent-id");
    expect(listFeedEvents(CLUB_ID)).toHaveLength(1);
  });
});

describe("seedFeedIfEmpty", () => {
  it("seeds a club_founded event", () => {
    seedFeedIfEmpty(CLUB_ID, "Test Club", "Owner", "2024-01-01T00:00:00Z", []);
    const events = listFeedEvents(CLUB_ID);
    expect(events.some((e) => e.type === "club_founded")).toBe(true);
  });

  it("seeds member_join events for each member beyond the owner", () => {
    const members = [
      { displayName: "Owner", joinedAt: "2024-01-01T00:00:00Z", avatarUrl: null },
      { displayName: "Alice", joinedAt: "2024-02-01T00:00:00Z", avatarUrl: null },
      { displayName: "Bob", joinedAt: "2024-03-01T00:00:00Z", avatarUrl: null },
    ];
    seedFeedIfEmpty(CLUB_ID, "Test Club", "Owner", "2024-01-01T00:00:00Z", members);
    const events = listFeedEvents(CLUB_ID);
    const joinEvents = events.filter((e) => e.type === "member_join");
    expect(joinEvents).toHaveLength(2); // Alice + Bob, not Owner
  });

  it("does not re-seed if events already exist", () => {
    postAnnouncement(CLUB_ID, "Director", "Existing event");
    seedFeedIfEmpty(CLUB_ID, "Test Club", "Owner", "2024-01-01T00:00:00Z", []);
    // Should still only have the 1 announcement
    expect(listFeedEvents(CLUB_ID)).toHaveLength(1);
  });

  it("orders seeded events oldest-first in storage (newest-first in list)", () => {
    const members = [
      { displayName: "Owner", joinedAt: "2024-01-01T00:00:00Z", avatarUrl: null },
      { displayName: "Alice", joinedAt: "2024-06-01T00:00:00Z", avatarUrl: null },
    ];
    seedFeedIfEmpty(CLUB_ID, "Test Club", "Owner", "2024-01-01T00:00:00Z", members);
    const events = listFeedEvents(CLUB_ID);
    // Newest first: Alice's join (June) before club_founded (January)
    expect(events[0].actorName).toBe("Alice");
    expect(events[events.length - 1].type).toBe("club_founded");
  });
});
