import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const appSource = readFileSync(path.resolve("client/src/App.tsx"), "utf8");
const cssSource = readFileSync(path.resolve("client/src/index.css"), "utf8");

describe("route loader semantics", () => {
  it("keeps lazy route loading in flow rather than using the full-page loader surface", () => {
    expect(appSource).toContain('className="otb-route-loader"');
    expect(appSource).toContain("data-route-loader");
    expect(appSource).toContain('<OTBLoader size={72} label="Preparing the page" />');
    expect(appSource).not.toContain('<OTBLoader fullPage label="Preparing the board" />');
  });

  it("bounds the route loader below the viewport height", () => {
    expect(cssSource).toMatch(/\.otb-route-loader\s*\{[\s\S]*?min-height:\s*clamp\(18rem, 52vh, 34rem\)/);
  });
});
