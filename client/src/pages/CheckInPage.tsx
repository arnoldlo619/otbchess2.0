/**
 * CheckInPage — /checkin/:eventId
 *
 * Full-screen check-in landing page matching the ClubDashboard shell:
 * - Left icon rail (desktop) with club avatar + nav icons
 * - Branded top bar with breadcrumb + AvatarNavDropdown
 * - Micro-grid hero banner with event title
 * - Two-column layout: check-in action (left) + attendees with ratings (right)
 * - Mobile bottom nav consistent with ClubDashboard
 */
import { useState, useEffect, useCallback } from "react";
import { useParams, useLocation, Link } from "wouter";
import {
  CheckCircle,
  Users,
  Calendar,
  Clock,
  MapPin,
  ExternalLink,
  LogIn,
  Loader2,
  ChevronLeft,
  Megaphone,
  Settings2,
} from "lucide-react";
import { useAuthContext } from "@/context/AuthContext";
import { AvatarNavDropdown } from "@/components/AvatarNavDropdown";
import AuthModal from "@/components/AuthModal";
import {
  getClubEvent,
  checkInToEvent,
  getCheckedInUserIds,
  type ClubEvent,
} from "@/lib/clubEventRegistry";
import { getClubMembers, getClub, type Club } from "@/lib/clubRegistry";
import { authFetch } from "@/lib/apiFetch";
import { ClubDashboardSidebar, type ClubDashboardSidebarItem } from "@/components/club/ClubDashboardSidebar";
import { MeetupAttendeeProfileSheet, type MeetupAttendeeProfile } from "@/components/meetup/MeetupAttendeeProfileSheet";

interface AttendeeWithRating extends MeetupAttendeeProfile {
  userId: string;
}

function formatEventDate(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function formatEventTime(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

const sidebarTabs: ClubDashboardSidebarItem[] = [
  { id: "feed", label: "Feed", icon: Megaphone, group: "workspace" },
  { id: "events", label: "Events", icon: Calendar, group: "workspace" },
  { id: "members", label: "Members", icon: Users, group: "workspace" },
  { id: "settings", label: "Settings", icon: Settings2, group: "manage" },
];

export default function CheckInPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const [, navigate] = useLocation();
  const { user } = useAuthContext();

  const [event, setEvent] = useState<ClubEvent | null>(null);
  const [club, setClub] = useState<Club | null>(null);
  const [checkedIn, setCheckedIn] = useState<string[]>([]);
  const [attendees, setAttendees] = useState<AttendeeWithRating[]>([]);
  const [hasCheckedIn, setHasCheckedIn] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [selectedAttendee, setSelectedAttendee] = useState<AttendeeWithRating | null>(null);
  // True while the initial event fetch is in-flight (prevents "Event not found" flash)
  const [loadingEvent, setLoadingEvent] = useState(true);
  // Auth modal — shown when unauthenticated user lands via QR scan
  const [showAuthModal, setShowAuthModal] = useState(false);
  // Pending check-in flag — auto-fires after sign-in
  const [pendingCheckIn, setPendingCheckIn] = useState(false);
  const [sidebarHovered, setSidebarHovered] = useState(false);
  const [sidebarKeyboardExpanded, setSidebarKeyboardExpanded] = useState(false);
  const sidebarTemporarilyExpanded = sidebarHovered || sidebarKeyboardExpanded;

  const refresh = useCallback(async () => {
    if (!eventId) return;
    // Try localStorage first; if empty (e.g. fresh QR scan on new device), fetch from server
    let ev = getClubEvent(eventId);
    if (!ev) {
      try {
        const evRes = await authFetch(`/api/clubs/event/${eventId}`);
        if (evRes.ok) {
          const evData = await evRes.json() as import("@/lib/clubEventRegistry").ClubEvent;
          ev = evData;
          setEvent(ev);
        }
      } catch { /* ignore */ }
    } else {
      setEvent(ev);
    }
    // Mark event loading as done (success or not-found)
    setLoadingEvent(false);
    if (!ev) return;

    // Fetch club info — try server if not in localStorage
    let c = getClub(ev.clubId);
    if (!c) {
      try {
        const cRes = await authFetch(`/api/clubs/${ev.clubId}`);
        if (cRes.ok) c = await cRes.json();
      } catch { /* ignore */ }
    }
    setClub(c ?? null);

    // ── Fetch check-ins from DB (falls back to localStorage if API unavailable) ──
    let ids: string[] = [];
    try {
      const res = await authFetch(`/api/clubs/${ev.clubId}/events/${eventId}/checkins`);
      if (res.ok) {
        const rows = await res.json() as Array<{ userId: string; displayName: string; avatarUrl: string | null; chesscomUsername: string | null }>;
        ids = rows.map((r) => r.userId);
        setCheckedIn(ids);
        if (user) setHasCheckedIn(ids.includes(user.id));
        // Ratings are loaded only if an attendee opens the compact profile sheet.
        const list: AttendeeWithRating[] = rows.map((row) => ({
          userId: row.userId,
          displayName: row.displayName,
          avatarUrl: row.avatarUrl,
          chesscomUsername: row.chesscomUsername,
          rapid: null,
          blitz: null,
        }));
        setAttendees(list);
        return;
      }
    } catch { /* fall through to localStorage */ }

    // Fallback: localStorage
    ids = getCheckedInUserIds(eventId);
    setCheckedIn(ids);
    if (user) setHasCheckedIn(ids.includes(user.id));
    const members = getClubMembers(ev.clubId);
    const list: AttendeeWithRating[] = ids.map((uid) => {
        const member = members.find((m) => m.userId === uid);
        return {
          userId: uid,
          displayName: member?.displayName ?? uid,
          avatarUrl: member?.avatarUrl ?? null,
          chesscomUsername: member?.chesscomUsername ?? null,
          rapid: null,
          blitz: null,
        };
      });
    setAttendees(list);
  }, [eventId, user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Poll every 30 seconds so the attendee list stays live (owner QR screen)
  useEffect(() => {
    const id = setInterval(() => { refresh(); }, 30_000);
    return () => clearInterval(id);
  }, [refresh]);

  // Auto-fire check-in after sign-in if the user arrived via QR scan
  useEffect(() => {
    if (user && pendingCheckIn && event && !hasCheckedIn) {
      setPendingCheckIn(false);
      handleCheckIn();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, pendingCheckIn, event, hasCheckedIn]);

  async function handleCheckIn() {
    if (!user || !event) return;
    setCheckingIn(true);
    try {
      // Persist to DB
      await authFetch(`/api/clubs/${event.clubId}/events/${event.id}/checkin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clubId: event.clubId,
          displayName: user.displayName ?? user.email ?? user.id,
          avatarUrl: user.avatarUrl ?? null,
          chesscomUsername: user.chesscomUsername ?? null,
        }),
      });
    } catch { /* ignore — localStorage fallback below */ }
    // Also update localStorage for offline resilience
    checkInToEvent(event.id, user.id);
    await refresh();
    setCheckingIn(false);
    // Redirect member to the event page so they can see who else is checked in
    navigate(`/clubs/${event.clubId}/meetup/${event.id}`);
  }

  const accentColor = event?.accentColor ?? club?.accentColor ?? "#4CAF50";
  const clubId = event?.clubId;

  if (loadingEvent || !event) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: "oklch(0.10 0.04 145)" }}>
        {loadingEvent ? (
          <>
            {/* Spinner */}
            <div
              className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: "oklch(0.55 0.18 145)", borderTopColor: "transparent" }}
            />
            {/* Skeleton cards */}
            <div className="w-72 flex flex-col gap-3 mt-4">
              <div className="h-5 rounded-lg animate-pulse" style={{ background: "oklch(0.20 0.04 145)" }} />
              <div className="h-4 w-3/4 rounded-lg animate-pulse" style={{ background: "oklch(0.18 0.04 145)" }} />
              <div className="h-4 w-1/2 rounded-lg animate-pulse" style={{ background: "oklch(0.16 0.04 145)" }} />
            </div>
            <p className="text-white/30 text-xs mt-2">Loading event…</p>
          </>
        ) : (
          <div className="text-white/40 text-sm">Event not found.</div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "oklch(0.20 0.06 145)" }}>
      <div className="flex h-screen overflow-hidden">

        <div className="hidden w-[72px] min-w-[72px] flex-shrink-0 lg:block" />
        <ClubDashboardSidebar
          accent={accentColor}
          background="oklch(0.115 0.025 145)"
          borderColor="oklch(0.22 0.06 145)"
          brandActionLabel="Back to all clubs"
          items={sidebarTabs}
          activeId="events"
          collapsed
          temporarilyExpanded={sidebarTemporarilyExpanded}
          onPointerExpandedChange={setSidebarHovered}
          onFocusExpandedChange={setSidebarKeyboardExpanded}
          onSelect={(nextTab) => clubId && navigate(`/clubs/${clubId}/home?tab=${nextTab}`)}
          onBackToClubs={() => navigate("/clubs")}
        />

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
              onClick={() => clubId && navigate(`/clubs/${clubId}/meetup/${event.id}`)}
              className="lg:hidden p-1.5 rounded-lg transition-opacity hover:opacity-70"
              style={{ color: "oklch(0.65 0.12 145)" }}
            >
              <ChevronLeft size={15} />
            </button>
            {/* Desktop breadcrumb */}
            <button
              onClick={() => clubId && navigate(`/clubs/${clubId}/home`)}
              className="hidden lg:flex items-center gap-1.5 text-white/40 hover:text-white/70 text-sm font-medium transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              {club?.name ?? "Club"}
            </button>
            <span className="hidden lg:block text-white/20 text-sm">/</span>
            <Link
              href={`/clubs/${clubId}/meetup/${event.id}`}
              className="hidden lg:block text-white/40 hover:text-white/70 text-sm font-medium transition-colors truncate max-w-[160px]"
            >
              {event.title}
            </Link>
            <span className="hidden lg:block text-white/20 text-sm">/</span>
            <span className="hidden lg:block text-white/70 text-sm font-semibold">Check-in</span>
            {/* Mobile title */}
            <div className="lg:hidden flex-1 min-w-0">
              <span className="text-sm font-bold text-white">Check-in</span>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <AvatarNavDropdown currentPage="Clubs" />
            </div>
          </div>

          {/* ── SCROLLABLE CONTENT ────────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto pb-20 lg:pb-6">
            <div className="px-4 lg:px-8 py-6">
              <div className="max-w-5xl mx-auto">

                {/* ── HERO BANNER ───────────────────────────────────────── */}
                <div
                  className="relative rounded-3xl overflow-hidden mb-6"
                  style={{
                    background: event.coverImageUrl
                      ? `url(${event.coverImageUrl}) center/cover no-repeat`
                      : `linear-gradient(135deg, ${accentColor}33 0%, ${accentColor}11 40%, oklch(0.12 0.06 240) 100%)`,
                    minHeight: "180px",
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
                  <div
                    className="absolute inset-0"
                    style={{ background: "linear-gradient(to top, oklch(0.12 0.05 145) 0%, transparent 55%)" }}
                  />
                  <div className="relative z-10 flex flex-col justify-end h-full p-6 pt-12">
                    <div className="flex items-center gap-2 mb-3">
                      <span
                        className="text-[10px] font-bold px-2.5 py-1 rounded-full tracking-widest uppercase"
                        style={{ background: accentColor + "22", color: accentColor, border: `1px solid ${accentColor}44` }}
                      >
                        Check-in
                      </span>
                      {hasCheckedIn && (
                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full tracking-widest uppercase bg-green-500/20 text-green-400 border border-green-500/30">
                          Checked In ✓
                        </span>
                      )}
                    </div>
                    <h1
                      className="text-2xl lg:text-3xl font-black text-white leading-tight"
                      style={{ fontFamily: "'Clash Display', sans-serif" }}
                    >
                      {event.title}
                    </h1>
                    <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-white/55">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" style={{ color: accentColor }} />
                        {formatEventDate(event.startAt)}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" style={{ color: accentColor }} />
                        {formatEventTime(event.startAt)}
                        {event.endAt && ` – ${formatEventTime(event.endAt)}`}
                      </span>
                      {event.venue && (
                        <span className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5" style={{ color: accentColor }} />
                          {event.venue}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* ── TWO-COLUMN LAYOUT ─────────────────────────────────── */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                  {/* ── LEFT: Check-in action ─────────────────────────── */}
                  <div className="lg:col-span-1 space-y-4">

                    {/* Check-in card */}
                    {!user ? (
                      <div
                        className="rounded-2xl px-6 py-8 text-center"
                        style={{ background: "oklch(0.15 0.05 145)", border: "1px solid rgba(255,255,255,0.08)" }}
                      >
                        <div
                          className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                          style={{ background: accentColor + "22" }}
                        >
                          <LogIn className="w-7 h-7" style={{ color: accentColor }} />
                        </div>
                        <p className="text-white font-bold mb-1">Sign in to check in</p>
                        <p className="text-white/50 text-sm mb-5 leading-relaxed">
                          Sign in with your OTB account to confirm your attendance at this meetup.
                        </p>
                        <button
                          onClick={() => { setPendingCheckIn(true); setShowAuthModal(true); }}
                          className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-sm font-bold transition-all active:scale-95 hover:brightness-110"
                          style={{ background: accentColor, color: '#ffffff' }}
                        >
                          <LogIn className="w-4 h-4" />
                          Sign In &amp; Check In
                        </button>
                      </div>
                    ) : hasCheckedIn ? (
                      <div
                        className="rounded-2xl px-6 py-6 flex flex-col items-center text-center gap-3"
                        style={{ background: "rgba(76,175,80,0.10)", border: "1px solid rgba(76,175,80,0.30)" }}
                      >
                        <div
                          className="w-14 h-14 rounded-full flex items-center justify-center"
                          style={{ background: "rgba(76,175,80,0.20)" }}
                        >
                          <CheckCircle className="w-8 h-8" style={{ color: accentColor }} />
                        </div>
                        <div>
                          <div className="text-white font-bold text-lg">You're checked in!</div>
                          <div className="text-white/50 text-sm mt-1">Your attendance has been recorded.</div>
                        </div>
                        <Link
                          href={`/clubs/${clubId}/meetup/${event.id}`}
                          className="flex items-center gap-1.5 text-xs font-semibold mt-1 transition-colors"
                          style={{ color: accentColor }}
                        >
                          View Event Page →
                        </Link>
                      </div>
                    ) : (
                      <div
                        className="rounded-2xl px-6 py-6 flex flex-col items-center text-center gap-4"
                        style={{ background: "oklch(0.15 0.05 145)", border: "1px solid rgba(255,255,255,0.08)" }}
                      >
                        <div
                          className="w-14 h-14 rounded-2xl flex items-center justify-center"
                          style={{ background: accentColor + "22" }}
                        >
                          <Users className="w-7 h-7" style={{ color: accentColor }} />
                        </div>
                        <div>
                          <div className="text-white font-bold">Ready to check in?</div>
                          <div className="text-white/40 text-sm mt-1">Tap below to mark your attendance.</div>
                        </div>
                        <button
                          onClick={handleCheckIn}
                          disabled={checkingIn}
                          className="w-full py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-60"
                          style={{ background: accentColor, color: '#ffffff' }}
                        >
                          {checkingIn ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <CheckCircle className="w-4 h-4" />
                          )}
                          {checkingIn ? "Checking in…" : "Check In to Meetup"}
                        </button>
                      </div>
                    )}

                  </div>

                  {/* ── RIGHT: Checked-in attendees ──────────────────── */}
                  <div className="lg:col-span-2">
                    <div
                      className="rounded-2xl overflow-hidden"
                      style={{ background: "oklch(0.15 0.05 145)", border: "1px solid rgba(255,255,255,0.08)" }}
                    >
                      <div className="px-5 py-4 border-b border-white/08 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-white/40" />
                          <span className="text-white/60 text-xs font-bold uppercase tracking-wider">
                            Checked In · {checkedIn.length}
                          </span>
                        </div>
                      </div>

                      {attendees.length === 0 ? (
                        <div className="px-5 py-12 text-center">
                          <div
                            className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3"
                            style={{ background: "rgba(255,255,255,0.05)" }}
                          >
                            <Users className="w-6 h-6 text-white/20" />
                          </div>
                          <p className="text-white/30 text-sm">No one has checked in yet.</p>
                          <p className="text-white/20 text-xs mt-1">Be the first!</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-white/05">
                          {attendees.map((a, idx) => (
                            <div key={a.userId} className="flex items-center gap-3 px-5 py-3.5">
                              {/* Rank */}
                              <span className="text-white/20 text-xs font-bold w-5 text-right flex-shrink-0">
                                {idx + 1}
                              </span>
                              {/* Avatar opens a compact, ratings-first attendee preview. */}
                              <button
                                type="button"
                                onClick={() => setSelectedAttendee(a)}
                                className="group relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-full border border-transparent text-sm font-bold transition duration-200 hover:scale-105 hover:border-white/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
                                style={{ background: "rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.60)" }}
                                aria-label={`View ${a.displayName}'s profile`}
                              >
                                {a.avatarUrl ? (
                                  <img loading="lazy" decoding="async" src={a.avatarUrl} alt="" className="h-full w-full object-cover transition duration-200 group-hover:scale-110" />
                                ) : (
                                  a.displayName.charAt(0).toUpperCase()
                                )}
                              </button>
                              {/* Name + chess.com */}
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
                              {/* Checked-in badge */}
                              <CheckCircle className="w-4 h-4 flex-shrink-0" style={{ color: accentColor }} />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── MOBILE BOTTOM NAV ──────────────────────────────────────────────── */}
      <nav
        aria-label="Club dashboard mobile navigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around px-2 py-2"
        style={{
          background: "oklch(0.13 0.04 145 / 0.97)",
          borderTop: "1px solid oklch(0.22 0.06 145)",
          backdropFilter: "blur(12px)",
        }}
      >
        {sidebarTabs.map((ct) => {
          const Icon = ct.icon;
          const isActive = ct.id === "events";
          return (
            <button
              key={ct.id}
              onClick={() => clubId && navigate(`/clubs/${clubId}/home?tab=${ct.id}`)}
              className="flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-all"
              style={{ color: isActive ? accentColor : "oklch(0.50 0.06 145)" }}
            >
              <Icon size={18} />
              <span className="text-[9px] font-semibold">{ct.label}</span>
            </button>
          );
        })}
      </nav>

      <MeetupAttendeeProfileSheet
        attendee={selectedAttendee}
        accentColor={accentColor}
        onClose={() => setSelectedAttendee(null)}
      />

      {/* ── AUTH MODAL — shown when unauthenticated user scans QR code ─────── */}
      {showAuthModal && (
        <AuthModal
          isOpen
          isDark
          onClose={() => { setShowAuthModal(false); setPendingCheckIn(false); }}
          onSuccess={() => setShowAuthModal(false)}
        />
      )}
    </div>
  );
}
