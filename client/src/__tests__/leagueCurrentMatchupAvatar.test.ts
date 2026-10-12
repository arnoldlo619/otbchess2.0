import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(
  resolve(import.meta.dirname, "../pages/LeagueDashboard.tsx"),
  "utf8"
);
const matchCardSource = dashboardSource.slice(
  dashboardSource.indexOf("{/* Match cards */}"),
  dashboardSource.indexOf("{/* Appears only after the Commissioner")
);

describe("League report card Chess.com avatars", () => {
  it("uses the shared cached Chess.com avatar source for the active matchup", () => {
    expect(dashboardSource).toContain("const { avatars: allPlayerChesscomAvatars, allLoaded: allAvatarsLoaded } = useChessAvatars(allPlayerChesscomUsernames)");
    expect(dashboardSource).not.toContain("matchupChesscomAvatars");
    expect(dashboardSource).not.toContain("matchupChesscomUsernames");
  });

  it("prioritizes Chess.com photos, reserves loading space, and keeps stored avatars as fallback", () => {
    expect(matchCardSource).toContain("chesscomUrl={getChesscomAvatar(league.players.find(p => p.playerId === match.playerWhiteId)?.chesscomUsername)}");
    expect(matchCardSource).toContain("loading={isChesscomAvatarLoading(league.players.find(p => p.playerId === match.playerWhiteId)?.chesscomUsername)}");
    expect(matchCardSource).toContain("url={league.players.find(p => p.playerId === match.playerWhiteId)?.avatarUrl}");
    expect(matchCardSource).toContain("chesscomUrl={getChesscomAvatar(league.players.find(p => p.playerId === match.playerBlackId)?.chesscomUsername)}");
    expect(matchCardSource).toContain("loading={isChesscomAvatarLoading(league.players.find(p => p.playerId === match.playerBlackId)?.chesscomUsername)}");
    expect(matchCardSource).toContain("url={league.players.find(p => p.playerId === match.playerBlackId)?.avatarUrl}");
  });

  it("renders a contained object-fit profile image before initials fallback", () => {
    expect(dashboardSource).toContain("const resolvedUrl = chesscomUrl ?? url ?? null;");
    expect(dashboardSource).toContain("rounded-full object-cover flex-shrink-0");
    expect(dashboardSource).toContain('aria-label="Loading avatar"');
  });
});
