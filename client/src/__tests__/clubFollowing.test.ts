/**
 * Unit tests for club follow/unfollow logic in clubRegistry
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// ── Mock localStorage ─────────────────────────────────────────────────────────
const store: Record<string, string> = {};
const localStorageMock = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v; },
  removeItem: (k: string) => { delete store[k]; },
  clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
};
vi.stubGlobal("localStorage", localStorageMock);

import {
  followClub,
  unfollowClub,
  isFollowing,
  getFollowerCount,
  clearClubRegistry,
} from "../lib/clubRegistry";

// ── Helpers ───────────────────────────────────────────────────────────────────

function seedClub(id: string, followerCount = 0) {
  const clubs = JSON.parse(store["otb-clubs-v1"] ?? "[]");
  clubs.push({
    id,
    name: `Club ${id}`,
    slug: id,
    tagline: "",
    description: "",
    location: "",
    country: "US",
    category: "club",
    avatarUrl: null,
    bannerUrl: null,
    accentColor: "#3D6B47",
    ownerId: "owner-1",
    ownerName: "Owner",
    memberCount: 1,
    tournamentCount: 0,
    followerCount,
    foundedAt: new Date().toISOString(),
    isPublic: true,
  });
  store["otb-clubs-v1"] = JSON.stringify(clubs);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("clubRegistry — Follow / Unfollow", () => {
  beforeEach(() => {
    localStorageMock.clear();
    clearClubRegistry();
  });

  it("isFollowing returns false before following", () => {
    seedClub("club-1");
    expect(isFollowing("club-1", "user-1")).toBe(false);
  });

  it("followClub sets isFollowing to true", () => {
    seedClub("club-1");
    followClub("club-1", "user-1");
    expect(isFollowing("club-1", "user-1")).toBe(true);
  });

  it("followClub increments follower count", () => {
    seedClub("club-1", 5);
    followClub("club-1", "user-1");
    expect(getFollowerCount("club-1")).toBe(1); // counted from follows storage
  });

  it("followClub is idempotent — calling twice does not double-count", () => {
    seedClub("club-1");
    followClub("club-1", "user-1");
    followClub("club-1", "user-1");
    expect(getFollowerCount("club-1")).toBe(1);
  });

  it("unfollowClub sets isFollowing to false", () => {
    seedClub("club-1");
    followClub("club-1", "user-1");
    unfollowClub("club-1", "user-1");
    expect(isFollowing("club-1", "user-1")).toBe(false);
  });

  it("unfollowClub decrements follower count", () => {
    seedClub("club-1");
    followClub("club-1", "user-1");
    followClub("club-1", "user-2");
    unfollowClub("club-1", "user-1");
    expect(getFollowerCount("club-1")).toBe(1);
  });

  it("unfollowClub is a no-op when not following", () => {
    seedClub("club-1");
    expect(() => unfollowClub("club-1", "user-99")).not.toThrow();
    expect(getFollowerCount("club-1")).toBe(0);
  });

  it("follower count is independent per club", () => {
    seedClub("club-1");
    seedClub("club-2");
    followClub("club-1", "user-1");
    followClub("club-1", "user-2");
    followClub("club-2", "user-1");
    expect(getFollowerCount("club-1")).toBe(2);
    expect(getFollowerCount("club-2")).toBe(1);
  });

  it("isFollowing is independent per club", () => {
    seedClub("club-1");
    seedClub("club-2");
    followClub("club-1", "user-1");
    expect(isFollowing("club-1", "user-1")).toBe(true);
    expect(isFollowing("club-2", "user-1")).toBe(false);
  });

  it("multiple users can follow the same club independently", () => {
    seedClub("club-1");
    followClub("club-1", "user-1");
    followClub("club-1", "user-2");
    followClub("club-1", "user-3");
    expect(getFollowerCount("club-1")).toBe(3);
    unfollowClub("club-1", "user-2");
    expect(getFollowerCount("club-1")).toBe(2);
    expect(isFollowing("club-1", "user-1")).toBe(true);
    expect(isFollowing("club-1", "user-2")).toBe(false);
    expect(isFollowing("club-1", "user-3")).toBe(true);
  });

  it("getFollowerCount returns 0 for a club with no followers", () => {
    seedClub("club-empty");
    expect(getFollowerCount("club-empty")).toBe(0);
  });
});
