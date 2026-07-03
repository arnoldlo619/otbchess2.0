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
import { useState, useEffect, useRef, useCallback } from "react";
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
} from "@/lib/clubsApi";
import { FeaturedClubsCarousel } from "@/components/FeaturedClubsCarousel";
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
  Clock,
  CheckCircle2,
  Circle,
  MinusCircle,
  ExternalLink as _ExternalLink,
  PlusCircle,
} from "lucide-react";
import { toast } from "sonner";
import { CreateClubWizard } from "@/components/CreateClubWizard";
import { CreateClubAuthGate } from "@/components/CreateClubAuthGate";
import { AvatarNavDropdown } from "@/components/AvatarNavDropdown";

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
  compact: _compact = false,
  toDashboard = false,
  isOwned = false,
}: {
  club: Club;
  isDark: boolean;
  compact?: boolean;
  toDashboard?: boolean;
  isOwned?: boolean;
}) {
  const [, navigate] = useLocation();
  const flag = COUNTRY_FLAGS[club.country] ?? "🌍";
  const textMain = isDark ? "text-white" : "text-gray-900";
  const textMuted = isDark ? "text-white/50" : "text-gray-500";
  const isTrending = /^seed-club-(7|8|9|10|11)$/.test(club.id);
  const initial = club.name.charAt(0).toUpperCase();

  return (
    <div className="relative group club-card-hover rounded-2xl">
    <Link href={toDashboard ? `/clubs/${club.id}/home` : `/clubs/${club.id}`}>
      <div className="cursor-pointer">
        {/* Image area — tall portrait, 4:5 aspect ratio, borderless */}
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
              src={club.bannerUrl}
              alt=""
              role="presentation"
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

          {/* Enhanced gradient scrim — stronger bottom fade */}
          <div
            className="absolute inset-0 transition-opacity duration-300"
            style={{ background: "linear-gradient(to top, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.2) 35%, transparent 60%)" }}
          />
          {/* Hover tint overlay */}
          <div className="absolute inset-0 bg-[#4CAF50]/0 group-hover:bg-[#4CAF50]/5 transition-colors duration-300" />

          {/* Owner badge — top-left */}
          {isOwned && (
            <div className="absolute top-3 left-3 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold bg-white/95 text-black shadow-lg backdrop-blur-sm">
              <Crown className="w-3 h-3 text-amber-500" />
              Owner
            </div>
          )}

          {/* Trending badge — top-left (if not owner) */}
          {!isOwned && isTrending && (
            <div className="absolute top-3 left-3 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold bg-white/95 text-black shadow-lg backdrop-blur-sm">
              <Zap className="w-3 h-3 text-orange-500" />
              Trending
            </div>
          )}

          {/* Three-dot menu — top-right */}
          <div className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center bg-white/90 shadow-sm opacity-0 group-hover:opacity-100 transition-all duration-200 scale-90 group-hover:scale-100">
            <span className="text-black text-sm font-bold leading-none">⋯</span>
          </div>

          {/* Bottom overlay — member count + category */}
          <div className="absolute bottom-0 left-0 right-0 p-3 flex items-end justify-between">
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-semibold bg-black/50 text-white backdrop-blur-md border border-white/10">
              <Users className="w-3 h-3" />
              {club.memberCount.toLocaleString()}
            </div>
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

        {/* Location / tagline row */}
        <div className="flex items-center gap-2 mt-1.5">
          <div
            className="w-5 h-5 rounded-full flex-shrink-0 overflow-hidden flex items-center justify-center text-[9px] font-bold text-white"
            style={{ background: club.accentColor }}
          >
            {club.avatarUrl ? (
              <img src={club.avatarUrl} alt="" className="w-full h-full object-cover" />
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
          New Tournament
        </button>
      </div>
    )}
    </div>
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
  const cardBorder = isDark ? "border-white/8" : "border-[#ADBC9F]/70";
  const textMain = isDark ? "text-white" : "text-[#12372A]";
  const textMuted = isDark ? "text-white/70" : "text-[#436850]";

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
        <div className={`flex items-center gap-4 mt-3 pt-3 border-t ${isDark ? "border-white/6" : "border-[#ADBC9F]/70"}`}>
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
      className={`group rounded-2xl border ${cardBorder} overflow-hidden transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5 cursor-pointer flex flex-col ${
        isDark ? "bg-[#1a2e1d]" : "bg-white"
      }`}
    >
      {/* Cover image area — tall, image-forward */}
      <div
        className="relative h-52 overflow-hidden"
        style={{
          background: event.coverImageUrl
            ? undefined
            : `linear-gradient(145deg, ${event.clubAccent}dd 0%, ${event.clubAccent}44 60%, ${isDark ? '#0d1a0f' : '#1a2e1d'}ee 100%)`,
        }}
      >
        {event.coverImageUrl ? (
          <img
            src={event.coverImageUrl}
            alt=""
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <>
            <div className="absolute inset-0 chess-board-bg opacity-10" />
            {/* Decorative chess icon */}
            <div className="absolute inset-0 flex items-center justify-center">
              <Trophy className="w-16 h-16 text-white/15" />
            </div>
          </>
        )}
        {/* Gradient scrim */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

        {/* Date badge — top-left overlay */}
        <div className="absolute top-3 left-3 px-3 py-1.5 rounded-full text-xs font-bold text-white backdrop-blur-md"
          style={{ background: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.55)' }}
        >
          {weekday} at {time}
        </div>

        {/* Three-dot menu placeholder — top-right */}
        <div className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ background: isDark ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.4)' }}
        >
          <span className="text-white text-sm font-bold">⋯</span>
        </div>
      </div>

      {/* Content area below image */}
      <div className="flex flex-col flex-1 p-4">
        {/* Title */}
        <h3 className={`text-base font-bold leading-snug line-clamp-2 ${textMain}`}>
          {event.title}
        </h3>

        {/* Meta row */}
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

        {/* Hosted by row */}
        <div className="flex items-center gap-2 mt-3 pt-3 border-t" style={{ borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(173,188,159,0.5)' }}>
          <Link href={`/clubs/${event.clubId}/home`} className="flex items-center gap-2 min-w-0">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
              style={{ background: event.clubAccent }}
            >
              {event.clubName.slice(0, 1).toUpperCase()}
            </div>
            <span className={`text-xs font-semibold truncate ${isDark ? 'text-white/70 hover:text-white' : 'text-[#436850] hover:text-[#12372A]'} transition-colors`}>
              {event.clubName}
            </span>
          </Link>
          <RsvpAvatarStack
            rsvps={rsvps}
            accentColor={event.clubAccent}
            isDark={isDark}
            max={4}
          />
        </div>

        {/* RSVP buttons */}
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
  const [search, setSearch] = useState(() => new URLSearchParams(window.location.search).get("q") ?? "");
  const [categoryFilter, setCategoryFilter] = useState<ClubCategory | "all">(() => (new URLSearchParams(window.location.search).get("cat") as ClubCategory | "all") ?? "all");
  const [sortBy, setSortBy] = useState<"members" | "newest" | "tournaments" | "az">(() => (new URLSearchParams(window.location.search).get("sort") as "members" | "newest" | "tournaments" | "az") ?? "members");
  const [discoverError, setDiscoverError] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [showAuthGate, setShowAuthGate] = useState(false);
  const [wizardPreviewMode, setWizardPreviewMode] = useState(false);
  const [rsvpRefresh, setRsvpRefresh] = useState(0);
  const [discoverClubs, setDiscoverClubs] = useState<Club[]>([]);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [discoverTotal, setDiscoverTotal] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // SEO: set page title and meta description
  useEffect(() => {
    document.title = "Chess Clubs — Join a Local OTB Chess Club | ChessOTB.club";
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute("content", "Discover and join over-the-board chess clubs near you. Connect with local players, attend club events, and grow your chess community.");
    return () => {
      document.title = "ChessOTB.club — Chess Tournaments Over The Board";
    };
  }, []);

  // ── Server-side Discover search (debounced) ──────────────────────────────
  const fetchDiscover = useCallback(async (q: string, cat: ClubCategory | "all", joinedIds: Set<string>, sort: "members" | "newest" | "tournaments" | "az" = "members") => {
    setDiscoverLoading(true);
    setDiscoverError(false);
    try {
      const { clubs: results, total } = await apiListPublicClubs({
        search: q.trim() || undefined,
        category: cat !== "all" ? cat : undefined,
        sort,
      });
      // Exclude clubs the user has already joined
      const filtered = results.filter((c: Club) => !joinedIds.has(c.id));
      setDiscoverClubs(filtered);
      setDiscoverTotal(total);
    } catch {
      setDiscoverError(true);
      // Fallback: filter the already-loaded allClubs array
      setDiscoverClubs(
        allClubs.filter((c) => {
          if (joinedIds.has(c.id)) return false;
          if (cat !== "all" && c.category !== cat) return false;
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

  // Debounce search + category changes → server fetch
  useEffect(() => {
    const joinedIds = new Set(myClubs.map((c) => c.id));
    if (debounceRef.current) clearTimeout(debounceRef.current);
    // Immediate fetch for category changes, debounced for text search
    const delay = search !== "" ? 350 : 0;
    // Sync URL params
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (categoryFilter !== "all") params.set("cat", categoryFilter);
    if (sortBy !== "members") params.set("sort", sortBy);
    const newUrl = params.toString() ? `${window.location.pathname}?${params.toString()}` : window.location.pathname;
    window.history.replaceState({}, "", newUrl);
    debounceRef.current = setTimeout(() => {
      fetchDiscover(search, categoryFilter, joinedIds, sortBy);
    }, delay);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, categoryFilter, sortBy, myClubs, fetchDiscover]);

  const refreshClubs = useCallback(async () => {
    seedClubsIfEmpty();
    seedClubEventsIfEmpty();

    // Trigger one-time localStorage → server migration for signed-in users
    if (user) {
      migrateLocalClubsToServer(user.id).catch(() => {});
    }

    // Fetch public clubs from server (server-first, localStorage fallback)
    const { clubs: serverClubs } = await apiListPublicClubs();
    const localClubs = listAllClubs();
    // Merge: server clubs take priority; add any local-only clubs not yet synced
    const serverIds = new Set(serverClubs.map((c: Club) => c.id));
    const localOnly = localClubs.filter((c) => !serverIds.has(c.id));
    const all = [...serverClubs, ...localOnly];
    setAllClubs(all);

    if (user) {
      // Fetch from server so owned/joined clubs are always in sync (not just localStorage)
      let joined: Club[] = [];
      try {
        joined = await apiListMyClubs();
        // Also sync to localStorage so offline fallback stays current
        joined.forEach((c) => {
          if (!listMyClubs(user.id).find((lc) => lc.id === c.id)) {
            joinClub(c.id, { userId: user.id, displayName: user.displayName ?? "" });
          }
        });
      } catch {
        // Fallback to localStorage if server is unreachable
        joined = listMyClubs(user.id);
      }
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
  }, [user]);

  useEffect(() => {
    refreshClubs();
  }, [user, showWizard, rsvpRefresh, refreshClubs]); // re-fetch after wizard closes or RSVP changes

  const _myClubIds = new Set(myClubs.map((c) => c.id));

  // ── Colour palette ──────────────────────────────────────────────────────────
  const bg = isDark ? "bg-[#0d1a0f]" : "bg-[#F5F5EE]";  // off-white for light mode
  const card = isDark ? "bg-[#1a2e1d]" : "bg-white";
  const cardBorder = isDark ? "border-white/8" : "border-[#ADBC9F]/70";
  const textMain = isDark ? "text-white" : "text-[#12372A]";
  const textMuted = isDark ? "text-white/70" : "text-[#436850]";
  const inputBg = isDark ? "bg-white/6 border-white/10 text-white placeholder:text-white/30" : "bg-white border-[#ADBC9F] text-[#12372A] placeholder:text-[#436850]/60";
  const divider = isDark ? "border-white/8" : "border-[#ADBC9F]/70";

  return (
    <div className={`min-h-screen ${bg}`}>

      {/* ── Sticky header ──────────────────────────────────────────────────── */}
      <header className={`sticky top-0 z-40 border-b otb-header-safe ${divider} ${isDark ? "bg-[#0d1a0f]/90" : "bg-[#F5F5EE]/95"} backdrop-blur-md`}>
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-3">
          <NavLogo className="h-7" />
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => user ? setShowWizard(true) : setShowAuthGate(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold bg-[#436850] text-white hover:bg-[#3a5230] transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Create Club</span>
            </button>
            <AvatarNavDropdown currentPage="Clubs" />
          </div>
        </div>
      </header>

      {/* ── Hero gradient section ─────────────────────────────────────────── */}
      <div className="relative overflow-hidden">
        {/* Gradient background */}
        <div
          className="absolute inset-0"
          style={{
            background: isDark
              ? "linear-gradient(180deg, #0d2b12 0%, #0d1a0f 100%)"
              : "linear-gradient(180deg, #1a4a22 0%, #F5F5EE 100%)",
          }}
        />
        {/* Checkered pattern overlay */}
        <div className="absolute inset-0 chess-board-bg" style={{ opacity: isDark ? 0.08 : 0.05 }} />
        {/* Animated shimmer overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: isDark
              ? "linear-gradient(120deg, transparent 30%, rgba(76,175,80,0.04) 50%, transparent 70%)"
              : "linear-gradient(120deg, transparent 30%, rgba(67,104,80,0.03) 50%, transparent 70%)",
            backgroundSize: "200% 100%",
            animation: "shimmerBg 8s ease-in-out infinite",
          }}
        />
        {/* Radial glow */}
        <div
          className="absolute inset-0"
          style={{
            background: isDark
              ? "radial-gradient(ellipse 70% 60% at 50% 30%, rgba(76,175,80,0.15) 0%, transparent 70%)"
              : "radial-gradient(ellipse 70% 60% at 50% 30%, rgba(67,104,80,0.10) 0%, transparent 70%)",
          }}
        />

        <div className="relative max-w-5xl mx-auto px-4 pt-12 pb-10 sm:pt-16 sm:pb-12">
          {/* Headline */}
          <h1
            className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight"
            style={{ fontFamily: "'Clash Display', sans-serif" }}
          >
            {user ? `Welcome back${user.displayName ? `, ${user.displayName.split(' ')[0]}` : ''}!` : "Discover Clubs"}
          </h1>
          <p className="text-sm sm:text-base mt-2 text-white/60 max-w-lg">
            {user
              ? "Your chess communities and upcoming events"
              : "Find your chess community"}
          </p>

          {/* Integrated search bar — inside hero for non-logged-in users */}
          {!user && (
            <div className="relative mt-6 max-w-xl">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search clubs by name, location, or category..."
                className="w-full pl-12 pr-4 py-3.5 rounded-2xl border border-white/15 bg-white/8 backdrop-blur-sm text-sm text-white placeholder:text-white/35 outline-none transition-all focus:border-[#4CAF50]/60 focus:bg-white/12 focus:shadow-[0_0_20px_rgba(76,175,80,0.1)]"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center text-white/40 hover:text-white/80 bg-white/10 transition-colors"
                  aria-label="Clear search"
                >
                  ×
                </button>
              )}
            </div>
          )}

          {/* Stats bar — social proof */}
          {!user && (
            <div className="flex items-center gap-4 sm:gap-6 mt-5">
              <div className="flex items-center gap-1.5">
                <Users className="w-4 h-4 text-[#4CAF50]" />
                <span className="text-sm font-semibold text-white/80">{discoverTotal > 0 ? `${discoverTotal}+` : "18"} clubs</span>
              </div>
              <div className="w-px h-4 bg-white/15" />
              <div className="flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-[#4CAF50]" />
                <span className="text-sm font-semibold text-white/80">5 countries</span>
              </div>
              <div className="w-px h-4 bg-white/15" />
              <div className="flex items-center gap-1.5">
                <Trophy className="w-4 h-4 text-[#4CAF50]" />
                <span className="text-sm font-semibold text-white/80">1,200+ players</span>
              </div>
            </div>
          )}

          {/* Tab bar — integrated into hero (signed-in users) */}
          {user && (
            <div className="flex gap-1.5 mt-6 flex-wrap">
              <button
                onClick={() => setActiveTab("clubs")}
                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-semibold transition-all border ${
                  activeTab === "clubs"
                    ? "bg-white/15 text-white border-white/20 shadow-sm backdrop-blur-sm"
                    : "bg-transparent text-white/50 border-white/8 hover:text-white hover:border-white/15"
                }`}
              >
                <Users className="w-4 h-4" />
                Clubs
                {myClubs.length > 0 && (
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                    activeTab === "clubs"
                      ? "bg-white/20 text-white"
                      : "bg-white/8 text-white/40"
                  }`}>{myClubs.length}</span>
                )}
              </button>
              <button
                onClick={() => setActiveTab("events")}
                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-semibold transition-all border ${
                  activeTab === "events"
                    ? "bg-white/15 text-white border-white/20 shadow-sm backdrop-blur-sm"
                    : "bg-transparent text-white/50 border-white/8 hover:text-white hover:border-white/15"
                }`}
              >
                <CalendarDays className="w-4 h-4" />
                Upcoming Events
                {upcomingEvents.length > 0 && (
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                    activeTab === "events"
                      ? "bg-white/20 text-white"
                      : "bg-white/8 text-white/40"
                  }`}>{upcomingEvents.length}</span>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-8">

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



        {/* ── Following section (signed-in, non-empty) ─────────────────── */}
        {user && followedClubs.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Bell className={`w-4 h-4 ${isDark ? "text-[#4CAF50]" : "text-[#436850]"}`} />
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
        )}

        {/* ── Discover section ─────────────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className={`text-sm font-semibold uppercase tracking-wider ${textMuted}`}>
              {user ? "Discover" : "All Clubs"}
            </h2>
            {/* Sort dropdown */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className={`text-xs font-medium px-3 py-1.5 rounded-xl border outline-none transition-colors cursor-pointer ${
                isDark ? "bg-white/5 border-white/10 text-white/70" : "bg-[#FBFADA]/70 border-[#ADBC9F] text-[#436850]"
              }`}
            >
              <option value="members">Most Members</option>
              <option value="newest">Newest</option>
              <option value="tournaments">Most Tournaments</option>
              <option value="az">A → Z</option>
            </select>
          </div>

          {/* Featured Clubs carousel — top 6 by member count */}
          <FeaturedClubsCarousel isDark={isDark} />

          {/* Search bar */}
          <div className="relative mb-3">
            <Search className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${textMuted}`} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search clubs by name, location, or description…"
              className={`w-full pl-10 ${search ? "pr-9" : "pr-4"} py-3 rounded-2xl border text-sm outline-none transition-colors focus:border-[#4CAF50] ${inputBg}`}
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className={`absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center transition-colors ${
                  isDark ? "text-white/40 hover:text-white/80 bg-white/10" : "text-[#436850] hover:text-[#12372A] bg-[#ADBC9F]/40"
                }`}
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>

          {/* Category filter chips — always visible */}
          <div className="flex gap-2 flex-wrap mb-4">
            {ALL_CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold transition-all duration-200 ${
                  categoryFilter === cat
                    ? isDark
                      ? "bg-[#4CAF50]/20 text-[#4CAF50] border border-[#4CAF50]/40 shadow-[0_0_12px_rgba(76,175,80,0.15)]"
                      : "bg-[#436850]/12 text-[#436850] border border-[#436850]/30 shadow-sm"
                    : isDark
                      ? "bg-white/5 text-white/50 hover:text-white hover:bg-white/10 border border-white/8 hover:border-white/15"
                      : "bg-[#ADBC9F]/30 text-[#436850] hover:text-[#12372A] hover:bg-[#ADBC9F]/50 border border-transparent"
                }`}
              >
                {cat !== "all" && CATEGORY_ICONS[cat]}
                {cat === "all" ? "All" : CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>

          {/* Result count */}
          {!discoverLoading && (
            <p className={`text-xs mb-3 ${textMuted}`}>
              {discoverTotal === 0 && (search.trim() || categoryFilter !== "all")
                ? <span>No clubs found{search.trim() ? <> matching <strong className="font-semibold">"{search.trim()}"</strong></> : ""}{categoryFilter !== "all" ? ` in ${CATEGORY_LABELS[categoryFilter]}` : ""}</span>
                : discoverTotal > 0
                  ? <>{discoverTotal} club{discoverTotal !== 1 ? "s" : ""}{search.trim() ? <> matching <strong className="font-semibold">"{search.trim()}"</strong></> : ""}{categoryFilter !== "all" ? ` in ${CATEGORY_LABELS[categoryFilter]}` : ""}</>
                  : null
              }
            </p>
          )}

          {/* Loading skeleton */}
          {discoverLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className={`rounded-3xl border ${cardBorder} ${card} p-5 animate-pulse`}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-12 h-12 rounded-2xl flex-shrink-0 ${isDark ? "bg-white/8" : "bg-[#ADBC9F]/40"}`} />
                    <div className="flex-1">
                      <div className={`h-4 w-3/4 rounded-full mb-2 ${isDark ? "bg-white/8" : "bg-[#ADBC9F]/40"}`} />
                      <div className={`h-3 w-1/2 rounded-full ${isDark ? "bg-white/5" : "bg-[#FBFADA]/70"}`} />
                    </div>
                  </div>
                  <div className={`h-3 w-full rounded-full mb-1.5 ${isDark ? "bg-white/5" : "bg-[#FBFADA]/70"}`} />
                  <div className={`h-3 w-2/3 rounded-full ${isDark ? "bg-white/5" : "bg-[#FBFADA]/70"}`} />
                </div>
              ))}
            </div>
          ) : discoverError ? (
            <div className={`rounded-3xl border ${cardBorder} ${card} py-12 text-center`}>
              <p className={`text-sm font-semibold ${textMain}`}>Couldn't load clubs</p>
              <p className={`text-xs mt-1 mb-4 ${textMuted}`}>Check your connection and try again</p>
              <button
                onClick={() => fetchDiscover(search, categoryFilter, new Set(myClubs.map((c) => c.id)), sortBy)}
                className="text-xs font-semibold px-4 py-2 rounded-xl"
                style={{ background: "oklch(0.55 0.13 145)", color: "#fff" }}
              >Retry</button>
            </div>
          ) : discoverClubs.length === 0 ? (
            <div className={`rounded-3xl border ${cardBorder} ${card} py-12 text-center`}>
              <Search className={`w-10 h-10 mx-auto mb-3 ${textMuted}`} />
              <p className={`text-sm font-semibold ${textMain}`}>
                {search.trim() || categoryFilter !== "all" ? "No clubs match your filters" : "No clubs yet"}
              </p>
              <p className={`text-xs mt-1 ${textMuted}`}>
                {search.trim() || categoryFilter !== "all"
                  ? <span>Try clearing the search or selecting <button onClick={() => { setSearch(""); setCategoryFilter("all"); }} className="underline">All categories</button></span>
                  : "Be the first to create a club!"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
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
            onClick={() => user ? setShowWizard(true) : setShowAuthGate(true)}
          >
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 transition-colors ${
              isDark ? "bg-white/5 group-hover:bg-[#4CAF50]/10" : "bg-[#FBFADA]/70 group-hover:bg-[#436850]/8"
            }`}>
              <Plus className={`w-7 h-7 transition-colors ${isDark ? "text-white/30 group-hover:text-[#4CAF50]" : "text-[#436850]/70 group-hover:text-[#436850]"}`} />
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
          </div>
        </section>

          </>
        )}

      </div>

      {/* Create Club Wizard */}
      {showWizard && (
        <CreateClubWizard onClose={() => { setShowWizard(false); setWizardPreviewMode(false); }} />
      )}

      {/* Auth Gate — shown to logged-out users who click Create Club */}
      {showAuthGate && (
        <CreateClubAuthGate
          onClose={() => setShowAuthGate(false)}
          onAuthenticated={() => { setShowAuthGate(false); setShowWizard(true); }}
          onPreview={() => { setShowAuthGate(false); setWizardPreviewMode(true); setShowWizard(true); }}
        />
      )}
    </div>
  );
}
