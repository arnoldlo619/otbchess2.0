/**
 * client/src/lib/analyzeAction.ts
 *
 * Helpers for building Analyze action URLs from Matchup Prep evidence.
 * These functions build stable, ID-based URLs — never raw FEN/PGN/provider URLs.
 */
import type { AnalysisLaunchSubject } from "../../../shared/prepTypes";

/**
 * Build the /prep/analysis URL for a source-game launch.
 * @param reportCacheKey - stable report cache key (e.g. v3:lichess:username:all:g100)
 * @param sourceGameUrl - provider URL of the game (used to extract game ID)
 * @param provider - game provider
 * @param myColor - user's color in this matchup
 * @param evidenceClaimId - optional insight ID
 * @param returnPath - path to return to (default: current path)
 */
export function buildSourceGameAnalysisUrl(opts: {
  reportCacheKey: string;
  sourceGameUrl: string;
  provider: "lichess" | "chesscom" | "chessotb";
  myColor: "white" | "black";
  evidenceClaimId?: string;
  returnPath?: string;
  initialPly?: number;
}): string | null {
  // Extract game ID from URL
  const gameId = extractGameId(opts.sourceGameUrl, opts.provider);
  if (!gameId) return null;

  const sourceGameKey = `${opts.provider}:${gameId}`;
  const subject: AnalysisLaunchSubject = {
    kind: "source-game",
    reportCacheKey: opts.reportCacheKey,
    sourceGameKey,
    initialPly: opts.initialPly ?? 0,
    evidenceClaimId: opts.evidenceClaimId,
  };

  return buildAnalysisUrl(subject, opts.myColor, opts.returnPath);
}

/**
 * Build the /prep/analysis URL for a report-position launch.
 * @param reportCacheKey - stable report cache key
 * @param canonicalUciPath - canonical UCI path from the report's legal tree
 * @param myColor - user's color
 * @param evidenceClaimId - optional insight ID
 * @param returnPath - path to return to
 */
export function buildPositionAnalysisUrl(opts: {
  reportCacheKey: string;
  canonicalUciPath: string[];
  myColor: "white" | "black";
  evidenceClaimId?: string;
  returnPath?: string;
  sourceGameUrl?: string;
  provider?: "lichess" | "chesscom" | "chessotb";
}): string | null {
  // Validate UCI path format
  for (const uci of opts.canonicalUciPath) {
    if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) return null;
  }

  let sourceGameKey: string | undefined;
  if (opts.sourceGameUrl && opts.provider) {
    const gameId = extractGameId(opts.sourceGameUrl, opts.provider);
    if (gameId) sourceGameKey = `${opts.provider}:${gameId}`;
  }

  const subject: AnalysisLaunchSubject = {
    kind: "report-position",
    reportCacheKey: opts.reportCacheKey,
    canonicalUciPath: opts.canonicalUciPath,
    evidenceClaimId: opts.evidenceClaimId,
    sourceGameKey,
  };

  return buildAnalysisUrl(subject, opts.myColor, opts.returnPath);
}

function buildAnalysisUrl(
  subject: AnalysisLaunchSubject,
  myColor: "white" | "black",
  returnPath?: string,
): string {
  const params = new URLSearchParams();
  params.set("subject", encodeURIComponent(JSON.stringify(subject)));
  params.set("color", myColor);
  if (returnPath) params.set("return", returnPath);
  return `/prep/analysis?${params.toString()}`;
}

function extractGameId(url: string, provider: "lichess" | "chesscom" | "chessotb"): string | null {
  if (provider === "lichess") {
    const match = url.match(/lichess\.org\/([A-Za-z0-9]{8})(?:\/|$|\?)/);
    return match ? match[1] : null;
  }
  if (provider === "chesscom") {
    // chess.com game URLs: https://www.chess.com/game/live/12345678
    const match = url.match(/chess\.com\/game\/(?:live|daily)\/(\d+)/);
    return match ? match[1] : null;
  }
  // ChessOTB/OTB: use last path segment
  const parts = url.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? null;
}

/**
 * Check if a game URL is eligible for analysis
 * (completed, standard chess, not ongoing)
 */
export function isEligibleForAnalysis(opts: {
  url: string;
  result: string;
  rules: string;
}): boolean {
  if (opts.result === "*") return false;
  if (opts.rules !== "chess") return false;
  if (!opts.url) return false;
  return true;
}
