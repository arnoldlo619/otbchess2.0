/**
 * Profile page — /profile
 *
 * Shows the signed-in user's account details, chess platform links, ELO,
 * and their tournament history from localStorage.
 * Allows editing display name, chess.com username, and Lichess username.
 */
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  User,
  Crown,
  Edit3,
  Check,
  X,
  ExternalLink,
  Trophy,
  LogOut,
  Loader2,
  ChevronLeft,
  Shield,
} from "lucide-react";
import { useAuthContext } from "../context/AuthContext";
import { listTournaments, TournamentConfig } from "../lib/tournamentRegistry";
import { loadTournamentState } from "../lib/directorState";

interface EditState {
  displayName: string;
  chesscomUsername: string;
  lichessUsername: string;
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
      });
    }
  }, [user]);

  // Fetch tournaments from API (cross-device) when signed in; fall back to localStorage
  const [apiTournaments, setApiTournaments] = useState<Array<{
    id: string; tournamentId: string; name: string; venue?: string | null;
    date?: string | null; format?: string | null; rounds?: number | null;
    inviteCode?: string | null; status?: string | null; createdAt: string;
  }> | null>(null);
  const [tournamentsLoading, setTournamentsLoading] = useState(false);

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
      });
      setEditing(false);
    } catch (err) {
      setSaveError((err as Error).message);
    } finally {
      setSaving(false);
    }
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
        className={`sticky top-0 z-10 flex items-center justify-between px-4 py-4 border-b ${
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
        <div className="flex items-center gap-2">
          <Crown className="w-5 h-5 text-[#2d6a4f]" />
          <span className={`font-bold text-sm ${text}`}>OTB Chess</span>
        </div>
        <button
          onClick={handleLogout}
          className={`flex items-center gap-1.5 text-sm ${muted} hover:text-red-400 transition`}
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Avatar + name card */}
        <div className={`rounded-3xl border p-6 ${card}`}>
          <div className="flex items-start justify-between mb-5">
            <div className="flex items-center gap-4">
              {/* Avatar */}
              <div className="relative">
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.displayName}
                    className="w-16 h-16 rounded-2xl object-cover"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-[#2d6a4f] flex items-center justify-center">
                    <span className="text-white text-xl font-bold">{initials}</span>
                  </div>
                )}
                <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#4ade80] border-2 border-white flex items-center justify-center">
                  <Check className="w-2.5 h-2.5 text-[#0d1f12]" />
                </div>
              </div>
              <div>
                <h1 className={`text-xl font-bold ${text}`}>{user.displayName}</h1>
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
          <div className="grid grid-cols-3 gap-3 mb-5">
            <StatBadge label="Tournaments" value={tournamentCount} isDark={isDark} />
            <StatBadge label="ELO" value={elo ?? "—"} isDark={isDark} />
            <StatBadge
              label="Member since"
              value={new Date(user.createdAt).getFullYear()}
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
              {!user.chesscomUsername && !user.lichessUsername && (
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
                ...(apiTournaments ?? []).map((t) => ({ id: t.tournamentId, name: t.name, format: t.format ?? "Swiss", status: t.status ?? "registration" })),
                ...localOnly.map((t: TournamentConfig) => {
                  const localState = loadTournamentState(t.id);
                  return { id: t.id, name: t.name, format: t.format ?? "Swiss", status: localState?.status ?? "registration" };
                }),
              ]
                .slice(0, 5)
                .map((t) => (
                  <a
                    key={t.id}
                    href={`/tournament/${t.id}/manage`}
                    className={`flex items-center justify-between px-4 py-3 rounded-xl transition ${
                      isDark ? "bg-white/5 hover:bg-white/10" : "bg-gray-50 hover:bg-gray-100"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="min-w-0">
                        <p className={`text-sm font-medium ${text} truncate`}>{t.name}</p>
                        <p className={`text-xs ${muted}`}>{t.format ?? "Swiss"}</p>
                      </div>
                      <TournamentStatusPill status={t.status} />
                    </div>
                    <ExternalLink className={`w-3.5 h-3.5 flex-shrink-0 ${muted} ml-2`} />
                  </a>
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
