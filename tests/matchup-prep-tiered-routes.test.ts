import http from "node:http";
import express from "express";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const runtime = vi.hoisted(() => ({ isPro: false }));

vi.mock("../server/auth.js", () => ({
  requireAuth: (req: { userId?: string }, _res: unknown, next: () => void) => { req.userId = "user-1"; next(); },
}));

vi.mock("../server/authCore.js", () => ({
  getTokenPayload: () => ({ sub: "user-1", isGuest: false }),
}));

vi.mock("../server/db.js", async () => {
  const { savedPrepReports, users } = await import("../shared/schema.js");
  const savedRow = {
    id: 7,
    opponentUsername: "scouted-player",
    opponentName: "scouted-player",
    winRate: null,
    gamesAnalyzed: 12,
    prepLinesCount: 1,
    savedAt: new Date("2026-09-01T00:00:00.000Z"),
    reportJson: JSON.stringify({
      openingSummary: { white: [{ name: "Italian Game", games: 7, share: 0.7, score: 0.5 }], black: [{ name: "Sicilian Defense", games: 5, share: 0.5, score: 0.4 }] },
      openingForecast: { white: [{ moveSan: "e4" }], black: [] },
      insights: [{ id: "weakness-1", kind: "weakness" }],
      scoutBrief: [{ id: "brief-1" }],
      sections: { matchupSummary: ["x"], strengths: ["x"], weaknesses: ["weakness-1"], weakSignals: ["x"], ifYouHaveWhite: ["x"], ifYouHaveBlack: ["x"], deviationPoints: ["x"], behavior: ["x"], prepChecklist: ["x"] },
    }),
  };
  return {
    getDb: async () => ({
      select: () => ({
        from: (table: unknown) => ({
          where: () => ({
            limit: async () => table === users ? [{ isPro: runtime.isPro, isStaff: false, proExpiresAt: null }] : table === savedPrepReports ? [savedRow] : [],
          }),
        }),
      }),
    }),
  };
});

import { createPrepRouter } from "../server/prepRoutes.js";

let server: http.Server;
let origin: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use("/api/prep", createPrepRouter());
  await new Promise<void>(resolve => { server = app.listen(0, "127.0.0.1", () => resolve()); });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not bind");
  origin = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => { await new Promise<void>(resolve => server.close(() => resolve())); });

async function request(path: string, init?: RequestInit) {
  const response = await fetch(`${origin}${path}`, init);
  return { response, body: await response.json() as Record<string, unknown> };
}

describe("Matchup Prep server-tier enforcement", () => {
  it("blocks free accounts from each detailed route and the legacy detailed contract", async () => {
    runtime.isPro = false;
    const [legacy, analysis, enrich, coach] = await Promise.all([
      request("/api/prep/scouted-player?schema=2"),
      request("/api/prep/analysis/resolve", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }),
      request("/api/prep/analysis/enrich/game-1"),
      request("/api/prep/coach-insight", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }),
    ]);
    for (const result of [legacy, analysis, enrich, coach]) {
      expect(result.response.status).toBe(403);
      expect(result.body.error).toBe("PRO_REQUIRED");
    }
  });

  it("projects saved reports for free accounts but retains detail for Pro", async () => {
    runtime.isPro = false;
    const free = await request("/api/prep/saved/7");
    expect(free.response.status).toBe(200);
    expect((free.body.report as { access: { tier: string }; insights: unknown[]; openingSummary: unknown }).access.tier).toBe("free");
    expect((free.body.report as { insights: unknown[] }).insights).toEqual([]);
    expect((free.body.report as { openingSummary: unknown }).openingSummary).toBeTruthy();

    runtime.isPro = true;
    const pro = await request("/api/prep/saved/7");
    expect(pro.response.status).toBe(200);
    expect((pro.body.report as { access: { tier: string }; insights: unknown[] }).access.tier).toBe("pro");
    expect((pro.body.report as { insights: unknown[] }).insights).toHaveLength(1);
  });
});
