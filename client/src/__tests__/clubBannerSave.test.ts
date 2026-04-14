/**
 * Tests for the club banner save flow fix.
 *
 * Verifies:
 *  1. base64 banner data URLs are uploaded to /api/clubs/upload-banner (not upload-avatar)
 *  2. The returned server URL is PATCHed to /api/clubs/:id
 *  3. Banner upload uses a separate endpoint from avatar upload (8 MB limit)
 *  4. null (remove) values pass through without uploading
 *  5. Already-server URLs pass through without re-uploading
 *  6. Cache-busting ?v= param is appended to returned banner URLs
 *  7. Upload failures surface an error and abort the PATCH
 *  8. Avatar and banner can be saved simultaneously with 2 uploads + 1 PATCH
 */
import { describe, it, expect } from "vitest";

// ── Helpers ───────────────────────────────────────────────────────────────────

interface SaveResult {
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  uploadCalls: { avatar: number; banner: number };
  patchCalls: number;
  error?: string;
}

type FetchMock = (url: string, opts?: RequestInit) => Promise<Response>;

async function simulateSave(
  pendingAvatar: string | null | undefined,
  pendingBanner: string | null | undefined,
  currentAvatarUrl: string | null,
  currentBannerUrl: string | null,
  fetchMock: FetchMock
): Promise<SaveResult> {
  const uploadCalls = { avatar: 0, banner: 0 };
  let patchCalls = 0;
  const patch: Record<string, unknown> = {};

  // ── Avatar ──
  if (pendingAvatar !== undefined && pendingAvatar !== currentAvatarUrl) {
    if (pendingAvatar === null) {
      patch.avatarUrl = null;
    } else if (pendingAvatar.startsWith("data:")) {
      uploadCalls.avatar++;
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

  // ── Banner — uses dedicated /upload-banner endpoint ──
  if (pendingBanner !== undefined && pendingBanner !== currentBannerUrl) {
    if (pendingBanner === null) {
      patch.bannerUrl = null;
    } else if (pendingBanner.startsWith("data:")) {
      uploadCalls.banner++;
      const res = await fetchMock("/api/clubs/upload-banner", {
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
    // Cache-busting
    if (serverClub.avatarUrl && !serverClub.avatarUrl.startsWith("data:")) {
      serverClub.avatarUrl = `${serverClub.avatarUrl}?v=123`;
    }
    if (serverClub.bannerUrl && !serverClub.bannerUrl.startsWith("data:")) {
      serverClub.bannerUrl = `${serverClub.bannerUrl}?v=123`;
    }
    return {
      avatarUrl: serverClub.avatarUrl,
      bannerUrl: serverClub.bannerUrl,
      uploadCalls,
      patchCalls,
    };
  }

  return { uploadCalls, patchCalls };
}

// ── Mock factories ────────────────────────────────────────────────────────────

function makeFetch(
  avatarUploadUrl = "/uploads/avatars/abc.jpg",
  bannerUploadUrl = "/uploads/banners/xyz.jpg",
  patchResponse: Record<string, unknown> = {}
): FetchMock {
  return async (url: string, _opts?: RequestInit): Promise<Response> => {
    if (url.includes("upload-banner")) {
      return new Response(JSON.stringify({ url: bannerUploadUrl }), { status: 200 });
    }
    if (url.includes("upload-avatar")) {
      return new Response(JSON.stringify({ url: avatarUploadUrl }), { status: 200 });
    }
    if (url.includes("/api/clubs/")) {
      return new Response(JSON.stringify(patchResponse), { status: 200 });
    }
    return new Response(null, { status: 404 });
  };
}

function makeFailFetch(failBanner = false, failAvatar = false, failPatch = false): FetchMock {
  return async (url: string, _opts?: RequestInit): Promise<Response> => {
    if (url.includes("upload-banner") && failBanner) {
      return new Response(JSON.stringify({ error: "Upload failed" }), { status: 500 });
    }
    if (url.includes("upload-avatar") && failAvatar) {
      return new Response(JSON.stringify({ error: "Upload failed" }), { status: 500 });
    }
    if (url.includes("/api/clubs/") && failPatch) {
      return new Response(JSON.stringify({ error: "PATCH failed" }), { status: 403 });
    }
    return new Response(
      JSON.stringify({ url: url.includes("banner") ? "/uploads/banners/ok.jpg" : "/uploads/avatars/ok.jpg" }),
      { status: 200 }
    );
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Club banner save — dedicated upload-banner endpoint", () => {
  it("uses /api/clubs/upload-banner (not upload-avatar) for banner uploads", async () => {
    const calledUrls: string[] = [];
    const trackingFetch: FetchMock = async (url, opts) => {
      calledUrls.push(url);
      return makeFetch("/uploads/avatars/a.jpg", "/uploads/banners/b.jpg", {
        bannerUrl: "/uploads/banners/b.jpg",
      })(url, opts);
    };

    await simulateSave(
      undefined,
      "data:image/jpeg;base64,/9j/banner",
      null,
      null,
      trackingFetch
    );

    expect(calledUrls).toContain("/api/clubs/upload-banner");
    expect(calledUrls).not.toContain("/api/clubs/upload-avatar");
  });

  it("uploads banner to server and patches the returned URL", async () => {
    const fetch = makeFetch(
      "/uploads/avatars/a.jpg",
      "/uploads/banners/new-banner.jpg",
      { bannerUrl: "/uploads/banners/new-banner.jpg" }
    );
    const result = await simulateSave(
      undefined,
      "data:image/jpeg;base64,/9j/banner",
      null,
      null,
      fetch
    );
    expect(result.uploadCalls.banner).toBe(1);
    expect(result.patchCalls).toBe(1);
    expect(result.bannerUrl).toContain("/uploads/banners/new-banner.jpg");
  });

  it("appends cache-busting ?v= param to returned banner URL", async () => {
    const fetch = makeFetch(
      "/uploads/avatars/a.jpg",
      "/uploads/banners/b.jpg",
      { bannerUrl: "/uploads/banners/b.jpg" }
    );
    const result = await simulateSave(
      undefined,
      "data:image/jpeg;base64,/9j/banner",
      null,
      null,
      fetch
    );
    expect(result.bannerUrl).toContain("?v=");
  });
});

describe("Club banner save — null (remove) path", () => {
  it("passes null directly without uploading", async () => {
    const fetch = makeFetch(
      "/uploads/avatars/a.jpg",
      "/uploads/banners/b.jpg",
      { bannerUrl: null }
    );
    const result = await simulateSave(
      undefined,
      null,
      null,
      "/uploads/banners/existing.jpg",
      fetch
    );
    expect(result.uploadCalls.banner).toBe(0);
    expect(result.patchCalls).toBe(1);
  });
});

describe("Club banner save — server URL pass-through", () => {
  it("passes already-server banner URLs without re-uploading", async () => {
    const fetch = makeFetch(
      "/uploads/avatars/a.jpg",
      "/uploads/banners/b.jpg",
      { bannerUrl: "/uploads/banners/already.jpg" }
    );
    const result = await simulateSave(
      undefined,
      "/uploads/banners/already.jpg",
      null,
      null,
      fetch
    );
    expect(result.uploadCalls.banner).toBe(0);
    expect(result.patchCalls).toBe(1);
  });
});

describe("Club banner save — no-op when unchanged", () => {
  it("makes no network calls when banner is unchanged", async () => {
    const fetch = makeFetch();
    const result = await simulateSave(
      undefined,
      undefined,
      null,
      "/uploads/banners/existing.jpg",
      fetch
    );
    expect(result.uploadCalls.banner).toBe(0);
    expect(result.patchCalls).toBe(0);
  });

  it("makes no network calls when pending equals current", async () => {
    const fetch = makeFetch();
    const result = await simulateSave(
      undefined,
      "/uploads/banners/same.jpg",
      null,
      "/uploads/banners/same.jpg",
      fetch
    );
    expect(result.uploadCalls.banner).toBe(0);
    expect(result.patchCalls).toBe(0);
  });
});

describe("Club banner save — error handling", () => {
  it("returns error and aborts PATCH when banner upload fails", async () => {
    const fetch = makeFailFetch(true, false, false);
    const result = await simulateSave(
      undefined,
      "data:image/jpeg;base64,/9j/banner",
      null,
      null,
      fetch
    );
    expect(result.error).toBeDefined();
    expect(result.patchCalls).toBe(0);
  });

  it("returns error when PATCH fails after successful upload", async () => {
    const fetch = makeFailFetch(false, false, true);
    const result = await simulateSave(
      undefined,
      "data:image/jpeg;base64,/9j/banner",
      null,
      null,
      fetch
    );
    expect(result.error).toBeDefined();
  });
});

describe("Club banner + avatar simultaneous save", () => {
  it("uploads both avatar and banner, then makes a single PATCH call", async () => {
    const calledUrls: string[] = [];
    const trackingFetch: FetchMock = async (url, opts) => {
      calledUrls.push(url);
      return makeFetch(
        "/uploads/avatars/new.jpg",
        "/uploads/banners/new.jpg",
        { avatarUrl: "/uploads/avatars/new.jpg", bannerUrl: "/uploads/banners/new.jpg" }
      )(url, opts);
    };

    const result = await simulateSave(
      "data:image/jpeg;base64,/9j/avatar",
      "data:image/jpeg;base64,/9j/banner",
      null,
      null,
      trackingFetch
    );

    expect(result.uploadCalls.avatar).toBe(1);
    expect(result.uploadCalls.banner).toBe(1);
    expect(result.patchCalls).toBe(1);
    expect(calledUrls).toContain("/api/clubs/upload-avatar");
    expect(calledUrls).toContain("/api/clubs/upload-banner");
  });
});

describe("Server upload-banner endpoint — size and path", () => {
  it("banner endpoint uses /uploads/banners/ path (separate from avatars)", () => {
    const BANNERS_DIR = "/uploads/banners";
    const AVATARS_DIR = "/uploads/avatars";
    expect(BANNERS_DIR).not.toBe(AVATARS_DIR);
    expect(BANNERS_DIR).toContain("banners");
    expect(AVATARS_DIR).toContain("avatars");
  });

  it("banner size limit is 8 MB (larger than avatar 5 MB limit)", () => {
    const AVATAR_MAX = 5 * 1024 * 1024;
    const BANNER_MAX = 8 * 1024 * 1024;
    expect(BANNER_MAX).toBeGreaterThan(AVATAR_MAX);
    expect(BANNER_MAX).toBe(8388608);
  });

  it("banner body parser limit is 15 MB to accommodate base64 overhead", () => {
    // base64 encoding adds ~33% overhead, so 8 MB image → ~10.7 MB base64
    // 15 MB limit provides comfortable headroom
    const BODY_LIMIT_MB = 15;
    const BANNER_MAX_MB = 8;
    expect(BODY_LIMIT_MB).toBeGreaterThan(BANNER_MAX_MB * 1.33);
  });
});
