import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const trainingSource = readFileSync(
  resolve(process.cwd(), "client/src/pages/Training.tsx"),
  "utf8",
);

describe("Training page visual edits", () => {
  it("keeps the requested compact OTB Toolkit header copy", () => {
    expect(trainingSource).toContain("ChessOTB.Club OTB Toolkit");
    expect(trainingSource).not.toContain(
      "Scout opponents, build your repertoire, and study openings",
    );
  });

  it("removes the requested roadmap div and its unused implementation", () => {
    expect(trainingSource).not.toContain("On the roadmap");
    expect(trainingSource).not.toContain("COMING_SOON");
    expect(trainingSource).not.toContain("ComingSoonCell");
  });
});
