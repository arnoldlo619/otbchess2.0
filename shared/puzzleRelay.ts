import { Chess } from "chess.js";

export type PuzzleRelayDifficulty = "beginner" | "intermediate" | "advanced";

export interface PuzzleRelayPuzzlePublic {
  id: string;
  difficulty: PuzzleRelayDifficulty;
  title: string;
  prompt: string;
  fen: string;
}

interface PuzzleRelayPuzzle extends PuzzleRelayPuzzlePublic {
  solutionUci: string;
}

const PUZZLE_CATALOG: readonly PuzzleRelayPuzzle[] = [
  {
    id: "beginner-back-rank-1",
    difficulty: "beginner",
    title: "Back-rank finish",
    prompt: "White to move. Find the checkmate.",
    fen: "6k1/5ppp/8/8/8/8/5PPP/3Q2K1 w - - 0 1",
    solutionUci: "d1d8",
  },
  {
    id: "beginner-back-rank-2",
    difficulty: "beginner",
    title: "Queen on the eighth",
    prompt: "White to move. End the game in one.",
    fen: "6k1/5ppp/8/8/8/8/5PPP/1Q4K1 w - - 0 1",
    solutionUci: "b1b8",
  },
  {
    id: "intermediate-f7-1",
    difficulty: "intermediate",
    title: "Pressure on f7",
    prompt: "White to move. Find the forcing check.",
    fen: "r1bqkbnr/pppp1ppp/2n5/4p3/2B3b1/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 3",
    solutionUci: "c4f7",
  },
  {
    id: "intermediate-fork-1",
    difficulty: "intermediate",
    title: "Knight fork",
    prompt: "White to move. Win material with a fork.",
    fen: "r1bq1rk1/pp1nbppp/2p1pn2/8/2BP4/2N1PN2/PPQ2PPP/R1B1K2R w KQ - 4 8",
    solutionUci: "c3e4",
  },
  {
    id: "advanced-clearance-1",
    difficulty: "advanced",
    title: "Clearance check",
    prompt: "White to move. Find the forcing first move.",
    fen: "r1bq1rk1/pp1nbppp/2p1pn2/2b5/2BP4/2N1PN2/PPQ2PPP/R1B1K2R w KQ - 4 8",
    solutionUci: "c3e4",
  },
  {
    id: "advanced-back-rank-1",
    difficulty: "advanced",
    title: "Final rank",
    prompt: "White to move. Convert the back-rank weakness.",
    fen: "3r2k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1",
    solutionUci: "d1d8",
  },
] as const;

export const PUZZLE_RELAY_TEAM_LIMITS = { min: 2, max: 8 } as const;
export const PUZZLE_RELAY_PUZZLES_PER_TEAM = 3;

export function parsePuzzleRelayDifficulty(value: unknown): PuzzleRelayDifficulty | null {
  return value === "beginner" || value === "intermediate" || value === "advanced" ? value : null;
}

export function parsePuzzleRelayTeamCount(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < PUZZLE_RELAY_TEAM_LIMITS.min || parsed > PUZZLE_RELAY_TEAM_LIMITS.max) {
    return null;
  }
  return parsed;
}

function orderedPuzzles(difficulty: PuzzleRelayDifficulty, count: number): PuzzleRelayPuzzle[] {
  const matching = PUZZLE_CATALOG.filter((puzzle) => puzzle.difficulty === difficulty);
  const fallback = PUZZLE_CATALOG.filter((puzzle) => puzzle.difficulty !== difficulty);
  const source = [...matching, ...fallback];
  return Array.from({ length: count }, (_, index) => source[index % source.length]);
}

export function getPuzzleRelayPuzzleSequence(difficulty: PuzzleRelayDifficulty, count: number): PuzzleRelayPuzzlePublic[] {
  return orderedPuzzles(difficulty, count).map(({ solutionUci: _solutionUci, ...puzzle }) => puzzle);
}

export function getPuzzleRelayPuzzle(puzzleId: string): PuzzleRelayPuzzlePublic | null {
  const puzzle = PUZZLE_CATALOG.find((candidate) => candidate.id === puzzleId);
  if (!puzzle) return null;
  const { solutionUci: _solutionUci, ...publicPuzzle } = puzzle;
  return publicPuzzle;
}

export function isPuzzleRelaySolution(puzzleId: string, from: string, to: string, promotion?: string): boolean {
  const puzzle = PUZZLE_CATALOG.find((candidate) => candidate.id === puzzleId);
  if (!puzzle) return false;

  try {
    const chess = new Chess(puzzle.fen);
    const move = chess.move({ from, to, promotion: promotion || "q" });
    if (!move) return false;
    const uci = `${move.from}${move.to}${move.promotion ?? ""}`;
    return uci === puzzle.solutionUci;
  } catch {
    return false;
  }
}

export interface PuzzleRelayRosterMember {
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
}

export interface PuzzleRelayTeamAssignment {
  teamNumber: number;
  members: PuzzleRelayRosterMember[];
}

/** Distributes the checked-in roster in a stable round-robin order. */
export function assignPuzzleRelayTeams(
  roster: readonly PuzzleRelayRosterMember[],
  requestedTeamCount: number,
): PuzzleRelayTeamAssignment[] {
  if (roster.length < 2) return [];
  const teamCount = Math.min(Math.max(2, requestedTeamCount), roster.length);
  const teams = Array.from({ length: teamCount }, (_, index) => ({ teamNumber: index + 1, members: [] as PuzzleRelayRosterMember[] }));
  roster.forEach((member, index) => teams[index % teamCount].members.push(member));
  return teams;
}
