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
import AuthModal from "@/components/AuthModal";

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
  resultStatus: "pending" | "awaiting_confirmation" | "disputed" | "completed";
  result?: "white_win" | "black_win" | "draw" | null;
  reportedByUserId?: string | null;
  whiteReport?: "white_win" | "black_win" | "draw" | null;
  blackReport?: "white_win" | "black_win" | "draw" | null;
  whiteReportedAt?: string | null;
  blackReportedAt?: string | null;
  completedAt?: string | null;
}
interface LeagueWeek {
  id: number;
  leagueId: string;
  weekNumber: number;
  publishedAt?: string | null;
  isComplete: number;
  deadline?: string | null;
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
  chesscomRating?: number | null;
  chesscomUsername?: string | null;
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
      className="modal-overlay z-50"
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
function resultLabel(r: string, wName: string, bName: string) {
  if (r === "white_win") return `${wName} wins`;
  if (r === "black_win") return `${bName} wins`;
  return "Draw";
}

function ReportResultModal({
  match, isDark, onClose, onSubmit, currentUserId,
}: {
  match: LeagueMatch; isDark: boolean; currentUserId?: string;
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
  const warn = "oklch(0.65 0.18 60)";

  const isWhite = currentUserId === match.playerWhiteId;
  const isBlack = currentUserId === match.playerBlackId;
  const myPriorReport = isWhite ? match.whiteReport : isBlack ? match.blackReport : null;
  const opponentReport = isWhite ? match.blackReport : isBlack ? match.whiteReport : null;
  const isConfirming = match.resultStatus === "awaiting_confirmation" && opponentReport && !myPriorReport;

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
      className="modal-overlay z-50"
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
            <span className="font-bold text-base" style={{ color: textMain }}>
              {isConfirming ? "Confirm Result" : "Report Result"}
            </span>
          </div>
          <p className="text-sm" style={{ color: textMuted }}>
            {match.playerWhiteName} vs {match.playerBlackName} — Week {match.weekNumber}
          </p>
        </div>

        {/* Show opponent's report if awaiting confirmation */}
        {isConfirming && opponentReport && (
          <div className="mx-5 mb-3 px-4 py-3 rounded-2xl text-sm" style={{ background: `${warn}18`, border: `1px solid ${warn}44`, color: textMain }}>
            <span style={{ color: warn }}>Your opponent reported:</span>{" "}
            <strong>{resultLabel(opponentReport, match.playerWhiteName, match.playerBlackName)}</strong>
            <p className="text-xs mt-1" style={{ color: textMuted }}>Select the same result to confirm, or a different one to dispute.</p>
          </div>
        )}

        {/* Already reported — show waiting message */}
        {myPriorReport && match.resultStatus === "awaiting_confirmation" && (
          <div className="mx-5 mb-3 px-4 py-3 rounded-2xl text-sm" style={{ background: `${accent}18`, border: `1px solid ${accent}44`, color: textMain }}>
            You reported: <strong>{resultLabel(myPriorReport, match.playerWhiteName, match.playerBlackName)}</strong>
            <p className="text-xs mt-1" style={{ color: textMuted }}>Waiting for your opponent to confirm.</p>
          </div>
        )}

        {!myPriorReport && (
          <>
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
                {loading ? "Saving…" : isConfirming ? "Confirm" : "Submit Report"}
              </button>
            </div>
          </>
        )}

        {myPriorReport && (
          <div className="px-5 pb-5 pt-1">
            <button
              onClick={onClose}
              className="w-full py-3 rounded-2xl text-sm font-medium"
              style={{ background: isDark ? "oklch(0.22 0.06 145)" : "#f3f4f6", color: textMuted }}
            >
              Close
            </button>
          </div>
        )}
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
  // Push notification subscription state (commissioner-only)
  const [pushStatus, setPushStatus] = useState<"idle" | "subscribed" | "denied" | "loading" | "unsupported">("idle");
  const [pushLoading, setPushLoading] = useState(false);
  // Commissioner invite flow
  const [sentInvites, setSentInvites] = useState<Array<{ id: number; invitedUserId: string; invitedDisplayName: string; invitedAvatarUrl?: string | null; invitedChesscomUsername?: string | null; status: string; createdAt: string }>>([]);
  const [clubMembers, setClubMembers] = useState<Array<{ userId: string; displayName: string; avatarUrl?: string | null; chesscomUsername?: string | null }>>([]);
  const [showInvitePicker, setShowInvitePicker] = useState(false);
  const [inviteSearch, setInviteSearch] = useState("");
  const [sendingInviteId, setSendingInviteId] = useState<string | null>(null);
  const [cancellingInviteId, setCancellingInviteId] = useState<number | null>(null);
  // Player-side invite (shown to the invited player on the League Dashboard)
  const [myInvite, setMyInvite] = useState<{ id: number; commissionerName: string; message?: string | null; status: string } | null>(null);
  const [respondingInvite, setRespondingInvite] = useState(false);
  const [startingSeason, setStartingSeason] = useState(false);
  // Auth modal for guest CTA
  const [authOpen, setAuthOpen] = useState(false);
  // Join-request state (for non-member visitors)
  const [joinRequestStatus, setJoinRequestStatus] = useState<"idle" | "pending" | "already" | "loading" | "error">("idle");
  const [joinRequestMsg, setJoinRequestMsg] = useState("");
  // Detect if the user arrived via an invite link (?join=1)
  const isInviteLink = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("join") === "1";
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

  // Check if the current user already has a pending/rejected request (for returning visitors)
  const fetchMyJoinRequest = useCallback(async () => {
    if (!leagueId || !user) return;
    // Fast path: localStorage cache to avoid flash of join button
    const cacheKey = `otb-join-req-${leagueId}-${user.id}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const { status: cachedStatus } = JSON.parse(cached) as { status: string };
      if (cachedStatus === "pending") {
        setJoinRequestStatus("pending");
        setJoinRequestMsg("Your request has been sent! The commissioner will review it shortly.");
      } else if (cachedStatus === "rejected") {
        setJoinRequestStatus("idle"); // allow re-request if rejected
      }
    }
    try {
      const res = await fetch(`/api/leagues/${leagueId}/my-join-request`, { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json() as { status: string | null };
      if (data.status === "pending") {
        setJoinRequestStatus("pending");
        setJoinRequestMsg("Your request has been sent! The commissioner will review it shortly.");
        localStorage.setItem(cacheKey, JSON.stringify({ status: "pending" }));
      } else if (data.status === "rejected") {
        // Clear cache so they can re-request
        localStorage.removeItem(cacheKey);
        setJoinRequestStatus("idle");
      } else if (data.status === null) {
        localStorage.removeItem(cacheKey);
      }
    } catch { /* ignore */ }
  }, [leagueId, user]);
  useEffect(() => { fetchMyJoinRequest(); }, [fetchMyJoinRequest]);

  const fetchSentInvites = useCallback(async () => {
    if (!leagueId) return;
    try {
      const res = await fetch(`/api/leagues/${leagueId}/invites`, { credentials: "include" });
      if (res.ok) setSentInvites(await res.json());
    } catch { /* not commissioner */ }
  }, [leagueId]);
  useEffect(() => { fetchSentInvites(); }, [fetchSentInvites]);
  const fetchClubMembers = useCallback(async () => {
    if (!league?.clubId) return;
    try {
      const res = await fetch(`/api/clubs/${league.clubId}/members`, { credentials: "include" });
      if (res.ok) setClubMembers(await res.json());
    } catch { /* ignore */ }
  }, [league?.clubId]);
  useEffect(() => { if (showInvitePicker) fetchClubMembers(); }, [showInvitePicker, fetchClubMembers]);
  async function handleSendInvite(memberId: string) {
    if (!leagueId) return;
    setSendingInviteId(memberId);
    try {
      const res = await fetch(`/api/leagues/${leagueId}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ invitedUserId: memberId }),
      });
      if (res.ok) {
        showToast("Invite sent!");
        await fetchSentInvites();
      } else {
        const d = await res.json();
        showToast(d.error ?? "Failed to send invite", "error");
      }
    } catch { showToast("Failed to send invite", "error"); }
    finally { setSendingInviteId(null); }
  }
  async function handleCancelInvite(inviteId: number) {
    if (!leagueId) return;
    setCancellingInviteId(inviteId);
    try {
      const res = await fetch(`/api/leagues/${leagueId}/invites/${inviteId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        showToast("Invite cancelled");
        await fetchSentInvites();
      } else {
        showToast("Failed to cancel invite", "error");
      }
    } catch { showToast("Failed to cancel invite", "error"); }
    finally { setCancellingInviteId(null); }
  }
  // Fetch the current user's pending invite for this league
  const fetchMyInvite = useCallback(async () => {
    if (!leagueId || !user) return;
    try {
      // Use the /invites/mine endpoint to find any pending invite for this league
      const res = await fetch(`/api/leagues/invites/mine`, { credentials: "include" });
      if (res.ok) {
        const all = await res.json() as Array<{ id: number; leagueId: string; commissionerName: string; message?: string | null; status: string }>;
        const mine = all.find((inv) => inv.leagueId === leagueId) ?? null;
        setMyInvite(mine);
      }
    } catch { /* ignore */ }
  }, [leagueId, user]);
  useEffect(() => { fetchMyInvite(); }, [fetchMyInvite]);
  async function handleRespondInvite(action: "accept" | "decline") {
    if (!leagueId || !myInvite) return;
    setRespondingInvite(true);
    try {
      const res = await fetch(`/api/leagues/${leagueId}/invites/${myInvite.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        showToast(action === "accept" ? "You've joined the league!" : "Invite declined");
        setMyInvite(null);
        if (action === "accept") await fetchAll(); // refresh league players
      } else {
        const d = await res.json();
        showToast(d.error ?? "Failed to respond", "error");
      }
    } catch { showToast("Failed to respond", "error"); }
    finally { setRespondingInvite(false); }
  }

  // Check push subscription status on mount
  useEffect(() => {
    if (!leagueId) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setPushStatus("unsupported"); return;
    }
    if (typeof Notification !== "undefined" && Notification.permission === "denied") {
      setPushStatus("denied"); return;
    }
    fetch(`/api/leagues/${leagueId}/push/status`, { credentials: "include" })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.subscribed) setPushStatus("subscribed"); })
      .catch(() => {});
  }, [leagueId]);

  async function getVapidKey(): Promise<string> {
    const r = await fetch("/api/push/vapid-public-key");
    const d = await r.json() as { publicKey: string };
    return d.publicKey;
  }
  function urlBase64ToUint8Array(base64: string): Uint8Array {
    const padding = "=".repeat((4 - (base64.length % 4)) % 4);
    const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
    const raw = atob(b64);
    return Uint8Array.from(Array.from(raw).map((c) => c.charCodeAt(0)));
  }
  async function handleSubscribePush() {
    if (!leagueId || !("serviceWorker" in navigator) || !("PushManager" in window)) return;
    setPushLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") { setPushStatus("denied"); return; }
      const vapidKey = await getVapidKey();
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidKey) });
      const subJson = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      const res = await fetch(`/api/leagues/${leagueId}/push/subscribe`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: subJson }),
      });
      if (res.ok) { setPushStatus("subscribed"); showToast("Notifications enabled!"); }
      else showToast("Failed to save subscription", "error");
    } catch (err) {
      console.error("[push]", err);
      showToast("Could not enable notifications", "error");
    } finally {
      setPushLoading(false);
    }
  }
  async function handleUnsubscribePush() {
    if (!leagueId) return;
    setPushLoading(true);
    try {
      await fetch(`/api/leagues/${leagueId}/push/subscribe`, { method: "DELETE", credentials: "include" });
      setPushStatus("idle");
      showToast("Notifications disabled");
    } catch { showToast("Failed to disable notifications", "error"); }
    finally { setPushLoading(false); }
  }

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
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ result }),
    });
    if (res.ok) {
      const d = await res.json().catch(() => ({ message: "Result recorded!" }));
      showToast(d.message ?? "Result recorded!");
      setReportingMatch(null);
      await fetchAll();
    } else {
      const d = await res.json().catch(() => ({}));
      showToast(d.error ?? "Failed to save result", "error");
    }
  }

  // Commissioner resolves a disputed match
  async function handleResolveDispute(matchId: number, result: "white_win" | "black_win" | "draw") {
    if (!leagueId) return;
    const res = await fetch(`/api/leagues/${leagueId}/matches/${matchId}/result`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ result }),
    });
    if (res.ok) {
      showToast("Dispute resolved!");
      await fetchAll();
    } else {
      const d = await res.json().catch(() => ({}));
      showToast(d.error ?? "Failed to resolve", "error");
    }
  }

  // Commissioner sets a deadline for a week
  async function handleSetDeadline(weekId: number, deadline: string | null) {
    if (!leagueId) return;
    const res = await fetch(`/api/leagues/${leagueId}/weeks/${weekId}/deadline`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deadline }),
    });
    if (res.ok) {
      showToast(deadline ? "Deadline set!" : "Deadline cleared");
      await fetchAll();
    } else {
      showToast("Failed to set deadline", "error");
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
      const res = await fetch(`/api/leagues/${leagueId}/advance-week`, { method: "POST", credentials: "include" });
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
  const isMember = !!(user && league && league.players.some((p: LeaguePlayer) => p.playerId === user.id));

  async function handleRequestToJoin() {
    if (!user) { setAuthOpen(true); return; }
    setJoinRequestStatus("loading");
    try {
      const res = await fetch(`/api/leagues/${leagueId}/join-request`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok) {
        setJoinRequestStatus("pending");
        setJoinRequestMsg("Your request has been sent! The commissioner will review it shortly.");
        showToast("Join request sent!", "success");
        // Persist so returning visitors immediately see pending state
        if (user) localStorage.setItem(`otb-join-req-${leagueId}-${user.id}`, JSON.stringify({ status: "pending" }));
      } else if (res.status === 409) {
        setJoinRequestStatus("pending");
        setJoinRequestMsg("Your request is pending — waiting for commissioner approval.");
      } else {
        setJoinRequestStatus("error");
        setJoinRequestMsg(data.error ?? "Failed to submit request.");
      }
    } catch {
      setJoinRequestStatus("error");
      setJoinRequestMsg("Network error. Please try again.");
    }
  }
  function resultLabel(match: LeagueMatch) {
    if (match.resultStatus !== "completed" || !match.result) return null;
    if (match.result === "white_win") return `${match.playerWhiteName} won`;
    if (match.result === "black_win") return `${match.playerBlackName} won`;
    return "Draw";
  }
  function canReport(match: LeagueMatch) {
    if (match.resultStatus === "completed") return false;
    if (!user) return false;
    const isWhite = match.playerWhiteId === user.id;
    const isBlack = match.playerBlackId === user.id;
    const isComm = league?.commissionerId === user.id;
    // If awaiting_confirmation, only the player who hasn't reported yet can confirm
    if (match.resultStatus === "awaiting_confirmation") {
      if (isWhite && !match.whiteReport) return true;
      if (isBlack && !match.blackReport) return true;
      if (isComm) return true;
      return false;
    }
    // Disputed — only commissioner can resolve (via PATCH, not this button)
    if (match.resultStatus === "disputed") return false;
    return isWhite || isBlack || isComm;
  }
  function isMyMatch(match: LeagueMatch) {
    return !!(user && (match.playerWhiteId === user.id || match.playerBlackId === user.id));
  }

  // Helper: get opponent's chess.com username for a match (for prep links)
  function getOpponentChesscom(match: LeagueMatch): string | null {
    if (!user || !league) return null;
    const oppId = match.playerWhiteId === user.id ? match.playerBlackId : match.playerWhiteId;
    const oppPlayer = league.players.find(p => p.playerId === oppId);
    return oppPlayer?.chesscomUsername ?? null;
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
        className="sticky top-0 z-30 px-4 py-3 flex items-center gap-3 otb-header-safe"
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
        {/* Push notification bell — commissioner only, Draft leagues */}
        {isCommissioner && league.status === "draft" && pushStatus !== "unsupported" && (
          <button
            onClick={pushStatus === "subscribed" ? handleUnsubscribePush : handleSubscribePush}
            disabled={pushLoading || pushStatus === "denied"}
            className="p-2 rounded-xl transition-opacity hover:opacity-70 flex-shrink-0 relative"
            style={{ background: isDark ? "oklch(0.23 0.06 145)" : "#f3f4f6" }}
            title={pushStatus === "subscribed" ? "Notifications on — tap to disable" : pushStatus === "denied" ? "Notifications blocked in browser" : "Enable join-request notifications"}
          >
            {pushLoading ? (
              <span className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin inline-block" style={{ borderColor: `${accent} transparent ${accent} ${accent}` }} />
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill={pushStatus === "subscribed" ? accent : "none"} stroke={pushStatus === "denied" ? textMuted : pushStatus === "subscribed" ? accent : textMain} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                {pushStatus === "subscribed" && <circle cx="19" cy="5" r="3" fill="#4ade80" stroke="none" />}
              </svg>
            )}
          </button>
        )}
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

      {/* ── HERO BANNER ─────────────────────────────────────────────────── */}
      <div
        className="relative w-full overflow-hidden"
        style={{ height: "180px" }}
      >
        {/* Micro-grid chess pattern background */}
        <div
          className="absolute inset-0"
          style={{
            background: isDark
              ? `linear-gradient(135deg, oklch(0.14 0.07 145) 0%, oklch(0.18 0.09 145) 50%, oklch(0.13 0.05 145) 100%)`
              : `linear-gradient(135deg, oklch(0.22 0.09 145) 0%, oklch(0.28 0.12 145) 50%, oklch(0.20 0.07 145) 100%)`,
          }}
        />
        {/* Chess board grid overlay */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `repeating-conic-gradient(${accent} 0% 25%, transparent 0% 50%)`,
            backgroundSize: "28px 28px",
          }}
        />
        {/* Gradient fade at bottom */}
        <div
          className="absolute bottom-0 left-0 right-0 h-20"
          style={{
            background: `linear-gradient(to bottom, transparent, ${pageBg})`,
          }}
        />
        {/* Status badge top-right */}
        <div className="absolute top-4 right-4">
          <span
            className="px-3 py-1 rounded-full text-xs font-bold"
            style={{
              background: league.status === "active" ? `${accent}33` : league.status === "completed" ? "oklch(0.82 0.18 85 / 0.25)" : "oklch(0.5 0.02 145 / 0.3)",
              color: league.status === "active" ? accent : league.status === "completed" ? "oklch(0.82 0.18 85)" : textMuted,
              backdropFilter: "blur(8px)",
              border: `1px solid ${league.status === "active" ? accent + "44" : "transparent"}`,
            }}
          >
            {league.status === "active" ? "● Active" : league.status === "completed" ? "🏆 Complete" : "Draft"}
          </span>
        </div>
        {/* League format badge bottom-left */}
        <div className="absolute bottom-8 left-4">
          <span className="text-xs font-medium" style={{ color: `${accent}cc` }}>
            {league.formatType === "classical" ? "Classical" : league.formatType === "rapid" ? "Rapid" : league.formatType === "blitz" ? "Blitz" : "Round Robin"} · {league.totalWeeks} weeks
          </span>
        </div>
      </div>

      {/* ── FLOATING IDENTITY CARD ──────────────────────────────────────── */}
      <div className="px-4 -mt-2">
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: isDark ? "oklch(0.19 0.06 145)" : "#fff",
            border: `1px solid ${cardBorder}`,
            boxShadow: isDark ? "0 4px 24px rgba(0,0,0,0.4)" : "0 4px 24px rgba(0,0,0,0.08)",
          }}
        >
          {/* League name + actions row */}
          <div className="px-5 pt-4 pb-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-xl font-black leading-tight truncate" style={{ color: textMain }}>{league.name}</h2>
              <button
                onClick={() => navigate(`/clubs/${league.clubId}`)}
                className="text-xs mt-0.5 flex items-center gap-1 hover:underline"
                style={{ color: accent }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                View Club
              </button>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Push bell — commissioner only */}
              {isCommissioner && league.status === "draft" && pushStatus !== "unsupported" && (
                <button
                  onClick={pushStatus === "subscribed" ? handleUnsubscribePush : handleSubscribePush}
                  disabled={pushLoading || pushStatus === "denied"}
                  className="p-2 rounded-xl transition-opacity hover:opacity-70"
                  style={{ background: isDark ? "oklch(0.25 0.06 145)" : "#f3f4f6" }}
                  title={pushStatus === "subscribed" ? "Notifications on" : "Enable notifications"}
                >
                  {pushLoading ? (
                    <span className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin inline-block" style={{ borderColor: `${accent} transparent ${accent} ${accent}` }} />
                  ) : (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill={pushStatus === "subscribed" ? accent : "none"} stroke={pushStatus === "denied" ? textMuted : pushStatus === "subscribed" ? accent : textMain} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                      {pushStatus === "subscribed" && <circle cx="19" cy="5" r="3" fill="#4ade80" stroke="none" />}
                    </svg>
                  )}
                </button>
              )}
              <button
                onClick={() => setShowShare(true)}
                className="p-2 rounded-xl transition-opacity hover:opacity-70"
                style={{ background: isDark ? "oklch(0.25 0.06 145)" : "#f3f4f6" }}
                title="Share league"
              >
                <Share2 size={15} style={{ color: accent }} />
              </button>
            </div>
          </div>

          {/* 4-stat row — reference-style */}
          <div
            className="grid grid-cols-4 divide-x"
            style={{ borderTop: `1px solid ${cardBorder}`, borderColor: cardBorder }}
          >
            {[
              {
                label: "Players",
                value: `${league.players.length}${league.maxPlayers ? ` / ${league.maxPlayers}` : ""}`,
              },
              {
                label: "Progress",
                value: league.status === "draft" ? "Draft" : league.status === "completed" ? "Done" : `${progressPct}%`,
              },
              {
                label: "Week",
                value: league.status === "active" ? `${league.currentWeek} / ${league.totalWeeks}` : league.status === "completed" ? `${league.totalWeeks} wks` : "—",
              },
              {
                label: "Format",
                value: league.formatType
                  ? league.formatType.charAt(0).toUpperCase() + league.formatType.slice(1)
                  : "Classic",
              },
            ].map((stat) => (
              <div key={stat.label} className="flex flex-col items-center py-3 px-2">
                <span className="text-[10px] uppercase tracking-wider mb-1" style={{ color: textMuted }}>{stat.label}</span>
                <span className="text-sm font-bold" style={{ color: textMain }}>{stat.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Auth modal for guest CTA */}
      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} isDark />

      {/* Guest CTA banner */}
      {(!user || user.isGuest) && (isInviteLink || league.status === "draft") && (
        <div
          className="mx-4 mt-3 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3"
          style={{
            background: isDark ? "oklch(0.22 0.09 145 / 0.85)" : "oklch(0.94 0.06 145)",
            border: `1px solid ${accent}44`,
          }}
        >
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm" style={{ color: textMain }}>
              {isInviteLink ? "You've been invited to join this league!" : "Interested in joining this league?"}
            </p>
            <p className="text-xs mt-0.5" style={{ color: textMuted }}>
              Sign in with your chess.com account to request a spot from the commissioner.
            </p>
          </div>
          <button
            onClick={() => setAuthOpen(true)}
            className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
            style={{ background: accent, color: "#fff" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
            Sign In to Request a Spot
          </button>
        </div>
      )}

      {/* Player invite banner */}
      {user && !isCommissioner && myInvite && (
        <div
          className="mx-4 mt-3 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3"
          style={{
            background: isDark ? "oklch(0.22 0.09 145 / 0.85)" : "oklch(0.94 0.06 145)",
            border: `1px solid ${accent}55`,
          }}
        >
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm" style={{ color: textMain }}>
              <span style={{ color: accent }}>{myInvite.commissionerName}</span> has invited you to join this league!
            </p>
            {myInvite.message && (
              <p className="text-xs mt-0.5 italic" style={{ color: textMuted }}>"{myInvite.message}"</p>
            )}
            <p className="text-xs mt-0.5" style={{ color: textMuted }}>Accept to be added to the roster immediately.</p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={() => handleRespondInvite("accept")}
              disabled={respondingInvite}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
              style={{ background: accent, color: "#fff" }}
            >
              {respondingInvite ? (
                <span className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin inline-block" style={{ borderColor: "#fff transparent #fff #fff" }} />
              ) : (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              )}
              Accept
            </button>
            <button
              onClick={() => handleRespondInvite("decline")}
              disabled={respondingInvite}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
              style={{ background: isDark ? "rgba(239,68,68,0.12)" : "#fef2f2", color: "#ef4444" }}
            >
              Decline
            </button>
          </div>
        </div>
      )}

      {/* ── TAB BAR ─────────────────────────────────────────────────────── */}
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

      {/* ── TWO-COLUMN LAYOUT (desktop: main left + sidebar right) ───────── */}
      <div className="px-4 pb-4">
        <div className="flex flex-col lg:flex-row gap-4 items-start">
          {/* Main content column */}
          <div className="flex-1 min-w-0 space-y-4">

        {/* ── OVERVIEW ──────────────────────────────────────────────────────── */}
        {activeTab === "overview" && (
          <>
            {/* ── Draft mode: roster progress + Start Season ─────────────── */}
            {league.status === "draft" && isCommissioner && (() => {
              const rosterCount = league.players.length;
              const rosterFull = rosterCount >= league.maxPlayers;
              const rosterPct = Math.round((rosterCount / league.maxPlayers) * 100);
              return (
                <div className="rounded-2xl overflow-hidden" style={{ background: cardBg, border: `1.5px solid ${accent}55` }}>
                  <div className="px-4 py-2.5 flex items-center gap-2" style={{ background: `${accent}18`, borderBottom: `1px solid ${accent}33` }}>
                    <Users size={13} style={{ color: accent }} />
                    <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: accent }}>Draft — Build Your Roster</span>
                  </div>
                  <div className="px-4 py-4 space-y-3">
                    {/* Roster progress bar */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-semibold" style={{ color: textMain }}>Roster: {rosterCount} / {league.maxPlayers} players</span>
                        <span className="text-xs font-medium" style={{ color: rosterFull ? accent : textMuted }}>{rosterPct}%</span>
                      </div>
                      <div className="h-2.5 rounded-full overflow-hidden" style={{ background: isDark ? "oklch(0.25 0.06 145)" : "#e5e7eb" }}>
                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${rosterPct}%`, background: rosterFull ? accent : "oklch(0.6 0.12 85)" }} />
                      </div>
                    </div>
                    {/* Roster list */}
                    {rosterCount > 0 && (
                      <div className="grid grid-cols-2 gap-2">
                        {league.players.map((p) => (
                          <div key={p.playerId} className="flex items-center gap-2 rounded-xl p-2" style={{ background: isDark ? "oklch(0.25 0.06 145)" : "#f9fafb" }}>
                            <Avatar url={p.avatarUrl} name={p.displayName} size={7} />
                            <span className="text-xs font-medium truncate" style={{ color: textMain }}>{p.displayName}</span>
                          </div>
                        ))}
                        {Array.from({ length: league.maxPlayers - rosterCount }).map((_, i) => (
                          <div key={`empty-${i}`} className="flex items-center gap-2 rounded-xl p-2 border-2 border-dashed" style={{ borderColor: isDark ? "oklch(0.3 0.04 145)" : "#d1d5db" }}>
                            <div className="w-7 h-7 rounded-full" style={{ background: isDark ? "oklch(0.25 0.04 145)" : "#e5e7eb" }} />
                            <span className="text-xs" style={{ color: textMuted }}>Open spot</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Action buttons */}
                    <div className="flex gap-3 pt-1">
                      <button
                        onClick={() => setActiveTab("requests")}
                        className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all"
                        style={{ background: isDark ? "oklch(0.25 0.06 145)" : "#f3f4f6", color: textMain, border: `1px solid ${cardBorder}` }}
                      >Invite Players</button>
                      <button
                        disabled={!rosterFull || startingSeason}
                        onClick={async () => {
                          setStartingSeason(true);
                          try {
                            const res = await fetch(`/api/leagues/${league.id}/start`, { method: "POST", credentials: "include" });
                            if (res.ok) {
                              showToast("Season started! Round-robin schedule generated.", "success");
                              await fetchAll();
                            } else {
                              const d = await res.json().catch(() => ({}));
                              showToast(d.error ?? "Failed to start season", "error");
                            }
                          } finally {
                            setStartingSeason(false);
                          }
                        }}
                        className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
                        style={{ background: accent, color: "#fff" }}
                      >{startingSeason ? "Starting…" : rosterFull ? "Start Season →" : `Need ${league.maxPlayers - rosterCount} more`}</button>
                    </div>
                    {!rosterFull && (
                      <p className="text-xs text-center" style={{ color: textMuted }}>Fill all {league.maxPlayers} spots to start the season. Use the Requests tab to invite members or share the league link.</p>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Draft mode: non-commissioner player view */}
            {league.status === "draft" && !isCommissioner && (
              <>
              <div className="rounded-2xl p-5" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
                <div className="flex items-center gap-2 mb-3">
                  <Clock size={15} style={{ color: accent }} />
                  <span className="font-semibold text-sm" style={{ color: textMain }}>League in Draft</span>
                </div>
                <p className="text-sm" style={{ color: textMuted }}>The commissioner is building the roster. The season will start once all {league.maxPlayers} spots are filled.</p>
                <div className="mt-3">
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: isDark ? "oklch(0.25 0.06 145)" : "#e5e7eb" }}>
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.round((league.players.length / league.maxPlayers) * 100)}%`, background: accent }} />
                  </div>
                  <span className="text-xs mt-1 block" style={{ color: textMuted }}>{league.players.length} / {league.maxPlayers} players</span>
                </div>
              </div>

              {/* ── Join this League CTA — shown to non-members on draft leagues ── */}
              {!isMember && !myInvite && (
                <div
                  className="rounded-2xl overflow-hidden"
                  style={{
                    background: isDark
                      ? "linear-gradient(135deg, oklch(0.20 0.09 145), oklch(0.17 0.06 145))"
                      : "linear-gradient(135deg, oklch(0.94 0.06 145), oklch(0.97 0.03 145))",
                    border: `1.5px solid ${accent}55`,
                  }}
                >
                  <div className="px-5 py-4 flex items-center gap-2" style={{ borderBottom: `1px solid ${accent}22` }}>
                    <Users size={14} style={{ color: accent }} />
                    <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: accent }}>Join this League</span>
                  </div>
                  <div className="px-5 py-5">
                    {joinRequestStatus === "pending" || joinRequestStatus === "already" ? (
                      <div className="flex flex-col items-center gap-3 text-center py-2">
                        <div
                          className="w-12 h-12 rounded-full flex items-center justify-center"
                          style={{ background: `${accent}22` }}
                        >
                          <CheckCircle2 size={24} style={{ color: accent }} />
                        </div>
                        <p className="font-semibold text-sm" style={{ color: textMain }}>Request Submitted</p>
                        <p className="text-xs" style={{ color: textMuted }}>{joinRequestMsg}</p>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm mb-4" style={{ color: textMuted }}>
                          {user
                            ? `Ready to compete? Request to join and the commissioner will add you to the roster.`
                            : `Sign in to request a spot in this league. The commissioner will review and approve your request.`
                          }
                        </p>
                        {joinRequestStatus === "error" && (
                          <p className="text-xs mb-3 px-3 py-2 rounded-xl" style={{ color: "oklch(0.55 0.18 25)", background: "oklch(0.55 0.18 25 / 0.1)" }}>
                            {joinRequestMsg}
                          </p>
                        )}
                        <button
                          onClick={handleRequestToJoin}
                          disabled={joinRequestStatus === "loading"}
                          className="w-full py-3.5 rounded-xl font-bold text-sm transition-all active:scale-95 disabled:opacity-60"
                          style={{
                            background: accent,
                            color: isDark ? "oklch(0.12 0.04 145)" : "#fff",
                            boxShadow: `0 4px 16px ${accent}44`,
                          }}
                        >
                          {joinRequestStatus === "loading"
                            ? "Sending request…"
                            : user
                            ? "Request to Join"
                            : "Sign in to Join"}
                        </button>
                        {!user && (
                          <p className="text-xs mt-2.5 text-center" style={{ color: textMuted }}>
                            Don't have an account?{" "}
                            <button
                              className="underline font-medium"
                              style={{ color: accent }}
                              onClick={() => setAuthOpen(true)}
                            >
                              Create one free
                            </button>
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
              </>
            )}

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
                  {(() => {
                    const cw = weeks.find(w => w.weekNumber === league.currentWeek);
                    if (!cw?.deadline) return null;
                    const dl = new Date(cw.deadline);
                    const now = new Date();
                    const diff = dl.getTime() - now.getTime();
                    if (diff <= 0) return (
                      <span className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "oklch(0.45 0.18 25)", color: "#fff" }}>Overdue</span>
                    );
                    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                    const isUrgent = diff < 48 * 60 * 60 * 1000;
                    const timeStr = days > 0 ? `${days}d ${hours}h left` : `${hours}h left`;
                    return (
                      <span className="ml-auto flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: isUrgent ? "oklch(0.65 0.18 60)22" : `${accent}22`, color: isUrgent ? "oklch(0.65 0.18 60)" : accent }}>
                        <Clock size={10} />{timeStr}
                      </span>
                    );
                  })()}
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
                    ) : myMatchThisWeek.resultStatus === "disputed" ? (
                      <>
                        <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full" style={{ background: "oklch(0.45 0.18 25)", color: "#fff" }}>Disputed</span>
                        <span className="text-[9px] mt-0.5" style={{ color: textMuted }}>Commissioner will resolve</span>
                      </>
                    ) : myMatchThisWeek.resultStatus === "awaiting_confirmation" ? (
                      <>
                        <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full" style={{ background: "oklch(0.55 0.15 60)", color: "#fff" }}>Awaiting</span>
                        {canReport(myMatchThisWeek) ? (
                          <button
                            onClick={() => setReportingMatch(myMatchThisWeek)}
                            className="text-[10px] font-semibold px-2 py-0.5 rounded-full mt-1"
                            style={{ background: accent, color: "#fff" }}
                          >
                            Confirm
                          </button>
                        ) : (
                          <span className="text-[9px] mt-0.5" style={{ color: textMuted }}>Waiting for opponent</span>
                        )}
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
                {/* Prep Opponent button */}
                {(() => {
                  const oppChessCom = myMatchThisWeek ? getOpponentChesscom(myMatchThisWeek) : null;
                  if (!oppChessCom) return null;
                  return (
                    <div className="px-4 pb-4">
                      <button
                        onClick={() => navigate(`/prep/${encodeURIComponent(oppChessCom)}`)}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold transition-all hover:opacity-90"
                        style={{ background: `${accent}18`, color: accent, border: `1px solid ${accent}33` }}
                      >
                        <Target size={13} />
                        Prep for {oppChessCom}
                      </button>
                    </div>
                  );
                })()}
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
                          {oppPlayer?.chesscomUsername && (
                            <button
                              onClick={() => navigate(`/prep/${encodeURIComponent(oppPlayer.chesscomUsername!)}`)}
                              className="mt-2 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10px] font-semibold transition-all hover:opacity-90"
                              style={{ background: `${accent}18`, color: accent, border: `1px solid ${accent}33` }}
                            >
                              <Target size={11} />
                              Prep
                            </button>
                          )}
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
                    const isMe = s.playerId === user?.id;
                    return (
                      <div
                        key={s.playerId}
                        className="flex items-center gap-3 py-2.5 px-3 rounded-xl transition-colors"
                        style={{ background: isMe ? `${accent}0a` : `${podiumColor}06` }}
                      >
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0"
                          style={{ background: `${podiumColor}20`, color: podiumColor, boxShadow: i === 0 ? `0 0 8px ${podiumColor}33` : "none" }}
                        >
                          {i + 1}
                        </div>
                        <div className="relative flex-shrink-0">
                          <Avatar url={s.avatarUrl} name={s.displayName} size={9} />
                          {isMe && (
                            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full" style={{ background: accent, border: `2px solid ${cardBg}` }} />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1">
                            <MovementIcon movement={s.movement} />
                            <span className="font-semibold text-sm truncate" style={{ color: isMe ? accent : textMain }}>{s.displayName}</span>
                            {s.streak && s.streak.length >= 3 && (
                              <span
                                className="text-[10px] font-bold px-1 py-0.5 rounded"
                                style={{
                                  background: s.streak.startsWith("W") ? "#4ade8022" : "#ef444422",
                                  color: s.streak.startsWith("W") ? "#4ade80" : "#ef4444",
                                }}
                              >
                                {s.streak}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[11px]" style={{ color: textMuted }}>{s.wins}W {s.draws}D {s.losses}L</span>
                            {s.chesscomRating && (
                              <span className="text-[11px] font-medium" style={{ color: textMuted }}>{s.chesscomRating} ELO</span>
                            )}
                          </div>
                        </div>
                        <span className="font-black text-lg" style={{ color: accent }}>{s.points}</span>
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
                {league.players.map((p) => {
                  const isMe = p.playerId === user?.id;
                  return (
                    <div
                      key={p.playerId}
                      className="flex items-center gap-2.5 rounded-xl p-2.5 transition-colors"
                      style={{
                        background: isDark ? "oklch(0.25 0.06 145)" : "#f9fafb",
                        border: isMe ? `1px solid ${accent}55` : "1px solid transparent",
                      }}
                    >
                      <div className="relative flex-shrink-0">
                        <Avatar url={p.avatarUrl} name={p.displayName} size={9} />
                        {isMe && (
                          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full" style={{ background: accent, border: `2px solid ${cardBg}` }} />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold truncate" style={{ color: isMe ? accent : textMain }}>{p.displayName}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {p.chesscomUsername && (
                            <span className="text-[11px] truncate" style={{ color: textMuted }}>@{p.chesscomUsername}</span>
                          )}
                          {p.rating && (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ background: isDark ? "oklch(0.3 0.06 145)" : "#e5e7eb", color: textMuted }}>
                              {p.rating}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
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

            {/* Deadline display + commissioner set deadline */}
            {(() => {
              const selectedWeekObj = weeks.find(w => w.weekNumber === selectedWeek);
              const dl = selectedWeekObj?.deadline ? new Date(selectedWeekObj.deadline) : null;
              const now = new Date();
              const isOverdue = dl && dl < now;
              const isClose = dl && !isOverdue && (dl.getTime() - now.getTime()) < 48 * 60 * 60 * 1000;
              return (
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  {dl ? (
                    <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: isOverdue ? "oklch(0.55 0.2 25)" : isClose ? "oklch(0.65 0.18 60)" : textMuted }}>
                      <Clock size={12} />
                      {isOverdue ? "Overdue" : "Due"}: {dl.toLocaleDateString(undefined, { month: "short", day: "numeric" })} at {dl.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                    </span>
                  ) : (
                    <span className="text-xs" style={{ color: textMuted }}>No deadline set</span>
                  )}
                  {isCommissioner && selectedWeekObj && !selectedWeekObj.isComplete && (
                    <div className="flex items-center gap-2">
                      <input
                        type="datetime-local"
                        className="text-xs rounded-lg px-2 py-1"
                        style={{ background: isDark ? "oklch(0.22 0.06 145)" : "#f3f4f6", color: textMain, border: `1px solid ${cardBorder}` }}
                        defaultValue={dl ? dl.toISOString().slice(0, 16) : ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val) handleSetDeadline(selectedWeekObj.id, new Date(val).toISOString());
                        }}
                      />
                      {dl && (
                        <button
                          onClick={() => selectedWeekObj && handleSetDeadline(selectedWeekObj.id, null)}
                          className="text-[10px] px-2 py-1 rounded-lg"
                          style={{ background: isDark ? "oklch(0.25 0.06 145)" : "#f3f4f6", color: textMuted }}
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

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
                          ) : match.resultStatus === "disputed" ? (
                            <>
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "oklch(0.45 0.18 25)", color: "#fff" }}>
                                Disputed
                              </span>
                              {isCommissioner && (
                                <div className="flex gap-1 mt-1">
                                  {(["white_win", "black_win", "draw"] as const).map((r) => (
                                    <button
                                      key={r}
                                      onClick={() => handleResolveDispute(match.id, r)}
                                      className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
                                      style={{ background: accent, color: "#fff" }}
                                      title={r === "white_win" ? `${match.playerWhiteName} wins` : r === "black_win" ? `${match.playerBlackName} wins` : "Draw"}
                                    >
                                      {r === "white_win" ? "W" : r === "black_win" ? "B" : "½"}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </>
                          ) : match.resultStatus === "awaiting_confirmation" ? (
                            <>
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "oklch(0.55 0.15 60)", color: "#fff" }}>
                                Awaiting
                              </span>
                              {canReport(match) && (
                                <button
                                  onClick={() => setReportingMatch(match)}
                                  className="mt-1 text-[10px] font-semibold px-2.5 py-1 rounded-full"
                                  style={{ background: accent, color: "#fff" }}
                                >
                                  Confirm
                                </button>
                              )}
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
                      {/* Prep button for my matches */}
                      {mine && (() => {
                        const oppChessCom = getOpponentChesscom(match);
                        if (!oppChessCom) return null;
                        return (
                          <div className="px-4 pb-3">
                            <button
                              onClick={() => navigate(`/prep/${encodeURIComponent(oppChessCom)}`)}
                              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-semibold transition-all hover:opacity-90"
                              style={{ background: `${accent}15`, color: accent, border: `1px solid ${accent}30` }}
                            >
                              <Target size={12} />
                              Prep for {oppChessCom}
                            </button>
                          </div>
                        );
                      })()}
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
          <div className="space-y-5">
            {/* Podium — top 3 visual cards */}
            {standings.length >= 3 && (
              <div className="flex items-end justify-center gap-3 pt-4 pb-2">
                {[1, 0, 2].map((idx) => {
                  const s = standings[idx];
                  const podiumColors = ["#f59e0b", "#9ca3af", "#cd7c2f"];
                  const podiumLabels = ["1st", "2nd", "3rd"];
                  const heights = ["h-32", "h-28", "h-24"];
                  const pc = podiumColors[idx];
                  const isMe = s.playerId === user?.id;
                  return (
                    <div key={s.playerId} className={`flex flex-col items-center ${idx === 0 ? "order-2" : idx === 1 ? "order-1" : "order-3"}`}>
                      <div className="relative mb-2">
                        <Avatar url={s.avatarUrl} name={s.displayName} size={idx === 0 ? 14 : 11} />
                        <div
                          className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black"
                          style={{ background: pc, color: "#fff", boxShadow: `0 0 8px ${pc}66` }}
                        >
                          {idx + 1}
                        </div>
                      </div>
                      <span className="text-xs font-semibold truncate max-w-[5rem] text-center" style={{ color: isMe ? accent : textMain }}>
                        {s.displayName}
                      </span>
                      <span className="text-[10px] font-bold mt-0.5" style={{ color: pc }}>{s.points} pts</span>
                      {s.chesscomRating && (
                        <span className="text-[10px] mt-0.5" style={{ color: textMuted }}>{s.chesscomRating} ELO</span>
                      )}
                      <div
                        className={`${heights[idx]} w-16 sm:w-20 rounded-t-xl mt-2 flex items-end justify-center pb-2 transition-all`}
                        style={{ background: `${pc}18`, borderTop: `2px solid ${pc}` }}
                      >
                        <span className="text-xs font-bold" style={{ color: pc }}>{podiumLabels[idx]}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Full standings table */}
            <div className="rounded-2xl overflow-hidden" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
              {/* Desktop header */}
              <div
                className="hidden sm:grid items-center px-5 py-3 text-[11px] font-semibold uppercase tracking-wider"
                style={{
                  borderBottom: `1px solid ${cardBorder}`,
                  color: textMuted,
                  background: isDark ? "oklch(0.18 0.05 145)" : "#f9fafb",
                  gridTemplateColumns: "2.5rem 1fr 5rem 2.5rem 2.5rem 2.5rem 3.5rem 5rem",
                  gap: "0.5rem",
                }}
              >
                <span className="text-center">#</span>
                <span>Player</span>
                <span className="text-center">Rating</span>
                <span className="text-center">W</span>
                <span className="text-center">D</span>
                <span className="text-center">L</span>
                <span className="text-center">Pts</span>
                <span className="text-center">Form</span>
              </div>

              {standings.length === 0 ? (
                <div className="p-12 text-center" style={{ color: textMuted }}>
                  <ListOrdered size={32} className="mx-auto mb-3 opacity-40" />
                  <p className="text-sm">No standings yet</p>
                  <p className="text-xs mt-1">Standings will appear once matches are played.</p>
                </div>
              ) : (
                standings.map((s, i) => {
                  const isMe = s.playerId === user?.id;
                  const lastArr = parseLastResults(s.lastResults);
                  const podiumColor = i === 0 ? "#f59e0b" : i === 1 ? "#9ca3af" : i === 2 ? "#cd7c2f" : null;
                  const gamesPlayed = s.wins + s.draws + s.losses;
                  const winRate = gamesPlayed > 0 ? Math.round((s.wins / gamesPlayed) * 100) : 0;

                  return (
                    <div key={s.playerId}>
                      {/* Desktop row */}
                      <div
                        className="hidden sm:grid items-center px-5 py-3.5 transition-colors duration-200"
                        style={{
                          gridTemplateColumns: "2.5rem 1fr 5rem 2.5rem 2.5rem 2.5rem 3.5rem 5rem",
                          gap: "0.5rem",
                          borderBottom: i < standings.length - 1 ? `1px solid ${cardBorder}` : "none",
                          background: isMe
                            ? `${accent}0a`
                            : i < 3 && podiumColor
                            ? `${podiumColor}06`
                            : "transparent",
                        }}
                      >
                        {/* Rank badge */}
                        <div className="flex justify-center">
                          {podiumColor ? (
                            <div
                              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black"
                              style={{ background: `${podiumColor}20`, color: podiumColor, boxShadow: i === 0 ? `0 0 12px ${podiumColor}33` : "none" }}
                            >
                              {i + 1}
                            </div>
                          ) : (
                            <span className="text-sm font-medium" style={{ color: textMuted }}>{i + 1}</span>
                          )}
                        </div>

                        {/* Player info */}
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="relative flex-shrink-0">
                            <Avatar url={s.avatarUrl} name={s.displayName} size={9} />
                            {isMe && (
                              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full" style={{ background: accent, border: `2px solid ${cardBg}` }} />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <MovementIcon movement={s.movement} />
                              <span className="text-sm font-semibold truncate" style={{ color: isMe ? accent : textMain }}>
                                {s.displayName}{isMe ? " (you)" : ""}
                              </span>
                              {s.streak && s.streak.length >= 3 && (
                                <span
                                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                                  style={{
                                    background: s.streak.startsWith("W") ? "#4ade8022" : s.streak.startsWith("L") ? "#ef444422" : "transparent",
                                    color: s.streak.startsWith("W") ? "#4ade80" : s.streak.startsWith("L") ? "#ef4444" : textMuted,
                                  }}
                                >
                                  {s.streak}
                                </span>
                              )}
                            </div>
                            {s.chesscomUsername && (
                              <span className="text-[11px] truncate block" style={{ color: textMuted }}>@{s.chesscomUsername}</span>
                            )}
                          </div>
                        </div>

                        {/* Chess.com Rating */}
                        <div className="flex flex-col items-center">
                          {s.chesscomRating ? (
                            <>
                              <span className="text-sm font-bold" style={{ color: textMain }}>{s.chesscomRating}</span>
                              <span className="text-[9px] uppercase tracking-wide" style={{ color: textMuted }}>ELO</span>
                            </>
                          ) : (
                            <span className="text-xs" style={{ color: textMuted }}>—</span>
                          )}
                        </div>

                        {/* W / D / L */}
                        <span className="text-center text-sm font-semibold" style={{ color: "#4ade80" }}>{s.wins}</span>
                        <span className="text-center text-sm font-medium" style={{ color: textMuted }}>{s.draws}</span>
                        <span className="text-center text-sm font-medium" style={{ color: "#ef4444" }}>{s.losses}</span>

                        {/* Points */}
                        <div className="flex flex-col items-center">
                          <span className="text-base font-black" style={{ color: accent }}>{s.points}</span>
                          <span className="text-[9px]" style={{ color: textMuted }}>{winRate}% win</span>
                        </div>

                        {/* Form dots */}
                        <div className="flex gap-1 justify-center">
                          {lastArr.length === 0
                            ? <span className="text-xs" style={{ color: textMuted }}>—</span>
                            : lastArr.map((r, j) => <ResultDot key={j} r={r} />)
                          }
                        </div>
                      </div>

                      {/* Mobile card */}
                      <div
                        className="sm:hidden px-4 py-3.5"
                        style={{
                          borderBottom: i < standings.length - 1 ? `1px solid ${cardBorder}` : "none",
                          background: isMe
                            ? `${accent}0a`
                            : i < 3 && podiumColor
                            ? `${podiumColor}06`
                            : "transparent",
                        }}
                      >
                        <div className="flex items-center gap-3">
                          {/* Rank */}
                          <div className="flex-shrink-0">
                            {podiumColor ? (
                              <div
                                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black"
                                style={{ background: `${podiumColor}20`, color: podiumColor }}
                              >
                                {i + 1}
                              </div>
                            ) : (
                              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium" style={{ color: textMuted, background: isDark ? "oklch(0.25 0.06 145)" : "#f3f4f6" }}>
                                {i + 1}
                              </div>
                            )}
                          </div>

                          {/* Avatar + name */}
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <div className="relative flex-shrink-0">
                              <Avatar url={s.avatarUrl} name={s.displayName} size={9} />
                              {isMe && (
                                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full" style={{ background: accent, border: `2px solid ${cardBg}` }} />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1">
                                <MovementIcon movement={s.movement} />
                                <span className="text-sm font-semibold truncate" style={{ color: isMe ? accent : textMain }}>
                                  {s.displayName}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                {s.chesscomRating && (
                                  <span className="text-[11px] font-medium" style={{ color: textMuted }}>{s.chesscomRating} ELO</span>
                                )}
                                {s.streak && s.streak.length >= 3 && (
                                  <span
                                    className="text-[10px] font-bold px-1 py-0.5 rounded"
                                    style={{
                                      background: s.streak.startsWith("W") ? "#4ade8022" : "#ef444422",
                                      color: s.streak.startsWith("W") ? "#4ade80" : "#ef4444",
                                    }}
                                  >
                                    {s.streak}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Points + record */}
                          <div className="flex flex-col items-end flex-shrink-0">
                            <span className="text-lg font-black" style={{ color: accent }}>{s.points}</span>
                            <span className="text-[11px]" style={{ color: textMuted }}>
                              {s.wins}W {s.draws}D {s.losses}L
                            </span>
                          </div>
                        </div>

                        {/* Form dots row */}
                        {lastArr.length > 0 && (
                          <div className="flex gap-1 mt-2 ml-11">
                            {lastArr.map((r, j) => <ResultDot key={j} r={r} />)}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* League stats summary */}
            {standings.length > 0 && (() => {
              const totalGames = standings.reduce((a, s) => a + s.wins + s.draws + s.losses, 0) / 2;
              const totalDraws = standings.reduce((a, s) => a + s.draws, 0) / 2;
              const drawRate = totalGames > 0 ? Math.round((totalDraws / totalGames) * 100) : 0;
              const highestRated = standings.filter(s => s.chesscomRating).sort((a, b) => (b.chesscomRating ?? 0) - (a.chesscomRating ?? 0))[0];
              const topScorer = standings[0];
              return (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: "Games Played", value: String(totalGames) },
                    { label: "Draw Rate", value: `${drawRate}%` },
                    { label: "Top Scorer", value: topScorer?.displayName ?? "—" },
                    { label: "Highest Rated", value: highestRated ? `${highestRated.displayName} (${highestRated.chesscomRating})` : "—" },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className="rounded-xl p-3.5 text-center"
                      style={{ background: cardBg, border: `1px solid ${cardBorder}` }}
                    >
                      <div className="text-[11px] uppercase tracking-wider mb-1" style={{ color: textMuted }}>{stat.label}</div>
                      <div className="text-sm font-bold truncate" style={{ color: textMain }}>{stat.value}</div>
                    </div>
                  ))}
                </div>
              );
            })()}
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
                        <div className="flex-shrink-0 ml-1">
                          {match.resultStatus === "completed"
                            ? <CheckCircle2 size={14} style={{ color: accent }} />
                            : <Clock size={14} style={{ color: textMuted }} />}
                        </div>
                        {mine && (() => {
                          const oppChessCom = getOpponentChesscom(match);
                          if (!oppChessCom) return null;
                          return (
                            <button
                              onClick={() => navigate(`/prep/${encodeURIComponent(oppChessCom)}`)}
                              className="flex-shrink-0 ml-1 p-1.5 rounded-lg transition-all hover:opacity-80"
                              style={{ background: `${accent}15`, color: accent }}
                              title={`Prep for ${oppChessCom}`}
                            >
                              <Target size={12} />
                            </button>
                          );
                        })()}
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

            {/* View full history page link */}
            <a
              href={`/leagues/${league.id}/history`}
              className="flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold transition-all hover:opacity-90"
              style={{ background: `${accent}18`, color: accent, border: `1px solid ${accent}33` }}
            >
              <BarChart3 size={16} />
              View Full Season History — H2H, Stats & More
              <ChevronRight size={16} />
            </a>

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
          <div className="space-y-4">
            {/* Invite Members section */}
            <div
              className="rounded-3xl overflow-hidden"
              style={{ background: cardBg, border: `1px solid ${cardBorder}` }}
            >
              <div className="px-4 pt-4 pb-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold" style={{ color: textMain }}>Invite Club Members</p>
                  <p className="text-xs mt-0.5" style={{ color: textMuted }}>Proactively invite specific members to join this league</p>
                </div>
                <button
                  onClick={() => setShowInvitePicker((v) => !v)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
                  style={{ background: showInvitePicker ? `${accent}22` : accent, color: showInvitePicker ? accent : "#fff" }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    {showInvitePicker
                      ? <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>
                      : <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>}
                  </svg>
                  {showInvitePicker ? "Close" : "Invite Members"}
                </button>
              </div>
              {showInvitePicker && (
                <div className="px-4 pb-4 space-y-3" style={{ borderTop: `1px solid ${cardBorder}` }}>
                  <div className="pt-3">
                    <input
                      type="text"
                      placeholder="Search members…"
                      value={inviteSearch}
                      onChange={(e) => setInviteSearch(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                      style={{
                        background: isDark ? "oklch(0.22 0.06 145)" : "#f9fafb",
                        border: `1px solid ${cardBorder}`,
                        color: textMain,
                      }}
                    />
                  </div>
                  {clubMembers.length === 0 ? (
                    <div className="py-6 text-center">
                      <span className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin inline-block" style={{ borderColor: `${accent} transparent ${accent} ${accent}` }} />
                      <p className="text-xs mt-2" style={{ color: textMuted }}>Loading members…</p>
                    </div>
                  ) : (
                    <div className="space-y-1 max-h-72 overflow-y-auto">
                      {clubMembers
                        .filter((m) => {
                          if (!inviteSearch) return true;
                          const q = inviteSearch.toLowerCase();
                          return m.displayName.toLowerCase().includes(q) || (m.chesscomUsername ?? "").toLowerCase().includes(q);
                        })
                        .filter((m) => m.userId !== user?.id) // exclude commissioner
                        .map((m) => {
                          const existingInvite = sentInvites.find((inv) => inv.invitedUserId === m.userId);
                          const alreadyInLeague = league.players.some((p) => p.playerId === m.userId);
                          const isPending = existingInvite?.status === "pending";
                          const isAccepted = existingInvite?.status === "accepted" || alreadyInLeague;
                          return (
                            <div
                              key={m.userId}
                              className="flex items-center gap-3 px-3 py-2.5 rounded-2xl"
                              style={{ background: isDark ? "oklch(0.22 0.06 145)" : "#f9fafb" }}
                            >
                              <Avatar url={m.avatarUrl} name={m.displayName} size={8} />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate" style={{ color: textMain }}>{m.displayName}</p>
                                {m.chesscomUsername && (
                                  <p className="text-xs truncate" style={{ color: textMuted }}>chess.com/{m.chesscomUsername}</p>
                                )}
                              </div>
                              {isAccepted ? (
                                <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: "#4ade8022", color: "#4ade80" }}>In League</span>
                              ) : isPending ? (
                                <button
                                  onClick={() => existingInvite && handleCancelInvite(existingInvite.id)}
                                  disabled={cancellingInviteId === existingInvite?.id}
                                  className="text-xs font-semibold px-2.5 py-1 rounded-full transition-all"
                                  style={{ background: isDark ? "rgba(239,68,68,0.12)" : "#fef2f2", color: "#ef4444" }}
                                >
                                  {cancellingInviteId === existingInvite?.id ? "…" : "Cancel Invite"}
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleSendInvite(m.userId)}
                                  disabled={sendingInviteId === m.userId}
                                  className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full transition-all"
                                  style={{ background: `${accent}22`, color: accent }}
                                >
                                  {sendingInviteId === m.userId ? (
                                    <span className="w-3 h-3 rounded-full border border-t-transparent animate-spin inline-block" style={{ borderColor: `${accent} transparent ${accent} ${accent}` }} />
                                  ) : (
                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                                  )}
                                  Invite
                                </button>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              )}
            </div>
            {/* ── Join Requests section ── */}
            <div
              className="rounded-3xl overflow-hidden"
              style={{ background: cardBg, border: `1px solid ${cardBorder}` }}
            >
            <div className="px-4 pt-4 pb-3 flex items-center justify-between">
              <p className="text-sm font-semibold" style={{ color: textMain }}>Join Requests</p>
              <span className="text-xs" style={{ color: textMuted }}>{joinRequests.length} pending</span>
            </div>
            {/* Push notification prompt for commissioners who haven't subscribed */}
            {pushStatus === "idle" && (
              <div
                className="rounded-2xl px-4 py-3 flex items-center gap-3"
                style={{ background: `${accent}0d`, border: `1px solid ${accent}22` }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold" style={{ color: textMain }}>Get notified instantly</p>
                  <p className="text-xs" style={{ color: textMuted }}>Enable push notifications to be alerted when a player requests to join.</p>
                </div>
                <button
                  onClick={handleSubscribePush}
                  disabled={pushLoading}
                  className="text-xs font-semibold flex-shrink-0 px-3 py-1.5 rounded-xl"
                  style={{ background: accent, color: "#fff" }}
                >
                  {pushLoading ? "..." : "Enable"}
                </button>
              </div>
            )}
            {pushStatus === "subscribed" && (
              <div
                className="rounded-2xl px-4 py-3 flex items-center gap-2"
                style={{ background: "oklch(0.55 0.13 145 / 0.08)", border: "1px solid oklch(0.55 0.13 145 / 0.2)" }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                <p className="text-xs flex-1" style={{ color: textMain }}>Push notifications are <strong>on</strong> — you’ll be alerted on this device when someone requests to join.</p>
                <button onClick={handleUnsubscribePush} className="text-xs flex-shrink-0" style={{ color: textMuted }}>Turn off</button>
              </div>
            )}
            {pushStatus === "denied" && (
              <div className="rounded-2xl px-4 py-3" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                <p className="text-xs" style={{ color: "#ef4444" }}>Notifications are blocked in your browser. To enable them, update your browser’s site settings and refresh.</p>
              </div>
            )}
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
            </div>
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
          </div>{/* end main content column */}

          {/* ── SIDEBAR (desktop only) ─────────────────────────────────── */}
          <div className="hidden lg:flex flex-col gap-4 w-72 flex-shrink-0">
            {/* Mini standings */}
            {standings.length > 0 && (
              <div
                className="rounded-2xl overflow-hidden"
                style={{ background: isDark ? "oklch(0.19 0.06 145)" : "#fff", border: `1px solid ${cardBorder}` }}
              >
                <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${cardBorder}` }}>
                  <span className="text-xs font-bold uppercase tracking-wide" style={{ color: accent }}>Standings</span>
                  <button onClick={() => setActiveTab("standings")} className="text-xs" style={{ color: textMuted }}>See all →</button>
                </div>
                <div className="divide-y" style={{ borderColor: cardBorder }}>
                  {standings.slice(0, 5).map((p, i) => (
                    <div key={p.playerId} className="flex items-center gap-2.5 px-4 py-2.5">
                      <span className="text-xs font-bold w-4 text-center" style={{ color: i === 0 ? "oklch(0.82 0.18 85)" : textMuted }}>#{i + 1}</span>
                      <Avatar url={p.avatarUrl} name={p.displayName} size={7} />
                      <span className="flex-1 text-xs font-medium truncate" style={{ color: textMain }}>{p.displayName}</span>
                      <span className="text-xs font-bold" style={{ color: accent }}>{p.points}pt</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Next match card */}
            {myMatchThisWeek && myMatchThisWeek.resultStatus !== "completed" && (
              <div
                className="rounded-2xl overflow-hidden"
                style={{ background: isDark ? "oklch(0.19 0.06 145)" : "#fff", border: `1.5px solid ${accent}44` }}
              >
                <div className="px-4 py-3" style={{ background: `${accent}12`, borderBottom: `1px solid ${accent}22` }}>
                  <span className="text-xs font-bold uppercase tracking-wide" style={{ color: accent }}>Your Next Match</span>
                </div>
                <div className="px-4 py-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Avatar
                      url={league.players.find(p => p.playerId === (myMatchThisWeek.playerWhiteId === user?.id ? myMatchThisWeek.playerBlackId : myMatchThisWeek.playerWhiteId))?.avatarUrl}
                      name={myMatchThisWeek.playerWhiteId === user?.id ? myMatchThisWeek.playerBlackName : myMatchThisWeek.playerWhiteName}
                      size={8}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: textMain }}>
                        {myMatchThisWeek.playerWhiteId === user?.id ? myMatchThisWeek.playerBlackName : myMatchThisWeek.playerWhiteName}
                      </p>
                      <p className="text-xs" style={{ color: textMuted }}>Week {league.currentWeek}</p>
                    </div>
                  </div>
                  {/* Prep button */}
                  {(() => {
                    const oppUsername = myMatchThisWeek.playerWhiteId === user?.id
                      ? league.players.find(p => p.playerId === myMatchThisWeek.playerBlackId)?.chesscomUsername
                      : league.players.find(p => p.playerId === myMatchThisWeek.playerWhiteId)?.chesscomUsername;
                    return oppUsername ? (
                      <button
                        onClick={() => navigate(`/prep/${oppUsername}`)}
                        className="w-full py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                        style={{ background: `${accent}18`, color: accent }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                        Prep for Opponent
                      </button>
                    ) : null;
                  })()}
                </div>
              </div>
            )}

            {/* Commissioner quick actions */}
            {isCommissioner && league.status === "active" && (
              <div
                className="rounded-2xl overflow-hidden"
                style={{ background: isDark ? "oklch(0.19 0.06 145)" : "#fff", border: `1px solid ${cardBorder}` }}
              >
                <div className="px-4 py-3" style={{ borderBottom: `1px solid ${cardBorder}` }}>
                  <span className="text-xs font-bold uppercase tracking-wide" style={{ color: textMuted }}>Commissioner</span>
                </div>
                <div className="p-3 space-y-2">
                  <button
                    onClick={() => setActiveTab("matchups")}
                    className="w-full py-2.5 rounded-xl text-xs font-semibold transition-all"
                    style={{ background: `${accent}18`, color: accent }}
                  >
                    Report Results
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        const res = await fetch(`/api/leagues/${league.id}/advance-week`, { method: "POST", credentials: "include" });
                        if (res.ok) { showToast("Advanced to next week", "success"); fetchAll(); }
                        else { const d = await res.json().catch(() => ({})); showToast(d.error ?? "Failed", "error"); }
                      } catch { showToast("Network error", "error"); }
                    }}
                    className="w-full py-2.5 rounded-xl text-xs font-semibold transition-all"
                    style={{ background: isDark ? "oklch(0.25 0.06 145)" : "#f3f4f6", color: textMain }}
                  >
                    Advance Week →
                  </button>
                </div>
              </div>
            )}
          </div>{/* end sidebar */}
        </div>{/* end flex row */}
      </div>{/* end two-column wrapper */}
      {/* Result report modal */}
      {reportingMatch && (
        <ReportResultModal
          match={reportingMatch}
          isDark={isDark}
          currentUserId={user?.id}
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
