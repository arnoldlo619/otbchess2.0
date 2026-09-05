import { describe, expect, it } from "vitest";

import {
  buildScoutBrief,
  classifyFreshness,
  conditionalEvidenceFrequency,
  confidenceForEvidence,
  primaryInsightEligible,
  supportingInsightEligible,
} from "../server/prep/evidencePolicy.js";
import { makeLaunchGames } from "../server/prep/__fixtures__/launchFixtures.js";
import { parseGames } from "../server/prep/parseGames.js";
import type { Insight } from "../shared/prepTypes.js";

const options = { maxGames: 30, months: 24, timeClasses: ["rapid", "blitz", "bullet"], ratedOnly: true };

function insight(kind: Insight["kind"], color: "white" | "black", id = kind): Insight {
  return {
    id,
    kind,
    color,
    role: "plays",
    claim: `${kind} evidence for ${color}`,
    evidence: {
      stat: "8/10 eligible games",
      games: [],
      window: { from: "2026-07-01", to: "2026-08-20", timeClasses: ["rapid"], ratedOnly: true },
    },
    interpretation: "Observed only in eligible games.",
    recommendation: { action: "Rehearse the legal line shown in this report.", line: { san: "1. e4 e5", validated: true } },
    confidence: "medium",
    sampleSize: 8,
  };
}

describe("centralized Matchup Prep evidence policy", () => {
  it("assigns confidence from the shared effective sample policy", () => {
    const now = Math.floor(Date.now() / 1000);
    const { parsed: six } = parseGames(makeLaunchGames({ count: 6 }), "sameplayer", options);
    const { parsed: eight } = parseGames(makeLaunchGames({ count: 8 }), "sameplayer", options);
    const { parsed: twelve } = parseGames(makeLaunchGames({ count: 12 }), "sameplayer", options);
    expect(confidenceForEvidence(six, 0.5, now)).toBe("medium_high");
    expect(confidenceForEvidence(eight, 0.4, now)).toBe("medium_high");
    expect(confidenceForEvidence(twelve, 0.25, now)).toBe("high");
  });

  it("uses the parent position as the only branch denominator", () => {
    expect(conditionalEvidenceFrequency(6, 8)).toEqual({ count: 6, parentCount: 8, ratio: 0.75 });
    expect(conditionalEvidenceFrequency(12, 8)).toEqual({ count: 8, parentCount: 8, ratio: 1 });
    expect(conditionalEvidenceFrequency(0, 0)).toEqual({ count: 0, parentCount: 0, ratio: 0 });
  });

  it("keeps 6–7 game evidence supporting-only and requires 8 for a primary action", () => {
    const six = { ...insight("weakness", "black"), sampleSize: 6 };
    const eight = insight("weakness", "black");
    expect(supportingInsightEligible(six)).toBe(true);
    expect(primaryInsightEligible(six, "usable")).toBe(false);
    expect(primaryInsightEligible(eight, "usable")).toBe(true);
    expect(primaryInsightEligible(eight, "stale")).toBe(false);
  });

  it("uses the exact Strong, Usable, Limited, and Stale freshness boundaries", () => {
    const now = 1_800_000_000;
    const { parsed: twenty } = parseGames(makeLaunchGames({ count: 20 }), "sameplayer", options);
    const strong = twenty.map((game, index) => ({ ...game, endTime: now - (index < 12 ? 60 : 170) * 86_400 }));
    const usable = twenty.slice(0, 8).map((game, index) => ({ ...game, endTime: now - (index + 1) * 40 * 86_400 }));
    const limited = twenty.slice(0, 8).map((game, index) => ({ ...game, endTime: now - (index < 3 ? (index + 1) * 60 : 500) * 86_400 }));
    const stale = twenty.map(game => ({ ...game, endTime: now - 366 * 86_400 }));
    expect(classifyFreshness(strong, now)).toBe("strong");
    expect(classifyFreshness(usable, now)).toBe("usable");
    expect(classifyFreshness(limited, now)).toBe("limited");
    expect(classifyFreshness(stale, now)).toBe("stale");
  });

  it.each(["opening_tendency", "response_pattern", "weakness", "strength", "deviation_point"] as const)(
    "keeps %s actions opponent-centered without a global playing-color prefix",
    kind => {
      const blackAction = buildScoutBrief([insight(kind, "black")], "usable")[0];
      const whiteAction = buildScoutBrief([insight(kind, "white")], "usable")[0];
      expect(blackAction.action.label).not.toMatch(/^With (White|Black),/);
      expect(blackAction.opponentColor).toBe("black");
      expect(whiteAction.action.label).not.toMatch(/^With (White|Black),/);
      expect(whiteAction.opponentColor).toBe("white");
    },
  );
});
