import { describe, expect, it } from "vitest";
import { projectQuadSectionStandings } from "./quadsProjection";

describe("projectQuadSectionStandings", () => {
  const section = { id: "quad-a", playerIds: ["a", "b", "c", "d"] };
  const players = [
    { id: "a", elo: 1800 },
    { id: "b", elo: 1700 },
    { id: "c", elo: 1600 },
    { id: "d", elo: 1500 },
  ];

  it("uses the configured direct-encounter order and never invents a global rank", () => {
    const rows = projectQuadSectionStandings(section, [
      { whiteId: "a", blackId: "b", result: "1-0", sectionId: "quad-a" },
      { whiteId: "c", blackId: "d", result: "1-0", sectionId: "quad-a" },
      { whiteId: "c", blackId: "a", result: "1-0", sectionId: "quad-a" },
      { whiteId: "b", blackId: "d", result: "1-0", sectionId: "quad-a" },
      { whiteId: "a", blackId: "d", result: "1-0", sectionId: "quad-a" },
      { whiteId: "b", blackId: "c", result: "1-0", sectionId: "quad-a" },
    ], players);

    expect(rows.map((row) => [row.playerId, row.finalRank])).toEqual([
      ["a", 1], ["b", 2], ["c", 3], ["d", 4],
    ]);
    expect(rows.every((row) => row.sectionId === "quad-a")).toBe(true);
  });

  it("reconstructs legacy Quads games that predate sectionId persistence", () => {
    const rows = projectQuadSectionStandings(section, [
      { whiteId: "a", blackId: "b", result: "1-0" },
      { whiteId: "c", blackId: "d", result: "½-½" },
    ], players);

    expect(rows.find((row) => row.playerId === "a")?.score).toBe(1);
    expect(rows.find((row) => row.playerId === "b")?.score).toBe(0);
    expect(rows.find((row) => row.playerId === "c")?.score).toBe(0.5);
  });
});
