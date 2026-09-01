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

  it("lists published albums publicly and returns database-checked photo URLs", async () => {
    fakeDb([
      [publicClub],
      [{ id: "album-1", clubId: "club-1", title: "Club Photos", description: null, eventDate: "2026-08-20", coverImageUrl: "/manus-storage/club-photos-default-cover_8e826089.jpg", createdByName: "Owner", createdAt: new Date("2026-08-20"), updatedAt: new Date("2026-08-20") }],
      [{ id: "photo-1", albumId: "album-1", url: "/manus-storage/secret.webp", caption: "Final round", altText: "Two players at board one", width: 1200, height: 800, sortOrder: 0, createdAt: new Date("2026-08-20") }],
    ]);

    const response = await fetch(`${baseUrl}/api/clubs/test-club/albums`);
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

  it("allows owners to remove one photo and delete an entire album", async () => {
    const photoDb = fakeDb([[publicClub]]);
    const photoDelete = await fetch(`${baseUrl}/api/clubs/test-club/albums/album-1/photos/photo-1`, {
      method: "DELETE",
      headers: { "x-test-user-id": "owner-1" },
    });
    expect(photoDelete.status).toBe(200);
    expect(photoDb.deleteWhere).toHaveBeenCalledTimes(1);

    const albumDb = fakeDb([[publicClub], [{ id: "album-1" }]]);
    const albumDelete = await fetch(`${baseUrl}/api/clubs/test-club/albums/album-1`, {
      method: "DELETE",
      headers: { "x-test-user-id": "owner-1" },
    });
    expect(albumDelete.status).toBe(200);
    expect(albumDb.deleteWhere).toHaveBeenCalledTimes(2);
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

  it("returns 404 after a photo row is removed and redirects only while the row exists", async () => {
    fakeDb([[publicClub], []]);
    const removed = await fetch(`${baseUrl}/api/clubs/test-club/albums/album-1/photos/photo-1/file`, { redirect: "manual" });
    expect(removed.status).toBe(404);
    expect(mocks.storageGetSignedUrl).not.toHaveBeenCalled();

    fakeDb([[publicClub], [{ storageKey: "club-albums/private-key.webp" }]]);
    const existing = await fetch(`${baseUrl}/api/clubs/test-club/albums/album-1/photos/photo-1/file`, { redirect: "manual" });
    expect(existing.status).toBe(307);
    expect(existing.headers.get("location")).toBe("https://signed.example.test/photo");
    expect(existing.headers.get("cache-control")).toBe("no-store");
    expect(mocks.storageGetSignedUrl).toHaveBeenCalledWith("club-albums/private-key.webp");
  });
});
