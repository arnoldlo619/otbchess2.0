/** @vitest-environment jsdom */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getRegistrationIssuePresentation,
  postPlayerToServer,
  type RegistrationIssue,
} from "../pages/Join";
import type { Player } from "../lib/tournamentData";

const player = {
  id: "player-alice-1",
  name: "Alice",
  username: "alice",
  elo: 1800,
  points: 0,
  wins: 0,
  draws: 0,
  losses: 0,
  buchholz: 0,
  colorHistory: [],
  platform: "chesscom",
} as Player;

describe("Join registration issue presentation", () => {
  it.each([
    ["full", "Tournament Full"],
    ["duplicate", "Already Registered"],
    ["closed", "Registration Closed"],
    ["invalid", "Tournament Not Found"],
    ["network", "Could Not Register"],
  ] as Array<[RegistrationIssue, string]>)("presents %s failures distinctly", (issue, title) => {
    const presentation = getRegistrationIssuePresentation(issue);
    expect(presentation.title).toBe(title);
    expect(presentation.message.length).toBeGreaterThan(20);
  });
});

describe("postPlayerToServer", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns success only after the server confirms the roster write", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(postPlayerToServer("open-event", player)).resolves.toEqual({ success: true });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/tournament/open-event/players",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("maps authoritative closed and invalid responses to recovery states", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: "registration_closed" }), {
        status: 409,
        headers: { "Content-Type": "application/json" },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: "not_found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(postPlayerToServer("closed-event", player)).resolves.toEqual({ success: false, reason: "closed" });
    await expect(postPlayerToServer("missing-event", player)).resolves.toEqual({ success: false, reason: "invalid" });
  });

  it("keeps network failures retryable instead of reporting false success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    await expect(postPlayerToServer("open-event", player)).resolves.toEqual({ success: false, reason: "network" });
  });
});

describe("Join reliability integration", () => {
  const projectRoot = resolve(import.meta.dirname, "../../..");
  const joinSource = readFileSync(resolve(projectRoot, "client/src/pages/Join.tsx"), "utf8");
  const directorStateSource = readFileSync(resolve(projectRoot, "client/src/lib/directorState.ts"), "utf8");
  const serverSource = readFileSync(resolve(projectRoot, "server/index.ts"), "utf8");

  it("enforces closed/full guards before QR and manual registration", () => {
    expect(joinSource.match(/if \(isTournamentClosed\) \{ showCapToast\("closed"\); return; \}/g)?.length).toBe(2);
    expect(joinSource.match(/if \(isTournamentFull\) \{ showCapToast\("full"\); return; \}/g)?.length).toBe(2);
    expect(directorStateSource).toContain('existing.status !== "registration"');
    expect(directorStateSource).toContain('reason: "closed"');
    expect(serverSource).toContain('error: "registration_closed"');
  });

  it("awaits authoritative roster sync and rolls back optimistic local mutations", () => {
    expect(joinSource.match(/await postPlayerToServer\(/g)?.length).toBe(4);
    expect(joinSource.match(/removeJoinedPlayerFromTournament\(/g)?.length).toBe(3);
    expect(joinSource).toContain("Confirm the authoritative roster write before showing success");
    expect(directorStateSource).toContain("export function removeJoinedPlayerFromTournament");
  });

  it("keeps duplicate and invalid invite outcomes explicit", () => {
    expect(directorStateSource).toContain('reason: "duplicate"');
    expect(joinSource).toContain('title: "Already Registered"');
    expect(joinSource).toContain('title: "Tournament Not Found"');
    expect(joinSource).toContain("Ask the director to share a new one");
    expect(joinSource).toContain('role="alert"');
  });
});
