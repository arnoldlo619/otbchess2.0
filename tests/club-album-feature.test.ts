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

  it("persists member-authorized photo reactions and comments with scoped cleanup", () => {
    const schema = read("shared/schema.ts");
    const migration = read("drizzle/0020_club_album_photo_social.sql");
    const server = read("server/clubs.ts");

    expect(schema).toContain('"club_album_photo_likes"');
    expect(schema).toContain('"club_album_photo_comments"');
    expect(schema).toContain('uniqueIndex("capl_photo_user_idx")');
    expect(migration).toContain("CREATE TABLE `club_album_photo_likes`");
    expect(migration).toContain("CREATE TABLE `club_album_photo_comments`");
    expect(server).toContain('clubsRouter.post("/:id/albums/:albumId/photos/:photoId/like", requireFullAuth');
    expect(server).toContain('clubsRouter.post("/:id/albums/:albumId/photos/:photoId/comments", requireFullAuth');
    expect(server).toContain('clubsRouter.delete("/:id/albums/:albumId/photos/:photoId/comments/:commentId", requireFullAuth');
    expect(server).toContain('await isActiveClubMember(club.id, club.ownerId, userId)');
    expect(server).toContain('Comments must be between 1 and 500 characters');
    expect(server).toContain('await db.delete(clubAlbumPhotoLikes)');
    expect(server).toContain('await db.delete(clubAlbumPhotoComments)');
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
    expect(component).toContain('data-testid="club-album-fullscreen-viewer"');
    expect(component).toContain("!inset-0");
    expect(component).toContain("!w-[100dvw]");
    expect(component).toContain("sm:!max-w-none");
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

  it("uses a responsive, non-emoji social rail while preserving carousel controls", () => {
    const component = read("client/src/components/club/ClubAlbumTab.tsx");
    const api = read("client/src/lib/clubAlbumsApi.ts");
    const dashboard = read("client/src/pages/ClubDashboard.tsx");
    const profile = read("client/src/pages/ClubProfile.tsx");

    expect(component).toContain('aria-label="Photo interactions"');
    expect(component).toContain('lg:grid-cols-[minmax(0,1fr)_24rem]');
    expect(component).toContain('grid-rows-[minmax(0,1fr)_minmax(18rem,42dvh)]');
    expect(component).toContain('safe-area-inset-bottom');
    expect(component).toContain('No comments yet. Start a conversation about this moment.');
    expect(component).toContain('event.key === "ArrowLeft"');
    expect(component).toContain('event.key === "ArrowRight"');
    expect(component).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
    expect(api).toContain('apiToggleClubAlbumPhotoLike');
    expect(api).toContain('apiCreateClubAlbumPhotoComment');
    expect(api).toContain('apiDeleteClubAlbumPhotoComment');
    expect(dashboard).toContain('canInteract={Boolean(isActiveClubMember && user && !user.isGuest)}');
    expect(profile).toContain('canInteract={Boolean(user && !user.isGuest && (joined || isOwner || isDirector))}');
  });

  it("exposes Album on both public-profile and club-dashboard desktop and mobile navigation", () => {
    const profile = read("client/src/pages/ClubProfile.tsx");
    const dashboard = read("client/src/pages/ClubDashboard.tsx");
    const tabs = read("client/src/components/club/ClubTabs.tsx");
    const profileNavigation = read("client/src/lib/clubProfileNavigation.ts");

    expect(profileNavigation).toContain('MEMBER_CLUB_PROFILE_TABS = ["home", "feed", "events", "members", "album", "leagues"]');
    expect(profile).toContain('activeTab === "album"');
    expect(profile).toContain('const valid: ClubTabId[] = ["home", "events", "members", "feed", "album", "leagues"]');
    expect(dashboard).toContain('| "album" |');
    expect(dashboard).toContain('{ id: "album", label: "Album", icon: AlbumIcon, group: "workspace" }');
    expect(dashboard).toContain('tab === "album"');
    expect(tabs).toContain('{ id: "album",   label: "Album",   icon: AlbumIcon }');
  });
});
