/*
 * OTB Chess — Tournament Director Dashboard
 * Design: Apple-minimalist, chess.com green/white, Clash Display + Inter
 * Layout: Left sidebar (event info + standings) + Main panel (boards + controls)
 * Features:
 *   - Live result entry per board (1-0 / ½-½ / 0-1 / pending)
 *   - Auto-generate next round Swiss pairings
 *   - Live standings table with score updates
 *   - Event control panel (pause, announce, export)
 *   - Round progress tracker
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { AddPlayerModal } from "@/components/AddPlayerModal";
import { QRModal } from "@/components/QRModal";
import { Link, useParams, useLocation } from "wouter";
import { toast } from "sonner";
import { useTheme } from "@/contexts/ThemeContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useDirectorState } from "@/lib/directorState";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { PlayerHoverCard } from "@/components/PlayerProfileCard";
import { getStandings, FLAG_EMOJI, type Result } from "@/lib/tournamentData";
import { getTournamentConfig, hasDirectorSession } from "@/lib/tournamentRegistry";
import { TournamentSettingsPanel } from "@/components/TournamentSettingsPanel";
import { CapacityBadge } from "@/components/CapacityBadge";
import { UndoSnackbar } from "@/components/UndoSnackbar";
import { useUndoResult } from "@/hooks/useUndoResult";
import { RoundTimerCard } from "@/components/RoundTimerCard";
import { useRoundTimer } from "@/hooks/useRoundTimer";
import { generateResultsPdf } from "@/lib/generateResultsPdf";
import {
  Crown,
  ChevronLeft,
  Play,
  Pause,
  Zap,
  Users,
  Clock,
  Trophy,
  CheckCircle2,
  Circle,
  AlertCircle,
  ArrowRight,
  Copy,
  Download,
  Bell,
  Settings,
  BarChart3,
  RefreshCw,
  Shield,
  Search,
  X,
  SortAsc,
  SortDesc,
  Filter,
  ChevronDown,
  MapPin,
  UserPlus,
  PlayCircle,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const RESULT_OPTIONS: { value: Result; label: string; short: string }[] = [
  { value: "1-0",  label: "White wins",  short: "1-0" },
  { value: "½-½",  label: "Draw",        short: "½-½" },
  { value: "0-1",  label: "Black wins",  short: "0-1" },
];

function resultBadgeClass(result: Result, isDark: boolean): string {
  if (result === "*") return isDark ? "bg-white/10 text-white/50" : "bg-gray-100 text-gray-400";
  if (result === "1-0") return "bg-emerald-100 text-emerald-700";
  if (result === "0-1") return "bg-red-100 text-red-600";
  return "bg-blue-100 text-blue-600";
}

function pointsFor(result: Result, side: "white" | "black"): string {
  if (result === "*") return "—";
  if (result === "½-½") return "½";
  if (side === "white") return result === "1-0" ? "1" : "0";
  return result === "0-1" ? "1" : "0";
}

// ─── Bye Card ───────────────────────────────────────────────────────────────
function ByeCard({ game, players, isDark }: {
  game: import("@/lib/tournamentData").Game;
  players: import("@/lib/tournamentData").Player[];
  isDark: boolean;
}) {
  const byePlayer = players.find((p) => p.id === game.blackId);
  if (!byePlayer) return null;
  return (
    <div
      className={`rounded-xl border transition-all duration-200 ${
        isDark
          ? "bg-[oklch(0.22_0.06_145)] border-white/10"
          : "bg-white border-gray-100"
      }`}
    >
      <div
        className={`flex items-center justify-between px-4 py-2.5 border-b rounded-t-xl ${
          isDark ? "border-white/08 bg-white/04" : "border-gray-50 bg-gray-50/80"
        }`}
      >
        <span className={`text-xs font-bold tracking-widest uppercase ${isDark ? "text-white/40" : "text-gray-400"}`}>
          Board {game.board}
        </span>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
          isDark ? "bg-blue-500/20 text-blue-300" : "bg-blue-50 text-blue-600"
        }`}>
          BYE
        </span>
      </div>
      <div className="px-4 py-4 flex items-center gap-3">
        <PlayerAvatar
          username={byePlayer.username}
          name={byePlayer.name}
          platform={byePlayer.platform === "lichess" ? "lichess" : "chesscom"}
          size={36}
          showBadge
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className={`text-sm font-semibold truncate ${isDark ? "text-white" : "text-gray-900"}`}>
              {byePlayer.name}
            </span>
            {byePlayer.title && (
              <span className="text-xs font-bold text-[#3D6B47] bg-[#3D6B47]/10 px-1.5 py-0.5 rounded">
                {byePlayer.title}
              </span>
            )}
          </div>
          <span className={`text-xs ${isDark ? "text-white/40" : "text-gray-400"}`}>
            {byePlayer.elo} ELO
          </span>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-blue-500">+½</div>
          <div className={`text-xs ${isDark ? "text-white/30" : "text-gray-400"}`}>bye point</div>
        </div>
      </div>
      <div className="px-4 pb-3">
        <p className={`text-xs ${isDark ? "text-white/30" : "text-gray-400"}`}>
          Odd number of players — this player receives a half-point bye this round.
        </p>
      </div>
    </div>
  );
}

// ─── Board Result Card ────────────────────────────────────────────────────────
function BoardCard({
  game,
  players,
  onResult,
  isDark,
}: {
  game: import("@/lib/tournamentData").Game;
  players: import("@/lib/tournamentData").Player[];
  onResult: (gameId: string, result: Result) => void;
  isDark: boolean;
}) {
  const white = players.find((p) => p.id === game.whiteId)!;
  const black = players.find((p) => p.id === game.blackId)!;
  const isComplete = game.result !== "*";

  return (
    <div
      className={`rounded-xl border transition-all duration-200 ${
        isDark
          ? isComplete
            ? "bg-[oklch(0.22_0.06_145)] border-white/10"
            : "bg-[oklch(0.25_0.07_145)] border-[#4CAF50]/30 shadow-[0_0_0_1px_oklch(0.45_0.15_145/0.3)]"
          : isComplete
          ? "bg-white border-gray-100"
          : "bg-white border-[#3D6B47]/20 shadow-sm"
      }`}
    >
      {/* Board header */}
      <div
        className={`flex items-center justify-between px-5 py-3 border-b rounded-t-xl ${
          isDark ? "border-white/08 bg-white/04" : "border-gray-50 bg-gray-50/80"
        }`}
      >
        <div className="flex items-center gap-2.5">
          <span
            className={`text-sm font-bold tracking-widest uppercase ${
              isDark ? "text-white/50" : "text-gray-500"
            }`}
          >
            Board {game.board}
          </span>
          {!isComplete && (
            <span className="flex items-center gap-1.5 text-sm text-amber-500 font-semibold">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              Live
            </span>
          )}
        </div>
        {isComplete && (
          <span
            className={`text-sm font-bold px-3 py-1 rounded-full ${resultBadgeClass(game.result, isDark)}`}
          >
            {game.result}
          </span>
        )}
      </div>

      {/* Players */}
      <div className="px-4 py-4 space-y-3">
        {/* White */}
        <div className="flex items-center gap-3">
          <div
            className={`w-8 h-8 rounded-lg border-2 flex-shrink-0 ${
              isDark ? "bg-white/90 border-white/30" : "bg-white border-gray-200"
            }`}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <PlayerHoverCard player={white} isDark={isDark}>
                <span
                  className={`text-base font-bold cursor-default hover:text-[#3D6B47] transition-colors truncate ${isDark ? "text-white" : "text-gray-900"}`}
                >
                  {white.name}
                </span>
              </PlayerHoverCard>
              {white.title && (
                <span className="flex-shrink-0 text-xs font-bold text-[#3D6B47] bg-[#3D6B47]/10 px-1.5 py-0.5 rounded">
                  {white.title}
                </span>
              )}
            </div>
            <span className={`text-sm ${isDark ? "text-white/40" : "text-gray-400"}`}>
              {white.elo} ELO · {white.points}pts
            </span>
          </div>
          <span
            className={`flex-shrink-0 text-xl font-bold tabular-nums ${
              game.result === "1-0"
                ? "text-emerald-500"
                : game.result === "0-1"
                ? isDark ? "text-white/30" : "text-gray-300"
                : game.result === "½-½"
                ? "text-blue-500"
                : isDark ? "text-white/20" : "text-gray-200"
            }`}
          >
            {pointsFor(game.result, "white")}
          </span>
        </div>

        {/* Divider */}
        <div className={`border-t ${isDark ? "border-white/06" : "border-gray-100"}`} />

        {/* Black */}
        <div className="flex items-center gap-3">
          <div
            className={`w-8 h-8 rounded-lg border-2 flex-shrink-0 ${
              isDark ? "bg-[oklch(0.15_0.04_145)] border-white/10" : "bg-gray-800 border-gray-600"
            }`}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <PlayerHoverCard player={black} isDark={isDark}>
                <span
                  className={`text-base font-bold cursor-default hover:text-[#3D6B47] transition-colors truncate ${isDark ? "text-white" : "text-gray-900"}`}
                >
                  {black.name}
                </span>
              </PlayerHoverCard>
              {black.title && (
                <span className="flex-shrink-0 text-xs font-bold text-[#3D6B47] bg-[#3D6B47]/10 px-1.5 py-0.5 rounded">
                  {black.title}
                </span>
              )}
            </div>
            <span className={`text-sm ${isDark ? "text-white/40" : "text-gray-400"}`}>
              {black.elo} ELO · {black.points}pts
            </span>
          </div>
          <span
            className={`flex-shrink-0 text-xl font-bold tabular-nums ${
              game.result === "0-1"
                ? "text-emerald-500"
                : game.result === "1-0"
                ? isDark ? "text-white/30" : "text-gray-300"
                : game.result === "½-½"
                ? "text-blue-500"
                : isDark ? "text-white/20" : "text-gray-200"
            }`}
          >
            {pointsFor(game.result, "black")}
          </span>
        </div>
      </div>

      {/* Result entry buttons */}
      <div
        className={`px-4 pb-4 pt-1 flex gap-2 ${isComplete ? "opacity-60" : ""}`}
      >
        {RESULT_OPTIONS.map((opt) => {
          const isSelected = game.result === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => {
                // Haptic feedback — short pulse on record, double-pulse on re-select
                if (navigator.vibrate) {
                  navigator.vibrate(isSelected ? [30, 20, 30] : 40);
                }
                onResult(game.id, opt.value);
                toast.success(`Board ${game.board}: ${opt.label} recorded`);
              }}
              className={`flex-1 py-3 text-sm font-bold rounded-xl border transition-all duration-150 active:scale-95 ${
                isSelected
                  ? opt.value === "1-0"
                    ? "bg-emerald-500 border-emerald-500 text-white shadow-md shadow-emerald-500/30 scale-[1.03]"
                    : opt.value === "0-1"
                    ? "bg-red-500 border-red-500 text-white shadow-md shadow-red-500/30 scale-[1.03]"
                    : "bg-blue-500 border-blue-500 text-white shadow-md shadow-blue-500/30 scale-[1.03]"
                  : isDark
                  ? "bg-white/05 border-white/10 text-white/60 hover:bg-white/10 hover:text-white"
                  : "bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              }`}
            >
              {opt.short}
            </button>
          );
        })}
        {isComplete && (
          <button
            onClick={() => {
              if (navigator.vibrate) navigator.vibrate(20);
              onResult(game.id, "*");
              toast.info(`Board ${game.board}: result cleared`);
            }}
            className={`flex-shrink-0 w-11 py-3 text-sm rounded-xl border transition-all duration-150 active:scale-95 ${
              isDark
                ? "bg-white/05 border-white/10 text-white/40 hover:bg-white/10"
                : "bg-gray-50 border-gray-200 text-gray-400 hover:bg-gray-100"
            }`}
            title="Clear result"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Standings Mini Table ─────────────────────────────────────────────────────
function StandingsPanel({
  players,
  isDark,
}: {
  players: import("@/lib/tournamentData").Player[];
  isDark: boolean;
}) {
  const standings = getStandings(players);
  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div className="space-y-1.5">
      {standings.map((p, i) => (
        <div
          key={p.id}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
            i < 3
              ? isDark
                ? "bg-[#3D6B47]/20"
                : "bg-[#3D6B47]/06"
              : ""
          }`}
        >
          <span className="text-base w-6 text-center flex-shrink-0">
            {i < 3 ? medals[i] : <span className={`text-sm font-bold ${isDark ? "text-white/30" : "text-gray-300"}`}>{i + 1}</span>}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span
                className={`text-sm font-bold truncate ${isDark ? "text-white" : "text-gray-900"}`}
              >
                {p.name.split(" ")[0]}
              </span>
              {p.title && (
                <span className="text-xs font-bold text-[#3D6B47]">{p.title}</span>
              )}
            </div>
            <span className={`text-xs ${isDark ? "text-white/35" : "text-gray-400"}`}>
              {p.elo} ELO
            </span>
          </div>
          <span
            className={`text-base font-bold tabular-nums ${
              isDark ? "text-white" : "text-gray-900"
            }`}
          >
            {p.points}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Round Progress ───────────────────────────────────────────────────────────
function RoundProgress({
  rounds,
  currentRound,
  totalRounds,
  isDark,
}: {
  rounds: ReturnType<typeof useDirectorState>["state"]["rounds"];
  currentRound: number;
  totalRounds: number;
  isDark: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: totalRounds }, (_, i) => i + 1).map((r) => {
        const roundData = rounds.find((rd) => rd.number === r);
        const isComplete = roundData?.status === "completed";
        const isCurrent = r === currentRound;
        const isUpcoming = !roundData;

        return (
          <div key={r} className="flex items-center gap-2">
            <div
              className={`flex items-center justify-center w-9 h-9 rounded-full text-sm font-bold transition-all ${
                isComplete
                  ? "bg-[#3D6B47] text-white"
                  : isCurrent
                  ? isDark
                    ? "bg-[#4CAF50]/30 text-[#4CAF50] border-2 border-[#4CAF50]"
                    : "bg-[#3D6B47]/10 text-[#3D6B47] border-2 border-[#3D6B47]"
                  : isDark
                  ? "bg-white/08 text-white/30 border border-white/10"
                  : "bg-gray-100 text-gray-300 border border-gray-200"
              }`}
            >
              {isComplete ? <CheckCircle2 className="w-4 h-4" /> : r}
            </div>
            {r < totalRounds && (
              <div
                className={`h-0.5 w-5 rounded-full ${
                  isComplete
                    ? "bg-[#3D6B47]"
                    : isDark
                    ? "bg-white/10"
                    : "bg-gray-200"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Director() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const { id } = useParams<{ id: string }>();
  const tournamentId = id ?? "otb-demo-2026";
  const [, navigate] = useLocation();
  const [accessChecked, setAccessChecked] = useState(false);

  // ── Director session guard ───────────────────────────────────────────────
  // The demo tournament is always accessible so reviewers can explore freely.
  // All real tournaments require a valid director session stored in localStorage.
  useEffect(() => {
    const isDemo = tournamentId === "otb-demo-2026";
    if (isDemo || hasDirectorSession(tournamentId)) {
      setAccessChecked(true);
    } else {
      // Redirect to director-access with a ?next= param so the host can
      // re-enter their code and land back here automatically.
      navigate(`/director-access?next=/tournament/${tournamentId}/manage`);
    }
  }, [tournamentId, navigate]);
  const {
    state,
    currentRoundData,
    allResultsIn,
    canGenerateNext,
    isRegistration,
    canStart,
    liveStandings,
      lastSaved,
    addPlayer,
    removePlayer,
    startTournament,
    enterResult,
    generateNextRound,
    togglePause,
    resetTournament,
    completeTournament,
    updateSettings,
  } = useDirectorState(tournamentId);
  // ── Undo result snackbar ────────────────────────────────────────────────
  const { pending: undoPending, recordWithUndo, undo: undoResult, dismiss: dismissUndo } =
    useUndoResult(enterResult);

  // ── Round timer ────────────────────────────────────────────────────────
  const roundTimer = useRoundTimer({
    roundNumber: state.currentRound,
    onNearEnd: () => {
      // Broadcast 5-minute warning push notification
      fetch(`/api/push/notify/${tournamentId}/timer-warning`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          round: state.currentRound,
          tournamentName: state.tournamentName,
          minutesLeft: 5,
        }),
      }).catch((err) => console.warn("[timer] push warning failed:", err));
      toast.warning(`⏰ 5-minute warning sent to all participants for Round ${state.currentRound}`);
    },
    onExpired: () => {
      toast.error(`⏰ Round ${state.currentRound} time is up!`);
    },
  });

  const [resetConfirm, setResetConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState<"boards" | "players" | "settings">("boards");
  const [showQR, setShowQR] = useState(false);
  // Look up real tournament config for invite code and extra metadata
  const tournamentConfig = getTournamentConfig(tournamentId);
  const inviteCode = tournamentConfig?.inviteCode ?? "OTB2026";
  // Use invite code in join URL so it works with the wizard-generated QR links
  const joinUrl = `${window.location.origin}/join/${inviteCode}`;
  // Use live standings from Swiss engine (includes live Buchholz tiebreaks)
  const standings = liveStandings.map((s) => s.player);
  const completedGames = currentRoundData?.games.filter((g) => g.result !== "*").length ?? 0;
  const totalGames = currentRoundData?.games.length ?? 0;
  // Settings are locked once any round has been generated
  const isSettingsLocked = state.rounds.length > 0 || state.status !== "registration";

  // ── Player search / filter / sort state ─────────────────────────────────
  const [playerSearch, setPlayerSearch] = useState("");
  const [filterTitle, setFilterTitle] = useState<string>("all");
  const [filterCountry, setFilterCountry] = useState<string>("all");
  const [sortKey, setSortKey] = useState<"rank" | "elo" | "name" | "points">("rank");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [showFilters, setShowFilters] = useState(false);
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [showStartConfirm, setShowStartConfirm] = useState(false);

  // ── Push notification broadcasts ────────────────────────────────────────
  const broadcastRoundStart = useCallback(async (round: number) => {
    const tournamentName = state.tournamentName ?? "OTB Chess Tournament";
    try {
      const res = await fetch(`/api/push/notify/${tournamentId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ round, tournamentName }),
      });
      if (res.ok) {
        const data = await res.json() as { sent: number; failed: number };
        if (data.sent > 0) {
          toast.success(`Notified ${data.sent} player${data.sent !== 1 ? "s" : ""} about Round ${round} pairings`);
        }
      }
    } catch {
      // Silent fail — push is a best-effort enhancement
    }
  }, [tournamentId, state.tournamentName]);

  const broadcastResultsPosted = useCallback(async (round: number) => {
    const tournamentName = state.tournamentName ?? "OTB Chess Tournament";
    try {
      const res = await fetch(`/api/push/notify/${tournamentId}/results`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ round, tournamentName }),
      });
      if (res.ok) {
        const data = await res.json() as { sent: number; failed: number };
        if (data.sent > 0) {
          toast.success(`Notified ${data.sent} player${data.sent !== 1 ? "s" : ""} — Round ${round} results posted`);
        }
      }
    } catch {
      // Silent fail — push is a best-effort enhancement
    }
  }, [tournamentId, state.tournamentName]);

  // Auto-broadcast results notification when all games in the current round
  // transition from incomplete to complete. We track the previous value of
  // allResultsIn so we only fire once per round, not on every re-render.
  const prevAllResultsIn = useRef(false);
  useEffect(() => {
    if (
      allResultsIn &&
      !prevAllResultsIn.current &&
      !isRegistration &&
      state.currentRound > 0
    ) {
      broadcastResultsPosted(state.currentRound);
    }
    prevAllResultsIn.current = allResultsIn;
  }, [allResultsIn, isRegistration, state.currentRound, broadcastResultsPosted]);

  // Derived: filtered + sorted player list
  const allTitles = Array.from(new Set(standings.map((p) => p.title).filter(Boolean))) as string[];
  const allCountries = Array.from(new Set(standings.map((p) => p.country)));
  const existingUsernames = state.players.map((p) => p.username);

  const filteredPlayers = standings
    .filter((p) => {
      const q = playerSearch.toLowerCase();
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.username.toLowerCase().includes(q) ||
        String(p.elo).includes(q);
      const matchesTitle = filterTitle === "all" || p.title === filterTitle || (filterTitle === "untitled" && !p.title);
      const matchesCountry = filterCountry === "all" || p.country === filterCountry;
      return matchesSearch && matchesTitle && matchesCountry;
    })
    .sort((a, b) => {
      let cmp = 0;
      if (sortKey === "rank")   cmp = standings.indexOf(a) - standings.indexOf(b);
      if (sortKey === "elo")    cmp = b.elo - a.elo;
      if (sortKey === "name")   cmp = a.name.localeCompare(b.name);
      if (sortKey === "points") cmp = b.points - a.points;
      return sortDir === "asc" ? cmp : -cmp;
    });

  const activeFilterCount = (filterTitle !== "all" ? 1 : 0) + (filterCountry !== "all" ? 1 : 0);

  function toggleSort(key: typeof sortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  // Show a minimal loading screen while the session check runs (avoids flash)
  if (!accessChecked) {
    return (
      <div
        className={`min-h-screen flex items-center justify-center transition-colors duration-300 ${
          isDark ? "bg-[oklch(0.18_0.05_145)]" : "bg-[#F7FAF8]"
        }`}
      >
        <div className="flex flex-col items-center gap-3">
          <Shield className={`w-8 h-8 animate-pulse ${
            isDark ? "text-[#4CAF50]" : "text-[#3D6B47]"
          }`} />
          <p className={`text-sm font-medium ${
            isDark ? "text-white/50" : "text-gray-400"
          }`}>
            Checking director access…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen transition-colors duration-300 ${
        isDark ? "bg-[oklch(0.18_0.05_145)]" : "bg-[#F7FAF8]"
      }`}
    >
      {/* ── Top Bar ─────────────────────────────────────────────────────────── */}
      <header
        className={`sticky top-0 z-40 border-b transition-colors duration-300 ${
          isDark
            ? "bg-[oklch(0.20_0.06_145)]/95 backdrop-blur-md border-white/08"
            : "bg-white/95 backdrop-blur-md border-gray-100"
        }`}
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between gap-3">
          {/* Left: back + breadcrumb */}
          <div className="flex items-center gap-2 min-w-0">
            <Link
              href={`/tournament/${id ?? "otb-demo-2026"}`}
              className={`touch-target -ml-1 flex items-center gap-1.5 text-sm font-medium transition-colors active:scale-95 ${
                isDark ? "text-white/50 hover:text-white/80" : "text-gray-400 hover:text-gray-700"
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:block">Standings</span>
            </Link>
            <span className={`text-sm ${isDark ? "text-white/20" : "text-gray-300"}`}>/</span>
            <div className="flex items-center gap-2 min-w-0">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${isDark ? "bg-[#4CAF50]/20" : "bg-[#3D6B47]/10"}`}>
                <Shield className="w-4 h-4 text-[#3D6B47]" />
              </div>
              <span
                className={`text-base font-bold truncate ${isDark ? "text-white" : "text-gray-900"}`}
                style={{ fontFamily: "'Clash Display', sans-serif" }}
              >
                Director
              </span>
            </div>
          </div>

          {/* Center: Tournament name */}
          <div className="hidden lg:block text-center">
            <p
              className={`text-sm font-bold truncate max-w-xs ${isDark ? "text-white" : "text-gray-900"}`}
              style={{ fontFamily: "'Clash Display', sans-serif" }}
            >
              {state.tournamentName}
            </p>
            <p className={`text-xs mt-0.5 ${isDark ? "text-white/40" : "text-gray-500"}`}>
              {isRegistration ? `Registration · ${state.players.length} players` : `Round ${state.currentRound} of ${state.totalRounds}`}
              {lastSaved && (
                <span className={`ml-2 ${isDark ? "text-[#4CAF50]/60" : "text-[#3D6B47]/60"}`}>
                  · Saved {new Date(lastSaved).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </p>
          </div>

          {/* Right: Status + controls */}
          <div className="flex items-center gap-1.5">
            {/* Capacity badge — only shown when a maxPlayers cap is set */}
            {tournamentConfig?.maxPlayers != null && tournamentConfig.maxPlayers > 0 && (
              <CapacityBadge
                current={state.players.length}
                max={tournamentConfig.maxPlayers}
                isDark={isDark}
                size="sm"
              />
            )}
            <span
              className={`flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-full ${
                state.status === "paused"
                  ? isDark ? "bg-amber-500/20 text-amber-400" : "bg-amber-50 text-amber-600"
                  : isDark ? "bg-[#3D6B47]/30 text-[#4CAF50]" : "bg-[#3D6B47]/10 text-[#3D6B47]"
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  state.status === "paused" ? "bg-amber-400" : "bg-[#4CAF50] animate-pulse"
                }`}
              />
              <span className="hidden sm:block">{state.status === "paused" ? "Paused" : "Live"}</span>
            </span>
            <button
              onClick={() => { togglePause(); toast.info(state.status === "paused" ? "Tournament resumed" : "Tournament paused"); }}
              className={`touch-target p-2 rounded-xl transition-all active:scale-95 ${
                isDark ? "hover:bg-white/08 text-white/60" : "hover:bg-gray-100 text-gray-500"
              }`}
              title={state.status === "paused" ? "Resume" : "Pause"}
            >
              {state.status === "paused" ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            </button>
            <button
              onClick={() => { navigator.clipboard.writeText(joinUrl); toast.success("Join link copied — share with players!"); }}
              className={`touch-target p-2 rounded-xl transition-all active:scale-95 hidden sm:flex ${
                isDark ? "hover:bg-white/08 text-white/60" : "hover:bg-gray-100 text-gray-500"
              }`}
              title="Announce"
            >
              <Bell className="w-4 h-4" />
            </button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-6 sm:py-8 flex gap-8">
        {/* ── Left Sidebar ──────────────────────────────────────────────────── */}
        <aside className="hidden lg:flex flex-col gap-5 w-72 flex-shrink-0">
          {/* Event Info Card */}
          <div
            className={`rounded-2xl border p-5 ${
              isDark ? "bg-[oklch(0.22_0.06_145)] border-white/08" : "bg-white border-gray-100"
            }`}
          >
            <h3
              className={`text-xs font-bold uppercase tracking-widest mb-4 ${isDark ? "text-white/40" : "text-gray-400"}`}
            >
              Event Info
            </h3>
            <div className="space-y-4">
              {[
                { icon: Trophy, label: "Format", value: `Swiss · ${state.totalRounds}R` },
                // Players row replaced below with CapacityBadge — see separate render
                ...(tournamentConfig?.maxPlayers == null || tournamentConfig.maxPlayers <= 0
                  ? [{ icon: Users, label: "Players", value: `${state.players.length} registered` }]
                  : []),
                ...(tournamentConfig?.venue ? [{ icon: MapPin, label: "Venue", value: tournamentConfig.venue }] : []),
                ...(tournamentConfig?.date ? [{ icon: Clock, label: "Date", value: tournamentConfig.date }] : []),
                ...(tournamentConfig?.timePreset ? [{ icon: Clock, label: "Time Control", value: tournamentConfig.timePreset }] : []),
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isDark ? "bg-[#4CAF50]/10" : "bg-[#3D6B47]/08"}`}>
                    <Icon className={`w-4 h-4 ${isDark ? "text-[#4CAF50]" : "text-[#3D6B47]"}`} />
                  </div>
                  <div>
                    <p className={`text-xs ${isDark ? "text-white/35" : "text-gray-400"}`}>{label}</p>
                    <p className={`text-sm font-semibold ${isDark ? "text-white" : "text-gray-800"}`}>{value}</p>
                  </div>
                </div>
              ))}
              {/* Capacity row — only when maxPlayers is set */}
              {tournamentConfig?.maxPlayers != null && tournamentConfig.maxPlayers > 0 && (
                <CapacityBadge
                  current={state.players.length}
                  max={tournamentConfig.maxPlayers}
                  isDark={isDark}
                  size="md"
                />
              )}
            </div>
          </div>

          {/* Round Progress */}
          <div
            className={`rounded-2xl border p-5 ${
              isDark ? "bg-[oklch(0.22_0.06_145)] border-white/08" : "bg-white border-gray-100"
            }`}
          >
            <h3
              className={`text-xs font-bold uppercase tracking-widest mb-4 ${isDark ? "text-white/40" : "text-gray-400"}`}
            >
              Round Progress
            </h3>
            <RoundProgress
              rounds={state.rounds}
              currentRound={state.currentRound}
              totalRounds={state.totalRounds}
              isDark={isDark}
            />
            <div className={`mt-4 pt-4 border-t ${isDark ? "border-white/08" : "border-gray-100"}`}>
              <div className="flex justify-between text-sm">
                <span className={isDark ? "text-white/50" : "text-gray-500"}>Round {state.currentRound}</span>
                <span className={`font-bold ${isDark ? "text-white" : "text-gray-800"}`}>
                  {completedGames}/{totalGames} results
                </span>
              </div>
              <div className={`mt-2 h-2 rounded-full overflow-hidden ${isDark ? "bg-white/10" : "bg-gray-100"}`}>
                <div
                  className="h-full bg-[#3D6B47] rounded-full transition-all duration-500"
                  style={{ width: totalGames ? `${(completedGames / totalGames) * 100}%` : "0%" }}
                />
              </div>
            </div>
          </div>

          {/* Round Timer — only when tournament is active */}
          {!isRegistration && (
            <RoundTimerCard
              timer={roundTimer}
              roundNumber={state.currentRound}
              isDark={isDark}
            />
          )}

          {/* Live Standings */}
          <div
            className={`rounded-2xl border p-5 flex-1 ${
              isDark ? "bg-[oklch(0.22_0.06_145)] border-white/08" : "bg-white border-gray-100"
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <h3
                className={`text-xs font-bold uppercase tracking-widest ${isDark ? "text-white/40" : "text-gray-400"}`}
              >
                Live Standings
              </h3>
              <BarChart3 className={`w-4 h-4 ${isDark ? "text-white/30" : "text-gray-300"}`} />
            </div>
            <StandingsPanel players={state.players} isDark={isDark} />
          </div>

          {/* Quick actions */}
          <div className="space-y-2.5">
            <button
              onClick={() => setShowQR(true)}
              className={`w-full flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-semibold border transition-all ${
                isDark ? "border-[#4CAF50]/30 text-[#4CAF50] bg-[#3D6B47]/10 hover:bg-[#3D6B47]/20" : "border-[#3D6B47]/30 text-[#3D6B47] bg-[#3D6B47]/06 hover:bg-[#3D6B47]/12"
              }`}
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="3" height="3" rx="0.5"/><rect x="19" y="14" width="2" height="2" rx="0.5"/><rect x="14" y="19" width="2" height="2" rx="0.5"/><rect x="18" y="18" width="3" height="3" rx="0.5"/></svg>
              Show QR Code
            </button>
            <button
              onClick={() => { navigator.clipboard.writeText(joinUrl); toast.success("Join link copied!"); }}
              className={`w-full flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium border transition-colors ${
                isDark ? "border-white/10 text-white/60 hover:bg-white/05" : "border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              <Copy className="w-4 h-4" /> Copy join link
            </button>
            <Link
              href={`/tournament/${id ?? "otb-demo-2026"}/print`}
              className={`w-full flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium border transition-colors ${
                isDark ? "border-white/10 text-white/60 hover:bg-white/05" : "border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              <Download className="w-4 h-4" /> Pairings &amp; Print Sheet
            </Link>
            {/* Download Results PDF — visible once at least one round has results */}
            {state.rounds.some((r) => r.games.some((g) => g.result !== "*")) && (
              <button
                onClick={() => {
                  generateResultsPdf({
                    tournamentName: state.tournamentName,
                    date: tournamentConfig?.date,
                    location: tournamentConfig?.venue,
                    timeControl: tournamentConfig?.timePreset,
                    totalRounds: state.totalRounds,
                    players: state.players,
                    rounds: state.rounds,
                  });
                  toast.success("Results PDF downloaded!");
                }}
                className={`w-full flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-semibold border transition-all active:scale-[0.98] ${
                  isDark
                    ? "border-[#4CAF50]/30 text-[#4CAF50] bg-[#3D6B47]/10 hover:bg-[#3D6B47]/20"
                    : "border-[#3D6B47]/30 text-[#3D6B47] bg-[#3D6B47]/06 hover:bg-[#3D6B47]/12"
                }`}
              >
                <Download className="w-4 h-4" />
                Download Results PDF
              </button>
            )}
          </div>
        </aside>

        {/* ── Main Panel ────────────────────────────────────────────────────── */}
        <main className="flex-1 min-w-0 space-y-5">
          {/* Page Title + Generate Next Round CTA */}
          <div className="space-y-3">
            {/* Round title row */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1
                  className={`text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-gray-900"}`}
                  style={{ fontFamily: "'Clash Display', sans-serif" }}
                >
                  Round {state.currentRound}
                  {state.status === "paused" && (
                    <span className="ml-2 text-sm font-medium text-amber-500 align-middle">· Paused</span>
                  )}
                </h1>
                <p className={`text-sm mt-0.5 ${isDark ? "text-white/40" : "text-gray-500"}`}>
                  {completedGames === totalGames && totalGames > 0
                    ? "All results recorded — ready for next round"
                    : `${totalGames - completedGames} game${totalGames - completedGames !== 1 ? "s" : ""} in progress`}
                </p>
              </div>
              {/* Generate Next Round — top-right on mobile */}
              {canGenerateNext && (
                <button
                  onClick={() => {
                    const nextRound = state.currentRound + 1;
                    generateNextRound();
                    toast.success(`Round ${nextRound} pairings generated!`);
                    broadcastRoundStart(nextRound);
                  }}
                  className="touch-target flex items-center gap-2 px-4 sm:px-5 py-2.5 bg-[#3D6B47] text-white text-sm font-bold rounded-xl hover:bg-[#2A4A32] transition-all duration-200 active:scale-95 shadow-md shadow-[#3D6B47]/30"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span className="hidden sm:block">Generate Round {state.currentRound + 1}</span>
                  <span className="sm:hidden">R{state.currentRound + 1}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Tab bar — full width on mobile, inline on sm+ */}
            <div
              className={`flex rounded-2xl p-1.5 w-full sm:w-auto ${
                isDark ? "bg-white/08" : "bg-gray-100"
              }`}
            >
              {(["boards", "players", "settings"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`touch-target flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-sm font-semibold capitalize transition-all active:scale-95 flex items-center justify-center gap-2 ${
                    activeTab === tab
                      ? isDark
                        ? "bg-[#3D6B47] text-white shadow-sm"
                        : "bg-white text-gray-900 shadow-sm"
                      : isDark
                      ? "text-white/50 hover:text-white/70"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  {tab === "players" && state.players.length > 0 && (
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full leading-none ${
                      activeTab === "players"
                        ? isDark ? "bg-white/20 text-white" : "bg-gray-100 text-gray-700"
                        : isDark ? "bg-white/10 text-white/60" : "bg-gray-200 text-gray-500"
                    }`}>
                      {state.players.length}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* ── Boards Tab ──────────────────────────────────────────────────── */}
          {activeTab === "boards" && (
            <>
              {/* Registration panel — shown for newly created tournaments */}
              {isRegistration && (
                <div className={`rounded-2xl border p-6 space-y-5 ${isDark ? "bg-[oklch(0.22_0.06_145)] border-white/10" : "bg-white border-gray-100"}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? "bg-[#4CAF50]/20" : "bg-[#3D6B47]/10"}`}>
                      <Users className={`w-5 h-5 ${isDark ? "text-[#4CAF50]" : "text-[#3D6B47]"}`} />
                    </div>
                    <div>
                      <h3 className={`text-base font-bold ${isDark ? "text-white" : "text-gray-900"}`} style={{ fontFamily: "'Clash Display', sans-serif" }}>Registration Open</h3>
                      <p className={`text-xs ${isDark ? "text-white/40" : "text-gray-500"}`}>Share the join link so players can register</p>
                    </div>
                  </div>

                  {/* Join URL */}
                  <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border ${isDark ? "bg-white/05 border-white/10" : "bg-gray-50 border-gray-200"}`}>
                    <span className={`text-xs font-mono flex-1 truncate ${isDark ? "text-white/60" : "text-gray-600"}`}>{joinUrl}</span>
                    <button
                      onClick={() => { navigator.clipboard.writeText(joinUrl); toast.success("Join link copied!"); }}
                      className={`flex-shrink-0 p-1.5 rounded-lg transition-colors ${isDark ? "hover:bg-white/10 text-white/40" : "hover:bg-gray-200 text-gray-400"}`}
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setShowQR(true)}
                      className={`flex-shrink-0 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${isDark ? "bg-[#4CAF50]/20 text-[#4CAF50] hover:bg-[#4CAF50]/30" : "bg-[#3D6B47]/10 text-[#3D6B47] hover:bg-[#3D6B47]/20"}`}
                    >
                      QR
                    </button>
                  </div>

                  {/* Registered players */}
                  {state.players.length > 0 ? (
                    <div className="space-y-2">
                      <p className={`text-xs font-semibold uppercase tracking-wider ${isDark ? "text-white/30" : "text-gray-400"}`}>{state.players.length} Player{state.players.length !== 1 ? "s" : ""} Registered</p>
                      <div className="space-y-1.5">
                        {state.players.map((p) => (
                          <div key={p.id} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg group ${isDark ? "bg-white/05" : "bg-gray-50"}`}>
                            <PlayerAvatar username={p.username} name={p.name} size={28} showBadge platform={p.platform} avatarUrl={p.avatarUrl} flairEmoji={p.flairEmoji} />
                            <span className={`text-sm font-semibold flex-1 ${isDark ? "text-white" : "text-gray-900"}`}>{p.name}</span>
                            {p.title && <span className="text-xs font-bold text-[#3D6B47] bg-[#3D6B47]/10 px-1.5 py-0.5 rounded">{p.title}</span>}
                            <span className={`text-xs tabular-nums ${isDark ? "text-white/40" : "text-gray-400"}`}>{p.elo}</span>
                            <button
                              onClick={() => { removePlayer(p.id); toast.success(`${p.name} removed`); }}
                              className={`opacity-0 group-hover:opacity-100 focus:opacity-100 ml-1 p-1 rounded-md transition-all ${isDark ? "text-white/30 hover:text-red-400 hover:bg-red-500/10" : "text-gray-300 hover:text-red-500 hover:bg-red-50"}`}
                              title="Remove player"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className={`text-center py-6 rounded-xl border border-dashed ${isDark ? "border-white/10 text-white/30" : "border-gray-200 text-gray-400"}`}>
                      <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No players yet — share the join link above</p>
                    </div>
                  )}

                  {/* Start button */}
                  <button
                    onClick={() => { if (canStart) { startTournament(); toast.success("Round 1 pairings generated!"); broadcastRoundStart(1); } }}
                    disabled={!canStart}
                    className={`w-full py-3 rounded-xl font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2 ${
                      canStart
                        ? "bg-[#3D6B47] hover:bg-[#2d5235] text-white shadow-md"
                        : isDark ? "bg-white/08 text-white/20 cursor-not-allowed" : "bg-gray-100 text-gray-300 cursor-not-allowed"
                    }`}
                  >
                    <Zap className="w-4 h-4" />
                    {canStart ? `Start Tournament → Generate Round 1` : `Need at least 2 players to start`}
                  </button>
                </div>
              )}

              {/* Status banner */}
              {!isRegistration && allResultsIn && canGenerateNext && (
                <div
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${
                    isDark
                      ? "bg-[#3D6B47]/20 border-[#4CAF50]/30 text-[#4CAF50]"
                      : "bg-[#3D6B47]/08 border-[#3D6B47]/20 text-[#3D6B47]"
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  <p className="text-sm font-medium">
                    All results for Round {state.currentRound} are in. Click{" "}
                    <strong>Generate Round {state.currentRound + 1}</strong> to create Swiss pairings.
                  </p>
                </div>
              )}

              {allResultsIn && !canGenerateNext && state.currentRound >= state.totalRounds && (
                <div
                  className={`rounded-xl border p-4 space-y-3 ${
                    isDark
                      ? "bg-[#3D6B47]/15 border-[#4CAF50]/30"
                      : "bg-[#3D6B47]/06 border-[#3D6B47]/20"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isDark ? "bg-[#4CAF50]/20" : "bg-[#3D6B47]/10"}`}>
                      <Trophy className={`w-4.5 h-4.5 ${isDark ? "text-[#4CAF50]" : "text-[#3D6B47]"}`} />
                    </div>
                    <div>
                      <p className={`text-sm font-bold ${isDark ? "text-white" : "text-gray-900"}`} style={{ fontFamily: "'Clash Display', sans-serif" }}>
                        Tournament Complete!
                      </p>
                      <p className={`text-xs ${isDark ? "text-white/50" : "text-gray-500"}`}>
                        All {state.totalRounds} rounds finished · Final standings ready
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/tournament/${tournamentId}`}>
                      <button className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors active:scale-95 ${
                        isDark ? "bg-[#4CAF50]/20 text-[#4CAF50] hover:bg-[#4CAF50]/30" : "bg-[#3D6B47] text-white hover:bg-[#2d5235]"
                      }`}>
                        <BarChart3 className="w-4 h-4" /> View Results
                      </button>
                    </Link>
                    <Link href={`/tournament/${tournamentId}/report`}>
                      <button className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors active:scale-95 ${
                        isDark ? "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30" : "bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100"
                      }`}>
                        <Trophy className="w-4 h-4" /> Player Reports
                      </button>
                    </Link>
                    <Link href={`/tournament/${tournamentId}/print`}>
                      <button className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors active:scale-95 ${
                        isDark ? "bg-white/10 text-white/70 hover:bg-white/15" : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
                      }`}>
                        <Download className="w-4 h-4" /> Print / Export
                      </button>
                    </Link>
                  </div>
                </div>
              )}

              {!allResultsIn && (
                <div
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${
                    isDark
                      ? "bg-white/04 border-white/08 text-white/50"
                      : "bg-gray-50 border-gray-100 text-gray-500"
                  }`}
                >
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <p className="text-sm">
                    Enter results for all boards to unlock next round pairing generation.
                  </p>
                </div>
              )}

              {/* Board cards grid — only shown after tournament starts */}
              {!isRegistration && currentRoundData ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {currentRoundData.games.map((game) =>
                    game.whiteId === "BYE" ? (
                      <ByeCard
                        key={game.id}
                        game={game}
                        players={state.players}
                        isDark={isDark}
                      />
                    ) : (
                      <BoardCard
                        key={game.id}
                        game={game}
                        players={state.players}
                        onResult={(gameId, newResult) => {
                          const prevResult = game.result;
                          const white = state.players.find((p) => p.id === game.whiteId);
                          const black = state.players.find((p) => p.id === game.blackId);
                          const label =
                            newResult === "*"
                              ? `Board ${game.board}: cleared`
                              : `Board ${game.board}: ${
                                  newResult === "1-0"
                                    ? `${white?.name ?? "White"} wins`
                                    : newResult === "0-1"
                                    ? `${black?.name ?? "Black"} wins`
                                    : "Draw"
                                }`;
                          recordWithUndo(gameId, newResult, prevResult, label);
                        }}
                        isDark={isDark}
                      />
                    )
                  )}
                </div>
              ) : (
                <div
                  className={`flex flex-col items-center justify-center py-16 rounded-xl border ${
                    isDark ? "border-white/08 text-white/30" : "border-gray-100 text-gray-300"
                  }`}
                >
                  <Circle className="w-10 h-10 mb-3" />
                  <p className="text-sm font-medium">No round data yet</p>
                </div>
              )}

              {/* Previous rounds summary */}
              {state.rounds.filter((r) => r.number < state.currentRound).length > 0 && (
                <div>
                  <h2
                    className={`text-xs font-bold uppercase tracking-widest mb-3 ${isDark ? "text-white/30" : "text-gray-400"}`}
                  >
                    Completed Rounds
                  </h2>
                  <div className="space-y-2">
                    {state.rounds
                      .filter((r) => r.number < state.currentRound)
                      .reverse()
                      .map((round) => (
                        <div
                          key={round.number}
                          className={`rounded-xl border px-4 py-3 ${
                            isDark ? "bg-[oklch(0.22_0.06_145)] border-white/06" : "bg-white border-gray-100"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span
                              className={`text-xs font-bold ${isDark ? "text-white/50" : "text-gray-500"}`}
                            >
                              Round {round.number}
                            </span>
                            <span className="flex items-center gap-1 text-xs text-[#3D6B47] font-medium">
                              <CheckCircle2 className="w-3 h-3" /> Complete
                            </span>
                          </div>
                          <div className="space-y-1.5">
                            {round.games.map((g) => {
                              const w = state.players.find((p) => p.id === g.whiteId);
                              const b = state.players.find((p) => p.id === g.blackId);
                              return (
                                <div key={g.id} className="flex items-center gap-2 min-w-0">
                                  <span className={`flex-1 truncate text-xs font-medium ${isDark ? "text-white/70" : "text-gray-700"}`}>
                                    {w?.name.split(" ")[0]}
                                  </span>
                                  <span
                                    className={`flex-shrink-0 font-bold px-2 py-0.5 rounded-md text-xs ${resultBadgeClass(g.result, isDark)}`}
                                  >
                                    {g.result}
                                  </span>
                                  <span className={`flex-1 truncate text-xs font-medium text-right ${isDark ? "text-white/70" : "text-gray-700"}`}>
                                    {b?.name.split(" ")[0]}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </>
          )}

          {/* ── Players Tab ─────────────────────────────────────────────────── */}
          {activeTab === "players" && (
            <div className="space-y-3">
              {/* ── Search + Filter Toolbar ──────────────────────────────────────── */}
              <div className={`rounded-xl border p-3 space-y-3 ${
                isDark ? "bg-[oklch(0.22_0.06_145)] border-white/08" : "bg-white border-gray-100"
              }`}>
                {/* Top row: title + search + filter toggle */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <div className="flex items-center gap-2">
                    <h2
                      className={`text-sm font-semibold flex-shrink-0 ${isDark ? "text-white/80" : "text-gray-700"}`}
                      style={{ fontFamily: "'Clash Display', sans-serif" }}
                    >
                      Roster
                    </h2>
                    <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
                      isDark ? "bg-white/10 text-white/50" : "bg-[#F0F5EE] text-[#6B7280]"
                    }`}>
                      {filteredPlayers.length}/{state.players.length}
                    </span>
                  </div>

                  {/* Search input — full width on mobile */}
                  <div className={`relative flex-1 w-full sm:max-w-xs`}>
                    <Search className={`absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none ${
                      isDark ? "text-white/30" : "text-gray-400"
                    }`} />
                    <input
                      type="text"
                      value={playerSearch}
                      onChange={(e) => setPlayerSearch(e.target.value)}
                      placeholder="Search name, username, ELO…"
                      className={`w-full pl-8 pr-8 py-1.5 text-xs rounded-lg border outline-none transition-colors ${
                        isDark
                          ? "bg-white/06 border-white/10 text-white placeholder:text-white/30 focus:border-[#4CAF50]/50 focus:bg-white/08"
                          : "bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-[#3D6B47]/40 focus:bg-white"
                      }`}
                    />
                    {playerSearch && (
                      <button
                        onClick={() => setPlayerSearch("")}
                        className={`absolute right-2.5 top-1/2 -translate-y-1/2 ${
                          isDark ? "text-white/40 hover:text-white/70" : "text-gray-400 hover:text-gray-600"
                        }`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {/* Filter + Add Player row */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => setShowFilters((f) => !f)}
                      className={`flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border transition-all ${
                        showFilters || activeFilterCount > 0
                          ? isDark
                            ? "bg-[#3D6B47]/30 border-[#4CAF50]/40 text-[#4CAF50]"
                            : "bg-[#3D6B47]/08 border-[#3D6B47]/30 text-[#3D6B47]"
                          : isDark
                          ? "border-white/10 text-white/50 hover:text-white/70 hover:border-white/20"
                          : "border-gray-200 text-gray-500 hover:text-gray-700 hover:border-gray-300"
                      }`}
                    >
                      <Filter className="w-3.5 h-3.5" />
                      Filters
                      {activeFilterCount > 0 && (
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                          isDark ? "bg-[#4CAF50]/30 text-[#4CAF50]" : "bg-[#3D6B47] text-white"
                        }`}>
                          {activeFilterCount}
                        </span>
                      )}
                      <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${
                        showFilters ? "rotate-180" : ""
                      }`} />
                    </button>
                    {/* Add Player button — only during registration */}
                    {isRegistration && (
                      <button
                        onClick={() => setShowAddPlayer(true)}
                        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg transition-all"
                        style={{ background: "#3D6B47", color: "#FFFFFF" }}
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        Add Player
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded filter panel */}
                {showFilters && (
                  <div className={`pt-3 border-t space-y-3 ${
                    isDark ? "border-white/08" : "border-gray-100"
                  }`}>
                    <div className="grid grid-cols-2 gap-3">
                      {/* Title filter */}
                      <div>
                        <label className={`block text-[10px] font-semibold uppercase tracking-widest mb-1.5 ${
                          isDark ? "text-white/30" : "text-gray-400"
                        }`}>Title</label>
                        <div className="flex flex-wrap gap-1.5">
                          {["all", ...allTitles, "untitled"].map((t) => (
                            <button
                              key={t}
                              onClick={() => setFilterTitle(t)}
                              className={`text-xs px-2.5 py-1 rounded-md font-medium transition-all ${
                                filterTitle === t
                                  ? isDark
                                    ? "bg-[#3D6B47] text-white"
                                    : "bg-[#3D6B47] text-white"
                                  : isDark
                                  ? "bg-white/06 text-white/50 hover:bg-white/10 hover:text-white/70"
                                  : "bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700"
                              }`}
                            >
                              {t === "all" ? "All titles" : t === "untitled" ? "Untitled" : t}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Country filter */}
                      <div>
                        <label className={`block text-[10px] font-semibold uppercase tracking-widest mb-1.5 ${
                          isDark ? "text-white/30" : "text-gray-400"
                        }`}>Country</label>
                        <div className="flex flex-wrap gap-1.5">
                          {["all", ...allCountries].map((c) => (
                            <button
                              key={c}
                              onClick={() => setFilterCountry(c)}
                              className={`text-xs px-2.5 py-1 rounded-md font-medium transition-all ${
                                filterCountry === c
                                  ? isDark
                                    ? "bg-[#3D6B47] text-white"
                                    : "bg-[#3D6B47] text-white"
                                  : isDark
                                  ? "bg-white/06 text-white/50 hover:bg-white/10 hover:text-white/70"
                                  : "bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700"
                              }`}
                            >
                              {c === "all" ? "All countries" : `${FLAG_EMOJI[c] ?? ""} ${c}`}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Clear filters */}
                    {activeFilterCount > 0 && (
                      <button
                        onClick={() => { setFilterTitle("all"); setFilterCountry("all"); }}
                        className={`text-xs font-medium flex items-center gap-1 ${
                          isDark ? "text-red-400 hover:text-red-300" : "text-red-500 hover:text-red-600"
                        }`}
                      >
                        <X className="w-3 h-3" /> Clear all filters
                      </button>
                    )}
                  </div>
                )}

                {/* Sort controls */}
                <div className={`flex items-center gap-1.5 pt-2 border-t ${
                  isDark ? "border-white/06" : "border-gray-50"
                }`}>
                  <span className={`text-[10px] font-semibold uppercase tracking-widest mr-1 ${
                    isDark ? "text-white/30" : "text-gray-400"
                  }`}>Sort</span>
                  {(["rank", "points", "elo", "name"] as const).map((key) => (
                    <button
                      key={key}
                      onClick={() => toggleSort(key)}
                      className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-md font-medium transition-all ${
                        sortKey === key
                          ? isDark
                            ? "bg-[#3D6B47]/40 text-[#4CAF50] border border-[#4CAF50]/30"
                            : "bg-[#3D6B47]/10 text-[#3D6B47] border border-[#3D6B47]/20"
                          : isDark
                          ? "text-white/40 hover:text-white/60 border border-transparent hover:border-white/10"
                          : "text-gray-400 hover:text-gray-600 border border-transparent hover:border-gray-200"
                      }`}
                    >
                      {key.charAt(0).toUpperCase() + key.slice(1)}
                      {sortKey === key && (
                        sortDir === "asc"
                          ? <SortAsc className="w-3 h-3" />
                          : <SortDesc className="w-3 h-3" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Empty state */}
              {filteredPlayers.length === 0 && (
                <div className={`rounded-xl border flex flex-col items-center justify-center py-12 gap-3 ${
                  isDark ? "border-white/08 bg-[oklch(0.22_0.06_145)]" : "border-gray-100 bg-white"
                }`}>
                  <Search className={`w-8 h-8 ${
                    isDark ? "text-white/20" : "text-gray-200"
                  }`} />
                  <div className="text-center">
                    <p className={`text-sm font-medium ${
                      isDark ? "text-white/50" : "text-gray-500"
                    }`}>No players found</p>
                    <p className={`text-xs mt-0.5 ${
                      isDark ? "text-white/30" : "text-gray-400"
                    }`}>Try adjusting your search or filters</p>
                  </div>
                  <button
                    onClick={() => { setPlayerSearch(""); setFilterTitle("all"); setFilterCountry("all"); }}
                    className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                      isDark
                        ? "border-white/15 text-white/50 hover:bg-white/06"
                        : "border-gray-200 text-gray-500 hover:bg-gray-50"
                    }`}
                  >
                    Clear search &amp; filters
                  </button>
                </div>
              )}

              {/* Desktop: list view */}
              {filteredPlayers.length > 0 && (
              <div className={`hidden sm:block rounded-xl border overflow-hidden ${
                isDark ? "bg-[oklch(0.22_0.06_145)] border-white/08" : "bg-white border-gray-100"
              }`}>
                <div className="divide-y divide-gray-100">
                  {filteredPlayers.map((p, i) => (
                    <div
                      key={p.id}
                      className={`flex items-center gap-4 px-5 py-4 transition-colors ${
                        isDark ? "hover:bg-white/03" : "hover:bg-gray-50"
                      }`}
                    >
                      <span className={`w-6 text-center text-sm font-bold ${isDark ? "text-white/30" : "text-gray-300"}`}>
                        {i + 1}
                      </span>
                      <PlayerAvatar username={p.username} name={p.name} size={36} showBadge platform={p.platform} avatarUrl={p.avatarUrl} flairEmoji={p.flairEmoji} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <PlayerHoverCard player={p} isDark={isDark}>
                            <span className={`text-base font-bold cursor-default hover:text-[#3D6B47] transition-colors ${isDark ? "text-white" : "text-gray-900"}`}>{p.name}</span>
                          </PlayerHoverCard>
                          {p.title && (
                            <span className="text-xs font-bold text-[#3D6B47] bg-[#3D6B47]/10 px-1.5 py-0.5 rounded">{p.title}</span>
                          )}
                          <span className="text-sm">{FLAG_EMOJI[p.country]}</span>
                          {p.joinedAt && Date.now() - p.joinedAt < 5 * 60 * 1000 && (
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500 text-white animate-pulse">New</span>
                          )}
                        </div>
                        <span className={`text-sm ${isDark ? "text-white/40" : "text-gray-400"}`}>@{p.username} · {p.elo} ELO</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-center">
                        <div>
                          <p className={`font-bold text-lg ${isDark ? "text-white" : "text-gray-900"}`}>{p.points}</p>
                          <p className={isDark ? "text-white/30" : "text-gray-400"}>pts</p>
                        </div>
                        <div className={`${isDark ? "text-white/30" : "text-gray-300"}`}>|</div>
                        <div>
                          <p className={`font-semibold ${isDark ? "text-white/70" : "text-gray-600"}`}>{p.wins}W {p.draws}D {p.losses}L</p>
                          <p className={isDark ? "text-white/30" : "text-gray-400"}>record</p>
                        </div>
                        <div className={`hidden md:block ${isDark ? "text-white/30" : "text-gray-300"}`}>|</div>
                        <div className="hidden md:block">
                          <p className={`font-semibold ${isDark ? "text-white/70" : "text-gray-600"}`}>{p.buchholz}</p>
                          <p className={isDark ? "text-white/30" : "text-gray-400"}>Buch.</p>
                        </div>
                        <div className="flex gap-1 ml-1">
                          {p.colorHistory.map((c, ci) => (
                            <div key={ci} className={`w-3.5 h-3.5 rounded border ${
                              c === "W"
                                ? isDark ? "bg-white/80 border-white/30" : "bg-white border-gray-300"
                                : isDark ? "bg-[oklch(0.15_0.04_145)] border-white/10" : "bg-gray-800 border-gray-600"
                            }`} title={c === "W" ? "White" : "Black"} />
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              )}

              {/* Mobile: card stack */}
              {filteredPlayers.length > 0 && (
              <div className="grid grid-cols-1 gap-3 sm:hidden">
                {filteredPlayers.map((p, i) => (
                  <div
                    key={p.id}
                    className={`rounded-2xl border p-5 transition-colors ${
                      isDark ? "bg-[oklch(0.22_0.06_145)] border-white/08" : "bg-white border-gray-100"
                    }`}
                  >
                    {/* Top row: rank + name + score */}
                    <div className="flex items-start justify-between gap-2 mb-4">
                      <div className="flex items-center gap-3">
                        <span className={`text-base font-bold w-6 text-center ${
                          i === 0 ? "text-amber-400" : i === 1 ? "text-slate-400" : i === 2 ? "text-amber-600" : isDark ? "text-white/30" : "text-gray-300"
                        }`}>
                          {i < 3 ? ["🥇", "🥈", "🥉"][i] : i + 1}
                        </span>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <PlayerHoverCard player={p} isDark={isDark}>
                              <span className={`text-base font-bold cursor-default hover:text-[#3D6B47] transition-colors ${isDark ? "text-white" : "text-gray-900"}`}>{p.name}</span>
                            </PlayerHoverCard>
                            {p.title && (
                              <span className="text-xs font-bold text-[#3D6B47] bg-[#3D6B47]/10 px-1.5 py-0.5 rounded">{p.title}</span>
                            )}
                            <span className="text-sm">{FLAG_EMOJI[p.country]}</span>
                            {p.joinedAt && Date.now() - p.joinedAt < 5 * 60 * 1000 && (
                              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500 text-white animate-pulse">New</span>
                            )}
                          </div>
                          <span className={`text-sm ${isDark ? "text-white/40" : "text-gray-400"}`}>@{p.username} · {p.elo} ELO</span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className={`text-2xl font-bold tabular-nums ${isDark ? "text-white" : "text-gray-900"}`} style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                          {p.points % 1 !== 0 ? `${Math.floor(p.points)}½` : p.points}
                        </p>
                        <p className={`text-xs ${isDark ? "text-white/30" : "text-gray-400"}`}>points</p>
                      </div>
                    </div>

                    {/* Stats row */}
                    <div className={`flex items-center justify-between pt-3 border-t ${
                      isDark ? "border-white/08" : "border-gray-100"
                    }`}>
                      <div className="text-center">
                        <p className={`text-sm font-semibold ${isDark ? "text-white/80" : "text-gray-700"}`}>{p.wins}W {p.draws}D {p.losses}L</p>
                        <p className={`text-[10px] ${isDark ? "text-white/30" : "text-gray-400"}`}>record</p>
                      </div>
                      <div className="text-center">
                        <p className={`text-sm font-semibold ${isDark ? "text-white/80" : "text-gray-700"}`}>{p.buchholz.toFixed(1)}</p>
                        <p className={`text-[10px] ${isDark ? "text-white/30" : "text-gray-400"}`}>Buchholz</p>
                      </div>
                      <div className="text-center">
                        <div className="flex gap-0.5 justify-center">
                          {p.colorHistory.map((c, ci) => (
                            <div key={ci} className={`w-3.5 h-3.5 rounded-sm border ${
                              c === "W"
                                ? isDark ? "bg-white/80 border-white/30" : "bg-white border-gray-300"
                                : isDark ? "bg-[oklch(0.15_0.04_145)] border-white/10" : "bg-gray-800 border-gray-600"
                            }`} />
                          ))}
                        </div>
                        <p className={`text-[10px] mt-0.5 ${isDark ? "text-white/30" : "text-gray-400"}`}>colors</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              )}
              {/* ── Start Tournament CTA (registration phase only) ─────────── */}
              {isRegistration && (
                <div
                  className={`rounded-xl border p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                    isDark
                      ? "bg-[oklch(0.22_0.06_145)] border-[#4CAF50]/25"
                      : "bg-[#F0FDF4] border-[#3D6B47]/20"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: "#3D6B47" }}
                    >
                      <PlayCircle className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p
                        className={`text-sm font-bold ${
                          isDark ? "text-white" : "text-gray-900"
                        }`}
                        style={{ fontFamily: "'Clash Display', sans-serif" }}
                      >
                        {canStart ? "Ready to start" : "Waiting for players"}
                      </p>
                      <p className={`text-xs ${
                        isDark ? "text-white/40" : "text-gray-500"
                      }`}>
                        {canStart
                          ? `${state.players.length} player${state.players.length !== 1 ? "s" : ""} registered · ${state.totalRounds} rounds`
                          : `Need at least 2 players to start`}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => canStart && setShowStartConfirm(true)}
                    disabled={!canStart}
                    className="flex items-center gap-2 text-sm font-bold rounded-xl transition-all duration-200 flex-shrink-0 w-full sm:w-auto justify-center"
                    style={{
                      padding: "11px 24px",
                      background: canStart ? "#3D6B47" : isDark ? "rgba(255,255,255,0.08)" : "#E5E7EB",
                      color: canStart ? "#FFFFFF" : isDark ? "rgba(255,255,255,0.25)" : "#9CA3AF",
                      cursor: canStart ? "pointer" : "not-allowed",
                      boxShadow: canStart ? "0 4px 16px rgba(61,107,71,0.35)" : "none",
                    }}
                  >
                    <PlayCircle className="w-4 h-4" />
                    Start Tournament
                  </button>
                </div>
              )}
            </div>
          )}
          {/* ── Settings Tab ─────────────────────────────────────────────────── */}
          {activeTab === "settings" && (
            <div className="space-y-4">
              {/* Editable tournament settings panel */}
              {tournamentId !== "otb-demo-2026" ? (
                <TournamentSettingsPanel
                  tournamentId={tournamentId}
                  isLocked={isSettingsLocked}
                  isDark={isDark}
                  onSaved={(updated) => {
                    // Sync name and rounds back into live director state
                    updateSettings({
                      tournamentName: updated.name,
                      totalRounds: updated.rounds,
                    });
                  }}
                />
              ) : (
                /* Demo tournament — show read-only info */
                <div
                  className={`rounded-xl border overflow-hidden ${
                    isDark ? "bg-[oklch(0.22_0.06_145)] border-white/08" : "bg-white border-gray-100"
                  }`}
                >
                  <div className="px-5 py-3 border-b" style={{ borderColor: isDark ? "rgba(255,255,255,0.08)" : "#F0F0F0" }}>
                    <h2 className={`text-sm font-semibold ${isDark ? "text-white/80" : "text-gray-700"}`} style={{ fontFamily: "'Clash Display', sans-serif" }}>Tournament Details</h2>
                  </div>
                  <div className="divide-y">
                    {[
                      { label: "Name", value: state.tournamentName },
                      { label: "Format", value: `Swiss · ${state.totalRounds} rounds` },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex items-center justify-between px-5 py-3">
                        <span className={`text-sm ${isDark ? "text-white/40" : "text-gray-500"}`}>{label}</span>
                        <span className={`text-sm font-medium ${isDark ? "text-white/80" : "text-gray-800"}`}>{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Danger zone */}
              <div
                className={`rounded-xl border overflow-hidden ${
                  isDark ? "bg-[oklch(0.22_0.06_145)] border-red-500/20" : "bg-white border-red-100"
                }`}
              >
                <div className={`px-5 py-3 border-b ${isDark ? "border-red-500/20" : "border-red-50"}`}>
                  <h2 className="text-sm font-semibold text-red-500">Danger Zone</h2>
                </div>
                {/* Reset Tournament */}
                <div className="px-5 py-4 flex items-center justify-between border-b border-red-50">
                  <div>
                    <p className={`text-sm font-medium ${isDark ? "text-white/70" : "text-gray-700"}`}>Reset Tournament</p>
                    <p className={`text-xs ${isDark ? "text-white/30" : "text-gray-400"}`}>
                      Clears all rounds and results, restores initial state
                    </p>
                  </div>
                  {resetConfirm ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          resetTournament();
                          setResetConfirm(false);
                          toast.success("Tournament reset to initial state");
                        }}
                        className="text-xs font-semibold text-white bg-red-500 px-3 py-1.5 rounded-lg hover:bg-red-600 transition-colors"
                      >
                        Confirm Reset
                      </button>
                      <button
                        onClick={() => setResetConfirm(false)}
                        className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                          isDark ? "text-white/50 hover:bg-white/08" : "text-gray-500 hover:bg-gray-100"
                        }`}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setResetConfirm(true)}
                      className="text-xs font-semibold text-red-500 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      Reset
                    </button>
                  )}
                </div>
                {/* End Tournament */}
                <div className="px-5 py-4 flex items-center justify-between">
                  <div>
                    <p className={`text-sm font-medium ${isDark ? "text-white/70" : "text-gray-700"}`}>End Tournament</p>
                    <p className={`text-xs ${isDark ? "text-white/30" : "text-gray-400"}`}>
                      Finalizes all results and locks the bracket
                    </p>
                  </div>
                  <button
                    onClick={() => { if (window.confirm("End tournament? This will finalize all results and lock the bracket.")) { completeTournament(); toast.success("Tournament finalized!"); } }}
                    className="text-xs font-semibold text-red-500 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    End Tournament
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ── QR Modal ─────────────────────────────────────────────────────────── */}
      <QRModal
        open={showQR}
        onClose={() => setShowQR(false)}
        tournamentName={state.tournamentName}
        joinUrl={joinUrl}
        code={inviteCode}
      />

      {/* ── Add Player Modal ─────────────────────────────────────────────────── */}
      <AddPlayerModal
        open={showAddPlayer}
        onClose={() => setShowAddPlayer(false)}
        onAdd={(player) => {
          addPlayer(player);
          toast.success(`${player.name} added to the tournament`);
        }}
        existingUsernames={existingUsernames}
      />

      {/* ── Start Tournament Confirmation Dialog ─────────────────────────────── */}
      {showStartConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowStartConfirm(false)}
          />
          {/* Dialog */}
          <div
            className={`relative z-10 w-full max-w-sm rounded-2xl p-6 shadow-2xl ${
              isDark ? "bg-[oklch(0.18_0.04_145)] border border-white/10" : "bg-white border border-gray-100"
            }`}
          >
            {/* Icon */}
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-green-100 mx-auto mb-4">
              <PlayCircle className="w-6 h-6 text-[#3D6B47]" />
            </div>
            {/* Title */}
            <h2 className={`text-lg font-bold text-center mb-1 ${
              isDark ? "text-white" : "text-gray-900"
            }`}>
              Start Tournament?
            </h2>
            <p className={`text-sm text-center mb-5 ${
              isDark ? "text-white/50" : "text-gray-500"
            }`}>
              This will generate Round 1 pairings for{" "}
              <span className="font-semibold">{state.players.length} players</span>.
              Players can no longer join after the tournament starts.
            </p>
            {/* Player count summary */}
            <div className={`rounded-xl px-4 py-3 mb-5 flex items-center justify-between ${
              isDark ? "bg-white/05" : "bg-gray-50"
            }`}>
              <span className={`text-sm ${ isDark ? "text-white/60" : "text-gray-500" }`}>Players registered</span>
              <span className={`text-sm font-bold ${ isDark ? "text-white" : "text-gray-900" }`}>
                {state.players.length}
              </span>
            </div>
            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowStartConfirm(false)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isDark
                    ? "bg-white/08 text-white/70 hover:bg-white/12"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  startTournament();
                  setShowStartConfirm(false);
                  toast.success("Round 1 pairings generated! Tournament is live.");
                }}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90"
                style={{ background: "#3D6B47", boxShadow: "0 4px 16px rgba(61,107,71,0.35)" }}
              >
                Start Tournament
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Undo Result Snackbar ──────────────────────────────────────────── */}
      <UndoSnackbar
        pending={undoPending}
        onUndo={undoResult}
        onDismiss={dismissUndo}
        isDark={isDark}
      />
    </div>
  );
}
