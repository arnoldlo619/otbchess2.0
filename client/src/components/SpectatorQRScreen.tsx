/**
 * SpectatorQRScreen
 * ─────────────────
 * Full-screen projection overlay for the director dashboard.
 * Designed to be displayed on a projector or large monitor so that
 * coaches, parents, and spectators can scan the QR code to open the
 * live tournament spectator view on their phones.
 *
 * When a round timer is active the overlay shows a large hero-style
 * scoreboard clock so players at the boards can read it from across
 * the room. Timer state is fetched on open and updated via SSE.
 */

import { useEffect, useState, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { X, Maximize2, Copy, Check, Tv2, ExternalLink } from "lucide-react";
import { toast } from "sonner";

// ─── Timer types (mirrors server TimerSnapshot) ───────────────────────────────
interface TimerSnap {
  status: "idle" | "running" | "paused" | "expired";
  durationSec: number;
  startWallMs: number;
  elapsedAtPauseMs: number;
  savedAt: number;
}

function calcRemaining(snap: TimerSnap): number {
  if (snap.status === "paused" || snap.status === "expired") {
    return Math.max(0, snap.durationSec - snap.elapsedAtPauseMs / 1000);
  }
  if (snap.status === "running") {
    const elapsed = (Date.now() - snap.startWallMs) / 1000 + snap.elapsedAtPauseMs / 1000;
    return Math.max(0, snap.durationSec - elapsed);
  }
  return snap.durationSec;
}

function fmtMmSs(sec: number): { mm: string; ss: string } {
  const s = Math.max(0, Math.ceil(sec));
  return {
    mm: String(Math.floor(s / 60)).padStart(2, "0"),
    ss: String(s % 60).padStart(2, "0"),
  };
}

// ─── Hero clock component ─────────────────────────────────────────────────────
function HeroClock({ snap }: { snap: TimerSnap }) {
  const [remaining, setRemaining] = useState(() => calcRemaining(snap));
  const rafRef = useRef<number | null>(null);
  const snapRef = useRef(snap);

  useEffect(() => {
    snapRef.current = snap;
    setRemaining(calcRemaining(snap));
  }, [snap]);

  useEffect(() => {
    const tick = () => {
      if (snapRef.current?.status === "running") {
        setRemaining(calcRemaining(snapRef.current));
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); };
  }, []);

  const progress = snap.durationSec > 0 ? Math.max(0, remaining / snap.durationSec) : 0;
  const isExpired = snap.status === "expired" || remaining <= 0;
  const isPaused  = snap.status === "paused";
  const isLow     = !isExpired && !isPaused && remaining <= 60;
  const isNear    = !isExpired && !isPaused && remaining <= 300;

  // Colour palette
  const accentHex = isExpired ? "#EF4444" : isLow ? "#F87171" : isNear || isPaused ? "#F59E0B" : "#4CAF50";
  const accentClass = isExpired
    ? "text-red-400"
    : isLow
    ? "text-red-400"
    : isNear || isPaused
    ? "text-amber-400"
    : "text-[#4CAF50]";

  const { mm, ss } = fmtMmSs(remaining);

  // SVG ring
  const SIZE = 220;
  const STROKE = 10;
  const R = (SIZE - STROKE) / 2;
  const CIRC = 2 * Math.PI * R;
  const dashOffset = CIRC * (1 - progress);

  const statusLabel = isExpired
    ? "Time's Up"
    : isPaused
    ? "Paused"
    : isLow
    ? "Final Minute"
    : isNear
    ? "Time Running Out"
    : "Round Timer";

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Status label */}
      <p
        className="text-xs font-bold uppercase tracking-[0.3em] select-none"
        style={{ color: accentHex + "99" }}
      >
        {statusLabel}
      </p>

      {/* Ring + clock */}
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        {/* Glow */}
        <div
          className="absolute inset-0 rounded-full blur-3xl scale-75 pointer-events-none"
          style={{ background: accentHex + "22" }}
        />

        {/* SVG ring */}
        <svg width={SIZE} height={SIZE} className="rotate-[-90deg] absolute inset-0">
          {/* Track */}
          <circle
            cx={SIZE / 2} cy={SIZE / 2} r={R}
            fill="none"
            stroke="rgba(255,255,255,0.07)"
            strokeWidth={STROKE}
          />
          {/* Progress arc */}
          <circle
            cx={SIZE / 2} cy={SIZE / 2} r={R}
            fill="none"
            stroke={accentHex}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRC}
            strokeDashoffset={dashOffset}
            style={{ transition: "stroke-dashoffset 0.5s linear, stroke 0.3s" }}
          />
        </svg>

        {/* Clock digits */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-0">
          <div
            className={`flex items-baseline gap-1 tabular-nums leading-none font-black ${accentClass} ${
              (isExpired || isLow) && !isPaused ? "animate-pulse" : ""
            }`}
            style={{ fontFamily: "'Clash Display', monospace" }}
          >
            <span style={{ fontSize: "clamp(3.5rem, 8vw, 5.5rem)" }}>{mm}</span>
            <span
              className="opacity-50"
              style={{ fontSize: "clamp(2.5rem, 5vw, 3.5rem)" }}
            >:</span>
            <span style={{ fontSize: "clamp(3.5rem, 8vw, 5.5rem)" }}>{ss}</span>
          </div>
          <p
            className="text-[10px] font-semibold uppercase tracking-[0.25em] mt-1 select-none"
            style={{ color: "rgba(255,255,255,0.25)" }}
          >
            {Math.round(progress * 100)}% remaining
          </p>
        </div>
      </div>

      {/* Paused / expired badge */}
      {(isPaused || isExpired) && (
        <div
          className="px-5 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest"
          style={{
            background: accentHex + "22",
            border: `1px solid ${accentHex}44`,
            color: accentHex,
          }}
        >
          {isExpired ? "⏰ Time's Up" : "⏸ Paused"}
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
interface SpectatorQRScreenProps {
  open: boolean;
  onClose: () => void;
  tournamentName: string;
  spectatorUrl: string;
  /** Tournament slug used to fetch timer state */
  tournamentId?: string;
}

export function SpectatorQRScreen({
  open,
  onClose,
  tournamentName,
  spectatorUrl,
  tournamentId,
}: SpectatorQRScreenProps) {
  const [copied, setCopied] = useState(false);
  const [timerSnap, setTimerSnap] = useState<TimerSnap | null>(null);
  const esRef = useRef<EventSource | null>(null);

  // ── Keyboard / scroll lock ──────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // ── Timer: fetch on open + subscribe to SSE ─────────────────────────────────
  useEffect(() => {
    if (!open || !tournamentId) return;

    // Catch-up fetch
    fetch(`/api/tournament/${encodeURIComponent(tournamentId)}/timer`)
      .then((r) => r.ok ? r.json() : null)
      .then((snap) => { if (snap && snap.status !== "idle") setTimerSnap(snap); })
      .catch(() => {});

    // SSE subscription
    const es = new EventSource(`/api/tournament/${encodeURIComponent(tournamentId)}/events`);
    esRef.current = es;
    es.addEventListener("timer_update", (e: MessageEvent) => {
      try {
        const snap: TimerSnap = JSON.parse(e.data);
        setTimerSnap(snap.status === "idle" ? null : snap);
      } catch { /* ignore */ }
    });
    return () => { es.close(); esRef.current = null; };
  }, [open, tournamentId]);

  if (!open) return null;

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const displayUrl = (() => {
    try {
      const u = new URL(spectatorUrl);
      return u.origin + u.pathname;
    } catch {
      return spectatorUrl.split("?")[0];
    }
  })();

  function copyLink() {
    navigator.clipboard.writeText(spectatorUrl);
    setCopied(true);
    toast.success("Spectator link copied!");
    setTimeout(() => setCopied(false), 2500);
  }

  const showTimer = timerSnap && timerSnap.status !== "idle";

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-[110] flex flex-col items-center justify-center overflow-auto"
      style={{ background: "oklch(0.13 0.06 240)" }}
      role="dialog"
      aria-modal="true"
      aria-label="Spectator QR projection screen"
    >
      {/* ── Close button ─────────────────────────────────────────────────────── */}
      <button
        onClick={onClose}
        aria-label="Close spectator QR screen"
        className="absolute top-4 right-4 sm:top-6 sm:right-6 w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-95 z-10"
        style={{ background: "rgba(255,255,255,0.08)" }}
        onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.16)")}
        onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
      >
        <X className="w-5 h-5 text-white/60" />
      </button>

      {/* ── Escape hint ──────────────────────────────────────────────────────── */}
      <div className="absolute top-4 left-4 sm:top-6 sm:left-6 flex items-center gap-1.5 text-white/25 text-xs select-none">
        <Maximize2 className="w-3.5 h-3.5" />
        <span className="hidden sm:block">Press Escape to close</span>
      </div>

      {/* ── Hero timer (shown when timer is active) ───────────────────────────── */}
      {showTimer && (
        <div className="w-full flex flex-col items-center pt-16 pb-6 px-6">
          <HeroClock snap={timerSnap!} />
          {/* Divider */}
          <div className="mt-8 w-full max-w-2xl h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
        </div>
      )}

      {/* ── Main content ─────────────────────────────────────────────────────── */}
      <div
        className={`flex flex-col lg:flex-row items-center justify-center gap-10 lg:gap-20 px-6 py-8 w-full max-w-5xl text-center lg:text-left ${
          showTimer ? "" : "mt-0"
        }`}
      >
        {/* Left column: title + live badge + instructions */}
        <div className="flex flex-col items-center lg:items-start gap-5 lg:max-w-xs">
          {/* Live badge */}
          <div
            className="flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-bold tracking-wide"
            style={{ background: "rgba(59,130,246,0.18)", color: "#93C5FD" }}
          >
            <span
              className="w-2 h-2 rounded-full bg-blue-400"
              style={{ animation: "pulse 1.5s ease-in-out infinite" }}
            />
            LIVE SPECTATOR VIEW
          </div>

          {/* Tournament name */}
          <div>
            <p className="text-white/40 text-xs font-semibold uppercase tracking-[0.2em] mb-2">
              Now watching
            </p>
            <h1
              className="text-white font-bold leading-tight text-3xl sm:text-4xl lg:text-5xl"
              style={{ fontFamily: "'Clash Display', sans-serif" }}
            >
              {tournamentName}
            </h1>
          </div>

          {/* Instruction text */}
          <p className="text-white/40 text-sm sm:text-base leading-relaxed">
            Scan the QR code to follow live standings, pairings, and results on your phone — no account needed.
          </p>

          {/* URL display */}
          <div
            className="flex items-center gap-2 px-4 py-3 rounded-xl w-full"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)" }}
          >
            <Tv2 className="w-4 h-4 flex-shrink-0" style={{ color: "#60A5FA" }} />
            <span className="text-white/55 text-xs font-mono truncate flex-1">
              {displayUrl}
            </span>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 w-full">
            <button
              onClick={copyLink}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all active:scale-95"
              style={{
                background: copied ? "#2563EB" : "rgba(59,130,246,0.15)",
                color: copied ? "#FFFFFF" : "#93C5FD",
                border: "1px solid rgba(59,130,246,0.25)",
              }}
            >
              {copied ? <Check className="w-4 h-4" strokeWidth={2.5} /> : <Copy className="w-4 h-4" />}
              {copied ? "Copied!" : "Copy Link"}
            </button>
            <a
              href={spectatorUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all active:scale-95"
              style={{
                background: "rgba(255,255,255,0.06)",
                color: "rgba(255,255,255,0.55)",
                border: "1px solid rgba(255,255,255,0.10)",
              }}
              title="Open spectator view"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>

        {/* Right column: large QR code */}
        <div className="relative flex-shrink-0">
          {/* Blue glow */}
          <div
            className="absolute inset-0 rounded-3xl blur-3xl scale-110 pointer-events-none"
            style={{ background: "rgba(59,130,246,0.20)" }}
          />

          {/* QR container */}
          <div className="relative p-6 sm:p-8 bg-white rounded-3xl shadow-2xl">
            <QRCodeSVG
              value={spectatorUrl}
              size={280}
              level="H"
              includeMargin={false}
              fgColor="#1E3A5F"
              bgColor="#ffffff"
            />
          </div>

          {/* Blue corner accent marks */}
          {(["top-0 left-0", "top-0 right-0", "bottom-0 left-0", "bottom-0 right-0"] as const).map((pos) => (
            <div
              key={pos}
              className={`absolute ${pos} w-7 h-7 ${
                pos.includes("top") && pos.includes("left")    ? "border-t-2 border-l-2 rounded-tl-2xl" :
                pos.includes("top") && pos.includes("right")   ? "border-t-2 border-r-2 rounded-tr-2xl" :
                pos.includes("bottom") && pos.includes("left") ? "border-b-2 border-l-2 rounded-bl-2xl" :
                "border-b-2 border-r-2 rounded-br-2xl"
              }`}
              style={{ borderColor: "#3B82F6" }}
            />
          ))}

          {/* "Scan to watch live" label below QR */}
          <p className="text-center text-white/30 text-xs font-semibold uppercase tracking-[0.2em] mt-4 select-none">
            Scan to watch live
          </p>
        </div>
      </div>

      {/* ── Bottom branding strip ─────────────────────────────────────────────── */}
      <div className="absolute bottom-5 flex items-center gap-2 text-white/15 text-xs select-none">
        <Tv2 className="w-3.5 h-3.5" />
        <span>OTB Chess · Live Spectator View</span>
      </div>
    </div>
  );
}
