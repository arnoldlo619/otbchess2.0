/**
 * MyClubs page — /clubs
 *
 * Phase 5 redesign: single canonical search/filter experience.
 *
 * For signed-in users:
 *   - Tabs: My Clubs | Events | Discover
 *   - "My Clubs" section: clubs the user has joined
 *   - "Discover" section: all public clubs with unified search/filters
 *
 * For guests:
 *   - Full discovery grid with unified search/filters
 */
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
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
  apiListPublicClubs,
  apiListMyClubs,
  migrateLocalClubsToServer,
  apiListClubLocations,
} from "@/lib/clubsApi";
import {
  listClubEvents,
  seedClubEventsIfEmpty,
  getUserRSVP,
  upsertRSVP,
  countRSVPs as _countRSVPs,
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
  Crown,
  Zap,
  Globe,
  BookOpen,
  GraduationCap,
  Building2,
  Bell,
  BellOff,
  UserPlus,
  CalendarDays,
  CheckCircle2,
  Circle,
  MinusCircle,
  PlusCircle,
  SlidersHorizontal,
  X,
  BadgeCheck,
  ArrowUpDown,
} from "lucide-react";
import { toast } from "sonner";
import { CREATE_CLUB_WIZARD_ACTIVE_KEY, CreateClubWizard } from "@/components/CreateClubWizard";
import { CreateClubAuthGate } from "@/components/CreateClubAuthGate";
import { AvatarNavDropdown } from "@/components/AvatarNavDropdown";
import { useAccessibleOverlay } from "@/hooks/useAccessibleOverlay";

// ── Constants ─────────────────────────────────────────────────────────────────

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

type SortOption = "members" | "newest" | "tournaments" | "az";

const SORT_LABELS: Record<SortOption, string> = {
  members: "Most Members",
  newest: "Newest",
  tournaments: "Most Active",
  az: "A → Z",
};

// ── Club Card ─────────────────────────────────────────────────────────────────

function ClubCard({
  club,
  isDark,
  toDashboard = false,
  isOwned = false,
  priority = false,
}: {
  club: Club;
  isDark: boolean;
  toDashboard?: boolean;
  isOwned?: boolean;
  priority?: boolean;
}) {
  const [, navigate] = useLocation();
  const flag = COUNTRY_FLAGS[club.country] ?? "🌍";
  const textMain = isDark ? "text-white" : "text-gray-900";
  const textMuted = isDark ? "text-white/50" : "text-gray-500";
  const initial = club.name.charAt(0).toUpperCase();

  return (
    <div className="relative group club-card-hover rounded-2xl">
      <Link href={toDashboard ? `/clubs/${club.id}/home` : `/clubs/${club.id}`}>
        <div className="cursor-pointer">
          {/* Image area — 4:5 aspect ratio */}
          <div
            className="relative w-full aspect-[4/5] rounded-2xl overflow-hidden"
            style={{
              background: club.bannerUrl
                ? undefined
                : `linear-gradient(145deg, ${club.accentColor}dd 0%, ${club.accentColor}55 60%, ${isDark ? '#0d1a0f' : '#1a2e1d'}ee 100%)`,
            }}
          >
            {club.bannerUrl ? (
              <img
                decoding="async"
                src={club.bannerUrl}
                alt=""
                role="presentation"
                loading={priority ? "eager" : "lazy"}
                fetchPriority={priority ? "high" : "auto"}
                width={720}
                height={900}
                className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.06]"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
              />
            ) : (
              <>
                <div className="absolute inset-0 chess-board-bg opacity-12" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-white/15 text-7xl font-black">{initial}</span>
                </div>
              </>
            )}

            {/* Gradient scrim */}
            <div
              className="absolute inset-0 transition-opacity duration-300"
              style={{ background: "linear-gradient(to top, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.2) 35%, transparent 60%)" }}
            />
            {/* Hover tint */}
            <div className="absolute inset-0 bg-[#4CAF50]/0 group-hover:bg-[#4CAF50]/5 transition-colors duration-300" />

            {/* Top-left badges */}
            <div className="absolute top-3 left-3 flex flex-col gap-1.5">
              {isOwned && (
                <div className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-white/95 text-black shadow-lg backdrop-blur-sm">
                  <Crown className="w-3 h-3 text-amber-500" />
                  Owner
                </div>
              )}
              {club.isVerified && !isOwned && (
                <div className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-white/95 text-black shadow-lg backdrop-blur-sm">
                  <BadgeCheck className="w-3 h-3 text-blue-500" />
                  Verified
                </div>
              )}
            </div>

            {/* Bottom overlay — category only */}
            <div className="absolute bottom-0 left-0 right-0 p-3 flex items-end justify-end">
              <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-semibold bg-black/50 text-white backdrop-blur-md border border-white/10">
                {CATEGORY_ICONS[club.category]}
                {CATEGORY_LABELS[club.category]}
              </div>
            </div>
          </div>

          {/* Title below image */}
          <h3 className={`mt-3 text-sm font-bold leading-tight truncate ${textMain}`}>
            {club.name}
          </h3>

          {/* Location row */}
          <div className="flex items-center gap-2 mt-1.5">
            <div
              className="w-5 h-5 rounded-full flex-shrink-0 overflow-hidden flex items-center justify-center text-[9px] font-bold text-white"
              style={{ background: club.accentColor }}
            >
              {club.avatarUrl ? (
                <img loading="lazy" decoding="async" src={club.avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <span>{flag}</span>
              )}
            </div>
            <span className={`text-xs truncate ${textMuted}`}>
              {club.location || club.tagline || "Chess community"}
            </span>
          </div>
        </div>
      </Link>

      {/* Owner action buttons */}
      {isOwned && (
        <div className="mt-3 flex gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); navigate(`/clubs/${club.id}?settings=1`); }}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${
              isDark
                ? "bg-white/8 text-white/60 hover:bg-white/12 hover:text-white/80"
                : "bg-black/5 text-gray-600 hover:bg-black/10 hover:text-gray-800"
            }`}
          >
            <Crown className="w-3.5 h-3.5" />
            Manage
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); navigate(`/clubs/${club.id}?create=1`); }}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${
              isDark
                ? "bg-white/8 text-white/60 hover:bg-white/12 hover:text-white/80"
                : "bg-black/5 text-gray-600 hover:bg-black/10 hover:text-gray-800"
            }`}
          >
            <PlusCircle className="w-3.5 h-3.5" />
            New Event
          </button>
        </div>
      )}
    </div>
  );
}

// ── Followed Club Card ────────────────────────────────────────────────────────

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
  const cardBorder = isDark ? "border-white/8" : "border-[#ADBC9F]/70";
  const textMain = isDark ? "text-white" : "text-[#12372A]";
  const textMuted = isDark ? "text-white/70" : "text-[#436850]";

  return (
    <div className={`rounded-2xl border ${cardBorder} ${card} overflow-hidden`}>
      <Link href={`/clubs/${club.id}`}>
        <div
          className="h-24 relative overflow-hidden cursor-pointer"
          style={{
            background: club.bannerUrl
              ? undefined
              : `linear-gradient(135deg, ${club.accentColor}dd 0%, ${club.accentColor}55 100%)`,
          }}
        >
          {club.bannerUrl ? (
            <img decoding="async" src={club.bannerUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <div className="absolute inset-0 chess-board-bg opacity-15" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
        </div>
      </Link>

      <div className="px-4 relative z-10">
        <div
          className="-mt-6 w-12 h-12 rounded-xl flex items-center justify-center text-lg shadow-lg border-2 border-white/30 overflow-hidden"
          style={{ background: `linear-gradient(135deg, ${club.accentColor} 0%, ${club.accentColor}88 100%)` }}
        >
          {club.avatarUrl ? (
            <img loading="lazy" decoding="async" src={club.avatarUrl} alt={club.name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-white font-bold">{flag}</span>
          )}
        </div>
      </div>

      <div className="px-4 pt-2 pb-4">
        <Link href={`/clubs/${club.id}`}>
          <h3 className={`text-sm font-bold leading-tight truncate cursor-pointer hover:underline ${textMain}`}
            style={{ fontFamily: "'Clash Display', sans-serif" }}>
            {club.name}
          </h3>
        </Link>
        <p className={`text-xs mt-1 line-clamp-1 ${textMuted}`}>{club.tagline || club.location}</p>

        <div className={`flex items-center gap-3 mt-2.5 pt-2.5 border-t ${isDark ? "border-white/6" : "border-[#ADBC9F]/50"}`}>
          <span className={`flex items-center gap-1 text-xs ${textMuted}`}>
            <Users className="w-3 h-3" />
            {club.memberCount.toLocaleString()}
          </span>
          <span className={`flex items-center gap-1 text-xs ${textMuted}`}>
            <Trophy className="w-3 h-3" />
            {club.tournamentCount}
          </span>
        </div>

        <div className="flex gap-2 mt-3">
          <button
            onClick={onJoin}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold bg-[#436850] text-white hover:bg-[#3a5230] transition-colors active:scale-95"
          >
            <UserPlus className="w-3.5 h-3.5" />
            Join
          </button>
          <button
            onClick={onUnfollow}
            className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-colors active:scale-95 ${
              isDark
                ? "border-white/10 text-white/50 hover:text-red-400 hover:border-red-400/30 bg-white/4"
                : "border-[#ADBC9F] text-[#436850] hover:text-red-500 hover:border-red-200 bg-white"
            }`}
          >
            <BellOff className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Upcoming Events Tab ───────────────────────────────────────────────────────

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
  { status: "going", label: "Going", icon: <CheckCircle2 className="w-3.5 h-3.5" />, activeClass: "bg-[#436850] text-white" },
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
      <div className={`rounded-2xl border ${cardBorder} ${card} py-16 text-center`}>
        <CalendarDays className={`w-12 h-12 mx-auto mb-3 ${textMuted}`} />
        <p className={`text-base font-semibold ${textMain}`}>No upcoming events</p>
        <p className={`text-sm mt-1 ${textMuted}`}>Events from your clubs will appear here</p>
      </div>
    );
  }

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
            <div className={`flex-1 h-px ${isDark ? "bg-white/8" : "bg-[#ADBC9F]/40"}`} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
              <img loading="lazy" decoding="async" src={r.avatarUrl} alt={r.displayName} className="w-full h-full object-cover" />
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
  card: _card,
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
    <div
      className={`group rounded-2xl border ${cardBorder} overflow-hidden transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 cursor-pointer flex flex-col ${
        isDark ? "bg-[#1a2e1d]" : "bg-white"
      }`}
    >
      <div
        className="relative h-44 overflow-hidden"
        style={{
          background: event.coverImageUrl
            ? undefined
            : `linear-gradient(145deg, ${event.clubAccent}dd 0%, ${event.clubAccent}44 60%, ${isDark ? '#0d1a0f' : '#1a2e1d'}ee 100%)`,
        }}
      >
        {event.coverImageUrl ? (
          <img
            decoding="async"
            src={event.coverImageUrl}
            alt=""
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <>
            <div className="absolute inset-0 chess-board-bg opacity-10" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Trophy className="w-14 h-14 text-white/15" />
            </div>
          </>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
        <div className="absolute top-3 left-3 px-3 py-1.5 rounded-full text-xs font-bold text-white backdrop-blur-md bg-black/50">
          {weekday} at {time}
        </div>
      </div>

      <div className="flex flex-col flex-1 p-4">
        <h3 className={`text-sm font-bold leading-snug line-clamp-2 ${textMain}`}>
          {event.title}
        </h3>
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          {event.venue && (
            <span className={`flex items-center gap-1 text-xs ${textMuted}`}>
              <MapPin className="w-3 h-3" />
              <span className="truncate max-w-[140px]">{event.venue}</span>
            </span>
          )}
          <span className={`flex items-center gap-1 text-xs ${textMuted}`}>
            <CalendarDays className="w-3 h-3" />{month} {day}
          </span>
        </div>

        <div className="flex items-center gap-2 mt-3 pt-3 border-t" style={{ borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(173,188,159,0.5)' }}>
          <Link href={`/clubs/${event.clubId}/home`} className="flex items-center gap-2 min-w-0">
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
              style={{ background: event.clubAccent }}
            >
              {event.clubName.slice(0, 1).toUpperCase()}
            </div>
            <span className={`text-xs font-medium truncate ${isDark ? 'text-white/60' : 'text-[#436850]'}`}>
              {event.clubName}
            </span>
          </Link>
          <RsvpAvatarStack rsvps={rsvps} accentColor={event.clubAccent} isDark={isDark} max={4} />
        </div>

        <div className="flex items-center gap-1.5 mt-3">
          {RSVP_OPTIONS.map((opt) => (
            <button
              key={opt.status}
              onClick={() => handleRSVP(opt.status)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all active:scale-95 ${
                rsvp?.status === opt.status
                  ? `${opt.activeClass} border-transparent`
                  : isDark
                  ? "border-white/8 text-white/40 hover:text-white hover:border-white/20 bg-white/3"
                  : "border-[#ADBC9F] text-[#436850] hover:text-[#12372A] hover:border-[#ADBC9F] bg-white"
              }`}
            >
              {opt.icon}
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Mobile Filter Drawer ──────────────────────────────────────────────────────

function MobileFilterDrawer({
  open,
  onClose,
  isDark,
  categoryFilter,
  setCategoryFilter,
  locationFilter,
  setLocationFilter,
  cityFilter,
  setCityFilter,
  sortBy,
  setSortBy,
  locationTree,
}: {
  open: boolean;
  onClose: () => void;
  isDark: boolean;
  categoryFilter: ClubCategory | "all";
  setCategoryFilter: (v: ClubCategory | "all") => void;
  locationFilter: string;
  setLocationFilter: (v: string) => void;
  cityFilter: string;
  setCityFilter: (v: string) => void;
  sortBy: SortOption;
  setSortBy: (v: SortOption) => void;
  locationTree: Array<{ code: string; name: string; cities: string[] }>;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  useAccessibleOverlay({
    open,
    onClose,
    containerRef: dialogRef,
    initialFocusRef: closeButtonRef,
  });
  if (!open) return null;

  const textMain = isDark ? "text-white" : "text-[#12372A]";
  const textMuted = isDark ? "text-white/60" : "text-[#436850]";
  const selectCls = isDark
    ? "bg-white/8 border-white/12 text-white"
    : "bg-white border-[#ADBC9F] text-[#12372A]";

  const selectedLoc = locationTree.find((l) => l.code === locationFilter);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close club filters"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Drawer */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="club-filter-drawer-title"
        tabIndex={-1}
        className={`relative z-10 w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl p-6 pb-8 max-h-[80vh] overflow-y-auto ${
          isDark ? "bg-[#1a2e1d]" : "bg-white"
        }`}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 id="club-filter-drawer-title" className={`text-lg font-bold ${textMain}`} style={{ fontFamily: "'Clash Display', sans-serif" }}>
            Filters
          </h2>
          <button ref={closeButtonRef} onClick={onClose} aria-label="Close club filters" className={`w-8 h-8 rounded-full flex items-center justify-center ${isDark ? "bg-white/8 text-white/60" : "bg-gray-100 text-gray-500"}`}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Category */}
        <div className="mb-5">
          <label className={`text-xs font-semibold uppercase tracking-wider mb-2 block ${textMuted}`}>Category</label>
          <div className="flex flex-wrap gap-2">
            {ALL_CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                  categoryFilter === cat
                    ? isDark
                      ? "bg-[#4CAF50]/20 text-[#4CAF50] border-[#4CAF50]/40"
                      : "bg-[#436850]/12 text-[#436850] border-[#436850]/30"
                    : isDark
                      ? "bg-white/5 text-white/50 border-white/8"
                      : "bg-gray-50 text-gray-600 border-gray-200"
                }`}
              >
                {cat !== "all" && CATEGORY_ICONS[cat]}
                {cat === "all" ? "All" : CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>
        </div>

        {/* Location */}
        <div className="mb-5">
          <label className={`text-xs font-semibold uppercase tracking-wider mb-2 block ${textMuted}`}>Location</label>
          <select
            aria-label="Location"
            value={locationFilter}
            onChange={(e) => { setLocationFilter(e.target.value); setCityFilter("all"); }}
            className={`w-full px-3 py-2.5 rounded-xl border text-sm outline-none ${selectCls}`}
          >
            <option value="all">All Countries</option>
            {locationTree.map((loc) => (
              <option key={loc.code} value={loc.code}>
                {COUNTRY_FLAGS[loc.code] ?? ""} {loc.name}
              </option>
            ))}
          </select>
          {selectedLoc && selectedLoc.cities.length > 0 && (
            <select
              aria-label="City"
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className={`w-full px-3 py-2.5 rounded-xl border text-sm outline-none mt-2 ${selectCls}`}
            >
              <option value="all">All Cities</option>
              {selectedLoc.cities.map((city) => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
          )}
        </div>

        {/* Sort */}
        <div className="mb-6">
          <label className={`text-xs font-semibold uppercase tracking-wider mb-2 block ${textMuted}`}>Sort By</label>
          <select
            aria-label="Sort By"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className={`w-full px-3 py-2.5 rounded-xl border text-sm outline-none ${selectCls}`}
          >
            {(Object.keys(SORT_LABELS) as SortOption[]).map((s) => (
              <option key={s} value={s}>{SORT_LABELS[s]}</option>
            ))}
          </select>
        </div>

        {/* Apply */}
        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl text-sm font-semibold bg-[#436850] text-white hover:bg-[#3a5230] transition-colors"
        >
          Apply Filters
        </button>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function MyClubs() {
  useLocation();
  const { user } = useAuthContext();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [activeTab, setActiveTab] = useState<"clubs" | "events" | "discover">(
    user ? "clubs" : "discover"
  );
  const [allClubs, setAllClubs] = useState<Club[]>([]);
  const [myClubs, setMyClubs] = useState<Club[]>([]);
  const [followedClubs, setFollowedClubs] = useState<Club[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<EnrichedEvent[]>([]);

  // Search & filter state — URL-synced
  const [search, setSearch] = useState(() => new URLSearchParams(window.location.search).get("q") ?? "");
  const [categoryFilter, setCategoryFilter] = useState<ClubCategory | "all">(() => (new URLSearchParams(window.location.search).get("cat") as ClubCategory | "all") ?? "all");
  const [sortBy, setSortBy] = useState<SortOption>(() => (new URLSearchParams(window.location.search).get("sort") as SortOption) ?? "members");
  const [locationFilter, setLocationFilter] = useState<string>(() => new URLSearchParams(window.location.search).get("country") ?? "all");
  const [cityFilter, setCityFilter] = useState<string>(() => new URLSearchParams(window.location.search).get("city") ?? "all");

  const [discoverClubs, setDiscoverClubs] = useState<Club[]>([]);
  const [discoverLoading, setDiscoverLoading] = useState(true);
  const [initialClubsLoading, setInitialClubsLoading] = useState(true);
  const [discoverTotal, setDiscoverTotal] = useState(0);
  const [discoverError, setDiscoverError] = useState(false);
  const [showWizard, setShowWizard] = useState(() =>
    typeof window !== "undefined" && window.sessionStorage.getItem(CREATE_CLUB_WIZARD_ACTIVE_KEY) === "1"
  );
  const [showAuthGate, setShowAuthGate] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [rsvpRefresh, setRsvpRefresh] = useState(0);
  const [locationTree, setLocationTree] = useState<Array<{ code: string; name: string; cities: string[] }>>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openCreateClubWizard = useCallback(() => {
    try { window.sessionStorage.setItem(CREATE_CLUB_WIZARD_ACTIVE_KEY, "1"); } catch { /* storage may be unavailable */ }
    setShowWizard(true);
  }, []);
  const closeCreateClubWizard = useCallback(() => {
    try { window.sessionStorage.removeItem(CREATE_CLUB_WIZARD_ACTIVE_KEY); } catch { /* storage may be unavailable */ }
    setShowWizard(false);
  }, []);

  // Active filter count for mobile badge
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (categoryFilter !== "all") count++;
    if (locationFilter !== "all") count++;
    if (cityFilter !== "all") count++;
    if (sortBy !== "members") count++;
    return count;
  }, [categoryFilter, locationFilter, cityFilter, sortBy]);

  // Fetch location tree
  useEffect(() => {
    apiListClubLocations().then(({ locations }) => setLocationTree(locations));
  }, []);

  // SEO
  useEffect(() => {
    document.title = "Chess Clubs — Join a Local OTB Chess Club | ChessOTB.club";
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute("content", "Discover and join over-the-board chess clubs near you. Connect with local players, attend club events, and grow your chess community.");
    return () => { document.title = "ChessOTB.club — Chess Tournaments Over The Board"; };
  }, []);

  // ── Server-side discover fetch (debounced) ──────────────────────────────────
  const fetchDiscover = useCallback(async (
    q: string,
    cat: ClubCategory | "all",
    joinedIds: Set<string>,
    sort: SortOption = "members",
    countryCode: string = "all",
    cityName: string = "all",
  ) => {
    setDiscoverLoading(true);
    setDiscoverError(false);
    try {
      const { clubs: results, total } = await apiListPublicClubs({
        search: q.trim() || undefined,
        category: cat !== "all" ? cat : undefined,
        sort,
        country: countryCode !== "all" ? countryCode : undefined,
        city: cityName !== "all" ? cityName : undefined,
      });
      const filtered = results.filter((c: Club) => !joinedIds.has(c.id));
      setDiscoverClubs(filtered);
      setDiscoverTotal(total);
    } catch {
      setDiscoverError(true);
      setDiscoverClubs(
        allClubs.filter((c) => {
          if (joinedIds.has(c.id)) return false;
          if (cat !== "all" && c.category !== cat) return false;
          if (countryCode !== "all" && c.country !== countryCode) return false;
          if (q.trim()) {
            const lq = q.toLowerCase();
            return c.name.toLowerCase().includes(lq) || c.location.toLowerCase().includes(lq) || c.tagline.toLowerCase().includes(lq);
          }
          return true;
        })
      );
    } finally {
      setDiscoverLoading(false);
    }
  }, [allClubs]);

  // Debounced search + filter → server fetch + URL sync
  useEffect(() => {
    const joinedIds = new Set(myClubs.map((c) => c.id));
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const delay = search !== "" ? 350 : 0;
    // Sync URL params
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (categoryFilter !== "all") params.set("cat", categoryFilter);
    if (sortBy !== "members") params.set("sort", sortBy);
    if (locationFilter !== "all") params.set("country", locationFilter);
    if (cityFilter !== "all") params.set("city", cityFilter);
    const newUrl = params.toString() ? `${window.location.pathname}?${params.toString()}` : window.location.pathname;
    window.history.replaceState({}, "", newUrl);
    debounceRef.current = setTimeout(() => {
      fetchDiscover(search, categoryFilter, joinedIds, sortBy, locationFilter, cityFilter);
    }, delay);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search, categoryFilter, sortBy, locationFilter, cityFilter, myClubs, fetchDiscover]);

  // ── Refresh clubs data ──────────────────────────────────────────────────────
  const refreshClubs = useCallback(async () => {
    try {
      seedClubsIfEmpty();
      seedClubEventsIfEmpty();
      if (user) migrateLocalClubsToServer(user.id).catch(() => {});

      const { clubs: serverClubs } = await apiListPublicClubs();
      const localClubs = listAllClubs();
      const serverIds = new Set(serverClubs.map((c: Club) => c.id));
      const localOnly = localClubs.filter((c) => !serverIds.has(c.id));
      const all = [...serverClubs, ...localOnly];
      setAllClubs(all);

      if (user) {
        let joined: Club[] = [];
        try {
          joined = await apiListMyClubs();
          joined.forEach((c) => {
            if (!listMyClubs(user.id).find((lc) => lc.id === c.id)) {
              joinClub(c.id, { userId: user.id, displayName: user.displayName ?? "" });
            }
          });
        } catch {
          joined = listMyClubs(user.id);
        }
        setMyClubs(joined);
        const joinedIds = new Set(joined.map((c) => c.id));
        const followed = all.filter((c) => !joinedIds.has(c.id) && isFollowing(c.id, user.id));
        setFollowedClubs(followed);

        // Aggregate upcoming events
        const relevantClubIds = [...joined.map((c) => c.id), ...followed.map((c) => c.id)];
        const uniqueClubIds = Array.from(new Set(relevantClubIds));
        const clubMap = new Map(all.map((c) => [c.id, c]));
        const now = new Date().toISOString();
        const events: EnrichedEvent[] = [];
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
    } finally {
      setInitialClubsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refreshClubs();
  }, [user, showWizard, rsvpRefresh, refreshClubs]);

  // ── Colour palette ──────────────────────────────────────────────────────────
  const bg = isDark ? "bg-[#0d1a0f]" : "bg-[#F5F5EE]";
  const card = isDark ? "bg-[#1a2e1d]" : "bg-white";
  const cardBorder = isDark ? "border-white/8" : "border-[#ADBC9F]/70";
  const textMain = isDark ? "text-white" : "text-[#12372A]";
  const textMuted = isDark ? "text-white/70" : "text-[#436850]";
  const inputBg = isDark ? "bg-white/6 border-white/10 text-white placeholder:text-white/30" : "bg-white border-[#ADBC9F] text-[#12372A] placeholder:text-[#436850]/60";

  // Featured clubs — top 4 verified or highest member count
  const featuredClubs = useMemo(() => {
    return [...allClubs]
      .sort((a, b) => {
        if (a.isVerified && !b.isVerified) return -1;
        if (!a.isVerified && b.isVerified) return 1;
        return b.memberCount - a.memberCount;
      })
      .slice(0, 4);
  }, [allClubs]);

  return (
    <div className={`min-h-screen ${bg}`}>

      {/* ── Page Header ──────────────────────────────────────────────── */}
      <header className={`sticky top-0 z-40 backdrop-blur-xl border-b ${isDark ? "bg-[#0d1a0f]/90 border-white/8" : "bg-[#F5F5EE]/90 border-[#ADBC9F]/30"}`}>
        <div className="max-w-6xl mx-auto px-4 flex items-center h-14 gap-3">
          <NavLogo className="h-7" />
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => user ? openCreateClubWizard() : setShowAuthGate(true)}
              aria-label="Create Club"
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold transition-colors ${
                isDark
                  ? "bg-white/10 text-white hover:bg-white/15 border border-white/10"
                  : "bg-[#436850] text-white hover:bg-[#3a5230]"
              }`}
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Create Club</span>
            </button>
            <AvatarNavDropdown currentPage="Clubs" />
          </div>
        </div>
      </header>

      {/* ── Hero Section ─────────────────────────────────────────────── */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0">
          <div
            className="absolute inset-0"
            style={{
              background: isDark
                ? "linear-gradient(180deg, #0d2b12 0%, #0d1a0f 100%)"
                : "linear-gradient(180deg, #1a4a22 0%, #F5F5EE 100%)",
            }}
          />
          <div className="absolute inset-0 chess-board-bg" style={{ opacity: isDark ? 0.06 : 0.04 }} />
        </div>

        <div className="relative max-w-6xl mx-auto px-4 pt-10 pb-8 sm:pt-14 sm:pb-10">
          <h1
            className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white leading-tight"
            style={{ fontFamily: "'Clash Display', sans-serif" }}
          >
            {user ? `Welcome back, ${user.displayName?.split(' ')[0] || 'Player'}` : "Discover Chess Clubs"}
          </h1>
          <p className="text-sm sm:text-base mt-2 text-white/60 max-w-lg">
            {user ? "Your chess communities and upcoming events" : "Find your local OTB chess community"}
          </p>

          {/* Tabs — signed-in users */}
          {user && (
            <div className="flex gap-1.5 mt-6">
              {([
                { key: "clubs" as const, label: "My Clubs", icon: <Users className="w-4 h-4" />, count: myClubs.length },
                { key: "events" as const, label: "Events", icon: <CalendarDays className="w-4 h-4" />, count: upcomingEvents.length },
                { key: "discover" as const, label: "Discover", icon: <Search className="w-4 h-4" />, count: 0 },
              ]).map(({ key, label, icon, count }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`flex items-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-semibold transition-all border ${
                    activeTab === key
                      ? "bg-white/15 text-white border-white/20 shadow-sm backdrop-blur-sm"
                      : "bg-transparent text-white/50 border-white/8 hover:text-white hover:border-white/15"
                  }`}
                >
                  {icon}
                  <span className="hidden sm:inline">{label}</span>
                  {count > 0 && (
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                      activeTab === key ? "bg-white/20 text-white" : "bg-white/8 text-white/40"
                    }`}>{count}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Search & Filter Bar ──────────────────────────────────────── */}
      {(activeTab === "discover" || !user) && (
        <div className={`sticky top-14 z-30 border-b ${isDark ? "bg-[#0d1a0f]/95 border-white/6" : "bg-[#F5F5EE]/95 border-[#ADBC9F]/20"} backdrop-blur-lg`}>
          <div className="max-w-6xl mx-auto px-4 py-3">
            {/* Search row */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${textMuted}`} />
                <input
                  aria-label="Search by name, location, or category"
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name, location, or category..."
                  className={`w-full pl-10 pr-9 py-2.5 rounded-xl border text-sm outline-none transition-colors focus:border-[#4CAF50] ${inputBg}`}
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className={`absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center transition-colors ${
                      isDark ? "text-white/40 hover:text-white/80 bg-white/10" : "text-[#436850] hover:text-[#12372A] bg-[#ADBC9F]/40"
                    }`}
                    aria-label="Clear search"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Mobile filter button */}
              <button
                onClick={() => setShowMobileFilters(true)}
                className={`sm:hidden flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors relative ${
                  isDark ? "bg-white/6 border-white/10 text-white/70" : "bg-white border-[#ADBC9F] text-[#436850]"
                }`}
                aria-label="Open filters"
              >
                <SlidersHorizontal className="w-4 h-4" />
                {activeFilterCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#436850] text-white text-[10px] font-bold flex items-center justify-center">
                    {activeFilterCount}
                  </span>
                )}
              </button>

              {/* Desktop sort */}
              <div className="hidden sm:flex items-center gap-2">
                <div className="relative">
                  <ArrowUpDown className={`absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none ${textMuted}`} />
                  <select
                    aria-label="Sort clubs"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortOption)}
                    className={`pl-8 pr-6 py-2.5 rounded-xl border text-xs font-medium outline-none cursor-pointer appearance-none ${
                      isDark ? "bg-white/6 border-white/10 text-white/70" : "bg-white border-[#ADBC9F] text-[#436850]"
                    }`}
                  >
                    {(Object.keys(SORT_LABELS) as SortOption[]).map((s) => (
                      <option key={s} value={s}>{SORT_LABELS[s]}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Desktop filter row */}
            <div className="hidden sm:flex items-center gap-2 mt-2.5 flex-wrap">
              {/* Category chips */}
              {ALL_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    categoryFilter === cat
                      ? isDark
                        ? "bg-[#4CAF50]/20 text-[#4CAF50] border border-[#4CAF50]/40"
                        : "bg-[#436850]/12 text-[#436850] border border-[#436850]/30"
                      : isDark
                        ? "bg-white/5 text-white/50 hover:text-white hover:bg-white/8 border border-white/8"
                        : "bg-white text-[#436850] hover:text-[#12372A] hover:bg-[#ADBC9F]/20 border border-[#ADBC9F]/50"
                  }`}
                >
                  {cat !== "all" && CATEGORY_ICONS[cat]}
                  {cat === "all" ? "All" : CATEGORY_LABELS[cat]}
                </button>
              ))}

              {/* Location filter */}
              {locationTree.length > 0 && (
                <>
                  <div className={`w-px h-5 ${isDark ? "bg-white/10" : "bg-[#ADBC9F]/50"}`} />
                  <div className="relative">
                    <MapPin className={`absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none ${textMuted}`} />
                    <select
                      aria-label="Filter clubs by country"
                      value={locationFilter}
                      onChange={(e) => { setLocationFilter(e.target.value); setCityFilter("all"); }}
                      className={`pl-7 pr-6 py-1.5 rounded-full border text-xs font-medium outline-none cursor-pointer appearance-none ${
                        locationFilter !== "all"
                          ? isDark
                            ? "bg-[#4CAF50]/15 border-[#4CAF50]/40 text-[#4CAF50]"
                            : "bg-[#436850]/10 border-[#436850]/30 text-[#436850]"
                          : isDark
                            ? "bg-white/5 border-white/8 text-white/50"
                            : "bg-white border-[#ADBC9F]/50 text-[#436850]"
                      }`}
                    >
                      <option value="all">All Countries</option>
                      {locationTree.map((loc) => (
                        <option key={loc.code} value={loc.code}>
                          {COUNTRY_FLAGS[loc.code] ?? ""} {loc.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {locationFilter !== "all" && (() => {
                    const loc = locationTree.find((l) => l.code === locationFilter);
                    return loc && loc.cities.length > 0 ? (
                      <select
                        aria-label="Filter clubs by city"
                        value={cityFilter}
                        onChange={(e) => setCityFilter(e.target.value)}
                        className={`px-3 py-1.5 rounded-full border text-xs font-medium outline-none cursor-pointer appearance-none ${
                          cityFilter !== "all"
                            ? isDark
                              ? "bg-[#4CAF50]/15 border-[#4CAF50]/40 text-[#4CAF50]"
                              : "bg-[#436850]/10 border-[#436850]/30 text-[#436850]"
                            : isDark
                              ? "bg-white/5 border-white/8 text-white/50"
                              : "bg-white border-[#ADBC9F]/50 text-[#436850]"
                        }`}
                      >
                        <option value="all">All Cities</option>
                        {loc.cities.map((city) => (
                          <option key={city} value={city}>{city}</option>
                        ))}
                      </select>
                    ) : null;
                  })()}
                </>
              )}

              {/* Clear all filters */}
              {activeFilterCount > 0 && (
                <button
                  onClick={() => { setCategoryFilter("all"); setLocationFilter("all"); setCityFilter("all"); setSortBy("members"); }}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    isDark ? "text-white/40 hover:text-white/70" : "text-[#436850]/60 hover:text-[#436850]"
                  }`}
                >
                  <X className="w-3 h-3" />
                  Clear all
                </button>
              )}
            </div>

            {/* Result count */}
            {!discoverLoading && (
              <p className={`text-xs mt-2.5 ${textMuted}`}>
                {discoverTotal === 0 && (search.trim() || categoryFilter !== "all" || locationFilter !== "all")
                  ? <span>No clubs found{search.trim() ? <> matching <strong className="font-semibold">"{search.trim()}"</strong></> : ""}</span>
                  : discoverTotal > 0
                    ? <>{discoverTotal} club{discoverTotal !== 1 ? "s" : ""}{search.trim() ? <> matching <strong className="font-semibold">"{search.trim()}"</strong></> : ""}</>
                    : null
                }
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Main Content ─────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-8">

        {/* ── Events Tab ──────────────────────────────────────────────── */}
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

        {/* ── My Clubs Tab ────────────────────────────────────────────── */}
        {user && activeTab === "clubs" && (
          <>
            {/* Following section */}
            {followedClubs.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <Bell className={`w-4 h-4 ${isDark ? "text-[#4CAF50]" : "text-[#436850]"}`} />
                  <h2 className={`text-sm font-semibold uppercase tracking-wider ${textMuted}`}>Following</h2>
                  <span className={`text-xs font-medium ml-auto ${textMuted}`}>{followedClubs.length}</span>
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

            {/* Joined Clubs */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className={`text-sm font-semibold uppercase tracking-wider ${textMuted}`}>Joined Clubs</h2>
                <span className={`text-xs font-medium ${textMuted}`}>{myClubs.length}</span>
              </div>

              {myClubs.length === 0 ? (
                <div className={`rounded-2xl border ${cardBorder} ${card} py-12 text-center`}>
                  <Users className={`w-10 h-10 mx-auto mb-3 ${textMuted}`} />
                  <p className={`text-sm font-semibold ${textMain}`}>No clubs yet</p>
                  <p className={`text-xs mt-1 mb-4 ${textMuted}`}>Browse the Discover tab to find your community</p>
                  <button
                    onClick={() => setActiveTab("discover")}
                    className="text-xs font-semibold px-4 py-2 rounded-xl bg-[#436850] text-white hover:bg-[#3a5230] transition-colors"
                  >
                    Discover Clubs
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                  {[...myClubs].sort((a, b) => {
                    const aOwned = !!user && a.ownerId === user.id ? 0 : 1;
                    const bOwned = !!user && b.ownerId === user.id ? 0 : 1;
                    return aOwned - bOwned;
                  }).map((club) => (
                    <ClubCard
                      key={club.id}
                      club={club}
                      isDark={isDark}
                      toDashboard={true}
                      isOwned={!!user && club.ownerId === user.id}
                    />
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {/* ── Discover Tab / Guest View ───────────────────────────────── */}
        {(activeTab === "discover" || !user) && (
          <>
            {/* Featured Clubs — editorial section (not carousel) */}
            {!search.trim() && categoryFilter === "all" && locationFilter === "all" && (initialClubsLoading || featuredClubs.length > 0) && (
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <Zap className={`w-4 h-4 ${isDark ? "text-amber-400" : "text-amber-600"}`} />
                  <h2 className={`text-sm font-semibold uppercase tracking-wider ${textMuted}`}>Featured</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                  {initialClubsLoading
                    ? Array.from({ length: 4 }).map((_, index) => (
                        <div key={index} aria-hidden="true" className="rounded-2xl overflow-hidden animate-pulse">
                          <div className={`aspect-[4/5] rounded-2xl ${isDark ? "bg-white/6" : "bg-[#ADBC9F]/20"}`} />
                          <div className={`mt-3 h-4 w-3/4 rounded-full ${isDark ? "bg-white/6" : "bg-[#ADBC9F]/20"}`} />
                          <div className={`mt-2 h-3 w-1/2 rounded-full ${isDark ? "bg-white/4" : "bg-[#ADBC9F]/10"}`} />
                        </div>
                      ))
                    : featuredClubs.map((club, index) => (
                        <ClubCard key={club.id} club={club} isDark={isDark} priority={index === 0} />
                      ))}
                </div>
              </section>
            )}

            {/* All Clubs grid */}
            <section>
              {discoverLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className={`rounded-2xl overflow-hidden animate-pulse`}>
                      <div className={`aspect-[4/5] rounded-2xl ${isDark ? "bg-white/6" : "bg-[#ADBC9F]/20"}`} />
                      <div className={`mt-3 h-4 w-3/4 rounded-full ${isDark ? "bg-white/6" : "bg-[#ADBC9F]/20"}`} />
                      <div className={`mt-2 h-3 w-1/2 rounded-full ${isDark ? "bg-white/4" : "bg-[#ADBC9F]/10"}`} />
                    </div>
                  ))}
                </div>
              ) : discoverError ? (
                <div className={`rounded-2xl border ${cardBorder} ${card} py-12 text-center`}>
                  <p className={`text-sm font-semibold ${textMain}`}>Couldn't load clubs</p>
                  <p className={`text-xs mt-1 mb-4 ${textMuted}`}>Check your connection and try again</p>
                  <button
                    onClick={() => fetchDiscover(search, categoryFilter, new Set(myClubs.map((c) => c.id)), sortBy, locationFilter, cityFilter)}
                    className="text-xs font-semibold px-4 py-2 rounded-xl bg-[#436850] text-white hover:bg-[#3a5230] transition-colors"
                  >
                    Retry
                  </button>
                </div>
              ) : discoverClubs.length === 0 ? (
                <div className={`rounded-2xl border ${cardBorder} ${card} py-12 text-center`}>
                  <Search className={`w-10 h-10 mx-auto mb-3 ${textMuted}`} />
                  <p className={`text-sm font-semibold ${textMain}`}>
                    {search.trim() || categoryFilter !== "all" || locationFilter !== "all" ? "No clubs match your filters" : "No clubs yet"}
                  </p>
                  <p className={`text-xs mt-1 ${textMuted}`}>
                    {search.trim() || categoryFilter !== "all" || locationFilter !== "all"
                      ? <button onClick={() => { setSearch(""); setCategoryFilter("all"); setLocationFilter("all"); setCityFilter("all"); }} className="underline">Clear all filters</button>
                      : "Be the first to create a club!"}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                  {discoverClubs.map((club, index) => (
                    <ClubCard
                      key={club.id}
                      club={club}
                      isDark={isDark}
                      priority={featuredClubs.length === 0 && index === 0}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* Create Club CTA */}
            <section>
              <button
                type="button"
                aria-label="Start a new club"
                className={`w-full rounded-2xl border border-dashed p-8 text-center cursor-pointer transition-all group bg-transparent ${
                  isDark ? "border-white/12 hover:border-[#4CAF50]/50" : "border-[#ADBC9F] hover:border-[#436850]/50"
                }`}
                onClick={() => user ? openCreateClubWizard() : setShowAuthGate(true)}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3 transition-colors ${
                  isDark ? "bg-white/5 group-hover:bg-[#4CAF50]/10" : "bg-[#ADBC9F]/20 group-hover:bg-[#436850]/8"
                }`}>
                  <Plus className={`w-6 h-6 transition-colors ${isDark ? "text-white/30 group-hover:text-[#4CAF50]" : "text-[#436850]/50 group-hover:text-[#436850]"}`} />
                </div>
                <h3
                  className={`text-base font-bold mb-1 transition-colors ${isDark ? "text-white/60 group-hover:text-white" : "text-[#436850] group-hover:text-[#12372A]"}`}
                  style={{ fontFamily: "'Clash Display', sans-serif" }}
                >
                  Start a New Club
                </h3>
                <p className={`text-xs ${textMuted}`}>
                  Create a club for your chess community, school team, or local group
                </p>
              </button>
            </section>
          </>
        )}
      </div>

      {/* Mobile Filter Drawer */}
      <MobileFilterDrawer
        open={showMobileFilters}
        onClose={() => setShowMobileFilters(false)}
        isDark={isDark}
        categoryFilter={categoryFilter}
        setCategoryFilter={setCategoryFilter}
        locationFilter={locationFilter}
        setLocationFilter={setLocationFilter}
        cityFilter={cityFilter}
        setCityFilter={setCityFilter}
        sortBy={sortBy}
        setSortBy={setSortBy}
        locationTree={locationTree}
      />

      {/* Create Club Wizard */}
      {showWizard && (
        <CreateClubWizard onClose={closeCreateClubWizard} />
      )}

      {/* Auth Gate */}
      {showAuthGate && (
        <CreateClubAuthGate
          onClose={() => setShowAuthGate(false)}
          onAuthenticated={() => { setShowAuthGate(false); openCreateClubWizard(); }}
          onPreview={() => { setShowAuthGate(false); openCreateClubWizard(); }}
        />
      )}
    </div>
  );
}
