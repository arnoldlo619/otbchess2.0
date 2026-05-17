/**
 * MeetupEventPage — /clubs/:clubId/meetup/:eventId
 *
 * Full-screen event page that mirrors the ClubDashboard layout:
 * - Left icon rail (desktop) with club avatar + nav icons
 * - Branded top bar with NavLogo + AvatarNavDropdown
 * - Wide two-column content: hero/details (left) + RSVP/attendees (right)
 * - Mobile bottom nav consistent with ClubDashboard
 * - Premium hover animations throughout
 */
import { useState, useEffect, useCallback } from "react";
import { useParams, useLocation, Link } from "wouter";
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  QrCode,
  ChevronLeft,
  Repeat,
  CheckCircle,
  X,
  Minus,
  ExternalLink,
  Megaphone,
  Trophy,
  Settings2,
} from "lucide-react";
import { useAuthContext } from "@/context/AuthContext";
import { NavLogo } from "@/components/NavLogo";
import { AvatarNavDropdown } from "@/components/AvatarNavDropdown";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import {
  getClubEvent,
  getEventRSVPs,
  upsertRSVP,
  getUserRSVP,
  countRSVPs,
  type ClubEvent,
  type ClubEventRSVP,
} from "@/lib/clubEventRegistry";
import { getClubMembers, getClub, type Club } from "@/lib/clubRegistry";
import { QRCodeSVG } from "qrcode.react";
import { authFetch } from "@/lib/apiFetch";

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
  const [club, setClub] = useState<Club | null>(null);
  const [rsvps, setRsvps] = useState<ClubEventRSVP[]>([]);
  const [dbCheckinIds, setDbCheckinIds] = useState<string[]>([]);
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

  const refresh = useCallback(async () => {
    if (!eventId) return;
    const ev = getClubEvent(eventId);
    setEvent(ev);
    if (ev) {
      setRsvps(getEventRSVPs(ev.id));
      try {
        const res = await authFetch(`/api/clubs/${ev.clubId}/events/${eventId}/checkins`);
        if (res.ok) {
          const rows = await res.json() as Array<{ userId: string }>;
          setDbCheckinIds(rows.map((r) => r.userId));
        }
      } catch { /* ignore */ }
    }
  }, [eventId]);

  useEffect(() => {
    refresh();
    if (clubId) {
      const c = getClub(clubId);
      setClub(c ?? null);
    }
  }, [refresh, clubId]);

  async function handleRsvp(status: "going" | "maybe" | "not_going") {
    if (!user || !event) return;
    setRsvpSubmitting(true);
    upsertRSVP(event.id, event.clubId, user.id, user.displayName, status, user.avatarUrl ?? null);
    refresh();
    setRsvpSubmitting(false);
  }

  const accent = club?.accentColor ?? event?.accentColor ?? "#4CAF50";

  // Sidebar nav tabs (mirrors ClubDashboard)
  const sidebarTabs = [
    { id: "feed", label: "Feed", icon: Megaphone },
    { id: "events", label: "Events", icon: Calendar },
    { id: "members", label: "Members", icon: Users },
    { id: "leagues", label: "Leagues", icon: Trophy },
    { id: "settings", label: "Settings", icon: Settings2 },
  ];

  if (!event) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "oklch(0.10 0.04 145)" }}>
        <div className="text-white/40 text-sm">Meetup not found.</div>
      </div>
    );
  }

  const accentColor = accent;
  const recurrenceLabel = RECURRENCE_LABELS[event.recurrence ?? "none"] ?? "One-time";
  const onEventDay = isEventDay(event);
  const goingRsvps = rsvps.filter((r) => r.status === "going");
  const allCheckinIds = Array.from(new Set([...(event.checkedInUserIds ?? []), ...dbCheckinIds]));
  const checkedInMembers = allCheckinIds
    .map((uid) => members.find((m) => m.userId === uid))
    .filter(Boolean);

  return (
    <div className="min-h-screen" style={{ background: "oklch(0.20 0.06 145)" }}>
      <div className="flex h-screen overflow-hidden">

        {/* ── LEFT ICON RAIL (desktop) ─────────────────────────────────────── */}
        <aside
          className="hidden lg:flex flex-col items-center w-[60px] flex-shrink-0 h-full py-4 gap-1 relative chess-board-bg"
          style={{ borderRight: `1px solid oklch(0.22 0.06 145)` }}
        >
          <div
            className="absolute inset-0 pointer-events-none z-0"
            style={{ background: "oklch(0.15 0.04 145 / 0.80)" }}
          />
          <div className="relative z-10 flex flex-col items-center w-full gap-1 flex-1 py-0">
            {/* Club avatar / back button */}
            <button
              onClick={() => navigate(`/clubs/${clubId}/home`)}
              className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 transition-all duration-200 hover:scale-105 hover:brightness-110 active:scale-95 flex-shrink-0 overflow-hidden"
              style={{ background: accentColor }}
              title="Back to Club"
            >
              {club?.avatarUrl ? (
                <img src={club.avatarUrl} alt={club.name} className="w-full h-full object-cover" />
              ) : (
                <img
                  src="https://d2xsxph8kpxj0f.cloudfront.net/117675823/J6FsDoRMH9x5xbUvpyzxyf/otb-logo-exclamation_0b3fa613.png"
                  alt="OTB!!"
                  className="w-8 h-8 object-contain"
                />
              )}
            </button>
            <div className="w-8 h-px mb-2" style={{ background: "oklch(0.30 0.06 145)" }} />
            {/* Nav icons */}
            <nav className="flex flex-col items-center gap-1 flex-1">
              {sidebarTabs.map((ct) => {
                const Icon = ct.icon;
                const isActive = ct.id === "events";
                return (
                  <button
                    key={ct.id}
                    onClick={() => navigate(`/clubs/${clubId}/home?tab=${ct.id}`)}
                    className="relative w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 group hover:scale-105 active:scale-95"
                    style={{
                      background: isActive ? accentColor : "transparent",
                      color: isActive ? "oklch(0.12 0.04 145)" : "oklch(0.55 0.08 145)",
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        (e.currentTarget as HTMLButtonElement).style.background = "oklch(0.22 0.06 145)";
                        (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.75)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                        (e.currentTarget as HTMLButtonElement).style.color = "oklch(0.55 0.08 145)";
                      }
                    }}
                    title={ct.label}
                  >
                    <Icon size={17} />
                    <span
                      className="absolute left-full ml-2 px-2 py-1 rounded-lg text-xs font-medium whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50"
                      style={{ background: "oklch(0.25 0.06 145)", color: "#fff" }}
                    >
                      {ct.label}
                    </span>
                  </button>
                );
              })}
            </nav>
          </div>
        </aside>

        {/* ── MAIN CONTENT AREA ────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

          {/* ── BRANDED TOP BAR ──────────────────────────────────────────── */}
          <div
            className="flex-shrink-0 flex items-center gap-3 px-4 lg:px-5 py-2.5"
            style={{
              background: "oklch(0.15 0.04 145 / 0.97)",
              backdropFilter: "blur(12px)",
              borderBottom: "1px solid oklch(0.22 0.06 145)",
            }}
          >
            {/* Mobile back */}
            <button
              onClick={() => navigate(`/clubs/${clubId}/home`)}
              className="lg:hidden p-1.5 rounded-lg transition-all duration-200 hover:bg-white/10 active:scale-90"
              style={{ color: "oklch(0.65 0.12 145)" }}
            >
              <ChevronLeft size={15} />
            </button>
            {/* Desktop breadcrumb */}
            <button
              onClick={() => navigate(`/clubs/${clubId}/home`)}
              className="hidden lg:flex items-center gap-1.5 text-white/40 hover:text-white/80 text-sm font-medium transition-colors duration-200 group"
            >
              <ChevronLeft className="w-4 h-4 transition-transform duration-200 group-hover:-translate-x-0.5" />
              {club?.name ?? "Club"}
            </button>
            <span className="hidden lg:block text-white/20 text-sm">/</span>
            <span className="hidden lg:block text-white/70 text-sm font-semibold truncate max-w-xs">{event.title}</span>
            {/* Mobile title */}
            <div className="lg:hidden flex-1 min-w-0">
              <span className="text-sm font-bold truncate text-white">{event.title}</span>
            </div>
            {/* Right: QR button (owner, event day) + avatar */}
            <div className="flex items-center gap-2 ml-auto">
              {isOwnerOrDirector && (
                <button
                  onClick={() => setShowQr(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 hover:brightness-110 hover:scale-105 active:scale-95"
                  style={{ background: onEventDay ? accentColor : "oklch(0.22 0.06 145)", color: onEventDay ? "#0a1a0f" : "rgba(255,255,255,0.7)", border: onEventDay ? "none" : "1px solid rgba(255,255,255,0.12)" }}
                >
                  <QrCode className="w-3.5 h-3.5" />
                  Check-in QR
                </button>
              )}
              <AvatarNavDropdown currentPage="Clubs" />
            </div>
          </div>

          {/* ── SCROLLABLE CONTENT ────────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto pb-20 lg:pb-6">
            <div className="px-4 lg:px-8 py-6">
              <div className="max-w-5xl mx-auto">

                {/* ── HERO BANNER ───────────────────────────────────────── */}
                <div
                  className="relative rounded-3xl overflow-hidden mb-6 transition-transform duration-300 hover:scale-[1.005]"
                  style={{
                    background: event.coverImageUrl
                      ? `url(${event.coverImageUrl}) center/cover no-repeat`
                      : `linear-gradient(135deg, ${accentColor}33 0%, ${accentColor}11 40%, oklch(0.12 0.06 240) 100%)`,
                    minHeight: "220px",
                  }}
                >
                  {/* Micro-grid overlay */}
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      backgroundImage: "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
                      backgroundSize: "24px 24px",
                    }}
                  />
                  {/* Gradient overlay */}
                  <div
                    className="absolute inset-0"
                    style={{ background: "linear-gradient(to top, oklch(0.12 0.05 145) 0%, transparent 55%)" }}
                  />
                  <div className="relative z-10 flex flex-col justify-end h-full p-6 pt-16">
                    {/* Badges row */}
                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      {event.recurrence && event.recurrence !== "none" && (
                        <span
                          className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full tracking-widest uppercase transition-all duration-200 hover:scale-105"
                          style={{ background: accentColor + "22", color: accentColor, border: `1px solid ${accentColor}44` }}
                        >
                          <Repeat className="w-2.5 h-2.5" />
                          {recurrenceLabel}
                        </span>
                      )}
                      {onEventDay && (
                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full tracking-widest uppercase bg-green-500/20 text-green-400 border border-green-500/30 transition-all duration-200 hover:scale-105">
                          Today
                        </span>
                      )}
                      <span
                        className="text-[10px] font-bold px-2.5 py-1 rounded-full tracking-widest uppercase transition-all duration-200 hover:scale-105"
                        style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.50)" }}
                      >
                        Club Meetup
                      </span>
                    </div>
                    <h1
                      className="text-3xl lg:text-4xl font-black text-white leading-tight"
                      style={{ fontFamily: "'Clash Display', sans-serif" }}
                    >
                      {event.title}
                    </h1>
                  </div>
                </div>

                {/* ── TWO-COLUMN LAYOUT ─────────────────────────────────── */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                  {/* ── LEFT COLUMN: Details ──────────────────────────── */}
                  <div className="lg:col-span-2 space-y-5">

                    {/* Event details card */}
                    <div
                      className="rounded-2xl overflow-hidden transition-all duration-300 hover:border-white/15 hover:shadow-lg hover:shadow-black/20"
                      style={{ background: "oklch(0.15 0.05 145)", border: "1px solid rgba(255,255,255,0.08)" }}
                    >
                      <div className="px-5 py-4 border-b border-white/08">
                        <h2 className="text-white/60 text-xs font-bold uppercase tracking-wider">Event Details</h2>
                      </div>
                      <div className="px-5 py-4 space-y-3">
                        <div className="flex items-start gap-3 text-sm text-white/75 transition-colors duration-200 hover:text-white/90">
                          <Calendar className="w-4 h-4 flex-shrink-0 mt-0.5 transition-transform duration-200 group-hover:scale-110" style={{ color: accentColor }} />
                          <span>{formatEventDate(event.startAt)}</span>
                        </div>
                        {event.startAt && (
                          <div className="flex items-start gap-3 text-sm text-white/75 transition-colors duration-200 hover:text-white/90">
                            <Clock className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: accentColor }} />
                            <span>
                              {formatEventTime(event.startAt)}
                              {event.endAt && ` – ${formatEventTime(event.endAt)}`}
                            </span>
                          </div>
                        )}
                        {event.venue && (
                          <div className="flex items-start gap-3 text-sm text-white/75 transition-colors duration-200 hover:text-white/90">
                            <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: accentColor }} />
                            <div>
                              <div className="font-semibold text-white">{event.venue}</div>
                              {event.address && <div className="text-white/40 text-xs mt-0.5">{event.address}</div>}
                            </div>
                          </div>
                        )}
                        {event.recurrence && event.recurrence !== "none" && (
                          <div className="flex items-start gap-3 text-sm text-white/75 transition-colors duration-200 hover:text-white/90">
                            <Repeat className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: accentColor }} />
                            <span>Repeats {recurrenceLabel}</span>
                          </div>
                        )}
                      </div>
                      {event.description && (
                        <div className="px-5 pb-5">
                          <div className="h-px bg-white/06 mb-4" />
                          <p className="text-white/55 text-sm leading-relaxed">{event.description}</p>
                        </div>
                      )}
                    </div>

                    {/* Checked-in attendees (event day only) */}
                    {onEventDay && checkedInMembers.length > 0 && (
                      <div
                        className="rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-black/20"
                        style={{ background: "oklch(0.15 0.05 145)", border: `1px solid ${accentColor}33` }}
                      >
                        <div className="px-5 py-4 border-b border-white/08 flex items-center gap-2">
                          <CheckCircle className="w-4 h-4" style={{ color: accentColor }} />
                          <h2 className="text-white/60 text-xs font-bold uppercase tracking-wider">
                            Checked In · {checkedInMembers.length}
                          </h2>
                        </div>
                        <div className="divide-y divide-white/05">
                          {checkedInMembers.map((member) => {
                            if (!member) return null;
                            return (
                              <div
                                key={member.userId}
                                className="flex items-center gap-3 px-5 py-3 transition-colors duration-200 hover:bg-white/04"
                              >
                                <PlayerAvatar
                                  username={member.chesscomUsername ?? member.displayName}
                                  name={member.displayName}
                                  avatarUrl={member.avatarUrl ?? undefined}
                                  size={36}
                                  className="w-9 h-9 rounded-full flex-shrink-0 transition-transform duration-200 hover:scale-110"
                                />
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

                    {/* Check-in action: QR for owners, direct link for members */}
                    {isOwnerOrDirector ? (
                      <button
                        onClick={() => setShowQr(true)}
                        className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl text-sm font-bold transition-all duration-200 hover:brightness-110 hover:scale-[1.01] active:scale-[0.99]"
                        style={{ background: accentColor, color: '#ffffff' }}
                      >
                        <QrCode className="w-4 h-4" />
                        Check-in QR Code
                      </button>
                    ) : (
                      <Link
                        href={`/checkin/${event.id}`}
                        className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl text-sm font-semibold text-white/50 hover:text-white/90 transition-all duration-200 hover:bg-white/08 hover:border-white/15 hover:scale-[1.01] active:scale-[0.99]"
                        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                      >
                        <QrCode className="w-4 h-4" />
                        Check In
                      </Link>
                    )}
                  </div>

                  {/* ── RIGHT COLUMN: RSVP + Attendees ───────────────── */}
                  <div className="space-y-5">

                    {/* RSVP stats */}
                    <div
                      className="rounded-2xl overflow-hidden transition-all duration-300 hover:border-white/15 hover:shadow-lg hover:shadow-black/20"
                      style={{ background: "oklch(0.15 0.05 145)", border: "1px solid rgba(255,255,255,0.08)" }}
                    >
                      <div className="px-5 py-4 border-b border-white/08">
                        <h2 className="text-white/60 text-xs font-bold uppercase tracking-wider">Attendance</h2>
                      </div>
                      <div className="grid grid-cols-3 divide-x divide-white/06">
                        {[
                          { label: "Going", count: counts.going, color: "#4CAF50" },
                          { label: "Maybe", count: counts.maybe, color: "#FFC107" },
                          { label: "Can't go", count: counts.not_going, color: "#ef4444" },
                        ].map(({ label, count, color }) => (
                          <div key={label} className="px-3 py-4 text-center transition-colors duration-200 hover:bg-white/03">
                            <div className="text-2xl font-black transition-transform duration-200 hover:scale-110" style={{ color }}>{count}</div>
                            <div className="text-white/40 text-[11px] mt-0.5">{label}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* RSVP buttons */}
                    {user && (
                      <div
                        className="rounded-2xl px-5 py-4 transition-all duration-300 hover:border-white/15"
                        style={{ background: "oklch(0.15 0.05 145)", border: "1px solid rgba(255,255,255,0.08)" }}
                      >
                        <p className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-3">Are you going?</p>
                        <div className="flex flex-col gap-2">
                          {(["going", "maybe", "not_going"] as const).map((status) => {
                            const labels = { going: "Going", maybe: "Maybe", not_going: "Can't go" };
                            const icons = {
                              going: <CheckCircle className="w-4 h-4" />,
                              maybe: <Minus className="w-4 h-4" />,
                              not_going: <X className="w-4 h-4" />,
                            };
                            const isActive = myRsvp?.status === status;
                            return (
                              <button
                                key={status}
                                onClick={() => handleRsvp(status)}
                                disabled={rsvpSubmitting}
                                className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] hover:brightness-110"
                                style={
                                  isActive
                                    ? { background: accentColor, color: "#0a1a0f" }
                                    : { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.60)", border: "1px solid rgba(255,255,255,0.12)" }
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

                    {/* Going attendees list */}
                    {goingRsvps.length > 0 && (
                      <div
                        className="rounded-2xl overflow-hidden transition-all duration-300 hover:border-white/15 hover:shadow-lg hover:shadow-black/20"
                        style={{ background: "oklch(0.15 0.05 145)", border: "1px solid rgba(255,255,255,0.08)" }}
                      >
                        <div className="px-5 py-4 border-b border-white/08 flex items-center gap-2">
                          <Users className="w-4 h-4 text-white/40" />
                          <h2 className="text-white/60 text-xs font-bold uppercase tracking-wider">
                            Going · {goingRsvps.length}
                          </h2>
                        </div>
                        <div className="divide-y divide-white/05 max-h-72 overflow-y-auto">
                          {goingRsvps.map((rsvp) => {
                            const member = members.find((m) => m.userId === rsvp.userId);
                            return (
                              <div
                                key={rsvp.id}
                                className="flex items-center gap-3 px-5 py-3 transition-colors duration-200 hover:bg-white/04"
                              >
                                {rsvp.avatarUrl ? (
                                  <img
                                    src={rsvp.avatarUrl}
                                    alt={rsvp.displayName}
                                    className="w-8 h-8 rounded-full object-cover flex-shrink-0 transition-transform duration-200 hover:scale-110"
                                  />
                                ) : (
                                  <div className="w-8 h-8 rounded-full flex items-center justify-center bg-white/10 text-white/60 text-xs font-bold flex-shrink-0 transition-transform duration-200 hover:scale-110">
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
                                      className="flex items-center gap-1 text-white/40 text-xs hover:text-white/80 transition-colors duration-200"
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
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── MOBILE BOTTOM NAV ──────────────────────────────────────────────── */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around px-2 py-2"
        style={{ background: "oklch(0.13 0.04 145 / 0.97)", borderTop: "1px solid oklch(0.22 0.06 145)", backdropFilter: "blur(12px)" }}
      >
        {sidebarTabs.map((ct) => {
          const Icon = ct.icon;
          const isActive = ct.id === "events";
          return (
            <button
              key={ct.id}
              onClick={() => navigate(`/clubs/${clubId}/home?tab=${ct.id}`)}
              className="flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-all duration-200 hover:scale-110 active:scale-95"
              style={{ color: isActive ? accentColor : "oklch(0.50 0.06 145)" }}
            >
              <Icon size={18} />
              <span className="text-[9px] font-semibold">{ct.label}</span>
            </button>
          );
        })}
      </nav>

      {/* ── QR MODAL ─────────────────────────────────────────────────────────── */}
      {showQr && (() => {
        const checkinUrl = `${window.location.origin}/checkin/${event.id}`;
        return (
          <div
            className="fixed inset-0 z-[300] flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.88)", backdropFilter: "blur(10px)" }}
            onClick={() => setShowQr(false)}
          >
            <div
              className="relative rounded-3xl overflow-hidden flex flex-col items-center gap-5 max-w-sm w-full"
              style={{ background: "oklch(0.14 0.05 145)", border: "1px solid rgba(255,255,255,0.12)", padding: "2rem" }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <button
                onClick={() => setShowQr(false)}
                className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-white/30 hover:text-white/80 hover:bg-white/12 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="text-center">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ background: accentColor + "22" }}>
                  <QrCode className="w-5 h-5" style={{ color: accentColor }} />
                </div>
                <h3 className="text-white font-bold text-lg">Check-in QR Code</h3>
                <p className="text-white/40 text-xs mt-1">{event.title} · {formatEventDate(event.startAt)}</p>
              </div>
              {/* QR Code */}
              <div className="p-4 rounded-2xl" style={{ background: "#ffffff" }}>
                <QRCodeSVG
                  id="meetup-checkin-qr"
                  value={checkinUrl}
                  size={210}
                  bgColor="#ffffff"
                  fgColor="#0a1a0f"
                  level="H"
                />
              </div>
              {/* Instructions */}
              <div className="w-full rounded-xl px-4 py-3 flex items-start gap-3" style={{ background: accentColor + "15", border: `1px solid ${accentColor}30` }}>
                <QrCode className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: accentColor }} />
                <p className="text-xs leading-relaxed text-white/60">
                  Show this screen to members as they arrive. They scan with their phone camera, sign in if needed, and confirm check-in. Attendees and their chess.com ELOs appear instantly.
                </p>
              </div>
              {/* Actions */}
              <div className="w-full grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(checkinUrl).catch(() => {});
                  }}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all"
                  style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.10)" }}
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                  Copy Link
                </button>
                <button
                  onClick={() => {
                    const svg = document.getElementById("meetup-checkin-qr");
                    if (!svg) return;
                    const serializer = new XMLSerializer();
                    const svgStr = serializer.serializeToString(svg);
                    const blob = new Blob([svgStr], { type: "image/svg+xml" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `checkin-qr-${event.id}.svg`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all hover:brightness-110"
                  style={{ background: accentColor, color: "#0a1a0f" }}
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  Save QR
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
