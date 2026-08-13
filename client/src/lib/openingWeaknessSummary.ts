import type { Insight } from "../../../shared/prepTypes";

export interface OpeningWeaknessPrompt {
  system: string;
  user: string;
}

function compact(value: string, limit = 220): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > limit ? `${normalized.slice(0, limit - 1).trimEnd()}…` : normalized;
}

export function buildOpeningWeaknessPrompt(input: {
  opponentUsername: string;
  opponentColor: "white" | "black";
  weaknesses: Insight[];
}): OpeningWeaknessPrompt | null {
  const evidence = input.weaknesses.slice(0, 2).map((insight) => ({
    claim: compact(insight.claim),
    action: compact(insight.recommendation.action),
    sample: insight.sampleSize,
    confidence: insight.confidence,
    stat: compact(insight.evidence.stat, 120),
  }));

  if (evidence.length === 0) return null;

  return {
    system: "You are a chess coach writing a concise opening forecast. Use only the supplied evidence. Never invent moves, evaluation, tactics, or confidence. State uncertainty plainly when evidence is limited.",
    user: [
      `Opponent: ${input.opponentUsername}`,
      `Perspective: opponent playing ${input.opponentColor}.`,
      "Verified weakness evidence:",
      ...evidence.map((item, index) => `${index + 1}. Claim: ${item.claim}\n   Evidence: ${item.stat}; sample ${item.sample}; confidence ${item.confidence}.\n   Practical response: ${item.action}`),
      "Write one short, natural-language coaching paragraph of at most 48 words. Name the clearest opening weakness and the practical response. Never use bullets, headings, percentages beyond the evidence, or any claim absent from the evidence.",
    ].join("\n"),
  };
}

export function buildOpeningWeaknessFallback(input: {
  opponentUsername: string;
  opponentColor: "white" | "black";
  weaknesses: Insight[];
}): string {
  const primary = input.weaknesses[0];
  if (!primary) {
    return `No reliable opening weakness is confirmed for ${input.opponentUsername} as ${input.opponentColor}. Use the forecast as a guide, not a forced target.`;
  }
  return `${primary.claim} ${primary.recommendation.action}`;
}

export function normalizeOpeningWeaknessSummary(value: string): string | null {
  const text = value
    .replace(/^\s*(?:[-•]|\d+[.)])\s*/gm, "")
    .replace(/\*\*/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!text || text.length > 420) return null;
  return text;
}
