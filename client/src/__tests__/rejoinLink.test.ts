/**
 * Tests for the Rejoin Deep Link feature
 *
 * Covers:
 *  - rejoinUrl construction from tournament inviteCode + username
 *  - ?u= param parsing from the join URL search string
 *  - auto-rejoin navigation guard (urlCode + urlUsername present)
 */
import { describe, it, expect } from "vitest";

// ─── rejoinUrl construction ───────────────────────────────────────────────────

function buildRejoinUrl(
  origin: string,
  inviteCode: string,
  username: string
): string {
  if (!username || !inviteCode) return "";
  const base = `${origin}/join/${encodeURIComponent(inviteCode)}`;
  const params = new URLSearchParams({ u: username });
  return `${base}?${params.toString()}`;
}

describe("buildRejoinUrl", () => {
  it("builds a valid rejoin URL with username param", () => {
    const url = buildRejoinUrl("https://chessotb.club", "ABCD1234", "magnus");
    expect(url).toBe("https://chessotb.club/join/ABCD1234?u=magnus");
  });

  it("URL-encodes usernames with special characters", () => {
    const url = buildRejoinUrl("https://chessotb.club", "ABCD1234", "user name+1");
    expect(url).toContain("u=user+name%2B1");
  });

  it("returns empty string when username is empty", () => {
    expect(buildRejoinUrl("https://chessotb.club", "ABCD1234", "")).toBe("");
  });

  it("returns empty string when inviteCode is empty", () => {
    expect(buildRejoinUrl("https://chessotb.club", "", "magnus")).toBe("");
  });

  it("preserves the invite code exactly as given", () => {
    const url = buildRejoinUrl("https://chessotb.club", "XYZ-789", "hikaru");
    expect(url).toContain("/join/XYZ-789");
  });
});

// ─── ?u= param parsing ────────────────────────────────────────────────────────

function parseUrlUsername(search: string): string {
  try {
    return new URLSearchParams(search).get("u") ?? "";
  } catch {
    return "";
  }
}

describe("parseUrlUsername", () => {
  it("extracts the u param from a search string", () => {
    expect(parseUrlUsername("?u=magnus")).toBe("magnus");
  });

  it("returns empty string when u param is absent", () => {
    expect(parseUrlUsername("?t=abc123")).toBe("");
  });

  it("returns empty string for empty search string", () => {
    expect(parseUrlUsername("")).toBe("");
  });

  it("handles multiple params correctly", () => {
    expect(parseUrlUsername("?t=abc&u=hikaru&foo=bar")).toBe("hikaru");
  });

  it("decodes URL-encoded usernames", () => {
    expect(parseUrlUsername("?u=user+name%2B1")).toBe("user name+1");
  });
});

// ─── auto-rejoin guard ────────────────────────────────────────────────────────

function shouldAutoRejoin(urlCode: string, urlUsername: string): boolean {
  return Boolean(urlCode && urlUsername);
}

describe("shouldAutoRejoin", () => {
  it("returns true when both urlCode and urlUsername are present", () => {
    expect(shouldAutoRejoin("ABCD1234", "magnus")).toBe(true);
  });

  it("returns false when urlCode is missing", () => {
    expect(shouldAutoRejoin("", "magnus")).toBe(false);
  });

  it("returns false when urlUsername is missing", () => {
    expect(shouldAutoRejoin("ABCD1234", "")).toBe(false);
  });

  it("returns false when both are missing", () => {
    expect(shouldAutoRejoin("", "")).toBe(false);
  });
});

// ─── round-trip: build → parse ────────────────────────────────────────────────

describe("rejoin URL round-trip", () => {
  it("parses back the username from a built rejoin URL", () => {
    const url = buildRejoinUrl("https://chessotb.club", "ABCD1234", "magnus");
    const parsed = new URL(url);
    const username = parseUrlUsername(parsed.search);
    expect(username).toBe("magnus");
  });

  it("parses back a username with special characters", () => {
    const url = buildRejoinUrl("https://chessotb.club", "ABCD1234", "user name+1");
    const parsed = new URL(url);
    const username = parseUrlUsername(parsed.search);
    expect(username).toBe("user name+1");
  });
});
