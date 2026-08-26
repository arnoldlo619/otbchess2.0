import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "server/index.ts"), "utf8");

describe("server entrypoint legacy cleanup", () => {
  it("does not retain unused legacy proxy or duplicate limiter declarations", () => {
    expect(source).not.toContain("async function proxyLichess(");
    expect(source).not.toContain("const chessProxyLimiter = rateLimit(");
    expect(source).not.toContain("const prepLimiter = rateLimit(");
    expect(source).not.toContain("const pushSubscribeLimiter = rateLimit(");
    expect(source).not.toContain("gameSessions } from \"../shared/schema.js\"");
  });

  it("uses the shared auth middleware userId contract for tournament analytics ownership", () => {
    expect(source).toContain("const userId = (req as Request & { userId?: string }).userId;");
    expect(source).toContain("if (!userId) return res.status(401).json({ error: \"Not authenticated\" });");
  });

  it("uses a narrow persisted tournament state contract for attendance analytics", () => {
    expect(source).toContain("players?: Array<{ id: string; joinedAt?: number }>;");
    expect(source).toContain("startedAt?: number;");
    expect(source).not.toContain("const players: any[] = state.players ?? [];");
  });

  it("uses typed player usernames for repeat-event growth analytics", () => {
    expect(source).toContain("players?: Array<{ username?: string }>;");
    expect(source).not.toContain("map((p: any) => (p.username ?? \"\").toLowerCase())");
  });

  it("uses typed shared authentication for public visibility ownership routes", () => {
    expect(source.match(/const userId = \(req as Request & \{ userId\?: string \}\)\.userId;/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it("uses typed shared authentication for owner-only tournament deletion", () => {
    expect(source).toContain("app.delete(\"/api/tournament/:id\", requireAuth, async (req, res) =>");
    expect(source).not.toContain("app.delete(\"/api/tournament/:id\", requireAuth, async (req: any, res)");
  });

  it("uses shared authentication and schema-derived data for broadcast settings", () => {
    expect(source).toContain("const values: typeof tournamentBroadcastSettings.$inferInsert = {");
    expect(source).not.toContain("eq(userTournaments.userId, req.user.id)");
    expect(source).not.toContain("values(values as any)");
  });

  it("uses the public snapshot input contract for persisted player and round arrays", () => {
    expect(source).toContain("players?: BuildSnapshotInput[\"players\"];");
    expect(source).toContain("rounds?: BuildSnapshotInput[\"rounds\"];");
    expect(source).not.toContain("players: (s.players ?? []) as any[]");
  });

  it("uses schema-derived inputs for protected achievement batches", () => {
    expect(source).toContain("type AchievementInput = Omit<typeof playerAchievements.$inferInsert, \"id\" | \"earnedAt\">;");
    expect(source).not.toContain("app.post(\"/api/player/achievements\", requireAuth, async (req: any, res)");
  });
});
