import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const clientRoot = resolve(import.meta.dirname, "..");
const report = readFileSync(resolve(clientRoot, "pages/Report.tsx"), "utf8");
const playerCard = readFileSync(resolve(clientRoot, "components/PlayerStatsCard.tsx"), "utf8");
const navLogo = readFileSync(resolve(clientRoot, "components/NavLogo.tsx"), "utf8");
const performanceStats = readFileSync(resolve(clientRoot, "lib/performanceStats.ts"), "utf8");

describe("Performance report tournament integrity", () => {
  it("renders recent form from recorded tournament rounds rather than remote Chess.com history", () => {
    expect(playerCard).toContain("const recentTournamentForm = roundHistory.slice(-5);");
    expect(playerCard).toContain("Recent Tournament Form");
    expect(playerCard).toContain("data-tournament-form");
    expect(playerCard).not.toContain("chesscomWins");
    expect(report).not.toContain("/api/chess/player/");
    expect(report).not.toContain("chesscomForm");
  });

  it("uses the local OTB mark in report cards and shared navigation", () => {
    const brandAsset = resolve(clientRoot, "../public/brand/otb-logo-exclamation.webp");

    expect(existsSync(brandAsset)).toBe(true);
    expect(playerCard).toContain('import { OTB_LOGO_ASSET } from "@/lib/brandAssets";');
    expect(playerCard).toContain("src={OTB_LOGO_ASSET}");
    expect(playerCard).not.toContain("d2xsxph8kpxj0f.cloudfront.net");
    expect(navLogo).toContain('import { OTB_LOGO_ASSET } from "@/lib/brandAssets";');
    expect(navLogo).toContain("src={OTB_LOGO_ASSET}");
  });

  it("keeps long achievement labels compact, legible, and free of emoji glyphs", () => {
    expect(playerCard).toContain('minHeight: forExport ? 40 : 26');
    expect(playerCard).toContain('fontSize: forExport ? 19 : 11');
    expect(playerCard).toContain('whiteSpace: "normal"');
    expect(playerCard).toContain('overflowWrap: "anywhere"');
    expect(performanceStats).toContain('label: "Giant Killer"');
    expect(performanceStats).toContain('`${section.name} Champion`');
    expect(performanceStats).not.toContain('label: "⚡ Giant Killer"');
  });
});
