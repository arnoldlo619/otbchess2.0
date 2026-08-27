/**
 * Matchup Prep routes — extracted from server/index.ts.
 *
 * Handles prep report generation (V2 + V3), openings breakdown,
 * analysis workspace resolution, Lichess game enrichment,
 * saved prep reports CRUD, and coach insight LLM endpoint.
 */
import { Router, type Request, type RequestHandler, type Response } from "express";
import { eq, and, or, desc } from "drizzle-orm";
import { rateLimit, ipKeyGenerator } from "express-rate-limit";
import { getDb } from "./db.js";
import { prepCache, savedPrepReports, gameSessions } from "../shared/schema.js";
import { logger } from "./logger.js";
import { validate, prepResolveSchema, prepSaveSchema, coachInsightSchema } from "./validation.js";
import { buildPrepReport, ENGINE_VERSION } from "./prepEngine.js";
import { resolveAnalysisWorkspace } from "./prep/analysisResolver.js";
import { enrichLichessGame, getEnrichmentRateLimitState } from "./services/lichessGameEnrichment.js";
import { buildCachedPrepAnalysisReport, ENGINE_VERSION as ENGINE_VERSION_V3 } from "./prep/buildReport.js";
import { fetchChesscom } from "./services/chesscom.js";
import { fetchLichess } from "./services/lichess.js";
import { derivePopulationCandidates } from "./population/candidates.js";
import { resolvePopulationReference } from "./population/resolver.js";
import { registerTrackedPopulationPosition } from "./population/tracked.js";
import type { AnalysisLaunchSubject, CachedPrepAnalysisReport, FetchOpts, PrepErrorPayload } from "../shared/prepTypes.js";
import {
  SCOUT_ARCHIVE_MONTHS,
  activeScoutRequestFromQuery,
  scoutRequestCacheKey,
} from "../shared/scoutRequest.js";
import { requireAuth } from "./auth.js";

// ── Prep cache TTL ───────────────────────────────────────────────────────────
const PREP_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type AuthenticatedRequest = Request & { userId: string };

function withAuthenticatedUser(
  handler: (req: AuthenticatedRequest, res: Response) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    void handler(req as AuthenticatedRequest, res).catch(next);
  };
}

// ── In-memory analysis report bridge ─────────────────────────────────────────
const PREP_ANALYSIS_MEMORY_TTL_MS = 24 * 60 * 60 * 1000;
const prepAnalysisMemory = new Map<string, { value: CachedPrepAnalysisReport; cachedAt: number }>();

function rememberPrepAnalysisReport(cacheKey: string, value: CachedPrepAnalysisReport): void {
  prepAnalysisMemory.set(cacheKey, { value, cachedAt: Date.now() });
}

function readRememberedPrepAnalysisReport(cacheKey: string): CachedPrepAnalysisReport | null {
  const entry = prepAnalysisMemory.get(cacheKey);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > PREP_ANALYSIS_MEMORY_TTL_MS) {
    prepAnalysisMemory.delete(cacheKey);
    return null;
  }
  return entry.value;
}

// ── Cache helper ─────────────────────────────────────────────────────────────
async function getCachedOrBuildPrepReport(
  username: string,
  maxGames: number,
  timeClasses: string[] = ["rapid", "blitz"],
) {
  const normalised = username.toLowerCase().trim();
  const tcKey = timeClasses.length === 1 ? timeClasses[0] : "all";
  const cacheKey = `${normalised}:${tcKey}`;
  try {
    const db = await getDb();
    const [cached] = await db.select().from(prepCache).where(eq(prepCache.username, cacheKey)).limit(1);
    if (cached) {
      const age = Date.now() - new Date(cached.cachedAt).getTime();
      const versionMatch = cached.engineVersion === ENGINE_VERSION;
      if (age < PREP_CACHE_TTL_MS && versionMatch) {
        return { report: JSON.parse(cached.reportJson), fromCache: true };
      }
      if (!versionMatch) {
        logger.info(`[prep-cache] VERSION MISMATCH for ${cacheKey} (cached: ${cached.engineVersion}, current: ${ENGINE_VERSION}) — rebuilding`);
      }
    }
  } catch (dbErr) {
    logger.warn("[prep-cache] DB read error, falling through to live fetch:", dbErr);
  }
  let _prepDb;
  try { _prepDb = await getDb(); } catch { /* non-fatal */ }
  const report = await buildPrepReport(normalised, timeClasses, "white", _prepDb);
  try {
    const db = await getDb();
    const reportStr = JSON.stringify(report);
    await db.insert(prepCache).values({
      username: cacheKey,
      reportJson: reportStr,
      gamesAnalyzed: report.opponent.gamesAnalyzed,
      cachedAt: new Date(),
      engineVersion: ENGINE_VERSION,
    }).onDuplicateKeyUpdate({
      set: { reportJson: reportStr, gamesAnalyzed: report.opponent.gamesAnalyzed, cachedAt: new Date(), engineVersion: ENGINE_VERSION },
    });
  } catch (dbErr) {
    logger.warn("[prep-cache] DB write error (non-fatal):", dbErr);
  }
  return { report, fromCache: false };
}

// ── Rate limiter ─────────────────────────────────────────────────────────────
const prepLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  keyGenerator: (req: Request) => ipKeyGenerator(req.ip ?? ""),
  message: { error: "Too many prep requests — please wait a moment." },
  skip: () => process.env.NODE_ENV !== "production",
});

export function createPrepRouter(): Router {
  const router = Router();

  // GET /:username — full matchup prep report (V2 + V3)
  router.get("/:username", prepLimiter, async (req, res) => {
    const username = req.params.username;
    if (!username || username.length < 2 || username.length > 50) {
      const errPayload: PrepErrorPayload = { error: "invalid_username", message: "Username must be 2–50 characters." };
      res.status(400).json(errPayload);
      return;
    }

    // V3 path (?schema=3)
    if (req.query.schema === "3") {
      try {
        const activeRequest = activeScoutRequestFromQuery(username, req.query as Record<string, string | string[] | undefined>);
        const normalised = activeRequest.normalizedUsername;
        const maxGames = activeRequest.maxGames;
        const timeClasses = activeRequest.formats;
        const provider = activeRequest.platform;
        const forceRefresh = req.query.refresh === "true";
        const cacheKey = scoutRequestCacheKey(activeRequest);

        if (!forceRefresh) {
          try {
            const db = await getDb();
            const [cached] = await db.select().from(prepCache).where(eq(prepCache.username, cacheKey)).limit(1);
            if (cached) {
              const age = Date.now() - new Date(cached.cachedAt).getTime();
              const versionMatch = cached.engineVersion === ENGINE_VERSION_V3;
              if (age < PREP_CACHE_TTL_MS && versionMatch) {
                const payload = JSON.parse(cached.reportJson) as CachedPrepAnalysisReport | import("../shared/prepTypes.js").ScoutReportV3;
                if ("schemaVersion" in payload && payload.schemaVersion === 1 && "analysisSnapshot" in payload) {
                  res.json({ ...payload.report, _cached: true });
                  return;
                }
              }
            }
          } catch { /* non-fatal */ }
        }

        const fetchOpts: FetchOpts = { maxGames, months: SCOUT_ARCHIVE_MONTHS, timeClasses, ratedOnly: true };
        const raw = provider === "lichess"
          ? await fetchLichess(normalised, fetchOpts)
          : await fetchChesscom(normalised, fetchOpts);

        const cachedReport = buildCachedPrepAnalysisReport(provider, normalised, raw, fetchOpts, cacheKey, activeRequest);
        const report = cachedReport.report;
        if (provider === "lichess") {
          const [candidate] = derivePopulationCandidates(raw, normalised, fetchOpts);
          if (candidate) {
            await registerTrackedPopulationPosition(candidate);
            report.populationReferences = [await resolvePopulationReference(candidate, { allowNetwork: false })];
          }
        }
        rememberPrepAnalysisReport(cacheKey, cachedReport);

        try {
          const db = await getDb();
          const reportStr = JSON.stringify(cachedReport);
          await db.insert(prepCache).values({
            username: cacheKey, reportJson: reportStr,
            gamesAnalyzed: report.dataQuality.parsed, cachedAt: new Date(), engineVersion: ENGINE_VERSION_V3,
          }).onDuplicateKeyUpdate({
            set: { reportJson: reportStr, gamesAnalyzed: report.dataQuality.parsed, cachedAt: new Date(), engineVersion: ENGINE_VERSION_V3 },
          });
        } catch { /* non-fatal */ }

        res.json({ ...report, _cached: false });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        logger.error("[prep v3]", msg);
        if (msg.startsWith("PlayerNotFound:")) {
          res.status(404).json({ error: "not_found", message: `Player "${username}" was not found on the selected provider.` } as PrepErrorPayload);
        } else if (msg.startsWith("NoRecentGames:")) {
          res.status(404).json({ error: "no_recent_games", message: `No eligible Rapid, Blitz, or Bullet games found for "${username}".` } as PrepErrorPayload);
        } else if (msg.startsWith("NoUsableGames:")) {
          res.status(422).json({ error: "all_filtered", message: `All games for "${username}" were filtered out (unrated, wrong time control, or corrupt).` } as PrepErrorPayload);
        } else if (msg.startsWith("UpstreamRateLimited:")) {
          res.status(429).json({ error: "upstream_rate_limited", message: "The chess provider is rate-limiting requests. Please try again in a few minutes." } as PrepErrorPayload);
        } else {
          res.status(502).json({ error: "all_filtered", message: "Could not generate prep report. Please try again." } as PrepErrorPayload);
        }
      }
      return;
    }

    // V2 legacy path
    try {
      const maxGames = Math.min(parseInt(req.query.games as string) || 50, 100);
      const forceRefresh = req.query.refresh === "true";
      const tcParam = (req.query.tc as string) || "all";
      const timeClasses: string[] = tcParam === "rapid" ? ["rapid"] : tcParam === "blitz" ? ["blitz"] : ["rapid", "blitz"];

      if (forceRefresh) {
        const normalised = username.toLowerCase().trim();
        const tcKey = timeClasses.length === 1 ? timeClasses[0] : "all";
        const cacheKey = `${normalised}:${tcKey}`;
        let _refreshDb;
        try { _refreshDb = await getDb(); } catch { /* non-fatal */ }
        const report = await buildPrepReport(normalised, timeClasses, "white", _refreshDb);
        try {
          const db = await getDb();
          const reportStr = JSON.stringify(report);
          await db.insert(prepCache).values({
            username: cacheKey, reportJson: reportStr,
            gamesAnalyzed: report.opponent.gamesAnalyzed, cachedAt: new Date(), engineVersion: ENGINE_VERSION,
          }).onDuplicateKeyUpdate({
            set: { reportJson: reportStr, gamesAnalyzed: report.opponent.gamesAnalyzed, cachedAt: new Date(), engineVersion: ENGINE_VERSION },
          });
        } catch { /* non-fatal */ }
        res.json({ ...report, _cached: false });
        return;
      }

      const { report, fromCache } = await getCachedOrBuildPrepReport(username, maxGames, timeClasses);
      res.json({ ...report, _cached: fromCache });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      logger.error("[prep engine]", msg);
      if (msg.includes("archives error: 404")) {
        res.status(404).json({ error: "Player not found on chess.com" });
      } else {
        res.status(502).json({ error: "Could not generate prep report" });
      }
    }
  });

  // GET /:username/openings
  router.get("/:username/openings", prepLimiter, async (req, res) => {
    try {
      const username = req.params.username;
      if (!username || username.length < 2 || username.length > 50) {
        res.status(400).json({ error: "Invalid username" }); return;
      }
      const maxGames = Math.min(parseInt(req.query.games as string) || 50, 100);
      const { report, fromCache } = await getCachedOrBuildPrepReport(username, maxGames);
      res.json({
        username: report.opponent.username,
        gamesAnalyzed: report.opponent.gamesAnalyzed,
        whiteOpenings: report.opponent.whiteOpenings,
        blackOpenings: report.opponent.blackOpenings,
        firstMoveAsWhite: report.opponent.firstMoveAsWhite,
        _cached: fromCache,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      logger.error("[prep openings]", msg);
      if (msg.includes("archives error: 404")) {
        res.status(404).json({ error: "Player not found on chess.com" });
      } else {
        res.status(502).json({ error: "Could not fetch opening data" });
      }
    }
  });

  // POST /analysis/resolve
  router.post("/analysis/resolve", requireAuth, prepLimiter, validate(prepResolveSchema), async (req, res) => {
    try {
      const { subject } = req.body as { subject: unknown };
      if (!subject || typeof subject !== "object") {
        res.status(400).json({ ok: false, error: "invalid_request", message: "Missing subject." }); return;
      }
      const s = subject as Record<string, unknown>;
      if (!s.kind || !s.reportCacheKey) {
        res.status(400).json({ ok: false, error: "invalid_request", message: "Missing kind or reportCacheKey." }); return;
      }
      if (s.kind !== "source-game" && s.kind !== "report-position") {
        res.status(400).json({ ok: false, error: "invalid_request", message: "Unsupported analysis launch kind." }); return;
      }
      if (s.kind === "source-game" && (typeof s.sourceGameKey !== "string" || (s.initialPly !== undefined && (!Number.isInteger(s.initialPly) || Number(s.initialPly) < 0)))) {
        res.status(400).json({ ok: false, error: "invalid_request", message: "Invalid source-game launch context." }); return;
      }
      if (s.kind === "report-position" && (!Array.isArray(s.canonicalUciPath) || !s.canonicalUciPath.every(move => typeof move === "string"))) {
        res.status(400).json({ ok: false, error: "invalid_request", message: "Invalid report-position launch context." }); return;
      }

      const userId = (req as import("express").Request & { userId?: string }).userId;
      if (!userId) {
        res.status(401).json({ ok: false, error: "access_denied", message: "Sign in to use analysis." }); return;
      }

      const cacheKey = String(s.reportCacheKey);
      let cachedReport: CachedPrepAnalysisReport | null = readRememberedPrepAnalysisReport(cacheKey);
      try {
        if (!cachedReport) {
          const db = await getDb();
          const [cached] = await db.select().from(prepCache).where(eq(prepCache.username, cacheKey)).limit(1);
          if (cached) {
            const parsed = JSON.parse(cached.reportJson) as CachedPrepAnalysisReport;
            if (parsed.schemaVersion === 1 && parsed.analysisSnapshot?.reportCacheKey === cacheKey && parsed.report?.reportSnapshot?.id === cacheKey) {
              cachedReport = parsed;
              rememberPrepAnalysisReport(cacheKey, parsed);
            }
          }
        }
      } catch (err) {
        logger.error("[analysis resolve] Cache read error:", err);
      }

      if (!cachedReport) {
        res.status(404).json({ ok: false, error: "report_not_found", message: "Report not found. Please re-run Matchup Prep." }); return;
      }

      const db = await getDb();
      const activeSessions = await db.select({ id: gameSessions.id }).from(gameSessions)
        .where(and(
          or(eq(gameSessions.hostUserId, userId), eq(gameSessions.opponentUserId, userId)),
          eq(gameSessions.status, "clock_started"),
        )).limit(1);
      if (activeSessions.length > 0) {
        res.status(409).json({ ok: false, error: "active_game", message: "Analysis is unavailable while your ChessOTB clock is running." }); return;
      }

      const outcome = resolveAnalysisWorkspace({
        subject: s as AnalysisLaunchSubject,
        report: cachedReport.report,
        snapshot: cachedReport.analysisSnapshot,
        reportCreatedAt: cachedReport.analysisSnapshot.createdAt,
      });

      if (!outcome.ok) {
        const statusMap: Record<string, number> = {
          report_not_found: 404, game_not_found: 404, game_not_in_report: 404,
          game_unfinished: 422, game_malformed: 422, position_illegal: 422,
          position_not_in_report: 422, ply_out_of_range: 400,
          cross_report_substitution: 403, access_denied: 403, active_game: 409,
          unsupported_variant: 422, invalid_request: 400,
        };
        res.status(statusMap[outcome.error] ?? 400).json(outcome); return;
      }
      res.json(outcome);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error("[analysis resolve]", msg.slice(0, 200));
      res.status(500).json({ ok: false, error: "invalid_request", message: "Internal error resolving analysis workspace." });
    }
  });

  // GET /analysis/enrich/:gameId
  router.get("/analysis/enrich/:gameId", requireAuth, prepLimiter, async (req, res) => {
    const { gameId } = req.params;
    if (!gameId || !/^[A-Za-z0-9]{8}$/.test(gameId)) {
      res.status(400).json({ error: "invalid_game_id", message: "Game ID must be exactly 8 alphanumeric characters." }); return;
    }
    const reportCacheKey = typeof req.query.reportCacheKey === "string" ? req.query.reportCacheKey : "";
    const sourceGameKey = typeof req.query.sourceGameKey === "string" ? req.query.sourceGameKey : "";
    if (!reportCacheKey || sourceGameKey !== `lichess:${gameId}`) {
      res.status(400).json({ error: "invalid_request", message: "Trusted report and source-game identifiers are required." }); return;
    }
    try {
      const db = await getDb();
      const [cached] = await db.select().from(prepCache).where(eq(prepCache.username, reportCacheKey)).limit(1);
      const parsed = cached ? JSON.parse(cached.reportJson) as CachedPrepAnalysisReport : null;
      const source = parsed?.schemaVersion === 1 && parsed.analysisSnapshot?.reportCacheKey === reportCacheKey
        ? parsed.analysisSnapshot.sourceGames.find(game => game.sourceGameKey === sourceGameKey)
        : undefined;
      if (!source || source.provider !== "lichess" || source.providerGameId !== gameId || source.result === "*" || source.rules !== "chess") {
        res.status(404).json({ error: "game_not_in_report", message: "This completed Lichess evidence game is not available for enrichment." }); return;
      }
      const userId = (req as import("express").Request & { userId?: string }).userId;
      if (userId) {
        const active = await db.select({ id: gameSessions.id }).from(gameSessions).where(and(
          or(eq(gameSessions.hostUserId, userId), eq(gameSessions.opponentUserId, userId)),
          eq(gameSessions.status, "clock_started"),
        )).limit(1);
        if (active.length > 0) {
          res.status(409).json({ error: "active_game", message: "Analysis enrichment is unavailable while your ChessOTB clock is running." }); return;
        }
      }
      const rlState = getEnrichmentRateLimitState();
      if (rlState.cooldownUntil !== null && Date.now() < rlState.cooldownUntil) {
        res.status(429).json({ error: "rate_limited", message: "Lichess is rate-limiting requests.", retryAt: rlState.retryAt }); return;
      }
      const enrichment = await enrichLichessGame(gameId, source.white, source.black);
      res.json(enrichment);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error("[analysis enrich]", msg.slice(0, 200));
      res.status(502).json({ error: "enrichment_unavailable", message: "Could not fetch game enrichment." });
    }
  });

  // POST /saved — save a prep report
  router.post("/saved", requireAuth, validate(prepSaveSchema), withAuthenticatedUser(async (req, res) => {
    try {
      const { userId } = req;
      const { opponentUsername, opponentName, winRate, gamesAnalyzed, prepLinesCount, reportJson } = req.body;
      if (!opponentUsername || !reportJson) {
        res.status(400).json({ error: "opponentUsername and reportJson are required" }); return;
      }
      const db = await getDb();
      const [existing] = await db.select({ id: savedPrepReports.id })
        .from(savedPrepReports)
        .where(and(eq(savedPrepReports.userId, userId), eq(savedPrepReports.opponentUsername, opponentUsername.toLowerCase().trim())))
        .limit(1);
      if (existing) {
        await db.update(savedPrepReports)
          .set({
            opponentName: opponentName ?? null, winRate: winRate ?? null,
            gamesAnalyzed: gamesAnalyzed ?? null, prepLinesCount: prepLinesCount ?? null,
            reportJson: typeof reportJson === "string" ? reportJson : JSON.stringify(reportJson),
            savedAt: new Date(),
          }).where(eq(savedPrepReports.id, existing.id));
        res.json({ id: existing.id, updated: true });
      } else {
        const [result] = await db.insert(savedPrepReports).values({
          userId, opponentUsername: opponentUsername.toLowerCase().trim(),
          opponentName: opponentName ?? null, winRate: winRate ?? null,
          gamesAnalyzed: gamesAnalyzed ?? null, prepLinesCount: prepLinesCount ?? null,
          reportJson: typeof reportJson === "string" ? reportJson : JSON.stringify(reportJson),
        });
        res.json({ id: result.insertId, updated: false });
      }
    } catch (err) {
      logger.error("[saved-prep] save error:", err);
      res.status(500).json({ error: "Failed to save prep report" });
    }
  }));

  // GET /saved — list saved reports
  router.get("/saved", requireAuth, withAuthenticatedUser(async (req, res) => {
    try {
      const { userId } = req;
      const db = await getDb();
      const rows = await db.select({
        id: savedPrepReports.id, opponentUsername: savedPrepReports.opponentUsername,
        opponentName: savedPrepReports.opponentName, winRate: savedPrepReports.winRate,
        gamesAnalyzed: savedPrepReports.gamesAnalyzed, prepLinesCount: savedPrepReports.prepLinesCount,
        savedAt: savedPrepReports.savedAt,
      }).from(savedPrepReports).where(eq(savedPrepReports.userId, userId))
        .orderBy(desc(savedPrepReports.savedAt)).limit(50);
      res.json({ reports: rows });
    } catch (err) {
      logger.error("[saved-prep] list error:", err);
      res.status(500).json({ error: "Failed to fetch saved reports" });
    }
  }));

  // GET /saved/:id — get full report
  router.get("/saved/:id", requireAuth, withAuthenticatedUser(async (req, res) => {
    try {
      const { userId } = req;
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
      const db = await getDb();
      const [row] = await db.select().from(savedPrepReports)
        .where(and(eq(savedPrepReports.id, id), eq(savedPrepReports.userId, userId))).limit(1);
      if (!row) { res.status(404).json({ error: "Report not found" }); return; }
      res.json({ report: JSON.parse(row.reportJson), meta: {
        id: row.id, opponentUsername: row.opponentUsername, opponentName: row.opponentName,
        winRate: row.winRate, gamesAnalyzed: row.gamesAnalyzed,
        prepLinesCount: row.prepLinesCount, savedAt: row.savedAt,
      }});
    } catch (err) {
      logger.error("[saved-prep] get error:", err);
      res.status(500).json({ error: "Failed to fetch saved report" });
    }
  }));

  // DELETE /saved/:id
  router.delete("/saved/:id", requireAuth, withAuthenticatedUser(async (req, res) => {
    try {
      const { userId } = req;
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
      const db = await getDb();
      await db.delete(savedPrepReports)
        .where(and(eq(savedPrepReports.id, id), eq(savedPrepReports.userId, userId)));
      res.json({ deleted: true });
    } catch (err) {
      logger.error("[saved-prep] delete error:", err);
      res.status(500).json({ error: "Failed to delete saved report" });
    }
  }));

  // POST /coach-insight — LLM-powered coaching insight
  router.post("/coach-insight", requireAuth, rateLimit({ windowMs: 60_000, max: 10 }), validate(coachInsightSchema), withAuthenticatedUser(async (req, res) => {
    try {
      const { promptJson } = req.body;
      if (!promptJson || typeof promptJson !== "string") {
        res.status(400).json({ error: "promptJson is required" }); return;
      }
      if (promptJson.length > 8_000) {
        res.status(413).json({ error: "promptJson too large" }); return;
      }
      let parsed: { system: string; user: string };
      try { parsed = JSON.parse(promptJson); } catch {
        res.status(400).json({ error: "Invalid promptJson format" }); return;
      }
      const ALLOWED_SYSTEM_PREFIX = "You are a chess coach";
      if (typeof parsed.system !== "string" || !parsed.system.trimStart().startsWith(ALLOWED_SYSTEM_PREFIX)) {
        res.status(400).json({ error: "Invalid system prompt" }); return;
      }
      if (typeof parsed.user !== "string" || parsed.user.length < 10 || parsed.user.length > 4_000) {
        res.status(400).json({ error: "Invalid user prompt" }); return;
      }
      const forgeApiKey = process.env.BUILT_IN_FORGE_API_KEY;
      const forgeApiUrl = process.env.BUILT_IN_FORGE_API_URL;
      if (!forgeApiKey || !forgeApiUrl) {
        res.json({ insight: "Coach insight is not available in this environment. Please configure the LLM API credentials.", model: "unavailable" });
        return;
      }
      const llmRes = await fetch(`${forgeApiUrl}/v1/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${forgeApiKey}` },
        body: JSON.stringify({
          model: "gpt-5-mini",
          messages: [{ role: "system", content: parsed.system }, { role: "user", content: parsed.user }],
          max_completion_tokens: 220, temperature: 0.7,
        }),
      });
      if (!llmRes.ok) {
        const errText = await llmRes.text().catch(() => "unknown error");
        logger.error("[coach-insight] LLM error:", llmRes.status, errText);
        res.status(502).json({ error: "Coach insight generation failed. Please try again." }); return;
      }
      const llmData = await llmRes.json() as { choices?: Array<{ message?: { content?: string } }>; model?: string };
      const content = llmData.choices?.[0]?.message?.content;
      if (!content) { res.status(502).json({ error: "No insight returned from LLM" }); return; }
      res.json({ insight: content.trim(), model: llmData.model ?? "unknown" });
    } catch (err) {
      logger.error("[coach-insight] error:", err);
      res.status(500).json({ error: "Failed to generate coach insight" });
    }
  }));

  return router;
}
