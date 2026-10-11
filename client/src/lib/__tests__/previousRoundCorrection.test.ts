import { describe, expect, it } from "vitest";
import {
  applyPreviousRoundCorrection,
  getPreviousRoundCorrectionEligibility,
  type DirectorState,
} from "@/lib/directorState";
import type { Player } from "@/lib/tournamentData";
import type { QuadSection } from "@/lib/quads";

function player(id: string, elo: number): Player {
  return {
    id,
    name: `Player ${id}`,
    username: `player-${id}`,
    country: "US",
    elo,
    pairingRating: elo,
    ratingSource: "manual",
    points: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    buchholz: 0,
    colorHistory: [],
  };
}

const roster = [player("p1", 1800), player("p2", 1700), player("p3", 1600), player("p4", 1500)];

function baseSwissState(overrides: Partial<DirectorState> = {}): DirectorState {
  return {
    tournamentId: "correction-swiss",
    tournamentName: "Correction Swiss",
    totalRounds: 3,
    format: "swiss",
    status: "in_progress",
    currentRound: 2,
    roundMinutes: 25,
    players: roster,
    rounds: [
      {
        number: 1,
        status: "completed",
        games: [
          { id: "r1b1", round: 1, board: 1, whiteId: "p1", blackId: "p4", result: "1-0" },
          { id: "r1b2", round: 1, board: 2, whiteId: "p2", blackId: "p3", result: "1-0" },
        ],
      },
      {
        number: 2,
        status: "in_progress",
        games: [
          { id: "r2b1", round: 2, board: 1, whiteId: "p1", blackId: "p2", result: "*" },
          { id: "r2b2", round: 2, board: 2, whiteId: "p3", blackId: "p4", result: "*" },
        ],
      },
    ],
    ...overrides,
  };
}

describe("previous-round result correction", () => {
  it("allows only the immediately prior completed round while the active round is clean", () => {
    const eligibility = getPreviousRoundCorrectionEligibility(baseSwissState());

    expect(eligibility).toEqual({
      eligible: true,
      correctionRoundNumber: 1,
      pairingRegenerationRequired: true,
    });
  });

  it("atomically corrects a prior result, rescoring standings and replacing the active Swiss pairings", () => {
    const outcome = applyPreviousRoundCorrection(
      baseSwissState(),
      { r1b1: "0-1" },
      { id: "director-1", displayName: "Director" },
      new Date("2026-10-11T00:00:00.000Z"),
    );

    expect(outcome.applied).toBe(true);
    if (!outcome.applied) return;

    expect(outcome.correctedRoundNumber).toBe(1);
    expect(outcome.regeneratedRoundNumber).toBe(2);
    expect(outcome.pairingRegenerated).toBe(true);
    expect(outcome.changedGameCount).toBe(1);
    expect(outcome.state.rounds.find((round) => round.number === 1)?.games[0].result).toBe("0-1");
    expect(outcome.state.rounds.find((round) => round.number === 2)?.games).toEqual(
      expect.arrayContaining([expect.objectContaining({ round: 2, result: "*" })]),
    );
    expect(outcome.state.players.find((candidate) => candidate.id === "p4")?.points).toBe(1);
    expect(outcome.state.players.find((candidate) => candidate.id === "p1")?.points).toBe(0);
    expect(outcome.state.resultHistory?.at(-1)).toEqual(expect.objectContaining({
      gameId: "r1b1",
      round: 1,
      action: "corrected",
      actorName: "Director",
      previousResult: "1-0",
      newResult: "0-1",
    }));
  });

  it("locks the prior round once a standard active-round board has been recorded", () => {
    const state = baseSwissState({
      rounds: baseSwissState().rounds.map((round) => round.number === 2
        ? { ...round, games: [{ ...round.games[0], result: "1-0" }, round.games[1] ] }
        : round,
      ),
    });

    expect(getPreviousRoundCorrectionEligibility(state)).toEqual(expect.objectContaining({
      eligible: false,
      reason: expect.stringContaining("already has recorded boards"),
    }));
  });

  it("regenerates both games per board for Double Swiss after a correction", () => {
    const state = baseSwissState({
      format: "doubleswiss",
      rounds: [
        {
          number: 1,
          status: "completed",
          games: [
            { id: "d-r1b1a", round: 1, board: 1, gameIndex: 0, whiteId: "p1", blackId: "p4", result: "1-0" },
            { id: "d-r1b1b", round: 1, board: 1, gameIndex: 1, whiteId: "p4", blackId: "p1", result: "0-1" },
            { id: "d-r1b2a", round: 1, board: 2, gameIndex: 0, whiteId: "p2", blackId: "p3", result: "1-0" },
            { id: "d-r1b2b", round: 1, board: 2, gameIndex: 1, whiteId: "p3", blackId: "p2", result: "0-1" },
          ],
        },
        {
          number: 2,
          status: "in_progress",
          games: [
            { id: "stale-a", round: 2, board: 1, gameIndex: 0, whiteId: "p1", blackId: "p2", result: "*" },
            { id: "stale-b", round: 2, board: 1, gameIndex: 1, whiteId: "p2", blackId: "p1", result: "*" },
          ],
        },
      ],
    });

    const outcome = applyPreviousRoundCorrection(state, { "d-r1b1a": "0-1" });

    expect(outcome.applied).toBe(true);
    if (!outcome.applied) return;
    const regeneratedGames = outcome.state.rounds.find((round) => round.number === 2)?.games ?? [];
    expect(regeneratedGames).toHaveLength(4);
    expect(regeneratedGames.map((game) => game.gameIndex).sort()).toEqual([0, 0, 1, 1]);
    expect(regeneratedGames.every((game) => game.result === "*")).toBe(true);
  });

  it("refreshes the next unreported Round Robin board assignment from corrected standings", () => {
    const outcome = applyPreviousRoundCorrection(
      baseSwissState({ format: "roundrobin" }),
      { r1b1: "0-1" },
    );

    expect(outcome.applied).toBe(true);
    if (!outcome.applied) return;
    expect(outcome.pairingRegenerated).toBe(true);
    expect(outcome.state.rounds.find((round) => round.number === 2)?.games).toEqual(
      expect.arrayContaining([expect.objectContaining({ round: 2, result: "*" })]),
    );
  });

  it("rebuilds an unreported elimination final from corrected semifinal winners", () => {
    const state = baseSwissState({
      format: "elimination",
      totalRounds: 2,
      rounds: [
        {
          number: 1,
          status: "completed",
          games: [
            { id: "semi-1", round: 1, board: 1, whiteId: "p1", blackId: "p4", result: "1-0" },
            { id: "semi-2", round: 1, board: 2, whiteId: "p2", blackId: "p3", result: "1-0" },
          ],
        },
        {
          number: 2,
          status: "in_progress",
          games: [{ id: "stale-final", round: 2, board: 1, whiteId: "p1", blackId: "p2", result: "*" }],
        },
      ],
    });

    const outcome = applyPreviousRoundCorrection(state, { "semi-1": "0-1" });

    expect(outcome.applied).toBe(true);
    if (!outcome.applied) return;
    expect(outcome.state.rounds.find((round) => round.number === 2)?.games).toEqual([
      expect.objectContaining({ round: 2, whiteId: "p4", blackId: "p2", result: "*" }),
    ]);
  });

  it("re-seeds the first Swiss-elimination bracket round from corrected cutoff standings", () => {
    const state = baseSwissState({
      format: "swiss_elim",
      swissRounds: 1,
      elimPhase: "elimination",
      elimCutoff: 4,
      elimPlayers: roster,
      totalRounds: 3,
      rounds: [
        {
          number: 1,
          status: "completed",
          games: [
            { id: "swiss-1", round: 1, board: 1, whiteId: "p1", blackId: "p4", result: "1-0" },
            { id: "swiss-2", round: 1, board: 2, whiteId: "p2", blackId: "p3", result: "1-0" },
          ],
        },
        {
          number: 2,
          status: "in_progress",
          games: [{ id: "stale-bracket", round: 2, board: 1, whiteId: "p1", blackId: "p2", result: "*" }],
        },
      ],
    });

    const outcome = applyPreviousRoundCorrection(state, { "swiss-1": "0-1" });

    expect(outcome.applied).toBe(true);
    if (!outcome.applied) return;
    expect(outcome.state.elimPlayers).toHaveLength(4);
    expect(outcome.state.rounds.find((round) => round.number === 2)?.games).toEqual(
      expect.arrayContaining([expect.objectContaining({ round: 2, result: "*" })]),
    );
  });

  it("keeps Quads board assignments fixed while accepting a one-round-back correction", () => {
    const section: QuadSection = {
      id: "quad-1",
      name: "Quad 1",
      type: "quad",
      orderIndex: 0,
      ratingMin: 1500,
      ratingMax: 1800,
      playerIds: roster.map((candidate) => candidate.id),
      localSeeds: { p1: 1, p2: 2, p3: 3, p4: 4 },
      status: "in_progress",
    };
    const state = baseSwissState({
      tournamentId: "correction-quads",
      format: "quads",
      totalRounds: 3,
      quadSections: [section],
      rounds: [
        {
          number: 1,
          status: "completed",
          games: [
            { id: "q1r1b1", round: 1, board: 1, whiteId: "p1", blackId: "p4", result: "1-0", sectionId: "quad-1" },
            { id: "q1r1b2", round: 1, board: 2, whiteId: "p2", blackId: "p3", result: "1-0", sectionId: "quad-1" },
          ],
        },
        {
          number: 2,
          status: "in_progress",
          games: [
            { id: "q1r2b1", round: 2, board: 1, whiteId: "p3", blackId: "p1", result: "0-1", sectionId: "quad-1" },
            { id: "q1r2b2", round: 2, board: 2, whiteId: "p4", blackId: "p2", result: "*", sectionId: "quad-1" },
          ],
        },
      ],
    });

    const outcome = applyPreviousRoundCorrection(state, { q1r1b1: "0-1" });

    expect(outcome.applied).toBe(true);
    if (!outcome.applied) return;
    expect(outcome.pairingRegenerated).toBe(false);
    expect(outcome.state.rounds.find((round) => round.number === 2)?.games).toEqual(state.rounds[1].games);
  });

  it("does not expose an edit path during Round 1 or after tournament completion", () => {
    expect(getPreviousRoundCorrectionEligibility(baseSwissState({ currentRound: 1 }))).toEqual(expect.objectContaining({
      eligible: false,
      reason: expect.stringContaining("after Round 2"),
    }));
    expect(getPreviousRoundCorrectionEligibility(baseSwissState({ status: "completed" }))).toEqual(expect.objectContaining({
      eligible: false,
      reason: expect.stringContaining("while the tournament is active"),
    }));
  });
});
