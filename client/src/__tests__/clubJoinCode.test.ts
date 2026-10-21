import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../../..");
const read = (relativePath: string) => readFileSync(resolve(root, relativePath), "utf8");

const schema = read("shared/schema.ts");
const migration = read("drizzle/0028_club_join_codes.sql");
const journal = read("drizzle/meta/_journal.json");
const server = read("server/clubs.ts");
const clientApi = read("client/src/lib/clubsApi.ts");
const myClubs = read("client/src/pages/MyClubs.tsx");
const dashboard = read("client/src/pages/ClubDashboard.tsx");
const joinClub = read("client/src/pages/JoinClub.tsx");
const app = read("client/src/App.tsx");
const dialog = read("client/src/components/club/JoinClubByCodeDialog.tsx");
const projection = read("client/src/components/club/ClubQRProjectionModal.tsx");

function routeBlock(method: "get" | "post", path: string): string {
  const marker = `clubsRouter.${method}("${path}"`;
  const start = server.indexOf(marker);
  const nextRoute = server.indexOf("clubsRouter.", start + marker.length);
  return start >= 0 ? server.slice(start, nextRoute === -1 ? undefined : nextRoute) : "";
}

describe("Club Code invitations", () => {
  it("persists a unique, nullable Code for safe rollout to existing Clubs", () => {
    expect(schema).toContain('joinCode: varchar("join_code", { length: 8 })');
    expect(schema).toContain('uniqueIndex("clubs_join_code_unique").on(table.joinCode)');
    expect(migration).toContain("ALTER TABLE `clubs` ADD `join_code` varchar(8)");
    expect(migration).toContain("CREATE UNIQUE INDEX `clubs_join_code_unique`");
    expect(journal).toContain('"tag": "0028_club_join_codes"');
  });

  it("uses a compact ambiguous-character-free OTB Code and provisions it at Club creation", () => {
    expect(server).toContain('const CLUB_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"');
    expect(server).toContain('const CLUB_CODE_PATTERN = /^OTB-[A-HJ-NP-Z2-9]{4}$/');
    expect(server).toContain("const joinCode = await generateAvailableClubCode(db);");
    expect(server).toContain("joinCode,");
    expect(server).toContain("async function ensureClubJoinCode");
  });

  it("limits Code preview data and requires full authentication to redeem it", () => {
    const preview = routeBlock("get", "/join-preview/code/:code");
    const join = routeBlock("post", "/join-by-code");
    expect(preview).toContain("normalizeClubCode(req.params.code)");
    expect(preview).toContain("res.json(clubJoinPreview(club))");
    expect(preview).not.toContain("ownerId:");
    expect(join).toContain("requireFullAuth");
    expect(join).toContain("joinClubMember(db, club, userId, req.body ?? {})");
    expect(join).toContain("alreadyMember");
  });

  it("keeps Code visibility manager-scoped and Code rotation owner-scoped", () => {
    const view = routeBlock("get", "/:id/join-code");
    const rotate = routeBlock("post", "/:id/join-code/rotate");
    expect(view).toContain('membership?.role !== "director"');
    expect(view).toContain("ensureClubJoinCode(access.db, access.club)");
    expect(rotate).toContain("club.ownerId !== userId");
    expect(rotate).toContain("generateAvailableClubCode(db)");
  });

  it("does not include the Code in the standard Club serialization", () => {
    const mapperStart = server.indexOf("function dbRowToClub");
    const mapperEnd = server.indexOf("const ONLINE_THRESHOLD_MS", mapperStart);
    const mapper = server.slice(mapperStart, mapperEnd);
    expect(mapper).not.toContain("joinCode");
  });

  it("exposes typed Code API calls and a two-step accessible join dialog", () => {
    expect(clientApi).toContain("export async function apiPreviewClubCode");
    expect(clientApi).toContain("export async function apiJoinClubByCode");
    expect(clientApi).toContain("export async function apiGetClubJoinCode");
    expect(clientApi).toContain("export async function apiRotateClubJoinCode");
    expect(dialog).toContain("useAccessibleOverlay({");
    expect(dialog).toContain('role="dialog"');
    expect(dialog).toContain('aria-modal="true"');
    expect(dialog).toContain("Find club");
    expect(dialog).toContain("Join club");
    expect(dialog).toContain("Use another code");
  });

  it("adds Join a club to the empty Club workspace and navigates after a successful redemption", () => {
    expect(myClubs).toContain("JoinClubByCodeDialog");
    expect(myClubs).toContain("Join a club");
    expect(myClubs).toContain("onJoin={() => setShowJoinDialog(true)}");
    expect(myClubs).toContain("navigate(`/clubs/${club.id}/home`)");
  });

  it("uses Code-backed QR links in Settings, the dashboard QR screen, and deep link routing", () => {
    expect(dashboard).toContain('data-testid="club-code-settings"');
    expect(dashboard).toContain("const joinUrl = clubJoinCode");
    expect(dashboard).toContain("/join-club/code/${encodeURIComponent(clubJoinCode)}");
    expect(dashboard).toContain("Generating a private Club Code invitation…");
    expect(dashboard).toContain("Rotate code");
    expect(projection).toContain("apiGetClubJoinCode");
    expect(projection).toContain("Club Code");
    expect(app.indexOf('<Route path={"/join-club/code/:code"} component={JoinClub} />'))
      .toBeLessThan(app.indexOf('<Route path={"/join-club/:clubId"} component={JoinClub} />'));
    expect(joinClub).toContain("apiJoinClubByCode");
    expect(joinClub).toContain("apiPreviewClubCode");
    expect(joinClub).toContain("isCodeJoin");
  });
});
