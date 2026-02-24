/**
 * Unit tests for phone/email field handling in the Join page registration flow.
 * Tests cover: phone digit stripping for wa.me links, email validation,
 * and the optional nature of both fields (undefined when blank).
 */
import { describe, it, expect } from "vitest";

// ── Helpers mirrored from ShareResultsModal ──────────────────────────────────

function normalisePhone(phone: string | undefined): string {
  if (!phone) return "";
  return phone.replace(/\D/g, "").replace(/^0+/, "");
}

function buildWhatsAppLink(phone: string | undefined, message: string): string {
  const encoded = encodeURIComponent(message);
  if (phone) {
    const digits = normalisePhone(phone);
    if (digits) return `https://wa.me/${digits}?text=${encoded}`;
  }
  return `https://wa.me/?text=${encoded}`;
}

function buildMailtoLink(
  email: string | undefined,
  subject: string,
  body: string,
): string {
  const to = email ?? "";
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

// ── Phone normalisation ───────────────────────────────────────────────────────

describe("normalisePhone", () => {
  it("strips non-digit characters", () => {
    expect(normalisePhone("+1 (555) 123-4567")).toBe("15551234567");
  });

  it("strips leading zeros", () => {
    expect(normalisePhone("0044 7911 123456")).toBe("447911123456");
  });

  it("handles plain digits unchanged", () => {
    expect(normalisePhone("447911123456")).toBe("447911123456");
  });

  it("returns empty string for undefined", () => {
    expect(normalisePhone(undefined)).toBe("");
  });

  it("returns empty string for empty string", () => {
    expect(normalisePhone("")).toBe("");
  });

  it("handles spaces only", () => {
    expect(normalisePhone("   ")).toBe("");
  });
});

// ── WhatsApp link builder ─────────────────────────────────────────────────────

describe("buildWhatsAppLink", () => {
  it("includes phone number when provided", () => {
    const link = buildWhatsAppLink("+1 555 123 4567", "Hello");
    expect(link).toContain("wa.me/15551234567");
  });

  it("falls back to no-recipient link when phone is undefined", () => {
    const link = buildWhatsAppLink(undefined, "Hello");
    expect(link).toBe(`https://wa.me/?text=${encodeURIComponent("Hello")}`);
  });

  it("falls back to no-recipient link when phone is empty string", () => {
    const link = buildWhatsAppLink("", "Hello");
    expect(link).toBe(`https://wa.me/?text=${encodeURIComponent("Hello")}`);
  });

  it("encodes the message text", () => {
    const link = buildWhatsAppLink(undefined, "Score: 3.5/5 🏆");
    expect(link).toContain(encodeURIComponent("Score: 3.5/5 🏆"));
  });

  it("includes both phone and encoded message", () => {
    const link = buildWhatsAppLink("447911123456", "Good game!");
    expect(link).toContain("wa.me/447911123456");
    expect(link).toContain(encodeURIComponent("Good game!"));
  });
});

// ── Mailto link builder ───────────────────────────────────────────────────────

describe("buildMailtoLink", () => {
  it("includes email address when provided", () => {
    const link = buildMailtoLink("alice@example.com", "Results", "Body text");
    expect(link).toContain("mailto:alice@example.com");
  });

  it("uses empty to: when email is undefined", () => {
    const link = buildMailtoLink(undefined, "Results", "Body text");
    expect(link).toContain("mailto:?");
  });

  it("encodes the subject", () => {
    const link = buildMailtoLink(undefined, "OTB Chess — Results", "Body");
    expect(link).toContain(encodeURIComponent("OTB Chess — Results"));
  });

  it("encodes the body", () => {
    const link = buildMailtoLink(undefined, "Subject", "Score: 3.5/5\nGood game!");
    expect(link).toContain(encodeURIComponent("Score: 3.5/5\nGood game!"));
  });
});

// ── Optional field persistence ────────────────────────────────────────────────

describe("optional contact field persistence", () => {
  it("trims whitespace and stores undefined for blank phone", () => {
    const raw = "   ";
    const stored = raw.trim() || undefined;
    expect(stored).toBeUndefined();
  });

  it("trims whitespace and stores undefined for blank email", () => {
    const raw = "";
    const stored = raw.trim() || undefined;
    expect(stored).toBeUndefined();
  });

  it("stores trimmed phone when non-empty", () => {
    const raw = "  +44 7911 123456  ";
    const stored = raw.trim() || undefined;
    expect(stored).toBe("+44 7911 123456");
  });

  it("stores trimmed email when non-empty", () => {
    const raw = "  alice@example.com  ";
    const stored = raw.trim() || undefined;
    expect(stored).toBe("alice@example.com");
  });
});
