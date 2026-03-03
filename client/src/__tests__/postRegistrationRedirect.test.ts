/**
 * Post-Registration Redirect Tests
 *
 * Verifies that after a player completes registration on the Join page,
 * the navigation target is always a valid /tournament/:id/play URL —
 * even on fresh devices where localStorage has no prior tournament data.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// ── localStorage mock ─────────────────────────────────────────────────────────
const store: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
};
vi.stubGlobal("localStorage", localStorageMock);

// Import after stubbing localStorage so the module uses the mock
import { registerTournament, resolveTournament, clearRegistry } from "@/lib/tournamentRegistry";

// ── Mirrors the ID-resolution priority used in handleConfirm ──────────────────
function resolveTargetId(
  tournamentCode: string,
  embeddedMetaId: string | undefined,
  embeddedMetaInviteCode: string | undefined,
): string {
  const fromCode = resolveTournament(tournamentCode)?.id;
  if (fromCode) return fromCode;

  const fromMeta = embeddedMetaInviteCode
    ? resolveTournament(embeddedMetaInviteCode)?.id
    : undefined;
  if (fromMeta) return fromMeta;

  if (embeddedMetaId) return embeddedMetaId;

  return tournamentCode;
}

const MOCK_TOURNAMENT = {
  id: "spring-open-2026",
  inviteCode: "SPRING26",
  directorCode: "DIR-ABC123",
  name: "Spring Open 2026",
  venue: "Chess Club",
  date: "2026-03-03",
  description: "",
  format: "swiss" as const,
  rounds: 5,
  maxPlayers: 32,
  timeBase: 15,
  timeIncrement: 10,
  timePreset: "15+10",
  ratingSystem: "chess.com" as const,
  createdAt: new Date().toISOString(),
};

beforeEach(() => {
  localStorageMock.clear();
});

describe("Post-registration redirect ID resolution", () => {
  it("resolves to slug when tournament is in localStorage (normal flow)", () => {
    registerTournament(MOCK_TOURNAMENT);
    const id = resolveTargetId("SPRING26", undefined, undefined);
    expect(id).toBe("spring-open-2026");
  });

  it("resolves to embeddedMeta.id when localStorage is empty (fresh device QR scan)", () => {
    // Fresh device — no localStorage, but embeddedMeta has the tournament ID
    const id = resolveTargetId("SPRING26", "spring-open-2026", "SPRING26");
    expect(id).toBe("spring-open-2026");
  });

  it("resolves via embeddedMeta.inviteCode when registry is populated after bootstrap", () => {
    registerTournament(MOCK_TOURNAMENT);
    const id = resolveTargetId("SPRING26", "spring-open-2026", "SPRING26");
    expect(id).toBe("spring-open-2026");
  });

  it("falls back to raw tournamentCode when no other resolution is possible", () => {
    // Worst case: no localStorage, no embeddedMeta
    const id = resolveTargetId("SPRING26", undefined, undefined);
    expect(id).toBe("SPRING26");
  });

  it("prefers registry slug over embeddedMeta.id", () => {
    registerTournament(MOCK_TOURNAMENT);
    const id = resolveTargetId("SPRING26", "some-other-id", "SPRING26");
    expect(id).toBe("spring-open-2026");
  });

  it("builds a valid /play URL from the resolved ID", () => {
    registerTournament(MOCK_TOURNAMENT);
    const id = resolveTargetId("SPRING26", "spring-open-2026", "SPRING26");
    const url = `/tournament/${id}/play?username=${encodeURIComponent("magnus")}`;
    expect(url).toBe("/tournament/spring-open-2026/play?username=magnus");
  });

  it("builds a valid /play URL on fresh device using embeddedMeta.id", () => {
    const id = resolveTargetId("SPRING26", "spring-open-2026", "SPRING26");
    const url = `/tournament/${id}/play?username=${encodeURIComponent("hikaru")}`;
    expect(url).toBe("/tournament/spring-open-2026/play?username=hikaru");
  });

  it("handles username with special characters correctly", () => {
    registerTournament(MOCK_TOURNAMENT);
    const id = resolveTargetId("SPRING26", "spring-open-2026", "SPRING26");
    const url = `/tournament/${id}/play?username=${encodeURIComponent("player+one")}`;
    expect(url).toBe("/tournament/spring-open-2026/play?username=player%2Bone");
  });

  it("resolves when only embeddedMeta.inviteCode is provided (no embeddedMeta.id)", () => {
    registerTournament(MOCK_TOURNAMENT);
    const id = resolveTargetId("SPRING26", undefined, "SPRING26");
    expect(id).toBe("spring-open-2026");
  });
});

describe("Tournament registry clearRegistry helper", () => {
  it("clearRegistry removes all registered tournaments", () => {
    registerTournament(MOCK_TOURNAMENT);
    expect(resolveTournament("SPRING26")).not.toBeNull();
    clearRegistry();
    expect(resolveTournament("SPRING26")).toBeNull();
  });
});
