import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const read = (relativePath: string) => readFileSync(resolve(root, relativePath), "utf8");

const dashboard = read("client/src/pages/ClubDashboard.tsx");
const api = read("client/src/lib/clubsApi.ts");
const server = read("server/clubs.ts");
const tournamentServer = read("server/index.ts");
const service = read("server/clubTournamentLeaderboard.ts");
const schema = read("shared/schema.ts");

describe("Club tournament leaderboard contracts", () => {
  it("replaces the Members Battle surface with exactly the three primary tabs", () => {
    expect(dashboard).toContain('["members", "leaderboard", ...(isOwnerOrDirector ? ["attendance"] : [])]');
    expect(dashboard).toContain('membersSubTab === "leaderboard"');
    expect(dashboard).not.toContain('setMembersSubTab("battles")');
    expect(dashboard).not.toContain('Record Battle Modal');
    expect(dashboard).not.toContain('create-battle-form');
  });

  it("uses a private Club leaderboard read path and owner/director-only rebuild route", () => {
    expect(api).toContain("apiGetClubTournamentLeaderboard");
    expect(api).toContain("apiReconcileClubTournamentLeaderboard");
    expect(server).toContain('clubsRouter.get("/:id/leaderboard", requireFullAuth');
    expect(server).toContain('clubsRouter.post("/:id/leaderboard/reconcile", requireFullAuth');
    expect(server).toContain("Only club owners and directors can reconcile tournament standings");
    expect(server).not.toContain("req.body.points");
  });

  it("materializes completed linked tournament state into an idempotent immutable ledger", () => {
    expect(schema).toContain('mysqlTable(\n  "club_tournament_score_entries"');
    expect(schema).toContain('uniqueTournamentMember: uniqueIndex("ctse_club_tournament_member_uniq")');
    expect(service).toContain("canonicalizeClubEventType(event.eventType, event.tournamentId) !== \"tournament\"");
    expect(service).toContain("eq(clubTournamentScoreEntries.tournamentId, tournamentId)");
    expect(service).toContain("await tx.delete(clubTournamentScoreEntries)");
    expect(service).toContain("await tx.insert(clubTournamentScoreEntries).values(entries)");
    expect(tournamentServer).toContain("await materializeClubTournamentScores(id, finalState)");
  });

  it("ranks by tournament points first and hides departed members from the active roster", () => {
    expect(service).toContain("right.totalPoints - left.totalPoints");
    expect(service).toContain("right.totalWins - left.totalWins");
    expect(service).toContain("const member = membersById.get(score.memberUserId)");
    expect(service).toContain("if (!member) continue;");
    expect(service).toContain("entry.memberUserId === viewerUserId");
  });
});
