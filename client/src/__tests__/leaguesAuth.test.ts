/**
 * Tests for the leagues auth middleware fix.
 * Validates that:
 * 1. requireAuth middleware is applied to all write endpoints
 * 2. Public GET endpoints remain accessible without auth
 * 3. Frontend fetch calls include credentials: "include"
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const leaguesServerPath = resolve(__dirname, "../../../server/leagues.ts");
const leaguesServerCode = readFileSync(leaguesServerPath, "utf-8");

const leagueDashboardPath = resolve(__dirname, "../pages/LeagueDashboard.tsx");
const leagueDashboardCode = readFileSync(leagueDashboardPath, "utf-8");

const clubProfilePath = resolve(__dirname, "../pages/ClubProfile.tsx");
const clubProfileCode = readFileSync(clubProfilePath, "utf-8");

describe("Leagues server auth middleware", () => {
  it("imports requireAuth from auth module", () => {
    expect(leaguesServerCode).toContain('import { requireAuth } from "./auth.js"');
  });

  // All POST endpoints must have requireAuth
  it("applies requireAuth to POST / (create league)", () => {
    expect(leaguesServerCode).toMatch(/leaguesRouter\.post\("\/",\s*requireAuth/);
  });

  it("applies requireAuth to POST /:leagueId/start", () => {
    expect(leaguesServerCode).toMatch(/leaguesRouter\.post\("\/:leagueId\/start",\s*requireAuth/);
  });

  it("applies requireAuth to POST /:leagueId/matches/:matchId/result", () => {
    expect(leaguesServerCode).toMatch(/leaguesRouter\.post\("\/:leagueId\/matches\/:matchId\/result",\s*requireAuth/);
  });

  it("applies requireAuth to POST /:leagueId/advance-week", () => {
    expect(leaguesServerCode).toMatch(/leaguesRouter\.post\("\/:leagueId\/advance-week",\s*requireAuth/);
  });

  it("applies requireAuth to POST /:leagueId/join-request", () => {
    expect(leaguesServerCode).toMatch(/leaguesRouter\.post\("\/:leagueId\/join-request",\s*requireAuth/);
  });

  it("applies requireAuth to POST /:leagueId/push/subscribe", () => {
    expect(leaguesServerCode).toMatch(/leaguesRouter\.post\("\/:leagueId\/push\/subscribe",\s*requireAuth/);
  });

  it("applies requireAuth to POST /:leagueId/invites", () => {
    expect(leaguesServerCode).toMatch(/leaguesRouter\.post\("\/:leagueId\/invites",\s*requireAuth/);
  });

  // All PATCH endpoints must have requireAuth
  it("applies requireAuth to PATCH /:leagueId/matches/:matchId/result", () => {
    expect(leaguesServerCode).toMatch(/leaguesRouter\.patch\("\/:leagueId\/matches\/:matchId\/result",\s*requireAuth/);
  });

  it("applies requireAuth to PATCH /:leagueId/weeks/:weekId/deadline", () => {
    expect(leaguesServerCode).toMatch(/leaguesRouter\.patch\("\/:leagueId\/weeks\/:weekId\/deadline",\s*requireAuth/);
  });

  it("applies requireAuth to PATCH /:leagueId/join-requests/:requestId", () => {
    expect(leaguesServerCode).toMatch(/leaguesRouter\.patch\("\/:leagueId\/join-requests\/:requestId",\s*requireAuth/);
  });

  it("applies requireAuth to PATCH /:leagueId/invites/:inviteId", () => {
    expect(leaguesServerCode).toMatch(/leaguesRouter\.patch\("\/:leagueId\/invites\/:inviteId",\s*requireAuth/);
  });

  // DELETE endpoints must have requireAuth
  it("applies requireAuth to DELETE /:leagueId/push/subscribe", () => {
    expect(leaguesServerCode).toMatch(/leaguesRouter\.delete\("\/:leagueId\/push\/subscribe",\s*requireAuth/);
  });

  it("applies requireAuth to DELETE /:leagueId/invites/:inviteId", () => {
    expect(leaguesServerCode).toMatch(/leaguesRouter\.delete\("\/:leagueId\/invites\/:inviteId",\s*requireAuth/);
  });

  // Auth-required GET endpoints
  it("applies requireAuth to GET /mine", () => {
    expect(leaguesServerCode).toMatch(/leaguesRouter\.get\("\/mine",\s*requireAuth/);
  });

  it("applies requireAuth to GET /invites/mine", () => {
    expect(leaguesServerCode).toMatch(/leaguesRouter\.get\("\/invites\/mine",\s*requireAuth/);
  });

  it("applies requireAuth to GET /:leagueId/join-requests", () => {
    expect(leaguesServerCode).toMatch(/leaguesRouter\.get\("\/:leagueId\/join-requests",\s*requireAuth/);
  });

  it("applies requireAuth to GET /:leagueId/push/status", () => {
    expect(leaguesServerCode).toMatch(/leaguesRouter\.get\("\/:leagueId\/push\/status",\s*requireAuth/);
  });

  it("applies requireAuth to GET /:leagueId/invites", () => {
    expect(leaguesServerCode).toMatch(/leaguesRouter\.get\("\/:leagueId\/invites",\s*requireAuth/);
  });

  // Public GET endpoints should NOT have requireAuth
  it("keeps GET /club/:clubId public (no requireAuth)", () => {
    const match = leaguesServerCode.match(/leaguesRouter\.get\("\/club\/:clubId"(.*?)\)/s);
    expect(match).toBeTruthy();
    expect(match![1]).not.toContain("requireAuth");
  });

  it("keeps GET /:leagueId public (no requireAuth)", () => {
    // The GET /:leagueId line specifically
    const lines = leaguesServerCode.split("\n");
    const getLeagueLine = lines.find(l => l.includes('leaguesRouter.get("/:leagueId"') && !l.includes("weeks") && !l.includes("standings") && !l.includes("join-requests") && !l.includes("push") && !l.includes("invites"));
    expect(getLeagueLine).toBeTruthy();
    expect(getLeagueLine).not.toContain("requireAuth");
  });

  it("keeps GET /:leagueId/weeks public (no requireAuth)", () => {
    const match = leaguesServerCode.match(/leaguesRouter\.get\("\/:leagueId\/weeks"(.*?)\)/s);
    expect(match).toBeTruthy();
    expect(match![1]).not.toContain("requireAuth");
  });

  it("keeps GET /:leagueId/standings public (no requireAuth)", () => {
    const match = leaguesServerCode.match(/leaguesRouter\.get\("\/:leagueId\/standings"(.*?)\)/s);
    expect(match).toBeTruthy();
    expect(match![1]).not.toContain("requireAuth");
  });
});

describe("LeagueDashboard fetch credentials", () => {
  it("includes credentials on match result POST", () => {
    expect(leagueDashboardCode).toContain('method: "POST",\n      credentials: "include",\n      headers: { "Content-Type": "application/json" },\n      body: JSON.stringify({ result })');
  });

  it("includes credentials on dispute resolve PATCH", () => {
    expect(leagueDashboardCode).toContain('method: "PATCH",\n      credentials: "include",\n      headers: { "Content-Type": "application/json" },\n      body: JSON.stringify({ result })');
  });

  it("includes credentials on advance-week POST", () => {
    expect(leagueDashboardCode).toContain('method: "POST", credentials: "include" }');
  });

  it("includes credentials on deadline PATCH", () => {
    expect(leagueDashboardCode).toContain('method: "PATCH",\n      credentials: "include",\n      headers: { "Content-Type": "application/json" },\n      body: JSON.stringify({ deadline })');
  });

  it("includes credentials on join-requests fetch", () => {
    expect(leagueDashboardCode).toContain('fetch(`/api/leagues/${leagueId}/join-requests`, { credentials: "include" })');
  });

  it("includes credentials on invites fetch", () => {
    expect(leagueDashboardCode).toContain('fetch(`/api/leagues/${leagueId}/invites`, { credentials: "include" })');
  });

  it("includes credentials on push status fetch", () => {
    expect(leagueDashboardCode).toContain('fetch(`/api/leagues/${leagueId}/push/status`, { credentials: "include" })');
  });
});

describe("ClubProfile league creation credentials", () => {
  it("includes credentials on league creation POST", () => {
    // The ClubProfile creates leagues via POST /api/leagues with credentials
    expect(clubProfileCode).toContain('fetch("/api/leagues", {\n                              method: "POST",\n                              credentials: "include"');
  });

  it("includes credentials on join-request POST", () => {
    // The join-request POST in ClubProfile includes credentials
    expect(clubProfileCode).toContain('fetch(`/api/leagues/${lgId}/join-request`');
    // Find the fetch block and verify credentials are present
    const joinReqIdx = clubProfileCode.indexOf('fetch(`/api/leagues/${lgId}/join-request`');
    expect(joinReqIdx).toBeGreaterThan(-1);
    const block = clubProfileCode.slice(joinReqIdx, joinReqIdx + 200);
    expect(block).toContain('credentials: "include"');
  });
});
