/**
 * Trusted Matchup Prep analysis workspace resolver.
 *
 * The browser supplies only a cached report ID, a source-game key, and a
 * bounded ply or canonical UCI path. This module resolves every PGN/FEN value
 * from the server-only immutable PrepAnalysisSnapshot stored with that report.
 */
import { Chess } from "chess.js";
import { createHash } from "crypto";
import type {
  AnalysisLaunchSubject,
  AnalysisResolveError,
  AnalysisSnapshotGame,
  Color,
  PrepAnalysisSnapshot,
  ScoutReportV3,
  TrustedAnalysisPosition,
  TrustedAnalysisWorkspace,
  TrustedSourceGame,
} from "../../shared/prepTypes.js";

export const LICHESS_GAME_ID_RE = /^[A-Za-z0-9]{8}$/;
const INITIAL_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const UCI_RE = /^[a-h][1-8][a-h][1-8][qrbn]?$/;

export interface ReplayedPly {
  ply: number;
  san: string;
  uci: string;
  fen: string;
  /** Color that made this move. */
  actor: Color;
  /** Color to move after this move. */
  sideToMove: Color;
}

export type ReplayResult =
  | {
      ok: true;
      initialFen: string;
      plies: ReplayedPly[];
      finalFen: string;
      finished: boolean;
      result: "1-0" | "0-1" | "1/2-1/2" | "*";
    }
  | { ok: false; error: "malformed_pgn" | "illegal_move" | "unsupported_variant"; message: string };

export function extractLichessGameId(value: string): string | null {
  const key = value.match(/^lichess:([A-Za-z0-9]{8})$/);
  if (key) return key[1];
  return value.match(/lichess\.org\/([A-Za-z0-9]{8})(?:\/|$|\?)/)?.[1] ?? null;
}

export function buildSourceGameKey(provider: string, gameId: string): string {
  return `${provider}:${gameId}`;
}

export function hashPgn(pgn: string): string {
  return createHash("sha256").update(pgn.trim()).digest("hex").slice(0, 16);
}

export function sansToPgn(sans: string[]): string {
  return sans.map((san, index) => index % 2 === 0 ? `${Math.floor(index / 2) + 1}. ${san}` : san).join(" ");
}

export function replayPgn(sans: string[], result: string, setupFen?: string): ReplayResult {
  let chess: Chess;
  try {
    chess = new Chess(setupFen ?? INITIAL_FEN);
  } catch {
    return { ok: false, error: "malformed_pgn", message: "Invalid setup FEN." };
  }
  const initialFen = chess.fen();
  const plies: ReplayedPly[] = [];
  for (let index = 0; index < sans.length; index++) {
    const san = sans[index];
    const actor: Color = chess.turn() === "w" ? "white" : "black";
    try {
      const move = chess.move(san);
      const sideToMove: Color = chess.turn() === "w" ? "white" : "black";
      plies.push({
        ply: index + 1,
        san: move.san,
        uci: move.from + move.to + (move.promotion ?? ""),
        fen: chess.fen(),
        actor,
        sideToMove,
      });
    } catch {
      return { ok: false, error: "illegal_move", message: `Illegal move at ply ${index}: ${san}` };
    }
  }
  const normalizedResult = (["1-0", "0-1", "1/2-1/2", "*"] as const).includes(result as "1-0" | "0-1" | "1/2-1/2" | "*")
    ? result as "1-0" | "0-1" | "1/2-1/2" | "*"
    : "*";
  return {
    ok: true,
    initialFen,
    plies,
    finalFen: chess.fen(),
    finished: normalizedResult !== "*",
    result: normalizedResult,
  };
}

export function derivePositionAtPly(
  replay: Extract<ReplayResult, { ok: true }>,
  requestedPly: number,
  orientation: Color,
): TrustedAnalysisPosition {
  const ply = Math.max(0, Math.min(Math.trunc(requestedPly), replay.plies.length));
  const last = ply === 0 ? undefined : replay.plies[ply - 1];
  return {
    ply,
    fen: last?.fen ?? replay.initialFen,
    sideToMove: last?.sideToMove ?? (replay.initialFen.includes(" w ") ? "white" : "black"),
    sanBreadcrumb: replay.plies.slice(0, ply).map(item => item.san),
    uciPath: replay.plies.slice(0, ply).map(item => item.uci),
    orientation,
  };
}

export function validateFen(fen: string): boolean {
  try {
    new Chess(fen);
    return true;
  } catch {
    return false;
  }
}

export function replayUciPath(
  uciPath: string[],
  setupFen?: string,
): { ok: true; fen: string; sanBreadcrumb: string[]; sideToMove: Color } | { ok: false; error: string } {
  let chess: Chess;
  try {
    chess = new Chess(setupFen ?? INITIAL_FEN);
  } catch {
    return { ok: false, error: "Invalid setup FEN." };
  }
  const sanBreadcrumb: string[] = [];
  for (const [index, uci] of Array.from(uciPath.entries())) {
    if (!UCI_RE.test(uci)) return { ok: false, error: `Invalid UCI format at index ${index}: ${uci}` };
    try {
      const move = chess.move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        promotion: uci[4] as "q" | "r" | "b" | "n" | undefined,
      });
      sanBreadcrumb.push(move.san);
    } catch {
      return { ok: false, error: `Illegal UCI move at index ${index}: ${uci}` };
    }
  }
  return { ok: true, fen: chess.fen(), sanBreadcrumb, sideToMove: chess.turn() === "w" ? "white" : "black" };
}

export function buildTrustedSourceGame(
  game: AnalysisSnapshotGame | {
    provider: "lichess" | "chesscom";
    url: string;
    white: { name: string };
    black: { name: string };
    result: "1-0" | "0-1" | "1/2-1/2" | "*";
    endTime: number;
    timeClass: string;
    opening: { eco: string; name: string };
    sans: string[];
  },
  sourceGameKey?: string,
): TrustedSourceGame {
  const snapshot = "providerUrl" in game;
  const providerUrl = snapshot ? game.providerUrl : game.url;
  const providerGameId = snapshot
    ? game.providerGameId
    : game.provider === "lichess"
      ? extractLichessGameId(game.url) ?? undefined
      : game.url.match(/chess\.com\/game\/(?:live|daily)\/(\d+)/)?.[1];
  const pgn = sansToPgn(game.sans);
  return {
    sourceGameKey: snapshot ? game.sourceGameKey : (sourceGameKey ?? `${game.provider}:${providerGameId ?? providerUrl}`),
    provider: game.provider,
    providerGameId,
    white: snapshot ? game.white : game.white.name,
    black: snapshot ? game.black : game.black.name,
    result: game.result as "1-0" | "0-1" | "1/2-1/2",
    playedAt: snapshot ? game.playedAt : new Date(game.endTime * 1000).toISOString().slice(0, 10),
    timeControl: snapshot ? game.timeControl : game.timeClass,
    opening: snapshot ? game.opening : { eco: game.opening.eco, name: game.opening.name },
    canonicalPgn: pgn,
    pgnHash: hashPgn(pgn),
    finished: true,
    providerUrl,
  };
}

function evidenceContext(report: ScoutReportV3, insightId?: string): TrustedAnalysisWorkspace["evidenceContext"] {
  const insight = insightId ? report.insights.find(item => item.id === insightId) : undefined;
  return insight ? {
    claim: insight.claim,
    count: insight.sampleSize,
    denominator: report.dataQuality.parsed,
    dateFrom: insight.evidence.window.from,
    dateTo: insight.evidence.window.to,
  } : undefined;
}

function samePath(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((move, index) => move === right[index]);
}

export interface ResolveOptions {
  subject: AnalysisLaunchSubject;
  report: ScoutReportV3;
  snapshot: PrepAnalysisSnapshot;
  reportCreatedAt: string;
}

export type ResolveOutcome =
  | { ok: true; workspace: TrustedAnalysisWorkspace }
  | { ok: false; error: AnalysisResolveError; message: string };

/** Resolve an immutable report context into a trusted analysis workspace. */
export function resolveAnalysisWorkspace(options: ResolveOptions): ResolveOutcome {
  const { subject, report, snapshot, reportCreatedAt } = options;
  if (subject.reportCacheKey !== snapshot.reportCacheKey || report.reportSnapshot?.id !== snapshot.reportCacheKey) {
    return { ok: false, error: "cross_report_substitution", message: "This analysis request does not belong to the selected report." };
  }

  if (subject.kind === "source-game") {
    if (!snapshot.evidenceGameKeys.includes(subject.sourceGameKey)) {
      return { ok: false, error: "game_not_in_report", message: "This game is not an eligible evidence game for the selected report." };
    }
    const game = snapshot.sourceGames.find(item => item.sourceGameKey === subject.sourceGameKey);
    if (!game) return { ok: false, error: "game_not_found", message: "The evidence game is no longer available." };
    if (game.result === "*") return { ok: false, error: "game_unfinished", message: "Only completed games can be analyzed." };
    if (game.rules !== "chess") return { ok: false, error: "unsupported_variant", message: `Variant "${game.rules}" is not supported for analysis.` };

    const replay = replayPgn(game.sans, game.result);
    if (!replay.ok) return { ok: false, error: "game_malformed", message: replay.message };
    const position = derivePositionAtPly(replay, subject.initialPly ?? 0, snapshot.submittedMyColor);
    return {
      ok: true,
      workspace: {
        reportCacheKey: snapshot.reportCacheKey,
        reportSnapshotVersion: `${report.engineVersion}:${snapshot.createdAt}`,
        launchKind: "source-game",
        evidenceClaimId: subject.evidenceClaimId,
        evidenceContext: evidenceContext(report, subject.evidenceClaimId),
        game: buildTrustedSourceGame(game),
        position,
        sourceProvenance: { provider: game.provider, reportCreatedAt },
      },
    };
  }

  if (!Array.isArray(subject.canonicalUciPath) || !subject.canonicalUciPath.every(move => UCI_RE.test(move))) {
    return { ok: false, error: "position_illegal", message: "The requested position contains an invalid UCI move." };
  }
  const replay = replayUciPath(subject.canonicalUciPath);
  if (!replay.ok) return { ok: false, error: "position_illegal", message: replay.error };
  if (!snapshot.legalUciPaths.some(path => samePath(path, subject.canonicalUciPath))) {
    return { ok: false, error: "position_not_in_report", message: "This position does not belong to the selected report's legal game tree." };
  }

  let game: TrustedSourceGame | undefined;
  if (subject.sourceGameKey) {
    const source = snapshot.sourceGames.find(item => item.sourceGameKey === subject.sourceGameKey);
    if (!source || !snapshot.evidenceGameKeys.includes(subject.sourceGameKey)) {
      return { ok: false, error: "game_not_in_report", message: "The cited source game is not an eligible evidence game." };
    }
    const sourceReplay = replayPgn(source.sans, source.result);
    if (!sourceReplay.ok || source.result === "*") {
      return { ok: false, error: "game_malformed", message: "The cited source game cannot be replayed safely." };
    }
    const targetPath = subject.canonicalUciPath.join(",");
    if (!sourceReplay.plies.some((_ply, index) => sourceReplay.plies.slice(0, index + 1).map(item => item.uci).join(",") === targetPath) && targetPath !== "") {
      return { ok: false, error: "position_not_in_report", message: "The cited position was not reached by the evidence game." };
    }
    game = buildTrustedSourceGame(source);
  }

  return {
    ok: true,
    workspace: {
      reportCacheKey: snapshot.reportCacheKey,
      reportSnapshotVersion: `${report.engineVersion}:${snapshot.createdAt}`,
      launchKind: "report-position",
      evidenceClaimId: subject.evidenceClaimId,
      evidenceContext: evidenceContext(report, subject.evidenceClaimId),
      game,
      position: {
        ply: subject.canonicalUciPath.length,
        fen: replay.fen,
        sideToMove: replay.sideToMove,
        sanBreadcrumb: replay.sanBreadcrumb,
        uciPath: [...subject.canonicalUciPath],
        orientation: snapshot.submittedMyColor,
      },
      sourceProvenance: { provider: report.provider, reportCreatedAt },
    },
  };
}
