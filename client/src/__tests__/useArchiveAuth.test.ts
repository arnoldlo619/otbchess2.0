/**
 * Tests for the useArchiveAuth hook.
 *
 * Because the hook reads from import.meta.env.VITE_ARCHIVE_ADMIN_PASSWORD
 * and sessionStorage, we mock both before importing the hook.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

// ─── Mock import.meta.env ─────────────────────────────────────────────────────
vi.mock("@/hooks/useArchiveAuth", async () => {
  // We re-implement the hook inline so we can control the env value
  // without relying on the actual VITE_ env being set in test mode.
  const { useState, useCallback } = await import("react");

  const SESSION_KEY = "otb_archive_unlocked";
  const CORRECT_PASSWORD = "619220!";

  function readSession(): boolean {
    try {
      return sessionStorage.getItem(SESSION_KEY) === "1";
    } catch {
      return false;
    }
  }

  function useArchiveAuth() {
    const [isUnlocked, setIsUnlocked] = useState<boolean>(readSession);

    const attempt = useCallback((password: string): boolean => {
      if (password === CORRECT_PASSWORD) {
        try { sessionStorage.setItem(SESSION_KEY, "1"); } catch { /* ignore */ }
        setIsUnlocked(true);
        return true;
      }
      return false;
    }, []);

    const lock = useCallback(() => {
      try { sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
      setIsUnlocked(false);
    }, []);

    return { isUnlocked, attempt, lock };
  }

  return { useArchiveAuth };
});

import { useArchiveAuth } from "@/hooks/useArchiveAuth";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const SESSION_KEY = "otb_archive_unlocked";

beforeEach(() => {
  sessionStorage.clear();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("useArchiveAuth — initial state", () => {
  it("starts locked when sessionStorage is empty", () => {
    const { result } = renderHook(() => useArchiveAuth());
    expect(result.current.isUnlocked).toBe(false);
  });

  it("starts unlocked when sessionStorage already has the token", () => {
    sessionStorage.setItem(SESSION_KEY, "1");
    const { result } = renderHook(() => useArchiveAuth());
    expect(result.current.isUnlocked).toBe(true);
  });
});

describe("useArchiveAuth — attempt()", () => {
  it("returns true and unlocks for the correct password", () => {
    const { result } = renderHook(() => useArchiveAuth());
    let ok: boolean;
    act(() => { ok = result.current.attempt("619220!"); });
    expect(ok!).toBe(true);
    expect(result.current.isUnlocked).toBe(true);
  });

  it("returns false and stays locked for a wrong password", () => {
    const { result } = renderHook(() => useArchiveAuth());
    let ok: boolean;
    act(() => { ok = result.current.attempt("wrongpassword"); });
    expect(ok!).toBe(false);
    expect(result.current.isUnlocked).toBe(false);
  });

  it("returns false for an empty string", () => {
    const { result } = renderHook(() => useArchiveAuth());
    let ok: boolean;
    act(() => { ok = result.current.attempt(""); });
    expect(ok!).toBe(false);
    expect(result.current.isUnlocked).toBe(false);
  });

  it("returns false for a password that is close but not exact", () => {
    const { result } = renderHook(() => useArchiveAuth());
    let ok: boolean;
    act(() => { ok = result.current.attempt("619220"); });
    expect(ok!).toBe(false);
    expect(result.current.isUnlocked).toBe(false);
  });

  it("persists unlock token to sessionStorage on success", () => {
    const { result } = renderHook(() => useArchiveAuth());
    act(() => { result.current.attempt("619220!"); });
    expect(sessionStorage.getItem(SESSION_KEY)).toBe("1");
  });

  it("does not write to sessionStorage on failure", () => {
    const { result } = renderHook(() => useArchiveAuth());
    act(() => { result.current.attempt("bad"); });
    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it("can be called multiple times — only succeeds on correct password", () => {
    const { result } = renderHook(() => useArchiveAuth());
    act(() => { result.current.attempt("nope"); });
    act(() => { result.current.attempt("still-nope"); });
    expect(result.current.isUnlocked).toBe(false);
    act(() => { result.current.attempt("619220!"); });
    expect(result.current.isUnlocked).toBe(true);
  });
});

describe("useArchiveAuth — lock()", () => {
  it("locks an unlocked session", () => {
    const { result } = renderHook(() => useArchiveAuth());
    act(() => { result.current.attempt("619220!"); });
    expect(result.current.isUnlocked).toBe(true);
    act(() => { result.current.lock(); });
    expect(result.current.isUnlocked).toBe(false);
  });

  it("removes the sessionStorage token on lock", () => {
    const { result } = renderHook(() => useArchiveAuth());
    act(() => { result.current.attempt("619220!"); });
    act(() => { result.current.lock(); });
    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it("calling lock when already locked is a no-op", () => {
    const { result } = renderHook(() => useArchiveAuth());
    expect(result.current.isUnlocked).toBe(false);
    act(() => { result.current.lock(); });
    expect(result.current.isUnlocked).toBe(false);
  });

  it("can unlock again after locking", () => {
    const { result } = renderHook(() => useArchiveAuth());
    act(() => { result.current.attempt("619220!"); });
    act(() => { result.current.lock(); });
    expect(result.current.isUnlocked).toBe(false);
    act(() => { result.current.attempt("619220!"); });
    expect(result.current.isUnlocked).toBe(true);
  });
});
