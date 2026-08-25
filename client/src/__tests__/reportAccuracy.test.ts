import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildStandingsHeaders,
  buildStandingsRows,
  isQuadsPdfFormat,
  usesBuchholzPdfTiebreak,
} from "@/lib/generateResultsPdf";
import { calculateCompletedGameDrawRate } from "@/lib/reportMetrics";
import type { Player, Round } from "@/lib/tournamentData";

const player: Player = {
  id: "p1",
  name: "Alice",
  username: "alice",
  elo: 1800,
  platform: "chesscom",
  points: 2,
  wins: 2,
  draws: 0,
  losses: 0,
  buchholz: 3.5,
};

describe("report accuracy", () => {
  it("uses completed played games as the draw-rate denominator", () => {
    const rounds: Round[] = [{
      number: 1,
      status: "in_progress",
      games: [
        { id: "g1", whiteId: "a", blackId: "b", result: "½-½", round: 1, boardNumber: 1 },
        { id: "g2", whiteId: "c", blackId: "d", result: "1-0", round: 1, boardNumber: 2 },
        { id: "g3", whiteId: "e", blackId: "f", result: "*", round: 1, boardNumber: 3 },
        { id: "g4", whiteId: "g", blackId: "BYE", result: "1-0", round: 1, boardNumber: 4 },
      ],
    }];

    expect(calculateCompletedGameDrawRate(rounds)).toBe(50);
    expect(calculateCompletedGameDrawRate([])).toBe(0);
  });

  it("removes Buchholz headers and cells from Quads PDF standings", () => {
    expect(isQuadsPdfFormat("quads")).toBe(true);
    expect(isQuadsPdfFormat("Quads · 3R")).toBe(true);
    expect(buildStandingsHeaders(false)).toEqual(["#", "Player", "ELO", "Pts", "W", "D", "L"]);
    expect(buildStandingsRows([player], false)[0]).toHaveLength(7);
    expect(buildStandingsRows([player], false)[0]).not.toContain("3.5");
  });

  it("preserves Buchholz only for Swiss-system PDF standings", () => {
    expect(isQuadsPdfFormat("Swiss")).toBe(false);
    expect(usesBuchholzPdfTiebreak("Swiss")).toBe(true);
    expect(usesBuchholzPdfTiebreak("Swiss + Elimination")).toBe(true);
    expect(usesBuchholzPdfTiebreak("Double Swiss")).toBe(true);
    expect(buildStandingsHeaders()).toContain("Buch.");
    expect(buildStandingsRows([player])[0]).toContain("3.5");
  });

  it("never gives unknown or non-Swiss formats Buchholz labels", () => {
    expect(usesBuchholzPdfTiebreak()).toBe(false);
    expect(usesBuchholzPdfTiebreak("legacy-format")).toBe(false);
    expect(usesBuchholzPdfTiebreak("Round Robin")).toBe(false);
    expect(usesBuchholzPdfTiebreak("Elimination")).toBe(false);
    expect(usesBuchholzPdfTiebreak("Quads · 3R")).toBe(false);
  });

  it("guards Swiss scoring and pairing pages in both PDF generators", () => {
    const source = readFileSync(
      resolve(import.meta.dirname, "../lib/generateResultsPdf.ts"),
      "utf8",
    );
    expect(source.match(/if \(includeBuchholz\) \{/g)).toHaveLength(2);
    expect(source.match(/buildStandingsHeaders\(includeBuchholz\)/g)).toHaveLength(2);
    expect(source.match(/buildStandingsRows\(sortedPlayers, includeBuchholz\)/g)).toHaveLength(2);
  });
});
