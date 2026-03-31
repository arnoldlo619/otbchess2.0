/**
 * ClubProfile page — /clubs/:id
 *
 * Full club profile with:
 *   - Hero banner with club identity, stats, and join/leave CTA
 *   - About section with description and social links
 *   - Members roster with roles and stats
 *   - Tournament history with status badges
 */
import { useState, useEffect, useCallback } from "react";
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
  type Club,
  type ClubMember,
  type ClubTournament,
} from "@/lib/clubRegistry";
import { apiJoinClub, apiLeaveClub } from "@/lib/clubsApi";
import { useClubPresence } from "@/hooks/useClubPresence";
import { ClubAvatarUpload } from "@/components/ClubAvatarUpload";
import { ClubBannerUpload } from "@/components/ClubBannerUpload";
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
  getUserRSVP,
  upsertRSVP,
  type ClubEvent,
  type RSVPStatus,
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
} from "lucide-react";
import { toast } from "sonner";
import AuthModal from "@/components/AuthModal";

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
      isDark ? "bg-white/8 text-white/40" : "bg-gray-100 text-gray-400"
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
      <div className={`${isDark ? "text-[#4CAF50]" : "text-[#3D6B47]"}`}>{icon}</div>
      <span
        className={`text-xl font-bold leading-none ${isDark ? "text-white" : "text-gray-900"}`}
        style={{ fontFamily: "'Clash Display', sans-serif" }}
      >
        {value}
      </span>
      <span className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? "text-white/40" : "text-gray-400"}`}>
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
    accent: "text-[#3D6B47] bg-[#3D6B47]/10",
    darkAccent: "text-[#4CAF50] bg-[#4CAF50]/15",
  },
  member_leave: {
    icon: <UserMinus className="w-4 h-4" />,
    accent: "text-gray-500 bg-gray-100",
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
    accent: "text-[#3D6B47] bg-[#3D6B47]/10",
    darkAccent: "text-[#4CAF50] bg-[#4CAF50]/15",
  },
  poll: {
    icon: <BarChart2 className="w-4 h-4" />,
    accent: "text-[#3D6B47] bg-[#3D6B47]/10",
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
  const accent = isDark ? "#4CAF50" : "#3D6B47";

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
                event.type === "announcement" ? (isDark ? "text-white/70" : "text-gray-600") : textMuted
              }`}>{event.detail}</p>
            )}
            <div className="flex items-center gap-3 mt-1.5">
              <span className={`text-xs ${textMuted}`}>{relativeTime(event.createdAt)}</span>
              {event.linkHref && (
                <a href={event.linkHref} className={`text-xs font-semibold transition-colors ${
                  isDark ? "text-[#4CAF50] hover:text-[#66BB6A]" : "text-[#3D6B47] hover:text-[#2d5236]"
                }`}>{event.linkLabel ?? "View"} &rarr;</a>
              )}
            </div>
          </div>
          {canDelete && (
            <button
              onClick={() => onDelete(event.id)}
              className={`opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg ${
                isDark ? "hover:bg-white/8 text-white/30 hover:text-white/60" : "hover:bg-gray-100 text-gray-300 hover:text-gray-500"
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
                isDark ? "hover:bg-white/8 text-white/30 hover:text-white/60" : "hover:bg-gray-100 text-gray-300 hover:text-gray-500"
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
                    voted ? "border-[#4CAF50]/50" : isDark ? "border-white/10 hover:border-white/25" : "border-gray-200 hover:border-gray-300"
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
                        voted ? "border-[#4CAF50] bg-[#4CAF50]" : isDark ? "border-white/30" : "border-gray-300"
                      }`}>
                        {voted && <CheckCircle2 className="w-2.5 h-2.5 text-white" />}
                      </div>
                      <span className={`text-sm font-medium ${voted ? (isDark ? "text-white" : "text-gray-900") : textMuted}`}>{opt.text}</span>
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
                isDark ? "hover:bg-white/8 text-white/30 hover:text-white/60" : "hover:bg-gray-100 text-gray-300 hover:text-gray-500"
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
                isDark ? "hover:bg-white/8 text-white/30 hover:text-white/60" : "hover:bg-gray-100 text-gray-300 hover:text-gray-500"
              }`}><Trash2 className="w-3.5 h-3.5" /></button>
            )}
          </div>
          <div className={`rounded-xl p-3 border ${ isDark ? "border-white/08 bg-white/4" : "border-gray-100 bg-gray-50" }`}>
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
                      ? s === "going" ? "bg-[#4CAF50] text-white" : s === "maybe" ? "bg-amber-500 text-white" : isDark ? "bg-white/15 text-white/60" : "bg-gray-200 text-gray-500"
                      : isDark ? "bg-white/07 text-white/50 hover:bg-white/12 hover:text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700"
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
                        <div className={`w-6 h-6 rounded-full border flex items-center justify-center text-[9px] font-bold ${ isDark ? "border-white/10 text-white/50 bg-white/08" : "border-gray-200 text-gray-400 bg-gray-100" }`}>
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
    const valid = ["about", "events", "members", "tournaments", "feed", "leagues"] as const;
    return (valid as readonly string[]).includes(t ?? "") ? (t as typeof valid[number]) : "feed";
  })();

  const [club, setClub] = useState<Club | null>(null);
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [tournaments, setTournaments] = useState<ClubTournament[]>([]);
  const [joined, setJoined] = useState(false);
  const [activeTab, setActiveTab] = useState<"about" | "events" | "members" | "tournaments" | "feed" | "leagues">(initialTab);
  const [clubLeagues, setClubLeagues] = useState<Array<{ id: string; name: string; status: string; currentWeek: number; totalWeeks: number; playerCount: number; maxPlayers?: number }>>([]);
  const [leaguesLoading, setLeaguesLoading] = useState(false);
  const [showCreateLeague, setShowCreateLeague] = useState(false);
  const [leagueForm, setLeagueForm] = useState({ name: "", description: "", maxPlayers: 8, totalWeeks: 7 });
  const [leagueWizardStep, setLeagueWizardStep] = useState<1 | 2>(1);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [creatingLeague, setCreatingLeague] = useState(false);
  const [joining, setJoining] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  // Track which draft leagues the current user has already requested to join
  const [requestedLeagueIds, setRequestedLeagueIds] = useState<Set<string>>(new Set());
  const [requestingLeagueId, setRequestingLeagueId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [pendingAvatar, setPendingAvatar] = useState<string | null | undefined>(undefined);
  const [pendingBanner, setPendingBanner] = useState<string | null | undefined>(undefined);
  const [savingSettings, setSavingSettings] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [liveTournaments, setLiveTournaments] = useState<TournamentConfig[]>([]);
  const [feedEvents, setFeedEvents] = useState<FeedEvent[]>([]);
  const [announcementDraft, setAnnouncementDraft] = useState("");
  const [postingAnnouncement, setPostingAnnouncement] = useState(false);
  const [following, setFollowing] = useState(false);
  const [followingLoading, setFollowingLoading] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [clubEvents, setClubEvents] = useState<ClubEvent[]>([]);

  // Seed and load
  useEffect(() => {
    seedClubsIfEmpty();
    const id = params.id;

    const loadClubData = (found: Club) => {
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

  if (!club) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center gap-6 ${isDark ? "bg-[#0d1a0f]" : "bg-[#F0F5EE]"}`}>
        <NavLogo />
        <p className={`text-lg font-semibold ${isDark ? "text-white/60" : "text-gray-500"}`}>
          Club not found
        </p>
        <Link href="/clubs" className="text-sm text-[#4CAF50] underline underline-offset-2">
          Browse all clubs
        </Link>
      </div>
    );
  }

  // Membership flags (aliases of the pre-return derivations for readability below)
  const myMembership = myMembershipEarly;
  const isOwner = isOwnerEarly;
  const isDirector = isDirectorEarly;
  // onlineCount already declared above (before the early return)

  const handleJoin = async () => {
    if (!user) {
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
    // Always use the canonical chessotb.club domain with the slug for share links
    const url = `https://chessotb.club/clubs/${club.slug || club.id}`;
    if (navigator.share) {
      navigator.share({ title: club.name, text: club.tagline, url });
    } else {
      navigator.clipboard.writeText(url).then(() => toast.success("Link copied!"));
    }
  };

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
  const bg = isDark ? "bg-[#0d1a0f]" : "bg-[#F0F5EE]";
  const card = isDark ? "bg-[#1a2e1d]" : "bg-white";
  const cardBorder = isDark ? "border-white/8" : "border-gray-100";
  const textMain = isDark ? "text-white" : "text-gray-900";
  const textMuted = isDark ? "text-white/50" : "text-gray-400";
  const divider = isDark ? "border-white/8" : "border-gray-100";
  const tabActive = isDark ? "bg-[#4CAF50]/15 text-[#4CAF50]" : "bg-[#3D6B47]/10 text-[#3D6B47]";
  const tabInactive = isDark ? "text-white/50 hover:text-white/80" : "text-gray-400 hover:text-gray-700";

  return (
    <div className={`min-h-screen ${bg}`}>

      {/* ── Sticky top nav ─────────────────────────────────────────────────── */}
      <header className={`sticky top-0 z-30 border-b ${divider} ${isDark ? "bg-[#0d1a0f]/90" : "bg-white/90"} backdrop-blur-md`}>
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-3">
          <button
            onClick={() => navigate("/clubs")}
            className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${isDark ? "text-white/60 hover:text-white" : "text-gray-400 hover:text-gray-900"}`}
          >
            <ChevronLeft className="w-4 h-4" />
            My Clubs
          </button>
          <div className={`w-px h-4 ${isDark ? "bg-white/15" : "bg-gray-200"}`} />
          <NavLogo className="h-7" />
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={handleShare}
              className={`p-2 rounded-xl transition-colors ${isDark ? "text-white/50 hover:text-white hover:bg-white/8" : "text-gray-400 hover:text-gray-900 hover:bg-gray-100"}`}
            >
              <Share2 className="w-4 h-4" />
            </button>
            {(isOwner || isDirector) && (
              <button
                className={`p-2 rounded-xl transition-colors ${isDark ? "text-white/50 hover:text-white hover:bg-white/8" : "text-gray-400 hover:text-gray-900 hover:bg-gray-100"}`}
                onClick={() => { setPendingAvatar(undefined); setShowSettings(true); }}
                aria-label="Club settings"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── Hero banner ─────────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden">
        {/* Full-bleed per-category gradient banner */}
        <div className={`h-52 sm:h-64 w-full relative bg-gradient-to-br ${bannerTheme.grad}`}>
          {/* Noise texture overlay */}
          <div
            className={`absolute inset-0 pointer-events-none ${isDark ? "opacity-[0.05]" : "opacity-[0.07]"}`}
            style={{ backgroundImage: NOISE_BG, backgroundSize: "150px" }}
          />
          {/* Radial glow from top-center */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: isDark
                ? "radial-gradient(ellipse at 50% 0%, rgba(255,255,255,0.08) 0%, transparent 65%)"
                : "radial-gradient(ellipse at 50% 0%, rgba(255,255,255,0.45) 0%, transparent 65%)",
            }}
          />
          {/* Custom banner overlay (if set) */}
          {club.bannerUrl && (
            <img
              src={club.bannerUrl}
              alt=""
              className="absolute inset-0 w-full h-full object-cover opacity-20"
            />
          )}
          {/* Category badge — top-left */}
          <div className="absolute top-4 left-4 z-10">
            <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border backdrop-blur-sm ${bannerTheme.badge}`}>
              {categoryLabel}
            </span>
          </div>
          {/* Gradient fade to page background below */}
          <div
            className="absolute inset-0"
            style={{ background: `linear-gradient(to bottom, transparent 40%, ${isDark ? "#0d1a0f" : "#F0F5EE"} 100%)` }}
          />
        </div>

        {/* Club identity card — overlaps banner */}
        <div className="max-w-4xl mx-auto px-4">
          <div className={`relative -mt-20 rounded-3xl border ${cardBorder} ${card} p-5 sm:p-6 shadow-2xl`}>
            <div className="flex items-start gap-4">
              {/* Club avatar with ring */}
              <div
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl flex-shrink-0 flex items-center justify-center text-3xl sm:text-4xl shadow-lg ring-2 ring-white/20 overflow-hidden"
                style={{ background: `linear-gradient(135deg, ${club.accentColor} 0%, ${club.accentColor}88 100%)` }}
              >
                {club.avatarUrl ? (
                  <img src={club.avatarUrl} alt={club.name} className="w-full h-full object-cover" />
                ) : (
                  <span>{flag}</span>
                )}
              </div>

              {/* Name + meta */}
              <div className="flex-1 min-w-0 pt-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1
                    className={`text-xl sm:text-2xl font-bold leading-tight ${textMain}`}
                    style={{ fontFamily: "'Clash Display', sans-serif" }}
                  >
                    {club.name}
                  </h1>
                  {club.isPublic && (
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${isDark ? "bg-white/8 text-white/40" : "bg-gray-100 text-gray-400"}`}>
                      Public
                    </span>
                  )}
                </div>
                <p className={`text-sm mt-1 leading-snug ${textMuted}`}>{club.tagline}</p>
                <div className={`flex items-center gap-3 mt-2 flex-wrap text-xs ${textMuted}`}>
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {club.location}
                  </span>
                  <span className="flex items-center gap-1">
                    <Hash className="w-3 h-3" />
                    {categoryLabel}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Est. {formatYear(club.foundedAt)}
                  </span>
                </div>
              </div>
            </div>

            {/* Stats row */}
            <div className="flex gap-3 mt-5 overflow-x-auto pb-1 scrollbar-hide">
              <StatPill icon={<Users className="w-4 h-4" />} value={club.memberCount} label="Members" isDark={isDark} />
              {/* Members Online indicator — green pulse dot + live count */}
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 ${
                isDark ? "bg-white/8 text-white/80" : "bg-black/5 text-gray-700"
              }`}>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span>{onlineCount} Online</span>
              </div>
              <StatPill icon={<Bell className="w-4 h-4" />} value={followerCount} label="Followers" isDark={isDark} />
              <StatPill icon={<Trophy className="w-4 h-4" />} value={club.tournamentCount} label="Tournaments" isDark={isDark} />
              <StatPill icon={<CheckCircle2 className="w-4 h-4" />} value={completedTournaments.length} label="Completed" isDark={isDark} />
              <StatPill icon={<Zap className="w-4 h-4" />} value={upcomingTournaments.length} label="Upcoming" isDark={isDark} />
            </div>

            {/* Join / Leave CTA + Owner Start Tournament */}
            <div className="mt-5 flex items-center gap-3 flex-wrap">
              {isOwner && (
                <button
                  onClick={() => setShowWizard(true)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-[#3D6B47] text-white hover:bg-[#2d5236] active:scale-95 transition-all shadow-md shadow-[#3D6B47]/30"
                >
                  <Trophy className="w-4 h-4" />
                  Start Tournament
                </button>
              )}
              {!user ? (
                <button
                  onClick={() => setAuthOpen(true)}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-[#3D6B47] text-white hover:bg-[#2d5236] transition-colors"
                >
                  <UserPlus className="w-4 h-4" />
                  Join Club
                </button>
              ) : isOwner ? (
                <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold ${isDark ? "bg-amber-500/15 text-amber-400" : "bg-amber-50 text-amber-600"}`}>
                  <Crown className="w-4 h-4" />
                  You own this club
                </div>
              ) : joined ? (
                <button
                  onClick={handleLeave}
                  disabled={joining}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                    isDark
                      ? "bg-white/8 text-white/70 hover:bg-red-500/15 hover:text-red-400"
                      : "bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-500"
                  }`}
                >
                  {joining ? (
                    <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                  ) : (
                    <UserMinus className="w-4 h-4" />
                  )}
                  Leave Club
                </button>
              ) : (
                <button
                  onClick={handleJoin}
                  disabled={joining}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-[#3D6B47] text-white hover:bg-[#2d5236] transition-colors disabled:opacity-60"
                >
                  {joining ? (
                    <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  ) : (
                    <UserPlus className="w-4 h-4" />
                  )}
                  Join Club
                </button>
              )}
              {joined && !isOwner && (
                <span className={`text-xs font-medium ${isDark ? "text-[#4CAF50]" : "text-[#3D6B47]"}`}>
                  ✓ Member
                </span>
              )}
              {/* Following button — shown for non-members (or logged-out users) */}
              {!joined && !isOwner && (
                <button
                  onClick={handleFollow}
                  disabled={followingLoading}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all active:scale-95 disabled:opacity-60 ${
                    following
                      ? isDark
                        ? "bg-[#4CAF50]/15 border-[#4CAF50]/30 text-[#4CAF50] hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400"
                        : "bg-[#3D6B47]/10 border-[#3D6B47]/30 text-[#3D6B47] hover:bg-red-50 hover:border-red-200 hover:text-red-500"
                      : isDark
                        ? "bg-white/6 border-white/15 text-white/70 hover:bg-white/10 hover:text-white"
                        : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                >
                  {followingLoading ? (
                    <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                  ) : following ? (
                    <BellOff className="w-4 h-4" />
                  ) : (
                    <Bell className="w-4 h-4" />
                  )}
                  {following ? "Following" : "Follow"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Announcement banner ─────────────────────────────────────────────── */}
      {club.announcement && (
        <div className="max-w-4xl mx-auto px-4 mt-4">
          <div className={`flex items-start gap-3 p-4 rounded-2xl border ${
            isDark ? "bg-amber-500/8 border-amber-500/20" : "bg-amber-50 border-amber-200"
          }`}>
            <Megaphone className={`w-4 h-4 mt-0.5 flex-shrink-0 ${isDark ? "text-amber-400" : "text-amber-600"}`} />
            <p className={`text-sm leading-relaxed ${isDark ? "text-amber-300" : "text-amber-700"}`}>
              {club.announcement}
            </p>
          </div>
        </div>
      )}

      {/* ── Tab navigation ──────────────────────────────────────────────────── */}
      <div className="max-w-4xl mx-auto px-4 mt-6">
        {/* On mobile: horizontally scrollable; on md+: flex with equal-width tabs */}
        <div
          className={`flex gap-1 p-1 rounded-2xl overflow-x-auto scrollbar-none ${isDark ? "bg-white/5" : "bg-black/5"}`}
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {(["feed", "events", "members", "tournaments", "about", "leagues"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-shrink-0 md:flex-1 py-2.5 px-3 rounded-xl text-sm font-semibold capitalize transition-all whitespace-nowrap ${
                activeTab === tab ? tabActive : tabInactive
              }`}
            >
              {tab}
              {tab === "events" && clubEvents.length > 0 && (
                <span className={`ml-1.5 text-xs ${activeTab === tab ? "opacity-70" : "opacity-40"}`}>
                  {clubEvents.length}
                </span>
              )}
              {tab === "members" && (
                <span className={`ml-1.5 text-xs ${activeTab === tab ? "opacity-70" : "opacity-40"}`}>
                  {club.memberCount}
                </span>
              )}
              {tab === "feed" && feedEvents.length > 0 && (
                <span className={`ml-1.5 text-xs ${activeTab === tab ? "opacity-70" : "opacity-40"}`}>
                  {feedEvents.length}
                </span>
              )}
              {tab === "tournaments" && (
                <span className={`ml-1.5 text-xs ${activeTab === tab ? "opacity-70" : "opacity-40"}`}>
                  {tournaments.length + liveTournaments.length}
                </span>
              )}
              {tab === "leagues" && clubLeagues.length > 0 && (
                <span className={`ml-1.5 text-xs ${activeTab === tab ? "opacity-70" : "opacity-40"}`}>
                  {clubLeagues.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab content ─────────────────────────────────────────────────────── */}
      <div className="max-w-4xl mx-auto px-4 mt-4 pb-24">

        {/* ── About tab ───────────────────────────────────────────────────── */}
        {activeTab === "about" && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Description */}
            <div className={`rounded-3xl border ${cardBorder} ${card} p-5 sm:p-6`}>
              <h2 className={`text-sm font-semibold uppercase tracking-wider mb-3 ${isDark ? "text-white/40" : "text-gray-400"}`}>
                About
              </h2>
              <p className={`text-sm leading-relaxed ${isDark ? "text-white/80" : "text-gray-700"}`}>
                {club.description}
              </p>
            </div>

            {/* Details grid */}
            <div className={`rounded-3xl border ${cardBorder} ${card} p-5 sm:p-6`}>
              <h2 className={`text-sm font-semibold uppercase tracking-wider mb-4 ${isDark ? "text-white/40" : "text-gray-400"}`}>
                Details
              </h2>
              <div className="space-y-3">
                <DetailRow icon={<MapPin className="w-4 h-4" />} label="Location" value={`${flag} ${club.location}`} isDark={isDark} />
                <DetailRow icon={<Hash className="w-4 h-4" />} label="Type" value={categoryLabel} isDark={isDark} />
                <DetailRow icon={<Calendar className="w-4 h-4" />} label="Founded" value={formatDate(club.foundedAt)} isDark={isDark} />
                <DetailRow icon={<Crown className="w-4 h-4" />} label="Director" value={club.ownerName} isDark={isDark} />
              </div>
            </div>

            {/* Social links */}
            {(club.website || club.discord || club.twitter) && (
              <div className={`rounded-3xl border ${cardBorder} ${card} p-5 sm:p-6`}>
                <h2 className={`text-sm font-semibold uppercase tracking-wider mb-4 ${isDark ? "text-white/40" : "text-gray-400"}`}>
                  Links
                </h2>
                <div className="flex flex-col gap-2">
                  {club.website && (
                    <a
                      href={club.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${isDark ? "hover:bg-white/5" : "hover:bg-gray-50"}`}
                    >
                      <Globe className={`w-4 h-4 ${isDark ? "text-[#4CAF50]" : "text-[#3D6B47]"}`} />
                      <span className={`text-sm font-medium ${isDark ? "text-white/80" : "text-gray-700"}`}>Website</span>
                      <ExternalLink className={`w-3 h-3 ml-auto ${textMuted}`} />
                    </a>
                  )}
                  {club.discord && (
                    <a
                      href={club.discord}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${isDark ? "hover:bg-white/5" : "hover:bg-gray-50"}`}
                    >
                      <MessageSquare className={`w-4 h-4 ${isDark ? "text-indigo-400" : "text-indigo-600"}`} />
                      <span className={`text-sm font-medium ${isDark ? "text-white/80" : "text-gray-700"}`}>Discord</span>
                      <ExternalLink className={`w-3 h-3 ml-auto ${textMuted}`} />
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Members tab ─────────────────────────────────────────────────── */}
        {activeTab === "members" && (
          <div className={`rounded-3xl border ${cardBorder} ${card} overflow-hidden animate-in fade-in duration-200`}>
            <div className={`px-5 py-4 border-b ${divider} flex items-center justify-between`}>
              <h2 className={`text-sm font-semibold uppercase tracking-wider ${isDark ? "text-white/40" : "text-gray-400"}`}>
                Members
              </h2>
              <span className={`text-xs font-medium ${textMuted}`}>{club.memberCount} total</span>
            </div>
            <div className={`divide-y ${isDark ? "divide-white/5" : "divide-gray-100"}`}>
              {members.map((member) => (
                <MemberRow key={member.userId} member={member} clubId={club.id} isDark={isDark} textMuted={textMuted} />
              ))}
              {members.length === 0 && (
                <div className={`py-12 text-center text-sm ${textMuted}`}>No members yet</div>
              )}
            </div>
          </div>
        )}
        {/* ── Feed tab ──────────────────────────────────────────────────────── */}
        {activeTab === "feed" && (
          <div className="space-y-4 animate-in fade-in duration-200">

            {/* ── Announcement composer (owner/director only) ────────────────── */}
            {(isOwner || isDirector) && (
              <div className={`rounded-3xl border ${cardBorder} ${card} p-5`}>
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold ${
                    isDark ? "bg-[#4CAF50]/20 text-[#4CAF50]" : "bg-[#3D6B47]/10 text-[#3D6B47]"
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
                          : "bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-[#3D6B47]/40"
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
                            : "bg-[#3D6B47] text-white hover:bg-[#2d5236] disabled:hover:bg-[#3D6B47]"
                        }`}
                      >
                        {postingAnnouncement ? "Posting…" : "Post"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Feed event list ────────────────────────────────────────────── */}
            {feedEvents.length === 0 ? (
              <div className={`rounded-3xl border ${cardBorder} ${card} py-16 text-center`}>
                <Rss className={`w-10 h-10 mx-auto mb-3 ${textMuted}`} />
                <p className={`text-sm font-semibold ${textMain} mb-1`}>No activity yet</p>
                <p className={`text-xs ${textMuted}`}>Club events will appear here.</p>
              </div>
            ) : (
              <div className={`rounded-3xl border ${cardBorder} ${card} overflow-hidden`}>
                <div className={`px-5 py-4 border-b ${divider}`}>
                  <h2 className={`text-sm font-semibold uppercase tracking-wider ${isDark ? "text-white/40" : "text-gray-400"}`}>
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
                      onVoted={refreshFeed}
                      onRsvped={refreshFeed}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Tournaments tab ────────────────────────────────────────────────── */}
        {activeTab === "tournaments" && (
          <div className="space-y-4 animate-in fade-in duration-200">

            {/* ── Owner-only Host Tournament CTA ────────────────────────────── */}
            {isOwner ? (
              <button
                onClick={() => setShowWizard(true)}
                className="w-full flex items-center justify-center gap-2 py-3 px-5 rounded-2xl border-2 border-dashed border-[#3D6B47]/40 text-sm font-semibold transition-all hover:border-[#3D6B47] hover:bg-[#3D6B47]/8 group"
              >
                <PlusCircle className={`w-4 h-4 transition-colors ${isDark ? "text-[#4CAF50] group-hover:text-[#66BB6A]" : "text-[#3D6B47] group-hover:text-[#2d5236]"}`} />
                <span className={isDark ? "text-[#4CAF50] group-hover:text-[#66BB6A]" : "text-[#3D6B47] group-hover:text-[#2d5236]"}>
                  Host a Tournament for {club.name}
                </span>
              </button>
            ) : user && joined ? (
              /* Member / Director — locked, informational only */
              <div
                className={`w-full flex items-center gap-3 py-3 px-5 rounded-2xl border ${cardBorder} ${isDark ? "bg-white/2" : "bg-gray-50"} cursor-not-allowed`}
                title="Only the club owner can create tournaments"
              >
                <Lock className={`w-4 h-4 flex-shrink-0 ${textMuted}`} />
                <span className={`text-sm ${textMuted}`}>
                  Only the club owner can host tournaments here.
                </span>
              </div>
            ) : null}

            {/* Upcoming & Active — seed data */}
            {upcomingTournaments.length > 0 && (
              <div className={`rounded-3xl border ${cardBorder} ${card} overflow-hidden`}>
                <div className={`px-5 py-4 border-b ${divider}`}>
                  <h2 className={`text-sm font-semibold uppercase tracking-wider ${isDark ? "text-white/40" : "text-gray-400"}`}>
                    Upcoming & Active
                  </h2>
                </div>
                <div className={`divide-y ${isDark ? "divide-white/5" : "divide-gray-100"}`}>
                  {upcomingTournaments.map((t) => (
                    <TournamentRow key={t.tournamentId} tournament={t} isDark={isDark} textMuted={textMuted} />
                  ))}
                </div>
              </div>
            )}

            {/* Live upcoming tournaments created via wizard */}
            {liveUpcoming.length > 0 && (
              <div className={`rounded-3xl border ${cardBorder} ${card} overflow-hidden`}>
                <div className={`px-5 py-4 border-b ${divider} flex items-center justify-between`}>
                  <h2 className={`text-sm font-semibold uppercase tracking-wider ${isDark ? "text-white/40" : "text-gray-400"}`}>
                    Upcoming
                  </h2>
                  <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-green-500/15 text-green-600">
                    Live
                  </span>
                </div>
                <div className={`divide-y ${isDark ? "divide-white/5" : "divide-gray-100"}`}>
                  {liveUpcoming.map((t) => (
                    <a
                      key={t.id}
                      href={`/tournament/${t.id}`}
                      className={`flex items-center gap-4 px-5 py-4 transition-colors ${isDark ? "hover:bg-white/3" : "hover:bg-gray-50"}`}
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
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${isDark ? "bg-white/8 text-white/60" : "bg-gray-100 text-gray-500"}`}>
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
            {completedTournaments.length > 0 && (
              <div className={`rounded-3xl border ${cardBorder} ${card} overflow-hidden`}>
                <div className={`px-5 py-4 border-b ${divider}`}>
                  <h2 className={`text-sm font-semibold uppercase tracking-wider ${isDark ? "text-white/40" : "text-gray-400"}`}>
                    Past Tournaments
                  </h2>
                </div>
                <div className={`divide-y ${isDark ? "divide-white/5" : "divide-gray-100"}`}>
                  {completedTournaments.map((t) => (
                    <TournamentRow key={t.tournamentId} tournament={t} isDark={isDark} textMuted={textMuted} />
                  ))}
                </div>
              </div>
            )}

            {/* Live past tournaments created via wizard */}
            {livePast.length > 0 && (
              <div className={`rounded-3xl border ${cardBorder} ${card} overflow-hidden`}>
                <div className={`px-5 py-4 border-b ${divider}`}>
                  <h2 className={`text-sm font-semibold uppercase tracking-wider ${isDark ? "text-white/40" : "text-gray-400"}`}>
                    Past Tournaments
                  </h2>
                </div>
                <div className={`divide-y ${isDark ? "divide-white/5" : "divide-gray-100"}`}>
                  {livePast.map((t) => (
                    <a
                      key={t.id}
                      href={`/tournament/${t.id}`}
                      className={`flex items-center gap-4 px-5 py-4 transition-colors ${isDark ? "hover:bg-white/3" : "hover:bg-gray-50"}`}
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isDark ? "bg-white/5" : "bg-gray-50"}`}>
                        <CheckCircle2 className={`w-4 h-4 ${textMuted}`} strokeWidth={1.8} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold truncate ${textMain}`}>{t.name}</p>
                        <p className={`text-xs truncate ${textMuted}`}>
                          {t.venue || "Venue TBD"} &middot; {t.date ? new Date(t.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Date TBD"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${isDark ? "bg-white/8 text-white/60" : "bg-gray-100 text-gray-500"}`}>
                          {t.format === "swiss" ? "Swiss" : t.format === "roundrobin" ? "Round Robin" : "Elimination"}
                        </span>
                        <span className={`text-xs ${textMuted}`}>{t.rounds}R</span>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {!hasAnyTournaments && (
              <div className={`rounded-3xl border ${cardBorder} ${card} py-16 text-center`}>
                <Trophy className={`w-10 h-10 mx-auto mb-3 ${textMuted}`} />
                <p className={`text-sm font-semibold ${textMain} mb-1`}>No tournaments yet</p>
                {isOwner ? (
                  <p className={`text-xs ${textMuted}`}>
                    Use the button above to host your first tournament.
                  </p>
                ) : (
                  <p className={`text-xs ${textMuted}`}>
                    The club owner hasn't hosted any tournaments yet.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Leagues tab ──────────────────────────────────────────────────── */}
        {activeTab === "leagues" && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Commissioner CTA */}
            {isOwner && (
              <button
                onClick={() => setShowCreateLeague(true)}
                className="w-full flex items-center justify-center gap-2 py-3 px-5 rounded-2xl border-2 border-dashed border-[#3D6B47]/40 text-sm font-semibold transition-all hover:border-[#3D6B47] hover:bg-[#3D6B47]/8 group"
              >
                <PlusCircle className={`w-4 h-4 transition-colors ${isDark ? "text-[#4CAF50] group-hover:text-[#66BB6A]" : "text-[#3D6B47] group-hover:text-[#2d5236]"}`} />
                <span className={isDark ? "text-[#4CAF50] group-hover:text-[#66BB6A]" : "text-[#3D6B47] group-hover:text-[#2d5236]"}>
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
                  <div className={`flex-1 h-px ${isDark ? "bg-white/10" : "bg-gray-200"}`} />
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
                        className={`w-full rounded-xl px-4 py-2.5 text-sm border outline-none focus:ring-2 focus:ring-[#4CAF50]/40 ${isDark ? "bg-white/5 border-white/10 text-white placeholder-white/30" : "bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400"}`}
                        placeholder="e.g. Spring 2026 League"
                        value={leagueForm.name}
                        onChange={(e) => setLeagueForm((f) => ({ ...f, name: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className={`text-xs font-medium block mb-1 ${textMuted}`}>Description <span className={textMuted}>(optional)</span></label>
                      <textarea
                        rows={2}
                        className={`w-full rounded-xl px-4 py-2.5 text-sm border outline-none focus:ring-2 focus:ring-[#4CAF50]/40 resize-none ${isDark ? "bg-white/5 border-white/10 text-white placeholder-white/30" : "bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400"}`}
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
                        className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-opacity hover:opacity-70 ${isDark ? "bg-white/8 text-white/60" : "bg-gray-100 text-gray-500"}`}
                      >Cancel</button>
                      <button
                        type="button"
                        disabled={!leagueForm.name.trim()}
                        onClick={() => { setLeagueWizardStep(2); setSelectedPlayerIds([]); }}
                        className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
                        style={{ background: "oklch(0.55 0.13 145)", color: "#fff" }}
                      >Next: Pick Players →</button>
                    </div>
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
                                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b last:border-b-0 ${isDark ? "border-white/5" : "border-gray-100"} ${disabled ? "opacity-30" : ""}`}
                                style={{ background: sel ? "oklch(0.55 0.13 145 / 0.12)" : "transparent" }}
                              >
                                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 overflow-hidden" style={{ background: sel ? "oklch(0.55 0.13 145)" : (isDark ? "rgba(255,255,255,0.1)" : "#e5e7eb") }}>
                                  {m.avatarUrl
                                    ? <img src={m.avatarUrl} alt="" className="w-8 h-8 object-cover" />
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
                          className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-opacity hover:opacity-70 ${isDark ? "bg-white/8 text-white/60" : "bg-gray-100 text-gray-500"}`}
                        >← Back</button>
                        <button
                          type="button"
                          disabled={picked !== needed || creatingLeague}
                          onClick={async () => {
                            if (!club || picked !== needed) return;
                            setCreatingLeague(true);
                            try {
                              const res = await fetch("/api/leagues", {
                                method: "POST",
                                credentials: "include",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  clubId: club.id,
                                  name: leagueForm.name.trim(),
                                  description: leagueForm.description.trim() || null,
                                  maxPlayers: leagueForm.maxPlayers,
                                  playerIds: selectedPlayerIds,
                                }),
                              });
                              if (res.ok) {
                                const created = await res.json();
                                const newLeagueId = created.leagueId ?? created.id;
                                setClubLeagues((prev) => [{ id: newLeagueId, name: leagueForm.name.trim(), status: "active", currentWeek: 1, totalWeeks: leagueForm.maxPlayers - 1, playerCount: leagueForm.maxPlayers }, ...prev]);
                                setShowCreateLeague(false);
                                setLeagueForm({ name: "", description: "", maxPlayers: 8, totalWeeks: 7 });
                                setLeagueWizardStep(1);
                                setSelectedPlayerIds([]);
                                toast.success(`League "${leagueForm.name.trim()}" created!`);
                                navigate(`/leagues/${newLeagueId}`);
                              } else {
                                const d = await res.json().catch(() => ({}));
                                toast.error(d.error ?? "Failed to create league");
                              }
                            } finally {
                              setCreatingLeague(false);
                            }
                          }}
                          className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
                          style={{ background: "oklch(0.55 0.13 145)", color: "#fff" }}
                        >{creatingLeague ? "Creating…" : `Create League (${picked}/${needed})`}</button>
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
                <Trophy className={`w-10 h-10 mx-auto mb-3 ${textMuted}`} />
                <p className={`text-sm font-semibold ${textMain} mb-1`}>No leagues yet</p>
                {isOwner ? (
                  <p className={`text-xs ${textMuted}`}>Use the button above to create your first league.</p>
                ) : joined ? (
                  <>
                    <p className={`text-xs ${textMuted} mb-4`}>No active leagues right now. Ask the club director to start one!</p>
                    <button
                      onClick={() => toast.info("Your interest has been noted! The club director will be notified.")}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
                      style={{ background: "oklch(0.55 0.13 145 / 0.12)", color: "oklch(0.55 0.13 145)" }}
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v6M7 9.5v1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.2"/></svg>
                      Express Interest in a League
                    </button>
                  </>
                ) : (
                  <p className={`text-xs ${textMuted}`}>Join the club to participate in leagues.</p>
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
                  const res = await fetch(`/api/leagues/${lgId}/join-request`, {
                    method: "POST",
                    credentials: "include",
                    headers: { "Content-Type": "application/json" },
                  });
                  const data = await res.json();
                  if (res.ok) {
                    setRequestedLeagueIds((prev) => { const n = new Set(Array.from(prev)); n.add(lgId); return n; });
                    toast.success("Request sent! The commissioner will review it.");
                  } else if (res.status === 409) {
                    setRequestedLeagueIds((prev) => { const n = new Set(Array.from(prev)); n.add(lgId); return n; });
                    toast.info(data.error ?? "Request already submitted");
                  } else {
                    toast.error(data.error ?? "Failed to send request");
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
                    className={`w-full flex items-center gap-4 px-5 py-4 text-left transition-colors cursor-pointer ${isDark ? "hover:bg-white/3" : "hover:bg-gray-50"}`}
                    onClick={() => navigate(`/leagues/${lg.id}`)}
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${lg.status === "completed" ? (isDark ? "bg-yellow-500/15" : "bg-yellow-50") : isDraft ? (isDark ? "bg-white/5" : "bg-gray-50") : (isDark ? "bg-[#4CAF50]/15" : "bg-green-50")}`}>
                      <Trophy className={`w-4 h-4 ${lg.status === "completed" ? "text-yellow-500" : isDraft ? (isDark ? "text-white/30" : "text-gray-400") : "text-[#4CAF50]"}`} strokeWidth={1.8} />
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
      </div>

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
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
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
                className={`p-1.5 rounded-xl transition-colors ${isDark ? "text-white/40 hover:text-white hover:bg-white/8" : "text-gray-400 hover:text-gray-900 hover:bg-gray-100"}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Avatar section */}
            <div className={`rounded-2xl border ${cardBorder} p-5 mb-3 ${isDark ? "bg-white/3" : "bg-gray-50"}`}>
              <p className={`text-xs font-semibold uppercase tracking-wider mb-4 ${isDark ? "text-white/40" : "text-gray-400"}`}>
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
                    <p className={`text-xs mt-1 font-medium ${isDark ? "text-[#4CAF50]" : "text-[#3D6B47]"}`}>
                      New avatar ready to save
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Banner section */}
            <div className={`rounded-2xl border ${cardBorder} p-5 mb-4 ${isDark ? "bg-white/3" : "bg-gray-50"}`}>
              <p className={`text-xs font-semibold uppercase tracking-wider mb-3 ${isDark ? "text-white/40" : "text-gray-400"}`}>
                Hero Banner
              </p>
              <ClubBannerUpload
                value={pendingBanner !== undefined ? pendingBanner : club.bannerUrl}
                onChange={(url) => setPendingBanner(url)}
                accentColor={club.accentColor}
                isDark={isDark}
              />
              {pendingBanner !== undefined && pendingBanner !== club.bannerUrl && (
                <p className={`text-xs mt-2 font-medium ${isDark ? "text-[#4CAF50]" : "text-[#3D6B47]"}`}>
                  {pendingBanner ? "New banner ready to save" : "Banner will be removed"}
                </p>
              )}
            </div>

            {/* Save / Cancel */}
            <div className="flex gap-2">
              <button
                onClick={() => { setShowSettings(false); setPendingAvatar(undefined); setPendingBanner(undefined); }}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${isDark ? "bg-white/8 text-white/70 hover:bg-white/12" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
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
                  await new Promise((r) => setTimeout(r, 300));
                  const patch: Record<string, unknown> = {};
                  if (pendingAvatar !== undefined && pendingAvatar !== club.avatarUrl) patch.avatarUrl = pendingAvatar;
                  if (pendingBanner !== undefined && pendingBanner !== club.bannerUrl) patch.bannerUrl = pendingBanner;
                  if (Object.keys(patch).length > 0) {
                    const updated = updateClub(club.id, patch);
                    if (updated) {
                      setClub(updated);
                      toast.success("Club updated!");
                    }
                  }
                  setSavingSettings(false);
                  setShowSettings(false);
                  setPendingAvatar(undefined);
                  setPendingBanner(undefined);
                }}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-[#3D6B47] text-white hover:bg-[#2d5236] transition-colors disabled:opacity-40"
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
      {/* Auth modal — shown when guest tries to join, follow, or request a league */}
      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} isDark />
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
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${isDark ? "bg-white/6 text-white/40" : "bg-gray-50 text-gray-400"}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-[10px] font-semibold uppercase tracking-wider ${isDark ? "text-white/30" : "text-gray-400"}`}>{label}</p>
        <p className={`text-sm font-medium ${isDark ? "text-white/80" : "text-gray-700"}`}>{value}</p>
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
    <div className={`flex items-center gap-3 px-5 py-3.5 transition-colors ${isDark ? "hover:bg-white/3" : "hover:bg-gray-50"}`}>
      <PlayerAvatar
        username={username ?? ""}
        platform={platform}
        name={member.displayName}
        size={36}
        showBadge={false}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-sm font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
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
            <p className={`text-sm font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
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
    <div className={`flex items-center gap-4 px-5 py-4 transition-colors ${isDark ? "hover:bg-white/3" : "hover:bg-gray-50"}`}>
      {/* Format icon */}
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isDark ? "bg-white/6" : "bg-gray-50"}`}>
        <Trophy className={`w-5 h-5 ${isDark ? "text-[#4CAF50]" : "text-[#3D6B47]"}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-sm font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
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
