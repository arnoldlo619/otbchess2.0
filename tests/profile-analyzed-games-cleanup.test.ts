import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const profileSource = readFileSync(resolve(process.cwd(), "client/src/pages/Profile.tsx"), "utf8");

describe("Profile analyzed games cleanup", () => {
  it("removes the unused analyzed-games surface and its Profile-level data dependency", () => {
    expect(profileSource).not.toContain("My Analysed Games");
    expect(profileSource).not.toContain("useMyAnalysedGames");
    expect(profileSource).not.toContain("AnalysedGameCard");
  });
});
