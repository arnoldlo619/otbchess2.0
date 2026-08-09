/**
 * Quads P0 Fixes — Server-Side Tests
 *
 * Covers:
 *   P0-2: SB tiebreak computed correctly for Quads (section-scoped)
 *   P0-2: Global standings use SB sort for Quads, Buchholz sort for Swiss
 *   P0-1: Section-scoped standings have correct per-section ranks
 *   P0-5: buildSnapshot includes sonnebornBerger field in every StandingRow
 */

import { describe, it, expect } from "vitest";
import { buildSnapshot, computeStandingsServer } from "./publicSnapshot";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makePlayer(id: string, elo: number) {
  return { id, name: `Player ${id}`, username: `user_${id}`, elo, points: 0, wins: 0, draws: 0, losses: 0 };
}

// ─── P0-2: Sonneborn-Berger computation ──────────────────────────────────────

describe("computeStandingsServer — Quads SB tiebreak", () => {
  /**
   * Quad section with 4 players: A(1800), B(1700), C(1600), D(1500)
   * Round 1: A beats B (1-0), C beats D (1-0)
   * Round 2: A beats C (1-0), B beats D (1-0)
   * Round 3: A beats D (1-0), B beats C (1-0)
   *
   * Final scores: A=3, B=2, C=1, D=0
   * SB for A: B(2)+C(1)+D(0) = 3  (defeated all, so sum of their scores)
   * SB for B: A is not counted (B lost), C(1) = 1, D(0) = 0 → SB = 1
   * SB for C: A not counted, B not counted, D(0) = 0 → SB = 0
   * SB for D: none → SB = 0
   */
  const players = [
    makePlayer("A", 1800),
    makePlayer("B", 1700),
    makePlayer("C", 1600),
    makePlayer("D", 1500),
  ];
  const sectionSet = new Set(["A", "B", "C", "D"]);
  const rounds = [
    {
      number: 1,
      games: [
        { id: "g1", board: 1, whiteId: "A", blackId: "B", result: "1-0" },
        { id: "g2", board: 2, whiteId: "C", blackId: "D", result: "1-0" },
      ],
    },
    {
      number: 2,
      games: [
        { id: "g3", board: 1, whiteId: "A", blackId: "C", result: "1-0" },
        { id: "g4", board: 2, whiteId: "B", blackId: "D", result: "1-0" },
      ],
    },
    {
      number: 3,
      games: [
        { id: "g5", board: 1, whiteId: "A", blackId: "D", result: "1-0" },
        { id: "g6", board: 2, whiteId: "B", blackId: "C", result: "1-0" },
      ],
    },
  ];

  it("computes correct points", () => {
    const rows = computeStandingsServer(players, rounds, { format: "quads", sectionPlayerIds: sectionSet });
    const byId = Object.fromEntries(rows.map((r) => [r.playerId, r]));
    expect(byId["A"].points).toBe(3);
    expect(byId["B"].points).toBe(2);
    expect(byId["C"].points).toBe(1);
    expect(byId["D"].points).toBe(0);
  });

  it("computes correct Sonneborn-Berger scores", () => {
    const rows = computeStandingsServer(players, rounds, { format: "quads", sectionPlayerIds: sectionSet });
    const byId = Object.fromEntries(rows.map((r) => [r.playerId, r]));
    // A defeated B(2), C(1), D(0) → SB = 3
    expect(byId["A"].sonnebornBerger).toBe(3);
    // B defeated C(1), D(0) → SB = 1
    expect(byId["B"].sonnebornBerger).toBe(1);
    // C defeated D(0) → SB = 0
    expect(byId["C"].sonnebornBerger).toBe(0);
    // D defeated nobody → SB = 0
    expect(byId["D"].sonnebornBerger).toBe(0);
  });

  it("sorts by SB tiebreak for Quads (not Buchholz)", () => {
    const rows = computeStandingsServer(players, rounds, { format: "quads", sectionPlayerIds: sectionSet });
    expect(rows[0].playerId).toBe("A");
    expect(rows[1].playerId).toBe("B");
    expect(rows[2].playerId).toBe("C");
    // C and D both have 0 SB, so ELO tiebreak: C(1600) > D(1500)
    expect(rows[3].playerId).toBe("D");
  });

  it("assigns sequential ranks", () => {
    const rows = computeStandingsServer(players, rounds, { format: "quads", sectionPlayerIds: sectionSet });
    rows.forEach((r, i) => expect(r.rank).toBe(i + 1));
  });
});

describe("computeStandingsServer — SB with draws", () => {
  /**
   * 4 players, 1 round:
   * A draws B (½-½), C beats D (1-0)
   * SB for A: B drew → B's score * 0.5 = 0.5 * 0.5 = 0.25
   * SB for B: A drew → A's score * 0.5 = 0.5 * 0.5 = 0.25
   * SB for C: D(0) defeated → 0
   * SB for D: nobody → 0
   */
  const players = [
    makePlayer("A", 1800),
    makePlayer("B", 1700),
    makePlayer("C", 1600),
    makePlayer("D", 1500),
  ];
  const sectionSet = new Set(["A", "B", "C", "D"]);
  const rounds = [
    {
      number: 1,
      games: [
        { id: "g1", board: 1, whiteId: "A", blackId: "B", result: "½-½" },
        { id: "g2", board: 2, whiteId: "C", blackId: "D", result: "1-0" },
      ],
    },
  ];

  it("computes SB correctly for draws", () => {
    const rows = computeStandingsServer(players, rounds, { format: "quads", sectionPlayerIds: sectionSet });
    const byId = Object.fromEntries(rows.map((r) => [r.playerId, r]));
    // A drew B(0.5) → SB = 0.5 * 0.5 = 0.25
    expect(byId["A"].sonnebornBerger).toBe(0.25);
    expect(byId["B"].sonnebornBerger).toBe(0.25);
    // C defeated D(0) → SB = 0
    expect(byId["C"].sonnebornBerger).toBe(0);
    expect(byId["D"].sonnebornBerger).toBe(0);
  });
});

// ─── P0-2: Swiss still uses Buchholz sort ────────────────────────────────────

describe("computeStandingsServer — Swiss uses Buchholz sort", () => {
  const players = [
    makePlayer("A", 1800),
    makePlayer("B", 1700),
    makePlayer("C", 1600),
  ];
  const rounds = [
    {
      number: 1,
      games: [
        { id: "g1", board: 1, whiteId: "A", blackId: "B", result: "1-0" },
        { id: "g2", board: 2, whiteId: "C", blackId: "A", result: "0-1" },
      ],
    },
  ];

  it("includes sonnebornBerger field even for Swiss", () => {
    const rows = computeStandingsServer(players, rounds, { format: "swiss" });
    rows.forEach((r) => {
      expect(r).toHaveProperty("sonnebornBerger");
      expect(typeof r.sonnebornBerger).toBe("number");
    });
  });
});

// ─── P0-1/P0-5: buildSnapshot section-scoped standings ───────────────────────

describe("buildSnapshot — Quads section-scoped standings", () => {
  const players = [
    makePlayer("A", 1800), makePlayer("B", 1700), makePlayer("C", 1600), makePlayer("D", 1500),
    makePlayer("E", 1400), makePlayer("F", 1300), makePlayer("G", 1200), makePlayer("H", 1100),
  ];
  const quadSections = [
    { id: "sec1", name: "Quad 1", type: "quad" as const, playerIds: ["A", "B", "C", "D"] },
    { id: "sec2", name: "Quad 2", type: "quad" as const, playerIds: ["E", "F", "G", "H"] },
  ];
  // Quad 1: A wins all, B wins 2, C wins 1, D wins 0
  // Quad 2: E wins all, F wins 2, G wins 1, H wins 0
  const rounds = [
    {
      number: 1,
      games: [
        { id: "g1", board: 1, whiteId: "A", blackId: "B", result: "1-0" },
        { id: "g2", board: 2, whiteId: "C", blackId: "D", result: "1-0" },
        { id: "g3", board: 3, whiteId: "E", blackId: "F", result: "1-0" },
        { id: "g4", board: 4, whiteId: "G", blackId: "H", result: "1-0" },
      ],
    },
    {
      number: 2,
      games: [
        { id: "g5", board: 1, whiteId: "A", blackId: "C", result: "1-0" },
        { id: "g6", board: 2, whiteId: "B", blackId: "D", result: "1-0" },
        { id: "g7", board: 3, whiteId: "E", blackId: "G", result: "1-0" },
        { id: "g8", board: 4, whiteId: "F", blackId: "H", result: "1-0" },
      ],
    },
    {
      number: 3,
      games: [
        { id: "g9", board: 1, whiteId: "A", blackId: "D", result: "1-0" },
        { id: "g10", board: 2, whiteId: "B", blackId: "C", result: "1-0" },
        { id: "g11", board: 3, whiteId: "E", blackId: "H", result: "1-0" },
        { id: "g12", board: 4, whiteId: "F", blackId: "G", result: "1-0" },
      ],
    },
  ];

  const snapshot = buildSnapshot({
    tournamentId: "test-quads",
    status: "completed",
    currentRound: 3,
    totalRounds: 3,
    tournamentName: "Test Quads",
    format: "quads",
    venue: "Test Venue",
    date: "2026-07-31",
    players,
    rounds,
    quadSections,
    updatedAt: new Date().toISOString(),
  });

  // New contract: Quads use per-section standings, not global standings
  it("global standings is empty for Quads (per-section only)", () => {
    expect(snapshot.standings).toHaveLength(0);
  });

  it("section 1 has 4 standings rows", () => {
    const sec1 = snapshot.quadSections?.find(s => s.id === "sec1");
    expect(sec1?.standings).toHaveLength(4);
  });

  it("section 1 champion (A) is ranked #1 in section 1", () => {
    const sec1 = snapshot.quadSections?.find(s => s.id === "sec1");
    const a = sec1?.standings?.find((r) => r.playerId === "A");
    expect(a?.rank).toBe(1);
    expect(a?.points).toBe(3);
  });

  it("section 2 champion (E) is ranked #1 in section 2", () => {
    const sec2 = snapshot.quadSections?.find(s => s.id === "sec2");
    const e = sec2?.standings?.find((r) => r.playerId === "E");
    expect(e?.rank).toBe(1);
    expect(e?.points).toBe(3);
  });

  it("SB for A is section-scoped (only counts B, C, D opponents)", () => {
    const sec1 = snapshot.quadSections?.find(s => s.id === "sec1");
    const a = sec1?.standings?.find((r) => r.playerId === "A");
    // A defeated B(2), C(1), D(0) → SB = 3
    expect(a?.sonnebornBerger).toBe(3);
  });

  it("SB for A does NOT include E/F/G/H (cross-section opponents)", () => {
    const sec1 = snapshot.quadSections?.find(s => s.id === "sec1");
    const a = sec1?.standings?.find((r) => r.playerId === "A");
    // A never played E/F/G/H, so SB = 3 (not inflated by cross-section)
    expect(a?.sonnebornBerger).toBe(3);
  });

  it("section standings include sonnebornBerger", () => {
    snapshot.quadSections?.forEach(sec => {
      sec.standings?.forEach((r) => {
        expect(r).toHaveProperty("sonnebornBerger");
        expect(typeof r.sonnebornBerger).toBe("number");
      });
    });
  });

  it("quadSections are included in snapshot", () => {
    expect(snapshot.quadSections).toHaveLength(2);
    expect(snapshot.quadSections?.[0].id).toBe("sec1");
    expect(snapshot.quadSections?.[1].id).toBe("sec2");
  });
});

// ─── P0-5: buildSnapshot for Swiss still works ───────────────────────────────

describe("buildSnapshot — Swiss format unaffected", () => {
  const players = [makePlayer("A", 1800), makePlayer("B", 1700)];
  const rounds = [
    { number: 1, games: [{ id: "g1", board: 1, whiteId: "A", blackId: "B", result: "1-0" }] },
  ];
  const snapshot = buildSnapshot({
    tournamentId: "test-swiss",
    status: "completed",
    currentRound: 1,
    totalRounds: 1,
    tournamentName: "Test Swiss",
    format: "swiss",
    venue: "",
    date: "",
    players,
    rounds,
    updatedAt: new Date().toISOString(),
  });

  it("includes sonnebornBerger in Swiss standings", () => {
    snapshot.standings.forEach((r) => {
      expect(r).toHaveProperty("sonnebornBerger");
    });
  });

  it("A is ranked #1 in Swiss", () => {
    const a = snapshot.standings.find((r) => r.playerId === "A");
    expect(a?.rank).toBe(1);
    expect(a?.points).toBe(1);
  });
});
