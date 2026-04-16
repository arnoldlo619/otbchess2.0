/**
 * GameVideoPlayer
 *
 * Synced video player for the game analysis page.
 * - Loads the recording via GET /api/recordings/:sessionId/video (Range-request streaming)
 * - Seeks to moveTimestamps[moveIndex] whenever the active move changes
 * - "Watch Move" button plays a 3-second clip around the selected move then pauses
 * - Compact, dark-glass UI that fits in the right panel below the move list
 */
import { useRef, useEffect, useState, useCallback } from "react";
import {
  Play,
  Pause,
  SkipBack,
  Film,
  Volume2,
  VolumeX,
  Maximize2,
  Clapperboard,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MoveTimestamp {
  moveNumber: number;
  color?: string;
  timestamp: number; // seconds from video start
}

interface GameVideoPlayerProps {
  /** Recording session ID — used to build the streaming URL */
  sessionId: string;
  /** Parsed move timestamps from processedGames.moveTimestamps */
  moveTimestamps: MoveTimestamp[];
  /** Index into the analyses array (-1 = starting position) */
  currentMoveIndex: number;
  /** Total number of analyses (to clamp index) */
  totalMoves: number;
  isDark: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Format seconds as M:SS */
export function formatVideoTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Given a move index (0-based into analyses array) and a moveTimestamps array,
 * return the video timestamp in seconds for that move.
 * Returns null if no timestamp is available.
 */
export function seekTimeForMove(
  moveIndex: number,
  moveTimestamps: MoveTimestamp[]
): number | null {
  if (moveIndex < 0 || moveTimestamps.length === 0) return null;
  // moveTimestamps are 1-based moveNumber; analyses index 0 = move 1 white
  // index 0 → moveNumber 1 white, index 1 → moveNumber 1 black, etc.
  const moveNumber = Math.floor(moveIndex / 2) + 1;
  const color = moveIndex % 2 === 0 ? "w" : "b";
  // Try exact match first
  const exact = moveTimestamps.find(
    (t) => t.moveNumber === moveNumber && (t.color === color || t.color === undefined)
  );
  if (exact) return exact.timestamp;
  // Fall back to nearest moveNumber
  const byMoveNumber = moveTimestamps.filter((t) => t.moveNumber === moveNumber);
  if (byMoveNumber.length > 0) return byMoveNumber[0].timestamp;
  // Fall back to the closest moveNumber
  const sorted = [...moveTimestamps].sort(
    (a, b) => Math.abs(a.moveNumber - moveNumber) - Math.abs(b.moveNumber - moveNumber)
  );
  return sorted[0]?.timestamp ?? null;
}

/**
 * Compute start/end times for a 3-second "Watch Move" clip.
 * Starts 0.5s before the move timestamp, ends 2.5s after.
 */
export function clipTimings(
  seekTime: number,
  videoDuration: number
): { start: number; end: number } {
  const start = Math.max(0, seekTime - 0.5);
  const end = Math.min(videoDuration, seekTime + 2.5);
  return { start, end };
}

// ── Component ─────────────────────────────────────────────────────────────────

export function GameVideoPlayer({
  sessionId,
  moveTimestamps,
  currentMoveIndex,
  totalMoves: _totalMoves,
  isDark,
}: GameVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const clipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true); // muted by default (chess games are quiet)
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isWatchingClip, setIsWatchingClip] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [lastSeekedIndex, setLastSeekedIndex] = useState<number | null>(null);

  const videoUrl = `/api/recordings/${sessionId}/video`;

  // ── Seek to move when currentMoveIndex changes ─────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isLoaded || currentMoveIndex === lastSeekedIndex) return;

    const seekTime = seekTimeForMove(currentMoveIndex, moveTimestamps);
    if (seekTime === null) return;

    // Cancel any active clip timer
    if (clipTimerRef.current) {
      clearTimeout(clipTimerRef.current);
      clipTimerRef.current = null;
      setIsWatchingClip(false);
    }

    video.currentTime = seekTime;
    setLastSeekedIndex(currentMoveIndex);
    // Pause on seek — user can press play to watch from this point
    if (!video.paused) {
      video.pause();
      setIsPlaying(false);
    }
  }, [currentMoveIndex, moveTimestamps, isLoaded, lastSeekedIndex]);

  // ── Watch Move: play 3-second clip then pause ──────────────────────────────
  const handleWatchMove = useCallback(() => {
    const video = videoRef.current;
    if (!video || !isLoaded) return;

    const seekTime = seekTimeForMove(currentMoveIndex, moveTimestamps);
    if (seekTime === null) return;

    const { start, end } = clipTimings(seekTime, duration || video.duration || 0);

    // Clear any existing clip timer
    if (clipTimerRef.current) {
      clearTimeout(clipTimerRef.current);
    }

    video.currentTime = start;
    video.play().catch(() => {});
    setIsPlaying(true);
    setIsWatchingClip(true);

    const clipDurationMs = (end - start) * 1000;
    clipTimerRef.current = setTimeout(() => {
      if (videoRef.current) {
        videoRef.current.pause();
        setIsPlaying(false);
      }
      setIsWatchingClip(false);
      clipTimerRef.current = null;
    }, clipDurationMs);
  }, [currentMoveIndex, moveTimestamps, isLoaded, duration]);

  // ── Play / Pause toggle ────────────────────────────────────────────────────
  const handlePlayPause = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    // Cancel clip timer if user manually plays/pauses
    if (clipTimerRef.current) {
      clearTimeout(clipTimerRef.current);
      clipTimerRef.current = null;
      setIsWatchingClip(false);
    }

    if (video.paused) {
      video.play().catch(() => {});
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, []);

  // ── Mute toggle ───────────────────────────────────────────────────────────
  const handleMuteToggle = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  }, []);

  // ── Seek bar click ────────────────────────────────────────────────────────
  const handleSeekBarClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const video = videoRef.current;
      const bar = progressRef.current;
      if (!video || !bar || !duration) return;

      const rect = bar.getBoundingClientRect();
      const ratio = (e.clientX - rect.left) / rect.width;
      video.currentTime = Math.max(0, Math.min(duration, ratio * duration));
    },
    [duration]
  );

  // ── Jump to start ─────────────────────────────────────────────────────────
  const handleJumpToStart = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = 0;
    video.pause();
    setIsPlaying(false);
  }, []);

  // ── Fullscreen ────────────────────────────────────────────────────────────
  const handleFullscreen = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.requestFullscreen) video.requestFullscreen();
  }, []);

  // ── Video event listeners ─────────────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => setCurrentTime(video.currentTime);
    const onDurationChange = () => setDuration(video.duration);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onLoaded = () => {
      setIsLoaded(true);
      setDuration(video.duration);
    };
    const onError = () => setHasError(true);

    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("durationchange", onDurationChange);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("loadedmetadata", onLoaded);
    video.addEventListener("error", onError);

    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("durationchange", onDurationChange);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("loadedmetadata", onLoaded);
      video.removeEventListener("error", onError);
    };
  }, []);

  // ── Cleanup clip timer on unmount ─────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (clipTimerRef.current) clearTimeout(clipTimerRef.current);
    };
  }, []);

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const hasTimestamps = moveTimestamps.length > 0;
  const currentSeekTime = seekTimeForMove(currentMoveIndex, moveTimestamps);
  const canWatchMove = hasTimestamps && currentMoveIndex >= 0 && currentSeekTime !== null;

  // ── Error state ───────────────────────────────────────────────────────────
  if (hasError) {
    return (
      <div
        className={`rounded-xl border p-4 flex items-center gap-3 ${
          isDark ? "border-white/10 bg-white/5" : "border-gray-200 bg-gray-50"
        }`}
      >
        <Film className={`w-5 h-5 flex-shrink-0 ${isDark ? "text-white/30" : "text-gray-400"}`} />
        <div>
          <p className={`text-xs font-medium ${isDark ? "text-white/50" : "text-gray-500"}`}>
            Video unavailable
          </p>
          <p className={`text-[10px] ${isDark ? "text-white/30" : "text-gray-400"}`}>
            The recording could not be loaded.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border overflow-hidden ${
        isDark ? "border-white/10 bg-[#0a1a0c]" : "border-gray-200 bg-gray-900"
      }`}
    >
      {/* Section header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10">
        <Clapperboard className="w-3.5 h-3.5 text-[#4ade80]" />
        <span className="text-xs font-semibold text-white/70">Recording</span>
        {isWatchingClip && (
          <span className="ml-auto text-[10px] font-medium text-[#4ade80] animate-pulse">
            ● Watching clip
          </span>
        )}
      </div>

      {/* Video element */}
      <div className="relative bg-black aspect-video">
        <video
          ref={videoRef}
          src={videoUrl}
          muted={isMuted}
          playsInline
          preload="metadata"
          className="w-full h-full object-contain"
          onClick={handlePlayPause}
        />

        {/* Loading overlay */}
        {!isLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <div className="flex flex-col items-center gap-2">
              <Film className="w-8 h-8 text-white/30 animate-pulse" />
              <span className="text-[10px] text-white/40">Loading video…</span>
            </div>
          </div>
        )}

        {/* Move marker dots on seek bar (rendered as absolute overlays) */}
        {isLoaded && hasTimestamps && duration > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 pointer-events-none">
            {moveTimestamps.map((mt, i) => {
              const pct = (mt.timestamp / duration) * 100;
              return (
                <div
                  key={i}
                  className="absolute top-0 w-0.5 h-full bg-[#4ade80]/60"
                  style={{ left: `${pct}%` }}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="px-3 py-2 space-y-2">
        {/* Seek bar */}
        <div
          ref={progressRef}
          onClick={handleSeekBarClick}
          className="relative h-1.5 rounded-full bg-white/10 cursor-pointer group"
        >
          <div
            className="absolute left-0 top-0 h-full rounded-full bg-[#4ade80] transition-all"
            style={{ width: `${progressPercent}%` }}
          />
          {/* Scrubber thumb */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ left: `calc(${progressPercent}% - 6px)` }}
          />
        </div>

        {/* Time + buttons row */}
        <div className="flex items-center gap-2">
          {/* Jump to start */}
          <button
            onClick={handleJumpToStart}
            title="Jump to start"
            className="p-1 rounded text-white/40 hover:text-white/80 transition-colors"
          >
            <SkipBack className="w-3.5 h-3.5" />
          </button>

          {/* Play / Pause */}
          <button
            onClick={handlePlayPause}
            disabled={!isLoaded}
            title={isPlaying ? "Pause" : "Play"}
            className={`p-1.5 rounded-lg transition-colors ${
              isLoaded
                ? "text-white hover:bg-white/10"
                : "text-white/20 cursor-not-allowed"
            }`}
          >
            {isPlaying ? (
              <Pause className="w-4 h-4" />
            ) : (
              <Play className="w-4 h-4" />
            )}
          </button>

          {/* Time display */}
          <span className="text-[10px] font-mono text-white/40 tabular-nums">
            {formatVideoTime(currentTime)} / {formatVideoTime(duration)}
          </span>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Mute toggle */}
          <button
            onClick={handleMuteToggle}
            title={isMuted ? "Unmute" : "Mute"}
            className="p-1 rounded text-white/40 hover:text-white/80 transition-colors"
          >
            {isMuted ? (
              <VolumeX className="w-3.5 h-3.5" />
            ) : (
              <Volume2 className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Fullscreen */}
          <button
            onClick={handleFullscreen}
            title="Fullscreen"
            className="p-1 rounded text-white/40 hover:text-white/80 transition-colors"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Watch Move button */}
        {canWatchMove && (
          <button
            onClick={handleWatchMove}
            disabled={!isLoaded}
            className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all ${
              isWatchingClip
                ? "bg-[#4ade80]/20 text-[#4ade80] border border-[#4ade80]/30"
                : isLoaded
                  ? "bg-[#3D6B47] hover:bg-[#4a7d55] text-white"
                  : "bg-white/5 text-white/20 cursor-not-allowed"
            }`}
          >
            <Film className="w-3.5 h-3.5" />
            {isWatchingClip ? "Playing clip…" : "Watch Move"}
          </button>
        )}

        {/* No timestamps message */}
        {!hasTimestamps && isLoaded && (
          <p className="text-[10px] text-white/30 text-center pb-1">
            Move timestamps not available — navigate manually
          </p>
        )}
      </div>
    </div>
  );
}
