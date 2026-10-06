import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
}));

vi.mock("../server/db.js", () => ({ getDb: mocks.getDb }));

import {
  getClubTournamentLeaderboard,
  materializeClubTournamentScores,
} from "../server/clubTournamentLeaderboard";

function queryBuilder<T>(result: T) {
  const builder = {
    from: () => builder,
    where: () => builder,
    limit: () => Promise.resolve(result),
    then: (resolve: (value: T) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(result).then(resolve, reject),
  };
  return builder;
}

function ledgerRow(overrides: Partial<{
  id: string;
  clubId: string;
  tournamentId: string;
  memberUserId: string;
  chesscomUsername: string;
  playerName: string;
  avatarUrl: string | null;
  points: string;
  wins: number;
  draws: number;
  losses: number;
  finalRank: number;
  finalizedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}> = {}) {
  const timestamp = new Date("2026-10-05T20:00:00.000Z");
  return {
    id: "ledger-1",
    clubId: "club-1",
    tournamentId: "tournament-1",
    memberUserId: "member-1",
    chesscomUsername: "alpha",
    playerName: "Alpha",
    avatarUrl: null,
    points: "2",
    wins: 2,
    draws: 0,
    losses: 1,
    finalRank: 1,
    finalizedAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}

describe("Club tournament score ledger", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("writes a completed linked tournament as a replaceable member-only points snapshot", async () => {
    const deleteWhere = vi.fn().mockResolvedValue(undefined);
    const insertValues = vi.fn().mockResolvedValue(undefined);
    const tx = {
      delete: vi.fn(() => ({ where: deleteWhere })),
      insert: vi.fn(() => ({ values: insertValues })),
    };
    const db = {
      select: vi.fn()
        .mockReturnValueOnce(queryBuilder([{ clubId: "club-1", eventType: "tournament", tournamentId: "tournament-1" }]))
        .mockReturnValueOnce(queryBuilder([{
          userId: "member-1",
          displayName: "Alpha",
          chesscomUsername: "Alpha",
          avatarUrl: "https://example.test/alpha.png",
        }])),
      transaction: vi.fn(async (callback: (transaction: typeof tx) => Promise<void>) => callback(tx)),
    };
    mocks.getDb.mockResolvedValue(db);

    const result = await materializeClubTournamentScores("tournament-1", {
      status: "completed",
      players: [
        { username: "ALPHA", name: "Alpha", points: 2, wins: 2, draws: 0, losses: 1 },
        { username: "visitor", name: "Visitor", points: 3, wins: 3 },
      ],
    });

    expect(result).toMatchObject({
      clubId: "club-1",
      tournamentId: "tournament-1",
      status: "materialized",
      entriesWritten: 1,
      matchedPlayers: 1,
      unmatchedUsernames: ["visitor"],
    });
    expect(deleteWhere).toHaveBeenCalledOnce();
    expect(insertValues).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({
        clubId: "club-1",
        tournamentId: "tournament-1",
        memberUserId: "member-1",
        chesscomUsername: "alpha",
        points: "2",
        wins: 2,
      }),
    ]));
  });

  it("does not write scores for standalone or unfinished tournaments", async () => {
    const db = {
      select: vi.fn().mockReturnValueOnce(queryBuilder([])),
      transaction: vi.fn(),
    };
    mocks.getDb.mockResolvedValue(db);

    await expect(materializeClubTournamentScores("standalone", { status: "completed", players: [] }))
      .resolves.toMatchObject({ status: "skipped", reason: "not_linked", entriesWritten: 0 });
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("ranks active Club members by total points with deterministic competition ranks", async () => {
    const db = {
      select: vi.fn()
        .mockReturnValueOnce(queryBuilder([
          { userId: "member-a", displayName: "Alpha", avatarUrl: null },
          { userId: "member-b", displayName: "Bravo", avatarUrl: null },
          { userId: "member-c", displayName: "Charlie", avatarUrl: null },
        ]))
        .mockReturnValueOnce(queryBuilder([
          ledgerRow({ id: "a-1", memberUserId: "member-a", points: "2", wins: 2 }),
          ledgerRow({ id: "a-2", tournamentId: "tournament-2", memberUserId: "member-a", points: "1", wins: 1 }),
          ledgerRow({ id: "b-1", memberUserId: "member-b", points: "3", wins: 4 }),
          ledgerRow({ id: "c-1", memberUserId: "member-c", points: "1", wins: 1 }),
          ledgerRow({ id: "departed", memberUserId: "former-member", points: "99", wins: 99 }),
        ])),
    };
    mocks.getDb.mockResolvedValue(db);

    const result = await getClubTournamentLeaderboard("club-1", "member-b");

    expect(result.completedTournamentsCount).toBe(2);
    expect(result.playersRankedCount).toBe(3);
    expect(result.entries.map((entry) => [entry.memberUserId, entry.rank, entry.totalPoints, entry.isViewer])).toEqual([
      ["member-b", 1, 3, true],
      ["member-a", 1, 3, false],
      ["member-c", 3, 1, false],
    ]);
    expect(result.entries[1]).toMatchObject({ totalWins: 3, tournamentsPlayed: 2 });
  });
});
