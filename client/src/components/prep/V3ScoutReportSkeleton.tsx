/**
 * V3ScoutReportSkeleton — shimmer loading skeleton that mirrors the
 * exact section layout of V3ScoutReportTab. Shown while the API is
 * fetching and processing chess games.
 */

interface SkeletonProps {
  isDark: boolean;
}

// ── Primitive shimmer blocks ───────────────────────────────────────────────────

function Shimmer({ className }: { className: string }) {
  return (
    <div
      className={`rounded-lg animate-shimmer ${className}`}
      aria-hidden="true"
    />
  );
}

// ── Card shell ─────────────────────────────────────────────────────────────────

function SkeletonCard({
  isDark,
  children,
  className = "",
}: {
  isDark: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 sm:p-5 ${
        isDark
          ? "bg-[#0f1c11]/80 border-[#1e2e22]/60"
          : "bg-white border-[#ADBC9F]/40"
      } ${className}`}
      aria-hidden="true"
    >
      {children}
    </div>
  );
}

// ── Section header row (icon + title + count badge + chevron) ─────────────────

function SectionHeader({ isDark }: { isDark: boolean }) {
  const base = isDark ? "bg-[#1e2e22]/60" : "bg-[#ADBC9F]/30";
  return (
    <div className="flex items-center gap-2 mb-3">
      <Shimmer className={`w-4 h-4 shrink-0 ${base}`} />
      <Shimmer className={`h-3.5 flex-1 max-w-[140px] ${base}`} />
      <Shimmer className={`w-6 h-5 rounded-full ${base}`} />
      <Shimmer className={`w-3.5 h-3.5 ${base}`} />
    </div>
  );
}

// ── Bullet list rows ───────────────────────────────────────────────────────────

function BulletRows({ count, isDark }: { count: number; isDark: boolean }) {
  const base = isDark ? "bg-[#1e2e22]/60" : "bg-[#ADBC9F]/30";
  const widths = ["w-full", "w-5/6", "w-4/5", "w-11/12", "w-3/4"];
  return (
    <ul className="space-y-2.5">
      {Array.from({ length: count }).map((_, i) => (
        <li key={i} className="flex items-start gap-2">
          <Shimmer className={`mt-1 shrink-0 w-1.5 h-1.5 rounded-full ${base}`} />
          <Shimmer className={`h-3 ${widths[i % widths.length]} ${base}`} />
        </li>
      ))}
    </ul>
  );
}

// ── Data quality banner skeleton ───────────────────────────────────────────────

function DataQualityBannerSkeleton({ isDark }: { isDark: boolean }) {
  const base = isDark ? "bg-[#1e2e22]/60" : "bg-[#ADBC9F]/30";
  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-2xl border ${
        isDark
          ? "bg-[#0d1a0f]/60 border-[#1e2e22]/60"
          : "bg-[#FBFADA]/60 border-[#ADBC9F]/50"
      }`}
      aria-hidden="true"
    >
      {/* Grade chip */}
      <Shimmer className={`w-8 h-6 rounded-lg ${base}`} />
      {/* Notes */}
      <div className="flex-1 space-y-1.5">
        <Shimmer className={`h-3 w-3/5 ${base}`} />
        <Shimmer className={`h-2.5 w-4/5 ${base}`} />
      </div>
      {/* Parsed count */}
      <Shimmer className={`h-3 w-16 ${base}`} />
    </div>
  );
}

// ── Opponent hero skeleton ─────────────────────────────────────────────────────

function OpponentHeroSkeleton({ isDark }: { isDark: boolean }) {
  const base = isDark ? "bg-[#1e2e22]/60" : "bg-[#ADBC9F]/30";
  return (
    <SkeletonCard isDark={isDark} className="flex items-center gap-4">
      {/* Avatar */}
      <Shimmer className={`w-12 h-12 rounded-full shrink-0 ${base}`} />
      {/* Name + meta */}
      <div className="flex-1 space-y-2">
        <Shimmer className={`h-4 w-36 ${base}`} />
        <Shimmer className={`h-3 w-56 ${base}`} />
      </div>
      {/* V3 badge */}
      <Shimmer className={`w-8 h-6 rounded-lg shrink-0 ${base}`} />
    </SkeletonCard>
  );
}

// ── Opening forecast skeleton ──────────────────────────────────────────────────

function OpeningForecastSkeleton({ isDark }: { isDark: boolean }) {
  const base = isDark ? "bg-[#1e2e22]/60" : "bg-[#ADBC9F]/30";
  const rowBg = isDark ? "bg-[#1e2e22]/40" : "bg-[#ADBC9F]/20";
  return (
    <SkeletonCard isDark={isDark}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Shimmer className={`w-4 h-4 shrink-0 ${base}`} />
        <Shimmer className={`h-3.5 flex-1 max-w-[140px] ${base}`} />
        {/* Color toggle */}
        <Shimmer className={`w-16 h-6 rounded-lg ${base}`} />
      </div>
      {/* Opening rows */}
      <div className="space-y-1.5">
        {[0.72, 0.55, 0.38, 0.25, 0.18].map((w, i) => (
          <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-xl ${rowBg}`}>
            <Shimmer className={`w-10 h-3 ${base}`} />
            <div className={`flex-1 h-1 rounded-full ${base}`}>
              <div
                className={`h-full rounded-full animate-shimmer ${isDark ? "bg-[#436850]/40" : "bg-[#436850]/20"}`}
                style={{ width: `${Math.round(w * 100)}%` }}
              />
            </div>
            <Shimmer className={`w-8 h-3 ${base}`} />
          </div>
        ))}
      </div>
    </SkeletonCard>
  );
}

// ── Insight card skeleton ──────────────────────────────────────────────────────

function InsightCardSkeleton({ isDark, wide = false }: { isDark: boolean; wide?: boolean }) {
  const base = isDark ? "bg-[#1e2e22]/60" : "bg-[#ADBC9F]/30";
  return (
    <SkeletonCard isDark={isDark}>
      {/* Kind badge + confidence */}
      <div className="flex items-center gap-2 mb-3">
        <Shimmer className={`w-20 h-5 rounded-full ${base}`} />
        <Shimmer className={`w-16 h-5 rounded-full ${base}`} />
        <div className="flex-1" />
        <Shimmer className={`w-12 h-5 rounded-full ${base}`} />
      </div>
      {/* Claim */}
      <Shimmer className={`h-4 ${wide ? "w-4/5" : "w-3/4"} mb-2 ${base}`} />
      {/* Evidence */}
      <Shimmer className={`h-3 w-full mb-1.5 ${base}`} />
      <Shimmer className={`h-3 w-5/6 mb-3 ${base}`} />
      {/* Recommendation */}
      <div className={`flex items-start gap-2 p-3 rounded-xl ${isDark ? "bg-[#0d1a0f]/60" : "bg-[#FBFADA]/60"}`}>
        <Shimmer className={`w-4 h-4 shrink-0 mt-0.5 ${base}`} />
        <div className="flex-1 space-y-1.5">
          <Shimmer className={`h-3 w-full ${base}`} />
          <Shimmer className={`h-3 w-4/5 ${base}`} />
        </div>
      </div>
    </SkeletonCard>
  );
}

// ── Filter bar skeleton ────────────────────────────────────────────────────────

function InsightFilterBarSkeleton({ isDark }: { isDark: boolean }) {
  const base = isDark ? "bg-[#1e2e22]/60" : "bg-[#ADBC9F]/30";
  const widths = ["w-12", "w-24", "w-20", "w-20", "w-20"];
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {widths.map((w, i) => (
        <Shimmer key={i} className={`${w} h-7 rounded-lg ${base}`} />
      ))}
    </div>
  );
}

// ── Two-column section skeleton (As White / As Black) ─────────────────────────

function TwoColumnSkeleton({ isDark }: { isDark: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {[3, 4].map((rows, i) => (
        <SkeletonCard key={i} isDark={isDark}>
          <SectionHeader isDark={isDark} />
          <BulletRows count={rows} isDark={isDark} />
        </SkeletonCard>
      ))}
    </div>
  );
}

// ── Prep checklist skeleton ────────────────────────────────────────────────────

function PrepChecklistSkeleton({ isDark }: { isDark: boolean }) {
  const base = isDark ? "bg-[#1e2e22]/60" : "bg-[#ADBC9F]/30";
  return (
    <SkeletonCard isDark={isDark}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Shimmer className={`w-4 h-4 shrink-0 ${base}`} />
        <Shimmer className={`h-3.5 flex-1 max-w-[120px] ${base}`} />
        <Shimmer className={`w-10 h-3 ${base}`} />
      </div>
      {/* Progress bar */}
      <div className={`h-1 rounded-full mb-3 ${isDark ? "bg-[#1e2e22]" : "bg-[#ADBC9F]/40"}`}>
        <div className={`h-full w-0 rounded-full ${base}`} />
      </div>
      {/* Items */}
      <ul className="space-y-2.5">
        {[80, 65, 90, 70, 75].map((pct, i) => (
          <li key={i} className="flex items-start gap-2.5">
            <Shimmer className={`w-4 h-4 rounded shrink-0 mt-0.5 ${base}`} />
            <div
              className={`h-3 rounded-lg animate-shimmer ${base}`}
              style={{ width: `${pct}%` }}
              aria-hidden="true"
            />
          </li>
        ))}
      </ul>
    </SkeletonCard>
  );
}

// ── Progress indicator ─────────────────────────────────────────────────────────

function ProgressSteps({ isDark }: { isDark: boolean }) {
  const [step, setStep] = React.useState(0);
  const steps = [
    "Fetching recent games…",
    "Classifying openings…",
    "Scoring weaknesses…",
    "Building prep plan…",
  ];

  React.useEffect(() => {
    const id = setInterval(() => setStep(s => Math.min(s + 1, steps.length - 1)), 1800);
    return () => clearInterval(id);
  }, [steps.length]);

  return (
    <div className="flex flex-col items-center gap-1.5 py-2">
      {steps.map((label, i) => (
        <div
          key={i}
          className={`flex items-center gap-2 transition-all duration-500 ${
            i < step ? "opacity-35" : i === step ? "opacity-100" : "opacity-20"
          }`}
        >
          {i < step ? (
            <span className="text-[#5B9A6A] text-[10px]">✓</span>
          ) : i === step ? (
            <span className="w-1.5 h-1.5 rounded-full bg-[#5B9A6A] animate-pulse inline-block" />
          ) : (
            <span className="w-1.5 h-1.5 rounded-full bg-current opacity-20 inline-block" />
          )}
          <span className={`text-[11px] ${isDark ? "text-white/50" : "text-[#436850]/70"}`}>{label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Main export ────────────────────────────────────────────────────────────────

import React from "react";

/**
 * Drop-in replacement for V3ScoutReportTab while loading.
 * Mirrors the exact section order and proportions of the real report.
 */
export function V3ScoutReportSkeleton({ isDark }: SkeletonProps) {
  return (
    <div
      className="space-y-4"
      role="status"
      aria-label="Loading scouting report…"
      aria-busy="true"
    >
      {/* Opponent hero */}
      <OpponentHeroSkeleton isDark={isDark} />

      {/* Progress steps — centered above the skeleton content */}
      <div className={`rounded-2xl border px-4 py-3 ${
        isDark
          ? "bg-[#0d1a0f]/60 border-[#1e2e22]/60"
          : "bg-[#FBFADA]/60 border-[#ADBC9F]/50"
      }`}>
        <ProgressSteps isDark={isDark} />
      </div>

      {/* Data quality banner */}
      <DataQualityBannerSkeleton isDark={isDark} />

      {/* Matchup summary */}
      <SkeletonCard isDark={isDark}>
        <SectionHeader isDark={isDark} />
        <BulletRows count={4} isDark={isDark} />
      </SkeletonCard>

      {/* Opening forecast */}
      <OpeningForecastSkeleton isDark={isDark} />

      {/* As White / As Black */}
      <TwoColumnSkeleton isDark={isDark} />

      {/* Insight filter bar */}
      <InsightFilterBarSkeleton isDark={isDark} />

      {/* Insight cards */}
      <InsightCardSkeleton isDark={isDark} wide />
      <InsightCardSkeleton isDark={isDark} />
      <InsightCardSkeleton isDark={isDark} wide />

      {/* Deviation points */}
      <SkeletonCard isDark={isDark}>
        <SectionHeader isDark={isDark} />
        <BulletRows count={3} isDark={isDark} />
      </SkeletonCard>

      {/* Prep checklist */}
      <PrepChecklistSkeleton isDark={isDark} />

      {/* Screen-reader live region */}
      <span className="sr-only" aria-live="polite">
        Loading scouting report, please wait…
      </span>
    </div>
  );
}
