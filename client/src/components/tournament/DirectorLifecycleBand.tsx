import {
  AlertCircle,
  CheckCircle2,
  Circle,
  Pause,
  Play,
  RefreshCw,
  Trophy,
  XCircle,
} from "lucide-react";
import type { DirectorLifecycleDisplay } from "@/lib/tournamentUtils";

interface DirectorLifecycleBandProps {
  lifecycle: DirectorLifecycleDisplay;
  lastSaved: string | null;
  isDark: boolean;
  onRetryFinalization?: () => void;
}

const toneClasses = {
  neutral: {
    dark: "border-white/10 bg-white/[0.04] text-white/70",
    light: "border-[#ADBC9F] bg-white text-[#436850]",
  },
  info: {
    dark: "border-sky-400/20 bg-sky-400/[0.08] text-sky-200",
    light: "border-sky-200 bg-sky-50 text-sky-800",
  },
  success: {
    dark: "border-[#4CAF50]/25 bg-[#4CAF50]/[0.08] text-[#79D588]",
    light: "border-[#ADBC9F] bg-[#F0F8F2] text-[#2F5A3D]",
  },
  warning: {
    dark: "border-amber-400/25 bg-amber-400/[0.08] text-amber-200",
    light: "border-amber-200 bg-amber-50 text-amber-800",
  },
  danger: {
    dark: "border-red-400/25 bg-red-400/[0.08] text-red-200",
    light: "border-red-200 bg-red-50 text-red-800",
  },
} as const;

function LifecycleIcon({ status }: { status: DirectorLifecycleDisplay["status"] }) {
  const className = "h-4 w-4";
  if (status === "completed") return <Trophy className={className} aria-hidden="true" />;
  if (status === "finalizing") return <RefreshCw className={`${className} animate-spin`} aria-hidden="true" />;
  if (status === "finalization_error") return <AlertCircle className={className} aria-hidden="true" />;
  if (status === "cancelled") return <XCircle className={className} aria-hidden="true" />;
  if (status === "paused") return <Pause className={className} aria-hidden="true" />;
  if (status === "live") return <Play className={className} aria-hidden="true" />;
  if (status === "ready_to_start" || status === "between_rounds" || status === "awaiting_finalization") {
    return <CheckCircle2 className={className} aria-hidden="true" />;
  }
  return <Circle className={className} aria-hidden="true" />;
}

function formatSavedAt(value: string | null): string {
  if (!value) return "Saving locally";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Saved locally";
  return `Saved ${parsed.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
}

export function DirectorLifecycleBand({ lifecycle, lastSaved, isDark, onRetryFinalization }: DirectorLifecycleBandProps) {
  const palette = toneClasses[lifecycle.tone][isDark ? "dark" : "light"];
  return (
    <section
      aria-label="Tournament status"
      aria-live={lifecycle.status === "finalization_error" ? "assertive" : "polite"}
      className={`flex flex-col gap-3 rounded-2xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${palette}`}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-current/10">
          <LifecycleIcon status={lifecycle.status} />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-black tracking-tight">{lifecycle.label}</p>
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${isDark ? "border-white/10 text-white/45" : "border-[#ADBC9F] text-[#436850]"}`}>
              {formatSavedAt(lastSaved)}
            </span>
          </div>
          <p className={`mt-0.5 text-xs leading-5 ${isDark ? "text-white/50" : "text-[#436850]"}`}>{lifecycle.description}</p>
        </div>
      </div>
      {lifecycle.status === "finalization_error" && onRetryFinalization && (
        <button
          type="button"
          onClick={onRetryFinalization}
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 text-xs font-bold text-white transition-colors hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          Retry finalization
        </button>
      )}
    </section>
  );
}
