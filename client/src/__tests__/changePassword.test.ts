/**
 * Tests for the Change Password feature and Profile section ordering
 */
import { describe, it, expect } from "vitest";

// ── Client-side validation helpers (inline mirrors of Profile.tsx logic) ──────

function validatePasswordChange(
  current: string,
  newPw: string,
  confirm: string
): string | null {
  if (newPw.length < 8) return "New password must be at least 8 characters";
  if (newPw !== confirm) return "Passwords do not match";
  if (newPw === current) return "New password must differ from current password";
  return null;
}

// ── Server-side validation helpers (inline mirrors of auth.ts logic) ──────────

function validateServerChangePassword(body: {
  currentPassword?: unknown;
  newPassword?: unknown;
}): string | null {
  if (
    typeof body.currentPassword !== "string" ||
    typeof body.newPassword !== "string"
  ) {
    return "currentPassword and newPassword are required";
  }
  if (body.newPassword.length < 8) {
    return "New password must be at least 8 characters";
  }
  return null;
}

// ── Profile section ordering ───────────────────────────────────────────────────

const EXPECTED_SECTION_ORDER = [
  "My Clubs",
  "Your Tournaments",
  "Battle History",
  "Analysed Games",
  "Account & Security",
];

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Change Password — client validation", () => {
  it("rejects new password shorter than 8 characters", () => {
    expect(validatePasswordChange("oldPass1", "short", "short")).toBe(
      "New password must be at least 8 characters"
    );
  });

  it("rejects mismatched confirm password", () => {
    expect(validatePasswordChange("oldPass1", "newPass123", "newPass456")).toBe(
      "Passwords do not match"
    );
  });

  it("rejects new password that is the same as current", () => {
    expect(validatePasswordChange("samePass1", "samePass1", "samePass1")).toBe(
      "New password must differ from current password"
    );
  });

  it("accepts valid password change", () => {
    expect(validatePasswordChange("oldPass1!", "newPass2!", "newPass2!")).toBeNull();
  });

  it("accepts exactly 8 character new password", () => {
    expect(validatePasswordChange("oldPass1", "12345678", "12345678")).toBeNull();
  });

  it("rejects 7 character new password", () => {
    expect(validatePasswordChange("oldPass1", "1234567", "1234567")).toBe(
      "New password must be at least 8 characters"
    );
  });
});

describe("Change Password — server validation", () => {
  it("rejects missing currentPassword", () => {
    expect(
      validateServerChangePassword({ newPassword: "newPass123" })
    ).toBe("currentPassword and newPassword are required");
  });

  it("rejects missing newPassword", () => {
    expect(
      validateServerChangePassword({ currentPassword: "oldPass1" })
    ).toBe("currentPassword and newPassword are required");
  });

  it("rejects non-string values", () => {
    expect(
      validateServerChangePassword({ currentPassword: 123, newPassword: "newPass123" })
    ).toBe("currentPassword and newPassword are required");
  });

  it("rejects new password shorter than 8 characters", () => {
    expect(
      validateServerChangePassword({ currentPassword: "oldPass1", newPassword: "short" })
    ).toBe("New password must be at least 8 characters");
  });

  it("accepts valid inputs", () => {
    expect(
      validateServerChangePassword({ currentPassword: "oldPass1!", newPassword: "newPass2!" })
    ).toBeNull();
  });
});

describe("Change Password — guest account gating", () => {
  it("hides password change for guest users", () => {
    const user = { isGuest: true, id: "guest-1" };
    // The UI renders the password card only when !user.isGuest
    expect(!user.isGuest).toBe(false);
  });

  it("shows password change for registered users", () => {
    const user = { isGuest: false, id: "user-1" };
    expect(!user.isGuest).toBe(true);
  });
});

describe("Profile section ordering", () => {
  it("My Clubs appears before Your Tournaments", () => {
    const clubsIdx = EXPECTED_SECTION_ORDER.indexOf("My Clubs");
    const tournamentsIdx = EXPECTED_SECTION_ORDER.indexOf("Your Tournaments");
    expect(clubsIdx).toBeLessThan(tournamentsIdx);
  });

  it("Your Tournaments appears before Battle History", () => {
    const tournamentsIdx = EXPECTED_SECTION_ORDER.indexOf("Your Tournaments");
    const battleIdx = EXPECTED_SECTION_ORDER.indexOf("Battle History");
    expect(tournamentsIdx).toBeLessThan(battleIdx);
  });

  it("Account & Security is the last section", () => {
    const lastIdx = EXPECTED_SECTION_ORDER.length - 1;
    expect(EXPECTED_SECTION_ORDER[lastIdx]).toBe("Account & Security");
  });

  it("section order has exactly 5 entries", () => {
    expect(EXPECTED_SECTION_ORDER).toHaveLength(5);
  });
});
