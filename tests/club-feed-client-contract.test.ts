import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ authFetch: vi.fn() }));
vi.mock("../client/src/lib/apiFetch", () => ({ authFetch: mocks.authFetch }));

import { apiCreateClubFeedPost, apiDeleteClubFeedPost, canCurrentUserDeleteClubFeedPost } from "../client/src/lib/clubFeedApi";

const dashboardSource = readFileSync(resolve(import.meta.dirname, "../client/src/pages/ClubDashboard.tsx"), "utf8");

describe("Club Feed client contract", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends attachment metadata only to the authenticated Club Feed endpoint", async () => {
    mocks.authFetch.mockResolvedValue(new Response(JSON.stringify({ id: "post-1", clubId: "club-1", type: "announcement", actorName: "Member", isPinned: false, createdAt: "2026-09-01T00:00:00.000Z", attachments: [] }), { status: 201 }));
    await apiCreateClubFeedPost("club-1", {
      type: "announcement",
      actorName: "Member",
      detail: "See everyone Friday.",
      attachments: [{ fileName: "board.webp", mimeType: "image/webp", dataUrl: "data:image/webp;base64,AA==" }],
    });
    expect(mocks.authFetch).toHaveBeenCalledWith("/api/clubs/club-1/feed", expect.objectContaining({ method: "POST", headers: { "Content-Type": "application/json" } }));
    const request = mocks.authFetch.mock.calls[0]?.[1] as { body: string };
    expect(JSON.parse(request.body)).toMatchObject({ type: "announcement", detail: "See everyone Friday.", attachments: [{ fileName: "board.webp", mimeType: "image/webp" }] });
  });

  it("uses the club-scoped delete endpoint rather than changing local Feed state directly", async () => {
    mocks.authFetch.mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 }));
    await apiDeleteClubFeedPost("club-1", "post-1");
    expect(mocks.authFetch).toHaveBeenCalledWith("/api/clubs/club-1/feed/post-1", { method: "DELETE" });
  });

  it("shows the destructive affordance only to the original author or club owner", () => {
    expect(canCurrentUserDeleteClubFeedPost("author-1", "owner-1", "author-1")).toBe(true);
    expect(canCurrentUserDeleteClubFeedPost("owner-1", "owner-1", "author-1")).toBe(true);
    expect(canCurrentUserDeleteClubFeedPost("director-1", "owner-1", "author-1")).toBe(false);
    expect(canCurrentUserDeleteClubFeedPost(undefined, "owner-1", "author-1")).toBe(false);
  });

  it("uses the Overview-aligned card hierarchy while retaining Feed media and event interactions", () => {
    expect(dashboardSource).toContain("const cardSurface = isDark ? \"oklch(0.155 0.045 145)\" : \"rgba(255,255,255,0.76)\"");
    expect(dashboardSource).toContain("const eventKind = event.type === \"tournament_completed\"");
    expect(dashboardSource).toContain("<ClubFeedMediaGallery images={imageAttachments}");
    expect(dashboardSource).toContain("onClick={() => handleRsvp(s)}");
    expect(dashboardSource).toContain("onClick={() => handleVote(opt.id)}");
    expect(dashboardSource).toContain("canCurrentUserDeleteClubFeedPost(user?.id, club.ownerId, ev.createdBy)");
  });
});
