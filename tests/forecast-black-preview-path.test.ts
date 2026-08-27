import { describe, expect, it } from "vitest";
import { forecast } from "../server/prep/facts";
import type { ParsedGame } from "../shared/prepTypes";

function blackGame(): ParsedGame {
  const sans = ["e4", "d5", "exd5", "Qxd5", "Nc3", "Qd8", "d4", "Nf6", "Nf3", "e6"];
  return {
    provider: "chesscom",
    url: "https://www.chess.com/game/live/example",
    rated: true,
    rules: "chess",
    timeClass: "rapid",
    endTime: 1_700_000_000,
    white: { name: "WhitePlayer", rating: 1600, result: "draw" },
    black: { name: "Opponent", rating: 1600, result: "draw" },
    result: "1/2-1/2",
    sans,
    plies: sans.map((san, index) => ({ san, epd: `position-${index}`, by: index % 2 === 0 ? "white" : "black" })),
    fullMoves: 5,
    opening: { eco: "B01", name: "Scandinavian Defense", bookExitPly: 2 },
    scoutedColor: "black",
    scoutedScore: 0.5,
  };
}

describe("black-side Opening Forecast previews", () => {
  it("starts from White's legal first move before the opponent's Black response", () => {
    const branches = forecast([blackGame(), blackGame(), blackGame()], "black");

    expect(branches[0]).toMatchObject({ moveSan: "e4", actor: "user", previewPath: ["e4"] });
    expect(branches[0]?.children[0]).toMatchObject({ moveSan: "d5", actor: "opponent", previewPath: ["e4", "d5"] });
  });
});
