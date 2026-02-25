// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useRef } from "react";
import { useSwipeGesture } from "@/hooks/useSwipeGesture";

// Helper: create a Touch-like object
function makeTouch(x: number, y: number): Touch {
  return { clientX: x, clientY: y, identifier: 0 } as Touch;
}

// Helper: fire a touch event on an element
function fireTouchEvent(
  el: HTMLElement,
  type: "touchstart" | "touchmove" | "touchend",
  touches: Touch[],
  changedTouches?: Touch[]
) {
  const event = new TouchEvent(type, {
    bubbles: true,
    cancelable: true,
    touches: touches as unknown as TouchList,
    changedTouches: (changedTouches ?? touches) as unknown as TouchList,
  });
  el.dispatchEvent(event);
}

describe("useSwipeGesture", () => {
  afterEach(() => vi.restoreAllMocks());

  it("calls onSwipeLeft when swiping left past threshold", () => {
    const container = document.createElement("div");
    const onSwipeLeft = vi.fn();

    renderHook(() => {
      const ref = useRef<HTMLDivElement>(container as unknown as HTMLDivElement);
      useSwipeGesture(ref, { onSwipeLeft, threshold: 60 });
    });

    fireTouchEvent(container, "touchstart", [makeTouch(200, 300)]);
    fireTouchEvent(container, "touchmove", [makeTouch(150, 305)]);
    fireTouchEvent(container, "touchend", [], [makeTouch(130, 310)]);

    expect(onSwipeLeft).toHaveBeenCalledOnce();
  });

  it("calls onSwipeRight when swiping right past threshold", () => {
    const container = document.createElement("div");
    const onSwipeRight = vi.fn();

    renderHook(() => {
      const ref = useRef<HTMLDivElement>(container as unknown as HTMLDivElement);
      useSwipeGesture(ref, { onSwipeRight, threshold: 60 });
    });

    fireTouchEvent(container, "touchstart", [makeTouch(100, 300)]);
    fireTouchEvent(container, "touchmove", [makeTouch(150, 305)]);
    fireTouchEvent(container, "touchend", [], [makeTouch(170, 310)]);

    expect(onSwipeRight).toHaveBeenCalledOnce();
  });

  it("does not fire when swipe distance is below threshold", () => {
    const container = document.createElement("div");
    const onSwipeLeft = vi.fn();

    renderHook(() => {
      const ref = useRef<HTMLDivElement>(container as unknown as HTMLDivElement);
      useSwipeGesture(ref, { onSwipeLeft, threshold: 60 });
    });

    fireTouchEvent(container, "touchstart", [makeTouch(200, 300)]);
    fireTouchEvent(container, "touchend", [], [makeTouch(160, 302)]); // only 40px

    expect(onSwipeLeft).not.toHaveBeenCalled();
  });

  it("cancels when vertical drift exceeds maxVerticalDrift", () => {
    const container = document.createElement("div");
    const onSwipeLeft = vi.fn();

    renderHook(() => {
      const ref = useRef<HTMLDivElement>(container as unknown as HTMLDivElement);
      useSwipeGesture(ref, { onSwipeLeft, threshold: 60, maxVerticalDrift: 80 });
    });

    fireTouchEvent(container, "touchstart", [makeTouch(200, 100)]);
    fireTouchEvent(container, "touchmove", [makeTouch(180, 200)]); // 100px vertical drift → cancel
    fireTouchEvent(container, "touchend", [], [makeTouch(100, 210)]);

    expect(onSwipeLeft).not.toHaveBeenCalled();
  });

  it("cancels when touch starts on an input element", () => {
    const container = document.createElement("div");
    const input = document.createElement("input");
    container.appendChild(input);
    const onSwipeLeft = vi.fn();

    renderHook(() => {
      const ref = useRef<HTMLDivElement>(container as unknown as HTMLDivElement);
      useSwipeGesture(ref, { onSwipeLeft, threshold: 60 });
    });

    // Fire touchstart directly on the input
    const startEvent = new TouchEvent("touchstart", {
      bubbles: true,
      cancelable: true,
      touches: [makeTouch(200, 300)] as unknown as TouchList,
      changedTouches: [makeTouch(200, 300)] as unknown as TouchList,
    });
    input.dispatchEvent(startEvent);

    fireTouchEvent(container, "touchend", [], [makeTouch(100, 305)]);

    expect(onSwipeLeft).not.toHaveBeenCalled();
  });

  it("removes listeners on unmount", () => {
    const container = document.createElement("div");
    const removeSpy = vi.spyOn(container, "removeEventListener");

    const { unmount } = renderHook(() => {
      const ref = useRef<HTMLDivElement>(container as unknown as HTMLDivElement);
      useSwipeGesture(ref, {});
    });

    unmount();

    expect(removeSpy).toHaveBeenCalledWith("touchstart", expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith("touchmove", expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith("touchend", expect.any(Function));
  });

  it("does nothing when disabled is true", () => {
    const container = document.createElement("div");
    const addSpy = vi.spyOn(container, "addEventListener");

    renderHook(() => {
      const ref = useRef<HTMLDivElement>(container as unknown as HTMLDivElement);
      useSwipeGesture(ref, { disabled: true });
    });

    expect(addSpy).not.toHaveBeenCalled();
  });

  describe("haptic feedback", () => {
    beforeEach(() => {
      // Mock navigator.vibrate
      Object.defineProperty(navigator, "vibrate", {
        value: vi.fn(),
        writable: true,
        configurable: true,
      });
    });

    it("calls navigator.vibrate with hapticForward duration on swipe left", () => {
      const container = document.createElement("div");
      const onSwipeLeft = vi.fn();

      renderHook(() => {
        const ref = useRef<HTMLDivElement>(container as unknown as HTMLDivElement);
        useSwipeGesture(ref, { onSwipeLeft, hapticForward: 15, threshold: 60 });
      });

      fireTouchEvent(container, "touchstart", [makeTouch(200, 300)]);
      fireTouchEvent(container, "touchend", [], [makeTouch(130, 305)]);

      expect(navigator.vibrate).toHaveBeenCalledWith(15);
      expect(onSwipeLeft).toHaveBeenCalledOnce();
    });

    it("calls navigator.vibrate with hapticBack duration on swipe right", () => {
      const container = document.createElement("div");
      const onSwipeRight = vi.fn();

      renderHook(() => {
        const ref = useRef<HTMLDivElement>(container as unknown as HTMLDivElement);
        useSwipeGesture(ref, { onSwipeRight, hapticBack: 25, threshold: 60 });
      });

      fireTouchEvent(container, "touchstart", [makeTouch(100, 300)]);
      fireTouchEvent(container, "touchend", [], [makeTouch(170, 305)]);

      expect(navigator.vibrate).toHaveBeenCalledWith(25);
      expect(onSwipeRight).toHaveBeenCalledOnce();
    });

    it("does not vibrate when hapticForward is 0", () => {
      const container = document.createElement("div");

      renderHook(() => {
        const ref = useRef<HTMLDivElement>(container as unknown as HTMLDivElement);
        useSwipeGesture(ref, { hapticForward: 0, threshold: 60 });
      });

      fireTouchEvent(container, "touchstart", [makeTouch(200, 300)]);
      fireTouchEvent(container, "touchend", [], [makeTouch(130, 305)]);

      expect(navigator.vibrate).not.toHaveBeenCalled();
    });
  });
});
