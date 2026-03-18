/**
 * OTB Chess — Tournament Registry
 * Stores tournament configs created via the wizard in localStorage.
 * Each tournament gets its own storage key so multiple tournaments
 * can coexist on the same device.
 */

export interface TournamentConfig {
  id: string;           // slug used in the URL, e.g. "spring-open-2026"
  inviteCode: string;   // short player join code, e.g. "ABCD1234"
  /** Private director access code, e.g. "DIR-A1B2C3". Never shown to players. */
  directorCode: string;
  name: string;
  venue: string;
  date: string;
  description: string;
  format: "swiss" | "roundrobin" | "elimination";
  rounds: number;
  maxPlayers: number;
  timeBase: number;       // minutes
  timeIncrement: number;  // seconds
  timePreset: string;     // display label, e.g. "10+5"
  ratingSystem: "chess.com" | "lichess" | "fide" | "unrated";
  /** Which chess.com rating category to use for pairings: "rapid" or "blitz". Defaults to "rapid". */
  ratingType?: "rapid" | "blitz";
  createdAt: string;
  /** Authenticated user ID of the director who created this tournament (undefined for anonymous). */
  ownerId?: number | null;
  /** Optional club this tournament is linked to. */
  clubId?: string | null;
  /** Display name of the linked club (denormalised for fast rendering). */
  clubName?: string | null;
}

const REGISTRY_KEY = "otb-tournament-registry-v1";
const DIRECTOR_SESSION_KEY = "otb-director-sessions-v1";

// ── Registry helpers ──────────────────────────────────────────────────────────

function loadRegistry(): TournamentConfig[] {
  try {
    const raw = localStorage.getItem(REGISTRY_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as TournamentConfig[];
  } catch {
    return [];
  }
}

function saveRegistry(configs: TournamentConfig[]): void {
  try {
    localStorage.setItem(REGISTRY_KEY, JSON.stringify(configs));
  } catch {
    // localStorage full — fail silently
  }
}

/** Clear all tournaments from the registry (test helper). */
export function clearRegistry(): void {
  try { localStorage.removeItem(REGISTRY_KEY); } catch { /* ignore */ }
}

/** Save a new tournament config. Returns the saved config. */
export function registerTournament(config: TournamentConfig): TournamentConfig {
  const registry = loadRegistry();
  // Replace if same id already exists (re-creation edge case)
  const filtered = registry.filter((c) => c.id !== config.id);
  saveRegistry([...filtered, config]);
  return config;
}

/** Look up a tournament config by its URL slug id. */
export function getTournamentConfig(id: string): TournamentConfig | null {
  const registry = loadRegistry();
  return registry.find((c) => c.id === id) ?? null;
}

/** Look up a tournament config by its short invite code. */
export function getTournamentByCode(code: string): TournamentConfig | null {
  const registry = loadRegistry();
  return registry.find((c) => c.inviteCode.toUpperCase() === code.toUpperCase()) ?? null;
}

/**
 * Resolve a tournament from either a short invite code or a URL slug.
 * The Join page URL param can be either — this handles both cases.
 */
export function resolveTournament(codeOrSlug: string): TournamentConfig | null {
  const registry = loadRegistry();
  // Try invite code first (short uppercase codes like "ABCD1234")
  const byCode = registry.find((c) => c.inviteCode.toUpperCase() === codeOrSlug.toUpperCase());
  if (byCode) return byCode;
  // Fall back to slug lookup
  return registry.find((c) => c.id === codeOrSlug) ?? null;
}

/**
 * Resolve a tournament by its director code (e.g. "DIR-A1B2C3").
 * Returns null if no matching tournament is found.
 */
export function resolveByDirectorCode(code: string): TournamentConfig | null {
  const registry = loadRegistry();
  return (
    registry.find(
      (c) => c.directorCode.toUpperCase() === code.toUpperCase().trim()
    ) ?? null
  );
}

/** List all tournaments in creation order (newest first). */
export function listTournaments(): TournamentConfig[] {
  return [...loadRegistry()].reverse();
}

/** List all tournaments linked to a specific club (newest first). */
export function listTournamentsByClub(clubId: string): TournamentConfig[] {
  return [...loadRegistry()]
    .filter((c) => c.clubId === clubId)
    .reverse();
}

/**
 * Update specific fields of an existing tournament config.
 * Returns the updated config, or null if the tournament was not found.
 */
export function updateTournamentConfig(
  id: string,
  patch: Partial<Omit<TournamentConfig, "id" | "inviteCode" | "directorCode" | "createdAt">>
): TournamentConfig | null {
  const registry = loadRegistry();
  const idx = registry.findIndex((c) => c.id === id);
  if (idx === -1) return null;
  const updated: TournamentConfig = { ...registry[idx], ...patch };
  registry[idx] = updated;
  saveRegistry(registry);
  return updated;
}

/** Delete a tournament config and its associated director state. */
export function deleteTournament(id: string): void {
  const registry = loadRegistry();
  saveRegistry(registry.filter((c) => c.id !== id));
  // Also remove the director state for this tournament
  const stateKey = `otb-director-state-v2-${id}`;
  localStorage.removeItem(stateKey);
  // Remove any director session for this tournament
  clearDirectorSession(id);
}

/**
 * Generate a URL-safe slug from a tournament name + date.
 * e.g. "Spring Open 2026" → "spring-open-2026"
 */
export function makeSlug(name: string, date: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 40);
  const year = date ? date.slice(0, 4) : new Date().getFullYear().toString();
  // Avoid duplicate year if already in name
  if (base.endsWith(year)) return base;
  return `${base}-${year}`;
}

/**
 * Generate a director code in the format "DIR-XXXXXX" using 6 random
 * alphanumeric characters (uppercase, no ambiguous chars like 0/O, 1/I).
 */
export function generateDirectorCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "DIR-";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// ── Director session helpers ──────────────────────────────────────────────────
// A "director session" is a lightweight localStorage entry that records which
// tournaments the current device has authenticated as director for.
// This is NOT cryptographic security — it is a UX guard to distinguish the
// director's device from player devices in a local-first app.

interface DirectorSession {
  tournamentId: string;
  grantedAt: string; // ISO timestamp
}

function loadSessions(): DirectorSession[] {
  try {
    const raw = localStorage.getItem(DIRECTOR_SESSION_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as DirectorSession[];
  } catch {
    return [];
  }
}

function saveSessions(sessions: DirectorSession[]): void {
  try {
    localStorage.setItem(DIRECTOR_SESSION_KEY, JSON.stringify(sessions));
  } catch { /* ignore */ }
}

/** Grant director access for a tournament on this device. */
export function grantDirectorSession(tournamentId: string): void {
  const sessions = loadSessions().filter((s) => s.tournamentId !== tournamentId);
  sessions.push({ tournamentId, grantedAt: new Date().toISOString() });
  saveSessions(sessions);
}

/** Check whether this device has an active director session for a tournament. */
export function hasDirectorSession(tournamentId: string): boolean {
  return loadSessions().some((s) => s.tournamentId === tournamentId);
}

/** Revoke the director session for a tournament (e.g. on sign-out). */
export function clearDirectorSession(tournamentId: string): void {
  saveSessions(loadSessions().filter((s) => s.tournamentId !== tournamentId));
}
