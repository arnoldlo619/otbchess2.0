/**
 * Game Recorder — /record
 *
 * Entry page for the OTB Game Recorder feature.
 * Provides two paths:
 *   1. Manual PGN Entry — paste or type a PGN to analyze
 *   2. Camera Recording — (future) record a game via phone camera
 *
 * Below the entry options, a "My Games" list shows all previously analyzed
 * games with opening name, date, result, and accuracy scores.
 */
import { useState, useCallback, useEffect } from "react";
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
  ChevronRight,
  Trophy,
  Minus,
  TrendingUp,
  Clock,
  RefreshCw,
  Library,
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

interface MyGame {
  id: string;
  sessionId: string;
  sessionStatus: string;
  whitePlayer: string | null;
  blackPlayer: string | null;
  result: string | null;
  openingName: string | null;
  openingEco: string | null;
  totalMoves: number | null;
  date: string | null;
  event: string | null;
  whiteAccuracy: number | null;
  blackAccuracy: number | null;
  createdAt: string;
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

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Unknown date";
  // Handle both ISO timestamps and YYYY-MM-DD strings
  const d = new Date(dateStr.includes("T") ? dateStr : dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function resultLabel(result: string | null): {
  label: string;
  color: string;
  icon: React.ReactNode;
} {
  switch (result) {
    case "1-0":
      return {
        label: "White wins",
        color: "text-emerald-500",
        icon: <Trophy className="w-3 h-3" />,
      };
    case "0-1":
      return {
        label: "Black wins",
        color: "text-rose-500",
        icon: <Trophy className="w-3 h-3" />,
      };
    case "1/2-1/2":
      return {
        label: "Draw",
        color: "text-amber-500",
        icon: <Minus className="w-3 h-3" />,
      };
    default:
      return {
        label: "In progress",
        color: "text-gray-400",
        icon: <Clock className="w-3 h-3" />,
      };
  }
}

function accuracyColor(acc: number | null): string {
  if (acc === null) return "text-gray-400";
  if (acc >= 90) return "text-emerald-500";
  if (acc >= 75) return "text-green-500";
  if (acc >= 60) return "text-amber-500";
  if (acc >= 45) return "text-orange-500";
  return "text-rose-500";
}

function sessionStatusBadge(
  status: string,
  isDark: boolean
): { label: string; className: string } | null {
  switch (status) {
    case "analyzing":
      return {
        label: "Analyzing…",
        className: isDark
          ? "bg-amber-900/40 text-amber-400 border border-amber-700/40"
          : "bg-amber-50 text-amber-700 border border-amber-200",
      };
    case "failed":
      return {
        label: "Analysis failed",
        className: isDark
          ? "bg-red-900/40 text-red-400 border border-red-700/40"
          : "bg-red-50 text-red-700 border border-red-200",
      };
    default:
      return null;
  }
}

// ── GameCard Component ───────────────────────────────────────────────────────
function GameCard({
  game,
  isDark,
  onClick,
}: {
  game: MyGame;
  isDark: boolean;
  onClick: () => void;
}) {
  const result = resultLabel(game.result);
  const statusBadge = sessionStatusBadge(game.sessionStatus, isDark);
  const isAnalyzing = game.sessionStatus === "analyzing";
  const hasMoveCount = (game.totalMoves ?? 0) > 0;

  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-2xl border transition-all hover:scale-[1.01] active:scale-[0.99] ${
        isDark
          ? "bg-white/5 border-white/10 hover:border-[#3D6B47]/50 hover:bg-white/8"
          : "bg-white border-gray-200 hover:border-[#3D6B47]/40 hover:shadow-md"
      }`}
    >
      <div className="p-4 space-y-3">
        {/* Top row: players vs result */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* White piece indicator */}
              <span
                className={`inline-block w-3 h-3 rounded-sm border flex-shrink-0 ${
                  isDark ? "bg-white border-white/30" : "bg-white border-gray-300"
                }`}
              />
              <span
                className={`text-sm font-semibold truncate ${
                  isDark ? "text-white" : "text-gray-900"
                }`}
              >
                {game.whitePlayer ?? "White"}
              </span>
              <span className={`text-xs ${isDark ? "text-white/30" : "text-gray-400"}`}>vs</span>
              {/* Black piece indicator */}
              <span
                className={`inline-block w-3 h-3 rounded-sm border flex-shrink-0 ${
                  isDark ? "bg-gray-800 border-white/20" : "bg-gray-800 border-gray-600"
                }`}
              />
              <span
                className={`text-sm font-semibold truncate ${
                  isDark ? "text-white" : "text-gray-900"
                }`}
              >
                {game.blackPlayer ?? "Black"}
              </span>
            </div>

            {/* Opening name */}
            <div className="flex items-center gap-2 mt-1">
              {game.openingEco && (
                <span
                  className={`text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded font-mono ${
                    isDark
                      ? "bg-[#3D6B47]/30 text-[#3D6B47]"
                      : "bg-[#3D6B47]/10 text-[#3D6B47]"
                  }`}
                >
                  {game.openingEco}
                </span>
              )}
              <span
                className={`text-xs truncate ${isDark ? "text-white/50" : "text-gray-500"}`}
              >
                {game.openingName ?? "Unknown opening"}
              </span>
            </div>
          </div>

          {/* Result badge */}
          <div className="flex-shrink-0 flex flex-col items-end gap-1">
            <div className={`flex items-center gap-1 text-xs font-medium ${result.color}`}>
              {result.icon}
              {result.label}
            </div>
            {statusBadge && (
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statusBadge.className}`}>
                {isAnalyzing && <Loader2 className="w-2.5 h-2.5 animate-spin inline mr-1" />}
                {statusBadge.label}
              </span>
            )}
          </div>
        </div>

        {/* Bottom row: accuracy + metadata */}
        <div
          className={`flex items-center justify-between pt-2 border-t ${
            isDark ? "border-white/5" : "border-gray-100"
          }`}
        >
          {/* Accuracy scores */}
          <div className="flex items-center gap-3">
            {game.whiteAccuracy !== null || game.blackAccuracy !== null ? (
              <>
                <div className="flex items-center gap-1">
                  <TrendingUp className={`w-3 h-3 ${accuracyColor(game.whiteAccuracy)}`} />
                  <span
                    className={`text-xs font-semibold ${accuracyColor(game.whiteAccuracy)}`}
                  >
                    {game.whiteAccuracy !== null
                      ? `${Math.round(game.whiteAccuracy)}%`
                      : "—"}
                  </span>
                  <span className={`text-[10px] ${isDark ? "text-white/30" : "text-gray-400"}`}>
                    W
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <TrendingUp className={`w-3 h-3 ${accuracyColor(game.blackAccuracy)}`} />
                  <span
                    className={`text-xs font-semibold ${accuracyColor(game.blackAccuracy)}`}
                  >
                    {game.blackAccuracy !== null
                      ? `${Math.round(game.blackAccuracy)}%`
                      : "—"}
                  </span>
                  <span className={`text-[10px] ${isDark ? "text-white/30" : "text-gray-400"}`}>
                    B
                  </span>
                </div>
              </>
            ) : (
              <span className={`text-xs ${isDark ? "text-white/30" : "text-gray-400"}`}>
                {isAnalyzing ? "Calculating accuracy…" : "No accuracy data"}
              </span>
            )}
          </div>

          {/* Date + move count */}
          <div className="flex items-center gap-2">
            {hasMoveCount && (
              <span className={`text-[10px] ${isDark ? "text-white/30" : "text-gray-400"}`}>
                {game.totalMoves}m
              </span>
            )}
            <span className={`text-xs ${isDark ? "text-white/40" : "text-gray-400"}`}>
              {formatDate(game.date ?? game.createdAt)}
            </span>
            <ChevronRight
              className={`w-3.5 h-3.5 ${isDark ? "text-white/20" : "text-gray-300"}`}
            />
          </div>
        </div>
      </div>
    </button>
  );
}

// ── My Games Section ─────────────────────────────────────────────────────────
/** Check if any games in the list are still processing/analyzing */
function hasInProgressGames(games: MyGame[]): boolean {
  return games.some(
    (g) => g.sessionStatus === "analyzing" || g.sessionStatus === "uploading" || g.sessionStatus === "processing"
  );
}

function MyGamesSection({
  isDark,
  onNavigate,
}: {
  isDark: boolean;
  onNavigate: (path: string) => void;
}) {
  const { user } = useAuthContext();
  const [games, setGames] = useState<MyGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGames = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/games");
      if (!res.ok) throw new Error("Failed to load games");
      const data = await res.json();
      setGames(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load games");
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Silent refresh that doesn't show loading skeleton (for auto-poll)
  const silentRefresh = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch("/api/games");
      if (!res.ok) return;
      const data = await res.json();
      setGames(Array.isArray(data) ? data : []);
    } catch {
      // Silent — don't show error on auto-refresh
    }
  }, [user]);

  useEffect(() => {
    fetchGames();
  }, [fetchGames]);

  // Auto-refresh every 10 seconds when there are in-progress games
  useEffect(() => {
    if (!hasInProgressGames(games)) return;

    const interval = setInterval(silentRefresh, 10_000);
    return () => clearInterval(interval);
  }, [games, silentRefresh]);

  // If not signed in, don't render the section
  if (!user) return null;

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <h2 className={`text-lg font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
          My Games
        </h2>
        <button
          onClick={fetchGames}
          disabled={loading}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            isDark
              ? "text-white/40 hover:text-white/70 hover:bg-white/5"
              : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
          }`}
          aria-label="Refresh games list"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className={`h-24 rounded-2xl animate-pulse ${
                isDark ? "bg-white/5" : "bg-gray-100"
              }`}
            />
          ))}
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div
          className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm ${
            isDark ? "bg-red-900/20 text-red-400" : "bg-red-50 text-red-700"
          }`}
        >
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
          <button
            onClick={fetchGames}
            className="ml-auto text-xs underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && games.length === 0 && (
        <div
          className={`flex flex-col items-center justify-center gap-3 py-12 rounded-2xl border border-dashed ${
            isDark ? "border-white/10 text-white/30" : "border-gray-200 text-gray-400"
          }`}
        >
          <Swords className="w-8 h-8 opacity-40" />
          <div className="text-center space-y-1">
            <p className="text-sm font-medium">No games yet</p>
            <p className="text-xs opacity-70">
              Analyze your first game using PGN entry above
            </p>
          </div>
        </div>
      )}

      {/* Game cards */}
      {!loading && !error && games.length > 0 && (
        <div className="space-y-3">
          {games.map((game) => (
            <GameCard
              key={game.id}
              game={game}
              isDark={isDark}
              onClick={() => onNavigate(`/game/${game.id}/analysis`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────
export default function GameRecorder() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const { user } = useAuthContext();
  const [, navigate] = useLocation();

  // SEO: set page title and meta description
  useEffect(() => {
    document.title = "Record a Chess Game — PGN & Video Capture | ChessOTB.club";
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute("content", "Record your over-the-board chess games with manual PGN entry or AI-powered video capture. Save and analyze your games on ChessOTB.club.");
    return () => {
      document.title = "ChessOTB.club — Chess Tournaments Over The Board";
    };
  }, []);

  // ── State ─────────────────────────────────────────────────────────────────────────────
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
        className={`sticky top-0 z-50 backdrop-blur-xl border-b otb-header-safe ${
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

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-10">
        {/* ── Mode Selection ─────────────────────────────────────────────── */}
        {mode === "select" && (
          <>
            <div className="space-y-8">
              <div className="text-center space-y-3">
                <h1 className="text-3xl font-bold tracking-tight">
                  Record Your Game
                </h1>
                <p className={`text-base ${isDark ? "text-white/50" : "text-gray-500"}`}>
                  Analyze your OTB games with engine-powered insights
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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

                {/* Openings & Repertoire */}
                <button
                  onClick={() => navigate("/openings")}
                  className={`group relative overflow-hidden rounded-2xl border p-6 text-left transition-all hover:scale-[1.02] active:scale-[0.98] sm:col-span-2 lg:col-span-1 ${
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
                      <Library className="w-6 h-6 text-[#3D6B47]" />
                    </div>
                    <div className="space-y-1.5">
                      <h3 className="font-semibold text-lg">Openings &amp; Repertoire</h3>
                      <p
                        className={`text-sm leading-relaxed ${
                          isDark ? "text-white/50" : "text-gray-500"
                        }`}
                      >
                        Study openings, build your repertoire, and prep against opponents
                      </p>
                    </div>
                  </div>
                  <div
                    className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-[#3D6B47] to-emerald-500 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left`}
                  />
                </button>
              </div>
            </div>

            {/* ── My Games ─────────────────────────────────────────────────── */}
            <MyGamesSection isDark={isDark} onNavigate={navigate} />
          </>
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
