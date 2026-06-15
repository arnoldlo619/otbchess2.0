import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
);

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("tournament player registration uniqueness hardening", () => {
  it("declares a database-level unique key for tournament username registrations", () => {
    const schema = readRepoFile("shared/schema.ts");
    const migration = readRepoFile(
      "drizzle/0007_unique_tournament_players.sql"
    );
    const snapshot = readRepoFile("drizzle/meta/0007_snapshot.json");

    expect(schema).toContain("uniqueTournamentUsername");
    expect(schema).toContain('uniqueIndex("tp_unique_tournament_username")');
    expect(schema).toMatch(
      /uniqueIndex\("tp_unique_tournament_username"\)\.on\(\s*table\.tournamentId,\s*table\.username\s*\)/
    );
    expect(migration).toContain("DELETE tp1 FROM `tournament_players` tp1");
    expect(migration).toContain(
      "ADD CONSTRAINT `tp_unique_tournament_username` UNIQUE(`tournament_id`,`username`)"
    );
    expect(snapshot).toContain('"tp_unique_tournament_username"');
  });

  it("uses an atomic upsert instead of check-then-insert for player joins", () => {
    const server = readRepoFile("server/index.ts");
    const routeStart = server.indexOf('app.post("/api/tournament/:id/players"');
    const routeEnd = server.indexOf(
      'app.post("/api/tournament/:id/players/warm-cache"'
    );
    const routeSource = server.slice(routeStart, routeEnd);

    expect(routeSource).toContain(".onDuplicateKeyUpdate({");
    expect(routeSource).toContain("const registrationPlayer = { ...player, username }");
    expect(routeSource).toContain("playerJson: JSON.stringify(registrationPlayer)");
    expect(routeSource).toContain("Player username cannot be empty");
    expect(routeSource).not.toContain("const existing = await db");
  });
});
