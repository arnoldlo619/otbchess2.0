/**
 * ContinueStudying.tsx — "Continue Studying" widget + Progress Dashboard.
 *
 * Designed to be embedded on the homepage, profile, or club dashboard.
 * Shows:
 *   - Overall study progress (lines mastered / total)
 *   - Current streak
 *   - Next recommended line to study
 *   - Recently studied openings with progress bars
 *   - Quick-access "Continue" CTA
 */
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  BookOpen, ChevronRight, Flame, Play,
  Trophy, TrendingUp,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface StudyProgress {
  totalLines: number;
  masteredLines: number;
  learningLines: number;
  newLines: number;
  streak: number;
  lastStudied: string | null;
  recentOpenings: {
    slug: string;
    name: string;
    side: string;
    mastered: number;
    total: number;
    nextLineSlug: string | null;
  }[];
  recommendedLine: {
    openingSlug: string;
    openingName: string;
    lineSlug: string;
    lineTitle: string;
    difficulty: string;
    reason: string;
  } | null;
}

// ── Progress Ring ─────────────────────────────────────────────────────────────
function ProgressRing({ pct, size = 48, stroke = 3 }: { pct: number; size?: number; stroke?: number }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgb(16,185,129)"
        strokeWidth={stroke}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-700"
      />
    </svg>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string | number; color: string }) {
  return (
    <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
      <div className={`shrink-0 ${color}`}>{icon}</div>
      <div>
        <div className="text-sm font-bold text-white/80">{value}</div>
        <div className="text-[9px] text-white/30 uppercase tracking-wider">{label}</div>
      </div>
    </div>
  );
}

// ── Opening Progress Row ──────────────────────────────────────────────────────
function OpeningRow({
  opening,
  onClick,
}: {
  opening: StudyProgress["recentOpenings"][0];
  onClick: () => void;
}) {
  const pct = opening.total > 0 ? Math.round((opening.mastered / opening.total) * 100) : 0;

  return (
    <button
      onClick={onClick}
      className="group w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/[0.03] transition-colors text-left"
    >
      <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${opening.side === "white" ? "bg-white border border-white/30" : "bg-gray-700 border border-white/20"}`} />
      <div className="flex-1 min-w-0">
        <h4 className="text-xs font-medium text-white/70 group-hover:text-emerald-400 transition-colors truncate">
          {opening.name}
        </h4>
        <div className="flex items-center gap-2 mt-1">
          <div className="flex-1 h-1 rounded-full bg-white/[0.06] overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500/60 transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-[9px] text-white/30 font-mono w-12 text-right">
            {opening.mastered}/{opening.total}
          </span>
        </div>
      </div>
      <ChevronRight className="w-3.5 h-3.5 text-white/15 group-hover:text-emerald-400 shrink-0" />
    </button>
  );
}

// ── Main Widget ───────────────────────────────────────────────────────────────
export default function ContinueStudying({ compact = false }: { compact?: boolean }) {
  const [, navigate] = useLocation();
  const [progress, setProgress] = useState<StudyProgress | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProgress() {
      try {
        const res = await fetch("/api/openings/progress/summary");
        if (!res.ok) {
          // Not logged in or no data — show empty state
          setProgress(null);
          return;
        }
        const data = await res.json();
        setProgress(data);
      } catch {
        setProgress(null);
      } finally {
        setLoading(false);
      }
    }
    fetchProgress();
  }, []);

  if (loading) {
    return (
      <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04] animate-pulse">
        <div className="h-4 w-32 bg-white/[0.06] rounded mb-3" />
        <div className="h-20 bg-white/[0.03] rounded" />
      </div>
    );
  }

  // Empty state — no study data yet
  if (!progress || progress.totalLines === 0) {
    return (
      <div className="p-5 rounded-xl bg-gradient-to-br from-[#0f1f13] to-[#0a1a0e] border border-white/[0.06]">
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-semibold text-white/80">Start Learning Openings</h3>
        </div>
        <p className="text-xs text-white/40 mb-4">
          Build your opening repertoire with guided study lines, practice drills, and spaced repetition.
        </p>
        <button
          onClick={() => navigate("/openings")}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-all"
        >
          <Play className="w-3.5 h-3.5" />
          Browse Openings
        </button>
      </div>
    );
  }

  const overallPct = Math.round((progress.masteredLines / progress.totalLines) * 100);

  return (
    <div className="rounded-xl bg-gradient-to-br from-[#0f1f13] to-[#0a1a0e] border border-white/[0.06] overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-semibold text-white/80">Openings Study</h3>
        </div>
        <button
          onClick={() => navigate("/openings")}
          className="text-[10px] text-emerald-400/70 hover:text-emerald-400 transition-colors flex items-center gap-0.5"
        >
          View All <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      {/* Stats row */}
      <div className="px-4 pb-3">
        <div className="flex items-center gap-3">
          {/* Progress ring */}
          <div className="relative shrink-0">
            <ProgressRing pct={overallPct} size={52} stroke={3} />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[11px] font-bold text-emerald-400">{overallPct}%</span>
            </div>
          </div>

          {/* Stats */}
          <div className="flex-1 grid grid-cols-3 gap-2">
            <StatCard
              icon={<Trophy className="w-3.5 h-3.5" />}
              label="Mastered"
              value={progress.masteredLines}
              color="text-emerald-400"
            />
            <StatCard
              icon={<TrendingUp className="w-3.5 h-3.5" />}
              label="Learning"
              value={progress.learningLines}
              color="text-amber-400"
            />
            <StatCard
              icon={<Flame className="w-3.5 h-3.5" />}
              label="Streak"
              value={`${progress.streak}d`}
              color="text-orange-400"
            />
          </div>
        </div>
      </div>

      {/* Recommended next line */}
      {progress.recommendedLine && (
        <div className="mx-4 mb-3">
          <button
            onClick={() =>
              navigate(`/openings/${progress.recommendedLine!.openingSlug}/study/${progress.recommendedLine!.lineSlug}`)
            }
            className="group w-full flex items-center gap-3 p-3 rounded-lg bg-emerald-500/[0.06] border border-emerald-500/10 hover:border-emerald-500/25 transition-all text-left"
          >
            <div className="shrink-0 w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center">
              <Play className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-emerald-400/60 uppercase tracking-wider font-medium">
                {progress.recommendedLine.reason}
              </p>
              <h4 className="text-xs font-medium text-white/70 group-hover:text-emerald-400 transition-colors truncate">
                {progress.recommendedLine.lineTitle}
              </h4>
              <p className="text-[10px] text-white/30 truncate">{progress.recommendedLine.openingName}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-emerald-400/40 group-hover:text-emerald-400 shrink-0" />
          </button>
        </div>
      )}

      {/* Recent openings */}
      {!compact && progress.recentOpenings.length > 0 && (
        <div className="border-t border-white/[0.04] px-1 py-2">
          {progress.recentOpenings.slice(0, 4).map((opening) => (
            <OpeningRow
              key={opening.slug}
              opening={opening}
              onClick={() => navigate(`/openings/${opening.slug}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
