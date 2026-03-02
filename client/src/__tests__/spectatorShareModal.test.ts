/**
 * Unit tests for the SpectatorShareModal URL construction logic.
 *
 * Tests cover:
 *  - Correct spectator URL format: {origin}/tournament/{id}
 *  - Distinct from the join URL: {origin}/join/{code}
 *  - Edge cases: numeric IDs, UUIDs, demo IDs
 */

import { describe, it, expect } from "vitest";

// ─── Helper: mirrors the spectatorUrl construction in Director.tsx ────────────
function buildSpectatorUrl(origin: string, tournamentId: string): string {
  return `${origin}/tournament/${tournamentId}`;
}

// ─── Helper: mirrors the joinUrl construction in Director.tsx ─────────────────
function buildJoinUrl(origin: string, inviteCode: string): string {
  return `${origin}/join/${inviteCode}`;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("buildSpectatorUrl", () => {
  it("constructs the correct spectator URL from origin and tournamentId", () => {
    expect(buildSpectatorUrl("https://chessotb.club", "abc123")).toBe(
      "https://chessotb.club/tournament/abc123"
    );
  });

  it("works with a UUID-style tournament ID", () => {
    const id = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
    expect(buildSpectatorUrl("https://chessotb.club", id)).toBe(
      `https://chessotb.club/tournament/${id}`
    );
  });

  it("works with a numeric tournament ID", () => {
    expect(buildSpectatorUrl("https://chessotb.club", "42")).toBe(
      "https://chessotb.club/tournament/42"
    );
  });

  it("works with a demo tournament ID", () => {
    expect(buildSpectatorUrl("https://chessotb.club", "demo")).toBe(
      "https://chessotb.club/tournament/demo"
    );
  });

  it("works with localhost origin", () => {
    expect(buildSpectatorUrl("http://localhost:3000", "abc123")).toBe(
      "http://localhost:3000/tournament/abc123"
    );
  });

  it("does not contain /join/ in the spectator URL", () => {
    const url = buildSpectatorUrl("https://chessotb.club", "abc123");
    expect(url).not.toContain("/join/");
  });
});

describe("spectator URL vs join URL are distinct", () => {
  const origin = "https://chessotb.club";
  const tournamentId = "abc123";
  const inviteCode = "CHESS42";

  it("spectator URL uses /tournament/ path", () => {
    const url = buildSpectatorUrl(origin, tournamentId);
    expect(url).toContain("/tournament/");
  });

  it("join URL uses /join/ path", () => {
    const url = buildJoinUrl(origin, inviteCode);
    expect(url).toContain("/join/");
  });

  it("spectator URL and join URL are different strings", () => {
    const spectator = buildSpectatorUrl(origin, tournamentId);
    const join = buildJoinUrl(origin, inviteCode);
    expect(spectator).not.toBe(join);
  });

  it("spectator URL does not contain the invite code", () => {
    const spectator = buildSpectatorUrl(origin, tournamentId);
    expect(spectator).not.toContain(inviteCode);
  });

  it("join URL does not contain the tournament ID", () => {
    const join = buildJoinUrl(origin, inviteCode);
    expect(join).not.toContain(tournamentId);
  });
});

describe("spectatorUrl format validation", () => {
  it("always starts with the origin", () => {
    const origin = "https://chessotb.club";
    const url = buildSpectatorUrl(origin, "test123");
    expect(url.startsWith(origin)).toBe(true);
  });

  it("ends with the tournament ID", () => {
    const id = "my-tournament-id";
    const url = buildSpectatorUrl("https://chessotb.club", id);
    expect(url.endsWith(id)).toBe(true);
  });

  it("contains exactly one /tournament/ segment", () => {
    const url = buildSpectatorUrl("https://chessotb.club", "abc123");
    const matches = url.match(/\/tournament\//g);
    expect(matches).toHaveLength(1);
  });
});
