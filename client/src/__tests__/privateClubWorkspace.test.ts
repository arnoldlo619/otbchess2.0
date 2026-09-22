import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../../..");
const app = readFileSync(resolve(root, "client/src/App.tsx"), "utf8");
const index = readFileSync(resolve(root, "client/src/pages/MyClubs.tsx"), "utf8");
const demo = readFileSync(resolve(root, "client/src/pages/ClubDashboardDemo.tsx"), "utf8");
const dashboard = readFileSync(resolve(root, "client/src/pages/ClubDashboard.tsx"), "utf8");
const profile = readFileSync(resolve(root, "client/src/pages/ClubProfile.tsx"), "utf8");
const wizard = readFileSync(resolve(root, "client/src/components/CreateClubWizard.tsx"), "utf8");
const registry = readFileSync(resolve(root, "client/src/lib/clubRegistry.ts"), "utf8");
const server = readFileSync(resolve(root, "server/clubs.ts"), "utf8");
const schema = readFileSync(resolve(root, "shared/schema.ts"), "utf8");

function routeBlock(path: string): string {
  const start = server.indexOf(`clubsRouter.get("${path}"`);
  const end = server.indexOf("});", start);
  return start >= 0 && end >= start ? server.slice(start, end + 3) : "";
}

describe("private Club workspace model", () => {
  it("registers an isolated public demo route before the dynamic Club profile route", () => {
    expect(app).toContain('const ClubDashboardDemo = lazy(() => import("./pages/ClubDashboardDemo"));');
    expect(app.indexOf('<Route path={"/clubs/demo"} component={ClubDashboardDemo} />'))
      .toBeLessThan(app.indexOf('<Route path={"/clubs/:id"} component={ClubProfile} />'));
    expect(demo).toContain("Read-only demo");
    expect(demo).toContain("Harbor Chess Club");
    expect(demo).not.toContain("/api/clubs");
  });

  it("renders only personal memberships in the Club index", () => {
    expect(index).toContain("apiListMyClubs()");
    expect(index).toContain("listMyClubs(user.id)");
    expect(index).toContain("Only clubs you own or belong to appear here.");
    expect(index).not.toContain("apiListPublicClubs");
  });

  it("locks new and cached Clubs to private visibility", () => {
    expect(wizard).toContain("Private workspace policy");
    expect(wizard).not.toContain('onClick={() => patch({ isPublic: !data.isPublic })}');
    expect(registry).toContain("isPublic: false,");
    expect(registry).toContain("const { isPublic: _ignoredVisibilityChange, ...safePatch } = patch;");
    expect(schema).toContain("isPublic: tinyint(\"is_public\").notNull().default(0)");
    expect(server).toContain("isPublic: 0,");
    expect(server).not.toContain('"isPublic",\n      "website"');
  });

  it("requires an authenticated owner or member for private Club reads", () => {
    expect(server).toContain("async function getAuthorizedClub");
    for (const path of ["/:id", "/:id/members", "/:id/events", "/:id/feed", "/:id/albums"]) {
      expect(routeBlock(path)).toContain("authMiddleware");
      expect(routeBlock(path)).toContain("getAuthorizedClub");
    }
    expect(server).toContain('res.status(404).json({ error: "Club not found" });');
  });

  it("keeps a purpose-limited QR join preview without reopening the workspace", () => {
    expect(routeBlock("/join-preview/:id")).toContain("joinPolicy: dbClubs.joinPolicy");
    expect(routeBlock("/join-preview/:id")).not.toContain("description:");
    expect(routeBlock("/join-preview/:id")).not.toContain("ownerId:");
    expect(dashboard).toContain("Never hydrate a private workspace");
    expect(profile).toContain("Private Club workspaces always resolve through the authorised server route.");
  });
});
