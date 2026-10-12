import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const appSource = readFileSync(path.resolve("client/src/App.tsx"), "utf8");
const cssSource = readFileSync(path.resolve("client/src/index.css"), "utf8");
const loaderSource = readFileSync(path.resolve("client/src/components/OTBLoader.tsx"), "utf8");

describe("route loader semantics", () => {
  it("keeps lazy route loading in flow rather than using the full-page loader surface", () => {
    expect(appSource).toContain('className="otb-route-loader"');
    expect(appSource).toContain("data-route-loader");
    expect(appSource).toContain('<OTBLoader size={168} label="Preparing the Board" />');
    expect(appSource).not.toContain('<OTBLoader fullPage label="Preparing the board" />');
  });

  it("bounds the route loader below the viewport height", () => {
    expect(cssSource).toMatch(/\.otb-route-loader\s*\{[\s\S]*?min-height:\s*clamp\(22rem, 60vh, 38rem\)/);
  });

  it("keeps the official brand animation visible long enough to read", () => {
    expect(loaderSource).toContain("OTB_LOADER_PLAYBACK_RATE = 0.72");
    expect(loaderSource).toContain("const resolvedSize = size ?? (fullPage ? 216 : 136)");
    expect(loaderSource).toContain("video.playbackRate = OTB_LOADER_PLAYBACK_RATE");
    expect(loaderSource).toContain("autoPlay={false}");
    expect(loaderSource).toContain('const visibleLabel = label ?? (fullPage ? "Loading ChessOTB" : undefined)');
  });
});
