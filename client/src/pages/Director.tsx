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
import { AnnounceModal } from "@/components/AnnounceModal";
import { SpectatorShareModal } from "@/components/SpectatorShareModal";
import { SpectatorQRScreen } from "@/components/SpectatorQRScreen";
import { Link, useParams, useLocation } from "wouter";
import { toast } from "sonner";
import { useTheme } from "@/contexts/ThemeContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useDirectorState } from "@/lib/directorState";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { PlayerHoverCard } from "@/components/PlayerProfileCard";
import { getStandings, FLAG_EMOJI, type Result } from "@/lib/tournamentData";
import { getTournamentConfig, hasDirectorSession } from "@/lib/tournamentRegistry";
import { useAuthContext } from "@/context/AuthContext";
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
  ChevronRight,
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
  QrCode,
  FileText,
  Printer,
  Hash,
  MoreVertical,
  CheckCheck,
  MessageSquare,
  Tv2,
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
    tournamentId,
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

  const { user } = useAuthContext();

  // ── Immediately push current state to server, bypassing the 1.5s debounce ──
  // Called after every result entry so standings_updated SSE fires right away.
  const pushStandingsNow = useCallback(() => {
    if (tournamentId === "otb-demo-2026") return;
    // We read the latest state from localStorage (written by the 300ms debounce)
    // rather than from the React state closure to avoid stale captures.
    setTimeout(() => {
      try {
        const raw = localStorage.getItem(`otb-director-state-v2-${tournamentId}`);
        const latestState = raw ? JSON.parse(raw) : null;
        if (!latestState?.state) return;
        fetch(`/api/tournament/${encodeURIComponent(tournamentId)}/state`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ state: latestState.state }),
        }).catch(() => { /* fire-and-forget */ });
      } catch { /* ignore */ }
    }, 350); // Wait for the 300ms localStorage debounce to flush
  }, [tournamentId]);

  // ── Sync tournament status to server (for My Tournaments status pills) ──
  const syncStatusToServer = useCallback((newStatus: string) => {
    if (!user?.id || tournamentId === "otb-demo-2026") return;
    fetch("/api/user/tournaments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        tournamentId,
        name: state.tournamentName,
        status: newStatus,
      }),
    }).catch(() => { /* non-critical */ });
  }, [user?.id, tournamentId, state.tournamentName]);

  const [resetConfirm, setResetConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState<"home" | "boards" | "players" | "standings" | "settings">("home");
  const [showQR, setShowQR] = useState(false);
  const [showAnnounce, setShowAnnounce] = useState(false);
  const [showSpectatorShare, setShowSpectatorShare] = useState(false);
  const [showSpectatorQR, setShowSpectatorQR] = useState(false);
  // Spectator URL — public live view, no auth required
  const spectatorUrl = `${window.location.origin}/tournament/${tournamentId}`;
  const [showOverflow, setShowOverflow] = useState(false);
  // Look up real tournament config for invite code and extra metadata
  const tournamentConfig = getTournamentConfig(tournamentId);
  // For real tournaments use the stored invite code; for the demo fall back to
  // the tournament slug so /join/otb-demo-2026 is used (never the "OTB2026" demo
  // placeholder which resolves to the NYC demo tournament on the Join page).
  const inviteCode = tournamentConfig?.inviteCode ?? tournamentId;
  // Embed compact tournament metadata as ?t=<base64json> so players on other devices
  // can bootstrap the tournament registry from the URL itself (no director localStorage needed).
  const joinUrlBase = `${window.location.origin}/join/${inviteCode}`;
  const joinUrl = (() => {
    if (!tournamentConfig) return joinUrlBase;
    try {
      const meta = {
        id: tournamentId,
        name: tournamentConfig.name,
        venue: tournamentConfig.venue || undefined,
        format: tournamentConfig.format,
        rounds: tournamentConfig.rounds,
        maxPlayers: tournamentConfig.maxPlayers,
        timePreset: tournamentConfig.timePreset,
        inviteCode: tournamentConfig.inviteCode,
      };
      return `${joinUrlBase}?t=${btoa(JSON.stringify(meta))}`;
    } catch {
      return joinUrlBase;
    }
  })();
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

  // ── Server player sync — SSE stream ────────────────────────────────────
  // During the registration phase, open a persistent SSE connection to the
  // server. When a player registers from any device, the server pushes a
  // "player_joined" event and we immediately merge them into local state.
  // EventSource reconnects automatically on network interruptions.
  useEffect(() => {
    if (!isRegistration || tournamentId === "otb-demo-2026") return;

    // 1. Fetch the current snapshot first so we don't miss players who joined
    //    before this tab opened.
    const fetchSnapshot = async () => {
      try {
        const res = await fetch(`/api/tournament/${encodeURIComponent(tournamentId)}/players`);
        if (!res.ok) return;
        const data = await res.json() as { players: import("@/lib/tournamentData").Player[] };
        if (Array.isArray(data.players)) data.players.forEach(addPlayer);
      } catch { /* silent */ }
    };
    fetchSnapshot();

    // 2. Open the SSE stream for real-time updates.
    const es = new EventSource(`/api/tournament/${encodeURIComponent(tournamentId)}/players/stream`);

    es.addEventListener("player_joined", (e: MessageEvent) => {
      try {
        const player = JSON.parse(e.data) as import("@/lib/tournamentData").Player;
        addPlayer(player);
      } catch { /* malformed event — ignore */ }
    });

    es.onerror = () => {
      // EventSource will automatically reconnect; no manual action needed.
      console.warn("[sse] player stream error — will reconnect automatically");
    };

    return () => es.close();
  }, [isRegistration, tournamentId, addPlayer]);

  // Auto-scroll to the Generate CTA when all results are entered on the Boards tab.
  // A short delay lets the last result's animation settle before scrolling.
  const generateCtaRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (
      allResultsIn &&
      activeTab === "boards" &&
      !isRegistration &&
      state.currentRound > 0 &&
      generateCtaRef.current
    ) {
      const timer = setTimeout(() => {
        generateCtaRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [allResultsIn, activeTab, isRegistration, state.currentRound]);

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
        {/* Main nav row */}
        <div className="max-w-7xl mx-auto px-4 sm:px-8 h-14 flex items-center justify-between gap-3">
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
              <div className="min-w-0">
                <p
                  className={`text-sm font-bold truncate leading-tight ${isDark ? "text-white" : "text-gray-900"}`}
                  style={{ fontFamily: "'Clash Display', sans-serif" }}
                >
                  {state.tournamentName}
                </p>
                <p className={`text-[11px] leading-tight ${isDark ? "text-white/40" : "text-gray-400"}`}>
                  {isRegistration ? `${state.players.length} players registered` : `Round ${state.currentRound} of ${state.totalRounds}`}
                  {lastSaved && (
                    <span className={`ml-1.5 ${isDark ? "text-[#4CAF50]/50" : "text-[#3D6B47]/50"}`}>
                      · Saved {new Date(lastSaved).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Right: controls — mobile-optimised */}
          <div className="flex items-center gap-1">

            {/* Live/Paused status dot — always visible, no text on mobile */}
            {!isRegistration && (
              <span
                title={state.status === "paused" ? "Paused" : "Live"}
                className={`w-2 h-2 rounded-full flex-shrink-0 mr-0.5 ${
                  state.status === "paused" ? "bg-amber-400" : "bg-[#4CAF50] animate-pulse"
                }`}
              />
            )}

            {/* Pause/Resume — desktop only (moved to overflow on mobile) */}
            {!isRegistration && (
              <button
                onClick={() => { togglePause(); toast.info(state.status === "paused" ? "Tournament resumed" : "Tournament paused"); }}
                className={`hidden sm:flex touch-target p-2 rounded-xl transition-all active:scale-95 ${
                  isDark ? "hover:bg-white/08 text-white/60" : "hover:bg-gray-100 text-gray-500"
                }`}
                title={state.status === "paused" ? "Resume" : "Pause"}
              >
                {state.status === "paused" ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              </button>
            )}

            {/* Invite code chip — desktop only */}
            <button
              onClick={() => { navigator.clipboard.writeText(inviteCode); toast.success("Invite code copied!"); }}
              title={`Invite code: ${inviteCode} — click to copy`}
              className={`hidden sm:flex group items-center gap-1 px-2 py-1 rounded-lg border transition-all active:scale-95 ${
                isDark
                  ? "border-white/12 bg-white/06 hover:bg-white/10 text-white/70 hover:text-white"
                  : "border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-500 hover:text-gray-800"
              }`}
            >
              <Hash className="w-3 h-3 flex-shrink-0" />
              <span className="font-mono text-xs font-semibold tracking-wider">{inviteCode}</span>
              <Copy className="w-3 h-3 flex-shrink-0 opacity-0 group-hover:opacity-60 transition-opacity" />
            </button>

            {/* Capacity badge — desktop only */}
            {tournamentConfig?.maxPlayers != null && tournamentConfig.maxPlayers > 0 && (
              <span className="hidden sm:flex">
                <CapacityBadge
                  current={state.players.length}
                  max={tournamentConfig.maxPlayers}
                  isDark={isDark}
                  size="sm"
                />
              </span>
            )}

            {/* Watch Live — share modal (small screens: icon only; md+: icon + label) */}
            <button
              onClick={() => setShowSpectatorShare(true)}
              className={`touch-target p-2 rounded-xl transition-all active:scale-95 ${
                isDark ? "hover:bg-white/08 text-[#2196F3]/70 hover:text-[#2196F3]" : "hover:bg-blue-50 text-blue-400 hover:text-blue-600"
              }`}
              title="Share live spectator view"
            >
              <Tv2 className="w-4 h-4" />
            </button>
            {/* Spectator QR — full-screen projection mode */}
            <button
              onClick={() => setShowSpectatorQR(true)}
              className={`touch-target hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95 ${
                isDark
                  ? "bg-blue-500/12 hover:bg-blue-500/20 text-blue-300 border border-blue-500/20"
                  : "bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200"
              }`}
              title="Show spectator QR full-screen (for projector)"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Project QR</span>
            </button>
            {/* Announce / QR — always visible (primary action) */}
            <button
              onClick={() => setShowAnnounce(true)}
              className={`touch-target p-2 rounded-xl transition-all active:scale-95 ${
                isDark ? "hover:bg-white/08 text-white/60" : "hover:bg-gray-100 text-gray-500"
              }`}
              title="Show join QR code full-screen"
            >
              <QrCode className="w-4 h-4" />
            </button>

            {/* Theme toggle — always visible */}
            <ThemeToggle />

            {/* Overflow menu — mobile only (⋯) */}
            <div className="relative sm:hidden">
              <button
                onClick={() => setShowOverflow((v) => !v)}
                className={`touch-target p-2 rounded-xl transition-all active:scale-95 ${
                  isDark ? "hover:bg-white/08 text-white/60" : "hover:bg-gray-100 text-gray-500"
                }`}
                title="More options"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
              {showOverflow && (
                <>
                  {/* Backdrop */}
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowOverflow(false)}
                  />
                  {/* Dropdown */}
                  <div
                    className={`absolute right-0 top-full mt-1 z-50 w-52 rounded-2xl shadow-xl border overflow-hidden ${
                      isDark
                        ? "bg-[oklch(0.22_0.06_145)] border-white/10"
                        : "bg-white border-gray-100"
                    }`}
                  >
                    {/* Invite code row */}
                    <button
                      onClick={() => { navigator.clipboard.writeText(inviteCode); toast.success("Invite code copied!"); setShowOverflow(false); }}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                        isDark ? "hover:bg-white/06 text-white" : "hover:bg-gray-50 text-gray-800"
                      }`}
                    >
                      <Hash className={`w-4 h-4 flex-shrink-0 ${isDark ? "text-[#4CAF50]" : "text-[#3D6B47]"}`} />
                      <div className="min-w-0">
                        <p className={`text-[11px] font-medium ${isDark ? "text-white/40" : "text-gray-400"}`}>Invite code</p>
                        <p className="font-mono text-sm font-bold tracking-widest truncate">{inviteCode}</p>
                      </div>
                      <Copy className={`w-3.5 h-3.5 ml-auto flex-shrink-0 ${isDark ? "text-white/30" : "text-gray-300"}`} />
                    </button>

                    {/* Capacity row */}
                    {tournamentConfig?.maxPlayers != null && tournamentConfig.maxPlayers > 0 && (
                      <div className={`flex items-center gap-3 px-4 py-3 border-t ${
                        isDark ? "border-white/06 text-white/60" : "border-gray-50 text-gray-500"
                      }`}>
                        <UserPlus className="w-4 h-4 flex-shrink-0" />
                        <span className="text-sm">
                          {state.players.length} / {tournamentConfig.maxPlayers} players
                        </span>
                      </div>
                    )}

                    {/* Pause / Resume row */}
                    {!isRegistration && (
                      <button
                        onClick={() => { togglePause(); toast.info(state.status === "paused" ? "Tournament resumed" : "Tournament paused"); setShowOverflow(false); }}
                        className={`w-full flex items-center gap-3 px-4 py-3 border-t text-left transition-colors ${
                          isDark ? "border-white/06 hover:bg-white/06 text-white" : "border-gray-50 hover:bg-gray-50 text-gray-800"
                        }`}
                      >
                        {state.status === "paused"
                          ? <Play className="w-4 h-4 flex-shrink-0 text-[#4CAF50]" />
                          : <Pause className="w-4 h-4 flex-shrink-0 text-amber-500" />}
                        <span className="text-sm font-medium">
                          {state.status === "paused" ? "Resume tournament" : "Pause tournament"}
                        </span>
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>

          </div>
        </div>

        {/* Round Progress strip — shown only after tournament starts */}
        {!isRegistration && (
          <div className={`border-t ${isDark ? "border-white/06" : "border-gray-100"}`}>
            <div className="max-w-7xl mx-auto px-4 sm:px-8 py-2 flex items-center gap-3">
              {/* Round dots */}
              <div className="flex items-center gap-1.5">
                {Array.from({ length: state.totalRounds }, (_, i) => i + 1).map((r) => {
                  const rd = state.rounds.find((x) => x.number === r);
                  const done = rd?.status === "completed";
                  const cur = r === state.currentRound;
                  return (
                    <div key={r} className="flex items-center gap-1">
                      <div
                        title={`Round ${r}`}
                        className={`flex items-center justify-center rounded-full text-[10px] font-bold transition-all ${
                          done
                            ? "w-5 h-5 bg-[#3D6B47] text-white"
                            : cur
                            ? isDark
                              ? "w-6 h-6 bg-[#4CAF50]/25 text-[#4CAF50] border border-[#4CAF50]/60"
                              : "w-6 h-6 bg-[#3D6B47]/12 text-[#3D6B47] border border-[#3D6B47]/40"
                            : isDark
                            ? "w-5 h-5 bg-white/08 text-white/25 border border-white/10"
                            : "w-5 h-5 bg-gray-100 text-gray-300 border border-gray-200"
                        }`}
                      >
                        {done ? <CheckCircle2 className="w-3 h-3" /> : r}
                      </div>
                      {r < state.totalRounds && (
                        <div className={`h-px w-3 rounded-full ${done ? "bg-[#3D6B47]" : isDark ? "bg-white/10" : "bg-gray-200"}`} />
                      )}
                    </div>
                  );
                })}
              </div>
              {/* Results progress bar */}
              {totalGames > 0 && (
                <div className="flex items-center gap-2 flex-1 max-w-[160px]">
                  <div className={`flex-1 h-1 rounded-full overflow-hidden ${isDark ? "bg-white/10" : "bg-gray-100"}`}>
                    <div
                      className="h-full bg-[#3D6B47] rounded-full transition-all duration-500"
                      style={{ width: `${(completedGames / totalGames) * 100}%` }}
                    />
                  </div>
                  <span className={`text-[10px] font-semibold tabular-nums flex-shrink-0 ${isDark ? "text-white/35" : "text-gray-400"}`}>
                    {completedGames}/{totalGames}
                  </span>
                </div>
              )}
              {/* progress bar only — generate button lives in Boards tab */}
            </div>
          </div>
        )}
      </header>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-4 sm:px-8 py-6 sm:py-8">
        {/* ── Main Panel (full-width) ─────────────────────────────────────────── */}
        <main className="w-full space-y-5">
          {/* ── Page Title + Tab Bar ─────────────────────────────────────── */}
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
              {/* generate button lives in Boards tab — nothing here */}
            </div>

            {/* Unified 5-tab bar */}
            <div
              className={`flex rounded-2xl p-1 w-full overflow-x-auto ${
                isDark ? "bg-white/08" : "bg-gray-100"
              }`}
            >
              {([
                { id: "home", label: "Home" },
                { id: "boards", label: "Boards" },
                { id: "players", label: "Players" },
                { id: "standings", label: "Standings" },
                { id: "settings", label: "Settings" },
              ] as const).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`touch-target flex-1 min-w-[4.5rem] px-3 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95 flex items-center justify-center gap-1.5 whitespace-nowrap ${
                    activeTab === tab.id
                      ? isDark
                        ? "bg-[#3D6B47] text-white shadow-sm"
                        : "bg-white text-gray-900 shadow-sm"
                      : isDark
                      ? "text-white/50 hover:text-white/70"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {tab.label}
                  {tab.id === "players" && state.players.length > 0 && (
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full leading-none ${
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

          {/* ── Home Tab ────────────────────────────────────────────────────────── */}
          {activeTab === "home" && (
            <div className="flex flex-col gap-5 w-full">

              {/* ══════════════════════════════════════════════════════════════════
                  REGISTRATION PHASE — Lobby view
              ══════════════════════════════════════════════════════════════════ */}
              {isRegistration && (
                <>
                  {/* ── Lobby Hero Card ──────────────────────────────────────── */}
                  <div className={`w-full rounded-2xl border overflow-hidden ${
                    isDark ? "bg-[oklch(0.22_0.06_145)] border-white/08" : "bg-white border-gray-100"
                  }`}>
                    {/* Header row */}
                    <div className={`flex items-center justify-between px-6 py-4 border-b ${
                      isDark ? "border-white/06" : "border-gray-100"
                    }`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-2.5 h-2.5 rounded-full ${
                          isDark ? "bg-[#4CAF50]/60" : "bg-[#3D6B47]/50"
                        } animate-pulse`} />
                        <span className={`text-sm font-bold ${isDark ? "text-white" : "text-gray-900"}`}
                          style={{ fontFamily: "'Clash Display', sans-serif" }}>
                          Waiting for Players
                        </span>
                      </div>
                      {/* Player count badge */}
                      <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                        isDark ? "bg-white/08 text-white/70" : "bg-gray-100 text-gray-600"
                      }`}>
                        <Users className="w-3.5 h-3.5" />
                        <span>{state.players.length}{tournamentConfig?.maxPlayers ? ` / ${tournamentConfig.maxPlayers}` : ""} registered</span>
                      </div>
                    </div>

                    {/* Join link + QR row */}
                    <div className={`px-6 py-4 border-b ${isDark ? "border-white/06" : "border-gray-100"}`}>
                      <p className={`text-xs font-semibold uppercase tracking-widest mb-2 ${
                        isDark ? "text-white/30" : "text-gray-400"
                      }`}>Share with players</p>
                      <div className="flex items-center gap-2">
                        <div className={`flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl border min-w-0 ${
                          isDark ? "bg-white/04 border-white/08" : "bg-gray-50 border-gray-200"
                        }`}>
                          <span className={`text-xs font-mono flex-1 truncate ${isDark ? "text-white/60" : "text-gray-600"}`}>{joinUrl}</span>
                          <button
                            onClick={() => { navigator.clipboard.writeText(joinUrl); toast.success("Join link copied!"); }}
                            className={`flex-shrink-0 p-1.5 rounded-lg transition-colors ${isDark ? "hover:bg-white/10 text-white/40 hover:text-white/70" : "hover:bg-gray-200 text-gray-400 hover:text-gray-600"}`}
                            title="Copy join link"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <button
                          onClick={() => setShowQR(true)}
                          className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold border transition-all ${
                            isDark
                              ? "bg-[#4CAF50]/12 border-[#4CAF50]/25 text-[#4CAF50] hover:bg-[#4CAF50]/20"
                              : "bg-[#3D6B47]/08 border-[#3D6B47]/20 text-[#3D6B47] hover:bg-[#3D6B47]/15"
                          }`}
                        >
                          <QrCode className="w-3.5 h-3.5" />
                          QR Code
                        </button>
                      </div>
                    </div>

                    {/* Live player list */}
                    <div className="px-6 py-4">
                      {state.players.length === 0 ? (
                        <div className={`flex flex-col items-center justify-center py-10 gap-3 ${
                          isDark ? "text-white/20" : "text-gray-300"
                        }`}>
                          <Users className="w-8 h-8" />
                          <p className="text-sm">No players yet — share the QR code or join link</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {state.players.map((p, idx) => (
                            <div
                              key={p.id}
                              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors group ${
                                isDark ? "hover:bg-white/04" : "hover:bg-gray-50"
                              }`}
                            >
                              {/* Rank number */}
                              <span className={`text-xs font-mono w-5 flex-shrink-0 text-right ${
                                isDark ? "text-white/25" : "text-gray-300"
                              }`}>{idx + 1}</span>
                              {/* Avatar */}
                              <PlayerAvatar
                                username={p.username}
                                name={p.name}
                                size={32}
                                showBadge
                                platform={p.platform}
                                avatarUrl={p.avatarUrl}
                                flairEmoji={p.flairEmoji}
                              />
                              {/* Name + username */}
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm font-semibold truncate ${isDark ? "text-white" : "text-gray-900"}`}>{p.name}</p>
                                {p.username && (
                                  <p className={`text-xs truncate ${isDark ? "text-white/35" : "text-gray-400"}`}>@{p.username}</p>
                                )}
                              </div>
                              {/* ELO */}
                              {p.elo != null && (
                                <span className={`text-xs font-bold flex-shrink-0 px-2 py-0.5 rounded-lg ${
                                  isDark ? "bg-white/06 text-white/60" : "bg-gray-100 text-gray-500"
                                }`}>{p.elo}</span>
                              )}
                              {/* Remove button */}
                              <button
                                onClick={() => { removePlayer(p.id); toast.success(`${p.name} removed`); }}
                                className={`flex-shrink-0 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all ${
                                  isDark ? "hover:bg-red-500/15 text-red-400" : "hover:bg-red-50 text-red-400"
                                }`}
                                title="Remove player"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Add player + Start CTA footer */}
                    <div className={`px-6 py-4 border-t flex flex-col sm:flex-row items-stretch sm:items-center gap-3 ${
                      isDark ? "border-white/06" : "border-gray-100"
                    }`}>
                      <button
                        onClick={() => setShowAddPlayer(true)}
                        className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                          isDark
                            ? "border-white/10 text-white/60 hover:bg-white/06 hover:text-white/80"
                            : "border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                        }`}
                      >
                        <UserPlus className="w-4 h-4" />
                        Add Player
                      </button>
                      <button
                        onClick={() => canStart && setShowStartConfirm(true)}
                        disabled={!canStart}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all duration-200 ${
                          canStart
                            ? "bg-[#3D6B47] hover:bg-[#2d5235] text-white shadow-lg shadow-[#3D6B47]/25 active:scale-[0.98]"
                            : isDark
                            ? "bg-white/06 text-white/20 cursor-not-allowed"
                            : "bg-gray-100 text-gray-300 cursor-not-allowed"
                        }`}
                      >
                        <Zap className="w-4 h-4" />
                        {canStart
                          ? `Start Tournament — Generate Round 1`
                          : state.players.length === 0
                          ? "Add players to start"
                          : state.players.length === 1
                          ? "Need at least 2 players"
                          : "Need at least 2 players"}
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* ══════════════════════════════════════════════════════════════════
                  ACTIVE PHASE — Hero clock + Round status
              ══════════════════════════════════════════════════════════════════ */}
              {!isRegistration && (
                <>
                  {/* ── Unified Hero Card: Clock + Event Info ─────────────────────── */}
                  <div className={`w-full rounded-2xl border overflow-hidden ${
                    isDark ? "bg-[oklch(0.22_0.06_145)] border-white/08" : "bg-white border-gray-100"
                  }`}>
                    {/* Top section: Clock left, Controls right */}
                    <div className="flex flex-col sm:flex-row items-stretch">
                      {/* ── Clock Panel ─────────────────────────────────────────── */}
                      <div className={`flex-1 flex flex-col items-center justify-center px-8 py-10 sm:py-12 border-b sm:border-b-0 sm:border-r ${
                        isDark ? "border-white/06" : "border-gray-100"
                      }`}>
                        {/* Status label */}
                        <p className={`text-xs font-bold uppercase tracking-[0.18em] mb-3 ${
                          roundTimer.status === "running" && roundTimer.remainingSec <= 300
                            ? "text-amber-400"
                            : roundTimer.status === "expired"
                            ? "text-red-400"
                            : roundTimer.status === "running"
                            ? isDark ? "text-[#4CAF50]" : "text-[#3D6B47]"
                            : isDark ? "text-white/25" : "text-gray-300"
                        }`}>
                          {roundTimer.status === "idle" ? "Round Timer" :
                           roundTimer.status === "running" ? (roundTimer.remainingSec <= 300 ? "⚠ Time Running Out" : "Running") :
                           roundTimer.status === "paused" ? "Paused" : "Time's Up"}
                        </p>
                        {/* Large MM:SS display */}
                        <div className={`font-mono font-black leading-none tracking-tight select-none transition-colors ${
                          roundTimer.status === "expired"
                            ? "text-red-400"
                            : roundTimer.status === "running" && roundTimer.remainingSec <= 300
                            ? "text-amber-400"
                            : isDark ? "text-white" : "text-gray-900"
                        }`} style={{ fontSize: "clamp(3.5rem, 10vw, 6rem)" }}>
                          {(() => {
                            const sec = roundTimer.status === "idle" ? roundTimer.durationSec : roundTimer.remainingSec;
                            const m = Math.floor(sec / 60);
                            const s = Math.floor(sec % 60);
                            return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
                          })()}
                        </div>
                        {/* Thin progress bar below clock */}
                        <div className={`mt-6 w-full max-w-[200px] h-0.5 rounded-full overflow-hidden ${
                          isDark ? "bg-white/08" : "bg-gray-100"
                        }`}>
                          <div
                            className="h-full rounded-full transition-all duration-1000"
                            style={{
                              width: roundTimer.durationSec > 0
                                ? `${Math.max(0, (roundTimer.remainingSec / roundTimer.durationSec) * 100)}%`
                                : "100%",
                              background: roundTimer.status === "expired"
                                ? "#ef4444"
                                : roundTimer.status === "running" && roundTimer.remainingSec <= 300
                                ? "#f59e0b"
                                : "#4CAF50",
                            }}
                          />
                        </div>
                      </div>
                      {/* ── Controls Panel ──────────────────────────────────────── */}
                      <div className="flex flex-col justify-center gap-5 px-8 py-8 sm:w-64 lg:w-72">
                        {/* Minute input */}
                        <div>
                          <label className={`block text-xs font-semibold uppercase tracking-widest mb-2 ${
                            isDark ? "text-white/35" : "text-gray-400"
                          }`}>Duration (min)</label>
                          <input
                            type="number"
                            min="1"
                            max="180"
                            disabled={roundTimer.status === "running"}
                            value={Math.round(roundTimer.durationSec / 60)}
                            onChange={(e) => {
                              const val = Math.max(1, Math.min(180, parseInt(e.target.value) || 1));
                              roundTimer.setDurationMin(val);
                            }}
                            className={`w-full px-4 py-3 rounded-xl border text-2xl font-mono font-bold text-center transition-colors focus:outline-none focus:ring-2 focus:ring-[#4CAF50]/40 ${
                              isDark
                                ? "bg-white/06 border-white/10 text-white placeholder-white/20 disabled:opacity-40"
                                : "bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-300 disabled:opacity-40"
                            }`}
                          />
                        </div>
                        {/* Control buttons */}
                        <div className="flex gap-2">
                          {roundTimer.status === "idle" || roundTimer.status === "expired" ? (
                            <button
                              onClick={roundTimer.start}
                              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-[0.97]"
                              style={{ background: "#3D6B47" }}
                            >
                              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                              Start
                            </button>
                          ) : roundTimer.status === "running" ? (
                            <button
                              onClick={roundTimer.pause}
                              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90 active:scale-[0.97] ${
                                isDark ? "bg-white/10 text-white" : "bg-gray-100 text-gray-700"
                              }`}
                            >
                              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                              Pause
                            </button>
                          ) : (
                            <button
                              onClick={roundTimer.start}
                              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-[0.97]"
                              style={{ background: "#3D6B47" }}
                            >
                              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                              Resume
                            </button>
                          )}
                          <button
                            onClick={roundTimer.reset}
                            className={`px-3 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90 active:scale-[0.97] ${
                              isDark ? "bg-white/06 text-white/50 hover:bg-white/10" : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                            }`}
                            title="Reset timer"
                          >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                          </button>
                        </div>
                      </div>
                    </div>
                    {/* ── Event Meta Row ───────────────────────────────────────── */}
                    <div className={`flex flex-wrap items-center gap-x-5 gap-y-2 px-8 py-4 border-t ${
                      isDark ? "border-white/06" : "border-gray-100"
                    }`}>
                      {tournamentConfig?.name && (
                        <div className="flex items-center gap-2">
                          <Trophy className={`w-3.5 h-3.5 flex-shrink-0 ${isDark ? "text-[#4CAF50]/60" : "text-[#3D6B47]/60"}`} />
                          <span className={`text-xs font-semibold truncate ${isDark ? "text-white/70" : "text-gray-700"}`}>{tournamentConfig.name}</span>
                        </div>
                      )}
                      {tournamentConfig?.venue && (
                        <div className="flex items-center gap-2">
                          <MapPin className={`w-3.5 h-3.5 flex-shrink-0 ${isDark ? "text-[#4CAF50]/60" : "text-[#3D6B47]/60"}`} />
                          <span className={`text-xs ${isDark ? "text-white/50" : "text-gray-500"}`}>{tournamentConfig.venue}</span>
                        </div>
                      )}
                      {tournamentConfig?.date && (
                        <div className="flex items-center gap-2">
                          <Clock className={`w-3.5 h-3.5 flex-shrink-0 ${isDark ? "text-[#4CAF50]/60" : "text-[#3D6B47]/60"}`} />
                          <span className={`text-xs ${isDark ? "text-white/50" : "text-gray-500"}`}>{tournamentConfig.date}</span>
                        </div>
                      )}
                      {tournamentConfig?.timePreset && (
                        <div className="flex items-center gap-2">
                          <Clock className={`w-3.5 h-3.5 flex-shrink-0 ${isDark ? "text-[#4CAF50]/60" : "text-[#3D6B47]/60"}`} />
                          <span className={`text-xs ${isDark ? "text-white/50" : "text-gray-500"}`}>{tournamentConfig.timePreset}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ── Round in Progress Card (active phase only) ───────────────── */}
                  <div className={`w-full rounded-2xl border p-5 ${
                    isDark ? "bg-[oklch(0.22_0.06_145)] border-white/08" : "bg-white border-gray-100"
                  }`}>
                    {/* Header */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-2 h-2 rounded-full bg-[#4CAF50] animate-pulse" />
                        <span className={`text-sm font-bold ${isDark ? "text-white" : "text-gray-900"}`} style={{ fontFamily: "'Clash Display', sans-serif" }}>
                          Round {state.currentRound} of {state.totalRounds}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                          isDark ? "bg-[#4CAF50]/15 text-[#4CAF50]" : "bg-[#3D6B47]/10 text-[#3D6B47]"
                        }`}>In Progress</span>
                      </div>
                      <button
                        onClick={() => setActiveTab("boards")}
                        className={`text-xs font-semibold flex items-center gap-1 transition-colors ${
                          isDark ? "text-[#4CAF50] hover:text-[#4CAF50]/80" : "text-[#3D6B47] hover:text-[#2d5235]"
                        }`}
                      >
                        View Boards <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {/* Progress bar */}
                    <div className="mb-4">
                      {(() => {
                        const total = state.rounds[state.currentRound - 1]?.games?.length ?? 0;
                        const done = state.rounds[state.currentRound - 1]?.games?.filter(g => g.result !== "*").length ?? 0;
                        const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                        return (
                          <>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className={`text-xs ${isDark ? "text-white/40" : "text-gray-400"}`}>{done} / {total} boards complete</span>
                              <span className={`text-xs font-bold ${isDark ? "text-white/60" : "text-gray-600"}`}>{pct}%</span>
                            </div>
                            <div className={`h-1.5 rounded-full overflow-hidden ${isDark ? "bg-white/08" : "bg-gray-100"}`}>
                              <div
                                className="h-full rounded-full transition-all duration-700"
                                style={{ width: `${pct}%`, background: "linear-gradient(90deg, #3D6B47, #4CAF50)" }}
                              />
                            </div>
                          </>
                        );
                      })()}
                    </div>
                    {/* Top 3 standings + Generate CTA */}
                    <div className="flex flex-col sm:flex-row gap-4 items-start">
                      <div className="flex-1 space-y-1.5 min-w-0">
                        {getStandings(state.players).slice(0, 3).map((p, i) => (
                          <div key={p.id} className="flex items-center gap-2 min-w-0">
                            <span className={`text-xs font-bold w-5 flex-shrink-0 ${
                              i === 0 ? "text-yellow-500" : i === 1 ? "text-gray-400" : "text-amber-600"
                            }`}>{i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}</span>
                            <span className={`text-sm truncate flex-1 ${isDark ? "text-white/80" : "text-gray-700"}`}>{p.name}</span>
                            <span className={`text-sm font-bold flex-shrink-0 ${isDark ? "text-[#4CAF50]" : "text-[#3D6B47]"}`}>{p.points}</span>
                          </div>
                        ))}
                        {getStandings(state.players).length === 0 && (
                          <p className={`text-xs ${isDark ? "text-white/30" : "text-gray-400"}`}>No results yet</p>
                        )}
                      </div>
                      {/* generate button lives in Boards tab */}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
          {/* ── Standings Tab ───────────────────────────────────────────────────── */}
          {activeTab === "standings" && (
            <div className={`rounded-2xl border p-5 ${
              isDark ? "bg-[oklch(0.22_0.06_145)] border-white/08" : "bg-white border-gray-100"
            }`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className={`text-xs font-bold uppercase tracking-widest ${
                  isDark ? "text-white/40" : "text-gray-400"
                }`}>Live Standings</h3>
                <BarChart3 className={`w-4 h-4 ${isDark ? "text-white/30" : "text-gray-300"}`} />
              </div>
              <StandingsPanel players={state.players} isDark={isDark} />
            </div>
          )}

          {/* ── Boards Tab ─────────────────────────────────────────────────────── */}
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
                    onClick={() => { if (canStart) { startTournament(); syncStatusToServer("in_progress"); toast.success("Round 1 pairings generated!"); broadcastRoundStart(1); } }}
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

              {/* ── Single canonical Generate Next Round CTA ─────────────────── */}
              {!isRegistration && allResultsIn && canGenerateNext && (
                <div
                  ref={generateCtaRef}
                  className={`rounded-xl border overflow-hidden ${
                    isDark
                      ? "bg-[#3D6B47]/15 border-[#4CAF50]/30"
                      : "bg-[#3D6B47]/06 border-[#3D6B47]/20"
                  }`}
                >
                  {/* Info row */}
                  <div className={`flex items-center gap-3 px-4 py-3 border-b ${
                    isDark ? "border-[#4CAF50]/15" : "border-[#3D6B47]/10"
                  }`}>
                    <CheckCircle2 className={`w-4 h-4 flex-shrink-0 ${
                      isDark ? "text-[#4CAF50]" : "text-[#3D6B47]"
                    }`} />
                    <p className={`text-sm font-medium ${
                      isDark ? "text-[#4CAF50]" : "text-[#3D6B47]"
                    }`}>
                      All {totalGames} result{totalGames !== 1 ? "s" : ""} for Round {state.currentRound} recorded — ready for Round {state.currentRound + 1}
                    </p>
                  </div>
                  {/* CTA row */}
                  <div className="px-4 py-3">
                    <button
                      onClick={() => {
                        const nextRound = state.currentRound + 1;
                        generateNextRound();
                        toast.success(`Round ${nextRound} pairings generated!`);
                        broadcastRoundStart(nextRound);
                        // Broadcast round_started SSE event to all connected player screens
                        // so they automatically refresh to their new board assignment.
                        setTimeout(() => {
                          try {
                            const raw = localStorage.getItem(`otb-director-state-v2-${tournamentId}`);
                            const latestState = raw ? JSON.parse(raw) : null;
                            const roundData = latestState?.rounds?.find((r: { number: number }) => r.number === nextRound);
                            if (roundData && latestState?.players) {
                              fetch(`/api/tournament/${encodeURIComponent(tournamentId)}/round`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  round: nextRound,
                                  games: roundData.games,
                                  players: latestState.players,
                                }),
                              }).catch(() => {
                                // Non-critical — players can still poll state on next load
                              });
                            }
                          } catch { /* ignore */ }
                        }, 150);
                      }}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
                      style={{ background: "#3D6B47", boxShadow: "0 4px 16px rgba(61,107,71,0.35)" }}
                    >
                      <Zap className="w-4 h-4" />
                      Generate Round {state.currentRound + 1} — Swiss Pairings
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
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
                          // Push to server immediately so standings_updated SSE fires
                          // to all player devices without waiting for the 1.5s debounce.
                          pushStandingsNow();
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
              {/* ── Quick Actions ─────────────────────────────────────────────── */}
              <div className={`rounded-2xl border overflow-hidden ${
                isDark ? "bg-[oklch(0.22_0.06_145)] border-white/08" : "bg-white border-gray-100"
              }`}>
                <div className={`px-5 py-3 border-b ${
                  isDark ? "border-white/06" : "border-gray-100"
                }`}>
                  <h2 className={`text-xs font-bold uppercase tracking-widest ${
                    isDark ? "text-white/35" : "text-gray-400"
                  }`}>Quick Actions</h2>
                </div>
                <div className="divide-y">
                  {[
                    {
                      icon: QrCode,
                      label: "Show QR Code",
                      onClick: () => setShowQR(true),
                    },
                    {
                      icon: Copy,
                      label: "Copy Join Link",
                      onClick: () => { navigator.clipboard.writeText(joinUrl); toast.success("Join link copied!"); },
                    },
                    {
                      icon: UserPlus,
                      label: "Manage Players",
                      onClick: () => setActiveTab("players"),
                    },
                    {
                      icon: Printer,
                      label: "Pairings & Print Sheet",
                      onClick: () => {
                        const currentGames = state.rounds[state.currentRound - 1]?.games ?? [];
                        const lines = currentGames.map((g) => {
                          const w = state.players.find((p) => p.id === g.whiteId)?.name ?? "?";
                          const b = state.players.find((p) => p.id === g.blackId)?.name ?? "?";
                          return `Board ${g.board}: ${w} vs ${b}`;
                        });
                        const win = window.open("", "_blank");
                        if (win) {
                          win.document.write(`<pre style="font-family:monospace;font-size:14px;padding:24px">${lines.join("\n")}</pre>`);
                          win.print();
                        }
                      },
                    },
                    {
                      icon: Download,
                      label: "Download Results PDF",
                      onClick: () => generateResultsPdf({
                        tournamentName: state.tournamentName,
                        location: tournamentConfig?.venue,
                        date: tournamentConfig?.date,
                        timeControl: tournamentConfig?.timePreset,
                        players: state.players,
                        rounds: state.rounds,
                      }),
                    },
                  ].map(({ icon: Icon, label, onClick }) => (
                    <button
                      key={label}
                      onClick={onClick}
                      className={`w-full flex items-center gap-3 px-5 py-3.5 text-left transition-colors ${
                        isDark ? "hover:bg-white/04 text-white/70 hover:text-white" : "hover:bg-gray-50 text-gray-700 hover:text-gray-900"
                      }`}
                    >
                      <Icon className={`w-4 h-4 flex-shrink-0 ${
                        isDark ? "text-[#4CAF50]/70" : "text-[#3D6B47]/70"
                      }`} />
                      <span className="text-sm font-medium">{label}</span>
                    </button>
                  ))}
                </div>
              </div>
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
                    onClick={async () => {
                      if (!window.confirm("End tournament? This will finalize all results and lock the bracket.")) return;
                      completeTournament();
                      syncStatusToServer("completed");
                      // Broadcast tournament_ended SSE event to all connected player screens
                      try {
                        await fetch(`/api/tournament/${encodeURIComponent(tournamentId)}/end`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            players: standings,
                            tournamentName: state.tournamentName,
                          }),
                        });
                      } catch {
                        console.error("[director] Failed to broadcast tournament_ended");
                      }
                      toast.success("Tournament finalized!");
                    }}
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

      {/* ── Spectator Share Modal ─────────────────────────────────────────── */}
      <SpectatorShareModal
        open={showSpectatorShare}
        onClose={() => setShowSpectatorShare(false)}
        tournamentName={state.tournamentName}
        spectatorUrl={spectatorUrl}
      />

      {/* ── Spectator QR Screen (full-screen projection mode) ────────────────── */}
      <SpectatorQRScreen
        open={showSpectatorQR}
        onClose={() => setShowSpectatorQR(false)}
        tournamentName={state.tournamentName}
        spectatorUrl={spectatorUrl}
      />

      {/* ── QR Modal ────────────────────────────────────────────────────── */}
      <QRModal
        open={showQR}
        onClose={() => setShowQR(false)}
        tournamentName={state.tournamentName}
        joinUrl={joinUrl}
        code={inviteCode}
      />

      {/* ── Announce Modal (full-screen join QR for projection / read-aloud) ──── */}
      <AnnounceModal
        open={showAnnounce}
        onClose={() => setShowAnnounce(false)}
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
                  syncStatusToServer("in_progress");
                  toast.success("Round 1 pairings generated! Tournament is live.");
                  // Broadcast tournament_started SSE event to all connected player lobby screens.
                  // Read the updated state from localStorage after startTournament() runs.
                  setTimeout(() => {
                    try {
                      const raw = localStorage.getItem(`otb-director-state-v2-${tournamentId}`);
                      const latestState = raw ? JSON.parse(raw) : null;
                      const round1 = latestState?.rounds?.find((r: { number: number }) => r.number === 1);
                      if (round1 && latestState?.players) {
                        fetch(`/api/tournament/${encodeURIComponent(tournamentId)}/start`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            round: 1,
                            games: round1.games,
                            players: latestState.players,
                          }),
                        }).catch(() => {
                          // Non-critical — players can still see their board by polling state on next load
                        });
                      }
                    } catch { /* ignore */ }
                  }, 150);
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
