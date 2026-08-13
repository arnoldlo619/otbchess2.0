import type { PopulationReference } from "../../../../shared/prepTypes";

interface Props {
  references?: PopulationReference[];
  isDark: boolean;
}

function percent(numerator?: string, denominator?: string): string | null {
  if (!numerator || !denominator || Number(denominator) <= 0) return null;
  const value = (Number(numerator) / Number(denominator)) * 100;
  return Number.isFinite(value) ? `${Math.round(value)}%` : null;
}

export function PopulationContextCard({ references, isDark }: Props) {
  const reference = references?.[0];
  if (!reference) return null;
  if (reference.availability === "pending") {
    return <section className={`rounded-xl border px-4 py-3 ${isDark ? "border-white/[0.08] bg-white/[0.025] text-white/55" : "border-black/[0.08] bg-black/[0.02] text-black/50"}`} aria-label="Population opening context">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em]">Population context</p>
      <p className="mt-1 text-xs">Refreshing the anonymous Lichess benchmark in the background. Your player-specific evidence and recommendations are ready now.</p>
    </section>;
  }
  if (reference.source === "unavailable") return null;
  const sourceLabel = reference.source === "lichess-open-database-local" ? "Local Lichess aggregate" : "Official Lichess Explorer";
  const populationShare = percent(reference.populationMoveCount, reference.populationDenominator);
  const opponentShare = reference.opponentDenominator > 0 ? `${Math.round((reference.opponentCount / reference.opponentDenominator) * 100)}%` : null;
  const subtle = isDark ? "border-white/[0.08] bg-white/[0.025] text-white/55" : "border-black/[0.08] bg-black/[0.02] text-black/50";
  const main = isDark ? "text-white/85" : "text-black/80";
  return (
    <section className={`rounded-xl border px-4 py-3 ${subtle}`} aria-label="Population opening context">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${main}`}>Population context</p>
          <p className="mt-0.5 text-xs">{sourceLabel} · {reference.filters.speeds.join(" + ")} · {reference.filters.ratingBand === 0 ? "all ratings" : `${reference.filters.ratingBand}+`}</p>
        </div>
        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${reference.availability === "complete" ? "border-emerald-500/30 text-emerald-500" : "border-amber-500/30 text-amber-500"}`}>
          {reference.availability}
        </span>
      </div>
      {reference.populationDenominator && reference.populationMoveCount && (
        <p className={`mt-2 text-sm leading-6 ${main}`}>
          After this position, the opponent chose <strong>{reference.opponentMoveSan}</strong> in {opponentShare ?? "—"} of their eligible games; comparable population play chose it {populationShare ?? "—"} of the time.
        </p>
      )}
      <p className="mt-2 text-[11px] leading-4">Population data is a separate anonymous benchmark. It does not change the player-specific evidence, confidence, or recommendation in this report.</p>
    </section>
  );
}
