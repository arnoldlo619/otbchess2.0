import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { sortPlayersForQuads, type QuadSettings } from "../lib/quads";
import { normalizeTournamentConfig, type TournamentConfig } from "../lib/tournamentRegistry";
import type { Player } from "../lib/tournamentData";

function makeConfig(overrides: Partial<TournamentConfig> = {}): TournamentConfig {
  return {
    id: "quads-config-test",
    inviteCode: "QTEST123",
    directorCode: "DIR-QTEST",
    name: "Quads Config Test",
    venue: "Club",
    date: "2026-08-22",
    description: "",
    format: "quads",
    rounds: 9,
    maxPlayers: 16,
    timeBase: 10,
    timeIncrement: 5,
    timePreset: "10+5",
    ratingSystem: "chess.com",
    ratingType: "rapid",
    createdAt: "2026-08-22T00:00:00.000Z",
    ...overrides,
  };
}

function makePlayer(id: string, rapidElo: number, blitzElo: number): Player {
  return {
    id,
    name: id,
    username: id,
    elo: rapidElo,
    rapidElo,
    blitzElo,
    platform: "chess.com",
  } as Player;
}

describe("Quads configuration invariants", () => {
  it("normalizes every Quads config to three rounds", () => {
    expect(normalizeTournamentConfig(makeConfig()).rounds).toBe(3);
  });

  it("uses the selected rapid or blitz category as the default Quads seeding source", () => {
    expect(normalizeTournamentConfig(makeConfig({ ratingType: "rapid" })).quadRatingSource).toBe("rapid");
    expect(normalizeTournamentConfig(makeConfig({ ratingType: "blitz" })).quadRatingSource).toBe("blitz");
  });

  it("changes section seeding order when rapid and blitz ratings disagree", () => {
    const players = [makePlayer("Alice", 2100, 1500), makePlayer("Bob", 1600, 2200)];
    const rapid: QuadSettings = {
      ratingSource: "rapid",
      ratingType: "rapid",
      remainderHandling: "bottom_swiss",
      colorAssignment: "deterministic",
      tiebreakOrder: ["score", "sonnebornBerger"],
    };
    const blitz: QuadSettings = { ...rapid, ratingSource: "blitz", ratingType: "blitz" };

    expect(sortPlayersForQuads(players, rapid).map((player) => player.id)).toEqual(["Alice", "Bob"]);
    expect(sortPlayersForQuads(players, blitz).map((player) => player.id)).toEqual(["Bob", "Alice"]);
  });
});

describe("Quads creation and Director wiring", () => {
  const clientRoot = resolve(import.meta.dirname, "..");
  const wizardSource = readFileSync(resolve(clientRoot, "components/TournamentWizard.tsx"), "utf8");
  const directorStateSource = readFileSync(resolve(clientRoot, "lib/directorState.ts"), "utf8");
  const directorSource = readFileSync(resolve(clientRoot, "pages/Director.tsx"), "utf8");

  it("renders fixed rounds in both wizard paths and persists the rating source", () => {
    expect(wizardSource).toContain('format === "quads" ? 3 : rounds');
    expect(wizardSource).toContain('data.format === "quads" ? 3 : data.rounds');
    expect(wizardSource).toContain('{ quadRatingSource: data.ratingType }');
    expect(wizardSource).toContain('if (f.value === "quads") setRounds(3)');
  });

  it("hydrates and updates Quads seeding settings from persisted rapid/blitz selection", () => {
    expect(directorStateSource).toContain('ratingSource: config.quadRatingSource ?? config.ratingType ?? "rapid"');
    expect(directorStateSource).toContain('totalRounds: config.format === "quads" ? 3 : config.rounds');
    expect(directorSource).toContain('quadRatingSource: rt');
    expect(directorSource).toContain('ratingSource: updated.quadRatingSource ?? updated.ratingType ?? "rapid"');
  });
});
