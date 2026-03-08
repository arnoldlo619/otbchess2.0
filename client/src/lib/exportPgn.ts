/**
 * exportPgn.ts
 *
 * Builds an annotated PGN string from a processed game and its move analyses,
 * then triggers a browser download.
 *
 * Annotation format is compatible with Lichess, Chess.com, and any PGN viewer
 * that supports the SCID/ChessBase comment extensions:
 *
 *   { [%eval 0.23] }          — centipawn evaluation (Lichess format)
 *   { [%eval #3] }            — forced mate in N
 *   { [%cal Ge2e4] }          — green arrow from e2→e4 (best move hint)
 *
 * NAG (Numeric Annotation Glyph) symbols are appended directly after the SAN:
 *   !!  ($3)  — brilliant
 *   !   ($1)  — good / best
 *   !?  ($5)  — interesting / inaccuracy
 *   ?   ($2)  — mistake
 *   ??  ($4)  — blunder
 */

export interface MoveAnalysisForExport {
  moveNumber: number;
  color: string; // "w" | "b"
  san: string;
  eval: number | null;
  bestMove: string | null;
  classification: string | null;
}

export interface GameDataForExport {
  whitePlayer: string | null;
  blackPlayer: string | null;
  result: string | null;
  event: string | null;
  date: string | null;
  openingName: string | null;
  openingEco: string | null;
}

// ── NAG helpers ───────────────────────────────────────────────────────────────

/**
 * Maps a classification string to a PGN NAG suffix symbol.
 * Returns an empty string for best/good moves (no annotation needed).
 */
export function classificationToNag(classification: string | null): string {
  switch (classification) {
    case "best":
      return "!";
    case "good":
      return "";
    case "inaccuracy":
      return "!?";
    case "mistake":
      return "?";
    case "blunder":
      return "??";
    default:
      return "";
  }
}

// ── Eval formatting ───────────────────────────────────────────────────────────

/**
 * Formats a centipawn evaluation into a Lichess-compatible eval string.
 *
 * Mate scores are represented as integers ≥ 10000 (positive = white mates,
 * negative = black mates). The distance to mate is encoded as:
 *   eval = 10000 + (mateIn * 100)   for white mating
 *   eval = -(10000 + (mateIn * 100)) for black mating
 *
 * Output examples:
 *   evalCpToString(23)     → "0.23"
 *   evalCpToString(-150)   → "-1.50"
 *   evalCpToString(10300)  → "#3"
 *   evalCpToString(-10200) → "#-2"
 */
export function evalCpToString(evalCp: number): string {
  const abs = Math.abs(evalCp);
  if (abs >= 10000) {
    const mateIn = Math.ceil((abs - 10000) / 100);
    return evalCp > 0 ? `#${mateIn}` : `#-${mateIn}`;
  }
  return (evalCp / 100).toFixed(2);
}

/**
 * Builds the inline comment block for a single move.
 * Returns an empty string when there is nothing to annotate.
 */
export function buildMoveComment(
  evalCp: number | null,
  bestMove: string | null,
  classification: string | null
): string {
  const parts: string[] = [];

  // Eval annotation
  if (evalCp !== null) {
    parts.push(`[%eval ${evalCpToString(evalCp)}]`);
  }

  // Best-move arrow (only for non-best moves where we have a UCI best move)
  if (
    bestMove &&
    classification !== "best" &&
    classification !== "good" &&
    bestMove.length >= 4
  ) {
    // bestMove is UCI format e.g. "e2e4" or "g1f3"
    const from = bestMove.slice(0, 2);
    const to = bestMove.slice(2, 4);
    parts.push(`[%cal G${from}${to}]`);
  }

  if (parts.length === 0) return "";
  return `{ ${parts.join(" ")} }`;
}

// ── PGN header builder ────────────────────────────────────────────────────────

/**
 * Formats a single PGN header tag.
 * Escapes backslashes and double-quotes inside the value per PGN spec.
 */
export function pgnHeader(tag: string, value: string): string {
  const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `[${tag} "${escaped}"]`;
}

/**
 * Builds the full PGN header block from game metadata.
 */
export function buildPgnHeaders(game: GameDataForExport): string {
  const lines: string[] = [];

  lines.push(pgnHeader("Event", game.event ?? "OTB Game"));
  lines.push(pgnHeader("Site", "OTB Chess (chessotb.club)"));
  lines.push(pgnHeader("Date", game.date ?? "????.??.??"));
  lines.push(pgnHeader("Round", "?"));
  lines.push(pgnHeader("White", game.whitePlayer ?? "White"));
  lines.push(pgnHeader("Black", game.blackPlayer ?? "Black"));
  lines.push(pgnHeader("Result", game.result ?? "*"));

  if (game.openingEco) {
    lines.push(pgnHeader("ECO", game.openingEco));
  }
  if (game.openingName) {
    lines.push(pgnHeader("Opening", game.openingName));
  }

  lines.push(pgnHeader("Annotator", "OTB Chess (Stockfish)"));

  return lines.join("\n");
}

// ── Move text builder ─────────────────────────────────────────────────────────

/**
 * Builds the move text section of the PGN from the ordered move analyses.
 * Each move is formatted as:
 *
 *   1. e4 { [%eval 0.20] } e5 { [%eval 0.00] } 2. Nf3?? { [%eval -1.20] [%cal Gd1h5] } ...
 *
 * Lines are wrapped at ~80 characters for readability.
 */
export function buildMoveText(
  analyses: MoveAnalysisForExport[],
  result: string | null
): string {
  const tokens: string[] = [];

  for (let i = 0; i < analyses.length; i++) {
    const a = analyses[i];

    // Move number prefix (always for white, only after gap for black)
    if (a.color === "w") {
      tokens.push(`${a.moveNumber}.`);
    } else if (i === 0) {
      // Game starts on black's move (unusual but valid)
      tokens.push(`${a.moveNumber}...`);
    }

    // SAN + NAG suffix
    const nag = classificationToNag(a.classification);
    tokens.push(`${a.san}${nag}`);

    // Inline comment
    const comment = buildMoveComment(a.eval, a.bestMove, a.classification);
    if (comment) {
      tokens.push(comment);
    }
  }

  // Append game result
  if (result && result !== "*") {
    tokens.push(result);
  } else {
    tokens.push("*");
  }

  // Word-wrap at ~80 chars
  return wrapAt80(tokens);
}

/**
 * Joins tokens with spaces and wraps lines at approximately 80 characters.
 * Comment blocks ({ ... }) are never broken mid-token.
 */
export function wrapAt80(tokens: string[]): string {
  const lines: string[] = [];
  let currentLine = "";

  for (const token of tokens) {
    const separator = currentLine.length === 0 ? "" : " ";
    const candidate = currentLine + separator + token;

    if (candidate.length <= 80) {
      currentLine = candidate;
    } else {
      if (currentLine.length > 0) {
        lines.push(currentLine);
      }
      currentLine = token;
    }
  }

  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  return lines.join("\n");
}

// ── Main export function ──────────────────────────────────────────────────────

/**
 * Builds a complete annotated PGN string from game data and move analyses.
 *
 * The output is a valid PGN file with:
 *   - Standard seven-tag roster headers
 *   - ECO and Opening tags when available
 *   - Annotator tag crediting OTB Chess / Stockfish
 *   - Inline eval comments in Lichess [%eval] format
 *   - Best-move arrows in [%cal] format for non-best moves
 *   - NAG symbols (!!, !, !?, ?, ??) after each annotated move
 */
export function buildAnnotatedPgn(
  game: GameDataForExport,
  analyses: MoveAnalysisForExport[]
): string {
  const headers = buildPgnHeaders(game);
  const moveText = buildMoveText(analyses, game.result);
  return `${headers}\n\n${moveText}\n`;
}

// ── Browser download trigger ──────────────────────────────────────────────────

/**
 * Triggers a browser file download for the given PGN string.
 * The filename is derived from the player names and date.
 */
export function downloadPgn(
  pgn: string,
  game: GameDataForExport
): void {
  const white = (game.whitePlayer ?? "White").replace(/\s+/g, "_");
  const black = (game.blackPlayer ?? "Black").replace(/\s+/g, "_");
  const date = game.date ? game.date.replace(/-/g, "") : "unknown";
  const filename = `${white}_vs_${black}_${date}.pgn`;

  const blob = new Blob([pgn], { type: "application/x-chess-pgn" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
