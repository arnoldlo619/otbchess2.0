/**
 * GamesHistory — /games
 *
 * Paginated, searchable, filterable list of all the user's analysed games.
 * Design: Apple-inspired minimalism, dark/light mode aware, mobile-first.
 */

import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import {
  Search, SlidersHorizontal, ChevronLeft, ChevronRight,
  ArrowUpDown, ArrowUp, ArrowDown, BookOpen, RefreshCw,
  Trophy, Minus, Crown, BarChart2, Clock, X,
} from "lucide-react";
import { useGameHistory, type ResultFilter, type SortField } from "../hooks/useGameHistory";
import type { AnalysedGame } from "../hooks/useMyAnalysedGames";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
    });
  } catch { return iso; }
}

function getResultLabel(result: string | null): string {
  switch (result) {
    case "1-0":      return "1 – 0";
    case "0-1":      return "0 – 1";
    case "1/2-1/2":  return "½ – ½";
    default:         return "—";
  }
}

function getResultColor(result: string | null): string {
  switch (result) {
    case "1-0":      return "text-emerald-400 bg-emerald-400/10";
    case "0-1":      return "text-red-400 bg-red-400/10";
    case "1/2-1/2":  return "text-yellow-400 bg-yellow-400/10";
    default:         return "text-white/40 bg-white/5";
  }
}

function getResultIcon(result: string | null) {
  switch (result) {
    case "1-0":      return <Crown className="w-3 h-3" />;
    case "0-1":      return <Minus className="w-3 h-3 rotate-90" />;
    case "1/2-1/2":  return <Minus className="w-3 h-3" />;
    default:         return null;
  }
}

function accuracyColor(acc: number | null): string {
  if (acc === null) return "bg-white/20";
  if (acc >= 90) return "bg-[#4ade80]";
  if (acc >= 75) return "bg-emerald-400";
  if (acc >= 60) return "bg-yellow-400";
  if (acc >= 45) return "bg-orange-400";
  return "bg-red-400";
}

function accuracyLabel(acc: number | null): string {
  if (acc === null) return "—";
  return `${Math.round(acc)}%`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SortIcon({ field, current, dir }: { field: SortField; current: SortField; dir: "asc" | "desc" }) {
  if (field !== current) return <ArrowUpDown className="w-3.5 h-3.5 opacity-30" />;
  return dir === "asc"
    ? <ArrowUp   className="w-3.5 h-3.5 text-emerald-400" />
    : <ArrowDown className="w-3.5 h-3.5 text-emerald-400" />;
}

function GameCard({ game, onClick }: { game: AnalysedGame; onClick: () => void }) {
  const hasAccuracy = game.whiteAccuracy !== null || game.blackAccuracy !== null;
  const displayDate = game.date ?? game.createdAt;

  return (
    <button
      onClick={onClick}
      className="w-full text-left group bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.08] hover:border-white/20 rounded-2xl p-4 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">
            {game.whitePlayer ?? "White"} <span className="text-white/30 font-normal">vs</span> {game.blackPlayer ?? "Black"}
          </p>
          <p className="text-xs text-white/50 mt-0.5 truncate">
            {game.openingEco && <span className="text-emerald-400/80 font-mono mr-1">{game.openingEco}</span>}
            {game.openingName ?? "Unknown Opening"}
          </p>
        </div>
        <span className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold shrink-0 ${getResultColor(game.result)}`}>
          {getResultIcon(game.result)}
          {getResultLabel(game.result)}
        </span>
      </div>

      {/* Accuracy bars */}
      {hasAccuracy && (
        <div className="space-y-1.5 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-white/40 w-10 shrink-0">White</span>
            <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${accuracyColor(game.whiteAccuracy)}`}
                style={{ width: `${game.whiteAccuracy ?? 0}%` }}
              />
            </div>
            <span className="text-[10px] text-white/60 w-8 text-right shrink-0">{accuracyLabel(game.whiteAccuracy)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-white/40 w-10 shrink-0">Black</span>
            <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${accuracyColor(game.blackAccuracy)}`}
                style={{ width: `${game.blackAccuracy ?? 0}%` }}
              />
            </div>
            <span className="text-[10px] text-white/60 w-8 text-right shrink-0">{accuracyLabel(game.blackAccuracy)}</span>
          </div>
        </div>
      )}

      {/* Footer row */}
      <div className="flex items-center justify-between text-[11px] text-white/35">
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {formatDate(displayDate)}
        </span>
        <span className="flex items-center gap-1">
          <BarChart2 className="w-3 h-3" />
          {game.totalMoves} move{game.totalMoves !== 1 ? "s" : ""}
        </span>
        <span className="text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity font-medium">
          Analyse →
        </span>
      </div>
    </button>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 animate-pulse">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-white/10 rounded w-3/4" />
          <div className="h-3 bg-white/[0.06] rounded w-1/2" />
        </div>
        <div className="h-6 w-14 bg-white/10 rounded-lg ml-3" />
      </div>
      <div className="space-y-2 mb-3">
        <div className="h-1.5 bg-white/[0.06] rounded-full" />
        <div className="h-1.5 bg-white/[0.06] rounded-full" />
      </div>
      <div className="flex justify-between">
        <div className="h-3 bg-white/[0.06] rounded w-20" />
        <div className="h-3 bg-white/[0.06] rounded w-16" />
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const RESULT_FILTERS: { label: string; value: ResultFilter; color: string }[] = [
  { label: "All",     value: "",          color: "border-white/20 text-white/70 hover:border-white/40" },
  { label: "1 – 0",  value: "1-0",       color: "border-emerald-500/40 text-emerald-400 hover:border-emerald-400" },
  { label: "½ – ½",  value: "1/2-1/2",   color: "border-yellow-500/40 text-yellow-400 hover:border-yellow-400" },
  { label: "0 – 1",  value: "0-1",       color: "border-red-500/40 text-red-400 hover:border-red-400" },
];

const SORT_OPTIONS: { label: string; field: SortField }[] = [
  { label: "Date",       field: "createdAt"     },
  { label: "Moves",      field: "totalMoves"    },
  { label: "W Accuracy", field: "whiteAccuracy" },
  { label: "B Accuracy", field: "blackAccuracy" },
];

export default function GamesHistory() {
  const [, navigate] = useLocation();
  const {
    games, total, totalPages, status, error,
    params,
    setPage, setSearch, setResult, toggleSort, refresh,
  } = useGameHistory();

  const [searchInput, setSearchInput] = useState(params.search);
  const [showFilters, setShowFilters] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // Keep local search input in sync when params change externally (e.g. back nav)
  useEffect(() => {
    setSearchInput(params.search);
  }, [params.search]);

  const handleSearchChange = (val: string) => {
    setSearchInput(val);
    setSearch(val);
  };

  const handleClearSearch = () => {
    setSearchInput("");
    setSearch("");
    searchRef.current?.focus();
  };

  const handleGameClick = (game: AnalysedGame) => {
    navigate(`/game/${game.id}/analysis`);
  };

  const isLoading = status === "loading";
  const isEmpty   = status === "success" && games.length === 0;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* ── Header ── */}
      <div className="sticky top-0 z-20 bg-[#0a0a0a]/90 backdrop-blur-xl border-b border-white/[0.06] otb-header-safe">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => navigate("/profile")}
              className="p-2 rounded-xl hover:bg-white/[0.06] transition-colors text-white/50 hover:text-white"
              aria-label="Back to profile"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h1 className="text-lg font-bold text-white">Game History</h1>
              <p className="text-xs text-white/40">
                {status === "success" ? `${total} game${total !== 1 ? "s" : ""} analysed` : "Loading…"}
              </p>
            </div>
            <button
              onClick={refresh}
              className="p-2 rounded-xl hover:bg-white/[0.06] transition-colors text-white/50 hover:text-white"
              aria-label="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            </button>
          </div>

          {/* Search bar */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
            <input
              ref={searchRef}
              type="text"
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search opening, player, event…"
              className="w-full bg-white/[0.05] border border-white/[0.08] focus:border-emerald-500/50 rounded-xl pl-9 pr-9 py-2.5 text-sm text-white placeholder:text-white/30 outline-none transition-colors"
            />
            {searchInput && (
              <button
                onClick={handleClearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Filter / Sort row */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {/* Result filter chips */}
            {RESULT_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setResult(f.value)}
                className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  params.result === f.value
                    ? "bg-emerald-500/20 border-emerald-500 text-emerald-300"
                    : f.color
                }`}
              >
                {f.label}
              </button>
            ))}

            <div className="w-px h-5 bg-white/10 shrink-0 mx-1" />

            {/* Sort toggle */}
            <button
              onClick={() => setShowFilters((v) => !v)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                showFilters
                  ? "bg-white/10 border-white/30 text-white"
                  : "border-white/10 text-white/50 hover:border-white/20 hover:text-white/70"
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Sort
            </button>
          </div>

          {/* Sort options (expandable) */}
          {showFilters && (
            <div className="mt-2 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.field}
                  onClick={() => toggleSort(opt.field)}
                  className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    params.sortBy === opt.field
                      ? "bg-emerald-500/20 border-emerald-500 text-emerald-300"
                      : "border-white/10 text-white/50 hover:border-white/20 hover:text-white/70"
                  }`}
                >
                  {opt.label}
                  <SortIcon field={opt.field} current={params.sortBy} dir={params.sortDir} />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="max-w-3xl mx-auto px-4 py-6">

        {/* Error state */}
        {status === "error" && (
          <div className="text-center py-16">
            <p className="text-white/50 text-sm mb-4">{error}</p>
            <button
              onClick={refresh}
              className="px-4 py-2 bg-white/[0.06] hover:bg-white/10 rounded-xl text-sm text-white/70 transition-colors"
            >
              Try again
            </button>
          </div>
        )}

        {/* Loading skeletons */}
        {isLoading && (
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        )}

        {/* Empty state */}
        {isEmpty && (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-white/[0.04] rounded-2xl flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-7 h-7 text-white/20" />
            </div>
            {params.search || params.result ? (
              <>
                <p className="text-white/60 font-medium mb-1">No games match your filters</p>
                <p className="text-white/30 text-sm mb-5">Try adjusting your search or clearing the filters</p>
                <button
                  onClick={() => { handleClearSearch(); setResult(""); }}
                  className="px-4 py-2 bg-white/[0.06] hover:bg-white/10 rounded-xl text-sm text-white/70 transition-colors"
                >
                  Clear filters
                </button>
              </>
            ) : (
              <>
                <p className="text-white/60 font-medium mb-1">No analysed games yet</p>
                <p className="text-white/30 text-sm mb-5">Start a battle and use Record Moves to capture your first game</p>
                <button
                  onClick={() => navigate("/battle")}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-sm font-semibold text-white transition-colors"
                >
                  Start a Battle
                </button>
              </>
            )}
          </div>
        )}

        {/* Games grid */}
        {status === "success" && games.length > 0 && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              {games.map((game) => (
                <GameCard key={game.id} game={game} onClick={() => handleGameClick(game)} />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 mt-8">
                <button
                  onClick={() => setPage(params.page - 1)}
                  disabled={params.page <= 1}
                  className="p-2 rounded-xl border border-white/10 text-white/50 hover:text-white hover:border-white/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {/* Page numbers */}
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                    let pageNum: number;
                    if (totalPages <= 7) {
                      pageNum = i + 1;
                    } else if (params.page <= 4) {
                      pageNum = i < 6 ? i + 1 : totalPages;
                    } else if (params.page >= totalPages - 3) {
                      pageNum = i === 0 ? 1 : totalPages - 6 + i;
                    } else {
                      const offsets = [-3, -2, -1, 0, 1, 2, 3];
                      pageNum = params.page + offsets[i];
                    }
                    const isActive = pageNum === params.page;
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPage(pageNum)}
                        className={`w-8 h-8 rounded-lg text-xs font-medium transition-all ${
                          isActive
                            ? "bg-emerald-600 text-white"
                            : "text-white/50 hover:text-white hover:bg-white/[0.06]"
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => setPage(params.page + 1)}
                  disabled={params.page >= totalPages}
                  className="p-2 rounded-xl border border-white/10 text-white/50 hover:text-white hover:border-white/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  aria-label="Next page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Page info */}
            <p className="text-center text-xs text-white/25 mt-3">
              Showing {(params.page - 1) * params.limit + 1}–{Math.min(params.page * params.limit, total)} of {total} games
            </p>
          </>
        )}
      </div>
    </div>
  );
}
