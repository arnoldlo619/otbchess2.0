/**
 * StudyMode.tsx — Interactive opening line study experience.
 *
 * Layout: Board (left) + Explanation panel (right)
 * Modes: Learn (guided walkthrough) → Practice (play the moves) → Drill (timed recall)
 * Features:
 *   - Move-by-move guided learning with annotations
 *   - Hint system (progressive: first hint → full answer)
 *   - Line progress tracking with completion state
 *   - Next-line unlock flow
 *   - Strategic goal / punishment idea display
 */
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import { Chess } from "chess.js";
import { Chessboard, type PieceDropHandlerArgs } from "react-chessboard";
import { useTheme } from "@/contexts/ThemeContext";
import { OpeningsProGate } from "@/components/OpeningsProGate";
import {
  ArrowLeft, ArrowRight, BookOpen, CheckCircle2, ChevronLeft, FlipVertical2,
  Eye, HelpCircle, Heart, Lightbulb, Play, RefreshCw,
  SkipForward, Target, Trophy, X, Zap,
} from "lucide-react";

import { NavLogo } from "@/components/NavLogo";
import { useAuthContext } from "@/context/AuthContext";
import { authFetch } from "@/lib/apiFetch";
// ── Types ─────────────────────────────────────────────────────────────────────
interface LineNode {
  id: string;
  ply: number;
  moveSan: string | null;
  moveUci: string | null;
  fen: string;
  isMainLine: boolean;
  annotation: string | null;
  nag: number | null;
  eval: number | null;
}

interface LineData {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  difficulty: string;
  moveCount: number;
  mustKnow: boolean;
  trapLine: boolean;
  lineSummary: string | null;
  strategicGoal: string | null;
  commonMistake: string | null;
  punishmentIdea: string | null;
  hintText: string | null;
  branchLabel: string;
  lineType: string;
  nodes: LineNode[];
  opening: { name: string; slug: string; side: string };
  navigation?: { prev: { slug: string; title: string } | null; next: { slug: string; title: string } | null };
}

type StudyState = "learn" | "practice" | "drill";
type MoveResult = "correct" | "incorrect" | "hint" | null;

// ── Constants ─────────────────────────────────────────────────────────────────
const NAG_SYMBOLS: Record<number, string> = {
  1: "!", 2: "?", 3: "!!", 4: "??", 5: "!?", 6: "?!",
};

// NAG color helpers
const NAG_COLORS: Record<number, { text: string; bg: string }> = {
  1: { text: "text-emerald-400", bg: "bg-emerald-500/15" },   // !
  2: { text: "text-red-400", bg: "bg-red-500/15" },           // ?
  3: { text: "text-emerald-300", bg: "bg-emerald-500/20" },   // !!
  4: { text: "text-red-300", bg: "bg-red-500/20" },           // ??
  5: { text: "text-amber-400", bg: "bg-amber-500/15" },       // !?
  6: { text: "text-amber-400", bg: "bg-amber-500/15" },       // ?!
};

// ── Move List ─────────────────────────────────────────────────────────────────
function MoveList({
  nodes,
  currentPly,
  onJumpTo,
}: {
  nodes: LineNode[];
  currentPly: number;
  onJumpTo: (ply: number) => void;
}) {
  const { theme } = useTheme();
  const dk = theme === "dark";
  const listRef = useRef<HTMLDivElement>(null);
  const moveNodes = nodes.filter((n) => n.moveSan);

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-ply="${currentPly}"]`);
    if (el) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [currentPly]);

  // Group into move pairs
  const pairs: { moveNum: number; white?: LineNode; black?: LineNode }[] = [];
  for (const node of moveNodes) {
    const moveNum = Math.ceil(node.ply / 2);
    const isWhite = node.ply % 2 === 1;
    let pair = pairs.find((p) => p.moveNum === moveNum);
    if (!pair) {
      pair = { moveNum };
      pairs.push(pair);
    }
    if (isWhite) pair.white = node;
    else pair.black = node;
  }

  function moveClass(node: LineNode) {
    const isCurrent = currentPly === node.ply;
    const isPast = currentPly > node.ply;
    if (isCurrent) return "bg-emerald-500/20 text-emerald-400";
    if (isPast) return dk ? "text-white/60 hover:text-white/80" : "text-gray-600 hover:text-gray-900";
    return dk ? "text-white/20" : "text-gray-300";
  }

  function nagBadge(nag: number | null) {
    if (!nag || !NAG_SYMBOLS[nag]) return null;
    const c = NAG_COLORS[nag];
    return (
      <span className={`ml-0.5 text-[10px] font-bold ${c?.text ?? (dk ? "text-white/50" : "text-gray-500")}`}>
        {NAG_SYMBOLS[nag]}
      </span>
    );
  }

  return (
    <div ref={listRef} className="flex flex-wrap gap-x-1 gap-y-0.5 text-xs font-mono">
      {pairs.map((pair) => (
        <span key={pair.moveNum} className="inline-flex items-center">
          <span className={`mr-0.5 ${dk ? "text-white/25" : "text-gray-400"}`}>{pair.moveNum}.</span>
          {pair.white && (
            <button
              data-ply={pair.white.ply}
              onClick={() => onJumpTo(pair.white!.ply)}
              className={`px-1 py-0.5 rounded transition-colors ${moveClass(pair.white)}`}
            >
              {pair.white.moveSan}
              {nagBadge(pair.white.nag)}
            </button>
          )}
          {pair.black && (
            <button
              data-ply={pair.black.ply}
              onClick={() => onJumpTo(pair.black!.ply)}
              className={`px-1 py-0.5 rounded transition-colors ${moveClass(pair.black)}`}
            >
              {pair.black.moveSan}
              {nagBadge(pair.black.nag)}
            </button>
          )}
        </span>
      ))}
    </div>
  );
}

// ── Study Tab Button ──────────────────────────────────────────────────────────
function TabButton({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all min-h-[40px] ${
        active
          ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
          : "text-white/40 hover:text-white/60 border border-transparent"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
function StudyModeContent() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [, navigate] = useLocation();
  const [_match, params] = useRoute("/openings/:openingSlug/study/:lineSlug");

  const openingSlug = params?.openingSlug ?? "";
  const lineSlug = params?.lineSlug ?? "";

  // State
  const [lineData, setLineData] = useState<LineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [studyState, setStudyState] = useState<StudyState>("learn");
  const [currentPly, setCurrentPly] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [moveResult, setMoveResult] = useState<MoveResult>(null);
  const [incorrectCount, setIncorrectCount] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [practiceErrors, setPracticeErrors] = useState(0);
  const { user } = useAuthContext();
  const [isFavorited, setIsFavorited] = useState(false);

  // Chess engine for practice mode
  const [_game, setGame] = useState(new Chess());

  // Fetch line data
  useEffect(() => {
    if (!openingSlug || !lineSlug) return;
    async function fetchLine() {
      try {
        setLoading(true);
        const res = await authFetch(`/api/openings/${openingSlug}/lines/${lineSlug}`);
        if (!res.ok) throw new Error("Line not found");
        const data = await res.json();
        // API returns { opening, line, nodes, progress, navigation } as separate top-level fields.
        // Merge them into a single LineData object for the component.
        setLineData({
          ...data.line,
          // Map API field names to LineData field names
          lineSummary: data.line.strategicSummary ?? data.line.lineSummary ?? null,
          strategicGoal: data.line.strategicSummary ?? data.line.strategicGoal ?? null,
          commonMistake: data.line.commonMistake ?? null,
          branchLabel: data.line.branchLabel ?? data.line.lineType ?? "",
          // Merge top-level siblings into the object
          opening: data.opening ?? { name: "Unknown", slug: "", side: "white" },
          nodes: data.nodes ?? [],
          navigation: data.navigation ?? null,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load line");
      } finally {
        setLoading(false);
      }
    }
    fetchLine();
  }, [openingSlug, lineSlug]);

  // Fetch favorite status for this line
  useEffect(() => {
    if (!user || !lineData) return;
    async function checkFavorite() {
      try {
        const res = await authFetch("/api/favorites");
        if (!res.ok) return;
        const data = await res.json();
        const favLineIds = new Set<string>((data.favorites ?? []).map((f: { lineId: string }) => f.lineId));
        setIsFavorited(favLineIds.has(lineData!.id));
      } catch { /* ignore */ }
    }
    checkFavorite();
  }, [user, lineData]);

  async function handleToggleFavorite() {
    if (!user || !lineData) return;
    try {
      const res = await authFetch(`/api/favorites/${lineData.id}`, { method: "POST" });
      if (!res.ok) return;
      const data = await res.json();
      setIsFavorited(data.favorited);
    } catch { /* ignore */ }
  }

  // Derived
  const mainNodes = useMemo(
    () => (lineData?.nodes ?? []).filter((n) => n.isMainLine).sort((a, b) => a.ply - b.ply),
    [lineData]
  );
  const maxPly = mainNodes.length > 0 ? mainNodes[mainNodes.length - 1].ply : 0;
  const currentNode = mainNodes.find((n) => n.ply === currentPly) ?? mainNodes[0];
  const currentFen = currentNode?.fen ?? "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  const nextNode = mainNodes.find((n) => n.ply === currentPly + 1);
  const playerSide = lineData?.opening.side === "black" ? "black" : "white";
  const [boardFlipped, setBoardFlipped] = useState(false);
  const boardContainerRef = useRef<HTMLDivElement>(null);
  const isPlayerTurn = useMemo(() => {
    if (!currentFen) return false;
    const turn = currentFen.split(" ")[1];
    return (turn === "w" && playerSide === "white") || (turn === "b" && playerSide === "black");
  }, [currentFen, playerSide]);

  const progressPct = maxPly > 0 ? Math.round((currentPly / maxPly) * 100) : 0;

  // ── Learn Mode: step forward/backward ───────────────────────────────────
  const stepForward = useCallback(() => {
    if (currentPly >= maxPly) {
      setCompleted(true);
      return;
    }
    setCurrentPly((p) => Math.min(p + 1, maxPly));
    setShowHint(false);
    setMoveResult(null);
  }, [currentPly, maxPly]);

  const stepBackward = useCallback(() => {
    setCurrentPly((p) => Math.max(p - 1, 0));
    setShowHint(false);
    setMoveResult(null);
    setCompleted(false);
  }, []);

  const jumpTo = useCallback((ply: number) => {
    if (studyState === "learn") {
      setCurrentPly(Math.max(0, Math.min(ply, maxPly)));
      setShowHint(false);
      setMoveResult(null);
      setCompleted(ply >= maxPly);
    }
  }, [studyState, maxPly]);

  // ── Practice Mode: validate moves ───────────────────────────────────────
  const handlePieceDrop = useCallback(
    ({ sourceSquare, targetSquare, piece: _piece }: PieceDropHandlerArgs): boolean => {
      if (studyState === "learn") {
        // In learn mode, don't allow dragging
        return false;
      }

      if (!isPlayerTurn || !nextNode) return false;

      // Try the move
      if (!sourceSquare || !targetSquare) return false;
      const gameCopy = new Chess(currentFen);
      const move = gameCopy.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: "q",
      });

      if (!move) return false;

      // Check if correct
      const expectedUci = nextNode.moveUci;
      const playedUci = move.from + move.to + (move.promotion ?? "");

      if (playedUci === expectedUci || move.san === nextNode.moveSan) {
        // Correct!
        setMoveResult("correct");
        setCurrentPly((p) => p + 1);
        setShowHint(false);
        setIncorrectCount(0);

        // Auto-play opponent's response after a short delay
        setTimeout(() => {
          const opponentNode = mainNodes.find((n) => n.ply === currentPly + 2);
          if (opponentNode) {
            setCurrentPly((p) => p + 1);
            setMoveResult(null);
          } else {
            setCompleted(true);
          }
        }, 600);

        return true;
      } else {
        // Incorrect
        setMoveResult("incorrect");
        setIncorrectCount((c) => c + 1);
        setPracticeErrors((e) => e + 1);

        // Show hint after 2 wrong attempts
        if (incorrectCount >= 1) {
          setShowHint(true);
        }

        return false;
      }
    },
    [studyState, isPlayerTurn, nextNode, currentFen, mainNodes, currentPly, incorrectCount]
  );

  // ── Reset ───────────────────────────────────────────────────────────────
  const resetLine = useCallback(() => {
    setCurrentPly(0);
    setShowHint(false);
    setMoveResult(null);
    setIncorrectCount(0);
    setCompleted(false);
    setPracticeErrors(0);
    setGame(new Chess());
  }, []);

  const switchMode = useCallback(
    (mode: StudyState) => {
      setStudyState(mode);
      resetLine();
    },
    [resetLine]
  );

  // ── Keyboard shortcuts ──────────────────────────────────────────────────
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (studyState !== "learn") return;
      if (e.key === "ArrowRight") stepForward();
      if (e.key === "ArrowLeft") stepBackward();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [studyState, stepForward, stepBackward]);

  // ── Swipe gesture for move navigation on mobile (Learn mode) ───────────
  useEffect(() => {
    const el = boardContainerRef.current;
    if (!el) return;
    let startX = 0;
    let startY = 0;
    let tracking = false;
    function onTouchStart(e: TouchEvent) {
      if (studyState !== "learn") return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      tracking = true;
    }
    function onTouchEnd(e: TouchEvent) {
      if (!tracking) return;
      tracking = false;
      const dx = e.changedTouches[0].clientX - startX;
      const dy = e.changedTouches[0].clientY - startY;
      // Only trigger if horizontal swipe is dominant and > 40px
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        if (dx < 0) stepForward();  // swipe left → next move
        else stepBackward();         // swipe right → previous move
      }
    }
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [studyState, stepForward, stepBackward]);

  // ── Render ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? "bg-[#0a1a0e]" : "bg-gray-50"}`}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
          <span className={`text-sm ${isDark ? "text-white/40" : "text-gray-500"}`}>Loading study line...</span>
        </div>
      </div>
    );
  }

  if (error || !lineData) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? "bg-[#0a1a0e]" : "bg-gray-50"}`}>
        <div className="text-center space-y-3">
          <p className="text-sm text-red-400">{error ?? "Line not found"}</p>
          <button onClick={() => navigate(`/openings/${openingSlug}`)} className="text-xs text-emerald-400 hover:underline">
            Back to Opening
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0a1a0e]" : "bg-gray-50"}`}>
      {/* Header */}
      <div className={`border-b backdrop-blur-xl sticky top-0 z-30 ${isDark ? "border-white/[0.06] bg-[#0a1a0e]/80" : "border-gray-200/70 bg-white/90"}`}>
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="hidden sm:block shrink-0"><NavLogo /></div>
            <button
              onClick={() => navigate(`/openings/${openingSlug}`)}
              className={`shrink-0 p-2.5 rounded-lg transition-colors ${isDark ? "hover:bg-white/[0.05] text-white/40 hover:text-white/70" : "hover:bg-gray-100 text-gray-400 hover:text-gray-700"}`}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <p className={`text-[11px] truncate ${isDark ? "text-white/30" : "text-gray-400"}`}>{lineData.opening.name}</p>
              <h1 className={`text-sm font-semibold truncate ${isDark ? "text-white/90" : "text-gray-900"}`}>{lineData.title}</h1>
            </div>
          </div>

          {/* Mode tabs */}
          <div className="flex items-center gap-1">
            <TabButton
              label="Learn"
              icon={<BookOpen className="w-3.5 h-3.5" />}
              active={studyState === "learn"}
              onClick={() => switchMode("learn")}
            />
            <TabButton
              label="Practice"
              icon={<Target className="w-3.5 h-3.5" />}
              active={studyState === "practice"}
              onClick={() => switchMode("practice")}
            />
            <TabButton
              label="Drill"
              icon={<Zap className="w-3.5 h-3.5" />}
              active={studyState === "drill"}
              onClick={() => switchMode("drill")}
            />
          </div>

          {/* Favorite + Progress bar — desktop inline */}
          <div className="hidden sm:flex items-center gap-2">
            {user && (
              <button
                onClick={handleToggleFavorite}
                title={isFavorited ? "Remove from favorites" : "Save to favorites"}
                className={`p-2 rounded-lg transition-all ${
                  isFavorited
                    ? "text-rose-400 bg-rose-500/10 hover:bg-rose-500/20"
                    : isDark ? "text-white/25 hover:text-rose-400 hover:bg-rose-500/10" : "text-gray-300 hover:text-rose-400 hover:bg-rose-50"
                }`}
              >
                <Heart className={`w-4 h-4 ${isFavorited ? "fill-current" : ""}`} />
              </button>
            )}
          </div>
          <div className="hidden sm:flex items-center gap-2 w-32">
            <div className={`flex-1 h-1.5 rounded-full overflow-hidden ${isDark ? "bg-white/[0.06]" : "bg-gray-200"}`}>
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className={`text-[11px] font-mono w-8 text-right ${isDark ? "text-white/30" : "text-gray-400"}`}>{progressPct}%</span>
          </div>
        </div>
        {/* Progress bar — mobile full-width strip */}
        <div className={`sm:hidden h-0.5 ${isDark ? "bg-white/[0.06]" : "bg-gray-200"}`}>
          <div
            className="h-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* Left: Board — dominant element, fills ~55% on desktop */}
          <div className="w-full lg:w-[55%] shrink-0 space-y-3">
            <div
              ref={boardContainerRef}
              className={`rounded-2xl overflow-hidden border-2 shadow-2xl ${isDark ? "border-emerald-500/20 shadow-emerald-900/40" : "border-[#3D6B47]/20 shadow-gray-300/60"}`}
            >
              <Chessboard
                options={{
                  position: currentFen,
                  boardOrientation: boardFlipped ? (playerSide === "black" ? "white" : "black") : (playerSide === "black" ? "black" : "white"),
                  onPieceDrop: handlePieceDrop,
                  allowDragging: studyState !== "learn",
                  boardStyle: { borderRadius: "0" },
                  darkSquareStyle: { backgroundColor: isDark ? "#2d5a3a" : "#769656" },
                  lightSquareStyle: { backgroundColor: isDark ? "#8fbc8f" : "#eeeed2" },
                  animationDurationInMs: 200,
                }}
              />
            </div>

            {/* Board flip button */}
            <div className="flex justify-end">
              <button
                onClick={() => setBoardFlipped(f => !f)}
                title="Flip board"
                className={`p-2 rounded-lg transition-colors ${isDark ? "text-white/30 hover:text-white/60 hover:bg-white/[0.05]" : "text-gray-400 hover:text-gray-700 hover:bg-gray-100"}`}
              >
                <FlipVertical2 className="w-4 h-4" />
              </button>
            </div>
            {/* Board controls (Learn mode) */}
            {studyState === "learn" && (
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={() => setCurrentPly(0)}
                  className={`p-2 rounded-lg transition-colors ${isDark ? "text-white/30 hover:text-white/60 hover:bg-white/[0.05]" : "text-gray-400 hover:text-gray-700 hover:bg-gray-100"}`}
                >
                  <ArrowLeft className="w-4 h-4" />
                  <ArrowLeft className="w-4 h-4 -ml-3" />
                </button>
                <button
                  onClick={stepBackward}
                  disabled={currentPly === 0}
                  className={`p-2 rounded-lg transition-colors disabled:opacity-20 ${isDark ? "text-white/40 hover:text-white/70 hover:bg-white/[0.05]" : "text-gray-400 hover:text-gray-700 hover:bg-gray-100"}`}
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={stepForward}
                  disabled={completed}
                  className="px-4 py-2 rounded-lg bg-emerald-600/80 hover:bg-emerald-500 text-white text-sm font-medium transition-all disabled:opacity-30"
                >
                  {completed ? "Complete" : "Next"}
                </button>
                <button
                  onClick={stepForward}
                  disabled={completed}
                  className={`p-2 rounded-lg transition-colors disabled:opacity-20 ${isDark ? "text-white/40 hover:text-white/70 hover:bg-white/[0.05]" : "text-gray-400 hover:text-gray-700 hover:bg-gray-100"}`}
                >
                  <ArrowRight className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setCurrentPly(maxPly)}
                  className={`p-2 rounded-lg transition-colors ${isDark ? "text-white/30 hover:text-white/60 hover:bg-white/[0.05]" : "text-gray-400 hover:text-gray-700 hover:bg-gray-100"}`}
                >
                  <ArrowRight className="w-4 h-4" />
                  <ArrowRight className="w-4 h-4 -ml-3" />
                </button>
              </div>
            )}

            {/* Practice/Drill feedback */}
            {studyState !== "learn" && (
              <div className="flex items-center justify-center gap-3">
                {moveResult === "correct" && (
                  <div className="flex items-center gap-1.5 text-emerald-400 text-sm font-medium animate-pulse">
                    <CheckCircle2 className="w-4 h-4" /> Correct!
                  </div>
                )}
                {moveResult === "incorrect" && (
                  <div className="flex items-center gap-1.5 text-red-400 text-sm font-medium">
                    <X className="w-4 h-4" /> Try again
                  </div>
                )}
                {!moveResult && isPlayerTurn && !completed && (
                  <div className={`text-xs ${isDark ? "text-white/40" : "text-gray-500"}`}>
                    Your move — play the correct continuation
                  </div>
                )}
                {!moveResult && !isPlayerTurn && !completed && (
                  <div className={`text-xs ${isDark ? "text-white/30" : "text-gray-400"}`}>Opponent's turn...</div>
                )}
              </div>
            )}
          </div>

          {/* Right: Explanation panel — sticky on desktop */}
          <div className="flex-1 space-y-4 min-w-0 lg:sticky lg:top-24 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
            {/* Move list */}
            <div className={`p-3 rounded-xl max-h-48 overflow-y-auto ${isDark ? "bg-white/[0.02] border border-white/[0.04]" : "bg-gray-50 border border-gray-200/70"}`}>
              <MoveList nodes={mainNodes} currentPly={currentPly} onJumpTo={jumpTo} />
            </div>

            {/* Current annotation */}
            {currentNode?.annotation && studyState === "learn" && (
              <div className="p-4 rounded-xl bg-emerald-500/[0.05] border border-emerald-500/10">
                <div className="flex items-start gap-2">
                  <Lightbulb className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                  <p className={`text-sm leading-relaxed ${isDark ? "text-white/70" : "text-gray-700"}`}>{currentNode.annotation}</p>
                </div>
              </div>
            )}

            {/* Strategic info cards — Strategic Goal for moves 1-2, Punishment Idea for moves 3+ */}
            <div className="space-y-2">
              {/* Strategic Goal: only shown for the first two plies */}
              {lineData.strategicGoal && currentPly <= 2 && (
                <div className={`p-3 rounded-lg ${isDark ? "bg-white/[0.02] border border-white/[0.04]" : "bg-gray-50 border border-gray-200/70"}`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Target className="w-3.5 h-3.5 text-emerald-400" />
                    <span className={`text-[10px] uppercase tracking-wider font-medium ${isDark ? "text-white/40" : "text-gray-400"}`}>Strategic Goal</span>
                  </div>
                  <p className={`text-xs leading-relaxed ${isDark ? "text-white/60" : "text-gray-600"}`}>{lineData.strategicGoal}</p>
                </div>
              )}

              {/* Punishment Idea: shown once past the first two plies */}
              {lineData.punishmentIdea && currentPly > 2 && (
                <div className="p-3 rounded-lg bg-amber-500/[0.05] border border-amber-500/[0.10]">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    <span className={`text-[10px] uppercase tracking-wider font-medium ${isDark ? "text-amber-400/70" : "text-amber-600"}`}>Punishment Idea</span>
                  </div>
                  <p className={`text-sm leading-relaxed font-medium ${isDark ? "text-white/75" : "text-gray-700"}`}>{lineData.punishmentIdea}</p>
                </div>
              )}

              {lineData.commonMistake && (
                <div className="p-3 rounded-lg bg-red-500/[0.03] border border-red-500/[0.06]">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Eye className="w-3.5 h-3.5 text-red-400" />
                    <span className={`text-[10px] uppercase tracking-wider font-medium ${isDark ? "text-white/40" : "text-gray-400"}`}>Common Mistake</span>
                  </div>
                  <p className={`text-xs leading-relaxed ${isDark ? "text-white/60" : "text-gray-600"}`}>{lineData.commonMistake}</p>
                </div>
              )}
            </div>

            {/* Hint button (Practice/Drill) */}
            {studyState !== "learn" && !completed && isPlayerTurn && (
              <div className="space-y-2">
                {!showHint ? (
                  <button
                    onClick={() => setShowHint(true)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs transition-all ${isDark ? "text-white/40 hover:text-amber-400 bg-white/[0.02] border border-white/[0.04] hover:border-amber-500/20" : "text-gray-400 hover:text-amber-600 bg-gray-50 border border-gray-200/70 hover:border-amber-400/40"}`}
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                    Show Hint
                  </button>
                ) : (
                  <div className="p-3 rounded-lg bg-amber-500/[0.05] border border-amber-500/10">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-[10px] text-amber-400/80 uppercase tracking-wider font-medium">Hint</span>
                    </div>
                    <p className={`text-xs ${isDark ? "text-white/60" : "text-gray-600"}`}>
                      {lineData.hintText ?? (nextNode ? `The correct move is ${nextNode.moveSan}` : "Complete!")}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Completion state */}
            {completed && (
              <div className="p-6 rounded-xl bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border border-emerald-500/20 text-center space-y-4">
                <Trophy className="w-10 h-10 text-amber-400 mx-auto" />
                <div>
                  <h3 className={`text-lg font-bold ${isDark ? "text-white/90" : "text-gray-900"}`}>Line Complete!</h3>
                  <p className={`text-xs mt-1 ${isDark ? "text-white/40" : "text-gray-500"}`}>
                    {studyState === "learn"
                      ? "You've reviewed all moves in this line"
                      : practiceErrors === 0
                      ? "Perfect — no mistakes!"
                      : `Completed with ${practiceErrors} ${practiceErrors === 1 ? "mistake" : "mistakes"}`}
                  </p>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={resetLine}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all ${isDark ? "text-white/60 bg-white/[0.04] border border-white/[0.06] hover:border-white/10" : "text-gray-600 bg-gray-100 border border-gray-200 hover:border-gray-300"}`}
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Retry
                  </button>
                  {studyState === "learn" && (
                    <button
                      onClick={() => switchMode("practice")}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-500 transition-all"
                    >
                      <Play className="w-3.5 h-3.5" />
                      Practice This Line
                    </button>
                  )}
                  <button
                    onClick={() => navigate(`/openings/${openingSlug}`)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium text-white/60 bg-white/[0.04] border border-white/[0.06] hover:border-white/10 transition-all"
                  >
                    <SkipForward className="w-3.5 h-3.5" />
                    Next Line
                  </button>
                </div>
              </div>
            )}



            {/* Keyboard shortcuts hint (Learn mode) */}
            {studyState === "learn" && (
              <div className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border text-center ${
                isDark ? "bg-white/[0.03] border-white/[0.06] text-white/50" : "bg-gray-50 border-gray-200 text-gray-500"
              }`}>
                <kbd className={`px-2 py-1 rounded-lg text-xs font-mono font-semibold ${
                  isDark ? "bg-white/[0.08] text-white/60 border border-white/10" : "bg-white text-gray-600 border border-gray-300 shadow-sm"
                }`}>←</kbd>
                <span className="text-xs font-medium">arrow keys to navigate</span>
                <kbd className={`px-2 py-1 rounded-lg text-xs font-mono font-semibold ${
                  isDark ? "bg-white/[0.08] text-white/60 border border-white/10" : "bg-white text-gray-600 border border-gray-300 shadow-sm"
                }`}>→</kbd>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function StudyMode() {
  return (
    <OpeningsProGate>
      <StudyModeContent />
    </OpeningsProGate>
  );
}
