import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "server/brackets.ts"), "utf8");

describe("bracket child tournament parent configuration", () => {
  it("inherits public visibility without an unused parent-state query", () => {
    expect(source).toContain("// Inherit the parent tournament's public visibility setting.");
    expect(source).toContain("isPublic: parentIsPublic,");
    expect(source).not.toContain("let parentState:");
    expect(source).not.toContain("const [stateRow]");
  });
});
