import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { formatEngineEval } from "../pages/RepertoireBuilder";

const repertoireBuilderSource = readFileSync(
  resolve(process.cwd(), "client/src/pages/RepertoireBuilder.tsx"),
  "utf8",
);

describe("Repertoire Builder — Stockfish evaluation presentation", () => {
  it("formats centipawn and mate scores for the board rail and candidate badges", () => {
    expect(formatEngineEval(42, null)).toBe("+0.4");
    expect(formatEngineEval(-137, null)).toBe("-1.4");
    expect(formatEngineEval(0, null)).toBe("+0.0");
    expect(formatEngineEval(0, 3)).toBe("M3");
    expect(formatEngineEval(0, -5)).toBe("M5");
  });

  it("keeps the evaluation bar visible while Stockfish is initializing", () => {
    expect(repertoireBuilderSource).toContain("{showEngine && (");
    expect(repertoireBuilderSource).toContain("isLoading={!sfEval || !sfReady}");
    expect(repertoireBuilderSource).toContain("Stockfish evaluation loading");
  });

  it("shows the Stockfish column and maps matching MultiPV lines to candidate moves", () => {
    expect(repertoireBuilderSource).toContain(">SF</div>");
    expect(repertoireBuilderSource).toContain("engineLine?: PVLine");
    expect(repertoireBuilderSource).toContain(
      "engineLine={showEngine ? sfPVLines.find((line) => line.move === move.uci) : undefined}",
    );
  });
});
