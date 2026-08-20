import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "client/src/pages/Training.tsx"), "utf8");

describe("Training page feature descriptions", () => {
  it("keeps the Matchup Prep description concise", () => {
    expect(source).toContain(
      '"Enter any chess.com username and get a deep pre-game scouting report in seconds..."'
    );
    expect(source).not.toContain("preparation depth, and the exact moves where they most commonly go wrong");
  });

  it("leads the Video Editor description with its side-by-side workflow", () => {
    expect(source).toContain(
      '"Side-by-side editor: your video plays on the left while a live interactive digital chessboard sits on the right."'
    );
    expect(source).not.toContain("Upload your OTB game video and open a side-by-side editor");
  });
});
