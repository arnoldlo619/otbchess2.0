// server/prep/buildReport.ts — assemble ScoutReportV3 from pipeline stages.
// Ported from reference/src/engine.ts (buildReport section).
// This is the single entry point called by the API route.

import { Chess } from "chess.js";
import type {
  AnalysisSnapshotGame,
  ActiveScoutRequest,
  CachedPrepAnalysisReport,
  Color,
  FetchOpts,
  ForecastBranch,
  Insight,
  ParsedGame,
  PrepAnalysisSnapshot,
  Provider,
  RawGame,
  ScoutReportV3,
} from "../../shared/prepTypes.js";
import { familiarOpeningNameFromMoves } from "../../shared/simpleOpeningNames.js";
import { parseGames } from "./parseGames.js";
import { synthesize, buildForecasts } from "./insightEngine.js";
import { sample } from "./facts.js";
import { runGuards } from "./guards.js";
import { buildScoutBrief, classifyFreshness, headlineInsightEligible, type ScoutBriefFallback } from "./evidencePolicy.js";

export const ENGINE_VERSION = "5.0.0-launch-remediation";

/** Provider timestamps are UTC instants; render calendar dates explicitly in UTC to avoid local timezone drift. */
const dateOf = (t: number): string => {
  const date = new Date(t * 1000);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
};

function primaryObservedLine(branches: ForecastBranch[]): ForecastBranch | null {
  let branch = branches[0];
  if (!branch?.previewPath?.length) return null;
  while (branch.children.length > 0 && (branch.previewPath?.length ?? 0) < 6) {
    const next = [...branch.children].sort((a, b) => b.count - a.count || a.moveSan.localeCompare(b.moveSan))[0];
    if (!next?.previewPath?.length) break;
    branch = next;
  }
  return branch;
}

function observedScoutBriefFallback(
  parsed: ParsedGame[],
  color: Color,
  branches: ForecastBranch[],
  openingName: string | undefined,
  window: ScoutBriefFallback["evidenceWindow"],
): ScoutBriefFallback | undefined {
  const branch = primaryObservedLine(branches);
  const legalLine = branch?.previewPath;
  if (!branch || !legalLine?.length) return undefined;
  const colorGames = parsed.filter(game => game.scoutedColor === color);
  const matchingGames = colorGames.filter(game => legalLine.every((move, index) => game.plies[index]?.san === move));
  if (matchingGames.length < 2 || colorGames.length < 2) return undefined;
  return {
    openingName: branch.label ?? openingName ?? `${color === "white" ? "White" : "Black"} main line`,
    opponentColor: color,
    legalLine,
    relevantGames: matchingGames.length,
    totalGames: colorGames.length,
    reportGames: parsed.length,
    sourceGameIds: matchingGames.map(game => `${game.provider}:${game.url}`),
    evidenceGames: sample(matchingGames),
    evidenceWindow: window,
  };
}

function mostObservedOpeningMoves(games: ParsedGame[], maxPlies = 4): string[] {
  let matchingGames = games;
  const moves: string[] = [];
  for (let ply = 0; ply < maxPlies; ply += 1) {
    const candidates = new Map<string, ParsedGame[]>();
    for (const game of matchingGames) {
      const move = game.plies[ply]?.san;
      if (!move) continue;
      const bucket = candidates.get(move);
      if (bucket) bucket.push(game);
      else candidates.set(move, [game]);
    }
    const selected = Array.from(candidates.entries()).sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))[0];
    if (!selected) break;
    moves.push(selected[0]);
    matchingGames = selected[1];
  }
  return moves;
}

export function buildReport(
  provider: Provider,
  username: string,
  raw: RawGame[],
  o: FetchOpts,
  _legacyExplorerColor: Color = "white",
): ScoutReportV3 {
  const parsedResult = parseGames(raw, username, o);
  const parsed = [...parsedResult.parsed]
    .sort((a, b) => b.endTime - a.endTime)
    .slice(0, Math.min(30, o.maxGames));
  const { excluded, quarantined } = parsedResult;

  if (!parsed.length) {
    throw new Error(
      `NoUsableGames: ${username} (fetched ${raw.length}, all excluded/quarantined)`
    );
  }

  const insightsAll = synthesize(parsed, o);
  const { kept, reasons } = runGuards(insightsAll);

  const headlineOK = (i: Insight) => headlineInsightEligible(i, freshness);
  const byKind = (k: Insight["kind"]) => kept.filter(i => i.kind === k);
  const ids = (a: Insight[]) => a.map(i => i.id);

  const weaknesses = byKind("weakness").sort((a, b) => (a.baseline!.delta) - (b.baseline!.delta));
  const strengths = byKind("strength").sort((a, b) => (b.baseline!.delta) - (a.baseline!.delta));
  const deviations = byKind("deviation_point");
  const behaviors = byKind("behavior");
  const tendencies = byKind("opening_tendency");
  const responses = byKind("response_pattern");

  // Record per color
  const rec: Record<Color, { w: number; d: number; l: number }> = {
    white: { w: 0, d: 0, l: 0 },
    black: { w: 0, d: 0, l: 0 },
  };
  const tcs: Record<string, { games: number; score: number }> = {};
  const ratings: number[] = [];

  for (const g of parsed) {
    const r = rec[g.scoutedColor];
    if (g.scoutedScore === 1) { r.w++; } else if (g.scoutedScore === 0.5) { r.d++; } else { r.l++; }
    const t = (tcs[g.timeClass] ??= { games: 0, score: 0 });
    t.games++;
    t.score += g.scoutedScore;
    const rating = g.scoutedColor === "white" ? g.white.rating : g.black.rating;
    if (rating) ratings.push(rating);
  }
  for (const k of Object.keys(tcs)) tcs[k].score = tcs[k].score / tcs[k].games;

  const usable = parsed.length;
  const freshness = classifyFreshness(parsed);
  const reportWindow = {
    from: dateOf(Math.min(...parsed.map(game => game.endTime))),
    to: dateOf(Math.max(...parsed.map(game => game.endTime))),
    timeClasses: o.timeClasses,
    ratedOnly: o.ratedOnly,
  };
  const grade: ScoutReportV3["dataQuality"]["grade"] =
    freshness === "strong" ? "A" :
    freshness === "usable" ? "B" :
    freshness === "limited" ? "C" : "D";

  const notes: string[] = Object.entries(excluded).map(
    ([k, v]) => `${v} game(s) excluded: ${k.replace(/_/g, " ")}`
  );
  if (quarantined > 0) notes.push(`${quarantined} game(s) quarantined (illegal move sequence)`);
  if (freshness === "limited") notes.push("Limited evidence: primary findings require at least 8 games with adequate recency and date spread.");
  if (freshness === "stale") notes.push("Stale evidence: the newest eligible game is more than 365 days old, so primary recommendations are withheld.");

  const ratedCount = parsed.filter(g => g.rated).length;
  const ratedShare = usable ? ratedCount / usable : 0;

  // Weak signals: insights that failed headline gate but passed guards
  const weakSignalIds = kept
    .filter(i => !headlineOK(i) && (i.kind === "weakness" || i.kind === "strength" || i.kind === "response_pattern"))
    .map(i => i.id);

  // Prep checklist: top actionable items
  const checklist: ScoutReportV3["sections"]["prepChecklist"] = [
    ...weaknesses.filter(headlineOK).slice(0, 3).map(i => ({
      text: i.recommendation.action,
      insightId: i.id,
    })),
    ...deviations.filter(headlineOK).slice(0, 2).map(i => ({
      text: i.recommendation.action,
      insightId: i.id,
    })),
    ...tendencies.filter(headlineOK).slice(0, 1).map(i => ({
      text: i.recommendation.action,
      insightId: i.id,
    })),
  ];

  const forecasts = buildForecasts(parsed);
  const openingSummary = (color: Color) => {
    const byFamily = new Map<string, ParsedGame[]>();
    for (const game of parsed.filter(candidate => candidate.scoutedColor === color)) {
      const moves = game.plies.slice(0, 4).map(ply => ply.san);
      const name = familiarOpeningNameFromMoves(game.opening.name, game.opening.eco, moves);
      const existing = byFamily.get(name) ?? [];
      existing.push(game);
      byFamily.set(name, existing);
    }
    const total = parsed.filter(candidate => candidate.scoutedColor === color).length;
    return Array.from(byFamily.entries())
      .sort(([, a], [, b]) => b.length - a.length || a.reduce((sum, game) => sum + game.scoutedScore, 0) - b.reduce((sum, game) => sum + game.scoutedScore, 0))
      .slice(0, 2)
      .map(([name, games]) => {
        const score = games.reduce((sum, game) => sum + game.scoutedScore, 0);
        return { name, moves: mostObservedOpeningMoves(games), games: games.length, share: total ? games.length / total : 0, score: games.length ? score / games.length : 0 };
      });
  };
  const summaries = { white: openingSummary("white"), black: openingSummary("black") };
  const fallbacks = (parsed.length >= 8 && freshness !== "stale" ? (["white", "black"] as const).map(color => observedScoutBriefFallback(
    parsed,
    color,
    forecasts[color],
    summaries[color][0]?.name,
    reportWindow,
  )).filter((fallback): fallback is ScoutBriefFallback => Boolean(fallback)) : []);
  const scoutBrief = buildScoutBrief(kept, freshness, fallbacks);

  return {
    version: 3,
    engineVersion: ENGINE_VERSION,
    provider,
    opponent: {
      username,
      record: rec,
      avgRating: ratings.length ? Math.round(ratings.reduce((a, b) => a + b, 0) / ratings.length) : null,
      timeControlSplit: tcs,
    },
    dataQuality: {
      requested: o.maxGames,
      fetched: raw.length,
      parsed: usable,
      quarantined,
      excluded,
      ratedShare,
      window: {
        from: reportWindow.from,
        to: reportWindow.to,
      },
      grade,
      freshness,
      notes,
    },
    openingForecast: forecasts,
    openingSummary: summaries,
    insights: kept,
    scoutBrief,
    sections: {
      matchupSummary: ids([...tendencies, ...responses].filter(headlineOK)),
      strengths: ids(strengths.filter(headlineOK)),
      weaknesses: ids(weaknesses.filter(headlineOK)),
      weakSignals: weakSignalIds,
      ifYouHaveWhite: [],
      ifYouHaveBlack: [],
      deviationPoints: ids(deviations.filter(headlineOK)),
      behavior: ids(behaviors),
      prepChecklist: checklist,
    },
    guardLog: {
      droppedInsights: insightsAll.length - kept.length,
      reasons,
    },
    generatedAt: new Date().toISOString(),
    freshness,
  };
}

function providerGameId(provider: Provider, url: string): string | undefined {
  if (provider === "lichess") {
    return url.match(/lichess\.org\/([A-Za-z0-9]{8})(?:\/|$|\?)/)?.[1];
  }
  return url.match(/chess\.com\/game\/(?:live|daily)\/(\d+)/)?.[1];
}

function uciPrefixes(sans: string[]): string[][] {
  const chess = new Chess();
  const paths: string[][] = [[]];
  const path: string[] = [];
  for (const san of sans) {
    try {
      const move = chess.move(san);
      path.push(move.from + move.to + (move.promotion ?? ""));
      paths.push([...path]);
    } catch {
      return [];
    }
  }
  return paths;
}

/**
 * Builds the private counterpart of a public V3 report. The parser is reused
 * verbatim, so the stored source games and legal paths follow the same
 * quarantine/filter policy as the visible report.
 */
export function buildCachedPrepAnalysisReport(
  provider: Provider,
  username: string,
  raw: RawGame[],
  options: FetchOpts,
  reportCacheKey: string,
  activeRequest: ActiveScoutRequest,
): CachedPrepAnalysisReport {
  const report = buildReport(provider, username, raw, options);
  const { parsed } = parseGames(raw, username, options);
  const evidenceUrls = new Set(report.insights.flatMap(insight => insight.evidence.games.map(game => game.url)));
  const legalPathMap = new Map<string, string[]>();

  const sourceGames: AnalysisSnapshotGame[] = parsed.map(game => {
    const id = providerGameId(game.provider, game.url);
    const sourceGameKey = id ? `${game.provider}:${id}` : `${game.provider}:${game.url}`;
    for (const path of uciPrefixes(game.sans)) legalPathMap.set(path.join(","), path);
    return {
      sourceGameKey,
      provider: game.provider,
      providerGameId: id,
      providerUrl: game.url,
      white: game.white.name,
      black: game.black.name,
      result: game.result,
      playedAt: dateOf(game.endTime),
      timeControl: game.timeClass,
      opening: { eco: game.opening.eco, name: game.opening.name },
      rules: game.rules,
      sans: game.sans,
    };
  });

  const evidenceGameKeys = sourceGames
    .filter(game => evidenceUrls.has(game.providerUrl))
    .map(game => game.sourceGameKey);

  const createdAt = report.generatedAt;
  report.reportSnapshot = { id: reportCacheKey, activeRequest, createdAt };
  const analysisSnapshot: PrepAnalysisSnapshot = {
    schemaVersion: 1,
    reportCacheKey,
    submittedMyColor: activeRequest.explorerColor ?? "white",
    createdAt,
    evidenceGameKeys,
    sourceGames,
    legalUciPaths: Array.from(legalPathMap.values()),
  };

  return { schemaVersion: 1, report, analysisSnapshot };
}
