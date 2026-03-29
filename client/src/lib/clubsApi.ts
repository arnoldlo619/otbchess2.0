/**
 * clubsApi.ts
 * Client-side service for the /api/clubs server endpoints.
 *
 * All functions are async and return typed results.
 * Falls back gracefully so the app still works if the server is unreachable.
 */

import type { Club, ClubMember } from "./clubRegistry";

const BASE = "/api/clubs";

// ── List all public clubs (Discover page) ─────────────────────────────────────
export async function apiListPublicClubs(opts?: {
  search?: string;
  category?: string;
  limit?: number;
}): Promise<{ clubs: Club[]; total: number }> {
  try {
    const params = new URLSearchParams();
    if (opts?.search) params.set("search", opts.search);
    if (opts?.category && opts.category !== "all")
      params.set("category", opts.category);
    if (opts?.limit) params.set("limit", String(opts.limit));
    const qs = params.toString();
    const res = await fetch(`${BASE}${qs ? `?${qs}` : ""}`);
    if (!res.ok) return { clubs: [], total: 0 };
    const data = await res.json();
    // Handle both old array shape and new { clubs, total } shape
    if (Array.isArray(data)) return { clubs: data as Club[], total: (data as Club[]).length };
    return { clubs: data.clubs ?? [], total: data.total ?? 0 };
  } catch {
    return { clubs: [], total: 0 };
  }
}

// ── List clubs the signed-in user belongs to ──────────────────────────────────
export async function apiListMyClubs(): Promise<Club[]> {
  try {
    const res = await fetch(`${BASE}/mine`, { credentials: "include" });
    if (!res.ok) return [];
    return (await res.json()) as Club[];
  } catch {
    return [];
  }
}

// ── Create a new club ─────────────────────────────────────────────────────────
export async function apiCreateClub(
  club: Partial<Club> & { name: string }
): Promise<Club> {
  const res = await fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(club),
  });
  if (!res.ok) {
    let msg = "Failed to save club to server";
    try {
      const body = await res.json();
      if (body?.error) msg = body.error;
    } catch {}
    throw new Error(msg);
  }
  return (await res.json()) as Club;
}

// ── Sync localStorage clubs to the server (one-time migration) ────────────────
export async function apiSyncClubsToServer(clubs: Club[]): Promise<number> {
  try {
    const res = await fetch(`${BASE}/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ clubs }),
    });
    if (!res.ok) return 0;
    const data = await res.json();
    return data.upserted ?? 0;
  } catch {
    return 0;
  }
}

// ── Get a single club by ID ───────────────────────────────────────────────────
export async function apiGetClub(id: string): Promise<Club | null> {
  try {
    const res = await fetch(`${BASE}/${id}`);
    if (!res.ok) return null;
    return (await res.json()) as Club;
  } catch {
    return null;
  }
}

// ── Update club metadata ──────────────────────────────────────────────────────
export async function apiUpdateClub(
  id: string,
  updates: Partial<Club>
): Promise<Club | null> {
  try {
    const res = await fetch(`${BASE}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(updates),
    });
    if (!res.ok) return null;
    return (await res.json()) as Club;
  } catch {
    return null;
  }
}

// ── List club members ─────────────────────────────────────────────────────────
export async function apiListClubMembers(clubId: string): Promise<ClubMember[]> {
  try {
    const res = await fetch(`${BASE}/${clubId}/members`);
    if (!res.ok) return [];
    return (await res.json()) as ClubMember[];
  } catch {
    return [];
  }
}

// ── Join a club ───────────────────────────────────────────────────────────────
export async function apiJoinClub(
  clubId: string,
  member: {
    displayName: string;
    chesscomUsername?: string | null;
    lichessUsername?: string | null;
    avatarUrl?: string | null;
  }
): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/${clubId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(member),
    });
    return res.ok || res.status === 409; // 409 = already a member, treat as success
  } catch {
    return false;
  }
}

// ── Leave / remove a member ───────────────────────────────────────────────────
export async function apiLeaveClub(
  clubId: string,
  userId: string
): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/${clubId}/members/${userId}`, {
      method: "DELETE",
      credentials: "include",
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ── Send presence heartbeat ──────────────────────────────────────────────────
export async function apiHeartbeat(clubId: string): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/${clubId}/heartbeat`, {
      method: "POST",
      credentials: "include",
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ── Get online member count ───────────────────────────────────────────────────
export async function apiGetPresence(
  clubId: string
): Promise<{ onlineCount: number; totalMembers: number }> {
  try {
    const res = await fetch(`${BASE}/${clubId}/presence`);
    if (!res.ok) return { onlineCount: 0, totalMembers: 0 };
    return await res.json();
  } catch {
    return { onlineCount: 0, totalMembers: 0 };
  }
}

// ── Migrate localStorage clubs to the server (idempotent, one-time) ───────────
const MIGRATION_KEY = "otb-clubs-synced-v1";
export async function migrateLocalClubsToServer(
  userId: string
): Promise<void> {
  try {
    const done = localStorage.getItem(MIGRATION_KEY);
    if (done === userId) return; // already migrated for this user

    const raw = localStorage.getItem("otb-clubs-v1");
    if (!raw) {
      localStorage.setItem(MIGRATION_KEY, userId);
      return;
    }
    const clubs: Club[] = JSON.parse(raw);
    const owned = clubs.filter((c) => c.ownerId === userId);
    if (owned.length > 0) {
      await apiSyncClubsToServer(owned);
    }
    localStorage.setItem(MIGRATION_KEY, userId);
  } catch {
    // Non-fatal — localStorage may not be available in some environments
  }
}
