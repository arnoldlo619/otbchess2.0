/**
 * syncClubTournamentCount Tests
 * Verifies that the helper correctly counts linked tournaments and updates
 * the club's denormalised tournamentCount field in localStorage.
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
  createClub,
  getClub,
  syncClubTournamentCount,
  clearClubRegistry,
} from "../lib/clubRegistry";

const OWNER_ID = "owner-001";

function makeClub(name: string) {
  return createClub(
    {
      name,
      tagline: "Test club",
      description: "A test club",
      location: "London, UK",
      country: "GB",
      category: "club",
      accentColor: "#3D6B47",
      isPublic: true,
      ownerId: OWNER_ID,
      ownerName: "Test Owner",
    },
    { userId: OWNER_ID, displayName: "Test Owner", avatarUrl: null }
  );
}

function seedTournaments(clubId: string, count: number, otherClubId?: string) {
  const tournaments = [];
  for (let i = 0; i < count; i++) {
    tournaments.push({ id: `t-${clubId}-${i}`, clubId, name: `Tournament ${i}` });
  }
  if (otherClubId) {
    tournaments.push({ id: `t-other-0`, clubId: otherClubId, name: "Other tournament" });
  }
  store["otb-tournaments-v1"] = JSON.stringify(tournaments);
}

beforeEach(() => {
  localStorageMock.clear();
  clearClubRegistry();
});

describe("syncClubTournamentCount", () => {
  it("returns 0 and updates count when no tournaments are linked", () => {
    const club = makeClub("Empty Club");
    const result = syncClubTournamentCount(club.id);
    expect(result).toBe(0);
    expect(getClub(club.id)?.tournamentCount).toBe(0);
  });

  it("counts the correct number of linked tournaments", () => {
    const club = makeClub("Active Club");
    seedTournaments(club.id, 3);
    const result = syncClubTournamentCount(club.id);
    expect(result).toBe(3);
    expect(getClub(club.id)?.tournamentCount).toBe(3);
  });

  it("only counts tournaments for the specified club, not others", () => {
    const club = makeClub("Club A");
    const other = makeClub("Club B");
    seedTournaments(club.id, 2, other.id);
    // Club A should have 2, Club B should have 1
    expect(syncClubTournamentCount(club.id)).toBe(2);
    expect(syncClubTournamentCount(other.id)).toBe(1);
  });

  it("returns null for a non-existent club id", () => {
    store["otb-tournaments-v1"] = JSON.stringify([{ id: "t1", clubId: "ghost-club" }]);
    const result = syncClubTournamentCount("ghost-club");
    expect(result).toBeNull();
  });

  it("updates from a previous count to a new count correctly", () => {
    const club = makeClub("Growing Club");
    seedTournaments(club.id, 1);
    syncClubTournamentCount(club.id);
    expect(getClub(club.id)?.tournamentCount).toBe(1);

    // Add more tournaments
    seedTournaments(club.id, 5);
    syncClubTournamentCount(club.id);
    expect(getClub(club.id)?.tournamentCount).toBe(5);
  });

  it("handles malformed tournament storage gracefully (returns 0)", () => {
    const club = makeClub("Safe Club");
    store["otb-tournaments-v1"] = "not-valid-json{{";
    const result = syncClubTournamentCount(club.id);
    expect(result).toBe(0);
    expect(getClub(club.id)?.tournamentCount).toBe(0);
  });

  it("handles empty tournament storage (returns 0)", () => {
    const club = makeClub("Empty Storage Club");
    // No tournaments key set at all
    const result = syncClubTournamentCount(club.id);
    expect(result).toBe(0);
  });

  it("handles tournaments with no clubId field (not counted)", () => {
    const club = makeClub("Unlinked Club");
    store["otb-tournaments-v1"] = JSON.stringify([
      { id: "t1" }, // no clubId
      { id: "t2", clubId: null }, // null clubId
      { id: "t3", clubId: club.id }, // linked
    ]);
    const result = syncClubTournamentCount(club.id);
    expect(result).toBe(1);
  });
});
