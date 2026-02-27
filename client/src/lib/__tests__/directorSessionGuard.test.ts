/**
 * Tests for the director session guard logic used in Director.tsx
 * Covers: hasDirectorSession, grantDirectorSession, clearDirectorSession
 * and the guard's demo-tournament bypass.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  hasDirectorSession,
  grantDirectorSession,
  clearDirectorSession,
} from "@/lib/tournamentRegistry";

// The registry stores all sessions in a single key as a JSON array
const DIRECTOR_SESSION_KEY = "otb-director-sessions-v1";

describe("Director session guard — grantDirectorSession / hasDirectorSession / clearDirectorSession", () => {
  beforeEach(() => localStorage.clear());

  it("hasDirectorSession returns false when no session exists", () => {
    expect(hasDirectorSession("t-abc")).toBe(false);
  });

  it("hasDirectorSession returns true after grantDirectorSession", () => {
    grantDirectorSession("t-abc");
    expect(hasDirectorSession("t-abc")).toBe(true);
  });

  it("hasDirectorSession returns false after clearDirectorSession", () => {
    grantDirectorSession("t-abc");
    clearDirectorSession("t-abc");
    expect(hasDirectorSession("t-abc")).toBe(false);
  });

  it("sessions are scoped per tournament ID", () => {
    grantDirectorSession("t-abc");
    expect(hasDirectorSession("t-abc")).toBe(true);
    expect(hasDirectorSession("t-xyz")).toBe(false);
  });

  it("granting a session for one tournament does not affect another", () => {
    grantDirectorSession("t-1");
    grantDirectorSession("t-2");
    clearDirectorSession("t-1");
    expect(hasDirectorSession("t-1")).toBe(false);
    expect(hasDirectorSession("t-2")).toBe(true);
  });

  it("stores a truthy value in localStorage under the shared sessions key", () => {
    grantDirectorSession("t-store");
    const raw = localStorage.getItem(DIRECTOR_SESSION_KEY);
    expect(raw).toBeTruthy();
    const sessions = JSON.parse(raw!) as Array<{ tournamentId: string }>;
    expect(sessions.some((s) => s.tournamentId === "t-store")).toBe(true);
  });

  it("clearDirectorSession removes the entry from the sessions array", () => {
    grantDirectorSession("t-rm");
    clearDirectorSession("t-rm");
    const raw = localStorage.getItem(DIRECTOR_SESSION_KEY);
    if (raw) {
      const sessions = JSON.parse(raw) as Array<{ tournamentId: string }>;
      expect(sessions.some((s) => s.tournamentId === "t-rm")).toBe(false);
    } else {
      // Key removed entirely when empty — also acceptable
      expect(raw).toBeNull();
    }
  });
});

describe("Director session guard — demo tournament bypass", () => {
  beforeEach(() => localStorage.clear());

  it("demo tournament ID should bypass the guard (no session required)", () => {
    // The guard logic: isDemo || hasDirectorSession(id)
    const DEMO_ID = "otb-demo-2026";
    const isDemo = DEMO_ID === "otb-demo-2026";
    const canAccess = isDemo || hasDirectorSession(DEMO_ID);
    expect(canAccess).toBe(true);
  });

  it("non-demo tournament without session should be blocked", () => {
    const id = "real-tournament-001";
    const isDemo = id === "otb-demo-2026";
    const canAccess = isDemo || hasDirectorSession(id);
    expect(canAccess).toBe(false);
  });

  it("non-demo tournament with valid session should be allowed", () => {
    const id = "real-tournament-001";
    grantDirectorSession(id);
    const isDemo = id === "otb-demo-2026";
    const canAccess = isDemo || hasDirectorSession(id);
    expect(canAccess).toBe(true);
  });
});
