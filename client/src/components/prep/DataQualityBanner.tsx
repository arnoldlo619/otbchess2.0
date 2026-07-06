/**
 * DataQualityBanner — displays V3 ScoutReportV3.dataQuality info
 * Shows data grade (A/B/C/D), game counts, and any quality notes.
 */
import { AlertTriangle, CheckCircle, Info, ShieldAlert } from "lucide-react";
import type { ScoutReportV3 } from "../../../../shared/prepTypes";

type DataQuality = ScoutReportV3["dataQuality"];

interface Props {
  dataQuality: DataQuality;
  isDark: boolean;
}

const GRADE_CONFIG = {
  A: {
    label: "Excellent Data",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/20",
    bgLight: "bg-emerald-50 border-emerald-200 text-emerald-800",
    icon: <CheckCircle className="w-3.5 h-3.5" />,
  },
  B: {
    label: "Good Data",
    color: "text-blue-400",
    bg: "bg-blue-500/10 border-blue-500/20",
    bgLight: "bg-blue-50 border-blue-200 text-blue-800",
    icon: <Info className="w-3.5 h-3.5" />,
  },
  C: {
    label: "Limited Data",
    color: "text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/20",
    bgLight: "bg-amber-50 border-amber-200 text-amber-800",
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
  },
  D: {
    label: "Thin Data",
    color: "text-red-400",
    bg: "bg-red-500/10 border-red-500/20",
    bgLight: "bg-red-50 border-red-200 text-red-800",
    icon: <ShieldAlert className="w-3.5 h-3.5" />,
  },
};

export function DataQualityBanner({ dataQuality: dq, isDark }: Props) {
  const cfg = GRADE_CONFIG[dq.grade];
  const excludedTotal = Object.values(dq.excluded).reduce((a, b) => a + b, 0);
  const windowFrom = dq.window?.from ? new Date(dq.window.from).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : null;
  const windowTo = dq.window?.to ? new Date(dq.window.to).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : null;

  return (
    <div className={`rounded-xl border px-3.5 py-3 text-xs ${isDark ? cfg.bg + " " + cfg.color : cfg.bgLight}`}>
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 shrink-0">{cfg.icon}</span>
        <div className="flex-1 min-w-0 space-y-1">
          {/* Grade + headline */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold">
              Grade {dq.grade} — {cfg.label}
            </span>
            <span className={`font-medium opacity-70`}>
              {dq.parsed} games analyzed
              {dq.quarantined > 0 && `, ${dq.quarantined} quarantined`}
              {excludedTotal > 0 && `, ${excludedTotal} excluded`}
            </span>
          </div>

          {/* Window */}
          {windowFrom && windowTo && (
            <p className="opacity-60">
              Data window: {windowFrom} – {windowTo}
              {dq.ratedShare < 1 && ` · ${Math.round(dq.ratedShare * 100)}% rated`}
            </p>
          )}

          {/* Notes */}
          {dq.notes.length > 0 && (
            <ul className="space-y-0.5 mt-1">
              {dq.notes.map((note, i) => (
                <li key={i} className="opacity-80">· {note}</li>
              ))}
            </ul>
          )}
        </div>

        {/* Grade badge */}
        <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center font-black text-base border ${isDark ? cfg.bg + " " + cfg.color : cfg.bgLight}`}>
          {dq.grade}
        </div>
      </div>
    </div>
  );
}
