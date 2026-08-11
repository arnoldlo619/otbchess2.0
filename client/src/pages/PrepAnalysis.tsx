/**
 * PrepAnalysis.tsx — /prep/analysis
 *
 * ChessOTB Matchup Prep Analysis Workspace.
 * Launched from Matchup Prep evidence games, positions, or lines.
 *
 * Two modes:
 * - Game Replay: official Lichess game embed (verified Lichess games) or native PGN replay
 * - Position Analysis: official Lichess analysis embed at exact legal FEN
 *
 * All content is derived from trusted server-resolved workspace data.
 * No raw FEN/PGN/provider URLs from the browser control the embed.
 */
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useLocation } from "wouter";
import { useTheme } from "@/contexts/ThemeContext";
import {
  ArrowLeft, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  RefreshCw, RotateCcw, ExternalLink, Loader2, AlertCircle,
  Target, Gamepad2,
} from "lucide-react";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";
import { authFetch } from "@/lib/apiFetch";
import { NavLogo } from "@/components/NavLogo";
import { AvatarNavDropdown } from "@/components/AvatarNavDropdown";
import { LichessEmbed } from "@/components/prep/LichessEmbed";
import {
  buildGameEmbedUrl,
  buildAnalysisEmbedUrl,
  buildGameFallbackUrl,
  buildAnalysisFallbackUrl,
} from "@/lib/embedUrlBuilder";
import type {
  TrustedAnalysisWorkspace,
  AnalysisLaunchSubject,
} from "../../../shared/prepTypes";

// ── Types ─────────────────────────────────────────────────────────────────────

type AnalysisMode = "game-replay" | "position-analysis";

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseLaunchParams(): {
  subject: AnalysisLaunchSubject | null;
  returnUrl: string;
  myColor: "white" | "black";
} {
  const params = new URLSearchParams(window.location.search);
  const returnUrl = params.get("return") ?? "/prep";
  const myColor = params.get("color") === "black" ? "black" : "white";

  try {
    const subjectStr = params.get("subject");
    if (!subjectStr) return { subject: null, returnUrl, myColor };
    const subject = JSON.parse(decodeURIComponent(subjectStr)) as AnalysisLaunchSubject;
    // Basic validation
    if (!subject.kind || !subject.reportCacheKey) return { subject: null, returnUrl, myColor };
    return { subject, returnUrl, myColor };
  } catch {
    return { subject: null, returnUrl, myColor };
  }
}

// ── Move navigation component ─────────────────────────────────────────────────

interface MoveNavProps {
  sanBreadcrumb: string[];
  currentPly: number;
  onPly: (ply: number) => void;
  isDark: boolean;
}

function MoveNav({ sanBreadcrumb, currentPly, onPly, isDark }: MoveNavProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll current move into view
  useEffect(() => {
    const el = scrollRef.current?.querySelector(`[data-ply="${currentPly}"]`);
    el?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [currentPly]);

  return (
    <div className="space-y-2">
      {/* Move list */}
      <div
        ref={scrollRef}
        className={`flex flex-wrap gap-1 p-2 rounded-lg max-h-24 overflow-y-auto ${
          isDark ? "bg-[#0f1c11]" : "bg-[#f0f7f0]"
        }`}
        role="list"
        aria-label="Move list"
      >
        {/* Start position */}
        <button
          data-ply={0}
          onClick={() => onPly(0)}
          className={`text-xs px-2 py-1 rounded transition-colors ${
            currentPly === 0
              ? (isDark ? "bg-[#7ed957]/20 text-[#7ed957] font-semibold" : "bg-[#436850]/20 text-[#436850] font-semibold")
              : (isDark ? "text-white/40 hover:text-white/70" : "text-black/40 hover:text-black/70")
          }`}
          aria-label="Start position"
          aria-current={currentPly === 0}
        >
          Start
        </button>
        {sanBreadcrumb.map((san, i) => {
          const ply = i + 1;
          const moveNum = Math.floor(i / 2) + 1;
          const isWhiteMove = i % 2 === 0;
          return (
            <button
              key={ply}
              data-ply={ply}
              onClick={() => onPly(ply)}
              className={`text-xs px-2 py-1 rounded transition-colors font-mono ${
                currentPly === ply
                  ? (isDark ? "bg-[#7ed957]/20 text-[#7ed957] font-semibold" : "bg-[#436850]/20 text-[#436850] font-semibold")
                  : (isDark ? "text-white/60 hover:text-white/80" : "text-black/60 hover:text-black/80")
              }`}
              aria-label={`Move ${moveNum}${isWhiteMove ? "." : "..."} ${san}`}
              aria-current={currentPly === ply}
              role="listitem"
            >
              {isWhiteMove && <span className="text-white/30 mr-0.5">{moveNum}.</span>}
              {san}
            </button>
          );
        })}
      </div>

      {/* Navigation controls */}
      <div className="flex items-center gap-1" role="group" aria-label="Move navigation">
        <button
          onClick={() => onPly(0)}
          disabled={currentPly === 0}
          className={`p-2 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center ${
            currentPly === 0
              ? (isDark ? "text-white/20" : "text-black/20")
              : (isDark ? "text-white/60 hover:bg-white/10" : "text-black/60 hover:bg-black/10")
          }`}
          aria-label="Go to start"
        >
          <ChevronsLeft className="w-4 h-4" />
        </button>
        <button
          onClick={() => onPly(Math.max(0, currentPly - 1))}
          disabled={currentPly === 0}
          className={`p-2 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center ${
            currentPly === 0
              ? (isDark ? "text-white/20" : "text-black/20")
              : (isDark ? "text-white/60 hover:bg-white/10" : "text-black/60 hover:bg-black/10")
          }`}
          aria-label="Previous move"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className={`flex-1 text-center text-xs ${isDark ? "text-white/50" : "text-black/50"}`}>
          {currentPly === 0
            ? "Start"
            : `Move ${Math.ceil(currentPly / 2)}${currentPly % 2 === 1 ? "." : "..."} · ${
                currentPly % 2 === 1 ? "White" : "Black"
              } played`}
        </div>
        <button
          onClick={() => onPly(Math.min(sanBreadcrumb.length, currentPly + 1))}
          disabled={currentPly >= sanBreadcrumb.length}
          className={`p-2 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center ${
            currentPly >= sanBreadcrumb.length
              ? (isDark ? "text-white/20" : "text-black/20")
              : (isDark ? "text-white/60 hover:bg-white/10" : "text-black/60 hover:bg-black/10")
          }`}
          aria-label="Next move"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <button
          onClick={() => onPly(sanBreadcrumb.length)}
          disabled={currentPly >= sanBreadcrumb.length}
          className={`p-2 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center ${
            currentPly >= sanBreadcrumb.length
              ? (isDark ? "text-white/20" : "text-black/20")
              : (isDark ? "text-white/60 hover:bg-white/10" : "text-black/60 hover:bg-black/10")
          }`}
          aria-label="Go to end"
        >
          <ChevronsRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ── Main PrepAnalysis page ────────────────────────────────────────────────────

export default function PrepAnalysis() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [, navigate] = useLocation();
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Parse launch params from URL
  const { subject, returnUrl, myColor: initialMyColor } = useMemo(() => parseLaunchParams(), []);

  // State
  const [workspace, setWorkspace] = useState<TrustedAnalysisWorkspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<AnalysisMode>("game-replay");
  const [currentPly, setCurrentPly] = useState(0);
  const [orientation, setOrientation] = useState<"white" | "black">(initialMyColor);
  const [iframeKey, setIframeKey] = useState(0); // Force remount on ply/orientation change

  // Resolve workspace on mount
  useEffect(() => {
    if (!subject) {
      setError("Invalid launch context. Please return to Matchup Prep and try again.");
      setLoading(false);
      return;
    }

    authFetch("/api/prep/analysis/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject }),
    })
      .then(async res => {
        const data = await res.json();
        if (!res.ok || !data.ok) {
          throw new Error(data.message ?? `Error ${res.status}`);
        }
        return data.workspace as TrustedAnalysisWorkspace;
      })
      .then(ws => {
        setWorkspace(ws);
        // Default mode based on launch kind
        setMode(ws.launchKind === "source-game" ? "game-replay" : "position-analysis");
        setCurrentPly(ws.position.ply);
        setOrientation(ws.position.orientation);
        setLoading(false);
        // Move focus to heading
        setTimeout(() => headingRef.current?.focus(), 100);
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : "Failed to load analysis workspace.");
        setLoading(false);
      });
  }, [subject]);

  // Derive current FEN from workspace PGN at currentPly
  const currentFen = useMemo(() => {
    if (!workspace?.game?.canonicalPgn) return workspace?.position.fen ?? null;
    try {
      const chess = new Chess();
      const sans = workspace.game.canonicalPgn
        .replace(/\d+\./g, "")
        .split(/\s+/)
        .filter(Boolean);
      for (let i = 0; i < Math.min(currentPly, sans.length); i++) {
        chess.move(sans[i]);
      }
      return chess.fen();
    } catch {
      return workspace.position.fen;
    }
  }, [workspace, currentPly]);

  // Build embed URLs
  const gameEmbedResult = useMemo(() => {
    if (!workspace?.game?.providerGameId || workspace.game.provider !== "lichess") return null;
    return buildGameEmbedUrl({
      gameId: workspace.game.providerGameId,
      bg: isDark ? "dark" : "light",
    });
  }, [workspace, isDark]);

  const analysisEmbedResult = useMemo(() => {
    if (!currentFen) return null;
    return buildAnalysisEmbedUrl({
      fen: currentFen,
      color: orientation,
      bg: isDark ? "dark" : "light",
    });
  }, [currentFen, orientation, isDark]);

  const gameFallbackResult = useMemo(() => {
    if (!workspace?.game?.providerGameId || workspace.game.provider !== "lichess") return null;
    return buildGameFallbackUrl(workspace.game.providerGameId);
  }, [workspace]);

  const analysisFallbackResult = useMemo(() => {
    if (!currentFen) return null;
    return buildAnalysisFallbackUrl(currentFen, orientation);
  }, [currentFen, orientation]);

  // Remount iframe when ply or orientation changes in position analysis mode
  const handlePlyChange = useCallback((ply: number) => {
    setCurrentPly(ply);
    if (mode === "position-analysis") {
      setIframeKey(k => k + 1);
    }
  }, [mode]);

  const handleOrientationFlip = useCallback(() => {
    setOrientation(o => o === "white" ? "black" : "white");
    setIframeKey(k => k + 1);
  }, []);

  const handleResetToSelected = useCallback(() => {
    setIframeKey(k => k + 1);
  }, []);

  // Theme tokens
  const t = {
    card: isDark
      ? "bg-[#0f1c11]/80 border border-[#1e2e22]/70 rounded-2xl"
      : "bg-white/90 border border-[#ADBC9F]/40 rounded-2xl",
    textPrimary: isDark ? "text-white" : "text-[#1a2e1e]",
    textSecondary: isDark ? "text-white/70" : "text-[#2d4a32]",
    textTertiary: isDark ? "text-white/40" : "text-[#436850]/60",
  };

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className={`min-h-screen ${isDark ? "bg-[#0a1a0c]" : "bg-[#f5f9f5]"}`}>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-[#7ed957] mx-auto" />
            <p className={`text-sm ${t.textTertiary}`}>Loading analysis workspace…</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (error || !workspace) {
    return (
      <div className={`min-h-screen ${isDark ? "bg-[#0a1a0c]" : "bg-[#f5f9f5]"}`}>
        <div className="max-w-2xl mx-auto px-4 py-12 text-center space-y-4">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
          <h1 className={`text-lg font-bold ${t.textPrimary}`}>Analysis unavailable</h1>
          <p className={`text-sm ${t.textSecondary}`}>{error ?? "Could not load analysis workspace."}</p>
          <button
            onClick={() => navigate(returnUrl)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              isDark ? "bg-[#1e2e22] text-white/70 hover:bg-[#2a3e2e]" : "bg-[#ADBC9F]/40 text-[#436850] hover:bg-[#ADBC9F]/60"
            }`}
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Matchup Prep
          </button>
        </div>
      </div>
    );
  }

  const { game, position, evidenceContext } = workspace;
  const sanBreadcrumb = game?.canonicalPgn
    ? game.canonicalPgn.replace(/\d+\./g, "").split(/\s+/).filter(Boolean)
    : position.sanBreadcrumb;

  const hasLichessGameEmbed = gameEmbedResult?.ok && gameFallbackResult?.ok;
  const hasNativeGame = !!game?.canonicalPgn;
  const canShowGameReplay = hasLichessGameEmbed || hasNativeGame;

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0a1a0c]" : "bg-[#f5f9f5]"}`}>
      {/* Nav */}
      <header className={`sticky top-0 z-40 border-b ${isDark ? "bg-[#0a1a0c]/95 border-[#1e2e22]" : "bg-white/95 border-[#ADBC9F]/40"} backdrop-blur-sm`}>
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-3">
          <NavLogo />
          <div className="flex-1" />
          <AvatarNavDropdown />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-5 space-y-4">
        {/* Back + title */}
        <div className="flex items-start gap-3">
          <button
            onClick={() => navigate(returnUrl)}
            className={`flex items-center gap-1.5 text-sm transition-colors shrink-0 mt-0.5 ${
              isDark ? "text-white/50 hover:text-white/80" : "text-black/50 hover:text-black/80"
            }`}
            aria-label="Back to Matchup Prep"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <div className="flex-1 min-w-0">
            <h1
              ref={headingRef}
              tabIndex={-1}
              className={`text-lg font-bold ${t.textPrimary} outline-none`}
              style={{ fontFamily: "'Clash Display', sans-serif" }}
            >
              {workspace.launchKind === "source-game" ? "Game Analysis" : "Position Analysis"}
            </h1>
            {/* Game metadata */}
            {game && (
              <div className="flex items-center gap-2 flex-wrap mt-0.5">
                <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-md ${
                  isDark ? "bg-[#1e2e22] text-white/50" : "bg-[#ADBC9F]/40 text-[#436850]"
                }`}>
                  {game.provider === "lichess" ? "Lichess" : game.provider === "chesscom" ? "chess.com" : "ChessOTB"}
                </span>
                <span className={`text-xs ${t.textTertiary}`}>
                  {game.white} vs {game.black} · {game.result} · {game.playedAt}
                </span>
                {game.timeControl && (
                  <span className={`text-xs ${t.textTertiary}`}>{game.timeControl}</span>
                )}
                {game.opening && (
                  <span className={`text-xs ${t.textTertiary}`}>{game.opening.name}</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Evidence context strip */}
        {evidenceContext && (
          <div className={`px-3 py-2 rounded-xl text-xs ${
            isDark ? "bg-[#1e2e22]/60 text-white/60" : "bg-[#ADBC9F]/20 text-[#436850]"
          }`}>
            <span className="font-semibold">From Matchup Prep · </span>
            {evidenceContext.claim} ({evidenceContext.count}/{evidenceContext.denominator} games · {evidenceContext.dateFrom} – {evidenceContext.dateTo})
          </div>
        )}

        {/* Mode tabs */}
        <div
          className={`flex gap-1 p-1 rounded-2xl ${isDark ? "bg-[#0f1c11] border border-[#1e2e22]/70" : "bg-[#ADBC9F]/40/80 border border-[#ADBC9F]/60"}`}
          role="tablist"
          aria-label="Analysis mode"
        >
          <button
            role="tab"
            aria-selected={mode === "game-replay"}
            aria-controls="panel-game-replay"
            onClick={() => setMode("game-replay")}
            disabled={!canShowGameReplay}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-medium transition-all duration-150 min-h-[44px] ${
              mode === "game-replay"
                ? (isDark ? "bg-[#1e2e22] text-white border border-[#2a3e2e]" : "bg-white text-[#1a2e1e] border border-[#ADBC9F]/60 shadow-sm")
                : !canShowGameReplay
                ? (isDark ? "text-white/20" : "text-black/20")
                : (isDark ? "text-white/50 hover:text-white/70" : "text-black/50 hover:text-black/70")
            }`}
          >
            <Gamepad2 className="w-4 h-4" />
            Game replay
            {!canShowGameReplay && <span className={`text-[10px] ${isDark ? "text-white/30" : "text-black/30"}`}>(unavailable)</span>}
          </button>
          <button
            role="tab"
            aria-selected={mode === "position-analysis"}
            aria-controls="panel-position-analysis"
            onClick={() => setMode("position-analysis")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-medium transition-all duration-150 min-h-[44px] ${
              mode === "position-analysis"
                ? (isDark ? "bg-[#1e2e22] text-white border border-[#2a3e2e]" : "bg-white text-[#1a2e1e] border border-[#ADBC9F]/60 shadow-sm")
                : (isDark ? "text-white/50 hover:text-white/70" : "text-black/50 hover:text-black/70")
            }`}
          >
            <Target className="w-4 h-4" />
            Position analysis
          </button>
        </div>

        {/* ── Game Replay Panel ── */}
        <div
          id="panel-game-replay"
          role="tabpanel"
          aria-labelledby="tab-game-replay"
          hidden={mode !== "game-replay"}
        >
          {canShowGameReplay && (
            <div className="space-y-4">
              {/* Lichess game embed */}
              {hasLichessGameEmbed && gameEmbedResult?.ok && gameFallbackResult?.ok && (
                <div className={t.card + " p-4"}>
                  <p className={`text-xs mb-3 ${t.textTertiary}`}>
                    Official Lichess game replay — move list, result, and any attached analysis.
                  </p>
                  <LichessEmbed
                    embedUrl={gameEmbedResult.url}
                    title={`Lichess game: ${game?.white ?? "?"} vs ${game?.black ?? "?"}`}
                    fallbackUrl={gameFallbackResult.url}
                    fallbackLabel="Open game on Lichess"
                    minHeight={480}
                    isDark={isDark}
                  />
                </div>
              )}

              {/* Native PGN replay (non-Lichess or fallback) */}
              {!hasLichessGameEmbed && hasNativeGame && game && (
                <div className={t.card + " p-4"}>
                  <p className={`text-xs mb-3 ${t.textTertiary}`}>
                    Native game replay ({game.provider === "chesscom" ? "chess.com" : "ChessOTB"} game)
                  </p>
                  <div className="flex flex-col lg:flex-row gap-4">
                    <div className="shrink-0 w-full max-w-[320px] mx-auto lg:mx-0">
                      <Chessboard
                        options={{
                          position: currentFen ?? "start",
                          boardOrientation: orientation,
                          allowDragging: false,
                          boardStyle: { borderRadius: "12px" },
                        }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <MoveNav
                        sanBreadcrumb={sanBreadcrumb}
                        currentPly={currentPly}
                        onPly={handlePlyChange}
                        isDark={isDark}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Position Analysis Panel ── */}
        <div
          id="panel-position-analysis"
          role="tabpanel"
          aria-labelledby="tab-position-analysis"
          hidden={mode !== "position-analysis"}
        >
          <div className="space-y-4">
            {/* Native move controls */}
            {(game?.canonicalPgn || position.sanBreadcrumb.length > 0) && (
              <div className={t.card + " p-4"}>
                <div className="flex items-center justify-between mb-3">
                  <p className={`text-xs font-medium ${t.textSecondary}`}>
                    Select position — then analyze in Lichess
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleOrientationFlip}
                      className={`flex items-center gap-1.5 text-xs px-2 py-1.5 rounded-lg transition-colors ${
                        isDark ? "bg-white/8 text-white/60 hover:bg-white/12" : "bg-black/8 text-black/60 hover:bg-black/12"
                      }`}
                      aria-label="Flip board orientation"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Flip
                    </button>
                    <button
                      onClick={handleResetToSelected}
                      className={`flex items-center gap-1.5 text-xs px-2 py-1.5 rounded-lg transition-colors ${
                        isDark ? "bg-white/8 text-white/60 hover:bg-white/12" : "bg-black/8 text-black/60 hover:bg-black/12"
                      }`}
                      aria-label="Reset analysis board to selected position"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Reset to position
                    </button>
                  </div>
                </div>
                <MoveNav
                  sanBreadcrumb={sanBreadcrumb}
                  currentPly={currentPly}
                  onPly={handlePlyChange}
                  isDark={isDark}
                />
              </div>
            )}

            {/* Lichess analysis embed */}
            {analysisEmbedResult?.ok && analysisFallbackResult?.ok && (
              <div className={t.card + " p-4"}>
                <p className={`text-xs mb-3 ${t.textTertiary}`}>
                  Lichess analysis board — Stockfish engine and tablebase provided by Lichess.
                </p>
                <LichessEmbed
                  key={iframeKey}
                  embedUrl={analysisEmbedResult.url}
                  title={`Lichess analysis board for position after ${currentPly === 0 ? "starting position" : sanBreadcrumb[currentPly - 1] ?? "move " + currentPly}`}
                  fallbackUrl={analysisFallbackResult.url}
                  fallbackLabel="Open full analysis on Lichess"
                  minHeight={500}
                  isDark={isDark}
                />
              </div>
            )}

            {/* Fallback if embed URL failed validation */}
            {(!analysisEmbedResult?.ok) && (
              <div className={t.card + " p-4"}>
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="w-4 h-4 text-amber-400" />
                  <p className={`text-sm font-medium ${t.textSecondary}`}>Analysis embed unavailable</p>
                </div>
                <p className={`text-xs ${t.textTertiary} mb-3`}>
                  {analysisEmbedResult?.error ?? "Could not build a valid analysis URL for this position."}
                </p>
                {analysisFallbackResult?.ok && (
                  <a
                    href={analysisFallbackResult.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex items-center gap-1.5 text-sm px-4 py-2 rounded-xl font-medium transition-colors ${
                      isDark ? "bg-[#7ed957]/15 text-[#7ed957] hover:bg-[#7ed957]/25" : "bg-[#436850]/10 text-[#436850] hover:bg-[#436850]/20"
                    }`}
                  >
                    <ExternalLink className="w-4 h-4" />
                    Open full analysis on Lichess
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
