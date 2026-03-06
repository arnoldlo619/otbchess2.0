/**
 * useArchiveAuth — session-based password gate for the Archive page.
 *
 * The correct password is read from the VITE_ARCHIVE_ADMIN_PASSWORD env var.
 * On a correct attempt the hook stores a flag in sessionStorage so the user
 * stays unlocked for the duration of the browser session (clears on tab close).
 *
 * Exported helpers:
 *   isUnlocked  — whether the archive is currently accessible
 *   attempt(pw) — try a password; returns true if correct, false otherwise
 *   lock()      — manually revoke access (e.g. a "Lock" button for the admin)
 */

import { useState, useCallback } from "react";

const SESSION_KEY = "otb_archive_unlocked";
const CORRECT_PASSWORD = import.meta.env.VITE_ARCHIVE_ADMIN_PASSWORD as string | undefined;

function readSession(): boolean {
  try {
    return sessionStorage.getItem(SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

export function useArchiveAuth() {
  const [isUnlocked, setIsUnlocked] = useState<boolean>(readSession);

  const attempt = useCallback((password: string): boolean => {
    if (!CORRECT_PASSWORD) {
      // No password configured — deny access
      return false;
    }
    if (password === CORRECT_PASSWORD) {
      try {
        sessionStorage.setItem(SESSION_KEY, "1");
      } catch {
        // sessionStorage unavailable — still grant in-memory access
      }
      setIsUnlocked(true);
      return true;
    }
    return false;
  }, []);

  const lock = useCallback(() => {
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      // ignore
    }
    setIsUnlocked(false);
  }, []);

  return { isUnlocked, attempt, lock };
}
