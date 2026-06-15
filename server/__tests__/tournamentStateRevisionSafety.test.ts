import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("tournament state revision conflict safety", () => {
  it("persists a monotonic tournament_state revision in schema and migrations", () => {
    const schema = readRepoFile("shared/schema.ts");
    const migration = readRepoFile("drizzle/0008_powerful_rogue.sql");
    const snapshot = readRepoFile("drizzle/meta/0008_snapshot.json");

    expect(schema).toContain('revision: int("revision").notNull().default(0)');
    expect(migration).toContain("ALTER TABLE `tournament_state` ADD `revision` int DEFAULT 0 NOT NULL");
    expect(snapshot).toContain('"revision"');
  });

  it("returns revisions and rejects stale state saves with 409 conflicts", () => {
    const server = readRepoFile("server/index.ts");
    const routeStart = server.indexOf('app.get("/api/tournament/:id/state"');
    const routeEnd = server.indexOf('app.get("/api/tournament/:id/live-state"');
    const routeSource = server.slice(routeStart, routeEnd);

    expect(routeSource).toContain("revision: rows[0].revision");
    expect(routeSource).toContain("baseRevision must be a non-negative integer");
    expect(routeSource).toContain("Tournament state already exists on the server");
    expect(routeSource).toContain('error: "revision_conflict"');
    expect(routeSource).toContain("res.status(409)");
    expect(routeSource).toContain("eq(tournamentState.revision, current.revision)");
  });

  it("sends the last known revision from the client when syncing director state", () => {
    const client = readRepoFile("client/src/lib/directorState.ts");

    expect(client).toContain("serverRevisionRef");
    expect(client).toContain("baseRevision: serverRevisionRef.current");
    expect(client).toContain("response.status === 409");
    expect(client).toContain("Stale tournament state save rejected");
  });
});
