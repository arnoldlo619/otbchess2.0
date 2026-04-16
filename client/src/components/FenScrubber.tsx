import React, { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Camera, Clock } from "lucide-react";

export interface FenEntry {
  timestampMs: number;
  fen: string;
  confidence: number;
}

interface FenScrubberProps {
  fenTimeline: FenEntry[];
  /** Called when the user selects a FEN position (null = deselect / return to PGN mode) */
  onSelectFen: (entry: FenEntry | null) => void;
  /** Currently selected FEN entry (controlled) */
  selectedEntry: FenEntry | null;
  isDark: boolean;
}

function formatTimestamp(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

/**
 * FenScrubber — shows a horizontal timeline of detected board positions from
 * the CV pipeline. Clicking a position loads that FEN on the analysis board.
 * Keyboard left/right arrows navigate between positions when focused.
 */
export function FenScrubber({
  fenTimeline,
  onSelectFen,
  selectedEntry,
  isDark,
}: FenScrubberProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [_focusedIdx, _setFocusedIdx] = useState<number>(-1);

  const selectedIdx = selectedEntry
    ? fenTimeline.findIndex((e) => e.timestampMs === selectedEntry.timestampMs)
    : -1;

  // Scroll selected entry into view
  useEffect(() => {
    if (selectedIdx < 0 || !containerRef.current) return;
    const items = containerRef.current.querySelectorAll<HTMLButtonElement>(
      "[data-fen-item]"
    );
    items[selectedIdx]?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [selectedIdx]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (fenTimeline.length === 0) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        const next = Math.max(0, (selectedIdx >= 0 ? selectedIdx : fenTimeline.length) - 1);
        onSelectFen(fenTimeline[next]);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        const next = Math.min(fenTimeline.length - 1, selectedIdx + 1);
        onSelectFen(fenTimeline[next]);
      } else if (e.key === "Escape") {
        onSelectFen(null);
      }
    },
    [fenTimeline, selectedIdx, onSelectFen]
  );

  const handlePrev = () => {
    if (selectedIdx <= 0) return;
    onSelectFen(fenTimeline[selectedIdx - 1]);
  };

  const handleNext = () => {
    if (selectedIdx >= fenTimeline.length - 1) return;
    onSelectFen(fenTimeline[selectedIdx + 1]);
  };

  if (fenTimeline.length === 0) return null;

  const _totalDurationMs = fenTimeline[fenTimeline.length - 1].timestampMs;

  return (
    <div
      className={`rounded-2xl border p-4 space-y-3 ${
        isDark ? "bg-[#0f1f12] border-white/10" : "bg-white border-gray-200"
      }`}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      aria-label="Detected board positions scrubber"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Camera className="w-4 h-4 text-[#3D6B47]" />
          <span
            className={`text-sm font-semibold ${
              isDark ? "text-white" : "text-gray-900"
            }`}
          >
            Detected Positions
          </span>
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
              isDark ? "bg-white/10 text-white/50" : "bg-gray-100 text-gray-500"
            }`}
          >
            {fenTimeline.length} frames
          </span>
        </div>

        {/* Navigation arrows */}
        <div className="flex items-center gap-1">
          <button
            onClick={handlePrev}
            disabled={selectedIdx <= 0}
            className={`p-1.5 rounded-lg transition-colors ${
              selectedIdx <= 0
                ? isDark
                  ? "text-white/20"
                  : "text-gray-300"
                : isDark
                  ? "text-white/60 hover:bg-white/10"
                  : "text-gray-600 hover:bg-gray-100"
            }`}
            aria-label="Previous position"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={handleNext}
            disabled={selectedIdx >= fenTimeline.length - 1}
            className={`p-1.5 rounded-lg transition-colors ${
              selectedIdx >= fenTimeline.length - 1
                ? isDark
                  ? "text-white/20"
                  : "text-gray-300"
                : isDark
                  ? "text-white/60 hover:bg-white/10"
                  : "text-gray-600 hover:bg-gray-100"
            }`}
            aria-label="Next position"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          {selectedEntry && (
            <button
              onClick={() => onSelectFen(null)}
              className={`ml-1 text-[10px] px-2 py-1 rounded-lg transition-colors font-medium ${
                isDark
                  ? "bg-white/10 text-white/60 hover:bg-white/20"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              Back to PGN
            </button>
          )}
        </div>
      </div>

      {/* Timeline scrubber track */}
      <div className="relative">
        {/* Progress track */}
        <div
          className={`h-1 rounded-full mb-3 ${
            isDark ? "bg-white/10" : "bg-gray-200"
          }`}
        >
          {selectedIdx >= 0 && (
            <div
              className="h-full rounded-full bg-[#3D6B47] transition-all duration-200"
              style={{
                width: `${((selectedIdx + 1) / fenTimeline.length) * 100}%`,
              }}
            />
          )}
        </div>

        {/* Scrollable position dots */}
        <div
          ref={containerRef}
          className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide"
          style={{ scrollbarWidth: "none" }}
        >
          {fenTimeline.map((entry, idx) => {
            const isSelected = idx === selectedIdx;
            const confidence = entry.confidence;
            // Colour-code by confidence: high (>0.7) = green, mid (0.4-0.7) = amber, low = red
            const dotColor =
              confidence > 0.7
                ? isSelected
                  ? "bg-emerald-400"
                  : isDark
                    ? "bg-emerald-500/60"
                    : "bg-emerald-400/70"
                : confidence > 0.4
                  ? isSelected
                    ? "bg-amber-400"
                    : isDark
                      ? "bg-amber-500/60"
                      : "bg-amber-400/70"
                  : isSelected
                    ? "bg-red-400"
                    : isDark
                      ? "bg-red-500/50"
                      : "bg-red-400/60";

            return (
              <button
                key={entry.timestampMs}
                data-fen-item
                onClick={() => onSelectFen(isSelected ? null : entry)}
                className={`flex-shrink-0 flex flex-col items-center gap-1 px-2 py-1.5 rounded-lg transition-all ${
                  isSelected
                    ? isDark
                      ? "bg-[#3D6B47]/30 ring-1 ring-[#3D6B47]"
                      : "bg-[#3D6B47]/10 ring-1 ring-[#3D6B47]"
                    : isDark
                      ? "hover:bg-white/5"
                      : "hover:bg-gray-50"
                }`}
                title={`t=${formatTimestamp(entry.timestampMs)} · confidence ${Math.round(confidence * 100)}%`}
                aria-pressed={isSelected}
              >
                {/* Dot */}
                <span
                  className={`w-2 h-2 rounded-full transition-all ${dotColor} ${
                    isSelected ? "scale-125" : ""
                  }`}
                />
                {/* Timestamp label — only show every ~10th or if selected */}
                {(isSelected || idx % Math.max(1, Math.floor(fenTimeline.length / 8)) === 0) && (
                  <span
                    className={`text-[9px] font-mono ${
                      isSelected
                        ? isDark
                          ? "text-white/80"
                          : "text-gray-700"
                        : isDark
                          ? "text-white/30"
                          : "text-gray-400"
                    }`}
                  >
                    {formatTimestamp(entry.timestampMs)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected position info */}
      {selectedEntry && (
        <div
          className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs ${
            isDark ? "bg-white/5" : "bg-gray-50"
          }`}
        >
          <Clock className="w-3.5 h-3.5 text-[#3D6B47] flex-shrink-0" />
          <span className={isDark ? "text-white/60" : "text-gray-500"}>
            Position at{" "}
            <span className={`font-mono font-medium ${isDark ? "text-white/80" : "text-gray-800"}`}>
              {formatTimestamp(selectedEntry.timestampMs)}
            </span>
          </span>
          <span
            className={`ml-auto font-medium ${
              selectedEntry.confidence > 0.7
                ? "text-emerald-500"
                : selectedEntry.confidence > 0.4
                  ? "text-amber-500"
                  : "text-red-500"
            }`}
          >
            {Math.round(selectedEntry.confidence * 100)}% conf
          </span>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded font-mono truncate max-w-[120px] ${
              isDark ? "bg-white/10 text-white/40" : "bg-gray-200 text-gray-500"
            }`}
            title={selectedEntry.fen}
          >
            {selectedEntry.fen.split(" ")[0].slice(0, 18)}…
          </span>
        </div>
      )}

      {/* Hint */}
      <p className={`text-[10px] ${isDark ? "text-white/25" : "text-gray-400"}`}>
        Click a dot to view the detected board position · ← → to navigate · Esc to return to PGN
      </p>
    </div>
  );
}
