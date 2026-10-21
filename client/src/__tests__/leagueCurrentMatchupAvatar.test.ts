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
const playerOverviewMatchupSource = dashboardSource.slice(
  dashboardSource.indexOf("{/* Your Match This Week */}"),
  dashboardSource.indexOf("{!myMatchThisWeek && league.status === \"active\"")
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

  it("gives the live player Overview a responsive head-to-head avatar treatment", () => {
    expect(playerOverviewMatchupSource).toContain('className="league-matchup-card rounded-2xl overflow-hidden"');
    expect(playerOverviewMatchupSource).toContain('sizeClass="h-16 w-16 sm:h-[4.5rem] sm:w-[4.5rem]"');
    expect(dashboardSource).toContain('className="flex flex-col items-stretch gap-4 lg:flex-row lg:items-start"');
    expect(playerOverviewMatchupSource).toContain('className="truncate text-[15px] font-black leading-tight sm:text-lg"');
    expect(playerOverviewMatchupSource).toContain("size={18}");
    expect(playerOverviewMatchupSource).toContain("WHITE");
    expect(playerOverviewMatchupSource).toContain("BLACK");
    expect(playerOverviewMatchupSource).toContain("currentMatchWhiteRating.toLocaleString()");
    expect(playerOverviewMatchupSource).toContain("currentMatchBlackRating.toLocaleString()");
    expect(playerOverviewMatchupSource).toContain("Open ${myMatchThisWeek.playerWhiteName}'s League profile");
    expect(playerOverviewMatchupSource).toContain("Open ${myMatchThisWeek.playerBlackName}'s League profile");
  });

  it("shows only completed real-game head-to-head data between the current opponents", () => {
    expect(dashboardSource).toContain("function getHeadToHeadSummary(matches: LeagueMatch[], whitePlayerId: string, blackPlayerId: string)");
    expect(dashboardSource).toContain('match.resultStatus !== "completed" || !match.result');
    expect(dashboardSource).toContain("const currentMatchHeadToHead = myMatchThisWeek");
    expect(playerOverviewMatchupSource).toContain('data-testid="league-player-head-to-head"');
    expect(playerOverviewMatchupSource).toContain("currentMatchHeadToHead.total > 0");
    expect(playerOverviewMatchupSource).toContain("Head to head");
    expect(playerOverviewMatchupSource).toContain("currentMatchHeadToHead.whiteWins / currentMatchHeadToHead.total");
    expect(playerOverviewMatchupSource).toContain("currentMatchHeadToHead.draws / currentMatchHeadToHead.total");
    expect(playerOverviewMatchupSource).toContain("currentMatchHeadToHead.blackWins / currentMatchHeadToHead.total");
  });
});
