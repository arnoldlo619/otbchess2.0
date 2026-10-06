import { describe, expect, it } from "vitest";
import {
  assignPuzzleRelayTeams,
  getPuzzleRelayPuzzleSequence,
  isPuzzleRelaySolution,
  parsePuzzleRelayDifficulty,
  parsePuzzleRelayTeamCount,
} from "../shared/puzzleRelay";

describe("Puzzle Relay rules", () => {
  it("keeps event configuration inside the supported team and difficulty ranges", () => {
    expect(parsePuzzleRelayDifficulty("beginner")).toBe("beginner");
    expect(parsePuzzleRelayDifficulty("intermediate")).toBe("intermediate");
    expect(parsePuzzleRelayDifficulty("advanced")).toBe("advanced");
    expect(parsePuzzleRelayDifficulty("expert")).toBeNull();

    expect(parsePuzzleRelayTeamCount(2)).toBe(2);
    expect(parsePuzzleRelayTeamCount("8")).toBe(8);
    expect(parsePuzzleRelayTeamCount(1)).toBeNull();
    expect(parsePuzzleRelayTeamCount(9)).toBeNull();
    expect(parsePuzzleRelayTeamCount(2.5)).toBeNull();
  });

  it("exposes only public puzzle data and scores the expected legal solution", () => {
    const puzzles = getPuzzleRelayPuzzleSequence("beginner", 3);

    expect(puzzles).toHaveLength(3);
    expect(puzzles[0]).toMatchObject({ id: "beginner-back-rank-1", fen: expect.any(String) });
    expect(puzzles[0]).not.toHaveProperty("solutionUci");
    expect(isPuzzleRelaySolution("beginner-back-rank-1", "d1", "d8")).toBe(true);
    expect(isPuzzleRelaySolution("beginner-back-rank-1", "d1", "d7")).toBe(false);
  });

  it("creates balanced stable teams and never creates more teams than attendees", () => {
    const roster = ["Alex", "Blair", "Casey", "Dev", "Eden"].map((displayName, index) => ({
      userId: `member-${index + 1}`,
      displayName,
    }));
    const teams = assignPuzzleRelayTeams(roster, 3);

    expect(teams.map((team) => team.members.map((member) => member.displayName))).toEqual([
      ["Alex", "Dev"],
      ["Blair", "Eden"],
      ["Casey"],
    ]);
    expect(assignPuzzleRelayTeams(roster.slice(0, 2), 8)).toHaveLength(2);
    expect(assignPuzzleRelayTeams(roster.slice(0, 1), 2)).toEqual([]);
  });
});
