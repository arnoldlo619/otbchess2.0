/**
 * RoundTimer — digital clock countdown for tournament rounds.
 * Default: 25 minutes. Director can tap the time display to edit duration.
 * Controls: Start / Pause / Reset.
 * When time reaches 0:00 the display flashes red.
 *
 * When `tournamentId` is provided, every state change is broadcast to the
 * server via PUT /api/tournament/:id/timer so spectators see the live timer.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { Play, Pause, RotateCcw, Pencil, Check, X } from "lucide-react";

export interface TimerSnapshot {
  status: "idle" | "running" | "paused" | "expired";
  durationSec: number;
  /** Wall-clock ms when the current running period started (0 if not running) */
  startWallMs: number;
  /** Total ms elapsed before the current running period (accumulated pauses) */
  elapsedAtPauseMs: number;
  savedAt: number;
}

interface RoundTimerProps {
  isDark: boolean;
  /** Initial minutes per round (default 25) */
  defaultMinutes?: number;
  /** Tournament slug — when provided, timer state is broadcast via SSE */
  tournamentId?: string;
  /** Called when director saves a new duration so parent can persist it */
  onDurationChange?: (minutes: number) => void;
}

async function pushSnapshot(tournamentId: string, snap: TimerSnapshot) {
  try {
    await fetch(`/api/tournament/${encodeURIComponent(tournamentId)}/timer`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(snap),
    });
  } catch {
    // Network error — fail silently; spectators will catch up on reconnect
  }
}

export function RoundTimer({
  isDark,
  defaultMinutes = 25,
  tournamentId,
  onDurationChange,
}: RoundTimerProps) {
  const [durationSec, setDurationSec] = useState(defaultMinutes * 60);
  const [remaining, setRemaining] = useState(defaultMinutes * 60);
  const [running, setRunning] = useState(false);
  const [expired, setExpired] = useState(false);
  // Accumulated elapsed ms before the current running period
  const elapsedAtPauseRef = useRef(0);
  // Wall-clock ms when the current running period started
  const startWallRef = useRef(0);

  // Edit-duration state
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(defaultMinutes));
  const inputRef = useRef<HTMLInputElement>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Broadcast helper ──────────────────────────────────────────────────────
  const broadcast = useCallback(
    (status: TimerSnapshot["status"], dur: number, elapsedMs: number, wallMs: number) => {
      if (!tournamentId) return;
      const snap: TimerSnapshot = {
        status,
        durationSec: dur,
        startWallMs: wallMs,
        elapsedAtPauseMs: elapsedMs,
        savedAt: Date.now(),
      };
      pushSnapshot(tournamentId, snap);
    },
    [tournamentId]
  );

  // ── Tick ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        const elapsed = (Date.now() - startWallRef.current) + elapsedAtPauseRef.current;
        const rem = Math.max(0, durationSec - elapsed / 1000);
        setRemaining(rem);
        if (rem <= 0) {
          clearInterval(intervalRef.current!);
          setRunning(false);
          setExpired(true);
          elapsedAtPauseRef.current = durationSec * 1000;
          broadcast("expired", durationSec, elapsedAtPauseRef.current, startWallRef.current);
        }
      }, 250);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running, durationSec, broadcast]);

  // ── Reset ─────────────────────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    setRunning(false);
    setRemaining(durationSec);
    setExpired(false);
    elapsedAtPauseRef.current = 0;
    startWallRef.current = 0;
    broadcast("idle", durationSec, 0, 0);
  }, [durationSec, broadcast]);

  // ── Start / Pause toggle ──────────────────────────────────────────────────
  const handleToggle = useCallback(() => {
    if (expired) return;
    if (running) {
      // Pause: accumulate elapsed
      const now = Date.now();
      elapsedAtPauseRef.current += now - startWallRef.current;
      setRunning(false);
      broadcast("paused", durationSec, elapsedAtPauseRef.current, 0);
    } else {
      // Start / Resume
      startWallRef.current = Date.now();
      setRunning(true);
      broadcast("running", durationSec, elapsedAtPauseRef.current, startWallRef.current);
    }
  }, [expired, running, durationSec, broadcast]);

  // ── Sync defaultMinutes prop ──────────────────────────────────────────────
  useEffect(() => {
    const secs = defaultMinutes * 60;
    setDurationSec(secs);
    setRemaining(secs);
    setRunning(false);
    setExpired(false);
    elapsedAtPauseRef.current = 0;
    startWallRef.current = 0;
  }, [defaultMinutes]);

  // ── Focus edit input ──────────────────────────────────────────────────────
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  // ── Commit edit ───────────────────────────────────────────────────────────
  const commitEdit = () => {
    const mins = Math.max(1, Math.min(180, parseInt(editValue, 10) || defaultMinutes));
    const secs = mins * 60;
    setDurationSec(secs);
    setRemaining(secs);
    setRunning(false);
    setExpired(false);
    elapsedAtPauseRef.current = 0;
    startWallRef.current = 0;
    setEditing(false);
    onDurationChange?.(mins);
    broadcast("idle", secs, 0, 0);
  };

  const cancelEdit = () => {
    setEditValue(String(Math.round(durationSec / 60)));
    setEditing(false);
  };

  // ── Display ───────────────────────────────────────────────────────────────
  const rem = Math.ceil(remaining);
  const mm = String(Math.floor(rem / 60)).padStart(2, "0");
  const ss = String(rem % 60).padStart(2, "0");

  const progress = durationSec > 0 ? remaining / durationSec : 0;
  const isWarning = progress <= 0.25 && remaining > 0;
  const isExpired = expired || remaining <= 0;

  const clockColor = isExpired
    ? "text-red-500"
    : isWarning
    ? isDark ? "text-amber-400" : "text-amber-600"
    : isDark ? "text-[#4CAF50]" : "text-[#2D6A35]";

  const separatorColor = isExpired
    ? "text-red-400/60"
    : isWarning
    ? isDark ? "text-amber-400/50" : "text-amber-500/50"
    : isDark ? "text-white/25" : "text-gray-300";

  return (
    <div
      className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl border transition-colors ${
        isExpired
          ? isDark ? "bg-red-500/08 border-red-500/25" : "bg-red-50 border-red-200"
          : isWarning
          ? isDark ? "bg-amber-500/08 border-amber-500/20" : "bg-amber-50 border-amber-200"
          : isDark ? "bg-white/05 border-white/10" : "bg-gray-50 border-gray-200"
      }`}
    >
      {/* Left: label */}
      <div className={`text-[9px] font-bold uppercase tracking-widest shrink-0 ${
        isExpired
          ? "text-red-400"
          : isWarning
          ? isDark ? "text-amber-400/70" : "text-amber-600/70"
          : isDark ? "text-white/30" : "text-gray-400"
      }`}>
        {isExpired ? "Time's Up" : running ? "Running" : "Round"}
      </div>

      {/* Center: clock display or edit input */}
      <div className="flex items-center gap-0 flex-1 justify-center">
        {editing ? (
          <div className="flex items-center gap-1.5">
            <input
              ref={inputRef}
              type="number"
              min={1}
              max={180}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitEdit();
                if (e.key === "Escape") cancelEdit();
              }}
              className={`w-14 text-center text-2xl font-black tabular-nums rounded-lg px-1 py-0.5 outline-none border ${
                isDark
                  ? "bg-white/10 border-white/20 text-white"
                  : "bg-white border-gray-300 text-gray-900"
              }`}
              style={{ fontFamily: "'Clash Display', monospace" }}
            />
            <span className={`text-sm font-semibold ${isDark ? "text-white/40" : "text-gray-400"}`}>min</span>
            <button onClick={commitEdit} className={`p-1 rounded-lg transition-colors ${isDark ? "text-[#4CAF50] hover:bg-[#4CAF50]/15" : "text-[#2D6A35] hover:bg-green-50"}`} title="Save">
              <Check className="w-3.5 h-3.5" />
            </button>
            <button onClick={cancelEdit} className={`p-1 rounded-lg transition-colors ${isDark ? "text-white/40 hover:bg-white/10" : "text-gray-400 hover:bg-gray-100"}`} title="Cancel">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => { if (!running) { setEditing(true); setEditValue(String(Math.round(durationSec / 60))); } }}
            title={running ? undefined : "Tap to edit duration"}
            className={`flex items-center gap-0 group ${running ? "cursor-default" : "cursor-pointer"}`}
          >
            <span
              className={`text-3xl font-black tabular-nums leading-none tracking-tight transition-colors ${clockColor} ${isExpired ? "animate-pulse" : ""}`}
              style={{ fontFamily: "'Clash Display', monospace" }}
            >{mm}</span>
            <span
              className={`text-2xl font-black mx-1 leading-none select-none transition-colors ${separatorColor}`}
              style={{ fontFamily: "'Clash Display', monospace" }}
            >:</span>
            <span
              className={`text-3xl font-black tabular-nums leading-none tracking-tight transition-colors ${clockColor} ${isExpired ? "animate-pulse" : ""}`}
              style={{ fontFamily: "'Clash Display', monospace" }}
            >{ss}</span>
            {!running && !isExpired && (
              <Pencil className={`w-3 h-3 ml-1.5 opacity-0 group-hover:opacity-60 transition-opacity ${isDark ? "text-white" : "text-gray-500"}`} />
            )}
          </button>
        )}
      </div>

      {/* Right: controls */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={handleToggle}
          disabled={isExpired}
          className={`p-1.5 rounded-lg transition-all active:scale-90 ${
            isExpired
              ? "opacity-30 cursor-not-allowed"
              : running
              ? isDark ? "text-amber-400 hover:bg-amber-400/15" : "text-amber-600 hover:bg-amber-50"
              : isDark ? "text-[#4CAF50] hover:bg-[#4CAF50]/15" : "text-[#2D6A35] hover:bg-green-50"
          }`}
          title={running ? "Pause" : "Start"}
        >
          {running ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </button>
        <button
          onClick={handleReset}
          className={`p-1.5 rounded-lg transition-all active:scale-90 ${
            isDark ? "text-white/35 hover:bg-white/10 hover:text-white/60" : "text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          }`}
          title="Reset timer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
