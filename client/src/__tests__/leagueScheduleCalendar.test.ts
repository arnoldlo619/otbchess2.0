import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const clientRoot = resolve(import.meta.dirname, "..");
const calendarSource = readFileSync(resolve(clientRoot, "components/league/LeagueMonthCalendar.tsx"), "utf8");
const dashboardSource = readFileSync(resolve(clientRoot, "pages/LeagueDashboard.tsx"), "utf8");
const demoSource = readFileSync(resolve(clientRoot, "pages/LeagueDemo.tsx"), "utf8");

describe("League Schedule monthly glass calendar", () => {
  it("uses one full-width, four-column monthly calendar instead of the compact weekly control", () => {
    expect(calendarSource).toContain('data-testid="league-month-calendar"');
    expect(calendarSource).toContain("xl:grid-cols-4");
    expect(calendarSource).toContain("Monthly schedule");
    expect(calendarSource).toContain("Month view");
    expect(calendarSource).not.toContain("Weekly");
  });

  it("keeps every scheduled week keyboard accessible and exposes selected state", () => {
    expect(calendarSource).toContain('role="list"');
    expect(calendarSource).toContain('role="listitem"');
    expect(calendarSource).toContain("aria-pressed={isSelected}");
    expect(calendarSource).toContain("onSelectWeek(week.weekNumber)");
  });

  it("uses the supplied chess lawn asset as a subdued calendar backdrop", () => {
    expect(calendarSource).toContain("/images/league-schedule-chess-lawn.jpg");
    expect(calendarSource).toContain("backgroundImage");
    expect(calendarSource).toContain("opacity: isDark ? 0.23 : 0.13");
    expect(calendarSource).toContain("backdropFilter: \"blur(20px)\"");
  });

  it("maps persisted League weeks to real matchup progress and preserves the selected detail route", () => {
    expect(dashboardSource).toContain('import { LeagueMonthCalendar } from "@/components/league/LeagueMonthCalendar"');
    expect(dashboardSource).toContain("matchCount: week.matches.length");
    expect(dashboardSource).toContain('completedMatchCount: week.matches.filter((match) => match.resultStatus === "completed").length');
    expect(dashboardSource).toContain("onSelectWeek={setSelectedWeek}");
    expect(dashboardSource).toContain("Open matchups");
  });

  it("uses the same interactive monthly calendar and detail surface in the demo League", () => {
    expect(demoSource).toContain('import { LeagueMonthCalendar } from "@/components/league/LeagueMonthCalendar"');
    expect(demoSource).toContain("const [selectedScheduleWeek, setSelectedScheduleWeek] = useState(14)");
    expect(demoSource).toContain("weeks={demoScheduleWeeks}");
    expect(demoSource).toContain("onSelectWeek={setSelectedScheduleWeek}");
    expect(demoSource).not.toContain("Math.random() * 5");
  });
});
