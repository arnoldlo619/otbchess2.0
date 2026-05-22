/**
 * CreateLeagueWizard
 * Full-screen 4-step wizard for creating a Chess Club League.
 *
 * Steps:
 *   1. Select Club — pick which club to create the league under
 *   2. League Details — name + optional description
 *   3. Format & Size — format type + max players (league size)
 *   4. Review & Create — summary before submission
 */

import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import {
  X,
  ChevronRight,
  ChevronLeft,
  Trophy,
  Users,
  Swords,
  RotateCcw,
  CheckCircle2,
  Building2,
  Loader2,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuthContext } from "@/context/AuthContext";
import { authFetch } from "@/lib/apiFetch";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

interface CommissionerClub {
  id: string;
  name: string;
  avatarUrl?: string | null;
  accentColor?: string | null;
  memberCount?: number;
}

type FormatType = "round_robin" | "swiss" | "double_round_robin";

const FORMAT_OPTIONS: {
  value: FormatType;
  label: string;
  description: string;
  icon: React.ReactNode;
  tag: string;
}[] = [
  {
    value: "round_robin",
    label: "Round Robin",
    description: "Every player faces every other player once. Classic league format — fair and balanced.",
    icon: <RotateCcw className="w-5 h-5" />,
    tag: "Most Popular",
  },
  {
    value: "double_round_robin",
    label: "Double Round Robin",
    description: "Each player faces every other player twice — once with White, once with Black.",
    icon: <Swords className="w-5 h-5" />,
    tag: "Competitive",
  },
  {
    value: "swiss",
    label: "Swiss System",
    description: "Players are paired by score each week. Great for larger groups.",
    icon: <Trophy className="w-5 h-5" />,
    tag: "Large Groups",
  },
];

const SIZE_OPTIONS: { value: number; label: string; weeks: number }[] = [
  { value: 4,  label: "4 Players",  weeks: 3  },
  { value: 6,  label: "6 Players",  weeks: 5  },
  { value: 8,  label: "8 Players",  weeks: 7  },
  { value: 10, label: "10 Players", weeks: 9  },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1 rounded-full transition-all duration-300 ${
            i < current
              ? "bg-[oklch(0.65_0.14_145)] w-8"
              : i === current
              ? "bg-[oklch(0.65_0.14_145)]/60 w-8"
              : "bg-white/15 w-4"
          }`}
        />
      ))}
    </div>
  );
}

// ── Main Wizard ───────────────────────────────────────────────────────────────

interface CreateLeagueWizardProps {
  onClose?: () => void;
}

export function CreateLeagueWizard({ onClose }: CreateLeagueWizardProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const { user } = useAuthContext();
  const [, navigate] = useLocation();

  // Step state
  const [step, setStep] = useState(0); // 0–3
  const TOTAL_STEPS = 4;

  // Form state
  const [clubs, setClubs] = useState<CommissionerClub[]>([]);
  const [clubsLoading, setClubsLoading] = useState(true);
  const [selectedClubId, setSelectedClubId] = useState<string>("");
  const [leagueName, setLeagueName] = useState("");
  const [description, setDescription] = useState("");
  const [formatType, setFormatType] = useState<FormatType>("round_robin");
  const [maxPlayers, setMaxPlayers] = useState<number>(8);
  const [submitting, setSubmitting] = useState(false);
  const [nameError, setNameError] = useState("");

  // Derived
  const selectedClub = clubs.find((c) => c.id === selectedClubId);
  const selectedFormat = FORMAT_OPTIONS.find((f) => f.value === formatType)!;
  const selectedSize = SIZE_OPTIONS.find((s) => s.value === maxPlayers)!;

  // Fetch clubs where user is commissioner-eligible
  const fetchClubs = useCallback(async () => {
    setClubsLoading(true);
    try {
      const res = await authFetch("/api/leagues/mine-as-commissioner");
      if (res.ok) {
        const data: CommissionerClub[] = await res.json();
        setClubs(data);
        if (data.length === 1) setSelectedClubId(data[0].id);
      }
    } catch {
      // silent — show empty state
    } finally {
      setClubsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user && !user.isGuest) fetchClubs();
    else setClubsLoading(false);
  }, [user, fetchClubs]);

  // Keyboard: Escape to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Navigation helpers
  const canAdvance = () => {
    if (step === 0) return !!selectedClubId;
    if (step === 1) return leagueName.trim().length >= 2;
    return true;
  };

  const advance = () => {
    if (step === 1 && leagueName.trim().length < 2) {
      setNameError("League name must be at least 2 characters.");
      return;
    }
    setNameError("");
    if (step < TOTAL_STEPS - 1) setStep((s) => s + 1);
  };

  const back = () => {
    if (step > 0) setStep((s) => s - 1);
  };

  // Submit
  const handleCreate = async () => {
    if (!selectedClubId || !leagueName.trim()) return;
    setSubmitting(true);
    try {
      const res = await authFetch("/api/leagues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clubId: selectedClubId,
          name: leagueName.trim(),
          description: description.trim() || undefined,
          maxPlayers,
          formatType,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(body?.error ?? "Failed to create league");
        return;
      }
      const data = await res.json();
      toast.success("League created! You can now invite players.");
      onClose?.();
      navigate(`/leagues/${data.leagueId}`);
    } catch {
      toast.error("Network error — please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Step panels ─────────────────────────────────────────────────────────────

  const renderStep = () => {
    switch (step) {
      // ── Step 0: Club Selection ────────────────────────────────────────────
      case 0:
        return (
          <div className="space-y-4">
            <div>
              <h2
                className="text-2xl font-bold text-white mb-1"
                style={{ fontFamily: "'Clash Display', sans-serif" }}
              >
                Which club is this league for?
              </h2>
              <p className="text-white/50 text-sm">
                You can create a league for any club where you are an owner, admin, or director.
              </p>
            </div>

            {clubsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-white/40" />
              </div>
            ) : clubs.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-8 text-center">
                <Building2 className="w-10 h-10 text-white/20 mx-auto mb-3" />
                <p className="text-white/60 font-medium mb-1">No eligible clubs found</p>
                <p className="text-white/35 text-sm mb-4">
                  You need to be an owner, admin, or director of a club to create a league.
                </p>
                <a
                  href="/clubs"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-[oklch(0.65_0.14_145)] hover:underline"
                >
                  Create or join a club
                  <ArrowRight className="w-3.5 h-3.5" />
                </a>
              </div>
            ) : (
              <div className="space-y-2">
                {clubs.map((club) => (
                  <button
                    key={club.id}
                    onClick={() => setSelectedClubId(club.id)}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all duration-150 text-left ${
                      selectedClubId === club.id
                        ? "border-[oklch(0.65_0.14_145)] bg-[oklch(0.65_0.14_145)]/10"
                        : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/20"
                    }`}
                  >
                    {/* Club avatar / initial */}
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-sm font-bold text-white"
                      style={{
                        background: club.accentColor ?? "oklch(0.35 0.10 145)",
                      }}
                    >
                      {club.avatarUrl ? (
                        <img
                          src={club.avatarUrl}
                          alt={club.name}
                          className="w-full h-full object-cover rounded-lg"
                        />
                      ) : (
                        club.name.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold truncate">{club.name}</p>
                      {club.memberCount !== undefined && (
                        <p className="text-white/40 text-xs mt-0.5">
                          {club.memberCount} member{club.memberCount !== 1 ? "s" : ""}
                        </p>
                      )}
                    </div>
                    {selectedClubId === club.id && (
                      <CheckCircle2 className="w-5 h-5 text-[oklch(0.65_0.14_145)] flex-shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        );

      // ── Step 1: League Details ────────────────────────────────────────────
      case 1:
        return (
          <div className="space-y-5">
            <div>
              <h2
                className="text-2xl font-bold text-white mb-1"
                style={{ fontFamily: "'Clash Display', sans-serif" }}
              >
                Name your league
              </h2>
              <p className="text-white/50 text-sm">
                Give your league a memorable name. Players will see this on the standings page.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-white/50 uppercase tracking-widest mb-2">
                League Name *
              </label>
              <input
                autoFocus
                type="text"
                value={leagueName}
                onChange={(e) => {
                  setLeagueName(e.target.value);
                  if (e.target.value.trim().length >= 2) setNameError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") advance();
                }}
                placeholder="e.g. Spring 2025 Club League"
                maxLength={100}
                className={`w-full bg-white/[0.06] border rounded-xl px-4 py-3 text-white placeholder-white/25 text-base focus:outline-none focus:ring-2 transition-all ${
                  nameError
                    ? "border-red-500/60 focus:ring-red-500/30"
                    : "border-white/15 focus:ring-[oklch(0.65_0.14_145)]/40 focus:border-[oklch(0.65_0.14_145)]/50"
                }`}
              />
              {nameError && (
                <p className="text-red-400 text-xs mt-1.5">{nameError}</p>
              )}
              <p className="text-white/25 text-xs mt-1.5 text-right">
                {leagueName.length}/100
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-white/50 uppercase tracking-widest mb-2">
                Description <span className="normal-case font-normal">(optional)</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description — rules, schedule, prizes…"
                maxLength={500}
                rows={3}
                className="w-full bg-white/[0.06] border border-white/15 rounded-xl px-4 py-3 text-white placeholder-white/25 text-sm focus:outline-none focus:ring-2 focus:ring-[oklch(0.65_0.14_145)]/40 focus:border-[oklch(0.65_0.14_145)]/50 transition-all resize-none"
              />
              <p className="text-white/25 text-xs mt-1 text-right">
                {description.length}/500
              </p>
            </div>
          </div>
        );

      // ── Step 2: Format & Size ─────────────────────────────────────────────
      case 2:
        return (
          <div className="space-y-6">
            <div>
              <h2
                className="text-2xl font-bold text-white mb-1"
                style={{ fontFamily: "'Clash Display', sans-serif" }}
              >
                Format & size
              </h2>
              <p className="text-white/50 text-sm">
                Choose how matches are scheduled and how many players compete.
              </p>
            </div>

            {/* Format */}
            <div>
              <label className="block text-xs font-semibold text-white/50 uppercase tracking-widest mb-3">
                Format
              </label>
              <div className="space-y-2">
                {FORMAT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setFormatType(opt.value)}
                    className={`w-full flex items-start gap-4 p-4 rounded-xl border transition-all duration-150 text-left ${
                      formatType === opt.value
                        ? "border-[oklch(0.65_0.14_145)] bg-[oklch(0.65_0.14_145)]/10"
                        : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/20"
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        formatType === opt.value
                          ? "bg-[oklch(0.65_0.14_145)]/20 text-[oklch(0.75_0.18_145)]"
                          : "bg-white/[0.06] text-white/40"
                      }`}
                    >
                      {opt.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-white font-semibold text-sm">{opt.label}</span>
                        <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-[oklch(0.65_0.14_145)]/15 text-[oklch(0.65_0.14_145)]">
                          {opt.tag}
                        </span>
                      </div>
                      <p className="text-white/45 text-xs leading-relaxed">{opt.description}</p>
                    </div>
                    {formatType === opt.value && (
                      <CheckCircle2 className="w-4.5 h-4.5 text-[oklch(0.65_0.14_145)] flex-shrink-0 mt-1" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Size */}
            <div>
              <label className="block text-xs font-semibold text-white/50 uppercase tracking-widest mb-3">
                League Size
              </label>
              <div className="grid grid-cols-4 gap-2">
                {SIZE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setMaxPlayers(opt.value)}
                    className={`flex flex-col items-center gap-1 py-3 px-2 rounded-xl border transition-all duration-150 ${
                      maxPlayers === opt.value
                        ? "border-[oklch(0.65_0.14_145)] bg-[oklch(0.65_0.14_145)]/10"
                        : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/20"
                    }`}
                  >
                    <Users
                      className={`w-4 h-4 ${
                        maxPlayers === opt.value ? "text-[oklch(0.65_0.14_145)]" : "text-white/40"
                      }`}
                    />
                    <span
                      className={`text-sm font-bold ${
                        maxPlayers === opt.value ? "text-white" : "text-white/60"
                      }`}
                    >
                      {opt.value}
                    </span>
                    <span className="text-[10px] text-white/30 leading-tight text-center">
                      {opt.weeks} weeks
                    </span>
                  </button>
                ))}
              </div>
              <p className="text-white/30 text-xs mt-2">
                Round Robin: {selectedSize.weeks} weeks ({maxPlayers} players × {selectedSize.weeks} rounds)
              </p>
            </div>
          </div>
        );

      // ── Step 3: Review & Create ───────────────────────────────────────────
      case 3:
        return (
          <div className="space-y-5">
            <div>
              <h2
                className="text-2xl font-bold text-white mb-1"
                style={{ fontFamily: "'Clash Display', sans-serif" }}
              >
                Review & create
              </h2>
              <p className="text-white/50 text-sm">
                Your league will be created in <strong className="text-white/70">Draft mode</strong> — you can invite players before starting the season.
              </p>
            </div>

            {/* Summary card */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] divide-y divide-white/[0.07] overflow-hidden">
              <ReviewRow label="Club" value={selectedClub?.name ?? "—"} />
              <ReviewRow label="League Name" value={leagueName} />
              {description && (
                <ReviewRow label="Description" value={description} multiline />
              )}
              <ReviewRow label="Format" value={selectedFormat.label} />
              <ReviewRow
                label="Size"
                value={`${maxPlayers} players · ${selectedSize.weeks} weeks`}
              />
            </div>

            {/* What happens next */}
            <div className="rounded-xl border border-[oklch(0.65_0.14_145)]/20 bg-[oklch(0.65_0.14_145)]/[0.06] p-4">
              <p className="text-xs font-semibold text-[oklch(0.65_0.14_145)] uppercase tracking-widest mb-2">
                What happens next
              </p>
              <ul className="space-y-1.5 text-sm text-white/55">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[oklch(0.65_0.14_145)] flex-shrink-0 mt-0.5" />
                  League is created in Draft mode
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[oklch(0.65_0.14_145)] flex-shrink-0 mt-0.5" />
                  Invite players from your club roster
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[oklch(0.65_0.14_145)] flex-shrink-0 mt-0.5" />
                  Start the season when you're ready — schedule generates automatically
                </li>
              </ul>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  const stepLabels = ["Select Club", "League Details", "Format & Size", "Review"];

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="relative w-full max-w-lg mx-4 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{
          background: isDark
            ? "oklch(0.14 0.05 145)"
            : "oklch(0.16 0.05 145)",
          border: "1px solid oklch(0.65 0.14 145 / 0.18)",
          maxHeight: "90vh",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[oklch(0.65_0.14_145)]/20 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-[oklch(0.75_0.18_145)]" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[oklch(0.65_0.14_145)]">
                {stepLabels[step]}
              </p>
              <p className="text-xs text-white/35">Step {step + 1} of {TOTAL_STEPS}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <StepIndicator current={step} total={TOTAL_STEPS} />
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-white/[0.07] flex-shrink-0" />

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {renderStep()}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-6 py-4 border-t border-white/[0.07] flex items-center justify-between gap-3">
          <button
            onClick={step === 0 ? onClose : back}
            className="flex items-center gap-1.5 text-sm font-medium text-white/50 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            {step === 0 ? "Cancel" : "Back"}
          </button>

          {step < TOTAL_STEPS - 1 ? (
            <button
              onClick={advance}
              disabled={!canAdvance()}
              className="flex items-center gap-2 bg-[oklch(0.65_0.14_145)] hover:bg-[oklch(0.70_0.16_145)] disabled:opacity-40 disabled:cursor-not-allowed text-[oklch(0.12_0.04_145)] font-semibold text-sm px-6 py-2.5 rounded-lg transition-all duration-150 hover:-translate-y-0.5"
            >
              Continue
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleCreate}
              disabled={submitting}
              className="flex items-center gap-2 bg-[oklch(0.65_0.14_145)] hover:bg-[oklch(0.70_0.16_145)] disabled:opacity-60 disabled:cursor-not-allowed text-[oklch(0.12_0.04_145)] font-semibold text-sm px-6 py-2.5 rounded-lg transition-all duration-150 hover:-translate-y-0.5"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating…
                </>
              ) : (
                <>
                  <Trophy className="w-4 h-4" />
                  Create League
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Review row helper ─────────────────────────────────────────────────────────
function ReviewRow({
  label,
  value,
  multiline,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <div className="flex items-start gap-4 px-4 py-3">
      <span className="text-xs font-semibold text-white/35 uppercase tracking-widest w-28 flex-shrink-0 pt-0.5">
        {label}
      </span>
      <span
        className={`text-sm text-white/80 flex-1 ${multiline ? "whitespace-pre-wrap" : "truncate"}`}
      >
        {value}
      </span>
    </div>
  );
}
