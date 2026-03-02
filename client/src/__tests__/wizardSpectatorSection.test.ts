/**
 * Unit tests for the SpectatorShareSection URL construction logic
 * embedded in the TournamentWizard Step 4 (Share) screen.
 *
 * The spectator URL is constructed as:
 *   {window.location.origin}/tournament/{makeSlug(data.name, data.date)}
 *
 * These tests verify the URL shape, distinctness from the join URL,
 * and edge cases for various tournament name/date combinations.
 */

import { describe, it, expect } from "vitest";
import { makeSlug } from "@/lib/tournamentRegistry";

// ─── Helper mirrors SpectatorShareSection logic ───────────────────────────────
function buildWizardSpectatorUrl(
  origin: string,
  name: string,
  date: string
): string {
  const tournamentId = makeSlug(name, date);
  return `${origin}/tournament/${tournamentId}`;
}

function buildWizardJoinUrl(origin: string, inviteCode: string): string {
  return `${origin}/join/${inviteCode}`;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("buildWizardSpectatorUrl", () => {
  const origin = "https://chessotb.club";

  it("constructs a URL with /tournament/ path segment", () => {
    const url = buildWizardSpectatorUrl(origin, "Club Championship", "2026-03-01");
    expect(url).toContain("/tournament/");
  });

  it("starts with the origin", () => {
    const url = buildWizardSpectatorUrl(origin, "Club Championship", "2026-03-01");
    expect(url.startsWith(origin)).toBe(true);
  });

  it("does not contain /join/", () => {
    const url = buildWizardSpectatorUrl(origin, "Club Championship", "2026-03-01");
    expect(url).not.toContain("/join/");
  });

  it("contains a slug derived from the tournament name", () => {
    const url = buildWizardSpectatorUrl(origin, "Spring Open", "2026-03-01");
    expect(url.toLowerCase()).toContain("spring");
  });

  it("works with a single-word tournament name", () => {
    const url = buildWizardSpectatorUrl(origin, "Blitz", "2026-03-01");
    expect(url).toContain("/tournament/");
    expect(url.startsWith(origin)).toBe(true);
  });

  it("works with a tournament name containing special characters", () => {
    const url = buildWizardSpectatorUrl(origin, "Grand Prix #1", "2026-03-01");
    expect(url).toContain("/tournament/");
    // URL should not contain raw # character (slug should sanitize it)
    expect(url).not.toContain("#");
  });

  it("produces different URLs for different tournament names on the same date", () => {
    const url1 = buildWizardSpectatorUrl(origin, "Morning Blitz", "2026-03-01");
    const url2 = buildWizardSpectatorUrl(origin, "Evening Rapid", "2026-03-01");
    expect(url1).not.toBe(url2);
  });

  it("produces different URLs for the same name in different years", () => {
    // makeSlug appends the year — same name in different years gives different slugs
    const url1 = buildWizardSpectatorUrl(origin, "Club Championship", "2025-03-01");
    const url2 = buildWizardSpectatorUrl(origin, "Club Championship", "2026-03-01");
    expect(url1).not.toBe(url2);
  });

  it("works with localhost origin", () => {
    const url = buildWizardSpectatorUrl("http://localhost:3000", "Test Tournament", "2026-03-01");
    expect(url.startsWith("http://localhost:3000")).toBe(true);
    expect(url).toContain("/tournament/");
  });
});

describe("spectator URL vs join URL are distinct in wizard context", () => {
  const origin = "https://chessotb.club";

  it("spectator URL uses /tournament/ while join URL uses /join/", () => {
    const spectator = buildWizardSpectatorUrl(origin, "Club Championship", "2026-03-01");
    const join = buildWizardJoinUrl(origin, "CHESS42");
    expect(spectator).toContain("/tournament/");
    expect(join).toContain("/join/");
    expect(spectator).not.toBe(join);
  });

  it("spectator URL does not contain the invite code", () => {
    const inviteCode = "CHESS42";
    const spectator = buildWizardSpectatorUrl(origin, "Club Championship", "2026-03-01");
    expect(spectator).not.toContain(inviteCode);
  });

  it("join URL does not contain /tournament/", () => {
    const join = buildWizardJoinUrl(origin, "CHESS42");
    expect(join).not.toContain("/tournament/");
  });
});

describe("makeSlug integration for spectator URL", () => {
  it("slug is non-empty for a valid name and date", () => {
    const slug = makeSlug("Club Championship", "2026-03-01");
    expect(slug.length).toBeGreaterThan(0);
  });

  it("slug is URL-safe (no spaces)", () => {
    const slug = makeSlug("Club Championship 2026", "2026-03-01");
    expect(slug).not.toContain(" ");
  });

  it("slug is lowercase", () => {
    const slug = makeSlug("GRAND PRIX", "2026-03-01");
    expect(slug).toBe(slug.toLowerCase());
  });
});
