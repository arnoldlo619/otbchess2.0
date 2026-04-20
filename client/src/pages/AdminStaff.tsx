/**
 * AdminStaff.tsx — Protected staff management page.
 *
 * Only accessible to users with isStaff = true.
 * Allows:
 *  - Searching users by email and granting/revoking staff access
 *  - Viewing all current staff members
 *  - Browsing all registered (non-guest) users with staff/pro toggle
 */
import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  Search,
  UserPlus,
  UserMinus,
  Crown,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  ArrowLeft,
  RefreshCw,
  Users,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useAuthContext } from "@/context/AuthContext";

// ─── Types ────────────────────────────────────────────────────────────────────
interface AdminUser {
  id: string;
  displayName: string;
  email: string;
  chesscomUsername: string | null;
  isPro: boolean;
  isStaff: boolean;
  isGuest?: boolean;
  createdAt: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

function UserRow({
  member,
  currentUserId,
  actionLoading,
  onGrant,
  onRevoke,
}: {
  member: AdminUser;
  currentUserId?: string;
  actionLoading: string | null;
  onGrant: (email: string) => void;
  onRevoke: (email: string) => void;
}) {
  const isSelf = member.id === currentUserId;
  const isActing = actionLoading === member.email;

  return (
    <motion.div
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-white/10 transition-colors"
    >
      {/* Avatar + info */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold ${
          member.isStaff
            ? "bg-amber-500/20 border border-amber-500/30 text-amber-400"
            : "bg-white/10 border border-white/10 text-white/60"
        }`}>
          {(member.displayName || member.email || "?").charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-sm font-semibold text-white truncate">{member.displayName}</p>
            {member.isStaff && (
              <span className="px-1.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[9px] font-bold tracking-wider uppercase flex-shrink-0">
                ★ Staff
              </span>
            )}
            {member.isPro && !member.isStaff && (
              <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-[#22c55e]/15 border border-[#22c55e]/30 text-[#22c55e] text-[9px] font-bold flex-shrink-0">
                <Crown className="w-2.5 h-2.5" /> Pro
              </span>
            )}
            {isSelf && (
              <span className="text-[9px] text-white/25 flex-shrink-0">you</span>
            )}
          </div>
          <p className="text-xs text-white/40 truncate">{member.email}</p>
          {member.chesscomUsername && (
            <p className="text-[10px] text-white/25 truncate">chess.com/{member.chesscomUsername}</p>
          )}
        </div>
      </div>

      {/* Action button */}
      {!isSelf && (
        <div className="flex-shrink-0">
          {!member.isStaff ? (
            <button
              onClick={() => onGrant(member.email)}
              disabled={isActing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-400 text-xs font-semibold transition-colors disabled:opacity-40"
            >
              {isActing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
              Grant Staff
            </button>
          ) : (
            <button
              onClick={() => onRevoke(member.email)}
              disabled={isActing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-xs font-semibold transition-colors disabled:opacity-40"
            >
              {isActing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserMinus className="w-3.5 h-3.5" />}
              Revoke
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AdminStaff() {
  const { user, loading: authLoading } = useAuthContext();
  const [, navigate] = useLocation();

  // Staff list
  const [staffList, setStaffList] = useState<AdminUser[]>([]);
  const [staffLoading, setStaffLoading] = useState(true);
  const [staffError, setStaffError] = useState<string | null>(null);

  // All users
  const [allUsers, setAllUsers] = useState<AdminUser[]>([]);
  const [allUsersLoading, setAllUsersLoading] = useState(false);
  const [allUsersError, setAllUsersError] = useState<string | null>(null);
  const [showAllUsers, setShowAllUsers] = useState(false);
  const [userFilter, setUserFilter] = useState("");

  // Search
  const [searchEmail, setSearchEmail] = useState("");
  const [searchResult, setSearchResult] = useState<AdminUser | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Actions
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // ── Auth guard ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!authLoading && (!user || !user.isStaff)) {
      navigate("/");
    }
  }, [user, authLoading, navigate]);

  // ── Toast auto-dismiss ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // ── Fetch staff list ─────────────────────────────────────────────────────────
  const fetchStaff = useCallback(async () => {
    setStaffLoading(true);
    setStaffError(null);
    const { ok, data } = await apiFetch("/api/admin/staff");
    if (ok) setStaffList(data.staff ?? []);
    else setStaffError(data.error ?? "Failed to load staff list.");
    setStaffLoading(false);
  }, []);

  useEffect(() => {
    if (user?.isStaff) fetchStaff();
  }, [user, fetchStaff]);

  // ── Fetch all users ──────────────────────────────────────────────────────────
  const fetchAllUsers = useCallback(async () => {
    setAllUsersLoading(true);
    setAllUsersError(null);
    const { ok, data } = await apiFetch("/api/admin/staff/users");
    if (ok) setAllUsers(data.users ?? []);
    else setAllUsersError(data.error ?? "Failed to load users.");
    setAllUsersLoading(false);
  }, []);

  useEffect(() => {
    if (showAllUsers && allUsers.length === 0 && !allUsersLoading) {
      fetchAllUsers();
    }
  }, [showAllUsers, allUsers.length, allUsersLoading, fetchAllUsers]);

  // ── Search ───────────────────────────────────────────────────────────────────
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchEmail.trim()) return;
    setSearchLoading(true);
    setSearchError(null);
    setSearchResult(null);
    const { ok, data } = await apiFetch(
      `/api/admin/staff/search?email=${encodeURIComponent(searchEmail.trim())}`
    );
    if (ok) setSearchResult(data.user);
    else setSearchError(data.error ?? "User not found.");
    setSearchLoading(false);
  };

  // ── Grant / Revoke ───────────────────────────────────────────────────────────
  const handleGrant = async (email: string) => {
    setActionLoading(email);
    const { ok, data } = await apiFetch("/api/admin/staff/grant", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
    if (ok) {
      setToast({ type: "success", message: data.message ?? `Staff access granted to ${email}.` });
      await fetchStaff();
      if (allUsers.length > 0) await fetchAllUsers();
      if (searchResult?.email.toLowerCase() === email.toLowerCase()) {
        setSearchResult((prev) => prev ? { ...prev, isStaff: true } : prev);
      }
    } else {
      setToast({ type: "error", message: data.error ?? "Failed to grant staff access." });
    }
    setActionLoading(null);
  };

  const handleRevoke = async (email: string) => {
    setActionLoading(email);
    const { ok, data } = await apiFetch("/api/admin/staff/revoke", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
    if (ok) {
      setToast({ type: "success", message: data.message ?? `Staff access revoked from ${email}.` });
      await fetchStaff();
      if (allUsers.length > 0) await fetchAllUsers();
      if (searchResult?.email.toLowerCase() === email.toLowerCase()) {
        setSearchResult((prev) => prev ? { ...prev, isStaff: false } : prev);
      }
    } else {
      setToast({ type: "error", message: data.error ?? "Failed to revoke staff access." });
    }
    setActionLoading(null);
  };

  // ── Loading / redirect states ────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0d1f12] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#4CAF50] animate-spin" />
      </div>
    );
  }
  if (!user?.isStaff) return null;

  // Filtered users for the all-users panel
  const filteredUsers = userFilter.trim()
    ? allUsers.filter(
        (u) =>
          u.email.toLowerCase().includes(userFilter.toLowerCase()) ||
          u.displayName.toLowerCase().includes(userFilter.toLowerCase()) ||
          (u.chesscomUsername ?? "").toLowerCase().includes(userFilter.toLowerCase())
      )
    : allUsers;

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0d1f12] text-white">

      {/* ── Toast ── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key="toast"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl text-sm font-medium border ${
              toast.type === "success"
                ? "bg-[#0d1f12] border-[#4CAF50]/40 text-[#4CAF50]"
                : "bg-[#1a0a0a] border-red-500/40 text-red-400"
            }`}
          >
            {toast.type === "success"
              ? <CheckCircle className="w-4 h-4 flex-shrink-0" />
              : <XCircle className="w-4 h-4 flex-shrink-0" />}
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Header ── */}
      <div className="border-b border-white/10 bg-[#0d1f12]/90 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => navigate("/")}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors text-white/60 hover:text-white"
            aria-label="Back to home"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-amber-400" />
            <h1 className="text-lg font-bold text-white">Staff Management</h1>
            <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[10px] font-bold tracking-wider uppercase">
              OTB Admin
            </span>
          </div>
          <div className="ml-auto text-xs text-white/30">
            {allUsers.length > 0 ? `${allUsers.length} registered users` : ""}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">

        {/* ── Search & Grant/Revoke ── */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/[0.04] border border-white/10 rounded-2xl p-6"
        >
          <h2 className="text-base font-semibold text-white mb-1">Find User by Email</h2>
          <p className="text-sm text-white/50 mb-4">
            Search for any registered account and grant or revoke OTB Staff access.
          </p>

          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <input
                type="email"
                value={searchEmail}
                onChange={(e) => {
                  setSearchEmail(e.target.value);
                  setSearchResult(null);
                  setSearchError(null);
                }}
                placeholder="user@example.com"
                className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/[0.06] border border-white/10 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#4CAF50]/50 focus:ring-1 focus:ring-[#4CAF50]/30 transition-colors"
              />
            </div>
            <button
              type="submit"
              disabled={searchLoading || !searchEmail.trim()}
              className="px-4 py-2.5 rounded-xl bg-[#4CAF50] hover:bg-[#43a047] disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors flex items-center gap-2"
            >
              {searchLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Search
            </button>
          </form>

          {searchError && (
            <div className="mt-3 flex items-center gap-2 text-sm text-red-400">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {searchError}
            </div>
          )}

          <AnimatePresence>
            {searchResult && (
              <motion.div
                key="search-result"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-4"
              >
                <UserRow
                  member={searchResult}
                  currentUserId={user?.id}
                  actionLoading={actionLoading}
                  onGrant={handleGrant}
                  onRevoke={handleRevoke}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.section>

        {/* ── Current Staff List ── */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-white/[0.04] border border-white/10 rounded-2xl p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-white">Current Staff</h2>
              <p className="text-sm text-white/50 mt-0.5">
                {staffList.length} member{staffList.length !== 1 ? "s" : ""} with OTB Staff access
              </p>
            </div>
            <button
              onClick={fetchStaff}
              disabled={staffLoading}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors text-white/50 hover:text-white disabled:opacity-40"
              aria-label="Refresh staff list"
            >
              <RefreshCw className={`w-4 h-4 ${staffLoading ? "animate-spin" : ""}`} />
            </button>
          </div>

          {staffError && (
            <div className="flex items-center gap-2 text-sm text-red-400 mb-4">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {staffError}
            </div>
          )}

          {staffLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-[#4CAF50] animate-spin" />
            </div>
          ) : staffList.length === 0 ? (
            <div className="text-center py-12 text-white/30 text-sm">No staff members found.</div>
          ) : (
            <div className="space-y-2">
              {staffList.map((member) => (
                <UserRow
                  key={member.id}
                  member={member}
                  currentUserId={user?.id}
                  actionLoading={actionLoading}
                  onGrant={handleGrant}
                  onRevoke={handleRevoke}
                />
              ))}
            </div>
          )}
        </motion.section>

        {/* ── All Registered Users ── */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white/[0.04] border border-white/10 rounded-2xl overflow-hidden"
        >
          {/* Collapsible header */}
          <button
            onClick={() => setShowAllUsers((v) => !v)}
            className="w-full flex items-center justify-between p-6 hover:bg-white/[0.02] transition-colors"
          >
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-white/50" />
              <div className="text-left">
                <h2 className="text-base font-semibold text-white">All Registered Users</h2>
                <p className="text-sm text-white/50 mt-0.5">
                  Browse and manage all non-guest accounts
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-white/40">
              {allUsers.length > 0 && (
                <span className="text-xs font-medium">{allUsers.length} users</span>
              )}
              {showAllUsers ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </button>

          <AnimatePresence>
            {showAllUsers && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-6 pb-6 space-y-3">
                  {/* Filter input */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                    <input
                      type="text"
                      value={userFilter}
                      onChange={(e) => setUserFilter(e.target.value)}
                      placeholder="Filter by name, email, or chess.com username…"
                      className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/[0.06] border border-white/10 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#4CAF50]/50 focus:ring-1 focus:ring-[#4CAF50]/30 transition-colors"
                    />
                  </div>

                  {/* Refresh */}
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-white/30">
                      {filteredUsers.length} of {allUsers.length} users
                    </p>
                    <button
                      onClick={fetchAllUsers}
                      disabled={allUsersLoading}
                      className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors disabled:opacity-40"
                    >
                      <RefreshCw className={`w-3 h-3 ${allUsersLoading ? "animate-spin" : ""}`} />
                      Refresh
                    </button>
                  </div>

                  {allUsersError && (
                    <div className="flex items-center gap-2 text-sm text-red-400">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                      {allUsersError}
                    </div>
                  )}

                  {allUsersLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-6 h-6 text-[#4CAF50] animate-spin" />
                    </div>
                  ) : filteredUsers.length === 0 ? (
                    <div className="text-center py-8 text-white/30 text-sm">
                      {userFilter ? "No users match your filter." : "No registered users found."}
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                      {filteredUsers.map((member) => (
                        <UserRow
                          key={member.id}
                          member={member}
                          currentUserId={user?.id}
                          actionLoading={actionLoading}
                          onGrant={handleGrant}
                          onRevoke={handleRevoke}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.section>

        {/* ── Info box ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="flex gap-3 p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 text-sm text-amber-300/70"
        >
          <Shield className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-400/60" />
          <p>
            OTB Staff members have full Pro access to all features without a paid subscription.
            Staff status is separate from billing — revoking staff access does not affect a user's
            Pro subscription if they have one. You cannot revoke your own staff access.
          </p>
        </motion.div>

      </div>
    </div>
  );
}
