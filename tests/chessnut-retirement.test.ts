import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(resolve(process.cwd(), "client/src/App.tsx"), "utf8");
const controlSource = readFileSync(resolve(process.cwd(), "client/src/pages/BroadcastControl.tsx"), "utf8");
const consoleSource = readFileSync(resolve(process.cwd(), "client/src/pages/BroadcastConsole.tsx"), "utf8");
const broadcastSource = readFileSync(resolve(process.cwd(), "server/broadcasts.ts"), "utf8");

describe("Chessnut feature retirement", () => {
  it("removes device routes and browser source modes", () => {
    expect(appSource).not.toContain("connect-board");
    expect(appSource).not.toContain("ChessnutTestLab");
    expect(controlSource).not.toContain("chessnut_");
    expect(consoleSource).not.toContain("chessnut_");
  });

  it("keeps broadcast input restricted to manual and PGN modes", () => {
    expect(broadcastSource).toContain('const validSources = ["manual", "pgn_import"]');
    expect(broadcastSource).not.toContain("bridge-move");
    expect(broadcastSource).not.toContain("bridge-heartbeat");
    expect(broadcastSource).not.toContain("token-regenerate");
  });
});
