/**
 * ChessPracticeBoard — Chessable-style SRS quiz mode for the Practice tab.
 *
 * Spaced Repetition Model:
 * - Lines are queued in order; each line is presented move-by-move
 * - The computer plays the opponent's moves automatically (after a short delay)
 * - The user must find the correct move by clicking a piece then clicking a square
 * - Correct move → green flash + advance; Wrong move → red flash + hint shown
 * - After completing a line: score recorded (correct / total moves attempted)
 * - SRS intervals: Correct = +1 day interval; Wrong = reset to 1 day
 * - Progress bar tracks session completion
 * - "Well done!" summary card when all lines are reviewed
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Chessboard, type PieceDropHandlerArgs } from "react-chessboard";
import { Chess, type Square } from "chess.js";
import {
  CheckCircle,
  XCircle,
  RotateCcw,
  ChevronRight,
  Brain,
  Zap,
  Trophy,
  BookOpen as _BookOpen,
  ArrowRight,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface PracticeLine {
  id: string;
  name: string;
  moves: string; // PGN/SAN string
  eco?: string;
  rationale?: string;
}

interface LineResult {
  lineId: string;
  correct: number;
  total: number;
  passed: boolean;
}

interface ChessPracticeBoardProps {
  lines: PracticeLine[];
  isDark: boolean;
  /** Called when the session is complete */
  onSessionComplete?: (results: LineResult[]) => void;
  /** If set, start practice on this line index instead of 0 */
  initialLineIndex?: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function parseSanMoves(pgn: string): string[] {
  return pgn
    .replace(/\d+\./g, "")
    .split(/\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !/^\d+$/.test(s));
}

type FeedbackState = "idle" | "correct" | "wrong" | "hint" | "auto";

// ── Component ─────────────────────────────────────────────────────────────────
export default function ChessPracticeBoard({
  lines,
  isDark,
  onSessionComplete,
  initialLineIndex,
}: ChessPracticeBoardProps) {
  // Session state
  const [lineIndex, setLineIndex] = useState(initialLineIndex ?? 0);
  const [sessionResults, setSessionResults] = useState<LineResult[]>([]);
  const [sessionComplete, setSessionComplete] = useState(false);

  // Current line state
  const [chess] = useState(() => new Chess());
  const [fen, setFen] = useState("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
  const [sanMoves, setSanMoves] = useState<string[]>([]);
  const [moveIndex, setMoveIndex] = useState(0); // which move in the line we're at
  const [userColor, setUserColor] = useState<"w" | "b">("w"); // user plays White by default
  const [feedback, setFeedback] = useState<FeedbackState>("idle");
  const [correctMoves, setCorrectMoves] = useState(0);
  const [totalAttempts, setTotalAttempts] = useState(0);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [legalMoveSquares, setLegalMoveSquares] = useState<Record<string, React.CSSProperties>>({});
  const [lastMoveSquares, setLastMoveSquares] = useState<Record<string, React.CSSProperties>>({});
  const [hintSquares, setHintSquares] = useState<Record<string, React.CSSProperties>>({});
  const [lineComplete, setLineComplete] = useState(false);
  const [linePassed, setLinePassed] = useState(false);

  const autoMoveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentLine = lines[lineIndex];

  // Design tokens
  const bg = isDark ? "bg-[#0f1c11]" : "bg-white";
  const border = isDark ? "border-[#1e2e22]/70" : "border-gray-200/80";
  const textPrimary = isDark ? "text-white" : "text-gray-900";
  const textSecondary = isDark ? "text-white/55" : "text-gray-500";
  const textTertiary = isDark ? "text-white/30" : "text-gray-400";
  const accentText = isDark ? "text-[#5B9A6A]" : "text-[#3D6B47]";
  const _accentBg = isDark ? "bg-[#3D6B47]/20 text-[#5B9A6A]" : "bg-[#3D6B47]/10 text-[#3D6B47]";

  // ── Initialize / reset for a line ──────────────────────────────────────────
  const initLine = useCallback(
    (idx: number) => {
      if (idx >= lines.length) return;
      const line = lines[idx];
      const moves = parseSanMoves(line.moves);
      chess.reset();
      setSanMoves(moves);
      setMoveIndex(0);
      setFen(chess.fen());
      setFeedback("idle");
      setCorrectMoves(0);
      setTotalAttempts(0);
      setSelectedSquare(null);
      setLegalMoveSquares({});
      setLastMoveSquares({});
      setHintSquares({});
      setLineComplete(false);
      setLinePassed(false);
      // User always plays White in this implementation (can be extended)
      setUserColor("w");
    },
    [chess, lines]
  );

  useEffect(() => {
    if (lines.length > 0) initLine(initialLineIndex ?? 0);
    setLineIndex(initialLineIndex ?? 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines]);

  // Jump to a specific line when initialLineIndex changes externally
  useEffect(() => {
    if (initialLineIndex != null && initialLineIndex !== lineIndex && initialLineIndex < lines.length) {
      setLineIndex(initialLineIndex);
      initLine(initialLineIndex);
      setSessionResults([]);
      setSessionComplete(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialLineIndex]);

  // ── Determine if it's the user's turn ──────────────────────────────────────
  const isUserTurn = useCallback(() => {
    return chess.turn() === userColor;
  }, [chess, userColor]);

  // ── Play the opponent's move automatically ─────────────────────────────────
  const playAutoMove = useCallback(
    (currentMoveIndex: number) => {
      if (currentMoveIndex >= sanMoves.length) return;
      const san = sanMoves[currentMoveIndex];
      setFeedback("auto");
      autoMoveTimerRef.current = setTimeout(() => {
        try {
          const move = chess.move(san);
          if (move) {
            setLastMoveSquares({
              [move.from]: { background: isDark ? "rgba(93,180,107,0.25)" : "rgba(61,107,71,0.18)" },
              [move.to]: { background: isDark ? "rgba(93,180,107,0.4)" : "rgba(61,107,71,0.3)" },
            });
            setFen(chess.fen());
            setMoveIndex(currentMoveIndex + 1);
            setFeedback("idle");
            setHintSquares({});
          }
        } catch {
          // invalid move — end line
          setLineComplete(true);
        }
      }, 600);
    },
    [chess, sanMoves, isDark]
  );

  // After moveIndex changes, check if it's the opponent's turn
  useEffect(() => {
    if (lineComplete || feedback === "auto") return;
    if (moveIndex >= sanMoves.length) {
      // Line complete
      const passed = correctMoves >= Math.ceil(sanMoves.filter((_, i) => i % 2 === (userColor === "w" ? 0 : 1)).length * 0.7);
      setLinePassed(passed);
      setLineComplete(true);
      return;
    }
    if (!isUserTurn()) {
      // Opponent's turn — auto play
      playAutoMove(moveIndex);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moveIndex, sanMoves.length, lineComplete]);

  // ── Handle square click ────────────────────────────────────────────────────
  const handleSquareClick = useCallback(
    (square: string) => {
      if (!isUserTurn() || lineComplete || feedback === "auto") return;

      // If a piece is already selected, try to move
      if (selectedSquare) {
        const expectedSan = sanMoves[moveIndex];
        if (!expectedSan) return;

        // Try the move
        try {
          const move = chess.move({ from: selectedSquare, to: square, promotion: "q" });
          if (move) {
            const isCorrect = move.san === expectedSan || move.from + move.to === expectedSan.replace(/[^a-h1-8]/g, "");
            setTotalAttempts((t) => t + 1);
            if (isCorrect) {
              setCorrectMoves((c) => c + 1);
              setFeedback("correct");
              setLastMoveSquares({
                [move.from]: { background: isDark ? "rgba(93,180,107,0.35)" : "rgba(61,107,71,0.25)" },
                [move.to]: { background: isDark ? "rgba(93,180,107,0.55)" : "rgba(61,107,71,0.45)" },
              });
              setHintSquares({});
              setSelectedSquare(null);
              setLegalMoveSquares({});
              setFen(chess.fen());
              const nextIdx = moveIndex + 1;
              setMoveIndex(nextIdx);
              setTimeout(() => setFeedback("idle"), 500);
            } else {
              // Wrong move — undo it
              chess.undo();
              setFeedback("wrong");
              setTotalAttempts((t) => t + 1);
              setTimeout(() => setFeedback("idle"), 800);
            }
          } else {
            // Illegal move — deselect
            setSelectedSquare(null);
            setLegalMoveSquares({});
          }
        } catch {
          setSelectedSquare(null);
          setLegalMoveSquares({});
        }
        return;
      }

      // Select a piece
      const piece = chess.get(square as Square);
      if (piece && piece.color === userColor) {
        setSelectedSquare(square);
        // Show legal moves
        const moves = chess.moves({ square: square as Square, verbose: true });
        const highlights: Record<string, React.CSSProperties> = {
          [square]: { background: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.08)" },
        };
        moves.forEach((m) => {
          highlights[m.to] = {
            background: isDark
              ? "radial-gradient(circle, rgba(93,180,107,0.5) 25%, transparent 25%)"
              : "radial-gradient(circle, rgba(61,107,71,0.4) 25%, transparent 25%)",
          };
        });
        setLegalMoveSquares(highlights);
      }
    },
    [chess, selectedSquare, moveIndex, sanMoves, isUserTurn, lineComplete, feedback, userColor, isDark]
  );

  // ── Handle piece drop (drag-and-drop) ───────────────────────────────────────
  const handlePieceDrop = useCallback(
    ({ sourceSquare, targetSquare }: PieceDropHandlerArgs) => {
      if (!isUserTurn() || lineComplete || feedback === "auto") return false;
      if (!targetSquare) return false;
      const expectedSan = sanMoves[moveIndex];
      if (!expectedSan) return false;

      try {
        const move = chess.move({ from: sourceSquare, to: targetSquare, promotion: "q" });
        if (move) {
          const isCorrect = move.san === expectedSan || move.from + move.to === expectedSan.replace(/[^a-h1-8]/g, "");
          setTotalAttempts((t) => t + 1);
          if (isCorrect) {
            setCorrectMoves((c) => c + 1);
            setFeedback("correct");
            setLastMoveSquares({
              [move.from]: { background: isDark ? "rgba(93,180,107,0.35)" : "rgba(61,107,71,0.25)" },
              [move.to]: { background: isDark ? "rgba(93,180,107,0.55)" : "rgba(61,107,71,0.45)" },
            });
            setHintSquares({});
            setSelectedSquare(null);
            setLegalMoveSquares({});
            setFen(chess.fen());
            const nextIdx = moveIndex + 1;
            setMoveIndex(nextIdx);
            setTimeout(() => setFeedback("idle"), 500);
            return true;
          } else {
            // Wrong move — undo it
            chess.undo();
            setFeedback("wrong");
            setTimeout(() => setFeedback("idle"), 800);
            return false;
          }
        }
        return false;
      } catch {
        return false;
      }
    },
    [chess, moveIndex, sanMoves, isUserTurn, lineComplete, feedback, isDark]
  );

  // ── Show hint ──────────────────────────────────────────────────────────────
  const showHint = useCallback(() => {
    const expectedSan = sanMoves[moveIndex];
    if (!expectedSan) return;
    try {
      const moves = chess.moves({ verbose: true });
      const target = moves.find((m) => m.san === expectedSan);
      if (target) {
        setHintSquares({
          [target.from]: { background: isDark ? "rgba(255,200,50,0.4)" : "rgba(200,150,0,0.3)" },
          [target.to]: { background: isDark ? "rgba(255,200,50,0.6)" : "rgba(200,150,0,0.5)" },
        });
        setFeedback("hint");
        setTimeout(() => {
          setHintSquares({});
          setFeedback("idle");
        }, 2000);
      }
    } catch {
      // ignore
    }
  }, [chess, moveIndex, sanMoves, isDark]);

  // ── Advance to next line ───────────────────────────────────────────────────
  const nextLine = useCallback(() => {
    const result: LineResult = {
      lineId: currentLine.id,
      correct: correctMoves,
      total: totalAttempts,
      passed: linePassed,
    };
    const newResults = [...sessionResults, result];
    setSessionResults(newResults);

    const nextIdx = lineIndex + 1;
    if (nextIdx >= lines.length) {
      setSessionComplete(true);
      onSessionComplete?.(newResults);
    } else {
      setLineIndex(nextIdx);
      initLine(nextIdx);
    }
  }, [currentLine, correctMoves, totalAttempts, linePassed, sessionResults, lineIndex, lines.length, onSessionComplete, initLine]);

  // ── Restart session ────────────────────────────────────────────────────────
  const restartSession = useCallback(() => {
    setLineIndex(0);
    setSessionResults([]);
    setSessionComplete(false);
    initLine(0);
  }, [initLine]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (autoMoveTimerRef.current) clearTimeout(autoMoveTimerRef.current);
    };
  }, []);

  if (lines.length === 0) {
    return (
      <div className={`rounded-2xl border p-8 text-center ${bg} ${border}`}>
        <Brain className={`w-10 h-10 mx-auto mb-3 ${accentText}`} />
        <p className={`text-sm ${textSecondary}`}>No lines available for practice.</p>
      </div>
    );
  }

  // ── Session complete screen ────────────────────────────────────────────────
  if (sessionComplete) {
    const totalPassed = sessionResults.filter((r) => r.passed).length;
    const totalLines = sessionResults.length;
    const pct = Math.round((totalPassed / totalLines) * 100);

    return (
      <div className={`rounded-2xl border overflow-hidden ${bg} ${border}`}>
        <div className="p-8 text-center">
          <Trophy className={`w-12 h-12 mx-auto mb-4 ${pct >= 70 ? "text-yellow-400" : accentText}`} />
          <h3 className={`text-xl font-bold mb-1 ${textPrimary}`} style={{ fontFamily: "'Clash Display', sans-serif" }}>
            Session Complete!
          </h3>
          <p className={`text-sm mb-6 ${textSecondary}`}>
            You passed {totalPassed} of {totalLines} lines ({pct}%)
          </p>

          {/* Results list */}
          <div className="space-y-2 mb-6 text-left max-w-sm mx-auto">
            {sessionResults.map((r, i) => (
              <div key={r.lineId} className={`flex items-center gap-3 p-2.5 rounded-xl border ${border}`}>
                {r.passed ? (
                  <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                )}
                <span className={`text-xs flex-1 truncate ${textPrimary}`}>{lines[i]?.name ?? r.lineId}</span>
                <span className={`text-[10px] font-mono ${textTertiary}`}>
                  {r.correct}/{r.total}
                </span>
              </div>
            ))}
          </div>

          <button
            onClick={restartSession}
            className="flex items-center gap-2 mx-auto px-5 py-2.5 rounded-xl bg-[#3D6B47] hover:bg-[#4a7d56] text-white text-sm font-semibold transition-all"
          >
            <RotateCcw className="w-4 h-4" />
            Practice Again
          </button>
        </div>
      </div>
    );
  }

  // ── Line complete screen ───────────────────────────────────────────────────
  if (lineComplete) {
    const pct = totalAttempts > 0 ? Math.round((correctMoves / totalAttempts) * 100) : 100;
    return (
      <div className={`rounded-2xl border overflow-hidden ${bg} ${border}`}>
        <div className="p-8 text-center">
          {linePassed ? (
            <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-400" />
          ) : (
            <XCircle className="w-12 h-12 mx-auto mb-4 text-red-400" />
          )}
          <h3 className={`text-lg font-bold mb-1 ${textPrimary}`} style={{ fontFamily: "'Clash Display', sans-serif" }}>
            {linePassed ? "Line Mastered!" : "Keep Practicing"}
          </h3>
          <p className={`text-sm mb-1 ${textSecondary}`}>{currentLine.name}</p>
          <p className={`text-2xl font-bold mb-6 ${linePassed ? "text-green-400" : "text-red-400"}`}>
            {pct}%
          </p>
          <p className={`text-xs mb-6 ${textTertiary}`}>
            {correctMoves} correct out of {totalAttempts} attempts
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => initLine(lineIndex)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-semibold transition-all ${border} ${textSecondary} hover:${textPrimary}`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Retry
            </button>
            <button
              onClick={nextLine}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[#3D6B47] hover:bg-[#4a7d56] text-white text-sm font-semibold transition-all"
            >
              {lineIndex + 1 < lines.length ? "Next Line" : "Finish Session"}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Main practice board ────────────────────────────────────────────────────
  const userMoveIndices = sanMoves
    .map((_, i) => i)
    .filter((i) => i % 2 === (userColor === "w" ? 0 : 1));
  const userMovesDone = userMoveIndices.filter((i) => i < moveIndex).length;
  const userMovesTotal = userMoveIndices.length;

  const feedbackBg =
    feedback === "correct"
      ? isDark ? "bg-green-900/30 border-green-500/30" : "bg-green-50 border-green-200"
      : feedback === "wrong"
      ? isDark ? "bg-red-900/30 border-red-500/30" : "bg-red-50 border-red-200"
      : feedback === "hint"
      ? isDark ? "bg-yellow-900/20 border-yellow-500/20" : "bg-yellow-50 border-yellow-200"
      : isDark ? "bg-[#162018]/60 border-[#1e2e22]/50" : "bg-gray-50 border-gray-200";

  const feedbackText =
    feedback === "correct"
      ? "Correct! ✓"
      : feedback === "wrong"
      ? "Not quite — try again"
      : feedback === "hint"
      ? "Hint shown on the board"
      : feedback === "auto"
      ? "Opponent is thinking…"
      : isUserTurn()
      ? "Your turn — find the best move"
      : "Waiting…";

  const feedbackTextColor =
    feedback === "correct"
      ? "text-green-400"
      : feedback === "wrong"
      ? "text-red-400"
      : feedback === "hint"
      ? "text-yellow-400"
      : textSecondary;

  const combinedSquareStyles = {
    ...lastMoveSquares,
    ...hintSquares,
    ...legalMoveSquares,
  };

  return (
    <div className={`rounded-2xl border overflow-hidden ${bg} ${border}`}>
      {/* Header */}
      <div className={`px-4 py-3 border-b ${border} flex items-center gap-3`}>
        <Brain className={`w-4 h-4 shrink-0 ${accentText}`} />
        <div className="flex-1 min-w-0">
          <h4 className={`text-sm font-bold truncate ${textPrimary}`} style={{ fontFamily: "'Clash Display', sans-serif" }}>
            {currentLine.name}
          </h4>
          <p className={`text-[10px] ${textTertiary}`}>
            Line {lineIndex + 1} of {lines.length}
          </p>
        </div>
        {/* Progress */}
        <div className="flex items-center gap-2">
          <div className={`w-24 h-1.5 rounded-full overflow-hidden ${isDark ? "bg-white/10" : "bg-gray-200"}`}>
            <div
              className="h-full bg-[#3D6B47] rounded-full transition-all duration-500"
              style={{ width: `${((lineIndex) / lines.length) * 100}%` }}
            />
          </div>
          <span className={`text-[10px] font-mono ${textTertiary}`}>{lineIndex}/{lines.length}</span>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-col lg:flex-row">
        {/* Board */}
        <div className="flex-shrink-0 p-3 lg:p-4">
          <div className="w-full max-w-[340px] mx-auto lg:mx-0">
            <Chessboard
              options={{
                position: fen,
                boardOrientation: userColor === "w" ? "white" : "black",
                allowDragging: isUserTurn() && !lineComplete,
                squareStyles: combinedSquareStyles,
                boardStyle: {
                  borderRadius: "12px",
                  boxShadow: isDark
                    ? "0 4px 24px rgba(0,0,0,0.5)"
                    : "0 4px 16px rgba(0,0,0,0.12)",
                },
                darkSquareStyle: {
                  backgroundColor: isDark ? "#2d4a32" : "#769656",
                },
                lightSquareStyle: {
                  backgroundColor: isDark ? "#1a2e1e" : "#eeeed2",
                },
                animationDurationInMs: 200,
                onSquareClick: ({ square }: { piece: unknown; square: string }) => handleSquareClick(square),
                onPieceDrop: handlePieceDrop,
              }}
            />
          </div>

          {/* Feedback strip */}
          <div className={`mt-3 max-w-[340px] mx-auto lg:mx-0 rounded-xl border px-3 py-2 transition-all ${feedbackBg}`}>
            <p className={`text-xs font-medium text-center ${feedbackTextColor}`}>
              {feedbackText}
            </p>
          </div>
        </div>

        {/* Right panel */}
        <div className={`flex-1 flex flex-col border-t lg:border-t-0 lg:border-l ${border}`}>
          {/* Move progress */}
          <div className="p-4 space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className={`text-[10px] font-semibold uppercase tracking-widest ${textTertiary}`}>
                  Your Moves
                </span>
                <span className={`text-[10px] font-mono ${textTertiary}`}>
                  {userMovesDone} / {userMovesTotal}
                </span>
              </div>
              <div className={`h-1.5 rounded-full overflow-hidden ${isDark ? "bg-white/10" : "bg-gray-200"}`}>
                <div
                  className="h-full bg-[#3D6B47] rounded-full transition-all duration-300"
                  style={{ width: `${userMovesTotal > 0 ? (userMovesDone / userMovesTotal) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-2">
              <div className={`rounded-xl p-2.5 text-center border ${isDark ? "border-[#1e2e22]/50 bg-[#162018]/40" : "border-gray-100 bg-gray-50"}`}>
                <p className="text-green-400 text-lg font-bold">{correctMoves}</p>
                <p className={`text-[10px] ${textTertiary}`}>Correct</p>
              </div>
              <div className={`rounded-xl p-2.5 text-center border ${isDark ? "border-[#1e2e22]/50 bg-[#162018]/40" : "border-gray-100 bg-gray-50"}`}>
                <p className={`text-lg font-bold ${totalAttempts - correctMoves > 0 ? "text-red-400" : textPrimary}`}>
                  {totalAttempts - correctMoves}
                </p>
                <p className={`text-[10px] ${textTertiary}`}>Mistakes</p>
              </div>
            </div>

            {/* Hint button */}
            {isUserTurn() && !lineComplete && feedback === "idle" && (
              <button
                onClick={showHint}
                className={`w-full flex items-center justify-center gap-2 py-2 rounded-xl border text-xs font-semibold transition-all ${isDark ? "border-yellow-500/20 text-yellow-400/70 hover:bg-yellow-900/20 hover:text-yellow-400" : "border-yellow-300 text-yellow-600 hover:bg-yellow-50"}`}
              >
                <Zap className="w-3.5 h-3.5" />
                Show Hint
              </button>
            )}
          </div>

          {/* Rationale */}
          {currentLine.rationale && (
            <div className={`p-3 border-t ${border} flex-1`}>
              <p className={`text-[10px] font-semibold uppercase tracking-widest mb-1.5 ${textTertiary}`}>
                Why this line?
              </p>
              <p className={`text-xs leading-relaxed ${textSecondary}`}>{currentLine.rationale}</p>
            </div>
          )}

          {/* Skip line */}
          <div className={`p-3 border-t ${border}`}>
            <button
              onClick={nextLine}
              className={`w-full flex items-center justify-center gap-2 py-2 rounded-xl border text-xs font-medium transition-all ${isDark ? "border-white/10 text-white/30 hover:text-white/50 hover:border-white/20" : "border-gray-200 text-gray-400 hover:text-gray-600"}`}
            >
              Skip this line
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
