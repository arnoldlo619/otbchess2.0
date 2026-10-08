/**
 * CreateLeagueWizard — Club League creation with Full Season as the flagship
 * default. Legacy League rows retain their original format and behavior.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useAuthContext } from "@/context/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useAccessibleOverlay } from "@/hooks/useAccessibleOverlay";
import { authFetch } from "@/lib/apiFetch";
import {
  CLASSIC_ROUND_ROBIN_FORMAT,
  FULL_SEASON_FORMAT,
  getFullSeasonStructure,
  type FullSeasonStructure,
} from "@shared/fullSeasonLeague";

interface CommissionerClub {
  id: string;
  name: string;
  avatarUrl?: string | null;
  accentColor?: string | null;
  memberCount?: number;
}

type FormatType = typeof FULL_SEASON_FORMAT | typeof CLASSIC_ROUND_ROBIN_FORMAT;

const FULL_SEASON_RECOMMENDATIONS = [
  { value: 16, label: "16", tag: "Recommended" },
  { value: 22, label: "22", tag: "Expanded" },
  { value: 28, label: "28", tag: "Large" },
] as const;
const CLASSIC_SIZES = [4, 6, 8, 10] as const;
const FULL_SEASON_SIZES = Array.from({ length: 13 }, (_, index) => 4 + index * 2);
const TIME_CONTROLS = [
  { base: 5, increment: 3, label: "5 + 3", hint: "Fast-paced" },
  { base: 10, increment: 0, label: "10 + 0", hint: "Recommended" },
  { base: 10, increment: 5, label: "10 + 5", hint: "Thoughtful" },
  { base: 15, increment: 10, label: "15 + 10", hint: "Long-form" },
] as const;

function estimateSession(base: number, increment: number, games: number): string {
  const minutes = Math.max(45, Math.round(games * (base * 2 + increment * 0.8) + 20));
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return hours ? `About ${hours}${remainder ? `h ${remainder}m` : "h"}` : `About ${minutes} min`;
}

function formatLabel(format: FormatType): string {
  return format === FULL_SEASON_FORMAT ? "Full Season League" : "Classic Round Robin";
}

function StepIndicator({ current }: { current: number }) {
  return (
    <ol className="flex items-center gap-1.5" aria-label={`Step ${current + 1} of 4`}>
      {[0, 1, 2, 3].map((index) => (
        <li
          key={index}
          className={`h-1 rounded-full transition-[width,background-color] duration-200 ${
            index <= current ? "w-7 bg-[oklch(0.68_0.16_145)]" : "w-3 bg-white/15"
          }`}
        />
      ))}
    </ol>
  );
}

function FullSeasonPreview({ structure, timeControlBase, timeControlIncrement, compact = false }: {
  structure: FullSeasonStructure;
  timeControlBase: number;
  timeControlIncrement: number;
  compact?: boolean;
}) {
  const statistics = compact
    ? [
        ["Regular season", `${structure.regularSeasonWeeks} weeks`],
        ["Per player", `${structure.gamesPerPlayer} games`],
        ["Playoffs", `Top ${structure.playoffQualifierCount}`],
      ]
    : [
        ["Opponents / player", String(structure.opponentRounds)],
        ["Games / player", String(structure.gamesPerPlayer)],
        ["League weeks", String(structure.regularSeasonWeeks)],
        ["Match set", "3 opponents · 6 games"],
        ["Championship Day", `Top ${structure.playoffQualifierCount}`],
        ["Session estimate", estimateSession(timeControlBase, timeControlIncrement, 6)],
  ];
  return (
    <section className="overflow-hidden rounded-2xl border border-[oklch(0.68_0.16_145)]/25 bg-[oklch(0.68_0.16_145)]/[0.07]">
      <div className="px-5 py-4 border-b border-[oklch(0.68_0.16_145)]/15">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[oklch(0.76_0.16_145)]">Full Season structure</p>
        <p className="mt-1 text-base leading-relaxed text-white/70">Every opponent twice, with colors reversed.</p>
      </div>
      <dl className={`grid ${compact ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-3"} divide-x divide-y divide-white/[0.07]`}>
        {statistics.map(([label, value]) => (
          <div key={label} className="min-w-0 px-4 py-3.5">
            <dt className="text-[11px] font-semibold uppercase tracking-[0.1em] text-white/45">{label}</dt>
            <dd className="mt-1 truncate text-base font-semibold text-white/90">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

interface CreateLeagueWizardProps {
  onClose?: () => void;
}

export function CreateLeagueWizard({ onClose }: CreateLeagueWizardProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const { user } = useAuthContext();
  const [, navigate] = useLocation();
  const [step, setStep] = useState(0);
  const [clubs, setClubs] = useState<CommissionerClub[]>([]);
  const [clubsLoading, setClubsLoading] = useState(true);
  const [selectedClubId, setSelectedClubId] = useState("");
  const [leagueName, setLeagueName] = useState("");
  const [description, setDescription] = useState("");
  const [formatType, setFormatType] = useState<FormatType>(FULL_SEASON_FORMAT);
  const [maxPlayers, setMaxPlayers] = useState(16);
  const [timeControlBase, setTimeControlBase] = useState(10);
  const [timeControlIncrement, setTimeControlIncrement] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [nameError, setNameError] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const closeWizard = useCallback(() => onClose?.(), [onClose]);

  useAccessibleOverlay({ open: true, onClose: closeWizard, containerRef: dialogRef, initialFocusRef: closeButtonRef });

  const selectedClub = clubs.find((club) => club.id === selectedClubId);
  const structure = formatType === FULL_SEASON_FORMAT ? getFullSeasonStructure(maxPlayers) : null;
  const selectedClassicWeeks = maxPlayers - 1;

  useEffect(() => {
    if (!user || user.isGuest) {
      setClubsLoading(false);
      return;
    }
    let cancelled = false;
    void authFetch("/api/leagues/mine-as-commissioner")
      .then(async (response) => response.ok ? response.json() as Promise<CommissionerClub[]> : [])
      .then((data) => {
        if (cancelled) return;
        setClubs(data);
        if (data.length === 1) setSelectedClubId(data[0].id);
      })
      .catch(() => {
        if (!cancelled) setClubs([]);
      })
      .finally(() => {
        if (!cancelled) setClubsLoading(false);
      });
    return () => { cancelled = true; };
  }, [user]);

  function switchFormat(nextFormat: FormatType) {
    setFormatType(nextFormat);
    setMaxPlayers(nextFormat === FULL_SEASON_FORMAT ? 16 : 8);
  }

  function canAdvance(): boolean {
    if (step === 0) return Boolean(selectedClubId);
    if (step === 1) return leagueName.trim().length >= 2;
    return true;
  }

  function advance() {
    if (step === 1 && leagueName.trim().length < 2) {
      setNameError("League name must be at least 2 characters.");
      return;
    }
    setNameError("");
    setStep((current) => Math.min(current + 1, 3));
  }

  async function handleCreate() {
    if (!selectedClubId || !leagueName.trim()) return;
    setSubmitting(true);
    try {
      const response = await authFetch("/api/leagues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clubId: selectedClubId,
          name: leagueName.trim(),
          description: description.trim() || undefined,
          maxPlayers,
          formatType,
          timeControlBase,
          timeControlIncrement,
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error ?? "Failed to create league");
      }
      const data = await response.json() as { leagueId: string };
      toast.success(formatType === FULL_SEASON_FORMAT ? "Full Season League created. Lock your roster when ready." : "Classic Round Robin created.");
      onClose?.();
      navigate(`/leagues/${data.leagueId}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Network error — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const panelTitle = ["Choose a club", "League details", "Format and session", "Review season"][step];
  const fieldClass = "w-full rounded-xl border border-white/15 bg-white/[0.06] px-4 py-3 text-base text-white placeholder:text-white/30 outline-none transition focus:border-[oklch(0.68_0.16_145)]/70 focus:ring-2 focus:ring-[oklch(0.68_0.16_145)]/20";

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-5">
      <button type="button" tabIndex={-1} aria-label="Close create league wizard" onClick={closeWizard} className="absolute inset-0 cursor-default bg-black/75 backdrop-blur-sm" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-league-title"
        tabIndex={-1}
        data-testid="create-league-wizard"
        className="relative flex max-h-[calc(100dvh-1.5rem)] w-full max-w-3xl flex-col overflow-hidden rounded-[22px] shadow-2xl sm:max-h-[90vh]"
        style={{ background: isDark ? "oklch(0.15 0.05 145)" : "oklch(0.17 0.05 145)", border: "1px solid oklch(0.68 0.16 145 / 0.2)" }}
      >
        <header className="flex items-center justify-between gap-4 border-b border-white/[0.08] px-5 py-5 sm:px-8">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-[oklch(0.76_0.16_145)]">Create Club League</p>
            <h1 id="create-league-title" className="mt-1 truncate text-[18px] font-semibold leading-none text-white">{panelTitle}</h1>
          </div>
          <div className="flex items-center gap-3">
            <StepIndicator current={step} />
            <button ref={closeButtonRef} type="button" onClick={closeWizard} aria-label="Close create league wizard" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-white/50 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[oklch(0.68_0.16_145)]"><X size={18} aria-hidden="true" /></button>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-8 sm:py-8">
          {step === 0 && (
            <section className="space-y-4">
              <div><h2 className="text-3xl font-bold tracking-tight text-white sm:text-[32px]">Which club is this for?</h2><p className="mt-2 text-base leading-relaxed text-white/55">Only club owners, admins, and directors can create a league.</p></div>
              {clubsLoading ? <div className="flex justify-center py-12"><Loader2 className="animate-spin text-white/40" /></div> : clubs.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-10 text-center"><Users className="mx-auto mb-3 text-white/25" size={32} /><p className="text-base font-semibold text-white/85">No eligible clubs found</p><a href="/clubs" className="mt-3 inline-flex items-center gap-1.5 text-base font-semibold text-[oklch(0.76_0.16_145)] hover:underline">Create or join a club <ArrowRight size={16} /></a></div>
              ) : <div className="space-y-2">{clubs.map((club) => {
                const selected = selectedClubId === club.id;
                return <button key={club.id} type="button" onClick={() => setSelectedClubId(club.id)} className={`flex w-full items-center gap-3 rounded-xl border p-4 text-left transition duration-200 hover:-translate-y-px ${selected ? "border-[oklch(0.68_0.16_145)]/70 bg-[oklch(0.68_0.16_145)]/10" : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]"}`}>
                  <div className="flex h-11 w-11 flex-none items-center justify-center overflow-hidden rounded-lg bg-[oklch(0.28_0.08_145)] text-base font-semibold text-white">{club.avatarUrl ? <img src={club.avatarUrl} alt="" className="h-full w-full object-cover" /> : club.name.charAt(0).toUpperCase()}</div>
                  <div className="min-w-0 flex-1"><p className="truncate text-base font-semibold text-white">{club.name}</p><p className="mt-0.5 text-sm text-white/50">{club.memberCount ?? 0} members</p></div>
                  {selected && <CheckCircle2 className="flex-none text-[oklch(0.76_0.16_145)]" size={19} />}
                </button>;
              })}</div>}
            </section>
          )}

          {step === 1 && (
            <section className="space-y-5"><div><h2 className="text-3xl font-bold tracking-tight text-white sm:text-[32px]">Name the season</h2><p className="mt-2 text-base leading-relaxed text-white/55">Players will see this name across the season, standings, and Championship Day.</p></div>
              <div><label htmlFor="league-name" className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-white/55">League name</label><input id="league-name" autoFocus value={leagueName} onChange={(event) => { setLeagueName(event.target.value); if (event.target.value.trim().length >= 2) setNameError(""); }} maxLength={100} placeholder="e.g. Spring 2026 Club League" className={`${fieldClass} ${nameError ? "border-red-400/70" : ""}`} />{nameError && <p className="mt-1.5 text-sm text-red-300">{nameError}</p>}</div>
              <div><label htmlFor="league-description" className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-white/55">Season note <span className="font-normal normal-case tracking-normal">(optional)</span></label><textarea id="league-description" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} rows={4} placeholder="Optional rules, venue notes, or prize details." className={`${fieldClass} resize-none text-base`} /><p className="mt-1 text-right text-xs text-white/35">{description.length}/500</p></div>
            </section>
          )}

          {step === 2 && (
            <section className="space-y-6"><div><h2 className="text-3xl font-bold tracking-tight text-white sm:text-[32px]">Choose the competition</h2><p className="mt-2 text-base leading-relaxed text-white/55">Full Season is the recommended club experience. Classic stays available for smaller, simpler leagues.</p></div>
              <div className="grid gap-3 sm:grid-cols-2">
                <button type="button" onClick={() => switchFormat(FULL_SEASON_FORMAT)} className={`relative rounded-2xl border p-5 text-left transition duration-200 hover:-translate-y-px ${formatType === FULL_SEASON_FORMAT ? "border-[oklch(0.68_0.16_145)] bg-[oklch(0.68_0.16_145)]/10" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"}`}>
                  <span className="absolute right-4 top-4 rounded-full bg-[oklch(0.68_0.16_145)]/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-[oklch(0.78_0.16_145)]">Recommended</span><p className="pr-28 text-lg font-semibold text-white">Full Season League</p><p className="mt-2 text-base leading-relaxed text-white/55">Three opponents per week, two color-reversed games each, standings, ratings, and Championship Day.</p>
                </button>
                <button type="button" onClick={() => switchFormat(CLASSIC_ROUND_ROBIN_FORMAT)} className={`rounded-2xl border p-5 text-left transition duration-200 hover:-translate-y-px ${formatType === CLASSIC_ROUND_ROBIN_FORMAT ? "border-[oklch(0.68_0.16_145)] bg-[oklch(0.68_0.16_145)]/10" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"}`}><p className="text-lg font-semibold text-white">Classic Round Robin</p><p className="mt-2 text-base leading-relaxed text-white/55">The established single-game format for compact clubs and shorter league nights.</p></button>
              </div>
              {formatType === FULL_SEASON_FORMAT ? <div className="space-y-3"><div className="flex items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-white/55">Roster size</p><p className="mt-1 text-base text-white/55">Optimized for even rosters of 4–28 players.</p></div></div>
                <div className="grid grid-cols-3 gap-2">{FULL_SEASON_RECOMMENDATIONS.map((size) => <button key={size.value} type="button" onClick={() => setMaxPlayers(size.value)} className={`rounded-xl border px-3 py-3.5 text-center transition duration-200 hover:-translate-y-px ${maxPlayers === size.value ? "border-[oklch(0.68_0.16_145)] bg-[oklch(0.68_0.16_145)]/10" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"}`}><span className="block text-xl font-bold text-white">{size.label}</span><span className="mt-1 block text-[11px] font-semibold uppercase tracking-wide text-[oklch(0.76_0.16_145)]">{size.tag}</span></button>)}</div>
                <label className="block text-sm font-semibold text-white/60">All supported sizes<select aria-label="Full Season roster size" value={maxPlayers} onChange={(event) => setMaxPlayers(Number(event.target.value))} className="mt-1.5 w-full rounded-xl border border-white/15 bg-white/[0.06] px-3 py-3 text-base text-white outline-none focus:ring-2 focus:ring-[oklch(0.68_0.16_145)]/30">{FULL_SEASON_SIZES.map((size) => <option key={size} value={size} className="bg-[#122016]">{size} players</option>)}</select></label>
              </div> : <div><p className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-white/55">League size</p><div className="grid grid-cols-4 gap-2">{CLASSIC_SIZES.map((size) => <button key={size} type="button" onClick={() => setMaxPlayers(size)} className={`rounded-xl border py-3.5 text-center text-base font-semibold transition duration-200 hover:-translate-y-px ${maxPlayers === size ? "border-[oklch(0.68_0.16_145)] bg-[oklch(0.68_0.16_145)]/10 text-white" : "border-white/10 bg-white/[0.03] text-white/60"}`}>{size}</button>)}</div></div>}
              <div><p className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-white/55">Time control</p><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{TIME_CONTROLS.map((control) => { const selected = timeControlBase === control.base && timeControlIncrement === control.increment; return <button key={control.label} type="button" onClick={() => { setTimeControlBase(control.base); setTimeControlIncrement(control.increment); }} className={`rounded-xl border p-3.5 text-left transition duration-200 hover:-translate-y-px ${selected ? "border-[oklch(0.68_0.16_145)] bg-[oklch(0.68_0.16_145)]/10" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"}`}><span className="block text-base font-bold text-white">{control.label}</span><span className="mt-0.5 block text-[11px] text-white/50">{control.hint}</span></button>; })}</div></div>
              {structure ? <FullSeasonPreview structure={structure} timeControlBase={timeControlBase} timeControlIncrement={timeControlIncrement} /> : <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-base leading-relaxed text-white/60"><strong className="text-white">Classic structure:</strong> {selectedClassicWeeks} rounds with one game against every player.</div>}
            </section>
          )}

          {step === 3 && (
            <section className="space-y-5"><div><h2 className="text-3xl font-bold tracking-tight text-white sm:text-[32px]">Ready to create?</h2><p className="mt-2 text-base leading-relaxed text-white/55">The league opens in Draft. Invite players, lock the roster, then generate the first Match Set.</p></div>
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] divide-y divide-white/[0.08]"><ReviewRow label="Club" value={selectedClub?.name ?? "—"} /><ReviewRow label="Season" value={leagueName || "—"} /><ReviewRow label="Format" value={formatLabel(formatType)} /><ReviewRow label="Roster" value={`${maxPlayers} players`} /><ReviewRow label="Time control" value={`${timeControlBase} + ${timeControlIncrement}`} />{structure && <ReviewRow label="Season map" value={`${structure.regularSeasonWeeks} weeks · ${structure.gamesPerPlayer} games/player · Top ${structure.playoffQualifierCount}`} />}</div>
              {structure && <FullSeasonPreview structure={structure} timeControlBase={timeControlBase} timeControlIncrement={timeControlIncrement} compact />}
              <div className="rounded-2xl border border-[oklch(0.68_0.16_145)]/20 bg-[oklch(0.68_0.16_145)]/[0.06] p-5"><p className="text-base leading-relaxed text-white/70">{formatType === FULL_SEASON_FORMAT ? "Every Full Season encounter is a locked two-game, color-reversed set. Pairings never repeat and the regular season remains mathematically complete." : "Classic Round Robin keeps the established single-game club league experience."}</p></div>
            </section>
          )}
        </main>

        <footer className="flex items-center justify-between gap-3 border-t border-white/[0.08] px-5 py-5 sm:px-8"><button type="button" onClick={step === 0 ? closeWizard : () => setStep((current) => current - 1)} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-base font-medium text-white/55 transition hover:text-white"><ChevronLeft size={18} />{step === 0 ? "Cancel" : "Back"}</button>{step < 3 ? <button type="button" disabled={!canAdvance()} onClick={advance} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[oklch(0.68_0.16_145)] px-6 text-base font-bold text-[oklch(0.12_0.04_145)] transition hover:bg-[oklch(0.75_0.17_145)] disabled:cursor-not-allowed disabled:opacity-40">Continue <ChevronRight size={18} /></button> : <button type="button" disabled={submitting} onClick={() => void handleCreate()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[oklch(0.68_0.16_145)] px-6 text-base font-bold text-[oklch(0.12_0.04_145)] transition hover:bg-[oklch(0.75_0.17_145)] disabled:cursor-wait disabled:opacity-60">{submitting ? <><Loader2 size={18} className="animate-spin" />Creating</> : "Create league"}</button>}</footer>
      </div>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-start gap-5 px-5 py-4"><dt className="w-32 flex-none pt-0.5 text-xs font-bold uppercase tracking-[0.12em] text-white/45">{label}</dt><dd className="min-w-0 flex-1 text-base font-medium leading-relaxed text-white/90">{value}</dd></div>;
}
