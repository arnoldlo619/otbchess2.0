/**
 * ClubManage.tsx — Club Admin Command Center
 *
 * Route: /clubs/:id/manage
 * A clean, focused dashboard for club owners/admins to see metrics,
 * take quick actions, track setup progress, and view recent activity.
 */

import { useState, useEffect } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuthContext } from "@/context/AuthContext";
import { apiGetClub, apiListClubMembers } from "@/lib/clubsApi";
import { authFetch } from "@/lib/apiFetch";
import type { Club, ClubMember } from "@/lib/clubRegistry";
import { getClub, getClubBySlug, getClubMembers, isMember } from "@/lib/clubRegistry";
import { listClubEvents, type ClubEvent } from "@/lib/clubEventRegistry";
import { listFeedEvents, type FeedEvent } from "@/lib/clubFeedRegistry";
import {
  Users, Calendar, Trophy, Plus, Share2, Eye, Edit3, Megaphone,
  CheckCircle2, Circle, AlertTriangle, ArrowRight, QrCode, Link2,
  TrendingUp, UserPlus, Clock, ChevronRight, LayoutDashboard
} from "lucide-react";
import { ClubShareModal } from "@/components/ClubShareModal";

// ── Onboarding Checklist Steps ───────────────────────────────────────────────
interface ChecklistStep {
  id: string;
  label: string;
  description: string;
  done: boolean;
  action: string; // route or action key
}

function getChecklistSteps(club: Club, members: ClubMember[], events: ClubEvent[]): ChecklistStep[] {
  return [
    {
      id: "logo",
      label: "Add club logo",
      description: "Upload a logo so members recognise your club instantly.",
      done: !!club.avatarUrl,
      action: "edit-profile",
    },
    {
      id: "description",
      label: "Add club description",
      description: "Tell players what your club is about and what to expect.",
      done: !!club.description && club.description.length > 20,
      action: "edit-profile",
    },
    {
      id: "location",
      label: "Add location or online status",
      description: "Help players find you — add a city or mark as online/hybrid.",
      done: !!club.location && club.location.length > 2,
      action: "edit-profile",
    },
    {
      id: "schedule",
      label: "Add meeting schedule",
      description: "Let members know when you meet — day, time, and frequency.",
      done: !!(club.meetingSchedule || club.meetingDay),
      action: "edit-profile",
    },
    {
      id: "socials",
      label: "Add website or social links",
      description: "Connect your Instagram, Discord, or website for easy discovery.",
      done: !!(club.website || club.instagram || club.discord || club.twitter),
      action: "edit-profile",
    },
    {
      id: "invite",
      label: "Invite first members",
      description: "Share your club link or invite players by email.",
      done: members.length > 1,
      action: "invite",
    },
    {
      id: "event",
      label: "Create first event",
      description: "Set up a meetup, club night, or training session.",
      done: events.length > 0,
      action: "create-event",
    },
    {
      id: "tournament",
      label: "Host first tournament",
      description: "Run your first OTB tournament through ChessOTB.",
      done: (club.tournamentCount ?? 0) > 0,
      action: "create-tournament",
    },
    {
      id: "share",
      label: "Share club page",
      description: "Post your club link on Instagram, WhatsApp, or print a QR code.",
      done: false, // We can't easily track this, so always show as available
      action: "share",
    },
  ];
}

// ── Main Component ───────────────────────────────────────────────────────────
export default function ClubManage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { user } = useAuthContext();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [club, setClub] = useState<Club | null>(null);
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [events, setEvents] = useState<ClubEvent[]>([]);
  const [feedEvents, setFeedEvents] = useState<FeedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showShareModal, setShowShareModal] = useState(false);
  const [pendingInvites, setPendingInvites] = useState<Array<{ id: string; email: string; token: string; expiresAt: string; status: string }>>([]);

  // ── Load club data ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!id) { navigate("/clubs"); return; }

    async function loadClub() {
      let found: Club | null = getClub(id!) ?? getClubBySlug(id!);
      if (!found) {
        try {
          const serverClub = await apiGetClub(id!);
          if (serverClub) found = serverClub;
        } catch { /* fall through */ }
      }
      if (!found) { navigate("/clubs"); return; }

      // Permission guard — only owner/admin
      if (user) {
        const isOwner = found.ownerId === user.id;
        if (!isOwner) {
          let localMember = isMember(found.id, user.id);
          if (!localMember) {
            try {
              const serverMembers = await apiListClubMembers(found.id);
              const sm = serverMembers.find((m) => m.userId === user.id);
              if (sm && (sm.role === "owner" || sm.role === "director")) localMember = true;
            } catch { /* deny */ }
          } else {
            const memberList = getClubMembers(found.id);
            const me = memberList.find((m) => m.userId === user.id);
            if (!me || me.role === "member") {
              navigate(`/clubs/${id}`);
              return;
            }
          }
          if (!localMember) {
            navigate(`/clubs/${id}`);
            return;
          }
        }
      } else {
        navigate(`/clubs/${id}`);
        return;
      }

      setClub(found);
      const memberList = getClubMembers(found.id);
      setMembers(memberList.length > 0 ? memberList : await apiListClubMembers(found.id));
      setEvents(listClubEvents(found.id, true));
      setFeedEvents(listFeedEvents(found.id, 20));
      setLoading(false);

      // Load pending invites
      try {
        const res = await authFetch(`/api/clubs/${found.id}/invites`, { credentials: "include" });
        if (res.ok) {
          const data = await res.json() as Array<{ id: string; email: string; token: string; expiresAt: string; status: string }>;
          setPendingInvites(data.filter((i) => i.status === "pending"));
        }
      } catch { /* ignore */ }
    }

    loadClub();
  }, [id, user, navigate]);

  // ── Derived data ───────────────────────────────────────────────────────────
  const upcomingEvents = events.filter((e) => new Date(e.startAt) >= new Date());
  const newMembersThisMonth = members.filter((m) => {
    const joined = new Date(m.joinedAt);
    const now = new Date();
    return joined.getMonth() === now.getMonth() && joined.getFullYear() === now.getFullYear();
  }).length;

  const checklistSteps = club ? getChecklistSteps(club, members, events) : [];
  const completedSteps = checklistSteps.filter((s) => s.done).length;
  const checklistProgress = checklistSteps.length > 0 ? Math.round((completedSteps / checklistSteps.length) * 100) : 0;

  // ── Styles ─────────────────────────────────────────────────────────────────
  const cardBg = isDark ? "bg-[#1a2e1a]/60 border-[#4CAF50]/15" : "bg-white border-[#ADBC9F]/30";
  const textMain = isDark ? "text-white" : "text-[#12372A]";
  const textMuted = isDark ? "text-white/60" : "text-[#436850]";
  const accentBg = isDark ? "bg-[#4CAF50]/10" : "bg-[#436850]/8";
  const accentText = isDark ? "text-[#4CAF50]" : "text-[#436850]";

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? "bg-[#0d1a0f]" : "bg-[#F5F0E8]"}`}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-[#4D6940] border-t-transparent animate-spin" />
          <span className={`text-sm font-medium ${textMuted}`}>Loading dashboard…</span>
        </div>
      </div>
    );
  }

  if (!club) return null;

  // ── Quick Actions ──────────────────────────────────────────────────────────
  const quickActions = [
    { icon: Edit3, label: "Edit Profile", action: () => navigate(`/clubs/${id}/home?tab=settings`) },
    { icon: UserPlus, label: "Invite Members", action: () => navigate(`/clubs/${id}/home?tab=settings&sub=invites`) },
    { icon: Calendar, label: "Create Event", action: () => navigate(`/clubs/${id}/home?tab=events&action=create`) },
    { icon: Trophy, label: "Create Tournament", action: () => navigate(`/clubs/${id}/home?tab=events&action=tournament`) },
    { icon: Megaphone, label: "Post Announcement", action: () => navigate(`/clubs/${id}/home?tab=feed`) },
    { icon: Eye, label: "View Public Page", action: () => navigate(`/clubs/${id}`) },
    { icon: Share2, label: "Share Club", action: () => setShowShareModal(true) },
    { icon: QrCode, label: "QR Code", action: () => navigate(`/clubs/${id}/home?tab=qr`) },
  ];

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0d1a0f]" : "bg-[#F5F0E8]"}`}>
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className={`border-b ${isDark ? "border-white/10 bg-[#0d1a0f]/90" : "border-[#ADBC9F]/20 bg-[#F5F0E8]/90"} backdrop-blur-sm sticky top-0 z-30`}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {club.avatarUrl ? (
              <img src={club.avatarUrl} alt="" className="w-10 h-10 rounded-xl object-cover" />
            ) : (
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? "bg-[#4CAF50]/20" : "bg-[#436850]/10"}`}>
                <LayoutDashboard className={`w-5 h-5 ${accentText}`} />
              </div>
            )}
            <div>
              <h1 className={`text-lg font-bold ${textMain}`} style={{ fontFamily: "'Clash Display', sans-serif" }}>
                {club.name}
              </h1>
              <p className={`text-xs ${textMuted}`}>Club Admin Dashboard</p>
            </div>
          </div>
          <Link href={`/clubs/${id}/home`}>
            <span className={`text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${isDark ? "bg-white/5 hover:bg-white/10 text-white/70" : "bg-[#436850]/5 hover:bg-[#436850]/10 text-[#436850]"}`}>
              ← Back to Club
            </span>
          </Link>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8">
        {/* ── Tagline ─────────────────────────────────────────────────────────── */}
        <p className={`text-sm ${textMuted}`}>
          Grow and manage your chess community from one place.
        </p>

        {/* ── Overview Metrics ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {[
            { label: "Total Members", value: members.length, icon: Users, trend: newMembersThisMonth > 0 ? `+${newMembersThisMonth} this month` : undefined },
            { label: "Upcoming Events", value: upcomingEvents.length, icon: Calendar },
            { label: "Tournaments Hosted", value: club.tournamentCount ?? 0, icon: Trophy },
            { label: "Pending Invites", value: pendingInvites.length, icon: UserPlus },
          ].map((metric) => (
            <div key={metric.label} className={`rounded-2xl border p-4 ${cardBg}`}>
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${accentBg}`}>
                  <metric.icon className={`w-4 h-4 ${accentText}`} />
                </div>
              </div>
              <p className={`text-2xl font-bold ${textMain}`}>{metric.value}</p>
              <p className={`text-xs ${textMuted} mt-0.5`}>{metric.label}</p>
              {metric.trend && (
                <p className={`text-xs mt-1 flex items-center gap-1 ${isDark ? "text-[#4CAF50]" : "text-[#436850]"}`}>
                  <TrendingUp className="w-3 h-3" />
                  {metric.trend}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* ── Setup Checklist ──────────────────────────────────────────────────── */}
        {checklistProgress < 100 && (
          <div className={`rounded-2xl border p-5 sm:p-6 ${cardBg}`}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className={`text-base font-bold ${textMain}`} style={{ fontFamily: "'Clash Display', sans-serif" }}>
                  Setup Your Club
                </h2>
                <p className={`text-xs ${textMuted} mt-0.5`}>
                  Complete your club profile so players know where to join, when you meet, and what's coming next.
                </p>
              </div>
              <div className={`text-sm font-bold px-3 py-1.5 rounded-full ${isDark ? "bg-[#4CAF50]/15 text-[#4CAF50]" : "bg-[#436850]/10 text-[#436850]"}`}>
                {checklistProgress}%
              </div>
            </div>
            {/* Progress bar */}
            <div className={`h-2 rounded-full mb-5 ${isDark ? "bg-white/10" : "bg-[#ADBC9F]/30"}`}>
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{ width: `${checklistProgress}%`, background: isDark ? "oklch(0.65 0.16 145)" : "oklch(0.45 0.12 145)" }}
              />
            </div>
            {/* Steps */}
            <div className="grid gap-2 sm:grid-cols-2">
              {checklistSteps.map((step) => (
                <div
                  key={step.id}
                  className={`flex items-start gap-3 p-3 rounded-xl transition-colors ${
                    step.done
                      ? isDark ? "bg-[#4CAF50]/5" : "bg-[#436850]/5"
                      : isDark ? "hover:bg-white/5" : "hover:bg-[#436850]/5"
                  }`}
                >
                  <div className="mt-0.5">
                    {step.done ? (
                      <CheckCircle2 className={`w-5 h-5 ${isDark ? "text-[#4CAF50]" : "text-[#436850]"}`} />
                    ) : (
                      <Circle className={`w-5 h-5 ${isDark ? "text-white/25" : "text-[#ADBC9F]"}`} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${step.done ? `${textMuted} line-through opacity-60` : textMain}`}>
                      {step.label}
                    </p>
                    {!step.done && (
                      <p className={`text-xs ${textMuted} mt-0.5`}>{step.description}</p>
                    )}
                  </div>
                  {!step.done && (
                    <ChevronRight className={`w-4 h-4 mt-0.5 flex-shrink-0 ${textMuted}`} />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Quick Actions ────────────────────────────────────────────────────── */}
        <div>
          <h2 className={`text-sm font-bold ${textMain} mb-3`} style={{ fontFamily: "'Clash Display', sans-serif" }}>
            Quick Actions
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            {quickActions.map((action) => (
              <button
                key={action.label}
                onClick={action.action}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all hover:scale-[1.02] active:scale-[0.98] ${
                  isDark
                    ? "border-white/10 bg-white/5 hover:bg-white/8 hover:border-[#4CAF50]/30"
                    : "border-[#ADBC9F]/20 bg-white hover:bg-[#436850]/5 hover:border-[#436850]/30"
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${accentBg}`}>
                  <action.icon className={`w-5 h-5 ${accentText}`} />
                </div>
                <span className={`text-xs font-medium text-center ${textMain}`}>{action.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Admin Alerts ─────────────────────────────────────────────────────── */}
        {(pendingInvites.length > 0 || !club.description || !club.avatarUrl || upcomingEvents.length === 0) && (
          <div className={`rounded-2xl border p-5 ${isDark ? "border-amber-500/20 bg-amber-500/5" : "border-amber-600/15 bg-amber-50"}`}>
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className={`w-4 h-4 ${isDark ? "text-amber-400" : "text-amber-600"}`} />
              <h2 className={`text-sm font-bold ${isDark ? "text-amber-300" : "text-amber-800"}`}>
                Needs Attention
              </h2>
            </div>
            <div className="space-y-2">
              {pendingInvites.length > 0 && (
                <div className={`flex items-center justify-between text-sm ${isDark ? "text-amber-200/80" : "text-amber-800/80"}`}>
                  <span>{pendingInvites.length} pending invite{pendingInvites.length > 1 ? "s" : ""} awaiting response</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              )}
              {!club.description && (
                <div className={`flex items-center justify-between text-sm ${isDark ? "text-amber-200/80" : "text-amber-800/80"}`}>
                  <span>Missing club description</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              )}
              {!club.avatarUrl && (
                <div className={`flex items-center justify-between text-sm ${isDark ? "text-amber-200/80" : "text-amber-800/80"}`}>
                  <span>No club logo uploaded</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              )}
              {upcomingEvents.length === 0 && (
                <div className={`flex items-center justify-between text-sm ${isDark ? "text-amber-200/80" : "text-amber-800/80"}`}>
                  <span>No upcoming events — create one to keep members engaged</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Recent Activity ──────────────────────────────────────────────────── */}
        <div className={`rounded-2xl border p-5 sm:p-6 ${cardBg}`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className={`text-sm font-bold ${textMain}`} style={{ fontFamily: "'Clash Display', sans-serif" }}>
              Recent Activity
            </h2>
            <Link href={`/clubs/${id}/home?tab=feed`}>
              <span className={`text-xs font-medium ${accentText} hover:underline`}>View All →</span>
            </Link>
          </div>
          {feedEvents.length === 0 ? (
            <div className={`text-center py-8 ${textMuted}`}>
              <Clock className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No activity yet. Create an event or post an announcement to get started.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {feedEvents.slice(0, 8).map((event) => (
                <div key={event.id} className={`flex items-start gap-3 text-sm ${textMuted}`}>
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${accentBg}`}>
                    {event.type === "announcement" && <Megaphone className={`w-3.5 h-3.5 ${accentText}`} />}
                    {event.type === "poll" && <TrendingUp className={`w-3.5 h-3.5 ${accentText}`} />}
                    {event.type === "rsvp_form" && <Calendar className={`w-3.5 h-3.5 ${accentText}`} />}
                    {!["announcement", "poll", "rsvp_form"].includes(event.type) && <Plus className={`w-3.5 h-3.5 ${accentText}`} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${textMain} truncate`}>
                      {event.type === "announcement" ? event.detail?.slice(0, 80) : event.type === "poll" ? event.pollQuestion?.slice(0, 80) : event.type === "rsvp_form" ? event.rsvpTitle : event.description}
                    </p>
                    <p className={`text-xs ${textMuted} mt-0.5`}>
                      {new Date(event.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      {event.actorName && ` · ${event.actorName}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Club Link Card ───────────────────────────────────────────────────── */}
        <div className={`rounded-2xl border p-5 ${cardBg}`}>
          <div className="flex items-center gap-3 mb-3">
            <Link2 className={`w-5 h-5 ${accentText}`} />
            <h2 className={`text-sm font-bold ${textMain}`}>Your Club Link</h2>
          </div>
          <div className={`flex items-center gap-2 p-3 rounded-xl ${isDark ? "bg-white/5" : "bg-[#436850]/5"}`}>
            <code className={`text-xs flex-1 truncate ${textMuted}`}>
              {window.location.origin}/clubs/{club.slug || id}
            </code>
            <button
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/clubs/${club.slug || id}`);
              }}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg ${isDark ? "bg-[#4CAF50]/20 text-[#4CAF50] hover:bg-[#4CAF50]/30" : "bg-[#436850]/10 text-[#436850] hover:bg-[#436850]/20"} transition-colors`}
            >
              Copy
            </button>
          </div>
          <p className={`text-xs ${textMuted} mt-2`}>
            Share this link on Instagram, WhatsApp, or print it as a QR code for flyers.
          </p>
        </div>
      </div>

      {/* Share Modal */}
      {showShareModal && (
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
    </div>
  );
}
