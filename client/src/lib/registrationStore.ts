/**
 * registrationStore — lightweight localStorage helper for tracking
 * tournament registrations on the player's device.
 *
 * Key: "otb_registrations"
 * Value: RegistrationEntry[]
 *
 * Used by the Join page to:
 *  1. Persist a registration on success.
 *  2. Detect a duplicate registration when the player revisits /join/:code.
 */

export interface RegistrationEntry {
  /** Normalised tournament ID (invite code or slug) */
  tournamentId: string;
  /** chess.com / Lichess username, lower-cased */
  username: string;
  /** Display name pulled from the API */
  name: string;
  /** ELO / rating at time of registration */
  rating: number;
  /** Tournament display name */
  tournamentName: string;
  /** ISO timestamp of registration */
  registeredAt: string;
}

const STORAGE_KEY = "otb_registrations";

function readAll(): RegistrationEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(entries: RegistrationEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Storage quota exceeded — silently ignore
  }
}

/**
 * Persist a new registration. If an entry for the same
 * (tournamentId, username) already exists it is updated in-place.
 */
export function saveRegistration(entry: RegistrationEntry): void {
  const entries = readAll();
  const idx = entries.findIndex(
    (e) =>
      e.tournamentId === entry.tournamentId &&
      e.username.toLowerCase() === entry.username.toLowerCase()
  );
  if (idx >= 0) {
    entries[idx] = entry;
  } else {
    entries.push(entry);
  }
  writeAll(entries);
}

/**
 * Return the stored registration for a given tournament + username,
 * or null if not found.
 */
export function getRegistration(
  tournamentId: string,
  username?: string
): RegistrationEntry | null {
  const entries = readAll();
  // If username is provided, match exactly; otherwise return the first entry
  // for this tournament (useful when the code is known but username is not yet entered).
  const match = username
    ? entries.find(
        (e) =>
          e.tournamentId === tournamentId &&
          e.username.toLowerCase() === username.toLowerCase()
      )
    : entries.find((e) => e.tournamentId === tournamentId);
  return match ?? null;
}

/**
 * Remove the registration for a given tournament + username.
 * Used by the "Register again" / "Not me" escape hatch.
 */
export function clearRegistration(
  tournamentId: string,
  username: string
): void {
  const entries = readAll().filter(
    (e) =>
      !(
        e.tournamentId === tournamentId &&
        e.username.toLowerCase() === username.toLowerCase()
      )
  );
  writeAll(entries);
}

/**
 * Remove all registrations older than `maxAgeDays` days.
 * Called on app startup to keep localStorage tidy.
 */
export function pruneOldRegistrations(maxAgeDays = 90): void {
  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
  const entries = readAll().filter(
    (e) => new Date(e.registeredAt).getTime() > cutoff
  );
  writeAll(entries);
}
