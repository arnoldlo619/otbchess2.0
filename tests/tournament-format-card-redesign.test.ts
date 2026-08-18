import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const wizard = readFileSync(resolve(process.cwd(), "client/src/components/TournamentWizard.tsx"), "utf8");

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
    expect(wizard).toContain('saturate-[0.35]');
    expect(wizard).toContain('group-hover:saturate-100');
    expect(wizard).toContain('focus-visible:ring-2');
    expect(wizard).not.toContain('framer-motion');
  });
});
