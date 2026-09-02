// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ClubAlbum } from "../client/src/lib/clubAlbumsApi";

const api = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  upload: vi.fn(),
  deletePhoto: vi.fn(),
  deleteAlbum: vi.fn(),
}));

vi.mock("../client/src/lib/clubAlbumsApi", () => ({
  apiListClubAlbums: api.list,
  apiCreateClubAlbum: api.create,
  apiUpdateClubAlbum: api.update,
  apiUploadClubAlbumPhoto: api.upload,
  apiDeleteClubAlbumPhoto: api.deletePhoto,
  apiDeleteClubAlbum: api.deleteAlbum,
}));

vi.mock("../client/src/components/PlayerAvatar", () => ({
  PlayerAvatar: ({ name }: { name: string }) => <div aria-label={`${name} avatar`} />,
}));

import { ClubAlbumTab, getCuratedClubAlbumCover, prepareClubAlbumPhoto } from "../client/src/components/club/ClubAlbumTab";

const baseProps = {
  clubId: "club-1",
  clubName: "1904 Chess Club",
  clubAvatarUrl: null,
  canManage: false,
  canUpload: false,
  currentUserName: "Owner",
  accent: "#4CAF50",
  isDark: true,
};

function albumWithPhotos(photoCount = 6): ClubAlbum {
  return {
    id: "album-1",
    clubId: "club-1",
    title: "Championship Night",
    description: "Final-round boards and the trophy presentation.",
    eventDate: "2026-08-24",
    coverImageUrl: null,
    createdByName: "Owner",
    createdAt: "2026-08-24T19:00:00.000Z",
    updatedAt: "2026-08-24T19:00:00.000Z",
    photos: Array.from({ length: photoCount }, (_, index) => ({
      id: `photo-${index + 1}`,
      albumId: "album-1",
      url: `/api/clubs/club-1/albums/album-1/photos/photo-${index + 1}/file`,
      caption: `Round photo ${index + 1}`,
      altText: `Players at round ${index + 1}`,
      width: 1600,
      height: 1000,
      sortOrder: index,
      createdAt: "2026-08-24T19:00:00.000Z",
    })),
  };
}

describe("ClubAlbumTab rendered behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.list.mockResolvedValue([]);
  });

  afterEach(() => cleanup());

  it("uses the supplied category artwork for tournament, league, and meetup album covers", () => {
    expect(getCuratedClubAlbumCover("Chess Tournaments")).toBe("/manus-storage/chess-tournaments_23c8b088.jpg");
    expect(getCuratedClubAlbumCover("Chess Leagues")).toBe("/manus-storage/chess-leagues_770bca1d.jpg");
    expect(getCuratedClubAlbumCover("Chess Club Meetups")).toBe("/manus-storage/chess-club-meetups_c17d81ae.jpg");
    expect(getCuratedClubAlbumCover("Club Photos")).toBeNull();
  });

  it("renders all three shared category albums for visitors without exposing owner controls", async () => {
    api.list.mockResolvedValue([
      { ...albumWithPhotos(0), id: "album-tournaments", title: "Chess Tournaments", coverImageUrl: null },
      { ...albumWithPhotos(0), id: "album-leagues", title: "Chess Leagues", coverImageUrl: null },
      { ...albumWithPhotos(0), id: "album-meetups", title: "Chess Club Meetups", coverImageUrl: null },
    ]);

    render(<ClubAlbumTab {...baseProps} canManage={false} />);

    expect(await screen.findByAltText("Chess Tournaments album cover")).toBeTruthy();
    expect(screen.getByAltText("Chess Leagues album cover")).toBeTruthy();
    expect(screen.getByAltText("Chess Club Meetups album cover")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /edit chess/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /delete chess/i })).toBeNull();
  });

  it("opens a shared category cover in the lightbox and exposes Upload Photos to active members", async () => {
    api.list.mockResolvedValue([{ ...albumWithPhotos(0), id: "album-tournaments", title: "Chess Tournaments", coverImageUrl: null }]);
    render(<ClubAlbumTab {...baseProps} canUpload />);

    fireEvent.click(await screen.findByRole("button", { name: "Open Chess Tournaments album" }));
    expect(await screen.findByRole("dialog")).toBeTruthy();
    expect(within(screen.getByRole("dialog")).getByAltText("Chess Tournaments album cover")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Upload photos to Chess Tournaments" }));
    expect(await screen.findByRole("heading", { name: "Upload photos to Chess Tournaments" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Choose event photos" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Upload photos" })).toBeTruthy();
  });

  it.each([375, 1440])("keeps shared Album lightbox and upload controls accessible at a %ipx viewport", async (width) => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
    window.dispatchEvent(new Event("resize"));
    api.list.mockResolvedValue([{ ...albumWithPhotos(0), id: "album-meetups", title: "Chess Club Meetups", coverImageUrl: null }]);

    render(<ClubAlbumTab {...baseProps} canUpload />);

    fireEvent.click(await screen.findByRole("button", { name: "Open Chess Club Meetups album" }));
    const gallery = await screen.findByRole("dialog");
    expect(within(gallery).getByRole("button", { name: "Upload photos to Chess Club Meetups" })).toBeTruthy();
    expect(within(gallery).getByRole("button", { name: "Close photo viewer" })).toBeTruthy();
  });

  it("keeps all three shared category albums editable and deletable for club owners", async () => {
    api.list.mockResolvedValue([
      { ...albumWithPhotos(0), id: "album-tournaments", title: "Chess Tournaments", coverImageUrl: null },
      { ...albumWithPhotos(0), id: "album-leagues", title: "Chess Leagues", coverImageUrl: null },
      { ...albumWithPhotos(0), id: "album-meetups", title: "Chess Club Meetups", coverImageUrl: null },
    ]);

    render(<ClubAlbumTab {...baseProps} canManage />);

    await screen.findByAltText("Chess Tournaments album cover");
    for (const title of ["Chess Tournaments", "Chess Leagues", "Chess Club Meetups"]) {
      expect(screen.getByRole("button", { name: `Edit ${title}` })).toBeTruthy();
      expect(screen.getByRole("button", { name: `Delete ${title}` })).toBeTruthy();
    }
  });

  it("keeps a safe public empty state without exposing owner controls if the album service returns no records", async () => {
    render(<ClubAlbumTab {...baseProps} />);

    expect(await screen.findByText("No albums yet")).toBeTruthy();
    expect(screen.getByText("Event photos and club memories will appear here when the club shares them.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Create album" })).toBeNull();
  });

  it("renders an actionable error state and retries the public request", async () => {
    api.list.mockRejectedValueOnce(new Error("Album service unavailable")).mockResolvedValueOnce([]);
    render(<ClubAlbumTab {...baseProps} />);

    expect(await screen.findByText("Albums could not be loaded")).toBeTruthy();
    expect(screen.getByText("Album service unavailable")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));

    await waitFor(() => expect(api.list).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("No albums yet")).toBeTruthy();
  });

  it("renders a populated profile-style photo grid and opens a keyboard-navigable viewer", async () => {
    api.list.mockResolvedValue([albumWithPhotos()]);
    render(<ClubAlbumTab {...baseProps} />);

    expect((await screen.findAllByText("Championship Night")).length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Club photo grid")).toBeTruthy();
    expect(screen.getAllByText("6 photos").length).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByRole("button", { name: "Open Championship Night album" })[0]!);
    expect(await screen.findByText("1 of 6")).toBeTruthy();

    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(await screen.findByText("2 of 6")).toBeTruthy();
    expect(within(screen.getByRole("dialog")).getByAltText("Players at round 2")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Close photo viewer" }));
    await waitFor(() => expect(screen.queryByText("2 of 6")).toBeNull());
  });

  it("shows owner creation controls and an accessible album editor", async () => {
    render(<ClubAlbumTab {...baseProps} canManage />);

    const [createButton] = await screen.findAllByRole("button", { name: "Create album" });
    fireEvent.click(createButton);

    expect(await screen.findByRole("dialog")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Create album" })).toBeTruthy();
    expect(screen.getByLabelText("Album title")).toBeTruthy();
    expect(screen.getByLabelText(/Event date/)).toBeTruthy();
    expect(screen.getByLabelText(/Album caption/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Publish album" })).toBeTruthy();
  });

  it("renders the supplied Club Photos cover as a manageable default album card", async () => {
    api.list.mockResolvedValue([{ ...albumWithPhotos(0), title: "Club Photos", coverImageUrl: "/manus-storage/club-photos-default-cover_8e826089.jpg" }]);
    render(<ClubAlbumTab {...baseProps} canManage />);

    expect(await screen.findByAltText("Club Photos album cover")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Edit Club Photos" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Delete Club Photos" })).toBeTruthy();
  });

  it.each([375, 1440])("renders the complete public profile-grid contract at a %ipx viewport", async (width) => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
    window.dispatchEvent(new Event("resize"));
    api.list.mockResolvedValue([albumWithPhotos(3)]);

    render(<ClubAlbumTab {...baseProps} />);

    expect(await screen.findByRole("region", { name: "Albums" })).toBeTruthy();
    expect(screen.getByLabelText("Club photo grid")).toBeTruthy();
    expect(screen.getAllByText("Championship Night")).toHaveLength(3);
    expect(screen.getAllByRole("button").filter((button) => button.querySelector("img"))).toHaveLength(3);
    expect(screen.getAllByText("3 photos").length).toBeGreaterThan(0);
  });
});

describe("prepareClubAlbumPhoto behavior", () => {
  const originalCreateObjectUrl = URL.createObjectURL;
  const originalRevokeObjectUrl = URL.revokeObjectURL;
  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  const originalToBlob = HTMLCanvasElement.prototype.toBlob;
  const OriginalImage = globalThis.Image;

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectUrl;
    URL.revokeObjectURL = originalRevokeObjectUrl;
    HTMLCanvasElement.prototype.getContext = originalGetContext;
    HTMLCanvasElement.prototype.toBlob = originalToBlob;
    globalThis.Image = OriginalImage;
  });

  it("resizes oversized source photos and converts them to an upload-safe WebP payload", async () => {
    URL.createObjectURL = vi.fn(() => "blob:test-photo");
    URL.revokeObjectURL = vi.fn();
    const drawImage = vi.fn();
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({ drawImage } as unknown as CanvasRenderingContext2D));
    HTMLCanvasElement.prototype.toBlob = vi.fn((callback, type) => callback(new Blob(["optimized"], { type: type ?? "image/webp" })));

    class TestImage {
      naturalWidth = 4096;
      naturalHeight = 2048;
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;
      set src(_value: string) {
        queueMicrotask(() => this.onload?.());
      }
    }
    globalThis.Image = TestImage as unknown as typeof Image;

    const prepared = await prepareClubAlbumPhoto(new File(["source"], "final-round.jpg", { type: "image/jpeg", lastModified: 1 }));

    expect(prepared.width).toBe(2048);
    expect(prepared.height).toBe(1024);
    expect(prepared.caption).toBe("final round");
    expect(prepared.dataUrl).toMatch(/^data:image\/webp;base64,/);
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 2048, 1024);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:test-photo");
  });

  it("rejects unsupported image formats before decoding", async () => {
    const file = new File(["gif"], "animated.gif", { type: "image/gif" });
    await expect(prepareClubAlbumPhoto(file)).rejects.toThrow("not a supported JPEG, PNG, or WebP image");
  });
});
