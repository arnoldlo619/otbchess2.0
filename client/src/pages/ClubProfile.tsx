/**
 * ClubProfile page — /clubs/:id
 *
 * Full club profile with:
 *   - Hero banner with club identity, stats, and join/leave CTA
 *   - About section with description and social links
 *   - Members roster with roles and stats
 *   - Tournament history with status badges
 */
import { useState, useEffect } from "react";
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
  seedClubsIfEmpty,
  type Club,
  type ClubMember,
  type ClubTournament,
} from "@/lib/clubRegistry";
import { ClubAvatarUpload } from "@/components/ClubAvatarUpload";
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
} from "lucide-react";
import { toast } from "sonner";

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

function TournamentStatusBadge({ status }: { status: ClubTournament["status"] }) {
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
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/8 text-white/40">
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

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ClubProfile() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { user } = useAuthContext();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [club, setClub] = useState<Club | null>(null);
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [tournaments, setTournaments] = useState<ClubTournament[]>([]);
  const [joined, setJoined] = useState(false);
  const [activeTab, setActiveTab] = useState<"about" | "members" | "tournaments">("about");
  const [joining, setJoining] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [pendingAvatar, setPendingAvatar] = useState<string | null | undefined>(undefined);
  const [savingAvatar, setSavingAvatar] = useState(false);

  // Seed and load
  useEffect(() => {
    seedClubsIfEmpty();
    const id = params.id;
    // Try by id first, then by slug
    const found = getClub(id) ?? getClubBySlug(id);
    if (!found) return;
    setClub(found);
    setMembers(getClubMembers(found.id));
    setTournaments(getClubTournaments(found.id));
    if (user) setJoined(isMember(found.id, user.id));
  }, [params.id, user]);

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

  const myMembership = user ? getMembership(club.id, user.id) : null;
  const isOwner = myMembership?.role === "owner";
  const isDirector = myMembership?.role === "director";

  const handleJoin = async () => {
    if (!user) {
      toast.error("Sign in to join clubs");
      return;
    }
    setJoining(true);
    await new Promise((r) => setTimeout(r, 400));
    joinClub(club.id, {
      userId: user.id,
      displayName: user.displayName,
      chesscomUsername: user.chesscomUsername,
      lichessUsername: user.lichessUsername,
      avatarUrl: user.avatarUrl,
    });
    setJoined(true);
    setMembers(getClubMembers(club.id));
    setClub((prev) => prev ? { ...prev, memberCount: prev.memberCount + 1 } : prev);
    setJoining(false);
    toast.success(`You joined ${club.name}!`);
  };

  const handleLeave = async () => {
    if (!user || isOwner) return;
    setJoining(true);
    await new Promise((r) => setTimeout(r, 300));
    leaveClub(club.id, user.id);
    setJoined(false);
    setMembers(getClubMembers(club.id));
    setClub((prev) => prev ? { ...prev, memberCount: Math.max(0, prev.memberCount - 1) } : prev);
    setJoining(false);
    toast("Left " + club.name);
  };

  const handleShare = () => {
    const url = window.location.href;
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

      {/* ── Hero banner ────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden">
        {/* Banner gradient */}
        <div
          className="h-44 sm:h-56 w-full"
          style={{
            background: `linear-gradient(135deg, ${club.accentColor}cc 0%, ${club.accentColor}44 50%, ${isDark ? "#0d1a0f" : "#F0F5EE"} 100%)`,
          }}
        >
          {/* Subtle chess board texture overlay */}
          <div className="absolute inset-0 chess-board-bg opacity-10" />
        </div>

        {/* Club identity card — overlaps banner */}
        <div className="max-w-4xl mx-auto px-4">
          <div className={`relative -mt-16 rounded-3xl border ${cardBorder} ${card} p-5 sm:p-6 shadow-xl`}>
            <div className="flex items-start gap-4">
              {/* Club avatar */}
              <div
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl flex-shrink-0 flex items-center justify-center text-3xl sm:text-4xl shadow-lg border-2 border-white/10"
                style={{ background: `linear-gradient(135deg, ${club.accentColor} 0%, ${club.accentColor}88 100%)` }}
              >
                {club.avatarUrl ? (
                  <img src={club.avatarUrl} alt={club.name} className="w-full h-full object-cover rounded-2xl" />
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
              <StatPill icon={<Trophy className="w-4 h-4" />} value={club.tournamentCount} label="Tournaments" isDark={isDark} />
              <StatPill icon={<CheckCircle2 className="w-4 h-4" />} value={completedTournaments.length} label="Completed" isDark={isDark} />
              <StatPill icon={<Zap className="w-4 h-4" />} value={upcomingTournaments.length} label="Upcoming" isDark={isDark} />
            </div>

            {/* Join / Leave CTA */}
            <div className="mt-5 flex items-center gap-3">
              {!user ? (
                <button
                  onClick={() => toast("Sign in to join clubs")}
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
        <div className={`flex gap-1 p-1 rounded-2xl ${isDark ? "bg-white/5" : "bg-black/5"}`}>
          {(["about", "members", "tournaments"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold capitalize transition-all ${
                activeTab === tab ? tabActive : tabInactive
              }`}
            >
              {tab}
              {tab === "members" && (
                <span className={`ml-1.5 text-xs ${activeTab === tab ? "opacity-70" : "opacity-40"}`}>
                  {club.memberCount}
                </span>
              )}
              {tab === "tournaments" && (
                <span className={`ml-1.5 text-xs ${activeTab === tab ? "opacity-70" : "opacity-40"}`}>
                  {tournaments.length}
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
            <div className="divide-y divide-white/5">
              {members.map((member) => (
                <MemberRow key={member.userId} member={member} isDark={isDark} textMuted={textMuted} />
              ))}
              {members.length === 0 && (
                <div className={`py-12 text-center text-sm ${textMuted}`}>No members yet</div>
              )}
            </div>
          </div>
        )}

        {/* ── Tournaments tab ──────────────────────────────────────────────── */}
        {activeTab === "tournaments" && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Upcoming / Active */}
            {upcomingTournaments.length > 0 && (
              <div className={`rounded-3xl border ${cardBorder} ${card} overflow-hidden`}>
                <div className={`px-5 py-4 border-b ${divider}`}>
                  <h2 className={`text-sm font-semibold uppercase tracking-wider ${isDark ? "text-white/40" : "text-gray-400"}`}>
                    Upcoming & Active
                  </h2>
                </div>
                <div className="divide-y divide-white/5">
                  {upcomingTournaments.map((t) => (
                    <TournamentRow key={t.tournamentId} tournament={t} isDark={isDark} textMuted={textMuted} />
                  ))}
                </div>
              </div>
            )}

            {/* Past tournaments */}
            {completedTournaments.length > 0 && (
              <div className={`rounded-3xl border ${cardBorder} ${card} overflow-hidden`}>
                <div className={`px-5 py-4 border-b ${divider}`}>
                  <h2 className={`text-sm font-semibold uppercase tracking-wider ${isDark ? "text-white/40" : "text-gray-400"}`}>
                    Past Tournaments
                  </h2>
                </div>
                <div className="divide-y divide-white/5">
                  {completedTournaments.map((t) => (
                    <TournamentRow key={t.tournamentId} tournament={t} isDark={isDark} textMuted={textMuted} />
                  ))}
                </div>
              </div>
            )}

            {tournaments.length === 0 && (
              <div className={`rounded-3xl border ${cardBorder} ${card} py-16 text-center`}>
                <Trophy className={`w-10 h-10 mx-auto mb-3 ${textMuted}`} />
                <p className={`text-sm font-medium ${textMuted}`}>No tournaments yet</p>
              </div>
            )}
          </div>
        )}
      </div>

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
            <div className={`rounded-2xl border ${cardBorder} p-5 mb-4 ${isDark ? "bg-white/3" : "bg-gray-50"}`}>
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

            {/* Save / Cancel */}
            <div className="flex gap-2">
              <button
                onClick={() => setShowSettings(false)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${isDark ? "bg-white/8 text-white/70 hover:bg-white/12" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
              >
                Cancel
              </button>
              <button
                disabled={savingAvatar || pendingAvatar === undefined || pendingAvatar === club.avatarUrl}
                onClick={async () => {
                  if (pendingAvatar === undefined) return;
                  setSavingAvatar(true);
                  await new Promise((r) => setTimeout(r, 300));
                  const updated = updateClub(club.id, { avatarUrl: pendingAvatar });
                  if (updated) {
                    setClub(updated);
                    toast.success("Avatar updated!");
                  }
                  setSavingAvatar(false);
                  setShowSettings(false);
                  setPendingAvatar(undefined);
                }}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-[#3D6B47] text-white hover:bg-[#2d5236] transition-colors disabled:opacity-40"
              >
                {savingAvatar ? (
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
  isDark,
  textMuted,
}: {
  member: ClubMember;
  isDark: boolean;
  textMuted: string;
}) {
  const platform: "chesscom" | "lichess" | undefined = member.chesscomUsername ? "chesscom" : member.lichessUsername ? "lichess" : undefined;
  const username = member.chesscomUsername ?? member.lichessUsername ?? undefined;

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
        </div>
        {username && (
          <p className={`text-xs mt-0.5 ${textMuted}`}>
            {member.chesscomUsername ? "chess.com" : "lichess"} · {username}
          </p>
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
          <TournamentStatusBadge status={tournament.status} />
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
