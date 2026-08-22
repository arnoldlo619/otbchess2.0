import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createResultHistoryEntry } from "@/lib/directorState";
import type { Game, Player } from "@/lib/tournamentData";
import type { QuadSection } from "@/lib/quads";
import { ResultAuditTrail } from "./ResultAuditTrail";

const game: Game = {
  id: "quad-1-r1-b1",
  round: 1,
  board: 1,
  whiteId: "alice",
  blackId: "bob",
  result: "*",
  sectionId: "quad-1",
};

const players = [
  { id: "alice", name: "Alice", username: "alice", elo: 1800, platform: "chess.com" },
  { id: "bob", name: "Bob", username: "bob", elo: 1750, platform: "chess.com" },
] as unknown as Player[];

const sections = [{ id: "quad-1", name: "Quad 1", playerIds: ["alice", "bob"] }] as QuadSection[];

describe("createResultHistoryEntry", () => {
  it("records actor, timestamp, game, and Quad section context", () => {
    const entry = createResultHistoryEntry(
      game,
      "1-0",
      { id: "42", displayName: "Club Director" },
      0,
      undefined,
      new Date("2026-08-22T12:00:00.000Z"),
    );

    expect(entry).toMatchObject({
      id: "1787400000000-quad-1-r1-b1-0",
      timestamp: "2026-08-22T12:00:00.000Z",
      gameId: game.id,
      sectionId: "quad-1",
      previousResult: null,
      newResult: "1-0",
      action: "recorded",
      actorId: "42",
      actorName: "Club Director",
    });
  });

  it("distinguishes corrections and explicit undo actions", () => {
    const correctedGame = { ...game, result: "1-0" as const };
    expect(createResultHistoryEntry(correctedGame, "½-½", { id: null, displayName: "" }, 1).action).toBe("corrected");
    expect(createResultHistoryEntry(correctedGame, "*", { id: null, displayName: "" }, 2, { action: "undone" })).toMatchObject({
      action: "undone",
      actorName: "Tournament Director",
      previousResult: "1-0",
      newResult: "*",
    });
  });
});

describe("ResultAuditTrail", () => {
  it("renders section, players, actor, score transition, timestamp, and safe undo action", () => {
    const entry = createResultHistoryEntry(
      { ...game, result: "1-0" },
      "½-½",
      { id: "42", displayName: "Club Director" },
      1,
      undefined,
      new Date("2026-08-22T12:00:00.000Z"),
    );
    const html = renderToStaticMarkup(
      <ResultAuditTrail
        entries={[entry]}
        players={players}
        sections={sections}
        isDark
        canUndo
        undoLabel="Board 1: Draw"
        onUndo={() => undefined}
      />,
    );

    expect(html).toContain("Result activity");
    expect(html).toContain("Corrected ½–½");
    expect(html).toContain("from 1–0");
    expect(html).toContain("Quad 1");
    expect(html).toContain("Alice vs Bob");
    expect(html).toContain("Club Director");
    expect(html).toContain("Undo latest");
    expect(html).toContain('dateTime="2026-08-22T12:00:00.000Z"');
  });

  it("renders nothing before the first result entry", () => {
    expect(renderToStaticMarkup(<ResultAuditTrail entries={[]} players={players} isDark={false} />)).toBe("");
  });

  it("gracefully renders result history saved before actor and action metadata existed", () => {
    const legacyEntry = {
      timestamp: "2026-08-21T12:00:00.000Z",
      round: 1,
      board: 1,
      whiteId: "alice",
      blackId: "bob",
      previousResult: null,
      newResult: "1-0" as const,
    };
    const html = renderToStaticMarkup(
      <ResultAuditTrail entries={[legacyEntry]} players={players} sections={sections} isDark={false} />,
    );

    expect(html).toContain("Recorded 1–0");
    expect(html).toContain("Tournament Director");
    expect(html).toContain("Alice vs Bob");
  });
});

describe("Director Quads result audit integration", () => {
  const directorSource = readFileSync(resolve(import.meta.dirname, "../../pages/Director.tsx"), "utf8");

  it("routes Quads result entry and audit-panel undo through the safe undo hook", () => {
    expect(directorSource).toContain("recordWithUndo(");
    expect(directorSource).toContain("<ResultAuditTrail");
    expect(directorSource).toContain("canUndo={Boolean(undoPending)}");
    expect(directorSource).toContain("undoResult();");
  });
});
