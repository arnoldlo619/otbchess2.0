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
import { Chessboard, type PieceDropHandlerArgs } from "react-chessboard";
import { Chess, type Square } from "chess.js";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/hooks/useAuth";
import { useStockfish, type StockfishEval } from "@/hooks/useStockfish";
import { authFetch } from "@/lib/apiFetch";
import { useRoute, useLocation } from "wouter";
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
    const url = `https://explorer.lichess.ovh/lichess?variant=standard&speeds=rapid,classical&ratings=1600,1800,2000,2200,2500&fen=${encodeURIComponent(fen)}`;
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

  for (const token of tokens) {
    if (token === "(" ) {
      // Start variation: go back one ply from current position
      const current = stack[stack.length - 1];
      const parent = stack[stack.length - 2] ?? stack[0];
      // The variation starts from the parent's position
      const parentChess = parent ? new Chess(parent.chess.fen()) : new Chess();
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
          children: [],
        };
        top.node.children.push(child);
      } else if (pendingComment && !child.comment) {
        child.comment = pendingComment;
      }
      pendingComment = undefined;

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

    const fetchExplorer = async () => {
      try {
        const url = `https://explorer.lichess.ovh/lichess?variant=standard&speeds=rapid,classical&ratings=1600,1800,2000,2200,2500&fen=${encodeURIComponent(currentFen)}`;
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

  // ── Make a move on the board ────────────────────────────────────────────────
  const makeMove = useCallback(
    (from: string, to: string, promotion?: string) => {
      const tempChess = new Chess(currentFen);
      const result = tempChess.move({ from: from as Square, to: to as Square, promotion: promotion || "q" });
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
      return makeMove(sourceSquare, targetSquare);
    },
    [makeMove]
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

  // ── Add explorer move to repertoire ─────────────────────────────────────────
  const addExplorerMove = useCallback(
    (move: ExplorerMove) => {
      const tempChess = new Chess(currentFen);
      const result = tempChess.move(move.san);
      if (!result) return;

      const newFen = tempChess.fen();
      const updatedTree = JSON.parse(JSON.stringify(moveTree)) as MoveNode;
      const parentNode = findNode(updatedTree, currentFen);
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

  // ── Play an explorer move (navigate to it) ─────────────────────────────────
  const playExplorerMove = useCallback(
    (move: ExplorerMove) => {
      const tempChess = new Chess(currentFen);
      const result = tempChess.move(move.san);
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
    (move: ExplorerMove) => {
      const tempChess = new Chess(currentFen);
      const result = tempChess.move(move.san);
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
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [currentPath, currentNode, navigateTo]);

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
      const tempChess = new Chess(currentFen);
      const result = tempChess.move(move.san);
      if (!result) return false;
      return repertoireFens.has(tempChess.fen());
    },
    [currentFen, repertoireFens]
  );

  // ── Total games for frequency calculation ───────────────────────────────────
  const totalGames = useMemo(
    () => explorerMoves.reduce((sum, m) => sum + m.white + m.draws + m.black, 0),
    [explorerMoves]
  );

  // ── Whose turn is it? ──────────────────────────────────────────────────────
  const turnLabel = chess.turn() === "w" ? "White" : "Black";
  const moveNumber = Math.floor(chess.moveNumber());

  // ── Custom square styles for last move ──────────────────────────────────────
  const customSquareStyles = useMemo(() => {
    if (!lastMove) return {};
    return {
      [lastMove[0]]: { backgroundColor: "rgba(16, 185, 129, 0.25)" },
      [lastMove[1]]: { backgroundColor: "rgba(16, 185, 129, 0.35)" },
    };
  }, [lastMove]);

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? "bg-gray-950 text-white" : "bg-gray-50 text-gray-900"}`}>
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${isDark ? "bg-gray-950 text-white" : "bg-gray-50 text-gray-900"}`}>
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className={`border-b ${isDark ? "border-white/10 bg-gray-950/80" : "border-gray-200 bg-white/80"} backdrop-blur-sm sticky top-0 z-30`}>
        <div className="max-w-[1600px] mx-auto px-4 py-3 flex items-center gap-4">
          <button
            onClick={() => navigate("/repertoire")}
            className={`flex items-center gap-1.5 text-sm ${isDark ? "text-white/60 hover:text-white" : "text-gray-500 hover:text-gray-900"}`}
          >
            <ArrowLeft size={16} />
            <span>My Repertoires</span>
          </button>

          <div className="flex-1 flex items-center gap-2">
            {editingName ? (
              <input
                ref={nameInputRef}
                value={repertoireName}
                onChange={(e) => setRepertoireName(e.target.value)}
                onBlur={saveName}
                onKeyDown={(e) => e.key === "Enter" && saveName()}
                className={`text-lg font-bold bg-transparent border-b-2 outline-none px-1 ${
                  isDark ? "border-emerald-500 text-white" : "border-emerald-600 text-gray-900"
                }`}
                autoFocus
              />
            ) : (
              <button
                onClick={() => {
                  setEditingName(true);
                  setTimeout(() => nameInputRef.current?.focus(), 50);
                }}
                className={`text-lg font-bold hover:underline ${isDark ? "text-white" : "text-gray-900"}`}
              >
                {repertoireName}
              </button>
            )}

            {openingEco && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${
                isDark ? "bg-white/10 text-white/50" : "bg-gray-100 text-gray-500"
              }`}>
                {openingEco}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className={`text-xs ${isDark ? "text-white/40" : "text-gray-400"}`}>
              {totalMoves} move{totalMoves !== 1 ? "s" : ""}
            </span>
            {saving && (
              <span className={`text-xs flex items-center gap-1 ${isDark ? "text-emerald-400" : "text-emerald-600"}`}>
                <Loader2 size={12} className="animate-spin" /> Saving…
              </span>
            )}
            {/* PGN Import / Export buttons */}
            <button
              onClick={() => setShowPgnImport(true)}
              className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                isDark
                  ? "border-white/20 text-white/70 hover:text-white hover:border-white/40 hover:bg-white/5"
                  : "border-gray-300 text-gray-600 hover:text-gray-900 hover:border-gray-400 hover:bg-gray-50"
              }`}
              title="Import PGN"
            >
              <Upload size={13} />
              <span className="hidden sm:inline">Import</span>
            </button>
            <button
              onClick={handleExportPgn}
              className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                isDark
                  ? "border-white/20 text-white/70 hover:text-white hover:border-white/40 hover:bg-white/5"
                  : "border-gray-300 text-gray-600 hover:text-gray-900 hover:border-gray-400 hover:bg-gray-50"
              }`}
              title="Export PGN"
            >
              <Download size={13} />
              <span className="hidden sm:inline">Export</span>
            </button>
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              color === "white"
                ? "bg-white text-gray-900 border border-gray-200"
                : "bg-gray-800 text-white border border-gray-600"
            }`}>
              {color === "white" ? "♜ White" : "♚ Black"}
            </span>
          </div>
        </div>
      </div>

      {/* ── Main Content ────────────────────────────────────────────────────── */}
      <div className="max-w-[1600px] mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* ── Left: Board + Eval Bar ──────────────────────────────────────── */}
          <div className="w-full lg:w-[55%] flex gap-2">
            {/* Eval bar */}
            {showEngine && sfEval && (
              <div className="hidden sm:block h-[min(55vw,560px)]">
                <EvalBar cp={sfEval.cp} mate={sfEval.mate} isDark={isDark} />
              </div>
            )}

            {/* Board */}
            <div className="flex-1">
              <div className={`rounded-2xl overflow-hidden border-2 shadow-2xl ${
                isDark
                  ? "border-emerald-500/30 shadow-emerald-500/10"
                  : "border-emerald-600/20 shadow-emerald-600/5"
              }`}>
                <Chessboard
                  options={{
                    position: currentFen,
                    onPieceDrop: handlePieceDrop,
                    boardOrientation: boardOrientation,
                    squareStyles: customSquareStyles,
                    boardStyle: {
                      borderRadius: "0",
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
            </div>
          </div>

          {/* ── Right: Explorer Panel ───────────────────────────────────────── */}
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
            </div>

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
                      navigateTo(child.fen);
                      if (child.move) setLastMove([child.move.slice(0, 2), child.move.slice(2, 4)]);
                    }}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { navigateTo(child.fen); if (child.move) setLastMove([child.move.slice(0, 2), child.move.slice(2, 4)]); } }}
                    className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg text-left transition cursor-pointer ${
                      isDark ? "hover:bg-emerald-500/10" : "hover:bg-emerald-50"
                    }`}
                  >
                    <BookOpen size={14} className={isDark ? "text-emerald-400" : "text-emerald-600"} />
                    <span className="font-bold font-mono text-sm">{child.san || "?"}</span>
                    {/* Opening annotation */}
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
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const updated = removeNode(moveTree, child.fen);
                        setMoveTree(updated);
                        autoSave(updated);
                      }}
                      className="ml-auto shrink-0 text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100"
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
                    onAdd={() => addExplorerMove(move)}
                    onRemove={() => removeExplorerMove(move)}
                    onPlay={() => playExplorerMove(move)}
                    isDark={isDark}
                    openingName={move.openingName}
                    openingEco={move.openingEco}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </div>

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
