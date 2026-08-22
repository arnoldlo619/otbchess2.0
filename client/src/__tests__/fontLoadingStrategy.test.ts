import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const documentSource = readFileSync(path.resolve("client/index.html"), "utf8");
const cssSource = readFileSync(path.resolve("client/src/index.css"), "utf8");

describe("font loading strategy", () => {
  it("uses swap rendering for every external font stylesheet", () => {
    const fontStylesheets = [...documentSource.matchAll(/<link[^>]+href="([^"]*(?:fonts\.googleapis\.com|api\.fontshare\.com)[^"]*)"[^>]+rel="stylesheet"[^>]*>/g)]
      .map((match) => match[1]);

    expect(fontStylesheets).toHaveLength(2);
    expect(fontStylesheets.every((href) => href.includes("display=swap"))).toBe(true);
  });

  it("preconnects to every font stylesheet and binary origin", () => {
    expect(documentSource).toContain('<link rel="preconnect" href="https://fonts.googleapis.com"');
    expect(documentSource).toContain('<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin');
    expect(documentSource).toContain('<link rel="preconnect" href="https://api.fontshare.com" crossorigin');
  });

  it("keeps immediate system and generic fallbacks for body, headings, and mono text", () => {
    expect(cssSource).toContain("font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif");
    expect(cssSource).toContain("font-family: 'Clash Display', 'Inter', sans-serif");
    expect(cssSource).toContain("font-family: 'JetBrains Mono', 'Courier New', monospace");
  });
});
