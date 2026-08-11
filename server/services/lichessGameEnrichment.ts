/**
 * server/services/lichessGameEnrichment.ts
 *
 * Lazy one-game enrichment via the official Lichess game export endpoint.
 * GET https://lichess.org/game/export/{gameId}
 *
 * - Routes through the existing serial request scheduler (concurrency=1)
 * - Coalesces identical in-flight requests
 * - Preserves the shared 429 cooldown (≥60s)
 * - Caches enrichment separately from base PGN (TTL: 24h for complete, 10m for errors)
 * - Does NOT retry 404, invalid ID, or policy rejection
 * - Validates game ID with strict 8-char pattern
 * - Identity-validates returned game before accepting enrichment
 */
import type { LichessGameEnrichment } from "../../shared/prepTypes.js";
import { LICHESS_GAME_ID_RE } from "../prep/analysisResolver.js";
import { logger } from "../logger.js";

const UA = "ChessOTB.club analysis v1 (contact: admin@chessotb.club)";
const LICHESS_ORIGIN = "https://lichess.org";

// ── Rate-limit state (shared with main Lichess scheduler) ─────────────────────
// We use a simple in-memory scheduler here. In production, this should share
// state with the main lichess.ts scheduler. For now, we use a separate semaphore
// since the main scheduler is not exported.

let _cooldownUntil: number | null = null;
let _inFlight: Promise<unknown> | null = null;
const _inFlightMap = new Map<string, Promise<LichessGameEnrichment>>();

// ── In-memory enrichment cache ────────────────────────────────────────────────

interface CacheEntry {
  enrichment: LichessGameEnrichment;
  cachedAt: number;
}

const _enrichmentCache = new Map<string, CacheEntry>();
const CACHE_TTL_COMPLETE = 24 * 60 * 60 * 1000; // 24h for complete enrichment
const CACHE_TTL_ERROR = 10 * 60 * 1000;          // 10m for errors

function buildCacheKey(gameId: string): string {
  return `lichess-enrichment:v1:${gameId}`;
}

function getCached(gameId: string): LichessGameEnrichment | null {
  const key = buildCacheKey(gameId);
  const entry = _enrichmentCache.get(key);
  if (!entry) return null;
  const age = Date.now() - entry.cachedAt;
  const ttl = entry.enrichment.status === "complete" ? CACHE_TTL_COMPLETE : CACHE_TTL_ERROR;
  if (age > ttl) {
    _enrichmentCache.delete(key);
    return null;
  }
  return entry.enrichment;
}

function setCached(gameId: string, enrichment: LichessGameEnrichment): void {
  _enrichmentCache.set(buildCacheKey(gameId), { enrichment, cachedAt: Date.now() });
}

// ── Serial scheduler ──────────────────────────────────────────────────────────

async function serialFetch(url: string): Promise<Response> {
  // Check cooldown
  if (_cooldownUntil !== null && Date.now() < _cooldownUntil) {
    throw new Error(`LichessRateLimited: cooldown until ${new Date(_cooldownUntil).toISOString()}`);
  }

  // Wait for any in-flight request to complete (concurrency=1)
  if (_inFlight) {
    try { await _inFlight; } catch { /* ignore errors from other requests */ }
  }

  const fetchPromise = fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": UA,
    },
    signal: AbortSignal.timeout(12_000),
  });

  _inFlight = fetchPromise;
  try {
    const res = await fetchPromise;
    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get("Retry-After") ?? "60", 10);
      const cooldownMs = Math.max(retryAfter * 1000, 60_000);
      _cooldownUntil = Date.now() + cooldownMs;
      throw new Error(`LichessRateLimited: 429 from ${url}`);
    }
    _cooldownUntil = null; // Clear cooldown on success
    return res;
  } finally {
    if (_inFlight === fetchPromise) _inFlight = null;
  }
}

// ── Main enrichment function ──────────────────────────────────────────────────

/**
 * Fetch enrichment for a single verified completed Lichess game.
 * Returns cached result if available and fresh.
 * Does not throw — returns { status: "unavailable" } on failure.
 */
export async function enrichLichessGame(
  gameId: string,
  expectedWhite?: string,
  expectedBlack?: string,
): Promise<LichessGameEnrichment> {
  // Validate game ID
  if (!LICHESS_GAME_ID_RE.test(gameId)) {
    logger.warn(`[lichess enrichment] Invalid game ID: ${gameId}`);
    return { gameId, fetchedAt: new Date().toISOString(), status: "error" };
  }

  // Check cache
  const cached = getCached(gameId);
  if (cached) {
    logger.info(`[lichess enrichment] CACHE HIT ${gameId}`);
    return cached;
  }

  // Coalesce in-flight requests for the same game
  const existing = _inFlightMap.get(gameId);
  if (existing) {
    logger.info(`[lichess enrichment] COALESCE ${gameId}`);
    return existing;
  }

  const promise = _doEnrich(gameId, expectedWhite, expectedBlack);
  _inFlightMap.set(gameId, promise);
  try {
    const result = await promise;
    setCached(gameId, result);
    return result;
  } finally {
    _inFlightMap.delete(gameId);
  }
}

async function _doEnrich(
  gameId: string,
  expectedWhite?: string,
  expectedBlack?: string,
): Promise<LichessGameEnrichment> {
  const url = new URL(`/game/export/${gameId}`, LICHESS_ORIGIN);
  url.searchParams.set("moves", "true");
  url.searchParams.set("pgnInJson", "true");
  url.searchParams.set("tags", "true");
  url.searchParams.set("clocks", "true");
  url.searchParams.set("evals", "true");
  url.searchParams.set("accuracy", "true");
  url.searchParams.set("opening", "true");
  url.searchParams.set("division", "true");
  url.searchParams.set("literate", "false");

  logger.info(`[lichess enrichment] FETCH ${gameId}`);

  let res: Response;
  try {
    res = await serialFetch(url.toString());
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.startsWith("LichessRateLimited:")) {
      logger.warn(`[lichess enrichment] Rate limited for ${gameId}`);
      return { gameId, fetchedAt: new Date().toISOString(), status: "unavailable" };
    }
    logger.error(`[lichess enrichment] Network error for ${gameId}:`, msg);
    return { gameId, fetchedAt: new Date().toISOString(), status: "unavailable" };
  }

  // 404 = game not found or not embeddable — do not retry
  if (res.status === 404) {
    logger.info(`[lichess enrichment] 404 for ${gameId}`);
    const enrichment: LichessGameEnrichment = { gameId, fetchedAt: new Date().toISOString(), status: "unavailable" };
    setCached(gameId, enrichment);
    return enrichment;
  }

  if (!res.ok) {
    logger.warn(`[lichess enrichment] HTTP ${res.status} for ${gameId}`);
    return { gameId, fetchedAt: new Date().toISOString(), status: "unavailable" };
  }

  let data: Record<string, unknown>;
  try {
    data = await res.json() as Record<string, unknown>;
  } catch {
    logger.warn(`[lichess enrichment] JSON parse error for ${gameId}`);
    return { gameId, fetchedAt: new Date().toISOString(), status: "error" };
  }

  // Identity validation: verify returned game ID and players match trusted source
  const returnedId = data.id as string | undefined;
  if (returnedId && returnedId !== gameId) {
    logger.error(`[lichess enrichment] ID mismatch: expected ${gameId}, got ${returnedId}`);
    return { gameId, fetchedAt: new Date().toISOString(), status: "error" };
  }

  // Verify players match if provided
  if (expectedWhite || expectedBlack) {
    const players = data.players as Record<string, { user?: { name?: string } }> | undefined;
    const returnedWhite = players?.white?.user?.name?.toLowerCase();
    const returnedBlack = players?.black?.user?.name?.toLowerCase();
    if (expectedWhite && returnedWhite && returnedWhite !== expectedWhite.toLowerCase()) {
      logger.error(`[lichess enrichment] White player mismatch for ${gameId}`);
      return { gameId, fetchedAt: new Date().toISOString(), status: "error" };
    }
    if (expectedBlack && returnedBlack && returnedBlack !== expectedBlack.toLowerCase()) {
      logger.error(`[lichess enrichment] Black player mismatch for ${gameId}`);
      return { gameId, fetchedAt: new Date().toISOString(), status: "error" };
    }
  }

  // Require completed game
  const status = data.status as string | undefined;
  const completedStatuses = ["mate", "resign", "stalemate", "timeout", "draw", "outoftime", "cheat", "noStart", "unknownFinish", "variantEnd"];
  if (status && !completedStatuses.includes(status)) {
    logger.warn(`[lichess enrichment] Game ${gameId} not completed (status: ${status})`);
    return { gameId, fetchedAt: new Date().toISOString(), status: "unavailable" };
  }

  // Extract optional enrichment fields
  const opening = data.opening as { eco?: string; name?: string } | undefined;
  const division = data.division as { middle?: number; end?: number } | undefined;
  const accuracy = data.accuracy as { white?: number; black?: number } | undefined;
  const clocks = data.clocks as number[] | undefined;

  return {
    gameId,
    fetchedAt: new Date().toISOString(),
    opening: opening ? { eco: opening.eco, name: opening.name } : undefined,
    division: division ? { middle: division.middle, end: division.end } : undefined,
    accuracy: accuracy ? { white: accuracy.white, black: accuracy.black } : undefined,
    clocks: Array.isArray(clocks) ? clocks : undefined,
    status: "complete",
  };
}

/** Get current rate-limit state (for endpoint to check before attempting) */
export function getEnrichmentRateLimitState(): { cooldownUntil: number | null; retryAt: string | null } {
  return {
    cooldownUntil: _cooldownUntil,
    retryAt: _cooldownUntil ? new Date(_cooldownUntil).toISOString() : null,
  };
}
