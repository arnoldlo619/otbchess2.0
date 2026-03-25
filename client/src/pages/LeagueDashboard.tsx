/**
 * League Dashboard — /leagues/:leagueId
 *
 * Tabs: Overview · Matchups · Standings · Schedule
 */
import { useState, useEffect, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuthContext } from "@/context/AuthContext";
import {
  Trophy, Users, Calendar, ChevronRight, ArrowLeft,
  Crown, Swords, BarChart3, ListOrdered, CheckCircle2,
  Clock, Circle, Shield, Star
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface LeaguePlayer {
  id: number;
  leagueId: string;
  playerId: string;
  displayName: string;
  avatarUrl?: string | null;
  chesscomUsername?: string | null;
  rating?: number | null;
}

interface LeagueMatch {
  id: number;
  leagueId: string;
  weekId: number;
  weekNumber: number;
  playerWhiteId: string;
  playerWhiteName: string;
  playerBlackId: string;
  playerBlackName: string;
  resultStatus: "pending" | "completed";
  result?: "white_win" | "black_win" | "draw" | null;
  reportedByUserId?: string | null;
  completedAt?: string | null;
}

interface LeagueWeek {
  id: number;
  leagueId: string;
  weekNumber: number;
  publishedAt?: string | null;
  isComplete: number;
  matches: LeagueMatch[];
}

interface LeagueStanding {
  id: number;
  leagueId: string;
  playerId: string;
  displayName: string;
  avatarUrl?: string | null;
  wins: number;
  losses: number;
  draws: number;
  points: number;
  rank: number;
}

interface League {
  id: string;
  clubId: string;
  name: string;
  description?: string | null;
  commissionerId: string;
  commissionerName: string;
  formatType: string;
  maxPlayers: number;
  currentWeek: number;
  totalWeeks: number;
  status: "draft" | "active" | "completed";
  createdAt: string;
  players: LeaguePlayer[];
}

// ── Result Report Modal ───────────────────────────────────────────────────────
function ReportResultModal({
  match,
  isDark,
  onClose,
  onSubmit,
}: {
  match: LeagueMatch;
  isDark: boolean;
  onClose: () => void;
  onSubmit: (result: "white_win" | "black_win" | "draw") => Promise<void>;
}) {
  const [selected, setSelected] = useState<"white_win" | "black_win" | "draw" | null>(null);
  const [loading, setLoading] = useState(false);

  const bg = isDark ? "oklch(0.18 0.05 145)" : "#ffffff";
  const overlay = isDark ? "rgba(0,0,0,0.7)" : "rgba(0,0,0,0.4)";
  const border = isDark ? "oklch(0.30 0.07 145)" : "#e5e7eb";
  const textMain = isDark ? "#f0f5ee" : "#111827";
  const textMuted = isDark ? "oklch(0.65 0.04 145)" : "#6b7280";
  const accent = "oklch(0.55 0.13 145)";

  const options: { value: "white_win" | "black_win" | "draw"; label: string; sub: string }[] = [
    { value: "white_win", label: `${match.playerWhiteName} wins`, sub: "White wins" },
    { value: "black_win", label: `${match.playerBlackName} wins`, sub: "Black wins" },
    { value: "draw", label: "Draw", sub: "½ point each" },
  ];

  async function handleSubmit() {
    if (!selected) return;
    setLoading(true);
    try {
      await onSubmit(selected);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: overlay }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-6 shadow-2xl"
        style={{ background: bg, border: `1px solid ${border}` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-1">
          <Swords size={18} style={{ color: accent }} />
          <span className="font-semibold text-base" style={{ color: textMain }}>Report Result</span>
        </div>
        <p className="text-sm mb-5" style={{ color: textMuted }}>
          {match.playerWhiteName} (White) vs {match.playerBlackName} (Black)
        </p>

        <div className="space-y-2 mb-6">
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSelected(opt.value)}
              className="w-full flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-all"
              style={{
                background: selected === opt.value
                  ? `oklch(0.55 0.13 145 / 0.15)`
                  : isDark ? "oklch(0.22 0.06 145)" : "#f9fafb",
                border: `1.5px solid ${selected === opt.value ? accent : border}`,
              }}
            >
              <div
                className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                style={{
                  borderColor: selected === opt.value ? accent : border,
                  background: selected === opt.value ? accent : "transparent",
                }}
              >
                {selected === opt.value && <div className="w-2 h-2 rounded-full bg-white" />}
              </div>
              <div>
                <div className="font-medium text-sm" style={{ color: textMain }}>{opt.label}</div>
                <div className="text-xs" style={{ color: textMuted }}>{opt.sub}</div>
              </div>
            </button>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-opacity hover:opacity-70"
            style={{ background: isDark ? "oklch(0.25 0.06 145)" : "#f3f4f6", color: textMuted }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!selected || loading}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
            style={{ background: accent, color: "#fff" }}
          >
            {loading ? "Saving…" : "Confirm Result"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function LeagueDashboard() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const [, navigate] = useLocation();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const { user } = useAuthContext();

  const [league, setLeague] = useState<League | null>(null);
  const [weeks, setWeeks] = useState<LeagueWeek[]>([]);
  const [standings, setStandings] = useState<LeagueStanding[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "matchups" | "standings" | "schedule">("overview");
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [reportingMatch, setReportingMatch] = useState<LeagueMatch | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  // ── Design tokens ──────────────────────────────────────────────────────────
  const pageBg = isDark ? "oklch(0.17 0.05 145)" : "oklch(0.97 0.01 145)";
  const cardBg = isDark ? "oklch(0.21 0.06 145)" : "#ffffff";
  const cardBorder = isDark ? "oklch(0.28 0.07 145)" : "#e5e7eb";
  const textMain = isDark ? "#f0f5ee" : "#111827";
  const textMuted = isDark ? "oklch(0.65 0.04 145)" : "#6b7280";
  const accent = "oklch(0.55 0.13 145)";
  const tabBg = isDark ? "oklch(0.23 0.06 145)" : "#f3f4f6";
  const tabActive = isDark ? "oklch(0.28 0.08 145)" : "#ffffff";

  // ── Fetch data ─────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    if (!leagueId) return;
    try {
      const [leagueRes, weeksRes, standingsRes] = await Promise.all([
        fetch(`/api/leagues/${leagueId}`),
        fetch(`/api/leagues/${leagueId}/weeks`),
        fetch(`/api/leagues/${leagueId}/standings`),
      ]);
      if (leagueRes.ok) setLeague(await leagueRes.json());
      if (weeksRes.ok) setWeeks(await weeksRes.json());
      if (standingsRes.ok) setStandings(await standingsRes.json());
    } catch (err) {
      console.error("[LeagueDashboard] fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [leagueId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Show toast ─────────────────────────────────────────────────────────────
  function showToast(msg: string, type: "success" | "error" = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  // ── Report result ──────────────────────────────────────────────────────────
  async function handleReportResult(result: "white_win" | "black_win" | "draw") {
    if (!reportingMatch || !leagueId) return;
    const res = await fetch(`/api/leagues/${leagueId}/matches/${reportingMatch.id}/result`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ result }),
    });
    if (res.ok) {
      showToast("Result recorded!");
      setReportingMatch(null);
      await fetchAll();
    } else {
      const data = await res.json().catch(() => ({}));
      showToast(data.error ?? "Failed to record result", "error");
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  function resultLabel(match: LeagueMatch) {
    if (match.resultStatus !== "completed" || !match.result) return null;
    if (match.result === "white_win") return `${match.playerWhiteName} won`;
    if (match.result === "black_win") return `${match.playerBlackName} won`;
    return "Draw";
  }

  function canReport(match: LeagueMatch) {
    if (match.resultStatus === "completed") return false;
    if (!user) return false;
    const isPlayer = match.playerWhiteId === user.id || match.playerBlackId === user.id;
    const isCommissioner = league?.commissionerId === user.id;
    return isPlayer || isCommissioner;
  }

  const currentWeekMatches = weeks.find((w) => w.weekNumber === selectedWeek)?.matches ?? [];
  const completedMatches = weeks.flatMap((w) => w.matches).filter((m) => m.resultStatus === "completed").length;
  const totalMatches = weeks.flatMap((w) => w.matches).length;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: pageBg }}>
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: `${accent} transparent ${accent} ${accent}` }} />
      </div>
    );
  }

  if (!league) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: pageBg }}>
        <Trophy size={48} style={{ color: textMuted }} />
        <p style={{ color: textMuted }}>League not found</p>
        <button onClick={() => navigate("/clubs")} className="text-sm underline" style={{ color: accent }}>Back to Clubs</button>
      </div>
    );
  }

  const tabs = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "matchups", label: "Matchups", icon: Swords },
    { id: "standings", label: "Standings", icon: ListOrdered },
    { id: "schedule", label: "Schedule", icon: Calendar },
  ] as const;

  return (
    <div className="min-h-screen pb-16" style={{ background: pageBg }}>
      {/* Toast */}
      {toast && (
        <div
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl text-sm font-medium shadow-xl"
          style={{
            background: toast.type === "success" ? accent : "#ef4444",
            color: "#fff",
          }}
        >
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div
        className="sticky top-0 z-30 px-4 py-3 flex items-center gap-3"
        style={{
          background: isDark ? "oklch(0.17 0.05 145 / 0.95)" : "rgba(255,255,255,0.95)",
          backdropFilter: "blur(12px)",
          borderBottom: `1px solid ${cardBorder}`,
        }}
      >
        <button
          onClick={() => navigate(`/clubs/${league.clubId}`)}
          className="p-2 rounded-xl transition-opacity hover:opacity-70"
          style={{ background: isDark ? "oklch(0.23 0.06 145)" : "#f3f4f6" }}
        >
          <ArrowLeft size={16} style={{ color: textMain }} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-base truncate" style={{ color: textMain }}>{league.name}</h1>
          <p className="text-xs truncate" style={{ color: textMuted }}>
            {league.status === "active" ? `Week ${league.currentWeek} of ${league.totalWeeks}` : league.status === "completed" ? "Season Complete" : "Draft"}
          </p>
        </div>
        <div
          className="px-2.5 py-1 rounded-full text-xs font-semibold"
          style={{
            background: league.status === "active" ? `${accent}22` : league.status === "completed" ? "oklch(0.55 0.13 145 / 0.1)" : "oklch(0.5 0.02 145 / 0.1)",
            color: league.status === "active" ? accent : league.status === "completed" ? accent : textMuted,
          }}
        >
          {league.status === "active" ? "Active" : league.status === "completed" ? "Complete" : "Draft"}
        </div>
      </div>

      {/* Tab bar */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex gap-1 p-1 rounded-2xl" style={{ background: tabBg }}>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition-all"
                style={{
                  background: isActive ? tabActive : "transparent",
                  color: isActive ? textMain : textMuted,
                  boxShadow: isActive ? "0 1px 4px rgba(0,0,0,0.12)" : "none",
                }}
              >
                <Icon size={13} />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-4 space-y-4">
        {/* ── OVERVIEW TAB ─────────────────────────────────────────────────── */}
        {activeTab === "overview" && (
          <>
            {/* Commissioner / Join actions for draft leagues */}
            {league.status === "draft" && (
              <div className="rounded-2xl p-5 flex flex-col gap-3" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
                <div className="flex items-center gap-2 mb-1">
                  <Shield size={16} style={{ color: accent }} />
                  <span className="font-semibold text-sm" style={{ color: textMain }}>League Setup</span>
                </div>
                {user && league.commissionerId === user.id ? (
                  <>
                    <p className="text-xs" style={{ color: textMuted }}>Share the league with players. Once everyone has joined, start the season to generate the round-robin schedule.</p>
                    <button
                      onClick={async () => {
                        const res = await fetch(`/api/leagues/${leagueId}/start`, { method: "POST" });
                        if (res.ok) { showToast("Season started!"); fetchAll(); }
                        else { const d = await res.json().catch(() => ({})); showToast(d.error ?? "Failed to start season", "error"); }
                      }}
                      disabled={league.players.length < 2}
                      className="w-full py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 active:scale-[0.98]"
                      style={{ background: accent, color: "#fff" }}
                    >
                      {league.players.length < 2 ? `Need at least 2 players (${league.players.length} joined)` : `Start Season · ${league.players.length} Players`}
                    </button>
                  </>
                ) : user && !league.players.find((p) => p.playerId === user.id) ? (
                  <>
                    <p className="text-xs" style={{ color: textMuted }}>You have been invited to join this league. Click below to register as a player.</p>
                    <button
                      onClick={async () => {
                        const res = await fetch(`/api/leagues/${leagueId}/join`, { method: "POST" });
                        if (res.ok) { showToast("Joined league!"); fetchAll(); }
                        else { const d = await res.json().catch(() => ({})); showToast(d.error ?? "Failed to join", "error"); }
                      }}
                      className="w-full py-3 rounded-xl text-sm font-semibold transition-all active:scale-[0.98]"
                      style={{ background: accent, color: "#fff" }}
                    >
                      Join League
                    </button>
                  </>
                ) : (
                  <p className="text-xs" style={{ color: textMuted }}>Waiting for the commissioner to start the season…</p>
                )}
              </div>
            )}

            {/* Season progress */}
            <div className="rounded-2xl p-5" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
              <div className="flex items-center gap-2 mb-4">
                <Trophy size={16} style={{ color: accent }} />
                <span className="font-semibold text-sm" style={{ color: textMain }}>Season Progress</span>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-4">
                {[
                  { label: "Players", value: league.players.length, icon: Users },
                  { label: "Matches Done", value: `${completedMatches}/${totalMatches}`, icon: CheckCircle2 },
                  { label: "Current Week", value: `${league.currentWeek}/${league.totalWeeks}`, icon: Calendar },
                ].map((stat) => {
                  const Icon = stat.icon;
                  return (
                    <div key={stat.label} className="rounded-xl p-3 text-center" style={{ background: isDark ? "oklch(0.25 0.06 145)" : "#f9fafb" }}>
                      <Icon size={14} className="mx-auto mb-1" style={{ color: accent }} />
                      <div className="font-bold text-base" style={{ color: textMain }}>{stat.value}</div>
                      <div className="text-xs" style={{ color: textMuted }}>{stat.label}</div>
                    </div>
                  );
                })}
              </div>
              {/* Progress bar */}
              <div className="h-2 rounded-full overflow-hidden" style={{ background: isDark ? "oklch(0.25 0.06 145)" : "#e5e7eb" }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${totalMatches > 0 ? (completedMatches / totalMatches) * 100 : 0}%`, background: accent }}
                />
              </div>
              <p className="text-xs mt-1.5 text-right" style={{ color: textMuted }}>
                {totalMatches > 0 ? Math.round((completedMatches / totalMatches) * 100) : 0}% complete
              </p>
            </div>

            {/* Top 3 standings preview */}
            {standings.length > 0 && (
              <div className="rounded-2xl p-5" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Crown size={16} style={{ color: accent }} />
                    <span className="font-semibold text-sm" style={{ color: textMain }}>Leaderboard</span>
                  </div>
                  <button onClick={() => setActiveTab("standings")} className="text-xs flex items-center gap-1" style={{ color: accent }}>
                    Full standings <ChevronRight size={12} />
                  </button>
                </div>
                <div className="space-y-2">
                  {standings.slice(0, 3).map((s, i) => (
                    <div key={s.playerId} className="flex items-center gap-3 py-2">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                        style={{
                          background: i === 0 ? "#f59e0b22" : i === 1 ? "#9ca3af22" : "#cd7c2f22",
                          color: i === 0 ? "#f59e0b" : i === 1 ? "#9ca3af" : "#cd7c2f",
                        }}
                      >
                        {i + 1}
                      </div>
                      {s.avatarUrl ? (
                        <img src={s.avatarUrl} alt={s.displayName} className="w-8 h-8 rounded-full object-cover ring-1 ring-white/20" />
                      ) : (
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: isDark ? "oklch(0.28 0.07 145)" : "#e5e7eb", color: textMuted }}>
                          {s.displayName[0]?.toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate" style={{ color: textMain }}>{s.displayName}</div>
                        <div className="text-xs" style={{ color: textMuted }}>{s.wins}W {s.draws}D {s.losses}L</div>
                      </div>
                      <div className="font-bold text-base" style={{ color: accent }}>{s.points}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Players */}
            <div className="rounded-2xl p-5" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
              <div className="flex items-center gap-2 mb-4">
                <Users size={16} style={{ color: accent }} />
                <span className="font-semibold text-sm" style={{ color: textMain }}>Players ({league.players.length})</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {league.players.map((p) => (
                  <div key={p.playerId} className="flex items-center gap-2 rounded-xl p-2.5" style={{ background: isDark ? "oklch(0.25 0.06 145)" : "#f9fafb" }}>
                    {p.avatarUrl ? (
                      <img src={p.avatarUrl} alt={p.displayName} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: isDark ? "oklch(0.28 0.07 145)" : "#e5e7eb", color: textMuted }}>
                        {p.displayName[0]?.toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate" style={{ color: textMain }}>{p.displayName}</div>
                      {p.chesscomUsername && <div className="text-xs truncate" style={{ color: textMuted }}>@{p.chesscomUsername}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── MATCHUPS TAB ─────────────────────────────────────────────────── */}
        {activeTab === "matchups" && (
          <>
            {/* Week selector */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {weeks.map((w) => (
                <button
                  key={w.weekNumber}
                  onClick={() => setSelectedWeek(w.weekNumber)}
                  className="flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all"
                  style={{
                    background: selectedWeek === w.weekNumber ? accent : isDark ? "oklch(0.23 0.06 145)" : "#f3f4f6",
                    color: selectedWeek === w.weekNumber ? "#fff" : textMuted,
                  }}
                >
                  Week {w.weekNumber}
                  {w.isComplete ? " ✓" : ""}
                </button>
              ))}
            </div>

            {/* Matches for selected week */}
            <div className="space-y-3">
              {currentWeekMatches.length === 0 ? (
                <div className="rounded-2xl p-8 text-center" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
                  <Calendar size={32} className="mx-auto mb-2" style={{ color: textMuted }} />
                  <p style={{ color: textMuted }}>No matches this week</p>
                </div>
              ) : (
                currentWeekMatches.map((match) => {
                  const label = resultLabel(match);
                  const reportable = canReport(match);
                  return (
                    <div
                      key={match.id}
                      className="rounded-2xl p-4"
                      style={{ background: cardBg, border: `1px solid ${match.resultStatus === "completed" ? `${accent}44` : cardBorder}` }}
                    >
                      <div className="flex items-center gap-3">
                        {/* White player */}
                        <div className="flex-1 flex items-center gap-2 min-w-0">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: "#ffffff", border: `1px solid ${cardBorder}`, color: "#111" }}>
                            {match.playerWhiteName[0]?.toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate" style={{ color: textMain }}>{match.playerWhiteName}</div>
                            <div className="text-xs" style={{ color: textMuted }}>White</div>
                          </div>
                        </div>

                        {/* VS / result */}
                        <div className="flex flex-col items-center flex-shrink-0">
                          {match.resultStatus === "completed" ? (
                            <CheckCircle2 size={18} style={{ color: accent }} />
                          ) : (
                            <span className="text-xs font-bold" style={{ color: textMuted }}>VS</span>
                          )}
                        </div>

                        {/* Black player */}
                        <div className="flex-1 flex items-center gap-2 min-w-0 flex-row-reverse">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: isDark ? "#1a1a1a" : "#374151", color: "#fff" }}>
                            {match.playerBlackName[0]?.toUpperCase()}
                          </div>
                          <div className="min-w-0 text-right">
                            <div className="text-sm font-medium truncate" style={{ color: textMain }}>{match.playerBlackName}</div>
                            <div className="text-xs" style={{ color: textMuted }}>Black</div>
                          </div>
                        </div>
                      </div>

                      {/* Result / Report button */}
                      <div className="mt-3 flex items-center justify-between">
                        {label ? (
                          <span className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ background: `${accent}22`, color: accent }}>
                            {label}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs" style={{ color: textMuted }}>
                            <Clock size={12} /> Pending
                          </span>
                        )}
                        {reportable && (
                          <button
                            onClick={() => setReportingMatch(match)}
                            className="text-xs font-semibold px-3 py-1.5 rounded-xl transition-all active:scale-95"
                            style={{ background: accent, color: "#fff" }}
                          >
                            Report Result
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}

        {/* ── STANDINGS TAB ─────────────────────────────────────────────────── */}
        {activeTab === "standings" && (
          <div className="rounded-2xl overflow-hidden" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
            {/* Header row */}
            <div className="grid grid-cols-[2rem_1fr_repeat(4,3rem)] gap-2 px-4 py-3 text-xs font-semibold" style={{ color: textMuted, borderBottom: `1px solid ${cardBorder}` }}>
              <span>#</span>
              <span>Player</span>
              <span className="text-center">W</span>
              <span className="text-center">D</span>
              <span className="text-center">L</span>
              <span className="text-center">Pts</span>
            </div>
            {standings.length === 0 ? (
              <div className="py-12 text-center" style={{ color: textMuted }}>No standings yet</div>
            ) : (
              standings.map((s, i) => (
                <div
                  key={s.playerId}
                  className="grid grid-cols-[2rem_1fr_repeat(4,3rem)] gap-2 items-center px-4 py-3"
                  style={{ borderBottom: i < standings.length - 1 ? `1px solid ${cardBorder}` : "none" }}
                >
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{
                      background: i === 0 ? "#f59e0b22" : i === 1 ? "#9ca3af22" : i === 2 ? "#cd7c2f22" : "transparent",
                      color: i === 0 ? "#f59e0b" : i === 1 ? "#9ca3af" : i === 2 ? "#cd7c2f" : textMuted,
                    }}
                  >
                    {i + 1}
                  </div>
                  <div className="flex items-center gap-2 min-w-0">
                    {s.avatarUrl ? (
                      <img src={s.avatarUrl} alt={s.displayName} className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: isDark ? "oklch(0.28 0.07 145)" : "#e5e7eb", color: textMuted }}>
                        {s.displayName[0]?.toUpperCase()}
                      </div>
                    )}
                    <span className="text-sm font-medium truncate" style={{ color: textMain }}>{s.displayName}</span>
                  </div>
                  <span className="text-center text-sm font-medium" style={{ color: textMain }}>{s.wins}</span>
                  <span className="text-center text-sm" style={{ color: textMuted }}>{s.draws}</span>
                  <span className="text-center text-sm" style={{ color: textMuted }}>{s.losses}</span>
                  <span className="text-center text-sm font-bold" style={{ color: accent }}>{s.points}</span>
                </div>
              ))
            )}
          </div>
        )}

        {/* ── SCHEDULE TAB ─────────────────────────────────────────────────── */}
        {activeTab === "schedule" && (
          <div className="space-y-4">
            {weeks.map((week) => (
              <div key={week.weekNumber} className="rounded-2xl overflow-hidden" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
                <div
                  className="flex items-center justify-between px-4 py-3"
                  style={{ borderBottom: `1px solid ${cardBorder}`, background: isDark ? "oklch(0.23 0.06 145)" : "#f9fafb" }}
                >
                  <div className="flex items-center gap-2">
                    <Calendar size={14} style={{ color: accent }} />
                    <span className="font-semibold text-sm" style={{ color: textMain }}>Week {week.weekNumber}</span>
                  </div>
                  {week.isComplete ? (
                    <span className="flex items-center gap-1 text-xs font-medium" style={{ color: accent }}>
                      <CheckCircle2 size={12} /> Complete
                    </span>
                  ) : week.weekNumber === league.currentWeek ? (
                    <span className="flex items-center gap-1 text-xs font-medium" style={{ color: "#f59e0b" }}>
                      <Circle size={10} className="fill-current" /> Current
                    </span>
                  ) : (
                    <span className="text-xs" style={{ color: textMuted }}>Upcoming</span>
                  )}
                </div>
                <div className="divide-y" style={{ borderColor: cardBorder }}>
                  {week.matches.map((match) => (
                    <div key={match.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="flex-1 text-sm truncate" style={{ color: textMain }}>{match.playerWhiteName}</div>
                      <div className="text-xs font-medium px-2 flex-shrink-0" style={{ color: textMuted }}>vs</div>
                      <div className="flex-1 text-sm truncate text-right" style={{ color: textMain }}>{match.playerBlackName}</div>
                      <div className="flex-shrink-0 ml-2">
                        {match.resultStatus === "completed" ? (
                          <CheckCircle2 size={14} style={{ color: accent }} />
                        ) : (
                          <Clock size={14} style={{ color: textMuted }} />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Result report modal */}
      {reportingMatch && (
        <ReportResultModal
          match={reportingMatch}
          isDark={isDark}
          onClose={() => setReportingMatch(null)}
          onSubmit={handleReportResult}
        />
      )}
    </div>
  );
}
