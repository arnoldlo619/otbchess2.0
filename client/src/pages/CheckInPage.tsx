/**
 * CheckInPage — /checkin/:eventId
 *
 * Public QR-code landing page for club meetup check-ins.
 * - Logged-in members tap "Check In" to mark attendance
 * - After check-in, shows all checked-in attendees with chess.com ratings
 * - Guests are prompted to sign in first
 */
import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "wouter";
import {
  CheckCircle,
  Users,
  Calendar,
  Clock,
  MapPin,
  ExternalLink,
  LogIn,
  Loader2,
} from "lucide-react";
import { useAuthContext } from "@/context/AuthContext";
import {
  getClubEvent,
  checkInToEvent,
  getCheckedInUserIds,
  type ClubEvent,
} from "@/lib/clubEventRegistry";
import { getClubMembers } from "@/lib/clubRegistry";
import { authFetch } from "@/lib/apiFetch";

interface AttendeeWithRating {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  chesscomUsername: string | null;
  rapid: number | null;
  blitz: number | null;
}

function formatEventDate(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function formatEventTime(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

async function fetchChessComRating(username: string): Promise<{ rapid: number | null; blitz: number | null }> {
  try {
    const res = await authFetch(`/api/chess/player/${encodeURIComponent(username.toLowerCase())}`);
    if (!res.ok) return { rapid: null, blitz: null };
    const data = await res.json() as { stats?: Record<string, Record<string, Record<string, number>>> };
    const rapid = data.stats?.chess_rapid?.last?.rating ?? null;
    const blitz = data.stats?.chess_blitz?.last?.rating ?? null;
    return { rapid, blitz };
  } catch {
    return { rapid: null, blitz: null };
  }
}

export default function CheckInPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const { user } = useAuthContext();

  const [event, setEvent] = useState<ClubEvent | null>(null);
  const [checkedIn, setCheckedIn] = useState<string[]>([]);
  const [attendees, setAttendees] = useState<AttendeeWithRating[]>([]);
  const [hasCheckedIn, setHasCheckedIn] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [loadingRatings, setLoadingRatings] = useState(false);

  const refresh = useCallback(async () => {
    if (!eventId) return;
    const ev = getClubEvent(eventId);
    setEvent(ev);
    if (!ev) return;

    const ids = getCheckedInUserIds(eventId);
    setCheckedIn(ids);

    if (user) {
      setHasCheckedIn(ids.includes(user.id));
    }

    // Build attendee list with ratings
    const members = getClubMembers(ev.clubId);
    setLoadingRatings(true);
    const list: AttendeeWithRating[] = await Promise.all(
      ids.map(async (uid) => {
        const member = members.find((m) => m.userId === uid);
        let rapid: number | null = null;
        let blitz: number | null = null;
        if (member?.chesscomUsername) {
          const ratings = await fetchChessComRating(member.chesscomUsername);
          rapid = ratings.rapid;
          blitz = ratings.blitz;
        }
        return {
          userId: uid,
          displayName: member?.displayName ?? uid,
          avatarUrl: member?.avatarUrl ?? null,
          chesscomUsername: member?.chesscomUsername ?? null,
          rapid,
          blitz,
        };
      })
    );
    setAttendees(list);
    setLoadingRatings(false);
  }, [eventId, user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleCheckIn() {
    if (!user || !event) return;
    setCheckingIn(true);
    checkInToEvent(event.id, user.id);
    await refresh();
    setCheckingIn(false);
  }

  const accentColor = event?.accentColor ?? "#4CAF50";

  if (!event) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "oklch(0.10 0.04 145)" }}>
        <div className="text-white/40 text-sm">Event not found.</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-16" style={{ background: "oklch(0.10 0.04 145)" }}>
      {/* Header */}
      <div
        className="sticky top-0 z-50 px-4 py-3 border-b border-white/08 flex items-center justify-between"
        style={{ background: "oklch(0.12 0.04 145)" }}
      >
        <Link
          href={`/clubs/${event.clubId}/meetup/${event.id}`}
          className="text-white/50 hover:text-white text-sm font-semibold transition-colors"
        >
          ← Event Page
        </Link>
        <span className="text-white/30 text-xs">Club Meetup Check-in</span>
      </div>

      <div className="max-w-md mx-auto px-4 pt-8 space-y-6">
        {/* Event summary */}
        <div
          className="rounded-3xl px-6 py-6 text-center"
          style={{
            background: `linear-gradient(135deg, ${accentColor}22 0%, oklch(0.14 0.05 145) 100%)`,
            border: `1px solid ${accentColor}33`,
          }}
        >
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: accentColor + "22" }}
          >
            <Users className="w-7 h-7" style={{ color: accentColor }} />
          </div>
          <h1
            className="text-2xl font-black text-white mb-2"
            style={{ fontFamily: "'Clash Display', sans-serif" }}
          >
            {event.title}
          </h1>
          <div className="flex flex-col items-center gap-1.5 text-sm text-white/60">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" style={{ color: accentColor }} />
              {formatEventDate(event.startAt)}
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" style={{ color: accentColor }} />
              {formatEventTime(event.startAt)}
              {event.endAt && ` – ${formatEventTime(event.endAt)}`}
            </div>
            {event.venue && (
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" style={{ color: accentColor }} />
                {event.venue}
              </div>
            )}
          </div>
        </div>

        {/* Check-in action */}
        {!user ? (
          <div
            className="rounded-2xl px-6 py-6 text-center"
            style={{ background: "oklch(0.14 0.05 145)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <LogIn className="w-8 h-8 text-white/30 mx-auto mb-3" />
            <p className="text-white/60 text-sm mb-4">Sign in to check in to this meetup</p>
            <Link
              href={`/`}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all"
              style={{ background: accentColor, color: "#0a1a0f" }}
            >
              <LogIn className="w-4 h-4" />
              Sign In
            </Link>
          </div>
        ) : hasCheckedIn ? (
          <div
            className="rounded-2xl px-6 py-5 flex items-center gap-4"
            style={{ background: "rgba(76,175,80,0.12)", border: "1px solid rgba(76,175,80,0.30)" }}
          >
            <CheckCircle className="w-8 h-8 flex-shrink-0" style={{ color: accentColor }} />
            <div>
              <div className="text-white font-bold">You're checked in!</div>
              <div className="text-white/50 text-xs mt-0.5">Your attendance has been recorded.</div>
            </div>
          </div>
        ) : (
          <button
            onClick={handleCheckIn}
            disabled={checkingIn}
            className="w-full py-4 rounded-2xl text-base font-bold flex items-center justify-center gap-2 transition-all active:scale-98 disabled:opacity-60"
            style={{ background: accentColor, color: "#0a1a0f" }}
          >
            {checkingIn ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <CheckCircle className="w-5 h-5" />
            )}
            {checkingIn ? "Checking in…" : "Check In to Meetup"}
          </button>
        )}

        {/* Attendees */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: "oklch(0.14 0.05 145)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <div className="px-5 py-3 border-b border-white/08 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-white/40" />
              <span className="text-white/60 text-xs font-semibold uppercase tracking-wider">
                Checked In ({checkedIn.length})
              </span>
            </div>
            {loadingRatings && <Loader2 className="w-3.5 h-3.5 text-white/30 animate-spin" />}
          </div>

          {attendees.length === 0 ? (
            <div className="px-5 py-8 text-center text-white/30 text-sm">
              No one has checked in yet. Be the first!
            </div>
          ) : (
            <div className="divide-y divide-white/05">
              {attendees.map((a) => (
                <div key={a.userId} className="flex items-center gap-3 px-5 py-3">
                  {a.avatarUrl ? (
                    <img src={a.avatarUrl} alt={a.displayName} className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-9 h-9 rounded-full flex items-center justify-center bg-white/10 text-white/60 text-sm font-bold flex-shrink-0">
                      {a.displayName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-sm font-semibold truncate">{a.displayName}</div>
                    {a.chesscomUsername && (
                      <a
                        href={`https://chess.com/member/${a.chesscomUsername}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-white/40 text-xs hover:text-white/70 transition-colors"
                      >
                        <ExternalLink className="w-2.5 h-2.5" />
                        {a.chesscomUsername}
                      </a>
                    )}
                  </div>
                  {/* Ratings */}
                  <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                    {a.rapid && (
                      <span className="text-xs font-bold" style={{ color: accentColor }}>
                        {a.rapid} <span className="text-white/30 font-normal">rapid</span>
                      </span>
                    )}
                    {a.blitz && (
                      <span className="text-xs font-semibold text-amber-400">
                        {a.blitz} <span className="text-white/30 font-normal">blitz</span>
                      </span>
                    )}
                    {!a.rapid && !a.blitz && a.chesscomUsername && (
                      <span className="text-white/20 text-xs">—</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
