/**
 * useLnmSave
 *
 * Manages PGN persistence for Live Notation Mode (LNM).
 *
 * Responsibilities:
 * 1. **Auto-save** — debounced 30-second timer fires whenever `pgn` changes
 *    while LNM is active. Writes to sessionStorage immediately (zero-latency
 *    crash recovery) and then POSTs to the server.
 * 2. **Manual save** — `save()` flushes immediately, bypassing the debounce.
 * 3. **Save & Exit** — `saveAndExit()` saves then calls the provided `onExit`
 *    callback, returning the final PGN.
 * 4. **Status** — exposes `status` ("idle" | "saving" | "saved" | "error") and
 *    `lastSavedAt` (Date | null) so the UI can show a cloud indicator.
 * 5. **Draft recovery** — `getDraftPgn(battleCode)` is a static helper that
 *    reads the sessionStorage draft so Battle.tsx can offer a recovery banner.
 */

import { useState, useEffect, useRef, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type LnmSaveStatus = "idle" | "saving" | "saved" | "error";

export interface UseLnmSaveReturn {
  /** Current save status */
  status: LnmSaveStatus;
  /** Timestamp of the last successful server save */
  lastSavedAt: Date | null;
  /** Error message from the last failed save attempt */
  saveError: string | null;
  /** Manually trigger an immediate save to server + sessionStorage */
  save: () => Promise<void>;
  /** Save immediately then call onExit with the current PGN */
  saveAndExit: () => Promise<void>;
  /** Clear the saved/error status back to idle */
  resetStatus: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const AUTO_SAVE_DEBOUNCE_MS = 30_000; // 30 seconds
const DRAFT_KEY_PREFIX = "lnm_draft_";
const DRAFT_TIMESTAMP_PREFIX = "lnm_draft_ts_";

// ─── Static helpers (no React) ────────────────────────────────────────────────

/** Read a draft PGN from sessionStorage for a given battle code. */
export function getDraftPgn(battleCode: string): string | null {
  try {
    return sessionStorage.getItem(DRAFT_KEY_PREFIX + battleCode.toUpperCase()) ?? null;
  } catch {
    return null;
  }
}

/** Read the timestamp of the last draft save. */
export function getDraftTimestamp(battleCode: string): Date | null {
  try {
    const ts = sessionStorage.getItem(DRAFT_TIMESTAMP_PREFIX + battleCode.toUpperCase());
    return ts ? new Date(ts) : null;
  } catch {
    return null;
  }
}

/** Clear the draft for a given battle code (call after analysis or deliberate discard). */
export function clearDraftPgn(battleCode: string): void {
  try {
    sessionStorage.removeItem(DRAFT_KEY_PREFIX + battleCode.toUpperCase());
    sessionStorage.removeItem(DRAFT_TIMESTAMP_PREFIX + battleCode.toUpperCase());
  } catch {
    // ignore
  }
}

/** Write a draft PGN to sessionStorage. */
function writeDraft(battleCode: string, pgn: string): void {
  try {
    sessionStorage.setItem(DRAFT_KEY_PREFIX + battleCode.toUpperCase(), pgn);
    sessionStorage.setItem(DRAFT_TIMESTAMP_PREFIX + battleCode.toUpperCase(), new Date().toISOString());
  } catch {
    // Quota exceeded or private browsing — silently ignore
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

interface UseLnmSaveOptions {
  /** The battle room code (used for the API endpoint and sessionStorage key) */
  battleCode: string;
  /** Current PGN string from useNotationMode */
  pgn: string;
  /** Whether LNM is currently active (auto-save only runs when true) */
  active: boolean;
  /** Called after saveAndExit completes; receives the saved PGN */
  onExit: (pgn: string | null) => void;
}

export function useLnmSave({
  battleCode,
  pgn,
  active,
  onExit,
}: UseLnmSaveOptions): UseLnmSaveReturn {
  const [status, setStatus] = useState<LnmSaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Refs to avoid stale closures in debounce/interval callbacks
  const pgnRef = useRef(pgn);
  const activeRef = useRef(active);
  const battleCodeRef = useRef(battleCode);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSavingRef = useRef(false);

  // Keep refs in sync
  useEffect(() => { pgnRef.current = pgn; }, [pgn]);
  useEffect(() => { activeRef.current = active; }, [active]);
  useEffect(() => { battleCodeRef.current = battleCode; }, [battleCode]);

  // ── Core save function ────────────────────────────────────────────────────

  const saveToServer = useCallback(async (pgnToSave: string): Promise<void> => {
    if (!pgnToSave || !battleCodeRef.current || isSavingRef.current) return;
    isSavingRef.current = true;
    setStatus("saving");
    setSaveError(null);

    // Always write to sessionStorage first (instant crash recovery)
    writeDraft(battleCodeRef.current, pgnToSave);

    try {
      const res = await fetch(`/api/battles/${battleCodeRef.current}/pgn`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ pgn: pgnToSave }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      setStatus("saved");
      setLastSavedAt(new Date());
      // Reset to idle after 3 seconds so the indicator fades
      setTimeout(() => setStatus((s) => (s === "saved" ? "idle" : s)), 3000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Save failed";
      setSaveError(msg);
      setStatus("error");
    } finally {
      isSavingRef.current = false;
    }
  }, []);

  // ── Auto-save: debounced 30s after each PGN change ────────────────────────

  useEffect(() => {
    // Only auto-save when LNM is active and there is something to save
    if (!active || !pgn) return;

    // Write to sessionStorage immediately on every change (crash safety)
    writeDraft(battleCode, pgn);

    // Debounce the server call
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      if (activeRef.current && pgnRef.current) {
        saveToServer(pgnRef.current);
      }
    }, AUTO_SAVE_DEBOUNCE_MS);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [pgn, active, battleCode, saveToServer]);

  // ── Cleanup on unmount ────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  // ── Public API ────────────────────────────────────────────────────────────

  const save = useCallback(async (): Promise<void> => {
    // Cancel pending debounce and save immediately
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    await saveToServer(pgnRef.current);
  }, [saveToServer]);

  const saveAndExit = useCallback(async (): Promise<void> => {
    const currentPgn = pgnRef.current;
    await save();
    onExit(currentPgn || null);
  }, [save, onExit]);

  const resetStatus = useCallback(() => {
    setStatus("idle");
    setSaveError(null);
  }, []);

  return { status, lastSavedAt, saveError, save, saveAndExit, resetStatus };
}
