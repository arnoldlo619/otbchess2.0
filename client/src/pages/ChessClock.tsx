/**
 * ChessClock — /tournament/:id/clock  or  /clock
 *
 * Full-screen two-player chess clock.
 * - Pre-loaded with the tournament's time control (timeBase + timeIncrement).
 * - Top half = Player 2 (rotated 180°), Bottom half = Player 1.
 * - Tap your half to start/stop your clock; the other player's clock starts.
 * - Increment (Fischer) is added when you tap to end your turn.
 * - Tap the pause icon (center) to pause both clocks.
 * - When a player's time reaches 0, their half turns red ("flagged").
 * - Settings panel lets you adjust time/increment before the game starts.
 * - Sound effects: tap click, low-time warning tick, flag alarm (Web Audio API).
 * - Identity card: auto-populated from signed-in user's chess.com profile (no manual input).
 *   In tournament mode, both identity cards are pre-populated from URL params.
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useSearch, useLocation } from "wouter";
import { Settings, RotateCcw, Pause, Play, X, ChevronLeft, Flag, Volume2, VolumeX, Trophy } from "lucide-react";
import { NavLogo } from "@/components/NavLogo";
import { resolveTournament } from "@/lib/tournamentRegistry";
import { useClockSounds } from "@/hooks/useClockSounds";
import { useAccessibleOverlay } from "@/hooks/useAccessibleOverlay";
import { RegisterGameModal } from "@/components/RegisterGameModal";
import { GameResultModal } from "@/components/GameResultModal";
import { toProxiedAvatarUrl } from "@/hooks/useChessAvatar";
import { fetchFromChessCom } from "@/hooks/useChessComProfile";
import { useAuthContext } from "@/context/AuthContext";

// ─── Brand colors ─────────────────────────────────────────────────────────────
const FOREST_BG = "#0d1f12";
const GREEN_ACTIVE = "#22c55e";
const GREEN_DIM = "#1a3d22";
const RED_FLAG = "#c0392b";
const RED_WARN   = "#dc2626";
const RED_DIM    = "#3d0a0a";

// ─── Types ────────────────────────────────────────────────────────────────────
type ClockState = "idle" | "p1_running" | "p2_running" | "paused" | "p1_flagged" | "p2_flagged";

interface ClockConfig {
  baseMs: number;
  incrementMs: number;
}

interface PlayerIdentity {
  username: string;
  avatarUrl?: string | null;
  rapid?: number;
  blitz?: number;
  colorLabel: "White" | "Black";
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
export function formatClockMs(ms: number): string {
  if (ms <= 0) return "0:00";
  const totalSec = Math.ceil(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function parseTimeControl(timePreset: string, timeBase: number, timeIncrement: number): ClockConfig {
  const match = timePreset.match(/^(\d+(?:\.\d+)?)\+(\d+)$/);
  if (match) {
    return {
      baseMs: parseFloat(match[1]) * 60 * 1000,
      incrementMs: parseInt(match[2], 10) * 1000,
    };
  }
  return {
    baseMs: timeBase * 60 * 1000,
    incrementMs: timeIncrement * 1000,
  };
}

// ─── Settings Panel ───────────────────────────────────────────────────────────
const TIME_PRESETS = [
  { label: "1 min",   base: 1,  inc: 0 },
  { label: "2+1",     base: 2,  inc: 1 },
  { label: "3 min",   base: 3,  inc: 0 },
  { label: "3+2",     base: 3,  inc: 2 },
  { label: "5 min",   base: 5,  inc: 0 },
  { label: "5+3",     base: 5,  inc: 3 },
  { label: "10 min",  base: 10, inc: 0 },
  { label: "10+5",    base: 10, inc: 5 },
  { label: "15+10",   base: 15, inc: 10 },
  { label: "30 min",  base: 30, inc: 0 },
  { label: "30+20",   base: 30, inc: 20 },
  { label: "60 min",  base: 60, inc: 0 },
];

function SettingsPanel({
  config,
  onApply,
  onClose,
  opponentUsername = "",
  onOpponentUsernameChange,
}: {
  config: ClockConfig;
  onApply: (cfg: ClockConfig) => void;
  onClose: () => void;
  opponentUsername?: string;
  onOpponentUsernameChange?: (username: string) => void;
}) {
  const [baseMin, setBaseMin] = useState(Math.round(config.baseMs / 60000));
  const [incSec, setIncSec] = useState(Math.round(config.incrementMs / 1000));
  const [localOpponent, setLocalOpponent] = useState(opponentUsername);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  useAccessibleOverlay({
    open: true,
    onClose,
    containerRef: dialogRef,
    initialFocusRef: closeButtonRef,
  });

  const apply = () => {
    onApply({ baseMs: baseMin * 60 * 1000, incrementMs: incSec * 1000 });
    onOpponentUsernameChange?.(localOpponent.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="clock-settings-title"
        tabIndex={-1}
        className="w-full max-w-sm rounded-t-3xl px-6 pt-6 pb-10 safe-bottom"
        style={{ background: "#0d1f12", border: "1px solid rgba(34,197,94,0.15)" }}
      >
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-6" />
        <div className="flex items-center justify-between mb-6">
          <h2 id="clock-settings-title" className="text-white text-lg font-bold">Time Control</h2>
          <button ref={closeButtonRef} onClick={onClose} aria-label="Close clock settings" className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10">
            <X className="w-4 h-4 text-white/70" />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2 mb-6">
          {TIME_PRESETS.map((p) => {
            const active = baseMin === p.base && incSec === p.inc;
            return (
              <button
                key={p.label}
                onClick={() => { setBaseMin(p.base); setIncSec(p.inc); }}
                className={`py-3 rounded-xl text-sm font-bold transition-all ${
                  active ? "text-white" : "text-white/70 hover:bg-white/12"
                }`}
                style={active ? { background: GREEN_ACTIVE } : { background: "rgba(255,255,255,0.07)" }}
              >
                {p.label}
              </button>
            );
          })}
        </div>
        <div className="flex gap-4 mb-6">
          <div className="flex-1">
            <p className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-2">Minutes</p>
            <div className="flex items-center gap-2">
              <button onClick={() => setBaseMin((v) => Math.max(1, v - 1))} className="w-10 h-10 rounded-xl bg-white/08 text-white text-xl font-bold flex items-center justify-center">−</button>
              <span className="flex-1 text-center text-white text-xl font-bold">{baseMin}</span>
              <button onClick={() => setBaseMin((v) => Math.min(180, v + 1))} className="w-10 h-10 rounded-xl bg-white/08 text-white text-xl font-bold flex items-center justify-center">+</button>
            </div>
          </div>
          <div className="flex-1">
            <p className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-2">Increment (sec)</p>
            <div className="flex items-center gap-2">
              <button onClick={() => setIncSec((v) => Math.max(0, v - 1))} className="w-10 h-10 rounded-xl bg-white/08 text-white text-xl font-bold flex items-center justify-center">−</button>
              <span className="flex-1 text-center text-white text-xl font-bold">{incSec}</span>
              <button onClick={() => setIncSec((v) => Math.min(60, v + 1))} className="w-10 h-10 rounded-xl bg-white/08 text-white text-xl font-bold flex items-center justify-center">+</button>
            </div>
          </div>
        </div>
        {/* Opponent username — only shown in standalone mode (no URL p2 param) */}
        {onOpponentUsernameChange && (
          <div className="mb-6">
            <p className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-2">Opponent (chess.com username)</p>
            <input
              aria-label="Opponent (chess.com username)"
              type="text"
              value={localOpponent}
              onChange={(e) => setLocalOpponent(e.target.value)}
              placeholder="e.g. gothamchess"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="w-full px-4 py-3 rounded-xl text-white text-sm font-medium placeholder-white/30 outline-none"
              style={{
                background: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(34,197,94,0.25)",
              }}
            />
            <p className="text-white/30 text-[10px] mt-1.5 leading-snug">
              Their avatar and ratings will appear on the top half of the clock.
            </p>
          </div>
        )}
        <button onClick={apply} className="w-full py-4 rounded-2xl text-white text-base font-bold" style={{ background: GREEN_ACTIVE }}>
          Apply & Reset
        </button>
      </div>
    </div>
  );
}

// ─── Identity Card ────────────────────────────────────────────────────────────
/**
 * Compact identity card shown in the corner of each clock half.
 * Displays avatar, username, color badge, and ELO ratings.
 */
function IdentityCard({
  playerInfo,
  flipped,
  isIdle,
  isPaused,
  loading = false,
}: {
  playerInfo: PlayerIdentity;
  flipped: boolean;
  isIdle: boolean;
  isPaused: boolean;
  loading?: boolean;
}) {
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "absolute",
        ...(flipped
          ? { top: "1rem", left: "1rem", transform: "rotate(180deg)", transformOrigin: "top left" }
          : { bottom: "1rem", left: "1rem" }),
        zIndex: 2,
        maxWidth: 260,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.65rem",
          padding: "0.55rem 0.85rem",
          background: "rgba(0,0,0,0.32)",
          borderRadius: "0.85rem",
          backdropFilter: "blur(10px)",
          border: "1px solid rgba(34,197,94,0.18)",
          opacity: isIdle || isPaused ? 1 : 0.72,
          transition: "opacity 0.3s",
        }}
      >
        {/* Avatar */}
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: "50%",
            overflow: "hidden",
            flexShrink: 0,
            background: "rgba(34,197,94,0.12)",
            border: "2px solid rgba(34,197,94,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {loading && !playerInfo.avatarUrl ? (
            // Skeleton pulse while avatar is being fetched
            <div style={{ width: "100%", height: "100%", borderRadius: "50%", background: "rgba(34,197,94,0.18)", animation: "pulse 1.5s ease-in-out infinite" }} />
          ) : playerInfo.avatarUrl ? (
            <img
              src={playerInfo.avatarUrl}
              alt={playerInfo.username}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              onError={(e) => {
                // If the proxied URL fails, fall back to initials
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <span style={{ color: "rgba(255,255,255,0.7)", fontWeight: 700, fontSize: "1rem", textTransform: "uppercase" }}>
              {playerInfo.username.charAt(0)}
            </span>
          )}
        </div>
        {/* Name + ratings */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
            <span style={{ color: "#fff", fontWeight: 700, fontSize: "0.82rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 120 }}>
              {playerInfo.username}
            </span>
            <span style={{
              fontSize: "0.62rem",
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              padding: "0.1rem 0.45rem",
              borderRadius: "999px",
              background: playerInfo.colorLabel === "White" ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.45)",
              color: playerInfo.colorLabel === "White" ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.65)",
              border: playerInfo.colorLabel === "White" ? "1px solid rgba(255,255,255,0.3)" : "1px solid rgba(255,255,255,0.15)",
              flexShrink: 0,
            }}>
              {playerInfo.colorLabel === "White" ? "♔ White" : "♚ Black"}
            </span>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.15rem" }}>
            {(playerInfo.rapid ?? 0) > 0 && (
              <span style={{ fontSize: "0.68rem", fontWeight: 700, color: GREEN_ACTIVE }}>⚡ {playerInfo.rapid}</span>
            )}
            {(playerInfo.blitz ?? 0) > 0 && (
              <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "#60a5fa" }}>🔥 {playerInfo.blitz}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Clock Half ───────────────────────────────────────────────────────────────
function ClockHalf({
  timeMs,
  isActive,
  isFlagged,
  isIdle,
  isPaused,
  flipped,
  moveCount,
  onTap,
  playerInfo,
  identityLoading = false,
}: {
  timeMs: number;
  isActive: boolean;
  isFlagged: boolean;
  isIdle: boolean;
  isPaused: boolean;
  flipped: boolean;
  moveCount: number;
  onTap: () => void;
  playerInfo?: PlayerIdentity;
  identityLoading?: boolean;
}) {
  let bgColor: string;
  let textColor: string;

  const isLowTime = !isFlagged && timeMs > 0 && timeMs < 60_000;

  if (isFlagged) {
    bgColor = RED_FLAG;
    textColor = "#ffffff";
  } else if (isIdle || isPaused) {
    bgColor = isActive ? GREEN_ACTIVE : GREEN_DIM;
    textColor = "#ffffff";
  } else if (isActive) {
    bgColor = isLowTime ? RED_WARN : GREEN_ACTIVE;
    textColor = "#ffffff";
  } else {
    bgColor = isLowTime ? RED_DIM : GREEN_DIM;
    textColor = "rgba(255,255,255,0.55)";
  }

  const displayTime = formatClockMs(timeMs);
  const isUrgent = isActive && !isFlagged && timeMs < 10_000 && timeMs > 0;

  return (
    <div
      className={`flex-1 w-full flex flex-col items-center justify-center select-none touch-none relative transition-colors duration-150 cursor-pointer ${
        isUrgent ? "animate-pulse" : ""
      }`}
      style={{ backgroundColor: bgColor }}
      aria-label={flipped ? "Player 2 clock" : "Player 1 clock"}
      role="button"
      tabIndex={0}
      onClick={onTap}
      onKeyDown={(e) => e.key === " " || e.key === "Enter" ? onTap() : undefined}
    >
      {/* Subtle grid texture overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(rgba(34,197,94,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(34,197,94,0.04) 1px, transparent 1px)`,
          backgroundSize: "32px 32px",
          opacity: isIdle ? 1 : 0.3,
          transition: "opacity 0.3s",
        }}
      />

      {/* Sub-60s red pulse overlay */}
      {isLowTime && (
        <div
          className="absolute inset-0 pointer-events-none animate-[lowTimePulse_1s_ease-in-out_infinite]"
          style={{ background: isActive ? "rgba(220,38,38,0.28)" : "rgba(220,38,38,0.12)", zIndex: 0 }}
        />
      )}

      {/* Central content */}
      <div
        style={{
          transform: flipped ? "rotate(180deg)" : "none",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.4rem",
          position: "relative",
          zIndex: 1,
          width: "100%",
          height: "100%",
          padding: "0 1rem",
        }}
      >
        <span
          style={{
            color: textColor,
            fontFamily: "'Clash Display', 'Inter', system-ui, sans-serif",
            fontWeight: 800,
            fontSize: "clamp(4rem, 22vw, 9rem)",
            lineHeight: 1,
            letterSpacing: "-0.03em",
            fontVariantNumeric: "tabular-nums",
            transition: "color 0.15s",
          }}
        >
          {displayTime}
        </span>

        {moveCount > 0 && (
          <span
            style={{
              color: isActive ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.25)",
              fontSize: "0.8rem",
              fontWeight: 600,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            {moveCount} {moveCount === 1 ? "move" : "moves"}
          </span>
        )}

        {isFlagged && (
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginTop: "0.25rem" }}>
            <Flag style={{ width: "1.1rem", height: "1.1rem", color: "rgba(255,255,255,0.9)" }} />
            <span style={{ color: "rgba(255,255,255,0.9)", fontWeight: 700, fontSize: "0.95rem", letterSpacing: "0.04em" }}>
              Time&apos;s up
            </span>
          </div>
        )}
      </div>

      {/* Identity card */}
      {playerInfo && (
        <IdentityCard
          playerInfo={playerInfo}
          flipped={flipped}
          isIdle={isIdle}
          isPaused={isPaused}
          loading={identityLoading}
        />
      )}
    </div>
  );
}

// ─── Center Controls ──────────────────────────────────────────────────────────
function CenterControls({
  clockState,
  muted,
  onPause,
  onResume,
  onReset,
  onSettings,
  onBack,
  onToggleMute,
  onRegisterGame,
  showReset,
}: {
  clockState: ClockState;
  muted: boolean;
  onPause: () => void;
  onResume: () => void;
  onReset: () => void;
  onSettings: () => void;
  onBack: () => void;
  onToggleMute: () => void;
  onRegisterGame: () => void;
  showReset: boolean;
}) {
  const isRunning = clockState === "p1_running" || clockState === "p2_running";
  const isPaused = clockState === "paused";
  const isIdle = clockState === "idle";
  const isFlagged = clockState === "p1_flagged" || clockState === "p2_flagged";

  return (
    <div
      className="absolute left-0 right-0 flex items-center justify-center gap-3 z-10 pointer-events-none"
      style={{ top: "50%", transform: "translateY(-50%)" }}
    >
      <button
        onClick={onBack}
        className="w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-sm pointer-events-auto"
        style={{ background: "rgba(0,0,0,0.55)" }}
        aria-label="Back"
      >
        <ChevronLeft className="w-5 h-5 text-white/80" />
      </button>

      <div className="px-1 opacity-90 pointer-events-auto">
        <NavLogo linked={false} className="h-6" />
      </div>

      {isRunning && (
        <button
          onClick={onPause}
          className="w-14 h-14 rounded-full flex items-center justify-center backdrop-blur-sm shadow-lg pointer-events-auto"
          style={{ background: "rgba(0,0,0,0.6)" }}
          aria-label="Pause"
        >
          <Pause className="w-6 h-6 text-white" />
        </button>
      )}
      {isPaused && (
        <button
          onClick={onResume}
          className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg pointer-events-auto"
          style={{ background: GREEN_ACTIVE }}
          aria-label="Resume"
        >
          <Play className="w-6 h-6 text-white fill-white" />
        </button>
      )}

      {(isFlagged || (showReset && (isPaused || isIdle))) && (
        <button
          onClick={onReset}
          className="w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-sm pointer-events-auto"
          style={{ background: "rgba(0,0,0,0.55)" }}
          aria-label="Reset"
        >
          <RotateCcw className="w-4 h-4 text-white/80" />
        </button>
      )}

      {(isIdle || isPaused) && (
        <button
          onClick={onSettings}
          className="w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-sm pointer-events-auto"
          style={{ background: "rgba(0,0,0,0.55)" }}
          aria-label="Settings"
        >
          <Settings className="w-4 h-4 text-white/80" />
        </button>
      )}

      <button
        onClick={onToggleMute}
        className="w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-sm pointer-events-auto"
        style={{ background: "rgba(0,0,0,0.55)" }}
        aria-label={muted ? "Unmute sounds" : "Mute sounds"}
      >
        {muted
          ? <VolumeX className="w-4 h-4 text-white/50" />
          : <Volume2 className="w-4 h-4 text-white/80" />
        }
      </button>

      {isIdle && (
        <button
          onClick={onRegisterGame}
          className="w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-sm pointer-events-auto"
          style={{ background: "rgba(34,197,94,0.7)" }}
          aria-label="Register rated game"
          title="Register Rated Game"
        >
          <Trophy className="w-4 h-4 text-white" />
        </button>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ChessClock() {
  const { id: tournamentId } = useParams<{ id: string }>();
  const search = useSearch();
  const [, navigate] = useLocation();
  const { user } = useAuthContext();

  const config = (() => {
    const tc = resolveTournament(tournamentId ?? "");
    if (tc) return parseTimeControl(tc.timePreset, tc.timeBase, tc.timeIncrement);
    const params = new URLSearchParams(search);
    const base = parseFloat(params.get("base") ?? "5");
    const inc = parseInt(params.get("inc") ?? "0", 10);
    return { baseMs: base * 60 * 1000, incrementMs: inc * 1000 };
  })();

  const [clockConfig, setClockConfig] = useState<ClockConfig>(config);
  const [p1TimeMs, setP1TimeMs] = useState(clockConfig.baseMs);
  const [p2TimeMs, setP2TimeMs] = useState(clockConfig.baseMs);
  const [p1Moves, setP1Moves] = useState(0);
  const [p2Moves, setP2Moves] = useState(0);
  const [clockState, setClockState] = useState<ClockState>("idle");
  const [showSettings, setShowSettings] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const resetDialogRef = useRef<HTMLDivElement>(null);
  const resetCancelRef = useRef<HTMLButtonElement>(null);
  const closeResetConfirm = useCallback(() => setShowResetConfirm(false), []);
  useAccessibleOverlay({
    open: showResetConfirm,
    onClose: closeResetConfirm,
    containerRef: resetDialogRef,
    initialFocusRef: resetCancelRef,
  });

  // ── URL params (tournament mode) ──────────────────────────────────────────
  const urlParams = new URLSearchParams(search);
  const urlP1 = urlParams.get("p1") ?? null;   // White player username
  const urlP2 = urlParams.get("p2") ?? null;   // Black player username

  // Player identity state — populated from URL params (tournament) or auth (standalone)
  const [p1Ratings, setP1Ratings] = useState<{ blitz: number; rapid: number } | null>(null);
  const [p2Ratings, setP2Ratings] = useState<{ blitz: number; rapid: number } | null>(null);
  const [p1AvatarUrl, setP1AvatarUrl] = useState<string | null>(null);
  const [p2AvatarUrl, setP2AvatarUrl] = useState<string | null>(null);
  // Whether the standalone auth identity fetch is still in-flight
  const [authIdentityLoading, setAuthIdentityLoading] = useState(false);

  // ── Tournament mode: fetch ratings + avatars for URL-provided players ─────
  useEffect(() => {
    if (!urlP1 && !urlP2) return;
    const fetchPlayer = (username: string, setRatings: typeof setP1Ratings, setAvatar: typeof setP1AvatarUrl) => {
      fetchFromChessCom(username)
        .then((p) => {
          setRatings({ blitz: p.blitz, rapid: p.rapid });
          if (p.avatar) setAvatar(toProxiedAvatarUrl(p.avatar) ?? p.avatar);
        })
        .catch(() => {});
    };
    if (urlP1) fetchPlayer(urlP1, setP1Ratings, setP1AvatarUrl);
    if (urlP2) fetchPlayer(urlP2, setP2Ratings, setP2AvatarUrl);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Standalone mode: opponent username entered via Settings panel ──────────
  // Allows the top half (P2) to show an identity card when not in tournament mode.
  const [standaloneOpponentUsername, setStandaloneOpponentUsername] = useState<string>("");
  const [standaloneP2Identity, setStandaloneP2Identity] = useState<PlayerIdentity | null>(null);

  useEffect(() => {
    if (urlP2) return; // tournament mode handles P2 via URL params
    const username = standaloneOpponentUsername.trim();
    if (!username) { setStandaloneP2Identity(null); return; }
    fetchFromChessCom(username)
      .then((p) => {
        setStandaloneP2Identity({
          username,
          avatarUrl: p.avatar ? (toProxiedAvatarUrl(p.avatar) ?? p.avatar) : null,
          rapid: p.rapid > 0 ? p.rapid : undefined,
          blitz: p.blitz > 0 ? p.blitz : undefined,
          colorLabel: "Black",
        });
      })
      .catch(() => {
        // Show card with just the username if fetch fails
        setStandaloneP2Identity({ username, avatarUrl: null, colorLabel: "Black" });
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [standaloneOpponentUsername]);

  // ── Standalone mode: auto-populate P1 (bottom half) from signed-in user ──
  // If the user is signed in and has a linked chess.com account, fetch their
  // profile and show the identity card on their half (bottom = P1).
  const [authP1Identity, setAuthP1Identity] = useState<PlayerIdentity | null>(null);

  useEffect(() => {
    // Only in standalone mode (no tournament URL params for this half)
    if (urlP1) return;
    // Wait until auth has finished loading
    if (!user) return;
    if (user.isGuest) return;

    const username = user.chesscomUsername;
    if (!username) return;

    // ── Step 1: Seed immediately from cached auth data (instant render) ──
    // Use stored avatar if available; proxy it through our server to avoid
    // CORS / Cloudflare blocks on chess.com CDN URLs.
    const storedAvatar = user.avatarUrl
      ? (toProxiedAvatarUrl(user.avatarUrl) ?? user.avatarUrl)
      : null;

    const seed: PlayerIdentity = {
      username,
      avatarUrl: storedAvatar,
      rapid: user.chesscomRapid ?? undefined,
      blitz: user.chesscomBlitz ?? undefined,
      colorLabel: "White",
    };
    setAuthP1Identity(seed);

    // ── Step 2: Refresh from chess.com API for latest ratings + avatar ──
    // Mark loading so callers can show a subtle skeleton on the avatar
    // if no stored avatar exists yet.
    if (!storedAvatar) setAuthIdentityLoading(true);

    fetchFromChessCom(username)
      .then((p) => {
        setAuthP1Identity((prev) => (prev ? {
          ...prev,
          rapid: p.rapid > 0 ? p.rapid : (prev.rapid ?? 0),
          blitz: p.blitz > 0 ? p.blitz : (prev.blitz ?? 0),
          avatarUrl: p.avatar
            ? (toProxiedAvatarUrl(p.avatar) ?? p.avatar)
            : prev.avatarUrl,
        } : null));
      })
      .catch(() => { /* keep seed data — network failure is non-fatal */ })
      .finally(() => setAuthIdentityLoading(false));
  // Re-run when the auth user changes (login/logout) or chesscom username changes.
  // urlP1 is intentionally excluded — it's stable for the lifetime of the page.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.chesscomUsername]);

  // ── Derived identity objects passed to ClockHalf ──────────────────────────
  // Tournament mode: both halves get identity from URL params
  // Standalone mode: P1 (bottom) gets identity from auth; P2 (top) gets nothing
  const p1Identity: PlayerIdentity | undefined = urlP1
    ? { username: urlP1, avatarUrl: p1AvatarUrl, rapid: p1Ratings?.rapid, blitz: p1Ratings?.blitz, colorLabel: "White" }
    : authP1Identity ?? undefined;

  const p2Identity: PlayerIdentity | undefined = urlP2
    ? { username: urlP2, avatarUrl: p2AvatarUrl, rapid: p2Ratings?.rapid, blitz: p2Ratings?.blitz, colorLabel: "Black" }
    : standaloneP2Identity ?? undefined;

  // ── RegisterGameModal state ───────────────────────────────────────────────
  const [showRegisterGame, setShowRegisterGame] = useState(() => {
    const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    return params.get("register") === "true";
  });
  const [activeGameSessionId, setActiveGameSessionId] = useState<string | null>(null);

  const sounds = useClockSounds();
  const lastWarnSecRef = useRef<number>(-1);
  const flagAlarmFiredRef = useRef<boolean>(false);
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(0);

  useEffect(() => {
    try {
      const orient = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
      orient?.lock?.("portrait").catch(() => {});
    } catch { /* ignore */ }
    return () => {
      try { screen.orientation?.unlock?.(); } catch { /* ignore */ }
    };
  }, []);

  useEffect(() => {
    let wakeLock: WakeLockSentinel | null = null;
    const acquire = async () => {
      try {
        if ("wakeLock" in navigator) {
          wakeLock = await (navigator as Navigator & { wakeLock: { request: (type: string) => Promise<WakeLockSentinel> } }).wakeLock.request("screen");
        }
      } catch { /* ignore */ }
    };
    acquire();
    return () => { wakeLock?.release().catch(() => {}); };
  }, []);

  useEffect(() => {
    if ((clockState === "p1_flagged" || clockState === "p2_flagged") && !flagAlarmFiredRef.current) {
      flagAlarmFiredRef.current = true;
      sounds.flagAlarm();
    }
    if (clockState === "idle") {
      flagAlarmFiredRef.current = false;
      lastWarnSecRef.current = -1;
    }
  }, [clockState, sounds]);

  const tick = useCallback((now: number) => {
    const elapsed = lastTickRef.current ? now - lastTickRef.current : 0;
    lastTickRef.current = now;

    setClockState((state) => {
      if (state === "p1_running") {
        setP1TimeMs((t) => {
          const next = Math.max(0, t - elapsed);
          if (next > 0 && next <= 10_000) {
            const secRemaining = Math.ceil(next / 1000);
            if (secRemaining !== lastWarnSecRef.current) {
              lastWarnSecRef.current = secRemaining;
              setTimeout(() => sounds.warningTick(), 0);
            }
          }
          if (next <= 0) { setTimeout(() => setClockState("p1_flagged"), 0); return 0; }
          return next;
        });
      } else if (state === "p2_running") {
        setP2TimeMs((t) => {
          const next = Math.max(0, t - elapsed);
          if (next > 0 && next <= 10_000) {
            const secRemaining = Math.ceil(next / 1000);
            if (secRemaining !== lastWarnSecRef.current) {
              lastWarnSecRef.current = secRemaining;
              setTimeout(() => sounds.warningTick(), 0);
            }
          }
          if (next <= 0) { setTimeout(() => setClockState("p2_flagged"), 0); return 0; }
          return next;
        });
      }
      return state;
    });

    rafRef.current = requestAnimationFrame(tick);
  }, [sounds]);

  useEffect(() => {
    const isRunning = clockState === "p1_running" || clockState === "p2_running";
    if (isRunning) {
      lastTickRef.current = performance.now();
      rafRef.current = requestAnimationFrame(tick);
    } else {
      if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    }
    return () => {
      if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    };
  }, [clockState, tick]);

  const prevClockStateRef = useRef<ClockState>("idle");
  const [showGameResult, setShowGameResult] = useState(false);

  useEffect(() => {
    if (!activeGameSessionId) return;
    const prev = prevClockStateRef.current;
    prevClockStateRef.current = clockState;
    if (prev === "idle" && (clockState === "p1_running" || clockState === "p2_running")) {
      fetch(`/api/otb-games/${activeGameSessionId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: "clock_started" }),
      }).catch(() => {});
    }
    if (clockState === "p1_flagged" || clockState === "p2_flagged") {
      setShowGameResult(true);
    }
  }, [clockState, activeGameSessionId]);

  const handleP1Tap = useCallback(() => {
    setClockState((state) => {
      if (state === "idle") { sounds.tap(); return "p2_running"; }
      if (state === "p1_running") {
        sounds.tap();
        setP1TimeMs((t) => t + clockConfig.incrementMs);
        setP1Moves((m) => m + 1);
        lastWarnSecRef.current = -1;
        return "p2_running";
      }
      if (state === "paused") return "paused";
      return state;
    });
  }, [clockConfig.incrementMs, sounds]);

  const handleP2Tap = useCallback(() => {
    setClockState((state) => {
      if (state === "idle") { sounds.tap(); return "p1_running"; }
      if (state === "p2_running") {
        sounds.tap();
        setP2TimeMs((t) => t + clockConfig.incrementMs);
        setP2Moves((m) => m + 1);
        lastWarnSecRef.current = -1;
        return "p1_running";
      }
      if (state === "paused") return "paused";
      return state;
    });
  }, [clockConfig.incrementMs, sounds]);

  const handlePause = useCallback(() => {
    setClockState((state) => {
      if (state === "p1_running" || state === "p2_running") return "paused";
      return state;
    });
  }, []);

  const handleResume = useCallback(() => {
    setClockState((state) => {
      if (state === "paused") return "p1_running";
      return state;
    });
  }, []);

  const doReset = useCallback((cfg: ClockConfig = clockConfig) => {
    setP1TimeMs(cfg.baseMs);
    setP2TimeMs(cfg.baseMs);
    setP1Moves(0);
    setP2Moves(0);
    lastWarnSecRef.current = -1;
    flagAlarmFiredRef.current = false;
    setClockState("idle");
    setShowResetConfirm(false);
  }, [clockConfig]);

  const handleReset = useCallback(() => {
    const state = clockState;
    if (state === "idle") return;
    if (state === "p1_flagged" || state === "p2_flagged") { doReset(); return; }
    setShowResetConfirm(true);
  }, [clockState, doReset]);

  const handleApplySettings = useCallback((cfg: ClockConfig) => {
    setClockConfig(cfg);
    doReset(cfg);
  }, [doReset]);

  const handleBack = useCallback(() => {
    if (tournamentId) {
      const params = new URLSearchParams(search);
      const from = params.get("from");
      const backUsername = params.get("username") ?? "";
      const usernameQuery = backUsername ? `?username=${encodeURIComponent(backUsername)}` : "";
      if (from === "director") navigate(`/tournament/${tournamentId}/manage`);
      else if (from === "player") navigate(`/tournament/${tournamentId}/play${usernameQuery}`);
      else if (window.history.length > 1) window.history.back();
      else navigate(`/tournament/${tournamentId}/play${usernameQuery}`);
    } else {
      navigate("/");
    }
  }, [tournamentId, navigate, search]);

  const isIdle = clockState === "idle";
  const isPaused = clockState === "paused";

  // Usernames for RegisterGameModal
  const p1Username = urlP1 ?? authP1Identity?.username ?? null;
  const p2Username = urlP2 ?? null;

  return (
    <div
      className="fixed inset-0 flex flex-col overflow-hidden"
      style={{ userSelect: "none", WebkitUserSelect: "none", background: FOREST_BG }}
    >
      {/* Player 2 — top half (rotated) */}
      <ClockHalf
        timeMs={p2TimeMs}
        isActive={clockState === "p2_running"}
        isFlagged={clockState === "p2_flagged"}
        isIdle={isIdle}
        isPaused={isPaused}
        flipped={true}
        moveCount={p2Moves}
        onTap={handleP2Tap}
        playerInfo={p2Identity}
      />

      {/* Center divider */}
      <div
        className="h-px z-10 relative flex-shrink-0"
        style={{ background: "rgba(34,197,94,0.2)" }}
      />

      {/* Player 1 — bottom half */}
      <ClockHalf
        timeMs={p1TimeMs}
        isActive={clockState === "p1_running"}
        isFlagged={clockState === "p1_flagged"}
        isIdle={isIdle}
        isPaused={isPaused}
        flipped={false}
        moveCount={p1Moves}
        onTap={handleP1Tap}
        playerInfo={p1Identity}
        identityLoading={!urlP1 && authIdentityLoading}
      />

      {/* Center controls overlay */}
      <CenterControls
        clockState={clockState}
        muted={sounds.muted}
        onPause={handlePause}
        onResume={handleResume}
        onReset={handleReset}
        onSettings={() => setShowSettings(true)}
        onBack={handleBack}
        onToggleMute={sounds.toggleMute}
        onRegisterGame={() => setShowRegisterGame(true)}
        showReset={clockState !== "idle"}
      />

      {/* Register Game modal */}
      <RegisterGameModal
        isOpen={showRegisterGame}
        onClose={() => setShowRegisterGame(false)}
        baseMinutes={Math.round(clockConfig.baseMs / 60000)}
        incrementSeconds={Math.round(clockConfig.incrementMs / 1000)}
        player1={p1Username ? { username: p1Username, rapid: p1Ratings?.rapid ?? authP1Identity?.rapid, blitz: p1Ratings?.blitz ?? authP1Identity?.blitz } : null}
        player2={p2Username ? { username: p2Username, rapid: p2Ratings?.rapid, blitz: p2Ratings?.blitz } : null}
        isTournamentMode={!!tournamentId}
        onGameReady={(sessionId) => {
          setActiveGameSessionId(sessionId);
          setShowRegisterGame(false);
        }}
      />

      {/* Settings panel */}
      {showSettings && (
        <SettingsPanel
          config={clockConfig}
          onApply={handleApplySettings}
          onClose={() => setShowSettings(false)}
          {...(!urlP2 ? {
            opponentUsername: standaloneOpponentUsername,
            onOpponentUsernameChange: setStandaloneOpponentUsername,
          } : {})}
        />
      )}

      {/* Game Result modal */}
      {showGameResult && activeGameSessionId && (
        <GameResultModal
          isOpen={showGameResult}
          onClose={() => {
            setShowGameResult(false);
            setActiveGameSessionId(null);
          }}
          sessionId={activeGameSessionId}
          flaggedPlayer={clockState === "p1_flagged" ? "p1" : clockState === "p2_flagged" ? "p2" : null}
        />
      )}

      {/* Reset confirmation */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div
            ref={resetDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="clock-reset-title"
            tabIndex={-1}
            className="rounded-3xl px-8 py-7 mx-6 text-center max-w-xs w-full"
            style={{ background: "#0d1f12", border: "1px solid rgba(34,197,94,0.2)" }}
          >
            <RotateCcw className="w-8 h-8 text-white/60 mx-auto mb-4" />
            <p id="clock-reset-title" className="text-white text-lg font-bold mb-2">Reset Clock?</p>
            <p className="text-white/50 text-sm mb-6">Both clocks will be reset to the starting time.</p>
            <div className="flex gap-3">
              <button
                ref={resetCancelRef}
                onClick={closeResetConfirm}
                className="flex-1 py-3 rounded-2xl text-white/70 font-semibold"
                style={{ background: "rgba(255,255,255,0.08)" }}
              >
                Cancel
              </button>
              <button
                onClick={() => doReset()}
                className="flex-1 py-3 rounded-2xl text-white font-bold"
                style={{ background: GREEN_ACTIVE }}
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
