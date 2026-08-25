import { readdirSync, readFileSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(process.cwd());
const productionRoots = ["client/src", "server", "shared"];
const forbiddenMarkers = [
  "PROOF_AVATARS",
  "Join 700+ OTB players",
  "Avg. Host Rating",
  "function Testimonials",
  "Clubs that made the move.",
  "Marcus T.",
  "Aisha K.",
  "Rafael M.",
];

function productionSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__tests__") return [];
      return productionSourceFiles(path);
    }
    if (![".ts", ".tsx"].includes(extname(entry.name)) || entry.name.includes(".test.")) return [];
    return [path];
  });
}

describe("production social-proof integrity", () => {
  it("contains no removed testimonial, reviewer, stock-avatar, or rating markers", () => {
    const violations = productionRoots.flatMap((root) =>
      productionSourceFiles(join(projectRoot, root)).flatMap((path) => {
        const source = readFileSync(path, "utf8");
        return forbiddenMarkers
          .filter((marker) => source.includes(marker))
          .map((marker) => `${relative(projectRoot, path)}: ${marker}`);
      }),
    );

    expect(violations).toEqual([]);
  });
});
