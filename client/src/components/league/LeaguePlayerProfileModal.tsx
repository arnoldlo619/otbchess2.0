import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ExternalLink, History, X } from "lucide-react";
import { useAccessibleOverlay } from "@/hooks/useAccessibleOverlay";
import {
  chessComPlayerEndpoint,
  extractChessComRatings,
  normalizeChessComPlayerPayload,
  type ChessComRatingCategory,
  type ChessComRatings,
} from "@/lib/chessComPlayerPayload";
import "@/styles/leaguePlayerProfile.css";

export type LeagueProfilePlayer = {
  id: string;
  displayName: string;
  chesscomUsername?: string | null;
  avatarUrl?: string | null;
  rating?: number | null;
};

export type LeagueProfileRecentMatch = {
  id: string | number;
  weekNumber: number;
  opponentName: string;
  color: "white" | "black";
  outcome: "win" | "loss" | "draw";
  score: string;
};

type ChessComProfile = {
  title?: string;
  avatar?: string;
  url?: string;
};

const RATING_CATEGORIES: Array<{ key: ChessComRatingCategory; label: string }> =
  [
    { key: "rapid", label: "Rapid" },
    { key: "blitz", label: "Blitz" },
    { key: "bullet", label: "Bullet" },
    { key: "daily", label: "Daily" },
  ];

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function getBestRating(
  stats: Record<string, unknown>,
  category: ChessComRatingCategory
): number | null {
  const stat = stats[`chess_${category}`];
  if (!isRecord(stat)) return null;
  const best = stat.best;
  if (
    !isRecord(best) ||
    typeof best.rating !== "number" ||
    !Number.isFinite(best.rating) ||
    best.rating <= 0
  )
    return null;
  return best.rating;
}

function useRollingRating(value: number | null): number | null {
  const [displayValue, setDisplayValue] = useState<number | null>(value);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!value) {
      setDisplayValue(null);
      return;
    }

    const reducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      setDisplayValue(value);
      return;
    }

    const from = Math.max(0, value - Math.min(180, Math.round(value * 0.1)));
    const duration = 420;
    let startTime: number | null = null;

    const tick = (timestamp: number) => {
      if (startTime === null) startTime = timestamp;
      const progress = Math.min(1, (timestamp - startTime) / duration);
      const eased = 1 - Math.pow(1 - progress, 4);
      setDisplayValue(Math.round(from + (value - from) * eased));
      if (progress < 1) frameRef.current = requestAnimationFrame(tick);
    };

    setDisplayValue(from);
    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [value]);

  return displayValue;
}

function RatingTile({
  label,
  rating,
  best,
  isDark,
}: {
  label: string;
  rating: number | null;
  best: number | null;
  isDark: boolean;
}) {
  const displayRating = useRollingRating(rating);
  const textMain = isDark ? "oklch(0.95 0.02 145)" : "oklch(0.18 0.06 145)";
  const textMuted = isDark ? "oklch(0.74 0.04 145)" : "oklch(0.38 0.05 145)";

  return (
    <div
      className="min-w-0 rounded-2xl px-2.5 py-2.5 text-center"
      style={{
        background: isDark ? "oklch(0.22 0.06 145)" : "oklch(0.96 0.02 145)",
        border: `1px solid ${isDark ? "oklch(0.30 0.07 145)" : "oklch(0.88 0.03 145)"}`,
      }}
    >
      <div
        className="truncate text-[10px] font-semibold"
        style={{ color: textMuted }}
      >
        {label}
      </div>
      <div
        key={displayRating ?? "unavailable"}
        className="league-rating-ticker mt-1 text-[1.05rem] font-black leading-none tabular-nums"
        style={{ color: rating ? textMain : textMuted }}
        aria-label={
          rating ? `${label} rating ${rating}` : `${label} rating unavailable`
        }
      >
        {displayRating ?? "—"}
      </div>
      <div
        className="mt-1 h-3 text-[10px] leading-3 tabular-nums"
        style={{ color: textMuted }}
      >
        {best && best !== rating ? `Best ${best}` : "\u00a0"}
      </div>
    </div>
  );
}

export function LeaguePlayerProfileModal({
  player,
  recentMatches,
  isDark,
  onClose,
}: {
  player: LeagueProfilePlayer;
  recentMatches: LeagueProfileRecentMatch[];
  isDark: boolean;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [profile, setProfile] = useState<ChessComProfile | null>(null);
  const [stats, setStats] = useState<Record<string, unknown>>({});
  const [ratings, setRatings] = useState<ChessComRatings>({
    rapid: 0,
    blitz: 0,
    bullet: 0,
    daily: 0,
  });
  const [loading, setLoading] = useState(Boolean(player.chesscomUsername));
  const [error, setError] = useState<string | null>(null);

  useAccessibleOverlay({
    open: true,
    onClose,
    containerRef: dialogRef,
    initialFocusRef: closeButtonRef,
  });

  useEffect(() => {
    const username = player.chesscomUsername?.trim();
    if (!username) {
      setLoading(false);
      setProfile(null);
      setStats({});
      setRatings({ rapid: 0, blitz: 0, bullet: 0, daily: 0 });
      setError(null);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setProfile(null);
    setStats({});

    fetch(chessComPlayerEndpoint(username), { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error("profile_unavailable");
        return normalizeChessComPlayerPayload(await response.json(), username);
      })
      .then(payload => {
        setProfile(payload.profile as ChessComProfile);
        setStats(payload.stats);
        setRatings(extractChessComRatings(payload.stats));
      })
      .catch((requestError: unknown) => {
        if (
          requestError instanceof DOMException &&
          requestError.name === "AbortError"
        )
          return;
        setError("Could not load chess.com ratings");
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [player.chesscomUsername]);

  const background = isDark ? "oklch(0.18 0.05 145)" : "oklch(1 0 145)";
  const surface = isDark ? "oklch(0.22 0.06 145)" : "oklch(0.96 0.02 145)";
  const border = isDark ? "oklch(0.30 0.07 145)" : "oklch(0.88 0.03 145)";
  const textMain = isDark ? "oklch(0.95 0.02 145)" : "oklch(0.18 0.06 145)";
  const textMuted = isDark ? "oklch(0.74 0.04 145)" : "oklch(0.38 0.05 145)";
  const accent = isDark ? "oklch(0.72 0.17 145)" : "oklch(0.38 0.13 145)";
  const avatarUrl = profile?.avatar ?? player.avatarUrl;
  const chessComUrl =
    profile?.url ??
    (player.chesscomUsername
      ? `https://www.chess.com/member/${player.chesscomUsername}`
      : null);
  const fallbackRapid = player.rating && player.rating > 0 ? player.rating : 0;

  const outcomeColor = {
    win: accent,
    loss: isDark ? "oklch(0.72 0.18 25)" : "oklch(0.42 0.18 25)",
    draw: isDark ? "oklch(0.78 0.14 85)" : "oklch(0.45 0.15 80)",
  };
  const outcomeLabel = { win: "W", loss: "L", draw: "D" };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4 backdrop-blur-[2px]"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`${player.displayName} League profile`}
        tabIndex={-1}
        className="league-player-profile-modal max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-hidden rounded-3xl shadow-2xl"
        style={{ background, border: `1px solid ${border}` }}
      >
        <div
          className="relative flex min-h-20 items-start justify-between overflow-hidden px-5 py-4"
          style={{
            background: isDark
              ? "linear-gradient(135deg, oklch(0.23 0.09 145), oklch(0.18 0.06 145))"
              : "linear-gradient(135deg, oklch(0.91 0.08 145), oklch(0.98 0.02 145))",
            borderBottom: `1px solid ${border}`,
          }}
        >
          <div
            className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full"
            style={{ background: `${accent}1f`, filter: "blur(20px)" }}
          />
          <div className="relative">
            <p
              className="text-[10px] font-black uppercase tracking-[0.18em]"
              style={{ color: accent }}
            >
              League Player
            </p>
            <p
              className="mt-1 text-sm font-semibold"
              style={{ color: textMain }}
            >
              Profile & recent form
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="relative inline-flex h-11 w-11 items-center justify-center rounded-xl transition-transform duration-200 hover:scale-105 active:scale-95 focus:outline-none focus:ring-2"
            style={
              {
                color: textMuted,
                background: isDark
                  ? "oklch(0.15 0.04 145 / 0.70)"
                  : "rgba(255,255,255,0.78)",
                border: `1px solid ${border}`,
                "--tw-ring-color": accent,
              } as CSSProperties
            }
            aria-label="Close player profile"
          >
            <X size={17} aria-hidden="true" />
          </button>
        </div>

        <div className="max-h-[calc(100dvh-7rem)] overflow-y-auto px-5 pb-5 pt-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3.5">
              <div
                className="h-[76px] w-[76px] shrink-0 overflow-hidden rounded-2xl"
                style={{
                  background: surface,
                  border: `2px solid ${accent}66`,
                  boxShadow: "0 8px 20px rgba(0,0,0,0.22)",
                }}
              >
                {avatarUrl ? (
                  <img
                    loading="lazy"
                    decoding="async"
                    src={avatarUrl}
                    alt={`${player.displayName} avatar`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div
                    className="flex h-full w-full items-center justify-center text-xl font-black"
                    style={{ color: accent }}
                  >
                    {player.displayName
                      .split(" ")
                      .map(part => part[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase()}
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2
                    className="truncate text-xl font-black tracking-tight"
                    style={{ color: textMain }}
                  >
                    {player.displayName}
                  </h2>
                  {profile?.title && (
                    <span
                      className="rounded-md px-1.5 py-0.5 text-[10px] font-black"
                      style={{ background: `${accent}1c`, color: accent }}
                    >
                      {profile.title}
                    </span>
                  )}
                </div>
                {player.chesscomUsername ? (
                  <p
                    className="mt-0.5 truncate text-sm"
                    style={{ color: textMuted }}
                  >
                    @{player.chesscomUsername}
                  </p>
                ) : (
                  <p className="mt-0.5 text-sm" style={{ color: textMuted }}>
                    League competitor
                  </p>
                )}
              </div>
            </div>
            {chessComUrl && (
              <a
                href={chessComUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl px-3 text-xs font-bold transition-transform duration-200 hover:scale-[1.03] active:scale-95 focus:outline-none focus:ring-2"
                style={
                  {
                    color: accent,
                    background: `${accent}13`,
                    border: `1px solid ${accent}33`,
                    "--tw-ring-color": accent,
                  } as CSSProperties
                }
                aria-label={`Open ${player.displayName}'s chess.com profile`}
              >
                <ExternalLink size={13} aria-hidden="true" />
                <span className="hidden sm:inline">chess.com</span>
              </a>
            )}
          </div>

          <div className="my-5 h-px" style={{ background: border }} />

          <section aria-label="Chess.com ratings">
            <div className="mb-2.5 flex items-center justify-between">
              <h3 className="text-sm font-bold" style={{ color: textMain }}>
                Chess.com ratings
              </h3>
              <span
                className="text-[10px] font-semibold"
                style={{ color: textMuted }}
              >
                Live snapshot
              </span>
            </div>
            {loading ? (
              <div
                className="grid grid-cols-4 gap-2"
                aria-label="Loading ratings"
              >
                {RATING_CATEGORIES.map(({ key }) => (
                  <div
                    key={key}
                    className="h-[76px] animate-pulse rounded-2xl"
                    style={{ background: surface }}
                  />
                ))}
              </div>
            ) : error ? (
              <div
                className="rounded-2xl px-3 py-3 text-center text-xs"
                style={{ color: textMuted, background: surface }}
              >
                {error}
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {RATING_CATEGORIES.map(({ key, label }) => (
                  <RatingTile
                    key={key}
                    label={label}
                    rating={
                      ratings[key] ||
                      (key === "rapid" ? fallbackRapid : 0) ||
                      null
                    }
                    best={getBestRating(stats, key)}
                    isDark={isDark}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="mt-5" aria-label="Recent League matches">
            <div className="mb-2.5 flex items-center gap-2">
              <History size={15} style={{ color: accent }} aria-hidden="true" />
              <h3 className="text-sm font-bold" style={{ color: textMain }}>
                Recent League Matches
              </h3>
            </div>
            {recentMatches.length === 0 ? (
              <div
                className="rounded-2xl px-3 py-4 text-center text-xs"
                style={{ color: textMuted, background: surface }}
              >
                No completed matches yet
              </div>
            ) : (
              <div className="space-y-2">
                {recentMatches.slice(0, 5).map(match => (
                  <div
                    key={match.id}
                    className="flex items-center gap-3 rounded-2xl px-3 py-2.5"
                    style={{
                      background: surface,
                      border: `1px solid ${border}`,
                    }}
                  >
                    <span
                      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-black"
                      style={{
                        color: outcomeColor[match.outcome],
                        background: `${outcomeColor[match.outcome]}1f`,
                      }}
                    >
                      {outcomeLabel[match.outcome]}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p
                        className="truncate text-xs font-bold"
                        style={{ color: textMain }}
                      >
                        vs {match.opponentName}
                      </p>
                      <p
                        className="mt-0.5 text-[10px]"
                        style={{ color: textMuted }}
                      >
                        Week {match.weekNumber} ·{" "}
                        {match.color === "white" ? "White" : "Black"}
                      </p>
                    </div>
                    <span
                      className="shrink-0 text-xs font-black tabular-nums"
                      style={{ color: outcomeColor[match.outcome] }}
                    >
                      {match.score}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
