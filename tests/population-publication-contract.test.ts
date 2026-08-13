import { describe, expect, it } from "vitest";
import { validateAggregateRows } from "../server/population/publication";

describe("population dataset publication contract", () => {
  it("rejects impossible aggregate counters before publication", () => {
    expect(() => validateAggregateRows([])).toThrow("Empty");
    expect(() => validateAggregateRows([{ parentTotal: BigInt(5), moveTotal: BigInt(6), whiteWins: BigInt(3), draws: BigInt(1), blackWins: BigInt(2) }])).toThrow("MoveExceedsParent");
    expect(() => validateAggregateRows([{ parentTotal: BigInt(5), moveTotal: BigInt(5), whiteWins: BigInt(3), draws: BigInt(1), blackWins: BigInt(0) }])).toThrow("OutcomeMismatch");
    expect(() => validateAggregateRows([{ parentTotal: BigInt(5), moveTotal: BigInt(5), whiteWins: BigInt(3), draws: BigInt(1), blackWins: BigInt(1) }])).not.toThrow();
  });
});
