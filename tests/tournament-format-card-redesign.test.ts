import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const wizard = readFileSync(resolve(process.cwd(), "client/src/components/TournamentWizard.tsx"), "utf8");
const formatSelection = wizard.slice(
  wizard.indexOf("interface TournamentFormatCardProps"),
  wizard.indexOf("// ─── Quickstart Form"),
);

describe("tournament format card redesign", () => {
  it("uses authentic managed ChessOTB workflow captures for all four selection cards", () => {
    expect(wizard).toContain('/manus-storage/quickstart-setup_ad291b38.webp');
    expect(wizard).toContain('/manus-storage/schedule-live-dashboard_d998f071.webp');
    expect(wizard).toContain('/manus-storage/large-event-bracket_da3b67b9.webp');
    expect(wizard).toContain('/manus-storage/quads-pairings_356cb6c0.webp');
  });

  it("keeps the four format choices reachable through explicit selection modes", () => {
    expect(wizard).toContain('mode="quickstart"');
    expect(wizard).toContain('mode="schedule"');
    expect(wizard).toContain('mode="large_event"');
    expect(wizard).toContain('mode="quads"');
  });

  it("provides motion-safe, keyboard-visible image treatment without a new animation dependency", () => {
    expect(wizard).toContain('opacity-80');
    expect(wizard).toContain('saturate-[0.46]');
    expect(wizard).toContain('group-hover:saturate-100');
    expect(wizard).toContain('focus-visible:ring-2');
    expect(wizard).not.toContain('framer-motion');
  });

  it("keeps screenshots visible while protecting copy with a localized lower scrim", () => {
    expect(formatSelection).toContain('group-hover:opacity-95');
    expect(formatSelection).toContain('rgba(4,25,13,0.42)');
    expect(formatSelection).toContain('h-[66%] bg-gradient-to-t from-[#031109]/95');
  });

  it("brightens the screenshot directly on hover, focus, and touch without an accent glow layer", () => {
    expect(formatSelection).toContain('group-hover:brightness-110');
    expect(formatSelection).toContain('group-focus-visible:brightness-110');
    expect(formatSelection).toContain('group-active:brightness-110');
    expect(formatSelection).toContain('group-hover:opacity-75');
    expect(formatSelection).not.toContain('rgba(29, 163, 74, 0.33)');
    expect(formatSelection).not.toContain('hover:shadow-[0_24px_64px_rgba(0,0,0,0.34)]');
  });

  it("stacks cleanly on small screens with large tap targets and touch-visible image feedback", () => {
    expect(wizard).toContain('grid-cols-1 gap-3 sm:grid-cols-2');
    expect(wizard).toContain('min-h-[244px]');
    expect(wizard).toContain('group-active:saturate-100');
    expect(wizard).toContain('pb-[calc(2rem+env(safe-area-inset-bottom))]');
    expect(wizard).toContain('text-[22px]');
  });

  it("uses the Quickstart green treatment consistently without icon tiles", () => {
    expect(formatSelection).toContain('background: "#1DA34A"');
    expect(formatSelection).toContain('borderColor: "rgba(65, 211, 111, 0.58)"');
    expect(formatSelection).not.toContain("accent: string;");
    expect(formatSelection).not.toContain("icon: typeof Bolt;");
    expect(formatSelection).not.toContain("icon={Bolt}");
    expect(formatSelection).not.toContain("icon={Calendar}");
    expect(formatSelection).not.toContain("icon={Trophy}");
    expect(formatSelection).not.toContain("icon={Users2}");
  });
});
