/**
 * League Dashboard — /leagues/:leagueId
 * Phase 2: Your Match This Week · Next Opponent · Recent Results ·
 *          Streak/Movement Standings · Schedule Highlights
 */
import { useState, useEffect, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuthContext } from "@/context/AuthContext";
import {
  Trophy, Users, Calendar, ChevronRight, ArrowLeft,
  Crown, Swords, BarChart3, ListOrdered, CheckCircle2,
  Clock, Circle, Shield, ChevronUp, ChevronDown, Minus, Zap, Target,
  Share2, Copy, Check, QrCode, X, History
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface LeaguePlayer {
  id: number;
  leagueId: string;
  playerId: string;
  displayName: string;
  avatarUrl?: string | null;
  chesscomUsername?: string | null;
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
  streak?: string;
  movement?: string;
  lastResults?: string;
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

// ── Helpers ───────────────────────────────────────────────────────────────────
function parseLastResults(raw?: string): string[] {
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return raw.split("-").filter(Boolean); }
}

function ResultDot({ r }: { r: string }) {
  const color = r === "W" ? "#4ade80" : r === "L" ? "#f87171" : "#facc15";
  const label = r === "W" ? "Win" : r === "L" ? "Loss" : "Draw";
  return (
    <span
      title={label}
      className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
      style={{ background: `${color}22`, color }}
    >
      {r}
    </span>
  );
}

function MovementIcon({ movement }: { movement?: string }) {
  if (movement === "up") return <ChevronUp size={13} className="text-green-400" />;
  if (movement === "down") return <ChevronDown size={13} className="text-red-400" />;
  return <Minus size={13} className="opacity-30" />;
}

function Avatar({
  url, name, size = 8, ring = false,
}: { url?: string | null; name: string; size?: number; ring?: boolean }) {
  const sizeClass = `w-${size} h-${size}`;
  if (url) {
    return (
      <img
        src={url}
        alt={name}
        className={`${sizeClass} rounded-full object-cover flex-shrink-0${ring ? " ring-2 ring-white/20" : ""}`}
      />
    );
  }
  return (
    <div
      className={`${sizeClass} rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0`}
      style={{ background: "oklch(0.28 0.07 145)", color: "oklch(0.65 0.04 145)" }}
    >
      {name[0]?.toUpperCase()}
    </div>
  );
}

// ── Share / QR Modal ────────────────────────────────────────────────────────
function ShareModal({
  league, isDark, onClose,
}: {
  league: League; isDark: boolean; onClose: () => void;
}) {
  const joinUrl = `${window.location.origin}/leagues/${league.id}`;
  const [copied, setCopied] = useState(false);
  const [view, setView] = useState<"link" | "qr">("link");

  const bg = isDark ? "oklch(0.18 0.05 145)" : "#ffffff";
  const border = isDark ? "oklch(0.30 0.07 145)" : "#e5e7eb";
  const textMain = isDark ? "#f0f5ee" : "#111827";
  const textMuted = isDark ? "oklch(0.65 0.04 145)" : "#6b7280";
  const accent = "oklch(0.55 0.13 145)";

  function handleCopy() {
    navigator.clipboard.writeText(joinUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl"
        style={{ background: bg, border: `1px solid ${border}` }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Share2 size={16} style={{ color: accent }} />
            <span className="font-bold text-base" style={{ color: textMain }}>Share League</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl" style={{ background: isDark ? "oklch(0.25 0.06 145)" : "#f3f4f6" }}>
            <X size={14} style={{ color: textMuted }} />
          </button>
        </div>

        {/* Toggle: Link / QR */}
        <div className="px-5 pb-3">
          <div className="flex gap-1 p-1 rounded-xl" style={{ background: isDark ? "oklch(0.22 0.06 145)" : "#f3f4f6" }}>
            {(["link", "qr"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{
                  background: view === v ? (isDark ? "oklch(0.28 0.08 145)" : "#ffffff") : "transparent",
                  color: view === v ? textMain : textMuted,
                  boxShadow: view === v ? "0 1px 3px rgba(0,0,0,0.12)" : "none",
                }}
              >
                {v === "link" ? <Copy size={11} /> : <QrCode size={11} />}
                {v === "link" ? "Copy Link" : "QR Code"}
              </button>
            ))}
          </div>
        </div>

        {/* Link view */}
        {view === "link" && (
          <div className="px-5 pb-5 space-y-3">
            <p className="text-xs" style={{ color: textMuted }}>
              Share this link so players can view the league and request to join.
            </p>
            <div
              className="flex items-center gap-2 rounded-2xl px-3 py-2.5"
              style={{ background: isDark ? "oklch(0.22 0.06 145)" : "#f9fafb", border: `1px solid ${border}` }}
            >
              <span className="flex-1 text-xs truncate font-mono" style={{ color: textMain }}>{joinUrl}</span>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold flex-shrink-0 transition-all"
                style={{ background: copied ? "#4ade8022" : `${accent}22`, color: copied ? "#4ade80" : accent }}
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            {/* Native share if supported */}
            {typeof navigator.share === "function" && (
              <button
                onClick={() => navigator.share({ title: league.name, url: joinUrl }).catch(() => {})}
                className="w-full py-3 rounded-2xl text-sm font-semibold"
                style={{ background: accent, color: "#fff" }}
              >
                Share via…
              </button>
            )}
          </div>
        )}

        {/* QR view */}
        {view === "qr" && (
          <div className="px-5 pb-5 flex flex-col items-center gap-4">
            <div
              className="rounded-2xl p-4"
              style={{ background: "#ffffff" }}
            >
              <QRCodeSVG value={joinUrl} size={200} fgColor="#111827" bgColor="#ffffff" />
            </div>
            <p className="text-xs text-center" style={{ color: textMuted }}>
              Scan to view <strong style={{ color: textMain }}>{league.name}</strong>
            </p>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold"
              style={{ background: `${accent}22`, color: accent }}
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? "Link copied!" : "Copy link too"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Result Report Modal ───────────────────────────────────────────────────────
function ReportResultModal({
  match, isDark, onClose, onSubmit,
}: {
  match: LeagueMatch; isDark: boolean;
  onClose: () => void;
  onSubmit: (result: "white_win" | "black_win" | "draw") => Promise<void>;
}) {
  const [selected, setSelected] = useState<"white_win" | "black_win" | "draw" | null>(null);
  const [loading, setLoading] = useState(false);
  const bg = isDark ? "oklch(0.18 0.05 145)" : "#ffffff";
  const border = isDark ? "oklch(0.30 0.07 145)" : "#e5e7eb";
  const textMain = isDark ? "#f0f5ee" : "#111827";
  const textMuted = isDark ? "oklch(0.65 0.04 145)" : "#6b7280";
  const accent = "oklch(0.55 0.13 145)";
  const options: { value: "white_win" | "black_win" | "draw"; label: string; sub: string }[] = [
    { value: "white_win", label: `${match.playerWhiteName} wins`, sub: "White wins (+1 pt)" },
    { value: "black_win", label: `${match.playerBlackName} wins`, sub: "Black wins (+1 pt)" },
    { value: "draw", label: "Draw", sub: "½ point each" },
  ];
  async function handleSubmit() {
    if (!selected) return;
    setLoading(true);
    try { await onSubmit(selected); } finally { setLoading(false); }
  }
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl"
        style={{ background: bg, border: `1px solid ${border}` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-3">
          <div className="flex items-center gap-2 mb-1">
            <Swords size={16} style={{ color: accent }} />
            <span className="font-bold text-base" style={{ color: textMain }}>Report Result</span>
          </div>
          <p className="text-sm" style={{ color: textMuted }}>
            {match.playerWhiteName} vs {match.playerBlackName} — Week {match.weekNumber}
          </p>
        </div>
        <div className="px-5 pb-2 space-y-2">
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSelected(opt.value)}
              className="w-full flex items-center gap-3 rounded-2xl px-4 py-3 text-left transition-all"
              style={{
                background: selected === opt.value ? `${accent}22` : isDark ? "oklch(0.22 0.06 145)" : "#f9fafb",
                border: `1.5px solid ${selected === opt.value ? accent : "transparent"}`,
              }}
            >
              <div
                className="w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center"
                style={{ borderColor: selected === opt.value ? accent : border }}
              >
                {selected === opt.value && <div className="w-2 h-2 rounded-full" style={{ background: accent }} />}
              </div>
              <div>
                <div className="font-medium text-sm" style={{ color: textMain }}>{opt.label}</div>
                <div className="text-xs" style={{ color: textMuted }}>{opt.sub}</div>
              </div>
            </button>
          ))}
        </div>
        <div className="px-5 pb-5 pt-3 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-2xl text-sm font-medium"
            style={{ background: isDark ? "oklch(0.22 0.06 145)" : "#f3f4f6", color: textMuted }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!selected || loading}
            className="flex-1 py-3 rounded-2xl text-sm font-bold transition-opacity disabled:opacity-40"
            style={{ background: accent, color: "#fff" }}
          >
            {loading ? "Saving…" : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
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
  const [activeTab, setActiveTab] = useState<"overview" | "matchups" | "standings" | "schedule" | "history" | "requests">("overview");
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [reportingMatch, setReportingMatch] = useState<LeagueMatch | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [advancingWeek, setAdvancingWeek] = useState(false);
  const [showShare, setShowShare] = useState(false);
  // Join requests (commissioner-only, for Draft leagues)
  const [joinRequests, setJoinRequests] = useState<Array<{ id: number; playerId: string; displayName: string; avatarUrl?: string | null; chesscomUsername?: string | null; createdAt: string }>>([]);
  const [reviewingId, setReviewingId] = useState<number | null>(null);

  // Colour tokens
  const pageBg = isDark ? "oklch(0.15 0.04 145)" : "#f0f5ee";
  const cardBg = isDark ? "oklch(0.20 0.06 145)" : "#ffffff";
  const cardBorder = isDark ? "oklch(0.28 0.07 145)" : "#e5e7eb";
  const textMain = isDark ? "#f0f5ee" : "#111827";
  const textMuted = isDark ? "oklch(0.65 0.04 145)" : "#6b7280";
  const accent = "oklch(0.55 0.13 145)";
  const tabBg = isDark ? "oklch(0.22 0.06 145)" : "#e8f0e8";
  const tabActive = isDark ? "oklch(0.28 0.08 145)" : "#ffffff";

  function showToast(msg: string, type: "success" | "error" = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  const fetchAll = useCallback(async () => {
    if (!leagueId) return;
    try {
      const [lRes, wRes, sRes] = await Promise.all([
        fetch(`/api/leagues/${leagueId}`),
        fetch(`/api/leagues/${leagueId}/weeks`),
        fetch(`/api/leagues/${leagueId}/standings`),
      ]);
      if (lRes.ok) {
        const d = await lRes.json();
        setLeague(d);
        setSelectedWeek(d.currentWeek ?? 1);
      }
      if (wRes.ok) setWeeks(await wRes.json());
      if (sRes.ok) setStandings(await sRes.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [leagueId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const fetchJoinRequests = useCallback(async () => {
    if (!leagueId) return;
    try {
      const res = await fetch(`/api/leagues/${leagueId}/join-requests`, { credentials: "include" });
      if (res.ok) setJoinRequests(await res.json());
    } catch { /* not commissioner or not draft */ }
  }, [leagueId]);
  useEffect(() => { fetchJoinRequests(); }, [fetchJoinRequests]);

  async function handleReviewRequest(reqId: number, action: "approve" | "reject") {
    if (!leagueId) return;
    setReviewingId(reqId);
    try {
      const res = await fetch(`/api/leagues/${leagueId}/join-requests/${reqId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        showToast(action === "approve" ? "Player added to league!" : "Request declined");
        setJoinRequests((prev) => prev.filter((r) => r.id !== reqId));
        if (action === "approve") fetchAll();
      } else {
        showToast(d.error ?? "Failed to review request", "error");
      }
    } finally {
      setReviewingId(null);
    }
  }

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
      const d = await res.json().catch(() => ({}));
      showToast(d.error ?? "Failed to save result", "error");
    }
  }

  async function handleAdvanceWeek() {
    if (!leagueId || !league) return;
    const allCurrentWeekReported = weeks
      .find((w) => w.weekNumber === league.currentWeek)
      ?.matches.every((m) => m.resultStatus === "completed") ?? false;
    const confirmed = allCurrentWeekReported
      ? true
      : window.confirm(
          `Not all Week ${league.currentWeek} matches have been reported. Advance anyway? Unreported matches will be left as pending.`
        );
    if (!confirmed) return;
    setAdvancingWeek(true);
    try {
      const res = await fetch(`/api/leagues/${leagueId}/advance-week`, { method: "POST" });
      if (res.ok) {
        const d = await res.json();
        if (d.completed) {
          showToast(d.champion ? `🏆 Season complete! ${d.champion.displayName} is the champion!` : "Season complete!");
        } else {
          showToast(`Advanced to Week ${d.newWeek}!`);
        }
        await fetchAll();
      } else {
        const d = await res.json().catch(() => ({}));
        showToast(d.error ?? "Failed to advance week", "error");
      }
    } finally {
      setAdvancingWeek(false);
    }
  }

  // ── Derived values ─────────────────────────────────────────────────────
  const isCommissioner = !!(user && league && league.commissionerId === user.id);
  function resultLabel(match: LeagueMatch) {
    if (match.resultStatus !== "completed" || !match.result) return null;
    if (match.result === "white_win") return `${match.playerWhiteName} won`;
    if (match.result === "black_win") return `${match.playerBlackName} won`;
    return "Draw";
  }
  function canReport(match: LeagueMatch) {
    if (match.resultStatus === "completed") return false;
    if (!user) return false;
    return match.playerWhiteId === user.id || match.playerBlackId === user.id || league?.commissionerId === user.id;
  }
  function isMyMatch(match: LeagueMatch) {
    return !!(user && (match.playerWhiteId === user.id || match.playerBlackId === user.id));
  }

  const currentWeekMatches = weeks.find((w) => w.weekNumber === selectedWeek)?.matches ?? [];
  const allMatches = weeks.flatMap((w) => w.matches);
  const completedMatchCount = allMatches.filter((m) => m.resultStatus === "completed").length;
  const totalMatches = allMatches.length;

  // My match this week
  const myMatchThisWeek = league
    ? weeks.find((w) => w.weekNumber === league.currentWeek)?.matches.find((m) => isMyMatch(m))
    : undefined;

  // Next opponent (next week)
  const nextWeekMatch = league
    ? weeks.find((w) => w.weekNumber === league.currentWeek + 1)?.matches.find((m) => isMyMatch(m))
    : undefined;

  // My standing
  const myStanding = user ? standings.find((s) => s.playerId === user.id) : undefined;

  // Recent completed matches (last 5)
  const recentResults = [...allMatches]
    .filter((m) => m.resultStatus === "completed")
    .sort((a, b) => (b.weekNumber - a.weekNumber) || (b.id - a.id))
    .slice(0, 5);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: pageBg }}>
        <div
          className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: `${accent} transparent ${accent} ${accent}` }}
        />
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
    { id: "overview" as const, label: "Overview", icon: BarChart3 },
    { id: "matchups" as const, label: "Matchups", icon: Swords },
    { id: "standings" as const, label: "Standings", icon: ListOrdered },
    { id: "schedule" as const, label: "Schedule", icon: Calendar },
    ...(league.status === "completed" ? [{ id: "history" as const, label: "Summary", icon: History }] : []),
    ...(isCommissioner && league.status === "draft" ? [{ id: "requests" as const, label: "Requests", icon: Users, badge: joinRequests.length }] : []),
  ];

  const progressPct = totalMatches > 0 ? Math.round((completedMatchCount / totalMatches) * 100) : 0;

  return (
    <div className="min-h-screen pb-16" style={{ background: pageBg }}>
      {/* Toast */}
      {toast && (
        <div
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl text-sm font-medium shadow-xl"
          style={{ background: toast.type === "success" ? accent : "#ef4444", color: "#fff" }}
        >
          {toast.msg}
        </div>
      )}

      {/* Sticky header */}
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
            {league.status === "active"
              ? `Week ${league.currentWeek} of ${league.totalWeeks} · ${progressPct}% complete`
              : league.status === "completed" ? "Season Complete 🏆" : "Draft"}
          </p>
        </div>
        <div
          className="px-2.5 py-1 rounded-full text-xs font-semibold flex-shrink-0"
          style={{
            background: league.status !== "draft" ? `${accent}22` : "oklch(0.5 0.02 145 / 0.1)",
            color: league.status !== "draft" ? accent : textMuted,
          }}
        >
          {league.status === "active" ? "Active" : league.status === "completed" ? "Complete" : "Draft"}
        </div>
        {/* Share button */}
        <button
          onClick={() => setShowShare(true)}
          className="p-2 rounded-xl transition-opacity hover:opacity-70 flex-shrink-0"
          style={{ background: isDark ? "oklch(0.23 0.06 145)" : "#f3f4f6" }}
          title="Share league"
        >
          <Share2 size={15} style={{ color: accent }} />
        </button>
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
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition-all relative"
                style={{
                  background: isActive ? tabActive : "transparent",
                  color: isActive ? textMain : textMuted,
                  boxShadow: isActive ? "0 1px 4px rgba(0,0,0,0.12)" : "none",
                }}
              >
                <Icon size={13} />
                <span className="hidden sm:inline">{tab.label}</span>
                {(tab as any).badge > 0 && (
                  <span
                    className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold"
                    style={{ background: accent, color: "#fff" }}
                  >
                    {(tab as any).badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-4 space-y-4">

        {/* ── OVERVIEW ──────────────────────────────────────────────────────── */}
        {activeTab === "overview" && (
          <>
            {/* Champion announcement banner */}
            {league.status === "completed" && (() => {
              const champion = standings[0];
              return (
                <div
                  className="rounded-2xl overflow-hidden"
                  style={{ background: `linear-gradient(135deg, oklch(0.22 0.09 85), oklch(0.18 0.06 145))`, border: `1.5px solid oklch(0.7 0.18 85 / 0.5)` }}
                >
                  <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: `1px solid oklch(0.7 0.18 85 / 0.2)` }}>
                    <Trophy size={14} style={{ color: "oklch(0.82 0.18 85)" }} />
                    <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "oklch(0.82 0.18 85)" }}>
                      Season Complete
                    </span>
                  </div>
                  <div className="px-4 py-5 flex flex-col items-center gap-3 text-center">
                    {champion && (
                      <>
                        {/* Clickable champion card — links to club profile members tab */}
                        <button
                          className="flex flex-col items-center gap-3 group cursor-pointer"
                          onClick={() => navigate(`/clubs/${league.clubId}?tab=members`)}
                          title={`View ${champion.displayName}'s club profile`}
                        >
                          <div className="relative">
                            <Avatar url={champion.avatarUrl} name={champion.displayName} size={16} ring />
                            {/* Trophy badge overlay */}
                            <span
                              className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-[10px] shadow-lg"
                              style={{ background: "oklch(0.82 0.18 85)", color: "oklch(0.18 0.06 85)" }}
                            >
                              🏆
                            </span>
                          </div>
                          <div>
                            <p
                              className="text-lg font-bold group-hover:underline transition-all"
                              style={{ color: "oklch(0.82 0.18 85)" }}
                            >
                              {champion.displayName}
                            </p>
                            <p className="text-xs mt-0.5" style={{ color: "oklch(0.82 0.18 85 / 0.7)" }}>
                              {champion.points} pts · {champion.wins}W {champion.draws}D {champion.losses}L
                            </p>
                          </div>
                        </button>
                        {/* League Champion badge pill */}
                        <div
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold"
                          style={{ background: "oklch(0.82 0.18 85 / 0.18)", color: "oklch(0.82 0.18 85)", border: "1px solid oklch(0.82 0.18 85 / 0.35)" }}
                        >
                          <Trophy size={11} />
                          League Champion
                        </div>
                        {/* View profile link */}
                        <button
                          className="text-[11px] underline underline-offset-2 opacity-60 hover:opacity-100 transition-opacity"
                          style={{ color: "oklch(0.82 0.18 85)" }}
                          onClick={() => navigate(`/clubs/${league.clubId}?tab=members`)}
                        >
                          View on club profile →
                        </button>
                      </>
                    )}
                    {!champion && (
                      <p className="text-sm font-medium" style={{ color: "oklch(0.82 0.18 85)" }}>Season has concluded</p>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Week-complete transition banner */}
            {league.status === "active" && league.currentWeek > 1 && (() => {
              const prevWeek = weeks.find((w) => w.weekNumber === league.currentWeek - 1);
              return prevWeek?.isComplete ? (
                <div
                  className="rounded-2xl px-4 py-3 flex items-center gap-3"
                  style={{ background: `${accent}18`, border: `1px solid ${accent}44` }}
                >
                  <CheckCircle2 size={16} style={{ color: accent }} />
                  <span className="text-sm font-medium" style={{ color: accent }}>
                    Week {league.currentWeek - 1} complete — Week {league.currentWeek} is now active
                  </span>
                </div>
              ) : null;
            })()}

            {/* Your Match This Week */}
            {myMatchThisWeek && (
              <div
                className="rounded-2xl overflow-hidden"
                style={{ background: cardBg, border: `1.5px solid ${accent}55` }}
              >
                <div
                  className="px-4 py-2.5 flex items-center gap-2"
                  style={{ background: `${accent}18`, borderBottom: `1px solid ${accent}33` }}
                >
                  <Zap size={13} style={{ color: accent }} />
                  <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: accent }}>
                    Your Match · Week {league.currentWeek}
                  </span>
                </div>
                <div className="px-4 py-4 flex items-center gap-3">
                  {/* White player */}
                  <div className={`flex-1 flex flex-col items-center gap-1.5 ${myMatchThisWeek.playerWhiteId === user?.id ? "opacity-100" : "opacity-70"}`}>
                    <Avatar
                      url={league.players.find(p => p.playerId === myMatchThisWeek.playerWhiteId)?.avatarUrl}
                      name={myMatchThisWeek.playerWhiteName}
                      size={10}
                      ring
                    />
                    <span className="text-xs font-medium text-center truncate max-w-[80px]" style={{ color: textMain }}>
                      {myMatchThisWeek.playerWhiteName}
                    </span>
                    <span className="text-[10px]" style={{ color: textMuted }}>White</span>
                  </div>
                  {/* VS / result */}
                  <div className="flex flex-col items-center gap-1 flex-shrink-0">
                    {myMatchThisWeek.resultStatus === "completed" ? (
                      <>
                        <CheckCircle2 size={20} style={{ color: accent }} />
                        <span className="text-xs font-medium" style={{ color: accent }}>{resultLabel(myMatchThisWeek)}</span>
                      </>
                    ) : (
                      <>
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                          style={{ background: `${accent}22`, color: accent }}
                        >
                          VS
                        </div>
                        {canReport(myMatchThisWeek) && (
                          <button
                            onClick={() => setReportingMatch(myMatchThisWeek)}
                            className="text-[10px] font-semibold px-2 py-0.5 rounded-full mt-1"
                            style={{ background: accent, color: "#fff" }}
                          >
                            Report
                          </button>
                        )}
                      </>
                    )}
                  </div>
                  {/* Black player */}
                  <div className={`flex-1 flex flex-col items-center gap-1.5 ${myMatchThisWeek.playerBlackId === user?.id ? "opacity-100" : "opacity-70"}`}>
                    <Avatar
                      url={league.players.find(p => p.playerId === myMatchThisWeek.playerBlackId)?.avatarUrl}
                      name={myMatchThisWeek.playerBlackName}
                      size={10}
                      ring
                    />
                    <span className="text-xs font-medium text-center truncate max-w-[80px]" style={{ color: textMain }}>
                      {myMatchThisWeek.playerBlackName}
                    </span>
                    <span className="text-[10px]" style={{ color: textMuted }}>Black</span>
                  </div>
                </div>
              </div>
            )}

            {/* My standing + next opponent */}
            {(myStanding || nextWeekMatch) && (
              <div className="grid grid-cols-2 gap-3">
                {myStanding && (
                  <div className="rounded-2xl p-4" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Target size={13} style={{ color: accent }} />
                      <span className="text-xs font-semibold" style={{ color: textMuted }}>My Standing</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-black" style={{ color: accent }}>#{myStanding.rank}</span>
                      <MovementIcon movement={myStanding.movement} />
                    </div>
                    <div className="text-xs mt-1" style={{ color: textMuted }}>
                      {myStanding.wins}W {myStanding.draws}D {myStanding.losses}L · {myStanding.points}pts
                    </div>
                    {myStanding.lastResults && (
                      <div className="flex gap-1 mt-2">
                        {parseLastResults(myStanding.lastResults).map((r, i) => <ResultDot key={i} r={r} />)}
                      </div>
                    )}
                  </div>
                )}
                {nextWeekMatch && (
                  <div className="rounded-2xl p-4" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Shield size={13} style={{ color: accent }} />
                      <span className="text-xs font-semibold" style={{ color: textMuted }}>Next Opponent</span>
                    </div>
                    {(() => {
                      const oppId = nextWeekMatch.playerWhiteId === user?.id
                        ? nextWeekMatch.playerBlackId
                        : nextWeekMatch.playerWhiteId;
                      const oppName = nextWeekMatch.playerWhiteId === user?.id
                        ? nextWeekMatch.playerBlackName
                        : nextWeekMatch.playerWhiteName;
                      const oppPlayer = league.players.find(p => p.playerId === oppId);
                      const oppStanding = standings.find(s => s.playerId === oppId);
                      return (
                        <>
                          <div className="flex items-center gap-2">
                            <Avatar url={oppPlayer?.avatarUrl} name={oppName} size={8} />
                            <div className="min-w-0">
                              <div className="text-sm font-semibold truncate" style={{ color: textMain }}>{oppName}</div>
                              {oppStanding && (
                                <div className="text-xs" style={{ color: textMuted }}>
                                  Rank #{oppStanding.rank} · {oppStanding.points}pts
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="text-xs mt-2" style={{ color: textMuted }}>Week {league.currentWeek + 1}</div>
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}

            {/* Season progress */}
            <div className="rounded-2xl p-5" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Trophy size={15} style={{ color: accent }} />
                  <span className="font-semibold text-sm" style={{ color: textMain }}>Season Progress</span>
                </div>
                <span className="text-xs font-medium" style={{ color: accent }}>{progressPct}%</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: isDark ? "oklch(0.25 0.06 145)" : "#e5e7eb" }}>
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${progressPct}%`, background: accent }}
                />
              </div>
              <div className="flex justify-between mt-2 text-xs" style={{ color: textMuted }}>
                <span>{completedMatchCount} of {totalMatches} matches complete</span>
                <span>Week {league.currentWeek}/{league.totalWeeks}</span>
              </div>
            </div>

            {/* Recent results */}
            {recentResults.length > 0 && (
              <div className="rounded-2xl overflow-hidden" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
                <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: `1px solid ${cardBorder}` }}>
                  <Clock size={14} style={{ color: accent }} />
                  <span className="font-semibold text-sm" style={{ color: textMain }}>Recent Results</span>
                </div>
                <div className="divide-y" style={{ borderColor: cardBorder }}>
                  {recentResults.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center gap-3 px-4 py-3"
                      style={isMyMatch(m) ? { background: `${accent}08` } : {}}
                    >
                      <span className="text-xs flex-shrink-0 w-6" style={{ color: textMuted }}>W{m.weekNumber}</span>
                      <div className="flex-1 flex items-center gap-2 min-w-0">
                        <span
                          className="text-sm truncate"
                          style={{ color: textMain, fontWeight: m.result === "white_win" ? 600 : 400 }}
                        >
                          {m.playerWhiteName}
                        </span>
                        <span className="text-xs flex-shrink-0" style={{ color: textMuted }}>vs</span>
                        <span
                          className="text-sm truncate"
                          style={{ color: textMain, fontWeight: m.result === "black_win" ? 600 : 400 }}
                        >
                          {m.playerBlackName}
                        </span>
                      </div>
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                        style={{
                          background: m.result === "draw" ? "#facc1522" : `${accent}22`,
                          color: m.result === "draw" ? "#facc15" : accent,
                        }}
                      >
                        {m.result === "white_win" ? "1-0" : m.result === "black_win" ? "0-1" : "½-½"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top 3 standings preview */}
            {standings.length > 0 && (
              <div className="rounded-2xl p-5" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Crown size={15} style={{ color: accent }} />
                    <span className="font-semibold text-sm" style={{ color: textMain }}>Standings</span>
                  </div>
                  <button
                    onClick={() => setActiveTab("standings")}
                    className="flex items-center gap-1 text-xs font-medium"
                    style={{ color: accent }}
                  >
                    Full standings <ChevronRight size={12} />
                  </button>
                </div>
                <div className="space-y-2">
                  {standings.slice(0, 3).map((s, i) => {
                    const podiumColor = i === 0 ? "#f59e0b" : i === 1 ? "#9ca3af" : "#cd7c2f";
                    return (
                      <div
                        key={s.playerId}
                        className="flex items-center gap-3 py-2 px-2 rounded-xl"
                        style={s.playerId === user?.id ? { background: `${accent}08` } : {}}
                      >
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                          style={{ background: `${podiumColor}22`, color: podiumColor }}
                        >
                          {i + 1}
                        </div>
                        <Avatar url={s.avatarUrl} name={s.displayName} size={8} />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate" style={{ color: textMain }}>{s.displayName}</div>
                          <div className="text-xs" style={{ color: textMuted }}>{s.wins}W {s.draws}D {s.losses}L</div>
                        </div>
                        <div className="flex items-center gap-1">
                          <MovementIcon movement={s.movement} />
                          <span className="font-bold text-base" style={{ color: accent }}>{s.points}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Players */}
            <div className="rounded-2xl p-5" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
              <div className="flex items-center gap-2 mb-4">
                <Users size={16} style={{ color: accent }} />
                <span className="font-semibold text-sm" style={{ color: textMain }}>
                  Players ({league.players.length})
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {league.players.map((p) => (
                  <div
                    key={p.playerId}
                    className="flex items-center gap-2 rounded-xl p-2.5"
                    style={{
                      background: isDark ? "oklch(0.25 0.06 145)" : "#f9fafb",
                      border: p.playerId === user?.id ? `1px solid ${accent}55` : "1px solid transparent",
                    }}
                  >
                    <Avatar url={p.avatarUrl} name={p.displayName} size={8} />
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate" style={{ color: textMain }}>{p.displayName}</div>
                      {p.chesscomUsername && (
                        <div className="text-xs truncate" style={{ color: textMuted }}>@{p.chesscomUsername}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── MATCHUPS ──────────────────────────────────────────────────────── */}
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
                    border: w.weekNumber === league.currentWeek ? `1.5px solid ${accent}` : "1.5px solid transparent",
                  }}
                >
                  W{w.weekNumber}{w.isComplete ? " ✓" : ""}
                </button>
              ))}
            </div>

            {/* Week label */}
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sm" style={{ color: textMain }}>
                Week {selectedWeek}
                {selectedWeek === league.currentWeek && (
                  <span
                    className="ml-2 text-xs font-normal px-2 py-0.5 rounded-full"
                    style={{ background: `${accent}22`, color: accent }}
                  >
                    Current
                  </span>
                )}
              </span>
              {weeks.find(w => w.weekNumber === selectedWeek)?.isComplete ? (
                <span className="flex items-center gap-1 text-xs" style={{ color: accent }}>
                  <CheckCircle2 size={12} /> Complete
                </span>
              ) : (
                <span className="text-xs" style={{ color: textMuted }}>
                  {currentWeekMatches.filter(m => m.resultStatus === "completed").length}/{currentWeekMatches.length} reported
                </span>
              )}
            </div>

            {/* Match cards */}
            <div className="space-y-3">
              {currentWeekMatches.length === 0 ? (
                <div className="rounded-2xl p-8 text-center" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
                  <Calendar size={32} className="mx-auto mb-2" style={{ color: textMuted }} />
                  <p style={{ color: textMuted }}>No matches this week</p>
                </div>
              ) : (
                currentWeekMatches.map((match) => {
                  const label = resultLabel(match);
                  const mine = isMyMatch(match);
                  return (
                    <div
                      key={match.id}
                      className="rounded-2xl overflow-hidden"
                      style={{
                        background: cardBg,
                        border: `1.5px solid ${mine ? accent + "55" : cardBorder}`,
                      }}
                    >
                      <div className="flex items-center gap-3 px-4 py-4">
                        <div className="flex-1 flex flex-col items-center gap-1.5">
                          <Avatar
                            url={league.players.find(p => p.playerId === match.playerWhiteId)?.avatarUrl}
                            name={match.playerWhiteName}
                            size={9}
                            ring={mine && match.playerWhiteId === user?.id}
                          />
                          <span
                            className="text-xs font-medium text-center truncate max-w-[80px]"
                            style={{ color: textMain, fontWeight: match.result === "white_win" ? 700 : 400 }}
                          >
                            {match.playerWhiteName}
                          </span>
                          <span className="text-[10px]" style={{ color: textMuted }}>White</span>
                        </div>
                        <div className="flex flex-col items-center gap-1 flex-shrink-0">
                          {match.resultStatus === "completed" ? (
                            <>
                              <span className="text-sm font-bold" style={{ color: accent }}>
                                {match.result === "white_win" ? "1 – 0" : match.result === "black_win" ? "0 – 1" : "½ – ½"}
                              </span>
                              <span className="text-[10px]" style={{ color: textMuted }}>{label}</span>
                            </>
                          ) : (
                            <>
                              <span className="text-xs font-medium" style={{ color: textMuted }}>vs</span>
                              {canReport(match) && (
                                <button
                                  onClick={() => setReportingMatch(match)}
                                  className="mt-1 text-[10px] font-semibold px-2.5 py-1 rounded-full"
                                  style={{ background: accent, color: "#fff" }}
                                >
                                  Report
                                </button>
                              )}
                            </>
                          )}
                        </div>
                        <div className="flex-1 flex flex-col items-center gap-1.5">
                          <Avatar
                            url={league.players.find(p => p.playerId === match.playerBlackId)?.avatarUrl}
                            name={match.playerBlackName}
                            size={9}
                            ring={mine && match.playerBlackId === user?.id}
                          />
                          <span
                            className="text-xs font-medium text-center truncate max-w-[80px]"
                            style={{ color: textMain, fontWeight: match.result === "black_win" ? 700 : 400 }}
                          >
                            {match.playerBlackName}
                          </span>
                          <span className="text-[10px]" style={{ color: textMuted }}>Black</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Commissioner: Advance Week button */}
            {isCommissioner && league.status === "active" && league.currentWeek < league.totalWeeks && selectedWeek === league.currentWeek && (
              <div
                className="rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                style={{ background: isDark ? "oklch(0.22 0.07 145)" : "#f0fdf4", border: `1.5px solid ${accent}44` }}
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-semibold flex items-center gap-1.5" style={{ color: textMain }}>
                    <Crown size={14} style={{ color: accent }} />
                    Commissioner Controls
                  </span>
                  <span className="text-xs" style={{ color: textMuted }}>
                    {weeks.find(w => w.weekNumber === league.currentWeek)?.matches.every(m => m.resultStatus === "completed")
                      ? `All Week ${league.currentWeek} results reported — ready to advance.`
                      : `${currentWeekMatches.filter(m => m.resultStatus === "completed").length}/${currentWeekMatches.length} matches reported in Week ${league.currentWeek}.`
                    }
                  </span>
                </div>
                <button
                  onClick={handleAdvanceWeek}
                  disabled={advancingWeek}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95 disabled:opacity-50 flex-shrink-0"
                  style={{ background: accent, color: "#fff" }}
                >
                  {advancingWeek ? (
                    <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  ) : (
                    <ChevronRight size={15} />
                  )}
                  Close Week & Advance
                </button>
              </div>
            )}
          </>
        )}

        {/* ── STANDINGS ─────────────────────────────────────────────────────── */}
        {activeTab === "standings" && (
          <div className="rounded-2xl overflow-hidden" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
            {/* Header row */}
            <div
              className="grid items-center px-4 py-2.5 text-xs font-semibold uppercase tracking-wide"
              style={{
                borderBottom: `1px solid ${cardBorder}`,
                color: textMuted,
                gridTemplateColumns: "2rem 1fr 2.5rem 2.5rem 2.5rem 3rem 4.5rem",
                gap: "0.5rem",
              }}
            >
              <span>#</span>
              <span>Player</span>
              <span className="text-center">W</span>
              <span className="text-center">D</span>
              <span className="text-center">L</span>
              <span className="text-center">Pts</span>
              <span className="text-center">Form</span>
            </div>
            {standings.length === 0 ? (
              <div className="p-8 text-center" style={{ color: textMuted }}>No standings yet</div>
            ) : (
              standings.map((s, i) => {
                const isMe = s.playerId === user?.id;
                const lastArr = parseLastResults(s.lastResults);
                const podiumColor = i === 0 ? "#f59e0b" : i === 1 ? "#9ca3af" : i === 2 ? "#cd7c2f" : null;
                return (
                  <div
                    key={s.playerId}
                    className="grid items-center px-4 py-3"
                    style={{
                      gridTemplateColumns: "2rem 1fr 2.5rem 2.5rem 2.5rem 3rem 4.5rem",
                      gap: "0.5rem",
                      borderBottom: i < standings.length - 1 ? `1px solid ${cardBorder}` : "none",
                      background: isMe ? `${accent}08` : i < 3 && podiumColor ? `${podiumColor}06` : "transparent",
                    }}
                  >
                    {/* Rank */}
                    {podiumColor ? (
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                        style={{ background: `${podiumColor}22`, color: podiumColor }}
                      >
                        {i + 1}
                      </div>
                    ) : (
                      <span className="text-sm font-medium text-center" style={{ color: textMuted }}>{i + 1}</span>
                    )}
                    {/* Player */}
                    <div className="flex items-center gap-1.5 min-w-0">
                      <MovementIcon movement={s.movement} />
                      <Avatar url={s.avatarUrl} name={s.displayName} size={7} />
                      <span className="text-sm font-medium truncate" style={{ color: isMe ? accent : textMain }}>
                        {s.displayName}{isMe ? " (you)" : ""}
                      </span>
                    </div>
                    <span className="text-center text-sm font-medium" style={{ color: textMain }}>{s.wins}</span>
                    <span className="text-center text-sm" style={{ color: textMuted }}>{s.draws}</span>
                    <span className="text-center text-sm" style={{ color: textMuted }}>{s.losses}</span>
                    <span className="text-center text-sm font-bold" style={{ color: accent }}>{s.points}</span>
                    {/* Form dots */}
                    <div className="flex gap-0.5 justify-center">
                      {lastArr.length === 0
                        ? <span className="text-xs" style={{ color: textMuted }}>—</span>
                        : lastArr.map((r, j) => <ResultDot key={j} r={r} />)
                      }
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ── SCHEDULE ──────────────────────────────────────────────────────── */}
        {activeTab === "schedule" && (
          <div className="space-y-4">
            {weeks.map((week) => (
              <div
                key={week.weekNumber}
                className="rounded-2xl overflow-hidden"
                style={{
                  background: cardBg,
                  border: `1.5px solid ${week.weekNumber === league.currentWeek ? accent + "55" : cardBorder}`,
                }}
              >
                {/* Week header */}
                <div
                  className="flex items-center justify-between px-4 py-3"
                  style={{
                    borderBottom: `1px solid ${cardBorder}`,
                    background: week.weekNumber === league.currentWeek
                      ? `${accent}10`
                      : isDark ? "oklch(0.23 0.06 145)" : "#f9fafb",
                  }}
                >
                  <div className="flex items-center gap-2">
                    <Calendar size={14} style={{ color: week.weekNumber === league.currentWeek ? accent : textMuted }} />
                    <span className="font-semibold text-sm" style={{ color: textMain }}>Week {week.weekNumber}</span>
                    {week.weekNumber === league.currentWeek && (
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ background: `${accent}22`, color: accent }}
                      >
                        Current
                      </span>
                    )}
                  </div>
                  {week.isComplete ? (
                    <span className="flex items-center gap-1 text-xs font-medium" style={{ color: accent }}>
                      <CheckCircle2 size={12} /> Complete
                    </span>
                  ) : week.weekNumber < league.currentWeek ? (
                    <span className="text-xs" style={{ color: "#f87171" }}>Incomplete</span>
                  ) : week.weekNumber === league.currentWeek ? (
                    <span className="flex items-center gap-1 text-xs font-medium" style={{ color: "#facc15" }}>
                      <Circle size={10} className="fill-current" /> Active
                    </span>
                  ) : (
                    <span className="text-xs" style={{ color: textMuted }}>Upcoming</span>
                  )}
                </div>
                {/* Matches */}
                <div className="divide-y" style={{ borderColor: cardBorder }}>
                  {week.matches.map((match) => {
                    const mine = isMyMatch(match);
                    return (
                      <div
                        key={match.id}
                        className="flex items-center gap-3 px-4 py-3"
                        style={mine ? { background: `${accent}08` } : {}}
                      >
                        <div
                          className="flex-1 text-sm truncate"
                          style={{
                            color: textMain,
                            fontWeight: match.result === "white_win" ? 600 : 400,
                          }}
                        >
                          {mine && match.playerWhiteId === user?.id && (
                            <span style={{ color: accent }}>★ </span>
                          )}
                          {match.playerWhiteName}
                        </div>
                        <div
                          className="text-xs font-semibold px-2 flex-shrink-0"
                          style={{ color: match.resultStatus === "completed" ? accent : textMuted }}
                        >
                          {match.resultStatus === "completed"
                            ? (match.result === "white_win" ? "1-0" : match.result === "black_win" ? "0-1" : "½-½")
                            : "vs"}
                        </div>
                        <div
                          className="flex-1 text-sm truncate text-right"
                          style={{
                            color: textMain,
                            fontWeight: match.result === "black_win" ? 600 : 400,
                          }}
                        >
                          {match.playerBlackName}
                          {mine && match.playerBlackId === user?.id && (
                            <span style={{ color: accent }}> ★</span>
                          )}
                        </div>
                        <div className="flex-shrink-0 ml-2">
                          {match.resultStatus === "completed"
                            ? <CheckCircle2 size={14} style={{ color: accent }} />
                            : <Clock size={14} style={{ color: textMuted }} />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}


        {/* ── HISTORY / SEASON SUMMARY ─────────────────────────────────────── */}
        {activeTab === "history" && (
          <div className="space-y-5">
            {/* Champion card */}
            {standings[0] && (
              <div
                className="rounded-2xl overflow-hidden"
                style={{ background: `linear-gradient(135deg, oklch(0.22 0.09 85), oklch(0.18 0.06 145))`, border: `1.5px solid oklch(0.7 0.18 85 / 0.5)` }}
              >
                <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: `1px solid oklch(0.7 0.18 85 / 0.2)` }}>
                  <Trophy size={14} style={{ color: "oklch(0.82 0.18 85)" }} />
                  <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "oklch(0.82 0.18 85)" }}>
                    {league.name} — Season Champion
                  </span>
                </div>
                <div className="px-4 py-4 flex items-center gap-4">
                  <div className="relative flex-shrink-0">
                    <Avatar url={standings[0].avatarUrl} name={standings[0].displayName} size={14} ring />
                    <span
                      className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-[10px] shadow-lg"
                      style={{ background: "oklch(0.82 0.18 85)", color: "oklch(0.18 0.06 85)" }}
                    >
                      🏆
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-lg font-bold" style={{ color: "oklch(0.82 0.18 85)" }}>{standings[0].displayName}</p>
                    <p className="text-xs mt-0.5" style={{ color: "oklch(0.82 0.18 85 / 0.7)" }}>
                      {standings[0].points} pts · {standings[0].wins}W {standings[0].draws}D {standings[0].losses}L
                    </p>
                  </div>
                  <div
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold flex-shrink-0"
                    style={{ background: "oklch(0.82 0.18 85 / 0.18)", color: "oklch(0.82 0.18 85)", border: "1px solid oklch(0.82 0.18 85 / 0.35)" }}
                  >
                    <Trophy size={10} />
                    Champion
                  </div>
                </div>
              </div>
            )}

            {/* Final standings */}
            <div className="rounded-2xl overflow-hidden" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
              <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: `1px solid ${cardBorder}` }}>
                <ListOrdered size={14} style={{ color: accent }} />
                <span className="font-semibold text-sm" style={{ color: textMain }}>Final Standings</span>
              </div>
              {standings.map((s, i) => {
                const podiumColor = i === 0 ? "#f59e0b" : i === 1 ? "#9ca3af" : i === 2 ? "#cd7c2f" : null;
                const isMe = s.playerId === user?.id;
                return (
                  <div
                    key={s.playerId}
                    className="flex items-center gap-3 px-4 py-3"
                    style={{
                      borderBottom: i < standings.length - 1 ? `1px solid ${cardBorder}` : "none",
                      background: isMe ? `${accent}08` : i < 3 && podiumColor ? `${podiumColor}06` : "transparent",
                    }}
                  >
                    {podiumColor ? (
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                        style={{ background: `${podiumColor}22`, color: podiumColor }}
                      >
                        {i + 1}
                      </div>
                    ) : (
                      <span className="w-7 text-center text-sm" style={{ color: textMuted }}>{i + 1}</span>
                    )}
                    <Avatar url={s.avatarUrl} name={s.displayName} size={8} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate" style={{ color: isMe ? accent : textMain }}>
                        {s.displayName}{isMe ? " (you)" : ""}
                      </div>
                      <div className="text-xs" style={{ color: textMuted }}>{s.wins}W {s.draws}D {s.losses}L</div>
                    </div>
                    <span className="font-bold text-base flex-shrink-0" style={{ color: accent }}>{s.points} pts</span>
                  </div>
                );
              })}
            </div>

            {/* All results by week */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Calendar size={14} style={{ color: accent }} />
                <span className="font-semibold text-sm" style={{ color: textMain }}>All Results by Week</span>
              </div>
              {weeks.map((week) => (
                <div key={week.weekNumber} className="rounded-2xl overflow-hidden" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
                  <div
                    className="px-4 py-2.5 flex items-center justify-between"
                    style={{ borderBottom: `1px solid ${cardBorder}`, background: isDark ? "oklch(0.23 0.06 145)" : "#f9fafb" }}
                  >
                    <span className="text-xs font-semibold" style={{ color: textMain }}>Week {week.weekNumber}</span>
                    <span className="text-xs" style={{ color: week.isComplete ? accent : textMuted }}>
                      {week.isComplete ? "Complete" : "Incomplete"}
                    </span>
                  </div>
                  <div className="divide-y" style={{ borderColor: cardBorder }}>
                    {week.matches.map((match) => (
                      <div key={match.id} className="flex items-center gap-3 px-4 py-2.5">
                        <span
                          className="flex-1 text-sm truncate"
                          style={{ color: textMain, fontWeight: match.result === "white_win" ? 600 : 400 }}
                        >
                          {match.playerWhiteName}
                        </span>
                        <span
                          className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                          style={{
                            background: match.resultStatus === "completed" ? `${accent}22` : "transparent",
                            color: match.resultStatus === "completed" ? accent : textMuted,
                          }}
                        >
                          {match.resultStatus === "completed"
                            ? (match.result === "white_win" ? "1–0" : match.result === "black_win" ? "0–1" : "½–½")
                            : "vs"}
                        </span>
                        <span
                          className="flex-1 text-sm truncate text-right"
                          style={{ color: textMain, fontWeight: match.result === "black_win" ? 600 : 400 }}
                        >
                          {match.playerBlackName}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          )}
        {/* ── REQUESTS (commissioner, draft league) ─────────────────────────── */}
        {activeTab === "requests" && (
          <div className="space-y-3 pb-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold" style={{ color: textMain }}>Join Requests</p>
              <span className="text-xs" style={{ color: textMuted }}>{joinRequests.length} pending</span>
            </div>
            {joinRequests.length === 0 ? (
              <div
                className="rounded-3xl py-12 text-center"
                style={{ background: cardBg, border: `1px solid ${cardBorder}` }}
              >
                <Users size={32} className="mx-auto mb-3" style={{ color: textMuted }} />
                <p className="text-sm font-semibold" style={{ color: textMain }}>No pending requests</p>
                <p className="text-xs mt-1" style={{ color: textMuted }}>Share the league invite link to attract players.</p>
                <button
                  onClick={() => setShowShare(true)}
                  className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold"
                  style={{ background: `${accent}22`, color: accent }}
                >
                  <Share2 size={12} /> Share Invite Link
                </button>
              </div>
            ) : (
              <div
                className="rounded-3xl overflow-hidden"
                style={{ background: cardBg, border: `1px solid ${cardBorder}` }}
              >
                {joinRequests.map((req, i) => (
                  <div
                    key={req.id}
                    className="flex items-center gap-3 px-4 py-3.5"
                    style={{ borderBottom: i < joinRequests.length - 1 ? `1px solid ${cardBorder}` : "none" }}
                  >
                    <Avatar url={req.avatarUrl} name={req.displayName} size={9} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: textMain }}>{req.displayName}</p>
                      {req.chesscomUsername && (
                        <p className="text-xs truncate" style={{ color: textMuted }}>chess.com/{req.chesscomUsername}</p>
                      )}
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleReviewRequest(req.id, "approve")}
                        disabled={reviewingId === req.id}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                        style={{ background: `${accent}22`, color: accent }}
                      >
                        {reviewingId === req.id ? (
                          <span className="w-3 h-3 rounded-full border border-t-transparent animate-spin inline-block" style={{ borderColor: `${accent} transparent ${accent} ${accent}` }} />
                        ) : "Approve"}
                      </button>
                      <button
                        onClick={() => handleReviewRequest(req.id, "reject")}
                        disabled={reviewingId === req.id}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                        style={{ background: isDark ? "rgba(239,68,68,0.12)" : "#fef2f2", color: "#ef4444" }}
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {/* Quick share reminder */}
            <div
              className="rounded-2xl px-4 py-3 flex items-center gap-3"
              style={{ background: `${accent}0d`, border: `1px solid ${accent}22` }}
            >
              <Share2 size={14} style={{ color: accent }} />
              <div className="flex-1 min-w-0">
                <p className="text-xs" style={{ color: textMain }}>Share the invite link so more players can request to join.</p>
              </div>
              <button
                onClick={() => setShowShare(true)}
                className="text-xs font-semibold flex-shrink-0"
                style={{ color: accent }}
              >
                Share
              </button>
            </div>
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

      {/* Share modal */}
      {showShare && (
        <ShareModal
          league={league}
          isDark={isDark}
          onClose={() => setShowShare(false)}
        />
      )}
    </div>
  );
}
