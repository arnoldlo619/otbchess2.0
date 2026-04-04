/**
 * PushOnboardingBanner — Unit tests for visibility and dismissal logic.
 *
 * Tests the pure helper functions exported from PushOnboardingBanner:
 *   - shouldShowPushBanner: all visibility rules
 *   - isPushBannerDismissed: localStorage read
 *   - dismissPushBanner: localStorage write
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  shouldShowPushBanner,
  isPushBannerDismissed,
  dismissPushBanner,
} from "@/components/PushOnboardingBanner";
import type { PushStatus } from "@/hooks/usePushSubscription";

// ─── localStorage mock ────────────────────────────────────────────────────────

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

beforeEach(() => {
  Object.defineProperty(globalThis, "localStorage", {
    value: localStorageMock,
    writable: true,
  });
  localStorageMock.clear();
});

afterEach(() => {
  localStorageMock.clear();
});

// ─── shouldShowPushBanner ─────────────────────────────────────────────────────

describe("shouldShowPushBanner", () => {
  const base = {
    tournamentId: "t-abc123",
    pushStatus: "idle" as PushStatus,
    isDirector: false,
    isInProgress: true,
  };

  it("returns true when all conditions are met", () => {
    expect(shouldShowPushBanner(base)).toBe(true);
  });

  it("returns false when tournament is not in progress", () => {
    expect(shouldShowPushBanner({ ...base, isInProgress: false })).toBe(false);
  });

  it("returns false when user is the director", () => {
    expect(shouldShowPushBanner({ ...base, isDirector: true })).toBe(false);
  });

  it("returns false when already subscribed", () => {
    expect(shouldShowPushBanner({ ...base, pushStatus: "subscribed" })).toBe(false);
  });

  it("returns false when permission is denied", () => {
    expect(shouldShowPushBanner({ ...base, pushStatus: "denied" })).toBe(false);
  });

  it("returns false when browser is unsupported", () => {
    expect(shouldShowPushBanner({ ...base, pushStatus: "unsupported" })).toBe(false);
  });

  it("returns false for the demo tournament", () => {
    expect(shouldShowPushBanner({ ...base, tournamentId: "otb-demo-2026" })).toBe(false);
  });

  it("returns false when banner has been dismissed", () => {
    dismissPushBanner("t-abc123");
    expect(shouldShowPushBanner(base)).toBe(false);
  });

  it("returns true when status is unsubscribed (user can re-subscribe)", () => {
    expect(shouldShowPushBanner({ ...base, pushStatus: "unsubscribed" })).toBe(true);
  });

  it("returns true when status is error (user can retry)", () => {
    expect(shouldShowPushBanner({ ...base, pushStatus: "error" })).toBe(true);
  });

  it("returns true when status is loading (in-flight, not yet subscribed)", () => {
    expect(shouldShowPushBanner({ ...base, pushStatus: "loading" })).toBe(true);
  });

  it("returns false when multiple blocking conditions are true", () => {
    expect(shouldShowPushBanner({
      ...base,
      isDirector: true,
      pushStatus: "subscribed",
      isInProgress: false,
    })).toBe(false);
  });
});

// ─── isPushBannerDismissed ────────────────────────────────────────────────────

describe("isPushBannerDismissed", () => {
  it("returns false when not dismissed", () => {
    expect(isPushBannerDismissed("t-abc123")).toBe(false);
  });

  it("returns true after dismissPushBanner is called", () => {
    dismissPushBanner("t-abc123");
    expect(isPushBannerDismissed("t-abc123")).toBe(true);
  });

  it("is namespaced per tournament ID", () => {
    dismissPushBanner("t-abc123");
    expect(isPushBannerDismissed("t-xyz789")).toBe(false);
  });

  it("returns false for a different tournament even if another is dismissed", () => {
    dismissPushBanner("t-abc123");
    dismissPushBanner("t-def456");
    expect(isPushBannerDismissed("t-ghi789")).toBe(false);
  });

  it("returns true for each dismissed tournament independently", () => {
    dismissPushBanner("t-abc123");
    dismissPushBanner("t-def456");
    expect(isPushBannerDismissed("t-abc123")).toBe(true);
    expect(isPushBannerDismissed("t-def456")).toBe(true);
  });
});

// ─── dismissPushBanner ────────────────────────────────────────────────────────

describe("dismissPushBanner", () => {
  it("stores dismissal in localStorage", () => {
    dismissPushBanner("t-abc123");
    expect(localStorageMock.getItem("otb-push-onboard-dismissed-t-abc123")).toBe("1");
  });

  it("is idempotent — calling twice does not throw", () => {
    expect(() => {
      dismissPushBanner("t-abc123");
      dismissPushBanner("t-abc123");
    }).not.toThrow();
  });

  it("namespaces correctly for different tournaments", () => {
    dismissPushBanner("t-abc123");
    dismissPushBanner("t-xyz789");
    expect(localStorageMock.getItem("otb-push-onboard-dismissed-t-abc123")).toBe("1");
    expect(localStorageMock.getItem("otb-push-onboard-dismissed-t-xyz789")).toBe("1");
  });

  it("does not affect other localStorage keys", () => {
    localStorageMock.setItem("some-other-key", "value");
    dismissPushBanner("t-abc123");
    expect(localStorageMock.getItem("some-other-key")).toBe("value");
  });
});

// ─── Integration: visibility after dismissal ─────────────────────────────────

describe("visibility after dismissal integration", () => {
  it("banner is shown before dismissal, hidden after", () => {
    const args = {
      tournamentId: "t-live-001",
      pushStatus: "idle" as PushStatus,
      isDirector: false,
      isInProgress: true,
    };

    expect(shouldShowPushBanner(args)).toBe(true);
    dismissPushBanner("t-live-001");
    expect(shouldShowPushBanner(args)).toBe(false);
  });

  it("dismissal persists across multiple calls to shouldShowPushBanner", () => {
    const args = {
      tournamentId: "t-live-002",
      pushStatus: "idle" as PushStatus,
      isDirector: false,
      isInProgress: true,
    };

    dismissPushBanner("t-live-002");
    // Call multiple times — should always be false
    expect(shouldShowPushBanner(args)).toBe(false);
    expect(shouldShowPushBanner(args)).toBe(false);
    expect(shouldShowPushBanner(args)).toBe(false);
  });

  it("each tournament has independent dismissal state", () => {
    const t1 = { tournamentId: "t-1", pushStatus: "idle" as PushStatus, isDirector: false, isInProgress: true };
    const t2 = { tournamentId: "t-2", pushStatus: "idle" as PushStatus, isDirector: false, isInProgress: true };

    dismissPushBanner("t-1");
    expect(shouldShowPushBanner(t1)).toBe(false);
    expect(shouldShowPushBanner(t2)).toBe(true); // t-2 not dismissed
  });
});

// ─── Edge cases ───────────────────────────────────────────────────────────────

describe("edge cases", () => {
  it("handles empty string tournament ID gracefully", () => {
    expect(() => shouldShowPushBanner({
      tournamentId: "",
      pushStatus: "idle",
      isDirector: false,
      isInProgress: true,
    })).not.toThrow();
  });

  it("handles very long tournament IDs", () => {
    const longId = "t-" + "x".repeat(200);
    expect(() => {
      dismissPushBanner(longId);
      isPushBannerDismissed(longId);
    }).not.toThrow();
  });

  it("handles localStorage errors gracefully", () => {
    // Simulate localStorage being unavailable
    const originalGetItem = localStorageMock.getItem;
    localStorageMock.getItem = () => { throw new Error("localStorage unavailable"); };

    // Should not throw — returns false as fallback
    expect(() => isPushBannerDismissed("t-abc123")).not.toThrow();
    expect(isPushBannerDismissed("t-abc123")).toBe(false);

    localStorageMock.getItem = originalGetItem;
  });

  it("handles localStorage setItem errors gracefully", () => {
    const originalSetItem = localStorageMock.setItem;
    localStorageMock.setItem = () => { throw new Error("localStorage full"); };

    // Should not throw
    expect(() => dismissPushBanner("t-abc123")).not.toThrow();

    localStorageMock.setItem = originalSetItem;
  });
});
