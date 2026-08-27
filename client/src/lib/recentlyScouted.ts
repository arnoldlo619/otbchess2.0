 /**
 * recentlyScouted.ts — Composite recent-history model for Matchup Prep.
 *
 * Each entry stores not just the username but also the platform, color perspective,
 * and filter settings — so restoring a recent report restores the exact context.
 *
 * Storage: `otb_recently_scouted_v3` invalidates legacy depth and incomplete identity entries.
 */

const STORAGE_KEY = "otb_recently_scouted_v3";
export const MAX_ENTRIES = 5;

 export interface RecentScoutEntry {
   username: string;
   provider: "chesscom" | "lichess";
   myColor: "white" | "black";
   tcFilter: "all" | "rapid" | "blitz" | "bullet";
   /** ISO timestamp of when this entry was added */
   scoutedAt: string;
 }

 export function getRecentlyScouted(): RecentScoutEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (v): v is RecentScoutEntry =>
        typeof v === "object" && v !== null &&
        typeof v.username === "string" && v.username.length > 0 &&
        typeof v.provider === "string" &&
        typeof v.myColor === "string"
    );
  } catch {
    return [];
  }
}

 export function addRecentlyScouted(entry: Omit<RecentScoutEntry, "scoutedAt">): RecentScoutEntry[] {
   const normalised = entry.username.trim().toLowerCase();
   if (!normalised) return getRecentlyScouted();
   const existing = getRecentlyScouted();
   // Deduplicate by username+provider (case-insensitive)
   const filtered = existing.filter(
     (e) => !(e.username.toLowerCase() === normalised && e.provider === entry.provider)
   );
   const newEntry: RecentScoutEntry = { ...entry, username: entry.username.trim(), scoutedAt: new Date().toISOString() };
   const updated = [newEntry, ...filtered].slice(0, MAX_ENTRIES);
   try {
     localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
   } catch {
     // localStorage may be full — fail silently
   }
   return updated;
}

 export function removeRecentlyScouted(username: string, provider?: string): RecentScoutEntry[] {
   const normalised = username.trim().toLowerCase();
   const existing = getRecentlyScouted();
   const updated = existing.filter(
     (e) => !(e.username.toLowerCase() === normalised && (!provider || e.provider === provider))
   );
   try {
     localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
   } catch {
     // fail silently
   }
   return updated;
}

 export function clearRecentlyScouted(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // fail silently
  }
}
