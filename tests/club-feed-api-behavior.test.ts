import type { Server } from "http";
import express from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  storagePut: vi.fn(),
  storageGetSignedUrl: vi.fn(),
}));

vi.mock("../server/db.js", () => ({ getDb: mocks.getDb }));
vi.mock("../server/storage.js", () => ({ storagePut: mocks.storagePut, storageGetSignedUrl: mocks.storageGetSignedUrl }));
vi.mock("../server/auth.js", () => {
  const testAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const userId = req.header("x-test-user-id");
    if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }
    (req as express.Request & { userId?: string }).userId = userId;
    next();
  };
  return { requireAuth: testAuth, requireFullAuth: testAuth };
});

const club = { id: "club-1", slug: "test-club", ownerId: "owner-1", ownerName: "Owner", isPublic: 1 };

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
  const deleteWhere = vi.fn().mockResolvedValue(undefined);
  const db = {
    select: vi.fn(() => queryBuilder(results.shift() ?? [])),
    insert: vi.fn(() => ({ values: insertValues })),
    delete: vi.fn(() => ({ where: deleteWhere })),
  };
  mocks.getDb.mockResolvedValue(db);
  return { db, insertValues, deleteWhere };
}

describe("Club Feed API behavior", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const { clubsRouter } = await import("../server/clubs.js");
    const app = express();
    app.use(express.json({ limit: "25mb" }));
    app.use("/api/clubs", clubsRouter);
    await new Promise<void>((resolve) => { server = app.listen(0, "127.0.0.1", resolve); });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Test server did not bind to a port");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.storagePut.mockResolvedValue({ key: "club-feed/private.webp", url: "/manus-storage/club-feed/private.webp" });
    mocks.storageGetSignedUrl.mockResolvedValue("https://signed.example.test/feed-file");
  });

  it("rejects unauthenticated Feed publishing before touching the database", async () => {
    const response = await fetch(`${baseUrl}/api/clubs/test-club/feed`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "announcement", detail: "Hello" }) });
    expect(response.status).toBe(401);
    expect(mocks.getDb).not.toHaveBeenCalled();
  });

  it("allows an active member to publish a post with a proxied image attachment", async () => {
    const { insertValues } = fakeDb([[club], [{ id: "member-1" }], [{ id: "feed-1", clubId: "club-1", type: "announcement", actorName: "Member", isPinned: 0, createdBy: "member-1", createdAt: new Date("2026-09-01") }]]);
    const response = await fetch(`${baseUrl}/api/clubs/club-1/feed`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-test-user-id": "member-1" },
      body: JSON.stringify({ type: "announcement", actorName: "Member", detail: "Friday analysis session", attachments: [{ fileName: "board.webp", mimeType: "image/webp", dataUrl: `data:image/webp;base64,${Buffer.from("image-bytes").toString("base64")}` }] }),
    });
    const body = await response.json() as { attachments: Array<{ url: string }> };
    expect(response.status).toBe(201);
    expect(mocks.storagePut).toHaveBeenCalledWith(expect.stringMatching(/^club-feed\/club-1\//), expect.any(Buffer), "image/webp");
    expect(insertValues).toHaveBeenCalledWith(expect.objectContaining({ createdBy: "member-1", feedId: expect.any(String), storageKey: "club-feed/private.webp" }));
    expect(body.attachments[0]?.url).toMatch(/^\/api\/clubs\/club-1\/feed\/.+\/attachments\/.+\/file$/);
    expect(JSON.stringify(body)).not.toContain("/manus-storage/");
  });

  it("rejects non-members and disallowed attachment formats without uploading", async () => {
    fakeDb([[club], []]);
    const forbidden = await fetch(`${baseUrl}/api/clubs/test-club/feed`, { method: "POST", headers: { "Content-Type": "application/json", "x-test-user-id": "outsider-1" }, body: JSON.stringify({ type: "announcement", detail: "No access" }) });
    expect(forbidden.status).toBe(403);

    fakeDb([[club], [{ id: "member-1" }]]);
    const invalid = await fetch(`${baseUrl}/api/clubs/test-club/feed`, { method: "POST", headers: { "Content-Type": "application/json", "x-test-user-id": "member-1" }, body: JSON.stringify({ type: "announcement", detail: "Bad file", attachments: [{ fileName: "unsafe.exe", mimeType: "application/x-msdownload", dataUrl: "data:application/x-msdownload;base64,AA==" }] }) });
    expect(invalid.status).toBe(400);
    expect(mocks.storagePut).not.toHaveBeenCalled();
  });

  it("enforces original-author-or-club-owner deletion and scopes posts to the club", async () => {
    fakeDb([[club], [{ id: "feed-1", clubId: "club-1", createdBy: "author-1" }]]);
    const otherMember = await fetch(`${baseUrl}/api/clubs/test-club/feed/feed-1`, { method: "DELETE", headers: { "x-test-user-id": "director-1" } });
    expect(otherMember.status).toBe(403);

    const authorDb = fakeDb([[club], [{ id: "feed-1", clubId: "club-1", createdBy: "author-1" }]]);
    const authorDelete = await fetch(`${baseUrl}/api/clubs/test-club/feed/feed-1`, { method: "DELETE", headers: { "x-test-user-id": "author-1" } });
    expect(authorDelete.status).toBe(200);
    expect(authorDb.deleteWhere).toHaveBeenCalledTimes(2);

    const ownerDb = fakeDb([[club], [{ id: "feed-1", clubId: "club-1", createdBy: "author-1" }]]);
    const ownerDelete = await fetch(`${baseUrl}/api/clubs/test-club/feed/feed-1`, { method: "DELETE", headers: { "x-test-user-id": "owner-1" } });
    expect(ownerDelete.status).toBe(200);
    expect(ownerDb.deleteWhere).toHaveBeenCalledTimes(2);

    fakeDb([[club], []]);
    const wrongClub = await fetch(`${baseUrl}/api/clubs/test-club/feed/missing`, { method: "DELETE", headers: { "x-test-user-id": "owner-1" } });
    expect(wrongClub.status).toBe(404);
  });

  it("only redirects to attachment storage while the attachment row remains and the viewer is an active member", async () => {
    fakeDb([[club], [{ id: "member-1" }], []]);
    const removed = await fetch(`${baseUrl}/api/clubs/test-club/feed/feed-1/attachments/file-1/file`, { headers: { "x-test-user-id": "member-1" }, redirect: "manual" });
    expect(removed.status).toBe(404);
    expect(mocks.storageGetSignedUrl).not.toHaveBeenCalled();

    fakeDb([[club], [{ id: "member-1" }], [{ id: "file-1", feedId: "feed-1", clubId: "club-1", storageKey: "club-feed/private.webp" }]]);
    const existing = await fetch(`${baseUrl}/api/clubs/test-club/feed/feed-1/attachments/file-1/file`, { headers: { "x-test-user-id": "member-1" }, redirect: "manual" });
    expect(existing.status).toBe(307);
    expect(existing.headers.get("location")).toBe("https://signed.example.test/feed-file");
    expect(existing.headers.get("cache-control")).toBe("no-store");
  });
});
