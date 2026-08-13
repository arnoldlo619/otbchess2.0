// server/prep/buildReport.ts — assemble ScoutReportV3 from pipeline stages.
// Ported from reference/src/engine.ts (buildReport section).
// This is the single entry point called by the API route.

import { Chess } from "chess.js";
import type {
  AnalysisSnapshotGame,
  CachedPrepAnalysisReport,
  Color,
  FetchOpts,
  Insight,
  PrepAnalysisSnapshot,
  Provider,
  RawGame,
  ScoutReportV3,
} from "../../shared/prepTypes.js";
import { parseGames } from "./parseGames.js";
import { synthesize, buildForecasts } from "./insightEngine.js";
import { runGuards } from "./guards.js";

export const ENGINE_VERSION = "3.1.0";

const dateOf = (t: number): string => new Date(t * 1000).toISOString().slice(0, 10);

export function buildReport(
  provider: Provider,
  username: string,
  raw: RawGame[],
  o: FetchOpts
): ScoutReportV3 {
  const { parsed, excluded, quarantined } = parseGames(raw, username, o);

  if (!parsed.length) {
    throw new Error(
      `NoUsableGames: ${username} (fetched ${raw.length}, all excluded/quarantined)`
    );
  }

  const insightsAll = synthesize(parsed, o);
  const { kept, reasons } = runGuards(insightsAll);

  const headlineOK = (i: Insight) => i.sampleSize >= 8 && i.confidence !== "low";
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
  // Grade considers both volume and recency: recent games (last 90 days) count more
  const nowS = Math.floor(Date.now() / 1000);
  const NINETY_DAYS_S = 90 * 24 * 3600;
  const recentCount = parsed.filter(g => (nowS - g.endTime) <= NINETY_DAYS_S).length;
  const grade: ScoutReportV3["dataQuality"]["grade"] =
    (usable >= 40 && recentCount >= 10) ? "A" :
    (usable >= 20 && recentCount >= 5) ? "B" :
    usable >= 10 ? "C" : "D";

  const notes: string[] = Object.entries(excluded).map(
    ([k, v]) => `${v} game(s) excluded: ${k.replace(/_/g, " ")}`
  );
  if (quarantined > 0) notes.push(`${quarantined} game(s) quarantined (illegal move sequence)`);
  if (grade === "D") notes.push("Thin data: fewer than 15 usable games. Insights below are directional only.");

  const ratedCount = parsed.filter(g => g.rated).length;
  const ratedShare = usable ? ratedCount / usable : 0;

  // Weak signals: insights that failed headline gate but passed guards
  const weakSignalIds = kept
    .filter(i => !headlineOK(i) && (i.kind === "weakness" || i.kind === "strength" || i.kind === "response_pattern"))
    .map(i => i.id);

  // Game plan insights for "If You Have White/Black" sections
  const ifWhite = weaknesses
    .filter(w => w.color === "black" && headlineOK(w))
    .concat(strengths.filter(s => s.color === "black" && headlineOK(s)));
  const ifBlack = weaknesses
    .filter(w => w.color === "white" && headlineOK(w))
    .concat(strengths.filter(s => s.color === "white" && headlineOK(s)));

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
        from: dateOf(Math.min(...parsed.map(g => g.endTime))),
        to: dateOf(Math.max(...parsed.map(g => g.endTime))),
      },
      grade,
      notes,
    },
    openingForecast: forecasts,
    insights: kept,
    sections: {
      matchupSummary: ids([...tendencies, ...responses].filter(headlineOK)),
      strengths: ids(strengths.filter(headlineOK)),
      weaknesses: ids(weaknesses.filter(headlineOK)),
      weakSignals: weakSignalIds,
      ifYouHaveWhite: ids(ifWhite),
      ifYouHaveBlack: ids(ifBlack),
      deviationPoints: ids(deviations.filter(headlineOK)),
      behavior: ids(behaviors),
      prepChecklist: checklist,
    },
    guardLog: {
      droppedInsights: insightsAll.length - kept.length,
      reasons,
    },
    generatedAt: new Date().toISOString(),
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
  submittedMyColor: Color,
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
  report.reportSnapshot = { id: reportCacheKey, myColor: submittedMyColor, createdAt };
  const analysisSnapshot: PrepAnalysisSnapshot = {
    schemaVersion: 1,
    reportCacheKey,
    submittedMyColor,
    createdAt,
    evidenceGameKeys,
    sourceGames,
    legalUciPaths: Array.from(legalPathMap.values()),
  };

  return { schemaVersion: 1, report, analysisSnapshot };
}
