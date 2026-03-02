/**
 * Unit tests for the SpectatorQRScreen component helpers.
 *
 * The component is a full-screen projection overlay that:
 *  - Renders a large QR code encoding the spectator URL
 *  - Shows a truncated display URL (origin + pathname, no query params)
 *  - Closes on Escape key press
 *  - Prevents body scroll while open
 *
 * These tests verify the URL display helper and the spectator URL
 * construction logic used by the component.
 */

import { describe, it, expect } from "vitest";

// ─── Mirror the displayUrl helper from SpectatorQRScreen ─────────────────────
function buildDisplayUrl(spectatorUrl: string): string {
  try {
    const u = new URL(spectatorUrl);
    return u.origin + u.pathname;
  } catch {
    return spectatorUrl.split("?")[0];
  }
}

// ─── Mirror the spectatorUrl construction used in Director.tsx ───────────────
function buildSpectatorUrl(origin: string, tournamentId: string): string {
  return `${origin}/tournament/${tournamentId}`;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("buildDisplayUrl (SpectatorQRScreen URL display helper)", () => {
  it("strips query parameters from a URL with ?t= param", () => {
    const url = "https://chessotb.club/tournament/club-championship-2026?t=1234567890";
    expect(buildDisplayUrl(url)).toBe("https://chessotb.club/tournament/club-championship-2026");
  });

  it("returns origin + pathname for a clean URL", () => {
    const url = "https://chessotb.club/tournament/spring-open-2026";
    expect(buildDisplayUrl(url)).toBe("https://chessotb.club/tournament/spring-open-2026");
  });

  it("strips multiple query params", () => {
    const url = "https://chessotb.club/tournament/test-2026?a=1&b=2&c=3";
    expect(buildDisplayUrl(url)).toBe("https://chessotb.club/tournament/test-2026");
  });

  it("handles localhost URLs", () => {
    const url = "http://localhost:3000/tournament/local-test-2026";
    expect(buildDisplayUrl(url)).toBe("http://localhost:3000/tournament/local-test-2026");
  });

  it("falls back to split on ? for malformed URLs", () => {
    const url = "not-a-valid-url?foo=bar";
    expect(buildDisplayUrl(url)).toBe("not-a-valid-url");
  });

  it("returns the full URL if there are no query params and it is valid", () => {
    const url = "https://chessotb.club/tournament/grand-prix-2026";
    expect(buildDisplayUrl(url)).toBe(url);
  });
});

describe("buildSpectatorUrl (Director.tsx spectator URL construction)", () => {
  const origin = "https://chessotb.club";

  it("constructs a URL with /tournament/ path segment", () => {
    const url = buildSpectatorUrl(origin, "club-championship-2026");
    expect(url).toBe("https://chessotb.club/tournament/club-championship-2026");
  });

  it("does not contain /join/", () => {
    const url = buildSpectatorUrl(origin, "club-championship-2026");
    expect(url).not.toContain("/join/");
  });

  it("starts with the origin", () => {
    const url = buildSpectatorUrl(origin, "spring-open-2026");
    expect(url.startsWith(origin)).toBe(true);
  });

  it("works with localhost origin", () => {
    const url = buildSpectatorUrl("http://localhost:3000", "test-2026");
    expect(url).toBe("http://localhost:3000/tournament/test-2026");
  });

  it("produces different URLs for different tournament IDs", () => {
    const url1 = buildSpectatorUrl(origin, "morning-blitz-2026");
    const url2 = buildSpectatorUrl(origin, "evening-rapid-2026");
    expect(url1).not.toBe(url2);
  });
});

describe("SpectatorQRScreen display URL is distinct from join URL", () => {
  const origin = "https://chessotb.club";

  it("spectator URL uses /tournament/ while join URL uses /join/", () => {
    const spectator = buildSpectatorUrl(origin, "club-championship-2026");
    const join = `${origin}/join/CHESS42`;
    expect(spectator).toContain("/tournament/");
    expect(join).toContain("/join/");
    expect(spectator).not.toBe(join);
  });

  it("displayUrl for spectator does not contain /join/", () => {
    const spectator = buildSpectatorUrl(origin, "club-championship-2026");
    const display = buildDisplayUrl(spectator);
    expect(display).not.toContain("/join/");
  });

  it("displayUrl for spectator contains /tournament/", () => {
    const spectator = buildSpectatorUrl(origin, "club-championship-2026");
    const display = buildDisplayUrl(spectator);
    expect(display).toContain("/tournament/");
  });
});
