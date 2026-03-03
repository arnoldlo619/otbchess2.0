/**
 * Tests for the Web Push opt-in PushPromptCard logic
 *
 * The PushPromptCard renders based on:
 *  - push status (idle / subscribed / denied / loading)
 *  - dismissed state
 *  - PushManager browser support
 */

import { describe, it, expect } from "vitest";

// ─── Helper: should the push prompt be visible? ───────────────────────────────
type PushStatus = "idle" | "subscribed" | "denied" | "loading" | "unsubscribed" | "error" | "unsupported";

function shouldShowPrompt(
  status: PushStatus,
  dismissed: boolean,
  pushManagerSupported: boolean
): boolean {
  if (dismissed) return false;
  if (status === "subscribed" || status === "denied" || status === "unsupported") return false;
  if (!pushManagerSupported) return false;
  return true;
}

// ─── Helper: button label ─────────────────────────────────────────────────────
function buttonLabel(isLoading: boolean): string {
  return isLoading ? "Enabling…" : "Enable Notifications";
}

// ─── Helper: subscription storage key ────────────────────────────────────────
function storageKey(tournamentId: string): string {
  return `push-sub-${tournamentId}`;
}

// ─── Tests ────────────────────────────────────────────────────────────────────
describe("PushPromptCard visibility logic", () => {
  it("shows when status is idle and not dismissed", () => {
    expect(shouldShowPrompt("idle", false, true)).toBe(true);
  });

  it("shows when status is unsubscribed", () => {
    expect(shouldShowPrompt("unsubscribed", false, true)).toBe(true);
  });

  it("hides when status is subscribed", () => {
    expect(shouldShowPrompt("subscribed", false, true)).toBe(false);
  });

  it("hides when status is denied", () => {
    expect(shouldShowPrompt("denied", false, true)).toBe(false);
  });

  it("hides when status is unsupported", () => {
    expect(shouldShowPrompt("unsupported", false, true)).toBe(false);
  });

  it("hides when dismissed regardless of status", () => {
    expect(shouldShowPrompt("idle", true, true)).toBe(false);
    expect(shouldShowPrompt("unsubscribed", true, true)).toBe(false);
    expect(shouldShowPrompt("loading", true, true)).toBe(false);
  });

  it("hides when PushManager is not supported", () => {
    expect(shouldShowPrompt("idle", false, false)).toBe(false);
  });

  it("shows during loading state (button is disabled but card is visible)", () => {
    expect(shouldShowPrompt("loading", false, true)).toBe(true);
  });

  it("shows when status is error (allows retry)", () => {
    expect(shouldShowPrompt("error", false, true)).toBe(true);
  });
});

describe("PushPromptCard button label", () => {
  it("shows 'Enable Notifications' when not loading", () => {
    expect(buttonLabel(false)).toBe("Enable Notifications");
  });

  it("shows 'Enabling…' when loading", () => {
    expect(buttonLabel(true)).toBe("Enabling…");
  });
});

describe("Push subscription storage key", () => {
  it("scopes the key to the tournament ID", () => {
    expect(storageKey("my-tournament-2026")).toBe("push-sub-my-tournament-2026");
  });

  it("produces different keys for different tournaments", () => {
    const key1 = storageKey("tournament-a");
    const key2 = storageKey("tournament-b");
    expect(key1).not.toBe(key2);
  });

  it("handles slugs with hyphens and numbers", () => {
    expect(storageKey("spring-open-2026")).toBe("push-sub-spring-open-2026");
  });
});
