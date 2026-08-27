import type {
  Color,
  Insight,
  ParsedGame,
  ScoutAction,
  ScoutFreshness,
} from "../../shared/prepTypes.js";

const DAY_SECONDS = 86_400;
const RECENT_WINDOW_SECONDS = 90 * DAY_SECONDS;

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
  if (effectiveSample >= 8) return "medium_high";
  if (effectiveSample >= 6) return "medium";
  return "low";
}

export function conditionalEvidenceFrequency(
  matchingGames: number,
  parentGames: number,
): { count: number; parentCount: number; ratio: number } {
  const safeParent = Math.max(parentGames, 0);
  const safeCount = Math.min(Math.max(matchingGames, 0), safeParent);
  return {
    count: safeCount,
    parentCount: safeParent,
    ratio: safeParent > 0 ? safeCount / safeParent : 0,
  };
}

export function classifyFreshness(games: ParsedGame[], nowSeconds = Math.floor(Date.now() / 1000)): ScoutFreshness {
  if (games.length === 0) return "limited";
  const ordered = [...games].sort((a, b) => b.endTime - a.endTime);
  const newestAgeDays = (nowSeconds - ordered[0].endTime) / DAY_SECONDS;
  if (newestAgeDays > 365) return "stale";

  const within180 = ordered.filter(game => nowSeconds - game.endTime <= 180 * DAY_SECONDS).length / games.length;
  const within365 = ordered.filter(game => nowSeconds - game.endTime <= 365 * DAY_SECONDS).length / games.length;
  if (games.length >= 20 && newestAgeDays <= 90 && within180 >= 0.6) return "strong";
  if (games.length >= 8 && newestAgeDays <= 365 && within365 >= 0.4) return "usable";
  return "limited";
}

export function primaryInsightEligible(insight: Insight, freshness: ScoutFreshness): boolean {
  return insight.sampleSize >= 8 && freshness !== "stale" && insight.confidence !== "low";
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
  if (insight.kind === "weakness") return "Target this underperforming line";
  if (insight.kind === "strength") return "Avoid their comfort zone";
  if (insight.kind === "deviation_point") return "Prepare the decision point";
  if (insight.kind === "response_pattern") return "Expect this reply";
  return "Prepare their most likely choice";
}

function actionTypeFor(insight: Insight): ScoutAction["type"] {
  if (insight.kind === "weakness") return "target";
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

function colorCorrectAction(action: string, myColor: Color): string {
  const side = myColor === "white" ? "White" : "Black";
  if (new RegExp(`^with ${side}[,.]`, "i").test(action)) return action;
  return `With ${side}, ${action.charAt(0).toLowerCase()}${action.slice(1)}`;
}

export function buildScoutBrief(
  insights: Insight[],
  myColor: Color,
  freshness: ScoutFreshness,
): ScoutAction[] {
  const opponentColor: Color = myColor === "white" ? "black" : "white";
  const priority: Insight["kind"][] = ["weakness", "deviation_point", "response_pattern", "opening_tendency", "strength", "behavior"];
  const seenIds = new Set<string>();
  const seenActions = new Set<string>();

  return insights
    .filter(insight => insight.color === opponentColor && primaryInsightEligible(insight, freshness) && legalLineFor(insight))
    .sort((a, b) => priority.indexOf(a.kind) - priority.indexOf(b.kind) || b.sampleSize - a.sampleSize || a.id.localeCompare(b.id))
    .flatMap((insight): ScoutAction[] => {
      const actionKey = normalizedAction(insight.recommendation.action);
      if (seenIds.has(insight.id) || seenActions.has(actionKey)) return [];
      seenIds.add(insight.id);
      seenActions.add(actionKey);
      return [{
        id: insight.id,
        sourceInsightId: insight.id,
        kind: insight.kind,
        type: actionTypeFor(insight),
        opponentColor: insight.color,
        colorPerspective: myColor,
        finding: insight.claim,
        title: titleFor(insight),
        action: { label: colorCorrectAction(insight.recommendation.action, myColor), legalLine: legalLineFor(insight), source: "recentEvidence" },
        whyItMatters: insight.interpretation,
        confidence: freshness === "limited" && insight.confidence === "high" ? "medium_high" : insight.confidence,
        evidence: { ...insight.evidence, relevantGames: insight.sampleSize, sourceGameIds: insight.evidence.games.map(game => game.url) },
      }];
    })
    .slice(0, 3);
}
