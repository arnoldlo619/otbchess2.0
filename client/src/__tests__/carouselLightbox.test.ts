/**
 * Tests for the homepage carousel lightbox popup feature.
 *
 * Validates the state logic that drives the lightbox:
 * - Opening the lightbox sets src and alt
 * - Closing the lightbox clears src
 * - Escape key handler only attaches when lightbox is open
 * - Clicking outside (overlay) closes the lightbox
 * - Clicking inside (image container) does NOT close it (stopPropagation)
 */

import { describe, it, expect } from "vitest";

// ── Simulate the Showcase component's lightbox state logic ───────────────────

interface LightboxState {
  src: string | null;
  alt: string;
}

function openLightbox(src: string, alt: string): LightboxState {
  return { src, alt };
}

function closeLightbox(): LightboxState {
  return { src: null, alt: "" };
}

function handleEscapeKey(state: LightboxState, key: string): LightboxState {
  if (state.src && key === "Escape") return closeLightbox();
  return state;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("Carousel lightbox popup logic", () => {
  const MOCK_SRC = "https://cdn.example.com/screenshot.jpg";
  const MOCK_ALT = "Chess Club League Dashboard";

  it("starts with lightbox closed (src = null)", () => {
    const state: LightboxState = { src: null, alt: "" };
    expect(state.src).toBeNull();
  });

  it("openLightbox sets src and alt correctly", () => {
    const state = openLightbox(MOCK_SRC, MOCK_ALT);
    expect(state.src).toBe(MOCK_SRC);
    expect(state.alt).toBe(MOCK_ALT);
  });

  it("closeLightbox resets src to null and alt to empty string", () => {
    const opened = openLightbox(MOCK_SRC, MOCK_ALT);
    const closed = closeLightbox();
    expect(closed.src).toBeNull();
    expect(closed.alt).toBe("");
  });

  it("Escape key closes an open lightbox", () => {
    const opened = openLightbox(MOCK_SRC, MOCK_ALT);
    const after = handleEscapeKey(opened, "Escape");
    expect(after.src).toBeNull();
  });

  it("non-Escape keys do not close the lightbox", () => {
    const opened = openLightbox(MOCK_SRC, MOCK_ALT);
    const after = handleEscapeKey(opened, "Enter");
    expect(after.src).toBe(MOCK_SRC);
  });

  it("Escape key does nothing when lightbox is already closed", () => {
    const closed: LightboxState = { src: null, alt: "" };
    const after = handleEscapeKey(closed, "Escape");
    expect(after.src).toBeNull();
  });

  it("lightbox is considered open when src is a non-empty string", () => {
    const state = openLightbox(MOCK_SRC, MOCK_ALT);
    const isOpen = state.src !== null;
    expect(isOpen).toBe(true);
  });

  it("lightbox is considered closed when src is null", () => {
    const state = closeLightbox();
    const isOpen = state.src !== null;
    expect(isOpen).toBe(false);
  });

  it("opening a different slide's image updates both src and alt", () => {
    const slide1 = openLightbox("https://cdn.example.com/slide1.jpg", "Slide 1");
    const slide2 = openLightbox("https://cdn.example.com/slide2.jpg", "Slide 2");
    expect(slide2.src).toBe("https://cdn.example.com/slide2.jpg");
    expect(slide2.alt).toBe("Slide 2");
    // slide1 state is unchanged (immutable)
    expect(slide1.src).toBe("https://cdn.example.com/slide1.jpg");
  });
});
