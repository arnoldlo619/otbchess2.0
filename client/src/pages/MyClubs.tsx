/**
 * MyClubs page — /clubs
 *
 * For signed-in users:
 *   - "My Clubs" section: clubs the user has joined
 *   - "Discover" section: all public clubs the user hasn't joined yet
 *   - "Create a Club" CTA
 *
 * For guests:
 *   - Full discovery grid with a sign-in prompt
 */
import { useState, useEffect, useMemo } from "react";
import { useLocation, Link } from "wouter";
import { NavLogo } from "@/components/NavLogo";
import { useAuthContext } from "@/context/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import {
  listAllClubs,
  listMyClubs,
  seedClubsIfEmpty,
  unfollowClub,
  joinClub,
  isFollowing,
  type Club,
  type ClubCategory,
} from "@/lib/clubRegistry";
import {
  listClubEvents,
  seedClubEventsIfEmpty,
  getUserRSVP,
  upsertRSVP,
  countRSVPs,
  getEventRSVPs,
  type ClubEvent,
  type ClubEventRSVP,
  type RSVPStatus,
} from "@/lib/clubEventRegistry";
import {
  Users,
  Trophy,
  MapPin,
  Search,
  Plus,
  ChevronLeft,
  Crown,
  Zap,
  Globe,
  BookOpen,
  GraduationCap,
  Building2,
  Filter,
  Bell,
  BellOff,
  UserPlus,
  CalendarDays,
  Clock,
  CheckCircle2,
  Circle,
  MinusCircle,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { CreateClubWizard } from "@/components/CreateClubWizard";

// ── Helpers ───────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<ClubCategory, string> = {
  club: "Chess Club",
  school: "School",
  university: "University",
  online: "Online",
  community: "Community",
  professional: "Academy",
};

const CATEGORY_ICONS: Record<ClubCategory, React.ReactNode> = {
  club: <Crown className="w-3.5 h-3.5" />,
  school: <BookOpen className="w-3.5 h-3.5" />,
  university: <GraduationCap className="w-3.5 h-3.5" />,
  online: <Globe className="w-3.5 h-3.5" />,
  community: <Users className="w-3.5 h-3.5" />,
  professional: <Building2 className="w-3.5 h-3.5" />,
};

const COUNTRY_FLAGS: Record<string, string> = {
  GB: "🇬🇧", US: "🇺🇸", DE: "🇩🇪", JP: "🇯🇵", IN: "🇮🇳", FR: "🇫🇷",
  ES: "🇪🇸", IT: "🇮🇹", CA: "🇨🇦", AU: "🇦🇺", BR: "🇧🇷", RU: "🇷🇺",
};

const ALL_CATEGORIES: Array<ClubCategory | "all"> = [
  "all", "club", "community", "university", "school", "professional", "online",
];

// ── Club card ─────────────────────────────────────────────────────────────────

function ClubCard({
  club,
  isDark,
  compact = false,
  toDashboard = false,
}: {
  club: Club;
  isDark: boolean;
  compact?: boolean;
  toDashboard?: boolean;
}) {
  const flag = COUNTRY_FLAGS[club.country] ?? "🌍";
  const card = isDark ? "bg-[#1a2e1d]" : "bg-white";
  const cardBorder = isDark ? "border-white/8" : "border-gray-100";
  const textMain = isDark ? "text-white" : "text-gray-900";
  const textMuted = isDark ? "text-white/50" : "text-gray-400";
  // Showcase clubs seeded as seed-club-7 through seed-club-11
  const isTrending = /^seed-club-(7|8|9|10|11)$/.test(club.id);

  return (
    <Link href={toDashboard ? `/clubs/${club.id}/home` : `/clubs/${club.id}`}>
      <div
        className={`group rounded-3xl border ${cardBorder} ${card} overflow-hidden transition-all duration-200 hover:shadow-xl hover:-translate-y-1 cursor-pointer`}
      >
        {/* Banner — full-width, tall enough to show custom images properly */}
        <div
          className="h-36 relative overflow-hidden"
          style={{
            background: club.bannerUrl
              ? undefined
              : `linear-gradient(135deg, ${club.accentColor}dd 0%, ${club.accentColor}55 100%)`,
          }}
        >
          {club.bannerUrl ? (
            <img
              src={club.bannerUrl}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 chess-board-bg opacity-15" />
          )}
          {/* Dark scrim for text legibility */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
          {/* Trending badge */}
          {isTrending && (
            <div className="absolute top-3 right-3 flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-400/90 text-black backdrop-blur-sm">
              <Zap className="w-3 h-3" />
              Trending
            </div>
          )}
        </div>

        {/* Avatar — overlaps banner bottom edge, raised above banner via z-index */}
        <div className="px-5 relative z-10">
          <div
            className="-mt-8 w-16 h-16 rounded-2xl flex items-center justify-center text-2xl shadow-xl border-2 border-white/30 overflow-hidden"
            style={{ background: `linear-gradient(135deg, ${club.accentColor} 0%, ${club.accentColor}88 100%)` }}
          >
            {club.avatarUrl ? (
              <img src={club.avatarUrl} alt={club.name} className="w-full h-full object-cover" />
            ) : (
              <span>{flag}</span>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="px-5 pt-3 pb-5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3
                className={`text-lg font-bold leading-tight truncate ${textMain}`}
                style={{ fontFamily: "'Clash Display', sans-serif" }}
              >
                {club.name}
              </h3>
              <div className={`flex items-center gap-1.5 mt-0.5 text-xs ${textMuted}`}>
                <MapPin className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{club.location}</span>
              </div>
            </div>
            <span
              className={`flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold mt-0.5 ${
                isDark ? "bg-white/8 text-white/50" : "bg-gray-100 text-gray-500"
              }`}
            >
              {CATEGORY_ICONS[club.category]}
              {CATEGORY_LABELS[club.category]}
            </span>
          </div>

          <p className={`text-sm mt-2.5 leading-relaxed line-clamp-2 ${textMuted}`}>
            {club.tagline}
          </p>

          {/* Stats */}
          <div className={`flex items-center gap-5 mt-4 pt-3.5 border-t ${isDark ? "border-white/6" : "border-gray-100"}`}>
            <span className={`flex items-center gap-1.5 text-xs font-semibold ${textMuted}`}>
              <Users className="w-3.5 h-3.5" />
              {club.memberCount.toLocaleString()}
            </span>
            <span className={`flex items-center gap-1.5 text-xs font-semibold ${textMuted}`}>
              <Trophy className="w-3.5 h-3.5" />
              {club.tournamentCount}
            </span>
            {club.announcement && (
              <span className={`flex items-center gap-1 text-[10px] font-bold ml-auto ${
                isDark ? "text-amber-400" : "text-amber-600"
              }`}>
                <Zap className="w-3 h-3" />
                Active
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

// ── Followed club card (with Unfollow + Join actions) ───────────────────────

function FollowedClubCard({
  club,
  isDark,
  onUnfollow,
  onJoin,
}: {
  club: Club;
  isDark: boolean;
  onUnfollow: () => void;
  onJoin: () => void;
}) {
  const flag = COUNTRY_FLAGS[club.country] ?? "🌍";
  const card = isDark ? "bg-[#1a2e1d]" : "bg-white";
  const cardBorder = isDark ? "border-white/8" : "border-gray-100";
  const textMain = isDark ? "text-white" : "text-gray-900";
  const textMuted = isDark ? "text-white/50" : "text-gray-400";

  return (
    <div className={`rounded-3xl border ${cardBorder} ${card} overflow-hidden`}>
      {/* Banner */}
      <Link href={`/clubs/${club.id}`}>
        <div
          className="h-28 relative overflow-hidden cursor-pointer"
          style={{
            background: club.bannerUrl
              ? undefined
              : `linear-gradient(135deg, ${club.accentColor}dd 0%, ${club.accentColor}55 100%)`,
          }}
        >
          {club.bannerUrl ? (
            <img src={club.bannerUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 chess-board-bg opacity-15" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
        </div>
      </Link>

      {/* Avatar */}
      <div className="px-4 relative z-10">
        <div
          className="-mt-7 w-14 h-14 rounded-2xl flex items-center justify-center text-xl shadow-xl border-2 border-white/30 overflow-hidden"
          style={{ background: `linear-gradient(135deg, ${club.accentColor} 0%, ${club.accentColor}88 100%)` }}
        >
          {club.avatarUrl ? (
            <img src={club.avatarUrl} alt={club.name} className="w-full h-full object-cover" />
          ) : (
            <span>{flag}</span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pt-2 pb-4">
        <Link href={`/clubs/${club.id}`}>
          <h3 className={`text-base font-bold leading-tight truncate cursor-pointer hover:underline ${textMain}`}
            style={{ fontFamily: "'Clash Display', sans-serif" }}>
            {club.name}
          </h3>
        </Link>
        <p className={`text-xs mt-1 line-clamp-2 leading-relaxed ${textMuted}`}>{club.tagline}</p>

        {/* Stats row */}
        <div className={`flex items-center gap-4 mt-3 pt-3 border-t ${isDark ? "border-white/6" : "border-gray-100"}`}>
          <span className={`flex items-center gap-1 text-xs font-semibold ${textMuted}`}>
            <Users className="w-3.5 h-3.5" />
            {club.memberCount.toLocaleString()}
          </span>
          <span className={`flex items-center gap-1 text-xs font-semibold ${textMuted}`}>
            <Trophy className="w-3.5 h-3.5" />
            {club.tournamentCount}
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 mt-3">
          <button
            onClick={onJoin}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold bg-[#3D6B47] text-white hover:bg-[#2d5236] transition-colors active:scale-95"
          >
            <UserPlus className="w-3.5 h-3.5" />
            Join
          </button>
          <button
            onClick={onUnfollow}
            className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-colors active:scale-95 ${
              isDark
                ? "border-white/10 text-white/50 hover:text-red-400 hover:border-red-400/30 bg-white/4"
                : "border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-200 bg-white"
            }`}
          >
            <BellOff className="w-3.5 h-3.5" />
            Unfollow
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Upcoming Events tab component ────────────────────────────────────────────

type EnrichedEvent = ClubEvent & { clubName: string; clubAccent: string; isJoined: boolean };

function formatEventDate(iso: string): { day: string; month: string; weekday: string; time: string } {
  const d = new Date(iso);
  return {
    day: d.toLocaleDateString("en-US", { day: "2-digit" }),
    month: d.toLocaleDateString("en-US", { month: "short" }).toUpperCase(),
    weekday: d.toLocaleDateString("en-US", { weekday: "short" }),
    time: d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
  };
}

function getDateGroup(iso: string): string {
  const now = new Date();
  const d = new Date(iso);
  const diffDays = Math.floor((d.getTime() - now.getTime()) / 86400000);
  if (diffDays < 1) return "Today";
  if (diffDays < 7) return "This Week";
  if (diffDays < 30) return "This Month";
  return "Later";
}

const RSVP_OPTIONS: Array<{ status: RSVPStatus; label: string; icon: React.ReactNode; activeClass: string }> = [
  { status: "going", label: "Going", icon: <CheckCircle2 className="w-3.5 h-3.5" />, activeClass: "bg-[#3D6B47] text-white" },
  { status: "maybe", label: "Maybe", icon: <MinusCircle className="w-3.5 h-3.5" />, activeClass: "bg-amber-500/20 text-amber-400" },
  { status: "not_going", label: "Can't Go", icon: <Circle className="w-3.5 h-3.5" />, activeClass: "bg-red-500/15 text-red-400" },
];

function UpcomingEventsTab({
  events,
  userId,
  isDark,
  textMain,
  textMuted,
  card,
  cardBorder,
  onRsvpChange,
}: {
  events: EnrichedEvent[];
  userId: string;
  isDark: boolean;
  textMain: string;
  textMuted: string;
  card: string;
  cardBorder: string;
  onRsvpChange: () => void;
}) {
  if (events.length === 0) {
    return (
      <div className={`rounded-3xl border ${cardBorder} ${card} py-16 text-center`}>
        <CalendarDays className={`w-12 h-12 mx-auto mb-3 ${textMuted}`} />
        <p className={`text-base font-semibold ${textMain}`}>No upcoming events</p>
        <p className={`text-sm mt-1 ${textMuted}`}>Events from your joined and followed clubs will appear here</p>
      </div>
    );
  }

  // Group by date bucket
  const groups: Record<string, EnrichedEvent[]> = {};
  const ORDER = ["Today", "This Week", "This Month", "Later"];
  for (const ev of events) {
    const g = getDateGroup(ev.startAt);
    if (!groups[g]) groups[g] = [];
    groups[g].push(ev);
  }

  return (
    <div className="space-y-8">
      {ORDER.filter((g) => groups[g]?.length).map((group) => (
        <section key={group}>
          <div className="flex items-center gap-3 mb-4">
            <h2 className={`text-sm font-semibold uppercase tracking-wider ${textMuted}`}>{group}</h2>
            <div className={`flex-1 h-px ${isDark ? "bg-white/8" : "bg-gray-100"}`} />
          </div>
          <div className="space-y-3">
            {groups[group].map((ev) => (
              <EventCard
                key={ev.id}
                event={ev}
                userId={userId}
                isDark={isDark}
                textMain={textMain}
                textMuted={textMuted}
                card={card}
                cardBorder={cardBorder}
                onRsvpChange={onRsvpChange}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/** Stacked overlapping avatar circles for RSVP'd attendees */
function RsvpAvatarStack({
  rsvps,
  accentColor,
  isDark,
  max = 6,
}: {
  rsvps: ClubEventRSVP[];
  accentColor?: string;
  isDark: boolean;
  max?: number;
}) {
  const going = rsvps.filter((r) => r.status === "going");
  if (!going.length) return null;
  const shown = going.slice(0, max);
  const extra = going.length - shown.length;
  const accent = accentColor ?? "#4CAF50";
  return (
    <div className="flex items-center gap-2 ml-auto flex-shrink-0">
      <div className="flex -space-x-2">
        {shown.map((r, i) => (
          <div
            key={r.userId}
            className="w-6 h-6 rounded-full border-2 flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0 overflow-hidden"
            style={{
              borderColor: isDark ? "#1a2e1d" : "#f9fafb",
              background: r.avatarUrl ? undefined : `hsl(${(i * 47 + 120) % 360}, 55%, 45%)`,
              zIndex: shown.length - i,
            }}
            title={r.displayName}
          >
            {r.avatarUrl ? (
              <img src={r.avatarUrl} alt={r.displayName} className="w-full h-full object-cover" />
            ) : (
              r.displayName.slice(0, 1).toUpperCase()
            )}
          </div>
        ))}
        {extra > 0 && (
          <div
            className="w-6 h-6 rounded-full border-2 flex items-center justify-center text-[9px] font-bold flex-shrink-0"
            style={{
              borderColor: isDark ? "#1a2e1d" : "#f9fafb",
              background: isDark ? "rgba(255,255,255,0.12)" : "#e5e7eb",
              color: isDark ? "rgba(255,255,255,0.6)" : "#6b7280",
            }}
          >
            +{extra}
          </div>
        )}
      </div>
      <span className="text-xs font-semibold" style={{ color: accent }}>
        {going.length} going
      </span>
    </div>
  );
}

function EventCard({
  event,
  userId,
  isDark,
  textMain,
  textMuted,
  card,
  cardBorder,
  onRsvpChange,
}: {
  event: EnrichedEvent;
  userId: string;
  isDark: boolean;
  textMain: string;
  textMuted: string;
  card: string;
  cardBorder: string;
  onRsvpChange: () => void;
}) {
  const { day, month, weekday, time } = formatEventDate(event.startAt);
  const rsvp = getUserRSVP(event.id, userId);
  const [rsvps, setRsvps] = useState<ClubEventRSVP[]>(() => getEventRSVPs(event.id));

  const handleRSVP = (status: RSVPStatus) => {
    upsertRSVP(event.id, event.clubId, userId, "Me", status);
    setRsvps(getEventRSVPs(event.id));
    onRsvpChange();
  };

  return (
    <div className={`rounded-3xl border ${cardBorder} ${card} overflow-hidden flex`}>
      {/* Cover image or gradient strip */}
      {event.coverImageUrl ? (
        <div className="w-24 sm:w-32 flex-shrink-0 relative overflow-hidden">
          <img src={event.coverImageUrl} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent to-black/20" />
        </div>
      ) : (
        <div
          className="w-3 flex-shrink-0"
          style={{ background: `linear-gradient(180deg, ${event.clubAccent}cc, ${event.clubAccent}44)` }}
        />
      )}

      {/* Main content */}
      <div className="flex flex-1 min-w-0 gap-4 p-4">
        {/* Date block */}
        <div className="flex-shrink-0 text-center w-12">
          <div className={`text-xs font-bold uppercase tracking-wider`} style={{ color: event.clubAccent }}>{month}</div>
          <div className={`text-2xl font-black leading-none ${textMain}`}>{day}</div>
          <div className={`text-xs ${textMuted} mt-0.5`}>{weekday}</div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className={`text-sm font-bold truncate ${textMain}`}>{event.title}</p>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <span className={`flex items-center gap-1 text-xs ${textMuted}`}>
                  <Clock className="w-3 h-3" />{time}
                </span>
                {event.venue && (
                  <span className={`flex items-center gap-1 text-xs ${textMuted}`}>
                    <MapPin className="w-3 h-3" />{event.venue}
                  </span>
                )}
              </div>
            </div>
            <Link href={`/clubs/${event.clubId}/home`}>
              <span
                className={`flex-shrink-0 flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full transition-colors ${
                  event.isJoined
                    ? isDark ? "bg-[#4CAF50]/12 text-[#4CAF50]" : "bg-[#3D6B47]/10 text-[#3D6B47]"
                    : isDark ? "bg-white/6 text-white/50" : "bg-gray-100 text-gray-500"
                }`}
              >
                {event.isJoined ? <Users className="w-3 h-3" /> : <Bell className="w-3 h-3" />}
                {event.clubName}
              </span>
            </Link>
          </div>

          {/* RSVP row */}
          <div className="flex items-center gap-2 mt-3">
            {RSVP_OPTIONS.map((opt) => (
              <button
                key={opt.status}
                onClick={() => handleRSVP(opt.status)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all active:scale-95 ${
                  rsvp?.status === opt.status
                    ? `${opt.activeClass} border-transparent`
                    : isDark
                    ? "border-white/8 text-white/40 hover:text-white hover:border-white/20 bg-white/3"
                    : "border-gray-200 text-gray-400 hover:text-gray-700 hover:border-gray-300 bg-white"
                }`}
              >
                {opt.icon}
                {opt.label}
              </button>
            ))}
            <RsvpAvatarStack
              rsvps={rsvps}
              accentColor={event.clubAccent}
              isDark={isDark}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MyClubs() {
  const [, navigate] = useLocation();
  const { user } = useAuthContext();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [activeTab, setActiveTab] = useState<"clubs" | "events">("clubs");
  const [allClubs, setAllClubs] = useState<Club[]>([]);
  const [myClubs, setMyClubs] = useState<Club[]>([]);
  const [followedClubs, setFollowedClubs] = useState<Club[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<Array<ClubEvent & { clubName: string; clubAccent: string; isJoined: boolean }>>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<ClubCategory | "all">("all");
  const [showFilters, setShowFilters] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [rsvpRefresh, setRsvpRefresh] = useState(0);

  const refreshClubs = () => {
    seedClubsIfEmpty();
    seedClubEventsIfEmpty();
    const all = listAllClubs();
    setAllClubs(all);
    if (user) {
      const joined = listMyClubs(user.id);
      setMyClubs(joined);
      const joinedIds = new Set(joined.map((c) => c.id));
      const followed = all.filter((c) => !joinedIds.has(c.id) && isFollowing(c.id, user.id));
      setFollowedClubs(followed);

      // Aggregate upcoming events from joined + followed clubs
      const relevantClubIds = [...joined.map((c) => c.id), ...followed.map((c) => c.id)];
      const uniqueClubIds = Array.from(new Set(relevantClubIds));
      const clubMap = new Map(all.map((c) => [c.id, c]));
      const now = new Date().toISOString();
      const events: Array<ClubEvent & { clubName: string; clubAccent: string; isJoined: boolean }> = [];
      for (const clubId of uniqueClubIds) {
        const club = clubMap.get(clubId);
        if (!club) continue;
        const clubEvents = listClubEvents(clubId).filter((e) => e.isPublished && e.startAt >= now);
        for (const ev of clubEvents) {
          events.push({ ...ev, clubName: club.name, clubAccent: club.accentColor, isJoined: joinedIds.has(clubId) });
        }
      }
      events.sort((a, b) => a.startAt.localeCompare(b.startAt));
      setUpcomingEvents(events);
    }
  };

  useEffect(() => {
    refreshClubs();
  }, [user, showWizard, rsvpRefresh]); // re-fetch after wizard closes or RSVP changes

  const myClubIds = useMemo(() => new Set(myClubs.map((c) => c.id)), [myClubs]);

  const discoverClubs = useMemo(() => {
    return allClubs.filter((c) => {
      if (myClubIds.has(c.id)) return false;
      if (categoryFilter !== "all" && c.category !== categoryFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          c.name.toLowerCase().includes(q) ||
          c.location.toLowerCase().includes(q) ||
          c.tagline.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [allClubs, myClubIds, search, categoryFilter]);

  // ── Colour palette ──────────────────────────────────────────────────────────
  const bg = isDark ? "bg-[#0d1a0f]" : "bg-[#F0F5EE]";
  const card = isDark ? "bg-[#1a2e1d]" : "bg-white";
  const cardBorder = isDark ? "border-white/8" : "border-gray-100";
  const textMain = isDark ? "text-white" : "text-gray-900";
  const textMuted = isDark ? "text-white/50" : "text-gray-400";
  const inputBg = isDark ? "bg-white/6 border-white/10 text-white placeholder:text-white/30" : "bg-white border-gray-200 text-gray-900 placeholder:text-gray-400";
  const divider = isDark ? "border-white/8" : "border-gray-100";

  return (
    <div className={`min-h-screen ${bg}`}>

      {/* ── Sticky header ──────────────────────────────────────────────────── */}
      <header className={`sticky top-0 z-30 border-b ${divider} ${isDark ? "bg-[#0d1a0f]/90" : "bg-white/90"} backdrop-blur-md`}>
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-3">
          <button
            onClick={() => navigate("/profile")}
            className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${isDark ? "text-white/60 hover:text-white" : "text-gray-400 hover:text-gray-900"}`}
          >
            <ChevronLeft className="w-4 h-4" />
            Profile
          </button>
          <div className={`w-px h-4 ${isDark ? "bg-white/15" : "bg-gray-200"}`} />
          <NavLogo className="h-7" />
          <div className="ml-auto">
            <button
              onClick={() => user ? setShowWizard(true) : navigate("/")}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold bg-[#3D6B47] text-white hover:bg-[#2d5236] transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Create Club</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-8">

        {/* ── Page title + tab bar ─────────────────────────────────────── */}
        <div>
          <h1
            className={`text-2xl sm:text-3xl font-bold ${textMain}`}
            style={{ fontFamily: "'Clash Display', sans-serif" }}
          >
            {user ? "My Clubs" : "Discover Clubs"}
          </h1>
          <p className={`text-sm mt-1 ${textMuted}`}>
            {user
              ? "Your chess communities and clubs you follow"
              : "Find and join chess clubs from around the world"}
          </p>

          {/* Tab bar — only for signed-in users */}
          {user && (
            <div className={`flex gap-1 mt-5 p-1 rounded-2xl w-fit ${isDark ? "bg-white/6" : "bg-black/5"}`}>
              <button
                onClick={() => setActiveTab("clubs")}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                  activeTab === "clubs"
                    ? isDark ? "bg-[#1a2e1d] text-white shadow-sm" : "bg-white text-gray-900 shadow-sm"
                    : isDark ? "text-white/50 hover:text-white" : "text-gray-500 hover:text-gray-900"
                }`}
              >
                <Users className="w-4 h-4" />
                Clubs
                {myClubs.length > 0 && (
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                    activeTab === "clubs"
                      ? "bg-[#3D6B47]/20 text-[#4CAF50]"
                      : isDark ? "bg-white/10 text-white/40" : "bg-black/8 text-gray-500"
                  }`}>{myClubs.length}</span>
                )}
              </button>
              <button
                onClick={() => setActiveTab("events")}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                  activeTab === "events"
                    ? isDark ? "bg-[#1a2e1d] text-white shadow-sm" : "bg-white text-gray-900 shadow-sm"
                    : isDark ? "text-white/50 hover:text-white" : "text-gray-500 hover:text-gray-900"
                }`}
              >
                <CalendarDays className="w-4 h-4" />
                Upcoming Events
                {upcomingEvents.length > 0 && (
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                    activeTab === "events"
                      ? "bg-[#3D6B47]/20 text-[#4CAF50]"
                      : isDark ? "bg-white/10 text-white/40" : "bg-black/8 text-gray-500"
                  }`}>{upcomingEvents.length}</span>
                )}
              </button>
            </div>
          )}
        </div>

        {/* ── Upcoming Events tab ──────────────────────────────────────────── */}
        {user && activeTab === "events" && (
          <UpcomingEventsTab
            events={upcomingEvents}
            userId={user.id}
            isDark={isDark}
            textMain={textMain}
            textMuted={textMuted}
            card={card}
            cardBorder={cardBorder}
            onRsvpChange={() => setRsvpRefresh((n) => n + 1)}
          />
        )}

        {/* ── Clubs tab content (hidden when events tab active) ─────────── */}
        {(!user || activeTab === "clubs") && (
          <>

        {/* ── Guest sign-in prompt ─────────────────────────────────────────── */}
        {!user && (
          <div className={`rounded-3xl border ${cardBorder} ${card} p-5 flex items-center gap-4`}>
            <div className="w-12 h-12 rounded-2xl bg-[#3D6B47]/15 flex items-center justify-center flex-shrink-0">
              <Crown className="w-6 h-6 text-[#4CAF50]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold ${textMain}`}>Sign in to join clubs</p>
              <p className={`text-xs mt-0.5 ${textMuted}`}>Track your clubs, get tournament updates, and connect with your community.</p>
            </div>
            <button
              onClick={() => navigate("/")}
              className="flex-shrink-0 px-4 py-2 rounded-xl text-sm font-semibold bg-[#3D6B47] text-white hover:bg-[#2d5236] transition-colors"
            >
              Sign In
            </button>
          </div>
        )}

        {/* ── Following section (signed-in, non-empty) ─────────────────── */}
        {user && followedClubs.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Bell className={`w-4 h-4 ${isDark ? "text-[#4CAF50]" : "text-[#3D6B47]"}`} />
                <h2 className={`text-sm font-semibold uppercase tracking-wider ${textMuted}`}>
                  Following
                </h2>
              </div>
              <span className={`text-xs font-medium ${textMuted}`}>{followedClubs.length}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {followedClubs.map((club) => (
                <FollowedClubCard
                  key={club.id}
                  club={club}
                  isDark={isDark}
                  onUnfollow={() => {
                    unfollowClub(club.id, user.id);
                    refreshClubs();
                    toast(`Unfollowed ${club.name}`);
                  }}
                  onJoin={() => {
                    joinClub(club.id, { userId: user.id, displayName: user.displayName, chesscomUsername: user.chesscomUsername, lichessUsername: user.lichessUsername, avatarUrl: user.avatarUrl });
                    refreshClubs();
                    toast.success(`Joined ${club.name}!`);
                  }}
                />
              ))}
            </div>
          </section>
        )}

        {/* ── My Clubs section (signed-in only) ───────────────────────────── */}
        {user && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className={`text-sm font-semibold uppercase tracking-wider ${textMuted}`}>
                Joined Clubs
              </h2>
              <span className={`text-xs font-medium ${textMuted}`}>{myClubs.length}</span>
            </div>

            {myClubs.length === 0 ? (
              <div className={`rounded-3xl border ${cardBorder} ${card} py-12 text-center`}>
                <Users className={`w-10 h-10 mx-auto mb-3 ${textMuted}`} />
                <p className={`text-sm font-semibold ${textMain}`}>No clubs yet</p>
                <p className={`text-xs mt-1 ${textMuted}`}>Browse the clubs below and join your community</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {myClubs.map((club) => (
                  <ClubCard key={club.id} club={club} isDark={isDark} toDashboard={true} />
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── Discover section ─────────────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className={`text-sm font-semibold uppercase tracking-wider ${textMuted}`}>
              {user ? "Discover" : "All Clubs"}
            </h2>
            <button
              onClick={() => setShowFilters((v) => !v)}
              className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-xl transition-colors ${
                showFilters
                  ? isDark ? "bg-[#4CAF50]/15 text-[#4CAF50]" : "bg-[#3D6B47]/10 text-[#3D6B47]"
                  : isDark ? "text-white/50 hover:text-white bg-white/5" : "text-gray-400 hover:text-gray-700 bg-gray-100"
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              Filter
            </button>
          </div>

          {/* Search bar */}
          <div className="relative mb-3">
            <Search className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${textMuted}`} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search clubs by name or location…"
              className={`w-full pl-10 pr-4 py-3 rounded-2xl border text-sm outline-none transition-colors focus:border-[#4CAF50] ${inputBg}`}
            />
          </div>

          {/* Category filter pills */}
          {showFilters && (
            <div className="flex gap-2 flex-wrap mb-4">
              {ALL_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                    categoryFilter === cat
                      ? isDark ? "bg-[#4CAF50]/15 text-[#4CAF50]" : "bg-[#3D6B47]/10 text-[#3D6B47]"
                      : isDark ? "bg-white/6 text-white/50 hover:text-white" : "bg-gray-100 text-gray-500 hover:text-gray-800"
                  }`}
                >
                  {cat !== "all" && CATEGORY_ICONS[cat]}
                  {cat === "all" ? "All" : CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>
          )}

          {/* Results grid */}
          {discoverClubs.length === 0 ? (
            <div className={`rounded-3xl border ${cardBorder} ${card} py-12 text-center`}>
              <Search className={`w-10 h-10 mx-auto mb-3 ${textMuted}`} />
              <p className={`text-sm font-semibold ${textMain}`}>No clubs found</p>
              <p className={`text-xs mt-1 ${textMuted}`}>Try a different search or filter</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {discoverClubs.map((club) => (
                <ClubCard key={club.id} club={club} isDark={isDark} />
              ))}
            </div>
          )}
        </section>

        {/* ── Create club CTA ──────────────────────────────────────────────── */}
        <section>
          <div
            className="rounded-3xl border border-dashed p-8 text-center cursor-pointer transition-all hover:border-[#4CAF50]/50 group"
            style={{ borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)" }}
            onClick={() => user ? setShowWizard(true) : navigate("/")}
          >
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 transition-colors ${
              isDark ? "bg-white/5 group-hover:bg-[#4CAF50]/10" : "bg-gray-50 group-hover:bg-[#3D6B47]/8"
            }`}>
              <Plus className={`w-7 h-7 transition-colors ${isDark ? "text-white/30 group-hover:text-[#4CAF50]" : "text-gray-300 group-hover:text-[#3D6B47]"}`} />
            </div>
            <h3
              className={`text-base font-bold mb-1 transition-colors ${isDark ? "text-white/60 group-hover:text-white" : "text-gray-400 group-hover:text-gray-900"}`}
              style={{ fontFamily: "'Clash Display', sans-serif" }}
            >
              Start a New Club
            </h3>
            <p className={`text-xs ${textMuted}`}>
              Create a club for your chess community, school team, or local group
            </p>
          </div>
        </section>

          </>
        )}

      </div>

      {/* Create Club Wizard */}
      {showWizard && (
        <CreateClubWizard onClose={() => setShowWizard(false)} />
      )}
    </div>
  );
}
