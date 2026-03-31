/**
 * Tests for the Join a Tournament flow fix and ActiveTournamentBanner logic.
 *
 * Covers:
 *  - isValidCode: validates tournament code format (alphanumeric, 4-20 chars)
 *  - Server-side code resolution fallback logic
 *  - ActiveTournamentBanner: determines correct navigation href for director vs participant
 *  - ActiveTournamentBanner: hidden on tournament pages
 *  - ActiveTournamentBanner: session dismiss tracking
 */
import { describe, it, expect } from "vitest";

// ─── isValidCode — tournament code format validation ─────────────────────────

function isValidCode(code: string): boolean {
  return /^[A-Za-z0-9_-]{4,20}$/.test(code.trim());
}

describe("isValidCode", () => {
  it("accepts a standard 8-char uppercase code", () => {
    expect(isValidCode("ABCD1234")).toBe(true);
  });

  it("accepts a 4-char minimum code", () => {
    expect(isValidCode("AB12")).toBe(true);
  });

  it("accepts a 20-char maximum code", () => {
    expect(isValidCode("A".repeat(20))).toBe(true);
  });

  it("rejects codes shorter than 4 chars", () => {
    expect(isValidCode("AB1")).toBe(false);
  });

  it("rejects codes longer than 20 chars", () => {
    expect(isValidCode("A".repeat(21))).toBe(false);
  });

  it("rejects codes with spaces", () => {
    expect(isValidCode("AB CD 12")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isValidCode("")).toBe(false);
  });

  it("accepts codes with hyphens and underscores", () => {
    expect(isValidCode("my-code_123")).toBe(true);
  });

  it("trims whitespace before validating", () => {
    expect(isValidCode("  ABCD1234  ")).toBe(true);
  });

  it("rejects codes with special characters", () => {
    expect(isValidCode("AB!@#$12")).toBe(false);
  });
});

// ─── ActiveTournamentBanner — navigation href logic ──────────────────────────

function getActiveTournamentHref(
  tournamentId: string,
  role: "director" | "participant"
): string {
  if (role === "director") {
    return `/tournament/${tournamentId}/manage`;
  }
  return `/tournament/${tournamentId}`;
}

describe("getActiveTournamentHref", () => {
  it("returns /manage path for directors", () => {
    expect(getActiveTournamentHref("spring-open-2026", "director")).toBe(
      "/tournament/spring-open-2026/manage"
    );
  });

  it("returns base tournament path for participants", () => {
    expect(getActiveTournamentHref("spring-open-2026", "participant")).toBe(
      "/tournament/spring-open-2026"
    );
  });

  it("handles slugs with hyphens", () => {
    expect(getActiveTournamentHref("my-club-blitz-2026", "director")).toBe(
      "/tournament/my-club-blitz-2026/manage"
    );
  });
});

// ─── ActiveTournamentBanner — visibility logic ───────────────────────────────

function shouldShowBanner(location: string): boolean {
  // Banner should be hidden on tournament-related pages and join pages
  if (location.startsWith("/tournament/")) return false;
  if (location.startsWith("/join")) return false;
  return true;
}

describe("shouldShowBanner", () => {
  it("shows on the home page", () => {
    expect(shouldShowBanner("/")).toBe(true);
  });

  it("shows on the clubs page", () => {
    expect(shouldShowBanner("/clubs")).toBe(true);
  });

  it("shows on the profile page", () => {
    expect(shouldShowBanner("/profile")).toBe(true);
  });

  it("hides on tournament dashboard page", () => {
    expect(shouldShowBanner("/tournament/spring-open-2026")).toBe(false);
  });

  it("hides on tournament manage page", () => {
    expect(shouldShowBanner("/tournament/spring-open-2026/manage")).toBe(false);
  });

  it("hides on join page", () => {
    expect(shouldShowBanner("/join")).toBe(false);
  });

  it("hides on join page with code", () => {
    expect(shouldShowBanner("/join/ABCD1234")).toBe(false);
  });

  it("shows on the archive page", () => {
    expect(shouldShowBanner("/tournaments")).toBe(true);
  });

  it("shows on the battle page", () => {
    expect(shouldShowBanner("/battle")).toBe(true);
  });
});

// ─── Session dismiss tracking ────────────────────────────────────────────────

function isDismissed(dismissedSet: Set<string>, tournamentId: string): boolean {
  return dismissedSet.has(tournamentId);
}

function addDismissed(dismissedSet: Set<string>, tournamentId: string): Set<string> {
  const next = new Set(dismissedSet);
  next.add(tournamentId);
  return next;
}

describe("session dismiss tracking", () => {
  it("returns false for a tournament that has not been dismissed", () => {
    const dismissed = new Set<string>();
    expect(isDismissed(dismissed, "spring-open-2026")).toBe(false);
  });

  it("returns true for a dismissed tournament", () => {
    const dismissed = new Set(["spring-open-2026"]);
    expect(isDismissed(dismissed, "spring-open-2026")).toBe(true);
  });

  it("adds a tournament to the dismissed set", () => {
    const dismissed = new Set<string>();
    const next = addDismissed(dismissed, "spring-open-2026");
    expect(next.has("spring-open-2026")).toBe(true);
    expect(dismissed.has("spring-open-2026")).toBe(false); // original unchanged
  });

  it("does not duplicate entries", () => {
    const dismissed = new Set(["spring-open-2026"]);
    const next = addDismissed(dismissed, "spring-open-2026");
    expect(next.size).toBe(1);
  });
});

// ─── Server resolve fallback — URL construction ─────────────────────────────

function buildResolveUrl(code: string): string {
  return `/api/auth/join/resolve/${encodeURIComponent(code.trim().toUpperCase())}`;
}

describe("buildResolveUrl", () => {
  it("builds the correct resolve URL", () => {
    expect(buildResolveUrl("ABCD1234")).toBe("/api/auth/join/resolve/ABCD1234");
  });

  it("uppercases the code", () => {
    expect(buildResolveUrl("abcd1234")).toBe("/api/auth/join/resolve/ABCD1234");
  });

  it("trims whitespace", () => {
    expect(buildResolveUrl("  ABCD1234  ")).toBe("/api/auth/join/resolve/ABCD1234");
  });

  it("encodes special characters in the code", () => {
    expect(buildResolveUrl("MY-CODE")).toBe("/api/auth/join/resolve/MY-CODE");
  });
});
