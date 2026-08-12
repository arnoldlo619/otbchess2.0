/**
 * Trusted Matchup Prep analysis launch URLs.
 *
 * Browser URLs carry only immutable report/game identifiers and a local return
 * destination. The server derives FEN, orientation, provider embeds, and PGN.
 */
import type { AnalysisLaunchSubject } from "../../../shared/prepTypes";

type Provider = "lichess" | "chesscom" | "chessotb";

export function buildSourceGameAnalysisUrl(opts: {
  reportCacheKey: string;
  sourceGameUrl: string;
  provider: Provider;
  evidenceClaimId?: string;
  returnPath?: string;
  initialPly?: number;
}): string | null {
  const gameId = extractGameId(opts.sourceGameUrl, opts.provider);
  if (!gameId) return null;
  return buildAnalysisUrl({
    kind: "source-game",
    reportCacheKey: opts.reportCacheKey,
    sourceGameKey: `${opts.provider}:${gameId}`,
    initialPly: opts.initialPly ?? 0,
    evidenceClaimId: opts.evidenceClaimId,
  }, opts.returnPath);
}

export function buildPositionAnalysisUrl(opts: {
  reportCacheKey: string;
  canonicalUciPath: string[];
  evidenceClaimId?: string;
  returnPath?: string;
  sourceGameUrl?: string;
  provider?: Provider;
}): string | null {
  if (!opts.canonicalUciPath.every(uci => /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci))) return null;
  const gameId = opts.sourceGameUrl && opts.provider ? extractGameId(opts.sourceGameUrl, opts.provider) : null;
  return buildAnalysisUrl({
    kind: "report-position",
    reportCacheKey: opts.reportCacheKey,
    canonicalUciPath: opts.canonicalUciPath,
    evidenceClaimId: opts.evidenceClaimId,
    sourceGameKey: gameId && opts.provider ? `${opts.provider}:${gameId}` : undefined,
  }, opts.returnPath);
}

function buildAnalysisUrl(subject: AnalysisLaunchSubject, returnPath?: string): string {
  const params = new URLSearchParams();
  params.set("subject", JSON.stringify(subject));
  if (returnPath?.startsWith("/prep")) params.set("return", returnPath);
  return `/prep/analysis?${params.toString()}`;
}

function extractGameId(url: string, provider: Provider): string | null {
  if (provider === "lichess") return url.match(/lichess\.org\/([A-Za-z0-9]{8})(?:\/|$|\?)/)?.[1] ?? null;
  if (provider === "chesscom") return url.match(/chess\.com\/game\/(?:live|daily)\/(\d+)/)?.[1] ?? null;
  return url.split("/").filter(Boolean).pop() ?? null;
}

export function isEligibleForAnalysis(opts: { url: string; result: string; rules: string }): boolean {
  return Boolean(opts.url) && opts.result !== "*" && opts.rules === "chess";
}
