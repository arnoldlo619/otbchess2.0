import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const clientRoot = resolve(import.meta.dirname, "..");
const dashboardSource = readFileSync(resolve(clientRoot, "pages/LeagueDashboard.tsx"), "utf8");
const demoSource = readFileSync(resolve(clientRoot, "pages/LeagueDemo.tsx"), "utf8");
const modalSource = readFileSync(resolve(clientRoot, "components/league/LeaguePlayerProfileModal.tsx"), "utf8");
const modalStyles = readFileSync(resolve(clientRoot, "styles/leaguePlayerProfile.css"), "utf8");

describe("League player profile modal", () => {
  it("uses one shared modal for standard and demo League dashboards", () => {
    expect(dashboardSource).toContain('from "@/components/league/LeaguePlayerProfileModal"');
    expect(demoSource).toContain('from "@/components/league/LeaguePlayerProfileModal"');
    expect(dashboardSource).toContain("<LeaguePlayerProfileModal");
    expect(demoSource).toContain("<LeaguePlayerProfileModal");
  });

  it("keeps the avatar in a dedicated identity row instead of overlapping the header", () => {
    expect(modalSource).toContain('className="max-h-[calc(100dvh-7rem)] overflow-y-auto px-5 pb-5 pt-4"');
    expect(modalSource).not.toContain('marginTop: "-2.5rem"');
    expect(modalSource).toContain('className="h-[76px] w-[76px] shrink-0 overflow-hidden rounded-2xl"');
  });

  it("shows every Chess.com rating category with rolling number motion", () => {
    expect(modalSource).toContain('{ key: "rapid", label: "Rapid" }');
    expect(modalSource).toContain('{ key: "blitz", label: "Blitz" }');
    expect(modalSource).toContain('{ key: "bullet", label: "Bullet" }');
    expect(modalSource).toContain('{ key: "daily", label: "Daily" }');
    expect(modalSource).toContain("function useRollingRating");
    expect(modalSource).toContain("requestAnimationFrame(tick)");
    expect(modalStyles).toContain(".league-rating-ticker");
  });

  it("retains accessible, reduced-motion-safe profile behavior", () => {
    expect(modalSource).toContain("useAccessibleOverlay({");
    expect(modalSource).toContain('role="dialog"');
    expect(modalSource).toContain('aria-label={`${player.displayName} League profile`}');
    expect(modalStyles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(modalStyles).toContain("animation: none !important");
  });

  it("makes demo standings rows open the same player profile surface", () => {
    expect(demoSource).toContain("const [selectedPlayer, setSelectedPlayer] = useState<DemoPlayer | null>(null)");
    expect(demoSource).toContain("onClick={() => setSelectedPlayer(p)}");
    expect(demoSource).toContain("function getDemoRecentMatches(player: DemoPlayer)");
  });
});
