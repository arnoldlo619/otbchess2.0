import { beforeEach, describe, expect, it, vi } from "vitest";

const store: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { Object.keys(store).forEach((key) => delete store[key]); },
};

vi.stubGlobal("localStorage", localStorageMock);

import { seedClubsIfEmpty } from "./clubRegistry";
import { seedClubEventsIfEmpty } from "./clubEventRegistry";

function readIds(key: string, field = "id"): string[] {
  return (JSON.parse(store[key] ?? "[]") as Array<Record<string, string>>).map((row) => row[field]);
}

describe("legacy community seed cleanup", () => {
  beforeEach(() => localStorageMock.clear());

  it("does not create clubs or events in a fresh browser", () => {
    seedClubsIfEmpty();
    seedClubEventsIfEmpty();

    expect(readIds("otb-clubs-v1")).toEqual([]);
    expect(readIds("otb-club-members-v1")).toEqual([]);
    expect(readIds("otb-club-tournaments-v1", "tournamentId")).toEqual([]);
    expect(readIds("otb-club-events-v1")).toEqual([]);
    expect(readIds("otb-club-rsvps-v1")).toEqual([]);
    expect(readIds("otb-club-event-comments-v1")).toEqual([]);
  });

  it("removes only legacy fabricated records and preserves real local activity", () => {
    store["otb-clubs-v1"] = JSON.stringify([
      { id: "seed-club-1", name: "Legacy Seed" },
      { id: "club-real", name: "Real Club" },
    ]);
    store["otb-club-members-v1"] = JSON.stringify([
      { clubId: "seed-club-1", userId: "seed-m1" },
      { clubId: "club-real", userId: "demo_hikaru" },
      { clubId: "club-real", userId: "user-real" },
    ]);
    store["otb-club-tournaments-v1"] = JSON.stringify([
      { clubId: "seed-club-1", tournamentId: "seed-tournament" },
      { clubId: "club-real", tournamentId: "real-tournament" },
    ]);
    store["otb-club-follows-v1"] = JSON.stringify([
      { clubId: "seed-club-1", userId: "user-real" },
      { clubId: "club-real", userId: "user-real" },
    ]);
    store["otb-club-events-v1"] = JSON.stringify([
      { id: "seed-event", clubId: "seed-club-1" },
      { id: "real-event", clubId: "club-real" },
    ]);
    store["otb-club-rsvps-v1"] = JSON.stringify([
      { id: "seed-rsvp", eventId: "seed-event", clubId: "seed-club-1" },
      { id: "real-rsvp", eventId: "real-event", clubId: "club-real" },
    ]);
    store["otb-club-event-comments-v1"] = JSON.stringify([
      { id: "seed-comment", eventId: "seed-event", clubId: "seed-club-1" },
      { id: "real-comment", eventId: "real-event", clubId: "club-real" },
    ]);
    store["otb-clubs-seeded-v7"] = "1";
    store["otb-club-events-seeded-v1"] = "1";

    seedClubsIfEmpty();
    seedClubEventsIfEmpty();

    expect(readIds("otb-clubs-v1")).toEqual(["club-real"]);
    expect(readIds("otb-club-members-v1", "userId")).toEqual(["user-real"]);
    expect(readIds("otb-club-tournaments-v1", "tournamentId")).toEqual(["real-tournament"]);
    expect(readIds("otb-club-follows-v1", "clubId")).toEqual(["club-real"]);
    expect(readIds("otb-club-events-v1")).toEqual(["real-event"]);
    expect(readIds("otb-club-rsvps-v1")).toEqual(["real-rsvp"]);
    expect(readIds("otb-club-event-comments-v1")).toEqual(["real-comment"]);
    expect(store["otb-clubs-seeded-v7"]).toBeUndefined();
    expect(store["otb-club-events-seeded-v1"]).toBeUndefined();

    seedClubsIfEmpty();
    seedClubEventsIfEmpty();
    expect(readIds("otb-clubs-v1")).toEqual(["club-real"]);
    expect(readIds("otb-club-events-v1")).toEqual(["real-event"]);
  });
});
