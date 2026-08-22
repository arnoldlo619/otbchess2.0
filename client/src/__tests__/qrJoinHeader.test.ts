import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const joinSource = readFileSync(resolve(process.cwd(), "client/src/pages/Join.tsx"), "utf8");

describe("QR tournament join header", () => {
  it("does not render the redundant tournament information chip above the QR join heading", () => {
    expect(joinSource).toContain('!isQrMode && step !== "code" && step !== "success"');
    expect(joinSource).toContain('{tournamentDisplay.name || "Join Tournament"}');
  });
});
