/**
 * Profile page — /profile
 *
 * Shows the signed-in user's account details, chess platform links, ELO,
 * and their tournament history from localStorage.
 * Allows editing display name, chess.com username, and Lichess username.
 */
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { NavLogo } from "@/components/NavLogo";
import {
  User as _User,
  Crown as _Crown,
  Edit3,
  Check,
  X,
  ExternalLink,
  Trophy,
  LogOut,
  Loader2,
  ChevronLeft,
  Shield,
  Trash2,
  AlertTriangle,
  Swords,
  Camera,
  Link2,
  TrendingUp,
} from "lucide-react";
import { useAuthContext } from "../context/AuthContext";
import { RatingProgressChart } from "@/components/RatingProgressChart";
import { AvatarNavDropdown } from "../components/AvatarNavDropdown";
import { listTournaments, TournamentConfig } from "../lib/tournamentRegistry";
import { loadTournamentState } from "../lib/directorState";
import { useMyAnalysedGames } from "../hooks/useMyAnalysedGames";
import AnalysedGameCard from "../components/AnalysedGameCard";
import type { Club } from "../lib/clubRegistry";
import { apiListMyClubs, apiLeaveClub, apiDeleteClub } from "../lib/clubsApi";
import { Users, Settings } from "lucide-react";

interface EditState {
  displayName: string;
  chesscomUsername: string;
  lichessUsername: string;
  fideId: string;
  avatarDataUrl: string | null; // base64 preview before upload
}

function StatBadge({
  label,
  value,
  isDark,
}: {
  label: string;
  value: string | number;
  isDark: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center gap-1 px-5 py-4 rounded-2xl ${
        isDark ? "bg-white/5" : "bg-gray-50"
      }`}
    >
      <span
        className={`text-2xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}
      >
        {value}
      </span>
      <span className={`text-xs ${isDark ? "text-white/40" : "text-gray-400"}`}>
        {label}
      </span>
    </div>
  );
}

/** Compact W/D/L + win-rate badge shown in the stat row. */
function BattleStatBadge({
  wins,
  draws,
  losses,
  loading,
  isDark,
}: {
  wins: number;
  draws: number;
  losses: number;
  loading: boolean;
  isDark: boolean;
}) {
  const total = wins + draws + losses;
  const winRate = total > 0 ? Math.round((wins / total) * 100) : null;
  return (
    <div
      className={`flex flex-col items-center gap-1.5 px-3 py-4 rounded-2xl ${
        isDark ? "bg-white/5" : "bg-gray-50"
      }`}
    >
      {loading ? (
        <span className={`text-2xl font-bold ${isDark ? "text-white/30" : "text-gray-300"}`}>—</span>
      ) : total === 0 ? (
        <span className={`text-2xl font-bold ${isDark ? "text-white/30" : "text-gray-300"}`}>—</span>
      ) : (
        <>
          <div className="flex items-center gap-1.5">
            <span className="text-base font-bold text-[#4ade80]">{wins}W</span>
            <span className={`text-base font-bold ${isDark ? "text-white/40" : "text-gray-400"}`}>{draws}D</span>
            <span className="text-base font-bold text-red-400">{losses}L</span>
          </div>
          {winRate !== null && (
            <div className="flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-[#4ade80]" />
              <span className="text-xs font-bold text-[#4ade80]">{winRate}%</span>
            </div>
          )}
        </>
      )}
      <span className={`text-xs ${isDark ? "text-white/40" : "text-gray-400"}`}>
        Battles
      </span>
    </div>
  );
}

/**
 * Maps a DirectorState status string to a human-readable label and colour.
 * Values: "registration" → Lobby (amber), "in_progress" → Active (green),
 *         "paused" → Paused (orange), "completed" → Complete (muted gray).
 */
function TournamentStatusPill({ status }: { status?: string | null }) {
  const s = status ?? "registration";
  const config: Record<string, { label: string; bg: string; text: string }> = {
    registration: { label: "Lobby", bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-400" },
    in_progress:  { label: "Active", bg: "bg-emerald-100 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-400" },
    paused:       { label: "Paused", bg: "bg-orange-100 dark:bg-orange-900/30", text: "text-orange-700 dark:text-orange-400" },
    completed:    { label: "Complete", bg: "bg-gray-100 dark:bg-white/10", text: "text-gray-500 dark:text-white/40" },
  };
  const { label, bg, text } = config[s] ?? config["registration"];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide flex-shrink-0 ${bg} ${text}`}>
      {s === "in_progress" && (
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1 animate-pulse" />
      )}
      {label}
    </span>
  );
}

export default function ProfilePage() {
  const { user, loading, logout, updateProfile } = useAuthContext();
  const [, navigate] = useLocation();
  const [isDark, setIsDark] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState>({
    displayName: "",
    chesscomUsername: "",
    lichessUsername: "",
    fideId: "",
    avatarDataUrl: null,
  });

  // Detect dark mode from html element class
  useEffect(() => {
    const check = () =>
      setIsDark(document.documentElement.classList.contains("dark"));
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  // Redirect to home if not signed in (after loading)
  useEffect(() => {
    if (!loading && !user) navigate("/");
  }, [loading, user, navigate]);

  // Sync edit state when user changes
  useEffect(() => {
    if (user) {
      setEditState({
        displayName: user.displayName,
        chesscomUsername: user.chesscomUsername ?? "",
        lichessUsername: user.lichessUsername ?? "",
        fideId: user.fideId ?? "",
        avatarDataUrl: null,
      });
    }
  }, [user]);

  // ── Battle history ──────────────────────────────────────────────────────────
  interface BattleEntry {
    id: string;
    code: string;
    outcome: "win" | "loss" | "draw";
    result: string | null;
    isHost: boolean;
    opponent: { id: string | null; displayName: string; avatarUrl: string | null; chesscomUsername: string | null } | null;
    completedAt: string | null;
    createdAt: string;
  }
  const [battleHistory, setBattleHistory] = useState<BattleEntry[] | null>(null);
  const [battleHistoryLoading, setBattleHistoryLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    setBattleHistoryLoading(true);
    fetch("/api/battles/history", { credentials: "include" })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.history) setBattleHistory(data.history); })
      .catch(() => {})
      .finally(() => setBattleHistoryLoading(false));
  }, [user]);

  const battleWins   = (battleHistory ?? []).filter((b) => b.outcome === "win").length;
  const battleLosses = (battleHistory ?? []).filter((b) => b.outcome === "loss").length;
  const battleDraws  = (battleHistory ?? []).filter((b) => b.outcome === "draw").length;

  function formatBattleDate(iso: string | null): string {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }

  // Fetch analysed games from LNM pipeline
  const analysedGames = useMyAnalysedGames();

  // ── My Clubs ────────────────────────────────────────────────────────────────
  const [myClubs, setMyClubs] = useState<Club[] | null>(null);
  const [clubsLoading, setClubsLoading] = useState(false);
  const [confirmDeleteClubId, setConfirmDeleteClubId] = useState<string | null>(null);
  const [confirmLeaveClubId, setConfirmLeaveClubId] = useState<string | null>(null);
  const [clubActionLoading, setClubActionLoading] = useState<string | null>(null);
  const [clubActionError, setClubActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setClubsLoading(true);
    apiListMyClubs()
      .then((clubs) => setMyClubs(clubs))
      .catch(() => setMyClubs([]))
      .finally(() => setClubsLoading(false));
  }, [user]);

  async function handleDeleteClub(clubId: string) {
    setClubActionLoading(clubId);
    setClubActionError(null);
    setConfirmDeleteClubId(null);
    const result = await apiDeleteClub(clubId);
    if (result.ok) {
      setMyClubs((prev) => prev ? prev.filter((c) => c.id !== clubId) : prev);
    } else {
      setClubActionError(result.error ?? "Failed to delete club");
    }
    setClubActionLoading(null);
  }

  async function handleLeaveClub(clubId: string) {
    if (!user) return;
    setClubActionLoading(clubId);
    setClubActionError(null);
    setConfirmLeaveClubId(null);
    const ok = await apiLeaveClub(clubId, user.id);
    if (ok) {
      setMyClubs((prev) => prev ? prev.filter((c) => c.id !== clubId) : prev);
    } else {
      setClubActionError("Failed to leave club. Please try again.");
    }
    setClubActionLoading(null);
  }

  // Fetch tournaments from API (cross-device) when signed in; fall back to localStorage
  const [apiTournaments, setApiTournaments] = useState<Array<{
    id: string; tournamentId: string; name: string; venue?: string | null;
    date?: string | null; format?: string | null; rounds?: number | null;
    inviteCode?: string | null; status?: string | null; createdAt: string;
  }> | null>(null);
  const [tournamentsLoading, setTournamentsLoading] = useState(false);
  // Delete state: which tournament is pending confirmation, and which is being deleted
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDeleteTournament(tournamentId: string) {
    setDeletingId(tournamentId);
    setConfirmDeleteId(null);
    try {
      const res = await fetch(`/api/auth/user/tournaments/${encodeURIComponent(tournamentId)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        // Optimistically remove from local state
        setApiTournaments((prev) => prev ? prev.filter((t) => t.tournamentId !== tournamentId) : prev);
      }
    } catch {
      // Silent fail — list will refresh on next page load
    } finally {
      setDeletingId(null);
    }
  }

  useEffect(() => {
    if (!user) return;
    setTournamentsLoading(true);
    fetch("/api/auth/user/tournaments", { credentials: "include" })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.tournaments) setApiTournaments(data.tournaments);
      })
      .catch(() => { /* fall back to localStorage */ })
      .finally(() => setTournamentsLoading(false));
  }, [user]);

  const localTournaments: TournamentConfig[] = listTournaments();
  // Merge: API tournaments take precedence; fill in any local-only ones
  const apiIds = new Set((apiTournaments ?? []).map((t) => t.tournamentId));
  const localOnly = localTournaments.filter((t) => !apiIds.has(t.id));
  const tournamentCount = (apiTournaments?.length ?? 0) + localOnly.length;

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      await updateProfile({
        displayName: editState.displayName,
        chesscomUsername: editState.chesscomUsername || undefined,
        lichessUsername: editState.lichessUsername || undefined,
        fideId: editState.fideId || undefined,
        avatarUrl: editState.avatarDataUrl || undefined,
      });
      setEditing(false);
    } catch (err) {
      setSaveError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setEditState((s) => ({ ...s, avatarDataUrl: dataUrl }));
    };
    reader.readAsDataURL(file);
  }

  async function handleLogout() {
    await logout();
    navigate("/");
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#2d6a4f]" />
      </div>
    );
  }

  const bg = isDark ? "bg-[#0d1f12]" : "bg-gray-50";
  const card = isDark ? "bg-white/5 border-white/10" : "bg-white border-gray-200";
  const text = isDark ? "text-white" : "text-gray-900";
  const muted = isDark ? "text-white/50" : "text-gray-500";
  const inputCls = `w-full rounded-xl border px-4 py-3 text-base outline-none transition ${
    isDark
      ? "bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-[#4ade80]"
      : "bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-[#2d6a4f]"
  }`;

  // Initials avatar fallback
  const initials = user.displayName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const elo = user.chesscomElo ?? user.lichessElo;

  return (
    <div className={`min-h-screen ${bg}`}>
      {/* Top nav */}
      <div
        className={`sticky top-0 z-10 flex items-center justify-between px-4 py-4 border-b otb-header-safe ${
          isDark ? "border-white/10 bg-[#0d1f12]/90" : "border-gray-200 bg-white/90"
        } backdrop-blur-sm`}
      >
        <button
          onClick={() => navigate("/")}
          className={`flex items-center gap-1.5 text-sm font-medium ${muted} hover:${text} transition`}
        >
          <ChevronLeft className="w-4 h-4" />
          Home
        </button>
        <NavLogo linked={false} />
        <AvatarNavDropdown currentPage="Tournaments" />
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Avatar + name card */}
        <div className={`rounded-3xl border p-6 ${card}`}>
          <div className="flex items-start justify-between mb-5">
            <div className="flex items-center gap-4">
              {/* Avatar */}
              <div className="relative">
                {(editState.avatarDataUrl ?? user.avatarUrl) ? (
                  <img
                    src={editState.avatarDataUrl ?? user.avatarUrl!}
                    alt={user.displayName}
                    className="w-16 h-16 rounded-2xl object-cover"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-[#2d6a4f] flex items-center justify-center">
                    <span className="text-white text-xl font-bold">{initials}</span>
                  </div>
                )}
                {editing ? (
                  <label className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#2d6a4f] border-2 border-white flex items-center justify-center cursor-pointer hover:bg-[#245a41] transition">
                    <Camera className="w-3 h-3 text-white" />
                    <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                  </label>
                ) : (
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#4ade80] border-2 border-white flex items-center justify-center">
                    <Check className="w-2.5 h-2.5 text-[#0d1f12]" />
                  </div>
                )}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className={`text-xl font-bold ${text}`}>{user.displayName}</h1>
                  {user.isStaff && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[10px] font-bold tracking-wider uppercase flex-shrink-0">
                      ★ OTB Staff
                    </span>
                  )}
                  {!user.isStaff && user.isPro && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#22c55e]/15 border border-[#22c55e]/30 text-[#22c55e] text-[10px] font-bold tracking-wider uppercase flex-shrink-0">
                      ★ Pro
                    </span>
                  )}
                </div>
                <p className={`text-sm ${muted}`}>{user.email}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <Shield className="w-3.5 h-3.5 text-[#2d6a4f]" />
                  <span className="text-xs text-[#2d6a4f] font-medium">Verified account</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => {
                setEditing((e) => !e);
                setSaveError(null);
              }}
              className={`flex items-center gap-1.5 text-sm px-3 py-2 rounded-xl transition ${
                isDark
                  ? "bg-white/5 text-white/60 hover:bg-white/10"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              {editing ? "Cancel" : "Edit"}
            </button>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <StatBadge label="Tournaments" value={tournamentCount} isDark={isDark} />
            <StatBadge label="ELO" value={elo ?? "—"} isDark={isDark} />
            <StatBadge
              label="Member since"
              value={new Date(user.createdAt).getFullYear()}
              isDark={isDark}
            />
            <BattleStatBadge
              wins={battleWins}
              draws={battleDraws}
              losses={battleLosses}
              loading={battleHistoryLoading}
              isDark={isDark}
            />
          </div>

          {/* Edit form */}
          {editing ? (
            <div className="space-y-4 pt-4 border-t border-white/10">
              {saveError && (
                <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
                  {saveError}
                </div>
              )}
              <div>
                <label className={`block text-sm font-medium mb-1.5 ${muted}`}>
                  Display name
                </label>
                <input
                  type="text"
                  value={editState.displayName}
                  onChange={(e) =>
                    setEditState((s) => ({ ...s, displayName: e.target.value }))
                  }
                  className={inputCls}
                />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1.5 ${muted}`}>
                  Chess.com username
                </label>
                <input
                  type="text"
                  value={editState.chesscomUsername}
                  onChange={(e) =>
                    setEditState((s) => ({ ...s, chesscomUsername: e.target.value }))
                  }
                  placeholder="your-chess-username"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1.5 ${muted}`}>
                  Lichess username
                </label>
                <input
                  type="text"
                  value={editState.lichessUsername}
                  onChange={(e) =>
                    setEditState((s) => ({ ...s, lichessUsername: e.target.value }))
                  }
                  placeholder="your-lichess-username"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1.5 ${muted}`}>
                  FIDE ID
                </label>
                <input
                  type="text"
                  value={editState.fideId}
                  onChange={(e) =>
                    setEditState((s) => ({ ...s, fideId: e.target.value }))
                  }
                  placeholder="e.g. 1503014"
                  className={inputCls}
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-[#2d6a4f] hover:bg-[#245a41] text-white font-semibold py-3 text-sm transition disabled:opacity-60"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Check className="w-4 h-4" /> Save changes
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    setEditing(false);
                    setSaveError(null);
                  }}
                  className={`flex items-center gap-1.5 px-4 rounded-xl text-sm font-medium transition ${
                    isDark
                      ? "bg-white/5 text-white/60 hover:bg-white/10"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  <X className="w-4 h-4" /> Cancel
                </button>
              </div>
            </div>
          ) : (
            /* Platform links (read-only) */
            <div className="space-y-2 pt-4 border-t border-white/10">
              {user.chesscomUsername && (
                <a
                  href={`https://chess.com/member/${user.chesscomUsername}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center justify-between px-4 py-3 rounded-xl transition ${
                    isDark ? "bg-white/5 hover:bg-white/10" : "bg-gray-50 hover:bg-gray-100"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">♟️</span>
                    <div>
                      <p className={`text-sm font-medium ${text}`}>Chess.com</p>
                      <p className={`text-xs ${muted}`}>@{user.chesscomUsername}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {user.chesscomElo && (
                      <span className="text-xs font-bold text-[#2d6a4f] bg-[#2d6a4f]/10 px-2 py-0.5 rounded-full">
                        {user.chesscomElo}
                      </span>
                    )}
                    <ExternalLink className={`w-3.5 h-3.5 ${muted}`} />
                  </div>
                </a>
              )}
              {user.lichessUsername && (
                <a
                  href={`https://lichess.org/@/${user.lichessUsername}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center justify-between px-4 py-3 rounded-xl transition ${
                    isDark ? "bg-white/5 hover:bg-white/10" : "bg-gray-50 hover:bg-gray-100"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">🏛️</span>
                    <div>
                      <p className={`text-sm font-medium ${text}`}>Lichess</p>
                      <p className={`text-xs ${muted}`}>@{user.lichessUsername}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {user.lichessElo && (
                      <span className="text-xs font-bold text-[#2d6a4f] bg-[#2d6a4f]/10 px-2 py-0.5 rounded-full">
                        {user.lichessElo}
                      </span>
                    )}
                    <ExternalLink className={`w-3.5 h-3.5 ${muted}`} />
                  </div>
                </a>
              )}
              {user.fideId && (
                <a
                  href={`https://ratings.fide.com/profile/${user.fideId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center justify-between px-4 py-3 rounded-xl transition ${
                    isDark ? "bg-white/5 hover:bg-white/10" : "bg-gray-50 hover:bg-gray-100"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Link2 className="w-5 h-5 text-[#2d6a4f]" />
                    <div>
                      <p className={`text-sm font-medium ${text}`}>FIDE Profile</p>
                      <p className={`text-xs ${muted}`}>ID: {user.fideId}</p>
                    </div>
                  </div>
                  <ExternalLink className={`w-3.5 h-3.5 ${muted}`} />
                </a>
              )}
              {!user.chesscomUsername && !user.lichessUsername && !user.fideId && (
                <p className={`text-sm text-center py-3 ${muted}`}>
                  No chess platform linked yet.{" "}
                  <button
                    onClick={() => setEditing(true)}
                    className="text-[#2d6a4f] font-medium hover:underline"
                  >
                    Add one
                  </button>
                </p>
              )}
            </div>
          )}
        </div>

        {/* Rating Progress card */}
        {user.chesscomUsername && (
          <RatingProgressChart isDark={isDark} />
        )}

        {/* Tournaments card */}
        <div className={`rounded-3xl border p-6 ${card}`}>
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="w-5 h-5 text-[#2d6a4f]" />
            <h2 className={`text-base font-bold ${text}`}>Your Tournaments</h2>
            {tournamentsLoading && (
              <Loader2 className="w-4 h-4 animate-spin text-[#2d6a4f] ml-auto" />
            )}
          </div>
          {tournamentCount === 0 ? (
            <div className="text-center py-6">
              <p className={`text-sm ${muted}`}>No tournaments yet.</p>
              <button
                onClick={() => navigate("/")}
                className="mt-3 text-sm text-[#2d6a4f] font-medium hover:underline"
              >
                Host your first tournament →
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {[
                ...(apiTournaments ?? []).map((t) => ({ id: t.tournamentId, name: t.name, format: t.format ?? "Swiss", status: t.status ?? "registration", isApi: true })),
                ...localOnly.map((t: TournamentConfig) => {
                  const localState = loadTournamentState(t.id);
                  return { id: t.id, name: t.name, format: t.format ?? "Swiss", status: localState?.status ?? "registration", isApi: false };
                }),
              ]
                .slice(0, 5)
                .map((t) => (
                  <div key={t.id} className="relative group">
                    {/* Confirmation overlay */}
                    {confirmDeleteId === t.id && (
                      <div className={`absolute inset-0 z-10 flex items-center justify-between gap-2 px-4 py-3 rounded-xl ${
                        isDark ? "bg-red-900/60 border border-red-500/40" : "bg-red-50 border border-red-200"
                      }`}>
                        <div className="flex items-center gap-2 min-w-0">
                          <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                          <span className={`text-xs font-medium truncate ${isDark ? "text-red-300" : "text-red-700"}`}>
                            Delete "{t.name}"?
                          </span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className={`text-xs px-2.5 py-1 rounded-lg font-medium transition ${
                              isDark ? "bg-white/10 text-white/70 hover:bg-white/20" : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                            }`}
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleDeleteTournament(t.id)}
                            className="text-xs px-2.5 py-1 rounded-lg font-medium bg-red-500 text-white hover:bg-red-600 transition"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                    <a
                      href={`/tournament/${t.id}/manage`}
                      className={`flex items-center justify-between px-4 py-3 rounded-xl transition ${
                        isDark ? "bg-white/5 hover:bg-white/10" : "bg-gray-50 hover:bg-gray-100"
                      } ${confirmDeleteId === t.id ? "opacity-0 pointer-events-none" : ""}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="min-w-0">
                          <p className={`text-sm font-medium ${text} truncate`}>{t.name}</p>
                          <p className={`text-xs ${muted}`}>{t.format ?? "Swiss"}</p>
                        </div>
                        <TournamentStatusPill status={t.status} />
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                        {t.isApi && (
                          <button
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmDeleteId(t.id); }}
                            aria-label="Delete tournament"
                            className={`p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all ${
                              isDark
                                ? "text-white/30 hover:text-red-400 hover:bg-red-500/10"
                                : "text-gray-300 hover:text-red-500 hover:bg-red-50"
                            } ${deletingId === t.id ? "opacity-100" : ""}`}
                          >
                            {deletingId === t.id
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              : <Trash2 className="w-3.5 h-3.5" />}
                          </button>
                        )}
                        <ExternalLink className={`w-3.5 h-3.5 ${muted}`} />
                      </div>
                    </a>
                  </div>
                ))}
              {tournamentCount > 5 && (
                <a
                  href="/tournaments"
                  className={`block text-center text-sm py-2 ${muted} hover:text-[#2d6a4f] transition`}
                >
                  View all {tournamentCount} tournaments →
                </a>
              )}
            </div>
          )}
        </div>

        {/* Battle History */}
        <div className={`rounded-3xl border p-6 ${card}`}>
          {/* Header row */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Swords className={`w-4 h-4 ${isDark ? "text-[#4CAF50]" : "text-[#3D6B47]"}`} />
              <h2 className={`text-base font-bold ${text}`}>Battle History</h2>
            </div>
            <a
              href="/battle/history"
              className={`flex items-center gap-1 text-xs font-medium transition ${
                isDark ? "text-[#4CAF50]/70 hover:text-[#4CAF50]" : "text-[#3D6B47]/70 hover:text-[#3D6B47]"
              }`}
            >
              View all
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {/* Win/Loss/Draw summary + win-rate bar */}
          {battleHistory && battleHistory.length > 0 && (() => {
            const total = battleWins + battleDraws + battleLosses;
            const winRate = total > 0 ? Math.round((battleWins / total) * 100) : 0;
            return (
              <div className={`rounded-2xl p-4 mb-5 ${
                isDark ? "bg-white/5" : "bg-gray-50"
              }`}>
                {/* W / D / L counts */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {[
                    { label: "Wins",   value: battleWins,   color: "text-emerald-400", bg: isDark ? "bg-emerald-900/30" : "bg-emerald-50" },
                    { label: "Draws",  value: battleDraws,  color: muted,              bg: isDark ? "bg-white/5"        : "bg-gray-100"   },
                    { label: "Losses", value: battleLosses, color: "text-red-400",     bg: isDark ? "bg-red-900/20"     : "bg-red-50"     },
                  ].map(({ label, value, color, bg }) => (
                    <div key={label} className={`flex flex-col items-center py-2.5 rounded-xl ${bg}`}>
                      <span className={`text-xl font-black ${color}`}>{value}</span>
                      <span className={`text-[10px] font-medium ${muted}`}>{label}</span>
                    </div>
                  ))}
                </div>
                {/* Win-rate bar */}
                <div className="flex items-center gap-2">
                  <div className={`flex-1 h-1.5 rounded-full overflow-hidden ${
                    isDark ? "bg-white/10" : "bg-gray-200"
                  }`}>
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-green-400 transition-all duration-700"
                      style={{ width: `${winRate}%` }}
                    />
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <TrendingUp className="w-3 h-3 text-emerald-400" />
                    <span className="text-xs font-bold text-emerald-400">{winRate}%</span>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Spacer when no data yet */}
          {(!battleHistory || battleHistory.length === 0) && <div className="mb-2" />}

          {battleHistoryLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-[#2d6a4f]" />
            </div>
          ) : !battleHistory || battleHistory.length === 0 ? (
            <div className={`flex flex-col items-center gap-3 py-8 ${muted}`}>
              <Swords className="w-8 h-8 opacity-30" />
              <p className="text-sm text-center">No battles yet.<br />Challenge someone to a 1v1 battle!</p>
              <a
                href="/battle"
                className={`mt-1 text-xs px-4 py-2 rounded-xl font-medium transition ${
                  isDark
                    ? "bg-[#4CAF50]/15 text-[#4CAF50] hover:bg-[#4CAF50]/25"
                    : "bg-[#3D6B47]/10 text-[#3D6B47] hover:bg-[#3D6B47]/20"
                }`}
              >
                Start a Battle
              </a>
            </div>
          ) : (
            <div className="space-y-2">
              {battleHistory.slice(0, 8).map((b) => {
                const outcomeConfig = {
                  win:  { label: "WIN",  bg: isDark ? "bg-emerald-900/40" : "bg-emerald-50",  text: "text-emerald-500",  border: isDark ? "border-emerald-800/50" : "border-emerald-200" },
                  loss: { label: "LOSS", bg: isDark ? "bg-red-900/30"     : "bg-red-50",      text: "text-red-400",     border: isDark ? "border-red-900/40"     : "border-red-200"     },
                  draw: { label: "DRAW", bg: isDark ? "bg-white/5"        : "bg-gray-50",     text: muted,             border: isDark ? "border-white/10"       : "border-gray-200"    },
                }[b.outcome];
                const opponentInitials = b.opponent
                  ? b.opponent.displayName.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)
                  : "?";
                return (
                  <div
                    key={b.id}
                    className={`flex items-center gap-3 px-4 py-3 rounded-2xl border transition ${outcomeConfig.bg} ${outcomeConfig.border}`}
                  >
                    {/* Outcome badge */}
                    <span className={`text-[10px] font-bold tracking-widest w-9 text-center flex-shrink-0 ${outcomeConfig.text}`}>
                      {outcomeConfig.label}
                    </span>

                    {/* VS divider */}
                    <span className={`text-[10px] font-bold ${muted} flex-shrink-0`}>vs</span>

                    {/* Opponent avatar */}
                    <div className="flex-shrink-0">
                      {b.opponent?.avatarUrl ? (
                        <img src={b.opponent.avatarUrl} alt={b.opponent.displayName} className="w-8 h-8 rounded-xl object-cover" />
                      ) : (
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold ${
                          isDark ? "bg-white/10 text-white/60" : "bg-gray-200 text-gray-500"
                        }`}>
                          {opponentInitials}
                        </div>
                      )}
                    </div>

                    {/* Opponent name + username */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${text} truncate`}>
                        {b.opponent?.displayName ?? "Unknown opponent"}
                      </p>
                      {b.opponent?.chesscomUsername && (
                        <p className={`text-xs ${muted} truncate`}>@{b.opponent.chesscomUsername}</p>
                      )}
                    </div>

                    {/* Date */}
                    <span className={`text-xs ${muted} flex-shrink-0`}>
                      {formatBattleDate(b.completedAt ?? b.createdAt)}
                    </span>
                  </div>
                );
              })}
              {battleHistory.length > 8 && (
                <p className={`text-center text-xs pt-1 ${muted}`}>
                  +{battleHistory.length - 8} more battles
                </p>
              )}
            </div>
          )}
        </div>

        {/* My Analysed Games section */}
        <div className={`rounded-3xl border p-6 ${card}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                isDark ? "bg-[#4ade80]/15" : "bg-emerald-50"
              }`}>
                <TrendingUp className={`w-4 h-4 ${isDark ? "text-[#4ade80]" : "text-emerald-600"}`} />
              </div>
              <div>
                <h2 className={`text-base font-bold ${text}`}>My Analysed Games</h2>
                {analysedGames.status === "success" && analysedGames.games.length > 0 && (
                  <p className={`text-xs ${muted}`}>
                    {analysedGames.games.length} game{analysedGames.games.length !== 1 ? "s" : ""} reviewed
                  </p>
                )}
              </div>
            </div>
            {analysedGames.games.length > 0 && (
              <a href="/games" className={`text-xs font-medium transition ${
                isDark ? "text-[#4ade80]/70 hover:text-[#4ade80]" : "text-emerald-600/70 hover:text-emerald-700"
              }`}>View all</a>
            )}
          </div>

          {analysedGames.status === "loading" && (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className={`h-20 rounded-2xl animate-pulse ${
                  isDark ? "bg-white/5" : "bg-gray-100"
                }`} />
              ))}
            </div>
          )}

          {analysedGames.status === "error" && (
            <div className={`flex items-center gap-2 px-4 py-3 rounded-xl ${
              isDark ? "bg-red-500/10 border border-red-500/20" : "bg-red-50 border border-red-200"
            }`}>
              <p className="text-sm text-red-400">{analysedGames.error ?? "Failed to load games"}</p>
              <button onClick={analysedGames.refresh} className="ml-auto text-xs text-red-400 hover:text-red-300 underline">Retry</button>
            </div>
          )}

          {analysedGames.status === "success" && analysedGames.games.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                isDark ? "bg-white/5" : "bg-gray-100"
              }`}>
                <TrendingUp className={`w-6 h-6 ${muted}`} />
              </div>
              <div>
                <p className={`text-sm font-medium ${text}`}>No analysed games yet</p>
                <p className={`text-xs ${muted} mt-0.5`}>Use Live Notation Mode in a Battle to record and analyse your OTB games</p>
              </div>
              <a href="/battle" className={`mt-1 text-xs px-4 py-2 rounded-xl font-medium transition ${
                isDark ? "bg-[#4ade80]/15 text-[#4ade80] hover:bg-[#4ade80]/25" : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              }`}>Start a Battle</a>
            </div>
          )}

          {analysedGames.status === "success" && analysedGames.games.length > 0 && (
            <div className="space-y-3">
              {analysedGames.games.slice(0, 5).map((game) => (
                <AnalysedGameCard key={game.id} game={game} isDark={isDark} />
              ))}
              {analysedGames.games.length > 5 && (
                <p className={`text-center text-xs pt-1 ${muted}`}>+{analysedGames.games.length - 5} more games</p>
              )}
            </div>
          )}
        </div>

        {/* My Clubs management panel */}
        <div className={`rounded-3xl border ${card} overflow-hidden`}>
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                isDark ? "bg-[#4CAF50]/15" : "bg-[#3D6B47]/10"
              }`}>
                <Users className={`w-5 h-5 ${isDark ? "text-[#4CAF50]" : "text-[#3D6B47]"}`} />
              </div>
              <div>
                <p className={`text-sm font-semibold ${text}`}>My Clubs</p>
                <p className={`text-xs ${muted}`}>
                  {clubsLoading ? "Loading..." : myClubs === null ? "" : `${myClubs.length} club${myClubs.length !== 1 ? "s" : ""}`}
                </p>
              </div>
            </div>
            <a
              href="/clubs"
              className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-xl transition ${
                isDark ? "bg-white/5 hover:bg-white/10 text-white/60 hover:text-white" : "bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-700"
              }`}
            >
              <ExternalLink className="w-3 h-3" />
              Discover
            </a>
          </div>

          {/* Error banner */}
          {clubActionError && (
            <div className="mx-5 mb-3 flex items-center gap-2 text-xs text-red-400 bg-red-500/10 rounded-xl px-3 py-2">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              {clubActionError}
              <button onClick={() => setClubActionError(null)} className="ml-auto"><X className="w-3 h-3" /></button>
            </div>
          )}

          {/* Club list */}
          {clubsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className={`w-5 h-5 animate-spin ${muted}`} />
            </div>
          ) : !myClubs || myClubs.length === 0 ? (
            <div className="px-5 pb-5">
              <div className={`rounded-2xl border border-dashed p-6 text-center ${
                isDark ? "border-white/10" : "border-gray-200"
              }`}>
                <p className={`text-sm ${muted} mb-3`}>You haven't joined any clubs yet.</p>
                <a
                  href="/clubs"
                  className={`inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-xl transition ${
                    isDark ? "bg-[#4CAF50]/20 hover:bg-[#4CAF50]/30 text-[#4CAF50]" : "bg-[#3D6B47]/10 hover:bg-[#3D6B47]/20 text-[#3D6B47]"
                  }`}
                >
                  Browse Clubs
                </a>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-white/5 pb-2">
              {myClubs.map((club) => {
                const isOwner = club.ownerId === user?.id;
                const isDeleting = clubActionLoading === club.id;
                const confirmingDelete = confirmDeleteClubId === club.id;
                const confirmingLeave = confirmLeaveClubId === club.id;
                return (
                  <div key={club.id} className={`px-5 py-3.5 ${
                    isDark ? "hover:bg-white/3" : "hover:bg-gray-50"
                  } transition`}>
                    <div className="flex items-center gap-3">
                      {/* Club avatar */}
                      <div
                        className="w-10 h-10 rounded-2xl flex-shrink-0 flex items-center justify-center text-white text-sm font-bold"
                        style={{ backgroundColor: club.accentColor ?? "#3D6B47" }}
                      >
                        {club.name.charAt(0).toUpperCase()}
                      </div>
                      {/* Club info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className={`text-sm font-semibold truncate ${text}`}>{club.name}</p>
                          {isOwner && (
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md flex-shrink-0 ${
                              isDark ? "bg-amber-500/20 text-amber-400" : "bg-amber-100 text-amber-700"
                            }`}>Owner</span>
                          )}
                        </div>
                        <p className={`text-xs truncate ${muted}`}>
                          {club.memberCount ?? 0} member{(club.memberCount ?? 0) !== 1 ? "s" : ""}
                          {club.location ? ` · ${club.location}` : ""}
                        </p>
                      </div>
                      {/* Actions */}
                      {!confirmingDelete && !confirmingLeave && (
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <a
                            href={`/clubs/${club.slug ?? club.id}`}
                            className={`p-1.5 rounded-xl transition ${
                              isDark ? "hover:bg-white/10 text-white/50 hover:text-white" : "hover:bg-gray-100 text-gray-400 hover:text-gray-700"
                            }`}
                            title="View club"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                          {isOwner && (
                            <a
                              href={`/clubs/${club.slug ?? club.id}/dashboard`}
                              className={`p-1.5 rounded-xl transition ${
                                isDark ? "hover:bg-white/10 text-white/50 hover:text-white" : "hover:bg-gray-100 text-gray-400 hover:text-gray-700"
                              }`}
                              title="Manage club"
                            >
                              <Settings className="w-3.5 h-3.5" />
                            </a>
                          )}
                          {isOwner ? (
                            <button
                              onClick={() => setConfirmDeleteClubId(club.id)}
                              disabled={isDeleting}
                              className={`p-1.5 rounded-xl transition ${
                                isDark ? "hover:bg-red-500/20 text-white/30 hover:text-red-400" : "hover:bg-red-50 text-gray-300 hover:text-red-500"
                              }`}
                              title="Delete club"
                            >
                              {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                            </button>
                          ) : (
                            <button
                              onClick={() => setConfirmLeaveClubId(club.id)}
                              disabled={isDeleting}
                              className={`p-1.5 rounded-xl transition text-xs font-medium ${
                                isDark ? "hover:bg-white/10 text-white/30 hover:text-white/70" : "hover:bg-gray-100 text-gray-300 hover:text-gray-600"
                              }`}
                              title="Leave club"
                            >
                              {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Delete confirmation */}
                    {confirmingDelete && (
                      <div className={`mt-3 rounded-2xl p-3 ${
                        isDark ? "bg-red-500/10 border border-red-500/20" : "bg-red-50 border border-red-200"
                      }`}>
                        <p className="text-xs text-red-400 font-medium mb-2">
                          Delete <strong>{club.name}</strong>? This permanently removes all events, members, leagues, and data. This cannot be undone.
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleDeleteClub(club.id)}
                            className="flex-1 text-xs font-semibold py-1.5 rounded-xl bg-red-500 hover:bg-red-600 text-white transition"
                          >
                            Yes, delete permanently
                          </button>
                          <button
                            onClick={() => setConfirmDeleteClubId(null)}
                            className={`flex-1 text-xs font-medium py-1.5 rounded-xl transition ${
                              isDark ? "bg-white/10 hover:bg-white/15 text-white/70" : "bg-gray-100 hover:bg-gray-200 text-gray-600"
                            }`}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Leave confirmation */}
                    {confirmingLeave && (
                      <div className={`mt-3 rounded-2xl p-3 ${
                        isDark ? "bg-amber-500/10 border border-amber-500/20" : "bg-amber-50 border border-amber-200"
                      }`}>
                        <p className="text-xs text-amber-400 font-medium mb-2">
                          Leave <strong>{club.name}</strong>? You can rejoin later.
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleLeaveClub(club.id)}
                            className="flex-1 text-xs font-semibold py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white transition"
                          >
                            Yes, leave club
                          </button>
                          <button
                            onClick={() => setConfirmLeaveClubId(null)}
                            className={`flex-1 text-xs font-medium py-1.5 rounded-xl transition ${
                              isDark ? "bg-white/10 hover:bg-white/15 text-white/70" : "bg-gray-100 hover:bg-gray-200 text-gray-600"
                            }`}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {/* Create new club CTA */}
              <div className="px-5 pt-3 pb-4">
                <a
                  href="/clubs/new"
                  className={`flex items-center justify-center gap-2 w-full py-2.5 rounded-2xl text-xs font-semibold border border-dashed transition ${
                    isDark
                      ? "border-[#4CAF50]/30 text-[#4CAF50]/70 hover:border-[#4CAF50]/60 hover:text-[#4CAF50] hover:bg-[#4CAF50]/5"
                      : "border-[#3D6B47]/30 text-[#3D6B47]/70 hover:border-[#3D6B47]/60 hover:text-[#3D6B47] hover:bg-[#3D6B47]/5"
                  }`}
                >
                  + Create a new club
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Danger zone */}
        <div className={`rounded-3xl border p-6 ${card}`}>
          <h2 className={`text-base font-bold mb-3 ${text}`}>Account</h2>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm text-red-400 hover:text-red-300 transition"
          >
            <LogOut className="w-4 h-4" />
            Sign out of all devices
          </button>
        </div>
      </div>
    </div>
  );
}
