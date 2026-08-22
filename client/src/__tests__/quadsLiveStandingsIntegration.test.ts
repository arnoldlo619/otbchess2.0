import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { computeTournamentLiveStandings } from "@/lib/directorState";
import type { QuadSection } from "@/lib/quads";
import type { Game, Player, Round } from "@/lib/tournamentData";

const clientRoot = resolve(import.meta.dirname, "..");
const read = (relativePath: string) => readFileSync(resolve(clientRoot, relativePath), "utf8");

const players: Player[] = [
  { id: "a", name: "Alice", username: "alice", elo: 1800, platform: "chesscom" },
  { id: "b", name: "Bob", username: "bob", elo: 1700, platform: "chesscom" },
  { id: "c", name: "Carol", username: "carol", elo: 1600, platform: "chesscom" },
  { id: "d", name: "Dave", username: "dave", elo: 1500, platform: "chesscom" },
];

const section: QuadSection = {
  id: "quad-1",
  name: "Quad 1",
  type: "quad",
  orderIndex: 0,
  ratingMin: 1500,
  ratingMax: 1800,
  playerIds: players.map((player) => player.id),
  localSeeds: { a: 1, b: 2, c: 3, d: 4 },
  status: "completed",
};

const games: Game[] = [
  { id: "g1", whiteId: "a", blackId: "b", result: "1-0", round: 1, boardNumber: 1, sectionId: section.id },
  { id: "g2", whiteId: "c", blackId: "d", result: "1-0", round: 1, boardNumber: 2, sectionId: section.id },
  { id: "g3", whiteId: "b", blackId: "c", result: "1-0", round: 2, boardNumber: 1, sectionId: section.id },
  { id: "g4", whiteId: "d", blackId: "a", result: "0-1", round: 2, boardNumber: 2, sectionId: section.id },
  { id: "g5", whiteId: "a", blackId: "c", result: "1-0", round: 3, boardNumber: 1, sectionId: section.id },
  { id: "g6", whiteId: "b", blackId: "d", result: "1-0", round: 3, boardNumber: 2, sectionId: section.id },
];

const rounds: Round[] = [1, 2, 3].map((number) => ({
  number,
  status: "completed",
  games: games.filter((game) => game.round === number),
}));

describe("Quads live standings correctness", () => {
  it("adapts calculateQuadStandings into live rows without Swiss Buchholz", () => {
    const standings = computeTournamentLiveStandings(players, rounds, "quads", [section]);
    expect(standings).toHaveLength(4);
    expect(standings[0].player.id).toBe("a");
    expect(standings[0].rank).toBe(1);
    expect(standings[0].points).toBe(3);
    expect(standings[0].sonnebornBerger).toBeGreaterThan(standings[1].sonnebornBerger);
    expect(standings.every((row) => row.buchholz === 0 && row.buchholzCut1 === 0)).toBe(true);
  });

  it("preserves the Swiss engine for non-Quads formats", () => {
    const standings = computeTournamentLiveStandings(players, rounds, "swiss");
    expect(standings).toHaveLength(4);
    expect(standings.some((row) => row.buchholz > 0)).toBe(true);
  });

  it("keeps the Quads director panel free of Swiss standings and Buchholz labels", () => {
    const source = read("components/tournament/QuadsDirectorPanel.tsx");
    expect(source).not.toContain("computeStandings");
    expect(source).not.toMatch(/Buchholz|Buch\./);
    expect(source.match(/getQuadStandingRows/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
  });

  it("uses SB instead of Buchholz on the participant Quads standings path", () => {
    const source = read("pages/Tournament.tsx");
    expect(source).toContain("computeTournamentLiveStandings");
    expect(source).toContain('isQuads ? "SB" : "Buch."');
    expect(source).toContain("isQuads ? row.sonnebornBerger : row.buchholz");
    expect(source).toContain('type={isQuads ? "sb" : "buchholz"}');
  });
});
