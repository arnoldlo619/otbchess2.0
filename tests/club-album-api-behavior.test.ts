import type { Server } from "node:http";
import express from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  storagePut: vi.fn(),
  storageGetSignedUrl: vi.fn(),
}));

vi.mock("../server/db.js", () => ({ getDb: mocks.getDb }));
vi.mock("../server/storage.js", () => ({
  storagePut: mocks.storagePut,
  storageGetSignedUrl: mocks.storageGetSignedUrl,
}));
vi.mock("../server/auth.js", () => {
  const testAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const userId = req.header("x-test-user-id");
    if (!userId) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    (req as express.Request & { userId?: string }).userId = userId;
    next();
  };
  return { requireAuth: testAuth, requireFullAuth: testAuth };
});

const publicClub = {
  id: "club-1",
  slug: "test-club",
  ownerId: "owner-1",
  ownerName: "Owner",
  isPublic: 1,
};

function queryBuilder(result: unknown) {
  const builder: Record<string, unknown> = {};
  builder.from = () => builder;
  builder.where = () => builder;
  builder.limit = async () => result;
  builder.orderBy = async () => result;
  builder.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(result).then(resolve, reject);
  return builder;
}

function fakeDb(results: unknown[][]) {
  const insertValues = vi.fn().mockResolvedValue(undefined);
  const updateWhere = vi.fn().mockResolvedValue(undefined);
  const deleteWhere = vi.fn().mockResolvedValue(undefined);
  const db = {
    select: vi.fn(() => queryBuilder(results.shift() ?? [])),
    insert: vi.fn(() => ({ values: insertValues })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: updateWhere })) })),
    delete: vi.fn(() => ({ where: deleteWhere })),
  };
  mocks.getDb.mockResolvedValue(db);
  return { db, insertValues, updateWhere, deleteWhere };
}

describe("Club Album API behavior", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const { clubsRouter } = await import("../server/clubs.js");
    const app = express();
    app.use(express.json({ limit: "15mb" }));
    app.use("/api/clubs", clubsRouter);
    await new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", () => resolve());
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Test server did not bind to a port");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.storageGetSignedUrl.mockResolvedValue("https://signed.example.test/photo");
    mocks.storagePut.mockResolvedValue({ key: "club-albums/key.webp", url: "/manus-storage/club-albums/key.webp" });
  });

  it("lists published albums for authorized members and returns database-checked photo URLs", async () => {
    fakeDb([
      [publicClub],
      [{ id: "album-1", clubId: "club-1", title: "Club Photos", description: null, eventDate: "2026-08-20", coverImageUrl: "/manus-storage/club-photos-default-cover_8e826089.jpg", createdByName: "Owner", createdAt: new Date("2026-08-20"), updatedAt: new Date("2026-08-20") }],
      [{ id: "photo-1", albumId: "album-1", url: "/manus-storage/secret.webp", caption: "Final round", altText: "Two players at board one", width: 1200, height: 800, sortOrder: 0, createdAt: new Date("2026-08-20") }],
    ]);

    const response = await fetch(`${baseUrl}/api/clubs/test-club/albums`, {
      headers: { "x-test-user-id": "owner-1" },
    });
    const body = await response.json() as { albums: Array<{ coverImageUrl: string | null; photos: Array<{ url: string }> }> };

    expect(response.status).toBe(200);
    expect(body.albums[0].coverImageUrl).toBe("/manus-storage/club-photos-default-cover_8e826089.jpg");
    expect(body.albums[0].photos[0].url).toBe("/api/clubs/club-1/albums/album-1/photos/photo-1/file");
    expect(JSON.stringify(body)).not.toContain("/manus-storage/secret.webp");
  });

  it("rejects unauthenticated album creation before touching the database", async () => {
    const response = await fetch(`${baseUrl}/api/clubs/test-club/albums`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Unauthorized" }),
    });

    expect(response.status).toBe(401);
    expect(mocks.getDb).not.toHaveBeenCalled();
  });

  it("rejects authenticated non-directors with 403", async () => {
    fakeDb([[publicClub], []]);
    const response = await fetch(`${baseUrl}/api/clubs/test-club/albums`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-test-user-id": "member-1" },
      body: JSON.stringify({ title: "Not allowed" }),
    });

    expect(response.status).toBe(403);
  });

  it("creates direct Club Event RSVP forms with the concise Meetup template", async () => {
    const createdForm = {
      id: "form-1", eventId: "event-1", clubId: "club-1", createdByUserId: "owner-1",
      title: "RSVP Form", description: null, questions: [], slug: "club-1-event-1-form-1",
      isPublished: 0, createdAt: new Date(), updatedAt: new Date(),
    };
    const { insertValues } = fakeDb([[publicClub], [], [], [createdForm]]);
    const response = await fetch(`${baseUrl}/api/clubs/club-1/events/event-1/rsvp-form`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-test-user-id": "owner-1" },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(201);
    expect(insertValues).toHaveBeenCalledWith(expect.objectContaining({
      questions: expect.arrayContaining([
        expect.objectContaining({ label: "Name", fieldKey: "respondentName", required: true }),
        expect.objectContaining({ label: "Chess.com username", required: false }),
        expect.objectContaining({ label: "What would you like to join?", options: ["Casual open play", "Casual tournament"] }),
        expect.objectContaining({ label: "Email address", fieldKey: "respondentEmail", required: true }),
      ]),
    }));
  });

  it("validates required album metadata and creates a valid owner album", async () => {
    fakeDb([[publicClub]]);
    const invalid = await fetch(`${baseUrl}/api/clubs/test-club/albums`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-test-user-id": "owner-1" },
      body: JSON.stringify({ title: "" }),
    });
    expect(invalid.status).toBe(400);

    const { insertValues } = fakeDb([[publicClub]]);
    const valid = await fetch(`${baseUrl}/api/clubs/test-club/albums`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-test-user-id": "owner-1" },
      body: JSON.stringify({ title: "Championship Night", eventDate: "2026-08-24", createdByName: "Owner" }),
    });

    expect(valid.status).toBe(201);
    expect(insertValues).toHaveBeenCalledWith(expect.objectContaining({
      clubId: "club-1",
      title: "Championship Night",
      eventDate: "2026-08-24",
      createdById: "owner-1",
    }));
  });

  it("allows owners to edit album metadata and rejects missing albums", async () => {
    const { updateWhere } = fakeDb([[publicClub], [{ id: "album-1", clubId: "club-1" }]]);
    const updated = await fetch(`${baseUrl}/api/clubs/test-club/albums/album-1`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-test-user-id": "owner-1" },
      body: JSON.stringify({ title: "Updated Club Night", description: "New caption", eventDate: "2026-08-25" }),
    });

    expect(updated.status).toBe(200);
    expect(updateWhere).toHaveBeenCalledTimes(1);

    fakeDb([[publicClub], []]);
    const missing = await fetch(`${baseUrl}/api/clubs/test-club/albums/missing`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-test-user-id": "owner-1" },
      body: JSON.stringify({ title: "Missing album" }),
    });
    expect(missing.status).toBe(404);
  });

  it("rejects unsupported image payloads without calling object storage", async () => {
    fakeDb([[publicClub], [{ id: "album-1" }]]);
    const response = await fetch(`${baseUrl}/api/clubs/test-club/albums/album-1/photos`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-test-user-id": "owner-1" },
      body: JSON.stringify({ dataUrl: "data:image/gif;base64,R0lGODlhAQABAIAAAAUEBA==" }),
    });

    expect(response.status).toBe(400);
    expect(mocks.storagePut).not.toHaveBeenCalled();
  });

  it("uploads validated owner photos without returning the underlying storage URL", async () => {
    const { insertValues } = fakeDb([[publicClub], [{ id: "album-1" }], [{ total: 0 }]]);
    const response = await fetch(`${baseUrl}/api/clubs/test-club/albums/album-1/photos`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-test-user-id": "owner-1" },
      body: JSON.stringify({
        dataUrl: `data:image/webp;base64,${Buffer.from("valid-image").toString("base64")}`,
        caption: "Board one",
        altText: "Two players at board one",
        width: 1200,
        height: 800,
      }),
    });
    const body = await response.json() as { photo: { url: string } };

    expect(response.status).toBe(201);
    expect(mocks.storagePut).toHaveBeenCalledWith(expect.stringMatching(/^club-albums\/club-1\/album-1\//), expect.any(Buffer), "image/webp");
    expect(insertValues).toHaveBeenCalledWith(expect.objectContaining({ storageKey: "club-albums/key.webp" }));
    expect(body.photo.url).toMatch(/^\/api\/clubs\/club-1\/albums\/album-1\/photos\/.+\/file$/);
    expect(JSON.stringify(body)).not.toContain("/manus-storage/");
  });

  it("allows active members to upload only into the shared category albums", async () => {
    const { insertValues } = fakeDb([
      [publicClub],
      [{ id: "album-tournaments", clubId: "club-1", title: "Chess Tournaments" }],
      [],
      [{ userId: "member-1" }],
      [{ total: 0 }],
    ]);
    const allowed = await fetch(`${baseUrl}/api/clubs/test-club/albums/album-tournaments/photos`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-test-user-id": "member-1" },
      body: JSON.stringify({ dataUrl: `data:image/webp;base64,${Buffer.from("member-image").toString("base64")}` }),
    });

    expect(allowed.status).toBe(201);
    expect(insertValues).toHaveBeenCalledWith(expect.objectContaining({ albumId: "album-tournaments", createdById: "member-1" }));

    fakeDb([
      [publicClub],
      [{ id: "album-private", clubId: "club-1", title: "Club Photos" }],
      [],
    ]);
    const blocked = await fetch(`${baseUrl}/api/clubs/test-club/albums/album-private/photos`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-test-user-id": "member-1" },
      body: JSON.stringify({ dataUrl: `data:image/webp;base64,${Buffer.from("member-image").toString("base64")}` }),
    });

    expect(blocked.status).toBe(403);
  });

  it("persists photo likes and author-attributed comments for active members", async () => {
    const photo = { id: "photo-1", albumId: "album-1", clubId: "club-1" };
    const likeDb = fakeDb([[publicClub], [photo], [], [{ count: 1 }]]);
    const liked = await fetch(`${baseUrl}/api/clubs/test-club/albums/album-1/photos/photo-1/like`, {
      method: "POST",
      headers: { "x-test-user-id": "owner-1" },
    });
    expect(liked.status).toBe(200);
    await expect(liked.json()).resolves.toEqual({ liked: true, likeCount: 1 });
    expect(likeDb.insertValues).toHaveBeenCalledWith(expect.objectContaining({
      photoId: "photo-1", albumId: "album-1", clubId: "club-1", userId: "owner-1",
    }));

    const commentDb = fakeDb([[publicClub], [photo], [{ displayName: "Owner", avatarUrl: "https://avatar.example.test/owner" }]]);
    const commented = await fetch(`${baseUrl}/api/clubs/test-club/albums/album-1/photos/photo-1/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-test-user-id": "owner-1" },
      body: JSON.stringify({ body: "Great final round." }),
    });
    const commentBody = await commented.json() as { comment: { authorDisplayName: string; body: string } };
    expect(commented.status).toBe(201);
    expect(commentBody.comment).toMatchObject({ authorDisplayName: "Owner", body: "Great final round." });
    expect(commentDb.insertValues).toHaveBeenCalledWith(expect.objectContaining({
      authorUserId: "owner-1", authorDisplayName: "Owner", body: "Great final round.",
    }));
  });

  it("allows the comment author or club moderator to remove a scoped photo comment", async () => {
    const photo = { id: "photo-1", albumId: "album-1", clubId: "club-1" };
    const commentDb = fakeDb([[publicClub], [photo], [{ id: "comment-1", authorUserId: "owner-1" }]]);
    const removed = await fetch(`${baseUrl}/api/clubs/test-club/albums/album-1/photos/photo-1/comments/comment-1`, {
      method: "DELETE",
      headers: { "x-test-user-id": "owner-1" },
    });
    expect(removed.status).toBe(200);
    expect(commentDb.deleteWhere).toHaveBeenCalledTimes(1);
  });

  it("allows owners to remove one photo and delete an entire album", async () => {
    const photoDb = fakeDb([[publicClub]]);
    const photoDelete = await fetch(`${baseUrl}/api/clubs/test-club/albums/album-1/photos/photo-1`, {
      method: "DELETE",
      headers: { "x-test-user-id": "owner-1" },
    });
    expect(photoDelete.status).toBe(200);
    expect(photoDb.deleteWhere).toHaveBeenCalledTimes(3);

    const albumDb = fakeDb([[publicClub], [{ id: "album-1" }]]);
    const albumDelete = await fetch(`${baseUrl}/api/clubs/test-club/albums/album-1`, {
      method: "DELETE",
      headers: { "x-test-user-id": "owner-1" },
    });
    expect(albumDelete.status).toBe(200);
    expect(albumDb.deleteWhere).toHaveBeenCalledTimes(4);
  });

  it("allows directors to create albums but blocks ordinary members from destructive actions", async () => {
    const directorDb = fakeDb([[publicClub], [{ role: "director" }]]);
    const directorCreate = await fetch(`${baseUrl}/api/clubs/test-club/albums`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-test-user-id": "director-1" },
      body: JSON.stringify({ title: "Director Album", createdByName: "Director" }),
    });
    expect(directorCreate.status).toBe(201);
    expect(directorDb.insertValues).toHaveBeenCalledTimes(1);

    fakeDb([[publicClub], []]);
    const memberDelete = await fetch(`${baseUrl}/api/clubs/test-club/albums/album-1`, {
      method: "DELETE",
      headers: { "x-test-user-id": "member-1" },
    });
    expect(memberDelete.status).toBe(403);
  });

  it("moves Club Event cover data into managed storage before inserting the event", async () => {
    const createdEvent = {
      id: "meetup-1", clubId: "club-1", title: "Sunday Chess", description: null,
      startAt: new Date("2026-10-11T20:00:00.000Z"), endAt: null, venue: null, address: null,
      admissionNote: null, coverImageUrl: "/manus-storage/club-events/club-1/meetup-1/cover.webp",
      accentColor: "#4CAF50", creatorId: "owner-1", creatorName: "Owner", isPublished: 1,
      eventType: "casual", tournamentId: null, recurrence: "none", recurrenceSeriesId: null,
      recurrenceEndDate: null, createdAt: new Date("2026-10-05T00:00:00.000Z"), updatedAt: new Date("2026-10-05T00:00:00.000Z"),
    };
    mocks.storagePut.mockResolvedValue({ key: "club-events/club-1/meetup-1/cover.webp", url: createdEvent.coverImageUrl });
    const { insertValues } = fakeDb([[publicClub], [], [], [createdEvent]]);
    const response = await fetch(`${baseUrl}/api/clubs/club-1/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-test-user-id": "owner-1" },
      body: JSON.stringify({
        id: "meetup-1",
        title: "Sunday Chess",
        startAt: "2026-10-11T20:00:00.000Z",
        creatorName: "Owner",
        eventType: "meetup",
        coverImageUrl: `data:image/webp;base64,${Buffer.from("event-cover").toString("base64")}`,
      }),
    });

    expect(response.status).toBe(201);
    expect(mocks.storagePut).toHaveBeenCalledWith(
      "club-events/club-1/meetup-1/cover.webp",
      expect.any(Buffer),
      "image/webp",
    );
    expect(insertValues).toHaveBeenCalledWith(expect.objectContaining({
      id: "meetup-1",
      clubId: "club-1",
      eventType: "casual",
      coverImageUrl: createdEvent.coverImageUrl,
    }));
    await expect(response.json()).resolves.toEqual(expect.objectContaining({
      id: "meetup-1",
      eventType: "casual",
      coverImageUrl: createdEvent.coverImageUrl,
    }));
  });

  it("rejects unsupported Club Event covers and returns an existing event for an idempotent retry", async () => {
    fakeDb([[publicClub], [], []]);
    const rejected = await fetch(`${baseUrl}/api/clubs/club-1/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-test-user-id": "owner-1" },
      body: JSON.stringify({
        id: "meetup-rejected",
        title: "Sunday Chess",
        startAt: "2026-10-11T20:00:00.000Z",
        coverImageUrl: "data:image/gif;base64,R0lGODlhAQABAIAAAAUEBA==",
      }),
    });
    expect(rejected.status).toBe(400);
    expect(mocks.storagePut).not.toHaveBeenCalled();

    const existingEvent = {
      id: "meetup-retry", clubId: "club-1", title: "Sunday Chess", startAt: new Date("2026-10-11T20:00:00.000Z"),
      endAt: null, createdAt: new Date("2026-10-05T00:00:00.000Z"), updatedAt: new Date("2026-10-05T00:00:00.000Z"),
    };
    const retryDb = fakeDb([[publicClub], [], [existingEvent]]);
    const retried = await fetch(`${baseUrl}/api/clubs/club-1/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-test-user-id": "owner-1" },
      body: JSON.stringify({ id: "meetup-retry", title: "Sunday Chess", startAt: "2026-10-11T20:00:00.000Z" }),
    });
    expect(retried.status).toBe(200);
    expect(retryDb.insertValues).not.toHaveBeenCalled();
    await expect(retried.json()).resolves.toEqual(expect.objectContaining({ id: "meetup-retry" }));
  });

  it("normalizes legacy Club Event types and rejects unsupported values", async () => {
    const { insertValues } = fakeDb([[publicClub], []]);
    const rejected = await fetch(`${baseUrl}/api/clubs/club-1/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-test-user-id": "owner-1" },
      body: JSON.stringify({
        id: "unsupported-event-type",
        title: "Unsupported event",
        startAt: "2026-10-11T20:00:00.000Z",
        eventType: "not-a-club-event",
      }),
    });

    expect(rejected.status).toBe(400);
    await expect(rejected.json()).resolves.toEqual({ error: "Event type is not supported" });
    expect(insertValues).not.toHaveBeenCalled();
  });

  it("returns 404 after a photo row is removed and redirects only while the row exists", async () => {
    fakeDb([[publicClub], []]);
    const removed = await fetch(`${baseUrl}/api/clubs/test-club/albums/album-1/photos/photo-1/file`, {
      redirect: "manual",
      headers: { "x-test-user-id": "owner-1" },
    });
    expect(removed.status).toBe(404);
    expect(mocks.storageGetSignedUrl).not.toHaveBeenCalled();

    fakeDb([[publicClub], [{ storageKey: "club-albums/private-key.webp" }]]);
    const existing = await fetch(`${baseUrl}/api/clubs/test-club/albums/album-1/photos/photo-1/file`, {
      redirect: "manual",
      headers: { "x-test-user-id": "owner-1" },
    });
    expect(existing.status).toBe(307);
    expect(existing.headers.get("location")).toBe("https://signed.example.test/photo");
    expect(existing.headers.get("cache-control")).toBe("no-store");
    expect(mocks.storageGetSignedUrl).toHaveBeenCalledWith("club-albums/private-key.webp");
  });
});
