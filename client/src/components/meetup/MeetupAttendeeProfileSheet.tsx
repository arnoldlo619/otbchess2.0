import { useEffect, useRef, useState } from "react";
import { ExternalLink, Gauge, X, Zap } from "lucide-react";
import { useAccessibleOverlay } from "@/hooks/useAccessibleOverlay";
import { authFetch } from "@/lib/apiFetch";
import { chessComPlayerEndpoint, extractChessComRatings, normalizeChessComPlayerPayload } from "@/lib/chessComPlayerPayload";

export interface MeetupAttendeeProfile {
  displayName: string;
  avatarUrl: string | null;
  chesscomUsername: string | null;
  rapid: number | null;
  blitz: number | null;
}

interface MeetupAttendeeProfileSheetProps {
  attendee: MeetupAttendeeProfile | null;
  accentColor: string;
  onClose: () => void;
}

function RatingTile({
  label,
  rating,
  loading,
  icon,
  accentColor,
}: {
  label: "Rapid" | "Blitz";
  rating: number | null;
  loading: boolean;
  icon: "rapid" | "blitz";
  accentColor: string;
}) {
  const Icon = icon === "rapid" ? Gauge : Zap;
  const color = icon === "rapid" ? accentColor : "#f59e0b";

  return (
    <div
      className="rounded-2xl px-4 py-3"
      style={{
        background: "oklch(0.16 0.045 145)",
        border: `1px solid ${color}33`,
      }}
    >
      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5" style={{ color }} aria-hidden="true" />
        <span className="text-[10px] font-black uppercase tracking-[0.14em] text-white/50">{label}</span>
      </div>
      <p className="mt-1 text-2xl font-black tabular-nums text-white">
        {loading ? "…" : rating ?? "—"}
      </p>
    </div>
  );
}

/**
 * A lightweight, read-only attendee preview for meetup check-in. It intentionally
 * limits the surface to the public identity and the two requested Chess.com ratings.
 */
export function MeetupAttendeeProfileSheet({
  attendee,
  accentColor,
  onClose,
}: MeetupAttendeeProfileSheetProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const isOpen = attendee !== null;
  const [ratings, setRatings] = useState<{ rapid: number | null; blitz: number | null }>({ rapid: null, blitz: null });
  const [loadingRatings, setLoadingRatings] = useState(false);

  useAccessibleOverlay({
    open: isOpen,
    onClose,
    containerRef: dialogRef,
    initialFocusRef: closeButtonRef,
  });

  useEffect(() => {
    const username = attendee?.chesscomUsername;
    setRatings({ rapid: attendee?.rapid ?? null, blitz: attendee?.blitz ?? null });
    if (!username) {
      setLoadingRatings(false);
      return;
    }

    let active = true;
    setLoadingRatings(true);
    authFetch(chessComPlayerEndpoint(username))
      .then(async (response) => {
        if (!response.ok) throw new Error("Chess.com profile unavailable");
        const payload = normalizeChessComPlayerPayload(await response.json(), username);
        const snapshot = extractChessComRatings(payload.stats);
        if (active) setRatings({ rapid: snapshot.rapid || null, blitz: snapshot.blitz || null });
      })
      .catch(() => {
        if (active) setRatings({ rapid: null, blitz: null });
      })
      .finally(() => {
        if (active) setLoadingRatings(false);
      });

    return () => {
      active = false;
    };
  }, [attendee?.blitz, attendee?.chesscomUsername, attendee?.rapid]);

  if (!attendee) return null;

  const profileUrl = attendee.chesscomUsername
    ? `https://www.chess.com/member/${attendee.chesscomUsername}`
    : null;
  const initial = attendee.displayName.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center p-0 sm:items-center sm:p-5">
      <button
        type="button"
        aria-label="Close attendee profile"
        className="absolute inset-0 cursor-default bg-black/65 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`${attendee.displayName} profile`}
        tabIndex={-1}
        className="relative w-full max-w-md overflow-hidden rounded-t-[28px] border bg-[oklch(0.125_0.04_145)] p-5 shadow-2xl sm:rounded-[28px]"
        style={{ borderColor: `${accentColor}44` }}
      >
        <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full blur-3xl" style={{ background: `${accentColor}24` }} />
        <div className="relative flex justify-between gap-4">
          <p className="pt-1 text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: accentColor }}>
            Checked-in player
          </p>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl border text-white/60 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            style={{ borderColor: "rgba(255,255,255,0.12)" }}
            aria-label="Close player profile"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="relative mt-4 flex items-center gap-4">
          <div
            className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-2xl border-2"
            style={{ background: "oklch(0.20 0.05 145)", borderColor: `${accentColor}88` }}
          >
            {attendee.avatarUrl ? (
              <img
                loading="lazy"
                decoding="async"
                src={attendee.avatarUrl}
                alt={`${attendee.displayName} avatar`}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xl font-black" style={{ color: accentColor }}>
                {initial}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-xl font-black text-white" style={{ fontFamily: "'Clash Display', sans-serif" }}>
              {attendee.displayName}
            </h2>
            {attendee.chesscomUsername ? (
              <p className="mt-0.5 truncate text-sm text-white/55">@{attendee.chesscomUsername}</p>
            ) : (
              <p className="mt-0.5 text-sm text-white/45">Chess.com profile not connected</p>
            )}
          </div>
        </div>

        <div className="relative mt-5 grid grid-cols-2 gap-3">
          <RatingTile label="Rapid" rating={ratings.rapid} loading={loadingRatings} icon="rapid" accentColor={accentColor} />
          <RatingTile label="Blitz" rating={ratings.blitz} loading={loadingRatings} icon="blitz" accentColor={accentColor} />
        </div>

        {profileUrl ? (
          <a
            href={profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="relative mt-4 flex min-h-11 items-center justify-center gap-2 rounded-xl border text-sm font-bold transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            style={{ color: accentColor, borderColor: `${accentColor}55`, background: `${accentColor}12` }}
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            View on Chess.com
          </a>
        ) : (
          <p className="relative mt-4 text-center text-xs leading-relaxed text-white/40">
            Rapid and Blitz ratings appear here when this attendee connects a Chess.com account.
          </p>
        )}
      </div>
    </div>
  );
}
