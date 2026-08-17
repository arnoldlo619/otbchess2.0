// shared/prepTypes.ts — ChessOTB.club Scouting Report V3: shared contracts
// Single source of truth — imported by both server and client.
// Ported from reference/src/types.ts with no modifications to the contracts.

export type Provider = "chesscom" | "lichess";
export type Color = "white" | "black";

/** Normalized game: both providers converge to this before parsing. */
export interface RawGame {
  provider: Provider;
  url: string;
  rated: boolean;
  rules: string;           // "chess" | "chess960" | ... (lichess variant maps here)
  timeClass: string;       // rapid | blitz | bullet | classical | daily
  endTime: number;         // epoch seconds
  white: { name: string; rating: number | null; result: string };
  black: { name: string; rating: number | null; result: string };
  result: "1-0" | "0-1" | "1/2-1/2" | "*";
  sans: string[];          // SAN tokens, headers/comments/NAGs already stripped
}

export interface ParsedGame extends RawGame {
  plies: { san: string; epd: string; by: Color }[];
  fullMoves: number;
  opening: { eco: string; name: string; bookExitPly: number };
  scoutedColor: Color;
  scoutedScore: 0 | 0.5 | 1;
}

export interface Insight {
  id: string;
  kind:
    | "opening_tendency"
    | "response_pattern"
    | "weakness"
    | "strength"
    | "deviation_point"
    | "behavior"
    | "game_plan"
    | "weak_signal";
  color: Color;              // scouted player's color for this insight
  role: "plays" | "faces";
  claim: string;
  evidence: {
    stat: string;
    games: { url: string; date: string; result: "W" | "D" | "L" }[]; // 1–5
    window: { from: string; to: string; timeClasses: string[]; ratedOnly: boolean };
  };
  interpretation: string;
  recommendation: { action: string; line?: { san: string; eco?: string; validated: true } };
  confidence: "low" | "medium" | "medium_high" | "high";
  sampleSize: number;
  baseline?: { metric: string; value: number; delta: number };
  ply?: number;              // deviation points only (0-indexed)
}

export interface ForecastBranch {
  moveSan: string;
  /** Canonical game path through this move, retained solely for legal board/analysis previews. */
  previewPath?: string[];
  count: number;
  pct: number;
  score: number;
  /** Opponent's wins in this line (from their perspective) */
  wins: number;
  /** Draws in this line */
  draws: number;
  /** Opponent's losses in this line */
  losses: number;
  label?: string;
  children: ForecastBranch[];
}

export interface ScoutReportV3 {
  version: 3;
  engineVersion: string;
  provider: Provider;
  opponent: {
    username: string;
    record: Record<Color, { w: number; d: number; l: number }>;
    avgRating: number | null;
    timeControlSplit: Record<string, { games: number; score: number }>;
  };
  dataQuality: {
    requested: number;
    fetched: number;
    parsed: number;
    quarantined: number;
    excluded: Record<string, number>;
    ratedShare: number;
    window: { from: string; to: string };
    grade: "A" | "B" | "C" | "D";
    notes: string[];
  };
  openingForecast: Record<Color, ForecastBranch[]>;
  insights: Insight[];
  sections: {
    matchupSummary: string[];
    strengths: string[];
    weaknesses: string[];
    weakSignals: string[];
    ifYouHaveWhite: string[];
    ifYouHaveBlack: string[];
    deviationPoints: string[];
    behavior: string[];
    prepChecklist: { text: string; insightId: string }[];
  };
  guardLog: { droppedInsights: number; reasons: Record<string, number> };
  generatedAt: string;
  /** Public identifier and submitted perspective for an immutable cached report. */
  reportSnapshot?: { id: string; myColor: Color; createdAt: string };
  /** Third independent evidence layer. Never changes recentEvidence denominators. */
  populationReferences?: PopulationReference[];
}

export type PopulationSource = "lichess-open-database-local" | "lichess-opening-explorer" | "unavailable";
export type PopulationAvailability = "complete" | "limited" | "stale" | "pending" | "unavailable";
export type PopulationSpeed = "bullet" | "blitz" | "rapid";

export interface PopulationFilters {
  speeds: PopulationSpeed[];
  ratingBand: number;
  months: { from: string; to: string };
}

export interface PopulationMove {
  uci: string;
  san: string;
  count: string;
}

/** Immutable, anonymous population benchmark separate from both player evidence layers. */
export interface PopulationReference {
  schemaVersion: 1;
  source: PopulationSource;
  availability: PopulationAvailability;
  positionKey: string;
  uciPath: string[];
  opponentColor: Color;
  opponentMoveUci: string;
  opponentMoveSan: string;
  opponentCount: number;
  opponentDenominator: number;
  populationMoveCount?: string;
  populationDenominator?: string;
  filters: PopulationFilters;
  datasetVersion?: string;
  completeMonths?: string[];
  cacheObservedAt?: string;
  limitedReason?: "population_below_threshold" | "incomplete_coverage" | "rating_unavailable" | "position_untracked" | "upstream_unavailable";
}

/** Options for fetching and filtering games */
export interface FetchOpts {
  maxGames: number;       // default 100
  months: number;         // chess.com archives lookback, default 6
  timeClasses: string[];  // ["rapid","blitz"]
  ratedOnly: boolean;     // default true
}

export const DEFAULT_FETCH_OPTS: FetchOpts = {
  maxGames: 100,
  months: 6,
  timeClasses: ["rapid", "blitz"],
  ratedOnly: true,
};

/** Structured error payloads from /api/prep/:username */
export type PrepErrorCode =
  | "invalid_username"
  | "not_found"
  | "no_recent_games"
  | "all_filtered"
  | "upstream_rate_limited";

export interface PrepErrorPayload {
  error: PrepErrorCode;
  message: string;
}

// ── Analysis Workspace Types ──────────────────────────────────────────────────
// Phase 2: Matchup Prep Analysis Workspace

/** Stable launch context — browser submits only IDs and bounded path/ply */
export type AnalysisLaunchSubject =
  | {
      kind: "source-game";
      /** Stable report cache key (e.g. v3:lichess:username:all:g100) */
      reportCacheKey: string;
      /** Provider-correct source game key (e.g. "lichess:MPJcy1JW") */
      sourceGameKey: string;
      /** 0-indexed ply, bounded to [0, legalPlyCount] */
      initialPly?: number;
      /** Insight ID that launched this analysis */
      evidenceClaimId?: string;
    }
  | {
      kind: "report-position";
      reportCacheKey: string;
      /** Canonical UCI path from the report's legal tree (e.g. ["e2e4","c7c5"]) */
      canonicalUciPath: string[];
      evidenceClaimId?: string;
      sourceGameKey?: string;
    };

/** Trusted resolved position — server-derived, never client-supplied */
export interface TrustedAnalysisPosition {
  ply: number;
  fen: string;
  sideToMove: Color;
  sanBreadcrumb: string[];
  uciPath: string[];
  orientation: Color;
}

/** Verified source game record — server-validated */
export interface TrustedSourceGame {
  sourceGameKey: string;
  provider: "lichess" | "chesscom" | "chessotb";
  providerGameId?: string;
  white: string;
  black: string;
  result: "1-0" | "0-1" | "1/2-1/2";
  playedAt: string;           // ISO date string
  timeControl?: string;
  opening?: { eco?: string; name: string };
  canonicalPgn: string;
  pgnHash: string;
  finished: true;
  providerUrl: string;
}

/** Optional Lichess enrichment — fetched lazily, separate from base PGN */
export interface LichessGameEnrichment {
  gameId: string;
  fetchedAt: string;
  opening?: { eco?: string; name?: string };
  division?: { middle?: number; end?: number };
  accuracy?: { white?: number; black?: number };
  clocks?: number[];
  status: "complete" | "unavailable" | "error";
}

/** Full trusted analysis workspace — server-resolved */
export interface TrustedAnalysisWorkspace {
  reportCacheKey: string;
  reportSnapshotVersion: string;
  launchKind: "source-game" | "report-position";
  evidenceClaimId?: string;
  evidenceContext?: {
    claim: string;
    count: number;
    denominator: number;
    dateFrom: string;
    dateTo: string;
  };
  game?: TrustedSourceGame;
  position: TrustedAnalysisPosition;
  sourceProvenance: {
    provider: string;
    fetchedAt?: string;
    reportCreatedAt: string;
  };
}

/** Request body for /api/prep/analysis/resolve */
export interface AnalysisResolveRequest {
  subject: AnalysisLaunchSubject;
}

/** Response from /api/prep/analysis/resolve */
export type AnalysisResolveResult =
  | { ok: true; workspace: TrustedAnalysisWorkspace }
  | { ok: false; error: AnalysisResolveError; message: string };

export type AnalysisResolveError =
  | "report_not_found"
  | "game_not_found"
  | "game_not_in_report"
  | "game_unfinished"
  | "game_malformed"
  | "position_illegal"
  | "position_not_in_report"
  | "ply_out_of_range"
  | "cross_report_substitution"
  | "access_denied"
  | "active_game"
  | "unsupported_variant"
  | "invalid_request";

/** Private, server-only source game retained with a cached report for analysis. */
export interface AnalysisSnapshotGame {
  sourceGameKey: string;
  provider: Provider;
  providerGameId?: string;
  providerUrl: string;
  white: string;
  black: string;
  result: RawGame["result"];
  playedAt: string;
  timeControl: string;
  opening: { eco?: string; name: string };
  rules: string;
  sans: string[];
}

/**
 * Server-only immutable data retained alongside the public V3 report. It is
 * never returned by /api/prep/:username and is resolved only after access
 * checks in /api/prep/analysis/resolve.
 */
export interface PrepAnalysisSnapshot {
  schemaVersion: 1;
  reportCacheKey: string;
  submittedMyColor: Color;
  createdAt: string;
  evidenceGameKeys: string[];
  sourceGames: AnalysisSnapshotGame[];
  /** Canonical UCI paths reached by the legally replayed recent-game sample. */
  legalUciPaths: string[][];
}

/** Private envelope stored in prep_cache.report_json for V3 reports. */
export interface CachedPrepAnalysisReport {
  schemaVersion: 1;
  report: ScoutReportV3;
  analysisSnapshot: PrepAnalysisSnapshot;
}
