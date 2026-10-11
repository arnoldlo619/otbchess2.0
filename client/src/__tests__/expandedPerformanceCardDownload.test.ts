import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const clientRoot = resolve(import.meta.dirname, "..");
const expandedCard = readFileSync(resolve(clientRoot, "components/PlayerCardExpandedModal.tsx"), "utf8");
const report = readFileSync(resolve(clientRoot, "pages/Report.tsx"), "utf8");
const overview = readFileSync(resolve(clientRoot, "pages/TournamentOverview.tsx"), "utf8");

describe("Expanded performance card download", () => {
  it("offers a visible, accessible download action in the full-card view", () => {
    expect(expandedCard).toContain("data-expanded-performance-card-download");
    expect(expandedCard).toContain("Download");
    expect(expandedCard).toContain("Download ${player.name}'s full performance card as a 1080 by 1350 PNG");
    expect(expandedCard).toContain("Full performance card saved");
    expect(expandedCard).toContain("Ready for Instagram feed posts and carousel slides.");
  });

  it("renders a dedicated off-screen 4:5 full-card export surface", () => {
    expect(expandedCard).toContain("data-expanded-performance-card-export");
    expect(expandedCard).toContain("const FULL_CARD_EXPORT_WIDTH = 540;");
    expect(expandedCard).toContain("const FULL_CARD_EXPORT_HEIGHT = 675;");
    expect(expandedCard).toContain("const FULL_CARD_EXPORT_PIXEL_RATIO = 2;");
    expect(expandedCard).toContain('left: "-9999px"');
    expect(expandedCard).toContain("width: FULL_CARD_EXPORT_WIDTH");
    expect(expandedCard).toContain("height: FULL_CARD_EXPORT_HEIGHT");
  });

  it("uses the same CORS-safe HTML-to-image PNG pipeline at 1080 by 1350 output quality", () => {
    expect(expandedCard).toContain('const { toPng } = await import("html-to-image")');
    expect(expandedCard).toContain("pixelRatio: FULL_CARD_EXPORT_PIXEL_RATIO");
    expect(expandedCard).toContain('fetchRequestInit: { mode: "cors" }');
    expect(expandedCard).toContain("downloadFullPerformanceCard(exportCardRef.current, filename)");
    expect(expandedCard).toContain('src={OTB_LOGO_ASSET}');
  });

  it("passes the real tournament context from every full-card entry point", () => {
    expect(report).toContain("tournamentName={tournamentName}");
    expect(overview).toContain("tournamentName={tournamentName}");
  });
});
