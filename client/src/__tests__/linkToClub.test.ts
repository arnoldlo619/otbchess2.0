/**
 * Tests for the "Link to Club" feature in TournamentWizard
 * Covers: clubId/clubName in TournamentConfig schema, listTournamentsByClub filtering,
 * and the end-to-end registerTournament → listTournamentsByClub pipeline.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  registerTournament,
  listTournamentsByClub,
  listTournaments,
  deleteTournament,
  clearRegistry,
  type TournamentConfig,
} from "@/lib/tournamentRegistry";

// ── Mock localStorage ──────────────────────────────────────────────────────────
const store: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
  get length() { return Object.keys(store).length; },
  key: (i: number) => Object.keys(store)[i] ?? null,
};
vi.stubGlobal("localStorage", localStorageMock);

// ─── Helpers ──────────────────────────────────────────────────────────────────

let _counter = 0;
function makeTournament(overrides: Partial<TournamentConfig> = {}): TournamentConfig {
  _counter++;
  return {
    id: `test-${_counter}-${Math.random().toString(36).slice(2)}`,
    name: "Test Tournament",
    venue: "Test Venue",
    date: "2026-08-01",
    format: "swiss",
    rounds: 5,
    maxPlayers: 32,
    timeBase: 600,
    timeIncrement: 5,
    timePreset: "10+5",
    ratingSystem: "USCF",
    ratingType: "standard",
    inviteCode: `INV${_counter}`,
    createdAt: new Date().toISOString(),
    ownerId: null,
    clubId: null,
    clubName: null,
    customSlug: null,
    coverImageUrl: null,
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Link to Club — TournamentConfig schema", () => {
  it("accepts clubId and clubName as nullable fields", () => {
    const t = makeTournament({ clubId: "club-abc", clubName: "Chess Masters" });
    expect(t.clubId).toBe("club-abc");
    expect(t.clubName).toBe("Chess Masters");
  });

  it("defaults clubId and clubName to null", () => {
    const t = makeTournament();
    expect(t.clubId).toBeNull();
    expect(t.clubName).toBeNull();
  });
});

describe("Link to Club — listTournamentsByClub", () => {
  const clubAId = "club-aaa";
  const clubBId = "club-bbb";

  beforeEach(() => {
    localStorageMock.clear();
    clearRegistry();
  });

  it("returns only tournaments linked to the specified club", () => {
    const t1 = makeTournament({ clubId: clubAId, clubName: "Club A" });
    const t2 = makeTournament({ clubId: clubAId, clubName: "Club A" });
    const t3 = makeTournament({ clubId: clubBId, clubName: "Club B" });
    const t4 = makeTournament({ clubId: null });
    [t1, t2, t3, t4].forEach((t) => registerTournament(t));

    const results = listTournamentsByClub(clubAId);
    const resultIds = results.map((r) => r.id);
    expect(resultIds).toContain(t1.id);
    expect(resultIds).toContain(t2.id);
    expect(resultIds).not.toContain(t3.id);
    expect(resultIds).not.toContain(t4.id);
  });

  it("returns empty array when no tournaments are linked to the club", () => {
    const t = makeTournament({ clubId: null });
    registerTournament(t);

    const results = listTournamentsByClub("club-nonexistent");
    const resultIds = results.map((r) => r.id);
    expect(resultIds).not.toContain(t.id);
    expect(results.length).toBe(0);
  });

  it("preserves clubName in saved tournament", () => {
    const t = makeTournament({ clubId: clubAId, clubName: "Chess Masters Club" });
    registerTournament(t);

    const results = listTournamentsByClub(clubAId);
    const saved = results.find((r) => r.id === t.id);
    expect(saved).toBeDefined();
    expect(saved?.clubName).toBe("Chess Masters Club");
  });

  it("handles quads format tournaments linked to a club", () => {
    const t = makeTournament({ clubId: clubAId, format: "quads", rounds: 3 });
    registerTournament(t);

    const results = listTournamentsByClub(clubAId);
    const saved = results.find((r) => r.id === t.id);
    expect(saved?.format).toBe("quads");
  });

  it("returns multiple clubs' tournaments independently", () => {
    const tA = makeTournament({ clubId: clubAId });
    const tB = makeTournament({ clubId: clubBId });
    registerTournament(tA);
    registerTournament(tB);

    expect(listTournamentsByClub(clubAId).map((r) => r.id)).toContain(tA.id);
    expect(listTournamentsByClub(clubBId).map((r) => r.id)).toContain(tB.id);
    expect(listTournamentsByClub(clubAId).map((r) => r.id)).not.toContain(tB.id);
  });
});

describe("Link to Club — save/load cycle", () => {
  beforeEach(() => {
    localStorageMock.clear();
    clearRegistry();
  });

  it("setting clubId to a valid string is preserved through register/list cycle", () => {
    const t = makeTournament({ clubId: "club-xyz", clubName: "My Club" });
    registerTournament(t);

    const all = listTournaments();
    const found = all.find((x) => x.id === t.id);
    expect(found?.clubId).toBe("club-xyz");
    expect(found?.clubName).toBe("My Club");
  });

  it("clearing clubId (re-registering with null) removes the club link", () => {
    const t = makeTournament({ clubId: "club-xyz", clubName: "My Club" });
    registerTournament(t);

    // Simulate user clearing the selection — re-register with null clubId
    const updated = { ...t, clubId: null, clubName: null };
    registerTournament(updated);

    const all = listTournaments();
    const found = all.find((x) => x.id === t.id);
    expect(found?.clubId).toBeNull();
    expect(found?.clubName).toBeNull();
  });

  it("tournament no longer appears in listTournamentsByClub after clubId is cleared", () => {
    const t = makeTournament({ clubId: "club-xyz", clubName: "My Club" });
    registerTournament(t);
    expect(listTournamentsByClub("club-xyz").map((r) => r.id)).toContain(t.id);

    // Clear the club link
    registerTournament({ ...t, clubId: null, clubName: null });
    expect(listTournamentsByClub("club-xyz").map((r) => r.id)).not.toContain(t.id);
  });

  it("deleteTournament removes it from listTournamentsByClub", () => {
    const t = makeTournament({ clubId: "club-xyz" });
    registerTournament(t);
    expect(listTournamentsByClub("club-xyz").map((r) => r.id)).toContain(t.id);

    deleteTournament(t.id);
    expect(listTournamentsByClub("club-xyz").map((r) => r.id)).not.toContain(t.id);
  });
});
