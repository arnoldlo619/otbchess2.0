/**
 * clubBattleApi.ts
 * Client-side API service for club battles.
 * Wraps the server endpoints at /api/clubs/:clubId/battles.
 *
 * All functions are async and return typed results.
 * The registry (clubBattleRegistry.ts) now delegates to these functions
 * instead of reading/writing localStorage directly.
 */

import type { ClubBattle, BattleResult, BattleLeaderboardEntry, PlayerBattleSummary } from "./clubBattleRegistry";

// ─── API helpers ──────────────────────────────────────────────────────────────

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as Record<string, string>)?.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ─── Row type returned by the server ─────────────────────────────────────────
// Timestamps come back as ISO strings from JSON serialisation.
interface ClubBattleRow {
  id: string;
  clubId: string;
  playerAId: string;
  playerAName: string;
  playerBId: string;
  playerBName: string;
  status: "pending" | "active" | "completed";
  result?: string | null;
  notes?: string | null;
  createdAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
}

function rowToBattle(row: ClubBattleRow): ClubBattle {
  return {
    id: row.id,
    clubId: row.clubId,
    playerAId: row.playerAId,
    playerAName: row.playerAName,
    playerBId: row.playerBId,
    playerBName: row.playerBName,
    status: row.status,
    result: (row.result as BattleResult) ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: typeof row.createdAt === "string" ? row.createdAt : new Date(row.createdAt).toISOString(),
    startedAt: row.startedAt ? (typeof row.startedAt === "string" ? row.startedAt : new Date(row.startedAt).toISOString()) : undefined,
    completedAt: row.completedAt ? (typeof row.completedAt === "string" ? row.completedAt : new Date(row.completedAt).toISOString()) : undefined,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** List all battles for a club (newest first). */
export async function apiBattleList(clubId: string): Promise<ClubBattle[]> {
  const rows = await apiFetch<ClubBattleRow[]>(`/api/clubs/${clubId}/battles`);
  return rows.map(rowToBattle);
}

/** Create a new battle. Returns the created battle. */
export async function apiBattleCreate(
  clubId: string,
  params: {
    id?: string;
    playerAId: string;
    playerAName: string;
    playerBId: string;
    playerBName: string;
    notes?: string;
    createdAt?: string;
  }
): Promise<ClubBattle> {
  const row = await apiFetch<ClubBattleRow>(`/api/clubs/${clubId}/battles`, {
    method: "POST",
    body: JSON.stringify(params),
  });
  return rowToBattle(row);
}

/** Bulk-import battles (localStorage migration). Returns { inserted, skipped }. */
export async function apiBattleBulkImport(
  clubId: string,
  battles: ClubBattle[]
): Promise<{ inserted: number; skipped: number }> {
  return apiFetch<{ inserted: number; skipped: number }>(
    `/api/clubs/${clubId}/battles/bulk`,
    { method: "POST", body: JSON.stringify(battles) }
  );
}

/** Mark a battle as active (started). */
export async function apiBattleStart(clubId: string, battleId: string): Promise<void> {
  await apiFetch(`/api/clubs/${clubId}/battles/${battleId}/start`, { method: "PATCH" });
}

/** Record the final result of a battle. */
export async function apiBattleRecordResult(
  clubId: string,
  battleId: string,
  result: BattleResult
): Promise<void> {
  await apiFetch(`/api/clubs/${clubId}/battles/${battleId}/result`, {
    method: "PATCH",
    body: JSON.stringify({ result }),
  });
}

/** Delete a battle. */
export async function apiBattleDelete(clubId: string, battleId: string): Promise<void> {
  await apiFetch(`/api/clubs/${clubId}/battles/${battleId}`, { method: "DELETE" });
}

/** Get all-time W/D/L summary for a player in a club. */
export async function apiBattlePlayerStats(
  clubId: string,
  playerId: string
): Promise<PlayerBattleSummary & { playerId: string }> {
  return apiFetch(`/api/clubs/${clubId}/battles/stats/${encodeURIComponent(playerId)}`);
}

/** Get the ranked battle leaderboard for a club. */
export async function apiBattleLeaderboard(clubId: string): Promise<BattleLeaderboardEntry[]> {
  return apiFetch(`/api/clubs/${clubId}/battles/leaderboard`);
}

// ─── localStorage migration ───────────────────────────────────────────────────
// On first load, flush any battles stored in localStorage to the server.
// Marks each club as migrated so we don't re-import on subsequent loads.

const MIGRATION_KEY_PREFIX = "otb_battles_migrated_";

function migrationKey(clubId: string): string {
  return `${MIGRATION_KEY_PREFIX}${clubId}`;
}

function localStorageBattleKey(clubId: string): string {
  return `otb_battles_${clubId}`;
}

/**
 * Migrate localStorage battles for a given club to the server.
 * Safe to call multiple times — skips if already migrated.
 * Returns the number of battles migrated.
 */
export async function migrateLocalBattlesToServer(clubId: string): Promise<number> {
  // Already migrated?
  if (localStorage.getItem(migrationKey(clubId)) === "1") return 0;

  const raw = localStorage.getItem(localStorageBattleKey(clubId));
  if (!raw) {
    // Nothing to migrate — mark as done
    localStorage.setItem(migrationKey(clubId), "1");
    return 0;
  }

  let battles: ClubBattle[];
  try {
    battles = JSON.parse(raw) as ClubBattle[];
  } catch {
    localStorage.setItem(migrationKey(clubId), "1");
    return 0;
  }

  if (battles.length === 0) {
    localStorage.setItem(migrationKey(clubId), "1");
    return 0;
  }

  try {
    const { inserted } = await apiBattleBulkImport(clubId, battles);
    localStorage.setItem(migrationKey(clubId), "1");
    console.log(`[battle-migration] Migrated ${inserted} battles for club ${clubId}`);
    return inserted;
  } catch (err) {
    console.warn("[battle-migration] Failed to migrate battles:", err);
    return 0;
  }
}
