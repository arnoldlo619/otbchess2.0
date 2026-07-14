/**
 * PlayerView — /tournament/:id/play?username=xxx
 *
 * Mobile-first participant experience. No account required.
 * Connects via SSE and stays live for the full tournament duration.
 *
 * Screens / states:
 *   lobby            — waiting for tournament to start
 *   my_board         — active game: board, opponent, result buttons, standings tab
 *   waiting_round    — between rounds: live standings while director generates next round
 *   new_round_flash  — brief animated transition when a new round starts
 *   tournament_complete — final standings
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useParams, useSearch, useLocation } from "wouter";
import { Link } from "wouter";
import { QRCodeSVG } from "qrcode.react";
import {
  Trophy,
  Swords,
  Clock,
  MonitorPlay,
  CheckCircle2,
  Users,
  RotateCcw,
  Crown,
  Circle,
  Copy,
  Check,
  BarChart3,
  Wifi,
  WifiOff,
  Bell,
  BellOff as _BellOff,
  X,
  Timer,
  Video,
  ChevronDown,
  RefreshCw,
} from "lucide-react";
import { authFetch } from "@/lib/apiFetch";
import { BoardBroadcastPlayer } from "@/components/BoardBroadcastPlayer";
import { FilmGameSheet } from "@/components/FilmGameSheet";
import type { BroadcastStatus } from "@/lib/broadcastUtils";
import { isValidBroadcastUrl } from "@/lib/broadcastUtils";
import { usePushSubscription } from "@/hooks/usePushSubscription";
import { useTheme } from "@/contexts/ThemeContext";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { resolveTournament } from "@/lib/tournamentRegistry";
import type { Game, Player, Round } from "@/lib/tournamentData";
import { getStandings } from "@/lib/tournamentData";
import { TournamentCompleteScreen } from "./TournamentCompleteScreen";

// ─── Types ────────────────────────────────────────────────────────────────────
interface LivePayload {
  round: number;
  games: Game[];
  players: Player[];
  allRounds?: Round[];
}
interface StandingsPayload {
  players: Player[];
  currentRound: number;
  status: string;
}
interface TournamentEndedPayload {
  players: Player[];
  tournamentName: string;
}
type PlayerScreen =
  | "lobby"
  | "my_board"
  | "waiting_round"
  | "new_round_flash"
  | "tournament_complete";

// ─── Helpers ─────────────────────────────────────────────────────────────────
export function findMyBoard(
  username: string,
  games: Game[],
  players: Player[]
): { game: Game; myColor: "white" | "black"; opponent: Player | undefined } | null {
  const me = players.find((p) => p.username.toLowerCase() === username.toLowerCase());
  if (!me) return null;
  const game = games.find((g) => g.whiteId === me.id || g.blackId === me.id);
  if (!game) return null;
  const myColor = game.whiteId === me.id ? "white" : "black";
  const opponentId = myColor === "white" ? game.blackId : game.whiteId;
  const opponent = players.find((p) => p.id === opponentId);
  return { game, myColor, opponent };
}

function myRank(username: string, players: Player[]): number {
  const standings = getStandings(players);
  const idx = standings.findIndex((p) => p.username.toLowerCase() === username.toLowerCase());
  return idx === -1 ? 0 : idx + 1;
}

// ─── Connection Status Badge ──────────────────────────────────────────────────
function ConnectionBadge({ connected, isDark }: { connected: boolean; isDark: boolean }) {
  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
      connected
        ? isDark ? "bg-emerald-500/15 text-emerald-400" : "bg-emerald-50 text-emerald-600"
        : isDark ? "bg-red-500/15 text-red-400" : "bg-red-50 text-red-500"
    }`}>
      {connected
        ? <><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" /><Wifi className="w-3 h-3" />Live</>
        : <><WifiOff className="w-3 h-3" />Reconnecting</>
      }
    </div>
  );
}

// ─── Live Standings Panel ─────────────────────────────────────────────────────
function LiveStandingsPanel({
  players, username, currentRound, totalRounds, isDark,
}: {
  players: Player[]; username: string; currentRound: number; totalRounds: number; isDark: boolean;
}) {
  const standings = getStandings(players);
  const medals = ["🥇", "🥈", "🥉"];
  const textMain = isDark ? "text-white" : "text-[#12372A]";
  const textMuted = isDark ? "text-white/65" : "text-[#436850]";
  const accent = isDark ? "text-[#4CAF50]" : "text-[#436850]";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1 mb-3">
        <p className={`text-xs font-bold uppercase tracking-wider ${accent}`}>Live Standings</p>
        <p className={`text-xs ${textMuted}`}>Round {currentRound} of {totalRounds}</p>
      </div>
      {standings.map((p, i) => {
        const isMe = p.username.toLowerCase() === username.toLowerCase();
        return (
          <div
            key={p.id}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
              isMe
                ? isDark
                  ? "bg-[#436850]/30 border border-[#4CAF50]/40"
                  : "bg-[#436850]/08 border border-[#436850]/25"
                : i < 3
                ? isDark ? "bg-white/04" : "bg-[#FBFADA]/70"
                : ""
            }`}
          >
            <span className="text-base w-7 text-center flex-shrink-0">
              {i < 3
                ? medals[i]
                : <span className={`text-sm font-bold ${isDark ? "text-white/55" : "text-[#436850]/70"}`}>{i + 1}</span>
              }
            </span>
            <PlayerAvatar
              username={p.username}
              name={p.name || p.username}
              platform={p.platform ?? "chesscom"}
              avatarUrl={p.avatarUrl}
              size={32}
              className="flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className={`text-sm font-bold truncate ${isMe ? accent : textMain}`}>
                  {p.name?.split(" ")[0] ?? p.username}
                  {isMe && <span className={`ml-1 text-xs ${accent}`}>(you)</span>}
                </span>
                {p.title && (
                  <span className="text-xs font-bold text-[#436850] bg-[#436850]/10 px-1 py-0.5 rounded flex-shrink-0">
                    {p.title}
                  </span>
                )}
              </div>
              <span className={`text-xs ${textMuted}`}>
                {p.wins}W {p.draws}D {p.losses}L · {p.elo} ELO
              </span>
            </div>
            <span className={`text-lg font-black tabular-nums flex-shrink-0 ${isMe ? accent : textMain}`}>
              {p.points}
            </span>
          </div>
        );
      })}
      {standings.length === 0 && (
        <div className={`text-center py-8 ${textMuted}`}>
          <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Standings will appear here once games begin.</p>
        </div>
      )}
    </div>
  );
}

// ─── Rejoin Link Card ─────────────────────────────────────────────────────────
function RejoinLinkCard({ rejoinUrl, isDark }: { rejoinUrl: string; isDark: boolean }) {
  const [copied, setCopied] = useState(false);
  const textMuted = isDark ? "text-white/65" : "text-[#436850]";
  const cardBg = isDark ? "bg-[#1a2e1e]" : "bg-[#FBFADA]/70";
  const accent = isDark ? "text-[#4CAF50]" : "text-[#436850]";
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(rejoinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  }
  return (
    <div className={`w-full rounded-2xl px-5 py-4 ${cardBg} space-y-3`}>
      <p className={`text-xs font-bold uppercase tracking-wider ${accent}`}>Your Rejoin Link</p>
      <p className={`text-xs ${textMuted}`}>Bookmark this to jump straight back to your board.</p>
      <div className="flex justify-center">
        <div className={`p-2 rounded-xl ${isDark ? "bg-white" : "bg-white border border-[#ADBC9F]/70"}`}>
          <QRCodeSVG value={rejoinUrl} size={96} bgColor="#ffffff" fgColor="#1a2e1e" level="M" />
        </div>
      </div>
      <button
        onClick={handleCopy}
        className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold transition-all active:scale-95 ${
          isDark ? "bg-white/08 hover:bg-white/12 text-white/70" : "bg-[#ADBC9F]/40 hover:bg-[#ADBC9F] text-[#436850]"
        }`}
      >
        {copied
          ? <><Check className={`w-3.5 h-3.5 ${accent}`} /><span className={accent}>Copied!</span></>
          : <><Copy className="w-3.5 h-3.5" />Copy link</>
        }
      </button>
    </div>
  );
}

// ─── Push Prompt Card ───────────────────────────────────────────────────────────
function PushPromptCard({
  tournamentId, isDark, chessUsername,
}: {
  tournamentId: string; isDark: boolean; chessUsername?: string;
}) {
  const { status, subscribe, isLoading } = usePushSubscription({ tournamentId, chessUsername });
  const [dismissed, setDismissed] = useState(false);

  // Don't show if already subscribed, denied, dismissed, or browser doesn't support push
  if (dismissed || status === "subscribed" || status === "denied") return null;
  if (typeof window !== "undefined" && !("PushManager" in window)) return null;

  const cardBg = isDark
    ? "bg-[#1a2e1e] border border-[#4CAF50]/20"
    : "bg-emerald-50 border border-emerald-200";
  const accent = isDark ? "text-[#4CAF50]" : "text-[#436850]";
  const textMain = isDark ? "text-white" : "text-[#12372A]";
  const textMuted = isDark ? "text-white/70" : "text-[#436850]";

  return (
    <div className={`mx-4 mt-3 rounded-2xl px-4 py-3.5 flex items-start gap-3 ${cardBg}`}>
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${
        isDark ? "bg-[#4CAF50]/15" : "bg-emerald-100"
      }`}>
        <Bell className={`w-4.5 h-4.5 ${accent}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-bold leading-tight ${textMain}`}>Get notified when your round starts</p>
        <p className={`text-xs mt-0.5 ${textMuted}`}>We'll send a push alert when the director generates pairings.</p>
        <button
          onClick={subscribe}
          disabled={isLoading}
          className={`mt-2.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 ${
            isDark
              ? "bg-[#4CAF50] text-black hover:bg-[#5DBF61] disabled:opacity-50"
              : "bg-[#436850] text-white hover:bg-[#2d5237] disabled:opacity-50"
          }`}
        >
          {isLoading ? "Enabling…" : "Enable Notifications"}
        </button>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className={`flex-shrink-0 p-1 rounded-lg transition-colors ${
          isDark ? "text-white/30 hover:text-white/60 hover:bg-white/08" : "text-[#436850] hover:text-[#436850] hover:bg-[#ADBC9F]/50"
        }`}
        aria-label="Dismiss"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ─── Lobby Screen ─────────────────────────────────────────────────────────────
function LobbyScreen({
  tournamentName, username, isDark, tournamentId,
  playerCount, onPlayerCountChange, rejoinUrl, connected, onRefresh,
}: {
  tournamentName: string; username: string; isDark: boolean; tournamentId: string;
  playerCount: number | null; onPlayerCountChange: (n: number) => void;
  rejoinUrl: string; connected: boolean;
  onRefresh: () => Promise<void>;
}) {
  const [dots, setDots] = useState(".");
  const [refreshing, setRefreshing] = useState(false);
  const [refreshResult, setRefreshResult] = useState<"found" | "not_started" | null>(null);
  useEffect(() => {
    const t = setInterval(() => setDots((d) => (d.length >= 3 ? "." : d + ".")), 600);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    fetch(`/api/tournament/${encodeURIComponent(tournamentId)}/players`)
      .then((r) => r.json())
      .then((d) => { if (d.count != null) onPlayerCountChange(d.count); })
      .catch(() => {});
  }, [tournamentId, onPlayerCountChange]);

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    setRefreshResult(null);
    try {
      await onRefresh();
      // onRefresh calls applyLiveState which transitions screen if tournament started.
      // If we're still here after the await, tournament hasn't started yet.
      setRefreshResult("not_started");
    } catch {
      setRefreshResult("not_started");
    } finally {
      setRefreshing(false);
      // Clear the feedback label after 3s
      setTimeout(() => setRefreshResult(null), 3000);
    }
  };

  const bg = isDark ? "bg-[#0d1f12]" : "bg-white";
  const textMain = isDark ? "text-white" : "text-[#12372A]";
  const textMuted = isDark ? "text-white/65" : "text-[#436850]";
  const cardBg = isDark ? "bg-[#1a2e1e]" : "bg-[#FBFADA]/70";
  const accent = isDark ? "text-[#4CAF50]" : "text-[#436850]";
  const accentBg = isDark ? "bg-[#4CAF50]/10" : "bg-[#436850]/08";

  return (
    <div className={`min-h-screen ${bg} flex flex-col`}>
      <div className={`px-5 otb-header-safe pb-4 border-b ${isDark ? "border-white/08" : "border-[#ADBC9F]/70"}`}>
        <div className="flex items-center justify-between">
          <h1 className={`text-lg font-bold leading-tight ${textMain} truncate`}>{tournamentName}</h1>
          <ConnectionBadge connected={connected} isDark={isDark} />
        </div>
      </div>
      <PushPromptCard tournamentId={tournamentId} isDark={isDark} chessUsername={username} />
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 gap-8">
        <div className="relative flex items-center justify-center">
          <div className={`absolute w-32 h-32 rounded-full ${accentBg} animate-ping opacity-30`} />
          <div className={`absolute w-24 h-24 rounded-full ${accentBg} animate-ping opacity-50`} style={{ animationDelay: "0.3s" }} />
          <motion.div
            className={`relative w-20 h-20 rounded-full ${accentBg} flex items-center justify-center overflow-hidden`}
            initial={{ scale: 0.4, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.15 }}
          >
            <motion.img
              src="https://d2xsxph8kpxj0f.cloudfront.net/117675823/J6FsDoRMH9x5xbUvpyzxyf/otb-logo-exclamation_a8022818.png"
              alt="OTB!!"
              className="w-14 h-14 object-contain"
              initial={{ rotate: -8 }}
              animate={{ rotate: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 14, delay: 0.25 }}
            />
          </motion.div>
        </div>
        <div className="text-center space-y-2">
          <h2 className={`text-2xl font-bold ${textMain}`}>Tournament will begin soon{dots}</h2>
          <p className={`text-base ${textMuted}`}>
            Hi <span className={`font-bold ${accent}`}>{username}</span> — you're registered!
          </p>
          {playerCount !== null && (
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${accentBg} mt-2`}>
              <Users className={`w-4 h-4 ${accent}`} />
              <span className={`text-sm font-semibold ${accent}`}>{playerCount} player{playerCount !== 1 ? "s" : ""} registered</span>
            </div>
          )}
        </div>
        <div className={`w-full max-w-xs rounded-2xl ${cardBg} px-5 py-4 space-y-2`}>
          <p className={`text-xs font-bold uppercase tracking-wider ${accent}`}>What to expect</p>
          {[
            { icon: CheckCircle2, text: "Director will start the tournament shortly" },
            { icon: Swords, text: "You'll be assigned a board and opponent" },
            { icon: Trophy, text: "Winner reports result to arbiter at front desk" },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-3">
              <Icon className={`w-4 h-4 flex-shrink-0 ${accent}`} />
              <p className={`text-sm ${textMuted}`}>{text}</p>
            </div>
          ))}
        </div>
        {/* ── Manual refresh fallback ─────────────────────────────────────── */}
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-all active:scale-95 disabled:opacity-60 ${
              isDark
                ? "bg-white/08 text-white/70 hover:bg-white/12 border border-white/10"
                : "bg-[#ADBC9F]/40 text-[#436850] hover:bg-[#ADBC9F] border border-[#ADBC9F]"
            }`}
          >
            <RefreshCw className={`w-4 h-4 transition-transform ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Checking…" : "Refresh State"}
          </button>
          {refreshResult === "not_started" && (
            <p className={`text-xs ${textMuted}`}>Tournament hasn't started yet — check back shortly</p>
          )}
        </div>
      </div>
    </div>
  );
}
// ─── Waiting Between Rounds Screen ───────────────────────────────────────────
function WaitingRoundScreen({
  tournamentId, tournamentName, username, round, totalRounds, players, isDark, connected,
}: {
  tournamentId: string; tournamentName: string; username: string; round: number; totalRounds: number;
  players: Player[]; isDark: boolean; connected: boolean;
}) {
  const [dots, setDots] = useState(".");
  useEffect(() => {
    const t = setInterval(() => setDots((d) => (d.length >= 3 ? "." : d + ".")), 600);
    return () => clearInterval(t);
  }, []);

  const bg = isDark ? "bg-[#0d1f12]" : "bg-white";
  const textMain = isDark ? "text-white" : "text-[#12372A]";
  const textMuted = isDark ? "text-white/65" : "text-[#436850]";
  const accent = isDark ? "text-[#4CAF50]" : "text-[#436850]";
  const accentBg = isDark ? "bg-[#4CAF50]/10" : "bg-[#436850]/08";
  const rank = myRank(username, players);
  const myScore = getStandings(players).find(
    (p) => p.username.toLowerCase() === username.toLowerCase()
  )?.points ?? 0;

  return (
    <div className={`min-h-screen ${bg} flex flex-col`}>
      <div className={`px-5 otb-header-safe pb-4 border-b ${isDark ? "border-white/08" : "border-[#ADBC9F]/70"}`}>
        <div className="flex items-center justify-between">
          <h1 className={`text-lg font-bold leading-tight ${textMain} truncate`}>{tournamentName}</h1>
          <ConnectionBadge connected={connected} isDark={isDark} />
        </div>
      </div>
      <div className={`mx-4 mt-4 rounded-2xl ${accentBg} px-5 py-4 flex items-center gap-4`}>
        <div className={`w-10 h-10 rounded-full ${isDark ? "bg-[#4CAF50]/20" : "bg-[#436850]/12"} flex items-center justify-center flex-shrink-0`}>
          <Clock className={`w-5 h-5 ${accent}`} />
        </div>
        <div>
          <p className={`text-sm font-bold ${textMain}`}>Round {round} complete{dots}</p>
          <p className={`text-xs ${textMuted}`}>
            Waiting for director to generate Round {round + 1} of {totalRounds}
          </p>
        </div>
      </div>
      <div className={`mx-4 mt-3 rounded-2xl px-5 py-4 flex items-start gap-3 ${isDark ? "bg-amber-500/10 border border-amber-500/20" : "bg-amber-50 border border-amber-200"}`}>
        <span className="text-xl flex-shrink-0 mt-0.5">🏁</span>
        <div>
          <p className={`text-sm font-bold mb-0.5 ${isDark ? "text-amber-300" : "text-amber-800"}`}>Report your result</p>
          <p className={`text-xs ${isDark ? "text-amber-300/70" : "text-amber-700"}`}>
            The winner should report the score to the director at the registration table.
          </p>
        </div>
      </div>
      <PushPromptCard tournamentId={tournamentId} isDark={isDark} chessUsername={username} />
      {rank > 0 && (
        <div className={`mx-4 mt-3 rounded-2xl ${isDark ? "bg-[#1a2e1e]" : "bg-[#FBFADA]/70"} px-5 py-4`}>
          <p className={`text-xs font-bold uppercase tracking-wider ${accent} mb-2`}>Your Standing</p>
          <div className="flex items-center gap-3">
            <span className="text-3xl">{rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`}</span>
            <div>
              <p className={`text-lg font-black ${textMain}`}>{myScore} pts</p>
              <p className={`text-xs ${textMuted}`}>Rank {rank} of {players.length}</p>
            </div>
          </div>
        </div>
      )}
      <div className={`mx-4 mt-3 mb-6 rounded-2xl ${isDark ? "bg-[#1a2e1e]" : "bg-[#FBFADA]/70"} px-4 py-4 flex-1 overflow-y-auto pb-safe`}>
        <LiveStandingsPanel
          players={players}
          username={username}
          currentRound={round}
          totalRounds={totalRounds}
          isDark={isDark}
        />
      </div>
    </div>
  );
}

// ─── My Board Screen ──────────────────────────────────────────────────────────
type TimerSnap = {
  status: "idle" | "running" | "paused" | "expired";
  durationSec: number;
  startWallMs: number;
  elapsedAtPauseMs: number;
  savedAt: number;
} | null;

function PlayerTimerBanner({ snap, isDark }: { snap: TimerSnap; isDark: boolean }) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!snap || snap.status === "idle") { setRemaining(0); return; }
    if (snap.status === "paused") {
      setRemaining(Math.max(0, snap.durationSec - Math.round(snap.elapsedAtPauseMs / 1000)));
      return;
    }
    if (snap.status === "expired") { setRemaining(0); return; }
    // running — tick every second
    const calc = () => {
      const elapsed = Math.round((Date.now() - snap.startWallMs + snap.elapsedAtPauseMs) / 1000);
      setRemaining(Math.max(0, snap.durationSec - elapsed));
    };
    calc();
    const t = setInterval(calc, 1000);
    return () => clearInterval(t);
  }, [snap]);

  if (!snap || snap.status === "idle") return null;

  const total = snap.durationSec || 1;
  const fraction = remaining / total; // 1 → 0
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const display = `${mins}:${secs.toString().padStart(2, "0")}`;
  const isLow = remaining > 0 && remaining <= 60;
  const isExpired = snap.status === "expired" || remaining === 0;
  const isPaused = snap.status === "paused";

  // ── Color system: green → amber → red ──
  const strokeColor = isExpired
    ? isDark ? "#ef4444" : "#dc2626"
    : isLow
    ? isDark ? "#f59e0b" : "#d97706"
    : isDark ? "#4CAF50" : "#436850";
  const textColor = isExpired
    ? isDark ? "text-red-400" : "text-red-600"
    : isLow
    ? isDark ? "text-amber-400" : "text-amber-700"
    : isDark ? "text-[#4CAF50]" : "text-[#436850]";
  const bgCard = isExpired
    ? isDark ? "bg-red-500/08 border border-red-500/20" : "bg-red-50/60 border border-red-200"
    : isLow
    ? isDark ? "bg-amber-500/08 border border-amber-500/20" : "bg-amber-50/60 border border-amber-200"
    : isDark ? "bg-[#1a2e1e] border border-[#4CAF50]/15" : "bg-emerald-50/60 border border-emerald-200";
  const trackColor = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";

  // ── SVG circular progress ring ──
  const size = 72;
  const strokeW = 4;
  const radius = (size - strokeW) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - fraction);

  return (
    <div className={`mx-4 mt-3 rounded-2xl px-4 py-3.5 flex items-center gap-4 ${bgCard} transition-colors duration-500`}>
      {/* Circular progress ring */}
      <div className={`relative flex-shrink-0 ${isLow && !isExpired && !isPaused ? "animate-pulse" : ""}`}>
        <svg width={size} height={size} className="-rotate-90">
          {/* Track */}
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke={trackColor} strokeWidth={strokeW}
          />
          {/* Progress arc */}
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeW}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{ transition: "stroke-dashoffset 1s linear, stroke 0.5s ease" }}
          />
        </svg>
        {/* Center icon */}
        <div className="absolute inset-0 flex items-center justify-center">
          {isExpired ? (
            <X className={`w-5 h-5 ${textColor}`} />
          ) : isPaused ? (
            <div className="flex gap-0.5">
              <div className={`w-1 h-4 rounded-full ${isDark ? "bg-white/40" : "bg-[#436850]/60"}`} />
              <div className={`w-1 h-4 rounded-full ${isDark ? "bg-white/40" : "bg-[#436850]/60"}`} />
            </div>
          ) : (
            <Clock className={`w-5 h-5 ${textColor}`} />
          )}
        </div>
      </div>

      {/* Time display */}
      <div className="flex-1 min-w-0">
          <p className={`text-xs font-bold uppercase tracking-widest mb-0.5 ${isDark ? "text-white/65" : "text-[#436850]"}`}>
          {isExpired ? "Time's Up" : isPaused ? "Round Timer — Paused" : "Round Timer"}
        </p>
        <p className={`text-3xl font-black font-mono leading-none tracking-tight ${textColor}`}>
          {isExpired ? "0:00" : display}
        </p>
          {!isExpired && !isPaused && remaining > 0 && (
          <p className={`text-xs mt-1 ${isDark ? "text-white/55" : "text-[#436850]"}`}>
            {Math.round(fraction * 100)}% remaining
          </p>
        )}
      </div>

      {/* Status badge */}
      {isPaused && (
        <span className={`text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${isDark ? "bg-white/08 text-white/50" : "bg-[#ADBC9F]/40 text-[#436850]"}`}>Paused</span>
      )}
      {isExpired && (
        <span className={`text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${isDark ? "bg-red-500/15 text-red-400" : "bg-red-50 text-red-600"}`}>Ended</span>
      )}
    </div>
  );
}

function MyBoardScreen({
  tournamentId, tournamentName, username, round, totalRounds,
  game, myColor, opponent, players, allRounds, isDark, rejoinUrl, connected, timerSnapshot,
}: {
  tournamentId: string; tournamentName: string; username: string;
  round: number; totalRounds: number; game: Game; myColor: "white" | "black";
  opponent: Player | undefined; players: Player[]; allRounds: Round[]; isDark: boolean;
  rejoinUrl: string; connected: boolean; timerSnapshot: TimerSnap;
}) {
  // ── Broadcast state ──────────────────────────────────────────────────────
  const [broadcast, setBroadcast] = useState<{
    broadcastEnabled: boolean;
    broadcastUrl: string | null;
    broadcastProvider: string | null;
    featuredBoardNumber: number;
    broadcastTitle: string | null;
    broadcastStatus: BroadcastStatus;
  } | null>(null);
  const [showStreamSheet, setShowStreamSheet] = useState(false);
  const [showFilmSheet, setShowFilmSheet] = useState(false);
  const [showOppStats, setShowOppStats] = useState(true);

  useEffect(() => {
    if (!tournamentId || tournamentId === "otb-demo-2026") return;
    authFetch(`/api/tournament/${encodeURIComponent(tournamentId)}/broadcast`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setBroadcast(d); })
      .catch(() => {});
  }, [tournamentId]);

  const hasBroadcast = !!(broadcast?.broadcastEnabled && broadcast.broadcastUrl && isValidBroadcastUrl(broadcast.broadcastUrl));
  const TABS = ["board", "standings", "clock"] as const;
  type Tab = typeof TABS[number];

  const [activeTab, setActiveTab] = useState<Tab>("board");
  const tabIndex = TABS.indexOf(activeTab);

  // Swipe state
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    setDragOffset(0);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = e.touches[0].clientY - touchStartY.current;
    // Only hijack horizontal swipes (angle < 40° from horizontal)
    if (Math.abs(dy) > Math.abs(dx) * 0.85) return;
    // Clamp: can't swipe past first or last tab
    if (dx > 0 && tabIndex === 0) return;
    if (dx < 0 && tabIndex === TABS.length - 1) return;
    setDragOffset(dx);
  };

  const handleTouchEnd = () => {
    const threshold = 50;
    if (dragOffset < -threshold && tabIndex < TABS.length - 1) {
      setIsAnimating(true);
      setActiveTab(TABS[tabIndex + 1]);
    } else if (dragOffset > threshold && tabIndex > 0) {
      setIsAnimating(true);
      setActiveTab(TABS[tabIndex - 1]);
    }
    setDragOffset(0);
    setTimeout(() => setIsAnimating(false), 300);
    touchStartX.current = null;
    touchStartY.current = null;
  };

  const textMain = isDark ? "text-white" : "text-[#12372A]";
  const textMuted = isDark ? "text-white/65" : "text-[#436850]";
  const cardBg = isDark ? "bg-[#1a2e1e]" : "bg-[#FBFADA]/70";
  const accent = isDark ? "text-[#4CAF50]" : "text-[#436850]";
  const accentBg = isDark ? "bg-[#4CAF50]/10" : "bg-[#436850]/08";
  const divider = isDark ? "border-white/08" : "border-[#ADBC9F]/70";
  const bg = isDark ? "bg-[#0d1f12]" : "bg-white";
  const colorLabel = myColor === "white" ? "White ♔" : "Black ♚";
  const rank = myRank(username, players);

  // ── Opponent history derived from allRounds ─────────────────────────────
  // Build a list of per-round results for the opponent from completed rounds.
  // Each entry: { round, result: 'W' | 'L' | 'D' }
  const opponentHistory: { round: number; result: "W" | "L" | "D" }[] = [];
  if (opponent) {
    const completedRounds = allRounds.filter(
      (r) => r.status === "completed" || r.games.some((g) => g.result !== "*")
    );
    for (const r of completedRounds) {
      for (const g of r.games) {
        if (g.result === "*") continue;
        const isWhite = g.whiteId === opponent.id;
        const isBlack = g.blackId === opponent.id;
        if (!isWhite && !isBlack) continue;
        let res: "W" | "L" | "D";
        if (g.result === "½-½") {
          res = "D";
        } else if ((g.result === "1-0" && isWhite) || (g.result === "0-1" && isBlack)) {
          res = "W";
        } else {
          res = "L";
        }
        opponentHistory.push({ round: r.number, result: res });
        break; // one game per round
      }
    }
  }
  // Fall back to player W/D/L counters when rounds aren't available yet
  const oppWins = opponent ? (opponentHistory.length > 0 ? opponentHistory.filter((h) => h.result === "W").length : opponent.wins) : 0;
  const oppDraws = opponent ? (opponentHistory.length > 0 ? opponentHistory.filter((h) => h.result === "D").length : opponent.draws) : 0;
  const oppLosses = opponent ? (opponentHistory.length > 0 ? opponentHistory.filter((h) => h.result === "L").length : opponent.losses) : 0;
  const oppPoints = opponent ? opponent.points : 0;
  // Tournament rank of opponent
  const oppRank = opponent ? myRank(opponent.username, players) : 0;
  // Pairing/tournament rating to display
  const oppRating = opponent ? (opponent.pairingRating ?? opponent.elo) : 0;

  // Compute the translateX: each panel is 100vw wide
  const translateX = -(tabIndex * 100) + (dragOffset / window.innerWidth) * 100;

  return (
    <div className={`min-h-screen ${bg} flex flex-col overflow-hidden`}>
      {/* Header */}
      <div className={`px-5 otb-header-safe pb-4 border-b ${divider}`}>
        <div className="flex items-center justify-between gap-3">
          <h1 className={`text-lg font-bold ${textMain} flex-1 leading-tight truncate`}>{tournamentName}</h1>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${accentBg} ${accent} flex-shrink-0 whitespace-nowrap`}>
            R{round}/{totalRounds}
          </span>
          <ConnectionBadge connected={connected} isDark={isDark} />
        </div>
      </div>
      {/* Tab bar */}
      <div className={`flex border-b ${divider} relative`}>
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => { setIsAnimating(true); setActiveTab(tab); setTimeout(() => setIsAnimating(false), 300); }}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${
              activeTab === tab
                ? `${accent} border-b-2 ${isDark ? "border-[#4CAF50]" : "border-[#436850]"}`
                : textMuted
            }`}
          >
            {tab === "board" ? "My Board" : tab === "standings" ? `Standings${rank > 0 ? ` (#${rank})` : ""}` : "Tools"}
          </button>
        ))}
      </div>
      {/* Swipe dot indicators */}
      <div className="flex justify-center gap-1.5 py-2">
        {TABS.map((tab, i) => (
          <button
            key={tab}
            onClick={() => { setIsAnimating(true); setActiveTab(tab); setTimeout(() => setIsAnimating(false), 300); }}
            className={`rounded-full transition-all duration-300 ${
              activeTab === tab
                ? `w-5 h-1.5 ${isDark ? "bg-[#4CAF50]" : "bg-[#436850]"}`
                : `w-1.5 h-1.5 ${isDark ? "bg-white/20" : "bg-[#ADBC9F]"}`
            }`}
            aria-label={`Go to ${tab} tab`}
          />
        ))}
      </div>
      {/* Sliding panel container */}
      <div
        className="flex-1 flex overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="flex flex-none w-full"
          style={{
            width: `${TABS.length * 100}%`,
            transform: `translateX(${translateX / TABS.length}%)`,
            transition: dragOffset === 0 ? "transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)" : "none",
          }}
        >
          {/* ── Board panel ── */}
          <div className="flex flex-col overflow-y-auto" style={{ width: `${100 / TABS.length}%` }}>
            {/* Board assignment */}
            <div className={`mx-4 mt-4 rounded-2xl ${accentBg} px-5 py-4`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-xs font-bold uppercase tracking-wider ${accent} mb-1`}>Your Assignment</p>
                  <p className={`text-3xl font-black ${textMain}`}>Board {game.board}</p>
                  <p className={`text-sm font-semibold mt-0.5 ${accent}`}>Playing as {colorLabel}</p>
                </div>
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-4xl ${
                  myColor === "black"
                    ? isDark ? "bg-white/05 text-[#12372A]" : "bg-[#12372A] text-white"
                    : isDark ? "bg-white/10 text-white" : "bg-white text-[#12372A]"
                }`}>
                  {myColor === "white" ? "♔" : "♚"}
                </div>
              </div>
            </div>
            {/* Timer banner */}
            <div className="mx-4 mt-3">
              <PlayerTimerBanner snap={timerSnapshot} isDark={isDark} />
            </div>
            {/* Opponent card */}
            <div className={`mx-4 mt-3 rounded-2xl ${cardBg} px-5 py-4`}>
              <p className={`text-xs font-bold uppercase tracking-wider ${accent} mb-3`}>Your Opponent</p>
              {opponent ? (
                <div>
                  {/* Top row: avatar + name + rating */}
                  <div className="flex items-center gap-4">
                    <PlayerAvatar
                      username={opponent.username}
                      name={opponent.name || opponent.username}
                      platform={opponent.platform ?? "chesscom"}
                      avatarUrl={opponent.avatarUrl}
                      size={56}
                      className="flex-shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className={`text-lg font-bold ${textMain} truncate`}>{opponent.name || opponent.username}</p>
                        {opponent.title && (
                          <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${isDark ? "bg-amber-500/15 text-amber-400" : "bg-amber-50 text-amber-700"} flex-shrink-0`}>{opponent.title}</span>
                        )}
                      </div>
                      <p className={`text-sm ${textMuted}`}>@{opponent.username}</p>
                      {/* Tournament rating + rank */}
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className={`text-sm font-semibold ${accent}`}>{oppRating} Rating</span>
                        {oppRank > 0 && (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${isDark ? "bg-white/08 text-white/60" : "bg-[#ADBC9F]/40 text-[#436850]"}`}>
                            #{oppRank} of {players.length}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Collapsible divider row — tap to show/hide stats */}
                  <button
                    onClick={() => setShowOppStats((v) => !v)}
                    aria-expanded={showOppStats}
                    aria-label={showOppStats ? "Hide opponent stats" : "Show opponent stats"}
                    className={`w-full flex items-center justify-between mt-3 pt-2.5 border-t ${divider} focus:outline-none active:opacity-70 transition-opacity`}
                  >
                    <span className={`text-xs font-semibold uppercase tracking-wider ${textMuted}`}>
                      {showOppStats ? "Stats" : `${oppPoints} pts · ${oppWins}W ${oppDraws}D ${oppLosses}L`}
                    </span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 ${textMuted} transition-transform duration-200 ${showOppStats ? "rotate-180" : "rotate-0"}`}
                    />
                  </button>

                  {/* Tournament record + form dots — collapsible */}
                  <div
                    className="overflow-hidden transition-all duration-200"
                    style={{ maxHeight: showOppStats ? "120px" : "0px", opacity: showOppStats ? 1 : 0 }}
                  >
                    <div className="flex items-center justify-between gap-3 pt-2.5">
                      {/* W / D / L record */}
                      <div className="flex items-center gap-3">
                        <div className="text-center">
                          <p className="text-base font-black text-emerald-500">{oppWins}</p>
                          <p className={`text-xs font-semibold uppercase tracking-wider ${textMuted}`}>W</p>
                        </div>
                        <div className={`w-px h-6 ${isDark ? "bg-white/10" : "bg-[#ADBC9F]"}`} />
                        <div className="text-center">
                          <p className={`text-base font-black ${isDark ? "text-blue-400" : "text-blue-500"}`}>{oppDraws}</p>
                          <p className={`text-xs font-semibold uppercase tracking-wider ${textMuted}`}>D</p>
                        </div>
                        <div className={`w-px h-6 ${isDark ? "bg-white/10" : "bg-[#ADBC9F]"}`} />
                        <div className="text-center">
                          <p className="text-base font-black text-red-500">{oppLosses}</p>
                          <p className={`text-xs font-semibold uppercase tracking-wider ${textMuted}`}>L</p>
                        </div>
                        <div className={`w-px h-6 ${isDark ? "bg-white/10" : "bg-[#ADBC9F]"}`} />
                        <div className="text-center">
                          <p className={`text-base font-black ${accent}`}>{oppPoints}</p>
                          <p className={`text-xs font-semibold uppercase tracking-wider ${textMuted}`}>pts</p>
                        </div>
                      </div>

                      {/* Recent form dots (last 4 rounds, most recent rightmost) */}
                      {opponentHistory.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <p className={`text-xs font-semibold uppercase tracking-wider ${textMuted} mr-0.5`}>Form</p>
                          {opponentHistory.slice(-4).map((h, i) => (
                            <span
                              key={i}
                              title={h.result === "W" ? `R${h.round}: Win` : h.result === "L" ? `R${h.round}: Loss` : `R${h.round}: Draw`}
                              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                              style={{
                                background: h.result === "W" ? "rgba(74,222,128,0.15)" : h.result === "L" ? "rgba(248,113,113,0.15)" : "rgba(96,165,250,0.15)",
                                color: h.result === "W" ? "#4ade80" : h.result === "L" ? "#f87171" : "#60a5fa",
                              }}
                            >
                              {h.result}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className={`w-14 h-14 rounded-full ${accentBg} flex items-center justify-center`}>
                    <Circle className={`w-6 h-6 ${accent}`} />
                  </div>
                  <div>
                    <p className={`text-base font-bold ${textMain}`}>Bye</p>
                    <p className={`text-sm ${textMuted}`}>You receive a half-point bye this round</p>
                  </div>
                </div>
              )}
            </div>
            {/* Post-game instruction */}
            <div className={`mx-4 mt-3 mb-4 pb-safe space-y-3`}>
              {opponent ? (
                <div className={`rounded-2xl px-5 py-4 text-center ${accentBg}`}>
                  <p className="text-2xl mb-2">🏁</p>
                  <p className={`text-sm font-bold ${accent} mb-1`}>Game finished?</p>
                  <p className={`text-sm ${textMuted}`}>
                    The winner should report the result to the director at the registration table.
                  </p>
                </div>
              ) : (
                <div className={`rounded-2xl px-5 py-4 text-center ${accentBg}`}>
                  <p className={`text-sm font-semibold ${accent}`}>
                    You have a bye this round — ½ point awarded automatically.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ── Standings panel ── */}
          <div className="overflow-y-auto px-4 py-4 pb-safe" style={{ width: `${100 / TABS.length}%` }}>
            <LiveStandingsPanel
              players={players}
              username={username}
              currentRound={round}
              totalRounds={totalRounds}
              isDark={isDark}
            />
          </div>

          {/* ── Tools panel ── */}
          <div className="overflow-y-auto px-4 py-4 pb-safe space-y-3" style={{ width: `${100 / TABS.length}%` }}>
            <p className={`text-xs font-bold uppercase tracking-wider ${accent} px-1 mb-1`}>Game Tools</p>
            {/* Chess Clock */}
            <a
              href={(() => {
                const p1 = myColor === "white" ? username : (opponent?.username ?? "");
                const p2 = myColor === "black" ? username : (opponent?.username ?? "");
                const base = `/tournament/${tournamentId}/clock?from=player&username=${encodeURIComponent(username)}`;
                if (!p1 || !p2) return base;
                return `${base}&p1=${encodeURIComponent(p1)}&p2=${encodeURIComponent(p2)}&myColor=${myColor}`;
              })()}
              className={`flex items-center justify-between rounded-2xl px-5 py-4 ${
                isDark ? "bg-white/05 hover:bg-white/08" : "bg-[#FBFADA]/70 hover:bg-[#ADBC9F]/50"
              } transition-colors`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  isDark ? "bg-[#4CAF50]/15" : "bg-[#436850]/08"
                }`}>
                  <Timer className={`w-5 h-5 ${accent}`} />
                </div>
                <div>
                  <p className={`text-sm font-bold ${textMain}`}>Chess Clock</p>
                  <p className={`text-xs ${textMuted}`}>Full-screen clock for your game</p>
                </div>
              </div>
              <svg className={`w-4 h-4 ${textMuted}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </a>
            {/* Watch Stream — visible only when broadcast is active */}
            {hasBroadcast && (
              <button
                onClick={() => setShowStreamSheet(true)}
                className={`w-full flex items-center justify-between rounded-2xl px-5 py-4 transition-colors ${
                  isDark ? "bg-white/05 hover:bg-white/08 active:bg-white/10" : "bg-[#FBFADA]/70 hover:bg-[#ADBC9F]/50 active:bg-[#ADBC9F]/70"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? "bg-[#4CAF50]/15" : "bg-[#436850]/08"}`}>
                    <MonitorPlay className={`w-5 h-5 ${accent}`} />
                  </div>
                  <div className="text-left">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm font-bold ${textMain}`}>Watch Stream</p>
                      {broadcast?.broadcastStatus === "live" && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-red-600">
                          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                          <span className="text-xs font-bold text-white uppercase tracking-wider">Live</span>
                        </span>
                      )}
                    </div>
                    <p className={`text-xs ${textMuted}`}>
                      {broadcast?.broadcastTitle || `Board ${broadcast?.featuredBoardNumber ?? 1} broadcast`}
                    </p>
                  </div>
                </div>
                <svg className={`w-4 h-4 ${textMuted}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
            )}
            {/* Film / Stream Game */}
            <button
              onClick={() => setShowFilmSheet(true)}
              className={`w-full flex items-center justify-between rounded-2xl px-5 py-4 transition-colors ${
                isDark ? "bg-white/05 hover:bg-white/08 active:bg-white/10" : "bg-[#FBFADA]/70 hover:bg-[#ADBC9F]/50 active:bg-[#ADBC9F]/70"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  isDark ? "bg-[#4CAF50]/15" : "bg-[#436850]/08"
                }`}>
                  <Video className={`w-5 h-5 ${accent}`} />
                </div>
                <div className="text-left">
                  <p className={`text-sm font-bold ${textMain}`}>Film / Stream</p>
                  <p className={`text-xs ${textMuted}`}>Record your board for streaming or content</p>
                </div>
              </div>
              <svg className={`w-4 h-4 ${textMuted}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
        </div>
      </div>

      {/* ── Film / Stream bottom sheet ── */}
      {showFilmSheet && (
        <FilmGameSheet
          onClose={() => setShowFilmSheet(false)}
          isDark={isDark}
          accent={accent}
          textMain={textMain}
          textMuted={textMuted}
          playerWhite={myColor === "white" ? (username || "White") : (opponent?.name || opponent?.username || "Black")}
          playerBlack={myColor === "black" ? (username || "Black") : (opponent?.name || opponent?.username || "White")}
          timerSnap={timerSnapshot}
        />
      )}

      {/* ── Watch Stream bottom sheet ── */}
      {showStreamSheet && hasBroadcast && (
        <div
          className="fixed inset-0 z-50 flex items-end"
          onClick={() => setShowStreamSheet(false)}
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div
            className={`relative w-full rounded-t-3xl border-t overflow-hidden ${
              isDark ? "bg-[oklch(0.18_0.06_145)] border-white/10" : "bg-white border-[#ADBC9F]"
            } animate-slide-up-fade safe-bottom`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className={`w-10 h-1 rounded-full ${isDark ? "bg-white/20" : "bg-[#ADBC9F]"}`} />
            </div>
            {/* Header */}
            <div className={`flex items-center justify-between px-5 py-3 border-b ${
              isDark ? "border-white/06" : "border-[#ADBC9F]/70"
            }`}>
              <div className="flex items-center gap-2">
                <MonitorPlay className={`w-4 h-4 ${accent}`} />
                <span className={`text-sm font-bold ${textMain}`}>
                  {broadcast!.broadcastTitle || `Board ${broadcast!.featuredBoardNumber ?? 1} Broadcast`}
                </span>
                {broadcast!.broadcastStatus === "live" && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-red-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">Live</span>
                  </span>
                )}
              </div>
              <button
                onClick={() => setShowStreamSheet(false)}
                className={`p-2 rounded-xl ${isDark ? "hover:bg-white/08" : "hover:bg-[#ADBC9F]/50"}`}
              >
                <X className={`w-4 h-4 ${textMuted}`} />
              </button>
            </div>
            {/* Embed */}
            <div className="px-4 py-4">
              <BoardBroadcastPlayer
                url={broadcast!.broadcastUrl!}
                title={broadcast!.broadcastTitle}
                status={broadcast!.broadcastStatus}
                tournamentName={tournamentName}
                isDark={isDark}
                metadata={{
                  boardNumber: broadcast!.featuredBoardNumber ?? 1,
                  roundNumber: round || undefined,
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main PlayerView Page ─────────────────────────────────────────────────────
export default function PlayerView() {
  const { id: tournamentId } = useParams<{ id: string }>();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const username = params.get("username") ?? "";
  const playerDisplayName = params.get("name") ?? "";
  const [, navigate] = useLocation();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [screen, setScreen] = useState<PlayerScreen>("lobby");
  const [livePayload, setLivePayload] = useState<LivePayload | null>(null);
  const [allRounds, setAllRounds] = useState<Round[]>([]);
  const [livePlayers, setLivePlayers] = useState<Player[]>([]);
  const [liveRound, setLiveRound] = useState(0);
  const [totalRounds, setTotalRounds] = useState(0);
  const [endedPayload, setEndedPayload] = useState<TournamentEndedPayload | null>(null);
  const [playerCount, setPlayerCount] = useState<number | null>(null);
  const [newRoundFlashLabel, setNewRoundFlashLabel] = useState("");
  const [connected, setConnected] = useState(false);
  const [timerSnapshot, setTimerSnapshot] = useState<{
    status: "idle" | "running" | "paused" | "expired";
    durationSec: number;
    startWallMs: number;
    elapsedAtPauseMs: number;
    savedAt: number;
  } | null>(null);

  const tournamentName =
    resolveTournament(tournamentId ?? "")?.name ?? "Tournament";
  const rejoinUrl =
    tournamentId && username
      ? `${window.location.origin}/tournament/${tournamentId}/play?username=${encodeURIComponent(username)}`
      : "";

  // Catch-up on mount: fetch timer snapshot
  useEffect(() => {
    if (!tournamentId || tournamentId === "otb-demo-2026") return;
    fetch(`/api/tournament/${encodeURIComponent(tournamentId)}/timer`)
      .then((r) => (r.ok ? r.json() : null))
      .then((snap) => { if (snap?.status) setTimerSnapshot(snap); })
      .catch(() => {});
  }, [tournamentId]);

  // ── Shared live-state applier — used by both initial fetch and polling fallback ──
  const applyLiveState = useCallback((data: {
    status: string; currentRound: number; totalRounds: number;
    players: Player[]; games: Game[]; rounds?: Round[];
    tournamentName?: string;
  }) => {
    const { status, currentRound, totalRounds: tr, players, games, rounds: fetchedRounds } = data;
    if (fetchedRounds?.length) setAllRounds(fetchedRounds);
    if (tr) setTotalRounds(tr);
    if (players?.length) setLivePlayers(players);
    if (status === "completed" && players?.length > 0) {
      setEndedPayload({ players, tournamentName: data.tournamentName ?? "Tournament" });
      setScreen("tournament_complete");
      return;
    }
    if ((status === "in_progress" || status === "paused") && currentRound > 0 && games?.length > 0) {
      setLivePayload({ round: currentRound, games, players, allRounds: fetchedRounds ?? [] });
      setLiveRound(currentRound);
      setScreen("my_board");
    }
  }, []);

  // Catch-up on mount: fetch live-state so reconnecting players see current state immediately
  useEffect(() => {
    if (!tournamentId || tournamentId === "otb-demo-2026") return;
    fetch(`/api/tournament/${encodeURIComponent(tournamentId)}/live-state`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data) applyLiveState(data); })
      .catch(() => { /* stay on lobby */ });
  }, [tournamentId, applyLiveState]);

  // Polling fallback — runs only while on the lobby screen.
  // Catches tournament_started events missed due to SSE disconnection or mobile backgrounding.
  // Polls every 5s; stops as soon as the screen transitions away from lobby.
  const screenRef = useRef("lobby");
  useEffect(() => { screenRef.current = screen; }, [screen]);
  useEffect(() => {
    if (!tournamentId || tournamentId === "otb-demo-2026") return;
    const poll = setInterval(() => {
      if (screenRef.current !== "lobby") { clearInterval(poll); return; }
      fetch(`/api/tournament/${encodeURIComponent(tournamentId)}/live-state`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => { if (data) applyLiveState(data); })
        .catch(() => {});
    }, 5_000);
    return () => clearInterval(poll);
  }, [tournamentId, applyLiveState]);

  // Persistent SSE connection with auto-reconnect — lives for the full player session
  useEffect(() => {
    if (!tournamentId) return;
    let es: EventSource;
    let retryDelay = 1_000;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let destroyed = false;

    function connect() {
      if (destroyed) return;
      es = new EventSource(
        `/api/tournament/${encodeURIComponent(tournamentId!)}/players/stream`
      );
      es.onopen = () => {
        setConnected(true);
        retryDelay = 1_000;
        // Catch-up fetch on every (re)connect — recovers events missed while disconnected
        fetch(`/api/tournament/${encodeURIComponent(tournamentId!)}/live-state`)
          .then((r) => (r.ok ? r.json() : null))
          .then((data) => { if (data) applyLiveState(data); })
          .catch(() => {});
      };
      es.onerror = () => {
        setConnected(false);
        es.close();
        if (!destroyed) {
          retryTimer = setTimeout(() => {
            retryDelay = Math.min(retryDelay * 2, 30_000);
            connect();
          }, retryDelay);
        }
      };

    es.addEventListener("player_joined", () => {
      setPlayerCount((c) => (c !== null ? c + 1 : 1));
    });

    es.addEventListener("tournament_started", (e: MessageEvent) => {
      try {
        const payload = JSON.parse(e.data) as LivePayload;
        setLivePayload(payload);
        setLivePlayers(payload.players);
        setLiveRound(payload.round);
        setScreen("my_board");
      } catch { /* ignore */ }
    });

    // Fires when director generates the next round — works from ALL screens
    es.addEventListener("round_started", (e: MessageEvent) => {
      try {
        const payload = JSON.parse(e.data) as LivePayload;
        setNewRoundFlashLabel(`Round ${payload.round} starting…`);
        setScreen("new_round_flash");
        setTimeout(() => {
          setLivePayload(payload);
          setLivePlayers(payload.players);
          setLiveRound(payload.round);
          setScreen("my_board");
        }, 1800);
      } catch { /* ignore */ }
    });

    // Fires whenever director enters a result (~1.5s after state save)
    es.addEventListener("standings_updated", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as StandingsPayload;
        if (data.players?.length) {
          setLivePlayers(data.players);
          // Keep livePayload.players in sync so the board tab shows updated data
          setLivePayload((prev) => prev ? { ...prev, players: data.players } : prev);
        }
      } catch { /* ignore */ }
    });

    es.addEventListener("timer_update", (e: MessageEvent) => {
      try {
        const snap = JSON.parse(e.data);
        setTimerSnapshot(snap);
      } catch { /* ignore */ }
    });

    es.addEventListener("tournament_ended", (e: MessageEvent) => {
      try {
        const payload = JSON.parse(e.data) as TournamentEndedPayload;
        setEndedPayload(payload);
        setScreen("tournament_complete");
        // Redirect to the shared final standings page after a brief transition
        setTimeout(() => navigate(`/tournament/${tournamentId}/results`), 1500);
      } catch { /* ignore */ }
    });

      return es;
    }

    connect();
    return () => {
      destroyed = true;
      if (retryTimer) clearTimeout(retryTimer);
      es?.close();
    };
  }, [tournamentId, navigate, applyLiveState]);

  // ── Guard ─────────────────────────────────────────────────────────────────
  if (!tournamentId || !username) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center">
        <div className="space-y-3">
          <p className="text-lg font-bold text-[#12372A]">Missing tournament or username.</p>
          <Link href="/join" className="text-sm text-[#436850] underline">Go back to Join</Link>
        </div>
      </div>
    );
  }

  // ── Screens ───────────────────────────────────────────────────────────────
  if (screen === "tournament_complete" && endedPayload) {
    return (
      <TournamentCompleteScreen
        tournamentId={tournamentId}
        tournamentName={endedPayload.tournamentName || tournamentName}
        username={username}
        playerDisplayName={playerDisplayName}
        players={endedPayload.players}
        isDark={isDark}
        clubId={resolveTournament(tournamentId ?? "")?.clubId}
        clubName={resolveTournament(tournamentId ?? "")?.clubName}
      />
    );
  }

  if (screen === "new_round_flash") {
    const bg = isDark ? "bg-[#0d1f12]" : "bg-white";
    const accent = isDark ? "text-[#4CAF50]" : "text-[#436850]";
    const accentBg = isDark ? "bg-[#4CAF50]/10" : "bg-[#436850]/08";
    return (
      <div className={`min-h-screen ${bg} flex flex-col items-center justify-center px-6 gap-6 text-center`}>
        <div className="relative flex items-center justify-center">
          <div className={`absolute w-40 h-40 rounded-full ${accentBg} animate-ping opacity-40`} />
          <div className={`absolute w-28 h-28 rounded-full ${accentBg} animate-ping opacity-60`} style={{ animationDelay: "0.2s" }} />
          <div className={`relative w-24 h-24 rounded-full ${accentBg} flex items-center justify-center`}>
            <Swords className={`w-12 h-12 ${accent}`} />
          </div>
        </div>
        <div className="space-y-2">
          <h2 className={`text-3xl font-black ${isDark ? "text-white" : "text-[#12372A]"}`}>New Round!</h2>
          <p className={`text-base font-semibold ${accent}`}>{newRoundFlashLabel}</p>
          <p className={`text-sm ${isDark ? "text-white/65" : "text-[#436850]"}`}>Finding your board assignment…</p>
        </div>
      </div>
    );
  }

  if (screen === "waiting_round") {
    return (
      <WaitingRoundScreen
        tournamentId={tournamentId}
        tournamentName={tournamentName}
        username={username}
        round={liveRound}
        totalRounds={totalRounds}
        players={livePlayers}
        isDark={isDark}
        connected={connected}
      />
    );
  }

  if (screen === "lobby") {
    return (
      <LobbyScreen
        tournamentId={tournamentId}
        tournamentName={tournamentName}
        username={username}
        isDark={isDark}
        playerCount={playerCount}
        onPlayerCountChange={setPlayerCount}
        rejoinUrl={rejoinUrl}
        connected={connected}
        onRefresh={async () => {
          const data = await fetch(`/api/tournament/${encodeURIComponent(tournamentId!)}/live-state`)
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null);
          if (data) applyLiveState(data);
        }}
      />
    );
  }

  if (screen === "my_board" && livePayload) {
    const boardInfo = findMyBoard(username, livePayload.games, livePayload.players);
    if (!boardInfo) {
      const bg = isDark ? "bg-[#0d1f12]" : "bg-white";
      return (
        <div className={`min-h-screen ${bg} flex flex-col items-center justify-center px-6 gap-4 text-center`}>
          <RotateCcw className={`w-10 h-10 ${isDark ? "text-white/30" : "text-[#436850]/70"}`} />
          <p className={`text-lg font-bold ${isDark ? "text-white" : "text-[#12372A]"}`}>You're not in the pairings yet.</p>
          <p className={`text-sm ${isDark ? "text-white/65" : "text-[#436850]"}`}>Ask the director to check your registration.</p>
          <Link href={`/tournament/${tournamentId}`} className="text-sm text-[#436850] underline">View standings</Link>
        </div>
      );
    }
    return (
      <MyBoardScreen
        tournamentId={tournamentId}
        tournamentName={tournamentName}
        username={username}
        round={livePayload.round}
        totalRounds={totalRounds}
        game={boardInfo.game}
        myColor={boardInfo.myColor}
        opponent={boardInfo.opponent}
        players={livePlayers.length > 0 ? livePlayers : livePayload.players}
        allRounds={allRounds.length > 0 ? allRounds : (livePayload.allRounds ?? [])}
        isDark={isDark}
        rejoinUrl={rejoinUrl}
        connected={connected}
        timerSnapshot={timerSnapshot}
      />
    );
  }

  return null;
}
