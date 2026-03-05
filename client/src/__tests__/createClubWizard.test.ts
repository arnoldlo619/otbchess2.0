/**
 * Unit tests for the CreateClubWizard validation helpers
 *
 * Tests the exported `validateStep` function for all 4 input steps.
 */
import { describe, it, expect } from "vitest";
import { validateStep } from "../components/CreateClubWizard";

// ── Minimal valid data shape ──────────────────────────────────────────────────

const VALID = {
  name: "London Chess Club",
  tagline: "The oldest chess club in the world.",
  category: "club" as const,
  location: "London",
  country: "GB",
  description: "A vibrant chess community based in the heart of London, welcoming players of all levels.",
  accentColor: "#3D6B47",
  website: "",
  discord: "",
  isPublic: true,
};

// ── Step 1: Identity ──────────────────────────────────────────────────────────

describe("validateStep — Step 1 (Identity)", () => {
  it("passes with valid name and tagline", () => {
    expect(validateStep(1, VALID)).toBeNull();
  });

  it("fails when name is empty", () => {
    expect(validateStep(1, { ...VALID, name: "" })).toMatch(/name is required/i);
  });

  it("fails when name is too short (< 3 chars)", () => {
    expect(validateStep(1, { ...VALID, name: "AB" })).toMatch(/at least 3/i);
  });

  it("fails when name is too long (> 60 chars)", () => {
    expect(validateStep(1, { ...VALID, name: "A".repeat(61) })).toMatch(/60 characters/i);
  });

  it("passes when name is exactly 60 chars", () => {
    expect(validateStep(1, { ...VALID, name: "A".repeat(60) })).toBeNull();
  });

  it("fails when tagline is empty", () => {
    expect(validateStep(1, { ...VALID, tagline: "" })).toMatch(/tagline is required/i);
  });

  it("fails when tagline is too long (> 100 chars)", () => {
    expect(validateStep(1, { ...VALID, tagline: "A".repeat(101) })).toMatch(/100 characters/i);
  });

  it("passes when tagline is exactly 100 chars", () => {
    expect(validateStep(1, { ...VALID, tagline: "A".repeat(100) })).toBeNull();
  });
});

// ── Step 2: Category ──────────────────────────────────────────────────────────

describe("validateStep — Step 2 (Category)", () => {
  it("passes with a valid category", () => {
    expect(validateStep(2, VALID)).toBeNull();
  });

  it("fails when category is empty string", () => {
    // @ts-expect-error testing invalid value
    expect(validateStep(2, { ...VALID, category: "" })).toMatch(/select a category/i);
  });
});

// ── Step 3: Location ──────────────────────────────────────────────────────────

describe("validateStep — Step 3 (Location)", () => {
  it("passes with valid location and country", () => {
    expect(validateStep(3, VALID)).toBeNull();
  });

  it("fails when location is empty", () => {
    expect(validateStep(3, { ...VALID, location: "" })).toMatch(/location is required/i);
  });

  it("fails when location is only whitespace", () => {
    expect(validateStep(3, { ...VALID, location: "   " })).toMatch(/location is required/i);
  });

  it("fails when country is empty", () => {
    expect(validateStep(3, { ...VALID, country: "" })).toMatch(/select a country/i);
  });
});

// ── Step 4: About ─────────────────────────────────────────────────────────────

describe("validateStep — Step 4 (About)", () => {
  it("passes with valid description", () => {
    expect(validateStep(4, VALID)).toBeNull();
  });

  it("fails when description is empty", () => {
    expect(validateStep(4, { ...VALID, description: "" })).toMatch(/description is required/i);
  });

  it("fails when description is too short (< 20 chars)", () => {
    expect(validateStep(4, { ...VALID, description: "Too short" })).toMatch(/at least 20/i);
  });

  it("passes when description is exactly 20 chars", () => {
    expect(validateStep(4, { ...VALID, description: "A".repeat(20) })).toBeNull();
  });

  it("fails when description is too long (> 500 chars)", () => {
    expect(validateStep(4, { ...VALID, description: "A".repeat(501) })).toMatch(/500 characters/i);
  });

  it("passes when description is exactly 500 chars", () => {
    expect(validateStep(4, { ...VALID, description: "A".repeat(500) })).toBeNull();
  });
});

// ── Steps outside 1-4 ────────────────────────────────────────────────────────

describe("validateStep — other steps", () => {
  it("returns null for step 0 (no validation)", () => {
    expect(validateStep(0, VALID)).toBeNull();
  });

  it("returns null for step 5 (share screen, no validation)", () => {
    expect(validateStep(5, VALID)).toBeNull();
  });
});
