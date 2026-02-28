/**
 * Tests for useVisibilitySync hook
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useVisibilitySync } from "../useVisibilitySync";

// Helper to simulate the document becoming visible
function simulateVisible() {
  Object.defineProperty(document, "hidden", { value: false, writable: true, configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
}

// Helper to simulate the document becoming hidden
function simulateHidden() {
  Object.defineProperty(document, "hidden", { value: true, writable: true, configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("useVisibilitySync", () => {
  beforeEach(() => {
    // Start with document visible
    Object.defineProperty(document, "hidden", { value: false, writable: true, configurable: true });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("calls the callback when document transitions from hidden to visible", () => {
    const callback = vi.fn();
    renderHook(() => useVisibilitySync(callback));

    // Simulate phone lock (hidden)
    act(() => simulateHidden());
    expect(callback).not.toHaveBeenCalled();

    // Simulate phone unlock (visible)
    act(() => simulateVisible());
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("does not call the callback when document becomes hidden", () => {
    const callback = vi.fn();
    renderHook(() => useVisibilitySync(callback));

    act(() => simulateHidden());
    expect(callback).not.toHaveBeenCalled();
  });

  it("calls the callback multiple times on repeated visibility changes", () => {
    const callback = vi.fn();
    renderHook(() => useVisibilitySync(callback));

    act(() => simulateHidden());
    act(() => simulateVisible());
    act(() => simulateHidden());
    act(() => simulateVisible());
    act(() => simulateHidden());
    act(() => simulateVisible());

    expect(callback).toHaveBeenCalledTimes(3);
  });

  it("does not call the callback when enabled is false", () => {
    const callback = vi.fn();
    renderHook(() => useVisibilitySync(callback, false));

    act(() => simulateHidden());
    act(() => simulateVisible());

    expect(callback).not.toHaveBeenCalled();
  });

  it("stops calling callback after enabled switches to false", () => {
    const callback = vi.fn();
    const { rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useVisibilitySync(callback, enabled),
      { initialProps: { enabled: true } }
    );

    // First cycle — enabled
    act(() => simulateHidden());
    act(() => simulateVisible());
    expect(callback).toHaveBeenCalledTimes(1);

    // Disable
    rerender({ enabled: false });

    // Second cycle — disabled
    act(() => simulateHidden());
    act(() => simulateVisible());
    expect(callback).toHaveBeenCalledTimes(1); // still 1
  });

  it("resumes calling callback after enabled switches back to true", () => {
    const callback = vi.fn();
    const { rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useVisibilitySync(callback, enabled),
      { initialProps: { enabled: false } }
    );

    act(() => simulateHidden());
    act(() => simulateVisible());
    expect(callback).toHaveBeenCalledTimes(0);

    rerender({ enabled: true });

    act(() => simulateHidden());
    act(() => simulateVisible());
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("removes the event listener on unmount", () => {
    const callback = vi.fn();
    const removeSpy = vi.spyOn(document, "removeEventListener");
    const { unmount } = renderHook(() => useVisibilitySync(callback));

    unmount();

    expect(removeSpy).toHaveBeenCalledWith("visibilitychange", expect.any(Function));
  });

  it("uses the latest callback reference without re-registering the listener", () => {
    const callback1 = vi.fn();
    const callback2 = vi.fn();

    const { rerender } = renderHook(
      ({ cb }: { cb: () => void }) => useVisibilitySync(cb),
      { initialProps: { cb: callback1 } }
    );

    // Switch to callback2 without unmounting
    rerender({ cb: callback2 });

    act(() => simulateHidden());
    act(() => simulateVisible());

    // callback2 should fire, callback1 should not
    expect(callback1).not.toHaveBeenCalled();
    expect(callback2).toHaveBeenCalledTimes(1);
  });

  it("does not fire on mount — only on subsequent visibility changes", () => {
    const callback = vi.fn();
    // Document is already visible on mount
    renderHook(() => useVisibilitySync(callback));

    // No visibility change event fired — callback should not be called
    expect(callback).not.toHaveBeenCalled();
  });

  it("handles rapid hide/show cycles correctly", () => {
    const callback = vi.fn();
    renderHook(() => useVisibilitySync(callback));

    // 5 rapid cycles
    for (let i = 0; i < 5; i++) {
      act(() => simulateHidden());
      act(() => simulateVisible());
    }

    expect(callback).toHaveBeenCalledTimes(5);
  });

  it("works correctly when document is already hidden on mount", () => {
    // Start hidden
    Object.defineProperty(document, "hidden", { value: true, writable: true, configurable: true });

    const callback = vi.fn();
    renderHook(() => useVisibilitySync(callback));

    // No call on mount
    expect(callback).not.toHaveBeenCalled();

    // Becomes visible
    act(() => simulateVisible());
    expect(callback).toHaveBeenCalledTimes(1);
  });
});
