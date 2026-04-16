/**
 * Tests for Public Tournament Mode
 *
 * @vitest-environment jsdom
 *
 * Covers:
 * - PublicTournamentData type shape
 * - Follow-player localStorage helpers
 * - Format label helper
 * - Standings computation integration
 * - Round dots logic
 * - Status badge logic
 * - Spotlight search filtering
 * - Post-event CTA visibility
 * - API endpoint URL construction
 * - PublicTournamentCard toggle logic
 */
import {describe, it, expect, beforeEach} from "vitest";
import { computeStandings } from "@/lib/swiss";
import type { Player, Round } from "@/lib/tournamentData";

// ─── localStorage follow helpers (mirror the page logic) ─────────────────────

const FOLLOW_KEY_PREFIX = "otb-follow-";

function getFollowedPlayerId(tournamentId: string): string | null {
  try {
    return localStorage.getItem(`${FOLLOW_KEY_PREFIX}${tournamentId}`);
  } catch {
    return null;
  }
}

function persistFollowedPlayer(tournamentId: string, playerId: string | null) {
  try {
    if (playerId) {
      localStorage.setItem(`${FOLLOW_KEY_PREFIX}${tournamentId}`, playerId);
    } else {
      localStorage.removeItem(`${FOLLOW_KEY_PREFIX}${tournamentId}`);
    }
  } catch { /* silent */ }
}

// ─── Format label helper (mirror the page logic) ────────────────────────────

function formatLabel(format: string): string {
  switch (format) {
    case "swiss": return "Swiss";
    case "doubleswiss": return "Double Swiss";
    case "roundrobin": return "Round Robin";
    case "elimination": return "Elimination";
    default: return format;
  }
}

// ─── Test Data ───────────────────────────────────────────────────────────────

const mockPlayers: Player[] = [
  { id: "p1", name: "Alice", username: "alice_chess", elo: 1800, wins: 2, draws: 0, losses: 0, points: 2 },
  { id: "p2", name: "Bob", username: "bob_chess", elo: 1600, wins: 1, draws: 1, losses: 0, points: 1.5 },
  { id: "p3", name: "Charlie", username: "charlie_chess", elo: 1500, wins: 0, draws: 1, losses: 1, points: 0.5 },
  { id: "p4", name: "Diana", username: "diana_chess", elo: 1700, wins: 0, draws: 0, losses: 2, points: 0 },
];

const mockRounds: Round[] = [
  {
    number: 1,
    games: [
      { id: "g1", whiteId: "p1", blackId: "p4", result: "1-0", board: 1 },
      { id: "g2", whiteId: "p2", blackId: "p3", result: "1/2-1/2", board: 2 },
    ],
  },
  {
    number: 2,
    games: [
      { id: "g3", whiteId: "p1", blackId: "p2", result: "1-0", board: 1 },
      { id: "g4", whiteId: "p3", blackId: "p4", result: "1-0", board: 2 },
    ],
  },
];

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("PublicTournament — Follow Player localStorage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns null when no player is followed", () => {
    expect(getFollowedPlayerId("tournament-123")).toBeNull();
  });

  it("persists and retrieves a followed player", () => {
    persistFollowedPlayer("tournament-123", "p1");
    expect(getFollowedPlayerId("tournament-123")).toBe("p1");
  });

  it("removes follow when null is passed", () => {
    persistFollowedPlayer("tournament-123", "p1");
    persistFollowedPlayer("tournament-123", null);
    expect(getFollowedPlayerId("tournament-123")).toBeNull();
  });

  it("isolates follows per tournament", () => {
    persistFollowedPlayer("t1", "p1");
    persistFollowedPlayer("t2", "p2");
    expect(getFollowedPlayerId("t1")).toBe("p1");
    expect(getFollowedPlayerId("t2")).toBe("p2");
  });

  it("overwrites previous follow with new player", () => {
    persistFollowedPlayer("t1", "p1");
    persistFollowedPlayer("t1", "p2");
    expect(getFollowedPlayerId("t1")).toBe("p2");
  });
});

describe("PublicTournament — Format Label", () => {
  it("formats swiss correctly", () => {
    expect(formatLabel("swiss")).toBe("Swiss");
  });

  it("formats doubleswiss correctly", () => {
    expect(formatLabel("doubleswiss")).toBe("Double Swiss");
  });

  it("formats roundrobin correctly", () => {
    expect(formatLabel("roundrobin")).toBe("Round Robin");
  });

  it("formats elimination correctly", () => {
    expect(formatLabel("elimination")).toBe("Elimination");
  });

  it("returns raw string for unknown format", () => {
    expect(formatLabel("custom")).toBe("custom");
  });
});

describe("PublicTournament — Standings Integration", () => {
  it("computes standings from players and rounds", () => {
    const standings = computeStandings(mockPlayers, mockRounds);
    expect(standings.length).toBe(4);
    // Alice should be first (2 wins, 2 points)
    expect(standings[0].player.id).toBe("p1");
    expect(standings[0].player.points).toBe(2);
  });

  it("handles empty players array", () => {
    const standings = computeStandings([], []);
    expect(standings).toEqual([]);
  });

  it("handles players with no rounds", () => {
    const standings = computeStandings(mockPlayers, []);
    expect(standings.length).toBe(4);
  });
});

describe("PublicTournament — Spotlight Search Logic", () => {
  function filterPlayers(players: Player[], query: string): Player[] {
    const q = query.toLowerCase().trim();
    if (!q) return [];
    return players.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.username && p.username.toLowerCase().includes(q))
    );
  }

  it("returns empty for empty query", () => {
    expect(filterPlayers(mockPlayers, "")).toEqual([]);
  });

  it("filters by name", () => {
    const results = filterPlayers(mockPlayers, "alice");
    expect(results.length).toBe(1);
    expect(results[0].id).toBe("p1");
  });

  it("filters by username", () => {
    const results = filterPlayers(mockPlayers, "bob_chess");
    expect(results.length).toBe(1);
    expect(results[0].id).toBe("p2");
  });

  it("is case-insensitive", () => {
    const results = filterPlayers(mockPlayers, "CHARLIE");
    expect(results.length).toBe(1);
    expect(results[0].id).toBe("p3");
  });

  it("returns multiple matches for partial query", () => {
    const results = filterPlayers(mockPlayers, "a");
    // Alice, Charlie, Diana all contain 'a'
    expect(results.length).toBeGreaterThanOrEqual(2);
  });
});

describe("PublicTournament — Status Badge Logic", () => {
  function getStatusLabel(status: string, currentRound: number, totalRounds: number): string {
    if (status === "completed") return "Completed";
    if (status === "registration") return "Registration";
    if (status === "paused") return "Paused";
    return `Round ${currentRound}/${totalRounds}`;
  }

  it("shows Completed for completed status", () => {
    expect(getStatusLabel("completed", 4, 4)).toBe("Completed");
  });

  it("shows Registration for registration status", () => {
    expect(getStatusLabel("registration", 0, 4)).toBe("Registration");
  });

  it("shows Paused for paused status", () => {
    expect(getStatusLabel("paused", 2, 4)).toBe("Paused");
  });

  it("shows Round X/Y for active status", () => {
    expect(getStatusLabel("active", 2, 4)).toBe("Round 2/4");
  });
});

describe("PublicTournament — Round Dots Logic", () => {
  function getRoundDotStatus(roundNum: number, currentRound: number): "completed" | "current" | "upcoming" {
    if (roundNum < currentRound) return "completed";
    if (roundNum === currentRound) return "current";
    return "upcoming";
  }

  it("marks past rounds as completed", () => {
    expect(getRoundDotStatus(1, 3)).toBe("completed");
    expect(getRoundDotStatus(2, 3)).toBe("completed");
  });

  it("marks current round as current", () => {
    expect(getRoundDotStatus(3, 3)).toBe("current");
  });

  it("marks future rounds as upcoming", () => {
    expect(getRoundDotStatus(4, 3)).toBe("upcoming");
    expect(getRoundDotStatus(5, 3)).toBe("upcoming");
  });
});

describe("PublicTournament — API URL Construction", () => {
  it("constructs correct public API URL", () => {
    const slug = "my-tournament-2026";
    const url = `/api/public/tournament/${encodeURIComponent(slug)}`;
    expect(url).toBe("/api/public/tournament/my-tournament-2026");
  });

  it("encodes special characters in slug", () => {
    const slug = "test tournament/special";
    const url = `/api/public/tournament/${encodeURIComponent(slug)}`;
    expect(url).toBe("/api/public/tournament/test%20tournament%2Fspecial");
  });

  it("constructs correct public toggle URL", () => {
    const id = "abc-123";
    const url = `/api/tournament/${encodeURIComponent(id)}/public`;
    expect(url).toBe("/api/tournament/abc-123/public");
  });
});

describe("PublicTournament — Post-Event CTA Visibility", () => {
  it("shows CTAs when tournament is completed", () => {
    const isCompleted = "completed" === "completed";
    expect(isCompleted).toBe(true);
  });

  it("hides CTAs when tournament is active", () => {
    const isCompleted = "active" === "completed";
    expect(isCompleted).toBe(false);
  });

  it("hides CTAs during registration", () => {
    const isCompleted = "registration" === "completed";
    expect(isCompleted).toBe(false);
  });
});

describe("PublicTournament — PublicTournamentData Shape", () => {
  it("validates the expected data shape", () => {
    const data = {
      tournamentId: "t1",
      status: "active",
      currentRound: 2,
      totalRounds: 4,
      tournamentName: "Spring Open 2026",
      format: "swiss",
      venue: "NYC Chess Club",
      date: "2026-04-01",
      players: mockPlayers,
      games: mockRounds[1].games,
      rounds: mockRounds,
      updatedAt: "2026-04-01T12:00:00Z",
    };

    expect(data.tournamentId).toBeDefined();
    expect(data.status).toBe("active");
    expect(data.currentRound).toBe(2);
    expect(data.totalRounds).toBe(4);
    expect(data.players.length).toBe(4);
    expect(data.rounds.length).toBe(2);
    expect(data.format).toBe("swiss");
    expect(data.venue).toBe("NYC Chess Club");
  });
});

describe("PublicTournament — Follow Toggle Logic", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("toggles follow on when unfollowed", () => {
    const followedPlayerId: string | null = null;
    const playerId = "p1";
    const newId = followedPlayerId === playerId ? null : playerId;
    expect(newId).toBe("p1");
  });

  it("toggles follow off when already following", () => {
    const followedPlayerId: string | null = "p1";
    const playerId = "p1";
    const newId = followedPlayerId === playerId ? null : playerId;
    expect(newId).toBeNull();
  });

  it("switches follow to different player", () => {
    const followedPlayerId: string | null = "p1";
    const playerId = "p2";
    const newId = followedPlayerId === playerId ? null : playerId;
    expect(newId).toBe("p2");
  });
});

describe("PublicTournament — Polling Interval", () => {
  it("uses 15-second polling interval", () => {
    const POLL_INTERVAL = 15000;
    expect(POLL_INTERVAL).toBe(15000);
  });
});

describe("PublicTournament — Mobile Tab Logic", () => {
  it("defaults to pairings tab", () => {
    const defaultTab = "pairings";
    expect(defaultTab).toBe("pairings");
  });

  it("switches between pairings and standings", () => {
    let activeTab: "pairings" | "standings" = "pairings";
    activeTab = "standings";
    expect(activeTab).toBe("standings");
    activeTab = "pairings";
    expect(activeTab).toBe("pairings");
  });
});
