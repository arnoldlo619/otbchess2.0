/*
 * OTB Chess — Tournament Live Page
 * Design: "The Board Room" — Apple Minimalism + Chess.com Green
 * Dark Mode: Deep Forest Green CTA Aesthetic
 *
 * Data: Reads from localStorage via useDirectorState (same store as Director Dashboard).
 * Falls back to DEMO_TOURNAMENT when the URL id is "otb-demo-2026" or no real data exists.
 *
 * Layout:
 * - Top header: tournament name, status badge, meta info
 * - Left column (2/3): Round tabs + pairings boards
 * - Right column (1/3): Live standings leaderboard
 * - Bottom: Performance chart per player
 */

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Link, useParams, useLocation } from "wouter";
import { NavLogo } from "@/components/NavLogo";
import { MinimalTournamentNav } from "@/components/MinimalTournamentNav";
import { useTheme } from "@/contexts/ThemeContext";
import { toast } from "sonner";
import {
  DEMO_TOURNAMENT,
  getResultLabel,
  FLAG_EMOJI,
  type Result,
  type Player,
  type Round,
} from "@/lib/tournamentData";
import {
  loadTournamentState,
  type DirectorState,
} from "@/lib/directorState";
import { computeStandings } from "@/lib/swiss";
import { getTournamentConfig } from "@/lib/tournamentRegistry";
import { getRegistration } from "@/lib/registrationStore";
import { useVisibilitySync } from "@/lib/useVisibilitySync";
import { useSwipeGesture } from "@/hooks/useSwipeGesture";
import {
  Crown,
  ArrowLeft,
  Clock,
  MapPin,
  Calendar,
  Users,
  Trophy,
  Share2,
  ChevronRight,
  Wifi,
  WifiOff,
  Shield,
  Printer,
  Radio,
  Zap,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SpectatorTimerBanner } from "@/components/SpectatorTimerBanner";

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
function LiveBadge({ currentRound, totalRounds, status }: { currentRound: number; totalRounds: number; status: string }) {
  const isLive = status === "in_progress" || status === "paused";
  if (!isLive) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground bg-muted border border-border px-3 py-1.5 rounded-full">
        Completed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full">
      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
      Live · Round {currentRound} of {totalRounds}
    </span>
  );
}

// ─── Nav ─────────────────────────────────────────────────────────────────────
function TournamentNav({ tournamentId }: { tournamentId: string }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <nav
      className={`sticky top-[56px] z-40 border-b transition-colors duration-300 ${
        isDark
          ? "bg-[oklch(0.20_0.06_145)]/95 backdrop-blur-md border-white/10"
          : "bg-white/95 backdrop-blur-md border-[#EEEED2]"
      }`}
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="container flex items-center justify-between h-12 gap-3">
        {/* Left: logo on ultra-small screens only */}
        <div className="flex items-center gap-2 min-w-0">
          <NavLogo className="md:hidden" />
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success("Link copied!"); }}
            className={`touch-target flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-xl border transition-all active:scale-95 ${
              isDark
                ? "border-white/15 text-white/70 hover:bg-white/08"
                : "border-[#EEEED2] text-[#4B5563] hover:bg-[#F0F5EE]"
            }`}
          >
            <Share2 className="w-4 h-4" />
            <span className="hidden sm:block">Share</span>
          </button>
          <Link
            href={`/tournament/${tournamentId}/manage`}
            className={`touch-target flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-xl border transition-all active:scale-95 ${
              isDark
                ? "border-[#4CAF50]/30 text-[#4CAF50] hover:bg-[#3D6B47]/20"
                : "border-[#3D6B47]/30 text-[#3D6B47] hover:bg-[#3D6B47]/08"
            }`}
          >
            <Shield className="w-4 h-4" />
            <span className="hidden sm:block">Director</span>
          </Link>
          <Link
            href={`/tournament/${tournamentId}/print`}
            className={`hidden sm:flex touch-target items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-xl border transition-all active:scale-95 ${
              isDark
                ? "border-white/15 text-white/70 hover:bg-white/08"
                : "border-[#EEEED2] text-[#4B5563] hover:bg-[#F0F5EE]"
            }`}
          >
            <Printer className="w-4 h-4" />
            <span>Print</span>
          </Link>
        </div>
      </div>
    </nav>
  );
}

// ─── Tournament Header ────────────────────────────────────────────────────────
function TournamentHeader({
  name,
  date,
  venue,
  timeControl,
  playerCount,
  format,
  totalRounds,
  currentRound,
}: {
  name: string;
  date: string;
  venue: string;
  timeControl: string;
  playerCount: number;
  format: string;
  totalRounds: number;
  currentRound: number;
}) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <div className={`border-b transition-colors duration-300 ${isDark ? "border-white/10 bg-[oklch(0.22_0.06_145)]" : "border-[#EEEED2] bg-[#F0F5EE]"}`}>
      <div className="container py-6 sm:py-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="min-w-0">
            <h1
              className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-2 sm:mb-3 tracking-tight"
              style={{ fontFamily: "'Clash Display', sans-serif" }}
            >
              {name}
            </h1>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-sm text-muted-foreground">
              {date && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate max-w-[120px] sm:max-w-none">{date}</span>
                </span>
              )}
              {venue && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate max-w-[100px] sm:max-w-none">{venue}</span>
                </span>
              )}
              {timeControl && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                  {timeControl}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5 flex-shrink-0" />
                {playerCount} players
              </span>
              <span className="flex items-center gap-1">
                <Trophy className="w-3.5 h-3.5 flex-shrink-0" />
                {format} · {totalRounds}R
              </span>
            </div>
          </div>

          {/* Progress — hidden on mobile to save space */}
          <div className={`hidden md:flex items-center gap-3 px-4 py-3 rounded-xl border flex-shrink-0 ${isDark ? "bg-[oklch(0.25_0.07_145)] border-white/10" : "bg-white border-[#EEEED2]"}`}>
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground" style={{ fontFamily: "'Clash Display', sans-serif" }}>
                {currentRound}
              </p>
              <p className="text-xs text-muted-foreground">Round</p>
            </div>
            <div className="flex gap-1 flex-wrap max-w-[180px]">
              {Array.from({ length: totalRounds }).map((_, i) => (
                <div
                  key={i}
                  className={`h-2 rounded-full transition-all ${
                    i < currentRound - 1
                      ? "w-5 bg-[#3D6B47]"
                      : i === currentRound - 1
                      ? "w-5 bg-[#3D6B47] animate-pulse"
                      : isDark ? "w-5 bg-white/15" : "w-5 bg-[#EEEED2]"
                  }`}
                />
              ))}
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground" style={{ fontFamily: "'Clash Display', sans-serif" }}>
                {totalRounds}
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
function MobileStandingsAccordion({ players, rounds, myPlayerId }: { players: Player[]; rounds: Round[]; myPlayerId?: string }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const standingRows = useMemo(() => computeStandings(players, rounds), [players, rounds]);
  const [open, setOpen] = useState(false);
  // Tracks whether the participant's own row is currently visible in the list
  const [myRowVisible, setMyRowVisible] = useState(false);
  const myRowRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Derive the participant's rank row once
  const myRankEntry = useMemo(() => {
    if (!myPlayerId) return null;
    const idx = standingRows.findIndex((r) => r.player.id === myPlayerId);
    if (idx === -1) return null;
    return { rank: idx + 1, row: standingRows[idx] };
  }, [standingRows, myPlayerId]);

  // IntersectionObserver: hide chip when own row is in view, show when scrolled away
  useEffect(() => {
    if (!open || !myRowRef.current) {
      setMyRowVisible(false);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => setMyRowVisible(entry.isIntersecting),
      { threshold: 0.5 }
    );
    observer.observe(myRowRef.current);
    return () => observer.disconnect();
  }, [open, myRankEntry]);

  const scrollToMyRow = () => {
    myRowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const medalColor = (rank: number) => {
    if (rank === 1) return "text-amber-400";
    if (rank === 2) return "text-slate-400";
    if (rank === 3) return "text-amber-600";
    return "text-[#3D6B47]";
  };

  const medals = ["🥇", "🥈", "🥉"];

  const rankLabel = (rank: number) => (rank <= 3 ? medals[rank - 1] : `#${rank}`);

  return (
    <div className={`rounded-xl border transition-colors duration-300 ${
      open ? "overflow-visible" : "overflow-hidden"
    } ${
      isDark ? "border-white/10 bg-[oklch(0.22_0.06_145)]" : "border-[#EEEED2] bg-white"
    }`}>
      {/* Header toggle */}
      <button
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center justify-between px-5 py-4 transition-colors rounded-xl ${
          open ? "rounded-b-none" : ""
        } ${
          isDark ? "hover:bg-white/04" : "hover:bg-[#F9FAF8]"
        }`}
      >
        <div className="flex items-center gap-2.5">
          <Trophy className="w-5 h-5 text-[#3D6B47]" />
          <span className="text-base font-bold text-foreground" style={{ fontFamily: "'Clash Display', sans-serif" }}>
            Standings
          </span>
          <span className={`text-sm px-2.5 py-0.5 rounded-full ${
            isDark ? "bg-white/10 text-white/50" : "bg-[#F0F5EE] text-[#6B7280]"
          }`}>
            {standingRows.length} players
          </span>
        </div>
        <div className={`flex items-center gap-2 text-xs text-muted-foreground`}>
          {!open && (
            <div className="flex items-center gap-1.5">
              {standingRows.slice(0, 3).map((row, i) => (
                <span key={row.player.id} className="flex items-center gap-1">
                  <span className="text-sm">{medals[i]}</span>
                  <span className={`text-xs font-medium ${
                    isDark ? "text-white/70" : "text-[#374151]"
                  }`}>{row.player.name.split(" ")[0]}</span>
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
        <div
          ref={scrollContainerRef}
          className={`border-t ${
            isDark ? "border-white/08" : "border-[#EEEED2]"
          }`}
        >
          {standingRows.map((row, idx) => {
            const rank = idx + 1;
            const isLeader = rank === 1;
            const isMe = row.player.id === myPlayerId;
            return (
              <div
                key={row.player.id}
                ref={isMe ? myRowRef : undefined}
                className={`flex items-center gap-3 px-5 py-4 border-b last:border-0 transition-colors relative ${
                  isMe
                    ? isDark
                      ? "bg-[#3D6B47]/12 border-[#3D6B47]/30"
                      : "bg-[#F0F8F2] border-[#3D6B47]/20"
                    : isLeader
                    ? isDark
                      ? "bg-amber-500/05 border-white/06"
                      : "bg-amber-50/60 border-[#EEEED2]"
                    : isDark
                    ? "border-white/06 hover:bg-white/02"
                    : "border-[#F5F5F5] hover:bg-[#FAFAFA]"
                }`}
              >
                {/* Green left-border accent for participant's own row */}
                {isMe && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 rounded-r-full bg-[#3D6B47]" />
                )}
                <span className={`text-base font-bold w-7 text-center flex-shrink-0 ${medalColor(rank)}`}>
                  {rank <= 3 ? medals[rank - 1] : rank}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-base font-bold text-foreground truncate">{row.player.name}</span>
                    {row.player.title && <TitleBadge title={row.player.title} />}
                    <span className="text-sm">{FLAG_EMOJI[row.player.country] ?? ""}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <ELOBadge elo={row.player.elo} size="md" />
                    <span className="text-sm text-muted-foreground">
                      {row.wins}W {row.draws}D {row.losses}L
                    </span>
                    <span className="text-sm font-mono text-muted-foreground">Buch. {row.buchholz.toFixed(1)}</span>
                  </div>
                </div>
                <div className="flex-shrink-0">
                  <ScorePill points={row.points} />
                </div>
              </div>
            );
          })}

          {/* ── My Rank sticky chip ── */}
          {myRankEntry && !myRowVisible && (
            <div
              className={`sticky bottom-0 z-10 border-t ${
                isDark ? "border-[#3D6B47]/40" : "border-[#3D6B47]/25"
              }`}
            >
              <button
                onClick={scrollToMyRow}
                aria-label={`You are ranked ${myRankEntry.rank}. Tap to scroll to your position.`}
                className={`w-full flex items-center gap-3 px-5 py-3 transition-all active:scale-[0.98] ${
                  isDark
                    ? "bg-[oklch(0.20_0.07_145)] hover:bg-[oklch(0.23_0.07_145)]"
                    : "bg-[#F0F8F2] hover:bg-[#E6F3EA]"
                }`}
              >
                {/* Green left accent stripe */}
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#3D6B47]" />

                {/* "My Rank" label */}
                <span className={`text-xs font-semibold uppercase tracking-wider flex-shrink-0 ${
                  isDark ? "text-[#3D6B47]" : "text-[#3D6B47]"
                }`}>
                  My Rank
                </span>

                {/* Rank badge */}
                <span className={`text-base font-bold flex-shrink-0 ${
                  myRankEntry.rank <= 3 ? medalColor(myRankEntry.rank) : "text-[#3D6B47]"
                }`}>
                  {rankLabel(myRankEntry.rank)}
                </span>

                {/* Player name */}
                <span className={`flex-1 min-w-0 text-sm font-semibold truncate ${
                  isDark ? "text-white/90" : "text-[#1A2E1A]"
                }`}>
                  {myRankEntry.row.player.name}
                </span>

                {/* Score */}
                <span className={`flex-shrink-0 font-mono font-bold text-base ${
                  isDark ? "text-white" : "text-[#1A2E1A]"
                }`}>
                  {myRankEntry.row.points % 1 !== 0
                    ? `${Math.floor(myRankEntry.row.points)}½`
                    : `${myRankEntry.row.points}`}
                </span>

                {/* Scroll hint arrow */}
                <ChevronRight className="w-4 h-4 text-[#3D6B47] flex-shrink-0 rotate-[-90deg]" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Pairings Panel ───────────────────────────────────────────────────────────
function PairingsPanel({ players, rounds, totalRounds, currentRound, myPlayerId }: {
  players: Player[];
  rounds: Round[];
  totalRounds: number;
  currentRound: number;
  myPlayerId?: string;
}) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [activeRound, setActiveRound] = useState(currentRound);

  // Keep activeRound in sync if currentRound changes
  useEffect(() => {
    setActiveRound(currentRound);
  }, [currentRound]);

  const round = rounds.find((r) => r.number === activeRound);

  // Build a player lookup map from the real player list
  const playerMap = useMemo(() => {
    const map = new Map<string, Player>();
    players.forEach((p) => map.set(p.id, p));
    return map;
  }, [players]);

  // Ref map for each game card so we can scroll to the participant's game
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Auto-scroll to the participant's game card when the round or myPlayerId changes
  useEffect(() => {
    if (!myPlayerId || !round) return;
    const myGame = round.games.find(
      (g) => g.whiteId === myPlayerId || g.blackId === myPlayerId
    );
    if (!myGame) return;
    const el = cardRefs.current.get(myGame.id);
    if (el) {
      // Small delay so the DOM has settled after round tab switch
      setTimeout(() => {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 120);
    }
  }, [myPlayerId, activeRound, round]);

  return (
    <div className="flex flex-col gap-4">
      {/* Round Tabs — scrollable on mobile */}
      <div className={`flex gap-1.5 p-1.5 rounded-2xl overflow-x-auto scrollbar-none ${isDark ? "bg-[oklch(0.25_0.07_145)]" : "bg-[#F0F5EE]"}`}>
        {rounds.map((r) => (
          <button
            key={r.number}
            onClick={() => setActiveRound(r.number)}
            className={`flex-shrink-0 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all duration-200 active:scale-95 ${
              activeRound === r.number
                ? "bg-[#3D6B47] text-white shadow-sm"
                : isDark
                ? "text-white/60 hover:text-white hover:bg-white/08"
                : "text-[#6B7280] hover:text-[#1A1A1A] hover:bg-white"
            }`}
          >
            R{r.number}
            {r.status === "in_progress" && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            )}
            {r.status === "completed" && (
              <span className={`w-2 h-2 rounded-full ${activeRound === r.number ? "bg-white/60" : "bg-[#3D6B47]"}`} />
            )}
          </button>
        ))}
        {/* Upcoming rounds */}
        {Array.from({ length: totalRounds - rounds.length }).map((_, i) => (
          <button
            key={`upcoming-${i}`}
            disabled
            className={`flex-shrink-0 py-2.5 px-4 rounded-xl text-sm font-medium ${isDark ? "text-white/20" : "text-[#C4C4C4]"} cursor-not-allowed`}
          >
            R{rounds.length + i + 1}
          </button>
        ))}
      </div>

      {/* Round Status */}
      {round && (
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-foreground" style={{ fontFamily: "'Clash Display', sans-serif" }}>
            Round {round.number} Pairings
          </h3>
          <span className={`text-sm font-semibold px-3 py-1.5 rounded-full border ${
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

      {/* Empty state */}
      {!round && (
        <div className={`text-center py-12 rounded-xl border border-dashed ${isDark ? "border-white/10 text-white/30" : "border-gray-200 text-gray-400"}`}>
          <Trophy className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No pairings yet for this round</p>
        </div>
      )}

      {/* Game Cards */}
      {round?.games.map((game) => {
        const white = playerMap.get(game.whiteId);
        const black = playerMap.get(game.blackId);
        if (!white || !black) return null;
        const isLive = game.result === "*";
        const isMyGame = !!myPlayerId && (game.whiteId === myPlayerId || game.blackId === myPlayerId);
        return (
          <div
            key={game.id}
            ref={(el) => {
              if (el) cardRefs.current.set(game.id, el);
              else cardRefs.current.delete(game.id);
            }}
            className={`card-chess overflow-hidden transition-all duration-200 ${
              isMyGame
                ? "my-game-highlight"
                : isLive
                ? "ring-1 ring-amber-400/30"
                : ""
            }`}
          >
            {/* Board number + status */}
            <div className={`flex items-center justify-between px-5 py-3 border-b text-sm font-semibold ${
              isMyGame
                ? isDark ? "border-[#3D6B47]/40 bg-[#3D6B47]/10" : "border-[#3D6B47]/20 bg-[#F0F8F2]"
                : isDark ? "border-white/08 bg-white/03" : "border-[#EEEED2] bg-[#F9FAF8]"
            }`}>
              <div className="flex items-center gap-2">
                <span className={`tracking-widest uppercase ${isDark ? "text-white/50" : "text-gray-500"}`}>Board {game.board}</span>
                {isMyGame && (
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    isDark ? "bg-[#3D6B47]/30 text-emerald-400" : "bg-[#3D6B47]/10 text-[#3D6B47]"
                  }`}>
                    Your Game
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {isLive ? (
                  <span className="flex items-center gap-1.5 text-amber-500 font-bold">
                    <Wifi className="w-4 h-4" />
                    Live
                  </span>
                ) : (
                  <span className="text-muted-foreground">{game.duration ?? ""}</span>
                )}
              </div>
            </div>
            {/* Players */}
            <div className="p-4 sm:p-5 space-y-4">
              {/* White */}
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl border-2 flex items-center justify-center text-base font-bold flex-shrink-0 ${
                  isDark ? "bg-white/90 border-white/20 text-[#1A1A1A]" : "bg-white border-[#EEEED2] text-[#1A1A1A]"
                }`}>
                  ♝
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-base font-bold text-foreground truncate">{white.name}</span>
                    {white.title && <TitleBadge title={white.title} />}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <ELOBadge elo={white.elo} size="md" />
                  </div>
                </div>
                <div className="flex-shrink-0">
                  <ResultPill result={game.result} perspective="white" />
                </div>
              </div>
              {/* Divider */}
              <div className={`flex items-center gap-3 ${isDark ? "text-white/20" : "text-[#EEEED2]"}`}>
                <div className="flex-1 h-px bg-current" />
                <span className="text-sm text-muted-foreground font-semibold">vs</span>
                <div className="flex-1 h-px bg-current" />
              </div>
              {/* Black */}
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl border-2 flex items-center justify-center text-base font-bold flex-shrink-0 ${
                  isDark ? "bg-[oklch(0.18_0.05_145)] border-white/15 text-white" : "bg-[#1A1A1A] border-[#333] text-white"
                }`}>
                  ♚
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-base font-bold text-foreground truncate">{black.name}</span>
                    {black.title && <TitleBadge title={black.title} />}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <ELOBadge elo={black.elo} size="md" />
                  </div>
                </div>
                <div className="flex-shrink-0">
                  <ResultPill result={game.result} perspective="black" />
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Standings Panel ──────────────────────────────────────────────────────────
function StandingsPanel({ players, rounds, myPlayerId, format }: { players: Player[]; rounds: Round[]; myPlayerId?: string; format?: string }) {
  const isDoubleSwiss = format === "doubleswiss";
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const standingRows = useMemo(() => computeStandings(players, rounds), [players, rounds]);

  const medalColor = (rank: number) => {
    if (rank === 1) return "text-amber-400";
    if (rank === 2) return "text-slate-400";
    if (rank === 3) return "text-amber-600";
    return "text-muted-foreground";
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-foreground" style={{ fontFamily: "'Clash Display', sans-serif" }}>
          Standings
        </h3>
        <span className="text-sm text-muted-foreground">{standingRows.length} players</span>
      </div>

      {/* Header row */}
      <div className={`grid ${isDoubleSwiss ? "grid-cols-[2rem_1fr_auto_auto_auto]" : "grid-cols-[2rem_1fr_auto_auto]"} gap-3 items-center px-4 py-2.5 rounded-xl text-xs font-bold text-muted-foreground uppercase tracking-wider ${
        isDark ? "bg-white/05" : "bg-[#F0F5EE]"
      }`}>
        <span>#</span>
        <span>Player</span>
        <span className="text-center w-12">Pts</span>
        {isDoubleSwiss && <span className="text-right w-14">Match</span>}
        <span className="text-right w-14">Buch.</span>
      </div>

      {/* Player rows */}
      {standingRows.map((row, idx) => {
        const rank = idx + 1;
        const isLeader = rank === 1;

        return (
          <div
            key={row.player.id}
            className={`grid ${isDoubleSwiss ? "grid-cols-[2rem_1fr_auto_auto_auto]" : "grid-cols-[2rem_1fr_auto_auto]"} gap-3 items-center px-4 py-4 rounded-2xl border transition-all duration-200 hover:scale-[1.01] relative overflow-hidden ${
              row.player.id === myPlayerId
                ? isDark
                  ? "border-[#3D6B47]/50 bg-[#3D6B47]/10 ring-1 ring-[#3D6B47]/30"
                  : "border-[#3D6B47]/30 bg-[#F0F8F2] ring-1 ring-[#3D6B47]/20"
                : isLeader
                ? isDark
                  ? "border-amber-500/30 bg-amber-500/05"
                  : "border-amber-400/40 bg-amber-50/60"
                : isDark
                ? "border-white/08 bg-[oklch(0.25_0.07_145)] hover:border-white/15"
                : "border-[#EEEED2] bg-white hover:border-[#3D6B47]/20"
            }`}
          >
            {/* Green left-border accent for participant's own row */}
            {row.player.id === myPlayerId && (
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#3D6B47] rounded-r-sm" />
            )}
            {/* Rank */}
            <span className={`text-base font-bold ${medalColor(rank)}`}>
              {rank <= 3 ? ["🥇", "🥈", "🥉"][rank - 1] : rank}
            </span>

            {/* Player info */}
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-base font-bold text-foreground truncate">{row.player.name}</span>
                {row.player.title && <TitleBadge title={row.player.title} />}
              </div>
              <div className="flex items-center gap-2">
                <ELOBadge elo={row.player.elo} size="md" />
                <span className="text-sm">{FLAG_EMOJI[row.player.country] ?? ""}</span>
                <span className="text-sm text-muted-foreground">
                  {row.wins}W {row.draws}D {row.losses}L
                </span>
              </div>
            </div>

            {/* Points */}
            <div className="w-12 flex justify-center">
              <ScorePill points={row.points} />
            </div>

            {/* Match W/D/L — Double Swiss only */}
            {isDoubleSwiss && (
              <div className="w-14 text-right">
                <span className={`text-sm font-mono font-semibold ${
                  row.matchW > row.matchL
                    ? isDark ? "text-emerald-400" : "text-emerald-600"
                    : row.matchL > row.matchW
                    ? isDark ? "text-red-400" : "text-red-500"
                    : "text-muted-foreground"
                }`}>{row.matchW}/{row.matchD}/{row.matchL}</span>
              </div>
            )}

            {/* Buchholz */}
            <div className="w-14 text-right">
              <span className="text-sm font-mono text-muted-foreground">{row.buchholz.toFixed(1)}</span>
            </div>
          </div>
        );
      })}

      {/* Legend */}
      <div className={`mt-2 px-4 py-3 rounded-xl text-sm text-muted-foreground space-y-1 border ${isDark ? "border-white/08 bg-white/03" : "border-[#EEEED2] bg-[#F9FAF8]"}`}>
        <p className="font-semibold text-foreground mb-1">Tiebreak: Buchholz</p>
        <p>Sum of opponents' scores. Higher = stronger opposition faced.</p>
      </div>
    </div>
  );
}

// ─── Performance Bars ─────────────────────────────────────────────────────────
function PerformanceSection({ players, rounds, currentRound }: { players: Player[]; rounds: Round[]; currentRound: number }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const standingRows = useMemo(() => computeStandings(players, rounds), [players, rounds]);
  const maxPoints = standingRows.length > 0 ? Math.max(...standingRows.map((r) => r.points)) : 1;
  const completedRounds = Math.max(1, currentRound - 1);

  if (standingRows.length === 0) return null;

  return (
    <div className={`rounded-2xl border p-5 transition-colors duration-300 ${isDark ? "border-white/10 bg-[oklch(0.23_0.07_145)]" : "border-[#EEEED2] bg-[#F0F5EE]"}`}>
      <div className="flex items-center justify-between mb-4 gap-2">
        <h3 className="font-semibold text-foreground flex-shrink-0" style={{ fontFamily: "'Clash Display', sans-serif" }}>
          Score Distribution
        </h3>
        <span className="text-xs text-muted-foreground text-right">After Round {completedRounds} · Max {maxPoints} pts</span>
      </div>

      <div className="space-y-2.5">
        {standingRows.map((row, idx) => {
          const pct = maxPoints > 0 ? (row.points / maxPoints) * 100 : 0;
          return (
            <div key={row.player.id} className="flex items-center gap-2 min-w-0">
              <span className="text-xs text-muted-foreground w-4 text-right flex-shrink-0">{idx + 1}</span>
              <div className="w-16 sm:w-24 flex-shrink-0 truncate">
                <span className="text-xs font-medium text-foreground">{row.player.name.split(" ")[0]}</span>
              </div>
              {/* Bar track — flex-1 with overflow-hidden so bars never escape */}
              <div className="flex-1 min-w-0 relative h-5 flex items-center overflow-hidden rounded-full">
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
                  {row.points % 1 !== 0 ? `${Math.floor(row.points)}½` : row.points}
                </span>
              </div>
              <div className="flex-shrink-0">
                <ELOBadge elo={row.player.elo} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Registration Waiting State ───────────────────────────────────────────────
function RegistrationState({ tournamentName, playerCount, tournamentId }: { tournamentName: string; playerCount: number; tournamentId: string }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const reg = getRegistration(tournamentId);
  return (
    <div className={`min-h-[60vh] flex items-center justify-center ${isDark ? "bg-[oklch(0.20_0.06_145)]" : "bg-white"}`}>
      <div className="text-center max-w-md px-6">
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 ${isDark ? "bg-[#3D6B47]/20" : "bg-[#3D6B47]/10"}`}>
          <Trophy className={`w-8 h-8 ${isDark ? "text-[#4CAF50]" : "text-[#3D6B47]"}`} />
        </div>
        <h2 className="text-xl font-bold text-foreground mb-2" style={{ fontFamily: "'Clash Display', sans-serif" }}>
          {tournamentName}
        </h2>
        <p className="text-muted-foreground text-sm mb-4">
          Registration is open · {playerCount} player{playerCount !== 1 ? "s" : ""} registered
        </p>
        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium mb-4 ${isDark ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" : "bg-amber-50 text-amber-700 border border-amber-200"}`}>
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          Waiting for tournament to start
        </div>
        {reg && (
          <div className="mt-2">
            <Link
              href={`/tournament/${tournamentId}/play?username=${encodeURIComponent(reg.username)}`}
              className={`inline-flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-semibold transition-all active:scale-95 ${
                isDark
                  ? "bg-[#3D6B47] text-white hover:bg-[#4CAF50]"
                  : "bg-[#3D6B47] text-white hover:bg-[#2A4A32]"
              }`}
            >
              <Crown className="w-4 h-4" />
              Go to My Board
            </Link>
            <p className={`text-xs mt-2 ${isDark ? "text-white/40" : "text-gray-400"}`}>
              Registered as @{reg.username}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── SSE Connection Badge ────────────────────────────────────────────────────
function SSEConnectionBadge({ connected }: { connected: boolean }) {
  if (connected) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-white/90 bg-white/10 border border-white/20 px-2.5 py-1 rounded-full">
        <Radio className="w-3 h-3 text-emerald-300" />
        Live
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-200 bg-amber-500/20 border border-amber-400/30 px-2.5 py-1 rounded-full">
      <WifiOff className="w-3 h-3" />
      Reconnecting
    </span>
  );
}

// ─── Round Progress Bar ───────────────────────────────────────────────────────
function RoundProgressBar({ rounds, currentRound, isDark }: { rounds: Round[]; currentRound: number; isDark: boolean }) {
  const currentRoundData = rounds.find((r) => r.number === currentRound);
  if (!currentRoundData) return null;
  const total = currentRoundData.games.length;
  const done = currentRoundData.games.filter((g) => g.result !== "*").length;
  if (total === 0) return null;
  const pct = Math.round((done / total) * 100);
  return (
    <div className="container pt-2 pb-1">
      <div className="flex items-center gap-3">
        <div className={`flex-1 h-1.5 rounded-full overflow-hidden ${isDark ? "bg-white/10" : "bg-black/10"}`}>
          <div
            className="h-full bg-white/70 rounded-full transition-all duration-700 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-xs text-white/70 font-mono flex-shrink-0">{done}/{total} boards</span>
      </div>
    </div>
  );
}

// ─── New Round Flash Banner ───────────────────────────────────────────────────
function NewRoundFlash({ round, onDismiss }: { round: number; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 5000);
    return () => clearTimeout(t);
  }, [onDismiss]);
  return (
    <div className="fixed top-20 inset-x-0 z-50 flex justify-center pointer-events-none px-4">
      <div className="pointer-events-auto flex items-center gap-3 bg-[#3D6B47] text-white px-5 py-3 rounded-2xl shadow-2xl border border-white/20 animate-in slide-in-from-top-4 duration-300">
        <Zap className="w-5 h-5 text-emerald-300 flex-shrink-0" />
        <span className="font-bold text-base">Round {round} pairings are live!</span>
        <button onClick={onDismiss} className="ml-2 text-white/60 hover:text-white text-lg leading-none">×</button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function TournamentPage() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const { id } = useParams<{ id: string }>();
  const tournamentId = id ?? "otb-demo-2026";

  // Load real tournament state from localStorage; fall back to demo data
  const [tournamentState, setTournamentState] = useState<DirectorState | null>(() => {
    return loadTournamentState(tournamentId);
  });
  // Track whether we are still waiting for the server catch-up fetch.
  // While true (and tournamentState is null), show a loading spinner instead of demo data.
  const [serverFetching, setServerFetching] = useState(
    tournamentId !== "otb-demo-2026"
  );

  // SSE connection state
  const [sseConnected, setSseConnected] = useState(false);
  // Flash banner state for new round notifications
  const [newRoundFlash, setNewRoundFlash] = useState<number | null>(null);
  const dismissFlash = useCallback(() => setNewRoundFlash(null), []);
  // Live timer snapshot — updated via SSE timer_update events
  const [timerSnapshot, setTimerSnapshot] = useState<{
    status: "idle" | "running" | "paused" | "expired";
    durationSec: number;
    startWallMs: number;
    elapsedAtPauseMs: number;
    savedAt: number;
  } | null>(null);

  // ── Auto-redirect to report page when tournament ends ──────────────────────
  const [, navigate] = useLocation();
  const hasRedirectedRef = useRef(false);
  useEffect(() => {
    if (
      !hasRedirectedRef.current &&
      tournamentState?.status === "completed" &&
      tournamentId !== "otb-demo-2026"
    ) {
      hasRedirectedRef.current = true;
      // Brief delay so the "Tournament Complete" state is visible before redirect
      const t = setTimeout(() => {
        // Set a flag so the Report page can show a celebratory toast on arrival
        sessionStorage.setItem(`otb_redirect_complete_${tournamentId}`, "1");
        navigate(`/tournament/${tournamentId}/report`);
      }, 2500);
      return () => clearTimeout(t);
    }
  }, [tournamentState?.status, tournamentId, navigate]);

  // ── SSE: connect to server for live standings + round updates ──────────────
  useEffect(() => {
    // Demo tournament has no server state — skip SSE
    if (tournamentId === "otb-demo-2026") return;

    // Catch-up fetch: load timer snapshot on mount
    fetch(`/api/tournament/${encodeURIComponent(tournamentId)}/timer`)
      .then((r) => r.ok ? r.json() : null)
      .then((snap) => { if (snap) setTimerSnapshot(snap); })
      .catch(() => { /* silent */ });

    // Catch-up fetch: load the freshest state immediately on mount.
    // CRITICAL: if tournamentState is null (fresh device, no localStorage),
    // we must construct a full DirectorState from the server response so
    // spectators on other devices see the real tournament, not demo data.
    fetch(`/api/tournament/${encodeURIComponent(tournamentId)}/live-state`)
      .then((r) => r.ok ? r.json() : null)
      .then((data: { players?: Player[]; status?: string; currentRound?: number; totalRounds?: number; tournamentName?: string; games?: Round["games"]; rounds?: Round[] } | null) => {
        setServerFetching(false);
        if (!data) return;
        setTournamentState((prev) => {
          if (prev) {
            // Already have local state — patch server fields and merge rounds
            const serverRounds = (data.rounds as Round[] | undefined) ?? [];
            const mergedRounds = serverRounds.length > 0 ? serverRounds : prev.rounds;
            return {
              ...prev,
              players: (data.players as Player[]) ?? prev.players,
              status: (data.status as DirectorState["status"]) ?? prev.status,
              currentRound: data.currentRound ?? prev.currentRound,
              totalRounds: data.totalRounds ?? prev.totalRounds,
              tournamentName: data.tournamentName ?? prev.tournamentName,
              rounds: mergedRounds,
            };
          }
          // No local state — build a full DirectorState from server data
          // so spectators on fresh devices see the real tournament.
          const serverRounds = (data.rounds as Round[] | undefined) ?? [];
          const currentRoundNum = data.currentRound ?? 0;
          // Fall back to constructing a single round from games if rounds not provided
          const rounds: Round[] = serverRounds.length > 0
            ? serverRounds
            : currentRoundNum > 0
              ? [{ number: currentRoundNum, status: "in_progress" as const, games: data.games ?? [] }]
              : [];
          return {
            tournamentId,
            tournamentName: data.tournamentName ?? "",
            status: (data.status as DirectorState["status"]) ?? "registration",
            currentRound: currentRoundNum,
            totalRounds: data.totalRounds ?? 0,
            players: (data.players as Player[]) ?? [],
            rounds,
            timer: null,
          } as unknown as DirectorState;
        });
      })
      .catch(() => {
        setServerFetching(false);
        /* silent — localStorage fallback is already loaded if available */
      });

    // Open SSE stream
    const es = new EventSource(`/api/tournament/${encodeURIComponent(tournamentId)}/stream`);

    es.onopen = () => setSseConnected(true);
    es.onerror = () => setSseConnected(false);

    // standings_updated: director entered a result → update players list
    es.addEventListener("standings_updated", (e: MessageEvent) => {
      try {
        const payload = JSON.parse(e.data) as {
          players: Player[];
          currentRound: number;
          status: string;
        };
        setSseConnected(true);
        setTournamentState((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            players: payload.players,
            currentRound: payload.currentRound,
            status: payload.status as DirectorState["status"],
          };
        });
      } catch { /* ignore malformed */ }
    });

    // round_started: director generated next round → update rounds + players
    es.addEventListener("round_started", (e: MessageEvent) => {
      try {
        const payload = JSON.parse(e.data) as {
          round: number;
          games: Round["games"];
          players: Player[];
        };
        setSseConnected(true);
        setNewRoundFlash(payload.round);
        setTournamentState((prev) => {
          if (!prev) return prev;
          const existingRounds = prev.rounds.filter((r) => r.number !== payload.round);
          const newRound: Round = {
            number: payload.round,
            status: "in_progress",
            games: payload.games,
          };
          return {
            ...prev,
            players: payload.players,
            currentRound: payload.round,
            rounds: [...existingRounds, newRound].sort((a, b) => a.number - b.number),
          };
        });
      } catch { /* ignore malformed */ }
    });

    // timer_update: director started/paused/reset/expired timer → update spectator display
    es.addEventListener("timer_update", (e: MessageEvent) => {
      try {
        const snap = JSON.parse(e.data);
        setSseConnected(true);
        setTimerSnapshot(snap);
      } catch { /* ignore malformed */ }
    });

    // tournament_ended: director ended tournament → mark complete
    es.addEventListener("tournament_ended", (e: MessageEvent) => {
      try {
        const payload = JSON.parse(e.data) as { players: Player[] };
        setSseConnected(true);
        setTournamentState((prev) => {
          if (!prev) return prev;
          return { ...prev, players: payload.players, status: "completed" };
        });
      } catch { /* ignore malformed */ }
    });

    return () => es.close();
  }, [tournamentId]);

  // Re-sync from localStorage when the tab regains visibility (phone unlock, app switch)
  // This is a fallback for the demo and for when SSE is not available.
  useVisibilitySync(() => {
    const fresh = loadTournamentState(tournamentId);
    if (fresh) setTournamentState(fresh);
  });

  // Listen for real-time updates from the Director Dashboard (storage events)
  // This handles the case where the director and spectator are on the same device.
  useEffect(() => {
    function handleStorage(e: StorageEvent) {
      if (e.key === `otb-director-${tournamentId}` && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed.state) setTournamentState(parsed.state as DirectorState);
        } catch { /* ignore */ }
      }
    }
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [tournamentId]);

  // Get extra config (venue, date, timePreset) from registry
  const config = getTournamentConfig(tournamentId);

  // Build display data — prefer real state, fall back to DEMO_TOURNAMENT
  const isDemo = tournamentId === "otb-demo-2026" && !tournamentState;
  const displayState = tournamentState ?? {
    tournamentId: DEMO_TOURNAMENT.id,
    tournamentName: DEMO_TOURNAMENT.name,
    totalRounds: DEMO_TOURNAMENT.rounds,
    players: DEMO_TOURNAMENT.players,
    rounds: DEMO_TOURNAMENT.roundData,
    currentRound: DEMO_TOURNAMENT.currentRound,
    status: DEMO_TOURNAMENT.status as DirectorState["status"],
  };

  const displayName = displayState.tournamentName;
  const displayDate = config?.date ?? (isDemo ? DEMO_TOURNAMENT.date : "");
  const displayVenue = config?.venue ?? (isDemo ? DEMO_TOURNAMENT.venue : "");
  const displayTimeControl = config?.timePreset ?? (isDemo ? DEMO_TOURNAMENT.timeControl : "");
  const displayFormat = config?.format
    ? config.format === "doubleswiss" ? "Double Swiss"
    : config.format === "roundrobin" ? "Round Robin"
    : config.format.charAt(0).toUpperCase() + config.format.slice(1)
    : (isDemo ? DEMO_TOURNAMENT.format : "Swiss");

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

  const liveGames = displayState.rounds
    .find((r) => r.number === displayState.currentRound)
    ?.games.filter((g) => g.result === "*").length ?? 0;

  // Mobile tab state for Pairings / Standings / Players
  type MobileTab = "pairings" | "standings" | "players";
  const MOBILE_TABS: MobileTab[] = ["pairings", "standings", "players"];
  const [mobileTab, setMobileTab] = useState<MobileTab>("pairings");
  const [swipeFlash, setSwipeFlash] = useState<"left" | "right" | null>(null);

  const navigateMobileTab = useCallback((direction: "prev" | "next") => {
    const idx = MOBILE_TABS.indexOf(mobileTab);
    const nextIdx = direction === "prev" ? idx - 1 : idx + 1;
    if (nextIdx < 0 || nextIdx >= MOBILE_TABS.length) return;
    setMobileTab(MOBILE_TABS[nextIdx]);
    setSwipeFlash(direction === "prev" ? "right" : "left");
    setTimeout(() => setSwipeFlash(null), 350);
  }, [mobileTab]);

  const swipeContainerRef = useRef<HTMLDivElement>(null);
  useSwipeGesture(swipeContainerRef, {
    threshold: 60,
    maxVerticalDrift: 80,
    onSwipeRight: () => navigateMobileTab("prev"),
    onSwipeLeft: () => navigateMobileTab("next"),
  });

  // Identify the viewing participant — look up their registration in localStorage
  const myPlayerId = useMemo(() => {
    const reg = getRegistration(tournamentId);
    if (!reg) return undefined;
    // Match by username (case-insensitive) against the player list
    const match = displayState.players.find(
      (p) => p.username?.toLowerCase() === reg.username.toLowerCase()
    );
    return match?.id;
  }, [tournamentId, displayState.players]);

  // While the server fetch is in flight and we have no local state,
  // show a minimal loading screen instead of demo data.
  if (serverFetching && !tournamentState && tournamentId !== "otb-demo-2026") {
    return (
      <div className={`min-h-screen flex flex-col transition-colors duration-500 ${isDark ? "bg-[oklch(0.20_0.06_145)]" : "bg-white"}`}>
        <MinimalTournamentNav
          tournamentName={displayName}
          backHref="/"
          backLabel="Home"
          centerSlot={
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success("Link copied!"); }}
                className={`touch-target flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-xl border transition-all active:scale-95 ${
                  isDark
                    ? "border-white/15 text-white/70 hover:bg-white/08"
                    : "border-black/15 text-black/60 hover:bg-black/05"
                }`}
              >
                <Share2 className="w-4 h-4" />
                <span className="hidden sm:block">Share</span>
              </button>
              <Link
                href={`/tournament/${tournamentId}/manage`}
                className={`touch-target flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-xl border transition-all active:scale-95 ${
                  isDark
                    ? "border-[#4CAF50]/30 text-[#4CAF50] hover:bg-[#3D6B47]/20"
                    : "border-[#3D6B47]/30 text-[#3D6B47] hover:bg-[#3D6B47]/08"
                }`}
              >
                <Shield className="w-4 h-4" />
                <span className="hidden sm:block">Director</span>
              </Link>
              <Link
                href={`/tournament/${tournamentId}/print`}
                className={`hidden sm:flex touch-target items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-xl border transition-all active:scale-95 ${
                  isDark
                    ? "border-white/15 text-white/70 hover:bg-white/08"
                    : "border-black/15 text-black/60 hover:bg-black/05"
                }`}
              >
                <Printer className="w-4 h-4" />
                <span>Print</span>
              </Link>
            </div>
          }
        />
        <div style={{ height: 56 }} aria-hidden />
        <div className="flex-1 flex flex-col items-center justify-center gap-4 py-20 pt-28">
          <div className="w-10 h-10 rounded-full border-2 border-[#3D6B47] border-t-transparent animate-spin" />
          <p className="text-sm text-muted-foreground font-medium">Loading tournament…</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-colors duration-500 ${isDark ? "bg-[oklch(0.20_0.06_145)]" : "bg-white"}`}>
      <MinimalTournamentNav
        tournamentName={displayName}
        backHref="/"
        backLabel="Home"
        centerSlot={
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success("Link copied!"); }}
              className={`touch-target flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-xl border transition-all active:scale-95 ${
                isDark
                  ? "border-white/15 text-white/70 hover:bg-white/08"
                  : "border-black/15 text-black/60 hover:bg-black/05"
              }`}
            >
              <Share2 className="w-4 h-4" />
              <span className="hidden sm:block">Share</span>
            </button>
            <Link
              href={`/tournament/${tournamentId}/manage`}
              className={`touch-target flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-xl border transition-all active:scale-95 ${
                isDark
                  ? "border-[#4CAF50]/30 text-[#4CAF50] hover:bg-[#3D6B47]/20"
                  : "border-[#3D6B47]/30 text-[#3D6B47] hover:bg-[#3D6B47]/08"
              }`}
            >
              <Shield className="w-4 h-4" />
              <span className="hidden sm:block">Director</span>
            </Link>
            <Link
              href={`/tournament/${tournamentId}/print`}
              className={`hidden sm:flex touch-target items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-xl border transition-all active:scale-95 ${
                isDark
                  ? "border-white/15 text-white/70 hover:bg-white/08"
                  : "border-black/15 text-black/60 hover:bg-black/05"
              }`}
            >
              <Printer className="w-4 h-4" />
              <span>Print</span>
            </Link>
          </div>
        }
      />
      <div style={{ height: 56 }} aria-hidden />
      {/* New round flash notification */}
      {newRoundFlash !== null && (
        <NewRoundFlash round={newRoundFlash} onDismiss={dismissFlash} />
      )}
      <TournamentHeader
        name={displayName}
        date={displayDate}
        venue={displayVenue}
        timeControl={displayTimeControl}
        playerCount={displayState.players.length}
        format={displayFormat}
        totalRounds={displayState.totalRounds}
        currentRound={displayState.currentRound}
      />

      {/* Registration waiting state */}
      {displayState.status === "registration" && (
        <RegistrationState tournamentName={displayName} playerCount={displayState.players.length} tournamentId={tournamentId} />
      )}

          {/* Live / completed tournament */}
          {displayState.status !== "registration" && (
            <>
              {/* Live clock banner */}
              <div className="bg-[#3D6B47] py-2.5">
                <div className="container flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-white/80 text-sm min-w-0">
                    <span className="w-2 h-2 rounded-full bg-white animate-pulse flex-shrink-0" />
                    <span className="truncate">
                      {displayState.status === "completed"
                        ? `Complete · ${displayState.totalRounds} rounds`
                        : `Round ${displayState.currentRound}${liveGames > 0 ? ` · ${liveGames} active` : ""}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* SSE connection badge — only shown for real tournaments */}
                    {tournamentId !== "otb-demo-2026" && (
                      <SSEConnectionBadge connected={sseConnected} />
                    )}
                    <LiveBadge
                      currentRound={displayState.currentRound}
                      totalRounds={displayState.totalRounds}
                      status={displayState.status}
                    />
                    {/* Elapsed clock — hidden on mobile to save space */}
                    {displayState.status === "in_progress" && (
                      <div className="hidden sm:flex items-center gap-1.5 text-white text-xs font-mono font-bold">
                        <Clock className="w-3.5 h-3.5 text-white/70" />
                        {formatElapsed(elapsed + 5432)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {/* Round progress bar — shows X/N boards completed */}
              {displayState.status === "in_progress" && (
                <div className="bg-[#3D6B47]">
                  <RoundProgressBar
                    rounds={displayState.rounds}
                    currentRound={displayState.currentRound}
                    isDark={isDark}
                  />
                </div>
              )}

              {/* Round timer banner — SSE-driven, visible to all spectators on any device */}
              {displayState.status === "in_progress" && timerSnapshot && timerSnapshot.status !== "idle" && (
                <div className="container pt-3 pb-1">
                  <SpectatorTimerBanner snap={timerSnapshot} />
                </div>
              )}

          {/* Main content */}
          <div className="container py-4 sm:py-8 animate-page-in">

            {/* ── Mobile tab bar (hidden on lg+) ─────────────────────────── */}
            <div className="flex lg:hidden mb-4 rounded-2xl overflow-hidden border p-1 gap-1"
              style={{ background: isDark ? "oklch(0.22 0.06 145)" : "#F0F5EE", borderColor: isDark ? "rgba(255,255,255,0.08)" : "#EEEED2" }}>
              {(["pairings", "standings", "players"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setMobileTab(tab)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 capitalize ${
                    mobileTab === tab
                      ? isDark
                        ? "bg-[#3D6B47] text-white shadow-sm"
                        : "bg-white text-[#3D6B47] shadow-sm"
                      : isDark
                      ? "text-white/45 hover:text-white/70"
                      : "text-gray-400 hover:text-gray-600"
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            {/* ── Swipe flash overlay (mobile only) ───────────────────────── */}
            {swipeFlash && (
              <div
                className={`pointer-events-none fixed inset-y-0 z-50 w-16 transition-opacity duration-300 ${
                  swipeFlash === "right"
                    ? "left-0 bg-gradient-to-r from-[#4CAF50]/20 to-transparent"
                    : "right-0 bg-gradient-to-l from-[#4CAF50]/20 to-transparent"
                }`}
                aria-hidden
              />
            )}

            {/* ── Mobile swipeable content area ─────────────────────────── */}
            <div
              ref={swipeContainerRef}
              className="block lg:hidden"
            >
              {mobileTab === "pairings" && (
                <PairingsPanel
                  players={displayState.players}
                  rounds={displayState.rounds}
                  totalRounds={displayState.totalRounds}
                  currentRound={displayState.currentRound}
                  myPlayerId={myPlayerId}
                />
              )}
              {mobileTab === "standings" && (
                <StandingsPanel players={displayState.players} rounds={displayState.rounds} myPlayerId={myPlayerId} format={config?.format} />
              )}
              {mobileTab === "players" && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold text-foreground" style={{ fontFamily: "'Clash Display', sans-serif" }}>Players</h3>
                    <span className="text-sm text-muted-foreground">{displayState.players.length} registered</span>
                  </div>
                  {displayState.players.map((p) => (
                    <div key={p.id} className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl border ${
                      p.id === myPlayerId
                        ? isDark ? "border-[#3D6B47]/50 bg-[#3D6B47]/10" : "border-[#3D6B47]/30 bg-[#F0F8F2]"
                        : isDark ? "border-white/08 bg-[oklch(0.25_0.07_145)]" : "border-[#EEEED2] bg-white"
                    }`}>
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                        isDark ? "bg-white/10 text-white/70" : "bg-[#F0F5EE] text-[#3D6B47]"
                      }`}>{p.name.charAt(0).toUpperCase()}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-foreground truncate">{p.name}</span>
                          {p.title && <TitleBadge title={p.title} />}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <ELOBadge elo={p.elo} size="sm" />
                          {p.country && <span className="text-sm">{FLAG_EMOJI[p.country] ?? ""}</span>}
                        </div>
                      </div>
                      {p.id === myPlayerId && (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          isDark ? "bg-[#3D6B47]/30 text-[#4CAF50]" : "bg-[#3D6B47]/10 text-[#3D6B47]"
                        }`}>You</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Desktop layout (unchanged) ────────────────────────────── */}
            <div className="hidden lg:grid lg:grid-cols-[1fr_380px] gap-8">
              {/* Left: Pairings */}
              <div>
                <PairingsPanel
                  players={displayState.players}
                  rounds={displayState.rounds}
                  totalRounds={displayState.totalRounds}
                  currentRound={displayState.currentRound}
                  myPlayerId={myPlayerId}
                />
              </div>

              {/* Right: Standings — desktop only */}
              <div>
                <StandingsPanel players={displayState.players} rounds={displayState.rounds} myPlayerId={myPlayerId} format={config?.format} />
              </div>
            </div>

            {/* Performance section */}
            <div className="mt-8">
              <PerformanceSection
                players={displayState.players}
                rounds={displayState.rounds}
                currentRound={displayState.currentRound}
              />
            </div>
          </div>
        </>
      )}

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
            <a href="mailto:hello@otbchess.club?subject=Issue+Report" className="hover:text-foreground transition-colors">
              Report Issue
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
