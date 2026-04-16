import React, { useState, useEffect, useMemo } from "react";
import { useParams, Link } from "wouter";
import {
  BarChart3,
  Users,
  Eye,
  Search,
  Heart,
  Mail,
  MousePointerClick,
  TrendingUp,
  ArrowLeft,
  Lightbulb,
  Trophy,
  Clock,
  Target,
  ChevronDown,
  ChevronUp,
  Activity,
  UserCheck,
  UserPlus,
  Repeat2,
  GitCompare,
  Sprout,
  CalendarCheck,
} from "lucide-react";
import { ThemeToggle } from "../components/ThemeToggle";
import { NavLogo } from "../components/NavLogo";

// ─── Types ───────────────────────────────────────────────────────────────────

interface AnalyticsData {
  overview: {
    totalViews: number;
    uniqueVisitors: number;
    totalInteractions: number;
    engagementRate: number;
  };
  attendance: {
    registered: number;
    totalRounds: number;
    currentRound: number;
    gamesPlayed: number;
  };
  funnel: {
    views: number;
    searches: number;
    follows: number;
    emailCaptures: number;
    ctaClicks: number;
  };
  ctaBreakdown: Record<string, number>;
  emailsCaptured: string[];
  topSearches: { name: string; count: number }[];
  topFollowedPlayers: { playerId: string; count: number }[];
  eventCounts: Record<string, number>;
  timeline: { date: string; views: number; interactions: number }[];
  operationalQuality: {
    completionRate: number;
    avgGamesPerRound: number;
    roundsCompleted: number;
    totalGamesExpected: number;
    byeCount: number;
  };
  retentionSignals: {
    netFollows: number;
    cardClaims: number;
    emailConversionRate: number;
    ctaConversionRate: number;
    searchToFollowRate: number;
  };
  attendanceBreakdown?: {
    preRegistered: number;
    walkIns: number;
    lateAdds: number;
    finalField: number;
    noShows: number;
    walkInRate: number;
    noShowRate: number;
  };
  postEventConversion?: {
    emailsOptedIn: number;
    cardsClaimed: number;
    joinClubClicks: number;
    createAccountClicks: number;
    anonToLeadRate: number;
    emailCaptureRate: number;
    cardClaimRate: number;
  };
  clubGrowth?: {
    totalLeadsGenerated: number;
    emailLeads: number;
    cardClaimLeads: number;
    clubJoinClicks: number;
    createAccountClicks: number;
    totalCtaConversions: number;
    leadConversionRate: number;
  };
  tournamentComparison?: {
    pastEvents: {
      id: string;
      name: string;
      date: string | null;
      format: string | null;
      playerCount: number;
      status: string | null;
    }[];
    avgAttendance: number;
    thisEventRank: number;
  };
  repeatEventGrowth?: {
    newPlayers: number;
    returningPlayers: number;
    repeatRate: number;
    multiEventPlayers: number;
  };
}

// ─── Metric Card ─────────────────────────────────────────────────────────────

function MetricCard({
  icon: Icon,
  label,
  value,
  subtitle,
  isDark,
  accent = false,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  subtitle?: string;
  isDark: boolean;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 sm:p-5 transition-all ${
        accent
          ? isDark
            ? "border-[#3D6B47]/40 bg-[#3D6B47]/10"
            : "border-[#3D6B47]/20 bg-[#F0F8F2]"
          : isDark
          ? "border-white/10 bg-[oklch(0.22_0.06_145)]"
          : "border-[#EEEED2] bg-white"
      }`}
    >
      <div className="flex items-center gap-2 mb-2 sm:mb-3">
        <div
          className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center ${
            isDark ? "bg-[#3D6B47]/20" : "bg-[#3D6B47]/10"
          }`}
        >
          <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#3D6B47]" />
        </div>
        <span className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {label}
        </span>
      </div>
      <p
        className="text-xl sm:text-2xl font-bold text-foreground"
        style={{ fontFamily: "'Clash Display', sans-serif" }}
      >
        {value}
      </p>
      {subtitle && (
        <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">{subtitle}</p>
      )}
    </div>
  );
}

// ─── Small Stat ──────────────────────────────────────────────────────────────

function SmallStat({
  label,
  value,
  suffix,
  isDark,
}: {
  label: string;
  value: string | number;
  suffix?: string;
  isDark: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-3 text-center ${
        isDark ? "border-white/08 bg-white/03" : "border-gray-100 bg-gray-50"
      }`}
    >
      <p
        className="text-lg font-bold text-foreground"
        style={{ fontFamily: "'Clash Display', sans-serif" }}
      >
        {value}
        {suffix && (
          <span className="text-xs font-normal text-muted-foreground ml-0.5">
            {suffix}
          </span>
        )}
      </p>
      <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

// ─── Progress Bar Row ─────────────────────────────────────────────────────────

function ProgressRow({
  label,
  value,
  total,
  color = "#3D6B47",
  isDark,
  suffix = "",
}: {
  label: string;
  value: number;
  total: number;
  color?: string;
  isDark: boolean;
  suffix?: string;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-foreground font-medium">{label}</span>
        <span className="font-mono font-bold text-foreground tabular-nums">
          {value}
          {suffix}
          <span className="text-muted-foreground font-normal ml-1">({pct}%)</span>
        </span>
      </div>
      <div
        className={`h-2 rounded-full overflow-hidden ${
          isDark ? "bg-white/08" : "bg-gray-100"
        }`}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.max(pct, value > 0 ? 2 : 0)}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

// ─── Funnel Step ─────────────────────────────────────────────────────────────

function FunnelStep({
  label,
  value,
  maxValue,
  isDark,
  icon: Icon,
}: {
  label: string;
  value: number;
  maxValue: number;
  isDark: boolean;
  icon: React.ElementType;
}) {
  const pct = maxValue > 0 ? Math.round((value / maxValue) * 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="w-3.5 h-3.5 text-[#3D6B47]" />
          <span className="text-xs font-medium text-foreground">{label}</span>
        </div>
        <span className="text-xs font-bold text-foreground tabular-nums">{value}</span>
      </div>
      <div
        className={`h-2 rounded-full overflow-hidden ${
          isDark ? "bg-white/08" : "bg-gray-100"
        }`}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#3D6B47] to-[#5A9A68] transition-all duration-500"
          style={{ width: `${Math.max(pct, 2)}%` }}
        />
      </div>
      {maxValue > 0 && (
        <p className="text-[10px] text-muted-foreground tabular-nums">
          {pct}% of page views
        </p>
      )}
    </div>
  );
}

// ─── Timeline Bar ────────────────────────────────────────────────────────────

function TimelineChart({
  timeline,
  isDark,
}: {
  timeline: AnalyticsData["timeline"];
  isDark: boolean;
}) {
  if (!timeline.length) {
    return (
      <div
        className={`text-center py-8 text-sm text-muted-foreground ${
          isDark ? "bg-white/03" : "bg-gray-50"
        } rounded-xl`}
      >
        No timeline data yet
      </div>
    );
  }

  const maxVal = Math.max(
    ...timeline.map((d) => d.views + d.interactions),
    1
  );

  return (
    <div className="space-y-2">
      {timeline.map((day) => {
        const total = day.views + day.interactions;
        return (
          <div key={day.date} className="flex items-center gap-2 sm:gap-3">
            <span className="text-[10px] font-mono text-muted-foreground w-16 sm:w-20 flex-shrink-0">
              {day.date}
            </span>
            <div className="flex-1 flex items-center gap-0.5">
              <div
                className={`h-5 rounded-md overflow-hidden flex ${
                  isDark ? "bg-white/05" : "bg-gray-50"
                }`}
                style={{ width: "100%" }}
              >
                <div
                  className="h-full bg-[#3D6B47]/70 transition-all duration-300"
                  style={{
                    width: `${
                      maxVal > 0
                        ? Math.max((day.views / maxVal) * 100, 1)
                        : 0
                    }%`,
                  }}
                  title={`${day.views} views`}
                />
                <div
                  className="h-full bg-[#5A9A68] transition-all duration-300"
                  style={{
                    width: `${
                      maxVal > 0
                        ? Math.max((day.interactions / maxVal) * 100, 0)
                        : 0
                    }%`,
                  }}
                  title={`${day.interactions} interactions`}
                />
              </div>
            </div>
            <span className="text-[10px] font-mono text-muted-foreground w-7 text-right flex-shrink-0 tabular-nums">
              {total}
            </span>
          </div>
        );
      })}
      <div className="flex items-center gap-4 pt-2">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-[#3D6B47]/70" />
          <span className="text-[10px] text-muted-foreground">Views</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-[#5A9A68]" />
          <span className="text-[10px] text-muted-foreground">
            Interactions
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Recommendation Card ─────────────────────────────────────────────────────

function RecommendationCard({
  title,
  description,
  isDark,
}: {
  title: string;
  description: string;
  isDark: boolean;
}) {
  return (
    <div
      className={`flex items-start gap-3 p-4 rounded-xl ${
        isDark
          ? "bg-amber-500/05 border border-amber-500/15"
          : "bg-amber-50 border border-amber-200/50"
      }`}
    >
      <Lightbulb className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
    </div>
  );
}

// ─── Collapsible Section ─────────────────────────────────────────────────────

function Section({
  title,
  icon: Icon,
  children,
  isDark,
  defaultOpen = true,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  isDark: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div
      className={`rounded-2xl border overflow-hidden ${
        isDark
          ? "border-white/10 bg-[oklch(0.22_0.06_145)]"
          : "border-[#EEEED2] bg-white"
      }`}
    >
      <button
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 transition-colors ${
          isDark ? "hover:bg-white/03" : "hover:bg-gray-50"
        }`}
      >
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-[#3D6B47]" />
          <h2 className="text-sm font-bold text-foreground">{title}</h2>
        </div>
        {open ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>
      {open && (
        <div
          className={`px-4 sm:px-5 pb-4 sm:pb-5 border-t ${
            isDark ? "border-white/08" : "border-[#EEEED2]"
          }`}
        >
          <div className="pt-4">{children}</div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function TournamentAnalytics() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isDark =
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("dark");

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetch(`/api/tournament/${id}/analytics`, { credentials: "include" })
      .then((r) => {
        if (!r.ok)
          throw new Error(
            r.status === 403
              ? "Not authorized — only the tournament organizer can view analytics."
              : "Failed to load analytics"
          );
        return r.json();
      })
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [id]);

  // Generate recommendations based on data
  const recommendations = useMemo(() => {
    if (!data) return [];
    const recs: { title: string; description: string }[] = [];

    if (data.overview.totalViews === 0) {
      recs.push({
        title: "Enable Public Mode",
        description:
          "Your tournament has no public page views yet. Enable Public Mode in the Director Console to share a live dashboard with attendees via QR code.",
      });
    } else if (data.overview.engagementRate < 20) {
      recs.push({
        title: "Boost Engagement",
        description:
          "Your engagement rate is below 20%. Consider announcing the public page URL during the tournament and encouraging players to follow their games.",
      });
    }

    if (data.funnel.views > 10 && data.funnel.follows === 0) {
      recs.push({
        title: "Encourage Player Following",
        description:
          "Visitors are viewing but not following players. Add a brief announcement explaining the Follow feature so attendees can track specific players.",
      });
    }

    if (data.funnel.views > 20 && data.funnel.emailCaptures === 0) {
      recs.push({
        title: "Promote Email Capture",
        description:
          "No emails captured yet. The post-event email form appears after the tournament ends — consider mentioning it during the closing ceremony.",
      });
    }

    if (data.attendance.registered > 0 && data.attendance.registered < 16) {
      recs.push({
        title: "Grow Your Tournament",
        description: `Your tournament had ${data.attendance.registered} players. Consider promoting through your club page, social media, and local chess communities to reach 20+ players.`,
      });
    }

    if (data.attendance.registered >= 30) {
      recs.push({
        title: "Great Turnout!",
        description: `${data.attendance.registered} players is excellent. Consider running a recurring monthly event to build a loyal community.`,
      });
    }

    if (
      data.operationalQuality.completionRate > 0 &&
      data.operationalQuality.completionRate < 100
    ) {
      recs.push({
        title: "Complete All Results",
        description: `${data.operationalQuality.completionRate}% of games have results reported. Ensure all boards report their results for complete standings.`,
      });
    }

    if (data.retentionSignals.searchToFollowRate > 50) {
      recs.push({
        title: "Strong Search-to-Follow Rate",
        description: `${data.retentionSignals.searchToFollowRate}% of searches lead to follows — your attendees are highly engaged with the Follow feature.`,
      });
    }

    if (data.attendanceBreakdown && data.attendanceBreakdown.noShowRate > 20) {
      recs.push({
        title: "Reduce No-Shows",
        description: `${data.attendanceBreakdown.noShowRate}% of registered players didn't appear in any game. Consider sending a reminder the day before and confirming attendance.`,
      });
    }

    if (data.repeatEventGrowth && data.repeatEventGrowth.repeatRate > 30) {
      recs.push({
        title: "Strong Returning Player Base",
        description: `${data.repeatEventGrowth.repeatRate}% of players have attended a previous event. These loyal regulars are the foundation of a thriving club — reward them with recognition.`,
      });
    }

    if (recs.length === 0) {
      recs.push({
        title: "Looking Good",
        description:
          "Your tournament metrics are healthy. Keep running events and the analytics will provide deeper insights over time.",
      });
    }

    return recs;
  }, [data]);

  // ─── Loading State ─────────────────────────────────────────────────────────

  if (loading) {
    const shimmer = isDark ? "bg-white/08" : "bg-gray-200";
    return (
      <div
        className={`min-h-screen ${
          isDark ? "bg-[oklch(0.20_0.06_145)]" : "bg-[#F5F5DC]/30"
        }`}
      >
        <nav
          className={`sticky top-0 z-50 border-b backdrop-blur-xl otb-header-safe ${
            isDark
              ? "bg-[oklch(0.20_0.06_145)]/80 border-white/10"
              : "bg-white/80 border-[#EEEED2]"
          }`}
        >
          <div className="container max-w-4xl mx-auto px-4 h-14 flex items-center">
            <NavLogo />
          </div>
        </nav>
        <div className="container max-w-4xl mx-auto px-4 py-8 space-y-6">
          <div className={`h-8 w-64 rounded-lg ${shimmer} animate-pulse`} />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={`h-28 rounded-2xl ${shimmer} animate-pulse`}
              />
            ))}
          </div>
          <div className={`h-48 rounded-2xl ${shimmer} animate-pulse`} />
          <div className={`h-48 rounded-2xl ${shimmer} animate-pulse`} />
        </div>
      </div>
    );
  }

  // ─── Error State ───────────────────────────────────────────────────────────

  if (error || !data) {
    return (
      <div
        className={`min-h-screen flex items-center justify-center ${
          isDark ? "bg-[oklch(0.20_0.06_145)]" : "bg-white"
        }`}
      >
        <div className="text-center max-w-md px-6">
          <div
            className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 ${
              isDark ? "bg-red-500/10" : "bg-red-50"
            }`}
          >
            <BarChart3 className="w-8 h-8 text-red-400" />
          </div>
          <h2
            className="text-xl font-bold text-foreground mb-2"
            style={{ fontFamily: "'Clash Display', sans-serif" }}
          >
            Analytics Unavailable
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            {error || "Could not load analytics data."}
          </p>
          <Link
            href={`/tournament/${id}/manage`}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#3D6B47] text-white text-sm font-semibold hover:bg-[#2A4A32] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Director
          </Link>
        </div>
      </div>
    );
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className={`min-h-screen ${
        isDark ? "bg-[oklch(0.20_0.06_145)]" : "bg-[#F5F5DC]/30"
      }`}
    >
      {/* Nav */}
      <nav
        className={`sticky top-0 z-50 border-b backdrop-blur-xl otb-header-safe ${
          isDark
            ? "bg-[oklch(0.20_0.06_145)]/80 border-white/10"
            : "bg-white/80 border-[#EEEED2]"
        }`}
      >
        <div className="container max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <NavLogo />
          <ThemeToggle />
        </div>
      </nav>

      <main className="container max-w-4xl mx-auto px-4 py-5 sm:py-6 space-y-4 sm:space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <Link
              href={`/tournament/${id}/manage`}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2"
            >
              <ArrowLeft className="w-3 h-3" />
              Back to Director Console
            </Link>
            <h1
              className="text-xl sm:text-2xl font-bold text-foreground"
              style={{ fontFamily: "'Clash Display', sans-serif" }}
            >
              Tournament Analytics
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Insights and metrics for your tournament
            </p>
          </div>
          <div
            className={`w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${
              isDark ? "bg-[#3D6B47]/20" : "bg-[#3D6B47]/10"
            }`}
          >
            <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6 text-[#3D6B47]" />
          </div>
        </div>

        {/* Overview Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
          <MetricCard
            icon={Eye}
            label="Page Views"
            value={data.overview.totalViews}
            subtitle={`${data.overview.uniqueVisitors} unique visitors`}
            isDark={isDark}
            accent
          />
          <MetricCard
            icon={MousePointerClick}
            label="Interactions"
            value={data.overview.totalInteractions}
            subtitle={`${data.overview.engagementRate}% engagement`}
            isDark={isDark}
          />
          <MetricCard
            icon={Users}
            label="Players"
            value={data.attendance.registered}
            subtitle={`${data.attendance.gamesPlayed} games played`}
            isDark={isDark}
          />
          <MetricCard
            icon={Trophy}
            label="Rounds"
            value={`${data.attendance.currentRound}/${data.attendance.totalRounds}`}
            subtitle={
              data.attendance.currentRound >= data.attendance.totalRounds
                ? "Tournament complete"
                : "In progress"
            }
            isDark={isDark}
          />
        </div>

        {/* Conversion Funnel */}
        <Section title="Conversion Funnel" icon={Target} isDark={isDark}>
          <div className="space-y-4">
            <FunnelStep
              label="Page Views"
              value={data.funnel.views}
              maxValue={data.funnel.views}
              isDark={isDark}
              icon={Eye}
            />
            <FunnelStep
              label="Player Searches"
              value={data.funnel.searches}
              maxValue={data.funnel.views}
              isDark={isDark}
              icon={Search}
            />
            <FunnelStep
              label="Player Follows"
              value={data.funnel.follows}
              maxValue={data.funnel.views}
              isDark={isDark}
              icon={Heart}
            />
            <FunnelStep
              label="Email Captures"
              value={data.funnel.emailCaptures}
              maxValue={data.funnel.views}
              isDark={isDark}
              icon={Mail}
            />
            <FunnelStep
              label="CTA Clicks"
              value={data.funnel.ctaClicks}
              maxValue={data.funnel.views}
              isDark={isDark}
              icon={MousePointerClick}
            />
          </div>

          {/* CTA Breakdown */}
          {Object.keys(data.ctaBreakdown).length > 0 && (
            <div className="mt-4 pt-4 border-t border-border/30">
              <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
                CTA Breakdown
              </p>
              <div className="space-y-1.5">
                {Object.entries(data.ctaBreakdown).map(([cta, count]) => (
                  <div
                    key={cta}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="text-foreground capitalize">
                      {cta.replace(/_/g, " ")}
                    </span>
                    <span className="font-mono font-bold text-foreground tabular-nums">
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Section>

        {/* Attendance Breakdown */}
        {data.attendanceBreakdown && (
          <Section title="Attendance Breakdown" icon={CalendarCheck} isDark={isDark}>
            <div className="space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                <SmallStat label="Final Field" value={data.attendanceBreakdown.finalField} isDark={isDark} />
                <SmallStat label="Pre-Registered" value={data.attendanceBreakdown.preRegistered} isDark={isDark} />
                <SmallStat label="Walk-Ins" value={data.attendanceBreakdown.walkIns} isDark={isDark} />
                <SmallStat label="No-Shows" value={data.attendanceBreakdown.noShows} isDark={isDark} />
              </div>
              {data.attendanceBreakdown.finalField > 0 && (
                <div className="space-y-3">
                  <ProgressRow
                    label="Pre-Registered"
                    value={data.attendanceBreakdown.preRegistered}
                    total={data.attendanceBreakdown.finalField}
                    color="#3D6B47"
                    isDark={isDark}
                  />
                  <ProgressRow
                    label="Walk-Ins / Late Adds"
                    value={data.attendanceBreakdown.walkIns}
                    total={data.attendanceBreakdown.finalField}
                    color="#5A9A68"
                    isDark={isDark}
                  />
                  {data.attendanceBreakdown.noShows > 0 && (
                    <ProgressRow
                      label="No-Shows"
                      value={data.attendanceBreakdown.noShows}
                      total={data.attendanceBreakdown.finalField + data.attendanceBreakdown.noShows}
                      color="#EF4444"
                      isDark={isDark}
                    />
                  )}
                </div>
              )}
              <div className={`flex items-start gap-3 p-3 rounded-xl text-xs ${isDark ? "bg-white/03" : "bg-gray-50"}`}>
                <UserCheck className="w-3.5 h-3.5 text-[#3D6B47] flex-shrink-0 mt-0.5" />
                <p className="text-muted-foreground">
                  {data.attendanceBreakdown.walkInRate}% of players registered on the day.
                  Walk-in rate above 30% suggests strong word-of-mouth but may strain pairing capacity — consider capping early.
                </p>
              </div>
            </div>
          </Section>
        )}

        {/* Player Retention (Repeat-Event Growth) */}
        {data.repeatEventGrowth && (
          <Section title="Player Retention" icon={Repeat2} isDark={isDark}>
            <div className="space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                <SmallStat label="New Players" value={data.repeatEventGrowth.newPlayers} isDark={isDark} />
                <SmallStat label="Returning" value={data.repeatEventGrowth.returningPlayers} isDark={isDark} />
                <SmallStat label="Repeat Rate" value={data.repeatEventGrowth.repeatRate} suffix="%" isDark={isDark} />
                <SmallStat label="Multi-Event" value={data.repeatEventGrowth.multiEventPlayers} isDark={isDark} />
              </div>
              {(data.repeatEventGrowth.newPlayers + data.repeatEventGrowth.returningPlayers) > 0 && (
                <div className="space-y-3">
                  <ProgressRow
                    label="New Players"
                    value={data.repeatEventGrowth.newPlayers}
                    total={data.repeatEventGrowth.newPlayers + data.repeatEventGrowth.returningPlayers}
                    color="#5A9A68"
                    isDark={isDark}
                  />
                  <ProgressRow
                    label="Returning Players"
                    value={data.repeatEventGrowth.returningPlayers}
                    total={data.repeatEventGrowth.newPlayers + data.repeatEventGrowth.returningPlayers}
                    color="#3D6B47"
                    isDark={isDark}
                  />
                </div>
              )}
              <div className={`flex items-start gap-3 p-3 rounded-xl text-xs ${isDark ? "bg-white/03" : "bg-gray-50"}`}>
                <UserPlus className="w-3.5 h-3.5 text-[#3D6B47] flex-shrink-0 mt-0.5" />
                <p className="text-muted-foreground">
                  {data.repeatEventGrowth.returningPlayers > 0
                    ? `${data.repeatEventGrowth.returningPlayers} player${data.repeatEventGrowth.returningPlayers !== 1 ? "s" : ""} have attended a previous event by this organizer. Retention is the strongest signal of a healthy tournament series.`
                    : "This appears to be your first event or player names haven't been matched across events yet. Repeat-rate tracking improves as you run more tournaments."}
                </p>
              </div>
            </div>
          </Section>
        )}

        {/* Post-Event Conversion */}
        {data.postEventConversion && (
          <Section title="Post-Event Conversion" icon={UserPlus} isDark={isDark}>
            <div className="space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                <SmallStat label="Emails Opted In" value={data.postEventConversion.emailsOptedIn} isDark={isDark} />
                <SmallStat label="Cards Claimed" value={data.postEventConversion.cardsClaimed} isDark={isDark} />
                <SmallStat label="Club Join Clicks" value={data.postEventConversion.joinClubClicks} isDark={isDark} />
                <SmallStat label="Account Clicks" value={data.postEventConversion.createAccountClicks} isDark={isDark} />
                <SmallStat label="Anon → Lead Rate" value={data.postEventConversion.anonToLeadRate} suffix="%" isDark={isDark} />
                <SmallStat label="Email Capture Rate" value={data.postEventConversion.emailCaptureRate} suffix="%" isDark={isDark} />
              </div>
              {data.overview.totalViews > 0 && (
                <div className="space-y-3">
                  <ProgressRow label="Email Opt-In" value={data.postEventConversion.emailsOptedIn} total={data.overview.totalViews} color="#3D6B47" isDark={isDark} />
                  <ProgressRow label="Card Claims" value={data.postEventConversion.cardsClaimed} total={data.overview.totalViews} color="#5A9A68" isDark={isDark} />
                  <ProgressRow label="Club Join Clicks" value={data.postEventConversion.joinClubClicks} total={data.overview.totalViews} color="#8BC4A0" isDark={isDark} />
                </div>
              )}
            </div>
          </Section>
        )}

        {/* Club Growth Contribution */}
        {data.clubGrowth && (
          <Section title="Club Growth Contribution" icon={Sprout} isDark={isDark}>
            <div className="space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                <MetricCard
                  icon={Users}
                  label="Total Leads"
                  value={data.clubGrowth.totalLeadsGenerated}
                  subtitle="emails + card claims"
                  isDark={isDark}
                  accent
                />
                <SmallStat label="Email Leads" value={data.clubGrowth.emailLeads} isDark={isDark} />
                <SmallStat label="Card Claim Leads" value={data.clubGrowth.cardClaimLeads} isDark={isDark} />
                <SmallStat label="Club Join Clicks" value={data.clubGrowth.clubJoinClicks} isDark={isDark} />
                <SmallStat label="Account Clicks" value={data.clubGrowth.createAccountClicks} isDark={isDark} />
                <SmallStat label="Lead Conv. Rate" value={data.clubGrowth.leadConversionRate} suffix="%" isDark={isDark} />
              </div>
              <div className={`flex items-start gap-3 p-3 rounded-xl text-xs ${isDark ? "bg-[#3D6B47]/08 border border-[#3D6B47]/15" : "bg-[#F0F8F2] border border-[#3D6B47]/15"}`}>
                <Sprout className="w-3.5 h-3.5 text-[#3D6B47] flex-shrink-0 mt-0.5" />
                <p className="text-muted-foreground">
                  This tournament contributed{" "}
                  <span className="font-semibold text-foreground">
                    {data.clubGrowth.totalLeadsGenerated} lead{data.clubGrowth.totalLeadsGenerated !== 1 ? "s" : ""}
                  </span>{" "}
                  to your club pipeline. Each lead represents a real person who engaged with your brand — follow up within 48 hours for best conversion results.
                </p>
              </div>
            </div>
          </Section>
        )}

        {/* Tournament Comparison */}
        {data.tournamentComparison && data.tournamentComparison.pastEvents.length > 0 && (
          <Section title="Tournament Comparison" icon={GitCompare} isDark={isDark} defaultOpen={false}>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <SmallStat label="Avg Attendance (past)" value={data.tournamentComparison.avgAttendance} isDark={isDark} />
                <SmallStat label="This Event Rank" value={`#${data.tournamentComparison.thisEventRank}`} isDark={isDark} />
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recent Events</p>
                {data.tournamentComparison.pastEvents.map((evt) => {
                  const maxCount = Math.max(
                    ...data.tournamentComparison!.pastEvents.map((e) => e.playerCount),
                    data.attendance.registered,
                    1
                  );
                  const pct = Math.round((evt.playerCount / maxCount) * 100);
                  return (
                    <div key={evt.id} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-foreground font-medium truncate max-w-[60%]">{evt.name}</span>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {evt.date && <span className="text-muted-foreground font-mono text-[10px]">{evt.date}</span>}
                          <span className="font-mono font-bold text-foreground tabular-nums">{evt.playerCount}p</span>
                        </div>
                      </div>
                      <div className={`h-1.5 rounded-full overflow-hidden ${isDark ? "bg-white/08" : "bg-gray-100"}`}>
                        <div className="h-full rounded-full bg-[#3D6B47]/50 transition-all duration-500" style={{ width: `${Math.max(pct, 2)}%` }} />
                      </div>
                    </div>
                  );
                })}
                <div className="space-y-1 mt-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#3D6B47] font-semibold">This Event</span>
                    <span className="font-mono font-bold text-[#3D6B47] tabular-nums">{data.attendance.registered}p</span>
                  </div>
                  <div className={`h-1.5 rounded-full overflow-hidden ${isDark ? "bg-white/08" : "bg-gray-100"}`}>
                    <div
                      className="h-full rounded-full bg-[#3D6B47] transition-all duration-500"
                      style={{
                        width: `${Math.max(Math.round((data.attendance.registered / Math.max(
                          ...data.tournamentComparison.pastEvents.map((e) => e.playerCount),
                          data.attendance.registered, 1
                        )) * 100), 2)}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </Section>
        )}

        {/* Retention Signals */}
        <Section title="Retention Signals" icon={TrendingUp} isDark={isDark}>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
            <SmallStat
              label="Net Follows"
              value={data.retentionSignals.netFollows}
              isDark={isDark}
            />
            <SmallStat
              label="Card Claims"
              value={data.retentionSignals.cardClaims}
              isDark={isDark}
            />
            <SmallStat
              label="Email Conversion"
              value={data.retentionSignals.emailConversionRate}
              suffix="%"
              isDark={isDark}
            />
            <SmallStat
              label="CTA Conversion"
              value={data.retentionSignals.ctaConversionRate}
              suffix="%"
              isDark={isDark}
            />
            <SmallStat
              label="Search to Follow"
              value={data.retentionSignals.searchToFollowRate}
              suffix="%"
              isDark={isDark}
            />
          </div>
        </Section>

        {/* Operational Quality */}
        <Section title="Operational Quality" icon={Activity} isDark={isDark}>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
            <SmallStat
              label="Result Completion"
              value={data.operationalQuality.completionRate}
              suffix="%"
              isDark={isDark}
            />
            <SmallStat
              label="Rounds Completed"
              value={data.operationalQuality.roundsCompleted}
              isDark={isDark}
            />
            <SmallStat
              label="Avg Games / Round"
              value={data.operationalQuality.avgGamesPerRound}
              isDark={isDark}
            />
            <SmallStat
              label="Total Games"
              value={data.operationalQuality.totalGamesExpected}
              isDark={isDark}
            />
            <SmallStat
              label="Byes Given"
              value={data.operationalQuality.byeCount}
              isDark={isDark}
            />
          </div>
        </Section>

        {/* Activity Timeline */}
        <Section title="Activity Timeline" icon={Clock} isDark={isDark}>
          <TimelineChart timeline={data.timeline} isDark={isDark} />
        </Section>

        {/* Top Searches */}
        {data.topSearches.length > 0 && (
          <Section
            title="Top Player Searches"
            icon={Search}
            isDark={isDark}
            defaultOpen={false}
          >
            <div className="space-y-1.5">
              {data.topSearches.map((item, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs ${
                    isDark ? "bg-white/03" : "bg-gray-50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        i < 3
                          ? "bg-[#3D6B47]/15 text-[#3D6B47]"
                          : isDark
                          ? "bg-white/08 text-muted-foreground"
                          : "bg-gray-100 text-muted-foreground"
                      }`}
                    >
                      {i + 1}
                    </span>
                    <span className="text-foreground font-medium">
                      {item.name}
                    </span>
                  </div>
                  <span className="font-mono font-bold text-muted-foreground tabular-nums">
                    {item.count}x
                  </span>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Email Captures */}
        {data.emailsCaptured.length > 0 && (
          <Section
            title="Captured Emails"
            icon={Mail}
            isDark={isDark}
            defaultOpen={false}
          >
            <div className="space-y-1">
              {data.emailsCaptured.map((email, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${
                    isDark ? "bg-white/03" : "bg-gray-50"
                  }`}
                >
                  <Mail className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                  <span className="text-foreground font-mono truncate">
                    {email}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-3">
              {data.emailsCaptured.length} email
              {data.emailsCaptured.length !== 1 ? "s" : ""} captured from the
              post-event form
            </p>
          </Section>
        )}

        {/* Recommendations */}
        <Section title="Recommendations" icon={Lightbulb} isDark={isDark}>
          <div className="space-y-3">
            {recommendations.map((rec, i) => (
              <RecommendationCard
                key={i}
                title={rec.title}
                description={rec.description}
                isDark={isDark}
              />
            ))}
          </div>
        </Section>

        {/* Footer */}
        <footer className="text-center py-6 sm:py-8 border-t border-border/30">
          <p className="text-xs text-muted-foreground">
            Analytics powered by{" "}
            <a
              href="https://chessotb.club"
              className="text-[#3D6B47] hover:underline font-medium"
            >
              ChessOTB
            </a>
          </p>
        </footer>
      </main>
    </div>
  );
}
