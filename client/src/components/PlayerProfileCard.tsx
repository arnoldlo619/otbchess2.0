/**
 * OTB Chess — PlayerProfileCard
 *
 * A rich floating profile tooltip that appears on hover over any player name
 * in the Director Dashboard. Shows:
 *   - Avatar (chess.com photo / Lichess flair / initials)
 *   - Name, title, country flag, platform badge
 *   - ELO rating + points in this tournament
 *   - W / D / L record as a mini bar chart
 *   - Color history (W/B chips for each round played)
 *   - Buchholz tiebreak score
 *   - "New" badge if joined in the last 5 minutes
 *
 * Usage:
 *   <PlayerHoverCard player={player} isDark={isDark}>
 *     <span>{player.name}</span>
 *   </PlayerHoverCard>
 *
 * The card auto-flips left/right and up/down to stay within the viewport.
 */

import { useState, useRef, useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { FLAG_EMOJI } from "@/lib/tournamentData";
import type { Player } from "@/lib/tournamentData";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function PlatformBadge({ platform }: { platform?: "chesscom" | "lichess" }) {
  if (!platform) return null;
  return platform === "lichess" ? (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-500">
      <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 fill-current">
        <path d="M19 22H5v-2h14v2M13 2a5 5 0 0 1 5 5c0 1.64-.8 3.09-2.03 4L17 13H7l1.03-2C6.8 10.09 6 8.64 6 7a5 5 0 0 1 5-5h2m0 2h-2a3 3 0 0 0-3 3c0 1.12.61 2.1 1.5 2.63L9.5 11h5l-.5-2.37A3 3 0 0 0 15.5 7a3 3 0 0 0-2.5-3z" />
      </svg>
      Lichess
    </span>
  ) : (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#81b64c]/15 text-[#3D6B47]">
      <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 fill-current">
        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
      </svg>
      chess.com
    </span>
  );
}

function ColorChip({ color }: { color: "W" | "B" }) {
  return (
    <div
      className={`w-5 h-5 rounded-sm border text-[9px] font-bold flex items-center justify-center ${
        color === "W"
          ? "bg-white border-gray-300 text-gray-500"
          : "bg-gray-800 border-gray-600 text-gray-300"
      }`}
    >
      {color}
    </div>
  );
}

// ─── Card Content ─────────────────────────────────────────────────────────────

function CardContent({ player, isDark }: { player: Player; isDark: boolean }) {
  const total = player.wins + player.draws + player.losses;
  const winPct = total > 0 ? (player.wins / total) * 100 : 0;
  const drawPct = total > 0 ? (player.draws / total) * 100 : 0;
  const lossPct = total > 0 ? (player.losses / total) * 100 : 0;
  const isNew = player.joinedAt ? Date.now() - player.joinedAt < 5 * 60 * 1000 : false;

  const bg = isDark
    ? "bg-[oklch(0.22_0.06_145)] border-white/10"
    : "bg-white border-gray-200";
  const textMain = isDark ? "text-white" : "text-gray-900";
  const textSub = isDark ? "text-white/40" : "text-gray-400";
  const divider = isDark ? "border-white/08" : "border-gray-100";
  const statBg = isDark ? "bg-white/05" : "bg-gray-50";

  return (
    <div
      className={`rounded-2xl border shadow-2xl overflow-hidden w-64 ${bg}`}
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      {/* Header — avatar + name + badges */}
      <div className={`px-4 pt-4 pb-3 border-b ${divider}`}>
        <div className="flex items-start gap-3">
          <PlayerAvatar
            username={player.username}
            name={player.name}
            platform={player.platform}
            avatarUrl={player.avatarUrl}
            flairEmoji={player.flairEmoji}
            size={48}
            showBadge
            className="rounded-xl flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              {player.title && (
                <span className="text-xs font-bold text-[#3D6B47] bg-[#3D6B47]/10 px-1.5 py-0.5 rounded">
                  {player.title}
                </span>
              )}
              {isNew && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-500 animate-pulse">
                  NEW
                </span>
              )}
            </div>
            <p
              className={`text-sm font-bold leading-tight mt-0.5 truncate ${textMain}`}
              style={{ fontFamily: "'Clash Display', sans-serif" }}
            >
              {player.name}
            </p>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              <span className="text-xs">{FLAG_EMOJI[player.country]}</span>
              <span className={`text-xs ${textSub}`}>@{player.username}</span>
              <PlatformBadge platform={player.platform} />
            </div>
          </div>
        </div>
      </div>

      {/* ELO + Points row */}
      <div className={`grid grid-cols-2 divide-x ${isDark ? "divide-white/08" : "divide-gray-100"}`}>
        <div className={`px-4 py-3 ${statBg}`}>
          <p className={`text-[10px] uppercase tracking-wider font-semibold ${textSub}`}>ELO</p>
          <p className={`text-xl font-bold tabular-nums ${textMain}`}>{player.elo}</p>
        </div>
        <div className={`px-4 py-3 ${statBg}`}>
          <p className={`text-[10px] uppercase tracking-wider font-semibold ${textSub}`}>Points</p>
          <p className={`text-xl font-bold tabular-nums text-[#3D6B47]`}>{player.points}</p>
        </div>
      </div>

      {/* W / D / L record */}
      <div className={`px-4 py-3 border-t ${divider}`}>
        <p className={`text-[10px] uppercase tracking-wider font-semibold mb-2 ${textSub}`}>
          Record
        </p>
        {/* Bar */}
        {total > 0 && (
          <div className="flex h-1.5 rounded-full overflow-hidden mb-2">
            {winPct > 0 && (
              <div className="bg-emerald-500 transition-all" style={{ width: `${winPct}%` }} />
            )}
            {drawPct > 0 && (
              <div className="bg-blue-400 transition-all" style={{ width: `${drawPct}%` }} />
            )}
            {lossPct > 0 && (
              <div className="bg-red-400 transition-all" style={{ width: `${lossPct}%` }} />
            )}
          </div>
        )}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
            <span className={`text-xs font-semibold ${textMain}`}>{player.wins}W</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
            <span className={`text-xs font-semibold ${textMain}`}>{player.draws}D</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
            <span className={`text-xs font-semibold ${textMain}`}>{player.losses}L</span>
          </div>
          <div className="ml-auto">
            <span className={`text-[10px] ${textSub}`}>
              Buch. <span className={`font-semibold ${textMain}`}>{player.buchholz.toFixed(1)}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Color history */}
      {player.colorHistory.length > 0 && (
        <div className={`px-4 pb-4 border-t ${divider} pt-3`}>
          <p className={`text-[10px] uppercase tracking-wider font-semibold mb-2 ${textSub}`}>
            Colors
          </p>
          <div className="flex items-center gap-1">
            {player.colorHistory.map((c, i) => (
              <ColorChip key={i} color={c} />
            ))}
            {/* Next color prediction */}
            {player.colorHistory.length > 0 && (
              <>
                <span className={`text-[10px] mx-1 ${textSub}`}>→</span>
                <div
                  className={`w-5 h-5 rounded-sm border-2 border-dashed text-[9px] font-bold flex items-center justify-center opacity-50 ${
                    player.colorHistory[player.colorHistory.length - 1] === "W"
                      ? "border-gray-600 text-gray-400"
                      : "border-gray-300 text-gray-500"
                  }`}
                >
                  {player.colorHistory[player.colorHistory.length - 1] === "W" ? "B" : "W"}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Hover Wrapper ────────────────────────────────────────────────────────────

interface PlayerHoverCardProps {
  player: Player;
  isDark: boolean;
  children: ReactNode;
  /** Extra classes on the trigger wrapper */
  className?: string;
  /** Disable the hover card (e.g. on touch devices) */
  disabled?: boolean;
}

export function PlayerHoverCard({
  player,
  isDark,
  children,
  className = "",
  disabled = false,
}: PlayerHoverCardProps) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Detect touch device — disable hover card on touch
  const isTouchDevice =
    typeof window !== "undefined" &&
    (navigator.maxTouchPoints > 0 || "ontouchstart" in window);

  function computePosition() {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const cardW = 256; // w-64
    const cardH = 340; // approximate
    const gap = 8;

    // Default: below and aligned to left of trigger
    let top = rect.bottom + gap + window.scrollY;
    let left = rect.left + window.scrollX;

    // Flip right if card would overflow right edge
    if (left + cardW > window.innerWidth - 16) {
      left = rect.right + window.scrollX - cardW;
    }
    // Flip up if card would overflow bottom
    if (rect.bottom + gap + cardH > window.innerHeight) {
      top = rect.top - cardH - gap + window.scrollY;
    }
    // Clamp left to viewport
    left = Math.max(8, Math.min(left, window.innerWidth - cardW - 8));

    setPos({ top, left });
  }

  function handleMouseEnter() {
    if (disabled || isTouchDevice) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    computePosition();
    timerRef.current = setTimeout(() => setVisible(true), 180);
  }

  function handleMouseLeave() {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setVisible(false), 120);
  }

  function handleCardMouseEnter() {
    if (timerRef.current) clearTimeout(timerRef.current);
  }

  function handleCardMouseLeave() {
    timerRef.current = setTimeout(() => setVisible(false), 120);
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <>
      <div
        ref={triggerRef}
        className={`inline-flex ${className}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {children}
      </div>

      {visible &&
        createPortal(
          <div
            ref={cardRef}
            className="fixed z-[9999] pointer-events-auto"
            style={{
              top: pos.top,
              left: pos.left,
              animation: "profileCardIn 0.15s cubic-bezier(0.16, 1, 0.3, 1) forwards",
            }}
            onMouseEnter={handleCardMouseEnter}
            onMouseLeave={handleCardMouseLeave}
          >
            <CardContent player={player} isDark={isDark} />
          </div>,
          document.body
        )}
    </>
  );
}
