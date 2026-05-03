/**
 * RepertoireList — Lists the user's saved opening repertoires with a statistics dashboard.
 *
 * Free users: limited to 1 saved repertoire (shows Pro upgrade prompt for more).
 * Pro users: unlimited repertoires.
 *
 * Provides "New Repertoire" creation (pick color → auto-create → navigate to builder).
 * Dashboard shows: total moves, max depth, unique lines, and last-updated per repertoire.
 */
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/hooks/useAuth";
import { authFetch } from "@/lib/apiFetch";
import { useLocation } from "wouter";
import { ProUpgradeModal } from "@/components/ProUpgradeModal";
import {
  Plus,
  BookOpen,
  Trash2,
  Loader2,
  Crown,
  ArrowLeft,
  ChevronRight,
  GitBranch,
  Layers,
  Clock,
  TrendingUp,
  BarChart2,
  Pencil,
  Check,
  X,
} from "lucide-react";

interface Repertoire {
  id: number;
  title: string;
  color: "white" | "black";
  moveTree: string | null;
  createdAt: string;
  updatedAt: string;
}

interface RepertoireStats {
  totalMoves: number;
  maxDepth: number;
  uniqueLines: number;
  rootMoves: string[];
}

/** Parse moveTree JSON and compute per-repertoire statistics */
function computeStats(treeJson: string | null): RepertoireStats {
  if (!treeJson) return { totalMoves: 0, maxDepth: 0, uniqueLines: 0, rootMoves: [] };
  try {
    interface TreeNode {
      san?: string;
      children?: TreeNode[];
    }
    const tree: TreeNode = JSON.parse(treeJson);
    let totalMoves = 0;
    let maxDepth = 0;
    let uniqueLines = 0;

    const dfs = (node: TreeNode, depth: number) => {
      if (!node.children || node.children.length === 0) {
        uniqueLines++;
        if (depth > maxDepth) maxDepth = depth;
        return;
      }
      totalMoves += node.children.length;
      node.children.forEach((child) => dfs(child, depth + 1));
    };
    dfs(tree, 0);

    const rootMoves = (tree.children || [])
      .slice(0, 4)
      .map((c) => c.san || "")
      .filter(Boolean);

    return { totalMoves, maxDepth, uniqueLines, rootMoves };
  } catch {
    return { totalMoves: 0, maxDepth: 0, uniqueLines: 0, rootMoves: [] };
  }
}

function formatRelativeDate(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
}

export default function RepertoireList() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const [repertoires, setRepertoires] = useState<Repertoire[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showProModal, setShowProModal] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);

  // ── Inline rename state ─────────────────────────────────────────────────────
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [renaming, setRenaming] = useState<number | null>(null);
  const renameInputRef = React.useRef<HTMLInputElement>(null);

  const isPro = user?.isPro || user?.isStaff;
  const FREE_LIMIT = 1;
  const canCreateMore = isPro || repertoires.length < FREE_LIMIT;

  // ── Fetch repertoires ───────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const res = await authFetch("/api/repertoire-builder");
        if (res.ok) {
          const data = await res.json();
          setRepertoires(data.repertoires || []);
        }
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ── Aggregate stats across all repertoires ──────────────────────────────────
  const allStats = useMemo(() => repertoires.map((r) => computeStats(r.moveTree)), [repertoires]);

  const totalMovesAll = useMemo(() => allStats.reduce((s, st) => s + st.totalMoves, 0), [allStats]);
  const totalLinesAll = useMemo(() => allStats.reduce((s, st) => s + st.uniqueLines, 0), [allStats]);
  const mostRecentUpdate = useMemo(() => {
    if (repertoires.length === 0) return null;
    return repertoires.reduce((latest, r) =>
      new Date(r.updatedAt) > new Date(latest.updatedAt) ? r : latest
    );
  }, [repertoires]);

  // ── Create new repertoire ───────────────────────────────────────────────────
  const createRepertoire = useCallback(
    async (color: "white" | "black") => {
      if (!canCreateMore) {
        setShowProModal(true);
        setShowColorPicker(false);
        return;
      }

      setCreating(true);
      try {
        const res = await authFetch("/api/repertoire-builder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: color === "white" ? "White Repertoire" : "Black Repertoire",
            color,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          navigate(`/repertoire/${data.id}`);
        } else {
          const err = await res.json().catch(() => ({}));
          if (res.status === 403) {
            setShowProModal(true);
          } else {
            alert((err as { error?: string }).error || "Failed to create repertoire");
          }
        }
      } catch {
        alert("Failed to create repertoire");
      } finally {
        setCreating(false);
        setShowColorPicker(false);
      }
    },
    [canCreateMore, navigate]
  );

  // ── Rename repertoire ───────────────────────────────────────────────────────
  const startRename = useCallback((e: React.MouseEvent, rep: Repertoire) => {
    e.stopPropagation();
    setEditingId(rep.id);
    setEditingTitle(rep.title);
    // Focus the input on next tick after render
    setTimeout(() => renameInputRef.current?.select(), 0);
  }, []);

  const cancelRename = useCallback(() => {
    setEditingId(null);
    setEditingTitle("");
  }, []);

  const saveRename = useCallback(
    async (id: number) => {
      const trimmed = editingTitle.trim();
      if (!trimmed) { cancelRename(); return; }
      const original = repertoires.find((r) => r.id === id)?.title;
      if (trimmed === original) { cancelRename(); return; }

      setRenaming(id);
      try {
        const res = await authFetch(`/api/repertoire-builder/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: trimmed }),
        });
        if (res.ok) {
          setRepertoires((prev) =>
            prev.map((r) => (r.id === id ? { ...r, title: trimmed } : r))
          );
        } else {
          alert("Failed to rename repertoire");
        }
      } catch {
        alert("Failed to rename repertoire");
      } finally {
        setRenaming(null);
        setEditingId(null);
        setEditingTitle("");
      }
    },
    [editingTitle, repertoires, cancelRename]
  );

  // ── Delete repertoire ───────────────────────────────────────────────────────
  const deleteRepertoire = useCallback(
    async (id: number) => {
      if (!confirm("Delete this repertoire? This cannot be undone.")) return;
      setDeleting(id);
      try {
        await authFetch(`/api/repertoire-builder/${id}`, { method: "DELETE" });
        setRepertoires((prev) => prev.filter((r) => r.id !== id));
      } catch {
        alert("Failed to delete");
      } finally {
        setDeleting(null);
      }
    },
    []
  );

  return (
    <div className={`min-h-screen ${isDark ? "bg-gray-950 text-white" : "bg-gray-50 text-gray-900"}`}>
      {/* Header */}
      <div className={`border-b ${isDark ? "border-white/10 bg-gray-950/80" : "border-gray-200 bg-white/80"} backdrop-blur-sm sticky top-0 z-30`}>
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/training")}
              className={`flex items-center gap-1.5 text-sm ${isDark ? "text-white/60 hover:text-white" : "text-gray-500 hover:text-gray-900"}`}
            >
              <ArrowLeft size={16} />
            </button>
            <div>
              <h1 className={`text-xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
                Opening Repertoire Builder
              </h1>
              <p className={`text-sm ${isDark ? "text-white/50" : "text-gray-500"}`}>
                Build and study your opening lines with Stockfish analysis
              </p>
            </div>
          </div>

          {/* New repertoire button */}
          <div className="relative">
            <button
              onClick={() => {
                if (!user) {
                  navigate("/");
                  return;
                }
                if (!canCreateMore) {
                  setShowProModal(true);
                  return;
                }
                setShowColorPicker(!showColorPicker);
              }}
              disabled={creating}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition ${
                isDark
                  ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                  : "bg-emerald-600 text-white hover:bg-emerald-700"
              }`}
            >
              {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              New Repertoire
            </button>

            {/* Color picker dropdown */}
            {showColorPicker && (
              <div className={`absolute right-0 top-full mt-2 rounded-xl border shadow-xl z-40 overflow-hidden ${
                isDark ? "bg-gray-900 border-white/10" : "bg-white border-gray-200"
              }`}>
                <button
                  onClick={() => createRepertoire("white")}
                  className={`flex items-center gap-3 w-full px-4 py-3 text-sm transition ${
                    isDark ? "hover:bg-white/5" : "hover:bg-gray-50"
                  }`}
                >
                  <div className="w-6 h-6 rounded-full bg-white border border-gray-300" />
                  <span>Play as White</span>
                </button>
                <button
                  onClick={() => createRepertoire("black")}
                  className={`flex items-center gap-3 w-full px-4 py-3 text-sm transition ${
                    isDark ? "hover:bg-white/5" : "hover:bg-gray-50"
                  }`}
                >
                  <div className="w-6 h-6 rounded-full bg-gray-800 border border-gray-600" />
                  <span>Play as Black</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Free user limit banner */}
        {!isPro && repertoires.length >= FREE_LIMIT && (
          <div className={`mb-6 rounded-xl border px-4 py-3 flex items-center gap-3 ${
            isDark ? "bg-amber-500/10 border-amber-500/30" : "bg-amber-50 border-amber-200"
          }`}>
            <Crown size={18} className="text-amber-500 shrink-0" />
            <div className="flex-1">
              <p className={`text-sm font-medium ${isDark ? "text-amber-400" : "text-amber-700"}`}>
                Free plan: {FREE_LIMIT} repertoire
              </p>
              <p className={`text-xs ${isDark ? "text-amber-400/60" : "text-amber-600"}`}>
                Upgrade to Pro for unlimited repertoires and advanced features.
              </p>
            </div>
            <button
              onClick={() => setShowProModal(true)}
              className="px-3 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-medium hover:bg-amber-600 transition"
            >
              Upgrade
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="animate-spin" size={24} />
          </div>
        ) : repertoires.length === 0 ? (
          /* Empty state */
          <div className="text-center py-16">
            <BookOpen size={48} className={`mx-auto mb-4 ${isDark ? "text-white/20" : "text-gray-300"}`} />
            <h2 className={`text-lg font-semibold mb-2 ${isDark ? "text-white/70" : "text-gray-700"}`}>
              No repertoires yet
            </h2>
            <p className={`text-sm mb-6 ${isDark ? "text-white/40" : "text-gray-400"}`}>
              Create your first opening repertoire to start building your preparation.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => createRepertoire("white")}
                disabled={creating}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm border transition ${
                  isDark
                    ? "bg-white/5 border-white/20 text-white hover:bg-white/10"
                    : "bg-white border-gray-200 text-gray-900 hover:bg-gray-50"
                }`}
              >
                <div className="w-4 h-4 rounded-full bg-white border border-gray-300" />
                White Repertoire
              </button>
              <button
                onClick={() => createRepertoire("black")}
                disabled={creating}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm border transition ${
                  isDark
                    ? "bg-white/5 border-white/20 text-white hover:bg-white/10"
                    : "bg-white border-gray-200 text-gray-900 hover:bg-gray-50"
                }`}
              >
                <div className="w-4 h-4 rounded-full bg-gray-800 border border-gray-600" />
                Black Repertoire
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* ── Summary Dashboard ─────────────────────────────────────────── */}
            <div className={`mb-6 rounded-2xl border p-5 ${
              isDark ? "bg-gray-900/60 border-white/10" : "bg-white border-gray-200 shadow-sm"
            }`}>
              <div className="flex items-center gap-2 mb-4">
                <BarChart2 size={16} className={isDark ? "text-emerald-400" : "text-emerald-600"} />
                <h2 className={`text-sm font-semibold tracking-wide uppercase ${isDark ? "text-white/60" : "text-gray-500"}`}>
                  Overall Progress
                </h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {/* Stat: Repertoires */}
                <div className={`rounded-xl p-3 ${isDark ? "bg-white/5" : "bg-gray-50"}`}>
                  <div className={`flex items-center gap-1.5 mb-1 ${isDark ? "text-white/40" : "text-gray-400"}`}>
                    <BookOpen size={13} />
                    <span className="text-[11px] uppercase tracking-wide font-medium">Repertoires</span>
                  </div>
                  <p className={`text-2xl font-bold tabular-nums ${isDark ? "text-white" : "text-gray-900"}`}>
                    {repertoires.length}
                  </p>
                  <p className={`text-[11px] mt-0.5 ${isDark ? "text-white/30" : "text-gray-400"}`}>
                    {repertoires.filter(r => r.color === "white").length}W · {repertoires.filter(r => r.color === "black").length}B
                  </p>
                </div>

                {/* Stat: Total Moves */}
                <div className={`rounded-xl p-3 ${isDark ? "bg-white/5" : "bg-gray-50"}`}>
                  <div className={`flex items-center gap-1.5 mb-1 ${isDark ? "text-white/40" : "text-gray-400"}`}>
                    <TrendingUp size={13} />
                    <span className="text-[11px] uppercase tracking-wide font-medium">Total Moves</span>
                  </div>
                  <p className={`text-2xl font-bold tabular-nums ${isDark ? "text-white" : "text-gray-900"}`}>
                    {totalMovesAll}
                  </p>
                  <p className={`text-[11px] mt-0.5 ${isDark ? "text-white/30" : "text-gray-400"}`}>
                    across all repertoires
                  </p>
                </div>

                {/* Stat: Unique Lines */}
                <div className={`rounded-xl p-3 ${isDark ? "bg-white/5" : "bg-gray-50"}`}>
                  <div className={`flex items-center gap-1.5 mb-1 ${isDark ? "text-white/40" : "text-gray-400"}`}>
                    <GitBranch size={13} />
                    <span className="text-[11px] uppercase tracking-wide font-medium">Lines</span>
                  </div>
                  <p className={`text-2xl font-bold tabular-nums ${isDark ? "text-white" : "text-gray-900"}`}>
                    {totalLinesAll}
                  </p>
                  <p className={`text-[11px] mt-0.5 ${isDark ? "text-white/30" : "text-gray-400"}`}>
                    unique variations
                  </p>
                </div>

                {/* Stat: Last Updated */}
                <div className={`rounded-xl p-3 ${isDark ? "bg-white/5" : "bg-gray-50"}`}>
                  <div className={`flex items-center gap-1.5 mb-1 ${isDark ? "text-white/40" : "text-gray-400"}`}>
                    <Clock size={13} />
                    <span className="text-[11px] uppercase tracking-wide font-medium">Last Updated</span>
                  </div>
                  <p className={`text-2xl font-bold tabular-nums ${isDark ? "text-white" : "text-gray-900"}`}>
                    {mostRecentUpdate ? formatRelativeDate(mostRecentUpdate.updatedAt) : "—"}
                  </p>
                  <p className={`text-[11px] mt-0.5 truncate ${isDark ? "text-white/30" : "text-gray-400"}`}>
                    {mostRecentUpdate?.title || ""}
                  </p>
                </div>
              </div>
            </div>

            {/* ── Repertoire Cards ──────────────────────────────────────────── */}
            <div className="grid gap-3">
              {repertoires.map((rep, idx) => {
                const stats = allStats[idx];
                const depthLabel = stats.maxDepth > 0
                  ? `${stats.maxDepth} ply deep`
                  : "empty";

                return (
                  <div
                    key={rep.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => { if (editingId !== rep.id) navigate(`/repertoire/${rep.id}`); }}
                    onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && editingId !== rep.id) navigate(`/repertoire/${rep.id}`); }}
                    className={`group w-full text-left rounded-2xl border transition cursor-pointer ${
                      isDark
                        ? "bg-gray-900/50 border-white/10 hover:border-emerald-500/40 hover:bg-gray-900"
                        : "bg-white border-gray-200 hover:border-emerald-300 hover:shadow-md"
                    }`}
                  >
                    {/* Card top row */}
                    <div className="flex items-center gap-4 px-5 pt-4 pb-3">
                      {/* Color indicator */}
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg shrink-0 ${
                        rep.color === "white"
                          ? "bg-white border border-gray-200 text-gray-900"
                          : "bg-gray-800 border border-gray-600 text-white"
                      }`}>
                        {rep.color === "white" ? "♔" : "♚"}
                      </div>

                      <div className="flex-1 min-w-0">
                        {editingId === rep.id ? (
                          /* ── Inline rename input ── */
                          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <input
                              ref={renameInputRef}
                              value={editingTitle}
                              onChange={(e) => setEditingTitle(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") { e.preventDefault(); saveRename(rep.id); }
                                if (e.key === "Escape") { e.preventDefault(); cancelRename(); }
                              }}
                              onBlur={() => saveRename(rep.id)}
                              className={`flex-1 min-w-0 text-sm font-semibold rounded-lg px-2 py-1 border outline-none focus:ring-2 focus:ring-emerald-500/50 ${
                                isDark
                                  ? "bg-gray-800 border-emerald-500/50 text-white"
                                  : "bg-white border-emerald-400 text-gray-900"
                              }`}
                              maxLength={80}
                              autoFocus
                            />
                            {renaming === rep.id ? (
                              <Loader2 size={14} className="animate-spin text-emerald-400 shrink-0" />
                            ) : (
                              <>
                                <button
                                  onMouseDown={(e) => { e.preventDefault(); saveRename(rep.id); }}
                                  className="p-1 rounded text-emerald-400 hover:text-emerald-300"
                                  title="Save"
                                >
                                  <Check size={14} />
                                </button>
                                <button
                                  onMouseDown={(e) => { e.preventDefault(); cancelRename(); }}
                                  className={`p-1 rounded ${isDark ? "text-white/40 hover:text-white/70" : "text-gray-400 hover:text-gray-600"}`}
                                  title="Cancel"
                                >
                                  <X size={14} />
                                </button>
                              </>
                            )}
                          </div>
                        ) : (
                          /* ── Static title with pencil affordance ── */
                          <div className="flex items-center gap-1.5 group/title">
                            <h3 className={`font-semibold truncate ${isDark ? "text-white" : "text-gray-900"}`}>
                              {rep.title}
                            </h3>
                            <button
                              onClick={(e) => startRename(e, rep)}
                              className={`opacity-0 group-hover/title:opacity-100 p-0.5 rounded transition-opacity ${
                                isDark ? "text-white/30 hover:text-white/70" : "text-gray-300 hover:text-gray-600"
                              }`}
                              title="Rename repertoire"
                            >
                              <Pencil size={12} />
                            </button>
                          </div>
                        )}
                        <p className={`text-xs ${isDark ? "text-white/40" : "text-gray-400"}`}>
                          Updated {formatRelativeDate(rep.updatedAt)}
                        </p>
                      </div>

                      {/* Delete button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteRepertoire(rep.id);
                        }}
                        className={`opacity-0 group-hover:opacity-100 p-2 rounded-lg transition ${
                          isDark ? "hover:bg-red-500/20 text-red-400" : "hover:bg-red-50 text-red-500"
                        }`}
                        title="Delete repertoire"
                      >
                        {deleting === rep.id ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Trash2 size={16} />
                        )}
                      </button>

                      <ChevronRight size={18} className={`shrink-0 ${isDark ? "text-white/20" : "text-gray-300"} group-hover:translate-x-0.5 transition-transform`} />
                    </div>

                    {/* Stats row */}
                    <div className={`flex items-center gap-0 border-t px-5 py-3 ${
                      isDark ? "border-white/5" : "border-gray-100"
                    }`}>
                      {/* Moves */}
                      <div className="flex-1 flex items-center gap-1.5">
                        <TrendingUp size={13} className={isDark ? "text-emerald-400/70" : "text-emerald-600"} />
                        <span className={`text-xs font-semibold tabular-nums ${isDark ? "text-white/80" : "text-gray-700"}`}>
                          {stats.totalMoves}
                        </span>
                        <span className={`text-xs ${isDark ? "text-white/30" : "text-gray-400"}`}>moves</span>
                      </div>

                      <div className={`w-px h-4 ${isDark ? "bg-white/10" : "bg-gray-200"}`} />

                      {/* Lines */}
                      <div className="flex-1 flex items-center gap-1.5 px-4">
                        <GitBranch size={13} className={isDark ? "text-blue-400/70" : "text-blue-500"} />
                        <span className={`text-xs font-semibold tabular-nums ${isDark ? "text-white/80" : "text-gray-700"}`}>
                          {stats.uniqueLines}
                        </span>
                        <span className={`text-xs ${isDark ? "text-white/30" : "text-gray-400"}`}>lines</span>
                      </div>

                      <div className={`w-px h-4 ${isDark ? "bg-white/10" : "bg-gray-200"}`} />

                      {/* Depth */}
                      <div className="flex-1 flex items-center gap-1.5 px-4">
                        <Layers size={13} className={isDark ? "text-purple-400/70" : "text-purple-500"} />
                        <span className={`text-xs font-semibold tabular-nums ${isDark ? "text-white/80" : "text-gray-700"}`}>
                          {depthLabel}
                        </span>
                      </div>

                      <div className={`w-px h-4 ${isDark ? "bg-white/10" : "bg-gray-200"}`} />

                      {/* Root moves */}
                      <div className="flex-1 flex items-center gap-1 pl-4 overflow-hidden">
                        {stats.rootMoves.length > 0 ? (
                          <>
                            {stats.rootMoves.map((san) => (
                              <span
                                key={san}
                                className={`text-[11px] font-mono font-bold px-1.5 py-0.5 rounded ${
                                  isDark
                                    ? "bg-emerald-500/15 text-emerald-400"
                                    : "bg-emerald-50 text-emerald-700"
                                }`}
                              >
                                {san}
                              </span>
                            ))}
                            {stats.totalMoves > 4 && (
                              <span className={`text-[11px] ${isDark ? "text-white/30" : "text-gray-400"}`}>…</span>
                            )}
                          </>
                        ) : (
                          <span className={`text-xs italic ${isDark ? "text-white/20" : "text-gray-300"}`}>
                            No moves yet
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Pro Upgrade Modal */}
      <ProUpgradeModal
        isOpen={showProModal}
        onClose={() => setShowProModal(false)}
        highlightFeature="Opening Repertoire Builder"
      />
    </div>
  );
}
