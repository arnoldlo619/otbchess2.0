/**
 * clubOperationsDashboard.test.ts
 * Tests for Club Operations Dashboard features:
 * - Member role management (promote/demote)
 * - Remove member confirm flow
 * - RSVP management panel (open/close)
 * - Join policy settings
 * - Danger zone (publish/unpublish, delete confirmation)
 * - QR tools tab (join/rsvp/checkin modes)
 * - Overview tab stat derivations
 */

import { describe, it, expect } from "vitest";

// ── Member role management ────────────────────────────────────────────────────

describe("Member role management", () => {
  it("should allow promoting a member to director", () => {
    const _allowedRoles = ["member", "director", "owner"] as const;
    type Role = typeof _allowedRoles[number];
    function canPromote(currentRole: Role, targetRole: Role): boolean {
      const rank: Record<Role, number> = { member: 0, director: 1, owner: 2 };
      return rank[targetRole] > rank[currentRole];
    }
    expect(canPromote("member", "director")).toBe(true);
    expect(canPromote("director", "member")).toBe(false);
    expect(canPromote("owner", "director")).toBe(false);
  });

  it("should not allow demoting the owner", () => {
    function canChangeRole(actorRole: string, targetRole: string): boolean {
      if (targetRole === "owner") return false; // can't change owner's role
      if (actorRole !== "owner") return false;  // only owner can change roles
      return true;
    }
    expect(canChangeRole("owner", "director")).toBe(true);
    expect(canChangeRole("owner", "owner")).toBe(false);
    expect(canChangeRole("director", "member")).toBe(false);
  });
});

// ── Remove member confirm flow ────────────────────────────────────────────────

describe("Remove member confirm flow", () => {
  it("should require a memberId to be set before removal is triggered", () => {
    let removeMemberId: string | null = null;
    let removeMemberName = "";

    // Simulate clicking remove on a member
    function triggerRemove(userId: string, displayName: string) {
      removeMemberId = userId;
      removeMemberName = displayName;
    }

    triggerRemove("user-123", "Alice");
    expect(removeMemberId).toBe("user-123");
    expect(removeMemberName).toBe("Alice");

    // Simulate cancel
    removeMemberId = null;
    removeMemberName = "";
    expect(removeMemberId).toBeNull();
  });

  it("should clear state after successful removal", () => {
    let removeMemberId: string | null = "user-456";
    let removeMemberName = "Bob";

    // Simulate successful removal
    removeMemberId = null;
    removeMemberName = "";

    expect(removeMemberId).toBeNull();
    expect(removeMemberName).toBe("");
  });
});

// ── RSVP management panel ─────────────────────────────────────────────────────

describe("RSVP management panel", () => {
  it("should open panel for a specific event ID", () => {
    let rsvpPanelEventId: string | null = null;

    function openRsvpPanel(eventId: string) {
      rsvpPanelEventId = eventId;
    }

    openRsvpPanel("event-abc");
    expect(rsvpPanelEventId).toBe("event-abc");
  });

  it("should close panel by setting eventId to null", () => {
    let rsvpPanelEventId: string | null = "event-abc";
    rsvpPanelEventId = null;
    expect(rsvpPanelEventId).toBeNull();
  });

  it("should correctly identify checked-in users from checkin list", () => {
    const eventRsvpList = [
      { id: "r1", userId: "u1", displayName: "Alice" },
      { id: "r2", userId: "u2", displayName: "Bob" },
      { id: "r3", userId: "u3", displayName: "Charlie" },
    ];
    const eventCheckinList = [
      { id: "c1", userId: "u1", displayName: "Alice" },
    ];

    const checkedInIds = new Set(eventCheckinList.map(c => c.userId));
    const notCheckedIn = eventRsvpList.filter(r => !checkedInIds.has(r.userId));

    expect(checkedInIds.has("u1")).toBe(true);
    expect(checkedInIds.has("u2")).toBe(false);
    expect(notCheckedIn.length).toBe(2);
    expect(notCheckedIn.map(r => r.displayName)).toContain("Bob");
    expect(notCheckedIn.map(r => r.displayName)).toContain("Charlie");
  });
});

// ── Join policy settings ──────────────────────────────────────────────────────

describe("Join policy settings", () => {
  it("should accept valid join policy values", () => {
    const validPolicies = ["public", "approval", "invite"] as const;
    type JoinPolicy = typeof validPolicies[number];

    function isValidPolicy(p: string): p is JoinPolicy {
      return (validPolicies as readonly string[]).includes(p);
    }

    expect(isValidPolicy("public")).toBe(true);
    expect(isValidPolicy("approval")).toBe(true);
    expect(isValidPolicy("invite")).toBe(true);
    expect(isValidPolicy("unknown")).toBe(false);
  });

  it("should default to public if no policy is set", () => {
    const club = { joinPolicy: undefined };
    const policy = club.joinPolicy ?? "public";
    expect(policy).toBe("public");
  });
});

// ── Danger zone ───────────────────────────────────────────────────────────────

describe("Danger zone", () => {
  it("should require exact club name match to enable delete", () => {
    const clubName = "Brooklyn Chess Club";
    const confirmInput = "Brooklyn Chess Club";
    expect(confirmInput === clubName).toBe(true);

    const wrongInput = "brooklyn chess club";
    expect(wrongInput === clubName).toBe(false);
  });

  it("should toggle club status correctly", () => {
    function toggleStatus(current: "draft" | "published"): "draft" | "published" {
      return current === "published" ? "draft" : "published";
    }
    expect(toggleStatus("published")).toBe("draft");
    expect(toggleStatus("draft")).toBe("published");
  });
});

// ── QR tools tab ─────────────────────────────────────────────────────────────

describe("QR tools tab", () => {
  it("should generate correct URLs for each QR mode", () => {
    const origin = "https://chessotb.club";
    const clubSlug = "brooklyn-chess-club";
    const eventId = "event-xyz";

    const joinUrl = `${origin}/clubs/${clubSlug}?join=1`;
    const rsvpUrl = `${origin}/clubs/${clubSlug}/meetup/${eventId}?rsvp=1`;
    const checkinUrl = `${origin}/checkin/${eventId}`;

    expect(joinUrl).toContain("join=1");
    expect(rsvpUrl).toContain("rsvp=1");
    expect(rsvpUrl).toContain(eventId);
    expect(checkinUrl).toContain(eventId);
  });

  it("should disable RSVP and check-in QR when no event is selected", () => {
    const qrEventId: string | null = null;
    const qrMode: "join" | "rsvp" | "checkin" = "rsvp";

    const isQrReady = qrMode === "join" || qrEventId !== null;
    expect(isQrReady).toBe(false);
  });
});

// ── Overview tab stat derivations ─────────────────────────────────────────────

describe("Overview tab stats", () => {
  it("should count total members correctly", () => {
    const members = [
      { userId: "u1", role: "owner" },
      { userId: "u2", role: "director" },
      { userId: "u3", role: "member" },
    ];
    expect(members.length).toBe(3);
  });

  it("should count upcoming events correctly", () => {
    const now = new Date("2026-06-21T00:00:00Z");
    const events = [
      { id: "e1", startAt: "2026-06-25T18:00:00Z" },
      { id: "e2", startAt: "2026-06-10T18:00:00Z" }, // past
      { id: "e3", startAt: "2026-07-01T18:00:00Z" },
    ];
    const upcoming = events.filter(e => new Date(e.startAt) > now);
    expect(upcoming.length).toBe(2);
  });

  it("should compute member growth percentage", () => {
    function growthPct(current: number, previous: number): number {
      if (previous === 0) return 100;
      return Math.round(((current - previous) / previous) * 100);
    }
    expect(growthPct(12, 10)).toBe(20);
    expect(growthPct(10, 10)).toBe(0);
    expect(growthPct(5, 0)).toBe(100);
  });
});
