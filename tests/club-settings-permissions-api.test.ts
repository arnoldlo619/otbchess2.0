import type { Server } from "http";
import express from "express";
import { type SQL, type SQLWrapper } from "drizzle-orm";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("../server/db.js", () => ({ getDb: mocks.getDb }));
vi.mock("../server/storage.js", () => ({ storagePut: vi.fn(), storageGetSignedUrl: vi.fn() }));
vi.mock("../server/logger.js", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock("../server/auth.js", () => {
  const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const userId = req.header("x-test-user-id");
    if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }
    (req as express.Request & { userId?: string }).userId = userId;
    next();
  };
  const requireFullAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.header("x-test-guest") === "true") {
      res.status(403).json({ error: "Guest forbidden", code: "GUEST_FORBIDDEN" }); return;
    }
    requireAuth(req, res, next);
  };
  return { requireAuth, requireFullAuth };
});

const club = { id: "club-1", slug: "test-club", name: "Test Club", ownerId: "owner-1", ownerName: "Owner", isPublic: 0, joinCode: "OTB-ABCD" };
const membership = (userId: string) => userId === "outsider-1" ? [] : [{ id: 1, clubId: club.id, userId, role: userId === "director-1" ? "director" : "member" }];
const form = { id: "form-1", eventId: "event-1", clubId: club.id, title: "Private RSVP", questions: [] };
const recap = { id: "recap-1", eventId: "event-1", clubId: club.id, generatedCaption: "Private recap" };
const invite = { id: "invite-1", clubId: club.id, token: "token-1", email: "person@example.test", status: "pending", expiresAt: new Date("2099-01-01") };
const dialect = new MySqlDialect();
const compile = (value: SQLWrapper) => dialect.sqlToQuery(value.getSQL());

type Query = { table?: unknown; predicate?: SQL; sql: string; params: unknown[] };
type Rows = unknown[] | ((query: Query) => unknown[]);

function fakeDb(results: Rows[] = []) {
  const queries: Query[] = [];
  const duplicateUpdate = vi.fn(async (options: { set: Record<string, SQL> }) => { void options; });
  const insertValues = vi.fn((values: unknown) => {
    void values;
    return {
      onDuplicateKeyUpdate: duplicateUpdate,
      then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(undefined).then(resolve, reject),
    };
  });
  const updateWhere = vi.fn(async (predicate: SQL) => { void predicate; });
  const updateSet = vi.fn((values: Record<string, unknown>) => { void values; return { where: updateWhere }; });
  const deleteWhere = vi.fn().mockResolvedValue(undefined);
  const db = {
    select: vi.fn(() => {
      const source = results.shift() ?? [];
      const query: Query = { sql: "", params: [] };
      const builder = {
        from: (table: unknown) => { query.table = table; return builder; },
        where: (predicate: SQL) => { query.predicate = predicate; Object.assign(query, compile(predicate)); queries.push(query); return builder; },
        limit: () => builder,
        orderBy: () => builder,
        then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(typeof source === "function" ? source(query) : source).then(resolve, reject),
      };
      return builder;
    }),
    insert: vi.fn(() => ({ values: insertValues })),
    update: vi.fn(() => ({ set: updateSet })),
    delete: vi.fn(() => ({ where: deleteWhere })),
  };
  mocks.getDb.mockResolvedValue(db);
  return { db, queries, insertValues, duplicateUpdate, updateSet, updateWhere, deleteWhere };
}

function expectNoWrites(mock: ReturnType<typeof fakeDb>) {
  expect(mock.db.insert).not.toHaveBeenCalled();
  expect(mock.db.update).not.toHaveBeenCalled();
  expect(mock.db.delete).not.toHaveBeenCalled();
}

function expectClubScope(query: Query, tableName: string, otherColumn: string, otherValue: string) {
  expect(query.sql).toContain(`\`${tableName}\`.\`club_id\` = ?`);
  expect(query.sql).toContain(`\`${tableName}\`.\`${otherColumn}\` = ?`);
  expect(query.sql).toContain(" and ");
  expect(query.params).toEqual(expect.arrayContaining([club.id, otherValue]));
}

const managementRoutes = [
  { method: "PATCH", path: "/club-1", body: { name: "Changed", ownerId: "member-1", role: "director" } },
  { method: "GET", path: "/club-1/join-code" },
  { method: "POST", path: "/club-1/join-code/rotate" },
  { method: "PATCH", path: "/club-1/transfer-ownership", body: { newOwnerId: "member-1" } },
  { method: "DELETE", path: "/club-1" },
  { method: "PATCH", path: "/club-1/members/member-2/role", body: { role: "director" } },
  { method: "GET", path: "/club-1/growth/analytics" },
  { method: "GET", path: "/club-1/growth/members" },
  { method: "GET", path: "/club-1/events/event-1/recap" },
  { method: "GET", path: "/club-1/events/event-1/rsvp-form" },
  { method: "GET", path: "/club-1/events/event-1/rsvp-form/responses" },
  { method: "GET", path: "/club-1/invites" },
  { method: "POST", path: "/club-1/invites", body: { email: "person@example.test", ownerId: "member-1", role: "director" } },
  { method: "DELETE", path: "/club-1/invites/token-1" },
];
const memberReadPaths = ["", "/members", "/presence", "/events", "/feed", "/events/event-1/rsvps", "/events/event-1/checkins", "/announcements", "/events/event-1/rsvp-form", "/seasons", "/albums"];

describe("Club settings API permissions", () => {
  let server: Server;
  let baseUrl: string;
  const request = (path: string, userId?: string, method = "GET", body?: unknown, guest = false) => fetch(`${baseUrl}/api/clubs${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(userId ? { "x-test-user-id": userId } : {}), ...(guest ? { "x-test-guest": "true" } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  beforeAll(async () => {
    const [{ clubsRouter }, { default: clubInvitesRouter, createInviteRouter }] = await Promise.all([import("../server/clubs.js"), import("../server/clubInvites.js")]);
    const app = express();
    app.use(express.json());
    app.use("/api/clubs", clubsRouter);
    app.use("/api/clubs/:clubId/invites", clubInvitesRouter);
    app.use("/api/invite", createInviteRouter());
    await new Promise<void>((resolve) => { server = app.listen(0, "127.0.0.1", resolve); });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Test server did not bind");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });
  afterAll(async () => { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); });
  beforeEach(() => { vi.clearAllMocks(); });

  for (const userId of ["member-1", "outsider-1"]) {
    it.each(managementRoutes)(`denies ${userId} $method $path without writes`, async ({ method, path, body }) => {
      const db = fakeDb([[club], membership(userId), membership(userId)]);
      const response = await request(path, userId, method, body);
      const privateWorkspaceRead = path === "/club-1/join-code" || path === "/club-1/events/event-1/rsvp-form";
      expect(response.status).toBe(privateWorkspaceRead && userId === "outsider-1" ? 404 : 403);
      expectNoWrites(db);
    });
  }

  it.each(managementRoutes)("rejects unauthenticated $method $path before DB access", async ({ method, path, body }) => {
    const response = await request(path, undefined, method, body);
    expect(response.status).toBe(401);
    expect(mocks.getDb).not.toHaveBeenCalled();
  });

  it.each(managementRoutes.filter(({ path }) => !path.endsWith("/responses")))("blocks guest $method $path before DB access", async ({ method, path, body }) => {
    const response = await request(path, "owner-1", method, body, true);
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "GUEST_FORBIDDEN" });
    expect(mocks.getDb).not.toHaveBeenCalled();
  });

  it.each(memberReadPaths)("hides private member resource /club-1%s from outsiders", async (path) => {
    const db = fakeDb([[club], []]);
    const response = await request(`/club-1${path}`, "outsider-1");
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Club not found" });
    expectNoWrites(db);
  });

  it.each(["owner-1", "director-1", "member-1"])("allows %s to read the private club workspace", async (userId) => {
    const db = fakeDb([[club], membership(userId)]);
    const response = await request("/club-1", userId);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ id: club.id, ownerId: club.ownerId });
    expectNoWrites(db);
  });

  it.each(["owner-1", "director-1"])("allows %s settings changes but never accepts owner/role/joinCode payload fields", async (userId) => {
    const db = fakeDb([[club], membership(userId), [{ ...club, name: "Changed" }]]);
    const response = await request("/club-1", userId, "PATCH", { name: "Changed", ownerId: "outsider-1", role: "owner", joinCode: "OTB-XXXX" });
    expect(response.status).toBe(200);
    expect(db.updateSet).toHaveBeenCalledWith({ name: "Changed" });
  });

  it.each(["owner-1", "director-1"])("allows %s to view an existing join code without writing", async (userId) => {
    const db = fakeDb([[club], membership(userId), membership(userId)]);
    const response = await request("/club-1/join-code", userId);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ code: club.joinCode });
    expectNoWrites(db);
  });

  it.each(managementRoutes.filter(({ path }) => ["/club-1/join-code/rotate", "/club-1/transfer-ownership", "/club-1/members/member-2/role"].includes(path)))("denies director escalation via $method $path", async ({ method, path, body }) => {
    const db = fakeDb([[club], membership("director-1")]);
    const response = await request(path, "director-1", method, body);
    expect(response.status).toBe(403);
    expectNoWrites(db);
  });

  it("denies director club deletion", async () => {
    const db = fakeDb([[club]]);
    expect((await request("/club-1", "director-1", "DELETE")).status).toBe(403);
    expectNoWrites(db);
  });

  it("allows owner code rotation", async () => {
    const db = fakeDb([[club], []]);
    const response = await request("/club-1/join-code/rotate", "owner-1", "POST");
    expect(response.status).toBe(200);
    expect(db.updateSet).toHaveBeenCalledWith({ joinCode: expect.stringMatching(/^OTB-[A-HJ-NP-Z2-9]{4}$/) });
  });

  it("allows owner transfer only to an existing member row (no active flag required)", async () => {
    const db = fakeDb([[club], membership("member-1"), membership("owner-1"), [{ ...club, ownerId: "member-1" }]]);
    const response = await request("/club-1/transfer-ownership", "owner-1", "PATCH", { newOwnerId: "member-1" });
    expect(response.status).toBe(200);
    expect(db.updateSet.mock.calls.map(([value]) => value)).toEqual([{ ownerId: "member-1" }, { role: "owner" }, { role: "member" }]);
    expect(db.db.insert).not.toHaveBeenCalled();
  });

  it("rejects owner transfer to a non-member without writes", async () => {
    const db = fakeDb([[club], []]);
    expect((await request("/club-1/transfer-ownership", "owner-1", "PATCH", { newOwnerId: "outsider-1" })).status).toBe(400);
    expectNoWrites(db);
  });

  it("allows owner deletion", async () => {
    const db = fakeDb([[club], [], [], []]);
    expect((await request("/club-1", "owner-1", "DELETE")).status).toBe(200);
    expect(db.db.delete).toHaveBeenCalled();
  });

  it.each([{ userId: "owner-1", role: "director" }, { userId: "director-1", role: "member" }])("allows $userId role change to $role", async ({ userId, role }) => {
    const db = fakeDb([[club], membership(userId)]);
    expect((await request("/club-1/members/member-2/role", userId, "PATCH", { role })).status).toBe(200);
    expect(db.updateSet).toHaveBeenCalledWith({ role });
  });

  it("never lets a manager change the stored owner's role", async () => {
    const db = fakeDb([[club], membership("owner-1")]);
    expect((await request("/club-1/members/owner-1/role", "owner-1", "PATCH", { role: "member" })).status).toBe(400);
    expectNoWrites(db);
  });

  it("broadcasts persisted role changes to an authorized open dashboard", async () => {
    fakeDb([[club]]);
    const controller = new AbortController();
    const stream = await fetch(`${baseUrl}/api/clubs/club-1/stream`, { headers: { "x-test-user-id": "owner-1" }, signal: controller.signal });
    const reader = stream.body!.getReader();
    try {
      await reader.read(); // Initial connected comment.
      fakeDb([[club], membership("owner-1")]);
      expect((await request("/club-1/members/director-1/role", "owner-1", "PATCH", { role: "member" })).status).toBe(200);
      const chunk = await reader.read();
      expect(new TextDecoder().decode(chunk.value)).toContain('event: member_role_changed\ndata: {"userId":"director-1","role":"member"}');
    } finally {
      await reader.cancel();
      controller.abort();
    }
  });

  for (const userId of ["owner-1", "director-1"]) {
    it.each(["/growth/analytics", "/growth/members"])(`allows ${userId} manager read %s`, async (path) => {
      const db = fakeDb([[club], membership(userId), [], [], [], [], []]);
      expect((await request(`/club-1${path}`, userId)).status).toBe(200);
      expectNoWrites(db);
    });
    it.each(["GET", "POST", "DELETE"])(`allows ${userId} invite CRUD %s using stored authority`, async (method) => {
      const db = fakeDb([[club], ...(userId === "owner-1" ? [] : [membership(userId)]), [invite]]);
      const response = await request(`/club-1/invites${method === "DELETE" ? "/token-1" : ""}`, userId, method, method === "POST" ? { email: "PERSON@example.test", invitedBy: "outsider-1" } : undefined);
      expect(response.status).toBe(200);
      if (method === "GET") {
        expect(await response.json()).toEqual([expect.objectContaining({ id: invite.id })]);
        expectNoWrites(db);
      } else {
        expectClubScope({ ...compile(db.updateWhere.mock.calls[0][0]) }, "club_invites", method === "POST" ? "email" : "token", method === "POST" ? "person@example.test" : "token-1");
        if (method === "POST") expect(db.insertValues).toHaveBeenCalledWith(expect.objectContaining({ clubId: club.id, invitedBy: userId, email: "person@example.test" }));
      }
      if (userId === "director-1") expectClubScope(db.queries[1], "club_members", "user_id", userId);
    });
    it(`allows ${userId} to read this club's existing recap`, async () => {
      const db = fakeDb([[club], membership(userId), [recap]]);
      const response = await request("/club-1/events/event-1/recap", userId);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(recap);
      expectClubScope(db.queries[2], "event_recaps", "event_id", "event-1");
      expectNoWrites(db);
    });
    it(`allows ${userId} to read this club's RSVP responses`, async () => {
      const db = fakeDb([[club], membership(userId), [form], [{ id: "response-1" }]]);
      const response = await request("/club-1/events/event-1/rsvp-form/responses", userId);
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ form, total: 1 });
      expectClubScope(db.queries[2], "rsvp_forms", "event_id", "event-1");
      expectClubScope(db.queries[3], "rsvp_form_responses", "form_id", form.id);
      expectNoWrites(db);
    });
  }

  it.each(["GET", "POST", "DELETE"])("returns 404 for invite %s on a missing club without writes", async (method) => {
    const db = fakeDb([[]]);
    expect((await request(`/missing/invites${method === "DELETE" ? "/token-1" : ""}`, "owner-1", method, method === "POST" ? { email: "person@example.test" } : undefined)).status).toBe(404);
    expectNoWrites(db);
  });

  it.each(["GET", "POST", "DELETE"])("handles DB availability failure for invite %s", async (method) => {
    mocks.getDb.mockRejectedValueOnce(new Error("DB unavailable"));
    const response = await request(`/club-1/invites${method === "DELETE" ? "/token-1" : ""}`, "owner-1", method, method === "POST" ? { email: "person@example.test" } : undefined);
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ error: expect.stringContaining("Failed to") });
  });

  it.each(["POST", "DELETE"])("handles invite %s write failure without an unhandled rejection", async (method) => {
    const db = fakeDb([[club]]);
    db.updateWhere.mockRejectedValueOnce(new Error("write failed"));
    expect((await request(`/club-1/invites${method === "DELETE" ? "/token-1" : ""}`, "owner-1", method, method === "POST" ? { email: "person@example.test" } : undefined)).status).toBe(500);
    expect(db.db.insert).not.toHaveBeenCalled();
  });

  it("does not trust a stale owner membership role for invite authority", async () => {
    const db = fakeDb([[club], [{ role: "owner", userId: "former-owner" }]]);
    expect((await request("/club-1/invites", "former-owner")).status).toBe(403);
    expectNoWrites(db);
  });

  it("preserves standalone public invite lookup and authenticated acceptance", async () => {
    const lookupDb = fakeDb([[invite]]);
    const lookup = await fetch(`${baseUrl}/api/invite/token-1`);
    expect(lookup.status).toBe(200);
    expect(await lookup.json()).toMatchObject({ id: invite.id, clubId: club.id });
    expectNoWrites(lookupDb);
    const acceptDb = fakeDb([[invite]]);
    const accepted = await fetch(`${baseUrl}/api/invite/token-1/accept`, { method: "POST", headers: { "x-test-user-id": "outsider-1" } });
    expect(accepted.status).toBe(200);
    expect(acceptDb.updateSet).toHaveBeenCalledWith(expect.objectContaining({ status: "accepted" }));
    expect(acceptDb.db.select).toHaveBeenCalledTimes(1);
  });

  it("skips sync with forged submitted ownership of a stored club without writes", async () => {
    const db = fakeDb([[club]]);
    const response = await request("/sync", "outsider-1", "POST", { clubs: [{ ...club, ownerId: "outsider-1", name: "Hijacked" }] });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ upserted: 0 });
    expectNoWrites(db);
  });

  it("skips sync entries that do not claim the authenticated owner before any lookup/write", async () => {
    const db = fakeDb();
    expect(await (await request("/sync", "outsider-1", "POST", { clubs: [club] })).json()).toEqual({ upserted: 0 });
    expect(db.db.select).not.toHaveBeenCalled();
    expectNoWrites(db);
  });

  it.each(["owner-1", "outsider-1"])("skips unique-slug collisions even when the colliding row belongs to %s", async (collidingOwner) => {
    const db = fakeDb([[{ ...club, id: "other-club", ownerId: collidingOwner }]]);
    const response = await request("/sync", "owner-1", "POST", { clubs: [club] });
    expect(await response.json()).toEqual({ upserted: 0 });
    expect(db.queries[0].sql).toContain(" or ");
    expect(db.queries[0].params).toEqual([club.id, club.slug]);
    expectNoWrites(db);
  });

  it.each([{ existingRows: [] }, { existingRows: [club] }])("preserves owner migration/new club and guards every duplicate assignment", async ({ existingRows }) => {
    const db = fakeDb([existingRows]);
    const response = await request("/sync", "owner-1", "POST", { clubs: [{ ...club, name: "Updated", memberCount: 7 }] });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ upserted: 1 });
    expect(db.insertValues).toHaveBeenCalledWith(expect.objectContaining({ id: club.id, ownerId: "owner-1", name: "Updated", isPublic: 0 }));
    const { set } = db.duplicateUpdate.mock.calls[0][0] as { set: Record<string, SQL> };
    expect(Object.keys(set).sort()).toEqual(["name", "tagline", "description", "location", "memberCount", "isPublic", "announcement"].sort());
    for (const [key, value] of Object.entries(set)) {
      const compiled = compile(value);
      const column = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
      expect(compiled.sql).toBe(`IF(\`clubs\`.\`id\` = ? AND \`clubs\`.\`owner_id\` = ?, ?, \`clubs\`.\`${column}\`)`);
      expect(compiled.params.slice(0, 2)).toEqual([club.id, "owner-1"]);
    }
  });

  it.each([
    { label: "ownership transfer after precheck", stored: { ...club, ownerId: "new-owner" } },
    { label: "racing slug collision owned by someone else", stored: { ...club, id: "other-club", ownerId: "outsider-1" } },
    { label: "racing slug collision owned by requester", stored: { ...club, id: "other-club" } },
  ])("preserves the stored duplicate row during $label", async ({ stored }) => {
    const db = fakeDb([[club]]);
    const before = { ...stored };
    db.duplicateUpdate.mockImplementationOnce(async ({ set }: { set: Record<string, SQL> }) => {
      // Execute the exact compiled conditional's branches against a row that
      // changed after the SELECT; unguarded assignments fail this mock.
      for (const [column, value] of Object.entries(set)) {
        const guarded = compile(value);
        expect(guarded.sql).toMatch(/^IF\(`clubs`\.`id` = \? AND `clubs`\.`owner_id` = \?, \?, `clubs`\.`[^`]+`\)$/);
        if (stored.id === guarded.params[0] && stored.ownerId === guarded.params[1]) {
          (stored as Record<string, unknown>)[column] = guarded.params[2];
        }
      }
    });
    expect((await request("/sync", "owner-1", "POST", { clubs: [{ ...club, name: "Hijacked" }] })).status).toBe(200);
    expect(db.duplicateUpdate).toHaveBeenCalledTimes(1);
    expect(stored).toEqual(before);
  });

  it.each(["/events/foreign-event/recap", "/events/foreign-event/rsvp-form/responses", "/events/foreign-event/rsvp-form"])("returns 404 for another club's event data via %s without writes", async (path) => {
    // The mock acts as a DB filter: an event-only predicate would leak foreign data.
    const foreignRows = (table: string, row: unknown) => (query: Query) => query.sql.includes(`\`${table}\`.\`club_id\` = ?`) && query.params.includes(club.id) ? [] : [row];
    const db = path.endsWith("/recap")
      ? fakeDb([[club], [], foreignRows("event_recaps", { ...recap, clubId: "foreign-club" }), foreignRows("club_events", { id: "foreign-event", clubId: "foreign-club" })])
      : fakeDb([[club], ...(path.endsWith("/responses") ? [[]] : []), foreignRows("rsvp_forms", { ...form, clubId: "foreign-club" })]);
    const response = await request(`/club-1${path}`, "owner-1");
    expect(response.status).toBe(404);
    expectNoWrites(db);
    if (path.endsWith("/recap")) {
      expectClubScope(db.queries[2], "event_recaps", "event_id", "foreign-event");
      expectClubScope(db.queries[3], "club_events", "id", "foreign-event");
    }
  });

  it("scopes recap generation event and attendance reads to this club", async () => {
    const db = fakeDb([[club], [], [], [{ id: "event-1", clubId: club.id, title: "Meetup", startAt: new Date("2026-01-01") }], [], [recap]]);
    const response = await request("/club-1/events/event-1/recap", "owner-1");
    expect(response.status).toBe(201);
    expectClubScope(db.queries[3], "club_events", "id", "event-1");
    expectClubScope(db.queries[4], "meetup_checkins", "event_id", "event-1");
    expect(db.insertValues).toHaveBeenCalledWith(expect.objectContaining({ clubId: club.id, eventId: "event-1", attendanceCount: 0 }));
  });

  it.each(["owner-1", "director-1"])("scopes %s form-editor reads and embedded responses to their club", async (userId) => {
    const isOwner = userId === "owner-1";
    const db = fakeDb([[club], ...(isOwner ? [] : [membership(userId), membership(userId)]), [form], []]);
    expect((await request("/club-1/events/event-1/rsvp-form", userId)).status).toBe(200);
    expectClubScope(db.queries[isOwner ? 1 : 3], "rsvp_forms", "event_id", "event-1");
    expectClubScope(db.queries[isOwner ? 2 : 4], "rsvp_form_responses", "form_id", form.id);
    expectNoWrites(db);
  });
});
