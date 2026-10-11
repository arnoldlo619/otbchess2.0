import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const directorSource = readFileSync(resolve(process.cwd(), "client/src/pages/Director.tsx"), "utf8");
const correctionModalSource = readFileSync(
  resolve(process.cwd(), "client/src/components/tournament/PreviousRoundCorrectionModal.tsx"),
  "utf8",
);
const directorStateSource = readFileSync(resolve(process.cwd(), "client/src/lib/directorState.ts"), "utf8");

describe("Director previous-round correction experience", () => {
  it("provides a clearly named, guarded Director entry point", () => {
    expect(directorSource).toContain("Correct Round {previousRoundCorrection.correctionRoundNumber}");
    expect(directorSource).toContain("Previous round locked");
    expect(directorSource).toContain("getPreviousRoundCorrectionEligibility(state)");
    expect(directorSource).toContain("<PreviousRoundCorrectionModal");
  });

  it("explains the pairing consequence before the correction is applied", () => {
    expect(correctionModalSource).toContain("Previous round only");
    expect(correctionModalSource).toContain("pairings using these corrected results");
    expect(correctionModalSource).toContain("Quad boards stay assigned; section standings update");
    expect(correctionModalSource).toContain("Older rounds stay locked");
    expect(correctionModalSource).toContain("Apply correction");
  });

  it("keeps the mutation limited to one round back and protects active results", () => {
    expect(directorStateSource).toContain("const correctionRoundNumber = state.currentRound - 1;");
    expect(directorStateSource).toContain("state.format !== \"quads\"");
    expect(directorStateSource).toContain("already has recorded boards, so its pairings can no longer be safely regenerated");
    expect(directorStateSource).toContain("applyPreviousRoundCorrection");
    expect(directorStateSource).toContain("rescorePlayersFromCompletedRounds");
  });

  it("syncs regenerated board assignments to live player views without sending a false round-start notification", () => {
    const correctionHandler = directorSource.slice(
      directorSource.indexOf("const applyPreviousRoundCorrection"),
      directorSource.indexOf("// Board assignment editing state"),
    );

    expect(correctionHandler).toContain("flushStateToServer(outcome.state)");
    expect(correctionHandler).toContain("/api/tournament/${encodeURIComponent(tournamentId)}/round");
    expect(correctionHandler).not.toContain("broadcastRoundStart");
  });
});
