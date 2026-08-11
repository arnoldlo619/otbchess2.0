/**
 * client/src/lib/embedUrlBuilder.ts
 *
 * Strict allowlisted Lichess embed URL builder.
 * - Only https://lichess.org origin
 * - Only /embed/game/{8-char-id} and /embed/analysis paths
 * - Allowlisted query keys and enum values
 * - Uses URL API, not string concatenation
 * - Rejects malicious protocols, hosts, credentials, ports, fragments, path traversal
 * - Returns typed URL or typed validation failure, never raw user input
 */

const LICHESS_ORIGIN = "https://lichess.org";
const GAME_ID_RE = /^[A-Za-z0-9]{8}$/;
const ALLOWED_THEMES = ["green", "brown", "blue", "purple", "ic"] as const;
const ALLOWED_PIECE_SETS = ["cburnett", "merida", "alpha", "pirouetti", "chessnut", "chess7", "reillycraig", "companion", "riohacha", "symmetric", "fantasy", "spatial", "celtic", "california", "caliente", "cooke", "anarcandy", "tatiana", "staunty", "governor", "dubrovny", "icpieces", "maestro", "fresca", "shapes", "kiwenSuwi"] as const;
const ALLOWED_BG = ["dark", "light"] as const;
const ALLOWED_COLOR = ["white", "black"] as const;

type AllowedTheme = typeof ALLOWED_THEMES[number];
type AllowedPieceSet = typeof ALLOWED_PIECE_SETS[number];
type AllowedBg = typeof ALLOWED_BG[number];
type AllowedColor = typeof ALLOWED_COLOR[number];

export type EmbedUrlResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

export interface GameEmbedOptions {
  gameId: string;
  theme?: AllowedTheme;
  pieceSet?: AllowedPieceSet;
  bg?: AllowedBg;
}

export interface AnalysisEmbedOptions {
  fen: string;
  color?: AllowedColor;
  theme?: AllowedTheme;
  pieceSet?: AllowedPieceSet;
  bg?: AllowedBg;
}

/**
 * Build a verified Lichess game embed URL.
 * https://lichess.org/embed/game/{validatedGameId}?theme=...&pieceSet=...&bg=...
 */
export function buildGameEmbedUrl(opts: GameEmbedOptions): EmbedUrlResult {
  if (!GAME_ID_RE.test(opts.gameId)) {
    return { ok: false, error: `Invalid Lichess game ID: "${opts.gameId}". Must be exactly 8 alphanumeric characters.` };
  }

  const theme = opts.theme ?? "green";
  const pieceSet = opts.pieceSet ?? "cburnett";
  const bg = opts.bg ?? "dark";

  if (!ALLOWED_THEMES.includes(theme as AllowedTheme)) {
    return { ok: false, error: `Invalid theme: "${theme}".` };
  }
  if (!ALLOWED_PIECE_SETS.includes(pieceSet as AllowedPieceSet)) {
    return { ok: false, error: `Invalid pieceSet: "${pieceSet}".` };
  }
  if (!ALLOWED_BG.includes(bg as AllowedBg)) {
    return { ok: false, error: `Invalid bg: "${bg}".` };
  }

  const url = new URL(`/embed/game/${opts.gameId}`, LICHESS_ORIGIN);
  url.searchParams.set("theme", theme);
  url.searchParams.set("pieceSet", pieceSet);
  url.searchParams.set("bg", bg);

  // Verify the constructed URL is still on the allowed origin and path
  if (url.origin !== LICHESS_ORIGIN) {
    return { ok: false, error: "URL origin mismatch after construction." };
  }
  if (!url.pathname.startsWith("/embed/game/")) {
    return { ok: false, error: "URL path mismatch after construction." };
  }

  return { ok: true, url: url.toString() };
}

/**
 * Build a verified Lichess analysis embed URL.
 * https://lichess.org/embed/analysis?fen=...&color=...&theme=...&pieceSet=...&bg=...
 *
 * FEN spaces are replaced with underscores as required by Lichess.
 */
export function buildAnalysisEmbedUrl(opts: AnalysisEmbedOptions): EmbedUrlResult {
  // Validate FEN format (basic check — full validation happens server-side)
  if (!opts.fen || opts.fen.length < 10 || opts.fen.length > 100) {
    return { ok: false, error: "Invalid FEN: too short or too long." };
  }
  // FEN must have 6 space-separated fields
  const fenParts = opts.fen.split(" ");
  if (fenParts.length !== 6) {
    return { ok: false, error: `Invalid FEN: expected 6 fields, got ${fenParts.length}.` };
  }
  // Reject FEN with path traversal or injection attempts
  if (/[<>"'`\\]/.test(opts.fen) || opts.fen.includes("..") || opts.fen.includes("//")) {
    return { ok: false, error: "Invalid FEN: contains disallowed characters." };
  }

  const color = opts.color ?? "white";
  const theme = opts.theme ?? "green";
  const pieceSet = opts.pieceSet ?? "cburnett";
  const bg = opts.bg ?? "dark";

  if (!ALLOWED_COLOR.includes(color as AllowedColor)) {
    return { ok: false, error: `Invalid color: "${color}".` };
  }
  if (!ALLOWED_THEMES.includes(theme as AllowedTheme)) {
    return { ok: false, error: `Invalid theme: "${theme}".` };
  }
  if (!ALLOWED_PIECE_SETS.includes(pieceSet as AllowedPieceSet)) {
    return { ok: false, error: `Invalid pieceSet: "${pieceSet}".` };
  }
  if (!ALLOWED_BG.includes(bg as AllowedBg)) {
    return { ok: false, error: `Invalid bg: "${bg}".` };
  }

  // Replace spaces with underscores as required by Lichess
  const fenForUrl = opts.fen.replace(/ /g, "_");

  const url = new URL("/embed/analysis", LICHESS_ORIGIN);
  url.searchParams.set("fen", fenForUrl);
  url.searchParams.set("color", color);
  url.searchParams.set("theme", theme);
  url.searchParams.set("pieceSet", pieceSet);
  url.searchParams.set("bg", bg);

  if (url.origin !== LICHESS_ORIGIN) {
    return { ok: false, error: "URL origin mismatch after construction." };
  }
  if (url.pathname !== "/embed/analysis") {
    return { ok: false, error: "URL path mismatch after construction." };
  }

  return { ok: true, url: url.toString() };
}

/**
 * Build a safe full-page Lichess fallback URL for a verified game.
 * https://lichess.org/{validatedGameId}
 */
export function buildGameFallbackUrl(gameId: string): EmbedUrlResult {
  if (!GAME_ID_RE.test(gameId)) {
    return { ok: false, error: `Invalid Lichess game ID: "${gameId}".` };
  }
  const url = new URL(`/${gameId}`, LICHESS_ORIGIN);
  return { ok: true, url: url.toString() };
}

/**
 * Build a safe full-page Lichess analysis fallback URL for a position.
 * https://lichess.org/analysis/standard/{fen_with_underscores}?color={color}
 */
export function buildAnalysisFallbackUrl(fen: string, color: AllowedColor = "white"): EmbedUrlResult {
  if (!fen || fen.split(" ").length !== 6) {
    return { ok: false, error: "Invalid FEN for fallback URL." };
  }
  if (/[<>"'`\\]/.test(fen) || fen.includes("..")) {
    return { ok: false, error: "Invalid FEN: contains disallowed characters." };
  }
  if (!ALLOWED_COLOR.includes(color)) {
    return { ok: false, error: `Invalid color: "${color}".` };
  }
  const fenForUrl = fen.replace(/ /g, "_");
  const url = new URL(`/analysis/standard/${encodeURIComponent(fenForUrl)}`, LICHESS_ORIGIN);
  url.searchParams.set("color", color);
  return { ok: true, url: url.toString() };
}
