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
  Settings2,
  CalendarPlus,
  DollarSign,
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
import { CheckInAnnounceModal } from "@/components/CheckInAnnounceModal";
import { authFetch } from "@/lib/apiFetch";
import { ClipboardList } from "lucide-react";

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
  // Server-fetched members so isOwnerOrDirector works even when localStorage is empty
  // (e.g. when navigating directly via QR scan without visiting ClubDashboard first)
  const [serverMembers, setServerMembers] = useState<{ userId: string; role: string; displayName?: string; chesscomUsername?: string | null; avatarUrl?: string | null }[]>([]);

  const localMembers = clubId ? getClubMembers(clubId) : [];
  const members = serverMembers.length > 0 ? serverMembers : localMembers;

  const isOwnerOrDirector =
    user &&
    members.some(
      (m) => m.userId === user.id && (m.role === "owner" || m.role === "director")
    );

  const myRsvp = user && event ? getUserRSVP(event.id, user.id) : null;
  const counts = event ? countRSVPs(event.id) : { going: 0, maybe: 0, not_going: 0 };

  const refresh = useCallback(async () => {
    if (!eventId) return;
    // Try localStorage first; fall back to server API (e.g. fresh device via QR scan)
    let ev = getClubEvent(eventId);
    if (!ev) {
      try {
        const evRes = await authFetch(`/api/clubs/event/${eventId}`);
        if (evRes.ok) {
          ev = await evRes.json() as ClubEvent;
        }
      } catch { /* ignore */ }
    }
    setEvent(ev ?? null);
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
      // Fetch members from server so isOwnerOrDirector is accurate even without localStorage
      authFetch(`/api/clubs/${clubId}/members`)
        .then(async (res) => {
          if (res.ok) {
            const rows = await res.json() as Array<{ userId: string; role: string }>;
            setServerMembers(rows);
          }
        })
        .catch(() => {});
    }
  }, [refresh, clubId]);

  // Auto-check-in club owners/directors when they open the event page
  useEffect(() => {
    if (!user || !event || !isOwnerOrDirector) return;
    const alreadyIn = [
      ...(event.checkedInUserIds ?? []),
      ...dbCheckinIds,
    ].includes(user.id);
    if (alreadyIn) return;
    authFetch(`/api/clubs/${event.clubId}/events/${event.id}/checkin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clubId: event.clubId,
        displayName: user.displayName ?? user.email ?? user.id,
        avatarUrl: user.avatarUrl ?? null,
        chesscomUsername: user.chesscomUsername ?? null,
      }),
    })
      .then(() => refresh())
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, event?.id, isOwnerOrDirector]);

  // Auto-RSVP owner/director as "going" when they open the event page
  useEffect(() => {
    if (!user || !event || !isOwnerOrDirector) return;
    const existing = getUserRSVP(event.id, user.id);
    if (existing?.status === "going") return;
    upsertRSVP(
      event.id,
      event.clubId,
      user.id,
      user.displayName ?? user.email ?? user.id,
      "going",
      user.avatarUrl ?? null
    );
    setRsvps(getEventRSVPs(event.id));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, event?.id, isOwnerOrDirector]);

  // 30-second polling so owner sees new check-ins from members in real-time
  useEffect(() => {
    const interval = setInterval(() => { refresh(); }, 30_000);
    return () => clearInterval(interval);
  }, [refresh]);

  async function handleRsvp(status: "going" | "maybe" | "not_going") {
    if (!user || !event) return;
    setRsvpSubmitting(true);
    upsertRSVP(event.id, event.clubId, user.id, user.displayName, status, user.avatarUrl ?? null);
    refresh();
    setRsvpSubmitting(false);
  }

  const accent = club?.accentColor ?? event?.accentColor ?? "#4CAF50";

  // Sidebar nav tabs (mirrors ClubDashboard — 4 tabs, no standalone Leagues)
  const sidebarTabs = [
    { id: "feed", label: "Feed", icon: Megaphone },
    { id: "events", label: "Events", icon: Calendar },
    { id: "members", label: "Members", icon: Users },
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

        {/* ── LEFT SIDEBAR — expand-on-hover (matches ClubDashboard) ─────── */}
        <aside
          className="hidden lg:flex flex-col flex-shrink-0 h-full overflow-hidden"
          style={{
            width: "68px",
            transition: "width 0.26s cubic-bezier(0.4,0,0.2,1)",
            backgroundImage: `repeating-conic-gradient(oklch(0.17 0.05 145) 0% 25%, oklch(0.13 0.04 145) 0% 50%)`,
            backgroundSize: "12px 12px",
            borderRight: "1px solid oklch(0.22 0.06 145)",
            zIndex: 40,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.width = "210px"; }}
          onMouseLeave={(e) => { e.currentTarget.style.width = "68px"; }}
        >
          {/* Top logo */}
          <div className="pt-4 pb-3 px-2 flex-shrink-0">
            <button
              onClick={() => navigate(`/clubs/${clubId}/home`)}
              className="flex items-center justify-start w-full"
              style={{ height: "52px" }}
              title="Back to Club"
            >
              {club?.avatarUrl ? (
                <img src={club.avatarUrl} alt={club.name ?? "Club"} className="w-10 h-10 rounded-xl object-cover flex-shrink-0" />
              ) : (
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: accentColor }}
                >
                  <span className="text-white font-black text-xs">OTB</span>
                </div>
              )}
            </button>
          </div>

          {/* Nav items */}
          <nav className="flex flex-col gap-0.5 flex-1 justify-center px-2">
            {sidebarTabs.map((ct) => {
              const Icon = ct.icon;
              const isActive = ct.id === "events";
              return (
                <button
                  key={ct.id}
                  onClick={() => navigate(`/clubs/${clubId}/home?tab=${ct.id}`)}
                  className="group/navbtn flex flex-row items-center gap-3 rounded-xl text-left"
                  style={{
                    height: "48px",
                    paddingLeft: "12px",
                    paddingRight: "8px",
                    background: isActive ? "rgba(124,245,98,0.12)" : "transparent",
                    color: isActive ? "rgba(255,255,255,1)" : "rgba(255,255,255,0.45)",
                    transition: "background 200ms ease, color 160ms ease, box-shadow 200ms ease",
                    boxShadow: isActive ? "inset 0 0 0 1px rgba(124,245,98,0.22)" : "none",
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.color = "rgba(255,255,255,0.95)";
                      e.currentTarget.style.background = "rgba(255,255,255,0.07)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.color = "rgba(255,255,255,0.45)";
                      e.currentTarget.style.background = "transparent";
                    }
                  }}
                  title={ct.label}
                >
                  <span className="flex-shrink-0 w-7 flex items-center justify-center" style={{ color: isActive ? "#7cf562" : "inherit" }}>
                    <Icon size={19} strokeWidth={isActive ? 2.2 : 1.8} />
                  </span>
                  <span
                    className="text-[13px] font-semibold whitespace-nowrap overflow-hidden"
                    style={{
                      maxWidth: 0,
                      opacity: 0,
                      transition: "max-width 220ms cubic-bezier(0.4,0,0.2,1), opacity 180ms ease",
                    }}
                    ref={(el) => {
                      if (!el) return;
                      const aside = el.closest("aside");
                      if (!aside) return;
                      const obs = new ResizeObserver(() => {
                        const w = aside.offsetWidth;
                        el.style.maxWidth = w > 100 ? "140px" : "0px";
                        el.style.opacity = w > 100 ? "1" : "0";
                      });
                      obs.observe(aside);
                    }}
                  >
                    {ct.label}
                  </span>
                </button>
              );
            })}
          </nav>

          {/* Bottom: back to club */}
          <div className="pb-4 px-2">
            <div className="h-px mb-2" style={{ background: "rgba(255,255,255,0.07)" }} />
            <button
              onClick={() => navigate(`/clubs/${clubId}/home`)}
              className="flex flex-row items-center gap-3 rounded-xl w-full"
              style={{ height: "44px", paddingLeft: "12px", color: "rgba(255,255,255,0.35)", transition: "color 160ms ease" }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.8)"; e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.35)"; e.currentTarget.style.background = "transparent"; }}
              title="Back to Club"
            >
              <span className="flex-shrink-0 w-7 flex items-center justify-center">
                <ChevronLeft size={17} strokeWidth={1.8} />
              </span>
              <span
                className="text-[13px] font-semibold whitespace-nowrap overflow-hidden"
                style={{ maxWidth: 0, opacity: 0, transition: "max-width 220ms cubic-bezier(0.4,0,0.2,1), opacity 180ms ease" }}
                ref={(el) => {
                  if (!el) return;
                  const aside = el.closest("aside");
                  if (!aside) return;
                  const obs = new ResizeObserver(() => {
                    const w = aside.offsetWidth;
                    el.style.maxWidth = w > 100 ? "140px" : "0px";
                    el.style.opacity = w > 100 ? "1" : "0";
                  });
                  obs.observe(aside);
                }}
              >
                Back to Club
              </span>
            </button>
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
            {/* Left: back button */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => navigate(`/clubs/${clubId}/home`)}
                className="lg:hidden p-1.5 rounded-lg transition-all duration-200 hover:bg-white/10 active:scale-90"
                style={{ color: "oklch(0.65 0.12 145)" }}
              >
                <ChevronLeft size={15} />
              </button>
              <button
                onClick={() => navigate(`/clubs/${clubId}/home`)}
                className="hidden lg:flex items-center gap-1.5 text-white/40 hover:text-white/80 text-sm font-medium transition-colors duration-200 group"
              >
                <ChevronLeft className="w-4 h-4 transition-transform duration-200 group-hover:-translate-x-0.5" />
                {club?.name ?? "Club"}
              </button>
            </div>

            {/* Center: QR button for owners, event title for members */}
            <div className="flex-1 flex items-center justify-center">
              {isOwnerOrDirector ? (
                <button
                  onClick={() => setShowQr(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200 hover:brightness-110 hover:scale-105 active:scale-95"
                  style={{
                    background: onEventDay ? accentColor : "oklch(0.22 0.06 145)",
                    color: onEventDay ? "#ffffff" : "rgba(255,255,255,0.75)",
                    border: onEventDay ? "none" : "1px solid rgba(255,255,255,0.14)",
                  }}
                >
                  <QrCode className="w-4 h-4" />
                  <span>Check-in QR Code</span>
                </button>
              ) : (
                <span className="text-sm font-semibold text-white/80 truncate max-w-xs">{event.title}</span>
              )}
            </div>

            {/* Right: avatar */}
            <div className="flex items-center flex-shrink-0">
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
                                  username={member.chesscomUsername ?? member.displayName ?? member.userId}
                                  name={member.displayName ?? member.userId}
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

                    {/* ── Tournament Banner (shown when event is linked to a tournament) */}
                    {event.tournamentId && (
                      <div
                        className="rounded-2xl overflow-hidden transition-all duration-300 hover:border-white/15 hover:shadow-lg hover:shadow-black/20"
                        style={{ background: "oklch(0.15 0.05 145)", border: `1px solid ${accentColor}33` }}
                      >
                        <div className="px-5 py-4 border-b border-white/08 flex items-center gap-2">
                          <ClipboardList className="w-4 h-4" style={{ color: accentColor }} />
                          <h2 className="text-white/60 text-xs font-bold uppercase tracking-wider">Tournament</h2>
                        </div>
                        <div className="px-5 py-4 space-y-3">
                          <p className="text-white/55 text-sm leading-relaxed">
                            This event includes a live OTB chess tournament. Join to compete, track results, and view standings in real time.
                          </p>
                          <Link
                            href={`/tournament/${event.tournamentId}`}
                            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]"
                            style={{ background: accentColor + "22", color: accentColor, border: `1px solid ${accentColor}44` }}
                          >
                            <ExternalLink className="w-4 h-4" />
                            View Tournament
                          </Link>
                        </div>
                      </div>
                    )}
                    {/* Check-in action */}
                    {!isOwnerOrDirector && (
                      <Link
                        href={`/checkin/${event.id}`}
                        className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl text-sm font-semibold transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]"
                        style={{ background: accentColor, color: '#ffffff' }}
                      >
                        <QrCode className="w-4 h-4" />
                        Check In to Meetup
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

                    {/* RSVP buttons — hidden for owners/directors (auto-set to Going) */}
                    {user && !isOwnerOrDirector && (
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

                    {/* Add to Calendar — shown when user has RSVPed as going or maybe */}
                    {user && myRsvp && (myRsvp.status === "going" || myRsvp.status === "maybe") && (() => {
                      // Build Google Calendar URL
                      const fmt = (iso: string) => iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "").replace("Z", "Z");
                      const start = fmt(event.startAt);
                      const end = event.endAt ? fmt(event.endAt) : fmt(new Date(new Date(event.startAt).getTime() + 2 * 60 * 60 * 1000).toISOString());
                      const loc = [event.venue, event.address].filter(Boolean).join(", ");
                      const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${start}/${end}&details=${encodeURIComponent(event.description ?? "")}&location=${encodeURIComponent(loc)}`;

                      // Build ICS content for Apple Calendar
                      const uid = `${event.id}@chessotb.club`;
                      const now = fmt(new Date().toISOString());
                      const icsLines = [
                        "BEGIN:VCALENDAR",
                        "VERSION:2.0",
                        "PRODID:-//ChessOTB.club//EN",
                        "BEGIN:VEVENT",
                        `UID:${uid}`,
                        `DTSTAMP:${now}`,
                        `DTSTART:${start}`,
                        `DTEND:${end}`,
                        `SUMMARY:${event.title}`,
                        `DESCRIPTION:${(event.description ?? "").replace(/\n/g, "\\n")}`,
                        `LOCATION:${loc}`,
                        "END:VEVENT",
                        "END:VCALENDAR",
                      ];
                      const icsBlob = new Blob([icsLines.join("\r\n")], { type: "text/calendar" });
                      const icsUrl = URL.createObjectURL(icsBlob);

                      return (
                        <div
                          className="rounded-2xl px-5 py-4"
                          style={{ background: "oklch(0.15 0.05 145)", border: "1px solid rgba(255,255,255,0.08)" }}
                        >
                          <div className="flex items-center gap-2 mb-3">
                            <CalendarPlus className="w-4 h-4" style={{ color: "oklch(0.65 0.18 145)" }} />
                            <p className="text-white/50 text-xs font-semibold uppercase tracking-wider">Add to Calendar</p>
                          </div>
                          <div className="flex gap-2">
                            <a
                              href={googleUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] hover:brightness-110"
                              style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.75)", border: "1px solid rgba(255,255,255,0.12)" }}
                            >
                              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" opacity="0" /><path d="M19.07 4.93A9.97 9.97 0 0 0 12 2C6.48 2 2 6.48 2 12c0 2.76 1.12 5.26 2.93 7.07L19.07 4.93zM4.93 19.07A9.97 9.97 0 0 0 12 22c5.52 0 10-4.48 10-10 0-2.76-1.12-5.26-2.93-7.07L4.93 19.07z" opacity="0" /></svg>
                              <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                              Google
                            </a>
                            <a
                              href={icsUrl}
                              download={`${event.title.replace(/[^a-z0-9]/gi, "-")}.ics`}
                              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] hover:brightness-110"
                              style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.75)", border: "1px solid rgba(255,255,255,0.12)" }}
                            >
                              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
                              Apple
                            </a>
                          </div>
                        </div>
                      );
                    })()}

                    {/* RSVP Form Builder — owner/director only */}
                    {isOwnerOrDirector && clubId && eventId && (
                      <a
                        href={`/clubs/${clubId}/meetup/${eventId}/rsvp-form/builder`}
                        className="flex items-center gap-3 px-5 py-4 rounded-2xl transition-all hover:scale-[1.01] active:scale-[0.99] group"
                        style={{ background: "oklch(0.17 0.05 145)", border: "1px solid rgba(255,255,255,0.09)" }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "oklch(0.50 0.14 145)"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.09)"; }}
                      >
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ background: "oklch(0.50 0.14 145 / 0.15)" }}
                        >
                          <ClipboardList className="w-5 h-5" style={{ color: "oklch(0.65 0.18 145)" }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-semibold text-sm">RSVP Form Survey</p>
                          <p className="text-white/40 text-xs mt-0.5">Build a form &amp; get a shareable link for attendees</p>
                        </div>
                        <svg className="w-4 h-4 text-white/30 group-hover:text-white/60 transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </a>
                    )}

                    {/* ── Payment Links — shown when club has at least one payment method configured ── */}
                    {club && (club.paymentVenmo || club.paymentCashapp || club.paymentPaypal || club.paymentQrUrl) && (
                      <div
                        className="rounded-2xl overflow-hidden transition-all duration-300 hover:border-white/15"
                        style={{ background: "oklch(0.15 0.05 145)", border: "1px solid rgba(255,255,255,0.08)" }}
                      >
                        <div className="px-5 py-4 border-b border-white/08 flex items-center gap-2">
                          <DollarSign className="w-4 h-4" style={{ color: accentColor }} />
                          <h2 className="text-white/60 text-xs font-bold uppercase tracking-wider">Pay Entry Fee</h2>
                          {event.admissionNote && (
                            <span className="ml-auto text-xs font-semibold" style={{ color: accentColor }}>{event.admissionNote}</span>
                          )}
                        </div>
                        <div className="p-5 space-y-3">
                          {club.paymentNote && (
                            <p className="text-white/50 text-xs leading-relaxed mb-3">{club.paymentNote}</p>
                          )}
                          {club.paymentVenmo && (
                            <a
                              href={club.paymentVenmo.startsWith("http") ? club.paymentVenmo : `https://venmo.com/${club.paymentVenmo.replace(/^@/, "")}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 hover:scale-[1.01] active:scale-[0.98]"
                              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)" }}
                            >
                              <span className="text-lg">💸</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-white font-semibold text-sm">Venmo</p>
                                <p className="text-white/40 text-xs truncate">{club.paymentVenmo}</p>
                              </div>
                              <ExternalLink className="w-3.5 h-3.5 text-white/30" />
                            </a>
                          )}
                          {club.paymentCashapp && (
                            <a
                              href={club.paymentCashapp.startsWith("http") ? club.paymentCashapp : `https://cash.app/${club.paymentCashapp.replace(/^\$/, "$")}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 hover:scale-[1.01] active:scale-[0.98]"
                              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)" }}
                            >
                              <span className="text-lg">💵</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-white font-semibold text-sm">Cash App</p>
                                <p className="text-white/40 text-xs truncate">{club.paymentCashapp}</p>
                              </div>
                              <ExternalLink className="w-3.5 h-3.5 text-white/30" />
                            </a>
                          )}
                          {club.paymentPaypal && (
                            <a
                              href={club.paymentPaypal.startsWith("http") ? club.paymentPaypal : `https://paypal.me/${club.paymentPaypal}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 hover:scale-[1.01] active:scale-[0.98]"
                              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)" }}
                            >
                              <span className="text-lg">🅿️</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-white font-semibold text-sm">PayPal</p>
                                <p className="text-white/40 text-xs truncate">{club.paymentPaypal}</p>
                              </div>
                              <ExternalLink className="w-3.5 h-3.5 text-white/30" />
                            </a>
                          )}
                          {club.paymentQrUrl && (
                            <div className="flex justify-center pt-2">
                              <img src={club.paymentQrUrl} alt="Payment QR code" className="w-36 h-36 rounded-xl border border-white/10 object-contain bg-white/5" />
                            </div>
                          )}
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

      {/* ── CHECK-IN ANNOUNCE MODAL (full-screen projection) ───────────────── */}
      <CheckInAnnounceModal
        open={showQr}
        onClose={() => setShowQr(false)}
        eventName={event.title}
        checkInUrl={`${window.location.origin}/checkin/${event.id}`}
      />
    </div>
  );
}
