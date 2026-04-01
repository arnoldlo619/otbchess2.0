/**
 * useKeyboardAwareModal
 *
 * Detects when the Android virtual keyboard opens and returns the height of the
 * keyboard so modals can shift upward to keep their content visible.
 *
 * Strategy:
 * 1. Primary: VisualViewport API — supported in Chrome 61+, Firefox 91+, Safari 13+.
 *    When the keyboard opens, window.visualViewport.height shrinks.
 *    keyboardHeight = window.innerHeight - visualViewport.height - visualViewport.offsetTop
 *
 * 2. Fallback: window resize event — older browsers / WebViews that don't expose
 *    visualViewport still fire a resize when the keyboard opens (adjustResize mode).
 *
 * Usage:
 *   const { keyboardHeight, isKeyboardOpen } = useKeyboardAwareModal();
 *   // Apply to a modal: style={{ paddingBottom: keyboardHeight }}
 *
 * Notes:
 * - On iOS Safari, `interactive-widget=resizes-content` is NOT supported, so
 *   this hook is the primary fix for iOS too.
 * - On Android Chrome 108+ with `interactive-widget=resizes-content` in the
 *   viewport meta, the layout viewport already shrinks — keyboardHeight will be 0
 *   in that case, which is correct (no extra padding needed).
 */

import { useState, useEffect } from "react";

interface KeyboardState {
  keyboardHeight: number;
  isKeyboardOpen: boolean;
}

export function useKeyboardAwareModal(): KeyboardState {
  const [state, setState] = useState<KeyboardState>({
    keyboardHeight: 0,
    isKeyboardOpen: false,
  });

  useEffect(() => {
    // Only run on touch devices — avoids false positives on desktop
    const isTouchDevice =
      "ontouchstart" in window || navigator.maxTouchPoints > 0;
    if (!isTouchDevice) return;

    function update() {
      const vv = window.visualViewport;
      if (!vv) return;

      // The keyboard height is the gap between the layout viewport bottom
      // and the visual viewport bottom (accounting for any top offset).
      const kbHeight = Math.max(
        0,
        window.innerHeight - vv.height - vv.offsetTop
      );

      setState({
        keyboardHeight: kbHeight,
        isKeyboardOpen: kbHeight > 100, // threshold: ignore tiny resize events
      });
    }

    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener("resize", update);
      vv.addEventListener("scroll", update);
      update(); // initial read
      return () => {
        vv.removeEventListener("resize", update);
        vv.removeEventListener("scroll", update);
      };
    } else {
      // Fallback for browsers without VisualViewport API
      const initialHeight = window.innerHeight;
      const onResize = () => {
        const kbHeight = Math.max(0, initialHeight - window.innerHeight);
        setState({
          keyboardHeight: kbHeight,
          isKeyboardOpen: kbHeight > 100,
        });
      };
      window.addEventListener("resize", onResize);
      return () => window.removeEventListener("resize", onResize);
    }
  }, []);

  return state;
}
