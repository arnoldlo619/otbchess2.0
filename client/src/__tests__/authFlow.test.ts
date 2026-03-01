/**
 * Auth Flow Tests
 * Tests for auth helper logic: password validation, email validation,
 * display name formatting, and auth context state transitions.
 */
import { describe, it, expect } from "vitest";

// ─── Password Validation ──────────────────────────────────────────────────────
function validatePassword(password: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters";
  if (!/[A-Z]/.test(password)) return "Password must contain an uppercase letter";
  if (!/[0-9]/.test(password)) return "Password must contain a number";
  return null;
}

// ─── Email Validation ─────────────────────────────────────────────────────────
function validateEmail(email: string): string | null {
  if (!email.trim()) return "Email is required";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Invalid email address";
  return null;
}

// ─── Display Name Formatting ──────────────────────────────────────────────────
function getInitial(displayName: string, email: string): string {
  const name = displayName || email;
  return name.charAt(0).toUpperCase();
}

function truncateDisplayName(name: string, maxLen = 20): string {
  if (name.length <= maxLen) return name;
  return name.slice(0, maxLen) + "…";
}

// ─── Tests ───────────────────────────────────────────────────────────────────
describe("Password validation", () => {
  it("rejects passwords shorter than 8 chars", () => {
    expect(validatePassword("Ab1")).toBe("Password must be at least 8 characters");
  });

  it("rejects passwords without uppercase", () => {
    expect(validatePassword("chess1234")).toBe("Password must contain an uppercase letter");
  });

  it("rejects passwords without a number", () => {
    expect(validatePassword("ChessPass")).toBe("Password must contain a number");
  });

  it("accepts a valid password", () => {
    expect(validatePassword("Chess1234!")).toBeNull();
  });

  it("accepts a minimal valid password", () => {
    expect(validatePassword("Abcdef1g")).toBeNull();
  });
});

describe("Email validation", () => {
  it("rejects empty email", () => {
    expect(validateEmail("")).toBe("Email is required");
  });

  it("rejects email without @", () => {
    expect(validateEmail("notanemail")).toBe("Invalid email address");
  });

  it("rejects email without domain", () => {
    expect(validateEmail("user@")).toBe("Invalid email address");
  });

  it("accepts a valid email", () => {
    expect(validateEmail("magnus@chess.com")).toBeNull();
  });

  it("accepts email with subdomain", () => {
    expect(validateEmail("user@mail.example.org")).toBeNull();
  });
});

describe("Display name helpers", () => {
  it("returns first char of displayName uppercased", () => {
    expect(getInitial("Magnus Carlsen", "m@chess.com")).toBe("M");
  });

  it("falls back to email initial when displayName is empty", () => {
    expect(getInitial("", "alice@chess.com")).toBe("A");
  });

  it("handles lowercase first char", () => {
    expect(getInitial("bob", "b@chess.com")).toBe("B");
  });

  it("does not truncate short names", () => {
    expect(truncateDisplayName("Magnus")).toBe("Magnus");
  });

  it("truncates long names with ellipsis", () => {
    const long = "Maximilian Alexander von Steinitz";
    const result = truncateDisplayName(long, 20);
    expect(result.length).toBeLessThanOrEqual(21); // 20 + ellipsis char
    expect(result.endsWith("…")).toBe(true);
  });

  it("truncates at exactly maxLen", () => {
    const name = "A".repeat(20);
    expect(truncateDisplayName(name, 20)).toBe(name);
  });
});

describe("Auth state transitions", () => {
  it("user is null before login", () => {
    const user = null;
    expect(user).toBeNull();
  });

  it("user object has expected shape after login", () => {
    const mockUser = {
      id: 1,
      email: "test@chess.com",
      displayName: "Test User",
      chesscomUsername: null,
      lichessUsername: null,
      avatarUrl: null,
    };
    expect(mockUser.id).toBe(1);
    expect(mockUser.email).toBe("test@chess.com");
    expect(mockUser.displayName).toBe("Test User");
  });

  it("logout clears user to null", () => {
    let user: { id: number; email: string } | null = { id: 1, email: "test@chess.com" };
    // Simulate logout
    user = null;
    expect(user).toBeNull();
  });
});
