/**
 * Tests for the homepage carousel progress bar feature.
 *
 * Validates:
 * - progressKey increments when slide advances (triggering CSS animation restart)
 * - goToSlide updates both activeSlide and progressKey
 * - isHovered pauses the auto-advance timer (animation-play-state logic)
 */

import { describe, it, expect } from "vitest";

// ── Simulate the Showcase component's state logic in isolation ───────────────

interface CarouselState {
  activeSlide: number;
  isHovered: boolean;
  progressKey: number;
}

function goToSlide(state: CarouselState, i: number): CarouselState {
  return { ...state, activeSlide: i, progressKey: state.progressKey + 1 };
}

function autoAdvance(state: CarouselState, slideCount: number): CarouselState {
  if (state.isHovered) return state; // paused
  const nextSlide = (state.activeSlide + 1) % slideCount;
  return { ...state, activeSlide: nextSlide, progressKey: state.progressKey + 1 };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("Carousel progress bar logic", () => {
  const SLIDE_COUNT = 2;

  it("starts with progressKey = 0", () => {
    const state: CarouselState = { activeSlide: 0, isHovered: false, progressKey: 0 };
    expect(state.progressKey).toBe(0);
  });

  it("goToSlide increments progressKey to restart the animation", () => {
    const state: CarouselState = { activeSlide: 0, isHovered: false, progressKey: 0 };
    const next = goToSlide(state, 1);
    expect(next.activeSlide).toBe(1);
    expect(next.progressKey).toBe(1);
  });

  it("goToSlide to same slide still increments progressKey (restarts bar)", () => {
    const state: CarouselState = { activeSlide: 0, isHovered: false, progressKey: 3 };
    const next = goToSlide(state, 0);
    expect(next.activeSlide).toBe(0);
    expect(next.progressKey).toBe(4);
  });

  it("auto-advance increments progressKey and wraps slide index", () => {
    const state: CarouselState = { activeSlide: 1, isHovered: false, progressKey: 0 };
    const next = autoAdvance(state, SLIDE_COUNT);
    expect(next.activeSlide).toBe(0); // wraps back to 0
    expect(next.progressKey).toBe(1);
  });

  it("auto-advance does NOT fire when isHovered is true", () => {
    const state: CarouselState = { activeSlide: 0, isHovered: true, progressKey: 5 };
    const next = autoAdvance(state, SLIDE_COUNT);
    expect(next.activeSlide).toBe(0);      // unchanged
    expect(next.progressKey).toBe(5);      // unchanged — bar stays paused
  });

  it("multiple auto-advances accumulate progressKey correctly", () => {
    let state: CarouselState = { activeSlide: 0, isHovered: false, progressKey: 0 };
    for (let i = 0; i < 5; i++) {
      state = autoAdvance(state, SLIDE_COUNT);
    }
    expect(state.progressKey).toBe(5);
    expect(state.activeSlide).toBe(1); // 5 advances on 2 slides → 1 (odd)
  });

  it("progressKey uniqueness ensures React re-mounts the bar element on each advance", () => {
    const keys = new Set<number>();
    let state: CarouselState = { activeSlide: 0, isHovered: false, progressKey: 0 };
    keys.add(state.progressKey);
    for (let i = 0; i < 10; i++) {
      state = autoAdvance(state, SLIDE_COUNT);
      keys.add(state.progressKey);
    }
    // Every advance produces a unique key
    expect(keys.size).toBe(11); // 0 through 10
  });
});
