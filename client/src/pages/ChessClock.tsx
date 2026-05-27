/**
 * ChessClock — /tournament/:id/clock
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
 * - Check-in panel (idle state): each player enters their chess.com username
 *   to show their avatar in a head-to-head display.
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useSearch, useLocation } from "wouter";
import { Settings, RotateCcw, Pause, Play, X, ChevronLeft, Flag, Volume2, VolumeX, Trophy, UserCircle2, CheckCircle2, Loader2 } from "lucide-react";
import { NavLogo } from "@/components/NavLogo";
import { resolveTournament } from "@/lib/tournamentRegistry";
import { useClockSounds } from "@/hooks/useClockSounds";
import { RegisterGameModal } from "@/components/RegisterGameModal";
import { GameResultModal } from "@/components/GameResultModal";
import { useChessAvatar, toProxiedAvatarUrl } from "@/hooks/useChessAvatar";

// ─── Brand colors ─────────────────────────────────────────────────────────────
const FOREST_BG = "#0d1f12";        // landing page hero dark green
const GREEN_ACTIVE = "#22c55e";     // chess.com green (active clock)
const GREEN_DIM = "#1a3d22";        // dimmed green (inactive half, idle)
const RED_FLAG = "#c0392b";         // flagged

// ─── Types ────────────────────────────────────────────────────────────────────
type ClockState = "idle" | "p1_running" | "p2_running" | "paused" | "p1_flagged" | "p2_flagged";

interface ClockConfig {
  baseMs: number;
  incrementMs: number;
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
}: {
  config: ClockConfig;
  onApply: (cfg: ClockConfig) => void;
  onClose: () => void;
}) {
  const [baseMin, setBaseMin] = useState(Math.round(config.baseMs / 60000));
  const [incSec, setIncSec] = useState(Math.round(config.incrementMs / 1000));

  const apply = () => {
    onApply({ baseMs: baseMin * 60 * 1000, incrementMs: incSec * 1000 });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70">
      <div className="w-full max-w-sm rounded-t-3xl px-6 pt-6 pb-10 safe-bottom" style={{ background: "#0d1f12", border: "1px solid rgba(34,197,94,0.15)" }}>
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-6" />
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-white text-lg font-bold">Time Control</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10">
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
        <button onClick={apply} className="w-full py-4 rounded-2xl text-white text-base font-bold" style={{ background: GREEN_ACTIVE }}>
          Apply & Reset
        </button>
      </div>
    </div>
  );
}

// ─── Check-in Input Panel ─────────────────────────────────────────────────────
/**
 * Shown on each half when the clock is idle.
 * Lets the player type their chess.com username and confirms with their avatar.
 */
function CheckInPanel({
  flipped,
  username,
  onConfirm,
}: {
  flipped: boolean;
  username: string | null;
  onConfirm: (u: string) => void;
}) {
  const [input, setInput] = useState(username ?? "");
  const [submitted, setSubmitted] = useState(!!username);
  const { url: avatarUrl, status } = useChessAvatar(submitted ? input.trim() : null);
  const proxied = toProxiedAvatarUrl(avatarUrl);

  const handleSubmit = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    setSubmitted(true);
    onConfirm(trimmed);
  };

  const handleEdit = () => {
    setSubmitted(false);
    onConfirm("");
  };

  const content = (
    <div
      className="flex flex-col items-center justify-center gap-3 px-6 py-4 w-full"
      style={{ transform: flipped ? "rotate(180deg)" : "none" }}
    >
      {!submitted ? (
        <>
          {/* Icon placeholder */}
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center mb-1"
            style={{ background: "rgba(34,197,94,0.12)", border: "1.5px solid rgba(34,197,94,0.25)" }}
          >
            <UserCircle2 className="w-7 h-7" style={{ color: "rgba(34,197,94,0.6)" }} />
          </div>
          <p className="text-white/40 text-xs font-semibold uppercase tracking-widest">Check In</p>
          <div className="flex items-center gap-2 w-full max-w-[200px]">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder="chess.com username"
              className="flex-1 min-w-0 px-3 py-2 rounded-xl text-sm text-white placeholder-white/25 font-medium outline-none"
              style={{
                background: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(34,197,94,0.2)",
              }}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
            <button
              onClick={handleSubmit}
              disabled={!input.trim()}
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-opacity disabled:opacity-30"
              style={{ background: GREEN_ACTIVE }}
              aria-label="Confirm username"
            >
              <CheckCircle2 className="w-4 h-4 text-white" />
            </button>
          </div>
        </>
      ) : (
        <>
          {/* Avatar */}
          <div
            className="w-16 h-16 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(34,197,94,0.12)", border: "2px solid rgba(34,197,94,0.35)" }}
          >
            {status === "loading" ? (
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: GREEN_ACTIVE }} />
            ) : proxied ? (
              <img src={proxied} alt={input} className="w-full h-full object-cover" />
            ) : (
              <span className="text-white/70 text-xl font-bold uppercase">
                {input.trim().charAt(0)}
              </span>
            )}
          </div>
          <p className="text-white font-bold text-sm truncate max-w-[160px]">{input.trim()}</p>
          <button
            onClick={handleEdit}
            className="text-[11px] font-semibold px-3 py-1 rounded-full"
            style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.45)" }}
          >
            Change
          </button>
        </>
      )}
    </div>
  );

  return content;
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
  checkedInUsername,
  onCheckIn,
}: {
  timeMs: number;
  isActive: boolean;
  isFlagged: boolean;
  isIdle: boolean;
  isPaused: boolean;
  flipped: boolean;
  moveCount: number;
  onTap: () => void;
  checkedInUsername: string | null;
  onCheckIn: (u: string) => void;
}) {
  let bgColor: string;
  let textColor: string;

  if (isFlagged) {
    bgColor = RED_FLAG;
    textColor = "#ffffff";
  } else if (isIdle || isPaused) {
    bgColor = isActive ? GREEN_ACTIVE : GREEN_DIM;
    textColor = "#ffffff";
  } else if (isActive) {
    bgColor = GREEN_ACTIVE;
    textColor = "#ffffff";
  } else {
    bgColor = GREEN_DIM;
    textColor = "rgba(255,255,255,0.55)";
  }

  const displayTime = formatClockMs(timeMs);
  const isUrgent = isActive && !isFlagged && timeMs < 10_000 && timeMs > 0;

  // When idle, show the check-in panel overlaid on the half
  const showCheckIn = isIdle;

  return (
    <div
      className={`flex-1 w-full flex flex-col items-center justify-center select-none touch-none relative transition-colors duration-150 ${
        isUrgent ? "animate-pulse" : ""
      }`}
      style={{ backgroundColor: bgColor }}
      aria-label={flipped ? "Player 2 clock" : "Player 1 clock"}
    >
      {/* Full-area tap target — sits behind the check-in panel when idle */}
      <div
        onClick={onTap}
        className="absolute inset-0 z-0"
        role="button"
        aria-label={flipped ? "Player 2 clock" : "Player 1 clock"}
        tabIndex={0}
        onKeyDown={(e) => e.key === " " || e.key === "Enter" ? onTap() : undefined}
      />
      {/* Subtle grid texture overlay matching landing page */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(rgba(34,197,94,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(34,197,94,0.04) 1px, transparent 1px)`,
          backgroundSize: "32px 32px",
          opacity: isIdle ? 1 : 0.3,
          transition: "opacity 0.3s",
        }}
      />

      <div
        style={{
          transform: flipped ? "rotate(180deg)" : "none",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "0.5rem",
          position: "relative",
          zIndex: 1,
          width: "100%",
        }}
      >
        {/* Check-in panel — shown when idle, z-index above tap overlay */}
        {showCheckIn && (
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: "100%", position: "relative", zIndex: 2 }}
          >
            <CheckInPanel
              flipped={false}
              username={checkedInUsername}
              onConfirm={onCheckIn}
            />
          </div>
        )}

        {/* Time display */}
        <span
          style={{
            color: textColor,
            fontFamily: "'Clash Display', 'Inter', system-ui, sans-serif",
            fontWeight: 800,
            fontSize: showCheckIn ? "clamp(2.5rem, 12vw, 5rem)" : "clamp(3.5rem, 18vw, 7rem)",
            lineHeight: 1,
            letterSpacing: "-0.02em",
            fontVariantNumeric: "tabular-nums",
            transition: "color 0.15s, font-size 0.2s",
          }}
        >
          {displayTime}
        </span>

        {moveCount > 0 && (
          <span
            style={{
              color: isActive ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.35)",
              fontSize: "0.85rem",
              fontWeight: 600,
              letterSpacing: "0.05em",
            }}
          >
            {moveCount} {moveCount === 1 ? "move" : "moves"}
          </span>
        )}

        {isFlagged && (
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginTop: "0.25rem" }}>
            <Flag style={{ width: "1.25rem", height: "1.25rem", color: "rgba(255,255,255,0.9)" }} />
            <span style={{ color: "rgba(255,255,255,0.9)", fontWeight: 700, fontSize: "1rem" }}>
              Time&apos;s up
            </span>
          </div>
        )}
      </div>
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
      className="absolute left-0 right-0 flex items-center justify-center gap-3 z-10"
      style={{ top: "50%", transform: "translateY(-50%)" }}
    >
      <button
        onClick={onBack}
        className="w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-sm"
        style={{ background: "rgba(0,0,0,0.55)" }}
        aria-label="Back"
      >
        <ChevronLeft className="w-5 h-5 text-white/80" />
      </button>

      <div className="px-1 opacity-90">
        <NavLogo linked={false} className="h-6" />
      </div>

      {isRunning && (
        <button
          onClick={onPause}
          className="w-14 h-14 rounded-full flex items-center justify-center backdrop-blur-sm shadow-lg"
          style={{ background: "rgba(0,0,0,0.6)" }}
          aria-label="Pause"
        >
          <Pause className="w-6 h-6 text-white" />
        </button>
      )}
      {isPaused && (
        <button
          onClick={onResume}
          className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg"
          style={{ background: GREEN_ACTIVE }}
          aria-label="Resume"
        >
          <Play className="w-6 h-6 text-white fill-white" />
        </button>
      )}

      {(isFlagged || (showReset && (isPaused || isIdle))) && (
        <button
          onClick={onReset}
          className="w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-sm"
          style={{ background: "rgba(0,0,0,0.55)" }}
          aria-label="Reset"
        >
          <RotateCcw className="w-4 h-4 text-white/80" />
        </button>
      )}

      {(isIdle || isPaused) && (
        <button
          onClick={onSettings}
          className="w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-sm"
          style={{ background: "rgba(0,0,0,0.55)" }}
          aria-label="Settings"
        >
          <Settings className="w-4 h-4 text-white/80" />
        </button>
      )}

      <button
        onClick={onToggleMute}
        className="w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-sm"
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
          className="w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-sm"
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

  // Check-in usernames
  const [p1Username, setP1Username] = useState<string | null>(null);
  const [p2Username, setP2Username] = useState<string | null>(null);

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
      if (from === "director") navigate(`/tournament/${tournamentId}/manage`);
      else if (from === "player") navigate(`/tournament/${tournamentId}/play`);
      else if (window.history.length > 1) window.history.back();
      else navigate(`/tournament/${tournamentId}/play`);
    } else {
      navigate("/");
    }
  }, [tournamentId, navigate, search]);

  const _isFlagged = clockState === "p1_flagged" || clockState === "p2_flagged";
  const isIdle = clockState === "idle";
  const isPaused = clockState === "paused";

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
        checkedInUsername={p2Username}
        onCheckIn={(u) => setP2Username(u || null)}
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
        checkedInUsername={p1Username}
        onCheckIn={(u) => setP1Username(u || null)}
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
          <div className="rounded-3xl px-8 py-7 mx-6 text-center max-w-xs w-full" style={{ background: "#0d1f12", border: "1px solid rgba(34,197,94,0.2)" }}>
            <RotateCcw className="w-8 h-8 text-white/60 mx-auto mb-4" />
            <p className="text-white text-lg font-bold mb-2">Reset Clock?</p>
            <p className="text-white/50 text-sm mb-6">Both clocks will be reset to the starting time.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowResetConfirm(false)}
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
