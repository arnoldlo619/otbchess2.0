import { describe, expect, it } from "vitest";
import { createSpeedDatingRound, getSpeedDatingRoundCapacity } from "@shared/speedDatingPairings";

describe("Speed Dating pairing engine", () => {
  it("rotates every participant through unique partners before repetition", () => {
    const players = ["a", "b", "c", "d"];
    const pairKeys = new Set<string>();

    for (let round = 1; round <= 3; round += 1) {
      const pairs = createSpeedDatingRound(players, round);
      expect(pairs).toHaveLength(2);
      for (const pair of pairs) {
        pairKeys.add([pair.whiteUserId, pair.blackUserId].sort().join(":"));
      }
    }

    expect(pairKeys).toEqual(new Set(["a:b", "a:c", "a:d", "b:c", "b:d", "c:d"]));
    expect(getSpeedDatingRoundCapacity(players.length)).toBe(3);
  });

  it("rotates a bye fairly without storing a fake pairing", () => {
    const players = ["a", "b", "c"];
    const appearances = new Map(players.map((player) => [player, 0]));

    for (let round = 1; round <= 3; round += 1) {
      const pairs = createSpeedDatingRound(players, round);
      expect(pairs).toHaveLength(1);
      expect(pairs[0].whiteUserId).not.toContain("bye");
      expect(pairs[0].blackUserId).not.toContain("bye");
      for (const userId of [pairs[0].whiteUserId, pairs[0].blackUserId]) {
        appearances.set(userId, (appearances.get(userId) ?? 0) + 1);
      }
    }

    expect(Array.from(appearances.values())).toEqual([2, 2, 2]);
    expect(getSpeedDatingRoundCapacity(players.length)).toBe(3);
  });

  it("returns no pairing for an invalid or undersized roster", () => {
    expect(createSpeedDatingRound(["a"], 1)).toEqual([]);
    expect(createSpeedDatingRound(["a", "b"], 0)).toEqual([]);
  });
});
