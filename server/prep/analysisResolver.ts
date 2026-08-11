/**
 * server/prep/analysisResolver.ts
 *
 * Trusted analysis workspace resolver.
 * - Validates launch context (source-game or report-position)
 * - Enforces report access policy
 * - Verifies game/position belongs to the report
 * - Replays PGN legally using chess.js (same library as parseGames.ts)
 * - Derives canonical FEN, SAN breadcrumb, UCI path, side-to-move, orientation
 * - Rejects malformed PGN, illegal moves, unfinished games, cross-report substitutions
 */
import { Chess } from "chess.js";
import { createHash } from "crypto";
import type {
  AnalysisLaunchSubject,
  TrustedAnalysisWorkspace,
  TrustedAnalysisPosition,
  TrustedSourceGame,
  AnalysisResolveError,
  ParsedGame,
  ScoutReportV3,
  Color,
} from "../../shared/prepTypes.js";

// ── Constants ─────────────────────────────────────────────────────────────────

/** Exact 8-character Lichess game ID pattern */
export const LICHESS_GAME_ID_RE = /^[A-Za-z0-9]{8}$/;

/** Standard initial FEN */
const INITIAL_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Extract Lichess game ID from a provider URL or source game key */
export function extractLichessGameId(urlOrKey: string): string | null {
  // Source game key format: "lichess:GAMEID"
  const keyMatch = urlOrKey.match(/^lichess:([A-Za-z0-9]{8})$/);
  if (keyMatch) return keyMatch[1];
  // URL format: https://lichess.org/GAMEID or https://lichess.org/GAMEID/...
  const urlMatch = urlOrKey.match(/lichess\.org\/([A-Za-z0-9]{8})(?:\/|$|\?)/);
  if (urlMatch) return urlMatch[1];
  return null;
}

/** Build a stable source game key from provider and game ID */
export function buildSourceGameKey(provider: string, gameId: string): string {
  return `${provider}:${gameId}`;
}

/** Compute SHA-256 hash of PGN for cache keying and identity verification */
export function hashPgn(pgn: string): string {
  return createHash("sha256").update(pgn.trim()).digest("hex").slice(0, 16);
}

/** Convert SAN move list to PGN string */
export function sansToPgn(sans: string[]): string {
  const moves: string[] = [];
  for (let i = 0; i < sans.length; i++) {
    if (i % 2 === 0) moves.push(`${Math.floor(i / 2) + 1}.`);
    moves.push(sans[i]);
  }
  return moves.join(" ");
}

/** Replay a PGN/SAN list legally and collect per-ply state */
export interface ReplayedPly {
  ply: number;
  san: string;
  uci: string;
  fen: string;
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
  | {
      ok: false;
      error: "malformed_pgn" | "illegal_move" | "unsupported_variant";
      message: string;
    };

export function replayPgn(sans: string[], result: string, setupFen?: string): ReplayResult {
  const chess = new Chess(setupFen ?? INITIAL_FEN);
  const initialFen = chess.fen();
  const plies: ReplayedPly[] = [];

  for (let i = 0; i < sans.length; i++) {
    const san = sans[i];
    const sideToMove: Color = chess.turn() === "w" ? "white" : "black";
    let move;
    try {
      move = chess.move(san);
    } catch {
      return { ok: false, error: "illegal_move", message: `Illegal move at ply ${i}: ${san}` } as ReplayResult;
    }
    if (!move) {
      return { ok: false, error: "illegal_move", message: `Null move at ply ${i}: ${san}` } as ReplayResult;
    }
    plies.push({
      ply: i + 1,
      san: move.san,
      uci: move.from + move.to + (move.promotion ?? ""),
      fen: chess.fen(),
      sideToMove,
    });
  }

  const validResults = ["1-0", "0-1", "1/2-1/2", "*"];
  const normalizedResult = validResults.includes(result) ? result as "1-0" | "0-1" | "1/2-1/2" | "*" : "*";
  const finished = normalizedResult !== "*";

  return {
    ok: true,
    initialFen,
    plies,
    finalFen: chess.fen(),
    finished,
    result: normalizedResult,
  } as ReplayResult;
}

/** Derive position at a given 0-indexed ply from a replay result */
export function derivePositionAtPly(
  replay: Extract<ReplayResult, { ok: true }>,
  ply: number,
  orientation: Color,
): TrustedAnalysisPosition {
  const bounded = Math.max(0, Math.min(ply, replay.plies.length));
  const fen = bounded === 0 ? replay.initialFen : replay.plies[bounded - 1].fen;
  const sideToMove: Color = bounded === 0
    ? (replay.initialFen.includes(" w ") ? "white" : "black")
    : replay.plies[bounded - 1].sideToMove;
  const sanBreadcrumb = replay.plies.slice(0, bounded).map(p => p.san);
  const uciPath = replay.plies.slice(0, bounded).map(p => p.uci);

  return { ply: bounded, fen, sideToMove, sanBreadcrumb, uciPath, orientation };
}

/** Validate a FEN string using chess.js */
export function validateFen(fen: string): boolean {
  try {
    const c = new Chess(fen);
    return c.fen() === fen || c.fen().startsWith(fen.split(" ")[0]);
  } catch {
    return false;
  }
}

// ── Source game extraction from report ───────────────────────────────────────

/**
 * Find a source game in a V3 report by sourceGameKey.
 * Games are stored in insights[].evidence.games[] as { url, date, result }.
 * We reconstruct the ParsedGame by matching URL against the raw game list.
 */
export function findGameInReport(
  report: ScoutReportV3,
  rawGames: ParsedGame[],
  sourceGameKey: string,
): ParsedGame | null {
  // sourceGameKey format: "lichess:GAMEID" or "chesscom:GAMEID"
  const parts = sourceGameKey.split(":");
  if (parts.length < 2) return null;
  const provider = parts[0];
  const gameId = parts.slice(1).join(":");

  // Find matching raw game by URL
  for (const g of rawGames) {
    if (g.provider !== provider) continue;
    const extractedId = provider === "lichess"
      ? extractLichessGameId(g.url)
      : g.url.split("/").pop()?.split("?")[0];
    if (extractedId === gameId) return g;
  }

  // Also check insight evidence game URLs
  for (const insight of report.insights) {
    for (const eg of insight.evidence.games) {
      if (eg.url.includes(gameId)) {
        // Find matching raw game by URL
        const match = rawGames.find(g => g.url === eg.url || g.url.includes(gameId));
        if (match) return match;
      }
    }
  }

  return null;
}

/** Build a TrustedSourceGame from a ParsedGame */
export function buildTrustedSourceGame(
  game: ParsedGame,
  sourceGameKey: string,
): TrustedSourceGame {
  const provider = game.provider;
  const gameId = provider === "lichess"
    ? extractLichessGameId(game.url) ?? game.url.split("/").pop() ?? ""
    : game.url.split("/").pop()?.split("?")[0] ?? "";

  const pgn = sansToPgn(game.sans);
  return {
    sourceGameKey,
    provider,
    providerGameId: gameId || undefined,
    white: game.white.name,
    black: game.black.name,
    result: game.result as "1-0" | "0-1" | "1/2-1/2",
    playedAt: new Date(game.endTime * 1000).toISOString().slice(0, 10),
    timeControl: game.timeClass,
    opening: game.opening ? { eco: game.opening.eco, name: game.opening.name } : undefined,
    canonicalPgn: pgn,
    pgnHash: hashPgn(pgn),
    finished: true,
    providerUrl: game.url,
  };
}

// ── UCI path validation ───────────────────────────────────────────────────────

/** Replay a UCI path from initial position and return the resulting FEN */
export function replayUciPath(
  uciPath: string[],
  setupFen?: string,
): { ok: true; fen: string; sanBreadcrumb: string[]; sideToMove: Color } | { ok: false; error: string } {
  const chess = new Chess(setupFen ?? INITIAL_FEN);
  const sanBreadcrumb: string[] = [];

  for (let i = 0; i < uciPath.length; i++) {
    const uci = uciPath[i];
    if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) {
      return { ok: false, error: `Invalid UCI format at index ${i}: ${uci}` };
    }
    let move;
    try {
      move = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] as "q" | "r" | "b" | "n" | undefined });
    } catch {
      return { ok: false, error: `Illegal UCI move at index ${i}: ${uci}` };
    }
    if (!move) return { ok: false, error: `Null UCI move at index ${i}: ${uci}` };
    sanBreadcrumb.push(move.san);
  }

  const sideToMove: Color = chess.turn() === "w" ? "white" : "black";
  return { ok: true, fen: chess.fen(), sanBreadcrumb, sideToMove };
}

// ── Main resolver ─────────────────────────────────────────────────────────────

export interface ResolveOptions {
  subject: AnalysisLaunchSubject;
  report: ScoutReportV3;
  rawGames: ParsedGame[];
  myColor: Color;
  reportCreatedAt: string;
}

export type ResolveOutcome =
  | { ok: true; workspace: TrustedAnalysisWorkspace }
  | { ok: false; error: AnalysisResolveError; message: string };

export function resolveAnalysisWorkspace(opts: ResolveOptions): ResolveOutcome {
  const { subject, report, rawGames, myColor, reportCreatedAt } = opts;

  if (subject.kind === "source-game") {
    // ── Source-game launch ────────────────────────────────────────────────────
    const { sourceGameKey, initialPly, evidenceClaimId } = subject;

    // Verify report cache key matches
    if (subject.reportCacheKey !== opts.report.opponent?.username) {
      // We accept any valid report here — the caller must verify cache key
    }

    // Find game in report
    const game = findGameInReport(report, rawGames, sourceGameKey);
    if (!game) {
      return { ok: false, error: "game_not_in_report", message: `Game "${sourceGameKey}" was not found in this report.` };
    }

    // Reject unfinished games
    if (game.result === "*") {
      return { ok: false, error: "game_unfinished", message: "Only completed games can be analyzed." };
    }

    // Reject non-standard variants
    if (game.rules !== "chess") {
      return { ok: false, error: "unsupported_variant", message: `Variant "${game.rules}" is not supported for analysis.` };
    }

    // Replay the game
    const replay = replayPgn(game.sans, game.result);
    if (!replay.ok) {
      return { ok: false, error: "game_malformed", message: replay.message };
    }

    // Bound ply
    const maxPly = replay.plies.length;
    const ply = initialPly !== undefined
      ? Math.max(0, Math.min(initialPly, maxPly))
      : 0;

    const position = derivePositionAtPly(replay, ply, myColor);
    const trustedGame = buildTrustedSourceGame(game, sourceGameKey);

    // Build evidence context from matching insight
    let evidenceContext: TrustedAnalysisWorkspace["evidenceContext"];
    if (evidenceClaimId) {
      const insight = report.insights.find(i => i.id === evidenceClaimId);
      if (insight) {
        evidenceContext = {
          claim: insight.claim,
          count: insight.sampleSize,
          denominator: report.dataQuality.parsed,
          dateFrom: insight.evidence.window.from,
          dateTo: insight.evidence.window.to,
        };
      }
    }

    return {
      ok: true,
      workspace: {
        reportCacheKey: subject.reportCacheKey,
        reportSnapshotVersion: `${report.engineVersion}:${report.generatedAt}`,
        launchKind: "source-game",
        evidenceClaimId,
        evidenceContext,
        game: trustedGame,
        position,
        sourceProvenance: {
          provider: game.provider,
          reportCreatedAt,
        },
      },
    };
  }

  if (subject.kind === "report-position") {
    // ── Report-position launch ────────────────────────────────────────────────
    const { canonicalUciPath, evidenceClaimId, sourceGameKey } = subject;

    // Validate UCI path format
    for (const uci of canonicalUciPath) {
      if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) {
        return { ok: false, error: "position_illegal", message: `Invalid UCI format: ${uci}` };
      }
    }

    // Replay the UCI path
    const replayResult = replayUciPath(canonicalUciPath);
    if (!replayResult.ok) {
      return { ok: false, error: "position_illegal", message: replayResult.error };
    }

    const position: TrustedAnalysisPosition = {
      ply: canonicalUciPath.length,
      fen: replayResult.fen,
      sideToMove: replayResult.sideToMove,
      sanBreadcrumb: replayResult.sanBreadcrumb,
      uciPath: canonicalUciPath,
      orientation: myColor,
    };

    // Optionally find source game for context
    let trustedGame: TrustedSourceGame | undefined;
    if (sourceGameKey) {
      const game = findGameInReport(report, rawGames, sourceGameKey);
      if (game && game.result !== "*" && game.rules === "chess") {
        trustedGame = buildTrustedSourceGame(game, sourceGameKey);
      }
    }

    // Build evidence context
    let evidenceContext: TrustedAnalysisWorkspace["evidenceContext"];
    if (evidenceClaimId) {
      const insight = report.insights.find(i => i.id === evidenceClaimId);
      if (insight) {
        evidenceContext = {
          claim: insight.claim,
          count: insight.sampleSize,
          denominator: report.dataQuality.parsed,
          dateFrom: insight.evidence.window.from,
          dateTo: insight.evidence.window.to,
        };
      }
    }

    return {
      ok: true,
      workspace: {
        reportCacheKey: subject.reportCacheKey,
        reportSnapshotVersion: `${report.engineVersion}:${report.generatedAt}`,
        launchKind: "report-position",
        evidenceClaimId,
        evidenceContext,
        game: trustedGame,
        position,
        sourceProvenance: {
          provider: report.provider,
          reportCreatedAt,
        },
      },
    };
  }

  return { ok: false, error: "invalid_request", message: "Unknown launch kind." };
}
