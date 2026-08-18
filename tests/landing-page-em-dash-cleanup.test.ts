import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("landing page editorial punctuation", () => {
  it("contains no em dashes in the landing page source", () => {
    const home = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");
    expect(home).not.toContain("—");
  });

  it("keeps the mobile sign-up message concise without em-dash construction", () => {
    const home = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");
    expect(home).toContain("Sign up with chess.com username. Pairings are generated automatically.");
  });
});
