import { useEffect, useRef } from "react";

/**
 * useKeyboardScroll
 *
 * Attaches to a scrollable container ref. On mobile, when the on-screen
 * keyboard opens (detected via window resize / visualViewport shrink), it
 * scrolls the currently focused input/textarea/select into view with a
 * comfortable gap above the keyboard.
 *
 * Strategy:
 *  1. Listen to `visualViewport.resize` (most reliable on iOS/Android).
 *  2. Fall back to `window.resize` for browsers that don't expose visualViewport.
 *  3. On focus events inside the container, store the focused element so we
 *     can re-scroll it if the viewport shrinks after focus.
 *
 * @param scrollContainerRef - ref to the overflow-y-auto scroll container
 * @param extraPadding       - extra px gap to leave above the keyboard (default 16)
 */
export function useKeyboardScroll(
  scrollContainerRef: React.RefObject<HTMLElement | null>,
  extraPadding = 16
) {
  const focusedElRef = useRef<Element | null>(null);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    // Track the focused element inside the container
    const onFocusIn = (e: FocusEvent) => {
      const target = e.target as Element;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      ) {
        focusedElRef.current = target;
      }
    };

    const onFocusOut = () => {
      focusedElRef.current = null;
    };

    container.addEventListener("focusin", onFocusIn);
    container.addEventListener("focusout", onFocusOut);

    /**
     * Scroll the focused element into view within the container,
     * leaving `extraPadding` px of breathing room above the keyboard.
     */
    const scrollFocusedIntoView = () => {
      const el = focusedElRef.current;
      if (!el || !container) return;

      // Use visualViewport height if available (accounts for keyboard)
      const viewportHeight = window.visualViewport
        ? window.visualViewport.height
        : window.innerHeight;

      const elRect = el.getBoundingClientRect();
      const _containerRect = container.getBoundingClientRect();

      // Bottom of the element relative to the viewport
      const elBottom = elRect.bottom;

      if (elBottom > viewportHeight - extraPadding) {
        // How much we need to scroll down inside the container
        const overflow = elBottom - (viewportHeight - extraPadding);
        container.scrollTop += overflow;
      }
    };

    // visualViewport resize fires when the keyboard opens/closes on mobile
    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener("resize", scrollFocusedIntoView);
      vv.addEventListener("scroll", scrollFocusedIntoView);
    } else {
      // Fallback for browsers without visualViewport
      window.addEventListener("resize", scrollFocusedIntoView);
    }

    return () => {
      container.removeEventListener("focusin", onFocusIn);
      container.removeEventListener("focusout", onFocusOut);
      if (vv) {
        vv.removeEventListener("resize", scrollFocusedIntoView);
        vv.removeEventListener("scroll", scrollFocusedIntoView);
      } else {
        window.removeEventListener("resize", scrollFocusedIntoView);
      }
    };
  }, [scrollContainerRef, extraPadding]);
}
