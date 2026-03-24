/**
 * useNotationMode
 *
 * Core hook for Live Notation Mode (LNM). Wraps chess.js to provide:
 * - Legal move validation
 * - PGN generation
 * - Turn tracking (orientation derived from turn)
 * - "inputting" state for clock auto-pause (Option B)
 * - 10-second input timeout to prevent pause abuse
 * - Undo with two-tap confirmation
 * - Promotion handling (auto-Queen with override)
 * - Terminal position detection (checkmate, stalemate, draw)
 * - sessionStorage recovery for interrupted games
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { Chess, type Square } from "chess.js";

// ─── Constants ───────────────────────────────────────────────────────────────

/** Max time (ms) a source square can stay selected before auto-cancel */
export const LNM_INPUT_TIMEOUT_MS = 10_000;

/** sessionStorage key prefix for crash recovery */
const SESSION_KEY_PREFIX = "otb_lnm_pgn_";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface NotationMove {
  san: string;
  color: "w" | "b";
  fen: string;
  from: string;
  to: string;
}

export interface UseNotationModeReturn {
  /** Jump to a specific move index to correct from that point (0-based, -1 = start) */
  jumpToMove: (index: number) => void;
  /** Pending jump index: which move the user tapped to correct (-1 = none selected) */
  pendingJump: number;
  /** Confirm the pending jump — truncates history and resumes from that position */
  confirmJump: () => void;
  /** Cancel the pending jump without changing the game */
  cancelJump: () => void;
  /** Whether LNM is currently active */
  active: boolean;
  /** Toggle LNM on/off */
  toggle: () => void;
  /** Activate LNM */
  activate: () => void;
  /** Deactivate LNM and return final PGN (or null if no moves) */
  deactivate: () => string | null;
  /** Current FEN position */
  fen: string;
  /** Whose turn it is: "w" | "b" */
  turn: "w" | "b";
  /** Board orientation: "white" when it's White's turn, "black" when Black's */
  orientation: "white" | "black";
  /** All moves played so far */
  moves: NotationMove[];
  /** Full PGN string */
  pgn: string;
  /** Currently selected source square (null if none) */
  selectedSquare: Square | null;
  /** Whether a source square is selected (clock should pause) */
  inputting: boolean;
  /** Legal destination squares for the selected piece */
  legalDestinations: Square[];
  /** Select a source square (first tap) */
  selectSquare: (square: Square) => void;
  /** Attempt a move from selected square to destination */
  moveToSquare: (to: Square, promotion?: "q" | "r" | "b" | "n") => boolean;
  /** Cancel current selection */
  cancelSelection: () => void;
  /** Undo the last move (returns true if successful) */
  undoMove: () => boolean;
  /** Reset to starting position */
  reset: () => void;
  /** Whether the game is over (checkmate, stalemate, draw) */
  isGameOver: boolean;
  /** Game-over reason if applicable */
  gameOverReason: string | null;
  /** Whether the last move attempt was illegal (for shake animation) */
  illegalAttempt: boolean;
  /** Clear the illegal attempt flag */
  clearIllegalAttempt: () => void;
  /** Whether a promotion choice is needed */
  pendingPromotion: { from: Square; to: Square } | null;
  /** Confirm promotion with chosen piece */
  confirmPromotion: (piece: "q" | "r" | "b" | "n") => void;
  /** Cancel pending promotion */
  cancelPromotion: () => void;
  /** The last move (for highlight) */
  lastMove: { from: string; to: string } | null;
  /** Move number (full moves completed) */
  moveCount: number;
  /** Opening name (from ECO lookup, if available) */
  openingName: string | null;
}

// ─── ECO Opening Lookup (common openings) ────────────────────────────────────

const ECO_OPENINGS: { fen: string; name: string }[] = [
  { fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR", name: "King's Pawn Opening" },
  { fen: "rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR", name: "Queen's Pawn Opening" },
  { fen: "rnbqkbnr/pppppppp/8/8/2P5/8/PP1PPPPP/RNBQKBNR", name: "English Opening" },
  { fen: "rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R", name: "Réti Opening" },
  { fen: "rnbqkbnr/pppp1ppp/4p3/8/4P3/8/PPPP1PPP/RNBQKBNR", name: "French Defence" },
  { fen: "rnbqkbnr/pp1ppppp/2p5/8/4P3/8/PPPP1PPP/RNBQKBNR", name: "Caro-Kann Defence" },
  { fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR", name: "Open Game" },
  { fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R", name: "King's Knight Opening" },
  { fen: "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R", name: "Italian / Spanish" },
  { fen: "rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR", name: "Sicilian Defence" },
  { fen: "rnbqkbnr/pppp1ppp/4p3/8/3PP3/8/PPP2PPP/RNBQKBNR", name: "French Defence" },
  { fen: "rnbqkb1r/pppppppp/5n2/8/3P4/8/PPP1PPPP/RNBQKBNR", name: "Indian Defence" },
  { fen: "rnbqkb1r/pppppppp/5n2/8/2PP4/8/PP2PPPP/RNBQKBNR", name: "Indian Game" },
  { fen: "rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR", name: "Queen's Pawn Game" },
  { fen: "rnbqkbnr/ppp1pppp/8/3p4/2PP4/8/PP2PPPP/RNBQKBNR", name: "Queen's Gambit" },
];

function lookupOpening(moves: NotationMove[]): string | null {
  // Walk backwards through moves to find the deepest matching opening
  for (let i = moves.length - 1; i >= 0; i--) {
    const fenPrefix = moves[i].fen.split(" ")[0]; // position part only
    const match = ECO_OPENINGS.find((o) => o.fen === fenPrefix);
    if (match) return match.name;
  }
  return null;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useNotationMode(battleCode: string): UseNotationModeReturn {
  const sessionKey = SESSION_KEY_PREFIX + battleCode;

  // chess.js instance (mutable ref — never triggers re-render directly)
  const chessRef = useRef(new Chess());

  const [active, setActive] = useState(false);
  const [fen, setFen] = useState(chessRef.current.fen());
  const [moves, setMoves] = useState<NotationMove[]>([]);
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [legalDestinations, setLegalDestinations] = useState<Square[]>([]);
  const [illegalAttempt, setIllegalAttempt] = useState(false);
  const [pendingPromotion, setPendingPromotion] = useState<{ from: Square; to: Square } | null>(null);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);

  // 10s input timeout ref
  const inputTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Derived state ──────────────────────────────────────────────────────────
  const turn = chessRef.current.turn();
  const orientation: "white" | "black" = turn === "w" ? "white" : "black";
  const isGameOver = chessRef.current.isGameOver();
  const inputting = selectedSquare !== null || pendingPromotion !== null;
  const pgn = chessRef.current.pgn();
  const moveCount = Math.floor(moves.length / 2);

  const gameOverReason = (() => {
    const c = chessRef.current;
    if (c.isCheckmate()) return `Checkmate — ${c.turn() === "w" ? "Black" : "White"} wins`;
    if (c.isStalemate()) return "Stalemate — Draw";
    if (c.isDraw()) return "Draw";
    if (c.isThreefoldRepetition()) return "Threefold Repetition — Draw";
    if (c.isInsufficientMaterial()) return "Insufficient Material — Draw";
    return null;
  })();

  const openingName = lookupOpening(moves);

  // ── Sync FEN + moves from chess.js ─────────────────────────────────────────
  const syncState = useCallback(() => {
    const c = chessRef.current;
    setFen(c.fen());
    const history = c.history({ verbose: true });
    setMoves(
      history.map((m) => ({
        san: m.san,
        color: m.color,
        fen: m.after.split(" ")[0], // position part
        from: m.from,
        to: m.to,
      }))
    );
    const last = history[history.length - 1];
    setLastMove(last ? { from: last.from, to: last.to } : null);
  }, []);

  // ── Input timeout: auto-cancel selection after 10s ─────────────────────────
  useEffect(() => {
    if (selectedSquare) {
      inputTimeoutRef.current = setTimeout(() => {
        setSelectedSquare(null);
        setLegalDestinations([]);
      }, LNM_INPUT_TIMEOUT_MS);
    }
    return () => {
      if (inputTimeoutRef.current) clearTimeout(inputTimeoutRef.current);
    };
  }, [selectedSquare]);

  // ── Session recovery on mount ──────────────────────────────────────────────
  useEffect(() => {
    const saved = sessionStorage.getItem(sessionKey);
    if (saved) {
      try {
        const c = new Chess();
        c.loadPgn(saved);
        chessRef.current = c;
        syncState();
        setActive(true);
      } catch {
        sessionStorage.removeItem(sessionKey);
      }
    }
  }, [sessionKey, syncState]);

  // ── Persist PGN to sessionStorage on every move ────────────────────────────
  useEffect(() => {
    if (active && moves.length > 0) {
      sessionStorage.setItem(sessionKey, chessRef.current.pgn());
    }
  }, [active, moves, sessionKey]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const activate = useCallback(() => {
    setActive(true);
  }, []);

  const deactivate = useCallback((): string | null => {
    const p = moves.length > 0 ? chessRef.current.pgn() : null;
    setActive(false);
    setSelectedSquare(null);
    setLegalDestinations([]);
    setPendingPromotion(null);
    sessionStorage.removeItem(sessionKey);
    return p;
  }, [moves.length, sessionKey]);

  const toggle = useCallback(() => {
    if (active) {
      deactivate();
    } else {
      activate();
    }
  }, [active, activate, deactivate]);

  const selectSquare = useCallback(
    (square: Square) => {
      if (!active || isGameOver) return;
      setIllegalAttempt(false);

      const c = chessRef.current;
      const piece = c.get(square);

      // If a piece of the current turn's color is on this square, select it
      if (piece && piece.color === c.turn()) {
        const legalMoves = c.moves({ square, verbose: true });
        setSelectedSquare(square);
        setLegalDestinations(legalMoves.map((m) => m.to as Square));
        return;
      }

      // If we already have a selection and this is a destination, try the move
      if (selectedSquare) {
        moveToSquare(square);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [active, isGameOver, selectedSquare]
  );

  const moveToSquare = useCallback(
    (to: Square, promotion?: "q" | "r" | "b" | "n"): boolean => {
      if (!active || !selectedSquare || isGameOver) return false;

      const c = chessRef.current;
      const from = selectedSquare;

      // Check if this is a promotion move
      const piece = c.get(from);
      if (
        piece?.type === "p" &&
        ((piece.color === "w" && to[1] === "8") || (piece.color === "b" && to[1] === "1"))
      ) {
        if (!promotion) {
          // Show promotion picker
          setPendingPromotion({ from, to });
          return false;
        }
      }

      try {
        c.move({ from, to, promotion: promotion ?? "q" });
        syncState();
        setSelectedSquare(null);
        setLegalDestinations([]);
        setPendingPromotion(null);
        setIllegalAttempt(false);
        return true;
      } catch {
        // Illegal move
        setIllegalAttempt(true);
        setSelectedSquare(null);
        setLegalDestinations([]);
        return false;
      }
    },
    [active, selectedSquare, isGameOver, syncState]
  );

  const cancelSelection = useCallback(() => {
    setSelectedSquare(null);
    setLegalDestinations([]);
    setPendingPromotion(null);
  }, []);

  const confirmPromotion = useCallback(
    (piece: "q" | "r" | "b" | "n") => {
      if (!pendingPromotion) return;
      const { from, to } = pendingPromotion;
      setSelectedSquare(from);
      moveToSquare(to, piece);
    },
    [pendingPromotion, moveToSquare]
  );

  const cancelPromotion = useCallback(() => {
    setPendingPromotion(null);
    setSelectedSquare(null);
    setLegalDestinations([]);
  }, []);

  const undoMove = useCallback((): boolean => {
    const c = chessRef.current;
    const result = c.undo();
    if (result) {
      syncState();
      setSelectedSquare(null);
      setLegalDestinations([]);
      return true;
    }
    return false;
  }, [syncState]);

  const reset = useCallback(() => {
    chessRef.current = new Chess();
    syncState();
    setSelectedSquare(null);
    setLegalDestinations([]);
    setPendingPromotion(null);
    setIllegalAttempt(false);
    sessionStorage.removeItem(sessionKey);
  }, [syncState, sessionKey]);

  const clearIllegalAttempt = useCallback(() => {
    setIllegalAttempt(false);
  }, []);

  // ── Jump-to-move (mid-game correction) ────────────────────────────────────
  const [pendingJump, setPendingJump] = useState<number>(-1);

  /**
   * Tap a move in the list to stage a correction. The user must then confirm
   * (or cancel) before the history is actually truncated.
   * @param index 0-based move index to jump back to (-1 = before move 1)
   */
  const jumpToMove = useCallback((index: number) => {
    // Don't allow jumping to the last move (nothing to correct)
    if (index >= moves.length - 1) return;
    setPendingJump(index);
    // Cancel any in-progress selection
    setSelectedSquare(null);
    setLegalDestinations([]);
    setPendingPromotion(null);
  }, [moves.length]);

  /**
   * Confirm the pending jump: replay moves[0..pendingJump] on a fresh Chess
   * instance, then update all state.
   */
  const confirmJump = useCallback(() => {
    if (pendingJump < -1) return;
    const targetMoves = moves.slice(0, pendingJump + 1);
    const c = new Chess();
    for (const m of targetMoves) {
      try {
        c.move(m.san);
      } catch {
        // If a SAN fails (shouldn't happen), stop replaying
        break;
      }
    }
    chessRef.current = c;
    syncState();
    setSelectedSquare(null);
    setLegalDestinations([]);
    setPendingPromotion(null);
    setPendingJump(-1);
    setIllegalAttempt(false);
  }, [pendingJump, moves, syncState]);

  const cancelJump = useCallback(() => {
    setPendingJump(-1);
  }, []);

  return {
    active,
    toggle,
    activate,
    deactivate,
    fen,
    turn,
    orientation,
    moves,
    pgn,
    selectedSquare,
    inputting,
    legalDestinations,
    selectSquare,
    moveToSquare,
    cancelSelection,
    undoMove,
    reset,
    isGameOver,
    gameOverReason,
    illegalAttempt,
    clearIllegalAttempt,
    pendingPromotion,
    confirmPromotion,
    cancelPromotion,
    lastMove,
    moveCount,
    openingName,
    jumpToMove,
    pendingJump,
    confirmJump,
    cancelJump,
  };
}
