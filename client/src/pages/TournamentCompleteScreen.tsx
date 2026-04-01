/**
 * TournamentCompleteScreen — shown on the player's phone when the tournament ends.
 * Displays a trophy hero, top-3 podium, full standings table, and a link to the
 * public tournament page. The current player's row is highlighted in the table.
 */
import { Link } from "wouter";
import { Trophy, ChevronRight, Users } from "lucide-react";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import type { Player } from "@/lib/tournamentData";

interface TournamentCompleteProps {
  tournamentId: string;
  tournamentName: string;
  username: string;
  players: Player[];
  isDark: boolean;
  clubId?: string | null;
  clubName?: string | null;
}

const PODIUM_MEDALS = ["🥈", "🥇", "🥉"];
const PODIUM_RANKS = [2, 1, 3];
const PODIUM_HEIGHTS = ["h-20", "h-28", "h-16"];

export function TournamentCompleteScreen({
  tournamentId,
  tournamentName,
  username,
  players,
  isDark,
  clubId,
  clubName,
}: TournamentCompleteProps) {
  const bg = isDark ? "bg-[#0d1f12]" : "bg-white";
  const textMain = isDark ? "text-white" : "text-gray-900";
  const textMuted = isDark ? "text-white/50" : "text-gray-500";
  const cardBg = isDark ? "bg-[#1a2e1e]" : "bg-gray-50";
  const accent = isDark ? "text-[#4CAF50]" : "text-[#3D6B47]";
  const accentBg = isDark ? "bg-[#4CAF50]/10" : "bg-[#3D6B47]/08";
  const divider = isDark ? "border-white/08" : "border-gray-100";

  // Sort by points desc, buchholz tiebreak, then ELO
  const sorted = [...players].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.buchholz !== a.buchholz) return b.buchholz - a.buchholz;
    return b.elo - a.elo;
  });

  const myRank =
    sorted.findIndex(
      (p) => p.username.toLowerCase() === username.toLowerCase()
    ) + 1;

  const rankSuffix = (r: number) => {
    if (r === 1) return "🥇";
    if (r === 2) return "🥈";
    if (r === 3) return "🥉";
    return "";
  };

  // Podium order: 2nd, 1st, 3rd (visual left-center-right)
  const podiumPlayers = [sorted[1], sorted[0], sorted[2]].filter(Boolean);

  const podiumColor = (idx: number) => {
    if (idx === 1)
      return isDark
        ? "bg-amber-400/20 text-amber-300"
        : "bg-amber-50 text-amber-600";
    if (idx === 0)
      return isDark
        ? "bg-gray-400/20 text-gray-300"
        : "bg-gray-100 text-gray-600";
    return isDark
      ? "bg-orange-400/20 text-orange-300"
      : "bg-orange-50 text-orange-600";
  };

  return (
    <div className={`min-h-screen ${bg} flex flex-col`}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className={`px-5 pt-safe-top pt-6 pb-4 border-b ${divider}`}>
        <span
          className={`text-xs font-bold uppercase tracking-widest ${accent}`}
        >
          OTB Chess
        </span>
        <h1 className={`text-lg font-bold ${textMain} truncate mt-1`}>
          {tournamentName}
        </h1>
      </div>

      {/* ── Trophy hero ────────────────────────────────────────────────────── */}
      <div className={`mx-4 mt-5 rounded-3xl ${accentBg} px-5 py-6 text-center`}>
        <div className="text-5xl mb-3">🏆</div>
        <h2 className={`text-2xl font-black ${textMain}`}>
          Tournament Complete!
        </h2>
        {myRank > 0 && (
          <p className={`text-sm font-semibold mt-1.5 ${accent}`}>
            You finished #{myRank} {rankSuffix(myRank)}
          </p>
        )}
      </div>

      {/* ── Podium (top 3) ─────────────────────────────────────────────────── */}
      {sorted.length >= 2 && (
        <div className="mx-4 mt-5">
          <p
            className={`text-xs font-bold uppercase tracking-wider ${accent} mb-3`}
          >
            Final Podium
          </p>
          <div className="flex items-end justify-center gap-2">
            {podiumPlayers.map((player, idx) => {
              const rank = PODIUM_RANKS[idx];
              const isMe =
                player.username.toLowerCase() === username.toLowerCase();
              return (
                <div
                  key={player.id}
                  className="flex flex-col items-center gap-1.5 flex-1"
                >
                  <span className="text-xl">{PODIUM_MEDALS[idx]}</span>
                  <PlayerAvatar
                    username={player.username}
                    name={player.name || player.username}
                    platform={player.platform ?? "chesscom"}
                    avatarUrl={player.avatarUrl}
                    size={rank === 1 ? 48 : 40}
                    className={
                      isMe
                        ? "ring-2 ring-offset-1 ring-[#4CAF50] rounded-full"
                        : ""
                    }
                  />
                  <p
                    className={`text-xs font-bold ${textMain} text-center leading-tight truncate w-full px-1`}
                  >
                    {player.name || player.username}
                  </p>
                  <div
                    className={`w-full rounded-t-xl flex items-center justify-center ${PODIUM_HEIGHTS[idx]} ${podiumColor(idx)}`}
                  >
                    <span className="text-lg font-black">#{rank}</span>
                  </div>
                  <p className={`text-xs font-semibold ${accent}`}>
                    {player.points}pts
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Full standings table ────────────────────────────────────────────── */}
      <div className="mx-4 mt-5">
        <p
          className={`text-xs font-bold uppercase tracking-wider ${accent} mb-2`}
        >
          Full Standings
        </p>
        <div className={`rounded-2xl overflow-hidden border ${divider}`}>
          {sorted.map((player, idx) => {
            const rank = idx + 1;
            const isMe =
              player.username.toLowerCase() === username.toLowerCase();
            return (
              <div
                key={player.id}
                className={`flex items-center gap-3 px-4 py-3 ${
                  idx < sorted.length - 1 ? `border-b ${divider}` : ""
                } ${
                  isMe
                    ? isDark
                      ? "bg-[#4CAF50]/10"
                      : "bg-[#3D6B47]/06"
                    : idx % 2 === 0
                    ? cardBg
                    : isDark
                    ? "bg-[#0d1f12]"
                    : "bg-white"
                }`}
              >
                {/* Rank */}
                <span
                  className={`text-sm font-black w-5 text-center flex-shrink-0 ${
                    rank === 1
                      ? "text-amber-400"
                      : rank === 2
                      ? "text-gray-400"
                      : rank === 3
                      ? "text-orange-400"
                      : textMuted
                  }`}
                >
                  {rank}
                </span>

                {/* Avatar */}
                <PlayerAvatar
                  username={player.username}
                  name={player.name || player.username}
                  platform={player.platform ?? "chesscom"}
                  avatarUrl={player.avatarUrl}
                  size={32}
                  className="flex-shrink-0"
                />

                {/* Name + ELO */}
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm font-semibold truncate ${
                      isMe ? accent : textMain
                    }`}
                  >
                    {player.name || player.username}
                    {isMe && (
                      <span className={`ml-1 text-xs font-normal ${textMuted}`}>
                        (you)
                      </span>
                    )}
                  </p>
                  <p className={`text-xs ${textMuted}`}>{player.elo} ELO</p>
                </div>

                {/* Score */}
                <div className="text-right flex-shrink-0">
                  <p className={`text-sm font-black ${textMain}`}>
                    {player.points}
                  </p>
                  <p className={`text-xs ${textMuted}`}>
                    {player.wins}W {player.draws}D {player.losses}L
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Club CTA ────────────────────────────────────────────────────────────────── */}
      {clubId && clubName && (
        <div className="mx-4 mt-5">
          <Link
            href={`/clubs/${clubId}`}
            className={`flex items-center gap-4 rounded-2xl border p-4 transition-all ${
              isDark
                ? "bg-[#1a2e1e] border-white/10 hover:border-[#4CAF50]/40"
                : "bg-white border-gray-200 hover:border-[#3D6B47]/40"
            }`}
          >
            <div className="w-12 h-12 bg-[#3D6B47] rounded-2xl flex items-center justify-center flex-shrink-0 shadow-md shadow-[#3D6B47]/25">
              <Users className="w-6 h-6 text-white" strokeWidth={1.5} />
            </div>
            <div className="flex-1 min-w-0">
              <p className={`font-bold text-sm ${textMain}`}>
                Join {clubName}
              </p>
              <p className={`text-xs mt-0.5 ${textMuted}`}>
                Follow this club for future tournaments and events
              </p>
            </div>
            <ChevronRight className={`w-5 h-5 flex-shrink-0 ${textMuted}`} />
          </Link>
        </div>
      )}

      {/* ── Footer CTA ───────────────────────────────────────────────────────────────── */}
      <div className="px-4 pb-safe-bottom pb-8 pt-5 mt-auto">
        <Link
          href={`/tournament/${tournamentId}`}
          className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl font-bold text-base bg-[#3D6B47] text-white"
        >
          <Trophy className="w-5 h-5" />
          View Full Tournament Page
          <ChevronRight className="w-5 h-5" />
        </Link>
      </div>    </div>
  );
}
