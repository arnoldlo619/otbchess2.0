/**
 * MeetupEventPage — /clubs/:clubId/meetup/:eventId
 *
 * Dedicated page for a Club Meetup event showing:
 * - Event details (title, date, time, venue, description, recurrence)
 * - RSVP section (Going / Maybe / Not Going)
 * - Attendee list with RSVP counts
 * - Owner controls: Edit, Show Check-in QR (on event day), Cancel
 */
import { useState, useEffect, useCallback } from "react";
import { useParams, useLocation, Link } from "wouter";
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  QrCode,
  ArrowLeft,
  Edit2,
  Repeat,
  CheckCircle,
  X,
  Minus,
  ExternalLink,
} from "lucide-react";
import { useAuthContext } from "@/context/AuthContext";
import {
  getClubEvent,
  getEventRSVPs,
  upsertRSVP,
  getUserRSVP,
  countRSVPs,
  type ClubEvent,
  type ClubEventRSVP,
} from "@/lib/clubEventRegistry";
import { getClubMembers } from "@/lib/clubRegistry";
import { QRCodeSVG } from "qrcode.react";

const RECURRENCE_LABELS: Record<string, string> = {
  none: "One-time",
  weekly: "Weekly",
  biweekly: "Bi-weekly",
  monthly: "Monthly",
};

function formatEventDate(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function formatEventTime(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

function isEventDay(event: ClubEvent): boolean {
  const today = new Date().toISOString().slice(0, 10);
  const eventDay = event.startAt.slice(0, 10);
  return today === eventDay;
}

export default function MeetupEventPage() {
  const { clubId, eventId } = useParams<{ clubId: string; eventId: string }>();
  const [, navigate] = useLocation();
  const { user } = useAuthContext();

  const [event, setEvent] = useState<ClubEvent | null>(null);
  const [rsvps, setRsvps] = useState<ClubEventRSVP[]>([]);
  const [showQr, setShowQr] = useState(false);
  const [rsvpSubmitting, setRsvpSubmitting] = useState(false);

  const members = clubId ? getClubMembers(clubId) : [];

  const isOwnerOrDirector =
    user &&
    members.some(
      (m) => m.userId === user.id && (m.role === "owner" || m.role === "director")
    );

  const myRsvp = user && event ? getUserRSVP(event.id, user.id) : null;
  const counts = event ? countRSVPs(event.id) : { going: 0, maybe: 0, not_going: 0 };

  const refresh = useCallback(() => {
    if (!eventId) return;
    const ev = getClubEvent(eventId);
    setEvent(ev);
    if (ev) setRsvps(getEventRSVPs(ev.id));
  }, [eventId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleRsvp(status: "going" | "maybe" | "not_going") {
    if (!user || !event) return;
    setRsvpSubmitting(true);
    upsertRSVP(event.id, event.clubId, user.id, user.displayName, status, user.avatarUrl ?? null);
    refresh();
    setRsvpSubmitting(false);
  }

  function generateQr() {
    setShowQr(true);
  }

  if (!event) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "oklch(0.10 0.04 145)" }}>
        <div className="text-white/40 text-sm">Meetup not found.</div>
      </div>
    );
  }

  const accentColor = event.accentColor ?? "#4CAF50";
  const recurrenceLabel = RECURRENCE_LABELS[event.recurrence ?? "none"] ?? "One-time";
  const onEventDay = isEventDay(event);

  return (
    <div className="min-h-screen pb-20" style={{ background: "oklch(0.10 0.04 145)" }}>
      {/* Top bar */}
      <div
        className="sticky top-0 z-50 flex items-center justify-between px-4 py-3 border-b border-white/08"
        style={{ background: "oklch(0.12 0.04 145)" }}
      >
        <button
          onClick={() => navigate(`/clubs/${clubId}/home`)}
          className="flex items-center gap-1.5 text-white/50 hover:text-white text-sm font-semibold transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Club
        </button>
        {isOwnerOrDirector && (
          <div className="flex items-center gap-2">
            {onEventDay && (
              <button
                onClick={generateQr}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                style={{ background: accentColor, color: "#0a1a0f" }}
              >
                <QrCode className="w-3.5 h-3.5" />
                Check-in QR
              </button>
            )}
          </div>
        )}
      </div>

      <div className="max-w-lg mx-auto px-4 pt-6 space-y-5">
        {/* Hero card */}
        <div
          className="rounded-3xl overflow-hidden"
          style={{ background: `linear-gradient(135deg, ${accentColor}22 0%, oklch(0.14 0.05 145) 100%)`, border: `1px solid ${accentColor}33` }}
        >
          <div className="px-6 py-6">
            {/* Recurrence badge */}
            {event.recurrence && event.recurrence !== "none" && (
              <div className="flex items-center gap-1.5 mb-3">
                <span
                  className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full tracking-widest uppercase"
                  style={{ background: accentColor + "22", color: accentColor }}
                >
                  <Repeat className="w-2.5 h-2.5" />
                  {recurrenceLabel}
                </span>
                {onEventDay && (
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full tracking-widest uppercase bg-green-500/20 text-green-400">
                    Today
                  </span>
                )}
              </div>
            )}

            <h1
              className="text-2xl font-black text-white mb-1"
              style={{ fontFamily: "'Clash Display', sans-serif" }}
            >
              {event.title}
            </h1>
            {event.description && (
              <p className="text-white/55 text-sm leading-relaxed mb-4">{event.description}</p>
            )}

            {/* Details grid */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-2.5 text-sm text-white/70">
                <Calendar className="w-4 h-4 flex-shrink-0" style={{ color: accentColor }} />
                <span>{formatEventDate(event.startAt)}</span>
              </div>
              {event.startAt && (
                <div className="flex items-center gap-2.5 text-sm text-white/70">
                  <Clock className="w-4 h-4 flex-shrink-0" style={{ color: accentColor }} />
                  <span>
                    {formatEventTime(event.startAt)}
                    {event.endAt && ` – ${formatEventTime(event.endAt)}`}
                  </span>
                </div>
              )}
              {event.venue && (
                <div className="flex items-center gap-2.5 text-sm text-white/70">
                  <MapPin className="w-4 h-4 flex-shrink-0" style={{ color: accentColor }} />
                  <span>
                    {event.venue}
                    {event.address && <span className="text-white/40"> · {event.address}</span>}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RSVP section */}
        {user && (
          <div
            className="rounded-2xl px-5 py-4"
            style={{ background: "oklch(0.14 0.05 145)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <p className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-3">Are you going?</p>
            <div className="flex gap-2">
              {(["going", "maybe", "not_going"] as const).map((status) => {
                const labels = { going: "Going", maybe: "Maybe", not_going: "Can't go" };
                const icons = {
                  going: <CheckCircle className="w-3.5 h-3.5" />,
                  maybe: <Minus className="w-3.5 h-3.5" />,
                  not_going: <X className="w-3.5 h-3.5" />,
                };
                const isActive = myRsvp?.status === status;
                return (
                  <button
                    key={status}
                    onClick={() => handleRsvp(status)}
                    disabled={rsvpSubmitting}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all"
                    style={
                      isActive
                        ? { background: accentColor, color: "#0a1a0f" }
                        : { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.50)", border: "1px solid rgba(255,255,255,0.10)" }
                    }
                  >
                    {icons[status]}
                    {labels[status]}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* RSVP counts */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Going", count: counts.going, color: "#4CAF50" },
            { label: "Maybe", count: counts.maybe, color: "#FFC107" },
            { label: "Can't go", count: counts.not_going, color: "#ef4444" },
          ].map(({ label, count, color }) => (
            <div
              key={label}
              className="rounded-2xl px-4 py-3 text-center"
              style={{ background: "oklch(0.14 0.05 145)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <div className="text-2xl font-black" style={{ color }}>{count}</div>
              <div className="text-white/40 text-xs mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        {/* Attendee list */}
        {rsvps.filter((r) => r.status === "going").length > 0 && (
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: "oklch(0.14 0.05 145)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <div className="px-5 py-3 border-b border-white/08 flex items-center gap-2">
              <Users className="w-4 h-4 text-white/40" />
              <span className="text-white/60 text-xs font-semibold uppercase tracking-wider">
                Going ({counts.going})
              </span>
            </div>
            <div className="divide-y divide-white/05">
              {rsvps
                .filter((r) => r.status === "going")
                .map((rsvp) => {
                  const member = members.find((m) => m.userId === rsvp.userId);
                  return (
                    <div key={rsvp.id} className="flex items-center gap-3 px-5 py-3">
                      {rsvp.avatarUrl ? (
                        <img src={rsvp.avatarUrl} alt={rsvp.displayName} className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded-full flex items-center justify-center bg-white/10 text-white/60 text-xs font-bold">
                          {rsvp.displayName.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-white text-sm font-semibold truncate">{rsvp.displayName}</div>
                        {member?.chesscomUsername && (
                          <a
                            href={`https://chess.com/member/${member.chesscomUsername}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-white/40 text-xs hover:text-white/70 transition-colors"
                          >
                            <ExternalLink className="w-2.5 h-2.5" />
                            {member.chesscomUsername}
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Check-in attendees (on event day) */}
        {onEventDay && event.checkedInUserIds && event.checkedInUserIds.length > 0 && (
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: "oklch(0.14 0.05 145)", border: `1px solid ${accentColor}33` }}
          >
            <div className="px-5 py-3 border-b border-white/08 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" style={{ color: accentColor }} />
              <span className="text-white/60 text-xs font-semibold uppercase tracking-wider">
                Checked In ({event.checkedInUserIds.length})
              </span>
            </div>
            <div className="divide-y divide-white/05">
              {event.checkedInUserIds.map((uid) => {
                const member = members.find((m) => m.userId === uid);
                if (!member) return null;
                return (
                  <div key={uid} className="flex items-center gap-3 px-5 py-3">
                    {member.avatarUrl ? (
                      <img src={member.avatarUrl} alt={member.displayName} className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-full flex items-center justify-center bg-white/10 text-white/60 text-xs font-bold">
                        {member.displayName.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-white text-sm font-semibold truncate">{member.displayName}</div>
                      {member.chesscomUsername && (
                        <div className="text-white/40 text-xs">{member.chesscomUsername}</div>
                      )}
                    </div>
                    <CheckCircle className="w-4 h-4 flex-shrink-0" style={{ color: accentColor }} />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* View check-in page link */}
        <Link
          href={`/checkin/${event.id}`}
          className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl text-sm font-semibold text-white/50 hover:text-white/80 transition-colors"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <QrCode className="w-4 h-4" />
          Open Check-in Page
        </Link>
      </div>

      {/* QR Modal */}
      {showQr && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}
          onClick={() => setShowQr(false)}
        >
          <div
            className="relative rounded-3xl overflow-hidden p-8 flex flex-col items-center gap-4 max-w-xs w-full"
            style={{ background: "oklch(0.14 0.05 145)", border: "1px solid rgba(255,255,255,0.12)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowQr(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-white/30 hover:text-white/70 hover:bg-white/10 transition"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="text-center">
              <h3 className="text-white font-bold text-lg">Check-in QR Code</h3>
              <p className="text-white/40 text-xs mt-1">Members scan this to check in</p>
            </div>
            <div className="p-3 rounded-2xl" style={{ background: "#f0faf2" }}>
              <QRCodeSVG
                value={`${window.location.origin}/checkin/${event.id}`}
                size={220}
                bgColor="#f0faf2"
                fgColor="#0a1a0f"
                level="M"
              />
            </div>
            <p className="text-white/30 text-xs text-center">
              {event.title} · {formatEventDate(event.startAt)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
