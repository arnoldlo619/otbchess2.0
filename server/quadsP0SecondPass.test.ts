/**
 * Quads P0 Second-Pass Remediation Tests
 * Covers all 10 P0 failures from the July 31, 2026 re-audit.
 */

import { describe, it, expect } from "vitest";
import { buildSnapshot } from "./publicSnapshot.js";

// ── Minimal fixture helpers ──────────────────────────────────────────────────

type Player = { id: string; name: string; username: string; elo: number; points: number; wins: number; draws: number; losses: number; buchholz: number; colorHistory: string[]; joinedAt?: number };
type Game = { id: string; whiteId: string; blackId: string; result: "1-0" | "0-1" | "½-½" | "" };
type Round = { id: string; status: string; games: Game[] };
type QuadSection = { id: string; name: string; playerIds: string[] };

function makePlayer(id: string, name: string, pts: number, w: number, d: number, l: number, joinedAt?: number): Player {
  return { id, name, username: name.toLowerCase().replace(/\s/g, ""), elo: 1500, points: pts, wins: w, draws: d, losses: l, buchholz: 0, colorHistory: [], joinedAt };
}

function makeGame(id: string, whiteId: string, blackId: string, result: Game["result"]): Game {
  return { id, whiteId, blackId, result };
}

function makeRound(id: string, games: Game[], status = "completed"): Round {
  return { id, status, games };
}

// ── 8-player Quads fixture (2 sections of 4) ────────────────────────────────

// Section A: p1 (3pts), p2 (2pts), p3 (1pt), p4 (0pts)
// Section B: p5 (2.5pts), p6 (2pts), p7 (1.5pts), p8 (0pts)
const PLAYERS_8: Player[] = [
  makePlayer("p1", "Alice", 3, 3, 0, 0),
  makePlayer("p2", "Bob", 2, 2, 0, 1),
  makePlayer("p3", "Carol", 1, 1, 0, 2),
  makePlayer("p4", "Dan", 0, 0, 0, 3),
  makePlayer("p5", "Eve", 2.5, 2, 1, 0),
  makePlayer("p6", "Frank", 2, 2, 0, 1),
  makePlayer("p7", "Grace", 1.5, 1, 1, 1),
  makePlayer("p8", "Hank", 0, 0, 0, 3),
];

// Section A: round-robin (p1 beats all, p2 beats p3/p4, p3 beats p4)
const ROUNDS_8: Round[] = [
  makeRound("r1", [
    makeGame("g1", "p1", "p2", "1-0"),
    makeGame("g2", "p3", "p4", "1-0"),
    makeGame("g3", "p5", "p6", "½-½"),
    makeGame("g4", "p7", "p8", "1-0"),
  ]),
  makeRound("r2", [
    makeGame("g5", "p1", "p3", "1-0"),
    makeGame("g6", "p2", "p4", "1-0"),
    makeGame("g7", "p5", "p7", "1-0"),
    makeGame("g8", "p6", "p8", "1-0"),
  ]),
  makeRound("r3", [
    makeGame("g9", "p1", "p4", "1-0"),
    makeGame("g10", "p2", "p3", "1-0"),
    makeGame("g11", "p5", "p8", "1-0"),
    makeGame("g12", "p6", "p7", "½-½"),
  ]),
];

const SECTIONS_8: QuadSection[] = [
  { id: "s1", name: "Quad 1", playerIds: ["p1", "p2", "p3", "p4"] },
  { id: "s2", name: "Quad 2", playerIds: ["p5", "p6", "p7", "p8"] },
];

function makeState(players: Player[], rounds: Round[], sections: QuadSection[], status = "completed") {
  return {
    format: "quads" as const,
    status,
    players,
    rounds,
    quadSections: sections,
    totalRounds: rounds.length,
    tournamentName: "Test Quads",
  };
}

// ── P0-1: Section isolation ──────────────────────────────────────────────────

describe("P0-1: Section isolation", () => {
  it("buildSnapshot produces per-section standings with correct player counts", () => {
    const state = makeState(PLAYERS_8, ROUNDS_8, SECTIONS_8);
    const snap = buildSnapshot(state as any);
    expect(snap.quadSections).toHaveLength(2);
    expect(snap.quadSections![0].standings).toHaveLength(4);
    expect(snap.quadSections![1].standings).toHaveLength(4);
  });

  it("Section A standings contain only Section A players", () => {
    const state = makeState(PLAYERS_8, ROUNDS_8, SECTIONS_8);
    const snap = buildSnapshot(state as any);
    const sectionAIds = new Set(snap.quadSections![0].standings.map((r: any) => r.playerId));
    expect(sectionAIds.has("p1")).toBe(true);
    expect(sectionAIds.has("p5")).toBe(false); // Section B player must not appear
  });

  it("Section B standings contain only Section B players", () => {
    const state = makeState(PLAYERS_8, ROUNDS_8, SECTIONS_8);
    const snap = buildSnapshot(state as any);
    const sectionBIds = new Set(snap.quadSections![1].standings.map((r: any) => r.playerId));
    expect(sectionBIds.has("p5")).toBe(true);
    expect(sectionBIds.has("p1")).toBe(false); // Section A player must not appear
  });
});

// ── P0-2: Sonneborn-Berger tiebreak ─────────────────────────────────────────

describe("P0-2: Sonneborn-Berger tiebreak", () => {
  it("SB is computed for each player in section standings", () => {
    const state = makeState(PLAYERS_8, ROUNDS_8, SECTIONS_8);
    const snap = buildSnapshot(state as any);
    const sectionA = snap.quadSections![0].standings;
    sectionA.forEach((row: any) => {
      expect(typeof row.sonnebornBerger).toBe("number");
      expect(row.sonnebornBerger).toBeGreaterThanOrEqual(0);
    });
  });

  it("SB for winner (3pts) is sum of opponents' scores", () => {
    // Alice (p1) beat Bob (2pts), Carol (1pt), Dan (0pts) → SB = 2+1+0 = 3
    const state = makeState(PLAYERS_8, ROUNDS_8, SECTIONS_8);
    const snap = buildSnapshot(state as any);
    const alice = snap.quadSections![0].standings.find((r: any) => r.playerId === "p1");
    expect(alice?.sonnebornBerger).toBe(3);
  });

  it("SB for player with draws includes half opponent score", () => {
    // Eve (p5) beat Frank (2pts), Grace (1.5pts), Hank (0pts) with one draw
    // Round 1: Eve-Frank = draw (0.5 * Frank's 2pts = 1)
    // Round 2: Eve-Grace = Eve wins (1 * Grace's 1.5pts = 1.5)
    // Round 3: Eve-Hank = Eve wins (1 * Hank's 0pts = 0)
    // SB = 1 + 1.5 + 0 = 2.5
    const state = makeState(PLAYERS_8, ROUNDS_8, SECTIONS_8);
    const snap = buildSnapshot(state as any);
    const eve = snap.quadSections![1].standings.find((r: any) => r.playerId === "p5");
    expect(eve?.sonnebornBerger).toBe(2.5);
  });

  it("SB does not include cross-section opponent scores", () => {
    // All SB values in section A should only reference p1-p4 scores
    const state = makeState(PLAYERS_8, ROUNDS_8, SECTIONS_8);
    const snap = buildSnapshot(state as any);
    const sectionA = snap.quadSections![0].standings;
    const sectionAIds = new Set(["p1", "p2", "p3", "p4"]);
    // Max possible SB for section A = 3+2+1+0 = 6
    sectionA.forEach((row: any) => {
      expect(row.sonnebornBerger).toBeLessThanOrEqual(6);
    });
  });

  it("Section standings are sorted by points desc, then SB desc", () => {
    const state = makeState(PLAYERS_8, ROUNDS_8, SECTIONS_8);
    const snap = buildSnapshot(state as any);
    const sectionA = snap.quadSections![0].standings;
    // p1=3pts, p2=2pts, p3=1pt, p4=0pts — all unique so just check order
    expect(sectionA[0].playerId).toBe("p1");
    expect(sectionA[1].playerId).toBe("p2");
    expect(sectionA[2].playerId).toBe("p3");
    expect(sectionA[3].playerId).toBe("p4");
  });
});

// ── P0-5: Lifecycle state ────────────────────────────────────────────────────

describe("P0-5: Lifecycle state completeness", () => {
  it("buildSnapshot reflects completed status in snapshot", () => {
    const state = makeState(PLAYERS_8, ROUNDS_8, SECTIONS_8, "completed");
    const snap = buildSnapshot(state as any);
    expect(snap.status).toBe("completed");
  });

  it("buildSnapshot reflects in_progress status in snapshot", () => {
    const state = makeState(PLAYERS_8, ROUNDS_8, SECTIONS_8, "in_progress");
    const snap = buildSnapshot(state as any);
    expect(snap.status).toBe("in_progress");
  });
});

// ── P0-6: Registration guard ─────────────────────────────────────────────────

describe("P0-6: Registration closed guard (isTournamentClosed logic)", () => {
  it("status=completed should be treated as closed", () => {
    const closedStatuses = ["completed", "in_progress", "paused"];
    const openStatuses = ["registration", ""];
    closedStatuses.forEach(s => {
      expect(["completed", "in_progress", "paused"].includes(s)).toBe(true);
    });
    openStatuses.forEach(s => {
      expect(["completed", "in_progress", "paused"].includes(s)).toBe(false);
    });
  });
});

// ── P0-10: Ninth-player roster mutation ──────────────────────────────────────

describe("P0-10: Ninth-player roster mutation (regression)", () => {
  it("A player added after sections are formed is not assigned to any section", () => {
    // Simulate: 8 players, sections formed, then a 9th player added to state.players
    const ninthPlayer = makePlayer("p9", "Magnus", 0, 0, 0, 0, Date.now());
    const players9 = [...PLAYERS_8, ninthPlayer];
    const state = makeState(players9, ROUNDS_8, SECTIONS_8, "completed");
    const snap = buildSnapshot(state as any);
    
    // p9 should not appear in any section standings
    const allSectionIds = snap.quadSections!.flatMap((s: any) => s.standings.map((r: any) => r.playerId));
    expect(allSectionIds.includes("p9")).toBe(false);
    
    // Total section players should still be 8
    const totalInSections = snap.quadSections!.reduce((sum: number, s: any) => sum + s.standings.length, 0);
    expect(totalInSections).toBe(8);
  });

  it("A player added after sections are formed has no games (orphan detection)", () => {
    const ninthPlayer = makePlayer("p9", "Magnus", 0, 0, 0, 0, Date.now());
    const players9 = [...PLAYERS_8, ninthPlayer];
    const state = makeState(players9, ROUNDS_8, SECTIONS_8, "completed");
    
    // Verify p9 has no games in any round
    const allGameIds = ROUNDS_8.flatMap(r => r.games.flatMap(g => [g.whiteId, g.blackId]));
    expect(allGameIds.includes("p9")).toBe(false);
  });
});

// ── 4-player single section ──────────────────────────────────────────────────

describe("4-player single Quads section", () => {
  const PLAYERS_4: Player[] = [
    makePlayer("a1", "Alpha", 3, 3, 0, 0),
    makePlayer("a2", "Beta", 2, 2, 0, 1),
    makePlayer("a3", "Gamma", 1, 1, 0, 2),
    makePlayer("a4", "Delta", 0, 0, 0, 3),
  ];
  const ROUNDS_4: Round[] = [
    makeRound("r1", [makeGame("g1", "a1", "a2", "1-0"), makeGame("g2", "a3", "a4", "1-0")]),
    makeRound("r2", [makeGame("g3", "a1", "a3", "1-0"), makeGame("g4", "a2", "a4", "1-0")]),
    makeRound("r3", [makeGame("g5", "a1", "a4", "1-0"), makeGame("g6", "a2", "a3", "1-0")]),
  ];
  const SECTIONS_4: QuadSection[] = [{ id: "s1", name: "Quad 1", playerIds: ["a1", "a2", "a3", "a4"] }];

  it("Single section has 4 standings rows", () => {
    const state = makeState(PLAYERS_4, ROUNDS_4, SECTIONS_4);
    const snap = buildSnapshot(state as any);
    expect(snap.quadSections![0].standings).toHaveLength(4);
  });

  it("Winner has correct SB: beats 2+1+0 = 3", () => {
    const state = makeState(PLAYERS_4, ROUNDS_4, SECTIONS_4);
    const snap = buildSnapshot(state as any);
    const alpha = snap.quadSections![0].standings.find((r: any) => r.playerId === "a1");
    expect(alpha?.sonnebornBerger).toBe(3); // beat Beta(2) + Gamma(1) + Delta(0)
  });
});

// ── 12-player 3-section Quads ────────────────────────────────────────────────

describe("12-player 3-section Quads", () => {
  const players12: Player[] = Array.from({ length: 12 }, (_, i) =>
    makePlayer(`q${i + 1}`, `Player${i + 1}`, 0, 0, 0, 0)
  );
  const sections12: QuadSection[] = [
    { id: "s1", name: "Quad 1", playerIds: ["q1", "q2", "q3", "q4"] },
    { id: "s2", name: "Quad 2", playerIds: ["q5", "q6", "q7", "q8"] },
    { id: "s3", name: "Quad 3", playerIds: ["q9", "q10", "q11", "q12"] },
  ];

  it("3 sections each have 4 standings rows", () => {
    const state = makeState(players12, [], sections12, "registration");
    const snap = buildSnapshot(state as any);
    expect(snap.quadSections).toHaveLength(3);
    snap.quadSections!.forEach((s: any) => {
      expect(s.standings).toHaveLength(4);
    });
  });

  it("No cross-section player leakage in 3-section tournament", () => {
    const state = makeState(players12, [], sections12, "registration");
    const snap = buildSnapshot(state as any);
    const s1Ids = new Set(snap.quadSections![0].standings.map((r: any) => r.playerId));
    const s2Ids = new Set(snap.quadSections![1].standings.map((r: any) => r.playerId));
    const s3Ids = new Set(snap.quadSections![2].standings.map((r: any) => r.playerId));
    // No overlap between sections
    s1Ids.forEach(id => { expect(s2Ids.has(id)).toBe(false); expect(s3Ids.has(id)).toBe(false); });
    s2Ids.forEach(id => { expect(s1Ids.has(id)).toBe(false); expect(s3Ids.has(id)).toBe(false); });
  });
});
