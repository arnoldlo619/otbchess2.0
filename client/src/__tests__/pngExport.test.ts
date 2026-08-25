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
 * 5. Avatar proxy CORS configuration is correct
 * 6. Every player avatar <img> tag carries crossOrigin="anonymous" and routes through
 *    /api/avatar-proxy (prevents mixed-content warnings and tainted-canvas errors)
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

  const htmlToImageFiles = filesToCheck.filter((file) => file !== "pages/GameAnalysis.tsx");

  for (const file of filesToCheck) {
    it(`${file} does not dynamically import html2canvas`, () => {
      const src = readSrc(file);
      // Must not have any dynamic import("html2canvas") call
      expect(src).not.toMatch(/import\s*\(\s*["']html2canvas["']\s*\)/);
    });

  }

  for (const file of htmlToImageFiles) {
    it(`${file} uses html-to-image instead`, () => {
      const src = readSrc(file);
      // Must use html-to-image
      expect(src).toContain("html-to-image");
    });
  }

  it("pages/GameAnalysis.tsx uses the annotated PGN export path instead of a raster export", () => {
    const src = readSrc("pages/GameAnalysis.tsx");
    expect(src).toContain('from "@/lib/exportPgn"');
    expect(src).toContain("buildAnnotatedPgn");
    expect(src).toContain("downloadPgn");
  });
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
    // Find the div — may have aria-hidden/inert before style
    const divIdx = src.indexOf('<div aria-hidden="true" inert style={{ position:', hiddenCardIdx);
    const divIdx2 = src.indexOf('<div style={{ position:', hiddenCardIdx);
    const actualIdx = divIdx > 0 ? divIdx : divIdx2;
    expect(actualIdx).toBeGreaterThan(0);
    const divSnippet = src.slice(actualIdx, actualIdx + 200);
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

  it("Report.tsx export uses pixelRatio: 3 for Instagram-quality output", () => {
    const src = readSrc("pages/Report.tsx");
    expect(src).toContain("pixelRatio: 3");
  });

  it("Report.tsx export passes fetchRequestInit cors mode for avatar proxy", () => {
    const src = readSrc("pages/Report.tsx");
    expect(src).toContain('fetchRequestInit: { mode: "cors" }');
  });
});

// ── 4b. Instagram Carousel export quality ───────────────────────────────────
describe("Instagram Carousel export quality", () => {
  it("InstagramCarouselModal uses exportRefs (separate from slideRefs) for export", () => {
    const src = readSrc("components/InstagramCarouselModal.tsx");
    expect(src).toContain("exportRefs");
    expect(src).toContain("slideRefs");
  });

  it("InstagramCarouselModal export uses pixelRatio: 3 for crisp output", () => {
    const src = readSrc("components/InstagramCarouselModal.tsx");
    expect(src).toContain("pixelRatio: 3");
  });

  it("InstagramCarouselModal has off-screen export container at left: -9999px", () => {
    const src = readSrc("components/InstagramCarouselModal.tsx");
    expect(src).toContain("-9999px");
  });

  it("InstagramCarouselModal off-screen container has exact SLIDE_W and slideH dimensions", () => {
    const src = readSrc("components/InstagramCarouselModal.tsx");
    // exportRefs container uses SLIDE_W and slideH
    expect(src).toContain("width: SLIDE_W");
    expect(src).toContain("height: slideH");
  });
});

// ── 5. Avatar proxy CORS configuration ───────────────────────────────────────
describe("Avatar proxy CORS configuration", () => {
  it("server/chessProxy.ts restricts production CORS and permits wildcard only in development", () => {
    const src = readFileSync(resolve(ROOT, "server/chessProxy.ts"), "utf8");
    expect(src).toContain("PROXY_ALLOWED_ORIGINS");
    expect(src).toContain('res.setHeader("Access-Control-Allow-Origin", origin)');
    expect(src).toContain('process.env.NODE_ENV !== "production"');
    expect(src).toContain('res.setHeader("Access-Control-Allow-Origin", "*")');
  });

  it("toProxiedAvatarUrl rewrites chess.com URLs to /api/avatar-proxy", () => {
    const src = readSrc("hooks/useChessAvatar.ts");
    expect(src).toContain("/api/avatar-proxy");
    expect(src).toContain("images.chess.com");
    // Also rewrites the actual CDN domain chess.com API returns
    expect(src).toContain("images.chesscomfiles.com");
  });

  it("toProxiedAvatarUrl allowlist includes lichess.org and lichess1.org", () => {
    const src = readSrc("hooks/useChessAvatar.ts");
    expect(src).toContain("lichess.org");
    expect(src).toContain("lichess1.org");
  });

  it("server/chessProxy.ts avatar-proxy allowlist includes all chess.com and lichess domains", () => {
    const src = readFileSync(resolve(ROOT, "server/chessProxy.ts"), "utf8");
    const handlerIdx = src.indexOf('router.get("/avatar-proxy"');
    expect(handlerIdx).toBeGreaterThan(0);
    const proxySection = src.slice(handlerIdx, handlerIdx + 800);
    expect(proxySection).toContain("images.chess.com");
    // The actual CDN domain returned by chess.com API
    expect(proxySection).toContain("images.chesscomfiles.com");
    expect(proxySection).toContain("lichess.org");
    expect(proxySection).toContain("lichess1.org");
  });

  it("server/index.ts mounts the decomposed chess proxy router under /api", () => {
    const src = readFileSync(resolve(ROOT, "server/index.ts"), "utf8");
    expect(src).toContain('app.use("/api", createChessProxyRouter())');
  });

  it("Report.tsx hidden card uses toProxiedAvatarUrl for avatarUrl", () => {
    const src = readSrc("pages/Report.tsx");
    expect(src).toContain("toProxiedAvatarUrl(");
  });
});

// ── 6. crossOrigin="anonymous" coverage across all avatar render sites ────────
describe("crossOrigin='anonymous' coverage on all avatar img tags", () => {
  it("PlayerAvatar.tsx img tag has crossOrigin='anonymous'", () => {
    const src = readSrc("components/PlayerAvatar.tsx");
    // The img tag that renders the avatar photo
    expect(src).toContain('crossOrigin="anonymous"');
  });

  it("PlayerAvatar.tsx applies toProxiedAvatarUrl to resolvedUrl before img src", () => {
    const src = readSrc("components/PlayerAvatar.tsx");
    expect(src).toContain("toProxiedAvatarUrl(");
    // The proxied URL must be used as the img src
    expect(src).toContain("src={resolvedUrl");
  });

  it("PlayerStatsCard.tsx applies toProxiedAvatarUrl internally", () => {
    const src = readSrc("components/PlayerStatsCard.tsx");
    expect(src).toContain("toProxiedAvatarUrl(avatarUrlRaw)");
  });

  it("PlayerStatsCard.tsx both avatar img tags have crossOrigin='anonymous'", () => {
    const src = readSrc("components/PlayerStatsCard.tsx");
    // Count occurrences — there are two img tags (blurred bg + main avatar)
    const matches = src.match(/crossOrigin="anonymous"/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it("Home.tsx profile.avatar img routes through /api/avatar-proxy", () => {
    const src = readSrc("pages/Home.tsx");
    // The profile avatar img must use the proxy URL
    expect(src).toContain("/api/avatar-proxy?url=");
    expect(src).toContain('crossOrigin="anonymous"');
  });

  it("Join.tsx profile.avatar img routes through /api/avatar-proxy", () => {
    const src = readSrc("pages/Join.tsx");
    expect(src).toContain("/api/avatar-proxy?url=");
    expect(src).toContain('crossOrigin="anonymous"');
  });

  it("MatchupPrep.tsx opponentProfile.avatar img routes through /api/avatar-proxy", () => {
    const src = readSrc("pages/MatchupPrep.tsx");
    expect(src).toContain("/api/avatar-proxy?url=");
    expect(src).toContain('crossOrigin="anonymous"');
  });

  it("AddPlayerModal.tsx lookupResult.avatar img routes through toProxiedAvatarUrl", () => {
    const src = readSrc("components/AddPlayerModal.tsx");
    expect(src).toContain("toProxiedAvatarUrl(lookupResult.avatar)");
    expect(src).toContain('crossOrigin="anonymous"');
  });

  it("Report.tsx visible ExportableCard receives toProxiedAvatarUrl for avatarUrl", () => {
    const src = readSrc("pages/Report.tsx");
    // Both the hidden export card and the visible card must use toProxiedAvatarUrl
    const matches = src.match(/toProxiedAvatarUrl\(/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it("ShareResultsModal.tsx avatar img has crossOrigin='anonymous'", () => {
    const src = readSrc("components/ShareResultsModal.tsx");
    expect(src).toContain('crossOrigin="anonymous"');
  });

  it("no player avatar img tag in client source renders a raw lichess.org URL as src", () => {
    // Verify there are no direct lichess.org API fetch calls left in client source
    const filesToCheck = [
      "pages/Home.tsx",
      "pages/Join.tsx",
      "pages/MatchupPrep.tsx",
      "components/PlayerAvatar.tsx",
      "components/PlayerStatsCard.tsx",
      "components/AddPlayerModal.tsx",
      "components/UploadRSVPModal.tsx",
      "hooks/useRatingHistory.ts",
      "hooks/useLichessProfile.ts",
    ];
    for (const file of filesToCheck) {
      const src = readSrc(file);
      // Must not contain a raw fetch to lichess.org/api (all should go through proxy)
      expect(src, `${file} should not fetch lichess.org/api directly`).not.toMatch(
        /fetch\s*\(\s*`https:\/\/lichess\.org\/api/
      );
    }
  });
});
