import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import {
  ArrowLeft,
  Trophy,
  Swords,
  Clock,
  Calendar,
  TrendingUp,
  Loader2,
  AlertCircle,
  Ghost,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import AuthModal from "../components/AuthModal";
import { MobileNavDrawer } from "../components/MobileNavDrawer";

// ─── Types ────────────────────────────────────────────────────────────────────

interface BattleEntry {
  id: number;
  code: string;
  outcome: "win" | "loss" | "draw";
  result: string | null;
  isHost: boolean;
  timeControl: string | null;
  opponent: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
    chesscomUsername: string | null;
  } | null;
  completedAt: string | null;
  createdAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function avatarFallback(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function outcomeColor(outcome: "win" | "loss" | "draw") {
  if (outcome === "win") return "#4ade80";
  if (outcome === "loss") return "#f87171";
  return "#94a3b8";
}

function outcomeLabel(outcome: "win" | "loss" | "draw") {
  if (outcome === "win") return "Win";
  if (outcome === "loss") return "Loss";
  return "Draw";
}

function outcomeBg(outcome: "win" | "loss" | "draw") {
  if (outcome === "win") return "oklch(0.22 0.10 142 / 0.7)";
  if (outcome === "loss") return "oklch(0.20 0.10 25 / 0.7)";
  return "oklch(0.18 0.03 240 / 0.7)";
}

function outcomeBorder(outcome: "win" | "loss" | "draw") {
  if (outcome === "win") return "oklch(0.45 0.15 142 / 0.5)";
  if (outcome === "loss") return "oklch(0.45 0.15 25 / 0.5)";
  return "oklch(0.40 0.03 240 / 0.4)";
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function BattleHistory() {
  const { user } = useAuth();
  const [history, setHistory] = useState<BattleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authOpen, setAuthOpen] = useState(false);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch("/api/battles/history")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setHistory(data.history ?? []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [user]);

  // ── Derived stats ──────────────────────────────────────────────────────────
  const wins = history.filter((h) => h.outcome === "win").length;
  const losses = history.filter((h) => h.outcome === "loss").length;
  const draws = history.filter((h) => h.outcome === "draw").length;
  const total = history.length;
  const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0a1a0e] text-white flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 flex items-center gap-3 px-4 py-3 border-b border-white/5 bg-[#0a1a0e]/90 backdrop-blur-md">
        <Link href="/battle">
          <button className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
            <ArrowLeft className="w-4 h-4 text-white/60" />
          </button>
        </Link>
        <div className="flex items-center gap-2 flex-1">
          <Swords className="w-5 h-5 text-green-400" />
          <h1 className="text-base font-black tracking-tight">Battle History</h1>
        </div>
        <MobileNavDrawer currentPage="Battle" />
      </header>

      <main className="flex-1 flex flex-col items-center px-4 py-8 max-w-lg mx-auto w-full gap-6">

        {/* ── Not signed in ──────────────────────────────────────────────── */}
        {!user && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full text-center py-16"
          >
            <Ghost className="w-12 h-12 text-white/20 mx-auto mb-4" />
            <p className="text-white/40 text-sm mb-6">Sign in to see your battle record.</p>
            <button
              onClick={() => setAuthOpen(true)}
              className="px-6 py-2.5 rounded-xl font-semibold text-sm"
              style={{
                background: "oklch(0.28 0.10 142 / 0.7)",
                border: "1.5px solid oklch(0.45 0.15 142 / 0.4)",
                color: "#4ade80",
              }}
            >
              Sign In
            </button>
          </motion.div>
        )}

        {/* ── Loading ────────────────────────────────────────────────────── */}
        {loading && (
          <div className="flex items-center gap-2 text-white/40 py-16">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Loading history…</span>
          </div>
        )}

        {/* ── Error ──────────────────────────────────────────────────────── */}
        {error && (
          <div className="w-full flex items-center gap-2 text-red-400 text-sm bg-red-900/20 border border-red-500/20 rounded-xl px-4 py-3">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {/* ── Stats summary ──────────────────────────────────────────────── */}
        {!loading && !error && user && total > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="w-full rounded-2xl p-5"
            style={{
              background: "oklch(0.13 0.06 142 / 0.6)",
              border: "1.5px solid oklch(0.35 0.10 142 / 0.35)",
            }}
          >
            {/* Win rate bar */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-green-400" />
                <span className="text-xs font-bold text-white/60 uppercase tracking-widest">
                  Record
                </span>
              </div>
              <span className="text-xs text-white/40">{total} game{total !== 1 ? "s" : ""}</span>
            </div>

            {/* W / D / L counts */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                { label: "Wins", value: wins, color: "#4ade80", bg: "oklch(0.18 0.10 142 / 0.5)" },
                { label: "Draws", value: draws, color: "#94a3b8", bg: "oklch(0.16 0.02 240 / 0.5)" },
                { label: "Losses", value: losses, color: "#f87171", bg: "oklch(0.18 0.10 25 / 0.5)" },
              ].map(({ label, value, color, bg }) => (
                <div
                  key={label}
                  className="flex flex-col items-center py-3 rounded-xl"
                  style={{ background: bg }}
                >
                  <span className="text-2xl font-black" style={{ color }}>{value}</span>
                  <span className="text-xs text-white/40 mt-0.5">{label}</span>
                </div>
              ))}
            </div>

            {/* Win-rate progress bar */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: "linear-gradient(90deg, #4ade80, #22c55e)" }}
                  initial={{ width: 0 }}
                  animate={{ width: `${winRate}%` }}
                  transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
                />
              </div>
              <span className="text-xs font-bold text-green-400 w-10 text-right">{winRate}%</span>
            </div>
          </motion.div>
        )}

        {/* ── Empty state ────────────────────────────────────────────────── */}
        {!loading && !error && user && total === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full text-center py-16"
          >
            <Swords className="w-12 h-12 text-white/10 mx-auto mb-4" />
            <p className="text-white/40 text-sm mb-2">No battles recorded yet.</p>
            <p className="text-white/20 text-xs mb-6">
              Complete a battle to see it here.
            </p>
            <Link href="/battle">
              <button
                className="px-6 py-2.5 rounded-xl font-semibold text-sm"
                style={{
                  background: "oklch(0.28 0.10 142 / 0.7)",
                  border: "1.5px solid oklch(0.45 0.15 142 / 0.4)",
                  color: "#4ade80",
                }}
              >
                Start a Battle
              </button>
            </Link>
          </motion.div>
        )}

        {/* ── Game list ──────────────────────────────────────────────────── */}
        {!loading && !error && total > 0 && (
          <div className="w-full flex flex-col gap-3">
            <AnimatePresence>
              {history.map((entry, i) => (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04, duration: 0.3 }}
                  className="w-full rounded-2xl p-4 flex items-center gap-4"
                  style={{
                    background: outcomeBg(entry.outcome),
                    border: `1.5px solid ${outcomeBorder(entry.outcome)}`,
                  }}
                >
                  {/* Outcome badge */}
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-sm shrink-0"
                    style={{
                      background: "oklch(0.10 0.04 142 / 0.6)",
                      color: outcomeColor(entry.outcome),
                      border: `1.5px solid ${outcomeBorder(entry.outcome)}`,
                    }}
                  >
                    {outcomeLabel(entry.outcome)}
                  </div>

                  {/* Opponent info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {entry.opponent?.avatarUrl ? (
                        <img
                          src={entry.opponent.avatarUrl}
                          alt=""
                          className="w-6 h-6 rounded-full object-cover shrink-0"
                          style={{ border: "1px solid oklch(0.40 0.08 142 / 0.4)" }}
                        />
                      ) : (
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                          style={{
                            background: "oklch(0.20 0.06 142 / 0.6)",
                            color: "#4ade80",
                          }}
                        >
                          {avatarFallback(entry.opponent?.displayName ?? "?")}
                        </div>
                      )}
                      <span className="text-sm font-bold truncate">
                        {entry.opponent?.displayName ?? "Unknown"}
                      </span>
                      {entry.isHost && (
                        <span className="text-xs text-white/30 shrink-0">(host)</span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-white/40">
                      {entry.timeControl && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {entry.timeControl}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(entry.completedAt ?? entry.createdAt)}
                      </span>
                    </div>
                  </div>

                  {/* Trophy for wins */}
                  {entry.outcome === "win" && (
                    <Trophy className="w-5 h-5 text-yellow-400 shrink-0" />
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </main>

      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} isDark />
    </div>
  );
}
