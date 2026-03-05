/**
 * Tournament–Club Linking Tests
 * Tests for the clubId/clubName fields in TournamentConfig and the
 * listTournamentsByClub helper.
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
  registerTournament,
  listTournamentsByClub,
  listTournaments,
  clearRegistry,
  type TournamentConfig,
} from "../lib/tournamentRegistry";

function makeTournament(overrides: Partial<TournamentConfig> = {}): TournamentConfig {
  return {
    id: `tournament-${Math.random().toString(36).slice(2, 8)}`,
    inviteCode: "ABCD1234",
    directorCode: "DIR-ABCDEF",
    name: "Test Tournament",
    venue: "Test Venue",
    date: "2026-06-01",
    description: "",
    format: "swiss",
    rounds: 5,
    maxPlayers: 16,
    timeBase: 10,
    timeIncrement: 5,
    timePreset: "10+5",
    ratingSystem: "chess.com",
    createdAt: new Date().toISOString(),
    ownerId: null,
    clubId: null,
    clubName: null,
    ...overrides,
  };
}

describe("Tournament–Club Linking", () => {
  beforeEach(() => {
    clearRegistry();
  });

  describe("TournamentConfig clubId field", () => {
    it("accepts a null clubId (unlinked tournament)", () => {
      const t = makeTournament({ clubId: null, clubName: null });
      const saved = registerTournament(t);
      expect(saved.clubId).toBeNull();
      expect(saved.clubName).toBeNull();
    });

    it("accepts a string clubId (linked tournament)", () => {
      const t = makeTournament({ clubId: "london-chess-club", clubName: "London Chess Club" });
      const saved = registerTournament(t);
      expect(saved.clubId).toBe("london-chess-club");
      expect(saved.clubName).toBe("London Chess Club");
    });

    it("persists clubId through save/load cycle", () => {
      const t = makeTournament({ id: "spring-open-2026", clubId: "nyc-chess", clubName: "NYC Chess" });
      registerTournament(t);
      const all = listTournaments();
      const found = all.find((x) => x.id === "spring-open-2026");
      expect(found?.clubId).toBe("nyc-chess");
      expect(found?.clubName).toBe("NYC Chess");
    });
  });

  describe("listTournamentsByClub", () => {
    it("returns empty array when no tournaments are linked to the club", () => {
      registerTournament(makeTournament({ id: "t1", clubId: null }));
      registerTournament(makeTournament({ id: "t2", clubId: "other-club" }));
      expect(listTournamentsByClub("my-club")).toHaveLength(0);
    });

    it("returns only tournaments linked to the specified club", () => {
      registerTournament(makeTournament({ id: "t1", clubId: "london-chess-club" }));
      registerTournament(makeTournament({ id: "t2", clubId: "london-chess-club" }));
      registerTournament(makeTournament({ id: "t3", clubId: "nyc-chess" }));
      registerTournament(makeTournament({ id: "t4", clubId: null }));

      const results = listTournamentsByClub("london-chess-club");
      expect(results).toHaveLength(2);
      expect(results.every((t) => t.clubId === "london-chess-club")).toBe(true);
    });

    it("returns tournaments in newest-first order", () => {
      const t1 = makeTournament({ id: "t1", clubId: "club-a", createdAt: "2026-01-01T00:00:00Z" });
      const t2 = makeTournament({ id: "t2", clubId: "club-a", createdAt: "2026-03-01T00:00:00Z" });
      const t3 = makeTournament({ id: "t3", clubId: "club-a", createdAt: "2026-02-01T00:00:00Z" });
      registerTournament(t1);
      registerTournament(t2);
      registerTournament(t3);

      const results = listTournamentsByClub("club-a");
      // newest first = t2, t3, t1 (reversed insertion order)
      expect(results[0].id).toBe("t3");
      expect(results[1].id).toBe("t2");
      expect(results[2].id).toBe("t1");
    });

    it("returns empty array for a club with no tournaments at all", () => {
      expect(listTournamentsByClub("nonexistent-club")).toHaveLength(0);
    });

    it("does not include tournaments with undefined clubId", () => {
      const t = makeTournament({ id: "t1" });
      delete (t as Partial<TournamentConfig>).clubId;
      registerTournament(t);
      expect(listTournamentsByClub("any-club")).toHaveLength(0);
    });
  });

  describe("TournamentWizard initialClubId pre-fill", () => {
    it("stores clubId when registering a tournament with a club link", () => {
      const t = makeTournament({
        id: "friday-blitz-2026",
        clubId: "stanford-chess-team",
        clubName: "Stanford Chess Team",
      });
      registerTournament(t);
      const results = listTournamentsByClub("stanford-chess-team");
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe("Test Tournament");
      expect(results[0].clubName).toBe("Stanford Chess Team");
    });

    it("unlinked tournaments do not appear in club lists", () => {
      registerTournament(makeTournament({ id: "t1", clubId: null }));
      registerTournament(makeTournament({ id: "t2", clubId: undefined }));
      expect(listTournamentsByClub("stanford-chess-team")).toHaveLength(0);
    });
  });
});
