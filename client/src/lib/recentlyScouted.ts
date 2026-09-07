/**
 * Immutable local history for Matchup Prep reports. Explorer color is optional
 * presentation state; provider, formats, mode, cap, and schema identify data.
 */
import type { Color, Provider, ScoutFormat, ScoutMode } from "../../../shared/prepTypes";

const STORAGE_KEY = "otb_recently_scouted_v3";
export const MAX_ENTRIES = 5;
const VALID_FORMATS = new Set<ScoutFormat>(["rapid", "blitz", "bullet"]);

export interface RecentScoutEntry {
  username: string;
  provider: Provider;
  formats: ScoutFormat[];
  mode: ScoutMode;
  maxGames: 30;
  schemaVersion: string;
  explorerColor?: Color;
  /** ISO timestamp of when this report identity was opened. */
  scoutedAt: string;
}

function formatsFromLegacy(value: Record<string, unknown>): ScoutFormat[] | null {
  if (Array.isArray(value.formats) && value.formats.length > 0 && value.formats.every((format): format is ScoutFormat => typeof format === "string" && VALID_FORMATS.has(format as ScoutFormat))) {
    return Array.from(new Set(value.formats)).sort();
  }
  const legacy = value.tcFilter;
  if (legacy === "rapid" || legacy === "blitz" || legacy === "bullet") return [legacy];
  if (legacy === "all") return ["rapid", "blitz", "bullet"];
  return null;
}

function normalizeEntry(value: unknown): RecentScoutEntry | null {
  if (typeof value !== "object" || value === null) return null;
  const entry = value as Record<string, unknown>;
  if (typeof entry.username !== "string" || !entry.username.trim() || (entry.provider !== "chesscom" && entry.provider !== "lichess")) return null;
  const formats = formatsFromLegacy(entry);
  if (!formats) return null;
  const explorerColor = entry.explorerColor === "black" || entry.myColor === "black" ? "black" : "white";
  return {
    username: entry.username.trim(),
    provider: entry.provider,
    formats,
    mode: "standard",
    maxGames: 30,
    schemaVersion: typeof entry.schemaVersion === "string" && entry.schemaVersion ? entry.schemaVersion : "launch-3",
    explorerColor,
    scoutedAt: typeof entry.scoutedAt === "string" ? entry.scoutedAt : new Date(0).toISOString(),
  };
}

export function getRecentlyScouted(): RecentScoutEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeEntry).filter((entry): entry is RecentScoutEntry => entry !== null);
  } catch {
    return [];
  }
}

function identityKey(entry: Pick<RecentScoutEntry, "username" | "provider" | "formats" | "mode" | "maxGames" | "schemaVersion">): string {
  return [entry.provider, entry.username.trim().toLowerCase(), [...entry.formats].sort().join(","), entry.mode, entry.maxGames, entry.schemaVersion].join(":");
}

export function addRecentlyScouted(entry: Omit<RecentScoutEntry, "scoutedAt">): RecentScoutEntry[] {
  const username = entry.username.trim();
  if (!username) return getRecentlyScouted();
  const newEntry: RecentScoutEntry = { ...entry, username, formats: Array.from(new Set(entry.formats)).sort(), scoutedAt: new Date().toISOString() };
  const updated = [newEntry, ...getRecentlyScouted().filter((current) => identityKey(current) !== identityKey(newEntry))].slice(0, MAX_ENTRIES);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(updated)); } catch { /* local storage is optional */ }
  return updated;
}

export function removeRecentlyScouted(entry: Pick<RecentScoutEntry, "username" | "provider" | "formats" | "mode" | "maxGames" | "schemaVersion">): RecentScoutEntry[] {
  const updated = getRecentlyScouted().filter((current) => identityKey(current) !== identityKey(entry));
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(updated)); } catch { /* local storage is optional */ }
  return updated;
}

export function clearRecentlyScouted(): void {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* local storage is optional */ }
}
