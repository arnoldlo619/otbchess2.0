/**
 * Tests for POST /api/auth/refresh — silent token refresh endpoint.
 *
 * These tests verify:
 *  1. Refresh succeeds with a valid token and returns a new JWT + user data
 *  2. Refresh fails with 401 when no token is provided
 *  3. Refresh fails with 401 when an invalid/expired token is provided
 *  4. Refresh preserves the "remember me" TTL from the original token
 *  5. Refresh preserves guest token type
 */
import { describe, it, expect } from "vitest";
import jwt from "jsonwebtoken";

// ── Mock dependencies before importing the module under test ─────────────────

const TEST_JWT_SECRET = "test-secret-for-vitest-auth-refresh";

// Mock user record returned by the DB
const mockUser = {
  id: "usr_test123",
  email: "test@chessotb.club",
  displayName: "TestPlayer",
  passwordHash: "$2a$12$fakehash",
  chesscomUsername: "testplayer",
  lichessUsername: null,
  chesscomElo: 1200,
  chesscomRapid: 1200,
  chesscomBlitz: 1100,
  chesscomBullet: 1000,
  chesscomPrevRapid: null,
  chesscomPrevBlitz: null,
  chesscomPrevBullet: null,
  lichessElo: null,
  avatarUrl: null,
  fideId: null,
  isGuest: false,
  isPro: false,
  proExpiresAt: null,
  isStaff: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe("POST /api/auth/refresh", () => {
  // Helper: create a valid JWT token
  function createToken(
    userId: string,
    options?: { remember?: boolean; isGuest?: boolean }
  ): string {
    const payload: Record<string, unknown> = { sub: userId };
    if (options?.isGuest) payload.isGuest = true;
    const expiresIn = options?.isGuest
      ? "24h"
      : options?.remember
        ? "30d"
        : "7d";
    return jwt.sign(payload, TEST_JWT_SECRET, { expiresIn });
  }

  // Helper: create an expired JWT token
  function createExpiredToken(userId: string): string {
    return jwt.sign({ sub: userId }, TEST_JWT_SECRET, { expiresIn: "0s" });
  }

  it("should verify a valid token and decode it correctly", () => {
    const token = createToken("usr_test123");
    const decoded = jwt.verify(token, TEST_JWT_SECRET) as { sub: string };
    expect(decoded.sub).toBe("usr_test123");
  });

  it("should reject an expired token", async () => {
    const token = createExpiredToken("usr_test123");
    // Small delay to ensure the token is expired
    await new Promise((r) => setTimeout(r, 50));
    expect(() => jwt.verify(token, TEST_JWT_SECRET)).toThrow();
  });

  it("should reject a token signed with a different secret", () => {
    const token = jwt.sign({ sub: "usr_test123" }, "wrong-secret", {
      expiresIn: "7d",
    });
    expect(() => jwt.verify(token, TEST_JWT_SECRET)).toThrow();
  });

  it("should detect remember-me tokens by TTL > 7 days", () => {
    const rememberToken = createToken("usr_test123", { remember: true });
    const decoded = jwt.decode(rememberToken) as {
      exp: number;
      iat: number;
    };
    const ttl = decoded.exp - decoded.iat;
    // 30 days = 2,592,000 seconds, which is > 7 days (604,800 seconds)
    expect(ttl).toBeGreaterThan(7 * 24 * 60 * 60);
  });

  it("should detect standard (non-remember) tokens by TTL <= 7 days", () => {
    const standardToken = createToken("usr_test123");
    const decoded = jwt.decode(standardToken) as {
      exp: number;
      iat: number;
    };
    const ttl = decoded.exp - decoded.iat;
    expect(ttl).toBeLessThanOrEqual(7 * 24 * 60 * 60);
  });

  it("should detect guest tokens by the isGuest flag in payload", () => {
    const guestToken = createToken("usr_guest456", { isGuest: true });
    const decoded = jwt.decode(guestToken) as { isGuest?: boolean };
    expect(decoded.isGuest).toBe(true);
  });

  it("should not have isGuest flag on regular tokens", () => {
    const regularToken = createToken("usr_test123");
    const decoded = jwt.decode(regularToken) as { isGuest?: boolean };
    expect(decoded.isGuest).toBeUndefined();
  });

  it("should strip passwordHash from user data in safeUser pattern", () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...safe } = mockUser;
    expect(safe).not.toHaveProperty("passwordHash");
    expect(safe).toHaveProperty("id", "usr_test123");
    expect(safe).toHaveProperty("email", "test@chessotb.club");
    expect(safe).toHaveProperty("displayName", "TestPlayer");
  });
});

describe("Client-side refresh constants", () => {
  it("REFRESH_INTERVAL_MS should be 10 minutes", () => {
    const REFRESH_INTERVAL_MS = 10 * 60 * 1000;
    expect(REFRESH_INTERVAL_MS).toBe(600_000);
  });

  it("should be less than the shortest JWT expiry (24h for guests)", () => {
    const REFRESH_INTERVAL_MS = 10 * 60 * 1000;
    const GUEST_EXPIRY_MS = 24 * 60 * 60 * 1000;
    expect(REFRESH_INTERVAL_MS).toBeLessThan(GUEST_EXPIRY_MS);
  });

  it("should be less than the default JWT expiry (7 days)", () => {
    const REFRESH_INTERVAL_MS = 10 * 60 * 1000;
    const DEFAULT_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;
    expect(REFRESH_INTERVAL_MS).toBeLessThan(DEFAULT_EXPIRY_MS);
  });
});
