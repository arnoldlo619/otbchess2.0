/**
 * RoundTimer — digital clock countdown for tournament rounds.
 * Default: 25 minutes. Director can tap the time display to edit duration.
 * Controls: Start / Pause / Reset.
 * When time reaches 0:00 the display flashes red and an alert fires once.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { Play, Pause, RotateCcw, Pencil, Check, X } from "lucide-react";

interface RoundTimerProps {
  isDark: boolean;
  /** Initial minutes per round (default 25) */
  defaultMinutes?: number;
  /** Called when director saves a new duration so parent can persist it */
  onDurationChange?: (minutes: number) => void;
}

export function RoundTimer({ isDark, defaultMinutes = 25, onDurationChange }: RoundTimerProps) {
  const [totalSeconds, setTotalSeconds] = useState(defaultMinutes * 60);
  const [remaining, setRemaining] = useState(defaultMinutes * 60);
  const [running, setRunning] = useState(false);
  const [expired, setExpired] = useState(false);

  // Edit-duration state
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(defaultMinutes));
  const inputRef = useRef<HTMLInputElement>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const alertFiredRef = useRef(false);

  // Tick
  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(intervalRef.current!);
            setRunning(false);
            setExpired(true);
            if (!alertFiredRef.current) {
              alertFiredRef.current = true;
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running]);

  // Reset alert flag when timer resets
  const handleReset = useCallback(() => {
    setRunning(false);
    setRemaining(totalSeconds);
    setExpired(false);
    alertFiredRef.current = false;
  }, [totalSeconds]);

  // When defaultMinutes prop changes (e.g. loaded from saved state), sync
  useEffect(() => {
    const secs = defaultMinutes * 60;
    setTotalSeconds(secs);
    setRemaining(secs);
    setRunning(false);
    setExpired(false);
    alertFiredRef.current = false;
  }, [defaultMinutes]);

  // Focus input when editing starts
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commitEdit = () => {
    const mins = Math.max(1, Math.min(180, parseInt(editValue, 10) || defaultMinutes));
    const secs = mins * 60;
    setTotalSeconds(secs);
    setRemaining(secs);
    setRunning(false);
    setExpired(false);
    alertFiredRef.current = false;
    setEditing(false);
    onDurationChange?.(mins);
  };

  const cancelEdit = () => {
    setEditValue(String(Math.round(totalSeconds / 60)));
    setEditing(false);
  };

  // Format mm:ss
  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");

  // Progress 0→1
  const progress = totalSeconds > 0 ? remaining / totalSeconds : 0;
  const isWarning = progress <= 0.25 && remaining > 0;
  const isExpired = expired || remaining === 0;

  // Color logic
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
          ? isDark
            ? "bg-red-500/08 border-red-500/25"
            : "bg-red-50 border-red-200"
          : isWarning
          ? isDark
            ? "bg-amber-500/08 border-amber-500/20"
            : "bg-amber-50 border-amber-200"
          : isDark
          ? "bg-white/05 border-white/10"
          : "bg-gray-50 border-gray-200"
      }`}
    >
      {/* Left: label */}
      <div className={`text-[9px] font-bold uppercase tracking-widest shrink-0 ${
        isExpired ? "text-red-400" : isWarning ? isDark ? "text-amber-400/70" : "text-amber-600/70" : isDark ? "text-white/30" : "text-gray-400"
      }`}>
        {isExpired ? "Time's Up" : running ? "Running" : "Round"}
      </div>

      {/* Center: clock display or edit input */}
      <div className="flex items-center gap-1.5 flex-1 justify-center">
        {editing ? (
          /* Edit mode: minute input */
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
            <button
              onClick={commitEdit}
              className={`p-1 rounded-lg transition-colors ${isDark ? "text-[#4CAF50] hover:bg-[#4CAF50]/15" : "text-[#2D6A35] hover:bg-green-50"}`}
              title="Save"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={cancelEdit}
              className={`p-1 rounded-lg transition-colors ${isDark ? "text-white/40 hover:bg-white/10" : "text-gray-400 hover:bg-gray-100"}`}
              title="Cancel"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          /* Clock display */
          <button
            onClick={() => { if (!running) { setEditing(true); setEditValue(String(Math.round(totalSeconds / 60))); } }}
            title={running ? undefined : "Tap to edit duration"}
            className={`flex items-center gap-0 group ${running ? "cursor-default" : "cursor-pointer"}`}
          >
            <span
              className={`text-3xl font-black tabular-nums leading-none tracking-tight transition-colors ${clockColor} ${
                isExpired ? "animate-pulse" : ""
              }`}
              style={{ fontFamily: "'Clash Display', monospace" }}
            >
              {mm}
            </span>
            <span
              className={`text-2xl font-black mx-1 leading-none select-none transition-colors ${separatorColor}`}
              style={{ fontFamily: "'Clash Display', monospace" }}
            >
              :
            </span>
            <span
              className={`text-3xl font-black tabular-nums leading-none tracking-tight transition-colors ${clockColor} ${
                isExpired ? "animate-pulse" : ""
              }`}
              style={{ fontFamily: "'Clash Display', monospace" }}
            >
              {ss}
            </span>
            {/* Edit pencil — only when paused/stopped */}
            {!running && !isExpired && (
              <Pencil className={`w-3 h-3 ml-1.5 opacity-0 group-hover:opacity-60 transition-opacity ${isDark ? "text-white" : "text-gray-500"}`} />
            )}
          </button>
        )}
      </div>

      {/* Right: controls */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Start / Pause */}
        <button
          onClick={() => { if (!isExpired) setRunning((r) => !r); }}
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
        {/* Reset */}
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
