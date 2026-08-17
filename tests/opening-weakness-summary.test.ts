import { describe, expect, it } from "vitest";
import type { Insight } from "../shared/prepTypes";
import {
  buildOpeningWeaknessFallback,
  buildOpeningWeaknessPrompt,
  gamesForSelectedWeakness,
  normalizeOpeningWeaknessSummary,
} from "../client/src/lib/openingWeaknessSummary";

const weakness: Insight = {
  id: "weakness-1",
  kind: "weakness",
  color: "black",
  claim: "Against 1.e4, they drift into passive setups after 1...g6.",
  interpretation: "Their replies concede space early.",
  recommendation: { action: "Claim the center before they complete development." },
  confidence: "medium",
  sampleSize: 18,
  evidence: {
    stat: "11 of 18 games",
    games: [],
    window: { from: "2025-01-01", to: "2025-05-01", timeClasses: ["rapid"], ratedOnly: true },
  },
};

describe("Opening Forecast weakness summary", () => {
  it("builds an AI prompt from only verified weakness evidence", () => {
    const prompt = buildOpeningWeaknessPrompt({
      opponentUsername: "opponent",
      opponentColor: "black",
      weaknesses: [weakness],
    });

    expect(prompt?.system).toContain("You are a chess coach");
    expect(prompt?.user).toContain(weakness.claim);
    expect(prompt?.user).toContain(weakness.recommendation.action);
    expect(prompt?.user).toContain("sample 18");
    expect(prompt?.user).toContain("Never");
  });

  it("uses a clear evidence-only fallback when the model is unavailable", () => {
    expect(buildOpeningWeaknessFallback({
      opponentUsername: "opponent",
      opponentColor: "black",
      weaknesses: [weakness],
    })).toContain(weakness.claim);
  });

  it("does not invent a weakness when the forecast has no qualifying evidence", () => {
    expect(buildOpeningWeaknessPrompt({
      opponentUsername: "opponent",
      opponentColor: "white",
      weaknesses: [],
    })).toBeNull();
    expect(buildOpeningWeaknessFallback({
      opponentUsername: "opponent",
      opponentColor: "white",
      weaknesses: [],
    })).toContain("No reliable opening weakness");
  });

  it("normalizes concise model output and rejects unbounded output", () => {
    expect(normalizeOpeningWeaknessSummary("• **Weakness:** Claim the center early.")).toBe("Weakness: Claim the center early.");
    expect(normalizeOpeningWeaknessSummary("x".repeat(421))).toBeNull();
  });

  it("returns only the source games for the selected evidence-backed weakness", () => {
    expect(gamesForSelectedWeakness([weakness], weakness.id)).toEqual(weakness.evidence.games);
    expect(gamesForSelectedWeakness([weakness], "missing")).toEqual([]);
    expect(gamesForSelectedWeakness([weakness], null)).toEqual([]);
  });
});
