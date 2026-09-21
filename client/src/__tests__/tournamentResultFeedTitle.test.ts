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

  it("keeps a completed result card to one title and one date marker", () => {
    expect(clubDashboardSource).toContain('event.type !== "tournament_completed" && <span className="pt-0.5 text-xs sm:pt-1"');
    expect(clubDashboardSource).toContain('event.type !== "tournament_completed" && (\n            <div className="mt-1 flex items-center gap-1.5 text-xs sm:text-sm"');
    expect(clubDashboardSource).not.toContain('<span className="font-medium">{eventKind}</span>\n            {event.type !== "tournament_completed"');
  });

  it("uses the same responsive h2 scale as Club Overview activity titles", () => {
    expect(clubDashboardSource).toContain('<h2 className="text-base font-bold leading-5 sm:text-lg sm:leading-6" style={{ color: completedResultAccent }}>');
    expect(clubDashboardSource).toContain('const completedResultAccent = isDark ? "oklch(0.84 0.15 80)" : "oklch(0.45 0.13 80)";');
    expect(clubDashboardSource).toContain('<h2 className="text-base font-bold leading-5 sm:text-lg sm:leading-6" style={{ color: primaryText }}>');
  });
});
