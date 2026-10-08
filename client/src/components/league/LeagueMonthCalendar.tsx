import { CalendarDays, CheckCircle2, Clock3, Sparkles } from "lucide-react";

export interface LeagueMonthCalendarWeek {
  id: number | string;
  weekNumber: number;
  isComplete: boolean | number;
  deadline?: string | null;
  publishedAt?: string | null;
  state?: "generated" | "published" | "in_progress" | "finalized" | string | null;
  matchCount?: number;
  completedMatchCount?: number;
}

interface LeagueMonthCalendarProps {
  leagueName: string;
  seasonStartAt?: string | null;
  totalWeeks: number;
  currentWeek: number;
  leagueStatus: "draft" | "active" | "completed";
  weeks: LeagueMonthCalendarWeek[];
  selectedWeekNumber: number;
  onSelectWeek: (weekNumber: number) => void;
  isDark: boolean;
  accent: string;
  textMain: string;
  textMuted: string;
  cardBorder: string;
  className?: string;
}

const dayFormat = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
const monthFormat = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" });

function toValidDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateForWeek(week: LeagueMonthCalendarWeek, seasonStartAt?: string | null) {
  const explicitDate = toValidDate(week.deadline) ?? toValidDate(week.publishedAt);
  if (explicitDate) return explicitDate;

  const seasonStart = toValidDate(seasonStartAt);
  if (!seasonStart) return null;

  const derived = new Date(seasonStart);
  derived.setDate(derived.getDate() + (Math.max(week.weekNumber, 1) - 1) * 7);
  return derived;
}

function getWeekStatus(week: LeagueMonthCalendarWeek, currentWeek: number, leagueStatus: LeagueMonthCalendarProps["leagueStatus"]) {
  const complete = Boolean(week.isComplete) || leagueStatus === "completed";
  if (complete) return { label: "Complete", tone: "complete" as const };
  if (leagueStatus === "active" && week.weekNumber === currentWeek) return { label: "Current", tone: "current" as const };
  if (leagueStatus === "active" && week.weekNumber < currentWeek) return { label: "Needs result", tone: "attention" as const };
  return { label: "Upcoming", tone: "upcoming" as const };
}

/**
 * A month-view treatment for a League season. The 4-column grid keeps up to
 * sixteen scheduled weeks scannable at once while each cell remains a real,
 * keyboard-accessible route to that week's details.
 */
export function LeagueMonthCalendar({
  leagueName,
  seasonStartAt,
  totalWeeks,
  currentWeek,
  leagueStatus,
  weeks,
  selectedWeekNumber,
  onSelectWeek,
  isDark,
  accent,
  textMain,
  textMuted,
  cardBorder,
  className,
}: LeagueMonthCalendarProps) {
  const completedWeeks = weeks.filter((week) => Boolean(week.isComplete) || leagueStatus === "completed").length;
  const currentScheduleDate = dateForWeek(weeks.find((week) => week.weekNumber === selectedWeekNumber) ?? weeks[0], seasonStartAt)
    ?? toValidDate(seasonStartAt)
    ?? new Date();
  const progress = Math.round((completedWeeks / Math.max(totalWeeks, 1)) * 100);

  return (
    <section
      aria-labelledby="league-month-calendar-title"
      data-testid="league-month-calendar"
      className={`relative isolate overflow-hidden rounded-[24px] border p-4 sm:p-5 lg:p-6 ${className ?? ""}`}
      style={{
        borderColor: isDark ? "rgba(255,255,255,0.15)" : cardBorder,
        background: isDark
          ? "linear-gradient(135deg, rgba(7, 27, 15, 0.91), rgba(8, 45, 23, 0.82))"
          : "linear-gradient(135deg, rgba(250,255,251,0.93), rgba(231,246,235,0.87))",
        boxShadow: isDark ? "0 20px 54px rgba(0, 12, 5, 0.24), inset 0 1px 0 rgba(255,255,255,0.08)" : "0 18px 42px rgba(21, 62, 37, 0.10), inset 0 1px 0 rgba(255,255,255,0.86)",
        backdropFilter: "blur(20px)",
      }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-20 bg-cover bg-center"
        style={{
          opacity: isDark ? 0.23 : 0.13,
          backgroundImage: "url('/images/league-schedule-chess-lawn.jpg')",
          backgroundPosition: "center 42%",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background: isDark
            ? "linear-gradient(112deg, rgba(3, 18, 8, 0.94) 0%, rgba(6, 37, 18, 0.77) 58%, rgba(8, 28, 13, 0.88) 100%)"
            : "linear-gradient(112deg, rgba(249,255,250,0.95) 0%, rgba(241,251,244,0.83) 58%, rgba(247,253,248,0.92) 100%)",
        }}
      />

      <header className="relative z-10 flex flex-col gap-4 border-b pb-4 sm:flex-row sm:items-end sm:justify-between" style={{ borderColor: isDark ? "rgba(255,255,255,0.12)" : cardBorder }}>
        <div className="min-w-0">
          <div className="flex items-center gap-2" style={{ color: accent }}>
            <CalendarDays size={16} aria-hidden="true" />
            <span className="text-[11px] font-bold uppercase tracking-[0.16em]">Monthly schedule</span>
          </div>
          <h2 id="league-month-calendar-title" className="mt-2 font-display text-[clamp(1.7rem,3vw,2.6rem)] font-bold tracking-[-0.045em]" style={{ color: textMain }}>
            {monthFormat.format(currentScheduleDate)}
          </h2>
          <p className="mt-1 text-sm" style={{ color: textMuted }}>
            {leagueName} · {totalWeeks} scheduled weeks
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          <span
            className="inline-flex min-h-9 items-center rounded-full border px-3 text-xs font-semibold"
            style={{ borderColor: `${accent}55`, background: `${accent}16`, color: accent }}
          >
            Month view
          </span>
          <div className="text-right">
            <div className="text-lg font-bold tabular-nums leading-none" style={{ color: textMain }}>{progress}%</div>
            <div className="mt-1 text-[11px] font-medium" style={{ color: textMuted }}>{completedWeeks} complete</div>
          </div>
        </div>
      </header>

      <div className="relative z-10 mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" role="list" aria-label="League schedule by week">
        {weeks.map((week) => {
          const isSelected = week.weekNumber === selectedWeekNumber;
          const status = getWeekStatus(week, currentWeek, leagueStatus);
          const scheduledDate = dateForWeek(week, seasonStartAt);
          const hasMatchProgress = typeof week.matchCount === "number" && week.matchCount > 0;
          const matchProgress = hasMatchProgress ? Math.round(((week.completedMatchCount ?? 0) / week.matchCount!) * 100) : 0;
          const statusColor = status.tone === "complete" ? accent : status.tone === "current" ? accent : status.tone === "attention" ? "#d97706" : textMuted;

          return (
            <button
              key={week.id}
              type="button"
              role="listitem"
              onClick={() => onSelectWeek(week.weekNumber)}
              aria-pressed={isSelected}
              aria-label={`Select Week ${week.weekNumber}, ${status.label}`}
              className="group relative min-h-[144px] overflow-hidden rounded-2xl border p-4 text-left transition-[transform,background-color,border-color,box-shadow] duration-200 ease-out hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 active:translate-y-0"
              style={{
                borderColor: isSelected ? `${accent}b3` : isDark ? "rgba(255,255,255,0.12)" : "rgba(21,62,37,0.14)",
                background: isSelected
                  ? isDark ? `${accent}24` : `${accent}14`
                  : isDark ? "rgba(3, 19, 9, 0.53)" : "rgba(255,255,255,0.62)",
                boxShadow: isSelected
                  ? `0 12px 28px ${accent}24, inset 0 1px 0 rgba(255,255,255,0.10)`
                  : "inset 0 1px 0 rgba(255,255,255,0.08)",
                color: textMain,
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: statusColor }}>Week {week.weekNumber}</div>
                  <div className="mt-1 text-sm font-semibold" style={{ color: textMain }}>
                    {scheduledDate ? dayFormat.format(scheduledDate) : "Schedule pending"}
                  </div>
                </div>
                <span
                  className="inline-flex min-h-6 items-center rounded-full px-2 text-[10px] font-bold uppercase tracking-[0.11em]"
                  style={{ background: `${statusColor}18`, color: statusColor }}
                >
                  {status.tone === "complete" && <CheckCircle2 className="mr-1" size={11} aria-hidden="true" />}
                  {status.tone === "current" && <Sparkles className="mr-1" size={11} aria-hidden="true" />}
                  {status.tone === "upcoming" && <Clock3 className="mr-1" size={11} aria-hidden="true" />}
                  {status.label}
                </span>
              </div>

              <div className="mt-6 flex items-end justify-between gap-3">
                <div>
                  <div className="text-2xl font-bold tracking-[-0.04em] tabular-nums" style={{ color: textMain }}>{week.matchCount ?? 0}</div>
                  <div className="mt-0.5 text-xs" style={{ color: textMuted }}>matchups</div>
                </div>
                {hasMatchProgress && (
                  <div className="min-w-[74px]">
                    <div className="mb-1.5 flex justify-between text-[10px] font-semibold tabular-nums" style={{ color: textMuted }}>
                      <span>Progress</span><span>{matchProgress}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full" style={{ background: isDark ? "rgba(255,255,255,0.12)" : "rgba(21,62,37,0.12)" }}>
                      <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${matchProgress}%`, background: accent }} />
                    </div>
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
