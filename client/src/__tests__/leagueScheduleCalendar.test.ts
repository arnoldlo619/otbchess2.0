import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LeagueMonthCalendar } from "@/components/league/LeagueMonthCalendar";

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

  it("treats a draft League with no generated weeks as a valid pre-season schedule", () => {
    expect(calendarSource).toContain("function dateForWeek(week: LeagueMonthCalendarWeek | undefined");
    expect(calendarSource).toContain("if (!week) return null;");
    expect(calendarSource).toContain("const hasScheduledWeeks = weeks.length > 0;");
    expect(calendarSource).toContain("Schedule opens when the season begins");
    expect(dashboardSource).toContain("{weeks.length > 0 && (() => {");
  });

  it("renders the pre-season schedule without a League week record", () => {
    const markup = renderToStaticMarkup(createElement(LeagueMonthCalendar, {
      leagueName: "Draft League",
      seasonStartAt: "2026-10-08T00:00:00.000Z",
      totalWeeks: 5,
      currentWeek: 0,
      leagueStatus: "draft",
      weeks: [],
      selectedWeekNumber: 1,
      onSelectWeek: () => undefined,
      isDark: true,
      accent: "#4CAF50",
      textMain: "#ffffff",
      textMuted: "#a3b5a8",
      cardBorder: "#23412c",
    }));

    expect(markup).toContain("Schedule opens when the season begins");
    expect(markup).toContain("Draft");
    expect(markup).toContain("Not generated");
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
