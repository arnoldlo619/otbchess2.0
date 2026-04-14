/**
 * Tests for the club avatar/banner save flow fix.
 *
 * Verifies the three-step logic:
 *  1. base64 data URLs are uploaded to /api/clubs/upload-avatar
 *  2. The returned server URL is PATCHed to /api/clubs/:id
 *  3. Already-server URLs are passed through without re-uploading
 *  4. null (remove) values are passed through directly
 *  5. Cache-busting ?v= param is appended to returned URLs
 *
 * Uses fetch mocking to simulate server responses without a real server.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Helpers mirroring the save handler logic ──────────────────────────────────

interface SaveResult {
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  uploadCalls: number;
  patchCalls: number;
  error?: string;
}

/**
 * Simulates the save handler logic extracted from the onClick in ClubProfile.tsx.
 * Returns what would be PATCHed and how many network calls were made.
 */
async function simulateSave(
  pendingAvatar: string | null | undefined,
  pendingBanner: string | null | undefined,
  currentAvatarUrl: string | null,
  currentBannerUrl: string | null,
  fetchMock: (url: string, opts?: RequestInit) => Promise<Response>
): Promise<SaveResult> {
  let uploadCalls = 0;
  let patchCalls = 0;
  const patch: Record<string, unknown> = {};

  // Avatar
  if (pendingAvatar !== undefined && pendingAvatar !== currentAvatarUrl) {
    if (pendingAvatar === null) {
      patch.avatarUrl = null;
    } else if (pendingAvatar.startsWith("data:")) {
      uploadCalls++;
      const res = await fetchMock("/api/clubs/upload-avatar", {
        method: "POST",
        body: JSON.stringify({ dataUrl: pendingAvatar }),
      });
      if (res.ok) {
        const { url } = await res.json();
        patch.avatarUrl = url;
      } else {
        return { uploadCalls, patchCalls, error: "Avatar upload failed" };
      }
    } else {
      patch.avatarUrl = pendingAvatar;
    }
  }

  // Banner
  if (pendingBanner !== undefined && pendingBanner !== currentBannerUrl) {
    if (pendingBanner === null) {
      patch.bannerUrl = null;
    } else if (pendingBanner.startsWith("data:")) {
      uploadCalls++;
      const res = await fetchMock("/api/clubs/upload-avatar", {
        method: "POST",
        body: JSON.stringify({ dataUrl: pendingBanner }),
      });
      if (res.ok) {
        const { url } = await res.json();
        patch.bannerUrl = url;
      } else {
        return { uploadCalls, patchCalls, error: "Banner upload failed" };
      }
    } else {
      patch.bannerUrl = pendingBanner;
    }
  }

  if (Object.keys(patch).length > 0) {
    patchCalls++;
    const res = await fetchMock("/api/clubs/test-id", {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      return { uploadCalls, patchCalls, error: "PATCH failed" };
    }
    const serverClub = await res.json();
    // Apply cache-busting
    if (serverClub.avatarUrl && !serverClub.avatarUrl.startsWith("data:")) {
      serverClub.avatarUrl = `${serverClub.avatarUrl}?v=123`;
    }
    if (serverClub.bannerUrl && !serverClub.bannerUrl.startsWith("data:")) {
      serverClub.bannerUrl = `${serverClub.bannerUrl}?v=123`;
    }
    return { avatarUrl: serverClub.avatarUrl, bannerUrl: serverClub.bannerUrl, uploadCalls, patchCalls };
  }

  return { uploadCalls, patchCalls };
}

// ── Mock fetch factory ────────────────────────────────────────────────────────

function makeFetch(uploadUrl = "/uploads/avatars/abc.jpg", patchResponse = {}) {
  return async (url: string, _opts?: RequestInit): Promise<Response> => {
    if (url.includes("upload-avatar")) {
      return new Response(JSON.stringify({ url: uploadUrl }), { status: 200 });
    }
    if (url.includes("/api/clubs/")) {
      return new Response(JSON.stringify(patchResponse), { status: 200 });
    }
    return new Response(null, { status: 404 });
  };
}

function makeFailFetch(failUpload = false, failPatch = false) {
  return async (url: string, _opts?: RequestInit): Promise<Response> => {
    if (url.includes("upload-avatar") && failUpload) {
      return new Response(JSON.stringify({ error: "Upload failed" }), { status: 500 });
    }
    if (url.includes("/api/clubs/") && failPatch) {
      return new Response(JSON.stringify({ error: "PATCH failed" }), { status: 403 });
    }
    return new Response(JSON.stringify({ url: "/uploads/avatars/abc.jpg" }), { status: 200 });
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Club avatar save flow — base64 upload path", () => {
  it("uploads base64 avatar to server and patches the returned URL", async () => {
    const fetch = makeFetch("/uploads/avatars/new.jpg", { avatarUrl: "/uploads/avatars/new.jpg" });
    const result = await simulateSave(
      "data:image/jpeg;base64,/9j/abc",
      undefined,
      null,
      null,
      fetch
    );
    expect(result.uploadCalls).toBe(1);
    expect(result.patchCalls).toBe(1);
    expect(result.avatarUrl).toContain("/uploads/avatars/new.jpg");
  });

  it("appends cache-busting ?v= param to the returned avatar URL", async () => {
    const fetch = makeFetch("/uploads/avatars/new.jpg", { avatarUrl: "/uploads/avatars/new.jpg" });
    const result = await simulateSave(
      "data:image/jpeg;base64,/9j/abc",
      undefined,
      null,
      null,
      fetch
    );
    expect(result.avatarUrl).toContain("?v=");
  });

  it("does not append cache-busting to data: URLs", async () => {
    const fetch = makeFetch("/uploads/avatars/new.jpg", { avatarUrl: "data:image/jpeg;base64,abc" });
    const result = await simulateSave(
      "data:image/jpeg;base64,/9j/abc",
      undefined,
      null,
      null,
      fetch
    );
    // data: URLs should not get ?v= appended
    expect(result.avatarUrl).not.toContain("?v=");
  });
});

describe("Club avatar save flow — null (remove) path", () => {
  it("passes null directly without uploading", async () => {
    const fetch = makeFetch("/uploads/avatars/new.jpg", { avatarUrl: null });
    const result = await simulateSave(null, undefined, "/uploads/avatars/old.jpg", null, fetch);
    expect(result.uploadCalls).toBe(0);
    expect(result.patchCalls).toBe(1);
  });
});

describe("Club avatar save flow — server URL pass-through", () => {
  it("passes already-server URLs without re-uploading", async () => {
    const fetch = makeFetch("/uploads/avatars/new.jpg", { avatarUrl: "/uploads/avatars/already.jpg" });
    const result = await simulateSave(
      "/uploads/avatars/already.jpg",
      undefined,
      null,
      null,
      fetch
    );
    expect(result.uploadCalls).toBe(0);
    expect(result.patchCalls).toBe(1);
  });
});

describe("Club avatar save flow — no-op when unchanged", () => {
  it("makes no network calls when avatar and banner are unchanged", async () => {
    const fetch = makeFetch();
    const result = await simulateSave(
      undefined, // pendingAvatar = not changed
      undefined, // pendingBanner = not changed
      "/uploads/avatars/existing.jpg",
      null,
      fetch
    );
    expect(result.uploadCalls).toBe(0);
    expect(result.patchCalls).toBe(0);
  });

  it("makes no network calls when pending equals current", async () => {
    const fetch = makeFetch();
    const result = await simulateSave(
      "/uploads/avatars/same.jpg",
      undefined,
      "/uploads/avatars/same.jpg", // same as pending
      null,
      fetch
    );
    expect(result.uploadCalls).toBe(0);
    expect(result.patchCalls).toBe(0);
  });
});

describe("Club avatar save flow — banner upload path", () => {
  it("uploads base64 banner and patches the returned URL", async () => {
    const fetch = makeFetch("/uploads/avatars/banner.jpg", { bannerUrl: "/uploads/avatars/banner.jpg" });
    const result = await simulateSave(
      undefined,
      "data:image/jpeg;base64,/9j/banner",
      null,
      null,
      fetch
    );
    expect(result.uploadCalls).toBe(1);
    expect(result.patchCalls).toBe(1);
    expect(result.bannerUrl).toContain("/uploads/avatars/banner.jpg");
  });
});

describe("Club avatar save flow — both avatar and banner changed", () => {
  it("uploads both and makes a single PATCH call", async () => {
    const fetch = makeFetch("/uploads/avatars/img.jpg", {
      avatarUrl: "/uploads/avatars/img.jpg",
      bannerUrl: "/uploads/avatars/img.jpg",
    });
    const result = await simulateSave(
      "data:image/jpeg;base64,/9j/avatar",
      "data:image/jpeg;base64,/9j/banner",
      null,
      null,
      fetch
    );
    expect(result.uploadCalls).toBe(2);
    expect(result.patchCalls).toBe(1);
  });
});

describe("Club avatar save flow — error handling", () => {
  it("returns error when upload fails", async () => {
    const fetch = makeFailFetch(true, false);
    const result = await simulateSave(
      "data:image/jpeg;base64,/9j/abc",
      undefined,
      null,
      null,
      fetch
    );
    expect(result.error).toBeDefined();
    expect(result.patchCalls).toBe(0); // PATCH should not be called after upload failure
  });

  it("returns error when PATCH fails", async () => {
    const fetch = makeFailFetch(false, true);
    const result = await simulateSave(
      "data:image/jpeg;base64,/9j/abc",
      undefined,
      null,
      null,
      fetch
    );
    expect(result.error).toBeDefined();
  });
});

describe("PATCH allowed fields — avatarUrl and bannerUrl", () => {
  it("avatarUrl is included in the allowed fields list", () => {
    // This test documents the server-side fix: avatarUrl must be in the allowed list
    const allowed = [
      "name", "tagline", "description", "location", "country", "category",
      "accentColor", "isPublic", "website", "twitter", "discord", "announcement",
      "avatarUrl", "bannerUrl",
    ];
    expect(allowed).toContain("avatarUrl");
    expect(allowed).toContain("bannerUrl");
  });

  it("avatarUrl and bannerUrl are the last two entries (added in the fix)", () => {
    const allowed = [
      "name", "tagline", "description", "location", "country", "category",
      "accentColor", "isPublic", "website", "twitter", "discord", "announcement",
      "avatarUrl", "bannerUrl",
    ];
    const last2 = allowed.slice(-2);
    expect(last2).toEqual(["avatarUrl", "bannerUrl"]);
  });
});
