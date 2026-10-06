import { describe, expect, it } from "vitest";
import { renderLeagueSeasonCard } from "../server/leagueSeasonCard";

const season = {
  leagueName: "Downtown Autumn League",
  clubName: "The OTB Chess Club",
  formatType: "round_robin",
  totalWeeks: 7,
  totalMatches: 21,
  champion: {
    rank: 1,
    displayName: "Maya Chen",
    points: 6,
    wins: 6,
    draws: 0,
    losses: 1,
  },
  standings: [
    { rank: 1, displayName: "Maya Chen", points: 6, wins: 6, draws: 0, losses: 1 },
    { rank: 2, displayName: "Elias Hart", points: 5.5, wins: 5, draws: 1, losses: 1 },
    { rank: 3, displayName: "Priya Rao", points: 4, wins: 4, draws: 0, losses: 3 },
    { rank: 4, displayName: "Jon Bell", points: 3.5, wins: 3, draws: 1, losses: 3 },
  ],
};

describe("League season card renderer", () => {
  it("renders a 1200×630 PNG with champion and final standings data", () => {
    const png = renderLeagueSeasonCard(season);

    expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    expect(png.readUInt32BE(16)).toBe(1200);
    expect(png.readUInt32BE(20)).toBe(630);
    expect(png.length).toBeGreaterThan(10_000);
  });

  it("renders a deterministic image for the same completed season", () => {
    const first = renderLeagueSeasonCard(season);
    const second = renderLeagueSeasonCard(season);

    expect(second.equals(first)).toBe(true);
  });
});
