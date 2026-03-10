/**
 * Tests for cv_worker.py post-processing heuristics.
 *
 * Uses a Python test harness (postprocess_harness.py) that extracts
 * postprocess_board from cv_worker.py and runs individual test cases.
 */
import { describe, it, expect } from "vitest";
import { execSync } from "child_process";
import path from "path";

const HARNESS = path.resolve(__dirname, "postprocess_harness.py");

function runTest(testName: string): any {
  const result = execSync(`python3.11 ${HARNESS} ${testName}`, {
    encoding: "utf-8",
    timeout: 10000,
    cwd: path.resolve(__dirname, ".."),
  }).trim();
  return JSON.parse(result);
}

describe("Post-Processing Heuristics", () => {
  describe("Heuristic 1: Pawn rank correction", () => {
    it("should reclassify white pawn on rank 8 using alternatives", () => {
      const data = runTest("pawn_rank8_with_alt");
      expect(data.piece).toBe("Q");
    });

    it("should reclassify black pawn on rank 1 using alternatives", () => {
      const data = runTest("pawn_rank1_with_alt");
      expect(data.piece).toBe("q");
    });

    it("should default to queen when no alternatives available", () => {
      const data = runTest("pawn_rank8_no_alt");
      expect(data.piece).toBe("Q");
      expect(data.conf).toBeCloseTo(0.3, 1);
    });

    it("should not modify pawns on valid ranks", () => {
      const data = runTest("pawn_valid_rank");
      expect(data.p1).toBe("P");
      expect(data.p2).toBe("p");
    });
  });

  describe("Heuristic 2: Excess piece count correction", () => {
    it("should reclassify 9th pawn using alternatives", () => {
      const data = runTest("excess_pawn_reclassify");
      expect(data.pawns).toBeLessThanOrEqual(8);
      expect(data.cell).toBe("B");
    });

    it("should reclassify second king to queen", () => {
      const data = runTest("two_kings");
      expect(data.kings).toBe(1);
      expect(data.cell_0_4).toBe("K");
      expect(data.cell_3_3).toBe("Q");
    });

    it("should remove excess piece when no alternatives available", () => {
      const data = runTest("two_kings_no_alt");
      expect(data.kings).toBe(1);
      expect(data.cell_3_3_is_none).toBe(true);
    });
  });

  describe("Heuristic 3: Promotion budget enforcement", () => {
    it("should enforce promotion budget (8 pawns + 3 queens)", () => {
      const data = runTest("promotion_budget_violated");
      expect(data.budget_ok).toBe(true);
    });

    it("should allow extra officers when pawns are missing", () => {
      const data = runTest("promotion_budget_ok");
      expect(data.budget_ok).toBe(true);
    });
  });

  describe("Heuristic 4: Color flip correction", () => {
    it("should flip lowest-confidence piece when side exceeds 16", () => {
      const data = runTest("color_flip");
      expect(data.white_total).toBeLessThanOrEqual(16);
    });
  });

  describe("Edge cases", () => {
    it("should not modify a valid starting position", () => {
      const data = runTest("starting_position");
      expect(data).toEqual({
        r: 2, n: 2, b: 2, q: 1, k: 1, p: 8,
        R: 2, N: 2, B: 2, Q: 1, K: 1, P: 8,
      });
    });

    it("should handle empty board gracefully", () => {
      const data = runTest("empty_board");
      expect(data.total).toBe(0);
    });

    it("should handle board with only kings", () => {
      const data = runTest("only_kings");
      expect(data.K).toBe(1);
      expect(data.k).toBe(1);
    });

    it("should preserve alternatives data through processing", () => {
      const data = runTest("alternatives_preserved");
      expect(data.piece).toBe("B");
      expect(data.has_alts).toBe(true);
    });
  });
});
