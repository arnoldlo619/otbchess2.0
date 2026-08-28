/**
 * ClubProfile page — /clubs/:id
 *
 * Full club profile with:
 *   - Hero banner with club identity, stats, and join/leave CTA
 *   - About section with description and social links
 *   - Members roster with roles and stats
 *   - Tournament history with status badges
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useLocation, Link } from "wouter";
import { NavLogo } from "@/components/NavLogo";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { useAuthContext } from "@/context/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useAccessibleOverlay } from "@/hooks/useAccessibleOverlay";
import {
  getClub,
  getClubBySlug,
  getClubMembers,
  getClubTournaments,
  joinClub,
  leaveClub,
  isMember,
  getMembership,
  updateClub,
  syncClubTournamentCount,
  seedClubsIfEmpty,
  followClub,
  unfollowClub,
  isFollowing,
  getFollowerCount,
  onClubChange,
  type Club,
  type ClubMember,
  type ClubTournament,
} from "@/lib/clubRegistry";
import { apiJoinClub, apiLeaveClub, apiUpdateClub } from "@/lib/clubsApi";
import { useClubPresence } from "@/hooks/useClubPresence";
import { ClubAvatarUpload } from "@/components/ClubAvatarUpload";
import { ClubBannerUpload, cropBannerImage, validateBannerFile } from "@/components/ClubBannerUpload";
import { TournamentWizard } from "@/components/TournamentWizard";
import { listTournamentsByClub, getTournamentConfig, type TournamentConfig } from "@/lib/tournamentRegistry";
import { getTournamentFormatLabel } from "@/lib/formatRegistry";
import { getTournamentStatusDisplay } from "@/lib/tournamentUtils";
import { loadTournamentState } from "@/lib/directorState";
import { computeStandings, type StandingRow } from "@/lib/swiss";
import {
  listFeedEvents,
  seedFeedIfEmpty,
  postAnnouncement,
  deleteFeedEvent,
  recordMemberJoin,
  recordMemberLeave,
  recordTournamentCreated,
  castPollVote,
  upsertFeedRSVP,
  checkAndCloseExpiredPolls,
  publishScheduledPolls,
  toggleReaction,
  syncFeedFromServer,
  formatTournamentResultFeedTitle,
  type FeedEvent,
  type FeedRSVPEntry,
} from "@/lib/clubFeedRegistry";
import {
  listClubEvents,
  getEventRSVPs,
  getUserRSVP,
  upsertRSVP,
  syncRSVPsFromServer,
  syncEventsFromServer,
  createClubEvent,
  updateClubEvent,
  deleteClubEvent,
  createRecurringEvents,
  deleteRecurringSeries,
  type ClubEvent,
  type ClubEventRSVP,
  type RSVPStatus as _RSVPStatus,
} from "@/lib/clubEventRegistry";
import {
  getPlayerBattleSummary,
  type PlayerBattleSummary,
} from "@/lib/clubBattleRegistry";
import { apiBattlePlayerStats } from "@/lib/clubBattleApi";
import {
  Users,
  Trophy,
  Calendar,
  MapPin,
  Globe,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  Crown,
  Shield,
  UserPlus,
  UserMinus,
  ExternalLink,
  Hash,
  CheckCircle2,
  Clock,
  Zap,
  Star,
  Megaphone,
  MoreHorizontal,
  Share2,
  X,
  PlusCircle,
  Lock,
  Rss,
  Trash2,
  Bell,
  BellOff,
  BarChart2,
  ClipboardList,
  Award,
  Swords,
  ArrowRightLeft,
  Camera,
  Pencil,
  Image as ImageIcon,
  Search,
  Check,
  Copy,
  Play,
  Link2,
  Mail,
  Phone,
  Video,
  Instagram,
  TrendingUp,
  TrendingDown,
  Minus,
  Heart,
  MessageCircle,
  Repeat2,
  Send,
  MoreVertical,
  Sparkles,
  ArrowRight,
  Info,
  Menu,
} from "lucide-react";
import {
  FeedIcon as OtbFeed,
  EventsIcon as OtbEvents,
  MembersIcon as OtbMembers,
  AlbumIcon as OtbAlbum,
  TournamentsIcon as OtbTournaments,
  LeaguesIcon as OtbLeagues,
  HomeIcon as OtbHome,
  ClubsIcon as OtbClubs,
  AcademyIcon as OtbAcademy,
  ProfileIcon as OtbProfile,
} from "@/components/OtbIcons";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import AuthModal from "@/components/AuthModal";
import { ContactOwnerModal } from "@/components/ContactOwnerModal";
import { apiFetch } from "@/lib/apiFetch";
import { AvatarNavDropdown } from "@/components/AvatarNavDropdown";
import { EditClubDetailsModal } from "@/components/EditClubDetailsModal";
import { ClubShareModal } from "@/components/ClubShareModal";
import { ClubHero } from "@/components/club/ClubHero";
import { ClubTabs } from "@/components/club/ClubTabs";
import { ClubPromoModal } from "@/components/club/ClubPromoModal";
import { ClubQRProjectionModal } from "@/components/club/ClubQRProjectionModal";
import { ClubAlbumTab } from "@/components/club/ClubAlbumTab";
import { ShaderBackground } from "@/components/ui/shader-r";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatYear(iso: string): string {
  return new Date(iso).getFullYear().toString();
}

const CATEGORY_LABELS: Record<string, string> = {
  club: "Chess Club",
  school: "School Team",
  university: "University Team",
  online: "Online Community",
  community: "Community Club",
  professional: "Professional Academy",
};

const COUNTRY_FLAGS: Record<string, string> = {
  GB: "🇬🇧", US: "🇺🇸", DE: "🇩🇪", JP: "🇯🇵", IN: "🇮🇳", FR: "🇫🇷",
  ES: "🇪🇸", IT: "🇮🇹", CA: "🇨🇦", AU: "🇦🇺", BR: "🇧🇷", RU: "🇷🇺",
};

// Per-category gradient theme — mirrors FeaturedClubsCarousel & ClubLeaderboard
// Each entry has separate dark/light variants so the banner reads well in both themes.
const CATEGORY_BANNER_THEME: Record<
  string,
  { dark: { grad: string; badge: string }; light: { grad: string; badge: string } }
> = {
  competitive: {
    dark:  { grad: "from-red-950 via-rose-900 to-red-800",           badge: "bg-red-500/20 text-red-300 border-red-500/30" },
    light: { grad: "from-red-400 via-rose-300 to-red-200",           badge: "bg-red-600/15 text-red-700 border-red-400/40" },
  },
  casual: {
    dark:  { grad: "from-blue-950 via-blue-900 to-indigo-800",       badge: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
    light: { grad: "from-blue-400 via-sky-300 to-indigo-200",        badge: "bg-blue-600/15 text-blue-700 border-blue-400/40" },
  },
  scholastic: {
    dark:  { grad: "from-yellow-950 via-amber-900 to-yellow-800",    badge: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30" },
    light: { grad: "from-amber-400 via-yellow-300 to-amber-200",     badge: "bg-amber-600/15 text-amber-700 border-amber-400/40" },
  },
  online: {
    dark:  { grad: "from-purple-950 via-violet-900 to-purple-800",   badge: "bg-purple-500/20 text-purple-300 border-purple-500/30" },
    light: { grad: "from-purple-400 via-violet-300 to-purple-200",   badge: "bg-purple-600/15 text-purple-700 border-purple-400/40" },
  },
  otb: {
    dark:  { grad: "from-emerald-950 via-green-900 to-emerald-800",  badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
    light: { grad: "from-emerald-400 via-green-300 to-emerald-200",  badge: "bg-emerald-600/15 text-emerald-700 border-emerald-400/40" },
  },
  blitz: {
    dark:  { grad: "from-orange-950 via-orange-900 to-amber-800",    badge: "bg-orange-500/20 text-orange-300 border-orange-500/30" },
    light: { grad: "from-orange-400 via-amber-300 to-orange-200",    badge: "bg-orange-600/15 text-orange-700 border-orange-400/40" },
  },
  correspondence: {
    dark:  { grad: "from-cyan-950 via-teal-900 to-cyan-800",         badge: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30" },
    light: { grad: "from-cyan-400 via-teal-300 to-cyan-200",         badge: "bg-cyan-600/15 text-cyan-700 border-cyan-400/40" },
  },
  club: {
    dark:  { grad: "from-green-950 via-green-900 to-green-800",      badge: "bg-green-500/20 text-green-300 border-green-500/30" },
    light: { grad: "from-green-400 via-emerald-300 to-green-200",    badge: "bg-green-600/15 text-green-700 border-green-400/40" },
  },
  school: {
    dark:  { grad: "from-yellow-950 via-amber-900 to-yellow-800",    badge: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30" },
    light: { grad: "from-yellow-400 via-amber-300 to-yellow-200",    badge: "bg-yellow-600/15 text-yellow-700 border-yellow-400/40" },
  },
  university: {
    dark:  { grad: "from-indigo-950 via-indigo-900 to-blue-800",     badge: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30" },
    light: { grad: "from-indigo-400 via-blue-300 to-indigo-200",     badge: "bg-indigo-600/15 text-indigo-700 border-indigo-400/40" },
  },
  community: {
    dark:  { grad: "from-teal-950 via-teal-900 to-cyan-800",         badge: "bg-teal-500/20 text-teal-300 border-teal-500/30" },
    light: { grad: "from-teal-400 via-cyan-300 to-teal-200",         badge: "bg-teal-600/15 text-teal-700 border-teal-400/40" },
  },
  professional: {
    dark:  { grad: "from-rose-950 via-rose-900 to-pink-800",         badge: "bg-rose-500/20 text-rose-300 border-rose-500/30" },
    light: { grad: "from-rose-400 via-pink-300 to-rose-200",         badge: "bg-rose-600/15 text-rose-700 border-rose-400/40" },
  },
  other: {
    dark:  { grad: "from-slate-900 via-slate-800 to-slate-700",      badge: "bg-slate-500/20 text-slate-300 border-slate-500/30" },
    light: { grad: "from-slate-400 via-gray-300 to-slate-200",       badge: "bg-slate-600/15 text-slate-700 border-slate-400/40" },
  },
};
const FALLBACK_BANNER_GRADS: { dark: string; light: string }[] = [
  { dark: "from-emerald-950 via-green-900 to-emerald-800",  light: "from-emerald-400 via-green-300 to-emerald-200" },
  { dark: "from-blue-950 via-blue-900 to-indigo-800",       light: "from-blue-400 via-sky-300 to-indigo-200" },
  { dark: "from-purple-950 via-violet-900 to-purple-800",   light: "from-purple-400 via-violet-300 to-purple-200" },
  { dark: "from-amber-950 via-yellow-900 to-amber-800",     light: "from-amber-400 via-yellow-300 to-amber-200" },
  { dark: "from-rose-950 via-pink-900 to-rose-800",         light: "from-rose-400 via-pink-300 to-rose-200" },
  { dark: "from-cyan-950 via-teal-900 to-cyan-800",         light: "from-cyan-400 via-teal-300 to-cyan-200" },
];
const NOISE_BG =
  "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

// ── Sub-components ────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: ClubMember["role"] }) {
  if (role === "owner") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide bg-amber-500/15 text-amber-400">
        <Crown className="w-2.5 h-2.5" /> Owner
      </span>
    );
  }
  if (role === "director") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide bg-[#4CAF50]/15 text-[#4CAF50]">
        <Shield className="w-2.5 h-2.5" /> Director
      </span>
    );
  }
  return null;
}

function TournamentStatusBadge({ status, isDark = true }: { status: ClubTournament["status"]; isDark?: boolean }) {
  if (status === "upcoming") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-400">
        <Clock className="w-2.5 h-2.5" /> Upcoming
      </span>
    );
  }
  if (status === "active") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#4CAF50]/15 text-[#4CAF50]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#4CAF50] animate-pulse" />
        Live
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
      isDark ? "bg-white/8 text-white/40" : "bg-[#ADBC9F]/60 text-[#436850]"
    }`}>
      <CheckCircle2 className="w-2.5 h-2.5" /> Completed
    </span>
  );
}

function StatPill({
  icon,
  value,
  label,
  isDark,
}: {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  isDark: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center gap-1.5 px-5 py-4 rounded-2xl min-w-[80px] ${
        isDark ? "bg-white/6" : "bg-black/5"
      }`}
    >
      <div className={`${isDark ? "text-[#4CAF50]" : "text-[#436850]"}`}>{icon}</div>
      <span
        className={`text-xl font-bold leading-none ${isDark ? "text-white" : "text-[#12372A]"}`}
        style={{ fontFamily: "'Clash Display', sans-serif" }}
      >
        {value}
      </span>
      <span className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? "text-white/40" : "text-[#436850]"}`}>
        {label}
      </span>
    </div>
  );
}

// ── Feed helpers ─────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

const FEED_EVENT_CONFIG: Record<
  import("@/lib/clubFeedRegistry").FeedEventType,
  { icon: React.ReactNode; accent: string; darkAccent: string }
> = {
  member_join: {
    icon: <UserPlus className="w-4 h-4" />,
    accent: "text-[#436850] bg-[#436850]/10",
    darkAccent: "text-[#4CAF50] bg-[#4CAF50]/15",
  },
  member_leave: {
    icon: <UserMinus className="w-4 h-4" />,
    accent: "text-[#436850] bg-[#ADBC9F]/50",
    darkAccent: "text-white/40 bg-white/8",
  },
  tournament_created: {
    icon: <Trophy className="w-4 h-4" />,
    accent: "text-amber-600 bg-amber-50",
    darkAccent: "text-amber-400 bg-amber-500/15",
  },
  tournament_completed: {
    icon: <CheckCircle2 className="w-4 h-4" />,
    accent: "text-blue-600 bg-blue-50",
    darkAccent: "text-blue-400 bg-blue-500/15",
  },
  announcement: {
    icon: <Megaphone className="w-4 h-4" />,
    accent: "text-amber-600 bg-amber-50",
    darkAccent: "text-amber-400 bg-amber-500/15",
  },
  club_founded: {
    icon: <Star className="w-4 h-4" />,
    accent: "text-[#436850] bg-[#436850]/10",
    darkAccent: "text-[#4CAF50] bg-[#4CAF50]/15",
  },
  poll: {
    icon: <BarChart2 className="w-4 h-4" />,
    accent: "text-[#436850] bg-[#436850]/10",
    darkAccent: "text-[#4CAF50] bg-[#4CAF50]/15",
  },
  rsvp_form: {
    icon: <ClipboardList className="w-4 h-4" />,
    accent: "text-blue-600 bg-blue-50",
    darkAccent: "text-blue-400 bg-blue-500/15",
  },
  poll_result: {
    icon: <Award className="w-4 h-4" />,
    accent: "text-amber-600 bg-amber-50",
    darkAccent: "text-amber-400 bg-amber-500/15",
  },
  battle_result: {
    icon: <Swords className="w-4 h-4" />,
    accent: "text-orange-600 bg-orange-50",
    darkAccent: "text-orange-400 bg-orange-500/15",
  },
  leaderboard_snapshot: {
    icon: <Trophy className="w-4 h-4" />,
    accent: "text-amber-600 bg-amber-50",
    darkAccent: "text-amber-400 bg-amber-500/15",
  },
  potm_announcement: {
    icon: <Crown className="w-4 h-4" />,
    accent: "text-amber-600 bg-amber-50",
    darkAccent: "text-amber-400 bg-amber-500/15",
  },
  event_created: {
    icon: <Calendar className="w-4 h-4" />,
    accent: "text-[#436850] bg-[#436850]/10",
    darkAccent: "text-[#4CAF50] bg-[#4CAF50]/15",
  },
};

function FeedEventCard({
  event,
  isDark,
  textMain,
  textMuted,
  canDelete,
  onDelete,
  userId,
  displayName,
  avatarUrl,
  chesscomUsername,
  clubId,
  isMemberUser,
  accentColor,
  onVoted,
  onRsvped,
  onReaction,
}: {
  event: FeedEvent;
  isDark: boolean;
  textMain: string;
  textMuted: string;
  canDelete: boolean;
  onDelete: (id: string) => void;
  userId?: string;
  displayName?: string;
  avatarUrl?: string | null;
  chesscomUsername?: string | null;
  clubId: string;
  isMemberUser: boolean;
  accentColor?: string;
  onVoted?: () => void;
  onRsvped?: () => void;
  onReaction?: (eventId: string, emoji: string) => void;
}) {
  const cfg = FEED_EVENT_CONFIG[event.type];
  const accentCls = isDark ? cfg.darkAccent : cfg.accent;
  const isPoll = event.type === "poll";
  const isRsvp = event.type === "rsvp_form";
  const isPollResult = event.type === "poll_result";
  const pollExpired = isPoll && event.pollExpiresAt ? new Date(event.pollExpiresAt) < new Date() : false;
  const totalPollVotes = (event.pollOptions ?? []).reduce((s, o) => s + Object.keys(o.votes).length, 0);
  const userVotedOptions = userId ? (event.pollOptions ?? []).filter((o) => o.votes[userId]).map((o) => o.id) : [];
  const userRsvp = userId ? (event.rsvpEntries ?? []).find((r) => r.userId === userId) : undefined;
  // Use the club's accent color passed as a prop (keeps FeedEventCard stateless)
  const accent = accentColor ?? (isDark ? "#4CAF50" : "#436850");
  // Reaction picker state
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const REACTION_EMOJIS = ["\u2665\ufe0f", "\u265f\ufe0f", "\ud83d\udc4d", "\ud83d\udd25", "\ud83c\udfc6", "\ud83e\udd21", "\ud83d\ude02", "\ud83d\ude2e"];

  function handleVote(optionId: string) {
    if (pollExpired || !userId || !isMemberUser) return;
    castPollVote(clubId, event.id, optionId, userId, event.pollMultiple ?? false);
    onVoted?.();
  }

  function handleRsvp(status: FeedRSVPEntry["status"]) {
    if (!userId || !isMemberUser) return;
    upsertFeedRSVP(clubId, event.id, userId, displayName ?? "", status, avatarUrl ?? null, chesscomUsername ?? null);
    onRsvped?.();
  }

  // Compute total heart reactions for the Threads-style like count
  const totalHearts = event.reactions
    ? Object.values(event.reactions).reduce((sum, voters) => sum + Object.keys(voters).length, 0)
    : 0;
  const userHearted = userId && event.reactions
    ? Object.values(event.reactions).some((voters) => voters[userId])
    : false;

  return (
    <div className={`group ${ (isPoll || isRsvp) ? "px-5 py-5" : "px-5 py-5" }`}>
      {/* Standard activity row — Threads-style post card */}
      {!isPoll && !isRsvp && (
        <>
          {/* ── POST HEADER: avatar + name + timestamp + menu ── */}
          <div className="flex items-start gap-3 mb-3">
            {/* Circular avatar — 44px matching Threads */}
            <div className={`flex-shrink-0 rounded-full ring-2 overflow-hidden ${isDark ? "ring-white/10" : "ring-black/6"}`}>
              <PlayerAvatar
                username={event.actorChesscomUsername ?? event.actorName}
                platform={event.actorChesscomUsername ? "chesscom" : undefined}
                name={event.actorName}
                avatarUrl={event.actorAvatarUrl ?? undefined}
                size={44}
                showBadge={false}
              />
            </div>
            {/* Name + timestamp on same row, type badge below */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[15px] font-bold ${textMain} leading-tight`}>
                  {event.type === "tournament_completed" ? formatTournamentResultFeedTitle(event.tournamentName) : event.actorName}
                </span>
                <span className={`text-[13px] ${textMuted} leading-tight`}>{relativeTime(event.createdAt)}</span>
                {event.type !== "announcement" && event.type !== "tournament_completed" && (
                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${accentCls}`}>
                    {cfg.icon}
                    <span className="capitalize">{event.type.replace(/_/g, " ")}</span>
                  </span>
                )}
              </div>
            </div>
            {/* ··· menu */}
            <div className="flex items-center gap-1 flex-shrink-0">
              {event.linkHref && (
                <a
                  href={event.linkHref}
                  className={`text-xs font-semibold px-2 py-1 rounded-lg transition-colors ${
                    isDark ? "text-[#4CAF50] hover:bg-white/8" : "text-[#436850] hover:bg-[#ADBC9F]/30"
                  }`}
                >{event.linkLabel ?? "View"} →</a>
              )}
              {canDelete && (
                <button
                  onClick={() => onDelete(event.id)}
                  className={`opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg ${
                    isDark ? "hover:bg-white/8 text-white/30 hover:text-white/60" : "hover:bg-[#ADBC9F]/50 text-[#436850]/70 hover:text-[#436850]"
                  }`}
                  title="Remove from feed"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* ── POST BODY ── */}
          <div className="ml-[56px]">
            {/* Primary description — Threads uses regular weight 15px */}
            {event.type !== "tournament_completed" && (
              <p className={`text-[15px] font-normal ${textMain} leading-[1.55] mb-1`}>{event.description}</p>
            )}
            {/* Secondary detail */}
            {event.detail && (
              <p className={`text-[14px] leading-[1.55] mb-2 ${
                event.type === "announcement" ? (isDark ? "text-white/75" : "text-[#436850]") : textMuted
              }`}>{event.detail}</p>
            )}
            {/* Image attachment */}
            {event.imageUrl && (
              <div className="mt-2 mb-3 rounded-2xl overflow-hidden border" style={{ borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)" }}>
                <img
                  loading="lazy"
                  decoding="async"
                  src={event.imageUrl}
                  alt="Post attachment"
                  className="w-full max-h-80 object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              </div>
            )}

            {/* ── THREADS-STYLE ACTION BAR ── */}
            {/* Threads: bare icons, no background pill, generous gap, 20px icons */}
            <div className="flex items-center gap-4 mt-3 -ml-0.5">
              {/* Heart / Like — fills red when liked */}
              <button
                onClick={() => isMemberUser && userId && onReaction?.(event.id, "❤️")}
                disabled={!isMemberUser || !userId}
                className={`flex items-center gap-1.5 transition-all ${
                  userHearted
                    ? isDark ? "text-red-400" : "text-red-500"
                    : isDark ? "text-white/35 hover:text-white/75" : "text-[#436850]/45 hover:text-[#436850]"
                } disabled:cursor-default`}
              >
                <Heart className={`w-5 h-5 transition-all ${ userHearted ? "fill-current" : "" }`} />
                {totalHearts > 0 && <span className={`text-[13px] font-medium ${isDark ? "text-white/50" : "text-[#436850]/60"}`}>{totalHearts}</span>}
              </button>

              {/* Comment (visual only) */}
              <button
                className={`flex items-center gap-1.5 transition-all ${
                  isDark ? "text-white/35 hover:text-white/75" : "text-[#436850]/45 hover:text-[#436850]"
                }`}
              >
                <MessageCircle className="w-5 h-5" />
              </button>

              {/* Repost (visual only) */}
              <button
                className={`flex items-center gap-1.5 transition-all ${
                  isDark ? "text-white/35 hover:text-white/75" : "text-[#436850]/45 hover:text-[#436850]"
                }`}
              >
                <Repeat2 className="w-5 h-5" />
              </button>

              {/* Share */}
              <button
                className={`flex items-center gap-1.5 transition-all ${
                  isDark ? "text-white/35 hover:text-white/75" : "text-[#436850]/45 hover:text-[#436850]"
                }`}
              >
                <Send className="w-5 h-5" />
              </button>

              {/* Emoji reaction picker */}
              {isMemberUser && userId && (
                <div className="relative ml-auto">
                  <button
                    onClick={() => setShowEmojiPicker((v) => !v)}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
                      isDark ? "text-white/30 hover:text-white/70 hover:bg-white/6" : "text-[#436850]/40 hover:text-[#436850] hover:bg-[#ADBC9F]/25"
                    }`}
                    title="Add reaction"
                  >
                    <span className="text-base">&#128512;</span>
                    {/* Show existing non-heart reactions as small bubbles */}
                    {event.reactions && Object.entries(event.reactions).filter(([em]) => em !== "❤️").map(([emoji, voters]) => {
                      const count = Object.keys(voters).length;
                      if (count === 0) return null;
                      const userReacted = userId ? !!voters[userId] : false;
                      return (
                        <span
                          key={emoji}
                          className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[11px] font-semibold border ml-1 ${
                            userReacted
                              ? isDark ? "bg-[#4CAF50]/20 border-[#4CAF50]/40 text-[#4CAF50]" : "bg-[#436850]/15 border-[#436850]/30 text-[#436850]"
                              : isDark ? "bg-white/5 border-white/10 text-white/60" : "bg-[#f0f5e8] border-[#ADBC9F] text-[#436850]/70"
                          }`}
                        >
                          {emoji} {count}
                        </span>
                      );
                    })}
                  </button>
                  {showEmojiPicker && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowEmojiPicker(false)} />
                      <div className={`absolute bottom-full mb-2 right-0 z-50 flex gap-1 p-2 rounded-2xl shadow-xl border ${
                        isDark ? "bg-[#0d1a0f] border-white/15" : "bg-white border-[#ADBC9F]"
                      }`}>
                        {REACTION_EMOJIS.map((em) => (
                          <button
                            key={em}
                            onClick={() => { onReaction?.(event.id, em); setShowEmojiPicker(false); }}
                            className="w-8 h-8 rounded-xl flex items-center justify-center text-lg hover:scale-125 transition-transform"
                          >{em}</button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Poll card */}
      {isPoll && event.pollOptions && (
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${accentCls}`}>{cfg.icon}</div>
              <div>
                <p className={`text-xs ${textMuted}`}>{event.actorName} &middot; {relativeTime(event.createdAt)}</p>
                <p className={`text-sm font-semibold ${textMain} mt-0.5`}>{event.pollQuestion}</p>
              </div>
            </div>
            {canDelete && (
              <button onClick={() => onDelete(event.id)} className={`opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg ${
                isDark ? "hover:bg-white/8 text-white/30 hover:text-white/60" : "hover:bg-[#ADBC9F]/50 text-[#436850]/70 hover:text-[#436850]"
              }`}><Trash2 className="w-3.5 h-3.5" /></button>
            )}
          </div>
          <div className="space-y-2">
            {event.pollOptions.map((opt) => {
              const voteCount = Object.keys(opt.votes).length;
              const pct = totalPollVotes > 0 ? Math.round((voteCount / totalPollVotes) * 100) : 0;
              const voted = userVotedOptions.includes(opt.id);
              const showResults = pollExpired || userVotedOptions.length > 0 || !isMemberUser;
              return (
                <button
                  key={opt.id}
                  onClick={() => handleVote(opt.id)}
                  disabled={pollExpired || !isMemberUser}
                  className={`w-full text-left rounded-xl overflow-hidden border transition-all relative ${
                    voted ? "border-[#4CAF50]/50" : isDark ? "border-white/10 hover:border-white/25" : "border-[#ADBC9F] hover:border-[#ADBC9F]"
                  } ${(pollExpired || !isMemberUser) ? "cursor-default" : "cursor-pointer"}`}
                >
                  {showResults && (
                    <div className="absolute inset-0 rounded-xl transition-all duration-500" style={{
                      width: `${pct}%`,
                      background: voted ? "oklch(0.44 0.12 145 / 0.20)" : isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)"
                    }} />
                  )}
                  <div className="relative flex items-center justify-between px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                        voted ? "border-[#4CAF50] bg-[#4CAF50]" : isDark ? "border-white/30" : "border-[#ADBC9F]"
                      }`}>
                        {voted && <CheckCircle2 className="w-2.5 h-2.5 text-white" />}
                      </div>
                      <span className={`text-sm font-medium ${voted ? (isDark ? "text-white" : "text-[#12372A]") : textMuted}`}>{opt.text}</span>
                    </div>
                    {showResults && <span className={`text-xs font-semibold ${textMuted}`}>{pct}%</span>}
                  </div>
                </button>
              );
            })}
          </div>
          <div className={`flex items-center justify-between text-xs ${textMuted}`}>
            <span>{totalPollVotes} vote{totalPollVotes !== 1 ? "s" : ""}</span>
            {!isMemberUser && <span className="italic">Join to vote</span>}
            {event.pollExpiresAt && (
              <span className={pollExpired ? "text-red-500/60" : ""}>{pollExpired ? "Closed" : `Closes ${relativeTime(event.pollExpiresAt)}`}</span>
            )}
          </div>
        </div>
      )}

      {/* RSVP Form card */}
      {isPollResult && event.pollResultBreakdown && (
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${accentCls}`}>{cfg.icon}</div>
              <div>
                <p className={`text-xs ${textMuted}`}>{event.actorName} &middot; {relativeTime(event.createdAt)}</p>
                <p className={`text-sm font-semibold ${textMain} mt-0.5`}>{event.description}</p>
              </div>
            </div>
            {canDelete && (
              <button onClick={() => onDelete(event.id)} className={`opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg ${
                isDark ? "hover:bg-white/8 text-white/30 hover:text-white/60" : "hover:bg-[#ADBC9F]/50 text-[#436850]/70 hover:text-[#436850]"
              }`}><Trash2 className="w-3.5 h-3.5" /></button>
            )}
          </div>
          <div className={`rounded-xl p-3 border ${ isDark ? "border-amber-500/20 bg-amber-500/5" : "border-amber-200 bg-amber-50" }`}>
            <div className="flex items-center gap-2 mb-2">
              <Award className={`w-4 h-4 flex-shrink-0 ${ isDark ? "text-amber-400" : "text-amber-600" }`} />
              <span className={`text-sm font-bold ${ isDark ? "text-amber-300" : "text-amber-700" }`}>
                {event.pollResultTotalVotes === 0 ? "No votes cast" : `Winner: ${event.pollResultWinner}`}
              </span>
            </div>
            <div className="space-y-1.5">
              {event.pollResultBreakdown.map((opt, i) => (
                <div key={i} className="relative rounded-lg overflow-hidden">
                  <div
                    className="absolute inset-0 rounded-lg transition-all"
                    style={{
                      width: `${opt.pct}%`,
                      background: i === 0 && opt.votes > 0
                        ? isDark ? "oklch(0.55 0.15 80 / 0.25)" : "oklch(0.80 0.12 80 / 0.35)"
                        : isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)",
                    }}
                  />
                  <div className="relative flex items-center justify-between px-2.5 py-1.5">
                    <div className="flex items-center gap-1.5">
                      {i === 0 && opt.votes > 0 && <Award className={`w-3 h-3 flex-shrink-0 ${ isDark ? "text-amber-400" : "text-amber-600" }`} />}
                      <span className={`text-xs font-medium ${ i === 0 && opt.votes > 0 ? (isDark ? "text-amber-200" : "text-amber-700") : textMuted }`}>{opt.text}</span>
                    </div>
                    <span className={`text-xs font-bold tabular-nums ${ i === 0 && opt.votes > 0 ? (isDark ? "text-amber-300" : "text-amber-600") : textMuted }`}>
                      {opt.votes}v &middot; {opt.pct}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <p className={`text-xs mt-2 ${textMuted}`}>{event.pollResultTotalVotes} total vote{event.pollResultTotalVotes !== 1 ? "s" : ""}</p>
          </div>
        </div>
      )}
      {isRsvp && (
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${accentCls}`}>{cfg.icon}</div>
              <div>
                <p className={`text-xs ${textMuted}`}>{event.actorName} &middot; {relativeTime(event.createdAt)}</p>
                <p className={`text-sm font-semibold ${textMain} mt-0.5`}>{event.rsvpTitle}</p>
              </div>
            </div>
            {canDelete && (
              <button onClick={() => onDelete(event.id)} className={`opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg ${
                isDark ? "hover:bg-white/8 text-white/30 hover:text-white/60" : "hover:bg-[#ADBC9F]/50 text-[#436850]/70 hover:text-[#436850]"
              }`}><Trash2 className="w-3.5 h-3.5" /></button>
            )}
          </div>
          <div className={`rounded-xl p-3 border ${ isDark ? "border-white/08 bg-white/4" : "border-[#ADBC9F]/70 bg-[#FBFADA]/70" }`}>
            <div className="flex items-center gap-3 flex-wrap">
              {event.rsvpDate && (
                <span className={`flex items-center gap-1 text-xs ${textMuted}`}>
                  <Calendar className="w-3 h-3" />
                  {new Date(event.rsvpDate).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                </span>
              )}
              {event.rsvpVenue && (
                <span className={`flex items-center gap-1 text-xs ${textMuted}`}>
                  <MapPin className="w-3 h-3" />
                  {event.rsvpVenue}
                </span>
              )}
            </div>
          </div>
          {isMemberUser && userId ? (
            <div className="flex gap-2">
              {(["going", "maybe", "not_going"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => handleRsvp(s)}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                    userRsvp?.status === s
                      ? s === "going" ? "bg-[#4CAF50] text-white" : s === "maybe" ? "bg-amber-500 text-white" : isDark ? "bg-white/15 text-white/60" : "bg-[#ADBC9F] text-[#436850]"
                      : isDark ? "bg-white/07 text-white/50 hover:bg-white/12 hover:text-white" : "bg-[#ADBC9F]/40 text-[#436850] hover:bg-[#ADBC9F] hover:text-[#12372A]"
                  }`}
                >
                  {s === "going" ? "Going" : s === "maybe" ? "Maybe" : "Can't Go"}
                </button>
              ))}
            </div>
          ) : (
            <p className={`text-xs italic ${textMuted}`}>Join the club to RSVP</p>
          )}
          {(event.rsvpEntries ?? []).length > 0 && (
            <div className="space-y-1">
              {["going", "maybe", "not_going"].map((s) => {
                const group = (event.rsvpEntries ?? []).filter((r) => r.status === s);
                if (!group.length) return null;
                return (
                  <div key={s} className="flex items-center gap-2">
                    <span className={`text-xs font-semibold w-16 ${s === "going" ? "text-[#4CAF50]" : s === "maybe" ? "text-amber-500" : textMuted}`}>
                      {s === "going" ? "Going" : s === "maybe" ? "Maybe" : "Can't Go"} ({group.length})
                    </span>
                    <div className="flex -space-x-1.5">
                      {group.slice(0, 5).map((r) => (
                        <div key={r.userId} className="w-6 h-6 rounded-full border border-white/10 overflow-hidden" title={r.displayName}>
                          <PlayerAvatar
                            username={r.chesscomUsername ?? r.displayName}
                            platform={r.chesscomUsername ? "chesscom" : undefined}
                            name={r.displayName}
                            avatarUrl={r.avatarUrl ?? undefined}
                            size={24}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ))}
                      {group.length > 5 && (
                        <div className={`w-6 h-6 rounded-full border flex items-center justify-center text-[9px] font-bold ${ isDark ? "border-white/10 text-white/50 bg-white/08" : "border-[#ADBC9F] text-[#436850] bg-[#ADBC9F]/40" }`}>
                          +{group.length - 5}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ClubProfile() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { user } = useAuthContext();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  // Read optional ?tab= query param for deep-linking (e.g. from League Dashboard champion banner)
  type ClubTabId = "home" | "feed" | "events" | "members" | "album" | "leagues";
  const initialTab: ClubTabId = (() => {
    const search = typeof window !== "undefined" ? window.location.search : "";
    const p = new URLSearchParams(search);
    const t = p.get("tab");
    const valid: ClubTabId[] = ["home", "events", "members", "feed", "album", "leagues"];
    return valid.includes(t as ClubTabId) ? (t as ClubTabId) : "home";
  })();

  const [club, setClub] = useState<Club | null>(null);
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [tournaments, setTournaments] = useState<ClubTournament[]>([]);
  const [joined, setJoined] = useState(false);
  const [activeTab, setActiveTab] = useState<ClubTabId>(initialTab);
  // Tracks which tabs the user has visited — clears badge indicators on first visit
  const [seenTabs, setSeenTabs] = useState<Set<string>>(new Set([initialTab]));
  const handleTabChange = (tab: ClubTabId) => {
    setActiveTab(tab);
    setSeenTabs(prev => { const next = new Set(prev); next.add(tab); return next; });
  };
  // Redirect legacy "tournaments" deep-links to "events" tab
  useEffect(() => {
    if ((activeTab as string) === "tournaments") {
      setActiveTab("events");
      setEventsFilter("tournaments");
    }
  }, [activeTab]);
  // Sidebar is now always icon-only (Partiful-style rail)
  const [clubLeagues, setClubLeagues] = useState<Array<{ id: string; name: string; status: string; currentWeek: number; totalWeeks: number; playerCount: number; maxPlayers?: number }>>([]);
  const [leaguesLoading, setLeaguesLoading] = useState(false);
  const [showCreateLeague, setShowCreateLeague] = useState(false);
  const [leagueForm, setLeagueForm] = useState({ name: "", description: "", maxPlayers: 8, totalWeeks: 7 });
  const [leagueWizardStep, setLeagueWizardStep] = useState<1 | 2>(1);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [creatingLeague, setCreatingLeague] = useState(false);
  const [joining, setJoining] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  // Members tab state
  const [memberSearch, setMemberSearch] = useState("");
  const [memberSort, setMemberSort] = useState<"name" | "joined" | "role">("role");
  const [memberRoleFilter, setMemberRoleFilter] = useState<"all" | "owner" | "director" | "member">("all");
  const [memberPage, setMemberPage] = useState(1);
  const MEMBERS_PER_PAGE = 20;
  // Events tab filter
  const [eventsFilter, setEventsFilter] = useState<"all" | "events" | "tournaments">("all");
  // Tournaments tab filter
  const [tourneyFormatFilter, setTourneyFormatFilter] = useState<"all" | "swiss" | "roundrobin" | "arena">("all");
  // Share modal
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  // Contact owner modal
  const [showContactOwner, setShowContactOwner] = useState(false);
  // Track which draft leagues the current user has already requested to join
  const [requestedLeagueIds, setRequestedLeagueIds] = useState<Set<string>>(new Set());
  const [requestingLeagueId, setRequestingLeagueId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(() => {
    const p = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    return p.get("settings") === "1";
  });
  const [pendingAvatar, setPendingAvatar] = useState<string | null | undefined>(undefined);
  const [pendingBanner, setPendingBanner] = useState<string | null | undefined>(undefined);
  // Track broken images so we can fall back to placeholder gracefully
  const [avatarBroken, setAvatarBroken] = useState(false);
  const [bannerBroken, setBannerBroken] = useState(false);
  const [bannerUploading, setBannerUploading] = useState(false);
  const [bannerDragOver, setBannerDragOver] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [deleteStep, setDeleteStep] = useState<number>(0); // 0=hidden, 1=confirm prompt
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [transferStep, setTransferStep] = useState<number>(0); // 0=hidden, 1=select member, 2=confirm
  const [selectedTransferMemberId, setSelectedTransferMemberId] = useState("");
  const [isTransferring, setIsTransferring] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showPromoModal, setShowPromoModal] = useState(false);
  const [showClubQR, setShowClubQR] = useState(false);
  const [showNavMenu, setShowNavMenu] = useState(false);
  const [isLeavingClub, setIsLeavingClub] = useState(false);
  const [showWizard, setShowWizard] = useState(() => {
    const p = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    return p.get("create") === "1";
  });
  const [liveTournaments, setLiveTournaments] = useState<TournamentConfig[]>([]);
  const [clubRecaps, setClubRecaps] = useState<Array<{ id: string; slug: string; tournamentName: string | null; eventDate: string | null; playerCount: number | null; format: string | null; publishedAt: string | null }>>([]);
  const [feedEvents, setFeedEvents] = useState<FeedEvent[]>([]);
  const [announcementDraft, setAnnouncementDraft] = useState("");
  const [postingAnnouncement, setPostingAnnouncement] = useState(false);
  const [composerImageFile, setComposerImageFile] = useState<File | null>(null);
  const [composerImagePreview, setComposerImagePreview] = useState<string | null>(null);
  const composerImageInputRef = useRef<HTMLInputElement>(null);
  const [following, setFollowing] = useState(false);
  const [followingLoading, setFollowingLoading] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [clubEvents, setClubEvents] = useState<ClubEvent[]>([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [showAllPast, setShowAllPast] = useState(false);
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);
  const [eventForm, setEventForm] = useState({ title: "", description: "", startAt: "", venue: "", admissionNote: "", recurrence: "none" as "none" | "weekly" | "biweekly" | "monthly", recurrenceEndDate: "", coverImageUrl: "" });
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingEditCover, setUploadingEditCover] = useState(false);
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [editingEvent, setEditingEvent] = useState<ClubEvent | null>(null);
  const [editForm, setEditForm] = useState({ title: "", description: "", startAt: "", venue: "", admissionNote: "", recurrence: "none" as "none" | "weekly" | "biweekly" | "monthly", recurrenceEndDate: "", editScope: "this" as "this" | "all", coverImageUrl: "" });
  const [savingEdit, setSavingEdit] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingEvent, setDeletingEvent] = useState(false);
  const createEventDialogRef = useRef<HTMLDivElement>(null);
  const createEventTitleRef = useRef<HTMLInputElement>(null);
  const settingsDialogRef = useRef<HTMLDivElement>(null);
  const settingsCloseRef = useRef<HTMLButtonElement>(null);
  const editEventDialogRef = useRef<HTMLDivElement>(null);
  const editEventTitleRef = useRef<HTMLInputElement>(null);
  const deleteEventDialogRef = useRef<HTMLDivElement>(null);
  const deleteEventCancelRef = useRef<HTMLButtonElement>(null);
  const navDialogRef = useRef<HTMLDivElement>(null);
  const navCloseRef = useRef<HTMLButtonElement>(null);
  const closeCreateEvent = useCallback(() => setShowCreateEvent(false), []);
  const closeSettings = useCallback(() => setShowSettings(false), []);
  const closeEditEvent = useCallback(() => setEditingEvent(null), []);
  const closeDeleteEvent = useCallback(() => setConfirmDeleteId(null), []);
  const closeNavMenu = useCallback(() => setShowNavMenu(false), []);
  useAccessibleOverlay({ open: showCreateEvent, onClose: closeCreateEvent, containerRef: createEventDialogRef, initialFocusRef: createEventTitleRef });
  useAccessibleOverlay({ open: showSettings && Boolean(club), onClose: closeSettings, containerRef: settingsDialogRef, initialFocusRef: settingsCloseRef });
  useAccessibleOverlay({ open: Boolean(editingEvent), onClose: closeEditEvent, containerRef: editEventDialogRef, initialFocusRef: editEventTitleRef });
  useAccessibleOverlay({ open: Boolean(confirmDeleteId), onClose: closeDeleteEvent, containerRef: deleteEventDialogRef, initialFocusRef: deleteEventCancelRef });
  useAccessibleOverlay({ open: showNavMenu, onClose: closeNavMenu, containerRef: navDialogRef, initialFocusRef: navCloseRef });
  // RSVP hub state
  const [rsvpTick, setRsvpTick] = useState(0); // bumped after each RSVP toggle to force re-render
  const [expandedRsvpEventId, setExpandedRsvpEventId] = useState<string | null>(null); // which event's attendee drawer is open
  const [rsvpOverrideMap, setRsvpOverrideMap] = useState<Record<string, ClubEventRSVP[]>>({}); // eventId → latest RSVPs (merged from server)

  // Reset broken-image flags when the club's image URLs change (e.g., after owner uploads a new image)
  useEffect(() => { setAvatarBroken(false); }, [club?.avatarUrl]);
  useEffect(() => { setBannerBroken(false); }, [club?.bannerUrl]);

  // Subscribe to club mutations from ClubDashboard/Settings so this page
  // updates instantly (e.g., accent color, name, banner) without a refresh.
  useEffect(() => {
    if (!club) return;
    const unsub = onClubChange((changedId, patch) => {
      if (changedId === club.id) {
        setClub((prev) => prev ? { ...prev, ...patch } : prev);
      }
    });
    return unsub;
  }, [club?.id]);

  // Seed and load
  useEffect(() => {
    seedClubsIfEmpty();
    const id = params.id;

    const loadClubData = (found: Club) => {
      // Auto-redirect owners and directors to the ClubDashboard (/clubs/:id/home)
      // unless the URL already has ?settings=1 (direct deep-link to settings modal)
      if (user) {
        const membership = getMembership(found.id, user.id);
        const isOwnerOrDir = membership?.role === "owner" || membership?.role === "director";
        const hasSettingsParam = new URLSearchParams(window.location.search).get("settings") === "1";
        if (isOwnerOrDir && !hasSettingsParam) {
          navigate(`/clubs/${encodeURIComponent(id)}/home`);
          return;
        }
      }
      setClub(found);
      const clubMembers = getClubMembers(found.id);
      setMembers(clubMembers);
      setTournaments(getClubTournaments(found.id));
      setLiveTournaments(listTournamentsByClub(found.id));
      // Fetch published recaps for this club
      fetch(`/api/club/${encodeURIComponent(found.id)}/recaps`)
        .then((r) => r.ok ? r.json() : [])
        .then((data) => setClubRecaps(Array.isArray(data) ? data : []))
        .catch(() => {});
      if (user) {
        setJoined(isMember(found.id, user.id));
        setFollowing(isFollowing(found.id, user.id));
      }
      setFollowerCount(getFollowerCount(found.id));
      seedFeedIfEmpty(
        found.id,
        found.name,
        found.ownerName,
        found.foundedAt,
        clubMembers.map((m) => ({
          displayName: m.displayName,
          joinedAt: m.joinedAt,
          avatarUrl: m.avatarUrl,
        }))
      );
      setFeedEvents(listFeedEvents(found.id));
      setClubEvents(listClubEvents(found.id).filter((e) => e.isPublished));
      // Members and owners both receive the canonical server event set; local
      // storage remains only as an offline fallback.
      syncEventsFromServer(found.id)
        .then((events) => setClubEvents(events.filter((event) => event.isPublished)))
        .catch(() => {});
    };

    // Always fetch from server first — localStorage seed data can be stale
    // (IDs may not match the DB), so we only fall back to it when the server
    // is unreachable (offline / network error) or returns a 404 (local-only club).
    fetch(`/api/clubs/${encodeURIComponent(id)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((serverClub: Club | null) => {
        if (serverClub) {
          loadClubData(serverClub);
        } else {
          // Server returned 404 — fall back to localStorage (local-only clubs)
          const local = getClub(id) ?? getClubBySlug(id);
          if (local) loadClubData(local);
          // If still null, the "Club not found" UI will render
        }
      })
      .catch(() => {
        // Network error — fall back to localStorage (offline support)
        const local = getClub(id) ?? getClubBySlug(id);
        if (local) loadClubData(local);
      });
  }, [params.id, user]);

  // Poll-close + scheduled-publish interval: check every 30 seconds
  // MUST be declared before any early return to comply with Rules of Hooks
  const clubId = club?.id ?? null;

  // Derive membership flags before the early return so useClubPresence
  // is always called unconditionally (Rules of Hooks).
  const myMembershipEarly = club && user ? getMembership(club.id, user.id) : null;
  const isOwnerEarly = myMembershipEarly?.role === "owner";
  const isDirectorEarly = myMembershipEarly?.role === "director";

  // Real-time presence: polls every 30s, sends heartbeat every 60s if member
  // Declared here (before any early return) to satisfy Rules of Hooks.
  const { onlineCount } = useClubPresence(
    clubId ?? "",
    !!(joined || isOwnerEarly || isDirectorEarly)
  );

  useEffect(() => {
    if (!clubId) return;
    // Run once on mount
    const didPublish = publishScheduledPolls(clubId);
    const didClose = checkAndCloseExpiredPolls(clubId);
    if (didPublish || didClose) {
      setFeedEvents(listFeedEvents(clubId));
    }
    const timer = setInterval(() => {
      const p = publishScheduledPolls(clubId);
      const c = checkAndCloseExpiredPolls(clubId);
      if (p || c) setFeedEvents(listFeedEvents(clubId));
    }, 30_000);
    return () => clearInterval(timer);
  }, [clubId]);

  // Sync canonical events and their RSVPs whenever the Events tab is opened.
  useEffect(() => {
    if (activeTab !== "events" || !clubId) return;
    let cancelled = false;
    syncEventsFromServer(clubId)
      .then((events) => {
        if (cancelled) return [];
        const published = events.filter((event) => event.isPublished);
        setClubEvents(published);
        return Promise.all(
          published
            .filter((event) => new Date(event.startAt) >= new Date())
            .map((event) => syncRSVPsFromServer(clubId, event.id).then((rsvps) => ({ eventId: event.id, rsvps })))
        );
      })
      .then((results) => {
        if (cancelled || !results.length) return;
        setRsvpOverrideMap((prev) => {
          const next = { ...prev };
          results.forEach(({ eventId, rsvps }) => { next[eventId] = rsvps; });
          return next;
        });
        setRsvpTick((tick) => tick + 1);
      })
      .catch(() => { /* server unavailable — local data still shown */ });
    return () => { cancelled = true; };
  }, [activeTab, clubId]);

  // Fetch leagues when the leagues tab is opened
  useEffect(() => {
    if (activeTab !== "leagues" || !clubId) return;
    setLeaguesLoading(true);
    fetch(`/api/leagues/club/${encodeURIComponent(clubId)}`, { credentials: "include" })
      .then((r) => r.ok ? r.json() : [])
      .then((data: Array<{ id: string; name: string; status: string; currentWeek: number; totalWeeks: number; playerCount: number; maxPlayers?: number }>) => {
        setClubLeagues(data);
      })
      .catch(() => {})
      .finally(() => setLeaguesLoading(false));
  }, [activeTab, clubId]);

  // ── OG / SEO meta tags ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!club) return;
    const prev = document.title;
    document.title = `${club.name} — OTB Chess`;
    // Update / create OG meta tags
    const setMeta = (property: string, content: string) => {
      let el = document.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute("property", property);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };
    const setNameMeta = (name: string, content: string) => {
      let el = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute("name", name);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };
    const description = club.description
      ? club.description.slice(0, 160)
      : `${club.name} is an OTB chess club with ${club.memberCount} members. Join on ChessOTB.club.`;
    const ogImage = club.bannerUrl ?? club.avatarUrl ?? "https://chessotb.club/og-default.png";
    setMeta("og:title", `${club.name} — OTB Chess`);
    setMeta("og:description", description);
    setMeta("og:image", ogImage);
    setMeta("og:url", window.location.href);
    setMeta("og:type", "website");
    setMeta("og:site_name", "ChessOTB.club");
    setNameMeta("description", description);
    setNameMeta("twitter:card", "summary_large_image");
    setNameMeta("twitter:title", `${club.name} — OTB Chess`);
    setNameMeta("twitter:description", description);
    setNameMeta("twitter:image", ogImage);
    return () => {
      document.title = prev;
    };
  }, [club?.id, club?.name, club?.description, club?.bannerUrl, club?.avatarUrl, club?.memberCount]);

  // Membership aliases must stay above the loading return so ClubProfile keeps
  // its hook ordering stable before and after club data arrives.
  const _myMembership = myMembershipEarly;
  const isOwner = isOwnerEarly;
  const isDirector = isDirectorEarly;

  if (!club) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center gap-6 px-6 ${isDark ? "bg-[#0d1a0f]" : "bg-[#FBFADA]"}`}>
        <NavLogo />
        <div className={`rounded-3xl border p-8 max-w-sm w-full text-center ${
          isDark ? "bg-[#0f1f12] border-white/10" : "bg-[#F0F5E8] border-[#ADBC9F]"
        }`}>
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 ${
            isDark ? "bg-amber-500/15" : "bg-amber-50"
          }`}>
            <span className="text-2xl">&#9816;</span>
          </div>
          <h2 className={`text-base font-bold mb-2 ${isDark ? "text-white" : "text-[#12372A]"}`}>
            Club not found
          </h2>
          <p className={`text-sm mb-5 leading-relaxed ${isDark ? "text-white/50" : "text-[#436850]"}`}>
            This club may have been deleted or created before a platform update. You can remove it from your profile to keep things tidy.
          </p>
          <div className="flex flex-col gap-2">
            <Link
              href="/profile"
              className="w-full py-2.5 rounded-2xl text-sm font-semibold bg-[#4CAF50] hover:bg-[#43a047] text-white transition text-center block"
            >
              Manage my clubs
            </Link>
            <Link
              href="/clubs"
              className={`w-full py-2.5 rounded-2xl text-sm font-medium transition text-center block ${
                isDark ? "bg-white/8 hover:bg-white/12 text-white/70" : "bg-[#ADBC9F]/40 hover:bg-[#ADBC9F] text-[#436850]"
              }`}
            >
              Browse all clubs
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const handleJoin = async () => {
    if (!user) {
      setPendingAction(() => handleJoin);
      setAuthOpen(true);
      return;
    }
    setJoining(true);
    // Persist to server (non-blocking — localStorage join still happens immediately)
    apiJoinClub(club.id, {
      displayName: user.displayName,
      chesscomUsername: user.chesscomUsername,
      lichessUsername: user.lichessUsername,
      avatarUrl: user.avatarUrl,
    }).catch(() => { /* server unavailable — localStorage is the fallback */ });
    joinClub(club.id, {
      userId: user.id,
      displayName: user.displayName,
      chesscomUsername: user.chesscomUsername,
      lichessUsername: user.lichessUsername,
      avatarUrl: user.avatarUrl,
    });
    recordMemberJoin(club.id, user.displayName, user.avatarUrl ?? null);
    setJoined(true);
    setMembers(getClubMembers(club.id));
    setFeedEvents(listFeedEvents(club.id));
    setClub((prev) => prev ? { ...prev, memberCount: prev.memberCount + 1 } : prev);
    setJoining(false);
    toast.success(`You joined ${club.name}!`);
  };

  const handleLeave = async () => {
    if (!user || isOwner) return;
    setJoining(true);
    // Persist leave to server
    apiLeaveClub(club.id, user.id).catch(() => { /* server unavailable */ });
    leaveClub(club.id, user.id);
    recordMemberLeave(club.id, user.displayName);
    setJoined(false);
    setMembers(getClubMembers(club.id));
    setFeedEvents(listFeedEvents(club.id));
    setClub((prev) => prev ? { ...prev, memberCount: Math.max(0, prev.memberCount - 1) } : prev);
    setJoining(false);
    toast("Left " + club.name);
  };

  const handlePostAnnouncement = async () => {
    if (!user || !announcementDraft.trim() || !club) return;
    setPostingAnnouncement(true);
    // Convert image file to data URL if present
    let imageUrl: string | null = null;
    if (composerImageFile) {
      imageUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.readAsDataURL(composerImageFile);
      });
    }
    await new Promise((r) => setTimeout(r, 200));
    postAnnouncement(club.id, user.displayName, announcementDraft.trim(), user.avatarUrl ?? null, imageUrl, user.chesscomUsername ?? null);
    setFeedEvents(listFeedEvents(club.id));
    setAnnouncementDraft("");
    setComposerImageFile(null);
    setComposerImagePreview(null);
    setPostingAnnouncement(false);
    toast.success("Announcement posted!");
  };

  const handleReaction = (eventId: string, emoji: string) => {
    if (!user || !club) return;
    toggleReaction(club.id, eventId, emoji, user.id);
    setFeedEvents(listFeedEvents(club.id));
  };

  const handleDeleteFeedEvent = (eventId: string) => {
    if (!club) return;
    deleteFeedEvent(club.id, eventId);
    setFeedEvents(listFeedEvents(club.id));
  };

  const refreshFeed = () => {
    if (!club) return;
    // Auto-close any expired polls before refreshing
    checkAndCloseExpiredPolls(club.id);
    setFeedEvents(listFeedEvents(club.id));
  };

  const handleFollow = async () => {
    if (!user) {
      setAuthOpen(true);
      return;
    }
    setFollowingLoading(true);
    await new Promise((r) => setTimeout(r, 300));
    if (following) {
      unfollowClub(club.id, user.id);
      setFollowing(false);
      setFollowerCount((n) => Math.max(0, n - 1));
      toast("Unfollowed " + club.name);
    } else {
      followClub(club.id, user.id);
      setFollowing(true);
      setFollowerCount((n) => n + 1);
      toast.success("Following " + club.name + "!");
    }
    setFollowingLoading(false);
  };

  const handleShare = () => {
    setShowShareModal(true);
  };

  // ── Hero banner upload handlers ─────────────────────────────────────────────
  async function handleBannerFile(file: File) {
    if (!club) return;
    const err = validateBannerFile(file);
    if (err) { toast.error(err); return; }
    setBannerUploading(true);
    try {
      const dataUrl = await cropBannerImage(file);
      const { url } = await apiFetch<{ url: string }>("/api/clubs/upload-banner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataUrl }),
      });
      await apiFetch(`/api/clubs/${club.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bannerUrl: url }),
      });
      updateClub(club.id, { bannerUrl: url });
      setClub((prev) => prev ? { ...prev, bannerUrl: url } : prev);
      toast.success("Banner updated!");
    } catch {
      toast.error("Failed to upload banner. Please try again.");
    } finally {
      setBannerUploading(false);
    }
  }

  async function handleRemoveBannerHero() {
    if (!club) return;
    setBannerUploading(true);
    try {
      await apiFetch(`/api/clubs/${club.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bannerUrl: null }),
      });
      updateClub(club.id, { bannerUrl: null });
      setClub((prev) => prev ? { ...prev, bannerUrl: null } : prev);
      toast.success("Banner removed.");
    } catch {
      toast.error("Failed to remove banner. Please try again.");
    } finally {
      setBannerUploading(false);
    }
  }

  // ── Derived display values ──────────────────────────────────────────────────
  const flag = COUNTRY_FLAGS[club.country] ?? "🌍";
  const categoryLabel = CATEGORY_LABELS[club.category] ?? "Chess Club";
  const completedTournaments = tournaments.filter((t) => t.status === "completed");
  const upcomingTournaments = tournaments.filter((t) => t.status === "upcoming" || t.status === "active");
  // Live tournaments created via the wizard and linked to this club
  const liveUpcoming = liveTournaments.filter((t) => {
    const d = new Date(t.date || Date.now());
    return d >= new Date(new Date().toDateString());
  });
  const livePast = liveTournaments.filter((t) => {
    const d = new Date(t.date || Date.now());
    return d < new Date(new Date().toDateString());
  });
  const hasAnyTournaments = tournaments.length > 0 || liveTournaments.length > 0;

  // ── Banner gradient theme (per-category, matches carousel & leaderboard) ─────
  const bannerTheme = (() => {
    const cat = club.category ?? "other";
    const mode = isDark ? "dark" : "light";
    if (CATEGORY_BANNER_THEME[cat]) return CATEGORY_BANNER_THEME[cat][mode];
    const idx = club.id.charCodeAt(club.id.length - 1) % FALLBACK_BANNER_GRADS.length;
    const fallbackGrad = FALLBACK_BANNER_GRADS[idx][mode];
    return { grad: fallbackGrad, badge: CATEGORY_BANNER_THEME.other[mode].badge };
  })();

  // ── Colour palette ──────────────────────────────────────────────────────────
  // ── Unified color system ─────────────────────────────────────────────────
  // Dark:  deep forest-green base with subtle chroma steps for depth
  // Light: clean warm-white base with soft sage tints — no yellow-cream
  const bg         = isDark ? "bg-[oklch(0.14_0.04_145)]"  : "bg-[oklch(0.97_0.01_145)]";
  const card       = isDark ? "bg-[oklch(0.19_0.05_145)]"  : "bg-[oklch(1.00_0.00_145)]";
  const cardBorder = isDark ? "border-[oklch(0.27_0.06_145)]" : "border-[oklch(0.88_0.03_145)]";
  const textMain   = isDark ? "text-[oklch(0.95_0.02_145)]" : "text-[oklch(0.18_0.06_145)]";
  const textMuted  = isDark ? "text-[oklch(0.60_0.04_145)]" : "text-[oklch(0.45_0.05_145)]";
  const divider    = isDark ? "border-[oklch(0.27_0.06_145)]" : "border-[oklch(0.88_0.03_145)]";
  const tabActive = isDark ? "bg-[#4CAF50]/15 text-[#4CAF50]" : "bg-[#436850]/10 text-[#436850]";
  const tabInactive = isDark ? "text-white/50 hover:text-white/80" : "text-[#436850] hover:text-[#12372A]";
  // Use the club's stored accent color — falls back to platform defaults if not set.
  // Because `club` is in React state and updated by the onClubChange subscriber,
  // this re-derives automatically whenever the owner saves a new color in Settings.
  const accent = club?.accentColor ?? (isDark ? "#4CAF50" : "#436850");

  const clubBgForProfile = club.backgroundImage ?? club.bannerUrl ?? null;
  const useShaderDefault = !clubBgForProfile;

  return (
    <div className={`min-h-screen ${useShaderDefault ? "" : bg}`} style={{ background: useShaderDefault ? "transparent" : undefined }}>
      {/* Default animated shader background */}
      {useShaderDefault && (
        <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
          <div className="absolute inset-0" style={{ opacity: 0.75 }}>
            <ShaderBackground className="w-full h-full" />
          </div>
          <div className="absolute inset-0" style={{ background: "oklch(0.10 0.05 145 / 0.50)" }} />
        </div>
      )}
      <div className="flex h-[100dvh] w-full max-w-full overflow-hidden overscroll-x-none">

        {/* ── LEFT SIDEBAR — Partiful-style: icon rail expands to icon+label rows on hover ─── */}
        <aside
          className="hidden lg:flex flex-col flex-shrink-0 h-full group/sidebar"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            bottom: 0,
            width: "68px",
            transition: "width 0.26s cubic-bezier(0.4,0,0.2,1)",
            backgroundImage: isDark
              ? `repeating-conic-gradient(oklch(0.17 0.05 145) 0% 25%, oklch(0.13 0.04 145) 0% 50%)`
              : `repeating-conic-gradient(oklch(0.16 0.06 145) 0% 25%, oklch(0.12 0.04 145) 0% 50%)`,
            backgroundSize: "12px 12px",
            borderRight: `1px solid rgba(255,255,255,0.07)`,
            overflow: "hidden",
            zIndex: 40,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.width = "210px"; }}
          onMouseLeave={(e) => { e.currentTarget.style.width = "68px"; }}
        >
          {/* Top: !! thumbnail icon + OTB!! logo on hover */}
          {/* Logo crossfade: !! thumbnail fades out, OTB!! logo fades in on hover */}
          <div className="pt-5 pb-3 px-2 flex-shrink-0">
            <button
              onClick={() => navigate("/clubs")}
              className="relative flex items-center justify-start w-full bg-transparent border-none p-0 cursor-pointer"
              style={{ height: "60px" }}
              title="ChessOTB.Club — Back to Clubs"
            >
              {/* Thumbnail logo — single logo for both collapsed and expanded sidebar */}
              <img
                src="/manus-storage/OTBTHUMBNAILLOGO_64dac1d1.png"
                alt="OTB!!"
                className="w-14 h-14 object-contain flex-shrink-0"
              />
            </button>
          </div>

          {/* Nav items — vertically centered, Partiful-style horizontal icon+label rows */}
          <nav aria-label="Club navigation" className="flex flex-col gap-0 flex-1 justify-center px-2">
            {(joined
              ? (["home", "feed", "events", "members", "album", "leagues"] as const)
              : (["home", "feed", "events", "members"] as const)
            ).map((t) => {
              const isActive = activeTab === t;
              const iconMap: Record<string, React.ReactNode> = {
                home: <OtbHome size={22} accentColor={isActive ? accent : undefined} />,
                feed: <OtbFeed size={22} accentColor={isActive ? accent : undefined} />,
                events: <OtbEvents size={22} accentColor={isActive ? accent : undefined} />,
                members: <OtbMembers size={22} accentColor={isActive ? accent : undefined} />,
                album: <OtbAlbum size={22} accentColor={isActive ? accent : undefined} />,
                leagues: <OtbLeagues size={22} accentColor={isActive ? accent : undefined} />,
                about: <Info size={22} color={isActive ? accent : undefined} />,
              };
              const labelMap: Record<string, string> = {
                home: "Home",
                feed: "Feed",
                events: "Events",
                members: "Members",
                album: "Album",
                leagues: "Leagues",
                about: "About",
              };
              const badgeMap: Record<string, number> = {
                events: clubEvents.length + tournaments.length + liveTournaments.length,
                feed: feedEvents.length,
                leagues: clubLeagues.length,
              };
              const badge = seenTabs.has(t) ? 0 : (badgeMap[t] ?? 0);
              return (
                <button
                  key={t}
                  onClick={() => handleTabChange(t)}
                  className="relative flex flex-row items-center gap-3 rounded-xl transition-all duration-[240ms] ease-[cubic-bezier(0.4,0,0.2,1)] text-left"
                  style={{
                    height: "64px",
                    minWidth: "44px",
                    paddingLeft: "14px",
                    paddingRight: "10px",
                    background: "transparent",
                    color: isActive ? "rgba(255,255,255,1)" : "rgba(255,255,255,0.38)",
                  }}
                  onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.color = "rgba(255,255,255,0.85)"; } }}
                  onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.color = "rgba(255,255,255,0.38)"; } }}
                  aria-label={labelMap[t]}
                >
                  {/* Icon — fixed width so it doesn't shift on expand */}
                  <span className={`relative flex-shrink-0 w-7 flex items-center justify-center otb-icon${isActive ? " otb-icon--active" : ""}`}>
                    {iconMap[t]}
                    {badge > 0 && (
                      <span
                        className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold"
                        style={{ background: "#ef4444", color: "#fff" }}
                      >
                        {badge > 9 ? "9+" : badge}
                      </span>
                    )}
                  </span>
                  {/* Label — slides in to the right, stays on same row as icon */}
                  <span
                    className="text-[17px] font-bold tracking-tight whitespace-nowrap overflow-hidden transition-all duration-[240ms] ease-[cubic-bezier(0.4,0,0.2,1)] max-w-0 opacity-0 group-hover/sidebar:max-w-[140px] group-hover/sidebar:opacity-100"
                    style={{ color: "inherit", fontFamily: "'Inter', sans-serif", letterSpacing: "-0.01em" }}
                  >
                    {labelMap[t]}
                  </span>
                </button>
              );
            })}
          </nav>

          {/* Bottom: utility icons */}
          <div className="pb-5 flex flex-col gap-0.5 px-2">
            {/* Divider */}
            <div className="h-px mb-2 mx-1" style={{ background: "rgba(255,255,255,0.08)" }} />

            {/* Avatar / Profile dropdown — replaces the old Share button */}
            <div
              className="relative flex flex-row items-center gap-3 rounded-xl"
              style={{ height: "44px", paddingLeft: "8px", paddingRight: "16px" }}
            >
              <AvatarNavDropdown currentPage="Clubs" variant="sidebar" />
            </div>

            {(isOwner || isDirector) && (
              <button
                onClick={() => { setPendingAvatar(undefined); setShowSettings(true); }}
                className="relative flex flex-row items-center gap-3 rounded-xl transition-all duration-[240ms] ease-[cubic-bezier(0.4,0,0.2,1)]"
                style={{ height: "52px", paddingLeft: "14px", paddingRight: "10px", color: "rgba(255,255,255,0.38)" }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.85)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.38)"; }}
                aria-label="Settings"
              >
                <span className="flex-shrink-0 w-7 flex items-center justify-center"><MoreHorizontal size={24} /></span>
                <span className="text-[15px] font-semibold tracking-wide uppercase whitespace-nowrap overflow-hidden transition-all duration-[240ms] ease-[cubic-bezier(0.4,0,0.2,1)] max-w-0 opacity-0 group-hover/sidebar:max-w-[140px] group-hover/sidebar:opacity-100" style={{ color: "inherit", fontFamily: "'Inter', sans-serif", letterSpacing: "0.06em" }}>Settings</span>
              </button>
            )}


          </div>
        </aside>

        {/* ── MAIN CONTENT AREA ────────────────────────────────────────── */}
        {/* Sidebar is absolutely positioned so it overlays without shifting content */}
        <div className="flex-1 flex flex-col min-w-0">

          {/* ── SCROLLABLE CONTENT ─────────────────────────────────────── */}
          <div className="flex-1 min-w-0 overflow-x-hidden overflow-y-auto pb-[calc(7rem+env(safe-area-inset-bottom,0px))] lg:pb-6">
            {/* ── PADDED HEADER AREA ─────────────────────────────────────── */}
            <div className="px-4 lg:pl-[88px] lg:pr-8 xl:pl-[96px] xl:pr-12 pt-5 pb-0">
              <div className="max-w-5xl mx-auto">
                {/* ── Contained Club Hero ──────────────────────────────── */}
                <ClubHero
                  name={club.name}
                  avatarUrl={club.avatarUrl}
                  bannerUrl={club.bannerUrl}
                  backgroundImage={club.backgroundImage ?? null}
                  silkSpeed={club.silkSpeed ?? null}
                  silkColor={club.silkColor ?? null}
                  silkNoise={club.silkNoise ?? null}
                  avatarBroken={avatarBroken}
                  flag={flag}
                  accent={accent}
                  isVerified={club.isVerified}
                  beginnerFriendly={club.beginnerFriendly}
                  isPublic={club.isPublic}
                  location={club.location}
                  memberCount={club.memberCount}
                  tournamentCount={club.tournamentCount}
                  leagueCount={clubLeagues.length}
                  followerCount={followerCount}
                  onlineCount={onlineCount}
                  website={club.website}
                  instagram={club.instagram}
                  twitter={club.twitter}
                  discord={club.discord}
                  youtube={club.youtube}
                  isOwner={isOwner}
                  isDirector={isDirector}
                  joined={joined}
                  joining={joining}
                  following={following}
                  followingLoading={followingLoading}
                  onJoin={handleJoin}
                  onLeave={handleLeave}
                  onFollow={handleFollow}
                  bannerUploading={bannerUploading}
                  bannerDragOver={bannerDragOver}
                  onBannerFile={handleBannerFile}
                  onRemoveBanner={handleRemoveBannerHero}
                  onBannerDragOver={setBannerDragOver}
                  isDark={isDark}
                  onCreatePromo={(isOwner || isDirector) ? () => setShowPromoModal(true) : undefined}
                  onShareQR={(isOwner || isDirector) ? () => setShowClubQR(true) : undefined}
                />

                {/* Horizontal tab bar removed — mobile uses the fixed bottom nav only */}
              </div>
            </div>

            {/* ── LEGACY BANNER BLOCK (removed — kept as empty placeholder for old upload input) ── */}
            {(isOwner || isDirector) && (
              <input
                id="banner-upload-profile"
                aria-label="Upload club banner"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleBannerFile(file);
                  e.target.value = "";
                }}
              />
            )}


            {/* ── PADDED CONTENT BELOW HERO ─────────────────────────── */}
            <div className="px-4 lg:pl-[88px] lg:pr-8 xl:pl-[96px] xl:pr-12 py-5">
              <div className="max-w-5xl mx-auto">

        {/* ── Home tab (overview) ─────────────────────────────────────────── */}
        {activeTab === "home" && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Onboarding checklist for new club owners */}
            {isOwner && club.memberCount <= 3 && (() => {
              const steps = [
                { done: !!club.description && club.description.length > 20, label: "Write a club description" },
                { done: !!club.bannerUrl, label: "Add a banner image" },
                { done: club.memberCount > 1, label: "Invite your first member" },
                { done: (liveTournaments.length + (tournaments.filter(t => t.status === "upcoming" || t.status === "active").length)) > 0, label: "Host a tournament" },
              ];
              const completed = steps.filter((s) => s.done).length;
              if (completed === steps.length) return null;
              return (
                <div className={`rounded-3xl border ${isDark ? "border-[#4CAF50]/25 bg-[#4CAF50]/5" : "border-[#436850]/20 bg-[#436850]/5"} p-5`}>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h2 className={`text-sm font-bold ${textMain}`} style={{ fontFamily: "'Clash Display', sans-serif" }}>Set Up Your Club</h2>
                      <p className={`text-xs ${textMuted} mt-0.5`}>{completed} of {steps.length} steps complete</p>
                    </div>
                    <div className={`text-xs font-bold px-2.5 py-1 rounded-full ${isDark ? "bg-[#4CAF50]/15 text-[#4CAF50]" : "bg-[#436850]/10 text-[#436850]"}`}>{Math.round((completed / steps.length) * 100)}%</div>
                  </div>
                  <div className={`h-1.5 rounded-full mb-4 ${isDark ? "bg-white/10" : "bg-[#ADBC9F]"}`}>
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(completed / steps.length) * 100}%`, background: "oklch(0.55 0.13 145)" }} />
                  </div>
                  <div className="space-y-2">
                    {steps.map((step, i) => (
                      <div key={i} className={`flex items-center gap-3 text-sm ${step.done ? textMuted : textMain}`}>
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 border ${step.done ? isDark ? "bg-[#4CAF50]/20 border-[#4CAF50]/40" : "bg-[#436850]/15 border-[#436850]/30" : isDark ? "border-white/20 bg-transparent" : "border-[#ADBC9F] bg-transparent"}`}>
                          {step.done && <Check className={`w-3 h-3 ${isDark ? "text-[#4CAF50]" : "text-[#436850]"}`} />}
                        </div>
                        <span className={step.done ? "line-through opacity-50" : ""}>{step.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* About — full card (description + details) */}
            <div className={`rounded-3xl border ${cardBorder} ${card} p-5`}>
              <div className="flex items-center justify-between mb-3">
                <h3 className={`text-sm font-semibold uppercase tracking-wider ${isDark ? "text-white/40" : "text-[#436850]"}`}>About</h3>
                {(isOwner || isDirector) && (
                  <button
                    onClick={() => setShowEditModal(true)}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                      isDark
                        ? "bg-white/10 text-white hover:bg-white/20"
                        : "bg-[#ADBC9F]/40 text-[#12372A] hover:bg-[#ADBC9F]"
                    }`}
                  >
                    Edit
                  </button>
                )}
              </div>
              {club.description && (
                <p className={`text-sm leading-relaxed mb-4 ${isDark ? "text-white/80" : "text-[#12372A]/85"}`}>
                  {club.description}
                </p>
              )}
              <div className={`grid grid-cols-2 gap-3 pt-3 border-t ${isDark ? "border-white/8" : "border-[#ADBC9F]/50"}`}>
                {club.location && (
                  <div className="flex items-center gap-2">
                    <MapPin className={`w-3.5 h-3.5 flex-shrink-0 ${isDark ? "text-[#4CAF50]" : "text-[#436850]"}`} />
                    <span className={`text-xs ${isDark ? "text-white/70" : "text-[#12372A]/75"}`}>{flag} {club.location}</span>
                  </div>
                )}
                {club.category && (
                  <div className="flex items-center gap-2">
                    <Hash className={`w-3.5 h-3.5 flex-shrink-0 ${isDark ? "text-[#4CAF50]" : "text-[#436850]"}`} />
                    <span className={`text-xs ${isDark ? "text-white/70" : "text-[#12372A]/75"}`}>{categoryLabel}</span>
                  </div>
                )}
                {club.foundedAt && (
                  <div className="flex items-center gap-2">
                    <Calendar className={`w-3.5 h-3.5 flex-shrink-0 ${isDark ? "text-[#4CAF50]" : "text-[#436850]"}`} />
                    <span className={`text-xs ${isDark ? "text-white/70" : "text-[#12372A]/75"}`}>{formatDate(club.foundedAt)}</span>
                  </div>
                )}
                {club.ownerName && (
                  <div className="flex items-center gap-2">
                    <Crown className={`w-3.5 h-3.5 flex-shrink-0 ${isDark ? "text-amber-400" : "text-amber-600"}`} />
                    <span className={`text-xs ${isDark ? "text-white/70" : "text-[#12372A]/75"}`}>{club.ownerName}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Upcoming events preview */}
            {(() => {
              const upcoming = [
                ...clubEvents.filter(e => new Date(e.startAt) >= new Date()).slice(0, 2).map(e => ({ type: "event" as const, title: e.title, date: e.startAt })),
                ...liveTournaments.filter(t => new Date(t.date || Date.now()) >= new Date(new Date().toDateString())).slice(0, 2).map(t => ({ type: "tournament" as const, title: t.name, date: t.date || new Date().toISOString() })),
              ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(0, 3);
              if (upcoming.length === 0) return null;
              return (
                <div className={`rounded-3xl border ${cardBorder} ${card} overflow-hidden`}>
                  <div className={`px-5 py-4 border-b ${divider} flex items-center justify-between`}>
                    <div className="flex items-center gap-2">
                      <Calendar className={`w-4 h-4 ${isDark ? "text-[#4CAF50]" : "text-[#436850]"}`} />
                      <h3 className={`text-sm font-semibold uppercase tracking-wider ${isDark ? "text-white/40" : "text-[#436850]"}`}>Upcoming</h3>
                    </div>
                    <button onClick={() => handleTabChange("events")} className={`text-xs font-semibold ${isDark ? "text-[#4CAF50]" : "text-[#436850]"}`}>View all →</button>
                  </div>
                  <div className={`divide-y ${isDark ? "divide-white/5" : "divide-gray-100"}`}>
                    {upcoming.map((item, i) => (
                      <div key={i} className={`flex items-center gap-3 px-5 py-3`}>
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${item.type === "tournament" ? isDark ? "bg-amber-500/15" : "bg-amber-50" : isDark ? "bg-[#4CAF50]/15" : "bg-[#436850]/10"}`}>
                          {item.type === "tournament" ? <Trophy className={`w-4 h-4 ${isDark ? "text-amber-400" : "text-amber-600"}`} /> : <Calendar className={`w-4 h-4 ${isDark ? "text-[#4CAF50]" : "text-[#436850]"}`} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium truncate ${textMain}`}>{item.title}</p>
                          <p className={`text-xs ${textMuted}`}>{new Date(item.date).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Recent activity preview */}
            {feedEvents.length > 0 && (
              <div className={`rounded-3xl border ${cardBorder} ${card} overflow-hidden`}>
                <div className={`px-5 py-4 border-b ${divider} flex items-center justify-between`}>
                  <div className="flex items-center gap-2">
                    <Zap className={`w-4 h-4 ${isDark ? "text-[#4CAF50]" : "text-[#436850]"}`} />
                    <h3 className={`text-sm font-semibold uppercase tracking-wider ${isDark ? "text-white/40" : "text-[#436850]"}`}>Recent Activity</h3>
                  </div>
                  <button onClick={() => handleTabChange("feed")} className={`text-xs font-semibold ${isDark ? "text-[#4CAF50]" : "text-[#436850]"}`}>See all →</button>
                </div>
                <div className={`divide-y ${isDark ? "divide-white/5" : "divide-gray-100"} max-h-[200px] overflow-hidden`}>
                  {feedEvents.slice(0, 3).map((event) => (
                    <div key={event.id} className="px-5 py-3 flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isDark ? "bg-[#4CAF50]" : "bg-[#436850]"}`} />
                      <p className={`text-sm truncate flex-1 ${textMain}`}>{event.description || event.detail?.slice(0, 60) || "Activity"}</p>
                      <span className={`text-xs flex-shrink-0 ${textMuted}`}>{new Date(event.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top members preview */}
            {members.length > 0 && (() => {
              const ownerFirst = [...members].sort((a, b) => {
                const ro = { owner: 0, director: 1, member: 2 };
                return (ro[a.role as keyof typeof ro] ?? 2) - (ro[b.role as keyof typeof ro] ?? 2);
              });
              const top = ownerFirst.slice(0, 4);
              return (
                <div className={`rounded-3xl border ${cardBorder} ${card} overflow-hidden`}>
                  <div className={`px-5 py-4 border-b ${divider} flex items-center justify-between`}>
                    <div className="flex items-center gap-2">
                      <Users className={`w-4 h-4 ${isDark ? "text-[#4CAF50]" : "text-[#436850]"}`} />
                      <h3 className={`text-sm font-semibold uppercase tracking-wider ${isDark ? "text-white/40" : "text-[#436850]"}`}>Members</h3>
                      <span className={`text-xs ${textMuted}`}>{members.length}</span>
                    </div>
                    <button onClick={() => handleTabChange("members")} className={`text-xs font-semibold ${isDark ? "text-[#4CAF50]" : "text-[#436850]"}`}>View all →</button>
                  </div>
                  <div className="flex items-center gap-3 px-5 py-4">
                    {top.map((m) => (
                      <div key={m.userId} className="flex flex-col items-center gap-1">
                        <div className="w-10 h-10 rounded-full overflow-hidden">
                          <PlayerAvatar username={m.chesscomUsername ?? m.lichessUsername ?? m.displayName} platform={m.chesscomUsername ? "chesscom" : m.lichessUsername ? "lichess" : undefined} name={m.displayName} size={40} showBadge={false} />
                        </div>
                        <span className={`text-[10px] font-medium truncate max-w-[56px] ${textMuted}`}>{m.displayName?.split(" ")[0]}</span>
                      </div>
                    ))}
                    {members.length > 4 && (
                      <button onClick={() => handleTabChange("members")} className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold ${isDark ? "bg-white/8 text-white/50" : "bg-[#ADBC9F]/30 text-[#436850]"}`}>+{members.length - 4}</button>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* League preview */}
            {clubLeagues.length > 0 && (
              <div className={`rounded-3xl border ${cardBorder} ${card} overflow-hidden`}>
                <div className={`px-5 py-4 border-b ${divider} flex items-center justify-between`}>
                  <div className="flex items-center gap-2">
                    <Award className={`w-4 h-4 ${isDark ? "text-amber-400" : "text-amber-600"}`} />
                    <h3 className={`text-sm font-semibold uppercase tracking-wider ${isDark ? "text-white/40" : "text-[#436850]"}`}>League</h3>
                  </div>
                  <button onClick={() => handleTabChange("leagues")} className={`text-xs font-semibold ${isDark ? "text-[#4CAF50]" : "text-[#436850]"}`}>View →</button>
                </div>
                <div className="px-5 py-3">
                  {clubLeagues.filter(lg => lg.status === "active").slice(0, 1).map(lg => (
                    <div key={lg.id} className="flex items-center justify-between">
                      <div>
                        <p className={`text-sm font-semibold ${textMain}`}>{lg.name}</p>
                        <p className={`text-xs ${textMuted}`}>Week {lg.currentWeek} of {lg.totalWeeks} · {lg.playerCount} players</p>
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: "oklch(0.55 0.13 145 / 0.15)", color: "oklch(0.55 0.13 145)" }}>Active</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Members tab ─────────────────────────────────────────────────── */}
        {activeTab === "members" && (() => {
          if (!joined) return (
            <div className={`rounded-3xl border ${cardBorder} ${card} p-8 flex flex-col items-center text-center gap-3`}>
              <div>
                <h3 className={`text-lg font-bold tracking-tight sm:text-xl mb-1.5 ${textMain}`}>Members-only</h3>
                <p className={`text-sm ${textMuted} max-w-xs`}>The member directory is only visible to club members. Join to see who's in the club.</p>
              </div>
              <button onClick={() => { if (!user) { setAuthOpen(true); } else { handleJoin(); } }} className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-105 ${isDark ? "bg-[#4CAF50] text-black hover:bg-[#66BB6A]" : "bg-[#436850] text-white hover:bg-[#3a5230]"}`}>Join Club</button>
            </div>
          );
          // Filter and sort members
          const filteredMembers = members.filter((m) => {
            const matchesSearch = (() => {
              if (!memberSearch.trim()) return true;
              const q = memberSearch.toLowerCase();
              return (m.displayName ?? "").toLowerCase().includes(q) ||
                (m.chesscomUsername ?? "").toLowerCase().includes(q) ||
                (m.lichessUsername ?? "").toLowerCase().includes(q);
            })();
            const matchesRole = memberRoleFilter === "all" || m.role === memberRoleFilter;
            return matchesSearch && matchesRole;
          });
          const sortedMembers = [...filteredMembers].sort((a, b) => {
            if (memberSort === "name") return (a.displayName ?? "").localeCompare(b.displayName ?? "");
            if (memberSort === "joined") return new Date(b.joinedAt ?? 0).getTime() - new Date(a.joinedAt ?? 0).getTime();
            const roleOrder = { owner: 0, director: 1, member: 2 };
            return (roleOrder[a.role as keyof typeof roleOrder] ?? 2) - (roleOrder[b.role as keyof typeof roleOrder] ?? 2);
          });
          const totalPages = Math.ceil(sortedMembers.length / MEMBERS_PER_PAGE);
          const paginated = sortedMembers.slice((memberPage - 1) * MEMBERS_PER_PAGE, memberPage * MEMBERS_PER_PAGE);
          // Counts for role chips
          const ownerCount = members.filter(m => m.role === "owner").length;
          const directorCount = members.filter(m => m.role === "director").length;
          const memberCount = members.filter(m => m.role === "member").length;
          // Top going-members for avatar stack hero (show up to 8 members sorted by role)
          const heroMembers = [...members]
            .sort((a, b) => { const ro = { owner: 0, director: 1, member: 2 }; return (ro[a.role as keyof typeof ro] ?? 2) - (ro[b.role as keyof typeof ro] ?? 2); })
            .slice(0, 8);
          return (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* ── Hero avatar stack ──────────────────────────────────────────── */}
              <div className={`rounded-3xl border ${cardBorder} ${card} p-5`}>
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div>
                    <h2 className={`text-base font-bold ${isDark ? "text-white" : "text-[#12372A]"}`} style={{ fontFamily: "'Clash Display', sans-serif" }}>
                      {club.memberCount} Members
                    </h2>
                    <p className={`text-xs mt-0.5 ${textMuted}`}>
                      {ownerCount > 0 && `${ownerCount} owner`}
                      {directorCount > 0 && ` · ${directorCount} director${directorCount > 1 ? "s" : ""}`}
                      {memberCount > 0 && ` · ${memberCount} member${memberCount > 1 ? "s" : ""}`}
                    </p>
                  </div>
                  {/* Avatar stack */}
                  <div className="flex -space-x-3">
                    {heroMembers.map((m) => {
                      const uname = m.chesscomUsername ?? m.lichessUsername ?? undefined;
                      const plat: "chesscom" | "lichess" | undefined = m.chesscomUsername ? "chesscom" : m.lichessUsername ? "lichess" : undefined;
                      return (
                        <div key={m.userId} className={`w-9 h-9 rounded-full overflow-hidden ring-2 flex-shrink-0 ${
                          isDark ? "ring-[#0d1a0f]" : "ring-white"
                        }`} title={m.displayName}>
                          <PlayerAvatar username={uname ?? ""} platform={plat} name={m.displayName} size={36} showBadge={false} className="w-full h-full object-cover" />
                        </div>
                      );
                    })}
                    {members.length > 8 && (
                      <div className={`w-9 h-9 rounded-full ring-2 flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                        isDark ? "ring-[#0d1a0f] bg-white/10 text-white/70" : "ring-white bg-[#ADBC9F]/60 text-[#436850]"
                      }`}>+{members.length - 8}</div>
                    )}
                  </div>
                </div>
                {/* Role breakdown pills */}
                <div className="flex gap-2 flex-wrap">
                  {ownerCount > 0 && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/20">
                      <Crown className="w-3 h-3" /> {ownerCount} Owner{ownerCount > 1 ? "s" : ""}
                    </span>
                  )}
                  {directorCount > 0 && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#4CAF50]/15 text-[#4CAF50] border border-[#4CAF50]/20">
                      <Shield className="w-3 h-3" /> {directorCount} Director{directorCount > 1 ? "s" : ""}
                    </span>
                  )}
                  {memberCount > 0 && (
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                      isDark ? "bg-white/8 text-white/60 border border-white/10" : "bg-[#ADBC9F]/40 text-[#436850] border border-[#ADBC9F]"
                    }`}>
                      <Users className="w-3 h-3" /> {memberCount} Member{memberCount > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              </div>

              {/* ── Search + filter bar ────────────────────────────────────────── */}
              <div className={`rounded-3xl border ${cardBorder} ${card} overflow-hidden`}>
                <div className={`px-4 py-3 border-b ${divider} flex gap-2 items-center`}>
                  {/* Search input */}
                  <div className="relative flex-1">
                    <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none ${textMuted}`} />
                    <input
                      aria-label="Search by name or username"
                      type="text"
                      value={memberSearch}
                      onChange={(e) => { setMemberSearch(e.target.value); setMemberPage(1); }}
                      placeholder="Search by name or username…"
                      className={`w-full pl-8 pr-3 py-2 rounded-xl border text-xs outline-none transition-colors ${
                        isDark
                          ? "bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-white/25"
                          : "bg-[#FBFADA]/70 border-[#ADBC9F] text-[#12372A] placeholder:text-[#436850]/70 focus:border-[#436850]"
                      }`}
                    />
                  </div>
                  {/* Sort dropdown */}
                  <select
                    aria-label="Sort members"
                    value={memberSort}
                    onChange={(e) => { setMemberSort(e.target.value as typeof memberSort); setMemberPage(1); }}
                    className={`text-xs px-2.5 py-2 rounded-xl border outline-none cursor-pointer flex-shrink-0 ${
                      isDark ? "bg-white/5 border-white/10 text-white/70" : "bg-[#FBFADA]/70 border-[#ADBC9F] text-[#436850]"
                    }`}
                  >
                    <option value="role">By Role</option>
                    <option value="name">A → Z</option>
                    <option value="joined">Newest</option>
                  </select>
                </div>
                {/* Role filter chips */}
                <div className={`px-4 py-2.5 border-b ${divider} flex gap-2 overflow-x-auto scrollbar-none`}>
                  {(["all", "owner", "director", "member"] as const).map((r) => {
                    const count = r === "all" ? members.length : r === "owner" ? ownerCount : r === "director" ? directorCount : memberCount;
                    const isActive = memberRoleFilter === r;
                    const chipStyle: React.CSSProperties = isActive
                      ? r === "owner"
                        ? { background: "oklch(0.65 0.15 80 / 0.2)", color: "oklch(0.75 0.15 80)", borderColor: "oklch(0.65 0.15 80 / 0.4)" }
                        : r === "director"
                        ? { background: "oklch(0.55 0.13 145 / 0.2)", color: "oklch(0.65 0.13 145)", borderColor: "oklch(0.55 0.13 145 / 0.4)" }
                        : isDark
                        ? { background: "oklch(0.22 0.04 145)", color: "oklch(0.75 0.06 145)", borderColor: "oklch(0.32 0.06 145)" }
                        : { background: "oklch(0.85 0.05 145)", color: "oklch(0.35 0.1 145)", borderColor: "oklch(0.65 0.1 145)" }
                      : {};
                    const label = r === "all" ? "All" : r === "owner" ? "Owners" : r === "director" ? "Directors" : "Members";
                    return (
                      <button
                        key={r}
                        onClick={() => { setMemberRoleFilter(r); setMemberPage(1); }}
                        className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                          isActive
                            ? ""
                            : isDark
                            ? "bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white/70"
                            : "bg-[#FBFADA]/70 border-[#ADBC9F]/60 text-[#436850]/70 hover:bg-[#ADBC9F]/40 hover:text-[#436850]"
                        }`}
                        style={isActive ? chipStyle : {}}
                      >
                        {r === "owner" && <Crown className="w-3 h-3" />}
                        {r === "director" && <Shield className="w-3 h-3" />}
                        {r === "member" && <Users className="w-3 h-3" />}
                        {label}
                        <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                          isActive
                            ? "bg-white/20"
                            : isDark ? "bg-white/8 text-white/40" : "bg-[#ADBC9F]/50 text-[#436850]/60"
                        }`}>{count}</span>
                      </button>
                    );
                  })}
                </div>

                {/* ── Member card grid ──────────────────────────────────────────── */}
                {paginated.length === 0 ? (
                  <div className={`py-16 text-center text-sm ${textMuted}`}>
                    {memberSearch || memberRoleFilter !== "all"
                      ? "No members match your filters"
                      : "No members yet"}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-px" style={{ background: isDark ? "rgba(255,255,255,0.04)" : "rgba(173,188,159,0.3)" }}>
                    {paginated.map((member) => (
                      <MemberCard key={member.userId} member={member} clubId={club.id} isDark={isDark} textMuted={textMuted} accent={accent} />
                    ))}
                  </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className={`px-5 py-3 border-t ${divider} flex items-center justify-between`}>
                    <span className={`text-xs ${textMuted}`}>
                      {sortedMembers.length} result{sortedMembers.length !== 1 ? "s" : ""} · Page {memberPage} of {totalPages}
                    </span>
                    <div className="flex gap-2">
                      <button
                        disabled={memberPage === 1}
                        onClick={() => setMemberPage((p) => p - 1)}
                        className={`text-xs px-3 py-1.5 rounded-lg transition-colors disabled:opacity-30 ${
                          isDark ? "bg-white/8 text-white hover:bg-white/15" : "bg-[#ADBC9F]/40 text-[#12372A]/85 hover:bg-[#ADBC9F]"
                        }`}
                      >Prev</button>
                      <button
                        disabled={memberPage === totalPages}
                        onClick={() => setMemberPage((p) => p + 1)}
                        className={`text-xs px-3 py-1.5 rounded-lg transition-colors disabled:opacity-30 ${
                          isDark ? "bg-white/8 text-white hover:bg-white/15" : "bg-[#ADBC9F]/40 text-[#12372A]/85 hover:bg-[#ADBC9F]"
                        }`}
                      >Next</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}
        {/* ── Feed tab ──────────────────────────────────────────────────────── */}
        {activeTab === "feed" && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Non-member gate */}
            {!joined ? (
              <div className={`rounded-3xl border ${cardBorder} ${card} p-8 flex flex-col items-center text-center gap-3`}>
                <div>
                  <h3 className={`text-lg font-bold tracking-tight sm:text-xl mb-1.5 ${textMain}`}>Members-only Feed</h3>
                  <p className={`text-sm ${textMuted} max-w-xs`}>Posts, polls, and announcements are only visible to club members. Join to participate in the conversation.</p>
                </div>
                <button
                  onClick={() => { if (!user) { setAuthOpen(true); } else { handleJoin(); } }}
                  className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-105 ${isDark ? "bg-[#4CAF50] text-black hover:bg-[#66BB6A]" : "bg-[#436850] text-white hover:bg-[#3a5230]"}`}
                >
                  Join Club
                </button>
                <button onClick={() => setActiveTab("album")} className={`text-sm font-semibold ${isDark ? "text-[#7ee787] hover:text-white" : "text-[#436850] hover:text-[#12372A]"}`}>View club albums</button>
              </div>
            ) : (
              <>
            {/* Onboarding checklist for new club owners */}
            {isOwner && club.memberCount <= 3 && (() => {
              const steps = [
                { done: !!club.description && club.description.length > 20, label: "Write a club description" },
                { done: !!club.bannerUrl, label: "Add a banner image" },
                { done: club.memberCount > 1, label: "Invite your first member" },
                { done: (liveTournaments.length + upcomingTournaments.length) > 0, label: "Host a tournament" },
              ];
              const completed = steps.filter((s) => s.done).length;
              if (completed === steps.length) return null;
              return (
                <div className={`rounded-3xl border ${isDark ? "border-[#4CAF50]/25 bg-[#4CAF50]/5" : "border-[#436850]/20 bg-[#436850]/5"} p-5`}>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h2 className={`text-sm font-bold ${textMain}`} style={{ fontFamily: "'Clash Display', sans-serif" }}>Set Up Your Club</h2>
                      <p className={`text-xs ${textMuted} mt-0.5`}>{completed} of {steps.length} steps complete</p>
                    </div>
                    <div className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                      isDark ? "bg-[#4CAF50]/15 text-[#4CAF50]" : "bg-[#436850]/10 text-[#436850]"
                    }`}>{Math.round((completed / steps.length) * 100)}%</div>
                  </div>
                  {/* Progress bar */}
                  <div className={`h-1.5 rounded-full mb-4 ${isDark ? "bg-white/10" : "bg-[#ADBC9F]"}`}>
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${(completed / steps.length) * 100}%`, background: "oklch(0.55 0.13 145)" }}
                    />
                  </div>
                  <div className="space-y-2">
                    {steps.map((step, i) => (
                      <div key={i} className={`flex items-center gap-3 text-sm ${
                        step.done ? textMuted : textMain
                      }`}>
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 border ${
                          step.done
                            ? isDark ? "bg-[#4CAF50]/20 border-[#4CAF50]/40" : "bg-[#436850]/15 border-[#436850]/30"
                            : isDark ? "border-white/20 bg-transparent" : "border-[#ADBC9F] bg-transparent"
                        }`}>
                          {step.done && <Check className={`w-3 h-3 ${isDark ? "text-[#4CAF50]" : "text-[#436850]"}`} />}
                        </div>
                        <span className={step.done ? "line-through opacity-50" : ""}>{step.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}



            {/* ── Top Members / Leaderboard Preview ──────────────────────── */}
            {members.length > 0 && (() => {
              const ownerFirst = [...members].sort((a, b) => {
                const ro = { owner: 0, director: 1, member: 2 };
                return (ro[a.role as keyof typeof ro] ?? 2) - (ro[b.role as keyof typeof ro] ?? 2);
              });
              const top = ownerFirst.slice(0, 5);
              return (
                <div className={`rounded-3xl border ${cardBorder} ${card} overflow-hidden`}>
                  <div className={`px-5 py-4 border-b ${divider} flex items-center justify-between`}>
                    <div className="flex items-center gap-2">
                      <Trophy className={`w-4 h-4 ${isDark ? "text-amber-400" : "text-amber-600"}`} />
                      <h2 className={`text-sm font-semibold uppercase tracking-wider ${isDark ? "text-white/40" : "text-[#436850]"}`}>Top Members</h2>
                    </div>
                    <button
                      onClick={() => setActiveTab("members")}
                      className={`flex items-center gap-1 text-xs font-semibold transition-colors ${isDark ? "text-[#4CAF50] hover:text-[#66BB6A]" : "text-[#436850] hover:text-[#3a5230]"}`}
                    >
                      See all <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className={`divide-y ${isDark ? "divide-white/5" : "divide-gray-100"}`}>
                    {top.map((m, idx) => (
                      <div key={m.userId} className={`flex items-center gap-3 px-5 py-3 transition-colors ${isDark ? "hover:bg-white/4" : "hover:bg-[#FBFADA]"}`}>
                        <span className={`w-5 text-center text-xs font-bold ${isDark ? "text-white/30" : "text-[#436850]"}`}>{idx + 1}</span>
                        <div className="w-8 h-8 rounded-full flex-shrink-0 overflow-hidden">
                          <PlayerAvatar
                            username={m.chesscomUsername ?? m.lichessUsername ?? m.displayName}
                            platform={m.chesscomUsername ? "chesscom" : m.lichessUsername ? "lichess" : undefined}
                            name={m.displayName}
                            size={32}
                            showBadge={false}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-semibold truncate ${textMain}`}>{m.displayName}</p>
                          {m.chesscomUsername && (
                            <p className={`text-xs truncate ${textMuted}`}>@{m.chesscomUsername}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {m.role !== "member" && (
                            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                              m.role === "owner"
                                ? isDark ? "bg-amber-500/20 text-amber-400" : "bg-amber-50 text-amber-700"
                                : isDark ? "bg-blue-500/20 text-blue-400" : "bg-blue-50 text-blue-700"
                            }`}>{m.role}</span>
                          )}
                          {m.tournamentsPlayed > 0 && (
                            <span className={`text-xs font-medium ${textMuted}`}>{m.tournamentsPlayed}T</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  {members.length > 5 && (
                    <div className={`px-5 py-3 border-t ${divider}`}>
                      <button
                        onClick={() => setActiveTab("members")}
                        className={`w-full text-center text-xs font-semibold py-1.5 rounded-xl transition-colors ${
                          isDark ? "text-white/50 hover:text-white hover:bg-white/6" : "text-[#436850] hover:text-[#12372A] hover:bg-[#FBFADA]"
                        }`}
                      >
                        View all {members.length} members →
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── Feed event list ────────────────────────────────────────────── */}
            {feedEvents.length === 0 ? (
              <div className={`rounded-3xl border ${cardBorder} ${card} py-16 text-center`}>
                <Rss className={`w-10 h-10 mx-auto mb-3 ${textMuted}`} />
                <p className={`text-sm font-semibold ${textMain} mb-1`}>No activity yet</p>
                <p className={`text-xs ${textMuted}`}>
                  {isOwner || isDirector
                    ? "Post an announcement above to kick things off!"
                    : "Announcements, events, and tournament results will appear here."}
                </p>
              </div>
            ) : (
              <div className={`rounded-3xl border ${cardBorder} ${card} overflow-hidden`}>
                <div className={`px-5 py-4 border-b ${divider}`}>
                  <h2 className={`text-sm font-semibold uppercase tracking-wider ${isDark ? "text-white/40" : "text-[#436850]"}`}>
                    Activity
                  </h2>
                </div>
                <div className={`divide-y ${isDark ? "divide-white/5" : "divide-gray-100"}`}>
                  {feedEvents.map((event) => (
                    <FeedEventCard
                      key={event.id}
                      event={event}
                      isDark={isDark}
                      textMain={textMain}
                      textMuted={textMuted}
                      canDelete={isOwner || isDirector}
                      onDelete={handleDeleteFeedEvent}
                      userId={user?.id}
                      displayName={user?.displayName}
                      avatarUrl={user?.avatarUrl}
                      chesscomUsername={user?.chesscomUsername}
                      clubId={club.id}
                      isMemberUser={joined}
                      accentColor={accent}
                      onVoted={refreshFeed}
                      onRsvped={refreshFeed}
                      onReaction={handleReaction}
                    />
                  ))}
                </div>
              </div>
            )}
              </>
            )}
          </div>
        )}

        {/* ── Events tab ──────────────────────────────────────────────────────────── */}
        {activeTab === "events" && (() => {
          if (!joined) return (
            <div className={`rounded-3xl border ${cardBorder} ${card} p-8 flex flex-col items-center text-center gap-3`}>
              <div>
                <h3 className={`text-lg font-bold tracking-tight sm:text-xl mb-1.5 ${textMain}`}>Members-only Events</h3>
                <p className={`text-sm ${textMuted} max-w-xs`}>Club events and tournaments are only visible to members. Join to see upcoming events and RSVP.</p>
              </div>
              <button onClick={() => { if (!user) { setAuthOpen(true); } else { handleJoin(); } }} className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-105 ${isDark ? "bg-[#4CAF50] text-black hover:bg-[#66BB6A]" : "bg-[#436850] text-white hover:bg-[#3a5230]"}`}>Join Club</button>
              <button onClick={() => setActiveTab("leagues")} className={`text-sm font-semibold ${isDark ? "text-[#7ee787] hover:text-white" : "text-[#436850] hover:text-[#12372A]"}`}>View club leagues</button>
            </div>
          );
          const now = new Date();
          // Merge clubEvents and live tournaments into a unified list
          const eventTournamentIds = new Set(clubEvents.flatMap((event) => event.tournamentId ? [event.tournamentId] : []));
          const allItems = [
            ...clubEvents.map((e) => ({ type: "event" as const, data: e, startAt: e.startAt })),
            ...liveTournaments
              .filter((t) => !eventTournamentIds.has(t.id))
              .map((t) => ({ type: "tournament" as const, data: t, startAt: t.date || now.toISOString() })),
          ].sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

          // Apply filter
          const filteredItems = eventsFilter === "all" ? allItems
            : eventsFilter === "events" ? allItems.filter((i) => i.type === "event")
            : allItems.filter((i) => i.type === "tournament");
          const filteredUpcoming = filteredItems.filter((e) => new Date(e.startAt) >= now);
          const filteredPast = filteredItems.filter((e) => new Date(e.startAt) < now).reverse();
          const upcoming = filteredUpcoming;
          const past = filteredPast;

          return (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Header row with Create Event button for owners */}
            {(isOwner || isDirector) && (
              <div className="flex items-center justify-between px-1">
                <span className={`text-xs font-semibold uppercase tracking-wider ${textMuted}`}>
                  {upcoming.length} upcoming · {past.length} past
                </span>
                <button
                  onClick={() => setShowCreateEvent(true)}
                  className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl transition-colors ${
                    isDark ? "bg-white/10 text-white hover:bg-white/20" : "bg-[#ADBC9F]/40 text-[#12372A] hover:bg-[#ADBC9F]"
                  }`}
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  New Event
                </button>
              </div>
            )}

            {/* Filter chips */}
            <div className="flex gap-2 flex-wrap">
              {(["all", "events", "tournaments"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setEventsFilter(f)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                    eventsFilter === f
                      ? isDark ? "bg-[#4CAF50]/15 text-[#4CAF50] border border-[#4CAF50]/30" : "bg-[#436850]/10 text-[#436850] border border-[#436850]/20"
                      : isDark ? "bg-white/6 text-white/50 hover:text-white border border-transparent" : "bg-[#ADBC9F]/40 text-[#436850] hover:text-[#12372A] border border-transparent"
                  }`}
                >
                  {f === "all" ? "All" : f === "events" ? "Events" : "Tournaments"}
                </button>
              ))}
            </div>

            {filteredItems.length === 0 ? (
              <div className={`rounded-3xl border ${cardBorder} ${card} overflow-hidden relative`} style={{ minHeight: 320 }}>
                {/* Chess-grid SVG background motif */}
                <svg aria-hidden="true" className="absolute inset-0 w-full h-full opacity-[0.035] pointer-events-none" style={{ zIndex: 0 }} xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <pattern id="chess-empty-events" x="0" y="0" width="32" height="32" patternUnits="userSpaceOnUse">
                      <rect x="0" y="0" width="16" height="16" fill={isDark ? "#fff" : "#12372A"} />
                      <rect x="16" y="16" width="16" height="16" fill={isDark ? "#fff" : "#12372A"} />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#chess-empty-events)" />
                </svg>
                {/* Radial glow */}
                <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 1, background: isDark ? "radial-gradient(ellipse 60% 55% at 50% 45%, oklch(0.55 0.13 145 / 0.13) 0%, transparent 75%)" : "radial-gradient(ellipse 60% 55% at 50% 45%, oklch(0.55 0.13 145 / 0.07) 0%, transparent 75%)" }} />
                {/* Content */}
                <div className="relative flex flex-col items-center justify-center text-center px-8 py-20" style={{ zIndex: 2 }}>
                  {/* Icon with glow ring */}
                  <div className="relative mb-6">
                    <div className="absolute inset-0 rounded-full blur-2xl opacity-40" style={{ background: "oklch(0.55 0.13 145)", transform: "scale(1.8)" }} />
                    <div className={`relative w-20 h-20 rounded-3xl flex items-center justify-center ${
                      isDark ? "bg-[oklch(0.55_0.13_145/0.15)] border border-[oklch(0.55_0.13_145/0.25)]" : "bg-[oklch(0.55_0.13_145/0.10)] border border-[oklch(0.55_0.13_145/0.20)]"
                    }`}>
                      <Calendar className={`w-9 h-9 ${isDark ? "text-[#4CAF50]" : "text-[#436850]"}`} strokeWidth={1.5} />
                    </div>
                  </div>
                  {/* Headline */}
                  <h3 className={`text-xl font-bold tracking-tight mb-2 ${textMain}`} style={{ fontFamily: "'Clash Display', sans-serif" }}>
                    {eventsFilter === "tournaments" ? "No tournaments yet" : eventsFilter === "events" ? "No events yet" : "Nothing scheduled yet"}
                  </h3>
                  {/* Sub-copy — context aware */}
                  <p className={`text-sm leading-relaxed max-w-xs mb-8 ${textMuted}`}>
                    {(isOwner || isDirector)
                      ? eventsFilter === "tournaments"
                        ? "Host your first OTB tournament and let members sign up, track pairings, and see live standings."
                        : "Schedule events, game nights, and tournaments to keep your club active and members engaged."
                      : joined
                      ? "Check back soon — the club director will post events and tournaments here."
                      : "Join this club to get notified when events and tournaments are scheduled."}
                  </p>
                  {/* CTAs */}
                  {(isOwner || isDirector) ? (
                    <div className="flex flex-col sm:flex-row items-center gap-3">
                      <button
                        onClick={() => setShowCreateEvent(true)}
                        className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold transition-all hover:scale-[1.03] active:scale-[0.98]"
                        style={{ background: "oklch(0.55 0.13 145)", color: "#fff", boxShadow: "0 4px 20px oklch(0.55 0.13 145 / 0.35)" }}
                      >
                        <Calendar className="w-4 h-4" strokeWidth={2} />
                        Create Event
                      </button>
                      <button
                        onClick={() => setShowWizard(true)}
                        className={`inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold transition-all hover:scale-[1.03] active:scale-[0.98] ${
                          isDark ? "bg-white/8 text-white/80 hover:bg-white/14 border border-white/10" : "bg-[#ADBC9F]/40 text-[#12372A] hover:bg-[#ADBC9F]/70 border border-[#ADBC9F]/60"
                        }`}
                      >
                        <Trophy className="w-4 h-4" strokeWidth={2} />
                        Host Tournament
                      </button>
                    </div>
                  ) : joined ? (
                    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold ${
                      isDark ? "bg-white/6 text-white/40 border border-white/8" : "bg-[#ADBC9F]/30 text-[#436850] border border-[#ADBC9F]/50"
                    }`}>
                      <Bell className="w-3.5 h-3.5" strokeWidth={2} />
                      You'll be notified when events are posted
                    </div>
                  ) : (
                    <button
                      onClick={() => { if (!user) { setAuthOpen(true); } else { handleJoin(); } }}
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold transition-all hover:scale-[1.03] active:scale-[0.98]"
                      style={{ background: "oklch(0.55 0.13 145)", color: "#fff", boxShadow: "0 4px 20px oklch(0.55 0.13 145 / 0.35)" }}
                    >
                      Join Club
                      <ArrowRight className="w-4 h-4" strokeWidth={2} />
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <>
                {/* Upcoming events */}
                {filteredUpcoming.length > 0 && (
                  <div className={`rounded-3xl border ${cardBorder} ${card} overflow-hidden`}>
                    <div className={`px-5 py-3.5 border-b ${divider} flex items-center justify-between`}>
                      <h2 className={`text-xs font-bold uppercase tracking-wider ${isDark ? "text-white/40" : "text-[#436850]"}`}>Upcoming</h2>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        isDark ? "bg-[#4CAF50]/20 text-[#4CAF50]" : "bg-[#436850]/10 text-[#436850]"
                      }`}>{filteredUpcoming.length}</span>
                    </div>
                    <div className={`divide-y ${isDark ? "divide-white/5" : "divide-gray-100"}`}>
                      {(showAllUpcoming ? filteredUpcoming : filteredUpcoming.slice(0, 4)).map((item) => (
                        item.type === "event" ? (() => {
                          const ev = item.data as ClubEvent;
                          // Use server-merged RSVPs if available, else fall back to local storage
                          const allRsvps = rsvpOverrideMap[ev.id] ?? getEventRSVPs(ev.id);
                          // rsvpTick is read here to force re-render after toggle
                          void rsvpTick;
                          const myRsvp = (joined && user) ? (allRsvps.find(r => r.userId === user.id) ?? getUserRSVP(ev.id, user.id)) : null;
                          const goingRsvps = allRsvps.filter(r => r.status === "going");
                          const maybeRsvps = allRsvps.filter(r => r.status === "maybe");
                          const notGoingRsvps = allRsvps.filter(r => r.status === "not_going");
                          const isDrawerOpen = expandedRsvpEventId === ev.id;
                          const dateObj = new Date(ev.startAt);
                          const endObj = ev.endAt ? new Date(ev.endAt) : null;
                          const evAccent = ev.accentColor ?? accent;
                          const dayName = dateObj.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
                          const timeStr = dateObj.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
                          const endTimeStr = endObj ? endObj.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : null;
                          return (
                          <div key={ev.id} className={`rounded-2xl overflow-hidden border transition-all ${
                            isDark
                              ? "bg-[#0d1f12] border-white/8 hover:border-white/15"
                              : "bg-white border-[#ADBC9F] hover:border-[#ADBC9F] shadow-sm"
                          }`}>
                            {/* Cover image — full bleed */}
                            {ev.coverImageUrl ? (
                              <div className="relative w-full overflow-hidden" style={{ height: 180 }}>
                                <img loading="lazy" decoding="async" src={ev.coverImageUrl} alt={ev.title} className="w-full h-full object-cover" />
                                <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.75) 100%)" }} />
                                {/* Date pill over image */}
                                <div className="absolute top-3 left-3">
                                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold" style={{ background: "rgba(134,239,172,0.22)", color: "#86efac", border: "1px solid rgba(134,239,172,0.4)" }}>
                                    <Calendar className="w-3 h-3" />
                                    {dayName}
                                  </span>
                                </div>
                                {/* Owner controls over image */}
                                {(isOwner || isDirector) && (
                                  <div className="absolute top-3 right-3 flex items-center gap-1">
                                    <button onClick={() => { setEditingEvent(ev); const localDT = new Date(ev.startAt).toLocaleString("sv-SE", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).replace(" ", "T").slice(0, 16); setEditForm({ title: ev.title, description: ev.description ?? "", startAt: localDT, venue: ev.venue ?? "", admissionNote: ev.admissionNote ?? "", recurrence: ev.recurrence ?? "none", recurrenceEndDate: ev.recurrenceEndDate ?? "", editScope: "this", coverImageUrl: ev.coverImageUrl ?? "" }); }} className="p-1.5 rounded-lg bg-black/40 text-white/70 hover:text-white hover:bg-black/60 transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                                    <button onClick={() => setConfirmDeleteId(ev.id)} className="p-1.5 rounded-lg bg-black/40 text-white/70 hover:text-red-400 hover:bg-black/60 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                                  </div>
                                )}
                              </div>
                            ) : (
                              /* No cover — accent gradient header */
                              <div className="relative px-5 pt-5 pb-3" style={{ background: `linear-gradient(135deg, ${evAccent}18 0%, ${evAccent}08 100%)` }}>
                                <div className="flex items-center justify-between">
                                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold" style={isDark ? { background: "rgba(134,239,172,0.15)", color: "#86efac", border: "1px solid rgba(134,239,172,0.3)" } : { background: evAccent + "22", color: evAccent, border: `1px solid ${evAccent}44` }}>
                                    <Calendar className="w-3 h-3" />
                                    {dayName}
                                  </span>
                                  {(isOwner || isDirector) && (
                                    <div className="flex items-center gap-1">
                                      <button onClick={() => { setEditingEvent(ev); const localDT = new Date(ev.startAt).toLocaleString("sv-SE", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).replace(" ", "T").slice(0, 16); setEditForm({ title: ev.title, description: ev.description ?? "", startAt: localDT, venue: ev.venue ?? "", admissionNote: ev.admissionNote ?? "", recurrence: ev.recurrence ?? "none", recurrenceEndDate: ev.recurrenceEndDate ?? "", editScope: "this", coverImageUrl: ev.coverImageUrl ?? "" }); }} className={`p-1.5 rounded-lg transition-colors ${isDark ? "text-white/30 hover:text-white hover:bg-white/8" : "text-[#436850] hover:text-[#12372A] hover:bg-[#ADBC9F]/50"}`}><Pencil className="w-3 h-3" /></button>
                                      <button onClick={() => setConfirmDeleteId(ev.id)} className={`p-1.5 rounded-lg transition-colors ${isDark ? "text-white/30 hover:text-red-400 hover:bg-red-500/10" : "text-[#436850] hover:text-red-500 hover:bg-red-50"}`}><Trash2 className="w-3 h-3" /></button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                            {/* Card body */}
                            <div className="px-5 py-4 space-y-3">
                              {/* Title + recurrence badge */}
                              <div className="flex items-start gap-2">
                                <h3 className={`text-lg font-black leading-snug flex-1 ${textMain}`} style={{ fontFamily: "'Clash Display', sans-serif" }}>{ev.title}</h3>
                                {ev.recurrence && ev.recurrence !== "none" && (
                                  <span className={`mt-0.5 text-[9px] font-bold px-2 py-1 rounded-full flex-shrink-0 ${
                                    isDark ? "bg-[#4CAF50]/20 text-[#4CAF50]" : "bg-[#436850]/10 text-[#436850]"
                                  }`}>{ev.recurrence === "biweekly" ? "BI-WEEKLY" : ev.recurrence.toUpperCase()}</span>
                                )}
                              </div>
                              {/* Meta row: time, venue, admission */}
                              <div className="space-y-1.5">
                                <div className={`flex items-center gap-2 text-sm ${textMuted}`}>
                                  <Clock className="w-4 h-4 flex-shrink-0" style={{ color: evAccent }} />
                                  <span>{timeStr}{endTimeStr ? ` – ${endTimeStr}` : ""}</span>
                                </div>
                                {ev.venue && (
                                  <div className={`flex items-center gap-2 text-sm font-medium ${textMain}`}>
                                    <MapPin className="w-4 h-4 flex-shrink-0" style={{ color: evAccent }} />
                                    <span>{ev.venue}</span>
                                  </div>
                                )}
                                {ev.admissionNote && (
                                  <div className={`flex items-center gap-2 text-sm ${textMuted}`}>
                                    <span className="w-4 h-4 flex-shrink-0 flex items-center justify-center text-base">💳</span>
                                    <span>{ev.admissionNote}</span>
                                  </div>
                                )}
                              </div>
                              {/* Description */}
                              {ev.description && (
                                <p className={`text-sm leading-relaxed ${textMuted}`}>{ev.description}</p>
                              )}
                              {/* ── RSVP Hub ─────────────────────────────────────────── */}
                              <div className="space-y-3 pt-1">
                                {/* 3-state RSVP buttons */}
                                {joined && user ? (
                                  <div className="flex gap-2">
                                    {(["going", "maybe", "not_going"] as const).map((s) => {
                                      const isSelected = myRsvp?.status === s;
                                      const label = s === "going" ? "Going" : s === "maybe" ? "Maybe" : "Can't Go";
                                      const selectedStyle: React.CSSProperties = s === "going"
                                        ? { background: evAccent, color: "#fff" }
                                        : s === "maybe"
                                        ? { background: "oklch(0.65 0.15 60)", color: "#fff" }
                                        : isDark
                                        ? { background: "oklch(0.25 0.04 145)", color: "oklch(0.65 0.06 145)" }
                                        : { background: "oklch(0.88 0.04 145)", color: "oklch(0.35 0.08 145)" };
                                      return (
                                        <button
                                          key={s}
                                          onClick={() => {
                                            if (!user) return;
                                            // Optimistic update: update rsvpOverrideMap immediately
                                            const newStatus = isSelected ? "not_going" : s;
                                            const now = new Date().toISOString();
                                            setRsvpOverrideMap((prev) => {
                                              const base = prev[ev.id] ?? getEventRSVPs(ev.id);
                                              const existing = base.find(r => r.userId === user.id);
                                              let updated: ClubEventRSVP[];
                                              if (existing) {
                                                updated = base.map(r => r.userId === user.id ? { ...r, status: newStatus, updatedAt: now } : r);
                                              } else {
                                                updated = [...base, { id: `opt-${user.id}`, eventId: ev.id, clubId: ev.clubId, userId: user.id, displayName: user.displayName, avatarUrl: user.avatarUrl ?? null, status: newStatus, updatedAt: now }];
                                              }
                                              return { ...prev, [ev.id]: updated };
                                            });
                                            setRsvpTick(t => t + 1);
                                            // Persist to localStorage + server
                                            upsertRSVP(ev.id, ev.clubId, user.id, user.displayName, newStatus, user.avatarUrl ?? null);
                                          }}
                                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-2xl text-xs font-bold transition-all active:scale-95"
                                          style={isSelected ? selectedStyle : isDark
                                            ? { background: "oklch(0.18 0.04 145)", color: "oklch(0.55 0.06 145)" }
                                            : { background: "oklch(0.92 0.03 145)", color: "oklch(0.45 0.08 145)" }
                                          }
                                        >
                                          {isSelected && s === "going" && <CheckCircle2 className="w-3.5 h-3.5" />}
                                          {label}
                                        </button>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setAuthOpen(true)}
                                    className={`w-full py-2 rounded-2xl text-xs font-bold transition-all ${
                                      isDark ? "bg-white/5 text-white/30 hover:bg-white/8" : "bg-[#FBFADA]/70 text-[#436850]/50 hover:bg-[#ADBC9F]/40"
                                    }`}
                                  >
                                    Join club to RSVP
                                  </button>
                                )}
                                {/* Attendee summary row + expand toggle */}
                                {(goingRsvps.length > 0 || maybeRsvps.length > 0) && (
                                  <button
                                    onClick={() => setExpandedRsvpEventId(isDrawerOpen ? null : ev.id)}
                                    className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl transition-colors ${
                                      isDark ? "hover:bg-white/5" : "hover:bg-[#FBFADA]/70"
                                    }`}
                                  >
                                    <div className="flex items-center gap-2">
                                      {/* Avatar stack — going only */}
                                      <div className="flex -space-x-2">
                                        {goingRsvps.slice(0, 5).map((r) => (
                                          <div key={r.userId} className={`w-7 h-7 rounded-full overflow-hidden ring-2 ${
                                            isDark ? "ring-[#0d1f12]" : "ring-white"
                                          }`}>
                                            <PlayerAvatar
                                              username={(r as any).chesscomUsername ?? r.displayName}
                                              platform={(r as any).chesscomUsername ? "chesscom" : undefined}
                                              name={r.displayName}
                                              avatarUrl={r.avatarUrl ?? undefined}
                                              size={28}
                                              className="w-full h-full object-cover"
                                            />
                                          </div>
                                        ))}
                                        {goingRsvps.length > 5 && (
                                          <div className={`w-7 h-7 rounded-full ring-2 flex items-center justify-center text-[9px] font-bold ${
                                            isDark ? "ring-[#0d1f12] bg-white/10 text-white/60" : "ring-white bg-[#ADBC9F]/50 text-[#436850]"
                                          }`}>+{goingRsvps.length - 5}</div>
                                        )}
                                      </div>
                                      <span className={`text-xs font-semibold ${textMuted}`}>
                                        {goingRsvps.length > 0 && <span style={{ color: evAccent }}>{goingRsvps.length} going</span>}
                                        {goingRsvps.length > 0 && maybeRsvps.length > 0 && <span className={textMuted}> · </span>}
                                        {maybeRsvps.length > 0 && <span className="text-amber-500">{maybeRsvps.length} maybe</span>}
                                        {notGoingRsvps.length > 0 && <span className={`${textMuted} opacity-50`}> · {notGoingRsvps.length} can't go</span>}
                                      </span>
                                    </div>
                                    <ChevronRight className={`w-3.5 h-3.5 flex-shrink-0 transition-transform ${isDrawerOpen ? "rotate-90" : ""} ${textMuted}`} />
                                  </button>
                                )}
                                {goingRsvps.length === 0 && maybeRsvps.length === 0 && (
                                  <p className={`text-xs ${textMuted} opacity-40 text-center`}>Be the first to RSVP</p>
                                )}
                                {/* Expandable attendee drawer */}
                                {isDrawerOpen && (
                                  <div className={`rounded-2xl border overflow-hidden animate-in slide-in-from-top-1 duration-200 ${
                                    isDark ? "border-white/8 bg-white/3" : "border-[#ADBC9F]/60 bg-[#FBFADA]/60"
                                  }`}>
                                    {(["going", "maybe", "not_going"] as const).map((s) => {
                                      const group = s === "going" ? goingRsvps : s === "maybe" ? maybeRsvps : notGoingRsvps;
                                      if (!group.length) return null;
                                      const label = s === "going" ? "Going" : s === "maybe" ? "Maybe" : "Can't Go";
                                      const labelColor = s === "going" ? evAccent : s === "maybe" ? "oklch(0.65 0.15 60)" : "oklch(0.45 0.06 145)";
                                      return (
                                        <div key={s} className={`px-4 py-3 border-b last:border-b-0 ${
                                          isDark ? "border-white/5" : "border-[#ADBC9F]/30"
                                        }`}>
                                          <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: labelColor }}>
                                            {label} · {group.length}
                                          </p>
                                          <div className="flex flex-wrap gap-2">
                                            {group.map((r) => (
                                              <div key={r.userId} className="flex items-center gap-1.5">
                                                <div className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0">
                                                  <PlayerAvatar
                                                    username={(r as any).chesscomUsername ?? r.displayName}
                                                    platform={(r as any).chesscomUsername ? "chesscom" : undefined}
                                                    name={r.displayName}
                                                    avatarUrl={r.avatarUrl ?? undefined}
                                                    size={24}
                                                    className="w-full h-full object-cover"
                                                  />
                                                </div>
                                                <span className={`text-xs font-medium ${textMain}`}>{r.displayName}</span>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          );
                        })() : (() => {
                          const t = item.data as TournamentConfig;
                          const dateObj = new Date(t.date);
                          return (
                          <a
                            key={t.id}
                            href={`/tournament/${t.id}`}
                            className={`flex items-start gap-3 px-5 py-4 transition-colors ${isDark ? "hover:bg-white/3" : "hover:bg-[#FBFADA]"}`}
                          >
                            {/* Date badge */}
                            <div className="w-11 h-11 rounded-2xl flex-shrink-0 flex flex-col items-center justify-center text-center bg-[#4CAF50]/15">
                              <span className="text-[9px] font-bold uppercase leading-none text-[#4CAF50]">
                                {dateObj.toLocaleDateString("en-US", { month: "short" })}
                              </span>
                              <span className="text-base font-black leading-tight text-[#4CAF50]">{dateObj.getDate()}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className={`text-sm font-semibold ${textMain} truncate`}>{t.name}</p>
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md flex-shrink-0 ${
                                  isDark ? "bg-[#4CAF50]/15 text-[#4CAF50]" : "bg-[#436850]/10 text-[#436850]"
                                }`}>Tournament</span>
                              </div>
                              <p className={`text-xs ${textMuted} mt-0.5`}>
                                {dateObj.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                                {t.format ? ` · ${t.format}` : ""}
                              </p>
                            </div>
                            <ChevronRight className={`w-4 h-4 flex-shrink-0 mt-1 ${textMuted}`} />
                          </a>
                          );
                        })()
                      ))}
                      {filteredUpcoming.length > 4 && (
                        <button
                          onClick={() => setShowAllUpcoming(v => !v)}
                          className={`w-full py-3 text-xs font-semibold transition-colors ${
                            isDark ? "text-white/40 hover:text-white/70 hover:bg-white/3" : "text-[#436850] hover:text-[#436850] hover:bg-[#FBFADA]"
                          }`}
                        >
                          {showAllUpcoming ? "Show Less" : `View All ${filteredUpcoming.length} Upcoming Events`}
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Past events */}
                {filteredPast.length > 0 && (
                  <div className={`rounded-3xl border ${cardBorder} ${card} overflow-hidden`}>
                    <div className={`px-5 py-3.5 border-b ${divider} flex items-center justify-between`}>
                      <h2 className={`text-xs font-bold uppercase tracking-wider ${isDark ? "text-white/40" : "text-[#436850]"}`}>Past</h2>
                      <span className={`text-xs font-medium ${textMuted}`}>{filteredPast.length}</span>
                    </div>
                    <div className={`divide-y ${isDark ? "divide-white/5" : "divide-gray-100"}`}>
                      {(showAllPast ? filteredPast : filteredPast.slice(0, 3)).map((item) => {
                        const isPastEvent = item.type === "event";
                        const title = isPastEvent ? (item.data as ClubEvent).title : (item.data as TournamentConfig).name;
                        const venue = isPastEvent ? (item.data as ClubEvent).venue : undefined;
                        return (
                          <div key={item.type === "event" ? (item.data as ClubEvent).id : (item.data as TournamentConfig).id}
                            className={`flex items-center gap-3 px-5 py-3.5 transition-colors ${isDark ? "hover:bg-white/3" : "hover:bg-[#FBFADA]"}`}
                          >
                            <div className={`w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center ${isDark ? "bg-white/5" : "bg-[#FBFADA]/70"}`}>
                              {isPastEvent
                                ? <CheckCircle2 className={`w-4 h-4 ${textMuted}`} />
                                : <Trophy className={`w-4 h-4 ${textMuted}`} />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-medium truncate ${textMain}`}>{title}</p>
                              <p className={`text-xs ${textMuted}`}>
                                {new Date(item.startAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                {venue ? ` · ${venue}` : ""}
                              </p>
                            </div>
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${
                              isDark ? "bg-white/8 text-white/30" : "bg-[#ADBC9F]/40 text-[#436850]"
                            }`}>{isPastEvent ? "Past" : "Ended"}</span>
                          </div>
                        );
                                            })}
                      {filteredPast.length > 3 && (
                        <button
                          onClick={() => setShowAllPast(v => !v)}
                          className={`w-full py-3 text-xs font-semibold transition-colors ${
                            isDark ? "text-white/40 hover:text-white/70 hover:bg-white/3" : "text-[#436850] hover:text-[#436850] hover:bg-[#FBFADA]"
                          }`}
                        >
                          {showAllPast ? `Show Less` : `See All ${filteredPast.length} Past Events`}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
            {/* Create Event Modal */}
            {showCreateEvent && (isOwner || isDirector) && (
              <div
                className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
                style={{ background: "rgba(0,0,0,0.6)" }}
                onClick={closeCreateEvent}
              >
                <div
                  ref={createEventDialogRef}
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="club-create-event-title"
                  tabIndex={-1}
                  className={`w-full max-w-sm rounded-3xl border ${cardBorder} ${card} p-6 shadow-2xl animate-in slide-in-from-bottom-4 duration-300`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between mb-5">
                    <h2 id="club-create-event-title" className={`text-base font-bold ${textMain}`} style={{ fontFamily: "'Clash Display', sans-serif" }}>New Event</h2>
                    <button onClick={closeCreateEvent} aria-label="Close create event" className={`p-1.5 rounded-xl transition-colors ${isDark ? "text-white/40 hover:text-white hover:bg-white/8" : "text-[#436850] hover:text-[#12372A] hover:bg-[#ADBC9F]/50"}`}>
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="space-y-3">
                    {/* Cover Image Upload */}
                    <div>
                      <label className={`text-xs font-semibold uppercase tracking-wider ${textMuted} block mb-1.5`}>Cover Image</label>
                      {eventForm.coverImageUrl ? (
                        <div className="relative rounded-xl overflow-hidden" style={{ height: 120 }}>
                          <img src={eventForm.coverImageUrl} alt="Event cover" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => setEventForm(f => ({ ...f, coverImageUrl: "" }))}
                            className="absolute top-2 right-2 p-1 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <label className={`flex flex-col items-center justify-center gap-2 w-full rounded-xl border-2 border-dashed cursor-pointer transition-colors ${
                          isDark ? "border-white/15 hover:border-white/30 bg-white/3 hover:bg-white/5" : "border-[#ADBC9F] hover:border-[#436850]/40 bg-[#FBFADA]/70 hover:bg-[#ADBC9F]/50"
                        }`} style={{ height: 100 }}>
                          {uploadingCover ? (
                            <span className={`text-xs ${textMuted}`}>Uploading…</span>
                          ) : (
                            <>
                              <ImageIcon className={`w-6 h-6 ${textMuted} opacity-50`} />
                              <span className={`text-xs ${textMuted} opacity-70`}>Click to upload cover image</span>
                              <span className={`text-[10px] ${textMuted} opacity-40`}>JPG, PNG, WebP · max 5 MB</span>
                            </>
                          )}
                          <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            if (file.size > 5 * 1024 * 1024) { toast.error("Image too large (max 5 MB)"); return; }
                            setUploadingCover(true);
                            try {
                              const reader = new FileReader();
                              reader.onload = (ev) => {
                                const dataUrl = ev.target?.result as string;
                                setEventForm(f => ({ ...f, coverImageUrl: dataUrl }));
                                setUploadingCover(false);
                              };
                              reader.onerror = () => { toast.error("Failed to read image"); setUploadingCover(false); };
                              reader.readAsDataURL(file);
                            } catch { toast.error("Upload failed"); setUploadingCover(false); }
                          }} />
                        </label>
                      )}
                    </div>
                    <div>
                      <label className={`text-xs font-semibold uppercase tracking-wider ${textMuted} block mb-1.5`}>Title *</label>
                      <input
                        ref={createEventTitleRef}
                        aria-label="Event Title"
                        type="text"
                        value={eventForm.title}
                        onChange={(e) => setEventForm((f) => ({ ...f, title: e.target.value }))}
                        placeholder="e.g. Thursday Night Blitz"
                        className={`w-full px-3.5 py-2.5 rounded-xl text-sm border outline-none transition-colors ${
                          isDark ? "bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-white/25" : "bg-[#FBFADA]/70 border-[#ADBC9F] text-[#12372A] placeholder:text-[#436850] focus:border-[#436850]/40"
                        }`}
                      />
                    </div>
                    <div>
                      <label className={`text-xs font-semibold uppercase tracking-wider ${textMuted} block mb-1.5`}>Date & Time *</label>
                      <input
                        aria-label="Event Date & Time"
                        type="datetime-local"
                        value={eventForm.startAt}
                        onChange={(e) => setEventForm((f) => ({ ...f, startAt: e.target.value }))}
                        className={`w-full px-3.5 py-2.5 rounded-xl text-sm border outline-none transition-colors ${
                          isDark ? "bg-white/5 border-white/10 text-white focus:border-white/25" : "bg-[#FBFADA]/70 border-[#ADBC9F] text-[#12372A] focus:border-[#436850]/40"
                        }`}
                      />
                    </div>
                    <div>
                      <label className={`text-xs font-semibold uppercase tracking-wider ${textMuted} block mb-1.5`}>Venue</label>
                      <input
                        aria-label="Event Venue"
                        type="text"
                        value={eventForm.venue}
                        onChange={(e) => setEventForm((f) => ({ ...f, venue: e.target.value }))}
                        placeholder="e.g. Club Room 2B"
                        className={`w-full px-3.5 py-2.5 rounded-xl text-sm border outline-none transition-colors ${
                          isDark ? "bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-white/25" : "bg-[#FBFADA]/70 border-[#ADBC9F] text-[#12372A] placeholder:text-[#436850] focus:border-[#436850]/40"
                        }`}
                      />
                    </div>
                    <div>
                      <label className={`text-xs font-semibold uppercase tracking-wider ${textMuted} block mb-1.5`}>Description</label>
                      <textarea
                        aria-label="Event Description"
                        value={eventForm.description}
                        onChange={(e) => setEventForm((f) => ({ ...f, description: e.target.value }))}
                        placeholder="Optional event details..."
                        rows={2}
                        className={`w-full px-3.5 py-2.5 rounded-xl text-sm border outline-none transition-colors resize-none ${
                          isDark ? "bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-white/25" : "bg-[#FBFADA]/70 border-[#ADBC9F] text-[#12372A] placeholder:text-[#436850] focus:border-[#436850]/40"
                        }`}
                      />
                    </div>
                    <div>
                      <label className={`text-xs font-semibold uppercase tracking-wider ${textMuted} block mb-1.5`}>Admission</label>
                      <input
                        aria-label="Event Admission"
                        type="text"
                        value={eventForm.admissionNote}
                        onChange={(e) => setEventForm((f) => ({ ...f, admissionNote: e.target.value }))}
                        placeholder="e.g. Free with RSVP or $5 at door"
                        className={`w-full px-3.5 py-2.5 rounded-xl text-sm border outline-none transition-colors ${
                          isDark ? "bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-white/25" : "bg-[#FBFADA]/70 border-[#ADBC9F] text-[#12372A] placeholder:text-[#436850] focus:border-[#436850]/40"
                        }`}
                      />
                    </div>
                    {/* Recurrence */}
                    <div>
                      <label className={`text-xs font-semibold uppercase tracking-wider ${textMuted} block mb-1.5`}>Repeat</label>
                      <div className="flex gap-2 flex-wrap">
                        {(["none", "weekly", "biweekly", "monthly"] as const).map((opt) => (
                          <button key={opt} type="button"
                            onClick={() => setEventForm((f) => ({ ...f, recurrence: opt }))}
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                              eventForm.recurrence === opt
                                ? isDark ? "bg-[#4CAF50] text-black" : "bg-[#436850] text-white"
                                : isDark ? "bg-white/8 text-white/50 hover:bg-white/12" : "bg-[#ADBC9F]/40 text-[#436850] hover:bg-[#ADBC9F]"
                            }`}>
                            {opt === "none" ? "One-time" : opt === "biweekly" ? "Bi-weekly" : opt.charAt(0).toUpperCase() + opt.slice(1)}
                          </button>
                        ))}
                      </div>
                      {eventForm.recurrence !== "none" && (
                        <div className="mt-2">
                          <label className={`text-xs ${textMuted} block mb-1`}>End date (optional)</label>
                          <input type="date" value={eventForm.recurrenceEndDate}
                            aria-label="Event Recurrence End Date"
                            onChange={(e) => setEventForm((f) => ({ ...f, recurrenceEndDate: e.target.value }))}
                            className={`w-full px-3 py-2 rounded-xl text-sm border outline-none transition-colors ${
                              isDark ? "bg-white/5 border-white/10 text-white focus:border-white/25" : "bg-[#FBFADA]/70 border-[#ADBC9F] text-[#12372A] focus:border-[#436850]/40"
                            }`} />
                          <p className={`text-[10px] mt-1 ${textMuted} opacity-60`}>
                            {eventForm.recurrence === "weekly" ? "Up to 12 weekly occurrences" : eventForm.recurrence === "biweekly" ? "Up to 12 bi-weekly occurrences" : "Up to 6 monthly occurrences"}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    disabled={!eventForm.title.trim() || !eventForm.startAt || creatingEvent}
                    onClick={async () => {
                      if (!club || !user || !eventForm.title.trim() || !eventForm.startAt) return;
                      setCreatingEvent(true);
                      try {
                        const newEvent = createClubEvent({
                          clubId: club.id,
                          title: eventForm.title.trim(),
                          description: eventForm.description.trim() || undefined,
                          startAt: new Date(eventForm.startAt).toISOString(),
                          venue: eventForm.venue.trim() || undefined,
                          admissionNote: eventForm.admissionNote.trim() || undefined,
                          accentColor: club.accentColor ?? "#4CAF50",
                          creatorId: user.id,
                          creatorName: user.displayName,
                          isPublished: true,
                          coverImageUrl: eventForm.coverImageUrl || undefined,
                          recurrence: eventForm.recurrence !== "none" ? eventForm.recurrence : undefined,
                          recurrenceEndDate: eventForm.recurrence !== "none" && eventForm.recurrenceEndDate ? eventForm.recurrenceEndDate : undefined,
                        });
                        // Generate recurring instances and tag series
                        if (eventForm.recurrence !== "none") {
                          updateClubEvent(newEvent.id, { recurrenceSeriesId: newEvent.id });
                          createRecurringEvents(
                            { ...newEvent, recurrenceSeriesId: newEvent.id },
                            eventForm.recurrence,
                            eventForm.recurrenceEndDate || undefined
                          );
                        }
                        setClubEvents(listClubEvents(club.id));
                        setShowCreateEvent(false);
                        setEventForm({ title: "", description: "", startAt: "", venue: "", admissionNote: "", recurrence: "none", recurrenceEndDate: "", coverImageUrl: "" });
                        const seriesNote = eventForm.recurrence !== "none" ? " (series created)" : "";
                        toast.success(`"${newEvent.title}" created${seriesNote}`);
                      } catch {
                        toast.error("Failed to create event");
                      } finally {
                        setCreatingEvent(false);
                      }
                    }}
                    className={`w-full mt-4 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed ${
                      isDark ? "bg-[#4CAF50] text-black hover:bg-[#45a049]" : "bg-[#436850] text-white hover:bg-[#3a5230]"
                    }`}
                  >
                    {creatingEvent ? "Creating..." : eventForm.recurrence !== "none" ? "Create Series" : "Create Event"}
                  </button>
                </div>
              </div>
            )}
          </div>
          );
        })()}

        {/* ── Tournaments tab — merged into Events tab via filter chips ── */}
        {(activeTab as string) === "tournaments" && (         <div className="space-y-4 animate-in fade-in duration-200">

            {/* ── Owner-only Host Tournament CTA ────────────────────────────── */}
            {isOwner ? (
              <button
                onClick={() => setShowWizard(true)}
                className="w-full flex items-center justify-center gap-2 py-3 px-5 rounded-2xl border-2 border-dashed border-[#436850]/40 text-sm font-semibold transition-all hover:border-[#436850] hover:bg-[#436850]/8 group"
              >
                <PlusCircle className={`w-4 h-4 transition-colors ${isDark ? "text-[#4CAF50] group-hover:text-[#66BB6A]" : "text-[#436850] group-hover:text-[#3a5230]"}`} />
                <span className={isDark ? "text-[#4CAF50] group-hover:text-[#66BB6A]" : "text-[#436850] group-hover:text-[#3a5230]"}>
                  Host a Tournament for {club.name}
                </span>
              </button>
            ) : user && joined ? (
              /* Member / Director — locked, informational only */
              <div
                className={`w-full flex items-center gap-3 py-3 px-5 rounded-2xl border ${cardBorder} ${isDark ? "bg-white/2" : "bg-[#FBFADA]/70"} cursor-not-allowed`}
                title="Only the club owner can create tournaments"
              >
                <Lock className={`w-4 h-4 flex-shrink-0 ${textMuted}`} />
                <span className={`text-sm ${textMuted}`}>
                  Only the club owner can host tournaments here.
                </span>
              </div>
            ) : null}

            {/* Format filter chips */}
            <div className="flex gap-2 flex-wrap">
              {(["all", "swiss", "roundrobin", "arena"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setTourneyFormatFilter(f)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                    tourneyFormatFilter === f
                      ? isDark ? "bg-[#4CAF50]/15 text-[#4CAF50] border border-[#4CAF50]/30" : "bg-[#436850]/10 text-[#436850] border border-[#436850]/20"
                      : isDark ? "bg-white/6 text-white/50 hover:text-white border border-transparent" : "bg-[#ADBC9F]/40 text-[#436850] hover:text-[#12372A] border border-transparent"
                  }`}
                >
                  {f === "all" ? "All Formats" : f === "swiss" ? "Swiss" : f === "roundrobin" ? "Round Robin" : "Arena"}
                </button>
              ))}
            </div>

            {/* Upcoming & Active — seed data (no director state, use TournamentRow) */}
            {upcomingTournaments.filter((t) => tourneyFormatFilter === "all" || t.format === tourneyFormatFilter).length > 0 && (
              <div className={`rounded-3xl border ${cardBorder} ${card} overflow-hidden`}>
                <div className={`px-5 py-4 border-b ${divider}`}>
                  <h2 className={`text-sm font-semibold uppercase tracking-wider ${isDark ? "text-white/40" : "text-[#436850]"}`}>Upcoming & Active</h2>
                </div>
                <div className={`divide-y ${isDark ? "divide-white/5" : "divide-gray-100"}`}>
                  {upcomingTournaments.filter((t) => tourneyFormatFilter === "all" || t.format === tourneyFormatFilter).map((t) => (
                    <TournamentRow key={t.tournamentId} tournament={t} isDark={isDark} textMuted={textMuted} />
                  ))}
                </div>
              </div>
            )}

            {/* Live upcoming tournaments created via wizard — TournamentCard with bracket/standings */}
            {liveUpcoming.filter((t) => tourneyFormatFilter === "all" || t.format === tourneyFormatFilter).length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <h2 className={`text-sm font-semibold uppercase tracking-wider ${isDark ? "text-white/40" : "text-[#436850]"}`}>Upcoming</h2>
                  <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-green-500/15 text-green-600">Live</span>
                </div>
                {liveUpcoming.filter((t) => tourneyFormatFilter === "all" || t.format === tourneyFormatFilter).map((t) => (
                  <TournamentCard
                    key={t.id}
                    tournament={t}
                    isDark={isDark}
                    textMain={textMain}
                    textMuted={textMuted}
                    divider={divider}
                    card={card}
                    cardBorder={cardBorder}
                    accent={accent}
                  />
                ))}
              </div>
            )}

            {/* Tournament Recaps — links to published recap pages */}
            {clubRecaps.length > 0 && (
              <div className={`rounded-3xl border ${cardBorder} ${card} overflow-hidden`}>
                <div className={`px-5 py-4 border-b ${divider}`}>
                  <h2 className={`text-sm font-semibold uppercase tracking-wider ${isDark ? "text-white/40" : "text-[#436850]"}`}>Tournament Recaps</h2>
                </div>
                <div className={`divide-y ${isDark ? "divide-white/5" : "divide-gray-100"}`}>
                  {clubRecaps.map((recap) => (
                    <a
                      key={recap.id}
                      href={`/recap/${recap.slug}`}
                      className={`flex items-center justify-between px-5 py-3.5 transition-colors ${isDark ? "hover:bg-white/3" : "hover:bg-[#FBFADA]/50"}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${isDark ? "bg-amber-500/10" : "bg-amber-50"}`}>
                          <Trophy className={`w-4 h-4 ${isDark ? "text-amber-400" : "text-amber-600"}`} />
                        </div>
                        <div className="min-w-0">
                          <p className={`text-sm font-medium truncate ${isDark ? "text-white" : "text-[#12372A]"}`}>
                            {recap.tournamentName || "Tournament Recap"}
                          </p>
                          <p className={`text-xs ${textMuted}`}>
                            {recap.eventDate || ""}{recap.playerCount ? ` • ${recap.playerCount} players` : ""}{recap.format ? ` • ${recap.format}` : ""}
                          </p>
                        </div>
                      </div>
                      <ExternalLink className={`w-3.5 h-3.5 flex-shrink-0 ${textMuted}`} />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Past tournaments — seed data (no director state, use TournamentRow) */}
            {completedTournaments.filter((t) => tourneyFormatFilter === "all" || t.format === tourneyFormatFilter).length > 0 && (
              <div className={`rounded-3xl border ${cardBorder} ${card} overflow-hidden`}>
                <div className={`px-5 py-4 border-b ${divider}`}>
                  <h2 className={`text-sm font-semibold uppercase tracking-wider ${isDark ? "text-white/40" : "text-[#436850]"}`}>Past Tournaments</h2>
                </div>
                <div className={`divide-y ${isDark ? "divide-white/5" : "divide-gray-100"}`}>
                  {completedTournaments.filter((t) => tourneyFormatFilter === "all" || t.format === tourneyFormatFilter).map((t) => (
                    <TournamentRow key={t.tournamentId} tournament={t} isDark={isDark} textMuted={textMuted} />
                  ))}
                </div>
              </div>
            )}

            {/* Live past tournaments created via wizard — TournamentCard with bracket/standings */}
            {livePast.filter((t) => tourneyFormatFilter === "all" || t.format === tourneyFormatFilter).length > 0 && (
              <div className="space-y-3">
                <h2 className={`text-sm font-semibold uppercase tracking-wider ${isDark ? "text-white/40" : "text-[#436850]"}`}>Past Tournaments</h2>
                {livePast.filter((t) => tourneyFormatFilter === "all" || t.format === tourneyFormatFilter).map((t) => (
                  <TournamentCard
                    key={t.id}
                    tournament={t}
                    isDark={isDark}
                    textMain={textMain}
                    textMuted={textMuted}
                    divider={divider}
                    card={card}
                    cardBorder={cardBorder}
                    accent={accent}
                  />
                ))}
              </div>
            )}

            {(() => {
              const filteredUpcoming = upcomingTournaments.filter((t) => tourneyFormatFilter === "all" || t.format === tourneyFormatFilter);
              const filteredLiveUpcoming = liveUpcoming.filter((t) => tourneyFormatFilter === "all" || t.format === tourneyFormatFilter);
              const filteredCompleted = completedTournaments.filter((t) => tourneyFormatFilter === "all" || t.format === tourneyFormatFilter);
              const filteredLivePast = livePast.filter((t) => tourneyFormatFilter === "all" || t.format === tourneyFormatFilter);
              const noFilteredResults = filteredUpcoming.length === 0 && filteredLiveUpcoming.length === 0 && filteredCompleted.length === 0 && filteredLivePast.length === 0;
              if (!hasAnyTournaments || (hasAnyTournaments && noFilteredResults && tourneyFormatFilter !== "all")) {
                return (
                  <div className={`rounded-3xl border ${cardBorder} ${card} py-16 text-center`}>
                    <Trophy className={`w-10 h-10 mx-auto mb-3 ${textMuted}`} />
                    <p className={`text-sm font-semibold ${textMain} mb-1`}>
                      {tourneyFormatFilter !== "all" ? `No ${tourneyFormatFilter} tournaments` : "No tournaments yet"}
                    </p>
                    {tourneyFormatFilter !== "all" ? (
                      <p className={`text-xs ${textMuted}`}>
                        Try selecting "All Formats" to see all tournaments.
                      </p>
                    ) : isOwner ? (
                      <p className={`text-xs ${textMuted}`}>
                        Use the button above to host your first tournament.
                      </p>
                    ) : (
                      <p className={`text-xs ${textMuted}`}>
                        The club owner hasn't hosted any tournaments yet.
                      </p>
                    )}
                  </div>
                );
              }
              return null;
            })()}
          </div>
        )}

        {/* ── Leagues tab ──────────────────────────────────────────────────── */}
        {activeTab === "album" && (
          <ClubAlbumTab
            clubId={club.id}
            clubName={club.name}
            clubAvatarUrl={club.avatarUrl}
            canManage={isOwner || isDirector}
            currentUserName={user?.displayName ?? club.ownerName}
            accent={accent}
            isDark={isDark}
          />
        )}

        {activeTab === "leagues" && (
          !joined ? (
            <div className={`rounded-3xl border ${cardBorder} ${card} p-8 flex flex-col items-center text-center gap-3`}>
              <div>
                <h3 className={`text-lg font-bold tracking-tight sm:text-xl mb-1.5 ${textMain}`}>Members-only Leagues</h3>
                <p className={`text-sm ${textMuted} max-w-xs`}>Club leagues and standings are only visible to members. Join to compete and track your progress.</p>
              </div>
              <button onClick={() => { if (!user) { setAuthOpen(true); } else { handleJoin(); } }} className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-105 ${isDark ? "bg-[#4CAF50] text-black hover:bg-[#66BB6A]" : "bg-[#436850] text-white hover:bg-[#3a5230]"}`}>Join Club</button>
            </div>
          ) :
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Commissioner CTA */}
            {isOwner && (
              <button
                onClick={() => setShowCreateLeague(true)}
                className="w-full flex items-center justify-center gap-2 py-3 px-5 rounded-2xl border-2 border-dashed border-[#436850]/40 text-sm font-semibold transition-all hover:border-[#436850] hover:bg-[#436850]/8 group"
              >
                <PlusCircle className={`w-4 h-4 transition-colors ${isDark ? "text-[#4CAF50] group-hover:text-[#66BB6A]" : "text-[#436850] group-hover:text-[#3a5230]"}`} />
                <span className={isDark ? "text-[#4CAF50] group-hover:text-[#66BB6A]" : "text-[#436850] group-hover:text-[#3a5230]"}>
                  Create a League for {club.name}
                </span>
              </button>
            )}

            {/* Create league wizard (2-step) */}
            {showCreateLeague && (
              <div className={`rounded-3xl border ${cardBorder} ${card} p-5 space-y-4`}>
                {/* Step indicator */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: "oklch(0.55 0.13 145)", color: "#fff" }}>1</div>
                    <span className={`text-xs font-medium ${leagueWizardStep === 1 ? textMain : textMuted}`}>Details</span>
                  </div>
                  <div className={`flex-1 h-px ${isDark ? "bg-white/10" : "bg-[#ADBC9F]"}`} />
                  <div className="flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: leagueWizardStep === 2 ? "oklch(0.55 0.13 145)" : (isDark ? "rgba(255,255,255,0.1)" : "#e5e7eb"), color: leagueWizardStep === 2 ? "#fff" : (isDark ? "rgba(255,255,255,0.3)" : "#9ca3af") }}>2</div>
                    <span className={`text-xs font-medium ${leagueWizardStep === 2 ? textMain : textMuted}`}>Players</span>
                  </div>
                </div>

                {/* Step 1: League details */}
                {leagueWizardStep === 1 && (
                  <div className="space-y-3">
                    <div>
                      <label className={`text-xs font-medium block mb-1 ${textMuted}`}>League Name *</label>
                      <input
                        aria-label="League Name"
                        autoFocus
                        className={`w-full rounded-xl px-4 py-2.5 text-sm border outline-none focus:ring-2 focus:ring-[#4CAF50]/40 ${isDark ? "bg-white/5 border-white/10 text-white placeholder-white/30" : "bg-[#FBFADA]/70 border-[#ADBC9F] text-[#12372A] placeholder-gray-400"}`}
                        placeholder="e.g. Spring 2026 League"
                        value={leagueForm.name}
                        onChange={(e) => setLeagueForm((f) => ({ ...f, name: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className={`text-xs font-medium block mb-1 ${textMuted}`}>Description <span className={textMuted}>(optional)</span></label>
                      <textarea
                        aria-label="League Description"
                        rows={2}
                        className={`w-full rounded-xl px-4 py-2.5 text-sm border outline-none focus:ring-2 focus:ring-[#4CAF50]/40 resize-none ${isDark ? "bg-white/5 border-white/10 text-white placeholder-white/30" : "bg-[#FBFADA]/70 border-[#ADBC9F] text-[#12372A] placeholder-gray-400"}`}
                        placeholder="Brief description…"
                        value={leagueForm.description}
                        onChange={(e) => setLeagueForm((f) => ({ ...f, description: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className={`text-xs font-medium block mb-1 ${textMuted}`}>Number of Players</label>
                      <div className="grid grid-cols-4 gap-2">
                        {[4, 6, 8, 10].map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setLeagueForm((f) => ({ ...f, maxPlayers: n }))}
                            className="py-2 rounded-xl text-sm font-semibold border transition-all"
                            style={{
                              background: leagueForm.maxPlayers === n ? "oklch(0.55 0.13 145)" : (isDark ? "rgba(255,255,255,0.05)" : "#f9fafb"),
                              borderColor: leagueForm.maxPlayers === n ? "oklch(0.55 0.13 145)" : (isDark ? "rgba(255,255,255,0.1)" : "#e5e7eb"),
                              color: leagueForm.maxPlayers === n ? "#fff" : (isDark ? "rgba(255,255,255,0.6)" : "#6b7280"),
                            }}
                          >{n}</button>
                        ))}
                      </div>
                      <p className={`text-xs mt-1.5 ${textMuted}`}>Season will be {leagueForm.maxPlayers - 1} weeks (round-robin)</p>
                    </div>
                    <div className="flex gap-3 pt-1">
                      <button
                        type="button"
                        onClick={() => { setShowCreateLeague(false); setLeagueForm({ name: "", description: "", maxPlayers: 8, totalWeeks: 7 }); setLeagueWizardStep(1); setSelectedPlayerIds([]); }}
                        className={`py-2.5 px-4 rounded-xl text-sm font-medium transition-opacity hover:opacity-70 ${isDark ? "bg-white/8 text-white/60" : "bg-[#ADBC9F]/40 text-[#436850]"}`}
                      >Cancel</button>
                      <button
                        type="button"
                        disabled={!leagueForm.name.trim()}
                        onClick={() => { setLeagueWizardStep(2); setSelectedPlayerIds([]); }}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-40 border ${isDark ? "border-white/10 text-white/60 hover:border-white/20" : "border-[#ADBC9F] text-[#436850] hover:border-[#ADBC9F]"}`}
                      >Next: Pick Players →</button>
                      <button
                        type="button"
                        disabled={!leagueForm.name.trim() || creatingLeague}
                        onClick={async () => {
                          if (!club) return;
                          setCreatingLeague(true);
                          try {
                            const created = await apiFetch<{ leagueId?: string; id?: string }>("/api/leagues", {
                              method: "POST",
                              body: JSON.stringify({
                                clubId: club.id,
                                name: leagueForm.name.trim(),
                                description: leagueForm.description.trim() || null,
                                maxPlayers: leagueForm.maxPlayers,
                              }),
                            });
                            const newLeagueId = created.leagueId ?? created.id;
                            setClubLeagues((prev) => [{ id: newLeagueId!, name: leagueForm.name.trim(), status: "draft", currentWeek: 0, totalWeeks: leagueForm.maxPlayers - 1, maxPlayers: leagueForm.maxPlayers, playerCount: 0 }, ...prev]);
                            setShowCreateLeague(false);
                            setLeagueForm({ name: "", description: "", maxPlayers: 8, totalWeeks: 7 });
                            setLeagueWizardStep(1);
                            setSelectedPlayerIds([]);
                            toast.success(`League "${leagueForm.name.trim()}" created in Draft mode!`);
                            navigate(`/leagues/${newLeagueId}`);
                          } finally {
                            setCreatingLeague(false);
                          }
                        }}
                        className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
                        style={{ background: "oklch(0.55 0.13 145)", color: "#fff" }}
                      >{creatingLeague ? "Creating…" : "Create Draft League"}</button>
                    </div>
                    <p className={`text-xs text-center ${textMuted}`}>You can add players later via invites and join requests</p>
                  </div>
                )}

                {/* Step 2: Pick players from club members */}
                {leagueWizardStep === 2 && (() => {
                  const needed = leagueForm.maxPlayers;
                  const picked = selectedPlayerIds.length;
                  const eligibleMembers = members.filter((m) => m.userId);
                  return (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className={`text-sm font-semibold ${textMain}`}>Select {needed} players</p>
                        <span
                          className="text-xs px-2 py-0.5 rounded-full font-semibold"
                          style={{
                            background: picked === needed ? "oklch(0.55 0.13 145 / 0.15)" : (isDark ? "rgba(255,255,255,0.08)" : "#f3f4f6"),
                            color: picked === needed ? "oklch(0.55 0.13 145)" : (isDark ? "rgba(255,255,255,0.5)" : "#6b7280"),
                          }}
                        >{picked}/{needed}</span>
                      </div>
                      {eligibleMembers.length < needed ? (
                        <div className={`py-6 text-center rounded-2xl border ${cardBorder}`}>
                          <p className={`text-sm font-semibold ${textMain} mb-1`}>Not enough members</p>
                          <p className={`text-xs ${textMuted}`}>You need at least {needed} club members. Invite more members first.</p>
                        </div>
                      ) : (
                        <div className={`rounded-2xl border ${cardBorder} overflow-hidden`} style={{ maxHeight: "16rem", overflowY: "auto" }}>
                          {eligibleMembers.map((m) => {
                            const sel = selectedPlayerIds.includes(m.userId);
                            const disabled = !sel && picked >= needed;
                            return (
                              <button
                                type="button"
                                key={m.userId}
                                disabled={disabled}
                                onClick={() => setSelectedPlayerIds((prev) => sel ? prev.filter((id) => id !== m.userId) : [...prev, m.userId])}
                                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b last:border-b-0 ${isDark ? "border-white/5" : "border-[#ADBC9F]/70"} ${disabled ? "opacity-30" : ""}`}
                                style={{ background: sel ? "oklch(0.55 0.13 145 / 0.12)" : "transparent" }}
                              >
                                <div className="w-8 h-8 rounded-full flex-shrink-0 overflow-hidden">
                                  <PlayerAvatar
                                    username={m.chesscomUsername ?? m.lichessUsername ?? m.displayName}
                                    platform={m.chesscomUsername ? "chesscom" : m.lichessUsername ? "lichess" : undefined}
                                    name={m.displayName}
                                    size={32}
                                    showBadge={false}
                                  />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className={`text-sm font-semibold truncate ${textMain}`}>{m.displayName ?? m.userId}</p>
                                  {m.chesscomUsername && <p className={`text-xs truncate ${textMuted}`}>chess.com/{m.chesscomUsername}</p>}
                                </div>
                                {sel && (
                                  <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "oklch(0.55 0.13 145)" }}>
                                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4l2.5 2.5L9 1" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                      <div className="flex gap-3 pt-1">
                        <button
                          type="button"
                          onClick={() => setLeagueWizardStep(1)}
                          className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-opacity hover:opacity-70 ${isDark ? "bg-white/8 text-white/60" : "bg-[#ADBC9F]/40 text-[#436850]"}`}
                        >← Back</button>
                        <button
                          type="button"
                          disabled={picked === 0 || creatingLeague}
                          onClick={async () => {
                            if (!club || picked === 0) return;
                            setCreatingLeague(true);
                            try {
                              const created2 = await apiFetch<{ leagueId?: string; id?: string }>("/api/leagues", {
                                method: "POST",
                                body: JSON.stringify({
                                  clubId: club.id,
                                  name: leagueForm.name.trim(),
                                  description: leagueForm.description.trim() || null,
                                  maxPlayers: leagueForm.maxPlayers,
                                  playerIds: selectedPlayerIds,
                                }),
                              });
                              const newLeagueId2 = created2.leagueId ?? created2.id;
                              setClubLeagues((prev) => [{ id: newLeagueId2!, name: leagueForm.name.trim(), status: "draft", currentWeek: 0, totalWeeks: leagueForm.maxPlayers - 1, maxPlayers: leagueForm.maxPlayers, playerCount: picked }, ...prev]);
                              setShowCreateLeague(false);
                              setLeagueForm({ name: "", description: "", maxPlayers: 8, totalWeeks: 7 });
                              setLeagueWizardStep(1);
                              setSelectedPlayerIds([]);
                              toast.success(`League "${leagueForm.name.trim()}" created in Draft mode with ${picked} player${picked !== 1 ? "s" : ""}!`);
                              navigate(`/leagues/${newLeagueId2}`);
                            } finally {
                              setCreatingLeague(false);
                            }
                          }}
                          className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
                          style={{ background: "oklch(0.55 0.13 145)", color: "#fff" }}
                        >{creatingLeague ? "Creating…" : `Create Draft League (${picked}/${needed})`}</button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* League list */}
            {leaguesLoading ? (
              <div className={`rounded-3xl border ${cardBorder} ${card} py-12 flex items-center justify-center`}>
                <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "oklch(0.55 0.13 145) transparent oklch(0.55 0.13 145) oklch(0.55 0.13 145)" }} />
              </div>
            ) : clubLeagues.length === 0 && !showCreateLeague ? (
              <div className={`rounded-3xl border ${cardBorder} ${card} overflow-hidden relative`} style={{ minHeight: 320 }}>
                {/* Chess-grid SVG background motif */}
                <svg aria-hidden="true" className="absolute inset-0 w-full h-full opacity-[0.035] pointer-events-none" style={{ zIndex: 0 }} xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <pattern id="chess-empty-leagues" x="0" y="0" width="32" height="32" patternUnits="userSpaceOnUse">
                      <rect x="0" y="0" width="16" height="16" fill={isDark ? "#fff" : "#12372A"} />
                      <rect x="16" y="16" width="16" height="16" fill={isDark ? "#fff" : "#12372A"} />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#chess-empty-leagues)" />
                </svg>
                {/* Radial glow */}
                <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 1, background: isDark ? "radial-gradient(ellipse 60% 55% at 50% 45%, oklch(0.55 0.13 145 / 0.13) 0%, transparent 75%)" : "radial-gradient(ellipse 60% 55% at 50% 45%, oklch(0.55 0.13 145 / 0.07) 0%, transparent 75%)" }} />
                {/* Content */}
                <div className="relative flex flex-col items-center justify-center text-center px-8 py-20" style={{ zIndex: 2 }}>
                  {/* Icon with glow ring */}
                  <div className="relative mb-6">
                    <div className="absolute inset-0 rounded-full blur-2xl opacity-40" style={{ background: "oklch(0.55 0.13 145)", transform: "scale(1.8)" }} />
                    <div className={`relative w-20 h-20 rounded-3xl flex items-center justify-center ${
                      isDark ? "bg-[oklch(0.55_0.13_145/0.15)] border border-[oklch(0.55_0.13_145/0.25)]" : "bg-[oklch(0.55_0.13_145/0.10)] border border-[oklch(0.55_0.13_145/0.20)]"
                    }`}>
                      <Award className={`w-9 h-9 ${isDark ? "text-[#4CAF50]" : "text-[#436850]"}`} strokeWidth={1.5} />
                    </div>
                  </div>
                  {/* Headline */}
                  <h3 className={`text-xl font-bold tracking-tight mb-2 ${textMain}`} style={{ fontFamily: "'Clash Display', sans-serif" }}>
                    No leagues yet
                  </h3>
                  {/* Sub-copy — context aware */}
                  <p className={`text-sm leading-relaxed max-w-xs mb-8 ${textMuted}`}>
                    {isOwner
                      ? "Leagues keep members engaged week over week. Create a round-robin or Swiss league and let the standings speak."
                      : joined
                      ? "This club hasn't started a league yet. Let the director know you're interested — it only takes a nudge!"
                      : "Join this club to participate in leagues when they start."}
                  </p>
                  {/* CTAs */}
                  {isOwner ? (
                    <div className="flex flex-col sm:flex-row items-center gap-3">
                      <button
                        onClick={() => setShowCreateLeague(true)}
                        className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold transition-all hover:scale-[1.03] active:scale-[0.98]"
                        style={{ background: "oklch(0.55 0.13 145)", color: "#fff", boxShadow: "0 4px 20px oklch(0.55 0.13 145 / 0.35)" }}
                      >
                        <PlusCircle className="w-4 h-4" strokeWidth={2} />
                        Create First League
                      </button>
                    </div>
                  ) : joined ? (
                    <button
                      onClick={() => toast.success("Your interest has been noted! The club director will be notified.")}
                      className={`inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold transition-all hover:scale-[1.03] active:scale-[0.98] ${
                        isDark ? "bg-white/8 text-white/80 hover:bg-white/14 border border-white/10" : "bg-[#ADBC9F]/40 text-[#12372A] hover:bg-[#ADBC9F]/70 border border-[#ADBC9F]/60"
                      }`}
                    >
                      <Sparkles className="w-4 h-4" strokeWidth={2} />
                      Request a League
                    </button>
                  ) : (
                    <button
                      onClick={() => { if (!user) { setAuthOpen(true); } else { handleJoin(); } }}
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold transition-all hover:scale-[1.03] active:scale-[0.98]"
                      style={{ background: "oklch(0.55 0.13 145)", color: "#fff", boxShadow: "0 4px 20px oklch(0.55 0.13 145 / 0.35)" }}
                    >
                      Join Club
                      <ArrowRight className="w-4 h-4" strokeWidth={2} />
                    </button>
                  )}
                </div>
              </div>
            ) : (() => {
              const activeLeagues = clubLeagues.filter((lg) => lg.status !== "completed");
              const completedLeagues = clubLeagues.filter((lg) => lg.status === "completed");
              const handleRequestJoin = async (e: React.MouseEvent, lgId: string) => {
                e.stopPropagation();
                if (!user) { setAuthOpen(true); return; }
                setRequestingLeagueId(lgId);
                try {
                  try {
                    await apiFetch(`/api/leagues/${lgId}/join-request`, { method: "POST" });
                    setRequestedLeagueIds((prev) => { const n = new Set(Array.from(prev)); n.add(lgId); return n; });
                    toast.success("Request sent! The commissioner will review it.");
                  } catch (joinErr: unknown) {
                    const msg = joinErr instanceof Error ? joinErr.message : "";
                    if (msg.includes("409") || msg.toLowerCase().includes("already")) {
                      setRequestedLeagueIds((prev) => { const n = new Set(Array.from(prev)); n.add(lgId); return n; });
                      toast.info(msg || "Request already submitted");
                    } else {
                      toast.error(msg || "Failed to send request");
                    }
                  }
                } catch {
                  toast.error("Network error — please try again");
                } finally {
                  setRequestingLeagueId(null);
                }
              };
              const LeagueRow = ({ lg }: { lg: typeof clubLeagues[0] }) => {
                const isDraft = lg.status === "draft";
                const hasRequested = requestedLeagueIds.has(lg.id);
                const isRequesting = requestingLeagueId === lg.id;
                const canRequest = isDraft && !isOwner && joined && user;
                return (
                  <div
                    key={lg.id}
                    className={`w-full flex items-center gap-4 px-5 py-4 text-left transition-colors cursor-pointer ${isDark ? "hover:bg-white/3" : "hover:bg-[#FBFADA]"}`}
                    onClick={() => navigate(`/leagues/${lg.id}`)}
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${lg.status === "completed" ? (isDark ? "bg-yellow-500/15" : "bg-yellow-50") : isDraft ? (isDark ? "bg-white/5" : "bg-[#FBFADA]/70") : (isDark ? "bg-[#4CAF50]/15" : "bg-green-50")}`}>
                      <Trophy className={`w-4 h-4 ${lg.status === "completed" ? "text-yellow-500" : isDraft ? (isDark ? "text-white/30" : "text-[#436850]") : "text-[#4CAF50]"}`} strokeWidth={1.8} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold truncate ${textMain}`}>{lg.name}</p>
                      <p className={`text-xs ${textMuted}`}>
                        {lg.status === "completed"
                          ? `${lg.totalWeeks} weeks · ${lg.playerCount} players · Season complete`
                          : isDraft
                          ? `${lg.playerCount}/${lg.maxPlayers ?? lg.playerCount} players · Forming up`
                          : `Week ${lg.currentWeek}/${lg.totalWeeks} · ${lg.playerCount} players`
                        }
                      </p>
                    </div>
                    {canRequest ? (
                      <button
                        onClick={(e) => handleRequestJoin(e, lg.id)}
                        disabled={hasRequested || isRequesting}
                        className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                        style={{
                          background: hasRequested ? (isDark ? "rgba(255,255,255,0.05)" : "#f3f4f6") : "oklch(0.55 0.13 145 / 0.15)",
                          color: hasRequested ? (isDark ? "rgba(255,255,255,0.3)" : "#9ca3af") : "oklch(0.55 0.13 145)",
                          cursor: hasRequested ? "default" : "pointer",
                        }}
                      >
                        {isRequesting ? (
                          <span className="w-3 h-3 rounded-full border border-t-transparent animate-spin" style={{ borderColor: "oklch(0.55 0.13 145) transparent oklch(0.55 0.13 145) oklch(0.55 0.13 145)" }} />
                        ) : hasRequested ? (
                          <><svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg> Requested</>
                        ) : (
                          <><svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M5 2v6M2 5h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> Request to Join</>
                        )}
                      </button>
                    ) : (
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0"
                        style={{
                          background: lg.status === "active" ? "oklch(0.55 0.13 145 / 0.15)" : lg.status === "completed" ? "oklch(0.82 0.18 85 / 0.15)" : (isDark ? "rgba(255,255,255,0.06)" : "#f3f4f6"),
                          color: lg.status === "active" ? "oklch(0.55 0.13 145)" : lg.status === "completed" ? "oklch(0.72 0.18 85)" : (isDark ? "rgba(255,255,255,0.4)" : "#6b7280"),
                        }}
                      >
                        {lg.status === "active" ? "Active" : lg.status === "completed" ? "🏆 Complete" : "Draft"}
                      </span>
                    )}
                  </div>
                );
              };
              return (
                <div className="space-y-4">
                  {/* Active / Draft leagues — expandable LeagueCard */}
                  {activeLeagues.length > 0 && (
                    <div className="space-y-3">
                      {activeLeagues.map((lg) => (
                        <LeagueCard
                          key={lg.id}
                          lg={lg}
                          isDark={isDark}
                          textMain={textMain}
                          textMuted={textMuted}
                          divider={divider}
                          card={card}
                          cardBorder={cardBorder}
                          accent={accent}
                          onNavigate={navigate}
                        />
                      ))}
                    </div>
                  )}
                  {/* Past Seasons — expandable LeagueCard */}
                  {completedLeagues.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 px-1 mb-2">
                        <span className={`text-xs font-semibold uppercase tracking-wide ${textMuted}`}>Past Seasons</span>
                        <span className={`text-xs ${textMuted} opacity-50`}>· {completedLeagues.length}</span>
                      </div>
                      <div className="space-y-3">
                        {completedLeagues.map((lg) => (
                          <LeagueCard
                            key={lg.id}
                            lg={lg}
                            isDark={isDark}
                            textMain={textMain}
                            textMuted={textMuted}
                            divider={divider}
                            card={card}
                            cardBorder={cardBorder}
                            accent={accent}
                            onNavigate={navigate}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
                    </div>
        )}


            </div>{/* close max-w-6xl */}
          </div>{/* close padded content */}
          </div>{/* close scrollable */}
        </div>{/* close main content area */}
      </div>{/* close flex h-screen */}
      {/* ── Tournament Wizard (owner-only, pre-linked to this club) ──────────── */}
      <TournamentWizard
        open={showWizard}
        onClose={(createdTournamentId?: string, createdTournamentName?: string) => {
          setShowWizard(false);
          if (club) {
            // Refresh live tournament list
            const updated = listTournamentsByClub(club.id);
            setLiveTournaments(updated);
            // Sync the denormalised tournamentCount stat and refresh club state
            syncClubTournamentCount(club.id);
            const refreshed = getClub(club.id);
            if (refreshed) setClub(refreshed);
            // Post a feed event and auto-create club event if a new tournament was created
            if (createdTournamentId && createdTournamentName) {
              // Auto-create a club event linked to this tournament
              const tCfg = getTournamentConfig(createdTournamentId);
              const tournamentStartAt = tCfg?.date
                ? new Date(tCfg.date + "T00:00:00").toISOString()
                : new Date().toISOString();
              const linkedEvent = createClubEvent({
                clubId: club.id,
                title: createdTournamentName,
                description: `Club tournament hosted by ${club.name}. Join and track results live.`,
                startAt: tournamentStartAt,
                venue: tCfg?.venue ?? undefined,
                creatorId: user?.id ?? "",
                creatorName: user?.displayName ?? club.ownerName,
                accentColor: club.accentColor,
                isPublished: true,
                eventType: "standard",
                tournamentId: createdTournamentId,
              });
              recordTournamentCreated(
                club.id,
                user?.displayName ?? club.ownerName,
                createdTournamentName,
                createdTournamentId
              );
              setFeedEvents(listFeedEvents(club.id));
              navigate(`/clubs/${club.id}/meetup/${linkedEvent.id}`);
            }
          }
        }}
        initialClubId={club.id}
        initialClubName={club.name}
      />

      {/* ── Club Settings Panel (owner/director only) ──────────────────────── */}
      {showSettings && club && (isOwner || isDirector) && (
        <div
          className="modal-overlay z-50"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={closeSettings}
        >
          <div
            ref={settingsDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="club-settings-title"
            tabIndex={-1}
            className={`w-full max-w-sm rounded-3xl border ${cardBorder} ${card} p-6 shadow-2xl animate-in slide-in-from-bottom-4 duration-300`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <h2
                id="club-settings-title"
                className={`text-base font-bold ${textMain}`}
                style={{ fontFamily: "'Clash Display', sans-serif" }}
              >
                Club Settings
              </h2>
              <button
                ref={settingsCloseRef}
                onClick={closeSettings}
                aria-label="Close club settings"
                className={`p-1.5 rounded-xl transition-colors ${isDark ? "text-white/40 hover:text-white hover:bg-white/8" : "text-[#436850] hover:text-[#12372A] hover:bg-[#ADBC9F]/50"}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Avatar section */}
            <div className={`rounded-2xl border ${cardBorder} p-5 mb-3 ${isDark ? "bg-white/3" : "bg-[#FBFADA]/70"}`}>
              <p className={`text-xs font-semibold uppercase tracking-wider mb-4 ${isDark ? "text-white/40" : "text-[#436850]"}`}>
                Club Avatar
              </p>
              <div className="flex items-center gap-5">
                <ClubAvatarUpload
                  value={pendingAvatar !== undefined ? pendingAvatar : club.avatarUrl}
                  onChange={(url) => setPendingAvatar(url)}
                  accentColor={club.accentColor}
                  clubName={club.name}
                  isDark={isDark}
                  size={80}
                />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${textMain}`}>{club.name}</p>
                  <p className={`text-xs mt-0.5 ${textMuted}`}>
                    {club.avatarUrl ? "Custom avatar set" : "Using initials placeholder"}
                  </p>
                  {pendingAvatar !== undefined && pendingAvatar !== club.avatarUrl && (
                    <p className={`text-xs mt-1 font-medium ${isDark ? "text-[#4CAF50]" : "text-[#436850]"}`}>
                      New avatar ready to save
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Banner section */}
            <div className={`rounded-2xl border ${cardBorder} p-5 mb-4 ${isDark ? "bg-white/3" : "bg-[#FBFADA]/70"}`}>
              <p className={`text-xs font-semibold uppercase tracking-wider mb-3 ${isDark ? "text-white/40" : "text-[#436850]"}`}>
                Hero Banner
              </p>
              <ClubBannerUpload
                value={pendingBanner !== undefined ? pendingBanner : club.bannerUrl}
                onChange={(url) => setPendingBanner(url)}
                accentColor={club.accentColor}
                isDark={isDark}
              />
              {pendingBanner !== undefined && pendingBanner !== club.bannerUrl && (
                <p className={`text-xs mt-2 font-medium ${isDark ? "text-[#4CAF50]" : "text-[#436850]"}`}>
                  {pendingBanner ? "New banner ready to save" : "Banner will be removed"}
                </p>
              )}
            </div>

            {/* Danger Zone */}
            {isOwner && (
              <div className={`rounded-2xl border border-red-500/20 p-5 mb-4 ${isDark ? "bg-red-500/5" : "bg-red-50"}`}>
                <p className="text-xs font-semibold uppercase tracking-wider mb-3 text-red-400">
                  Danger Zone
                </p>
                {deleteStep === 0 && (
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className={`text-sm font-semibold ${isDark ? "text-white/80" : "text-[#12372A]/85"}`}>Delete this club</p>
                      <p className={`text-xs mt-0.5 ${isDark ? "text-white/40" : "text-[#436850]"}`}>Permanently removes the club and all its data.</p>
                    </div>
                    <button
                      onClick={() => { setDeleteStep(1); setDeleteConfirmText(""); }}
                      className="shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors"
                    >
                      Delete Club
                    </button>
                  </div>
                )}
                {deleteStep === 1 && (
                  <div className="space-y-3">
                    <p className={`text-sm font-semibold ${isDark ? "text-white/80" : "text-[#12372A]/85"}`}>
                      Type <span className="font-mono text-red-400">{club?.name}</span> to confirm
                    </p>
                    <input
                      aria-label="Confirm Delete Club"
                      type="text"
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      placeholder={club?.name ?? ""}
                      className={`w-full px-3 py-2 rounded-xl text-sm border outline-none transition-colors ${
                        isDark
                          ? "bg-white/5 border-red-500/30 text-white placeholder-white/20 focus:border-red-400"
                          : "bg-white border-red-300 text-[#12372A] placeholder-gray-300 focus:border-red-500"
                      }`}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setDeleteStep(0); setDeleteConfirmText(""); }}
                        className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-colors ${isDark ? "bg-white/8 text-white/60 hover:bg-white/12" : "bg-[#ADBC9F]/40 text-[#436850] hover:bg-[#ADBC9F]"}`}
                      >
                        Cancel
                      </button>
                      <button
                        disabled={deleteConfirmText !== club?.name || isDeleting}
                        onClick={async () => {
                          if (!club || deleteConfirmText !== club.name) return;
                          setIsDeleting(true);
                          try {
                            await apiFetch(`/api/clubs/${encodeURIComponent(club.id)}`, { method: "DELETE" });
                            toast.success("Club deleted.");
                            navigate("/clubs");
                          } catch {
                            toast.error("Network error. Please try again.");
                            setIsDeleting(false);
                          }
                        }}
                        className="flex-1 py-2 rounded-xl text-xs font-semibold bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-40"
                      >
                        {isDeleting ? (
                          <span className="flex items-center justify-center gap-1.5">
                            <span className="w-3 h-3 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                            Deleting…
                          </span>
                        ) : "Confirm Delete"}
                      </button>
                    </div>
                  </div>
                )}
                {/* Transfer Ownership */}
                {deleteStep === 0 && transferStep === 0 && (
                  <div className="mt-4 pt-4 border-t border-orange-500/15 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        isDark ? "bg-orange-500/10" : "bg-orange-50"
                      }`}>
                        <ArrowRightLeft className="w-3.5 h-3.5 text-orange-400" />
                      </div>
                      <div>
                        <p className={`text-sm font-semibold ${isDark ? "text-white/80" : "text-[#12372A]/85"}`}>Transfer ownership</p>
                        <p className={`text-xs mt-0.5 ${isDark ? "text-white/40" : "text-[#436850]"}`}>Hand off this club to another member.</p>
                      </div>
                    </div>
                    <button
                      onClick={() => { setTransferStep(1); setSelectedTransferMemberId(""); }}
                      className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                        isDark
                          ? "bg-orange-500/10 text-orange-400 border-orange-500/20 hover:bg-orange-500/20"
                          : "bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100"
                      }`}
                    >
                      Transfer
                    </button>
                  </div>
                )}
                {transferStep === 1 && (
                  <div className="mt-4 pt-4 border-t border-orange-500/15 space-y-3">
                    <div className="flex items-center gap-2">
                      <ArrowRightLeft className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />
                      <p className={`text-sm font-semibold ${isDark ? "text-white/80" : "text-[#12372A]/85"}`}>Select new owner</p>
                    </div>
                    <select
                      aria-label="Select new owner"
                      value={selectedTransferMemberId}
                      onChange={(e) => setSelectedTransferMemberId(e.target.value)}
                      className={`w-full px-3 py-2 rounded-xl text-sm border outline-none transition-colors ${
                        isDark
                          ? "bg-white/5 border-orange-500/30 text-white focus:border-orange-400"
                          : "bg-white border-orange-300 text-[#12372A] focus:border-orange-500"
                      }`}
                    >
                      <option value="">Choose a member...</option>
                      {members
                        .filter((m) => m.userId !== user?.id)
                        .map((m) => (
                          <option key={m.userId} value={m.userId}>
                            {m.displayName}
                          </option>
                        ))}
                    </select>
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setTransferStep(0); setSelectedTransferMemberId(""); }}
                        className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-colors ${isDark ? "bg-white/8 text-white/60 hover:bg-white/12" : "bg-[#ADBC9F]/40 text-[#436850] hover:bg-[#ADBC9F]"}`}
                      >
                        Cancel
                      </button>
                      <button
                        disabled={!selectedTransferMemberId || isTransferring}
                        onClick={() => setTransferStep(2)}
                        className="flex-1 py-2 rounded-xl text-xs font-semibold bg-orange-500 text-white hover:bg-orange-600 transition-colors disabled:opacity-40"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
                {transferStep === 2 && (
                  <div className="mt-4 pt-4 border-t border-red-500/10 space-y-3">
                    <p className={`text-sm font-semibold ${isDark ? "text-white/80" : "text-[#12372A]/85"}`}>
                      Transfer ownership to <span className="text-orange-400">{members.find((m) => m.userId === selectedTransferMemberId)?.displayName}</span>?
                    </p>
                    <p className={`text-xs ${isDark ? "text-white/40" : "text-[#436850]"}`}>You will no longer be the owner but can remain a member.</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setTransferStep(1); }}
                        className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-colors ${isDark ? "bg-white/8 text-white/60 hover:bg-white/12" : "bg-[#ADBC9F]/40 text-[#436850] hover:bg-[#ADBC9F]"}`}
                      >
                        Back
                      </button>
                      <button
                        disabled={isTransferring}
                        onClick={async () => {
                          if (!club || !selectedTransferMemberId) return;
                          setIsTransferring(true);
                          try {
                            await apiFetch(`/api/clubs/${encodeURIComponent(club.id)}/transfer-ownership`, {
                              method: "PATCH",
                              body: JSON.stringify({ newOwnerId: selectedTransferMemberId }),
                            });
                            toast.success("Ownership transferred.");
                            setTransferStep(0);
                            setSelectedTransferMemberId("");
                            // Refresh club data
                            window.location.reload();
                          } catch {
                            toast.error("Network error. Please try again.");
                            setIsTransferring(false);
                          }
                        }}
                        className="flex-1 py-2 rounded-xl text-xs font-semibold bg-orange-500 text-white hover:bg-orange-600 transition-colors disabled:opacity-40"
                      >
                        {isTransferring ? (
                          <span className="flex items-center justify-center gap-1.5">
                            <span className="w-3 h-3 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                            Transferring…
                          </span>
                        ) : "Confirm Transfer"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Save / Cancel */}           <div className="flex gap-2">
              <button
                onClick={() => { setShowSettings(false); setPendingAvatar(undefined); setPendingBanner(undefined); setDeleteStep(0); setDeleteConfirmText(""); setIsDeleting(false); setTransferStep(0); setSelectedTransferMemberId(""); setIsTransferring(false); setShowLeaveConfirm(false); setIsLeavingClub(false); }}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${isDark ? "bg-white/8 text-white/70 hover:bg-white/12" : "bg-[#ADBC9F]/40 text-[#436850] hover:bg-[#ADBC9F]"}`}
              >
                Cancel
              </button>
              <button
                disabled={
                  savingSettings ||
                  (pendingAvatar === undefined || pendingAvatar === club.avatarUrl) &&
                  (pendingBanner === undefined || pendingBanner === club.bannerUrl)
                }
                onClick={async () => {
                  setSavingSettings(true);
                  try {
                    const patch: Record<string, unknown> = {};

                    // Upload avatar if changed — convert base64 → server URL so all users see it
                    if (pendingAvatar !== undefined && pendingAvatar !== club.avatarUrl) {
                      if (pendingAvatar === null) {
                        patch.avatarUrl = null;
                      } else if (pendingAvatar.startsWith("data:")) {
                        // base64 data URL — upload to server
                        try {
                          const { url } = await apiFetch<{ url: string }>("/api/clubs/upload-avatar", {
                            method: "POST",
                            body: JSON.stringify({ dataUrl: pendingAvatar }),
                          });
                          patch.avatarUrl = url;
                        } catch {
                          toast.error("Avatar upload failed — please try again.");
                          setSavingSettings(false);
                          return;
                        }
                      } else {
                        // Already a server URL (e.g. from a previous save)
                        patch.avatarUrl = pendingAvatar;
                      }
                    }

                    // Upload banner if changed — use dedicated banner endpoint (8 MB limit, /uploads/banners/)
                    if (pendingBanner !== undefined && pendingBanner !== club.bannerUrl) {
                      if (pendingBanner === null) {
                        patch.bannerUrl = null;
                      } else if (pendingBanner.startsWith("data:")) {
                        try {
                          const { url } = await apiFetch<{ url: string }>("/api/clubs/upload-banner", {
                            method: "POST",
                            body: JSON.stringify({ dataUrl: pendingBanner }),
                          });
                          patch.bannerUrl = url;
                        } catch {
                          toast.error("Banner upload failed — please try again.");
                          setSavingSettings(false);
                          return;
                        }
                      } else {
                        patch.bannerUrl = pendingBanner;
                      }
                    }

                    if (Object.keys(patch).length > 0) {
                      // Persist to server DB (visible to all users)
                      const serverClub = await apiFetch<Record<string, unknown>>(`/api/clubs/${club.id}`, {
                        method: "PATCH",
                        body: JSON.stringify(patch),
                      });
                      // Also update localStorage so the owner sees the change immediately
                      updateClub(club.id, patch);
                      // Add cache-busting param so browsers reload the new image
                      if (typeof serverClub.avatarUrl === "string" && !serverClub.avatarUrl.startsWith("data:")) {
                        serverClub.avatarUrl = `${serverClub.avatarUrl}?v=${Date.now()}`;
                      }
                      if (typeof serverClub.bannerUrl === "string" && !serverClub.bannerUrl.startsWith("data:")) {
                        serverClub.bannerUrl = `${serverClub.bannerUrl}?v=${Date.now()}`;
                      }
                      setClub(serverClub as unknown as Club);
                      toast.success("Club updated!");
                    }
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
                  } catch (_e) {
                    toast.error("Network error — please check your connection.");
                    setSavingSettings(false);
                    return;
                  }
                  setSavingSettings(false);
                  setShowSettings(false);
                  setPendingAvatar(undefined);
                  setPendingBanner(undefined);
                }}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-[#436850] text-white hover:bg-[#3a5230] transition-colors disabled:opacity-40"
              >
                {savingSettings ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                    Saving…
                  </span>
                ) : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Share modal */}
      {showShareModal && club && (
        <ClubShareModal
          clubName={club.name}
          clubSlug={club.slug || ""}
          clubId={club.id}
          tagline={club.tagline}
          accentColor={club.accentColor}
          isDark={isDark}
          onClose={() => setShowShareModal(false)}
        />
      )}

      {/* Auth modal — shown when guest tries to join, follow, or request a league */}
      <AuthModal
        isOpen={authOpen}
        onClose={() => { setAuthOpen(false); setPendingAction(null); }}
        onSuccess={() => { setAuthOpen(false); pendingAction?.(); setPendingAction(null); }}
        isDark
      />

      {/* Contact Owner modal */}
      {club && (() => {
        const ownerMember = members.find((m) => m.role === "owner");
        return (
          <ContactOwnerModal
            isOpen={showContactOwner}
            onClose={() => setShowContactOwner(false)}
            clubId={club.id}
            ownerName={club.ownerName || "the club owner"}
            ownerAvatarUrl={ownerMember?.avatarUrl ?? null}
            ownerUsername={ownerMember?.chesscomUsername ?? null}
            isDark={isDark}
          />
        );
      })()}

      {/* Promo Graphic Modal — owner/director only */}
      {club && showPromoModal && (
        <ClubPromoModal
          isOpen={showPromoModal}
          onClose={() => setShowPromoModal(false)}
          club={club}
          recaps={clubRecaps}
          tournaments={liveTournaments}
          isDark={isDark}
        />
      )}

      {/* Club QR Projection Modal — owner/director only */}
      {club && (
        <ClubQRProjectionModal
          open={showClubQR}
          onClose={() => setShowClubQR(false)}
          clubName={club.name}
          clubSlug={club.slug ?? club.id}
          accent={accent}
          flag={flag}
          memberCount={club.memberCount}
        />
      )}

      {/* Edit Club Details Modal */}
      {club && (
        <EditClubDetailsModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          clubId={club.id}
          currentDescription={club.description}
          currentLocation={club.location}
          currentWebsite={club.website ?? ""}
          currentInstagram={club.instagram ?? ""}
          onSave={async (description, location, website, instagram) => {
            try {
              // Persist to server (DB)
              const serverUpdated = await apiUpdateClub(club.id, {
                description,
                location,
                website: website || undefined,
                instagram: instagram || undefined,
              });
              if (serverUpdated) {
                // Also update local registry for immediate UI
                updateClub(club.id, { description, location, website: website || undefined, instagram: instagram || undefined });
                setClub(serverUpdated);
                toast.success("Club details updated successfully");
              } else {
                throw new Error("Server update failed");
              }
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Failed to update club details");
              throw e;
            }
          }}
        />
      )}

      {/* ── Edit Event Modal ────────────────────────────────────────────── */}
      {editingEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)" }}>
          <div
            ref={editEventDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="club-edit-event-title"
            tabIndex={-1}
            className={`w-full max-w-md rounded-2xl shadow-2xl p-6 ${ isDark ? "bg-[oklch(0.17_0.05_145)]" : "bg-[#F0F5E8]" }`}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 id="club-edit-event-title" className={`text-lg font-bold ${textMain}`}>Edit Event</h2>
              <button onClick={closeEditEvent} aria-label="Close edit event" className={`p-1.5 rounded-lg ${isDark ? "hover:bg-white/8 text-white/50" : "hover:bg-[#ADBC9F]/50 text-[#436850]"}`}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-4">
              {/* Cover Image Upload */}
              <div>
                <label className={`block text-xs font-semibold mb-1.5 ${textMuted}`}>Cover Image</label>
                {editForm.coverImageUrl ? (
                  <div className="relative rounded-xl overflow-hidden" style={{ height: 110 }}>
                    <img src={editForm.coverImageUrl} alt="Event cover" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setEditForm(f => ({ ...f, coverImageUrl: "" }))}
                      className="absolute top-2 right-2 p-1 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <label className={`flex flex-col items-center justify-center gap-1.5 w-full rounded-xl border-2 border-dashed cursor-pointer transition-colors ${
                    isDark ? "border-white/15 hover:border-white/30 bg-white/3 hover:bg-white/5" : "border-[#ADBC9F] hover:border-[#436850]/40 bg-[#FBFADA]/70 hover:bg-[#ADBC9F]/50"
                  }`} style={{ height: 90 }}>
                    {uploadingEditCover ? (
                      <span className={`text-xs ${textMuted}`}>Uploading…</span>
                    ) : (
                      <>
                        <ImageIcon className={`w-5 h-5 ${textMuted} opacity-50`} />
                        <span className={`text-xs ${textMuted} opacity-70`}>Click to upload cover image</span>
                        <span className={`text-[10px] ${textMuted} opacity-40`}>JPG, PNG, WebP · max 5 MB</span>
                      </>
                    )}
                    <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 5 * 1024 * 1024) { toast.error("Image too large (max 5 MB)"); return; }
                      setUploadingEditCover(true);
                      try {
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                          const dataUrl = ev.target?.result as string;
                          setEditForm(f => ({ ...f, coverImageUrl: dataUrl }));
                          setUploadingEditCover(false);
                        };
                        reader.onerror = () => { toast.error("Failed to read image"); setUploadingEditCover(false); };
                        reader.readAsDataURL(file);
                      } catch { toast.error("Upload failed"); setUploadingEditCover(false); }
                    }} />
                  </label>
                )}
              </div>
              <div>
                <label className={`block text-xs font-semibold mb-1 ${textMuted}`}>Event Title *</label>
                <input
                  ref={editEventTitleRef}
                  aria-label="Edit Event Title"
                  value={editForm.title}
                  onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Wednesday Night Blitz"
                  className={`w-full px-3 py-2.5 rounded-xl text-sm border outline-none transition-colors ${
                    isDark ? "bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-[#4CAF50]/50" : "bg-[#FBFADA]/70 border-[#ADBC9F] text-[#12372A] placeholder:text-[#436850] focus:border-[#436850]"
                  }`}
                />
              </div>
              <div>
                <label className={`block text-xs font-semibold mb-1 ${textMuted}`}>Date &amp; Time *</label>
                <input
                  aria-label="Edit Event Date & Time"
                  type="datetime-local"
                  value={editForm.startAt}
                  onChange={e => setEditForm(f => ({ ...f, startAt: e.target.value }))}
                  className={`w-full px-3 py-2.5 rounded-xl text-sm border outline-none transition-colors ${
                    isDark ? "bg-white/5 border-white/10 text-white focus:border-[#4CAF50]/50" : "bg-[#FBFADA]/70 border-[#ADBC9F] text-[#12372A] focus:border-[#436850]"
                  }`}
                />
              </div>
              <div>
                <label className={`block text-xs font-semibold mb-1 ${textMuted}`}>Venue</label>
                <input
                  aria-label="Edit Event Venue"
                  value={editForm.venue}
                  onChange={e => setEditForm(f => ({ ...f, venue: e.target.value }))}
                  placeholder="e.g. Club Hall, Room 2"
                  className={`w-full px-3 py-2.5 rounded-xl text-sm border outline-none transition-colors ${
                    isDark ? "bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-[#4CAF50]/50" : "bg-[#FBFADA]/70 border-[#ADBC9F] text-[#12372A] placeholder:text-[#436850] focus:border-[#436850]"
                  }`}
                />
              </div>
              <div>
                <label className={`block text-xs font-semibold mb-1 ${textMuted}`}>Admission</label>
                <input
                  aria-label="Edit Event Admission"
                  value={editForm.admissionNote}
                  onChange={e => setEditForm(f => ({ ...f, admissionNote: e.target.value }))}
                  placeholder="e.g. Free · Members only"
                  className={`w-full px-3 py-2.5 rounded-xl text-sm border outline-none transition-colors ${
                    isDark ? "bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-[#4CAF50]/50" : "bg-[#FBFADA]/70 border-[#ADBC9F] text-[#12372A] placeholder:text-[#436850] focus:border-[#436850]"
                  }`}
                />
              </div>
              <div>
                <label className={`block text-xs font-semibold mb-1 ${textMuted}`}>Description</label>
                <textarea
                  aria-label="Edit Event Description"
                  value={editForm.description}
                  onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                  rows={3}
                  placeholder="What should members know about this event?"
                  className={`w-full px-3 py-2.5 rounded-xl text-sm border outline-none transition-colors resize-none ${
                    isDark ? "bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-[#4CAF50]/50" : "bg-[#FBFADA]/70 border-[#ADBC9F] text-[#12372A] placeholder:text-[#436850] focus:border-[#436850]"
                  }`}
                />
              </div>
              {/* Recurrence controls */}
              <div>
                <label className={`block text-xs font-semibold mb-1.5 ${textMuted}`}>Repeat</label>
                <div className="flex gap-2 flex-wrap">
                  {(["none", "weekly", "biweekly", "monthly"] as const).map((opt) => (
                    <button key={opt} type="button"
                      onClick={() => setEditForm(f => ({ ...f, recurrence: opt }))}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                        editForm.recurrence === opt
                          ? isDark ? "bg-[#4CAF50] text-black" : "bg-[#436850] text-white"
                          : isDark ? "bg-white/8 text-white/50 hover:bg-white/12" : "bg-[#ADBC9F]/40 text-[#436850] hover:bg-[#ADBC9F]"
                      }`}>
                      {opt === "none" ? "One-time" : opt === "biweekly" ? "Bi-weekly" : opt.charAt(0).toUpperCase() + opt.slice(1)}
                    </button>
                  ))}
                </div>
                {editForm.recurrence !== "none" && (
                  <div className="mt-2 space-y-2">
                    <div>
                      <label className={`text-xs ${textMuted} block mb-1`}>End date (optional)</label>
                      <input type="date" value={editForm.recurrenceEndDate}
                        aria-label="Edit Event Recurrence End Date"
                        onChange={e => setEditForm(f => ({ ...f, recurrenceEndDate: e.target.value }))}
                        className={`w-full px-3 py-2 rounded-xl text-sm border outline-none transition-colors ${
                          isDark ? "bg-white/5 border-white/10 text-white focus:border-[#4CAF50]/50" : "bg-[#FBFADA]/70 border-[#ADBC9F] text-[#12372A] focus:border-[#436850]"
                        }`} />
                    </div>
                    {editingEvent?.recurrenceSeriesId && (
                      <div>
                        <label className={`text-xs font-semibold ${textMuted} block mb-1`}>Apply changes to</label>
                        <div className="flex gap-2">
                          {(["this", "all"] as const).map(scope => (
                            <button key={scope} type="button"
                              onClick={() => setEditForm(f => ({ ...f, editScope: scope }))}
                              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                                editForm.editScope === scope
                                  ? isDark ? "bg-[#4CAF50] text-black" : "bg-[#436850] text-white"
                                  : isDark ? "bg-white/8 text-white/50 hover:bg-white/12" : "bg-[#ADBC9F]/40 text-[#436850] hover:bg-[#ADBC9F]"
                              }`}>
                              {scope === "this" ? "This event only" : "All future events"}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setEditingEvent(null)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                  isDark ? "bg-white/8 text-white/60 hover:bg-white/12" : "bg-[#ADBC9F]/40 text-[#436850] hover:bg-[#ADBC9F]"
                }`}
              >
                Cancel
              </button>
              <button
                disabled={savingEdit || !editForm.title.trim() || !editForm.startAt}
                onClick={async () => {
                  if (!editForm.title.trim() || !editForm.startAt) return;
                  setSavingEdit(true);
                  try {
                    const patch = {
                      title: editForm.title.trim(),
                      description: editForm.description.trim() || undefined,
                      startAt: new Date(editForm.startAt).toISOString(),
                      venue: editForm.venue.trim() || undefined,
                      admissionNote: editForm.admissionNote.trim() || undefined,
                      coverImageUrl: editForm.coverImageUrl || undefined,
                      recurrence: editForm.recurrence !== "none" ? editForm.recurrence : undefined,
                      recurrenceEndDate: editForm.recurrence !== "none" && editForm.recurrenceEndDate ? editForm.recurrenceEndDate : undefined,
                    };
                    if (editForm.editScope === "all" && editingEvent.recurrenceSeriesId) {
                      // Update all future events in the series
                      const seriesEvents = listClubEvents(editingEvent.clubId)
                        .filter(e => e.recurrenceSeriesId === editingEvent.recurrenceSeriesId && new Date(e.startAt) >= new Date(editingEvent.startAt));
                      seriesEvents.forEach(e => updateClubEvent(e.id, { ...patch, startAt: e.startAt }));
                      setClubEvents(listClubEvents(editingEvent.clubId));
                      toast.success(`${seriesEvents.length} events updated`);
                    } else {
                      const updated = updateClubEvent(editingEvent.id, patch);
                      if (updated) {
                        setClubEvents(prev => prev.map(e => e.id === updated.id ? updated : e));
                        toast.success("Event updated");
                      }
                    }
                    setEditingEvent(null);
                  } catch {
                    toast.error("Failed to update event");
                  } finally {
                    setSavingEdit(false);
                  }
                }}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95 ${
                  savingEdit || !editForm.title.trim() || !editForm.startAt
                    ? isDark ? "bg-white/10 text-white/30 cursor-not-allowed" : "bg-[#ADBC9F] text-[#436850] cursor-not-allowed"
                    : isDark ? "bg-[#4CAF50] text-black hover:bg-[#5DBF62]" : "bg-[#436850] text-white hover:bg-[#3a5230]"
                }`}
              >
                {savingEdit ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Event Confirmation ────────────────────────────────────── */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)" }}>
          <div
            ref={deleteEventDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="club-delete-event-title"
            tabIndex={-1}
            className={`w-full max-w-sm rounded-2xl shadow-2xl p-6 ${ isDark ? "bg-[oklch(0.17_0.05_145)]" : "bg-[#F0F5E8]" }`}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${ isDark ? "bg-red-500/15" : "bg-red-50" }`}>
                <Trash2 className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h2 id="club-delete-event-title" className={`text-base font-bold ${textMain}`}>Delete Event</h2>
                <p className={`text-xs ${textMuted}`}>This action cannot be undone.</p>
              </div>
            </div>
            <p className={`text-sm ${textMuted} mb-6`}>Are you sure you want to delete this event? All RSVPs and comments will also be removed.</p>
            <div className="flex gap-3">
              <button
                ref={deleteEventCancelRef}
                onClick={closeDeleteEvent}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                  isDark ? "bg-white/8 text-white/60 hover:bg-white/12" : "bg-[#ADBC9F]/40 text-[#436850] hover:bg-[#ADBC9F]"
                }`}
              >
                Cancel
              </button>
              <button
                disabled={deletingEvent}
                onClick={async () => {
                  if (!confirmDeleteId) return;
                  setDeletingEvent(true);
                  try {
                    deleteClubEvent(confirmDeleteId);
                    setClubEvents(prev => prev.filter(e => e.id !== confirmDeleteId));
                    toast.success("Event deleted");
                    setConfirmDeleteId(null);
                  } catch {
                    toast.error("Failed to delete event");
                  } finally {
                    setDeletingEvent(false);
                  }
                }}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95 ${
                  deletingEvent
                    ? "bg-red-400/50 text-white/50 cursor-not-allowed"
                    : "bg-red-500 text-white hover:bg-red-600"
                }`}
              >
                {deletingEvent ? "Deleting…" : "Delete Event"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Mobile bottom nav bar ──────────────────────────────────────────── */}
      {/* Mobile sticky Join CTA — shown to non-members/guests only */}
      {!isOwner && !isDirector && !joined && (
        <div
          className="lg:hidden fixed bottom-[60px] left-0 right-0 z-30 px-4 py-2"
          style={{ background: "transparent" }}
        >
          <button
            onClick={handleJoin}
            className="w-full py-3 rounded-2xl text-sm font-bold shadow-lg transition-all active:scale-95"
            style={{ background: accent, color: "#fff" }}
          >
            {club.isPublic ? "Join Club" : "Request to Join"}
          </button>
        </div>
      )}

      {/* ── Club bottom nav bar (mobile only) ── */}
      <div
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40"
        style={{
          background: isDark ? "oklch(0.12 0.04 145 / 0.97)" : "oklch(0.10 0.04 145 / 0.97)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          borderTop: `1px solid ${isDark ? "oklch(0.22 0.06 145 / 0.6)" : "oklch(0.25 0.08 145 / 0.6)"}`,
          paddingTop: "8px",
          paddingBottom: "calc(8px + env(safe-area-inset-bottom, 0px))",
        }}
      >
        <div className="flex items-center px-1">
          {/* Club section tabs */}
          {(["home", "feed", "events", "members", "album", "leagues"] as const).map((t) => {
            const isTabActive = activeTab === t;
            const iconMap: Record<string, React.ReactNode> = {
              home: <OtbHome size={18} accentColor={isTabActive ? accent : undefined} />,
              feed: <OtbFeed size={18} accentColor={isTabActive ? accent : undefined} />,
              events: <OtbEvents size={18} accentColor={isTabActive ? accent : undefined} />,
              members: <OtbMembers size={18} accentColor={isTabActive ? accent : undefined} />,
              album: <OtbAlbum size={18} accentColor={isTabActive ? accent : undefined} />,
              leagues: <OtbLeagues size={18} accentColor={isTabActive ? accent : undefined} />,
            };
            return (
              <button
                key={t}
                onClick={() => handleTabChange(t)}
                className="flex flex-col items-center gap-0.5 flex-1 relative transition-all duration-200 active:scale-95"
                style={{ minHeight: "44px", paddingTop: "2px", paddingBottom: "2px" }}
              >
                {isTabActive && (
                  <span
                    className="absolute inset-x-1 inset-y-0 rounded-xl"
                    style={{ background: `${accent}1a` }}
                  />
                )}
                <span
                  className={`relative z-10 otb-nav-tap otb-icon${isTabActive ? " otb-icon--active" : ""}`}
                  style={{ color: isTabActive ? accent : "oklch(0.42 0.05 145)" }}
                >
                  {iconMap[t]}
                </span>
                <span
                  className="relative z-10 text-[9px] font-semibold tracking-wide transition-all duration-200"
                  style={{ color: isTabActive ? accent : "oklch(0.38 0.05 145)" }}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </span>
              </button>
            );
          })}
          {/* Divider */}
          <div
            className="w-px self-stretch mx-0.5"
            style={{ background: isDark ? "oklch(0.25 0.06 145 / 0.5)" : "oklch(0.30 0.06 145 / 0.4)" }}
          />
          {/* Hamburger — navigate out */}
          <button
            onClick={() => setShowNavMenu(true)}
            className="flex flex-col items-center gap-0.5 w-12 relative transition-all duration-200 active:scale-95"
            style={{ minHeight: "44px", paddingTop: "2px", paddingBottom: "2px" }}
            aria-label="Main navigation"
          >
            <span style={{ color: "oklch(0.42 0.05 145)" }}>
              <Menu size={18} />
            </span>
            <span
              className="text-[9px] font-semibold tracking-wide"
              style={{ color: "oklch(0.38 0.05 145)" }}
            >
              More
            </span>
          </button>
        </div>
      </div>

      {/* ── Slide-up navigation menu ── */}
      {showNavMenu && (
        <div
          className="lg:hidden fixed inset-0 z-50"
          onClick={closeNavMenu}
        >
          {/* Backdrop */}
          <div className="absolute inset-0" style={{ background: "oklch(0.05 0.02 145 / 0.75)", backdropFilter: "blur(4px)" }} />
          {/* Sheet */}
          <div
            ref={navDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="club-mobile-nav-title"
            tabIndex={-1}
            className="absolute bottom-0 left-0 right-0 rounded-t-3xl px-4 pt-3 pb-safe"
            style={{
              background: isDark ? "oklch(0.14 0.05 145)" : "oklch(0.97 0.02 145)",
              border: `1px solid ${isDark ? "oklch(0.24 0.07 145 / 0.7)" : "oklch(0.80 0.06 145 / 0.5)"}`,
              borderBottom: "none",
              paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom, 0px))",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag handle */}
            <div className="flex justify-center mb-4">
              <div
                className="w-10 h-1 rounded-full"
                style={{ background: isDark ? "oklch(0.30 0.06 145)" : "oklch(0.75 0.05 145)" }}
              />
            </div>
            {/* Header */}
            <div className="flex items-center justify-between mb-4 px-1">
              <p
                id="club-mobile-nav-title"
                className="text-xs font-black uppercase tracking-[0.15em]"
                style={{ color: isDark ? "oklch(0.45 0.08 145)" : "oklch(0.44 0.08 145)" }}
              >
                Navigate to
              </p>
              <button
                ref={navCloseRef}
                onClick={closeNavMenu}
                aria-label="Close club navigation"
                className="w-7 h-7 rounded-full flex items-center justify-center transition-all active:scale-90"
                style={{ background: isDark ? "oklch(0.22 0.06 145)" : "oklch(0.88 0.04 145)" }}
              >
                <X size={14} style={{ color: isDark ? "oklch(0.55 0.06 145)" : "oklch(0.44 0.06 145)" }} />
              </button>
            </div>
            {/* Nav links */}
            <div className="space-y-1">
              {([
                { href: "/", label: "Home", icon: <OtbHome size={20} /> },
                { href: "/tournaments", label: "Tournaments", icon: <OtbTournaments size={20} /> },
                { href: "/clubs", label: "Clubs", icon: <OtbClubs size={20} /> },
                { href: "/training", label: "Tools", icon: <OtbAcademy size={20} /> },
                { href: "/profile", label: "Profile", icon: <OtbProfile size={20} /> },
              ] as const).map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setShowNavMenu(false)}
                  className="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all active:scale-[0.98]"
                  style={{
                    background: isDark ? "oklch(0.18 0.06 145)" : "oklch(0.92 0.03 145)",
                    border: `1px solid ${isDark ? "oklch(0.26 0.07 145 / 0.6)" : "oklch(0.82 0.05 145 / 0.6)"}`,
                  }}
                >
                  <span style={{ color: isDark ? accent : "oklch(0.32 0.10 145)" }}>
                    {item.icon}
                  </span>
                  <span
                    className="text-sm font-semibold"
                    style={{ color: isDark ? "oklch(0.88 0.04 145)" : "oklch(0.18 0.06 145)" }}
                  >
                    {item.label}
                  </span>
                  <ArrowRight
                    size={14}
                    className="ml-auto"
                    style={{ color: isDark ? "oklch(0.40 0.06 145)" : "oklch(0.60 0.06 145)" }}
                  />
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
// ── Extracted row components ──────────────────────────────────────────────────

function DetailRow({
  icon,
  label,
  value,
  isDark,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  isDark: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${isDark ? "bg-white/6 text-white/40" : "bg-[#FBFADA]/70 text-[#436850]"}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-[10px] font-semibold uppercase tracking-wider ${isDark ? "text-white/30" : "text-[#436850]"}`}>{label}</p>
        <p className={`text-sm font-medium ${isDark ? "text-white/80" : "text-[#12372A]/85"}`}>{value}</p>
      </div>
    </div>
  );
}

function MemberRow({
  member,
  clubId,
  isDark,
  textMuted,
}: {
  member: ClubMember;
  clubId: string;
  isDark: boolean;
  textMuted: string;
}) {
  const platform: "chesscom" | "lichess" | undefined = member.chesscomUsername ? "chesscom" : member.lichessUsername ? "lichess" : undefined;
  const username = member.chesscomUsername ?? member.lichessUsername ?? undefined;
  // Start with localStorage data for instant render, then upgrade with server data
  const [battleSummary, setBattleSummary] = useState<PlayerBattleSummary>(
    () => getPlayerBattleSummary(clubId, member.userId)
  );
  useEffect(() => {
    apiBattlePlayerStats(clubId, member.userId)
      .then((stats) => setBattleSummary({ wins: stats.wins, draws: stats.draws, losses: stats.losses, total: stats.total, winRate: stats.winRate }))
      .catch(() => { /* keep localStorage fallback */ });
  }, [clubId, member.userId]);

  return (
    <div className={`flex items-center gap-3 px-5 py-3.5 transition-colors ${isDark ? "hover:bg-white/3" : "hover:bg-[#FBFADA]"}`}>
      <PlayerAvatar
        username={username ?? ""}
        platform={platform}
        name={member.displayName}
        size={36}
        showBadge={false}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-sm font-semibold ${isDark ? "text-white" : "text-[#12372A]"}`}>
            {member.displayName}
          </span>
          <RoleBadge role={member.role} />
          {(member.leagueChampionships ?? 0) > 0 && (
            <span
              title={`${member.leagueChampionships}× League Champion`}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/25 flex-shrink-0"
            >
              <Trophy className="w-2.5 h-2.5" />
              {(member.leagueChampionships ?? 0) > 1 ? `×${member.leagueChampionships}` : "Champion"}
            </span>
          )}
        </div>
        {username && (
          <p className={`text-xs mt-0.5 ${textMuted}`}>
            {member.chesscomUsername ? "chess.com" : "lichess"} · {username}
          </p>
        )}
        {battleSummary.total > 0 && (
          <div className="flex items-center gap-1.5 mt-1">
            <Swords className={`w-3 h-3 ${textMuted}`} />
            <span className="text-[11px] text-emerald-400 font-bold">{battleSummary.wins}W</span>
            <span className={`text-[11px] ${textMuted}`}>{battleSummary.draws}D</span>
            <span className="text-[11px] text-red-400">{battleSummary.losses}L</span>
            <span className={`text-[10px] ${textMuted}`}>· {battleSummary.winRate}% win rate</span>
          </div>
        )}
      </div>
      <div className="text-right flex-shrink-0">
        {member.tournamentsPlayed > 0 && (
          <>
            <p className={`text-sm font-bold ${isDark ? "text-white" : "text-[#12372A]"}`}>
              {member.tournamentsPlayed}
            </p>
            <p className={`text-[10px] ${textMuted}`}>played</p>
          </>
        )}
      </div>
    </div>
  );
}

function MemberCard({
  member,
  clubId,
  isDark,
  textMuted,
  accent,
}: {
  member: ClubMember;
  clubId: string;
  isDark: boolean;
  textMuted: string;
  accent: string;
}) {
  const platform: "chesscom" | "lichess" | undefined = member.chesscomUsername ? "chesscom" : member.lichessUsername ? "lichess" : undefined;
  const username = member.chesscomUsername ?? member.lichessUsername ?? undefined;
  const [battleSummary, setBattleSummary] = useState<PlayerBattleSummary>(
    () => getPlayerBattleSummary(clubId, member.userId)
  );
  useEffect(() => {
    apiBattlePlayerStats(clubId, member.userId)
      .then((stats) => setBattleSummary({ wins: stats.wins, draws: stats.draws, losses: stats.losses, total: stats.total, winRate: stats.winRate }))
      .catch(() => { /* keep localStorage fallback */ });
  }, [clubId, member.userId]);

  // Role-specific accent
  const roleAccent = member.role === "owner"
    ? "oklch(0.75 0.15 80)"
    : member.role === "director"
    ? "oklch(0.65 0.13 145)"
    : accent;

  return (
    <div className={`flex items-start gap-3 p-4 transition-colors ${
      isDark ? "bg-[#0d1a0f] hover:bg-white/3" : "bg-white hover:bg-[#FBFADA]/70"
    }`}>
      {/* Avatar with role ring */}
      <div className="relative flex-shrink-0">
        <div
          className="rounded-full p-0.5"
          style={member.role !== "member" ? { background: `${roleAccent}40`, boxShadow: `0 0 0 1px ${roleAccent}60` } : {}}
        >
          <PlayerAvatar
            username={username ?? ""}
            platform={platform}
            name={member.displayName}
            size={44}
            showBadge={false}
            className="rounded-full"
          />
        </div>
        {/* Role icon badge */}
        {member.role === "owner" && (
          <span className="absolute -bottom-0.5 -right-0.5 w-4.5 h-4.5 rounded-full bg-amber-500 flex items-center justify-center" style={{ width: 18, height: 18 }}>
            <Crown className="w-2.5 h-2.5 text-white" />
          </span>
        )}
        {member.role === "director" && (
          <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-[#4CAF50] flex items-center justify-center" style={{ width: 18, height: 18 }}>
            <Shield className="w-2.5 h-2.5 text-white" />
          </span>
        )}
      </div>
      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`text-sm font-semibold truncate ${
            isDark ? "text-white" : "text-[#12372A]"
          }`}>{member.displayName}</span>
          <RoleBadge role={member.role} />
          {(member.leagueChampionships ?? 0) > 0 && (
            <span
              title={`${member.leagueChampionships}× League Champion`}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/25 flex-shrink-0"
            >
              <Trophy className="w-2.5 h-2.5" />
              {(member.leagueChampionships ?? 0) > 1 ? `×${member.leagueChampionships}` : "Champ"}
            </span>
          )}
        </div>
        {username && (
          <p className={`text-[11px] mt-0.5 ${textMuted}`}>
            {member.chesscomUsername ? "chess.com" : "lichess"} · {username}
          </p>
        )}
        {/* Battle stats */}
        {battleSummary.total > 0 ? (
          <div className="flex items-center gap-1.5 mt-1.5">
            <Swords className={`w-3 h-3 ${textMuted}`} />
            <span className="text-[11px] text-emerald-400 font-bold">{battleSummary.wins}W</span>
            <span className={`text-[11px] ${textMuted}`}>{battleSummary.draws}D</span>
            <span className="text-[11px] text-red-400">{battleSummary.losses}L</span>
            <span className={`text-[10px] ${textMuted}`}>· {battleSummary.winRate}%</span>
          </div>
        ) : member.tournamentsPlayed > 0 ? (
          <p className={`text-[11px] mt-1 ${textMuted}`}>
            <Trophy className="w-2.5 h-2.5 inline mr-1" />{member.tournamentsPlayed} tournament{member.tournamentsPlayed !== 1 ? "s" : ""}
          </p>
        ) : (
          <p className={`text-[11px] mt-1 ${textMuted} opacity-40`}>No games yet</p>
        )}
      </div>
    </div>
  );
}

function TournamentRow({
  tournament,
  isDark,
  textMuted,
}: {
  tournament: ClubTournament;
  isDark: boolean;
  textMuted: string;
}) {
  return (
    <div className={`flex items-center gap-4 px-5 py-4 transition-colors ${isDark ? "hover:bg-white/3" : "hover:bg-[#FBFADA]"}`}>
      {/* Format icon */}
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isDark ? "bg-white/6" : "bg-[#FBFADA]/70"}`}>
        <Trophy className={`w-5 h-5 ${isDark ? "text-[#4CAF50]" : "text-[#436850]"}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-sm font-semibold ${isDark ? "text-white" : "text-[#12372A]"}`}>
            {tournament.name}
          </span>
          <TournamentStatusBadge status={tournament.status} isDark={isDark} />
        </div>
        <div className={`flex items-center gap-3 mt-0.5 text-xs ${textMuted}`}>
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {new Date(tournament.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </span>
          <span>{tournament.format}</span>
          <span>{tournament.rounds} rounds</span>
          {tournament.playerCount > 0 && <span>{tournament.playerCount} players</span>}
        </div>
        {tournament.winnerName && (
          <div className={`flex items-center gap-1 mt-1 text-xs ${isDark ? "text-amber-400" : "text-amber-600"}`}>
            <Star className="w-3 h-3" />
            <span className="font-medium">{tournament.winnerName}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── TournamentCard ─────────────────────────────────────────────────────────
// Expandable card for the Tournaments tab — shows bracket/standings on demand.

function TournamentCard({
  tournament,
  isDark,
  textMain,
  textMuted,
  divider,
  card,
  cardBorder,
  accent,
}: {
  tournament: TournamentConfig;
  isDark: boolean;
  textMain: string;
  textMuted: string;
  divider: string;
  card: string;
  cardBorder: string;
  accent: string;
}) {
  const [open, setOpen] = useState(false);
  // Load director state eagerly (lightweight localStorage read) to get live status
  const dirState = loadTournamentState(tournament.id);
  const state = open ? dirState : null;
  const standings: StandingRow[] = state ? computeStandings(state.players, state.rounds) : [];
  const completedRounds = state ? state.rounds.filter((r) => r.status === "completed") : [];
  const isElim = tournament.format === "elimination";
  const isSwissElim = tournament.format === "swiss_elim";
  const isRR = tournament.format === "roundrobin";

  // Canonical lifecycle metadata gives completed state terminal precedence.
  const statusDisplay = getTournamentStatusDisplay(dirState);

  const formatLabel = getTournamentFormatLabel(tournament.format, { fallback: "Unknown" });

  const statusColor =
    statusDisplay.isLive ? "text-green-500 bg-green-500/10 border-green-500/20"
    : statusDisplay.isComplete ? isDark ? "text-white/40 bg-white/5 border-white/10" : "text-[#436850]/60 bg-[#ADBC9F]/20 border-[#ADBC9F]/40"
    : isDark ? "text-amber-400 bg-amber-400/10 border-amber-400/20" : "text-amber-600 bg-amber-500/10 border-amber-500/20";

  return (
    <div className={`rounded-3xl border ${cardBorder} ${card} overflow-hidden`}>
      {/* Card header — always visible */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center gap-4 px-5 py-4 text-left transition-colors ${isDark ? "hover:bg-white/3" : "hover:bg-[#FBFADA]/60"}`}
      >
        {/* Format icon */}
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
          statusDisplay.isLive
            ? "bg-green-500/15"
            : isDark ? "bg-white/6" : "bg-[#FBFADA]/70"
        }`}>
          {statusDisplay.isLive
            ? <Zap className="w-5 h-5 text-green-500" strokeWidth={1.8} />
            : statusDisplay.isComplete
            ? <CheckCircle2 className={`w-5 h-5 ${textMuted}`} strokeWidth={1.8} />
            : <Trophy className={`w-5 h-5`} style={{ color: accent }} strokeWidth={1.8} />
          }
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-sm font-semibold truncate ${textMain}`}>{tournament.name}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold border ${statusColor}`}>
              {statusDisplay.isComplete ? "Completed" : statusDisplay.isLive ? "Live" : statusDisplay.isPending ? "Upcoming" : statusDisplay.label}
            </span>
          </div>
          <div className={`flex items-center gap-2 mt-0.5 text-xs ${textMuted} flex-wrap`}>
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {tournament.date ? new Date(tournament.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Date not set"}
            </span>
            <span className={`px-1.5 py-0.5 rounded-full ${isDark ? "bg-white/8 text-white/50" : "bg-[#ADBC9F]/40 text-[#436850]"}`}>
              {formatLabel}
            </span>
            <span>{tournament.rounds}R</span>
            {tournament.venue && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{tournament.venue}</span>}
          </div>
        </div>
        <ChevronRight className={`w-4 h-4 flex-shrink-0 transition-transform ${textMuted} ${open ? "rotate-90" : ""}`} />
      </button>

      {/* Expandable drawer */}
      {open && (
        <div className={`border-t ${divider}`}>
          {/* Link to full tournament page */}
          <div className={`px-5 py-3 flex items-center justify-between border-b ${divider}`}>
            <span className={`text-xs font-semibold uppercase tracking-wider ${textMuted}`}>
              {state ? `${state.players.length} players · Round ${state.currentRound}/${state.totalRounds}` : "No data yet"}
            </span>
            <a
              href={`/tournament/${tournament.id}`}
              className={`flex items-center gap-1 text-xs font-semibold transition-colors`}
              style={{ color: accent }}
            >
              Open <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {!state || state.players.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <Trophy className={`w-8 h-8 mx-auto mb-2 ${textMuted} opacity-40`} />
              <p className={`text-sm ${textMuted}`}>No tournament data yet</p>
            </div>
          ) : (
            <div className="px-5 py-4 space-y-5">

              {/* ── Standings table ──────────────────────────────────────── */}
              {standings.length > 0 && !isElim && (
                <div>
                  <h4 className={`text-xs font-semibold uppercase tracking-wider mb-3 ${textMuted}`}>
                    {isSwissElim && state.elimPhase === "elimination" ? "Swiss Phase Standings" : "Standings"}
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <caption className="sr-only">Tournament standings</caption>
                      <thead>
                        <tr className={`${textMuted}`}>
                          <th scope="col" className="text-left pb-2 pr-2 font-semibold w-6">#</th>
                          <th scope="col" className="text-left pb-2 pr-2 font-semibold">Player</th>
                          <th scope="col" className="text-center pb-2 px-2 font-semibold">Pts</th>
                          <th scope="col" className="text-center pb-2 px-2 font-semibold">W</th>
                          <th scope="col" className="text-center pb-2 px-2 font-semibold">D</th>
                          <th scope="col" className="text-center pb-2 px-2 font-semibold">L</th>
                          <th scope="col" className="text-center pb-2 pl-2 font-semibold">Buch</th>
                        </tr>
                      </thead>
                      <tbody>
                        {standings.slice(0, 10).map((row, i) => (
                          <tr
                            key={row.player.id}
                            className={`border-t ${isDark ? "border-white/5" : "border-gray-100"} ${
                              i === 0 ? isDark ? "bg-amber-500/5" : "bg-amber-50/60" : ""
                            }`}
                          >
                            <td className={`py-2 pr-2 font-bold ${
                              i === 0 ? "text-amber-400" : i === 1 ? isDark ? "text-white/60" : "text-gray-500" : i === 2 ? "text-amber-600" : textMuted
                            }`}>{row.rank}</td>
                            <th scope="row" className={`py-2 pr-2 text-left font-medium ${textMain} max-w-[120px] truncate`}>
                              {i === 0 && <Star className="w-3 h-3 inline mr-1 text-amber-400" />}
                              {row.player.name}
                            </th>
                            <td className={`py-2 px-2 text-center font-bold`} style={{ color: accent }}>{row.points}</td>
                            <td className={`py-2 px-2 text-center text-emerald-400`}>{row.wins}</td>
                            <td className={`py-2 px-2 text-center ${textMuted}`}>{row.draws}</td>
                            <td className={`py-2 px-2 text-center text-red-400`}>{row.losses}</td>
                            <td className={`py-2 pl-2 text-center ${textMuted}`}>{row.buchholz.toFixed(1)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {standings.length > 10 && (
                      <p className={`text-xs ${textMuted} mt-2 text-center`}>+{standings.length - 10} more players</p>
                    )}
                  </div>
                </div>
              )}

              {/* ── Elimination bracket ──────────────────────────────────── */}
              {(isElim || (isSwissElim && state.elimPhase === "elimination")) && state.rounds.length > 0 && (
                <TournamentBracket
                  rounds={state.rounds}
                  players={state.players}
                  isDark={isDark}
                  textMain={textMain}
                  textMuted={textMuted}
                  accent={accent}
                />
              )}

              {/* ── Round Robin matrix ───────────────────────────────────── */}
              {isRR && completedRounds.length > 0 && (
                <RoundRobinMatrix
                  rounds={completedRounds}
                  players={state.players}
                  isDark={isDark}
                  textMain={textMain}
                  textMuted={textMuted}
                  accent={accent}
                />
              )}

              {/* ── Swiss round results ──────────────────────────────────── */}
              {!isElim && !isRR && completedRounds.length > 0 && (
                <div>
                  <h4 className={`text-xs font-semibold uppercase tracking-wider mb-3 ${textMuted}`}>Round Results</h4>
                  <div className="space-y-3">
                    {completedRounds.slice(-3).reverse().map((round) => (
                      <div key={round.number}>
                        <p className={`text-[11px] font-semibold ${textMuted} mb-1.5`}>Round {round.number}</p>
                        <div className="space-y-1">
                          {round.games.map((game) => {
                            const white = state.players.find((p) => p.id === game.whiteId);
                            const black = state.players.find((p) => p.id === game.blackId);
                            if (!white || !black) return null;
                            const wWon = game.result === "1-0";
                            const bWon = game.result === "0-1";
                            const draw = game.result === "½-½";
                            return (
                              <div key={game.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl ${isDark ? "bg-white/4" : "bg-[#FBFADA]/60"}`}>
                                <span className={`flex-1 text-xs text-right truncate font-medium ${wWon ? textMain : textMuted}`}>
                                  {white.name}
                                </span>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-bold ${
                                    wWon ? "bg-emerald-500/20 text-emerald-400" : draw ? isDark ? "bg-white/10 text-white/50" : "bg-gray-100 text-gray-500" : "bg-red-500/10 text-red-400"
                                  }`}>{wWon ? "1" : draw ? "½" : "0"}</span>
                                  <span className={`text-[10px] ${textMuted}`}>–</span>
                                  <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-bold ${
                                    bWon ? "bg-emerald-500/20 text-emerald-400" : draw ? isDark ? "bg-white/10 text-white/50" : "bg-gray-100 text-gray-500" : "bg-red-500/10 text-red-400"
                                  }`}>{bWon ? "1" : draw ? "½" : "0"}</span>
                                </div>
                                <span className={`flex-1 text-xs truncate font-medium ${bWon ? textMain : textMuted}`}>
                                  {black.name}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                    {completedRounds.length > 3 && (
                      <p className={`text-xs ${textMuted} text-center`}>Showing last 3 of {completedRounds.length} rounds</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── TournamentBracket ───────────────────────────────────────────────────────
// Single-elimination bracket visualizer.

function TournamentBracket({
  rounds,
  players,
  isDark,
  textMain,
  textMuted,
  accent,
}: {
  rounds: { number: number; status: string; games: { id: string; round: number; board: number; whiteId: string; blackId: string; result: string; isThirdPlace?: boolean }[] }[];
  players: { id: string; name: string }[];
  isDark: boolean;
  textMain: string;
  textMuted: string;
  accent: string;
}) {
  const playerName = (id: string) => players.find((p) => p.id === id)?.name ?? "BYE";
  const elimRounds = rounds.filter((r) => !r.games.every((g) => g.isThirdPlace));

  const roundLabel = (roundNum: number, totalRounds: number) => {
    const remaining = totalRounds - roundNum + 1;
    if (remaining === 1) return "Final";
    if (remaining === 2) return "Semifinals";
    if (remaining === 3) return "Quarterfinals";
    return `Round ${roundNum}`;
  };

  return (
    <div>
      <h4 className={`text-xs font-semibold uppercase tracking-wider mb-3 ${textMuted}`}>Bracket</h4>
      <div className="overflow-x-auto">
        <div className="flex gap-4 min-w-max pb-2">
          {elimRounds.map((round) => (
            <div key={round.number} className="flex flex-col gap-2" style={{ minWidth: 160 }}>
              <p className={`text-[11px] font-semibold ${textMuted} mb-1`}>
                {roundLabel(round.number, elimRounds.length)}
              </p>
              {round.games.filter((g) => !g.isThirdPlace).map((game) => {
                const white = playerName(game.whiteId);
                const black = playerName(game.blackId);
                const wWon = game.result === "1-0";
                const bWon = game.result === "0-1";
                const pending = game.result === "*";
                return (
                  <div key={game.id} className={`rounded-xl overflow-hidden border ${isDark ? "border-white/10" : "border-[#ADBC9F]/50"}`}>
                    {/* White player */}
                    <div className={`flex items-center gap-2 px-3 py-2 ${
                      wWon ? isDark ? "bg-emerald-500/10" : "bg-emerald-50/80" : isDark ? "bg-white/3" : "bg-white"
                    }`}>
                      <span className={`w-4 h-4 rounded-full flex-shrink-0 ${isDark ? "bg-white/80" : "bg-gray-100"}`} style={{ border: "1px solid #ccc" }} />
                      <span className={`text-xs flex-1 truncate font-medium ${wWon ? textMain : textMuted}`}>{white}</span>
                      {!pending && (
                        <span className={`text-[11px] font-bold ${wWon ? "text-emerald-400" : "text-red-400"}`}>
                          {wWon ? "1" : "0"}
                        </span>
                      )}
                    </div>
                    {/* Divider */}
                    <div className={`h-px ${isDark ? "bg-white/8" : "bg-gray-100"}`} />
                    {/* Black player */}
                    <div className={`flex items-center gap-2 px-3 py-2 ${
                      bWon ? isDark ? "bg-emerald-500/10" : "bg-emerald-50/80" : isDark ? "bg-white/3" : "bg-white"
                    }`}>
                      <span className={`w-4 h-4 rounded-full flex-shrink-0 bg-gray-800`} style={{ border: "1px solid #555" }} />
                      <span className={`text-xs flex-1 truncate font-medium ${bWon ? textMain : textMuted}`}>{black}</span>
                      {!pending && (
                        <span className={`text-[11px] font-bold ${bWon ? "text-emerald-400" : "text-red-400"}`}>
                          {bWon ? "1" : "0"}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── RoundRobinMatrix ────────────────────────────────────────────────────────
// Cross-table matrix for round robin tournaments.

function RoundRobinMatrix({
  rounds,
  players,
  isDark,
  textMain,
  textMuted,
  accent,
}: {
  rounds: { number: number; status: string; games: { id: string; whiteId: string; blackId: string; result: string }[] }[];
  players: { id: string; name: string; points: number }[];
  isDark: boolean;
  textMain: string;
  textMuted: string;
  accent: string;
}) {
  // Build result map: resultMap[whiteId][blackId] = result
  const resultMap: Record<string, Record<string, string>> = {};
  for (const round of rounds) {
    for (const game of round.games) {
      if (!resultMap[game.whiteId]) resultMap[game.whiteId] = {};
      resultMap[game.whiteId][game.blackId] = game.result;
    }
  }

  const getScore = (aId: string, bId: string): string => {
    if (aId === bId) return "—";
    const asWhite = resultMap[aId]?.[bId];
    if (asWhite) {
      if (asWhite === "1-0") return "1";
      if (asWhite === "0-1") return "0";
      if (asWhite === "½-½") return "½";
    }
    const asBlack = resultMap[bId]?.[aId];
    if (asBlack) {
      if (asBlack === "0-1") return "1";
      if (asBlack === "1-0") return "0";
      if (asBlack === "½-½") return "½";
    }
    return "";
  };

  const sorted = [...players].sort((a, b) => b.points - a.points);

  return (
    <div>
      <h4 className={`text-xs font-semibold uppercase tracking-wider mb-3 ${textMuted}`}>Cross Table</h4>
      <div className="overflow-x-auto">
        <table className="text-xs w-full">
          <caption className="sr-only">Tournament player cross-table</caption>
          <thead>
            <tr>
              <th scope="col" className={`text-left pb-2 pr-3 font-semibold ${textMuted}`}>#</th>
              <th scope="col" className={`text-left pb-2 pr-3 font-semibold ${textMuted}`}>Player</th>
              {sorted.map((_, i) => (
                <th scope="col" key={i} className={`text-center pb-2 px-1 font-semibold ${textMuted} w-7`}>{i + 1}</th>
              ))}
              <th scope="col" className={`text-center pb-2 pl-2 font-bold`} style={{ color: accent }}>Pts</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((player, i) => (
              <tr key={player.id} className={`border-t ${isDark ? "border-white/5" : "border-gray-100"}`}>
                <td className={`py-1.5 pr-3 font-bold ${textMuted}`}>{i + 1}</td>
                <th scope="row" className={`py-1.5 pr-3 text-left font-medium ${textMain} max-w-[90px] truncate`}>{player.name}</th>
                {sorted.map((opponent) => {
                  const score = getScore(player.id, opponent.id);
                  const isSelf = player.id === opponent.id;
                  return (
                    <td key={opponent.id} className={`py-1.5 px-1 text-center w-7 ${
                      isSelf ? isDark ? "bg-white/5" : "bg-gray-100" : ""
                    }`}>
                      <span className={`font-semibold ${
                        score === "1" ? "text-emerald-400"
                        : score === "0" ? "text-red-400"
                        : score === "½" ? isDark ? "text-white/50" : "text-gray-500"
                        : textMuted
                      }`}>{score}</span>
                    </td>
                  );
                })}
                <td className={`py-1.5 pl-2 text-center font-bold`} style={{ color: accent }}>{player.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── LeagueCard ──────────────────────────────────────────────────────────────
// Expandable card for the Leagues tab — shows standings + match schedule on demand.

type LeagueStandingEntry = {
  playerId: string;
  displayName: string;
  avatarUrl?: string | null;
  wins: number;
  losses: number;
  draws: number;
  points: number;
  rank: number;
  streak: string;
  movement: string;
  lastResults: string;
  chesscomRating?: number | null;
  chesscomUsername?: string | null;
};

type LeagueMatchEntry = {
  id: number;
  weekNumber: number;
  playerWhiteId: string;
  playerWhiteName: string;
  playerBlackId: string;
  playerBlackName: string;
  resultStatus: string;
  result?: string | null;
};

type LeagueWeekEntry = {
  id: number;
  weekNumber: number;
  isComplete: number;
  deadline?: string | null;
  matches: LeagueMatchEntry[];
};

function LeagueCard({
  lg,
  isDark,
  textMain,
  textMuted,
  divider,
  card,
  cardBorder,
  accent,
  onNavigate,
}: {
  lg: { id: string; name: string; status: string; currentWeek: number; totalWeeks: number; playerCount: number; maxPlayers?: number };
  isDark: boolean;
  textMain: string;
  textMuted: string;
  divider: string;
  card: string;
  cardBorder: string;
  accent: string;
  onNavigate: (path: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [activeView, setActiveView] = useState<"standings" | "schedule">("standings");
  const [standings, setStandings] = useState<LeagueStandingEntry[]>([]);
  const [weeks, setWeeks] = useState<LeagueWeekEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const loaded = useRef(false);

  const isDraft = lg.status === "draft";
  const isActive = lg.status === "active";
  const isCompleted = lg.status === "completed";

  const statusColor = isActive
    ? "text-green-500 bg-green-500/10 border-green-500/20"
    : isCompleted
    ? isDark ? "text-amber-400 bg-amber-400/10 border-amber-400/20" : "text-amber-600 bg-amber-500/10 border-amber-500/20"
    : isDark ? "text-white/40 bg-white/5 border-white/10" : "text-[#436850]/60 bg-[#ADBC9F]/20 border-[#ADBC9F]/40";

  const statusLabel = isActive ? "Active" : isCompleted ? "Complete" : "Draft";

  // Fetch standings + weeks when opened
  useEffect(() => {
    if (!open || loaded.current || isDraft) return;
    loaded.current = true;
    setLoading(true);
    Promise.all([
      apiFetch<LeagueStandingEntry[]>(`/api/leagues/${lg.id}/standings`).catch(() => []),
      apiFetch<LeagueWeekEntry[]>(`/api/leagues/${lg.id}/weeks`).catch(() => []),
    ]).then(([s, w]) => {
      setStandings(s);
      setWeeks(w);
      // Default to current week (last incomplete) or last week
      const currentW = w.find((wk) => !wk.isComplete) ?? w[w.length - 1];
      if (currentW) setSelectedWeek(currentW.weekNumber);
    }).finally(() => setLoading(false));
  }, [open, lg.id, isDraft]);

  const currentWeekData = weeks.find((w) => w.weekNumber === selectedWeek);

  const formDots = (lastResults: string) => {
    if (!lastResults) return [];
    return lastResults.split(",").slice(-5).map((r) => r.trim());
  };

  const movementIcon = (movement: string) => {
    if (movement === "up") return <TrendingUp className="w-3 h-3 text-emerald-400" />;
    if (movement === "down") return <TrendingDown className="w-3 h-3 text-red-400" />;
    return <Minus className="w-3 h-3 text-gray-400" />;
  };

  return (
    <div className={`rounded-3xl border ${cardBorder} ${card} overflow-hidden`}>
      {/* Card header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center gap-4 px-5 py-4 text-left transition-colors ${isDark ? "hover:bg-white/3" : "hover:bg-[#FBFADA]/60"}`}
      >
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
          isActive ? "bg-green-500/15" : isCompleted ? isDark ? "bg-amber-500/10" : "bg-amber-50" : isDark ? "bg-white/6" : "bg-[#FBFADA]/70"
        }`}>
          {isActive
            ? <Zap className="w-5 h-5 text-green-500" strokeWidth={1.8} />
            : isCompleted
            ? <Trophy className="w-5 h-5 text-amber-400" strokeWidth={1.8} />
            : <Award className={`w-5 h-5 ${textMuted}`} strokeWidth={1.8} />
          }
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-sm font-semibold truncate ${textMain}`}>{lg.name}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold border ${statusColor}`}>{statusLabel}</span>
          </div>
          <div className={`flex items-center gap-2 mt-0.5 text-xs ${textMuted}`}>
            <span>{lg.playerCount} players</span>
            {!isDraft && <span>·</span>}
            {isActive && <span>Week {lg.currentWeek}/{lg.totalWeeks}</span>}
            {isCompleted && <span>{lg.totalWeeks} weeks · Season complete</span>}
            {isDraft && <span>Forming up · {lg.playerCount}/{lg.maxPlayers ?? lg.playerCount}</span>}
          </div>
        </div>
        <ChevronRight className={`w-4 h-4 flex-shrink-0 transition-transform ${textMuted} ${open ? "rotate-90" : ""}`} />
      </button>

      {/* Expandable drawer */}
      {open && (
        <div className={`border-t ${divider}`}>
          {/* Sub-nav + open link */}
          <div className={`px-5 py-3 flex items-center justify-between border-b ${divider}`}>
            {isDraft ? (
              <span className={`text-xs ${textMuted}`}>Season hasn't started yet</span>
            ) : (
              <div className="flex gap-1">
                {(["standings", "schedule"] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setActiveView(v)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors capitalize ${
                      activeView === v
                        ? isDark ? "bg-white/10 text-white" : "bg-[#436850]/10 text-[#436850]"
                        : textMuted
                    }`}
                  >{v}</button>
                ))}
              </div>
            )}
            <button
              onClick={() => onNavigate(`/leagues/${lg.id}`)}
              className="flex items-center gap-1 text-xs font-semibold transition-colors"
              style={{ color: accent }}
            >
              Open <ExternalLink className="w-3 h-3" />
            </button>
          </div>

          {/* Loading */}
          {loading && (
            <div className="py-10 flex items-center justify-center">
              <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: `${accent} transparent ${accent} ${accent}` }} />
            </div>
          )}

          {/* Draft state */}
          {!loading && isDraft && (
            <div className="px-5 py-8 text-center">
              <Award className={`w-8 h-8 mx-auto mb-2 ${textMuted} opacity-40`} />
              <p className={`text-sm ${textMuted}`}>League is in draft — standings will appear once the season starts.</p>
            </div>
          )}

          {/* Standings view */}
          {!loading && !isDraft && activeView === "standings" && (
            <div className="px-5 py-4">
              {standings.length === 0 ? (
                <p className={`text-sm text-center py-6 ${textMuted}`}>No standings yet</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <caption className="sr-only">Club league standings</caption>
                    <thead>
                      <tr className={textMuted}>
                        <th scope="col" className="text-left pb-2 pr-1 font-semibold w-5">#</th>
                        <th scope="col" className="text-left pb-2 pr-2 font-semibold">Player</th>
                        <th scope="col" className="text-center pb-2 px-1 font-semibold w-7">W</th>
                        <th scope="col" className="text-center pb-2 px-1 font-semibold w-7">D</th>
                        <th scope="col" className="text-center pb-2 px-1 font-semibold w-7">L</th>
                        <th scope="col" className="text-center pb-2 px-1 font-bold w-10" style={{ color: accent }}>Pts</th>
                        <th scope="col" className="text-center pb-2 pl-2 font-semibold">Form</th>
                      </tr>
                    </thead>
                    <tbody>
                      {standings.map((row, i) => {
                        const dots = formDots(row.lastResults);
                        return (
                          <tr key={row.playerId} className={`border-t ${isDark ? "border-white/5" : "border-gray-100"} ${i === 0 ? isDark ? "bg-amber-500/5" : "bg-amber-50/50" : ""}`}>
                            <td className="py-2 pr-1">
                              <div className="flex items-center gap-0.5">
                                <span className={`font-bold text-[11px] ${
                                  i === 0 ? "text-amber-400" : i === 1 ? isDark ? "text-white/50" : "text-gray-400" : i === 2 ? "text-amber-600/70" : textMuted
                                }`}>{row.rank}</span>
                                <span className="ml-0.5">{movementIcon(row.movement)}</span>
                              </div>
                            </td>
                            <th scope="row" className="py-2 pr-2 text-left font-normal">
                              <div className="flex items-center gap-2">
                                <div className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold overflow-hidden ${isDark ? "bg-white/10" : "bg-gray-100"}`}>
                                  {row.avatarUrl
                                    ? <img loading="lazy" decoding="async" src={row.avatarUrl} alt="" className="w-6 h-6 object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                                    : <span className={textMuted}>{(row.displayName?.[0] ?? "?").toUpperCase()}</span>
                                  }
                                </div>
                                <div className="min-w-0">
                                  <p className={`font-semibold truncate max-w-[90px] ${textMain}`}>
                                    {i === 0 && <Star className="w-2.5 h-2.5 inline mr-0.5 text-amber-400" />}
                                    {row.displayName}
                                  </p>
                                  {row.chesscomRating && (
                                    <p className={`text-[10px] ${textMuted}`}>{row.chesscomRating}</p>
                                  )}
                                </div>
                              </div>
                            </th>
                            <td className="py-2 px-1 text-center text-emerald-400 font-semibold">{row.wins}</td>
                            <td className={`py-2 px-1 text-center font-semibold ${textMuted}`}>{row.draws}</td>
                            <td className="py-2 px-1 text-center text-red-400 font-semibold">{row.losses}</td>
                            <td className="py-2 px-1 text-center font-bold" style={{ color: accent }}>{row.points}</td>
                            <td className="py-2 pl-2">
                              <div className="flex items-center gap-0.5 justify-center">
                                {dots.length === 0
                                  ? <span className={`text-[10px] ${textMuted}`}>—</span>
                                  : dots.map((r, di) => (
                                    <span key={di} className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${
                                      r === "W" ? "bg-emerald-500/20 text-emerald-400"
                                      : r === "L" ? "bg-red-500/10 text-red-400"
                                      : isDark ? "bg-white/10 text-white/40" : "bg-gray-100 text-gray-400"
                                    }`}>{r}</span>
                                  ))
                                }
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Schedule view */}
          {!loading && !isDraft && activeView === "schedule" && (
            <div className="px-5 py-4 space-y-4">
              {weeks.length === 0 ? (
                <p className={`text-sm text-center py-6 ${textMuted}`}>No schedule yet</p>
              ) : (
                <>
                  {/* Week navigator */}
                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {weeks.map((w) => (
                      <button
                        key={w.weekNumber}
                        onClick={() => setSelectedWeek(w.weekNumber)}
                        className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                          selectedWeek === w.weekNumber
                            ? isDark ? "bg-white/15 text-white" : "bg-[#436850]/10 text-[#436850]"
                            : textMuted
                        }`}
                      >
                        {w.isComplete ? (
                          <span className="flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            Wk {w.weekNumber}
                          </span>
                        ) : (
                          <span>Wk {w.weekNumber}</span>
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Matches for selected week */}
                  {currentWeekData ? (
                    <div className="space-y-2">
                      {currentWeekData.matches.length === 0 ? (
                        <p className={`text-xs text-center py-4 ${textMuted}`}>No matches this week</p>
                      ) : (
                        currentWeekData.matches.map((match) => {
                          const isPending = match.resultStatus === "pending";
                          const isWhiteWin = match.result === "white";
                          const isBlackWin = match.result === "black";
                          const isDraw = match.result === "draw";
                          return (
                            <div key={match.id} className={`flex items-center gap-2 px-3 py-2.5 rounded-xl ${isDark ? "bg-white/4" : "bg-[#FBFADA]/60"}`}>
                              {/* White player */}
                              <span className={`flex-1 text-xs text-right truncate font-medium ${isWhiteWin ? textMain : isPending ? textMuted : "text-red-400/70"}`}>
                                {match.playerWhiteName}
                              </span>
                              {/* Score chips */}
                              <div className="flex items-center gap-1 flex-shrink-0">
                                {isPending ? (
                                  <>
                                    <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${isDark ? "bg-white/8 text-white/30" : "bg-gray-100 text-gray-400"}`}>?</span>
                                    <span className={`text-[10px] ${textMuted}`}>–</span>
                                    <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${isDark ? "bg-white/8 text-white/30" : "bg-gray-100 text-gray-400"}`}>?</span>
                                  </>
                                ) : (
                                  <>
                                    <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                                      isWhiteWin ? "bg-emerald-500/20 text-emerald-400" : isDraw ? isDark ? "bg-white/10 text-white/50" : "bg-gray-100 text-gray-500" : "bg-red-500/10 text-red-400"
                                    }`}>{isWhiteWin ? "1" : isDraw ? "½" : "0"}</span>
                                    <span className={`text-[10px] ${textMuted}`}>–</span>
                                    <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                                      isBlackWin ? "bg-emerald-500/20 text-emerald-400" : isDraw ? isDark ? "bg-white/10 text-white/50" : "bg-gray-100 text-gray-500" : "bg-red-500/10 text-red-400"
                                    }`}>{isBlackWin ? "1" : isDraw ? "½" : "0"}</span>
                                  </>
                                )}
                              </div>
                              {/* Black player */}
                              <span className={`flex-1 text-xs truncate font-medium ${isBlackWin ? textMain : isPending ? textMuted : "text-red-400/70"}`}>
                                {match.playerBlackName}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  ) : (
                    <p className={`text-xs text-center py-4 ${textMuted}`}>Select a week above</p>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
