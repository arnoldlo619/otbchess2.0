/*
 * OTB Chess — Tournament Live Page
 * Design: "The Board Room" — Apple Minimalism + Chess.com Green
 * Dark Mode: Deep Forest Green CTA Aesthetic
 *
 * Layout:
 * - Top header: tournament name, status badge, meta info
 * - Left column (2/3): Round tabs + pairings boards
 * - Right column (1/3): Live standings leaderboard
 * - Bottom: Performance chart per player
 */

import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useTheme } from "@/contexts/ThemeContext";
import { toast } from "sonner";
import {
  DEMO_TOURNAMENT,
  getPlayerById,
  getStandings,
  getResultLabel,
  FLAG_EMOJI,
  type Result,
  type Player,
} from "@/lib/tournamentData";
import {
  Crown,
  ArrowLeft,
  Clock,
  MapPin,
  Calendar,
  Users,
  Trophy,
  Share2,
  Download,
  ChevronRight,
  Wifi,
  Circle,
  Sun,
  Moon,
  Shield,
  Printer,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

// ─── Helpers ─────────────────────────────────────────────────────────────────
function ELOBadge({ elo, size = "sm" }: { elo: number; size?: "sm" | "md" }) {
  const color =
    elo >= 2200 ? "text-purple-400 bg-purple-500/10 border-purple-500/20"
    : elo >= 2000 ? "text-amber-500 bg-amber-500/10 border-amber-500/20"
    : elo >= 1800 ? "text-sky-500 bg-sky-500/10 border-sky-500/20"
    : "text-slate-400 bg-slate-500/10 border-slate-500/20";

  return (
    <span
      className={`font-mono font-bold border rounded px-1.5 py-0.5 ${color} ${
        size === "md" ? "text-sm" : "text-xs"
      }`}
    >
      {elo}
    </span>
  );
}

function TitleBadge({ title }: { title?: string }) {
  if (!title) return null;
  return (
    <span className="text-xs font-bold text-[#3D6B47] bg-[#3D6B47]/10 border border-[#3D6B47]/20 px-1.5 py-0.5 rounded">
      {title}
    </span>
  );
}

function ResultPill({ result, perspective }: { result: Result; perspective: "white" | "black" }) {
  if (result === "*") {
    return (
      <span className="flex items-center gap-1 text-xs font-semibold text-amber-500">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
        Live
      </span>
    );
  }
  const { label, color } = getResultLabel(result, perspective);
  return <span className={`text-sm font-bold ${color}`}>{label}</span>;
}

function ScorePill({ points }: { points: number }) {
  const isHalf = points % 1 !== 0;
  return (
    <span
      className="font-mono font-bold text-lg text-foreground"
      style={{ fontFamily: "'JetBrains Mono', monospace" }}
    >
      {isHalf ? `${Math.floor(points)}½` : `${points}`}
    </span>
  );
}

// ─── Live Pulse Indicator ─────────────────────────────────────────────────────
function LiveBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
      Live · Round 4 of 5
    </span>
  );
}

// ─── Nav ─────────────────────────────────────────────────────────────────────
function TournamentNav() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <nav
      className={`sticky top-0 z-50 border-b transition-colors duration-300 ${
        isDark
          ? "bg-[oklch(0.20_0.06_145)]/95 backdrop-blur-md border-white/10"
          : "bg-white/95 backdrop-blur-md border-[#EEEED2]"
      }`}
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="container flex items-center justify-between h-14 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Link
            href="/"
            className="touch-target -ml-1 flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors flex-shrink-0 active:scale-95"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium hidden sm:block">Back</span>
          </Link>
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 bg-[#3D6B47] rounded flex items-center justify-center flex-shrink-0">
              <Crown className="w-3.5 h-3.5 text-white" strokeWidth={2} />
            </div>
            <span className="text-sm font-semibold text-foreground hidden sm:block truncate max-w-[130px]" style={{ fontFamily: "'Clash Display', sans-serif" }}>
              OTB Chess
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <LiveBadge />
          <ThemeToggle />
          <button
            onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success("Link copied!"); }}
            className={`touch-target flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-xl border transition-all active:scale-95 ${
              isDark
                ? "border-white/15 text-white/70 hover:bg-white/08"
                : "border-[#EEEED2] text-[#4B5563] hover:bg-[#F0F5EE]"
            }`}
          >
            <Share2 className="w-3.5 h-3.5" />
            <span className="hidden sm:block">Share</span>
          </button>
          <Link
            href={`/tournament/otb-demo-2026/manage`}
            className={`touch-target flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-xl border transition-all active:scale-95 ${
              isDark
                ? "border-[#4CAF50]/30 text-[#4CAF50] hover:bg-[#3D6B47]/20"
                : "border-[#3D6B47]/30 text-[#3D6B47] hover:bg-[#3D6B47]/08"
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span className="hidden sm:block">Director</span>
          </Link>
          <Link
            href={`/tournament/otb-demo-2026/print`}
            className={`hidden sm:flex touch-target items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-xl border transition-all active:scale-95 ${
              isDark
                ? "border-white/15 text-white/70 hover:bg-white/08"
                : "border-[#EEEED2] text-[#4B5563] hover:bg-[#F0F5EE]"
            }`}
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print</span>
          </Link>
        </div>
      </div>
    </nav>
  );
}

// ─── Tournament Header ────────────────────────────────────────────────────────
function TournamentHeader() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const t = DEMO_TOURNAMENT;

  return (
    <div className={`border-b transition-colors duration-300 ${isDark ? "border-white/10 bg-[oklch(0.22_0.06_145)]" : "border-[#EEEED2] bg-[#F0F5EE]"}`}>
      <div className="container py-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1
              className="text-2xl lg:text-3xl font-semibold text-foreground mb-2 tracking-tight"
              style={{ fontFamily: "'Clash Display', sans-serif" }}
            >
              {t.name}
            </h1>
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                {t.date}
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" />
                {t.venue}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                {t.timeControl}
              </span>
              <span className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                {t.players.length} players
              </span>
              <span className="flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5" />
                {t.format} · {t.rounds} rounds
              </span>
            </div>
          </div>

          {/* Progress */}
          <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${isDark ? "bg-[oklch(0.25_0.07_145)] border-white/10" : "bg-white border-[#EEEED2]"}`}>
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground" style={{ fontFamily: "'Clash Display', sans-serif" }}>
                {t.currentRound}
              </p>
              <p className="text-xs text-muted-foreground">Current</p>
            </div>
            <div className="flex gap-1">
              {Array.from({ length: t.rounds }).map((_, i) => (
                <div
                  key={i}
                  className={`h-2 rounded-full transition-all ${
                    i < t.currentRound - 1
                      ? "w-6 bg-[#3D6B47]"
                      : i === t.currentRound - 1
                      ? "w-6 bg-[#3D6B47] animate-pulse"
                      : isDark ? "w-6 bg-white/15" : "w-6 bg-[#EEEED2]"
                  }`}
                />
              ))}
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground" style={{ fontFamily: "'Clash Display', sans-serif" }}>
                {t.rounds}
              </p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Mobile Standings Accordion ─────────────────────────────────────────────
function MobileStandingsAccordion() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const standings = getStandings(DEMO_TOURNAMENT.players);
  const [open, setOpen] = useState(false);

  const medalColor = (rank: number) => {
    if (rank === 1) return "text-amber-400";
    if (rank === 2) return "text-slate-400";
    if (rank === 3) return "text-amber-600";
    return "text-muted-foreground";
  };

  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div className={`rounded-xl border overflow-hidden transition-colors duration-300 ${
      isDark ? "border-white/10 bg-[oklch(0.22_0.06_145)]" : "border-[#EEEED2] bg-white"
    }`}>
      {/* Header toggle */}
      <button
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center justify-between px-4 py-3 transition-colors ${
          isDark ? "hover:bg-white/04" : "hover:bg-[#F9FAF8]"
        }`}
      >
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-[#3D6B47]" />
          <span className="text-sm font-semibold text-foreground" style={{ fontFamily: "'Clash Display', sans-serif" }}>
            Standings
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            isDark ? "bg-white/10 text-white/50" : "bg-[#F0F5EE] text-[#6B7280]"
          }`}>
            After Round 3
          </span>
        </div>
        <div className={`flex items-center gap-2 text-xs text-muted-foreground`}>
          {/* Top 3 preview when collapsed */}
          {!open && (
            <div className="flex items-center gap-1.5">
              {standings.slice(0, 3).map((p, i) => (
                <span key={p.id} className="flex items-center gap-1">
                  <span className="text-sm">{medals[i]}</span>
                  <span className={`text-xs font-medium ${
                    isDark ? "text-white/70" : "text-[#374151]"
                  }`}>{p.name.split(" ")[0]}</span>
                </span>
              ))}
            </div>
          )}
          <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${
            open ? "rotate-90" : ""
          }`} />
        </div>
      </button>

      {/* Expanded standings cards */}
      {open && (
        <div className={`border-t ${
          isDark ? "border-white/08" : "border-[#EEEED2]"
        }`}>
          {standings.map((player, idx) => {
            const rank = idx + 1;
            const isLeader = rank === 1;
            return (
              <div
                key={player.id}
                className={`flex items-center gap-3 px-4 py-3 border-b last:border-0 transition-colors ${
                  isLeader
                    ? isDark
                      ? "bg-amber-500/05 border-white/06"
                      : "bg-amber-50/60 border-[#EEEED2]"
                    : isDark
                    ? "border-white/06 hover:bg-white/02"
                    : "border-[#F5F5F5] hover:bg-[#FAFAFA]"
                }`}
              >
                {/* Rank */}
                <span className={`text-sm font-bold w-6 text-center flex-shrink-0 ${medalColor(rank)}`}>
                  {rank <= 3 ? medals[rank - 1] : rank}
                </span>

                {/* Player info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-semibold text-foreground truncate">{player.name}</span>
                    {player.title && <TitleBadge title={player.title} />}
                    <span className="text-xs">{FLAG_EMOJI[player.country]}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <ELOBadge elo={player.elo} />
                    <span className="text-xs text-muted-foreground">
                      {player.wins}W {player.draws}D {player.losses}L
                    </span>
                    <span className="text-xs font-mono text-muted-foreground">Buch. {player.buchholz.toFixed(1)}</span>
                  </div>
                </div>

                {/* Score */}
                <div className="flex-shrink-0">
                  <ScorePill points={player.points} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Pairings Panel ───────────────────────────────────────────────────────────
function PairingsPanel() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [activeRound, setActiveRound] = useState(DEMO_TOURNAMENT.currentRound);
  const t = DEMO_TOURNAMENT;

  const round = t.roundData.find((r) => r.number === activeRound);

  return (
    <div className="flex flex-col gap-4">
      {/* Round Tabs */}
      <div className={`flex gap-1 p-1 rounded-xl ${isDark ? "bg-[oklch(0.25_0.07_145)]" : "bg-[#F0F5EE]"}`}>
        {t.roundData.map((r) => (
          <button
            key={r.number}
            onClick={() => setActiveRound(r.number)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium transition-all duration-200 ${
              activeRound === r.number
                ? "bg-[#3D6B47] text-white shadow-sm"
                : isDark
                ? "text-white/60 hover:text-white hover:bg-white/08"
                : "text-[#6B7280] hover:text-[#1A1A1A] hover:bg-white"
            }`}
          >
            R{r.number}
            {r.status === "in_progress" && (
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            )}
            {r.status === "completed" && (
              <span className={`w-1.5 h-1.5 rounded-full ${activeRound === r.number ? "bg-white/60" : "bg-[#3D6B47]"}`} />
            )}
          </button>
        ))}
        {/* Upcoming rounds */}
        {Array.from({ length: t.rounds - t.roundData.length }).map((_, i) => (
          <button
            key={`upcoming-${i}`}
            disabled
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium ${isDark ? "text-white/20" : "text-[#C4C4C4]"} cursor-not-allowed`}
          >
            R{t.roundData.length + i + 1}
          </button>
        ))}
      </div>

      {/* Round Status */}
      {round && (
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground" style={{ fontFamily: "'Clash Display', sans-serif" }}>
            Round {round.number} Pairings
          </h3>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
            round.status === "in_progress"
              ? "text-amber-600 bg-amber-500/10 border-amber-500/20"
              : round.status === "completed"
              ? isDark ? "text-white/50 bg-white/05 border-white/10" : "text-[#6B7280] bg-[#F0F5EE] border-[#EEEED2]"
              : "text-muted-foreground bg-muted border-border"
          }`}>
            {round.status === "in_progress" ? "In Progress" : round.status === "completed" ? "Completed" : "Upcoming"}
          </span>
        </div>
      )}

      {/* Game Cards */}
      {round?.games.map((game, idx) => {
        const white = getPlayerById(game.whiteId)!;
        const black = getPlayerById(game.blackId)!;
        const isLive = game.result === "*";

        return (
          <div
            key={game.id}
            className={`card-chess overflow-hidden transition-all duration-200 ${isLive ? "ring-1 ring-amber-400/30" : ""}`}
          >
            {/* Board number + status */}
            <div className={`flex items-center justify-between px-4 py-2 border-b text-xs font-medium ${
              isDark ? "border-white/08 bg-white/03" : "border-[#EEEED2] bg-[#F9FAF8]"
            }`}>
              <span className="text-muted-foreground">Board {game.board}</span>
              <div className="flex items-center gap-2">
                {isLive ? (
                  <span className="flex items-center gap-1 text-amber-500 font-semibold">
                    <Wifi className="w-3 h-3" />
                    Live
                  </span>
                ) : (
                  <span className="text-muted-foreground">{game.duration}</span>
                )}
              </div>
            </div>

            {/* Players */}
            <div className="p-4 space-y-3">
              {/* White */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    isDark ? "bg-white/90 border-white/20 text-[#1A1A1A]" : "bg-white border-[#EEEED2] text-[#1A1A1A]"
                  }`}>
                    ♔
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold text-foreground">{white.name}</span>
                      <TitleBadge title={white.title} />
                      <span className="text-xs">{FLAG_EMOJI[white.country]}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <ELOBadge elo={white.elo} />
                      <span className="text-xs text-muted-foreground">{white.points} pts</span>
                    </div>
                  </div>
                </div>
                <ResultPill result={game.result} perspective="white" />
              </div>

              {/* Divider */}
              <div className={`flex items-center gap-2 ${isDark ? "text-white/20" : "text-[#EEEED2]"}`}>
                <div className="flex-1 h-px bg-current" />
                <span className="text-xs text-muted-foreground font-medium">vs</span>
                <div className="flex-1 h-px bg-current" />
              </div>

              {/* Black */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    isDark ? "bg-[oklch(0.18_0.05_145)] border-white/15 text-white" : "bg-[#1A1A1A] border-[#333] text-white"
                  }`}>
                    ♚
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold text-foreground">{black.name}</span>
                      <TitleBadge title={black.title} />
                      <span className="text-xs">{FLAG_EMOJI[black.country]}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <ELOBadge elo={black.elo} />
                      <span className="text-xs text-muted-foreground">{black.points} pts</span>
                    </div>
                  </div>
                </div>
                <ResultPill result={game.result} perspective="black" />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Standings Panel ──────────────────────────────────────────────────────────
function StandingsPanel() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const standings = getStandings(DEMO_TOURNAMENT.players);

  const medalColor = (rank: number) => {
    if (rank === 1) return "text-amber-400";
    if (rank === 2) return "text-slate-400";
    if (rank === 3) return "text-amber-600";
    return "text-muted-foreground";
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground" style={{ fontFamily: "'Clash Display', sans-serif" }}>
          Standings
        </h3>
        <span className="text-xs text-muted-foreground">After Round 3</span>
      </div>

      {/* Header row */}
      <div className={`grid grid-cols-[1.5rem_1fr_auto_auto] gap-2 items-center px-3 py-2 rounded-lg text-xs font-semibold text-muted-foreground uppercase tracking-wider ${
        isDark ? "bg-white/05" : "bg-[#F0F5EE]"
      }`}>
        <span>#</span>
        <span>Player</span>
        <span className="text-center w-10">Pts</span>
        <span className="text-right w-12">Buch.</span>
      </div>

      {/* Player rows */}
      {standings.map((player, idx) => {
        const rank = idx + 1;
        const isLeader = rank === 1;

        return (
          <div
            key={player.id}
            className={`grid grid-cols-[1.5rem_1fr_auto_auto] gap-2 items-center px-3 py-3 rounded-xl border transition-all duration-200 hover:scale-[1.01] ${
              isLeader
                ? isDark
                  ? "border-amber-500/30 bg-amber-500/05"
                  : "border-amber-400/40 bg-amber-50/60"
                : isDark
                ? "border-white/08 bg-[oklch(0.25_0.07_145)] hover:border-white/15"
                : "border-[#EEEED2] bg-white hover:border-[#3D6B47]/20"
            }`}
          >
            {/* Rank */}
            <span className={`text-sm font-bold ${medalColor(rank)}`}>
              {rank <= 3 ? ["🥇", "🥈", "🥉"][rank - 1] : rank}
            </span>

            {/* Player info */}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-sm font-semibold text-foreground truncate">{player.name}</span>
                {player.title && <TitleBadge title={player.title} />}
              </div>
              <div className="flex items-center gap-1.5">
                <ELOBadge elo={player.elo} />
                <span className="text-xs">{FLAG_EMOJI[player.country]}</span>
                <span className="text-xs text-muted-foreground">
                  {player.wins}W {player.draws}D {player.losses}L
                </span>
              </div>
            </div>

            {/* Points */}
            <div className="w-10 flex justify-center">
              <ScorePill points={player.points} />
            </div>

            {/* Buchholz */}
            <div className="w-12 text-right">
              <span className="text-xs font-mono text-muted-foreground">{player.buchholz.toFixed(1)}</span>
            </div>
          </div>
        );
      })}

      {/* Legend */}
      <div className={`mt-2 px-3 py-2.5 rounded-lg text-xs text-muted-foreground space-y-1 border ${isDark ? "border-white/08 bg-white/03" : "border-[#EEEED2] bg-[#F9FAF8]"}`}>
        <p className="font-semibold text-foreground mb-1.5">Tiebreak: Buchholz</p>
        <p>Sum of opponents' scores. Higher = stronger opposition faced.</p>
      </div>
    </div>
  );
}

// ─── Performance Bars ─────────────────────────────────────────────────────────
function PerformanceSection() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const standings = getStandings(DEMO_TOURNAMENT.players);
  const maxPoints = Math.max(...standings.map((p) => p.points));

  return (
    <div className={`rounded-2xl border p-6 transition-colors duration-300 ${isDark ? "border-white/10 bg-[oklch(0.23_0.07_145)]" : "border-[#EEEED2] bg-[#F0F5EE]"}`}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-semibold text-foreground" style={{ fontFamily: "'Clash Display', sans-serif" }}>
          Score Distribution
        </h3>
        <span className="text-xs text-muted-foreground">After Round 3 · Max {maxPoints} pts</span>
      </div>

      <div className="space-y-3">
        {standings.map((player, idx) => {
          const pct = (player.points / (DEMO_TOURNAMENT.currentRound - 1)) * 100;
          return (
            <div key={player.id} className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-4 text-right">{idx + 1}</span>
              <div className="w-28 truncate">
                <span className="text-xs font-medium text-foreground">{player.name.split(" ")[0]}</span>
              </div>
              <div className="flex-1 relative h-5 flex items-center">
                <div className={`absolute inset-0 rounded-full ${isDark ? "bg-white/08" : "bg-[#EEEED2]"}`} />
                <div
                  className="absolute left-0 top-0 h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${pct}%`,
                    background: idx === 0
                      ? "linear-gradient(90deg, oklch(0.44 0.12 145), oklch(0.60 0.15 145))"
                      : isDark
                      ? "oklch(0.38 0.09 145)"
                      : "oklch(0.55 0.10 145 / 0.5)",
                  }}
                />
                <span className="relative z-10 pl-2 text-xs font-mono font-bold text-white mix-blend-luminosity">
                  {player.points % 1 !== 0 ? `${Math.floor(player.points)}½` : player.points}
                </span>
              </div>
              <ELOBadge elo={player.elo} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function TournamentPage() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  // Simulate live clock
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const formatElapsed = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  return (
    <div className={`min-h-screen transition-colors duration-500 ${isDark ? "bg-[oklch(0.20_0.06_145)]" : "bg-white"}`}>
      <TournamentNav />
      <TournamentHeader />

      {/* Live clock banner */}
      <div className="bg-[#3D6B47] py-2">
        <div className="container flex items-center justify-between">
          <div className="flex items-center gap-2 text-white/80 text-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            Round 4 in progress — 4 boards active
          </div>
          <div className="flex items-center gap-1.5 text-white text-xs font-mono font-bold">
            <Clock className="w-3.5 h-3.5 text-white/70" />
            {formatElapsed(elapsed + 5432)}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="container py-4 sm:py-8">
        {/* Mobile: Standings accordion above pairings */}
        <div className="block lg:hidden mb-4">
          <MobileStandingsAccordion />
        </div>

        <div className="grid lg:grid-cols-[1fr_380px] gap-8">
          {/* Left: Pairings */}
          <div>
            <PairingsPanel />
          </div>

          {/* Right: Standings — desktop only */}
          <div className="hidden lg:block">
            <StandingsPanel />
          </div>
        </div>

        {/* Performance section */}
        <div className="mt-8">
          <PerformanceSection />
        </div>
      </div>

      {/* Footer */}
      <footer className={`border-t py-6 mt-8 transition-colors duration-300 ${isDark ? "border-white/10" : "border-[#EEEED2]"}`}>
        <div className="container flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-[#3D6B47] rounded flex items-center justify-center">
              <Crown className="w-3 h-3 text-white" strokeWidth={2} />
            </div>
            <span>OTB Chess · Tournament Management Platform</span>
          </div>
          <div className="flex items-center gap-4">
            <span>Powered by chess.com API</span>
            <button onClick={() => toast.info("Feature coming soon")} className="hover:text-foreground transition-colors">
              Report Issue
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
