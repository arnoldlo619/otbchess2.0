import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "client/src/components/PlayerProfileSheet.tsx"), "utf8");

describe("Public player profile presentation", () => {
  it("presents a clear identity header with platform-safe external access", () => {
    expect(source).toContain("Player Profile");
    expect(source).toContain("platformLabel = platform === \"chesscom\" ? \"chess.com\" : \"Lichess\"");
    expect(source).toContain("Open ${displayName}'s ${platformLabel} profile");
    expect(source).toContain("rel=\"noopener noreferrer\"");
  });

  it("summarizes only real tournament performance data", () => {
    expect(source).toContain("const tournamentGames = player.wins + player.draws + player.losses");
    expect(source).toContain("const tournamentScoreRate = tournamentGames > 0");
    expect(source).toContain("Event score rate");
    expect(source).toContain("game{tournamentGames === 1 ? \"\" : \"s\"} played");
  });

  it("keeps meaningful image alternative text for player avatars", () => {
    expect(source).toContain("alt={`${displayName} avatar`}");
  });
});
