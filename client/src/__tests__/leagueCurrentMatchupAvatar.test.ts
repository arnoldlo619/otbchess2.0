import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(
  resolve(import.meta.dirname, "../pages/LeagueDashboard.tsx"),
  "utf8"
);
const currentMatchupSource = dashboardSource.slice(
  dashboardSource.indexOf("/* ── Current Matchup Hero"),
  dashboardSource.indexOf("/* H2H Record strip */")
);

describe("League current matchup Chess.com avatars", () => {
  it("uses the shared cached Chess.com avatar source for the active matchup", () => {
    expect(dashboardSource).toContain("const { avatars: allPlayerChesscomAvatars, allLoaded: allAvatarsLoaded } = useChessAvatars(allPlayerChesscomUsernames)");
    expect(dashboardSource).not.toContain("matchupChesscomAvatars");
    expect(dashboardSource).not.toContain("matchupChesscomUsernames");
  });

  it("prioritizes Chess.com photos, reserves loading space, and keeps stored avatars as fallback", () => {
    expect(currentMatchupSource).toContain("chesscomUrl={getChesscomAvatar(whitePlayer?.chesscomUsername)}");
    expect(currentMatchupSource).toContain("loading={isChesscomAvatarLoading(whitePlayer?.chesscomUsername)}");
    expect(currentMatchupSource).toContain("url={whitePlayer?.avatarUrl}");
    expect(currentMatchupSource).toContain("chesscomUrl={getChesscomAvatar(blackPlayer?.chesscomUsername)}");
    expect(currentMatchupSource).toContain("loading={isChesscomAvatarLoading(blackPlayer?.chesscomUsername)}");
    expect(currentMatchupSource).toContain("url={blackPlayer?.avatarUrl}");
  });

  it("renders a contained object-fit profile image before initials fallback", () => {
    expect(dashboardSource).toContain("const resolvedUrl = chesscomUrl ?? url ?? null;");
    expect(dashboardSource).toContain("rounded-full object-cover flex-shrink-0");
    expect(dashboardSource).toContain('aria-label="Loading avatar"');
  });
});
