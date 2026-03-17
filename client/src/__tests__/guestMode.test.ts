/**
 * guestMode.test.ts
 *
 * Unit tests for the guest mode feature:
 *  - validateGuestName: input validation for guest display name
 *  - Guest access scoping: isGuest flag logic
 *  - AuthModal validator helpers (re-exported from AuthModal)
 */

import { describe, it, expect } from "vitest";
import { validateGuestName, validateEmail, validatePassword, validateDisplayName } from "../components/AuthModal";

// ─── validateGuestName ────────────────────────────────────────────────────────

describe("validateGuestName", () => {
  it("returns an error when the name is empty", () => {
    expect(validateGuestName("")).toBeTruthy();
  });

  it("returns an error when the name is a single character", () => {
    expect(validateGuestName("A")).toBeTruthy();
  });

  it("accepts a two-character name", () => {
    expect(validateGuestName("Jo")).toBeUndefined();
  });

  it("accepts a normal name", () => {
    expect(validateGuestName("Magnus")).toBeUndefined();
  });

  it("returns an error when the name exceeds 30 characters", () => {
    expect(validateGuestName("A".repeat(31))).toBeTruthy();
  });

  it("accepts a name that is exactly 30 characters", () => {
    expect(validateGuestName("A".repeat(30))).toBeUndefined();
  });

  it("returns an error for a whitespace-only name", () => {
    expect(validateGuestName("  ")).toBeTruthy();
  });
});

// ─── validateEmail ────────────────────────────────────────────────────────────

describe("validateEmail", () => {
  it("returns an error for an empty string", () => {
    expect(validateEmail("")).toBeTruthy();
  });

  it("returns an error for a string without @", () => {
    expect(validateEmail("notanemail")).toBeTruthy();
  });

  it("accepts a valid email", () => {
    expect(validateEmail("user@example.com")).toBeUndefined();
  });
});

// ─── validatePassword ─────────────────────────────────────────────────────────

describe("validatePassword", () => {
  it("returns an error for an empty password", () => {
    expect(validatePassword("")).toBeTruthy();
  });

  it("returns an error for a short password on sign-up", () => {
    expect(validatePassword("short", true)).toBeTruthy();
  });

  it("accepts a password of exactly 8 characters on sign-up", () => {
    expect(validatePassword("12345678", true)).toBeUndefined();
  });

  it("does not enforce length on sign-in (isSignUp = false)", () => {
    expect(validatePassword("short", false)).toBeUndefined();
  });
});

// ─── validateDisplayName ─────────────────────────────────────────────────────

describe("validateDisplayName", () => {
  it("returns an error for an empty name", () => {
    expect(validateDisplayName("")).toBeTruthy();
  });

  it("returns an error for a single-character name", () => {
    expect(validateDisplayName("A")).toBeTruthy();
  });

  it("accepts a two-character name", () => {
    expect(validateDisplayName("Jo")).toBeUndefined();
  });
});

// ─── Guest access scoping ─────────────────────────────────────────────────────

describe("Guest access scoping logic", () => {
  /**
   * These tests exercise the pure boolean logic that determines whether a
   * guest user is allowed to perform a given action.  They mirror the checks
   * in Battle.tsx (handleHost) and server/auth.ts (requireFullAuth).
   */

  function canHost(user: { isGuest: boolean } | null): boolean {
    if (!user) return false;
    if (user.isGuest) return false;
    return true;
  }

  function canJoin(user: { isGuest: boolean } | null): boolean {
    return user !== null; // guests and full users can join
  }

  it("unauthenticated users cannot host", () => {
    expect(canHost(null)).toBe(false);
  });

  it("guest users cannot host", () => {
    expect(canHost({ isGuest: true })).toBe(false);
  });

  it("full account users can host", () => {
    expect(canHost({ isGuest: false })).toBe(true);
  });

  it("unauthenticated users cannot join", () => {
    expect(canJoin(null)).toBe(false);
  });

  it("guest users can join", () => {
    expect(canJoin({ isGuest: true })).toBe(true);
  });

  it("full account users can join", () => {
    expect(canJoin({ isGuest: false })).toBe(true);
  });
});
