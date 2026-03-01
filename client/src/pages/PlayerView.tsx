/**
 * PlayerView — /tournament/:id/play?username=xxx
 *
 * The mobile-first player experience after joining a tournament.
 * Two internal screens:
 *   1. Lobby — animated waiting screen while the tournament hasn't started yet.
 *              Opens an SSE stream and transitions to MyBoard on tournament_started.
 *   2. MyBoard — shows the player's board number, color, opponent, and result buttons.
 *               After result submission, shows a confirmation + standings link.
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useSearch } from "wouter";
import { Link } from "wouter";
import {
  Trophy,
  Swords,
  Clock,
  CheckCircle2,
  Users,
  ChevronRight,
  Loader2,
  RotateCcw,
  Crown,
  Circle,
} from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { resolveTournament } from "@/lib/tournamentRegistry";
import type { Game, Player } from "@/lib/tournamentData";
import { TournamentCompleteScreen } from "./TournamentCompleteScreen";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TournamentStartedPayload {
  round: number;
  games: Game[];
  players: Player[];
}

interface TournamentEndedPayload {
  players: Player[];
  tournamentName: string;
}

type PlayerScreen = "lobby" | "my_board" | "result_submitted" | "new_round_flash" | "tournament_complete";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Find the game this player is involved in for the current round. */
export function findMyBoard(
  username: string,
  games: Game[],
  players: Player[]
): {
  game: Game;
  myColor: "white" | "black";
  opponent: Player | undefined;
} | null {
  const me = players.find(
    (p) => p.username.toLowerCase() === username.toLowerCase()
  );
  if (!me) return null;

  const game = games.find(
    (g) => g.whiteId === me.id || g.blackId === me.id
  );
  if (!game) return null;

  const myColor = game.whiteId === me.id ? "white" : "black";
  const opponentId = myColor === "white" ? game.blackId : game.whiteId;
  const opponent = players.find((p) => p.id === opponentId);

  return { game, myColor, opponent };
}

// ─── Lobby Screen ─────────────────────────────────────────────────────────────

interface LobbyProps {
  tournamentName: string;
  username: string;
  isDark: boolean;
  tournamentId: string;
  playerCount: number | null;
  onPlayerCountChange: (count: number) => void;
}

function LobbyScreen({
  tournamentName,
  username,
  isDark,
  tournamentId,
  playerCount,
  onPlayerCountChange,
}: LobbyProps) {
  const [dots, setDots] = useState(".");

  // Animate the waiting dots
  useEffect(() => {
    const t = setInterval(
      () => setDots((d) => (d.length >= 3 ? "." : d + ".")),
      600
    );
    return () => clearInterval(t);
  }, []);

  // Fetch initial player count on mount
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
      {/* Header */}
      <div className={`px-5 pt-safe-top pt-6 pb-4 border-b ${isDark ? "border-white/08" : "border-gray-100"}`}>
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-xs font-bold uppercase tracking-widest ${accent}`}>
            OTB Chess
          </span>
        </div>
        <h1 className={`text-lg font-bold leading-tight ${textMain} truncate`}>
          {tournamentName}
        </h1>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 gap-8">
        {/* Animated chess piece */}
        <div className="relative flex items-center justify-center">
          {/* Pulsing rings */}
          <div className={`absolute w-32 h-32 rounded-full ${accentBg} animate-ping opacity-30`} />
          <div className={`absolute w-24 h-24 rounded-full ${accentBg} animate-ping opacity-50`}
            style={{ animationDelay: "0.3s" }} />
          {/* Chess king icon */}
          <div className={`relative w-20 h-20 rounded-full ${accentBg} flex items-center justify-center`}>
            <Crown className={`w-10 h-10 ${accent}`} />
          </div>
        </div>

        {/* Status text */}
        <div className="text-center space-y-2">
          <h2 className={`text-2xl font-bold ${textMain}`}>
            Waiting for tournament to start{dots}
          </h2>
          <p className={`text-sm ${textMuted}`}>
            You're registered as <span className={`font-semibold ${accent}`}>@{username}</span>
          </p>
        </div>

        {/* Player count card */}
        {playerCount !== null && (
          <div className={`w-full max-w-xs rounded-2xl px-5 py-4 ${cardBg} flex items-center gap-4`}>
            <div className={`w-10 h-10 rounded-xl ${accentBg} flex items-center justify-center flex-shrink-0`}>
              <Users className={`w-5 h-5 ${accent}`} />
            </div>
            <div>
              <p className={`text-xl font-bold ${textMain}`}>{playerCount}</p>
              <p className={`text-xs ${textMuted}`}>
                {playerCount === 1 ? "player registered" : "players registered"}
              </p>
            </div>
          </div>
        )}

        {/* What to expect */}
        <div className={`w-full max-w-xs rounded-2xl px-5 py-4 ${cardBg} space-y-3`}>
          <p className={`text-xs font-bold uppercase tracking-wider ${accent}`}>
            What happens next
          </p>
          {[
            { icon: Swords, text: "Director pairs players by ELO" },
            { icon: Clock, text: "You'll see your board & opponent here" },
            { icon: CheckCircle2, text: "Play your game, then report the result" },
          ].map(({ icon: Icon, text }, i) => (
            <div key={i} className="flex items-center gap-3">
              <Icon className={`w-4 h-4 flex-shrink-0 ${accent}`} />
              <span className={`text-sm ${textMuted}`}>{text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom branding */}
      <div className={`px-5 pb-safe-bottom pb-6 text-center`}>
        <p className={`text-xs ${textMuted}`}>Keep this screen open — it will update automatically</p>
      </div>
    </div>
  );
}

// ─── My Board Screen ──────────────────────────────────────────────────────────

interface MyBoardProps {
  tournamentId: string;
  tournamentName: string;
  username: string;
  round: number;
  game: Game;
  myColor: "white" | "black";
  opponent: Player | undefined;
  isDark: boolean;
  onResultSubmitted: () => void;
}

type ResultOption = "1-0" | "0-1" | "½-½";

function MyBoardScreen({
  tournamentId,
  tournamentName,
  username,
  round,
  game,
  myColor,
  opponent,
  isDark,
  onResultSubmitted,
}: MyBoardProps) {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<ResultOption | null>(null);
  const [error, setError] = useState("");

  const textMain = isDark ? "text-white" : "text-gray-900";
  const textMuted = isDark ? "text-white/50" : "text-gray-500";
  const cardBg = isDark ? "bg-[#1a2e1e]" : "bg-gray-50";
  const accent = isDark ? "text-[#4CAF50]" : "text-[#3D6B47]";
  const accentBg = isDark ? "bg-[#4CAF50]/10" : "bg-[#3D6B47]/08";
  const divider = isDark ? "border-white/08" : "border-gray-100";
  const bg = isDark ? "bg-[#0d1f12]" : "bg-white";

  const submitResult = useCallback(
    async (result: ResultOption) => {
      setSubmitting(true);
      setError("");
      try {
        const res = await fetch(
          `/api/tournament/${encodeURIComponent(tournamentId)}/result`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              gameId: game.id,
              result,
              submittedBy: username,
            }),
          }
        );
        if (!res.ok) throw new Error("Server error");
        setSubmitted(result);
        onResultSubmitted();
      } catch {
        setError("Failed to submit result. Please try again.");
      } finally {
        setSubmitting(false);
      }
    },
    [tournamentId, game.id, username, onResultSubmitted]
  );

  const resultLabel = (r: ResultOption) => {
    if (r === "1-0") return myColor === "white" ? "I Won" : "I Lost";
    if (r === "0-1") return myColor === "black" ? "I Won" : "I Lost";
    return "Draw";
  };

  const resultIcon = (r: ResultOption) => {
    if (r === "1-0") return myColor === "white" ? "🏆" : "❌";
    if (r === "0-1") return myColor === "black" ? "🏆" : "❌";
    return "🤝";
  };

  const colorLabel = myColor === "white" ? "White" : "Black";
  const colorDot = myColor === "white"
    ? "bg-white border-2 border-gray-300"
    : "bg-gray-900 border-2 border-gray-600";

  if (submitted) {
    return (
      <div className={`min-h-screen ${bg} flex flex-col`}>
        {/* Header */}
        <div className={`px-5 pt-safe-top pt-6 pb-4 border-b ${divider}`}>
          <span className={`text-xs font-bold uppercase tracking-widest ${accent}`}>OTB Chess</span>
          <h1 className={`text-lg font-bold ${textMain} truncate mt-1`}>{tournamentName}</h1>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 gap-6 text-center">
          <div className={`w-20 h-20 rounded-full ${accentBg} flex items-center justify-center text-4xl`}>
            {resultIcon(submitted)}
          </div>
          <div className="space-y-2">
            <h2 className={`text-2xl font-bold ${textMain}`}>Result submitted!</h2>
            <p className={`text-sm ${textMuted}`}>
              The director will confirm your result on the dashboard.
            </p>
          </div>

          <div className={`w-full max-w-xs rounded-2xl px-5 py-4 ${cardBg} text-left space-y-2`}>
            <p className={`text-xs font-bold uppercase tracking-wider ${accent}`}>Your result</p>
            <p className={`text-base font-semibold ${textMain}`}>
              {resultLabel(submitted)} — {submitted}
            </p>
            <p className={`text-xs ${textMuted}`}>
              Board {game.board} · Round {round} · vs {opponent?.name ?? opponent?.username ?? "Opponent"}
            </p>
          </div>

          <Link
            href={`/tournament/${tournamentId}`}
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-semibold text-sm ${
              isDark
                ? "bg-[#3D6B47] text-white"
                : "bg-[#3D6B47] text-white"
            }`}
          >
            <Trophy className="w-4 h-4" />
            View Live Standings
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${bg} flex flex-col`}>
      {/* Header */}
      <div className={`px-5 pt-safe-top pt-6 pb-4 border-b ${divider}`}>
        <div className="flex items-center justify-between">
          <span className={`text-xs font-bold uppercase tracking-widest ${accent}`}>OTB Chess</span>
          <span className={`text-xs font-bold px-2 py-1 rounded-full ${accentBg} ${accent}`}>
            Round {round}
          </span>
        </div>
        <h1 className={`text-lg font-bold ${textMain} truncate mt-1`}>{tournamentName}</h1>
      </div>

      {/* Board assignment hero */}
      <div className={`mx-4 mt-4 rounded-2xl ${accentBg} px-5 py-5`}>
        <p className={`text-xs font-bold uppercase tracking-wider ${accent} mb-1`}>Your Assignment</p>
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl font-black ${
            isDark ? "bg-[#4CAF50]/20 text-[#4CAF50]" : "bg-[#3D6B47]/15 text-[#3D6B47]"
          }`}>
            {game.board}
          </div>
          <div>
            <p className={`text-2xl font-black ${textMain}`}>Board {game.board}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className={`w-3 h-3 rounded-full ${colorDot}`} />
              <p className={`text-sm font-semibold ${textMuted}`}>Playing as {colorLabel}</p>
            </div>
          </div>
        </div>
      </div>

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
              <p className={`text-lg font-bold ${textMain} truncate`}>
                {opponent.name || opponent.username}
              </p>
              <p className={`text-sm ${textMuted}`}>@{opponent.username}</p>
              <p className={`text-sm font-semibold mt-0.5 ${accent}`}>
                {opponent.elo} ELO
              </p>
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

      {/* Spacer */}
      <div className="flex-1" />

      {/* Result submission */}
      <div className={`px-4 pb-safe-bottom pb-6 pt-4 border-t ${divider} space-y-3`}>
        <p className={`text-xs font-bold uppercase tracking-wider text-center ${textMuted}`}>
          Report your result
        </p>

        {error && (
          <p className="text-xs text-red-500 text-center">{error}</p>
        )}

        {opponent ? (
          <div className="grid grid-cols-3 gap-2">
            {(["1-0", "½-½", "0-1"] as ResultOption[]).map((r) => {
              const isWin =
                (r === "1-0" && myColor === "white") ||
                (r === "0-1" && myColor === "black");
              const isDraw = r === "½-½";
              const isLoss = !isWin && !isDraw;
              return (
                <button
                  key={r}
                  onClick={() => submitResult(r)}
                  disabled={submitting}
                  className={`py-4 rounded-2xl font-bold text-sm flex flex-col items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50 ${
                    isWin
                      ? isDark
                        ? "bg-[#3D6B47] text-white"
                        : "bg-[#3D6B47] text-white"
                      : isDraw
                      ? isDark
                        ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                        : "bg-blue-50 text-blue-700 border border-blue-200"
                      : isDark
                      ? "bg-red-500/15 text-red-400 border border-red-500/25"
                      : "bg-red-50 text-red-600 border border-red-200"
                  }`}
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <span className="text-xl">{resultIcon(r)}</span>
                  )}
                  <span>{resultLabel(r)}</span>
                </button>
              );
            })}
          </div>
        ) : (
          // Bye — no result to submit
          <div className={`rounded-2xl px-5 py-4 text-center ${accentBg}`}>
            <p className={`text-sm font-semibold ${accent}`}>
              You have a bye this round — ½ point awarded automatically.
            </p>
          </div>
        )}

        <p className={`text-xs text-center ${textMuted}`}>
          The director will confirm your result on their dashboard.
        </p>
      </div>
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
  const [startedPayload, setStartedPayload] =
    useState<TournamentStartedPayload | null>(null);
  const [endedPayload, setEndedPayload] =
    useState<TournamentEndedPayload | null>(null);
  const [playerCount, setPlayerCount] = useState<number | null>(null);
  const [newRoundFlashLabel, setNewRoundFlashLabel] = useState("");

  // Resolve tournament name from registry
  const tournament = tournamentId ? resolveTournament(tournamentId) : null;
  const tournamentName = tournament?.name ?? "Tournament";

  // On mount: check if tournament has already started (server state)
  useEffect(() => {
    if (!tournamentId) return;
    fetch(`/api/tournament/${encodeURIComponent(tournamentId)}/state`)
      .then((r) => r.json())
      .then((data) => {
        const s = data?.state;
        if (!s) return;
        // Tournament already completed — jump straight to the complete screen
        if (s.status === "completed" && s.players?.length > 0) {
          setEndedPayload({
            players: s.players,
            tournamentName: s.tournamentName ?? "Tournament",
          });
          setScreen("tournament_complete");
          return;
        }
        // Tournament in progress — jump to My Board
        if (
          (s.status === "in_progress" || s.status === "paused") &&
          s.rounds?.length > 0 &&
          s.players?.length > 0
        ) {
          const currentRound = s.rounds.find((r: { number: number }) => r.number === s.currentRound);
          if (currentRound) {
            setStartedPayload({
              round: s.currentRound,
              games: currentRound.games,
              players: s.players,
            });
            setScreen("my_board");
          }
        }
      })
      .catch(() => {
        // State not found — stay on lobby
      });
  }, [tournamentId]);

  // Persistent SSE connection — lives for the full player session across all screens.
  // Handles: tournament_started, round_started, player_joined.
  useEffect(() => {
    if (!tournamentId) return;
    const es = new EventSource(
      `/api/tournament/${encodeURIComponent(tournamentId)}/players/stream`
    );

    es.addEventListener("player_joined", () => {
      setPlayerCount((c) => (c !== null ? c + 1 : 1));
    });

    es.addEventListener("tournament_started", (e: MessageEvent) => {
      try {
        const payload = JSON.parse(e.data) as TournamentStartedPayload;
        setStartedPayload(payload);
        setScreen("my_board");
      } catch {
        console.error("[player] Failed to parse tournament_started");
      }
    });

    es.addEventListener("round_started", (e: MessageEvent) => {
      try {
        const payload = JSON.parse(e.data) as TournamentStartedPayload;
        // Show a brief "New Round!" flash, then transition to the updated board.
        setNewRoundFlashLabel(`Round ${payload.round} starting…`);
        setScreen("new_round_flash");
        setTimeout(() => {
          setStartedPayload(payload);
          setScreen("my_board");
        }, 1800);
      } catch {
        console.error("[player] Failed to parse round_started");
      }
    });

    es.addEventListener("tournament_ended", (e: MessageEvent) => {
      try {
        const payload = JSON.parse(e.data) as TournamentEndedPayload;
        setEndedPayload(payload);
        setScreen("tournament_complete");
      } catch {
        console.error("[player] Failed to parse tournament_ended");
      }
    });

    es.onerror = () => {
      // EventSource reconnects automatically
    };

    return () => es.close();
  }, [tournamentId]);

  const handleResultSubmitted = useCallback(() => {
    setScreen("result_submitted");
  }, []);

  if (!tournamentId || !username) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center">
        <div className="space-y-3">
          <p className="text-lg font-bold text-gray-900">Missing tournament or username.</p>
          <Link href="/join" className="text-sm text-[#3D6B47] underline">
            Go back to Join
          </Link>
        </div>
      </div>
    );
  }

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
        {/* Animated burst */}
        <div className="relative flex items-center justify-center">
          <div className={`absolute w-40 h-40 rounded-full ${accentBg} animate-ping opacity-40`} />
          <div className={`absolute w-28 h-28 rounded-full ${accentBg} animate-ping opacity-60`}
            style={{ animationDelay: "0.2s" }} />
          <div className={`relative w-24 h-24 rounded-full ${accentBg} flex items-center justify-center`}>
            <Swords className={`w-12 h-12 ${accent}`} />
          </div>
        </div>
        <div className="space-y-2">
          <h2 className={`text-3xl font-black ${isDark ? "text-white" : "text-gray-900"}`}>
            New Round!
          </h2>
          <p className={`text-base font-semibold ${accent}`}>{newRoundFlashLabel}</p>
          <p className={`text-sm ${isDark ? "text-white/50" : "text-gray-500"}`}>
            Finding your board assignment…
          </p>
        </div>
      </div>
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
      />
    );
  }

  if (screen === "my_board" && startedPayload) {
    const boardInfo = findMyBoard(username, startedPayload.games, startedPayload.players);

    if (!boardInfo) {
      // Player not found in pairings (shouldn't happen but handle gracefully)
      return (
        <div
          className={`min-h-screen ${isDark ? "bg-[#0d1f12]" : "bg-white"} flex flex-col items-center justify-center px-6 gap-4 text-center`}
        >
          <RotateCcw className={`w-10 h-10 ${isDark ? "text-white/30" : "text-gray-300"}`} />
          <p className={`text-lg font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
            You're not in the pairings yet.
          </p>
          <p className={`text-sm ${isDark ? "text-white/50" : "text-gray-500"}`}>
            Ask the director to check your registration.
          </p>
          <Link href={`/tournament/${tournamentId}`} className="text-sm text-[#3D6B47] underline">
            View standings
          </Link>
        </div>
      );
    }

    return (
      <MyBoardScreen
        tournamentId={tournamentId}
        tournamentName={tournamentName}
        username={username}
        round={startedPayload.round}
        game={boardInfo.game}
        myColor={boardInfo.myColor}
        opponent={boardInfo.opponent}
        isDark={isDark}
        onResultSubmitted={handleResultSubmitted}
      />
    );
  }

  if (screen === "result_submitted" && startedPayload) {
    const boardInfo = findMyBoard(username, startedPayload.games, startedPayload.players);
    return (
      <div
        className={`min-h-screen ${isDark ? "bg-[#0d1f12]" : "bg-white"} flex flex-col items-center justify-center px-6 gap-6 text-center`}
      >
        <div className="text-5xl">✅</div>
        <div className="space-y-2">
          <h2 className={`text-2xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
            Result submitted!
          </h2>
          <p className={`text-sm ${isDark ? "text-white/50" : "text-gray-500"}`}>
            The director will confirm your result.
          </p>
        </div>
        {boardInfo && (
          <p className={`text-sm ${isDark ? "text-white/60" : "text-gray-600"}`}>
            Board {boardInfo.game.board} · Round {startedPayload.round}
          </p>
        )}
        <Link
          href={`/tournament/${tournamentId}`}
          className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-[#3D6B47] text-white font-semibold text-sm"
        >
          <Trophy className="w-4 h-4" />
          View Live Standings
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  return null;
}
