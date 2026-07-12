/**
 * OTB Chess — Quads Mock Data Generator
 *
 * Generates a realistic 4-section (16-player) Quads tournament for UI testing.
 * Uses the real `generateQuadTournament` engine so pairings are structurally valid.
 *
 * Scenarios produced:
 *  - Quad 1: Round 2 in progress (R1 complete, R2 partial, R3 upcoming)
 *  - Quad 2: Round 2 in progress (R1 complete, R2 partial, R3 upcoming)
 *  - Quad 3: Round 1 in progress (R1 partial, R2-3 upcoming)
 *  - Quad 4: All 3 rounds complete (section complete, winner visible)
 *
 * Usage:
 *   import { generateMockQuadsTournament } from "./mockQuadsData";
 *   const { players, games, sections, currentRound } = generateMockQuadsTournament();
 */

import type { Player, Game, Result } from "./tournamentData";
import type { QuadSection } from "./quads";
import { generateQuadTournament, DEFAULT_QUAD_SETTINGS } from "./quads";

// ─── Player pool ─────────────────────────────────────────────────────────────

const PLAYER_POOL: Omit<Player, "points" | "wins" | "draws" | "losses" | "buchholz" | "colorHistory">[] = [
  // Quad 1 — 1514–1597
  { id: "p01", name: "Arnold Lopez",    username: "arnoldlopez",    elo: 1597, rapidElo: 1597, blitzElo: 1540, country: "US", platform: "chesscom" },
  { id: "p02", name: "javachip3",       username: "javachip3",      elo: 1580, rapidElo: 1580, blitzElo: 1510, country: "US", platform: "chesscom" },
  { id: "p03", name: "Danny Montenegro",username: "dannymontenegro", elo: 1520, rapidElo: 1520, blitzElo: 1490, country: "US", platform: "chesscom" },
  { id: "p04", name: "Arnold",          username: "arnoldchess",    elo: 1514, rapidElo: 1514, blitzElo: 1480, country: "US", platform: "chesscom" },
  // Quad 2 — 1311–1489
  { id: "p05", name: "Jorge Urresti",   username: "jurresti",       elo: 1489, rapidElo: 1489, blitzElo: 1450, country: "US", platform: "chesscom" },
  { id: "p06", name: "Maria Chen",      username: "mariachess99",   elo: 1420, rapidElo: 1420, blitzElo: 1380, country: "US", platform: "chesscom" },
  { id: "p07", name: "Kevin Park",      username: "kpark_chess",    elo: 1370, rapidElo: 1370, blitzElo: 1340, country: "US", platform: "chesscom" },
  { id: "p08", name: "Lena Vasquez",    username: "lenavasquez",    elo: 1311, rapidElo: 1311, blitzElo: 1280, country: "US", platform: "chesscom" },
  // Quad 3 — 980–1283
  { id: "p09", name: "ddraider227",     username: "ddraider227",    elo: 1283, rapidElo: 1283, blitzElo: 1240, country: "US", platform: "chesscom" },
  { id: "p10", name: "Sam Torres",      username: "samtorres",      elo: 1180, rapidElo: 1180, blitzElo: 1140, country: "US", platform: "chesscom" },
  { id: "p11", name: "Priya Nair",      username: "priyanair",      elo: 1090, rapidElo: 1090, blitzElo: 1050, country: "US", platform: "chesscom" },
  { id: "p12", name: "Alex Ramos",      username: "alexramos",      elo: 980,  rapidElo: 980,  blitzElo: 940,  country: "US", platform: "chesscom" },
  // Quad 4 — 488–938
  { id: "p13", name: "Shane Williams",  username: "shanewilliams",  elo: 938,  rapidElo: 938,  blitzElo: 900,  country: "US", platform: "chesscom" },
  { id: "p14", name: "Chloe Kim",       username: "chloekim",       elo: 820,  rapidElo: 820,  blitzElo: 790,  country: "US", platform: "chesscom" },
  { id: "p15", name: "Raj Patel",       username: "rajpatel",       elo: 650,  rapidElo: 650,  blitzElo: 620,  country: "US", platform: "chesscom" },
  { id: "p16", name: "Mia Johnson",     username: "miajohnson",     elo: 488,  rapidElo: 488,  blitzElo: 460,  country: "US", platform: "chesscom" },
];

function makePlayer(base: typeof PLAYER_POOL[0]): Player {
  return {
    ...base,
    points: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    buchholz: 0,
    colorHistory: [],
    joinedAt: Date.now() - Math.floor(Math.random() * 3600000),
    paymentStatus: "cash",
  };
}

// ─── Result helpers ───────────────────────────────────────────────────────────

const DECISIVE_RESULTS: Result[] = ["1-0", "0-1"];
const ALL_RESULTS: Result[] = ["1-0", "0-1", "½-½"];

function randomResult(allowDraw = true): Result {
  const pool = allowDraw ? ALL_RESULTS : DECISIVE_RESULTS;
  return pool[Math.floor(Math.random() * pool.length)];
}

function setResult(games: Game[], sectionId: string, round: number, boardIndex: number, result: Result): void {
  const sectionGames = games.filter((g) => g.sectionId === sectionId && g.round === round);
  if (sectionGames[boardIndex]) {
    sectionGames[boardIndex].result = result;
  }
}

// ─── Main generator ───────────────────────────────────────────────────────────

export interface MockQuadsTournamentState {
  /** 16 players seeded into 4 quads */
  players: Player[];
  /** All generated games (6 per section × 4 sections = 24 total) */
  games: Game[];
  /** 4 QuadSection objects */
  sections: QuadSection[];
  /** Current active round (2 — mid-tournament) */
  currentRound: number;
  /** Total rounds (always 3 for quads) */
  totalRounds: number;
  /** Scenario description for each section */
  scenarioNotes: Record<string, string>;
}

/**
 * Generate a 4-section Quads tournament with mixed completion states.
 *
 * Seed is deterministic by default (pass `randomize: true` for random results).
 */
export function generateMockQuadsTournament(options?: { randomize?: boolean }): MockQuadsTournamentState {
  const rng = options?.randomize ?? false;
  const players = PLAYER_POOL.map(makePlayer);

  const result = generateQuadTournament(players, {
    ...DEFAULT_QUAD_SETTINGS,
    ratingType: "rapid",
    colorAssignment: "deterministic",
  });

  const { sections, games } = result;

  // ── Section IDs (sorted by rating desc — Quad 1 = highest) ──────────────
  const [s1, s2, s3, s4] = sections;

  // ── Scenario A: Quad 1 — Round 2 in progress ────────────────────────────
  // R1: both games complete (decisive)
  // R2: board 1 complete, board 2 pending
  // R3: pending
  if (s1) {
    setResult(games, s1.id, 1, 0, "1-0");
    setResult(games, s1.id, 1, 1, "0-1");
    setResult(games, s1.id, 2, 0, "1-0");
    // R2 board 1 done, board 2 still pending (default "*")
  }

  // ── Scenario B: Quad 2 — Round 2 in progress (draw in R1) ───────────────
  // R1: both games complete (one draw)
  // R2: both pending
  if (s2) {
    setResult(games, s2.id, 1, 0, "½-½");
    setResult(games, s2.id, 1, 1, "1-0");
    // R2: both pending
  }

  // ── Scenario C: Quad 3 — Round 1 in progress ────────────────────────────
  // R1: board 1 complete, board 2 pending
  // R2-3: pending
  if (s3) {
    setResult(games, s3.id, 1, 0, "0-1");
    // R1 board 1 done, board 2 still pending
  }

  // ── Scenario D: Quad 4 — All rounds complete (section done) ─────────────
  // R1: both decisive
  // R2: one decisive, one draw
  // R3: both decisive
  if (s4) {
    setResult(games, s4.id, 1, 0, "1-0");
    setResult(games, s4.id, 1, 1, "0-1");
    setResult(games, s4.id, 2, 0, "½-½");
    setResult(games, s4.id, 2, 1, "1-0");
    setResult(games, s4.id, 3, 0, "1-0");
    setResult(games, s4.id, 3, 1, "0-1");
  }

  // If randomize mode, override with random results for completed games
  if (rng) {
    for (const game of games) {
      if (game.result !== "*") {
        game.result = randomResult(true);
      }
    }
  }

  return {
    players,
    games,
    sections,
    currentRound: 2,
    totalRounds: 3,
    scenarioNotes: {
      [s1?.id ?? "s1"]: "Quad 1: R1 complete, R2 in progress (1 result entered)",
      [s2?.id ?? "s2"]: "Quad 2: R1 complete (with draw), R2 pending",
      [s3?.id ?? "s3"]: "Quad 3: R1 in progress (1 result entered)",
      [s4?.id ?? "s4"]: "Quad 4: All 3 rounds complete — section winner visible",
    },
  };
}

/**
 * Generate a completed Quads tournament (all results entered) for testing
 * the completion view, champion cards, and per-section recap.
 */
export function generateCompletedMockQuadsTournament(): MockQuadsTournamentState {
  const players = PLAYER_POOL.map(makePlayer);

  const result = generateQuadTournament(players, {
    ...DEFAULT_QUAD_SETTINGS,
    ratingType: "rapid",
    colorAssignment: "deterministic",
  });

  const { sections, games } = result;

  // Fill all results deterministically (seeded outcomes)
  const outcomes: Result[] = ["1-0", "0-1", "½-½", "1-0", "0-1", "1-0"];
  let outcomeIdx = 0;
  for (const game of games) {
    if (game.blackId !== "BYE") {
      game.result = outcomes[outcomeIdx % outcomes.length];
      outcomeIdx++;
    } else {
      game.result = "1-0"; // BYE = white wins
    }
  }

  return {
    players,
    games,
    sections,
    currentRound: 3,
    totalRounds: 3,
    scenarioNotes: {
      [sections[0]?.id ?? "s1"]: "Quad 1: Complete — Arnold Lopez wins",
      [sections[1]?.id ?? "s2"]: "Quad 2: Complete — Jorge Urresti wins",
      [sections[2]?.id ?? "s3"]: "Quad 3: Complete — ddraider227 wins",
      [sections[3]?.id ?? "s4"]: "Quad 4: Complete — Shane Williams wins",
    },
  };
}

/**
 * Generate a co-champion scenario (two players tied on points in Quad 1).
 */
export function generateCoChampionMockQuadsTournament(): MockQuadsTournamentState {
  const base = generateCompletedMockQuadsTournament();
  const { sections, games } = base;
  const s1 = sections[0];
  if (!s1) return base;

  // Force a tie: in R1 p1 beats p4, p2 beats p3; in R2 p3 beats p1, p4 beats p2; in R3 p1 beats p2, p3 beats p4
  // This gives p1=2pts, p2=1pt, p3=2pts, p4=0pts → co-champions p1 & p3
  const s1Games = games.filter((g) => g.sectionId === s1.id);
  const r1 = s1Games.filter((g) => g.round === 1);
  const r2 = s1Games.filter((g) => g.round === 2);
  const r3 = s1Games.filter((g) => g.round === 3);
  if (r1[0]) r1[0].result = "1-0"; // p1 beats p4
  if (r1[1]) r1[1].result = "1-0"; // p2 beats p3
  if (r2[0]) r2[0].result = "0-1"; // p1 loses to p3
  if (r2[1]) r2[1].result = "0-1"; // p2 loses to p4
  if (r3[0]) r3[0].result = "1-0"; // p1 beats p2
  if (r3[1]) r3[1].result = "1-0"; // p3 beats p4

  return {
    ...base,
    scenarioNotes: {
      ...base.scenarioNotes,
      [s1.id]: "Quad 1: Co-champions (p1 & p3 both on 2pts)",
    },
  };
}
