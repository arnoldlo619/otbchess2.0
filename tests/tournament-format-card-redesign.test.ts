import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const wizard = readFileSync(resolve(process.cwd(), "client/src/components/TournamentWizard.tsx"), "utf8");
const formatSelection = wizard.slice(
  wizard.indexOf("interface TournamentFormatCardProps"),
  wizard.indexOf("// ─── Quickstart Form") !== -1 ? wizard.indexOf("// ─── Quickstart Form") : wizard.indexOf("function ModeSelect"),
);

describe("tournament format card editorial illustration redesign", () => {
  it("uses the four AI-generated editorial illustration assets", () => {
    expect(wizard).toContain('/manus-storage/quickstart_fabb5e03.png');
    expect(wizard).toContain('/manus-storage/quads_e9f0eb03.png');
    expect(wizard).toContain('/manus-storage/large-event_3f6a565e.png');
    expect(wizard).toContain('/manus-storage/schedule_485beed2.png');
  });

  it("keeps the four format choices reachable through explicit selection modes", () => {
    expect(wizard).toContain('mode="quickstart"');
    expect(wizard).toContain('mode="schedule"');
    expect(wizard).toContain('mode="large_event"');
    expect(wizard).toContain('mode="quads"');
  });

  it("uses a warm paper background instead of dark green cards", () => {
    expect(formatSelection).toContain('#f5f0e6');
    expect(formatSelection).not.toContain('background: "#12311d"');
  });

  it("renders illustrations with object-contain to preserve full artwork", () => {
    expect(formatSelection).toContain('object-contain');
    expect(formatSelection).toContain('aspectRatio: "3 / 2"');
  });

  it("uses dark forest-green text on warm paper for readability", () => {
    expect(formatSelection).toContain('text-[#1a3a22]');
    expect(formatSelection).toContain('text-[#2a5535]');
  });

  it("provides keyboard-visible focus ring and accessible labels", () => {
    expect(formatSelection).toContain('focus-visible:ring-2');
    expect(formatSelection).toContain('aria-label=');
  });

  it("respects reduced-motion preferences on hover scale", () => {
    expect(formatSelection).toContain('motion-reduce:');
  });

  it("preserves the existing Clash Display font for card titles", () => {
    expect(formatSelection).toContain("Clash Display");
  });

  it("stacks cleanly on small screens with responsive grid", () => {
    expect(wizard).toContain('grid-cols-1 gap-3 sm:grid-cols-2');
    expect(wizard).toContain('pb-[calc(2rem+env(safe-area-inset-bottom))]');
    expect(wizard).toContain('text-[22px]');
  });

  it("shows a short, motion-safe green border glow after format selection", () => {
    expect(formatSelection).toContain('aria-pressed={isSelected}');
    expect(formatSelection).toContain('formatSelectionGlow');
    expect(formatSelection).toContain('border-[#5cd57a]/80');
    expect(formatSelection).toContain('motion-reduce:animate-none');
    expect(formatSelection).toContain('window.setTimeout(() => onSelect(mode), 220)');
  });

  it("maps the correct order: Quickstart 01, Quads 02, Large Event 03, Schedule 04", () => {
    const quickstartIdx = wizard.indexOf('number="01"');
    const quadsIdx = wizard.indexOf('number="02"');
    const largeIdx = wizard.indexOf('number="03"');
    const scheduleIdx = wizard.indexOf('number="04"');
    expect(quickstartIdx).toBeLessThan(quadsIdx);
    expect(quadsIdx).toBeLessThan(largeIdx);
    expect(largeIdx).toBeLessThan(scheduleIdx);
  });
});
