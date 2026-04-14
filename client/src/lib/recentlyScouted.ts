/**
 * recentlyScouted.ts
 *
 * Persists a rolling list of the last N scouted chess.com usernames in
 * localStorage so users can quickly re-open recent prep reports without
 * retyping usernames.
 *
 * Architecture:
 *   - STORAGE_KEY: single key in localStorage
 *   - MAX_ENTRIES: configurable cap (default 5)
 *   - addRecentlyScouted(username): prepend + deduplicate + trim + persist
 *   - getRecentlyScouted(): read from localStorage, return array
 *   - removeRecentlyScouted(username): remove a single entry
 *   - clearRecentlyScouted(): wipe all entries
 */

const STORAGE_KEY = "otb_recently_scouted";
export const MAX_ENTRIES = 5;

/**
 * Returns the current list of recently scouted usernames (newest first).
 * Returns an empty array if localStorage is unavailable or the key is missing.
 */
export function getRecentlyScouted(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === "string" && v.length > 0);
  } catch {
    return [];
  }
}

/**
 * Prepend `username` to the recently scouted list.
 * Deduplicates (case-insensitive), then trims to MAX_ENTRIES.
 * Persists to localStorage.
 * Returns the updated list.
 */
export function addRecentlyScouted(username: string): string[] {
  const normalised = username.trim().toLowerCase();
  if (!normalised) return getRecentlyScouted();

  const existing = getRecentlyScouted();
  // Remove any existing entry for this username (case-insensitive dedup)
  const filtered = existing.filter((u) => u.toLowerCase() !== normalised);
  // Prepend the new entry (preserve original casing from the input)
  const updated = [username.trim(), ...filtered].slice(0, MAX_ENTRIES);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // localStorage may be full or unavailable — fail silently
  }

  return updated;
}

/**
 * Remove a single username from the recently scouted list.
 * Returns the updated list.
 */
export function removeRecentlyScouted(username: string): string[] {
  const normalised = username.trim().toLowerCase();
  const existing = getRecentlyScouted();
  const updated = existing.filter((u) => u.toLowerCase() !== normalised);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // fail silently
  }

  return updated;
}

/**
 * Wipe the entire recently scouted list.
 */
export function clearRecentlyScouted(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // fail silently
  }
}
