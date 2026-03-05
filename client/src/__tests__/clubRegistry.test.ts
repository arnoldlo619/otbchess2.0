/**
 * Unit tests for clubRegistry.ts
 *
 * Tests: createClub, getClub, getClubBySlug, listAllClubs, listMyClubs,
 *        joinClub, leaveClub, isMember, getMembership, updateClub
 *
 * The test environment is Node (no real localStorage), so we provide a
 * minimal in-memory polyfill before importing the module.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// ── In-memory localStorage polyfill for Node test environment ─────────────────
const store: Record<string, string> = {};
const localStorageMock = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v; },
  removeItem: (k: string) => { delete store[k]; },
  clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
};
vi.stubGlobal("localStorage", localStorageMock);

import {
  createClub,
  getClub,
  getClubBySlug,
  listAllClubs,
  listMyClubs,
  joinClub,
  leaveClub,
  isMember,
  getMembership,
  getClubMembers,
  updateClub,
  clearClubRegistry,
} from "../lib/clubRegistry";

const CREATOR = { userId: "user-1", displayName: "Alice", avatarUrl: null };

const BASE_CLUB = {
  name: "Test Chess Club",
  tagline: "A test club",
  description: "For testing purposes",
  location: "London, UK",
  country: "GB",
  category: "club" as const,
  avatarUrl: null,
  bannerUrl: null,
  accentColor: "#3D6B47",
  ownerId: "user-1",
  ownerName: "Alice",
  isPublic: true,
};

describe("clubRegistry", () => {
  beforeEach(() => {
    clearClubRegistry();
  });

  // ── createClub ──────────────────────────────────────────────────────────────

  it("creates a club with generated id, slug, and memberCount=1", () => {
    const club = createClub(BASE_CLUB, CREATOR);
    expect(club.id).toBeTruthy();
    expect(club.slug).toBe("test-chess-club");
    expect(club.memberCount).toBe(1);
    expect(club.tournamentCount).toBe(0);
    expect(club.foundedAt).toBeTruthy();
  });

  it("auto-joins the creator as owner", () => {
    const club = createClub(BASE_CLUB, CREATOR);
    const membership = getMembership(club.id, CREATOR.userId);
    expect(membership).not.toBeNull();
    expect(membership!.role).toBe("owner");
  });

  it("slugifies club names with spaces and special chars", () => {
    const club = createClub({ ...BASE_CLUB, name: "NYC Chess & More!" }, CREATOR);
    expect(club.slug).toBe("nyc-chess-more");
  });

  // ── getClub / getClubBySlug ─────────────────────────────────────────────────

  it("retrieves a club by id", () => {
    const club = createClub(BASE_CLUB, CREATOR);
    expect(getClub(club.id)).toMatchObject({ name: "Test Chess Club" });
  });

  it("returns null for unknown id", () => {
    expect(getClub("nonexistent")).toBeNull();
  });

  it("retrieves a club by slug", () => {
    const club = createClub(BASE_CLUB, CREATOR);
    expect(getClubBySlug(club.slug)).toMatchObject({ id: club.id });
  });

  // ── listAllClubs / listMyClubs ──────────────────────────────────────────────

  it("listAllClubs returns only public clubs", () => {
    createClub(BASE_CLUB, CREATOR);
    createClub({ ...BASE_CLUB, name: "Private Club", isPublic: false }, CREATOR);
    const all = listAllClubs();
    expect(all.length).toBe(1);
    expect(all[0].name).toBe("Test Chess Club");
  });

  it("listMyClubs returns clubs the user has joined", () => {
    const club1 = createClub(BASE_CLUB, CREATOR);
    const club2 = createClub({ ...BASE_CLUB, name: "Club 2" }, { userId: "user-2", displayName: "Bob", avatarUrl: null });
    // user-1 is owner of club1, not a member of club2
    const mine = listMyClubs("user-1");
    expect(mine.map((c) => c.id)).toContain(club1.id);
    expect(mine.map((c) => c.id)).not.toContain(club2.id);
  });

  // ── joinClub / leaveClub / isMember ────────────────────────────────────────

  it("joinClub adds a member and increments memberCount", () => {
    const club = createClub(BASE_CLUB, CREATOR);
    const initialCount = club.memberCount; // 1 (owner)
    joinClub(club.id, { userId: "user-2", displayName: "Bob" });
    expect(isMember(club.id, "user-2")).toBe(true);
    const updated = getClub(club.id)!;
    expect(updated.memberCount).toBe(initialCount + 1);
  });

  it("joinClub is idempotent — joining twice does not double-count", () => {
    const club = createClub(BASE_CLUB, CREATOR);
    joinClub(club.id, { userId: "user-2", displayName: "Bob" });
    joinClub(club.id, { userId: "user-2", displayName: "Bob" });
    const members = getClubMembers(club.id).filter((m) => m.userId === "user-2");
    expect(members.length).toBe(1);
    expect(getClub(club.id)!.memberCount).toBe(2);
  });

  it("leaveClub removes the member and decrements memberCount", () => {
    const club = createClub(BASE_CLUB, CREATOR);
    joinClub(club.id, { userId: "user-2", displayName: "Bob" });
    leaveClub(club.id, "user-2");
    expect(isMember(club.id, "user-2")).toBe(false);
    expect(getClub(club.id)!.memberCount).toBe(1);
  });

  it("owner cannot leave the club", () => {
    const club = createClub(BASE_CLUB, CREATOR);
    leaveClub(club.id, CREATOR.userId);
    expect(isMember(club.id, CREATOR.userId)).toBe(true);
  });

  it("isMember returns false for non-members", () => {
    const club = createClub(BASE_CLUB, CREATOR);
    expect(isMember(club.id, "stranger")).toBe(false);
  });

  // ── getMembership ───────────────────────────────────────────────────────────

  it("getMembership returns the correct role", () => {
    const club = createClub(BASE_CLUB, CREATOR);
    joinClub(club.id, { userId: "user-2", displayName: "Bob" });
    const m = getMembership(club.id, "user-2");
    expect(m).not.toBeNull();
    expect(m!.role).toBe("member");
  });

  it("getMembership returns null for non-members", () => {
    const club = createClub(BASE_CLUB, CREATOR);
    expect(getMembership(club.id, "nobody")).toBeNull();
  });

  // ── updateClub ──────────────────────────────────────────────────────────────

  it("updateClub patches the club fields", () => {
    const club = createClub(BASE_CLUB, CREATOR);
    const updated = updateClub(club.id, { tagline: "Updated tagline" });
    expect(updated).not.toBeNull();
    expect(updated!.tagline).toBe("Updated tagline");
    expect(getClub(club.id)!.tagline).toBe("Updated tagline");
  });

  it("updateClub returns null for unknown id", () => {
    expect(updateClub("nonexistent", { tagline: "x" })).toBeNull();
  });

  // ── getClubMembers ──────────────────────────────────────────────────────────

  it("getClubMembers returns all members of a club", () => {
    const club = createClub(BASE_CLUB, CREATOR);
    joinClub(club.id, { userId: "user-2", displayName: "Bob" });
    joinClub(club.id, { userId: "user-3", displayName: "Carol" });
    const members = getClubMembers(club.id);
    expect(members.length).toBe(3); // owner + 2 members
  });

  it("getClubMembers does not return members of other clubs", () => {
    const club1 = createClub(BASE_CLUB, CREATOR);
    const club2 = createClub({ ...BASE_CLUB, name: "Other Club" }, { userId: "user-2", displayName: "Bob", avatarUrl: null });
    joinClub(club2.id, { userId: "user-3", displayName: "Carol" });
    const members = getClubMembers(club1.id);
    expect(members.every((m) => m.clubId === club1.id)).toBe(true);
  });
});
