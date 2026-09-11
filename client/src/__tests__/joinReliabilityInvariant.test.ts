import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createManualJoinProfile,
  formatJoinDate,
  getRegistrationIssuePresentation,
  isRateLimitError,
  parseManualRating,
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
    ["rate_limited", "Too Many Attempts"],
  ] as Array<[RegistrationIssue, string]>) ("presents %s failures distinctly", (issue, title) => {
    const presentation = getRegistrationIssuePresentation(issue);
    expect(presentation.title).toBe(title);
    expect(presentation.message.length).toBeGreaterThan(20);
  });
});

describe("Join manual rating fallback", () => {
  it("accepts only plausible whole-number chess ratings", () => {
    expect(parseManualRating("1650")).toBe(1650);
    expect(parseManualRating("99")).toBeNull();
    expect(parseManualRating("3501")).toBeNull();
    expect(parseManualRating("1650.5")).toBeNull();
    expect(parseManualRating("")).toBeNull();
  });

  it("creates a platform-preserving manual profile without verification claims", () => {
    expect(createManualJoinProfile("  alice  ", "Alice", 1700, "lichess")).toMatchObject({
      username: "alice",
      name: "Alice",
      rapid: 1700,
      blitz: 1700,
      bullet: 1700,
      classical: 1700,
      elo: 1700,
      platform: "lichess",
      manualRating: true,
    });
  });

  it("recognizes provider and HTTP rate-limit wording", () => {
    expect(isRateLimitError("429 Too Many Requests")).toBe(true);
    expect(isRateLimitError("Provider rate limit reached")).toBe(true);
    expect(isRateLimitError("Username not found")).toBe(false);
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

  it("preserves an authoritative Retry-After duration for friendly wait guidance", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "rate_limited" }), {
      status: 429,
      headers: { "Content-Type": "application/json", "Retry-After": "17" },
    })));
    await expect(postPlayerToServer("busy-event", player)).resolves.toEqual({
      success: false,
      reason: "rate_limited",
      retryAfterSeconds: 17,
    });
    expect(getRegistrationIssuePresentation("rate_limited", 17).message).toContain("17 seconds");
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
  const appSource = readFileSync(resolve(projectRoot, "client/src/App.tsx"), "utf8");
  const themeSource = readFileSync(resolve(projectRoot, "client/src/contexts/ThemeContext.tsx"), "utf8");
  const boundarySource = readFileSync(resolve(projectRoot, "client/src/components/ErrorBoundary.tsx"), "utf8");
  const mainSource = readFileSync(resolve(projectRoot, "client/src/main.tsx"), "utf8");
  const serviceWorkerSource = readFileSync(resolve(projectRoot, "client/public/sw.js"), "utf8");

  it("enforces closed/full guards before QR and manual registration", () => {
    expect(joinSource.match(/if \(isTournamentClosed\) \{ showCapToast\("closed"\); return; \}/g)?.length).toBe(2);
    expect(joinSource.match(/if \(isTournamentFull\) \{ showCapToast\("full"\); return; \}/g)?.length).toBe(2);
    expect(directorStateSource).toContain('existing.status !== "registration"');
    expect(directorStateSource).toContain('reason: "closed"');
    expect(serverSource).toContain('error: "registration_closed"');
  });

  it("awaits authoritative roster sync before an optional local cache mutation", () => {
    expect(joinSource.match(/await postPlayerToServer\(/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
    expect(joinSource).toContain("Confirm the authoritative roster write before touching the optional local cache.");
    expect(joinSource).toContain("try { addPlayerToTournament(config.id, player); } catch");
    expect(directorStateSource).toContain("export function removeJoinedPlayerFromTournament");
  });

  it("catches QR registrations in active Director tabs when an SSE event is missed", () => {
    const playerRouteStart = serverSource.indexOf('app.get("/api/tournament/:id/players"');
    const playerRouteEnd = serverSource.indexOf('app.post("/api/tournament/:id/players"');
    const playerRoute = serverSource.slice(playerRouteStart, playerRouteEnd);
    const directorSyncStart = directorSource.indexOf("Server player sync — SSE stream");
    const directorSyncEnd = directorSource.indexOf("Auto-scroll to the Generate CTA", directorSyncStart);
    const directorSync = directorSource.slice(directorSyncStart, directorSyncEnd);

    expect(playerRoute).toContain('res.setHeader("Cache-Control", "no-store")');
    expect(directorSync).toContain('cache: "no-store"');
    expect(directorSync).toContain("es.onopen = () => { void refreshRemoteRoster(); };");
    expect(directorSync).toContain('document.addEventListener("visibilitychange", refreshOnVisibilityChange)');
    expect(directorSync).toContain("const rosterPoll = window.setInterval");
    expect(directorSync).toContain("window.clearInterval(rosterPoll)");
    expect(directorSync).toContain("disposed = true");
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

  it("uses server-first invite metadata and never relies on public spectator visibility", () => {
    expect(joinSource).toContain("configFromServerResolution");
    expect(joinSource).toContain('authFetch(`/api/auth/join/resolve/${encodeURIComponent(urlCode)}`)');
    expect(joinSource).toContain('authFetch(`/api/tournament/${encodeURIComponent(resolvedConfig.id)}/live-state`)');
    expect(joinSource).not.toContain('authFetch(`/api/public/tournament/${encodeURIComponent(resolvedConfig.id)}`)');
    expect(joinServerSource).toContain("eq(userTournaments.tournamentId, codeOrSlug)");
    expect(joinServerSource).toContain("lower(${userTournaments.customSlug}) = lower(${codeOrSlug})");
    expect(joinServerSource).toContain('res.setHeader("Cache-Control", "no-store, max-age=0")');
    expect(serverSource).toContain('res.setHeader("Cache-Control", "no-store, max-age=0")');
  });

  it("keeps QR bootstrap recoverable when storage, routing, or chunk loading fails", () => {
    expect(themeSource).toContain("function readStoredTheme");
    expect(themeSource).toContain("function persistTheme");
    expect(boundarySource).not.toContain("sessionStorage");
    expect(boundarySource).toContain('href="/join"');
    expect(appSource).toContain("function QrJoinEntryShell()");
    expect(appSource).toContain("data-qr-entry-shell");
    expect(appSource).toContain("isQrJoinRoute ? <QrJoinEntryShell /> : <PageLoader />");
    expect(joinSource).toContain("function getSafeSessionStorage()");
    expect(joinSource).toContain("data-qr-resolve-recovery");
    expect(joinSource).toContain("setBootstrapAttempt((attempt) => attempt + 1)");
    expect(mainSource).toContain('register("/sw.js?v=otb-chess-v7"');
    expect(serviceWorkerSource).toContain('const CACHE_VERSION = "otb-chess-v7"');
    expect(serviceWorkerSource).toContain("self.skipWaiting()");
    expect(serviceWorkerSource).toContain("self.clients.claim()");
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

  it("allows manual pairing ratings only as an explicit provider fallback", () => {
    expect(joinSource).toContain('inputId="qr-manual-pairing-rating"');
    expect(joinSource).toContain('inputId="manual-flow-pairing-rating"');
    expect(joinSource).toContain("Used only if ${providerLabel} cannot provide a rating.");
    expect(joinSource).toContain("Rating entered manually; not platform or federation verified");
    expect(joinSource).toContain('ratingSource: "manual" as const');
    expect(joinSource).toContain("Enter a manual pairing rating from 100 to 3500.");
  });

  it("offers spectator recovery after registration closes and wait guidance after throttling", () => {
    expect(joinSource).toContain("View pairings and results");
    expect(joinSource).toContain("spectatorTournamentId");
    expect(joinSource).toContain('href={`/tournament/${spectatorTournamentId}`}');
    expect(joinSource).toContain("Please wait ${Math.max(1, retryAfterSeconds ?? 60)} seconds");
    expect(joinSource).toContain("response.status === 429");
    expect(joinSource).toContain("showCapToast(sync.reason, sync.retryAfterSeconds)");
  });
});
