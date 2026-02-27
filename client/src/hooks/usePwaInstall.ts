/**
 * usePwaInstall
 *
 * Handles the full PWA install flow:
 * - Captures the `beforeinstallprompt` event (Android / Chrome)
 * - Detects iOS Safari (no native prompt — must show manual instructions)
 * - Detects standalone mode (already installed — never show banner)
 * - Tracks dismissal in localStorage with a 14-day cooldown
 */

import { useState, useEffect } from "react";

const DISMISS_KEY = "otb_install_dismissed_until";
const DISMISS_DAYS = 14;

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari sets this when launched from home screen
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isDismissed(): boolean {
  try {
    const until = localStorage.getItem(DISMISS_KEY);
    if (!until) return false;
    return Date.now() < parseInt(until, 10);
  } catch {
    return false;
  }
}

function dismiss(): void {
  try {
    const until = Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000;
    localStorage.setItem(DISMISS_KEY, String(until));
  } catch {
    // localStorage not available — ignore
  }
}

function clearDismiss(): void {
  try {
    localStorage.removeItem(DISMISS_KEY);
  } catch {
    // ignore
  }
}

/** True when running on iOS Safari (no beforeinstallprompt support) */
function isIosSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isIos = /iphone|ipad|ipod/i.test(ua);
  // Safari on iOS does NOT include "Chrome" or "CriOS" or "FxiOS"
  const isSafari = /safari/i.test(ua) && !/chrome|crios|fxios/i.test(ua);
  return isIos && isSafari;
}

export type PwaInstallPlatform = "android" | "ios" | null;

export interface UsePwaInstallReturn {
  /** Whether the banner should be shown */
  showBanner: boolean;
  /** Which platform variant to render */
  platform: PwaInstallPlatform;
  /** Trigger the native install prompt (Android only) */
  promptInstall: () => Promise<void>;
  /** Dismiss the banner and set a 14-day cooldown */
  dismissBanner: () => void;
}

export function usePwaInstall(): UsePwaInstallReturn {
  const [deferredPrompt, setDeferredPrompt] = useState<Event | null>(null);
  const [platform, setPlatform] = useState<PwaInstallPlatform>(null);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Never show if already installed or recently dismissed
    if (isStandalone() || isDismissed()) return;

    // iOS Safari — no native prompt, show manual instructions
    if (isIosSafari()) {
      setPlatform("ios");
      setShowBanner(true);
      return;
    }

    // Android / Chrome — wait for beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setPlatform("android");
      setShowBanner(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    // If the app gets installed, hide the banner
    const installedHandler = () => setShowBanner(false);
    window.addEventListener("appinstalled", installedHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  const promptInstall = async (): Promise<void> => {
    if (!deferredPrompt) return;
    const prompt = deferredPrompt as BeforeInstallPromptEvent;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") {
      setShowBanner(false);
      clearDismiss();
    }
    setDeferredPrompt(null);
  };

  const dismissBanner = (): void => {
    dismiss();
    setShowBanner(false);
  };

  return { showBanner, platform, promptInstall, dismissBanner };
}

// Augment the global Event type for TypeScript
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
