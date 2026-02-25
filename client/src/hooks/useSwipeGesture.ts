import { useEffect, useRef } from "react";

export interface SwipeGestureOptions {
  /** Minimum horizontal distance (px) to register as a swipe. Default: 60 */
  threshold?: number;
  /** Maximum vertical drift (px) allowed before the gesture is cancelled. Default: 80 */
  maxVerticalDrift?: number;
  /** Called when the user swipes left (next) */
  onSwipeLeft?: () => void;
  /** Called when the user swipes right (back) */
  onSwipeRight?: () => void;
  /** When true the hook does nothing (e.g. on desktop). Default: false */
  disabled?: boolean;
}

/**
 * useSwipeGesture
 *
 * Attaches touchstart / touchmove / touchend listeners to the given container
 * ref and fires onSwipeLeft / onSwipeRight when a qualifying horizontal swipe
 * is detected.
 *
 * Cancellation rules:
 *  - Vertical drift > maxVerticalDrift → cancel (user is scrolling)
 *  - Touch started on an <input>, <textarea>, or <select> → cancel (user is
 *    interacting with a form field)
 *  - Horizontal distance < threshold → cancel (too short to be intentional)
 */
export function useSwipeGesture(
  containerRef: React.RefObject<HTMLElement | null>,
  options: SwipeGestureOptions = {}
) {
  const {
    threshold = 60,
    maxVerticalDrift = 80,
    onSwipeLeft,
    onSwipeRight,
    disabled = false,
  } = options;

  // Keep callbacks in a ref so the effect doesn't need to re-run when they change
  const callbacksRef = useRef({ onSwipeLeft, onSwipeRight });
  useEffect(() => {
    callbacksRef.current = { onSwipeLeft, onSwipeRight };
  }, [onSwipeLeft, onSwipeRight]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || disabled) return;

    let startX = 0;
    let startY = 0;
    let cancelled = false;

    const onTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      cancelled = false;

      // Cancel if the touch started on a form element
      const target = e.target as Element;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target.closest("input, textarea, select")
      ) {
        cancelled = true;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (cancelled) return;
      const touch = e.touches[0];
      const dy = Math.abs(touch.clientY - startY);
      if (dy > maxVerticalDrift) {
        cancelled = true;
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (cancelled) return;
      const touch = e.changedTouches[0];
      const dx = touch.clientX - startX;
      const dy = Math.abs(touch.clientY - startY);

      if (Math.abs(dx) < threshold || dy > maxVerticalDrift) return;

      if (dx < 0) {
        // Swipe left → next step
        callbacksRef.current.onSwipeLeft?.();
      } else {
        // Swipe right → previous step
        callbacksRef.current.onSwipeRight?.();
      }
    };

    container.addEventListener("touchstart", onTouchStart, { passive: true });
    container.addEventListener("touchmove", onTouchMove, { passive: true });
    container.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      container.removeEventListener("touchstart", onTouchStart);
      container.removeEventListener("touchmove", onTouchMove);
      container.removeEventListener("touchend", onTouchEnd);
    };
  }, [containerRef, threshold, maxVerticalDrift, disabled]);
}
