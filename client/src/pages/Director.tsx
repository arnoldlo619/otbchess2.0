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
import confetti from "canvas-confetti";
import { AddPlayerModal } from "@/components/AddPlayerModal";
import { UploadRSVPModal } from "@/components/UploadRSVPModal";
import { QRModal } from "@/components/QRModal";
import { RoundTimer } from "@/components/RoundTimer";
import { AnnounceModal } from "@/components/AnnounceModal";
import { SpectatorShareModal } from "@/components/SpectatorShareModal";
import { SpectatorQRScreen } from "@/components/SpectatorQRScreen";
import { useParams, useLocation } from "wouter";
import { NavLogo } from "@/components/NavLogo";
import { MinimalTournamentNav } from "@/components/MinimalTournamentNav";
import { toast } from "sonner";
import { useTheme } from "@/contexts/ThemeContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useDirectorState } from "@/lib/directorState";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { PlayerHoverCard } from "@/components/PlayerProfileCard";
import { getStandings, FLAG_EMOJI, type Result } from "@/lib/tournamentData";
import { getTournamentConfig, hasDirectorSession, updateTournamentConfig } from "@/lib/tournamentRegistry";
import { useAuthContext } from "@/context/AuthContext";
import { TournamentSettingsPanel } from "@/components/TournamentSettingsPanel";
import { UndoSnackbar } from "@/components/UndoSnackbar";
import { useUndoResult } from "@/hooks/useUndoResult";
import { useSwipeGesture } from "@/hooks/useSwipeGesture";
import { generateResultsPdf } from "@/lib/generateResultsPdf";
import { useClubAvatar } from "@/hooks/useClubAvatar";
import { recordTournamentCompleted } from "@/lib/clubFeedRegistry";
import { InstagramCarouselModal } from "@/components/InstagramCarouselModal";
import { SmtpSettingsCard } from "@/components/SmtpSettingsCard";
import { EliminationBracketView, SwissElimCutoffScreen } from "@/components/EliminationBracketView";
import { CutoffOverrideModal } from "@/components/CutoffOverrideModal";
import { TiebreakTooltip } from "@/components/TiebreakTooltip";
import { StyleAwarePairingsPanel } from "@/components/StyleAwarePairingsPanel";
import { computeStyleSignals, synthesiseStyleProfile, type StylePairingPlayer } from "@/lib/styleAwarePairings";
import { EditPlayerModal } from "@/components/EditPlayerModal";
import { PairingSwapModal } from "@/components/PairingSwapModal";
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
  MessageSquare,
  Tv2,
  Undo2,
  Info,
  FileSpreadsheet,
  ArrowLeftRight,
  GripVertical,
  Pencil,
  Coffee,
  Cast,
  Eye,
  EyeOff,
  ExternalLink,
  Globe,
  Target,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Download the current player roster as a CSV file. */
function exportPlayersCSV(players: import("@/lib/tournamentData").Player[], tournamentName: string) {
  const headers = ["name", "username", "elo", "title", "country", "wins", "draws", "losses", "points"];
  const escape = (v: string | number | undefined) => {
    const s = String(v ?? "");
    return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = players.map((p) => [
    escape(p.name),
    escape(p.username),
    escape(p.elo),
    escape(p.title ?? ""),
    escape(p.country ?? ""),
    escape(p.wins),
    escape(p.draws),
    escape(p.losses),
    escape(p.points),
  ].join(","));
  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const slug = tournamentName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const date = new Date().toISOString().slice(0, 10);
  a.download = `${slug}-players-${date}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

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
        <span className={`flex items-center gap-1.5 text-xs font-bold tracking-widest uppercase ${isDark ? "text-white/40" : "text-gray-400"}`}>
          {game.board === 1 && <Crown className="w-3 h-3 text-amber-400 flex-shrink-0" />}
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

// // ─── Board Result Card ──────────────────────────────────────────────
function BoardCard({
  game,
  players,
  onResult,
  onUndo,
  isDark,
  editMode = false,
  onSwapRequest,
  isSwapSource = false,
}: {
  game: import("@/lib/tournamentData").Game;
  players: import("@/lib/tournamentData").Player[];
  onResult: (gameId: string, result: Result) => void;
  onUndo?: () => void;
  isDark: boolean;
  /** When true, shows swap controls on this card */
  editMode?: boolean;
  /** Called when director taps this card to initiate or confirm a swap */
  onSwapRequest?: (gameId: string) => void;
  /** Highlight this card as the selected swap source */
  isSwapSource?: boolean;
}) {
  const white = players.find((p) => p.id === game.whiteId)!;
  const black = players.find((p) => p.id === game.blackId)!;
  const isComplete = game.result !== "*";
  const [prepOpen, setPrepOpen] = useState(false);

  return (
    <div
      onClick={editMode && onSwapRequest ? () => onSwapRequest(game.id) : undefined}
      className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
        editMode
          ? isSwapSource
            ? isDark
              ? "bg-[#4CAF50]/15 border-[#4CAF50]/60 shadow-[0_0_0_2px_rgba(76,175,80,0.4)] cursor-pointer"
              : "bg-[#3D6B47]/08 border-[#3D6B47]/60 shadow-[0_0_0_2px_rgba(61,107,71,0.3)] cursor-pointer"
            : isDark
            ? "bg-[oklch(0.24_0.07_145)] border-white/25 hover:border-[#4CAF50]/50 cursor-pointer"
            : "bg-white border-gray-300 hover:border-[#3D6B47]/50 cursor-pointer"
          : isDark
          ? isComplete
            ? "bg-[oklch(0.22_0.06_145)] border-white/10"
            : "bg-[oklch(0.24_0.07_145)] border-[#4CAF50]/25 shadow-[0_2px_12px_rgba(0,0,0,0.25)]"
          : isComplete
          ? "bg-white border-gray-200/60 shadow-sm"
          : "bg-white border-[#3D6B47]/25 shadow-[0_2px_8px_rgba(61,107,71,0.08)]"
      }`}
    >
      {/* Board header */}
      <div
        className={`flex items-center justify-between px-4 py-2.5 border-b ${
          isDark
            ? "border-white/08 bg-white/03"
            : "border-gray-100 bg-gray-50/60"
        }`}
      >
        <div className="flex items-center gap-2">
          {editMode && (
            <GripVertical className={`w-3.5 h-3.5 flex-shrink-0 ${isDark ? "text-white/25" : "text-gray-300"}`} />
          )}
          <span
            className={`flex items-center gap-1.5 text-[11px] font-black tracking-[0.12em] uppercase ${
              editMode
                ? isSwapSource
                  ? isDark ? "text-[#4CAF50]" : "text-[#3D6B47]"
                  : isDark ? "text-white/60" : "text-gray-600"
                : isDark ? "text-white/35" : "text-gray-400"
            }`}
          >
            {game.board === 1 && <Crown className="w-3 h-3 text-amber-400 flex-shrink-0" />}
            Board {game.board}
          </span>
          {!editMode && !isComplete && (
            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
              isDark ? "bg-amber-500/10 text-amber-400" : "bg-amber-50 text-amber-600"
            }`}>
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              Live
            </span>
          )}
          {editMode && (
            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
              isSwapSource
                ? isDark ? "bg-[#4CAF50]/20 text-[#4CAF50]" : "bg-[#3D6B47]/10 text-[#3D6B47]"
                : isDark ? "bg-white/08 text-white/35" : "bg-gray-100 text-gray-400"
            }`}>
              {isSwapSource ? "Selected — tap another board" : "Tap to swap"}
            </span>
          )}
        </div>
        {/* Prep button — opens dropdown with both player prep links */}
        {!editMode && (
          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setPrepOpen((o) => !o); }}
              className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg border transition-all duration-150 active:scale-95 ${
                isDark
                  ? "bg-[#3D6B47]/15 border-[#3D6B47]/30 text-[#5B9A6A] hover:bg-[#3D6B47]/25"
                  : "bg-[#3D6B47]/06 border-[#3D6B47]/20 text-[#3D6B47] hover:bg-[#3D6B47]/12"
              }`}
              title="Open Matchup Prep for a player"
            >
              <Target className="w-3 h-3" />
              Prep
            </button>
            {prepOpen && (
              <>
                {/* Backdrop */}
                <div className="fixed inset-0 z-40" onClick={() => setPrepOpen(false)} />
                {/* Dropdown */}
                <div className={`absolute right-0 top-full mt-1.5 z-50 rounded-xl border shadow-xl overflow-hidden min-w-[180px] ${
                  isDark ? "bg-[#111f13] border-[#2a4030]/60" : "bg-white border-gray-200"
                }`}>
                  <div className={`px-3 py-2 text-[10px] font-bold uppercase tracking-wider ${
                    isDark ? "text-white/30 border-b border-white/06" : "text-gray-400 border-b border-gray-100"
                  }`}>Prep vs.</div>
                  {[white, black].map((player) => (
                    <a
                      key={player.id}
                      href={`/prep/${encodeURIComponent(player.username)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setPrepOpen(false)}
                      className={`flex items-center gap-2.5 px-3 py-2.5 transition-colors ${
                        isDark ? "hover:bg-white/05 text-white" : "hover:bg-gray-50 text-gray-900"
                      }`}
                    >
                      <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                        isDark ? "bg-[#3D6B47]/20" : "bg-[#3D6B47]/08"
                      }`}>
                        <Target className="w-3 h-3 text-[#5B9A6A]" />
                      </div>
                      <div className="min-w-0">
                        <div className={`text-sm font-semibold truncate ${
                          isDark ? "text-white" : "text-gray-900"
                        }`}>{player.name}</div>
                        <div className={`text-[10px] truncate ${
                          isDark ? "text-white/35" : "text-gray-400"
                        }`}>{player.username}</div>
                      </div>
                    </a>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
        {!editMode && isComplete && (
          <span
            className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${resultBadgeClass(game.result, isDark)}`}
          >
            {game.result}
          </span>
        )}
        {editMode && (
          <ArrowLeftRight className={`w-3.5 h-3.5 flex-shrink-0 ${
            isSwapSource
              ? isDark ? "text-[#4CAF50]" : "text-[#3D6B47]"
              : isDark ? "text-white/25" : "text-gray-300"
          }`} />
        )}
      </div>

      {/* Players */}
      <div className="px-4 pt-3 pb-2 space-y-0">
        {/* White */}
        <div className="flex items-center gap-3 py-2.5">
          {/* Avatar with white piece indicator */}
          <div className="relative flex-shrink-0">
            <PlayerAvatar
              username={white.username}
              name={white.name}
              platform={white.platform === "lichess" ? "lichess" : "chesscom"}
              size={38}
              showBadge
              avatarUrl={white.avatarUrl}
              flairEmoji={white.flairEmoji}
            />
            <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 shadow-sm ${
              isDark ? "border-[oklch(0.24_0.07_145)] bg-white" : "border-white bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.12)]"
            }`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <PlayerHoverCard player={white} isDark={isDark}>
                <span className={`text-sm font-bold cursor-default hover:text-[#3D6B47] transition-colors truncate ${
                  isDark ? "text-white" : "text-gray-900"
                }`}>
                  {white.name}
                </span>
              </PlayerHoverCard>
              {white.title && (
                <span className={`flex-shrink-0 text-[10px] font-black px-1.5 py-0.5 rounded ${
                  isDark ? "bg-[#4CAF50]/15 text-[#4CAF50]" : "bg-[#3D6B47]/08 text-[#3D6B47]"
                }`}>
                  {white.title}
                </span>
              )}
              <span className={`flex-shrink-0 text-[11px] font-bold tabular-nums px-1.5 py-0.5 rounded-md ${
                isDark ? "bg-white/06 text-white/40" : "bg-gray-100 text-gray-400"
              }`}>{white.elo}</span>
            </div>
          </div>
          <span className={`flex-shrink-0 text-xl font-black tabular-nums ${
            game.result === "1-0" ? isDark ? "text-[#4CAF50]" : "text-[#3D6B47]"
            : game.result === "0-1" ? isDark ? "text-white/15" : "text-gray-200"
            : game.result === "½-½" ? isDark ? "text-blue-400" : "text-blue-500"
            : isDark ? "text-white/12" : "text-gray-200"
          }`}>{pointsFor(game.result, "white")}</span>
        </div>

        {/* VS divider */}
        <div className={`flex items-center gap-2 py-0 ${
          isDark ? "text-white/15" : "text-gray-300"
        }`}>
          <div className={`flex-1 h-px ${
            isDark ? "bg-white/05" : "bg-gray-100"
          }`} />
          <span className={`text-[9px] font-black uppercase tracking-[0.15em] ${
            isDark ? "text-white/20" : "text-gray-300"
          }`}>vs</span>
          <div className={`flex-1 h-px ${
            isDark ? "bg-white/05" : "bg-gray-100"
          }`} />
        </div>

        {/* Black */}
        <div className="flex items-center gap-3 py-2.5">
          <div className="relative flex-shrink-0">
            <PlayerAvatar
              username={black.username}
              name={black.name}
              platform={black.platform === "lichess" ? "lichess" : "chesscom"}
              size={38}
              showBadge
              avatarUrl={black.avatarUrl}
              flairEmoji={black.flairEmoji}
            />
            <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 shadow-sm ${
              isDark ? "border-[oklch(0.24_0.07_145)] bg-gray-900" : "border-white bg-gray-900 shadow-[0_0_0_1px_rgba(0,0,0,0.25)]"
            }`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <PlayerHoverCard player={black} isDark={isDark}>
                <span className={`text-sm font-bold cursor-default hover:text-[#3D6B47] transition-colors truncate ${
                  isDark ? "text-white" : "text-gray-900"
                }`}>
                  {black.name}
                </span>
              </PlayerHoverCard>
              {black.title && (
                <span className={`flex-shrink-0 text-[10px] font-black px-1.5 py-0.5 rounded ${
                  isDark ? "bg-[#4CAF50]/15 text-[#4CAF50]" : "bg-[#3D6B47]/08 text-[#3D6B47]"
                }`}>
                  {black.title}
                </span>
              )}
              <span className={`flex-shrink-0 text-[11px] font-bold tabular-nums px-1.5 py-0.5 rounded-md ${
                isDark ? "bg-white/06 text-white/40" : "bg-gray-100 text-gray-400"
              }`}>{black.elo}</span>
            </div>
          </div>
          <span className={`flex-shrink-0 text-xl font-black tabular-nums ${
            game.result === "0-1" ? isDark ? "text-[#4CAF50]" : "text-[#3D6B47]"
            : game.result === "1-0" ? isDark ? "text-white/15" : "text-gray-200"
            : game.result === "½-½" ? isDark ? "text-blue-400" : "text-blue-500"
            : isDark ? "text-white/12" : "text-gray-200"
          }`}>{pointsFor(game.result, "black")}</span>
        </div>
      </div>

      {/* Result entry buttons — hidden in edit/swap mode */}
      {editMode ? (
        <div className={`px-4 pb-4 pt-2 flex items-center justify-center gap-2 ${
          isDark ? "text-white/30" : "text-gray-400"
        }`}>
          <ArrowLeftRight className="w-3.5 h-3.5" />
          <span className="text-xs font-medium">
            {isSwapSource ? "Now tap another board to swap" : "Tap to select this board for swap"}
          </span>
        </div>
      ) : (
      <div
        className={`px-4 pb-4 pt-1.5 flex gap-2 ${isComplete ? "opacity-55" : ""}`}
      >
        {([
          { value: "1-0"  as Result, label: white?.name?.split(" ")[0] ?? "White", isWinner: true,  isDraw: false },
          { value: "½-½" as Result, label: "Draw",                              isWinner: false, isDraw: true  },
          { value: "0-1"  as Result, label: black?.name?.split(" ")[0] ?? "Black", isWinner: true,  isDraw: false },
        ] as const).map((opt) => {
          const isSelected = game.result === opt.value;
          // When a result is set, dim the non-selected buttons
          const hasResult = game.result && game.result !== "*";
          const isDimmed = !isSelected && !!hasResult;
          return (
            <button
              key={opt.value}
              onClick={() => {
                if (navigator.vibrate) navigator.vibrate(isSelected ? [30, 20, 30] : 40);
                onResult(game.id, opt.value);
                const resultLabel =
                  opt.value === "1-0" ? `${white?.name ?? "White"} wins`
                  : opt.value === "0-1" ? `${black?.name ?? "Black"} wins`
                  : "Draw";
                toast.success(`Board ${game.board}: ${resultLabel} recorded`);
              }}
              className={`flex-1 py-3.5 px-2 text-sm font-bold rounded-xl border transition-all duration-150 active:scale-[0.97] truncate ${
                isSelected
                  ? opt.isDraw
                    ? isDark
                      ? "bg-amber-500/20 border-amber-500/50 text-amber-400 shadow-[0_0_0_1px_rgba(245,158,11,0.2)] scale-[1.02]"
                      : "bg-amber-50 border-amber-300 text-amber-600 shadow-[0_0_0_1px_rgba(245,158,11,0.15)] scale-[1.02]"
                    : isDark
                      ? "bg-[#4CAF50]/20 border-[#4CAF50]/50 text-[#4CAF50] shadow-[0_0_0_1px_rgba(76,175,80,0.2)] scale-[1.02]"
                      : "bg-[#3D6B47]/10 border-[#3D6B47]/40 text-[#3D6B47] shadow-[0_0_0_1px_rgba(61,107,71,0.15)] scale-[1.02]"
                  : isDimmed
                  ? isDark
                    ? "bg-white/02 border-white/05 text-white/20 cursor-default"
                    : "bg-gray-50/40 border-gray-100 text-gray-300 cursor-default"
                  : isDark
                  ? "bg-white/04 border-white/08 text-white/50 hover:bg-white/08 hover:text-white/80 hover:border-white/15"
                  : "bg-gray-50/80 border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-700 hover:border-gray-300"
              }`}
              title={opt.value === "1-0" ? `${white?.name} wins` : opt.value === "0-1" ? `${black?.name} wins` : "Draw"}
            >
              {opt.label}
            </button>
          );
        })}
        {isComplete && (
          <>
            {/* Undo last result */}
            {onUndo && (
              <button
                onClick={() => {
                  if (navigator.vibrate) navigator.vibrate([20, 10, 20]);
                  onUndo();
                }}
                className={`flex-shrink-0 w-11 py-3 flex items-center justify-center rounded-xl border transition-all duration-150 active:scale-95 ${
                  isDark
                    ? "bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20"
                    : "bg-amber-50 border-amber-200 text-amber-500 hover:bg-amber-100"
                }`}
                title="Undo last result"
              >
                <Undo2 className="w-4 h-4" />
              </button>
            )}
            {/* Clear result */}
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
          </>
        )}
      </div>
      )}
    </div>
  );
}

// ─── Double Swiss Board Card ─────────────────────────────────────────────────
/**
 * Shows both Game A (normal colors) and Game B (swapped colors) for a single
 * Double Swiss board pairing. Players are displayed once at the top; two
 * result rows sit below — one per game.
 */
function DoubleSwissBoardCard({
  gameA,
  gameB,
  players,
  onResult,
  isDark,
}: {
  gameA: import("@/lib/tournamentData").Game;
  gameB: import("@/lib/tournamentData").Game;
  players: import("@/lib/tournamentData").Player[];
  onResult: (gameId: string, result: Result) => void;
  isDark: boolean;
}) {
  const p1 = players.find((p) => p.id === gameA.whiteId)!;
  const p2 = players.find((p) => p.id === gameA.blackId)!;
  const bothComplete = gameA.result !== "*" && gameB.result !== "*";
  const gameADone = gameA.result !== "*";
  const gameBDone = gameB.result !== "*";
  const anyDone = gameADone || gameBDone;
  const [prepOpen, setPrepOpen] = useState(false);

  // Running score: p1 is gameA.white (so p1 scores from white wins in A, black wins in B)
  function scoreFor(game: import("@/lib/tournamentData").Game, forWhite: boolean): number {
    if (game.result === "*") return 0;
    if (game.result === "½-½") return 0.5;
    if (forWhite) return game.result === "1-0" ? 1 : 0;
    return game.result === "0-1" ? 1 : 0;
  }
  // p1 is white in gameA, black in gameB
  const p1Score = scoreFor(gameA, true) + scoreFor(gameB, false);
  const p2Score = scoreFor(gameA, false) + scoreFor(gameB, true);

  function fmtScore(s: number): string {
    return s === 0.5 ? "½" : s === 1.5 ? "1½" : String(s);
  }

  function GameRow({ game, label }: { game: import("@/lib/tournamentData").Game; label: string }) {
    const white = players.find((p) => p.id === game.whiteId)!;
    const black = players.find((p) => p.id === game.blackId)!;
    const isComplete = game.result !== "*";
    return (
      <div className={`rounded-xl border px-3 py-2.5 ${
        isDark
          ? isComplete ? "bg-white/03 border-white/08" : "bg-white/05 border-[#4CAF50]/20"
          : isComplete ? "bg-gray-50 border-gray-200" : "bg-white border-[#3D6B47]/20"
      }`}>
        {/* Game label + result badge */}
        <div className="flex items-center justify-between mb-2">
          <span className={`text-[10px] font-black tracking-widest uppercase ${
            isDark ? "text-white/30" : "text-gray-400"
          }`}>{label}</span>
          {isComplete && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${resultBadgeClass(game.result, isDark)}`}>
              {game.result}
            </span>
          )}
        </div>
        {/* Color indicators */}
        <div className="flex items-center gap-1.5 mb-2.5 text-[11px]">
          <span className={`px-1.5 py-0.5 rounded font-bold ${
            isDark ? "bg-white/90 text-gray-900" : "bg-white border border-gray-200 text-gray-700"
          }`}>{white.name.split(" ")[0]} ⬜</span>
          <span className={isDark ? "text-white/25" : "text-gray-300"}>vs</span>
          <span className={`px-1.5 py-0.5 rounded font-bold ${
            isDark ? "bg-gray-900/80 text-white/80 border border-white/10" : "bg-gray-900 text-white"
          }`}>{black.name.split(" ")[0]} ⬛</span>
        </div>
        {/* Result buttons */}
        <div className={`flex gap-1.5 ${isComplete ? "opacity-60" : ""}`}>
           {(["1-0", "½-½", "0-1"] as Result[]).map((v) => {
            const isSelected = game.result === v;
            const label = v === "1-0" ? white.name.split(" ")[0] : v === "0-1" ? black.name.split(" ")[0] : "Draw";
            const isDrawOpt = v === "½-½";
            const hasResult = game.result && game.result !== "*";
            const isDimmed = !isSelected && !!hasResult;
            return (
              <button
                key={v}
                onClick={() => {
                  if (navigator.vibrate) navigator.vibrate(isSelected ? [30, 20, 30] : 40);
                  onResult(game.id, v);
                }}
                className={`flex-1 py-2.5 px-1 text-xs font-bold rounded-lg border transition-all duration-150 active:scale-[0.97] truncate ${
                  isSelected
                    ? isDrawOpt
                      ? isDark
                        ? "bg-amber-500/20 border-amber-500/50 text-amber-400"
                        : "bg-amber-50 border-amber-300 text-amber-600"
                      : isDark
                        ? "bg-[#4CAF50]/20 border-[#4CAF50]/50 text-[#4CAF50]"
                        : "bg-[#3D6B47]/10 border-[#3D6B47]/40 text-[#3D6B47]"
                    : isDimmed
                    ? isDark
                      ? "bg-white/02 border-white/05 text-white/20 cursor-default"
                      : "bg-gray-50/40 border-gray-100 text-gray-300 cursor-default"
                    : isDark
                    ? "bg-white/04 border-white/08 text-white/50 hover:bg-white/08 hover:text-white/80"
                    : "bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                }`}
              >
                {label}
              </button>
            );
          })}
          {isComplete && (
            <button
              onClick={() => onResult(game.id, "*")}
              className={`flex-shrink-0 w-9 py-2 text-xs rounded-lg border transition-all duration-150 ${
                isDark
                  ? "bg-white/05 border-white/10 text-white/40 hover:bg-white/10"
                  : "bg-gray-50 border-gray-200 text-gray-400 hover:bg-gray-100"
              }`}
              title="Clear result"
            >✕</button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border overflow-hidden transition-all duration-200 ${
      isDark
        ? bothComplete
          ? "bg-[oklch(0.22_0.06_145)] border-white/10"
          : "bg-[oklch(0.24_0.07_145)] border-[#4CAF50]/25 shadow-[0_2px_12px_rgba(0,0,0,0.25)]"
        : bothComplete
        ? "bg-white border-gray-200/60 shadow-sm"
        : "bg-white border-[#3D6B47]/25 shadow-[0_2px_8px_rgba(61,107,71,0.08)]"
    }`}>
      {/* Board header */}
      <div className={`flex items-center justify-between px-4 py-2.5 border-b ${
        isDark ? "border-white/08 bg-white/03" : "border-gray-100 bg-gray-50/60"
      }`}>
        <div className="flex items-center gap-2">
          <span className={`flex items-center gap-1.5 text-[11px] font-black tracking-[0.12em] uppercase ${
            isDark ? "text-white/35" : "text-gray-400"
          }`}>
            {gameA.board === 1 && <Crown className="w-3 h-3 text-amber-400 flex-shrink-0" />}
            Board {gameA.board}
          </span>
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
            isDark ? "bg-[#4CAF50]/15 text-[#4CAF50]" : "bg-[#3D6B47]/08 text-[#3D6B47]"
          }`}>2× Games</span>
          {!bothComplete && (
            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
              isDark ? "bg-amber-500/10 text-amber-400" : "bg-amber-50 text-amber-600"
            }`}>
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              Live
            </span>
          )}
        </div>
        {/* Prep button */}
        <div className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); setPrepOpen((o) => !o); }}
            className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg border transition-all duration-150 active:scale-95 ${
              isDark
                ? "bg-[#3D6B47]/15 border-[#3D6B47]/30 text-[#5B9A6A] hover:bg-[#3D6B47]/25"
                : "bg-[#3D6B47]/06 border-[#3D6B47]/20 text-[#3D6B47] hover:bg-[#3D6B47]/12"
            }`}
            title="Open Matchup Prep for a player"
          >
            <Target className="w-3 h-3" />
            Prep
          </button>
          {prepOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setPrepOpen(false)} />
              <div className={`absolute right-0 top-full mt-1.5 z-50 rounded-xl border shadow-xl overflow-hidden min-w-[180px] ${
                isDark ? "bg-[#111f13] border-[#2a4030]/60" : "bg-white border-gray-200"
              }`}>
                <div className={`px-3 py-2 text-[10px] font-bold uppercase tracking-wider ${
                  isDark ? "text-white/30 border-b border-white/06" : "text-gray-400 border-b border-gray-100"
                }`}>Prep vs.</div>
                {[p1, p2].map((player) => (
                  <a
                    key={player.id}
                    href={`/prep/${encodeURIComponent(player.username)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setPrepOpen(false)}
                    className={`flex items-center gap-2.5 px-3 py-2.5 transition-colors ${
                      isDark ? "hover:bg-white/05 text-white" : "hover:bg-gray-50 text-gray-900"
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                      isDark ? "bg-[#3D6B47]/20" : "bg-[#3D6B47]/08"
                    }`}>
                      <Target className="w-3 h-3 text-[#5B9A6A]" />
                    </div>
                    <div className="min-w-0">
                      <div className={`text-sm font-semibold truncate ${
                        isDark ? "text-white" : "text-gray-900"
                      }`}>{player.name}</div>
                      <div className={`text-[10px] truncate ${
                        isDark ? "text-white/35" : "text-gray-400"
                      }`}>{player.username}</div>
                    </div>
                  </a>
                ))}
              </div>
            </>
          )}
        </div>
        {/* Running match score tally — visible once any game has a result */}
        {anyDone && (() => {
          // Determine winner when both games are done
          const p1Wins = bothComplete && p1Score > p2Score;
          const p2Wins = bothComplete && p2Score > p1Score;
          const isDraw = bothComplete && p1Score === p2Score;
          return (
            <div className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-xl border ${
              bothComplete
                ? isDark
                  ? "bg-[#4CAF50]/10 border-[#4CAF50]/20"
                  : "bg-[#3D6B47]/08 border-[#3D6B47]/20"
                : isDark
                ? "bg-amber-500/08 border-amber-500/20 text-amber-300"
                : "bg-amber-50 border-amber-200 text-amber-700"
            }`}>
              {/* P1 name */}
              <span className={`flex items-center gap-0.5 truncate max-w-[56px] ${
                bothComplete
                  ? p1Wins
                    ? isDark ? "text-[#4CAF50] font-black" : "text-[#3D6B47] font-black"
                    : isDraw
                    ? isDark ? "text-white/60" : "text-gray-500"
                    : isDark ? "text-white/35" : "text-gray-400"
                  : ""
              }`}>
                {p1Wins && <span className="text-[11px] leading-none">&#x1F451;</span>}
                {p1.name.split(" ")[0]}
              </span>
              {/* Score */}
              <span className={`tabular-nums tracking-tight ${
                bothComplete
                  ? isDraw
                    ? isDark ? "text-white/50" : "text-gray-400"
                    : isDark ? "text-white/70" : "text-gray-600"
                  : ""
              }`}>
                {fmtScore(p1Score)}
                <span className={`mx-0.5 ${
                  isDark ? "text-white/25" : "text-gray-300"
                }`}>–</span>
                {fmtScore(p2Score)}
              </span>
              {/* P2 name */}
              <span className={`flex items-center gap-0.5 truncate max-w-[56px] ${
                bothComplete
                  ? p2Wins
                    ? isDark ? "text-[#4CAF50] font-black" : "text-[#3D6B47] font-black"
                    : isDraw
                    ? isDark ? "text-white/60" : "text-gray-500"
                    : isDark ? "text-white/35" : "text-gray-400"
                  : ""
              }`}>
                {p2.name.split(" ")[0]}
                {p2Wins && <span className="text-[11px] leading-none">&#x1F451;</span>}
              </span>
              {/* Live badge (while pending) or Draw badge */}
              {!bothComplete && (
                <span className={`ml-0.5 text-[9px] font-black uppercase tracking-widest ${
                  isDark ? "text-amber-400/70" : "text-amber-600/70"
                }`}>live</span>
              )}
              {isDraw && (
                <span className={`ml-0.5 text-[9px] font-black uppercase tracking-widest ${
                  isDark ? "text-white/40" : "text-gray-400"
                }`}>draw</span>
              )}
            </div>
          );
        })()}
      </div>

      {/* Player names row */}
      <div className="px-4 pt-3 pb-2 flex items-center gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <PlayerAvatar username={p1.username} name={p1.name}
            platform={p1.platform === "lichess" ? "lichess" : "chesscom"}
            size={32} showBadge avatarUrl={p1.avatarUrl} flairEmoji={p1.flairEmoji} />
          <span className={`text-sm font-bold truncate ${isDark ? "text-white" : "text-gray-900"}`}>{p1.name}</span>
          {p1.title && <span className={`flex-shrink-0 text-[10px] font-black px-1.5 py-0.5 rounded ${
            isDark ? "bg-[#4CAF50]/15 text-[#4CAF50]" : "bg-[#3D6B47]/08 text-[#3D6B47]"
          }`}>{p1.title}</span>}
          <span className={`flex-shrink-0 text-[11px] font-bold tabular-nums px-1.5 py-0.5 rounded-md ${
            isDark ? "bg-white/06 text-white/40" : "bg-gray-100 text-gray-400"
          }`}>{p1.elo}</span>
        </div>
        <span className={`flex-shrink-0 text-[10px] font-black uppercase tracking-widest ${
          isDark ? "text-white/20" : "text-gray-300"
        }`}>vs</span>
        <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
          <span className={`text-sm font-bold truncate text-right ${isDark ? "text-white" : "text-gray-900"}`}>{p2.name}</span>
          {p2.title && <span className={`flex-shrink-0 text-[10px] font-black px-1.5 py-0.5 rounded ${
            isDark ? "bg-[#4CAF50]/15 text-[#4CAF50]" : "bg-[#3D6B47]/08 text-[#3D6B47]"
          }`}>{p2.title}</span>}
          <span className={`flex-shrink-0 text-[11px] font-bold tabular-nums px-1.5 py-0.5 rounded-md ${
            isDark ? "bg-white/06 text-white/40" : "bg-gray-100 text-gray-400"
          }`}>{p2.elo}</span>
          <PlayerAvatar username={p2.username} name={p2.name}
            platform={p2.platform === "lichess" ? "lichess" : "chesscom"}
            size={32} showBadge avatarUrl={p2.avatarUrl} flairEmoji={p2.flairEmoji} />
        </div>
      </div>

      {/* Two game rows */}
      <div className="px-4 pb-4 space-y-2">
        <GameRow game={gameA} label="Game A" />
        <GameRow game={gameB} label="Game B" />
      </div>
    </div>
  );
}

/// ─── Standings Mini Table ─────────────────────────────────────────────────────
function StandingsPanel({
  players,
  isDark,
}: {
  players: import("@/lib/tournamentData").Player[];
  isDark: boolean;
}) {
  const standings = getStandings(players);
  // Rank badge colours: gold / silver / bronze / plain
  const rankColors = [
    isDark ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" : "bg-amber-50 text-amber-600 border border-amber-200",
    isDark ? "bg-gray-400/15 text-gray-300 border border-gray-400/25" : "bg-gray-100 text-gray-500 border border-gray-200",
    isDark ? "bg-orange-500/15 text-orange-400 border border-orange-500/25" : "bg-orange-50 text-orange-600 border border-orange-200",
  ];
  return (
    <div className="space-y-1">
      {standings.map((p, i) => (
        <div
          key={p.id}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
            i === 0
              ? isDark ? "bg-amber-500/08" : "bg-amber-50/60"
              : i < 3
              ? isDark ? "bg-white/03" : "bg-gray-50/60"
              : ""
          }`}
        >
          {/* Rank badge */}
          <span className={`flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-lg text-[10px] font-black ${
            i < 3 ? rankColors[i] : isDark ? "text-white/20" : "text-gray-300"
          }`}>
            {i + 1}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span
                className={`text-sm font-bold truncate ${isDark ? "text-white" : "text-gray-900"}`}
              >
                {p.name.split(" ")[0]}
              </span>
              {p.title && (
                <span className={`flex-shrink-0 text-[10px] font-black px-1.5 py-0.5 rounded ${
                  isDark ? "bg-[#4CAF50]/15 text-[#4CAF50]" : "bg-[#3D6B47]/08 text-[#3D6B47]"
                }`}>{p.title}</span>
              )}
            </div>
            <span className={`text-[11px] tabular-nums ${isDark ? "text-white/30" : "text-gray-400"}`}>
              {p.elo}
            </span>
          </div>
          <span
            className={`text-base font-black tabular-nums ${
              i === 0
                ? isDark ? "text-amber-400" : "text-amber-600"
                : isDark ? "text-white" : "text-gray-900"
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
// ─── Vertical Round Tracker ───────────────────────────────────────────────────
function VerticalRoundTracker({
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
    <div
      className={`flex flex-col items-center gap-0 rounded-2xl px-3 py-4 ${
        isDark ? "bg-white/05 border border-white/08" : "bg-gray-50 border border-gray-200"
      }`}
      style={{ minWidth: 56 }}
    >
      {/* Header label */}
      <span
        className={`text-[9px] font-bold uppercase tracking-widest mb-4 ${
          isDark ? "text-white/30" : "text-gray-400"
        }`}
      >
        Rounds
      </span>

      {Array.from({ length: totalRounds }, (_, i) => i + 1).map((r) => {
        const roundData = rounds.find((rd) => rd.number === r);
        const isComplete = roundData?.status === "completed";
        const isCurrent = r === currentRound;

        return (
          <div key={r} className="flex flex-col items-center">
            {/* Round dot — larger: w-10 h-10 */}
            <div
              className={`relative flex items-center justify-center w-10 h-10 rounded-full text-sm font-bold transition-all duration-300 ${
                isComplete
                  ? "bg-[#3D6B47] text-white shadow-md"
                  : isCurrent
                  ? isDark
                    ? "bg-[#4CAF50]/20 text-[#4CAF50] border-2 border-[#4CAF50]"
                    : "bg-[#3D6B47]/10 text-[#3D6B47] border-2 border-[#3D6B47]"
                  : isDark
                  ? "bg-white/06 text-white/25 border border-white/10"
                  : "bg-white text-gray-300 border border-gray-200"
              }`}
            >
              {/* Pulse ring for current round */}
              {isCurrent && (
                <span
                  className="absolute inset-0 rounded-full animate-ping opacity-30"
                  style={{ background: isDark ? "#4CAF50" : "#3D6B47" }}
                />
              )}
              {isComplete ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <span>{r}</span>
              )}
            </div>

            {/* Connector line — taller: h-7 */}
            {r < totalRounds && (
              <div
                className={`w-0.5 h-7 rounded-full transition-all duration-300 ${
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

      {/* Completion indicator */}
      {currentRound > totalRounds && (
        <div className="mt-4 flex flex-col items-center gap-1">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center shadow-md"
            style={{ background: "#3D6B47" }}
          >
            <Trophy className="w-4 h-4 text-white" />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Horizontal Round Tracker (mobile only) ─────────────────────────────────
function HorizontalRoundTracker({
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
    <div
      className={`flex items-center gap-0 rounded-2xl px-4 py-3 overflow-x-auto scrollbar-none ${
        isDark ? "bg-white/05 border border-white/08" : "bg-gray-50 border border-gray-200"
      }`}
    >
      {/* Label */}
      <span
        className={`text-[9px] font-bold uppercase tracking-widest mr-3 shrink-0 ${
          isDark ? "text-white/30" : "text-gray-400"
        }`}
      >
        Rounds
      </span>

      {Array.from({ length: totalRounds }, (_, i) => i + 1).map((r) => {
        const roundData = rounds.find((rd) => rd.number === r);
        const isComplete = roundData?.status === "completed";
        const isCurrent = r === currentRound;

        return (
          <div key={r} className="flex items-center">
            {/* Round dot */}
            <div
              className={`relative flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold shrink-0 transition-all duration-300 ${
                isComplete
                  ? "bg-[#3D6B47] text-white shadow-md"
                  : isCurrent
                  ? isDark
                    ? "bg-[#4CAF50]/20 text-[#4CAF50] border-2 border-[#4CAF50]"
                    : "bg-[#3D6B47]/10 text-[#3D6B47] border-2 border-[#3D6B47]"
                  : isDark
                  ? "bg-white/06 text-white/25 border border-white/10"
                  : "bg-white text-gray-300 border border-gray-200"
              }`}
            >
              {isCurrent && (
                <span
                  className="absolute inset-0 rounded-full animate-ping opacity-30"
                  style={{ background: isDark ? "#4CAF50" : "#3D6B47" }}
                />
              )}
              {isComplete ? (
                <CheckCircle2 className="w-3.5 h-3.5" />
              ) : (
                <span>{r}</span>
              )}
            </div>

            {/* Horizontal connector (not after last round) */}
            {r < totalRounds && (
              <div
                className={`h-0.5 w-5 shrink-0 rounded-full transition-all duration-300 ${
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

      {/* Trophy when all rounds done */}
      {currentRound > totalRounds && (
        <div className="ml-2 flex items-center shrink-0">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center shadow-md"
            style={{ background: "#3D6B47" }}
          >
            <Trophy className="w-3.5 h-3.5 text-white" />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Settings Tab Helper Cards ──────────────────────────────────────────────

function DirectorCodeCard({ directorCode, isDark }: { directorCode: string; isDark: boolean }) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(directorCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className={`rounded-2xl border overflow-hidden ${
      isDark ? "bg-[oklch(0.22_0.06_145)] border-white/08" : "bg-white border-gray-100"
    }`}>
      <div className={`px-5 py-3 border-b flex items-center justify-between ${
        isDark ? "border-white/06" : "border-gray-100"
      }`}>
        <div className="flex items-center gap-2">
          <Shield className={`w-3.5 h-3.5 ${ isDark ? "text-[#4CAF50]/70" : "text-[#3D6B47]/70" }`} />
          <h2 className={`text-xs font-bold uppercase tracking-widest ${ isDark ? "text-white/35" : "text-gray-400" }`}>Director Code</h2>
        </div>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
          isDark ? "bg-white/08 text-white/40" : "bg-gray-100 text-gray-400"
        }`}>Private</span>
      </div>
      <div className="px-5 py-4 space-y-2">
        <p className={`text-xs ${ isDark ? "text-white/35" : "text-gray-400" }`}>
          Use this code to access the Director Dashboard from any device. Keep it private.
        </p>
        <div className="flex items-center gap-2">
          <div className={`flex-1 flex items-center rounded-xl border px-4 py-2.5 font-mono text-sm ${
            isDark ? "bg-[oklch(0.25_0.07_145)] border-white/10 text-white/80" : "bg-gray-50 border-gray-200 text-gray-800"
          }`}>
            {visible ? directorCode : "•".repeat(directorCode.length)}
          </div>
          <button
            onClick={() => setVisible((v) => !v)}
            className={`p-2.5 rounded-xl border transition-colors ${
              isDark ? "border-white/10 hover:bg-white/08 text-white/50" : "border-gray-200 hover:bg-gray-50 text-gray-500"
            }`}
          >
            {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
          <button
            onClick={copy}
            className={`p-2.5 rounded-xl border transition-colors ${
              copied
                ? isDark ? "border-[#4CAF50]/40 bg-[#4CAF50]/15 text-[#4CAF50]" : "border-green-300 bg-green-50 text-green-700"
                : isDark ? "border-white/10 hover:bg-white/08 text-white/50" : "border-gray-200 hover:bg-gray-50 text-gray-500"
            }`}
          >
            {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}

function PublicTournamentCard({
  tournamentId,
  isDark,
}: {
  tournamentId: string;
  isDark: boolean;
}) {
  const [isPublic, setIsPublic] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [copied, setCopied] = useState(false);

  const publicUrl = `${window.location.origin}/live/${tournamentId}`;

  // Fetch current public status on mount
  useEffect(() => {
    if (tournamentId === "otb-demo-2026") {
      setLoading(false);
      return;
    }
    fetch(`/api/tournament/${encodeURIComponent(tournamentId)}/public`, { credentials: "include" })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) setIsPublic(!!data.isPublic);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [tournamentId]);

  const toggle = async () => {
    if (tournamentId === "otb-demo-2026") {
      toast.info("Public mode is not available for the demo tournament");
      return;
    }
    setToggling(true);
    try {
      const res = await fetch(`/api/tournament/${encodeURIComponent(tournamentId)}/public`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isPublic: !isPublic }),
      });
      if (res.ok) {
        setIsPublic(!isPublic);
        toast.success(!isPublic ? "Tournament is now public" : "Tournament is now private");
      } else {
        toast.error("Failed to update visibility");
      }
    } catch {
      toast.error("Network error");
    }
    setToggling(false);
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (tournamentId === "otb-demo-2026") return null;

  return (
    <div className={`rounded-2xl border overflow-hidden ${
      isDark ? "bg-[oklch(0.22_0.06_145)] border-white/08" : "bg-white border-gray-100"
    }`}>
      <div className={`px-5 py-3 border-b flex items-center justify-between ${
        isDark ? "border-white/06" : "border-gray-100"
      }`}>
        <div className="flex items-center gap-2">
          <Globe className={`w-3.5 h-3.5 ${isDark ? "text-[#4CAF50]/70" : "text-[#3D6B47]/70"}`} />
          <h2 className={`text-xs font-bold uppercase tracking-widest ${isDark ? "text-white/35" : "text-gray-400"}`}>Public Tournament</h2>
        </div>
        {isPublic && (
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
            isDark ? "bg-emerald-500/15 text-emerald-400" : "bg-green-50 text-green-600"
          }`}>● Live</span>
        )}
      </div>
      <div className="px-5 py-4 space-y-3">
        <p className={`text-xs ${isDark ? "text-white/35" : "text-gray-400"}`}>
          Share a public link or QR code so attendees can follow pairings, standings, and individual players — no account needed.
        </p>

        {/* Toggle */}
        <button
          onClick={toggle}
          disabled={loading || toggling}
          className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${
            isPublic
              ? isDark
                ? "border-[#3D6B47]/40 bg-[#3D6B47]/10"
                : "border-[#3D6B47]/30 bg-[#F0F8F2]"
              : isDark
              ? "border-white/10 bg-white/03 hover:bg-white/06"
              : "border-gray-200 bg-gray-50 hover:bg-gray-100"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              isPublic
                ? isDark ? "bg-[#3D6B47]/20" : "bg-[#3D6B47]/10"
                : isDark ? "bg-white/08" : "bg-gray-200"
            }`}>
              {isPublic
                ? <Eye className={`w-4 h-4 ${isDark ? "text-[#4CAF50]" : "text-[#3D6B47]"}`} />
                : <EyeOff className={`w-4 h-4 ${isDark ? "text-white/40" : "text-gray-400"}`} />}
            </div>
            <div className="text-left">
              <p className={`text-sm font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
                {isPublic ? "Public" : "Private"}
              </p>
              <p className={`text-xs ${isDark ? "text-white/40" : "text-gray-400"}`}>
                {isPublic ? "Anyone with the link can view" : "Only you can see this tournament"}
              </p>
            </div>
          </div>
          <div className={`w-11 h-6 rounded-full transition-colors relative ${
            isPublic ? "bg-[#3D6B47]" : isDark ? "bg-white/15" : "bg-gray-300"
          }`}>
            <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
              isPublic ? "translate-x-5" : "translate-x-0.5"
            }`} />
          </div>
        </button>

        {/* URL + QR when public */}
        {isPublic && (
          <>
            <div className="flex items-center gap-2">
              <div className={`flex-1 flex items-center gap-2 rounded-xl border px-4 py-2.5 font-mono text-xs truncate ${
                isDark ? "bg-[oklch(0.25_0.07_145)] border-white/10 text-white/60" : "bg-gray-50 border-gray-200 text-gray-600"
              }`}>
                <span className="truncate">{publicUrl}</span>
              </div>
              <button
                onClick={copyUrl}
                className={`p-2.5 rounded-xl border transition-colors ${
                  copied
                    ? isDark ? "border-[#4CAF50]/40 bg-[#4CAF50]/15 text-[#4CAF50]" : "border-green-300 bg-green-50 text-green-700"
                    : isDark ? "border-white/10 hover:bg-white/08 text-white/50" : "border-gray-200 hover:bg-gray-50 text-gray-500"
                }`}
              >
                {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
              <a
                href={publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`p-2.5 rounded-xl border transition-colors ${
                  isDark ? "border-white/10 hover:bg-white/08 text-white/50" : "border-gray-200 hover:bg-gray-50 text-gray-500"
                }`}
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
            {/* QR Code */}
            <div className="flex justify-center public-qr-code">
              <div className={`p-4 rounded-2xl border ${
                isDark ? "bg-white border-white/10" : "bg-white border-gray-200"
              }`}>
                <QRCodeSVG value={publicUrl} size={160} level="M" />
              </div>
            </div>
            <div className="flex justify-center">
              <button
                onClick={() => {
                  const svg = document.querySelector(".public-qr-code svg") as SVGElement | null;
                  if (!svg) return;
                  const svgData = new XMLSerializer().serializeToString(svg);
                  const canvas = document.createElement("canvas");
                  canvas.width = 640;
                  canvas.height = 640;
                  const ctx = canvas.getContext("2d");
                  if (!ctx) return;
                  const img = new Image();
                  img.onload = () => {
                    ctx.fillStyle = "white";
                    ctx.fillRect(0, 0, 640, 640);
                    ctx.drawImage(img, 0, 0, 640, 640);
                    const a = document.createElement("a");
                    a.download = `tournament-qr-${tournamentId}.png`;
                    a.href = canvas.toDataURL("image/png");
                    a.click();
                  };
                  img.src = "data:image/svg+xml;base64," + btoa(svgData);
                }}
                className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                  isDark
                    ? "text-white/50 hover:text-white/80 hover:bg-white/08"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                }`}
              >
                Download QR for printing
              </button>
            </div>
            <p className={`text-center text-[10px] ${isDark ? "text-white/25" : "text-gray-400"}`}>
              Print or project this QR code at the venue
            </p>
            {/* Analytics Link */}
            <a
              href={`/tournament/${tournamentId}/analytics`}
              className={`flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl border text-xs font-semibold transition-colors mt-1 ${
                isDark
                  ? "border-[#3D6B47]/30 bg-[#3D6B47]/08 text-[#7BC88F] hover:bg-[#3D6B47]/15"
                  : "border-[#3D6B47]/20 bg-[#F0F8F2] text-[#3D6B47] hover:bg-[#E0F0E4]"
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              View Analytics
            </a>
          </>
        )}
      </div>
    </div>
  );
}

/** Tiny chip that shows public/private status in the Command Center strip */
function PublicModeChip({ tournamentId, isDark }: { tournamentId: string; isDark: boolean }) {
  const [isPublic, setIsPublic] = useState<boolean | null>(null);
  useEffect(() => {
    fetch(`/api/tournament/${encodeURIComponent(tournamentId)}/public`, { credentials: "include" })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setIsPublic(!!d.isPublic); })
      .catch(() => {});
  }, [tournamentId]);
  if (isPublic === null) return null;
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md ${
      isPublic
        ? isDark ? "bg-emerald-500/15 text-emerald-400" : "bg-green-50 text-green-600"
        : isDark ? "bg-white/06 text-white/30" : "bg-gray-100 text-gray-400"
    }`}>
      {isPublic ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
      {isPublic ? "Public" : "Private"}
    </span>
  );
}

function SpectatorCodeCard({ spectatorUrl, isDark }: { spectatorUrl: string; isDark: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(spectatorUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className={`rounded-2xl border overflow-hidden ${
      isDark ? "bg-[oklch(0.22_0.06_145)] border-white/08" : "bg-white border-gray-100"
    }`}>
      <div className={`px-5 py-3 border-b flex items-center justify-between ${
        isDark ? "border-white/06" : "border-gray-100"
      }`}>
        <div className="flex items-center gap-2">
          <Tv2 className={`w-3.5 h-3.5 ${ isDark ? "text-[#4CAF50]/70" : "text-[#3D6B47]/70" }`} />
          <h2 className={`text-xs font-bold uppercase tracking-widest ${ isDark ? "text-white/35" : "text-gray-400" }`}>Spectator View</h2>
        </div>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
          isDark ? "bg-emerald-500/15 text-emerald-400" : "bg-green-50 text-green-600"
        }`}>● Live</span>
      </div>
      <div className="px-5 py-4 space-y-2">
        <p className={`text-xs ${ isDark ? "text-white/35" : "text-gray-400" }`}>
          Share with coaches, parents &amp; spectators — no account needed.
        </p>
        <div className="flex items-center gap-2">
          <div className={`flex-1 flex items-center gap-2 rounded-xl border px-4 py-2.5 font-mono text-xs truncate ${
            isDark ? "bg-[oklch(0.25_0.07_145)] border-white/10 text-white/60" : "bg-gray-50 border-gray-200 text-gray-600"
          }`}>
            <span className="truncate">{spectatorUrl}</span>
          </div>
          <button
            onClick={copy}
            className={`p-2.5 rounded-xl border transition-colors ${
              copied
                ? isDark ? "border-[#4CAF50]/40 bg-[#4CAF50]/15 text-[#4CAF50]" : "border-green-300 bg-green-50 text-green-700"
                : isDark ? "border-white/10 hover:bg-white/08 text-white/50" : "border-gray-200 hover:bg-gray-50 text-gray-500"
            }`}
          >
            {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </button>
          <a
            href={spectatorUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`p-2.5 rounded-xl border transition-colors ${
              isDark ? "border-white/10 hover:bg-white/08 text-white/50" : "border-gray-200 hover:bg-gray-50 text-gray-500"
            }`}
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>
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
    addLatePlayer,
    updatePlayer,
    removePlayer,
    swapBoards,
    replaceRoundGames,
    assignBye,
    revokeBye,
    startTournament,
    enterResult,
    generateNextRound,
    advanceToElimination,
    resetElimination,
    togglePause,
    resetTournament,
    completeTournament,
    updateSettings,
    isSwissElimCutoff,
  } = useDirectorState(tournamentId);
  // ── Undo result snackbar ────────────────────────────────────────────────
  const { pending: undoPending, recordWithUndo, undo: undoResult, dismiss: dismissUndo } =
    useUndoResult(enterResult);

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
  const [activeTab, setActiveTab] = useState<"home" | "players" | "standings" | "bracket" | "settings">("home");
  const [swipeFlash, setSwipeFlash] = useState<"left" | "right" | null>(null);
  const [showQR, setShowQR] = useState(false);

  // Show bracket tab only for elimination or swiss_elim formats
  const isElimFormat = state.format === "elimination" || state.format === "swiss_elim";

  // Tab order for swipe navigation
  type TabId = "home" | "players" | "standings" | "bracket" | "settings";
  const TAB_ORDER: TabId[] = isElimFormat
    ? ["home", "players", "standings", "bracket", "settings"]
    : ["home", "players", "standings", "settings"];

  const navigateTab = useCallback((direction: "prev" | "next") => {
    const idx = TAB_ORDER.indexOf(activeTab);
    const nextIdx = direction === "prev" ? idx - 1 : idx + 1;
    if (nextIdx < 0 || nextIdx >= TAB_ORDER.length) return;
    setActiveTab(TAB_ORDER[nextIdx]);
    setSwipeFlash(direction === "prev" ? "right" : "left");
    setTimeout(() => setSwipeFlash(null), 350);
  }, [activeTab]);

  const swipeContainerRef = useRef<HTMLDivElement>(null);
  useSwipeGesture(swipeContainerRef, {
    threshold: 60,
    maxVerticalDrift: 80,
    onSwipeRight: () => navigateTab("prev"),
    onSwipeLeft: () => navigateTab("next"),
  });
  const [showAnnounce, setShowAnnounce] = useState(false);
  const [showSpectatorShare, setShowSpectatorShare] = useState(false);
  const [showSpectatorQR, setShowSpectatorQR] = useState(false);
  // Spectator URL — public live view, no auth required
  const spectatorUrl = `${window.location.origin}/tournament/${tournamentId}`;
  const [showOverflow, setShowOverflow] = useState(false);
  // Board assignment editing state
  const [editBoardsMode, setEditBoardsMode] = useState(false);
  const [swapSourceId, setSwapSourceId] = useState<string | null>(null);
  // Look up real tournament config for invite code and extra metadata
  const tournamentConfig = getTournamentConfig(tournamentId);

  // Fetch club avatar for PDF branding (best-effort, non-blocking)
  const { avatarUrl: clubAvatarUrl } = useClubAvatar(tournamentConfig?.clubId ?? null);

  // ── Server-side customSlug hydration ────────────────────────────────────────
  // On mount, fetch the tournament meta from the server and sync the customSlug
  // into localStorage so it is available across devices.
  useEffect(() => {
    if (tournamentId === "otb-demo-2026") return;
    fetch(`/api/tournament/${encodeURIComponent(tournamentId)}/meta`, { credentials: "include" })
      .then((r) => r.ok ? r.json() : null)
      .then((meta: { customSlug?: string | null } | null) => {
        if (meta?.customSlug) {
          updateTournamentConfig(tournamentId, { customSlug: meta.customSlug });
        }
      })
      .catch(() => { /* non-critical */ });
  }, [tournamentId]);

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
        ...(tournamentConfig.clubId ? { clubId: tournamentConfig.clubId } : {}),
        ...(tournamentConfig.clubName ? { clubName: tournamentConfig.clubName } : {}),
      };
      // Use encodeURIComponent to make the base64 URL-safe.
      // Standard btoa can produce +, /, = which URLSearchParams decodes incorrectly
      // on some Android browsers (+ is decoded as space, corrupting the JSON).
      return `${joinUrlBase}?t=${encodeURIComponent(btoa(JSON.stringify(meta)))}`;
    } catch {
      return joinUrlBase;
    }
  })();
  // Use live standings from Swiss engine (includes live Buchholz tiebreaks)
  const standings = liveStandings.map((s) => s.player);
  const completedGames = currentRoundData?.games.filter((g) => g.result !== "*").length ?? 0;
  const totalGames = currentRoundData?.games.length ?? 0;
  // Double Swiss: board-level completion (a board is complete when BOTH game A and game B have results)
  const isDoubleSwiss = state.format === "doubleswiss";
  const completedBoards = isDoubleSwiss
    ? (() => {
        const boardNums = Array.from(new Set((currentRoundData?.games ?? []).map((g) => g.board)));
        return boardNums.filter((b) => {
          const boardGames = (currentRoundData?.games ?? []).filter((g) => g.board === b);
          return boardGames.every((g) => g.result !== "*");
        }).length;
      })()
    : null;
  const totalBoards = isDoubleSwiss
    ? Array.from(new Set((currentRoundData?.games ?? []).map((g) => g.board))).length
    : null;
  // Settings are locked once any round has been generated
  const isSettingsLocked = state.rounds.length > 0 || state.status !== "registration";

  // ── Player search / filter / sort state ─────────────────────────────────
  const [playerSearch, setPlayerSearch] = useState("");
  const [filterTitle, setFilterTitle] = useState<string>("all");
  const [filterCountry, setFilterCountry] = useState<string>("all");
  const [sortKey, setSortKey] = useState<"rank" | "elo" | "name" | "points">("rank");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [showFilters, setShowFilters] = useState(false);
  const [showCutoffOverride, setShowCutoffOverride] = useState(false);
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [showUploadRSVP, setShowUploadRSVP] = useState(false);
  const [showCarousel, setShowCarousel] = useState(false);
  const [showStartConfirm, setShowStartConfirm] = useState(false);

  // ── Check-in roster state ─────────────────────────────────────────────────
  const [rosterSearch, setRosterSearch] = useState("");
  const [walkInName, setWalkInName] = useState("");
  const checkInKey = `otb-checkin-${tournamentId}`;
  const [checkedInIds, setCheckedInIds] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(checkInKey);
      return raw ? new Set(JSON.parse(raw) as string[]) : new Set<string>();
    } catch { return new Set<string>(); }
  });
  const toggleCheckIn = useCallback((playerId: string) => {
    setCheckedInIds((prev) => {
      const next = new Set(prev);
      if (next.has(playerId)) next.delete(playerId);
      else next.add(playerId);
      try { localStorage.setItem(checkInKey, JSON.stringify(Array.from(next))); } catch {}
      return next;
    });
  }, [checkInKey]);

  // ── Board search filter state ───────────────────────────────────────────────────────
  const [boardSearch, setBoardSearch] = useState("");
  const [showNextRoundConfirm, setShowNextRoundConfirm] = useState(false);
  const [showStylePanel, setShowStylePanel] = useState(false);
  // ── Edit Player modal state ───────────────────────────────────────────────
  const [editingPlayer, setEditingPlayer] = useState<import("@/lib/tournamentData").Player | null>(null);
  // ── Pairing Swap modal state ──────────────────────────────────────────────
  const [swapModalOpen, setSwapModalOpen] = useState(false);
  // ── End / Delete tournament confirm state ────────────────────────────────
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // ── Keyboard shortcuts for score entry (Boards tab only) ─────────────────
  // When the Boards tab is active, pressing 1 / D / 0 records the result for
  // the currently focused board card. Arrow keys cycle focus between boards.
  const [focusedBoardIdx, setFocusedBoardIdx] = useState<number>(0);
  const boardGames = currentRoundData?.games.filter((g) => g.whiteId !== "BYE") ?? [];
  useEffect(() => {
    if (activeTab !== "home" || isRegistration || boardGames.length === 0) return;
    const handleKey = (e: KeyboardEvent) => {
      // Don't intercept when an input/textarea/select is focused
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const key = e.key.toLowerCase();
      if (key === "arrowdown" || key === "arrowright") {
        e.preventDefault();
        setFocusedBoardIdx((i) => Math.min(i + 1, boardGames.length - 1));
      } else if (key === "arrowup" || key === "arrowleft") {
        e.preventDefault();
        setFocusedBoardIdx((i) => Math.max(i - 1, 0));
      } else if (key === "1") {
        const game = boardGames[focusedBoardIdx];
        if (game) {
          const white = state.players.find((p) => p.id === game.whiteId);
          const label = `Board ${game.board}: ${white?.name ?? "White"} wins`;
          recordWithUndo(game.id, "1-0", game.result, label);
          pushStandingsNow();
          toast.success(label);
          if (navigator.vibrate) navigator.vibrate(40);
        }
      } else if (key === "d") {
        const game = boardGames[focusedBoardIdx];
        if (game) {
          const label = `Board ${game.board}: Draw`;
          recordWithUndo(game.id, "½-½", game.result, label);
          pushStandingsNow();
          toast.success(label);
          if (navigator.vibrate) navigator.vibrate(40);
        }
      } else if (key === "0") {
        const game = boardGames[focusedBoardIdx];
        if (game) {
          const black = state.players.find((p) => p.id === game.blackId);
          const label = `Board ${game.board}: ${black?.name ?? "Black"} wins`;
          recordWithUndo(game.id, "0-1", game.result, label);
          pushStandingsNow();
          toast.success(label);
          if (navigator.vibrate) navigator.vibrate(40);
        }
      } else if (key === "backspace" || key === "delete") {
        const game = boardGames[focusedBoardIdx];
        if (game && game.result !== "*") {
          recordWithUndo(game.id, "*", game.result, `Board ${game.board}: cleared`);
          pushStandingsNow();
          toast.info(`Board ${game.board}: result cleared`);
        }
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, isRegistration, boardGames, focusedBoardIdx, state.players, recordWithUndo, pushStandingsNow]); // keyboard shortcuts always active on home tab

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

  // ── Push subscriber count — fetched once on mount and after each broadcast ──
  const [pushSubscriberCount, setPushSubscriberCount] = useState<number | null>(null);
  useEffect(() => {
    if (tournamentId === "otb-demo-2026") return;
    fetch(`/api/push/count/${encodeURIComponent(tournamentId)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d && typeof d.count === "number") setPushSubscriberCount(d.count); })
      .catch(() => {});
  }, [tournamentId]);

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

  // 🎉 Confetti burst + scroll-to-top when the final round's last result is entered
  const confettiFiredRef = useRef<number>(-1);
  const pageTopRef = useRef<HTMLDivElement>(null);
  const tournamentCompleteRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const isFinalRound = state.currentRound >= state.totalRounds && state.totalRounds > 0;
    const justCompleted = allResultsIn && !prevAllResultsIn.current;
    // Only fire once per tournament (track by totalRounds so it resets if rounds change)
    if (isFinalRound && justCompleted && confettiFiredRef.current !== state.totalRounds) {
      confettiFiredRef.current = state.totalRounds;

      // Step 1: Scroll to the top of the page so the Tournament Complete section is visible
      const scrollTarget = pageTopRef.current;
      if (scrollTarget) {
        scrollTarget.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }

      // Step 2: After scroll settles (~600ms), fire the confetti burst from both sides
      const confettiTimer = setTimeout(() => {
        const duration = 4000;
        const end = Date.now() + duration;
        const colors = ["#4CAF50", "#ffffff", "#3D6B47", "#a3e635", "#fbbf24"];
        const frame = () => {
          confetti({
            particleCount: 4,
            angle: 60,
            spread: 60,
            origin: { x: 0, y: 0.6 },
            colors,
          });
          confetti({
            particleCount: 4,
            angle: 120,
            spread: 60,
            origin: { x: 1, y: 0.6 },
            colors,
          });
          if (Date.now() < end) requestAnimationFrame(frame);
        };
        frame();
      }, 600);

      return () => clearTimeout(confettiTimer);
    }
  }, [allResultsIn, state.currentRound, state.totalRounds]);

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
      activeTab === "home" &&
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

  // Auto-navigate to bracket tab when swiss_elim transitions to elimination phase
  const prevElimPhaseRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    const prev = prevElimPhaseRef.current;
    const curr = state.elimPhase;
    if (prev === "swiss" && curr === "elimination" && state.format === "swiss_elim") {
      setActiveTab("bracket");
      const cutoff = state.elimCutoff ?? state.elimPlayers?.length ?? 0;
      toast.success(
        `Swiss phase complete — Elimination bracket generated! Top ${cutoff} players advancing.`,
        { duration: 5000 }
      );
    }
    prevElimPhaseRef.current = curr;
  }, [state.elimPhase, state.format, state.elimCutoff, state.elimPlayers]);

  // Derived: filtered + sorted player list
  const allTitles = Array.from(new Set(standings.map((p) => p.title).filter(Boolean))) as string[];
  const allCountries = Array.from(new Set(standings.map((p) => p.country)));
  const existingUsernames = state.players.map((p) => p.username);

  // Set of player IDs that have a manual bye in the current round
  const byePlayerIds = new Set(
    (currentRoundData?.games ?? [])
      .filter((g) => g.whiteId === "BYE")
      .map((g) => g.blackId)
  );

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
      {/* ── Minimal Tournament Nav (fixed, 56px tall) ───────────────── */}
      <MinimalTournamentNav
        backHref="/"
        backLabel="Home"
        centerSlot={
          <div className="flex items-center gap-2">
            {/* Join QR: visible during registration and Round 1 */}
            {(isRegistration || state.currentRound === 1) && (
              <button
                onClick={() => setShowAnnounce(true)}
                className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all duration-150 active:scale-95 ${
                  isDark
                    ? "bg-[#4CAF50]/20 border-[#4CAF50]/40 text-[#7FD48F] hover:bg-[#4CAF50]/30 hover:border-[#4CAF50]/60"
                    : "bg-[#3D6B47] border-[#3D6B47] text-white hover:bg-[#2d5236] hover:border-[#2d5236] shadow-sm"
                }`}
                title="Show join QR code full-screen for players to scan"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>Join QR</span>
              </button>
            )}
            {/* Live Stream QR: visible when tournament is active or completed */}
            {!isRegistration && (
              <button
                onClick={() => setShowSpectatorQR(true)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all duration-150 active:scale-95 ${
                  isDark
                    ? "bg-white/08 border-white/15 text-white/80 hover:bg-white/14 hover:border-white/25"
                    : "bg-white border-gray-200 text-gray-800 hover:bg-gray-50 hover:border-gray-300 shadow-sm"
                }`}
                title="Project live standings QR on a screen or projector"
              >
                {/* Pulsing live dot */}
                <span className="relative flex h-2 w-2 flex-shrink-0">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-60 ${
                    isDark ? "bg-[#4CAF50]" : "bg-[#3D6B47]"
                  }`} />
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${
                    isDark ? "bg-[#4CAF50]" : "bg-[#3D6B47]"
                  }`} />
                </span>
                <Cast className="w-3.5 h-3.5" />
                <span>Live Stream</span>
              </button>
            )}
          </div>
        }
      />

      {/* Spacer to push content below the fixed minimal nav — pageTopRef anchor for scroll-to-top */}
      <div ref={pageTopRef} style={{ height: 56 }} aria-hidden />

      {/* QR sub-toolbar removed — Join QR moved to tournament header title row; Project QR moved to post-round action buttons */}      {/* ── Sticky "All Results In" Banner ────────────────────────────────────────── */}
      {!isRegistration && allResultsIn && canGenerateNext && (
        <div
          className={`sticky top-[56px] z-30 border-b transition-all duration-300 ${        isDark
              ? "bg-[#1a3d22]/95 backdrop-blur-md border-[#4CAF50]/25"
              : "bg-[#f0f9f1]/95 backdrop-blur-md border-[#3D6B47]/20"
          }`}
          style={{ paddingTop: "env(safe-area-inset-top)" }}
        >
          <div className="max-w-5xl mx-auto px-4 sm:px-8 py-2.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${
                isDark ? "bg-[#4CAF50]/25" : "bg-[#3D6B47]/15"
              }`}>
                <CheckCircle2 className={`w-3.5 h-3.5 ${
                  isDark ? "text-[#4CAF50]" : "text-[#3D6B47]"
                }`} />
              </span>
              <p className={`text-sm font-semibold truncate ${
                isDark ? "text-[#4CAF50]" : "text-[#3D6B47]"
              }`}>
                All {totalGames} result{totalGames !== 1 ? "s" : ""} in &mdash; Round {state.currentRound} complete
              </p>
            </div>
            <button
              onClick={() => {
                const nextRound = state.currentRound + 1;
                generateNextRound();
                toast.success(`Round ${nextRound} pairings generated!`);
                broadcastRoundStart(nextRound);
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
                      }).catch(() => {});
                    }
                  } catch { /* ignore */ }
                }, 150);
              }}
              className={`group flex-shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                isDark
                  ? "bg-[#4CAF50] text-white hover:bg-[#3d9e42] shadow-[0_2px_10px_rgba(76,175,80,0.35)]"
                  : "bg-[#3D6B47] text-white hover:bg-[#2d5235] shadow-[0_2px_10px_rgba(61,107,71,0.25)]"
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              Generate Round {state.currentRound + 1}
              <ArrowRight className="w-3.5 h-3.5 transition-transform duration-200 ease-out group-hover:translate-x-0.5" />
            </button>
          </div>
        </div>
      )}
      {/* ── Body ───────────────────────────────────────────────────────────────────────── */}
      {/* Swipe flash overlay — brief edge glow on gesture recognition (mobile only) */}
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
      <div
        ref={swipeContainerRef}
        className="max-w-5xl mx-auto px-4 sm:px-8 py-6 sm:py-8 pt-4 sm:pt-6 animate-page-in"
      >
        <div className="flex gap-6 items-start">

          {/* ── Left Rail: Vertical Round Tracker (hidden on mobile, visible md+) ── */}
          {!isRegistration && (
            <div
              className="hidden md:flex flex-col items-center sticky top-[200px] self-start"
              style={{ minWidth: 64 }}
            >
              <VerticalRoundTracker
                rounds={state.rounds}
                currentRound={state.currentRound}
                totalRounds={state.totalRounds}
                isDark={isDark}
              />
            </div>
          )}

          {/* ── Main Panel ──────────────────────────────────────────────────────── */}
          <main className="flex-1 min-w-0 space-y-5">

            {/* ── Round Timer — mobile: above title; desktop: between title and tabs ── */}
            {!isRegistration && (
              <div className="md:hidden">
                <RoundTimer
                  isDark={isDark}
                  defaultMinutes={state.roundMinutes ?? 25}
                  tournamentId={state.tournamentId}
                  onDurationChange={(mins) => updateSettings({ roundMinutes: mins })}
                />
              </div>
            )}

                {/* ── Page Title + Tab Bar ───────────────────────────────── */}
          <div className="space-y-3">
            {/* Round title row */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1
                    className={`text-2xl font-black tracking-tight ${isDark ? "text-white" : "text-gray-900"}`}
                    style={{ fontFamily: "'Clash Display', sans-serif" }}
                  >
                    {state.tournamentName}
                  </h1>
                  {state.status === "paused" && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-500 border border-amber-500/25">
                      Paused
                    </span>
                  )}
                </div>
                {/* Command Center — operational status strip */}
                <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                  {/* Format + Time */}
                  <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md ${
                    isDark ? "bg-white/06 text-white/50" : "bg-gray-100 text-gray-500"
                  }`}>
                    <Trophy className="w-3 h-3" />
                    {state.format === "doubleswiss" ? "Double Swiss" : "Swiss"}
                    {tournamentConfig?.timePreset ? ` · ${tournamentConfig.timePreset}` : ""}
                  </span>
                  {/* Round indicator */}
                  {!isRegistration && (
                    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md ${
                      isDark ? "bg-[#3D6B47]/25 text-[#6FCF7F]" : "bg-[#3D6B47]/10 text-[#3D6B47]"
                    }`}>
                      <Circle className="w-2.5 h-2.5 fill-current" />
                      Round {state.currentRound} / {state.totalRounds}
                    </span>
                  )}
                  {/* Round timeline dots */}
                  {!isRegistration && state.totalRounds > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5">
                      {Array.from({ length: state.totalRounds }, (_, i) => i + 1).map((rn) => {
                        const isCompleted = rn < state.currentRound;
                        const isCurrent = rn === state.currentRound;
                        const isUpcoming = rn > state.currentRound;
                        return (
                          <span
                            key={rn}
                            title={`Round ${rn}${isCompleted ? " (complete)" : isCurrent ? " (current)" : " (upcoming)"}`}
                            className={`w-2 h-2 rounded-full transition-all duration-300 ${
                              isCompleted
                                ? isDark ? "bg-[#4CAF50]" : "bg-[#3D6B47]"
                                : isCurrent
                                ? allResultsIn
                                  ? isDark ? "bg-[#4CAF50] ring-2 ring-[#4CAF50]/30" : "bg-[#3D6B47] ring-2 ring-[#3D6B47]/25"
                                  : "bg-amber-400 ring-2 ring-amber-400/30 animate-pulse"
                                : isDark ? "bg-white/12" : "bg-gray-200"
                            }`}
                          />
                        );
                      })}
                    </span>
                  )}
                  {/* Players */}
                  <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md ${
                    isDark ? "bg-white/06 text-white/50" : "bg-gray-100 text-gray-500"
                  }`}>
                    <Users className="w-3 h-3" />
                    {state.players.length}
                  </span>
                  {/* Results progress — only during active round */}
                  {!isRegistration && totalGames > 0 && (
                    <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md ${
                      allResultsIn
                        ? isDark ? "bg-[#4CAF50]/15 text-[#4CAF50]" : "bg-green-50 text-green-700"
                        : isDark ? "bg-amber-500/10 text-amber-400" : "bg-amber-50 text-amber-600"
                    }`}>
                      <CheckCircle2 className="w-3 h-3" />
                      {completedGames}/{totalGames}
                    </span>
                  )}
                  {/* Public mode indicator */}
                  {!isRegistration && tournamentId !== "otb-demo-2026" && (
                    <PublicModeChip tournamentId={tournamentId} isDark={isDark} />
                  )}
                </div>
              </div>

            </div>

            {/* Round Timer — desktop: between title and tabs (hidden on mobile, shown above title instead) */}
            {!isRegistration && (
              <div className="hidden md:block">
                <RoundTimer
                  isDark={isDark}
                  defaultMinutes={state.roundMinutes ?? 25}
                  tournamentId={state.tournamentId}
                  onDurationChange={(mins) => updateSettings({ roundMinutes: mins })}
                />
              </div>
            )}

            {/* Unified tab bar */}
            <div
              className={`flex rounded-2xl p-1 w-full overflow-x-auto scrollbar-none ${
                isDark ? "bg-white/06 border border-white/06" : "bg-gray-100/80 border border-gray-200/60"
              }`}
            >
              {([
                { id: "home", label: "Home" },
                { id: "players", label: "Players" },
                { id: "standings", label: "Standings" },
                ...(isElimFormat ? [{ id: "bracket" as const, label: "Bracket" }] : []),
                { id: "settings", label: "Settings" },
              ] as { id: TabId; label: string }[]).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`touch-target flex-1 min-w-[4.5rem] px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 active:scale-95 flex items-center justify-center gap-1.5 whitespace-nowrap ${
                    activeTab === tab.id
                      ? isDark
                        ? "bg-[oklch(0.32_0.09_145)] text-white shadow-[0_1px_4px_rgba(0,0,0,0.3)]"
                        : "bg-white text-gray-900 shadow-[0_1px_3px_rgba(0,0,0,0.10)]"
                      : isDark
                      ? "text-white/45 hover:text-white/70 hover:bg-white/04"
                      : "text-gray-500 hover:text-gray-700 hover:bg-white/60"
                  }`}
                >
                  {tab.label}
                  {tab.id === "players" && state.players.length > 0 && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none ${
                      activeTab === "players"
                        ? isDark ? "bg-white/20 text-white" : "bg-[#3D6B47]/10 text-[#3D6B47]"
                        : isDark ? "bg-white/08 text-white/50" : "bg-gray-200 text-gray-500"
                    }`}>
                      {state.players.length}
                    </span>
                  )}
                  {tab.id === "bracket" && state.elimPhase === "elimination" && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none ${
                      activeTab === "bracket"
                        ? isDark ? "bg-white/20 text-white" : "bg-[#3D6B47]/10 text-[#3D6B47]"
                        : isDark ? "bg-amber-400/20 text-amber-400" : "bg-amber-50 text-amber-600"
                    }`}>
                      Live
                    </span>
                  )}
                  {tab.id === "bracket" && state.elimPhase === "cutoff" && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none ${
                      isDark ? "bg-amber-400/20 text-amber-400" : "bg-amber-50 text-amber-600"
                    }`}>
                      !
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
                    <div className={`flex items-center justify-between px-4 sm:px-6 py-4 border-b ${
                      isDark ? "border-white/06" : "border-gray-100"
                    }`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-2.5 h-2.5 rounded-full ${
                          isDark ? "bg-[#4CAF50]/60" : "bg-[#3D6B47]/50"
                        } animate-pulse`} />
                        <span className={`text-sm font-bold ${isDark ? "text-white" : "text-gray-900"}`}
                          style={{ fontFamily: "'Clash Display', sans-serif" }}>
                          Check-In Roster
                        </span>
                      </div>
                      {/* Check-in count badge */}
                      <div className="flex items-center gap-2">
                        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                          checkedInIds.size === state.players.length && state.players.length > 0
                            ? isDark ? "bg-[#4CAF50]/15 text-[#4CAF50]" : "bg-green-50 text-green-700"
                            : isDark ? "bg-white/08 text-white/70" : "bg-gray-100 text-gray-600"
                        }`}>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{checkedInIds.size} / {state.players.length} checked in</span>
                        </div>
                      </div>
                    </div>

                    {/* Join link + QR row */}
                    <div className={`px-4 sm:px-6 py-4 border-b ${isDark ? "border-white/06" : "border-gray-100"}`}>
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
                      </div>
                    </div>

                    {/* Inline search bar */}
                    {state.players.length > 4 && (
                      <div className={`px-4 sm:px-6 pt-3 pb-1`}>
                        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${
                          isDark ? "bg-white/04 border-white/08" : "bg-gray-50 border-gray-200"
                        }`}>
                          <Search className={`w-3.5 h-3.5 flex-shrink-0 ${isDark ? "text-white/30" : "text-gray-400"}`} />
                          <input
                            type="text"
                            value={rosterSearch}
                            onChange={(e) => setRosterSearch(e.target.value)}
                            placeholder="Search by name or username..."
                            className={`flex-1 bg-transparent text-sm outline-none placeholder:text-current/40 ${
                              isDark ? "text-white/80 placeholder:text-white/25" : "text-gray-800 placeholder:text-gray-400"
                            }`}
                          />
                          {rosterSearch && (
                            <button onClick={() => setRosterSearch("")} className={`p-0.5 rounded ${isDark ? "hover:bg-white/10 text-white/40" : "hover:bg-gray-200 text-gray-400"}`}>
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Player roster with check-in chips */}
                    <div className="px-4 sm:px-6 py-3">
                      {state.players.length === 0 ? (
                        <div className={`flex flex-col items-center justify-center py-10 gap-3 ${
                          isDark ? "text-white/20" : "text-gray-300"
                        }`}>
                          <Users className="w-8 h-8" />
                          <p className="text-sm">No players yet — share the QR code or join link</p>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {state.players
                            .filter((p) => {
                              if (!rosterSearch) return true;
                              const q = rosterSearch.toLowerCase();
                              return p.name.toLowerCase().includes(q) || p.username.toLowerCase().includes(q);
                            })
                            .map((p, idx) => {
                              const isCheckedIn = checkedInIds.has(p.id);
                              return (
                                <div
                                  key={p.id}
                                  className={`flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all group cursor-pointer ${
                                    isCheckedIn
                                      ? isDark ? "bg-[#3D6B47]/08 hover:bg-[#3D6B47]/15" : "bg-green-50/60 hover:bg-green-50"
                                      : isDark ? "hover:bg-white/04" : "hover:bg-gray-50"
                                  }`}
                                  onClick={() => toggleCheckIn(p.id)}
                                >
                                  {/* Check-in indicator */}
                                  <button
                                    className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 transition-all ${
                                      isCheckedIn
                                        ? "bg-[#3D6B47] text-white"
                                        : isDark ? "border border-white/15 hover:border-white/30" : "border border-gray-300 hover:border-gray-400"
                                    }`}
                                    onClick={(e) => { e.stopPropagation(); toggleCheckIn(p.id); }}
                                  >
                                    {isCheckedIn && <CheckCircle2 className="w-3.5 h-3.5" />}
                                  </button>
                                  {/* Rank number */}
                                  <span className={`text-xs font-mono w-4 flex-shrink-0 text-right ${
                                    isDark ? "text-white/25" : "text-gray-300"
                                  }`}>{idx + 1}</span>
                                  {/* Avatar */}
                                  <PlayerAvatar
                                    username={p.username}
                                    name={p.name}
                                    size={30}
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
                                  {/* Status chip */}
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                                    isCheckedIn
                                      ? isDark ? "bg-[#4CAF50]/15 text-[#4CAF50]" : "bg-green-100 text-green-700"
                                      : isDark ? "bg-white/06 text-white/35" : "bg-gray-100 text-gray-400"
                                  }`}>
                                    {isCheckedIn ? "Checked In" : "Registered"}
                                  </span>
                                  {/* ELO */}
                                  {(p.rapidElo || p.blitzElo) ? (
                                    <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                                      {p.rapidElo ? (
                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                          (tournamentConfig?.ratingType ?? "rapid") === "rapid"
                                            ? isDark ? "bg-[#3D6B47]/25 text-[#6FCF7F]" : "bg-[#3D6B47]/10 text-[#3D6B47]"
                                            : isDark ? "bg-white/06 text-white/40" : "bg-gray-100 text-gray-400"
                                        }`}>⚡{p.rapidElo}</span>
                                      ) : null}
                                      {p.blitzElo ? (
                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                          (tournamentConfig?.ratingType ?? "rapid") === "blitz"
                                            ? isDark ? "bg-[#3D6B47]/25 text-[#6FCF7F]" : "bg-[#3D6B47]/10 text-[#3D6B47]"
                                            : isDark ? "bg-white/06 text-white/40" : "bg-gray-100 text-gray-400"
                                        }`}>🔥{p.blitzElo}</span>
                                      ) : null}
                                    </div>
                                  ) : p.elo != null ? (
                                    <span className={`text-xs font-bold flex-shrink-0 px-2 py-0.5 rounded-lg ${
                                      isDark ? "bg-white/06 text-white/60" : "bg-gray-100 text-gray-500"
                                    }`}>{p.elo}</span>
                                  ) : null}
                                  {/* Edit player button */}
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setEditingPlayer(p); }}
                                    className={`flex-shrink-0 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all ${
                                      isDark ? "hover:bg-white/08 text-white/40" : "hover:bg-gray-100 text-gray-400"
                                    }`}
                                    title="Edit player name / ELO"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  {/* Remove button */}
                                  <button
                                    onClick={(e) => { e.stopPropagation(); removePlayer(p.id); toast.success(`${p.name} removed`); }}
                                    className={`flex-shrink-0 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all ${
                                      isDark ? "hover:bg-red-500/15 text-red-400" : "hover:bg-red-50 text-red-400"
                                    }`}
                                    title="Remove player"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              );
                            })}
                        </div>
                      )}
                    </div>

                    {/* Walk-in quick-add + Actions footer */}
                    <div className={`px-4 sm:px-6 py-4 border-t space-y-3 ${
                      isDark ? "border-white/06" : "border-gray-100"
                    }`}>
                      {/* Walk-in quick-add form */}
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={walkInName}
                          onChange={(e) => setWalkInName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && walkInName.trim()) {
                              const name = walkInName.trim();
                              const newPlayer = {
                                id: `walkin-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                                name,
                                username: name.toLowerCase().replace(/\s+/g, ""),
                                elo: 800,
                                country: "",
                                title: undefined,
                                points: 0,
                                wins: 0,
                                draws: 0,
                                losses: 0,
                                buchholz: 0,
                                colorHistory: [],
                                platform: "chesscom" as const,
                              };
                              addPlayer(newPlayer);
                              toggleCheckIn(newPlayer.id);
                              toast.success(`Walk-in: ${name} added & checked in`);
                              setWalkInName("");
                            }
                          }}
                          placeholder="Walk-in name (press Enter)"
                          className={`flex-1 px-3 py-2.5 rounded-xl border text-sm outline-none transition-colors ${
                            isDark
                              ? "bg-white/04 border-white/08 text-white placeholder:text-white/25 focus:border-[#4CAF50]/40"
                              : "bg-gray-50 border-gray-200 text-gray-800 placeholder:text-gray-400 focus:border-[#3D6B47]/40"
                          }`}
                        />
                        <button
                          onClick={() => {
                            if (!walkInName.trim()) return;
                            const name = walkInName.trim();
                            const newPlayer = {
                              id: `walkin-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                              name,
                              username: name.toLowerCase().replace(/\s+/g, ""),
                              elo: 800,
                              country: "",
                              title: undefined,
                              points: 0,
                              wins: 0,
                              draws: 0,
                              losses: 0,
                              buchholz: 0,
                              colorHistory: [],
                              platform: "chesscom" as const,
                            };
                            addPlayer(newPlayer);
                            toggleCheckIn(newPlayer.id);
                            toast.success(`Walk-in: ${name} added & checked in`);
                            setWalkInName("");
                          }}
                          disabled={!walkInName.trim()}
                          className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                            walkInName.trim()
                              ? isDark ? "bg-[#3D6B47]/30 text-[#4CAF50] hover:bg-[#3D6B47]/50" : "bg-[#3D6B47]/10 text-[#3D6B47] hover:bg-[#3D6B47]/20"
                              : isDark ? "bg-white/04 text-white/20" : "bg-gray-100 text-gray-300"
                          }`}
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          Walk-in
                        </button>
                      </div>
                      {/* Action buttons */}
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
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
                  </div>
                </>
              )}
              {/* ══════════════════════════════════════════════════════════════════
                  ACTIVE PHASE — Compact header + pairings
              ══════════════════════════════════════════════════════════════════ */}
              {!isRegistration && (
                <>
                  {/* ── Round Pairings standalone header row ───────────────────────── */}
                  <div>
                    <div className="flex items-center justify-between py-1">
                      <h3
                        className={`text-sm font-black tracking-tight ${isDark ? "text-white" : "text-gray-900"}`}
                        style={{ fontFamily: "'Clash Display', sans-serif" }}
                      >
                        Round {state.currentRound} Pairings
                      </h3>
                      <div className="flex items-center gap-2">
                        {/* Boards complete count */}
                        <span className={`text-[11px] font-bold tabular-nums ${
                          allResultsIn
                            ? isDark ? "text-[#4CAF50]" : "text-green-700"
                            : isDark ? "text-white/40" : "text-gray-400"
                        }`}>
                          {isDoubleSwiss && totalBoards !== null
                            ? `${completedBoards} / ${totalBoards} boards`
                            : `${completedGames} / ${totalGames}`}
                        </span>
                        <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full border ${
                          allResultsIn
                            ? isDark
                              ? "bg-[#4CAF50]/12 border-[#4CAF50]/25 text-[#4CAF50]"
                              : "bg-green-50 border-green-200 text-green-700"
                            : isDark
                            ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
                            : "bg-amber-50 border-amber-200 text-amber-600"
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                            allResultsIn ? (isDark ? "bg-[#4CAF50]" : "bg-green-500") : "bg-amber-400 animate-pulse"
                          }`} />
                          {allResultsIn ? "Complete" : "In Progress"}
                        </span>
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className={`h-0.5 w-full rounded-full mt-2 ${
                      isDark ? "bg-white/06" : "bg-gray-100"
                    }`}>
                      <div
                        className={`h-full transition-all duration-500 ease-out rounded-full ${
                          allResultsIn
                            ? isDark ? "bg-[#4CAF50]" : "bg-green-500"
                            : isDark ? "bg-amber-400" : "bg-amber-400"
                        }`}
                        style={{
                          width: totalGames > 0 ? `${(completedGames / totalGames) * 100}%` : "0%",
                        }}
                      />
                    </div>
                  </div>


                  {/* ══════════════════════════════════════════════════════════════════
                      BOARD CARDS — Result entry (merged from Boards tab)
                  ══════════════════════════════════════════════════════════════════ */}

                  {/* Generate Next Round CTA */}
                  {allResultsIn && canGenerateNext && (
                    <div
                      ref={generateCtaRef}
                      className={`rounded-xl border overflow-hidden ${
                        isDark
                          ? "bg-[#3D6B47]/15 border-[#4CAF50]/30"
                          : "bg-[#3D6B47]/06 border-[#3D6B47]/20"
                      }`}
                    >
                      <div className={`flex items-center gap-3 px-4 py-3 border-b ${
                        isDark ? "border-[#4CAF50]/15" : "border-[#3D6B47]/10"
                      }`}>
                        <CheckCircle2 className={`w-4 h-4 flex-shrink-0 ${
                          isDark ? "text-[#4CAF50]" : "text-[#3D6B47]"
                        }`} />
                        <p className={`text-sm font-medium ${
                          isDark ? "text-[#4CAF50]" : "text-[#3D6B47]"
                        }`}>
                          {isDoubleSwiss && totalBoards !== null
                            ? `All ${totalBoards} board${totalBoards !== 1 ? "s" : ""} complete (both games per board) — ready for Round ${state.currentRound + 1}`
                            : `All ${totalGames} result${totalGames !== 1 ? "s" : ""} for Round ${state.currentRound} recorded — ready for Round ${state.currentRound + 1}`}
                        </p>
                      </div>
                      <div className="px-4 py-3">
                        {!showNextRoundConfirm ? (
                          <button
                            onClick={() => setShowNextRoundConfirm(true)}
                            className="group w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
                            style={{ background: "#3D6B47", boxShadow: "0 4px 16px rgba(61,107,71,0.35)" }}
                          >
                            <Zap className="w-4 h-4" />
                            Generate Round {state.currentRound + 1} — {state.format === "doubleswiss" ? "Double Swiss" : "Swiss"} Pairings
                            <ArrowRight className="w-4 h-4 transition-transform duration-200 ease-out group-hover:translate-x-1" />
                          </button>
                        ) : (
                          <div className={`flex flex-col gap-2 p-3 rounded-xl border ${
                            isDark ? "bg-amber-500/06 border-amber-500/20" : "bg-amber-50 border-amber-200"
                          }`}>
                            <p className={`text-xs font-semibold text-center ${
                              isDark ? "text-amber-300" : "text-amber-700"
                            }`}>
                              Generate Round {state.currentRound + 1} pairings? This cannot be undone.
                            </p>
                            <div className="flex gap-2">
                              <button
                                onClick={() => setShowNextRoundConfirm(false)}
                                className={`flex-1 py-2.5 rounded-lg text-xs font-semibold transition-all active:scale-95 ${
                                  isDark ? "bg-white/08 text-white/60 hover:bg-white/12" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                }`}
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => {
                                  setShowNextRoundConfirm(false);
                                  const nextRound = state.currentRound + 1;
                                  generateNextRound();
                                  toast.success(`Round ${nextRound} pairings generated!`);
                                  broadcastRoundStart(nextRound);
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
                                        }).catch(() => {});
                                      }
                                    } catch { /* ignore */ }
                                  }, 150);
                                }}
                                className="flex-1 py-2.5 rounded-lg text-xs font-bold text-white transition-all active:scale-95"
                                style={{ background: "#3D6B47" }}
                              >
                                Confirm — Generate Round {state.currentRound + 1}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Tournament complete celebration banner */}
                  {allResultsIn && !canGenerateNext && state.currentRound >= state.totalRounds && (() => {
                    const finalStandings = getStandings(state.players);
                    // Podium config: rank index, medal colours, score size
                    const podiumConfig = [
                      { rank: 1, idx: 0, medalDark: "bg-amber-400/15 text-amber-300",   medalLight: "bg-amber-50 text-amber-500 border border-amber-200",   scoreSize: "text-3xl" },
                      { rank: 2, idx: 1, medalDark: "bg-slate-400/15 text-slate-300",   medalLight: "bg-slate-50 text-slate-500 border border-slate-200",   scoreSize: "text-2xl" },
                      { rank: 3, idx: 2, medalDark: "bg-orange-400/15 text-orange-300", medalLight: "bg-orange-50 text-orange-500 border border-orange-200", scoreSize: "text-2xl" },
                    ];
                    return (
                      <div ref={tournamentCompleteRef} className={`rounded-2xl border overflow-hidden animate-in fade-in slide-in-from-bottom-2 ${
                        isDark
                          ? "bg-[#3D6B47]/18 border-[#4CAF50]/35"
                          : "bg-gradient-to-br from-[#3D6B47]/08 to-[#3D6B47]/04 border-[#3D6B47]/25 shadow-sm"
                      }`} style={{ animationDuration: "500ms", animationFillMode: "both" }}>
                        {/* Header strip */}
                        <div className={`flex items-center justify-between px-5 py-3 border-b ${
                          isDark ? "border-[#4CAF50]/15" : "border-[#3D6B47]/12"
                        }`}>
                          <div className="flex items-center gap-2">
                            <Trophy className={`w-4 h-4 ${ isDark ? "text-[#4CAF50]" : "text-[#3D6B47]"}`} />
                            <span className={`text-sm font-black tracking-tight ${ isDark ? "text-[#4CAF50]" : "text-[#3D6B47]"}`}
                              style={{ fontFamily: "'Clash Display', sans-serif" }}>
                              Tournament Complete
                            </span>
                          </div>
                          <span className={`text-[11px] font-semibold ${ isDark ? "text-white/40" : "text-gray-400"}`}>
                            {state.totalRounds} round{state.totalRounds !== 1 ? "s" : ""} · {state.players.length} players
                          </span>
                        </div>

                        {/* Podium — top 3 finishers */}
                        <div className={`divide-y ${ isDark ? "divide-white/06" : "divide-[#3D6B47]/08"}`}>
                          {podiumConfig.map(({ rank, idx, medalDark, medalLight, scoreSize }) => {
                            const standing = finalStandings[idx];
                            if (!standing) return null;
                            const player = state.players.find(p => p.id === standing.id);
                            if (!player) return null;
                            const pts = standing.points % 1 !== 0
                              ? `${Math.floor(standing.points)}½`
                              : String(standing.points);
                            const isFirst = rank === 1;
                            return (
                              <div
                                key={rank}
                                className={`flex items-center gap-4 px-5 ${ isFirst ? "py-4" : "py-3"}`}
                                style={{ animationDelay: `${idx * 80}ms`, animationFillMode: "both" }}
                              >
                                {/* Medal badge */}
                                <div className={`${ isFirst ? "w-12 h-12 text-xl" : "w-9 h-9 text-base"} rounded-xl flex items-center justify-center flex-shrink-0 font-black ${
                                  isDark ? medalDark : medalLight
                                }`} style={{ fontFamily: "'Clash Display', sans-serif" }}>{rank}</div>

                                {/* Avatar */}
                                <PlayerAvatar
                                  name={player.name}
                                  username={player.username}
                                  size={isFirst ? 44 : 36}
                                  platform={player.platform === "lichess" ? "lichess" : "chesscom"}
                                  avatarUrl={player.avatarUrl}
                                />

                                {/* Name + meta */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className={`${ isFirst ? "text-base" : "text-sm"} font-black truncate ${ isDark ? "text-white" : "text-gray-900"}`}
                                      style={{ fontFamily: "'Clash Display', sans-serif" }}>
                                      {player.name}
                                    </span>
                                    {player.title && (
                                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                                        player.title === "GM"
                                          ? isDark ? "bg-amber-400/15 border-amber-400/30 text-amber-300" : "bg-amber-50 border-amber-200 text-amber-700"
                                          : isDark ? "bg-violet-400/15 border-violet-400/30 text-violet-300" : "bg-violet-50 border-violet-200 text-violet-700"
                                      }`}>{player.title}</span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                    {/* Show both Rapid and Blitz if available, otherwise just elo */}
                                    {(player.rapidElo || player.blitzElo) ? (
                                      <>
                                        {player.rapidElo ? (
                                          <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-md ${
                                            (tournamentConfig?.ratingType ?? "rapid") === "rapid"
                                              ? isDark ? "bg-[#3D6B47]/25 text-[#6FCF7F]" : "bg-[#3D6B47]/10 text-[#3D6B47]"
                                              : isDark ? "bg-white/06 text-white/40" : "bg-gray-100 text-gray-400"
                                          }`}>⚡ {player.rapidElo}</span>
                                        ) : null}
                                        {player.blitzElo ? (
                                          <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-md ${
                                            (tournamentConfig?.ratingType ?? "rapid") === "blitz"
                                              ? isDark ? "bg-[#3D6B47]/25 text-[#6FCF7F]" : "bg-[#3D6B47]/10 text-[#3D6B47]"
                                              : isDark ? "bg-white/06 text-white/40" : "bg-gray-100 text-gray-400"
                                          }`}>🔥 {player.blitzElo}</span>
                                        ) : null}
                                      </>
                                    ) : player.elo != null ? (
                                      <span className={`text-xs font-semibold ${ isDark ? "text-white/45" : "text-gray-400"}`}>
                                        {player.elo} ELO
                                      </span>
                                    ) : null}
                                    <span className={`text-xs font-semibold ${ isDark ? "text-white/45" : "text-gray-400"}`}>
                                      {standing.wins}W {standing.draws}D {standing.losses}L
                                    </span>
                                    {standing.buchholz > 0 && (
                                      <span className={`text-xs font-semibold ${ isDark ? "text-white/30" : "text-gray-300"}`}>
                                        · Buch. {standing.buchholz.toFixed(1)}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Edit player button (in-progress) */}
                                <button
                                  onClick={(e) => { e.stopPropagation(); setEditingPlayer(player); }}
                                  className={`flex-shrink-0 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all ${
                                    isDark ? "hover:bg-white/08 text-white/40" : "hover:bg-gray-100 text-gray-400"
                                  }`}
                                  title="Edit player name / ELO"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                {/* Score */}
                                <div className="flex-shrink-0 text-right">
                                  <span className={`${scoreSize} font-black tabular-nums ${ isDark ? "text-[#4CAF50]" : "text-[#3D6B47]"}`}
                                    style={{ fontFamily: "'Clash Display', sans-serif" }}>
                                    {pts}
                                  </span>
                                  <p className={`text-[11px] font-semibold ${ isDark ? "text-white/35" : "text-gray-400"}`}>pts</p>
                                </div>
                              </div>
                             );
                          })}
                        </div>
                        {/* Action buttons */}
                        <div className={`flex flex-wrap gap-2 px-5 pb-4 pt-3 border-t ${ isDark ? "border-white/06" : "border-[#3D6B47]/08"}`}>
                          <button
                            onClick={() => window.location.href = `/tournament/${tournamentId}`}
                            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95 ${
                              isDark ? "bg-[#4CAF50]/20 text-[#4CAF50] hover:bg-[#4CAF50]/30" : "bg-[#3D6B47] text-white hover:bg-[#2d5235]"
                            }`}>
                            <BarChart3 className="w-4 h-4" /> View Results
                          </button>
                          <button
                            onClick={() => window.location.href = `/tournament/${tournamentId}/report`}
                            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95 ${
                              isDark ? "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30" : "bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100"
                            }`}>
                            <Trophy className="w-4 h-4" /> Player Reports
                          </button>
                          <button
                            onClick={() => window.location.href = `/tournament/${tournamentId}/print`}
                            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95 ${
                              isDark ? "bg-white/10 text-white/70 hover:bg-white/15" : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
                            }`}>
                            <Download className="w-4 h-4" /> Print / Export
                          </button>
                          {/* Instagram Carousel Recap */}
                          <button
                            onClick={() => setShowCarousel(true)}
                            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95 ${
                              isDark ? "bg-white/10 text-white/70 hover:bg-white/15" : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
                            }`}
                          >
                            <div className="w-4 h-4 rounded bg-gradient-to-br from-[#833AB4] via-[#FD1D1D] to-[#FCB045] flex items-center justify-center flex-shrink-0">
                              <svg viewBox="0 0 24 24" fill="white" className="w-2.5 h-2.5"><rect x="2" y="2" width="20" height="20" rx="5" ry="5" fill="none" stroke="white" strokeWidth="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="white" strokeWidth="2"/><circle cx="17.5" cy="6.5" r="1" fill="white"/></svg>
                            </div>
                            Create Recap
                          </button>
                          {/* Live Stream — project live standings on a screen */}
                          <button
                            onClick={() => setShowSpectatorQR(true)}
                            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95 ${
                              isDark ? "bg-white/10 text-white hover:bg-white/15" : "bg-[#3D6B47]/15 border border-[#3D6B47]/30 text-white hover:bg-[#3D6B47]/25"
                            }`}
                          >
                            <Cast className="w-4 h-4" />
                            Live Stream
                          </button>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Late Registration banner — Round 1 only */}
                  {state.currentRound === 1 && !allResultsIn && (
                    <div className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl border ${
                      isDark
                        ? "bg-amber-500/08 border-amber-500/25 text-amber-300"
                        : "bg-amber-50 border-amber-200 text-amber-700"
                    }`}>
                      <div className="flex items-center gap-2.5 min-w-0">
                        <UserPlus className="w-4 h-4 flex-shrink-0" />
                        <p className="text-sm font-medium">Late registration open — players added now will be paired or given a bye.</p>
                      </div>
                      <button
                        onClick={() => setShowAddPlayer(true)}
                        className={`flex-shrink-0 text-xs font-bold px-3 py-1.5 rounded-lg transition-all active:scale-95 ${
                          isDark
                            ? "bg-amber-500/20 hover:bg-amber-500/30 text-amber-300"
                            : "bg-amber-100 hover:bg-amber-200 text-amber-800"
                        }`}
                      >
                        + Add Player
                      </button>
                    </div>
                  )}
                  {/* Pending results hint */}
                  {!allResultsIn && (
                    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${
                      isDark
                        ? "bg-white/04 border-white/08 text-white/50"
                        : "bg-gray-50 border-gray-100 text-gray-500"
                    }`}>
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <p className="text-sm">Enter results for all boards to unlock next round pairing generation.</p>
                    </div>
                  )}                  {/* ── Board cards grid ────────────────────────────────────────────── */}
                  <div>
                    <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                      <h2 className={`text-xs font-bold uppercase tracking-widest ${
                        isDark ? "text-white/30" : "text-gray-400"
                      }`}>Round {state.currentRound} Boards</h2>
                      <div className="flex items-center gap-2">
                        {/* Board search filter */}
                        {currentRoundData && currentRoundData.games.length > 6 && (
                          <div className="relative">
                            <Search className={`absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none ${
                              isDark ? "text-white/25" : "text-gray-400"
                            }`} />
                            <input
                              type="text"
                              value={boardSearch}
                              onChange={(e) => setBoardSearch(e.target.value)}
                              placeholder="Filter boards..."
                              className={`pl-7 pr-3 py-1.5 rounded-lg text-xs border outline-none transition-colors w-36 ${
                                isDark
                                  ? "bg-white/04 border-white/08 text-white placeholder:text-white/25 focus:border-[#4CAF50]/40"
                                  : "bg-gray-50 border-gray-200 text-gray-800 placeholder:text-gray-400 focus:border-[#3D6B47]/40"
                              }`}
                            />
                          </div>
                        )}
                        {/* Jump to next unreported board */}
                        {currentRoundData && !allResultsIn && (() => {
                          const unreported = [...currentRoundData.games]
                            .sort((a, b) => a.board - b.board)
                            .find((g) => g.result === "*" && g.whiteId !== "BYE");
                          if (!unreported) return null;
                          return (
                            <button
                              onClick={() => {
                                const el = document.getElementById(`board-card-${unreported.id}`);
                                if (el) {
                                  el.scrollIntoView({ behavior: "smooth", block: "center" });
                                  el.classList.add("ring-2", isDark ? "ring-amber-400/60" : "ring-amber-500/50");
                                  setTimeout(() => el.classList.remove("ring-2", isDark ? "ring-amber-400/60" : "ring-amber-500/50"), 2000);
                                }
                              }}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all active:scale-95 ${
                                isDark
                                  ? "bg-amber-500/10 border-amber-500/25 text-amber-400 hover:bg-amber-500/20"
                                  : "bg-amber-50 border-amber-200 text-amber-600 hover:bg-amber-100"
                              }`}
                              title={`Jump to Board ${unreported.board}`}
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                              Board {unreported.board}
                            </button>
                          );
                        })()}
                        {/* Swap Pairings button — opens PairingSwapModal */}
                        {currentRoundData && !allResultsIn && (
                          <button
                            onClick={() => setSwapModalOpen(true)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all active:scale-95 ${
                              isDark
                                ? "bg-white/06 border-white/10 text-white/50 hover:bg-white/10 hover:text-white/80"
                                : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                            }`}
                            title="Swap player board assignments"
                          >
                            <ArrowLeftRight className="w-3 h-3" /> Swap Pairings
                          </button>
                        )}
                        {/* Edit Boards toggle — only for Swiss/RR formats (not Double Swiss) during active round */}
                        {state.format !== "doubleswiss" && currentRoundData && !allResultsIn && (
                          <button
                            onClick={() => {
                              setEditBoardsMode((prev) => !prev);
                              setSwapSourceId(null);
                            }}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all active:scale-95 ${
                              editBoardsMode
                                ? isDark
                                  ? "bg-[#4CAF50]/20 border-[#4CAF50]/50 text-[#4CAF50]"
                                  : "bg-[#3D6B47]/10 border-[#3D6B47]/40 text-[#3D6B47]"
                                : isDark
                                ? "bg-white/06 border-white/10 text-white/50 hover:bg-white/10 hover:text-white/80"
                                : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                            }`}
                            title={editBoardsMode ? "Exit board edit mode" : "Edit board assignments"}
                          >
                            {editBoardsMode ? (
                              <><ArrowLeftRight className="w-3 h-3" /> Done Editing</>
                            ) : (
                              <><Pencil className="w-3 h-3" /> Edit Boards</>
                            )}
                          </button>
                        )}
                      </div>
                    </div>                    {currentRoundData ? (
                      state.format === "doubleswiss" ? (
                        // Double Swiss: group games by board number, show Game A + Game B per card
                        (() => {
                          const boardNums = Array.from(new Set(currentRoundData.games.map((g) => g.board))).sort((a, b) => a - b);
                          return (
                            <div className="grid grid-cols-1 gap-4">
                              {boardNums.map((boardNum, cardIdx) => {
                                const boardGamesForNum = currentRoundData.games.filter((g) => g.board === boardNum);
                                const gA = boardGamesForNum.find((g) => (g.gameIndex ?? 0) === 0);
                                const gB = boardGamesForNum.find((g) => g.gameIndex === 1);
                                if (gA && (gA.whiteId === "BYE" || gA.blackId === "BYE")) {
                                  return (
                                    <div key={`board-${boardNum}`} className="animate-in fade-in slide-in-from-bottom-3" style={{ animationDuration: "350ms", animationDelay: `${cardIdx * 60}ms`, animationFillMode: "both" }}>
                                      <ByeCard game={gA} players={state.players} isDark={isDark} />
                                    </div>
                                  );
                                }
                                if (!gA || !gB) return null;
                                return (
                                  <div key={`board-${boardNum}`} className="animate-in fade-in slide-in-from-bottom-3" style={{ animationDuration: "350ms", animationDelay: `${cardIdx * 60}ms`, animationFillMode: "both" }}>
                                    <DoubleSwissBoardCard
                                      gameA={gA}
                                      gameB={gB}
                                      players={state.players}
                                      onResult={(gameId, newResult) => {
                                        const game = currentRoundData.games.find((g) => g.id === gameId)!;
                                        const prevResult = game.result;
                                        const white = state.players.find((p) => p.id === game.whiteId);
                                        const black = state.players.find((p) => p.id === game.blackId);
                                        const label = newResult === "*"
                                          ? `Board ${boardNum}: cleared`
                                          : `Board ${boardNum}: ${
                                              newResult === "1-0" ? `${white?.name ?? "White"} wins`
                                              : newResult === "0-1" ? `${black?.name ?? "Black"} wins`
                                              : "Draw"
                                            }`;
                                        recordWithUndo(gameId, newResult, prevResult, label);
                                        pushStandingsNow();
                                      }}
                                      isDark={isDark}
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()
                      ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {(() => {
                          const bsLower = boardSearch.toLowerCase().trim();
                          return [...currentRoundData.games].sort((a, b) => a.board - b.board)
                            .filter((g) => {
                              if (!bsLower) return true;
                              const w = state.players.find((p) => p.id === g.whiteId);
                              const b = state.players.find((p) => p.id === g.blackId);
                              return (
                                String(g.board).includes(bsLower) ||
                                (w?.name ?? "").toLowerCase().includes(bsLower) ||
                                (w?.username ?? "").toLowerCase().includes(bsLower) ||
                                (b?.name ?? "").toLowerCase().includes(bsLower) ||
                                (b?.username ?? "").toLowerCase().includes(bsLower)
                              );
                            })
                            .map((game, cardIdx) =>
                          game.whiteId === "BYE" ? (
                            <div
                              key={game.id}
                              id={`board-card-${game.id}`}
                              className="animate-in fade-in slide-in-from-bottom-3"
                              style={{ animationDuration: "350ms", animationDelay: `${cardIdx * 60}ms`, animationFillMode: "both" }}
                            >
                              <ByeCard
                                game={game}
                                players={state.players}
                                isDark={isDark}
                              />
                            </div>
                          ) : (
                            <div
                              key={game.id}
                              id={`board-card-${game.id}`}
                              className={`animate-in fade-in slide-in-from-bottom-3 rounded-2xl transition-shadow ${
                                game.result === "*" && !editBoardsMode
                                  ? isDark ? "ring-1 ring-amber-400/15" : "ring-1 ring-amber-500/10"
                                  : ""
                              }`}
                              style={{ animationDuration: "350ms", animationDelay: `${cardIdx * 60}ms`, animationFillMode: "both" }}
                            >
                              <BoardCard
                                game={game}
                                players={state.players}
                                editMode={editBoardsMode}
                                isSwapSource={swapSourceId === game.id}
                                onSwapRequest={(clickedId) => {
                                  if (!swapSourceId) {
                                    // First tap: select this board as source
                                    setSwapSourceId(clickedId);
                                  } else if (swapSourceId === clickedId) {
                                    // Tap same board: deselect
                                    setSwapSourceId(null);
                                  } else {
                                    // Second tap: perform the swap
                                    swapBoards(swapSourceId, clickedId);
                                    setSwapSourceId(null);
                                    const boardA = currentRoundData?.games.find((g) => g.id === swapSourceId)?.board;
                                    const boardB = currentRoundData?.games.find((g) => g.id === clickedId)?.board;
                                    toast.success(`Board ${boardA} ⇄ Board ${boardB} swapped`);
                                  }
                                }}
                                onUndo={!editBoardsMode && undoPending ? () => { undoResult(); pushStandingsNow(); } : undefined}
                                onResult={(gameId, newResult) => {
                                  if (editBoardsMode) return; // block result entry in edit mode
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
                                  pushStandingsNow();
                                }}
                                isDark={isDark}
                              />
                            </div>
                          )
                        );
                        })()}
                      </div>
                      )
                    ) : (
                      <div className={`flex flex-col items-center justify-center py-16 rounded-xl border ${
                        isDark ? "border-white/08 text-white/30" : "border-gray-100 text-gray-300"
                      }`}>
                        <Circle className="w-10 h-10 mb-3" />
                        <p className="text-sm font-medium">No round data yet</p>
                      </div>
                    )}
                  </div>

                  {/* ── Completed rounds accordion ───────────────────────────────── */}
                  {state.rounds.filter((r) => r.number < state.currentRound).length > 0 && (
                    <div>
                      <h2 className={`text-[10px] font-black uppercase tracking-[0.12em] mb-3 ${isDark ? "text-white/25" : "text-gray-400"}`}>
                        Completed Rounds
                      </h2>
                      <div className="space-y-2">
                        {state.rounds
                          .filter((r) => r.number < state.currentRound)
                          .reverse()
                          .map((round) => (
                            <div
                              key={round.number}
                              className={`rounded-2xl border px-4 py-3 ${
                                isDark ? "bg-[oklch(0.22_0.06_145)] border-white/08" : "bg-white border-gray-200/60 shadow-sm"
                              }`}
                            >
                              <div className="flex items-center justify-between mb-2.5">
                                <span className={`text-[11px] font-black uppercase tracking-widest ${
                                  isDark ? "text-white/40" : "text-gray-500"
                                }`}>
                                  Round {round.number}
                                </span>
                                <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  isDark ? "bg-[#4CAF50]/10 text-[#4CAF50]" : "bg-green-50 text-green-700"
                                }`}>
                                  <CheckCircle2 className="w-3 h-3" /> Complete
                                </span>
                              </div>
                              <div className="space-y-1.5">
                                {round.games.map((g) => {
                                  const w = state.players.find((p) => p.id === g.whiteId);
                                  const b = state.players.find((p) => p.id === g.blackId);
                                  return (
                                    <div key={g.id} className={`flex items-center gap-2 min-w-0 px-2 py-1.5 rounded-lg ${
                                      isDark ? "bg-white/03" : "bg-gray-50/60"
                                    }`}>
                                      <span className={`flex-1 truncate text-xs font-semibold ${isDark ? "text-white/65" : "text-gray-700"}`}>
                                        {w?.name.split(" ")[0]}
                                      </span>
                                      <span className={`flex-shrink-0 font-bold px-2 py-0.5 rounded-md text-[10px] ${resultBadgeClass(g.result, isDark)}`}>
                                        {g.result}
                                      </span>
                                      <span className={`flex-1 truncate text-xs font-semibold text-right ${isDark ? "text-white/65" : "text-gray-700"}`}>
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
            </div>
          )}
          {/* ── Standings Tab ───────────────────────────────────────────────────── */}
          {activeTab === "standings" && (() => {
            // Use liveStandings (StandingRow[]) for full tiebreak + matchW/D/L data
            const standingsData = liveStandings;
            const isDoubleSwiss = state.format === "doubleswiss";
            const podiumOrder = [standingsData[1], standingsData[0], standingsData[2]].filter(Boolean);
            const podiumConfig = [
              { rank: 2, height: "h-20", labelColor: isDark ? "text-gray-300" : "text-gray-500", borderColor: isDark ? "border-gray-400/40" : "border-gray-300", bgColor: isDark ? "bg-gray-400/08" : "bg-gray-50", numColor: isDark ? "text-gray-300" : "text-gray-500" },
              { rank: 1, height: "h-28", labelColor: isDark ? "text-amber-400" : "text-amber-600", borderColor: isDark ? "border-amber-500/50" : "border-amber-300", bgColor: isDark ? "bg-amber-500/10" : "bg-amber-50", numColor: isDark ? "text-amber-400" : "text-amber-600" },
              { rank: 3, height: "h-16", labelColor: isDark ? "text-orange-400" : "text-orange-600", borderColor: isDark ? "border-orange-500/40" : "border-orange-200", bgColor: isDark ? "bg-orange-500/08" : "bg-orange-50", numColor: isDark ? "text-orange-400" : "text-orange-600" },
            ];
            return (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">

                {/* ── Podium Hero (top 3) ───────────────────────────────────────── */}
                {standingsData.length >= 2 && (
                  <div className={`rounded-2xl border overflow-hidden ${
                    isDark ? "bg-[oklch(0.22_0.06_145)] border-white/12" : "bg-white border-gray-200/80 shadow-sm"
                  }`}>
                    {/* Header */}
                    <div className={`flex items-center justify-between px-5 py-3.5 border-b ${
                      isDark ? "border-white/08" : "border-gray-100"
                    }`}>
                      <h3 className={`text-[11px] font-black uppercase tracking-[0.12em] ${
                        isDark ? "text-white/40" : "text-gray-500"
                      }`}>Top Standings</h3>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        isDark ? "bg-[#4CAF50]/12 text-[#4CAF50]" : "bg-green-50 text-green-700"
                      }`}>Round {state.currentRound} of {state.totalRounds}</span>
                    </div>

                    {/* Podium cards */}
                    <div className="px-4 pt-6 pb-4">
                      <div className="flex items-end justify-center gap-3">
                        {podiumOrder.map((row, idx) => {
                          if (!row) return null;
                          const cfg = podiumConfig[idx];
                          const isFirst = cfg.rank === 1;
                          const player = row.player;
                          return (
                            <div
                              key={player.id}
                              className={`flex-1 flex flex-col items-center gap-2 px-3 py-4 rounded-2xl border transition-all duration-200 ${
                                cfg.bgColor
                              } ${
                                cfg.borderColor
                              }`}
                              style={{ animationDelay: `${idx * 60}ms` }}
                            >
                              {/* Rank number */}
                              <span
                                className={`text-[10px] font-black uppercase tracking-widest ${cfg.numColor}`}
                              >
                                #{cfg.rank}
                              </span>
                              {/* Avatar */}
                              <PlayerAvatar
                                username={player.username}
                                name={player.name}
                                size={isFirst ? 52 : 40}
                                showBadge
                                platform={player.platform}
                                avatarUrl={player.avatarUrl}
                                flairEmoji={player.flairEmoji}
                              />
                              {/* Name + title */}
                              <div className="text-center min-w-0 w-full">
                                <p className={`text-xs font-black truncate ${
                                  isDark ? "text-white" : "text-gray-900"
                                }`} style={{ fontFamily: "'Clash Display', sans-serif" }}>
                                  {player.name.split(" ")[0]}
                                </p>
                                {player.title && (
                                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded mt-0.5 inline-block ${
                                    isDark ? "bg-[#4CAF50]/15 text-[#4CAF50]" : "bg-[#3D6B47]/08 text-[#3D6B47]"
                                  }`}>{player.title}</span>
                                )}
                              </div>
                              {/* Points */}
                              <div className={`text-center ${cfg.numColor}`}>
                                <span
                                  className={`font-black tabular-nums leading-none ${
                                    isFirst ? "text-2xl" : "text-xl"
                                  }`}
                                  style={{ fontFamily: "'Clash Display', sans-serif" }}
                                >
                                  {row.points % 1 !== 0 ? `${Math.floor(row.points)}½` : row.points}
                                </span>
                                <span className={`text-[9px] font-bold ml-0.5 ${
                                  isDark ? "text-white/25" : "text-gray-400"
                                }`}>pts</span>
                              </div>
                              {/* W/D/L */}
                              <p className={`text-[10px] tabular-nums ${
                                isDark ? "text-white/35" : "text-gray-400"
                              }`}>{row.wins}W {row.draws}D {row.losses}L</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Full Leaderboard Table ────────────────────────────────────── */}
                <div className={`rounded-2xl border overflow-hidden ${
                  isDark ? "bg-[oklch(0.22_0.06_145)] border-white/12" : "bg-white border-gray-200/80 shadow-sm"
                }`}>
                  {/* Table header */}
                  <div className={`grid ${
                    isDoubleSwiss
                      ? "grid-cols-[2rem_1fr_2.5rem_4.5rem_4.5rem_3rem]"
                      : "grid-cols-[2rem_1fr_2.5rem_4.5rem_3rem]"
                  } gap-x-2 px-4 py-2.5 border-b ${
                    isDark ? "border-white/08 bg-white/02" : "border-gray-100 bg-gray-50/60"
                  }`}>
                    {["#", "Player", "Pts", "W / D / L", ...(isDoubleSwiss ? ["Match"] : [])].map((col, ci) => (
                      <span key={ci} className={`text-[10px] font-black uppercase tracking-[0.1em] ${
                        ci === 0 ? "text-center" : ci >= 2 ? "text-right" : ""
                      } ${
                        isDark ? "text-white/30" : "text-gray-400"
                      }`}>{col}</span>
                    ))}
                    <span className={`text-[10px] font-black uppercase tracking-[0.1em] text-right inline-flex items-center justify-end gap-0.5 ${isDark ? "text-white/30" : "text-gray-400"}`}>
                      Buch.<TiebreakTooltip type="buchholz" position="above" />
                    </span>
                  </div>

                  {/* Rows */}
                  <div className="divide-y divide-transparent">
                    {standingsData.map((row, i) => {
                      const p = row.player;
                      const isLeader = i === 0;
                      const isPodium = i < 3;
                      return (
                        <div
                          key={p.id}
                          className={`grid ${
                            isDoubleSwiss
                              ? "grid-cols-[2rem_1fr_2.5rem_4.5rem_4.5rem_3rem]"
                              : "grid-cols-[2rem_1fr_2.5rem_4.5rem_3rem]"
                          } gap-x-2 items-center px-4 py-2.5 transition-colors ${
                            isLeader
                              ? isDark ? "bg-amber-500/06 hover:bg-amber-500/10" : "bg-amber-50/70 hover:bg-amber-50"
                              : isPodium
                              ? isDark ? "hover:bg-white/03" : "hover:bg-gray-50/60"
                              : isDark ? "hover:bg-white/02" : "hover:bg-gray-50/40"
                          } ${
                            i > 0 ? (isDark ? "border-t border-white/04" : "border-t border-gray-100/80") : ""
                          }`}
                        >
                          {/* Rank */}
                          <span className={`text-[11px] font-black text-center tabular-nums ${
                            isLeader
                              ? isDark ? "text-amber-400" : "text-amber-600"
                              : i === 1
                              ? isDark ? "text-gray-300" : "text-gray-500"
                              : i === 2
                              ? isDark ? "text-orange-400" : "text-orange-600"
                              : isDark ? "text-white/25" : "text-gray-300"
                          }`}>{i + 1}</span>

                          {/* Player */}
                          <div className="flex items-center gap-2 min-w-0">
                            <PlayerAvatar
                              username={p.username}
                              name={p.name}
                              size={28}
                              platform={p.platform}
                              avatarUrl={p.avatarUrl}
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1">
                                <span className={`text-xs font-bold truncate ${
                                  isDark ? "text-white" : "text-gray-900"
                                }`}>{p.name.split(" ")[0]}</span>
                                {p.title && (
                                  <span className={`flex-shrink-0 text-[9px] font-black px-1 py-0.5 rounded ${
                                    isDark ? "bg-[#4CAF50]/15 text-[#4CAF50]" : "bg-[#3D6B47]/08 text-[#3D6B47]"
                                  }`}>{p.title}</span>
                                )}
                              </div>
                              <span className={`text-[10px] tabular-nums ${
                                isDark ? "text-white/25" : "text-gray-400"
                              }`}>{p.elo}</span>
                            </div>
                          </div>

                          {/* Points */}
                          <span className={`text-sm font-black tabular-nums text-right ${
                            isLeader
                              ? isDark ? "text-amber-400" : "text-amber-600"
                              : isDark ? "text-white" : "text-gray-900"
                          }`} style={{ fontFamily: "'Clash Display', sans-serif" }}>
                            {row.points % 1 !== 0 ? `${Math.floor(row.points)}½` : row.points}
                          </span>

                          {/* W/D/L (individual games) */}
                          <span className={`text-[10px] tabular-nums text-right ${
                            isDark ? "text-white/40" : "text-gray-500"
                          }`}>{row.wins}/{row.draws}/{row.losses}</span>

                          {/* Match W/D/L — Double Swiss only */}
                          {isDoubleSwiss && (
                            <span className={`text-[10px] tabular-nums text-right font-semibold ${
                              row.matchW > row.matchL
                                ? isDark ? "text-emerald-400" : "text-emerald-600"
                                : row.matchL > row.matchW
                                ? isDark ? "text-red-400" : "text-red-500"
                                : isDark ? "text-white/40" : "text-gray-500"
                            }`}>
                              {row.matchW}/{row.matchD}/{row.matchL}
                            </span>
                          )}

                          {/* Buchholz */}
                          <span className={`text-[10px] tabular-nums text-right ${
                            isDark ? "text-white/30" : "text-gray-400"
                          }`}>{row.buchholz.toFixed(1)}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Tiebreak footer */}
                  <div className={`flex items-start gap-2 px-4 py-3 border-t ${
                    isDark ? "border-white/06 bg-white/01" : "border-gray-100 bg-gray-50/40"
                  }`}>
                    <Info className={`w-3 h-3 mt-0.5 flex-shrink-0 ${
                      isDark ? "text-white/20" : "text-gray-300"
                    }`} />
                    <p className={`text-[10px] leading-relaxed ${
                      isDark ? "text-white/25" : "text-gray-400"
                    }`}>
                      <span className="font-bold">Tiebreak: Buchholz</span> — sum of opponents' scores. Higher = stronger opposition faced.
                    </p>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ── Players Tab ─────────────────────────────────────────────────── */}

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
                    {/* Export players CSV — always visible when roster has players */}
                    {state.players.length > 0 && (
                      <button
                        onClick={() => exportPlayersCSV(state.players, state.tournamentName)}
                        className={`flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border transition-all ${
                          isDark
                            ? "border-white/10 text-white/50 hover:text-white/70 hover:border-white/20"
                            : "border-gray-200 text-gray-500 hover:text-gray-700 hover:border-gray-300"
                        }`}
                        title="Download player roster as CSV"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Export
                      </button>
                    )}
                    {/* Add Player + Upload RSVPs buttons — registration phase */}
                  {isRegistration && (
                      <>
                        <button
                          onClick={() => setShowUploadRSVP(true)}
                          className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border transition-all ${
                            isDark
                              ? "border-[#4CAF50]/40 text-[#4CAF50] hover:bg-[#3D6B47]/20"
                              : "border-[#3D6B47]/40 text-[#3D6B47] hover:bg-[#3D6B47]/08"
                          }`}
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5" />
                          Upload RSVPs
                        </button>
                        <button
                          onClick={() => setShowAddPlayer(true)}
                          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg transition-all"
                          style={{ background: "#3D6B47", color: "#FFFFFF" }}
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          Add Player
                        </button>
                      </>
                    )}
                    {/* Late Registration button — only during Round 1 */}
                    {!isRegistration && state.currentRound === 1 && !allResultsIn && (
                      <button
                        onClick={() => setShowAddPlayer(true)}
                        className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border transition-all active:scale-95 ${
                          isDark
                            ? "bg-amber-500/12 border-amber-500/30 text-amber-400 hover:bg-amber-500/20"
                            : "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100"
                        }`}
                        title="Late registration open — players added now will be paired or given a bye"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        Late Registration
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
                        <span className={`text-sm ${isDark ? "text-white/40" : "text-gray-400"}`}>
                          @{p.username}
                          {(p.rapidElo || p.blitzElo) ? (
                            <>
                              {p.rapidElo ? <span className={`ml-1.5 text-[11px] font-semibold px-1 py-0.5 rounded ${
                                (tournamentConfig?.ratingType ?? "rapid") === "rapid"
                                  ? isDark ? "bg-[#3D6B47]/25 text-[#6FCF7F]" : "bg-[#3D6B47]/10 text-[#3D6B47]"
                                  : isDark ? "bg-white/06 text-white/35" : "bg-gray-100 text-gray-400"
                              }`}>⚡{p.rapidElo}</span> : null}
                              {p.blitzElo ? <span className={`ml-1 text-[11px] font-semibold px-1 py-0.5 rounded ${
                                (tournamentConfig?.ratingType ?? "rapid") === "blitz"
                                  ? isDark ? "bg-[#3D6B47]/25 text-[#6FCF7F]" : "bg-[#3D6B47]/10 text-[#3D6B47]"
                                  : isDark ? "bg-white/06 text-white/35" : "bg-gray-100 text-gray-400"
                              }`}>🔥{p.blitzElo}</span> : null}
                            </>
                          ) : (
                            <> · {p.elo} ELO</>
                          )}
                        </span>
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
                        {/* Bye button — only during active round */}
                        {!isRegistration && currentRoundData && (
                          byePlayerIds.has(p.id) ? (
                            <button
                              onClick={() => {
                                revokeBye(p.id);
                                toast.info(`${p.name}'s bye revoked`);
                              }}
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold border transition-all active:scale-95 ${
                                isDark
                                  ? "bg-blue-500/15 border-blue-500/30 text-blue-400 hover:bg-blue-500/25"
                                  : "bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100"
                              }`}
                              title="Revoke bye"
                            >
                              <Coffee className="w-3 h-3" />
                              Bye ✓
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                assignBye(p.id);
                                toast.success(`${p.name} assigned a bye (+½pt)`);
                              }}
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold border transition-all active:scale-95 opacity-0 group-hover:opacity-100 ${
                                isDark
                                  ? "bg-white/06 border-white/10 text-white/50 hover:bg-amber-500/15 hover:border-amber-500/30 hover:text-amber-400"
                                  : "bg-white border-gray-200 text-gray-400 hover:bg-amber-50 hover:border-amber-200 hover:text-amber-600"
                              }`}
                              title="Give bye (+½pt)"
                            >
                              <Coffee className="w-3 h-3" />
                              Bye
                            </button>
                          )
                        )}
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
                          <span className={`text-sm ${isDark ? "text-white/40" : "text-gray-400"}`}>
                          @{p.username}
                          {(p.rapidElo || p.blitzElo) ? (
                            <>
                              {p.rapidElo ? <span className={`ml-1.5 text-[11px] font-semibold px-1 py-0.5 rounded ${
                                (tournamentConfig?.ratingType ?? "rapid") === "rapid"
                                  ? isDark ? "bg-[#3D6B47]/25 text-[#6FCF7F]" : "bg-[#3D6B47]/10 text-[#3D6B47]"
                                  : isDark ? "bg-white/06 text-white/35" : "bg-gray-100 text-gray-400"
                              }`}>⚡{p.rapidElo}</span> : null}
                              {p.blitzElo ? <span className={`ml-1 text-[11px] font-semibold px-1 py-0.5 rounded ${
                                (tournamentConfig?.ratingType ?? "rapid") === "blitz"
                                  ? isDark ? "bg-[#3D6B47]/25 text-[#6FCF7F]" : "bg-[#3D6B47]/10 text-[#3D6B47]"
                                  : isDark ? "bg-white/06 text-white/35" : "bg-gray-100 text-gray-400"
                              }`}>🔥{p.blitzElo}</span> : null}
                            </>
                          ) : (
                            <> · {p.elo} ELO</>
                          )}
                        </span>
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
                      {/* Bye button — mobile */}
                      {!isRegistration && currentRoundData && (
                        byePlayerIds.has(p.id) ? (
                          <button
                            onClick={() => { revokeBye(p.id); toast.info(`${p.name}'s bye revoked`); }}
                            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all active:scale-95 ${
                              isDark
                                ? "bg-blue-500/15 border-blue-500/30 text-blue-400"
                                : "bg-blue-50 border-blue-200 text-blue-600"
                            }`}
                          >
                            <Coffee className="w-3 h-3" />
                            Bye ✓
                          </button>
                        ) : (
                          <button
                            onClick={() => { assignBye(p.id); toast.success(`${p.name} assigned a bye (+½pt)`); }}
                            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all active:scale-95 ${
                              isDark
                                ? "bg-white/06 border-white/10 text-white/40 hover:bg-amber-500/15 hover:border-amber-500/30 hover:text-amber-400"
                                : "bg-white border-gray-200 text-gray-400 hover:bg-amber-50 hover:border-amber-200 hover:text-amber-600"
                            }`}
                          >
                            <Coffee className="w-3 h-3" />
                            Bye
                          </button>
                        )
                      )}
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
          {/* ── Bracket Tab ─────────────────────────────────────────────────── */}
          {activeTab === "bracket" && isElimFormat && (
            <div className="flex flex-col gap-5 w-full">
              {/* Elimination Bracket Dashboard header */}
              {(state.elimPhase === "elimination" || state.format === "elimination") && (
                <div className={`rounded-2xl border overflow-hidden ${
                  isDark ? "bg-[oklch(0.22_0.06_145)] border-white/08" : "bg-white border-gray-100"
                }`}>
                  <div className="flex items-center justify-between px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        isDark ? "bg-[#4CAF50]/15" : "bg-green-50"
                      }`}>
                        <Trophy className={`w-4 h-4 ${isDark ? "text-[#4CAF50]" : "text-[#3D6B47]"}`} />
                      </div>
                      <div>
                        <p className={`text-sm font-black tracking-tight ${isDark ? "text-white" : "text-gray-900"}`}
                          style={{ fontFamily: "'Clash Display', sans-serif" }}>
                          Elimination Bracket
                        </p>
                        <p className={`text-xs mt-0.5 ${isDark ? "text-white/40" : "text-gray-500"}`}>
                          {state.elimRoundLabelText ?? "Bracket"}
                          {state.elimPlayers && ` · ${state.elimPlayers.length} players`}
                          {state.elimCutoff && ` · Top ${state.elimCutoff} from Swiss`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Change cutoff link — only for swiss_elim */}
                      {state.format === "swiss_elim" && (
                        <button
                          onClick={() => setShowCutoffOverride(true)}
                          className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors ${
                            isDark
                              ? "text-white/35 hover:text-white/60 hover:bg-white/06"
                              : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                          }`}
                        >
                          Change cutoff
                        </button>
                      )}
                      {allResultsIn && (
                        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold ${
                          isDark ? "bg-[#4CAF50]/15 text-[#4CAF50]" : "bg-green-50 text-green-700"
                        }`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                          All results in
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Swiss phase in progress — bracket not yet generated */}
              {state.format === "swiss_elim" && state.elimPhase === "swiss" && (
                <div className={`flex flex-col items-center justify-center py-12 gap-3 rounded-2xl border ${
                  isDark ? "bg-[oklch(0.22_0.06_145)] border-white/08" : "bg-white border-gray-100"
                }`}>
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                    isDark ? "bg-amber-500/10" : "bg-amber-50"
                  }`}>
                    <Trophy className={`w-6 h-6 ${isDark ? "text-amber-400" : "text-amber-500"}`} />
                  </div>
                  <div className="text-center">
                    <p className={`text-sm font-bold ${isDark ? "text-white/70" : "text-gray-700"}`}
                      style={{ fontFamily: "'Clash Display', sans-serif" }}>
                      Swiss Phase in Progress
                    </p>
                    <p className={`text-xs mt-1 ${isDark ? "text-white/35" : "text-gray-400"}`}>
                      The elimination bracket will auto-generate after Round {state.swissRounds ?? state.totalRounds}.
                    </p>
                  </div>
                </div>
              )}

              {/* Elimination bracket view */}
              {(state.elimPhase === "elimination" || state.format === "elimination") && (() => {
                // Determine which rounds are elimination rounds
                const elimStartRound = state.format === "swiss_elim"
                  ? (state.swissRounds ?? 0) + 1
                  : 1;
                const elimRounds = state.rounds.filter((r) => r.number >= elimStartRound);
                return (
                  <EliminationBracketView
                    rounds={elimRounds}
                    players={state.players}
                    elimPlayers={state.elimPlayers ?? state.players}
                    currentRound={state.currentRound}
                    allResultsIn={allResultsIn}
                    elimRoundLabelText={state.elimRoundLabelText}
                    isDark={isDark}
                    elimStartRound={elimStartRound}
                    onEnterResult={(gameId, result) => {
                      recordWithUndo(gameId, result, "*", `Elimination result recorded`);
                      pushStandingsNow();
                    }}
                    onAdvanceRound={() => {
                      generateNextRound();
                    }}
                    onCompleteTournament={() => {
                      completeTournament();
                      // Auto-post a feed card to the club if this tournament belongs to one
                      if (tournamentConfig?.clubId) {
                        const winner = liveStandings[0];
                        const winnerName = winner?.player.name ?? "Unknown";
                        recordTournamentCompleted(
                          tournamentConfig.clubId,
                          state.tournamentName,
                          winnerName,
                          tournamentId,
                          winner?.points,
                          state.totalRounds
                        );
                      }
                    }}
                  />
                );
              })()}

              {/* Prompt for pure elimination format before bracket exists */}
              {state.format === "elimination" && state.rounds.length === 0 && (
                <div className={`flex flex-col items-center justify-center py-16 gap-3 rounded-2xl border ${
                  isDark ? "bg-[oklch(0.22_0.06_145)] border-white/08" : "bg-white border-gray-100"
                }`}>
                  <Trophy className={`w-10 h-10 ${isDark ? "text-white/15" : "text-gray-200"}`} />
                  <p className={`text-sm font-semibold ${isDark ? "text-white/30" : "text-gray-400"}`}>Start the tournament to generate the bracket</p>
                </div>
              )}
            </div>
          )}

          {/* ── Settings Tab ─────────────────────────────────────────────────── */}
          {activeTab === "settings" && (
            <div className="space-y-4">
              {/* ── Tournament State ─────────────────────────────────────────── */}
              {!isRegistration && (
                <div className={`rounded-2xl border overflow-hidden ${isDark ? "bg-[oklch(0.22_0.06_145)] border-white/08" : "bg-white border-gray-100"}`}>
                  <div className={`px-5 py-3 border-b ${isDark ? "border-white/06" : "border-gray-100"}`}>
                    <h2 className={`text-xs font-bold uppercase tracking-widest ${isDark ? "text-white/35" : "text-gray-400"}`}>Tournament State</h2>
                  </div>
                  <div className="px-5 py-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        state.status === "paused"
                          ? isDark ? "bg-amber-500/15" : "bg-amber-50"
                          : isDark ? "bg-[#4CAF50]/15" : "bg-green-50"
                      }`}>
                        {state.status === "paused"
                          ? <Pause className={`w-4 h-4 ${isDark ? "text-amber-400" : "text-amber-600"}`} />
                          : <Play className={`w-4 h-4 ${isDark ? "text-[#4CAF50]" : "text-[#3D6B47]"}`} />}
                      </div>
                      <div>
                        <p className={`text-sm font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
                          {state.status === "paused" ? "Tournament Paused" : "Tournament Live"}
                        </p>
                        <p className={`text-xs mt-0.5 ${isDark ? "text-white/40" : "text-gray-400"}`}>
                          {state.status === "paused"
                            ? "Players are waiting — resume when ready"
                            : `Round ${state.currentRound} of ${state.totalRounds} in progress`}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        togglePause();
                        toast.info(state.status === "paused" ? "Tournament resumed" : "Tournament paused");
                      }}
                      className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95 ${
                        state.status === "paused"
                          ? isDark
                            ? "bg-[#4CAF50]/15 hover:bg-[#4CAF50]/25 text-[#4CAF50] border border-[#4CAF50]/20"
                            : "bg-green-50 hover:bg-green-100 text-green-700 border border-green-200"
                          : isDark
                          ? "bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/20"
                          : "bg-amber-50 hover:bg-amber-100 text-amber-600 border border-amber-200"
                      }`}
                    >
                      {state.status === "paused"
                        ? <><Play className="w-4 h-4" /><span>Resume</span></>
                        : <><Pause className="w-4 h-4" /><span>Pause</span></>}
                    </button>
                  </div>
                </div>
              )}

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
                      onClick: async () => { await generateResultsPdf({
                        tournamentName: state.tournamentName,
                        location: tournamentConfig?.venue,
                        date: tournamentConfig?.date,
                        timeControl: tournamentConfig?.timePreset,
                        players: state.players,
                        rounds: state.rounds,
                        clubName: tournamentConfig?.clubName ?? undefined,
                        clubLogoUrl: clubAvatarUrl ?? undefined,
                      }); },
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
              {/* ── Rating Type Selector ─────────────────────────────────── */}
              {tournamentConfig && tournamentConfig.ratingSystem === "chess.com" && (
                <div className={`rounded-2xl border overflow-hidden ${
                  isDark ? "bg-[oklch(0.22_0.06_145)] border-white/08" : "bg-white border-gray-100"
                }`}>
                  <div className={`px-5 py-3 border-b ${
                    isDark ? "border-white/06" : "border-gray-100"
                  }`}>
                    <h2 className={`text-xs font-bold uppercase tracking-widest ${
                      isDark ? "text-white/35" : "text-gray-400"
                    }`}>Pairing Rating</h2>
                  </div>
                  <div className="px-5 py-4 space-y-3">
                    <p className={`text-xs ${
                      isDark ? "text-white/45" : "text-gray-500"
                    }`}>
                      Choose which chess.com rating to use for Swiss pairings. Auto-set by time control when the tournament was created.
                    </p>
                    <div className="flex gap-2">
                      {(["rapid", "blitz"] as const).map((rt) => {
                        const active = (tournamentConfig.ratingType ?? "rapid") === rt;
                        return (
                          <button
                            key={rt}
                            type="button"
                            onClick={() => {
                              updateTournamentConfig(tournamentId, { ratingType: rt });
                              // Re-sync each player's active elo from stored rapidElo/blitzElo
                              state.players.forEach((p) => {
                                const newElo = rt === "blitz"
                                  ? (p.blitzElo || p.rapidElo || p.elo)
                                  : (p.rapidElo || p.blitzElo || p.elo);
                                if (newElo !== p.elo) updatePlayer(p.id, { elo: newElo });
                              });
                              toast.success(`Pairings will now use ${
                                rt === "blitz" ? "Blitz" : "Rapid"
                              } ratings`);
                            }}
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200"
                            style={{
                              background: active
                                ? isDark ? "rgba(61,107,71,0.25)" : "rgba(61,107,71,0.10)"
                                : isDark ? "rgba(255,255,255,0.06)" : "#F3F4F6",
                              color: active
                                ? isDark ? "#6FCF7F" : "#3D6B47"
                                : isDark ? "rgba(255,255,255,0.45)" : "#6B7280",
                              border: active
                                ? `1.5px solid ${
                                    isDark ? "rgba(61,107,71,0.40)" : "rgba(61,107,71,0.25)"
                                  }`
                                : "1.5px solid transparent",
                            }}
                          >
                            {rt === "rapid" ? "⚡ Rapid" : "🔥 Blitz"}
                          </button>
                        );
                      })}
                    </div>
                    {/* Show per-player both ratings if available */}
                    {state.players.some((p) => p.rapidElo || p.blitzElo) && (
                      <div className={`rounded-xl border overflow-hidden ${
                        isDark ? "border-white/08" : "border-gray-100"
                      }`}>
                        <div className={`px-3 py-2 ${
                          isDark ? "bg-white/03" : "bg-gray-50"
                        }`}>
                          <p className={`text-[10px] font-bold uppercase tracking-widest ${
                            isDark ? "text-white/30" : "text-gray-400"
                          }`}>Player Ratings</p>
                        </div>
                        <div className="divide-y" style={{ borderColor: isDark ? "rgba(255,255,255,0.06)" : "#F3F4F6" }}>
                          {state.players
                            .filter((p) => p.rapidElo || p.blitzElo)
                            .map((p) => (
                              <div key={p.id} className="flex items-center justify-between px-3 py-2">
                                <span className={`text-xs font-medium truncate max-w-[120px] ${
                                  isDark ? "text-white/70" : "text-gray-700"
                                }`}>{p.name}</span>
                                <div className="flex items-center gap-2">
                                  {p.rapidElo ? (
                                    <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-md ${
                                      (tournamentConfig.ratingType ?? "rapid") === "rapid"
                                        ? isDark ? "bg-[#3D6B47]/25 text-[#6FCF7F]" : "bg-[#3D6B47]/10 text-[#3D6B47]"
                                        : isDark ? "bg-white/06 text-white/40" : "bg-gray-100 text-gray-400"
                                    }`}>
                                      ⚡ {p.rapidElo}
                                    </span>
                                  ) : null}
                                  {p.blitzElo ? (
                                    <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-md ${
                                      (tournamentConfig.ratingType ?? "rapid") === "blitz"
                                        ? isDark ? "bg-[#3D6B47]/25 text-[#6FCF7F]" : "bg-[#3D6B47]/10 text-[#3D6B47]"
                                        : isDark ? "bg-white/06 text-white/40" : "bg-gray-100 text-gray-400"
                                    }`}>
                                      🔥 {p.blitzElo}
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── Style-Aware Pairings ──────────────────────────────────── */}
              <div className={`rounded-2xl border overflow-hidden ${
                isDark ? "bg-[oklch(0.22_0.06_145)] border-white/08" : "bg-white border-gray-100"
              }`}>
                <div className={`px-5 py-3 border-b ${
                  isDark ? "border-white/06" : "border-gray-100"
                }`}>
                  <div className="flex items-center gap-2">
                    <Crown className="w-3.5 h-3.5" style={{ color: "#D97706" }} />
                    <h2 className={`text-xs font-bold uppercase tracking-widest ${
                      isDark ? "text-white/35" : "text-gray-400"
                    }`}>Style-Aware Pairings</h2>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "#D97706", color: "#fff" }}>Pro</span>
                  </div>
                </div>
                <div className="px-5 py-4">
                  <StyleAwarePairingsPanel
                    players={state.players
                      .filter((p) => checkedInIds.has(p.id))
                      .map((p): StylePairingPlayer => ({
                        id: p.id,
                        name: p.name,
                        elo: p.elo,
                        styleProfile: undefined,
                        previousOpponents: [],
                      }))}
                    isDark={isDark}
                  />
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
                      { label: "Format", value: `${state.format === "doubleswiss" ? "Double Swiss" : state.format === "roundrobin" ? "Round Robin" : state.format === "elimination" ? "Elimination" : "Swiss"} · ${state.totalRounds} rounds` },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex items-center justify-between px-5 py-3">
                        <span className={`text-sm ${isDark ? "text-white/40" : "text-gray-500"}`}>{label}</span>
                        <span className={`text-sm font-medium ${isDark ? "text-white/80" : "text-gray-800"}`}>{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Director Code ─────────────────────────────────────────── */}
              {tournamentConfig?.directorCode && (
                <DirectorCodeCard
                  directorCode={tournamentConfig.directorCode}
                  isDark={isDark}
                />
              )}

              {/* ── Spectator / Watch Live ────────────────────────────────────── */}
              <SpectatorCodeCard
                spectatorUrl={spectatorUrl}
                isDark={isDark}
              />

              {/* ── Public Tournament Mode ─────────────────────────────────────── */}
              <PublicTournamentCard
                tournamentId={tournamentId}
                isDark={isDark}
              />

              {/* ── SMTP Email Settings ──────────────────────────────────────── */}
              <SmtpSettingsCard isDark={isDark} />

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
                <div className="px-5 py-4">
                  {!showEndConfirm ? (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className={`text-sm font-medium ${isDark ? "text-white/70" : "text-gray-700"}`}>End Tournament</p>
                        <p className={`text-xs ${isDark ? "text-white/30" : "text-gray-400"}`}>
                          Finalizes all results and locks the bracket
                        </p>
                      </div>
                      <button
                        onClick={() => setShowEndConfirm(true)}
                        className="text-xs font-semibold text-red-500 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
                      >
                        End Tournament
                      </button>
                    </div>
                  ) : (
                    <div className={`rounded-xl p-4 border ${isDark ? "bg-red-500/10 border-red-500/20" : "bg-red-50 border-red-200"}`}>
                      <p className={`text-sm font-semibold mb-1 ${isDark ? "text-red-400" : "text-red-700"}`}>End this tournament?</p>
                      <p className={`text-xs mb-3 ${isDark ? "text-red-400/70" : "text-red-600/80"}`}>
                        This will finalize all results, lock the bracket, and notify all connected players. This cannot be undone.
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={async () => {
                            setShowEndConfirm(false);
                            completeTournament();
                            syncStatusToServer("completed");
                            // Auto-post a feed card to the club if this tournament belongs to one
                            if (tournamentConfig?.clubId) {
                              const winner = liveStandings[0];
                              const winnerName = winner?.player.name ?? "Unknown";
                              recordTournamentCompleted(
                                tournamentConfig.clubId,
                                state.tournamentName,
                                winnerName,
                                tournamentId,
                                winner?.points,
                                state.totalRounds
                              );
                            }
                            try {
                              await fetch(`/api/tournament/${encodeURIComponent(tournamentId)}/end`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ players: standings, tournamentName: state.tournamentName }),
                              });
                            } catch {
                              console.error("[director] Failed to broadcast tournament_ended");
                            }
                            toast.success("Tournament finalized!");
                            setTimeout(() => navigate(`/tournament/${tournamentId}/results`), 900);
                          }}
                          className="flex-1 text-xs font-semibold text-white bg-red-500 hover:bg-red-600 px-3 py-2 rounded-lg transition-colors"
                        >
                          Yes, End Tournament
                        </button>
                        <button
                          onClick={() => setShowEndConfirm(false)}
                          className={`flex-1 text-xs font-semibold px-3 py-2 rounded-lg transition-colors ${isDark ? "bg-white/08 text-white/60 hover:bg-white/12" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

            {/* ── Delete Tournament (inside Danger Zone) ──────────────────────── */}
            {tournamentId !== "otb-demo-2026" && (
              <div className={`rounded-xl border overflow-hidden ${isDark ? "bg-[oklch(0.22_0.06_145)] border-red-500/20" : "bg-white border-red-100"}`}>
                <div className={`px-5 py-3 border-b ${isDark ? "border-red-500/20" : "border-red-50"}`}>
                  <h2 className="text-sm font-semibold text-red-500">Delete Tournament</h2>
                </div>
                <div className="px-5 py-4">
                  {!showDeleteConfirm ? (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className={`text-sm font-medium ${isDark ? "text-white/70" : "text-gray-700"}`}>Permanently delete this tournament</p>
                        <p className={`text-xs mt-0.5 ${isDark ? "text-white/30" : "text-gray-400"}`}>
                          Removes all players, pairings, results, and analytics
                        </p>
                      </div>
                      <button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="text-xs font-semibold text-red-500 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  ) : (
                    <div className={`rounded-xl p-4 border ${isDark ? "bg-red-500/10 border-red-500/20" : "bg-red-50 border-red-200"}`}>
                      <p className={`text-sm font-bold mb-1 ${isDark ? "text-red-400" : "text-red-800"}`}>Permanently delete "{state.tournamentName}"?</p>
                      <p className={`text-xs mb-3 ${isDark ? "text-red-400/70" : "text-red-700/80"}`}>
                        All players, pairings, results, and analytics will be erased forever. There is no undo.
                      </p>
                      <div className="flex gap-2">
                        <button
                          disabled={isDeleting}
                          onClick={async () => {
                            setIsDeleting(true);
                            try {
                              const r = await fetch(`/api/tournament/${encodeURIComponent(tournamentId)}`, {
                                method: "DELETE",
                                credentials: "include",
                              });
                              if (r.ok) {
                                toast.success("Tournament deleted");
                                setTimeout(() => navigate("/"), 800);
                              } else {
                                const err = await r.json().catch(() => ({}));
                                toast.error((err as any).error ?? "Failed to delete tournament");
                                setIsDeleting(false);
                                setShowDeleteConfirm(false);
                              }
                            } catch {
                              toast.error("Network error — could not delete tournament");
                              setIsDeleting(false);
                            }
                          }}
                          className="flex-1 text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 px-3 py-2 rounded-lg transition-colors"
                        >
                          {isDeleting ? "Deleting…" : "Yes, Delete Forever"}
                        </button>
                        <button
                          onClick={() => setShowDeleteConfirm(false)}
                          disabled={isDeleting}
                          className={`flex-1 text-xs font-semibold px-3 py-2 rounded-lg transition-colors ${isDark ? "bg-white/08 text-white/60 hover:bg-white/12" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            </div>
          )}
          </main>
        </div>{/* end flex gap-6 */}
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
        tournamentId={state.tournamentId}
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
          if (!isRegistration && state.currentRound === 1) {
            // Late registration during Round 1
            const outcome = addLatePlayer(player);
            if ('duplicate' in outcome) {
              toast.error(`${player.name} is already in the tournament`);
            } else if ('locked' in outcome) {
              toast.error("Late registration is only available during Round 1");
            } else if ('paired' in outcome) {
              toast.success(`${player.name} paired with ${outcome.opponentName} on Board ${outcome.board}`);
            } else {
              toast.success(`${player.name} added — assigned a bye this round (+½pt)`);
            }
          } else {
            addPlayer(player);
            toast.success(`${player.name} added to the tournament`);
          }
        }}
        onBulkUpsert={({ toUpdate }) => {
          toUpdate.forEach(({ id, patch }) => updatePlayer(id, patch));
        }}
        existingPlayers={state.players.map((p) => ({ id: p.id, username: p.username, name: p.name, elo: p.elo }))}
        existingUsernames={existingUsernames}
        ratingType={tournamentConfig?.ratingType}
      />

       {/* ── Instagram Carousel Modal ──────────────────────────────────────── */}
      {showCarousel && (
        <InstagramCarouselModal
          open={showCarousel}
          onClose={() => setShowCarousel(false)}
          rows={liveStandings}
          config={getTournamentConfig(tournamentId) ?? null}
          tournamentName={state.tournamentName}
          totalRounds={state.totalRounds}
          rounds={state.rounds}
          clubLogoUrl={clubAvatarUrl}
        />
      )}

      {/* ── Upload RSVP Modal ────────────────────────────────────────────── */}
      <UploadRSVPModal
        open={showUploadRSVP}
        onClose={() => setShowUploadRSVP(false)}
        onAdd={(player) => {
          addPlayer(player);
        }}
        existingUsernames={existingUsernames}
      />

      {/* ── Start Tournament Confirmation Dialog ─────────────────────────────── */}
      {showStartConfirm && (
        <div className="modal-overlay z-50">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowStartConfirm(false)}
          />
          {/* Dialog */}
          <div
            className={`modal-card max-w-sm rounded-2xl p-6 shadow-2xl ${
              isDark ? "bg-[oklch(0.18_0.04_145)] border border-white/10" : "bg-white border border-gray-100"
            }`}
            style={{ marginTop: "max(1rem, 10vh)", marginBottom: "max(1rem, 10vh)" }}
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

            {/* ── Undo Result Snackbar ────────────────────────────────────── */}
      <UndoSnackbar
        pending={undoPending}
        onUndo={undoResult}
        onDismiss={dismissUndo}
        isDark={isDark}
      />

      {/* ── Edit Player Modal ─────────────────────────────────────────────── */}
      <EditPlayerModal
        open={editingPlayer !== null}
        player={editingPlayer}
        tournamentRatingType={tournamentConfig?.ratingType ?? "rapid"}
        onSave={(updated) => {
          updatePlayer(updated.id, {
            name: updated.name,
            elo: updated.elo,
            rapidElo: updated.rapidElo,
            blitzElo: updated.blitzElo,
          });
          toast.success(`${updated.name} updated`);
        }}
        onClose={() => setEditingPlayer(null)}
      />

      {/* ── Pairing Swap Modal ──────────────────────────────────────────────── */}
      {currentRoundData && (
        <PairingSwapModal
          open={swapModalOpen}
          games={currentRoundData.games}
          players={state.players}
          roundNumber={state.currentRound}
          onSwap={(updatedGames) => {
            replaceRoundGames(updatedGames);
            toast.success("Board assignments updated");
          }}
          onClose={() => setSwapModalOpen(false)}
        />
      )}
      {/* ── Cutoff Override Modal ─────────────────────────────────────────── */}
      {showCutoffOverride && state.format === "swiss_elim" && state.elimPhase === "elimination" && (() => {
        const swissRoundCount = state.swissRounds ?? 0;
        const elimRoundsInState = state.rounds.filter((r) => r.number > swissRoundCount);
        const hasElimResults = elimRoundsInState.some((r) =>
          r.games.some((g) => g.result !== "*" && g.whiteId !== "BYE" && g.blackId !== "BYE")
        );
        return (
          <CutoffOverrideModal
            currentCutoff={state.elimCutoff ?? 8}
            totalPlayers={state.players.length}
            hasResults={hasElimResults}
            isDark={isDark}
            onConfirm={(newCutoff) => {
              resetElimination(newCutoff);
              toast.success(`Bracket regenerated with top ${newCutoff} players.`);
            }}
            onClose={() => setShowCutoffOverride(false)}
          />
        );
      })()}

      {/* ── Mobile floating "Back to Home" pill ─────────────────────────────── */}
      {/* Visible on mobile only when on a non-home tab, so the director can quickly jump back */}
      {activeTab !== "home" && (
        <div
          className="sm:hidden fixed bottom-6 left-4 z-40"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <button
            onClick={() => setActiveTab("home")}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-bold shadow-lg transition-all active:scale-95 border ${
              isDark
                ? "bg-[oklch(0.22_0.06_145)]/95 backdrop-blur-md border-white/12 text-white/70 hover:text-white shadow-black/40"
                : "bg-white/95 backdrop-blur-md border-gray-200 text-gray-600 hover:text-gray-900 shadow-gray-200/80"
            }`}
          >
            <ChevronLeft className="w-4 h-4 -ml-0.5" />
            Home
          </button>
        </div>
      )}
    </div>
  );
}
