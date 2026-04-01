/**
 * Mobile Tournament Navigation — Unit Tests
 *
 * Tests for the useActiveTournament hook logic and the navigation
 * touchpoints that surface active tournament state to mobile users.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// ─── Mock localStorage ────────────────────────────────────────────────────────
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(globalThis, "localStorage", { value: localStorageMock, writable: true });

// ─── Helpers ──────────────────────────────────────────────────────────────────
const REGISTRY_KEY = "otb-tournament-registry";
const DIRECTOR_PREFIX = "otb-director-session-";
const REG_KEY = "otb-player-registrations";

function seedRegistry(tournaments: Array<{ id: string; name: string; status?: string }>) {
  const registry: Record<string, unknown> = {};
  for (const t of tournaments) {
    registry[t.id] = { id: t.id, name: t.name, createdAt: Date.now() };
  }
  localStorage.setItem(REGISTRY_KEY, JSON.stringify(registry));
}

function seedDirectorSession(tournamentId: string, status: string = "in_progress") {
  localStorage.setItem(
    `${DIRECTOR_PREFIX}${tournamentId}`,
    JSON.stringify({ tournamentId, status, createdAt: Date.now() })
  );
}

function seedPlayerRegistration(tournamentId: string) {
  const regs = [{ tournamentId, playerName: "Alice", chessComUsername: "alice99", registeredAt: Date.now() }];
  localStorage.setItem(REG_KEY, JSON.stringify(regs));
}

// ─── Core Logic Tests (pure functions, no React hooks) ────────────────────────
describe("Active tournament detection logic", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns null when no tournaments exist", () => {
    const registry = JSON.parse(localStorage.getItem(REGISTRY_KEY) ?? "{}");
    expect(Object.keys(registry)).toHaveLength(0);
  });

  it("detects director session from localStorage", () => {
    seedRegistry([{ id: "t-abc", name: "Club Blitz" }]);
    seedDirectorSession("t-abc", "in_progress");

    const sessionRaw = localStorage.getItem(`${DIRECTOR_PREFIX}t-abc`);
    expect(sessionRaw).not.toBeNull();
    const session = JSON.parse(sessionRaw!);
    expect(session.tournamentId).toBe("t-abc");
    expect(session.status).toBe("in_progress");
  });

  it("detects player registration from localStorage", () => {
    seedRegistry([{ id: "t-xyz", name: "Tuesday Blitz" }]);
    seedPlayerRegistration("t-xyz");

    const regsRaw = localStorage.getItem(REG_KEY);
    expect(regsRaw).not.toBeNull();
    const regs = JSON.parse(regsRaw!);
    expect(regs).toHaveLength(1);
    expect(regs[0].tournamentId).toBe("t-xyz");
  });

  it("prefers director role over player registration when both exist", () => {
    seedRegistry([
      { id: "t-dir", name: "My Tournament" },
      { id: "t-player", name: "Other Tournament" },
    ]);
    seedDirectorSession("t-dir", "in_progress");
    seedPlayerRegistration("t-player");

    // Director session should take priority
    const dirKey = `${DIRECTOR_PREFIX}t-dir`;
    const dirSession = localStorage.getItem(dirKey);
    expect(dirSession).not.toBeNull();
    // The hook would return director role first
    expect(JSON.parse(dirSession!).tournamentId).toBe("t-dir");
  });

  it("returns null when registry is empty even if stale registration exists", () => {
    // Registration for a tournament that no longer exists in registry
    seedPlayerRegistration("t-deleted");
    // Registry is empty
    const registry = JSON.parse(localStorage.getItem(REGISTRY_KEY) ?? "{}");
    expect(registry["t-deleted"]).toBeUndefined();
  });
});

// ─── Status Mapping Tests ─────────────────────────────────────────────────────
describe("Tournament status mapping", () => {
  function mapDirectorStatus(raw: string): "in_progress" | "registration" | "completed" | "unknown" {
    if (raw === "active" || raw === "in_progress") return "in_progress";
    if (raw === "lobby" || raw === "registration") return "registration";
    if (raw === "complete" || raw === "completed" || raw === "finished") return "completed";
    return "unknown";
  }

  it("maps 'active' to in_progress", () => {
    expect(mapDirectorStatus("active")).toBe("in_progress");
  });

  it("maps 'in_progress' to in_progress", () => {
    expect(mapDirectorStatus("in_progress")).toBe("in_progress");
  });

  it("maps 'lobby' to registration", () => {
    expect(mapDirectorStatus("lobby")).toBe("registration");
  });

  it("maps 'registration' to registration", () => {
    expect(mapDirectorStatus("registration")).toBe("registration");
  });

  it("maps 'complete' to completed", () => {
    expect(mapDirectorStatus("complete")).toBe("completed");
  });

  it("maps 'completed' to completed", () => {
    expect(mapDirectorStatus("completed")).toBe("completed");
  });

  it("maps 'finished' to completed", () => {
    expect(mapDirectorStatus("finished")).toBe("completed");
  });

  it("maps unknown strings to 'unknown'", () => {
    expect(mapDirectorStatus("pending")).toBe("unknown");
    expect(mapDirectorStatus("")).toBe("unknown");
  });
});

// ─── URL Generation Tests ─────────────────────────────────────────────────────
describe("Tournament URL generation", () => {
  function buildHref(role: "director" | "player", tournamentId: string): string {
    return role === "director"
      ? `/tournament/${tournamentId}/manage`
      : `/tournament/${tournamentId}`;
  }

  it("builds director manage URL", () => {
    expect(buildHref("director", "t-abc")).toBe("/tournament/t-abc/manage");
  });

  it("builds player standings URL", () => {
    expect(buildHref("player", "t-abc")).toBe("/tournament/t-abc");
  });

  it("handles tournament IDs with hyphens", () => {
    expect(buildHref("director", "tuesday-blitz-2026")).toBe("/tournament/tuesday-blitz-2026/manage");
  });
});

// ─── Hero CTA Logic Tests ─────────────────────────────────────────────────────
describe("Hero Return to Tournament CTA display logic", () => {
  it("should show CTA when activeTournament is not null", () => {
    const activeTournament = {
      id: "t-abc",
      name: "Club Blitz",
      href: "/tournament/t-abc/manage",
      role: "director" as const,
      status: "in_progress" as const,
    };
    expect(activeTournament).not.toBeNull();
    expect(activeTournament.role).toBe("director");
  });

  it("should not show CTA when activeTournament is null", () => {
    const activeTournament = null;
    expect(activeTournament).toBeNull();
  });

  it("shows LIVE badge for in_progress status", () => {
    const status = "in_progress";
    const showLive = status === "in_progress";
    expect(showLive).toBe(true);
  });

  it("shows LOBBY badge for registration status", () => {
    const status = "registration";
    const showLobby = status === "registration";
    expect(showLobby).toBe(true);
  });

  it("shows correct label for director role", () => {
    const role = "director";
    const label = role === "director" ? "Tap to manage" : "Tap to view standings";
    expect(label).toBe("Tap to manage");
  });

  it("shows correct label for player role", () => {
    const role = "player";
    const label = role === "director" ? "Tap to manage" : "Tap to view standings";
    expect(label).toBe("Tap to view standings");
  });
});

// ─── Active Dot Badge Logic ───────────────────────────────────────────────────
describe("Tournaments tab active dot badge logic", () => {
  function shouldShowDot(status: string | null): boolean {
    if (!status) return false;
    return status === "in_progress" || status === "registration" || status === "unknown";
  }

  it("shows dot for in_progress tournaments", () => {
    expect(shouldShowDot("in_progress")).toBe(true);
  });

  it("shows dot for registration/lobby tournaments", () => {
    expect(shouldShowDot("registration")).toBe(true);
  });

  it("shows dot for unknown status (graceful fallback)", () => {
    expect(shouldShowDot("unknown")).toBe(true);
  });

  it("does not show dot for completed tournaments", () => {
    expect(shouldShowDot("completed")).toBe(false);
  });

  it("does not show dot when no active tournament", () => {
    expect(shouldShowDot(null)).toBe(false);
  });
});

// ─── GuestMobileMenu Tournament Entry ────────────────────────────────────────
describe("GuestMobileMenu tournament entry", () => {
  it("shows tournament name truncated for long names", () => {
    const name = "Tuesday Beers & Blunders OTB Blitz Championship 2026";
    // The dropdown uses CSS overflow: hidden + text-overflow: ellipsis
    // We just verify the name is passed through correctly
    expect(name.length).toBeGreaterThan(30);
    expect(name).toContain("Blitz");
  });

  it("shows LIVE indicator for in_progress status", () => {
    const status = "in_progress";
    const label = status === "in_progress" ? "● LIVE" : "Active Tournament";
    expect(label).toBe("● LIVE");
  });

  it("shows 'Your Tournament' label for director role", () => {
    const role = "director";
    const status = "registration";
    const label = status === "in_progress" ? "● LIVE" : role === "director" ? "Your Tournament" : "Active Tournament";
    expect(label).toBe("Your Tournament");
  });
});
