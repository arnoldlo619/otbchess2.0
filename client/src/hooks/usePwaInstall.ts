/**
 * usePwaInstall
 *
 * Handles the full PWA install flow:
 * - Captures the `beforeinstallprompt` event (Android / Chrome)
 * - Detects iOS Safari (no native prompt — must show manual instructions)
 * - Detects standalone mode (already installed — never show banner)
 * - Tracks dismissal in localStorage with a 7-day cooldown
 * - Tracks successful installs so the banner never re-appears post-install
 * - Exposes `triggerForJoin()` so the Join page can surface the prompt
 *   contextually (after the user successfully enters a tournament code)
 */

import { useState, useEffect, useCallback } from "react";

const DISMISS_KEY = "otb_install_dismissed_until";
const INSTALLED_KEY = "otb_pwa_installed";
/** Days before a dismissed banner re-appears */
export const DISMISS_DAYS = 7;

// ─── Pure helpers (exported for testing) ─────────────────────────────────────

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isDismissed(): boolean {
  try {
    const until = localStorage.getItem(DISMISS_KEY);
    if (!until) return false;
    return Date.now() < parseInt(until, 10);
  } catch {
    return false;
  }
}

export function isInstalled(): boolean {
  try {
    return localStorage.getItem(INSTALLED_KEY) === "true";
  } catch {
    return false;
  }
}

export function dismiss(): void {
  try {
    const until = Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000;
    localStorage.setItem(DISMISS_KEY, String(until));
  } catch {
    // localStorage not available — ignore
  }
}

export function clearDismiss(): void {
  try {
    localStorage.removeItem(DISMISS_KEY);
  } catch {
    // ignore
  }
}

export function markInstalled(): void {
  try {
    localStorage.setItem(INSTALLED_KEY, "true");
    localStorage.removeItem(DISMISS_KEY); // clear any cooldown
  } catch {
    // ignore
  }
}

/** True when running on iOS Safari (no beforeinstallprompt support) */
export function isIosSafari(ua = navigator.userAgent): boolean {
  if (typeof navigator === "undefined") return false;
  const isIos = /iphone|ipad|ipod/i.test(ua);
  // Safari on iOS does NOT include "Chrome", "CriOS", or "FxiOS"
  const isSafari = /safari/i.test(ua) && !/chrome|crios|fxios/i.test(ua);
  return isIos && isSafari;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type PwaInstallPlatform = "android" | "ios" | null;

export interface UsePwaInstallReturn {
  /** Whether the banner should be shown */
  showBanner: boolean;
  /** Which platform variant to render */
  platform: PwaInstallPlatform;
  /** Trigger the native install prompt (Android only) */
  promptInstall: () => Promise<void>;
  /** Dismiss the banner and set a 7-day cooldown */
  dismissBanner: () => void;
  /**
   * Call this from the Join page when a user successfully enters a tournament
   * code. On Android it will surface the native prompt if one is pending;
   * on iOS it will show the instruction sheet.
   */
  triggerForJoin: () => void;
  /** Whether a native prompt is ready to be shown (Android only) */
  canPromptNatively: boolean;
}

// ─── Augment global Event type ────────────────────────────────────────────────

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function usePwaInstall(): UsePwaInstallReturn {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [platform, setPlatform] = useState<PwaInstallPlatform>(null);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Never show if already installed as standalone, previously installed, or recently dismissed
    if (isStandalone() || isInstalled() || isDismissed()) return;

    // iOS Safari — no native prompt, show manual instructions
    if (isIosSafari()) {
      setPlatform("ios");
      setShowBanner(true);
      return;
    }

    // Android / Chrome — wait for beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setPlatform("android");
      setShowBanner(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    // If the app gets installed via the browser's own UI, hide the banner
    const installedHandler = () => {
      markInstalled();
      setShowBanner(false);
    };
    window.addEventListener("appinstalled", installedHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<void> => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      markInstalled();
      setShowBanner(false);
    }
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  const dismissBanner = useCallback((): void => {
    dismiss();
    setShowBanner(false);
  }, []);

  /**
   * Contextual trigger: called by the Join page after a successful code entry.
   * On Android — shows the native prompt immediately (if available).
   * On iOS — shows the instruction sheet (handled by InstallBanner internally).
   * No-op if already installed, dismissed, or no prompt is available.
   */
  const triggerForJoin = useCallback((): void => {
    if (isStandalone() || isInstalled() || isDismissed()) return;
    if (platform === "android" && deferredPrompt) {
      promptInstall();
    }
    // iOS: the banner is already visible; triggerForJoin is a no-op
    // (the user can tap "Add" on the persistent banner)
  }, [platform, deferredPrompt, promptInstall]);

  return {
    showBanner,
    platform,
    promptInstall,
    dismissBanner,
    triggerForJoin,
    canPromptNatively: platform === "android" && deferredPrompt !== null,
  };
}
