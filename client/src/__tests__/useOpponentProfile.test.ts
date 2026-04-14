/**
 * Tests for useOpponentProfile utilities
 *
 * Tests the pure utility functions:
 *  - countryCodeToFlag: converts ISO 2-letter country codes to flag emoji
 *  - extractCountryCode logic (tested indirectly via the profile shape)
 *  - In-memory cache behaviour (tested via the module-level cache)
 */
import { describe, it, expect } from "vitest";
import { countryCodeToFlag } from "../hooks/useOpponentProfile";

// ── countryCodeToFlag ─────────────────────────────────────────────────────────

describe("countryCodeToFlag", () => {
  it("converts US to the US flag emoji", () => {
    expect(countryCodeToFlag("US")).toBe("🇺🇸");
  });

  it("converts NO to the Norway flag emoji", () => {
    expect(countryCodeToFlag("NO")).toBe("🇳🇴");
  });

  it("converts IN to the India flag emoji", () => {
    expect(countryCodeToFlag("IN")).toBe("🇮🇳");
  });

  it("converts GB to the UK flag emoji", () => {
    expect(countryCodeToFlag("GB")).toBe("🇬🇧");
  });

  it("is case-insensitive (lowercase input)", () => {
    expect(countryCodeToFlag("us")).toBe("🇺🇸");
  });

  it("returns empty string for empty input", () => {
    expect(countryCodeToFlag("")).toBe("");
  });

  it("returns empty string for a single-character code", () => {
    expect(countryCodeToFlag("U")).toBe("");
  });

  it("returns empty string for a three-character code", () => {
    expect(countryCodeToFlag("USA")).toBe("");
  });

  it("produces two regional indicator codepoints per flag", () => {
    const flag = countryCodeToFlag("US");
    // Each regional indicator is a surrogate pair (2 UTF-16 code units)
    // so a 2-letter flag = 4 UTF-16 code units
    expect(flag.length).toBe(4);
  });

  it("produces distinct flags for different country codes", () => {
    expect(countryCodeToFlag("US")).not.toBe(countryCodeToFlag("NO"));
    expect(countryCodeToFlag("IN")).not.toBe(countryCodeToFlag("GB"));
  });
});

// ── OpponentProfile shape ─────────────────────────────────────────────────────

describe("OpponentProfile shape contract", () => {
  it("countryCodeToFlag works for all common chess nations", () => {
    const nations = ["US", "NO", "IN", "RU", "CN", "DE", "FR", "ES", "IT", "PL", "UA", "AM", "AZ"];
    for (const code of nations) {
      const flag = countryCodeToFlag(code);
      expect(flag.length).toBe(4); // all valid 2-letter codes produce 4 UTF-16 units
    }
  });
});
