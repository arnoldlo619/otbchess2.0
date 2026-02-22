/**
 * OTB Chess — Tournament Archive Page
 * Design: Apple-minimalist, chess.com green/white palette
 * Clash Display for headings, Inter for body
 * Light/dark mode aware via useTheme()
 */

import { useState, useMemo } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy,
  Medal,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  Calendar,
  MapPin,
  Users,
  Clock,
  BarChart2,
  ArrowLeft,
  Star,
  Crown,
  Zap,
  Globe,
  X,
  TrendingUp,
} from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import {
  ARCHIVE_TOURNAMENTS,
  ARCHIVE_STATS,
  type ArchiveTournament,
  type ArchivePlayer,
} from "@/lib/archiveData";

// ── Helpers ───────────────────────────────────────────────────────────────────

function titleColor(title: string | null) {
  switch (title) {
    case "GM": return "bg-amber-500 text-white";
    case "IM": return "bg-orange-500 text-white";
    case "FM": return "bg-blue-500 text-white";
    case "NM": return "bg-[#3D6B47] text-white";
    case "CM": return "bg-purple-500 text-white";
    default: return "";
  }
}

function formatBadge(format: string) {
  switch (format) {
    case "Swiss": return { color: "bg-[#3D6B47]/10 text-[#3D6B47] border-[#3D6B47]/20", icon: "⚙" };
    case "Round Robin": return { color: "bg-blue-50 text-blue-700 border-blue-200", icon: "⟳" };
    case "Elimination": return { color: "bg-red-50 text-red-700 border-red-200", icon: "⚔" };
    default: return { color: "bg-gray-50 text-gray-600 border-gray-200", icon: "•" };
  }
}

function timeControlIcon(tc: string) {
  if (tc.includes("Blitz") || tc.startsWith("3+") || tc.startsWith("5+")) return <Zap className="w-3 h-3" />;
  if (tc.includes("G/60") || tc.includes("G/90") || tc.includes("Classical")) return <Clock className="w-3 h-3" />;
  return <Clock className="w-3 h-3" />;
}

function rankMedal(rank: number) {
  if (rank === 1) return <Crown className="w-4 h-4 text-amber-500" />;
  if (rank === 2) return <Medal className="w-4 h-4 text-slate-400" />;
  if (rank === 3) return <Medal className="w-4 h-4 text-amber-700" />;
  return null;
}

function WinnerBadge({ player, isDark }: { player: ArchivePlayer; isDark: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`relative flex items-center gap-3 px-4 py-3 rounded-xl border ${
        isDark
          ? "bg-amber-500/10 border-amber-500/25"
          : "bg-amber-50 border-amber-200"
      }`}
    >
      {/* Gold crown glow */}
      <div className="relative flex-shrink-0">
        <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
          <Crown className="w-5 h-5 text-amber-500" />
        </div>
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          {player.title && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${titleColor(player.title)}`}>
              {player.title}
            </span>
          )}
          <span className={`font-semibold text-sm truncate ${isDark ? "text-white" : "text-gray-900"}`}>
            {player.name}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={`text-xs ${isDark ? "text-white/50" : "text-gray-500"}`}>
            @{player.username}
          </span>
          <span className={`text-xs font-medium ${isDark ? "text-amber-400" : "text-amber-700"}`}>
            {player.score} pts · {player.wins}W/{player.draws}D/{player.losses}L
          </span>
        </div>
      </div>
      <div className={`ml-auto text-right flex-shrink-0`}>
        <div className={`text-sm font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
          {player.elo}
        </div>
        <div className={`text-[10px] ${isDark ? "text-white/40" : "text-gray-400"}`}>ELO</div>
      </div>
    </motion.div>
  );
}

// ── Standings Podium ─────────────────────────────────────────────────────────

function PodiumCard({ player, isDark }: { player: ArchivePlayer; isDark: boolean }) {
  const heights = { 1: "h-20", 2: "h-14", 3: "h-10" };
  const colors = {
    1: isDark ? "bg-amber-500/20 border-amber-500/30" : "bg-amber-50 border-amber-200",
    2: isDark ? "bg-slate-500/20 border-slate-500/30" : "bg-slate-50 border-slate-200",
    3: isDark ? "bg-amber-800/20 border-amber-700/30" : "bg-amber-100/60 border-amber-300",
  };
  const textColors = {
    1: "text-amber-500",
    2: isDark ? "text-slate-300" : "text-slate-500",
    3: "text-amber-700",
  };
  const rank = player.rank as 1 | 2 | 3;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`text-xs font-medium ${isDark ? "text-white/50" : "text-gray-500"}`}>
        {player.title && (
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded mr-1 ${titleColor(player.title)}`}>
            {player.title}
          </span>
        )}
        {player.name.split(" ")[0]}
      </div>
      <div className={`text-sm font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
        {player.score}
      </div>
      <div
        className={`w-full rounded-t-lg border-t border-x flex items-end justify-center pb-2 ${heights[rank]} ${colors[rank]}`}
      >
        <span className={`text-xl font-black ${textColors[rank]}`}>{rank}</span>
      </div>
    </div>
  );
}

// ── Tournament Card ───────────────────────────────────────────────────────────

function TournamentCard({
  tournament,
  isDark,
  onExpand,
  expanded,
}: {
  tournament: ArchiveTournament;
  isDark: boolean;
  onExpand: () => void;
  expanded: boolean;
}) {
  const winner = tournament.standings[0];
  const fmt = formatBadge(tournament.format);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25 }}
      className={`rounded-2xl border overflow-hidden transition-shadow ${
        isDark
          ? "bg-[oklch(0.18_0.05_145)] border-white/08 hover:border-white/14"
          : "bg-white border-gray-100 hover:border-[#3D6B47]/30 hover:shadow-md"
      }`}
    >
      {/* Card Header */}
      <div
        className="p-5 cursor-pointer select-none"
        onClick={onExpand}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {/* Tags row */}
            <div className="flex flex-wrap gap-1.5 mb-2">
              {tournament.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                    isDark
                      ? "bg-white/05 border-white/10 text-white/50"
                      : "bg-gray-50 border-gray-200 text-gray-500"
                  }`}
                >
                  {tag}
                </span>
              ))}
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${fmt.color}`}>
                {tournament.format}
              </span>
            </div>

            {/* Title */}
            <h3
              className={`text-lg font-bold leading-tight mb-1 ${isDark ? "text-white" : "text-gray-900"}`}
              style={{ fontFamily: "'Clash Display', sans-serif" }}
            >
              {tournament.name}
            </h3>

            {/* Meta row */}
            <div className={`flex flex-wrap items-center gap-3 text-xs ${isDark ? "text-white/40" : "text-gray-400"}`}>
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" /> {tournament.date}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" /> {tournament.city}
              </span>
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" /> {tournament.playerCount} players
              </span>
              <span className="flex items-center gap-1">
                {timeControlIcon(tournament.timeControl)} {tournament.timeControl}
              </span>
              <span className="flex items-center gap-1">
                <BarChart2 className="w-3 h-3" /> {tournament.rounds} rounds
              </span>
            </div>
          </div>

          {/* Expand toggle */}
          <button
            className={`flex-shrink-0 p-2 rounded-lg transition-colors ${
              isDark ? "hover:bg-white/08 text-white/40" : "hover:bg-gray-100 text-gray-400"
            }`}
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {/* Winner preview */}
        <div className="mt-4">
          <WinnerBadge player={winner} isDark={isDark} />
        </div>
      </div>

      {/* Expanded: Full Standings */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className={`border-t px-5 pb-5 pt-4 ${isDark ? "border-white/08" : "border-gray-100"}`}>
              {/* Podium — top 3 */}
              {tournament.standings.length >= 3 && (
                <div className="mb-5">
                  <p className={`text-xs font-bold uppercase tracking-widest mb-3 ${isDark ? "text-white/30" : "text-gray-400"}`}>
                    Podium
                  </p>
                  <div className="grid grid-cols-3 gap-2 items-end">
                    {/* 2nd */}
                    <PodiumCard player={tournament.standings[1]} isDark={isDark} />
                    {/* 1st */}
                    <PodiumCard player={tournament.standings[0]} isDark={isDark} />
                    {/* 3rd */}
                    <PodiumCard player={tournament.standings[2]} isDark={isDark} />
                  </div>
                </div>
              )}

              {/* Full standings table */}
              <p className={`text-xs font-bold uppercase tracking-widest mb-2 ${isDark ? "text-white/30" : "text-gray-400"}`}>
                Final Standings
              </p>
              <div className={`rounded-xl overflow-hidden border ${isDark ? "border-white/08" : "border-gray-100"}`}>
                {/* Table header */}
                <div
                  className={`grid gap-2 px-3 py-2 text-[10px] font-bold uppercase tracking-wider ${
                    isDark ? "bg-white/04 text-white/30" : "bg-gray-50 text-gray-400"
                  }`}
                  style={{ gridTemplateColumns: "2rem 1fr 3.5rem 3.5rem 4rem 4rem" }}
                >
                  <span>#</span>
                  <span>Player</span>
                  <span className="text-right">Score</span>
                  <span className="text-right">ELO</span>
                  <span className="text-right hidden sm:block">Perf.</span>
                  <span className="text-right hidden sm:block">W/D/L</span>
                </div>

                {/* Rows */}
                {tournament.standings.map((player, i) => (
                  <div
                    key={player.id}
                    className={`grid gap-2 px-3 py-2.5 items-center text-sm border-t ${
                      isDark
                        ? `border-white/05 ${i === 0 ? "bg-amber-500/05" : ""}`
                        : `border-gray-50 ${i === 0 ? "bg-amber-50/50" : ""}`
                    }`}
                    style={{ gridTemplateColumns: "2rem 1fr 3.5rem 3.5rem 4rem 4rem" }}
                  >
                    {/* Rank */}
                    <div className="flex items-center justify-center">
                      {rankMedal(player.rank) || (
                        <span className={`text-xs font-medium ${isDark ? "text-white/30" : "text-gray-400"}`}>
                          {player.rank}
                        </span>
                      )}
                    </div>

                    {/* Name + title */}
                    <div className="flex items-center gap-1.5 min-w-0">
                      {player.title && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${titleColor(player.title)}`}>
                          {player.title}
                        </span>
                      )}
                      <div className="min-w-0">
                        <div className={`font-medium truncate text-xs ${isDark ? "text-white" : "text-gray-900"}`}>
                          {player.name}
                        </div>
                        <div className={`text-[10px] truncate ${isDark ? "text-white/30" : "text-gray-400"}`}>
                          @{player.username}
                        </div>
                      </div>
                    </div>

                    {/* Score */}
                    <div className={`text-right font-bold text-xs ${isDark ? "text-white" : "text-gray-900"}`}>
                      {player.score}
                    </div>

                    {/* ELO */}
                    <div className={`text-right text-xs font-medium ${isDark ? "text-white/60" : "text-gray-600"}`}>
                      {player.elo}
                    </div>

                    {/* Performance */}
                    <div className={`text-right text-xs hidden sm:block ${
                      player.performanceRating > player.elo
                        ? "text-[#3D6B47] font-medium"
                        : isDark ? "text-white/40" : "text-gray-400"
                    }`}>
                      {player.performanceRating > player.elo ? "▲ " : ""}{player.performanceRating}
                    </div>

                    {/* W/D/L */}
                    <div className={`text-right text-[10px] hidden sm:block ${isDark ? "text-white/40" : "text-gray-400"}`}>
                      {player.wins}/{player.draws}/{player.losses}
                    </div>
                  </div>
                ))}
              </div>

              {/* Tournament details footer */}
              <div className={`mt-4 pt-4 border-t flex flex-wrap gap-4 text-xs ${
                isDark ? "border-white/08 text-white/40" : "border-gray-100 text-gray-400"
              }`}>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> {tournament.venue}, {tournament.city}
                </span>
                <span className="flex items-center gap-1">
                  <Globe className="w-3 h-3" /> {tournament.ratingSystem} rated
                </span>
                <span className="flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" /> Avg ELO {tournament.avgElo}
                </span>
                {tournament.format === "Swiss" && (
                  <span className="flex items-center gap-1">
                    <BarChart2 className="w-3 h-3" /> Buchholz tiebreak
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({
  icon,
  value,
  label,
  isDark,
}: {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  isDark: boolean;
}) {
  return (
    <div
      className={`rounded-xl border px-4 py-3 flex items-center gap-3 ${
        isDark ? "bg-[oklch(0.18_0.05_145)] border-white/08" : "bg-white border-gray-100"
      }`}
    >
      <div className={`p-2 rounded-lg ${isDark ? "bg-[#3D6B47]/20" : "bg-[#3D6B47]/08"}`}>
        <div className="text-[#3D6B47]">{icon}</div>
      </div>
      <div>
        <div
          className={`text-xl font-black ${isDark ? "text-white" : "text-gray-900"}`}
          style={{ fontFamily: "'Clash Display', sans-serif" }}
        >
          {value}
        </div>
        <div className={`text-xs ${isDark ? "text-white/40" : "text-gray-400"}`}>{label}</div>
      </div>
    </div>
  );
}

// ── Main Archive Page ─────────────────────────────────────────────────────────

export default function Archive() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [search, setSearch] = useState("");
  const [formatFilter, setFormatFilter] = useState<string>("All");
  const [sortKey, setSortKey] = useState<"date" | "players" | "elo">("date");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const formats = ["All", "Swiss", "Round Robin", "Elimination"];

  const filtered = useMemo(() => {
    let list = [...ARCHIVE_TOURNAMENTS];

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.club.toLowerCase().includes(q) ||
          t.city.toLowerCase().includes(q) ||
          t.standings.some(
            (p) =>
              p.name.toLowerCase().includes(q) ||
              p.username.toLowerCase().includes(q)
          )
      );
    }

    // Format filter
    if (formatFilter !== "All") {
      list = list.filter((t) => t.format === formatFilter);
    }

    // Sort
    if (sortKey === "date") {
      // already in descending date order by default
    } else if (sortKey === "players") {
      list.sort((a, b) => b.playerCount - a.playerCount);
    } else if (sortKey === "elo") {
      list.sort((a, b) => b.topElo - a.topElo);
    }

    return list;
  }, [search, formatFilter, sortKey]);

  const activeFilters = (formatFilter !== "All" ? 1 : 0) + (search.trim() ? 1 : 0);

  return (
    <div
      className={`min-h-screen ${
        isDark
          ? "bg-[oklch(0.14_0.04_145)]"
          : "bg-[#F8FAF8]"
      }`}
    >
      {/* ── Nav ─────────────────────────────────────────────────────────────── */}
      <nav
        className={`sticky top-0 z-40 border-b backdrop-blur-md ${
          isDark
            ? "bg-[oklch(0.14_0.04_145)]/90 border-white/08"
            : "bg-[#F8FAF8]/90 border-gray-200/60"
        }`}
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/">
              <button
                className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${
                  isDark ? "text-white/50 hover:text-white" : "text-gray-400 hover:text-gray-700"
                }`}
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Back</span>
              </button>
            </Link>
            <div className={`w-px h-4 ${isDark ? "bg-white/10" : "bg-gray-200"}`} />
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-[#3D6B47] flex items-center justify-center">
                <Trophy className="w-3.5 h-3.5 text-white" />
              </div>
              <span
                className={`font-bold text-sm ${isDark ? "text-white" : "text-gray-900"}`}
                style={{ fontFamily: "'Clash Display', sans-serif" }}
              >
                Tournament Archive
              </span>
            </div>
          </div>

          <Link href="/">
            <button
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#3D6B47] text-white hover:bg-[#2d5236] transition-colors"
            >
              Create Tournament
            </button>
          </Link>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">

        {/* ── Hero Header ─────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1
                className={`text-4xl sm:text-5xl font-black leading-none mb-2 ${isDark ? "text-white" : "text-gray-900"}`}
                style={{ fontFamily: "'Clash Display', sans-serif" }}
              >
                Archive
              </h1>
              <p className={`text-sm ${isDark ? "text-white/40" : "text-gray-400"}`}>
                Every tournament. Every result. Every champion.
              </p>
            </div>
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium ${
              isDark ? "bg-[#3D6B47]/15 border-[#3D6B47]/30 text-[#4CAF50]" : "bg-[#3D6B47]/08 border-[#3D6B47]/20 text-[#3D6B47]"
            }`}>
              <Star className="w-3 h-3" />
              {ARCHIVE_STATS.totalTournaments} events recorded
            </div>
          </div>
        </motion.div>

        {/* ── Stats Row ───────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-3"
        >
          <StatCard icon={<Trophy className="w-4 h-4" />} value={ARCHIVE_STATS.totalTournaments} label="Tournaments" isDark={isDark} />
          <StatCard icon={<Users className="w-4 h-4" />} value={ARCHIVE_STATS.totalPlayers} label="Players" isDark={isDark} />
          <StatCard icon={<BarChart2 className="w-4 h-4" />} value={ARCHIVE_STATS.totalGames} label="Games Played" isDark={isDark} />
          <StatCard icon={<Globe className="w-4 h-4" />} value={ARCHIVE_STATS.totalClubs} label="Chess Clubs" isDark={isDark} />
        </motion.div>

        {/* ── Search + Filter Bar ─────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="space-y-3"
        >
          <div className="flex gap-2">
            {/* Search */}
            <div className={`relative flex-1 rounded-xl border overflow-hidden ${
              isDark ? "bg-[oklch(0.18_0.05_145)] border-white/10" : "bg-white border-gray-200"
            }`}>
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? "text-white/30" : "text-gray-400"}`} />
              <input
                type="text"
                placeholder="Search tournaments, clubs, players…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={`w-full pl-9 pr-4 py-2.5 text-sm bg-transparent outline-none ${
                  isDark ? "text-white placeholder:text-white/25" : "text-gray-900 placeholder:text-gray-400"
                }`}
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 ${isDark ? "text-white/30 hover:text-white/60" : "text-gray-300 hover:text-gray-500"}`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`relative flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                showFilters || activeFilters > 0
                  ? "bg-[#3D6B47] border-[#3D6B47] text-white"
                  : isDark
                  ? "bg-[oklch(0.18_0.05_145)] border-white/10 text-white/60 hover:border-white/20"
                  : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"
              }`}
            >
              <Filter className="w-4 h-4" />
              <span className="hidden sm:inline">Filter</span>
              {activeFilters > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-amber-500 text-white text-[9px] font-bold flex items-center justify-center">
                  {activeFilters}
                </span>
              )}
            </button>
          </div>

          {/* Expanded filters */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className={`rounded-xl border p-4 space-y-4 ${
                  isDark ? "bg-[oklch(0.18_0.05_145)] border-white/08" : "bg-white border-gray-100"
                }`}>
                  <div className="flex flex-wrap gap-4">
                    {/* Format filter */}
                    <div>
                      <p className={`text-xs font-bold uppercase tracking-widest mb-2 ${isDark ? "text-white/30" : "text-gray-400"}`}>
                        Format
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {formats.map((f) => (
                          <button
                            key={f}
                            onClick={() => setFormatFilter(f)}
                            className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                              formatFilter === f
                                ? "bg-[#3D6B47] border-[#3D6B47] text-white"
                                : isDark
                                ? "bg-white/04 border-white/10 text-white/50 hover:border-white/20"
                                : "bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300"
                            }`}
                          >
                            {f}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Sort */}
                    <div>
                      <p className={`text-xs font-bold uppercase tracking-widest mb-2 ${isDark ? "text-white/30" : "text-gray-400"}`}>
                        Sort By
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { key: "date", label: "Most Recent" },
                          { key: "players", label: "Most Players" },
                          { key: "elo", label: "Highest ELO" },
                        ].map(({ key, label }) => (
                          <button
                            key={key}
                            onClick={() => setSortKey(key as typeof sortKey)}
                            className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                              sortKey === key
                                ? "bg-[#3D6B47] border-[#3D6B47] text-white"
                                : isDark
                                ? "bg-white/04 border-white/10 text-white/50 hover:border-white/20"
                                : "bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300"
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Clear filters */}
                  {activeFilters > 0 && (
                    <button
                      onClick={() => { setSearch(""); setFormatFilter("All"); }}
                      className={`text-xs font-medium flex items-center gap-1 ${
                        isDark ? "text-white/40 hover:text-white/70" : "text-gray-400 hover:text-gray-600"
                      }`}
                    >
                      <X className="w-3 h-3" /> Clear all filters
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* ── Results count ───────────────────────────────────────────────── */}
        <div className={`text-xs ${isDark ? "text-white/30" : "text-gray-400"}`}>
          Showing {filtered.length} of {ARCHIVE_TOURNAMENTS.length} tournaments
        </div>

        {/* ── Tournament Cards ─────────────────────────────────────────────── */}
        <div className="space-y-4">
          <AnimatePresence mode="popLayout">
            {filtered.length > 0 ? (
              filtered.map((tournament) => (
                <TournamentCard
                  key={tournament.id}
                  tournament={tournament}
                  isDark={isDark}
                  expanded={expandedId === tournament.id}
                  onExpand={() =>
                    setExpandedId(expandedId === tournament.id ? null : tournament.id)
                  }
                />
              ))
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className={`flex flex-col items-center justify-center py-20 rounded-2xl border ${
                  isDark ? "border-white/08 text-white/30" : "border-gray-100 text-gray-300"
                }`}
              >
                <Trophy className="w-10 h-10 mb-3" />
                <p className="text-sm font-medium">No tournaments found</p>
                <button
                  onClick={() => { setSearch(""); setFormatFilter("All"); }}
                  className="mt-3 text-xs text-[#3D6B47] hover:underline"
                >
                  Clear filters
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Footer CTA ──────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className={`rounded-2xl border p-6 text-center ${
            isDark
              ? "bg-[oklch(0.18_0.05_145)] border-white/08"
              : "bg-white border-gray-100"
          }`}
        >
          <Trophy className={`w-8 h-8 mx-auto mb-3 ${isDark ? "text-white/20" : "text-gray-200"}`} />
          <h3
            className={`text-xl font-bold mb-1 ${isDark ? "text-white" : "text-gray-900"}`}
            style={{ fontFamily: "'Clash Display', sans-serif" }}
          >
            Ready to make history?
          </h3>
          <p className={`text-sm mb-4 ${isDark ? "text-white/40" : "text-gray-400"}`}>
            Your next tournament will appear right here.
          </p>
          <Link href="/">
            <button className="px-5 py-2.5 rounded-xl bg-[#3D6B47] text-white text-sm font-semibold hover:bg-[#2d5236] transition-colors">
              Create Tournament →
            </button>
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
