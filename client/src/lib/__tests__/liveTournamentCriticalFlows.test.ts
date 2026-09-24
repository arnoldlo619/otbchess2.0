/**
 * Lightweight critical-flow tests for live tournaments.
 *
 * Focused on the 3 highest-risk user journeys:
 * 1) Tournament Director dashboard access (director code resolution + session guard)
 * 2) Public tournament lobby routing (invite code/custom slug/slug resolution)
 * 3) Pairings/results display correctness (standings order + result labels)
 *
 * @vitest-environment jsdom
 */

import { beforeEach, describe, expect, it } from "vitest";
import {
  grantDirectorSession,
  hasDirectorSession,
  registerTournament,
  resolveByDirectorCode,
  resolveTournament,
  type TournamentConfig,
} from "@/lib/tournamentRegistry";
import { getResultLabel, getStandings, type Player } from "@/lib/tournamentData";

function makeConfig(overrides: Partial<TournamentConfig> = {}): TournamentConfig {
  return {
    id: "spring-open-2026",
    inviteCode: "ABCD1234",
    directorCode: "DIR-A1B2C3",
    name: "Spring Open 2026",
    venue: "Marshall Chess Club",
    date: "2026-03-22",
    description: "",
    format: "swiss",
    rounds: 5,
    maxPlayers: 32,
    timeBase: 10,
    timeIncrement: 5,
    timePreset: "10+5",
    ratingSystem: "chess.com",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("Critical flow 1: Director dashboard auth path", () => {
  beforeEach(() => localStorage.clear());

  it("resolves director code case-insensitively and tolerates whitespace", () => {
    registerTournament(makeConfig());

    const resolved = resolveByDirectorCode("  dir-a1b2c3  ");

    expect(resolved).not.toBeNull();
    expect(resolved?.id).toBe("spring-open-2026");
  });

  it("requires explicit local session grant before dashboard access", () => {
    registerTournament(makeConfig());

    expect(hasDirectorSession("spring-open-2026")).toBe(false);

    grantDirectorSession("spring-open-2026");
    expect(hasDirectorSession("spring-open-2026")).toBe(true);
  });
});

describe("Critical flow 2: Public tournament lobby routing", () => {
  beforeEach(() => localStorage.clear());

  it("resolves tournament by invite code, custom slug, and canonical slug", () => {
    registerTournament(
      makeConfig({
        id: "city-championship-2026",
        inviteCode: "CITY2026",
        customSlug: "ThursdayOTBNight",
      })
    );

    expect(resolveTournament("city2026")?.id).toBe("city-championship-2026");
    expect(resolveTournament("thursdayotbnight")?.id).toBe("city-championship-2026");
    expect(resolveTournament("city-championship-2026")?.id).toBe("city-championship-2026");
  });

  it("returns null for unknown lobby code/slug", () => {
    registerTournament(makeConfig());
    expect(resolveTournament("not-a-real-code")).toBeNull();
  });
});

describe("Critical flow 3: Pairings/results display integrity", () => {
  function makePlayer(overrides: Partial<Player>): Player {
    return {
      id: "p",
      name: "Player",
      username: "player",
      elo: 2000,
      country: "US",
      points: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      buchholz: 0,
      colorHistory: [],
      ...overrides,
    };
  }

  it("sorts standings by points, then Buchholz, then ELO", () => {
    const players: Player[] = [
      makePlayer({ id: "a", name: "A", points: 4, buchholz: 10, elo: 1900 }),
      makePlayer({ id: "b", name: "B", points: 4, buchholz: 11, elo: 1800 }),
      makePlayer({ id: "c", name: "C", points: 4, buchholz: 11, elo: 2100 }),
      makePlayer({ id: "d", name: "D", points: 3.5, buchholz: 15, elo: 2200 }),
    ];

    const ordered = getStandings(players).map((p) => p.id);

    expect(ordered).toEqual(["c", "b", "a", "d"]);
  });

  it("maps board results to correct labels from each color perspective", () => {
    expect(getResultLabel("*", "white").label).toBe("In Progress");
    expect(getResultLabel("½-½", "black").label).toBe("½");
    expect(getResultLabel("1-0", "white").label).toBe("Win");
    expect(getResultLabel("1-0", "black").label).toBe("Loss");
    expect(getResultLabel("0-1", "black").label).toBe("Win");
  });
});
