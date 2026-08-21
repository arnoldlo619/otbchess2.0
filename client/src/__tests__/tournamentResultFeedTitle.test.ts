import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const clubDashboardSource = readFileSync(
  resolve(process.cwd(), "client/src/pages/ClubDashboard.tsx"),
  "utf8",
);
const clubProfileSource = readFileSync(
  resolve(process.cwd(), "client/src/pages/ClubProfile.tsx"),
  "utf8",
);

describe("automated tournament-result feed titles", () => {
  it("uses the tournament name for result-card headers instead of winner-score fallback text", () => {
    expect(clubDashboardSource).toContain("formatTournamentResultFeedTitle(event.tournamentName)");
    expect(clubDashboardSource).toContain("formatTournamentResultDate(event.createdAt)");
    expect(clubDashboardSource).toContain('event.type !== "tournament_completed" && (');
    expect(clubDashboardSource).not.toContain("event.tournamentName ?? event.description");
    expect(clubProfileSource).toContain('event.type === "tournament_completed" ? formatTournamentResultFeedTitle(event.tournamentName) : event.actorName');
  });

  it("does not repeat the automated result post description in the Club Profile card body", () => {
    expect(clubProfileSource).toContain('event.type !== "tournament_completed" && (');
  });
});
