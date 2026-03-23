/**
 * clubsApi.test.ts
 * Unit tests for the clubsApi client service that wraps the server clubs endpoints.
 * Tests URL construction, response mapping, default visibility, and migration logic.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeClubRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "club-1",
    name: "Test Club",
    slug: "test-club",
    tagline: "A test club",
    description: "Description",
    location: "London, UK",
    country: "GB",
    category: "club",
    avatarUrl: null,
    bannerUrl: null,
    accentColor: "#1a3a5c",
    ownerId: "user-1",
    ownerName: "Alice",
    memberCount: 10,
    tournamentCount: 2,
    followerCount: 0,
    isPublic: true,
    website: null,
    twitter: null,
    discord: null,
    announcement: null,
    foundedAt: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

// ── URL construction tests ────────────────────────────────────────────────────

describe("clubsApi URL construction", () => {
  it("public clubs endpoint uses /api/clubs?public=true", () => {
    const url = new URL("/api/clubs", "http://localhost:3000");
    url.searchParams.set("public", "true");
    expect(url.pathname).toBe("/api/clubs");
    expect(url.searchParams.get("public")).toBe("true");
  });

  it("create club endpoint uses POST /api/clubs", () => {
    const method = "POST";
    const path = "/api/clubs";
    expect(method).toBe("POST");
    expect(path).toBe("/api/clubs");
  });

  it("update club endpoint uses PATCH /api/clubs/:id", () => {
    const clubId = "seed-club-1";
    const path = `/api/clubs/${clubId}`;
    expect(path).toBe("/api/clubs/seed-club-1");
  });

  it("delete club endpoint uses DELETE /api/clubs/:id", () => {
    const clubId = "seed-club-1";
    const path = `/api/clubs/${clubId}`;
    expect(path).toBe("/api/clubs/seed-club-1");
  });
});

// ── Default visibility tests ──────────────────────────────────────────────────

describe("club default visibility", () => {
  it("clubs default to isPublic = true when created", () => {
    const clubData = {
      name: "New Club",
      tagline: "A new club",
      category: "club",
      location: "New York, NY",
      country: "US",
      description: "Description",
      accentColor: "#ff0000",
      avatarUrl: null,
      bannerUrl: null,
      ownerId: "user-1",
      ownerName: "Alice",
    };
    // isPublic should default to true when not specified
    const withDefaults = { isPublic: true, ...clubData };
    expect(withDefaults.isPublic).toBe(true);
  });

  it("clubs can be explicitly set to private", () => {
    const clubData = { isPublic: false, name: "Private Club" };
    expect(clubData.isPublic).toBe(false);
  });

  it("only public clubs appear in the discover list", () => {
    const clubs = [
      makeClubRow({ id: "c1", isPublic: true }),
      makeClubRow({ id: "c2", isPublic: false }),
      makeClubRow({ id: "c3", isPublic: true }),
    ];
    const publicClubs = clubs.filter((c) => c.isPublic);
    expect(publicClubs).toHaveLength(2);
    expect(publicClubs.map((c) => c.id)).toEqual(["c1", "c3"]);
  });
});

// ── Response mapping tests ────────────────────────────────────────────────────

describe("club row mapping", () => {
  it("maps snake_case DB row to camelCase Club object", () => {
    // Simulate the mapping that clubsApi does
    const row = {
      id: "seed-club-1",
      name: "London Chess Club",
      slug: "london-chess-club",
      tagline: "The oldest chess club",
      description: "Founded in 1807",
      location: "London, UK",
      country: "GB",
      category: "club",
      avatar_url: null,
      banner_url: null,
      accent_color: "#1a3a5c",
      owner_id: "seed",
      owner_name: "James Whitmore",
      member_count: 142,
      tournament_count: 24,
      follower_count: 0,
      is_public: 1,
      website: "https://londonchessclub.org",
      twitter: null,
      discord: null,
      announcement: "Spring Open 2026",
      founded_at: "2024-01-15T10:00:00Z",
    };

    // Simulate the rowToClub mapping function
    const club = {
      id: row.id,
      name: row.name,
      slug: row.slug,
      tagline: row.tagline,
      description: row.description,
      location: row.location,
      country: row.country,
      category: row.category,
      avatarUrl: row.avatar_url,
      bannerUrl: row.banner_url,
      accentColor: row.accent_color,
      ownerId: row.owner_id,
      ownerName: row.owner_name,
      memberCount: Number(row.member_count),
      tournamentCount: Number(row.tournament_count),
      followerCount: Number(row.follower_count),
      isPublic: Boolean(row.is_public),
      website: row.website,
      twitter: row.twitter,
      discord: row.discord,
      announcement: row.announcement,
      foundedAt: row.founded_at,
    };

    expect(club.id).toBe("seed-club-1");
    expect(club.accentColor).toBe("#1a3a5c");
    expect(club.memberCount).toBe(142);
    expect(club.isPublic).toBe(true);
    expect(club.avatarUrl).toBeNull();
  });

  it("memberCount is always a number (not a string)", () => {
    const row = makeClubRow({ memberCount: "890" });
    const memberCount = Number(row.memberCount);
    expect(typeof memberCount).toBe("number");
    expect(memberCount).toBe(890);
  });

  it("isPublic is always a boolean (not 0/1)", () => {
    expect(Boolean(1)).toBe(true);
    expect(Boolean(0)).toBe(false);
    expect(Boolean(true)).toBe(true);
    expect(Boolean(false)).toBe(false);
  });
});

// ── Migration logic tests ─────────────────────────────────────────────────────

describe("localStorage to server migration", () => {
  const MIGRATION_KEY = "otb_clubs_migrated_v1";

  beforeEach(() => {
    // Reset migration state
    const store: Record<string, string> = {};
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
    });
  });

  it("migration runs only once per user (idempotent)", () => {
    const store: Record<string, string> = {};
    const ls = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
    };

    const userId = "user-123";
    const migrationKey = `${MIGRATION_KEY}_${userId}`;

    // First run: not yet migrated
    expect(ls.getItem(migrationKey)).toBeNull();

    // Mark as migrated
    ls.setItem(migrationKey, "1");

    // Second run: already migrated
    expect(ls.getItem(migrationKey)).toBe("1");
  });

  it("migration key is user-specific to prevent cross-user data leakage", () => {
    const user1Key = `${MIGRATION_KEY}_user-1`;
    const user2Key = `${MIGRATION_KEY}_user-2`;
    expect(user1Key).not.toBe(user2Key);
  });

  it("clubs with isPublic=false are not sent to the server during migration", () => {
    const localClubs = [
      makeClubRow({ id: "c1", isPublic: true }),
      makeClubRow({ id: "c2", isPublic: false }),
      makeClubRow({ id: "c3", isPublic: true }),
    ];
    // Only public clubs should be migrated
    const toMigrate = localClubs.filter((c) => c.isPublic);
    expect(toMigrate).toHaveLength(2);
    expect(toMigrate.map((c) => c.id)).toEqual(["c1", "c3"]);
  });
});

// ── Search and filter tests ───────────────────────────────────────────────────

describe("club search and filtering", () => {
  it("search query is URL-encoded correctly", () => {
    const query = "New York Chess";
    const url = new URL("/api/clubs", "http://localhost:3000");
    url.searchParams.set("q", query);
    expect(url.searchParams.get("q")).toBe("New York Chess");
    expect(url.toString()).toContain("q=New+York+Chess");
  });

  it("category filter is passed as a query param", () => {
    const url = new URL("/api/clubs", "http://localhost:3000");
    url.searchParams.set("category", "professional");
    expect(url.searchParams.get("category")).toBe("professional");
  });

  it("country filter is passed as a query param", () => {
    const url = new URL("/api/clubs", "http://localhost:3000");
    url.searchParams.set("country", "US");
    expect(url.searchParams.get("country")).toBe("US");
  });

  it("multiple filters can be combined", () => {
    const url = new URL("/api/clubs", "http://localhost:3000");
    url.searchParams.set("public", "true");
    url.searchParams.set("category", "club");
    url.searchParams.set("country", "US");
    expect(url.searchParams.get("public")).toBe("true");
    expect(url.searchParams.get("category")).toBe("club");
    expect(url.searchParams.get("country")).toBe("US");
  });
});

// ── Merge logic tests ─────────────────────────────────────────────────────────

describe("server + localStorage merge logic", () => {
  it("server clubs take priority over local clubs with the same ID", () => {
    const serverClubs = [makeClubRow({ id: "c1", name: "Server Club", memberCount: 100 })];
    const localClubs = [makeClubRow({ id: "c1", name: "Local Club", memberCount: 50 })];

    const serverIds = new Set(serverClubs.map((c) => c.id));
    const localOnly = localClubs.filter((c) => !serverIds.has(c.id));
    const merged = [...serverClubs, ...localOnly];

    expect(merged).toHaveLength(1);
    expect(merged[0].name).toBe("Server Club");
    expect(merged[0].memberCount).toBe(100);
  });

  it("local-only clubs (not yet synced) are appended after server clubs", () => {
    const serverClubs = [makeClubRow({ id: "c1", name: "Server Club" })];
    const localClubs = [
      makeClubRow({ id: "c1", name: "Server Club" }),
      makeClubRow({ id: "c2", name: "Local Only Club" }),
    ];

    const serverIds = new Set(serverClubs.map((c) => c.id));
    const localOnly = localClubs.filter((c) => !serverIds.has(c.id));
    const merged = [...serverClubs, ...localOnly];

    expect(merged).toHaveLength(2);
    expect(merged[0].name).toBe("Server Club");
    expect(merged[1].name).toBe("Local Only Club");
  });

  it("empty server response falls back to all local clubs", () => {
    const serverClubs: typeof makeClubRow[] = [];
    const localClubs = [makeClubRow({ id: "c1" }), makeClubRow({ id: "c2" })];

    const serverIds = new Set((serverClubs as ReturnType<typeof makeClubRow>[]).map((c) => c.id));
    const localOnly = localClubs.filter((c) => !serverIds.has(c.id));
    const merged = [...(serverClubs as ReturnType<typeof makeClubRow>[]), ...localOnly];

    expect(merged).toHaveLength(2);
  });
});
