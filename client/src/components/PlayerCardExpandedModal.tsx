/**
 * OTB Chess — PlayerCardExpandedModal
 *
 * A full-screen overlay that shows an in-depth view of a player's tournament
 * performance, including:
 *   - Identity header (avatar, name, ELO, badge, rank)
 *   - Key stats row (performance rating, W/D/L, streak, color balance)
 *   - Round-by-round game log with opponent avatar, color, result chip,
 *     points earned, and running cumulative score
 *   - Score progression mini-chart
 */
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X, Crown, Swords, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import type { PlayerPerformance, RoundHistoryEntry } from "@/lib/performanceStats";
import { FLAG_EMOJI } from "@/lib/tournamentData";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resultColor(result: RoundHistoryEntry["result"]): string {
  return result === "win" ? "#4ade80" : result === "draw" ? "#60a5fa" : "#f87171";
}

function ResultChip({ result }: { result: RoundHistoryEntry["result"] }) {
  const label = result === "win" ? "W" : result === "draw" ? "D" : "L";
  const bg =
    result === "win"
      ? "rgba(74,222,128,0.15)"
      : result === "draw"
      ? "rgba(96,165,250,0.15)"
      : "rgba(248,113,113,0.15)";
  const color = resultColor(result);
  return (
    <span
      className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-black flex-shrink-0"
      style={{ background: bg, color }}
    >
      {label}
    </span>
  );
}

function ColorChip({ color }: { color: "W" | "B" }) {
  return (
    <div
      className={`w-5 h-5 rounded-sm border text-[9px] font-bold flex items-center justify-center flex-shrink-0 ${
        color === "W"
          ? "bg-white border-gray-300 text-gray-500"
          : "bg-gray-800 border-gray-600 text-gray-300"
      }`}
    >
      {color}
    </div>
  );
}

// ─── Score Progression Sparkline ─────────────────────────────────────────────

function ScoreSparkline({
  history,
  totalRounds,
}: {
  history: RoundHistoryEntry[];
  totalRounds: number;
}) {
  if (history.length < 2) return null;
  const W = 280;
  const H = 48;
  const padX = 8;
  const padY = 6;
  const innerW = W - padX * 2;
  const innerH = H - padY * 2;
  const maxScore = totalRounds;

  const points = [{ x: padX, y: padY + innerH }, ...history.map((e, i) => ({
    x: padX + ((i + 1) / history.length) * innerW,
    y: padY + (1 - e.runningScore / maxScore) * innerH,
  }))];

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x},${p.y}`)
    .join(" ");
  const areaPath = `${linePath} L ${points[points.length - 1].x},${padY + innerH} L ${padX},${padY + innerH} Z`;

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
      <defs>
        <linearGradient id="score-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4CAF50" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#4CAF50" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#score-fill)" />
      <path d={linePath} fill="none" stroke="#4CAF50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {points.slice(1).map((pt, i) => (
        <circle key={i} cx={pt.x} cy={pt.y} r={3} fill={resultColor(history[i].result)} stroke="oklch(0.20 0.06 145)" strokeWidth="1.5" />
      ))}
    </svg>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

interface Props {
  perf: PlayerPerformance;
  accentColor?: string;
  onClose: () => void;
}

export default function PlayerCardExpandedModal({ perf, accentColor = "#4CAF50", onClose }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const { player, rank, totalPlayers, points, wins, draws, losses,
    performanceRating, ratingChange, longestStreak, whiteGames, blackGames,
    buchholz, badge, badgeLabel, roundHistory, bestWin } = perf;

  const flag = player.country ? FLAG_EMOJI[player.country] ?? "" : "";

  const modal = (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-white/10 shadow-2xl"
        style={{ background: "oklch(0.18 0.06 145)", scrollbarWidth: "thin" }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-all"
        >
          <X className="w-4 h-4" />
        </button>

        {/* ── Header ── */}
        <div
          className="relative px-6 pt-8 pb-6 overflow-hidden"
          style={{
            background: `linear-gradient(135deg, oklch(0.22 0.08 145) 0%, oklch(0.18 0.06 145) 100%)`,
            borderBottom: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          {/* Glow */}
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 pointer-events-none"
            style={{ background: `radial-gradient(ellipse, ${accentColor}22 0%, transparent 70%)` }}
          />

          <div className="relative flex items-center gap-5">
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <div
                className="w-20 h-20 rounded-2xl overflow-hidden border-2"
                style={{ borderColor: accentColor + "66" }}
              >
                <PlayerAvatar
                  username={player.username ?? player.name}
                  name={player.name}
                  size={80}
                  className="w-full h-full object-cover"
                />
              </div>
              {/* Rank badge */}
              <div
                className="absolute -bottom-2 -right-2 w-7 h-7 rounded-full flex items-center justify-center text-xs font-black border-2"
                style={{
                  background: rank <= 3 ? accentColor : "oklch(0.26 0.06 145)",
                  borderColor: "oklch(0.18 0.06 145)",
                  color: rank <= 3 ? "#000" : "rgba(255,255,255,0.7)",
                }}
              >
                {rank}
              </div>
            </div>

            {/* Identity */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                {flag && <span className="text-lg">{flag}</span>}
                {player.title && (
                  <span
                    className="px-1.5 py-0.5 rounded text-[10px] font-black tracking-wider"
                    style={{ background: accentColor + "22", color: accentColor }}
                  >
                    {player.title}
                  </span>
                )}
                <span
                  className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                  style={{ background: accentColor + "18", color: accentColor }}
                >
                  {badgeLabel}
                </span>
              </div>
              <h2 className="text-white font-black text-2xl leading-tight truncate">
                {player.name}
              </h2>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <span className="text-white/50 text-sm">
                  ELO <span className="text-white/80 font-semibold">{player.elo}</span>
                </span>
                <span className="text-white/30">·</span>
                <span className="text-white/50 text-sm">
                  Score <span className="font-bold" style={{ color: accentColor }}>{points}</span>
                  <span className="text-white/30"> / {roundHistory.length}</span>
                </span>
                <span className="text-white/30">·</span>
                <span className="text-white/50 text-sm">
                  Rank <span className="text-white/80 font-semibold">#{rank}</span>
                  <span className="text-white/30"> of {totalPlayers}</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Stats Row ── */}
        <div className="grid grid-cols-4 gap-px border-b border-white/08" style={{ background: "rgba(255,255,255,0.04)" }}>
          {[
            { label: "Perf. Rating", value: performanceRating || "—", sub: ratingChange !== 0 ? `${ratingChange > 0 ? "+" : ""}${ratingChange}` : "±0" },
            { label: "W / D / L", value: `${wins}/${draws}/${losses}`, sub: `${roundHistory.length} games` },
            { label: "Best Streak", value: `${longestStreak}W`, sub: "consecutive wins" },
            { label: "Buchholz", value: buchholz.toFixed(1), sub: "tiebreak" },
          ].map(({ label, value, sub }) => (
            <div key={label} className="flex flex-col items-center py-4 px-2" style={{ background: "oklch(0.18 0.06 145)" }}>
              <span className="text-white font-bold text-lg leading-tight">{value}</span>
              <span className="text-white/30 text-[10px] mt-0.5">{label}</span>
              <span className="text-white/20 text-[9px]">{sub}</span>
            </div>
          ))}
        </div>

        {/* ── Score Progression ── */}
        {roundHistory.length >= 2 && (
          <div className="px-6 pt-5 pb-2">
            <p className="text-white/30 text-[10px] font-bold uppercase tracking-widest mb-3">Score Progression</p>
            <ScoreSparkline history={roundHistory} totalRounds={roundHistory.length} />
          </div>
        )}

        {/* ── Round-by-Round Log ── */}
        <div className="px-6 pt-4 pb-8">
          <p className="text-white/30 text-[10px] font-bold uppercase tracking-widest mb-4">
            Round-by-Round · {roundHistory.length} games
          </p>

          {roundHistory.length === 0 ? (
            <p className="text-white/30 text-sm text-center py-8">No completed games recorded.</p>
          ) : (
            <div className="space-y-2">
              {roundHistory.map((entry) => (
                <div
                  key={entry.roundNumber}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/06 transition-all hover:border-white/12"
                  style={{ background: "oklch(0.22 0.05 145 / 0.6)" }}
                >
                  {/* Round number */}
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black text-white/40 flex-shrink-0"
                    style={{ background: "oklch(0.26 0.05 145)" }}>
                    R{entry.roundNumber}
                  </div>

                  {/* Opponent avatar */}
                  <div className="w-9 h-9 rounded-xl overflow-hidden flex-shrink-0 border border-white/10">
                    <PlayerAvatar
                      username={entry.opponent.username ?? entry.opponent.name}
                      name={entry.opponent.name}
                      size={36}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Opponent info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-white/90 font-semibold text-sm truncate">{entry.opponent.name}</span>
                      {entry.opponent.title && (
                        <span className="text-[9px] font-black px-1 rounded" style={{ background: accentColor + "22", color: accentColor }}>
                          {entry.opponent.title}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-white/35 text-xs">ELO {entry.opponent.elo}</span>
                      {entry.opponent.elo > player.elo && (
                        <span className="text-[9px] text-amber-400/70">+{entry.opponent.elo - player.elo} higher</span>
                      )}
                    </div>
                  </div>

                  {/* Color chip */}
                  <ColorChip color={entry.color} />

                  {/* Result chip */}
                  <ResultChip result={entry.result} />

                  {/* Points earned */}
                  <div className="text-right flex-shrink-0 w-12">
                    <div className="text-white/80 font-bold text-sm">
                      +{entry.pointsEarned === 0.5 ? "½" : entry.pointsEarned}
                    </div>
                    <div className="text-white/30 text-[10px]">
                      = {entry.runningScore % 1 === 0.5
                        ? `${Math.floor(entry.runningScore)}½`
                        : entry.runningScore}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Best win callout */}
          {bestWin && (
            <div
              className="mt-4 flex items-center gap-3 px-4 py-3 rounded-xl border"
              style={{ background: accentColor + "0d", borderColor: accentColor + "30" }}
            >
              <Crown className="w-4 h-4 flex-shrink-0" style={{ color: accentColor }} />
              <div className="flex-1 min-w-0">
                <span className="text-white/60 text-xs">Best win — </span>
                <span className="text-white/90 text-xs font-semibold">{bestWin.opponent.name}</span>
                <span className="text-white/40 text-xs"> (ELO {bestWin.opponent.elo})</span>
                {bestWin.eloGap > 0 && (
                  <span className="text-xs ml-1" style={{ color: accentColor }}>
                    +{bestWin.eloGap} above you
                  </span>
                )}
              </div>
              <Swords className="w-3.5 h-3.5 flex-shrink-0 text-white/20" />
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
