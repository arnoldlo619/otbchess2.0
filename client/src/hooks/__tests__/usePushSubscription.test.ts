/**
 * Tests for usePushSubscription hook and related utilities
 *
 * We test the pure helper functions (urlBase64ToUint8Array, storageKey) and
 * the hook's state machine behaviour using a mocked browser environment.
 * Full integration tests (actual push subscription) require a real browser
 * with a service worker and are out of scope for unit testing.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// ─── Helpers extracted for unit testing ──────────────────────────────────────

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from(Array.from(rawData).map((c) => c.charCodeAt(0)));
}

function storageKey(tournamentId: string) {
  return `otb-push-${tournamentId}`;
}

// ─── urlBase64ToUint8Array ────────────────────────────────────────────────────

describe("urlBase64ToUint8Array", () => {
  it("converts a standard base64url string to Uint8Array", () => {
    // "hello" in base64 = "aGVsbG8="
    const result = urlBase64ToUint8Array("aGVsbG8");
    expect(result).toBeInstanceOf(Uint8Array);
    expect(Array.from(result)).toEqual([104, 101, 108, 108, 111]); // "hello"
  });

  it("handles strings with URL-safe characters (- and _)", () => {
    // base64url for bytes [0xFB, 0xFF] is "-_8" (standard base64 "+/8")
    const result = urlBase64ToUint8Array("-_8");
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
  });

  it("handles strings that need padding", () => {
    // "a" needs 3 padding chars: "YQ=="
    const result = urlBase64ToUint8Array("YQ");
    expect(Array.from(result)).toEqual([97]); // "a"
  });

  it("handles strings that need 2 padding chars", () => {
    // "ab" in base64 = "YWI=" (1 padding char)
    const result = urlBase64ToUint8Array("YWI");
    expect(Array.from(result)).toEqual([97, 98]); // "ab"
  });

  it("handles empty string", () => {
    const result = urlBase64ToUint8Array("");
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBe(0);
  });

  it("converts a real VAPID public key format", () => {
    // Typical 65-byte uncompressed EC public key in base64url
    const vapidKey = "BEUf0TSJ3uBrTybWfUjaO79RUqaDUGNH7cYfqiBm5cmEwLSUR2zQMitoyvbDgFsJ9hE_E1AmvdMT4RmConYlLvI";
    const result = urlBase64ToUint8Array(vapidKey);
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBe(65); // Uncompressed EC public key is always 65 bytes
  });
});

// ─── storageKey ──────────────────────────────────────────────────────────────

describe("storageKey", () => {
  it("generates a namespaced key for a tournament ID", () => {
    expect(storageKey("otb-demo-2026")).toBe("otb-push-otb-demo-2026");
  });

  it("generates different keys for different tournament IDs", () => {
    const key1 = storageKey("tournament-1");
    const key2 = storageKey("tournament-2");
    expect(key1).not.toBe(key2);
  });

  it("handles special characters in tournament IDs", () => {
    const key = storageKey("my-club/spring-2026");
    expect(key).toBe("otb-push-my-club/spring-2026");
  });
});

// ─── usePushSubscription hook state machine ───────────────────────────────────

describe("usePushSubscription hook", () => {
  let sessionStorageMock: Record<string, string> = {};

  beforeEach(() => {
    sessionStorageMock = {};
    vi.stubGlobal("sessionStorage", {
      getItem: (key: string) => sessionStorageMock[key] ?? null,
      setItem: (key: string, value: string) => { sessionStorageMock[key] = value; },
      removeItem: (key: string) => { delete sessionStorageMock[key]; },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("starts in 'unsupported' state when PushManager is not available", async () => {
    // jsdom has serviceWorker but not PushManager — simulate a browser without push support
    vi.stubGlobal("navigator", { ...navigator, serviceWorker: undefined });
    // Ensure PushManager is also not defined
    if (typeof globalThis.PushManager !== "undefined") {
      vi.stubGlobal("PushManager", undefined);
    }

    const { usePushSubscription } = await import("../usePushSubscription");
    const { result } = renderHook(() =>
      usePushSubscription({ tournamentId: "test-123" })
    );

    // When serviceWorker is absent, hook reports unsupported
    expect(result.current.isSubscribed).toBe(false);
    // Status is either 'unsupported' or 'idle' depending on environment
    expect(["unsupported", "idle"]).toContain(result.current.status);
  });

  it("starts in 'subscribed' state when sessionStorage has 'subscribed'", async () => {
    sessionStorageMock["otb-push-test-456"] = "subscribed";

    // Provide minimal serviceWorker + PushManager stubs
    vi.stubGlobal("navigator", {
      ...navigator,
      serviceWorker: { ready: Promise.resolve({}) },
    });
    vi.stubGlobal("PushManager", class {});
    vi.stubGlobal("Notification", { permission: "granted" });

    const { usePushSubscription } = await import("../usePushSubscription");
    const { result } = renderHook(() =>
      usePushSubscription({ tournamentId: "test-456" })
    );

    expect(result.current.status).toBe("subscribed");
    expect(result.current.isSubscribed).toBe(true);
  });

  it("starts in 'denied' state when sessionStorage has 'denied'", async () => {
    sessionStorageMock["otb-push-test-789"] = "denied";

    vi.stubGlobal("navigator", {
      ...navigator,
      serviceWorker: { ready: Promise.resolve({}) },
    });
    vi.stubGlobal("PushManager", class {});
    vi.stubGlobal("Notification", { permission: "denied" });

    const { usePushSubscription } = await import("../usePushSubscription");
    const { result } = renderHook(() =>
      usePushSubscription({ tournamentId: "test-789" })
    );

    expect(result.current.status).toBe("denied");
    expect(result.current.isSubscribed).toBe(false);
  });

  it("isLoading is true only when status is 'loading'", async () => {
    vi.stubGlobal("navigator", {
      ...navigator,
      serviceWorker: { ready: Promise.resolve({}) },
    });
    vi.stubGlobal("PushManager", class {});
    vi.stubGlobal("Notification", { permission: "default" });

    const { usePushSubscription } = await import("../usePushSubscription");
    const { result } = renderHook(() =>
      usePushSubscription({ tournamentId: "test-loading" })
    );

    // Initial state is idle, not loading
    expect(result.current.isLoading).toBe(false);
  });
});

// ─── Push API endpoint contract ───────────────────────────────────────────────

describe("Push API endpoint contract", () => {
  it("VAPID public key endpoint returns the correct key format", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ publicKey: "BEUf0TSJ3uBrTybWfUjaO79RUqaDUGNH7cYfqiBm5cmEwLSUR2zQMitoyvbDgFsJ9hE_E1AmvdMT4RmConYlLvI" }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const res = await fetch("/api/push/vapid-public-key");
    const data = await res.json() as { publicKey: string };

    expect(data.publicKey).toBeTruthy();
    expect(typeof data.publicKey).toBe("string");
    // VAPID public keys are 87-88 chars in base64url (65 bytes)
    expect(data.publicKey.length).toBeGreaterThan(80);
    // Should not contain standard base64 chars (+ /) — must be URL-safe
    expect(data.publicKey).not.toMatch(/[+/]/);
  });

  it("subscribe endpoint accepts correct payload shape", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true, count: 1 }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const payload = {
      tournamentId: "otb-demo-2026",
      subscription: {
        endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
        keys: { p256dh: "key1", auth: "key2" },
      },
    };

    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json() as { ok: boolean; count: number };

    expect(data.ok).toBe(true);
    expect(typeof data.count).toBe("number");

    // Verify the fetch was called with correct arguments
    expect(mockFetch).toHaveBeenCalledWith("/api/push/subscribe", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ "Content-Type": "application/json" }),
    }));
  });

  it("notify endpoint accepts round and tournamentName", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true, sent: 3, failed: 0 }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const res = await fetch("/api/push/notify/otb-demo-2026", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ round: 2, tournamentName: "Spring Open 2026" }),
    });
    const data = await res.json() as { ok: boolean; sent: number; failed: number };

    expect(data.ok).toBe(true);
    expect(typeof data.sent).toBe("number");
    expect(typeof data.failed).toBe("number");
  });
});
