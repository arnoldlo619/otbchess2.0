// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useRef } from "react";
import { useKeyboardScroll } from "@/hooks/useKeyboardScroll";

// Helper to create a mock scrollable container element
function makeMockContainer(scrollTop = 0) {
  const el = document.createElement("div");
  Object.defineProperty(el, "scrollTop", {
    writable: true,
    value: scrollTop,
  });
  return el;
}

// Helper to create a mock input element with a given bounding rect
function makeMockInput(bottom: number) {
  const input = document.createElement("input");
  input.getBoundingClientRect = () =>
    ({
      bottom,
      top: bottom - 50,
      left: 0,
      right: 300,
      width: 300,
      height: 50,
    } as DOMRect);
  return input;
}

describe("useKeyboardScroll", () => {
  let originalVisualViewport: VisualViewport | null;

  beforeEach(() => {
    originalVisualViewport = window.visualViewport;
  });

  afterEach(() => {
    Object.defineProperty(window, "visualViewport", {
      writable: true,
      configurable: true,
      value: originalVisualViewport,
    });
    vi.restoreAllMocks();
  });

  it("attaches focusin and focusout listeners to the container", () => {
    const container = makeMockContainer();
    const addSpy = vi.spyOn(container, "addEventListener");

    const { result } = renderHook(() => {
      const ref = useRef<HTMLDivElement>(container as unknown as HTMLDivElement);
      useKeyboardScroll(ref, 16);
      return ref;
    });

    expect(addSpy).toHaveBeenCalledWith("focusin", expect.any(Function));
    expect(addSpy).toHaveBeenCalledWith("focusout", expect.any(Function));
    expect(result.current.current).toBe(container);
  });

  it("removes event listeners on cleanup", () => {
    const container = makeMockContainer();
    const removeSpy = vi.spyOn(container, "removeEventListener");

    // Suppress visualViewport for this test
    Object.defineProperty(window, "visualViewport", {
      writable: true,
      configurable: true,
      value: null,
    });

    const addWindowSpy = vi.spyOn(window, "addEventListener");
    const removeWindowSpy = vi.spyOn(window, "removeEventListener");

    const { unmount } = renderHook(() => {
      const ref = useRef<HTMLDivElement>(container as unknown as HTMLDivElement);
      useKeyboardScroll(ref, 16);
      return ref;
    });

    unmount();

    expect(removeSpy).toHaveBeenCalledWith("focusin", expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith("focusout", expect.any(Function));
    expect(removeWindowSpy).toHaveBeenCalledWith("resize", expect.any(Function));

    addWindowSpy.mockRestore();
    removeWindowSpy.mockRestore();
  });

  it("scrolls container when focused input is below the visible viewport", () => {
    const container = makeMockContainer(0);
    const input = makeMockInput(700); // input bottom at 700px

    // Mock visualViewport with height 500 (keyboard has taken 300px)
    const vvListeners: Record<string, EventListener> = {};
    const mockVV = {
      height: 500,
      addEventListener: (type: string, fn: EventListener) => {
        vvListeners[type] = fn;
      },
      removeEventListener: vi.fn(),
    };

    Object.defineProperty(window, "visualViewport", {
      writable: true,
      configurable: true,
      value: mockVV,
    });

    renderHook(() => {
      const ref = useRef<HTMLDivElement>(container as unknown as HTMLDivElement);
      useKeyboardScroll(ref, 16);
      return ref;
    });

    // Simulate focusin on the input
    const focusInEvent = new FocusEvent("focusin", { bubbles: true });
    Object.defineProperty(focusInEvent, "target", { value: input });
    container.dispatchEvent(focusInEvent);

    // Simulate keyboard opening (visualViewport resize)
    vvListeners["resize"]?.(new Event("resize"));

    // Expected scroll: input bottom (700) - (viewport height (500) - padding (16)) = 216
    expect((container as HTMLElement & { scrollTop: number }).scrollTop).toBe(216);
  });

  it("does not scroll when focused input is already fully visible", () => {
    const container = makeMockContainer(0);
    const input = makeMockInput(400); // input bottom at 400px — well within viewport

    const vvListeners: Record<string, EventListener> = {};
    const mockVV = {
      height: 500,
      addEventListener: (type: string, fn: EventListener) => {
        vvListeners[type] = fn;
      },
      removeEventListener: vi.fn(),
    };

    Object.defineProperty(window, "visualViewport", {
      writable: true,
      configurable: true,
      value: mockVV,
    });

    renderHook(() => {
      const ref = useRef<HTMLDivElement>(container as unknown as HTMLDivElement);
      useKeyboardScroll(ref, 16);
      return ref;
    });

    const focusInEvent = new FocusEvent("focusin", { bubbles: true });
    Object.defineProperty(focusInEvent, "target", { value: input });
    container.dispatchEvent(focusInEvent);

    vvListeners["resize"]?.(new Event("resize"));

    // 400 < 500 - 16 = 484, so no scroll needed
    expect((container as HTMLElement & { scrollTop: number }).scrollTop).toBe(0);
  });

  it("does nothing when no element is focused on viewport resize", () => {
    const container = makeMockContainer(0);

    const vvListeners: Record<string, EventListener> = {};
    const mockVV = {
      height: 500,
      addEventListener: (type: string, fn: EventListener) => {
        vvListeners[type] = fn;
      },
      removeEventListener: vi.fn(),
    };

    Object.defineProperty(window, "visualViewport", {
      writable: true,
      configurable: true,
      value: mockVV,
    });

    renderHook(() => {
      const ref = useRef<HTMLDivElement>(container as unknown as HTMLDivElement);
      useKeyboardScroll(ref, 16);
      return ref;
    });

    // No focusin fired — simulate keyboard opening with no focused element
    vvListeners["resize"]?.(new Event("resize"));

    expect((container as HTMLElement & { scrollTop: number }).scrollTop).toBe(0);
  });
});
