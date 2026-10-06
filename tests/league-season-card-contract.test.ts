import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const serverSource = readFileSync(resolve(process.cwd(), "server/leagues.ts"), "utf8");
const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/LeagueDashboard.tsx"), "utf8");

describe("League season card delivery", () => {
  it("exposes a completed-season PNG endpoint backed by first-party standings", () => {
    expect(serverSource).toContain('leaguesRouter.get("/:leagueId/season-card.png"');
    expect(serverSource).toContain('league.status !== "completed"');
    expect(serverSource).toContain("renderLeagueSeasonCard({");
    expect(serverSource).toContain('"Content-Type": "image/png"');
    expect(serverSource).toContain('"Cache-Control": "public, max-age=3600, s-maxage=3600"');
    expect(serverSource).toContain("orderBy(asc(leagueStandings.rank))");
  });

  it("exposes an immutable completed-season player card endpoint", () => {
    expect(serverSource).toContain('leaguesRouter.get("/:leagueId/player-card/:playerId"');
    expect(serverSource).toContain("Player cards are available after the season is complete");
    expect(serverSource).toContain("renderLeaguePlayerCard({");
    expect(serverSource).toContain("Player standing not found");
  });

  it("keeps the share action compact and available only for completed seasons", () => {
    expect(dashboardSource).toContain("Season Summary");
    expect(dashboardSource).toContain("Share Season Card");
    expect(dashboardSource).toContain('league.status === "completed" && standings.length > 0');
    expect(dashboardSource).toContain("sm:flex-row sm:items-center sm:justify-between");
    expect(dashboardSource).toContain("navigator.share");
    expect(dashboardSource).toContain("new File([cardBlob]");
    expect(dashboardSource).toContain("navigator.canShare({ files: [imageFile] })");
    expect(dashboardSource).toContain("navigator.clipboard.writeText(seasonCardUrl)");
    expect(dashboardSource).toContain("/season-card.png");
  });

  it("keeps per-player cards preview-first with download, native sharing, and accessible dismissal", () => {
    expect(dashboardSource).toContain("PlayerSeasonCardPreview");
    expect(dashboardSource).toContain("Preview your season card");
    expect(dashboardSource).toContain("Download Card");
    expect(dashboardSource).toContain("Share Card");
    expect(dashboardSource).toContain("useAccessibleOverlay({");
    expect(dashboardSource).toContain("/player-card/${encodeURIComponent(player.playerId)}");
  });
});
