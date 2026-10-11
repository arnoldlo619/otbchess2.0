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
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Download, Loader2, X, Crown, Swords } from "lucide-react";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import type { PlayerPerformance, RoundHistoryEntry } from "@/lib/performanceStats";
import { FLAG_EMOJI } from "@/lib/tournamentData";
import { OTB_LOGO_ASSET } from "@/lib/brandAssets";
import { toast } from "sonner";

const FULL_CARD_EXPORT_WIDTH = 540;
const FULL_CARD_EXPORT_HEIGHT = 675;
const FULL_CARD_EXPORT_PIXEL_RATIO = 2;

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
      className={`w-5 h-5 rounded-sm border text-xs font-bold flex items-center justify-center flex-shrink-0 ${
        color === "W"
          ? "bg-white border-[#ADBC9F] text-[#436850]"
          : "bg-[#12372A]/80 border-[#436850]/40 text-[#436850]/70"
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
  width = 280,
}: {
  history: RoundHistoryEntry[];
  totalRounds: number;
  width?: number;
}) {
  if (history.length < 2) return null;
  const W = width;
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

function slugifyFilePart(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "performance";
}

async function downloadFullPerformanceCard(element: HTMLElement, filename: string): Promise<void> {
  const { toPng } = await import("html-to-image");
  const dataUrl = await toPng(element, {
    pixelRatio: FULL_CARD_EXPORT_PIXEL_RATIO,
    fetchRequestInit: { mode: "cors" },
    width: FULL_CARD_EXPORT_WIDTH,
    height: FULL_CARD_EXPORT_HEIGHT,
  });

  const link = document.createElement("a");
  link.download = filename;
  link.href = dataUrl;
  link.click();
}

function FullPerformanceCardExport({
  perf,
  accentColor,
  tournamentName,
}: {
  perf: PlayerPerformance;
  accentColor: string;
  tournamentName: string;
}) {
  const {
    player,
    rank,
    totalPlayers,
    points,
    wins,
    draws,
    losses,
    performanceRating,
    ratingChange,
    longestStreak,
    whiteGames,
    blackGames,
    badgeLabel,
    roundHistory,
  } = perf;
  const flag = player.country ? FLAG_EMOJI[player.country] ?? "" : "";
  const visibleHistory = roundHistory.slice(-5);
  const gamesPlayed = wins + draws + losses;

  return (
    <div
      data-expanded-performance-card-export
      className="relative overflow-hidden"
      style={{
        width: FULL_CARD_EXPORT_WIDTH,
        height: FULL_CARD_EXPORT_HEIGHT,
        color: "#F8FFF4",
        background: "linear-gradient(150deg, oklch(0.23 0.075 145) 0%, oklch(0.16 0.05 145) 55%, oklch(0.13 0.035 145) 100%)",
        fontFamily: "'Clash Display', ui-sans-serif, system-ui, sans-serif",
      }}
    >
      <div
        className="absolute inset-x-0 top-0 h-44 pointer-events-none"
        style={{ background: `radial-gradient(ellipse at 65% -20%, ${accentColor}55 0%, transparent 68%)` }}
      />
      <div className="relative h-full p-7 flex flex-col">
        <header className="flex items-start gap-4 pb-5 border-b" style={{ borderColor: "rgba(255,255,255,0.13)" }}>
          <div className="relative flex-shrink-0">
            <div
              className="w-[74px] h-[74px] overflow-hidden rounded-2xl border-2"
              style={{ borderColor: `${accentColor}99`, background: "oklch(0.25 0.04 145)" }}
            >
              <PlayerAvatar
                username={player.username ?? player.name}
                name={player.name}
                size={74}
                className="w-full h-full object-cover"
              />
            </div>
            <span
              className="absolute -bottom-2 -right-2 min-w-7 h-7 px-1.5 rounded-full border-2 flex items-center justify-center text-xs font-black"
              style={{ background: accentColor, color: "#07140C", borderColor: "oklch(0.16 0.05 145)" }}
            >
              {rank}
            </span>
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              {flag && <span className="text-base leading-none">{flag}</span>}
              {player.title && (
                <span className="px-2 py-1 rounded-md text-[11px] font-black tracking-wide" style={{ background: `${accentColor}26`, color: accentColor }}>
                  {player.title}
                </span>
              )}
              <span
                className="max-w-[245px] px-2.5 py-1 rounded-full text-[11px] leading-tight font-bold"
                style={{ background: `${accentColor}22`, color: accentColor, overflowWrap: "anywhere" }}
              >
                {badgeLabel}
              </span>
            </div>
            <h2 className="text-[27px] leading-none font-black tracking-tight truncate">{player.name}</h2>
            <p className="mt-2 text-[13px] font-medium text-white/65">
              {tournamentName} <span className="mx-1.5 text-white/30">·</span> ELO {player.elo}
            </p>
            <p className="mt-1 text-[12px] text-white/48">Rank #{rank} of {totalPlayers} <span className="mx-1.5 text-white/25">·</span> {gamesPlayed} games</p>
          </div>
        </header>

        <section className="grid grid-cols-4 gap-2 py-5" aria-label="Tournament performance summary">
          {[
            { label: "Performance", value: performanceRating || "—", detail: ratingChange > 0 ? `+${ratingChange} rating` : ratingChange < 0 ? `${ratingChange} rating` : "rating level" },
            { label: "Record", value: `${wins}/${draws}/${losses}`, detail: "W / D / L" },
            { label: "Score", value: `${points}`, detail: `${gamesPlayed} rounds` },
            { label: "Streak", value: `${longestStreak}W`, detail: "best run" },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl px-2.5 py-3 text-center border" style={{ background: "rgba(5,25,14,0.48)", borderColor: "rgba(255,255,255,0.10)" }}>
              <p className="text-[11px] uppercase tracking-[0.12em] font-bold text-white/48">{stat.label}</p>
              <p className="mt-1.5 text-[24px] leading-none font-black tracking-tight" style={{ color: stat.label === "Score" ? accentColor : "#F8FFF4" }}>{stat.value}</p>
              <p className="mt-1 text-[10px] text-white/46">{stat.detail}</p>
            </div>
          ))}
        </section>

        <section className="grid grid-cols-[0.9fr_1.1fr] gap-4 px-4 py-3.5 rounded-xl border" style={{ background: "rgba(5,25,14,0.36)", borderColor: "rgba(255,255,255,0.09)" }}>
          <div>
            <p className="text-[10px] uppercase tracking-[0.14em] font-bold text-white/50">Color balance</p>
            <div className="mt-2.5 flex items-center gap-2">
              <span className="w-4 text-right text-[11px] font-bold text-white/70">{whiteGames}</span>
              <div className="h-2 flex-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.15)" }}>
                <div className="h-full" style={{ width: `${whiteGames + blackGames ? (whiteGames / (whiteGames + blackGames)) * 100 : 50}%`, background: "rgba(255,255,255,0.86)" }} />
              </div>
              <span className="w-4 text-[11px] font-bold text-white/70">{blackGames}</span>
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-white/42"><span>White</span><span>Black</span></div>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.14em] font-bold text-white/50">Score progression</p>
            <div className="mt-1.5 h-10 overflow-hidden">
              <ScoreSparkline history={roundHistory} totalRounds={Math.max(roundHistory.length, 1)} width={224} />
            </div>
          </div>
        </section>

        <section className="mt-4 flex-1 min-h-0">
          <div className="flex items-center justify-between mb-2.5">
            <p className="text-[11px] uppercase tracking-[0.14em] font-bold text-white/52">Tournament rounds</p>
            <p className="text-[11px] font-medium text-white/42">{roundHistory.length} recorded</p>
          </div>
          {visibleHistory.length === 0 ? (
            <div className="h-[150px] rounded-xl border flex items-center justify-center text-sm text-white/45" style={{ borderColor: "rgba(255,255,255,0.09)", background: "rgba(5,25,14,0.28)" }}>
              No completed rounds recorded.
            </div>
          ) : (
            <div className="space-y-1.5">
              {visibleHistory.map((entry) => (
                <div key={entry.roundNumber} className="flex items-center gap-2.5 rounded-xl px-3 py-2 border" style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(5,25,14,0.30)" }}>
                  <span className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black text-white/55" style={{ background: "rgba(255,255,255,0.08)" }}>R{entry.roundNumber}</span>
                  <div className="w-7 h-7 rounded-lg overflow-hidden flex-shrink-0 border border-white/10">
                    <PlayerAvatar username={entry.opponent.username ?? entry.opponent.name} name={entry.opponent.name} size={28} className="w-full h-full object-cover" />
                  </div>
                  <p className="min-w-0 flex-1 truncate text-[12px] font-semibold text-white/88">{entry.opponent.name}</p>
                  <ColorChip color={entry.color} />
                  <ResultChip result={entry.result} />
                  <span className="w-8 text-right text-[11px] font-bold" style={{ color: resultColor(entry.result) }}>+{entry.pointsEarned === 0.5 ? "½" : entry.pointsEarned}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <footer className="mt-4 pt-3.5 flex items-center justify-between border-t" style={{ borderColor: "rgba(255,255,255,0.12)" }}>
          <div className="flex items-center gap-2">
            <img src={OTB_LOGO_ASSET} alt="OTB!!" width={24} height={24} className="h-6 w-auto object-contain" />
            <span className="text-[10px] font-bold tracking-[0.13em] uppercase text-white/55">ChessOTB.club</span>
          </div>
          <span className="text-[10px] font-semibold text-white/38">Performance Card</span>
        </footer>
      </div>
    </div>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

interface Props {
  perf: PlayerPerformance;
  accentColor?: string;
  tournamentName?: string;
  onClose: () => void;
}

export default function PlayerCardExpandedModal({
  perf,
  accentColor = "#4CAF50",
  tournamentName = "Tournament Performance",
  onClose,
}: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const exportCardRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);

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

  const handleDownload = async () => {
    if (!exportCardRef.current || isDownloading) return;
    setIsDownloading(true);
    try {
      const filename = `${slugifyFilePart(perf.player.username ?? perf.player.name)}-full-performance-card-${slugifyFilePart(tournamentName)}.png`;
      await downloadFullPerformanceCard(exportCardRef.current, filename);
      toast.success("Full performance card saved", {
        description: "1080×1350 · Ready for Instagram feed posts and carousel slides.",
      });
    } catch {
      toast.error("Full card download failed — try again.");
    } finally {
      setIsDownloading(false);
    }
  };

  const { player, rank, totalPlayers, points, wins, draws, losses,
    performanceRating, ratingChange, longestStreak, whiteGames, blackGames,
    buchholz, sonnebornBerger, isQuads, badge: _badge, badgeLabel, roundHistory, bestWin } = perf;

  const flag = player.country ? FLAG_EMOJI[player.country] ?? "" : "";

  const modal = (
    <div
      ref={overlayRef}
      className="modal-overlay z-[9999]"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-white/10 shadow-2xl"
        style={{ background: "oklch(0.18 0.06 145)", scrollbarWidth: "thin" }}
      >
        {/* Modal actions */}
        <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
          <button
            type="button"
            data-expanded-performance-card-download
            onClick={handleDownload}
            disabled={isDownloading}
            className="min-h-11 rounded-xl px-3.5 flex items-center gap-2 border text-xs font-bold text-white/90 transition-all hover:bg-white/12 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#12372A]"
            style={{ background: `${accentColor}24`, borderColor: `${accentColor}66`, touchAction: "manipulation" }}
            aria-label={`Download ${player.name}'s full performance card as a 1080 by 1350 PNG`}
          >
            {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            <span className="hidden sm:inline">Download</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-11 h-11 rounded-xl flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-all active:scale-[0.95] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#12372A]"
            style={{ touchAction: "manipulation" }}
            aria-label="Close full performance card"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

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
                    className="px-1.5 py-0.5 rounded text-xs font-black tracking-wider"
                    style={{ background: accentColor + "22", color: accentColor }}
                  >
                    {player.title}
                  </span>
                )}
                <span
                  className="px-2 py-0.5 rounded-full text-xs font-bold"
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
                <span className="text-white/60">·</span>
                <span className="text-white/50 text-sm">
                  Score <span className="font-bold" style={{ color: accentColor }}>{points}</span>
                  <span className="text-white/60"> / {roundHistory.length}</span>
                </span>
                <span className="text-white/60">·</span>
                <span className="text-white/50 text-sm">
                  Rank <span className="text-white/80 font-semibold">#{rank}</span>
                  <span className="text-white/60"> of {totalPlayers}</span>
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
            isQuads
              ? { label: "Sonneborn-Berger", value: (sonnebornBerger ?? 0).toFixed(2), sub: "tiebreak" }
              : { label: "Buchholz", value: buchholz.toFixed(1), sub: "tiebreak" },
          ].map(({ label, value, sub }) => (
            <div key={label} className="flex flex-col items-center py-4 px-2" style={{ background: "oklch(0.18 0.06 145)" }}>
              <span className="text-white font-bold text-lg leading-tight">{value}</span>
              <span className="text-white/60 text-xs mt-0.5">{label}</span>
              <span className="text-white/55 text-xs">{sub}</span>
            </div>
          ))}
        </div>

        {/* ── Color Balance + Score Progression ── */}
        {(whiteGames + blackGames > 0 || roundHistory.length >= 2) && (
          <div className="px-6 pt-5 pb-4 border-b border-white/08 grid gap-6" style={{ gridTemplateColumns: whiteGames + blackGames > 0 && roundHistory.length >= 2 ? '1fr 1fr' : '1fr' }}>
            {/* Color Balance */}
            {whiteGames + blackGames > 0 && (
              <div>
                <p className="text-white/60 text-xs font-bold uppercase tracking-widest mb-3">Color Balance</p>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-white/55 text-xs w-5 text-right font-semibold">{whiteGames}</span>
                  <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: 'oklch(0.26 0.05 145)' }}>
                    <div
                      className="h-full rounded-l-full"
                      style={{
                        width: `${(whiteGames / (whiteGames + blackGames)) * 100}%`,
                        background: 'rgba(255,255,255,0.80)',
                      }}
                    />
                  </div>
                  <span className="text-white/55 text-xs w-5 font-semibold">{blackGames}</span>
                </div>
                <div className="flex justify-between text-[10px] text-white/30 px-7">
                  <span>White</span>
                  <span>Black</span>
                </div>
              </div>
            )}
            {/* Score Progression */}
            {roundHistory.length >= 2 && (
              <div>
                <p className="text-white/60 text-xs font-bold uppercase tracking-widest mb-3">Score Progression</p>
                <ScoreSparkline history={roundHistory} totalRounds={roundHistory.length} />
              </div>
            )}
          </div>
        )}

        {/* ── Round-by-Round Log ── */}
        <div className="px-6 pt-4 pb-8">
          <p className="text-white/60 text-xs font-bold uppercase tracking-widest mb-4">
            Round-by-Round · {roundHistory.length} games
          </p>

          {roundHistory.length === 0 ? (
            <p className="text-white/60 text-sm text-center py-8">No completed games recorded.</p>
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
                        <span className="text-xs font-black px-1 rounded" style={{ background: accentColor + "22", color: accentColor }}>
                          {entry.opponent.title}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-white/35 text-xs">ELO {entry.opponent.elo}</span>
                      {entry.opponent.elo > player.elo && (
                        <span className="text-xs text-amber-400/70">+{entry.opponent.elo - player.elo} higher</span>
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
                    <div className="text-white/60 text-xs">
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
              <Swords className="w-3.5 h-3.5 flex-shrink-0 text-white/55" />
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(
    <>
      <div
        aria-hidden="true"
        inert
        style={{ position: "fixed", left: "-9999px", top: 0, width: FULL_CARD_EXPORT_WIDTH, height: FULL_CARD_EXPORT_HEIGHT, pointerEvents: "none" }}
      >
        <div ref={exportCardRef}>
          <FullPerformanceCardExport perf={perf} accentColor={accentColor} tournamentName={tournamentName} />
        </div>
      </div>
      {modal}
    </>,
    document.body
  );
}
