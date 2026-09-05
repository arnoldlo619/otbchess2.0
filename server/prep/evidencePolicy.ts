import type {
  Color,
  Insight,
  ParsedGame,
  ScoutAction,
  ScoutFreshness,
} from "../../shared/prepTypes.js";

const DAY_SECONDS = 86_400;
const RECENT_WINDOW_SECONDS = 90 * DAY_SECONDS;
export const MIN_PRIMARY_EVIDENCE_GAMES = 8;

export function effectiveEvidenceSample(games: ParsedGame[], nowSeconds = Math.floor(Date.now() / 1000)): number {
  return games.reduce(
    (sum, game) => sum + (nowSeconds - game.endTime <= RECENT_WINDOW_SECONDS ? 1.5 : 1),
    0,
  );
}

export function confidenceForEvidence(
  games: ParsedGame[],
  intervalWidth: number,
  nowSeconds = Math.floor(Date.now() / 1000),
): Insight["confidence"] {
  const effectiveSample = effectiveEvidenceSample(games, nowSeconds);
  if (effectiveSample >= 12 && intervalWidth <= 0.3) return "high";
  if (effectiveSample >= MIN_PRIMARY_EVIDENCE_GAMES) return "medium_high";
  if (effectiveSample >= 6) return "medium";
  return "low";
}

export function conditionalEvidenceFrequency(
  matchingGames: number,
  parentGames: number,
): { count: number; parentCount: number; ratio: number } {
  const safeParent = Math.max(parentGames, 0);
  const safeCount = Math.min(Math.max(matchingGames, 0), safeParent);
  return { count: safeCount, parentCount: safeParent, ratio: safeParent > 0 ? safeCount / safeParent : 0 };
}

export function classifyFreshness(games: ParsedGame[], nowSeconds = Math.floor(Date.now() / 1000)): ScoutFreshness {
  if (games.length === 0) return "limited";
  const ordered = [...games].sort((a, b) => b.endTime - a.endTime);
  const newestAgeDays = (nowSeconds - ordered[0].endTime) / DAY_SECONDS;
  if (newestAgeDays > 365) return "stale";

  const within180 = ordered.filter(game => nowSeconds - game.endTime <= 180 * DAY_SECONDS).length / games.length;
  const within365 = ordered.filter(game => nowSeconds - game.endTime <= 365 * DAY_SECONDS).length / games.length;
  if (games.length >= 20 && newestAgeDays <= 90 && within180 >= 0.6) return "strong";
  if (games.length >= MIN_PRIMARY_EVIDENCE_GAMES && newestAgeDays <= 365 && within365 >= 0.4) return "usable";
  return "limited";
}

export function primaryInsightEligible(insight: Insight, freshness: ScoutFreshness): boolean {
  return insight.sampleSize >= MIN_PRIMARY_EVIDENCE_GAMES && freshness !== "stale" && insight.confidence !== "low";
}

export function headlineInsightEligible(insight: Insight, freshness: ScoutFreshness): boolean {
  return primaryInsightEligible(insight, freshness);
}

export function supportingInsightEligible(insight: Insight): boolean {
  return insight.sampleSize >= 6;
}

function normalizedAction(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function titleFor(insight: Insight): string {
  const opening = insight.recommendation.line?.san?.split(/\s+/).slice(0, 4).join(" ");
  if (insight.kind === "weakness") return opening ? `Prepare the ${opening} position` : "Prepare the recurring weak line";
  if (insight.kind === "strength") return opening ? `Respect the ${opening} setup` : "Respect their recurring setup";
  if (insight.kind === "deviation_point") return opening ? `Prepare the ${opening} decision` : "Prepare the decision point";
  if (insight.kind === "response_pattern") return opening ? `Expect ${opening}` : "Expect the recurring reply";
  return opening ? `Expect ${opening}` : "Expect the recurring setup";
}

function actionTypeFor(insight: Insight): ScoutAction["type"] {
  if (insight.kind === "weakness") return "prepare";
  if (insight.kind === "opening_tendency" || insight.kind === "response_pattern") return "expect";
  if (insight.kind === "deviation_point") return "prepare";
  return "practice";
}

function legalLineFor(insight: Insight): string[] | undefined {
  const san = insight.recommendation.line?.san;
  if (!san) return undefined;
  const line = san.split(/\s+/).map(token => token.replace(/^\d+\.(?:\.\.)?/, "")).filter(Boolean);
  return line.length > 0 ? line : undefined;
}

export interface ScoutBriefFallback {
  openingName: string;
  opponentColor: Color;
  legalLine: string[];
  relevantGames: number;
  totalGames: number;
  reportGames: number;
  sourceGameIds: string[];
  evidenceGames: Insight["evidence"]["games"];
  evidenceWindow: Insight["evidence"]["window"];
}

function actionFromInsight(insight: Insight, freshness: ScoutFreshness): ScoutAction {
  return {
    id: insight.id,
    sourceInsightId: insight.id,
    kind: insight.kind,
    type: actionTypeFor(insight),
    opponentColor: insight.color,
    colorPerspective: insight.color,
    finding: insight.claim,
    title: titleFor(insight),
    action: { label: insight.recommendation.action, legalLine: legalLineFor(insight), source: "recentEvidence" },
    whyItMatters: insight.interpretation,
    confidence: freshness === "limited" && insight.confidence === "high" ? "medium_high" : insight.confidence,
    evidence: { ...insight.evidence, relevantGames: insight.sampleSize, sourceGameIds: insight.evidence.games.map(game => game.url) },
  };
}

function fallbackConfidence(relevantGames: number): Insight["confidence"] {
  if (relevantGames >= 8) return "medium_high";
  if (relevantGames >= 6) return "medium";
  return "low";
}

function fallbackActions(fallback: ScoutBriefFallback): ScoutAction[] {
  const side = fallback.opponentColor === "white" ? "White" : "Black";
  const line = fallback.legalLine.join(" ");
  const evidence = {
    stat: `${fallback.relevantGames}/${fallback.totalGames} eligible ${side} games reached this line`,
    games: fallback.evidenceGames,
    window: fallback.evidenceWindow,
    relevantGames: fallback.relevantGames,
    parentGames: fallback.totalGames,
    sourceGameIds: fallback.sourceGameIds,
  };
  const shared = {
    kind: "opening_tendency" as const,
    opponentColor: fallback.opponentColor,
    colorPerspective: fallback.opponentColor,
    confidence: fallbackConfidence(fallback.relevantGames),
    evidence,
  };
  return [
    {
      ...shared,
      id: `observed:expect:${fallback.opponentColor}:${fallback.legalLine.join("-")}`,
      sourceInsightId: `observed:expect:${fallback.opponentColor}:${fallback.legalLine.join("-")}`,
      type: "expect" as const,
      finding: `${fallback.openingName} is their most observed ${side} setup in this report.`,
      title: `Plan for ${fallback.openingName} first.`,
      action: { label: `Plan for ${fallback.openingName} first.`, legalLine: fallback.legalLine, source: "explorerReference" as const },
      whyItMatters: `${line} appeared in ${fallback.relevantGames} of ${fallback.totalGames} eligible ${side} games.`,
    },
    {
      ...shared,
      id: `observed:prepare:${fallback.opponentColor}:${fallback.legalLine.join("-")}`,
      sourceInsightId: `observed:prepare:${fallback.opponentColor}:${fallback.legalLine.join("-")}`,
      type: "prepare" as const,
      finding: `The observed ${fallback.openingName} line is ready to rehearse.`,
      title: `Prepare your response to ${fallback.openingName}.`,
      action: { label: `Rehearse the main response to ${fallback.openingName}.`, legalLine: fallback.legalLine, source: "explorerReference" as const },
      whyItMatters: `Rehearse ${line}, then decide on a calm reply from the resulting position.`,
    },
    {
      ...shared,
      id: `observed:practice:${fallback.opponentColor}:${fallback.legalLine.join("-")}`,
      sourceInsightId: `observed:practice:${fallback.opponentColor}:${fallback.legalLine.join("-")}`,
      type: "practice" as const,
      finding: `This is the most repeated ${fallback.openingName} position in the current sample.`,
      title: "Practice the main position.",
      action: { label: `Practice the observed ${fallback.openingName} position.`, legalLine: fallback.legalLine, source: "explorerReference" as const },
      whyItMatters: `Set up ${line} and play the next move from memory before checking the line explorer.`,
    },
  ];
}

/** Build a single opponent-centered action list. Explorer orientation is deliberately not an input. */
export function buildScoutBrief(
  insights: Insight[],
  freshness: ScoutFreshness,
  fallbacks?: ScoutBriefFallback[],
): ScoutAction[] {
  if (freshness === "stale") return [];
  const priority: Insight["kind"][] = ["weakness", "deviation_point", "response_pattern", "opening_tendency", "strength", "behavior"];
  const seenIds = new Set<string>();
  const seenActions = new Set<string>();
  const primaryActions = insights
    .filter(insight => primaryInsightEligible(insight, freshness))
    .sort((a, b) => priority.indexOf(a.kind) - priority.indexOf(b.kind) || b.sampleSize - a.sampleSize || a.id.localeCompare(b.id))
    .flatMap((insight): ScoutAction[] => {
      const actionKey = normalizedAction(insight.recommendation.action);
      if (seenIds.has(insight.id) || seenActions.has(actionKey)) return [];
      seenIds.add(insight.id);
      seenActions.add(actionKey);
      return [actionFromInsight(insight, freshness)];
    });
  const observedFallbacks = (fallbacks ?? [])
    .filter(fallback => fallback.reportGames >= MIN_PRIMARY_EVIDENCE_GAMES && fallback.relevantGames >= 2)
    .sort((a, b) => b.relevantGames - a.relevantGames || b.totalGames - a.totalGames || a.opponentColor.localeCompare(b.opponentColor))
    .flatMap(fallbackActions);

  return (["expect", "prepare", "practice"] as const)
    .map(type => primaryActions.find(action => action.type === type) ?? observedFallbacks.find(action => action.type === type))
    .filter((action): action is ScoutAction => Boolean(action));
}
