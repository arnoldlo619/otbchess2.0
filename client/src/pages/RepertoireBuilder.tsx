/**
 * RepertoireBuilder — Full-page interactive opening repertoire builder.
 *
 * Board-first layout with:
 *  - Large interactive chessboard (left, 55% on desktop)
 *  - Move-tree explorer panel (right) with Lichess Explorer frequency data
 *  - Stockfish engine eval bar
 *  - Add/remove moves to build a personal repertoire tree
 *  - Auto-save to server
 *
 * Inspired by chessbook.com's repertoire builder UI.
 */
import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { toast } from "sonner";
import { Chessboard, type PieceDropHandlerArgs } from "react-chessboard";
import { Chess, type Square } from "chess.js";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/hooks/useAuth";
import { useStockfish, type StockfishEval } from "@/hooks/useStockfish";
import { authFetch } from "@/lib/apiFetch";
import { useRoute, useLocation } from "wouter";
import { AvatarNavDropdown } from "@/components/AvatarNavDropdown";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  FlipHorizontal,
  Trash2,
  Plus,
  BookOpen,
  Loader2,
  Zap,
  Upload,
  Download,
  Copy,
  Check,
  FileText,
  X,
  Brain,
  Trophy,
  SkipForward,
  MessageSquare,
  Pencil,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

/** A node in the move tree */
interface MoveNode {
  fen: string;
  /** UCI move e.g. "e2e4" */
  move?: string;
  /** SAN move e.g. "e4" */
  san?: string;
  /** ECO code e.g. "B20" */
  openingEco?: string;
  /** Opening name e.g. "Sicilian Defense" */
  openingName?: string;
  /** User comment / annotation */
  comment?: string;
  /** Move annotation glyph: "!" "?" "!!" "??" "!?" "?!" */
  annotation?: "!" | "?" | "!!" | "??" | "!?" | "?!";
  /** Stockfish eval in centipawns (from White's POV) */
  eval?: number;
  /** Child variations */
  children: MoveNode[];
}

/** Lichess Explorer API response move */
interface ExplorerMove {
  uci: string;
  san: string;
  white: number;
  draws: number;
  black: number;
  averageRating?: number;
  /** Opening name for the resulting position (fetched lazily) */
  openingName?: string;
  /** ECO code for the resulting position */
  openingEco?: string;
}

interface ExplorerResponse {
  white: number;
  draws: number;
  black: number;
  moves: ExplorerMove[];
  opening?: { eco: string; name: string };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

/** Module-level cache: FEN → { eco, name } to avoid redundant Lichess fetches */
const openingCache = new Map<string, { eco: string; name: string } | null>();

/**
 * Fetch the opening name for a given FEN from the Lichess Explorer.
 * Returns null if not found or on error. Results are cached.
 */
async function fetchOpeningForFen(fen: string): Promise<{ eco: string; name: string } | null> {
  if (openingCache.has(fen)) return openingCache.get(fen) ?? null;
  try {
    const url = `/api/repertoire-builder/explorer?variant=standard&speeds=rapid,classical&ratings=1600,1800,2000,2200,2500&fen=${encodeURIComponent(fen)}`;
    const res = await fetch(url);
    if (!res.ok) { openingCache.set(fen, null); return null; }
    const data = await res.json() as { opening?: { eco: string; name: string } };
    const opening = data.opening ?? null;
    openingCache.set(fen, opening);
    return opening;
  } catch {
    openingCache.set(fen, null);
    return null;
  }
}

function createEmptyTree(): MoveNode {
  return { fen: STARTING_FEN, children: [] };
}

/** Find a node in the tree by FEN (BFS) */
function findNode(root: MoveNode, fen: string): MoveNode | null {
  const queue: MoveNode[] = [root];
  while (queue.length > 0) {
    const node = queue.shift()!;
    if (node.fen === fen) return node;
    queue.push(...node.children);
  }
  return null;
}

/** Build the path from root to a node with the given FEN */
function buildPath(root: MoveNode, targetFen: string): MoveNode[] {
  const path: MoveNode[] = [];
  function dfs(node: MoveNode): boolean {
    path.push(node);
    if (node.fen === targetFen) return true;
    for (const child of node.children) {
      if (dfs(child)) return true;
    }
    path.pop();
    return false;
  }
  dfs(root);
  return path;
}

/** Count total nodes in the tree (excluding root) */
function countMoves(root: MoveNode): number {
  let count = 0;
  function dfs(node: MoveNode) {
    count += node.children.length;
    node.children.forEach(dfs);
  }
  dfs(root);
  return count;
}

// ─── PGN Export ──────────────────────────────────────────────────────────────

/**
 * Recursively build a PGN move-text string from a MoveNode tree.
 * Variations (siblings) are wrapped in parentheses per the PGN standard.
 *
 * @param node   Current node
 * @param depth  Ply depth from root (0 = root, 1 = first move)
 * @param isFirst Whether this is the first child (main line vs variation)
 */
function treeToMoveText(node: MoveNode, depth: number, isFirst: boolean): string {
  if (!node.san) return "";

  const plyFromStart = depth; // depth is already 1-based ply
  const moveNum = Math.ceil(plyFromStart / 2);
  const isWhiteMove = plyFromStart % 2 === 1;

  let text = "";

  // Prefix: move number indicator
  if (isWhiteMove) {
    text += `${moveNum}. `;
  } else if (!isFirst) {
    // After a variation we need to re-state the move number with ellipsis
    text += `${moveNum}... `;
  }

  text += node.san;

  // Annotation glyph appended directly after SAN (standard PGN NAG-style)
  if (node.annotation) {
    text += node.annotation;
  }

  // Inline comment
  if (node.comment) {
    text += ` { ${node.comment.replace(/[{}]/g, "")} }`;
  }

  if (node.children.length === 0) return text;

  // Main line (first child) continues inline
  const [mainChild, ...variations] = node.children;

  // Recurse into main line
  const mainText = treeToMoveText(mainChild, depth + 1, true);
  if (mainText) text += " " + mainText;

  // Variations wrapped in parentheses
  for (const varChild of variations) {
    const varText = treeToMoveText(varChild, depth + 1, false);
    if (varText) text += " ( " + varText + " )";
  }

  return text;
}

/**
 * Convert the full MoveNode tree to a PGN string.
 * Includes standard PGN headers and the full move text with variations.
 */
function exportToPgn(tree: MoveNode, name: string, color: "white" | "black"): string {
  const date = new Date().toISOString().split("T")[0].replace(/-/g, ".");
  const headers = [
    `[Event "${name}"]`,
    `[Site "ChessOTB.club"]`,
    `[Date "${date}"]`,
    `[White "${color === "white" ? "Repertoire" : "Opponent"}"]`,
    `[Black "${color === "black" ? "Repertoire" : "Opponent"}"]`,
    `[Result "*"]`,
  ].join("\n");

  // Build move text from all children of root
  const moveParts: string[] = [];
  const [mainChild, ...variations] = tree.children;

  if (mainChild) {
    const mainText = treeToMoveText(mainChild, 1, true);
    if (mainText) moveParts.push(mainText);
    for (const varChild of variations) {
      const varText = treeToMoveText(varChild, 1, false);
      if (varText) moveParts.push("( " + varText + " )");
    }
  }

  const moveText = moveParts.join(" ") + (moveParts.length ? " *" : "*");
  return headers + "\n\n" + moveText + "\n";
}

// ─── PGN Import ───────────────────────────────────────────────────────────────

/**
 * Parse a PGN string (including variations) into a MoveNode tree.
 * Supports:
 *  - Main line moves
 *  - Variations in parentheses (nested)
 *  - Inline comments in { ... }
 *  - Move number indicators (1. e4, 1... e5, etc.)
 *
 * Returns the root MoveNode (STARTING_FEN, no san/move) with children populated.
 * Throws on invalid PGN.
 */
function importFromPgn(pgn: string): MoveNode {
  // Strip headers (lines starting with [)
  const moveSection = pgn
    .split("\n")
    .filter((l) => !l.trim().startsWith("["))
    .join(" ");

  // Tokenise: moves, move numbers, comments, variation brackets, result
  const tokens = tokenisePgn(moveSection);

  const root: MoveNode = { fen: STARTING_FEN, children: [] };
  const stack: { node: MoveNode; chess: Chess }[] = [{ node: root, chess: new Chess() }];

  let pendingComment: string | undefined;
  let pendingAnnotation: MoveNode["annotation"] | undefined;

  for (const token of tokens) {
    if (token === "(" ) {
      // Start variation: go back one ply from current position
      const current = stack[stack.length - 1];
      const parent = stack[stack.length - 2] ?? stack[0];
      // The variation starts from the parent's position
      const _parentChess = parent ? new Chess(parent.chess.fen()) : new Chess();
      // Actually we need the grandparent FEN — the position before the last move
      // We achieve this by cloning the parent node's chess state
      const varChess = new Chess(parent.node.fen);
      stack.push({ node: parent.node, chess: varChess });
      void current; // suppress unused warning
      continue;
    }
    if (token === ")") {
      // End variation: pop back
      if (stack.length > 1) stack.pop();
      continue;
    }
    // Skip result tokens
    if (token === "*" || token === "1-0" || token === "0-1" || token === "1/2-1/2") continue;
    // Skip move number tokens like "1." "1..."
    if (/^\d+\.+$/.test(token)) continue;
    // Comment
    if (token.startsWith("{") && token.endsWith("}")) {
      pendingComment = token.slice(1, -1).trim();
      continue;
    }
    // Annotation glyph (!, ?, !!, ??, !?, ?!)
    if (/^[!?]{1,2}$/.test(token)) {
      pendingAnnotation = token as MoveNode["annotation"];
      continue;
    }

    // It's a SAN move
    const top = stack[stack.length - 1];
    try {
      const result = top.chess.move(token);
      if (!result) continue;
      const newFen = top.chess.fen();
      const uci = result.from + result.to + (result.promotion || "");

      // Check if this node already exists as a child
      let child = top.node.children.find((c) => c.fen === newFen);
      if (!child) {
        child = {
          fen: newFen,
          move: uci,
          san: result.san,
          comment: pendingComment,
          annotation: pendingAnnotation,
          children: [],
        };
        top.node.children.push(child);
      } else {
        if (pendingComment && !child.comment) child.comment = pendingComment;
        if (pendingAnnotation && !child.annotation) child.annotation = pendingAnnotation;
      }
      pendingComment = undefined;
      pendingAnnotation = undefined;

      // Advance stack top to this child
      stack[stack.length - 1] = { node: child, chess: top.chess };
    } catch {
      // Invalid move — skip gracefully
    }
  }

  return root;
}

/** Tokenise PGN move section into an array of tokens */
function tokenisePgn(text: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    // Skip whitespace
    if (/\s/.test(ch)) { i++; continue; }
    // Comment { ... }
    if (ch === "{") {
      const end = text.indexOf("}", i);
      if (end === -1) { i++; continue; }
      tokens.push(text.slice(i, end + 1));
      i = end + 1;
      continue;
    }
    // Parentheses
    if (ch === "(" || ch === ")") { tokens.push(ch); i++; continue; }
    // Semicolon comment (rest of line)
    if (ch === ";") {
      const end = text.indexOf("\n", i);
      i = end === -1 ? text.length : end + 1;
      continue;
    }
    // Word token (move, move number, result)
    const match = text.slice(i).match(/^[^\s{}();]+/);
    if (match) { tokens.push(match[0]); i += match[0].length; continue; }
    i++;
  }
  return tokens;
}

/** Count total ply in a MoveNode tree */
function countPly(root: MoveNode): number {
  let max = 0;
  function dfs(node: MoveNode, depth: number) {
    if (depth > max) max = depth;
    for (const child of node.children) dfs(child, depth + 1);
  }
  dfs(root, 0);
  return max;
}

/** Remove a child node from the tree by FEN */
function removeNode(root: MoveNode, targetFen: string): MoveNode {
  const clone = JSON.parse(JSON.stringify(root)) as MoveNode;
  function dfs(node: MoveNode) {
    node.children = node.children.filter((c) => c.fen !== targetFen);
    node.children.forEach(dfs);
  }
  dfs(clone);
  return clone;
}

// ─── Eval Bar Component ───────────────────────────────────────────────────────

function EvalBar({ cp, mate, isDark: _isDark }: { cp: number; mate: number | null; isDark: boolean }) {
  // Convert cp to a percentage for the bar (clamped between 5% and 95%)
  let whitePct: number;
  if (mate !== null) {
    whitePct = mate > 0 ? 95 : 5;
  } else {
    // Sigmoid-like mapping: cp of 300 ≈ 75%, cp of -300 ≈ 25%
    whitePct = 50 + 50 * (2 / (1 + Math.exp(-cp / 200)) - 1);
    whitePct = Math.max(5, Math.min(95, whitePct));
  }

  const label = mate !== null
    ? `M${Math.abs(mate)}`
    : `${cp >= 0 ? "+" : ""}${(cp / 100).toFixed(1)}`;

  return (
    <div className="flex flex-col items-center w-6 h-full rounded-md overflow-hidden border border-white/10">
      {/* Black portion (top) */}
      <div
        className="w-full bg-gray-800 transition-all duration-500 relative"
        style={{ height: `${100 - whitePct}%` }}
      >
        {whitePct < 50 && (
          <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[9px] font-bold text-white whitespace-nowrap">
            {label}
          </span>
        )}
      </div>
      {/* White portion (bottom) */}
      <div
        className="w-full bg-white transition-all duration-500 relative"
        style={{ height: `${whitePct}%` }}
      >
        {whitePct >= 50 && (
          <span className="absolute top-1 left-1/2 -translate-x-1/2 text-[9px] font-bold text-gray-800 whitespace-nowrap">
            {label}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Move Tree Display Component ──────────────────────────────────────────────

function MoveTreeBreadcrumb({
  path,
  onNavigate,
  isDark,
}: {
  path: MoveNode[];
  onNavigate: (fen: string) => void;
  isDark: boolean;
}) {
  if (path.length <= 1) return null;

  const moves = path.slice(1); // Skip root
  const currentNode = moves[moves.length - 1];
  return (
    <div className="mb-3">
      <div className="flex flex-wrap items-center gap-1 text-sm">
        <button
          onClick={() => onNavigate(STARTING_FEN)}
          className={`px-1.5 py-0.5 rounded text-xs font-mono ${
            isDark ? "bg-white/5 hover:bg-white/10 text-white/60" : "bg-gray-100 hover:bg-gray-200 text-gray-500"
          }`}
        >
          Start
        </button>
        {moves.map((node, i) => {
          const moveNum = Math.floor(i / 2) + 1;
          const isWhite = i % 2 === 0;
          const prefix = isWhite ? `${moveNum}.` : `${moveNum}...`;
          const isLast = i === moves.length - 1;
          return (
            <React.Fragment key={node.fen}>
              <span className={isDark ? "text-white/30" : "text-gray-300"}>/</span>
              <button
                onClick={() => onNavigate(node.fen)}
                className={`px-1.5 py-0.5 rounded text-xs font-mono font-bold ${
                  isLast
                    ? isDark
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "bg-emerald-100 text-emerald-700"
                    : isDark
                    ? "bg-white/5 hover:bg-white/10 text-white/70"
                    : "bg-gray-100 hover:bg-gray-200 text-gray-600"
                }`}
              >
                {prefix} {node.san || "?"}
              </button>
            </React.Fragment>
          );
        })}
      </div>
      {/* Show opening name for current position */}
      {currentNode?.openingName && (
        <div className="flex items-center gap-1.5 mt-1">
          {currentNode.openingEco && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded font-mono ${
              isDark ? "bg-emerald-500/20 text-emerald-400" : "bg-emerald-100 text-emerald-700"
            }`}>
              {currentNode.openingEco}
            </span>
          )}
          <span className={`text-xs font-medium ${
            isDark ? "text-white/60" : "text-gray-500"
          }`}>
            {currentNode.openingName}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Explorer Move Row ────────────────────────────────────────────────────────

function ExplorerMoveRow({
  move,
  totalGames,
  isInRepertoire,
  onAdd,
  onRemove,
  onPlay,
  onHoverEnter,
  onHoverLeave,
  isDark,
  openingName,
  openingEco,
}: {
  move: ExplorerMove;
  totalGames: number;
  isInRepertoire: boolean;
  onAdd: () => void;
  onRemove: () => void;
  onPlay: () => void;
  onHoverEnter?: () => void;
  onHoverLeave?: () => void;
  isDark: boolean;
  openingName?: string;
  openingEco?: string;
}) {
  const games = move.white + move.draws + move.black;
  const freq = totalGames > 0 ? games / totalGames : 0;
  const winPct = games > 0 ? (move.white / games) * 100 : 0;
  const drawPct = games > 0 ? (move.draws / games) * 100 : 0;
  const lossPct = games > 0 ? (move.black / games) * 100 : 0;

  return (
    <div
      onMouseEnter={onHoverEnter}
      onMouseLeave={onHoverLeave}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all group ${
        isInRepertoire
          ? isDark
            ? "bg-emerald-500/10 border border-emerald-500/30"
            : "bg-emerald-50 border border-emerald-200"
          : isDark
          ? "hover:bg-white/5 border border-transparent"
          : "hover:bg-gray-50 border border-transparent"
      }`}
      onClick={onPlay}
    >
      {/* Move SAN */}
      <div className="w-16 shrink-0">
        <span className={`font-bold font-mono text-base ${isDark ? "text-white" : "text-gray-900"}`}>
          {move.san}
        </span>
      </div>

      {/* Opening name + ECO badge */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          {openingEco && (
            <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded font-mono ${
              isDark ? "bg-white/10 text-white/60" : "bg-gray-100 text-gray-500"
            }`}>
              {openingEco}
            </span>
          )}
          {openingName && (
            <span className={`text-xs truncate ${isDark ? "text-white/50" : "text-gray-500"}`}>
              {openingName}
            </span>
          )}
        </div>
      </div>

      {/* Frequency */}
      <div className={`text-xs text-right shrink-0 w-20 ${isDark ? "text-white/50" : "text-gray-400"}`}>
        {games > 0 ? `1 in ${Math.round(1 / freq)}` : "rare"}
      </div>

      {/* Win/Draw/Loss bar */}
      <div className="w-24 shrink-0">
        <div className="flex h-2 rounded-full overflow-hidden">
          <div className="bg-white" style={{ width: `${winPct}%` }} />
          <div className="bg-gray-400" style={{ width: `${drawPct}%` }} />
          <div className="bg-gray-800" style={{ width: `${lossPct}%` }} />
        </div>
      </div>

      {/* Add/Remove button */}
      <div className="w-8 shrink-0 flex justify-center">
        {isInRepertoire ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-opacity"
            title="Remove from repertoire"
          >
            <Trash2 size={14} />
          </button>
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAdd();
            }}
            className={`opacity-0 group-hover:opacity-100 transition-opacity ${
              isDark ? "text-emerald-400 hover:text-emerald-300" : "text-emerald-600 hover:text-emerald-500"
            }`}
            title="Add to repertoire"
          >
            <Plus size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function RepertoireBuilder() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const { user: _user } = useAuth();
  const [, params] = useRoute("/repertoire/:id");
  const [, navigate] = useLocation();
  const repertoireId = params?.id;

  // ── State ───────────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [repertoireName, setRepertoireName] = useState("New Repertoire");
  const [color, setColor] = useState<"white" | "black">("white");
  const [moveTree, setMoveTree] = useState<MoveNode>(createEmptyTree);
  const [currentFen, setCurrentFen] = useState(STARTING_FEN);
  const [boardOrientation, setBoardOrientation] = useState<"white" | "black">("white");
  const [explorerMoves, setExplorerMoves] = useState<ExplorerMove[]>([]);
  const [explorerLoading, setExplorerLoading] = useState(false);
  const [openingName, setOpeningName] = useState<string>("");
  const [openingEco, setOpeningEco] = useState<string>("");
  const [sfEval, setSfEval] = useState<StockfishEval | null>(null);
  const [showEngine, setShowEngine] = useState(true);
  const [lastMove, setLastMove] = useState<[string, string] | null>(null);
  const [hoverPreview, setHoverPreview] = useState<{ fen: string; from: string; to: string } | null>(null);
  const [editingName, setEditingName] = useState(false);
  // PGN import/export state
  const [showPgnExport, setShowPgnExport] = useState(false);
  const [showPgnImport, setShowPgnImport] = useState(false);
  const [pgnImportText, setPgnImportText] = useState("");
  const [pgnImportError, setPgnImportError] = useState<string | null>(null);
  const [pgnImportPreview, setPgnImportPreview] = useState<MoveNode | null>(null);
  const [pgnImportMode, setPgnImportMode] = useState<"replace" | "merge">("replace");
  const [pgnCopied, setPgnCopied] = useState(false);
  const pgnImportFileRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Quiz mode state ─────────────────────────────────────────────────────────
  type QuizStatus = "idle" | "playing" | "correct" | "wrong" | "complete";
  const [quizStatus, setQuizStatus] = useState<QuizStatus>("idle");
  const [quizCorrect, setQuizCorrect] = useState(0);
  const [quizTotal, setQuizTotal] = useState(0);

  // ── Coverage chip flash state ────────────────────────────────────────────────
  // When a coverage chip is clicked, the board navigates to the new FEN and the
  // chip disappears from coverage.uncovered. We persist the chip's SAN label in
  // flashedChipSan so we can render a "ghost" green chip for 800ms as confirmation.
  const [flashedChipSan, setFlashedChipSan] = useState<string | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [quizHintFen, setQuizHintFen] = useState<string | null>(null); // FEN of the correct move's target square
  const [quizHintSan, setQuizHintSan] = useState<string | null>(null);
  const [quizMoveLog, setQuizMoveLog] = useState<Array<{ san: string; correct: boolean }>>([]); // history for summary
  const [showQuizSummary, setShowQuizSummary] = useState(false);
  const quizFlashTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Annotation notes state ──────────────────────────────────────────────────
  const [noteText, setNoteText] = useState("");
  const [noteSaved, setNoteSaved] = useState(false);
  const noteSaveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Dynamic board sizing ────────────────────────────────────────────────────
  // Measures the left column height and computes the optimal board pixel size
  // so the board + controls + notes all fit within the viewport without scrolling.
  const boardContainerRef = useRef<HTMLDivElement>(null);
  const [boardSize, setBoardSize] = useState(480);

  useEffect(() => {
    // CONTROLS_HEIGHT: board controls bar (44px) + notes header (32px) + notes textarea (72px) + border/gaps (32px)
    const CONTROLS_HEIGHT = 180;
    const compute = () => {
      if (!boardContainerRef.current) return;
      const rect = boardContainerRef.current.getBoundingClientRect();
      // Use the actual measured top from the DOM — this is the most accurate
      // way to know how much vertical space is available below the headers.
      // We add a small safety margin (8px) so the board never clips.
      const availableHeight = window.innerHeight - rect.top - CONTROLS_HEIGHT - 8;
      const availableWidth = rect.width;
      const size = Math.max(200, Math.min(availableWidth, availableHeight));
      setBoardSize(Math.floor(size));
    };
    // Only set up the observer after the board container is in the DOM (loading=false)
    if (loading) return;
    // Use two rAF frames to ensure the flex layout has fully settled after loading
    let rafId: number;
    const scheduleCompute = () => {
      rafId = requestAnimationFrame(() => {
        rafId = requestAnimationFrame(compute);
      });
    };
    scheduleCompute();
    const ro = new ResizeObserver(compute);
    if (boardContainerRef.current) ro.observe(boardContainerRef.current);
    window.addEventListener("resize", compute);
    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      window.removeEventListener("resize", compute);
    };
  }, [loading]);

  const { ready: sfReady, evaluate, stop: sfStop } = useStockfish();

  const chess = useMemo(() => new Chess(currentFen), [currentFen]);
  const currentPath = useMemo(() => buildPath(moveTree, currentFen), [moveTree, currentFen]);
  const totalMoves = useMemo(() => countMoves(moveTree), [moveTree]);
  const currentNode = useMemo(() => findNode(moveTree, currentFen), [moveTree, currentFen]);

  // ── Load repertoire from server ─────────────────────────────────────────────
  useEffect(() => {
    if (!repertoireId) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const res = await authFetch(`/api/repertoire-builder/${repertoireId}`);
        if (!res.ok) {
          navigate("/repertoire");
          return;
        }
        const data = await res.json();
        const rep = data.repertoire;
        setRepertoireName(rep.title || "Untitled");
        setColor(rep.color || "white");
        setBoardOrientation(rep.color || "white");
        if (rep.moveTree) {
          try {
            const tree = JSON.parse(rep.moveTree) as MoveNode;
            setMoveTree(tree);
          } catch {
            setMoveTree(createEmptyTree());
          }
        }
      } catch {
        navigate("/repertoire");
      } finally {
        setLoading(false);
      }
    })();
  }, [repertoireId, navigate]);

  // ── Fetch Lichess Explorer data when FEN changes ────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setExplorerLoading(true);
    setExplorerMoves([]); // Clear stale moves immediately to prevent invalid move errors

    const fetchExplorer = async () => {
      try {
        const url = `/api/repertoire-builder/explorer?variant=standard&speeds=rapid,classical&ratings=1600,1800,2000,2200,2500&fen=${encodeURIComponent(currentFen)}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Explorer fetch failed");
        const data = (await res.json()) as ExplorerResponse;
        if (!cancelled) {
          const rawMoves = data.moves || [];
          setExplorerMoves(rawMoves);
          if (data.opening) {
            setOpeningName(data.opening.name);
            setOpeningEco(data.opening.eco);
          }
          // Fetch opening names for each candidate move's resulting FEN (top 8 only)
          const topMoves = rawMoves.slice(0, 8);
          const fenMoveMap: Array<{ uci: string; fen: string }> = [];
          for (const m of topMoves) {
            try {
              const tempChess = new Chess(currentFen);
              const r = tempChess.move(m.san);
              if (r) fenMoveMap.push({ uci: m.uci, fen: tempChess.fen() });
            } catch { /* skip */ }
          }
          // Fetch in parallel (all cached after first visit)
          const openings = await Promise.all(
            fenMoveMap.map(({ fen }) => fetchOpeningForFen(fen))
          );
          if (!cancelled) {
            setExplorerMoves((prev) =>
              prev.map((m) => {
                const idx = fenMoveMap.findIndex((fm) => fm.uci === m.uci);
                if (idx === -1) return m;
                const opening = openings[idx];
                return opening
                  ? { ...m, openingName: opening.name, openingEco: opening.eco }
                  : m;
              })
            );
          }
        }
      } catch {
        if (!cancelled) setExplorerMoves([]);
      } finally {
        if (!cancelled) setExplorerLoading(false);
      }
    };

    const timer = setTimeout(fetchExplorer, 200); // debounce
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [currentFen]);

  // ── Run Stockfish eval when FEN changes ─────────────────────────────────────
  useEffect(() => {
    if (!sfReady || !showEngine) return;
    let cancelled = false;

    evaluate(currentFen, 16)
      .then((result) => {
        if (!cancelled) setSfEval(result);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      sfStop();
    };
  }, [currentFen, sfReady, showEngine, evaluate, sfStop]);

  // ── Auto-save with debounce ─────────────────────────────────────────────────
  const autoSave = useCallback(
    (tree: MoveNode) => {
      if (!repertoireId) return;
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(async () => {
        setSaving(true);
        try {
          await authFetch(`/api/repertoire-builder/${repertoireId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ moveTree: JSON.stringify(tree) }),
          });
        } catch {
          // silent fail
        } finally {
          setSaving(false);
        }
      }, 1500);
    },
    [repertoireId]
  );

  // ── Quiz mode callbacks ─────────────────────────────────────────────────────

  /** Start a quiz session from the root of the repertoire */
  const startQuiz = useCallback(() => {
    if (countMoves(moveTree) === 0) return; // nothing to quiz on
    setQuizStatus("playing");
    setQuizCorrect(0);
    setQuizTotal(0);
    setQuizHintFen(null);
    setQuizHintSan(null);
    setQuizMoveLog([]);
    setShowQuizSummary(false);
    // Reset board to start
    setCurrentFen(STARTING_FEN);
    setLastMove(null);
  }, [moveTree]);

  /** Auto-play the opponent's move (random child from the tree) */
  const quizOpponentMove = useCallback(
    (fen: string, tree: MoveNode) => {
      const node = findNode(tree, fen);
      if (!node || node.children.length === 0) {
        // No more moves — quiz complete
        setQuizStatus("complete");
        setShowQuizSummary(true);
        return;
      }
      // Pick a random child
      const child = node.children[Math.floor(Math.random() * node.children.length)];
      setTimeout(() => {
        setCurrentFen(child.fen);
        if (child.move) setLastMove([child.move.slice(0, 2), child.move.slice(2, 4)]);
      }, 400);
    },
    []
  );

  /** Handle a move attempt in quiz mode */
  const handleQuizMove = useCallback(
    (from: string, to: string, promotion?: string): boolean => {
      if (quizStatus !== "playing") return false;

      const tempChess = new Chess(currentFen);
      const result = tempChess.move({ from: from as Square, to: to as Square, promotion: promotion || "q" });
      if (!result) return false;

      const newFen = tempChess.fen();
      const currentNode = findNode(moveTree, currentFen);

      // Check if this move is in the repertoire
      const matchingChild = currentNode?.children.find((c) => c.fen === newFen);

      if (matchingChild) {
        // Correct!
        setQuizCorrect((n) => n + 1);
        setQuizTotal((n) => n + 1);
        setQuizMoveLog((log) => [...log, { san: result.san, correct: true }]);
        setQuizStatus("correct");
        setQuizHintFen(null);
        setQuizHintSan(null);
        setCurrentFen(newFen);
        setLastMove([from, to]);

        if (quizFlashTimeout.current) clearTimeout(quizFlashTimeout.current);
        quizFlashTimeout.current = setTimeout(() => {
          setQuizStatus("playing");
          // Determine if the next position is the opponent's turn
          const nextNode = findNode(moveTree, newFen);
          const isOpponentNext = new Chess(newFen).turn() === (color === "white" ? "b" : "w");
          if (nextNode && nextNode.children.length > 0 && isOpponentNext) {
            quizOpponentMove(newFen, moveTree);
          } else if (!nextNode || nextNode.children.length === 0) {
            setQuizStatus("complete");
            setShowQuizSummary(true);
          }
        }, 600);
      } else {
        // Wrong move
        setQuizTotal((n) => n + 1);
        const correctChild = currentNode?.children[0]; // show the first prepared move as hint
        setQuizMoveLog((log) => [...log, { san: result.san, correct: false }]);
        setQuizStatus("wrong");
        setQuizHintFen(correctChild?.fen ?? null);
        setQuizHintSan(correctChild?.san ?? null);
      }
      return true;
    },
    [quizStatus, currentFen, moveTree, color, quizOpponentMove]
  );

  /** Skip the current position and advance to the next */
  const skipQuizPosition = useCallback(() => {
    const node = findNode(moveTree, currentFen);
    if (!node || node.children.length === 0) {
      setQuizStatus("complete");
      setShowQuizSummary(true);
      return;
    }
    const child = node.children[0];
    setCurrentFen(child.fen);
    if (child.move) setLastMove([child.move.slice(0, 2), child.move.slice(2, 4)]);
    setQuizStatus("playing");
    setQuizHintFen(null);
    setQuizHintSan(null);
    // If next is opponent's turn, auto-play
    const isOpponentNext = new Chess(child.fen).turn() === (color === "white" ? "b" : "w");
    if (isOpponentNext) {
      quizOpponentMove(child.fen, moveTree);
    }
  }, [currentFen, moveTree, color, quizOpponentMove]);

  /** Exit quiz mode and return to builder */
  const exitQuiz = useCallback(() => {
    setQuizStatus("idle");
    setShowQuizSummary(false);
    setCurrentFen(STARTING_FEN);
    setLastMove(null);
    setQuizHintFen(null);
    setQuizHintSan(null);
  }, []);

  // ── Make a move on the board ────────────────────────────────────────────────
  const makeMove = useCallback(
    (from: string, to: string, promotion?: string) => {
      const tempChess = new Chess(currentFen);
      let result;
      try { result = tempChess.move({ from: from as Square, to: to as Square, promotion: promotion || "q" }); } catch { return false; }
      if (!result) return false;

      const newFen = tempChess.fen();
      const uci = from + to + (result.promotion || "");

      // Add to tree if not already there
      const updatedTree = JSON.parse(JSON.stringify(moveTree)) as MoveNode;
      const parentNode = findNode(updatedTree, currentFen);
      if (parentNode) {
        const existing = parentNode.children.find((c) => c.fen === newFen);
        if (!existing) {
          const newNode: MoveNode = {
            fen: newFen,
            move: uci,
            san: result.san,
            children: [],
          };
          parentNode.children.push(newNode);
          // Fetch opening annotation asynchronously and backfill
          fetchOpeningForFen(newFen).then((opening) => {
            if (opening) {
              setMoveTree((prev) => {
                const clone = JSON.parse(JSON.stringify(prev)) as MoveNode;
                const target = findNode(clone, newFen);
                if (target) {
                  target.openingEco = opening.eco;
                  target.openingName = opening.name;
                }
                return clone;
              });
            }
          });
        }
      }

      setMoveTree(updatedTree);
      setCurrentFen(newFen);
      setLastMove([from, to]);
      autoSave(updatedTree);
      return true;
    },
    [currentFen, moveTree, autoSave]
  );

  const handlePieceDrop = useCallback(
    ({ sourceSquare, targetSquare }: PieceDropHandlerArgs) => {
      if (!targetSquare) return false;
      // In quiz mode, route to quiz handler instead of builder handler
      if (quizStatus === "playing" || quizStatus === "wrong") {
        return handleQuizMove(sourceSquare, targetSquare);
      }
      return makeMove(sourceSquare, targetSquare);
    },
    [makeMove, handleQuizMove, quizStatus]
  );

  // ── Navigate to a position ──────────────────────────────────────────────────
  const navigateTo = useCallback((fen: string) => {
    setCurrentFen(fen);
    // Find the move that led to this FEN for last-move highlight
    // We'll clear lastMove when going to root
    if (fen === STARTING_FEN) {
      setLastMove(null);
    }
  }, []);

  // ── Sync note textarea when current node changes ──────────────────────────────────
  useEffect(() => {
    setNoteText(currentNode?.comment ?? "");
    setNoteSaved(false);
  }, [currentFen, currentNode]);

  /** Persist a comment on the current node in the move tree */
  const saveNote = useCallback(
    (text: string) => {
      if (!currentNode) return;
      setMoveTree((prev) => {
        const clone = JSON.parse(JSON.stringify(prev)) as MoveNode;
        const target = findNode(clone, currentFen);
        if (target) target.comment = text.trim() || undefined;
        return clone;
      });
      // Debounce the server save
      if (noteSaveTimeout.current) clearTimeout(noteSaveTimeout.current);
      noteSaveTimeout.current = setTimeout(() => {
        setMoveTree((latest) => {
          autoSave(latest);
          return latest;
        });
        setNoteSaved(true);
        setTimeout(() => setNoteSaved(false), 2000);
      }, 600);
    },
    [currentNode, currentFen, autoSave]
  );

  // ── Add explorer move to repertoire ─────────────────────────────────────────
  const addExplorerMove = useCallback(
    (move: ExplorerMove, parentFen?: string) => {
      const baseFen = parentFen ?? currentFen;
      const tempChess = new Chess(baseFen);
      let result;
      try { result = tempChess.move(move.san); } catch { return; }
      if (!result) return;

      const newFen = tempChess.fen();
      const updatedTree = JSON.parse(JSON.stringify(moveTree)) as MoveNode;
      const parentNode = findNode(updatedTree, baseFen);
      if (parentNode) {
        const existing = parentNode.children.find((c) => c.fen === newFen);
        if (!existing) {
          parentNode.children.push({
            fen: newFen,
            move: move.uci,
            san: move.san,
            // Carry over opening annotation if already fetched from explorer
            openingEco: move.openingEco,
            openingName: move.openingName,
            children: [],
          });
          setMoveTree(updatedTree);
          autoSave(updatedTree);
          // Backfill opening annotation if not yet available
          if (!move.openingName) {
            fetchOpeningForFen(newFen).then((opening) => {
              if (opening) {
                setMoveTree((prev) => {
                  const clone = JSON.parse(JSON.stringify(prev)) as MoveNode;
                  const target = findNode(clone, newFen);
                  if (target) {
                    target.openingEco = opening.eco;
                    target.openingName = opening.name;
                  }
                  return clone;
                });
              }
            });
          }
        }
      }
    },
    [currentFen, moveTree, autoSave]
  );

  // ── Play an explorer move (navigate to it) ─────────────────────────────
  const playExplorerMove = useCallback(
    (move: ExplorerMove) => {
      const tempChess = new Chess(currentFen);
      let result;
      try { result = tempChess.move(move.san); } catch { return; }
      if (!result) return;

      const newFen = tempChess.fen();

      // Add to tree if not there
      const updatedTree = JSON.parse(JSON.stringify(moveTree)) as MoveNode;
      const parentNode = findNode(updatedTree, currentFen);
      if (parentNode) {
        const existing = parentNode.children.find((c) => c.fen === newFen);
        if (!existing) {
          parentNode.children.push({
            fen: newFen,
            move: move.uci,
            san: move.san,
            openingEco: move.openingEco,
            openingName: move.openingName,
            children: [],
          });
          setMoveTree(updatedTree);
          autoSave(updatedTree);
          // Backfill opening annotation if not yet available
          if (!move.openingName) {
            fetchOpeningForFen(newFen).then((opening) => {
              if (opening) {
                setMoveTree((prev) => {
                  const clone = JSON.parse(JSON.stringify(prev)) as MoveNode;
                  const target = findNode(clone, newFen);
                  if (target) {
                    target.openingEco = opening.eco;
                    target.openingName = opening.name;
                  }
                  return clone;
                });
              }
            });
          }
        }
      }

      setCurrentFen(newFen);
      setLastMove([result.from, result.to]);
    },
    [currentFen, moveTree, autoSave]
  );

  // ── Remove a move from the repertoire ───────────────────────────────────────
  const removeExplorerMove = useCallback(
    (move: ExplorerMove, parentFen?: string) => {
      const baseFen = parentFen ?? currentFen;
      const tempChess = new Chess(baseFen);
      let result;
      try { result = tempChess.move(move.san); } catch { return; }
      if (!result) return;
      const newFen = tempChess.fen();
      const updatedTree = removeNode(moveTree, newFen);
      setMoveTree(updatedTree);
      autoSave(updatedTree);
    },
    [currentFen, moveTree, autoSave]
  );

  // ── Keyboard navigation ────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't intercept when user is typing in an input, textarea, or contenteditable
      const tag = (e.target as HTMLElement)?.tagName;
      const isEditable = (e.target as HTMLElement)?.isContentEditable;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || isEditable) return;

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (currentPath.length > 1) {
          const prev = currentPath[currentPath.length - 2];
          navigateTo(prev.fen);
        }
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        if (currentNode && currentNode.children.length > 0) {
          const next = currentNode.children[0];
          navigateTo(next.fen);
          if (next.move) {
            setLastMove([next.move.slice(0, 2), next.move.slice(2, 4)]);
          }
        }
      } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        // Cycle between sibling variations at the current position
        if (currentPath.length < 2) return;
        const parentNode = currentPath[currentPath.length - 2];
        const siblings = parentNode.children;
        if (siblings.length < 2) return;
        e.preventDefault();
        const currentIdx = siblings.findIndex((s) => s.fen === currentFen);
        if (currentIdx === -1) return;
        const delta = e.key === "ArrowUp" ? -1 : 1;
        const nextIdx = (currentIdx + delta + siblings.length) % siblings.length;
        const sibling = siblings[nextIdx];
        navigateTo(sibling.fen);
        if (sibling.move) {
          setLastMove([sibling.move.slice(0, 2), sibling.move.slice(2, 4)]);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [currentPath, currentNode, currentFen, navigateTo]);

  // ── Cleanup flash timer on unmount ───────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
  }, []);

  // ── Save name ───────────────────────────────────────────────────────────────
  const saveName = useCallback(async () => {
    setEditingName(false);
    if (!repertoireId) return;
    await authFetch(`/api/repertoire-builder/${repertoireId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: repertoireName }),
    });
  }, [repertoireId, repertoireName]);

  // ── PGN Export ──────────────────────────────────────────────────────────────────────────────────
  const handleExportPgn = useCallback(() => {
    setShowPgnExport(true);
    setPgnCopied(false);
  }, []);

  const handleDownloadPgn = useCallback(() => {
    const pgn = exportToPgn(moveTree, repertoireName, color);
    const blob = new Blob([pgn], { type: "application/x-chess-pgn" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${repertoireName.replace(/[^a-z0-9]/gi, "_")}.pgn`;
    a.click();
    URL.revokeObjectURL(url);
  }, [moveTree, repertoireName, color]);

  const handleCopyPgn = useCallback(async () => {
    const pgn = exportToPgn(moveTree, repertoireName, color);
    await navigator.clipboard.writeText(pgn);
    setPgnCopied(true);
    setTimeout(() => setPgnCopied(false), 2000);
  }, [moveTree, repertoireName, color]);

  // ── PGN Import ──────────────────────────────────────────────────────────────────────────────────
  const handlePgnTextChange = useCallback((text: string) => {
    setPgnImportText(text);
    setPgnImportError(null);
    setPgnImportPreview(null);
    if (!text.trim()) return;
    try {
      const tree = importFromPgn(text);
      setPgnImportPreview(tree);
    } catch (e) {
      setPgnImportError(e instanceof Error ? e.message : "Invalid PGN");
    }
  }, []);

  const handlePgnFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      handlePgnTextChange(text);
    };
    reader.readAsText(file);
  }, [handlePgnTextChange]);

  const handleConfirmImport = useCallback(() => {
    if (!pgnImportPreview) return;
    let newTree: MoveNode;
    if (pgnImportMode === "replace") {
      newTree = pgnImportPreview;
    } else {
      // Merge: deep-merge the imported tree into the existing tree
      const mergeInto = (target: MoveNode, source: MoveNode) => {
        for (const srcChild of source.children) {
          const existing = target.children.find((c) => c.fen === srcChild.fen);
          if (existing) {
            // Merge comment if missing
            if (!existing.comment && srcChild.comment) existing.comment = srcChild.comment;
            mergeInto(existing, srcChild);
          } else {
            target.children.push(JSON.parse(JSON.stringify(srcChild)) as MoveNode);
          }
        }
      };
      newTree = JSON.parse(JSON.stringify(moveTree)) as MoveNode;
      mergeInto(newTree, pgnImportPreview);
    }
    setMoveTree(newTree);
    setCurrentFen(STARTING_FEN);
    setLastMove(null);
    autoSave(newTree);
    setShowPgnImport(false);
    setPgnImportText("");
    setPgnImportPreview(null);
    setPgnImportError(null);
  }, [pgnImportPreview, pgnImportMode, moveTree, autoSave]);

  // ── Determine which explorer moves are in the repertoire ────────────────────────────────────
  const repertoireFens = useMemo(() => {
    const fens = new Set<string>();
    if (!currentNode) return fens;
    for (const child of currentNode.children) {
      fens.add(child.fen);
    }
    return fens;
  }, [currentNode]);

  const isExplorerMoveInRepertoire = useCallback(
    (move: ExplorerMove): boolean => {
      try {
        const tempChess = new Chess(currentFen);
        const result = tempChess.move(move.san);
        if (!result) return false;
        return repertoireFens.has(tempChess.fen());
      } catch {
        return false;
      }
    },
    [currentFen, repertoireFens]
  );

  // ── Total games for frequency calculation ───────────────────────────────────
  const totalGames = useMemo(
    () => explorerMoves.reduce((sum, m) => sum + m.white + m.draws + m.black, 0),
    [explorerMoves]
  );
  /**
   * Coverage = fraction of "popular" opponent moves that have a prepared response.
   * A move is "popular" if it appears in ≥5% of games (1 in 20).
   * We check whether the user has a child node for the FEN reached after each popular move.
   */
  const coverage = useMemo(() => {
    if (totalGames === 0 || explorerMoves.length === 0) return null;
    // Determine whose moves are the opponent's
    const isOpponentTurn = chess.turn() === (color === "white" ? "b" : "w");
    if (!isOpponentTurn) return null; // only show coverage when it's the opponent's turn

    const THRESHOLD = 0.05; // 5% of games
    const popularMoves = explorerMoves.filter((m) => {
      const games = m.white + m.draws + m.black;
      return totalGames > 0 && games / totalGames >= THRESHOLD;
    });
    if (popularMoves.length === 0) return null;

    const covered: ExplorerMove[] = [];
    const uncovered: ExplorerMove[] = [];

    for (const m of popularMoves) {
      try {
        const tempChess = new Chess(currentFen);
        const result = tempChess.move(m.san);
        if (!result) continue;
        const reachedFen = tempChess.fen();
        // Check if the user has a child from that FEN (i.e. a prepared response)
        const opponentNode = findNode(moveTree, reachedFen);
        if (opponentNode && opponentNode.children.length > 0) {
          covered.push(m);
        } else {
          uncovered.push(m);
        }
      } catch { /* skip */ }
    }

    const pct = popularMoves.length > 0 ? (covered.length / popularMoves.length) * 100 : 0;
    return { covered: covered.length, total: popularMoves.length, pct, uncovered };
  }, [explorerMoves, totalGames, currentFen, moveTree, color, chess]);

  // ── Whose turn is it? ────────────────────────────────────────────────────────────────────────────
  const turnLabel = chess.turn() === "w" ? "White" : "Black";
  const moveNumber = Math.floor(chess.moveNumber());

  // ── Custom square styles for last move + quiz highlights ────────────────────────────────────────────────────────────────────────────
  const customSquareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {};
    if (lastMove) {
      if (quizStatus === "correct") {
        styles[lastMove[0]] = { backgroundColor: "rgba(34, 197, 94, 0.35)" };
        styles[lastMove[1]] = { backgroundColor: "rgba(34, 197, 94, 0.55)" };
      } else if (quizStatus === "wrong") {
        styles[lastMove[0]] = { backgroundColor: "rgba(239, 68, 68, 0.25)" };
        styles[lastMove[1]] = { backgroundColor: "rgba(239, 68, 68, 0.35)" };
      } else {
        styles[lastMove[0]] = { backgroundColor: "rgba(16, 185, 129, 0.25)" };
        styles[lastMove[1]] = { backgroundColor: "rgba(16, 185, 129, 0.35)" };
      }
    }
    // Highlight the correct move hint in quiz wrong state
    if (quizStatus === "wrong" && quizHintFen) {
      try {
        const hintChess = new Chess(currentFen);
        const node = findNode(moveTree, currentFen);
        const hintChild = node?.children.find((c) => c.fen === quizHintFen);
        if (hintChild?.move) {
          const from = hintChild.move.slice(0, 2);
          const to = hintChild.move.slice(2, 4);
          styles[from] = { backgroundColor: "rgba(251, 191, 36, 0.35)" };
          styles[to] = { backgroundColor: "rgba(251, 191, 36, 0.55)" };
        }
        void hintChess;
      } catch { /* skip */ }
    }
    // Hover preview highlight: semi-transparent blue overlay on from/to squares
    if (hoverPreview) {
      styles[hoverPreview.from] = { backgroundColor: "rgba(96, 165, 250, 0.30)" };
      styles[hoverPreview.to] = { backgroundColor: "rgba(96, 165, 250, 0.50)" };
    }
    return styles;
  }, [lastMove, quizStatus, quizHintFen, currentFen, moveTree, hoverPreview]);



  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? "bg-gray-950 text-white" : "bg-gray-50 text-gray-900"}`}>
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  return (
    <div className={`h-screen flex flex-col overflow-hidden ${isDark ? "bg-gray-950 text-white" : "bg-gray-50 text-gray-900"}`}>
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div
        className="sticky top-0 z-40 flex items-center gap-3 px-4 lg:px-5 py-2.5"
        style={{
          background: "oklch(0.15 0.04 145 / 0.97)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid oklch(0.22 0.06 145)",
        }}
      >
        <div className="flex items-center gap-3 w-full">
          <button
            onClick={() => navigate("/repertoire")}
            className="p-1.5 rounded-lg transition-opacity hover:opacity-70"
            style={{ color: "oklch(0.65 0.12 145)" }}
          >
            <ArrowLeft size={16} />
          </button>

          <div className="flex-1 flex items-center gap-2">
            {editingName ? (
              <input
                ref={nameInputRef}
                value={repertoireName}
                onChange={(e) => setRepertoireName(e.target.value)}
                onBlur={saveName}
                onKeyDown={(e) => e.key === "Enter" && saveName()}
                className="text-lg font-bold bg-transparent border-b-2 outline-none px-1 border-emerald-500 text-white"
                autoFocus
              />
            ) : (
              <button
                onClick={() => {
                  setEditingName(true);
                  setTimeout(() => nameInputRef.current?.focus(), 50);
                }}
                className="text-lg font-bold hover:underline text-white"
              >
                {repertoireName}
              </button>
            )}

            {openingEco && (
              <span className="text-xs px-2 py-0.5 rounded-full font-mono bg-white/10 text-white/50">
                {openingEco}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-white/40">
              {totalMoves} move{totalMoves !== 1 ? "s" : ""}
            </span>
            {saving && (
              <span className="text-xs flex items-center gap-1 text-emerald-400">
                <Loader2 size={12} className="animate-spin" /> Saving…
              </span>
            )}
            {/* PGN Import / Export buttons */}
            <button
              onClick={() => setShowPgnImport(true)}
              className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border transition-colors border-white/20 text-white/70 hover:text-white hover:border-white/40 hover:bg-white/5"
              title="Import PGN"
            >
              <Upload size={13} />
              <span className="hidden sm:inline">Import</span>
            </button>
            <button
              onClick={handleExportPgn}
              className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border transition-colors border-white/20 text-white/70 hover:text-white hover:border-white/40 hover:bg-white/5"
              title="Export PGN"
            >
              <Download size={13} />
              <span className="hidden sm:inline">Export</span>
            </button>
            {/* Test Yourself button (hidden during quiz) */}
            {quizStatus === "idle" && totalMoves > 0 && (
              <button
                onClick={startQuiz}
                className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border transition-colors border-purple-500/50 text-purple-400 hover:text-purple-300 hover:border-purple-400 hover:bg-purple-500/10"
                title="Test yourself on this repertoire"
              >
                <Brain size={13} />
                <span className="hidden sm:inline">Test Yourself</span>
              </button>
            )}
            {/* Exit quiz button (shown during quiz) */}
            {quizStatus !== "idle" && quizStatus !== "complete" && (
              <button
                onClick={exitQuiz}
                className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border transition-colors border-red-500/50 text-red-400 hover:text-red-300 hover:border-red-400 hover:bg-red-500/10"
                title="Exit quiz mode"
              >
                <X size={13} />
                <span className="hidden sm:inline">Exit Quiz</span>
              </button>
            )}
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              color === "white"
                ? "bg-white text-gray-900 border border-gray-200"
                : "bg-gray-800 text-white border border-gray-600"
            }`}>
              {color === "white" ? "♜ White" : "♚ Black"}
            </span>
            <AvatarNavDropdown currentPage="Training" />
          </div>
        </div>
      </div>

      {/* Quiz mode banner */}
      {quizStatus !== "idle" && quizStatus !== "complete" && (
        <div className={`border-b ${
          quizStatus === "correct"
            ? isDark ? "bg-emerald-900/30 border-emerald-500/30" : "bg-emerald-50 border-emerald-200"
            : quizStatus === "wrong"
            ? isDark ? "bg-red-900/30 border-red-500/30" : "bg-red-50 border-red-200"
            : isDark ? "bg-purple-900/20 border-purple-500/20" : "bg-purple-50 border-purple-200"
        }`}>
          <div className="max-w-[1600px] mx-auto px-4 py-2 flex items-center gap-4">
            <Brain size={16} className={quizStatus === "correct" ? "text-emerald-500" : quizStatus === "wrong" ? "text-red-400" : isDark ? "text-purple-400" : "text-purple-600"} />
            <span className={`text-sm font-semibold ${
              quizStatus === "correct" ? "text-emerald-500" : quizStatus === "wrong" ? "text-red-400" : isDark ? "text-purple-300" : "text-purple-700"
            }`}>
              {quizStatus === "correct" ? "✓ Correct!" : quizStatus === "wrong" ? `✗ Wrong — correct move: ${quizHintSan ?? "?"}` : "Quiz Mode — find your prepared move"}
            </span>
            <span className={`ml-auto text-xs ${
              isDark ? "text-white/50" : "text-gray-500"
            }`}>
              Score: {quizCorrect}/{quizTotal} ({quizTotal > 0 ? Math.round((quizCorrect / quizTotal) * 100) : 100}%)
            </span>
            {quizStatus === "wrong" && (
              <button
                onClick={skipQuizPosition}
                className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg ${
                  isDark ? "text-white/60 hover:text-white hover:bg-white/10" : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"
                }`}
              >
                <SkipForward size={13} />
                Skip
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Main Content ────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden">
        <div className="max-w-[1600px] mx-auto px-4 py-2 h-full">
        <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 h-full">
          {/* ── Left: Board + Eval Bar ──────────────────────────────────────── */}
          <div className="w-full lg:w-[55%] flex gap-2 items-start justify-center min-h-0 pt-1">
            {/* Eval bar */}
            {showEngine && sfEval && (
              <div className="hidden sm:block" style={{ height: `${boardSize}px` }}>
                <EvalBar cp={sfEval.cp} mate={sfEval.mate} isDark={isDark} />
              </div>
            )}

            {/* Board */}
            <div className="flex-1 flex flex-col" ref={boardContainerRef}>
              <div className={`rounded-2xl overflow-hidden border-2 shadow-2xl flex-shrink-0 ${
                isDark
                  ? "border-emerald-500/30 shadow-emerald-500/10"
                  : "border-emerald-600/20 shadow-emerald-600/5"
              }`}>
                <Chessboard
                  options={{
                    position: hoverPreview?.fen ?? currentFen,
                    onPieceDrop: handlePieceDrop,
                    boardOrientation: boardOrientation,
                    squareStyles: customSquareStyles,
                    boardStyle: {
                      borderRadius: "0",
                      width: `${boardSize}px`,
                      height: `${boardSize}px`,
                    },
                    darkSquareStyle: { backgroundColor: "#779952" },
                    lightSquareStyle: { backgroundColor: "#edeed1" },
                    animationDurationInMs: 200,
                  }}
                />
              </div>

              {/* Board controls */}
              <div className="flex items-center justify-between mt-3">
                <div className="flex items-center gap-2">
                  {openingName && (
                    <span className={`text-sm font-medium ${isDark ? "text-white/70" : "text-gray-600"}`}>
                      {openingName}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => navigateTo(STARTING_FEN)}
                    className={`p-2 rounded-lg transition ${isDark ? "hover:bg-white/10 text-white/60" : "hover:bg-gray-200 text-gray-500"}`}
                    title="Reset to start"
                  >
                    <RotateCcw size={16} />
                  </button>
                  <button
                    onClick={() => {
                      if (currentPath.length > 1) {
                        navigateTo(currentPath[currentPath.length - 2].fen);
                      }
                    }}
                    className={`p-2 rounded-lg transition ${isDark ? "hover:bg-white/10 text-white/60" : "hover:bg-gray-200 text-gray-500"}`}
                    title="Previous move (←)"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <button
                    onClick={() => {
                      if (currentNode && currentNode.children.length > 0) {
                        const next = currentNode.children[0];
                        navigateTo(next.fen);
                        if (next.move) setLastMove([next.move.slice(0, 2), next.move.slice(2, 4)]);
                      }
                    }}
                    className={`p-2 rounded-lg transition ${isDark ? "hover:bg-white/10 text-white/60" : "hover:bg-gray-200 text-gray-500"}`}
                    title="Next move (→)"
                  >
                    <ChevronRight size={18} />
                  </button>
                  <button
                    onClick={() => setBoardOrientation((o) => (o === "white" ? "black" : "white"))}
                    className={`p-2 rounded-lg transition ${isDark ? "hover:bg-white/10 text-white/60" : "hover:bg-gray-200 text-gray-500"}`}
                    title="Flip board"
                  >
                    <FlipHorizontal size={16} />
                  </button>
                  <button
                    onClick={() => setShowEngine((s) => !s)}
                    className={`p-2 rounded-lg transition ${
                      showEngine
                        ? isDark
                          ? "bg-emerald-500/20 text-emerald-400"
                          : "bg-emerald-100 text-emerald-600"
                        : isDark
                        ? "hover:bg-white/10 text-white/40"
                        : "hover:bg-gray-200 text-gray-400"
                    }`}
                    title="Toggle engine"
                  >
                    <Zap size={16} />
                  </button>
                </div>
              </div>

              {/* Engine info line */}
              {showEngine && sfEval && (
                <div className={`mt-2 text-xs flex items-center gap-2 ${isDark ? "text-white/40" : "text-gray-400"}`}>
                  <Zap size={12} />
                  <span>Stockfish 18 Lite · depth {sfEval.depth}</span>
                  {sfEval.bestMove && (
                    <span className={`font-mono ${isDark ? "text-white/60" : "text-gray-500"}`}>
                      Best: {sfEval.bestMove}
                    </span>
                  )}
                </div>
              )}

              {/* ── Annotation Notes ──────────────────────────────────────────────────────────────── */}
              {quizStatus === "idle" && (
                <div className={`mt-3 rounded-xl border ${
                  isDark ? "bg-gray-900/60 border-white/10" : "bg-gray-50 border-gray-200"
                }`}>
                  {/* Header */}
                  <div className={`flex items-center justify-between px-3 py-2 border-b ${
                    isDark ? "border-white/10" : "border-gray-200"
                  }`}>
                    <div className="flex items-center gap-1.5">
                      <MessageSquare size={13} className={isDark ? "text-white/40" : "text-gray-400"} />
                      <span className={`text-xs font-medium ${
                        isDark ? "text-white/50" : "text-gray-500"
                      }`}>
                        {currentNode && currentNode.fen !== moveTree.fen
                          ? `Note on ${currentNode.san ?? "starting position"}`
                          : "Note on starting position"}
                      </span>
                    </div>
                    {noteSaved && (
                      <span className="flex items-center gap-1 text-[11px] text-emerald-500">
                        <Check size={11} /> Saved
                      </span>
                    )}
                  </div>
                  {/* Textarea */}
                  <textarea
                    value={noteText}
                    onChange={(e) => {
                      setNoteText(e.target.value);
                      saveNote(e.target.value);
                    }}
                    onKeyDown={(e) => {
                      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                        e.preventDefault();
                        saveNote(noteText);
                      }
                    }}
                    placeholder={`Add coaching notes for this position… (Ctrl+Enter to save)`}
                    rows={3}
                    className={`w-full px-3 py-2 text-sm resize-none bg-transparent outline-none placeholder:text-sm ${
                      isDark
                        ? "text-white/80 placeholder-white/25"
                        : "text-gray-700 placeholder-gray-400"
                    }`}
                  />
                </div>
              )}
            </div>
          </div>

          {/* ── Right: Quiz Panel OR Explorer Panel ─────────────────────────────────────────────── */}
          {quizStatus !== "idle" && quizStatus !== "complete" ? (
            /* ── Quiz Status Panel ── */
            <div className={`w-full lg:w-[45%] lg:sticky lg:top-20 rounded-2xl border ${
              isDark ? "bg-gray-900/50 border-purple-500/20" : "bg-white border-purple-200"
            } overflow-hidden`}>
              <div className={`px-4 py-3 border-b ${
                isDark ? "border-purple-500/20" : "border-purple-100"
              }`}>
                <div className="flex items-center gap-2 mb-1">
                  <Brain size={18} className={isDark ? "text-purple-400" : "text-purple-600"} />
                  <h3 className={`text-base font-semibold ${
                    isDark ? "text-purple-300" : "text-purple-700"
                  }`}>Quiz Mode</h3>
                </div>
                <p className={`text-xs ${
                  isDark ? "text-white/50" : "text-gray-500"
                }`}>
                  Find your prepared move from memory. Drag a piece to make your move.
                </p>
              </div>
              {/* Score card */}
              <div className="px-4 py-4">
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className={`rounded-xl p-3 text-center ${
                    isDark ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-emerald-50 border border-emerald-100"
                  }`}>
                    <div className={`text-2xl font-bold ${
                      isDark ? "text-emerald-400" : "text-emerald-600"
                    }`}>{quizCorrect}</div>
                    <div className={`text-[11px] mt-0.5 ${
                      isDark ? "text-white/40" : "text-gray-400"
                    }`}>Correct</div>
                  </div>
                  <div className={`rounded-xl p-3 text-center ${
                    isDark ? "bg-white/5 border border-white/10" : "bg-gray-50 border border-gray-100"
                  }`}>
                    <div className={`text-2xl font-bold ${
                      isDark ? "text-white/80" : "text-gray-700"
                    }`}>{quizTotal}</div>
                    <div className={`text-[11px] mt-0.5 ${
                      isDark ? "text-white/40" : "text-gray-400"
                    }`}>Attempts</div>
                  </div>
                  <div className={`rounded-xl p-3 text-center ${
                    isDark ? "bg-purple-500/10 border border-purple-500/20" : "bg-purple-50 border border-purple-100"
                  }`}>
                    <div className={`text-2xl font-bold ${
                      isDark ? "text-purple-400" : "text-purple-600"
                    }`}>
                      {quizTotal > 0 ? Math.round((quizCorrect / quizTotal) * 100) : 100}%
                    </div>
                    <div className={`text-[11px] mt-0.5 ${
                      isDark ? "text-white/40" : "text-gray-400"
                    }`}>Accuracy</div>
                  </div>
                </div>

                {/* Move log */}
                {quizMoveLog.length > 0 && (
                  <div className={`rounded-xl p-3 ${
                    isDark ? "bg-white/5" : "bg-gray-50"
                  }`}>
                    <div className={`text-xs font-medium mb-2 ${
                      isDark ? "text-white/50" : "text-gray-500"
                    }`}>Move history</div>
                    <div className="flex flex-wrap gap-1.5">
                      {quizMoveLog.map((entry, i) => (
                        <span
                          key={i}
                          className={`text-xs font-mono px-2 py-0.5 rounded-full ${
                            entry.correct
                              ? isDark ? "bg-emerald-500/20 text-emerald-400" : "bg-emerald-100 text-emerald-700"
                              : isDark ? "bg-red-500/20 text-red-400" : "bg-red-100 text-red-700"
                          }`}
                        >
                          {entry.san}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {quizStatus === "wrong" && quizHintSan && (
                  <div className={`mt-3 rounded-xl p-3 ${
                    isDark ? "bg-amber-500/10 border border-amber-500/20" : "bg-amber-50 border border-amber-200"
                  }`}>
                    <p className={`text-sm ${
                      isDark ? "text-amber-300" : "text-amber-700"
                    }`}>
                      Correct move was: <span className="font-bold font-mono">{quizHintSan}</span>
                    </p>
                    <button
                      onClick={skipQuizPosition}
                      className={`mt-2 flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg ${
                        isDark
                          ? "bg-amber-500/20 text-amber-300 hover:bg-amber-500/30"
                          : "bg-amber-100 text-amber-700 hover:bg-amber-200"
                      }`}
                    >
                      <SkipForward size={13} /> Continue anyway
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* ── Explorer Panel ── */
          <div className={`w-full lg:w-[45%] lg:sticky lg:top-20 rounded-2xl border ${
            isDark ? "bg-gray-900/50 border-white/10" : "bg-white border-gray-200"
          } overflow-hidden`}>
            {/* Panel header */}
            <div className={`px-4 py-3 border-b ${isDark ? "border-white/10" : "border-gray-100"}`}>
              <MoveTreeBreadcrumb path={currentPath} onNavigate={navigateTo} isDark={isDark} />

              <div className="flex items-center justify-between">
                <h3 className={`text-base font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
                  Choose a move to prepare for
                </h3>
                <span className={`text-xs ${isDark ? "text-white/40" : "text-gray-400"}`}>
                  {turnLabel} to move · Move {moveNumber}
                </span>
              </div>
            </div>{/* ── Coverage Tracker ──────────────────────────────────────────────────────────────────────── */}
            {coverage && (
              <div className={`px-4 py-3 border-b ${
                isDark ? "border-white/10" : "border-gray-100"
              }`}>
                {/* Header row */}
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-semibold ${
                    isDark ? "text-white/70" : "text-gray-600"
                  }`}>
                    Your coverage
                  </span>
                  <span className={`text-xs font-bold ${
                    coverage.pct >= 80
                      ? "text-emerald-500"
                      : coverage.pct >= 40
                      ? "text-amber-500"
                      : "text-red-400"
                  }`}>
                    {coverage.covered}/{coverage.total} popular moves prepared
                  </span>
                </div>

                {/* Progress bar */}
                <div className={`h-2 w-full rounded-full overflow-hidden ${
                  isDark ? "bg-white/10" : "bg-gray-200"
                }`}>
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      coverage.pct >= 80
                        ? "bg-emerald-500"
                        : coverage.pct >= 40
                        ? "bg-amber-500"
                        : "bg-red-400"
                    }`}
                    style={{ width: `${coverage.pct}%` }}
                  />
                </div>

                {/* Uncovered moves hint */}
                {coverage.uncovered.length > 0 && (
                  <div className="mt-2.5">
                    <span className={`text-[11px] block mb-1.5 ${
                      isDark ? "text-white/40" : "text-gray-400"
                    }`}>
                      Not yet prepared — click to prepare:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {coverage.uncovered.map((m) => (
                        <button
                          key={m.uci}
                          onClick={() => {
                            // Clear any previous flash timer
                            if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
                            // Show ghost chip with this move's SAN
                            setFlashedChipSan(m.san);
                            // Navigate to the position
                            playExplorerMove(m);
                            toast.info(`Navigated to after ${m.san} — now add your response from here.`, { duration: 3000 });
                            // Clear ghost chip after 800ms
                            flashTimerRef.current = setTimeout(() => setFlashedChipSan(null), 800);
                          }}
                          title={`Navigate to position after ${m.san} and add your response`}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono font-bold
                            border transition-all duration-150 cursor-pointer
                            ${
                              isDark
                                ? "border-amber-500/40 bg-amber-500/10 text-amber-400 hover:bg-amber-500/25 hover:border-amber-400 hover:text-amber-300 active:scale-95"
                                : "border-amber-400/50 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:border-amber-500 hover:text-amber-800 active:scale-95"
                            }`}
                        >
                          <svg className="w-2.5 h-2.5 shrink-0" fill="none" viewBox="0 0 10 10" stroke="currentColor" strokeWidth="1.8">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2 5h6M5.5 2.5L8 5l-2.5 2.5" />
                          </svg>
                          {m.san}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {coverage.uncovered.length === 0 && (
                  <p className={`mt-1.5 text-[11px] ${
                    isDark ? "text-emerald-400" : "text-emerald-600"
                  }`}>
                    ✓ All popular moves covered!
                  </p>
                )}
              </div>
            )}

            {/* Ghost chip: shown for 800ms after a coverage chip is clicked to confirm navigation */}
            {flashedChipSan && !coverage && (
              <div className={`px-4 py-2 border-b ${
                isDark ? "border-white/10" : "border-gray-100"
              }`}>
                <span className={`text-[11px] block mb-1.5 ${
                  isDark ? "text-white/40" : "text-gray-400"
                }`}>
                  Navigated to:
                </span>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono font-bold
                    border pointer-events-none select-none
                    ${
                      isDark
                        ? "border-emerald-400 bg-emerald-500/20 text-emerald-300 shadow-[0_0_8px_rgba(52,211,153,0.5)]"
                        : "border-emerald-500 bg-emerald-50 text-emerald-700 shadow-[0_0_8px_rgba(16,185,129,0.4)]"
                    }`}
                >
                  <svg className="w-2.5 h-2.5 shrink-0" fill="none" viewBox="0 0 10 10" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M1.5 5.5l2.5 2.5 4.5-5" />
                  </svg>
                  {flashedChipSan}
                </span>
              </div>
            )}

            {/* Repertoire children (moves already in tree) */}
            {currentNode && currentNode.children.length > 0 && (
              <div className={`px-4 py-2 border-b ${isDark ? "border-white/10" : "border-gray-100"}`}>
                <div className={`text-xs font-medium mb-2 ${isDark ? "text-emerald-400" : "text-emerald-600"}`}>
                  Your repertoire moves
                </div>
                {currentNode.children.map((child) => (
                  <div
                    key={child.fen}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setHoverPreview(null);
                      navigateTo(child.fen);
                      if (child.move) setLastMove([child.move.slice(0, 2), child.move.slice(2, 4)]);
                    }}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { setHoverPreview(null); navigateTo(child.fen); if (child.move) setLastMove([child.move.slice(0, 2), child.move.slice(2, 4)]); } }}
                    onMouseEnter={() => {
                      if (child.move) {
                        setHoverPreview({
                          fen: child.fen,
                          from: child.move.slice(0, 2),
                          to: child.move.slice(2, 4),
                        });
                      }
                    }}
                    onMouseLeave={() => setHoverPreview(null)}
                    className={`group flex items-center gap-2 w-full px-3 py-2 rounded-lg text-left transition cursor-pointer ${
                      isDark ? "hover:bg-emerald-500/10" : "hover:bg-emerald-50"
                    }`}
                  >
                    <BookOpen size={14} className={isDark ? "text-emerald-400" : "text-emerald-600"} />
                    {/* SAN + annotation badge */}
                    <span className="font-bold font-mono text-sm flex items-center gap-0.5">
                      {child.san || "?"}
                      {child.annotation && (
                        <span className={`text-xs font-bold ${
                          child.annotation === "!!" ? "text-emerald-400" :
                          child.annotation === "!" ? "text-emerald-500" :
                          child.annotation === "!?" ? "text-blue-400" :
                          child.annotation === "?!" ? "text-amber-400" :
                          child.annotation === "?" ? "text-orange-400" :
                          "text-red-500"
                        }`}>{child.annotation}</span>
                      )}
                    </span>
                    {/* Opening info */}
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      {child.openingEco && (
                        <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded font-mono ${
                          isDark ? "bg-emerald-500/20 text-emerald-400" : "bg-emerald-100 text-emerald-700"
                        }`}>
                          {child.openingEco}
                        </span>
                      )}
                      {child.openingName && (
                        <span className={`text-xs truncate ${isDark ? "text-white/50" : "text-gray-400"}`}>
                          {child.openingName}
                        </span>
                      )}
                      {!child.openingName && (
                        <span className={`text-xs ${isDark ? "text-white/30" : "text-gray-300"}`}>
                          {countMoves({ ...child, children: child.children }) + 1} move{countMoves({ ...child, children: child.children }) + 1 !== 1 ? "s" : ""} deep
                        </span>
                      )}
                    </div>
                    {/* Annotation buttons — visible on hover */}
                    <div
                      className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {(["!!", "!", "!?", "?!", "?", "??"] as const).map((glyph) => (
                        <button
                          key={glyph}
                          title={{
                            "!!": "Brilliant",
                            "!": "Good move",
                            "!?": "Interesting",
                            "?!": "Dubious",
                            "?": "Mistake",
                            "??": "Blunder",
                          }[glyph]}
                          onClick={(e) => {
                            e.stopPropagation();
                            setMoveTree((prev) => {
                              const clone = JSON.parse(JSON.stringify(prev)) as MoveNode;
                              const target = findNode(clone, child.fen);
                              if (target) target.annotation = target.annotation === glyph ? undefined : glyph;
                              return clone;
                            });
                            setMoveTree((latest) => { autoSave(latest); return latest; });
                          }}
                          className={`text-[11px] font-bold w-5 h-5 flex items-center justify-center rounded transition ${
                            child.annotation === glyph
                              ? glyph === "!!" ? "bg-emerald-500/30 text-emerald-400"
                                : glyph === "!" ? "bg-emerald-600/30 text-emerald-500"
                                : glyph === "!?" ? "bg-blue-500/30 text-blue-400"
                                : glyph === "?!" ? "bg-amber-500/30 text-amber-400"
                                : glyph === "?" ? "bg-orange-500/30 text-orange-400"
                                : "bg-red-500/30 text-red-400"
                              : isDark
                              ? "text-white/30 hover:text-white/70 hover:bg-white/10"
                              : "text-gray-300 hover:text-gray-600 hover:bg-gray-100"
                          }`}
                        >
                          {glyph}
                        </button>
                      ))}
                    </div>
                    {/* Pencil badge if this node has a note */}
                    {child.comment && (
                      <span
                        className={`shrink-0 ${
                          isDark ? "text-amber-400/70" : "text-amber-500/80"
                        }`}
                        title={child.comment}
                      >
                        <Pencil size={11} />
                      </span>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const updated = removeNode(moveTree, child.fen);
                        setMoveTree(updated);
                        autoSave(updated);
                      }}
                      className="shrink-0 text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100"
                      title="Remove"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Explorer moves table header */}
            <div className={`px-4 py-2 flex items-center gap-3 text-xs ${isDark ? "text-white/40" : "text-gray-400"}`}>
              <div className="w-16 shrink-0">Move</div>
              <div className="flex-1">Opening</div>
              <div className="w-20 text-right shrink-0">Expected in</div>
              <div className="w-24 shrink-0 text-center">W / D / L</div>
              <div className="w-8 shrink-0" />
            </div>

            {/* Explorer moves list */}
            <div className="px-2 pb-4 max-h-[60vh] overflow-y-auto">
              {explorerLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="animate-spin" size={20} />
                  <span className={`ml-2 text-sm ${isDark ? "text-white/40" : "text-gray-400"}`}>Loading moves…</span>
                </div>
              ) : explorerMoves.length === 0 ? (
                <div className={`text-center py-8 text-sm ${isDark ? "text-white/30" : "text-gray-400"}`}>
                  No moves found in the database for this position.
                  <br />
                  <span className="text-xs">Try making a move on the board to continue building.</span>
                </div>
              ) : (
                explorerMoves.map((move) => (
                  <ExplorerMoveRow
                    key={move.uci}
                    move={move}
                    totalGames={totalGames}
                    isInRepertoire={isExplorerMoveInRepertoire(move)}
                    onAdd={() => addExplorerMove(move, currentFen)}
                    onRemove={() => removeExplorerMove(move, currentFen)}
                    onPlay={() => { setHoverPreview(null); playExplorerMove(move); }}
                    onHoverEnter={() => {
                      try {
                        const uci = move.uci;
                        const from = uci.slice(0, 2);
                        const to = uci.slice(2, 4);
                        const tempChess = new Chess(currentFen);
                        tempChess.move(move.san);
                        setHoverPreview({ fen: tempChess.fen(), from, to });
                      } catch { /* skip */ }
                    }}
                    onHoverLeave={() => setHoverPreview(null)}
                    isDark={isDark}
                    openingName={move.openingName}
                    openingEco={move.openingEco}
                  />
                ))
              )}
            </div>
          </div>
          )}
        </div>
      </div>
      </div>

      {/* ── Quiz Summary Modal ──────────────────────────────────────────────────────────────────────────── */}
      {showQuizSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className={`w-full max-w-md rounded-2xl shadow-2xl ${
            isDark ? "bg-gray-900 border border-white/10" : "bg-white border border-gray-200"
          }`}>
            <div className="px-6 py-6 text-center">
              <Trophy size={40} className="mx-auto mb-3 text-amber-400" />
              <h2 className={`text-2xl font-bold mb-1 ${
                isDark ? "text-white" : "text-gray-900"
              }`}>Quiz Complete!</h2>
              <p className={`text-sm mb-6 ${
                isDark ? "text-white/50" : "text-gray-500"
              }`}>
                You reached the end of your prepared repertoire.
              </p>

              <div className="grid grid-cols-3 gap-3 mb-6">
                <div className={`rounded-xl p-3 ${
                  isDark ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-emerald-50 border border-emerald-100"
                }`}>
                  <div className={`text-3xl font-bold ${
                    isDark ? "text-emerald-400" : "text-emerald-600"
                  }`}>{quizCorrect}</div>
                  <div className={`text-xs mt-0.5 ${
                    isDark ? "text-white/40" : "text-gray-400"
                  }`}>Correct</div>
                </div>
                <div className={`rounded-xl p-3 ${
                  isDark ? "bg-white/5 border border-white/10" : "bg-gray-50 border border-gray-100"
                }`}>
                  <div className={`text-3xl font-bold ${
                    isDark ? "text-white/80" : "text-gray-700"
                  }`}>{quizTotal}</div>
                  <div className={`text-xs mt-0.5 ${
                    isDark ? "text-white/40" : "text-gray-400"
                  }`}>Attempts</div>
                </div>
                <div className={`rounded-xl p-3 ${
                  isDark ? "bg-purple-500/10 border border-purple-500/20" : "bg-purple-50 border border-purple-100"
                }`}>
                  <div className={`text-3xl font-bold ${
                    isDark ? "text-purple-400" : "text-purple-600"
                  }`}>
                    {quizTotal > 0 ? Math.round((quizCorrect / quizTotal) * 100) : 100}%
                  </div>
                  <div className={`text-xs mt-0.5 ${
                    isDark ? "text-white/40" : "text-gray-400"
                  }`}>Accuracy</div>
                </div>
              </div>

              {quizMoveLog.length > 0 && (
                <div className={`rounded-xl p-3 mb-6 text-left ${
                  isDark ? "bg-white/5" : "bg-gray-50"
                }`}>
                  <div className={`text-xs font-medium mb-2 ${
                    isDark ? "text-white/50" : "text-gray-500"
                  }`}>Moves reviewed</div>
                  <div className="flex flex-wrap gap-1.5">
                    {quizMoveLog.map((entry, i) => (
                      <span
                        key={i}
                        className={`text-xs font-mono px-2 py-0.5 rounded-full ${
                          entry.correct
                            ? isDark ? "bg-emerald-500/20 text-emerald-400" : "bg-emerald-100 text-emerald-700"
                            : isDark ? "bg-red-500/20 text-red-400" : "bg-red-100 text-red-700"
                        }`}
                      >
                        {entry.san}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={startQuiz}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-purple-600 hover:bg-purple-500 text-white transition-colors"
                >
                  <Brain size={15} /> Try Again
                </button>
                <button
                  onClick={exitQuiz}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                    isDark
                      ? "border-white/20 text-white/80 hover:bg-white/5"
                      : "border-gray-300 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  Back to Builder
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── PGN Export Modal ──────────────────────────────────────────────────────────────── */}
      {showPgnExport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className={`w-full max-w-2xl rounded-2xl shadow-2xl ${
            isDark ? "bg-gray-900 border border-white/10" : "bg-white border border-gray-200"
          }`}>
            {/* Header */}
            <div className={`flex items-center justify-between px-6 py-4 border-b ${
              isDark ? "border-white/10" : "border-gray-200"
            }`}>
              <div className="flex items-center gap-2">
                <FileText size={18} className={isDark ? "text-emerald-400" : "text-emerald-600"} />
                <h2 className={`text-lg font-bold ${isDark ? "text-white" : "text-gray-900"}`}>Export PGN</h2>
              </div>
              <button onClick={() => setShowPgnExport(false)} className={isDark ? "text-white/50 hover:text-white" : "text-gray-400 hover:text-gray-700"}>
                <X size={20} />
              </button>
            </div>

            {/* PGN text */}
            <div className="px-6 py-4">
              <p className={`text-sm mb-3 ${isDark ? "text-white/60" : "text-gray-500"}`}>
                Copy or download the PGN to use in Chessbase, Lichess studies, or any other chess software.
              </p>
              <textarea
                readOnly
                value={exportToPgn(moveTree, repertoireName, color)}
                rows={12}
                className={`w-full text-xs font-mono rounded-xl p-3 resize-none outline-none ${
                  isDark
                    ? "bg-gray-800 text-white/80 border border-white/10"
                    : "bg-gray-50 text-gray-800 border border-gray-200"
                }`}
              />
            </div>

            {/* Actions */}
            <div className={`flex items-center justify-end gap-3 px-6 py-4 border-t ${
              isDark ? "border-white/10" : "border-gray-200"
            }`}>
              <button
                onClick={handleCopyPgn}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
                  isDark
                    ? "border-white/20 text-white/80 hover:bg-white/5"
                    : "border-gray-300 text-gray-700 hover:bg-gray-50"
                }`}
              >
                {pgnCopied ? <Check size={15} className="text-emerald-500" /> : <Copy size={15} />}
                {pgnCopied ? "Copied!" : "Copy to clipboard"}
              </button>
              <button
                onClick={handleDownloadPgn}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
              >
                <Download size={15} />
                Download .pgn
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PGN Import Modal ──────────────────────────────────────────────────────────────── */}
      {showPgnImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className={`w-full max-w-2xl rounded-2xl shadow-2xl ${
            isDark ? "bg-gray-900 border border-white/10" : "bg-white border border-gray-200"
          }`}>
            {/* Header */}
            <div className={`flex items-center justify-between px-6 py-4 border-b ${
              isDark ? "border-white/10" : "border-gray-200"
            }`}>
              <div className="flex items-center gap-2">
                <Upload size={18} className={isDark ? "text-emerald-400" : "text-emerald-600"} />
                <h2 className={`text-lg font-bold ${isDark ? "text-white" : "text-gray-900"}`}>Import PGN</h2>
              </div>
              <button onClick={() => { setShowPgnImport(false); setPgnImportText(""); setPgnImportPreview(null); setPgnImportError(null); }} className={isDark ? "text-white/50 hover:text-white" : "text-gray-400 hover:text-gray-700"}>
                <X size={20} />
              </button>
            </div>

            <div className="px-6 py-4 space-y-4">
              {/* File picker */}
              <div>
                <label className={`block text-sm font-medium mb-1.5 ${isDark ? "text-white/70" : "text-gray-700"}`}>
                  Upload a .pgn file
                </label>
                <div
                  onClick={() => pgnImportFileRef.current?.click()}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-dashed cursor-pointer transition-colors ${
                    isDark
                      ? "border-white/20 hover:border-emerald-500/50 text-white/50 hover:text-white/80"
                      : "border-gray-300 hover:border-emerald-500 text-gray-400 hover:text-gray-600"
                  }`}
                >
                  <Upload size={18} />
                  <span className="text-sm">Click to choose a .pgn file</span>
                </div>
                <input
                  ref={pgnImportFileRef}
                  type="file"
                  accept=".pgn,text/plain"
                  className="hidden"
                  onChange={handlePgnFileChange}
                />
              </div>

              {/* Or paste */}
              <div>
                <label className={`block text-sm font-medium mb-1.5 ${isDark ? "text-white/70" : "text-gray-700"}`}>
                  Or paste PGN text
                </label>
                <textarea
                  value={pgnImportText}
                  onChange={(e) => handlePgnTextChange(e.target.value)}
                  rows={8}
                  placeholder={`[Event "My Opening"]\n\n1. e4 e5 2. Nf3 Nc6 *`}
                  className={`w-full text-xs font-mono rounded-xl p-3 resize-none outline-none ${
                    isDark
                      ? "bg-gray-800 text-white/80 border border-white/10 placeholder:text-white/20"
                      : "bg-gray-50 text-gray-800 border border-gray-200 placeholder:text-gray-400"
                  }`}
                />
              </div>

              {/* Error */}
              {pgnImportError && (
                <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 rounded-xl px-4 py-2.5">
                  <X size={15} className="shrink-0" />
                  {pgnImportError}
                </div>
              )}

              {/* Preview */}
              {pgnImportPreview && !pgnImportError && (
                <div className={`rounded-xl px-4 py-3 ${
                  isDark ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-emerald-50 border border-emerald-200"
                }`}>
                  <p className={`text-sm font-medium ${isDark ? "text-emerald-300" : "text-emerald-700"}`}>
                    ✓ Valid PGN — {countMoves(pgnImportPreview)} move{countMoves(pgnImportPreview) !== 1 ? "s" : ""} ({countPly(pgnImportPreview)} ply deep)
                  </p>
                </div>
              )}

              {/* Import mode */}
              {pgnImportPreview && (
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDark ? "text-white/70" : "text-gray-700"}`}>
                    Import mode
                  </label>
                  <div className="flex gap-3">
                    {(["replace", "merge"] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setPgnImportMode(mode)}
                        className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${
                          pgnImportMode === mode
                            ? isDark
                              ? "bg-emerald-600 border-emerald-600 text-white"
                              : "bg-emerald-600 border-emerald-600 text-white"
                            : isDark
                              ? "border-white/20 text-white/60 hover:bg-white/5"
                              : "border-gray-300 text-gray-600 hover:bg-gray-50"
                        }`}
                      >
                        {mode === "replace" ? "Replace current tree" : "Merge into current tree"}
                      </button>
                    ))}
                  </div>
                  <p className={`text-xs mt-1.5 ${isDark ? "text-white/40" : "text-gray-400"}`}>
                    {pgnImportMode === "replace"
                      ? "The imported PGN will replace your entire current repertoire."
                      : "New lines from the PGN will be added to your existing repertoire without removing anything."}
                  </p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className={`flex items-center justify-end gap-3 px-6 py-4 border-t ${
              isDark ? "border-white/10" : "border-gray-200"
            }`}>
              <button
                onClick={() => { setShowPgnImport(false); setPgnImportText(""); setPgnImportPreview(null); setPgnImportError(null); }}
                className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
                  isDark ? "border-white/20 text-white/70 hover:bg-white/5" : "border-gray-300 text-gray-600 hover:bg-gray-50"
                }`}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmImport}
                disabled={!pgnImportPreview || !!pgnImportError}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors"
              >
                <Upload size={15} />
                Import PGN
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
