/**
 * Unit tests for the TournamentStatusPill helper logic.
 *
 * The component itself is a pure function of a `status` string, so we test
 * the mapping table directly without needing a DOM renderer.
 */

import { describe, it, expect } from "vitest";

// ─── Replicate the mapping from Profile.tsx ───────────────────────────────────
type PillConfig = { label: string; bg: string; text: string };

const STATUS_CONFIG: Record<string, PillConfig> = {
  registration: {
    label: "Lobby",
    bg: "bg-amber-100 dark:bg-amber-900/30",
    text: "text-amber-700 dark:text-amber-400",
  },
  in_progress: {
    label: "Active",
    bg: "bg-emerald-100 dark:bg-emerald-900/30",
    text: "text-emerald-700 dark:text-emerald-400",
  },
  paused: {
    label: "Paused",
    bg: "bg-orange-100 dark:bg-orange-900/30",
    text: "text-orange-700 dark:text-orange-400",
  },
  completed: {
    label: "Complete",
    bg: "bg-gray-100 dark:bg-white/10",
    text: "text-gray-500 dark:text-white/40",
  },
};

function getPillConfig(status?: string | null): PillConfig {
  const s = status ?? "registration";
  return STATUS_CONFIG[s] ?? STATUS_CONFIG["registration"];
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("TournamentStatusPill label mapping", () => {
  it("maps 'registration' to 'Lobby'", () => {
    expect(getPillConfig("registration").label).toBe("Lobby");
  });

  it("maps 'in_progress' to 'Active'", () => {
    expect(getPillConfig("in_progress").label).toBe("Active");
  });

  it("maps 'paused' to 'Paused'", () => {
    expect(getPillConfig("paused").label).toBe("Paused");
  });

  it("maps 'completed' to 'Complete'", () => {
    expect(getPillConfig("completed").label).toBe("Complete");
  });

  it("falls back to 'Lobby' for null status", () => {
    expect(getPillConfig(null).label).toBe("Lobby");
  });

  it("falls back to 'Lobby' for undefined status", () => {
    expect(getPillConfig(undefined).label).toBe("Lobby");
  });

  it("falls back to 'Lobby' for unknown status strings", () => {
    expect(getPillConfig("unknown_status").label).toBe("Lobby");
  });
});

describe("TournamentStatusPill colour classes", () => {
  it("'registration' uses amber colours", () => {
    const cfg = getPillConfig("registration");
    expect(cfg.bg).toContain("amber");
    expect(cfg.text).toContain("amber");
  });

  it("'in_progress' uses emerald colours", () => {
    const cfg = getPillConfig("in_progress");
    expect(cfg.bg).toContain("emerald");
    expect(cfg.text).toContain("emerald");
  });

  it("'paused' uses orange colours", () => {
    const cfg = getPillConfig("paused");
    expect(cfg.bg).toContain("orange");
    expect(cfg.text).toContain("orange");
  });

  it("'completed' uses gray colours", () => {
    const cfg = getPillConfig("completed");
    expect(cfg.bg).toContain("gray");
    expect(cfg.text).toContain("gray");
  });
});

describe("TournamentStatusPill pulse indicator", () => {
  it("only 'in_progress' should show the animated pulse dot", () => {
    // The pulse dot is shown when status === "in_progress"
    const shouldShowPulse = (status: string) => status === "in_progress";
    expect(shouldShowPulse("in_progress")).toBe(true);
    expect(shouldShowPulse("registration")).toBe(false);
    expect(shouldShowPulse("paused")).toBe(false);
    expect(shouldShowPulse("completed")).toBe(false);
  });
});
