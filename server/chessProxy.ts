/**
 * Chess provider proxy routes — extracted from server/index.ts.
 *
 * Handles chess.com player lookup, game analysis, ELO history,
 * lichess player/games proxy, avatar proxy (CORS-safe), and font proxy.
 */
import { Router } from "express";
import { rateLimit, ipKeyGenerator } from "express-rate-limit";
import { logger } from "./logger.js";

// ── CORS helper ──────────────────────────────────────────────────────────────
const PROXY_ALLOWED_ORIGINS = new Set([
  "https://chessotb.club",
  "https://www.chessotb.club",
  "https://otbchess.manus.space",
]);
function setProxyCors(req: any, res: any) {
  const origin = req.headers.origin as string | undefined;
  if (origin && PROXY_ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  } else if (process.env.NODE_ENV !== "production") {
    res.setHeader("Access-Control-Allow-Origin", "*");
  }
}

// ── Chess.com proxy helpers ──────────────────────────────────────────────────
const CHESS_COM_HEADERS = {
  "User-Agent": "OTBChess/1.0 (https://chessotb.club; tournament management app)",
  "Accept": "application/json",
};

async function proxyChessCom(username: string) {
  const u = encodeURIComponent(username.toLowerCase().trim());
  const res = await fetch(`https://api.chess.com/pub/player/${u}`, {
    headers: CHESS_COM_HEADERS,
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return { status: res.status === 404 ? 404 : 502, body: { error: "Player not found" } };
  const profile = await res.json();
  // Fetch stats for rating
  try {
    const statsRes = await fetch(`https://api.chess.com/pub/player/${u}/stats`, {
      headers: CHESS_COM_HEADERS,
      signal: AbortSignal.timeout(8000),
    });
    if (statsRes.ok) {
      const stats = await statsRes.json() as Record<string, unknown>;
      return { status: 200, body: { ...profile as Record<string, unknown>, stats } };
    }
  } catch { /* non-fatal */ }
  return { status: 200, body: profile };
}

async function proxyLichess(username: string) {
  const u = encodeURIComponent(username.toLowerCase().trim());
  const res = await fetch(`https://lichess.org/api/user/${u}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return { status: res.status === 404 ? 404 : 502, body: { error: "Player not found" } };
  return { status: 200, body: await res.json() };
}

// ── Rate limiter ─────────────────────────────────────────────────────────────
const chessProxyLimiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  keyGenerator: (req: any) => ipKeyGenerator(req.ip ?? ""),
  message: { error: "Too many player lookups — please wait a moment." },
  skip: () => process.env.NODE_ENV !== "production",
});

export function createChessProxyRouter(): Router {
  const router = Router();

  // GET /chess/player/:username
  router.get("/chess/player/:username", chessProxyLimiter, async (req, res) => {
    try {
      const { status, body } = await proxyChessCom(req.params.username);
      res.status(status).json(body);
    } catch (err) {
      logger.error("[chess proxy]", err);
      res.status(502).json({ error: "Could not reach chess.com" });
    }
  });

  // GET /chess/player/:username/analysis
  router.get("/chess/player/:username/analysis", chessProxyLimiter, async (req, res) => {
    try {
      const username = req.params.username.toLowerCase().trim();
      const archivesRes = await fetch(`https://api.chess.com/pub/player/${username}/games/archives`, { headers: CHESS_COM_HEADERS });
      if (!archivesRes.ok) {
        res.status(archivesRes.status === 404 ? 404 : 502).json({ error: "Player not found" });
        return;
      }
      const archivesData = await archivesRes.json() as { archives: string[] };
      const archives: string[] = archivesData.archives ?? [];
      const recentArchives = archives.slice(-2);
      const gameArrays = await Promise.all(
        recentArchives.map(async (url) => {
          const r = await fetch(url, { headers: CHESS_COM_HEADERS, signal: AbortSignal.timeout(8000) });
          if (!r.ok) return [];
          const d = await r.json() as { games: Record<string, unknown>[] };
          return d.games ?? [];
        }),
      );
      const allGames = gameArrays.flat();
      const last50 = allGames.slice(-50);

      const openingsWhite: Record<string, number> = {};
      const openingsBlack: Record<string, number> = {};
      let endgameTotal = 0, endgameWins = 0, totalWins = 0, totalDraws = 0, totalLosses = 0;

      for (const game of last50) {
        const pgn = (game.pgn as string) ?? "";
        const whitePlayer = game.white as Record<string, unknown>;
        const blackPlayer = game.black as Record<string, unknown>;
        const isWhite = (whitePlayer?.username as string)?.toLowerCase() === username;
        const isBlack = (blackPlayer?.username as string)?.toLowerCase() === username;
        const result = isWhite ? (whitePlayer?.result as string) : (blackPlayer?.result as string);
        const ecoMatch = pgn.match(/\[ECOUrl "[^"]*\/([^"]+)"\]/);
        const openingName = ecoMatch ? ecoMatch[1].replace(/-/g, " ") : null;
        if (openingName) {
          const formatted = openingName.split(" ").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
          if (isWhite) openingsWhite[formatted] = (openingsWhite[formatted] ?? 0) + 1;
          else if (isBlack) openingsBlack[formatted] = (openingsBlack[formatted] ?? 0) + 1;
        }
        const moveCount = (pgn.match(/\d+\./g) ?? []).length;
        if (moveCount >= 30) { endgameTotal++; if (result === "win") endgameWins++; }
        if (result === "win") totalWins++;
        else if (["stalemate", "insufficient", "50move", "repetition", "agreed", "timevsinsufficient"].includes(result as string)) totalDraws++;
        else if (result) totalLosses++;
      }

      const sortByFreq = (obj: Record<string, number>) =>
        Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, 3)
          .map(([name, count]) => ({ name, count, pct: Math.round((count / last50.length) * 100) }));

      res.json({
        gamesAnalyzed: last50.length,
        openingsWhite: sortByFreq(openingsWhite),
        openingsBlack: sortByFreq(openingsBlack),
        endgameWinPct: endgameTotal > 0 ? Math.round((endgameWins / endgameTotal) * 100) : null,
        endgameGames: endgameTotal,
        wins: totalWins, draws: totalDraws, losses: totalLosses,
      });
    } catch (err) {
      logger.error("[chess analysis proxy]", err);
      res.status(502).json({ error: "Could not analyze games" });
    }
  });

  // GET /chess/player/:username/elo-history
  router.get("/chess/player/:username/elo-history", chessProxyLimiter, async (req, res) => {
    try {
      const username = req.params.username.toLowerCase().trim();
      const archivesRes = await fetch(`https://api.chess.com/pub/player/${username}/games/archives`, {
        headers: CHESS_COM_HEADERS, signal: AbortSignal.timeout(8000),
      });
      if (!archivesRes.ok) {
        res.status(archivesRes.status === 404 ? 404 : 502).json({ error: "Player not found" });
        return;
      }
      const archivesData = await archivesRes.json() as { archives: string[] };
      const archives: string[] = archivesData.archives ?? [];
      if (archives.length === 0) {
        res.json({ games: [], minRating: null, maxRating: null, currentRating: null });
        return;
      }
      const recentArchives = archives.slice(-2);
      const gameArrays = await Promise.all(
        recentArchives.map(async (url) => {
          const r = await fetch(url, { headers: CHESS_COM_HEADERS, signal: AbortSignal.timeout(8000) });
          if (!r.ok) return [];
          const d = await r.json() as { games: Record<string, unknown>[] };
          return d.games ?? [];
        }),
      );
      const allGames = gameArrays.flat();
      const last50 = allGames.slice(-50);
      const eloSeries: { index: number; rating: number; result: string; timeClass: string; date: string }[] = [];
      for (let i = 0; i < last50.length; i++) {
        const game = last50[i] as Record<string, unknown>;
        const white = game.white as Record<string, unknown>;
        const black = game.black as Record<string, unknown>;
        const isWhite = (white?.username as string)?.toLowerCase() === username;
        const playerSide = isWhite ? white : black;
        const rating = playerSide?.rating as number | undefined;
        const result = (isWhite ? white?.result : black?.result) as string ?? "";
        const timeClass = (game.time_class as string) ?? "rapid";
        const endTime = game.end_time as number | undefined;
        const date = endTime ? new Date(endTime * 1000).toISOString().slice(0, 10) : "";
        if (rating) eloSeries.push({ index: i, rating, result, timeClass, date });
      }
      const ratings = eloSeries.map((g) => g.rating);
      res.json({
        games: eloSeries,
        minRating: ratings.length > 0 ? Math.min(...ratings) : null,
        maxRating: ratings.length > 0 ? Math.max(...ratings) : null,
        currentRating: ratings.length > 0 ? ratings[ratings.length - 1] : null,
      });
    } catch (err) {
      logger.error("[elo history proxy]", err);
      res.status(502).json({ error: "Could not fetch ELO history" });
    }
  });

  // GET /avatar-proxy
  router.get("/avatar-proxy", async (req, res) => {
    const raw = req.query.url as string | undefined;
    if (!raw) { res.status(400).json({ error: "Missing url parameter" }); return; }
    let targetUrl: string;
    try {
      const parsed = new URL(raw);
      const allowed = ["images.chess.com", "www.chess.com", "images.chesscomfiles.com", "lichess.org", "lichess1.org"];
      if (!allowed.some((h) => parsed.hostname === h || parsed.hostname.endsWith("." + h))) {
        res.status(403).json({ error: "Domain not allowed" }); return;
      }
      targetUrl = parsed.toString();
    } catch { res.status(400).json({ error: "Invalid url" }); return; }
    try {
      const upstream = await fetch(targetUrl, {
        headers: { "User-Agent": "OTBChess/1.0 (avatar proxy)" },
        signal: AbortSignal.timeout(8000),
      });
      if (!upstream.ok) { res.status(upstream.status).end(); return; }
      const contentType = upstream.headers.get("content-type") ?? "image/jpeg";
      const buffer = await upstream.arrayBuffer();
      res.setHeader("Content-Type", contentType);
      setProxyCors(req, res);
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.send(Buffer.from(buffer));
    } catch (err) {
      logger.error("[avatar-proxy]", err);
      res.status(502).end();
    }
  });

  // GET /font-proxy
  router.get("/font-proxy", async (req, res) => {
    const raw = req.query.url as string | undefined;
    if (!raw) { res.status(400).json({ error: "Missing url parameter" }); return; }
    let targetUrl: string;
    try {
      const parsed = new URL(raw);
      const allowed = ["fonts.googleapis.com", "fonts.gstatic.com", "api.fontshare.com"];
      if (!allowed.some((h) => parsed.hostname === h || parsed.hostname.endsWith("." + h))) {
        res.status(403).json({ error: "Domain not allowed" }); return;
      }
      targetUrl = parsed.toString();
    } catch { res.status(400).json({ error: "Invalid url" }); return; }
    try {
      const upstream = await fetch(targetUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; OTBChess/1.0; font-proxy)" },
        signal: AbortSignal.timeout(8000),
      });
      if (!upstream.ok) { res.status(upstream.status).end(); return; }
      const css = await upstream.text();
      res.setHeader("Content-Type", "text/css; charset=utf-8");
      setProxyCors(req, res);
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.send(css);
    } catch (err) {
      logger.error("[font-proxy]", err);
      res.status(502).end();
    }
  });

  // GET /lichess/player/:username
  router.get("/lichess/player/:username", chessProxyLimiter, async (req, res) => {
    try {
      const { status, body } = await proxyLichess(req.params.username);
      res.status(status).json(body);
    } catch (err) {
      logger.error("[lichess proxy]", err);
      res.status(502).json({ error: "Could not reach lichess.org" });
    }
  });

  // GET /lichess/games/:username
  router.get("/lichess/games/:username", chessProxyLimiter, async (req, res) => {
    try {
      const username = encodeURIComponent(req.params.username.toLowerCase().trim());
      const allowed = ["max", "rated", "perfType", "moves", "clocks", "evals", "opening"];
      const qs = allowed
        .filter((k) => req.query[k] !== undefined)
        .map((k) => `${k}=${encodeURIComponent(String(req.query[k]))}`)
        .join("&");
      const url = `https://lichess.org/api/games/user/${username}${qs ? `?${qs}` : ""}`;
      const upstream = await fetch(url, {
        headers: {
          "User-Agent": "OTBChess/1.0 (https://chessotb.club; tournament management app)",
          "Accept": "application/x-ndjson",
        },
      });
      if (!upstream.ok) {
        res.status(upstream.status).json({ error: `Lichess games API returned ${upstream.status}` });
        return;
      }
      res.setHeader("Content-Type", "application/x-ndjson");
      const text = await upstream.text();
      res.send(text);
    } catch (err) {
      logger.error("[lichess games proxy]", err);
      res.status(502).json({ error: "Could not reach lichess.org" });
    }
  });

  return router;
}
