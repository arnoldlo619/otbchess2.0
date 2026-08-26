import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) => readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");

describe("Club Album persistence and API contracts", () => {
  it("persists album metadata separately from managed photo storage references", () => {
    const schema = read("shared/schema.ts");
    const migration = read("drizzle/0014_third_lily_hollister.sql");

    expect(schema).toContain('"club_albums"');
    expect(schema).toContain('"club_album_photos"');
    expect(schema).toContain('storageKey: text("storage_key").notNull()');
    expect(schema).toContain('clubPublishedIdx: index("ca_club_published_idx")');
    expect(migration).toContain("CREATE TABLE `club_albums`");
    expect(migration).toContain("CREATE TABLE `club_album_photos`");
  });

  it("keeps public reads open while protecting every write with full authentication and club role checks", () => {
    const server = read("server/clubs.ts");

    expect(server).toContain('clubsRouter.get("/:id/albums"');
    expect(server).toContain('clubsRouter.post("/:id/albums", requireFullAuth');
    expect(server).toContain('clubsRouter.patch("/:id/albums/:albumId", requireFullAuth');
    expect(server).toContain('clubsRouter.post("/:id/albums/:albumId/photos", requireFullAuth');
    expect(server).toContain('clubsRouter.delete("/:id/albums/:albumId/photos/:photoId", requireFullAuth');
    expect(server).toContain('clubsRouter.delete("/:id/albums/:albumId", requireFullAuth');
    expect(server).toContain('return membership?.role === "director"');
  });

  it("validates image type and size before writing photo bytes to managed object storage", () => {
    const server = read("server/clubs.ts");
    const storage = read("server/storage.ts");

    expect(server).toContain("image\\/(?:jpeg|png|webp)");
    expect(server).toContain("6 * 1024 * 1024");
    expect(server).toContain("await storagePut(`club-albums/");
    expect(storage).toContain('new URL("v1/storage/presign/put"');
    expect(storage).toContain('url: `/manus-storage/${key}`');
  });

  it("serves photos through a database-checked route so deleting the row revokes public access", () => {
    const server = read("server/clubs.ts");
    const storage = read("server/storage.ts");

    expect(server).toContain('url: `/api/clubs/${club.id}/albums/${album.id}/photos/${photo.id}/file`');
    expect(server).toContain('url: `/api/clubs/${club.id}/albums/${album.id}/photos/${photoId}/file`');
    expect(server).toContain('clubsRouter.get("/:id/albums/:albumId/photos/:photoId/file"');
    expect(server).toContain('eq(clubAlbumPhotos.id, req.params.photoId)');
    expect(server).toContain('res.set("Cache-Control", "no-store")');
    expect(storage).toContain('new URL("v1/storage/presign/get"');
  });
});

describe("Club Album product experience contracts", () => {
  it("ships loading, error, empty, management, progress, and full-screen viewer states", () => {
    const component = read("client/src/components/club/ClubAlbumTab.tsx");

    expect(component).toContain("Loading club albums");
    expect(component).toContain("Albums could not be loaded");
    expect(component).toContain("No albums yet");
    expect(component).toContain("Create album");
    expect(component).toContain("Uploading photos");
    expect(component).toContain("Full-screen club album photo viewer");
    expect(component).toContain('event.key === "ArrowLeft"');
    expect(component).toContain('event.key === "ArrowRight"');
    expect(component).toContain('aria-label="Previous photo"');
    expect(component).toContain('aria-label="Next photo"');
  });

  it("optimizes photos client-side and keeps accessible image descriptions", () => {
    const component = read("client/src/components/club/ClubAlbumTab.tsx");

    expect(component).toContain("MAX_IMAGE_EDGE = 2048");
    expect(component).toContain('canvas.toBlob');
    expect(component).toContain('"image/webp", 0.84');
    expect(component).toContain("photo.altText || photo.caption");
    expect(component).toContain('loading="lazy"');
    expect(component).toContain('decoding="async"');
  });

  it("exposes Album on both public-profile and club-dashboard desktop and mobile navigation", () => {
    const profile = read("client/src/pages/ClubProfile.tsx");
    const dashboard = read("client/src/pages/ClubDashboard.tsx");
    const tabs = read("client/src/components/club/ClubTabs.tsx");

    expect(profile).toContain('"members" | "album" | "leagues"');
    expect(profile).toContain('activeTab === "album"');
    expect(profile.match(/"home", "feed", "events", "members", "album", "leagues"/g)?.length).toBeGreaterThanOrEqual(2);
    expect(dashboard).toContain('| "album" |');
    expect(dashboard).toContain('{ id: "album", label: "Album", icon: AlbumIcon }');
    expect(dashboard).toContain('tab === "album"');
    expect(tabs).toContain('{ id: "album",   label: "Album",   icon: AlbumIcon }');
  });
});
