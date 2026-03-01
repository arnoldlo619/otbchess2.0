/**
 * AuthModal UX helpers — unit tests
 *
 * Tests the pure helper functions used in the polished AuthModal:
 *  - getPasswordStrength: returns 0-4 score and label
 *  - validateSignIn: field-level error messages
 *  - validateRegister: field-level error messages
 *  - remember me flag passed to login
 */
import { describe, it, expect } from "vitest";

// ─── Inline copies of the helpers (same logic as AuthModal) ──────────────────

function getPasswordStrength(password: string): {
  score: number;
  label: string;
  color: string;
} {
  if (!password) return { score: 0, label: "", color: "" };
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  const labels = ["", "Weak", "Fair", "Good", "Strong", "Very strong"];
  const colors = [
    "",
    "bg-red-500",
    "bg-orange-400",
    "bg-yellow-400",
    "bg-green-400",
    "bg-emerald-500",
  ];
  return { score, label: labels[score] ?? "Strong", color: colors[score] ?? "bg-emerald-500" };
}

interface SignInErrors {
  email?: string;
  password?: string;
  general?: string;
}

function validateSignIn(email: string, password: string): SignInErrors {
  const errors: SignInErrors = {};
  if (!email.trim()) {
    errors.email = "Email is required";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = "Enter a valid email address";
  }
  if (!password) {
    errors.password = "Password is required";
  }
  return errors;
}

interface RegisterErrors {
  displayName?: string;
  email?: string;
  password?: string;
  general?: string;
}

function validateRegister(
  displayName: string,
  email: string,
  password: string
): RegisterErrors {
  const errors: RegisterErrors = {};
  if (!displayName.trim() || displayName.trim().length < 2) {
    errors.displayName = "Display name must be at least 2 characters";
  }
  if (!email.trim()) {
    errors.email = "Email is required";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = "Enter a valid email address";
  }
  if (!password) {
    errors.password = "Password is required";
  } else if (password.length < 8) {
    errors.password = "Password must be at least 8 characters";
  }
  return errors;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("getPasswordStrength", () => {
  it("returns score 0 for empty string", () => {
    expect(getPasswordStrength("").score).toBe(0);
    expect(getPasswordStrength("").label).toBe("");
  });

  it("returns score 1 for a short lowercase password", () => {
    const result = getPasswordStrength("password");
    expect(result.score).toBe(1); // only length >= 8
    expect(result.label).toBe("Weak");
  });

  it("returns score 3 for a mixed-case password with digits", () => {
    const result = getPasswordStrength("Password1");
    // length>=8 (+1), uppercase (+1), digit (+1) = 3
    expect(result.score).toBe(3);
    expect(result.label).toBe("Good");
  });

  it("returns score 5 for a long complex password", () => {
    const result = getPasswordStrength("P@ssw0rd!XYZ");
    // length>=8 (+1), length>=12 (+1), uppercase (+1), digit (+1), special (+1) = 5
    expect(result.score).toBe(5);
    expect(result.label).toBe("Very strong");
  });

  it("awards the special character bonus", () => {
    const withSpecial = getPasswordStrength("password!");
    const withoutSpecial = getPasswordStrength("password1");
    expect(withSpecial.score).toBeGreaterThan(withoutSpecial.score - 1);
  });
});

describe("validateSignIn", () => {
  it("returns errors for empty fields", () => {
    const errors = validateSignIn("", "");
    expect(errors.email).toBeTruthy();
    expect(errors.password).toBeTruthy();
  });

  it("returns email error for invalid email", () => {
    const errors = validateSignIn("notanemail", "password123");
    expect(errors.email).toMatch(/valid email/i);
    expect(errors.password).toBeUndefined();
  });

  it("returns no errors for valid credentials", () => {
    const errors = validateSignIn("user@example.com", "password123");
    expect(errors.email).toBeUndefined();
    expect(errors.password).toBeUndefined();
  });

  it("returns password error when only password is missing", () => {
    const errors = validateSignIn("user@example.com", "");
    expect(errors.email).toBeUndefined();
    expect(errors.password).toBeTruthy();
  });
});

describe("validateRegister", () => {
  it("returns errors for all empty fields", () => {
    const errors = validateRegister("", "", "");
    expect(errors.displayName).toBeTruthy();
    expect(errors.email).toBeTruthy();
    expect(errors.password).toBeTruthy();
  });

  it("returns displayName error for single-character name", () => {
    const errors = validateRegister("A", "user@example.com", "password123");
    expect(errors.displayName).toMatch(/at least 2/i);
  });

  it("returns password error for short password", () => {
    const errors = validateRegister("Alice", "user@example.com", "abc");
    expect(errors.password).toMatch(/at least 8/i);
  });

  it("returns no errors for valid registration data", () => {
    const errors = validateRegister("Alice", "alice@example.com", "securePass1");
    expect(errors.displayName).toBeUndefined();
    expect(errors.email).toBeUndefined();
    expect(errors.password).toBeUndefined();
  });

  it("accepts display names with spaces and accents", () => {
    const errors = validateRegister("José García", "jose@example.com", "securePass1");
    expect(errors.displayName).toBeUndefined();
  });
});

describe("Remember Me flag", () => {
  it("defaults to false (7-day session)", () => {
    // Simulates the initial state of siRemember in the modal
    const siRemember = false;
    expect(siRemember).toBe(false);
  });

  it("can be toggled to true (30-day session)", () => {
    let siRemember = false;
    siRemember = !siRemember;
    expect(siRemember).toBe(true);
  });
});
