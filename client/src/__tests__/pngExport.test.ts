/**
 * PNG Export Fix Tests
 *
 * Root cause: html2canvas 1.4.1 only supports rgb/rgba/hsl/hsla color functions.
 * The OTB design system uses oklch() throughout (backgrounds, gradients, Tailwind
 * CSS variables). When html2canvas encounters oklch() it throws
 * "Attempting to parse an unsupported color function 'oklch'" which bubbles up
 * as the "Export failed — try again" toast.
 *
 * Fix: replaced all html2canvas usages with html-to-image, which serialises DOM
 * to SVG via the browser's native rendering engine and supports all modern CSS.
 *
 * These tests verify:
 * 1. html2canvas does NOT support oklch (confirms the root cause)
 * 2. html-to-image IS installed and exports the expected API surface
 * 3. The export helper files no longer import html2canvas at runtime
 * 4. The hidden export card uses fixed positioning (not sr-only) so it has real dimensions
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

// __dirname = /home/ubuntu/otb-chess/client/src/__tests__
// 3 levels up = /home/ubuntu/otb-chess
const ROOT = resolve(__dirname, "../../../");

// ── Helper: read source file ──────────────────────────────────────────────────
function readSrc(relPath: string): string {
  return readFileSync(resolve(ROOT, "client/src", relPath), "utf8");
}

function readNodeModule(relPath: string): string {
  return readFileSync(resolve(ROOT, "node_modules", relPath), "utf8");
}

// ── 1. Confirm html2canvas does NOT support oklch ─────────────────────────────
describe("Root Cause: html2canvas oklch support", () => {
  it("html2canvas SUPPORTED_COLOR_FUNCTIONS does not include oklch", () => {
    const src = readNodeModule("html2canvas/dist/html2canvas.js");
    const defIdx = src.indexOf("SUPPORTED_COLOR_FUNCTIONS =");
    expect(defIdx).toBeGreaterThan(0);

    // Extract the SUPPORTED_COLOR_FUNCTIONS object (next ~200 chars)
    const snippet = src.slice(defIdx, defIdx + 200);
    expect(snippet).not.toContain("oklch");
    expect(snippet).toContain("rgb");
    expect(snippet).toContain("hsl");
  });

  it("html2canvas throws on unsupported color functions", () => {
    const src = readNodeModule("html2canvas/dist/html2canvas.js");
    // Confirm the throw path exists
    expect(src).toContain("Attempting to parse an unsupported color function");
  });

  it("PlayerStatsCard uses oklch in its background gradient", () => {
    const src = readSrc("components/PlayerStatsCard.tsx");
    expect(src).toContain("oklch(");
  });
});

// ── 2. html-to-image is installed and has the right API ───────────────────────
describe("Fix: html-to-image installation and API", () => {
  it("html-to-image package is installed", () => {
    const pkg = JSON.parse(readNodeModule("html-to-image/package.json"));
    expect(pkg.version).toBeTruthy();
    // Should be 1.x
    expect(parseInt(pkg.version.split(".")[0])).toBeGreaterThanOrEqual(1);
  });

  it("html-to-image exports toPng, toBlob, toCanvas", () => {
    const src = readNodeModule("html-to-image/es/index.js");
    expect(src).toContain("export async function toPng");
    expect(src).toContain("export async function toBlob");
    expect(src).toContain("export async function toCanvas");
  });

  it("html-to-image supports fetchRequestInit option for CORS", () => {
    const src = readNodeModule("html-to-image/es/dataurl.js");
    // fetchRequestInit is passed through to fetch()
    expect(src).toContain("fetchRequestInit");
  });
});

// ── 3. Source files no longer import html2canvas at runtime ───────────────────
describe("Fix: html2canvas removed from export paths", () => {
  const filesToCheck = [
    "pages/Report.tsx",
    "components/ShareResultsModal.tsx",
    "components/CrossTable.tsx",
    "components/RoundTimeline.tsx",
    "pages/GameAnalysis.tsx",
    "components/InstagramCarouselModal.tsx",
  ];

  for (const file of filesToCheck) {
    it(`${file} does not dynamically import html2canvas`, () => {
      const src = readSrc(file);
      // Must not have any dynamic import("html2canvas") call
      expect(src).not.toMatch(/import\s*\(\s*["']html2canvas["']\s*\)/);
    });

    it(`${file} uses html-to-image instead`, () => {
      const src = readSrc(file);
      // Must use html-to-image
      expect(src).toContain("html-to-image");
    });
  }
});

// ── 4. Hidden export card uses fixed positioning (not sr-only) ────────────────
describe("Fix: hidden export card has real dimensions", () => {
  it("Report.tsx hidden export card uses fixed positioning not sr-only", () => {
    const src = readSrc("pages/Report.tsx");

    // Must NOT use sr-only for the hidden card wrapper (sr-only collapses dimensions to 0)
    // Find the hidden card section
    const hiddenCardIdx = src.indexOf("Hidden export-quality card");
    expect(hiddenCardIdx).toBeGreaterThan(0);

    // Skip past the comment lines to find the actual div element
    // The comment itself mentions "sr-only" as explanation, so we check the div
    const divIdx = src.indexOf('<div style={{ position:', hiddenCardIdx);
    expect(divIdx).toBeGreaterThan(0);
    const divSnippet = src.slice(divIdx, divIdx + 150);
    // Must use real CSS positioning, not sr-only class
    expect(divSnippet).not.toContain('className="sr-only');
    expect(divSnippet).toContain('position:');
    expect(divSnippet).toMatch(/fixed|absolute/);
    expect(divSnippet).toContain("-9999px");
  });

  it("Report.tsx exportCardAsPng uses html-to-image toPng", () => {
    const src = readSrc("pages/Report.tsx");
    expect(src).toContain('const { toPng } = await import("html-to-image")');
  });

  it("Report.tsx renderCardToBlob uses html-to-image toBlob", () => {
    const src = readSrc("pages/Report.tsx");
    expect(src).toContain('const { toBlob } = await import("html-to-image")');
  });

  it("Report.tsx export uses pixelRatio: 2 for high-res output", () => {
    const src = readSrc("pages/Report.tsx");
    expect(src).toContain("pixelRatio: 2");
  });

  it("Report.tsx export passes fetchRequestInit cors mode for avatar proxy", () => {
    const src = readSrc("pages/Report.tsx");
    expect(src).toContain('fetchRequestInit: { mode: "cors" }');
  });
});

// ── 5. Avatar proxy still serves correct CORS headers ─────────────────────────
describe("Avatar proxy CORS configuration", () => {
  it("server/index.ts avatar-proxy sets Access-Control-Allow-Origin: *", () => {
    const src = readFileSync(resolve(ROOT, "server/index.ts"), "utf8");
    expect(src).toContain("Access-Control-Allow-Origin");
    expect(src).toContain('"*"');
  });

  it("toProxiedAvatarUrl rewrites chess.com URLs to /api/avatar-proxy", () => {
    const src = readSrc("hooks/useChessAvatar.ts");
    expect(src).toContain("/api/avatar-proxy");
    expect(src).toContain("images.chess.com");
  });

  it("Report.tsx hidden card uses toProxiedAvatarUrl for avatarUrl", () => {
    const src = readSrc("pages/Report.tsx");
    expect(src).toContain("toProxiedAvatarUrl(");
  });
});
