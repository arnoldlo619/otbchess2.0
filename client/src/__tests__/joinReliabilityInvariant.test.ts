import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  formatJoinDate,
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

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => Array.from(values.keys())[index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  } as Storage;
}

describe("Join registration issue presentation", () => {
  it.each([
    ["full", "Tournament Full"],
    ["duplicate", "Already Registered"],
    ["closed", "Registration Closed"],
    ["invalid", "Tournament Not Found"],
    ["network", "Could Not Register"],
  ] as Array<[RegistrationIssue, string]>) ("presents %s failures distinctly", (issue, title) => {
    const presentation = getRegistrationIssuePresentation(issue);
    expect(presentation.title).toBe(title);
    expect(presentation.message.length).toBeGreaterThan(20);
  });
});

describe("Join tournament context", () => {
  it("formats local calendar dates without timezone drift and handles missing values", () => {
    expect(formatJoinDate("2026-08-22")).toBe("Aug 22, 2026");
    expect(formatJoinDate()).toBe("Date to be announced");
    expect(formatJoinDate("not-a-date")).toBe("Date to be announced");
  });
});

describe("postPlayerToServer", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createMemoryStorage());
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
  const joinServerSource = readFileSync(resolve(projectRoot, "server/userTournamentRoutes.ts"), "utf8");
  const directorSource = readFileSync(resolve(projectRoot, "client/src/pages/Director.tsx"), "utf8");
  const wizardSource = readFileSync(resolve(projectRoot, "client/src/components/TournamentWizard.tsx"), "utf8");
  const scannerSource = readFileSync(resolve(projectRoot, "client/src/components/QrScanner.tsx"), "utf8");

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

  it("preserves name, format, date, and time context across fresh-device Join paths", () => {
    expect(joinServerSource).toContain("date: userTournaments.date");
    expect(directorSource).toContain("date: tournamentConfig.date || undefined");
    expect(wizardSource).toContain("date: data.date || undefined");
    expect(joinSource).toContain('date: data.date ?? ""');
    expect(joinSource).toContain("date: formatJoinDate(");
    expect(joinSource.match(/tournamentDisplay\.date/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
  });

  it("requests camera permission only after the user explicitly opens the scanner", () => {
    expect(joinSource).toContain("const [showQrScanner, setShowQrScanner] = useState(false)");
    expect(joinSource).toContain("onClick={() => setShowQrScanner(true)}");
    expect(joinSource).toContain("Camera access is requested only after you tap Scan QR code.");
    expect(joinSource).toContain("{showQrScanner && (");
    expect(scannerSource).toContain("navigator.mediaDevices.getUserMedia");
    expect(scannerSource).toContain('aria-label="Close scanner"');
    expect(scannerSource).toContain('role="alert" aria-live="assertive"');
  });

  it("shows complete confirmation details and explicit correction controls", () => {
    expect(joinSource).toContain("Profile matched on");
    expect(joinSource).toContain("not federation verification");
    expect(joinSource).toContain("Pairing rating");
    expect(joinSource).toContain("Edit profile");
    expect(joinSource).toContain("Change tournament");
    expect(joinSource).toContain("pickRating(profile, resolvedConfig?.ratingType)");
  });

  it("uses durable success guidance and animated, keyed step transitions", () => {
    expect(joinSource).toContain("Check in with the director when you arrive");
    expect(joinSource).toContain("Round timing is announced by the director");
    expect(joinSource).toContain("Open the tournament dashboard to find your board and pairings");
    expect(joinSource.match(/animate-spring-in/g)?.length ?? 0).toBeGreaterThanOrEqual(5);
    expect(joinSource).toContain('key={`step4-${stepKey}`}');
    expect(joinSource).not.toContain("First opponent matched by ELO proximity");
  });
});
