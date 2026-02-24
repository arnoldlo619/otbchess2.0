/**
 * OTB Chess — Tournament Registry
 * Stores tournament configs created via the wizard in localStorage.
 * Each tournament gets its own storage key so multiple tournaments
 * can coexist on the same device.
 */

export interface TournamentConfig {
  id: string;           // slug used in the URL, e.g. "spring-open-2026"
  inviteCode: string;   // short join code, e.g. "ABCD1234"
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
  createdAt: string;
}

const REGISTRY_KEY = "otb-tournament-registry-v1";

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

/** List all tournaments in creation order (newest first). */
export function listTournaments(): TournamentConfig[] {
  return [...loadRegistry()].reverse();
}

/** Delete a tournament config and its associated director state. */
export function deleteTournament(id: string): void {
  const registry = loadRegistry();
  saveRegistry(registry.filter((c) => c.id !== id));
  // Also remove the director state for this tournament
  const stateKey = `otb-director-state-v2-${id}`;
  localStorage.removeItem(stateKey);
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
