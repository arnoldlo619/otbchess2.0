// @vitest-environment jsdom
/**
 * V3ScoutReportSkeleton — unit tests
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { V3ScoutReportSkeleton } from "./V3ScoutReportSkeleton";

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderSkeleton(isDark = true) {
  return render(<V3ScoutReportSkeleton isDark={isDark} />);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("V3ScoutReportSkeleton", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders without crashing in dark mode", () => {
    expect(() => renderSkeleton(true)).not.toThrow();
  });

  it("renders without crashing in light mode", () => {
    expect(() => renderSkeleton(false)).not.toThrow();
  });

  it("has role=status for screen readers", () => {
    renderSkeleton();
    expect(screen.getByRole("status")).toBeTruthy();
  });

  it("has aria-busy=true while loading", () => {
    renderSkeleton();
    const status = screen.getByRole("status");
    expect(status.getAttribute("aria-busy")).toBe("true");
  });

  it("has aria-label describing loading state", () => {
    renderSkeleton();
    const status = screen.getByRole("status");
    expect(status.getAttribute("aria-label")).toMatch(/loading/i);
  });

  it("contains a screen-reader live region", () => {
    renderSkeleton();
    const srOnly = document.querySelector(".sr-only[aria-live]");
    expect(srOnly).toBeTruthy();
    expect(srOnly?.getAttribute("aria-live")).toBe("polite");
  });

  it("renders shimmer blocks (animate-shimmer class present)", () => {
    renderSkeleton();
    const shimmerBlocks = document.querySelectorAll(".animate-shimmer");
    expect(shimmerBlocks.length).toBeGreaterThan(10);
  });

  it("renders all major skeleton sections (≥ 8 rounded-2xl cards)", () => {
    renderSkeleton();
    // Each SkeletonCard has rounded-2xl
    const cards = document.querySelectorAll(".rounded-2xl");
    expect(cards.length).toBeGreaterThanOrEqual(8);
  });

  it("progress steps start at step 0 (first step fully visible)", () => {
    renderSkeleton();
    // First step should have opacity-100 class
    const steps = document.querySelectorAll(".transition-all.duration-500");
    expect(steps.length).toBeGreaterThan(0);
    // At least one step has opacity-100
    const visible = Array.from(steps).some(el =>
      el.classList.contains("opacity-100")
    );
    expect(visible).toBe(true);
  });

  it("progress steps advance after 1800ms", () => {
    renderSkeleton();
    // Before timer: only step 0 is fully visible
    const stepsBefore = Array.from(
      document.querySelectorAll(".transition-all.duration-500")
    ).filter(el => el.classList.contains("opacity-100")).length;
    expect(stepsBefore).toBe(1);

    // Advance timer by 1800ms
    act(() => {
      vi.advanceTimersByTime(1800);
    });

    // Step 0 should now be opacity-35 (done), step 1 should be opacity-100
    const stepsAfter = Array.from(
      document.querySelectorAll(".transition-all.duration-500")
    );
    const doneSteps = stepsAfter.filter(el => el.classList.contains("opacity-35"));
    expect(doneSteps.length).toBe(1);
  });

  it("progress steps stop advancing after all 4 steps complete", () => {
    renderSkeleton();
    // Advance past all 4 steps (4 × 1800ms = 7200ms)
    act(() => {
      vi.advanceTimersByTime(7200);
    });
    // Last step (index 3) should be opacity-100, others opacity-35
    const steps = Array.from(
      document.querySelectorAll(".transition-all.duration-500")
    );
    const doneSteps = steps.filter(el => el.classList.contains("opacity-35"));
    // All but the last step should be done
    expect(doneSteps.length).toBe(3);
  });

  it("dark mode uses dark background classes", () => {
    renderSkeleton(true);
    const status = screen.getByRole("status");
    // At least one child should have dark bg class
    const darkBg = status.querySelector('[class*="bg-[#0f1c11]"]');
    expect(darkBg).toBeTruthy();
  });

  it("light mode uses light background classes", () => {
    renderSkeleton(false);
    const status = screen.getByRole("status");
    const lightBg = status.querySelector('[class*="bg-white"]');
    expect(lightBg).toBeTruthy();
  });
});
