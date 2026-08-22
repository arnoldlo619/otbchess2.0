import { type RefObject, useEffect, useRef } from "react";

const overlayStack: symbol[] = [];

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'summary',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function visibleFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((element) => {
    if (element.tabIndex < 0 || element.closest('[inert], [aria-hidden="true"]')) return false;
    const styles = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return styles.display !== "none" && styles.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
  });
}

interface AccessibleOverlayOptions {
  open: boolean;
  onClose: () => void;
  containerRef: RefObject<HTMLElement | null>;
  initialFocusRef?: RefObject<HTMLElement | null>;
}

/**
 * Adds the keyboard behavior required by custom modal surfaces that cannot use
 * the shared Radix Dialog primitive without a visual or structural rewrite.
 */
export function useAccessibleOverlay({
  open,
  onClose,
  containerRef,
  initialFocusRef,
}: AccessibleOverlayOptions): void {
  const tokenRef = useRef(Symbol("accessible-overlay"));
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;

    const token = tokenRef.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    overlayStack.push(token);

    const focusInitialControl = () => {
      const container = containerRef.current;
      if (!container) return;
      const target = initialFocusRef?.current ?? visibleFocusableElements(container)[0] ?? container;
      target.focus({ preventScroll: true });
    };

    const frameId = window.requestAnimationFrame(focusInitialControl);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (overlayStack.at(-1) !== token) return;

      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab") return;
      const container = containerRef.current;
      if (!container) return;
      const focusable = visibleFocusableElements(container);
      if (focusable.length === 0) {
        event.preventDefault();
        container.focus({ preventScroll: true });
        return;
      }

      const active = document.activeElement;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (active === first || !container.contains(active))) {
        event.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!event.shiftKey && (active === last || !container.contains(active))) {
        event.preventDefault();
        first.focus({ preventScroll: true });
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.cancelAnimationFrame(frameId);
      document.removeEventListener("keydown", handleKeyDown, true);
      const wasTopOverlay = overlayStack.at(-1) === token;
      const stackIndex = overlayStack.lastIndexOf(token);
      if (stackIndex >= 0) overlayStack.splice(stackIndex, 1);
      if (wasTopOverlay && opener?.isConnected) {
        window.requestAnimationFrame(() => opener.focus({ preventScroll: true }));
      }
    };
  }, [containerRef, initialFocusRef, open]);
}
