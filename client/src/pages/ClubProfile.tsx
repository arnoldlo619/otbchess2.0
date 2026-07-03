/**
 * ClubProfile page — /clubs/:id
 *
 * Full club profile with:
 *   - Hero banner with club identity, stats, and join/leave CTA
 *   - About section with description and social links
 *   - Members roster with roles and stats
 *   - Tournament history with status badges
 */
import {useState, useEffect} from "react";
import { useParams, useLocation, Link } from "wouter";
import { NavLogo } from "@/components/NavLogo";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { useAuthContext } from "@/context/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
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
import { apiJoinClub, apiLeaveClub } from "@/lib/clubsApi";
import { useClubPresence } from "@/hooks/useClubPresence";
import { ClubAvatarUpload } from "@/components/ClubAvatarUpload";
import { ClubBannerUpload, cropBannerImage, validateBannerFile } from "@/components/ClubBannerUpload";
import { TournamentWizard } from "@/components/TournamentWizard";
import { listTournamentsByClub, type TournamentConfig } from "@/lib/tournamentRegistry";
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
  type FeedEvent,
  type FeedRSVPEntry,
} from "@/lib/clubFeedRegistry";
import {
  listClubEvents,
  countRSVPs,
  getEventRSVPs,
  getUserRSVP,
  upsertRSVP,
  createClubEvent,
  updateClubEvent,
  deleteClubEvent,
  createRecurringEvents,
  deleteRecurringSeries,
  type ClubEvent,
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
} from "lucide-react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import AuthModal from "@/components/AuthModal";
import { ContactOwnerModal } from "@/components/ContactOwnerModal";
import { apiFetch } from "@/lib/apiFetch";
import { AvatarNavDropdown } from "@/components/AvatarNavDropdown";
import { EditClubDetailsModal } from "@/components/EditClubDetailsModal";
import { ClubShareModal } from "@/components/ClubShareModal";

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
  clubId,
  isMemberUser,
  accentColor,
  onVoted,
  onRsvped,
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
  clubId: string;
  isMemberUser: boolean;
  accentColor?: string;
  onVoted?: () => void;
  onRsvped?: () => void;
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

  function handleVote(optionId: string) {
    if (pollExpired || !userId || !isMemberUser) return;
    castPollVote(clubId, event.id, optionId, userId, event.pollMultiple ?? false);
    onVoted?.();
  }

  function handleRsvp(status: FeedRSVPEntry["status"]) {
    if (!userId || !isMemberUser) return;
    upsertFeedRSVP(clubId, event.id, userId, displayName ?? "", status, avatarUrl ?? null);
    onRsvped?.();
  }

  return (
    <div className={`group ${ (isPoll || isRsvp) ? "px-5 py-4" : "flex items-start gap-3 px-5 py-4" }`}>
      {/* Standard activity row (non-poll, non-rsvp) */}
      {!isPoll && !isRsvp && (
        <>
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${accentCls}`}>
            {cfg.icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium ${textMain} leading-snug`}>{event.description}</p>
            {event.detail && (
              <p className={`text-sm mt-1 leading-relaxed ${
                event.type === "announcement" ? (isDark ? "text-white/70" : "text-[#436850]") : textMuted
              }`}>{event.detail}</p>
            )}
            <div className="flex items-center gap-3 mt-1.5">
              <span className={`text-xs ${textMuted}`}>{relativeTime(event.createdAt)}</span>
              {event.linkHref && (
                <a href={event.linkHref} className={`text-xs font-semibold transition-colors ${
                  isDark ? "text-[#4CAF50] hover:text-[#66BB6A]" : "text-[#436850] hover:text-[#3a5230]"
                }`}>{event.linkLabel ?? "View"} &rarr;</a>
              )}
            </div>
          </div>
          {canDelete && (
            <button
              onClick={() => onDelete(event.id)}
              className={`opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg ${
                isDark ? "hover:bg-white/8 text-white/30 hover:text-white/60" : "hover:bg-[#ADBC9F]/50 text-[#436850]/70 hover:text-[#436850]"
              }`}
              title="Remove from feed"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
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
                          <PlayerAvatar username={r.displayName} name={r.displayName} avatarUrl={r.avatarUrl ?? undefined} size={24} className="w-full h-full object-cover" />
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
  const initialTab = (() => {
    const search = typeof window !== "undefined" ? window.location.search : "";
    const p = new URLSearchParams(search);
    const t = p.get("tab");
    const valid = ["events", "members", "tournaments", "feed", "leagues"] as const;
    return (valid as readonly string[]).includes(t ?? "") ? (t as typeof valid[number]) : "feed";
  })();

  const [club, setClub] = useState<Club | null>(null);
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [tournaments, setTournaments] = useState<ClubTournament[]>([]);
  const [joined, setJoined] = useState(false);
  const [activeTab, setActiveTab] = useState<"events" | "members" | "tournaments" | "feed" | "leagues">(initialTab);
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
  const [memberPage, setMemberPage] = useState(1);
  const MEMBERS_PER_PAGE = 12;
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
  const [isLeavingClub, setIsLeavingClub] = useState(false);
  const [showWizard, setShowWizard] = useState(() => {
    const p = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    return p.get("create") === "1";
  });
  const [liveTournaments, setLiveTournaments] = useState<TournamentConfig[]>([]);
  const [feedEvents, setFeedEvents] = useState<FeedEvent[]>([]);
  const [announcementDraft, setAnnouncementDraft] = useState("");
  const [postingAnnouncement, setPostingAnnouncement] = useState(false);
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
    };

    // Try localStorage first (fast, works offline)
    const local = getClub(id) ?? getClubBySlug(id);
    if (local) {
      loadClubData(local);
      return;
    }

    // Fall back to server API (handles share links from other devices/browsers)
    fetch(`/api/clubs/${encodeURIComponent(id)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((serverClub: Club | null) => {
        if (serverClub) {
          loadClubData(serverClub);
        }
        // If null, the "Club not found" UI will render (club truly doesn't exist)
      })
      .catch(() => {
        // Network error — "Club not found" UI will render
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

  // Membership flags (aliases of the pre-return derivations for readability below)
  const _myMembership = myMembershipEarly;
  const isOwner = isOwnerEarly;
  const isDirector = isDirectorEarly;
  // onlineCount already declared above (before the early return)

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
    await new Promise((r) => setTimeout(r, 300));
    postAnnouncement(club.id, user.displayName, announcementDraft.trim(), user.avatarUrl ?? null);
    setFeedEvents(listFeedEvents(club.id));
    setAnnouncementDraft("");
    setPostingAnnouncement(false);
    toast.success("Announcement posted!");
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
  const bg = isDark ? "bg-[#0d1a0f]" : "bg-[#FBFADA]";
  const card = isDark ? "bg-[#1a2e1d]" : "bg-[#F0F5E8]";
  const cardBorder = isDark ? "border-white/8" : "border-[#ADBC9F]";
  const textMain = isDark ? "text-white" : "text-[#12372A]";
  const textMuted = isDark ? "text-white/50" : "text-[#436850]";
  const divider = isDark ? "border-white/8" : "border-[#ADBC9F]";
  const tabActive = isDark ? "bg-[#4CAF50]/15 text-[#4CAF50]" : "bg-[#436850]/10 text-[#436850]";
  const tabInactive = isDark ? "text-white/50 hover:text-white/80" : "text-[#436850] hover:text-[#12372A]";
  // Use the club's stored accent color — falls back to platform defaults if not set.
  // Because `club` is in React state and updated by the onClubChange subscriber,
  // this re-derives automatically whenever the owner saves a new color in Settings.
  const accent = club?.accentColor ?? (isDark ? "#4CAF50" : "#436850");

  return (
    <div className={`min-h-screen ${bg}`}>
      <div className="flex h-screen overflow-hidden">

        {/* ── LEFT SIDEBAR — Partiful-style icon-only rail ─── */}
        <aside
          className="hidden lg:flex flex-col items-center w-[70px] flex-shrink-0 h-full relative"
          style={{
            background: isDark ? "#0f1117" : "#111827",
            borderRight: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.08)"}`,
          }}
        >
          {/* Top: club logo */}
          <div className="pt-5 pb-4 flex flex-col items-center">
            <button
              onClick={() => navigate("/clubs")}
              className="w-10 h-10 rounded-xl flex-shrink-0 overflow-hidden flex items-center justify-center text-sm font-bold text-white shadow-md transition-opacity hover:opacity-80"
              style={{ background: accent }}
              title={club.name + " — Back to Clubs"}
            >
              {club.avatarUrl && !avatarBroken ? (
                <img src={club.avatarUrl} alt={club.name} className="w-full h-full object-cover" onError={() => setAvatarBroken(true)} />
              ) : (
                <span>{flag}</span>
              )}
            </button>
          </div>

          {/* Divider */}
          <div className="w-8 h-px mb-2" style={{ background: "rgba(255,255,255,0.10)" }} />

          {/* Nav items — icon-only with hover tooltips */}
          <nav className="flex flex-col items-center gap-1 flex-1">
            {(["feed", "events", "members", "tournaments", "leagues"] as const).map((t) => {
              const iconMap: Record<string, React.ReactNode> = {
                feed: <Megaphone size={18} />,
                events: <Calendar size={18} />,
                members: <Users size={18} />,
                tournaments: <Trophy size={18} />,
                leagues: <Award size={18} />,
              };
              const labelMap: Record<string, string> = {
                feed: "Feed",
                events: "Events",
                members: "Members",
                tournaments: "Tournaments",
                leagues: "Leagues",
              };
              const badgeMap: Record<string, number> = {
                events: clubEvents.length,
                feed: feedEvents.length,
                tournaments: tournaments.length + liveTournaments.length,
                leagues: clubLeagues.length,
              };
              const isActive = activeTab === t;
              const badge = badgeMap[t] ?? 0;
              return (
                <button
                  key={t}
                  onClick={() => setActiveTab(t)}
                  className="relative w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-150 group"
                  style={{
                    background: isActive ? accent : "transparent",
                    color: isActive ? (isDark ? "oklch(0.12 0.04 145)" : "#fff") : "rgba(255,255,255,0.45)",
                  }}
                  onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "#fff"; } }}
                  onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.45)"; } }}
                  aria-label={labelMap[t]}
                >
                  {iconMap[t]}
                  {badge > 0 && (
                    <span
                      className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold"
                      style={{ background: "#ef4444", color: "#fff" }}
                    >
                      {badge > 9 ? "9+" : badge}
                    </span>
                  )}
                  {/* Hover tooltip */}
                  <span
                    className="absolute left-full ml-3 px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50"
                    style={{ background: "oklch(0.22 0.06 145)", color: "#fff", boxShadow: "0 4px 12px rgba(0,0,0,0.4)" }}
                  >
                    {labelMap[t]}
                  </span>
                </button>
              );
            })}
          </nav>

          {/* Bottom: utility icons */}
          <div className="pb-4 flex flex-col items-center gap-1">
            {/* Divider */}
            <div className="w-8 h-px mb-2" style={{ background: "rgba(255,255,255,0.08)" }} />

            <button
              onClick={handleShare}
              className="relative w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-150 group"
              style={{ color: "rgba(255,255,255,0.45)" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "#fff"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.45)"; }}
              aria-label="Share Club"
            >
              <Share2 size={18} />
              <span className="absolute left-full ml-3 px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50" style={{ background: "oklch(0.22 0.06 145)", color: "#fff", boxShadow: "0 4px 12px rgba(0,0,0,0.4)" }}>Share Club</span>
            </button>

            {user && !isOwner && !isDirector && (
              <button
                onClick={() => setShowContactOwner(true)}
                className="relative w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-150 group"
                style={{ color: "rgba(255,255,255,0.45)" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "#fff"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.45)"; }}
                aria-label="Contact Owner"
              >
                <MessageSquare size={18} />
                <span className="absolute left-full ml-3 px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50" style={{ background: "oklch(0.22 0.06 145)", color: "#fff", boxShadow: "0 4px 12px rgba(0,0,0,0.4)" }}>Contact Owner</span>
              </button>
            )}

            {(isOwner || isDirector) && (
              <button
                onClick={() => { setPendingAvatar(undefined); setShowSettings(true); }}
                className="relative w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-150 group"
                style={{ color: "rgba(255,255,255,0.45)" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "#fff"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.45)"; }}
                aria-label="Settings"
              >
                <MoreHorizontal size={18} />
                <span className="absolute left-full ml-3 px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50" style={{ background: "oklch(0.22 0.06 145)", color: "#fff", boxShadow: "0 4px 12px rgba(0,0,0,0.4)" }}>Settings</span>
              </button>
            )}

            {/* Profile avatar */}
            {user && (
              <button
                onClick={() => navigate(`/profile/${user.id}`)}
                className="relative w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-150 group mt-1"
                style={{ color: "rgba(255,255,255,0.45)" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                aria-label={user.displayName ?? "Profile"}
              >
                <div className="w-7 h-7 rounded-full overflow-hidden bg-white/20 flex items-center justify-center text-xs font-bold text-white">
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    user.displayName?.charAt(0).toUpperCase() ?? "?"
                  )}
                </div>
                <span className="absolute left-full ml-3 px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50" style={{ background: "oklch(0.22 0.06 145)", color: "#fff", boxShadow: "0 4px 12px rgba(0,0,0,0.4)" }}>{user.displayName ?? "Profile"}</span>
              </button>
            )}
          </div>
        </aside>

        {/* ── MAIN CONTENT AREA ────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* ── BRANDED TOP BAR ─────────────────────────────────────────── */}
          <div
            className="flex-shrink-0 flex items-center gap-3 px-4 lg:px-10 xl:px-14 py-2 otb-header-safe"
            style={{
              background: isDark ? "oklch(0.12 0.03 145 / 0.98)" : "#0f1f14",
              borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.08)"}`,
            }}
          >
            {/* Mobile back button */}
            <button
              onClick={() => navigate("/clubs")}
              className="lg:hidden p-1.5 rounded-lg transition-opacity hover:opacity-70"
              style={{ color: "oklch(0.65 0.12 145)" }}
            >
              <ChevronLeft size={15} />
            </button>
            {/* Mobile title */}
            <div className="lg:hidden flex-1 min-w-0">
              <span className="text-sm font-bold truncate" style={{ color: "#ffffff" }}>
                {club.name}
              </span>
            </div>
            {/* Desktop: club name */}
            <span className="hidden lg:block text-sm font-semibold text-white/80 truncate max-w-[220px]">{club.name}</span>
            {/* Right side: stats + avatar */}
            <div className="flex items-center gap-3 ml-auto">
              <div className="hidden md:flex items-center gap-3 text-xs" style={{ color: "oklch(0.55 0.08 145)" }}>
                <span className="flex items-center gap-1">
                  <Users size={12} style={{ color: accent }} />
                  <span className="font-semibold" style={{ color: "#fff" }}>{club.memberCount}</span> members
                </span>
                <span className="flex items-center gap-1">
                  <Trophy size={12} style={{ color: accent }} />
                  <span className="font-semibold" style={{ color: "#fff" }}>{club.tournamentCount}</span> tournaments
                </span>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span className="font-semibold" style={{ color: "#fff" }}>{onlineCount}</span> online
              </div>
              <AvatarNavDropdown currentPage="Clubs" />
            </div>
          </div>

          {/* ── SCROLLABLE CONTENT ─────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto pb-20 lg:pb-6">
            <div className="px-4 lg:px-10 xl:px-14 py-5">
              <div className="max-w-6xl">
                {/* ── CLUB BANNER + WELCOME HEADER ──────────────────────────── */}
                <div
                  className={`relative rounded-2xl overflow-hidden mb-6${!club.bannerUrl ? " chess-board-bg" : ""}`}
                  style={{
                    minHeight: "180px",
                    ...(club.bannerUrl ? {
                      backgroundImage: `url(${club.bannerUrl})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    } : {}),
                  }}
                >
                  {/* Enhanced gradient overlay — deeper, more cinematic */}
                  <div
                    className="absolute inset-0"
                    style={{
                      background: club.bannerUrl
                        ? `linear-gradient(180deg, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.4) 40%, rgba(0,0,0,0.75) 100%)`
                        : `linear-gradient(135deg, ${accent}33 0%, oklch(0.12 0.06 145 / 0.92) 60%, oklch(0.10 0.04 145 / 0.97) 100%)`,
                    }}
                  />
                  {/* Subtle animated shimmer */}
                  {!club.bannerUrl && (
                    <div
                      className="absolute inset-0 pointer-events-none"
                      style={{
                        background: "linear-gradient(120deg, transparent 30%, rgba(76,175,80,0.04) 50%, transparent 70%)",
                        backgroundSize: "200% 100%",
                        animation: "shimmerBg 8s ease-in-out infinite",
                      }}
                    />
                  )}
                  {/* Content */}
                  <div className="relative z-10 flex items-center gap-5 p-6 sm:p-8">
                    {/* Club avatar */}
                    <div
                      className="w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 rounded-2xl flex items-center justify-center flex-shrink-0 overflow-hidden shadow-xl"
                      style={{ background: accent, border: `2px solid ${accent}44` }}
                    >
                      {club.avatarUrl && !avatarBroken ? (
                        <img src={club.avatarUrl} alt={club.name} className="w-full h-full object-cover" onError={() => setAvatarBroken(true)} />
                      ) : (
                        <span className="text-3xl">{flag}</span>
                      )}
                    </div>
                    {/* Club identity */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h1 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight text-white truncate">
                          {club.name}
                        </h1>
                        {club.isPublic ? (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: `${accent}33`, color: accent }}>Public</span>
                        ) : (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "oklch(0.25 0.04 145)", color: "oklch(0.55 0.08 145)" }}>Private</span>
                        )}
                        {club.isVerified && (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1" style={{ background: "oklch(0.25 0.10 220)", color: "oklch(0.75 0.14 220)" }}>
                            <CheckCircle2 size={10} /> Verified
                          </span>
                        )}
                        {club.beginnerFriendly && (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "oklch(0.28 0.10 80)", color: "oklch(0.80 0.14 80)" }}>Beginner Friendly</span>
                        )}
                      </div>
                      {club.description && (
                        <p className="text-sm leading-relaxed line-clamp-2" style={{ color: "oklch(0.70 0.08 145)" }}>
                          {club.description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-xs" style={{ color: "oklch(0.55 0.08 145)" }}>
                        <span className="flex items-center gap-1">
                          <Users size={11} style={{ color: accent }} />
                          <span className="font-semibold text-white">{club.memberCount}</span> members
                        </span>
                        <span className="flex items-center gap-1">
                          <Trophy size={11} style={{ color: accent }} />
                          <span className="font-semibold text-white">{club.tournamentCount}</span> tournaments
                        </span>
                        {club.location && (
                          <span className="hidden sm:flex items-center gap-1">
                            <MapPin size={11} />
                            {flag} {club.location}
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Banner upload overlay (owners/directors only) */}
                    {(isOwner || isDirector) && (
                      <>
                        {/* Drag-and-drop highlight overlay */}
                        <div
                          className="absolute inset-0 z-30 pointer-events-none transition-all duration-200"
                          style={{
                            background: bannerDragOver ? "rgba(0,0,0,0.55)" : "transparent",
                            border: bannerDragOver ? `2px dashed ${club.accentColor ?? "#4CAF50"}` : "2px dashed transparent",
                            borderRadius: "1.5rem",
                          }}
                        >
                          {bannerDragOver && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                              <Camera size={28} style={{ color: club.accentColor ?? "#4CAF50" }} />
                              <span className="text-sm font-bold text-white">Drop to upload banner</span>
                            </div>
                          )}
                        </div>
                        {/* Invisible drag target covering the whole banner */}
                        <div
                          className="absolute inset-0 z-20"
                          onDragOver={(e) => { e.preventDefault(); setBannerDragOver(true); }}
                          onDragLeave={() => setBannerDragOver(false)}
                          onDrop={(e) => {
                            e.preventDefault();
                            setBannerDragOver(false);
                            const file = e.dataTransfer.files?.[0];
                            if (file) handleBannerFile(file);
                          }}
                        />
                        {/* Action buttons top-right */}
                        <div className="absolute top-3 right-3 z-40 flex items-center gap-2">
                          {bannerUploading ? (
                            <div
                              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl"
                              style={{ background: "rgba(0,0,0,0.55)", color: "#fff", backdropFilter: "blur(4px)" }}
                            >
                              <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                              </svg>
                              Uploading…
                            </div>
                          ) : (
                            <>
                              <label
                                htmlFor="banner-upload-profile"
                                className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold px-3 py-1.5 rounded-xl transition-all hover:opacity-90"
                                style={{ background: "rgba(0,0,0,0.55)", color: "#fff", backdropFilter: "blur(4px)" }}
                                title="Change banner image"
                              >
                                <Camera size={13} />
                                {club.bannerUrl ? "Change Banner" : "Add Banner"}
                              </label>
                              {club.bannerUrl && (
                                <button
                                  onClick={handleRemoveBannerHero}
                                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all hover:opacity-90"
                                  style={{ background: "rgba(180,0,0,0.65)", color: "#fff", backdropFilter: "blur(4px)" }}
                                  title="Remove banner image"
                                >
                                  <X size={13} />
                                  Remove
                                </button>
                              )}
                            </>
                          )}
                        </div>
                        <input
                          id="banner-upload-profile"
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleBannerFile(file);
                            e.target.value = "";
                          }}
                        />
                      </>
                    )}
                    {/* Join / Leave CTA */}
                    {!isOwner && !isDirector && (
                      <div className="flex-shrink-0 flex items-center gap-2">
                        {/* Contact Owner button — for all non-owners; guests see auth prompt */}
                        <button
                          onClick={() => {
                            if (!user) { setPendingAction(() => () => setShowContactOwner(true)); setAuthOpen(true); return; }
                            setShowContactOwner(true);
                          }}
                          className="text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all hover:opacity-80 flex items-center gap-1.5"
                          style={{ borderColor: "oklch(0.30 0.06 145)", color: "oklch(0.65 0.10 145)" }}
                        >
                          <MessageSquare size={12} />
                          {user ? "Contact Owner" : "Sign in to Contact"}
                        </button>
                        {joined ? (
                          <button
                            onClick={handleLeave}
                            className="text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all hover:opacity-80"
                            style={{ borderColor: "oklch(0.30 0.06 145)", color: "oklch(0.55 0.08 145)" }}
                          >
                            Leave
                          </button>
                        ) : (
                          <button
                            onClick={handleJoin}
                            className="text-xs font-bold px-4 py-1.5 rounded-xl transition-all hover:opacity-90"
                            style={{ background: accent, color: "#fff" }}
                          >
                            {club.isPublic ? "Join Club" : "Request to Join"}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>



        {/* ── Members tab ─────────────────────────────────────────────────── */}
        {activeTab === "members" && (() => {
          // Filter and sort members
          const filteredMembers = members.filter((m) => {
            if (!memberSearch.trim()) return true;
            const q = memberSearch.toLowerCase();
            return (m.displayName ?? "").toLowerCase().includes(q) ||
              (m.chesscomUsername ?? "").toLowerCase().includes(q);
          });
          const sortedMembers = [...filteredMembers].sort((a, b) => {
            if (memberSort === "name") return (a.displayName ?? "").localeCompare(b.displayName ?? "");
            if (memberSort === "joined") return new Date(b.joinedAt ?? 0).getTime() - new Date(a.joinedAt ?? 0).getTime();
            // role: owner > director > member
            const roleOrder = { owner: 0, director: 1, member: 2 };
            return (roleOrder[a.role as keyof typeof roleOrder] ?? 2) - (roleOrder[b.role as keyof typeof roleOrder] ?? 2);
          });
          const totalPages = Math.ceil(sortedMembers.length / MEMBERS_PER_PAGE);
          const paginated = sortedMembers.slice((memberPage - 1) * MEMBERS_PER_PAGE, memberPage * MEMBERS_PER_PAGE);
          return (
            <div className={`rounded-3xl border ${cardBorder} ${card} overflow-hidden animate-in fade-in duration-200`}>
              {/* Header */}
              <div className={`px-5 py-4 border-b ${divider} flex items-center justify-between gap-3`}>
                <h2 className={`text-sm font-semibold uppercase tracking-wider ${isDark ? "text-white/40" : "text-[#436850]"}`}>
                  Members
                </h2>
                <span className={`text-xs font-medium ${textMuted}`}>{club.memberCount} total</span>
              </div>
              {/* Search + Sort bar */}
              <div className={`px-5 py-3 border-b ${divider} flex gap-2`}>
                <div className="relative flex-1">
                  <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none ${textMuted}`} />
                  <input
                    type="text"
                    value={memberSearch}
                    onChange={(e) => { setMemberSearch(e.target.value); setMemberPage(1); }}
                    placeholder="Search members…"
                    className={`w-full pl-8 pr-3 py-1.5 rounded-xl border text-xs outline-none transition-colors focus:border-[${accent}] ${
                      isDark ? "bg-white/5 border-white/10 text-white placeholder:text-white/30" : "bg-[#FBFADA]/70 border-[#ADBC9F] text-[#12372A] placeholder:text-[#436850]"
                    }`}
                  />
                </div>
                <select
                  value={memberSort}
                  onChange={(e) => { setMemberSort(e.target.value as typeof memberSort); setMemberPage(1); }}
                  className={`text-xs px-2 py-1.5 rounded-xl border outline-none cursor-pointer ${
                    isDark ? "bg-white/5 border-white/10 text-white/70" : "bg-[#FBFADA]/70 border-[#ADBC9F] text-[#436850]"
                  }`}
                >
                  <option value="role">By Role</option>
                  <option value="name">A → Z</option>
                  <option value="joined">Newest</option>
                </select>
              </div>
              {/* Member list */}
              <div className={`divide-y ${isDark ? "divide-white/5" : "divide-gray-100"}`}>
                {paginated.map((member) => (
                  <MemberRow key={member.userId} member={member} clubId={club.id} isDark={isDark} textMuted={textMuted} />
                ))}
                {paginated.length === 0 && (
                  <div className={`py-12 text-center text-sm ${textMuted}`}>
                    {memberSearch ? `No members match "${memberSearch}"` : "No members yet"}
                  </div>
                )}
              </div>
              {/* Pagination */}
              {totalPages > 1 && (
                <div className={`px-5 py-3 border-t ${divider} flex items-center justify-between`}>
                  <span className={`text-xs ${textMuted}`}>Page {memberPage} of {totalPages}</span>
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
          );
        })()}
        {/* ── Feed tab ──────────────────────────────────────────────────────── */}
        {activeTab === "feed" && (
          <div className="space-y-4 animate-in fade-in duration-200">
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



            {/* Club Description & Details (Feed tab only) */}
            {/* Description */}
            {/* Combined About & Details — consolidated into a single card */}
            <div className={`rounded-3xl border ${cardBorder} ${card} p-5 sm:p-6`}>
              <div className="flex items-center justify-between mb-3">
                <h2 className={`text-sm font-semibold uppercase tracking-wider ${isDark ? "text-white/40" : "text-[#436850]"}`}>
                  About
                </h2>
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
              {/* Inline details grid */}
              <div className={`grid grid-cols-2 gap-3 pt-3 border-t ${isDark ? "border-white/8" : "border-[#ADBC9F]/50"}`}>
                <div className="flex items-center gap-2">
                  <MapPin className={`w-3.5 h-3.5 flex-shrink-0 ${isDark ? "text-[#4CAF50]" : "text-[#436850]"}`} />
                  <span className={`text-xs ${isDark ? "text-white/70" : "text-[#12372A]/75"}`}>{flag} {club.location}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Hash className={`w-3.5 h-3.5 flex-shrink-0 ${isDark ? "text-[#4CAF50]" : "text-[#436850]"}`} />
                  <span className={`text-xs ${isDark ? "text-white/70" : "text-[#12372A]/75"}`}>{categoryLabel}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className={`w-3.5 h-3.5 flex-shrink-0 ${isDark ? "text-[#4CAF50]" : "text-[#436850]"}`} />
                  <span className={`text-xs ${isDark ? "text-white/70" : "text-[#12372A]/75"}`}>{formatDate(club.foundedAt)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Crown className={`w-3.5 h-3.5 flex-shrink-0 ${isDark ? "text-amber-400" : "text-amber-600"}`} />
                  <span className={`text-xs ${isDark ? "text-white/70" : "text-[#12372A]/75"}`}>{club.ownerName}</span>
                </div>
              </div>
            </div>

            {/* Social links + meeting schedule + contact */}
            {(club.website || club.discord || club.twitter || club.instagram || club.tiktok || club.youtube || club.linktree || club.meetingDay || club.contactEmail || club.contactPhone) && (
              <div className={`rounded-3xl border ${cardBorder} ${card} p-5 sm:p-6`}>
                <h2 className={`text-sm font-semibold uppercase tracking-wider mb-4 ${isDark ? "text-white/40" : "text-[#436850]"}`}>
                  Links & Info
                </h2>
                <div className="flex flex-col gap-1.5">
                  {club.website && (
                    <a href={club.website} target="_blank" rel="noopener noreferrer"
                      className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${isDark ? "hover:bg-white/5" : "hover:bg-[#FBFADA]"}`}>
                      <Globe className={`w-4 h-4 ${isDark ? "text-[#4CAF50]" : "text-[#436850]"}`} />
                      <span className={`text-sm font-medium ${isDark ? "text-white/80" : "text-[#12372A]/85"}`}>Website</span>
                      <ExternalLink className={`w-3 h-3 ml-auto ${textMuted}`} />
                    </a>
                  )}
                  {club.discord && (
                    <a href={club.discord} target="_blank" rel="noopener noreferrer"
                      className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${isDark ? "hover:bg-white/5" : "hover:bg-[#FBFADA]"}`}>
                      <MessageSquare className={`w-4 h-4 ${isDark ? "text-indigo-400" : "text-indigo-600"}`} />
                      <span className={`text-sm font-medium ${isDark ? "text-white/80" : "text-[#12372A]/85"}`}>Discord</span>
                      <ExternalLink className={`w-3 h-3 ml-auto ${textMuted}`} />
                    </a>
                  )}
                  {club.instagram && (
                    <a href={club.instagram.startsWith("http") ? club.instagram : `https://instagram.com/${club.instagram.replace("@", "")}`} target="_blank" rel="noopener noreferrer"
                      className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${isDark ? "hover:bg-white/5" : "hover:bg-[#FBFADA]"}`}>
                      <Camera className={`w-4 h-4 text-pink-500`} />
                      <span className={`text-sm font-medium ${isDark ? "text-white/80" : "text-[#12372A]/85"}`}>Instagram</span>
                      <ExternalLink className={`w-3 h-3 ml-auto ${textMuted}`} />
                    </a>
                  )}
                  {club.tiktok && (
                    <a href={club.tiktok.startsWith("http") ? club.tiktok : `https://tiktok.com/@${club.tiktok.replace("@", "")}`} target="_blank" rel="noopener noreferrer"
                      className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${isDark ? "hover:bg-white/5" : "hover:bg-[#FBFADA]"}`}>
                      <Video className={`w-4 h-4 ${isDark ? "text-white/70" : "text-[#12372A]/85"}`} />
                      <span className={`text-sm font-medium ${isDark ? "text-white/80" : "text-[#12372A]/85"}`}>TikTok</span>
                      <ExternalLink className={`w-3 h-3 ml-auto ${textMuted}`} />
                    </a>
                  )}
                  {club.youtube && (
                    <a href={club.youtube} target="_blank" rel="noopener noreferrer"
                      className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${isDark ? "hover:bg-white/5" : "hover:bg-[#FBFADA]"}`}>
                      <Play className={`w-4 h-4 text-red-500`} />
                      <span className={`text-sm font-medium ${isDark ? "text-white/80" : "text-[#12372A]/85"}`}>YouTube</span>
                      <ExternalLink className={`w-3 h-3 ml-auto ${textMuted}`} />
                    </a>
                  )}
                  {club.linktree && (
                    <a href={club.linktree} target="_blank" rel="noopener noreferrer"
                      className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${isDark ? "hover:bg-white/5" : "hover:bg-[#FBFADA]"}`}>
                      <Link2 className={`w-4 h-4 ${isDark ? "text-[#4CAF50]" : "text-[#436850]"}`} />
                      <span className={`text-sm font-medium ${isDark ? "text-white/80" : "text-[#12372A]/85"}`}>Linktree</span>
                      <ExternalLink className={`w-3 h-3 ml-auto ${textMuted}`} />
                    </a>
                  )}
                  {(club.meetingDay || club.meetingTime) && (
                    <div className={`flex items-start gap-3 p-3 rounded-xl ${isDark ? "bg-white/3" : "bg-[#FBFADA]/70"}`}>
                      <Clock className={`w-4 h-4 mt-0.5 flex-shrink-0 ${isDark ? "text-amber-400" : "text-amber-600"}`} />
                      <div>
                        <p className={`text-sm font-medium ${isDark ? "text-white/80" : "text-[#12372A]/85"}`}>
                          {[club.meetingDay, club.meetingTime].filter(Boolean).join(" · ")}
                        </p>
                        {club.meetingNotes && (
                          <p className={`text-xs mt-0.5 ${textMuted}`}>{club.meetingNotes}</p>
                        )}
                      </div>
                    </div>
                  )}
                  {club.contactEmail && (
                    <a href={`mailto:${club.contactEmail}`}
                      className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${isDark ? "hover:bg-white/5" : "hover:bg-[#FBFADA]"}`}>
                      <Mail className={`w-4 h-4 ${isDark ? "text-white/50" : "text-[#436850]"}`} />
                      <span className={`text-sm font-medium ${isDark ? "text-white/80" : "text-[#12372A]/85"}`}>{club.contactEmail}</span>
                    </a>
                  )}
                  {club.contactPhone && (
                    <a href={`tel:${club.contactPhone}`}
                      className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${isDark ? "hover:bg-white/5" : "hover:bg-[#FBFADA]"}`}>
                      <Phone className={`w-4 h-4 ${isDark ? "text-white/50" : "text-[#436850]"}`} />
                      <span className={`text-sm font-medium ${isDark ? "text-white/80" : "text-[#12372A]/85"}`}>{club.contactPhone}</span>
                    </a>
                  )}
                  {club.facebook && (
                    <a href={club.facebook.startsWith("http") ? club.facebook : `https://facebook.com/${club.facebook.replace("@", "")}`} target="_blank" rel="noopener noreferrer"
                      className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${isDark ? "hover:bg-white/5" : "hover:bg-[#FBFADA]"}`}>
                      <svg className="w-4 h-4 text-blue-500" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                      <span className={`text-sm font-medium ${isDark ? "text-white/80" : "text-[#12372A]/85"}`}>Facebook</span>
                      <ExternalLink className={`w-3 h-3 ml-auto ${textMuted}`} />
                    </a>
                  )}
                  {club.xUrl && (
                    <a href={club.xUrl.startsWith("http") ? club.xUrl : `https://x.com/${club.xUrl.replace("@", "")}`} target="_blank" rel="noopener noreferrer"
                      className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${isDark ? "hover:bg-white/5" : "hover:bg-[#FBFADA]"}`}>
                      <svg className={`w-4 h-4 ${isDark ? "text-white/70" : "text-[#12372A]/85"}`} viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.259 5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                      <span className={`text-sm font-medium ${isDark ? "text-white/80" : "text-[#12372A]/85"}`}>X / Twitter</span>
                      <ExternalLink className={`w-3 h-3 ml-auto ${textMuted}`} />
                    </a>
                  )}
                  {club.meetupUrl && (
                    <a href={club.meetupUrl} target="_blank" rel="noopener noreferrer"
                      className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${isDark ? "hover:bg-white/5" : "hover:bg-[#FBFADA]"}`}>
                      <MapPin className={`w-4 h-4 text-red-500`} />
                      <span className={`text-sm font-medium ${isDark ? "text-white/80" : "text-[#12372A]/85"}`}>Meetup</span>
                      <ExternalLink className={`w-3 h-3 ml-auto ${textMuted}`} />
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* What to Expect section */}
            {club.whatToExpect && (
              <div className={`rounded-3xl border ${cardBorder} ${card} p-5 sm:p-6`}>
                <h2 className={`text-sm font-semibold uppercase tracking-wider mb-3 ${isDark ? "text-white/40" : "text-[#436850]"}`}>
                  What to Expect
                </h2>
                <p className={`text-sm leading-relaxed ${isDark ? "text-white/75" : "text-[#12372A]/85"}`}>
                  {club.whatToExpect}
                </p>
              </div>
            )}


            {/* ── Announcement composer (owner/director only) ────────────────── */}
            {(isOwner || isDirector) && (
              <div className={`rounded-3xl border ${cardBorder} ${card} p-5`}>
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold ${
                    isDark ? "bg-[#4CAF50]/20 text-[#4CAF50]" : "bg-[#436850]/10 text-[#436850]"
                  }`}>
                    {user?.displayName?.charAt(0).toUpperCase() ?? "?"}
                  </div>
                  <div className="flex-1">
                    <textarea
                      value={announcementDraft}
                      onChange={(e) => setAnnouncementDraft(e.target.value)}
                      placeholder="Post an announcement to the club…"
                      rows={3}
                      maxLength={500}
                      className={`w-full rounded-2xl px-4 py-3 text-sm resize-none outline-none border transition-colors ${
                        isDark
                          ? "bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-[#4CAF50]/40"
                          : "bg-[#FBFADA]/70 border-[#ADBC9F] text-[#12372A] placeholder:text-[#436850] focus:border-[#436850]/40"
                      }`}
                    />
                    <div className="flex items-center justify-between mt-2">
                      <span className={`text-xs ${textMuted}`}>{announcementDraft.length}/500</span>
                      <button
                        onClick={handlePostAnnouncement}
                        disabled={!announcementDraft.trim() || postingAnnouncement}
                        className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-all disabled:opacity-40 ${
                          isDark
                            ? "bg-[#4CAF50] text-black hover:bg-[#66BB6A] disabled:hover:bg-[#4CAF50]"
                            : "bg-[#436850] text-white hover:bg-[#3a5230] disabled:hover:bg-[#436850]"
                        }`}
                      >
                        {postingAnnouncement ? "Posting…" : "Post"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

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
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 overflow-hidden ${
                          isDark ? "bg-[#4CAF50]/20 text-[#4CAF50]" : "bg-[#436850]/10 text-[#436850]"
                        }`}>
                          {m.avatarUrl ? (
                            <img src={m.avatarUrl} alt={m.displayName} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                          ) : (
                            (m.displayName?.charAt(0) ?? "?").toUpperCase()
                          )}
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

            {/* ── Share CTA — compact inline ─────────────────────────────── */}
            <div className={`rounded-2xl border ${cardBorder} ${card} px-5 py-3.5 flex items-center justify-between`}>
              <div className="flex items-center gap-3">
                <Share2 className={`w-4 h-4 ${isDark ? "text-[#4CAF50]" : "text-[#436850]"}`} />
                <span className={`text-sm font-medium ${textMain}`}>Share this club</span>
              </div>
              <button
                onClick={handleShare}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  isDark
                    ? "bg-[#4CAF50]/15 text-[#4CAF50] border border-[#4CAF50]/25 hover:bg-[#4CAF50]/25"
                    : "bg-[#436850]/10 text-[#436850] border border-[#436850]/20 hover:bg-[#436850]/20"
                }`}
              >
                Share
              </button>
            </div>

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
                      clubId={club.id}
                      isMemberUser={joined}
                      accentColor={accent}
                      onVoted={refreshFeed}
                      onRsvped={refreshFeed}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Events tab ──────────────────────────────────────────────────────────── */}
        {activeTab === "events" && (() => {
          const now = new Date();
          // Merge clubEvents and live tournaments into a unified list
          const allItems = [
            ...clubEvents.map((e) => ({ type: "event" as const, data: e, startAt: e.startAt })),
            ...liveTournaments.map((t) => ({ type: "tournament" as const, data: t, startAt: t.date || now.toISOString() })),
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
              <div className={`rounded-3xl border ${cardBorder} ${card} py-16 text-center`}>
                <Calendar className={`w-10 h-10 mx-auto mb-3 ${textMuted}`} />
                <p className={`text-sm font-semibold ${textMain} mb-1`}>No events yet</p>
                <p className={`text-xs ${textMuted}`}>Events and tournaments hosted by this club will appear here.</p>
                {(isOwner || isDirector) && (
                  <button
                    onClick={() => setShowCreateEvent(true)}
                    className={`mt-4 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
                      isDark ? "bg-white/10 text-white hover:bg-white/20" : "bg-[#ADBC9F]/40 text-[#12372A] hover:bg-[#ADBC9F]"
                    }`}
                  >
                    Create First Event
                  </button>
                )}
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
                          const myRsvp = (joined && user) ? getUserRSVP(ev.id, user.id) : null;
                          const _rsvpCount = countRSVPs(ev.id);
                          const goingRsvps = getEventRSVPs(ev.id).filter(r => r.status === "going");
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
                                <img src={ev.coverImageUrl} alt={ev.title} className="w-full h-full object-cover" />
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
                              {/* Footer: attendee avatars + RSVP button */}
                              <div className="flex items-center justify-between pt-1">
                                <div className="flex items-center gap-2">
                                  {goingRsvps.length > 0 && (
                                    <div className="flex items-center gap-1.5">
                                      <div className="flex -space-x-2">
                                        {goingRsvps.slice(0, 4).map((r) => (
                                          <div key={r.userId} className={`w-7 h-7 rounded-full overflow-hidden ring-2 ${isDark ? "ring-[#0d1f12]" : "ring-white"}`}>
                                            <PlayerAvatar username={r.displayName} name={r.displayName} avatarUrl={r.avatarUrl ?? undefined} size={28} className="w-full h-full object-cover" />
                                          </div>
                                        ))}
                                      </div>
                                      <span className={`text-xs font-medium ${textMuted}`}>
                                        {goingRsvps.length} going{goingRsvps.length > 4 ? ` (+${goingRsvps.length - 4})` : ""}
                                      </span>
                                    </div>
                                  )}
                                  {goingRsvps.length === 0 && (
                                    <span className={`text-xs ${textMuted} opacity-50`}>No RSVPs yet</span>
                                  )}
                                </div>
                                {joined && user ? (
                                  <button
                                    onClick={() => {
                                      const next = myRsvp?.status === "going" ? "not_going" : "going";
                                      upsertRSVP(ev.id, ev.clubId, user.id, user.displayName, next, user.avatarUrl ?? null);
                                    }}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-bold transition-all active:scale-95 ${
                                      myRsvp?.status === "going"
                                        ? isDark ? "text-black" : "text-white"
                                        : isDark ? "bg-white/8 text-white/70 hover:bg-white/15" : "bg-[#ADBC9F]/40 text-[#436850] hover:bg-[#ADBC9F]"
                                    }`}
                                    style={myRsvp?.status === "going" ? { background: evAccent } : {}}
                                  >
                                    {myRsvp?.status === "going" ? <><CheckCircle2 className="w-4 h-4" /> Going</> : "RSVP"}
                                    {myRsvp?.status === "going" && <ChevronRight className="w-3.5 h-3.5 opacity-60" />}
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => {}}
                                    className={`px-4 py-2 rounded-2xl text-sm font-bold transition-all ${
                                      isDark ? "bg-white/5 text-white/30 cursor-not-allowed" : "bg-[#FBFADA]/70 text-[#436850]/70 cursor-not-allowed"
                                    }`}
                                    disabled
                                  >
                                    Join club to RSVP
                                  </button>
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
                onClick={() => setShowCreateEvent(false)}
              >
                <div
                  className={`w-full max-w-sm rounded-3xl border ${cardBorder} ${card} p-6 shadow-2xl animate-in slide-in-from-bottom-4 duration-300`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between mb-5">
                    <h2 className={`text-base font-bold ${textMain}`} style={{ fontFamily: "'Clash Display', sans-serif" }}>New Event</h2>
                    <button onClick={() => setShowCreateEvent(false)} className={`p-1.5 rounded-xl transition-colors ${isDark ? "text-white/40 hover:text-white hover:bg-white/8" : "text-[#436850] hover:text-[#12372A] hover:bg-[#ADBC9F]/50"}`}>
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

        {/* ── Tournaments tab ─────────────────────────────────────────────────────── */}
        {/* Club owners should be able to populate new tournaments in the Club Tournaments tab page. Optimally implement while efficiently conserving tokens */}
        {activeTab === "tournaments" && (         <div className="space-y-4 animate-in fade-in duration-200">

            {/* ── Owner-only Host Tournament CTA ────────────────────────────── */}
            {/* TODO: Ensure tournament creation flow is optimized and user-friendly */}
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

            {/* Upcoming & Active — seed data */}
            {upcomingTournaments.filter((t) => tourneyFormatFilter === "all" || t.format === tourneyFormatFilter).length > 0 && (
              <div className={`rounded-3xl border ${cardBorder} ${card} overflow-hidden`}>
                <div className={`px-5 py-4 border-b ${divider}`}>
                  <h2 className={`text-sm font-semibold uppercase tracking-wider ${isDark ? "text-white/40" : "text-[#436850]"}`}>
                    Upcoming & Active
                  </h2>
                </div>
                <div className={`divide-y ${isDark ? "divide-white/5" : "divide-gray-100"}`}>
                  {upcomingTournaments.filter((t) => tourneyFormatFilter === "all" || t.format === tourneyFormatFilter).map((t) => (
                    <TournamentRow key={t.tournamentId} tournament={t} isDark={isDark} textMuted={textMuted} />
                  ))}
                </div>
              </div>
            )}

            {/* Live upcoming tournaments created via wizard */}
            {liveUpcoming.filter((t) => tourneyFormatFilter === "all" || t.format === tourneyFormatFilter).length > 0 && (
              <div className={`rounded-3xl border ${cardBorder} ${card} overflow-hidden`}>
                <div className={`px-5 py-4 border-b ${divider} flex items-center justify-between`}>
                  <h2 className={`text-sm font-semibold uppercase tracking-wider ${isDark ? "text-white/40" : "text-[#436850]"}`}>
                    Upcoming
                  </h2>
                  <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-green-500/15 text-green-600">
                    Live
                  </span>
                </div>
                <div className={`divide-y ${isDark ? "divide-white/5" : "divide-gray-100"}`}>
                  {liveUpcoming.filter((t) => tourneyFormatFilter === "all" || t.format === tourneyFormatFilter).map((t) => (
                    <a
                      key={t.id}
                      href={`/tournament/${t.id}`}
                      className={`flex items-center gap-4 px-5 py-4 transition-colors ${isDark ? "hover:bg-white/3" : "hover:bg-[#FBFADA]"}`}
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isDark ? "bg-green-500/15" : "bg-green-50"}`}>
                        <Zap className="w-4 h-4 text-green-500" strokeWidth={1.8} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold truncate ${textMain}`}>{t.name}</p>
                        <p className={`text-xs truncate ${textMuted}`}>
                          {t.venue || "Venue TBD"} &middot; {t.date ? new Date(t.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Date TBD"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${isDark ? "bg-white/8 text-white/60" : "bg-[#ADBC9F]/40 text-[#436850]"}`}>
                          {t.format === "swiss" ? "Swiss" : t.format === "roundrobin" ? "Round Robin" : "Elimination"}
                        </span>
                        <span className={`text-xs ${textMuted}`}>{t.rounds}R</span>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Past tournaments — seed data */}
            {completedTournaments.filter((t) => tourneyFormatFilter === "all" || t.format === tourneyFormatFilter).length > 0 && (
              <div className={`rounded-3xl border ${cardBorder} ${card} overflow-hidden`}>
                <div className={`px-5 py-4 border-b ${divider}`}>
                  <h2 className={`text-sm font-semibold uppercase tracking-wider ${isDark ? "text-white/40" : "text-[#436850]"}`}>
                    Past Tournaments
                  </h2>
                </div>
                <div className={`divide-y ${isDark ? "divide-white/5" : "divide-gray-100"}`}>
                  {completedTournaments.filter((t) => tourneyFormatFilter === "all" || t.format === tourneyFormatFilter).map((t) => (
                    <TournamentRow key={t.tournamentId} tournament={t} isDark={isDark} textMuted={textMuted} />
                  ))}
                </div>
              </div>
            )}

            {/* Live past tournaments created via wizard */}
            {livePast.filter((t) => tourneyFormatFilter === "all" || t.format === tourneyFormatFilter).length > 0 && (
              <div className={`rounded-3xl border ${cardBorder} ${card} overflow-hidden`}>
                <div className={`px-5 py-4 border-b ${divider}`}>
                  <h2 className={`text-sm font-semibold uppercase tracking-wider ${isDark ? "text-white/40" : "text-[#436850]"}`}>
                    Past Tournaments
                  </h2>
                </div>
                <div className={`divide-y ${isDark ? "divide-white/5" : "divide-gray-100"}`}>
                  {livePast.filter((t) => tourneyFormatFilter === "all" || t.format === tourneyFormatFilter).map((t) => (
                    <a
                      key={t.id}
                      href={`/tournament/${t.id}`}
                      className={`flex items-center gap-4 px-5 py-4 transition-colors ${isDark ? "hover:bg-white/3" : "hover:bg-[#FBFADA]"}`}
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isDark ? "bg-white/5" : "bg-[#FBFADA]/70"}`}>
                        <CheckCircle2 className={`w-4 h-4 ${textMuted}`} strokeWidth={1.8} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold truncate ${textMain}`}>{t.name}</p>
                        <p className={`text-xs truncate ${textMuted}`}>
                          {t.venue || "Venue TBD"} &middot; {t.date ? new Date(t.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Date TBD"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${isDark ? "bg-white/8 text-white/60" : "bg-[#ADBC9F]/40 text-[#436850]"}`}>
                          {t.format === "swiss" ? "Swiss" : t.format === "roundrobin" ? "Round Robin" : "Elimination"}
                        </span>
                        <span className={`text-xs ${textMuted}`}>{t.rounds}R</span>
                      </div>
                    </a>
                  ))}
                </div>
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
        {activeTab === "leagues" && (
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
                                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 overflow-hidden" style={{ background: sel ? "oklch(0.55 0.13 145)" : (isDark ? "rgba(255,255,255,0.1)" : "#e5e7eb") }}>
                                  {m.avatarUrl
                                    ? <img src={m.avatarUrl} alt="" className="w-8 h-8 object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                                    : <span style={{ color: sel ? "#fff" : (isDark ? "rgba(255,255,255,0.5)" : "#9ca3af") }}>{(m.displayName?.[0] ?? "?").toUpperCase()}</span>
                                  }
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
              <div className={`rounded-3xl border ${cardBorder} ${card} py-12 text-center px-6`}>
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 ${
                  isDark ? "bg-[#4CAF50]/10" : "bg-[#436850]/8"
                }`}>
                  <Award className={`w-7 h-7 ${isDark ? "text-[#4CAF50]" : "text-[#436850]"}`} />
                </div>
                <p className={`text-base font-bold ${textMain} mb-1`}>No Leagues Yet</p>
                {isOwner ? (
                  <>
                    <p className={`text-xs ${textMuted} mb-4 max-w-xs mx-auto`}>
                      Leagues are the best way to keep your members engaged week over week. Create a round-robin or Swiss league and let the standings speak.
                    </p>
                    <button
                      onClick={() => setShowCreateLeague(true)}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
                      style={{ background: "oklch(0.55 0.13 145)", color: "#fff" }}
                    >
                      <PlusCircle className="w-4 h-4" />
                      Create First League
                    </button>
                  </>
                ) : joined ? (
                  <>
                    <p className={`text-xs ${textMuted} mb-4 max-w-xs mx-auto`}>
                      This club hasn't started a league yet. Let the director know you're interested — it only takes a nudge!
                    </p>
                    <button
                      onClick={() => toast.success("Your interest has been noted! The club director will be notified.")}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
                      style={{ background: "oklch(0.55 0.13 145 / 0.12)", color: "oklch(0.55 0.13 145)" }}
                    >
                      <Bell className="w-4 h-4" />
                      Request a League
                    </button>
                  </>
                ) : (
                  <p className={`text-xs ${textMuted}`}>Join the club to participate in leagues when they start.</p>
                )}
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
                  {/* Active / Draft leagues */}
                  {activeLeagues.length > 0 && (
                    <div className={`rounded-3xl border ${cardBorder} ${card} overflow-hidden`}>
                      <div className={`divide-y ${isDark ? "divide-white/5" : "divide-gray-100"}`}>
                        {activeLeagues.map((lg) => <LeagueRow key={lg.id} lg={lg} />)}
                      </div>
                    </div>
                  )}
                  {/* Past Seasons */}
                  {completedLeagues.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 px-1 mb-2">
                        <span className={`text-xs font-semibold uppercase tracking-wide ${textMuted}`}>Past Seasons</span>
                        <span className={`text-xs ${textMuted} opacity-50`}>· {completedLeagues.length}</span>
                      </div>
                      <div className={`rounded-3xl border ${cardBorder} ${card} overflow-hidden`}>
                        <div className={`divide-y ${isDark ? "divide-white/5" : "divide-gray-100"}`}>
                          {completedLeagues.map((lg) => <LeagueRow key={lg.id} lg={lg} />)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}
              </div>{/* close max-w-6xl */}
            </div>{/* close px wrapper */}
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
            // Post a feed event if a new tournament was actually created
            if (createdTournamentId && createdTournamentName) {
              recordTournamentCreated(
                club.id,
                user?.displayName ?? club.ownerName,
                createdTournamentName,
                createdTournamentId
              );
              setFeedEvents(listFeedEvents(club.id));
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
          onClick={() => setShowSettings(false)}
        >
          <div
            className={`w-full max-w-sm rounded-3xl border ${cardBorder} ${card} p-6 shadow-2xl animate-in slide-in-from-bottom-4 duration-300`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <h2
                className={`text-base font-bold ${textMain}`}
                style={{ fontFamily: "'Clash Display', sans-serif" }}
              >
                Club Settings
              </h2>
              <button
                onClick={() => setShowSettings(false)}
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

      {/* Edit Club Details Modal */}
      {club && (
        <EditClubDetailsModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          clubId={club.id}
          currentDescription={club.description}
          currentLocation={club.location}
          onSave={async (description, location) => {
            try {
              const updated = await updateClub(club.id, { description, location });
              if (updated) {
                setClub(updated);
                toast.success("Club details updated successfully");
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
          <div className={`w-full max-w-md rounded-2xl shadow-2xl p-6 ${ isDark ? "bg-[oklch(0.17_0.05_145)]" : "bg-[#F0F5E8]" }`}>
            <div className="flex items-center justify-between mb-5">
              <h2 className={`text-lg font-bold ${textMain}`}>Edit Event</h2>
              <button onClick={() => setEditingEvent(null)} className={`p-1.5 rounded-lg ${isDark ? "hover:bg-white/8 text-white/50" : "hover:bg-[#ADBC9F]/50 text-[#436850]"}`}>
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
          <div className={`w-full max-w-sm rounded-2xl shadow-2xl p-6 ${ isDark ? "bg-[oklch(0.17_0.05_145)]" : "bg-[#F0F5E8]" }`}>
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${ isDark ? "bg-red-500/15" : "bg-red-50" }`}>
                <Trash2 className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h2 className={`text-base font-bold ${textMain}`}>Delete Event</h2>
                <p className={`text-xs ${textMuted}`}>This action cannot be undone.</p>
              </div>
            </div>
            <p className={`text-sm ${textMuted} mb-6`}>Are you sure you want to delete this event? All RSVPs and comments will also be removed.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDeleteId(null)}
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
          className="lg:hidden fixed bottom-[62px] left-0 right-0 z-30 px-4 py-2"
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

      <div
        className="lg:hidden fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around px-2 py-2"
        style={{
          background: isDark ? "oklch(0.17 0.05 145 / 0.97)" : "rgba(15,31,20,0.97)",
          backdropFilter: "blur(12px)",
          borderTop: `1px solid ${isDark ? "oklch(0.22 0.06 145)" : "oklch(0.25 0.08 145)"}`,
        }}
      >
        {(["feed", "events", "members", "tournaments", "leagues"] as const).map((t) => {
          const iconMap: Record<string, React.ReactNode> = {
            feed: <Megaphone size={18} />,
            events: <Calendar size={18} />,
            members: <Users size={18} />,
            tournaments: <Trophy size={18} />,
            about: <Globe size={18} />,
            leagues: <Award size={18} />,
          };
          const isActive = activeTab === t;
          return (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className="flex flex-col items-center gap-0.5 px-3 rounded-xl relative"
              style={{ color: isActive ? accent : "oklch(0.55 0.08 145)", minHeight: "44px", paddingTop: "6px", paddingBottom: "6px" }}
            >
              {iconMap[t]}
              <span className="text-[11px] font-medium">{t.charAt(0).toUpperCase() + t.slice(1)}</span>
            </button>
          );
        })}
      </div>
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
