/**
 * Game Recorder — /record
 *
 * Entry page for the OTB Game Recorder feature.
 * Provides two paths:
 *   1. Manual PGN Entry — paste or type a PGN to analyze
 *   2. Camera Recording — (future) record a game via phone camera
 *
 * After submitting a PGN, the user is redirected to the analysis page.
 */
import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import { NavLogo } from "@/components/NavLogo";
import { useTheme } from "../contexts/ThemeContext";
import { useAuthContext } from "../context/AuthContext";
import {
  ChevronLeft,
  FileText,
  Camera,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clipboard,
  Swords,
  BookOpen,
} from "lucide-react";
import { Chess } from "chess.js";

// ── Types ────────────────────────────────────────────────────────────────────
interface GameSetup {
  whitePlayer: string;
  blackPlayer: string;
  event: string;
  date: string;
  result: string;
  pgn: string;
}

// ── PGN Validation ──────────────────────────────────────────────────────────
function validatePgn(pgn: string): { valid: boolean; error?: string; moveCount: number } {
  if (!pgn.trim()) return { valid: false, error: "PGN is empty", moveCount: 0 };

  try {
    const chess = new Chess();
    // Strip headers
    const movesOnly = pgn.replace(/\[.*?\]\s*/g, "").trim();
    chess.loadPgn(movesOnly);
    const history = chess.history();
    if (history.length === 0) {
      return { valid: false, error: "No valid moves found in PGN", moveCount: 0 };
    }
    return { valid: true, moveCount: history.length };
  } catch (err) {
    return {
      valid: false,
      error: `Invalid PGN: ${err instanceof Error ? err.message : "Parse error"}`,
      moveCount: 0,
    };
  }
}

// ── Sample PGN for demo ─────────────────────────────────────────────────────
const SAMPLE_PGN = `1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O 9. h3 Nb8 10. d4 Nbd7 11. Nbd2 Bb7 12. Bc2 Re8 13. Nf1 Bf8 14. Ng3 g6 15. Bg5 h6 16. Bd2 Bg7 17. a4 c5 18. d5 c4 19. b4 Nh7 20. Be3 h5 21. Qd2 Nf4 22. Bf1 Qf6 23. g3 Nh3+ 24. Kg2 Nf4+ 25. Kh2 Qg5 26. Nh4 Nf6 27. f3 Nh3 28. Nf1 Nf2 29. Rg1 Nd3 30. Ng2 Nxb4 31. cxb4 bxa4 1/2-1/2`;

// ── Main Component ──────────────────────────────────────────────────────────
export default function GameRecorder() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const { user } = useAuthContext();
  const [, navigate] = useLocation();

  // ── State ─────────────────────────────────────────────────────────────────
  const [mode, setMode] = useState<"select" | "manual" | "camera">("select");
  const [setup, setSetup] = useState<GameSetup>({
    whitePlayer: "",
    blackPlayer: "",
    event: "",
    date: new Date().toISOString().split("T")[0],
    result: "*",
    pgn: "",
  });
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    error?: string;
    moveCount: number;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handlePgnChange = useCallback((pgn: string) => {
    setSetup((prev) => ({ ...prev, pgn }));
    if (pgn.trim().length > 5) {
      setValidationResult(validatePgn(pgn));
    } else {
      setValidationResult(null);
    }
  }, []);

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      handlePgnChange(text);
    } catch {
      // Clipboard API not available
    }
  }, [handlePgnChange]);

  const handleLoadSample = useCallback(() => {
    handlePgnChange(SAMPLE_PGN);
    setSetup((prev) => ({
      ...prev,
      pgn: SAMPLE_PGN,
      whitePlayer: "Kasparov",
      blackPlayer: "Karpov",
      event: "Sample Game",
      result: "1/2-1/2",
    }));
  }, [handlePgnChange]);

  const handleSubmit = useCallback(async () => {
    if (!validationResult?.valid) return;
    if (!user) {
      setError("Please sign in to analyze games");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // 1. Create a recording session
      const sessionRes = await fetch("/api/recordings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!sessionRes.ok) throw new Error("Failed to create session");
      const session = await sessionRes.json();

      // 2. Submit the PGN
      const pgnRes = await fetch(`/api/recordings/${session.id}/pgn`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pgn: setup.pgn,
          whitePlayer: setup.whitePlayer || "White",
          blackPlayer: setup.blackPlayer || "Black",
          result: setup.result,
          event: setup.event || undefined,
          date: setup.date,
        }),
      });
      if (!pgnRes.ok) throw new Error("Failed to submit PGN");
      const game = await pgnRes.json();

      // 3. Trigger engine analysis
      await fetch(`/api/recordings/${session.id}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      // 4. Navigate to analysis page
      navigate(`/game/${game.id}/analysis`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  }, [validationResult, user, setup, navigate]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className={`min-h-screen ${
        isDark
          ? "bg-[#0d1a0f] text-white"
          : "bg-gradient-to-b from-gray-50 to-white text-gray-900"
      }`}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header
        className={`sticky top-0 z-50 backdrop-blur-xl border-b ${
          isDark ? "bg-[#0d1a0f]/80 border-white/10" : "bg-white/80 border-gray-200"
        }`}
      >
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-3">
          <button
            onClick={() => (mode === "select" ? navigate("/") : setMode("select"))}
            className={`p-1.5 rounded-lg transition-colors ${
              isDark ? "hover:bg-white/10" : "hover:bg-gray-100"
            }`}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <NavLogo linked={false} />
          <span
            className={`text-sm font-medium ${isDark ? "text-white/60" : "text-gray-500"}`}
          >
            Game Recorder
          </span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {/* ── Mode Selection ─────────────────────────────────────────────── */}
        {mode === "select" && (
          <div className="space-y-8">
            <div className="text-center space-y-3">
              <h1 className="text-3xl font-bold tracking-tight">
                Record Your Game
              </h1>
              <p className={`text-base ${isDark ? "text-white/50" : "text-gray-500"}`}>
                Analyze your OTB games with engine-powered insights
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {/* Manual PGN Entry */}
              <button
                onClick={() => setMode("manual")}
                className={`group relative overflow-hidden rounded-2xl border p-6 text-left transition-all hover:scale-[1.02] active:scale-[0.98] ${
                  isDark
                    ? "bg-white/5 border-white/10 hover:border-[#3D6B47]/60 hover:bg-white/8"
                    : "bg-white border-gray-200 hover:border-[#3D6B47]/40 hover:shadow-lg"
                }`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${
                      isDark ? "bg-[#3D6B47]/30" : "bg-[#3D6B47]/10"
                    }`}
                  >
                    <FileText className="w-6 h-6 text-[#3D6B47]" />
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="font-semibold text-lg">Enter PGN</h3>
                    <p
                      className={`text-sm leading-relaxed ${
                        isDark ? "text-white/50" : "text-gray-500"
                      }`}
                    >
                      Paste or type your game notation for instant Stockfish analysis
                    </p>
                  </div>
                </div>
                <div
                  className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-[#3D6B47] to-emerald-500 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left`}
                />
              </button>

              {/* Camera Recording (Coming Soon) */}
              <div
                className={`relative overflow-hidden rounded-2xl border p-6 text-left opacity-60 ${
                  isDark
                    ? "bg-white/5 border-white/10"
                    : "bg-white border-gray-200"
                }`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${
                      isDark ? "bg-white/10" : "bg-gray-100"
                    }`}
                  >
                    <Camera className="w-6 h-6 text-gray-400" />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-lg">Record via Camera</h3>
                      <span
                        className={`text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full ${
                          isDark
                            ? "bg-white/10 text-white/40"
                            : "bg-gray-100 text-gray-400"
                        }`}
                      >
                        Coming Soon
                      </span>
                    </div>
                    <p
                      className={`text-sm leading-relaxed ${
                        isDark ? "text-white/40" : "text-gray-400"
                      }`}
                    >
                      Point your phone camera at the board for automatic move detection
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick tip */}
            <div
              className={`flex items-start gap-3 rounded-xl p-4 ${
                isDark ? "bg-white/5" : "bg-[#3D6B47]/5"
              }`}
            >
              <BookOpen
                className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                  isDark ? "text-[#3D6B47]" : "text-[#3D6B47]"
                }`}
              />
              <div className="space-y-1">
                <p
                  className={`text-sm font-medium ${
                    isDark ? "text-white/70" : "text-gray-700"
                  }`}
                >
                  Where to find your PGN?
                </p>
                <p
                  className={`text-xs leading-relaxed ${
                    isDark ? "text-white/40" : "text-gray-500"
                  }`}
                >
                  Write down your moves during the game, or use a chess notation
                  app. You can also export games from chess.com or lichess.org.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Manual PGN Entry ───────────────────────────────────────────── */}
        {mode === "manual" && (
          <div className="space-y-6">
            <div className="space-y-1">
              <h2 className="text-2xl font-bold tracking-tight">Enter Game PGN</h2>
              <p className={`text-sm ${isDark ? "text-white/50" : "text-gray-500"}`}>
                Paste your game notation below for engine analysis
              </p>
            </div>

            {/* Player Names */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label
                  className={`text-xs font-medium ${
                    isDark ? "text-white/50" : "text-gray-500"
                  }`}
                >
                  White Player
                </label>
                <input
                  type="text"
                  value={setup.whitePlayer}
                  onChange={(e) =>
                    setSetup((prev) => ({ ...prev, whitePlayer: e.target.value }))
                  }
                  placeholder="Player name"
                  className={`w-full px-3 py-2.5 rounded-xl border text-sm transition-colors ${
                    isDark
                      ? "bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-[#3D6B47]"
                      : "bg-white border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-[#3D6B47]"
                  } outline-none`}
                />
              </div>
              <div className="space-y-1.5">
                <label
                  className={`text-xs font-medium ${
                    isDark ? "text-white/50" : "text-gray-500"
                  }`}
                >
                  Black Player
                </label>
                <input
                  type="text"
                  value={setup.blackPlayer}
                  onChange={(e) =>
                    setSetup((prev) => ({ ...prev, blackPlayer: e.target.value }))
                  }
                  placeholder="Player name"
                  className={`w-full px-3 py-2.5 rounded-xl border text-sm transition-colors ${
                    isDark
                      ? "bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-[#3D6B47]"
                      : "bg-white border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-[#3D6B47]"
                  } outline-none`}
                />
              </div>
            </div>

            {/* Event & Date */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label
                  className={`text-xs font-medium ${
                    isDark ? "text-white/50" : "text-gray-500"
                  }`}
                >
                  Event (optional)
                </label>
                <input
                  type="text"
                  value={setup.event}
                  onChange={(e) =>
                    setSetup((prev) => ({ ...prev, event: e.target.value }))
                  }
                  placeholder="e.g. Club Championship"
                  className={`w-full px-3 py-2.5 rounded-xl border text-sm transition-colors ${
                    isDark
                      ? "bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-[#3D6B47]"
                      : "bg-white border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-[#3D6B47]"
                  } outline-none`}
                />
              </div>
              <div className="space-y-1.5">
                <label
                  className={`text-xs font-medium ${
                    isDark ? "text-white/50" : "text-gray-500"
                  }`}
                >
                  Date
                </label>
                <input
                  type="date"
                  value={setup.date}
                  onChange={(e) =>
                    setSetup((prev) => ({ ...prev, date: e.target.value }))
                  }
                  className={`w-full px-3 py-2.5 rounded-xl border text-sm transition-colors ${
                    isDark
                      ? "bg-white/5 border-white/10 text-white focus:border-[#3D6B47]"
                      : "bg-white border-gray-200 text-gray-900 focus:border-[#3D6B47]"
                  } outline-none`}
                />
              </div>
            </div>

            {/* Result */}
            <div className="space-y-1.5">
              <label
                className={`text-xs font-medium ${
                  isDark ? "text-white/50" : "text-gray-500"
                }`}
              >
                Result
              </label>
              <div className="flex gap-2">
                {[
                  { value: "1-0", label: "White Wins" },
                  { value: "1/2-1/2", label: "Draw" },
                  { value: "0-1", label: "Black Wins" },
                  { value: "*", label: "Unknown" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() =>
                      setSetup((prev) => ({ ...prev, result: opt.value }))
                    }
                    className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all ${
                      setup.result === opt.value
                        ? isDark
                          ? "bg-[#3D6B47] text-white"
                          : "bg-[#3D6B47] text-white"
                        : isDark
                          ? "bg-white/5 text-white/60 hover:bg-white/10"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* PGN Input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  className={`text-xs font-medium ${
                    isDark ? "text-white/50" : "text-gray-500"
                  }`}
                >
                  PGN Notation
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={handlePaste}
                    className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                      isDark
                        ? "text-white/40 hover:text-white/70 hover:bg-white/5"
                        : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    <Clipboard className="w-3 h-3" />
                    Paste
                  </button>
                  <button
                    onClick={handleLoadSample}
                    className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                      isDark
                        ? "text-[#3D6B47]/70 hover:text-[#3D6B47] hover:bg-[#3D6B47]/10"
                        : "text-[#3D6B47]/70 hover:text-[#3D6B47] hover:bg-[#3D6B47]/5"
                    }`}
                  >
                    <Swords className="w-3 h-3" />
                    Load Sample
                  </button>
                </div>
              </div>
              <textarea
                value={setup.pgn}
                onChange={(e) => handlePgnChange(e.target.value)}
                placeholder="1. e4 e5 2. Nf3 Nc6 3. Bb5 ..."
                rows={8}
                className={`w-full px-4 py-3 rounded-xl border text-sm font-mono leading-relaxed transition-colors resize-none ${
                  isDark
                    ? "bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-[#3D6B47]"
                    : "bg-white border-gray-200 text-gray-900 placeholder:text-gray-300 focus:border-[#3D6B47]"
                } outline-none`}
              />

              {/* Validation feedback */}
              {validationResult && (
                <div
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium ${
                    validationResult.valid
                      ? isDark
                        ? "bg-emerald-900/30 text-emerald-400"
                        : "bg-emerald-50 text-emerald-700"
                      : isDark
                        ? "bg-red-900/30 text-red-400"
                        : "bg-red-50 text-red-700"
                  }`}
                >
                  {validationResult.valid ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Valid PGN — {validationResult.moveCount} moves detected
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-3.5 h-3.5" />
                      {validationResult.error}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Error */}
            {error && (
              <div
                className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm ${
                  isDark
                    ? "bg-red-900/30 text-red-400"
                    : "bg-red-50 text-red-700"
                }`}
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={!validationResult?.valid || submitting}
              className={`w-full py-3.5 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                validationResult?.valid && !submitting
                  ? "bg-[#3D6B47] text-white hover:bg-[#2d5235] active:scale-[0.98]"
                  : isDark
                    ? "bg-white/10 text-white/30 cursor-not-allowed"
                    : "bg-gray-100 text-gray-400 cursor-not-allowed"
              }`}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Starting Analysis…
                </>
              ) : (
                <>
                  <Swords className="w-4 h-4" />
                  Analyze Game
                </>
              )}
            </button>

            {!user && (
              <p
                className={`text-center text-xs ${
                  isDark ? "text-white/30" : "text-gray-400"
                }`}
              >
                You need to{" "}
                <button
                  onClick={() => navigate("/profile")}
                  className="text-[#3D6B47] hover:underline"
                >
                  sign in
                </button>{" "}
                to analyze games
              </p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
