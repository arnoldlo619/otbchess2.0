// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import PlayerStatsCard from "./PlayerStatsCard";
import { ThemeProvider } from "@/contexts/ThemeContext";
import type { PlayerPerformance } from "@/lib/performanceStats";

vi.stubGlobal("requestAnimationFrame", () => 1);
vi.stubGlobal("cancelAnimationFrame", () => undefined);

const performance = {
  player: {
    id: "player-1",
    name: "Avery Knight",
    username: "averyknight",
    elo: 1842,
    country: "US",
  },
  rank: 1,
  totalPlayers: 18,
  points: 5,
  wins: 5,
  draws: 0,
  losses: 0,
  performanceRating: 2112,
  ratingChange: 270,
  bestWin: null,
  biggestUpset: null,
  longestStreak: 5,
  whiteGames: 3,
  blackGames: 2,
  buchholz: 17.5,
  badge: "champion",
  badgeLabel: "Champion",
  roundHistory: [
    {
      roundNumber: 1,
      opponent: { id: "opponent-1", name: "Opponent One", elo: 1720 },
      color: "W",
      result: "win",
      gameResult: "1-0",
      pointsEarned: 1,
      runningScore: 1,
    },
    {
      roundNumber: 2,
      opponent: { id: "opponent-2", name: "Opponent Two", elo: 1780 },
      color: "B",
      result: "draw",
      gameResult: "½-½",
      pointsEarned: 0.5,
      runningScore: 1.5,
    },
    {
      roundNumber: 3,
      opponent: { id: "opponent-3", name: "Opponent Three", elo: 1810 },
      color: "W",
      result: "loss",
      gameResult: "0-1",
      pointsEarned: 0,
      runningScore: 1.5,
    },
  ],
} as unknown as PlayerPerformance;

const reportSource = readFileSync(resolve(process.cwd(), "client/src/pages/Report.tsx"), "utf8");

function renderCard(theme: "light" | "dark", forExport = false) {
  return render(
    <ThemeProvider defaultTheme={theme}>
      <PlayerStatsCard
        perf={performance}
        tournamentName="North Brooklyn Open"
        tournamentDate="2026-09-10"
        forExport={forExport}
        accentColor="#F59E0B"
      />
    </ThemeProvider>,
  );
}

afterEach(() => cleanup());

describe("PlayerStatsCard appearance modes", () => {
  it("renders a distinct premium light card with a light canvas token", () => {
    const { container } = renderCard("light");
    const card = container.querySelector<HTMLElement>("[data-stats-card]");

    expect(card?.getAttribute("data-card-theme")).toBe("light");
    expect(card?.style.background).toContain("rgb(250, 253, 248)");
    expect(card?.textContent).toContain("Recent Tournament Form");
    expect(card?.textContent).toContain("1W");
    expect(card?.textContent).toContain("1D");
    expect(card?.textContent).toContain("1L");
    expect(container.querySelector("[data-tournament-form]")).toBeTruthy();
  });

  it("retains the existing dark card canvas when dark appearance is selected", () => {
    const { container } = renderCard("dark");
    const card = container.querySelector<HTMLElement>("[data-stats-card]");

    expect(card?.getAttribute("data-card-theme")).toBe("dark");
    expect(card?.style.background).toContain("oklch");
  });

  it("keeps export cards at the fixed 4:5 presentation geometry in either appearance", () => {
    const { container } = renderCard("light", true);
    const card = container.querySelector<HTMLElement>("[data-stats-card]");

    expect(card?.getAttribute("data-card-theme")).toBe("light");
    expect(card?.style.width).toBe("1080px");
    expect(card?.style.height).toBe("1350px");
  });

  it("uses a light-surface action overlay instead of dark-only chrome in light appearance", () => {
    expect(reportSource).toContain('"bg-[#F8FCF5]/88 backdrop-blur-sm shadow-[inset_0_0_0_1px_rgba(18,55,42,0.08)]"');
    expect(reportSource).toContain('"bg-black/60"');
    expect(reportSource).toContain('isDark ? { background: accentColor + "22" } : undefined');
  });
});
