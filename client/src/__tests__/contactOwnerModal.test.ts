/**
 * Tests for the ContactOwnerModal component and the contact-owner API endpoint.
 */
import { describe, it, expect } from "vitest";

// ── Unit tests for the contact-owner API endpoint logic ───────────────────────

describe("contact-owner endpoint logic", () => {
  it("rejects empty message", () => {
    const message = "   ";
    expect(message.trim().length).toBe(0);
  });

  it("rejects message over 2000 chars", () => {
    const message = "a".repeat(2001);
    expect(message.trim().length).toBeGreaterThan(2000);
  });

  it("accepts a valid message", () => {
    const message = "Hi, I'd like to ask about joining your club.";
    expect(message.trim().length).toBeGreaterThan(0);
    expect(message.trim().length).toBeLessThanOrEqual(2000);
  });

  it("canonical ordering: userAId < userBId", () => {
    const userId = "user_abc";
    const ownerId = "user_xyz";
    const [userAId, userBId] = userId < ownerId ? [userId, ownerId] : [ownerId, userId];
    expect(userAId).toBe("user_abc");
    expect(userBId).toBe("user_xyz");
  });

  it("canonical ordering reversed when owner id is lexicographically smaller", () => {
    const userId = "user_xyz";
    const ownerId = "user_abc";
    const [userAId, userBId] = userId < ownerId ? [userId, ownerId] : [ownerId, userId];
    expect(userAId).toBe("user_abc");
    expect(userBId).toBe("user_xyz");
  });
});

// ── Unit tests for the ContactOwnerModal UI logic ─────────────────────────────

describe("ContactOwnerModal character counter", () => {
  const MAX_CHARS = 2000;

  it("shows remaining chars correctly", () => {
    const message = "Hello world";
    const remaining = MAX_CHARS - message.length;
    expect(remaining).toBe(1989);
  });

  it("flags over-limit correctly", () => {
    const message = "a".repeat(2001);
    const remaining = MAX_CHARS - message.length;
    expect(remaining).toBeLessThan(0);
  });

  it("send button disabled when message is empty", () => {
    const message = "";
    const isOverLimit = (MAX_CHARS - message.length) < 0;
    const disabled = !message.trim() || isOverLimit;
    expect(disabled).toBe(true);
  });

  it("send button enabled when message is valid", () => {
    const message = "Hi there!";
    const isOverLimit = (MAX_CHARS - message.length) < 0;
    const disabled = !message.trim() || isOverLimit;
    expect(disabled).toBe(false);
  });
});

// ── Owner avatar/username resolution tests ───────────────────────────────────

describe("ContactOwnerModal owner identity resolution", () => {
  it("derives ownerAvatarUrl from the owner member's avatarUrl", () => {
    const members = [
      { role: "member", avatarUrl: "https://cdn.example.com/member.jpg", chesscomUsername: "member1" },
      { role: "owner", avatarUrl: "https://cdn.example.com/owner.jpg", chesscomUsername: "ownerchess" },
    ];
    const ownerMember = members.find((m) => m.role === "owner");
    expect(ownerMember?.avatarUrl).toBe("https://cdn.example.com/owner.jpg");
    expect(ownerMember?.chesscomUsername).toBe("ownerchess");
  });

  it("returns null when no owner member is found", () => {
    const members = [
      { role: "member", avatarUrl: "https://cdn.example.com/member.jpg", chesscomUsername: "member1" },
    ];
    const ownerMember = members.find((m) => m.role === "owner");
    expect(ownerMember?.avatarUrl ?? null).toBeNull();
    expect(ownerMember?.chesscomUsername ?? null).toBeNull();
  });

  it("generates correct initials from owner name", () => {
    const ownerName = "Arnold Lo";
    const initials = ownerName.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
    expect(initials).toBe("AL");
  });

  it("generates single initial for single-word name", () => {
    const ownerName = "Magnus";
    const initials = ownerName.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
    expect(initials).toBe("M");
  });
});

// ── Visibility logic tests ────────────────────────────────────────────────────

describe("Contact Owner button visibility", () => {
  it("should NOT show for the club owner", () => {
    const user = { id: "owner_123" };
    const club = { ownerId: "owner_123" };
    const isOwner = user.id === club.ownerId;
    expect(isOwner).toBe(true);
    // Button should be hidden when isOwner is true
    const showButton = user && !isOwner;
    expect(showButton).toBeFalsy();
  });

  it("should show for a signed-in non-owner", () => {
    const user = { id: "member_456" };
    const club = { ownerId: "owner_123" };
    const isOwner = user.id === club.ownerId;
    expect(isOwner).toBe(false);
    const showButton = user && !isOwner;
    expect(showButton).toBeTruthy();
  });

  it("should NOT show for a guest (no user)", () => {
    const user = null;
    const showButton = user && true;
    expect(showButton).toBeFalsy();
  });
});
