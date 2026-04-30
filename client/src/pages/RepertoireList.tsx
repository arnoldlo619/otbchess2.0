/**
 * RepertoireList — Lists the user's saved opening repertoires.
 *
 * Free users: limited to 1 saved repertoire (shows Pro upgrade prompt for more).
 * Pro users: unlimited repertoires.
 *
 * Provides "New Repertoire" creation (pick color → auto-create → navigate to builder).
 */
import React, { useState, useEffect, useCallback } from "react";
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
} from "lucide-react";

interface Repertoire {
  id: number;
  title: string;
  color: "white" | "black";
  moveTree: string | null;
  createdAt: string;
  updatedAt: string;
}

function countTreeMoves(treeJson: string | null): number {
  if (!treeJson) return 0;
  try {
    const tree = JSON.parse(treeJson);
    let count = 0;
    const dfs = (node: { children?: unknown[] }) => {
      if (node.children) {
        count += node.children.length;
        node.children.forEach((c) => dfs(c as { children?: unknown[] }));
      }
    }
    dfs(tree);
    return count;
  } catch {
    return 0;
  }
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
          /* Repertoire cards */
          <div className="grid gap-3">
            {repertoires.map((rep) => {
              const moveCount = countTreeMoves(rep.moveTree);
              return (
                <div
                  key={rep.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/repertoire/${rep.id}`)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") navigate(`/repertoire/${rep.id}`); }}
                  className={`group flex items-center gap-4 w-full text-left px-5 py-4 rounded-xl border transition cursor-pointer ${
                    isDark
                      ? "bg-gray-900/50 border-white/10 hover:border-emerald-500/30 hover:bg-gray-900"
                      : "bg-white border-gray-200 hover:border-emerald-300 hover:shadow-md"
                  }`}
                >
                  {/* Color indicator */}
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${
                    rep.color === "white"
                      ? "bg-white border border-gray-200 text-gray-900"
                      : "bg-gray-800 border border-gray-600 text-white"
                  }`}>
                    {rep.color === "white" ? "♔" : "♚"}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className={`font-semibold truncate ${isDark ? "text-white" : "text-gray-900"}`}>
                      {rep.title}
                    </h3>
                    <p className={`text-xs ${isDark ? "text-white/40" : "text-gray-400"}`}>
                      {moveCount} move{moveCount !== 1 ? "s" : ""} ·{" "}
                      {new Date(rep.updatedAt).toLocaleDateString()}
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

                  <ChevronRight size={18} className={`${isDark ? "text-white/20" : "text-gray-300"} group-hover:translate-x-0.5 transition-transform`} />
                </div>
              );
            })}
          </div>
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
