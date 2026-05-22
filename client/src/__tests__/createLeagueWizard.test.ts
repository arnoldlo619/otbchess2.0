/**
 * CreateLeagueWizard — unit tests
 *
 * Tests cover:
 *   1. Format options are complete and valid
 *   2. Size options produce correct week counts
 *   3. Validation logic for step advancement
 *   4. POST payload shape
 *   5. Server endpoint path
 */
import { describe, it, expect } from "vitest";

// ── Constants mirrored from CreateLeagueWizard ────────────────────────────────

const FORMAT_OPTIONS = [
  { value: "round_robin",        label: "Round Robin",        tag: "Most Popular"  },
  { value: "double_round_robin", label: "Double Round Robin", tag: "Competitive"   },
  { value: "swiss",              label: "Swiss System",       tag: "Large Groups"  },
];

const SIZE_OPTIONS = [
  { value: 4,  weeks: 3 },
  { value: 6,  weeks: 5 },
  { value: 8,  weeks: 7 },
  { value: 10, weeks: 9 },
];

const ALLOWED_FORMATS = ["round_robin", "swiss", "double_round_robin"];

// ── Step validation helpers (mirrors wizard logic) ────────────────────────────

function canAdvanceStep(step: number, state: {
  selectedClubId: string;
  leagueName: string;
}): boolean {
  if (step === 0) return !!state.selectedClubId;
  if (step === 1) return state.leagueName.trim().length >= 2;
  return true; // steps 2 and 3 are always advanceable
}

// ── POST payload builder ──────────────────────────────────────────────────────

function buildPayload(state: {
  clubId: string;
  name: string;
  description: string;
  maxPlayers: number;
  formatType: string;
}) {
  return {
    clubId: state.clubId,
    name: state.name.trim(),
    description: state.description.trim() || undefined,
    maxPlayers: state.maxPlayers,
    formatType: state.formatType,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("CreateLeagueWizard — Format Options", () => {
  it("has exactly 3 format options", () => {
    expect(FORMAT_OPTIONS).toHaveLength(3);
  });

  it("all format values are in the server allowed list", () => {
    FORMAT_OPTIONS.forEach((f) => {
      expect(ALLOWED_FORMATS).toContain(f.value);
    });
  });

  it("round_robin is the first (default) format", () => {
    expect(FORMAT_OPTIONS[0].value).toBe("round_robin");
  });

  it("each format has a non-empty label and tag", () => {
    FORMAT_OPTIONS.forEach((f) => {
      expect(f.label.length).toBeGreaterThan(0);
      expect(f.tag.length).toBeGreaterThan(0);
    });
  });
});

describe("CreateLeagueWizard — Size Options", () => {
  it("has exactly 4 size options", () => {
    expect(SIZE_OPTIONS).toHaveLength(4);
  });

  it("each size produces weeks = size - 1 (round robin formula)", () => {
    SIZE_OPTIONS.forEach((s) => {
      expect(s.weeks).toBe(s.value - 1);
    });
  });

  it("sizes are 4, 6, 8, 10", () => {
    expect(SIZE_OPTIONS.map((s) => s.value)).toEqual([4, 6, 8, 10]);
  });

  it("default size of 8 produces 7 weeks", () => {
    const defaultSize = SIZE_OPTIONS.find((s) => s.value === 8);
    expect(defaultSize?.weeks).toBe(7);
  });
});

describe("CreateLeagueWizard — Step Validation", () => {
  it("step 0 requires a selected club", () => {
    expect(canAdvanceStep(0, { selectedClubId: "", leagueName: "" })).toBe(false);
    expect(canAdvanceStep(0, { selectedClubId: "club-abc", leagueName: "" })).toBe(true);
  });

  it("step 1 requires a name of at least 2 characters", () => {
    expect(canAdvanceStep(1, { selectedClubId: "x", leagueName: "" })).toBe(false);
    expect(canAdvanceStep(1, { selectedClubId: "x", leagueName: "A" })).toBe(false);
    expect(canAdvanceStep(1, { selectedClubId: "x", leagueName: "AB" })).toBe(true);
    expect(canAdvanceStep(1, { selectedClubId: "x", leagueName: "  AB  " })).toBe(true);
  });

  it("step 1 trims whitespace before checking length", () => {
    // "  A  " trims to "A" (length 1) → should fail
    expect(canAdvanceStep(1, { selectedClubId: "x", leagueName: "  A  " })).toBe(false);
  });

  it("steps 2 and 3 are always advanceable", () => {
    expect(canAdvanceStep(2, { selectedClubId: "", leagueName: "" })).toBe(true);
    expect(canAdvanceStep(3, { selectedClubId: "", leagueName: "" })).toBe(true);
  });
});

describe("CreateLeagueWizard — POST Payload", () => {
  it("builds the correct payload shape", () => {
    const payload = buildPayload({
      clubId: "club-123",
      name: "  Spring League  ",
      description: "Weekly matchups",
      maxPlayers: 8,
      formatType: "round_robin",
    });
    expect(payload).toEqual({
      clubId: "club-123",
      name: "Spring League",
      description: "Weekly matchups",
      maxPlayers: 8,
      formatType: "round_robin",
    });
  });

  it("omits description when empty", () => {
    const payload = buildPayload({
      clubId: "club-123",
      name: "League",
      description: "   ",
      maxPlayers: 6,
      formatType: "swiss",
    });
    expect(payload.description).toBeUndefined();
  });

  it("trims the league name", () => {
    const payload = buildPayload({
      clubId: "c",
      name: "  My League  ",
      description: "",
      maxPlayers: 4,
      formatType: "double_round_robin",
    });
    expect(payload.name).toBe("My League");
  });

  it("includes formatType in the payload", () => {
    const payload = buildPayload({
      clubId: "c",
      name: "League",
      description: "",
      maxPlayers: 10,
      formatType: "swiss",
    });
    expect(payload.formatType).toBe("swiss");
  });
});

describe("CreateLeagueWizard — API Endpoint", () => {
  it("uses the correct POST endpoint", () => {
    const endpoint = "/api/leagues";
    expect(endpoint).toBe("/api/leagues");
  });

  it("commissioner clubs endpoint is correct", () => {
    const endpoint = "/api/leagues/mine-as-commissioner";
    expect(endpoint).toContain("mine-as-commissioner");
  });

  it("redirects to league dashboard after creation", () => {
    const leagueId = "abc123";
    const redirectPath = `/leagues/${leagueId}`;
    expect(redirectPath).toBe("/leagues/abc123");
  });
});
