/**
 * Unit tests for club ownership guard logic.
 *
 * These tests verify the getMembership + role checks that determine
 * whether a user can create tournaments under a club profile.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  createClub,
  joinClub,
  getMembership,
  clearClubRegistry,
} from "../lib/clubRegistry";

// ── helpers ───────────────────────────────────────────────────────────────────

const OWNER = { userId: "owner-1", displayName: "Alice", avatarUrl: null };
const MEMBER = { userId: "member-1", displayName: "Bob", avatarUrl: null };
const STRANGER = { userId: "stranger-1", displayName: "Carol", avatarUrl: null };

function makeClub() {
  return createClub(
    {
      name: "Test Club",
      tagline: "A test club",
      description: "For testing",
      location: "London, UK",
      country: "GB",
      category: "club",
      avatarUrl: null,
      bannerUrl: null,
      accentColor: "#3D6B47",
      ownerId: OWNER.userId,
      ownerName: OWNER.displayName,
      isPublic: true,
    },
    OWNER
  );
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe("club ownership guard", () => {
  beforeEach(() => {
    // Use in-memory mock for localStorage
    const store: Record<string, string> = {};
    global.localStorage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
      clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
      length: 0,
      key: () => null,
    };
    clearClubRegistry();
  });

  it("creator has role 'owner'", () => {
    const club = makeClub();
    const membership = getMembership(club.id, OWNER.userId);
    expect(membership?.role).toBe("owner");
  });

  it("isOwner is true only for the owner", () => {
    const club = makeClub();
    const ownerMembership = getMembership(club.id, OWNER.userId);
    expect(ownerMembership?.role === "owner").toBe(true);
  });

  it("joined member has role 'member', not 'owner'", () => {
    const club = makeClub();
    joinClub(club.id, MEMBER);
    const membership = getMembership(club.id, MEMBER.userId);
    expect(membership?.role).toBe("member");
    expect(membership?.role === "owner").toBe(false);
  });

  it("stranger has no membership", () => {
    const club = makeClub();
    const membership = getMembership(club.id, STRANGER.userId);
    expect(membership).toBeNull();
  });

  it("isOwner guard: owner can host tournaments", () => {
    const club = makeClub();
    const membership = getMembership(club.id, OWNER.userId);
    const canHost = membership?.role === "owner";
    expect(canHost).toBe(true);
  });

  it("isOwner guard: member cannot host tournaments", () => {
    const club = makeClub();
    joinClub(club.id, MEMBER);
    const membership = getMembership(club.id, MEMBER.userId);
    const canHost = membership?.role === "owner";
    expect(canHost).toBe(false);
  });

  it("isOwner guard: stranger cannot host tournaments", () => {
    const club = makeClub();
    const membership = getMembership(club.id, STRANGER.userId);
    const canHost = membership?.role === "owner";
    expect(canHost).toBe(false);
  });

  it("isOwner guard: unauthenticated user (null membership) cannot host", () => {
    const club = makeClub();
    const membership = getMembership(club.id, "non-existent-user");
    const canHost = membership?.role === "owner";
    expect(canHost).toBe(false);
  });

  it("multiple clubs: ownership is scoped per club", () => {
    const club1 = makeClub();
    const club2 = createClub(
      {
        name: "Second Club",
        tagline: "Another club",
        description: "Second",
        location: "NYC, US",
        country: "US",
        category: "community",
        avatarUrl: null,
        bannerUrl: null,
        accentColor: "#1a3a5c",
        ownerId: MEMBER.userId,
        ownerName: MEMBER.displayName,
        isPublic: true,
      },
      MEMBER
    );

    // Alice owns club1 but not club2
    expect(getMembership(club1.id, OWNER.userId)?.role).toBe("owner");
    expect(getMembership(club2.id, OWNER.userId)).toBeNull();

    // Bob owns club2 but is not in club1
    expect(getMembership(club2.id, MEMBER.userId)?.role).toBe("owner");
    expect(getMembership(club1.id, MEMBER.userId)).toBeNull();
  });
});
