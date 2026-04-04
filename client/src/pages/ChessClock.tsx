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
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useSearch, useLocation } from "wouter";
import { Settings, RotateCcw, Pause, Play, X, ChevronLeft, Flag, Volume2, VolumeX } from "lucide-react";
import { NavLogo } from "@/components/NavLogo";
import { resolveTournament } from "@/lib/tournamentRegistry";
import { useClockSounds } from "@/hooks/useClockSounds";

// ─── Types ────────────────────────────────────────────────────────────────────
type ClockState = "idle" | "p1_running" | "p2_running" | "paused" | "p1_flagged" | "p2_flagged";

interface ClockConfig {
  baseMs: number;      // starting time in milliseconds
  incrementMs: number; // increment per move in milliseconds
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
/** Format milliseconds as M:SS or H:MM:SS */
export function formatClockMs(ms: number): string {
  if (ms <= 0) return "0:00";
  const totalSec = Math.ceil(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Parse a "M+I" or "M" string into { baseMs, incrementMs } */
export function parseTimeControl(timePreset: string, timeBase: number, timeIncrement: number): ClockConfig {
  // Try to parse from preset string first (e.g. "10+5", "3+2", "30+0")
  const match = timePreset.match(/^(\d+(?:\.\d+)?)\+(\d+)$/);
  if (match) {
    return {
      baseMs: parseFloat(match[1]) * 60 * 1000,
      incrementMs: parseInt(match[2], 10) * 1000,
    };
  }
  // Fall back to explicit fields
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
      <div className="w-full max-w-sm bg-[#1a1a1a] rounded-t-3xl px-6 pt-6 pb-10 safe-bottom">
        {/* Handle */}
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-6" />

        <div className="flex items-center justify-between mb-6">
          <h2 className="text-white text-lg font-bold">Time Control</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10">
            <X className="w-4 h-4 text-white/70" />
          </button>
        </div>

        {/* Presets grid */}
        <div className="grid grid-cols-3 gap-2 mb-6">
          {TIME_PRESETS.map((p) => {
            const active = baseMin === p.base && incSec === p.inc;
            return (
              <button
                key={p.label}
                onClick={() => { setBaseMin(p.base); setIncSec(p.inc); }}
                className={`py-3 rounded-xl text-sm font-bold transition-all ${
                  active
                    ? "bg-[#5a9e5f] text-white"
                    : "bg-white/08 text-white/70 hover:bg-white/12"
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {/* Custom steppers */}
        <div className="flex gap-4 mb-6">
          {/* Minutes */}
          <div className="flex-1">
            <p className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-2">Minutes</p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setBaseMin((v) => Math.max(1, v - 1))}
                className="w-10 h-10 rounded-xl bg-white/08 text-white text-xl font-bold flex items-center justify-center"
              >−</button>
              <span className="flex-1 text-center text-white text-xl font-bold">{baseMin}</span>
              <button
                onClick={() => setBaseMin((v) => Math.min(180, v + 1))}
                className="w-10 h-10 rounded-xl bg-white/08 text-white text-xl font-bold flex items-center justify-center"
              >+</button>
            </div>
          </div>
          {/* Increment */}
          <div className="flex-1">
            <p className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-2">Increment (sec)</p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIncSec((v) => Math.max(0, v - 1))}
                className="w-10 h-10 rounded-xl bg-white/08 text-white text-xl font-bold flex items-center justify-center"
              >−</button>
              <span className="flex-1 text-center text-white text-xl font-bold">{incSec}</span>
              <button
                onClick={() => setIncSec((v) => Math.min(60, v + 1))}
                className="w-10 h-10 rounded-xl bg-white/08 text-white text-xl font-bold flex items-center justify-center"
              >+</button>
            </div>
          </div>
        </div>

        <button
          onClick={apply}
          className="w-full py-4 rounded-2xl bg-[#5a9e5f] text-white text-base font-bold"
        >
          Apply & Reset
        </button>
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
}: {
  timeMs: number;
  isActive: boolean;
  isFlagged: boolean;
  isIdle: boolean;
  isPaused: boolean;
  flipped: boolean;
  moveCount: number;
  onTap: () => void;
}) {
  // Color logic:
  // - Flagged: deep red
  // - Active: chess.com green
  // - Inactive (other player's turn): dark grey
  // - Idle: medium grey (both same)
  let bgColor: string;
  let textColor: string;

  if (isFlagged) {
    bgColor = "#c0392b";
    textColor = "#ffffff";
  } else if (isIdle || isPaused) {
    bgColor = isActive ? "#5a9e5f" : "#4a4a4a";
    textColor = "#ffffff";
  } else if (isActive) {
    bgColor = "#5a9e5f";
    textColor = "#ffffff";
  } else {
    bgColor = "#3a3a3a";
    textColor = "rgba(255,255,255,0.55)";
  }

  const displayTime = formatClockMs(timeMs);

  // Urgency: pulse when < 10 seconds and active
  const isUrgent = isActive && !isFlagged && timeMs < 10_000 && timeMs > 0;

  return (
    <button
      onClick={onTap}
      className={`flex-1 w-full flex flex-col items-center justify-center select-none touch-none relative transition-colors duration-150 ${
        isUrgent ? "animate-pulse" : ""
      }`}
      style={{ backgroundColor: bgColor }}
      aria-label={flipped ? "Player 2 clock" : "Player 1 clock"}
    >
      <div
        style={{
          transform: flipped ? "rotate(180deg)" : "none",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "0.5rem",
        }}
      >
        {/* Time display */}
        <span
          style={{
            color: textColor,
            fontFamily: "'Clash Display', 'Inter', system-ui, sans-serif",
            fontWeight: 800,
            fontSize: "clamp(3.5rem, 18vw, 7rem)",
            lineHeight: 1,
            letterSpacing: "-0.02em",
            fontVariantNumeric: "tabular-nums",
            transition: "color 0.15s",
          }}
        >
          {displayTime}
        </span>

        {/* Move count — shown after first move */}
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

        {/* Flagged indicator */}
        {isFlagged && (
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginTop: "0.25rem" }}>
            <Flag style={{ width: "1.25rem", height: "1.25rem", color: "rgba(255,255,255,0.9)" }} />
            <span style={{ color: "rgba(255,255,255,0.9)", fontWeight: 700, fontSize: "1rem" }}>
              Time's up
            </span>
          </div>
        )}
      </div>
    </button>
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
      {/* Back button */}
      <button
        onClick={onBack}
        className="w-10 h-10 rounded-full bg-black/40 flex items-center justify-center backdrop-blur-sm"
        aria-label="Back"
      >
        <ChevronLeft className="w-5 h-5 text-white/80" />
      </button>

      {/* OTB!! logo — centred brand mark */}
      <div className="px-1 opacity-90">
        <NavLogo linked={false} className="h-6" />
      </div>

      {/* Pause / Resume */}
      {isRunning && (
        <button
          onClick={onPause}
          className="w-14 h-14 rounded-full bg-black/50 flex items-center justify-center backdrop-blur-sm shadow-lg"
          aria-label="Pause"
        >
          <Pause className="w-6 h-6 text-white" />
        </button>
      )}
      {isPaused && (
        <button
          onClick={onResume}
          className="w-14 h-14 rounded-full bg-[#5a9e5f] flex items-center justify-center shadow-lg"
          aria-label="Resume"
        >
          <Play className="w-6 h-6 text-white fill-white" />
        </button>
      )}

      {/* Reset */}
      {(isFlagged || (showReset && (isPaused || isIdle))) && (
        <button
          onClick={onReset}
          className="w-10 h-10 rounded-full bg-black/40 flex items-center justify-center backdrop-blur-sm"
          aria-label="Reset"
        >
          <RotateCcw className="w-4 h-4 text-white/80" />
        </button>
      )}

      {/* Settings (only when idle or paused) */}
      {(isIdle || isPaused) && (
        <button
          onClick={onSettings}
          className="w-10 h-10 rounded-full bg-black/40 flex items-center justify-center backdrop-blur-sm"
          aria-label="Settings"
        >
          <Settings className="w-4 h-4 text-white/80" />
        </button>
      )}

      {/* Mute toggle — always visible */}
      <button
        onClick={onToggleMute}
        className="w-10 h-10 rounded-full bg-black/40 flex items-center justify-center backdrop-blur-sm"
        aria-label={muted ? "Unmute sounds" : "Mute sounds"}
      >
        {muted
          ? <VolumeX className="w-4 h-4 text-white/50" />
          : <Volume2 className="w-4 h-4 text-white/80" />
        }
      </button>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ChessClock() {
  const { id: tournamentId } = useParams<{ id: string }>();
  const search = useSearch();
  const [, navigate] = useLocation();

  // Resolve tournament config for time control
  const config = (() => {
    const tc = resolveTournament(tournamentId ?? "");
    if (tc) return parseTimeControl(tc.timePreset, tc.timeBase, tc.timeIncrement);
    // Try query params as fallback (e.g. ?base=5&inc=3)
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

  // Sound engine
  const sounds = useClockSounds();

  // Track the last whole-second value for the active player to fire warning ticks
  const lastWarnSecRef = useRef<number>(-1);
  // Track whether the flag alarm has already been played for the current flag event
  const flagAlarmFiredRef = useRef<boolean>(false);

  // Ref for the animation frame ticker
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(0);

  // Lock screen orientation to portrait when possible
  useEffect(() => {
    try {
      const orient = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
      orient?.lock?.("portrait").catch(() => {});
    } catch { /* ignore */ }
    return () => {
      try { screen.orientation?.unlock?.(); } catch { /* ignore */ }
    };
  }, []);

  // Prevent screen sleep via wake lock
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

  // Play flag alarm once when state transitions to flagged
  useEffect(() => {
    if ((clockState === "p1_flagged" || clockState === "p2_flagged") && !flagAlarmFiredRef.current) {
      flagAlarmFiredRef.current = true;
      sounds.flagAlarm();
    }
    // Reset the flag guard when clock is reset back to idle
    if (clockState === "idle") {
      flagAlarmFiredRef.current = false;
      lastWarnSecRef.current = -1;
    }
  }, [clockState, sounds]);

  // Ticker: runs only when a clock is active
  const tick = useCallback((now: number) => {
    const elapsed = lastTickRef.current ? now - lastTickRef.current : 0;
    lastTickRef.current = now;

    setClockState((state) => {
      if (state === "p1_running") {
        setP1TimeMs((t) => {
          const next = Math.max(0, t - elapsed);

          // Warning tick: fire once per second when < 10s remain
          if (next > 0 && next <= 10_000) {
            const secRemaining = Math.ceil(next / 1000);
            if (secRemaining !== lastWarnSecRef.current) {
              lastWarnSecRef.current = secRemaining;
              // Schedule outside render cycle
              setTimeout(() => sounds.warningTick(), 0);
            }
          }

          if (next <= 0) {
            setTimeout(() => setClockState("p1_flagged"), 0);
            return 0;
          }
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

          if (next <= 0) {
            setTimeout(() => setClockState("p2_flagged"), 0);
            return 0;
          }
          return next;
        });
      }
      return state;
    });

    rafRef.current = requestAnimationFrame(tick);
  }, [sounds]);

  // Start/stop the RAF loop based on clock state
  useEffect(() => {
    const isRunning = clockState === "p1_running" || clockState === "p2_running";
    if (isRunning) {
      lastTickRef.current = performance.now();
      rafRef.current = requestAnimationFrame(tick);
    } else {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    }
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [clockState, tick]);

  // ── Tap handlers ─────────────────────────────────────────────────────────────

  /** Player 1 (bottom) taps their half */
  const handleP1Tap = useCallback(() => {
    setClockState((state) => {
      if (state === "idle") {
        sounds.tap();
        return "p2_running";
      }
      if (state === "p1_running") {
        sounds.tap();
        setP1TimeMs((t) => t + clockConfig.incrementMs);
        setP1Moves((m) => m + 1);
        lastWarnSecRef.current = -1; // reset warning tracker on move
        return "p2_running";
      }
      if (state === "paused") return "paused";
      return state;
    });
  }, [clockConfig.incrementMs, sounds]);

  /** Player 2 (top) taps their half */
  const handleP2Tap = useCallback(() => {
    setClockState((state) => {
      if (state === "idle") {
        sounds.tap();
        return "p1_running";
      }
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
    if (state === "p1_flagged" || state === "p2_flagged") {
      doReset();
      return;
    }
    setShowResetConfirm(true);
  }, [clockState, doReset]);

  const handleApplySettings = useCallback((cfg: ClockConfig) => {
    setClockConfig(cfg);
    doReset(cfg);
  }, [doReset]);

  const handleBack = useCallback(() => {
    if (tournamentId) {
      // Honour the ?from= referrer so directors return to their dashboard
      // and players return to their player view.
      const params = new URLSearchParams(search);
      const from = params.get("from");
      if (from === "director") {
        navigate(`/tournament/${tournamentId}/manage`);
      } else if (from === "player") {
        navigate(`/tournament/${tournamentId}/play`);
      } else if (window.history.length > 1) {
        // Fallback: use browser history when no referrer is set
        window.history.back();
      } else {
        navigate(`/tournament/${tournamentId}/play`);
      }
    } else {
      navigate("/");
    }
  }, [tournamentId, navigate, search]);

  const isFlagged = clockState === "p1_flagged" || clockState === "p2_flagged";
  const isIdle = clockState === "idle";
  const isPaused = clockState === "paused";

  return (
    <div
      className="fixed inset-0 flex flex-col overflow-hidden"
      style={{ userSelect: "none", WebkitUserSelect: "none" }}
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
      />

      {/* Center divider line */}
      <div className="h-px bg-black/30 z-10 relative flex-shrink-0" />

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
        showReset={clockState !== "idle"}
      />

      {/* Settings panel */}
      {showSettings && (
        <SettingsPanel
          config={clockConfig}
          onApply={handleApplySettings}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* Reset confirmation */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="bg-[#1a1a1a] rounded-3xl px-8 py-7 mx-6 text-center max-w-xs w-full">
            <RotateCcw className="w-8 h-8 text-white/60 mx-auto mb-4" />
            <p className="text-white text-lg font-bold mb-2">Reset Clock?</p>
            <p className="text-white/50 text-sm mb-6">Both clocks will be reset to the starting time.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 py-3 rounded-2xl bg-white/08 text-white/70 font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={() => doReset()}
                className="flex-1 py-3 rounded-2xl bg-[#5a9e5f] text-white font-bold"
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
