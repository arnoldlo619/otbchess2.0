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
import { useEffect, useState, useCallback } from "react";
import { useParams, useSearch } from "wouter";
import { Link } from "wouter";
import { QRCodeSVG } from "qrcode.react";
import {
  Trophy,
  Swords,
  Clock,
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
  BellOff,
  X,
} from "lucide-react";
import { usePushSubscription } from "@/hooks/usePushSubscription";
import { useTheme } from "@/contexts/ThemeContext";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { resolveTournament } from "@/lib/tournamentRegistry";
import type { Game, Player } from "@/lib/tournamentData";
import { getStandings } from "@/lib/tournamentData";
import { TournamentCompleteScreen } from "./TournamentCompleteScreen";

// ─── Types ────────────────────────────────────────────────────────────────────
interface LivePayload {
  round: number;
  games: Game[];
  players: Player[];
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
  const textMain = isDark ? "text-white" : "text-gray-900";
  const textMuted = isDark ? "text-white/50" : "text-gray-500";
  const accent = isDark ? "text-[#4CAF50]" : "text-[#3D6B47]";

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
                  ? "bg-[#3D6B47]/30 border border-[#4CAF50]/40"
                  : "bg-[#3D6B47]/08 border border-[#3D6B47]/25"
                : i < 3
                ? isDark ? "bg-white/04" : "bg-gray-50"
                : ""
            }`}
          >
            <span className="text-base w-7 text-center flex-shrink-0">
              {i < 3
                ? medals[i]
                : <span className={`text-sm font-bold ${isDark ? "text-white/30" : "text-gray-300"}`}>{i + 1}</span>
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
                  <span className="text-xs font-bold text-[#3D6B47] bg-[#3D6B47]/10 px-1 py-0.5 rounded flex-shrink-0">
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
  const textMuted = isDark ? "text-white/40" : "text-gray-400";
  const cardBg = isDark ? "bg-[#1a2e1e]" : "bg-gray-50";
  const accent = isDark ? "text-[#4CAF50]" : "text-[#3D6B47]";
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
        <div className={`p-2 rounded-xl ${isDark ? "bg-white" : "bg-white border border-gray-100"}`}>
          <QRCodeSVG value={rejoinUrl} size={96} bgColor="#ffffff" fgColor="#1a2e1e" level="M" />
        </div>
      </div>
      <button
        onClick={handleCopy}
        className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold transition-all active:scale-95 ${
          isDark ? "bg-white/08 hover:bg-white/12 text-white/70" : "bg-gray-100 hover:bg-gray-200 text-gray-600"
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
  tournamentId, isDark,
}: {
  tournamentId: string; isDark: boolean;
}) {
  const { status, subscribe, isLoading } = usePushSubscription({ tournamentId });
  const [dismissed, setDismissed] = useState(false);

  // Don't show if already subscribed, denied, dismissed, or browser doesn't support push
  if (dismissed || status === "subscribed" || status === "denied") return null;
  if (typeof window !== "undefined" && !("PushManager" in window)) return null;

  const cardBg = isDark
    ? "bg-[#1a2e1e] border border-[#4CAF50]/20"
    : "bg-emerald-50 border border-emerald-200";
  const accent = isDark ? "text-[#4CAF50]" : "text-[#3D6B47]";
  const textMain = isDark ? "text-white" : "text-gray-900";
  const textMuted = isDark ? "text-white/60" : "text-gray-500";

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
              : "bg-[#3D6B47] text-white hover:bg-[#2d5237] disabled:opacity-50"
          }`}
        >
          {isLoading ? "Enabling…" : "Enable Notifications"}
        </button>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className={`flex-shrink-0 p-1 rounded-lg transition-colors ${
          isDark ? "text-white/30 hover:text-white/60 hover:bg-white/08" : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
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
  playerCount, onPlayerCountChange, rejoinUrl, connected,
}: {
  tournamentName: string; username: string; isDark: boolean; tournamentId: string;
  playerCount: number | null; onPlayerCountChange: (n: number) => void;
  rejoinUrl: string; connected: boolean;
}) {
  const [dots, setDots] = useState(".");
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

  const bg = isDark ? "bg-[#0d1f12]" : "bg-white";
  const textMain = isDark ? "text-white" : "text-gray-900";
  const textMuted = isDark ? "text-white/50" : "text-gray-500";
  const cardBg = isDark ? "bg-[#1a2e1e]" : "bg-gray-50";
  const accent = isDark ? "text-[#4CAF50]" : "text-[#3D6B47]";
  const accentBg = isDark ? "bg-[#4CAF50]/10" : "bg-[#3D6B47]/08";

  return (
    <div className={`min-h-screen ${bg} flex flex-col`}>
      <div className={`px-5 pt-safe-top pt-6 pb-4 border-b ${isDark ? "border-white/08" : "border-gray-100"}`}>
        <div className="flex items-center justify-between mb-1">
          <span className={`text-xs font-bold uppercase tracking-widest ${accent}`}>OTB Chess</span>
          <ConnectionBadge connected={connected} isDark={isDark} />
        </div>
        <h1 className={`text-lg font-bold leading-tight ${textMain} truncate`}>{tournamentName}</h1>
      </div>
      <PushPromptCard tournamentId={tournamentId} isDark={isDark} />
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 gap-8">
        <div className="relative flex items-center justify-center">
          <div className={`absolute w-32 h-32 rounded-full ${accentBg} animate-ping opacity-30`} />
          <div className={`absolute w-24 h-24 rounded-full ${accentBg} animate-ping opacity-50`} style={{ animationDelay: "0.3s" }} />
          <div className={`relative w-20 h-20 rounded-full ${accentBg} flex items-center justify-center`}>
            <Crown className={`w-10 h-10 ${accent}`} />
          </div>
        </div>
        <div className="text-center space-y-2">
          <h2 className={`text-2xl font-bold ${textMain}`}>Waiting for tournament to start{dots}</h2>
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
            { icon: Trophy, text: "Play your game, then report the result" },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-3">
              <Icon className={`w-4 h-4 flex-shrink-0 ${accent}`} />
              <p className={`text-sm ${textMuted}`}>{text}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="px-6 pb-safe-bottom pb-8">
        <RejoinLinkCard rejoinUrl={rejoinUrl} isDark={isDark} />
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
  const textMain = isDark ? "text-white" : "text-gray-900";
  const textMuted = isDark ? "text-white/50" : "text-gray-500";
  const accent = isDark ? "text-[#4CAF50]" : "text-[#3D6B47]";
  const accentBg = isDark ? "bg-[#4CAF50]/10" : "bg-[#3D6B47]/08";
  const rank = myRank(username, players);
  const myScore = getStandings(players).find(
    (p) => p.username.toLowerCase() === username.toLowerCase()
  )?.points ?? 0;

  return (
    <div className={`min-h-screen ${bg} flex flex-col`}>
      <div className={`px-5 pt-safe-top pt-6 pb-4 border-b ${isDark ? "border-white/08" : "border-gray-100"}`}>
        <div className="flex items-center justify-between mb-1">
          <span className={`text-xs font-bold uppercase tracking-widest ${accent}`}>OTB Chess</span>
          <ConnectionBadge connected={connected} isDark={isDark} />
        </div>
        <h1 className={`text-lg font-bold leading-tight ${textMain} truncate`}>{tournamentName}</h1>
      </div>
      <div className={`mx-4 mt-4 rounded-2xl ${accentBg} px-5 py-4 flex items-center gap-4`}>
        <div className={`w-10 h-10 rounded-full ${isDark ? "bg-[#4CAF50]/20" : "bg-[#3D6B47]/12"} flex items-center justify-center flex-shrink-0`}>
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
      <PushPromptCard tournamentId={tournamentId} isDark={isDark} />
      {rank > 0 && (
        <div className={`mx-4 mt-3 rounded-2xl ${isDark ? "bg-[#1a2e1e]" : "bg-gray-50"} px-5 py-4`}>
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
      <div className={`mx-4 mt-3 mb-6 rounded-2xl ${isDark ? "bg-[#1a2e1e]" : "bg-gray-50"} px-4 py-4 flex-1 overflow-y-auto`}>
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
    // running
    const calc = () => {
      const elapsed = Math.round((Date.now() - snap.startWallMs + snap.elapsedAtPauseMs) / 1000);
      setRemaining(Math.max(0, snap.durationSec - elapsed));
    };
    calc();
    const t = setInterval(calc, 1000);
    return () => clearInterval(t);
  }, [snap]);

  if (!snap || snap.status === "idle") return null;

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const display = `${mins}:${secs.toString().padStart(2, "0")}`;
  const isLow = remaining > 0 && remaining <= 60;
  const isExpired = snap.status === "expired" || remaining === 0;
  const isPaused = snap.status === "paused";

  const bg = isExpired
    ? isDark ? "bg-red-500/15 border border-red-500/30" : "bg-red-50 border border-red-200"
    : isLow
    ? isDark ? "bg-amber-500/15 border border-amber-500/30" : "bg-amber-50 border border-amber-200"
    : isDark ? "bg-[#1a2e1e] border border-[#4CAF50]/20" : "bg-emerald-50 border border-emerald-200";
  const textColor = isExpired
    ? isDark ? "text-red-400" : "text-red-600"
    : isLow
    ? isDark ? "text-amber-400" : "text-amber-700"
    : isDark ? "text-[#4CAF50]" : "text-[#3D6B47]";

  return (
    <div className={`mx-4 mt-3 rounded-2xl px-4 py-3 flex items-center gap-3 ${bg}`}>
      <Clock className={`w-4 h-4 flex-shrink-0 ${textColor}`} />
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-bold uppercase tracking-wider ${textColor}`}>
          {isExpired ? "Time's Up" : isPaused ? "Round Timer — Paused" : "Round Timer"}
        </p>
        <p className={`text-2xl font-black font-mono leading-tight ${textColor} ${isLow && !isExpired && !isPaused ? "animate-pulse" : ""}`}>
          {isExpired ? "0:00" : display}
        </p>
      </div>
      {isPaused && (
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${isDark ? "bg-white/10 text-white/50" : "bg-gray-100 text-gray-500"}`}>Paused</span>
      )}
    </div>
  );
}

function MyBoardScreen({
  tournamentId, tournamentName, username, round, totalRounds, game, myColor,
  opponent, players, isDark, rejoinUrl, connected, timerSnapshot,
}: {
  tournamentId: string; tournamentName: string; username: string;
  round: number; totalRounds: number; game: Game; myColor: "white" | "black";
  opponent: Player | undefined; players: Player[]; isDark: boolean;
  rejoinUrl: string; connected: boolean; timerSnapshot: TimerSnap;
}) {
  const [activeTab, setActiveTab] = useState<"board" | "standings">("board");

  const textMain = isDark ? "text-white" : "text-gray-900";
  const textMuted = isDark ? "text-white/50" : "text-gray-500";
  const cardBg = isDark ? "bg-[#1a2e1e]" : "bg-gray-50";
  const accent = isDark ? "text-[#4CAF50]" : "text-[#3D6B47]";
  const accentBg = isDark ? "bg-[#4CAF50]/10" : "bg-[#3D6B47]/08";
  const divider = isDark ? "border-white/08" : "border-gray-100";
  const bg = isDark ? "bg-[#0d1f12]" : "bg-white";
  const colorLabel = myColor === "white" ? "White ♔" : "Black ♚";
  const rank = myRank(username, players);

  return (
    <div className={`min-h-screen ${bg} flex flex-col`}>
      {/* Header */}
      <div className={`px-5 pt-safe-top pt-5 pb-3 border-b ${divider}`}>
        <div className="flex items-center justify-between mb-0.5">
          <span className={`text-xs font-bold uppercase tracking-widest ${accent}`}>OTB Chess</span>
          <ConnectionBadge connected={connected} isDark={isDark} />
        </div>
        <div className="flex items-center justify-between">
          <h1 className={`text-base font-bold ${textMain} truncate flex-1 mr-2`}>{tournamentName}</h1>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${accentBg} ${accent} flex-shrink-0`}>
            R{round}/{totalRounds}
          </span>
        </div>
      </div>

      {/* Tab bar */}
      <div className={`flex border-b ${divider}`}>
        {(["board", "standings"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${
              activeTab === tab
                ? `${accent} border-b-2 ${isDark ? "border-[#4CAF50]" : "border-[#3D6B47]"}`
                : textMuted
            }`}
          >
            {tab === "board" ? "My Board" : `Standings${rank > 0 ? ` (#${rank})` : ""}`}
          </button>
        ))}
      </div>

      {/* Board tab */}
      {activeTab === "board" && (
        <div className="flex-1 flex flex-col overflow-y-auto">
          {/* Board assignment */}
          <div className={`mx-4 mt-4 rounded-2xl ${accentBg} px-5 py-4`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-xs font-bold uppercase tracking-wider ${accent} mb-1`}>Your Assignment</p>
                <p className={`text-3xl font-black ${textMain}`}>Board {game.board}</p>
                <p className={`text-sm font-semibold mt-0.5 ${accent}`}>Playing as {colorLabel}</p>
              </div>
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-4xl ${
                myColor === "white"
                  ? isDark ? "bg-white/90" : "bg-white border-2 border-gray-200"
                  : isDark ? "bg-[#1a1a1a]" : "bg-gray-800"
              }`}>
                {myColor === "white" ? "♔" : "♚"}
              </div>
            </div>
          </div>

          {/* Timer banner */}
          <PlayerTimerBanner snap={timerSnapshot} isDark={isDark} />

          {/* Opponent card */}
          <div className={`mx-4 mt-3 rounded-2xl ${cardBg} px-5 py-4`}>
            <p className={`text-xs font-bold uppercase tracking-wider ${accent} mb-3`}>Your Opponent</p>
            {opponent ? (
              <div className="flex items-center gap-4">
                <PlayerAvatar
                  username={opponent.username}
                  name={opponent.name || opponent.username}
                  platform={opponent.platform ?? "chesscom"}
                  avatarUrl={opponent.avatarUrl}
                  size={56}
                  className="flex-shrink-0"
                />
                <div className="min-w-0">
                  <p className={`text-lg font-bold ${textMain} truncate`}>{opponent.name || opponent.username}</p>
                  <p className={`text-sm ${textMuted}`}>@{opponent.username}</p>
                  <p className={`text-sm font-semibold mt-0.5 ${accent}`}>{opponent.elo} ELO</p>
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

          <div className="flex-1" />

          {/* Post-game instruction */}
          <div className={`px-4 pb-safe-bottom pb-6 pt-4 border-t ${divider} space-y-3`}>
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
            <RejoinLinkCard rejoinUrl={rejoinUrl} isDark={isDark} />
          </div>
        </div>
      )}

      {/* Standings tab */}
      {activeTab === "standings" && (
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <LiveStandingsPanel
            players={players}
            username={username}
            currentRound={round}
            totalRounds={totalRounds}
            isDark={isDark}
          />
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
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [screen, setScreen] = useState<PlayerScreen>("lobby");
  const [livePayload, setLivePayload] = useState<LivePayload | null>(null);
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

  // Catch-up on mount: fetch live-state so reconnecting players see current state immediately
  useEffect(() => {
    if (!tournamentId || tournamentId === "otb-demo-2026") return;
    fetch(`/api/tournament/${encodeURIComponent(tournamentId)}/live-state`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        const { status, currentRound, totalRounds: tr, players, games } = data as {
          status: string; currentRound: number; totalRounds: number;
          players: Player[]; games: Game[];
        };
        if (tr) setTotalRounds(tr);
        if (players?.length) setLivePlayers(players);
        if (status === "completed" && players?.length > 0) {
          setEndedPayload({ players, tournamentName: data.tournamentName ?? "Tournament" });
          setScreen("tournament_complete");
          return;
        }
        if ((status === "in_progress" || status === "paused") && currentRound > 0 && games?.length > 0) {
          setLivePayload({ round: currentRound, games, players });
          setLiveRound(currentRound);
          setScreen("my_board");
        }
      })
      .catch(() => { /* stay on lobby */ });
  }, [tournamentId]);

  // Persistent SSE connection — lives for the full player session across all screens
  useEffect(() => {
    if (!tournamentId) return;
    const es = new EventSource(
      `/api/tournament/${encodeURIComponent(tournamentId)}/players/stream`
    );
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);

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
      } catch { /* ignore */ }
    });

    return () => es.close();
  }, [tournamentId]);

  // ── Guard ─────────────────────────────────────────────────────────────────
  if (!tournamentId || !username) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center">
        <div className="space-y-3">
          <p className="text-lg font-bold text-gray-900">Missing tournament or username.</p>
          <Link href="/join" className="text-sm text-[#3D6B47] underline">Go back to Join</Link>
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
        players={endedPayload.players}
        isDark={isDark}
      />
    );
  }

  if (screen === "new_round_flash") {
    const bg = isDark ? "bg-[#0d1f12]" : "bg-white";
    const accent = isDark ? "text-[#4CAF50]" : "text-[#3D6B47]";
    const accentBg = isDark ? "bg-[#4CAF50]/10" : "bg-[#3D6B47]/08";
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
          <h2 className={`text-3xl font-black ${isDark ? "text-white" : "text-gray-900"}`}>New Round!</h2>
          <p className={`text-base font-semibold ${accent}`}>{newRoundFlashLabel}</p>
          <p className={`text-sm ${isDark ? "text-white/50" : "text-gray-500"}`}>Finding your board assignment…</p>
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
      />
    );
  }

  if (screen === "my_board" && livePayload) {
    const boardInfo = findMyBoard(username, livePayload.games, livePayload.players);
    if (!boardInfo) {
      const bg = isDark ? "bg-[#0d1f12]" : "bg-white";
      return (
        <div className={`min-h-screen ${bg} flex flex-col items-center justify-center px-6 gap-4 text-center`}>
          <RotateCcw className={`w-10 h-10 ${isDark ? "text-white/30" : "text-gray-300"}`} />
          <p className={`text-lg font-bold ${isDark ? "text-white" : "text-gray-900"}`}>You're not in the pairings yet.</p>
          <p className={`text-sm ${isDark ? "text-white/50" : "text-gray-500"}`}>Ask the director to check your registration.</p>
          <Link href={`/tournament/${tournamentId}`} className="text-sm text-[#3D6B47] underline">View standings</Link>
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
        isDark={isDark}
        rejoinUrl={rejoinUrl}
        connected={connected}
        timerSnapshot={timerSnapshot}
      />
    );
  }

  return null;
}
