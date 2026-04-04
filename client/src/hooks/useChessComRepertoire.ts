/**
 * useChessComRepertoire
 *
 * Fetches a player's recent games from chess.com and analyzes their opening
 * tendencies to auto-detect their repertoire (White first move, Black vs e4,
 * Black vs d4).
 *
 * Architecture:
 *   - Fetches last 2 monthly archives (≈ 100–200 games)
 *   - Parses PGN headers to extract ECO, opening name, and first moves
 *   - Classifies each game into a repertoire bucket
 *   - Returns DetectedRepertoire with confidence percentages
 *   - Caches results in sessionStorage for 10 minutes
 */

import { useState, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DetectedOpening {
  /** Canonical repertoire value (e.g. "Sicilian", "e4", "King's Indian") */
  value: string;
  /** Human-readable label */
  label: string;
  /** Percentage of games where this opening was played (0–100) */
  pct: number;
  /** Number of games analyzed */
  count: number;
}

export interface DetectedRepertoire {
  /** Top White first move (null if < 3 games as White) */
  whiteFirstMove: DetectedOpening | null;
  /** Top Black response vs 1.e4 (null if < 3 games as Black vs e4) */
  blackVsE4: DetectedOpening | null;
  /** Top Black response vs 1.d4 (null if < 3 games as Black vs d4) */
  blackVsD4: DetectedOpening | null;
  /** Total games analyzed */
  gamesAnalyzed: number;
  /** Games as White */
  gamesAsWhite: number;
  /** Games as Black */
  gamesAsBlack: number;
}

export type RepertoireDetectStatus = "idle" | "loading" | "success" | "error" | "not_found";

export interface UseChessComRepertoireResult {
  status: RepertoireDetectStatus;
  detected: DetectedRepertoire | null;
  error: string | null;
  detect: (username: string) => Promise<void>;
  reset: () => void;
}

// ─── Opening classification maps ─────────────────────────────────────────────

/**
 * Classify a White first move from PGN moves string.
 * Returns the canonical value for WHITE_FIRST_MOVES.
 */
export function classifyWhiteFirstMove(moves: string): string | null {
  if (!moves) return null;
  const firstMove = moves.trim().split(/\s+/)[0] ?? "";
  // PGN format: "1.e4" or just "e4" after stripping move number
  const m = firstMove.replace(/^\d+\./, "").trim().toLowerCase();
  if (m === "e4") return "e4";
  if (m === "d4") return "d4";
  if (m === "c4") return "c4";
  if (m === "nf3") return "Nf3";
  if (m === "g3" || m === "b3" || m === "f4" || m === "b4" || m === "nc3") return "other";
  return "other";
}

/**
 * Classify Black's response to 1.e4 from opening name and ECO code.
 * Returns the canonical value for BLACK_VS_E4.
 */
export function classifyBlackVsE4(openingName: string, eco: string, moves: string): string | null {
  const name = (openingName ?? "").toLowerCase();
  const e = (eco ?? "").toUpperCase();

  // ECO B00–B99 = e4 openings (Black side)
  // ECO C00–C99 = e4 openings (Black side)
  const isE4Opening = (e >= "B00" && e <= "B99") || (e >= "C00" && e <= "C99");
  if (!isE4Opening) return null;

  // Sicilian (B20–B99)
  if (name.includes("sicilian") || (e >= "B20" && e <= "B99")) return "Sicilian";
  // French (C00–C19)
  if (name.includes("french") || (e >= "C00" && e <= "C19")) return "French";
  // Caro-Kann (B10–B19)
  if (name.includes("caro") || (e >= "B10" && e <= "B19")) return "Caro-Kann";
  // Pirc / Modern (B06–B09)
  if (name.includes("pirc") || name.includes("modern") || (e >= "B06" && e <= "B09")) return "Pirc/Modern";
  // Open games 1...e5 (C20–C99)
  if (name.includes("ruy lopez") || name.includes("italian") || name.includes("scotch") ||
      name.includes("king's gambit") || name.includes("petrov") || name.includes("four knights") ||
      (e >= "C20" && e <= "C99")) return "e5";
  // Alekhine (B02–B05)
  if (name.includes("alekhine") || (e >= "B02" && e <= "B05")) return "Alekhine";
  // Scandinavian (B01)
  if (name.includes("scandinavian") || e === "B01") return "Scandinavian";

  return "other";
}

/**
 * Classify Black's response to 1.d4 from opening name and ECO code.
 * Returns the canonical value for BLACK_VS_D4.
 */
export function classifyBlackVsD4(openingName: string, eco: string, moves: string): string | null {
  const name = (openingName ?? "").toLowerCase();
  const e = (eco ?? "").toUpperCase();

  // ECO A00–A99 and D00–D99 and E00–E99 cover d4 openings
  const isD4Opening =
    (e >= "D00" && e <= "D99") ||
    (e >= "E00" && e <= "E99") ||
    (e >= "A40" && e <= "A99"); // Includes Dutch, Benoni, etc.
  if (!isD4Opening) return null;

  // King's Indian (E60–E99)
  if (name.includes("king's indian") || (e >= "E60" && e <= "E99")) return "King's Indian";
  // Nimzo-Indian (E20–E59)
  if (name.includes("nimzo") || (e >= "E20" && e <= "E59")) return "Nimzo-Indian";
  // Queen's Gambit Declined (D30–D69)
  if (name.includes("queen's gambit declined") || name.includes("qgd") || (e >= "D30" && e <= "D69")) return "QGD";
  // Grünfeld (D70–D99)
  if (name.includes("grünfeld") || name.includes("grunfeld") || (e >= "D70" && e <= "D99")) return "Grünfeld";
  // Dutch (A80–A99)
  if (name.includes("dutch") || (e >= "A80" && e <= "A99")) return "Dutch";
  // Benoni (A60–A79)
  if (name.includes("benoni") || (e >= "A60" && e <= "A79")) return "Benoni";
  // Queen's Indian (E10–E19)
  if (name.includes("queen's indian") || (e >= "E10" && e <= "E19")) return "Queen's Indian";
  // Slav (D10–D19)
  if (name.includes("slav") || (e >= "D10" && e <= "D19")) return "Slav";

  return "other";
}

// ─── PGN header parser ────────────────────────────────────────────────────────

interface GameHeaders {
  eco: string;
  opening: string;
  white: string;
  black: string;
  moves: string;
}

/**
 * Extract headers and first few moves from a PGN string.
 * chess.com PGN format has headers like [ECO "B90"] and [Opening "Sicilian..."]
 */
export function parsePgnHeaders(pgn: string): GameHeaders {
  const eco = pgn.match(/\[ECO\s+"([^"]+)"\]/)?.[1] ?? "";
  const opening = pgn.match(/\[Opening\s+"([^"]+)"\]/)?.[1] ?? "";
  const white = pgn.match(/\[White\s+"([^"]+)"\]/)?.[1] ?? "";
  const black = pgn.match(/\[Black\s+"([^"]+)"\]/)?.[1] ?? "";

  // Extract first 3 moves from the moves section (after the last "]")
  const movesSection = pgn.replace(/\[[^\]]*\]/g, "").trim();
  // Take first 20 chars of moves to get the first move
  const moves = movesSection.substring(0, 40).trim();

  return { eco, opening, white, black, moves };
}

// ─── Frequency counter ────────────────────────────────────────────────────────

function topEntry(counts: Map<string, number>, minGames: number): DetectedOpening | null {
  if (counts.size === 0) return null;
  let topValue = "";
  let topCount = 0;
  let total = 0;
  for (const [value, count] of Array.from(counts.entries())) {
    total += count;
    if (count > topCount) {
      topCount = count;
      topValue = value;
    }
  }
  if (topCount < minGames) return null;
  const pct = Math.round((topCount / total) * 100);
  return { value: topValue, label: topValue, pct, count: topCount };
}

// ─── Cache ────────────────────────────────────────────────────────────────────

const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

function cacheKey(username: string) {
  return `otb_rep_detect_${username.toLowerCase()}`;
}

function readCache(username: string): DetectedRepertoire | null {
  try {
    const raw = sessionStorage.getItem(cacheKey(username));
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) return null;
    return data;
  } catch {
    return null;
  }
}

function writeCache(username: string, data: DetectedRepertoire) {
  try {
    sessionStorage.setItem(cacheKey(username), JSON.stringify({ data, ts: Date.now() }));
  } catch {
    // sessionStorage may be full — ignore
  }
}

// ─── Main analysis function ───────────────────────────────────────────────────

/**
 * Fetch and analyze a chess.com user's recent games to detect their repertoire.
 * Fetches last 2 monthly archives (≈ 100–200 games).
 */
export async function detectChessComRepertoire(username: string): Promise<DetectedRepertoire> {
  const u = username.toLowerCase().trim();
  const cached = readCache(u);
  if (cached) return cached;

  const headers = { "User-Agent": "OTBChess/1.0 (tournament management app)" };
  const base = "https://api.chess.com/pub/player";

  // Step 1: Verify player exists
  const profileRes = await fetch(`${base}/${u}`, { headers });
  if (profileRes.status === 404) {
    throw new Error("NOT_FOUND");
  }
  if (!profileRes.ok) {
    throw new Error(`chess.com profile error: ${profileRes.status}`);
  }

  // Step 2: Fetch archive list
  const archivesRes = await fetch(`${base}/${u}/games/archives`, { headers });
  if (!archivesRes.ok) throw new Error(`chess.com archives error: ${archivesRes.status}`);
  const archivesData = await archivesRes.json();
  const archives: string[] = archivesData.archives ?? [];

  if (archives.length === 0) {
    const result: DetectedRepertoire = {
      whiteFirstMove: null,
      blackVsE4: null,
      blackVsD4: null,
      gamesAnalyzed: 0,
      gamesAsWhite: 0,
      gamesAsBlack: 0,
    };
    writeCache(u, result);
    return result;
  }

  // Step 3: Fetch last 2 archives (most recent months)
  const archivesToFetch = archives.slice(-2).reverse(); // newest first

  const whiteFirstMoveCounts = new Map<string, number>();
  const blackVsE4Counts = new Map<string, number>();
  const blackVsD4Counts = new Map<string, number>();
  let gamesAnalyzed = 0;
  let gamesAsWhite = 0;
  let gamesAsBlack = 0;
  const MAX_GAMES = 150;

  for (const archiveUrl of archivesToFetch) {
    if (gamesAnalyzed >= MAX_GAMES) break;
    try {
      const monthRes = await fetch(archiveUrl, { headers });
      if (!monthRes.ok) continue;
      const monthData = await monthRes.json();
      const games: unknown[] = monthData.games ?? [];

      // Process newest games first
      for (let j = games.length - 1; j >= 0 && gamesAnalyzed < MAX_GAMES; j--) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const g: any = games[j];
        if (!g.rated) continue;
        if (g.rules && g.rules !== "chess") continue; // skip variants

        const isWhite = (g.white?.username ?? "").toLowerCase() === u;
        const isBlack = (g.black?.username ?? "").toLowerCase() === u;
        if (!isWhite && !isBlack) continue;

        gamesAnalyzed++;

        // Parse PGN for ECO and opening
        const pgn: string = g.pgn ?? "";
        const { eco, opening, moves } = parsePgnHeaders(pgn);

        if (isWhite) {
          gamesAsWhite++;
          const firstMove = classifyWhiteFirstMove(moves);
          if (firstMove) {
            whiteFirstMoveCounts.set(firstMove, (whiteFirstMoveCounts.get(firstMove) ?? 0) + 1);
          }
        } else {
          gamesAsBlack++;
          // Determine what White played to classify Black's response
          const whiteFirstMove = classifyWhiteFirstMove(moves);
          if (whiteFirstMove === "e4") {
            const resp = classifyBlackVsE4(opening, eco, moves);
            if (resp) blackVsE4Counts.set(resp, (blackVsE4Counts.get(resp) ?? 0) + 1);
          } else if (whiteFirstMove === "d4") {
            const resp = classifyBlackVsD4(opening, eco, moves);
            if (resp) blackVsD4Counts.set(resp, (blackVsD4Counts.get(resp) ?? 0) + 1);
          }
        }
      }
    } catch {
      // Skip failed archive months
    }
  }

  const result: DetectedRepertoire = {
    whiteFirstMove: topEntry(whiteFirstMoveCounts, 3),
    blackVsE4: topEntry(blackVsE4Counts, 3),
    blackVsD4: topEntry(blackVsD4Counts, 3),
    gamesAnalyzed,
    gamesAsWhite,
    gamesAsBlack,
  };

  writeCache(u, result);
  return result;
}

// ─── React hook ──────────────────────────────────────────────────────────────

export function useChessComRepertoire(): UseChessComRepertoireResult {
  const [status, setStatus] = useState<RepertoireDetectStatus>("idle");
  const [detected, setDetected] = useState<DetectedRepertoire | null>(null);
  const [error, setError] = useState<string | null>(null);

  const detect = useCallback(async (username: string) => {
    if (!username.trim()) return;
    setStatus("loading");
    setError(null);
    setDetected(null);
    try {
      const result = await detectChessComRepertoire(username.trim());
      setDetected(result);
      setStatus("success");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === "NOT_FOUND") {
        setStatus("not_found");
        setError(`Player "${username}" not found on chess.com`);
      } else {
        setStatus("error");
        setError("Failed to fetch games. Check your username and try again.");
      }
    }
  }, []);

  const reset = useCallback(() => {
    setStatus("idle");
    setDetected(null);
    setError(null);
  }, []);

  return { status, detected, error, detect, reset };
}
